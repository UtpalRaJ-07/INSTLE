/**
 * The editorial workflow, derived rather than stored.
 *
 * Requirement 11.1 needs eight states. `editorialStatus` already has seven —
 * `candidate` through `approved` — and `publicationStatus` has two. Rather than
 * change either type and churn the tests that read them, the eight-state view is
 * **derived**: a record is `published` when its publication status says so, and
 * otherwise it is whatever its editorial status says. One consequence worth
 * stating: there is no way to be published and in draft at the same time, because
 * the derivation has no such branch to express.
 *
 * Three rules live here, and each exists because the alternative is a page that
 * looks reviewed and is not:
 *
 *  - `transition` allows one step forward or any number of steps back. A jump from
 *    `draft` to `approved` is rejected by name (Requirements 11.1, 11.11).
 *  - `validateApprovalSignOff` requires three distinct, attributable names and the
 *    timestamp order local ≤ editorial ≤ SEO, reusing
 *    `NON_ATTRIBUTABLE_REVIEWER_NAMES` from `claims.ts` so a desk name is rejected
 *    in one place rather than three (Requirements 11.2, 11.3).
 *  - `validateBatch` holds a batch unreleased until every member passes the gate
 *    and the band is met, so review capacity governs release pace rather than
 *    enthusiasm (Requirements 1.8, 11.10).
 */

import { isAttributableName } from './claims';
import type { EditorialStatus, LocalityPublicationStatus, LocalityRecord } from './localities';
import { MILLISECONDS_PER_DAY } from '@/lib/calendar-dates';

// ---------------------------------------------------------------------------
// The eight states
// ---------------------------------------------------------------------------

export type WorkflowState =
  | 'candidate'
  | 'research'
  | 'draft'
  | 'fact_review'
  | 'editorial_review'
  | 'seo_review'
  | 'approved'
  | 'published';

export const WORKFLOW_SEQUENCE: readonly WorkflowState[] = [
  'candidate',
  'research',
  'draft',
  'fact_review',
  'editorial_review',
  'seo_review',
  'approved',
  'published',
] as const;

/** Requirement 11.1. The eight-state view of a record, computed not stored. */
export function deriveWorkflowState(record: {
  readonly editorialStatus: EditorialStatus;
  readonly publicationStatus: LocalityPublicationStatus;
}): WorkflowState {
  return record.publicationStatus === 'published' ? 'published' : record.editorialStatus;
}

export type TransitionResult =
  | { readonly ok: true; readonly next: WorkflowState }
  | { readonly ok: false; readonly error: string };

/**
 * Requirement 11.1 and 11.11. Forward one step, or back any number of steps.
 *
 * A rejected move names both ends of the transition, because "invalid state
 * change" in a log tells nobody which change to stop making.
 */
export function transition(from: WorkflowState, to: WorkflowState): TransitionResult {
  const fromIndex = WORKFLOW_SEQUENCE.indexOf(from);
  const toIndex = WORKFLOW_SEQUENCE.indexOf(to);

  if (fromIndex < 0) return { ok: false, error: `"${from}" is not a workflow state.` };
  if (toIndex < 0) return { ok: false, error: `"${to}" is not a workflow state.` };

  if (toIndex < fromIndex) return { ok: true, next: to };
  if (toIndex === fromIndex + 1) return { ok: true, next: to };

  if (toIndex === fromIndex) {
    return {
      ok: false,
      error: `Rejected transition ${from} → ${to}: a record cannot move to the state it is already in.`,
    };
  }

  return {
    ok: false,
    error: `Rejected transition ${from} → ${to}: only ${WORKFLOW_SEQUENCE[fromIndex + 1]} follows ${from}, and only an earlier state is accepted as rework.`,
  };
}

// ---------------------------------------------------------------------------
// Sign-off
// ---------------------------------------------------------------------------

/**
 * Requirement 11.2 counts three sign-off names but `LocalityRecord` carries only
 * `author`, `localReviewer` and `seoReviewer`. The editorial sign-off name is
 * therefore read from `author` unless a caller supplies the approver explicitly —
 * a batch does, because `ContentBatch` records the editorial approver by name.
 *
 * Recording the reading as a constant keeps it visible: it is a mapping decision,
 * not a fact about who approved anything.
 */
export const EDITORIAL_SIGN_OFF_FIELD = 'author';

