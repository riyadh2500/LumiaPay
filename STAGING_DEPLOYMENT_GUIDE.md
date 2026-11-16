# LumiaPay — Staging Deployment Guide

**Environment:** Staging  
**Supabase Project:** xmdeksqnzhvijaeblwhw  
**Date:** 2025-01-15  
**Status:** Ready to Deploy

---

## Overview

এই guide অনুসরণ করে আপনি LumiaPay-এর সম্পূর্ণ Developer Infrastructure staging environment-এ deploy করতে পারবেন।

**মোট সময় লাগবে:** ~15 মিনিট  
**প্রয়োজনীয় Access:** Supabase Dashboard SQL Editor

---

## Pre-Deployment Checklist

- [x] Staging Supabase project তৈরি হয়েছে (xmdeksqnzhvijaeblwhw)
- [x] `.env.staging` file তৈরি হয়েছে
- [x] Migration files আছে (001, 002, 003, 004)
- [x] সব migrations idempotent এবং safe verified
- [ ] Supabase dashboard-এ logged in
- [ ] SQL Editor খোলা আছে

---

## Step 1: Supabase Dashboard-এ যান

1. যান: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw
2. বাম sidebar থেকে **SQL Editor** ক্লিক করুন
3. **New query** ক্লিক করুন

---

## Step 2: Baseline Migration (001) Apply করুন

### Migration 001: Payment Engine Tables

**কী হবে:**
- `payment_transactions` table তৈরি হবে
- `payment_events` table তৈরি হবে
- `payments` table-এ `verified_amount` ও `metadata` column যোগ হবে
- Helper functions তৈরি হবে
- RLS policies enable হবে

**SQL Query:**

SQL Editor-এ নিচের SQL paste করুন এবং **RUN** ক্লিক করুন:

```sql
-- ============================================================================
-- LumiaPay Payment Engine - Database Migration 001
-- Created: 2025-01-13
-- Description: Adds tables and constraints for the Central Payment Engine
-- ============================================================================

-- ─── Payment Transactions Table ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL,
  verified_amount TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_tx_hash UNIQUE (tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id 
  ON payment_transactions(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tx_hash 
  ON payment_transactions(tx_hash);

-- ─── Payment Events Table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id 
  ON payment_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id 
  ON payment_events(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_created_at 
  ON payment_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_unprocessed 
  ON payment_events(processed, created_at) 
  WHERE processed = FALSE;

-- ─── Update Payments Table ──────────────────────────────────────────────────
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS verified_amount TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_payments_status 
  ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_expires_at 
  ON payments(expires_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payments_user_created 
  ON payments(user_id, created_at DESC);

-- ─── Row Level Security Policies ─────────────────────────────────────────────
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment events" ON payment_events;

CREATE POLICY "Users can view own payment events"
  ON payment_events FOR SELECT
  USING (user_id = auth.uid());

-- ─── Helper Functions ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_transaction_used(tx_hash_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM payment_transactions WHERE tx_hash = tx_hash_param
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION get_payment_stats(user_id_param UUID)
RETURNS TABLE (
  total_payments BIGINT,
  paid_payments BIGINT,
  pending_payments BIGINT,
  total_amount_paid NUMERIC,
  average_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_payments,
    COUNT(*) FILTER (WHERE status = 'paid')::BIGINT as paid_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_payments,
    COALESCE(SUM(CAST(amount AS NUMERIC)) FILTER (WHERE status = 'paid'), 0) as total_amount_paid,
    COALESCE(AVG(CAST(amount AS NUMERIC)) FILTER (WHERE status = 'paid'), 0) as average_amount
  FROM payments
  WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Comments ────────────────────────────────────────────────────────────────
COMMENT ON TABLE payment_transactions IS 
  'Verified blockchain transactions linked to payments. Ensures transaction uniqueness.';

COMMENT ON TABLE payment_events IS 
  'Payment lifecycle events for audit trails, monitoring, and webhook delivery.';

COMMENT ON COLUMN payments.verified_amount IS 
  'Actual amount received on blockchain (may differ from requested amount).';

COMMENT ON COLUMN payments.metadata IS 
  'Additional payment metadata in JSON format.';
```

**✅ Expected Result:** `Success. No rows returned`

### Verification Query

নতুন query window খুলে এই query run করুন:

