import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err, unauthorized } from '@/lib/http';
import { TOKEN_LIST } from '@/lib/tokens';

const VALID_SYMBOLS = TOKEN_LIST.map((t) => t.symbol) as [string, ...string[]];

// ─── GET /api/payments ───────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

// ─── POST /api/payments ──────────────────────────────────────────────────────
const CreatePaymentSchema = z.object({
  label: z.string().min(1).max(200),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Amount must be a positive number'),
  currency: z.enum(VALID_SYMBOLS as [string, ...string[]]),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const parsed = CreatePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.errors[0].message);
  }

  const admin = createAdminClient();

  // Fetch merchant wallet address.
  const { data: merchant, error: mErr } = await admin
    .from('merchants')
    .select('wallet_address')
    .eq('user_id', user.id)
    .single();

  if (mErr || !merchant) {
    return err('Merchant profile not found. Please complete settings first.', 400);
  }

  // Set expires_at 15 minutes from now (UTC ISO string).
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { data, error } = await admin
    .from('payments')
    .insert({
      user_id: user.id,
      label: parsed.data.label,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      wallet_address: merchant.wallet_address,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/payments]', error);
    return err(error.message, 500);
  }

  return ok(data, 201);
}
