/**
 * Property 2: Every gate-passing record is present on every surface that lists it.
 *
 * *For any* registry and evaluation date, the set of slugs the area hub links, the set
 * `generateStaticParams` returns, the set of locality routes in the sitemap and the set
 * of internal link destinations each equal exactly the set of records the publication
 * gate admits at that date — no surface adds a record the gate rejects, and no surface
 * omits a record the gate admits. Every reported count of published pages equals the
 * cardinality of that same admitted set, and a link whose destination fails the gate or
 * does not return HTTP 200 during the build fails the build naming both the source page
 * and the destination route.
 *
 * **Validates: Requirements 1.3, 1.9, 2.2, 2.6, 8.5, 8.10, 13.1**
 *
 * This is the converse of Property 1. Property 1 proves a rejected record reaches no
 * surface; on its own that is satisfied by a site that publishes nothing. So the two
 * properties are asserted here over the *same* generated scenario, as one set equality
 * per surface rather than two one-way containments: `surfaceSlugs === admittedSlugs`
 * fails if a surface adds a rejected record and fails if it omits an admitted one, and
 * the failure message says which way round it went.
 *
 * The surfaces, and what each equality is over:
 *
 *  - `generateStaticParams` for `/areas/[slug]` and `/guides/[slug]`;
 *  - `getPublicRoutes(now)`, the one registry the sitemap and `llms.txt` read;
 *  - the served sitemap, with the domain confirmed through the environment;
 *  - `/areas` — every admitted slug linked exactly once, visible or inside the
 *    `<details>` element in the same response, because Requirement 2.3 caps a visible
 *    group at `MAX_VISIBLE_LINKS_PER_GROUP` and 2.6 forbids needing a script;
 *  - `/guides`, the homepage, and the five service pages that list guides by intent —
 *    the service pages through the link system, so their equality is against the first
 *    `MAX_LINKS_PER_GROUP` of the admitted set for that intent, which is the bound
 *    Requirement 8.1 sets rather than an omission;
 *  - `llms.txt`, in production with a confirmed domain;
 *  - the related-guide and nearby-locality groups in `src/lib/internal-links.ts`;
 *  - every admitted route answering 200, which is asserted by resolving it: the page
 *    component is called and must not throw `notFound()`;
 *  - `publishedCounts` from `scripts/generate-progress-report.mjs`, whose published
 *    count must equal the gate's admitted cardinality — the Requirement 13.1 clause.
 *
 * Injection, and what it does not replace. Identical to
 * `gate-failing-leaks-nothing.property.test.tsx`, deliberately: the two properties are
 * about one set from two sides and a second injection would let them disagree about
 * what the registry is.
 *
 *  - fixture claims layered in front of the live ledger, judged by the real
 *    `evaluateClaim`;
 *  - `LOCALITY_REGISTRY` swapped through a getter, and `getPublishedLocalities`'
 *    *default argument* swapped too, because the homepage and `/areas` call it with no
 *    registry. The real function and the real gate decide.
 *  - `guides.ts` reads its registry through module-internal bindings, so its accessors
 *    are mirrored over the injected registry, each a one-line filter through the real
 *    `isGuidePublishable`.
 *  - `next/link` rendered as a plain anchor, because every assertion here is about
 *    which `href` the server markup carries.
 *
 * Nothing about the gate itself is mocked. `evaluateLocality`, `evaluateGuide`,
 * `isAreaRecordPublishable`, `evaluateClaim` and `getPublicRoutes` are the shipped
 * functions, and the admitted set every equality is measured against is read from the
 * gate's own accessors — never from the generator's intent. The generator's intent is
 * asserted separately, so a scenario that fails to produce a passing record shows up as
 * a broken generator rather than as a vacuous pass.
 *
 * **Two admitted sets, not one.** Requirements 2.7 and 2.9 make a `region-hub` record
 * an area *route* without making it a locality *link*: `getPublishedLocalities` filters
 * every hub out by entity type, and a hub reaches a public surface only through
 * `getPublishedAreaRecords`. So the equalities below are measured against whichever of
 * the two the surface actually lists — route surfaces against `getPublishedAreaSlugs`,
 * the hub and homepage listings against `getPublishedLocalities` — and the first
 * property asserts that the locality set is a subset of the route set, which is what
 * makes the split a narrowing rather than a second visibility rule. The distinction is
 * recorded in `isPublishedLocalityPage` and pinned by `tests/region-hub-route.test.tsx`;
 * this file would fail if either accessor started admitting what the other rejects in
 * the other direction.
 */

import React from 'react';
import fc from 'fast-check';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound } from 'next/navigation';

