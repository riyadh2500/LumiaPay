'use client'

import { useState, useEffect } from 'react'
import { Code2 } from 'lucide-react'

export default function DeveloperModeToggle() {
  const [enabled, setEnabled] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('developer_mode')
    setEnabled(saved === 'true')
  }, [])

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    localStorage.setItem('developer_mode', String(next))
    // Dispatch event so Sidebar updates immediately
    window.dispatchEvent(new Event('developer_mode_change'))
  }

  if (!mounted) return null

  return (
    <div className="card" style={{ padding: '20px 24px', marginTop: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: enabled ? 'var(--lime)' : 'var(--paper)',
            border: '1px solid var(--line)',
            display: 'grid', placeItems: 'center',
            transition: 'all 0.2s ease',
          }}>
            <Code2 size={18} color={enabled ? 'var(--ink)' : 'var(--muted)'} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Developer Mode</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
              {enabled
                ? 'Developer tools are visible in the sidebar'
                : 'Enable to show API keys, webhooks, and developer tools'}
            </div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={toggle}
          style={{
            width: '48px', height: '26px',
            borderRadius: '99px',
            background: enabled ? 'var(--ink)' : 'var(--line)',
            border: 'none', cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s ease',
            flexShrink: 0,
          }}
          aria-label="Toggle developer mode"
        >
          <span style={{
            position: 'absolute',
            top: '3px',
            left: enabled ? '25px' : '3px',
            width: '20px', height: '20px',
            borderRadius: '50%',
            background: enabled ? 'var(--lime)' : 'white',
            transition: 'left 0.2s ease, background 0.2s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>

      {enabled && (
        <div style={{
          marginTop: '14px', padding: '10px 14px',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '8px', fontSize: '12px', color: '#14532d',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span>✅</span>
          Developer mode is ON — check the sidebar for Developer tools.
        </div>
      )}
    </div>
  )
}
