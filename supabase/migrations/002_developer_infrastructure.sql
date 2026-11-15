-- ============================================================================
-- LumiaPay Developer Infrastructure — Migration 002
-- Created: 2026-11-14
--
-- PURPOSE
--   Adds the foundation tables that power the developer API:
--     • applications     — developer apps owned by merchants
--     • api_keys         — hashed API keys for each application
--
--   Also adds minimal columns to existing tables (application_id,
--   environment) so the Payment Engine can track which app originated
--   a payment.  Every new column is NULLABLE so existing rows stay valid
--   and all existing application code continues to work without change.
--
-- DEPENDENCIES
--   Must be applied AFTER migration 001 (which creates payments and
--   payment_events).  The merchants table must also exist.
--
-- SAFE TO RE-RUN?
--   Yes — every DDL statement uses IF NOT EXISTS / OR REPLACE so this
--   script is idempotent.
--
-- DO NOT EXECUTE IN PRODUCTION
--   Per project rules this file must be reviewed and applied manually
--   by a human operator.  Running it here would violate the strict rules.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — HELPER UTILITIES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1.1  update_updated_at_column()
--      Trigger function used by both new tables to auto-stamp updated_at.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column() IS
  'Generic trigger function: sets updated_at = NOW() before UPDATE.';


-- ============================================================================
-- SECTION 2 — applications TABLE
-- ============================================================================
-- One row per developer application.  An application belongs to exactly one
-- merchant (auth.users row).  Each application has a declared environment
-- (test | live) which controls whether its API keys interact with the real
-- Arc blockchain or the sandbox simulator.
-- ============================================================================

CREATE TABLE IF NOT EXISTS applications (

  -- ── Identity ───────────────────────────────────────────────────────────
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Ownership ──────────────────────────────────────────────────────────
  -- Every application is owned by exactly one Supabase auth user (the
  -- merchant).  Deleting a user cascades to their applications.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ── Application metadata ───────────────────────────────────────────────
  name        TEXT NOT NULL
              CONSTRAINT applications_name_length
                CHECK (char_length(name) BETWEEN 3 AND 100),

  description TEXT
              CONSTRAINT applications_description_length
                CHECK (description IS NULL OR char_length(description) <= 500),

  -- ── Environment isolation (CRITICAL) ───────────────────────────────────
  -- Determines whether this application may execute real blockchain
  -- transactions.  This value is immutable after creation; switching
  -- environment creates a new application record.
  environment TEXT NOT NULL DEFAULT 'test'
              CONSTRAINT applications_environment_values
                CHECK (environment IN ('test', 'live')),

  -- ── Lifecycle status ───────────────────────────────────────────────────
  status TEXT NOT NULL DEFAULT 'active'
         CONSTRAINT applications_status_values
           CHECK (status IN ('active', 'suspended', 'deleted')),

  -- ── Usage tracking ─────────────────────────────────────────────────────
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- ── Timestamps ─────────────────────────────────────────────────────────
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- ── Uniqueness ─────────────────────────────────────────────────────────
  -- A merchant cannot have two applications with the same name in the
  -- same environment.  Different environments may share a name because
  -- e.g. "My Store (test)" and "My Store (live)" are distinct rows.
  CONSTRAINT applications_unique_name_per_user_env
    UNIQUE (user_id, name, environment)

);

COMMENT ON TABLE applications IS
  'Developer applications created by merchants.  Each application has an '
  'environment (test|live) that strictly controls whether real blockchain '
  'transactions are permitted.';

COMMENT ON COLUMN applications.environment IS
  'CRITICAL: test applications never touch the Arc blockchain.  '
  'live applications use real USDC/EURC transfers.  '
  'This column is immutable after creation.';

COMMENT ON COLUMN applications.user_id IS
  'The auth.users.id of the merchant who owns this application.';

-- ── Triggers ───────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS applications_set_updated_at ON applications;
CREATE TRIGGER applications_set_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Lookup all apps belonging to a user (dashboard list)
CREATE INDEX IF NOT EXISTS idx_applications_user_id
  ON applications(user_id);

-- Filter active apps only (most queries ignore deleted/suspended)
CREATE INDEX IF NOT EXISTS idx_applications_active
  ON applications(user_id, status)
  WHERE status = 'active';

-- Environment queries
CREATE INDEX IF NOT EXISTS idx_applications_environment
  ON applications(environment);

