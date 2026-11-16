# Phase 2.1 Developer Infrastructure — Architecture Report

**Report Date:** 2024-01-14  
**Project:** LumiaPay  
**Phase:** 2.1 (Developer API Infrastructure)  
**Status:** Ready for Implementation  

---

## Executive Summary

This report provides a comprehensive architecture analysis of the LumiaPay codebase to guide Phase 2.1 implementation: **Developer API Infrastructure**. The codebase has been inspected and all necessary infrastructure components are in place, with migration 002 ready but **not yet applied** to the production database.

### Key Findings

✅ **Database types fully defined** - `lib/db/types.ts` contains all Phase 2.1 types  
✅ **Migration 002 ready** - Complete SQL for applications/api_keys tables  
✅ **Migration 003 applied** - Rate limiting infrastructure operational  
✅ **API key utilities complete** - Cryptographic generation in `lib/developer/api-keys.ts`  
✅ **Rate limiting integrated** - Middleware and profiles ready for developer endpoints  
✅ **Payment engine mature** - Solid foundation for API-driven payments  
⚠️ **Migration 002 NOT APPLIED** - Database lacks applications/api_keys tables  

### Recommendation

**Proceed with Phase 2.1 implementation** using the patterns and infrastructure documented in this report. Apply migration 002 as the first implementation step.

---

## Table of Contents

1. [Database Infrastructure](#1-database-infrastructure)
2. [Existing Payment System](#2-existing-payment-system)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Rate Limiting](#4-rate-limiting)
5. [API Route Structure](#5-api-route-structure)
6. [Type System](#6-type-system)
7. [Implementation Strategy](#7-implementation-strategy)
8. [Gaps Analysis](#8-gaps-analysis)

---

## 1. Database Infrastructure

### 1.1 Supabase Client Setup

The project uses **three distinct Supabase clients** for different contexts:

#### **Client-Side (`lib/supabase/client.ts`)**
```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```
- **Usage:** Browser-side components, client-side operations
- **Auth:** Uses cookie-based session authentication
- **RLS:** Enforced (anon key)

#### **Server-Side (`lib/supabase/server.ts`)**
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) { /* ... */ }
      }
    }
  );
}
```
- **Usage:** Server Components, API routes with user context
- **Auth:** Reads session from Next.js cookies
- **RLS:** Enforced (anon key, respects auth.uid())

#### **Admin Client (`lib/supabase/admin.ts`)**
```typescript
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```
- **Usage:** Privileged operations, bypassing RLS
- **Auth:** Service role key (full privileges)
- **RLS:** **BYPASSED** — use with extreme caution

### 1.2 Query Execution Patterns

**Pattern 1: User-Scoped Queries (Session Auth)**
```typescript
// app/api/payments/route.ts (GET)
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return unauthorized();

const admin = createAdminClient();
const { data: merchant } = await admin
  .from('merchants')
  .select('wallet_address')
  .eq('user_id', user.id)
  .single();
```
- Use **server client** to get user from session
- Use **admin client** for actual queries (bypasses RLS for performance)
- **Manually filter** by `user_id` in application code

**Pattern 2: Public Queries (IP-Based Rate Limiting)**
```typescript
// app/api/payments/[id]/route.ts (GET)
const ip = getClientIp(req);
const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_STATUS, ip);
if (!rl.allowed) return rateLimitedResponse(rl);

const payment = await getPaymentById(id); // Uses admin client internally
```
- No authentication required
- Rate limited by IP address
- Admin client used internally by payment engine

### 1.3 Database Helper Functions

The payment engine (`lib/payment-engine/`) provides comprehensive database helpers:

```typescript
// lib/payment-engine/payment-service.ts
export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatePaymentIntentResult>
export async function verifyPayment(input: VerificationInput): Promise<VerificationResult>
export async function getPaymentById(paymentId: string): Promise<PaymentIntent | null>
export async function getPaymentsByUser(userId: string): Promise<PaymentIntent[]>
export async function cancelPendingPayment(paymentId: string, userId: string): Promise<PaymentIntent>
```

**Key Pattern:** All functions use `createAdminClient()` internally and manually enforce authorization in application code.

### 1.4 Migration 002 Status

**⚠️ CRITICAL FINDING: Migration 002 NOT YET APPLIED**

**Evidence:**
- `supabase/migrations/002_developer_infrastructure.sql` exists and is complete
- `002_MIGRATION_GUIDE.md` states: "DO NOT APPLY WITHOUT APPROVAL"
- `MIGRATION_AUDIT_SUMMARY.md` only covers migration 003 (rate limiting)
- No documentation confirms migration 002 deployment

**What Migration 002 Creates:**
```sql
-- New tables
CREATE TABLE applications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  description TEXT,
  environment TEXT CHECK (environment IN ('test', 'live')),
  status TEXT DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES applications(id),
  name TEXT,
  key_type TEXT CHECK (key_type IN ('publishable', 'secret')),
  key_hash TEXT UNIQUE,
  key_prefix TEXT,
  permissions JSONB DEFAULT '{"payments":["read","write"]}'::jsonb,
  status TEXT DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  usage_count BIGINT DEFAULT 0,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extended columns on existing tables
ALTER TABLE payments ADD COLUMN application_id UUID NULL;
ALTER TABLE payments ADD COLUMN environment TEXT NULL;
ALTER TABLE payment_events ADD COLUMN application_id UUID NULL;

-- Database functions
CREATE FUNCTION validate_api_key(key_hash TEXT) 
  RETURNS TABLE (...);
