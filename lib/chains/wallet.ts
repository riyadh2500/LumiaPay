/**
 * Multi-Chain Wallet Address Generator
 * For EVM chains - same address works on all chains
 */

import { ethers } from 'ethers'
import type { ChainId } from './config'
import { CHAINS } from './config'

// ERC-20 ABI (minimal - only what we need)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]

export interface WalletInfo {
  address: string
  chainId: ChainId
  token: 'USDC' | 'EURC'
}

/**
 * Get provider for a specific chain
 */
export function getProvider(chainId: ChainId): ethers.JsonRpcProvider {
  const chain = CHAINS[chainId]
  if (!chain) throw new Error(`Unknown chain: ${chainId}`)
  return new ethers.JsonRpcProvider(chain.rpcUrl)
}

/**
 * Get USDC balance for an address on a specific chain
 */
export async function getTokenBalance(
  address: string,
  chainId: ChainId,
  token: 'USDC' | 'EURC' = 'USDC'
): Promise<{ balance: number; raw: bigint }> {
  const chain = CHAINS[chainId]
  const contractAddress = chain.tokens[token]
  if (!contractAddress) return { balance: 0, raw: 0n }

  try {
    const provider = getProvider(chainId)
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
    const [raw, decimals] = await Promise.all([
      contract.balanceOf(address) as Promise<bigint>,
      contract.decimals() as Promise<number>,
    ])
    const balance = Number(raw) / Math.pow(10, decimals)
    return { balance, raw }
  } catch {
    return { balance: 0, raw: 0n }
  }
}

/**
 * Watch for incoming token transfer to an address
 * Returns true if payment detected within timeout
 */
export async function watchForPayment(
  toAddress: string,
  expectedAmount: number,
  chainId: ChainId,
  token: 'USDC' | 'EURC' = 'USDC',
  timeoutMs = 300000 // 5 minutes
): Promise<{ detected: boolean; txHash?: string; amount?: number }> {
  const chain = CHAINS[chainId]
  const contractAddress = chain.tokens[token]
  if (!contractAddress) return { detected: false }

  return new Promise((resolve) => {
    const provider = getProvider(chainId)
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)

    const timeout = setTimeout(() => {
      contract.removeAllListeners()
      resolve({ detected: false })
    }, timeoutMs)

    // Listen for Transfer events to our address
    const filter = contract.filters.Transfer(null, toAddress)
    contract.on(filter, async (from: string, to: string, value: bigint, event: ethers.EventLog) => {
      try {
        const decimals = await contract.decimals() as number
        const amount = Number(value) / Math.pow(10, decimals)

        // Allow 1% tolerance for underpayment
        if (amount >= expectedAmount * 0.99) {
          clearTimeout(timeout)
          contract.removeAllListeners()
          resolve({
            detected: true,
            txHash: event.transactionHash,
            amount,
          })
        }
      } catch {
        // ignore
      }
    })
  })
}

/**
 * Verify a specific transaction
 */
export async function verifyTransaction(
  txHash: string,
  toAddress: string,
  expectedAmount: number,
  chainId: ChainId,
  token: 'USDC' | 'EURC' = 'USDC'
): Promise<{ valid: boolean; amount?: number; confirmations?: number }> {
  const chain = CHAINS[chainId]
  const contractAddress = chain.tokens[token]
  if (!contractAddress) return { valid: false }

  try {
    const provider = getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) return { valid: false }

    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
    const decimals = await contract.decimals() as number

    // Parse Transfer events from receipt
    const iface = new ethers.Interface(ERC20_ABI)
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log)
        if (
          parsed?.name === 'Transfer' &&
          parsed.args[1].toLowerCase() === toAddress.toLowerCase()
        ) {
          const amount = Number(parsed.args[2]) / Math.pow(10, decimals)
          const block = await provider.getBlock('latest')
          const confirmations = block ? block.number - receipt.blockNumber : 0
          return { valid: amount >= expectedAmount * 0.99, amount, confirmations }
        }
      } catch { continue }
    }
    return { valid: false }
  } catch {
    return { valid: false }
  }
}
