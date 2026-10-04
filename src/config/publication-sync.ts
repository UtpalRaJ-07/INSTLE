/**
 * Withdrawal propagation, as a decision separate from the act of writing files.
 *
 * The runtime gate is authoritative and fails closed. The locality route calls
 * `evaluateLocality` with the request date, so a claim corrected this morning stops
 * serving its dependent pages this afternoon with no rebuild and no script run —
 * the design is explicit that "the persisted `publicationStatus` flip is bookkeeping
 * for the progress report, not the mechanism".
 *
 * Bookkeeping still has to be correct, because Requirement 11.9 wants a durable
 * record of what left the site and why, and Requirement 13.1 reports counts from the
 * persisted set. This module computes what the bookkeeping should say;
 * `scripts/sync-publication-status.mjs` is the part that touches the disk. Splitting
 * them means the interesting half is unit-testable without a filesystem, and the
 * half that edits source files has almost no logic in it.
 *
 * Three rules live here.
 *
 *  - **Requirements 1.12 and 4.13.** Every record whose persisted status says
 *    published while the runtime gate rejects it is withdrawn, carrying every
 *    failure string the gate returned.
 *  - **Requirement 11.7.** A record whose content moved after it was approved goes
 *    back to fact review, because the approvals are approvals of the earlier text.
 *  - **Requirement 11.12.** The persisted status and the runtime gate never
 *    disagree. `findStatusGateDisagreements` is the assertion, and it is the reason
 *    the other two exist rather than being a convention.
 *
 * Nothing here deletes anything. A withdrawal flips one field and writes an entry;
 * the record, its sections, its reviewers and all three approval timestamps stay
 * exactly where they were, so returning the page later is a review rather than a
 * rewrite.
 */

import { GUIDE_REGISTRY, evaluateGuide, type GuideRecord } from './guides';
import {
  LOCALITY_REGISTRY,
  evaluateLocality,
  type LocalityRecord,
} from './localities';
import { compareCalendarDates } from '@/lib/calendar-dates';

// ---------------------------------------------------------------------------
// Routes a record occupies
// ---------------------------------------------------------------------------

/**
 * Every public route a locality record would serve.
 *
 * The slug appears once as a page and once in the sitemap, but both are the same
 * route string, so the list has one member. Alias slugs are deliberately absent:
 * Requirement 1.11 keeps an alias out of navigation, static params and the sitemap
 * in the first place, so no alias route is ever removed because none was ever added.
 */
export function localityRoutes(record: LocalityRecord): readonly string[] {
  return [`/areas/${record.slug}`];
}

export function guideRoutes(record: GuideRecord): readonly string[] {
  return [`/guides/${record.slug}`];
}

// ---------------------------------------------------------------------------
// The withdrawal itself
// ---------------------------------------------------------------------------

/**
 * A withdrawal, in the shape `internal/registers/withdrawals.ts` records.
 *
 * Structurally identical to `WithdrawalEntry` in the withdrawal register, and
 * deliberately not importing it. No file under `src/` may name the internal register
 * alias at all — `tests/internal-register-boundary.test.ts` asserts that as a plain
 * substring search, which is why this sentence does not spell the alias out either,
 * and Requirement 3.12 is the reason the rule exists. `sync-publication-status.mjs`
 * imports the register and this module and composes the two, which is the bridge the
 * design describes.
 */
export interface WithdrawalPlanEntry {
  readonly recordId: string;
  /** Every failure string the gate returned, not a summary. Requirement 11.9. */
  readonly gateFailures: readonly string[];
  readonly withdrawnOn: string;
  readonly routesRemoved: readonly string[];
}

/** A record whose persisted status and gate verdict disagree. Requirement 11.12. */
export interface StatusGateDisagreement {
  readonly recordId: string;
  readonly slug: string;
  readonly kind: 'locality' | 'guide';
  readonly persistedStatus: string;
  readonly gateFailures: readonly string[];
}

/**
 * Flip a locality to unpublished, retaining everything else.
 *
 * Written as a function returning a new record rather than as a mutation, so the
 * test can compare the before and after field by field and prove that the author,
 * the three reviewers and all three approval timestamps survived. Requirement 11.9
 * says the record and its approvals are retained; this is what "retained" means in
 * code.
 */
export function withdrawLocality(record: LocalityRecord): LocalityRecord {
  return { ...record, publicationStatus: 'unpublished' };
}

export function withdrawGuide(record: GuideRecord): GuideRecord {
  return { ...record, publicationStatus: 'unpublished' };
}

/** Requirement 11.7. Back to fact review, with every approval left in place. */
export function returnToFactReview(record: LocalityRecord): LocalityRecord {
  return { ...record, editorialStatus: 'fact_review' };
}

