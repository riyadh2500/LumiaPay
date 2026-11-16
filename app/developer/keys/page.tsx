import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { Key, AlertCircle } from 'lucide-react';

export const metadata = { title: 'API Keys — LumiaPay Developer' };

export default async function APIKeysPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: applications } = await admin
    .from('applications')
    .select('id, name, environment, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const { data: apiKeys } = await admin
    .from('api_keys')
    .select('*, application:applications!inner(name, environment)')
    .eq('application.user_id', user.id)
    .order('created_at', { ascending: false });

  function formatDate(isoString: string) {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow"><Key size={13} /> API Keys</span>
        <h1 className="heading">API Key Management</h1>
        <p className="subheading">View and manage all your API keys across applications.</p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '14px 16px', background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: '10px', marginBottom: '24px'
      }}>
        <AlertCircle size={16} color="#dc2626" style={{ marginTop: '2px', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}>Security Notice</div>
          <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
            API keys are shown only once at creation. Keep your secret keys secure and never share them publicly.
          </div>
        </div>
      </div>

      {!apiKeys || apiKeys.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--mint)', color: '#1d5c3a', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Key size={32} strokeWidth={1.5} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No API Keys Yet</h3>
          <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '360px', margin: '0 auto 20px' }}>
            Create an application to generate API keys automatically.
          </p>
          <a href="/developer/applications" className="btn btn-primary">Create Application</a>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: 'var(--paper)' }}>
                  {['Key Prefix', 'Application', 'Type', 'Status', 'Created'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(apiKeys as any[]).map((key: any) => (
                  <tr key={key.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <code style={{ fontSize: '12px', fontFamily: 'DM Mono, monospace', background: 'var(--paper)', padding: '3px 8px', borderRadius: '6px', color: 'var(--ink)' }}>
                        {key.key_prefix}...
                      </code>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{key.application?.name}</div>
                      {key.name && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{key.name}</div>}
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: '12px', textTransform: 'capitalize', color: 'var(--muted)' }}>{key.key_type}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className={`badge ${key.status === 'active' ? 'success' : key.status === 'revoked' ? 'error' : 'default'}`} style={{ textTransform: 'capitalize' }}>
                        {key.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {formatDate(key.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 6px' }}>
              To create new keys or revoke existing ones, visit the Applications page and select the specific application.
            </p>
            <a href="/developer/applications" style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Go to Applications →
            </a>
          </div>
        </div>
      )}

      {applications && applications.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
            {(applications as any[]).map((app: any) => (
              <a key={app.id} href={`/developer/applications/${app.id}/keys`} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--mint)', color: '#1d5c3a', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Key size={18} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Manage keys</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}