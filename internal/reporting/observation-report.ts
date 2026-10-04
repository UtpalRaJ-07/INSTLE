/**
 * The observation reporting renderer — built, and switched off.
 *
 * Requirement 7.12: when the progress report presents observation results it states
 * the sampling round identifier, the round date, the tool, the count of questions
 * where the business was mentioned, the count of questions sampled, and that the
 * figures are manual samples taken by one named observer in one location context.
 *
 * Requirement 7.9: while the domain is unconfirmed no observation is recorded, and
 * the progress report states that observation recording has not begun because no
 * public URL exists to observe.
 *
 * Requirement 7.5: an observation is never presented as a ranking position, a
 * position number, a score, a trend, an endorsement or a recommendation.
 *
 * ## Where this file lives, and why
 *
 * The design puts the register behind a directory boundary: "read by the progress
 * report generator only". No file under `src/` may name the `@internal` alias or
 * reach `internal/` by a relative path, and `tests/internal-register-boundary.test.ts`
 * asserts both. So the renderer cannot be a React component in `src/` — it would have
 * to import the register. It is a module beside the register, and
 * `scripts/render-observation-report.mjs` is the bridge that loads it through
 * `scripts/lib/ts-module-loader.mjs` and writes the section to stdout.
 *
 * `internal/reporting/` rather than `internal/registers/`: a renderer is not a
 * register, and the boundary test fixes the register count at seven.
 *
 * ## How it is switched off
 *
 * `OBSERVATION_ENTRIES` and `SAMPLING_ROUNDS` are both empty, and
 * `canRecordObservations` returns disabled with its reason, because the purchased
 * domain is unconfirmed under checklist entry **A1 / OWN-01**. The renderer therefore
 * produces the empty state: zero rounds, no figure of any kind, the reason recording
 * has not begun, and the register entry that starts it. It reports rounds the moment
 * rounds exist, and needs no edit to do so.
 *
 * ## Why the register's own label is not reused verbatim
 *
 * `MANUAL_SAMPLE_STATEMENT` in the register says an entry "is not a ranking, a score,
 * a trend or an endorsement". That is the right wording inside the register, where a
 * reader is an editor reading one entry. It is the wrong wording in a report, because
 * the report is scanned for exactly those words — a document that has to say "not a
 * ranking" to be understood is a document one deletion away from claiming one. The
 * report states the positive fact instead: these are manual samples, taken by one
 * named person, in one location context, on the dates shown. `renderObservationReport`
 * scans its own output and throws rather than return a line carrying any of the
 * forbidden words.
 */

import {
  BENCHMARK_QUESTIONS,
  OBSERVATION_CONDITIONS,
  OBSERVATION_ENTRIES,
  OBSERVATION_TOOLS,
  SAMPLING_ROUNDS,
  canRecordObservations,
  getReportableQuestions,
  type BenchmarkQuestion,
  type ObservationConditions,
  type ObservationEntry,
  type ObservationTool,
  type SamplingRound,
} from '../registers/observation';
import type { LocationContext } from '../registers/search-intent';

// ---------------------------------------------------------------------------
// The checklist entry that unblocks this
// ---------------------------------------------------------------------------

/**
 * The register entry recording has been waiting on: the purchased domain, as a bare
 * `https://` origin, with registrar and DNS control.
 */
export const OBSERVATION_REPORT_CHECKLIST_ENTRY = 'A1 / OWN-01';

/** Requirement 7.12. The statement every reported figure carries. */
export const MANUAL_SAMPLE_REPORT_STATEMENT =
  'These figures are manual samples taken by one named observer in one location context on the dates shown.';

/**
 * Requirement 7.5. Words this renderer must never emit.
 *
 * Matched on whole words, case-insensitively, so `disposition` and `underscore` are
 * left alone while `Position` and `scores` are caught. The list is the requirement's
 * own vocabulary plus the obvious inflections.
 */
export const FORBIDDEN_RANKING_WORDS: readonly string[] = [
  'rank',
  'ranks',
  'ranked',
  'ranking',
  'rankings',
  'position',
  'positions',
  'positioned',
  'score',
  'scores',
  'scored',
  'scoring',
  'trend',
  'trends',
  'trending',
  'rating',
  'ratings',
  'endorse',
  'endorses',
  'endorsed',
  'endorsement',
  'endorsements',
  'recommend',
  'recommends',
  'recommended',
  'recommendation',
  'recommendations',
] as const;

const FORBIDDEN_WORD_PATTERN = new RegExp(`\\b(${FORBIDDEN_RANKING_WORDS.join('|')})\\b`, 'gi');

