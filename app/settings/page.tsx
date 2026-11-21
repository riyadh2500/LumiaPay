import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import SettingsForm from '@/components/settings-form';
import DeveloperModeToggle from '@/components/developer-mode-toggle';
import { Settings, Code2 } from 'lucide-react';

export const metadata = { title: 'Settings — LumiaPay' };

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <Settings size={13} /> Settings
        </span>
        <h1 className="heading">Account settings</h1>
        <p className="subheading">
          Configure your business name and the Arc wallet address where payments are received.
        </p>
      </div>

      <SettingsForm />

      {/* Developer Mode Section */}
      <div style={{ marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Code2 size={13} color="var(--muted)" />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Developer
          </span>
        </div>
        <DeveloperModeToggle />
      </div>
    </AppShell>
  );
}
