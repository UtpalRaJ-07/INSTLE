/**
 * Crawler access register — the two recorded decisions robots.txt reads.
 *
 * Requirement 6.3 treats search access and training access as separate decisions,
 * so they live in two separately exported, frozen constants with no shared field.
 * robots.txt builds one user-agent group from each, and a change to one constant
 * has no path to the other's group.
 *
 * Everything fails closed. `buildAgentGroup` emits an Allow line only for a
 * decision that is `allowed`, is fully recorded — deciding person, decision date,
 * guidance reference, verification date, verifying person — and was verified no
 * more than 90 days before `now`. Anything else, including `unrecorded`, emits
 * `Disallow: /` (Requirement 6.10). `auditCrawlerAccess` reports the same problems
 * by name, and the policy suite runs it against the build date so a stale
 * verification fails the build (Requirements 6.5 and 6.11).
 *
 * **Why the search decision is seeded `unrecorded`.** The design sketch seeds
 * `OAI-SearchBot` as `allowed` with no deciding person, no decision date and no
 * verification. Requirement 6.4 requires a recorded value to carry the deciding
 * person and the date, and nothing in this repository records that anybody made
 * this decision: the owner register (`owner.ts`) and the decision log are silent on
 * crawler access, and the owner checklist asks for the decision under C15 rather
 * than recording an answer to it. The only evidence of intent is the
 * request that the business be recognised by ChatGPT and other AI assistants,
 * which is a wish rather than a named, dated, verified decision. Writing `allowed`
 * would assert a decision nobody recorded, and naming the business owner as the
 * decider would invent one. So the value stays `unrecorded` until an owner answer
 * supplies a name and a date and somebody checks the rule against the crawler
 * operator's current guidance.
 *
 * That costs nothing while robots.txt serves `Disallow: /` to every agent, which
 * it does until production and a confirmed domain (A1, OWN-01). It stops being
 * free at that release: a named `OAI-SearchBot` group overrides the `*` group, so
 * an unrecorded search decision would block that crawler in production. The
 * decision has to be answered before the release that confirms the domain.
 */

import { isAttributableName } from './claims';
import { differenceInCalendarDays, parseCalendarDate } from '@/lib/calendar-dates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AccessDecision = 'allowed' | 'disallowed' | 'unrecorded';

export interface CrawlerAccessDecision {
  readonly decisionId: 'search-crawl' | 'training-crawl';
  readonly userAgents: readonly string[];
  readonly decision: AccessDecision;
  readonly decidedBy: string | null;
  /** Calendar date, `YYYY-MM-DD`. */
  readonly decidedOn: string | null;
  /** The crawler operator's guidance document this rule was checked against. */
  readonly guidanceReference: string | null;
  /** Calendar date, `YYYY-MM-DD`. */
  readonly verifiedOn: string | null;
  readonly verifiedBy: string | null;
}

