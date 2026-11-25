import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { Webhook, CheckCircle, Activity, AlertCircle, ExternalLink } from 'lucide-react';

export const metadata = { title: 'Webhooks — LumiaPay Developer' };

export default async function WebhooksPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch applications
  const { data: applications } = await admin
    .from('applications')
    .select('id, name, environment, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch webhooks - safe (may not exist)
  let webhooks: any[] | null = null;
  try {
    const { data } = await admin
      .from('webhooks')
      .select('*, application:applications!inner(name, environment)')
      .eq('application.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    webhooks = data;
  } catch {
    webhooks = null;
  }

  const totalWebhooks = webhooks?.length ?? 0;
  const activeWebhooks = (webhooks as any[])?.filter((w: any) => w.is_active || w.status === 'active').length ?? 0;

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow"><Webhook size={13} /> Webhooks</span>
        <h1 className="heading">Webhook Endpoints</h1>
        <p className="subheading">Configure webhook endpoints for real-time payment notifications.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '8px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Endpoints</div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{totalWebhooks}</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Active</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{activeWebhooks}</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Applications</div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{applications?.length ?? 0}</div>
        </div>
      </div>

      {/* Info box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '8px' }}>
        <AlertCircle size={16} color="#2563eb" style={{ marginTop: '1px', flexShrink: 0 }} />
        <div style={{ fontSize: '13px', color: '#1e3a5f' }}>
          <strong>Webhooks are configured per application.</strong> Go to your application → Webhooks tab to add or manage webhook endpoints.
          <a href="/developer/applications" style={{ color: '#2563eb', fontWeight: 600, marginLeft: '8px', textDecoration: 'none' }}>
            Go to Applications →
          </a>
        </div>
      </div>

      {/* Webhooks list */}
      {!webhooks || webhooks.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--mint)', color: '#1d5c3a', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Webhook size={32} strokeWidth={1.5} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No webhooks yet</h3>
          <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
            Create an application and add webhook endpoints to receive payment notifications.
          </p>
          <a href="/developer/applications" className="btn btn-primary">Go to Applications</a>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'var(--paper)' }}>
                  {['Endpoint URL', 'Application', 'Status', 'Created'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(webhooks as any[]).map((wh: any) => (
                  <tr key={wh.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <code style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace', color: 'var(--ink)' }}>
                        {wh.url || wh.endpoint_url || '—'}
                      </code>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600 }}>
                      {(wh.application as any)?.name || '—'}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{
                        background: (wh.is_active || wh.status === 'active') ? '#dcfce7' : '#fee2e2',
                        color: (wh.is_active || wh.status === 'active') ? '#16a34a' : '#dc2626',
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700
                      }}>
                        {(wh.is_active || wh.status === 'active') ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)' }}>
                      {new Date(wh.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Webhook Events */}
      <div style={{ marginTop: '32px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Supported Events</h2>
        <div className="card" style={{ padding: '0 20px' }}>
          {[
            { event: 'payment.created', desc: 'A new payment request was created', color: '#dbeafe' },
            { event: 'payment.detecting', desc: 'Transaction detected on blockchain', color: '#ede9fe' },
            { event: 'payment.paid', desc: 'Payment confirmed successfully', color: '#dcfce7' },
            { event: 'payment.expired', desc: 'Payment link expired', color: '#fef3c7' },
            { event: 'payment.failed', desc: 'Payment failed or was cancelled', color: '#fee2e2' },
          ].map(e => (
            <div key={e.event} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
              <code style={{ background: e.color, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'DM Mono, monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {e.event}
              </code>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
