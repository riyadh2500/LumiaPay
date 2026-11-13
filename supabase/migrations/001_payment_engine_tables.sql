-- ============================================================================
-- LumiaPay Payment Engine - Database Migration 001
-- Created: 2025-01-13
-- Description: Adds tables and constraints for the Central Payment Engine
-- ============================================================================

-- ─── Payment Transactions Table ─────────────────────────────────────────────
-- Tracks verified blockchain transactions to prevent double-spending

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tx_hash TEXT NOT NULL,
  verified_amount TEXT NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Ensure one transaction can only be used once
  CONSTRAINT unique_tx_hash UNIQUE (tx_hash)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id 
  ON payment_transactions(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tx_hash 
  ON payment_transactions(tx_hash);

-- ─── Payment Events Table ────────────────────────────────────────────────────
-- Tracks payment lifecycle events for audit trails and webhooks

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

-- Create indexes for event queries
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
-- Add new columns for enhanced payment tracking

ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS verified_amount TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create additional indexes on payments table
CREATE INDEX IF NOT EXISTS idx_payments_status 
  ON payments(status);

CREATE INDEX IF NOT EXISTS idx_payments_expires_at 
  ON payments(expires_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payments_user_created 
  ON payments(user_id, created_at DESC);

-- ─── Row Level Security Policies ─────────────────────────────────────────────

-- Payment Transactions RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Payment Events RLS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment events"
  ON payment_events FOR SELECT
  USING (user_id = auth.uid());

-- ─── Helper Functions ────────────────────────────────────────────────────────

-- Function to check if a transaction hash is already used
CREATE OR REPLACE FUNCTION is_transaction_used(tx_hash_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM payment_transactions WHERE tx_hash = tx_hash_param
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get payment statistics
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

-- ============================================================================
-- End of Migration 001
-- ============================================================================
