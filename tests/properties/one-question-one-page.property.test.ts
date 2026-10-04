import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  GUIDE_REGISTRY,
  getPublishedGuides,
  isGuidePublishable,
  type GuideRecord,
} from '@/config/guides';
import {
  findOneQuestionOnePageCollisions,
  slugsDifferOnlyByPermutationToken,
} from '@/config/guide-classification';
import {
  assignPrimaryIntent,
  MAX_PRIMARY_INTENTS_PER_ROUTE,
  type IntentAssignment,
  type IntentAssignmentRequest,
} from '@internal/registers/search-intent';

import {
  GUIDE_ROUTE_POOL,
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbGuideRecords,
  arbIntentAssignmentRequests,
} from './arbitraries';

/**
 * **Property 10: One question is served by exactly one page.**
 *
 * *For any* sequence of intent assignments, each route carries at most one primary
 * intent entry and each primary intent maps to exactly one route; a second
 * assignment of an already-served intent is rejected, the second record stays
 * unpublished, and the conflicting route is recorded. No two published guides share
 * a customer question, share a primary intent, or carry slugs whose token multisets
 * differ only by tokens drawn from the intent, property-type or area lexicons.
 *
 * **Validates: Requirements 3.4, 3.5, 3.14, 4.9**
 *
 * The property has two halves and they meet in the middle. The register half is
 * about the *assignment* — can a second page be given a question that already has
 * one. The registry half is about the *result* — given a set of published pages, is
 * any question served twice. A system could get either half right on its own and
 * still serve one question from two URLs, so both are asserted, and the live
 * registry is checked against the same function the generated sets are.
 */

/** Collapse whitespace and case, the way the register does. */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Fold a request sequence, keeping every rejection.
 *
 * `assignPrimaryIntent` is pure, so a rejection leaves the accumulator alone; this
 * helper just records what was rejected and why.
 */
function applyAll(requests: readonly IntentAssignmentRequest[]): {
  assignments: readonly IntentAssignment[];
  rejections: readonly {
    request: IntentAssignmentRequest;
    error: string;
    conflictingRoute: string | null;
    assignmentsBefore: readonly IntentAssignment[];
  }[];
} {
  let assignments: readonly IntentAssignment[] = [];
  const rejections: {
    request: IntentAssignmentRequest;
    error: string;
    conflictingRoute: string | null;
    assignmentsBefore: readonly IntentAssignment[];
  }[] = [];

  for (const request of requests) {
    const before = assignments;
    const result = assignPrimaryIntent(before, request);
    if (result.ok) {
      assignments = result.assignments;
      continue;
    }
    expect(result.recordStaysUnpublished).toBe(true);
    rejections.push({
      request,
      error: result.error,
      conflictingRoute: result.conflictingRoute,
      assignmentsBefore: before,
    });
    // Purity: a rejected assignment does not half-apply.
    expect(assignments).toBe(before);
  }

  return { assignments, rejections };
}