```sql
-- Verify migration 001 applied successfully
SELECT 
  'payment_transactions' as table_name,
  COUNT(*) as row_count
FROM payment_transactions
UNION ALL
SELECT 
  'payment_events' as table_name,
  COUNT(*) as row_count
FROM payment_events;
```

**Expected Output:**
```
table_name              | row_count
------------------------|----------
payment_transactions    | 0
payment_events          | 0
```

**✅ Migration 001 Complete!**

---

## Step 3: Developer Infrastructure Migration (002) Apply করুন

### Migration 002: Developer Infrastructure

**কী হবে:**
- `applications` table তৈরি হবে (developer apps)
- `api_keys` table তৈরি হবে (API authentication)
- `payments` ও `payment_events` table-এ `application_id` ও `environment` column যোগ হবে
- `validate_api_key()` function তৈরি হবে (API auth)
- `get_application_payment_stats()` function তৈরি হবে (analytics)
- RLS policies enable হবে

**⚠️ Important:** এই migration টি বড় (25KB+), তাই SQL Editor-এ paste করার সময় সাবধান থাকুন।

**Option A: File থেকে Copy করুন**

1. Open: `LumiaPay-main/supabase/migrations/002_developer_infrastructure.sql`
2. সম্পূর্ণ content copy করুন (Ctrl+A, Ctrl+C)
3. Supabase SQL Editor-এ paste করুন
4. **RUN** ক্লিক করুন

**Option B: Manual SQL (Condensed Version)**

আমি একটি condensed version তৈরি করতে পারি যদি file copy করতে সমস্যা হয়। তবে full file recommended।

**✅ Expected Result:** `Success. No rows returned`

### Verification Query

```sql
-- Verify migration 002 applied successfully
SELECT 
  'applications' as table_name,
  COUNT(*) as row_count
FROM applications
UNION ALL
SELECT 
  'api_keys' as table_name,
  COUNT(*) as row_count
FROM api_keys;

-- Verify new columns added to payments
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments' 
  AND column_name IN ('application_id', 'environment')
ORDER BY column_name;

-- Test validate_api_key function
SELECT * FROM validate_api_key('test_hash_12345');
```

**Expected Output:**
```
-- Table counts
table_name    | row_count
--------------|----------
applications  | 0
api_keys      | 0

-- New columns
column_name      | data_type | is_nullable
-----------------|-----------|------------
application_id   | uuid      | YES
environment      | text      | YES

-- Function test
(empty result set - no keys exist yet)
```

**✅ Migration 002 Complete!**

---

## Step 4: Rate Limiting Migration (003) Apply করুন

### Migration 003: Rate Limiting

**কী হবে:**
- `rate_limit_buckets` table তৈরি হবে
- `check_rate_limit()` function তৈরি হবে (token bucket algorithm)
- `cleanup_expired_rate_limits()` function তৈরি হবে (cron cleanup)

**SQL Query:**

```sql
-- ============================================================================
-- LumiaPay Rate Limiting System - Migration 003
-- Created: 2025-01-14
-- Description: Token bucket rate limiting for Developer API
-- ============================================================================

-- ─── Rate Limit Buckets Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  tokens_remaining INTEGER NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT tokens_non_negative CHECK (tokens_remaining >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_window_start 
  ON rate_limit_buckets(window_start);

-- ─── Rate Limiting Function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_tokens INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  tokens_remaining INTEGER,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_tokens INTEGER;
  v_new_tokens INTEGER;
BEGIN
  -- Try to get existing bucket
  SELECT 
    rate_limit_buckets.window_start,
    rate_limit_buckets.tokens_remaining
  INTO v_window_start, v_tokens
  FROM rate_limit_buckets
  WHERE rate_limit_buckets.key = p_key
  FOR UPDATE;

  -- If bucket doesn't exist or window expired, create new bucket
  IF NOT FOUND OR v_now >= v_window_start + (p_window_seconds || ' seconds')::INTERVAL THEN
    INSERT INTO rate_limit_buckets (key, tokens_remaining, window_start, last_updated)
    VALUES (p_key, p_max_tokens - 1, v_now, v_now)
    ON CONFLICT (key) DO UPDATE
    SET tokens_remaining = p_max_tokens - 1,
        window_start = v_now,
        last_updated = v_now;
    
    RETURN QUERY SELECT true, p_max_tokens - 1, 0;
    RETURN;
  END IF;

  -- Check if tokens available
  IF v_tokens > 0 THEN
    -- Consume one token
    UPDATE rate_limit_buckets
    SET tokens_remaining = tokens_remaining - 1,
        last_updated = v_now
    WHERE rate_limit_buckets.key = p_key;
    
    RETURN QUERY SELECT true, v_tokens - 1, 0;
  ELSE
    -- Rate limit exceeded
    v_new_tokens := EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::INTERVAL - v_now))::INTEGER;
    RETURN QUERY SELECT false, 0, v_new_tokens;
  END IF;
END;
$$;

-- ─── Cleanup Function ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete buckets older than 1 hour
  DELETE FROM rate_limit_buckets
  WHERE window_start < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate limit buckets
DROP POLICY IF EXISTS "Service role only" ON rate_limit_buckets;
CREATE POLICY "Service role only" ON rate_limit_buckets
  USING (false);

-- ─── Comments ────────────────────────────────────────────────────────────────
COMMENT ON TABLE rate_limit_buckets IS 
  'Token bucket rate limiting for API requests. One bucket per API key.';

COMMENT ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) IS 
  'Atomic rate limiting check using token bucket algorithm. Returns allowed status and remaining tokens.';

COMMENT ON FUNCTION cleanup_expired_rate_limits() IS 
  'Cleanup function for expired rate limit buckets. Should be called by cron job.';
```

