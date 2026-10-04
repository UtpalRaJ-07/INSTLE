/**
 * Observation register — internal working material.
 *
 * Requirement 7.8: the register is excluded from public routes, from
 * server-rendered public HTML and from the sitemap. See `search-intent.ts` for
 * why that is a directory decision rather than a review convention.
 *
 * Requirement 7.9: recording stays switched off until the domain is confirmed
 * under Owner_Input_Register A1, because there is no public URL to observe. The
 * register therefore compiles and validates with zero entries, which is the
 * true state rather than a placeholder one.
 *
 * Two shapes carry the honesty rules.
 *
 * `Determined<T>` is how Requirement 7.11 is enforced by the type system: a field
 * that could not be determined when the observation was taken is recorded as
 * unavailable with a reason, and there is no way to write a value without also
 * claiming it was determined. No estimate, no recalled value.
 *
 * `Applicability<T>` is Requirement 7.3: while no Google Maps presence is
 * confirmed, a Maps row is recorded not-applicable with the reason. "Not
 * applicable" and "not mentioned" are different facts, and collapsing the first
 * into the second would report an absence that nobody observed.
 */

import { isAttributableName } from '@/config/claims';
import {
  addWorkingDays,
  differenceInCalendarDays,
  formatCalendarDate,
  parseCalendarDate,
} from '@/lib/calendar-dates';

import type { LocationContext } from './search-intent';

// ---------------------------------------------------------------------------
// Recorded shapes
// ---------------------------------------------------------------------------

export type ObservationTool =
  | 'google-organic'
  | 'google-maps'
  | 'chatgpt-search'
  | 'perplexity'
  | 'bing-copilot';

/** Requirement 7.3. The five tools sampled, as five separate tools. */
export const OBSERVATION_TOOLS: readonly ObservationTool[] = [
  'google-organic',
  'google-maps',
  'chatgpt-search',
  'perplexity',
  'bing-copilot',
] as const;

/** Requirement 7.1. Exactly 10, each with a stable identifier. */
export interface BenchmarkQuestion {
  readonly questionId: string; // OBS-Q01 … OBS-Q10
  readonly questionText: string;
  /** False excludes the question from every round and every count. */
  readonly reportable: boolean;
  /** Required when reportable is false. Names the blocking owner input. */
  readonly exclusionReason: string | null;
}

/** Requirement 7.11. A field that could not be determined is recorded, not guessed. */
export type Determined<T> =
  | { readonly available: true; readonly value: T }
  | { readonly available: false; readonly reason: string };

/** Requirement 7.3. Google Maps with no confirmed presence is not-applicable. */
export type Applicability<T> =
  | { readonly applicable: true; readonly result: Determined<T> }
  | { readonly applicable: false; readonly reason: string };

export interface ObservationEntry {
  readonly questionId: string;
  readonly roundId: string; // OBS-R001 …
  readonly tool: ObservationTool;
  readonly observedOn: string;
  /** A real named person. Requirement 7.2 and 7.4. */
  readonly observer: string;
  readonly locationContext: LocationContext;
  readonly mentioned: Applicability<boolean>;
  /** The URL the tool cited, or the literal 'none'. */
  readonly citedUrl: Determined<string | 'none'>;
  /** Whether the tool reported exactly `INSTLE REAL ESTATE`. */
  readonly brandStringMatchesExactly: Determined<boolean>;
  /** Whether the tool reported exactly `9353096264`. */
  readonly phoneMatchesExactly: Determined<boolean>;
  /** Empty array means none observed. Requirement 7.2. */
  readonly factualErrors: readonly string[];
  /** Requirement 7.6. Required within 5 working days when factualErrors is non-empty. */
  readonly correction: ObservationCorrection | null;
}

export interface ObservationCorrection {
  readonly incorrectFact: string;
  /** The route that should carry the correct fact. */
  readonly pageThatShouldCarryTheFact: string;
  readonly correctionMade: string;
  readonly correctedOn: string;
}

export interface SamplingRound {
  readonly roundId: string;
  readonly startedOn: string;
  /** At most 2 calendar days after startedOn. Requirement 7.10. */
  readonly completedOn: string | null;
  readonly observer: string;
  readonly locationContext: LocationContext;
}

