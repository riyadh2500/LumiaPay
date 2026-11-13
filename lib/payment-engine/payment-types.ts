/**
 * Central Payment Engine Type Definitions
 * 
 * These types define the complete payment lifecycle and data structures
 * used throughout the LumiaPay payment processing system.
 */

import { TokenSymbol } from '../tokens';

// ─── Payment Status Lifecycle ────────────────────────────────────────────────

export type PaymentStatus =
  | 'created'           // Payment intent created, not yet awaiting payment
  | 'pending'           // Awaiting blockchain payment
  | 'detecting'         // Transaction detected on blockchain
  | 'verifying'         // Transaction being verified
  | 'paid'              // Successfully verified and paid
  | 'underpaid'         // Received less than expected amount
  | 'overpaid'          // Received more than expected amount
  | 'expired'           // Payment window expired
  | 'failed'            // Permanent failure or cancellation
  | 'review_required';  // Needs manual review

// Valid status transitions to prevent invalid state changes
export const VALID_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  created: ['pending', 'failed'],
  pending: ['detecting', 'expired', 'failed'],
  detecting: ['verifying', 'expired', 'failed'],
  verifying: ['paid', 'underpaid', 'overpaid', 'review_required', 'expired', 'failed'],
  paid: [], // Terminal state
  underpaid: ['review_required', 'failed'],
  overpaid: ['review_required', 'failed'],
  expired: ['detecting', 'verifying', 'review_required'], // Can still detect late payments
  failed: [], // Terminal state
  review_required: ['paid', 'failed'],
};

// ─── Payment Intent ──────────────────────────────────────────────────────────

export interface PaymentIntent {
  id: string;
  user_id: string;
  merchant_id?: string;
  label: string;
  amount: string; // Decimal string to avoid floating point issues
  currency: TokenSymbol;
  wallet_address: string; // Receiving merchant wallet
  status: PaymentStatus;
  tx_hash?: string | null;
  created_at: string;
  expires_at: string;
  paid_at?: string | null;
  verified_amount?: string | null;
  metadata?: Record<string, any>;
}

// ─── Payment Creation ────────────────────────────────────────────────────────

export interface CreatePaymentIntentInput {
  user_id: string;
  label: string;
  amount: string;
  currency: TokenSymbol;
  wallet_address: string;
  ttl_seconds?: number; // Optional custom expiry, defaults to config
  metadata?: Record<string, any>;
}

export interface CreatePaymentIntentResult {
  success: true;
  payment: PaymentIntent;
}

// ─── Transaction Verification ────────────────────────────────────────────────

export interface BlockchainTransaction {
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: string;
  token_address: string;
  block_number: bigint;
  block_timestamp: number;
  confirmed: boolean;
}

export interface VerificationInput {
  payment_id: string;
  tx_hash?: string; // Optional: specific transaction to verify
  force?: boolean; // Force re-verification even if already verified
}

export interface VerificationResult {
  success: boolean;
  payment_id: string;
  status: PaymentStatus;
  tx_hash?: string;
  verified_amount?: string;
  message?: string;
  details?: {
    expected_amount: string;
    received_amount?: string;
    difference?: string;
    block_number?: string;
    block_timestamp?: string;
  };
}

// ─── Payment Events ──────────────────────────────────────────────────────────

export type PaymentEventType =
  | 'payment.created'
  | 'payment.pending'
  | 'payment.detecting'
  | 'payment.verifying'
  | 'payment.paid'
  | 'payment.underpaid'
  | 'payment.overpaid'
  | 'payment.expired'
  | 'payment.failed'
  | 'payment.cancelled'
  | 'payment.review_required'
  | 'transaction.detected'
  | 'verification.started'
  | 'verification.completed'
  | 'verification.failed';

export interface PaymentEvent {
  id: string;
  payment_id: string;
  user_id: string;
  event_type: PaymentEventType;
  status: PaymentStatus;
  data: Record<string, any>;
  processed: boolean;
  created_at: string;
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export class PaymentEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'PaymentEngineError';
  }
}

export class ValidationError extends PaymentEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class VerificationError extends PaymentEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VERIFICATION_ERROR', 422, details);
    this.name = 'VerificationError';
  }
}

export class TransactionError extends PaymentEngineError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'TRANSACTION_ERROR', 500, details);
    this.name = 'TransactionError';
  }
}

// ─── Service Results ─────────────────────────────────────────────────────────

export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: PaymentEngineError };
