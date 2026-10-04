import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What robots.txt reads as each decision. Unset, the getters below return the
 * shipped constants, so every test outside "through the robots route" sees the
 * real register exactly as exported. Only the route-level tests swap a decision,
 * because `robots()` reads the two constants directly and takes no argument.
 */
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
  CRAWLER_ACCESS_DECISIONS,
  CRAWLER_DECISION_CHECKLIST_ENTRIES,
  CRAWLER_VERIFICATION_MAX_AGE_DAYS,
  ENQUIRY_API_DISALLOW_PATH,
  SEARCH_CRAWL_DECISION,
  TRAINING_CRAWL_DECISION,
  auditCrawlerAccess,
  buildAgentGroup,
  crawlerVerificationAgeDays,
  evaluateCrawlerDecision,
  type CrawlerAccessDecision,
} from '@/config/crawler-access';
import { addCalendarDays, formatCalendarDate } from '@/lib/calendar-dates';
import {
  NOINDEX_DISALLOW_SCOPE,
  groupsOf,
  isWholeSiteDenial,
  list,
  noindexScopeViolations,
  registeredPageRoutes,
  setEnv,
} from './helpers/robots-scope';

/**
 * The crawler access register (Requirements 6.3, 6.4, 6.5, 6.10, 6.11).
 *
 * The fixtures below describe hypothetical complete records so the fail-closed
 * rules can be exercised. None of them is a recorded decision: the shipped
 * constants are asserted separately, and both are unrecorded.
 */

/** Mid-morning, so the calendar-day truncation is exercised rather than assumed. */
const NOW = new Date('2026-09-29T10:30:00.000Z');

function daysBefore(days: number): string {
  return formatCalendarDate(addCalendarDays(NOW, -days));
}

/** A complete `allowed` record verified ten days before `NOW`. */
function completeAllowed(
  base: CrawlerAccessDecision,
  overrides: Partial<CrawlerAccessDecision> = {}
): CrawlerAccessDecision {
  return {
    ...base,
    decision: 'allowed',
    decidedBy: 'Fixture Decider',
    decidedOn: daysBefore(10),
    guidanceReference: 'Fixture crawler guidance document',
    verifiedOn: daysBefore(10),
    verifiedBy: 'Fixture Verifier',
    ...overrides,
  };
}

const DISALLOW_ALL = (agent: string) => ({ userAgent: [agent], disallow: ['/'] });

describe('the shipped register', () => {
  it('seeds the search decision for OAI-SearchBot as unrecorded, with no invented evidence', () => {
    expect(SEARCH_CRAWL_DECISION).toEqual({
      decisionId: 'search-crawl',
      userAgents: ['OAI-SearchBot'],
      decision: 'unrecorded',
      decidedBy: null,
      decidedOn: null,
      guidanceReference: null,
      verifiedOn: null,
      verifiedBy: null,
    });
  });

  it('seeds the training decision for GPTBot as unrecorded, so training access is not granted by default', () => {
    expect(TRAINING_CRAWL_DECISION).toEqual({
      decisionId: 'training-crawl',
      userAgents: ['GPTBot'],
      decision: 'unrecorded',
      decidedBy: null,
      decidedOn: null,
      guidanceReference: null,
      verifiedOn: null,
      verifiedBy: null,
    });
  });

  it('emits Disallow: / and no Allow line for both shipped decisions', () => {
    const search = buildAgentGroup(SEARCH_CRAWL_DECISION, NOW);
    const training = buildAgentGroup(TRAINING_CRAWL_DECISION, NOW);
    expect(search).toStrictEqual(DISALLOW_ALL('OAI-SearchBot'));
    expect(training).toStrictEqual(DISALLOW_ALL('GPTBot'));
    expect('allow' in search).toBe(false);
    expect('allow' in training).toBe(false);
  });

  // This assertion previously pinned a gap: no section C entry asked for the
  // search-crawl decision, so the map recorded `null`. The register now carries
  // C15 for it, marked as blocking a release, so the expectation is flipped.
  it('names the checklist entry for each decision', () => {
    expect(CRAWLER_DECISION_CHECKLIST_ENTRIES['training-crawl']).toBe('C14');
    expect(CRAWLER_DECISION_CHECKLIST_ENTRIES['search-crawl']).toBe('C15');
  });

  it('holds exactly the two decisions as separate frozen objects', () => {
    expect(CRAWLER_ACCESS_DECISIONS).toEqual([SEARCH_CRAWL_DECISION, TRAINING_CRAWL_DECISION]);
    expect(SEARCH_CRAWL_DECISION).not.toBe(TRAINING_CRAWL_DECISION);
    expect(SEARCH_CRAWL_DECISION.userAgents).not.toBe(TRAINING_CRAWL_DECISION.userAgents);
    for (const decision of CRAWLER_ACCESS_DECISIONS) {
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(decision.userAgents)).toBe(true);
      // The emitted list is a copy, so editing a group cannot edit the register.
      expect(buildAgentGroup(decision, NOW).userAgent).not.toBe(decision.userAgents);
    }
  });

  // Requirement 6.11. This is the assertion that fails the build: the shipped
  // register is evaluated against the build date, so a recorded verification more
  // than 90 days old, or any incomplete record, stops `prebuild`.
  it('passes the audit on the build date', () => {
    expect(auditCrawlerAccess(new Date()).failures).toEqual([]);
  });
});

