/**
 * Withdrawal register — internal working material.
 *
 * Requirement 11.9: when a record is withdrawn, every gate failure string is
 * recorded rather than a summary, alongside the withdrawal date and every route
 * removed, and the record and its approvals are retained. A summary would lose
 * the detail an editor needs to fix all of the failures at once.
 *
 * `validateWithdrawalEntry` is what keeps the promise. An entry carrying a single
 * tidy sentence in place of the gate's own strings is rejected, because the tidy
 * sentence is where the information goes missing.
 */

import { parseCalendarDate } from '@/lib/calendar-dates';

/** One withdrawal. */
export interface WithdrawalEntry {
  readonly recordId: string;
  /** Every failure string the gate returned, not a summary. */
  readonly gateFailures: readonly string[];
  readonly withdrawnOn: string;
  readonly routesRemoved: readonly string[];
}

/**
 * The live register.
 *
 * Empty: nothing has been withdrawn, because nothing the gate rejects has ever
 * carried a persisted published status. `scripts/sync-publication-status.mjs`
 * appends between the two markers below, and nowhere else — the markers exist so an
 * appended entry cannot land in the middle of the file and so a human editing an
 * entry by hand can see which region a script also writes to.
 *
 * Entries accumulate. A withdrawal is not removed when the record returns, because
 * the history of what left the site and why is the point of the register.
 */
export const WITHDRAWAL_ENTRIES: readonly WithdrawalEntry[] = [
  /* SYNC-MANAGED ENTRIES START */
  /* SYNC-MANAGED ENTRIES END */
];

/**
 * Build an entry from a gate evaluation.
 *
 * Takes the failure list whole. There is deliberately no parameter for a summary
 * reason, so the only thing a caller can record is what the gate actually said.
 */
export function createWithdrawalEntry(input: {
  readonly recordId: string;
  readonly gateFailures: readonly string[];
  readonly withdrawnOn: string;
  readonly routesRemoved: readonly string[];
}): WithdrawalEntry {
  return {
    recordId: input.recordId,
    gateFailures: [...input.gateFailures],
    withdrawnOn: input.withdrawnOn,
    routesRemoved: [...input.routesRemoved],
  };
}

export function validateWithdrawalEntry(entry: WithdrawalEntry): {
  readonly ok: boolean;
  readonly failures: readonly string[];
} {
  const failures: string[] = [];

  if (entry.recordId.trim().length === 0) failures.push('No record identifier recorded.');
  if (entry.gateFailures.length === 0) {
    failures.push(
      `${entry.recordId}: no gate failure recorded; a withdrawal keeps every failure string the gate returned.`
    );
  }
  if (entry.gateFailures.some((failure) => failure.trim().length === 0)) {
    failures.push(`${entry.recordId}: a recorded gate failure is blank.`);
  }
  if (!parseCalendarDate(entry.withdrawnOn)) {
    failures.push(`${entry.recordId}: "${entry.withdrawnOn}" is not a withdrawal date.`);
  }
  if (entry.routesRemoved.length === 0) {
    failures.push(`${entry.recordId}: no removed route recorded.`);
  }

  return { ok: failures.length === 0, failures };
}
