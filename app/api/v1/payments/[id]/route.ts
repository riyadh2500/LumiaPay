/**
 * Developer API v1 — Single Payment Endpoints
 *
 * GET    /api/v1/payments/:id         Retrieve a payment
 * POST   /api/v1/payments/:id/cancel  Cancel a payment
 *
 * AUTHENTICATION
 *   Requires Authorization: Bearer <api_key>
 *
 * ENVIRONMENT ISOLATION
 *   API keys can only access payments from their own environment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  withApiKeyAuth,
  requirePermission,
  validatePaymentAccess,
} from '@/lib/middleware/api-key-auth';
import type { PaymentRow } from '@/lib/db/types';

// ─── Helper: Fetch and Validate Payment ─────────────────────────────────────

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

// ─── GET /api/v1/payments/:id ────────────────────────────────────────────────

/**
 * Retrieves a single payment by ID.
 *
 * RESPONSE (200 OK)
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "amount": "100.00",
 *     "currency": "USDC",
 *     "status": "paid",
 *     "label": "Invoice #1234",
 *     "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
 *     "tx_hash": "0xabc...",
 *     "verified_amount": "100.00",
 *     "created_at": "2025-01-15T10:00:00Z",
 *     "expires_at": "2025-01-15T10:30:00Z",
 *     "paid_at": "2025-01-15T10:15:00Z",
 *     "environment": "live",
 *     "metadata": { "customer_id": "cus_abc123" }
 *   }
 *
 * ERRORS
 *   401 Unauthorized   Invalid or missing API key
 *   403 Forbidden      Missing payments:read permission
 *   404 Not Found      Payment not found or not accessible
 */
export async function GET(
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
  const permissionError = requirePermission(context, 'payments', 'read');
  if (permissionError) {
    return permissionError;
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

  // ── Validate Access (environment isolation) ────────────────────────────────
  if (!validatePaymentAccess(context, payment)) {
    return NextResponse.json(
      {
        error: 'payment_not_found',
        message: 'Payment not found',
      },
      { status: 404 },
    );
  }

  // ── Build Checkout URL ─────────────────────────────────────────────────────
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || 'https://lumia-pay-two.vercel.app';
  const checkoutUrl = `${baseUrl}/pay/${payment.id}`;

  // ── Response ───────────────────────────────────────────────────────────────
  return NextResponse.json({
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
    checkout_url: checkoutUrl,
  });
}
