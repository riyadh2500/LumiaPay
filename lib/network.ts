/**
 * Minimal ERC-20 Transfer event ABI.
 * Used to query inbound ERC-20 transfers for USDC and EURC on Arc.
 */
export const ERC20_TRANSFER_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

/**
 * Minimal ERC-20 ABI for reading balances.
 */
export const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Arc emits EIP-7708 native Transfer events from a dedicated system address
 * for every native USDC movement. These use 18 decimals (native gas interface).
 * We track this address so we can distinguish system logs from ERC-20 logs.
 *
 * Source: https://docs.arc.io/arc/references/evm-differences#native-usdc-transfer-events-eip-7708
 * The system emitter is the USDC contract itself on Arc Testnet.
 */
export const ARC_USDC_SYSTEM_EMITTER =
  '0x3600000000000000000000000000000000000000' as const;

/**
 * How many blocks to look back when searching for a matching transfer.
 *
 * Arc Testnet produces a block every ~0.48 s.
 * 15-minute payment TTL ÷ 0.48 s/block ≈ 1,875 blocks.
 * We use 2,000 for a small safety margin.
 */
export const BLOCK_LOOKBACK = 2000n;

/** Payment expiry in seconds (60 minutes for testnet). */
export const PAYMENT_TTL_SECONDS = 60 * 60;

/** Arc Testnet Chain ID */
export const ARC_TESTNET_CHAIN_ID = 5042002;

/** Arc Testnet block explorer base URL */
export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';
