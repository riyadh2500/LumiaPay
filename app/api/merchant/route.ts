import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, err, unauthorized } from '@/lib/http';

// ─── GET /api/merchant ──────────────────────────────────────────────────────
// Returns the current user's merchant profile.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchants')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) {
    // No profile yet — return empty object so the settings page can handle first-time setup.
    if (error.code === 'PGRST116') return ok(null);
    return err(error.message, 500);
  }

  return ok(data);
}

// ─── PUT /api/merchant ──────────────────────────────────────────────────────
// Upserts the merchant profile (name + wallet address).
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON');
  }

  const parsed = MerchantSchema.safeParse(body);
  if (!parsed.success) {
    return err(parsed.error.errors[0].message);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('merchants')
    .upsert(
      { user_id: user.id, ...parsed.data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok(data);
}
