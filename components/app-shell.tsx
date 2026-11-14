import Link from 'next/link';
import Image from 'next/image';
import Sidebar from './sidebar';

interface AppShellProps {
  children: React.ReactNode;
  /** Email of the logged-in user, shown in the topbar */
  email?: string;
}

function initials(email = '') {
  return email.slice(0, 2).toUpperCase() || 'ME';
}

export default function AppShell({ children, email }: AppShellProps) {
  return (
    <div className="shell">
      {/* ── Top bar ── */}
      <header className="topbar">
        <Link href="/dashboard" className="brand">
          <Image
            src="/logo.png"
            alt="LumiaPay"
            width={32}
            height={32}
            className="brand-logo"
          />
          LumiaPay
        </Link>

        <div className="profile">
          <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 13 }}>
            {email}
          </span>
          <span className="avatar" aria-hidden="true">
            {initials(email)}
          </span>
        </div>
      </header>

      {/* ── Main grid ── */}
      <div className="app-grid">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
