import { requireUser } from '@/components/require-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import ApplicationSidebar from '@/components/application-sidebar';
import { Layers, Key, Webhook, Activity } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Application Details — LumiaPay Developer' };

export default async function ApplicationDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch application
  const { data: application } = await admin
    .from('applications')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!application) {
    notFound();
  }

  // Fetch API keys for this application
  const { data: apiKeys } = await admin
    .from('api_keys')
    .select('*')
    .eq('application_id', id)
    .order('created_at', { ascending: false });

  // Fetch webhooks
  const { data: webhooks } = await admin
    .from('webhooks')
    .select('*')
    .eq('application_id', id)
    .order('created_at', { ascending: false });

  // Fetch recent payments (last 10)
  const { data: recentPayments } = await admin
    .from('payments')
    .select('id, label, amount, currency, status, created_at')
    .eq('application_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="app-layout">
      <ApplicationSidebar 
        applicationId={application.id} 
        applicationName={application.name}
      />
      
      <main className="app-main">
        <div className="app-header">
          <span className="eyebrow">
            <Layers size={13} /> Application Overview
          </span>
          <h1 className="heading">{application.name}</h1>
          <p className="subheading">
            {application.description || 'No description provided'}
          </p>

          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginTop: '16px',
            alignItems: 'center'
          }}>
            <span className={`badge ${application.environment}`}>
              {application.environment === 'test' ? '🧪 Test' : '🚀 Live'}
            </span>
            <span className={`badge ${application.status === 'active' ? 'success' : 'muted'}`}>
              {application.status}
            </span>
          </div>
        </div>

      {/* ── API Keys Section ── */}
      <div className="card" style={{ marginTop: '32px', padding: '28px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Key size={20} />
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
              API Keys
            </h3>
          </div>
          <Link 
            href={`/developer/applications/${id}/keys`}
            className="button secondary"
            style={{ fontSize: '13px', padding: '8px 14px' }}
          >
            Manage Keys
          </Link>
        </div>

        {apiKeys && apiKeys.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {apiKeys.slice(0, 3).map((key) => (
              <div 
                key={key.id}
                style={{
                  padding: '16px',
                  background: 'var(--paper)',
                  borderRadius: '12px',
                  border: '1px solid var(--line)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <p style={{ 
                      fontSize: '13px', 
                      fontFamily: 'DM Mono', 
                      color: 'var(--muted)',
                      margin: '0 0 4px'
                    }}>
                      {key.key_prefix}••••••••••••••••
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                      {key.name || 'Unnamed key'}
                    </p>
                  </div>
                  <span className={`badge ${key.revoked_at ? 'error' : 'success'}`}>
                    {key.revoked_at ? 'Revoked' : 'Active'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No API keys yet. Create one to start using the API.
          </p>
        )}
      </div>

      {/* ── Webhooks Section ── */}
      <div className="card" style={{ marginTop: '20px', padding: '28px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Webhook size={20} />
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
              Webhooks
            </h3>
          </div>
          <Link 
            href={`/developer/applications/${id}/webhooks`}
            className="button secondary"
            style={{ fontSize: '13px', padding: '8px 14px' }}
          >
            Manage Webhooks
          </Link>
        </div>

        {webhooks && webhooks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {webhooks.slice(0, 3).map((webhook) => (
              <div 
                key={webhook.id}
                style={{
                  padding: '16px',
                  background: 'var(--paper)',
                  borderRadius: '12px',
                  border: '1px solid var(--line)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <p style={{ 
                      fontSize: '13px', 
                      fontFamily: 'DM Mono',
                      margin: '0 0 4px',
                      wordBreak: 'break-all'
                    }}>
                      {webhook.url}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                      {webhook.events.join(', ')}
                    </p>
                  </div>
                  <span className={`badge ${webhook.enabled ? 'success' : 'muted'}`}>
                    {webhook.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No webhooks configured. Add one to receive payment notifications.
          </p>
        )}
      </div>

      {/* ── Recent Payments ── */}
      <div className="card" style={{ marginTop: '20px', padding: '28px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} />
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
              Recent Payments
            </h3>
          </div>
        </div>

        {recentPayments && recentPayments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentPayments.map((payment) => (
              <div 
                key={payment.id}
                style={{
                  padding: '12px',
                  background: 'var(--paper)',
                  borderRadius: '8px',
                  border: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
                    {payment.label}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
                    {new Date(payment.created_at).toLocaleString()}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>
                    {payment.amount} {payment.currency}
                  </p>
                  <span className={`badge ${
                    payment.status === 'paid' ? 'success' : 
                    payment.status === 'pending' ? 'warning' : 'muted'
                  }`}>
                    {payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
            No payments yet. Integrate this application to start accepting payments.
          </p>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ 
          marginTop: '32px',
          display: 'flex',
          gap: '12px',
          paddingBottom: '40px'
        }}>
          <Link 
            href="/developer/docs"
            className="button secondary"
          >
            View Documentation
          </Link>
        </div>
      </main>
    </div>
  );
}
