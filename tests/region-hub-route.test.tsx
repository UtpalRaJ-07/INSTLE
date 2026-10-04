/**
 * Task 9.4 — gating the region hub route. Requirements 2.7 and 2.9.
 *
 * A `region-hub` record is served under `/areas/[slug]`. While it links to fewer
 * than three published locality pages, or carries fewer than two sections of its
 * own, it must be absent from `generateStaticParams`, from the public route
 * registry, from the served sitemap and from every area link, and its route must
 * return 404 with a noindex "Page not found" title. Once it clears both thresholds
 * it appears on every one of those surfaces. Localities that are not hubs are
 * decided exactly as before.
 *
 * Two injection points, and why each is needed:
 *
 *  - **The claim ledger.** A hub link counts only when its relationship claim
 *    passes the claim gate, and no claim in the live ledger does. Fixture claims are
 *    layered in front of the live ledger; `evaluateClaim` — the claim gate itself —
 *    is the real one, so a fixture claim counts only by genuinely passing it.
 *  - **The locality registry.** The page, its static params and the sitemap take no
 *    registry argument, and the live registry holds no region hub. The registry
 *    export is swapped for a fixture set per test; every accessor and gate that
 *    reads it is the real one.
 *
 * Where a function does take a registry (`getPublishedAreaRecords`,
 * `getPublicRoutes`, `getPublishedLocalities`) the fixture is passed directly.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound } from 'next/navigation';

import type { ClaimRecord, SourceRecord } from '@/config/claims';
import type { LocalityRecord, LocalitySection } from '@/config/localities';

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

// A plain anchor, as in the other rendering tests: the assertion is about which
// hrefs the server markup carries, not about client navigation.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { evaluateClaim } from '@/config/claims';
import {
  LOCALITY_REGISTRY,
  evaluateLocality,
  getPublishedLocalities,
  isLocalityPublishable,
} from '@/config/localities';
import {
  MIN_REGION_HUB_LOCALITY_LINKS,
  MIN_REGION_HUB_UNIQUE_SECTIONS,
  MIN_SECTION_WORDS,
  evaluateRegionHub,
  getPublishedAreaRecordBySlug,
  getPublishedAreaRecords,
  getPublishedAreaSlugs,
  isAreaRecordPublishable,
} from '@/config/locality-sections';
import { getPublicRoutes } from '@/lib/public-routes';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';
import LocalityPage, { generateMetadata, generateStaticParams } from '@/app/areas/[slug]/page';

const NOW = new Date('2026-09-29T00:00:00.000Z');
const HUB_SLUG = 'fixture-east-hub';
const NEIGHBOUR_SLUGS = ['fixture-neighbour-one', 'fixture-neighbour-two', 'fixture-neighbour-three'];
const LINK_CLAIM_IDS = NEIGHBOUR_SLUGS.map((_, index) => `CLM-FIXTURE-HUB-LINK-${index + 1}`);
const MAPPING_CLAIM_ID = 'CLM-FIXTURE-HUB-MAPPING';
/** Carries neighbour one's relationship back to the hub. */
const BACKLINK_CLAIM_ID = 'CLM-FIXTURE-HUB-BACKLINK';

/** Text that exists only on the hub, so a leak is unambiguous. */
const HUB_PRIVATE_TEXT = [
  'FIXTURE-HUB-SUMMARY',
  'FIXTURE-HUB-SECTION-ONE',
  'FIXTURE-HUB-SECTION-TWO',
  'FIXTURE-HUB-FAQ-QUESTION',
  'FIXTURE-HUB-FAQ-ANSWER',
  'FIXTURE-HUB-MAPPING-VALUE',
  'FIXTURE-HUB-BLOCKING-NOTE',
];

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'Example Survey Office',
    independenceGroup: 'example-survey',
    exactUrl: 'https://survey.example.gov/areas/east/relationships',
    documentReference: null,
    locationInSource: 'Table 2, row 4',
    publicationDate: '2026-06-01',
    accessDate: '2026-09-20',
    supportingNote: 'Table lists the two areas as adjoining.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

function passingClaim(claimId: string): ClaimRecord {
  return {
    claimId,
    claimText: 'The two areas adjoin.',
    sources: [
      source(),
      source({
        publisher: 'Example City Planning Authority',
        independenceGroup: 'example-planning',
        exactUrl: 'https://planning.example.gov/reports/2026/east.pdf',
        locationInSource: 'Page 7',
      }),
    ],
    reviewer: 'A. Named Reviewer',
    reviewDate: '2026-09-21',
    conflictingEvidenceNotes: null,
    approvalStatus: 'approved',
    recheckBy: '2027-03-01',
    usedByRoutes: [`/areas/${HUB_SLUG}`],
    evidenceGap: null,
  };
}

