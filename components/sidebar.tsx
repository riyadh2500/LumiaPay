'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Plus, CreditCard, Settings, LogOut } from 'lucide-react';
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
