/**
 * Property 15: Crawler access fails closed, and the two crawler decisions are
 * independent.
 *
 * *For any* value of `INSTLE_DEPLOY_ENV` — including absent, empty and arbitrary
 * strings — combined with either domain state, `robots.txt` serves a single
 * `User-agent: *` group containing `Disallow: /` with no `Allow` line and no
 * sitemap reference unless the value is exactly `production` and the domain is
 * confirmed; the training-crawl group serves `Disallow: /` whenever its decision is
 * anything other than `allowed`; mutating either crawler decision leaves the
 * other's emitted group byte-identical; no registered page route carrying `noindex`
 * is covered by any `Disallow` pattern; and a recorded verification date more than
 * 90 days before the build date fails the build.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.6, 6.10, 6.11**
 *
 * How each run is driven. `robots()` reads `SEARCH_CRAWL_DECISION` and
 * `TRAINING_CRAWL_DECISION` directly and takes no argument, so the two constants
 * are swapped through getters — the injection `tests/crawler-access.test.ts` uses —
 * and every generated pair is served through the real route. Nothing else is
 * mocked: `buildAgentGroup`, `evaluateCrawlerDecision` and the environment reader
 * are the shipped functions, and the output is compared as served, through the
 * serialiser Next.js runs over the route's return value.
 *
 * Where the expected answers come from. `arbCrawlerAccessDecision` and
 * `arbCrawlerEnvironment` carry their own oracles — `expectedGrant` and
 * `opensCrawling` — worked out field by field from Requirements 6.1, 6.2, 6.4, 6.5
 * and 6.11 rather than by calling the code under test, and the first property below
 * pins `evaluateCrawlerDecision` against `expectedGrant` on every generated record.
 * So a fail-open change to the register would have to be made in two places, in
 * agreement, to go unnoticed.
 *
 * The 90-day boundary and the build-failing audit are exercised here through the
 * served file; their exact arithmetic is `tests/crawler-access.test.ts`.
 */

import fc from 'fast-check';
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CrawlerAccessDecision } from '@/config/crawler-access';

/** What `robots()` reads as each decision. Unset, the real constants are served. */
const served = vi.hoisted(() => ({
  search: undefined as CrawlerAccessDecision | undefined,
  training: undefined as CrawlerAccessDecision | undefined,
}));

vi.mock('@/config/crawler-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/crawler-access')>();
  return {
    ...actual,
    get SEARCH_CRAWL_DECISION() {
      return served.search ?? actual.SEARCH_CRAWL_DECISION;
    },
    get TRAINING_CRAWL_DECISION() {
      return served.training ?? actual.TRAINING_CRAWL_DECISION;
    },
  };
});

import robots from '@/app/robots';
import {
  ENQUIRY_API_DISALLOW_PATH,
  auditCrawlerAccess,
  buildAgentGroup,
  evaluateCrawlerDecision,
} from '@/config/crawler-access';
import {
  BLOCKED_TEXT,
  NOINDEX_DISALLOW_SCOPE,
  groupsOf,
  isWholeSiteDenial,
  list,
  noindexScopeViolations,
  registeredPageRoutes,
  setEnv,
} from '../helpers/robots-scope';
import { enumerateRegisteredRoutes } from '../helpers/route-shape';
import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbCrawlerAccessDecision,
  arbCrawlerEnvironment,
  arbMillisecondsIntoPropertyDay,
  type GeneratedCrawlerDecision,
  type GeneratedCrawlerEnvironment,
} from './arbitraries';

// ---------------------------------------------------------------------------
// The two identities, and the generators over them
// ---------------------------------------------------------------------------

/**
 * Written out rather than read from the register, because the register is mocked
 * in this file. The first test below compares both against the shipped constants,
 * so a renamed agent or decision id fails here rather than quietly testing a
 * decision robots.txt does not serve.
 */
const SEARCH_IDENTITY = { decisionId: 'search-crawl', userAgents: ['OAI-SearchBot'] } as const;
const TRAINING_IDENTITY = { decisionId: 'training-crawl', userAgents: ['GPTBot'] } as const;

const arbSearchDecision = arbCrawlerAccessDecision(SEARCH_IDENTITY);
const arbTrainingDecision = arbCrawlerAccessDecision(TRAINING_IDENTITY);