function paragraphOfWords(words: number, seed: string): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
}

function deepSection(sectionId: string, heading: string, seed: string): LocalitySection {
  return { sectionId, heading, paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, seed)], claimIds: [] };
}

/** A record that passes the locality gate as it stands. */
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
    // Two, because the locality gate requires two sections at the depth bar (1.5).
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
    nextReviewAt: '2027-03-20',
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

/**
 * Three published localities with text of their own. The first links to the hub,
 * so a rendered locality page shows whether a hub link survives the gate. That
 * relationship carries a claim that passes, because a nearby link renders only when
 * its relationship claim passes (Requirement 8.4) — without one, the hub link would
 * be absent for a reason other than the hub's own gate.
 */
function neighbours(): LocalityRecord[] {
  return NEIGHBOUR_SLUGS.map((slug, index) =>
    approvedRecord({
      entityId: `LOC-FIXTURE-N${index + 1}`,
      slug,
      canonicalName: `Fixture Neighbour ${index + 1}`,
      sections: [
        deepSection(`n${index + 1}`, `What is neighbour ${index + 1} like?`, `neighbour-${index + 1}`),
        deepSection(`n${index + 1}b`, `What to ask in neighbour ${index + 1}?`, `neighbour-${index + 1}-ask`),
      ],
      approvedNearbyRelationships:
        index === 0
          ? [{ slug: HUB_SLUG, relationship: 'is covered by the east hub', claimId: BACKLINK_CLAIM_ID }]
          : [],
    })
  );
}

/** A hub clearing both thresholds: three claim-backed links, two unique deep sections. */
function passingHub(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return approvedRecord({
    entityId: 'LOC-FIXTURE-HUB',
    slug: HUB_SLUG,
    canonicalName: 'Fixture East',
    entityType: 'region-hub',
    summary: 'FIXTURE-HUB-SUMMARY states no external facts.',
    sections: [
      deepSection('h1', 'FIXTURE-HUB-SECTION-ONE?', 'hub-one'),
      deepSection('h2', 'FIXTURE-HUB-SECTION-TWO?', 'hub-two'),
    ],
    approvedFaq: [{ question: 'FIXTURE-HUB-FAQ-QUESTION?', answer: 'FIXTURE-HUB-FAQ-ANSWER.', claimIds: [] }],
    administrativeMappings: [
      {
        mappingType: 'fixture mapping',
        value: 'FIXTURE-HUB-MAPPING-VALUE',
        boundaryVersion: 'fixture boundary set',
        claimId: MAPPING_CLAIM_ID,
      },
    ],
    blockingNotes: ['FIXTURE-HUB-BLOCKING-NOTE'],
    approvedNearbyRelationships: NEIGHBOUR_SLUGS.map((slug, index) => ({
      slug,
      relationship: 'is one of the areas this hub covers',
      claimId: LINK_CLAIM_IDS[index],
    })),
    ...overrides,
  });
}

/**
 * The failing hubs. All but one pass the locality gate, so what removes them from
 * each surface is the region hub gate and nothing else.
 *
 * The exception is the short-section case. Since Task 9.3 the locality gate itself
 * requires every section to clear the depth bar (Requirement 1.5), so that hub is
 * now rejected by both gates. It stays in the table because every surface
 * assertion below must still hold for it.
 */
