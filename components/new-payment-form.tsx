'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TOKEN_LIST } from '@/lib/tokens';
import { Plus } from 'lucide-react';

export default function NewPaymentForm() {
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USDC');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, amount, currency }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.');
        setLoading(false);
        return;
      }

      // Navigate to the payment detail / checkout preview page.
      router.push(`/pay/${data.id}`);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      {error && <div className="alert">{error}</div>}

      <div className="field-grid">
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="label">Payment label</label>
          <input
            id="label"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Invoice #1042 or Order #8821"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <span className="hint">Shown to your customer on the checkout page.</span>
        </div>

        <div className="field">
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            type="text"
            inputMode="decimal"
            required
            pattern="^\d+(\.\d+)?$"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="currency">Token</label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {TOKEN_LIST.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol} — {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hint" style={{ marginBottom: 20 }}>
        Payment links expire after <strong>15 minutes</strong>. The exact token
        amount is locked in at creation time.
      </div>

      <button
        type="submit"
        className="button lime"
        disabled={loading}
        style={{ minWidth: 180 }}
      >
        {loading ? (
          'Creating…'
        ) : (
          <>
            <Plus size={15} />
            Create payment link
          </>
        )}
      </button>
    </form>
  );
}