describe('buildAgentGroup fails closed (Requirement 6.10)', () => {
  it('allows a complete, current allowed decision, and keeps the enquiry API blocked', () => {
    expect(buildAgentGroup(completeAllowed(SEARCH_CRAWL_DECISION), NOW)).toStrictEqual({
      userAgent: ['OAI-SearchBot'],
      allow: ['/'],
      disallow: [ENQUIRY_API_DISALLOW_PATH],
    });
  });

  it('disallows a complete disallowed decision', () => {
    const decision = completeAllowed(TRAINING_CRAWL_DECISION, { decision: 'disallowed' });
    expect(evaluateCrawlerDecision(decision, NOW).failures).toEqual([]);
    expect(buildAgentGroup(decision, NOW)).toStrictEqual(DISALLOW_ALL('GPTBot'));
  });

  it('disallows an unrecorded decision even when a current verification is recorded', () => {
    const decision = completeAllowed(TRAINING_CRAWL_DECISION, {
      decision: 'unrecorded',
      decidedBy: null,
      decidedOn: null,
    });
    expect(evaluateCrawlerDecision(decision, NOW).failures).toEqual([]);
    expect(buildAgentGroup(decision, NOW)).toStrictEqual(DISALLOW_ALL('GPTBot'));
  });

  it.each([
    ['decidedBy', 'no deciding person'],
    ['decidedOn', 'no valid decision date'],
    ['guidanceReference', 'no crawler guidance reference'],
    ['verifiedOn', 'no valid verification date'],
    ['verifiedBy', 'no verifying person'],
  ] as const)('disallows an allowed decision with no %s', (field, reason) => {
    const missing: Partial<CrawlerAccessDecision> = { [field]: null };
    const decision = completeAllowed(SEARCH_CRAWL_DECISION, missing);
    const evaluation = evaluateCrawlerDecision(decision, NOW);
    expect(evaluation.grantsAccess).toBe(false);
    expect(evaluation.failures.join('\n')).toContain(reason);
    expect(buildAgentGroup(decision, NOW)).toStrictEqual(DISALLOW_ALL('OAI-SearchBot'));
  });

  it('disallows an allowed decision signed by a desk rather than a person', () => {
    const decision = completeAllowed(SEARCH_CRAWL_DECISION, { decidedBy: 'Research Desk' });
    expect(evaluateCrawlerDecision(decision, NOW).failures.join('\n')).toContain('accountable person');
    expect(buildAgentGroup(decision, NOW)).toStrictEqual(DISALLOW_ALL('OAI-SearchBot'));
  });

  it('disallows a decision value outside the three recognised values', () => {
    const decision = completeAllowed(SEARCH_CRAWL_DECISION, {
      decision: 'yes' as unknown as CrawlerAccessDecision['decision'],
    });
    expect(buildAgentGroup(decision, NOW)).toStrictEqual(DISALLOW_ALL('OAI-SearchBot'));
  });

  it('rejects an unrecorded value that names a decider', () => {
    const decision = { ...TRAINING_CRAWL_DECISION, decidedBy: 'Fixture Decider' };
    expect(evaluateCrawlerDecision(decision, NOW).failures.join('\n')).toContain(
      'records no decision value'
    );
  });
});