CREATE FUNCTION get_application_payment_stats(app_id UUID) 
  RETURNS TABLE (...);
```

**Action Required:** Apply migration 002 before implementing Phase 2.1 endpoints.

---

## 2. Existing Payment System

### 2.1 Payment Engine Architecture

The payment engine (`lib/payment-engine/`) is a mature, production-ready system with 7 modules:

```
lib/payment-engine/
├── index.ts                    # Public API exports
├── payment-service.ts          # Orchestration layer (1,200+ lines)
├── payment-validator.ts        # Input validation & business rules
├── transaction-verifier.ts     # Blockchain verification
├── payment-lifecycle.ts        # Status transitions
├── payment-events.ts           # Audit logging
└── payment-types.ts            # TypeScript types & errors
```

**Test Coverage:** 54/54 tests passing (100% of Phase 1 requirements)

### 2.2 Payment Creation Pattern

**Current Implementation (Dashboard/Session):**
```typescript
// app/api/payments/route.ts POST
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

const admin = createAdminClient();
const { data: merchant } = await admin
  .from('merchants')
  .select('wallet_address')
  .eq('user_id', user.id)
  .single();

const result = await createPaymentIntent({
  user_id: user.id,
  label: parsed.data.label,
  amount: parsed.data.amount,
  currency: parsed.data.currency,
  wallet_address: merchant.wallet_address,
  ttl_seconds: 60 * 60,
});
```

**Phase 2.1 Pattern (API Key Auth):**
```typescript
// Future: app/api/v1/payments/route.ts POST
const authContext = await authenticateApiKey(request);
// authContext = { applicationId, userId, keyType, environment, permissions }

const admin = createAdminClient();
const { data: merchant } = await admin
  .from('merchants')
  .select('wallet_address')
  .eq('user_id', authContext.userId)
  .single();

const result = await createPaymentIntent({
  user_id: authContext.userId,
  label: parsed.data.label,
  amount: parsed.data.amount,
  currency: parsed.data.currency,
  wallet_address: merchant.wallet_address,
  ttl_seconds: 60 * 60,
  application_id: authContext.applicationId,  // NEW
  environment: authContext.environment,       // NEW
});
```

**Key Changes:**
1. Replace session auth with API key auth
2. Pass `application_id` and `environment` to payment engine
3. Enforce environment isolation (test keys cannot create live payments)

### 2.3 Payment Status Management

**Current Status Flow:**
```
created → pending → detecting → verifying → paid/underpaid/overpaid
          ↓         ↓
       expired   cancelled
```

**Status Transitions (`lib/payment-engine/payment-types.ts`):**
```typescript
export const VALID_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  created: ['pending', 'failed'],
  pending: ['detecting', 'expired', 'failed'],
  detecting: ['verifying', 'expired', 'failed'],
  verifying: ['paid', 'underpaid', 'overpaid', 'review_required', 'expired', 'failed'],
  paid: [], // Terminal state
  // ...
};
```

**No changes required** for Phase 2.1 — status management is application-agnostic.

### 2.4 Payment Retrieval Patterns

**Current: List User Payments**
```typescript
// app/api/payments/route.ts GET
const payments = await getPaymentsByUser(user.id);
```

**Phase 2.1: List Application Payments**
```typescript
// Future: app/api/v1/payments/route.ts GET
const authContext = await authenticateApiKey(request);

const admin = createAdminClient();
const { data: payments } = await admin
  .from('payments')
  .select('*')
  .eq('user_id', authContext.userId)
  .eq('application_id', authContext.applicationId)
  .eq('environment', authContext.environment)  // CRITICAL: environment isolation
  .order('created_at', { ascending: false });
```

**Key Patterns:**
- Always filter by `application_id` to prevent cross-app data leaks
- Always filter by `environment` to enforce test/live isolation
- Use `user_id` as an additional safety check

---

## 3. Authentication & Authorization

### 3.1 Current Auth Patterns

**Session Authentication (Dashboard):**
```typescript
// components/require-user.tsx
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user;
}
```
- Used in: Dashboard pages, authenticated API routes
- Mechanism: Cookie-based Supabase Auth session
- Protection: Next.js middleware redirects to /login

**No Middleware File:** The project does **not** have a `middleware.ts` file. Auth is handled at the route/component level.

### 3.2 Phase 2.1 Auth Requirements

**API Key Authentication Middleware:**
```typescript
// lib/developer/auth-middleware.ts (TO BE CREATED)
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
    throw new Error('Missing or invalid Authorization header');
  }
  
  const apiKey = authHeader.slice(7); // Remove "Bearer "
  
  // 2. Validate key format (prevents unnecessary DB round-trip)
  if (!isValidKeyFormat(apiKey)) {
    throw new Error('Invalid API key format');
  }
  
  // 3. Extract environment from prefix
  const parsed = parseKeyPrefix(apiKey);
  if (!parsed) {
    throw new Error('Invalid API key prefix');
  }
  
  // 4. Hash the key
  const keyHash = hashApiKey(apiKey);
  
  // 5. Validate via DB function
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('validate_api_key', { 
    key_hash_param: keyHash 
  });
  
  if (error || !data || data.length === 0) {
    throw new Error('Invalid or revoked API key');
  }
  
  const result = data[0];
  
  // 6. Verify environment matches prefix
  if (result.environment !== parsed.environment) {
    throw new Error('Key environment mismatch');
  }
  
  // 7. Update usage tracking (async, non-blocking)
  admin.from('api_keys')
    .update({ 
      last_used_at: new Date().toISOString(),
      usage_count: result.usage_count + 1 
    })
    .eq('id', result.key_id)
    .then(); // Fire and forget
  
  // 8. Return auth context
  return {
    applicationId: result.application_id,
    userId: result.user_id,
    keyType: result.key_type,
    environment: result.environment,
    permissions: result.permissions,
    keyId: result.key_id,
  };
}
```

**Usage Pattern:**
```typescript
// app/api/v1/payments/route.ts
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateApiKey(request);
    
    // Now you have authenticated context:
    // - authContext.userId
    // - authContext.applicationId
    // - authContext.environment
    // - authContext.permissions
    
    // Enforce permissions
    if (!authContext.permissions.payments?.includes('write')) {
      return err('Insufficient permissions', 403);
    }
    
    // Proceed with request handling...
  } catch (error) {
    return err(String(error), 401);
  }
}
```

### 3.3 Permission Enforcement

**Permission Structure (`lib/db/types.ts`):**
```typescript
export interface ApiKeyPermissions {
  payments?: ApiKeyScope[];   // ['read', 'write']
  webhooks?: ApiKeyScope[];   // ['read', 'write']
  [resource: string]: ApiKeyScope[] | undefined;
}