const FAILING_HUB_CASES: readonly {
  readonly name: string;
  readonly registry: () => LocalityRecord[];
  readonly alsoFailsLocalityGate?: true;
}[] = [
  {
    name: 'links to only two localities',
    registry: () => [
      ...neighbours(),
      passingHub({
        approvedNearbyRelationships: passingHub().approvedNearbyRelationships.slice(0, 2),
      }),
    ],
  },
  {
    name: 'links to three localities, one of which is unpublished',
    registry: () => {
      const [one, two, three] = neighbours();
      return [one, two, { ...three, publicationStatus: 'unpublished' }, passingHub()];
    },
  },
  {
    name: 'links to three localities, one through a relationship with no claim',
    registry: () => [
      ...neighbours(),
      passingHub({
        approvedNearbyRelationships: passingHub().approvedNearbyRelationships.map((relationship, index) =>
          index === 2 ? { ...relationship, claimId: null } : relationship
        ),
      }),
    ],
  },
  {
    name: 'carries one unique section, the other copied from a linked locality',
    registry: () => {
      const localities = neighbours();
      return [
        ...localities,
        passingHub({
          sections: [
            deepSection('h1', 'FIXTURE-HUB-SECTION-ONE?', 'hub-one'),
            { ...localities[0].sections[0], sectionId: 'h2' },
          ],
        }),
      ];
    },
  },
  {
    name: 'carries two sections, one shorter than the section depth bar',
    alsoFailsLocalityGate: true,
    registry: () => [
      ...neighbours(),
      passingHub({
        sections: [
          deepSection('h1', 'FIXTURE-HUB-SECTION-ONE?', 'hub-one'),
          {
            sectionId: 'h2',
            heading: 'FIXTURE-HUB-SECTION-TWO?',
            paragraphs: [paragraphOfWords(MIN_SECTION_WORDS - 1, 'hub-two')],
            claimIds: [],
          },
        ],
      }),
    ],
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

/** The digest Next attaches to `notFound()`, read off the real function. */
const NOT_FOUND_DIGEST = caughtFrom(() => notFound()).digest;

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

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

async function renderedLocalityPage(slug: string): Promise<string> {
  return renderToStaticMarkup(await LocalityPage(props(slug)));
}

function hubOf(registry: readonly LocalityRecord[]): LocalityRecord {
  const hub = registry.find((record) => record.entityType === 'region-hub');
  if (!hub) throw new Error('fixture registry holds no hub');
  return hub;
}

beforeEach(() => {
  injected.claims.clear();
  for (const claimId of [...LINK_CLAIM_IDS, MAPPING_CLAIM_ID, BACKLINK_CLAIM_ID]) {
    injected.claims.set(claimId, passingClaim(claimId));
  }
  // The page, its static params and the sitemap read the clock themselves.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  injected.registry = null;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('the fixtures', () => {
  it('layer claims that pass the real claim gate', () => {
    for (const claimId of [...LINK_CLAIM_IDS, MAPPING_CLAIM_ID]) {
      expect(evaluateClaim(passingClaim(claimId), NOW).failures).toEqual([]);
    }
  });

  it('build a hub that clears the region hub gate', () => {
    const localities = neighbours();
    expect(evaluateRegionHub(passingHub(), localities, NOW).failures).toEqual([]);
  });

  it('build failing hubs that the locality gate alone would admit, bar the short-section case', () => {
    for (const { name, registry, alsoFailsLocalityGate } of FAILING_HUB_CASES) {
      const records = registry();
      const hub = hubOf(records);
      if (alsoFailsLocalityGate) {
        expect(evaluateLocality(hub, NOW).failures.join(' '), name).toContain(
          `carries ${MIN_SECTION_WORDS - 1} words`
        );
      } else {
        expect(evaluateLocality(hub, NOW).failures, name).toEqual([]);
      }
      const published = getPublishedLocalities(NOW, records);
      expect(evaluateRegionHub(hub, published, NOW).eligible, name).toBe(false);
    }
  });

  it(`name the thresholds they sit either side of: ${MIN_REGION_HUB_LOCALITY_LINKS} links, ${MIN_REGION_HUB_UNIQUE_SECTIONS} unique sections`, () => {
    const [links, unpublished, unclaimed, copied, short] = FAILING_HUB_CASES.map(({ registry }) => {
      const records = registry();
      return evaluateRegionHub(hubOf(records), getPublishedLocalities(NOW, records), NOW).failures.join(' ');
    });
    expect(links).toContain('links to 2 published locality page(s)');
    expect(unpublished).toContain('links to 2 published locality page(s)');
    expect(unclaimed).toContain('links to 2 published locality page(s)');
    expect(copied).toContain(`carries 1 section(s) of at least ${MIN_SECTION_WORDS} words`);
    expect(short).toContain(`carries 1 section(s) of at least ${MIN_SECTION_WORDS} words`);
  });
});

describe.each(FAILING_HUB_CASES)('a region hub that $name', ({ registry }) => {
  beforeEach(() => {
    injected.registry = registry();
  });

  it('is not a published area record', () => {
    const records = registry();
    expect(getPublishedAreaSlugs(NOW, records)).not.toContain(HUB_SLUG);
    expect(getPublishedAreaRecordBySlug(HUB_SLUG, NOW, records)).toBeUndefined();
  });

  it('is excluded from generateStaticParams', async () => {
    const params = (await generateStaticParams()).map((entry) => entry.slug);
    expect(params).not.toContain(HUB_SLUG);
  });

  it('is excluded from the public route registry', () => {
    const injectedPaths = getPublicRoutes(NOW, registry()).map((route) => route.path);
    const defaultPaths = getPublicRoutes(NOW).map((route) => route.path);
    expect(injectedPaths).not.toContain(`/areas/${HUB_SLUG}`);
    expect(defaultPaths).not.toContain(`/areas/${HUB_SLUG}`);
  });

  it('is excluded from the served sitemap', async () => {
    expect(await sitemapBody()).not.toContain(`/areas/${HUB_SLUG}<`);
  });

  it('is excluded from area links: the /areas and homepage accessor, and locality pages', async () => {
    expect(getPublishedLocalities(NOW, registry()).map((record) => record.slug)).not.toContain(HUB_SLUG);

    // Neighbour one is published in every case and carries a relationship to the hub.
    const markup = await renderedLocalityPage(NEIGHBOUR_SLUGS[0]);
    expect(markup).toContain('Fixture Neighbour 1');
    expect(markup).not.toContain(`href="/areas/${HUB_SLUG}"`);
  });

  it('returns 404 from the page', async () => {
    expect(NOT_FOUND_DIGEST).toBeTruthy();
    await expect(LocalityPage(props(HUB_SLUG))).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
  });

  it('carries a noindex "Page not found" title that leaks none of its text', async () => {
    const metadata = await generateMetadata(props(HUB_SLUG));
    expect(String(metadata.title)).toContain('Page not found');
    expect(metadata.robots).toMatchObject({ index: false });

    const serialised = JSON.stringify(metadata);
    for (const text of HUB_PRIVATE_TEXT) {
      expect(serialised, text).not.toContain(text);
    }
    expect(serialised).not.toContain(hubOf(registry()).canonicalName);
  });

  it('leaves every published locality published', async () => {
    const records = registry();
    const expected = getPublishedLocalities(NOW, records).map((record) => record.slug);
    expect(expected.length).toBeGreaterThan(0);

    expect(getPublishedAreaSlugs(NOW, records)).toEqual(expected);
    expect((await generateStaticParams()).map((entry) => entry.slug)).toEqual(expected);
    const paths = getPublicRoutes(NOW, records).map((route) => route.path);
    for (const slug of expected) expect(paths).toContain(`/areas/${slug}`);
  });
});

describe('a region hub clearing both thresholds', () => {
  const registry = () => [...neighbours(), passingHub()];

  beforeEach(() => {
    injected.registry = registry();
  });

  it('is a published area record', () => {
    expect(getPublishedAreaSlugs(NOW, registry())).toContain(HUB_SLUG);
    expect(getPublishedAreaRecordBySlug(HUB_SLUG, NOW, registry())?.slug).toBe(HUB_SLUG);
  });

  it('is included in generateStaticParams, the public route registry and the sitemap', async () => {
    expect((await generateStaticParams()).map((entry) => entry.slug)).toContain(HUB_SLUG);
    expect(getPublicRoutes(NOW, registry()).map((route) => route.path)).toContain(`/areas/${HUB_SLUG}`);
    expect(getPublicRoutes(NOW).map((route) => route.path)).toContain(`/areas/${HUB_SLUG}`);
    expect(await sitemapBody()).toContain(`/areas/${HUB_SLUG}<`);
  });

  it('serves its page and its own metadata', async () => {
    await expect(LocalityPage(props(HUB_SLUG))).resolves.toBeTruthy();
    const metadata = await generateMetadata(props(HUB_SLUG));
    expect(String(metadata.title)).toContain('Fixture East');
  });

  it('is linked from a published locality page that relates to it', async () => {
    expect(await renderedLocalityPage(NEIGHBOUR_SLUGS[0])).toContain(`href="/areas/${HUB_SLUG}"`);
  });

  it('is still never returned by the plain locality accessor', () => {
    // `/areas` and the homepage list this accessor, which holds localities only.
    expect(getPublishedLocalities(NOW, registry()).map((record) => record.slug)).not.toContain(HUB_SLUG);
  });

  it('falls out of every surface once its review date passes', async () => {
    vi.setSystemTime(new Date('2027-03-21T00:00:00.000Z'));
    expect(getPublishedAreaSlugs(new Date(), registry())).not.toContain(HUB_SLUG);
    expect((await generateStaticParams()).map((entry) => entry.slug)).not.toContain(HUB_SLUG);
    await expect(LocalityPage(props(HUB_SLUG))).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
  });
});

describe('localities that are not hubs', () => {
  it('are decided by the locality gate alone', () => {
    for (const records of [...FAILING_HUB_CASES.map(({ registry }) => registry()), [...neighbours(), passingHub()]]) {
      const published = getPublishedLocalities(NOW, records);
      for (const record of records.filter((entry) => entry.entityType !== 'region-hub')) {
        expect(isAreaRecordPublishable(record, published, NOW), record.slug).toBe(
          isLocalityPublishable(record, NOW)
        );
      }
    }
  });

  it('are unaffected in the live registry, where nothing publishes and no hub exists', () => {
    expect(LOCALITY_REGISTRY.some((record) => record.entityType === 'region-hub')).toBe(false);
    expect(getPublishedAreaRecords(NOW)).toEqual(getPublishedLocalities(NOW));
    expect(getPublishedAreaRecords(NOW)).toEqual([]);
  });
});
