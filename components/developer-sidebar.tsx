'use client';

/**
 * Developer Dashboard Sidebar
 * 
 * ADDITIVE COMPONENT - Does not replace existing sidebar.tsx
 * 
 * This enhanced sidebar includes:
 * - All existing merchant navigation (unchanged)
 * - New Developer section below
 * 
 * Used only on developer dashboard routes (/developer/*)
 * Existing routes continue using original sidebar.tsx
 */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  BarChart2, Plus, CreditCard, Settings, LogOut,
  Code, Key, Webhook, FileText, TrendingUp, Book, TestTube2, Layers
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function DeveloperSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  // ── Merchant Navigation States (Preserved) ──
  const overviewActive = pathname === '/dashboard';
  const paymentsActive =
    pathname === '/payments' ||
    (pathname.startsWith('/pay/') && !pathname.startsWith('/payments/new'));
  const newActive = pathname === '/payments/new';
  const settingsActive = pathname === '/settings';

  // ── Developer Navigation States (New) ──
  const devOverviewActive = pathname === '/developer';
  const applicationsActive = pathname.startsWith('/developer/applications');
  const apiKeysActive = pathname.startsWith('/developer/keys');
  const webhooksActive = pathname.startsWith('/developer/webhooks');
  const logsActive = pathname.startsWith('/developer/logs');
  const analyticsActive = pathname.startsWith('/developer/analytics');
  const docsActive = pathname.startsWith('/developer/docs');
  const sandboxActive = pathname.startsWith('/developer/sandbox');

  return (
    <nav className="sidebar">
      <div className="nav-items">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MERCHANT SECTION — PRESERVED EXACTLY AS ORIGINAL               */}
        {/* ═══════════════════════════════════════════════════════════════ */}

        <Link href="/dashboard" className={`nav-link${overviewActive ? ' active' : ''}`}>
          <BarChart2 size={16} />
          Overview
        </Link>

        <Link href="/payments/new" className={`nav-link nav-new${newActive ? ' active' : ''}`}>
          <Plus size={16} />
          New payment
        </Link>

        <Link href="/payments" className={`nav-link${paymentsActive ? ' active' : ''}`}>
          <CreditCard size={16} />
          Payments
        </Link>

        <Link href="/settings" className={`nav-link${settingsActive ? ' active' : ''}`}>
          <Settings size={16} />
          Settings
        </Link>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* DEVELOPER SECTION — NEW ADDITION                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}

        {/* Section Divider */}
        <div className="nav-divider">
          <span className="nav-divider-text">Developer</span>
        </div>

        <Link 
          href="/developer" 
          className={`nav-link${devOverviewActive ? ' active' : ''}`}
        >
          <Code size={16} />
          Developer Overview
        </Link>

        <Link 
          href="/developer/applications" 
          className={`nav-link${applicationsActive ? ' active' : ''}`}
        >
          <Layers size={16} />
          Applications
        </Link>

        <Link 
          href="/developer/keys" 
          className={`nav-link${apiKeysActive ? ' active' : ''}`}
        >
          <Key size={16} />
          API Keys
        </Link>

        <Link 
          href="/developer/webhooks" 
          className={`nav-link${webhooksActive ? ' active' : ''}`}
        >
          <Webhook size={16} />
          Webhooks
        </Link>

        <Link 
          href="/developer/logs" 
          className={`nav-link${logsActive ? ' active' : ''}`}
        >
          <FileText size={16} />
          API Logs
        </Link>

        <Link 
          href="/developer/analytics" 
          className={`nav-link${analyticsActive ? ' active' : ''}`}
        >
          <TrendingUp size={16} />
          Usage & Analytics
        </Link>

        <Link 
          href="/developer/docs" 
          className={`nav-link${docsActive ? ' active' : ''}`}
        >
          <Book size={16} />
          API Documentation
        </Link>

        <Link 
          href="/developer/sandbox" 
          className={`nav-link${sandboxActive ? ' active' : ''}`}
        >
          <TestTube2 size={16} />
          Sandbox
        </Link>

      </div>

      {/* Sign out — preserved exactly */}
      <div className="nav-bottom">
        <button className="nav-signout" onClick={handleSignOut} type="button">
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      <style jsx>{`
        .nav-divider {
          margin: 1.5rem 0 0.75rem;
          padding: 0 0.75rem;
        }

        .nav-divider-text {
          display: block;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
        }
      `}</style>
    </nav>
  );
}
