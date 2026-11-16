/**
 * Manually verify a transaction on Arc Testnet
 * Run: npx tsx scripts/verify-transaction.ts
 */

import { createPublicClient, http, formatUnits } from 'viem';

const TX_HASH = '0xd0b11ae372fe4052d03880086ee75aa2dbf8ace8a04f1c6539429ab51c3a8fb8';
const ARC_RPC = 'https://rpc.testnet.arc.network';
const USDC_CONTRACT = '0x3600000000000000000000000000000000000000';

const client = createPublicClient({
  transport: http(ARC_RPC),
});

async function main() {
  console.log('\n🔍 Verifying Transaction on Arc Testnet...\n');
  console.log(`TX Hash: ${TX_HASH}`);
  console.log(`RPC: ${ARC_RPC}\n`);

  try {
    // Get transaction receipt
    console.log('⏳ Fetching transaction receipt...');
    const receipt = await client.getTransactionReceipt({
      hash: TX_HASH as `0x${string}`,
    });

    if (!receipt) {
      console.log('❌ Transaction not found on blockchain');
      return;
    }

    console.log('\n✅ Transaction found!');
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`Status: ${receipt.status}`);
    console.log(`From: ${receipt.from}`);
    console.log(`To Contract: ${receipt.to}`);
    console.log(`Gas Used: ${receipt.gasUsed}`);

    // Get block timestamp
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const timestamp = new Date(Number(block.timestamp) * 1000);
    console.log(`Block Timestamp: ${timestamp.toISOString()}`);

    // Find USDC Transfer event
    console.log('\n🔎 Looking for USDC Transfer events...');
    
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    
    const transferLogs = receipt.logs.filter(log => 
      log.address.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
      log.topics[0] === transferTopic
    );

    if (transferLogs.length === 0) {
      console.log('❌ No USDC Transfer events found');
      console.log('\nAll logs:');
      receipt.logs.forEach((log, i) => {
        console.log(`  Log ${i}: ${log.address}`);
        console.log(`    Topics: ${log.topics.join(', ')}`);
      });
      return;
    }

    console.log(`\n✅ Found ${transferLogs.length} USDC Transfer(s):`);
    
    transferLogs.forEach((log, i) => {
      const from = '0x' + log.topics[1]!.slice(26);
      const to = '0x' + log.topics[2]!.slice(26);
      const value = BigInt(log.data);
      const amount = formatUnits(value, 6); // USDC has 6 decimals

      console.log(`\n  Transfer #${i + 1}:`);
      console.log(`    From: ${from}`);
      console.log(`    To: ${to}`);
      console.log(`    Amount: ${amount} USDC`);
    });

    console.log('\n✅ Transaction is valid and exists on Arc Testnet!');

  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main();
