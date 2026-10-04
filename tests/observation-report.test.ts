import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  FORBIDDEN_RANKING_WORDS,
  MANUAL_SAMPLE_REPORT_STATEMENT,
  OBSERVATION_REPORT_CHECKLIST_ENTRY,
  buildObservationReport,
  findRankingLanguage,
  renderObservationReport,
} from '@internal/reporting/observation-report';
import {
  GOOGLE_MAPS_NOT_APPLICABLE_REASON,
  OBSERVATION_CONDITIONS,
  OBSERVATION_ENTRIES,
  OBSERVATION_TOOLS,
  SAMPLING_ROUNDS,
  getReportableQuestions,
  resolveBenchmarkQuestions,
  validateRound,
  type ObservationConditions,
  type ObservationEntry,
  type SamplingRound,
} from '@internal/registers/observation';

/**
 * The observation reporting renderer (task 17.5, Requirements 7.9 and 7.12).
 *
 * Three things are asserted: the live register renders an honest empty state, a
 * fixture round renders as dated samples, and no output the renderer can produce
 * presents a sample as a rank, a place in a list, a score or a movement over time —
 * Requirement 7.5.
 *
 * The fixture round is put through `validateRound` before it is rendered, so what is
 * rendered is a legitimate round rather than arbitrary data shaped to suit the
 * renderer.
 */

/** The label the renderer prints for each tool, in the register's declared order. */
const TOOL_LABELS: Readonly<Record<(typeof OBSERVATION_TOOLS)[number], string>> = {
  'google-organic': 'Google organic results',
  'google-maps': 'Google Maps',
  'chatgpt-search': 'ChatGPT search',
  perplexity: 'Perplexity',
  'bing-copilot': 'Bing or Copilot',
};

/** The bridge the design describes: a script, because `src/` may not reach `internal/`. */
const SCRIPT = resolve(__dirname, '..', 'scripts', 'render-observation-report.mjs');

const CONDITIONS_WITH_DOMAIN: ObservationConditions = {
  ...OBSERVATION_CONDITIONS,
  domainConfirmed: true,
};

const QUESTIONS = resolveBenchmarkQuestions(CONDITIONS_WITH_DOMAIN);
const REPORTABLE = getReportableQuestions(QUESTIONS);

const ROUND: SamplingRound = {
  roundId: 'OBS-R001',
  startedOn: '2026-10-01',
  completedOn: '2026-10-02',
  observer: 'A. Named Observer',
  locationContext: { scope: 'city', city: 'Bengaluru' },
};

/** The one entry in the fixture whose answer could not be determined. */
const UNDETERMINED = { questionId: REPORTABLE[0]!.questionId, tool: 'perplexity' } as const;

function fixtureEntry(questionId: string, tool: (typeof OBSERVATION_TOOLS)[number], index: number): ObservationEntry {
  const base = {
    questionId,
    roundId: ROUND.roundId,
    tool,
    observedOn: '2026-10-01',
    observer: ROUND.observer,
    locationContext: ROUND.locationContext,
    factualErrors: [] as readonly string[],
    correction: null,
  };

  if (tool === 'google-maps') {
    // Requirement 7.3. Not applicable with the reason, not an absence of mention.
    return {
      ...base,
      mentioned: { applicable: false, reason: GOOGLE_MAPS_NOT_APPLICABLE_REASON },
      citedUrl: { available: false, reason: 'The tool does not apply, so nobody looked.' },
      brandStringMatchesExactly: {
        available: false,
        reason: 'The tool does not apply, so nobody looked.',
      },
      phoneMatchesExactly: {
        available: false,
        reason: 'The tool does not apply, so nobody looked.',
      },
    };
  }

  if (questionId === UNDETERMINED.questionId && tool === UNDETERMINED.tool) {
    // Requirement 7.11. Unavailable with a reason, never substituted.
    const reason = 'The tool returned no answer before the sampling window closed.';
    return {
      ...base,
      mentioned: { applicable: true, result: { available: false, reason } },
      citedUrl: { available: false, reason },
      brandStringMatchesExactly: { available: false, reason },
      phoneMatchesExactly: { available: false, reason },
    };
  }

  const mentioned = index % 2 === 0;
  return {
    ...base,
    mentioned: { applicable: true, result: { available: true, value: mentioned } },
    citedUrl: { available: true, value: 'none' },
    brandStringMatchesExactly: { available: true, value: mentioned },
    phoneMatchesExactly: { available: true, value: mentioned },
  };
}

const ENTRIES: readonly ObservationEntry[] = REPORTABLE.flatMap((question, questionIndex) =>
  OBSERVATION_TOOLS.map((tool, toolIndex) =>
    fixtureEntry(question.questionId, tool, questionIndex + toolIndex)
  )
);

function fixtureReport() {
  return buildObservationReport({
    rounds: [ROUND],
    entries: ENTRIES,
    questions: QUESTIONS,
    conditions: CONDITIONS_WITH_DOMAIN,
  });
}

