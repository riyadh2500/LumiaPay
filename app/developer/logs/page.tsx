import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { FileText, Activity, CheckCircle, Clock, XCircle } from 'lucide-react';

export const metadata = { title: 'API Logs — LumiaPay Developer' };

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    paid: { bg: '#dcfce7', color: '#16a34a' },
    pending: { bg: '#fef3c7', color: '#d97706' },
    detecting: { bg: '#dbeafe', color: '#1d4ed8' },
    expired: { bg: '#fee2e2', color: '#dc2626' },
    failed: { bg: '#fee2e2', color: '#dc2626' },
  };
  const c = colors[status] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
}

export default async function APILogsPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: logs } = await admin
    .from('payments')
    .select('id, status, amount, currency, created_at, application_id, environment, label')
    .eq('user_id', user.id)
    .not('application_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  // Also get all payments for total count
  const { data: allApiPayments } = await admin
    .from('payments')
    .select('id, status')
    .eq('user_id', user.id)
    .not('application_id', 'is', null);

  const total = allApiPayments?.length ?? 0;
  const success = allApiPayments?.filter((p: any) => p.status === 'paid').length ?? 0;
  const failed = allApiPayments?.filter((p: any) => p.status === 'expired' || p.status === 'failed').length ?? 0;

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow"><FileText size={13} /> API Logs</span>
        <h1 className="heading">API Request Logs</h1>
        <p className="subheading">Monitor all payments created via your API keys.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '8px' }}>
        {[
          { label: 'Total API Payments', value: total, icon: <Activity size={16} />, color: 'var(--mint)' },
          { label: 'Successful', value: success, icon: <CheckCircle size={16} />, color: '#dcfce7' },
          { label: 'Failed/Expired', value: failed, icon: <XCircle size={16} />, color: '#fee2e2' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: s.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 800 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Logs table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {!logs || logs.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--muted)' }}>
            <Activity size={48} strokeWidth={1} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p style={{ fontWeight: 700, marginBottom: '4px' }}>No API activity yet</p>
            <p style={{ fontSize: '13px' }}>Create payments via the API to see logs here.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: 'var(--paper)' }}>
                  {['Time', 'Label', 'Amount', 'Status', 'Environment', 'App ID'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(logs as any[]).map((log: any) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600 }}>
                      {log.label || '—'}
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>
                      {log.amount} {log.currency}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <StatusBadge status={log.status} />
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        background: log.environment === 'live' ? '#dcfce7' : '#fef3c7',
                        color: log.environment === 'live' ? '#16a34a' : '#d97706',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700
                      }}>
                        {log.environment || 'test'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <code style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--muted)', background: 'var(--paper)', padding: '2px 6px', borderRadius: '4px' }}>
                        {log.application_id?.slice(0, 8)}...
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
