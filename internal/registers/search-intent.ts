/**
 * Search intent register — internal working material.
 *
 * Requirement 3.12: the register is excluded from public routes and from the
 * sitemap. That exclusion is a property of where this file lives, not of
 * anybody's discipline. `internal/` sits outside `src/`, `tsconfig.json` maps
 * `@/*` to `src/*` only, and `next.config.ts` compiles from `src/app`, so no
 * app module has a path that reaches this directory. The `@internal/*` alias
 * exists in `vitest.config.ts` and in the `paths` block for tests and for
 * `scripts/` alone, and `tests/internal-register-boundary.test.ts` asserts that
 * no file under `src/` names it.
 *
 * Requirement 3.6 is why the boundary does not starve the pages: the approved
 * phrase text is copied onto the locality or guide record at approval, and this
 * register keeps the evidence behind it. A page reads record fields only.
 *
 * The rule this file exists to enforce is Requirement 3.3. A volume figure is a
 * figure only when the tool, the query date, the three tool settings and an
 * unexpired re-query date are all recorded. When any of them is absent the
 * evaluation returns unavailable with a reason. There is deliberately **no
 * rounding branch and no inference branch**: an unevidenced number has no
 * approximation, and a register that quietly produced one would be worse than an
 * empty register, because the number would look researched.
 */

import {
  compareCalendarDates,
  differenceInCalendarDays,
  parseCalendarDate,
} from '@/lib/calendar-dates';

// ---------------------------------------------------------------------------
// Recorded shapes
// ---------------------------------------------------------------------------

/** How a phrase was found. A named tool or a named manual method — never neither. */
export type PhraseSource =
  | { readonly kind: 'tool'; readonly toolName: string }
  | { readonly kind: 'manual'; readonly methodName: string };

/** Bengaluru, or a named locality within it. Requirement 3.1. */
export type LocationContext =
  | { readonly scope: 'city'; readonly city: 'Bengaluru' }
  | { readonly scope: 'locality'; readonly city: 'Bengaluru'; readonly locality: string };

/**
 * A volume figure is only a figure when every condition in Requirement 3.2 is
 * recorded. `evaluateVolume` below is what decides whether it may be used.
 */
export interface VolumeObservation {
  readonly figure: number;
  readonly toolName: string;
  /** Calendar date, YYYY-MM-DD. */
  readonly queriedOn: string;
  readonly toolSettings: {
    readonly locationSetting: string;
    readonly languageSetting: string;
    readonly dateRangeApplied: string;
  };
  /** At most 180 days after queriedOn. Requirement 3.2. */
  readonly reQueryBy: string;
}

export type VolumeAvailability =
  | { readonly available: true; readonly figure: number }
  | { readonly available: false; readonly reason: string };

export interface SearchIntentEntry {
  readonly entryId: string;
  /** At most 120 characters. Requirement 3.1. */
  readonly phrase: string;
  readonly source: PhraseSource;
  /** Single calendar date the phrase was observed. */
  readonly observedOn: string;
  readonly locationContext: LocationContext;
  /** The single customer question the phrase asks. Requirement 3.1. */
  readonly primaryIntentQuestion: string;
  /** Route that serves this intent, or null while unassigned. */
  readonly destinationRoute: string | null;
  /** 'primary' — one per page. 'supporting' — at most 5 per page. */
  readonly role: 'primary' | 'supporting';
  readonly volume: VolumeObservation | null;
}

/** Requirement 3.8 and 3.9. A position is a dated sample, never a ranking. */
export interface CompetitorObservation {
  readonly observationId: string;
  readonly queryText: string;
  readonly observedOn: string;
  readonly toolName: string;
  readonly locationContext: LocationContext;
  readonly resultType: 'organic' | 'map' | 'paid' | 'ai-answer';
  /** Null unless a position was actually seen on that date through that tool. */
  readonly positionSample: number | null;
}

// ---------------------------------------------------------------------------
// Recorded bounds and owner state
// ---------------------------------------------------------------------------

/** Requirement 3.1. */
export const MAX_PHRASE_LENGTH = 120;