// ---------------------------------------------------------------------------
// Switched off: zero entries, an honest empty state
// ---------------------------------------------------------------------------

describe('the renderer is switched off (Requirement 7.9)', () => {
  it('names the checklist entry that starts recording', () => {
    expect(OBSERVATION_REPORT_CHECKLIST_ENTRY).toBe('A1 / OWN-01');
  });

  it('reads a register holding zero rounds and zero entries', () => {
    expect(SAMPLING_ROUNDS).toEqual([]);
    expect(OBSERVATION_ENTRIES).toEqual([]);
    expect(OBSERVATION_CONDITIONS.domainConfirmed).toBe(false);
  });

  it('builds an empty report that states why, rather than a zero figure', () => {
    const report = buildObservationReport();

    expect(report.recordingEnabled).toBe(false);
    expect(report.roundCount).toBe(0);
    expect(report.rounds).toEqual([]);
    expect(report.inconsistencies).toEqual([]);
    expect(report.blockingChecklistEntry).toBe(OBSERVATION_REPORT_CHECKLIST_ENTRY);
    expect(report.recordingBlockedReason).toContain('no public URL exists to observe');
    expect(report.recordingBlockedReason).toContain('A1');
  });

  it('renders the empty state naming the register entry, and no figure', () => {
    const text = renderObservationReport();

    expect(text).toContain('Observation recording has not begun');
    expect(text).toContain('no public URL exists to observe');
    expect(text).toContain(OBSERVATION_REPORT_CHECKLIST_ENTRY);
    expect(text).toContain('Rounds recorded: 0. Entries recorded: 0.');
    expect(text).toContain('No figure is reported, and none is estimated.');
    expect(text).not.toContain('%');
  });

  it('lists the excluded questions with their reasons (Requirement 7.7)', () => {
    const report = buildObservationReport();
    const ids = report.excludedQuestions.map((question) => question.questionId);
    expect(ids).toEqual(['OBS-Q05', 'OBS-Q08', 'OBS-Q09']);

    const text = renderObservationReport();
    expect(text).toContain('OBS-Q09');
    expect(text).toContain('C4');
  });

  it('reports rather than renders a figure when recording is off and entries exist', () => {
    const report = buildObservationReport({ rounds: [ROUND], entries: ENTRIES, questions: QUESTIONS });

    expect(report.recordingEnabled).toBe(false);
    expect(report.rounds).toEqual([]);
    expect(report.roundCount).toBe(0);
    expect(report.inconsistencies).toHaveLength(1);
    expect(report.inconsistencies[0]).toContain(OBSERVATION_REPORT_CHECKLIST_ENTRY);

    const text = renderObservationReport(report);
    expect(text).toContain('Recorded state not reported');
    expect(text).not.toContain(ROUND.observer);
  });
});

// ---------------------------------------------------------------------------
// A fixture round, rendered as dated samples
// ---------------------------------------------------------------------------

