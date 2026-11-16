/**
 * Webhook Endpoint Management — Phase 2.2
 *
 * POST   /api/developer/applications/:id/webhooks       Create webhook endpoint
 * GET    /api/developer/applications/:id/webhooks       List webhook endpoints
 *
 * AUTHENTICATION
 *   Session-authenticated merchant account
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';

// ─── Request Validation Schemas ──────────────────────────────────────────────

const createWebhookSchema = z.object({
  url: z.string().url().startsWith('https://', 'Webhook URLs must use HTTPS'),
  description: z.string().max(500).optional(),
  enabled_events: z
    .array(
      z.enum([
        'payment.created',
        'payment.paid',
        'payment.failed',
        'payment.expired',
        'payment.cancelled',
        'payment.underpaid',
        'payment.overpaid',
      ]),
    )
    .optional(),
});

// ─── POST /api/developer/applications/:id/webhooks ───────────────────────────

/**
 * Creates a new webhook endpoint for an application.
 *
 * REQUEST BODY (JSON)
 *   {
 *     "url": "https://example.com/webhooks/lumiapay",
 *     "description": "Production webhook",
 *     "enabled_events": ["payment.paid", "payment.failed"]
 *   }
 *
 * RESPONSE (201 Created)
 *   {
 *     "id": "...",
 *     "url": "https://example.com/webhooks/lumiapay",
 *     "secret": "whsec_abc123...",
 *     "description": "Production webhook",
 *     "enabled_events": ["payment.paid", "payment.failed"],
 *     "status": "active",
 *     "created_at": "...",
 *     "warning": "Save your webhook secret now. You can rotate it but cannot view it again."
 *   }
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

  // ── Verify Application Ownership ───────────────────────────────────────────
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, status')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (appError || !application) {
    return NextResponse.json(
      { error: 'application_not_found', message: 'Application not found' },
      { status: 404 },
    );
  }

  if (application.status !== 'active') {
    return NextResponse.json(
      {
        error: 'application_inactive',
        message: 'Cannot create webhooks for inactive applications',
      },
      { status: 403 },
    );
  }

  // ── Request Validation ─────────────────────────────────────────────────────
  let body: z.infer<typeof createWebhookSchema>;
  try {
    const rawBody = await req.json();
    body = createWebhookSchema.parse(rawBody);
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

  // ── Check for Duplicate URL ────────────────────────────────────────────────
  const { data: existingWebhook } = await supabase
    .from('webhook_endpoints')
    .select('id')
    .eq('application_id', params.id)
    .eq('url', body.url)
    .single();

  if (existingWebhook) {
    return NextResponse.json(
      {
        error: 'webhook_exists',
        message: 'A webhook with this URL already exists for this application',
      },
      { status: 409 },
    );
  }

  // ── Generate Webhook Secret ────────────────────────────────────────────────
  try {
    const { data: secretData, error: secretError } = await supabase.rpc(
      'generate_webhook_secret',
    );

    if (secretError || !secretData) {
      console.error('[Webhook Creation] Secret generation failed:', secretError);
      return NextResponse.json(
        {
          error: 'creation_failed',
          message: 'Failed to generate webhook secret',
        },
        { status: 500 },
      );
    }

    const secret = secretData as string;

    // ── Insert Webhook Endpoint ────────────────────────────────────────────
    const { data: webhook, error: webhookError } = await supabase
      .from('webhook_endpoints')
      .insert({
        application_id: params.id,
        url: body.url,
        description: body.description || null,
        secret,
        enabled_events: body.enabled_events || [],
        status: 'active',
      })
      .select()
      .single();

    if (webhookError || !webhook) {
      console.error('[Webhook Creation] Insert failed:', webhookError);
      return NextResponse.json(
        {
          error: 'creation_failed',
          message: 'Failed to create webhook endpoint',
        },
        { status: 500 },
      );
    }

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        id: webhook.id,
        url: webhook.url,
        secret, // Only time the full secret is visible
        description: webhook.description,
        enabled_events: webhook.enabled_events,
        status: webhook.status,
        created_at: webhook.created_at,
        warning:
          'Save your webhook secret now. You can rotate it but cannot view it again.',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[Webhook Creation] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}

// ─── GET /api/developer/applications/:id/webhooks ────────────────────────────

/**
 * Lists all webhook endpoints for an application.
 *
 * RESPONSE (200 OK)
 *   {
 *     "data": [
 *       {
 *         "id": "...",
 *         "url": "https://example.com/webhooks/lumiapay",
 *         "description": "Production webhook",
 *         "enabled_events": ["payment.paid"],
 *         "status": "active",
 *         "failure_count": 0,
 *         "last_success_at": "...",
 *         "last_failure_at": null,
 *         "created_at": "..."
 *       }
 *     ]
 *   }
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
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (appError || !application) {
    return NextResponse.json(
      { error: 'application_not_found', message: 'Application not found' },
      { status: 404 },
    );
  }

  // ── Fetch Webhooks ─────────────────────────────────────────────────────────
  try {
    const { data: webhooks, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('application_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Webhook List] Query failed:', error);
      return NextResponse.json(
        {
          error: 'query_failed',
          message: 'Failed to retrieve webhook endpoints',
        },
        { status: 500 },
      );
    }

    // ── Format Response (exclude secret) ───────────────────────────────────
    const formattedWebhooks = (webhooks || []).map((webhook: any) => ({
      id: webhook.id,
      url: webhook.url,
      description: webhook.description,
      enabled_events: webhook.enabled_events,
      status: webhook.status,
      failure_count: webhook.failure_count,
      last_success_at: webhook.last_success_at,
      last_failure_at: webhook.last_failure_at,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at,
    }));

    return NextResponse.json({
      data: formattedWebhooks,
    });
  } catch (err) {
    console.error('[Webhook List] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