describe('the 90-day verification window (Requirements 6.5 and 6.11)', () => {
  it('is 90 days', () => {
    expect(CRAWLER_VERIFICATION_MAX_AGE_DAYS).toBe(90);
  });

  it.each([
    [89, true],
    [90, true],
    [91, false],
  ])('a verification %i days before the evaluation date grants access: %s', (age, grants) => {
    const decision = completeAllowed(SEARCH_CRAWL_DECISION, {
      decidedOn: daysBefore(age),
      verifiedOn: daysBefore(age),
    });
    const evaluation = evaluateCrawlerDecision(decision, NOW);

    expect(evaluation.verificationAgeDays).toBe(age);
    expect(evaluation.grantsAccess).toBe(grants);
    expect(auditCrawlerAccess(NOW, [decision, TRAINING_CRAWL_DECISION]).ok).toBe(grants);
    expect('allow' in buildAgentGroup(decision, NOW)).toBe(grants);
    if (!grants) expect(evaluation.failures.join('\n')).toContain('last verified 91 days');
  });

  it('fails a stale verification on an unrecorded decision too, because it is still a crawler rule', () => {
    const decision = completeAllowed(TRAINING_CRAWL_DECISION, {
      decision: 'unrecorded',
      decidedBy: null,
      decidedOn: null,
      verifiedOn: daysBefore(91),
    });
    expect(auditCrawlerAccess(NOW, [SEARCH_CRAWL_DECISION, decision]).ok).toBe(false);
  });

  it('evaluates against the injected date, not the clock', () => {
    const decision = completeAllowed(SEARCH_CRAWL_DECISION);
    expect(evaluateCrawlerDecision(decision, NOW).grantsAccess).toBe(true);
    expect(evaluateCrawlerDecision(decision, addCalendarDays(NOW, 81)).grantsAccess).toBe(false);
  });

  it('rejects a verification dated after the evaluation date', () => {
    const decision = completeAllowed(SEARCH_CRAWL_DECISION, {
      verifiedOn: formatCalendarDate(addCalendarDays(NOW, 1)),
    });
    expect(evaluateCrawlerDecision(decision, NOW).failures.join('\n')).toContain(
      'after the evaluation date'
    );
    expect(buildAgentGroup(decision, NOW)).toStrictEqual(DISALLOW_ALL('OAI-SearchBot'));
  });

  it('reports no age when no verification is recorded', () => {
    expect(crawlerVerificationAgeDays(SEARCH_CRAWL_DECISION, NOW)).toBeNull();
    expect(crawlerVerificationAgeDays(TRAINING_CRAWL_DECISION, NOW)).toBeNull();
  });
});

describe('the two decisions are independent (Requirement 6.3)', () => {
  it("leaves each group byte-identical when the other decision changes", () => {
    const trainingBefore = JSON.stringify(buildAgentGroup(TRAINING_CRAWL_DECISION, NOW));
    const searchBefore = JSON.stringify(buildAgentGroup(SEARCH_CRAWL_DECISION, NOW));

    const changedSearch = completeAllowed(SEARCH_CRAWL_DECISION);
    const changedTraining = completeAllowed(TRAINING_CRAWL_DECISION);
    expect(JSON.stringify(buildAgentGroup(changedSearch, NOW))).not.toBe(searchBefore);
    expect(JSON.stringify(buildAgentGroup(changedTraining, NOW))).not.toBe(trainingBefore);

    expect(JSON.stringify(buildAgentGroup(TRAINING_CRAWL_DECISION, NOW))).toBe(trainingBefore);
    expect(JSON.stringify(buildAgentGroup(SEARCH_CRAWL_DECISION, NOW))).toBe(searchBefore);
  });

  it('fails the audit when two decisions name the same user agent', () => {
    const overlapping = { ...TRAINING_CRAWL_DECISION, userAgents: ['OAI-SearchBot'] };
    expect(auditCrawlerAccess(NOW, [SEARCH_CRAWL_DECISION, overlapping]).failures.join('\n')).toContain(
      'named by both search-crawl and training-crawl'
    );
  });

  it('fails a decision that names the wildcard user agent', () => {
    const wildcard = { ...TRAINING_CRAWL_DECISION, userAgents: ['*'] };
    expect(evaluateCrawlerDecision(wildcard, NOW).failures.join('\n')).toContain('wildcard');
  });
});

