import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

/**
 * DELETE /api/developer/applications/[id]
 * 
 * Permanently deletes an application and all associated data:
 * - API keys
 * - Webhooks
 * - The application record itself
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Authentication ─────────────────────────────────────────────────────────
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication required' },
      { status: 401 },
    );
  }

  // ── Verify Ownership ───────────────────────────────────────────────────────
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (appError || !application) {
    return NextResponse.json(
      { error: 'not_found', message: 'Application not found' },
      { status: 404 },
    );
  }

  // ── Delete Associated Data ─────────────────────────────────────────────────
  
  // Delete API keys
  const { error: keysError } = await supabase
    .from('api_keys')
    .delete()
    .eq('application_id', id);

  if (keysError) {
    console.error('[Delete API Keys Error]', keysError);
    // Continue anyway - we want to delete the application
  }

  // Delete webhooks
  const { error: webhooksError } = await supabase
    .from('webhooks')
    .delete()
    .eq('application_id', id);

  if (webhooksError) {
    console.error('[Delete Webhooks Error]', webhooksError);
    // Continue anyway
  }

  // ── Delete Application ─────────────────────────────────────────────────────
  const { error: deleteError } = await supabase
    .from('applications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('[Delete Application Error]', deleteError);
    return NextResponse.json(
      { error: 'delete_failed', message: 'Failed to delete application' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { success: true, message: 'Application deleted successfully' },
    { status: 200 },
  );
}
