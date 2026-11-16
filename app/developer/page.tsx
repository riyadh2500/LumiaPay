import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  Code, Key, Webhook, Activity, CheckCircle, XCircle, TrendingUp, Zap
} from 'lucide-react';

export const metadata = { title: 'Developer Overview — LumiaPay' };

export default async function DeveloperOverviewPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // ── Fetch Developer Metrics ──────────────────────────────────────────────

  // Applications
  const { data: applications } = await admin
    .from('applications')
    .select('id, status, environment')
    .eq('user_id', user.id);

  const totalApps = applications?.length ?? 0;
  const activeApps = applications?.filter(app => app.status === 'active').length ?? 0;
  const testApps = applications?.filter(app => app.environment === 'test').length ?? 0;
  const liveApps = applications?.filter(app => app.environment === 'live').length ?? 0;

  // API Keys
  const { data: keys } = await admin
    .from('api_keys')
    .select('id, status, application_id')
    .in('application_id', applications?.map(a => a.id) ?? []);

  const totalKeys = keys?.length ?? 0;
  const activeKeys = keys?.filter(k => k.status === 'active').length ?? 0;

  // Webhooks
  const { data: webhooks } = await admin
    .from('webhook_endpoints')
    .select('id, status, application_id')
    .in('application_id', applications?.map(a => a.id) ?? []);

  const totalWebhooks = webhooks?.length ?? 0;
  const activeWebhooks = webhooks?.filter(w => w.status === 'active').length ?? 0;

  // Webhook Events (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: webhookEvents } = await admin
    .from('webhook_events')
    .select('id, status')
    .in('application_id', applications?.map(a => a.id) ?? [])
    .gte('created_at', thirtyDaysAgo.toISOString());

  const totalEvents = webhookEvents?.length ?? 0;
  const deliveredEvents = webhookEvents?.filter(e => e.status === 'delivered').length ?? 0;
  const failedEvents = webhookEvents?.filter(e => e.status === 'failed').length ?? 0;
  const webhookSuccessRate = totalEvents > 0 ? Math.round((deliveredEvents / totalEvents) * 100) : 0;

  // API Payments (via Developer API)
  const { data: apiPayments } = await admin
    .from('payments')
    .select('id, status, application_id, created_at')
    .eq('user_id', user.id)
    .not('application_id', 'is', null)
    .gte('created_at', thirtyDaysAgo.toISOString());

  const totalApiRequests = apiPayments?.length ?? 0;
  const successfulRequests = apiPayments?.filter(p => p.status === 'paid').length ?? 0;

  // Recent Activity (last 5 API-created payments)
  const recentActivity = (apiPayments ?? []).slice(0, 5);

  return (
    <AppShell email={user.email}>
      {/* ── Page Header ── */}
      <div>
        <span className="eyebrow">
          <Code size={13} /> Developer
        </span>
        <h1 className="heading">Developer Overview</h1>
        <p className="subheading">
          Monitor your API integrations, applications, and webhook delivery status.
        </p>
      </div>

      {/* ── Metric Cards ── */}
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '14px',
        marginTop: '28px'
      }}>

        {/* Total Applications */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Applications</span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: 'var(--mint)',
              color: '#1d5c3a',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Zap size={17} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: '6px' }}>
            {activeApps}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500 }}>
            {totalApps} total • {testApps} test • {liveApps} live
          </div>
        </div>

        {/* Active API Keys */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>API Keys</span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: '#dff0ff',
              color: '#1d71e8',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Key size={17} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: '6px' }}>
            {activeKeys}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500 }}>
            {totalKeys} total • {totalKeys - activeKeys} revoked
          </div>
        </div>

        {/* Webhook Endpoints */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Webhook Endpoints</span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: '#f3e5ff',
              color: '#7c3aed',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Webhook size={17} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: '6px' }}>
            {activeWebhooks}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500 }}>
            {totalWebhooks} registered • {totalWebhooks - activeWebhooks} disabled
          </div>
        </div>

        {/* API Requests (30 days) */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>API Requests (30d)</span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: '#dbf9ec',
              color: '#0f9d63',
              display: 'grid',
              placeItems: 'center'
            }}>
              <Activity size={17} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: '6px' }}>
            {totalApiRequests}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500 }}>
            {successfulRequests} successful • {totalApiRequests - successfulRequests} other
          </div>
        </div>

        {/* Webhook Success Rate */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Webhook Success Rate</span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: '#dff8e9',
              color: '#197946',
              display: 'grid',
              placeItems: 'center'
            }}>
              <CheckCircle size={17} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: '6px' }}>
            {webhookSuccessRate}%
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500 }}>
            {deliveredEvents} delivered • {failedEvents} failed
          </div>
        </div>

        {/* Total Webhook Events */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Webhook Events (30d)</span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '11px',
              background: '#fff3cd',
              color: '#896617',
              display: 'grid',
              placeItems: 'center'
            }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1.2px', marginBottom: '6px' }}>
            {totalEvents}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 500 }}>
            Last 30 days activity
          </div>
        </div>

      </div>

      {/* ── Recent API Activity ── */}
      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Recent API Activity</h2>

        <div className="card" style={{ padding: recentActivity.length === 0 ? '64px 24px' : '0', overflow: 'hidden' }}>
          {recentActivity.length === 0 ? (
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
                <Activity size={32} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ 
                  fontSize: '16px',
                  fontWeight: 700,
                  margin: '0 0 6px',
                  letterSpacing: '-0.3px'
                }}>
                  No API requests yet
                </p>
                <p style={{ 
                  fontSize: '13px',
                  color: 'var(--muted)',
                  margin: 0,
                  maxWidth: '340px'
                }}>
                  Create an application and start making API calls to see activity here.
                </p>
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Payment ID</th>
                    <th>Status</th>
                    <th>Application</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((payment: any) => (
                    <tr key={payment.id}>
                      <td>
                        <code className="code-inline">{payment.id.slice(0, 8)}...</code>
                      </td>
                      <td>
                        <span className={`badge badge-${payment.status}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td>
                        <code className="code-inline">
                          {payment.application_id?.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="text-muted">
                        {new Date(payment.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Quick Actions</h2>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '14px'
        }}>
          <a 
            href="/developer/applications" 
            className="card app-card-hover"
            style={{ 
              padding: '24px',
              display: 'block',
              textDecoration: 'none'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'var(--mint)',
              color: '#1d5c3a',
              display: 'grid',
              placeItems: 'center',
              marginBottom: '14px'
            }}>
              <Zap size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px', letterSpacing: '-0.3px' }}>
              Create Application
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
              Set up a new developer application
            </div>
          </a>

          <a 
            href="/developer/keys" 
            className="card app-card-hover"
            style={{ 
              padding: '24px',
              display: 'block',
              textDecoration: 'none'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#dff0ff',
              color: '#1d71e8',
              display: 'grid',
              placeItems: 'center',
              marginBottom: '14px'
            }}>
              <Key size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px', letterSpacing: '-0.3px' }}>
              Generate API Keys
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
              Create test or live API keys
            </div>
          </a>

          <a 
            href="/developer/docs" 
            className="card app-card-hover"
            style={{ 
              padding: '24px',
              display: 'block',
              textDecoration: 'none'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#f3e5ff',
              color: '#7c3aed',
              display: 'grid',
              placeItems: 'center',
              marginBottom: '14px'
            }}>
              <Code size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '15px', marginBottom: '6px', letterSpacing: '-0.3px' }}>
              View Documentation
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
              API reference and integration guides
            </div>
          </a>
        </div>
      </div>
    </AppShell>
  );
}
