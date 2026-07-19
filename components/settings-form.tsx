'use client';

import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';

interface MerchantProfile {
  business_name: string;
  wallet_address: string;
}

export default function SettingsForm() {
  const [businessName, setBusinessName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Load existing profile on mount.
  useEffect(() => {
    fetch('/api/merchant')
      .then((r) => r.json())
      .then((data: MerchantProfile | null) => {
        if (data) {
          setBusinessName(data.business_name ?? '');
          setWalletAddress(data.wallet_address ?? '');
        }
      })
      .catch(() => {/* silently ignore fetch errors on load */})
      .finally(() => setFetching(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setLoading(true);

    try {
      const res = await fetch('/api/merchant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          wallet_address: walletAddress,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to save settings.');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return (
      <div className="card settings-card" style={{ color: 'var(--muted)', fontSize: 14 }}>
        Loading profile…
      </div>
    );
  }

  return (
    <form className="card settings-card" onSubmit={handleSubmit}>
      {error && <div className="alert">{error}</div>}
      {saved && (
        <div className="alert success" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle size={15} />
          Settings saved successfully.
        </div>
      )}

      <div className="field">
        <label htmlFor="business_name">Business name</label>
        <input
          id="business_name"
          type="text"
          required
          maxLength={120}
          placeholder="Acme Store"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
        />
        <span className="hint">Displayed on the checkout page so customers know who they're paying.</span>
      </div>

      <div className="field">
        <label htmlFor="wallet_address">Arc wallet address</label>
        <input
          id="wallet_address"
          type="text"
          required
          pattern="^0x[0-9a-fA-F]{40}$"
          placeholder="0x…"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          style={{ fontFamily: 'DM Mono, monospace', fontSize: 13 }}
        />
        <span className="hint">
          All payments go directly to this address on Arc Testnet. Make sure it
          is an Arc-compatible EVM address you control. Double-check carefully —
          funds sent to a wrong address cannot be recovered.
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="submit"
          className="button"
          disabled={loading}
          style={{ minWidth: 140 }}
        >
          {loading ? (
            'Saving…'
          ) : (
            <>
              <Save size={14} />
              Save settings
            </>
          )}
        </button>

        {walletAddress && (
          <span className="wallet-chip">
            <span className="dot" />
            <b>
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </b>
          </span>
        )}
      </div>
    </form>
  );
}
