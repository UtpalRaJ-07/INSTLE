import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { SkipLink } from '@/components/SkipLink/SkipLink';
import { LayoutShell } from '@/components/LayoutShell/LayoutShell';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: `${CANONICAL_BRAND} — Bengaluru Real Estate Brokerage & Property Advisory Platform`,
  description:
    'Human-led real estate brokerage and property advisory service for buyers, tenants, sellers, and landlords in Bengaluru.',
  // NOTE: Canonical URL tag is deliberately omitted until the canonical domain is confirmed.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SkipLink targetId="main-content" />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
