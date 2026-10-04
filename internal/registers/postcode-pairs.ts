/**
 * Locality-to-postcode pair register — internal working material, never
 * rendered.
 *
 * Requirement 12.4: a PIN code may be paired with a locality only on at least
 * two sources from at least two independence groups, with a recorded boundary
 * version and a named reviewer. No such pairing is evidenced, so no PIN-code
 * route is registered and no six-digit numeral is presented as a PIN code
 * anywhere on the public surface. This register exists to hold the research when
 * it is done, behind the boundary, so that recording a pair is not the same act
 * as publishing one.
 *
 * The evidence rule is not restated here: `evaluateSourceIndependence` from
 * `src/config/claims.ts` is the same function the claim gate uses, so a pairing
 * cannot be admitted on evidence a claim would be rejected for.
 */

import { evaluateSourceIndependence, isAttributableName, type SourceRecord } from '@/config/claims';

/** One locality-to-postcode pairing under research. */
export interface PostcodePair {
  readonly pairId: string;
  readonly localitySlug: string;
  readonly postcode: string;
  /** At least two, from at least two independence groups. */
  readonly sources: readonly SourceRecord[];
  readonly boundaryVersion: string;
  readonly reviewer: string;
}

/**
 * The live register.
 *
 * Empty: no postal mapping has two independent sources behind it.
 */
export const POSTCODE_PAIRS: readonly PostcodePair[] = [];

/**
 * Requirement 12.4. Whether a pairing may be held as researched.
 *
 * Note what a passing evaluation does *not* authorise: rendering. The pairing stays
 * in this register either way — Requirement 12.3 keeps every six-digit numeral off
 * the public surface regardless of how well evidenced the pairing is.
 */
export function evaluatePostcodePair(pair: PostcodePair): {
  readonly recorded: boolean;
  readonly failures: readonly string[];
} {
  const failures: string[] = [];
  const label = pair.pairId.trim().length > 0 ? pair.pairId : '(unidentified pair)';

  if (pair.pairId.trim().length === 0) failures.push('No pair identifier recorded.');
  if (pair.localitySlug.trim().length === 0) failures.push(`${label}: no locality slug recorded.`);
  if (!/^\d{6}$/.test(pair.postcode.trim())) {
    failures.push(`${label}: "${pair.postcode}" is not a six-digit postal code.`);
  }
  if (pair.boundaryVersion.trim().length === 0) {
    failures.push(`${label}: no boundary version recorded, so the pairing names no boundary set.`);
  }
  if (!isAttributableName(pair.reviewer)) {
    failures.push(
      pair.reviewer.trim().length === 0
        ? `${label}: no named reviewer recorded.`
        : `${label}: reviewer "${pair.reviewer}" does not identify an accountable person.`
    );
  }

  failures.push(...evaluateSourceIndependence(pair.sources).map((reason) => `${label}: ${reason}`));

  return { recorded: failures.length === 0, failures };
}
