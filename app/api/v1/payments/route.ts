/**
 * Developer API v1 — Payments Collection Endpoints
 *
 * POST   /api/v1/payments       Create a new payment
 * GET    /api/v1/payments       List payments (paginated)
 *
 * AUTHENTICATION
 *   Requires Authorization: Bearer <api_key>
 *
 * RATE LIMITING
 *   Integrated with existing rate limiting system (merchant profile)
 *
 * ENVIRONMENT ISOLATION
 *   test keys: payments are simulated (no blockchain interaction)
 *   live keys: real Arc network transactions
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createServerClient } from '@/lib/supabase/server';
import {
  withApiKeyAuth,
  requirePermission,
  validatePaymentAccess,
} from '@/lib/middleware/api-key-auth';
import { createPayment } from '@/lib/payment-engine/payment-operations';
import { checkRateLimit, RATE_LIMIT_PROFILES } from '@/lib/rate-limit';
import type { PaymentRow } from '@/lib/db/types';

// ─── Request Validation Schemas ──────────────────────────────────────────────

const createPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount format'),
  currency: z.enum(['USDC', 'EURC']),
  label: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});

const listPaymentsSchema = z.object({
  status: z
    .enum([
      'created',
      'pending',
      'detecting',
      'verifying',
      'paid',
      'underpaid',
      'overpaid',
      'expired',
      'failed',
      'review_required',
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── POST /api/v1/payments ───────────────────────────────────────────────────

/**
 * Creates a new payment request.
 *
 * REQUEST BODY (JSON)
 *   {
 *     "amount": "100.00",
 *     "currency": "USDC",
 *     "label": "Invoice #1234",
 *     "metadata": { "customer_id": "cus_abc123" }  // optional
 *   }
 *
 * RESPONSE (201 Created)
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "amount": "100.00",
 *     "currency": "USDC",
 *     "status": "pending",
 *     "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7",
 *     "expires_at": "2025-01-15T10:30:00Z",
 *     "checkout_url": "https://lumia-pay.vercel.app/checkout/550e8400-...",
 *     "created_at": "2025-01-15T10:00:00Z"
 *   }
 *
 * ERRORS
 *   401 Unauthorized       Invalid or missing API key
 *   403 Forbidden          Missing payments:write permission
 *   422 Unprocessable      Invalid request body
 *   429 Too Many Requests  Rate limit exceeded
 *   500 Internal Error     Payment creation failed
 */
export async function POST(req: NextRequest) {
  // ── Authentication ─────────────────────────────────────────────────────────
  const authResult = await withApiKeyAuth(req);
  if (!authResult.success) {
    return authResult.error;
  }
  const { context } = authResult;

  // ── Authorization ──────────────────────────────────────────────────────────
  const permissionError = requirePermission(context, 'payments', 'write');
  if (permissionError) {
    return permissionError;
  }

  // ── Rate Limiting ──────────────────────────────────────────────────────────
  const rateLimitResult = await checkRateLimit(
    RATE_LIMIT_PROFILES.PAYMENT_CREATE,
    context.userId,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'rate_limit_exceeded',
        message: 'Too many requests. Please try again later.',
        retry_after: rateLimitResult.retryAfter,
      },
      { status: 429 },
    );
  }

  // ── Request Validation ─────────────────────────────────────────────────────
  let body: z.infer<typeof createPaymentSchema>;
  try {
    const rawBody = await req.json();
    body = createPaymentSchema.parse(rawBody);
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
      {
        error: 'invalid_request',
        message: 'Request body must be valid JSON',
      },
      { status: 400 },
    );
  }

  // ── Fetch Merchant Wallet Address ─────────────────────────────────────────
  const supabase = await createServerClient();
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('wallet_address')
    .eq('user_id', context.userId)
    .single();

  if (merchantError || !merchant) {
    console.error('[API v1] Merchant lookup failed:', merchantError);
    return NextResponse.json(
      {
        error: 'merchant_not_found',
        message: 'Merchant account not found',
      },
      { status: 404 },
    );
  }

  // ── Create Payment ─────────────────────────────────────────────────────────
  try {
    const payment = await createPayment({
      userId: context.userId,
      label: body.label,
      amount: body.amount,
      currency: body.currency,
      walletAddress: merchant.wallet_address,
      metadata: body.metadata || {},
      // ── Link payment to developer application ────────────────────────────
      applicationId: context.applicationId,
      environment: context.environment,
    });

    // ── Build Checkout URL ─────────────────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lumia-pay-two.vercel.app";
    const checkoutUrl = `${baseUrl}/checkout/${payment.id}`;

    // ── Response ───────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        wallet_address: payment.wallet_address,
        expires_at: payment.expires_at,
        checkout_url: checkoutUrl,
        created_at: payment.created_at,
        environment: context.environment,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[API v1] Payment creation failed:', err);
    return NextResponse.json(
      {
        error: 'payment_creation_failed',
        message: 'Failed to create payment',
      },
      { status: 500 },
    );
  }
}