import type { ClaimRecord } from '@/config/claims';
import type { GuideRecord } from '@/config/guides';
import type { LocalityRecord } from '@/config/localities';

const injected = vi.hoisted(() => ({
  claims: new Map<string, ClaimRecord>(),
  registry: null as readonly LocalityRecord[] | null,
  guides: null as readonly GuideRecord[] | null,
}));

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
  const current = (): readonly LocalityRecord[] => injected.registry ?? actual.LOCALITY_REGISTRY;
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return current();
    },
    getPublishedLocalities: (now: Date = new Date(), registry: readonly LocalityRecord[] = current()) =>
      actual.getPublishedLocalities(now, registry),
    getPublishedLocalitySlugs: (now: Date = new Date()) =>
      actual.getPublishedLocalities(now, current()).map((record) => record.slug),
  };
});

vi.mock('@/config/guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/guides')>();
  const current = (): readonly GuideRecord[] => injected.guides ?? actual.GUIDE_REGISTRY;
  const published = (now: Date) => current().filter((record) => actual.isGuidePublishable(record, now));
  return {
    ...actual,
    get GUIDE_REGISTRY() {
      return current();
    },
    getPublishedGuides: (now: Date = new Date()) => published(now),
    getPublishedGuideBySlug: (slug: string, now: Date = new Date()) => {
      const record = current().find((candidate) => candidate.slug === slug);
      return record && actual.isGuidePublishable(record, now) ? record : undefined;
    },
    getPublishedGuideSlugs: (now: Date = new Date()) => published(now).map((record) => record.slug),
    getPublishedGuidesForIntent: (intent: GuideRecord['intent'], now: Date = new Date()) =>
      published(now).filter((record) => record.intent === intent),
    getGuideById: (guideId: string) => current().find((record) => record.guideId === guideId),
  };
});

// A plain anchor: every assertion below is about which hrefs the server markup carries.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    prefetch?: boolean | null;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import type { CustomerIntent } from '@/config/constants';
import { evaluateGuide, getPublishedGuideSlugs, getPublishedGuides } from '@/config/guides';
import { evaluateLocality, getPublishedLocalities } from '@/config/localities';
import { getPublishedAreaSlugs, isAreaRecordPublishable } from '@/config/locality-sections';
import { absoluteUrl } from '@/config/site';
import {
  MAX_LINKS_PER_GROUP,
  internalLinkPath,
  localityLinkGroups,
  relatedGuideLinks,
  renderableNearbyRelationships,
  serviceLinkGroups,
} from '@/lib/internal-links';
import { MAX_VISIBLE_LINKS_PER_GROUP, groupPublishedLocalities } from '@/lib/locality-grouping';
import { getPublicRoutes } from '@/lib/public-routes';
import HomePage from '@/app/page';
import AreasPage from '@/app/areas/page';
import LocalityPage, {
  generateStaticParams as generateAreaStaticParams,
} from '@/app/areas/[slug]/page';
import GuidesPage from '@/app/guides/page';
import GuidePage, {
  generateStaticParams as generateGuideStaticParams,
} from '@/app/guides/[slug]/page';
import BuyPage from '@/app/buy/page';
import SellPage from '@/app/sell/page';
import RentPage from '@/app/rent/page';
import RentOutPage from '@/app/rent-out/page';
import CommercialPage from '@/app/commercial/page';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';
import { GET as llmsRoute } from '@/app/llms.txt/route';

import { publishedCounts } from '../../scripts/generate-progress-report.mjs';
import {
  NOT_A_PUBLIC_ROUTE,
  auditLinkDestinations,
  describeDestinationFinding,
  type RouteAnswer,
} from '../helpers/link-integrity';
import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbGatePassingClaimWithId,
  arbGuideGateFailure,
  arbLeakGuideIntent,
  arbLeakSalt,
  arbLocalityGateFailure,
  arbPublishedGuideSet,
  arbPublishedLocalitySet,
  applyGuideGateFailure,
  applyLocalityGateFailure,
  leakRecordMarker,
  markedGateReadyGuide,
  markedGateReadyLocality,
} from './arbitraries';

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

/** The one passing claim every scenario layers, backing every nearby relationship. */
const PASSING_CLAIM_ID = 'CLM-SURFACE-PASSING';

/** Rendering a dozen pages a run, a hundred runs, is slower than the default timeout. */
const PROPERTY_TIMEOUT_MS = 300_000;