export type ApiKeyScope = 'read' | 'write';
```

**Check Pattern:**
```typescript
function requirePermission(
  context: ApiKeyAuthContext, 
  resource: string, 
  scope: 'read' | 'write'
): void {
  const perms = context.permissions[resource];
  if (!perms?.includes(scope)) {
    throw new Error(`Missing ${resource}:${scope} permission`);
  }
}

// Usage
requirePermission(authContext, 'payments', 'write');
```

---

## 4. Rate Limiting

### 4.1 Implementation (`lib/rate-limit.ts`)

**Status:** ✅ **FULLY IMPLEMENTED AND TESTED**

Migration 003 has been applied and rate limiting is operational. The system uses a **two-layer architecture**:

**Layer 1: In-Process LRU Cache**
```typescript
const localCache = new LRU({ max: 10_000 });
// Fast-path check: avoids DB hit for already-blocked requests
```

**Layer 2: PostgreSQL Token Buckets**
```typescript
const { data } = await admin.rpc('check_rate_limit', {
  p_key: 'rl:pay-verify:192.168.1.1',
  p_max_tokens: 10,
  p_window_seconds: 60,
});
// Atomic decrement via UPSERT with row-level locking
```

### 4.2 Rate Limit Profiles

**Existing Profiles (`lib/rate-limit.ts`):**
```typescript
export const RATE_LIMIT_PROFILES = {
  // Public endpoints (keyed by IP)
  PAYMENT_STATUS: {
    id: 'pay-status',
    maxTokens: 60,
    windowSeconds: 60,
    failStrategy: 'open',
  },
  PAYMENT_VERIFY: {
    id: 'pay-verify',
    maxTokens: 10,
    windowSeconds: 60,
    failStrategy: 'closed', // Protects RPC budget
  },
  
  // Authenticated endpoints (keyed by user ID)
  PAYMENT_CREATE: {
    id: 'pay-create',
    maxTokens: 30,
    windowSeconds: 60,
    failStrategy: 'open',
  },
  PAYMENT_LIST: {
    id: 'pay-list',
    maxTokens: 60,
    windowSeconds: 60,
    failStrategy: 'open',
  },
  // ...
} as const;
```

### 4.3 Phase 2.1 Rate Limiting Strategy

**New Profiles Needed:**
```typescript
// Add to RATE_LIMIT_PROFILES in lib/rate-limit.ts

// API-authenticated endpoints (keyed by application_id)
API_PAYMENT_CREATE: {
  id: 'api-pay-create',
  maxTokens: 100,      // Higher limit for API users
  windowSeconds: 60,
  failStrategy: 'open',
},
API_PAYMENT_LIST: {
  id: 'api-pay-list',
  maxTokens: 300,      // Much higher for pagination
  windowSeconds: 60,
  failStrategy: 'open',
},

// Management endpoints (keyed by user_id)
APP_CREATE: {
  id: 'app-create',
  maxTokens: 5,        // Rare operation
  windowSeconds: 3600,
  failStrategy: 'open',
},
API_KEY_CREATE: {
  id: 'key-create',
  maxTokens: 10,
  windowSeconds: 3600,
  failStrategy: 'open',
},
```

**Usage Pattern:**
```typescript
// app/api/v1/payments/route.ts POST
const authContext = await authenticateApiKey(request);

// Rate limit by application_id (NOT user_id or IP)
const rl = await checkRateLimit(
  RATE_LIMIT_PROFILES.API_PAYMENT_CREATE, 
  authContext.applicationId
);
if (!rl.allowed) return rateLimitedResponse(rl);
```

**Key Insight:** Rate limit by `application_id` for developer API endpoints, not by `user_id` or IP. This allows different applications by the same merchant to have independent quotas.

### 4.4 Integration Example

**Complete Route Handler with Rate Limiting:**
```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate
  let authContext: ApiKeyAuthContext;
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
  if (!authContext.permissions.payments?.includes('write')) {
    return addRateLimitHeaders(err('Insufficient permissions', 403), rl);
  }
  
  // 4. Handle request
  // ... business logic ...
  
  // 5. Add rate limit headers to response
  return addRateLimitHeaders(ok(result, 201), rl);
}
```

---

## 5. API Route Structure

### 5.1 Current Route Mapping

**Existing API Routes:**
```
app/api/
├── cron/
│   └── monitor-payments/
│       └── route.ts              # Background job (GET)
├── merchant/
│   └── route.ts                  # GET, PUT (session auth)
└── payments/
    ├── route.ts                  # POST (create), GET (list) (session auth)
    └── [id]/
        └── route.ts              # GET (public), POST (verify, public), DELETE (session auth)
