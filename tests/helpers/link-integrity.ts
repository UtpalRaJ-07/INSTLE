/**
 * Link integrity as the policy suite checks it — Requirements 8.3 and 8.10.
 *
 * Two rules that are about the site's links as a whole rather than about any one
 * link group, so they live with the suite that fails the build rather than in the
 * link system itself:
 *
 *  - **8.10** Every internal link's destination passes the publication gate and
 *    answers HTTP 200 when requested during the build; a failure names the source
 *    page and the destination route.
 *  - **8.3** Superlative-plus-brokerage anchor text on more than one page fails,
 *    naming each offending page and each matching anchor text.
 *
 * The 8.3 lexicon is kept here, outside `src/`, on purpose. Every file under `src/`
 * is public surface, and a word list spelling out the banned phrases would itself
 * trip the superlative self-description scan in `tests/public-content.test.ts`.
 *
 * Pure apart from the injected `request`: no DOM, no registry, no clock.
 */

import { internalLinkPath, normaliseLinkText } from '@/lib/internal-links';

// ---------------------------------------------------------------------------
// Requirement 8.10 — every destination passes the gate and answers 200
// ---------------------------------------------------------------------------

export interface RouteAnswer {
  readonly status: number;
  readonly detail: string | null;
}

export interface DestinationFinding {
  /** The page the link is on. */
  readonly source: string;
  /** The href as the link spells it. */
  readonly href: string;
  /** The site path it opens: the route that was checked. */
  readonly destination: string;
  readonly problem: string;
}

export const NOT_A_PUBLIC_ROUTE =
  'the destination is not a public route: it fails the publication gate, or it is not a published page at all';

/**
 * Requirement 8.10 for the links on one served page.
 *
 * `publicPaths` is `getPublicRoutes(now)` — the static routes plus every area and
 * guide route the gate admits at `now` — so "passes the gate" is the gate's own
 * answer, not a second list. `request` answers a path the way the router would.
 *
 * Excluded, as they open no page of this site: fragment-only hrefs, `tel:` and
 * other non-HTTP schemes, and other origins (see `internalLinkPath`). A query or
 * fragment on an internal href is dropped before the destination is checked,
 * because the router serves the path regardless. Each distinct href is checked
 * once per page; a destination can fail both halves and is then reported twice.
 */
export async function auditLinkDestinations(
  source: string,
  hrefs: readonly string[],
  publicPaths: ReadonlySet<string>,
  request: (path: string) => Promise<RouteAnswer>,
  siteOrigin: string | null = null
): Promise<DestinationFinding[]> {
  const findings: DestinationFinding[] = [];
  const checked = new Set<string>();
  for (const href of hrefs) {
    if (checked.has(href)) continue;
    checked.add(href);
    const destination = internalLinkPath(href, source, siteOrigin);
    if (destination === null) continue;

    if (!publicPaths.has(destination)) {
      findings.push({ source, href, destination, problem: NOT_A_PUBLIC_ROUTE });
    }
    const answer = await request(destination);
    if (answer.status !== 200) {
      const detail = answer.detail ? ` (${answer.detail})` : '';
      findings.push({ source, href, destination, problem: `the destination returns HTTP ${answer.status}${detail}` });
    }
  }
  return findings;
}

/** One line per finding, naming the source page and the destination route. */
export function describeDestinationFinding(finding: DestinationFinding): string {
  return `${finding.source} links to ${finding.destination} (href "${finding.href}"): ${finding.problem}.`;
}

// ---------------------------------------------------------------------------
// Requirement 8.3 — superlative-plus-brokerage anchor text
// ---------------------------------------------------------------------------

/**
 * The two word sets exactly as Requirement 8.3 names them, compared
 * case-insensitively as whole words.
 *
 * Tolerances, each of which only widens what is caught: "no. 1" also matches
 * "no 1" and "no.1"; "#1" also matches "# 1"; a two-word term matches across a
 * hyphen or any run of whitespace; a brokerage word matches its plural, and
 * "broker" matches "brokerage" — so "No. 1 brokerage" is caught as well as
 * "No. 1 broker".
 */
export const SUPERLATIVE_ANCHOR_WORDS = [
  'best',
  'top',
  'number one',
  'no. 1',
  '#1',
  'leading',
  'finest',
  'greatest',
] as const;

