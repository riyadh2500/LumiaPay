import Link from 'next/link';
import {
  Zap,
  Shield,
  Globe,
  BarChart3,
  Lock,
  RefreshCw,
  ArrowRight,
  Check,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <>
      {/* ── Nav ── */}
      <div className="site">
        <nav className="site-nav">
          <Link href="/" className="brand">
            <span className="brand-mark">L</span>
            LumiaPay
          </Link>

          <div className="site-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="site-nav-cta">
            <Link href="/login" className="button secondary" style={{ padding: '9px 14px', fontSize: 13 }}>
              Sign in
            </Link>
            <Link href="/signup" className="button lime" style={{ padding: '9px 14px', fontSize: 13 }}>
              Get started free
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-badge">
            <b>Powered by Arc</b>
            Sub-second finality · USDC as gas
          </div>

          <h1>
            Accept stablecoin payments
            <br />
            <em>on the Arc Network</em>
          </h1>

          <p>
            LumiaPay runs on Arc — a Layer-1 blockchain built for programmable
            money. Accept USDC and EURC with sub-second deterministic finality,
            predictable fees, and funds sent straight to your wallet.
          </p>

          <div className="hero-cta">
            <Link href="/signup" className="button" style={{ fontSize: 15, padding: '13px 22px' }}>
              Start for free <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="button secondary" style={{ fontSize: 15, padding: '13px 22px' }}>
              Sign in
            </Link>
          </div>

          <p className="hero-note">
            <Check size={13} style={{ color: '#2f9160' }} />
            No credit card required &nbsp;·&nbsp; Setup in 2 minutes
          </p>

          {/* Mock dashboard preview */}
          <div className="hero-preview">
            <div className="hero-preview-bar">
              <i /><i /><i />
            </div>
            <div className="hero-preview-body">
              <div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  <BarChart3 size={13} /> Dashboard
                </div>
                <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {[
                    { label: 'Total received', value: '$12,480' },
                    { label: 'Payments this month', value: '84' },
                    { label: 'Success rate', value: '98.2%' },
                    { label: 'Avg settlement', value: '< 1 s' },
                  ].map((m) => (
                    <div className="card metric" key={m.label} style={{ padding: '14px 16px', gap: 8 }}>
                      <span className="metric-label">{m.label}</span>
                      <span className="metric-value" style={{ fontSize: 20 }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  <RefreshCw size={13} /> Recent payments
                </div>
                {[
                  { label: 'Invoice #1042', currency: 'USDC', amount: '$250.00', status: 'paid' },
                  { label: 'Order #8821', currency: 'EURC', amount: '€89.00', status: 'paid' },
                  { label: 'Subscription', currency: 'USDC', amount: '$120.00', status: 'pending' },
                ].map((p) => (
                  <div
                    key={p.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--line)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{p.label}</span>
                    <span style={{ color: 'var(--muted)' }}>{p.amount}</span>
                    <span className={`status ${p.status}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust strip ── */}
        <div className="strip">
          <span>Arc Network</span>
          <span>·</span>
          <span>USDC &amp; EURC</span>
          <span>·</span>
          <span>Non-custodial</span>
          <span>·</span>
          <span>Sub-second finality</span>
          <span>·</span>
          <span>EVM compatible</span>
        </div>

        {/* ── Features ── */}
        <section className="section" id="features">
          <div className="section-head">
            <span className="eyebrow"><Zap size={13} /> Features</span>
            <h2>Everything you need to get paid on Arc</h2>
            <p>
              A full stablecoin payment stack built on Arc's Layer-1. Generate
              links, track settlement, and receive funds — all in one place.
            </p>
          </div>

          <div className="feature-grid">
            {[
              {
                icon: <Zap size={20} />,
                title: 'Instant payment links',
                desc: 'Create a payment request in seconds. Share the link — your customer scans a QR code or pastes the wallet address and pays on Arc.',
              },
              {
                icon: <Shield size={20} />,
                title: 'Deterministic on-chain verification',
                desc: 'Every payment is verified directly on Arc. Transactions reach deterministic finality in under one second — no reorgs, no uncertainty.',
              },
              {
                icon: <Globe size={20} />,
                title: 'Stablecoin-native tokens',
                desc: 'Accept USDC (USD-pegged) and EURC (EUR-pegged) — both natively supported on Arc. No volatile gas token required.',
              },
              {
                icon: <Lock size={20} />,
                title: 'Non-custodial',
                desc: 'Funds settle directly to your configured Arc wallet address. LumiaPay never holds or moves your money.',
              },
              {
                icon: <BarChart3 size={20} />,
                title: 'Real-time dashboard',
                desc: 'See all your payments at a glance — pending, paid, expired — with totals and settlement metrics powered by Arc\'s instant finality.',
              },
              {
                icon: <RefreshCw size={20} />,
                title: 'Auto-expiry & retry',
                desc: 'Payment links expire after 15 minutes. Create a new one in a single click — Arc\'s sub-second finality means no long waits on retry.',
              },
            ].map((f) => (
              <div className="card feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="section" id="how-it-works">
          <div className="section-head">
            <span className="eyebrow">How it works</span>
            <h2>From signup to first Arc payment in minutes</h2>
          </div>

          <div className="steps">
            {[
              { n: '01', title: 'Create an account', desc: 'Sign up with your email. No KYC, no lengthy onboarding.' },
              { n: '02', title: 'Add your Arc wallet', desc: 'Paste your Arc-compatible EVM wallet address in Settings. That\'s where USDC and EURC will land.' },
              { n: '03', title: 'Create a payment link', desc: 'Enter an amount, choose USDC or EURC, and get a shareable link tied to your Arc wallet.' },
              { n: '04', title: 'Get paid in under a second', desc: 'Your customer pays on Arc. Deterministic finality means the dashboard updates in under one second.' },
            ].map((s) => (
              <div className="card step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Trust ── */}
        <section className="section">
          <div className="section-head">
            <span className="eyebrow"><Shield size={13} /> Security &amp; trust</span>
            <h2>Built on Arc for reliability</h2>
          </div>

          <div className="trust-grid">
            {[
              {
                title: 'Non-custodial architecture',
                desc: 'Your wallet, your keys. LumiaPay only reads the Arc blockchain — it never holds or moves funds on your behalf.',
              },
              {
                title: 'Arc — sub-second deterministic finality',
                desc: 'Transactions finalize in under one second with no risk of chain reorganization, making every settlement irreversible and instant.',
              },
              {
                title: 'Stablecoin-first on Arc',
                desc: 'USDC and EURC are natively supported on Arc. Quote in dollars or euros, receive dollars or euros — zero price volatility.',
              },
              {
                title: 'Open &amp; auditable',
                desc: 'Every payment is publicly verifiable on the Arc blockchain. Customers can confirm receipt themselves without trusting LumiaPay.',
              },
            ].map((t) => (
              <div className="card trust-item" key={t.title}>
                <div className="icon-tick"><Check size={16} /></div>
                <div>
                  <h4 dangerouslySetInnerHTML={{ __html: t.title }} />
                  <p dangerouslySetInnerHTML={{ __html: t.desc }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Supported currencies ── */}
        <section className="section" style={{ textAlign: 'center', paddingTop: 0 }}>
          <span className="eyebrow" style={{ justifyContent: 'center', marginBottom: 16 }}>Supported tokens</span>
          <div className="currency-pills">
            {[
              { label: 'USDC', sub: 'USD Coin · Arc native' },
              { label: 'EURC', sub: 'Euro Coin · Arc native' },
              { label: 'USYC', sub: 'Yield-bearing USD · Arc' },
            ].map((c) => (
              <div className="currency-pill" key={c.label}>
                <i />
                <span>
                  <strong>{c.label}</strong>{' '}
                  <span style={{ fontWeight: 400, color: 'var(--muted)' }}>{c.sub}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="section" id="faq">
          <div className="section-head">
            <span className="eyebrow">FAQ</span>
            <h2>Common questions</h2>
          </div>

          <div className="faq">
            {[
              {
                q: 'Does LumiaPay hold my funds?',
                a: 'No. Payments settle directly from the payer\'s wallet to your Arc wallet address. LumiaPay only reads the Arc blockchain to confirm receipt — it never holds or moves your funds.',
              },
              {
                q: 'What network do you support?',
                a: 'Arc — a purpose-built Layer-1 blockchain for stablecoin-native finance. It offers sub-second deterministic finality, USDC as the gas token, and full EVM compatibility.',
              },
              {
                q: 'How does payment verification work?',
                a: 'When a customer pays on Arc, LumiaPay reads the Arc blockchain for a matching inbound transfer to your wallet. Arc\'s deterministic finality means the transaction is confirmed and irreversible in under one second.',
              },
              {
                q: 'What happens if a payment expires?',
                a: 'Payment links are valid for 15 minutes. If the timer runs out, the link expires and no funds are locked — your customer simply didn\'t complete the payment. You can create a new link instantly.',
              },
              {
                q: 'Is there a transaction fee?',
                a: 'LumiaPay charges no platform fees. You only pay the Arc network gas fee, which is denominated in USDC and kept predictably low by Arc\'s stable fee design.',
              },
            ].map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA band ── */}
        <section style={{ padding: '0 0 80px' }}>
          <div className="cta-band">
            <h2>Ready to accept stablecoin payments on Arc?</h2>
            <p>Join merchants already using LumiaPay for sub-second, fee-predictable settlements on the Arc Network.</p>
            <div className="hero-cta">
              <Link href="/signup" className="button lime" style={{ fontSize: 15, padding: '13px 24px' }}>
                Get started free <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="button" style={{ fontSize: 15, padding: '13px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
                Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="site-footer">
          <div>
            <Link href="/" className="brand" style={{ marginBottom: 10, display: 'flex' }}>
              <span className="brand-mark">L</span>
              LumiaPay
            </Link>
            <p className="site-footer-bottom">© {new Date().getFullYear()} LumiaPay. All rights reserved.</p>
          </div>

          <div className="site-footer-links">
            <div className="site-footer-col">
              <h5>Product</h5>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="site-footer-col">
              <h5>Account</h5>
              <Link href="/login">Sign in</Link>
              <Link href="/signup">Sign up</Link>
              <Link href="/settings">Settings</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
