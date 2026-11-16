import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { Book, ExternalLink, Code, Webhook, Zap, FileText } from 'lucide-react';

export const metadata = { title: 'API Documentation — LumiaPay Developer' };

export default async function DocsPage() {
  const user = await requireUser();

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <Book size={13} /> Documentation
        </span>
        <h1 className="heading">API Documentation</h1>
        <p className="subheading">
          Complete API reference, authentication guides, and integration examples.
        </p>
      </div>

      <div style={{ marginTop: '28px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Documentation Resources</h2>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px'
        }}>
          <a 
            href="https://github.com/riyadh2500/LumiaPay/blob/main/docs/DEVELOPER_API.md" 
            target="_blank"
            rel="noopener noreferrer"
            className="card doc-link-card"
            style={{ 
              padding: '24px',
              display: 'block',
              textDecoration: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#dff0ff',
                color: '#1d71e8',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Code size={20} />
              </div>
              <ExternalLink size={16} style={{ color: 'var(--muted)' }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '6px', letterSpacing: '-0.3px' }}>
              API Reference
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
              Complete endpoint documentation with request/response examples
            </div>
          </a>

          <a 
            href="https://github.com/riyadh2500/LumiaPay/blob/main/docs/WEBHOOK_GUIDE.md" 
            target="_blank"
            rel="noopener noreferrer"
            className="card doc-link-card"
            style={{ 
              padding: '24px',
              display: 'block',
              textDecoration: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#f3e5ff',
                color: '#7c3aed',
                display: 'grid',
                placeItems: 'center'
              }}>
                <Webhook size={20} />
              </div>
              <ExternalLink size={16} style={{ color: 'var(--muted)' }} />
            </div>
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '6px', letterSpacing: '-0.3px' }}>
              Webhook Guide
            </div>
            <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>
              Setup webhooks and verify signatures with code examples
            </div>
          </a>
        </div>
      </div>

      <div style={{ marginTop: '32px' }}>
        <h2 className="section-title" style={{ marginBottom: '16px' }}>Quick Start</h2>
        
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '10px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--lime)',
                  color: 'var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                  fontFamily: 'DM Mono'
                }}>
                  1
                </div>
                <h4 style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>
                  Create Application
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.5' }}>
                Get your API keys by creating an application in the Applications section.
              </p>
              <div style={{
                background: '#f8f9fa',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontFamily: 'DM Mono',
                fontSize: '12px',
                color: '#2d5f48'
              }}>
                Applications → Create New Application → Get API Keys
              </div>
            </div>

            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '10px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--lime)',
                  color: 'var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                  fontFamily: 'DM Mono'
                }}>
                  2
                </div>
                <h4 style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>
                  Make API Request
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.5' }}>
                Use your secret key to create a payment:
              </p>
              <pre style={{
                background: '#12251f',
                color: '#d8fbe9',
                borderRadius: '10px',
                padding: '16px',
                fontFamily: 'DM Mono',
                fontSize: '11.5px',
                lineHeight: '1.6',
                overflow: 'auto',
                margin: 0
              }}>
{`curl https://lumia-pay.vercel.app/api/v1/payments \\
  -X POST \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "100.00",
    "currency": "USDC",
    "label": "Product Purchase"
  }'`}
              </pre>
            </div>

            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '10px'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'var(--lime)',
                  color: 'var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '13px',
                  fontFamily: 'DM Mono'
                }}>
                  3
                </div>
                <h4 style={{ fontWeight: 700, fontSize: '15px', margin: 0 }}>
                  Setup Webhooks
                </h4>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.5' }}>
                Get notified when payments complete:
              </p>
              <div style={{
                background: '#f8f9fa',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontFamily: 'DM Mono',
                fontSize: '12px',
                color: '#2d5f48'
              }}>
                Applications → Select App → Configure Webhooks
              </div>
            </div>
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
            >
              <Zap size={16} />
              Get Started
            </a>
            <a 
              href="https://github.com/riyadh2500/LumiaPay/blob/main/docs/DEVELOPER_API.md" 
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary"
            >
              <FileText size={16} />
              Full Documentation
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