export const BROKERAGE_ANCHOR_WORDS = ['broker', 'agent', 'agency', 'real estate', 'property dealer'] as const;

type SuperlativeWord = (typeof SUPERLATIVE_ANCHOR_WORDS)[number];
type BrokerageWord = (typeof BROKERAGE_ANCHOR_WORDS)[number];

/** Neither a letter nor a digit on this side. */
const BEFORE = '(?<![\\p{L}\\p{N}])';
const AFTER = '(?![\\p{L}\\p{N}])';
const word = (source: string): RegExp => new RegExp(`${BEFORE}${source}${AFTER}`, 'iu');

const SUPERLATIVE_PATTERNS: Readonly<Record<SuperlativeWord, RegExp>> = {
  best: word('best'),
  top: word('top'),
  'number one': word('number[\\s-]+one'),
  'no. 1': word('no\\.?\\s*1'),
  // "#" is not a word character, so only the digit side is bounded.
  '#1': new RegExp('#\\s?1(?!\\p{N})', 'iu'),
  leading: word('leading'),
  finest: word('finest'),
  greatest: word('greatest'),
};

const BROKERAGE_PATTERNS: Readonly<Record<BrokerageWord, RegExp>> = {
  broker: word('broker(?:s|age|ages)?'),
  agent: word('agents?'),
  agency: word('agenc(?:y|ies)'),
  'real estate': word('real[\\s-]+estate'),
  'property dealer': word('property[\\s-]+dealers?'),
};

export interface SuperlativeAnchorMatch {
  readonly superlative: SuperlativeWord;
  readonly brokerage: BrokerageWord;
}

/**
 * The first superlative word and the first brokerage word one anchor text
 * combines, or null unless it carries one of each.
 */
export function matchSuperlativeBrokerageAnchor(text: string): SuperlativeAnchorMatch | null {
  const value = normaliseLinkText(text);
  const superlative = SUPERLATIVE_ANCHOR_WORDS.find((term) => SUPERLATIVE_PATTERNS[term].test(value));
  if (!superlative) return null;
  const brokerage = BROKERAGE_ANCHOR_WORDS.find((term) => BROKERAGE_PATTERNS[term].test(value));
  return brokerage ? { superlative, brokerage } : null;
}

export interface PageAnchorTexts {
  readonly route: string;
  readonly anchorTexts: readonly string[];
}

export interface SuperlativeAnchorFinding extends SuperlativeAnchorMatch {
  readonly route: string;
  readonly text: string;
}

export interface SuperlativeAnchorAudit {
  /** False when such anchor text is on more than one page. */
  readonly ok: boolean;
  /** Every page carrying such anchor text, in the order given. */
  readonly pages: readonly string[];
  /** Every matching anchor text, once per page, with the page it is on. */
  readonly findings: readonly SuperlativeAnchorFinding[];
  readonly failure: string | null;
}

/**
 * Requirement 8.3 across the site.
 *
 * Superlative-plus-brokerage anchor text on one page is not a failure of this
 * rule, which is about the pattern repeating across pages. That is not an
 * allowance: a superlative self-description anywhere in public copy already fails
 * the build under Requirement 3.11, in `tests/public-content.test.ts`.
 */
export function auditSuperlativeAnchors(pages: readonly PageAnchorTexts[]): SuperlativeAnchorAudit {
  const findings: SuperlativeAnchorFinding[] = [];
  for (const { route, anchorTexts } of pages) {
    const seen = new Set<string>();
    for (const raw of anchorTexts) {
      const text = normaliseLinkText(raw);
      if (seen.has(text)) continue;
      seen.add(text);
      const match = matchSuperlativeBrokerageAnchor(text);
      if (match) findings.push({ route, text, ...match });
    }
  }
  const pagesWithFindings = [...new Set(findings.map((finding) => finding.route))];
  const ok = pagesWithFindings.length <= 1;
  return {
    ok,
    pages: pagesWithFindings,
    findings,
    failure: ok
      ? null
      : `Superlative-plus-brokerage anchor text appears on ${pagesWithFindings.length} pages: ${findings
          .map((finding) => `${finding.route} "${finding.text}"`)
          .join('; ')}.`,
  };
}
