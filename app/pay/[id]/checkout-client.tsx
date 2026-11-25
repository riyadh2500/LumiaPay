'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { buildPaymentUri } from '@/lib/payment-uri';
import { TokenSymbol } from '@/lib/tokens';
import { CheckCircle, Clock, XCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { CHAINS, type ChainId } from '@/lib/chains/config';

interface Payment {
  id: string;
  label: string;
  amount: string;
  currency: string;
  wallet_address: string;
  status: string;
  expires_at: string;
  tx_hash?: string;
  metadata?: {
    multi_chain?: boolean;
    supported_chains?: string[];
  };
}

interface CheckoutClientProps {
  payment: Payment;
  merchantName: string;
}

const POLL_INTERVAL_MS = 5000;

function useCountdown(expiresAt: string) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    function calc() {
      const normalised = expiresAt.includes('+') || expiresAt.endsWith('Z')
        ? expiresAt
        : expiresAt + 'Z';
      const diff = Math.max(0, Math.floor((new Date(normalised).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    }
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (secondsLeft === null) return { secondsLeft: null, formatted: '…' };
  const hh = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  const formatted = secondsLeft >= 3600 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
  return { secondsLeft, formatted };
}

export default function CheckoutClient({ payment: initial, merchantName }: CheckoutClientProps) {
  const [status, setStatus] = useState(initial.status);
  const [txHash, setTxHash] = useState(initial.tx_hash ?? '');
  const [copied, setCopied] = useState(false);
  const [amountCopied, setAmountCopied] = useState(false);
  const { secondsLeft, formatted: countdown } = useCountdown(initial.expires_at);

  // Multi-chain support
  const isMultiChain = initial.metadata?.multi_chain === true;
  const supportedChainIds = (initial.metadata?.supported_chains ?? ['arc-testnet']) as ChainId[];
  const [selectedChain, setSelectedChain] = useState<ChainId>(supportedChainIds[0] || 'arc-testnet');
  const currentChain = CHAINS[selectedChain] || CHAINS['arc-testnet'];

  const isPending = status === 'pending' || status === 'detecting';

  const uri = buildPaymentUri({
    symbol: initial.currency as TokenSymbol,
    recipientAddress: initial.wallet_address,
    amount: initial.amount,
  });

  const poll = useCallback(async () => {
    if (status !== 'pending' && status !== 'detecting') return;
    try {
      const res = await fetch(`/api/payments/${initial.id}?action=verify`, { method: 'POST' });
      const data = await res.json();
      if (data.status && data.status !== 'pending' && data.status !== 'detecting') {
        setStatus(data.status);
        if (data.txHash) setTxHash(data.txHash);
      }
    } catch {
      // ignore
    }
  }, [status, initial.id]);

  useEffect(() => {
    if (!isPending) return;
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isPending, poll]);

  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft > 0) hasStartedRef.current = true;
    if (hasStartedRef.current && secondsLeft === 0 && status === 'pending') {
      setStatus('expired');
    }
  }, [secondsLeft, status]);

  function copyAddress() {
    navigator.clipboard.writeText(initial.wallet_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyAmount() {
    navigator.clipboard.writeText(initial.amount);
    setAmountCopied(true);
    setTimeout(() => setAmountCopied(false), 2000);
  }

  const initials = merchantName.slice(0, 2).toUpperCase();

  return (
    <div className="checkout">
      {/* Merchant chip */}
      <div className="merchant-chip">
        <span className="merchant-avatar">{initials}</span>
        {merchantName}
      </div>

      {/* ── Paid result ── */}
      {status === 'paid' && (
        <div className="card pay-card" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="result-icon success">
            <CheckCircle size={28} />
          </div>
          <h2 className="heading" style={{ fontSize: 22, margin: '16px 0 6px' }}>Payment confirmed</h2>
          <p className="subheading">{initial.label}</p>
          {txHash && (
            <a
              href={`${currentChain.explorerTxUrl}${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary"
              style={{ marginTop: 20, fontSize: 12 }}
            >
              View on {currentChain.name} <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* ── Expired/Failed result ── */}
      {(status === 'expired' || status === 'failed') && (
        <div className="card pay-card" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="result-icon expired">
            <Clock size={28} />
          </div>
          <h2 className="heading" style={{ fontSize: 22, margin: '16px 0 6px' }}>
            {status === 'expired' ? 'Payment expired' : 'Payment cancelled'}
          </h2>
          <p className="subheading">This payment link is no longer active.</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
            Ask the merchant to generate a new payment link.
          </p>
        </div>
      )}

      {/* ── Pending checkout ── */}
      {isPending && (
        <>
          <div className="card pay-card">
            {/* Amount header */}
            <div className="pay-card-top">
              <p className="pay-amount">
                {initial.amount} <span style={{ fontSize: 22 }}>{initial.currency}</span>
              </p>
              <p className="pay-item">{initial.label}</p>
            </div>

            {/* Multi-chain selector */}
            {isMultiChain && supportedChainIds.length > 1 && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
                  Select Network
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px' }}>
                  {supportedChainIds.map((chainId) => {
                    const chain = CHAINS[chainId];
                    if (!chain) return null;
                    return (
                      <button
                        key={chainId}
                        onClick={() => setSelectedChain(chainId)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 10px', borderRadius: '10px',
                          border: selectedChain === chainId ? `2px solid ${chain.color}` : '1.5px solid var(--line)',
                          background: selectedChain === chainId ? chain.color + '15' : 'var(--surface)',
                          cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{chain.logo}</span>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700 }}>{chain.shortName}</div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)' }}>Testnet</div>
                        </div>
                        {selectedChain === chainId && (
                          <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: chain.color }} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: currentChain.color, fontSize: '14px' }}>{currentChain.logo}</span>
                  Paying on <strong style={{ color: 'var(--ink)' }}>{currentChain.name}</strong>
                  <span style={{ marginLeft: 'auto' }}>
                    Chain ID: {currentChain.chainId}
                  </span>
                </div>
              </div>
            )}

            {/* QR code */}
            <div className="qr-section">
              <div className="qr-wrap">
                <QRCodeSVG value={uri} size={200} />
              </div>
              <div className="pulse">
                <i />
                Waiting for payment
              </div>
              <p className="countdown">
                Expires in <b>{countdown}</b>
              </p>
            </div>

            {/* Exact amount copy */}
            <button className="exact-amount-box" onClick={copyAmount} type="button">
              <span>Exact amount to send</span>
              <b>
                {initial.amount} {initial.currency}
                {amountCopied && <span className="copied-badge">Copied!</span>}
              </b>
            </button>

            {/* Wallet address copy */}
            <button className="exact-amount-box" onClick={copyAddress} type="button">
              <span>Send to address</span>
              <b>
                {initial.wallet_address}
                {copied && <span className="copied-badge">Copied!</span>}
              </b>
            </button>

            {/* Network detail */}
            <div className="details">
              <div>
                <span>Network</span>
                <b style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{currentChain.logo}</span> {currentChain.name}
                </b>
              </div>
              <div>
                <span>Token</span>
                <b>{initial.currency}</b>
              </div>
              <div>
                <span>Payment ID</span>
                <b style={{ fontFamily: 'DM Mono', fontWeight: 400, fontSize: 11 }}>
                  {initial.id.slice(0, 12)}…
                </b>
              </div>
            </div>

            {/* How to pay */}
            <div className="how-to-pay">
              <h5>How to pay</h5>
              <ol>
                <li>
                  <span>1</span>
                  Open your wallet (MetaMask, Rabby, Rainbow, etc.)
                </li>
                <li>
                  <span>2</span>
                  {isMultiChain
                    ? `Switch to ${currentChain.name} (Chain ID: ${currentChain.chainId})`
                    : 'Make sure you are on Arc Testnet (Chain ID 5042002)'}
                </li>
                <li>
                  <span>3</span>
                  Scan the QR code or paste the wallet address above.
                </li>
                <li>
                  <span>4</span>
                  Send exactly <strong>{initial.amount} {initial.currency}</strong>.
                </li>
                <li>
                  <span>5</span>
                  This page updates automatically once the transaction confirms.
                </li>
              </ol>
            </div>
          </div>

          <p className="checkout-footer-note">
            <RefreshCw size={12} />
            Checking for payment every 5 seconds
          </p>
        </>
      )}

      {/* Back link */}
      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--muted)' }}>
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
