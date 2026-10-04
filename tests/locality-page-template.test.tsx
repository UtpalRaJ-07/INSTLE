/**
 * Task 9.3 — hardening the locality page template.
 * Requirements 1.3, 1.4, 1.5, 1.7, 1.11 and 2.5.
 *
 * Four things are pinned here:
 *
 *  - **The 404 contract.** An unknown slug, a record the gate rejects and an alias
 *    whose canonical record the gate rejects all answer `notFound()` with a noindex
 *    "Page not found" title, and none of the record's summary, sections, FAQ,
 *    mapping values or blocking notes reaches the metadata, the not-found output,
 *    the static params, the public route registry or the sitemap.
 *  - **Aliases.** A request for an alias is resolved to the canonical slug *before*
 *    the gate runs: a live canonical gets a permanent redirect, a failing one gets a
 *    404 rather than a redirect to a 404, and no alias slug appears in static params,
 *    in the sitemap or in any link.
 *  - **What a published page renders.** Every section in full, and every
 *    administrative value inside the same element as its boundary set.
 *  - **Request-date visibility.** Five routes are rendered per request, and moving
 *    the clock past a claim's recheck date or a record's review date withdraws the
 *    page from every surface in the same module instance, with no rebuild.
 *
 * No real record passes the gate, so every positive path runs on fixtures injected
 * the same way `tests/region-hub-route.test.tsx` does: fixture claims layered in
 * front of the live ledger and judged by the real claim gate, and the registry
 * export swapped per test so every accessor and gate that reads it is the real one.
 * The guide case alone uses the live guide registry, moving only the clock.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound, permanentRedirect } from 'next/navigation';

import type { ClaimRecord, SourceRecord } from '@/config/claims';
import type { AdministrativeMapping, LocalityRecord, LocalitySection } from '@/config/localities';

const injected = vi.hoisted(() => ({
  claims: new Map<string, ClaimRecord>(),
  registry: null as readonly LocalityRecord[] | null,
}));

vi.mock('@/config/claims', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/claims')>();
  const getClaim = (claimId: string): ClaimRecord | undefined =>
    injected.claims.get(claimId) ?? actual.getClaim(claimId);
  return {
    ...actual,
    getClaim,
    // Same shape as the real `evaluateClaims`, reading through the layered ledger.
    evaluateClaims: (claimIds: readonly string[], now: Date = new Date()) => {
      const failures: string[] = [];
      for (const claimId of claimIds) {
        const claim = getClaim(claimId);
        if (!claim) {
          failures.push(`${claimId}: no such claim in the ledger.`);
          continue;
        }
        const evaluation = actual.evaluateClaim(claim, now);
        if (!evaluation.eligible) {
          failures.push(...evaluation.failures.map((reason) => `${claimId}: ${reason}`));
        }
      }
      return { eligible: failures.length === 0, failures };
    },
  };
});

vi.mock('@/config/localities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/localities')>();
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return injected.registry ?? actual.LOCALITY_REGISTRY;
    },
  };
});

// A plain anchor: the assertions are about which hrefs the server markup carries.
// `prefetch` is a Link option rather than an anchor attribute, so it is dropped.
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

import { evaluateClaim } from '@/config/claims';
import { getPublishedGuideSlugs } from '@/config/guides';
import {
  LOCALITY_SLUG_ALIASES,
  evaluateLocality,
  getPublishedLocalities,
} from '@/config/localities';
import { MIN_SECTION_WORDS, getPublishedAreaSlugs } from '@/config/locality-sections';
import { groupPublishedLocalities } from '@/lib/locality-grouping';
import { getPublicRoutes } from '@/lib/public-routes';
import { AreaHub } from '@/components/AreaHub/AreaHub';
import NotFound from '@/app/not-found';
import LocalityPage, {
  dynamic as localityPageDynamic,
  generateMetadata,
  generateStaticParams,
} from '@/app/areas/[slug]/page';
import { dynamic as areaHubDynamic } from '@/app/areas/page';
import GuidePage, {
  dynamic as guidePageDynamic,
  generateMetadata as generateGuideMetadata,
  generateStaticParams as generateGuideStaticParams,
} from '@/app/guides/[slug]/page';
import { dynamic as guideHubDynamic } from '@/app/guides/page';
import { GET as sitemapRoute, dynamic as sitemapDynamic } from '@/app/sitemap.xml/route';

const NOW = new Date('2026-09-29T00:00:00.000Z');

/** A real alias from the live table, so the real resolver is what runs. */
const ALIAS = 'indira-nagar';
const ALIAS_CANONICAL = 'indiranagar';

