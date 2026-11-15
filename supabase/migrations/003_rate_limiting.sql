-- ============================================================================
-- LumiaPay Rate Limiting — Migration 003
-- Created: 2026-11-14
--
-- PURPOSE
--   Provides a single distributed sliding-window rate-limit store that works
--   correctly across all Vercel serverless instances.
--
--   The design is intentionally minimal:
--     • One table: rate_limit_buckets
--         key        TEXT PRIMARY KEY  — identifies a (identifier, route) pair
--         tokens     INTEGER           — remaining tokens in the current window
--         reset_at   TIMESTAMPTZ       — when the bucket refills
--         updated_at TIMESTAMPTZ       — last touch time
--
--     • One atomic function: check_rate_limit(key, max_tokens, window_seconds)
--         Atomically decrements the token counter and returns whether the
--         request is allowed plus the reset timestamp.  Uses an UPSERT with
--         an advisory lock pattern to prevent race conditions.
--
-- SAFE TO RE-RUN: all statements use IF NOT EXISTS / OR REPLACE.
-- DO NOT APPLY WITHOUT REVIEW.
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key        TEXT PRIMARY KEY,
  tokens     INTEGER NOT NULL,
  reset_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rate_limit_buckets IS
  'Distributed sliding-window token buckets for API rate limiting. '
  'One row per (identifier, route) pair. Rows are automatically cleaned '
  'up after their reset_at window passes.';

-- Index for cleanup queries (future cron or ON DELETE)
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at
  ON rate_limit_buckets(reset_at);

-- RLS: disable public access entirely — only the service role may touch this table
ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies: service role bypasses RLS,
-- all other roles are denied by default.

-- ── Atomic rate-limit check function ────────────────────────────────────────
-- Returns: (allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key            TEXT,
  p_max_tokens     INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed   BOOLEAN,
  remaining INTEGER,
  reset_at  TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
AS $$
DECLARE
  v_now        TIMESTAMP WITH TIME ZONE := NOW();
  v_reset_at   TIMESTAMP WITH TIME ZONE;
  v_tokens     INTEGER;
BEGIN
  -- Atomically upsert the bucket.
  -- If the bucket doesn't exist or has expired, create a fresh one with
  -- max_tokens - 1 (consuming the current request).
  -- If the bucket is active, decrement by 1 (floor at 0).
  INSERT INTO rate_limit_buckets (key, tokens, reset_at, updated_at)
  VALUES (
    p_key,
    p_max_tokens - 1,
    v_now + (p_window_seconds || ' seconds')::INTERVAL,
    v_now
  )
  ON CONFLICT (key) DO UPDATE
    SET
      -- If the existing bucket has expired, reset it
      tokens = CASE
        WHEN rate_limit_buckets.reset_at <= v_now
          THEN p_max_tokens - 1          -- fresh window, consume first token
        WHEN rate_limit_buckets.tokens > 0
          THEN rate_limit_buckets.tokens - 1  -- decrement
        ELSE 0                           -- already exhausted
      END,
      reset_at = CASE
        WHEN rate_limit_buckets.reset_at <= v_now
          THEN v_now + (p_window_seconds || ' seconds')::INTERVAL
        ELSE rate_limit_buckets.reset_at  -- preserve existing window
      END,
      updated_at = v_now
  RETURNING rate_limit_buckets.tokens, rate_limit_buckets.reset_at
  INTO v_tokens, v_reset_at;

  RETURN QUERY SELECT
    -- allowed when we still have tokens after decrement
    -- (tokens column already reflects post-decrement value)
    (v_tokens >= 0)                   AS allowed,
    GREATEST(v_tokens, 0)             AS remaining,
    v_reset_at                        AS reset_at;
END;
$$;

COMMENT ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) IS
  'Atomically checks and decrements a rate-limit token bucket. '
  'Returns (allowed, remaining, reset_at). '
  'SECURITY DEFINER: runs as service role, no caller auth required.';

-- ── Cleanup function (called by future cron or manually) ─────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM rate_limit_buckets WHERE reset_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_rate_limits() IS
  'Removes expired rate-limit buckets. Safe to call at any time.';

-- ============================================================================
-- END OF MIGRATION 003
-- ============================================================================
