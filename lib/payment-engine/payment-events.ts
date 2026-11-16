/**
 * Payment Events Module
 * 
 * Manages payment lifecycle events for audit trails, webhooks,
 * and Developer API integration.
 */

import { createAdminClient } from '../supabase/admin';
import { PaymentEvent, PaymentEventType, PaymentStatus } from './payment-types';
import { createWebhookEvent } from '../webhooks/webhook-service';
import type { WebhookEventPayload, WebhookEventType } from '../webhooks/webhook-service';

// ─── Event Creation ──────────────────────────────────────────────────────────

export interface CreateEventOptions {
  payment_id: string;
  user_id: string;
  event_type: PaymentEventType;
  status: PaymentStatus;
  data?: Record<string, any>;
}

/**
 * Records a payment event in the database for audit and webhook delivery.
 */
export async function createPaymentEvent(
  options: CreateEventOptions
): Promise<PaymentEvent> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('payment_events')
    .insert({
      payment_id: options.payment_id,
      user_id: options.user_id,
      event_type: options.event_type,
      status: options.status,
      data: options.data ?? {},
      processed: false,
    })
    .select()
    .single();

  if (error) {
    console.error('[Create Payment Event Error]', error);
    // Don't throw - event creation failures shouldn't block payment processing
    // But log for monitoring
    return {
      id: '',
      payment_id: options.payment_id,
      user_id: options.user_id,
      event_type: options.event_type,
      status: options.status,
      data: options.data ?? {},
      processed: false,
      created_at: new Date().toISOString(),
    };
  }

  return data as PaymentEvent;
}

// ─── Event History ───────────────────────────────────────────────────────────

/**
 * Retrieves all events for a specific payment.
 */
export async function getPaymentEvents(paymentId: string): Promise<PaymentEvent[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('payment_events')
    .select('*')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Get Payment Events Error]', error);
    return [];
  }

  return (data as PaymentEvent[]) ?? [];
}

// ─── Event Processing Status ─────────────────────────────────────────────────

/**
 * Marks an event as processed (e.g., webhook delivered successfully).
 */
export async function markEventProcessed(eventId: string): Promise<void> {
  const admin = createAdminClient();

  await admin
    .from('payment_events')
    .update({ processed: true })
    .eq('id', eventId);
}

/**
 * Retrieves unprocessed events for webhook delivery.
 * Future use for Developer API webhook system.
 */
export async function getUnprocessedEvents(
  limit: number = 100
): Promise<PaymentEvent[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('payment_events')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Get Unprocessed Events Error]', error);
    return [];
  }

  return (data as PaymentEvent[]) ?? [];
}

// ─── Common Event Creators ───────────────────────────────────────────────────

export async function emitPaymentCreated(
  paymentId: string,
  userId: string,
  paymentData: Record<string, any>
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.created',
    status: 'created',
    data: paymentData,
  });
}

export async function emitPaymentPending(
  paymentId: string,
  userId: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.pending',
    status: 'pending',
  });
}

export async function emitTransactionDetected(
  paymentId: string,
  userId: string,
  txHash: string,
  amount: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'transaction.detected',
    status: 'detecting',
    data: { tx_hash: txHash, amount },
  });
}

export async function emitVerificationStarted(
  paymentId: string,
  userId: string,
  txHash?: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'verification.started',
    status: 'verifying',
    data: txHash ? { tx_hash: txHash } : {},
  });
}

export async function emitPaymentPaid(
  paymentId: string,
  userId: string,
  txHash: string,
  amount: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.paid',
    status: 'paid',
    data: { tx_hash: txHash, verified_amount: amount },
  });

  // Trigger webhook for developer applications
  await triggerWebhook(paymentId, 'payment.paid');
}

export async function emitPaymentUnderpaid(
  paymentId: string,
  userId: string,
  txHash: string,
  received: string,
  expected: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.underpaid',
    status: 'underpaid',
    data: { tx_hash: txHash, received_amount: received, expected_amount: expected },
  });
}

export async function emitPaymentOverpaid(
  paymentId: string,
  userId: string,
  txHash: string,
  received: string,
  expected: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.overpaid',
    status: 'overpaid',
    data: { tx_hash: txHash, received_amount: received, expected_amount: expected },
  });
}

export async function emitPaymentExpired(
  paymentId: string,
  userId: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.expired',
    status: 'expired',
  });

  // Trigger webhook
  await triggerWebhook(paymentId, 'payment.expired');
}

export async function emitPaymentFailed(
  paymentId: string,
  userId: string,
  reason?: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.failed',
    status: 'failed',
    data: reason ? { reason } : {},
  });

  // Trigger webhook
  await triggerWebhook(paymentId, 'payment.failed');
}

export async function emitVerificationFailed(
  paymentId: string,
  userId: string,
  reason: string,
  details?: Record<string, any>
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'verification.failed',
    status: 'failed',
    data: { reason, ...details },
  });
}

export async function emitReviewRequired(
  paymentId: string,
  userId: string,
  reason: string,
  txHash?: string
): Promise<void> {
  await createPaymentEvent({
    payment_id: paymentId,
    user_id: userId,
    event_type: 'payment.review_required',
    status: 'review_required',
    data: { reason, ...(txHash && { tx_hash: txHash }) },
  });
}

// ─── Webhook Integration ─────────────────────────────────────────────────────

/**
 * Helper function to trigger webhook events for payments
 * 
 * Checks if payment is linked to a developer application and creates
 * webhook event for delivery by cron job.
 */
async function triggerWebhook(
  paymentId: string,
  eventType: WebhookEventType,
): Promise<void> {
  try {
    const admin = createAdminClient();

    // Fetch payment with application info
    const { data: payment, error } = await admin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment || !payment.application_id) {
      // No application linked (dashboard payment) - skip webhook
      return;
    }

    // Build webhook payload
    const payload: WebhookEventPayload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      created_at: new Date().toISOString(),
      data: {
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          label: payment.label,
          wallet_address: payment.wallet_address,
          tx_hash: payment.tx_hash,
          verified_amount: payment.verified_amount,
          created_at: payment.created_at,
          expires_at: payment.expires_at,
          paid_at: payment.paid_at,
          environment: payment.environment,
          metadata: payment.metadata,
        },
      },
    };

    // Create webhook event (will be delivered by cron job)
    await createWebhookEvent({
      applicationId: payment.application_id,
      eventType,
      paymentId,
      payload,
    });
  } catch (err) {
    console.error('[Payment Events] Webhook trigger failed:', err);
    // Don't throw - webhook failures shouldn't block payment processing
  }
}

