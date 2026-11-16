'use client';

/**
 * Developer Dashboard App Shell
 * 
 * ADDITIVE COMPONENT - Does not replace existing app-shell.tsx
 * 
 * Wrapper component for developer dashboard pages.
 * Uses DeveloperSidebar instead of original Sidebar.
 * 
 * Usage: Import this in developer/* pages instead of AppShell
 */

import DeveloperSidebar from './developer-sidebar';

interface DeveloperAppShellProps {
  email: string | undefined;
  children: React.ReactNode;
}

export default function DeveloperAppShell({ email, children }: DeveloperAppShellProps) {
  return (
    <div className="app-shell">
      <DeveloperSidebar />

      <main className="app-main">
        <div className="app-header">
          <div className="logo-container">
            <img src="/logo.svg" alt="LumiaPay" className="logo" />
          </div>
          <div className="app-user">
            <div className="user-email">{email ?? 'User'}</div>
            <div className="user-badge">Developer</div>
          </div>
        </div>

        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  );
}
