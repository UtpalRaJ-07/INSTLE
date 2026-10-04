import { absoluteUrl, isDomainConfirmed, isSearchIndexingAllowed } from '@/config/site';
import { getPublicRoutes } from '@/lib/public-routes';

/**
 * XML sitemap.
 *
 * Implemented as a route handler rather than the sitemap file convention so that
 * it can return a genuine 404 while the domain is unconfirmed. The file
 * convention would always serve a document at this URL — an empty sitemap is
 * still a served sitemap, and the master prompt requires that no production XML
 * sitemap is generated or publicly served before domain confirmation.
 *
 * When it does serve, it contains only eligible public canonical URLs. Draft
 * localities, unpublished guides and any region hub below three published
 * locality links or two unique sections are excluded by the shared publication
 * gate, evaluated at the request date, not by a separate list that could drift.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Evaluated per request: membership depends on the publication gate and on the
// confirmed-domain configuration, neither of which should be frozen at build.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  if (!isDomainConfirmed() || !isSearchIndexingAllowed()) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }

  // The gate, called with the date of this request — the same decision the pages
  // make, so the sitemap never lists a route that would answer 404.
  const entries = getPublicRoutes(new Date())
    .map((route) => ({ ...route, url: absoluteUrl(route.path) }))
    .filter((route): route is typeof route & { url: string } => route.url !== null);

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((entry) =>
      [
        '  <url>',
        `    <loc>${escapeXml(entry.url)}</loc>`,
        `    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`,
        `    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`,
        '  </url>',
      ].join('\n')
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
