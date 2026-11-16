# 🚀 LumiaPay Staging Deployment — EXECUTION GUIDE

**Status:** Ready for Execution  
**Date:** 2025-01-15  
**Target:** Staging Database (xmdeksqnzhvijaeblwhw)

---

## ⚠️ BEFORE YOU START

**Checklist:**
- [ ] You are logged into Supabase dashboard
- [ ] You have confirmed this is the **STAGING** project (not production)
- [ ] You have 10 minutes available (no interruptions)
- [ ] You have backup of current `.env.local` (already done: `.env.production.backup`)

---

## 📋 STEP-BY-STEP EXECUTION

### STEP 1: Open Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw
2. Click **"SQL Editor"** in left sidebar
3. Click **"New query"** button

---

### STEP 2: Apply Consolidated Migration

**COPY THE ENTIRE FILE:**

Open file: `LumiaPay-main/supabase/migrations/CONSOLIDATED_002_003_004.sql`

**Or use this PowerShell command to copy to clipboard:**

```powershell
Get-Content "LumiaPay-main\supabase\migrations\CONSOLIDATED_002_003_004.sql" | Set-Clipboard
```

**PASTE into SQL Editor and click RUN**

**⏱️ Expected Time:** 5-10 seconds

**✅ Expected Output:**
```
Success. No rows returned.
```

**❌ If Error Occurs:**
- Check error message
- Most common: Migration 001 not applied
- Solution: Apply migration 001 first (payment engine baseline)

---

### STEP 3: Verify Migration Success

In SQL Editor, open **New query** and run this:

```sql
-- Verify tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'applications', 
    'api_keys', 
    'rate_limit_buckets', 
    'webhook_endpoints', 
    'webhook_events', 
    'webhook_attempts'
  )
ORDER BY table_name;
```

**✅ Expected Result:** 6 rows (all table names)

---

```sql
-- Verify functions created
SELECT routine_name 
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'validate_api_key', 
    'get_application_payment_stats', 
    'check_rate_limit', 
    'cleanup_expired_rate_limits', 
    'generate_webhook_secret', 
    'create_webhook_event', 
    'get_active_webhook_endpoints'
  )
ORDER BY routine_name;
```

**✅ Expected Result:** 7 rows (all function names)

---

```sql
-- Test rate limit function
SELECT * FROM check_rate_limit('manual_test_key', 10, 60);
```

**✅ Expected Result:**
```
allowed | remaining | reset_at
--------|-----------|-------------------
true    | 9         | 2025-01-15 ...
```

---

```sql
-- Test webhook secret generation
SELECT generate_webhook_secret() as secret;
```

**✅ Expected Result:** String starting with `whsec_`

---

```sql
-- Verify payment extensions
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments' 
  AND column_name IN ('application_id', 'environment')
ORDER BY column_name;
```

**✅ Expected Result:**
```
column_name     | data_type | is_nullable
----------------|-----------|------------
application_id  | uuid      | YES
environment     | text      | YES
```

---

### STEP 4: Create Test User

1. Go to: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw/auth/users
2. Click **"Add user"** → **"Create new user"**
3. Fill in:
   - **Email:** `staging-merchant@lumiapay.test`
   - **Password:** `StagingTest2025!`
   - **Auto Confirm User:** ✅ **ENABLE THIS**
4. Click **"Create user"**

**✅ User Created Successfully**

---

### STEP 5: Switch to Staging Environment

**PowerShell (Windows):**

```powershell
cd LumiaPay-main

# Backup current config (if not done already)
if (-not (Test-Path .env.production.backup)) {
  Copy-Item .env.local .env.production.backup
}

# Load staging environment
$stagingVars = Get-Content .env.staging | Where-Object { $_ -match '=' }
foreach ($line in $stagingVars) {
  if ($line -match '^([^=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
  }
}

Write-Host "✅ Staging environment loaded" -ForegroundColor Green
Write-Host "   URL: $env:NEXT_PUBLIC_SUPABASE_URL"
```

---

### STEP 6: Run Automated Verification

```powershell
npx tsx scripts/verify-staging.ts
```

**✅ Expected Output:**
```
✅ Environment Variables
✅ Database Tables
✅ Function: validate_api_key()
✅ Function: check_rate_limit()
✅ Function: generate_webhook_secret()
✅ Applications Table
✅ API Keys Table
✅ Payments Table Extensions
✅ Rate Limit Buckets Table
✅ Rate Limiting Logic
✅ Webhook Endpoints Table
✅ Webhook Events Table
✅ Webhook Attempts Table
✅ Webhook Secret Generation
✅ Payment Table Extensions
✅ Staging Environment Configured

📊 STAGING VERIFICATION REPORT
Total Tests: 16+
✅ Passed: 16+
❌ Failed: 0
Pass Rate: 100%

🎉 ALL TESTS PASSED! Staging environment is ready.
```

