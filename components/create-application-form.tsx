'use client';

/**
 * Create Application Form Component
 * 
 * Allows merchants to create new developer applications.
 * Displays generated API keys only once.
 */

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Copy, Eye, EyeOff, Sparkles, Key } from 'lucide-react';

export default function CreateApplicationForm() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [environment, setEnvironment] = useState<'test' | 'live'>('test');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<any>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<'publishable' | 'secret' | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const res = await fetch('/api/developer/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, environment }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create application');
      }

      setSuccess(data);
      setName('');
      setDescription('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, type: 'publishable' | 'secret') {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  if (success) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Success Message */}
        <div style={{
          background: 'linear-gradient(135deg, #dff8e9 0%, #e8fdf0 100%)',
          border: '1.5px solid #9ae6b4',
          borderRadius: '14px',
          padding: '18px',
          display: 'flex',
          gap: '14px',
          alignItems: 'flex-start'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '11px',
            background: '#48bb78',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}>
            <CheckCircle size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
              Application Created Successfully!
            </div>
            <div style={{ fontSize: '13px', color: '#2f5233', lineHeight: '1.5' }}>
              Your application "{success.application.name}" has been created with new API keys.
            </div>
          </div>
        </div>

        {/* Warning about keys */}
        <div style={{
          background: 'linear-gradient(135deg, #fff9e6 0%, #fff3cd 100%)',
          border: '1.5px solid #f2d888',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={18} style={{ color: '#896617', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', color: '#6b5417', lineHeight: '1.5' }}>
            <strong style={{ fontWeight: 800 }}>Save your secret key now!</strong> For security reasons, you won't be able to 
            view it again. Store it in a secure location.
          </div>
        </div>

        {/* Publishable Key */}
        <div>
          <label style={{ 
            display: 'block',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '8px',
            color: 'var(--ink)'
          }}>
            <Key size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Publishable Key (Client-Side)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={success.keys.publishable}
              readOnly
              style={{
                flex: 1,
                border: '1px solid var(--line)',
                background: '#f8f9fa',
                borderRadius: '11px',
                padding: '12px 13px',
                fontFamily: 'DM Mono',
                fontSize: '12px',
                color: 'var(--ink)'
              }}
            />
            <button
              onClick={() => copyToClipboard(success.keys.publishable, 'publishable')}
              style={{
                border: '1px solid var(--line)',
                background: 'white',
                borderRadius: '11px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 700,
                transition: 'all 0.15s'
              }}
              title="Copy to clipboard"
            >
              {copiedKey === 'publishable' ? (
                <>
                  <CheckCircle size={16} style={{ color: '#48bb78' }} />
                  <span style={{ color: '#48bb78' }}>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>
            Safe to use in client-side code and public repositories
          </p>
        </div>

        {/* Secret Key */}
        <div>
          <label style={{ 
            display: 'block',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '8px',
            color: 'var(--ink)'
          }}>
            <Key size={14} style={{ display: 'inline', marginRight: '6px' }} />
            Secret Key (Server-Side Only)
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type={showSecretKey ? 'text' : 'password'}
              value={success.keys.secret}
              readOnly
              style={{
                flex: 1,
                border: '1px solid var(--line)',
                background: '#f8f9fa',
                borderRadius: '11px',
                padding: '12px 13px',
                fontFamily: 'DM Mono',
                fontSize: '12px',
                color: 'var(--ink)'
              }}
            />
            <button
              onClick={() => setShowSecretKey(!showSecretKey)}
              style={{
                border: '1px solid var(--line)',
                background: 'white',
                borderRadius: '11px',
                padding: '12px 14px',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center'
              }}
              title={showSecretKey ? 'Hide' : 'Show'}
            >
              {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button
              onClick={() => copyToClipboard(success.keys.secret, 'secret')}
              style={{
                border: '1px solid var(--line)',
                background: 'white',
                borderRadius: '11px',
                padding: '12px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 700,
                transition: 'all 0.15s'
              }}
              title="Copy to clipboard"
            >
              {copiedKey === 'secret' ? (
                <>
                  <CheckCircle size={16} style={{ color: '#48bb78' }} />
                  <span style={{ color: '#48bb78' }}>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  Copy
                </>
              )}
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#c33d50', marginTop: '6px', fontWeight: 600 }}>
            ⚠️ Keep this secret! Never commit to git or expose in client-side code
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <a
            href={`/developer/applications/${success.application.id}`}
            className="button lime"
          >
            View Application
          </a>
          <button
            onClick={() => {
              setSuccess(null);
              setName('');
              setDescription('');
            }}
            className="button secondary"
          >
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #ffe7e8 0%, #ffeff0 100%)',
          border: '1.5px solid #ff9ca3',
          borderRadius: '14px',
          padding: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <AlertCircle size={18} style={{ color: '#c33d50', marginTop: '2px', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#8a2b37', fontWeight: 600 }}>{error}</span>
        </div>
      )}

      {/* Application Name */}
      <div className="field">
        <label htmlFor="name">
          Application Name *
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My E-commerce Store"
          required
          minLength={3}
          maxLength={100}
          disabled={loading}
        />
        <p className="hint">
          A descriptive name for your application (3-100 characters)
        </p>
      </div>

      {/* Description */}
      <div className="field">
        <label htmlFor="description">
          Description (Optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Production API integration for online store"
          maxLength={500}
          rows={3}
          style={{
            border: '1px solid var(--line)',
            background: 'white',
            borderRadius: '11px',
            padding: '12px 13px',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'var(--ink)',
            outline: 'none',
            resize: 'vertical'
          }}
          disabled={loading}
        />
        <p className="hint">
          Optional description to help you identify this application
        </p>
      </div>

      {/* Environment */}
      <div>
        <label style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 800,
          marginBottom: '10px'
        }}>
          Environment *
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            border: environment === 'test' ? '2px solid var(--lime)' : '1px solid var(--line)',
            borderRadius: '12px',
            background: environment === 'test' ? '#faffec' : 'white',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}>
            <input
              type="radio"
              name="environment"
              value="test"
              checked={environment === 'test'}
              onChange={(e) => setEnvironment('test')}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>
                Test <span style={{
                  display: 'inline-block',
                  background: '#fff3cd',
                  color: '#896617',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  marginLeft: '6px'
                }}>RECOMMENDED</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Simulated payments, no blockchain transactions required
              </div>
            </div>
          </label>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px',
            border: environment === 'live' ? '2px solid var(--lime)' : '1px solid var(--line)',
            borderRadius: '12px',
            background: environment === 'live' ? '#faffec' : 'white',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}>
            <input
              type="radio"
              name="environment"
              value="live"
              checked={environment === 'live'}
              onChange={(e) => setEnvironment('live')}
              disabled={loading}
              style={{ cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '3px' }}>
                Live <span style={{
                  display: 'inline-block',
                  background: '#dff8e9',
                  color: '#197946',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  marginLeft: '6px'
                }}>PRODUCTION</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                Real Arc Network transactions with USDC/EURC
              </div>
            </div>
          </label>
        </div>
        <p className="hint" style={{ marginTop: '10px' }}>
          {environment === 'test' 
            ? '💡 Test mode allows you to simulate payments without real blockchain transactions.'
            : '⚡ Live mode processes real USDC/EURC payments on the Arc Network.'
          }
        </p>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="button lime"
          style={{
            opacity: (loading || !name.trim()) ? 0.5 : 1,
            cursor: (loading || !name.trim()) ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
              Creating...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Create Application
            </>
          )}
        </button>

        {(name || description) && !loading && (
          <button
            type="button"
            onClick={() => {
              setName('');
              setDescription('');
              setEnvironment('test');
            }}
            className="button secondary"
          >
            Reset
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </form>
  );
}
