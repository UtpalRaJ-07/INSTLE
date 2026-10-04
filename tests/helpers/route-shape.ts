import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Route-shape scanning (Requirement 12.1, design "Route-shape scanning — 12.1").
 *
 * The structural half of the refusal to build doorway pages: a set of pages that
 * differ only by an intent word, a property type or a place name. Such a set is
 * built in Next.js by putting a dynamic segment under an intent or type folder
 * (`/buy/[area]`), or by stacking dynamic segments (`/[intent]/[type]/[area]`).
 * Both shapes are visible in the `src/app` tree before a single page renders, so
 * this helper reads the tree rather than the output.
 *
 * `enumerateRegisteredRoutes` turns the tree into URL patterns; the three `find*`
 * functions below are pure over those patterns, so the same checks run over the
 * real tree and over synthetic routes proving each rule fires.
 */

/**
 * Paths are resolved from `__dirname`, as `tests/helpers/public-surface.ts` resolves
 * them, rather than from `import.meta.url`.
 *
 * Under the jsdom environment `import.meta.url` is an `http://localhost/…` URL, so
 * `fileURLToPath` throws on it and every jsdom test that reached this module — through
 * the shared generators, say — failed to load before it ran an assertion. The tree this
 * helper walks is on disk either way.
 */
const REPO_ROOT = join(__dirname, '..', '..');
export const APP_DIR = join(REPO_ROOT, 'src', 'app');

/**
 * `page` renders HTML; `route-handler` is a `route.ts` answering at its own URL
 * (`/api/enquiry`, `/llms.txt`, `/sitemap.xml`).
 *
 * The design walks for `page.tsx`. Route handlers are enumerated as well because
 * Requirement 12.1 speaks of any *registered route path*, and a `route.ts` under
 * `/buy/[area]` returning HTML would be the same doorway without a page file.
 * Metadata file conventions (`robots.ts`, `icon`, `opengraph-image`) are not
 * enumerated: they serve crawler instructions and images rather than content, and
 * the only one in the tree is `robots.ts` at the root, which carries no segment.
 */
export type RegisteredRouteKind = 'page' | 'route-handler';

export interface RegisteredRoute {
  /** The URL pattern as served, e.g. `/areas/[slug]`. Groups and slots removed. */
  readonly path: string;
  /** The file registering the route. */
  readonly filePath: string;
  /** The dynamic segments of `path` as written: `[slug]`, `[...rest]`, `[[...rest]]`. */
  readonly dynamicSegments: readonly string[];
  readonly kind: RegisteredRouteKind;
}

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;
const ROUTE_HANDLER_FILE = /^route\.(tsx|ts|jsx|js)$/;

/** `[slug]`, catch-all `[...slug]` and optional catch-all `[[...slug]]`. */
export function isDynamicSegment(segment: string): boolean {
  return /^\[.+\]$/.test(segment);
}

/** The URL segments of a route path, root first. */
export function routeSegments(routePath: string): readonly string[] {
  return routePath.split('/').filter((segment) => segment !== '');
}

/** `(.)x`, `(..)x`, `(..)(..)x` and `(...)x`: the intercepted route, not a new URL. */
const INTERCEPTING_SEGMENT = /^(\(\.\.\.\)|(?:\(\.\.\))+|\(\.\))(.+)$/;
const ROUTE_GROUP = /^\(.+\)$/;

/**
 * Directory names under `src/app` → URL segments, or `null` when a private
 * `_folder` makes the subtree unroutable.
 *
 * Route groups `(x)` and parallel slots `@x` add no URL segment. An intercepting
 * folder is resolved to the URL it intercepts, so `(..)buy` is read as `buy` one
 * level up and its shape is still checked.
 */
