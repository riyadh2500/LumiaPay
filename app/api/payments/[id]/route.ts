import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, err, unauthorized, notFound } from '@/lib/http';
import {
  getPaymentById,
  verifyPayment,
  cancelPendingPayment,
  checkAndExpirePayment,
  ValidationError,
  PaymentEngineError,
  VerificationError,
} from '@/lib/payment-engine';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/payments/[id] ──────────────────────────────────────────────────
// Returns a single payment record. Public — used by the checkout page.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    // Use Payment Engine to get payment with auto-expiry check
    const payment = await getPaymentById(id);

    if (!payment) {
      return notFound('Payment');
    }

    return ok(payment);
  } catch (error) {
    console.error('[GET /api/payments/[id]]', error);
    
    if (error instanceof ValidationError) {
      return err(error.message, error.statusCode);
    }

    return err('Failed to fetch payment', 500);
  }
}

// ─── POST /api/payments/[id]/verify ─────────────────────────────────────────
// Triggers an on-chain verification check for a pending payment.
// We re-use the same [id] route with an action query param: ?action=verify
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  if (searchParams.get('action') !== 'verify') {
    return err('Unknown action', 400);
  }

  try {
    // Use Payment Engine for verification
    const result = await verifyPayment({
      payment_id: id,
      force: false, // Don't force re-verification if already paid
    });

    // Return result in format expected by frontend
    return ok({
      status: result.status,
      txHash: result.tx_hash,
      reason: result.message,
      details: result.details,
    });
  } catch (error) {
    console.error('[POST /api/payments/[id]/verify]', error);

    if (error instanceof ValidationError) {
      return err(error.message, error.statusCode);
    }

    if (error instanceof VerificationError) {
      return err(error.message, error.statusCode);
    }

    if (error instanceof PaymentEngineError) {
      return err(error.message, error.statusCode);
    }

    return err('Verification failed', 500);
  }
}

// ─── DELETE /api/payments/[id] ───────────────────────────────────────────────
// Soft-deletes (cancels) a pending payment. Only the owner can do this.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    // Use Payment Engine for cancellation
    await cancelPendingPayment(id, user.id);
    return ok({ success: true });
  } catch (error) {
    console.error('[DELETE /api/payments/[id]]', error);

    if (error instanceof ValidationError) {
      return err(error.message, error.statusCode);
    }

    if (error instanceof PaymentEngineError) {
      return err(error.message, error.statusCode);
    }

    return err('Failed to cancel payment', 500);
  }
}
