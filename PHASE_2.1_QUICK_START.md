# Phase 2.1 Quick Start Guide

> **TL;DR:** All infrastructure is ready. Apply migration 002, then start building.

---

## 🎯 What You're Building

**Phase 2.1:** Developer API Infrastructure  
**Goal:** Let external developers integrate LumiaPay payments into their apps via REST API

---

## ✅ What's Already Done

| Component | Status | Location |
|-----------|--------|----------|
| Database types | ✅ Complete | `lib/db/types.ts` (445 lines) |
| Migration SQL | ✅ Ready | `supabase/migrations/002_developer_infrastructure.sql` |
| API key crypto | ✅ Complete | `lib/developer/api-keys.ts` |
| Rate limiting | ✅ Operational | `lib/rate-limit.ts` + migration 003 applied |
| Payment engine | ✅ Production-ready | `lib/payment-engine/` (54/54 tests) |

---

## ⚠️ What's Missing

| Component | Status | Action |
|-----------|--------|--------|
| Migration 002 | ❌ NOT APPLIED | Apply to database first |
| Auth middleware | ❌ Needs creation | `lib/developer/auth-middleware.ts` |
| API routes | ❌ Needs creation | `app/api/v1/*` and `app/applications/*` |
| Dashboard UI | ❌ Needs creation | Application management pages |

---

## 🚀 Implementation Steps

### Step 1: Apply Migration 002 (5 minutes)

```bash
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy/paste: supabase/migrations/002_developer_infrastructure.sql
# 3. Click "Run"
# 4. Verify:
```

```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name IN ('applications', 'api_keys');
-- Expected: 2
```

**What This Creates:**
- `applications` table (for developer apps)
- `api_keys` table (for hashed keys)
- Extends `payments` and `payment_events` with `application_id`/`environment` columns
- Adds DB functions: `validate_api_key()`, `get_application_payment_stats()`

### Step 2: Create Auth Middleware (2-3 hours)

**File:** `lib/developer/auth-middleware.ts`

```typescript
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashApiKey, isValidKeyFormat, parseKeyPrefix } from './api-keys';
import { ApiKeyAuthContext } from '@/lib/db/types';

export async function authenticateApiKey(
  request: NextRequest
): Promise<ApiKeyAuthContext> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization header');
  }
  
  const apiKey = authHeader.slice(7);
  
  // 2. Validate format
  if (!isValidKeyFormat(apiKey)) {
    throw new Error('Invalid API key format');
  }
  
  // 3. Parse prefix
  const parsed = parseKeyPrefix(apiKey);
  if (!parsed) throw new Error('Invalid prefix');
  
  // 4. Hash and validate
  const keyHash = hashApiKey(apiKey);
  const admin = createAdminClient();
  
  const { data, error } = await admin.rpc('validate_api_key', { 
    key_hash_param: keyHash 
  });
  
  if (error || !data || data.length === 0) {
    throw new Error('Invalid or revoked API key');
  }
  
  const result = data[0];
  
  // 5. Verify environment match
  if (result.environment !== parsed.environment) {
    throw new Error('Key environment mismatch');
  }
  
  // 6. Update usage (async)
  admin.from('api_keys')
    .update({ 
      last_used_at: new Date().toISOString(),
      usage_count: result.usage_count + 1 
    })
    .eq('id', result.key_id)
    .then();
  
  return {
    applicationId: result.application_id,
    userId: result.user_id,
    keyType: result.key_type,
    environment: result.environment,
    permissions: result.permissions,
    keyId: result.key_id,
  };
}

export function requirePermission(
  context: ApiKeyAuthContext,
  resource: string,
  scope: 'read' | 'write'
): void {
  const perms = context.permissions[resource];
  if (!perms?.includes(scope)) {
    throw new Error(`Missing ${resource}:${scope} permission`);
  }
}
```

**Tests:** `__tests__/auth-middleware.test.ts` (20+ tests)

