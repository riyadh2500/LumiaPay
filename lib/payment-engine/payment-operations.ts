/**
 * Payment Operations — Phase 2.1 Extensions
 *
 * High-level payment operations that integrate developer API features
 * (application_id, environment tracking) with the existing Payment Engine.
 *
 * BACKWARD COMPATIBILITY
 *   The existing createPaymentIntent() function is preserved.
 *   This module adds createPayment() which wraps it with developer API support.
 */

import { createAdminClient } from '../supabase/admin';
import type {
  CreatePaymentIntentInput,
  PaymentIntent,
} from './payment-types';
import { createPaymentIntent } from './payment-service';
import type { AppEnvironment, TokenSymbol } from '../db/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreatePaymentInput {
  userId: string;
  label: string;
  amount: string;
  currency: TokenSymbol;
  walletAddress: string;
  metadata?: Record<string, unknown>;
  /** Optional: links payment to a developer application */
  applicationId?: string;
  /** Optional: 'test' or 'live' environment */
  environment?: AppEnvironment;
  /** Optional: payment expiration in seconds (default 1800 = 30 minutes) */
  ttlSeconds?: number;
}

// ─── Create Payment (Developer API-compatible) ───────────────────────────────

/**
 * Creates a new payment with optional developer API integration.
 *
 * USAGE
 *   Dashboard payments (no API key):
 *     await createPayment({ userId, label, amount, currency, walletAddress })
 *
 *   Developer API payments:
 *     await createPayment({
 *       userId,
 *       label,
 *       amount,
 *       currency,
 *       walletAddress,
 *       applicationId: context.applicationId,
 *       environment: context.environment,
 *     })
 *
 * BACKWARD COMPATIBILITY
 *   Dashboard-created payments (no applicationId/environment) continue
 *   to work exactly as before. Migration 002 columns default to NULL.
 */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<PaymentIntent> {
  // ── Call existing Payment Engine ───────────────────────────────────────────
  const paymentInput: CreatePaymentIntentInput = {
    user_id: input.userId,
    label: input.label,
    amount: input.amount,
    currency: input.currency,
    wallet_address: input.walletAddress,
    ttl_seconds: input.ttlSeconds || 1800, // 30 minutes default
    metadata: input.metadata,
  };

  const result = await createPaymentIntent(paymentInput);

  if (!result.success || !result.payment) {
    throw new Error('Payment creation failed');
  }

  const payment = result.payment;

  // ── Update with Developer API Fields (if provided) ─────────────────────────
  if (input.applicationId && input.environment) {
    const admin = createAdminClient();

    const { data: updatedPayment, error } = await admin
      .from('payments')
      .update({
        application_id: input.applicationId,
        environment: input.environment,
      })
      .eq('id', payment.id)
      .select()
      .single();

    if (error) {
      console.error('[Payment Operations] Failed to update developer fields:', error);
      // Don't fail the request — payment was created successfully
      // Just log the error and return the original payment
      return payment;
    }

    return updatedPayment as PaymentIntent;
  }

  return payment;
}

// ─── Re-export Core Operations ───────────────────────────────────────────────

export {
  verifyPayment,
  getPaymentById,
  getPaymentsByUser,
  cancelPendingPayment,
} from './payment-service';

export type {
  PaymentIntent,
  PaymentStatus,
  CreatePaymentIntentResult,
  VerificationInput,
  VerificationResult,
} from './payment-types';