**✅ Expected Result:** `Success. No rows returned`

### Verification Query

```sql
-- Verify migration 003 applied
SELECT COUNT(*) as bucket_count FROM rate_limit_buckets;

-- Test rate limit function
SELECT * FROM check_rate_limit('test_key_staging', 10, 60);

-- Verify bucket created
SELECT * FROM rate_limit_buckets WHERE key = 'test_key_staging';

-- Test exceeding rate limit
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..15 LOOP
    PERFORM check_rate_limit('test_burst_staging', 10, 60);
  END LOOP;
END $$;

-- Check final state (should show 0 tokens, not allowed)
SELECT * FROM check_rate_limit('test_burst_staging', 10, 60);
```

**Expected Output:**
```
-- First check
allowed | tokens_remaining | retry_after_seconds
--------|------------------|--------------------
true    | 9                | 0

-- After burst test
allowed | tokens_remaining | retry_after_seconds
--------|------------------|--------------------
false   | 0                | ~60
```

**✅ Migration 003 Complete!**

---

## Step 5: Webhook System Migration (004) Apply করুন

### Migration 004: Webhook System

**কী হবে:**
- `webhook_endpoints` table তৈরি হবে
- `webhook_events` table তৈরি হবে
- `webhook_attempts` table তৈরি হবে
- `generate_webhook_secret()` function তৈরি হবে
- `create_webhook_event()` function তৈরি হবে
- `get_active_webhook_endpoints()` function তৈরি হবে
- RLS policies enable হবে

**SQL Query:**

1. Open: `LumiaPay-main/supabase/migrations/004_webhook_system.sql`
2. সম্পূর্ণ content copy করুন
3. Supabase SQL Editor-এ paste করুন
4. **RUN** ক্লিক করুন

**✅ Expected Result:** `Success. No rows returned`

### Verification Query

```sql
-- Verify migration 004 applied
SELECT 
  'webhook_endpoints' as table_name,
  COUNT(*) as row_count
FROM webhook_endpoints
UNION ALL
SELECT 
  'webhook_events' as table_name,
  COUNT(*) as row_count
FROM webhook_events
UNION ALL
SELECT 
  'webhook_attempts' as table_name,
  COUNT(*) as row_count
FROM webhook_attempts;

-- Test webhook secret generation
SELECT generate_webhook_secret() as webhook_secret;

-- Verify secret format (should start with 'whsec_')
SELECT generate_webhook_secret() LIKE 'whsec_%' as valid_format;
```

**Expected Output:**
```
-- Table counts
table_name          | row_count
--------------------|----------
webhook_endpoints   | 0
webhook_events      | 0
webhook_attempts    | 0

-- Secret generation
webhook_secret
--------------------------------------------------
whsec_a8f3k2j9s... (random base64 string)

-- Format validation
valid_format
------------
true
```

**✅ Migration 004 Complete!**

---

## Step 6: Final Verification — All Migrations Applied

এখন সব migrations ঠিকমতো applied হয়েছে কিনা verify করুন:

