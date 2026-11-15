# Migration 003 — Production Deployment Checklist

**Status:** ✅ SAFE FOR PRODUCTION  
**Estimated Time:** 10 minutes  
**Risk Level:** LOW

---

## Pre-Deployment (5 minutes)

### 1. Backup Database
```
☐ Supabase Dashboard → Database → Backups → Create Backup
☐ Note backup ID: _________________
```

### 2. Verify Environment
```bash
☐ Check production environment has SUPABASE_SERVICE_ROLE_KEY
☐ Verify Supabase project is accessible
☐ Confirm application is currently deployed and working
```

### 3. Prepare Rollback
```
☐ Keep rollback SQL ready (see MIGRATION_003_SAFETY_AUDIT.md § 11.2)
☐ Have Vercel dashboard open for quick revert
```

---

## Deployment (5 minutes)

### 4. Apply Database Migration
```
☐ Open Supabase Dashboard → SQL Editor
☐ Click "New Query"
☐ Copy entire contents of: supabase/migrations/003_rate_limiting.sql
☐ Paste into SQL Editor
☐ Click "Run"
☐ Verify: "Success. No rows returned"
```

### 5. Verify Migration
```sql
☐ Run verification query:

SELECT 
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_name = 'rate_limit_buckets') as table_exists,
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_name = 'check_rate_limit') as function_exists,
  (SELECT rowsecurity FROM pg_tables 
   WHERE tablename = 'rate_limit_buckets') as rls_enabled;

☐ Expected: table_exists=1, function_exists=1, rls_enabled=true
```

### 6. Test Database Function
```sql
☐ Run test:

SELECT * FROM check_rate_limit('test:verify:127.0.0.1', 10, 60);

☐ Expected: allowed=true, remaining=9
☐ Run again: remaining should be 8
```

### 7. Deploy Application
```bash
☐ Ensure latest code is committed
☐ Deploy: vercel --prod
☐ Wait for deployment to complete
☐ Note deployment URL: _________________
```

---

## Post-Deployment Testing (5 minutes)

### 8. Smoke Test Public Endpoint
```bash
☐ Test single request:
curl -i https://your-domain.vercel.app/api/payments/test-payment-id

☐ Verify response headers present:
   X-RateLimit-Remaining: 59
   X-RateLimit-Reset: <timestamp>
```

### 9. Test Rate Limiting
```bash
☐ Test verification endpoint (10 req/min limit):

for i in {1..11}; do
  echo "Request $i: $(curl -s -o /dev/null -w '%{http_code}' \
    https://your-domain.vercel.app/api/payments/test-id?action=verify)"
done

☐ Expected: First 10 return 200/400/422, 11th returns 429
```

### 10. Verify Rate Limit Response
```bash
☐ Check 429 response format:

curl -i https://your-domain.vercel.app/api/payments/test-id?action=verify

☐ Verify headers:
   HTTP/1.1 429 Too Many Requests
   Retry-After: <seconds>
   X-RateLimit-Remaining: 0
   
☐ Verify body:
   {"error": "Too many requests", "retryAfter": <seconds>}
```

### 11. Clean Test Data
```sql
☐ Remove test buckets:

DELETE FROM rate_limit_buckets WHERE key LIKE 'test:%';
```

---

## Monitoring (Next 24 Hours)

### 12. Application Logs
```
☐ Check Vercel logs for errors:
   vercel logs --filter "[RateLimit]"

☐ Watch for:
   - [RateLimit] DB error: <message>
   - [RateLimit] Unexpected error: <message>
```

### 13. Database Monitoring
```sql
☐ Check active rate-limit buckets (run hourly):

SELECT 
  COUNT(*) as total_buckets,
  COUNT(*) FILTER (WHERE tokens = 0 AND reset_at > NOW()) as blocked_buckets,
  pg_size_pretty(pg_total_relation_size('rate_limit_buckets')) as table_size
FROM rate_limit_buckets;

☐ Normal ranges:
   total_buckets: < 10,000
   blocked_buckets: < 100
   table_size: < 10 MB
```

### 14. Performance Check
```
☐ Supabase Dashboard → Database → Performance
☐ Verify no unusual spikes in:
   - Query duration
   - Connection count
   - Database CPU
```

---

## Rollback (If Issues Occur)

### 15. Application Rollback
```bash
☐ Revert to previous deployment:
   vercel rollback

☐ Verify application works without rate limiting
```

### 16. Database Rollback (Only if needed)
```sql
☐ Supabase Dashboard → SQL Editor → Run:

DROP FUNCTION IF EXISTS cleanup_expired_rate_limits();
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTEGER);
DROP TABLE IF EXISTS rate_limit_buckets CASCADE;

☐ Verify objects removed
```

---

## Success Criteria

✅ **Deployment Successful If:**
- [x] Database migration applied without errors
- [x] Verification queries return expected results
- [x] Application deploys successfully
- [x] Rate limiting works (429 responses after limit exceeded)
- [x] No errors in application logs
- [x] Existing payment functionality still works

⚠️ **Rollback If:**
- Database migration fails
- Verification queries fail
- Application throws errors
- All requests return 429
- Payment functionality broken

---

## Sign-Off

```
Backup Created:      ☐ Yes   Backup ID: _________________
Migration Applied:   ☐ Yes   Timestamp: _________________
Tests Passed:        ☐ Yes   
Monitoring Active:   ☐ Yes   
Issues Encountered:  ☐ None  ☐ See notes: _______________

Deployed By:         _______________________________________
Date:                _______________________________________
Time:                _______________________________________

Notes:
_________________________________________________________
_________________________________________________________
_________________________________________________________
```

---

## Quick Reference

**Migration File:** `supabase/migrations/003_rate_limiting.sql`  
**Full Audit:** `MIGRATION_003_SAFETY_AUDIT.md`  
**Documentation:** `RATE_LIMITING_REPORT.md`  
**Support:** All rate-limit code in `lib/rate-limit.ts`

**Emergency Contact:**
- Supabase Support: https://supabase.com/dashboard/support
- Vercel Support: https://vercel.com/support