### Step 3: Create Application Management Routes (1 week)

**Route Structure:**
```
app/applications/
├── route.ts                    # POST (create), GET (list)
├── [id]/
│   ├── route.ts                # GET, PATCH, DELETE
│   ├── keys/
│   │   ├── route.ts            # POST (create key), GET (list)
│   │   └── [keyId]/
│   │       └── route.ts        # PATCH (revoke)
│   └── stats/
│       └── route.ts            # GET (analytics)
```

**Example:** `app/applications/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err, unauthorized } from '@/lib/http';
import { generateApiKey } from '@/lib/developer/api-keys';
import { checkRateLimit, rateLimitedResponse, addRateLimitHeaders, RATE_LIMIT_PROFILES } from '@/lib/rate-limit';
import { z } from 'zod';

const CreateAppSchema = z.object({
  name: z.string().min(3).max(100),
  environment: z.enum(['test', 'live']),
  description: z.string().max(500).optional(),
});

// POST /applications — Create new application
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  
  // Rate limit application creation
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.APP_CREATE, user.id);
  if (!rl.allowed) return rateLimitedResponse(rl);
  
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }
  
  const parsed = CreateAppSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);
  
  const admin = createAdminClient();
  
  // Create application
  const { data: app, error: appError } = await admin
    .from('applications')
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      environment: parsed.data.environment,
      description: parsed.data.description,
    })
    .select()
    .single();
  
  if (appError) return err(appError.message, 500);
  
  // Generate API keys
  const publishableKey = generateApiKey('publishable', app.environment);
  const secretKey = generateApiKey('secret', app.environment);
  
  const { data: keys, error: keysError } = await admin
    .from('api_keys')
    .insert([
      {
        application_id: app.id,
        name: 'Publishable Key',
        key_type: 'publishable',
        key_hash: publishableKey.hash,
        key_prefix: publishableKey.prefix,
        permissions: { payments: ['read'] },
      },
      {
        application_id: app.id,
        name: 'Secret Key',
        key_type: 'secret',
        key_hash: secretKey.hash,
        key_prefix: secretKey.prefix,
        permissions: { payments: ['read', 'write'], webhooks: ['read', 'write'] },
      },
    ])
    .select();
  
  if (keysError) return err(keysError.message, 500);
  
  return addRateLimitHeaders(
    ok({
      application: app,
      keys: {
        publishable: publishableKey.plaintext,
        secret: secretKey.plaintext,
      },
    }, 201),
    rl
  );
}

// GET /applications — List user's applications
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  
  const admin = createAdminClient();
  const { data: apps, error } = await admin
    .from('applications')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  
  if (error) return err(error.message, 500);
  return ok(apps);
}
```

### Step 4: Create Developer API Routes (3-4 days)

**Route Structure:**
```
app/api/v1/
└── payments/
    ├── route.ts                # POST (create), GET (list)
    └── [id]/
        └── route.ts            # GET, DELETE
```

