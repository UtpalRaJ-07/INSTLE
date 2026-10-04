/**
 * Property 1: A gate-failing record contributes nothing to any public surface.
 *
 * *For any* locality record, guide record and evaluation date, if the publication gate
 * rejects that record, then no value held in the record — its name, slug, summary,
 * section headings, section paragraphs, FAQ text, administrative mapping values or
 * blocking notes — appears in the rendered markup, the page metadata,
 * `generateStaticParams`, the area or guide hub listing, any internal link, the
 * sitemap or `llms.txt`, and the record's route responds 404 with a "Page not found"
 * title carrying `noindex`. The same holds for any individual unevidenced value on an
 * otherwise publishable record: a nearby-locality relationship with no gate-passing
 * claim renders neither a link nor a placeholder, partial sentence or disabled
 * element in its place.
 *
 * **Validates: Requirements 1.4, 1.11, 2.5, 4.6, 8.4, 8.5, 11.6, 11.8**
 *
 * How each run is built. Every generated record starts gate-ready and fully marked —
 * a unique marker in every field it could leak through — and a failing record then has
 * one or two recorded failure modes applied (`LOCALITY_GATE_FAILURE_MODES`,
 * `GUIDE_GATE_FAILURE_MODES`). Gate-passing records are mixed in, related to the
 * failing ones and to each other, so the surfaces that list or link records are never
 * trivially empty. The evaluation instant is any hour of `PROPERTY_NOW`'s day.
 *
 * What is rendered is the real thing: the `/areas/[slug]` and `/guides/[slug]` pages,
 * their metadata and static params, `/areas`, `/guides`, the homepage, the three
 * service pages that list guides, the public route registry and the served sitemap.
 *
 * Injection, and what it does not replace. As in `tests/locality-page-template.test.tsx`:
 *
 *  - Fixture claims are layered in front of the live ledger and judged by the real
 *    `evaluateClaim`.
 *  - `LOCALITY_REGISTRY` is swapped through a getter, which every accessor in
 *    `locality-sections.ts` reads. The homepage and `/areas` call
 *    `getPublishedLocalities()` with no registry, so its *default argument* is swapped
 *    too; the real function does the work.
 *  - `guides.ts` reads its registry through module-internal bindings, so its five
 *    accessors are mirrored over the injected registry, each a one-line filter through
 *    the real `isGuidePublishable`. The "injection" test below pins every mirror to the
 *    real accessor's output on the live registry at two dates.
 *
 * Two surfaces the property names do not exist yet, so there is nothing to render:
 * no `llms.txt` route (it is gated on the domain and lands with task 13), and no
 * record preview surface (Requirement 11.8). No route under `src/app` serves either.
 */

import React from 'react';
import type { Metadata } from 'next';
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
  const current = (): readonly LocalityRecord[] => injected.registry ?? actual.LOCALITY_REGISTRY;
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return current();
    },
    // The homepage and `/areas` pass no registry, so the default is their only
    // injection point. The real function, and the real gate inside it, decide.
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

// A plain anchor: the assertions are about which hrefs the server markup carries.
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
import {
  evaluateGuide,
  getGuideById,
  getPublishedGuideBySlug,
  getPublishedGuideSlugs,
  getPublishedGuides,
  getPublishedGuidesForIntent,
} from '@/config/guides';
import {
  LOCALITY_SLUG_ALIASES,
  evaluateLocality,
  getPublishedLocalities,
  getPublishedLocalitySlugs,
} from '@/config/localities';
import { getPublishedAreaSlugs } from '@/config/locality-sections';
import { getPublicRoutes } from '@/lib/public-routes';
import HomePage from '@/app/page';
import AreasPage from '@/app/areas/page';
import LocalityPage, {
  generateMetadata as generateAreaMetadata,
  generateStaticParams as generateAreaStaticParams,
} from '@/app/areas/[slug]/page';
import GuidesPage from '@/app/guides/page';
import GuidePage, {
  generateMetadata as generateGuideMetadata,
  generateStaticParams as generateGuideStaticParams,
} from '@/app/guides/[slug]/page';
import BuyPage from '@/app/buy/page';
import SellPage from '@/app/sell/page';
import RentOutPage from '@/app/rent-out/page';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';
import { addCalendarDays } from '@/lib/calendar-dates';
import {
  GUIDE_GATE_FAILURE_MODES,
  LOCALITY_GATE_FAILURE_MODES,
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  applyGuideGateFailure,
  applyLocalityGateFailure,
  arbGatePassingClaimWithId,
  arbGuideGateFailure,
  arbLeakGuideIntent,
  arbLeakSalt,
  arbLocalityGateFailure,
  leakRecordMarker,
  markedGateReadyGuide,
  markedGateReadyLocality,
  type GuideGateFailureMode,
  type LocalityGateFailureMode,
} from './arbitraries';

