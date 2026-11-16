import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import CreateApplicationForm from '@/components/create-application-form';
import { Layers, Plus, Circle, Calendar, Activity } from 'lucide-react';

export const metadata = { title: 'Applications — LumiaPay Developer' };

export default async function ApplicationsPage() {
  const user = await requireUser();
  const admin = createAdminClient();

  // Fetch user's applications
  const { data: applications } = await admin
    .from('applications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <AppShell email={user.email}>
      {/* ── Page Header ── */}
      <div>
        <span className="eyebrow">
          <Layers size={13} /> Applications
        </span>
        <h1 className="heading">Developer Applications</h1>
        <p className="subheading">
          Create and manage applications that use the LumiaPay API.
        </p>
      </div>

      {/* ── Create Application Card ── */}
      <div className="card" style={{ marginTop: '28px', padding: '28px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'var(--lime)',
            color: 'var(--ink)',
            display: 'grid',
            placeItems: 'center'
          }}>
            <Plus size={18} strokeWidth={3} />
          </div>
          <h3 style={{ 
            fontSize: '17px',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            margin: 0
          }}>
            Create New Application
          </h3>
        </div>

        <CreateApplicationForm />
      </div>

      {/* ── Applications List ── */}
      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>
          Your Applications
        </h2>

        {!applications || applications.length === 0 ? (
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
                <Layers size={32} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ 
                  fontSize: '16px',
                  fontWeight: 700,
                  margin: '0 0 6px',
                  letterSpacing: '-0.3px'
                }}>
                  No applications yet
                </p>
                <p style={{ 
                  fontSize: '13px',
                  color: 'var(--muted)',
                  margin: 0,
                  maxWidth: '320px'
                }}>
                  Create your first application above to get API keys and start integrating LumiaPay into your platform.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '16px'
          }}>
            {applications.map((app: any) => (
              <a
                key={app.id}
                href={`/developer/applications/${app.id}`}
                className="card app-card-hover"
                style={{ 
                  padding: '24px',
                  display: 'block',
                  textDecoration: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '17px', marginBottom: '6px', letterSpacing: '-0.5px' }}>
                      {app.name}
                    </div>
                    {app.description && (
                      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                        {app.description}
                      </div>
                    )}
                  </div>
                  
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '99px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: app.status === 'active' ? '#dff8e9' : '#f3f4f6',
                    color: app.status === 'active' ? '#197946' : '#6b7280',
                    marginLeft: '12px'
                  }}>
                    <Circle 
                      size={6} 
                      style={{ fill: 'currentColor' }}
                    />
                    {app.status.toUpperCase()}
                  </div>
                </div>

                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  marginTop: '18px',
                  paddingTop: '18px',
                  borderTop: '1px solid var(--line)'
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      Environment
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: app.environment === 'live' ? '#dff8e9' : '#fff3cd',
                      color: app.environment === 'live' ? '#197946' : '#896617'
                    }}>
                      {app.environment === 'live' ? '🟢 Live' : '🟡 Test'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                      <Calendar size={9} style={{ display: 'inline', marginRight: '3px' }} />
                      Created
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>
                      {new Date(app.created_at).toLocaleDateString('en-US', { 
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>
                  </div>

                  {app.last_used_at && (
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
                        <Activity size={9} style={{ display: 'inline', marginRight: '3px' }} />
                        Last Used
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>
                        {new Date(app.last_used_at).toLocaleDateString('en-US', { 
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
