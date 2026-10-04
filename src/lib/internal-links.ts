/**
 * Internal_Link_System — Requirement 8.
 *
 * One module decides which links a content page offers a reader and what each one
 * says, so a locality page, a guide page and a service page cannot disagree about
 * what a "related guide" or a "nearby area" is. The pages render what this module
 * returns through `RelatedLinks`; none of them builds a link group of its own.
 *
 * Three groups, and the rules each one keeps:
 *
 *  - **Service pages** relevant to the page (8.1). On a locality page that is every
 *    intent the brokerage has confirmed it offers. A published locality is by
 *    definition a confirmed-served area, so pointing a reader there at buying,
 *    selling, renting and renting out asserts nothing the gate has not already
 *    checked. Commercial is left out: its coverage is on request, not confirmed.
 *  - **Related guides** that pass the guide gate at the request date (8.1, 8.5).
 *  - **Nearby localities** that pass the area gate, each carried by a relationship
 *    statement whose claim passes the claim gate (8.1, 8.4, 8.5). A candidate with
 *    no such statement renders nothing at all — not a link, not a stub.
 *
 * Every group keeps its first six distinct destinations whose link text passes
 * `validateLinkText` (8.2), and a group left with none is dropped entirely, heading
 * and container both (8.9). A link whose text fails is omitted rather than
 * rendered: fail closed. `tests/internal-links.test.tsx` renders every public
 * route and fails if any link anywhere breaks the text rule, so an omission here
 * cannot hide a defect for long.
 *
 * Two further rules live here because they are about links rather than about any
 * one page: the call-action count (8.7) and the footer's composition (8.6).
 */

import {
  CUSTOMER_INTENTS,
  HEADER_NAV_ITEMS,
  NAV_GROUPS,
  PRIMARY_PHONE_TEL,
  type CustomerIntent,
} from '@/config/constants';
import { evaluateClaims } from '@/config/claims';
import {
  getGuideById,
  getPublishedGuidesForIntent,
  isGuidePublishable,
  type GuideRecord,
} from '@/config/guides';
import { resolveLocalitySlug, type LocalityRecord, type NearbyRelationship } from '@/config/localities';
import { getPublishedAreaRecords } from '@/config/locality-sections';
import { isIntentConfirmedOffered } from '@/config/service-matrix';

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/** Requirement 8.1: at most six links in any one group. */
export const MAX_LINKS_PER_GROUP = 6;

/** Requirement 8.2: link text is 2 to 80 characters, counted in code points. */
export const MIN_LINK_TEXT_LENGTH = 2;
export const MAX_LINK_TEXT_LENGTH = 80;

/**
 * Requirement 8.2: link text that says nothing about where the link goes. Exactly
 * the set the requirement names, compared case-insensitively after whitespace is
 * collapsed and leading or trailing punctuation is removed — so "Read more →" and
 * "Click here." are caught along with "read more".
 */
export const GENERIC_LINK_TEXTS: readonly string[] = [
  'click here',
  'read more',
  'learn more',
  'more',
  'here',
  'this page',
  'link',
];

/**
 * Requirement 8.7: a content page carries 1 to 3 call actions.
 *
 * Counted over the page's own content — what the route renders inside `<main>` —
 * and not over the layout shell. The header, the footer and the mobile action bar
 * are the same on every route and already carry a phone link each, and the footer's
 * own allowance is set separately by Requirement 8.6 ("plus one call action"); if
 * the shell were counted, no page could carry fewer than five and the rule could
 * never be met without removing the header phone, which Requirement 5.1 needs in
 * the initial HTML.
 */
export const MIN_CALL_ACTIONS_PER_PAGE = 1;
export const MAX_CALL_ACTIONS_PER_PAGE = 3;

/** Requirement 8.6: the footer carries at most 12 links. */
export const MAX_FOOTER_LINKS = 12;

/** The contact route. A link to it is a call action (8.7). */
export const CONTACT_ROUTE = '/contact';

// ---------------------------------------------------------------------------
// Link text, Requirement 8.2
// ---------------------------------------------------------------------------