/** Every forbidden word in `text`, in the order found. Empty means the text is clean. */
export function findRankingLanguage(text: string): readonly string[] {
  return [...text.matchAll(FORBIDDEN_WORD_PATTERN)].map((match) => match[0]);
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/** Requirement 7.12. One tool's counts within one round. */
export interface ToolSampleCounts {
  readonly tool: ObservationTool;
  /** Questions sampled against this tool in this round. */
  readonly questionsSampled: number;
  /** Of those, the ones where the business was mentioned. */
  readonly questionsMentioned: number;
  /** Recorded not applicable, with a reason. Not an absence of mention. */
  readonly questionsNotApplicable: number;
  /** Sampled, applicable, and the answer could not be determined. */
  readonly questionsUndetermined: number;
}

/** Requirement 7.12. One sampling round as the report presents it. */
export interface RoundReport {
  readonly roundId: string;
  /** The date the round was taken. */
  readonly roundDate: string;
  /** The date it finished, when that is a different day. */
  readonly completedOn: string | null;
  readonly observer: string;
  readonly locationContext: string;
  readonly tools: readonly ToolSampleCounts[];
  readonly questionsReportable: number;
}

export interface ExcludedQuestionReport {
  readonly questionId: string;
  readonly reason: string;
}

export interface ObservationReport {
  /** Requirement 7.9. Whether recording has begun. */
  readonly recordingEnabled: boolean;
  /** Why it has not, when it has not. */
  readonly recordingBlockedReason: string | null;
  /** The register entry that starts recording, while it has not begun. */
  readonly blockingChecklistEntry: string | null;
  readonly roundCount: number;
  readonly rounds: readonly RoundReport[];
  /** Requirement 7.7. Questions excluded from every round and every count. */
  readonly excludedQuestions: readonly ExcludedQuestionReport[];
  /** Requirement 7.12. Carried on the report, not left to the reader to infer. */
  readonly manualSampleStatement: string;
  /**
   * Contradictions between the recorded state and the recording switch — an entry
   * held while recording is off, or an entry belonging to no recorded round. Reported
   * rather than rendered as a figure.
   */
  readonly inconsistencies: readonly string[];
}

export interface ObservationReportInput {
  readonly rounds?: readonly SamplingRound[];
  readonly entries?: readonly ObservationEntry[];
  readonly questions?: readonly BenchmarkQuestion[];
  readonly conditions?: ObservationConditions;
}

function describeLocation(context: LocationContext): string {
  return context.scope === 'locality' ? `${context.locality}, ${context.city}` : context.city;
}

function countsFor(
  tool: ObservationTool,
  entries: readonly ObservationEntry[]
): ToolSampleCounts {
  const forTool = entries.filter((entry) => entry.tool === tool);

  let questionsMentioned = 0;
  let questionsNotApplicable = 0;
  let questionsUndetermined = 0;

  for (const entry of forTool) {
    if (!entry.mentioned.applicable) {
      questionsNotApplicable += 1;
      continue;
    }
    if (!entry.mentioned.result.available) {
      questionsUndetermined += 1;
      continue;
    }
    if (entry.mentioned.result.value) questionsMentioned += 1;
  }

  return {
    tool,
    questionsSampled: forTool.length,
    questionsMentioned,
    questionsNotApplicable,
    questionsUndetermined,
  };
}

/**
 * Requirements 7.9 and 7.12. The observation section as data.
 *
 * Defaults read the live register, which holds zero rounds and zero entries, so the
 * default report is the empty state. Every input is injectable so a fixture round can
 * be rendered without recording one.
 */
export function buildObservationReport(input: ObservationReportInput = {}): ObservationReport {
  const rounds = input.rounds ?? SAMPLING_ROUNDS;
  const entries = input.entries ?? OBSERVATION_ENTRIES;
  const questions = input.questions ?? BENCHMARK_QUESTIONS;
  const conditions = input.conditions ?? OBSERVATION_CONDITIONS;

  const recording = canRecordObservations(conditions);
  const reportable = getReportableQuestions(questions);

  const inconsistencies: string[] = [];
  if (!recording.enabled && (entries.length > 0 || rounds.length > 0)) {
    inconsistencies.push(
      `${rounds.length} round(s) and ${entries.length} entr(ies) are recorded while recording is switched off under Owner_Input_Register ${OBSERVATION_REPORT_CHECKLIST_ENTRY}. No figure is reported from them.`
    );
  }

  const roundIds = new Set(rounds.map((round) => round.roundId));
  for (const entry of entries) {
    if (!roundIds.has(entry.roundId)) {
      inconsistencies.push(
        `Entry ${entry.questionId} on ${entry.tool} names round ${entry.roundId}, which is not a recorded round.`
      );
    }
  }

  const reportedRounds: readonly RoundReport[] =
    inconsistencies.length > 0
      ? []
      : rounds.map((round) => {
          const roundEntries = entries.filter((entry) => entry.roundId === round.roundId);
          return {
            roundId: round.roundId,
            roundDate: round.startedOn,
            completedOn:
              round.completedOn && round.completedOn !== round.startedOn ? round.completedOn : null,
            observer: round.observer,
            locationContext: describeLocation(round.locationContext),
            tools: OBSERVATION_TOOLS.map((tool) => countsFor(tool, roundEntries)),
            questionsReportable: reportable.length,
          };
        });

  return {
    recordingEnabled: recording.enabled,
    recordingBlockedReason: recording.reason,
    blockingChecklistEntry: recording.enabled ? null : OBSERVATION_REPORT_CHECKLIST_ENTRY,
    roundCount: reportedRounds.length,
    rounds: reportedRounds,
    excludedQuestions: questions
      .filter((question) => !question.reportable)
      .map((question) => ({
        questionId: question.questionId,
        reason: question.exclusionReason ?? 'no reason recorded',
      })),
    manualSampleStatement: MANUAL_SAMPLE_REPORT_STATEMENT,
    inconsistencies,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const TOOL_LABELS: Readonly<Record<ObservationTool, string>> = {
  'google-organic': 'Google organic results',
  'google-maps': 'Google Maps',
  'chatgpt-search': 'ChatGPT search',
  perplexity: 'Perplexity',
  'bing-copilot': 'Bing or Copilot',
};

/**
 * Requirements 7.5, 7.9 and 7.12. The observation section as markdown.
 *
 * A round is presented as dated samples and nothing else: the round identifier, the
 * date it was taken, the observer, the location context, and per tool the count
 * mentioned out of the count sampled. There is no derived figure — no share, no
 * change against a previous round, no ordering of the tools by how they did — because
 * every one of those would turn a set of samples into something a reader would read
 * as progress.
 *
 * The output is scanned against `FORBIDDEN_RANKING_WORDS` before it is returned, and
 * the function throws on a hit. A renderer that can only emit compliant text is
 * worth more than a test asserting that today's wording happens to be compliant.
 */
export function renderObservationReport(
  report: ObservationReport = buildObservationReport()
): string {
  const lines: string[] = ['## Search and AI mention observations', ''];

  if (!report.recordingEnabled) {
    lines.push(
      report.recordingBlockedReason ?? 'Observation recording has not begun.',
      '',
      `Rounds recorded: 0. Entries recorded: 0. No figure is reported, and none is estimated. Recording begins when the register entry ${report.blockingChecklistEntry ?? OBSERVATION_REPORT_CHECKLIST_ENTRY} is answered; the first round follows within 7 calendar days of that answer.`,
      ''
    );
  } else if (report.roundCount === 0) {
    lines.push(
      'Recording is possible: a public URL exists to observe. No sampling round has been taken yet, so there is no figure to report.',
      ''
    );
  }

  for (const inconsistency of report.inconsistencies) {
    lines.push(`- Recorded state not reported: ${inconsistency}`, '');
  }

  for (const round of report.rounds) {
    const when = round.completedOn
      ? `${round.roundDate} to ${round.completedOn}`
      : round.roundDate;
    lines.push(
      `### Round ${round.roundId}, sampled ${when}`,
      '',
      `Observer: ${round.observer}. Location context: ${round.locationContext}. Questions in the round: ${round.questionsReportable}.`,
      '',
      '| Tool | Mentioned | Sampled | Not applicable | Undetermined |',
      '|---|---|---|---|---|'
    );
    for (const tool of round.tools) {
      lines.push(
        `| ${TOOL_LABELS[tool.tool]} | ${tool.questionsMentioned} | ${tool.questionsSampled} | ${tool.questionsNotApplicable} | ${tool.questionsUndetermined} |`
      );
    }
    lines.push('', report.manualSampleStatement, '');
  }

  if (report.excludedQuestions.length > 0) {
    lines.push(
      `Questions excluded from every round and every count above (${report.excludedQuestions.length}):`,
      ''
    );
    for (const excluded of report.excludedQuestions) {
      lines.push(`- ${excluded.questionId}: ${excluded.reason}`);
    }
    lines.push('');
  }

  const text = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;

  // Requirement 7.5, enforced on the way out rather than asserted after the fact.
  const found = findRankingLanguage(text);
  if (found.length > 0) {
    throw new Error(
      `The observation section would present a sample as ${[...new Set(found)].join(', ')}, which Requirement 7.5 forbids. The offending wording is in the register entry or the round data, not in this renderer.`
    );
  }

  return text;
}
