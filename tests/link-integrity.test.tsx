/**
 * @vitest-environment jsdom
 */

/**
 * Task 10.2 — the build-time link integrity checks. Requirements 8.3, 8.5, 8.8
 * and 8.10.
 *
 * `prebuild` runs this suite, so every failure here stops `next build`. Every
 * public route is rendered as it is served — skip link, header as first served,
 * `<main>`, footer and mobile action bar — and three rules are held over it:
 *
 *  - **8.5, 8.10** Every internal link's destination is a public route at the build
 *    date, which for an area or a guide means the publication gate admits it, and
 *    answers HTTP 200 when requested: its page is resolved and rendered, and a
 *    `notFound()`, a redirect, a path with no page or a thrown error is not a 200.
 *    Each failure names the source page and the destination route.
 *  - **8.8** No served page carries more than 60 internal links, repeats counted.
 *  - **8.3** Superlative-plus-brokerage anchor text appears on at most one page.
 *
 * Each rule runs twice: against the live registries, where no locality passes the
 * gate, and with fixture localities published — so the links that only exist once
 * an area publishes (hub, homepage cards, nearby areas, related guides) are held
 * to the same rules before the first real one does.
 *
 * The last block measures the one place those rules are known to collide with
 * another requirement: Requirement 2.3 lets `/areas` list every published locality
 * in one response, and Requirement 8.8 fails any page over 60 internal links.
 * Neither the requirements nor the design reconcile the two, and no page is
 * exempted here. The block states the published-locality count at which `/areas`
 * — and, on the same arithmetic, the homepage — first fails, so the open decision
 * recorded as D-IMPL-17 in `docs/implementation/DECISION-LOG.md` is taken before
 * that count is reached.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClaimRecord, SourceRecord } from '@/config/claims';
import type { LocalityRecord, LocalitySection, NearbyRelationship } from '@/config/localities';

const injected = vi.hoisted(() => ({
  claims: new Map<string, ClaimRecord>(),
  registry: null as readonly LocalityRecord[] | null,
  pathname: '/',
}));

// Fixture claims layered in front of the live ledger, judged by the real claim gate.
vi.mock('@/config/claims', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/claims')>();
  const getClaim = (claimId: string): ClaimRecord | undefined =>
    injected.claims.get(claimId) ?? actual.getClaim(claimId);
  return {
    ...actual,
    getClaim,
    evaluateClaims: (claimIds: readonly string[], now: Date = new Date()) => {
      const failures: string[] = [];
      for (const claimId of claimIds) {
        const claim = getClaim(claimId);
        if (!claim) {
          failures.push(`${claimId}: no such claim in the ledger.`);
          continue;
        }
        const evaluation = actual.evaluateClaim(claim, now);
        if (!evaluation.eligible) failures.push(...evaluation.failures.map((reason) => `${claimId}: ${reason}`));
      }
      return { eligible: failures.length === 0, failures };
    },
  };
});

/**
 * The registry swapped per test, so every accessor and gate that reads it is the
 * real one. `getPublishedLocalities` is re-pointed as well: it defaults its
 * registry to the module's own binding, which a getter on the export cannot
 * reach, and `/areas` and the homepage list its output. It still runs the real gate.
 */
vi.mock('@/config/localities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/localities')>();
  const live = (): readonly LocalityRecord[] => injected.registry ?? actual.LOCALITY_REGISTRY;
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return live();
    },
    getPublishedLocalities: (now?: Date, registry?: readonly LocalityRecord[]) =>
      actual.getPublishedLocalities(now ?? new Date(), registry ?? live()),
  };
});

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return { ...actual, usePathname: () => injected.pathname };
});

// A plain anchor: the assertions are about the hrefs and text the server sends.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: { href: string; children: React.ReactNode; prefetch?: boolean | null } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PRIMARY_PHONE_TEL } from '@/config/constants';
import { GUIDE_REGISTRY, getGuideById, getPublishedGuides } from '@/config/guides';
import { LOCALITY_REGISTRY, evaluateLocality } from '@/config/localities';
import { MIN_SECTION_WORDS } from '@/config/locality-sections';
import { getPublicOrigin } from '@/config/site';
import {
  MAX_INTERNAL_LINKS_PER_PAGE,
  auditInternalLinkBudget,
  countInternalLinks,
  internalLinkPath,
  type LinkBudgetAudit,
} from '@/lib/internal-links';
import { STATIC_PUBLIC_ROUTES, getPublicRoutes } from '@/lib/public-routes';

