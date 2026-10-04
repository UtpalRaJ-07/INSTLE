import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STATIC_PUBLIC_ROUTES } from '@/lib/public-routes';

import {
  APP_DIR,
  INTENT_SEGMENTS,
  NAMED_DOORWAY_PATHS,
  TYPE_SEGMENTS,
  describeRouteShapeViolation,
  enumerateRegisteredRoutes,
  findDynamicBeneathIntentOrType,
  findMultipleDynamicSegments,
  findNamedDoorwayPaths,
  findRouteShapeViolations,
  isDynamicSegment,
  registeredRouteFromFile,
  registeredRouteFromPath,
  routeSegments,
  type RegisteredRoute,
} from './helpers/route-shape';

/**
 * Requirement 12.1: no registered route has a doorway shape.
 *
 * The real `src/app` tree is asserted clean first; then each rule is run over
 * synthetic routes to prove it fires and names the offending path, so a clean
 * result means "no doorway" rather than "a check that cannot fail".
 */

const route = (path: string) => registeredRouteFromPath(path);
const messages = (violations: ReturnType<typeof findRouteShapeViolations>) =>
  violations.map(describeRouteShapeViolation);

describe('enumerateRegisteredRoutes over src/app', () => {
  const routes = enumerateRegisteredRoutes();
  const paths = routes.map((r) => r.path);

  it('finds every static public route as a page', () => {
    const pages = new Set(routes.filter((r) => r.kind === 'page').map((r) => r.path));
    for (const { path } of STATIC_PUBLIC_ROUTES) expect(pages.has(path), path).toBe(true);
  });

  it('finds the dynamic page routes, the prototypes and the route handlers', () => {
    expect(paths).toContain('/areas/[slug]');
    expect(paths).toContain('/guides/[slug]');
    expect(paths).toContain('/concept-1/intake');
    const handlers = routes.filter((r) => r.kind === 'route-handler').map((r) => r.path);
    expect(handlers).toEqual(expect.arrayContaining(['/api/enquiry', '/llms.txt', '/sitemap.xml']));
  });

  it('records each route with its real file and the dynamic segments of its path', () => {
    for (const r of routes) {
      expect(existsSync(r.filePath), r.filePath).toBe(true);
      expect(r.dynamicSegments, r.path).toEqual(routeSegments(r.path).filter(isDynamicSegment));
      expect(r.path, r.path).not.toMatch(/\/(\(|@|_)/);
    }
    expect(routes.find((r) => r.path === '/areas/[slug]')?.dynamicSegments).toEqual(['[slug]']);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('registers no named doorway path', () => {
    expect(messages(findNamedDoorwayPaths(routes))).toEqual([]);
  });

  it('places no dynamic segment directly beneath a transaction-intent or property-type segment', () => {
    expect(messages(findDynamicBeneathIntentOrType(routes))).toEqual([]);
  });

  it('registers no route with two or more dynamic segments', () => {
    expect(messages(findMultipleDynamicSegments(routes))).toEqual([]);
  });
});

describe('route-shape rules fire on doorway shapes', () => {
  it('names /buy/[slug] under both the named-doorway and the intent rule', () => {
    const violations = findRouteShapeViolations([route('/buy/[slug]')]);
    expect(violations.map((v) => [v.rule, v.path])).toEqual([
      ['named-doorway-path', '/buy/[slug]'],
      ['dynamic-beneath-intent-or-type', '/buy/[slug]'],
    ]);
    expect(messages(violations)).toEqual([
      '/buy/[slug]: matches the named doorway path /buy/[area] (src/app/buy/[slug]/page.tsx)',
      '/buy/[slug]: dynamic segment [slug] sits directly beneath transaction-intent segment "buy" (src/app/buy/[slug]/page.tsx)',
    ]);
  });

  it.each(NAMED_DOORWAY_PATHS)('rejects the named doorway path %s', (named) => {
    const [message] = messages(findNamedDoorwayPaths([route(named)]));
    expect(message).toBe(`${named}: matches the named doorway path ${named} (src/app${named}/page.tsx)`);
  });

  it('matches a named doorway beneath a prefix and under any catch-all form', () => {
    for (const path of ['/en/pincode/[code]', '/pincode/[...code]', '/Rent-Out/[[...area]]']) {
      expect(findNamedDoorwayPaths([route(path)]).map((v) => v.path)).toEqual([path]);
    }
  });

  it.each(INTENT_SEGMENTS.map((word) => `/${word}/[area]`))('rejects %s beneath a transaction intent', (path) => {
    const [message] = messages(findDynamicBeneathIntentOrType([route(path)]));
    expect(message).toMatch(new RegExp(`^${path.replace(/[[\]]/g, '\\$&')}: .*transaction-intent segment`));
  });

  it.each(TYPE_SEGMENTS.map((word) => `/${word}/[area]`))('rejects %s beneath a property type', (path) => {
    const [message] = messages(findDynamicBeneathIntentOrType([route(path)]));
    expect(message).toMatch(new RegExp(`^${path.replace(/[[\]]/g, '\\$&')}: .*property-type segment`));
  });

  it('rejects /flat/[area] beneath a property type without calling it a named doorway', () => {
    const violations = findRouteShapeViolations([route('/flat/[area]')]);
    expect(messages(violations)).toEqual([
      '/flat/[area]: dynamic segment [area] sits directly beneath property-type segment "flat" (src/app/flat/[area]/page.tsx)',
    ]);
  });

  it('treats catch-all and optional catch-all segments as dynamic', () => {
    expect(findDynamicBeneathIntentOrType([route('/buy/[...slug]'), route('/flat/[[...rest]]')]).map((v) => v.path)).toEqual([
      '/buy/[...slug]',
      '/flat/[[...rest]]',
    ]);
    expect(findMultipleDynamicSegments([route('/areas/[slug]/[...rest]')]).map((v) => v.path)).toEqual([
      '/areas/[slug]/[...rest]',
    ]);
  });

  it('rejects /areas/[a]/[b] for its two dynamic segments only', () => {
    expect(messages(findRouteShapeViolations([route('/areas/[a]/[b]')]))).toEqual([
      '/areas/[a]/[b]: carries 2 dynamic segments ([a], [b]) (src/app/areas/[a]/[b]/page.tsx)',
    ]);
  });

  it('rejects /[intent]/[type]/[area] for its three dynamic segments', () => {
    expect(messages(findMultipleDynamicSegments([route('/[intent]/[type]/[area]')]))).toEqual([
      '/[intent]/[type]/[area]: carries 3 dynamic segments ([intent], [type], [area]) (src/app/[intent]/[type]/[area]/page.tsx)',
    ]);
  });

  it('collapses a route group, so (marketing)/buy/[slug] is caught as /buy/[slug]', () => {
    const filePath = join(APP_DIR, '(marketing)', 'buy', '[slug]', 'page.tsx');
    const grouped = registeredRouteFromFile(filePath) as RegisteredRoute;
    expect(grouped).toEqual({ path: '/buy/[slug]', filePath, dynamicSegments: ['[slug]'], kind: 'page' });
    expect(messages(findRouteShapeViolations([grouped]))).toEqual([
      '/buy/[slug]: matches the named doorway path /buy/[area] (src/app/(marketing)/buy/[slug]/page.tsx)',
      '/buy/[slug]: dynamic segment [slug] sits directly beneath transaction-intent segment "buy" (src/app/(marketing)/buy/[slug]/page.tsx)',
    ]);
  });

  it('collapses a parallel slot, resolves an intercepting folder and skips a private folder', () => {
    expect(registeredRouteFromFile(join(APP_DIR, '@modal', 'flat', '[id]', 'page.tsx'))?.path).toBe('/flat/[id]');
    expect(registeredRouteFromFile(join(APP_DIR, 'feed', '(..)buy', '[id]', 'page.tsx'))?.path).toBe('/buy/[id]');
    expect(registeredRouteFromFile(join(APP_DIR, '_drafts', 'buy', '[slug]', 'page.tsx'))).toBeNull();
    expect(registeredRouteFromFile(join(APP_DIR, 'buy', '[slug]', 'route.ts'))?.kind).toBe('route-handler');
    expect(registeredRouteFromFile(join(APP_DIR, 'buy', 'buy.module.css'))).toBeNull();
  });
});

describe('route-shape rules accept non-doorway shapes', () => {
  it.each(['/areas/[slug]', '/guides/[slug]', '/', '/buy', '/commercial', '/about/utpal-raj-kb', '/buy/how-it-works'])(
    'accepts %s',
    (path) => {
      expect(messages(findRouteShapeViolations([route(path)]))).toEqual([]);
    }
  );
});
