/**
 * Developer API v1 — Cancel Payment Endpoint
 *
 * POST   /api/v1/payments/:id/cancel
 *
 * Cancels a pending payment. Only payments in 'pending', 'created', or
 * 'detecting' status can be cancelled.
 *
 * AUTHENTICATION
 *   Requires Authorization: Bearer <api_key>
 *   Requires payments:cancel permission
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  withApiKeyAuth,
  hasPermission,
  validatePaymentAccess,
  forbiddenResponse,
} from '@/lib/middleware/api-key-auth';
import type { PaymentRow } from '@/lib/db/types';

// ─── Helper: Fetch Payment ───────────────────────────────────────────────────

async function fetchPayment(
  paymentId: string,
  userId: string,
): Promise<PaymentRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as PaymentRow;
}

// ─── POST /api/v1/payments/:id/cancel ────────────────────────────────────────

/**
 * Cancels a pending payment.
 *
 * REQUEST BODY (empty)
 *
 * RESPONSE (200 OK)
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "status": "expired",
 *     "cancelled_at": "2025-01-15T10:20:00Z"
 *   }
 *
 * ERRORS
 *   401 Unauthorized         Invalid or missing API key
 *   403 Forbidden            Missing payments:cancel permission
 *   404 Not Found            Payment not found
 *   422 Unprocessable        Payment cannot be cancelled (wrong status)
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  // ── Authentication ─────────────────────────────────────────────────────────
  const authResult = await withApiKeyAuth(req);
  if (!authResult.success) {
    return authResult.error;
  }
  const { context } = authResult;

  // ── Authorization ──────────────────────────────────────────────────────────
  // Check for payments:cancel permission
  // If not present, check for payments:write as fallback
  const hasCancel = hasPermission(context, 'payments', 'cancel' as any);
  const hasWrite = hasPermission(context, 'payments', 'write');

  if (!hasCancel && !hasWrite) {
    return forbiddenResponse('payments', 'cancel');
  }

  // ── Fetch Payment ──────────────────────────────────────────────────────────
  const payment = await fetchPayment(params.id, context.userId);

  if (!payment) {
    return NextResponse.json(
      {
        error: 'payment_not_found',
        message: 'Payment not found',
      },
      { status: 404 },
    );
  }

  // ── Validate Access ────────────────────────────────────────────────────────
  if (!validatePaymentAccess(context, payment)) {
    return NextResponse.json(
      {
        error: 'payment_not_found',
        message: 'Payment not found',
      },
      { status: 404 },
    );
  }

  // ── Validate Cancellable Status ────────────────────────────────────────────
  const cancellableStatuses = ['pending', 'created', 'detecting'];
  if (!cancellableStatuses.includes(payment.status)) {
    return NextResponse.json(
      {
        error: 'payment_not_cancellable',
        message: `Payment with status "${payment.status}" cannot be cancelled`,
      },
      { status: 422 },
    );
  }

  // ── Update Payment Status ──────────────────────────────────────────────────
  try {
    const supabase = await createServerClient();
    const now = new Date().toISOString();

    const { data: updatedPayment, error } = await supabase
      .from('payments')
      .update({ status: 'expired' })
      .eq('id', params.id)
      .select()
      .single();

    if (error || !updatedPayment) {
      console.error('[API v1] Payment cancellation failed:', error);
      return NextResponse.json(
        {
          error: 'cancellation_failed',
          message: 'Failed to cancel payment',
        },
        { status: 500 },
      );
    }

    // ── Create Payment Event ───────────────────────────────────────────────
    await supabase.from('payment_events').insert({
      payment_id: payment.id,
      user_id: context.userId,
      application_id: context.applicationId,
      event_type: 'payment.cancelled',
      status: 'expired',
      data: {
        cancelled_via: 'api',
        cancelled_at: now,
      },
      processed: false,
    });

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json({
      id: updatedPayment.id,
      status: updatedPayment.status,
      cancelled_at: now,
    });
  } catch (err) {
    console.error('[API v1] Unexpected error during cancellation:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
