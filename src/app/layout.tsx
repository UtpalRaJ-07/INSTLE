import type { Metadata, Viewport } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { isSearchIndexingAllowed } from '@/config/site';
import { SkipLink } from '@/components/SkipLink/SkipLink';
import { LayoutShell } from '@/components/LayoutShell/LayoutShell';
import { buildIntroBootScript } from '@/components/BrandIntro/boot-script';
import '@/styles/globals.css';

/**
 * Root metadata.
 *
 * `metadataBase` is deliberately absent. Next.js uses it to make relative URLs
 * absolute, and there is no origin to make them absolute against until the owner
 * confirms the domain. Pages that need a canonical build it through
 * src/lib/metadata.ts, which returns nothing while the domain is unconfirmed.
 */
export const metadata: Metadata = {
  title: {
    default: `${CANONICAL_BRAND} — real estate brokerage in Bengaluru`,
    template: `%s`,
  },
  description:
    'Real estate brokerage in Bengaluru. Talk to our team about buying, selling, renting or renting out property. Call 9353096264.',
  applicationName: CANONICAL_BRAND,
  robots: isSearchIndexingAllowed()
    ? { index: true, follow: true }
    : { index: false, follow: false },
  formatDetection: {
    // The phone number is an explicit link everywhere it appears; automatic
    // detection would add a second, differently-formatted tel link on iOS.
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom is not capped: restricting it breaks WCAG 1.4.4 resize-text.
  viewportFit: 'cover',
  // Matches the night header, so the browser's own chrome continues it.
  themeColor: '#0a1110',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the intro boot script may set a data attribute
    // and timing custom properties on <html> before React hydrates.
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* Decides the homepage intro mode before first paint. Inline, a few
            hundred bytes, no request; does nothing on any other route. */}
        <script dangerouslySetInnerHTML={{ __html: buildIntroBootScript() }} />
      </head>
      <body>
        {/* First focusable element on the page. */}
        <SkipLink targetId="main-content" />
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