// ---------------------------------------------------------------------------
// Through the robots route (Requirements 6.3 and 6.11)
//
// The tests above prove the builder. These prove the file a crawler reads: the
// served robots.txt text, in production with a confirmed domain, which is the only
// state in which the per-agent groups are served at all.
// ---------------------------------------------------------------------------

describe('through the robots route, in production with a confirmed domain', () => {
  beforeEach(() => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
    process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
    // `robots()` evaluates against the clock, so the clock is pinned to `NOW`.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    served.search = undefined;
    served.training = undefined;
    vi.useRealTimers();
  });

  /** The served text of the group naming `agent`, exactly as a crawler reads it. */
  function servedGroup(agent: string): string {
    const text = resolveRobots(robots());
    const blocks = text.split('\n\n').filter((block) => block.startsWith(`User-Agent: ${agent}\n`));
    expect(blocks, `exactly one group names ${agent}`).toHaveLength(1);
    return blocks[0]!;
  }

  const DISALLOWED_BLOCK = (agent: string) => `User-Agent: ${agent}\nDisallow: /`;
  const ALLOWED_BLOCK = (agent: string) => `User-Agent: ${agent}\nAllow: /\nDisallow: ${ENQUIRY_API_DISALLOW_PATH}`;

  /** Every way one decision can change, each of which changes its own served group or not. */
  const mutations = (base: CrawlerAccessDecision): [string, CrawlerAccessDecision][] => [
    ['complete and allowed', completeAllowed(base)],
    ['complete and disallowed', completeAllowed(base, { decision: 'disallowed' })],
    ['allowed but stale', completeAllowed(base, { verifiedOn: daysBefore(91) })],
    ['allowed with no decider', completeAllowed(base, { decidedBy: null })],
    ['an unrecognised value', completeAllowed(base, { decision: 'yes' as unknown as CrawlerAccessDecision['decision'] })],
  ];

  it('serves both shipped decisions as Disallow: / before anything is swapped', () => {
    expect(servedGroup('OAI-SearchBot')).toBe(DISALLOWED_BLOCK('OAI-SearchBot'));
    expect(servedGroup('GPTBot')).toBe(DISALLOWED_BLOCK('GPTBot'));
  });

  it.each(mutations(SEARCH_CRAWL_DECISION))(
    'leaves the served GPTBot group byte-identical when the search decision is %s',
    (_label, mutated) => {
      const trainingBefore = servedGroup('GPTBot');
      const searchBefore = servedGroup('OAI-SearchBot');

      served.search = mutated;
      const searchAfter = servedGroup('OAI-SearchBot');
      expect(searchAfter).toBe(
        evaluateCrawlerDecision(mutated, NOW).grantsAccess ? ALLOWED_BLOCK('OAI-SearchBot') : searchBefore
      );
      expect(servedGroup('GPTBot')).toBe(trainingBefore);
    }
  );

  it.each(mutations(TRAINING_CRAWL_DECISION))(
    'leaves the served OAI-SearchBot group byte-identical when the training decision is %s',
    (_label, mutated) => {
      const searchBefore = servedGroup('OAI-SearchBot');
      const trainingBefore = servedGroup('GPTBot');

      served.training = mutated;
      const trainingAfter = servedGroup('GPTBot');
      expect(trainingAfter).toBe(
        evaluateCrawlerDecision(mutated, NOW).grantsAccess ? ALLOWED_BLOCK('GPTBot') : trainingBefore
      );
      expect(servedGroup('OAI-SearchBot')).toBe(searchBefore);
    }
  );

  it('keeps each group byte-identical while the other flips between allowed and disallowed', () => {
    // Search allowed, so the GPTBot comparison runs against a non-default neighbour too.
    served.search = completeAllowed(SEARCH_CRAWL_DECISION);
    const trainingWithSearchAllowed = servedGroup('GPTBot');
    served.search = completeAllowed(SEARCH_CRAWL_DECISION, { decision: 'disallowed' });
    expect(servedGroup('GPTBot')).toBe(trainingWithSearchAllowed);

    served.training = completeAllowed(TRAINING_CRAWL_DECISION);
    const searchWithTrainingAllowed = servedGroup('OAI-SearchBot');
    served.training = completeAllowed(TRAINING_CRAWL_DECISION, { decision: 'disallowed' });
    expect(servedGroup('OAI-SearchBot')).toBe(searchWithTrainingAllowed);
  });

  it.each([
    [89, true],
    [90, true],
    [91, false],
  ])('serves Allow for a verification %i days before the build date: %s', (age, grants) => {
    const dated = { decidedOn: daysBefore(age), verifiedOn: daysBefore(age) };
    const search = completeAllowed(SEARCH_CRAWL_DECISION, dated);
    const training = completeAllowed(TRAINING_CRAWL_DECISION, dated);
    served.search = search;
    served.training = training;

    for (const agent of ['OAI-SearchBot', 'GPTBot']) {
      expect(servedGroup(agent)).toBe(grants ? ALLOWED_BLOCK(agent) : DISALLOWED_BLOCK(agent));
    }
    // The same boundary fails the build through the audit (Requirement 6.11).
    expect(auditCrawlerAccess(new Date(), [search, training]).ok).toBe(grants);
  });

  it('closes a served Allow line once the clock passes day 90, with no record change', () => {
    served.search = completeAllowed(SEARCH_CRAWL_DECISION, { verifiedOn: daysBefore(90) });
    expect(servedGroup('OAI-SearchBot')).toBe(ALLOWED_BLOCK('OAI-SearchBot'));
    vi.setSystemTime(addCalendarDays(NOW, 1));
    expect(servedGroup('OAI-SearchBot')).toBe(DISALLOWED_BLOCK('OAI-SearchBot'));
  });

  /**
   * The two tests above change one decision at a time. These two close what that
   * leaves open, both of them in the served bytes rather than in the builder.
   *
   * The first states independence in its strongest byte form: an agent's served
   * block is the same bytes whether the other decision was left alone or replaced.
   * The tests above compare a group before and after *its neighbour* changed; this
   * one compares a group served beside a changed neighbour against the same group
   * served beside an untouched one, which is what "independent" has to mean if the
   * register is ever to grant one crawler and not the other.
   *
   * The second puts the 90-day boundary either side of itself in one file. The
   * boundary cases above give both decisions the same verification age, so a
   * register that applied the oldest verification to every group would pass them.
   */
  it('gives each agent the same served bytes whether or not the other decision changed', () => {
    const searchAllowed = completeAllowed(SEARCH_CRAWL_DECISION);
    const trainingAllowed = completeAllowed(TRAINING_CRAWL_DECISION);

    // Each block as served with the *other* decision left exactly as shipped.
    served.search = searchAllowed;
    const searchBeside_shipped = servedGroup('OAI-SearchBot');
    served.search = undefined;
    served.training = trainingAllowed;
    const trainingBeside_shipped = servedGroup('GPTBot');
    expect(searchBeside_shipped).toBe(ALLOWED_BLOCK('OAI-SearchBot'));
    expect(trainingBeside_shipped).toBe(ALLOWED_BLOCK('GPTBot'));

    // Both replaced at once, in every pairing of the neighbour's outcomes.
    for (const neighbour of [
      trainingAllowed,
      completeAllowed(TRAINING_CRAWL_DECISION, { decision: 'disallowed' }),
      completeAllowed(TRAINING_CRAWL_DECISION, { verifiedOn: daysBefore(91) }),
    ]) {
      served.search = searchAllowed;
      served.training = neighbour;
      expect(servedGroup('OAI-SearchBot')).toBe(searchBeside_shipped);
    }
    for (const neighbour of [
      searchAllowed,
      completeAllowed(SEARCH_CRAWL_DECISION, { decision: 'disallowed' }),
      completeAllowed(SEARCH_CRAWL_DECISION, { verifiedOn: daysBefore(91) }),
    ]) {
      served.training = trainingAllowed;
      served.search = neighbour;
      expect(servedGroup('GPTBot')).toBe(trainingBeside_shipped);
    }
  });

  it('applies the 90-day boundary to each decision separately within one served file', () => {
    const current = { verifiedOn: daysBefore(90) };
    const stale = { verifiedOn: daysBefore(91) };

    const searchCurrent = completeAllowed(SEARCH_CRAWL_DECISION, current);
    const trainingStale = completeAllowed(TRAINING_CRAWL_DECISION, stale);
    served.search = searchCurrent;
    served.training = trainingStale;
    expect(servedGroup('OAI-SearchBot')).toBe(ALLOWED_BLOCK('OAI-SearchBot'));
    expect(servedGroup('GPTBot')).toBe(DISALLOWED_BLOCK('GPTBot'));
    // Requirement 6.11 is about the register, not about one group: one stale
    // verification fails the build even while the other group keeps its Allow line.
    expect(auditCrawlerAccess(NOW, [searchCurrent, trainingStale]).ok).toBe(false);

    const searchStale = completeAllowed(SEARCH_CRAWL_DECISION, stale);
    const trainingCurrent = completeAllowed(TRAINING_CRAWL_DECISION, current);
    served.search = searchStale;
    served.training = trainingCurrent;
    expect(servedGroup('OAI-SearchBot')).toBe(DISALLOWED_BLOCK('OAI-SearchBot'));
    expect(servedGroup('GPTBot')).toBe(ALLOWED_BLOCK('GPTBot'));
    expect(auditCrawlerAccess(NOW, [searchStale, trainingCurrent]).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The rest of the file, and the Requirement 6.6 scoping decision
//
// The block above proves each agent's own group is unaffected by the other
// decision. These two add what that leaves open: that nothing *else* in the
// served file moves either — the wildcard group and the sitemap line included —
// and that the page-route scoping decision holds for the group shapes this
// register can actually produce. `tests/robots.test.ts` checks the scope on the
// shipped register, where both decisions are unrecorded and every per-agent group
// is a whole-site denial, so the allowed shape below is never exercised there.
// ---------------------------------------------------------------------------

describe('a changed decision moves nothing else in the served file (Requirement 6.3)', () => {
  beforeEach(() => {
    setEnv({
      INSTLE_DEPLOY_ENV: 'production',
      INSTLE_PUBLIC_ORIGIN: 'https://example-instle.test',
      INSTLE_DOMAIN_CONFIRMED: 'true',
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    served.search = undefined;
    served.training = undefined;
    vi.useRealTimers();
  });

  /** The whole served file with the group naming `agent` removed, blocks in order. */
  function servedTextWithout(agent: string): string {
    return resolveRobots(robots())
      .split('\n\n')
      .filter((block) => !block.startsWith(`User-Agent: ${agent}\n`))
      .join('\n\n');
  }

  it.each([
    ['search', 'OAI-SearchBot', SEARCH_CRAWL_DECISION] as const,
    ['training', 'GPTBot', TRAINING_CRAWL_DECISION] as const,
  ])('leaves every other byte identical when the %s decision is granted', (key, agent, base) => {
    const before = servedTextWithout(agent);
    // Sanity: the remainder is the real file, not an empty string.
    expect(before).toContain('User-Agent: *\nAllow: /');
    expect(before).toContain('Sitemap: https://example-instle.test/sitemap.xml');

    served[key] = completeAllowed(base);
    // The decision's own group did change, so the comparison is not vacuous.
    expect(resolveRobots(robots())).toContain(`User-Agent: ${agent}\nAllow: /`);
    expect(servedTextWithout(agent)).toBe(before);
  });
});

describe('the Requirement 6.6 page-route scoping decision', () => {
  beforeEach(() => {
    setEnv({
      INSTLE_DEPLOY_ENV: 'production',
      INSTLE_PUBLIC_ORIGIN: 'https://example-instle.test',
      INSTLE_DOMAIN_CONFIRMED: 'true',
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    served.search = undefined;
    served.training = undefined;
    vi.useRealTimers();
  });

  it('names the routes, the groups and the two excluded route kinds, frozen', () => {
    expect(NOINDEX_DISALLOW_SCOPE.routes).toBe('registered-page-routes');
    expect(NOINDEX_DISALLOW_SCOPE.groups).toBe('crawl-permitting');
    expect(NOINDEX_DISALLOW_SCOPE.excludedGroups).toBe('whole-site-denial');
    expect(Object.keys(NOINDEX_DISALLOW_SCOPE.excludedRouteKinds)).toEqual(['route-handler', 'metadata-route']);
    // The enquiry API is the collision the decision exists to settle (6.6 against 6.7).
    expect(NOINDEX_DISALLOW_SCOPE.excludedRouteKinds['route-handler']).toContain(ENQUIRY_API_DISALLOW_PATH);
    expect(Object.isFrozen(NOINDEX_DISALLOW_SCOPE)).toBe(true);
    expect(Object.isFrozen(NOINDEX_DISALLOW_SCOPE.excludedRouteKinds)).toBe(true);
  });

  it('holds when a per-agent decision grants access, so the group permits crawling', () => {
    served.search = completeAllowed(SEARCH_CRAWL_DECISION);
    served.training = completeAllowed(TRAINING_CRAWL_DECISION);
    const result = robots();

    // Both per-agent groups now allow crawling, which is the shape 6.6 is about.
    const named = groupsOf(result).filter((group) => !list(group.userAgent).includes('*'));
    expect(named).toHaveLength(2);
    for (const group of named) {
      expect(isWholeSiteDenial(group), list(group.userAgent).join(', ')).toBe(false);
      expect(list(group.allow)).toEqual(['/']);
    }

    expect(noindexScopeViolations(result, registeredPageRoutes())).toEqual([]);
  });

  it('keeps the enquiry API disallowed for an allowed crawler, outside the page-route scope', () => {
    served.search = completeAllowed(SEARCH_CRAWL_DECISION);
    const search = groupsOf(robots()).find((group) => list(group.userAgent).includes('OAI-SearchBot'));
    expect(list(search!.disallow)).toEqual([ENQUIRY_API_DISALLOW_PATH]);
    expect(registeredPageRoutes()).not.toContain('/api/enquiry');
  });

  /**
   * The shape the register will actually take first: one decision recorded and
   * granted, the other refused or still unrecorded. The test above sets both to
   * `allowed`, so the file it checks holds no whole-site denial at all and the
   * `excludedGroups` half of the decision does no work in it.
   */
  it('holds with the two decisions in opposite states, one permitting and one denying', () => {
    served.search = completeAllowed(SEARCH_CRAWL_DECISION);
    served.training = completeAllowed(TRAINING_CRAWL_DECISION, { decision: 'disallowed' });
    const result = robots();
    const routes = registeredPageRoutes();

    const search = groupsOf(result).find((group) => list(group.userAgent).includes('OAI-SearchBot'));
    const training = groupsOf(result).find((group) => list(group.userAgent).includes('GPTBot'));
    expect(isWholeSiteDenial(search!)).toBe(false);
    expect(isWholeSiteDenial(training!)).toBe(true);
    expect(noindexScopeViolations(result, routes)).toEqual([]);

    // And the exclusion is load-bearing rather than incidental: give the denying
    // group an Allow line, so it stops being a whole-site denial, and its
    // `Disallow: /` is reported over every page route.
    const notADenial = noindexScopeViolations({ rules: [{ ...training!, allow: ['/'] }] }, routes);
    expect(notADenial).toHaveLength(routes.length);
    expect(notADenial[0]).toContain('GPTBot: Disallow: / covers ');
  });
});