/** Every environment but the one combination Requirement 6.2 opens crawling for. */
const arbBlockedEnvironment = arbCrawlerEnvironment.filter((environment) => !environment.opensCrawling);
/** Exactly `production` with a usable https origin and a confirmed domain. */
const arbOpenEnvironment = arbCrawlerEnvironment.filter((environment) => environment.opensCrawling);

/** The page routes the Requirement 6.6 scope covers. Read once: it walks `src/app`. */
const PAGE_ROUTES = registeredPageRoutes();

/** Property tests are slower than the default timeout under a full parallel run. */
const PROPERTY_TIMEOUT_MS = 120_000;

beforeEach(() => {
  served.search = undefined;
  served.training = undefined;
  // `robots()` reads the clock, and every generated date is positioned from
  // `PROPERTY_NOW`'s calendar day.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PROPERTY_NOW);
});

afterEach(() => {
  served.search = undefined;
  served.training = undefined;
  vi.useRealTimers();
});

/** Installs one run: both decisions, the environment, and an instant of that day. */
function install(
  search: GeneratedCrawlerDecision,
  training: GeneratedCrawlerDecision,
  environment: GeneratedCrawlerEnvironment,
  millisecondsIntoDay: number
): Date {
  served.search = search.decision;
  served.training = training.decision;
  setEnv(environment.env);
  const now = new Date(PROPERTY_NOW.getTime() + millisecondsIntoDay);
  vi.setSystemTime(now);
  return now;
}

/** The served text of the group naming `agent`, exactly as a crawler reads it. */
function servedGroup(text: string, agent: string): string | null {
  const blocks = text.split('\n\n').filter((block) => block.startsWith(`User-Agent: ${agent}\n`));
  expect(blocks.length, `at most one group names ${agent}`).toBeLessThanOrEqual(1);
  return blocks[0] ?? null;
}

const DISALLOWED_BLOCK = (agent: string) => `User-Agent: ${agent}\nDisallow: /`;
const ALLOWED_BLOCK = (agent: string) =>
  `User-Agent: ${agent}\nAllow: /\nDisallow: ${ENQUIRY_API_DISALLOW_PATH}`;

const AGENTS: readonly [agent: string, key: 'search' | 'training'][] = [
  ['OAI-SearchBot', 'search'],
  ['GPTBot', 'training'],
];

// ---------------------------------------------------------------------------
// The injection, and the scope the route-level assertions run over
// ---------------------------------------------------------------------------

