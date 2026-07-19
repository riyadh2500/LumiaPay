import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import SettingsForm from '@/components/settings-form';
import { Settings } from 'lucide-react';

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
    </AppShell>
  );
}
