/**
 * Webhook Service — Phase 2.2
 *
 * Manages webhook event creation, delivery, and monitoring.
 *
 * ARCHITECTURE
 *   1. Event Creation: Payment events trigger webhook event creation
 *   2. Event Queue: Events are queued with next_attempt_at timestamp
 *   3. Webhook Worker: Cron job fetches pending events and delivers them
 *   4. Retry Logic: Failed deliveries retry with exponential backoff
 *   5. Monitoring: All attempts logged for debugging
 *
 * SECURITY
 *   - HMAC-SHA256 signature in X-LumiaPay-Signature header
 *   - Timestamp in signature prevents replay attacks
 *   - HTTPS-only webhook URLs enforced
 *
 * USAGE
 *   import { createWebhookEvent } from '@/lib/webhooks/webhook-service';
 *
 *   await createWebhookEvent({
 *     applicationId: '...',
 *     eventType: 'payment.paid',
 *     paymentId: '...',
 *     payload: { ... }
 *   });
 */

import { createAdminClient } from '@/lib/supabase/admin';
import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'payment.created'
  | 'payment.paid'
  | 'payment.failed'
  | 'payment.expired'
  | 'payment.cancelled'
  | 'payment.underpaid'
  | 'payment.overpaid';

export interface WebhookEventPayload {
  id: string;
  type: WebhookEventType;
  created_at: string;
  data: {
    payment: {
      id: string;
      amount: string;
      currency: string;
      status: string;
      label: string;
      wallet_address: string;
      tx_hash?: string;
      verified_amount?: string;
      created_at: string;
      expires_at: string;
      paid_at?: string;
      environment: string;
      metadata?: Record<string, unknown>;
    };
  };
}

export interface CreateWebhookEventInput {
  applicationId: string;
  eventType: WebhookEventType;
  paymentId: string;
  payload: WebhookEventPayload;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string;
  enabled_events: string[];
}

// ─── Event Creation ──────────────────────────────────────────────────────────

/**
 * Creates a webhook event and queues it for delivery.
 *
 * This function is called automatically by the payment engine when
 * significant events occur (payment.paid, payment.failed, etc.)
 */
export async function createWebhookEvent(
  input: CreateWebhookEventInput,
): Promise<string | null> {
  try {
    const admin = createAdminClient();

    const { data: eventId, error } = await admin.rpc('create_webhook_event', {
      p_application_id: input.applicationId,
      p_event_type: input.eventType,
      p_payment_id: input.paymentId,
      p_payload: input.payload as any,
    });

    if (error) {
      console.error('[Webhook Service] Event creation failed:', error);
      return null;
    }

    return eventId as string;
  } catch (err) {
    console.error('[Webhook Service] Unexpected error:', err);
    return null;
  }
}

// ─── Signature Generation ────────────────────────────────────────────────────

/**
 * Generates HMAC-SHA256 signature for webhook payload.
 *
 * Format: t=<timestamp>,v1=<signature>
 *
 * Example:
 *   t=1705320000,v1=a3b2c1d4e5f6...
 *
 * Developers verify signatures to ensure webhooks came from LumiaPay.
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  timestamp: number = Date.now(),
): string {
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verifies a webhook signature (for testing/validation).
 *
 * Developers will implement this function on their servers.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300, // 5 minutes
): boolean {
  try {
    // Parse signature header
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return false;
    }

    const timestamp = parseInt(timestampPart.split('=')[1], 10);
    const signature = signaturePart.split('=')[1];

    // Check timestamp (prevent replay attacks)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Math.floor(timestamp / 1000)) > toleranceSeconds) {
      return false;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`, 'utf8')
      .digest('hex');

    // Constant-time comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  } catch (err) {
    console.error('[Webhook Signature Verification] Error:', err);
    return false;
  }
}

// ─── Webhook Delivery ────────────────────────────────────────────────────────

/**
 * Delivers a webhook event to a single endpoint.
 *
 * Called by the webhook worker cron job.
 */
