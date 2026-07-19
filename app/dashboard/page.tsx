import Link from 'next/link';
import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import CurrencyBadge from '@/components/currency-badge';
import {
  ArrowUpRight, Plus, BarChart3, CheckCircle,
  Clock, TrendingUp, AlertCircle, Hourglass, XCircle,
} from 'lucide-react';

export const metadata = { title: 'Dashboard — LumiaPay' };

export default async function DashboardPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: payments } = await admin
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const all = payments ?? [];

  // ── Metrics ──────────────────────────────────────────────────────────────

  // Amounts
  const totalPaid = all
    .filter((p) => p.status === 'paid')
    .reduce((sum: number, p) => sum + parseFloat(p.amount ?? '0'), 0);

  const pendingAmount = all
    .filter((p) => p.status === 'pending')
    .reduce((sum: number, p) => sum + parseFloat(p.amount ?? '0'), 0);

  const expiredAmount = all
    .filter((p) => p.status === 'expired')
    .reduce((sum: number, p) => sum + parseFloat(p.amount ?? '0'), 0);

  // Counts
  const countPaid    = all.filter((p) => p.status === 'paid').length;
  const countPending = all.filter((p) => p.status === 'pending').length;
  const countExpired = all.filter((p) => p.status === 'expired').length;
  const totalCount   = all.length;

  // Success rate = paid / total payments × 100  (as requested: divide by total)
  const successRate = totalCount > 0 ? Math.round((countPaid / totalCount) * 100) : 0;

  // USD received ratio = paid amount / total amount of PAID payments only × 100
  // (shows what % of paid-payment value has been collected — always 100% unless partial)
  // More useful: ratio of paid count to total count shown as amount context
  const usdRatio = totalCount > 0 ? Math.round((countPaid / totalCount) * 100) : 0;


  const recent = all.slice(0, 10);

  return (
    <AppShell email={user.email}>
      {/* ── Page header ── */}
      <div>
        <span className="eyebrow">
          <BarChart3 size={13} /> Overview
        </span>
        <h1 className="heading">Dashboard</h1>
        <p className="subheading">Your payment activity at a glance.</p>
      </div>

      {/* ── Metric cards — 3 cols × 3 rows, 8 cards ── */}
      <div className="metric-grid">

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">USD received (stables)</span>
            <span className="metric-icon"><CheckCircle size={17} /></span>
          </div>
          <div className="metric-value">${totalPaid.toFixed(2)}</div>
          <div className="metric-sub">{countPaid} paid of {totalCount} total ({usdRatio}%)</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Pending amount</span>
            <span className="metric-icon"><Clock size={17} /></span>
          </div>
          <div className="metric-value">${pendingAmount.toFixed(2)}</div>
          <div className="metric-sub">{countPending} pending link{countPending !== 1 ? 's' : ''}</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Expired amount</span>
            <span className="metric-icon"><AlertCircle size={17} /></span>
          </div>
          <div className="metric-value">${expiredAmount.toFixed(2)}</div>
          <div className="metric-sub">{countExpired} expired link{countExpired !== 1 ? 's' : ''}</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Success rate</span>
            <span className="metric-icon"><TrendingUp size={17} /></span>
          </div>
          <div className="metric-value">{successRate}%</div>
          <div className="metric-sub">Paid ÷ total payments</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Paid payments</span>
            <span className="metric-icon"><CheckCircle size={17} /></span>
          </div>
          <div className="metric-value">{countPaid}</div>
          <div className="metric-sub">of {totalCount} total</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Pending payments</span>
            <span className="metric-icon"><Hourglass size={17} /></span>
          </div>
          <div className="metric-value">{countPending}</div>
          <div className="metric-sub">Awaiting payment</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Expired payments</span>
            <span className="metric-icon"><XCircle size={17} /></span>
          </div>
          <div className="metric-value">{countExpired}</div>
          <div className="metric-sub">Links timed out</div>
        </div>

        <div className="card metric">
          <div className="metric-top">
            <span className="metric-label">Total payments</span>
            <span className="metric-icon"><BarChart3 size={17} /></span>
          </div>
          <div className="metric-value">{totalCount}</div>
          <div className="metric-sub">All time</div>
        </div>

      </div>

      {/* ── Recent payments table ── */}
      <div className="split-head">
        <h2 className="section-title">Recent payments</h2>
        <Link href="/payments/new" className="button lime" style={{ fontSize: 13, padding: '9px 14px' }}>
          <Plus size={14} /> New payment
        </Link>
      </div>

      <div className="card payments">
        <div className="row head">
          <span>Label</span>
          <span>Token</span>
          <span>Amount</span>
          <span>Status</span>
          <span />
        </div>

        {recent.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><BarChart3 size={24} /></div>
            <h4>No payments yet</h4>
            <p>Create your first payment link to get started.</p>
            <Link href="/payments/new" className="button lime" style={{ fontSize: 13 }}>
              <Plus size={14} /> New payment
            </Link>
          </div>
        )}

        {recent.map((p) => (
          <Link href={`/pay/${p.id}`} key={p.id} className="row">
            <div className="order-cell">
              <CurrencyBadge symbol={p.currency} />
              <div>
                <div className="order-name">{p.label}</div>
                <div className="order-id">{p.id.slice(0, 8)}…</div>
              </div>
            </div>
            <span>{p.currency}</span>
            <span>{p.amount}</span>
            <span className={`status ${p.status}`}>{p.status}</span>
            <ArrowUpRight size={14} color="var(--muted)" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
