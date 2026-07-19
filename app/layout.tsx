import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LumiaPay — Crypto Payment Gateway',
  description:
    'Accept USDC and EURC payments on Arc Network. No middlemen, instant settlement.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