import {
  BROKERAGE_ANCHOR_WORDS,
  NOT_A_PUBLIC_ROUTE,
  SUPERLATIVE_ANCHOR_WORDS,
  auditLinkDestinations,
  auditSuperlativeAnchors,
  describeDestinationFinding,
  matchSuperlativeBrokerageAnchor,
  type DestinationFinding,
  type PageAnchorTexts,
} from './helpers/link-integrity';
import {
  SERVED_REGIONS,
  createRouteRequester,
  renderServedPage,
  renderedAnchorTexts,
  renderedLinks,
  requestRoute,
  servedHrefsByRegion,
  servedLinks,
} from './helpers/rendered-routes';

const NOW = new Date('2026-09-29T00:00:00.000Z');

/** Captured while the live registry is in place: 132 records. */
const REGISTRY_SIZE = LOCALITY_REGISTRY.length;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RELATIONSHIP_CLAIM_ID = 'CLM-FIXTURE-INTEGRITY-RELATIONSHIP';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'Example Survey Office',
    independenceGroup: 'example-survey',
    exactUrl: 'https://survey.example.gov/roads/fixture',
    documentReference: null,
    locationInSource: 'Schedule 2, row 4',
    publicationDate: '2026-06-01',
    accessDate: '2026-09-20',
    supportingNote: 'The schedule lists both places on the same road.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

function passingClaim(claimId: string): ClaimRecord {
  return {
    claimId,
    claimText: 'FIXTURE-INTEGRITY-RELATIONSHIP-CLAIM',
    sources: [
      source(),
      source({
        publisher: 'Example Planning Authority',
        independenceGroup: 'example-planning',
        exactUrl: 'https://planning.example.gov/roads/fixture.pdf',
        locationInSource: 'Page 7',
      }),
    ],
    reviewer: 'A. Named Reviewer',
    reviewDate: '2026-09-21',
    conflictingEvidenceNotes: null,
    approvalStatus: 'approved',
    recheckBy: '2027-09-01',
    usedByRoutes: ['/areas/fixture-centre'],
    evidenceGap: null,
  };
}

function deepSection(sectionId: string, heading: string, seed: string): LocalitySection {
  const paragraph = Array.from({ length: MIN_SECTION_WORDS }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
  return { sectionId, heading, paragraphs: [paragraph], claimIds: [] };
}

/** A record that passes the locality gate as it stands, with sections of its own. */
function place(slug: string, canonicalName: string, overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: `LOC-${slug.toUpperCase()}`,
    canonicalName,
    aliases: [],
    entityType: 'locality',
    slug,
    marketingGroup: 'Fixture Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    summary: `${canonicalName} summary, stating no external facts.`,
    summaryClaimIds: [],
    sections: [
      deepSection(`${slug}-1`, `${slug} first question?`, `${slug}-paragraph-one`),
      deepSection(`${slug}-2`, `${slug} second question?`, `${slug}-paragraph-two`),
    ],
    approvedFaq: [],
    approvedNearbyRelationships: [],
    relatedGuideIds: [],
    postalMappingIds: [],
    imageRightsRecords: [],
    author: 'A. Named Author',
    localReviewer: 'A. Named Local Reviewer',
    seoReviewer: 'A. Named SEO Reviewer',
    editorialApprovedAt: '2026-09-20',
    localReviewApprovedAt: '2026-09-20',
    seoReviewApprovedAt: '2026-09-20',
    sourceCheckedAt: '2026-09-20',
    nextReviewAt: '2027-06-01',
    contentUpdatedAt: '2026-09-20',
    editorialStatus: 'approved',
    publicationStatus: 'published',
    blockingNotes: [],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
    ...overrides,
  };
}

