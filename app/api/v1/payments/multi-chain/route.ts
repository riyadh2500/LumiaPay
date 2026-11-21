/**
 * Multi-Chain Payment API
 * POST /api/v1/payments/multi-chain
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { withApiKeyAuth } from '@/lib/middleware/api-key-auth'
import { getAllChains } from '@/lib/chains/config'

const schema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Invalid amount'),
  currency: z.enum(['USDC', 'EURC']),
  label: z.string().min(1).max(200),
  chains: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  // Auth check
  const authResult = await withApiKeyAuth(request)
  if (!authResult.success) return authResult.error

  const { context } = authResult

  try {
    const body = await request.json()
    const data = schema.parse(body)

    const admin = createAdminClient()
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lumia-pay-two.vercel.app'

    // Get supported chains for this currency
    const allChains = getAllChains()
    const supportedChains = allChains.filter(chain => {
      const hasToken = !!chain.tokens[data.currency as 'USDC' | 'EURC']
      const isRequested = !data.chains || data.chains.includes(chain.id)
      return hasToken && isRequested
    })

    if (supportedChains.length === 0) {
      return NextResponse.json(
        { error: { message: 'No chains support this currency', status: 400 } },
        { status: 400 }
      )
    }

    // Get merchant wallet address
    const { data: profile } = await admin
      .from('merchant_profiles')
      .select('wallet_address')
      .eq('user_id', context.userId)
      .single()

    const walletAddress = profile?.wallet_address
    if (!walletAddress) {
      return NextResponse.json(
        { error: { message: 'No wallet address configured. Add your wallet in Settings.', status: 400 } },
        { status: 400 }
      )
    }

    // Create payment
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    const { data: payment, error } = await admin
      .from('payments')
      .insert({
        user_id: context.userId,
        application_id: context.applicationId,
        amount: data.amount,
        currency: data.currency,
        label: data.label,
        status: 'pending',
        wallet_address: walletAddress,
        expires_at: expiresAt.toISOString(),
        metadata: {
          ...data.metadata,
          multi_chain: true,
          supported_chains: supportedChains.map(c => c.id),
        },
        environment: context.environment,
      })
      .select()
      .single()

    if (error || !payment) throw error

    return NextResponse.json({
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      label: payment.label,
      status: payment.status,
      wallet_address: walletAddress,
      expires_at: payment.expires_at,
      checkout_url: `${baseUrl}/pay/${payment.id}`,
      supported_chains: supportedChains.map(c => ({
        id: c.id,
        name: c.name,
        logo: c.logo,
        color: c.color,
        chain_id: c.chainId,
        usdc_contract: c.tokens.USDC,
        explorer_url: c.explorerTxUrl,
      })),
      created_at: payment.created_at,
    }, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: err.errors[0].message, status: 400 } },
        { status: 400 }
      )
    }
    console.error('[Multi-chain payment]', err)
    return NextResponse.json(
      { error: { message: 'Internal server error', status: 500 } },
      { status: 500 }
    )
  }
}