const LIVE_SLUG = 'fixture-live-locality';
const LIVE_NAME = 'Fixture Live Locality';
const MAPPING_CLAIM_ID = 'CLM-FIXTURE-TEMPLATE-MAPPING';
const MAPPING_CLAIM_TEXT = 'FIXTURE-TEMPLATE-MAPPING-CLAIM-TEXT';
const MAPPING_TYPE = 'fixture ward mapping';
const MAPPING_VALUE = 'FIXTURE-TEMPLATE-MAPPING-VALUE';
const BOUNDARY_VERSION = 'FIXTURE-TEMPLATE-BOUNDARY-SET';
/** The live fixture's mapping claim lapses here, before the record's own review. */
const MAPPING_RECHECK_BY = '2027-03-01';
const LIVE_NEXT_REVIEW_AT = '2027-06-01';
/**
 * Carries the live fixture's nearby relationship. A nearby link renders only when its
 * relationship claim passes (Requirement 8.4), and this one outlives the record's own
 * review date, so the review date stays the only thing that lapses in the test below.
 */
const RELATIONSHIP_CLAIM_ID = 'CLM-FIXTURE-TEMPLATE-RELATIONSHIP';
const RELATIONSHIP_RECHECK_BY = '2027-09-01';

const ENV_KEYS = ['INSTLE_PUBLIC_ORIGIN', 'INSTLE_DOMAIN_CONFIRMED', 'INSTLE_DEPLOY_ENV'] as const;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'Example Survey Office',
    independenceGroup: 'example-survey',
    exactUrl: 'https://survey.example.gov/wards/fixture',
    documentReference: null,
    locationInSource: 'Schedule 1, row 12',
    publicationDate: '2026-06-01',
    accessDate: '2026-09-20',
    supportingNote: 'The schedule lists the fixture value.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

function passingClaim(claimId: string): ClaimRecord {
  return {
    claimId,
    claimText: MAPPING_CLAIM_TEXT,
    sources: [
      source(),
      source({
        publisher: 'Example Planning Authority',
        independenceGroup: 'example-planning',
        exactUrl: 'https://planning.example.gov/boundaries/fixture.pdf',
        locationInSource: 'Page 3',
      }),
    ],
    reviewer: 'A. Named Reviewer',
    reviewDate: '2026-09-21',
    conflictingEvidenceNotes: null,
    approvalStatus: 'approved',
    recheckBy: MAPPING_RECHECK_BY,
    usedByRoutes: [`/areas/${LIVE_SLUG}`],
    evidenceGap: null,
  };
}

function paragraphOfWords(words: number, seed: string): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
}

function deepSection(sectionId: string, heading: string, seed: string): LocalitySection {
  return { sectionId, heading, paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, seed)], claimIds: [] };
}

function mapping(overrides: Partial<AdministrativeMapping> = {}): AdministrativeMapping {
  return {
    mappingType: MAPPING_TYPE,
    value: MAPPING_VALUE,
    boundaryVersion: BOUNDARY_VERSION,
    claimId: MAPPING_CLAIM_ID,
    ...overrides,
  };
}

