import { requireUser } from '@/components/require-user';
import AppShell from '@/components/app-shell';
import NewPaymentForm from '@/components/new-payment-form';
import { Plus } from 'lucide-react';

export const metadata = { title: 'New payment — LumiaPay' };

export default async function NewPaymentPage() {
  const user = await requireUser();

  return (
    <AppShell email={user.email}>
      <div>
        <span className="eyebrow">
          <Plus size={13} /> New payment
        </span>
        <h1 className="heading">Create payment link</h1>
        <p className="subheading">
          Generate a link you can share with your customer. The link expires in 15 minutes.
        </p>
      </div>

      <NewPaymentForm />
    </AppShell>
  );
}