```sql
-- List all tables created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected tables:
-- - applications
-- - api_keys
-- - merchants
-- - payment_events
-- - payment_transactions
-- - payments
-- - rate_limit_buckets
-- - webhook_attempts
-- - webhook_endpoints
-- - webhook_events

-- List all functions created
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Expected functions:
-- - check_rate_limit
-- - cleanup_expired_rate_limits
-- - create_webhook_event
-- - generate_webhook_secret
-- - get_active_webhook_endpoints
-- - get_application_payment_stats
-- - get_payment_stats
-- - is_transaction_used
-- - validate_api_key

-- Count RLS policies
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Verify all critical indexes exist
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'applications',
    'api_keys',
    'rate_limit_buckets',
    'webhook_endpoints',
    'webhook_events',
    'webhook_attempts'
  )
ORDER BY tablename, indexname;
```

**✅ All Migrations Successfully Applied!**

---

## Step 7: Configure Application Environment

এখন local development environment staging-এ point করতে হবে:

### Option A: Temporary Staging Mode

`.env.local` backup করুন এবং staging credentials দিয়ে replace করুন:

```bash
# Backup production config
cp .env.local .env.production.backup

# Use staging config
cp .env.staging .env.local
```

### Option B: Separate Staging Command (Recommended)

`package.json`-এ staging script যোগ করুন:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:staging": "ENV_FILE=.env.staging next dev",
    "build:staging": "ENV_FILE=.env.staging next build"
  }
}
```

তারপর run করুন:

```bash
npm run dev:staging
```

---

## Step 8: Create Test User in Staging

Staging database-এ একটি test merchant user তৈরি করুন:

1. যান: https://supabase.com/dashboard/project/xmdeksqnzhvijaeblwhw/auth/users
2. **Add user** ক্লিক করুন
3. Email: `staging-merchant@lumiapay.test`
4. Password: `StagingTest2025!`
5. **Auto Confirm User:** ✅ (enable করুন)
6. **Create user** ক্লিক করুন

এই user দিয়ে LumiaPay-এ login করে developer dashboard test করতে পারবেন।

---

## Next Steps

Migrations সফলভাবে apply হওয়ার পর:

1. ✅ Local dev server staging mode-এ চালু করুন
2. ✅ Staging merchant user দিয়ে login করুন
3. ✅ Developer dashboard access করুন (`/developer`)
4. ✅ Application তৈরি করুন
5. ✅ API keys generate করুন
6. ✅ Webhook endpoint register করুন
7. ✅ API endpoints test করুন
8. ✅ End-to-end tests রান করুন

আমি এখন **Automated E2E Test Suite** তৈরি করব যা staging environment verification করবে।

---

## Rollback Instructions (If Needed)

যদি কোনো migration-এ সমস্যা হয়:

### Rollback Migration 004 (Webhooks)

```sql
DROP TABLE IF EXISTS webhook_attempts CASCADE;
DROP TABLE IF EXISTS webhook_events CASCADE;
DROP TABLE IF EXISTS webhook_endpoints CASCADE;
DROP FUNCTION IF EXISTS generate_webhook_secret();
DROP FUNCTION IF EXISTS create_webhook_event(UUID, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS get_active_webhook_endpoints(UUID, TEXT);
```

### Rollback Migration 003 (Rate Limiting)

```sql
DROP TABLE IF EXISTS rate_limit_buckets CASCADE;
DROP FUNCTION IF EXISTS check_rate_limit(TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS cleanup_expired_rate_limits();
```

### Rollback Migration 002 (Developer Infrastructure)

```sql
-- Use the complete rollback script
-- Copy and run: LumiaPay-main/supabase/migrations/002_rollback.sql
```

### Rollback Migration 001 (Payment Engine)

```sql
DROP TABLE IF EXISTS payment_events CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
ALTER TABLE payments DROP COLUMN IF EXISTS verified_amount;
ALTER TABLE payments DROP COLUMN IF EXISTS metadata;
DROP FUNCTION IF EXISTS is_transaction_used(TEXT);
DROP FUNCTION IF EXISTS get_payment_stats(UUID);
```

---

**Deployment Status:** Ready ✅  
**Estimated Time:** 15 minutes  
**Risk Level:** Very Low (all migrations idempotent and safe)

আপনি এখন migrations apply করতে পারেন। কোনো সমস্যা হলে আমাকে জানান!
