// Test Email Verification Script
// Run: node test-email.js

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🧪 LumiaPay Email Verification Test\n');
console.log('This script will test if Supabase can send emails.\n');

rl.question('Enter your SUPABASE_URL (from .env.local): ', (url) => {
  rl.question('Enter your SUPABASE_ANON_KEY (from .env.local): ', (key) => {
    rl.question('Enter test email address: ', async (email) => {
      
      console.log('\n📧 Testing email to:', email);
      console.log('⏳ Please wait...\n');

      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(url, key);

        // Test signup
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: 'TestPassword123!',
          options: {
            emailRedirectTo: 'https://lumia-pay.vercel.app/auth/callback',
          }
        });

        if (error) {
          console.log('❌ Error:', error.message);
          if (error.message.includes('User already registered')) {
            console.log('\n💡 Tip: This email is already registered.');
            console.log('Try with a different email or use Magic Link to login.\n');
          }
        } else {
          console.log('✅ Success! Signup request sent.');
          console.log('\n📊 Response:');
          console.log('   User ID:', data.user?.id || 'N/A');
          console.log('   Email:', data.user?.email || 'N/A');
          console.log('   Confirmed:', data.user?.email_confirmed_at ? 'Yes' : 'No (pending)');
          
          if (data.user && !data.user.email_confirmed_at) {
            console.log('\n✉️  Confirmation email should be sent to:', email);
            console.log('   Check your inbox and spam folder!\n');
          }
        }

        // Test magic link
        console.log('\n🔗 Testing Magic Link (OTP)...\n');
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: email,
          options: {
            emailRedirectTo: 'https://lumia-pay.vercel.app/auth/callback',
          }
        });

        if (otpError) {
          console.log('❌ Magic Link Error:', otpError.message);
        } else {
          console.log('✅ Magic Link sent!');
          console.log('   Check', email, 'for login link\n');
        }

      } catch (err) {
        console.log('❌ Script Error:', err.message);
      }

      rl.close();
      process.exit(0);
    });
  });
});