function evidenced(slug: string, relationship: string): NearbyRelationship {
  return { slug, relationship, claimId: RELATIONSHIP_CLAIM_ID };
}

/** A real alias from the live table, so the real resolver runs. */
const ALIAS = 'indira-nagar';
const ALIAS_CANONICAL = 'indiranagar';

/** In the live registry and unpublished: an external-fact guide awaiting review. */
const DRAFT_GUIDE_ID = 'GD-BUY-DOCUMENTS';

/**
 * A small published world with every kind of link an area page can carry, and one
 * of every destination it may not: a gate-failing neighbour, an alias spelling,
 * an unpublished guide and an unknown guide.
 */
function fixtureRegistry(): LocalityRecord[] {
  return [
    place('fixture-centre', 'Fixture Centre', {
      relatedGuideIds: ['GD-SELL-PREPARE', DRAFT_GUIDE_ID, 'GD-NO-SUCH-GUIDE', 'GD-RENTOUT-DECISIONS'],
      approvedNearbyRelationships: [
        evidenced('fixture-east', 'Fixture East shares the fixture main road with this area'),
        evidenced(ALIAS, 'Fixture Indiranagar sits on the fixture ring road beside this area'),
        evidenced('fixture-draft', 'Fixture Draft is on the same road but is not published'),
      ],
    }),
    place('fixture-east', 'Fixture East', {
      relatedGuideIds: ['GD-RENTOUT-DECISIONS'],
      approvedNearbyRelationships: [evidenced('fixture-centre', 'Fixture Centre shares the fixture main road')],
    }),
    place(ALIAS_CANONICAL, 'Fixture Indiranagar', { aliases: ['Indira Nagar'], marketingGroup: 'Fixture East side' }),
    place('fixture-draft', 'Fixture Draft', { actualServiceCoverage: 'unconfirmed' }),
  ];
}

/**
 * `count` published localities spread over the real registry's own marketing
 * groups, in the registry's order, so the hub's grouping and 25-link split behave
 * as they would for the real records. Names and slugs are synthetic.
 */
function scaleRegistry(count: number): LocalityRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(3, '0');
    const group = LIVE_GROUPS[index % LIVE_GROUPS.length]!;
    return place(`fixture-scale-${n}`, `Fixture Scale ${n}`, { marketingGroup: group });
  });
}

/** The marketing group of each live record, in registry order. */
const LIVE_GROUPS: readonly string[] = LOCALITY_REGISTRY.map((record) => record.marketingGroup);

const WORLDS = [
  { world: 'the live registries', registry: (): LocalityRecord[] | null => null },
  { world: 'the fixture localities published', registry: (): LocalityRecord[] | null => fixtureRegistry() },
] as const;