// ---------------------------------------------------------------------------
// Recorded bounds, labels and owner state
// ---------------------------------------------------------------------------

/** Requirement 7.10. A round's entries fall within this many days of its start. */
export const ROUND_WINDOW_MAX_DAYS = 2;

/** Requirement 7.10. One further round at least this often. */
export const ROUND_INTERVAL_MAX_DAYS = 30;

/** Requirement 7.6. Working days available to record a correction. */
export const CORRECTION_WORKING_DAYS = 5;

/** Requirement 7.9. Calendar days from domain confirmation to the first round. */
export const FIRST_ROUND_DEADLINE_DAYS = 7;

/** Requirement 7.4. Every entry carries this statement, in the register and in any report. */
export const MANUAL_SAMPLE_STATEMENT =
  'This entry is a manual sample taken by one named observer in one location context on one date. It is not a ranking, a score, a trend or an endorsement.';

/** Requirement 7.3. The reason a Maps row is not-applicable today. */
export const GOOGLE_MAPS_NOT_APPLICABLE_REASON =
  'No Google Maps presence is confirmed for the business (Owner_Input_Register C8), so there is no Maps listing to sample. This is not an absence of mention.';

/**
 * The placeholders the seed carries instead of an invented area name.
 *
 * Requirement 7.1 names two questions by their condition — a location confirmed
 * as served, and a locality that has passed the gate. Neither exists yet, so the
 * seed records the condition. `resolveBenchmarkQuestions` substitutes the real
 * name when the condition is satisfied; nothing invents one before then.
 */
export const CONFIRMED_AREA_PLACEHOLDER = '<confirmed area>';
export const PUBLISHED_LOCALITY_PLACEHOLDER = '<published locality>';

/**
 * The owner and gate state the reportable flags are derived from.
 *
 * Every field is the true current state. Nothing here is a switch somebody can
 * flip to make a question reportable: each value comes from a checklist entry or
 * from the publication gate.
 */
export interface ObservationConditions {
  /** Areas confirmed as served under Owner_Input_Register C1. */
  readonly confirmedServedAreas: readonly string[];
  /** Canonical names of locality records that pass the publication gate. */
  readonly publishedLocalityNames: readonly string[];
  /** Commercial capability confirmed under Owner_Input_Register C4. */
  readonly commercialCapabilityConfirmed: boolean;
  /** A Google Maps presence confirmed under Owner_Input_Register C8. */
  readonly googleMapsPresenceConfirmed: boolean;
  /** The purchased domain confirmed under Owner_Input_Register A1. */
  readonly domainConfirmed: boolean;
}

/** The live state. Every value is the honest current one. */
export const OBSERVATION_CONDITIONS: ObservationConditions = {
  confirmedServedAreas: [],
  publishedLocalityNames: [],
  commercialCapabilityConfirmed: false,
  googleMapsPresenceConfirmed: false,
  domainConfirmed: false,
} as const;

// ---------------------------------------------------------------------------
// The ten benchmark questions
// ---------------------------------------------------------------------------

/**
 * Requirement 7.1. Exactly ten, seeded with the reportable flag each condition
 * currently produces.
 *
 * OBS-Q05, OBS-Q08 and OBS-Q09 start excluded, each naming what blocks it.
 * OBS-Q05 and OBS-Q08 become reportable from the condition rather than from an
 * edit to this table.
 */
