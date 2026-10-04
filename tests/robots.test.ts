import type { Metadata, MetadataRoute } from 'next';
import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import { describe, expect, it } from 'vitest';

import robots, { dynamic as robotsDynamic } from '@/app/robots';
import { PROTOTYPE_ROUTE_PREFIXES, isPrototypeRoute } from '@/config/constants';
import {
  ENQUIRY_API_DISALLOW_PATH,
  SEARCH_CRAWL_DECISION,
  TRAINING_CRAWL_DECISION,
  buildAgentGroup,
} from '@/config/crawler-access';
import { GUIDE_REGISTRY } from '@/config/guides';
import { getAllLocalitySlugs } from '@/config/localities';
import { getPublicRoutes } from '@/lib/public-routes';
/**
 * The matching, the page-route enumeration and the Requirement 6.6 scoping
 * decision live in `tests/helpers/robots-scope.ts`, because
 * `tests/crawler-access.test.ts` and the Property 15 test assert over the same
 * output and importing a test file from a test file would run its cases twice.
 * Every one of them is still asserted here, beside the Requirement 6.6 tests.
 */
import {
  BLOCKED_TEXT,
  NOINDEX_DISALLOW_SCOPE,
  UNREGISTERED_PATH,
  isAllowedBy,
  isWholeSiteDenial,
  groupsOf,
  list,
  noindexScopeViolations,
  pageFiles,
  patternMatches,
  registeredPageRoutes,
  setEnv,
  type Env,
  type Group,
} from './helpers/robots-scope';

export {
  BLOCKED_TEXT,
  NOINDEX_DISALLOW_SCOPE,
  groupsOf,
  isWholeSiteDenial,
  list,
  noindexScopeViolations,
  registeredPageRoutes,
  setEnv,
  type Env,
  type Group,
};

/**
 * robots.txt (Requirements 6.1, 6.2 and 6.6).
 *
 * Output is compared as served: `resolveRobots` is the serialiser Next.js runs
 * over the value `robots()` returns, so the text below is the file a crawler reads.
 */

const ORIGIN = 'https://example-instle.test';

const CONFIRMED_DOMAIN: Env = { INSTLE_PUBLIC_ORIGIN: ORIGIN, INSTLE_DOMAIN_CONFIRMED: 'true' };
const PRODUCTION: Env = { INSTLE_DEPLOY_ENV: 'production', ...CONFIRMED_DOMAIN };

// ---------------------------------------------------------------------------
// Requirement 6.1: blocked unless exactly production with a confirmed domain
// ---------------------------------------------------------------------------

describe('robots.txt outside production (Requirement 6.1)', () => {
  it('is evaluated per request', () => {
    expect(robotsDynamic).toBe('force-dynamic');
  });

  it.each<[string, Env]>([
    ['no environment at all', {}],
    ['an absent deploy value with a confirmed domain', CONFIRMED_DOMAIN],
    ['an empty deploy value with a confirmed domain', { INSTLE_DEPLOY_ENV: '', ...CONFIRMED_DOMAIN }],
    ['a blank deploy value with a confirmed domain', { INSTLE_DEPLOY_ENV: '   ', ...CONFIRMED_DOMAIN }],
    ['preview with a confirmed domain', { INSTLE_DEPLOY_ENV: 'preview', ...CONFIRMED_DOMAIN }],
    ['development with a confirmed domain', { INSTLE_DEPLOY_ENV: 'development', ...CONFIRMED_DOMAIN }],
    ['an unrecognised deploy value', { INSTLE_DEPLOY_ENV: 'prod', ...CONFIRMED_DOMAIN }],
    ['PRODUCTION in capitals', { INSTLE_DEPLOY_ENV: 'PRODUCTION', ...CONFIRMED_DOMAIN }],
    ['production with surrounding spaces', { INSTLE_DEPLOY_ENV: ' production ', ...CONFIRMED_DOMAIN }],
    ['production with no domain at all', { INSTLE_DEPLOY_ENV: 'production' }],
    ['production with an origin but no confirmation', { INSTLE_DEPLOY_ENV: 'production', INSTLE_PUBLIC_ORIGIN: ORIGIN }],
    ['production with confirmation but no origin', { INSTLE_DEPLOY_ENV: 'production', INSTLE_DOMAIN_CONFIRMED: 'true' }],
    [
      'production with a non-https origin',
      { INSTLE_DEPLOY_ENV: 'production', INSTLE_PUBLIC_ORIGIN: 'http://example-instle.test', INSTLE_DOMAIN_CONFIRMED: 'true' },
    ],
  ])('serves one Disallow: / group, no Allow line and no sitemap for %s', (_label, env) => {
    setEnv(env);
    const result = robots();

    expect(result).toStrictEqual({ rules: [{ userAgent: '*', disallow: '/' }] });
    const text = resolveRobots(result);
    expect(text).toBe(BLOCKED_TEXT);
    expect(text).not.toMatch(/^Allow:/im);
    expect(text).not.toMatch(/sitemap/i);
  });

  it('follows the environment on each call rather than the first', () => {
    setEnv(PRODUCTION);
    expect(resolveRobots(robots())).not.toBe(BLOCKED_TEXT);
    setEnv({ ...PRODUCTION, INSTLE_DEPLOY_ENV: 'preview' });
    expect(resolveRobots(robots())).toBe(BLOCKED_TEXT);
    setEnv(PRODUCTION);
    expect(resolveRobots(robots())).not.toBe(BLOCKED_TEXT);
  });
});

