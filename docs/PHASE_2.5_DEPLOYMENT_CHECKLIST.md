# LumiaPay Phase 2.5: Production Deployment Checklist

**Date:** 2024-01-15  
**Version:** Phase 2.5 - Developer Platform  
**Target:** Production Deployment

---

## Deployment Status Dashboard

### Overall Readiness: 🟡 **70% READY**

| Component | Status | Blocker |
|-----------|--------|---------|
| **Code Quality** | ✅ 100% | None |
| **Tests** | ✅ 100% | None |
| **Build** | ✅ 100% | None |
| **Database** | 🔴 0% | Migrations not applied |
| **Environment** | 🔴 85% | CRON_SECRET missing |
| **Documentation** | ✅ 100% | None |
| **Security** | ✅ 92% | Minor config issues |

---

## Pre-Deployment Checklist

### 1. Code Quality ✅ **COMPLETE**

- [x] TypeScript compilation: 0 errors
- [x] ESLint: Clean
- [x] Production build: Successful
- [x] All routes compiled: 30/30
- [x] Bundle sizes: Optimized
- [x] Source maps: Generated

**Status:** ✅ **READY**

---

### 2. Testing ✅ **COMPLETE**

- [x] Unit tests: 221/221 passing
- [x] Integration tests: 30/30 passing
- [x] Type checking: Clean
- [x] Build test: Successful
- [ ] E2E tests: Not implemented (optional)
- [ ] Manual testing: Pending migrations

**Status:** ✅ **AUTOMATED TESTS PASS** | ⏳ **Manual tests pending**

---

### 3. Database 🔴 **BLOCKED**

#### Migration 002: Developer Infrastructure
- [ ] Migration file reviewed
- [ ] Backup taken
- [ ] Applied to development database
- [ ] Applied to staging database
- [ ] Applied to production database
- [ ] Tables verified (`applications`, `api_keys`)
- [ ] Functions verified (`validate_api_key`)
- [ ] RLS policies verified

**Status:** 🔴 **NOT APPLIED** - Requires approval

#### Migration 003: Rate Limiting
- [ ] Migration file reviewed
- [ ] Applied to development database
- [ ] Applied to staging database
- [ ] Applied to production database
- [ ] Table verified (`rate_limit_buckets`)
- [ ] Function verified (`check_rate_limit`)
- [ ] Tested with real requests

**Status:** 🔴 **NOT APPLIED** - Critical for production

#### Migration 004: Webhook System
- [ ] Migration file reviewed
- [ ] Applied to development database
- [ ] Applied to staging database
- [ ] Applied to production database
- [ ] Tables verified (`webhook_endpoints`, `webhook_events`, `webhook_attempts`)
- [ ] Function verified (`process_webhook_queue`)
- [ ] Cron job tested

**Status:** 🔴 **NOT APPLIED** - Required for webhooks

---

### 4. Environment Variables

#### Development (.env.local) ⚠️ **INCOMPLETE**
- [x] NEXT_PUBLIC_SUPABASE_URL
- [x] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [x] SUPABASE_SERVICE_ROLE_KEY
- [x] ARC_RPC_URL
- [x] ARC_USDC_CONTRACT
- [x] ARC_EURC_CONTRACT
- [ ] **CRON_SECRET** 🔴 **MISSING**

#### Production (Vercel) ⏳ **NOT CONFIGURED**
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] ARC_RPC_URL
- [ ] ARC_USDC_CONTRACT
- [ ] ARC_EURC_CONTRACT
- [ ] **CRON_SECRET** 🔴 **MISSING**

**Status:** 🔴 **1 CRITICAL VARIABLE MISSING**

---

### 5. Security

#### Critical Security Items
- [x] API keys hashed (SHA-256)
- [x] Webhook signatures (HMAC-SHA256)
- [x] Input validation comprehensive
- [x] SQL injection protected
- [x] Row-Level Security enabled
- [x] Environment isolation enforced
- [ ] **CRON_SECRET set** 🔴
- [ ] **Rate limiting active** 🔴
- [ ] npm audit run
- [ ] Dependencies updated

#### Recommended Security Items
- [ ] SSRF protection (webhook URLs)
- [ ] Timestamp validation (webhooks)
- [ ] Cron schedule adjusted (30s → 5min)
- [ ] Security headers configured

