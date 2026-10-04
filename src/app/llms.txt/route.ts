import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { getPublishedGuides } from '@/config/guides';
import { getPublishedAreaRecords } from '@/config/locality-sections';
import { absoluteUrl, getDeployEnvironment, isDomainConfirmed } from '@/config/site';
import { getPublicRoutes } from '@/lib/public-routes';

/**
 * llms.txt. Requirements 6.9 and 6.12.
 *
 * Served only while `INSTLE_DEPLOY_ENV` is `production` and the domain is
 * confirmed (Owner_Input_Register A1, OWN-01). Anywhere else — development, a
 * preview, a production build before the owner confirms the domain — it is a
 * genuine 404, for the same reason the sitemap is a route handler: a file
 * convention would always serve something at this URL.
 *
 * The file may say only what the site already says to a human reader, and may
 * link only to routes that pass the publication gate. So nothing below is a
 * statement of its own:
 *
 *  - the heading is the canonical brand constant;
 *  - the one descriptive sentence is the `/about` page lead, word for word;
 *  - the call line is the phone constant, in the words the `/about`, `/rent` and
 *    `/areas` contact bands open with;
 *  - each guide line is the guide's title and direct answer, which are its page's
 *    H1 and lead;
 *  - each area line is the record's canonical name, which its page's breadcrumb
 *    and heading carry.
 *
 * Guides and areas come from the gate's own accessors, and each URL is emitted
 * only when its path is in `getPublicRoutes` at the same request date, so a record
 * the gate removes leaves this file from the next request with no rebuild.
 * `tests/llms-txt.test.tsx` renders every gate-passing page and fails the build if
 * any line here is not found in one of them, or any URL is not a gate-passing
 * route.
 *
 * The design sketch runs the descriptor and the call line together as one line.
 * That combined sentence appears on no page, so they are two lines here; read as
 * Markdown they are still one paragraph. A section with no entries is left out
 * rather than served as a bare heading, which is the rule the page link groups
 * follow as well.
 */

/** The `/about` page lead, exactly as that page renders it. */
const ABOUT_PAGE_LEAD =
  'A real estate brokerage in Bengaluru, working with people buying, selling, renting and renting out property.';

interface LlmsEntry {
  /** The linked page's own title or name. */
  readonly label: string;
  /** Text the linked page renders, or null for a bare link. */
  readonly note: string | null;
  /** Absolute canonical URL on the confirmed origin. */
  readonly url: string;
}

// Evaluated per request: membership depends on the publication gate at the
// request date and on the confirmed-domain configuration.
export const dynamic = 'force-dynamic';

/** One entry per line, whatever whitespace the record's text carries. */
function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function formatEntry(entry: LlmsEntry): string {
  const label = singleLine(entry.label);
  return entry.note
    ? `- ${label}: ${singleLine(entry.note)}  (${entry.url})`
    : `- ${label}  (${entry.url})`;
}

function section(heading: string, entries: readonly LlmsEntry[]): string[] {
  if (entries.length === 0) return [];
  return ['', `## ${heading}`, ...entries.map(formatEntry)];
}

function buildBody(now: Date): string {
  // The same gate decision the pages, the sitemap and the internal links make.
  const gatePassingPaths = new Set(getPublicRoutes(now).map((route) => route.path));

  const linkTo = (path: string): string | null =>
    gatePassingPaths.has(path) ? absoluteUrl(path) : null;

  const guides = getPublishedGuides(now).flatMap((guide): LlmsEntry[] => {
    const url = linkTo(`/guides/${guide.slug}`);
    return url ? [{ label: guide.title, note: guide.directAnswer, url }] : [];
  });

  const areas = getPublishedAreaRecords(now).flatMap((record): LlmsEntry[] => {
    const url = linkTo(`/areas/${record.slug}`);
    return url ? [{ label: record.canonicalName, note: null, url }] : [];
  });

  return [
    `# ${CANONICAL_BRAND}`,
    '',
    ABOUT_PAGE_LEAD,
    `Call ${PRIMARY_PHONE}.`,
    ...section('Guides', guides),
    ...section('Areas', areas),
    '',
  ].join('\n');
}

export async function GET(): Promise<Response> {
  if (getDeployEnvironment() !== 'production' || !isDomainConfirmed()) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }

  return new Response(buildBody(new Date()), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
