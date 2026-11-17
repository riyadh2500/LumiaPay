'use client'

import { useState } from 'react'
import { Play, Copy, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type Method = 'POST' | 'GET'

interface ApiTest {
  id: string
  name: string
  method: Method
  endpoint: string
  body?: Record<string, unknown>
  description: string
}

const TESTS: ApiTest[] = [
  {
    id: 'create',
    name: 'Create Payment',
    method: 'POST',
    endpoint: '/api/v1/payments',
    description: 'Creates a new payment request',
    body: {
      amount: '10.00',
      currency: 'USDC',
      label: 'Test Payment - Sandbox',
      metadata: { test: true, order_id: 'test_001' }
    }
  },
  {
    id: 'list',
    name: 'List Payments',
    method: 'GET',
    endpoint: '/api/v1/payments?limit=5',
    description: 'Fetch your recent payments'
  },
]

export default function SandboxTester() {
  const [apiKey, setApiKey] = useState('')
  const [results, setResults] = useState<Record<string, { status: number; data: unknown; time: number; error?: string }>>({})
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>('create')
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null)

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const runTest = async (test: ApiTest) => {
    if (!apiKey.trim()) {
      alert('Please enter your API key first!')
      return
    }
    setLoading(test.id)
    const start = Date.now()
    try {
      let endpoint = test.endpoint
      // Auto-inject last payment ID for single-payment tests
      if (endpoint.includes(':id') && lastPaymentId) {
        endpoint = endpoint.replace(':id', lastPaymentId)
      }

      const opts: RequestInit = {
        method: test.method,
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      }

      if (test.method === 'POST' && test.body) {
        const bodyStr = editedBodies[test.id] || JSON.stringify(test.body, null, 2)
        opts.body = bodyStr
      }

      const res = await fetch(endpoint, opts)
      const data = await res.json()
      const time = Date.now() - start

      // Save payment ID for subsequent tests
      if (test.id === 'create' && data.id) {
        setLastPaymentId(data.id)
      }

      setResults(prev => ({
        ...prev,
        [test.id]: { status: res.status, data, time }
      }))
      setExpanded(test.id)
    } catch (err: unknown) {
      const time = Date.now() - start
      setResults(prev => ({
        ...prev,
        [test.id]: { status: 0, data: null, time, error: err instanceof Error ? err.message : 'Unknown error' }
      }))
    } finally {
      setLoading(null)
    }
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return '#16a34a'
    if (status >= 400 && status < 500) return '#d97706'
    return '#dc2626'
  }

  const allTests: ApiTest[] = [
    ...TESTS,
    ...(lastPaymentId ? [
      {
        id: 'get',
        name: 'Get Payment',
        method: 'GET' as Method,
        endpoint: `/api/v1/payments/${lastPaymentId}`,
        description: `Fetch payment: ${lastPaymentId.slice(0, 8)}...`
      },
      {
        id: 'cancel',
        name: 'Cancel Payment',
        method: 'POST' as Method,
        endpoint: `/api/v1/payments/${lastPaymentId}/cancel`,
        description: 'Cancel the payment created above'
      }
    ] : [])
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* API Key Input */}
      <div className="card" style={{ padding: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
          Your Test API Key
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="lp_test_xxxxxxxxxxxxxxxx"
            className="input"
            style={{ flex: 1, fontFamily: 'DM Mono, monospace', fontSize: '13px' }}
          />
          {apiKey && (
            <button
              onClick={() => copyText(apiKey, 'key')}
              className="btn"
              style={{ padding: '0 14px', fontSize: '13px' }}
            >
              {copied === 'key' ? <Check size={15} /> : <Copy size={15} />}
            </button>
          )}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
          Go to <a href="/developer/applications" style={{ color: 'var(--accent)', fontWeight: 600 }}>Applications</a> → select your app → Keys tab to get your test API key.
        </p>
      </div>

      {/* Test Cards */}
      {allTests.map((test) => {
        const result = results[test.id]
        const isOpen = expanded === test.id
        const isLoading = loading === test.id
        const bodyStr = editedBodies[test.id] || (test.body ? JSON.stringify(test.body, null, 2) : '')

        return (
          <div key={test.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', borderBottom: isOpen ? '1px solid var(--line)' : 'none' }}
              onClick={() => setExpanded(isOpen ? null : test.id)}
            >
              <span style={{
                padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                fontFamily: 'DM Mono', background: test.method === 'GET' ? '#dbeafe' : '#dcfce7',
                color: test.method === 'GET' ? '#1e40af' : '#14532d'
              }}>
                {test.method}
              </span>
              <code style={{ fontSize: '13px', fontFamily: 'DM Mono', flex: 1 }}>{test.endpoint}</code>
              <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{test.description}</span>
              {result && (
                <span style={{ fontSize: '12px', fontWeight: 700, color: getStatusColor(result.status), fontFamily: 'DM Mono' }}>
                  {result.status} • {result.time}ms
                </span>
              )}
              {isOpen ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
            </div>

            {isOpen && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Editable body */}
                {test.body && (
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Request Body</label>
                    <textarea
                      value={bodyStr}
                      onChange={e => setEditedBodies(prev => ({ ...prev, [test.id]: e.target.value }))}
                      rows={6}
                      className="input"
                      style={{ width: '100%', fontFamily: 'DM Mono, monospace', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                {/* Run button */}
                <button
                  onClick={() => runTest(test)}
                  disabled={isLoading || !apiKey.trim()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: 'fit-content' }}
                >
                  {isLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={15} />}
                  {isLoading ? 'Running...' : `Run ${test.name}`}
                </button>

                {/* Response */}
                {result && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Response</label>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: getStatusColor(result.status), fontFamily: 'DM Mono' }}>
                          {result.status} • {result.time}ms
                        </span>
                      </div>
                      <button onClick={() => copyText(JSON.stringify(result.data, null, 2), `res-${test.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                        {copied === `res-${test.id}` ? <Check size={13} /> : <Copy size={13} />} Copy
                      </button>
                    </div>
                    <pre style={{ background: '#0f1117', color: '#e2e8f0', padding: '14px', borderRadius: '10px', fontSize: '12px', fontFamily: 'DM Mono, monospace', overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', margin: 0 }}>
                      {result.error ? `Error: ${result.error}` : JSON.stringify(result.data, null, 2)}
                    </pre>

                    {/* Checkout link */}
                    {result.data && typeof result.data === 'object' && (result.data as Record<string, string>)['checkout_url'] ? (
                      <div style={{ marginTop: '10px', padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: '#14532d', fontWeight: 600 }}>✅ Payment created! Open checkout:</span>
                        <a href={(result.data as Record<string, string>)['checkout_url']} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: '13px' }}>
                          Open Checkout →
                        </a>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}