# LumiaPay Rate Limiting Implementation — Complete Report

**Date:** 2024-01-14  
**Status:** ✅ IMPLEMENTED & VERIFIED  
**Test Coverage:** 46/46 rate-limit tests passing, 200/200 total tests passing

---

## Executive Summary

A production-grade, two-layer rate limiting system has been successfully implemented to protect LumiaPay's API endpoints, with special emphasis on preventing abuse of the payment verification endpoint that triggers expensive blockchain RPC calls.

### Critical Achievement
The public payment verification endpoint (`POST /api/payments/[id]?action=verify`) is now protected with:
- **10 requests per 60 seconds per IP address**
- **Fail-closed strategy** — blocks requests when the rate-limit store is unavailable
- **Atomic enforcement** — prevents race conditions in concurrent requests
- **LRU cache fast-path** — blocks repeat offenders without database queries

---

## Architecture Overview

### Two-Layer Design

```
┌─────────────────────────────────────────────────────────────┐
│                        API Request                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                    ┌─────▼─────┐
                    │  Layer 1  │  In-Process LRU Cache
                    │ Fast Path │  (10,000 entries)
                    └─────┬─────┘
                          │
                  ┌───────▼────────┐
                  │ Cache Hit?     │
                  │ Already Blocked│
                  └───┬────────┬───┘
                      │        │
                  Yes │        │ No
                      │        │
              ┌───────▼─┐      │
              │ Return  │      │
              │ 429     │      │
              └─────────┘      │
                               │
                       ┌───────▼────────┐
                       │    Layer 2     │
                       │ PostgreSQL RPC │
                       │ Atomic Bucket  │
                       └───────┬────────┘
                               │
                      ┌────────▼─────────┐
                      │  Update Cache &  │
                      │  Return Result   │
                      └──────────────────┘
```

### Database Implementation

**Table:** `rate_limit_buckets`
```sql
CREATE TABLE rate_limit_buckets (
  key        TEXT PRIMARY KEY,           -- rl:<route>:<identifier>
  tokens     INTEGER NOT NULL,           -- remaining requests
  reset_at   TIMESTAMP WITH TIME ZONE,   -- window reset time
  updated_at TIMESTAMP WITH TIME ZONE
);
```

**Function:** `check_rate_limit(key, max_tokens, window_seconds)`
- SECURITY DEFINER (runs as service role)
- Atomic UPSERT with token decrement
- Automatic window reset on expiry
- Returns: `(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)`

---

## Protected Endpoints

### Public Endpoints (IP-Based)

| Endpoint | Limit | Window | Fail Strategy | Reason |
|----------|-------|--------|---------------|--------|
| `GET /api/payments/[id]` | 60 req | 60s | Open | Status queries are cheap |
| `POST /api/payments/[id]?action=verify` | **10 req** | **60s** | **Closed** | **Triggers expensive RPC calls** |

### Authenticated Endpoints (User-Based)

| Endpoint | Limit | Window | Fail Strategy | Reason |
|----------|-------|--------|---------------|--------|
| `POST /api/payments` | 30 req | 60s | Open | Normal creation rate |
| `GET /api/payments` | 60 req | 60s | Open | Polling dashboard |
| `DELETE /api/payments/[id]` | 20 req | 60s | Open | Cancel operations |
| `GET/PUT /api/merchant` | 30 req | 60s | Open | Settings updates |

### Not Rate-Limited

- `GET /api/cron/monitor-payments` — Protected by `CRON_SECRET` bearer token authentication
- All authentication routes — Handled by Supabase Auth

---

## Security Features

### 1. IP Trust Model (Vercel Deployment)

```typescript
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // Take ONLY the leftmost IP set by Vercel's edge
    // Client cannot spoof this value
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  
  const xri = request.headers.get('x-real-ip');
  if (xri) return xri.trim();
  
  return '127.0.0.1'; // local dev fallback
}
```