// ─── GET /api/v1/payments ────────────────────────────────────────────────────

/**
 * Lists payments created by this application.
 *
 * QUERY PARAMETERS
 *   status   Payment status filter (optional)
 *   limit    Results per page (1-100, default 20)
 *   offset   Pagination offset (default 0)
 *
 * RESPONSE (200 OK)
 *   {
 *     "data": [
 *       {
 *         "id": "...",
 *         "amount": "100.00",
 *         "currency": "USDC",
 *         "status": "paid",
 *         "created_at": "...",
 *         "paid_at": "...",
 *         ...
 *       }
 *     ],
 *     "pagination": {
 *       "limit": 20,
 *       "offset": 0,
 *       "total": 142
 *     }
 *   }
 *
 * ERRORS
 *   401 Unauthorized   Invalid or missing API key
 *   403 Forbidden      Missing payments:read permission
 *   422 Unprocessable  Invalid query parameters
 */
export async function GET(req: NextRequest) {
  // ── Authentication ─────────────────────────────────────────────────────────
  const authResult = await withApiKeyAuth(req);
  if (!authResult.success) {
    return authResult.error;
  }
  const { context } = authResult;

  // ── Authorization ──────────────────────────────────────────────────────────
  const permissionError = requirePermission(context, 'payments', 'read');
  if (permissionError) {
    return permissionError;
  }

  // ── Query Parameter Validation ─────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  let query: z.infer<typeof listPaymentsSchema>;
  try {
    query = listPaymentsSchema.parse({
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'validation_error',
          message: 'Invalid query parameters',
          details: err.errors,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: 'invalid_request', message: 'Invalid query parameters' },
      { status: 400 },
    );
  }

  // ── Fetch Payments ─────────────────────────────────────────────────────────
  try {
    const supabase = await createServerClient();

    // Build query with filters
    let queryBuilder = supabase
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('user_id', context.userId)
      .eq('application_id', context.applicationId)
      .eq('environment', context.environment)
      .order('created_at', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    // Apply status filter if provided
    if (query.status) {
      queryBuilder = queryBuilder.eq('status', query.status);
    }

    const { data: payments, error, count } = await queryBuilder;

    if (error) {
      console.error('[API v1] Payment list query failed:', error);
      return NextResponse.json(
        {
          error: 'query_failed',
          message: 'Failed to retrieve payments',
        },
        { status: 500 },
      );
    }

    // ── Build Response ─────────────────────────────────────────────────────
    return NextResponse.json({
      data: payments?.map((p: PaymentRow) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        label: p.label,
        wallet_address: p.wallet_address,
        tx_hash: p.tx_hash,
        verified_amount: p.verified_amount,
        created_at: p.created_at,
        expires_at: p.expires_at,
        paid_at: p.paid_at,
        environment: p.environment,
        metadata: p.metadata,
      })) || [],
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: count || 0,
      },
    });
  } catch (err) {
    console.error('[API v1] Unexpected error:', err);
    return NextResponse.json(
      {
        error: 'internal_error',
        message: 'An unexpected error occurred',
      },
      { status: 500 },
    );
  }
}