```

**Route Count:** 4 route files, 8 HTTP endpoints

### 5.2 Response Format Patterns

**Success Response (`lib/http.ts`):**
```typescript
export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

// Usage
return ok({ payment, keys: { publishable: '...', secret: '...' } }, 201);
```

**Error Response:**
```typescript
export function err(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

// Usage
return err('Payment not found', 404);
```

**Specialized Helpers:**
```typescript
export function unauthorized(): Response {
  return err('Unauthorized', 401);
}

export function notFound(resource = 'Resource'): Response {
  return err(`${resource} not found`, 404);
}
```

### 5.3 Error Handling Pattern

**Consistent Pattern Across Routes:**
```typescript
export async function POST(request: NextRequest) {
  try {
    // ... validation, business logic ...
    return ok(result, 201);
  } catch (error) {
    console.error('[POST /api/payments]', error);
    if (error instanceof ValidationError)   return err(error.message, error.statusCode);
    if (error instanceof PaymentEngineError) return err(error.message, error.statusCode);
    return err('Failed to create payment', 500);
  }
}
```

**Error Classes (`lib/payment-engine/payment-types.ts`):**
```typescript
export class PaymentEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) { super(message); }
}

export class ValidationError extends PaymentEngineError { ... }
export class VerificationError extends PaymentEngineError { ... }
export class TransactionError extends PaymentEngineError { ... }
```

### 5.4 Phase 2.1 Route Structure

**Proposed Structure:**
```
app/api/
├── v1/                           # NEW: Versioned API
│   ├── payments/
│   │   ├── route.ts              # POST (create), GET (list) — API key auth
│   │   └── [id]/
│   │       └── route.ts          # GET, DELETE — API key auth
│   └── webhooks/
│       ├── route.ts              # POST (create), GET (list)
│       └── [id]/
│           └── route.ts          # GET, PUT, DELETE
│
├── applications/                 # NEW: Management endpoints
│   ├── route.ts                  # POST (create), GET (list) — session auth
│   └── [id]/
│       ├── route.ts              # GET, PATCH, DELETE
│       ├── keys/
│       │   ├── route.ts          # POST (create key), GET (list keys)
│       │   └── [keyId]/
│       │       └── route.ts      # PATCH (revoke), DELETE
│       └── stats/
│           └── route.ts          # GET (application analytics)
│
└── ... (existing routes)
```

**URL Examples:**
- Developer API: `https://api.lumiapay.com/v1/payments`
- Management: `https://api.lumiapay.com/applications`
- Dashboard: `https://lumiapay.com/api/payments` (existing, unchanged)

---

## 6. Type System

### 6.1 Existing Types (`lib/db/types.ts`)

**✅ Status: COMPLETE — All Phase 2.1 types are defined**

**File Size:** 445 lines  
**Last Modified:** Phase 2.1 preparation  

**Key Types:**
```typescript
// Applications
export interface ApplicationRow { ... }
export type ApplicationInsert = { ... }
export type ApplicationUpdate = Partial<Pick<...>>
export interface ApplicationWithStats extends ApplicationRow { ... }
export interface ApplicationCreationResult { ... }

// API Keys
export interface ApiKeyRow { ... }
export type ApiKeyInsert = { ... }
export type ApiKeyUpdate = Partial<Pick<...>>
export interface ApiKeyPermissions { ... }
export type ApiKeyScope = 'read' | 'write';

// Auth Context
export interface ApiKeyAuthContext {
  applicationId: UUID;
  userId: UUID;
  keyType: ApiKeyType;
  environment: AppEnvironment;
  permissions: ApiKeyPermissions;
  keyId: UUID;
}

// DB Function Results
export interface ApiKeyValidationResult { ... }
export interface ApplicationPaymentStats { ... }

// Extended Payment Types
export interface PaymentRow {
  // ... existing fields ...
  application_id: UUID | null;  // NEW
  environment: AppEnvironment | null;  // NEW
}
```

**No additional types needed** for Phase 2.1 implementation.

### 6.2 API Key Utilities (`lib/developer/api-keys.ts`)

**✅ Status: COMPLETE — All utilities implemented**

**Exports:**
```typescript
// Constants
export const KEY_PREFIXES: Record<ApiKeyType, Record<AppEnvironment, string>>

// Types
export interface GeneratedKey {
  plaintext: string;  // Show once, never store
  hash: string;       // SHA-256 for DB
  prefix: string;     // Display prefix (non-secret)
}

// Functions
export function generateApiKey(keyType, env): GeneratedKey
export function hashApiKey(plaintext: string): string
export function isValidKeyFormat(key: string): boolean
export function parseKeyPrefix(key: string): { keyType, environment } | null
export function buildDisplayPrefix(plaintext: string): string
```

**Key Format:**
```
pk_test_aB3dEfGhIjKlMnOpQrStUvWx01234567
sk_live_zYxWvUsTrQpOnMlKjIhGfEdCbA98765432
│ │  │   └─ 32-char base64url suffix (cryptographic random)
│ │  └───── Environment (test/live)
│ └──────── Type (pk=publishable, sk=secret)
└─────────── Prefix
```

