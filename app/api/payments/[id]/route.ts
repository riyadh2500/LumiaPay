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
import {
  checkRateLimit,
  getClientIp,
  rateLimitedResponse,
  addRateLimitHeaders,
  RATE_LIMIT_PROFILES,
} from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/payments/[id] ──────────────────────────────────────────────────
// Returns a single payment record. Public — used by the checkout page.
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Rate limit by IP — 60 req/min on the public status endpoint
  const ip = getClientIp(req);
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_STATUS, ip);
  if (!rl.allowed) return rateLimitedResponse(rl);

  try {
    const payment = await getPaymentById(id);
    if (!payment) return notFound('Payment');

    return addRateLimitHeaders(ok(payment), rl);
  } catch (error) {
    console.error('[GET /api/payments/[id]]', error);
    if (error instanceof ValidationError) return err(error.message, error.statusCode);
    return err('Failed to fetch payment', 500);
  }
}

// ─── POST /api/payments/[id]?action=verify ───────────────────────────────────
// Triggers an on-chain verification check. Public — used by checkout polling.
// CRITICAL: this triggers Arc RPC calls. Uses fail-closed rate limiting.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  if (searchParams.get('action') !== 'verify') {
    return err('Unknown action', 400);
  }

  // Rate limit by IP — 10 req/min, fail-closed (protects RPC budget)
  const ip = getClientIp(request);
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_VERIFY, ip);
  if (!rl.allowed) return rateLimitedResponse(rl);

  try {
    const result = await verifyPayment({ payment_id: id, force: false });

    return addRateLimitHeaders(
      ok({
        status: result.status,
        txHash: result.tx_hash,
        reason: result.message,
        details: result.details,
      }),
      rl,
    );
  } catch (error) {
    console.error('[POST /api/payments/[id]/verify]', error);
    if (error instanceof ValidationError)   return err(error.message, error.statusCode);
    if (error instanceof VerificationError) return err(error.message, error.statusCode);
    if (error instanceof PaymentEngineError) return err(error.message, error.statusCode);
    return err('Verification failed', 500);
  }
}

// ─── DELETE /api/payments/[id] ───────────────────────────────────────────────
// Soft-deletes (cancels) a pending payment. Only the owner can do this.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  // Rate limit by user ID — authenticated, 20 req/min
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CANCEL, user.id);
  if (!rl.allowed) return rateLimitedResponse(rl);

  try {
    await cancelPendingPayment(id, user.id);
    return addRateLimitHeaders(ok({ success: true }), rl);
  } catch (error) {
    console.error('[DELETE /api/payments/[id]]', error);
    if (error instanceof ValidationError)   return err(error.message, error.statusCode);
    if (error instanceof PaymentEngineError) return err(error.message, error.statusCode);
    return err('Failed to cancel payment', 500);
  }
}
