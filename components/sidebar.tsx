'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Plus, CreditCard, Settings, LogOut, Code2, Key, Webhook, FileText, TrendingUp, BookOpen, TestTube } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const overviewActive = pathname === '/dashboard';
  const paymentsActive =
    pathname === '/payments' ||
    (pathname.startsWith('/pay/') && !pathname.startsWith('/payments/new'));
  const newActive = pathname === '/payments/new';
  const settingsActive = pathname === '/settings';
  
  // Developer section active states
  const developerActive = pathname.startsWith('/developer');
  const devOverviewActive = pathname === '/developer';
  const applicationsActive = pathname === '/developer/applications';
  const apiKeysActive = pathname === '/developer/keys';
  const webhooksActive = pathname === '/developer/webhooks';
  const logsActive = pathname === '/developer/logs';
  const analyticsActive = pathname === '/developer/analytics';
  const docsActive = pathname === '/developer/docs';
  const sandboxActive = pathname === '/developer/sandbox';

  return (
    <nav className="sidebar">
      <div className="nav-items">

        {/* 1 — Overview */}
        <Link href="/dashboard" className={`nav-link${overviewActive ? ' active' : ''}`}>
          <BarChart2 size={16} />
          Overview
        </Link>

        {/* 2 — New payment (always lime) */}
        <Link href="/payments/new" className={`nav-link nav-new${newActive ? ' active' : ''}`}>
          <Plus size={16} />
          New payment
        </Link>

        {/* 3 — Payments */}
        <Link href="/payments" className={`nav-link${paymentsActive ? ' active' : ''}`}>
          <CreditCard size={16} />
          Payments
        </Link>

        {/* 4 — Settings */}
        <Link href="/settings" className={`nav-link${settingsActive ? ' active' : ''}`}>
          <Settings size={16} />
          Settings
        </Link>

        {/* Developer Section */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ 
            padding: '0 16px 8px', 
            fontSize: '11px', 
            fontWeight: 600, 
            color: 'var(--muted)', 
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Developer
          </div>

          {/* Developer Overview */}
          <Link href="/developer" className={`nav-link${devOverviewActive ? ' active' : ''}`}>
            <Code2 size={16} />
            Developer Overview
          </Link>

          {/* Applications */}
          <Link href="/developer/applications" className={`nav-link${applicationsActive ? ' active' : ''}`}>
            <BarChart2 size={16} />
            Applications
          </Link>

          {/* API Keys */}
          <Link href="/developer/keys" className={`nav-link${apiKeysActive ? ' active' : ''}`}>
            <Key size={16} />
            API Keys
          </Link>

          {/* Webhooks */}
          <Link href="/developer/webhooks" className={`nav-link${webhooksActive ? ' active' : ''}`}>
            <Webhook size={16} />
            Webhooks
          </Link>

          {/* API Logs */}
          <Link href="/developer/logs" className={`nav-link${logsActive ? ' active' : ''}`}>
            <FileText size={16} />
            API Logs
          </Link>

          {/* Usage & Analytics */}
          <Link href="/developer/analytics" className={`nav-link${analyticsActive ? ' active' : ''}`}>
            <TrendingUp size={16} />
            Usage & Analytics
          </Link>

          {/* API Documentation */}
          <Link href="/developer/docs" className={`nav-link${docsActive ? ' active' : ''}`}>
            <BookOpen size={16} />
            API Documentation
          </Link>

          {/* Sandbox */}
          <Link href="/developer/sandbox" className={`nav-link${sandboxActive ? ' active' : ''}`}>
            <TestTube size={16} />
            Sandbox
          </Link>
        </div>

      </div>

      {/* Sign out — outlined, bottom */}
      <div className="nav-bottom">
        <button className="nav-signout" onClick={handleSignOut} type="button">
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </nav>
  );
}