beforeEach(() => {
  injected.claims.clear();
  injected.claims.set(RELATIONSHIP_CLAIM_ID, passingClaim(RELATIONSHIP_CLAIM_ID));
  injected.registry = null;
  injected.pathname = '/';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  injected.registry = null;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

async function servedPage(route: string) {
  injected.pathname = route;
  return renderServedPage(route);
}

async function budgetAudit(route: string): Promise<LinkBudgetAudit> {
  const page = await servedPage(route);
  return auditInternalLinkBudget(route, servedHrefsByRegion(page), getPublicOrigin());
}

function publicPaths(): Set<string> {
  return new Set(getPublicRoutes(NOW).map((route) => route.path));
}

// ---------------------------------------------------------------------------
// The counting rule (Requirement 8.8)
// ---------------------------------------------------------------------------

describe('what counts as an internal link (Requirements 8.8, 8.10)', () => {
  it('resolves a root-relative, query-carrying, fragment-carrying or relative href to its site path', () => {
    expect(internalLinkPath('/buy')).toBe('/buy');
    expect(internalLinkPath('/buy#enquiry')).toBe('/buy');
    expect(internalLinkPath('/contact?from=home')).toBe('/contact');
    expect(internalLinkPath('utpal-raj-kb', '/about/')).toBe('/about/utpal-raj-kb');
    expect(internalLinkPath('../buy', '/about/utpal-raj-kb')).toBe('/buy');
  });

  it('keeps the path as the link spells it, so a trailing slash is not quietly treated as the route', () => {
    expect(internalLinkPath('/buy/')).toBe('/buy/');
  });

  it('excludes fragment-only, empty, tel:, mailto: and other-origin hrefs', () => {
    for (const href of ['#main-content', '#enquiry', '', '   ', PRIMARY_PHONE_TEL, 'mailto:someone@example.com']) {
      expect(internalLinkPath(href), href).toBeNull();
    }
    for (const href of ['https://example.com/buy', '//example.com/buy', 'http://example.com']) {
      expect(internalLinkPath(href), href).toBeNull();
    }
  });

  it('counts an absolute URL on the confirmed origin, and only that origin', () => {
    expect(internalLinkPath('https://site.example/areas', '/', 'https://site.example')).toBe('/areas');
    expect(internalLinkPath('https://other.example/areas', '/', 'https://site.example')).toBeNull();
  });

  it('counts every repeat of a destination separately', () => {
    expect(countInternalLinks(['/buy', '/buy', '/buy#enquiry', '#top', PRIMARY_PHONE_TEL, '/contact'])).toBe(4);
  });

  it('passes at exactly 60, fails at 61, and names the page, the total and where the links are', () => {
    const hrefs = (count: number) => Array.from({ length: count }, (_, index) => `/page-${index}`);
    const atLimit = auditInternalLinkBudget('/fixture', { header: hrefs(10), main: hrefs(50) });
    expect(atLimit).toMatchObject({ ok: true, total: MAX_INTERNAL_LINKS_PER_PAGE, failure: null });

    const over = auditInternalLinkBudget('/fixture', { header: hrefs(10), main: hrefs(50), footer: ['/buy'] });
    expect(over.ok).toBe(false);
    expect(over.total).toBe(61);
    expect(over.byRegion).toEqual({ header: 10, main: 50, footer: 1 });
    expect(over.failure).toBe(
      '/fixture carries 61 internal links in its server-rendered HTML (header 10, main 50, footer 1); at most 60 are allowed.'
    );
  });
});

// ---------------------------------------------------------------------------
// The destination rule (Requirements 8.5, 8.10)
// ---------------------------------------------------------------------------

describe('what a request during the build answers (Requirement 8.10)', () => {
  it('answers 200 for every static public route and every published guide', async () => {
    for (const { path } of getPublicRoutes(NOW)) {
      expect(await requestRoute(path), path).toEqual({ status: 200, detail: null });
    }
  });

  it('answers 404 for an unknown path, an unknown area and a gate-failing guide, and 308 for a trailing slash', async () => {
    const draftGuide = getGuideById(DRAFT_GUIDE_ID)!;
    expect((await requestRoute('/no-such-page')).status).toBe(404);
    expect((await requestRoute('/areas/fixture-nowhere')).status).toBe(404);
    expect(await requestRoute(`/guides/${draftGuide.slug}`)).toEqual({
      status: 404,
      detail: 'the page called notFound()',
    });
    expect((await requestRoute('/buy/')).status).toBe(308);
  });

  it('answers 308 for an alias of a published area, because the page redirects rather than serving it', async () => {
    injected.registry = fixtureRegistry();
    expect(await requestRoute(`/areas/${ALIAS}`)).toEqual({
      status: 308,
      detail: `redirects to /areas/${ALIAS_CANONICAL}`,
    });
    expect((await requestRoute(`/areas/${ALIAS_CANONICAL}`)).status).toBe(200);
  });
});

describe('the destination audit names the source page and the destination route (Requirement 8.10)', () => {
  beforeEach(() => {
    injected.registry = fixtureRegistry();
  });

  it('reports a gate-failing area, an alias, an unpublished guide, an unknown page and a trailing slash', async () => {
    const draftGuide = getGuideById(DRAFT_GUIDE_ID)!;
    const findings = await auditLinkDestinations(
      '/fixture-source',
      [
        '/areas/fixture-draft',
        `/areas/${ALIAS}`,
        `/guides/${draftGuide.slug}`,
        '/no-such-page',
        '/buy/',
        // Each of these is fine, or opens no page of this site.
        '/areas/fixture-centre',
        '/buy#enquiry',
        '/contact?from=home',
        '#main-content',
        PRIMARY_PHONE_TEL,
        'https://example.com/elsewhere',
      ],
      publicPaths(),
      createRouteRequester()
    );

    const byDestination = (destination: string) =>
      findings.filter((finding) => finding.destination === destination).map((finding) => finding.problem);

    expect(byDestination('/areas/fixture-draft')).toEqual([
      NOT_A_PUBLIC_ROUTE,
      'the destination returns HTTP 404 (the page called notFound())',
    ]);
    expect(byDestination(`/areas/${ALIAS}`)).toEqual([
      NOT_A_PUBLIC_ROUTE,
      `the destination returns HTTP 308 (redirects to /areas/${ALIAS_CANONICAL})`,
    ]);
    expect(byDestination(`/guides/${draftGuide.slug}`)).toEqual([
      NOT_A_PUBLIC_ROUTE,
      'the destination returns HTTP 404 (the page called notFound())',
    ]);
    expect(byDestination('/no-such-page')).toEqual([
      NOT_A_PUBLIC_ROUTE,
      'the destination returns HTTP 404 (no page is registered for this path)',
    ]);
    expect(byDestination('/buy/')).toEqual([
      NOT_A_PUBLIC_ROUTE,
      'the destination returns HTTP 308 (redirects to /buy (trailing slash))',
    ]);

    // Nothing else is reported: the fine links, the fragment, the phone and the
    // other origin all pass or are out of scope.
    expect(new Set(findings.map((finding) => finding.destination))).toEqual(
      new Set(['/areas/fixture-draft', `/areas/${ALIAS}`, `/guides/${draftGuide.slug}`, '/no-such-page', '/buy/'])
    );
    for (const finding of findings) expect(finding.source).toBe('/fixture-source');
    expect(describeDestinationFinding(findings[0]!)).toBe(
      `/fixture-source links to /areas/fixture-draft (href "/areas/fixture-draft"): ${NOT_A_PUBLIC_ROUTE}.`
    );
  });
});

// ---------------------------------------------------------------------------
// The anchor-text rule (Requirement 8.3)
// ---------------------------------------------------------------------------

describe('superlative-plus-brokerage anchor text (Requirement 8.3)', () => {
  it('uses exactly the two word sets the requirement names', () => {
    expect([...SUPERLATIVE_ANCHOR_WORDS]).toEqual([
      'best',
      'top',
      'number one',
      'no. 1',
      '#1',
      'leading',
      'finest',
      'greatest',
    ]);
    expect([...BROKERAGE_ANCHOR_WORDS]).toEqual(['broker', 'agent', 'agency', 'real estate', 'property dealer']);
  });

  it('matches every pairing of a superlative word with a brokerage word, whatever the case', () => {
    const superlatives = ['Best', 'TOP', 'Number One', 'No. 1', '#1', 'leading', 'Finest', 'GREATEST'];
    const brokerage = ['broker', 'Agent', 'AGENCY', 'Real Estate', 'property dealer'];
    for (const superlative of superlatives) {
      for (const term of brokerage) {
        const text = `${superlative} ${term} in Bengaluru`;
        expect(matchSuperlativeBrokerageAnchor(text), text).not.toBeNull();
      }
    }
  });

  it('catches the familiar forms, plurals and spacing variants', () => {
    for (const text of [
      'best real estate broker in Bengaluru',
      'Top property agent',
      'No. 1 brokerage',
      'no.1 broker',
      'No 1 real-estate agency',
      '# 1 property dealers',
      'The number-one agents in town',
      'Leading real  estate agencies',
    ]) {
      expect(matchSuperlativeBrokerageAnchor(text), text).not.toBeNull();
    }
  });

  it('does not match either word set alone, or a word that merely contains one', () => {
    for (const text of [
      'About INSTLE REAL ESTATE',
      'Buy property',
      'Back to top',
      'Best way to reach us',
      'Stop by the brokerage desk',
      'Desktop agent settings',
      'Topical guides for landlords',
      'Brokers',
      'Call 9353096264',
      'No. 12 Main Road agency',
    ]) {
      expect(matchSuperlativeBrokerageAnchor(text), text).toBeNull();
    }
  });

  it('allows one page, fails two, and names each offending page and each matching anchor text', () => {
    const pages: PageAnchorTexts[] = [
      { route: '/one', anchorTexts: ['Buy property', 'Best real estate broker'] },
      { route: '/two', anchorTexts: ['Sell property'] },
    ];
    expect(auditSuperlativeAnchors(pages)).toMatchObject({ ok: true, pages: ['/one'] });

    pages.push({ route: '/three', anchorTexts: ['Top property agent', 'Top property agent', 'Contact'] });
    const audit = auditSuperlativeAnchors(pages);
    expect(audit.ok).toBe(false);
    expect(audit.pages).toEqual(['/one', '/three']);
    expect(audit.findings).toEqual([
      { route: '/one', text: 'Best real estate broker', superlative: 'best', brokerage: 'broker' },
      { route: '/three', text: 'Top property agent', superlative: 'top', brokerage: 'agent' },
    ]);
    expect(audit.failure).toBe(
      'Superlative-plus-brokerage anchor text appears on 2 pages: /one "Best real estate broker"; /three "Top property agent".'
    );
  });

  it('reads every text an anchor can be read by, including hidden text, labels, titles and image alt', () => {
    const markup = [
      '<a href="/a"><span aria-hidden="true">Best broker</span><span>Home</span></a>',
      '<a href="/b" aria-label="Contact">Top agent</a>',
      '<a href="/c" title="Leading agency">Guides</a>',
      '<a href="/d"><img alt="Number one property dealer" src="/x.png"></a>',
    ].join('');
    const texts = renderedAnchorTexts(markup);
    for (const hidden of ['Best broker Home', 'Top agent', 'Leading agency', 'Number one property dealer']) {
      expect(texts.some((text) => text.includes(hidden)), hidden).toBe(true);
    }
    // Every one of the four anchors is caught, though none says so to a screen reader.
    const audit = auditSuperlativeAnchors([
      { route: '/one', anchorTexts: texts },
      { route: '/two', anchorTexts: texts },
    ]);
    expect(audit.findings.filter((finding) => finding.route === '/one')).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Every public route, as served
// ---------------------------------------------------------------------------

describe.each(WORLDS)('every public route, with $world', ({ registry }) => {
  beforeEach(() => {
    injected.registry = registry();
  });

  it('is rendered in full: the static routes, the published guides and, here, the published areas', () => {
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    for (const route of STATIC_PUBLIC_ROUTES) expect(paths).toContain(route.path);
    expect(paths.filter((path) => path.startsWith('/guides/')).length).toBeGreaterThan(0);
    if (injected.registry) {
      expect(paths).toContain('/areas/fixture-centre');
      expect(paths).not.toContain('/areas/fixture-draft');
      expect(evaluateLocality(injected.registry.find((record) => record.slug === 'fixture-draft')!, NOW).eligible).toBe(
        false
      );
    }
  });

  it('serves the skip link, header, main content, footer and action bar, each with its links', async () => {
    const page = await servedPage('/');
    for (const region of SERVED_REGIONS) {
      expect(page.regions[region].length, region).toBeGreaterThan(0);
    }
    const hrefs = servedHrefsByRegion(page);
    expect(hrefs.skipLink).toEqual(['#main-content']);
    expect(hrefs.header).toContain('/');
    expect(hrefs.footer).toContain(PRIMARY_PHONE_TEL);
    expect(hrefs.actionBar).toContain('/contact');
  });

  it('links only to destinations that pass the gate and answer HTTP 200 (8.5, 8.10)', async () => {
    const allowed = publicPaths();
    const request = createRouteRequester();
    const findings: DestinationFinding[] = [];
    let linksChecked = 0;

    for (const { path } of getPublicRoutes(NOW)) {
      const hrefs = servedLinks(await servedPage(path)).map((link) => link.href);
      linksChecked += countInternalLinks(hrefs, path, getPublicOrigin());
      findings.push(...(await auditLinkDestinations(path, hrefs, allowed, request, getPublicOrigin())));
    }

    expect(linksChecked).toBeGreaterThan(STATIC_PUBLIC_ROUTES.length * 10);
    expect(findings.map(describeDestinationFinding)).toEqual([]);
  });

  it(`carries at most ${MAX_INTERNAL_LINKS_PER_PAGE} internal links on each served page (8.8)`, async () => {
    const audits: LinkBudgetAudit[] = [];
    for (const { path } of getPublicRoutes(NOW)) audits.push(await budgetAudit(path));

    expect(audits.length).toBeGreaterThan(STATIC_PUBLIC_ROUTES.length);
    // Something is counted on every page: the shell alone carries links.
    for (const audit of audits) expect(audit.total, audit.route).toBeGreaterThan(0);
    expect(audits.filter((audit) => !audit.ok).map((audit) => audit.failure)).toEqual([]);
  });

  it('carries superlative-plus-brokerage anchor text on at most one page (8.3)', async () => {
    const pages: PageAnchorTexts[] = [];
    for (const { path } of getPublicRoutes(NOW)) {
      const page = await servedPage(path);
      pages.push({
        route: path,
        anchorTexts: SERVED_REGIONS.flatMap((region) => renderedAnchorTexts(page.regions[region])),
      });
    }
    expect(pages.every((page) => page.anchorTexts.length > 0)).toBe(true);
    const audit = auditSuperlativeAnchors(pages);
    expect(audit.failure).toBeNull();
    expect(audit.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Requirement 2.3 against Requirement 8.8 — the open decision, measured
// ---------------------------------------------------------------------------

/**
 * The counts at which a page first carries more than 60 internal links, measured
 * with the shell and copy as they stand. D-IMPL-17 in
 * `docs/implementation/DECISION-LOG.md` records these numbers; when a change to the
 * shell or the copy moves them, this block fails so the record is corrected with it.
 *
 * The rule itself is not relaxed for any of these pages. When a count is reached,
 * the per-route budget check above fails the build for that page, as it should
 * until the decision is taken.
 */
/** Published localities at which `/areas` first carries 61: its fixed 21, plus one per locality. */
const AREAS_FIRST_OVER_BUDGET_AT = 40;
/** Published localities at which the homepage first carries 61, with today's three guides. */
const HOMEPAGE_FIRST_OVER_BUDGET_AT = 27;
/**
 * The homepage lists every published guide as well as every published locality,
 * both uncapped: it first carries 61 when the two together reach this count.
 */
const HOMEPAGE_FIRST_OVER_BUDGET_AT_COMBINED = 30;
/** Published guides at which `/guides` first carries 61 — above the 36 guide records. */
const GUIDES_HUB_FIRST_OVER_BUDGET_AT = 42;

interface BudgetCrossing {
  /** The first published-locality count at which the page carries more than 60. */
  readonly firstOver: number | null;
  /** The page's total at that count, and at one fewer. */
  readonly totalAtFirstOver: number | null;
  readonly totalBefore: number | null;
}

/** Publish 0, 1, 2 … fixture localities until `route` first exceeds the budget. */
async function firstLocalityCountOverBudget(route: string): Promise<BudgetCrossing> {
  let previous: number | null = null;
  for (let count = 0; count <= REGISTRY_SIZE; count += 1) {
    injected.registry = scaleRegistry(count);
    const { total } = await budgetAudit(route);
    if (total > MAX_INTERNAL_LINKS_PER_PAGE) {
      return { firstOver: count, totalAtFirstOver: total, totalBefore: previous };
    }
    previous = total;
  }
  return { firstOver: null, totalAtFirstOver: null, totalBefore: previous };
}

describe('the link budget as localities publish (Requirements 2.3 and 8.8, open decision D-IMPL-17)', () => {
  it('publishes every scale fixture through the real gate, and the hub lists each once, overflow included', async () => {
    // One group well past 25, so some links sit in the closed <details>.
    injected.registry = scaleRegistry(40).map((record) => ({ ...record, marketingGroup: 'Fixture One Group' }));
    const main = (await servedPage('/areas')).regions.main;
    const areaHrefs = renderedLinks(main)
      .map((link) => link.href)
      .filter((href) => href.startsWith('/areas/'));
    expect(areaHrefs).toHaveLength(40);
    expect(new Set(areaHrefs).size).toBe(40);
    expect(renderedLinks(main.slice(main.indexOf('<details'))).filter((link) => link.href.startsWith('/areas/')))
      .toHaveLength(15);
  });

  it(`finds the published-locality count at which /areas first exceeds ${MAX_INTERNAL_LINKS_PER_PAGE} internal links`, async () => {
    const crossing = await firstLocalityCountOverBudget('/areas');
    expect(crossing.firstOver).not.toBeNull();
    // One more published locality is one more link on the hub, and nothing else moves.
    expect(crossing.totalAtFirstOver! - crossing.totalBefore!).toBe(1);
    expect(crossing.totalBefore).toBe(MAX_INTERNAL_LINKS_PER_PAGE);
    expect(crossing.firstOver).toBeLessThan(REGISTRY_SIZE);
    expect(crossing.firstOver, 'update D-IMPL-17 and this constant together').toBe(AREAS_FIRST_OVER_BUDGET_AT);
  });

  it(`finds the published-locality count at which the homepage first exceeds ${MAX_INTERNAL_LINKS_PER_PAGE} internal links`, async () => {
    const crossing = await firstLocalityCountOverBudget('/');
    expect(crossing.firstOver).not.toBeNull();
    expect(crossing.totalAtFirstOver! - crossing.totalBefore!).toBe(1);
    expect(crossing.totalBefore).toBe(MAX_INTERNAL_LINKS_PER_PAGE);
    expect(crossing.firstOver, 'update D-IMPL-17 and this constant together').toBe(HOMEPAGE_FIRST_OVER_BUDGET_AT);
  });

  /*
   * The guide registry is not swapped for fixtures in this file, so the guide side
   * is measured from the live pages: each lists one link per published guide on a
   * fixed base, and the base is the total less those links.
   */
  it('shares the homepage budget with the guide registry, and keeps /guides inside it at 36 guides', async () => {
    const publishedGuides = getPublishedGuides(NOW).length;
    expect(publishedGuides).toBeGreaterThan(0);

    const fixedBase = async (route: string): Promise<number> => {
      const page = await servedPage(route);
      const guideLinks = renderedLinks(page.regions.main).filter((link) => /^\/guides\/[^/?#]+$/.test(link.href));
      // One link per published guide, and no other link to a guide page.
      expect(guideLinks, route).toHaveLength(publishedGuides);
      const { total } = auditInternalLinkBudget(route, servedHrefsByRegion(page), getPublicOrigin());
      return total - guideLinks.length;
    };

    const homeBase = await fixedBase('/');
    expect(MAX_INTERNAL_LINKS_PER_PAGE - homeBase + 1, 'update D-IMPL-17 and this constant together').toBe(
      HOMEPAGE_FIRST_OVER_BUDGET_AT_COMBINED
    );
    // The same arithmetic as the locality measurement above, from the other side.
    expect(HOMEPAGE_FIRST_OVER_BUDGET_AT_COMBINED - publishedGuides).toBe(HOMEPAGE_FIRST_OVER_BUDGET_AT);
    // At the full guide registry the homepage is over budget with no locality at all.
    expect(GUIDE_REGISTRY.length).toBeGreaterThanOrEqual(HOMEPAGE_FIRST_OVER_BUDGET_AT_COMBINED);

    const guidesBase = await fixedBase('/guides');
    expect(MAX_INTERNAL_LINKS_PER_PAGE - guidesBase + 1, 'update D-IMPL-17 and this constant together').toBe(
      GUIDES_HUB_FIRST_OVER_BUDGET_AT
    );
    expect(GUIDE_REGISTRY.length).toBeLessThan(GUIDES_HUB_FIRST_OVER_BUDGET_AT);
  });
});
