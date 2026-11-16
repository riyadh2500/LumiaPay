'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface ApiKeyItemProps {
  apiKey: any
}

export default function ApiKeyItem({ apiKey }: ApiKeyItemProps) {
  const [copied, setCopied] = useState(false)

  // Database only stores key_prefix for security
  // Full key is shown only once during creation
  const displayKey = apiKey.key_prefix || 'Key not available'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: '16px',
        marginBottom: '16px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center',
          gap: '10px'
        }}>
          <h3 style={{ 
            fontSize: '15px', 
            fontWeight: 800,
            margin: 0
          }}>
            {apiKey.name || 'Default Key'}
          </h3>
          <span className={`badge ${apiKey.revoked_at ? 'error' : 'success'}`}>
            {apiKey.revoked_at ? 'Revoked' : 'Active'}
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontFamily: 'DM Mono',
              fontSize: '13px',
              color: 'var(--text)',
              padding: '12px 14px',
              background: 'var(--paper)',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              overflowX: 'auto',
              wordBreak: 'break-all',
              userSelect: 'text',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>{displayKey}</span>
              <span style={{ color: 'var(--muted)', fontWeight: 'normal' }}>••••••••••••••••</span>
            </div>
            <p style={{ 
              fontSize: '11px', 
              color: 'var(--muted)', 
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Full key was shown once during creation for security
            </p>
          </div>

          <button 
            className="button secondary"
            style={{ fontSize: '13px', padding: '10px 14px', flexShrink: 0 }}
            title="Copy key prefix"
            onClick={handleCopy}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--line)'
      }}>
        <div>
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--muted)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            fontWeight: 700
          }}>
            Environment
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            {apiKey.environment === 'live' ? '🚀 Live' : '🧪 Test'}
          </div>
        </div>

        <div>
          <div style={{ 
            fontSize: '11px', 
            color: 'var(--muted)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            fontWeight: 700
          }}>
            Created
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            {new Date(apiKey.created_at).toLocaleDateString()}
          </div>
        </div>

        {apiKey.last_used_at && (
          <div>
            <div style={{ 
              fontSize: '11px', 
              color: 'var(--muted)',
              marginBottom: '4px',
              textTransform: 'uppercase',
              fontWeight: 700
            }}>
              Last Used
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>
              {new Date(apiKey.last_used_at).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
