import { getPublicClient } from './chain';
import { ERC20_TRANSFER_ABI, BLOCK_LOOKBACK } from './network';
import { getToken, TokenSymbol } from './tokens';
import { parseUnits } from 'viem';

export type VerifyResult =
  | { verified: true; txHash: string }
  | { verified: false; reason: string };

interface VerifyPaymentOpts {
  symbol: TokenSymbol;
  /** Merchant's receiving wallet address */
  recipientAddress: string;
  /** Human-readable expected amount, e.g. "10.50" */
  expectedAmount: string;
  /** When the payment link was created — only transfers AFTER this time are valid */
  createdAt: string | Date;
}

/**
 * Verifies an inbound stablecoin payment on Arc Testnet.
 *
 * Only transfers that occurred AFTER the payment link was created are accepted.
 * This prevents old transfers to the same wallet from incorrectly marking a
 * new payment as paid.
 */
export async function verifyPayment(opts: VerifyPaymentOpts): Promise<VerifyResult> {
  const client = getPublicClient();
  const token = getToken(opts.symbol);

  const expectedUnits = parseUnits(opts.expectedAmount, token.decimals);
  const recipient = opts.recipientAddress.toLowerCase() as `0x${string}`;
  const createdAtMs = new Date(opts.createdAt).getTime();

  const latestBlock = await client.getBlockNumber();
  const fromBlock = latestBlock > BLOCK_LOOKBACK ? latestBlock - BLOCK_LOOKBACK : 0n;

  // Query ERC-20 Transfer logs filtered to this recipient.
  const logs = await client.getLogs({
    address: token.contractAddress,
    event: ERC20_TRANSFER_ABI[0],
    args: { to: recipient },
    fromBlock,
    toBlock: latestBlock,
  });

  for (const log of logs) {
    // Skip logs with no block number (shouldn't happen, but be safe).
    if (!log.blockNumber) continue;

    // Fetch the block to get its timestamp and confirm the transfer
    // happened AFTER this payment link was created.
    const block = await client.getBlock({ blockNumber: log.blockNumber });
    const blockMs = Number(block.timestamp) * 1000;

    if (blockMs < createdAtMs) {
      // This transfer happened before the payment was created — skip it.
      continue;
    }

    const value = (log.args as { value: bigint }).value;
    if (value >= expectedUnits) {
      return { verified: true, txHash: log.transactionHash ?? '' };
    }
  }

  return {
    verified: false,
    reason: `No matching ${opts.symbol} transfer found after payment was created`,
  };
}