describe('a fixture round renders as dated samples (Requirement 7.12)', () => {
  it('is a legitimate round', () => {
    const validation = validateRound(ROUND, ENTRIES, {
      questions: QUESTIONS,
      conditions: CONDITIONS_WITH_DOMAIN,
    });
    expect(validation.failures).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(ENTRIES).toHaveLength(validation.expectedEntryCount);
  });

  it('carries the round identifier, the round date, the observer and the location context', () => {
    const [round] = fixtureReport().rounds;

    expect(round!.roundId).toBe('OBS-R001');
    expect(round!.roundDate).toBe('2026-10-01');
    expect(round!.completedOn).toBe('2026-10-02');
    expect(round!.observer).toBe('A. Named Observer');
    expect(round!.locationContext).toBe('Bengaluru');
    expect(round!.questionsReportable).toBe(REPORTABLE.length);
  });

  it('counts the questions mentioned out of the questions sampled, per tool', () => {
    const [round] = fixtureReport().rounds;
    expect(round!.tools).toHaveLength(OBSERVATION_TOOLS.length);

    for (const tool of round!.tools) {
      expect(tool.questionsSampled, tool.tool).toBe(REPORTABLE.length);
      expect(tool.questionsMentioned).toBeLessThanOrEqual(tool.questionsSampled);
      const accounted =
        tool.questionsMentioned + tool.questionsNotApplicable + tool.questionsUndetermined;
      expect(accounted, tool.tool).toBeLessThanOrEqual(tool.questionsSampled);
    }
  });

  it('keeps a not-applicable tool out of the mentioned count (Requirement 7.3)', () => {
    const maps = fixtureReport().rounds[0]!.tools.find((tool) => tool.tool === 'google-maps')!;

    expect(maps.questionsNotApplicable).toBe(REPORTABLE.length);
    expect(maps.questionsMentioned).toBe(0);
    expect(maps.questionsUndetermined).toBe(0);
  });

  it('counts an undetermined answer as undetermined, not as a no (Requirement 7.11)', () => {
    const perplexity = fixtureReport().rounds[0]!.tools.find(
      (tool) => tool.tool === UNDETERMINED.tool
    )!;
    expect(perplexity.questionsUndetermined).toBe(1);
  });

  it('renders the round, the date, each tool and the manual-sample statement', () => {
    const text = renderObservationReport(fixtureReport());

    expect(text).toContain('Round OBS-R001, sampled 2026-10-01 to 2026-10-02');
    expect(text).toContain('Observer: A. Named Observer');
    expect(text).toContain('Location context: Bengaluru');
    expect(text).toContain('| Tool | Mentioned | Sampled | Not applicable | Undetermined |');
    for (const label of Object.values(TOOL_LABELS)) {
      expect(text, label).toContain(label);
    }
    expect(text).toContain(MANUAL_SAMPLE_REPORT_STATEMENT);
    expect(MANUAL_SAMPLE_REPORT_STATEMENT).toContain('manual samples');
    expect(MANUAL_SAMPLE_REPORT_STATEMENT).toContain('one named observer');
    expect(MANUAL_SAMPLE_REPORT_STATEMENT).toContain('one location context');
  });

  it('renders one date when the round was taken in a single day', () => {
    const report = buildObservationReport({
      rounds: [{ ...ROUND, completedOn: ROUND.startedOn }],
      entries: ENTRIES,
      questions: QUESTIONS,
      conditions: CONDITIONS_WITH_DOMAIN,
    });
    expect(report.rounds[0]!.completedOn).toBeNull();
    expect(renderObservationReport(report)).toContain('Round OBS-R001, sampled 2026-10-01');
  });

  it('derives no share, no change against a previous round and no ordering of the tools', () => {
    const text = renderObservationReport(fixtureReport());

    expect(text).not.toContain('%');
    expect(text).not.toMatch(/\b(?:up|down|improved|worse|since last|compared with)\b/i);
    // The tools appear in the register's declared order, not in an order derived
    // from how they answered.
    const offsets = OBSERVATION_TOOLS.map((tool) => text.indexOf(TOOL_LABELS[tool]));
    expect(offsets.every((offset) => offset >= 0)).toBe(true);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it('reports a round that has no entry at all as zero sampled, not as zero mentioned', () => {
    const report = buildObservationReport({
      rounds: [ROUND],
      entries: [],
      questions: QUESTIONS,
      conditions: CONDITIONS_WITH_DOMAIN,
    });
    for (const tool of report.rounds[0]!.tools) {
      expect(tool.questionsSampled).toBe(0);
      expect(tool.questionsMentioned).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Requirement 7.5: never a rank, a place, a score or a movement
// ---------------------------------------------------------------------------

describe('no output presents a sample as a ranking (Requirement 7.5)', () => {
  it('finds the forbidden words when they are planted', () => {
    expect(findRankingLanguage('We hold the top ranking position this month.')).toEqual([
      'ranking',
      'position',
    ]);
    expect(findRankingLanguage('A visibility score, and the trend is clear.')).toEqual([
      'score',
      'trend',
    ]);
    expect(findRankingLanguage('An endorsement and a recommendation.')).toEqual([
      'endorsement',
      'recommendation',
    ]);
  });

  it('matches whole words only, so an innocent word is not a violation', () => {
    expect(findRankingLanguage('The disposition of the underscore was unremarkable.')).toEqual([]);
  });

  it('covers the vocabulary Requirement 7.5 names', () => {
    for (const word of ['rank', 'position', 'score', 'trend', 'endorsement', 'recommendation']) {
      expect(FORBIDDEN_RANKING_WORDS, word).toContain(word);
    }
  });

  it('emits none of them in the empty state', () => {
    expect(findRankingLanguage(renderObservationReport())).toEqual([]);
  });

  it('emits none of them for a fixture round', () => {
    expect(findRankingLanguage(renderObservationReport(fixtureReport()))).toEqual([]);
  });

  it('emits none of them when entries are held while recording is off', () => {
    const report = buildObservationReport({ rounds: [ROUND], entries: ENTRIES, questions: QUESTIONS });
    expect(findRankingLanguage(renderObservationReport(report))).toEqual([]);
  });

  it('emits none of them through the script the progress report reads', () => {
    const stdout = execFileSync(process.execPath, [SCRIPT], {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(stdout).toBe(renderObservationReport());
    expect(findRankingLanguage(stdout)).toEqual([]);
  });

  it('refuses to render rather than pass such a word through from the data', () => {
    const report = buildObservationReport({
      rounds: [
        {
          ...ROUND,
          locationContext: { scope: 'locality', city: 'Bengaluru', locality: 'Rank Layout' },
        },
      ],
      entries: ENTRIES,
      questions: QUESTIONS,
      conditions: CONDITIONS_WITH_DOMAIN,
    });
    expect(() => renderObservationReport(report)).toThrow(/Requirement 7\.5/);
  });
});