export const BENCHMARK_QUESTION_SEED: readonly BenchmarkQuestion[] = [
  {
    questionId: 'OBS-Q01',
    questionText: 'Who is a broker for selling an apartment in Bengaluru?',
    reportable: true,
    exclusionReason: null,
  },
  {
    questionId: 'OBS-Q02',
    questionText: 'How do I choose a broker to sell my flat?',
    reportable: true,
    exclusionReason: null,
  },
  {
    questionId: 'OBS-Q03',
    questionText: 'Who can help me buy an apartment in Bengaluru?',
    reportable: true,
    exclusionReason: null,
  },
  {
    questionId: 'OBS-Q04',
    questionText: 'Who is a broker for renting out a house in Bengaluru?',
    reportable: true,
    exclusionReason: null,
  },
  {
    questionId: 'OBS-Q05',
    questionText: `Which brokerage works near ${CONFIRMED_AREA_PLACEHOLDER}?`,
    reportable: false,
    exclusionReason:
      'Excluded while Owner_Input_Register C1 records no area confirmed as served, because the question names a confirmed area and there is none to name.',
  },
  {
    questionId: 'OBS-Q06',
    questionText: 'What is the contact number for INSTLE REAL ESTATE?',
    reportable: true,
    exclusionReason: null,
  },
  {
    questionId: 'OBS-Q07',
    questionText: 'Who is Utpal Raj KB?',
    reportable: true,
    exclusionReason: null,
  },
  {
    questionId: 'OBS-Q08',
    questionText: `Who helps with resale in ${PUBLISHED_LOCALITY_PLACEHOLDER}?`,
    reportable: false,
    exclusionReason:
      'Excluded while no locality record passes the publication gate, because the question names a published locality and there is none to name.',
  },
  {
    questionId: 'OBS-Q09',
    questionText: 'Who is a commercial property broker in Bengaluru?',
    reportable: false,
    exclusionReason:
      'Excluded while Owner_Input_Register C4 records no confirmed commercial capability, under Requirement 7.7.',
  },
  {
    questionId: 'OBS-Q10',
    questionText: 'Can a broker guarantee a sale in 30 days?',
    reportable: true,
    exclusionReason: null,
  },
] as const;

/**
 * Apply the conditions to the seed.
 *
 * The substitution is deliberately single-valued: the first recorded area and the
 * first published locality name, in the order they were supplied. A question is
 * one question, so it names one place; picking one recorded name is a choice,
 * inventing a name is not.
 */
export function resolveBenchmarkQuestions(
  conditions: ObservationConditions = OBSERVATION_CONDITIONS
): readonly BenchmarkQuestion[] {
  return BENCHMARK_QUESTION_SEED.map((question): BenchmarkQuestion => {
    switch (question.questionId) {
      case 'OBS-Q05': {
        const area = conditions.confirmedServedAreas[0];
        if (!area) return question;
        return {
          ...question,
          questionText: question.questionText.replace(CONFIRMED_AREA_PLACEHOLDER, area),
          reportable: true,
          exclusionReason: null,
        };
      }
      case 'OBS-Q08': {
        const locality = conditions.publishedLocalityNames[0];
        if (!locality) return question;
        return {
          ...question,
          questionText: question.questionText.replace(PUBLISHED_LOCALITY_PLACEHOLDER, locality),
          reportable: true,
          exclusionReason: null,
        };
      }
      case 'OBS-Q09':
        if (!conditions.commercialCapabilityConfirmed) return question;
        return { ...question, reportable: true, exclusionReason: null };
      default:
        return question;
    }
  });
}

/** The questions as they stand under the live conditions. */
export const BENCHMARK_QUESTIONS: readonly BenchmarkQuestion[] =
  resolveBenchmarkQuestions(OBSERVATION_CONDITIONS);

/** Requirement 7.7. Excluded questions leave every round and every count. */
export function getReportableQuestions(
  questions: readonly BenchmarkQuestion[] = BENCHMARK_QUESTIONS
): readonly BenchmarkQuestion[] {
  return questions.filter((question) => question.reportable);
}

/**
 * Structural checks on the question set itself, so a later edit cannot leave an
 * excluded question without a reason or a reportable question still carrying a
 * placeholder.
 */