// ---------------------------------------------------------------------------
// Constants and helpers
// ---------------------------------------------------------------------------

/** The live alias table, so the real resolver is what runs: [alias, canonical]. */
const ALIAS_PAIRS: readonly (readonly [string, string])[] = Object.entries(LOCALITY_SLUG_ALIASES);

/** Slugs no registry holds, whose 404 metadata every failing slug's must match. */
const UNKNOWN_AREA_SLUG = 'zz-no-such-area';
const UNKNOWN_GUIDE_SLUG = 'zz-no-such-guide';

/** The one passing claim each scenario layers, backing every mapping and relationship. */
const PASSING_CLAIM_ID = 'CLM-LEAK-PASSING';

/** Rendering a dozen pages a run, a hundred runs, is slower than the default timeout. */
const PROPERTY_TIMEOUT_MS = 300_000;

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

async function servedSitemap(): Promise<string> {
  confirmDomain();
  const response = await sitemapRoute();
  expect(response.status).toBe(200);
  return response.text();
}

/** Short failure messages: which surface, which value. The markup itself is not dumped. */
function expectNoneOf(surface: string, text: string, forbidden: readonly string[]) {
  for (const value of forbidden) {
    expect(text.includes(value), `${surface} carries "${value}"`).toBe(false);
  }
}

/**
 * The 404 metadata contract, stated as indistinguishability: a gate-failing slug gets
 * exactly the metadata an unknown slug gets, with only the requested path differing.
 * So nothing the record holds — not its name, its summary or its canonical slug —
 * can reach the title, the description, the canonical or the Open Graph fields.
 */
async function expectNotFoundMetadata(
  generate: (input: ReturnType<typeof props>) => Promise<Metadata>,
  slug: string,
  unknownSlug: string,
  forbidden: readonly string[]
) {
  const metadata = await generate(props(slug));
  expect(String(metadata.title), slug).toContain('Page not found');
  expect(metadata.robots, slug).toMatchObject({ index: false });

  const serialised = JSON.stringify(metadata);
  const unknown = JSON.stringify(await generate(props(unknownSlug))).split(unknownSlug).join(slug);
  expect(serialised, `metadata for ${slug} differs from an unknown slug's`).toBe(unknown);
  expectNoneOf(`metadata for ${slug}`, serialised, forbidden.filter((value) => value !== slug));
}

async function render(page: Promise<React.ReactElement> | React.ReactElement): Promise<string> {
  return renderToStaticMarkup(await page);
}

beforeEach(() => {
  injected.claims.clear();
  injected.registry = null;
  injected.guides = null;
  // Every page, param list, metadata and sitemap reads the clock itself.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PROPERTY_NOW);
});

afterEach(() => {
  injected.claims.clear();
  injected.registry = null;
  injected.guides = null;
  vi.useRealTimers();
});

/** Any hour of `PROPERTY_NOW`'s day, including its first instant. */
const arbEvaluationInstant: fc.Arbitrary<Date> = fc
  .integer({ min: 0, max: 23 })
  .map((hours) => new Date(PROPERTY_NOW.getTime() + hours * 60 * 60 * 1000));

// ---------------------------------------------------------------------------
// Locality scenarios
// ---------------------------------------------------------------------------

interface FailingLocality {
  readonly record: LocalityRecord;
  readonly modes: readonly LocalityGateFailureMode[];
  readonly marker: string;
  /** The live alias whose canonical slug this record occupies, if it occupies one. */
  readonly alias: string | null;
}

interface LocalityScenario {
  readonly now: Date;
  readonly registry: readonly LocalityRecord[];
  readonly claims: readonly ClaimRecord[];
  readonly failing: readonly FailingLocality[];
  /** Two gate-passing records. The first relates to the second with no claim. */
  readonly passing: readonly [LocalityRecord, LocalityRecord];
  /** Carried by the unevidenced relationship only. */
  readonly unevidencedMarker: string;
}

