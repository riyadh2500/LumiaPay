import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrendingUp, BarChart3 } from 'lucide-react';

export const metadata = { title: 'Usage & Analytics — LumiaPay Developer' };

export default async function AnalyticsPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch applications
  const { data: applications } = await admin
    .from('applications')
    .select('id, name, environment')
    .eq('user_id', user.id);

  // Fetch payment stats per application
  const appStats = await Promise.all(
    (applications ?? []).map(async (app: any) => {
      const { data: payments } = await admin
        .from('payments')
        .select('id, status, amount')
        .eq('application_id', app.id);

      const total = payments?.length ?? 0;
      const successful = payments?.filter((p: any) => p.status === 'paid').length ?? 0;
      const failed = total - successful;

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
        <span className="eyebrow">
          <TrendingUp size={13} /> Analytics
        </span>
        <h1 className="heading">Usage & Analytics</h1>
        <p className="subheading">
          Track API usage and performance metrics by application.
        </p>
      </div>

      {!appStats || appStats.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BarChart3 size={32} strokeWidth={1.5} />
            <p>No applications yet</p>
            <p className="empty-sub">
              Create an application to start tracking analytics.
            </p>
            <a href="/developer/applications" className="btn btn-primary mt-4">
              Create Application
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {appStats.map((app: any) => (
            <div key={app.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{app.name}</h3>
                  <span className={`badge ${
                    app.environment === 'live' ? 'badge-success' : 'badge-warning'
                  } mt-2`}>
                    {app.environment}
                  </span>
                </div>
                <a 
                  href={`/developer/applications/${app.id}`}
                  className="text-sm text-lime-600 hover:text-lime-700"
                >
                  View Details →
                </a>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="metric-mini">
                  <div className="metric-mini-label">Total Requests</div>
                  <div className="metric-mini-value">{app.total}</div>
                </div>

                <div className="metric-mini">
                  <div className="metric-mini-label">Successful</div>
                  <div className="metric-mini-value text-green-600">{app.successful}</div>
                </div>

                <div className="metric-mini">
                  <div className="metric-mini-label">Failed</div>
                  <div className="metric-mini-value text-red-600">{app.failed}</div>
                </div>

                <div className="metric-mini">
                  <div className="metric-mini-label">Success Rate</div>
                  <div className="metric-mini-value">{app.successRate}%</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
