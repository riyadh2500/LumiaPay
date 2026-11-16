/**
 * Test Arc RPC Connection
 */

import { createPublicClient, http } from 'viem';
import { defineChain } from 'viem';

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
});

const client = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

async function testConnection() {
  try {
    console.log('🔄 Testing Arc RPC connection...');
    
    const blockNumber = await client.getBlockNumber();
    console.log('✅ Connected! Latest block:', blockNumber);
    
    const block = await client.getBlock({ blockNumber });
    console.log('✅ Block timestamp:', new Date(Number(block.timestamp) * 1000).toISOString());
    
    // Test USDC contract
    const usdcAddress = '0x3600000000000000000000000000000000000000';
    console.log('\n🔄 Testing USDC contract read...');
    
    const code = await client.getBytecode({ address: usdcAddress as `0x${string}` });
    if (code) {
      console.log('✅ USDC contract exists on Arc Testnet');
    } else {
      console.log('❌ USDC contract not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testConnection();