const arbLocalityScenario: fc.Arbitrary<LocalityScenario> = fc
  .tuple(
    arbLeakSalt,
    arbEvaluationInstant,
    arbGatePassingClaimWithId(PASSING_CLAIM_ID),
    fc.integer({ min: 1, max: 3 })
  )
  .chain(([salt, now, passingClaim, failingCount]) =>
    fc
      .tuple(
        fc.tuple(
          ...Array.from({ length: failingCount }, (_, index) =>
            fc.tuple(arbLocalityGateFailure(`CLM-LEAK-F${index}`), fc.boolean(), fc.boolean())
          )
        ),
        fc.boolean()
      )
      .map(([failures, failingFirst]): LocalityScenario => {
        const failing = failures.map(([failure, occupyAlias, relateByAlias], index): FailingLocality & {
          readonly relateAs: string;
          readonly claims: readonly ClaimRecord[];
        } => {
          const marker = leakRecordMarker('fail', index, salt);
          const pair = occupyAlias ? ALIAS_PAIRS[index] : undefined;
          const slug = pair ? pair[1] : `leak-fail${index}-${salt}`;
          return {
            record: applyLocalityGateFailure(markedGateReadyLocality(marker, slug, PASSING_CLAIM_ID), failure),
            modes: failure.modes,
            marker,
            alias: pair ? pair[0] : null,
            // A passing page may name the failing place by its alias spelling.
            relateAs: pair && relateByAlias ? pair[0] : slug,
            claims: [failure.failingClaim, failure.deskReviewedClaim],
          };
        });

        const passSlugs = [`leak-pass0-${salt}`, `leak-pass1-${salt}`] as const;
        const unevidencedMarker = leakRecordMarker('unev', 0, salt);
        // Evidenced relationships to places that fail the gate: each carries a claim
        // that passes, so the passing page stays publishable and the destination's
        // gate is the only reason to leave the link out. The statement carries the
        // failing record's marker, so rendering it is caught as that record's leak.
        const towardsFailing = failing.map((entry) => ({
          slug: entry.relateAs,
          relationship: `${entry.marker}-nearby-statement`,
          claimId: PASSING_CLAIM_ID,
        }));
        const passing: [LocalityRecord, LocalityRecord] = [
          {
            ...markedGateReadyLocality(leakRecordMarker('pass', 0, salt), passSlugs[0], PASSING_CLAIM_ID),
            approvedNearbyRelationships: [
              ...towardsFailing,
              // Requirement 8.4: a published destination, but no claim behind the relationship.
              { slug: passSlugs[1], relationship: `${unevidencedMarker}-unevidenced-statement`, claimId: null },
            ],
          },
          {
            ...markedGateReadyLocality(leakRecordMarker('pass', 1, salt), passSlugs[1], PASSING_CLAIM_ID),
            approvedNearbyRelationships: [
              ...towardsFailing,
              // The positive control: evidenced, and published at both ends.
              { slug: passSlugs[0], relationship: 'shares an evidenced edge with this area', claimId: PASSING_CLAIM_ID },
            ],
          },
        ];

        const failingRecords = failing.map((entry) => entry.record);
        return {
          now,
          registry: failingFirst ? [...failingRecords, ...passing] : [...passing, ...failingRecords],
          claims: [passingClaim, ...failing.flatMap((entry) => entry.claims)],
          failing: failing.map(({ record, modes, marker, alias }) => ({ record, modes, marker, alias })),
          passing,
          unevidencedMarker,
        };
      })
  );

function installLocalityScenario(scenario: LocalityScenario) {
  injected.claims.clear();
  for (const claim of scenario.claims) injected.claims.set(claim.claimId, claim);
  injected.registry = scenario.registry;
  injected.guides = null;
  vi.setSystemTime(scenario.now);
  confirmDomain();
}

/** Every slug a failing record could be reached or named by. */
function failingLocalitySlugs(scenario: LocalityScenario): string[] {
  return scenario.failing.flatMap(({ record, alias }) => (alias ? [record.slug, alias] : [record.slug]));
}

// ---------------------------------------------------------------------------
// Guide scenarios
// ---------------------------------------------------------------------------

interface FailingGuide {
  readonly record: GuideRecord;
  readonly modes: readonly GuideGateFailureMode[];
  readonly marker: string;
}

