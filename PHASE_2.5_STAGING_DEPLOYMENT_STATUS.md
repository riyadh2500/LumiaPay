# LumiaPay — Phase 2.5 Staging Deployment Status

**Date:** 2025-01-15  
**Environment:** Staging  
**Project ID:** xmdeksqnzhvijaeblwhw

---

## 🎯 Current Status: READY FOR MANUAL MIGRATION

### ✅ Completed Tasks

1. **Staging Environment Created**
   - ✅ New Supabase project: `xmdeksqnzhvijaeblwhw`
   - ✅ `.env.staging` configured with all credentials
   - ✅ CRON_SECRET generated for staging
   - ✅ Arc testnet RPC and contracts configured

2. **Migration Files Inspected**
   - ✅ Migration 001: Payment Engine Tables (safe, idempotent)
   - ✅ Migration 002: Developer Infrastructure (safe, idempotent, 25KB)
   - ✅ Migration 003: Rate Limiting (safe, idempotent)
   - ✅ Migration 004: Webhook System (safe, idempotent, 17KB)
   - ✅ Rollback script verified (002_rollback.sql)

3. **Deployment Documentation Created**
   - ✅ `STAGING_DEPLOYMENT_GUIDE.md` — Complete step-by-step manual migration guide
   - ✅ `PHASE_2.5_STAGING_VERIFICATION_PLAN.md` — Comprehensive pre-deployment analysis
   - ✅ `scripts/verify-staging.ts` — Automated post-deployment verification script

4. **Risk Assessment Complete**
   - ✅ Migration Risk: **LOW**
   - ✅ Data Loss Risk: **NONE**
   - ✅ Breaking Change Risk: **NONE**
   - ✅ Security Risk: **VERY LOW**

---

## 📋 Next Steps (Manual Execution Required)

### Step 1: Apply Migrations via Supabase Dashboard

**Why Manual?** Supabase CLI is not installed locally, so migrations must be applied through the Supabase SQL Editor.

**Instructions:**

1. Open: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw
2. Navigate to: **SQL Editor**
3. Follow the step-by-step guide in: `STAGING_DEPLOYMENT_GUIDE.md`

**Migration Order:**
```
001_payment_engine_tables.sql      (Baseline - Payment tables)
002_developer_infrastructure.sql   (Applications, API Keys)
003_rate_limiting.sql              (Rate limiting system)
004_webhook_system.sql             (Webhook delivery system)
```

**Estimated Time:** 15 minutes

---

### Step 2: Verify Migrations with Automated Script

After applying all 4 migrations, run the verification script:

```bash
# Load staging environment variables
$env:NEXT_PUBLIC_SUPABASE_URL="https://xmdeksqnzhvijaeblwhw.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGVrc3Fuemh2aWphZWJsd2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3OTAyMzIsImV4cCI6MjExMDM2NjIzMn0.QTDXU_OeYivBasImF9kjgrmiPDFMqteuVHp8k8BNp-U"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGVrc3Fuemh2aWphZWJsd2h3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDc5MDIzMiwiZXhwIjoyMTEwMzY2MjMyfQ.HZdILaQi_qOIQ2_HF7xZeiNaq7nhyaPO3NaBqToTrxY"
$env:ARC_RPC_URL="https://rpc.testnet.arc.network"
$env:ARC_USDC_CONTRACT="0x3600000000000000000000000000000000000000"
$env:ARC_EURC_CONTRACT="0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"
$env:CRON_SECRET="STAGING_TEST_SECRET_2025_01_15_DO_NOT_USE_IN_PRODUCTION"

# Run verification script
npx tsx scripts/verify-staging.ts
```

**Expected Output:**
```
✅ Passed: 20/20 tests
Pass Rate: 100%
🎉 ALL TESTS PASSED! Staging environment is ready.
```

---

### Step 3: Create Test User in Staging

1. Go to: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw/auth/users
2. Click **"Add user"**
3. Fill in:
   - **Email:** `staging-test@lumiapay.local`
   - **Password:** `StagingTest2025!`
   - **Auto Confirm User:** ✅ Enable
4. Click **"Create user"**