/** The five service pages that list guides by intent, with the intent each one serves. */
const SERVICE_PAGES: readonly (readonly [
  route: string,
  intent: Exclude<CustomerIntent, 'general'>,
  page: () => React.ReactElement,
])[] = [
  ['/buy', 'buy', BuyPage],
  ['/sell', 'sell', SellPage],
  ['/rent', 'rent', RentPage],
  ['/rent-out', 'rent-out', RentOutPage],
  ['/commercial', 'commercial', CommercialPage],
];

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

async function render(page: Promise<React.ReactElement> | React.ReactElement): Promise<string> {
  return renderToStaticMarkup(await page);
}

/** Every `href` the server markup carries, in document order, repeats kept. */
function hrefsIn(markup: string): string[] {
  return [...markup.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/** How many times `markup` links exactly `href`. Exact, so `/areas/a` never matches `/areas/ab`. */
function linkCount(markup: string, href: string): number {
  return hrefsIn(markup).filter((candidate) => candidate === href).length;
}

/** The slugs `markup` links under `prefix`, in document order. */
function linkedSlugs(markup: string, prefix: string): string[] {
  return hrefsIn(markup)
    .filter((href) => href.startsWith(prefix))
    .map((href) => href.slice(prefix.length))
    .filter((slug) => slug.length > 0 && !slug.includes('/') && !slug.includes('#'));
}

/** Two collections compared as sets, with a message naming what each side is missing. */
function expectSameSet(surface: string, actual: readonly string[], expected: readonly string[]) {
  const added = actual.filter((value) => !expected.includes(value));
  const omitted = expected.filter((value) => !actual.includes(value));
  expect(added, `${surface} adds records the gate rejects`).toEqual([]);
  expect(omitted, `${surface} omits records the gate admits`).toEqual([]);
  // Set equality alone would accept a surface that links one slug twice, which
  // Requirement 2.2 allows exactly one of.
  expect([...actual].sort(), `${surface} lists a record more than once`).toEqual(
    [...expected].sort()
  );
}

const AREA_LOC = /<loc>[^<]*\/areas\/([^<]+)<\/loc>/g;
const GUIDE_LOC = /<loc>[^<]*\/guides\/([^<]+)<\/loc>/g;

function locEntries(sitemap: string, pattern: RegExp): string[] {
  return [...sitemap.matchAll(pattern)].map((match) => match[1]);
}

/** Each `<details>` block of the served hub, so overflow links can be located in it. */
function detailsBlocks(markup: string): string[] {
  return [...markup.matchAll(/<details[\s\S]*?<\/details>/g)].map((match) => match[0]);
}

/**
 * One record as `scripts/generate-progress-report.mjs` sees it. Only `kind` and
 * `eligible` reach `publishedCounts`; the rest is the shape its typedef requires,
 * and `eligible` is the gate's verdict rather than a stored flag — which is the
 * whole of Requirement 13.1.
 */
function assessmentOf(
  kind: 'locality' | 'guide',
  recordId: string,
  slug: string,
  eligible: boolean
) {
  return {
    recordId,
    kind,
    slug,
    editorialStatus: eligible ? 'approved' : 'draft',
    eligible,
    failures: [] as readonly string[],
    blockingNotes: [] as readonly string[],
  };
}

// ---------------------------------------------------------------------------
// The mixed scenario: records the gate admits, beside records it rejects
// ---------------------------------------------------------------------------

interface MixedScenario {
  readonly now: Date;
  readonly registry: readonly LocalityRecord[];
  readonly guides: readonly GuideRecord[];
  readonly claims: readonly ClaimRecord[];
  /**
   * The records built gate-ready and left alone. The gate is what decides, so this is
   * asserted to be a *subset* of what it admits rather than equal to it: one recorded
   * locality failure mode — `region-hub-below-threshold` — only fails a record while it
   * has fewer than three published neighbours, and a scenario with four passing areas
   * gives it enough. Such a record is then genuinely admitted, and every surface that
   * lists area routes must carry it.
   */
  readonly intendedAreaSlugs: readonly string[];
  readonly intendedGuideSlugs: readonly string[];
}

/** What the gate says about one installed scenario. Read, never assumed. */
interface Admitted {
  /** Every slug `/areas/[slug]` serves: published localities plus any clearing hub. */
  readonly routes: readonly string[];
  /** Published locality pages: the set `/areas` and the homepage list. */
  readonly localityPages: readonly string[];
  readonly guides: readonly string[];
  /** Generated area slugs the gate rejects. Non-empty, or the equalities are weak. */
  readonly rejectedAreas: readonly string[];
  readonly rejectedGuides: readonly string[];
}

function admittedBy(scenario: { readonly now: Date }): Admitted {
  const { now } = scenario;
  const routes = [...getPublishedAreaSlugs(now)];
  const guides = [...getPublishedGuideSlugs(now)];
  const allAreas = (injected.registry ?? []).map((record) => record.slug);
  const allGuides = (injected.guides ?? []).map((record) => record.slug);
  return {
    routes,
    localityPages: getPublishedLocalities(now).map((record) => record.slug),
    guides,
    rejectedAreas: allAreas.filter((slug) => !routes.includes(slug)),
    rejectedGuides: allGuides.filter((slug) => !guides.includes(slug)),
  };
}

/** Any hour of `PROPERTY_NOW`'s day, including its first instant. */
const arbEvaluationInstant: fc.Arbitrary<Date> = fc
  .integer({ min: 0, max: 23 })
  .map((hours) => new Date(PROPERTY_NOW.getTime() + hours * 60 * 60 * 1000));

/**
 * Two to four localities and one to three guides the gate admits, beside one or two
 * of each that it rejects for a recorded reason.
 *
 * Every admitting record relates to every other generated record — guides by id,
 * localities by nearby relationship carried by the one passing claim — so each link
 * group has both a qualifying and a disqualified candidate in it and the group's
 * membership is the gate's answer rather than the list's.
 */
const arbMixedScenario: fc.Arbitrary<MixedScenario> = fc
  .tuple(
    arbLeakSalt,
    arbEvaluationInstant,
    arbGatePassingClaimWithId(PASSING_CLAIM_ID),
    fc.integer({ min: 2, max: 4 }),
    fc.integer({ min: 1, max: 2 }),
    fc.integer({ min: 1, max: 3 }),
    fc.integer({ min: 1, max: 2 })
  )
  .chain(([salt, now, passingClaim, passCount, failCount, guidePassCount, guideFailCount]) =>
    fc
      .tuple(
        fc.tuple(
          ...Array.from({ length: failCount }, (_unused, index) =>
            arbLocalityGateFailure(`CLM-SURF-L${index}`)
          )
        ),
        fc.tuple(
          ...Array.from({ length: guideFailCount }, (_unused, index) =>
            arbGuideGateFailure(`CLM-SURF-G${index}`)
          )
        ),
        fc.array(arbLeakGuideIntent, { minLength: guidePassCount, maxLength: guidePassCount }),
        fc.array(arbLeakGuideIntent, { minLength: guideFailCount, maxLength: guideFailCount }),
        fc.boolean()
      )
      .map(
        ([
          localityFailures,
          guideFailures,
          passingIntents,
          failingIntents,
          rejectedFirst,
        ]): MixedScenario => {
          const passingGuides = passingIntents.map((intent, index) =>
            markedGateReadyGuide(leakRecordMarker('sgp', index, salt), `surface-gpass${index}-${salt}`, intent)
          );
          const rejectedGuides = guideFailures.map((failure, index) =>
            applyGuideGateFailure(
              markedGateReadyGuide(
                leakRecordMarker('sgf', index, salt),
                `surface-gfail${index}-${salt}`,
                failingIntents[index]
              ),
              failure
            )
          );
          const everyGuideId = [...passingGuides, ...rejectedGuides].map((record) => record.guideId);

          const passingSlugs = Array.from({ length: passCount }, (_unused, index) => `surface-pass${index}-${salt}`);
          const rejectedSlugs = localityFailures.map((_unused, index) => `surface-fail${index}-${salt}`);
          // A relationship to every generated place, each carried by the claim that
          // passes — so the only reason to leave a link out is the destination's gate.
          const relationshipsTo = (except: string) =>
            [...passingSlugs, ...rejectedSlugs]
              .filter((slug) => slug !== except)
              .map((slug) => ({
                slug,
                relationship: `sits beside the area served under ${slug}`,
                claimId: PASSING_CLAIM_ID,
              }));

          const passingLocalities = passingSlugs.map((slug, index): LocalityRecord => ({
            ...markedGateReadyLocality(leakRecordMarker('slp', index, salt), slug, PASSING_CLAIM_ID),
            relatedGuideIds: everyGuideId,
            approvedNearbyRelationships: relationshipsTo(slug),
          }));
          const rejectedLocalities = localityFailures.map((failure, index) =>
            applyLocalityGateFailure(
              {
                ...markedGateReadyLocality(
                  leakRecordMarker('slf', index, salt),
                  rejectedSlugs[index],
                  PASSING_CLAIM_ID
                ),
                relatedGuideIds: everyGuideId,
                approvedNearbyRelationships: relationshipsTo(rejectedSlugs[index]),
              },
              failure
            )
          );

          const localities = rejectedFirst
            ? [...rejectedLocalities, ...passingLocalities]
            : [...passingLocalities, ...rejectedLocalities];
          const guides = rejectedFirst
            ? [...rejectedGuides, ...passingGuides]
            : [...passingGuides, ...rejectedGuides];

          return {
            now,
            registry: localities,
            guides,
            claims: [
              passingClaim,
              ...localityFailures.flatMap((failure) => [failure.failingClaim, failure.deskReviewedClaim]),
              ...guideFailures.map((failure) => failure.failingClaim),
            ],
            intendedAreaSlugs: passingSlugs,
            intendedGuideSlugs: passingGuides.map((record) => record.slug),
          };
        }
      )
  );

function install(scenario: {
  readonly now: Date;
  readonly registry: readonly LocalityRecord[];
  readonly guides: readonly GuideRecord[];
  readonly claims: readonly ClaimRecord[];
}) {
  injected.claims.clear();
  for (const claim of scenario.claims) injected.claims.set(claim.claimId, claim);
  injected.registry = scenario.registry;
  injected.guides = scenario.guides;
  vi.setSystemTime(scenario.now);
  confirmDomain();
}

beforeEach(() => {
  injected.claims.clear();
  injected.registry = null;
  injected.guides = null;
  // Every page, param list, route registry and served file reads the clock itself.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PROPERTY_NOW);
});

afterEach(() => {
  injected.claims.clear();
  injected.registry = null;
  injected.guides = null;
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 2: every gate-passing record is present on every surface that lists it', () => {
  describe('the generators', () => {
    it('produce both an admitted and a rejected record of each kind, so no equality is vacuous', () => {
      const scenarios = fc.sample(arbMixedScenario, { ...PROPERTY_RUN_CONFIG, seed: 2 });
      let sawRejectedArea = 0;
      let sawRejectedGuide = 0;
      for (const scenario of scenarios) {
        install(scenario);
        const admitted = admittedBy(scenario);

        // The gate-ready baselines really do pass, on both accessors: a passing record
        // carries no failure mode, so it stays a locality and is a page as well as a route.
        for (const slug of scenario.intendedAreaSlugs) {
          expect(admitted.routes, `the gate rejects the gate-ready ${slug}`).toContain(slug);
          expect(admitted.localityPages, `${slug} is a route but not a locality page`).toContain(slug);
        }
        for (const slug of scenario.intendedGuideSlugs) {
          expect(admitted.guides, `the gate rejects the gate-ready ${slug}`).toContain(slug);
        }

        // The narrowing runs one way only: every locality page is an area route.
        for (const slug of admitted.localityPages) expect(admitted.routes).toContain(slug);

        if (admitted.rejectedAreas.length > 0) sawRejectedArea += 1;
        if (admitted.rejectedGuides.length > 0) sawRejectedGuide += 1;
      }
      // Most runs carry a rejected record of each kind, so the "no surface adds a
      // rejected record" half is exercised rather than merely stated.
      expect(sawRejectedArea).toBeGreaterThan(scenarios.length / 2);
      expect(sawRejectedGuide).toBe(scenarios.length);
    }, PROPERTY_TIMEOUT_MS);

    it('draw registry-scale sets whose groups overflow the visible cap, so <details> is reached', () => {
      const sets = fc.sample(arbPublishedLocalitySet, { ...PROPERTY_RUN_CONFIG, seed: 3 });
      const overflowing = sets.filter((records) =>
        groupPublishedLocalities(records).some((group) => group.overflowLinks.length > 0)
      );
      expect(overflowing.length, 'no generated set exceeds 25 links in any group').toBeGreaterThan(0);
    }, PROPERTY_TIMEOUT_MS);
  });

  // -------------------------------------------------------------------------
  // (1) Every surface's set equals the gate's admitted set
  // -------------------------------------------------------------------------

  it(
    'lists exactly the admitted set on every surface, and resolves every admitted route',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbMixedScenario, async (scenario) => {
          install(scenario);
          const { now } = scenario;

          // THE admitted sets: read from the gate's own accessors at the request date.
          const admitted = admittedBy(scenario);
          const admittedAreas = admitted.routes;
          const admittedGuides = admitted.guides;
          const rejected = [...admitted.rejectedAreas, ...admitted.rejectedGuides];
          expect(admittedAreas.length, 'the scenario admits at least two areas').toBeGreaterThanOrEqual(2);
          expect(admittedGuides.length, 'the scenario admits at least one guide').toBeGreaterThanOrEqual(1);

          // Static params.
          expectSameSet(
            '/areas/[slug] generateStaticParams',
            (await generateAreaStaticParams()).map((entry) => entry.slug),
            admittedAreas
          );
          expectSameSet(
            '/guides/[slug] generateStaticParams',
            (await generateGuideStaticParams()).map((entry) => entry.slug),
            admittedGuides
          );

          // The public route registry.
          const paths = getPublicRoutes(now).map((route) => route.path);
          expectSameSet(
            'getPublicRoutes area routes',
            paths.filter((path) => path.startsWith('/areas/')).map((path) => path.slice('/areas/'.length)),
            admittedAreas
          );
          expectSameSet(
            'getPublicRoutes guide routes',
            paths.filter((path) => path.startsWith('/guides/')).map((path) => path.slice('/guides/'.length)),
            admittedGuides
          );

          // The served sitemap, on the confirmed origin.
          const sitemapResponse = await sitemapRoute();
          expect(sitemapResponse.status).toBe(200);
          const sitemap = await sitemapResponse.text();
          expectSameSet('the sitemap', locEntries(sitemap, AREA_LOC), admittedAreas);
          expectSameSet('the sitemap', locEntries(sitemap, GUIDE_LOC), admittedGuides);

          // llms.txt, which is served only in production with a confirmed domain.
          const llmsResponse = await llmsRoute();
          expect(llmsResponse.status).toBe(200);
          const llms = await llmsResponse.text();
          for (const slug of admittedAreas) {
            expect(llms, `llms.txt omits /areas/${slug}`).toContain(absoluteUrl(`/areas/${slug}`));
          }
          for (const slug of admittedGuides) {
            expect(llms, `llms.txt omits /guides/${slug}`).toContain(absoluteUrl(`/guides/${slug}`));
          }
          for (const slug of rejected) {
            expect(llms, `llms.txt names the rejected ${slug}`).not.toContain(slug);
          }

          // The area hub and the homepage list published locality *pages*, which is the
          // narrower of the two admitted sets: a region hub is an area route and not a
          // locality link. Requirement 2.2: one crawlable text link per slug.
          const hub = await render(<AreasPage />);
          const guideHub = await render(<GuidesPage />);
          const home = await render(<HomePage />);
          expectSameSet('/areas', linkedSlugs(hub, '/areas/'), admitted.localityPages);
          expectSameSet('the homepage', linkedSlugs(home, '/areas/'), admitted.localityPages);
          expectSameSet('/guides', linkedSlugs(guideHub, '/guides/'), admittedGuides);
          expectSameSet('the homepage', linkedSlugs(home, '/guides/'), admittedGuides);
          for (const group of groupPublishedLocalities(getPublishedLocalities(now))) {
            expect(group.visibleLinks.length, group.marketingGroup).toBeLessThanOrEqual(
              MAX_VISIBLE_LINKS_PER_GROUP
            );
          }

          // The service pages list guides by intent through the link system, so the
          // expected set is the admitted set for that intent capped at six (8.1).
          const serviceMarkup = new Map<string, string>();
          for (const [route, intent, Page] of SERVICE_PAGES) {
            const markup = await render(<Page />);
            serviceMarkup.set(route, markup);
            const expected = getPublishedGuides(now)
              .filter((record) => record.intent === intent)
              .map((record) => record.slug)
              .slice(0, MAX_LINKS_PER_GROUP);
            expectSameSet(route, linkedSlugs(markup, '/guides/'), expected);
            // The group the page renders is the group the module built, not a copy.
            const group = serviceLinkGroups(intent, now).find((candidate) => candidate.key === 'guides');
            expect(group?.links.map((link) => link.href.slice('/guides/'.length)) ?? [], route).toEqual(
              expected
            );
          }

          // Every admitted route answers 200: the component is called and must not
          // throw `notFound()`. The markup is kept, so each page is rendered once.
          const pageMarkup = new Map<string, string>();
          for (const slug of admittedAreas) {
            pageMarkup.set(`/areas/${slug}`, await render(LocalityPage(props(slug))));
          }
          for (const slug of admittedGuides) {
            pageMarkup.set(`/guides/${slug}`, await render(GuidePage(props(slug))));
          }

          // The internal link groups (8.5): each group is the admitted candidates in
          // the editor's order, capped at six — and no rejected candidate at all.
          const slugOfGuideId = new Map((injected.guides ?? []).map((record) => [record.guideId, record.slug]));
          for (const slug of admittedAreas) {
            const record = (injected.registry ?? []).find((candidate) => candidate.slug === slug);
            expect(record, slug).toBeDefined();
            const markup = pageMarkup.get(`/areas/${slug}`) as string;

            // The editor's order, filtered by the gate, capped at six. Stated from the
            // record's own lists rather than from the admitted set, because the cap
            // takes the *first* six the editor recorded.
            const expectedGuides = record!.relatedGuideIds
              .map((guideId) => slugOfGuideId.get(guideId))
              .filter((candidate): candidate is string => Boolean(candidate) && admittedGuides.includes(candidate!))
              .slice(0, MAX_LINKS_PER_GROUP);
            expect(
              relatedGuideLinks(record!.relatedGuideIds, now).map((link) => link.href.slice('/guides/'.length)),
              `${slug} related guides`
            ).toEqual(expectedGuides);

            const expectedNearby = record!.approvedNearbyRelationships
              .map((relationship) => relationship.slug)
              .filter((other) => other !== slug && admittedAreas.includes(other))
              .slice(0, MAX_LINKS_PER_GROUP);
            expect(
              renderableNearbyRelationships(record!, now).map((relationship) => relationship.slug),
              `${slug} nearby`
            ).toEqual(expectedNearby);

            // And the page renders every link of every group it built. Counted as "at
            // least once": Requirement 8.8 counts a repeated destination each time, and
            // a locality page legitimately links `/buy` from both its action row and
            // its service group.
            for (const group of localityLinkGroups(record!, now)) {
              for (const link of group.links) {
                expect(
                  linkCount(markup, link.href),
                  `/areas/${slug} omits ${link.href} from group ${group.key}`
                ).toBeGreaterThanOrEqual(1);
              }
            }
            for (const other of rejected) {
              expect(markup, `/areas/${slug} links the rejected ${other}`).not.toContain(`/${other}"`);
            }
          }

          // Requirement 8.10, the positive half: every internal link on every surface
          // rendered above opens a route the gate admits, and that route answers 200.
          const publicPaths = new Set(paths);
          const answer = async (path: string): Promise<RouteAnswer> =>
            pageMarkup.has(path) || publicPaths.has(path)
              ? { status: 200, detail: null }
              : { status: 404, detail: 'notFound()' };
          const surfaces: [string, string][] = [
            ['/areas', hub],
            ['/guides', guideHub],
            ['/', home],
            ...[...serviceMarkup].map(([route, markup]): [string, string] => [route, markup]),
            ...[...pageMarkup].map(([route, markup]): [string, string] => [route, markup]),
          ];
          for (const [route, markup] of surfaces) {
            const findings = await auditLinkDestinations(route, hrefsIn(markup), publicPaths, answer);
            expect(findings.map(describeDestinationFinding), route).toEqual([]);
          }

          // Requirement 13.1: the report's published count is the gate's cardinality.
          // `eligible` is computed here by calling the gate directly — through
          // `isAreaRecordPublishable` and `evaluateGuide`, not through the accessors the
          // surfaces read — so the two sides arrive at the number by different paths.
          const publishedLocalityPages = getPublishedLocalities(now);
          const counts = publishedCounts([
            ...(injected.registry ?? []).map((record) =>
              assessmentOf(
                'locality',
                record.entityId,
                record.slug,
                isAreaRecordPublishable(record, publishedLocalityPages, now)
              )
            ),
            ...(injected.guides ?? []).map((record) =>
              assessmentOf('guide', record.guideId, record.slug, evaluateGuide(record, now).eligible)
            ),
          ]);
          expect(counts.localities).toBe(admittedAreas.length);
          expect(counts.guides).toBe(admittedGuides.length);
          expect(counts.publishedPageCount).toBe(admittedAreas.length + admittedGuides.length);
          expect(counts.publishedPageCount).toBe(
            locEntries(sitemap, AREA_LOC).length + locEntries(sitemap, GUIDE_LOC).length
          );
        }),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  // -------------------------------------------------------------------------
  // (2) Requirement 8.10, the reported half
  // -------------------------------------------------------------------------

  it(
    'names both the source page and the destination route when a link opens a gate-failing record',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbMixedScenario, async (scenario) => {
          install(scenario);
          const { now } = scenario;
          const admitted = admittedBy(scenario);
          // Not every scenario draws a rejected area: one recorded failure mode only
          // fails a record below three published neighbours. Skip those runs rather
          // than assert something weaker on them.
          fc.pre(admitted.rejectedAreas.length > 0);

          const publicPaths = new Set(getPublicRoutes(now).map((route) => route.path));
          const rejectedSlug = admitted.rejectedAreas[0];
          const destination = `/areas/${rejectedSlug}`;

          // The destination really does 404 when requested, so the audit below is
          // reporting a fact about the route rather than about its own list.
          await expect(LocalityPage(props(rejectedSlug))).rejects.toMatchObject({
            digest: NOT_FOUND_DIGEST,
          });

          const findings = await auditLinkDestinations('/areas', [destination], publicPaths, async (path) =>
            publicPaths.has(path) ? { status: 200, detail: null } : { status: 404, detail: null }
          );
          expect(findings.length).toBeGreaterThan(0);
          for (const finding of findings) {
            expect(finding.source).toBe('/areas');
            expect(finding.destination).toBe(destination);
            expect(describeDestinationFinding(finding)).toContain('/areas');
            expect(describeDestinationFinding(finding)).toContain(destination);
          }
          expect(findings.map((finding) => finding.problem)).toContain(NOT_A_PUBLIC_ROUTE);
          // `internalLinkPath` is what decides the destination, so the finding names
          // the route the router would serve rather than the raw href.
          expect(internalLinkPath(destination, '/areas')).toBe(destination);
        }),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  // -------------------------------------------------------------------------
  // (3) Registry scale: the hub at and past the 25-link cap
  // -------------------------------------------------------------------------

  it(
    'links every admitted slug on the area hub at registry scale, visible or inside <details>',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbPublishedLocalitySet, arbPublishedGuideSet, async (localities, guides) => {
          install({ now: PROPERTY_NOW, registry: localities, guides, claims: [] });
          const now = PROPERTY_NOW;

          const admittedAreas = [...getPublishedAreaSlugs(now)];
          const admittedGuides = [...getPublishedGuideSlugs(now)];
          // The generators build gate-ready sets, so the gate admits all of them.
          expectSameSet(
            'getPublishedAreaSlugs',
            admittedAreas,
            localities.map((record) => record.slug)
          );
          expectSameSet('getPublishedGuideSlugs', admittedGuides, guides.map((record) => record.slug));

          expectSameSet(
            '/areas/[slug] generateStaticParams',
            (await generateAreaStaticParams()).map((entry) => entry.slug),
            admittedAreas
          );
          const paths = getPublicRoutes(now).map((route) => route.path);
          expectSameSet(
            'getPublicRoutes area routes',
            paths.filter((path) => path.startsWith('/areas/')).map((path) => path.slice('/areas/'.length)),
            admittedAreas
          );

          const sitemap = await (await sitemapRoute()).text();
          expectSameSet('the sitemap', locEntries(sitemap, AREA_LOC), admittedAreas);
          expectSameSet('the sitemap', locEntries(sitemap, GUIDE_LOC), admittedGuides);

          const hub = await render(<AreasPage />);
          // Requirement 2.6: every link is in the first response and needs no script.
          expect(hub).not.toContain('<script');
          expectSameSet('/areas', linkedSlugs(hub, '/areas/'), admittedAreas);

          // Requirement 2.3: no visible group past the cap, and every link past it
          // inside a `<details>` element in this same HTML — so a slug beyond the
          // twenty-fifth is still in the first response rather than behind a script.
          const groups = groupPublishedLocalities(localities);
          const overflowing = groups.filter((group) => group.overflowLinks.length > 0);
          for (const group of groups) {
            expect(group.visibleLinks.length, group.marketingGroup).toBeLessThanOrEqual(
              MAX_VISIBLE_LINKS_PER_GROUP
            );
          }

          const blocks = detailsBlocks(hub);
          expect(blocks, 'one <details> per overflowing group').toHaveLength(overflowing.length);
          // Every block's links are exactly one group's overflow list, in order, and
          // each block is closed, so the visible list a reader meets stays at the cap.
          expect(blocks.map((block) => linkedSlugs(block, '/areas/').join(' ')).sort()).toEqual(
            overflowing.map((group) => group.overflowLinks.map((link) => link.slug).join(' ')).sort()
          );
          for (const block of blocks) {
            expect(block.startsWith('<details>') || block.startsWith('<details '), block.slice(0, 40)).toBe(
              true
            );
            expect(/<details[^>]*\sopen/.test(block), 'a <details> block is open by default').toBe(false);
          }
          // And the links outside every block are the visible lists, so nothing was
          // double-counted into both halves.
          const insideBlocks = blocks.flatMap((block) => linkedSlugs(block, '/areas/'));
          expectSameSet(
            '/areas visible lists',
            linkedSlugs(hub, '/areas/').filter(
              (slug, index, all) => all.indexOf(slug) === index && !insideBlocks.includes(slug)
            ),
            groups.flatMap((group) => group.visibleLinks.map((link) => link.slug))
          );

          const guideHub = await render(<GuidesPage />);
          expectSameSet('/guides', linkedSlugs(guideHub, '/guides/'), admittedGuides);
        }),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );
});