interface GuideScenario {
  readonly now: Date;
  readonly guides: readonly GuideRecord[];
  readonly claims: readonly ClaimRecord[];
  readonly failing: readonly FailingGuide[];
  readonly passing: readonly GuideRecord[];
  /** A gate-passing locality whose related guides include every generated guide. */
  readonly locality: LocalityRecord;
}

const arbGuideScenario: fc.Arbitrary<GuideScenario> = fc
  .tuple(arbLeakSalt, arbEvaluationInstant, fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 2 }))
  .chain(([salt, now, failingCount, passingCount]) =>
    fc
      .tuple(
        fc.tuple(
          ...Array.from({ length: failingCount }, (_, index) =>
            fc.tuple(arbGuideGateFailure(`CLM-LEAK-G${index}-FAILING`), arbLeakGuideIntent)
          )
        ),
        fc.tuple(...Array.from({ length: passingCount }, () => arbLeakGuideIntent)),
        fc.boolean()
      )
      .map(([failures, passingIntents, failingFirst]): GuideScenario => {
        const failing = failures.map(([failure, intent], index) => {
          const marker = leakRecordMarker('gfail', index, salt);
          return {
            record: applyGuideGateFailure(markedGateReadyGuide(marker, `guide-fail${index}-${salt}`, intent), failure),
            modes: failure.modes,
            marker,
            claim: failure.failingClaim,
          };
        });
        const failingIds = failing.map((entry) => entry.record.guideId);
        const passingBase = passingIntents.map((intent, index) =>
          markedGateReadyGuide(leakRecordMarker('gpass', index, salt), `guide-pass${index}-${salt}`, intent)
        );
        // Every passing guide relates to every failing guide and to the other passing one.
        const passing = passingBase.map((record) => ({
          ...record,
          relatedGuideIds: [
            ...failingIds,
            ...passingBase.filter((other) => other.guideId !== record.guideId).map((other) => other.guideId),
          ],
        }));
        const locality: LocalityRecord = {
          ...markedGateReadyLocality(leakRecordMarker('lpass', 0, salt), `leak-lpass0-${salt}`, null),
          relatedGuideIds: [...failingIds, ...passing.map((record) => record.guideId)],
        };
        const failingRecords = failing.map((entry) => entry.record);
        return {
          now,
          guides: failingFirst ? [...failingRecords, ...passing] : [...passing, ...failingRecords],
          claims: failing.map((entry) => entry.claim),
          failing: failing.map(({ record, modes, marker }) => ({ record, modes, marker })),
          passing,
          locality,
        };
      })
  );

