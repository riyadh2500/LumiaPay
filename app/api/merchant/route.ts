import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err, unauthorized } from '@/lib/http';
import {
  checkRateLimit,
  rateLimitedResponse,
  addRateLimitHeaders,
  RATE_LIMIT_PROFILES,
} from '@/lib/rate-limit';

// ─── GET /api/merchant ──────────────────────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  // Rate limit by user ID — 30 req/min
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.MERCHANT, user.id);
  if (!rl.allowed) return rateLimitedResponse(rl);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchants')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return addRateLimitHeaders(ok(null), rl);
    return err(error.message, 500);
  }

  return addRateLimitHeaders(ok(data), rl);
}

// ─── PUT /api/merchant ──────────────────────────────────────────────────────
const MerchantSchema = z.object({
  business_name: z.string().min(1).max(120),
  wallet_address: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid EVM address'),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  // Rate limit by user ID — 30 req/min (shared bucket with GET)
  const rl = await checkRateLimit(RATE_LIMIT_PROFILES.MERCHANT, user.id);
  if (!rl.allowed) return rateLimitedResponse(rl);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const parsed = MerchantSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchants')
    .upsert(
      { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (error) return err(error.message, 500);
  return addRateLimitHeaders(ok(data), rl);
}