export function urlSegmentsFromDirectories(directories: readonly string[]): string[] | null {
  const segments: string[] = [];
  for (const directory of directories) {
    if (directory.startsWith('_')) return null;
    const intercept = INTERCEPTING_SEGMENT.exec(directory);
    if (intercept) {
      const [, marker, name] = intercept;
      if (marker === '(...)') segments.length = 0;
      else if (marker !== '(.)') segments.splice(Math.max(0, segments.length - marker.length / 4));
      segments.push(name);
      continue;
    }
    if (ROUTE_GROUP.test(directory) || directory.startsWith('@')) continue;
    segments.push(directory);
  }
  return segments;
}

function toRoute(segments: readonly string[], filePath: string, kind: RegisteredRouteKind): RegisteredRoute {
  return {
    path: `/${segments.join('/')}`,
    filePath,
    dynamicSegments: segments.filter(isDynamicSegment),
    kind,
  };
}

/**
 * The route a file under `src/app` registers, or `null` when it registers none
 * (a stylesheet, a layout, a file under a private folder, a file outside the app).
 */
export function registeredRouteFromFile(filePath: string): RegisteredRoute | null {
  const rel = relative(APP_DIR, filePath);
  if (rel === '' || rel.startsWith('..')) return null;
  const parts = rel.split(/[\\/]/);
  const fileName = parts.pop() ?? '';
  const kind: RegisteredRouteKind | null = PAGE_FILE.test(fileName)
    ? 'page'
    : ROUTE_HANDLER_FILE.test(fileName)
      ? 'route-handler'
      : null;
  if (!kind) return null;
  const segments = urlSegmentsFromDirectories(parts);
  return segments ? toRoute(segments, filePath, kind) : null;
}

/**
 * A synthetic route for a URL pattern, as though a `page.tsx` registered it.
 * Used to prove each rule fires on a shape the real tree does not contain.
 */
export function registeredRouteFromPath(routePath: string, kind: RegisteredRouteKind = 'page'): RegisteredRoute {
  const segments = routeSegments(routePath);
  const fileName = kind === 'page' ? 'page.tsx' : 'route.ts';
  return toRoute(segments, join(APP_DIR, ...segments, fileName), kind);
}

/** Every page and route handler under `src/app`, sorted by path. */
export function enumerateRegisteredRoutes(): readonly RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Private folders are not routable.
        if (!entry.name.startsWith('_')) walk(full);
        continue;
      }
      const route = registeredRouteFromFile(full);
      if (route) routes.push(route);
    }
  };
  walk(APP_DIR);
  return routes.sort((a, b) =>
    a.path === b.path ? (a.filePath < b.filePath ? -1 : 1) : a.path < b.path ? -1 : 1
  );
}

// ---------------------------------------------------------------------------
// Lexicons
// ---------------------------------------------------------------------------

/**
 * The route lexicons are Requirement 12.1's own lists, as the design restates
 * them, rather than `INTENT_TOKENS` and `TYPE_TOKENS` from
 * `src/config/guide-classification.ts`.
 *
 * Those are the slug tokeniser's lexicons for Requirement 4.9 and differ on
 * purpose: `INTENT_TOKENS` has no `broker` or `best-broker` and carries `let`,
 * `purchase` and the gerunds; `TYPE_TOKENS` adds `site`, `independent`, `shop`,
 * `showroom` and `warehouse`. Property 12 rejects a route *exactly when* its
 * parent segment is one of the words 12.1 names, so borrowing the wider slug
 * lexicon would reject shapes the requirement accepts, and it would miss
 * `/broker/[area]`, which the requirement rejects.
 */
export const INTENT_SEGMENTS: readonly string[] = ['buy', 'sell', 'rent', 'rent-out', 'broker', 'best-broker'];

export const TYPE_SEGMENTS: readonly string[] = [
  'apartment',
  'flat',
  'villa',
  'plot',
  'house',
  'commercial',
  'office',
];