export type LinkTextFailure = 'too-short' | 'too-long' | 'generic' | 'bare-url';

/** Whitespace runs collapsed to one space, and trimmed. */
export function normaliseLinkText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function characterCount(text: string): number {
  return [...text].length;
}

/** Lower case, with any leading or trailing run of non-letter, non-digit characters removed. */
function genericComparisonKey(text: string): string {
  return normaliseLinkText(text)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function isGenericLinkText(text: string): boolean {
  return GENERIC_LINK_TEXTS.includes(genericComparisonKey(text));
}

/** `https://…`, `http://…` or any other hierarchical scheme. */
const HIERARCHICAL_URL = /^[a-z][a-z0-9+.-]*:\/\/\S*$/i;
/** `tel:…`, `mailto:…` and the like, printed as the text of their own link. */
const OPAQUE_URL = /^(mailto|tel|sms|callto):\S+$/i;
const WWW_HOST = /^www\.\S+$/i;
/** A host name with a letter-only top-level label, optionally followed by a path. */
const BARE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i;
/** A site path standing in for a description, such as "/areas/indiranagar". */
const BARE_PATH = /^\/\S*$/;

/**
 * True when the whole link text is a URL, a host name or a path. Text that merely
 * contains one among other words is not bare, and a phone number printed as digits
 * is not a URL.
 */
export function isBareUrl(text: string): boolean {
  const value = normaliseLinkText(text);
  if (value.length === 0 || /\s/.test(value)) return false;
  return (
    HIERARCHICAL_URL.test(value) ||
    OPAQUE_URL.test(value) ||
    WWW_HOST.test(value) ||
    BARE_HOST.test(value) ||
    BARE_PATH.test(value)
  );
}

/** Every way `text` breaks Requirement 8.2, or none. */
export function validateLinkText(text: string): readonly LinkTextFailure[] {
  const value = normaliseLinkText(text);
  const length = characterCount(value);
  const failures: LinkTextFailure[] = [];
  if (length < MIN_LINK_TEXT_LENGTH) failures.push('too-short');
  if (length > MAX_LINK_TEXT_LENGTH) failures.push('too-long');
  if (isGenericLinkText(value)) failures.push('generic');
  if (isBareUrl(value)) failures.push('bare-url');
  return failures;
}

export function isValidLinkText(text: string): boolean {
  return validateLinkText(text).length === 0;
}

// ---------------------------------------------------------------------------
// Call actions, Requirement 8.7
// ---------------------------------------------------------------------------

/**
 * True for a link to the phone or to the contact route.
 *
 * Any `tel:` link counts, not only the canonical one: a second spelling of the
 * number would break a brand invariant, but it would still be a call action, and
 * counting it keeps the limit honest.
 */
export function isCallActionHref(href: string): boolean {
  if (href.toLowerCase().startsWith('tel:')) return true;
  const [pathOnly = ''] = href.split(/[?#]/, 1);
  return pathOnly === CONTACT_ROUTE || pathOnly === `${CONTACT_ROUTE}/`;
}

export function countCallActions(hrefs: readonly string[]): number {
  return hrefs.filter(isCallActionHref).length;
}

// ---------------------------------------------------------------------------
// The footer, Requirement 8.6
// ---------------------------------------------------------------------------

/** The footer's one call action: the phone. */
export const FOOTER_CALL_ACTION_HREF = PRIMARY_PHONE_TEL;

/**
 * Every main section the site header renders: its inline navigation and the
 * grouped navigation of its drawer. The brand lockup's home link and the phone
 * link are header furniture rather than sections, so neither is listed.
 */
export function headerSectionHrefs(): ReadonlySet<string> {
  return new Set([
    ...HEADER_NAV_ITEMS.map((item) => item.href),
    ...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
  ]);
}

const INDIVIDUAL_LOCALITY_ROUTE = /^\/areas\/[^/?#]+/;
const INDIVIDUAL_GUIDE_ROUTE = /^\/guides\/[^/?#]+/;

export interface FooterLinkAudit {
  readonly ok: boolean;
  readonly count: number;
  readonly failures: readonly string[];
}

/**
 * Requirement 8.6, over the hrefs a rendered footer carries.
 *
 * At most 12 links; each one a header section or the single call action; and no
 * link to an individual locality or guide, whatever the registries hold.
 */
export function auditFooterLinks(hrefs: readonly string[]): FooterLinkAudit {
  const failures: string[] = [];
  const sections = headerSectionHrefs();

  if (hrefs.length > MAX_FOOTER_LINKS) {
    failures.push(`The footer carries ${hrefs.length} links; at most ${MAX_FOOTER_LINKS} are allowed.`);
  }

  const beyondSections = hrefs.filter((href) => !sections.has(href));
  for (const href of beyondSections) {
    if (href !== FOOTER_CALL_ACTION_HREF) {
      failures.push(`The footer links to ${href}, which is neither a header section nor the call action.`);
    }
  }
  const callActions = beyondSections.filter((href) => href === FOOTER_CALL_ACTION_HREF).length;
  if (callActions > 1) {
    failures.push(`The footer carries ${callActions} phone links; it may carry one call action.`);
  }

  for (const href of hrefs) {
    if (INDIVIDUAL_LOCALITY_ROUTE.test(href)) failures.push(`The footer links to the locality page ${href}.`);
    if (INDIVIDUAL_GUIDE_ROUTE.test(href)) failures.push(`The footer links to the guide page ${href}.`);
  }

  return { ok: failures.length === 0, count: hrefs.length, failures };
}

// ---------------------------------------------------------------------------
// Links and groups
// ---------------------------------------------------------------------------

export interface InternalLink {
  readonly href: string;
  /** The link text: the destination's own name for itself. */
  readonly text: string;
  /**
   * Context rendered beside the link, inside the same list item and outside the
   * anchor, so the link text stays the destination's name. For a nearby locality
   * this is the claim-backed relationship statement (8.11).
   */
  readonly description: string | null;
}

export type LinkGroupKey = 'services' | 'guides' | 'nearby';

export interface LinkGroupHeading {
  readonly eyebrow: string;
  readonly title: string;
}

export interface LinkGroup extends LinkGroupHeading {
  readonly key: LinkGroupKey;
  readonly links: readonly InternalLink[];
}

/** The order the groups render in, which is the order Requirement 8.1 names them. */
export const LINK_GROUP_ORDER: readonly LinkGroupKey[] = ['services', 'guides', 'nearby'];

export const LINK_GROUP_HEADINGS: Readonly<Record<LinkGroupKey, LinkGroupHeading>> = {
  services: { eyebrow: 'Services', title: 'What we can help with' },
  guides: { eyebrow: 'Reading', title: 'Guides that may help' },
  nearby: { eyebrow: 'Nearby', title: 'Areas next to this one' },
};

/**
 * The first link per destination, whose text passes Requirement 8.2, up to six.
 * Order is the caller's, so an editor's ordering of related guides survives.
 */
export function finaliseLinks(links: readonly InternalLink[]): readonly InternalLink[] {
  const seen = new Set<string>();
  const kept: InternalLink[] = [];
  for (const link of links) {
    if (kept.length === MAX_LINKS_PER_GROUP) break;
    if (seen.has(link.href)) continue;
    if (!isValidLinkText(link.text)) continue;
    seen.add(link.href);
    const description = link.description === null ? null : normaliseLinkText(link.description);
    kept.push({ href: link.href, text: normaliseLinkText(link.text), description: description || null });
  }
  return kept;
}

export function buildLinkGroup(
  key: LinkGroupKey,
  links: readonly InternalLink[],
  heading: Partial<LinkGroupHeading> = {}
): LinkGroup {
  return { key, ...LINK_GROUP_HEADINGS[key], ...heading, links: finaliseLinks(links) };
}

/** Only the groups with at least one link, in `LINK_GROUP_ORDER` (8.9). */
export function renderableLinkGroups(groups: readonly LinkGroup[]): readonly LinkGroup[] {
  return [...groups]
    .filter((group) => group.links.length > 0)
    .sort((a, b) => LINK_GROUP_ORDER.indexOf(a.key) - LINK_GROUP_ORDER.indexOf(b.key));
}

// ---------------------------------------------------------------------------
// Service pages
// ---------------------------------------------------------------------------

type ServiceIntent = Exclude<CustomerIntent, 'general'>;

const SERVICE_ROUTES: Readonly<Record<ServiceIntent, string>> = {
  buy: '/buy',
  sell: '/sell',
  rent: '/rent',
  'rent-out': '/rent-out',
  commercial: '/commercial',
};

/** The order service links render in. */
const SERVICE_INTENT_ORDER: readonly ServiceIntent[] = ['buy', 'sell', 'rent', 'rent-out', 'commercial'];

/**
 * The label the site's own navigation gives a route — "Buy property", "Rent a
 * home" — so a service link reads the same in a link group as it does in the
 * drawer and the footer.
 */
function navigationLabel(href: string): string | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.href === href);
    if (item) return item.label;
  }
  return HEADER_NAV_ITEMS.find((item) => item.href === href)?.label ?? null;
}

/** The link to one intent's service page, or null for a general question. */
export function serviceLink(intent: CustomerIntent): InternalLink | null {
  if (intent === 'general') return null;
  const href = SERVICE_ROUTES[intent];
  const text = navigationLabel(href);
  if (!text) return null;
  const description = CUSTOMER_INTENTS.find((definition) => definition.intent === intent)?.audience ?? null;
  return { href, text, description };
}

/**
 * Requirement 8.1: the service pages relevant to a published area. Each intent the
 * service matrix records as confirmed offered; commercial is on request, so it is
 * not offered to a reader as something done in this area.
 */
export function localityServiceLinks(): readonly InternalLink[] {
  return SERVICE_INTENT_ORDER.filter((intent) => isIntentConfirmedOffered(intent))
    .map((intent) => serviceLink(intent))
    .filter((link): link is InternalLink => link !== null);
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

/**
 * A guide's link names the guide by its title — the `<h1>` of the page it opens,
 * which is the destination's subject in its own words.
 */
export function guideLink(guide: GuideRecord): InternalLink {
  return { href: `/guides/${guide.slug}`, text: guide.title, description: null };
}

/**
 * The guides an editor related to a page, in the editor's order, less any that is
 * unknown, is the page itself or fails the guide gate at `now` (8.5).
 */
export function relatedGuideLinks(
  guideIds: readonly string[],
  now: Date = new Date(),
  excludeGuideId: string | null = null
): readonly InternalLink[] {
  return guideIds
    .filter((guideId) => guideId !== excludeGuideId)
    .map((guideId) => getGuideById(guideId))
    .filter((guide): guide is GuideRecord => Boolean(guide))
    .filter((guide) => isGuidePublishable(guide, now))
    .map(guideLink);
}

/** Every published guide for one intent, for the intent's service page. */
export function intentGuideLinks(intent: CustomerIntent, now: Date = new Date()): readonly InternalLink[] {
  return getPublishedGuidesForIntent(intent, now).map(guideLink);
}

// ---------------------------------------------------------------------------
// Nearby localities
// ---------------------------------------------------------------------------

export interface RenderableNearbyRelationship extends NearbyRelationship {
  /** The destination's canonical slug, never an alias. */
  readonly slug: string;
  /** The claim-backed statement of how the two places relate, trimmed. */
  readonly relationship: string;
  /** The claim carrying the statement. It passed the claim gate at `now`. */
  readonly claimId: string;
  /** The destination's canonical name: the link text and the plate label. */
  readonly name: string;
}

/**
 * THE nearby rule. The locality page's nearby links, its orientation plate and the
 * plate's Media_Register entry all read this one list, so a neighbour the page may
 * not link is a neighbour it may not draw or declare either.
 *
 * A recorded relationship survives only when:
 *  - its destination, resolved through the alias table, is a published area record
 *    at `now` and is not the record itself (8.5);
 *  - it carries a non-empty statement whose claim passes the claim gate at `now`
 *    (8.4) — otherwise the adjacency is an unsourced fact and nothing renders;
 *  - the destination's name is usable as link text (8.2);
 *  - it is the first relationship to that destination.
 *
 * `registry` is injectable for tests only; every public caller omits it.
 */
export function renderableNearbyRelationships(
  record: LocalityRecord,
  now: Date = new Date(),
  registry?: readonly LocalityRecord[]
): readonly RenderableNearbyRelationship[] {
  const published = new Map(getPublishedAreaRecords(now, registry).map((entry) => [entry.slug, entry]));
  const seen = new Set<string>();
  const kept: RenderableNearbyRelationship[] = [];

  for (const recorded of record.approvedNearbyRelationships) {
    const slug = resolveLocalitySlug(recorded.slug);
    if (slug === record.slug || seen.has(slug)) continue;

    const destination = published.get(slug);
    if (!destination) continue;

    const relationship = recorded.relationship.trim();
    if (relationship.length === 0) continue;
    if (!recorded.claimId || !evaluateClaims([recorded.claimId], now).eligible) continue;

    if (!isValidLinkText(destination.canonicalName)) continue;

    seen.add(slug);
    kept.push({ slug, relationship, claimId: recorded.claimId, name: destination.canonicalName });
  }

  return kept;
}

/** The nearby group's links, each carrying its relationship statement (8.11). */
export function nearbyLocalityLinks(
  record: LocalityRecord,
  now: Date = new Date(),
  registry?: readonly LocalityRecord[]
): readonly InternalLink[] {
  return renderableNearbyRelationships(record, now, registry).map((relationship) => ({
    href: `/areas/${relationship.slug}`,
    text: relationship.name,
    description: relationship.relationship,
  }));
}

// ---------------------------------------------------------------------------
// The groups each content page renders
// ---------------------------------------------------------------------------

/** Requirement 8.1: a published locality page's three groups. */
export function localityLinkGroups(
  record: LocalityRecord,
  now: Date = new Date(),
  registry?: readonly LocalityRecord[]
): readonly LinkGroup[] {
  return [
    buildLinkGroup('services', localityServiceLinks(), { title: 'What we can help with here' }),
    buildLinkGroup('guides', relatedGuideLinks(record.relatedGuideIds, now)),
    buildLinkGroup('nearby', nearbyLocalityLinks(record, now, registry)),
  ];
}

/** A published guide's groups: its intent's service page and its related guides. */
export function guideLinkGroups(guide: GuideRecord, now: Date = new Date()): readonly LinkGroup[] {
  const service = serviceLink(guide.intent);
  return [
    buildLinkGroup('services', service ? [service] : [], { title: 'Where to start' }),
    buildLinkGroup('guides', relatedGuideLinks(guide.relatedGuideIds, now, guide.guideId), {
      eyebrow: 'Also',
      title: 'Related questions',
    }),
  ];
}

/** A service page's group: the published guides for its intent. */
export function serviceLinkGroups(intent: CustomerIntent, now: Date = new Date()): readonly LinkGroup[] {
  return [buildLinkGroup('guides', intentGuideLinks(intent, now), { title: 'Might be useful' })];
}

// ---------------------------------------------------------------------------
// Link integrity: what counts as an internal link, and how many a page may carry
// Requirements 8.8 and 8.10
// ---------------------------------------------------------------------------

/**
 * Requirement 8.8: a page's server-rendered HTML carries at most 60 internal links,
 * counted across header, main content and footer with a repeated destination
 * counted every time it appears.
 *
 * The count is over the whole served response, so the mobile action bar — which
 * sits outside those three landmarks but in the same HTML — is counted too. The
 * drawer is not: it is rendered only once a reader opens it, so it is not in the
 * HTML a crawler receives.
 */
export const MAX_INTERNAL_LINKS_PER_PAGE = 60;

/**
 * A base no real request can have, used only to resolve a relative href. `.invalid`
 * is reserved (RFC 2606), so a resolved URL on this origin can only have come from
 * a relative or root-relative href. It names no candidate domain for the business.
 */
const RELATIVE_RESOLUTION_ORIGIN = 'http://relative-link.invalid';

/**
 * The site path an `<a href>` opens, with any query and fragment removed — or null
 * when it opens no page of this site.
 *
 * Internal: a root-relative path (`/buy`, `/buy#enquiry`, `/contact?from=home`), a
 * document-relative path resolved against `sourcePath`, and an absolute URL on the
 * confirmed `siteOrigin` when one is supplied. Not internal, and so neither counted
 * nor requested:
 *  - a fragment-only href (`#main-content`): it moves within the page it is on;
 *  - an empty href, for the same reason;
 *  - `tel:`, `mailto:` and every other non-HTTP scheme;
 *  - any other origin, including a protocol-relative `//host/…`.
 *
 * The path is returned exactly as the link spells it. `/buy/` is not normalised to
 * `/buy`: with Next's default `trailingSlash: false` the server answers `/buy/` with
 * a redirect, so treating the two as one would hide a link that is not a 200.
 */
export function internalLinkPath(
  href: string,
  sourcePath: string = '/',
  siteOrigin: string | null = null
): string | null {
  const value = href.trim();
  if (value.length === 0 || value.startsWith('#')) return null;

  const base = `${RELATIVE_RESOLUTION_ORIGIN}${sourcePath.startsWith('/') ? sourcePath : `/${sourcePath}`}`;
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    // Unparseable. A root-relative spelling is still a link into this site, so it
    // is kept — and will then fail to resolve to a page — rather than dropped.
    return value.startsWith('/') && !value.startsWith('//') ? (value.split(/[?#]/, 1)[0] ?? value) : null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const onThisSite = url.origin === RELATIVE_RESOLUTION_ORIGIN || (siteOrigin !== null && url.origin === siteOrigin);
  return onThisSite ? url.pathname : null;
}

export function isInternalHref(href: string, sourcePath: string = '/', siteOrigin: string | null = null): boolean {
  return internalLinkPath(href, sourcePath, siteOrigin) !== null;
}

/** Every internal link among `hrefs`, a repeated destination counted each time (8.8). */
export function countInternalLinks(
  hrefs: readonly string[],
  sourcePath: string = '/',
  siteOrigin: string | null = null
): number {
  return hrefs.filter((href) => isInternalHref(href, sourcePath, siteOrigin)).length;
}

export interface LinkBudgetAudit {
  readonly ok: boolean;
  readonly route: string;
  /** Every internal link in the served HTML. */
  readonly total: number;
  /** The same count, region by region, so a failure says where the links are. */
  readonly byRegion: Readonly<Record<string, number>>;
  readonly failure: string | null;
}

/**
 * Requirement 8.8, over the hrefs each region of one served page carries. The
 * failure names the page and the counted total.
 */
export function auditInternalLinkBudget(
  route: string,
  hrefsByRegion: Readonly<Record<string, readonly string[]>>,
  siteOrigin: string | null = null
): LinkBudgetAudit {
  const byRegion: Record<string, number> = {};
  for (const [region, hrefs] of Object.entries(hrefsByRegion)) {
    byRegion[region] = countInternalLinks(hrefs, route, siteOrigin);
  }
  const total = Object.values(byRegion).reduce((sum, count) => sum + count, 0);
  const ok = total <= MAX_INTERNAL_LINKS_PER_PAGE;
  const breakdown = Object.entries(byRegion)
    .map(([region, count]) => `${region} ${count}`)
    .join(', ');
  return {
    ok,
    route,
    total,
    byRegion,
    failure: ok
      ? null
      : `${route} carries ${total} internal links in its server-rendered HTML (${breakdown}); at most ${MAX_INTERNAL_LINKS_PER_PAGE} are allowed.`,
  };
}

// Requirement 8.3 — superlative-plus-brokerage anchor text on more than one page —
// is a rule of the policy suite rather than of the link system, and its lexicon
// lives with the suite in `tests/helpers/link-integrity.ts`. Kept out of `src/` on
// purpose: every file here is public surface, and a word list spelling out the
// banned phrases would itself trip the superlative scan in
// `tests/public-content.test.ts` (Requirement 3.11).
