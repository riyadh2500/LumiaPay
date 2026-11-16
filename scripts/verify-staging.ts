/**
 * LumiaPay Staging Environment Verification Script
 * 
 * Verifies that all Phase 2 migrations are correctly applied and working
 * in the staging environment.
 * 
 * Run with: npx tsx scripts/verify-staging.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// Load staging environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('   Make sure .env.staging is loaded');
  process.exit(1);
}

// Create Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.name}`);
  console.log(`   ${result.message}`);
  if (result.details) {
    console.log('   Details:', JSON.stringify(result.details, null, 2));
  }
  console.log('');
  results.push(result);
}

async function verifyTables() {
  console.log('\n📋 PHASE 1: Database Tables Verification\n');

  const requiredTables = [
    'payments',
    'merchants',
    'payment_transactions',
    'payment_events',
    'applications',
    'api_keys',
    'rate_limit_buckets',
    'webhook_endpoints',
    'webhook_events',
    'webhook_attempts'
  ];

  try {
    // Query information_schema to get all tables
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `
    });

    if (error) {
      // Fallback: Try to query each table individually
      const foundTables: string[] = [];
      for (const table of requiredTables) {
        try {
          const { error: tableError } = await supabase.from(table).select('count').limit(0);
          if (!tableError) {
            foundTables.push(table);
          }
        } catch {}
      }

      logTest({
        name: 'Database Tables',
        status: foundTables.length === requiredTables.length ? 'PASS' : 'FAIL',
        message: `Found ${foundTables.length}/${requiredTables.length} required tables`,
        details: { found: foundTables, required: requiredTables }
      });
      return;
    }

    const existingTables = data.map((row: any) => row.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length === 0) {
      logTest({
        name: 'Database Tables',
        status: 'PASS',
        message: `All ${requiredTables.length} required tables exist`,
        details: { tables: existingTables }
      });
    } else {
      logTest({
        name: 'Database Tables',
        status: 'FAIL',
        message: `Missing ${missingTables.length} tables`,
        details: { missing: missingTables }
      });
    }
  } catch (error: any) {
    logTest({
      name: 'Database Tables',
      status: 'FAIL',
      message: `Error verifying tables: ${error.message}`
    });
  }
}

async function verifyFunctions() {
  console.log('\n⚙️ PHASE 2: Database Functions Verification\n');

  const requiredFunctions = [
    'validate_api_key',
    'get_application_payment_stats',
    'check_rate_limit',
    'cleanup_expired_rate_limits',
    'generate_webhook_secret',
    'create_webhook_event',
    'get_active_webhook_endpoints',
    'is_transaction_used',
    'get_payment_stats'
  ];

  const functionTests = [
    {
      name: 'validate_api_key()',
      test: async () => {
        const { data, error } = await supabase.rpc('validate_api_key', {
          key_hash_param: 'nonexistent_hash_test'
        });
        return { success: !error && Array.isArray(data) && data.length === 0 };
      }
    },
    {
      name: 'check_rate_limit()',
      test: async () => {
        const { data, error } = await supabase.rpc('check_rate_limit', {
          p_key: 'test_staging_key',
          p_max_tokens: 10,
          p_window_seconds: 60
        });
        return { 
          success: !error && data && data.allowed === true,
          details: data
        };
      }
    },
    {
      name: 'generate_webhook_secret()',
      test: async () => {
        const { data, error } = await supabase.rpc('generate_webhook_secret');
        return { 
          success: !error && typeof data === 'string' && data.startsWith('whsec_'),
          details: { format: data?.substring(0, 10) + '...' }
        };
      }
    }
  ];

  for (const fnTest of functionTests) {
    try {
      const result = await fnTest.test();
      logTest({
        name: `Function: ${fnTest.name}`,
        status: result.success ? 'PASS' : 'FAIL',
        message: result.success 
          ? `Function works correctly`
          : `Function failed or returned unexpected result`,
        details: result.details
      });
    } catch (error: any) {
      logTest({
        name: `Function: ${fnTest.name}`,
        status: 'FAIL',
        message: `Error testing function: ${error.message}`
      });
    }
  }
}

async function verifyMigration002() {
  console.log('\n🔧 PHASE 3: Migration 002 (Developer Infrastructure) Verification\n');

  // Test 1: Applications table structure
  try {
    const { data: apps, error } = await supabase
      .from('applications')
      .select('*')
      .limit(1);

    logTest({
      name: 'Applications Table',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'Applications table accessible and properly structured'
        : `Error accessing applications table: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Applications Table',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }

  // Test 2: API Keys table structure
  try {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*')
      .limit(1);

    logTest({
      name: 'API Keys Table',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'API keys table accessible and properly structured'
        : `Error accessing api_keys table: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'API Keys Table',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }

  // Test 3: New columns on payments table
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, application_id, environment')
      .limit(1);

    logTest({
      name: 'Payments Table Extensions',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'New columns (application_id, environment) exist on payments table'
        : `Error accessing new columns: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Payments Table Extensions',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }
}

async function verifyMigration003() {
  console.log('\n⏱️ PHASE 4: Migration 003 (Rate Limiting) Verification\n');

  // Test 1: Rate limit buckets table
  try {
    const { data, error } = await supabase
      .from('rate_limit_buckets')
      .select('*')
      .limit(1);

    logTest({
      name: 'Rate Limit Buckets Table',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'Rate limit buckets table accessible'
        : `Error accessing rate_limit_buckets: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Rate Limit Buckets Table',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }

  // Test 2: Rate limiting logic
  try {
    const testKey = `staging_test_${Date.now()}`;
    
    // First request should succeed
    const { data: first, error: error1 } = await supabase.rpc('check_rate_limit', {
      p_key: testKey,
      p_max_tokens: 5,
      p_window_seconds: 60
    });

    // Make 5 more requests (should exhaust tokens)
    for (let i = 0; i < 5; i++) {
      await supabase.rpc('check_rate_limit', {
        p_key: testKey,
        p_max_tokens: 5,
        p_window_seconds: 60
      });
    }

    // Next request should be denied
    const { data: denied, error: error2 } = await supabase.rpc('check_rate_limit', {
      p_key: testKey,
      p_max_tokens: 5,
      p_window_seconds: 60
    });

    const success = !error1 && first?.allowed === true && 
                   !error2 && denied?.allowed === false;

    logTest({
      name: 'Rate Limiting Logic',
      status: success ? 'PASS' : 'FAIL',
      message: success 
        ? 'Rate limiting correctly allows and denies requests'
        : 'Rate limiting logic not working as expected',
      details: {
        first_request: first,
        after_exhaustion: denied
      }
    });
  } catch (error: any) {
    logTest({
      name: 'Rate Limiting Logic',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }
}

async function verifyMigration004() {
  console.log('\n🪝 PHASE 5: Migration 004 (Webhook System) Verification\n');

  // Test 1: Webhook endpoints table
  try {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .limit(1);

    logTest({
      name: 'Webhook Endpoints Table',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'Webhook endpoints table accessible'
        : `Error accessing webhook_endpoints: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Webhook Endpoints Table',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }

  // Test 2: Webhook events table
  try {
    const { data, error } = await supabase
      .from('webhook_events')
      .select('*')
      .limit(1);

    logTest({
      name: 'Webhook Events Table',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'Webhook events table accessible'
        : `Error accessing webhook_events: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Webhook Events Table',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }

  // Test 3: Webhook attempts table
  try {
    const { data, error } = await supabase
      .from('webhook_attempts')
      .select('*')
      .limit(1);

    logTest({
      name: 'Webhook Attempts Table',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'Webhook attempts table accessible'
        : `Error accessing webhook_attempts: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Webhook Attempts Table',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }

  // Test 4: Webhook secret generation
  try {
    const { data: secret1, error: e1 } = await supabase.rpc('generate_webhook_secret');
    const { data: secret2, error: e2 } = await supabase.rpc('generate_webhook_secret');

    const success = !e1 && !e2 && 
                   typeof secret1 === 'string' && 
                   typeof secret2 === 'string' &&
                   secret1.startsWith('whsec_') && 
                   secret2.startsWith('whsec_') &&
                   secret1 !== secret2; // Should be unique

    logTest({
      name: 'Webhook Secret Generation',
      status: success ? 'PASS' : 'FAIL',
      message: success 
        ? 'Webhook secrets generated correctly and uniquely'
        : 'Webhook secret generation failed or not unique',
      details: {
        secret1_prefix: secret1?.substring(0, 15),
        secret2_prefix: secret2?.substring(0, 15),
        are_unique: secret1 !== secret2
      }
    });
  } catch (error: any) {
    logTest({
      name: 'Webhook Secret Generation',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }
}

async function verifyEnvironmentConfig() {
  console.log('\n🌍 PHASE 6: Environment Configuration Verification\n');

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ARC_RPC_URL',
    'ARC_USDC_CONTRACT',
    'ARC_EURC_CONTRACT',
    'CRON_SECRET'
  ];

  const missing: string[] = [];
  const present: string[] = [];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }

  logTest({
    name: 'Environment Variables',
    status: missing.length === 0 ? 'PASS' : 'FAIL',
    message: missing.length === 0
      ? `All ${requiredVars.length} required variables present`
      : `Missing ${missing.length} variables: ${missing.join(', ')}`,
    details: {
      present: present.length,
      missing: missing
    }
  });

  // Verify Supabase URL matches staging
  const expectedUrl = 'https://xmdeksqnzhvijaeblwhw.supabase.co';
  const actualUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  logTest({
    name: 'Staging Environment Configured',
    status: actualUrl === expectedUrl ? 'PASS' : 'FAIL',
    message: actualUrl === expectedUrl
      ? 'Environment correctly points to staging database'
      : `Environment points to wrong database: ${actualUrl}`,
    details: {
      expected: expectedUrl,
      actual: actualUrl
    }
  });
}

async function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 STAGING VERIFICATION REPORT');
  console.log('='.repeat(70) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log('');

  const passRate = Math.round((passed / total) * 100);
  console.log(`Pass Rate: ${passRate}%`);
  console.log('');

  if (failed > 0) {
    console.log('❌ FAILED TESTS:\n');
    results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   • ${r.name}`);
        console.log(`     ${r.message}`);
      });
    console.log('');
  }

  if (passRate === 100) {
    console.log('🎉 ALL TESTS PASSED! Staging environment is ready.\n');
    return 0;
  } else if (passRate >= 80) {
    console.log('⚠️  MOSTLY PASSING. Review failed tests before proceeding.\n');
    return 1;
  } else {
    console.log('❌ CRITICAL FAILURES. Staging environment is not ready.\n');
    return 2;
  }
}

async function verifyPaymentExtensions() {
  console.log('\n💳 PHASE 7: Payment Table Extensions Verification\n');

  try {
    // Test that payments table accepts application_id
    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, application_id, environment')
      .limit(1);

    logTest({
      name: 'Payment Table Extensions',
      status: !error ? 'PASS' : 'FAIL',
      message: !error 
        ? 'New columns (application_id, environment) accessible on payments table'
        : `Error accessing extensions: ${error.message}`
    });
  } catch (error: any) {
    logTest({
      name: 'Payment Table Extensions',
      status: 'FAIL',
      message: `Exception: ${error.message}`
    });
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('🚀 LumiaPay Staging Environment Verification');
  console.log('='.repeat(70));
  console.log(`\n📍 Target: ${SUPABASE_URL}`);
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);

  try {
    await verifyEnvironmentConfig();
    await verifyTables();
    await verifyFunctions();
    await verifyMigration002();
    await verifyMigration003();
    await verifyMigration004();
    await verifyPaymentExtensions();

    const exitCode = await generateReport();
    process.exit(exitCode);
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(3);
  }
}

main();