/** Requirement 3.2. A re-query date beyond this is not a re-query date. */
export const VOLUME_REQUERY_MAX_DAYS = 180;

/** Requirement 3.6 and 3.14. */
export const MAX_PRIMARY_INTENTS_PER_ROUTE = 1;
export const MAX_SUPPORTING_PHRASES_PER_PAGE = 5;

/**
 * The keyword research tool licence requested under Requirement 3.7.
 *
 * Section C of the Owner_Input_Register ends at C12 today, so the new entry is
 * C13. While `supplied` is false, Requirement 3.15 holds: phrases come from named
 * manual methods only and every volume figure is unavailable. That is enforced in
 * `evaluateVolume` and in `evaluateManualMethodOnlyMode` rather than left to
 * whoever adds the next entry.
 */
export interface KeywordToolLicence {
  readonly supplied: boolean;
  /** Owner_Input_Register entry that unblocks tool-sourced research. */
  readonly ownerInputEntry: string;
}

export const KEYWORD_RESEARCH_TOOL_LICENCE: KeywordToolLicence = {
  supplied: false,
  ownerInputEntry: 'C13',
} as const;

/**
 * Requirement 3.10. Superlative broker phrases are research queries and nothing
 * else: they may be recorded as something customers type, and they may never be
 * assigned to a page or copied into public copy as a self-description.
 */
export const SUPERLATIVE_BROKER_PHRASES: readonly string[] = [
  'best real estate broker',
  'top broker',
  'number one broker',
  'leading broker',
  'most trusted broker',
] as const;

/** How a recorded phrase may be used. Requirement 3.10. */
export type PhraseUsage = 'research-query-only' | 'assignable';

const SUPERLATIVE_WORDS: readonly string[] = [
  'best',
  'top',
  'number one',
  'no. 1',
  'no 1',
  '#1',
  'leading',
  'finest',
  'greatest',
  'most trusted',
] as const;

const BROKERAGE_WORDS: readonly string[] = [
  'broker',
  'brokerage',
  'agent',
  'agency',
  'real estate',
  'property dealer',
] as const;

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

/**
 * True when the phrase is a superlative broker phrase — either one of the five
 * Requirement 3.10 names outright, or any pairing of a superlative word with a
 * brokerage word, so "finest property dealer" is caught as well as the named
 * five.
 */
export function isSuperlativeBrokerPhrase(phrase: string): boolean {
  const normalised = normalise(phrase);
  if (normalised.length === 0) return false;
  if (SUPERLATIVE_BROKER_PHRASES.some((known) => normalised.includes(known))) return true;
  return (
    SUPERLATIVE_WORDS.some((word) => normalised.includes(word)) &&
    BROKERAGE_WORDS.some((word) => normalised.includes(word))
  );
}

/** Requirement 3.10. A superlative phrase is recorded, never served. */
export function classifyPhraseUsage(phrase: string): PhraseUsage {
  return isSuperlativeBrokerPhrase(phrase) ? 'research-query-only' : 'assignable';
}

// ---------------------------------------------------------------------------
// Entry evaluation
// ---------------------------------------------------------------------------

export interface IntentEntryEvaluation {
  readonly usable: boolean;
  /**
   * Every field that is absent, blank or recorded outside the bound Requirement
   * 3.1 sets, named individually. Requirement 3.13 asks for which field is
   * missing, so a summary reason would not satisfy it.
   */
  readonly missingFields: readonly string[];
}

