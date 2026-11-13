import type { TokenSymbol } from '@/lib/tokens';

interface CurrencyBadgeProps {
  symbol: TokenSymbol | string;
  size?: number;
}

const CLASS_MAP: Record<string, string> = {
  POL: 'pol',
  USDC: 'usdc',
  USDT: 'usdt',
};

export default function CurrencyBadge({ symbol, size = 34 }: CurrencyBadgeProps) {
  const cls = CLASS_MAP[symbol] ?? 'pol';
  return (
    <span
      className={`order-icon ${cls}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.29) }}
    >
      {symbol.slice(0, 3)}
    </span>
  );
}