export async function deliverWebhookEvent(
  eventId: string,
  endpoint: WebhookEndpoint,
  payload: WebhookEventPayload,
  attemptNumber: number,
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const admin = createAdminClient();

  try {
    const payloadString = JSON.stringify(payload);
    const signature = generateWebhookSignature(payloadString, endpoint.secret);

    const startTime = Date.now();

    // Make HTTP POST request to webhook endpoint
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LumiaPay-Webhooks/1.0',
        'X-LumiaPay-Signature': signature,
        'X-LumiaPay-Event-ID': eventId,
        'X-LumiaPay-Event-Type': payload.type,
      },
      body: payloadString,
      // Timeout after 10 seconds
      signal: AbortSignal.timeout(10000),
    });

    const duration = Date.now() - startTime;
    const success = response.status >= 200 && response.status < 300;

    // Log delivery attempt
    await admin.from('webhook_attempts').insert({
      webhook_event_id: eventId,
      webhook_endpoint_id: endpoint.id,
      attempt_number: attemptNumber,
      request_headers: {
        'Content-Type': 'application/json',
        'X-LumiaPay-Signature': signature.substring(0, 50) + '...', // Truncate for storage
      },
      response_status: response.status,
      response_headers: Object.fromEntries(response.headers.entries()),
      response_body: await response.text().catch(() => ''),
      duration_ms: duration,
      success,
      error_message: success ? null : `HTTP ${response.status}`,
    });

    // Update endpoint stats
    if (success) {
      await admin
        .from('webhook_endpoints')
        .update({
          last_success_at: new Date().toISOString(),
          failure_count: 0,
        })
        .eq('id', endpoint.id);
    } else {
      // Increment failure count
      await admin.rpc('increment_webhook_failure_count', {
        endpoint_id: endpoint.id,
      });
    }

    return { success, statusCode: response.status };
  } catch (err) {
    const error = err as Error;
    const duration = Date.now();

    // Log failed attempt
    await admin.from('webhook_attempts').insert({
      webhook_event_id: eventId,
      webhook_endpoint_id: endpoint.id,
      attempt_number: attemptNumber,
      success: false,
      error_message: error.message,
      duration_ms: duration,
    });

    // Increment failure count
    await admin.rpc('increment_webhook_failure_count', {
      endpoint_id: endpoint.id,
    });

    return { success: false, error: error.message };
  }
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

/**
 * Calculates next retry time using exponential backoff.
 *
 * Retry schedule:
 *   Attempt 1: Immediate
 *   Attempt 2: 5 seconds
 *   Attempt 3: 25 seconds (5^2)
 *   Attempt 4: 125 seconds (5^3)
 *   Attempt 5: 625 seconds (~10 minutes)
 *   Max attempts: 5
 */
export function calculateNextRetryTime(attemptNumber: number): Date | null {
  const MAX_ATTEMPTS = 5;

  if (attemptNumber >= MAX_ATTEMPTS) {
    return null; // No more retries
  }

  const baseDelaySeconds = 5;
  const delaySeconds = Math.pow(baseDelaySeconds, attemptNumber);

  return new Date(Date.now() + delaySeconds * 1000);
}

// ─── Webhook Worker ──────────────────────────────────────────────────────────

/**
 * Processes pending webhook events.
 *
 * Called by cron job: /api/cron/process-webhooks
 *
 * Fetches events where next_attempt_at <= NOW and status = 'pending',
 * delivers them to all matching endpoints, and updates status.
 */
export async function processWebhookQueue(): Promise<{
  processed: number;
  delivered: number;
  failed: number;
}> {
  const admin = createAdminClient();

  let processed = 0;
  let delivered = 0;
  let failed = 0;

  try {
    // Fetch pending events ready for delivery
    const { data: events, error } = await admin
      .from('webhook_events')
      .select('*')
      .eq('status', 'pending')
      .lte('next_attempt_at', new Date().toISOString())
      .limit(50); // Process max 50 events per run

    if (error || !events || events.length === 0) {
      return { processed: 0, delivered: 0, failed: 0 };
    }

    // Process each event
    for (const event of events) {
      processed++;

      // Get active webhook endpoints for this application/event type
      const { data: endpoints } = await admin.rpc(
        'get_active_webhook_endpoints',
        {
          p_application_id: event.application_id,
          p_event_type: event.event_type,
        },
      );

      if (!endpoints || endpoints.length === 0) {
        // No endpoints configured, mark as delivered
        await admin
          .from('webhook_events')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', event.id);
        delivered++;
        continue;
      }

      let allSuccessful = true;

      // Deliver to each endpoint
      for (const endpoint of endpoints) {
        const result = await deliverWebhookEvent(
          event.id,
          endpoint,
          event.payload,
          event.attempt_count + 1,
        );

        if (!result.success) {
          allSuccessful = false;
        }
      }

      // Update event status
      if (allSuccessful) {
        await admin
          .from('webhook_events')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString(),
            attempt_count: event.attempt_count + 1,
          })
          .eq('id', event.id);
        delivered++;
      } else {
        const nextRetry = calculateNextRetryTime(event.attempt_count + 1);

        if (nextRetry) {
          // Schedule retry
          await admin
            .from('webhook_events')
            .update({
              attempt_count: event.attempt_count + 1,
              next_attempt_at: nextRetry.toISOString(),
            })
            .eq('id', event.id);
        } else {
          // Max retries reached, mark as failed
          await admin
            .from('webhook_events')
            .update({ status: 'failed', attempt_count: event.attempt_count + 1 })
            .eq('id', event.id);
          failed++;
        }
      }
    }

    return { processed, delivered, failed };
  } catch (err) {
    console.error('[Webhook Queue Processor] Error:', err);
    return { processed, delivered, failed };
  }
}