/** Requirement 3.13. An entry missing a required field is held out of editorial use. */
export function evaluateIntentEntry(entry: SearchIntentEntry): IntentEntryEvaluation {
  const missingFields: string[] = [];

  if (isBlank(entry.entryId)) missingFields.push('entryId');

  if (isBlank(entry.phrase)) {
    missingFields.push('phrase');
  } else if (entry.phrase.trim().length > MAX_PHRASE_LENGTH) {
    // Not an absence, but the entry cannot be used as recorded either, and the
    // field at fault is still the one an editor has to fix.
    missingFields.push('phrase');
  }

  if (entry.source.kind === 'tool') {
    if (isBlank(entry.source.toolName)) missingFields.push('source.toolName');
  } else if (isBlank(entry.source.methodName)) {
    missingFields.push('source.methodName');
  }

  if (!parseCalendarDate(entry.observedOn)) missingFields.push('observedOn');

  if (entry.locationContext.scope === 'locality' && isBlank(entry.locationContext.locality)) {
    missingFields.push('locationContext.locality');
  }

  if (isBlank(entry.primaryIntentQuestion)) missingFields.push('primaryIntentQuestion');

  return { usable: missingFields.length === 0, missingFields };
}

/**
 * Requirement 3.2, 3.3 and 3.15. Never substitutes an estimate.
 *
 * @param licence the recorded tool-licence state. Defaults to the live state, so
 * the Requirement 3.15 outcome is what a caller gets without asking for it; tests
 * pass a supplied licence to reach the per-attribute branches.
 */
export function evaluateVolume(
  entry: SearchIntentEntry,
  now: Date,
  licence: KeywordToolLicence = KEYWORD_RESEARCH_TOOL_LICENCE
): VolumeAvailability {
  if (!licence.supplied) {
    return {
      available: false,
      reason: `No keyword research tool licence is recorded (Owner_Input_Register ${licence.ownerInputEntry}), so every volume figure is unavailable.`,
    };
  }

  const volume = entry.volume;
  if (!volume) {
    return { available: false, reason: 'No volume figure is recorded for this phrase.' };
  }

  if (isBlank(volume.toolName)) {
    return { available: false, reason: 'The volume figure records no named tool.' };
  }

  const queriedOn = parseCalendarDate(volume.queriedOn);
  if (!queriedOn) {
    return { available: false, reason: 'The volume figure records no query date.' };
  }

  if (isBlank(volume.toolSettings.locationSetting)) {
    return { available: false, reason: 'The volume figure records no location setting.' };
  }
  if (isBlank(volume.toolSettings.languageSetting)) {
    return { available: false, reason: 'The volume figure records no language setting.' };
  }
  if (isBlank(volume.toolSettings.dateRangeApplied)) {
    return { available: false, reason: 'The volume figure records no date range applied.' };
  }

  const reQueryBy = parseCalendarDate(volume.reQueryBy);
  if (!reQueryBy) {
    return { available: false, reason: 'The volume figure records no re-query date.' };
  }

  const windowDays = differenceInCalendarDays(reQueryBy, queriedOn);
  if (windowDays < 0) {
    return {
      available: false,
      reason: `The re-query date ${volume.reQueryBy} falls before the query date ${volume.queriedOn}.`,
    };
  }
  if (windowDays > VOLUME_REQUERY_MAX_DAYS) {
    return {
      available: false,
      reason: `The re-query date ${volume.reQueryBy} falls ${windowDays} days after the query date ${volume.queriedOn}, beyond the ${VOLUME_REQUERY_MAX_DAYS}-day limit.`,
    };
  }

  if (now.getTime() >= reQueryBy.getTime()) {
    return {
      available: false,
      reason: `The re-query date ${volume.reQueryBy} has passed.`,
    };
  }

  if (!Number.isFinite(volume.figure)) {
    return { available: false, reason: 'The recorded figure is not a number.' };
  }

  return { available: true, figure: volume.figure };
}

/**
 * Requirement 3.15. While no tool licence is recorded, an entry may be sourced
 * from a named manual method only and may carry no volume observation at all.
 *
 * Checking this as a register-wide rule rather than per entry is deliberate: the
 * rule is about what the register is allowed to contain today, and the answer has
 * to stay true as entries are added one at a time.
 */
