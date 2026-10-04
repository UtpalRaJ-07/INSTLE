import type { MetadataRoute } from 'next';
import {
  ENQUIRY_API_DISALLOW_PATH,
  SEARCH_CRAWL_DECISION,
  TRAINING_CRAWL_DECISION,
  buildAgentGroup,
} from '@/config/crawler-access';
import { absoluteUrl, isSearchIndexingAllowed } from '@/config/site';

/**
 * robots.txt
 *
 * Two shapes, and nothing in between (Requirements 6.1 and 6.2):
 *
 *  - Blocked. Unless `INSTLE_DEPLOY_ENV` is exactly `production` and the domain
 *    is confirmed (A1, OWN-01): one `User-agent: *` group with `Disallow: /`, no
 *    Allow line and no sitemap reference. An absent, empty or unreadable value
 *    lands here.
 *
 *  - Production. A `User-agent: *` group allowing `/` and disallowing `/api/`,
 *    then one group per recorded crawler decision, each from its own
 *    `buildAgentGroup` call so neither decision can reach the other's group
 *    (Requirement 6.3). An unrecorded decision emits `Disallow: /` for its agent
 *    (Requirement 6.10). The sitemap is named on the confirmed origin.
 *
 * Notes on what is deliberately NOT done here:
 *
 *  - The wildcard group allows `/` rather than listing gate-passing routes. A
 *    route failing its gate returns 404 with `noindex`, and a crawler has to be
 *    able to fetch it to read that (Requirement 6.6). An explicit allow list
 *    would add nothing a crawler obeys and would have to be kept in step.
 *
 *  - The prototype routes (/concept-1, /concept-2, /concept-review) are not
 *    disallowed. They already carry `noindex`, and blocking them in robots.txt
 *    would stop a crawler from ever reading that instruction. A blocked URL can
 *    still be indexed from external links. They are instead served as 404 in a
 *    production deployment (see the guard in each prototype page).
 *
 *  - No sitemap URL is advertised while the domain is unconfirmed. Advertising a
 *    guessed sitemap URL would mean inventing an origin.
 *
 *  - robots.txt is crawler guidance, not access control. Private data is behind
 *    the API's method and validation rules, not behind this file.
 */

/**
 * Evaluated per request. Static generation would freeze the indexing decision
 * at build time, so a domain confirmed after the build would not take effect.
 */
export const dynamic = 'force-dynamic';

/**
 * Requirement 6.1 names the value `production` itself. `getDeployEnvironment()`
 * trims and lower-cases, so `PRODUCTION` or ` production` count as production for
 * the rest of the site; robots.txt stays blocked for anything but the exact value.
 * The difference can only ever block crawling, never open it.
 */
function isExactlyProduction(): boolean {
  return process.env.INSTLE_DEPLOY_ENV === 'production';
}

export default function robots(): MetadataRoute.Robots {
  // Requirement 6.1. `isSearchIndexingAllowed` also requires a confirmed domain.
  if (!isExactlyProduction() || !isSearchIndexingAllowed()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  // Absolute, on the confirmed origin. Null only while the domain is unconfirmed,
  // which the guard above has already ruled out.
  const sitemap = absoluteUrl('/sitemap.xml');
  const now = new Date();

  return {
    rules: [
      // Every agent not named below. The enquiry endpoint handles personal data.
      { userAgent: '*', allow: '/', disallow: [ENQUIRY_API_DISALLOW_PATH] },
      // Search access and training access: separate decisions, separate calls.
      buildAgentGroup(SEARCH_CRAWL_DECISION, now),
      buildAgentGroup(TRAINING_CRAWL_DECISION, now),
    ],
    ...(sitemap ? { sitemap } : {}),
  };
}