// ---------------------------------------------------------------------------
// Requirement 6.2: production with a confirmed domain
// ---------------------------------------------------------------------------

describe('robots.txt in production with a confirmed domain (Requirement 6.2)', () => {
  it('serves the wildcard group, one group per crawler decision, and the sitemap', () => {
    setEnv(PRODUCTION);
    expect(resolveRobots(robots())).toBe(
      [
        'User-Agent: *',
        'Allow: /',
        'Disallow: /api/',
        '',
        'User-Agent: OAI-SearchBot',
        'Disallow: /',
        '',
        'User-Agent: GPTBot',
        'Disallow: /',
        '',
        `Sitemap: ${ORIGIN}/sitemap.xml`,
        '',
      ].join('\n')
    );
  });

  it('names the sitemap as one absolute URL on the confirmed origin', () => {
    setEnv(PRODUCTION);
    const { sitemap } = robots();
    expect(typeof sitemap).toBe('string');
    const url = new URL(sitemap as string);
    expect(url.origin).toBe(ORIGIN);
    expect(url.pathname).toBe('/sitemap.xml');
  });

  it('puts the wildcard group first, so it covers every agent not named later', () => {
    setEnv(PRODUCTION);
    const [wildcard, ...named] = groupsOf(robots());
    expect(wildcard).toStrictEqual({ userAgent: '*', allow: '/', disallow: [ENQUIRY_API_DISALLOW_PATH] });
    expect(named.flatMap((group) => list(group.userAgent))).not.toContain('*');
  });

  it('allows every gate-passing route and blocks the enquiry API for the wildcard group', () => {
    setEnv(PRODUCTION);
    const [wildcard] = groupsOf(robots());
    const routes = getPublicRoutes(new Date()).map((route) => route.path);
    expect(routes.length).toBeGreaterThan(0);
    for (const path of routes) {
      expect(isAllowedBy(wildcard!, path), path).toBe(true);
    }
    expect(isAllowedBy(wildcard!, '/api/enquiry')).toBe(false);
  });

  it('builds each per-agent group from its own decision', () => {
    setEnv(PRODUCTION);
    const [, search, training] = groupsOf(robots());
    const now = new Date();
    expect(search).toStrictEqual(buildAgentGroup(SEARCH_CRAWL_DECISION, now));
    expect(training).toStrictEqual(buildAgentGroup(TRAINING_CRAWL_DECISION, now));
    expect(search).not.toBe(training);
    expect(search!.userAgent).not.toBe(SEARCH_CRAWL_DECISION.userAgents);
    expect(training!.userAgent).not.toBe(TRAINING_CRAWL_DECISION.userAgents);
  });

  it('serves Disallow: / for GPTBot while the training decision is unrecorded', () => {
    setEnv(PRODUCTION);
    expect(TRAINING_CRAWL_DECISION.decision).toBe('unrecorded');
    const training = groupsOf(robots()).find((group) => list(group.userAgent).includes('GPTBot'));
    expect(training).toStrictEqual({ userAgent: ['GPTBot'], disallow: ['/'] });
  });
});

// ---------------------------------------------------------------------------
// Requirement 6.6: no noindex page route under a Disallow line
// ---------------------------------------------------------------------------