**Security Features:**
1. **256-bit entropy** — 32 bytes of CSPRNG output
2. **SHA-256 hashing** — Only hash stored in DB
3. **Constant-time validation** — Prevents timing attacks
4. **Format validation** — Rejects invalid keys before DB lookup
5. **Environment in prefix** — Prevents environment mismatch

---

## 7. Implementation Strategy

### 7.1 Implementation Order

**Phase 2.1 should be implemented in this order:**

#### **Step 1: Apply Migration 002** ⚠️ **PREREQUISITE**
```bash
# Supabase Dashboard → SQL Editor
# Copy/paste: supabase/migrations/002_developer_infrastructure.sql
# Run and verify
```
**Time:** 5 minutes  
**Risk:** Low (additive migration, no data changes)  
**Verification:** See [migration guide](supabase/migrations/002_MIGRATION_GUIDE.md)

#### **Step 2: Create Auth Middleware** (New File)
```typescript
// lib/developer/auth-middleware.ts
export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyAuthContext>
export function requirePermission(context: ApiKeyAuthContext, resource: string, scope: ApiKeyScope): void
```
**Time:** 2-3 hours  
**Tests:** Add `__tests__/auth-middleware.test.ts` (20+ tests)

#### **Step 3: Application Management Endpoints**
```typescript
// app/applications/route.ts
POST   /applications          # Create application
GET    /applications          # List user's applications

// app/applications/[id]/route.ts
GET    /applications/:id      # Get application details
PATCH  /applications/:id      # Update application
DELETE /applications/:id      # Soft-delete application

// app/applications/[id]/keys/route.ts
POST   /applications/:id/keys # Create API key
GET    /applications/:id/keys # List application keys

// app/applications/[id]/keys/[keyId]/route.ts
PATCH  /applications/:id/keys/:keyId  # Revoke key
DELETE /applications/:id/keys/:keyId  # Hard-delete key (admin only)
```
**Time:** 1 week  
**Tests:** Add integration tests for each endpoint

#### **Step 4: Developer API Endpoints**
```typescript
// app/api/v1/payments/route.ts
POST   /api/v1/payments       # Create payment (API key auth)
GET    /api/v1/payments       # List payments (API key auth)

// app/api/v1/payments/[id]/route.ts
GET    /api/v1/payments/:id   # Get payment (API key auth)
DELETE /api/v1/payments/:id   # Cancel payment (API key auth)
```
**Time:** 3-4 days  
**Tests:** Update existing payment tests for API key auth variant

#### **Step 5: Dashboard UI**
- Application management page (`app/applications/page.tsx`)
- API key management UI
- Environment toggle (test/live)
- Key generation modal (show plaintext once)
- Usage statistics

**Time:** 1 week

### 7.2 Code Reuse Patterns

**✅ Reuse Existing Payment Engine**
```typescript
// app/api/v1/payments/route.ts
import { createPaymentIntent } from '@/lib/payment-engine';

// No changes needed to payment engine itself
const result = await createPaymentIntent({
  user_id: authContext.userId,
  label: body.label,
  amount: body.amount,
  currency: body.currency,
  wallet_address: merchant.wallet_address,
  ttl_seconds: 3600,
  application_id: authContext.applicationId,  // NEW: pass through
  environment: authContext.environment,       // NEW: pass through
});
```

**Payment Engine Change Required:**
```typescript
// lib/payment-engine/payment-service.ts (line ~40)
// In createPaymentIntent function, update INSERT statement:

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
    application_id: input.application_id ?? null,  // ADD THIS LINE
    environment: input.environment ?? null,        // ADD THIS LINE
  })
  .select()
  .single();
```

**✅ Reuse Rate Limiting Infrastructure**
```typescript
// No changes to lib/rate-limit.ts
// Just add new profiles to RATE_LIMIT_PROFILES constant
```

**✅ Reuse Response Format**
```typescript
import { ok, err, unauthorized } from '@/lib/http';
// Use existing helpers for consistent API responses
```

### 7.3 Database Query Patterns

**Pattern 1: Create Application**
```typescript
const admin = createAdminClient();
const { data, error } = await admin
  .from('applications')
  .insert({
    user_id: session.user.id,
    name: body.name,
    environment: body.environment,
    description: body.description,
  })
  .select()
  .single();
```

**Pattern 2: Create API Keys (with key generation)**
```typescript
import { generateApiKey } from '@/lib/developer/api-keys';

// Generate keys
const publishableKey = generateApiKey('publishable', environment);
const secretKey = generateApiKey('secret', environment);

// Insert into DB (store only hashes)
const { data: keys } = await admin
  .from('api_keys')
  .insert([
    {
      application_id: applicationId,
      name: 'Publishable Key',
      key_type: 'publishable',
      key_hash: publishableKey.hash,
      key_prefix: publishableKey.prefix,
      permissions: { payments: ['read'] },
    },
    {
      application_id: applicationId,
      name: 'Secret Key',
      key_type: 'secret',
      key_hash: secretKey.hash,
      key_prefix: secretKey.prefix,
      permissions: { payments: ['read', 'write'], webhooks: ['read', 'write'] },
    },
  ])
  .select();

// Return plaintext keys ONCE
return ok({
  application,
  keys: {
    publishable: publishableKey.plaintext,  // Never stored, never retrievable
    secret: secretKey.plaintext,
  },
});
```

**Pattern 3: Validate API Key (via DB function)**
```typescript
const keyHash = hashApiKey(apiKey);

const { data } = await admin.rpc('validate_api_key', { 
  key_hash_param: keyHash 
});

if (!data || data.length === 0) {
  throw new Error('Invalid API key');
}

const result = data[0]; // ApiKeyValidationResult
// result = { key_id, application_id, user_id, key_type, environment, permissions }
```

