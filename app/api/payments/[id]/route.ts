import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err, unauthorized, notFound } from '@/lib/http';
import { verifyPayment } from '@/lib/evm-verify';
import { TokenSymbol } from '@/lib/tokens';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/payments/[id] ──────────────────────────────────────────────────
// Returns a single payment record. Public — used by the checkout page.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return notFound('Payment');

  // Auto-expire if TTL has passed.
  if (data.status === 'pending') {
    const now = new Date().toISOString();
    const { data: updated } = await admin
      .from('payments')
      .update({ status: 'expired' })
      .eq('id', id)
      .eq('status', 'pending')
      .lt('expires_at', now)
      .select('status')
      .single();

    if (updated) data.status = 'expired';
  }

  return ok(data);
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !payment) return notFound('Payment');

  // Only the owning merchant or the public checkout can verify.
  // For the checkout page, no auth is needed (payment is public by id).
  if (payment.status !== 'pending') {
    return ok({ status: payment.status });
  }

  // Check expiry.
  const { data: expiredCheck } = await admin
    .from('payments')
    .update({ status: 'expired' })
    .eq('id', id)
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
    .select('status')
    .single();

  if (expiredCheck) {
    return ok({ status: 'expired' });
  }

  const result = await verifyPayment({
    symbol: payment.currency as TokenSymbol,
    recipientAddress: payment.wallet_address,
    expectedAmount: payment.amount,
    createdAt: payment.created_at,
  });

  if (result.verified) {
    await admin
      .from('payments')
      .update({ status: 'paid', tx_hash: result.txHash })
      .eq('id', id);
    return ok({ status: 'paid', txHash: result.txHash });
  }

  return ok({ status: 'pending', reason: result.reason });
}

// ─── DELETE /api/payments/[id] ───────────────────────────────────────────────
// Soft-deletes (cancels) a pending payment. Only the owner can do this.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from('payments')
    .select('user_id, status')
    .eq('id', id)
    .single();

  if (!payment) return notFound('Payment');
  if (payment.user_id !== user.id) return unauthorized();
  if (payment.status !== 'pending') return err('Only pending payments can be cancelled', 400);

  await admin.from('payments').update({ status: 'failed' }).eq('id', id);
  return ok({ success: true });
}