/**
 * Requirement 11.7. True when the content moved after somebody approved it.
 *
 * Compared as calendar dates, so a content update recorded on the same day as an
 * approval is not treated as later than it — the records carry dates rather than
 * instants, and inventing an ordering within a day would invent evidence about who
 * did what first. Strictly later is what sends the record back.
 *
 * A malformed or absent date returns false rather than true: `compareCalendarDates`
 * yields null for either, and a recording error is reported by the gate's own
 * missing-timestamp failures rather than silently becoming a withdrawal reason
 * here.
 */
export function needsFactReviewReturn(record: LocalityRecord): boolean {
  const approvals = [
    record.localReviewApprovedAt,
    record.editorialApprovedAt,
    record.seoReviewApprovedAt,
  ];
  return approvals.some((approval) => {
    const comparison = compareCalendarDates(record.contentUpdatedAt, approval);
    return comparison !== null && comparison > 0;
  });
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface PublicationSyncPlan {
  readonly evaluatedOn: string;
  readonly withdrawals: readonly WithdrawalPlanEntry[];
  /** Record identifiers to return to fact review. Requirement 11.7. */
  readonly factReviewReturns: readonly string[];
  /** Requirement 11.12. Empty means the persisted status and the gate agree. */
  readonly disagreements: readonly StatusGateDisagreement[];
  readonly publishedLocalityCount: number;
  readonly publishedGuideCount: number;
}

/**
 * Requirement 11.12, computed rather than asserted, so the test and the script read
 * the same answer.
 *
 * One direction only, and deliberately so: `publicationStatus === 'published'`
 * implies the gate admits the record. The converse is not a disagreement. A record
 * can satisfy every gate condition while its persisted status still says
 * unpublished, because publication is a release decision taken in batches
 * (Requirement 1.8) rather than something evidence performs by itself. Asserting the
 * converse would turn "this record is ready" into "this record is live".
 */
export function findStatusGateDisagreements(
  now: Date = new Date(),
  localities: readonly LocalityRecord[] = LOCALITY_REGISTRY,
  guides: readonly GuideRecord[] = GUIDE_REGISTRY
): readonly StatusGateDisagreement[] {
  const disagreements: StatusGateDisagreement[] = [];

  for (const record of localities) {
    if (record.publicationStatus !== 'published') continue;
    const evaluation = evaluateLocality(record, now);
    if (evaluation.eligible) continue;
    disagreements.push({
      recordId: record.entityId,
      slug: record.slug,
      kind: 'locality',
      persistedStatus: record.publicationStatus,
      gateFailures: evaluation.failures,
    });
  }

  for (const record of guides) {
    if (record.publicationStatus !== 'published') continue;
    const evaluation = evaluateGuide(record, now);
    if (evaluation.eligible) continue;
    disagreements.push({
      recordId: record.guideId,
      slug: record.slug,
      kind: 'guide',
      persistedStatus: record.publicationStatus,
      gateFailures: evaluation.failures,
    });
  }

  return disagreements;
}

/**
 * What the sync would do, without doing any of it.
 *
 * `withdrawnOn` is taken from the evaluation date rather than from the clock inside
 * the function, so a plan computed for a date produces the same entry every time it
 * is computed for that date.
 */
export function planPublicationSync(
  now: Date = new Date(),
  localities: readonly LocalityRecord[] = LOCALITY_REGISTRY,
  guides: readonly GuideRecord[] = GUIDE_REGISTRY
): PublicationSyncPlan {
  const evaluatedOn = now.toISOString().slice(0, 10);
  const disagreements = findStatusGateDisagreements(now, localities, guides);

  const withdrawals: WithdrawalPlanEntry[] = disagreements.map((disagreement) => {
    const routesRemoved =
      disagreement.kind === 'locality'
        ? localityRoutes(
            localities.find((record) => record.entityId === disagreement.recordId) as LocalityRecord
          )
        : guideRoutes(
            guides.find((record) => record.guideId === disagreement.recordId) as GuideRecord
          );
    return {
      recordId: disagreement.recordId,
      gateFailures: disagreement.gateFailures,
      withdrawnOn: evaluatedOn,
      routesRemoved,
    };
  });

  const factReviewReturns = localities
    .filter((record) => needsFactReviewReturn(record))
    .map((record) => record.entityId);

  return {
    evaluatedOn,
    withdrawals,
    factReviewReturns,
    disagreements,
    publishedLocalityCount: localities.filter((record) => evaluateLocality(record, now).eligible)
      .length,
    publishedGuideCount: guides.filter((record) => evaluateGuide(record, now).eligible).length,
  };
}
