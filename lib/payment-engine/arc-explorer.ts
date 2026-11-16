/**
 * Arc Explorer API Integration
 * 
 * Uses Arc Testnet Explorer API to detect transactions without RPC range limitations.
 * Arc Explorer API: https://explorer.testnet.arc.io/api/v2
 */

import { ARC_EXPLORER_API } from '../network';
import { getToken, TokenSymbol } from '../tokens';
import { formatUnits } from 'viem';

interface ArcTokenTransfer {
  from: { hash: string };
  to: { hash: string };
  token: { address_hash: string; decimals: string };
  total: { value: string };
  transaction_hash: string;
  block_number: number;
  timestamp: string | null;
}

interface ArcAddressTransfersResponse {
  items: ArcTokenTransfer[];
  next_page_params: unknown | null;
}

/**
 * Get token transfers to an address using Arc Explorer API
 */
export async function getAddressTokenTransfers(
  address: string,
  tokenAddress: string
): Promise<ArcTokenTransfer[]> {
  const url = `${ARC_EXPLORER_API}/addresses/${address.toLowerCase()}/token-transfers?filter=to&type=ERC-20&token=${tokenAddress.toLowerCase()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Arc Explorer API] HTTP ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = (await response.json()) as ArcAddressTransfersResponse;
    return data.items || [];
  } catch (error) {
    console.error('[Arc Explorer API Error]', error);
    return [];
  }
}

/**
 * Find matching USDC transfer for a payment
 */
export async function findMatchingTransfer(options: {
  recipientAddress: string;
  expectedAmount: string;
  currency: TokenSymbol;
  createdAt: string | Date;
  expiresAt: string | Date;
}): Promise<{
  found: boolean;
  txHash?: string;
  amount?: string;
  from?: string;
  timestamp?: string;
}> {
  const token = getToken(options.currency);
  const createdAtMs = new Date(options.createdAt).getTime();
  const expiresAtMs = new Date(options.expiresAt).getTime();

  console.log('[Arc Explorer] Searching for transfers to', options.recipientAddress);
  
  const transfers = await getAddressTokenTransfers(
    options.recipientAddress,
    token.contractAddress
  );

  console.log(`[Arc Explorer] Found ${transfers.length} transfers`);

  // Check each transfer
  for (const transfer of transfers) {
    // Parse timestamp
    const transferTimestamp = transfer.timestamp 
      ? new Date(transfer.timestamp).getTime()
      : transfer.block_number ? createdAtMs + 1000 : 0; // Fallback if timestamp missing

    // Check if transfer is within payment window
    if (transferTimestamp < createdAtMs || transferTimestamp > expiresAtMs) {
      console.log(`[Arc Explorer] Transfer ${transfer.transaction_hash} outside window`);
      continue;
    }

    // Parse amount
    const decimals = parseInt(transfer.token.decimals);
    const amount = formatUnits(BigInt(transfer.total.value), decimals);

    console.log(`[Arc Explorer] Transfer ${transfer.transaction_hash}: ${amount} ${options.currency}`);

    // Check if amount meets or exceeds expected
    const expectedBigInt = BigInt(Math.floor(parseFloat(options.expectedAmount) * 10 ** decimals));
    const receivedBigInt = BigInt(transfer.total.value);

    if (receivedBigInt >= expectedBigInt) {
      console.log(`[Arc Explorer] ✅ Match found!`);
      return {
        found: true,
        txHash: transfer.transaction_hash,
        amount,
        from: transfer.from.hash,
        timestamp: transfer.timestamp || undefined,
      };
    }
  }

  console.log('[Arc Explorer] No matching transfer found');
  return { found: false };
}