**Example:** `app/api/v1/payments/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { authenticateApiKey, requirePermission } from '@/lib/developer/auth-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err } from '@/lib/http';
import { createPaymentIntent } from '@/lib/payment-engine';
import { checkRateLimit, rateLimitedResponse, addRateLimitHeaders, RATE_LIMIT_PROFILES } from '@/lib/rate-limit';
import { z } from 'zod';

const CreatePaymentSchema = z.object({
  label: z.string().min(1).max(200),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  currency: z.enum(['USDC', 'EURC']),
});

// POST /api/v1/payments — Create payment via API
export async function POST(request: NextRequest) {
  // 1. Authenticate
  let authContext;
  try {
    authContext = await authenticateApiKey(request);
  } catch (error) {
    return err(String(error), 401);
  }
  
  // 2. Rate limit by application
  const rl = await checkRateLimit(
    RATE_LIMIT_PROFILES.API_PAYMENT_CREATE,
    authContext.applicationId
  );
  if (!rl.allowed) return rateLimitedResponse(rl);
  
  // 3. Check permissions
  try {
    requirePermission(authContext, 'payments', 'write');
  } catch (error) {
    return addRateLimitHeaders(err(String(error), 403), rl);
  }
  
  // 4. Parse request
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }
  
  const parsed = CreatePaymentSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);
  
  // 5. Get merchant wallet
  const admin = createAdminClient();
  const { data: merchant } = await admin
    .from('merchants')
    .select('wallet_address')
    .eq('user_id', authContext.userId)
    .single();
  
  if (!merchant) return err('Merchant profile not found', 400);
  
  // 6. Create payment (with application context)
  const result = await createPaymentIntent({
    user_id: authContext.userId,
    label: parsed.data.label,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    wallet_address: merchant.wallet_address,
    ttl_seconds: 3600,
    application_id: authContext.applicationId,
    environment: authContext.environment,
  });
  
  return addRateLimitHeaders(ok(result.payment, 201), rl);
}

// GET /api/v1/payments — List application's payments
export async function GET(request: NextRequest) {
  // Authenticate
  let authContext;
  try {
    authContext = await authenticateApiKey(request);
  } catch (error) {
    return err(String(error), 401);
  }
  
  // Rate limit
  const rl = await checkRateLimit(
    RATE_LIMIT_PROFILES.API_PAYMENT_LIST,
    authContext.applicationId
  );
  if (!rl.allowed) return rateLimitedResponse(rl);
  
  // Check permissions
  try {
    requirePermission(authContext, 'payments', 'read');
  } catch (error) {
    return addRateLimitHeaders(err(String(error), 403), rl);
  }
  
  // Query payments (CRITICAL: filter by environment)
  const admin = createAdminClient();
  const { data: payments, error } = await admin
    .from('payments')
    .select('*')
    .eq('application_id', authContext.applicationId)
    .eq('environment', authContext.environment)  // Environment isolation
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) return err(error.message, 500);
  return addRateLimitHeaders(ok(payments), rl);
}
```

### Step 5: Update Payment Engine (15 minutes)

**File:** `lib/payment-engine/payment-service.ts`

```typescript
// Around line 40 in createPaymentIntent function, update INSERT:

const { data, error } = await admin
  .from('payments')
  .insert({
    user_id: validated.user_id,
    label: validated.label,
    amount: validated.amount,
    currency: validated.currency,
    wallet_address: validated.wallet_address,
    status: 'pending',
    expires_at: expiresAt,
    metadata: input.metadata ?? {},
    application_id: input.application_id ?? null,  // ADD THIS
    environment: input.environment ?? null,        // ADD THIS
  })
  .select()
  .single();
```

**Update Type:** `lib/payment-engine/payment-types.ts`

```typescript
export interface CreatePaymentIntentInput {
  user_id: string;
  label: string;
  amount: string;
  currency: TokenSymbol;
  wallet_address: string;
  ttl_seconds?: number;
  metadata?: Record<string, any>;
  application_id?: string;      // ADD THIS
  environment?: 'test' | 'live'; // ADD THIS
}
```

### Step 6: Add Rate Limit Profiles (5 minutes)

**File:** `lib/rate-limit.ts`

```typescript
// Add to RATE_LIMIT_PROFILES constant:

export const RATE_LIMIT_PROFILES = {
  // ... existing profiles ...
  
  // NEW: API endpoints (keyed by application_id)
  API_PAYMENT_CREATE: {
    id: 'api-pay-create',
    maxTokens: 100,
    windowSeconds: 60,
    failStrategy: 'open',
  },
  API_PAYMENT_LIST: {
    id: 'api-pay-list',
    maxTokens: 300,
    windowSeconds: 60,
    failStrategy: 'open',
  },
  
  // NEW: Management endpoints (keyed by user_id)
  APP_CREATE: {
    id: 'app-create',
    maxTokens: 5,
    windowSeconds: 3600,
    failStrategy: 'open',
  },
  API_KEY_CREATE: {
    id: 'key-create',
    maxTokens: 10,
    windowSeconds: 3600,
    failStrategy: 'open',
  },
} as const;
```

