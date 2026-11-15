-- ============================================================================
-- LumiaPay Developer Infrastructure — ROLLBACK for Migration 002
-- Created: 2026-11-14
--
-- PURPOSE
--   Reverts every change made by 002_developer_infrastructure.sql in
--   reverse dependency order:
--     1. Remove RLS policies
--     2. Drop helper functions
--     3. Drop new indexes on existing tables
--     4. Remove new columns from existing tables
--     5. Drop new tables (api_keys before applications due to FK)
--
-- WHEN TO USE
--   • If migration 002 is applied and must be undone (e.g., test run gone wrong).
--   • NEVER run this in production unless explicitly approved.
--   • Running this deletes all developer application and API key data.
--
-- SAFETY
--   This script is idempotent where possible (uses IF EXISTS).
--   It does NOT touch any data in payments, payment_events, merchants, or
--   auth.users beyond removing the two nullable columns that were added.
--   Rows in payments that have application_id / environment set will lose
--   those values when the columns are dropped.
--
-- DATA IMPACT
--   HIGH — All rows in applications and api_keys will be permanently deleted.
--   The nullable columns application_id and environment on payments /
--   payment_events are dropped; any values stored there are lost.
--
-- ============================================================================


-- ============================================================================
-- STEP 1 — Remove RLS policies (must come before table drops)
-- ============================================================================

-- ── applications ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "applications_select_own" ON applications;
DROP POLICY IF EXISTS "applications_insert_own" ON applications;
DROP POLICY IF EXISTS "applications_update_own" ON applications;
DROP POLICY IF EXISTS "applications_delete_own" ON applications;

-- ── api_keys ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "api_keys_select_own"  ON api_keys;
DROP POLICY IF EXISTS "api_keys_insert_own"  ON api_keys;
DROP POLICY IF EXISTS "api_keys_update_own"  ON api_keys;
DROP POLICY IF EXISTS "api_keys_no_delete"   ON api_keys;


-- ============================================================================
-- STEP 2 — Drop functions
-- ============================================================================

DROP FUNCTION IF EXISTS validate_api_key(TEXT);
DROP FUNCTION IF EXISTS get_application_payment_stats(UUID);

-- Only drop update_updated_at_column if no other table uses it.
-- If it was introduced by another migration, comment out the next line.
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;


-- ============================================================================
-- STEP 3 — Remove indexes on existing tables (migration-002-specific only)
-- ============================================================================

DROP INDEX IF EXISTS idx_payments_application_id;
DROP INDEX IF EXISTS idx_payments_environment;
DROP INDEX IF EXISTS idx_payments_app_env_status;
DROP INDEX IF EXISTS idx_payments_app_created;
DROP INDEX IF EXISTS idx_payment_events_application_id;


-- ============================================================================
-- STEP 4 — Remove columns added to existing tables
-- ============================================================================

-- payments.application_id  (nullable — no data loss beyond the FK value)
ALTER TABLE payments DROP COLUMN IF EXISTS application_id;

-- payments.environment  (nullable — no data loss beyond the flag value)
ALTER TABLE payments DROP COLUMN IF EXISTS environment;

-- payment_events.application_id
ALTER TABLE payment_events DROP COLUMN IF EXISTS application_id;


-- ============================================================================
-- STEP 5 — Drop new tables in FK-dependency order
-- ============================================================================

-- api_keys references applications — must be dropped first
DROP TABLE IF EXISTS api_keys;

-- applications references auth.users — safe to drop after api_keys
DROP TABLE IF EXISTS applications;


-- ============================================================================
-- END OF ROLLBACK FOR MIGRATION 002
-- ============================================================================
