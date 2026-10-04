import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { evaluateClaim } from '@/config/claims';
import { evaluateGuide } from '@/config/guides';
import { evaluateLocality } from '@/config/localities';
import { evaluateAsset } from '@/config/media-register';
import {
  findStatusGateDisagreements,
  needsFactReviewReturn,
  planPublicationSync,
} from '@/config/publication-sync';
import { addCalendarDays, formatCalendarDate } from '@/lib/calendar-dates';
import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbDaysLater,
  arbGateReadyGuideRecord,
  arbGateReadyLocalityRecord,
  arbVisualAsset,
  calendarDateFromPropertyNow,
} from './arbitraries';
import {
  createWithdrawalEntry,
  validateWithdrawalEntry,
} from '@internal/registers/withdrawals';

/**
 * Property 4: Stale evidence withdraws dependent content automatically.
 *
 * *For any* record, claim and pair of evaluation dates where the second is later, if
 * the record was publishable at the first date and any of its evidence has since gone
 * stale — a referenced claim's `recheckBy` has passed, the record's own `nextReviewAt`
 * has passed, its `contentUpdatedAt` has moved later than one of its three approvals,
 * or a photograph's licence or release has expired — then the record is not publishable
 * at the second date, and a withdrawal entry records the record identifier, every
 * failure string the gate returned, the withdrawal date and every route removed.
 *
 * **Validates: Requirements 1.12, 4.13, 10.11, 11.6, 11.7, 11.9, 11.12**
 *
 * The word doing the work in the property name is *automatically*. Nothing runs on a
 * schedule and no rebuild is involved: every gate takes the evaluation date as an
 * argument, so the same unchanged record answers differently on a later date. That is
 * what these assertions check — the record is held constant and only the date moves.
 */