describe('Property 10: one question is served by exactly one page', () => {
  it('gives each route at most one primary intent, however the sequence is ordered', () => {
    fc.assert(
      fc.property(arbIntentAssignmentRequests, (requests) => {
        const { assignments } = applyAll(requests);
        const routes = assignments.map((assignment) => assignment.route);
        expect(new Set(routes).size).toBe(routes.length);
        expect(MAX_PRIMARY_INTENTS_PER_ROUTE).toBe(1);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('maps each primary intent to exactly one route', () => {
    fc.assert(
      fc.property(arbIntentAssignmentRequests, (requests) => {
        const { assignments } = applyAll(requests);
        const questions = assignments.map((assignment) =>
          normalise(assignment.primaryIntentQuestion)
        );
        expect(new Set(questions).size).toBe(questions.length);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Requirement 3.5 and 3.14 together. "Already served" is only actionable if the
   * editor is told where, so the rejection has to name the route rather than just
   * refuse, and the named route has to be the one actually holding the question.
   *
   * Scoped to requests that are otherwise well-formed, and that scoping is a real
   * finding rather than a convenience. The first run of this property produced a
   * counterexample: two requests carrying the same question, the second also
   * carrying six supporting phrases. `assignPrimaryIntent` reports the *first*
   * failing condition, so it refused that one for the phrase cap and returned
   * `conflictingRoute: null` — the question conflict was never reached. That is
   * correct behaviour and the property was wrong to demand otherwise. Requirement
   * 3.5 is about what happens when a phrase maps to a served intent; a request that
   * is malformed for another reason is refused for that reason, and Requirement 3.14
   * still holds because the record stays unpublished either way. The predicate below
   * isolates the served-intent condition by asking the register whether the request
   * would be accepted against an empty list.
   */
  it('rejects a second assignment of a served intent and names the route that holds it', () => {
    fc.assert(
      fc.property(arbIntentAssignmentRequests, (requests) => {
        const { rejections } = applyAll(requests);

        for (const rejection of rejections) {
          const wellFormed = assignPrimaryIntent([], rejection.request).ok;
          if (!wellFormed) continue;

          const question = normalise(rejection.request.entry.primaryIntentQuestion);
          const holder = rejection.assignmentsBefore.find(
            (assignment) =>
              normalise(assignment.primaryIntentQuestion) === question &&
              assignment.route !== rejection.request.route
          );
          if (!holder) continue;

          // The question was already served from another route, and nothing else is
          // wrong with the request, so the route has to be recorded.
          expect(rejection.conflictingRoute, rejection.error).toBe(holder.route);
          expect(rejection.error).toContain(holder.route);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * The same rule from the other direction, with no malformed request in the way: a
   * well-formed request for a question another route already serves is always
   * refused, always names that route, and always leaves the record unpublished.
   */
  it('always refuses a well-formed request for a question another route serves', () => {
    fc.assert(
      fc.property(arbIntentAssignmentRequests, (requests) => {
        const { assignments } = applyAll(requests);
        if (assignments.length === 0) return;

        for (const held of assignments) {
          for (const route of GUIDE_ROUTE_POOL) {
            if (route === held.route) continue;
            const request: IntentAssignmentRequest = {
              entry: {
                entryId: 'SIE-SECOND-ATTEMPT',
                phrase: 'how do i find help with a property in bengaluru',
                source: { kind: 'manual', methodName: 'Recorded manual method' },
                observedOn: '2026-09-01',
                locationContext: { scope: 'city', city: 'Bengaluru' },
                primaryIntentQuestion: held.primaryIntentQuestion,
                destinationRoute: null,
                role: 'primary',
                volume: null,
              },
              route,
            };

            const result = assignPrimaryIntent(assignments, request);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.recordStaysUnpublished).toBe(true);
            expect(result.conflictingRoute).not.toBeNull();
            expect(assignments.map((assignment) => assignment.route)).toContain(
              result.conflictingRoute
            );
          }
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('records a route conflict against a route that exists in the list', () => {
    fc.assert(
      fc.property(arbIntentAssignmentRequests, (requests) => {
        const { rejections } = applyAll(requests);
        for (const rejection of rejections) {
          if (rejection.conflictingRoute === null) continue;
          const routes = rejection.assignmentsBefore.map((assignment) => assignment.route);
          expect(routes, rejection.error).toContain(rejection.conflictingRoute);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * The registry half. The collision function has to agree, on every generated set,
   * with the three conditions Requirement 4.9 names — computed here independently
   * so the test is not just the implementation restated.
   */
  it('finds exactly the collisions Requirement 4.9 defines, over published records only', () => {
    fc.assert(
      fc.property(arbGuideRecords, (records) => {
        const published = records.filter((record) => isGuidePublishable(record, PROPERTY_NOW));
        const collisions = findOneQuestionOnePageCollisions(published);

        const expected: { kind: string; a: string; b: string }[] = [];
        for (let i = 0; i < published.length; i += 1) {
          for (let j = i + 1; j < published.length; j += 1) {
            const left = published[i];
            const right = published[j];
            if (normalise(left.question) === normalise(right.question)) {
              expected.push({ kind: 'question', a: left.slug, b: right.slug });
            }
            if (
              left.primaryIntent !== null &&
              right.primaryIntent !== null &&
              left.primaryIntent.intentEntryId === right.primaryIntent.intentEntryId
            ) {
              expected.push({ kind: 'primary-intent', a: left.slug, b: right.slug });
            }
            if (slugsDifferOnlyByPermutationToken(left.slug, right.slug)) {
              expected.push({ kind: 'permutation-slug', a: left.slug, b: right.slug });
            }
          }
        }

        expect(collisions.map(({ kind, a, b }) => ({ kind, a, b }))).toEqual(expected);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * An unpublished record cannot cause a collision, because it serves nobody. This
   * is the half of Requirement 4.6 that matters here: a candidate is held out of the
   * rule as well as out of the page.
   */
  it('never reports a collision that an unpublished record is responsible for', () => {
    fc.assert(
      fc.property(arbGuideRecords, (records) => {
        const published = records.filter((record) => isGuidePublishable(record, PROPERTY_NOW));
        const publishedSlugs = new Set(published.map((record) => record.slug));
        const collisions = findOneQuestionOnePageCollisions(published);

        for (const collision of collisions) {
          expect(publishedSlugs.has(collision.a), collision.detail).toBe(true);
          expect(publishedSlugs.has(collision.b), collision.detail).toBe(true);
        }

        // Unpublishing everything removes every collision.
        const allDraft: GuideRecord[] = records.map((record) => ({
          ...record,
          publicationStatus: 'unpublished' as const,
        }));
        const stillPublished = allDraft.filter((record) =>
          isGuidePublishable(record, PROPERTY_NOW)
        );
        expect(stillPublished).toEqual([]);
        expect(findOneQuestionOnePageCollisions(stillPublished)).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Adding a candidate never creates a collision, because a candidate is
   * unpublished. This is the seeding claim stated as a property rather than as a
   * count: 29 records could be added, or 290, and the published set is unchanged.
   */
  it('adds no collision when an unpublished candidate joins the live registry', () => {
    fc.assert(
      fc.property(arbGuideRecords, (records) => {
        const candidates: GuideRecord[] = records.map((record) => ({
          ...record,
          publicationStatus: 'unpublished' as const,
        }));
        const extended = [...GUIDE_REGISTRY, ...candidates];
        const published = extended.filter((record) => isGuidePublishable(record, PROPERTY_NOW));

        expect(published.map((record) => record.slug)).toEqual(
          getPublishedGuides(PROPERTY_NOW).map((record) => record.slug)
        );
        expect(findOneQuestionOnePageCollisions(published)).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('holds for the live registry as it stands', () => {
    expect(findOneQuestionOnePageCollisions(getPublishedGuides(PROPERTY_NOW))).toEqual([]);
  });
});