describe('noindex page routes stay fetchable (Requirement 6.6)', () => {
  it('records the scoping decision', () => {
    expect(NOINDEX_DISALLOW_SCOPE.routes).toBe('registered-page-routes');
    expect(Object.keys(NOINDEX_DISALLOW_SCOPE.excludedRouteKinds)).toEqual(['route-handler', 'metadata-route']);
    expect(NOINDEX_DISALLOW_SCOPE.excludedGroups).toBe('whole-site-denial');
  });

  it('enumerates every page file, every prototype, every registered slug and the not-found page', () => {
    const routes = registeredPageRoutes();
    const patterns = pageFiles().map((page) => page.pattern);

    expect(patterns).toContain('/');
    for (const pattern of patterns.filter((p) => !p.includes('['))) expect(routes).toContain(pattern);
    for (const prefix of PROTOTYPE_ROUTE_PREFIXES) expect(routes).toContain(prefix);
    expect(routes).toContain('/concept-1/intake');
    for (const route of getPublicRoutes(new Date())) expect(routes).toContain(route.path);
    for (const slug of getAllLocalitySlugs()) expect(routes).toContain(`/areas/${slug}`);
    for (const guide of GUIDE_REGISTRY) expect(routes).toContain(`/guides/${guide.slug}`);
    expect(routes).toContain(UNREGISTERED_PATH);

    // Excluded by kind: a route handler is not a page.
    expect(routes.some((path) => path.startsWith('/api'))).toBe(false);
  });

  it('includes the routes that carry noindex in every environment', async () => {
    const routes = registeredPageRoutes();
    const noindexPages = pageFiles().filter((page) => isPrototypeRoute(page.pattern));
    expect(noindexPages.length).toBeGreaterThanOrEqual(PROTOTYPE_ROUTE_PREFIXES.length);

    for (const page of noindexPages) {
      const { metadata } = (await import(page.file)) as { metadata: Metadata };
      expect(metadata.robots, page.pattern).toMatchObject({ index: false });
      expect(routes).toContain(page.pattern);
    }

    const { metadata: notFound } = (await import('@/app/not-found')) as { metadata: Metadata };
    expect(notFound.robots).toMatchObject({ index: false });
    // Importing the page modules is the slow part, and slower still under a full parallel run.
  }, 30_000);

  it('finds a Disallow line covering a noindex page when one is added', () => {
    const planted: MetadataRoute.Robots = {
      rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/concept-1'] }],
    };
    expect(noindexScopeViolations(planted, registeredPageRoutes())).toEqual([
      '*: Disallow: /concept-1 covers /concept-1',
      '*: Disallow: /concept-1 covers /concept-1/intake',
    ]);
  });

  it('records the whole scoping decision, frozen, so it cannot be widened or narrowed at run time', () => {
    expect(NOINDEX_DISALLOW_SCOPE.groups).toBe('crawl-permitting');
    expect(NOINDEX_DISALLOW_SCOPE.enumeration).toEqual([
      'every page file under src/app, mapped to its URL path',
      'each dynamic segment expanded to every registered slug, gate-passing or not, plus one unregistered slug',
      'one unregistered path, which the not-found page serves with noindex',
    ]);
    // The enquiry API is excluded by kind, and the reason names it.
    expect(NOINDEX_DISALLOW_SCOPE.excludedRouteKinds['route-handler']).toContain('/api/enquiry');
    expect(NOINDEX_DISALLOW_SCOPE.excludedRouteKinds['route-handler']).toContain('Disallow: /api/');
    for (const value of [
      NOINDEX_DISALLOW_SCOPE,
      NOINDEX_DISALLOW_SCOPE.enumeration,
      NOINDEX_DISALLOW_SCOPE.excludedRouteKinds,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  it('finds a Disallow line planted in a named crawl-permitting group, including a wildcard pattern', () => {
    const planted: MetadataRoute.Robots = {
      rules: [
        { userAgent: '*', allow: '/', disallow: ['/api/'] },
        { userAgent: ['OAI-SearchBot'], allow: ['/'], disallow: ['/api/', '/*/intake$'] },
        { userAgent: ['GPTBot'], disallow: ['/'] },
      ],
    };
    expect(noindexScopeViolations(planted, registeredPageRoutes())).toEqual([
      'OAI-SearchBot: Disallow: /*/intake$ covers /concept-1/intake',
      'OAI-SearchBot: Disallow: /*/intake$ covers /concept-2/intake',
    ]);
  });

  it('does not excuse a group that allows / and disallows / as a whole-site denial', () => {
    const group: Group = { userAgent: ['OAI-SearchBot'], allow: ['/'], disallow: ['/'] };
    expect(isWholeSiteDenial(group)).toBe(false);
    const violations = noindexScopeViolations({ rules: [group] }, registeredPageRoutes());
    // Every page route is reported, prototypes and the not-found path included.
    expect(violations).toHaveLength(registeredPageRoutes().length);
    expect(violations).toContain('OAI-SearchBot: Disallow: / covers /concept-1');
    expect(violations).toContain(`OAI-SearchBot: Disallow: / covers ${UNREGISTERED_PATH}`);
  });

  it('puts no registered page route under a Disallow line in production', () => {
    setEnv(PRODUCTION);
    const result = robots();
    // The wildcard group permits crawling, so the check below is not vacuous.
    expect(groupsOf(result).filter((group) => !isWholeSiteDenial(group)).length).toBeGreaterThan(0);
    expect(noindexScopeViolations(result, registeredPageRoutes())).toEqual([]);
  });

  it('leaves only whole-site denial outside production, which Requirement 6.1 governs', () => {
    const result = robots();
    expect(groupsOf(result).every(isWholeSiteDenial)).toBe(true);
    expect(noindexScopeViolations(result, registeredPageRoutes())).toEqual([]);
  });

  it('keeps the enquiry API under Disallow, outside the page-route scope', () => {
    setEnv(PRODUCTION);
    const [wildcard] = groupsOf(robots());
    expect(list(wildcard!.disallow).some((pattern) => patternMatches(pattern, '/api/enquiry'))).toBe(true);
    expect(registeredPageRoutes()).not.toContain('/api/enquiry');
  });
});