**Pattern 4: List Application Payments (with environment isolation)**
```typescript
const { data: payments } = await admin
  .from('payments')
  .select('*')
  .eq('application_id', authContext.applicationId)
  .eq('environment', authContext.environment)  // CRITICAL
  .order('created_at', { ascending: false })
  .limit(100);
```

### 7.4 Environment Isolation Enforcement

**Three-Layer Defense:**

**Layer 1: Key Prefix Validation (Pre-DB)**
```typescript
const parsed = parseKeyPrefix(apiKey);
// Returns: { keyType: 'secret', environment: 'test' }

// Before DB lookup, we already know expected environment
```

**Layer 2: DB Function Validation**
```typescript
// validate_api_key() returns environment from applications table
// Compare with prefix-derived environment:
if (result.environment !== parsed.environment) {
  throw new Error('Environment mismatch');
}
```

**Layer 3: Query-Level Filtering**
```typescript
// Always filter by environment in queries
.eq('environment', authContext.environment)
```

**Why Three Layers?**
- **Defense in depth** — Multiple failure points prevent mistakes
- **Performance** — Prefix check avoids DB round-trip for invalid keys
- **Correctness** — Query filtering prevents data leaks even if auth bypassed

---

## 8. Gaps Analysis

### 8.1 What Exists ✅

| Component | Status | Location |
|-----------|--------|----------|
| Database types | ✅ Complete | `lib/db/types.ts` |
| Migration SQL | ✅ Ready | `supabase/migrations/002_developer_infrastructure.sql` |
| API key utilities | ✅ Complete | `lib/developer/api-keys.ts` |
| Rate limiting | ✅ Operational | `lib/rate-limit.ts` |
| Payment engine | ✅ Production-ready | `lib/payment-engine/` |
| Response helpers | ✅ Defined | `lib/http.ts` |

### 8.2 What's Missing ⚠️

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Migration 002 applied | ❌ **NOT APPLIED** | Apply to database before development |
| Auth middleware | ❌ Not created | Create `lib/developer/auth-middleware.ts` |
| Application endpoints | ❌ Not created | Create `app/applications/*` routes |
| Developer API routes | ❌ Not created | Create `app/api/v1/*` routes |
| Dashboard UI | ❌ Not created | Create application management pages |
| API key UI | ❌ Not created | Create key generation/revocation UI |
| Documentation | ⚠️ Partial | Create API reference docs |
| SDK/Client libraries | ❌ Not created | Future: JavaScript SDK |

### 8.3 Testing Gaps

**Existing Test Coverage:**
- ✅ Payment engine: 54/54 tests passing
- ✅ Rate limiting: 46 tests passing
- ❌ API key authentication: 0 tests
- ❌ Application management: 0 tests
- ❌ Developer API: 0 tests

**Required New Tests:**
```typescript
// __tests__/auth-middleware.test.ts (NEW)
- API key validation
- Permission checking
- Environment isolation
- Key format validation
- Hash verification

// __tests__/applications.test.ts (NEW)
- Create application
- List applications
- Update application
- Delete application
- Generate API keys
- Revoke API keys

// __tests__/developer-api.test.ts (NEW)
- Create payment with API key
- List payments with API key
- Environment filtering
- Permission enforcement
- Rate limiting per application
```

**Estimated Test Count:** +100 tests

### 8.4 Documentation Gaps

**Existing Documentation:**
- ✅ Phase 1 completion report
- ✅ Deployment guide
- ✅ Rate limiting documentation
- ✅ Migration 002 guide
- ❌ API reference documentation
- ❌ Developer onboarding guide
- ❌ SDK documentation

**Required Documentation:**
```markdown
API_REFERENCE.md
├── Authentication
│   ├── API Key Types
│   ├── Environment Isolation
│   └── Permission Scopes
├── Endpoints
│   ├── POST /api/v1/payments
│   ├── GET /api/v1/payments
│   ├── GET /api/v1/payments/:id
│   └── DELETE /api/v1/payments/:id
├── Rate Limits
├── Error Codes
└── Examples (cURL, JavaScript, Python)

DEVELOPER_GUIDE.md
├── Getting Started
│   ├── Create Application
│   ├── Generate API Keys
│   └── Test Mode vs Live Mode
├── Making Requests
│   ├── Authentication
│   ├── Error Handling
│   └── Best Practices
└── Webhooks (Phase 2.2)
```

---

## 9. Security Considerations

### 9.1 Key Storage Security

**✅ Implemented Correctly:**
- SHA-256 hash stored in `api_keys.key_hash`
- Plaintext never stored in database
- Plaintext returned once on creation, then lost forever
- Display prefix is non-secret (`key_prefix`)

**Attack Vector Analysis:**
- ❌ **Rainbow tables** — Infeasible (256-bit entropy, unique per key)
- ❌ **Database compromise** — Hashes useless without plaintext
- ✅ **Key leaked by user** — Revoke via dashboard (sets `status='revoked'`)

### 9.2 Environment Isolation

**Critical Security Requirement:**
> **Test keys MUST NEVER create live payments**

**Enforcement Mechanisms:**
1. **Key prefix** encodes environment (`pk_test_*` vs `pk_live_*`)
2. **Application table** stores environment (immutable)
3. **Validation function** returns environment from DB
4. **Middleware** compares prefix environment with DB environment
5. **Query filters** always include `.eq('environment', authContext.environment)`

