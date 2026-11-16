import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrendingUp, BarChart3, CheckCircle, XCircle, Activity } from 'lucide-react';

export const metadata = { title: 'Usage & Analytics — LumiaPay Developer' };

export default async function AnalyticsPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  const { data: applications } = await admin
    .from('applications')
    .select('id, name, environment')
    .eq('user_id', user.id);

  const appStats = await Promise.all(
    (applications ?? []).map(async (app: any) => {
      const { data: payments } = await admin
        .from('payments')
        .select('id, status, amount')
        .eq('application_id', app.id);

      const total = payments?.length ?? 0;
      const successful = payments?.filter((p: any) => p.status === 'completed' || p.status === 'paid').length ?? 0;
      const failed = payments?.filter((p: any) => p.status === 'failed' || p.status === 'expired').length ?? 0;

      return {
        ...app,
        total,
        successful,
        failed,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      };
    })
  );

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow"><TrendingUp size={13} /> Analytics</span>
        <h1 className="heading">Usage & Analytics</h1>
        <p className="subheading">Track API usage and performance metrics by application.</p>
      </div>

      {!appStats || appStats.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'var(--mint)', color: '#1d5c3a', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <BarChart3 size={32} strokeWidth={1.5} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>No Applications Yet</h3>
          <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '360px', margin: '0 auto 20px' }}>
            Create an application to start tracking analytics.
          </p>
          <a href="/developer/applications" className="btn btn-primary">Create Application</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {appStats.map((app: any) => (
            <div key={app.id} className="card" style={{ padding: '24px' }}>
              {/* App Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>{app.name}</h3>
                  <span className={`badge ${app.environment === 'live' ? 'success' : 'warning'}`}>
                    {app.environment}
                  </span>
                </div>
                <a href={`/developer/applications/${app.id}/analytics`} style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                  View Details →
                </a>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                {/* Total */}
                <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Activity size={15} color="var(--muted)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800 }}>{app.total}</div>
                </div>

                {/* Successful */}
                <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <CheckCircle size={15} color="#16a34a" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>Successful</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#16a34a' }}>{app.successful}</div>
                </div>

                {/* Failed */}
                <div style={{ padding: '16px', background: '#fff1f2', borderRadius: '10px', border: '1px solid #fecdd3' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <XCircle size={15} color="#dc2626" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>Failed</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>{app.failed}</div>
                </div>

                {/* Success Rate */}
                <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <TrendingUp size={15} color="var(--muted)" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Success Rate</span>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 800 }}>{app.successRate}%</div>
                  {/* Progress bar */}
                  <div style={{ marginTop: '8px', height: '4px', background: 'var(--line)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${app.successRate}%`, background: app.successRate > 70 ? '#16a34a' : app.successRate > 40 ? '#f59e0b' : '#dc2626', borderRadius: '99px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}