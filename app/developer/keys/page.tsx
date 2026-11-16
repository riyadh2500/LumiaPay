import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { Key, AlertCircle, Copy, Eye, EyeOff } from 'lucide-react';

export const metadata = { title: 'API Keys — LumiaPay Developer' };

export default async function APIKeysPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch all applications
  const { data: applications } = await admin
    .from('applications')
    .select('id, name, environment, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Fetch all API keys for user's applications
  const { data: apiKeys } = await admin
    .from('api_keys')
    .select('*, application:applications!inner(name, environment)')
    .eq('application.user_id', user.id)
    .order('created_at', { ascending: false });

  function formatDate(isoString: string) {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <Key size={13} /> API Keys
        </span>
        <h1 className="heading">API Key Management</h1>
        <p className="subheading">
          View and manage all your API keys across applications.
        </p>
      </div>

      <div className="alert alert-info mb-6">
        <AlertCircle size={18} />
        <div>
          <div className="font-semibold">Security Notice</div>
          <div className="text-sm opacity-90">
            API keys are shown only once at creation. Keep your secret keys secure and never share them publicly.
          </div>
        </div>
      </div>

      {!apiKeys || apiKeys.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Key size={32} strokeWidth={1.5} />
            <p>No API keys yet</p>
            <p className="empty-sub">
              Create an application to generate API keys.
            </p>
            <a href="/developer/applications" className="btn btn-primary mt-4">
              Create Application
            </a>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Key Prefix</th>
                  <th>Application</th>
                  <th>Environment</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Usage Count</th>
                  <th>Last Used</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key: any) => (
                  <tr key={key.id}>
                    <td>
                      <code className="code-inline font-mono">
                        {key.key_prefix}...
                      </code>
                    </td>
                    <td>
                      <div className="font-medium">{key.application?.name}</div>
                      {key.name && (
                        <div className="text-xs text-gray-500">{key.name}</div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                        key.application?.environment === 'live' 
                          ? 'badge-success' 
                          : 'badge-warning'
                      }`}>
                        {key.application?.environment}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm capitalize">{key.key_type}</span>
                    </td>
                    <td>
                      {key.status === 'active' ? (
                        <span className="badge badge-success">Active</span>
                      ) : key.status === 'revoked' ? (
                        <span className="badge badge-error">Revoked</span>
                      ) : (
                        <span className="badge badge-default">{key.status}</span>
                      )}
                    </td>
                    <td>
                      <span className="font-mono text-sm">{key.usage_count || 0}</span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {key.last_used_at ? (
                        formatDate(key.last_used_at)
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="text-sm text-gray-600">
                      {formatDate(key.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-gray-500 mt-0.5" />
              <div className="text-sm text-gray-700">
                <div className="font-semibold mb-1">Managing API Keys</div>
                <p className="mb-2">
                  To create new keys or revoke existing ones, visit the Applications page and select the specific application.
                </p>
                <a href="/developer/applications" className="text-lime-600 hover:text-lime-700 font-medium">
                  Go to Applications →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {applications && applications.length > 0 && (
        <div className="mt-6">
          <h2 className="section-title">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-4">
            {applications.map((app: any) => (
              <a
                key={app.id}
                href={`/developer/applications/${app.id}`}
                className="card card-link"
              >
                <Key size={20} />
                <div className="card-link-title truncate">{app.name}</div>
                <div className="card-link-desc">
                  Manage keys for this application
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