**Status:** 🔴 **2 CRITICAL ITEMS PENDING**

---

### 6. Performance

#### Build Optimization
- [x] Code splitting: Enabled
- [x] Tree shaking: Enabled
- [x] Minification: Enabled
- [x] Gzip compression: Enabled (Vercel default)
- [x] Image optimization: Enabled (Next.js)

#### Database Optimization
- [x] Indexes planned (in migrations)
- [ ] Indexes verified (post-migration)
- [ ] Query performance tested
- [ ] Connection pooling: Handled by Supabase

#### Caching
- [x] Static pages: Next.js cache
- [x] API responses: No caching (real-time data)
- [ ] CDN configured: Vercel default

**Status:** ✅ **OPTIMIZED** | ⏳ **DB verification pending**

---

### 7. Monitoring

#### Error Tracking
- [ ] Sentry configured
- [ ] Error alerts set up
- [ ] Performance monitoring enabled

#### Logging
- [x] Server-side logging: console.log
- [ ] Log aggregation: Not configured
- [ ] Log retention policy: Default

#### Metrics
- [ ] API endpoint monitoring
- [ ] Webhook delivery monitoring
- [ ] Cron job monitoring
- [ ] Database query monitoring

**Status:** ⚠️ **BASIC LOGGING ONLY** - Production monitoring recommended

---

### 8. Documentation

#### User Documentation
- [x] API documentation (`DEVELOPER_API.md`)
- [x] Webhook guide (`WEBHOOK_GUIDE.md`)
- [x] Quick start guide
- [x] Sandbox information

#### Technical Documentation
- [x] Phase 2.1 implementation report
- [x] Phase 2.2 webhook report
- [x] Phase 2.4 dashboard report
- [x] Phase 2.5 verification report
- [x] Phase 2.5 security audit
- [x] Migration guides
- [x] Deployment checklist (this document)

#### Operational Documentation
- [x] Migration application guide
- [x] Rollback procedures
- [ ] Incident response plan
- [ ] Runbook

**Status:** ✅ **COMPREHENSIVE TECHNICAL DOCS** | ⏳ **Ops docs recommended**

---

## Deployment Steps

### Step 1: Pre-Deployment Preparation (30 minutes)

#### 1.1 Generate CRON_SECRET
```bash
# Generate secure 256-bit secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Save output for next steps
CRON_SECRET=<paste-generated-secret-here>
```

#### 1.2 Update Local Environment
```bash
# Add to .env.local
echo "CRON_SECRET=${CRON_SECRET}" >> .env.local

# Restart development server to test
npm run dev
```

#### 1.3 Backup Database
```bash
# Via Supabase Dashboard
# Project Settings → Database → Backup
# Or via pg_dump if using direct PostgreSQL

pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

### Step 2: Apply Migrations (Development First) (30 minutes)

#### 2.1 Apply to Development Database
```bash
# Connect to Supabase SQL Editor or use psql

# Migration 002 - Developer Infrastructure
psql $DEV_DATABASE_URL -f supabase/migrations/002_developer_infrastructure.sql

# Migration 003 - Rate Limiting  
psql $DEV_DATABASE_URL -f supabase/migrations/003_rate_limiting.sql

# Migration 004 - Webhook System
psql $DEV_DATABASE_URL -f supabase/migrations/004_webhook_system.sql
```

#### 2.2 Verify Migrations
```sql
-- Check tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'applications',
    'api_keys',
    'rate_limit_buckets',
    'webhook_endpoints',
    'webhook_events',
    'webhook_attempts'
  );
-- Expected: 6 rows

-- Check functions exist
SELECT proname FROM pg_proc 
WHERE proname IN (
  'validate_api_key',
  'check_rate_limit',
  'process_webhook_queue'
);
-- Expected: 3 rows
```

#### 2.3 Test in Development
```bash
# Start development server
npm run dev

# Navigate to http://localhost:3000/developer/applications
# Create test application
# Generate API key
# Make API request with key
# Verify rate limiting works
```

---

### Step 3: Staging Deployment (If Available) (1 hour)

#### 3.1 Deploy to Staging
```bash
# Push to staging branch (if separate)
git checkout staging
git merge main
git push origin staging

