import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { Webhook, AlertCircle, CheckCircle, XCircle, Clock, Activity } from 'lucide-react';

export const metadata = { title: 'Webhooks — LumiaPay Developer' };

export default async function WebhooksPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch all applications
  const { data: applications } = await admin
    .from('applications')
    .select('id, name, environment, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch all webhook endpoints for user's applications
  const { data: webhooks } = await admin
    .from('webhook_endpoints')
    .select('*, application:applications!inner(name, environment)')
    .eq('application.user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch recent webhook events
  const { data: recentEvents } = await admin
    .from('webhook_events')
    .select('id, event_type, status, created_at, delivered_at, attempt_count, application:applications!inner(name)')
    .eq('application.user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  function formatDate(isoString: string) {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const totalWebhooks = webhooks?.length || 0;
  const activeWebhooks = webhooks?.filter(w => w.status === 'active').length || 0;
  const totalEvents = recentEvents?.length || 0;
  const deliveredEvents = recentEvents?.filter(e => e.status === 'delivered').length || 0;

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <Webhook size={13} /> Webhooks
        </span>
        <h1 className="heading">Webhook Endpoints</h1>
        <p className="subheading">
          Configure and monitor webhook endpoints for real-time payment notifications.
        </p>
      </div>

      {/* Webhook Stats */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px',
        marginTop: '28px'
      }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
              Total Endpoints
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: '#e7f0ff',
              color: '#1d71e8',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Webhook size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px' }}>
            {totalWebhooks}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
              Active Endpoints
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: '#dff8e9',
              color: '#197946',
              display: 'grid',
              placeItems: 'center'
            }}>
              <CheckCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', color: '#197946' }}>
            {activeWebhooks}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
              Recent Events
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: '#f3e5ff',
              color: '#7c3aed',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Activity size={16} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px' }}>
            {totalEvents}
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>
              Delivered
            </div>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: '#dbf9ec',
              color: '#0f9d63',
              display: 'grid',
              placeItems: 'center'
            }}>
              <CheckCircle size={16} strokeWidth={3} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', color: '#0f9d63' }}>
            {deliveredEvents}
          </div>
        </div>
      </div>

      {/* Webhook Endpoints Table */}
      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Webhook Endpoints</h2>

        {!webhooks || webhooks.length === 0 ? (
          <div className="card" style={{ padding: '64px 24px' }}>
            <div style={{
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'var(--mint)',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Webhook size={32} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ 
                  fontSize: '16px',
                  fontWeight: 700,
                  margin: '0 0 6px',
                  letterSpacing: '-0.3px'
                }}>
                  No webhook endpoints configured
                </p>
                <p style={{ 
                  fontSize: '13px',
                  color: 'var(--muted)',
                  margin: '0 0 20px',
                  maxWidth: '360px'
                }}>
                  Create an application and configure webhook endpoints to receive real-time payment events.
                </p>
              </div>
              <a href="/developer/applications" className="button lime">
                Go to Applications
              </a>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>URL</th>
                    <th>Application</th>
                    <th>Environment</th>
                    <th>Status</th>
                    <th>Events</th>
                    <th>Failures</th>
                    <th>Last Success</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((webhook: any) => (
                    <tr key={webhook.id}>
                      <td>
                        <code className="code-inline text-xs">
                          {webhook.url.length > 40 
                            ? `${webhook.url.substring(0, 40)}...` 
                            : webhook.url
                          }
                        </code>
                        {webhook.description && (
                          <div className="text-xs text-gray-500 mt-1">
                            {webhook.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-medium">{webhook.application?.name}</div>
                      </td>
                      <td>
                        <span className={`badge ${
                          webhook.application?.environment === 'live' 
                            ? 'badge-success' 
                            : 'badge-warning'
                        }`}>
                          {webhook.application?.environment}
                        </span>
                      </td>
                      <td>
                        {webhook.status === 'active' ? (
                          <span className="badge badge-success">Active</span>
                        ) : webhook.status === 'disabled' ? (
                          <span className="badge badge-error">Disabled</span>
                        ) : (
                          <span className="badge badge-default">{webhook.status}</span>
                        )}
                      </td>
                      <td>
                        <div className="text-sm">
                          {webhook.enabled_events?.length || 0} event types
                        </div>
                      </td>
                      <td>
                        {webhook.failure_count > 0 ? (
                          <span className="text-red-600 font-semibold">
                            {webhook.failure_count}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="text-sm text-gray-600">
                        {webhook.last_success_at ? (
                          formatDate(webhook.last_success_at)
                        ) : (
                          <span className="text-gray-400">Never</span>
                        )}
                      </td>
                      <td className="text-sm text-gray-600">
                        {formatDate(webhook.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent Webhook Events */}
      {recentEvents && recentEvents.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Recent Webhook Events</h2>

          <div className="card">
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Application</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Created</th>
                    <th>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((event: any) => (
                    <tr key={event.id}>
                      <td>
                        <code className="code-inline">{event.event_type}</code>
                      </td>
                      <td>
                        <div className="text-sm">{event.application?.name}</div>
                      </td>
                      <td>
                        {event.status === 'delivered' ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle size={14} className="text-green-600" />
                            <span className="badge badge-success">Delivered</span>
                          </div>
                        ) : event.status === 'failed' ? (
                          <div className="flex items-center gap-2">
                            <XCircle size={14} className="text-red-600" />
                            <span className="badge badge-error">Failed</span>
                          </div>
                        ) : event.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-yellow-600" />
                            <span className="badge badge-warning">Pending</span>
                          </div>
                        ) : (
                          <span className="badge badge-default">{event.status}</span>
                        )}
                      </td>
                      <td>
                        <span className="font-mono text-sm">{event.attempt_count}</span>
                      </td>
                      <td className="text-sm text-gray-600">
                        {formatDate(event.created_at)}
                      </td>
                      <td className="text-sm text-gray-600">
                        {event.delivered_at ? (
                          formatDate(event.delivered_at)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="card" style={{ marginTop: '32px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: '#e7f0ff',
            color: '#1d71e8',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <AlertCircle size={18} />
          </div>
          <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Managing Webhook Endpoints</div>
            <p style={{ color: 'var(--muted)', margin: '0 0 10px' }}>
              To create new webhook endpoints or modify existing ones, visit the Applications page and select the specific application.
            </p>
            <a 
              href="/developer/applications" 
              style={{ 
                color: '#1d71e8',
                fontWeight: 700,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Go to Applications →
            </a>
          </div>
        </div>
      </div>

      {applications && applications.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <h2 className="section-title" style={{ marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '14px'
          }}>
            {applications.map((app: any) => (
              <a
                key={app.id}
                href={`/developer/applications/${app.id}`}
                className="card app-card-hover"
                style={{ 
                  padding: '20px',
                  display: 'block',
                  textDecoration: 'none'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  background: '#f3e5ff',
                  color: '#7c3aed',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: '12px'
                }}>
                  <Webhook size={18} />
                </div>
                <div style={{ 
                  fontWeight: 800,
                  fontSize: '14px',
                  marginBottom: '4px',
                  letterSpacing: '-0.3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {app.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Configure webhooks for this application
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
