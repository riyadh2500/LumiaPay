-- ============================================================================
-- LumiaPay Complete Database Setup (FIXED)
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ─── 1. MERCHANTS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchants (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  email          TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  business_name  TEXT,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own merchant data" ON merchants;
DROP POLICY IF EXISTS "Users can insert own merchant data" ON merchants;
DROP POLICY IF EXISTS "Users can update own merchant data" ON merchants;

CREATE POLICY "Users can view own merchant data"
  ON merchants FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own merchant data"
  ON merchants FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own merchant data"
  ON merchants FOR UPDATE USING (auth.uid() = user_id);

-- ─── 2. PAYMENTS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users(id) NOT NULL,
  label            TEXT NOT NULL,
  amount           TEXT NOT NULL,
  currency         TEXT NOT NULL,
  wallet_address   TEXT NOT NULL,
  payment_address  TEXT NOT NULL,
  network          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  tx_hash          TEXT,
  verified_amount  TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at       TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  paid_at          TIMESTAMP WITH TIME ZONE,
  
  -- Developer API fields
  application_id   UUID,
  environment      TEXT
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Users can create own payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;

CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments"
  ON payments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS payments_expires_at_idx ON payments(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS payments_application_id_idx ON payments(application_id);

-- ─── 3. PAYMENT TRANSACTIONS TABLE ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL,
  verified_amount TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_tx_hash UNIQUE (tx_hash)
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_tx_hash ON payment_transactions(tx_hash);

-- ─── 4. PAYMENT EVENTS TABLE ────────────────────────────────────────────────
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

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment events" ON payment_events;

CREATE POLICY "Users can view own payment events"
  ON payment_events FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_unprocessed ON payment_events(processed, created_at) WHERE processed = FALSE;

-- ─── 5. DEVELOPER APPLICATIONS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS developer_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE developer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own applications" ON developer_applications;
DROP POLICY IF EXISTS "Users can create own applications" ON developer_applications;
DROP POLICY IF EXISTS "Users can update own applications" ON developer_applications;

CREATE POLICY "Users can view own applications"
  ON developer_applications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own applications"
  ON developer_applications FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
  ON developer_applications FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS developer_applications_user_id_idx ON developer_applications(user_id);

-- ─── 6. API KEYS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES developer_applications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL,
  name TEXT,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can create own api keys" ON api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON api_keys;

CREATE POLICY "Users can view own api keys"
  ON api_keys FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own api keys"
  ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
  ON api_keys FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS api_keys_application_id_idx ON api_keys(application_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);

-- ─── 7. WEBHOOKS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES developer_applications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can create own webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can update own webhooks" ON webhooks;

CREATE POLICY "Users can view own webhooks"
  ON webhooks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own webhooks"
  ON webhooks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own webhooks"
  ON webhooks FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS webhooks_application_id_idx ON webhooks(application_id);
CREATE INDEX IF NOT EXISTS webhooks_user_id_idx ON webhooks(user_id);

-- ─── 8. HELPER FUNCTIONS ────────────────────────────────────────────────────

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

-- ============================================================================
-- COMPLETE! 
-- ============================================================================