describe('Property 4: stale evidence withdraws dependent content automatically', () => {
  /** Two dates, the second strictly later. */
  const laterThanNow = (days: number) => addCalendarDays(PROPERTY_NOW, days);

  it("unpublishes a locality once its own review date has passed, with no record change", () => {
    fc.assert(
      fc.property(arbGateReadyLocalityRecord, arbDaysLater, (record, daysLater) => {
        const reviewDue = formatCalendarDate(laterThanNow(Math.max(1, Math.floor(daysLater / 2))));
        const subject = { ...record, nextReviewAt: reviewDue };

        const atFirstDate = evaluateLocality(subject, PROPERTY_NOW);
        fc.pre(atFirstDate.eligible);

        const secondDate = addCalendarDays(new Date(`${reviewDue}T00:00:00.000Z`), 1);
        const atSecondDate = evaluateLocality(subject, secondDate);

        expect(atSecondDate.eligible).toBe(false);
        expect(atSecondDate.failures.join(' ')).toContain(`review expired on ${reviewDue}`);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('unpublishes a guide once its own review date has passed', () => {
    fc.assert(
      fc.property(arbGateReadyGuideRecord, arbDaysLater, (generated, daysLater) => {
        const reviewDue = calendarDateFromPropertyNow(Math.max(1, Math.floor(daysLater / 4)));
        const subject = {
          ...generated,
          publicationStatus: 'published' as const,
          nextReviewAt: reviewDue,
        };

        fc.pre(evaluateGuide(subject, PROPERTY_NOW).eligible);

        const secondDate = addCalendarDays(new Date(`${reviewDue}T00:00:00.000Z`), 1);
        const atSecondDate = evaluateGuide(subject, secondDate);

        expect(atSecondDate.eligible).toBe(false);
        expect(atSecondDate.failures.join(' ')).toContain(`review was due on ${reviewDue}`);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * The claim dimension, checked on the claim rather than through a record, because no
   * claim in the live ledger passes the gate — so a record referencing a real claim
   * could never be the publishable baseline this property needs. `evaluateClaim` is the
   * function every record's verdict flows through, so asserting on it asserts on the
   * cascade.
   */
  it('expires a claim the day after its recheck date, holding the claim constant', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 365 }), (daysUntilRecheck) => {
        const recheckBy = calendarDateFromPropertyNow(daysUntilRecheck);
        const claim = {
          claimId: 'CLM-GENERATED-001',
          claimText: 'A generated claim.',
          sources: [
            {
              publisher: 'Publisher A',
              independenceGroup: 'group-a',
              exactUrl: 'https://example-source-a.test/page',
              documentReference: null,
              locationInSource: 'Section 2',
              publicationDate: calendarDateFromPropertyNow(-400),
              accessDate: calendarDateFromPropertyNow(-10),
              supportingNote: 'An excerpt.',
              reuseRights: 'reference-only' as const,
            },
            {
              publisher: 'Publisher B',
              independenceGroup: 'group-b',
              exactUrl: 'https://example-source-b.test/page',
              documentReference: null,
              locationInSource: 'Table 1',
              publicationDate: calendarDateFromPropertyNow(-300),
              accessDate: calendarDateFromPropertyNow(-10),
              supportingNote: 'Another excerpt.',
              reuseRights: 'reference-only' as const,
            },
          ],
          reviewer: 'A. Named Reviewer',
          reviewDate: calendarDateFromPropertyNow(-10),
          conflictingEvidenceNotes: null,
          approvalStatus: 'approved' as const,
          recheckBy,
          usedByRoutes: [],
          evidenceGap: null,
        };

        expect(evaluateClaim(claim, PROPERTY_NOW).eligible).toBe(true);

        const dayAfter = addCalendarDays(new Date(`${recheckBy}T00:00:00.000Z`), 1);
        const expired = evaluateClaim(claim, dayAfter);
        expect(expired.eligible).toBe(false);
        expect(expired.failures.join(' ')).toContain(`Evidence expired on ${recheckBy}`);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Requirement 11.7. Moving the content date past an approval does not expire on a
   * clock — it is stale the moment the edit lands, which is why this case changes the
   * record rather than the date.
   */
  it('returns a record to fact review once its content moves past an approval', () => {
    fc.assert(
      fc.property(
        arbGateReadyLocalityRecord,
        fc.constantFrom(
          'localReviewApprovedAt' as const,
          'editorialApprovedAt' as const,
          'seoReviewApprovedAt' as const
        ),
        fc.integer({ min: 1, max: 60 }),
        (record, approvalField, daysAfter) => {
          expect(needsFactReviewReturn(record)).toBe(false);

          const approvalDate = record[approvalField];
          expect(approvalDate).not.toBeNull();
          const moved = {
            ...record,
            contentUpdatedAt: formatCalendarDate(
              addCalendarDays(new Date(`${approvalDate}T00:00:00.000Z`), daysAfter)
            ),
          };

          expect(needsFactReviewReturn(moved), approvalField).toBe(true);
          expect(planPublicationSync(PROPERTY_NOW, [moved], []).factReviewReturns).toEqual([
            moved.entityId,
          ]);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Requirement 10.11. The photograph dimension. No photograph is recorded anywhere
   * today, so this asserts on `evaluateAsset` — the function a photograph's verdict
   * would flow through the moment one is.
   */
  it('rejects an asset whose licence or release has expired by the later date', () => {
    fc.assert(
      fc.property(arbVisualAsset, arbDaysLater, (asset, daysLater) => {
        const later = laterThanNow(daysLater);
        const atFirstDate = evaluateAsset(asset, PROPERTY_NOW);
        const atSecondDate = evaluateAsset(asset, later);

        // Whatever was wrong at the first date is still wrong at the second: time
        // removes evidence and never supplies it.
        for (const failure of atFirstDate.failures) {
          expect(atSecondDate.failures, failure).toContain(failure);
        }
        if (!atFirstDate.renderable) expect(atSecondDate.renderable).toBe(false);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * The withdrawal half of the property. A record that went stale produces an entry
   * carrying the identifier, every failure string the gate returned, the date and every
   * route removed — and the entry validates against the register's own rule, which
   * rejects a tidy summary in place of the gate's strings.
   */
  it('records a complete withdrawal entry for every record the later date rejects', () => {
    fc.assert(
      fc.property(arbGateReadyLocalityRecord, fc.integer({ min: 1, max: 120 }), (record, days) => {
        const reviewDue = calendarDateFromPropertyNow(days);
        const subject = { ...record, nextReviewAt: reviewDue };
        fc.pre(evaluateLocality(subject, PROPERTY_NOW).eligible);

        const secondDate = addCalendarDays(new Date(`${reviewDue}T00:00:00.000Z`), 1);
        const plan = planPublicationSync(secondDate, [subject], []);

        expect(plan.withdrawals).toHaveLength(1);
        const [withdrawal] = plan.withdrawals;
        expect(withdrawal.recordId).toBe(subject.entityId);
        expect(withdrawal.routesRemoved).toEqual([`/areas/${subject.slug}`]);
        expect(withdrawal.withdrawnOn).toBe(formatCalendarDate(secondDate));
        expect(withdrawal.gateFailures).toEqual(
          evaluateLocality(subject, secondDate).failures
        );

        const entry = createWithdrawalEntry(withdrawal);
        expect(validateWithdrawalEntry(entry).ok).toBe(true);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * Requirement 11.12 across time. The persisted status is a stored value and the gate
   * is a function of the date, so the two drift apart on their own — and the
   * disagreement is exactly the withdrawal set, never more and never less.
   */
  it('reports the drifted records as disagreements, and nothing else', () => {
    fc.assert(
      fc.property(arbGateReadyLocalityRecord, fc.integer({ min: 1, max: 120 }), (record, days) => {
        const reviewDue = calendarDateFromPropertyNow(days);
        const subject = { ...record, nextReviewAt: reviewDue };
        fc.pre(evaluateLocality(subject, PROPERTY_NOW).eligible);

        expect(findStatusGateDisagreements(PROPERTY_NOW, [subject], [])).toEqual([]);

        const secondDate = addCalendarDays(new Date(`${reviewDue}T00:00:00.000Z`), 1);
        const disagreements = findStatusGateDisagreements(secondDate, [subject], []);
        expect(disagreements.map((item) => item.recordId)).toEqual([subject.entityId]);
        expect(disagreements[0].gateFailures).toEqual(
          evaluateLocality(subject, secondDate).failures
        );
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * The negative direction, which is what makes the property mean something: time alone
   * never *grants* publishability. A record the gate rejects today is still rejected on
   * every later date, for at least the reasons it was rejected for today.
   */
  it('never grants publishability by moving the date forward', () => {
    fc.assert(
      fc.property(arbGateReadyLocalityRecord, arbDaysLater, (record, daysLater) => {
        const stale = { ...record, nextReviewAt: calendarDateFromPropertyNow(-1) };
        const before = evaluateLocality(stale, PROPERTY_NOW);
        const after = evaluateLocality(stale, laterThanNow(daysLater));

        expect(before.eligible).toBe(false);
        expect(after.eligible).toBe(false);
        for (const failure of before.failures) {
          expect(after.failures, failure).toContain(failure);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});
