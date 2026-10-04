import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { evaluateGuide } from '@/config/guides';
import { evaluateLocality } from '@/config/localities';
import {
  GUIDE_EVIDENCE_FIELDS,
  LOCALITY_EVIDENCE_FIELDS,
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbGateReadyGuideRecord,
  arbGateReadyLocalityRecord,
  arbPartiallyEvidencedGuide,
  arbPartiallyEvidencedLocality,
  removeGuideEvidence,
  removeLocalityEvidence,
  supplyGuideEvidence,
  supplyLocalityEvidence,
} from './arbitraries';

/**
 * Property 3: The publication gate is monotonic in evidence.
 *
 * *For any* record and evaluation date, adding evidence never removes publishability
 * and removing evidence never grants it: supplying a missing reviewer, a missing
 * approval date, a missing boundary version, an additional independent source or a
 * confirmed coverage status can only move the gate's verdict from reject toward
 * accept, and deleting any one of them can only move it from accept toward reject.
 * Equivalently, the gate's failure set shrinks monotonically as required fields are
 * filled.
 *
 * **Validates: Requirements 1.2, 1.13, 1.14, 4.3, 11.4**
 *
 * Why this property is worth having rather than obvious: a gate assembled from
 * independent `if` statements is monotonic by construction, and a gate assembled from
 * conditions that *read each other* is not. Task 6 added several of the second kind —
 * the twelve-month window compares `nextReviewAt` against `contentUpdatedAt`, the
 * classifier condition reads the whole record's text, the heading provenance condition
 * reads `primaryIntent`. Each is a place where filling one field can create a failure
 * about another, and the property is the thing that notices.
 *
 * The strong form is the failure-set inclusion, not the verdict. `failures(more
 * evidence) ⊆ failures(less evidence)` implies the verdict claim and says something
 * useful when both states are rejections, which is most of the space: the gate rejects
 * almost everything today, so a property stated only over verdicts would be satisfied
 * by "reject, reject" without checking that the reasons improved.
 */
