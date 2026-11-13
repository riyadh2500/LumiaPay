/**
 * Background Payment Monitoring Cron Job
 * 
 * Monitors pending payments and marks expired ones as 'expired'.
 * Runs every 5 minutes via Vercel Cron.
 * 
 * Configure in vercel.json with schedule: every 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.NODE_ENV === 'production') {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    // Find all payments that are pending but past their expiry time
    const { data: expiredPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, label, expires_at')
      .eq('status', 'pending')
      .lt('expires_at', now);

    if (fetchError) {
      console.error('[Cron] Error fetching expired payments:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch expired payments', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!expiredPayments || expiredPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired payments found',
        expired: 0,
        timestamp: now,
      });
    }

    // Update all expired payments to 'expired' status
    const paymentIds = expiredPayments.map((p) => p.id);
    
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'expired',
        updated_at: now,
      })
      .in('id', paymentIds);

    if (updateError) {
      console.error('[Cron] Error updating expired payments:', updateError);
      return NextResponse.json(
        { error: 'Failed to update expired payments', details: updateError.message },
        { status: 500 }
      );
    }

    // Log events for audit trail
    const events = expiredPayments.map((payment) => ({
      payment_id: payment.id,
      event_type: 'status_change',
      old_status: 'pending',
      new_status: 'expired',
      metadata: {
        reason: 'ttl_expired',
        expired_at: payment.expires_at,
        detected_at: now,
      },
      created_at: now,
    }));

    const { error: eventsError } = await supabase
      .from('payment_events')
      .insert(events);

    if (eventsError) {
      console.error('[Cron] Error logging payment events:', eventsError);
      // Don't fail the whole operation if event logging fails
    }

    console.log(`[Cron] Marked ${paymentIds.length} payments as expired`);

    return NextResponse.json({
      success: true,
      message: `Marked ${paymentIds.length} payments as expired`,
      expired: paymentIds.length,
      payment_ids: paymentIds,
      timestamp: now,
    });

  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