describe('Property 15: crawler access fails closed, and the two decisions are independent', () => {
  describe('the injection and the scope', () => {
    it('generates decisions under the identities the shipped register serves', async () => {
      const actual = await vi.importActual<typeof import('@/config/crawler-access')>(
        '@/config/crawler-access'
      );
      for (const [identity, shipped] of [
        [SEARCH_IDENTITY, actual.SEARCH_CRAWL_DECISION],
        [TRAINING_IDENTITY, actual.TRAINING_CRAWL_DECISION],
      ] as const) {
        expect(identity.decisionId).toBe(shipped.decisionId);
        expect([...identity.userAgents]).toEqual([...shipped.userAgents]);
      }
      // Unset, the mock serves the shipped constants, so a test that forgets to
      // install a decision tests the real register rather than a stale fixture.
      expect(served.search).toBeUndefined();
      expect(served.training).toBeUndefined();
    });

    it('reaches both branches of both oracles, so the properties below are not vacuous', () => {
      const decisions = fc.sample(arbSearchDecision, { numRuns: 300, seed: 15 });
      const granting = decisions.filter((generated) => generated.expectedGrant).length;
      expect(granting).toBeGreaterThan(0);
      expect(granting).toBeLessThan(decisions.length);
      // Verification ages either side of the 90-day boundary, and a stale one.
      expect(decisions.some((d) => d.verificationAgeDays === 90)).toBe(true);
      expect(decisions.some((d) => (d.verificationAgeDays ?? 0) > 90)).toBe(true);

      const environments = fc.sample(arbCrawlerEnvironment, { numRuns: 300, seed: 15 });
      const open = environments.filter((environment) => environment.opensCrawling).length;
      expect(open).toBeGreaterThan(0);
      expect(open).toBeLessThan(environments.length);
    });

    it('covers every registered page route, and no route handler', () => {
      const registered = enumerateRegisteredRoutes();
      const pages = registered.filter((route) => route.kind === 'page');
      expect(pages.length).toBeGreaterThan(0);

      for (const page of pages) {
        if (page.dynamicSegments.length === 0) {
          expect(PAGE_ROUTES, page.path).toContain(page.path);
          continue;
        }
        // A dynamic pattern is covered by its expansions, never by the pattern.
        const prefix = `${page.path.slice(0, page.path.indexOf('['))}`;
        expect(PAGE_ROUTES, page.path).not.toContain(page.path);
        expect(
          PAGE_ROUTES.filter((route) => route.startsWith(prefix)).length,
          `${page.path} is expanded`
        ).toBeGreaterThan(0);
      }

      for (const handler of registered.filter((route) => route.kind === 'route-handler')) {
        expect(PAGE_ROUTES, handler.path).not.toContain(handler.path);
      }
      expect(NOINDEX_DISALLOW_SCOPE.routes).toBe('registered-page-routes');
      expect(NOINDEX_DISALLOW_SCOPE.excludedGroups).toBe('whole-site-denial');
    });
  });

  // -------------------------------------------------------------------------
  // (1) Requirement 6.1 — anything but exactly production with a confirmed domain
  // -------------------------------------------------------------------------

  it(
    'serves one blocked group, with no Allow line and no sitemap, outside production with a confirmed domain',
    () => {
      fc.assert(
        fc.property(
          arbSearchDecision,
          arbTrainingDecision,
          arbBlockedEnvironment,
          arbMillisecondsIntoPropertyDay,
          (search, training, environment, millisecondsIntoDay) => {
            install(search, training, environment, millisecondsIntoDay);

            const result = robots();
            // One group, naming every agent, allowing nothing. Neither generated
            // decision reaches the file at all: a decision cannot open crawling
            // that the environment has closed.
            expect(result).toStrictEqual({ rules: [{ userAgent: '*', disallow: '/' }] });

            const text = resolveRobots(result);
            expect(text).toBe(BLOCKED_TEXT);
            expect(text).not.toMatch(/^Allow:/im);
            expect(text).not.toMatch(/sitemap/i);
            expect(servedGroup(text, 'OAI-SearchBot')).toBeNull();
            expect(servedGroup(text, 'GPTBot')).toBeNull();

            // Requirement 6.6 holds trivially here, and is asserted rather than
            // assumed: the only group is a whole-site denial.
            expect(groupsOf(result).every(isWholeSiteDenial)).toBe(true);
            expect(noindexScopeViolations(result, PAGE_ROUTES)).toEqual([]);
          }
        ),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  // -------------------------------------------------------------------------
  // (2) Requirements 6.2, 6.4, 6.5, 6.10, 6.11 — Allow iff the decision grants it
  // -------------------------------------------------------------------------

  it(
    'gives a per-agent group an Allow line exactly when its own decision grants access',
    () => {
      fc.assert(
        fc.property(
          arbSearchDecision,
          arbTrainingDecision,
          arbOpenEnvironment,
          arbMillisecondsIntoPropertyDay,
          (search, training, environment, millisecondsIntoDay) => {
            const now = install(search, training, environment, millisecondsIntoDay);
            const result = robots();
            const text = resolveRobots(result);

            // Requirement 6.2: the wildcard group comes first, allows the site,
            // blocks the enquiry endpoint and names the sitemap on the confirmed
            // origin — so a named group below it is an override, not the only rule.
            const [wildcard] = groupsOf(result);
            expect(wildcard).toStrictEqual({
              userAgent: '*',
              allow: '/',
              disallow: [ENQUIRY_API_DISALLOW_PATH],
            });
            expect(result.sitemap).toBe(`${environment.expectedOrigin}/sitemap.xml`);

            for (const [agent, key] of AGENTS) {
              const generated = key === 'search' ? search : training;
              const evaluation = evaluateCrawlerDecision(generated.decision, now);

              // The oracle: the generator's reading of Requirements 6.4, 6.5 and
              // 6.11, and the register's, agree on every generated record.
              expect(evaluation.grantsAccess, `${agent} oracle`).toBe(generated.expectedGrant);

              const group = groupsOf(result).find((candidate) =>
                list(candidate.userAgent).includes(agent)
              );
              expect(group, agent).toBeDefined();
              expect(group).toStrictEqual(buildAgentGroup(generated.decision, now));

              // Requirement 6.10: anything short of a complete, current `allowed`
              // record — an unrecognised value, a desk name, a stale verification,
              // `unrecorded` — serves Disallow: / and no Allow line.
              expect('allow' in group!, `${agent} Allow line`).toBe(evaluation.grantsAccess);
              expect(servedGroup(text, agent)).toBe(
                evaluation.grantsAccess ? ALLOWED_BLOCK(agent) : DISALLOWED_BLOCK(agent)
              );
              if (!evaluation.grantsAccess) {
                expect(list(group!.disallow)).toEqual(['/']);
                expect(evaluation.failures.length > 0 || generated.decision.decision !== 'allowed').toBe(
                  true
                );
              }

              // Requirement 6.11: the same record that loses its Allow line for a
              // stale verification also fails the audit that fails the build.
              if (generated.verificationAgeDays !== null && generated.verificationAgeDays > 90) {
                expect(auditCrawlerAccess(now, [generated.decision]).ok).toBe(false);
                expect('allow' in group!).toBe(false);
              }
            }
          }
        ),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  // -------------------------------------------------------------------------
  // (3) Requirement 6.3 — each group is byte-identical across the other's changes
  // -------------------------------------------------------------------------

  it(
    "leaves each agent's served group byte-identical across arbitrary changes to the other decision",
    () => {
      fc.assert(
        fc.property(
          fc.tuple(arbSearchDecision, arbSearchDecision),
          fc.tuple(arbTrainingDecision, arbTrainingDecision),
          arbOpenEnvironment,
          arbMillisecondsIntoPropertyDay,
          ([firstSearch, secondSearch], [firstTraining, secondTraining], environment, msIntoDay) => {
            const groupsFor = (search: GeneratedCrawlerDecision, training: GeneratedCrawlerDecision) => {
              install(search, training, environment, msIntoDay);
              const text = resolveRobots(robots());
              return {
                search: servedGroup(text, 'OAI-SearchBot'),
                training: servedGroup(text, 'GPTBot'),
                rest: text
                  .split('\n\n')
                  .filter(
                    (block) =>
                      !block.startsWith('User-Agent: OAI-SearchBot\n') &&
                      !block.startsWith('User-Agent: GPTBot\n')
                  )
                  .join('\n\n'),
              };
            };

            const base = groupsFor(firstSearch, firstTraining);
            // Neither group is missing, so the comparisons below are not vacuous.
            expect(base.search).not.toBeNull();
            expect(base.training).not.toBeNull();

            // The training decision changes; the search group and everything else
            // does not.
            const trainingChanged = groupsFor(firstSearch, secondTraining);
            expect(trainingChanged.search).toBe(base.search);
            expect(trainingChanged.rest).toBe(base.rest);

            // The search decision changes; the training group does not.
            const searchChanged = groupsFor(secondSearch, firstTraining);
            expect(searchChanged.training).toBe(base.training);
            expect(searchChanged.rest).toBe(base.rest);

            // And each group does follow its own decision: whenever the two drawn
            // decisions differ in what they grant, the group's own text differs.
            if (firstTraining.expectedGrant !== secondTraining.expectedGrant) {
              expect(trainingChanged.training).not.toBe(base.training);
            }
            if (firstSearch.expectedGrant !== secondSearch.expectedGrant) {
              expect(searchChanged.search).not.toBe(base.search);
            }
          }
        ),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );

  // -------------------------------------------------------------------------
  // (4) Requirement 6.6 — no noindex page route under any Disallow
  // -------------------------------------------------------------------------

  it(
    'puts no registered page route under a Disallow line, whatever either decision records',
    () => {
      fc.assert(
        fc.property(
          arbSearchDecision,
          arbTrainingDecision,
          arbOpenEnvironment,
          arbMillisecondsIntoPropertyDay,
          (search, training, environment, millisecondsIntoDay) => {
            install(search, training, environment, millisecondsIntoDay);
            const result = robots();

            // At least one group permits crawling, so the scope is non-empty: the
            // wildcard group always does in this environment.
            const permitting = groupsOf(result).filter((group) => !isWholeSiteDenial(group));
            expect(permitting.length).toBeGreaterThan(0);

            expect(noindexScopeViolations(result, PAGE_ROUTES)).toEqual([]);

            // The excluded kinds are excluded because they are not pages, not
            // because nothing disallows them: `/api/` is disallowed on every
            // crawl-permitting group in this environment.
            for (const group of permitting) {
              expect(list(group.disallow)).toContain(ENQUIRY_API_DISALLOW_PATH);
            }
          }
        ),
        PROPERTY_RUN_CONFIG
      );
    },
    PROPERTY_TIMEOUT_MS
  );
});