export function validateBenchmarkQuestions(
  questions: readonly BenchmarkQuestion[] = BENCHMARK_QUESTIONS
): { readonly ok: boolean; readonly failures: readonly string[] } {
  const failures: string[] = [];

  if (questions.length !== 10) {
    failures.push(`The register holds ${questions.length} benchmark questions; Requirement 7.1 fixes the count at 10.`);
  }

  const seen = new Set<string>();
  for (const question of questions) {
    if (isBlank(question.questionId)) failures.push('A benchmark question carries no identifier.');
    if (seen.has(question.questionId)) {
      failures.push(`Question identifier ${question.questionId} is used more than once.`);
    }
    seen.add(question.questionId);

    if (isBlank(question.questionText)) {
      failures.push(`${question.questionId}: no question text recorded.`);
    }

    if (question.reportable) {
      if (question.exclusionReason !== null) {
        failures.push(`${question.questionId}: reportable, but still carries an exclusion reason.`);
      }
      for (const placeholder of [CONFIRMED_AREA_PLACEHOLDER, PUBLISHED_LOCALITY_PLACEHOLDER]) {
        if (question.questionText.includes(placeholder)) {
          failures.push(
            `${question.questionId}: reportable while the question text still carries the ${placeholder} placeholder.`
          );
        }
      }
    } else if (isBlank(question.exclusionReason)) {
      failures.push(`${question.questionId}: excluded with no reason recorded.`);
    }
  }

  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Recording state
// ---------------------------------------------------------------------------

/**
 * Requirement 7.9. Recording is switched off while no public URL exists.
 *
 * Returned as a reason rather than a bare false, because the progress report has
 * to state why observation recording has not begun.
 */
export function canRecordObservations(
  conditions: ObservationConditions = OBSERVATION_CONDITIONS
): { readonly enabled: boolean; readonly reason: string | null } {
  if (!conditions.domainConfirmed) {
    return {
      enabled: false,
      reason:
        'Observation recording has not begun because no public URL exists to observe: the purchased domain is unconfirmed under Owner_Input_Register A1.',
    };
  }
  return { enabled: true, reason: null };
}

/** Requirement 7.9. The first round is due within 7 calendar days of confirmation. */
export function firstRoundDueBy(domainConfirmedOn: string): string | null {
  const confirmed = parseCalendarDate(domainConfirmedOn);
  if (!confirmed) return null;
  return formatCalendarDate(
    new Date(confirmed.getTime() + FIRST_ROUND_DEADLINE_DAYS * 86_400_000)
  );
}

// ---------------------------------------------------------------------------
// Entry evaluation
// ---------------------------------------------------------------------------

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

/** Every field of a `Determined<T>` that has to be present, named by its path. */
function determinedFailures(field: string, value: Determined<unknown> | undefined): string[] {
  if (!value || typeof value !== 'object') return [field];
  if (value.available) {
    return value.value === undefined || value.value === null ? [`${field}.value`] : [];
  }
  return isBlank(value.reason) ? [`${field}.reason`] : [];
}

export interface ObservationEntryEvaluation {
  readonly usable: boolean;
  /** Requirement 7.2 and 7.11. Every absent field, named individually. */
  readonly missingFields: readonly string[];
}

/**
 * Requirement 7.2 and 7.11. An entry is usable when every field it must record is
 * present — including the reason on any field recorded unavailable, because an
 * unavailable value without a reason is a guess with the working hidden.
 */
export function evaluateObservationEntry(entry: ObservationEntry): ObservationEntryEvaluation {
  const missingFields: string[] = [];

  if (isBlank(entry.questionId)) missingFields.push('questionId');
  if (isBlank(entry.roundId)) missingFields.push('roundId');
  if (!OBSERVATION_TOOLS.includes(entry.tool)) missingFields.push('tool');
  if (!parseCalendarDate(entry.observedOn)) missingFields.push('observedOn');
  if (!isAttributableName(entry.observer)) missingFields.push('observer');
  if (entry.locationContext.scope === 'locality' && isBlank(entry.locationContext.locality)) {
    missingFields.push('locationContext.locality');
  }

  if (!entry.mentioned || typeof entry.mentioned !== 'object') {
    missingFields.push('mentioned');
  } else if (entry.mentioned.applicable) {
    missingFields.push(...determinedFailures('mentioned.result', entry.mentioned.result));
  } else if (isBlank(entry.mentioned.reason)) {
    missingFields.push('mentioned.reason');
  }

  missingFields.push(...determinedFailures('citedUrl', entry.citedUrl));
  missingFields.push(
    ...determinedFailures('brandStringMatchesExactly', entry.brandStringMatchesExactly)
  );
  missingFields.push(...determinedFailures('phoneMatchesExactly', entry.phoneMatchesExactly));

  if (!Array.isArray(entry.factualErrors)) missingFields.push('factualErrors');

  // Requirement 7.6. A recorded error without a recorded correction is an
  // outstanding obligation, so the entry is not complete.
  if (Array.isArray(entry.factualErrors) && entry.factualErrors.length > 0) {
    if (!entry.correction) {
      missingFields.push('correction');
    } else {
      if (isBlank(entry.correction.incorrectFact)) missingFields.push('correction.incorrectFact');
      if (isBlank(entry.correction.pageThatShouldCarryTheFact)) {
        missingFields.push('correction.pageThatShouldCarryTheFact');
      }
      if (isBlank(entry.correction.correctionMade)) missingFields.push('correction.correctionMade');
      if (!parseCalendarDate(entry.correction.correctedOn)) {
        missingFields.push('correction.correctedOn');
      }
    }
  }

  return { usable: missingFields.length === 0, missingFields };
}

/** Requirement 7.4. The label every entry carries when it is read anywhere. */
export function describeObservationEntry(entry: ObservationEntry): string {
  const where =
    entry.locationContext.scope === 'locality'
      ? `${entry.locationContext.locality}, ${entry.locationContext.city}`
      : entry.locationContext.city;
  return `${entry.questionId} sampled on ${entry.tool} on ${entry.observedOn} by ${entry.observer} in ${where}. ${MANUAL_SAMPLE_STATEMENT}`;
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

/**
 * Requirement 7.6. The date five working days after the observation.
 *
 * Working days are Monday to Friday; public holidays are not modelled, and that
 * limitation is recorded in `src/lib/calendar-dates.ts` rather than guessed at.
 */
export function correctionDueBy(observedOn: string): string | null {
  const observed = parseCalendarDate(observedOn);
  if (!observed) return null;
  return formatCalendarDate(addWorkingDays(observed, CORRECTION_WORKING_DAYS));
}

/** Requirement 7.6. Whether the correction obligation on this entry is met. */
export function validateCorrection(entry: ObservationEntry): {
  readonly ok: boolean;
  readonly failures: readonly string[];
} {
  const failures: string[] = [];

  if (entry.factualErrors.length === 0) {
    if (entry.correction) {
      failures.push(
        `${entry.questionId}/${entry.roundId}: a correction is recorded although no factual error was observed.`
      );
    }
    return { ok: failures.length === 0, failures };
  }

  const dueBy = correctionDueBy(entry.observedOn);
  if (!dueBy) {
    failures.push(
      `${entry.questionId}/${entry.roundId}: the observation date is not a calendar date, so the correction deadline cannot be computed.`
    );
    return { ok: false, failures };
  }

  if (!entry.correction) {
    failures.push(
      `${entry.questionId}/${entry.roundId}: ${entry.factualErrors.length} factual error(s) observed and no correction recorded; the correction was due by ${dueBy}.`
    );
    return { ok: false, failures };
  }

  const evaluation = evaluateObservationEntry(entry);
  const correctionFields = evaluation.missingFields.filter((field) =>
    field.startsWith('correction')
  );
  if (correctionFields.length > 0) {
    failures.push(
      `${entry.questionId}/${entry.roundId}: the correction omits ${correctionFields.join(', ')}.`
    );
  }

  const correctedOn = parseCalendarDate(entry.correction.correctedOn);
  const observedOn = parseCalendarDate(entry.observedOn);
  const due = parseCalendarDate(dueBy);
  if (correctedOn && observedOn && due) {
    if (correctedOn.getTime() < observedOn.getTime()) {
      failures.push(
        `${entry.questionId}/${entry.roundId}: the correction is dated ${entry.correction.correctedOn}, before the observation on ${entry.observedOn}.`
      );
    }
    if (correctedOn.getTime() > due.getTime()) {
      failures.push(
        `${entry.questionId}/${entry.roundId}: the correction is dated ${entry.correction.correctedOn}, after the ${CORRECTION_WORKING_DAYS}-working-day deadline of ${dueBy}.`
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Round validation
// ---------------------------------------------------------------------------

export interface RoundValidation {
  readonly ok: boolean;
  readonly failures: readonly string[];
  /** Reportable questions × tools. The count a complete round must carry. */
  readonly expectedEntryCount: number;
}

/**
 * Requirement 7.3 and 7.10. One entry per reportable question per tool, inside a
 * window of at most two calendar days.
 *
 * Every failure is a separate string naming the question and the tool, because
 * "the round is incomplete" tells an observer nothing about what to go and sample.
 */
export function validateRound(
  round: SamplingRound,
  entries: readonly ObservationEntry[],
  options: {
    readonly questions?: readonly BenchmarkQuestion[];
    readonly conditions?: ObservationConditions;
  } = {}
): RoundValidation {
  const questions = options.questions ?? BENCHMARK_QUESTIONS;
  const conditions = options.conditions ?? OBSERVATION_CONDITIONS;
  const reportable = getReportableQuestions(questions);
  const expectedEntryCount = reportable.length * OBSERVATION_TOOLS.length;
  const failures: string[] = [];

  if (isBlank(round.roundId)) failures.push('The round carries no identifier.');
  if (!isAttributableName(round.observer)) {
    failures.push(`Round ${round.roundId}: "${round.observer}" does not name an accountable observer.`);
  }
  if (round.locationContext.scope === 'locality' && isBlank(round.locationContext.locality)) {
    failures.push(`Round ${round.roundId}: the location context names no locality.`);
  }

  const startedOn = parseCalendarDate(round.startedOn);
  if (!startedOn) {
    failures.push(`Round ${round.roundId}: "${round.startedOn}" is not a calendar date.`);
  }

  let windowEnd: Date | null = null;
  if (startedOn) {
    if (round.completedOn === null) {
      failures.push(`Round ${round.roundId}: no completion date recorded, so the round is unfinished.`);
      windowEnd = new Date(startedOn.getTime() + ROUND_WINDOW_MAX_DAYS * 86_400_000);
    } else {
      const completedOn = parseCalendarDate(round.completedOn);
      if (!completedOn) {
        failures.push(`Round ${round.roundId}: "${round.completedOn}" is not a calendar date.`);
        windowEnd = new Date(startedOn.getTime() + ROUND_WINDOW_MAX_DAYS * 86_400_000);
      } else {
        const span = differenceInCalendarDays(completedOn, startedOn);
        if (span < 0) {
          failures.push(
            `Round ${round.roundId}: completed on ${round.completedOn}, before it started on ${round.startedOn}.`
          );
        } else if (span > ROUND_WINDOW_MAX_DAYS) {
          failures.push(
            `Round ${round.roundId}: spans ${span} calendar days, beyond the ${ROUND_WINDOW_MAX_DAYS}-day window.`
          );
        }
        windowEnd = completedOn;
      }
    }
  }

  const questionById = new Map(questions.map((question) => [question.questionId, question]));

  for (const entry of entries) {
    const label = `Round ${round.roundId} / ${entry.questionId} / ${entry.tool}`;

    if (entry.roundId !== round.roundId) {
      failures.push(`${label}: entry records round ${entry.roundId}.`);
    }

    const question = questionById.get(entry.questionId);
    if (!question) {
      failures.push(`${label}: no benchmark question carries that identifier.`);
    } else if (!question.reportable) {
      failures.push(
        `${label}: the question is excluded from every round (${question.exclusionReason ?? 'no reason recorded'}).`
      );
    }

    const evaluation = evaluateObservationEntry(entry);
    if (!evaluation.usable) {
      failures.push(`${label}: omits ${evaluation.missingFields.join(', ')}.`);
    }

    const observedOn = parseCalendarDate(entry.observedOn);
    if (observedOn && startedOn && windowEnd) {
      if (observedOn.getTime() < startedOn.getTime() || observedOn.getTime() > windowEnd.getTime()) {
        failures.push(
          `${label}: observed on ${entry.observedOn}, outside the round window ${round.startedOn} to ${formatCalendarDate(windowEnd)}.`
        );
      }
    }

    failures.push(...validateCorrection(entry).failures);
    failures.push(...mapsApplicabilityFailures(entry, conditions).map((reason) => `${label}: ${reason}`));
  }

  // Cardinality: exactly one entry per reportable question per tool.
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = `${entry.questionId}|${entry.tool}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const question of reportable) {
    for (const tool of OBSERVATION_TOOLS) {
      const count = counts.get(`${question.questionId}|${tool}`) ?? 0;
      if (count === 0) {
        failures.push(`Round ${round.roundId}: no entry for ${question.questionId} against ${tool}.`);
      } else if (count > 1) {
        failures.push(
          `Round ${round.roundId}: ${count} entries for ${question.questionId} against ${tool}; exactly one is required.`
        );
      }
    }
  }

  return { ok: failures.length === 0, failures, expectedEntryCount };
}

/**
 * Requirement 7.3. Google Maps is recorded not-applicable with the reason while no
 * Maps presence is confirmed, and every other tool is applicable.
 *
 * A not-applicable entry may carry no determined value at all: if the tool does
 * not apply, nobody looked, so a cited URL or a brand match would be invented.
 */
function mapsApplicabilityFailures(
  entry: ObservationEntry,
  conditions: ObservationConditions
): string[] {
  const failures: string[] = [];

  if (entry.tool === 'google-maps' && !conditions.googleMapsPresenceConfirmed) {
    if (entry.mentioned.applicable) {
      failures.push(
        'Google Maps is recorded as applicable while no Maps presence is confirmed; Requirement 7.3 records the row not applicable with the reason rather than as an absence of mention.'
      );
    }
  } else if (!entry.mentioned.applicable) {
    failures.push(
      `the ${entry.tool} row is recorded not applicable; only a Google Maps row with no confirmed presence may be.`
    );
  }

  if (!entry.mentioned.applicable) {
    const determined: readonly (readonly [string, Determined<unknown>])[] = [
      ['citedUrl', entry.citedUrl],
      ['brandStringMatchesExactly', entry.brandStringMatchesExactly],
      ['phoneMatchesExactly', entry.phoneMatchesExactly],
    ];
    for (const [field, value] of determined) {
      if (value && value.available) {
        failures.push(`${field} records a value although the tool does not apply.`);
      }
    }
    if (entry.factualErrors.length > 0) {
      failures.push('factualErrors records an error although the tool does not apply.');
    }
  }

  return failures;
}

/**
 * Requirement 7.10. One further round at least every 30 calendar days.
 *
 * The interval is measured start to start, so a round that took two days does not
 * buy itself two extra days of silence.
 */
export function validateRoundCadence(rounds: readonly SamplingRound[]): {
  readonly ok: boolean;
  readonly failures: readonly string[];
} {
  const failures: string[] = [];

  const dated = rounds
    .map((round) => ({ round, startedOn: parseCalendarDate(round.startedOn) }))
    .filter((item): item is { round: SamplingRound; startedOn: Date } => item.startedOn !== null);

  for (const round of rounds) {
    if (!parseCalendarDate(round.startedOn)) {
      failures.push(`Round ${round.roundId}: "${round.startedOn}" is not a calendar date.`);
      continue;
    }
    if (round.completedOn === null) continue;
    const completedOn = parseCalendarDate(round.completedOn);
    const startedOn = parseCalendarDate(round.startedOn);
    if (!completedOn || !startedOn) {
      failures.push(`Round ${round.roundId}: "${round.completedOn}" is not a calendar date.`);
      continue;
    }
    const span = differenceInCalendarDays(completedOn, startedOn);
    if (span < 0 || span > ROUND_WINDOW_MAX_DAYS) {
      failures.push(
        `Round ${round.roundId}: spans ${span} calendar days, beyond the ${ROUND_WINDOW_MAX_DAYS}-day window.`
      );
    }
  }

  const ordered = [...dated].sort((a, b) => a.startedOn.getTime() - b.startedOn.getTime());
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const gap = differenceInCalendarDays(current.startedOn, previous.startedOn);
    if (gap > ROUND_INTERVAL_MAX_DAYS) {
      failures.push(
        `Round ${current.round.roundId} started ${gap} calendar days after round ${previous.round.roundId}, beyond the ${ROUND_INTERVAL_MAX_DAYS}-day interval.`
      );
    }
  }

  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// The live register
// ---------------------------------------------------------------------------

/**
 * The live register.
 *
 * Empty because observation recording has not begun: no public URL exists to
 * observe. Requirement 7.9 states that plainly rather than inferring a figure.
 */
export const OBSERVATION_ENTRIES: readonly ObservationEntry[] = [];

/** Recorded sampling rounds. Empty for the same reason. */
export const SAMPLING_ROUNDS: readonly SamplingRound[] = [];
