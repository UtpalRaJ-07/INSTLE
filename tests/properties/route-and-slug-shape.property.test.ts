import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { GUIDE_REGISTRY } from '@/config/guides';
import {
  ADDITIONAL_FORBIDDEN_SEGMENTS,
  FORBIDDEN_ROUTE_SEGMENTS,
  PIN_CODE_WHOLE_SEGMENT_RULING,
  pathCarriesForbiddenSegment,
} from '../../scripts/seed-guide-candidates.mjs';
import {
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
  registeredRouteFromPath,
  routeSegments,
  urlSegmentsFromDirectories,
} from '../helpers/route-shape';
import { bannedSlugParts, slugResolutionFailures } from '../helpers/slug-shape';
import {
  PROPERTY_RUN_CONFIG,
  arbAcceptableSlug,
  arbDoorwayRouteShape,
  arbGeneratedSlug,
  arbInnocentSegment,
  arbLegitimateRouteShape,
  arbPinTermSegment,
  arbRouteShape,
  arbSixDigitSegment,
  arbSlugRegistry,
} from './arbitraries';

/**
 * **Property 12: Route and slug shapes that constitute a doorway pattern are
 * rejected.**
 *
 * *For any* generated route path and any `/areas/` slug, the scan rejects the path
 * exactly when it places a dynamic segment directly beneath a transaction-intent or
 * property-type segment, carries two or more dynamic segments, or matches one of the
 * named doorway paths; and rejects the slug exactly when it is not the slug of
 * exactly one locality record, contains a transaction-intent word, a property-type
 * word or a six-digit numeric group, or is a whole segment equal to a postcode token
 * — reporting the offending path or slug in every case, and accepting every other
 * shape.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3**
 *
 * *Exactly when* is the load-bearing phrase, and it is why this is a property rather
 * than a list of examples. A doorway check that rejected everything would pass any
 * number of "this shape is refused" tests while making the router unusable, and one
 * that rejected nothing would pass the live suite today, because the tree contains no
 * doorway to find. So both directions are generated: shapes built to trip each rule,
 * which must be named; and shapes built to trip none — route groups, parallel slots,
 * prefixes, catch-alls, an intent segment with a static child — which must be left
 * alone.
 *
 * `tests/route-shape.test.ts` and `tests/slug-and-pin-scan.test.ts` hold the real tree
 * and the real registry to these rules. This file holds the rules themselves to the
 * whole space of shapes.
 */

// ---------------------------------------------------------------------------
// Requirement 12.1 — route shape
// ---------------------------------------------------------------------------

/** The route path a directory list serves, or null when a private folder blocks it. */
function servedPath(directories: readonly string[]): string | null {
  const segments = urlSegmentsFromDirectories(directories);
  return segments ? `/${segments.join('/')}` : null;
}

