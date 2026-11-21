/**
 * Multi-Chain Configuration
 * Supports: Arc, Ethereum Sepolia, Polygon Amoy, Base Sepolia,
 *           Arbitrum Sepolia, Optimism Sepolia, Avalanche Fuji, BSC Testnet
 */

export type ChainId =
  | 'arc-testnet'
  | 'eth-sepolia'
  | 'polygon-amoy'
  | 'base-sepolia'
  | 'arbitrum-sepolia'
  | 'optimism-sepolia'
  | 'avalanche-fuji'
  | 'bsc-testnet'

export interface ChainConfig {
  id: ChainId
  name: string
  shortName: string
  chainId: number
  rpcUrl: string
  explorerUrl: string
  explorerTxUrl: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  tokens: {
    USDC?: string
    EURC?: string
  }
  logo: string
  color: string
  isEVM: boolean
  isTestnet: boolean
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  'arc-testnet': {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    shortName: 'Arc',
    chainId: 1313161554,
    rpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
    explorerUrl: 'https://testnet.lumiaexplorer.com',
    explorerTxUrl: 'https://testnet.lumiaexplorer.com/tx/',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
    tokens: {
      USDC: process.env.ARC_USDC_CONTRACT || '0x3600000000000000000000000000000000000000',
      EURC: process.env.ARC_EURC_CONTRACT || '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    },
    logo: '⬡',
    color: '#c8ff70',
    isEVM: true,
    isTestnet: true,
  },

  'eth-sepolia': {
    id: 'eth-sepolia',
    name: 'Ethereum Sepolia',
    shortName: 'ETH',
    chainId: 11155111,
    rpcUrl: process.env.ETH_SEPOLIA_RPC || 'https://rpc.ankr.com/eth_sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerTxUrl: 'https://sepolia.etherscan.io/tx/',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.ETH_SEPOLIA_USDC || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
    logo: 'Ξ',
    color: '#627EEA',
    isEVM: true,
    isTestnet: true,
  },

  'polygon-amoy': {
    id: 'polygon-amoy',
    name: 'Polygon Amoy',
    shortName: 'MATIC',
    chainId: 80002,
    rpcUrl: process.env.POLYGON_AMOY_RPC || 'https://rpc.ankr.com/polygon_amoy',
    explorerUrl: 'https://amoy.polygonscan.com',
    explorerTxUrl: 'https://amoy.polygonscan.com/tx/',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    tokens: {
      USDC: process.env.POLYGON_AMOY_USDC || '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    },
    logo: '⬟',
    color: '#8247E5',
    isEVM: true,
    isTestnet: true,
  },

  'base-sepolia': {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    shortName: 'Base',
    chainId: 84532,
    rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    explorerTxUrl: 'https://sepolia.basescan.org/tx/',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.BASE_SEPOLIA_USDC || '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
    logo: '◎',
    color: '#0052FF',
    isEVM: true,
    isTestnet: true,
  },

  'arbitrum-sepolia': {
    id: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    shortName: 'ARB',
    chainId: 421614,
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
    explorerTxUrl: 'https://sepolia.arbiscan.io/tx/',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.ARBITRUM_SEPOLIA_USDC || '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
    logo: '◈',
    color: '#28A0F0',
    isEVM: true,
    isTestnet: true,
  },

  'optimism-sepolia': {
    id: 'optimism-sepolia',
    name: 'Optimism Sepolia',
    shortName: 'OP',
    chainId: 11155420,
    rpcUrl: process.env.OPTIMISM_SEPOLIA_RPC || 'https://sepolia.optimism.io',
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    explorerTxUrl: 'https://sepolia-optimism.etherscan.io/tx/',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    tokens: {
      USDC: process.env.OPTIMISM_SEPOLIA_USDC || '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    },
    logo: '🔴',
    color: '#FF0420',
    isEVM: true,
    isTestnet: true,
  },

  'avalanche-fuji': {
    id: 'avalanche-fuji',
    name: 'Avalanche Fuji',
    shortName: 'AVAX',
    chainId: 43113,
    rpcUrl: process.env.AVALANCHE_FUJI_RPC || 'https://rpc.ankr.com/avalanche_fuji',
    explorerUrl: 'https://testnet.snowtrace.io',
    explorerTxUrl: 'https://testnet.snowtrace.io/tx/',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    tokens: {
      USDC: process.env.AVALANCHE_FUJI_USDC || '0x5425890298aed601595a70AB815c96711a31Bc65',
    },
    logo: '▲',
    color: '#E84142',
    isEVM: true,
    isTestnet: true,
  },

  'bsc-testnet': {
    id: 'bsc-testnet',
    name: 'BSC Testnet',
    shortName: 'BNB',
    chainId: 97,
    rpcUrl: process.env.BSC_TESTNET_RPC || 'https://rpc.ankr.com/bsc_testnet_chapel',
    explorerUrl: 'https://testnet.bscscan.com',
    explorerTxUrl: 'https://testnet.bscscan.com/tx/',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    tokens: {
      USDC: process.env.BSC_TESTNET_USDC || '0x64544969ed7EBf5f083679233325356EbE738930',
    },
    logo: '◆',
    color: '#F3BA2F',
    isEVM: true,
    isTestnet: true,
  },
}

export const DEFAULT_CHAIN: ChainId = 'arc-testnet'

export function getChain(chainId: ChainId): ChainConfig {
  return CHAINS[chainId]
}

export function getTokenContract(chainId: ChainId, token: 'USDC' | 'EURC'): string | undefined {
  return CHAINS[chainId]?.tokens[token]
}

export function getAllChains(): ChainConfig[] {
  return Object.values(CHAINS)
}

export function getEVMChains(): ChainConfig[] {
  return Object.values(CHAINS).filter(c => c.isEVM)
}
