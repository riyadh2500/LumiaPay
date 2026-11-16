/**
 * Developer Applications Management — Merchant Dashboard API
 *
 * POST   /api/developer/applications       Create new application
 * GET    /api/developer/applications       List merchant's applications
 *
 * AUTHENTICATION
 *   Session-authenticated merchant account (not API key)
 *
 * PERMISSIONS
 *   Merchants can only manage their own applications
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/developer/api-keys';
import type {
  ApplicationRow,
  ApplicationInsert,
  ApiKeyInsert,
  AppEnvironment,
} from '@/lib/db/types';

// ─── Request Validation Schemas ──────────────────────────────────────────────

const createApplicationSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  environment: z.enum(['test', 'live']),
});

// ─── POST /api/developer/applications ────────────────────────────────────────

/**
 * Creates a new developer application with publishable and secret keys.
 *
 * REQUEST BODY (JSON)
 *   {
 *     "name": "My Store",
 *     "description": "Production e-commerce integration",
 *     "environment": "live"
 *   }
 *
 * RESPONSE (201 Created)
 *   {
 *     "application": {
 *       "id": "...",
 *       "name": "My Store",
 *       "environment": "live",
 *       "status": "active",
 *       "created_at": "..."
 *     },
 *     "keys": {
 *       "publishable": "pk_live_abc123...",
 *       "secret": "sk_live_xyz789..."
 *     },
 *     "warning": "Save your secret key now. You won't be able to see it again."
 *   }
 *
 * ERRORS
 *   401 Unauthorized       Not authenticated
 *   403 Forbidden          Merchant account required
 *   409 Conflict           Application name already exists
 *   422 Unprocessable      Invalid request body
 */
export async function POST(req: NextRequest) {
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

  // ── Verify Merchant Account ───────────────────────────────────────────────
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (merchantError || !merchant) {
    return NextResponse.json(
      {
        error: 'merchant_required',
        message: 'Merchant account required',
      },
      { status: 403 },
    );
  }

  // ── Request Validation ─────────────────────────────────────────────────────
  let body: z.infer<typeof createApplicationSchema>;
  try {
    const rawBody = await req.json();
    body = createApplicationSchema.parse(rawBody);
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

  // ── Check for Name Conflict ────────────────────────────────────────────────
  const { data: existingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', body.name)
    .eq('environment', body.environment)
    .single();

  if (existingApp) {
    return NextResponse.json(
      {
        error: 'name_conflict',
        message: `An application named "${body.name}" already exists in the ${body.environment} environment`,
      },
      { status: 409 },
    );
  }

  // ── Create Application ─────────────────────────────────────────────────────
  try {
    const applicationData: ApplicationInsert = {
      user_id: user.id,
      name: body.name,
      description: body.description || null,
      environment: body.environment,
      status: 'active',
    };

    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert(applicationData)
      .select()
      .single();

    if (appError || !application) {
      console.error('[Developer API] Application creation failed:', appError);
      return NextResponse.json(
        {
          error: 'creation_failed',
          message: 'Failed to create application',
        },
        { status: 500 },
      );
    }

    // ── Generate API Keys ──────────────────────────────────────────────────
    const publishableKey = generateApiKey('publishable', body.environment);
    const secretKey = generateApiKey('secret', body.environment);

    // ── Insert API Keys ────────────────────────────────────────────────────
    const keysToInsert: ApiKeyInsert[] = [
      {
        application_id: application.id,
        name: 'Default Publishable Key',
        key_type: 'publishable',
        key_hash: publishableKey.hash,
        key_prefix: publishableKey.prefix,
        permissions: {
          payments: ['read'],
        },
        status: 'active',
      },
      {
        application_id: application.id,
        name: 'Default Secret Key',
        key_type: 'secret',
        key_hash: secretKey.hash,
        key_prefix: secretKey.prefix,
        permissions: {
          payments: ['read', 'write'],
        },
        status: 'active',
      },
    ];

    const { error: keysError } = await supabase
      .from('api_keys')
      .insert(keysToInsert);

    if (keysError) {
      console.error('[Developer API] API keys creation failed:', keysError);
      // Rollback: delete the application
      await supabase.from('applications').delete().eq('id', application.id);

      return NextResponse.json(
        {
          error: 'key_generation_failed',
          message: 'Failed to generate API keys',
        },
        { status: 500 },
      );
    }

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        application: {
          id: application.id,
          name: application.name,
          description: application.description,
          environment: application.environment,
          status: application.status,
          created_at: application.created_at,
        },
        keys: {
          publishable: publishableKey.plaintext,
          secret: secretKey.plaintext,
        },
        warning:
          'Save your secret key now. You will not be able to see it again.',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[Developer API] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}

// ─── GET /api/developer/applications ─────────────────────────────────────────

/**
 * Lists all applications owned by the authenticated merchant.
 *
 * RESPONSE (200 OK)
 *   {
 *     "data": [
 *       {
 *         "id": "...",
 *         "name": "My Store",
 *         "description": "...",
 *         "environment": "live",
 *         "status": "active",
 *         "created_at": "...",
 *         "last_used_at": "...",
 *         "key_count": 2
 *       }
 *     ]
 *   }
 *
 * ERRORS
 *   401 Unauthorized   Not authenticated
 */
export async function GET(req: NextRequest) {
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

  // ── Fetch Applications ─────────────────────────────────────────────────────
  try {
    const { data: applications, error } = await supabase
      .from('applications')
      .select(
        `
        *,
        api_keys:api_keys(count)
      `,
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Developer API] Application list query failed:', error);
      return NextResponse.json(
        {
          error: 'query_failed',
          message: 'Failed to retrieve applications',
        },
        { status: 500 },
      );
    }

    // ── Format Response ────────────────────────────────────────────────────
    const formattedApps = (applications || []).map((app: any) => ({
      id: app.id,
      name: app.name,
      description: app.description,
      environment: app.environment,
      status: app.status,
      created_at: app.created_at,
      updated_at: app.updated_at,
      last_used_at: app.last_used_at,
      key_count: app.api_keys?.[0]?.count || 0,
    }));

    return NextResponse.json({
      data: formattedApps,
    });
  } catch (err) {
    console.error('[Developer API] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
