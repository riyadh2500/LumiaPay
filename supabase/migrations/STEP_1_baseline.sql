-- ============================================================================
-- STEP 1 OF 3 — Baseline Schema (merchants + payments)
-- Source: SUPABASE_SETUP.md
-- Run this first in Supabase SQL Editor.
-- ============================================================================

-- ── merchants ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchants (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  business_name  TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own merchant data"   ON merchants;
DROP POLICY IF EXISTS "Users can insert own merchant data" ON merchants;
DROP POLICY IF EXISTS "Users can update own merchant data" ON merchants;

CREATE POLICY "Users can view own merchant data"
  ON merchants FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own merchant data"
  ON merchants FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own merchant data"
  ON merchants FOR UPDATE USING (auth.uid() = user_id);

-- ── payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users NOT NULL,
  label          TEXT NOT NULL,
  amount         TEXT NOT NULL,
  currency       TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  tx_hash        TEXT,
  expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  paid_at        TIMESTAMP WITH TIME ZONE
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments"   ON payments;
DROP POLICY IF EXISTS "Users can create own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS payments_user_id_idx    ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx     ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at DESC);

-- ============================================================================
-- STEP 1 COMPLETE
-- Verify: SELECT table_name FROM information_schema.tables
--         WHERE table_schema = 'public' ORDER BY table_name;
-- Expected: merchants, payments
-- ============================================================================