/** Passes the locality gate as it stands. */
function approvedRecord(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: 'LOC-FIXTURE',
    canonicalName: 'Fixture Locality',
    aliases: [],
    entityType: 'locality',
    slug: 'fixture-locality',
    marketingGroup: 'Fixture Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    summary: 'A summary that states no external facts.',
    summaryClaimIds: [],
    sections: [
      deepSection('process', 'What to discuss here?', 'process'),
      deepSection('ready', 'What to have ready?', 'ready'),
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
    nextReviewAt: LIVE_NEXT_REVIEW_AT,
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

/** The published page every positive assertion reads. */
function liveRecord(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return approvedRecord({
    entityId: 'LOC-FIXTURE-LIVE',
    slug: LIVE_SLUG,
    canonicalName: LIVE_NAME,
    summary: 'LIVE-SUMMARY states no external facts.',
    sections: [
      deepSection('live-1', 'LIVE-HEADING-ONE?', 'LIVE-PARAGRAPH-ONE'),
      deepSection('live-2', 'LIVE-HEADING-TWO?', 'LIVE-PARAGRAPH-TWO'),
    ],
    administrativeMappings: [mapping()],
    // Recorded against the alias spelling, so the rendered link shows whether the
    // template resolves it.
    approvedNearbyRelationships: [
      { slug: ALIAS, relationship: 'LIVE-RELATIONSHIP', claimId: RELATIONSHIP_CLAIM_ID },
    ],
    ...overrides,
  });
}

/** A gate-passing record at the alias's canonical slug. */
function liveAliasCanonical(): LocalityRecord {
  return approvedRecord({
    entityId: 'LOC-FIXTURE-ALIAS-CANONICAL',
    slug: ALIAS_CANONICAL,
    canonicalName: 'Fixture Alias Canonical',
    aliases: ['Indira Nagar'],
    sections: [
      deepSection('canon-1', 'What is the canonical page about?', 'canonical-one'),
      deepSection('canon-2', 'What else does it cover?', 'canonical-two'),
    ],
  });
}

const MARKER_FIELDS = [
  'NAME',
  'SUMMARY',
  'HEADING-ONE',
  'PARAGRAPH-ONE',
  'HEADING-TWO',
  'PARAGRAPH-TWO',
  'FAQ-QUESTION',
  'FAQ-ANSWER',
  'MAPPING-VALUE',
  'BOUNDARY',
  'BLOCKING-NOTE',
] as const;

/**
 * A record carrying a distinctive marker in every field Requirement 1.4 names —
 * summary, section headings and paragraphs, FAQ, mapping value and boundary set,
 * blocking note — and in its name. Before `overrides` it passes the gate, so each
 * failing case below fails for the one reason it names.
 */
function markedRecord(prefix: string, overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return approvedRecord({
    entityId: `LOC-${prefix}`,
    slug: `fixture-${prefix.toLowerCase()}`,
    canonicalName: `${prefix}-NAME`,
    summary: `${prefix}-SUMMARY`,
    sections: [
      deepSection(`${prefix}-1`, `${prefix}-HEADING-ONE?`, `${prefix}-PARAGRAPH-ONE`),
      deepSection(`${prefix}-2`, `${prefix}-HEADING-TWO?`, `${prefix}-PARAGRAPH-TWO`),
    ],
    approvedFaq: [{ question: `${prefix}-FAQ-QUESTION?`, answer: `${prefix}-FAQ-ANSWER.`, claimIds: [] }],
    administrativeMappings: [
      mapping({ value: `${prefix}-MAPPING-VALUE`, boundaryVersion: `${prefix}-BOUNDARY` }),
    ],
    blockingNotes: [`${prefix}-BLOCKING-NOTE`],
    ...overrides,
  });
}

function markersOf(prefix: string): string[] {
  return MARKER_FIELDS.map((field) => `${prefix}-${field}`);
}

interface NotFoundCase {
  readonly name: string;
  /** The slug requested. */
  readonly slug: string;
  readonly registry: () => LocalityRecord[];
  /** Text that must reach no surface. */
  readonly markers: readonly string[];
  /** Route slugs that must be absent from params, the route registry and the sitemap. */
  readonly absentSlugs: readonly string[];
}

const NOT_FOUND_CASES: readonly NotFoundCase[] = [
  {
    // The live record's body text must not stand in for a missing page. Its name is
    // not listed: it is published, so the hub links it by name.
    name: 'an unknown slug, while another record is live',
    slug: 'fixture-no-such-place',
    registry: () => [liveRecord()],
    markers: [
      'LIVE-SUMMARY',
      'LIVE-HEADING-ONE',
      'LIVE-PARAGRAPH-ONE',
      'LIVE-HEADING-TWO',
      'LIVE-PARAGRAPH-TWO',
      'LIVE-RELATIONSHIP',
      MAPPING_VALUE,
      BOUNDARY_VERSION,
    ],
    absentSlugs: ['fixture-no-such-place'],
  },
  {
    name: 'a record whose coverage is unconfirmed',
    slug: 'fixture-uncovered',
    registry: () => [liveRecord(), markedRecord('UNCOVERED', { actualServiceCoverage: 'unconfirmed' })],
    markers: markersOf('UNCOVERED'),
    absentSlugs: ['fixture-uncovered'],
  },
  {
    name: 'a record whose review date has passed',
    slug: 'fixture-expired',
    registry: () => [liveRecord(), markedRecord('EXPIRED', { nextReviewAt: '2026-09-01' })],
    markers: markersOf('EXPIRED'),
    absentSlugs: ['fixture-expired'],
  },
  {
    name: 'a record carrying one section (Requirement 1.5)',
    slug: 'fixture-thin',
    registry: () => {
      const thin = markedRecord('THIN');
      return [liveRecord(), { ...thin, sections: thin.sections.slice(0, 1) }];
    },
    markers: markersOf('THIN'),
    absentSlugs: ['fixture-thin'],
  },
  {
    name: `a record whose second section is under ${MIN_SECTION_WORDS} words (Requirement 1.5)`,
    slug: 'fixture-shallow',
    registry: () => {
      const shallow = markedRecord('SHALLOW');
      const [first, second] = shallow.sections;
      return [
        liveRecord(),
        {
          ...shallow,
          sections: [
            first,
            { ...second, paragraphs: [paragraphOfWords(MIN_SECTION_WORDS - 1, 'SHALLOW-PARAGRAPH-TWO')] },
          ],
        },
      ];
    },
    markers: markersOf('SHALLOW'),
    absentSlugs: ['fixture-shallow'],
  },
  {
    name: 'a record whose mapping records no boundary set (Requirements 1.7, 1.14)',
    slug: 'fixture-unversioned',
    registry: () => [
      liveRecord(),
      markedRecord('UNVERSIONED', {
        administrativeMappings: [mapping({ value: 'UNVERSIONED-MAPPING-VALUE', boundaryVersion: null })],
      }),
    ],
    markers: markersOf('UNVERSIONED'),
    absentSlugs: ['fixture-unversioned'],
  },
  {
    name: 'an alias whose canonical record fails the gate (Requirement 1.11)',
    slug: ALIAS,
    registry: () => [
      liveRecord({ approvedNearbyRelationships: [] }),
      markedRecord('ALIASED', {
        slug: ALIAS_CANONICAL,
        aliases: ['Indira Nagar'],
        actualServiceCoverage: 'unconfirmed',
      }),
    ],
    markers: markersOf('ALIASED'),
    absentSlugs: [ALIAS, ALIAS_CANONICAL],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function caughtFrom(action: () => unknown): { digest?: unknown } {
  try {
    action();
  } catch (error) {
    return error as { digest?: unknown };
  }
  throw new Error('expected the action to throw');
}

/** The digests Next attaches, read off the real functions. */
const NOT_FOUND_DIGEST = caughtFrom(() => notFound()).digest;
const REDIRECT_TO_CANONICAL_DIGEST = caughtFrom(() =>
  permanentRedirect(`/areas/${ALIAS_CANONICAL}`)
).digest;

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function confirmDomain() {
  process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
  process.env.INSTLE_DEPLOY_ENV = 'production';
}

async function sitemapBody(): Promise<string> {
  confirmDomain();
  const response = await sitemapRoute();
  expect(response.status).toBe(200);
  return response.text();
}

async function staticParamSlugs(): Promise<string[]> {
  return (await generateStaticParams()).map((entry) => entry.slug);
}

async function renderedLocalityPage(slug: string): Promise<string> {
  return renderToStaticMarkup(await LocalityPage(props(slug)));
}

/** Every `<dd>` text in server markup. Values here carry no nested elements. */
function definitionTexts(markup: string): string[] {
  return [...markup.matchAll(/<dd[^>]*>([^<]*)<\/dd>/g)].map((match) => match[1]);
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  injected.claims.clear();
  injected.claims.set(MAPPING_CLAIM_ID, passingClaim(MAPPING_CLAIM_ID));
  injected.claims.set(RELATIONSHIP_CLAIM_ID, {
    ...passingClaim(RELATIONSHIP_CLAIM_ID),
    recheckBy: RELATIONSHIP_RECHECK_BY,
  });
  // The page, its metadata, its static params and the sitemap read the clock
  // themselves, so the clock is what a test moves.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  injected.registry = null;
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('the fixtures', () => {
  it('layer a mapping claim that passes the real claim gate', () => {
    expect(evaluateClaim(passingClaim(MAPPING_CLAIM_ID), NOW).failures).toEqual([]);
  });

  it('use an alias that is in the live alias table', () => {
    expect(LOCALITY_SLUG_ALIASES[ALIAS]).toBe(ALIAS_CANONICAL);
  });

  it('build live records that pass the gate, and marked records that pass before their override', () => {
    expect(evaluateLocality(liveRecord(), NOW).failures).toEqual([]);
    expect(evaluateLocality(liveAliasCanonical(), NOW).failures).toEqual([]);
    expect(evaluateLocality(markedRecord('SANITY'), NOW).failures).toEqual([]);
  });

  it('build failing cases that the gate rejects', () => {
    for (const { name, registry, absentSlugs } of NOT_FOUND_CASES) {
      const published = getPublishedLocalities(NOW, registry()).map((record) => record.slug);
      for (const slug of absentSlugs) expect(published, name).not.toContain(slug);
    }
  });
});

describe('the rendering mode (Requirement 1.3, 4.13)', () => {
  it('renders every gate-reading route per request, so a withdrawal needs no rebuild', () => {
    expect(localityPageDynamic).toBe('force-dynamic');
    expect(areaHubDynamic).toBe('force-dynamic');
    expect(guidePageDynamic).toBe('force-dynamic');
    expect(guideHubDynamic).toBe('force-dynamic');
    expect(sitemapDynamic).toBe('force-dynamic');
  });
});

describe.each(NOT_FOUND_CASES)('$name', ({ slug, registry, markers, absentSlugs }) => {
  beforeEach(() => {
    injected.registry = registry();
  });

  it('returns 404 from the page — not a redirect, not a partial page', async () => {
    expect(NOT_FOUND_DIGEST).toBeTruthy();
    await expect(LocalityPage(props(slug))).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
  });

  it('carries a noindex "Page not found" title that leaks none of the record', async () => {
    // Domain confirmed, so every field the metadata can carry — canonical, Open
    // Graph URL — is populated and therefore scanned.
    confirmDomain();
    const metadata = await generateMetadata(props(slug));
    expect(String(metadata.title)).toContain('Page not found');
    expect(metadata.robots).toMatchObject({ index: false });

    const serialised = JSON.stringify(metadata);
    for (const marker of markers) expect(serialised, marker).not.toContain(marker);
    for (const absent of absentSlugs.filter((candidate) => candidate !== slug)) {
      expect(serialised, absent).not.toContain(`/areas/${absent}`);
    }
  });

  it('renders a not-found page carrying none of the record', () => {
    const markup = renderToStaticMarkup(<NotFound />);
    for (const marker of markers) expect(markup, marker).not.toContain(marker);
  });

  it('is absent from static params, the public route registry, the sitemap and the hub', async () => {
    const params = await staticParamSlugs();
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    const sitemap = await sitemapBody();
    const hub = renderToStaticMarkup(
      <AreaHub groups={groupPublishedLocalities(getPublishedLocalities(NOW, registry()))} />
    );

    for (const absent of absentSlugs) {
      expect(params, absent).not.toContain(absent);
      expect(paths, absent).not.toContain(`/areas/${absent}`);
      expect(sitemap, absent).not.toContain(`/areas/${absent}<`);
      expect(hub, absent).not.toContain(`href="/areas/${absent}"`);
    }
    for (const marker of markers) {
      expect(sitemap, marker).not.toContain(marker);
      expect(hub, marker).not.toContain(marker);
    }
  });
});

describe('a published locality page', () => {
  beforeEach(() => {
    injected.registry = [liveRecord(), liveAliasCanonical()];
  });

  it('renders every section heading and paragraph in full (Requirement 1.5)', async () => {
    const markup = await renderedLocalityPage(LIVE_SLUG);
    for (const section of liveRecord().sections) {
      expect(markup).toMatch(new RegExp(`<h2[^>]*>${section.heading.replace('?', '\\?')}</h2>`));
      for (const paragraph of section.paragraphs) expect(markup).toContain(`<p>${paragraph}</p>`);
    }
  });

  it('renders each administrative value in the same element as its boundary set (Requirement 1.7)', async () => {
    const markup = await renderedLocalityPage(LIVE_SLUG);
    // The value appears once in the whole response, and that once is inside the
    // <dd> that also carries the boundary set — so it is never shown bare.
    expect(occurrences(markup, MAPPING_VALUE)).toBe(1);
    expect(definitionTexts(markup)).toContain(`${MAPPING_VALUE} (${BOUNDARY_VERSION})`);
    expect(markup).toContain(`<dt`);
    expect(markup).toMatch(new RegExp(`<dt[^>]*>${MAPPING_TYPE}</dt>`));
  });

  it('lists the claim behind the mapping among its sources', async () => {
    expect(await renderedLocalityPage(LIVE_SLUG)).toContain(MAPPING_CLAIM_TEXT);
  });

  it('carries its own title in the metadata', async () => {
    const metadata = await generateMetadata(props(LIVE_SLUG));
    expect(String(metadata.title)).toContain(LIVE_NAME);
  });
});

describe('an alias whose canonical page is live (Requirement 1.11)', () => {
  beforeEach(() => {
    injected.registry = [liveRecord(), liveAliasCanonical()];
  });

  it('permanently redirects to the canonical slug', async () => {
    expect(REDIRECT_TO_CANONICAL_DIGEST).toBeTruthy();
    await expect(LocalityPage(props(ALIAS))).rejects.toMatchObject({
      digest: REDIRECT_TO_CANONICAL_DIGEST,
    });
  });

  it('is served by the canonical slug itself with no redirect', async () => {
    await expect(LocalityPage(props(ALIAS_CANONICAL))).resolves.toBeTruthy();
  });

  it('appears under no alias slug in static params, the route registry or the sitemap', async () => {
    const params = await staticParamSlugs();
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    const sitemap = await sitemapBody();

    expect(params).toContain(ALIAS_CANONICAL);
    expect(paths).toContain(`/areas/${ALIAS_CANONICAL}`);
    expect(sitemap).toContain(`/areas/${ALIAS_CANONICAL}<`);
    for (const alias of Object.keys(LOCALITY_SLUG_ALIASES)) {
      expect(params, alias).not.toContain(alias);
      expect(paths, alias).not.toContain(`/areas/${alias}`);
      expect(sitemap, alias).not.toContain(`/areas/${alias}<`);
    }
  });

  it('is linked by its canonical slug from the hub and from a page that names the alias', async () => {
    const hub = renderToStaticMarkup(
      <AreaHub groups={groupPublishedLocalities(getPublishedLocalities(NOW, [liveRecord(), liveAliasCanonical()]))} />
    );
    const page = await renderedLocalityPage(LIVE_SLUG);

    for (const markup of [hub, page]) {
      expect(markup).toContain(`href="/areas/${ALIAS_CANONICAL}"`);
      for (const alias of Object.keys(LOCALITY_SLUG_ALIASES)) {
        expect(markup, alias).not.toContain(`href="/areas/${alias}"`);
      }
    }
  });
});

describe('visibility follows the request date, with no rebuild (Requirement 1.3, Property 4)', () => {
  async function surfaces(slug: string) {
    const params = await staticParamSlugs();
    const sitemap = await sitemapBody();
    const metadata = await generateMetadata(props(slug));
    return {
      inParams: params.includes(slug),
      inSitemap: sitemap.includes(`/areas/${slug}<`),
      title: String(metadata.title),
    };
  }

  it("withdraws the page from every surface once a claim's recheck date passes", async () => {
    injected.registry = [liveRecord()];

    const before = await surfaces(LIVE_SLUG);
    expect(before).toMatchObject({ inParams: true, inSitemap: true });
    expect(before.title).toContain(LIVE_NAME);
    await expect(LocalityPage(props(LIVE_SLUG))).resolves.toBeTruthy();

    // The mapping claim lapses; the record's own review date has not.
    vi.setSystemTime(new Date('2027-03-02T00:00:00.000Z'));
    const after = await surfaces(LIVE_SLUG);
    expect(after).toMatchObject({ inParams: false, inSitemap: false });
    expect(after.title).toContain('Page not found');
    expect(after.title).not.toContain(LIVE_NAME);
    await expect(LocalityPage(props(LIVE_SLUG))).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    expect(getPublishedAreaSlugs(new Date())).not.toContain(LIVE_SLUG);
  });

  it('withdraws the page from every surface once its own review date passes', async () => {
    // No mapping, so no claim: the record's review date is the only thing that lapses.
    injected.registry = [liveRecord({ administrativeMappings: [] })];

    expect((await surfaces(LIVE_SLUG)).inParams).toBe(true);

    vi.setSystemTime(new Date('2027-06-02T00:00:00.000Z'));
    const after = await surfaces(LIVE_SLUG);
    expect(after).toMatchObject({ inParams: false, inSitemap: false });
    expect(after.title).toContain('Page not found');
    await expect(LocalityPage(props(LIVE_SLUG))).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
  });
});

describe('guides follow the request date too (Requirement 4.13)', () => {
  it('serves a live guide today and 404s it once the review date passes, with no rebuild', async () => {
    const published = getPublishedGuideSlugs(NOW);
    expect(published).toHaveLength(3);
    const [slug] = published;

    await expect(GuidePage(props(slug))).resolves.toBeTruthy();
    expect(String((await generateGuideMetadata(props(slug))).title)).not.toContain('Page not found');

    // Every live guide carries a next review date of 2027-09-29.
    vi.setSystemTime(new Date('2027-10-15T00:00:00.000Z'));
    await expect(GuidePage(props(slug))).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    const metadata = await generateGuideMetadata(props(slug));
    expect(String(metadata.title)).toContain('Page not found');
    expect(metadata.robots).toMatchObject({ index: false });
    expect(await generateGuideStaticParams()).toEqual([]);
  });
});
