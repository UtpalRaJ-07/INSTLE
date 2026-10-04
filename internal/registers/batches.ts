/**
 * Content batch register — internal working material.
 *
 * Requirement 11.10: content is released in batches with a recorded local
 * reviewer, editorial approver and SEO reviewer, and no batch is released
 * partially. The batch list is editorial bookkeeping, so it lives behind the
 * same boundary as the other registers and is read by the progress report
 * generator and by tests only.
 *
 * The sizing bands and the release conditions are **not** restated here. They
 * live in `validateBatch` in `src/config/editorial-workflow.ts`, whose
 * `BatchUnderReview` shape matches `ContentBatch` field for field. Nothing under
 * `src/` may name this directory (Requirement 3.12), so the two sides meet
 * structurally rather than by import — and a test that imports both is what holds
 * them in step.
 */

/**
 * One release batch.
 *
 * `releasedOn` is null until the batch actually goes out, so a prepared batch and
 * a released batch are distinguishable without a second flag.
 */
export interface ContentBatch {
  readonly batchId: string; // BATCH-001 …
  readonly recordIds: readonly string[];
  readonly localReviewer: string;
  readonly editorialApprover: string;
  readonly seoReviewer: string;
  readonly releasedOn: string | null;
}

/**
 * The live register.
 *
 * Empty: zero records pass the publication gate, so no batch has been assembled.
 */
export const CONTENT_BATCHES: readonly ContentBatch[] = [];

/** Batches already released, which decides which sizing band the next one uses. */
export function releasedBatchCount(batches: readonly ContentBatch[] = CONTENT_BATCHES): number {
  return batches.filter((batch) => batch.releasedOn !== null).length;
}
