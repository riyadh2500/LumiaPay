/**
 * Multi-Chain Payment Verifier
 * Supports: Arc, Ethereum Sepolia, Polygon Amoy, Base Sepolia,
 *           Arbitrum Sepolia, Optimism Sepolia, Avalanche Fuji, BSC Testnet
 */

import { ethers } from 'ethers'
import { CHAINS, type ChainId } from './config'
import { createAdminClient } from '@/lib/supabase/admin'

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

export interface VerifyResult {
  found: boolean
  txHash?: string
  amount?: string
  chainId?: ChainId
  blockNumber?: number
  error?: string
}

/**
 * Get provider for a chain
 */
function getProvider(chainId: ChainId): ethers.JsonRpcProvider {
  const chain = CHAINS[chainId]
  if (!chain) throw new Error(`Unknown chain: ${chainId}`)
  return new ethers.JsonRpcProvider(chain.rpcUrl)
}

/**
 * Scan recent blocks for a USDC/EURC transfer to a specific address
 */
export async function scanChainForPayment(
  chainId: ChainId,
  toAddress: string,
  expectedAmount: string,
  currency: 'USDC' | 'EURC',
  fromTimestamp: number,
  blocksToScan = 100
): Promise<VerifyResult> {
  const chain = CHAINS[chainId]
  const contractAddress = chain.tokens[currency]
  
  if (!contractAddress) {
    return { found: false, error: `${currency} not supported on ${chain.name}` }
  }

  try {
    const provider = getProvider(chainId)
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
    
    // Get current block
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - blocksToScan)
    
    // Get decimals
    let decimals = 6 // USDC default
    try {
      decimals = await contract.decimals() as number
    } catch {
      decimals = 6
    }

    const expectedAmountWei = ethers.parseUnits(expectedAmount, decimals)
    const tolerance = expectedAmountWei * BigInt(99) / BigInt(100) // 1% tolerance

    // Query Transfer events
    const filter = contract.filters.Transfer(null, toAddress)
    const events = await contract.queryFilter(filter, fromBlock, currentBlock)

    for (const event of events) {
      if (!(event instanceof ethers.EventLog)) continue
      
      const value = event.args[2] as bigint
      
      // Check amount matches (within 1% tolerance)
      if (value >= tolerance) {
        const block = await provider.getBlock(event.blockNumber)
        
        // Check timestamp - must be after payment creation
        if (block && block.timestamp >= fromTimestamp) {
          const actualAmount = ethers.formatUnits(value, decimals)
          return {
            found: true,
            txHash: event.transactionHash,
            amount: actualAmount,
            chainId,
            blockNumber: event.blockNumber,
          }
        }
      }
    }

    return { found: false }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[MultiChain Verifier] Error on ${chainId}:`, msg)
    return { found: false, error: msg }
  }
}

/**
 * Scan ALL supported chains for a payment
 * Returns the first chain where payment is found
 */
export async function scanAllChainsForPayment(
  toAddress: string,
  expectedAmount: string,
  currency: 'USDC' | 'EURC',
  fromTimestamp: number,
  supportedChains?: ChainId[]
): Promise<VerifyResult & { checkedChains: string[] }> {
  const chainsToCheck = supportedChains || 
    (Object.keys(CHAINS) as ChainId[]).filter(id => id !== 'arc-testnet') // Arc has its own verifier

  const checkedChains: string[] = []
  
  // Run all chain scans in parallel
  const results = await Promise.allSettled(
    chainsToCheck.map(async (chainId) => {
      checkedChains.push(chainId)
      return { chainId, result: await scanChainForPayment(chainId, toAddress, expectedAmount, currency, fromTimestamp) }
    })
  )

  // Find first successful result
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.result.found) {
      return { ...result.value.result, checkedChains }
    }
  }

  return { found: false, checkedChains }
}

/**
 * Verify a specific transaction hash on a specific chain
 */
export async function verifyTransactionOnChain(
  txHash: string,
  chainId: ChainId,
  toAddress: string,
  expectedAmount: string,
  currency: 'USDC' | 'EURC'
): Promise<VerifyResult> {
  const chain = CHAINS[chainId]
  const contractAddress = chain.tokens[currency]
  if (!contractAddress) return { found: false, error: `${currency} not supported` }

  try {
    const provider = getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) return { found: false, error: 'Transaction not found' }

    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
    let decimals = 6
    try { decimals = await contract.decimals() as number } catch { decimals = 6 }

    const iface = new ethers.Interface(ERC20_ABI)
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: [...log.topics], data: log.data })
        if (
          parsed?.name === 'Transfer' &&
          parsed.args[1].toLowerCase() === toAddress.toLowerCase()
        ) {
          const value = parsed.args[2] as bigint
          const expectedWei = ethers.parseUnits(expectedAmount, decimals)
          const tolerance = expectedWei * BigInt(99) / BigInt(100)
          
          if (value >= tolerance) {
            return {
              found: true,
              txHash,
              amount: ethers.formatUnits(value, decimals),
              chainId,
              blockNumber: receipt.blockNumber,
            }
          }
        }
      } catch { continue }
    }

    return { found: false, error: 'No matching transfer in transaction' }
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Update payment status after multi-chain verification
 */
export async function updatePaymentAfterVerification(
  paymentId: string,
  result: VerifyResult
): Promise<void> {
  const admin = createAdminClient()
  
  if (!result.found || !result.txHash) return

  const chain = result.chainId ? CHAINS[result.chainId] : null
  
  await admin
    .from('payments')
    .update({
      status: 'paid',
      tx_hash: result.txHash,
      metadata: {
        verified_chain: result.chainId,
        verified_chain_name: chain?.name,
        block_number: result.blockNumber,
        verified_at: new Date().toISOString(),
      },
    })
    .eq('id', paymentId)
    .eq('status', 'detecting')
}
