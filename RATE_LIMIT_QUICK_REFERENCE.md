# Rate Limiting Quick Reference

## Current Rate Limits

### Public Endpoints (IP-Based)

```
GET  /api/payments/[id]                    60 requests / 60 seconds
POST /api/payments/[id]?action=verify     10 requests / 60 seconds  ⚠️ CRITICAL
```

### Authenticated Endpoints (User-Based)

```
POST   /api/payments        30 requests / 60 seconds
GET    /api/payments        60 requests / 60 seconds
DELETE /api/payments/[id]   20 requests / 60 seconds
GET    /api/merchant        30 requests / 60 seconds
PUT    /api/merchant        30 requests / 60 seconds (shared with GET)
```

## HTTP Response Examples

### Within Limit (200 OK)
```http
HTTP/1.1 200 OK
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1736876543

{ "id": "...", "status": "pending" }
```

### Rate Limited (429)
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

## Client Implementation Examples

### JavaScript/TypeScript
```typescript
async function callAPI(url: string) {
  const response = await fetch(url);
  
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
    console.log(`Rate limited. Retry after ${retryAfter} seconds.`);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return callAPI(url); // Retry
  }
  
  // Check remaining quota
  const remaining = response.headers.get('X-RateLimit-Remaining');
  console.log(`Remaining requests: ${remaining}`);
  
  return response.json();
}
```

### Python
```python
import time
import requests

def call_api(url):
    response = requests.get(url)
    
    if response.status_code == 429:
        retry_after = int(response.headers.get('Retry-After', 60))
        print(f"Rate limited. Retrying after {retry_after}s")
        time.sleep(retry_after)
        return call_api(url)
    
    remaining = response.headers.get('X-RateLimit-Remaining')
    print(f"Remaining requests: {remaining}")
    
    return response.json()
```

### cURL
```bash
# Test rate limiting
for i in {1..11}; do
  echo "Request $i:"
  curl -i https://your-domain.vercel.app/api/payments/test-id?action=verify
  echo "---"
done
```

## Adjusting Rate Limits

### Edit Configuration
File: `lib/rate-limit.ts`

```typescript
export const RATE_LIMIT_PROFILES = {
  PAYMENT_VERIFY: {
    id: 'pay-verify',
    maxTokens: 10,              // ← Change this
    windowSeconds: 60,          // ← Or this
    failStrategy: 'closed',     // ← 'open' or 'closed'
  },
  // ...
};
```

### Deploy Changes
```bash
npm run typecheck  # Verify TypeScript
npm test           # Run tests
npm run build      # Build production
vercel --prod      # Deploy
```

## Monitoring

### Check Rate-Limit Status (SQL)
```sql
-- Most throttled identifiers
SELECT 
  SPLIT_PART(key, ':', 3) as identifier,
  SPLIT_PART(key, ':', 2) as route,
  tokens as remaining,
  reset_at,
  CASE 
    WHEN tokens <= 0 AND reset_at > NOW() THEN 'BLOCKED'
    WHEN tokens <= 0 THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END as status
FROM rate_limit_buckets
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY tokens ASC, updated_at DESC
LIMIT 20;
```

### Cleanup Expired Buckets
```sql
SELECT cleanup_expired_rate_limits();
-- Returns: number of deleted rows
```

### Application Logs
```bash
# Look for rate-limit errors
vercel logs --filter "[RateLimit]"
```

## Troubleshooting

### Problem: All requests return 429

**Possible causes:**
1. Database migration not applied → Run `003_rate_limiting.sql`
2. Supabase connection error → Check `SUPABASE_SERVICE_ROLE_KEY`
3. Fail-closed endpoint with DB down → Check Supabase status

**Quick fix:**
```typescript
// Temporarily change to fail-open while investigating
PAYMENT_VERIFY: {
  // ...
  failStrategy: 'open',  // ← Allows requests if DB is down
}
```

### Problem: Rate limiting not working

**Checks:**
1. Verify migration applied: `SELECT * FROM rate_limit_buckets LIMIT 1;`
2. Check function exists: `SELECT check_rate_limit('test', 10, 60);`
3. Verify RLS: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'rate_limit_buckets';`

### Problem: Different users hitting same limit

**Cause:** Using IP instead of user ID for authenticated endpoints

**Fix:**
```typescript
// Wrong (uses IP)
const ip = getClientIp(request);
const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, ip);

// Correct (uses user ID)
const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, user.id);
```

## Security Notes

⚠️ **Critical Endpoints Use Fail-Closed:**
- `POST /api/payments/[id]?action=verify` blocks all requests if DB is unavailable
- This prevents uncontrolled blockchain RPC spend during infrastructure failures

✅ **IP Trust Model:**
- Only trusts `x-forwarded-for` (first value) set by Vercel's edge
- Client cannot spoof their IP address

✅ **Atomic Operations:**
- Database function prevents race conditions
- Concurrent requests are handled correctly

## Support

**Full Documentation:** `RATE_LIMITING_REPORT.md`  
**Implementation:** `lib/rate-limit.ts`  
**Tests:** `__tests__/rate-limit.test.ts`  
**Database Schema:** `supabase/migrations/003_rate_limiting.sql`