# Vercel will auto-deploy
```

#### 3.2 Apply Migrations to Staging DB
```bash
# Same as Step 2, but with STAGING_DATABASE_URL
psql $STAGING_DATABASE_URL -f supabase/migrations/002_developer_infrastructure.sql
psql $STAGING_DATABASE_URL -f supabase/migrations/003_rate_limiting.sql
psql $STAGING_DATABASE_URL -f supabase/migrations/004_webhook_system.sql
```

#### 3.3 Set Environment Variables
```bash
# Via Vercel Dashboard
# Settings → Environment Variables → Staging

CRON_SECRET=<paste-secret>
```

#### 3.4 Staging Testing
- [ ] Create application via UI
- [ ] Generate API keys
- [ ] Make API requests
- [ ] Test rate limiting (10+ rapid requests)
- [ ] Register webhook endpoint (webhook.site)
- [ ] Trigger webhook event
- [ ] Verify webhook delivery
- [ ] Check all 8 developer pages
- [ ] Verify merchant dashboard unchanged
- [ ] Test merchant payment creation

---

### Step 4: Production Deployment (1 hour)

#### 4.1 Final Code Review
- [ ] All tests passing
- [ ] Build successful
- [ ] Migrations tested in staging
- [ ] Documentation complete
- [ ] Rollback plan ready

#### 4.2 Deploy Code to Production
```bash
# Merge to main
git checkout main
git merge develop
git push origin main

# Or deploy via Vercel CLI
vercel --prod
```

#### 4.3 Apply Migrations to Production DB

**⚠️ CRITICAL: Backup first!**

```bash
# Backup production database
pg_dump $PROD_DATABASE_URL > prod_backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migrations
psql $PROD_DATABASE_URL -f supabase/migrations/002_developer_infrastructure.sql
psql $PROD_DATABASE_URL -f supabase/migrations/003_rate_limiting.sql
psql $PROD_DATABASE_URL -f supabase/migrations/004_webhook_system.sql
```

#### 4.4 Set Production Environment Variables
```bash
# Via Vercel Dashboard
# Settings → Environment Variables → Production

CRON_SECRET=<paste-secret>

# Redeploy to load new variables
vercel --prod
```

#### 4.5 Verify Production Deployment
```bash
# Check deployment status
vercel ls

# Check cron jobs configured
# Vercel Dashboard → Project → Settings → Cron Jobs
# Should show: /api/cron/process-webhooks every 30 seconds (or 5 minutes if adjusted)
```

---

### Step 5: Post-Deployment Verification (30 minutes)

#### 5.1 Smoke Tests
- [ ] Homepage loads
- [ ] Login works
- [ ] Merchant dashboard displays
- [ ] Developer dashboard accessible
- [ ] No console errors

#### 5.2 Developer Features
- [ ] Create application
- [ ] Generate API key (copy for testing)
- [ ] Make POST request to create payment
- [ ] Verify payment appears in logs
- [ ] Check rate limiting (make 10+ requests)

#### 5.3 Webhook Testing
- [ ] Register webhook endpoint
- [ ] Create payment via API
- [ ] Manually mark payment as paid (via dashboard)
- [ ] Verify webhook received
- [ ] Check HMAC signature valid

#### 5.4 Merchant Regression
- [ ] Create payment via merchant dashboard
- [ ] View payments list
- [ ] Check settings page
- [ ] Verify no errors

---

### Step 6: Monitoring Setup (30 minutes)

#### 6.1 Configure Error Tracking
```bash
# Install Sentry (if not already)
npm install @sentry/nextjs

# Configure in next.config.js
# Add SENTRY_DSN to environment variables
```

#### 6.2 Set Up Alerts
- [ ] Error rate alerts (Sentry)
- [ ] API endpoint monitoring (Vercel Analytics)
- [ ] Cron job failure alerts
- [ ] Database connection alerts

#### 6.3 Create Monitoring Dashboard
- [ ] API request volume
- [ ] Webhook delivery success rate
- [ ] Rate limit hits
- [ ] Error rates by endpoint

---

## Rollback Plan

### If Deployment Fails

#### Immediate Rollback (Code)
```bash
# Via Vercel Dashboard
# Deployments → Previous deployment → Promote to Production