**Failure Mode Analysis:**
| Scenario | Outcome |
|----------|---------|
| Test key sent to production | ❌ Rejected (prefix mismatch) |
| Live key used in test mode | ❌ Rejected (prefix mismatch) |
| Attacker modifies key prefix | ❌ Rejected (hash won't match DB) |
| DB environment column modified | ✅ Detected (prefix != DB mismatch) |

### 9.3 Permission Enforcement

**Defense-in-Depth Strategy:**
1. **DB function** returns permissions JSON
2. **Middleware** parses permissions
3. **Route handler** checks required permission
4. **Response** returns 403 if insufficient

**Example Vulnerable Code (DO NOT USE):**
```typescript
// ❌ BAD: Trusts client-provided permission claim
const permissions = request.headers.get('x-permissions');
```

**Correct Implementation:**
```typescript
// ✅ GOOD: Permissions from DB via authenticated API key
const authContext = await authenticateApiKey(request);
const canWrite = authContext.permissions.payments?.includes('write');
```

### 9.4 Rate Limiting by Application

**Why Application-Level Rate Limiting?**
- Prevents one app from exhausting merchant's quota
- Enables tiered pricing (Pro plan = higher limits)
- Isolates abuse to single application

**Implementation:**
```typescript
// ✅ CORRECT: Rate limit by application_id
const rl = await checkRateLimit(
  RATE_LIMIT_PROFILES.API_PAYMENT_CREATE,
  authContext.applicationId  // NOT userId, NOT IP
);
```

**Attack Vector:** Attacker creates multiple applications to bypass rate limits
**Mitigation:** Rate limit application creation itself (`APP_CREATE` profile)

---

## 10. Recommended Implementation Plan

### 10.1 Sprint 1: Foundation (1 week)

**Goal:** Migration applied, auth middleware working

**Tasks:**
1. ✅ Review and approve migration 002
2. ✅ Apply migration 002 to database
3. ✅ Verify migration with test queries
4. ✅ Create `lib/developer/auth-middleware.ts`
5. ✅ Add tests for auth middleware (20+ tests)
6. ✅ Update rate limiting profiles for API endpoints

**Deliverables:**
- Migration 002 applied and verified
- Auth middleware module complete with tests
- All existing tests still passing

### 10.2 Sprint 2: Management Endpoints (1 week)

**Goal:** Dashboard can create applications and API keys

**Tasks:**
1. ✅ Create `app/applications/route.ts` (POST, GET)
2. ✅ Create `app/applications/[id]/route.ts` (GET, PATCH, DELETE)
3. ✅ Create `app/applications/[id]/keys/route.ts` (POST, GET)
4. ✅ Create `app/applications/[id]/keys/[keyId]/route.ts` (PATCH)
5. ✅ Add integration tests for all endpoints
6. ✅ Manual API testing with Postman/Insomnia

**Deliverables:**
- 6 new API routes operational
- Integration tests passing
- Postman collection for manual testing

### 10.3 Sprint 3: Developer API (1 week)

**Goal:** External developers can create/list payments via API

**Tasks:**
1. ✅ Create `app/api/v1/payments/route.ts` (POST, GET)
2. ✅ Create `app/api/v1/payments/[id]/route.ts` (GET, DELETE)
3. ✅ Update payment engine to accept `application_id`/`environment`
4. ✅ Add environment isolation enforcement
5. ✅ Add integration tests for developer API
6. ✅ Write API reference documentation (Markdown)

**Deliverables:**
- Developer API operational
- Environment isolation verified
- API documentation complete

### 10.4 Sprint 4: Dashboard UI (1 week)

**Goal:** Merchants can manage applications via web UI

**Tasks:**
1. ✅ Create application list page (`app/applications/page.tsx`)
2. ✅ Create application detail page (`app/applications/[id]/page.tsx`)
3. ✅ Create API key management UI
4. ✅ Implement key generation modal (show plaintext once)
5. ✅ Add usage statistics dashboard
6. ✅ Add environment toggle UI (test/live)

**Deliverables:**
- Full UI for application management
- Key generation flow with warnings
- Usage statistics visible

### 10.5 Sprint 5: Testing & Documentation (3 days)

**Goal:** Production-ready with comprehensive docs

**Tasks:**
1. ✅ End-to-end testing (create app → generate keys → make API call)
2. ✅ Security audit of auth middleware
3. ✅ Performance testing (rate limiting under load)
4. ✅ Write developer onboarding guide
5. ✅ Create code examples (JavaScript, Python, cURL)
6. ✅ Update README with Phase 2.1 completion

**Deliverables:**
- 100% test coverage for new code
- Complete API reference
- Developer guide with examples
- Security audit report

---

## 11. Success Criteria

### 11.1 Technical Criteria

✅ **Migration 002 Applied Successfully**
- `applications` and `api_keys` tables exist
- Indexes created
- RLS policies active
- DB functions operational

✅ **Authentication Working**
- API keys validate correctly
- Invalid keys rejected
- Revoked keys rejected
- Expired keys rejected
- Environment mismatch detected

✅ **Authorization Working**
- Permissions enforced at route level
- Read-only keys cannot write
- Publishable keys limited to safe operations

✅ **Environment Isolation**
- Test keys cannot create live payments
- Live keys cannot create test payments
- Query results filtered by environment

✅ **Rate Limiting**
- Per-application rate limiting operational
- Headers returned correctly
- 429 responses have Retry-After
- LRU cache reduces DB load

✅ **Test Coverage**
- Auth middleware: 20+ tests
- Application management: 30+ tests
- Developer API: 30+ tests
- Integration tests: 20+ tests
- **Total: 100+ new tests**

### 11.2 Functional Criteria

✅ **Merchant Can:**
- Create applications (test and live)
- Generate API keys
- View API keys (prefix only, not plaintext)
- Revoke API keys
- Delete applications
- View application usage statistics

✅ **Developer Can:**
- Authenticate with API key
- Create payments via API
- List payments via API
- Get payment details via API
- Cancel payments via API
- Receive appropriate error messages
- See rate limit headers in responses

✅ **System Ensures:**
- Plaintext keys never stored
- Plaintext keys shown once only
- Environment isolation enforced
- Rate limits prevent abuse
- All operations audited (payment_events)

### 11.3 Documentation Criteria

✅ **API Reference Complete:**
- Authentication section
- All endpoints documented
- Request/response examples
- Error codes explained
- Rate limits documented

✅ **Developer Guide Complete:**
- Getting started tutorial
- Code examples in 3+ languages
- Best practices section
- Troubleshooting guide

✅ **Internal Docs Complete:**
- Implementation guide
- Architecture diagrams
- Security considerations
- Testing strategy

---

## 12. Risk Assessment

### 12.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration 002 breaks existing data | Low | High | Migration is additive; rollback script available |
| Performance degradation from DB lookups | Medium | Medium | LRU cache reduces load; monitor query performance |
| API key leaked by user | High | Medium | Revocation mechanism; educate users on key security |
| Environment isolation bypass | Low | Critical | Triple enforcement (prefix, DB, query); extensive tests |
| Rate limiting fails (DB down) | Low | Medium | Fail-open strategy for most endpoints; fail-closed for RPC |

### 12.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Developers struggle with API | Medium | High | Comprehensive docs; code examples; support channel |
| Key management too complex | Low | Medium | Intuitive UI; show plaintext once with big warning |
| Test mode insufficient for devs | Medium | Low | Clearly document test mode limitations; provide sandbox |

### 12.3 Security Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timing attack on key validation | Low | Low | Constant-time comparison in `hashApiKey` |
| Plaintext key exposure in logs | Medium | High | Never log full keys; only prefixes in error messages |
| Cross-application data leak | Low | Critical | Query-level environment filtering; extensive tests |
| Privilege escalation | Low | Critical | Permission checks at route level; DB function validation |

**Overall Risk Level: LOW-MEDIUM**

All high-impact risks have strong mitigations in place.

---

## 13. Monitoring & Observability

### 13.1 Key Metrics to Track

**Application Metrics:**
```sql
-- Total applications per merchant
SELECT user_id, COUNT(*) FROM applications GROUP BY user_id;

-- Active vs inactive applications
SELECT status, COUNT(*) FROM applications GROUP BY status;

-- Environment distribution
SELECT environment, COUNT(*) FROM applications GROUP BY environment;
```

**API Key Metrics:**
```sql
-- Total keys per application
SELECT application_id, COUNT(*) FROM api_keys GROUP BY application_id;

-- Key status distribution
SELECT status, COUNT(*) FROM api_keys GROUP BY status;

-- Most used keys
SELECT name, usage_count, last_used_at 
FROM api_keys 
ORDER BY usage_count DESC 
LIMIT 10;
```

**Payment Metrics:**
```sql
-- API-created payments vs dashboard-created
SELECT 
  CASE WHEN application_id IS NULL THEN 'dashboard' ELSE 'api' END as source,
  COUNT(*) as count,
  SUM(CAST(amount AS NUMERIC)) as total_amount
FROM payments
GROUP BY (application_id IS NULL);

-- Environment distribution
SELECT environment, COUNT(*) FROM payments GROUP BY environment;
```

**Rate Limiting Metrics:**
```sql
-- Active rate limit buckets
SELECT COUNT(*) FROM rate_limit_buckets;

-- Bucket key distribution
SELECT LEFT(key, 20) as route, COUNT(*) 
FROM rate_limit_buckets 
GROUP BY LEFT(key, 20);
```

### 13.2 Alerts to Configure

**Critical Alerts:**
- Application creation fails (DB error)
- API key validation fails unexpectedly
- Environment mismatch detected
- Rate limiting DB errors exceed threshold

**Warning Alerts:**
- High API key creation rate (potential abuse)
- High revocation rate (user confusion?)
- Low API usage after key creation (integration issues?)

---

## Conclusion

The LumiaPay codebase is **well-architected and ready for Phase 2.1 implementation**. All necessary infrastructure components exist:

✅ **Strong Foundation:**
- Mature payment engine (54/54 tests passing)
- Operational rate limiting (migration 003 applied)
- Complete type system (`lib/db/types.ts`)
- Secure API key utilities (`lib/developer/api-keys.ts`)

⚠️ **Single Blocker:**
- Migration 002 must be applied before development begins

✅ **Clear Implementation Path:**
- 5-sprint plan with incremental delivery
- Reuse existing patterns (auth, rate limiting, responses)
- Comprehensive testing strategy (+100 tests)

✅ **Low Risk:**
- Additive migration (backward compatible)
- Defense-in-depth security (triple enforcement)
- Well-documented architecture

**Estimated Timeline:** 4 weeks (5 sprints)  
**Confidence Level:** HIGH

**Next Steps:**
1. Review and approve migration 002
2. Apply migration 002 to database
3. Begin Sprint 1 (auth middleware)

---

**Report Prepared By:** Kiro AI  
**Date:** 2024-01-14  
**Status:** Ready for Implementation Approval
