/**
 * Debug transaction detection
 */

import { createPublicClient, http } from 'viem';
import { getToken } from '../lib/tokens';

const ARC_RPC = 'https://rpc.testnet.arc.network';
const PAYMENT_ADDRESS = '0x6e383ee7b84488ce4425b7f6261795c1fcb039f2';
const PAYMENT_CREATED = '2026-11-16T09:40:32.230233+00:00';
const PAYMENT_EXPIRES = '2026-11-16T09:55:26.553+00:00';

const client = createPublicClient({
  transport: http(ARC_RPC),
});

const ERC20_TRANSFER_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'value', type: 'uint256' },
    ],
  },
] as const;

async function main() {
  console.log('\n🔍 Debug Transaction Detection\n');

  const token = getToken('USDC');
  const recipient = PAYMENT_ADDRESS.toLowerCase() as `0x${string}`;
  const createdAtMs = new Date(PAYMENT_CREATED).getTime();

  console.log(`Token Contract: ${token.contractAddress}`);
  console.log(`Recipient: ${recipient}`);
  console.log(`Created At: ${PAYMENT_CREATED}`);
  console.log(`Created At (ms): ${createdAtMs}`);
  console.log(`Expires At: ${PAYMENT_EXPIRES}\n`);

  // Get latest block
  const latestBlock = await client.getBlockNumber();
  console.log(`Latest Block: ${latestBlock}\n`);

  // Search last 100 blocks
  const fromBlock = latestBlock - 100n;

  console.log(`Searching blocks ${fromBlock} to ${latestBlock}...\n`);

  // Query Transfer events to this recipient
  const logs = await client.getLogs({
    address: token.contractAddress,
    event: ERC20_TRANSFER_ABI[0],
    args: { to: recipient },
    fromBlock,
    toBlock: latestBlock,
  });

  console.log(`Found ${logs.length} Transfer events to recipient\n`);

  if (logs.length === 0) {
    console.log('❌ No transfers found!');
    return;
  }

  // Check each log
  for (const log of logs) {
    console.log(`\n─── Transfer Event ───`);
    console.log(`TX Hash: ${log.transactionHash}`);
    console.log(`Block: ${log.blockNumber}`);

    const block = await client.getBlock({ blockNumber: log.blockNumber! });
    const blockTimestamp = Number(block.timestamp);
    const blockMs = blockTimestamp * 1000;
    const blockDate = new Date(blockMs);

    console.log(`Block Timestamp: ${blockDate.toISOString()}`);
    console.log(`Block MS: ${blockMs}`);
    console.log(`Created MS: ${createdAtMs}`);
    console.log(`Is After Creation: ${blockMs >= createdAtMs}`);

    const value = (log.args as { value: bigint }).value;
    const from = (log.args as { from: string }).from;
    
    console.log(`From: ${from}`);
    console.log(`To: ${recipient}`);
    console.log(`Value: ${value} (${Number(value) / 1e6} USDC)`);
  }
}

main().catch(console.error);