This user will be used to test the developer dashboard.

---

### Step 4: Run Application in Staging Mode

**Option A: Replace .env.local temporarily**

```bash
# Backup current config
cp .env.local .env.production.backup

# Use staging config
cp .env.staging .env.local

# Start dev server
npm run dev
```

**Option B: Load staging env manually (Recommended)**

```bash
# Load staging variables (PowerShell)
Get-Content .env.staging | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') {
    $env:($matches[1]) = $matches[2]
  }
}

# Start dev server
npm run dev
```

**Server should start at:** http://localhost:3000

---

### Step 5: Manual E2E Testing

Once the dev server is running with staging environment:

#### Test 1: Login with Staging User

1. Navigate to: http://localhost:3000
2. Login with:
   - Email: `staging-test@lumiapay.local`
   - Password: `StagingTest2025!`
3. ✅ Should successfully login and redirect to `/dashboard`

#### Test 2: Access Developer Dashboard

1. Navigate to: http://localhost:3000/developer
2. ✅ Developer sidebar should be visible
3. ✅ Should see 8 navigation items:
   - Overview
   - Applications
   - API Keys
   - Webhooks
   - Logs
   - Analytics
   - Documentation
   - Sandbox

#### Test 3: Create Application

1. Go to: http://localhost:3000/developer/applications
2. Click **"Create Application"**
3. Fill in:
   - **Name:** `Staging Test App`
   - **Environment:** `Test`
   - **Description:** `Testing developer infrastructure`
4. Click **"Create"**
5. ✅ Application should appear in list

#### Test 4: Generate API Keys

1. Go to: http://localhost:3000/developer/keys
2. Select application: `Staging Test App`
3. Click **"Create API Key"**
4. Fill in:
   - **Name:** `Test Publishable Key`
   - **Type:** `Publishable`
