/**
 * Central Payment Service
 * 
 * Main interface for the Payment Engine. Provides high-level operations
 * for creating, verifying, and managing payments while maintaining
 * data integrity and preventing fraud.
 */

import { createAdminClient } from '../supabase/admin';
import { TokenSymbol } from '../tokens';
import {
  PaymentIntent,
  CreatePaymentIntentInput,
  CreatePaymentIntentResult,
  VerificationInput,
  VerificationResult,
  ValidationError,
  PaymentEngineError,
  PaymentStatus,
} from './payment-types';
import {
  validatePaymentIntentInput,
  validateUUID,
  isExpired,
} from './payment-validator';
import {
  detectTransaction,
  verifySpecificTransaction,
  classifyAmount,
  withRetry,
} from './transaction-verifier';
import {
  updatePaymentStatus,
  checkAndExpirePayment,
  getPayment,
  cancelPayment,
  assignTransaction,
} from './payment-lifecycle';
import * as Events from './payment-events';

// ─── Payment Creation ────────────────────────────────────────────────────────

/**
 * Creates a new payment intent with full validation.
 * This is the main entry point for initiating a payment request.
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<CreatePaymentIntentResult> {
  // Validate all input fields
  const validated = validatePaymentIntentInput(input);

  const admin = createAdminClient();

  // Calculate expiration time
  const expiresAt = new Date(Date.now() + validated.ttl_seconds * 1000).toISOString();

  // Insert payment record
  const { data, error } = await admin
    .from('payments')
    .insert({
      user_id: validated.user_id,
      label: validated.label,
      amount: validated.amount,
      currency: validated.currency,
      wallet_address: validated.wallet_address,
      status: 'pending',
      expires_at: expiresAt,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error('[Create Payment Intent Error]', error);
    throw new PaymentEngineError(
      'Failed to create payment intent',
      'CREATION_FAILED',
      500,
      { error: error.message }
    );
  }

  const payment = data as PaymentIntent;

  // Emit creation event
  await Events.emitPaymentCreated(payment.id, payment.user_id, {
    amount: payment.amount,
    currency: payment.currency,
    label: payment.label,
  });

  return {
    success: true,
    payment,
  };
}

// ─── Payment Verification ────────────────────────────────────────────────────

/**
 * Verifies a payment by detecting and validating blockchain transactions.
 * Handles automatic detection or specific transaction hash verification.
 */
export async function verifyPayment(
  input: VerificationInput
): Promise<VerificationResult> {
  validateUUID(input.payment_id, 'payment_id');

  // Retrieve payment
  const payment = await getPayment(input.payment_id);

  if (!payment) {
    throw new ValidationError('Payment not found', { payment_id: input.payment_id });
  }

  // Check if already paid (unless force is true)
  if (!input.force && payment.status === 'paid') {
    return {
      success: true,
      payment_id: payment.id,
      status: 'paid',
      tx_hash: payment.tx_hash ?? undefined,
      verified_amount: payment.verified_amount ?? undefined,
      message: 'Payment already verified',
    };
  }

  // Check if expired
  if (payment.status === 'pending') {
    await checkAndExpirePayment(payment.id);
    // Reload payment after expiry check
    const updatedPayment = await getPayment(payment.id);
    if (updatedPayment && updatedPayment.status === 'expired') {
      // Continue verification even if expired - we may find late payment
      await Events.emitVerificationStarted(payment.id, payment.user_id);
    }
  } else {
    await Events.emitVerificationStarted(payment.id, payment.user_id, input.tx_hash);
  }

  try {
    // Update status to verifying
    if (payment.status === 'pending' || payment.status === 'expired') {
      await updatePaymentStatus({
        payment_id: payment.id,
        new_status: 'verifying',
        emit_event: false,
      });
    }

    let result: VerificationResult;

    if (input.tx_hash) {
      // Verify specific transaction
      result = await verifySpecificTransactionFlow(payment, input.tx_hash);
    } else {
      // Auto-detect transaction
      result = await detectTransactionFlow(payment);
    }

    return result;
  } catch (error) {
    console.error('[Payment Verification Error]', error);

    await Events.emitVerificationFailed(
      payment.id,
      payment.user_id,
      String(error),
      { tx_hash: input.tx_hash }
    );

    // Revert to previous status on error
    if (payment.status === 'pending' || payment.status === 'expired') {
      await updatePaymentStatus({
        payment_id: payment.id,
        new_status: payment.status,
        emit_event: false,
      });
    }

    throw error;
  }
}

// ─── Internal: Specific Transaction Verification ─────────────────────────────

