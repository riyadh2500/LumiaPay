-- ============================================================================
-- LumiaPay — CONSOLIDATED STAGING MIGRATION
-- Combines: Migration 002 + 003 + 004
-- Created: 2025-01-15
-- Environment: STAGING ONLY
-- 
-- CONTENTS:
--   PART 1: Migration 002 — Developer Infrastructure
--   PART 2: Migration 003 — Rate Limiting
--   PART 3: Migration 004 — Webhook System
--   PART 4: Verification Queries
--
-- PREREQUISITES:
--   - Migration 001 (Payment Engine) must be applied first
--   - Tables must exist: payments, payment_events, merchants
--   - Supabase Auth must be configured
--
-- SAFE TO RE-RUN: Yes (all statements are idempotent)
-- ESTIMATED TIME: ~30 seconds
-- ============================================================================

-- ============================================================================
-- PART 1: MIGRATION 002 — DEVELOPER INFRASTRUCTURE
-- ============================================================================

-- Helper function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ─── Applications Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL
    CONSTRAINT applications_name_length
      CHECK (char_length(name) BETWEEN 3 AND 100),
  description TEXT
    CONSTRAINT applications_description_length
      CHECK (description IS NULL OR char_length(description) <= 500),
  environment TEXT NOT NULL DEFAULT 'test'
    CONSTRAINT applications_environment_values
      CHECK (environment IN ('test', 'live')),
  status TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT applications_status_values
      CHECK (status IN ('active', 'suspended', 'deleted')),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT applications_unique_name_per_user_env
    UNIQUE (user_id, name, environment)
);

