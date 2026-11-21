'use client'

import { useState } from 'react'
import { getAllChains, type ChainConfig, type ChainId } from '@/lib/chains/config'

interface ChainSelectorProps {
  currency: 'USDC' | 'EURC'
  selectedChain: ChainId
  onSelect: (chainId: ChainId) => void
}

export default function ChainSelector({ currency, selectedChain, onSelect }: ChainSelectorProps) {
  const [open, setOpen] = useState(false)
  const chains = getAllChains().filter(c => !!c.tokens[currency])
  const selected = chains.find(c => c.id === selectedChain) || chains[0]

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>
        Select Network
      </div>

      {/* Grid of chain buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
        {chains.map((chain) => (
          <button
            key={chain.id}
            onClick={() => onSelect(chain.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: selectedChain === chain.id
                ? `2px solid ${chain.color}`
                : '1.5px solid var(--line)',
              background: selectedChain === chain.id
                ? chain.color + '15'
                : 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: chain.color + '20',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', flexShrink: 0,
            }}>
              {chain.logo}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>
                {chain.shortName}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: 1.2 }}>
                {chain.isTestnet ? 'Testnet' : 'Mainnet'}
              </div>
            </div>
            {selectedChain === chain.id && (
              <div style={{ marginLeft: 'auto', width: '8px', height: '8px', borderRadius: '50%', background: chain.color, flexShrink: 0 }} />
            )}
          </button>
        ))}
      </div>

      {/* Selected chain info */}
      {selected && (
        <div style={{
          marginTop: '12px', padding: '10px 14px',
          background: selected.color + '10',
          border: `1px solid ${selected.color}30`,
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '18px' }}>{selected.logo}</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>{selected.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Chain ID: {selected.chainId} · USDC: {selected.tokens.USDC?.slice(0, 8)}...
            </div>
          </div>
          <a
            href={selected.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '11px', color: selected.color, fontWeight: 600, textDecoration: 'none' }}
          >
            Explorer ↗
          </a>
        </div>
      )}
    </div>
  )
}
