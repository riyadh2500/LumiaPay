/**
 * Transaction Verification Module
 * 
 * Handles Arc blockchain transaction verification with robust error handling,
 * retry logic, and strict validation to prevent double-spending and fraud.
 */

import { formatUnits, parseUnits } from 'viem';
import { getPublicClient } from '../chain';
import { getToken, TokenSymbol } from '../tokens';
import { ERC20_TRANSFER_ABI, BLOCK_LOOKBACK } from '../network';
import {
  BlockchainTransaction,
  VerificationError,
  TransactionError,
} from './payment-types';
import { compareAmounts, isTransactionWithinWindow } from './payment-validator';

// ─── Transaction Detection ───────────────────────────────────────────────────

export interface DetectTransactionOptions {
  symbol: TokenSymbol;
  recipientAddress: string;
  expectedAmount: string;
  createdAt: string | Date;
  expiresAt: string | Date;
  fromBlock?: bigint;
}

export interface DetectedTransaction {
  found: boolean;
  transaction?: BlockchainTransaction;
  reason?: string;
}

/**
 * Scans the Arc blockchain for matching token transfers to the recipient address.
 * Only considers transactions that occurred after the payment was created.
 */
export async function detectTransaction(
  options: DetectTransactionOptions
): Promise<DetectedTransaction> {
  const client = getPublicClient();
  const token = getToken(options.symbol);
  const recipient = options.recipientAddress.toLowerCase() as `0x${string}`;
  const createdAtMs = new Date(options.createdAt).getTime();

  try {
    // Determine block range to search
    const latestBlock = await client.getBlockNumber();
    const fromBlock = options.fromBlock ?? 
      (latestBlock > BLOCK_LOOKBACK ? latestBlock - BLOCK_LOOKBACK : 0n);

    // Query ERC-20 Transfer events filtered to this recipient
    const logs = await client.getLogs({
      address: token.contractAddress,
      event: ERC20_TRANSFER_ABI[0],
      args: { to: recipient },
      fromBlock,
      toBlock: latestBlock,
    });

    // Process logs in reverse chronological order (newest first)
    for (const log of logs.reverse()) {
      if (!log.blockNumber) continue;

      // Fetch block to get timestamp
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      const blockTimestamp = Number(block.timestamp);
      const blockMs = blockTimestamp * 1000;

      // Skip if transaction is before payment creation
      if (blockMs < createdAtMs) {
        continue;
      }

      // Validate transaction is within payment window
      if (!isTransactionWithinWindow(blockTimestamp, options.createdAt, options.expiresAt)) {
        continue;
      }

      // Extract transfer details
      const value = (log.args as { value: bigint }).value;
      const fromAddress = (log.args as { from: string }).from;
      const amount = formatUnits(value, token.decimals);

      // Check if amount meets or exceeds expectation
      const comparison = compareAmounts(amount, options.expectedAmount, options.symbol);
      
      if (comparison >= 0) {
        // Found matching or exceeding transaction
        return {
          found: true,
          transaction: {
            tx_hash: log.transactionHash ?? '',
            from_address: fromAddress.toLowerCase(),
            to_address: recipient,
            amount,
            token_address: token.contractAddress.toLowerCase(),
            block_number: log.blockNumber,
            block_timestamp: blockTimestamp,
            confirmed: true,
          },
        };
      }
    }

    return {
      found: false,
      reason: `No matching ${options.symbol} transfer found after payment creation`,
    };
  } catch (error) {
    console.error('[Transaction Detection Error]', error);
    throw new TransactionError('Failed to detect transaction on blockchain', {
      error: String(error),
      token: options.symbol,
      recipient: options.recipientAddress,
    });
  }
}

// ─── Specific Transaction Verification ───────────────────────────────────────

export interface VerifySpecificTransactionOptions {
  txHash: string;
  symbol: TokenSymbol;
  recipientAddress: string;
  expectedAmount: string;
  createdAt: string | Date;
}

export interface VerifiedTransaction {
  valid: boolean;
  transaction?: BlockchainTransaction;
  reason?: string;
  issues?: string[];
}

/**
 * Verifies a specific transaction hash against payment requirements.
 * Performs comprehensive validation to ensure the transaction is legitimate.
 */
