import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { FileText, Activity } from 'lucide-react';

export const metadata = { title: 'API Logs — LumiaPay Developer' };

export default async function APILogsPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch recent API-created payments as logs
  const { data: logs } = await admin
    .from('payments')
    .select('id, status, amount, currency, created_at, application_id, environment')
    .eq('user_id', user.id)
    .not('application_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <FileText size={13} /> API Logs
        </span>
        <h1 className="heading">API Request Logs</h1>
        <p className="subheading">
          Monitor API requests and payment activity.
        </p>
      </div>

      <div className="card">
        {!logs || logs.length === 0 ? (
          <div className="empty-state">
            <Activity size={32} strokeWidth={1.5} />
            <p>No API activity yet</p>
            <p className="empty-sub">
              Create payments via the API to see request logs here.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Payment ID</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Environment</th>
                  <th>Application</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td>
                      <code className="code-inline">{log.id.slice(0, 8)}...</code>
                    </td>
                    <td className="font-mono">
                      {log.amount} {log.currency}
                    </td>
                    <td>
                      <span className={`badge badge-${log.status}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${
                        log.environment === 'live' ? 'badge-success' : 'badge-warning'
                      }`}>
                        {log.environment}
                      </span>
                    </td>
                    <td>
                      <code className="code-inline text-xs">
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