describe('Property 12: a doorway route shape is rejected, naming the path', () => {
  it('rejects every generated doorway shape and names the offending path', () => {
    fc.assert(
      fc.property(arbDoorwayRouteShape, (generated) => {
        const path = `/${generated.segments.join('/')}`;
        const route = registeredRouteFromPath(path);
        const violations = findRouteShapeViolations([route]);

        expect(violations.length, `${path} is a doorway shape (${generated.why}) and was accepted`).toBeGreaterThan(
          0
        );
        for (const violation of violations) {
          expect(violation.path).toBe(path);
          expect(describeRouteShapeViolation(violation)).toContain(path);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('rejects the same shape written behind a route group or a parallel slot', () => {
    fc.assert(
      fc.property(arbDoorwayRouteShape, (generated) => {
        // `app/(marketing)/buy/[area]/page.tsx` serves `/buy/[area]`. A group is how
        // somebody hides a doorway from a reader of the tree; it hides nothing from
        // the rule, because the rule reads the URL the directories serve.
        const path = servedPath(generated.directories);
        expect(path, `${generated.directories.join('/')} served no path`).toBe(`/${generated.segments.join('/')}`);
        expect(findRouteShapeViolations([registeredRouteFromPath(path!)]).length).toBeGreaterThan(0);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('accepts every generated legitimate shape', () => {
    fc.assert(
      fc.property(arbLegitimateRouteShape, (generated) => {
        const path = `/${generated.segments.join('/')}`;
        const violations = findRouteShapeViolations([registeredRouteFromPath(path)]);
        expect(
          violations.map(describeRouteShapeViolation),
          `${path} breaks no Requirement 12.1 rule (${generated.why}) and was rejected`
        ).toEqual([]);
        // And the same path written behind a group or a slot is still accepted.
        const behindGroup = servedPath(generated.directories);
        expect(behindGroup).toBe(path);
        expect(findRouteShapeViolations([registeredRouteFromPath(behindGroup!)])).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('rejects a shape exactly when one of the three rules fires', () => {
    fc.assert(
      fc.property(arbRouteShape, (generated) => {
        const path = `/${generated.segments.join('/')}`;
        const route = registeredRouteFromPath(path);
        const segments = routeSegments(path);
        const dynamic = segments.filter(isDynamicSegment);
        const parents = segments
          .map((segment, index) => ({ segment, parent: index > 0 ? segments[index - 1]!.toLowerCase() : null }))
          .filter((pair) => isDynamicSegment(pair.segment))
          .map((pair) => pair.parent);
        const namedParents = NAMED_DOORWAY_PATHS.map((named) => routeSegments(named)[0]!);

        // Read off the shape, independently of the implementation.
        const expectedNamed = parents.some((parent) => parent !== null && namedParents.includes(parent));
        const expectedBeneath = parents.some(
          (parent) => parent !== null && (INTENT_SEGMENTS.includes(parent) || TYPE_SEGMENTS.includes(parent))
        );
        const expectedMultiple = dynamic.length >= 2;

        expect(findNamedDoorwayPaths([route]).length > 0).toBe(expectedNamed);
        expect(findDynamicBeneathIntentOrType([route]).length > 0).toBe(expectedBeneath);
        expect(findMultipleDynamicSegments([route]).length > 0).toBe(expectedMultiple);
        expect(findRouteShapeViolations([route]).length > 0).toBe(
          expectedNamed || expectedBeneath || expectedMultiple
        );
        // The generator's own verdict agrees with the shape it built.
        expect(expectedNamed || expectedBeneath || expectedMultiple).toBe(generated.doorway);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('holds the real tree to the same rules, so the space above includes the routes that exist', () => {
    const routes = enumerateRegisteredRoutes();
    expect(routes.length).toBeGreaterThan(10);
    expect(findRouteShapeViolations(routes).map(describeRouteShapeViolation)).toEqual([]);
    // The two shapes the tree really has, judged by the same function.
    expect(findRouteShapeViolations([registeredRouteFromPath('/areas/[slug]')])).toEqual([]);
    expect(findRouteShapeViolations([registeredRouteFromPath('/guides/[slug]')])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Requirement 12.2 — slug shape
// ---------------------------------------------------------------------------

describe('Property 12: a slug carrying an intent word, a type word or six digits is rejected', () => {
  it('rejects a slug exactly when it carries one, and names what it carries', () => {
    fc.assert(
      fc.property(arbGeneratedSlug, (generated) => {
        const carried = bannedSlugParts(generated.slug);
        if (generated.offence === null) {
          expect(carried, `${generated.slug} names a place and was rejected`).toEqual([]);
          return;
        }
        expect(carried.length, `${generated.slug} carries ${generated.offending} and was accepted`).toBeGreaterThan(
          0
        );
        expect(carried, `${generated.slug} was rejected without naming ${generated.offending}`).toContain(
          generated.offending
        );
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('reads whole hyphen tokens, so a place name that merely contains the letters passes', () => {
    fc.assert(
      fc.property(arbAcceptableSlug, (generated) => {
        // `kengeri-satellite-town` carries no type word, though `site` is inside
        // `satellite`. The rule is about tokens, and a substring reading would reject
        // real Bengaluru place names.
        expect(bannedSlugParts(generated.slug)).toEqual([]);
        expect(bannedSlugParts(`${generated.slug}-layout`)).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('rejects a slug that does not resolve to exactly one record, naming the slug', () => {
    fc.assert(
      fc.property(arbSlugRegistry, (registry) => {
        const lookup = new Map(Object.entries(registry.aliases));
        const failures = slugResolutionFailures(registry.records, registry.aliases, (slug) => lookup.get(slug) ?? slug);

        if (registry.resolvesToExactlyOne) {
          expect(failures, `${registry.why}, and the resolution rule failed anyway`).toEqual([]);
          return;
        }
        expect(failures.length, `${registry.why}, and the resolution rule passed`).toBeGreaterThan(0);
        // Every failure names a slug the caller can look up.
        const known = new Set([
          ...registry.records.map((record) => record.slug),
          ...Object.keys(registry.aliases),
        ]);
        for (const failure of failures) {
          expect([...known].some((slug) => failure.includes(slug)), failure).toBe(true);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 12.3 — a PIN term or a six-digit literal as a whole segment
// ---------------------------------------------------------------------------

/**
 * The forbidden terms, as the seeder holds them. The lexicon is reused; the rule —
 * `pathCarriesForbiddenSegment` — is what this property is about.
 */
const FORBIDDEN: readonly string[] = [...FORBIDDEN_ROUTE_SEGMENTS, ...ADDITIONAL_FORBIDDEN_SEGMENTS];

/** A generated segment that is not itself a forbidden term or a six-digit literal. */
const arbNonPinSegment: fc.Arbitrary<string> = arbInnocentSegment.filter(
  (segment) => !FORBIDDEN.includes(segment.toLowerCase()) && !/^\d{6}$/.test(segment)
);

describe('Property 12: a route segment that is a PIN term or a six-digit literal is rejected', () => {
  it('rejects a path whose whole segment is a forbidden term, at any depth', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(arbNonPinSegment, { minLength: 0, maxLength: 2 }),
          arbPinTermSegment,
          fc.array(arbNonPinSegment, { minLength: 0, maxLength: 2 })
        ),
        ([prefix, term, suffix]) => {
          const path = `/${[...prefix, term, ...suffix].join('/')}`;
          expect(pathCarriesForbiddenSegment(path), `${path} carries the whole segment "${term}"`).toBe(true);
          // Case is not a hiding place.
          expect(pathCarriesForbiddenSegment(path.toUpperCase())).toBe(true);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('rejects a path whose whole segment is six digits', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.array(arbNonPinSegment, { minLength: 0, maxLength: 3 }), arbSixDigitSegment),
        ([prefix, digits]) => {
          expect(pathCarriesForbiddenSegment(`/${[...prefix, digits].join('/')}`)).toBe(true);
          expect(pathCarriesForbiddenSegment(`/areas/${digits}`)).toBe(true);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('accepts a path whose segments merely contain the term, under the recorded ruling', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.array(arbNonPinSegment, { minLength: 1, maxLength: 3 }), arbPinTermSegment, arbSixDigitSegment),
        ([segments, term, digits]) => {
          const path = `/${segments.join('/')}`;
          expect(pathCarriesForbiddenSegment(path), path).toBe(false);
          // The ruling is whole-segment equality, so a segment that *names a subject*
          // containing the words is a page, not a postcode doorway — and a numeral
          // that is not a whole six-digit segment is not a PIN code either.
          expect(pathCarriesForbiddenSegment(`/guides/${term}-locality-difference`)).toBe(false);
          expect(pathCarriesForbiddenSegment(`/areas/layout-${digits}x`)).toBe(false);
          expect(pathCarriesForbiddenSegment(`/areas/${digits}7`)).toBe(false);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('keeps the one guide the ruling protects, and records why', () => {
    const { permittedSlug, ruling } = PIN_CODE_WHOLE_SEGMENT_RULING;
    expect(ruling).toBe('whole-segment equality');
    expect(GUIDE_REGISTRY.map((guide) => guide.slug)).toContain(permittedSlug);
    expect(pathCarriesForbiddenSegment(`/guides/${permittedSlug}`)).toBe(false);
  });
});
