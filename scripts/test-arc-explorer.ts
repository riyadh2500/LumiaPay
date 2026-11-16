/**
 * Test Arc Explorer API integration
 */

import { findMatchingTransfer } from '../lib/payment-engine/arc-explorer';

async function main() {
  console.log('\n🔍 Testing Arc Explorer API Integration\n');

  const result = await findMatchingTransfer({
    recipientAddress: '0x6e383ee7B84488Ce4425b7F6261795C1FCB039f2',
    expectedAmount: '1',
    currency: 'USDC',
    createdAt: '2026-11-16T09:40:32.230233+00:00',
    expiresAt: '2026-11-16T09:55:26.553+00:00',
  });

  if (result.found) {
    console.log('✅ Transfer found!');
    console.log(`  TX Hash: ${result.txHash}`);
    console.log(`  Amount: ${result.amount}`);
    console.log(`  From: ${result.from}`);
    console.log(`  Timestamp: ${result.timestamp}`);
  } else {
    console.log('❌ No matching transfer found');
  }
}

main().catch(console.error);
