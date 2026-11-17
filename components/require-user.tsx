import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server component guard.
 * Middleware already handles redirects, this just returns the user.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}