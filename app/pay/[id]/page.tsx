import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import CheckoutClient from './checkout-client';

export const metadata = { title: 'Pay — LumiaPay' };

type Props = { params: Promise<{ id: string }> };

export default async function PayPage({ params }: Props) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: payment, error } = await admin
    .from('payments')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !payment) notFound();

  // Auto-expire: compare expires_at against current UTC time.
  if (payment.status === 'pending') {
    const now = new Date().toISOString();
    const { data: expiredRow } = await admin
      .from('payments')
      .update({ status: 'expired' })
      .eq('id', id)
      .eq('status', 'pending')
      .lt('expires_at', now)
      .select('status')
      .single();

    if (expiredRow) payment.status = 'expired';
  }

  // Fetch merchant name for the checkout header.
  const { data: merchant } = await admin
    .from('merchants')
    .select('business_name')
    .eq('user_id', payment.user_id)
    .single();

  return (
    <CheckoutClient
      payment={payment}
      merchantName={merchant?.business_name ?? 'Merchant'}
    />
  );
}
