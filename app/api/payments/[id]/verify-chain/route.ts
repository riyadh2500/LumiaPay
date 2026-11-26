/**
 * Multi-Chain Payment Verification Endpoint
 * POST /api/payments/[id]/verify-chain
 *
 * Scans multiple EVM chains for payment confirmation.
 * Called by checkout page polling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scanAllChainsForPayment, verifyTransactionOnChain } from '@/lib/chains/verifier'
import type { ChainId } from '@/lib/chains/config'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params

  try {
    const admin = createAdminClient()

    // Get payment
    const { data: payment, error } = await admin
      .from('payments')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Only verify pending/detecting payments
    if (!['pending', 'detecting'].includes(payment.status)) {
      return NextResponse.json({ status: payment.status, txHash: payment.tx_hash })
    }

    // Check if expired
    const now = new Date()
    const expiresAt = new Date(payment.expires_at)
    if (now > expiresAt) {
      await admin.from('payments').update({ status: 'expired' }).eq('id', id)
      return NextResponse.json({ status: 'expired' })
    }

    // Get supported chains from metadata
    const metadata = payment.metadata as any
    const isMultiChain = metadata?.multi_chain === true
    const supportedChains = metadata?.supported_chains as ChainId[] | undefined

    // If not multi-chain, skip (Arc handles its own verification)
    if (!isMultiChain) {
      return NextResponse.json({ status: payment.status, message: 'Use standard verify endpoint for Arc payments' })
    }

    const fromTimestamp = Math.floor(new Date(payment.created_at).getTime() / 1000)

    // Parse body for optional txHash
    let body: { txHash?: string; chainId?: string } = {}
    try { body = await request.json() } catch { /* no body */ }

    let result

    // If specific tx provided, verify it directly
    if (body.txHash && body.chainId) {
      result = await verifyTransactionOnChain(
        body.txHash,
        body.chainId as ChainId,
        payment.wallet_address,
        payment.amount,
        payment.currency as 'USDC' | 'EURC'
      )
    } else {
      // Scan all supported chains
      result = await scanAllChainsForPayment(
        payment.wallet_address,
        payment.amount,
        payment.currency as 'USDC' | 'EURC',
        fromTimestamp,
        supportedChains?.filter(c => c !== 'arc-testnet') // Arc has own verifier
      )
    }

    if (result.found && result.txHash) {
      // Update payment to paid
      await admin
        .from('payments')
        .update({
          status: 'paid',
          tx_hash: result.txHash,
          metadata: {
            ...metadata,
            verified_chain: result.chainId,
            block_number: result.blockNumber,
            verified_at: new Date().toISOString(),
          },
        })
        .eq('id', id)

      return NextResponse.json({
        status: 'paid',
        txHash: result.txHash,
        chain: result.chainId,
        amount: result.amount,
      })
    }

    // Update to detecting if still pending
    if (payment.status === 'pending') {
      await admin.from('payments').update({ status: 'detecting' }).eq('id', id)
    }

    return NextResponse.json({
      status: 'detecting',
      message: 'No payment found yet',
      checkedChains: (result as any).checkedChains ?? [],
    })

  } catch (error) {
    console.error('[Multi-chain verify]', error)
    return NextResponse.json({ error: 'Verification failed', status: 'pending' }, { status: 500 })
  }
}
