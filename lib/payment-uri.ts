import { getToken, TokenSymbol } from './tokens';
import { ARC_TESTNET_CHAIN_ID } from './network';

/**
 * Builds an EIP-681 payment URI for Arc Testnet.
 *
 * Format for ERC-20 tokens (USDC, EURC):
 *   ethereum:<contractAddress>@<chainId>/transfer?address=<recipient>&uint256=<amount>
 *
 * Both USDC and EURC on Arc are ERC-20 tokens, so we always use the
 * ERC-20 transfer form. The amount is expressed in the token's 6-decimal
 * ERC-20 units (not the 18-decimal native USDC gas interface).
 *
 * Wallets that support Arc Testnet (chain ID 5042002) and EIP-681 will
 * pre-fill the transfer details when the QR code is scanned.
 */
export function buildPaymentUri(opts: {
  symbol: TokenSymbol;
  recipientAddress: string;
  /** Human-readable amount, e.g. "10.50" */
  amount: string;
}): string {
  const token = getToken(opts.symbol);

  // Convert to ERC-20 units (6 decimals for both USDC and EURC on Arc).
  const amountUnits = BigInt(
    Math.round(parseFloat(opts.amount) * 10 ** token.decimals)
  );

  // EIP-681: ethereum:<contract>@<chainId>/transfer?address=<to>&uint256=<value>
  return (
    `ethereum:${token.contractAddress}@${ARC_TESTNET_CHAIN_ID}` +
    `/transfer?address=${opts.recipientAddress}&uint256=${amountUnits}`
  );
}

/**
 * Formats a raw ERC-20 unit amount back to a human-readable decimal string.
 */
export function formatTokenAmount(rawAmount: bigint, symbol: TokenSymbol): string {
  const token = getToken(symbol);
  const divisor = 10 ** token.decimals;
  return (Number(rawAmount) / divisor).toFixed(2);
}