5. Click **"Create"**
6. ✅ Key should be shown once (starts with `pk_test_`)
7. **COPY THE KEY** (it won't be shown again)
8. Repeat for **Secret Key** (starts with `sk_test_`)

#### Test 5: Test API Authentication

```bash
# Test with publishable key
curl -X GET http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer pk_test_YOUR_KEY_HERE"

# Expected: 200 OK with empty payments array []
```

```bash
# Test with secret key
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer sk_test_YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "10.50",
    "currency": "USDC",
    "network": "arc_testnet",
    "metadata": {"test": "staging"}
  }'

# Expected: 201 Created with payment object
```

```bash
# Test with invalid key
curl -X GET http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer sk_test_invalid"

# Expected: 401 Unauthorized
```

#### Test 6: Verify Rate Limiting

```bash
# Hit API 101 times rapidly (default limit: 100/min)
for ($i=1; $i -le 101; $i++) {
  $response = Invoke-WebRequest `
    -Uri "http://localhost:3000/api/v1/payments" `
    -Headers @{"Authorization"="Bearer sk_test_YOUR_KEY"} `
    -Method GET `
    -SkipHttpErrorCheck
  
  Write-Host "$i : $($response.StatusCode)"
}

# Expected:
# 1-100: 200 OK
# 101: 429 Too Many Requests
```

#### Test 7: Register Webhook Endpoint

1. Get a test webhook URL from https://webhook.site
2. Go to: http://localhost:3000/developer/webhooks
3. Click **"Add Endpoint"**
4. Fill in:
   - **URL:** `https://webhook.site/YOUR-UUID`
   - **Events:** Select `payment.paid`, `payment.failed`
   - **Description:** `Staging test webhook`
5. Click **"Create"**
6. ✅ Endpoint should appear in list with status "Active"
7. **COPY THE SECRET** (starts with `whsec_`)

#### Test 8: Trigger Webhook Delivery

```bash
# Create a payment that will trigger webhook
curl -X POST http://localhost:3000/api/v1/payments \
  -H "Authorization: Bearer sk_test_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5.00",
    "currency": "USDC",
    "network": "arc_testnet"
  }'

# Manually mark payment as paid in Supabase dashboard
# (or wait for cron worker to check blockchain)
```

**Check webhook.site:**
- ✅ Should receive POST request
- ✅ Should have `X-Lumia-Signature` header
- ✅ Payload should contain payment data

**Verify signature:**
```javascript
// Run in browser console or Node.js
const crypto = require('crypto');

const payload = '{"event":"payment.paid",...}';  // From webhook.site
const signature = 'v1,t=1234567890,s1=abc123...';  // From X-Lumia-Signature header
const secret = 'whsec_YOUR_SECRET';  // From webhook endpoint

const parts = signature.split(',');
const timestamp = parts[1].split('=')[1];
const sig = parts[2].split('=')[1];

const expected = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

console.log('Match:', expected === sig);
// Expected: true
```

#### Test 9: Check Developer Analytics

1. Go to: http://localhost:3000/developer/analytics
2. Select application: `Staging Test App`
3. ✅ Should show stats:
   - Total payments created
   - Success rate
   - Total amount
   - Chart of payments over time

#### Test 10: Check API Logs

1. Go to: http://localhost:3000/developer/logs
2. ✅ Should show all API requests made
3. ✅ Should show status codes, timestamps, endpoints

#### Test 11: Merchant Dashboard Regression

1. Navigate to: http://localhost:3000/dashboard
2. ✅ Should see original merchant sidebar (NOT developer sidebar)
3. ✅ No developer-related navigation items
4. Navigate to: http://localhost:3000/payments
5. ✅ Should see payments list (including API-created ones)
6. Navigate to: http://localhost:3000/settings
7. ✅ Should see merchant settings
8. ✅ No console errors in browser dev tools

---

## 📊 Success Criteria

For staging verification to be considered complete, ALL of these must pass:

### Database Layer
- ✅ All 10 tables exist (verified via `verify-staging.ts`)
- ✅ All 9 functions work correctly
- ✅ All RLS policies enforced
- ✅ All indexes created

### API Layer
- ✅ API key authentication works (valid accepted, invalid rejected)
- ✅ Rate limiting enforces limits (429 after threshold)
- ✅ Payment CRUD via API works
- ✅ `application_id` and `environment` correctly set on API-created payments

### Webhook Layer
- ✅ Webhook endpoint registration works
- ✅ Webhook events created on payment status changes
- ✅ Webhook delivery works (HTTP POST sent)
- ✅ Webhook signatures valid (HMAC-SHA256)
- ✅ Webhook retries work (for failed deliveries)

### UI Layer
- ✅ Developer dashboard accessible at `/developer/*`
- ✅ All 8 developer pages load without errors
- ✅ Application CRUD works
- ✅ API key generation shows keys once
- ✅ Webhook management works
- ✅ Analytics display real data
- ✅ Logs show API requests

### Regression Testing
- ✅ Merchant dashboard unchanged (original sidebar visible)
- ✅ Session-based auth still works
- ✅ Merchant-created payments have NULL `application_id`
- ✅ No console errors in merchant flows
- ✅ All 221 existing tests still pass

---

## 🚨 Known Issues / Blockers

### 1. Supabase CLI Not Installed

**Impact:** Cannot use `supabase db push` for automated migration deployment  
**Workaround:** Manual migration via SQL Editor (documented in `STAGING_DEPLOYMENT_GUIDE.md`)  
**Resolution:** Install Supabase CLI if automated migrations preferred

```bash
# Install Supabase CLI (optional)
npm install -g supabase

# Then link to staging project
supabase link --project-ref xmdeksqnzhvijaeblwhw

# Apply migrations
supabase db push
```

### 2. Cron Worker Needs Setup

**Impact:** Webhooks won't be automatically delivered, rate limits won't be cleaned up  
**Status:** Cron endpoint exists at `/api/cron/webhook-worker`, requires Vercel Cron or manual setup  
**Resolution:** After staging tests pass, configure Vercel Cron in production

---

## 📝 Migration Verification Checklist

Before considering migrations complete, verify:

- [ ] Run `npx tsx scripts/verify-staging.ts` — All tests pass
- [ ] Create test application via UI — Success
- [ ] Generate publishable and secret keys — Success
- [ ] Test API authentication with valid key — 200 OK
- [ ] Test API authentication with invalid key — 401 Unauthorized
- [ ] Create payment via API — 201 Created, `application_id` set
- [ ] Test rate limiting (101 requests) — First 100 OK, 101st is 429
- [ ] Register webhook endpoint — Success, secret generated
- [ ] Trigger webhook delivery — POST received, signature valid
- [ ] Check developer analytics — Shows real data
- [ ] Check API logs — Shows requests
- [ ] Test merchant dashboard — Unchanged, no errors
- [ ] Create payment via merchant UI — `application_id` is NULL

---

## 🎯 After Staging Verification Complete

Once ALL tests pass in staging:

1. **Document Results**
   - Create `PHASE_2.5_STAGING_TEST_RESULTS.md` with evidence:
     - Screenshots of working UI
     - SQL queries showing correct data
     - API response examples
     - Webhook delivery proof
     - Analytics dashboard screenshots

2. **Production Readiness Review**
   - Review staging test results
   - Confirm no breaking changes
   - Verify merchant regression tests passed
   - Check security audit (already scored 9.2/10)

3. **Request Production Approval**
   - Present staging results to stakeholders
   - Get explicit approval to proceed with production
   - Schedule maintenance window if needed

4. **Production Deployment**
   - Apply migrations to production database
   - Deploy updated application code
   - Configure Vercel Cron for webhooks
   - Monitor production logs
   - Run smoke tests
   - Announce to users

---

## 📂 Files Created

### Configuration
- `.env.staging` — Staging environment variables

### Documentation
- `PHASE_2.5_STAGING_VERIFICATION_PLAN.md` — Pre-deployment analysis (risk assessment, migration inspection)
- `STAGING_DEPLOYMENT_GUIDE.md` — Step-by-step manual migration guide
- `PHASE_2.5_STAGING_DEPLOYMENT_STATUS.md` — This file (current status, next steps)

### Scripts
- `scripts/verify-staging.ts` — Automated post-deployment verification (20+ tests)

### Migration Files (Existing)
- `supabase/migrations/001_payment_engine_tables.sql` — Baseline
- `supabase/migrations/002_developer_infrastructure.sql` — Applications & API keys
- `supabase/migrations/003_rate_limiting.sql` — Rate limiting
- `supabase/migrations/004_webhook_system.sql` — Webhooks
- `supabase/migrations/002_rollback.sql` — Rollback script

---

## 🔄 Current Workflow State

```
✅ Phase 2.1: Developer API           — Complete (Nov 2024)
✅ Phase 2.2: Webhook System          — Complete (Nov 2024)
✅ Phase 2.4: Developer Dashboard UI  — Complete (Dec 2024)
✅ Phase 2.5: Staging Setup           — Complete (Jan 2025)
⏳ Phase 2.5: Manual Migration        — NEXT STEP (You execute)
⏳ Phase 2.5: Automated Verification  — After migrations
⏳ Phase 2.5: Manual E2E Testing      — After verification
⏳ Phase 2.5: Results Documentation   — After testing
⏳ Phase 2.5: Production Approval     — After documentation
⏸️  Phase 2.6: Production Deployment  — Awaiting approval
⏸️  Phase 3.0: Advanced Features      — Future
```

---

## 🎬 Ready to Proceed

**আপনার পরবর্তী পদক্ষেপ:**

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw
2. Follow `STAGING_DEPLOYMENT_GUIDE.md` step-by-step
3. Apply migrations 001, 002, 003, 004 in order
4. Run `npx tsx scripts/verify-staging.ts`
5. Perform manual E2E tests
6. Report results

**আমি এখন কী করব:**

আপনি migrations apply করার পর আমাকে জানান। আমি তখন:
- Verification script results analyze করব
- Additional tests suggest করব
- Results documentation তৈরি করব
- Production deployment plan finalize করব

---

**Status:** ✅ Ready for Manual Migration  
**Blocker:** None (all preparation complete)  
**Risk:** Very Low (all migrations safe and idempotent)  
**Next:** Manual migration execution by user

**Last Updated:** 2025-01-15  
**Document Version:** 1.0
