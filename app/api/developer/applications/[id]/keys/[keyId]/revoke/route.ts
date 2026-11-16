/**
 * API Key Revocation Endpoint
 *
 * POST   /api/developer/applications/:id/keys/:keyId/revoke
 *
 * Immediately revokes an API key. Revoked keys cannot be used for authentication.
 *
 * AUTHENTICATION
 *   Session-authenticated merchant account
 *
 * PERMISSIONS
 *   Merchants can only revoke keys from their own applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { ApiKeyRow } from '@/lib/db/types';

// ─── Request Validation Schema ────────────────────────────────────────────────

const revokeKeySchema = z.object({
  reason: z.string().max(500).optional(),
});

// ─── POST /api/developer/applications/:id/keys/:keyId/revoke ─────────────────

/**
 * Revokes an API key immediately.
 *
 * REQUEST BODY (JSON, optional)
 *   {
 *     "reason": "Key compromised"
 *   }
 *
 * RESPONSE (200 OK)
 *   {
 *     "id": "...",
 *     "status": "revoked",
 *     "revoked_at": "2025-01-15T10:20:00Z",
 *     "revoked_reason": "Key compromised"
 *   }
 *
 * ERRORS
 *   401 Unauthorized       Not authenticated
 *   403 Forbidden          Key not owned by user
 *   404 Not Found          Key not found
 *   422 Unprocessable      Key already revoked
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; keyId: string }> },
) {
  const params = await props.params;
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

  // ── Verify Application Ownership ───────────────────────────────────────────
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (appError || !application) {
    return NextResponse.json(
      {
        error: 'application_not_found',
        message: 'Application not found',
      },
      { status: 404 },
    );
  }

  // ── Fetch API Key ──────────────────────────────────────────────────────────
  const { data: apiKey, error: keyError } = await supabase
    .from('api_keys')
    .select('*')
    .eq('id', params.keyId)
    .eq('application_id', params.id)
    .single();

  if (keyError || !apiKey) {
    return NextResponse.json(
      {
        error: 'key_not_found',
        message: 'API key not found',
      },
      { status: 404 },
    );
  }

  // ── Check if Already Revoked ───────────────────────────────────────────────
  if (apiKey.status === 'revoked') {
    return NextResponse.json(
      {
        error: 'already_revoked',
        message: 'This API key has already been revoked',
      },
      { status: 422 },
    );
  }

  // ── Parse Request Body ─────────────────────────────────────────────────────
  let body: z.infer<typeof revokeKeySchema> = {};
  try {
    const rawBody = await req.json().catch(() => ({}));
    body = revokeKeySchema.parse(rawBody);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid request body',
          details: err.errors,
        },
        { status: 422 },
      );
    }
  }

  // ── Revoke Key ─────────────────────────────────────────────────────────────
  try {
    const now = new Date().toISOString();

    const { data: revokedKey, error: revokeError } = await supabase
      .from('api_keys')
      .update({
        status: 'revoked',
        revoked_at: now,
        revoked_reason: body.reason || null,
      })
      .eq('id', params.keyId)
      .select()
      .single();

    if (revokeError || !revokedKey) {
      console.error('[API Key Revocation] Revocation failed:', revokeError);
      return NextResponse.json(
        {
          error: 'revocation_failed',
          message: 'Failed to revoke API key',
        },
        { status: 500 },
      );
    }

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json({
      id: revokedKey.id,
      status: revokedKey.status,
      revoked_at: revokedKey.revoked_at,
      revoked_reason: revokedKey.revoked_reason,
    });
  } catch (err) {
    console.error('[API Key Revocation] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
