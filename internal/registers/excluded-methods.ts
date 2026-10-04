/**
 * Excluded link-building method register — internal working material.
 *
 * Requirement 12.11: each excluded method carries one entry with a reason and a
 * recorded date — purchased ranking links, private blog networks, comment
 * placements, paid directory profiles, incentivised reviews and synthetic
 * reviews. Recording the exclusion, rather than simply not doing the thing, is
 * what makes the decision auditable later.
 *
 * The method names are a closed union rather than free text, so the set cannot
 * quietly lose a member: dropping one is a compile error, and
 * `validateExcludedMethods` checks that all six are present with a reason and a
 * date.
 */

import { parseCalendarDate } from '@/lib/calendar-dates';

/** The six methods Requirement 12.11 names. */
export type ExcludedMethodName =
  | 'purchased-ranking-links'
  | 'private-blog-networks'
  | 'comment-placements'
  | 'paid-directory-profiles'
  | 'incentivised-reviews'
  | 'synthetic-reviews';

export const EXCLUDED_METHOD_NAMES: readonly ExcludedMethodName[] = [
  'purchased-ranking-links',
  'private-blog-networks',
  'comment-placements',
  'paid-directory-profiles',
  'incentivised-reviews',
  'synthetic-reviews',
] as const;

/** One excluded method. */
export interface ExcludedMethod {
  readonly methodId: string;
  readonly method: ExcludedMethodName;
  /** What the method is, in the words an outside reader would need. */
  readonly description: string;
  /** Why it is excluded. */
  readonly reason: string;
  /** The date the exclusion was recorded. */
  readonly recordedOn: string;
}

const RECORDED_ON = '2026-09-29';

/**
 * The live register.
 *
 * All six entries, recorded on the date the decision was taken. None of these is a
 * hypothetical: each is a method that is on offer to a brokerage site and each is a
 * violation of a search engine's spam policy, a review platform's terms, or both.
 */
export const EXCLUDED_METHODS: readonly ExcludedMethod[] = [
  {
    methodId: 'EXM-PURCHASED-RANKING-LINKS',
    method: 'purchased-ranking-links',
    description:
      'Paying a site, broker or agency for a link, or for a placement whose price is set by the link it carries.',
    reason:
      'A link bought to influence ranking is link spam under Google’s search spam policies, and the penalty falls on this site rather than on the seller.',
    recordedOn: RECORDED_ON,
  },
  {
    methodId: 'EXM-PRIVATE-BLOG-NETWORKS',
    method: 'private-blog-networks',
    description:
      'Placing content on a network of sites that exists to pass links between its members rather than to be read.',
    reason:
      'The network has no readers, so a placement on it helps nobody and is link spam under the same policy. It also puts the business name on pages nobody reviewed.',
    recordedOn: RECORDED_ON,
  },
  {
    methodId: 'EXM-COMMENT-PLACEMENTS',
    method: 'comment-placements',
    description:
      'Adding a link to this site in the comments, forum posts or profile fields of somebody else’s site.',
    reason:
      'An unsolicited link in a comment is spam to the host and to its readers, and it associates the business with a pattern search engines discount or penalise.',
    recordedOn: RECORDED_ON,
  },
  {
    methodId: 'EXM-PAID-DIRECTORY-PROFILES',
    method: 'paid-directory-profiles',
    description:
      'Paying a directory for a profile whose value is the link it carries rather than the customers it sends.',
    reason:
      'A directory nobody uses sends no customer, and a paid link inside it is a purchased ranking link by another name. A directory that genuinely sends customers is a separate decision, recorded separately when one is found.',
    recordedOn: RECORDED_ON,
  },
  {
    methodId: 'EXM-INCENTIVISED-REVIEWS',
    method: 'incentivised-reviews',
    description:
      'Offering a discount, gift, fee reduction or any other consideration in exchange for a review.',
    reason:
      'An incentive changes what the reviewer writes, so the review stops describing the service. It also breaches the terms of every major review platform.',
    recordedOn: RECORDED_ON,
  },
  {
    methodId: 'EXM-SYNTHETIC-REVIEWS',
    method: 'synthetic-reviews',
    description:
      'Writing a review in a customer’s voice, generating one, or publishing a review whose source cannot be named.',
    reason:
      'A review nobody wrote is a fabricated statement about the business, which is the one failure this project treats as non-negotiable. Requirement 12.6 keeps every rating and review count off the public surface while no sourced review exists.',
    recordedOn: RECORDED_ON,
  },
] as const;

/** Requirement 12.11. All six present, each with a reason and a recorded date. */
export function validateExcludedMethods(
  methods: readonly ExcludedMethod[] = EXCLUDED_METHODS
): { readonly ok: boolean; readonly failures: readonly string[] } {
  const failures: string[] = [];
  const recorded = new Set(methods.map((method) => method.method));

  for (const name of EXCLUDED_METHOD_NAMES) {
    if (!recorded.has(name)) failures.push(`No entry recorded for the excluded method "${name}".`);
  }

  const seenIds = new Set<string>();
  for (const method of methods) {
    const label = method.methodId.trim().length > 0 ? method.methodId : '(unidentified method)';
    if (method.methodId.trim().length === 0) failures.push('An entry carries no identifier.');
    if (seenIds.has(method.methodId)) failures.push(`${label}: identifier used more than once.`);
    seenIds.add(method.methodId);

    if (method.description.trim().length === 0) failures.push(`${label}: no description recorded.`);
    if (method.reason.trim().length === 0) failures.push(`${label}: no reason recorded.`);
    if (!parseCalendarDate(method.recordedOn)) {
      failures.push(`${label}: "${method.recordedOn}" is not a recorded date.`);
    }
  }

  const duplicated = EXCLUDED_METHOD_NAMES.filter(
    (name) => methods.filter((method) => method.method === name).length > 1
  );
  for (const name of duplicated) {
    failures.push(`More than one entry recorded for "${name}"; Requirement 12.11 asks for one each.`);
  }

  return { ok: failures.length === 0, failures };
}
