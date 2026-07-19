import { createPublicClient, http } from 'viem';
import { arcTestnet } from 'viem/chains';

// Reset cached client when module reloads (e.g. Next.js hot-reload).
let _client: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.ARC_RPC_URL ?? 'https://rpc.testnet.arc.network'),
    });
  }
  return _client;
}

export { arcTestnet };