function installGuideScenario(scenario: GuideScenario) {
  injected.claims.clear();
  for (const claim of scenario.claims) injected.claims.set(claim.claimId, claim);
  injected.guides = scenario.guides;
  injected.registry = [scenario.locality];
  vi.setSystemTime(scenario.now);
  confirmDomain();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 1: a gate-failing record contributes nothing to any public surface', () => {
  describe('the generators', () => {
    const [failure] = fc.sample(arbLocalityGateFailure('CLM-UNIT'), { numRuns: 1, seed: 9 });
    const [guideFailure] = fc.sample(arbGuideGateFailure('CLM-UNIT-GUIDE'), { numRuns: 1, seed: 9 });
    const [passingClaim] = fc.sample(arbGatePassingClaimWithId(PASSING_CLAIM_ID), { numRuns: 1, seed: 9 });

    beforeEach(() => {
      for (const claim of [passingClaim, failure.failingClaim, failure.deskReviewedClaim, guideFailure.failingClaim]) {
        injected.claims.set(claim.claimId, claim);
      }
    });

    it('build a marked locality baseline and a marked guide baseline that pass their gates', () => {
      expect(evaluateClaim(passingClaim, PROPERTY_NOW).failures).toEqual([]);
      const locality = markedGateReadyLocality('ZZMARKER-unit0xabcdef', 'unit-locality', PASSING_CLAIM_ID);
      expect(evaluateLocality(locality, PROPERTY_NOW).failures).toEqual([]);
      const guide = markedGateReadyGuide('ZZMARKER-unit0xabcdef', 'unit-guide', 'buy');
      expect(evaluateGuide(guide, PROPERTY_NOW).failures).toEqual([]);
    });

    it.each(LOCALITY_GATE_FAILURE_MODES)('reject a locality whose only failure is %s', (mode) => {
      const record = applyLocalityGateFailure(
        markedGateReadyLocality('ZZMARKER-unit0xabcdef', 'unit-locality', PASSING_CLAIM_ID),
        { ...failure, modes: [mode] }
      );
      expect(getPublishedAreaSlugs(PROPERTY_NOW, [record])).toEqual([]);
    });

    it.each(GUIDE_GATE_FAILURE_MODES)('reject a guide whose only failure is %s', (mode) => {
      const record = applyGuideGateFailure(markedGateReadyGuide('ZZMARKER-unit0xabcdef', 'unit-guide', 'buy'), {
        ...guideFailure,
        modes: [mode],
      });
      expect(evaluateGuide(record, PROPERTY_NOW).eligible).toBe(false);
    });
  });

  describe('the injection', () => {
    it('delegates to the real accessors when nothing is injected, at two dates', async () => {
      const guides = await vi.importActual<typeof import('@/config/guides')>('@/config/guides');
      const localities = await vi.importActual<typeof import('@/config/localities')>('@/config/localities');
      const intents = ['buy', 'sell', 'rent', 'rent-out', 'commercial', 'general'] as const;

      // Not a comparison of two empty lists: three live guides publish today.
      expect(getPublishedGuides(PROPERTY_NOW).length).toBeGreaterThan(0);

      for (const date of [PROPERTY_NOW, addCalendarDays(PROPERTY_NOW, 400)]) {
        expect(getPublishedGuides(date)).toEqual(guides.getPublishedGuides(date));
        expect(getPublishedGuideSlugs(date)).toEqual(guides.getPublishedGuideSlugs(date));
        for (const intent of intents) {
          expect(getPublishedGuidesForIntent(intent, date)).toEqual(guides.getPublishedGuidesForIntent(intent, date));
        }
        for (const record of guides.GUIDE_REGISTRY) {
          expect(getPublishedGuideBySlug(record.slug, date)).toEqual(guides.getPublishedGuideBySlug(record.slug, date));
          expect(getGuideById(record.guideId)).toEqual(guides.getGuideById(record.guideId));
        }
        expect(getPublishedLocalities(date)).toEqual(localities.getPublishedLocalities(date));
        expect(getPublishedLocalitySlugs(date)).toEqual(localities.getPublishedLocalitySlugs(date));
      }
    });
  });

  it(
    'holds for gate-failing locality records, aliases whose canonical fails, and unevidenced relationships',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbLocalityScenario, async (scenario) => {
          installLocalityScenario(scenario);
          const { now, failing, passing, unevidencedMarker } = scenario;
          const [first, second] = passing;
          const failingSlugs = failingLocalitySlugs(scenario);
          const forbidden = [...failing.map((entry) => entry.marker), unevidencedMarker, ...failingSlugs];

          // The scenario is what it says: the baselines pass, and the gate rejects each
          // failing record at the request date on every accessor the surfaces read.
          for (const record of passing) {
            expect(evaluateLocality(record, now).failures, record.slug).toEqual([]);
          }
          const published = getPublishedAreaSlugs(now);
          for (const { record, modes } of failing) {
            expect(published.includes(record.slug), `the gate admits ${record.slug} (${modes.join(', ')})`).toBe(
              false
            );
          }

          // The route: a 404, and metadata indistinguishable from an unknown slug's —
          // for the canonical slug and for an alias whose canonical fails (1.11).
          for (const slug of failingSlugs) {
            await expect(LocalityPage(props(slug)), slug).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
            await expectNotFoundMetadata(generateAreaMetadata, slug, UNKNOWN_AREA_SLUG, forbidden);
          }

          // Static params, the public route registry and the served sitemap.
          const params = (await generateAreaStaticParams()).map((entry) => entry.slug);
          const paths = getPublicRoutes(now).map((route) => route.path);
          const sitemap = await servedSitemap();
          for (const slug of failingSlugs) {
            expect(params, slug).not.toContain(slug);
            expect(paths, slug).not.toContain(`/areas/${slug}`);
          }
          expectNoneOf('the sitemap', sitemap, forbidden);

          // The area hub and the homepage, which list published localities.
          const hub = await render(<AreasPage />);
          const home = await render(<HomePage />);
          expectNoneOf('/areas', hub, forbidden);
          expectNoneOf('/', home, forbidden);

          // Every published locality page: its nearby links, its orientation plate, its
          // sources — none names a failing place or an unevidenced relationship (8.4, 8.5).
          const pages = [await render(LocalityPage(props(first.slug))), await render(LocalityPage(props(second.slug)))];
          expectNoneOf(`/areas/${first.slug}`, pages[0], forbidden);
          expectNoneOf(`/areas/${second.slug}`, pages[1], forbidden);

          // 8.4: the first page's only relationship to the second has no claim, so it
          // leaves no link and no empty nearby block, heading or disabled element.
          expect(pages[0], 'unevidenced nearby link').not.toContain(`href="/areas/${second.slug}"`);
          expect(pages[0], 'empty nearby block').not.toContain('id="locality-nearby-heading"');
          expect(pages[0], 'disabled element').not.toMatch(/aria-disabled|\sdisabled[\s=>]/);

          // Positive controls, so none of the absences above is vacuous: the passing
          // records are on every listing surface, and the evidenced relationship links.
          for (const record of passing) {
            expect(params).toContain(record.slug);
            expect(paths).toContain(`/areas/${record.slug}`);
            expect(sitemap).toContain(`/areas/${record.slug}<`);
            expect(hub).toContain(`href="/areas/${record.slug}"`);
            expect(home).toContain(`href="/areas/${record.slug}"`);
          }
          expect(pages[1], 'evidenced nearby link').toContain(`href="/areas/${first.slug}"`);
        }),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  it(
    'holds for gate-failing guide records on every surface that lists or links guides',
    async () => {
      await fc.assert(
        fc.asyncProperty(arbGuideScenario, async (scenario) => {
          installGuideScenario(scenario);
          const { now, failing, passing, locality } = scenario;
          const failingSlugs = failing.map((entry) => entry.record.slug);
          const forbidden = [...failing.map((entry) => entry.marker), ...failingSlugs];

          for (const record of passing) {
            expect(evaluateGuide(record, now).failures, record.slug).toEqual([]);
          }
          expect(evaluateLocality(locality, now).failures, locality.slug).toEqual([]);
          const published = getPublishedGuideSlugs(now);
          for (const { record, modes } of failing) {
            expect(published.includes(record.slug), `the gate admits ${record.slug} (${modes.join(', ')})`).toBe(
              false
            );
          }

          // The route (4.6): a 404 and metadata indistinguishable from an unknown slug's.
          for (const slug of failingSlugs) {
            await expect(GuidePage(props(slug)), slug).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
            await expectNotFoundMetadata(generateGuideMetadata, slug, UNKNOWN_GUIDE_SLUG, forbidden);
          }

          const params = (await generateGuideStaticParams()).map((entry) => entry.slug);
          const paths = getPublicRoutes(now).map((route) => route.path);
          const sitemap = await servedSitemap();
          for (const slug of failingSlugs) {
            expect(params, slug).not.toContain(slug);
            expect(paths, slug).not.toContain(`/guides/${slug}`);
          }
          expectNoneOf('the sitemap', sitemap, forbidden);

          // Every listing: the guide hub, the homepage and the service pages that list
          // guides by intent; and every link: related guides on each published guide
          // and on a published locality page.
          const surfaces: [string, string][] = [
            ['/guides', await render(<GuidesPage />)],
            ['/', await render(<HomePage />)],
            ['/buy', await render(<BuyPage />)],
            ['/sell', await render(<SellPage />)],
            ['/rent-out', await render(<RentOutPage />)],
            [`/areas/${locality.slug}`, await render(LocalityPage(props(locality.slug)))],
          ];
          for (const record of passing) {
            surfaces.push([`/guides/${record.slug}`, await render(GuidePage(props(record.slug)))]);
          }
          for (const [surface, markup] of surfaces) expectNoneOf(surface, markup, forbidden);

          // Positive controls: the passing guides are listed and linked.
          const guideHub = surfaces[0][1];
          const localityPage = surfaces[5][1];
          for (const record of passing) {
            expect(params).toContain(record.slug);
            expect(paths).toContain(`/guides/${record.slug}`);
            expect(sitemap).toContain(`/guides/${record.slug}<`);
            expect(guideHub).toContain(`href="/guides/${record.slug}"`);
            expect(localityPage).toContain(`href="/guides/${record.slug}"`);
          }
        }),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );
});
