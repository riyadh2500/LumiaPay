import Link from 'next/link';
import Image from 'next/image';
import {
  Zap, Shield, Globe, BarChart3, Lock, RefreshCw, ArrowRight, Check,
} from 'lucide-react';
import AnimatedBackground from './animated-background';

export default function LandingPage() {
  return (
    <>
      <AnimatedBackground />
      <div className="site" style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Nav ── */}
        <nav className="site-nav">
          <Link href="/" className="brand">
            <Image src="/logo.png" alt="LumiaPay" width={32} height={32} className="brand-logo" />
            LumiaPay
          </Link>
          <div className="site-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="site-nav-cta">
            <Link href="/login" className="button secondary" style={{ padding: '9px 14px', fontSize: 13 }}>Sign in</Link>
            <Link href="/signup" className="button lime" style={{ padding: '9px 14px', fontSize: 13 }}>Get started free</Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="hero">
          {/* Floating badge */}
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
            predictable fees, and funds straight to your wallet.
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

          {/* Floating stats */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '16px',
            flexWrap: 'wrap', marginTop: '32px', marginBottom: '-16px'
          }}>
            {[
              { value: '< 1s', label: 'Settlement time' },
              { value: '0%', label: 'Custody risk' },
              { value: '2 min', label: 'Setup time' },
              { value: '24/7', label: 'Uptime' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'rgba(255,254,250,0.8)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                padding: '12px 20px',
                textAlign: 'center',
                animation: 'fadeInUp 0.8s ease-out both',
              }}>
                <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Mock dashboard preview */}
          <div className="hero-preview" style={{ marginTop: '48px' }}>
            <div className="hero-preview-bar">
              <i style={{ background: '#ff6b6b' }} />
              <i style={{ background: '#ffd93d' }} />
              <i style={{ background: '#6bcb77' }} />
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                lumia-pay.app/dashboard
              </span>
            </div>
            <div className="hero-preview-body">
              <div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>
                  <BarChart3 size={13} /> Dashboard
                </div>
                <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                  {[
                    { label: 'Total received', value: '$12,480' },
                    { label: 'This month', value: '84' },
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
                  { label: 'Invoice #1042', amount: '$250.00', status: 'paid', currency: 'USDC' },
                  { label: 'Order #8821', amount: '€89.00', status: 'paid', currency: 'EURC' },
                  { label: 'Subscription', amount: '$120.00', status: 'pending', currency: 'USDC' },
                ].map((p) => (
                  <div key={p.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 700 }}>{p.label}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.currency}</span>
                    <span style={{ fontWeight: 700 }}>{p.amount}</span>
                    <span className={`status ${p.status}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust strip ── */}
        <div className="strip">
          {['Arc Network', 'USDC & EURC', 'Non-custodial', 'Sub-second finality', 'EVM compatible', 'Developer API'].map((s, i) => (
            <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {i > 0 && <span style={{ color: 'var(--line)', fontSize: '20px', fontWeight: 300 }}>·</span>}
              {s}
            </span>
          ))}
        </div>

        {/* ── Features ── */}
        <section className="section" id="features">
          <div className="section-head">
            <span className="eyebrow"><Zap size={13} /> Features</span>
            <h2>Everything you need to get paid on Arc</h2>
            <p>A full stablecoin payment stack built on Arc's Layer-1.</p>
          </div>

          <div className="feature-grid">
            {[
              { icon: <Zap size={20} />, title: 'Instant payment links', desc: 'Create a payment request in seconds. Share the link — your customer scans a QR code or pastes the wallet address.' },
              { icon: <Shield size={20} />, title: 'On-chain verification', desc: 'Every payment is verified directly on Arc. Deterministic finality in under one second — no reorgs, no uncertainty.' },
              { icon: <Globe size={20} />, title: 'Stablecoin-native', desc: 'Accept USDC (USD-pegged) and EURC (EUR-pegged) — both natively supported on Arc. No volatile gas token required.' },
              { icon: <Lock size={20} />, title: 'Non-custodial', desc: 'Funds settle directly to your configured Arc wallet address. LumiaPay never holds or moves your money.' },
              { icon: <BarChart3 size={20} />, title: 'Real-time dashboard', desc: 'See all your payments at a glance — pending, paid, expired — with totals and settlement metrics.' },
              { icon: <RefreshCw size={20} />, title: 'Developer API', desc: 'Full REST API with API keys, webhooks, and sandbox mode. Integrate crypto payments into any app in minutes.' },
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
            <h2>From signup to first payment in minutes</h2>
          </div>
          <div className="steps">
            {[
              { n: '01', title: 'Create an account', desc: 'Sign up with your email. No KYC, no lengthy onboarding.' },
              { n: '02', title: 'Add your Arc wallet', desc: 'Paste your Arc-compatible EVM wallet address. That\'s where USDC and EURC will land.' },
              { n: '03', title: 'Create a payment link', desc: 'Enter amount, choose USDC or EURC, get a shareable link instantly.' },
              { n: '04', title: 'Get paid instantly', desc: 'Your customer pays on Arc. Deterministic finality means confirmation in under one second.' },
            ].map((s) => (
              <div className="card step" key={s.n}>
                <div className="step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
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

        {/* ── Trust ── */}
        <section className="section">
          <div className="section-head">
            <span className="eyebrow"><Shield size={13} /> Security & trust</span>
            <h2>Built on Arc for reliability</h2>
          </div>
          <div className="trust-grid">
            {[
              { title: 'Non-custodial architecture', desc: 'Your wallet, your keys. LumiaPay only reads the Arc blockchain — it never holds or moves funds on your behalf.' },
              { title: 'Sub-second finality', desc: 'Transactions finalize in under one second with no risk of chain reorganization, making every settlement irreversible.' },
              { title: 'Stablecoin-first', desc: 'USDC and EURC are natively supported on Arc. Quote in dollars or euros, receive dollars or euros — zero price volatility.' },
              { title: 'Open & auditable', desc: 'Every payment is publicly verifiable on the Arc blockchain. Customers can confirm receipt themselves without trusting LumiaPay.' },
            ].map((t) => (
              <div className="card trust-item" key={t.title}>
                <div className="icon-tick"><Check size={16} /></div>
                <div>
                  <h4>{t.title}</h4>
                  <p>{t.desc}</p>
                </div>
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
              { q: 'Does LumiaPay hold my funds?', a: 'No. Payments settle directly from the payer\'s wallet to your Arc wallet address. LumiaPay only reads the Arc blockchain to confirm receipt — it never holds or moves your funds.' },
              { q: 'What network do you support?', a: 'Arc — a purpose-built Layer-1 blockchain for stablecoin-native finance. It offers sub-second deterministic finality, USDC as the gas token, and full EVM compatibility.' },
              { q: 'How does payment verification work?', a: 'After a customer sends funds, LumiaPay polls the Arc RPC node to detect the incoming transaction. Once detected, it verifies the amount on-chain and marks the payment as paid — typically within one second.' },
              { q: 'What currencies do you support?', a: 'USDC (USD Coin) and EURC (Euro Coin), both natively issued on Arc. USYC (yield-bearing USD) support is coming soon.' },
              { q: 'Is there a fee?', a: 'LumiaPay currently charges no platform fee. You only pay the standard Arc network transaction fee — which is denominated in USDC and is typically a fraction of a cent.' },
            ].map((item) => (
              <details className="faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA band ── */}
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="cta-band">
            <h2>Ready to accept crypto payments?</h2>
            <p>Join developers and merchants already using LumiaPay on Arc Network.</p>
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
            <Link href="/" className="brand" style={{ marginBottom: 8, display: 'inline-flex' }}>
              <Image src="/logo.png" alt="LumiaPay" width={24} height={24} className="brand-logo" />
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
              <h5>Community</h5>
              <a href="https://t.me/lumiapay" target="_blank" rel="noopener noreferrer">Telegram</a>
              <a href="https://discord.gg/SXmSd4ARgA" target="_blank" rel="noopener noreferrer">Discord</a>
              <a href="https://www.reddit.com/u/lumiapay" target="_blank" rel="noopener noreferrer">Reddit</a>
              <a href="https://medium.com/@lumiapay" target="_blank" rel="noopener noreferrer">Medium</a>
              <a href="https://x.com/lumiapay" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
