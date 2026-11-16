import { requireUser } from '@/components/require-user';
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import ApplicationSidebar from '@/components/application-sidebar';
import DeleteApplicationForm from '@/components/delete-application-form';
import { Settings, Trash2 } from 'lucide-react';

export const metadata = { title: 'Application Settings — LumiaPay Developer' };

export default async function ApplicationSettingsPage({ 
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

  return (
    <div className="app-layout">
      <ApplicationSidebar 
        applicationId={application.id} 
        applicationName={application.name}
      />
      
      <main className="app-main">
        <div className="app-header">
          <span className="eyebrow">
            <Settings size={13} /> Application Settings
          </span>
          <h1 className="heading">{application.name}</h1>
          <p className="subheading">
            Manage application configuration and danger zone actions
          </p>
        </div>

        {/* Application Info */}
        <div className="card" style={{ marginTop: '32px', padding: '28px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '20px' }}>
            Application Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ 
                fontSize: '13px', 
                fontWeight: 600, 
                color: 'var(--muted)',
                display: 'block',
                marginBottom: '6px'
              }}>
                Application Name
              </label>
              <div style={{ 
                fontSize: '15px', 
                fontWeight: 600,
                padding: '12px 16px',
                background: 'var(--paper)',
                borderRadius: '8px',
                border: '1px solid var(--line)'
              }}>
                {application.name}
              </div>
            </div>

            <div>
              <label style={{ 
                fontSize: '13px', 
                fontWeight: 600, 
                color: 'var(--muted)',
                display: 'block',
                marginBottom: '6px'
              }}>
                Description
              </label>
              <div style={{ 
                fontSize: '14px',
                padding: '12px 16px',
                background: 'var(--paper)',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                color: application.description ? 'inherit' : 'var(--muted)'
              }}>
                {application.description || 'No description provided'}
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px'
            }}>
              <div>
                <label style={{ 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: 'var(--muted)',
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Environment
                </label>
                <div style={{ 
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '12px 16px',
                  background: 'var(--paper)',
                  borderRadius: '8px',
                  border: '1px solid var(--line)'
                }}>
                  {application.environment === 'test' ? '🧪 Test' : '🚀 Live'}
                </div>
              </div>

              <div>
                <label style={{ 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: 'var(--muted)',
                  display: 'block',
                  marginBottom: '6px'
                }}>
                  Status
                </label>
                <div style={{ 
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '12px 16px',
                  background: 'var(--paper)',
                  borderRadius: '8px',
                  border: '1px solid var(--line)'
                }}>
                  <span className={`badge ${application.status === 'active' ? 'success' : 'muted'}`}>
                    {application.status}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ 
                fontSize: '13px', 
                fontWeight: 600, 
                color: 'var(--muted)',
                display: 'block',
                marginBottom: '6px'
              }}>
                Created
              </label>
              <div style={{ 
                fontSize: '14px',
                padding: '12px 16px',
                background: 'var(--paper)',
                borderRadius: '8px',
                border: '1px solid var(--line)'
              }}>
                {new Date(application.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div 
          className="card" 
          style={{ 
            marginTop: '32px', 
            padding: '28px',
            border: '2px solid #fca5a5',
            background: '#fef2f2'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Trash2 size={20} color="#dc2626" />
            <h3 style={{ 
              fontSize: '17px', 
              fontWeight: 800, 
              margin: 0,
              color: '#dc2626'
            }}>
              Danger Zone
            </h3>
          </div>

          <p style={{ 
            fontSize: '14px', 
            color: '#7f1d1d',
            marginBottom: '20px',
            lineHeight: '1.6'
          }}>
            Once you delete an application, there is no going back. This will permanently delete:
          </p>

          <ul style={{ 
            fontSize: '13px', 
            color: '#7f1d1d',
            marginBottom: '24px',
            paddingLeft: '20px'
          }}>
            <li>All API keys associated with this application</li>
            <li>All webhook configurations</li>
            <li>Payment history and analytics data</li>
            <li>Integration settings</li>
          </ul>

          <DeleteApplicationForm 
            applicationId={application.id}
            applicationName={application.name}
          />
        </div>

        <div style={{ height: '40px' }} />
      </main>
    </div>
  );
}