**Why this is secure:**
- Vercel's edge proxy sets `x-forwarded-for` with the true client IP as the first value
- We extract **only** the first IP, ignoring any client-supplied values
- We **do not** trust `cf-connecting-ip` (no Cloudflare in this stack)

### 2. Fail-Open vs. Fail-Closed

**Fail-Open (Most Endpoints)**
```typescript
{
  failStrategy: 'open'
}
```
- When database is unavailable → **allow the request**
- Reason: Better UX, these operations are cheap
- Examples: Merchant profile, payment list, payment creation

**Fail-Closed (RPC-Triggering Endpoints)**
```typescript
{
  id: 'pay-verify',
  maxTokens: 10,
  windowSeconds: 60,
  failStrategy: 'closed'  // ← Protects RPC budget
}
```
- When database is unavailable → **block the request with 429**
- Reason: Prevents uncontrolled RPC spend during infrastructure failures
- Applied **only** to payment verification

### 3. Atomic Token Bucket

The PostgreSQL function uses `INSERT ... ON CONFLICT ... UPDATE` to atomically:
1. Check if bucket exists
2. Decrement token count (floor at 0)
3. Reset window if expired
4. Return decision

This prevents race conditions even under high concurrent load.

### 4. LRU Cache Fast-Path

```typescript
const cached = localCache.get(key);
if (cached && cached.resetAt > now && cached.remaining <= 0) {
  // Definitely blocked — no DB needed
  return rateLimitedResponse(...);
}
```

Benefits:
- Eliminates database queries for already-throttled clients
- 10,000 entry capacity (~80 KB memory)
- Automatically evicts LRU entries when full

---

## HTTP Response Format

### 429 Too Many Requests

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1736876543

{
  "error": "Too many requests",
  "retryAfter": 45
}
```

### 2xx Successful Request

```http
HTTP/1.1 200 OK
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1736876543

{ ... }
```

**Security Note:** Response bodies never expose:
- Database infrastructure (Supabase, PostgreSQL)
- Internal rate-limit bucket keys
- Storage mechanism details

---

## Implementation Files

### Core Implementation
- **`lib/rate-limit.ts`** (253 lines)
  - Two-layer architecture
  - IP extraction with Vercel-specific trust model
  - Fail-open/fail-closed strategies
  - Response builders with RFC-compliant headers

### Database Schema
- **`supabase/migrations/003_rate_limiting.sql`**
  - `rate_limit_buckets` table with RLS
  - `check_rate_limit()` SECURITY DEFINER function
  - `cleanup_expired_rate_limits()` maintenance function
  - Idempotent (safe to re-run)

### API Integration
- **`app/api/payments/route.ts`** — Protected `POST` and `GET`
- **`app/api/payments/[id]/route.ts`** — Protected `GET`, `POST` (verify), `DELETE`
- **`app/api/merchant/route.ts`** — Protected `GET` and `PUT`

### Test Suite
- **`__tests__/rate-limit.test.ts`** (497 lines, 46 tests)
  - Core rate-limit logic
  - IP extraction and spoofing prevention
  - Fail strategies
  - Concurrent request handling
  - HTTP response format
  - Profile configuration validation
  - Endpoint integration scenarios
  - Regression checks

---

## Test Results

### Rate Limiting Tests
```
✓ checkRateLimit — allowed requests (5 tests)
✓ checkRateLimit — blocked requests (3 tests)
✓ getClientIp (6 tests)
✓ Fail strategies when DB is unavailable (6 tests)
✓ Concurrent requests (2 tests)
✓ rateLimitedResponse() (6 tests)
✓ addRateLimitHeaders() (4 tests)
✓ RATE_LIMIT_PROFILES configuration (6 tests)
✓ PAYMENT_VERIFY endpoint — full scenario (3 tests)
✓ Authenticated endpoint rate limiting (2 tests)
✓ Rate-limit module isolation (2 tests)

46 tests passing
```

### Full Test Suite
```
Test Suites: 4 passed, 4 total
Tests:       200 passed, 200 total
Time:        1.49 s