/** One robots.txt group, in the shape `MetadataRoute.Robots['rules']` accepts. */
export interface AgentGroup {
  userAgent: string[];
  allow?: string[];
  disallow?: string[];
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/** Requirements 6.5 and 6.11. A verification older than this is stale. */
export const CRAWLER_VERIFICATION_MAX_AGE_DAYS = 90;

/**
 * Kept out of every allowed per-agent group. A named group replaces the `*` group
 * for that crawler, so without this line an allowed crawler would regain the
 * enquiry endpoint the `*` group blocks. Not a decision field, so sharing it
 * gives neither decision a way to reach the other.
 */
export const ENQUIRY_API_DISALLOW_PATH = '/api/';

// ---------------------------------------------------------------------------
// The two decisions
// ---------------------------------------------------------------------------

/**
 * Search crawling by `OAI-SearchBot`. Unrecorded — see the file note for why this
 * departs from the design sketch's `allowed`.
 */
export const SEARCH_CRAWL_DECISION: CrawlerAccessDecision = Object.freeze({
  decisionId: 'search-crawl',
  userAgents: Object.freeze(['OAI-SearchBot']),
  decision: 'unrecorded',
  decidedBy: null,
  decidedOn: null,
  guidanceReference: null,
  verifiedOn: null,
  verifiedBy: null,
});

/**
 * Training crawling by `GPTBot`. Unrecorded until Owner_Input_Register C14 is
 * answered, so training access is never granted by default (Requirement 6.10).
 */
export const TRAINING_CRAWL_DECISION: CrawlerAccessDecision = Object.freeze({
  decisionId: 'training-crawl',
  userAgents: Object.freeze(['GPTBot']),
  decision: 'unrecorded',
  decidedBy: null,
  decidedOn: null,
  guidanceReference: null,
  verifiedOn: null,
  verifiedBy: null,
});

/** Both shipped decisions, for the policy suite. */
export const CRAWLER_ACCESS_DECISIONS: readonly CrawlerAccessDecision[] = Object.freeze([
  SEARCH_CRAWL_DECISION,
  TRAINING_CRAWL_DECISION,
]);

/**
 * The Owner_Input_Register entry whose answer records each decision.
 *
 * C14 is the training-crawl entry the design specifies. C15 is the search-crawl
 * entry added to close the gap this map recorded as `null`: the register now asks
 * for the search decision in its own words, marked as blocking a release, because
 * an unrecorded search decision blocks `OAI-SearchBot` the moment the site is live
 * on a confirmed domain. The type keeps `null` available so a future decision added
 * without a register entry still records its gap rather than hiding it.
 */
export const CRAWLER_DECISION_CHECKLIST_ENTRIES: Readonly<
  Record<CrawlerAccessDecision['decisionId'], string | null>
> = Object.freeze({
  'search-crawl': 'C15',
  'training-crawl': 'C14',
});

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface CrawlerDecisionEvaluation {
  readonly decisionId: CrawlerAccessDecision['decisionId'];
  /** True only for a complete, currently verified `allowed` decision. */
  readonly grantsAccess: boolean;
  /** Whole calendar days from the recorded verification to `now`; null when none is recorded. */
  readonly verificationAgeDays: number | null;
  /** Every reason, so a record can be completed in one pass. */
  readonly failures: readonly string[];
}

const ACCESS_DECISIONS: readonly AccessDecision[] = ['allowed', 'disallowed', 'unrecorded'];

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function labelFor(decision: CrawlerAccessDecision): string {
  const agents = decision.userAgents.length > 0 ? decision.userAgents.join(', ') : 'no user agent';
  return `Crawler decision ${decision.decisionId} (${agents})`;
}

/**
 * Whole calendar days between the recorded verification and `now`.
 *
 * @returns null when no valid verification date is recorded. A negative value means
 * the verification is dated after `now`.
 */
export function crawlerVerificationAgeDays(
  decision: CrawlerAccessDecision,
  now: Date = new Date()
): number | null {
  const verified = parseCalendarDate(decision.verifiedOn);
  return verified ? differenceInCalendarDays(now, verified) : null;
}

function verificationFailures(decision: CrawlerAccessDecision, now: Date, label: string): string[] {
  const failures: string[] = [];
  const recorded = decision.decision === 'allowed' || decision.decision === 'disallowed';
  const anyVerificationField =
    !isBlank(decision.guidanceReference) || !isBlank(decision.verifiedOn) || !isBlank(decision.verifiedBy);

  // Requirement 6.5. A recorded decision needs a whole verification; an unrecorded
  // one needs none, but a partial one is a recording error either way.
  if (!recorded && !anyVerificationField) return failures;

  if (isBlank(decision.guidanceReference)) {
    failures.push(`${label}: no crawler guidance reference recorded.`);
  }
  if (!isAttributableName(decision.verifiedBy)) {
    failures.push(
      isBlank(decision.verifiedBy)
        ? `${label}: no verifying person recorded.`
        : `${label}: the verifier "${decision.verifiedBy}" does not identify an accountable person.`
    );
  }

  const ageDays = crawlerVerificationAgeDays(decision, now);
  if (ageDays === null) {
    failures.push(`${label}: no valid verification date recorded.`);
  } else if (ageDays < 0) {
    failures.push(`${label}: the verification date ${decision.verifiedOn} is after the evaluation date.`);
  } else if (ageDays > CRAWLER_VERIFICATION_MAX_AGE_DAYS) {
    // Requirement 6.11.
    failures.push(
      `${label}: last verified ${ageDays} days before the evaluation date, more than the ${CRAWLER_VERIFICATION_MAX_AGE_DAYS}-day limit.`
    );
  }

  return failures;
}

/**
 * Requirements 6.4, 6.5, 6.10 and 6.11, evaluated against `now`.
 *
 * `grantsAccess` is true only when the value is `allowed` and there is no failure,
 * so an incomplete or stale `allowed` record is treated exactly like `unrecorded`.
 */
export function evaluateCrawlerDecision(
  decision: CrawlerAccessDecision,
  now: Date = new Date()
): CrawlerDecisionEvaluation {
  const failures: string[] = [];
  const label = labelFor(decision);

  if (decision.userAgents.length === 0) {
    failures.push(`${label}: names no user agent.`);
  }
  if (decision.userAgents.some((agent) => isBlank(agent))) {
    failures.push(`${label}: names a blank user agent.`);
  }
  // A per-agent decision naming `*` would replace the default group for every crawler.
  if (decision.userAgents.some((agent) => agent.trim() === '*')) {
    failures.push(`${label}: names the wildcard user agent, which belongs to the default group only.`);
  }

  if (!ACCESS_DECISIONS.includes(decision.decision)) {
    failures.push(`${label}: the decision value "${String(decision.decision)}" is not recognised.`);
  }

  const recorded = decision.decision === 'allowed' || decision.decision === 'disallowed';

  if (recorded) {
    // Requirement 6.4. A decision value without a person and a date is not a decision.
    if (!isAttributableName(decision.decidedBy)) {
      failures.push(
        isBlank(decision.decidedBy)
          ? `${label}: no deciding person recorded.`
          : `${label}: the decider "${decision.decidedBy}" does not identify an accountable person.`
      );
    }
    const decided = parseCalendarDate(decision.decidedOn);
    if (!decided) {
      failures.push(`${label}: no valid decision date recorded.`);
    } else if (differenceInCalendarDays(now, decided) < 0) {
      failures.push(`${label}: the decision date ${decision.decidedOn} is after the evaluation date.`);
    }
  } else if (!isBlank(decision.decidedBy) || !isBlank(decision.decidedOn)) {
    failures.push(`${label}: names a deciding person or a decision date but records no decision value.`);
  }

  failures.push(...verificationFailures(decision, now, label));

  return {
    decisionId: decision.decisionId,
    grantsAccess: decision.decision === 'allowed' && failures.length === 0,
    verificationAgeDays: crawlerVerificationAgeDays(decision, now),
    failures,
  };
}

/**
 * The robots.txt group for one decision. Requirement 6.10.
 *
 * Only a decision `evaluateCrawlerDecision` says grants access receives Allow;
 * everything else, `unrecorded` included, receives `Disallow: /` and no Allow line.
 * The output depends on this decision and `now` alone, and the user-agent list is
 * copied, so no caller can reach one decision through another's group.
 */
export function buildAgentGroup(decision: CrawlerAccessDecision, now: Date = new Date()): AgentGroup {
  const userAgent = [...decision.userAgents];
  if (evaluateCrawlerDecision(decision, now).grantsAccess) {
    return { userAgent, allow: ['/'], disallow: [ENQUIRY_API_DISALLOW_PATH] };
  }
  return { userAgent, disallow: ['/'] };
}

export interface CrawlerAccessAudit {
  readonly ok: boolean;
  readonly evaluations: readonly CrawlerDecisionEvaluation[];
  /** Every failure across the register, including user agents named by two decisions. */
  readonly failures: readonly string[];
}

/**
 * The policy-suite check. Run against the build date, a stale, incomplete or
 * future-dated record fails the build (Requirement 6.11), and a user agent named
 * by two decisions fails it too, because Requirement 6.3 needs each crawler's
 * rules to come from one decision.
 */
export function auditCrawlerAccess(
  now: Date = new Date(),
  decisions: readonly CrawlerAccessDecision[] = CRAWLER_ACCESS_DECISIONS
): CrawlerAccessAudit {
  const evaluations = decisions.map((decision) => evaluateCrawlerDecision(decision, now));
  const failures = evaluations.flatMap((evaluation) => evaluation.failures);

  const owners = new Map<string, string>();
  for (const decision of decisions) {
    for (const agent of decision.userAgents) {
      const key = agent.trim().toLowerCase();
      const previous = owners.get(key);
      if (previous !== undefined && previous !== decision.decisionId) {
        failures.push(`User agent ${agent} is named by both ${previous} and ${decision.decisionId}.`);
      }
      owners.set(key, previous ?? decision.decisionId);
    }
  }

  const ids = decisions.map((decision) => decision.decisionId);
  for (const id of new Set(ids)) {
    if (ids.filter((candidate) => candidate === id).length > 1) {
      failures.push(`Crawler decision ${id} is recorded more than once.`);
    }
  }

  return { ok: failures.length === 0, evaluations, failures };
}
