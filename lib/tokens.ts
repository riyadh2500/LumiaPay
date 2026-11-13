/**
 * Arc Testnet token registry.
 *
 * Key decimals note from Arc docs:
 *   - USDC native gas interface  → 18 decimals (msg.value / tx gas)
 *   - USDC ERC-20 interface      → 6 decimals  (balanceOf / Transfer logs)
 *
 * For payment amounts we always use the ERC-20 interface (6 decimals)
 * because that is what the USDC contract address exposes and what
 * getLogs returns. The native 18-decimal view is only relevant for
 * EIP-7708 system Transfer events (handled in evm-verify.ts).
 */

export type TokenSymbol = 'USDC' | 'EURC';

export interface Token {
  symbol: TokenSymbol;
  name: string;
  /** ERC-20 interface decimals — always 6 for both USDC and EURC on Arc */
  decimals: number;
  contractAddress: `0x${string}`;
  isNative: boolean;
}

/** Arc Testnet token addresses (from https://docs.arc.io/arc/references/contract-addresses) */
export const TOKENS: Record<TokenSymbol, Token> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    // USDC ERC-20 interface on Arc Testnet. Also the native gas token.
    contractAddress: (process.env.ARC_USDC_CONTRACT ??
      '0x3600000000000000000000000000000000000000') as `0x${string}`,
    // USDC is native on Arc, but we use the ERC-20 interface for transfer
    // detection, so treat it as a non-native ERC-20 for verification purposes.
    isNative: false,
  },
  EURC: {
    symbol: 'EURC',
    name: 'Euro Coin',
    decimals: 6,
    contractAddress: (process.env.ARC_EURC_CONTRACT ??
      '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a') as `0x${string}`,
    isNative: false,
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

export function getToken(symbol: string): Token {
  const t = TOKENS[symbol as TokenSymbol];
  if (!t) throw new Error(`Unknown token: ${symbol}`);
  return t;
}
