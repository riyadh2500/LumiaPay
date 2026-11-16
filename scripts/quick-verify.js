// Quick Staging Verification
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function verify() {
  console.log('\n🚀 LumiaPay Staging Verification\n');
  let passed = 0, failed = 0;
  
  const tables = ['applications', 'api_keys', 'rate_limit_buckets', 'webhook_endpoints'];
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(0);
      if (!error) { console.log('✅ Table: ' + table); passed++; }
      else { console.log('❌ Table: ' + table); failed++; }
    } catch (e) { console.log('❌ Table: ' + table); failed++; }
  }
  
  try {
    const { data, error } = await supabase.rpc('check_rate_limit', { p_key: 'test', p_max_tokens: 10, p_window_seconds: 60 });
    if (!error && data && data.allowed) { console.log('✅ check_rate_limit()'); passed++; }
    else { console.log('❌ check_rate_limit()'); failed++; }
  } catch (e) { console.log('❌ check_rate_limit()'); failed++; }
  
  console.log('\n✅ Passed: ' + passed + '\n❌ Failed: ' + failed + '\n');
  if (failed === 0) console.log('🎉 ALL TESTS PASSED!\n');
  process.exit(failed > 0 ? 1 : 0);
}

verify().catch(err => { console.error('❌ ERROR:', err.message); process.exit(1); });
