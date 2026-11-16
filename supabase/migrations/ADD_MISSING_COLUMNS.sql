-- ============================================================================
-- Add Missing Payment Engine Columns
-- Run this in Supabase SQL Editor (Production Database)
-- ============================================================================

-- Add missing columns to payments table
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS payment_address TEXT,
  ADD COLUMN IF NOT EXISTS network TEXT,
  ADD COLUMN IF NOT EXISTS verified_amount TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Set default values for existing rows
UPDATE payments 
SET 
  payment_address = wallet_address,
  network = 'arc-testnet',
  metadata = '{}'::jsonb
WHERE payment_address IS NULL OR network IS NULL OR metadata IS NULL;

-- Make required columns NOT NULL
ALTER TABLE payments 
  ALTER COLUMN payment_address SET NOT NULL,
  ALTER COLUMN network SET NOT NULL,
  ALTER COLUMN metadata SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

-- Create payment_transactions table if not exists
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id 
  ON payment_transactions(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tx_hash 
  ON payment_transactions(tx_hash);

-- Enable RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment transactions" ON payment_transactions;

CREATE POLICY "Users can view own payment transactions"
  ON payment_transactions FOR SELECT
  USING (
    payment_id IN (
      SELECT id FROM payments WHERE user_id = auth.uid()
    )
  );

-- Create payment_events table if not exists
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_events_payment_id 
  ON payment_events(payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id 
  ON payment_events(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_created_at 
  ON payment_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_events_unprocessed 
  ON payment_events(processed, created_at) 
  WHERE processed = FALSE;

-- Enable RLS
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment events" ON payment_events;

CREATE POLICY "Users can view own payment events"
  ON payment_events FOR SELECT
  USING (user_id = auth.uid());

-- Add email column to merchants if missing
ALTER TABLE merchants 
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Update email from auth.users for existing merchants
UPDATE merchants m
SET email = u.email
FROM auth.users u
WHERE m.user_id = u.id AND m.email IS NULL;

-- Make email NOT NULL after populating
ALTER TABLE merchants 
  ALTER COLUMN email SET NOT NULL;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check payments table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payments'
ORDER BY ordinal_position;

-- Check merchants table structure  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'merchants'
ORDER BY ordinal_position;

-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