DROP TRIGGER IF EXISTS applications_set_updated_at ON applications;
CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_active ON applications(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_applications_environment ON applications(environment);
CREATE INDEX IF NOT EXISTS idx_applications_user_active_created ON applications(user_id, created_at DESC) WHERE status = 'active';

-- ─── API Keys Table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  name TEXT NOT NULL
    CONSTRAINT api_keys_name_length
      CHECK (char_length(name) BETWEEN 1 AND 100),
  key_type TEXT NOT NULL
    CONSTRAINT api_keys_type_values
      CHECK (key_type IN ('publishable', 'secret')),
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{"payments":["read","write"],"webhooks":["read","write"]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT api_keys_status_values
      CHECK (status IN ('active', 'revoked', 'expired')),
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count BIGINT NOT NULL DEFAULT 0
    CONSTRAINT api_keys_usage_count_non_negative
      CHECK (usage_count >= 0),
  expires_at TIMESTAMP WITH TIME ZONE
    CONSTRAINT api_keys_valid_expiration
      CHECK (expires_at IS NULL OR expires_at > created_at),
  revoked_at TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT
    CONSTRAINT api_keys_revoked_reason_length
      CHECK (revoked_reason IS NULL OR char_length(revoked_reason) <= 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT api_keys_unique_hash UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active ON api_keys(key_hash) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_api_keys_application_id ON api_keys(application_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_application_active ON api_keys(application_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;

-- ─── Extend Existing Tables ─────────────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE SET NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS environment TEXT
    CONSTRAINT payments_environment_values
      CHECK (environment IS NULL OR environment IN ('test', 'live'));

ALTER TABLE payment_events
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_application_id ON payments(application_id) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_environment ON payments(environment) WHERE environment IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_app_env_status ON payments(application_id, environment, status) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_app_created ON payments(application_id, created_at DESC) WHERE application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_events_application_id ON payment_events(application_id) WHERE application_id IS NOT NULL;

-- ─── Row Level Security (Applications) ──────────────────────────────────────
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select_own" ON applications;
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
DROP POLICY IF EXISTS "applications_update_own" ON applications;
DROP POLICY IF EXISTS "applications_delete_own" ON applications;

CREATE POLICY "applications_select_own" ON applications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "applications_insert_own" ON applications FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "applications_update_own" ON applications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "applications_delete_own" ON applications FOR DELETE USING (user_id = auth.uid());

-- ─── Row Level Security (API Keys) ──────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select_own" ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert_own" ON api_keys;
DROP POLICY IF EXISTS "api_keys_update_own" ON api_keys;
DROP POLICY IF EXISTS "api_keys_no_delete" ON api_keys;

CREATE POLICY "api_keys_select_own" ON api_keys FOR SELECT
  USING (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_insert_own" ON api_keys FOR INSERT
  WITH CHECK (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_update_own" ON api_keys FOR UPDATE
  USING (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

CREATE POLICY "api_keys_no_delete" ON api_keys FOR DELETE USING (false);

-- ─── Functions ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_api_key(key_hash_param TEXT)
RETURNS TABLE (
  key_id UUID,
  application_id UUID,
  user_id UUID,
  key_type TEXT,
  environment TEXT,
  permissions JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id AS key_id,
    a.id AS application_id,
    a.user_id AS user_id,
    k.key_type AS key_type,
    a.environment AS environment,
    k.permissions AS permissions
  FROM api_keys k
  JOIN applications a ON a.id = k.application_id
  WHERE k.key_hash = key_hash_param
    AND k.status = 'active'
    AND a.status = 'active'
    AND (k.expires_at IS NULL OR k.expires_at > NOW());
END;
$$;

CREATE OR REPLACE FUNCTION get_application_payment_stats(application_id_param UUID)
RETURNS TABLE (
  total_payments BIGINT,
  paid_payments BIGINT,
  failed_payments BIGINT,
  expired_payments BIGINT,
  pending_payments BIGINT,
  total_amount_paid NUMERIC,
  success_rate NUMERIC
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_payments,
    COUNT(*) FILTER (WHERE status = 'paid')::BIGINT AS paid_payments,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS failed_payments,
    COUNT(*) FILTER (WHERE status = 'expired')::BIGINT AS expired_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS pending_payments,
    COALESCE(SUM(CAST(amount AS NUMERIC)) FILTER (WHERE status = 'paid'), 0) AS total_amount_paid,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE status = 'paid')::NUMERIC / COUNT(*)::NUMERIC * 100, 2)
      ELSE 0
    END AS success_rate
  FROM payments
  WHERE application_id = application_id_param;
END;
$$;

-- ============================================================================
-- PART 2: MIGRATION 003 — RATE LIMITING
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  tokens INTEGER NOT NULL,
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at ON rate_limit_buckets(reset_at);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_tokens INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_reset_at TIMESTAMP WITH TIME ZONE;
  v_tokens INTEGER;
BEGIN
  INSERT INTO rate_limit_buckets (key, tokens, reset_at, updated_at)
  VALUES (
    p_key,
    p_max_tokens - 1,
    v_now + (p_window_seconds || ' seconds')::INTERVAL,
    v_now
  )
  ON CONFLICT (key) DO UPDATE
    SET
      tokens = CASE
        WHEN rate_limit_buckets.reset_at <= v_now
          THEN p_max_tokens - 1
        WHEN rate_limit_buckets.tokens > 0
          THEN rate_limit_buckets.tokens - 1
        ELSE 0
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= v_now
          THEN v_now + (p_window_seconds || ' seconds')::INTERVAL
        ELSE rate_limit_buckets.reset_at
      END,
      updated_at = v_now
  RETURNING rate_limit_buckets.tokens, rate_limit_buckets.reset_at
  INTO v_tokens, v_reset_at;

  RETURN QUERY SELECT
    (v_tokens >= 0) AS allowed,
    GREATEST(v_tokens, 0) AS remaining,
    v_reset_at AS reset_at;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_buckets WHERE reset_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ============================================================================
-- PART 3: MIGRATION 004 — WEBHOOK SYSTEM
-- ============================================================================

-- ─── Webhook Endpoints Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  url TEXT NOT NULL
    CONSTRAINT webhook_endpoints_url_format
      CHECK (url ~* '^https?://'),
  description TEXT
    CONSTRAINT webhook_endpoints_description_length
      CHECK (description IS NULL OR char_length(description) <= 500),
  secret TEXT NOT NULL,
  enabled_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT webhook_endpoints_status_values
      CHECK (status IN ('active', 'disabled', 'failed')),
  failure_count INTEGER NOT NULL DEFAULT 0
    CONSTRAINT webhook_endpoints_failure_count_non_negative
      CHECK (failure_count >= 0),
  last_failure_at TIMESTAMP WITH TIME ZONE,
  last_success_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT webhook_endpoints_unique_url_per_app
    UNIQUE (application_id, url)
);

DROP TRIGGER IF EXISTS webhook_endpoints_set_updated_at ON webhook_endpoints;
CREATE TRIGGER webhook_endpoints_set_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_application_id ON webhook_endpoints(application_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(application_id, status) WHERE status = 'active';

-- ─── Webhook Events Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CONSTRAINT webhook_events_type_format
      CHECK (event_type ~* '^[a-z]+\.[a-z_]+$'),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT webhook_events_status_values
      CHECK (status IN ('pending', 'delivered', 'failed', 'cancelled')),
  attempt_count INTEGER NOT NULL DEFAULT 0
    CONSTRAINT webhook_events_attempt_count_non_negative
      CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_application_id ON webhook_events(application_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_payment_id ON webhook_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_pending ON webhook_events(next_attempt_at, status) WHERE status = 'pending' AND next_attempt_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(application_id, created_at DESC);

-- ─── Webhook Attempts Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_event_id UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL
    CONSTRAINT webhook_attempts_number_positive
      CHECK (attempt_number > 0),
  request_headers JSONB,
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_attempts_event_id ON webhook_attempts(webhook_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_attempts_endpoint_id ON webhook_attempts(webhook_endpoint_id);
CREATE INDEX IF NOT EXISTS idx_webhook_attempts_attempted_at ON webhook_attempts(attempted_at DESC);

-- ─── Webhook Functions ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_webhook_secret()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  secret TEXT;
BEGIN
  secret := encode(gen_random_bytes(32), 'base64');
  secret := replace(secret, '=', '');
  RETURN 'whsec_' || secret;
END;
$$;

CREATE OR REPLACE FUNCTION create_webhook_event(
  p_application_id UUID,
  p_event_type TEXT,
  p_payment_id UUID,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO webhook_events (
    application_id,
    event_type,
    payment_id,
    payload,
    status,
    next_attempt_at
  ) VALUES (
    p_application_id,
    p_event_type,
    p_payment_id,
    p_payload,
    'pending',
    NOW()
  )
  RETURNING id INTO event_id;

  RETURN event_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_active_webhook_endpoints(
  p_application_id UUID,
  p_event_type TEXT
)
RETURNS TABLE (
  endpoint_id UUID,
  url TEXT,
  secret TEXT,
  enabled_events JSONB
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id AS endpoint_id,
    we.url,
    we.secret,
    we.enabled_events
  FROM webhook_endpoints we
  WHERE we.application_id = p_application_id
    AND we.status = 'active'
    AND (
      jsonb_array_length(we.enabled_events) = 0
      OR
      we.enabled_events ? p_event_type
    );
END;
$$;

-- ─── Webhook RLS ────────────────────────────────────────────────────────────
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_endpoints_select_own" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_insert_own" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_update_own" ON webhook_endpoints;
DROP POLICY IF EXISTS "webhook_endpoints_delete_own" ON webhook_endpoints;

CREATE POLICY "webhook_endpoints_select_own" ON webhook_endpoints FOR SELECT
  USING (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

CREATE POLICY "webhook_endpoints_insert_own" ON webhook_endpoints FOR INSERT
  WITH CHECK (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

CREATE POLICY "webhook_endpoints_update_own" ON webhook_endpoints FOR UPDATE
  USING (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

CREATE POLICY "webhook_endpoints_delete_own" ON webhook_endpoints FOR DELETE
  USING (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "webhook_events_select_own" ON webhook_events;
CREATE POLICY "webhook_events_select_own" ON webhook_events FOR SELECT
  USING (application_id IN (SELECT id FROM applications WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "webhook_attempts_select_own" ON webhook_attempts;
CREATE POLICY "webhook_attempts_select_own" ON webhook_attempts FOR SELECT
  USING (webhook_event_id IN (SELECT id FROM webhook_events WHERE application_id IN (SELECT id FROM applications WHERE user_id = auth.uid())));

-- ============================================================================
-- PART 4: VERIFICATION QUERIES
-- ============================================================================

-- Run these queries AFTER applying the migration to verify success

-- Query 1: Check all tables created
SELECT 'Tables Created' as verification;
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('applications', 'api_keys', 'rate_limit_buckets', 'webhook_endpoints', 'webhook_events', 'webhook_attempts')
ORDER BY table_name;

-- Query 2: Check all functions created
SELECT 'Functions Created' as verification;
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('validate_api_key', 'get_application_payment_stats', 'check_rate_limit', 'cleanup_expired_rate_limits', 'generate_webhook_secret', 'create_webhook_event', 'get_active_webhook_endpoints')
ORDER BY routine_name;

-- Query 3: Test rate limit function
SELECT 'Rate Limit Test' as verification;
SELECT * FROM check_rate_limit('staging_test_key', 10, 60);

-- Query 4: Test webhook secret generation
SELECT 'Webhook Secret Test' as verification;
SELECT generate_webhook_secret() as secret;

-- Query 5: Check new columns on payments table
SELECT 'Payments Extensions Test' as verification;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payments' 
  AND column_name IN ('application_id', 'environment')
ORDER BY column_name;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Expected Results:
-- ✅ 6 tables created (applications, api_keys, rate_limit_buckets, webhook_endpoints, webhook_events, webhook_attempts)
-- ✅ 7 functions created (validate_api_key, get_application_payment_stats, check_rate_limit, cleanup_expired_rate_limits, generate_webhook_secret, create_webhook_event, get_active_webhook_endpoints)
-- ✅ Rate limit test returns (true, 9, ~60 seconds)
-- ✅ Webhook secret starts with 'whsec_'
-- ✅ Payments table has application_id and environment columns

-- Next Steps:
-- 1. Run: npx tsx scripts/verify-staging.ts
-- 2. Create test user in Supabase Auth dashboard
-- 3. Start dev server with staging credentials
-- 4. Begin E2E testing

-- For support or issues, check: PHASE_2.5_STAGING_DEPLOYMENT_STATUS.md