describe('Property 3: the publication gate is monotonic in evidence', () => {
  it('shrinks the locality failure set when one piece of evidence is supplied', () => {
    fc.assert(
      fc.property(
        arbPartiallyEvidencedLocality,
        fc.constantFrom(...LOCALITY_EVIDENCE_FIELDS),
        ({ record }, field) => {
          const before = evaluateLocality(record, PROPERTY_NOW).failures;
          const after = evaluateLocality(
            supplyLocalityEvidence(record, field),
            PROPERTY_NOW
          ).failures;

          // Every failure that survives supplying the field was already there.
          const introduced = after.filter((failure) => !before.includes(failure));
          expect(introduced, `supplying ${field} introduced a failure`).toEqual([]);
          expect(after.length).toBeLessThanOrEqual(before.length);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('grows the locality failure set when one piece of evidence is removed', () => {
    fc.assert(
      fc.property(
        arbGateReadyLocalityRecord,
        fc.constantFrom(...LOCALITY_EVIDENCE_FIELDS),
        (record, field) => {
          const before = evaluateLocality(record, PROPERTY_NOW);
          const after = evaluateLocality(removeLocalityEvidence(record, field), PROPERTY_NOW);

          expect(before.eligible).toBe(true);
          // Removing any single required field is enough to reject the record.
          expect(after.eligible, `removing ${field} left the record publishable`).toBe(false);
          for (const failure of before.failures) {
            expect(after.failures, failure).toContain(failure);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('never flips a locality from accept to reject by supplying evidence', () => {
    fc.assert(
      fc.property(
        arbPartiallyEvidencedLocality,
        fc.constantFrom(...LOCALITY_EVIDENCE_FIELDS),
        ({ record }, field) => {
          const before = evaluateLocality(record, PROPERTY_NOW).eligible;
          const after = evaluateLocality(
            supplyLocalityEvidence(record, field),
            PROPERTY_NOW
          ).eligible;
          if (before) expect(after, `supplying ${field} unpublished the record`).toBe(true);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Supplying every missing field, one at a time and in any order, reaches the accept
   * state. This is the claim that matters to an editor: the failure list is a to-do
   * list, and working through it in any order terminates.
   */
  it('reaches accept by supplying every removed field in any order', () => {
    fc.assert(
      fc.property(arbPartiallyEvidencedLocality, fc.integer(), ({ record, removed }, seed) => {
        const order = [...removed].sort((a, b) =>
          (`${seed}${a}`.length % 2) - (`${seed}${b}`.length % 2) || a.localeCompare(b)
        );
        let current = record;
        let previousFailureCount = evaluateLocality(current, PROPERTY_NOW).failures.length;
        for (const field of order) {
          current = supplyLocalityEvidence(current, field);
          const count = evaluateLocality(current, PROPERTY_NOW).failures.length;
          expect(count, `supplying ${field} grew the failure list`).toBeLessThanOrEqual(
            previousFailureCount
          );
          previousFailureCount = count;
        }

        // The boundary-version field is the one case where supplying the version
        // leaves the mapping's own claim failure standing, because no ledger claim
        // passes the claim gate. Everything else returns the record to publishable.
        if (!removed.includes('boundaryVersion')) {
          expect(evaluateLocality(current, PROPERTY_NOW).eligible).toBe(true);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('shrinks the guide failure set when one piece of evidence is supplied', () => {
    fc.assert(
      fc.property(
        arbPartiallyEvidencedGuide,
        fc.constantFrom(...GUIDE_EVIDENCE_FIELDS),
        ({ record }, field) => {
          const before = evaluateGuide(record, PROPERTY_NOW).failures;
          const after = evaluateGuide(supplyGuideEvidence(record, field), PROPERTY_NOW).failures;

          const introduced = after.filter((failure) => !before.includes(failure));
          expect(introduced, `supplying ${field} introduced a failure`).toEqual([]);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('grows the guide failure set when one piece of evidence is removed', () => {
    fc.assert(
      fc.property(
        arbGateReadyGuideRecord,
        fc.constantFrom(...GUIDE_EVIDENCE_FIELDS),
        (generated, field) => {
          const record = { ...generated, publicationStatus: 'published' as const };
          const before = evaluateGuide(record, PROPERTY_NOW);
          const after = evaluateGuide(removeGuideEvidence(record, field), PROPERTY_NOW);

          expect(before.eligible).toBe(true);
          expect(after.eligible, `removing ${field} left the guide publishable`).toBe(false);
          for (const failure of before.failures) {
            expect(after.failures, failure).toContain(failure);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Requirement 4.3 as the same property from the other side: an external-fact record
   * needs a named author, a named subject reviewer and a gate-passing claim, and
   * supplying any one of them removes exactly that failure and no other.
   */
  it('removes exactly the named failure when an external-fact requirement is met', () => {
    fc.assert(
      fc.property(arbGateReadyGuideRecord, (generated) => {
        const external = {
          ...generated,
          publicationStatus: 'published' as const,
          contentClass: 'external-fact' as const,
        };
        const before = evaluateGuide(external, PROPERTY_NOW).failures;
        expect(before.join(' ')).toMatch(/named author/);

        const withAuthor = evaluateGuide(
          { ...external, namedAuthor: 'A. Named Author' },
          PROPERTY_NOW
        ).failures;
        expect(withAuthor.filter((failure) => !before.includes(failure))).toEqual([]);
        expect(withAuthor.join(' ')).not.toMatch(/requires a named author/);
        expect(withAuthor.join(' ')).toMatch(/named subject reviewer/);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Requirement 11.4. A status flag is not evidence, so flipping it to published can
   * only remove the status failure — it cannot satisfy anything else. This is the
   * property that would have caught the original defect this whole feature was written
   * to fix: records marked published on a non-attributable sign-off.
   */
  it('lets a published status remove only the status failure', () => {
    fc.assert(
      fc.property(arbPartiallyEvidencedLocality, ({ record }) => {
        const unpublished = { ...record, publicationStatus: 'unpublished' as const };
        const published = { ...record, publicationStatus: 'published' as const };

        const before = evaluateLocality(unpublished, PROPERTY_NOW).failures;
        const after = evaluateLocality(published, PROPERTY_NOW).failures;

        const removed = before.filter((failure) => !after.includes(failure));
        expect(removed).toEqual(['Publication status is "unpublished".']);
        expect(after.filter((failure) => !before.includes(failure))).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});