export async function verifySpecificTransaction(
  options: VerifySpecificTransactionOptions
): Promise<VerifiedTransaction> {
  const client = getPublicClient();
  const token = getToken(options.symbol);
  const recipient = options.recipientAddress.toLowerCase();
  const issues: string[] = [];

  try {
    // Fetch transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: options.txHash as `0x${string}`,
    });

    if (!receipt) {
      return {
        valid: false,
        reason: 'Transaction receipt not found',
      };
    }

    // Check transaction status
    if (receipt.status !== 'success') {
      issues.push('Transaction failed on blockchain');
    }

    // Check recipient address (to field in receipt)
    if (receipt.to?.toLowerCase() !== token.contractAddress.toLowerCase()) {
      issues.push(`Transaction not sent to ${options.symbol} contract`);
    }

    // Find Transfer event in logs TO OUR RECIPIENT
    // A transaction may have multiple Transfer events, we need the one to our recipient
    let transferLog = receipt.logs.find(
      (log) => {
        if (log.address.toLowerCase() !== token.contractAddress.toLowerCase()) {
          return false;
        }
        if (log.topics[0] !== '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
          return false; // Not a Transfer event
        }
        // topics[2] is the 'to' address (indexed parameter)
        const toAddr = '0x' + log.topics[2]!.slice(26);
        return toAddr.toLowerCase() === recipient;
      }
    );

    if (!transferLog) {
      issues.push(`No Transfer event found to recipient ${recipient}`);
    }

    if (issues.length > 0) {
      return {
        valid: false,
        reason: 'Transaction validation failed',
        issues,
      };
    }

    // Parse Transfer event manually
    // Topics: [signature, from (indexed), to (indexed)]
    // Data: value (non-indexed)
    const toAddress = '0x' + transferLog!.topics[2]!.slice(26); // Remove padding from indexed address
    const fromAddress = '0x' + transferLog!.topics[1]!.slice(26);
    const value = BigInt(transferLog!.data); // Value is in data field

    const to = toAddress.toLowerCase();
    const from = fromAddress.toLowerCase();

    // Verify amount
    const receivedAmount = formatUnits(value, token.decimals);
    const comparison = compareAmounts(receivedAmount, options.expectedAmount, options.symbol);

    if (comparison < 0) {
      issues.push(`Amount ${receivedAmount} is less than expected ${options.expectedAmount}`);
    }

    // Check timestamp
    const block = await client.getBlock({ blockNumber: receipt.blockNumber });
    const blockTimestamp = Number(block.timestamp);
    const createdAtMs = new Date(options.createdAt).getTime();
    const blockMs = blockTimestamp * 1000;

    if (blockMs < createdAtMs) {
      issues.push('Transaction occurred before payment was created');
    }

    if (issues.length > 0) {
      return {
        valid: false,
        reason: 'Transaction validation failed',
        issues,
      };
    }

    // Transaction is valid
    return {
      valid: true,
      transaction: {
        tx_hash: options.txHash,
        from_address: from.toLowerCase(),
        to_address: to.toLowerCase(),
        amount: receivedAmount,
        token_address: token.contractAddress.toLowerCase(),
        block_number: receipt.blockNumber,
        block_timestamp: blockTimestamp,
        confirmed: true,
      },
    };
  } catch (error) {
    console.error('[Transaction Verification Error]', error);
    
    // Check if it's a "transaction not found" error
    if (String(error).includes('not found')) {
      return {
        valid: false,
        reason: 'Transaction not found on blockchain',
      };
    }

    throw new TransactionError('Failed to verify transaction', {
      error: String(error),
      txHash: options.txHash,
    });
  }
}

// ─── Amount Classification ───────────────────────────────────────────────────

export type AmountMatchType = 'exact' | 'overpaid' | 'underpaid';

export interface AmountMatch {
  type: AmountMatchType;
  received: string;
  expected: string;
  difference: string;
  percentage: number;
}

/**
 * Classifies the received amount relative to the expected amount.
 */
export function classifyAmount(
  received: string,
  expected: string,
  symbol: TokenSymbol
): AmountMatch {
  const token = getToken(symbol);
  const receivedUnits = parseUnits(received, token.decimals);
  const expectedUnits = parseUnits(expected, token.decimals);
  const diffUnits = receivedUnits - expectedUnits;

  const difference = formatUnits(diffUnits, token.decimals);
  const percentage = expectedUnits > 0n
    ? Number((diffUnits * 10000n) / expectedUnits) / 100
    : 0;

  let type: AmountMatchType;
  if (diffUnits === 0n) {
    type = 'exact';
  } else if (diffUnits > 0n) {
    type = 'overpaid';
  } else {
    type = 'underpaid';
  }

  return {
    type,
    received,
    expected,
    difference,
    percentage,
  };
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Retries an async operation with exponential backoff.
 * Useful for handling temporary RPC failures.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2 } = options;

  let lastError: Error | undefined;
  let currentDelay = delayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation or permanent errors
      if (error instanceof VerificationError) {
        throw error;
      }

      if (attempt === maxAttempts) {
        break;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoffMultiplier;
    }
  }

  throw new TransactionError(
    `Operation failed after ${maxAttempts} attempts`,
    { lastError: String(lastError) }
  );
}
