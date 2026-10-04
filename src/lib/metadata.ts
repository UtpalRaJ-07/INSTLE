/**
 * Shared page metadata composer.
 *
 * Two rules drive everything here:
 *
 *  1. While the domain is unconfirmed, no absolute URL is emitted anywhere —
 *     no canonical, no metadataBase, no Open Graph url. A guessed origin in a
 *     canonical tag is worse than no canonical tag.
 *
 *  2. Indexing is permitted only in a production environment with a confirmed
 *     domain. Development and preview deployments are noindex even if they are
 *     publicly reachable, so a preview cannot inherit production permission.
 */

import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { absoluteUrl, isSearchIndexingAllowed } from '@/config/site';

export interface PageMetadataInput {
  /** Page-specific title, without the brand. */
  title: string;
  /** Honest description derived from the visible page content. */
  description: string;
  /** Route path, e.g. "/buy". Used for the canonical once a domain exists. */
  path: string;
  /** Force noindex regardless of environment, e.g. prototypes and previews. */
  noindex?: boolean;
  /** Override the full title when the brand lockup needs to lead. */
  absoluteTitle?: string;
}

const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

/**
 * Compose metadata for a page.
 *
 * The brand string is appended exactly, so the canonical lockup appears in every
 * title without any component having to remember to add it.
 */
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const title = input.absoluteTitle ?? `${input.title} — ${CANONICAL_BRAND}`;
  const canonical = absoluteUrl(input.path);
  const shouldIndex = isSearchIndexingAllowed() && !input.noindex;

  const metadata: Metadata = {
    title,
    description: input.description,
    openGraph: {
      title,
      description: input.description,
      siteName: CANONICAL_BRAND,
      locale: 'en_IN',
      type: 'website',
      // `url` is set below only when an absolute URL exists.
    },
    robots: shouldIndex
      ? { index: true, follow: true, googleBot: { index: true, follow: true } }
      : NOINDEX_ROBOTS,
  };

  if (canonical) {
    metadata.alternates = { canonical };
    if (metadata.openGraph) {
      metadata.openGraph.url = canonical;
    }
  }

  return metadata;
}

/** Metadata for private design prototypes. Always noindex, never canonical. */
export function buildPrototypeMetadata(title: string, description: string): Metadata {
  return {
    title: `[INTERNAL PREVIEW] ${title} — ${CANONICAL_BRAND}`,
    description,
    robots: NOINDEX_ROBOTS,
  };
}
