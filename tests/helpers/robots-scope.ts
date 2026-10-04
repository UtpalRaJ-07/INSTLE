/**
 * robots.txt matching, page-route enumeration and the Requirement 6.6 scoping
 * decision — shared by `tests/robots.test.ts`, `tests/crawler-access.test.ts` and
 * `tests/properties/crawler-access.property.test.ts`.
 *
 * Extracted from `tests/robots.test.ts` unchanged. It moved here because three
 * test files now assert over the same output and a test file cannot be imported
 * from another test file without running its `describe`s twice. The scoping
 * decision below is still asserted field by field beside the Requirement 6.6
 * assertions in `tests/robots.test.ts`, which is where task 12.2 records it.
 */

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MetadataRoute } from 'next';

import { GUIDE_REGISTRY } from '@/config/guides';
import { getAllLocalitySlugs } from '@/config/localities';

const APP_DIR = fileURLToPath(new URL('../../src/app', import.meta.url));

export type Group = Extract<MetadataRoute.Robots['rules'], readonly unknown[]>[number];
export type Env = Partial<Record<'INSTLE_DEPLOY_ENV' | 'INSTLE_PUBLIC_ORIGIN' | 'INSTLE_DOMAIN_CONFIRMED', string>>;

/** The served text of the blocked response, byte for byte. */
export const BLOCKED_TEXT = 'User-Agent: *\nDisallow: /\n\n';

/** Replaces the three variables; `tests/setup.ts` clears them between tests. */
export function setEnv(env: Env) {
  for (const key of ['INSTLE_DEPLOY_ENV', 'INSTLE_PUBLIC_ORIGIN', 'INSTLE_DOMAIN_CONFIRMED'] as const) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
}

export function groupsOf(result: MetadataRoute.Robots): Group[] {
  return Array.isArray(result.rules) ? [...result.rules] : [result.rules as Group];
}

export function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

// ---------------------------------------------------------------------------
// RFC 9309 matching
// ---------------------------------------------------------------------------

/** `*` matches any run of characters and a trailing `$` anchors the end. */
export function patternMatches(pattern: string, path: string): boolean {
  // An empty pattern is not a rule (RFC 9309 section 2.2.2).
  if (pattern === '') return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${source}${anchored ? '$' : ''}`).test(path);
}

/** The longest matching rule wins, and Allow wins a tie (RFC 9309 section 2.2.2). */
export function isAllowedBy(group: Group, path: string): boolean {
  const longest = (patterns: string[]) =>
    Math.max(-1, ...patterns.filter((pattern) => patternMatches(pattern, path)).map((p) => p.length));
  return longest(list(group.allow)) >= longest(list(group.disallow));
}

/** A group allowing nothing at all: every crawler it names is denied the whole site. */
export function isWholeSiteDenial(group: Group): boolean {
  return (
    list(group.allow).every((pattern) => pattern === '') &&
    list(group.disallow).some((pattern) => pattern === '/' || pattern === '/*')
  );
}

// ---------------------------------------------------------------------------
// Requirement 6.6: no noindex page route under a Disallow line
// ---------------------------------------------------------------------------

/**
 * The Requirement 6.6 scoping decision (design, "One conflict to record").
 *
 * Read literally, 6.6 collides with three other requirements: 6.7 puts
 * `X-Robots-Tag: noindex` on the enquiry API that `Disallow: /api/` blocks, and
 * 6.1 and 6.10 require `Disallow: /` for every agent outside production and for
 * GPTBot while its decision is unrecorded. The reason 6.6 gives — a crawler that
 * cannot fetch a page never reads its `noindex` — is about a page hidden from a
 * crawler that can read the rest of the site. So the assertion below is scoped to
 * where that reason applies.
 */
export const NOINDEX_DISALLOW_SCOPE = Object.freeze({
  /** The routes asserted over. */
  routes: 'registered-page-routes',
  /**
   * How they are enumerated. Every page route is checked, not only the ones
   * carrying `noindex` today: whether a page carries it depends on its gate and
   * the domain state, so the superset covers a page that starts carrying it later.
   */
  enumeration: Object.freeze([
    'every page file under src/app, mapped to its URL path',
    'each dynamic segment expanded to every registered slug, gate-passing or not, plus one unregistered slug',
    'one unregistered path, which the not-found page serves with noindex',
  ]),
  /** Route kinds outside the scope, because they are not pages. */
  excludedRouteKinds: Object.freeze({
    'route-handler':
      'route.ts files, including /api/enquiry. Its noindex header is defence in depth for a personal response, and keeping it out of crawlers is the point of Disallow: /api/.',
    'metadata-route': 'robots.ts, sitemap.xml and llms.txt. Crawler instructions, not pages.',
  }),
  /** The groups whose Disallow patterns are checked. */
  groups: 'crawl-permitting',
  /**
   * A group allowing nothing is a whole-site denial of its agents, required by
   * Requirements 6.1 and 6.10. It hides no single page from a crawler that can
   * fetch the rest, so it is outside 6.6.
   */
  excludedGroups: 'whole-site-denial',
} as const);

/** Served by the not-found page; no route under src/app claims it. */
export const UNREGISTERED_PATH = '/no-such-registered-page';
export const UNREGISTERED_SLUG = 'no-such-registered-slug';

/** Every registered slug for each dynamic page route, gate-passing or not. */
const DYNAMIC_ROUTE_SLUGS: Readonly<Record<string, () => readonly string[]>> = {
  '/areas/[slug]': () => [...getAllLocalitySlugs(), UNREGISTERED_SLUG],
  '/guides/[slug]': () => [...GUIDE_REGISTRY.map((guide) => guide.slug), UNREGISTERED_SLUG],
};

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;

export interface PageFile {
  file: string;
  pattern: string;
}

/** Page files under src/app, with the URL pattern each one serves. */
export function pageFiles(dir: string = APP_DIR): PageFile[] {
  const found: PageFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Private folders are not routable.
      if (!entry.name.startsWith('_')) found.push(...pageFiles(full));
      continue;
    }
    if (!PAGE_FILE.test(entry.name)) continue;
    const segments = relative(APP_DIR, dir)
      .split(sep)
      .filter((segment) => segment !== '')
      // Route groups and parallel-route slots add no URL segment.
      .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith('@'));
    found.push({ file: full, pattern: `/${segments.join('/')}` });
  }
  return found;
}

export function registeredPageRoutes(): string[] {
  const routes = new Set<string>([UNREGISTERED_PATH]);
  for (const { pattern } of pageFiles()) {
    if (!pattern.includes('[')) {
      routes.add(pattern);
      continue;
    }
    const slugs = DYNAMIC_ROUTE_SLUGS[pattern];
    if (!slugs) {
      throw new Error(`${pattern} has no slug expansion in DYNAMIC_ROUTE_SLUGS; add one so it is checked.`);
    }
    for (const slug of slugs()) routes.add(pattern.replace('[slug]', slug));
  }
  return [...routes].sort();
}

/** Every page route a crawl-permitting group's Disallow pattern covers. */
export function noindexScopeViolations(result: MetadataRoute.Robots, routes: readonly string[]): string[] {
  const violations: string[] = [];
  for (const group of groupsOf(result)) {
    if (isWholeSiteDenial(group)) continue;
    for (const pattern of list(group.disallow)) {
      for (const path of routes) {
        if (patternMatches(pattern, path)) {
          violations.push(`${list(group.userAgent).join(', ')}: Disallow: ${pattern} covers ${path}`);
        }
      }
    }
  }
  return violations;
}
