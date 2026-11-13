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
  PaymentEngineError 
} from '@/lib/payment-engine';

const VALID_SYMBOLS = TOKEN_LIST.map((t) => t.symbol) as [string, ...string[]];

// ─── GET /api/payments ───────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  try {
    const payments = await getPaymentsByUser(user.id);
    return ok(payments);
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

  try {
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

    // Use Payment Engine to create payment intent
    const result = await createPaymentIntent({
      user_id: user.id,
      label: parsed.data.label,
      amount: parsed.data.amount,
      currency: parsed.data.currency as 'USDC' | 'EURC',
      wallet_address: merchant.wallet_address,
      ttl_seconds: 60 * 60, // 1 hour (keeping existing behavior)
    });

    return ok(result.payment, 201);
  } catch (error) {
    console.error('[POST /api/payments]', error);
    
    if (error instanceof ValidationError) {
      return err(error.message, error.statusCode);
    }
    
    if (error instanceof PaymentEngineError) {
      return err(error.message, error.statusCode);
    }

    return err('Failed to create payment', 500);
  }
}
