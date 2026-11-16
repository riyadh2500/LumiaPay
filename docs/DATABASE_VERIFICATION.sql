-- ============================================================================
-- LUMIAPAY DATABASE VERIFICATION SCRIPT
-- ============================================================================
-- Run this in Supabase SQL Editor to verify migrations 002 and 004
-- DO NOT execute migrations - only verify if they were already applied
-- ============================================================================

-- 1. CHECK TABLES EXIST
SELECT 
    'applications' AS table_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'applications') AS exists
UNION ALL
SELECT 
    'api_keys',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys')
UNION ALL
SELECT 
    'webhook_endpoints',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_endpoints')
UNION ALL
SELECT 
    'webhook_events',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_events')
UNION ALL
SELECT 
    'webhook_attempts',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_attempts');

-- 2. CHECK NEW COLUMNS IN PAYMENTS TABLE
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'payments'
  AND column_name IN ('application_id', 'environment')
ORDER BY column_name;

-- 3. CHECK FUNCTIONS EXIST
SELECT 
    proname AS function_name,
    pg_get_function_identity_arguments(oid) AS arguments
FROM pg_proc
WHERE proname IN (
    'validate_api_key',
    'get_application_payment_stats',
    'update_updated_at_column',
    'generate_webhook_secret',
    'create_webhook_event',
    'get_active_webhook_endpoints'
)
ORDER BY proname;

-- 4. CHECK RLS POLICIES
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE tablename IN (
    'applications',
    'api_keys',
    'webhook_endpoints',
    'webhook_events',
    'webhook_attempts'
)
ORDER BY tablename, policyname;

-- 5. CHECK INDEXES
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'applications',
      'api_keys',
      'webhook_endpoints',
      'webhook_events',
      'webhook_attempts'
  )
ORDER BY tablename, indexname;

-- 6. VERIFY RLS ENABLED
SELECT 
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'applications',
      'api_keys',
      'webhook_endpoints',
      'webhook_events',
      'webhook_attempts'
  )
ORDER BY tablename;

-- 7. CHECK FOREIGN KEYS
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
      'applications',
      'api_keys',
      'webhook_endpoints',
      'webhook_events',
      'webhook_attempts'
  )
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- EXPECTED RESULTS IF MIGRATIONS ARE APPLIED:
-- 
-- 1. All 5 tables should show exists = true
-- 2. payments table should have application_id and environment columns (nullable)
-- 3. All 6 functions should be listed
-- 4. Multiple RLS policies for each table
-- 5. Multiple indexes for each table
-- 6. All tables should have rls_enabled = true
-- 7. Foreign keys properly configured
-- ============================================================================