**❌ If Tests Fail:**
- Check which test failed
- Common issues:
  - Environment variables not loaded correctly
  - Migration not fully applied
  - Service role key incorrect
- Re-run migration if needed (it's idempotent)

---

### STEP 7: Start Development Server

```powershell
npm run dev
```

**✅ Server Running at:** http://localhost:3000

---

### STEP 8: Manual Login Test

1. Open browser: http://localhost:3000
2. Login with:
   - **Email:** `staging-merchant@lumiapay.test`
   - **Password:** `StagingTest2025!`
3. **✅ Should redirect to:** `/dashboard`

---

### STEP 9: Access Developer Dashboard

1. Navigate to: http://localhost:3000/developer
2. **✅ Should see:**
   - Developer sidebar (NOT merchant sidebar)
   - 8 navigation items (Overview, Applications, API Keys, Webhooks, Logs, Analytics, Documentation, Sandbox)
   - No console errors

---

### STEP 10: Create Test Application

1. Go to: http://localhost:3000/developer/applications
2. Click **"Create Application"**
3. Fill in:
   - **Name:** `Staging Test App`
   - **Environment:** `Test`
   - **Description:** `Testing Phase 2 Developer Infrastructure`
4. Click **"Create"**
5. **✅ Should appear in applications list**

---

### STEP 11: Generate API Keys

1. Go to: http://localhost:3000/developer/keys
2. Select application: `Staging Test App`
3. Click **"Create API Key"**

**Generate Publishable Key:**
- **Name:** `Staging Publishable Key`
- **Type:** `Publishable`
- Click **"Create"**
- **✅ Key shown once** (starts with `pk_test_`)
- **COPY IT NOW** (save to notepad)

**Generate Secret Key:**
- Click **"Create API Key"** again
- **Name:** `Staging Secret Key`
- **Type:** `Secret`
- Click **"Create"**
- **✅ Key shown once** (starts with `sk_test_`)
- **COPY IT NOW** (save to notepad)

---

### STEP 12: Test API Authentication

**Test 1: Valid Key (should succeed)**

```powershell
$secretKey = "sk_test_YOUR_KEY_HERE"  # Replace with your actual key

curl -X GET http://localhost:3000/api/v1/payments `
  -H "Authorization: Bearer $secretKey"
```

**✅ Expected:** `200 OK` with JSON response (empty array `[]` initially)

---

**Test 2: Invalid Key (should fail)**

```powershell
curl -X GET http://localhost:3000/api/v1/payments `
  -H "Authorization: Bearer sk_test_invalid_key_12345"
```

**✅ Expected:** `401 Unauthorized`

---

### STEP 13: Test Rate Limiting

```powershell
$secretKey = "sk_test_YOUR_KEY_HERE"

# Make 101 requests rapidly
for ($i = 1; $i -le 101; $i++) {
  try {
    $response = Invoke-WebRequest `
      -Uri "http://localhost:3000/api/v1/payments" `
      -Headers @{"Authorization" = "Bearer $secretKey"} `
      -Method GET `
      -SkipHttpErrorCheck

    Write-Host "$i : $($response.StatusCode)"
    
    if ($response.StatusCode -eq 429) {
      Write-Host "✅ Rate limit triggered at request $i" -ForegroundColor Green
      break
    }
  } catch {
    Write-Host "$i : Error - $($_.Exception.Message)"
  }
}
```

**✅ Expected:**
- Requests 1-100: `200 OK`
- Request 101: `429 Too Many Requests`

---

### STEP 14: Create Payment via API

```powershell
$secretKey = "sk_test_YOUR_KEY_HERE"

$body = @{
  amount = "10.50"
  currency = "USDC"
  network = "arc_testnet"
  metadata = @{
    test = "staging"
    order_id = "STAGING-001"
  }
} | ConvertTo-Json

curl -X POST http://localhost:3000/api/v1/payments `
  -H "Authorization: Bearer $secretKey" `
  -H "Content-Type: application/json" `
  -d $body
```

**✅ Expected:** `201 Created` with payment object including `payment_address`

---

### STEP 15: Verify Payment in Database

Go to Supabase SQL Editor and run:

```sql
-- Check payment created via API
SELECT 
  id, 
  amount, 
  currency, 
  status, 
  application_id, 
  environment,
  created_at
FROM payments 
WHERE application_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 1;
```

**✅ Expected:**
- `application_id`: UUID (your application ID)
- `environment`: `test`
- `amount`: `10.50`
- `currency`: `USDC`

---

### STEP 16: Register Webhook Endpoint

1. Go to: https://webhook.site
2. Copy your unique URL (e.g., `https://webhook.site/abc123-def456`)
3. Go to: http://localhost:3000/developer/webhooks
4. Click **"Add Endpoint"**
5. Fill in:
   - **URL:** Your webhook.site URL
   - **Events:** Select `payment.paid`, `payment.failed`
   - **Description:** `Staging webhook test`
6. Click **"Create"**
7. **✅ Endpoint appears in list**
8. **COPY THE SECRET** (starts with `whsec_`) — save to notepad

---

### STEP 17: Merchant Dashboard Regression Test

1. Navigate to: http://localhost:3000/dashboard
2. **✅ Verify:**
   - Original merchant sidebar visible (NOT developer sidebar)
   - No developer-related links
   - Dashboard loads without errors
3. Navigate to: http://localhost:3000/payments
4. **✅ Verify:**
   - Payments list visible
   - Shows both merchant-created AND API-created payments
5. Navigate to: http://localhost:3000/settings
6. **✅ Verify:**
   - Settings page loads
   - No console errors

---

### STEP 18: Check Developer Analytics

1. Go to: http://localhost:3000/developer/analytics
2. Select application: `Staging Test App`
3. **✅ Should show:**
   - Total payments: 1 (or more if you created multiple)
   - Success rate: 0% (payment still pending)
   - Chart showing payment over time

---

### STEP 19: Check API Logs

1. Go to: http://localhost:3000/developer/logs
2. **✅ Should show:**
   - All API requests made (GET /payments, POST /payments, etc.)
   - Status codes (200, 201, 401, 429)
   - Timestamps
   - API key used

---

### STEP 20: Run Full Test Suite

```powershell
npm test
```

**✅ Expected:** All 221 tests pass (no regressions)

---

### STEP 21: TypeScript Check

```powershell
npm run typecheck
```

**✅ Expected:** `0 errors`

---

### STEP 22: Production Build Test

```powershell
npm run build
```

**✅ Expected:** Build succeeds, all routes compiled

---

## 🎉 DEPLOYMENT COMPLETE!

### Summary of What Was Created

**Database:**
- ✅ 6 new tables (applications, api_keys, rate_limit_buckets, webhook_endpoints, webhook_events, webhook_attempts)
- ✅ 7 new functions (API key validation, rate limiting, webhook helpers, analytics)
- ✅ 3 new columns on existing tables (backward-compatible)
- ✅ 15+ indexes for performance
- ✅ 10+ RLS policies for security

**Application:**
- ✅ Developer dashboard (8 pages)
- ✅ API authentication system
- ✅ Rate limiting system
- ✅ Webhook delivery system
- ✅ 0 changes to merchant dashboard

**Tests Passed:**
- ✅ 16+ automated verification tests
- ✅ 22 manual E2E tests
- ✅ 221 unit tests (no regressions)
- ✅ 0 TypeScript errors
- ✅ Production build successful

---

## 📊 Next Steps

### Create Results Documentation

আমি এখন একটি comprehensive results document তৈরি করব:

```
PHASE_2.5_STAGING_TEST_RESULTS.md
```

এতে থাকবে:
- All test results with evidence
- Screenshots (যদি থাকে)
- SQL query outputs
- API response examples
- Performance metrics

### Production Readiness Review

**Before proceeding to production:**
1. Review all staging test results
2. Confirm no breaking changes
3. Verify merchant regression tests passed
4. Check security audit results
5. Get stakeholder approval

### Production Deployment Plan

**When ready for production:**
1. Schedule maintenance window (optional)
2. Create production database backup
3. Apply same migration to production
4. Run smoke tests
5. Monitor for 24-48 hours
6. Announce to users

---

## 🆘 Troubleshooting

### Issue: Migration Failed

**Solution:**
- Check migration 001 is applied first
- Verify you're connected to correct database
- Check for conflicting table names
- Re-run (migration is idempotent)

### Issue: Verification Tests Failing

**Solution:**
- Check environment variables loaded correctly
- Verify service role key is correct
- Check network connection to Supabase
- Re-run verification script

### Issue: API Authentication Not Working

**Solution:**
- Verify API key copied correctly
- Check key not revoked in database
- Verify application status is 'active'
- Check key hash matches in database

### Issue: Rate Limiting Not Triggering

**Solution:**
- Verify check_rate_limit function created
- Check rate_limit_buckets table accessible
- Increase request count (default limit: 100)
- Check service role key has access

### Issue: Webhooks Not Delivering

**Solution:**
- Verify cron worker configured (next phase)
- Check webhook endpoint status is 'active'
- Verify enabled_events includes event type
- Check webhook.site URL is correct

---

## 📞 Support

If you encounter any issues:

1. Check `PHASE_2.5_STAGING_DEPLOYMENT_STATUS.md` for detailed status
2. Check `STAGING_DEPLOYMENT_GUIDE.md` for step-by-step instructions
3. Check `PHASE_2.5_STAGING_VERIFICATION_PLAN.md` for risk analysis
4. Review SQL error messages carefully
5. Contact support with error details

---

**Deployment Status:** ✅ Ready to Execute  
**Estimated Time:** 30-45 minutes (all steps)  
**Risk Level:** Very Low (staging environment only)

**Last Updated:** 2025-01-15  
**Version:** 1.0
