import { requireUser } from '@/components/require-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import ApplicationSidebar from '@/components/application-sidebar';
import { Key, Copy } from 'lucide-react';
import ApiKeyItem from '@/components/api-key-item';

export const metadata = { title: 'API Keys — LumiaPay Developer' };

export default async function ApiKeysPage({ 
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

  return (
    <div className="app-layout">
      <ApplicationSidebar 
        applicationId={application.id} 
        applicationName={application.name}
      />
      
      <main className="app-main">
        <div className="app-header">
          <span className="eyebrow">
            <Key size={13} /> API Keys
          </span>
          <h1 className="heading">Manage API Keys</h1>
          <p className="subheading">
            API keys are used to authenticate requests to the LumiaPay API from your application.
          </p>
        </div>

        {/* Create New Key Notice */}
        <div className="card" style={{ 
          padding: '20px 24px',
          background: '#fef3c7',
          border: '1px solid #fbbf24',
          marginBottom: '24px'
        }}>
          <p style={{ fontSize: '14px', color: '#78350f', margin: 0 }}>
            <strong>Note:</strong> API keys were automatically generated when you created this application. 
            To create additional keys or manage existing ones, contact support.
          </p>
        </div>

        {/* API Keys List */}
        {apiKeys && apiKeys.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {apiKeys.map((key) => (
              <ApiKeyItem key={key.id} apiKey={key} />
            ))}
          </div>
        ) : (
          <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: 'var(--mint)',
              color: '#1d5c3a',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 20px'
            }}>
              <Key size={32} strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>
              No API Keys Yet
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--muted)', maxWidth: '400px', margin: '0 auto' }}>
              API keys are generated automatically when you create an application. 
              If you don't see any keys, try creating a new application.
            </p>
          </div>
        )}

        <div style={{ height: '40px' }} />
      </main>
    </div>
  );
}
