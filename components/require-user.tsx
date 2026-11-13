import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server component guard. Redirects to /login if the user is not authenticated.
 * Use at the top of any protected server page.
 *
 * Returns the authenticated user object for use in the page.
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
