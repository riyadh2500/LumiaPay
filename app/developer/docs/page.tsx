import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import { Book, Key, Zap, Code, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

export const metadata = { title: 'API Documentation — LumiaPay Developer' };

const CODE_BG = '#0f1117';
const CODE_COLOR = '#e2e8f0';

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div style={{ background: CODE_BG, borderRadius: '10px', overflow: 'hidden', marginTop: '12px', marginBottom: '8px' }}>
      <div style={{ padding: '8px 16px', background: '#1a1f2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{lang}</span>
      </div>
      <pre style={{ margin: 0, padding: '16px', overflowX: 'auto', fontSize: '13px', lineHeight: '1.6', color: CODE_COLOR, fontFamily: 'DM Mono, monospace' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, icon, children }: { id: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid var(--line)' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--mint)', color: '#1d5c3a', display: 'grid', placeItems: 'center' }}>
          {icon}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Param({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
      <div style={{ minWidth: '160px' }}>
        <code style={{ fontSize: '13px', fontFamily: 'DM Mono, monospace', color: '#1d5c3a', background: 'var(--mint)', padding: '2px 8px', borderRadius: '4px' }}>{name}</code>
        {required && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>required</span>}
      </div>
      <div style={{ minWidth: '80px' }}>
        <span style={{ fontSize: '12px', color: '#7c3aed', fontFamily: 'DM Mono, monospace', background: '#f3e8ff', padding: '2px 6px', borderRadius: '4px' }}>{type}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' }}>{desc}</div>
    </div>
  );
}

export default async function DocsPage() {
  const user = await requireUser();

  return (
    <AppShell email={user.email}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <span className="eyebrow"><Book size={13} /> Documentation</span>
        <h1 className="heading">API Documentation</h1>
        <p className="subheading">Complete reference for integrating LumiaPay crypto payments into your app.</p>
      </div>

      {/* Quick Nav */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '32px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { label: 'Authentication', href: '#auth' },
          { label: 'Create Payment', href: '#create-payment' },
          { label: 'Get Payment', href: '#get-payment' },
          { label: 'List Payments', href: '#list-payments' },
          { label: 'Cancel Payment', href: '#cancel-payment' },
          { label: 'Webhooks', href: '#webhooks' },
          { label: 'Error Codes', href: '#errors' },
        ].map(nav => (
          <a key={nav.href} href={nav.href} style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)', background: 'var(--paper)', padding: '6px 14px', borderRadius: '20px', textDecoration: 'none', border: '1px solid var(--line)' }}>
            {nav.label}
          </a>
        ))}
      </div>

      {/* Base URL */}
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px 20px', marginBottom: '32px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <CheckCircle size={18} color="#16a34a" />
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: '4px' }}>Base URL</div>
          <code style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', color: '#14532d' }}>https://lumia-pay-two.vercel.app/api/v1</code>
        </div>
      </div>

      {/* Authentication */}
      <Section id="auth" title="Authentication" icon={<Key size={16} />}>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.7', marginBottom: '16px' }}>
          All API requests require authentication using your API key. Pass your key in the <code style={{ fontFamily: 'DM Mono', background: 'var(--paper)', padding: '1px 6px', borderRadius: '4px' }}>Authorization</code> header.
        </p>
        <CodeBlock lang="http" code={`Authorization: Bearer lp_test_your_api_key_here`} />
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <div style={{ flex: 1, background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>🧪 Test Keys</div>
            <div style={{ fontSize: '12px', color: '#78350f' }}>Prefix: <code style={{ fontFamily: 'DM Mono' }}>lp_test_</code><br />No real blockchain transactions. Safe for development.</div>
          </div>
          <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>🚀 Live Keys</div>
            <div style={{ fontSize: '12px', color: '#14532d' }}>Prefix: <code style={{ fontFamily: 'DM Mono' }}>lp_live_</code><br />Real Arc Network transactions. Use in production only.</div>
          </div>
        </div>
      </Section>

      {/* Create Payment */}
      <Section id="create-payment" title="Create Payment" icon={<Zap size={16} />}>
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: '#1d5c3a', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono', marginBottom: '16px' }}>
          <span style={{ background: '#a3e635', color: '#1d5c3a', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>POST</span>
          /api/v1/payments
        </div>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.7', marginBottom: '16px' }}>
          Creates a new payment request. Returns a checkout URL that your customer visits to complete the payment.
        </p>

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Request Body</h4>
        <div className="card" style={{ padding: '0 16px' }}>
          <Param name="amount" type="string" required desc='Payment amount as string. Example: "10.50"' />
          <Param name="currency" type="enum" required desc='"USDC" or "EURC"' />
          <Param name="label" type="string" required desc='Payment description shown to customer. Max 200 chars.' />
          <Param name="metadata" type="object" desc='Optional key-value pairs. Store customer ID, order ID, etc.' />
        </div>

        <CodeBlock lang="javascript" code={`const response = await fetch('https://lumia-pay-two.vercel.app/api/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer lp_test_your_key',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: '25.00',
    currency: 'USDC',
    label: 'Invoice #1234',
    metadata: {
      customer_id: 'cus_abc123',
      order_id: 'ord_456',
    },
  }),
});

const payment = await response.json();
// Redirect customer to: payment.checkout_url`} />

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', marginTop: '20px' }}>Response (201)</h4>
        <CodeBlock lang="json" code={`{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": "25.00",
  "currency": "USDC",
  "status": "pending",
  "label": "Invoice #1234",
  "wallet_address": "0x742d35Cc6634C0532925a3b8...",
  "checkout_url": "https://lumia-pay-two.vercel.app/pay/550e8400-...",
  "expires_at": "2026-11-16T22:00:00Z",
  "created_at": "2026-11-16T21:00:00Z",
  "metadata": { "customer_id": "cus_abc123" }
}`} />
      </Section>

      {/* Get Payment */}
      <Section id="get-payment" title="Get Payment" icon={<Code size={16} />}>
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: '#1e3a5f', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono', marginBottom: '16px' }}>
          <span style={{ background: '#93c5fd', color: '#1e3a5f', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>GET</span>
          /api/v1/payments/:id
        </div>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.7', marginBottom: '16px' }}>
          Retrieve a specific payment by ID. Use this to check payment status.
        </p>
        <CodeBlock lang="javascript" code={`const response = await fetch(
  'https://lumia-pay-two.vercel.app/api/v1/payments/550e8400-e29b-41d4-a716-446655440000',
  {
    headers: { 'Authorization': 'Bearer lp_test_your_key' },
  }
);
const payment = await response.json();`} />

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', marginTop: '20px' }}>Payment Statuses</h4>
        <div className="card" style={{ padding: '0 16px' }}>
          {[
            { status: 'pending', color: '#f59e0b', desc: 'Payment created, waiting for customer' },
            { status: 'detecting', color: '#3b82f6', desc: 'Transaction detected on blockchain' },
            { status: 'verifying', color: '#8b5cf6', desc: 'Confirming transaction' },
            { status: 'paid', color: '#16a34a', desc: 'Payment confirmed ✓' },
            { status: 'expired', color: '#dc2626', desc: 'Payment link expired (1 hour)' },
            { status: 'failed', color: '#dc2626', desc: 'Payment failed' },
          ].map(s => (
            <div key={s.status} style={{ display: 'flex', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <span style={{ background: s.color + '20', color: s.color, padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, minWidth: '90px', textAlign: 'center' }}>{s.status}</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{s.desc}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* List Payments */}
      <Section id="list-payments" title="List Payments" icon={<Code size={16} />}>
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: '#1e3a5f', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono', marginBottom: '16px' }}>
          <span style={{ background: '#93c5fd', color: '#1e3a5f', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>GET</span>
          /api/v1/payments
        </div>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.7', marginBottom: '16px' }}>
          List all payments with optional filtering and pagination.
        </p>

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Query Parameters</h4>
        <div className="card" style={{ padding: '0 16px' }}>
          <Param name="status" type="enum" desc="Filter by status: pending, paid, expired, failed" />
          <Param name="limit" type="number" desc="Results per page. Default: 20, Max: 100" />
          <Param name="offset" type="number" desc="Pagination offset. Default: 0" />
        </div>

        <CodeBlock lang="javascript" code={`const response = await fetch(
  'https://lumia-pay-two.vercel.app/api/v1/payments?status=paid&limit=10',
  {
    headers: { 'Authorization': 'Bearer lp_test_your_key' },
  }
);
const { data, total, limit, offset } = await response.json();`} />
      </Section>

      {/* Cancel Payment */}
      <Section id="cancel-payment" title="Cancel Payment" icon={<Code size={16} />}>
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', background: '#7f1d1d', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, fontFamily: 'DM Mono', marginBottom: '16px' }}>
          <span style={{ background: '#fca5a5', color: '#7f1d1d', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>POST</span>
          /api/v1/payments/:id/cancel
        </div>
        <CodeBlock lang="javascript" code={`const response = await fetch(
  'https://lumia-pay-two.vercel.app/api/v1/payments/550e8400-.../cancel',
  {
    method: 'POST',
    headers: { 'Authorization': 'Bearer lp_test_your_key' },
  }
);`} />
      </Section>

      {/* Webhooks */}
      <Section id="webhooks" title="Webhooks" icon={<Zap size={16} />}>
        <p style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: '1.7', marginBottom: '16px' }}>
          Webhooks notify your server when a payment status changes. Configure your webhook URL in the application settings.
        </p>

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Webhook Payload</h4>
        <CodeBlock lang="json" code={`{
  "event": "payment.paid",
  "payment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": "25.00",
    "currency": "USDC",
    "status": "paid",
    "transaction_hash": "0xabc123...",
    "metadata": { "customer_id": "cus_abc123" }
  },
  "timestamp": "2026-11-16T21:30:00Z"
}`} />

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', marginTop: '20px' }}>Webhook Events</h4>
        <div className="card" style={{ padding: '0 16px' }}>
          {[
            { event: 'payment.created', desc: 'New payment created' },
            { event: 'payment.detecting', desc: 'Transaction detected on blockchain' },
            { event: 'payment.paid', desc: 'Payment confirmed successfully' },
            { event: 'payment.expired', desc: 'Payment link expired' },
            { event: 'payment.failed', desc: 'Payment failed' },
          ].map(e => (
            <div key={e.event} style={{ display: 'flex', gap: '16px', padding: '10px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <code style={{ fontSize: '12px', fontFamily: 'DM Mono', color: '#1d5c3a', background: 'var(--mint)', padding: '2px 8px', borderRadius: '4px', minWidth: '170px' }}>{e.event}</code>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{e.desc}</span>
            </div>
          ))}
        </div>

        <h4 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px', marginTop: '20px' }}>Verifying Webhook Signature</h4>
        <CodeBlock lang="javascript" code={`import crypto from 'crypto';

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post('/webhook', (req, res) => {
  const sig = req.headers['x-lumiapay-signature'];
  if (!verifyWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const { event, payment } = req.body;
  if (event === 'payment.paid') {
    // Fulfill the order
    await fulfillOrder(payment.metadata.order_id);
  }
  
  res.status(200).send('OK');
});`} />
      </Section>

      {/* Error Codes */}
      <Section id="errors" title="Error Codes" icon={<AlertCircle size={16} />}>
        <div className="card" style={{ padding: '0 16px' }}>
          {[
            { code: '400', title: 'Bad Request', desc: 'Invalid request body or missing required fields' },
            { code: '401', title: 'Unauthorized', desc: 'Missing or invalid API key' },
            { code: '403', title: 'Forbidden', desc: 'API key does not have permission' },
            { code: '404', title: 'Not Found', desc: 'Payment not found' },
            { code: '409', title: 'Conflict', desc: 'Payment already in terminal state' },
            { code: '429', title: 'Rate Limited', desc: 'Too many requests. Slow down.' },
            { code: '500', title: 'Server Error', desc: 'Internal server error. Try again.' },
          ].map(e => (
            <div key={e.code} style={{ display: 'flex', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
              <span style={{ fontFamily: 'DM Mono', fontWeight: 700, fontSize: '13px', color: parseInt(e.code) >= 500 ? '#dc2626' : parseInt(e.code) >= 400 ? '#d97706' : '#16a34a', minWidth: '40px' }}>{e.code}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '130px' }}>{e.title}</span>
              <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{e.desc}</span>
            </div>
          ))}
        </div>
        <CodeBlock lang="json" code={`{
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be a positive number",
    "status": 400
  }
}`} />
      </Section>

    </AppShell>
  );
}