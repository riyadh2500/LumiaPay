import Link from 'next/link';
import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import CurrencyBadge from '@/components/currency-badge';
import { ArrowUpRight, Plus, ArrowLeftRight } from 'lucide-react';

export const metadata = { title: 'Payments — LumiaPay' };

export default async function PaymentsPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: payments } = await admin
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const all = payments ?? [];

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <ArrowLeftRight size={13} /> Payments
        </span>
        <h1 className="heading">All payments</h1>
        <p className="subheading">Every payment link you've created.</p>
      </div>

      <div className="split-head">
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {all.length} payment{all.length !== 1 ? 's' : ''}
        </span>
        <Link href="/payments/new" className="button lime" style={{ fontSize: 13, padding: '9px 14px' }}>
          <Plus size={14} /> New payment
        </Link>
      </div>

      <div className="card payments">
        <div className="row head">
          <span>Label</span>
          <span>Token</span>
          <span>Amount</span>
          <span>Date</span>
          <span>Status</span>
        </div>

        {all.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ArrowLeftRight size={24} />
            </div>
            <h4>No payments yet</h4>
            <p>Create your first payment link and share it with a customer.</p>
            <Link href="/payments/new" className="button lime" style={{ fontSize: 13 }}>
              <Plus size={14} /> New payment
            </Link>
          </div>
        )}

        {all.map((p) => (
          <Link
            href={`/pay/${p.id}`}
            key={p.id}
            className="row"
            style={{ gridTemplateColumns: '1.4fr 0.6fr 0.7fr 0.9fr 0.75fr 24px' }}
          >
            <div className="order-cell">
              <CurrencyBadge symbol={p.currency} />
              <div>
                <div className="order-name">{p.label}</div>
                <div className="order-id">{p.id.slice(0, 8)}…</div>
              </div>
            </div>
            <span>{p.currency}</span>
            <span>{p.amount}</span>
            <span style={{ color: 'var(--muted)' }}>{fmtDate(p.created_at)}</span>
            <span className={`status ${p.status}`}>{p.status}</span>
            <ArrowUpRight size={14} color="var(--muted)" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