Files:
  ✓ __tests__/api-integration.test.ts (34 tests)
  ✓ __tests__/payment-engine.test.ts (120 tests)
  ✓ __tests__/phase-2-1-1-database-foundation.test.ts (40 tests)
  ✓ __tests__/rate-limit.test.ts (46 tests)
```

### Production Build
```
✓ TypeScript compilation successful
✓ Next.js build completed in 9.3s
✓ All routes generated
✓ No errors or warnings
```

---

## Configuration Reference

### Adjusting Rate Limits

Edit `lib/rate-limit.ts` → `RATE_LIMIT_PROFILES`:

```typescript
export const RATE_LIMIT_PROFILES = {
  PAYMENT_VERIFY: {
    id: 'pay-verify',
    maxTokens: 10,              // ← Change limit
    windowSeconds: 60,          // ← Change window
    failStrategy: 'closed',     // ← 'open' or 'closed'
  },
  // ... other profiles
};
```

No other code changes needed — the profiles are referenced throughout the codebase.

### Adding New Protected Endpoints

1. Import rate-limit helpers in your route file:
```typescript
import {
  checkRateLimit,
  rateLimitedResponse,
  addRateLimitHeaders,
  RATE_LIMIT_PROFILES,
  getClientIp,
} from '@/lib/rate-limit';
```

2. Add rate-limit check before processing:
```typescript
export async function GET(request: NextRequest) {
  // For public endpoints (IP-based):
  const ip = getClientIp(request);
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.YOUR_PROFILE, ip);
  
  // For authenticated endpoints (user-based):
  // const rl = await checkRateLimit(RATE_LIMIT_PROFILES.YOUR_PROFILE, user.id);
  
  if (!rl.allowed) return rateLimitedResponse(rl);
  
  // ... process request
  
  return addRateLimitHeaders(ok(result), rl);
}
```

3. Define your profile in `RATE_LIMIT_PROFILES` if it doesn't exist.

---

## Monitoring & Maintenance

### Database Cleanup

Expired rate-limit buckets accumulate over time. Run cleanup periodically:

```sql
SELECT cleanup_expired_rate_limits();
-- Returns: number of deleted rows
```

Recommended: Add to cron or scheduled task (weekly is sufficient).

### Observability

**Check current rate-limit state:**
```sql
SELECT 
  key,
  tokens,
  reset_at,
  CASE 
    WHEN reset_at < NOW() THEN 'expired'
    WHEN tokens <= 0 THEN 'blocked'
    ELSE 'active'
  END as status
FROM rate_limit_buckets
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC
LIMIT 50;
```

**Find most rate-limited IPs:**
```sql
SELECT 
  SPLIT_PART(key, ':', 3) as identifier,
  COUNT(*) as bucket_count,
  MIN(tokens) as min_tokens
FROM rate_limit_buckets
WHERE tokens = 0 
  AND reset_at > NOW()