-- Composite covering index for the common dashboard query:
--   WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_applications_user_active_created
  ON applications(user_id, created_at DESC)
  WHERE status = 'active';


-- ============================================================================
-- SECTION 3 — api_keys TABLE
-- ============================================================================
-- One row per API key.  Keys belong to an application.  The plaintext
-- secret is NEVER stored; only a SHA-256 hex digest (key_hash) is kept.
-- The human-readable prefix (first ~15 chars + "…") is stored for display.
--
-- Key type determines permissions:
--   publishable  → safe for client-side use, read-only operations only
--   secret       → server-side use, full write access — must NEVER be exposed
--
-- The environment is derived from the parent application and enforced by
-- application-level code; it is not stored here to avoid drift.
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (

  -- ── Identity ───────────────────────────────────────────────────────────
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ── Ownership ──────────────────────────────────────────────────────────
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

  -- ── Key metadata ───────────────────────────────────────────────────────
  name     TEXT NOT NULL
           CONSTRAINT api_keys_name_length
             CHECK (char_length(name) BETWEEN 1 AND 100),

  key_type TEXT NOT NULL
           CONSTRAINT api_keys_type_values
             CHECK (key_type IN ('publishable', 'secret')),

  -- ── Hashed key (SECURITY-CRITICAL) ─────────────────────────────────────
  -- The full plaintext API key is shown to the user exactly once upon
  -- creation and is NEVER persisted.  Only the SHA-256 hex digest is
  -- stored here so that compromising this table does not expose usable keys.
  key_hash   TEXT NOT NULL,

  -- Short display string stored for UI purposes (e.g. "sk_test_abc123…").
  -- Contains no secret material.
  key_prefix TEXT NOT NULL,

  -- ── Permissions ────────────────────────────────────────────────────────
  -- JSON object describing which API resources this key can access.
  -- Default grants read+write to payments and webhooks.
  permissions JSONB NOT NULL DEFAULT '{"payments":["read","write"],"webhooks":["read","write"]}'::jsonb,

  -- ── Lifecycle status ───────────────────────────────────────────────────
  status TEXT NOT NULL DEFAULT 'active'
         CONSTRAINT api_keys_status_values
           CHECK (status IN ('active', 'revoked', 'expired')),

  -- ── Usage tracking ─────────────────────────────────────────────────────
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count  BIGINT NOT NULL DEFAULT 0
               CONSTRAINT api_keys_usage_count_non_negative
                 CHECK (usage_count >= 0),

  -- ── Optional expiration ────────────────────────────────────────────────
  expires_at TIMESTAMP WITH TIME ZONE
             CONSTRAINT api_keys_valid_expiration
               CHECK (expires_at IS NULL OR expires_at > created_at),

  -- ── Revocation audit ───────────────────────────────────────────────────
  revoked_at     TIMESTAMP WITH TIME ZONE,
  revoked_reason TEXT
                 CONSTRAINT api_keys_revoked_reason_length
                   CHECK (revoked_reason IS NULL OR char_length(revoked_reason) <= 500),

  -- ── Timestamps ─────────────────────────────────────────────────────────
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- ── Uniqueness ─────────────────────────────────────────────────────────
  -- The hash must be globally unique; two keys cannot hash to the same value.
  CONSTRAINT api_keys_unique_hash UNIQUE (key_hash)

);

COMMENT ON TABLE api_keys IS
  'Hashed API keys for developer applications.  '
  'Plaintext keys are NEVER stored.  key_hash is a SHA-256 hex digest.';

COMMENT ON COLUMN api_keys.key_hash IS
  'SHA-256(plaintext_key) stored as lowercase hex.  '
  'The plaintext key is shown to the user exactly once and then discarded.';

COMMENT ON COLUMN api_keys.key_prefix IS
  'Non-secret display string for the UI, e.g. "sk_test_abc123...".  '
  'Contains no secret material.';

COMMENT ON COLUMN api_keys.key_type IS
  'publishable: safe for client-side code, read-only operations.  '
  'secret: server-side only, never expose to browsers or clients.';

COMMENT ON COLUMN api_keys.permissions IS
  'JSON object controlling which API scopes this key may access.  '
  'Example: {"payments":["read","write"],"webhooks":["read"]}';

-- ── Indexes ────────────────────────────────────────────────────────────────
-- Primary lookup by hash during authentication (hot path)
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active
  ON api_keys(key_hash)
  WHERE status = 'active';