/** Requirement 12.1's named doorway paths, verbatim. */
export const NAMED_DOORWAY_PATHS: readonly string[] = [
  '/buy/[area]',
  '/sell/[area]',
  '/rent/[area]',
  '/rent-out/[area]',
  '/best-broker/[area]',
  '/pincode/[code]',
];

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type RouteShapeRule =
  | 'named-doorway-path'
  | 'dynamic-beneath-intent-or-type'
  | 'two-or-more-dynamic-segments';

export interface RouteShapeViolation {
  readonly rule: RouteShapeRule;
  /** The offending route path. */
  readonly path: string;
  readonly filePath: string;
  readonly detail: string;
}

/** One line naming the offending path, for an assertion message. */
export function describeRouteShapeViolation(violation: RouteShapeViolation): string {
  return `${violation.path}: ${violation.detail} (${relative(REPO_ROOT, violation.filePath)})`;
}

/** Each adjacent `(parent, dynamic child)` pair in a route, parent lowercased. */
function dynamicChildren(route: RegisteredRoute): { parent: string; child: string }[] {
  const segments = routeSegments(route.path);
  const pairs: { parent: string; child: string }[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    if (isDynamicSegment(segments[i])) pairs.push({ parent: segments[i - 1].toLowerCase(), child: segments[i] });
  }
  return pairs;
}

/**
 * A route matches a named doorway path when the path's static segment is
 * immediately followed by a dynamic segment of any name or catch-all form, at any
 * depth: `/buy/[slug]` and `/en/pincode/[...code]` both match, because a prefix
 * does not change what the page is. Segments compare case-insensitively.
 */
export function findNamedDoorwayPaths(routes: readonly RegisteredRoute[]): RouteShapeViolation[] {
  const byParent = new Map(NAMED_DOORWAY_PATHS.map((named) => [routeSegments(named)[0], named]));
  const violations: RouteShapeViolation[] = [];
  for (const route of routes) {
    for (const { parent } of dynamicChildren(route)) {
      const named = byParent.get(parent);
      if (named) {
        violations.push({
          rule: 'named-doorway-path',
          path: route.path,
          filePath: route.filePath,
          detail: `matches the named doorway path ${named}`,
        });
      }
    }
  }
  return violations;
}

/** No dynamic segment whose parent segment is a transaction-intent or property-type word. */
export function findDynamicBeneathIntentOrType(routes: readonly RegisteredRoute[]): RouteShapeViolation[] {
  const violations: RouteShapeViolation[] = [];
  for (const route of routes) {
    for (const { parent, child } of dynamicChildren(route)) {
      const lexicon = INTENT_SEGMENTS.includes(parent)
        ? 'transaction-intent'
        : TYPE_SEGMENTS.includes(parent)
          ? 'property-type'
          : null;
      if (lexicon) {
        violations.push({
          rule: 'dynamic-beneath-intent-or-type',
          path: route.path,
          filePath: route.filePath,
          detail: `dynamic segment ${child} sits directly beneath ${lexicon} segment "${parent}"`,
        });
      }
    }
  }
  return violations;
}

/** No route carrying two or more dynamic segments: one page per combination. */
export function findMultipleDynamicSegments(routes: readonly RegisteredRoute[]): RouteShapeViolation[] {
  const violations: RouteShapeViolation[] = [];
  for (const route of routes) {
    const dynamic = routeSegments(route.path).filter(isDynamicSegment);
    if (dynamic.length >= 2) {
      violations.push({
        rule: 'two-or-more-dynamic-segments',
        path: route.path,
        filePath: route.filePath,
        detail: `carries ${dynamic.length} dynamic segments (${dynamic.join(', ')})`,
      });
    }
  }
  return violations;
}

/** All three Requirement 12.1 rules. */
export function findRouteShapeViolations(routes: readonly RegisteredRoute[]): RouteShapeViolation[] {
  return [
    ...findNamedDoorwayPaths(routes),
    ...findDynamicBeneathIntentOrType(routes),
    ...findMultipleDynamicSegments(routes),
  ];
}