async function verifySpecificTransactionFlow(
  payment: PaymentIntent,
  txHash: string
): Promise<VerificationResult> {
  const verified = await withRetry(() =>
    verifySpecificTransaction({
      txHash,
      symbol: payment.currency as TokenSymbol,
      recipientAddress: payment.wallet_address,
      expectedAmount: payment.amount,
      createdAt: payment.created_at,
    })
  );

  if (!verified.valid) {
    return {
      success: false,
      payment_id: payment.id,
      status: payment.status,
      message: verified.reason ?? 'Transaction verification failed',
      details: {
        expected_amount: payment.amount,
        ...(verified.issues && { issues: verified.issues }),
      },
    };
  }

  const transaction = verified.transaction!;

  // Assign transaction (checks uniqueness)
  try {
    await assignTransaction(payment.id, transaction.tx_hash, transaction.amount);
  } catch (error) {
    if (error instanceof ValidationError) {
      // Transaction already used
      await Events.emitReviewRequired(
        payment.id,
        payment.user_id,
        'Transaction already used for another payment',
        transaction.tx_hash
      );

      return {
        success: false,
        payment_id: payment.id,
        status: 'review_required',
        message: 'Transaction already used for another payment',
      };
    }
    throw error;
  }

  // Classify amount
  const amountMatch = classifyAmount(
    transaction.amount,
    payment.amount,
    payment.currency as TokenSymbol
  );

  // Determine final status
  let finalStatus: PaymentStatus;
  let message: string;

  switch (amountMatch.type) {
    case 'exact':
    case 'overpaid':
      finalStatus = 'paid';
      message = 'Payment successfully verified';
      if (amountMatch.type === 'overpaid') {
        await Events.emitPaymentOverpaid(
          payment.id,
          payment.user_id,
          transaction.tx_hash,
          transaction.amount,
          payment.amount
        );
      }
      break;

    case 'underpaid':
      finalStatus = 'underpaid';
      message = 'Payment received but amount is less than expected';
      await Events.emitPaymentUnderpaid(
        payment.id,
        payment.user_id,
        transaction.tx_hash,
        transaction.amount,
        payment.amount
      );
      break;
  }

  // Update payment
  await updatePaymentStatus({
    payment_id: payment.id,
    new_status: finalStatus,
    tx_hash: transaction.tx_hash,
    verified_amount: transaction.amount,
    emit_event: finalStatus === 'paid',
  });

  return {
    success: finalStatus === 'paid',
    payment_id: payment.id,
    status: finalStatus,
    tx_hash: transaction.tx_hash,
    verified_amount: transaction.amount,
    message,
    details: {
      expected_amount: payment.amount,
      received_amount: transaction.amount,
      difference: amountMatch.difference,
      block_number: transaction.block_number.toString(),
      block_timestamp: transaction.block_timestamp.toString(),
    },
  };
}

// ─── Internal: Auto-Detection Verification ───────────────────────────────────

async function detectTransactionFlow(
  payment: PaymentIntent
): Promise<VerificationResult> {
  const detected = await withRetry(() =>
    detectTransaction({
      symbol: payment.currency as TokenSymbol,
      recipientAddress: payment.wallet_address,
      expectedAmount: payment.amount,
      createdAt: payment.created_at,
      expiresAt: payment.expires_at,
    })
  );

  if (!detected.found) {
    // No transaction found
    const status = isExpired(payment.expires_at) ? 'expired' : 'pending';

    return {
      success: false,
      payment_id: payment.id,
      status,
      message: detected.reason ?? 'No matching transaction found',
      details: {
        expected_amount: payment.amount,
      },
    };
  }

  const transaction = detected.transaction!;

  // Verify the detected transaction
  return await verifySpecificTransactionFlow(payment, transaction.tx_hash);
}

// ─── Payment Retrieval ───────────────────────────────────────────────────────

/**
 * Retrieves a payment by ID with automatic expiry check.
 */
export async function getPaymentById(paymentId: string): Promise<PaymentIntent | null> {
  validateUUID(paymentId, 'payment_id');
  return await getPayment(paymentId);
}

/**
 * Retrieves all payments for a specific user.
 */
export async function getPaymentsByUser(userId: string): Promise<PaymentIntent[]> {
  validateUUID(userId, 'user_id');

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Get User Payments Error]', error);
    return [];
  }

  return (data as PaymentIntent[]) ?? [];
}

// ─── Payment Cancellation ────────────────────────────────────────────────────

/**
 * Cancels a pending payment.
 */
export async function cancelPendingPayment(
  paymentId: string,
  userId: string
): Promise<PaymentIntent> {
  validateUUID(paymentId, 'payment_id');
  validateUUID(userId, 'user_id');

  return await cancelPayment(paymentId, userId);
}

// ─── Export All ──────────────────────────────────────────────────────────────

export * from './payment-types';
export * from './payment-validator';
export * from './transaction-verifier';
export * from './payment-events';
export * from './payment-lifecycle';
