/**
 * Background Payment Monitoring — Cron Handler
 *
 * Expires pending payments that have passed their TTL.
 * Triggered every 5 minutes via Vercel Cron (see vercel.json).
 *
 * Authentication:
 *   Production: requires Authorization: Bearer <CRON_SECRET>
 *   Development: auth check is skipped so the route can be hit manually.
 *
 * Implementation delegates entirely to expirePendingPayments() from the
 * Payment Engine so that all expiry logic, admin-client usage, and event
 * emission remain in one place (payment-lifecycle.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { expirePendingPayments } from '@/lib/payment-engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Authentication ────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'production') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[Cron] CRON_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ── Expiry run ────────────────────────────────────────────────────────────
  const startedAt = new Date().toISOString();

  try {
    // expirePendingPayments() uses createAdminClient() internally and emits
    // payment_events rows using the correct schema (event_type, status, data).
    const expiredCount = await expirePendingPayments();

    const response = {
      success: true,
      expired: expiredCount,
      message:
        expiredCount === 0
          ? 'No expired payments found'
          : `Marked ${expiredCount} payment(s) as expired`,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };

    console.log(`[Cron] ${response.message}`);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Cron] expirePendingPayments failed:', message);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to expire pending payments',
        detail: message,
        started_at: startedAt,
        failed_at: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
