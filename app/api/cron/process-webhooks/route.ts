/**
 * Webhook Processing Cron Job — Phase 2.2
 *
 * GET /api/cron/process-webhooks
 *
 * Processes pending webhook events and delivers them to registered endpoints.
 *
 * SCHEDULE
 *   Runs every 30 seconds (configurable in vercel.json)
 *
 * AUTHENTICATION
 *   Requires Vercel cron secret header (configured in Vercel dashboard)
 *
 * FUNCTIONALITY
 *   1. Fetches pending webhook events (next_attempt_at <= NOW)
 *   2. Delivers events to matching webhook endpoints
 *   3. Handles retries with exponential backoff
 *   4. Marks events as delivered or failed
 */

import { NextRequest, NextResponse } from 'next/server';
import { processWebhookQueue } from '@/lib/webhooks/webhook-service';

// ─── GET /api/cron/process-webhooks ──────────────────────────────────────────

/**
 * Webhook processing cron job handler.
 *
 * RESPONSE (200 OK)
 *   {
 *     "success": true,
 *     "processed": 15,
 *     "delivered": 12,
 *     "failed": 3,
 *     "timestamp": "2025-01-15T10:00:00Z"
 *   }
 */
export async function GET(req: NextRequest) {
  // ── Cron Authentication ────────────────────────────────────────────────────
  // Vercel sets this header for authenticated cron requests
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without auth
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (!isDevelopment) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Invalid cron secret' },
        { status: 401 },
      );
    }
  }

  // ── Process Webhook Queue ──────────────────────────────────────────────────
  try {
    console.log('[Webhook Cron] Starting webhook queue processing...');

    const result = await processWebhookQueue();

    console.log('[Webhook Cron] Processing complete:', result);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      delivered: result.delivered,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Webhook Cron] Processing failed:', err);

    return NextResponse.json(
      {
        success: false,
        error: 'processing_failed',
        message: 'Failed to process webhook queue',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