-- All keys for an application (management UI)
CREATE INDEX IF NOT EXISTS idx_api_keys_application_id
  ON api_keys(application_id);

-- Active keys per application
CREATE INDEX IF NOT EXISTS idx_api_keys_application_active
  ON api_keys(application_id, status)
  WHERE status = 'active';

-- Expiry sweep (future cron job)
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at
  ON api_keys(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;


-- ============================================================================
-- SECTION 4 — EXTEND EXISTING TABLES (backward-compatible, additive only)
-- ============================================================================
-- Payments and payment_events gain two optional nullable columns:
--   application_id  — links the row to the developer app that created it
--   environment     — mirrors the app's environment for fast filter queries
--
-- NULL in either column means the row was created by the merchant dashboard
-- (session-authenticated), not via a developer API key.  All existing code
-- that does not set these columns continues to work unchanged.
-- ============================================================================

-- ── 4.1  payments.application_id ───────────────────────────────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES applications(id) ON DELETE SET NULL;

COMMENT ON COLUMN payments.application_id IS
  'The developer application that created this payment via the API.  '
  'NULL for payments created through the merchant dashboard.';

-- ── 4.2  payments.environment ──────────────────────────────────────────────
-- Denormalised copy of applications.environment for fast query filtering.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS environment TEXT
    CONSTRAINT payments_environment_values
      CHECK (environment IS NULL OR environment IN ('test', 'live'));

COMMENT ON COLUMN payments.environment IS
  'Denormalised from applications.environment.  '
  'test: simulated payment (no blockchain).  '
  'live: real Arc transaction.  '
  'NULL: created via merchant dashboard (backward-compat).';

-- ── 4.3  payment_events.application_id ─────────────────────────────────────
ALTER TABLE payment_events
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES applications(id) ON DELETE SET NULL;

COMMENT ON COLUMN payment_events.application_id IS
  'The developer application associated with this event.  '
  'NULL for events from dashboard-created payments.';

-- ── Indexes on extended columns ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_application_id
  ON payments(application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_environment
  ON payments(environment)
  WHERE environment IS NOT NULL;

-- Composite index for the developer API's most common query:
-- payments by application filtered by environment and status
CREATE INDEX IF NOT EXISTS idx_payments_app_env_status
  ON payments(application_id, environment, status)
  WHERE application_id IS NOT NULL;

-- Composite index for created_at ordering within an application
CREATE INDEX IF NOT EXISTS idx_payments_app_created
  ON payments(application_id, created_at DESC)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_events_application_id
  ON payment_events(application_id)
  WHERE application_id IS NOT NULL;


-- ============================================================================
-- SECTION 5 — ROW LEVEL SECURITY
-- ============================================================================
-- RLS enforces ownership at the database layer as a defence-in-depth
-- measure.  Application code (admin client) also validates ownership
-- explicitly and is the primary enforcement mechanism.
-- ============================================================================

-- ── 5.1  applications ──────────────────────────────────────────────────────
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before (re-)creating them so this script is
-- idempotent.
DROP POLICY IF EXISTS "applications_select_own"   ON applications;
DROP POLICY IF EXISTS "applications_insert_own"   ON applications;
DROP POLICY IF EXISTS "applications_update_own"   ON applications;
DROP POLICY IF EXISTS "applications_delete_own"   ON applications;

-- Merchants can view their own applications
CREATE POLICY "applications_select_own"
  ON applications FOR SELECT
  USING (user_id = auth.uid());

-- Merchants can create applications for themselves only
CREATE POLICY "applications_insert_own"
  ON applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Merchants can update their own applications
-- (status changes, name changes, etc.)
CREATE POLICY "applications_update_own"
  ON applications FOR UPDATE
  USING (user_id = auth.uid());

-- Hard deletes are restricted — application code uses status='deleted'
-- (soft-delete) instead.  We allow it here for admin tooling but expect
-- it to be blocked by application-level guards in normal usage.
CREATE POLICY "applications_delete_own"
  ON applications FOR DELETE
  USING (user_id = auth.uid());


-- ── 5.2  api_keys ──────────────────────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select_own"   ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert_own"   ON api_keys;
DROP POLICY IF EXISTS "api_keys_update_own"   ON api_keys;
-- Hard-delete disabled: keys should only be revoked (status update)
DROP POLICY IF EXISTS "api_keys_no_delete"    ON api_keys;

-- Merchants can view keys belonging to their own applications
CREATE POLICY "api_keys_select_own"
  ON api_keys FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- Merchants can create keys for their own applications
CREATE POLICY "api_keys_insert_own"
  ON api_keys FOR INSERT
  WITH CHECK (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- Merchants can update keys belonging to their own applications
-- (revoke, rename, usage counter updates)
CREATE POLICY "api_keys_update_own"
  ON api_keys FOR UPDATE
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- Prevent hard-deletes through the RLS user role.
-- Keys are revoked (status='revoked'), never hard-deleted.
CREATE POLICY "api_keys_no_delete"
  ON api_keys FOR DELETE
  USING (false);


-- ============================================================================
-- SECTION 6 — SECURE DATABASE FUNCTIONS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 6.1  validate_api_key(key_hash_param TEXT)
--
--      Called by application code to authenticate an incoming API request.
--      Accepts the SHA-256 hash of the key provided by the caller and
--      returns the application context required to process the request.
--
--      Returns zero rows when:
--        • The hash does not exist in api_keys
--        • The key status is not 'active'
--        • The owning application status is not 'active'
--        • The key has an expires_at that is in the past
--
--      SECURITY DEFINER lets this run as the defining user (service role)
--      so it can bypass RLS when doing the hash lookup — without exposing
--      the service-role key to callers.  The function only returns the
--      minimal context needed; it never returns the hash itself.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION validate_api_key(key_hash_param TEXT)
RETURNS TABLE (
  key_id         UUID,
  application_id UUID,
  user_id        UUID,
  key_type       TEXT,
  environment    TEXT,
  permissions    JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id          AS key_id,
    a.id          AS application_id,
    a.user_id     AS user_id,
    k.key_type    AS key_type,
    a.environment AS environment,
    k.permissions AS permissions
  FROM api_keys k
  JOIN applications a ON a.id = k.application_id
  WHERE k.key_hash  = key_hash_param
    AND k.status    = 'active'
    AND a.status    = 'active'
    AND (k.expires_at IS NULL OR k.expires_at > NOW());
END;
$$;

COMMENT ON FUNCTION validate_api_key(TEXT) IS
  'Authenticates a developer API request.  '
  'Accepts SHA-256(plaintext_key) and returns the minimal context needed '
  'to authorise the request.  Returns 0 rows on any authentication failure.  '
  'SECURITY DEFINER: runs as the defining role to bypass RLS on the lookup.';


-- ---------------------------------------------------------------------------
-- 6.2  get_application_payment_stats(application_id_param UUID)
--
--      Convenience aggregate used by the developer analytics endpoints.
--      Returns payment counts and total paid amount for an application.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_application_payment_stats(
  application_id_param UUID
)
RETURNS TABLE (
  total_payments   BIGINT,
  paid_payments    BIGINT,
  failed_payments  BIGINT,
  expired_payments BIGINT,
  pending_payments BIGINT,
  total_amount_paid NUMERIC,
  success_rate     NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT                                                  AS total_payments,
    COUNT(*) FILTER (WHERE status = 'paid')::BIGINT                   AS paid_payments,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT                 AS failed_payments,
    COUNT(*) FILTER (WHERE status = 'expired')::BIGINT                AS expired_payments,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT                AS pending_payments,
    COALESCE(
      SUM(CAST(amount AS NUMERIC)) FILTER (WHERE status = 'paid'),
      0
    )                                                                 AS total_amount_paid,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND(
        COUNT(*) FILTER (WHERE status = 'paid')::NUMERIC / COUNT(*)::NUMERIC * 100,
        2
      )
      ELSE 0
    END                                                               AS success_rate
  FROM payments
  WHERE application_id = application_id_param;
END;
$$;

COMMENT ON FUNCTION get_application_payment_stats(UUID) IS
  'Returns aggregated payment statistics for a developer application.';


-- ============================================================================
-- SECTION 7 — COMMENTS ON RELATIONSHIPS
-- ============================================================================

COMMENT ON CONSTRAINT "api_keys_unique_hash" ON api_keys IS
  'Guarantees that two different plaintext keys cannot produce the same '
  'SHA-256 digest in this table.  Collision probability with 32-byte random '
  'keys and SHA-256 is negligible (< 2^-128).';

COMMENT ON CONSTRAINT "applications_unique_name_per_user_env" ON applications IS
  'Prevents a merchant from registering two applications with the same name '
  'in the same environment.  Allows the same name in test vs live.';


-- ============================================================================
-- END OF MIGRATION 002
-- ============================================================================
