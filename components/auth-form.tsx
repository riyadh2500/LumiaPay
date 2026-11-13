'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Check } from 'lucide-react';

type Mode = 'login' | 'signup';

interface AuthFormProps {
  mode: Mode;
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const supabase = createClient();

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess('Check your email for a confirmation link.');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    }

    setLoading(false);
  }

  const isLogin = mode === 'login';

  return (
    <div className="auth-page">
      {/* ── Left decorative panel ── */}
      <div className="auth-side">
        <div className="auth-side-content">
          <Link href="/" className="brand" style={{ color: 'white', marginBottom: 48, display: 'flex' }}>
            <span className="brand-mark">L</span>
            LumiaPay
          </Link>

          <blockquote className="auth-quote">
            "Arc's sub-second finality and USDC-native settlement completely
            changed how we handle merchant payouts — it's instant and predictable."
          </blockquote>
          <div className="auth-quote-meta">
            <span
              className="avatar"
              style={{ background: 'rgba(200,255,112,0.2)', color: '#c8ff70', fontFamily: 'DM Mono' }}
              aria-hidden="true"
            >
              SR
            </span>
            <div>
              <b>Sofia Reyes</b>
              <span>CTO, ArcPay Commerce</span>
            </div>
          </div>

          <div className="auth-stats">
            <div>
              <b>$5.8M+</b>
              <span>Settled on Arc</span>
            </div>
            <div>
              <b>3,400+</b>
              <span>Active merchants</span>
            </div>
            <div>
              <b>&lt;1 s</b>
              <span>Avg finality</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="auth-form-side">
        <div className="auth-form-wrap">
          <Link href="/" className="auth-back">
            <ArrowLeft size={14} />
            Back to home
          </Link>

          <h1 className="heading" style={{ fontSize: 26 }}>
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="subheading" style={{ marginBottom: 28 }}>
            {isLogin
              ? 'Sign in to your LumiaPay dashboard.'
              : 'Start accepting USDC & EURC payments on Arc.'}
          </p>

          {error && <div className="alert">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          {!success && (
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isLogin ? '••••••••' : 'Min 8 characters'}
                />
              </div>

              <button
                type="submit"
                className="button"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              >
                {loading
                  ? 'Please wait…'
                  : isLogin
                  ? 'Sign in'
                  : 'Create account'}
              </button>
            </form>
          )}

          <div className="divider">or</div>

          <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Link
              href={isLogin ? '/signup' : '/login'}
              style={{ color: 'var(--ink)', fontWeight: 700 }}
            >
              {isLogin ? 'Sign up free' : 'Sign in'}
            </Link>
          </p>

          {!isLogin && (
            <ul className="auth-benefits">
              {[
                'No setup fees or monthly charges',
                'USDC & EURC natively on Arc Network',
                'Sub-second deterministic settlement',
              ].map((b) => (
                <li key={b}>
                  <Check size={15} />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
