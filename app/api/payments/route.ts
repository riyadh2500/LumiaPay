import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err, unauthorized } from '@/lib/http';
import { TOKEN_LIST } from '@/lib/tokens';
import {
  createPaymentIntent,
  getPaymentsByUser,
  ValidationError,
  PaymentEngineError,
} from '@/lib/payment-engine';
import {
  checkRateLimit,
  rateLimitedResponse,
  addRateLimitHeaders,
  RATE_LIMIT_PROFILES,
} from '@/lib/rate-limit';

const VALID_SYMBOLS = TOKEN_LIST.map((t) => t.symbol) as [string, ...string[]];

// ─── GET /api/payments ───────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  // Rate limit by user ID — 60 req/min
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_LIST, user.id);
  if (!rl.allowed) return rateLimitedResponse(rl);

  try {
    const payments = await getPaymentsByUser(user.id);
    return addRateLimitHeaders(ok(payments), rl);
  } catch (error) {
    console.error('[GET /api/payments]', error);
    return err('Failed to fetch payments', 500);
  }
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

  // Rate limit by user ID — 30 req/min
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.PAYMENT_CREATE, user.id);
  if (!rl.allowed) return rateLimitedResponse(rl);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const parsed = CreatePaymentSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  try {
    const admin = createAdminClient();

    const { data: merchant, error: mErr } = await admin
      .from('merchants')
      .select('wallet_address')
      .eq('user_id', user.id)
      .single();

    if (mErr || !merchant) {
      return err('Merchant profile not found. Please complete settings first.', 400);
    }

    const result = await createPaymentIntent({
      user_id: user.id,
      label: parsed.data.label,
      amount: parsed.data.amount,
      currency: parsed.data.currency as 'USDC' | 'EURC',
      wallet_address: merchant.wallet_address,
      ttl_seconds: 15 * 60, // 15 minutes
    });

    return addRateLimitHeaders(ok(result.payment, 201), rl);
  } catch (error) {
    console.error('[POST /api/payments]', error);
    if (error instanceof ValidationError)   return err(error.message, error.statusCode);
    if (error instanceof PaymentEngineError) return err(error.message, error.statusCode);
    return err('Failed to create payment', 500);
  }
}
