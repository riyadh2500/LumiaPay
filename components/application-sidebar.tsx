'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Layers, Key, Webhook, Settings, BarChart3, ArrowLeft, BookOpen 
} from 'lucide-react';

interface ApplicationSidebarProps {
  applicationId: string;
  applicationName: string;
}

export default function ApplicationSidebar({ 
  applicationId, 
  applicationName 
}: ApplicationSidebarProps) {
  const pathname = usePathname();

  const links = [
    {
      href: `/developer/applications/${applicationId}`,
      label: 'Overview',
      icon: Layers,
    },
    {
      href: `/developer/applications/${applicationId}/keys`,
      label: 'API Keys',
      icon: Key,
    },
    {
      href: `/developer/applications/${applicationId}/webhooks`,
      label: 'Webhooks',
      icon: Webhook,
    },
    {
      href: `/developer/applications/${applicationId}/analytics`,
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      href: `/developer/applications/${applicationId}/settings`,
      label: 'Settings',
      icon: Settings,
    },
  ];

  return (
    <div className="sidebar">
      {/* Back to Applications */}
      <Link 
        href="/developer/applications"
        className="back-link"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          fontSize: '13px',
          color: 'var(--muted)',
          textDecoration: 'none',
          borderBottom: '1px solid var(--line)',
          marginBottom: '16px'
        }}
      >
        <ArrowLeft size={14} />
        Back to Applications
      </Link>

      {/* Application Name */}
      <div style={{
        padding: '0 16px 16px',
        borderBottom: '1px solid var(--line)',
        marginBottom: '16px'
      }}>
        <div style={{
          fontSize: '11px',
          color: 'var(--muted)',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 700
        }}>
          Application
        </div>
        <div style={{
          fontSize: '15px',
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '-0.3px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {applicationName}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Documentation Link */}
      <div style={{ 
        padding: '16px',
        borderTop: '1px solid var(--line)',
        marginTop: 'auto'
      }}>
        <Link
          href="/developer/docs"
          className="sidebar-link"
          style={{ fontSize: '13px' }}
        >
          <BookOpen size={14} />
          API Documentation
        </Link>
      </div>
    </div>
  );
}
