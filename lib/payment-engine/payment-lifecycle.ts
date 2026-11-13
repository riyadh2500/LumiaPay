/**
 * Payment Lifecycle Management
 * 
 * Handles payment status transitions, expiry checks, and state management
 * with strict validation to prevent invalid transitions.
 */

import { createAdminClient } from '../supabase/admin';
import {
  PaymentIntent,
  PaymentStatus,
  ValidationError,
} from './payment-types';
import {
  validateStatusTransition,
  isExpired,
} from './payment-validator';
import * as Events from './payment-events';

// ─── Status Updates ──────────────────────────────────────────────────────────

export interface UpdateStatusOptions {
  payment_id: string;
  new_status: PaymentStatus;
  tx_hash?: string;
  verified_amount?: string;
  emit_event?: boolean;
}

/**
 * Updates payment status with validation and event emission.
 * Ensures only valid status transitions are allowed.
 */
export async function updatePaymentStatus(
  options: UpdateStatusOptions
): Promise<PaymentIntent> {
  const admin = createAdminClient();

  // Fetch current payment
  const { data: payment, error: fetchError } = await admin
    .from('payments')
    .select('*')
    .eq('id', options.payment_id)
    .single();

  if (fetchError || !payment) {
    throw new ValidationError('Payment not found', { payment_id: options.payment_id });
  }

  const currentStatus = payment.status as PaymentStatus;

  // Validate transition
  validateStatusTransition(currentStatus, options.new_status);

  // Prepare update data
  const updateData: Record<string, any> = {
    status: options.new_status,
  };

  if (options.tx_hash) {
    updateData.tx_hash = options.tx_hash;
  }

  if (options.verified_amount) {
    updateData.verified_amount = options.verified_amount;
  }

  // Set paid_at timestamp for paid status
  if (options.new_status === 'paid' && !payment.paid_at) {
    updateData.paid_at = new Date().toISOString();
  }

  // Update payment
  const { data: updated, error: updateError } = await admin
    .from('payments')
    .update(updateData)
    .eq('id', options.payment_id)
    .select()
    .single();

  if (updateError) {
    console.error('[Update Payment Status Error]', updateError);
    throw new ValidationError('Failed to update payment status', {
      error: updateError.message,
    });
  }

  // Emit event if requested
  if (options.emit_event !== false) {
    await emitStatusChangeEvent(updated as PaymentIntent, options.new_status);
  }

  return updated as PaymentIntent;
}

// ─── Expiry Management ───────────────────────────────────────────────────────

/**
 * Checks and updates expired payments.
 * Returns the current payment status after expiry check.
 */
export async function checkAndExpirePayment(paymentId: string): Promise<PaymentStatus> {
  const admin = createAdminClient();

  // Fetch payment
  const { data: payment, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    throw new ValidationError('Payment not found', { payment_id: paymentId });
  }

  // Only expire if currently pending
  if (payment.status !== 'pending') {
    return payment.status as PaymentStatus;
  }

  // Check if expired
  if (isExpired(payment.expires_at)) {
    await updatePaymentStatus({
      payment_id: paymentId,
      new_status: 'expired',
      emit_event: true,
    });

    return 'expired';
  }

  return payment.status as PaymentStatus;
}

/**
 * Batch expires all pending payments that have passed their expiry time.
 * Useful for background job processing.
 */
export async function expirePendingPayments(): Promise<number> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: expiredPayments, error } = await admin
    .from('payments')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', now)
    .select('id, user_id');

  if (error) {
    console.error('[Expire Pending Payments Error]', error);
    return 0;
  }

  // Emit events for each expired payment
  if (expiredPayments && expiredPayments.length > 0) {
    for (const payment of expiredPayments) {
      await Events.emitPaymentExpired(payment.id, payment.user_id);
    }
  }

  return expiredPayments?.length ?? 0;
}

// ─── Payment Retrieval ───────────────────────────────────────────────────────

/**
 * Retrieves a payment by ID with automatic expiry check.
 */
export async function getPayment(paymentId: string): Promise<PaymentIntent | null> {
  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (error || !payment) {
    return null;
  }

  // Auto-expire if needed
  if (payment.status === 'pending' && isExpired(payment.expires_at)) {
    await updatePaymentStatus({
      payment_id: paymentId,
      new_status: 'expired',
      emit_event: true,
    });
    payment.status = 'expired';
  }

  return payment as PaymentIntent;
}

/**
 * Retrieves all payments for a user.
 */
export async function getUserPayments(userId: string): Promise<PaymentIntent[]> {
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
 * Cancels a pending payment (sets status to failed).
 */
export async function cancelPayment(paymentId: string, userId: string): Promise<PaymentIntent> {
  const admin = createAdminClient();

  // Verify ownership and status
  const { data: payment, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .single();

  if (error || !payment) {
    throw new ValidationError('Payment not found or access denied', {
      payment_id: paymentId,
    });
  }

  if (payment.status !== 'pending') {
    throw new ValidationError('Only pending payments can be cancelled', {
      current_status: payment.status,
    });
  }

  return await updatePaymentStatus({
    payment_id: paymentId,
    new_status: 'failed',
    emit_event: true,
  });
}

// ─── Helper: Event Emission ──────────────────────────────────────────────────

async function emitStatusChangeEvent(
  payment: PaymentIntent,
  status: PaymentStatus
): Promise<void> {
  switch (status) {
    case 'pending':
      await Events.emitPaymentPending(payment.id, payment.user_id);
      break;
    case 'paid':
      if (payment.tx_hash && payment.verified_amount) {
        await Events.emitPaymentPaid(
          payment.id,
          payment.user_id,
          payment.tx_hash,
          payment.verified_amount
        );
      }
      break;
    case 'expired':
      await Events.emitPaymentExpired(payment.id, payment.user_id);
      break;
    case 'failed':
      await Events.emitPaymentFailed(payment.id, payment.user_id);
      break;
    case 'underpaid':
      if (payment.tx_hash && payment.verified_amount) {
        await Events.emitPaymentUnderpaid(
          payment.id,
          payment.user_id,
          payment.tx_hash,
          payment.verified_amount,
          payment.amount
        );
      }
      break;
    case 'overpaid':
      if (payment.tx_hash && payment.verified_amount) {
        await Events.emitPaymentOverpaid(
          payment.id,
          payment.user_id,
          payment.tx_hash,
          payment.verified_amount,
          payment.amount
        );
      }
      break;
    case 'review_required':
      await Events.emitReviewRequired(
        payment.id,
        payment.user_id,
        'Manual review required',
        payment.tx_hash ?? undefined
      );
      break;
  }
}

// ─── Transaction Assignment ──────────────────────────────────────────────────

/**
 * Assigns a verified transaction to a payment with uniqueness check.
 * Prevents transaction reuse across multiple payments.
 */
export async function assignTransaction(
  paymentId: string,
  txHash: string,
  verifiedAmount: string
): Promise<void> {
  const admin = createAdminClient();

  // Check if transaction is already used
  const { data: existing } = await admin
    .from('payment_transactions')
    .select('payment_id')
    .eq('tx_hash', txHash)
    .single();

  if (existing && existing.payment_id !== paymentId) {
    throw new ValidationError('Transaction already used for another payment', {
      tx_hash: txHash,
      existing_payment_id: existing.payment_id,
    });
  }

  // Insert or update transaction record
  await admin
    .from('payment_transactions')
    .upsert({
      payment_id: paymentId,
      tx_hash: txHash,
      verified_amount: verifiedAmount,
      verified_at: new Date().toISOString(),
    });
}
