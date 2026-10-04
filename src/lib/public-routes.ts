/**
 * The single registry of public, indexable routes.
 *
 * Both the sitemap and the route-policy tests read from here, so a page cannot
 * be added to one and forgotten in the other.
 *
 * `lastModified` is tied to substantive content changes, not to build time.
 * Master prompt section 18: "Keep lastModified tied to substantive content
 * changes, not every request/build."
 */

import { getPublishedGuides } from '@/config/guides';
import type { LocalityRecord } from '@/config/localities';
import { getPublishedAreaRecords } from '@/config/locality-sections';

export interface PublicRoute {
  path: string;
  /** ISO date of the last substantive content change. */
  lastModified: string;
  /** Relative priority within this site only. */
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

/** Date the current copy for the static routes was written. */
const CORE_CONTENT_DATE = '2026-09-29';

/**
 * Static public routes.
 *
 * Absent by design:
 *  - /privacy, /terms, /cookie-preferences — no approved wording has been
 *    supplied (OWN-09), and inventing legal text is forbidden.
 *  - /pin-codes — no source-backed postal mapping exists.
 *  - /bengaluru/[region] — a region hub is a `region-hub` record served under
 *    /areas/[slug], and appears below only once it clears the region hub gate.
 *  - /thank-you — the confirmation is a form state, so no URL carries a reference.
 */
export const STATIC_PUBLIC_ROUTES: readonly PublicRoute[] = [
  { path: '/', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/buy', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/sell', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/rent', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/rent-out', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/commercial', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/areas', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/guides', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/how-it-works', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/about', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
  { path: '/about/utpal-raj-kb', lastModified: CORE_CONTENT_DATE, changeFrequency: 'yearly' },
  { path: '/contact', lastModified: CORE_CONTENT_DATE, changeFrequency: 'monthly' },
] as const;

/**
 * Routes that exist under `src/app` and are deliberately **not** public.
 *
 * Requirement 11.8 asks for a preview surface for a record that has not passed the
 * publication gate, and requires it to return 404 in every production build and to
 * appear in no sitemap and in no link on a public page. The sitemap, `llms.txt` and
 * every navigation surface read `getPublicRoutes`, so leaving the route out of the
 * registry is what makes those three absences one decision rather than three.
 *
 * Recorded as a named constant rather than by silence: a test asserts each entry is
 * absent from `getPublicRoutes`, so the exclusion is checked instead of assumed, and
 * a later attempt to register one of these paths fails a test rather than shipping.
 */
export const NON_PUBLIC_INTERNAL_ROUTES: readonly string[] = ['/internal-preview'] as const;

/**
 * Every eligible public route, including approved content pages.
 *
 * Area routes come from `getPublishedAreaRecords`, the same accessor
 * `/areas/[slug]` resolves through, so a region hub below three published
 * locality links or two unique sections is absent here and from the sitemap
 * for exactly as long as its page returns 404 (Requirements 2.7, 2.9).
 *
 * `areaRegistry` is injectable for tests only; the sitemap omits it.
 */
export function getPublicRoutes(
  now: Date = new Date(),
  areaRegistry?: readonly LocalityRecord[]
): readonly PublicRoute[] {
  const localityRoutes: PublicRoute[] = getPublishedAreaRecords(now, areaRegistry).map((record) => ({
    path: `/areas/${record.slug}`,
    lastModified: record.contentUpdatedAt ?? CORE_CONTENT_DATE,
    changeFrequency: 'monthly' as const,
  }));

  const guideRoutes: PublicRoute[] = getPublishedGuides(now).map((record) => ({
    path: `/guides/${record.slug}`,
    lastModified: record.contentUpdatedAt ?? CORE_CONTENT_DATE,
    changeFrequency: 'yearly' as const,
  }));

  return [...STATIC_PUBLIC_ROUTES, ...localityRoutes, ...guideRoutes];
}
