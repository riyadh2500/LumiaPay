/**
 * Payment Validation Module
 * 
 * Validates payment data, amounts, addresses, and business rules
 * without floating-point precision errors.
 */

import { isAddress, parseUnits, formatUnits } from 'viem';
import { TokenSymbol, getToken } from '../tokens';
import { ValidationError, PaymentStatus, VALID_STATUS_TRANSITIONS } from './payment-types';

// ─── Amount Validation ───────────────────────────────────────────────────────

/**
 * Validates a decimal amount string and ensures it can be safely converted
 * to token units without precision loss.
 */
export function validateAmount(amount: string, symbol: TokenSymbol): void {
  // Check format
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new ValidationError('Amount must be a positive decimal number', { amount });
  }

  const token = getToken(symbol);
  
  // Check if amount is positive
  const numAmount = parseFloat(amount);
  if (numAmount <= 0) {
    throw new ValidationError('Amount must be greater than zero', { amount });
  }

  // Check if amount has too many decimal places
  const parts = amount.split('.');
  if (parts[1] && parts[1].length > token.decimals) {
    throw new ValidationError(
      `Amount has too many decimal places. Maximum ${token.decimals} for ${symbol}`,
      { amount, max_decimals: token.decimals }
    );
  }

  // Try to parse to ensure no overflow
  try {
    parseUnits(amount, token.decimals);
  } catch (error) {
    throw new ValidationError('Amount is too large or invalid', { amount, error: String(error) });
  }
}

/**
 * Compares two amounts in base units (no floating point).
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareAmounts(
  amountA: string,
  amountB: string,
  symbol: TokenSymbol
): -1 | 0 | 1 {
  const token = getToken(symbol);
  const unitsA = parseUnits(amountA, token.decimals);
  const unitsB = parseUnits(amountB, token.decimals);

  if (unitsA < unitsB) return -1;
  if (unitsA > unitsB) return 1;
  return 0;
}

/**
 * Calculates the difference between received and expected amounts.
 * Returns positive if overpaid, negative if underpaid, zero if exact.
 */
export function calculateAmountDifference(
  received: string,
  expected: string,
  symbol: TokenSymbol
): { difference: string; percentage: number } {
  const token = getToken(symbol);
  const receivedUnits = parseUnits(received, token.decimals);
  const expectedUnits = parseUnits(expected, token.decimals);

  const diffUnits = receivedUnits - expectedUnits;
  const difference = formatUnits(diffUnits, token.decimals);

  // Calculate percentage difference (can use floating point here for display only)
  const percentage = expectedUnits > 0n
    ? Number((diffUnits * 10000n) / expectedUnits) / 100  // Two decimal precision
    : 0;

  return { difference, percentage };
}

// ─── Address Validation ──────────────────────────────────────────────────────

/**
 * Validates an Ethereum/Arc address format.
 */
export function validateAddress(address: string): void {
  if (!address) {
    throw new ValidationError('Address is required');
  }

  if (!isAddress(address)) {
    throw new ValidationError('Invalid Ethereum address format', { address });
  }

  // Normalize to lowercase for consistent storage
  const normalized = address.toLowerCase();
  
  // Check for zero address
  if (normalized === '0x0000000000000000000000000000000000000000') {
    throw new ValidationError('Cannot use zero address', { address });
  }
}

// ─── Payment Label Validation ────────────────────────────────────────────────

export function validateLabel(label: string): void {
  if (!label || label.trim().length === 0) {
    throw new ValidationError('Payment label is required');
  }

  if (label.length > 200) {
    throw new ValidationError('Payment label must be 200 characters or less', {
      length: label.length,
    });
  }
}

// ─── Currency Validation ─────────────────────────────────────────────────────

export function validateCurrency(currency: string): TokenSymbol {
  const validSymbols: TokenSymbol[] = ['USDC', 'EURC'];
  
  if (!validSymbols.includes(currency as TokenSymbol)) {
    throw new ValidationError('Unsupported currency', {
      currency,
      supported: validSymbols,
    });
  }

  return currency as TokenSymbol;
}

// ─── Status Transition Validation ────────────────────────────────────────────

/**
 * Validates that a status transition is allowed according to the lifecycle rules.
 */
export function validateStatusTransition(
  currentStatus: PaymentStatus,
  newStatus: PaymentStatus
): void {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

  if (!allowedTransitions.includes(newStatus)) {
    throw new ValidationError(
      `Invalid status transition from ${currentStatus} to ${newStatus}`,
      {
        current: currentStatus,
        requested: newStatus,
        allowed: allowedTransitions,
      }
    );
  }
}

// ─── Payment Expiry Validation ───────────────────────────────────────────────

/**
 * Checks if a payment has expired based on its expires_at timestamp.
 */
export function isExpired(expiresAt: string | Date): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  const now = Date.now();
  return now > expiryTime;
}

/**
 * Checks if a transaction timestamp is within the valid payment window.
 */
export function isTransactionWithinWindow(
  txTimestamp: number | Date,
  createdAt: string | Date,
  expiresAt: string | Date
): boolean {
  const txTime = typeof txTimestamp === 'number' ? txTimestamp * 1000 : txTimestamp.getTime();
  const createTime = new Date(createdAt).getTime();
  const expireTime = new Date(expiresAt).getTime();

  // Transaction must be after payment creation
  if (txTime < createTime) {
    return false;
  }

  // For expired payments, we still accept late transactions for review
  // but flag them appropriately
  return true;
}

// ─── TTL Validation ──────────────────────────────────────────────────────────

export function validateTTL(ttlSeconds?: number): number {
  const defaultTTL = 60 * 60; // 1 hour
  const minTTL = 60; // 1 minute
  const maxTTL = 24 * 60 * 60; // 24 hours

  if (ttlSeconds === undefined) {
    return defaultTTL;
  }

  if (ttlSeconds < minTTL || ttlSeconds > maxTTL) {
    throw new ValidationError('TTL must be between 1 minute and 24 hours', {
      ttl: ttlSeconds,
      min: minTTL,
      max: maxTTL,
    });
  }

  return ttlSeconds;
}

// ─── UUID Validation ─────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(uuid: string, fieldName: string = 'ID'): void {
  if (!uuid || !UUID_REGEX.test(uuid)) {
    throw new ValidationError(`Invalid ${fieldName} format`, { [fieldName]: uuid });
  }
}

// ─── Complete Payment Intent Validation ──────────────────────────────────────

export interface ValidatedPaymentInput {
  user_id: string;
  label: string;
  amount: string;
  currency: TokenSymbol;
  wallet_address: string;
  ttl_seconds: number;
}

/**
 * Validates all fields for creating a new payment intent.
 */
export function validatePaymentIntentInput(input: {
  user_id: string;
  label: string;
  amount: string;
  currency: string;
  wallet_address: string;
  ttl_seconds?: number;
}): ValidatedPaymentInput {
  // Validate user ID
  validateUUID(input.user_id, 'user_id');

  // Validate label
  validateLabel(input.label);

  // Validate currency
  const currency = validateCurrency(input.currency);

  // Validate amount
  validateAmount(input.amount, currency);

  // Validate wallet address
  validateAddress(input.wallet_address);

  // Validate TTL
  const ttl_seconds = validateTTL(input.ttl_seconds);

  return {
    user_id: input.user_id,
    label: input.label.trim(),
    amount: input.amount,
    currency,
    wallet_address: input.wallet_address.toLowerCase(),
    ttl_seconds,
  };
}
