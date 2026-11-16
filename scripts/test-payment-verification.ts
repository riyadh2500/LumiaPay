/**
 * Test script to debug payment verification
 * Run with env vars:
 * NODE_ENV=production npx tsx scripts/test-payment-verification.ts
 */

import { createAdminClient } from '../lib/supabase/admin';
import { detectTransaction } from '../lib/payment-engine/transaction-verifier';
import { TokenSymbol } from '../lib/tokens';

async function main() {
  const admin = createAdminClient();

  // Get all detecting payments
  const { data: payments, error } = await admin
    .from('payments')
    .select('*')
    .eq('status', 'detecting')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch payments:', error);
    return;
  }

  if (!payments || payments.length === 0) {
    console.log('No payments in "detecting" status found.');
    
    // Check for pending payments
    const { data: pendingPayments } = await admin
      .from('payments')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (pendingPayments && pendingPayments.length > 0) {
      console.log('\n📋 Found pending payments:');
      pendingPayments.forEach((p: any) => {
        console.log(`  ID: ${p.id}`);
        console.log(`  Amount: ${p.amount} ${p.currency}`);
        console.log(`  Wallet: ${p.wallet_address}`);
        console.log(`  Created: ${p.created_at}`);
        console.log(`  Expires: ${p.expires_at}`);
        console.log(`  ---`);
      });
    }
    return;
  }

  console.log(`\n🔍 Found ${payments.length} payments in "detecting" status\n`);

  for (const payment of payments) {
    console.log(`\n━━━ Payment ${payment.id} ━━━`);
    console.log(`Label: ${payment.label}`);
    console.log(`Amount: ${payment.amount} ${payment.currency}`);
    console.log(`Wallet: ${payment.wallet_address}`);
    console.log(`Payment Address: ${payment.payment_address}`);
    console.log(`Network: ${payment.network}`);
    console.log(`Status: ${payment.status}`);
    console.log(`Created: ${payment.created_at}`);
    console.log(`Expires: ${payment.expires_at}`);

    try {
      console.log('\n⏳ Attempting to detect transaction...');
      
      const result = await detectTransaction({
        symbol: payment.currency as TokenSymbol,
        recipientAddress: payment.wallet_address,
        expectedAmount: payment.amount,
        createdAt: payment.created_at,
        expiresAt: payment.expires_at,
      });

      if (result.found && result.transaction) {
        console.log('\n✅ Transaction found!');
        console.log(`  TX Hash: ${result.transaction.tx_hash}`);
        console.log(`  From: ${result.transaction.from_address}`);
        console.log(`  To: ${result.transaction.to_address}`);
        console.log(`  Amount: ${result.transaction.amount}`);
        console.log(`  Block: ${result.transaction.block_number}`);
        console.log(`  Timestamp: ${result.transaction.block_timestamp}`);
      } else {
        console.log('\n❌ No transaction found');
        console.log(`  Reason: ${result.reason}`);
      }
    } catch (error) {
      console.error('\n🔴 Detection error:', error);
    }
  }
}

main().catch(console.error);
