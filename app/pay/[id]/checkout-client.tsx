'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { buildPaymentUri } from '@/lib/payment-uri';
import { TokenSymbol } from '@/lib/tokens';
import { CheckCircle, Clock, XCircle, Copy, ExternalLink, RefreshCw } from 'lucide-react';

interface Payment {
  id: string;
  label: string;
  amount: string;
  currency: string;
  wallet_address: string;
  status: string;
  expires_at: string;
  tx_hash?: string;
}

interface CheckoutClientProps {
  payment: Payment;
  merchantName: string;
}

const POLL_INTERVAL_MS = 5000;

function useCountdown(expiresAt: string) {
  // Start with null so server and client render the same thing initially.
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

  // Show pending UI whenever status is pending — don't gate on secondsLeft
  // since secondsLeft can briefly be stale on first render.
  const isPending = status === 'pending';

  const uri = buildPaymentUri({
    symbol: initial.currency as TokenSymbol,
    recipientAddress: initial.wallet_address,
    amount: initial.amount,
  });

  // Poll the verify endpoint while the payment is pending.
  const poll = useCallback(async () => {
    if (status !== 'pending') return;
    try {
      const res = await fetch(`/api/payments/${initial.id}?action=verify`, { method: 'POST' });
      const data = await res.json();
      if (data.status && data.status !== 'pending') {
        setStatus(data.status);
        if (data.txHash) setTxHash(data.txHash);
      }
    } catch {
      // ignore network errors during polling
    }
  }, [status, initial.id]);

  useEffect(() => {
    if (!isPending) return;
    const t = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [isPending, poll]);

  // Expire locally only when countdown ticks down to zero (not on first render).
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
              href={`https://testnet.arcscan.app/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary"
              style={{ marginTop: 20, fontSize: 12 }}
            >
              View on ArcScan <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* ── Expired result ── */}
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
                <b>Arc Testnet</b>
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
                  Open your Arc-compatible wallet (MetaMask, Rabby, Rainbow, etc.)
                </li>
                <li>
                  <span>2</span>
                  Scan the QR code or paste the wallet address above.
                </li>
                <li>
                  <span>3</span>
                  Send exactly <strong>{initial.amount} {initial.currency}</strong> on Arc Testnet (Chain ID 5042002).
                </li>
                <li>
                  <span>4</span>
                  This page updates automatically once the transaction confirms (Arc finalizes in under 1 second).
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

      {/* Back link for merchant */}
      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <Link href="/dashboard" style={{ fontSize: 12, color: 'var(--muted)' }}>
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
