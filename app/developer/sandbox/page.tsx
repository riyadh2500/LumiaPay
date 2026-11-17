import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { TestTube2, AlertCircle, Check } from 'lucide-react';
import SandboxTester from '@/components/sandbox-tester';

export const metadata = { title: 'Sandbox — LumiaPay Developer' };

export default async function SandboxPage() {
  const user = await requireUser();

  return (
    <AppShell email={user.email}>
      {/* Header */}
      <div>
        <span className="eyebrow"><TestTube2 size={13} /> Sandbox</span>
        <h1 className="heading">API Tester</h1>
        <p className="subheading">Test your API keys live — no real blockchain transactions.</p>
      </div>

      {/* Warning */}
      <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '8px' }}>
        <AlertCircle size={18} color="#d97706" style={{ marginTop: '1px', flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#92400e', marginBottom: '2px' }}>Sandbox Mode</div>
          <div style={{ fontSize: '13px', color: '#78350f' }}>Use your <strong>test API keys</strong> (prefix: <code style={{ fontFamily: 'DM Mono' }}>lp_test_</code>). Payments are simulated — no real USDC/EURC needed.</div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '8px' }}>
        {[
          'No real funds required',
          'Full API access',
          'Real webhook events',
          'Isolated test data',
        ].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px' }}>
            <Check size={14} color="#16a34a" strokeWidth={3} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#14532d' }}>{f}</span>
          </div>
        ))}
      </div>

      {/* Interactive Tester */}
      <SandboxTester />
    </AppShell>
  );
}