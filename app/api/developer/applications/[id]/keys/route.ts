/**
 * API Key Management — Merchant Dashboard API
 *
 * POST   /api/developer/applications/:id/keys       Create new API key
 * GET    /api/developer/applications/:id/keys       List application's keys
 *
 * AUTHENTICATION
 *   Session-authenticated merchant account
 *
 * PERMISSIONS
 *   Merchants can only manage keys for their own applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/developer/api-keys';
import type { ApiKeyInsert, ApiKeyRow, ApplicationRow } from '@/lib/db/types';

// ─── Request Validation Schemas ──────────────────────────────────────────────

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  key_type: z.enum(['publishable', 'secret']),
  permissions: z
    .object({
      payments: z.array(z.enum(['read', 'write'])).optional(),
      webhooks: z.array(z.enum(['read', 'write'])).optional(),
    })
    .optional(),
  expires_at: z.string().datetime().optional(),
});

// ─── Helper: Fetch and Validate Application ──────────────────────────────────

async function fetchApplication(
  applicationId: string,
  userId: string,
): Promise<ApplicationRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ApplicationRow;
}

// ─── POST /api/developer/applications/:id/keys ───────────────────────────────

/**
 * Creates a new API key for an application.
 *
 * REQUEST BODY (JSON)
 *   {
 *     "name": "Production API Key",
 *     "key_type": "secret",
 *     "permissions": {
 *       "payments": ["read", "write"]
 *     },
 *     "expires_at": "2026-01-15T00:00:00Z"  // optional
 *   }
 *
 * RESPONSE (201 Created)
 *   {
 *     "id": "...",
 *     "name": "Production API Key",
 *     "key_type": "secret",
 *     "key": "sk_live_abc123...",
 *     "key_prefix": "sk_live_abc123…",
 *     "permissions": { ... },
 *     "created_at": "...",
 *     "warning": "Save this key now. You won't be able to see it again."
 *   }
 *
 * ERRORS
 *   401 Unauthorized       Not authenticated
 *   403 Forbidden          Application not owned by user
 *   404 Not Found          Application not found
 *   422 Unprocessable      Invalid request body
 */
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
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

  // ── Fetch and Validate Application ─────────────────────────────────────────
  const application = await fetchApplication(params.id, user.id);

  if (!application) {
    return NextResponse.json(
      {
        error: 'application_not_found',
        message: 'Application not found',
      },
      { status: 404 },
    );
  }

  if (application.status !== 'active') {
    return NextResponse.json(
      {
        error: 'application_inactive',
        message: 'Cannot create keys for inactive applications',
      },
      { status: 403 },
    );
  }

  // ── Request Validation ─────────────────────────────────────────────────────
  let body: z.infer<typeof createKeySchema>;
  try {
    const rawBody = await req.json();
    body = createKeySchema.parse(rawBody);
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
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid JSON' },
      { status: 400 },
    );
  }

  // ── Generate API Key ───────────────────────────────────────────────────────
  try {
    const generatedKey = generateApiKey(body.key_type, application.environment);

    // ── Default Permissions ────────────────────────────────────────────────
    const defaultPermissions =
      body.key_type === 'publishable'
        ? { payments: ['read' as const] }
        : { payments: ['read' as const, 'write' as const] };

    const permissions = body.permissions || defaultPermissions;

    // ── Insert Key ─────────────────────────────────────────────────────────
    const keyData: ApiKeyInsert = {
      application_id: application.id,
      name: body.name,
      key_type: body.key_type,
      key_hash: generatedKey.hash,
      key_prefix: generatedKey.prefix,
      permissions,
      status: 'active',
      expires_at: body.expires_at || null,
    };

    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .insert(keyData)
      .select()
      .single();

    if (keyError || !apiKey) {
      console.error('[API Key Management] Key creation failed:', keyError);
      return NextResponse.json(
        {
          error: 'creation_failed',
          message: 'Failed to create API key',
        },
        { status: 500 },
      );
    }

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        id: apiKey.id,
        name: apiKey.name,
        key_type: apiKey.key_type,
        key: generatedKey.plaintext, // Only time the full key is visible
        key_prefix: apiKey.key_prefix,
        permissions: apiKey.permissions,
        expires_at: apiKey.expires_at,
        created_at: apiKey.created_at,
        warning:
          'Save this key now. You will not be able to see it again.',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[API Key Management] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}

// ─── GET /api/developer/applications/:id/keys ────────────────────────────────

/**
 * Lists all API keys for an application.
 *
 * RESPONSE (200 OK)
 *   {
 *     "data": [
 *       {
 *         "id": "...",
 *         "name": "Production API Key",
 *         "key_type": "secret",
 *         "key_prefix": "sk_live_abc123…",
 *         "status": "active",
 *         "permissions": { ... },
 *         "usage_count": 1247,
 *         "last_used_at": "...",
 *         "expires_at": null,
 *         "created_at": "..."
 *       }
 *     ]
 *   }
 *
 * ERRORS
 *   401 Unauthorized   Not authenticated
 *   404 Not Found      Application not found
 */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
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

  // ── Validate Application Ownership ─────────────────────────────────────────
  const application = await fetchApplication(params.id, user.id);

  if (!application) {
    return NextResponse.json(
      {
        error: 'application_not_found',
        message: 'Application not found',
      },
      { status: 404 },
    );
  }

  // ── Fetch API Keys ─────────────────────────────────────────────────────────
  try {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('application_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API Key Management] Key list query failed:', error);
      return NextResponse.json(
        {
          error: 'query_failed',
          message: 'Failed to retrieve API keys',
        },
        { status: 500 },
      );
    }

    // ── Format Response (exclude key_hash) ─────────────────────────────────
    const formattedKeys = (keys || []).map((key: ApiKeyRow) => ({
      id: key.id,
      name: key.name,
      key_type: key.key_type,
      key_prefix: key.key_prefix, // Safe to show (non-secret)
      status: key.status,
      permissions: key.permissions,
      usage_count: key.usage_count,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      revoked_at: key.revoked_at,
      revoked_reason: key.revoked_reason,
      created_at: key.created_at,
    }));

    return NextResponse.json({
      data: formattedKeys,
    });
  } catch (err) {
    console.error('[API Key Management] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