export function evaluateManualMethodOnlyMode(
  entries: readonly SearchIntentEntry[],
  licence: KeywordToolLicence = KEYWORD_RESEARCH_TOOL_LICENCE
): { readonly compliant: boolean; readonly failures: readonly string[] } {
  if (licence.supplied) return { compliant: true, failures: [] };

  const failures: string[] = [];
  for (const entry of entries) {
    if (entry.source.kind === 'tool') {
      failures.push(
        `${entry.entryId}: recorded from tool "${entry.source.toolName}" while no tool licence is recorded (Owner_Input_Register ${licence.ownerInputEntry}).`
      );
    }
    if (entry.volume !== null) {
      failures.push(
        `${entry.entryId}: carries a volume observation while every volume figure must be recorded unavailable (Owner_Input_Register ${licence.ownerInputEntry}).`
      );
    }
  }
  return { compliant: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Competitor observations
// ---------------------------------------------------------------------------

/** Requirement 3.9. The label every recorded position carries. */
export const POSITION_SAMPLE_LABEL = 'dated sample';

/** Requirement 3.8. Every field the observation must record, named individually. */
export function evaluateCompetitorObservation(observation: CompetitorObservation): {
  readonly usable: boolean;
  readonly missingFields: readonly string[];
} {
  const missingFields: string[] = [];

  if (isBlank(observation.observationId)) missingFields.push('observationId');
  if (isBlank(observation.queryText)) missingFields.push('queryText');
  if (!parseCalendarDate(observation.observedOn)) missingFields.push('observedOn');
  if (isBlank(observation.toolName)) missingFields.push('toolName');
  if (
    observation.locationContext.scope === 'locality' &&
    isBlank(observation.locationContext.locality)
  ) {
    missingFields.push('locationContext.locality');
  }
  if (observation.positionSample !== null && !Number.isFinite(observation.positionSample)) {
    missingFields.push('positionSample');
  }

  return { usable: missingFields.length === 0, missingFields };
}

/**
 * Requirement 3.9. A recorded position is only ever reported as a dated sample
 * through a named tool, so there is no code path that renders a bare number.
 *
 * @returns the sentence describing the sample, or null when no position was seen
 * or the observation is missing the date or the tool that would date it.
 */
export function describePositionSample(observation: CompetitorObservation): string | null {
  if (observation.positionSample === null) return null;
  if (!evaluateCompetitorObservation(observation).usable) return null;

  const where =
    observation.locationContext.scope === 'locality'
      ? `${observation.locationContext.locality}, ${observation.locationContext.city}`
      : observation.locationContext.city;

  return `Position ${observation.positionSample} for "${observation.queryText}" is a ${POSITION_SAMPLE_LABEL} observed on ${observation.observedOn} through ${observation.toolName} as ${observation.resultType} in ${where}, not a ranking.`;
}

// ---------------------------------------------------------------------------
// One question, one page
// ---------------------------------------------------------------------------

/** A route and the primary intent it serves. Requirement 3.4. */
export interface IntentAssignment {
  readonly route: string;
  readonly intentEntryId: string;
  readonly primaryIntentQuestion: string;
  readonly supportingPhrases: readonly string[];
}

export type IntentAssignmentResult =
  | { readonly ok: true; readonly assignments: readonly IntentAssignment[] }
  | {
      readonly ok: false;
      readonly error: string;
      /** The route already serving the intent, when that is the reason. */
      readonly conflictingRoute: string | null;
      /** Requirement 3.14. The rejected record does not publish. */
      readonly recordStaysUnpublished: true;
    };

export interface IntentAssignmentRequest {
  readonly entry: SearchIntentEntry;
  readonly route: string;
  readonly supportingPhrases?: readonly string[];
}

/**
 * Assign a primary intent to a route.
 *
 * Requirements 3.4, 3.5 and 3.14. Pure: the caller receives a new assignment list
 * and nothing is mutated, so a rejected assignment cannot half-apply.
 *
 * A rejection names the conflicting route, because "this phrase is already
 * served" is only actionable if an editor is told where.
 */
export function assignPrimaryIntent(
  existing: readonly IntentAssignment[],
  request: IntentAssignmentRequest
): IntentAssignmentResult {
  const { entry, route } = request;
  const supportingPhrases = request.supportingPhrases ?? [];

  const reject = (error: string, conflictingRoute: string | null = null): IntentAssignmentResult => ({
    ok: false,
    error,
    conflictingRoute,
    recordStaysUnpublished: true,
  });

  if (isBlank(route)) {
    return reject('No destination route was given for the assignment.');
  }

  const evaluation = evaluateIntentEntry(entry);
  if (!evaluation.usable) {
    return reject(
      `Entry ${entry.entryId || '(unidentified)'} is held out of editorial assignment; missing or invalid fields: ${evaluation.missingFields.join(', ')}.`
    );
  }

  if (entry.role !== 'primary') {
    return reject(
      `Entry ${entry.entryId} is recorded with role "${entry.role}", so it cannot be a route's primary intent.`
    );
  }

  if (classifyPhraseUsage(entry.phrase) === 'research-query-only') {
    return reject(
      `Phrase "${entry.phrase}" is a superlative broker phrase, recorded as a research query only, so no page may be assigned to it.`
    );
  }

  if (supportingPhrases.length > MAX_SUPPORTING_PHRASES_PER_PAGE) {
    return reject(
      `Route ${route} was given ${supportingPhrases.length} supporting phrases; at most ${MAX_SUPPORTING_PHRASES_PER_PAGE} are permitted.`
    );
  }

  const blankSupporting = supportingPhrases.filter((phrase) => isBlank(phrase));
  if (blankSupporting.length > 0) {
    return reject(`Route ${route} was given ${blankSupporting.length} blank supporting phrase(s).`);
  }

  const superlativeSupporting = supportingPhrases.filter(
    (phrase) => classifyPhraseUsage(phrase) === 'research-query-only'
  );
  if (superlativeSupporting.length > 0) {
    return reject(
      `Route ${route} was given superlative broker phrase(s) as supporting phrases: ${superlativeSupporting.join(', ')}.`
    );
  }

  const question = normalise(entry.primaryIntentQuestion);

  const servedElsewhere = existing.find(
    (assignment) =>
      normalise(assignment.primaryIntentQuestion) === question && assignment.route !== route
  );
  if (servedElsewhere) {
    return reject(
      `The intent "${entry.primaryIntentQuestion}" is already served by ${servedElsewhere.route}, which stays the only destination for it.`,
      servedElsewhere.route
    );
  }

  const routeAlreadyAssigned = existing.find((assignment) => assignment.route === route);
  if (routeAlreadyAssigned) {
    if (routeAlreadyAssigned.intentEntryId === entry.entryId) {
      return reject(
        `Entry ${entry.entryId} is already assigned to ${route}; a second identical assignment adds nothing.`,
        route
      );
    }
    return reject(
      `Route ${route} already carries primary intent entry ${routeAlreadyAssigned.intentEntryId}; at most ${MAX_PRIMARY_INTENTS_PER_ROUTE} primary intent is permitted per route.`,
      route
    );
  }

  const assignment: IntentAssignment = {
    route,
    intentEntryId: entry.entryId,
    primaryIntentQuestion: entry.primaryIntentQuestion,
    supportingPhrases: [...supportingPhrases],
  };

  return { ok: true, assignments: [...existing, assignment] };
}

/**
 * Compare two recorded observation dates, for ordering a research log.
 *
 * Re-exported from the shared date helpers so a caller working with this register
 * does not reach for `new Date` and compare instants by accident.
 */
export { compareCalendarDates as compareObservationDates };

// ---------------------------------------------------------------------------
// The live register
// ---------------------------------------------------------------------------

/**
 * The live register.
 *
 * Empty, and honestly so. Requirement 3.15 holds every volume figure
 * unavailable and every phrase to a named manual method while the keyword
 * research tool licence requested under Owner_Input_Register section C is
 * unsupplied, so there is nothing yet to record.
 */
export const SEARCH_INTENT_ENTRIES: readonly SearchIntentEntry[] = [];

/** Recorded competitor samples. Empty for the same reason. */
export const COMPETITOR_OBSERVATIONS: readonly CompetitorObservation[] = [];

/** The assignments Requirement 3.4 keys on. Empty while no record is approved. */
export const INTENT_ASSIGNMENTS: readonly IntentAssignment[] = [];