export interface SignOffValidation {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

interface NamedSignOff {
  readonly role: string;
  readonly name: string | null;
}

function nameFailures(signOffs: readonly NamedSignOff[]): string[] {
  const failures: string[] = [];

  for (const { role, name } of signOffs) {
    if (name === null || name.trim().length === 0) {
      failures.push(`No ${role} name recorded.`);
      continue;
    }
    if (!isAttributableName(name)) {
      failures.push(
        `The ${role} name "${name}" does not identify an accountable person, so the sign-off is rejected.`
      );
    }
  }

  // Distinctness after trimming and case normalisation, so "  utpal raj kb  "
  // cannot stand in for a second reviewer.
  for (let first = 0; first < signOffs.length; first += 1) {
    for (let second = first + 1; second < signOffs.length; second += 1) {
      const a = signOffs[first];
      const b = signOffs[second];
      if (!a.name || !b.name) continue;
      if (a.name.trim().toLowerCase() === b.name.trim().toLowerCase()) {
        failures.push(
          `The ${a.role} and the ${b.role} are the same person ("${a.name.trim()}"); three distinct names are required.`
        );
      }
    }
  }

  return failures;
}

function parseTimestamp(value: string | null): Date | null {
  if (!value || value.trim().length === 0) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Requirement 11.2 and 11.3.
 *
 * @param record the record entering the approved state
 * @param editorialApprover the editorial sign-off name; defaults to the record's
 * `author`, per `EDITORIAL_SIGN_OFF_FIELD`
 */
export function validateApprovalSignOff(
  record: LocalityRecord,
  editorialApprover: string | null = record.author
): SignOffValidation {
  const failures: string[] = [
    ...nameFailures([
      { role: 'editorial approval', name: editorialApprover },
      { role: 'local reviewer', name: record.localReviewer },
      { role: 'SEO reviewer', name: record.seoReviewer },
    ]),
  ];

  const timestamps = [
    { field: 'localReviewApprovedAt', value: record.localReviewApprovedAt },
    { field: 'editorialApprovedAt', value: record.editorialApprovedAt },
    { field: 'seoReviewApprovedAt', value: record.seoReviewApprovedAt },
  ] as const;

  const parsed = timestamps.map(({ field, value }) => {
    const date = parseTimestamp(value);
    if (value === null || value.trim().length === 0) {
      failures.push(`No ${field} recorded.`);
    } else if (!date) {
      failures.push(`${field} "${value}" is not a date.`);
    }
    return { field, date };
  });

  const [local, editorial, seo] = parsed;
  if (local.date && editorial.date && local.date.getTime() > editorial.date.getTime()) {
    failures.push(
      `${local.field} (${record.localReviewApprovedAt}) is later than ${editorial.field} (${record.editorialApprovedAt}); the order must be local review, then editorial, then SEO.`
    );
  }
  if (editorial.date && seo.date && editorial.date.getTime() > seo.date.getTime()) {
    failures.push(
      `${editorial.field} (${record.editorialApprovedAt}) is later than ${seo.field} (${record.seoReviewApprovedAt}); the order must be local review, then editorial, then SEO.`
    );
  }

  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// The review window
// ---------------------------------------------------------------------------

/** Requirement 11.5. A source check is good for at most this long. */
export const SOURCE_CHECK_MAX_DAYS = 180;

/**
 * Requirement 11.5. `nextReviewAt` is no earlier than `sourceCheckedAt` and no
 * more than 180 days after it, and all three dates are recorded.
 *
 * A review date before the source check would mean the next review is already
 * owed; a review date a year out would mean the 180-day recheck never happens.
 */
export function validateReviewWindow(record: {
  readonly sourceCheckedAt: string | null;
  readonly contentUpdatedAt: string | null;
  readonly nextReviewAt: string | null;
}): SignOffValidation {
  const failures: string[] = [];

  const sourceCheckedAt = parseTimestamp(record.sourceCheckedAt);
  const nextReviewAt = parseTimestamp(record.nextReviewAt);

  if (!record.sourceCheckedAt) failures.push('No sourceCheckedAt recorded.');
  else if (!sourceCheckedAt) failures.push(`sourceCheckedAt "${record.sourceCheckedAt}" is not a date.`);

  if (!record.contentUpdatedAt) failures.push('No contentUpdatedAt recorded.');
  else if (!parseTimestamp(record.contentUpdatedAt)) {
    failures.push(`contentUpdatedAt "${record.contentUpdatedAt}" is not a date.`);
  }

  if (!record.nextReviewAt) failures.push('No nextReviewAt recorded.');
  else if (!nextReviewAt) failures.push(`nextReviewAt "${record.nextReviewAt}" is not a date.`);

  if (sourceCheckedAt && nextReviewAt) {
    const days = Math.round(
      (nextReviewAt.getTime() - sourceCheckedAt.getTime()) / MILLISECONDS_PER_DAY
    );
    if (days < 0) {
      failures.push(
        `nextReviewAt (${record.nextReviewAt}) is earlier than sourceCheckedAt (${record.sourceCheckedAt}).`
      );
    } else if (days > SOURCE_CHECK_MAX_DAYS) {
      failures.push(
        `nextReviewAt (${record.nextReviewAt}) is ${days} days after sourceCheckedAt (${record.sourceCheckedAt}), beyond the ${SOURCE_CHECK_MAX_DAYS}-day limit.`
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export interface BatchSizeBand {
  readonly min: number;
  readonly max: number;
}

/** Requirement 1.8. */
export const FIRST_BATCH_SIZE: BatchSizeBand = { min: 8, max: 12 } as const;
export const LATER_BATCH_SIZE: BatchSizeBand = { min: 10, max: 15 } as const;

/**
 * The batch shape this module validates.
 *
 * Declared structurally rather than imported: `ContentBatch` lives in
 * `internal/registers/batches.ts`, and nothing under `src/` may name that
 * directory (Requirement 3.12). The fields match, so a `ContentBatch` is accepted
 * here without either side importing the other.
 */
export interface BatchUnderReview {
  readonly batchId: string;
  readonly recordIds: readonly string[];
  readonly localReviewer: string;
  readonly editorialApprover: string;
  readonly seoReviewer: string;
  readonly releasedOn: string | null;
}

export interface BatchContext {
  /** Identifiers of every record that passes the publication gate right now. */
  readonly gatePassingRecordIds: readonly string[];
  /** Batches already released. Zero means this is the first batch. */
  readonly releasedBatchCount: number;
}

export function batchSizeBand(releasedBatchCount: number): BatchSizeBand {
  return releasedBatchCount === 0 ? FIRST_BATCH_SIZE : LATER_BATCH_SIZE;
}

/**
 * Requirements 1.8 and 11.10.
 *
 * "No partial release" is implemented as a whole-batch failure: one member that
 * fails the gate fails the batch, so the release either happens complete or does
 * not happen. The failure names each offending record, because dropping the member
 * and releasing the rest is exactly the shortcut the requirement forbids.
 */
export function validateBatch(batch: BatchUnderReview, context: BatchContext): SignOffValidation {
  const failures: string[] = [];
  const band = batchSizeBand(context.releasedBatchCount);
  const label = context.releasedBatchCount === 0 ? 'first batch' : 'later batch';

  if (batch.batchId.trim().length === 0) failures.push('No batch identifier recorded.');

  if (batch.recordIds.length < band.min || batch.recordIds.length > band.max) {
    failures.push(
      `Batch ${batch.batchId} holds ${batch.recordIds.length} record(s); a ${label} holds ${band.min} to ${band.max}.`
    );
  }

  const seen = new Set<string>();
  for (const recordId of batch.recordIds) {
    if (seen.has(recordId)) {
      failures.push(`Batch ${batch.batchId} lists record ${recordId} more than once.`);
    }
    seen.add(recordId);
  }

  const gatePassing = new Set(context.gatePassingRecordIds);
  for (const recordId of batch.recordIds) {
    if (!gatePassing.has(recordId)) {
      failures.push(
        `Batch ${batch.batchId} includes record ${recordId}, which does not pass the publication gate; the whole batch stays unreleased.`
      );
    }
  }

  failures.push(
    ...nameFailures([
      { role: 'local reviewer', name: batch.localReviewer },
      { role: 'editorial approver', name: batch.editorialApprover },
      { role: 'SEO reviewer', name: batch.seoReviewer },
    ])
  );

  if (batch.releasedOn !== null && !parseTimestamp(batch.releasedOn)) {
    failures.push(`Batch ${batch.batchId} records a release date "${batch.releasedOn}" that is not a date.`);
  }

  return { ok: failures.length === 0, failures };
}