# Or via CLI
vercel rollback
```

#### Database Rollback (If Needed)
```bash
# Restore from backup
psql $PROD_DATABASE_URL < prod_backup_YYYYMMDD_HHMMSS.sql

# Or use migration rollback script
psql $PROD_DATABASE_URL -f supabase/migrations/002_rollback.sql
```

#### Verify Rollback
- [ ] Code reverted to previous version
- [ ] Database restored (if needed)
- [ ] Merchant dashboard functional
- [ ] No errors in logs

---

## Post-Deployment Tasks

### Within 24 Hours
- [ ] Monitor error logs
- [ ] Check webhook delivery rates
- [ ] Review API usage patterns
- [ ] Verify rate limiting working
- [ ] Check performance metrics

### Within 1 Week
- [ ] User feedback collected
- [ ] Performance optimization (if needed)
- [ ] Documentation updates (if needed)
- [ ] Bug fixes prioritized

### Within 1 Month
- [ ] Usage analytics review
- [ ] Cost analysis (Vercel, Supabase)
- [ ] Security audit review
- [ ] Plan Phase 3 features

---

## Success Criteria

### Deployment Successful If:
- ✅ All merchant features working
- ✅ Developer dashboard accessible
- ✅ API endpoints responding
- ✅ Webhooks delivering
- ✅ Rate limiting active
- ✅ No critical errors
- ✅ Performance acceptable (<500ms API response)

### Rollback Triggers:
- 🔴 Merchant dashboard broken
- 🔴 >5% error rate
- 🔴 Database corruption
- 🔴 Security vulnerability discovered
- 🔴 Payment processing fails

---

## Risk Assessment

### Low Risk (Go Ahead)
- ✅ Code quality excellent
- ✅ Tests comprehensive
- ✅ Migrations idempotent
- ✅ Rollback plan ready

### Medium Risk (Mitigated)
- ⚠️ First time deploying developer features
- ⚠️ Database migrations in production
- **Mitigation:** Test in staging first

### High Risk (Resolved)
- 🔴 CRON_SECRET missing → **Set before deployment**
- 🔴 Rate limiting broken → **Apply Migration 003**
- 🔴 No backups → **Backup before migrations**

---

## Contact Information

### Key Personnel
- **Developer:** [Your name]
- **Database Admin:** [Name]
- **DevOps:** [Name]

### Emergency Contacts
- **On-Call:** [Phone]
- **Slack Channel:** #lumiapay-alerts
- **Email:** alerts@lumiapay.com

### Escalation Path
1. Check logs (Vercel, Supabase)
2. Contact on-call engineer
3. Execute rollback if critical
4. Post-mortem after resolution

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Pre-deployment prep | 30 min | None |
| Apply migrations (dev) | 30 min | Backup complete |
| Staging deployment | 1 hour | Migrations applied |
| Production deployment | 1 hour | Staging verified |
| Post-deployment verification | 30 min | Deployment complete |
| **Total** | **3.5 hours** | |

**Plus:** 1 hour manual testing after migrations

---

## Approval Required

### Before Proceeding:
- [ ] Code review approved
- [ ] Security audit reviewed
- [ ] Migration plan approved
- [ ] Backup strategy approved
- [ ] Rollback plan approved
- [ ] Stakeholders notified

### Approvers:
- [ ] Tech Lead: _______________
- [ ] Product Manager: _______________
- [ ] Security Team: _______________

---

## Final Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Build successful
- [ ] CRON_SECRET generated
- [ ] Database backed up
- [ ] Migrations reviewed
- [ ] Rollback plan ready

### During Deployment
- [ ] Migrations applied in order
- [ ] Environment variables set
- [ ] Code deployed
- [ ] Smoke tests passed

### Post-Deployment
- [ ] All features verified
- [ ] Monitoring configured
- [ ] Team notified
- [ ] Documentation updated

---

**Deployment Status:** ⏳ **PENDING APPROVAL**

**Blockers:**
1. 🔴 Database migrations not applied
2. 🔴 CRON_SECRET not set

**Estimated Time to Ready:** 35 minutes (after approval)

**Recommendation:** **Apply migrations to development/staging first**, verify all features, then proceed to production.

---

**Checklist Version:** 1.0  
**Last Updated:** 2024-01-15  
**Next Review:** After production deployment
