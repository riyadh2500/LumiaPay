import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { TestTube2, AlertCircle, Check, Sparkles, ArrowRight } from 'lucide-react';

export const metadata = { title: 'Sandbox — LumiaPay Developer' };

export default async function SandboxPage() {
  const user = await requireUser();

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <TestTube2 size={13} /> Sandbox
        </span>
        <h1 className="heading">Test Environment</h1>
        <p className="subheading">
          Test your integration without real blockchain transactions.
        </p>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%)',
        border: '1.5px solid #f2d888',
        borderRadius: '16px',
        padding: '18px 22px',
        display: 'flex',
        gap: '14px',
        alignItems: 'flex-start',
        marginTop: '24px'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          background: '#ffeaa7',
          display: 'grid',
          placeItems: 'center',
          color: '#896617',
          flexShrink: 0
        }}>
          <AlertCircle size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
            Sandbox Mode Active
          </div>
          <div style={{ fontSize: '13px', color: '#6b5417', lineHeight: '1.5' }}>
            Payments created with test API keys are simulated and do not interact with the blockchain.
          </div>
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Test Environment Features</h2>
        
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: '#d8fbe9',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}>
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  No Real Funds Required
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  Test payments don't require real USDC/EURC or blockchain transactions
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: '#d8fbe9',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}>
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  Full API Access
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  All API endpoints work exactly the same as in live mode
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: '#d8fbe9',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}>
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  Webhook Testing
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  Receive webhook events for test payments
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: '#d8fbe9',
                color: '#1d5c3a',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}>
                <Check size={18} strokeWidth={3} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                  Isolated Data
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                  Test and live environments are completely separate
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Getting Started with Test Mode</h2>
        
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {[
              {
                num: '1',
                title: 'Create a Test Application',
                desc: 'Go to Applications → Create New → Select "Test" environment'
              },
              {
                num: '2',
                title: 'Use Test API Keys',
                desc: 'Your test keys will start with pk_test_ and sk_test_'
              },
              {
                num: '3',
                title: 'Make Test Payments',
                desc: `Use the API to create payments. They'll be marked as "test" automatically.`
              },
              {
                num: '4',
                title: 'Simulate Payment Completion',
                desc: 'Currently requires manual database update. Full simulation coming in Phase 2.3.'
              }
            ].map((step) => (
              <div key={step.num} style={{ 
                display: 'flex', 
                gap: '16px',
                paddingBottom: step.num !== '4' ? '20px' : '0',
                borderBottom: step.num !== '4' ? '1px solid var(--line)' : 'none'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  background: 'var(--lime)',
                  color: 'var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '15px',
                  fontFamily: 'DM Mono',
                  flexShrink: 0
                }}>
                  {step.num}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            marginTop: '28px',
            paddingTop: '24px',
            borderTop: '1px solid var(--line)',
            display: 'flex',
            gap: '12px'
          }}>
            <a 
              href="/developer/applications" 
              className="button lime"
              style={{ gap: '8px' }}
            >
              <Sparkles size={16} />
              Create Test Application
              <ArrowRight size={16} />
            </a>
            <a 
              href="/developer/docs" 
              className="button secondary"
            >
              View Documentation
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