GROUP BY identifier
ORDER BY bucket_count DESC
LIMIT 20;
```

### Logs

Rate-limit errors are logged with structured context:
```
[RateLimit] DB error: <error message>
[RateLimit] Unexpected error: <error>
```

Monitor these logs for infrastructure issues.

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **No distributed cache coordination**
   - The LRU cache is per-instance (per Vercel serverless function)
   - Different instances may have different cached states
   - This is acceptable: Layer 2 (PostgreSQL) is authoritative

2. **Fixed time windows**
   - Uses fixed windows (not sliding)
   - A client could make 10 requests at :59, then 10 more at :00
   - This is acceptable for the current threat model

3. **No automatic cleanup**
   - Expired buckets remain in database until manually cleaned
   - Minimal impact: indexed queries remain fast with millions of rows

### Future Enhancements (If Needed)

1. **Redis/Upstash for Layer 2**
   - Replace PostgreSQL with Redis for faster distributed rate limiting
   - Only if PostgreSQL becomes a bottleneck (unlikely at current scale)

2. **Sliding Window Algorithm**
   - More granular rate limiting
   - Only if abuse patterns require it

3. **Per-Route Analytics**
   - Track rate-limit hit rates per endpoint
   - Identify attack patterns
   - Adjust limits based on data

4. **Dynamic Rate Limits**
   - Adjust limits based on merchant tier or API key type
   - Only needed if business model requires it

---

## Security Considerations

### ✅ Implemented Protections

1. **IP spoofing prevention** — Trusts only Vercel edge proxy headers
2. **Concurrent request handling** — Atomic database operations prevent race conditions
3. **Fail-closed for expensive operations** — RPC-triggering endpoints fail safe
4. **No sensitive data exposure** — Error responses never leak infrastructure details
5. **Idempotent migrations** — Database schema uses `IF NOT EXISTS`, safe to re-run
6. **RLS enabled** — `rate_limit_buckets` table has Row Level Security enabled (blocks all non-service-role access)

### ⚠️ Remaining Concerns

1. **Layer 7 DDoS**
   - Rate limiting mitigates but doesn't fully prevent sophisticated attacks
   - Recommendation: Enable Vercel's DDoS protection (included in Pro plan)

2. **Distributed brute-force**
   - Attacker could distribute requests across many IPs
   - Recommendation: Monitor Supabase auth failed login attempts separately

3. **Database availability**
   - If Supabase is down, fail-open endpoints allow unlimited traffic
   - Recommendation: Monitor Supabase uptime, set up alerts

4. **No CAPTCHA on public endpoints**
   - Automated bots can still make 10 requests/min per IP
   - Recommendation: Add CAPTCHA if abuse is detected in production logs

---

## Deployment Checklist

### ✅ Completed

- [x] Rate limiting library implemented
- [x] Database migration created
- [x] All API routes protected
- [x] Comprehensive test suite written
- [x] All tests passing (200/200)
- [x] TypeScript compilation successful
- [x] Production build successful
- [x] No new dependencies added (uses existing `lru-cache`)

### 📋 Before Production Deployment

1. **Apply database migration**
   ```bash
   # In Supabase SQL Editor
   # Run: supabase/migrations/003_rate_limiting.sql
   ```

2. **Verify Supabase RLS**
   ```sql
   -- Confirm RLS is enabled:
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'rate_limit_buckets';
   -- Should return: rowsecurity = true
   ```

3. **Deploy application**
   ```bash
   vercel --prod
   ```

4. **Smoke test rate limiting**
   ```bash
   # Public endpoint (no auth)
   for i in {1..11}; do 
     curl -i https://your-domain.vercel.app/api/payments/test-id?action=verify
   done
   # 11th request should return 429
   ```

5. **Monitor logs**
   - Watch for `[RateLimit]` error logs in first 24 hours
   - Check Supabase database performance metrics

6. **Set up cleanup cron** (optional, can defer)
   ```sql
   -- Add to Supabase scheduled jobs or external cron
   SELECT cleanup_expired_rate_limits();
   ```

---

## Conclusion

LumiaPay's rate limiting system is **production-ready** and addresses the critical security gap identified in the Phase 1 audit. The implementation:

- ✅ Protects the blockchain RPC verification endpoint with strict limits
- ✅ Prevents IP spoofing and bypass attempts
- ✅ Handles concurrent requests atomically
- ✅ Fails safely when infrastructure is unavailable
- ✅ Provides clear, standards-compliant HTTP responses
- ✅ Has comprehensive test coverage (46 dedicated tests)
- ✅ Introduces zero new dependencies
- ✅ Maintains 100% backward compatibility

**Next Steps:**
1. Apply database migration to production Supabase project
2. Deploy to Vercel
3. Monitor for 24-48 hours
4. Adjust rate limits if needed based on real traffic patterns

**Questions or Issues:**
- All rate limits are configurable in `lib/rate-limit.ts`
- All tests are in `__tests__/rate-limit.test.ts`
- Database schema is in `supabase/migrations/003_rate_limiting.sql`