---

## 🧪 Testing Strategy

### Test Files to Create

```
__tests__/
├── auth-middleware.test.ts      # 20+ tests
├── applications.test.ts         # 30+ tests
├── developer-api.test.ts        # 30+ tests
└── api-integration-v2.test.ts   # 20+ tests
```

### Key Test Scenarios

**Auth Middleware:**
- ✅ Valid key authenticates
- ✅ Invalid key rejected
- ✅ Revoked key rejected
- ✅ Expired key rejected
- ✅ Environment mismatch detected
- ✅ Permission checking works

**Application Management:**
- ✅ Create application
- ✅ Generate keys (plaintext returned once)
- ✅ List applications
- ✅ Revoke key
- ✅ Delete application

**Developer API:**
- ✅ Create payment with API key
- ✅ List payments (environment filtered)
- ✅ Cannot see other application's payments
- ✅ Test key cannot create live payment
- ✅ Read-only key cannot create payment

---

## 📊 Success Metrics

### Technical Metrics
- [ ] Migration 002 applied successfully
- [ ] 100+ new tests passing
- [ ] All existing tests still passing (54/54)
- [ ] No TypeScript errors
- [ ] Production build succeeds

### Functional Metrics
- [ ] Can create application via UI
- [ ] Can generate API keys
- [ ] Can authenticate with API key
- [ ] Can create payment via API
- [ ] Test/live environments isolated
- [ ] Rate limiting works per application

---

## 🔒 Security Checklist

- [ ] Plaintext keys never stored in DB
- [ ] Plaintext keys shown once only
- [ ] Environment isolation enforced (3 layers)
- [ ] Permissions checked at route level
- [ ] Rate limiting by application_id
- [ ] All DB queries filter by environment
- [ ] No keys in logs (only prefixes)

---

## 📚 Documentation to Create

- [ ] API Reference (`API_REFERENCE.md`)
- [ ] Developer Guide (`DEVELOPER_GUIDE.md`)
- [ ] Code examples (JavaScript, Python, cURL)
- [ ] Update README with Phase 2.1 status

---

## ⏱️ Estimated Timeline

| Sprint | Duration | Deliverable |
|--------|----------|-------------|
| Sprint 1 | 1 week | Migration applied, auth middleware working |
| Sprint 2 | 1 week | Application management endpoints |
| Sprint 3 | 1 week | Developer API operational |
| Sprint 4 | 1 week | Dashboard UI complete |
| Sprint 5 | 3 days | Testing & documentation |

**Total: 4 weeks**

---

## 🚨 Common Pitfalls to Avoid

### ❌ DON'T:
- Store plaintext API keys in database
- Skip environment filtering in queries
- Rate limit by user_id for API endpoints
- Trust client-provided environment
- Log full API keys
- Allow test keys to create live payments

### ✅ DO:
- Hash keys with SHA-256 before storage
- Always filter by `environment` in queries
- Rate limit by `application_id` for API
- Validate environment against DB
- Log only key prefixes
- Enforce environment isolation in 3 layers

---

## 📞 Need Help?

**Architecture Report:** See `PHASE_2.1_ARCHITECTURE_REPORT.md` for complete details

**Migration Guide:** See `supabase/migrations/002_MIGRATION_GUIDE.md`

**Existing Patterns:**
- Auth: `components/require-user.tsx`
- Rate limiting: `lib/rate-limit.ts`
- API responses: `lib/http.ts`
- Payment engine: `lib/payment-engine/`

---

**Ready to build? Start with Step 1: Apply Migration 002** ✅
