import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_QUESTIONS,
  BENCHMARK_QUESTION_SEED,
  CONFIRMED_AREA_PLACEHOLDER,
  CORRECTION_WORKING_DAYS,
  GOOGLE_MAPS_NOT_APPLICABLE_REASON,
  MANUAL_SAMPLE_STATEMENT,
  OBSERVATION_CONDITIONS,
  OBSERVATION_ENTRIES,
  OBSERVATION_TOOLS,
  PUBLISHED_LOCALITY_PLACEHOLDER,
  ROUND_INTERVAL_MAX_DAYS,
  ROUND_WINDOW_MAX_DAYS,
  SAMPLING_ROUNDS,
  canRecordObservations,
  correctionDueBy,
  describeObservationEntry,
  evaluateObservationEntry,
  firstRoundDueBy,
  getReportableQuestions,
  resolveBenchmarkQuestions,
  validateBenchmarkQuestions,
  validateCorrection,
  validateRound,
  validateRoundCadence,
  type ObservationConditions,
  type ObservationEntry,
  type ObservationTool,
  type SamplingRound,
} from '@internal/registers/observation';

/**
 * The observation register.
 *
 * The register holds zero entries today and will hold zero until a domain exists
 * to observe, so these tests build rounds rather than read them. That is the point
 * of the exercise: the arithmetic and the completeness rules have to be right
 * before the first round is taken, not after somebody notices a gap.
 *
 * Note what is *not* asserted anywhere below: a mention count, a position, a
 * score. Requirement 7.4 makes every entry a manual sample, and the register has
 * no code path that turns one into a ranking.
 */

const OBSERVER = 'Utpal Raj KB';

function nonMapsEntry(
  questionId: string,
  tool: ObservationTool,
  overrides: Partial<ObservationEntry> = {}
): ObservationEntry {
  return {
    questionId,
    roundId: 'OBS-R001',
    tool,
    observedOn: '2026-10-01',
    observer: OBSERVER,
    locationContext: { scope: 'city', city: 'Bengaluru' },
    mentioned: { applicable: true, result: { available: true, value: false } },
    citedUrl: { available: true, value: 'none' },
    brandStringMatchesExactly: { available: true, value: false },
    phoneMatchesExactly: { available: true, value: false },
    factualErrors: [],
    correction: null,
    ...overrides,
  };
}

function mapsEntry(
  questionId: string,
  overrides: Partial<ObservationEntry> = {}
): ObservationEntry {
  return {
    ...nonMapsEntry(questionId, 'google-maps'),
    mentioned: { applicable: false, reason: GOOGLE_MAPS_NOT_APPLICABLE_REASON },
    citedUrl: { available: false, reason: GOOGLE_MAPS_NOT_APPLICABLE_REASON },
    brandStringMatchesExactly: { available: false, reason: GOOGLE_MAPS_NOT_APPLICABLE_REASON },
    phoneMatchesExactly: { available: false, reason: GOOGLE_MAPS_NOT_APPLICABLE_REASON },
    ...overrides,
  };
}

function entryFor(questionId: string, tool: ObservationTool): ObservationEntry {
  return tool === 'google-maps' ? mapsEntry(questionId) : nonMapsEntry(questionId, tool);
}

const ROUND: SamplingRound = {
  roundId: 'OBS-R001',
  startedOn: '2026-10-01',
  completedOn: '2026-10-02',
  observer: OBSERVER,
  locationContext: { scope: 'city', city: 'Bengaluru' },
};

function completeRoundEntries(): ObservationEntry[] {
  return getReportableQuestions().flatMap((question) =>
    OBSERVATION_TOOLS.map((tool) => entryFor(question.questionId, tool))
  );
}

describe('the live register', () => {
  it('holds no entry and no round, because no public URL exists to observe', () => {
    expect(OBSERVATION_ENTRIES).toEqual([]);
    expect(SAMPLING_ROUNDS).toEqual([]);
  });

  it('keeps recording switched off, naming the blocking owner input', () => {
    const state = canRecordObservations();
    expect(state.enabled).toBe(false);
    expect(state.reason).toContain('A1');
    expect(state.reason).toContain('no public URL exists to observe');
  });

  it('records the first round as due seven calendar days after confirmation', () => {
    expect(firstRoundDueBy('2026-10-01')).toBe('2026-10-08');
    expect(firstRoundDueBy('not a date')).toBeNull();
  });

  it('turns recording on once the domain is confirmed', () => {
    const conditions: ObservationConditions = { ...OBSERVATION_CONDITIONS, domainConfirmed: true };
    expect(canRecordObservations(conditions)).toEqual({ enabled: true, reason: null });
  });
});

describe('the ten benchmark questions', () => {
  it('holds exactly ten, identified OBS-Q01 to OBS-Q10', () => {
    expect(BENCHMARK_QUESTION_SEED).toHaveLength(10);
    expect(BENCHMARK_QUESTIONS.map((question) => question.questionId)).toEqual([
      'OBS-Q01',
      'OBS-Q02',
      'OBS-Q03',
      'OBS-Q04',
      'OBS-Q05',
      'OBS-Q06',
      'OBS-Q07',
      'OBS-Q08',
      'OBS-Q09',
      'OBS-Q10',
    ]);
  });

  it('passes its own structural validation', () => {
    expect(validateBenchmarkQuestions()).toEqual({ ok: true, failures: [] });
  });

  it('excludes exactly OBS-Q05, OBS-Q08 and OBS-Q09 today', () => {
    const excluded = BENCHMARK_QUESTIONS.filter((question) => !question.reportable);
    expect(excluded.map((question) => question.questionId)).toEqual([
      'OBS-Q05',
      'OBS-Q08',
      'OBS-Q09',
    ]);
    expect(getReportableQuestions()).toHaveLength(7);
  });

  it('names the blocking condition on each excluded question', () => {
    const byId = new Map(BENCHMARK_QUESTIONS.map((question) => [question.questionId, question]));
    expect(byId.get('OBS-Q05')?.exclusionReason).toContain('C1');
    expect(byId.get('OBS-Q08')?.exclusionReason).toContain('publication gate');
    expect(byId.get('OBS-Q09')?.exclusionReason).toContain('C4');
  });

  it('records a condition rather than a placeholder area name', () => {
    const byId = new Map(BENCHMARK_QUESTIONS.map((question) => [question.questionId, question]));
    expect(byId.get('OBS-Q05')?.questionText).toContain(CONFIRMED_AREA_PLACEHOLDER);
    expect(byId.get('OBS-Q08')?.questionText).toContain(PUBLISHED_LOCALITY_PLACEHOLDER);
  });

  it('gives every reportable question the exact Requirement 7.1 subject', () => {
    const texts = BENCHMARK_QUESTIONS.map((question) => question.questionText);
    expect(texts[0]).toContain('selling an apartment in Bengaluru');
    expect(texts[1]).toContain('choose a broker to sell my flat');
    expect(texts[2]).toContain('buy an apartment in Bengaluru');
    expect(texts[3]).toContain('renting out a house in Bengaluru');
    expect(texts[5]).toContain('INSTLE REAL ESTATE');
    expect(texts[6]).toContain('Utpal Raj KB');
    expect(texts[8]).toContain('commercial property broker');
    expect(texts[9]).toContain('30 days');
  });

  describe('becoming reportable from the condition', () => {
    it('makes OBS-Q05 reportable and names the confirmed area', () => {
      const resolved = resolveBenchmarkQuestions({
        ...OBSERVATION_CONDITIONS,
        confirmedServedAreas: ['Jayanagar'],
      });
      const question = resolved.find((item) => item.questionId === 'OBS-Q05');
      expect(question?.reportable).toBe(true);
      expect(question?.exclusionReason).toBeNull();
      expect(question?.questionText).toBe('Which brokerage works near Jayanagar?');
      expect(validateBenchmarkQuestions(resolved)).toEqual({ ok: true, failures: [] });
    });

    it('makes OBS-Q08 reportable and names the published locality', () => {
      const resolved = resolveBenchmarkQuestions({
        ...OBSERVATION_CONDITIONS,
        publishedLocalityNames: ['Indiranagar'],
      });
      const question = resolved.find((item) => item.questionId === 'OBS-Q08');
      expect(question?.reportable).toBe(true);
      expect(question?.questionText).toBe('Who helps with resale in Indiranagar?');
    });

    it('makes OBS-Q09 reportable only once the commercial capability is confirmed', () => {
      const resolved = resolveBenchmarkQuestions({
        ...OBSERVATION_CONDITIONS,
        commercialCapabilityConfirmed: true,
      });
      const question = resolved.find((item) => item.questionId === 'OBS-Q09');
      expect(question?.reportable).toBe(true);
      expect(question?.exclusionReason).toBeNull();
    });

    it('leaves the other questions untouched when a condition is satisfied', () => {
      const resolved = resolveBenchmarkQuestions({
        ...OBSERVATION_CONDITIONS,
        confirmedServedAreas: ['Jayanagar'],
      });
      expect(resolved.filter((question) => !question.reportable).map((q) => q.questionId)).toEqual([
        'OBS-Q08',
        'OBS-Q09',
      ]);
    });

    it('reports a reportable question that still carries a placeholder as a failure', () => {
      const broken = BENCHMARK_QUESTION_SEED.map((question) =>
        question.questionId === 'OBS-Q05'
          ? { ...question, reportable: true, exclusionReason: null }
          : question
      );
      const validation = validateBenchmarkQuestions(broken);
      expect(validation.ok).toBe(false);
      expect(validation.failures.join(' ')).toContain(CONFIRMED_AREA_PLACEHOLDER);
    });

    it('reports an excluded question with no reason as a failure', () => {
      const broken = BENCHMARK_QUESTION_SEED.map((question) =>
        question.questionId === 'OBS-Q09' ? { ...question, exclusionReason: null } : question
      );
      const validation = validateBenchmarkQuestions(broken);
      expect(validation.ok).toBe(false);
      expect(validation.failures.join(' ')).toContain('OBS-Q09');
    });
  });
});

describe('round completeness and cardinality', () => {
  it('expects one entry per reportable question per tool', () => {
    const validation = validateRound(ROUND, completeRoundEntries());
    expect(validation.expectedEntryCount).toBe(7 * 5);
    expect(validation.failures).toEqual([]);
    expect(validation.ok).toBe(true);
  });

  it('names the question and the tool for every missing entry', () => {
    const entries = completeRoundEntries().filter(
      (entry) => !(entry.questionId === 'OBS-Q03' && entry.tool === 'perplexity')
    );
    const validation = validateRound(ROUND, entries);
    expect(validation.ok).toBe(false);
    expect(validation.failures).toContain('Round OBS-R001: no entry for OBS-Q03 against perplexity.');
  });

  it('rejects a second entry for the same question and tool', () => {
    const entries = completeRoundEntries();
    entries.push(entryFor('OBS-Q01', 'google-organic'));
    const validation = validateRound(ROUND, entries);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('2 entries for OBS-Q01 against google-organic');
  });

  it('rejects an entry recorded against an excluded question', () => {
    const entries = [...completeRoundEntries(), entryFor('OBS-Q09', 'google-organic')];
    const validation = validateRound(ROUND, entries);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('OBS-Q09');
    expect(validation.failures.join(' ')).toContain('excluded from every round');
  });

  it('rejects an entry carrying an unknown question identifier', () => {
    const entries = [...completeRoundEntries(), entryFor('OBS-Q99', 'google-organic')];
    const validation = validateRound(ROUND, entries);
    expect(validation.failures.join(' ')).toContain('no benchmark question carries that identifier');
  });

  it('rejects an entry recorded against another round', () => {
    const entries = completeRoundEntries();
    entries[0] = { ...entries[0], roundId: 'OBS-R002' };
    const validation = validateRound(ROUND, entries);
    expect(validation.failures.join(' ')).toContain('entry records round OBS-R002');
  });

  it('rejects a round whose observer is a desk name', () => {
    const validation = validateRound(
      { ...ROUND, observer: 'Research Desk' },
      completeRoundEntries()
    );
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('does not name an accountable observer');
  });

  it('rejects an entry whose observer is a desk name, naming the observer field', () => {
    const entries = completeRoundEntries();
    entries[0] = { ...entries[0], observer: '  research desk  ' };
    const validation = validateRound(ROUND, entries);
    expect(validation.failures.join(' ')).toContain('omits observer');
  });
});

describe('the two-day round window', () => {
  it('accepts a round completed two calendar days after it started', () => {
    const round: SamplingRound = { ...ROUND, startedOn: '2026-10-01', completedOn: '2026-10-03' };
    const entries = completeRoundEntries().map((entry) => ({ ...entry, observedOn: '2026-10-03' }));
    expect(validateRound(round, entries).failures).toEqual([]);
  });

  it('rejects a round completed three calendar days after it started', () => {
    const round: SamplingRound = { ...ROUND, startedOn: '2026-10-01', completedOn: '2026-10-04' };
    const entries = completeRoundEntries().map((entry) => ({ ...entry, observedOn: '2026-10-04' }));
    const validation = validateRound(round, entries);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain(
      `spans 3 calendar days, beyond the ${ROUND_WINDOW_MAX_DAYS}-day window`
    );
  });

  it('rejects an entry observed outside the window', () => {
    const entries = completeRoundEntries();
    entries[0] = { ...entries[0], observedOn: '2026-10-05' };
    const validation = validateRound(ROUND, entries);
    expect(validation.failures.join(' ')).toContain('outside the round window');
  });

  it('rejects a round with no completion date recorded', () => {
    const validation = validateRound({ ...ROUND, completedOn: null }, completeRoundEntries());
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('no completion date recorded');
  });
});

describe('the thirty-day round interval', () => {
  const first: SamplingRound = { ...ROUND, roundId: 'OBS-R001', startedOn: '2026-10-01', completedOn: '2026-10-02' };

  it('accepts a second round started exactly thirty days later', () => {
    const second: SamplingRound = {
      ...ROUND,
      roundId: 'OBS-R002',
      startedOn: '2026-10-31',
      completedOn: '2026-11-01',
    };
    expect(validateRoundCadence([first, second])).toEqual({ ok: true, failures: [] });
  });

  it('rejects a second round started thirty-one days later', () => {
    const second: SamplingRound = {
      ...ROUND,
      roundId: 'OBS-R002',
      startedOn: '2026-11-01',
      completedOn: '2026-11-02',
    };
    const validation = validateRoundCadence([first, second]);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain(
      `31 calendar days after round OBS-R001, beyond the ${ROUND_INTERVAL_MAX_DAYS}-day interval`
    );
  });

  it('measures the interval start to start, whatever order the rounds are listed in', () => {
    const second: SamplingRound = {
      ...ROUND,
      roundId: 'OBS-R002',
      startedOn: '2026-11-01',
      completedOn: '2026-11-02',
    };
    expect(validateRoundCadence([second, first]).ok).toBe(false);
  });

  it('accepts a single round with nothing to compare it against', () => {
    expect(validateRoundCadence([first])).toEqual({ ok: true, failures: [] });
    expect(validateRoundCadence([])).toEqual({ ok: true, failures: [] });
  });
});

describe('five-working-day correction arithmetic', () => {
  const cases: readonly { readonly weekday: string; readonly observedOn: string; readonly dueBy: string }[] = [
    // 2026-10-05 is a Monday.
    { weekday: 'Monday', observedOn: '2026-10-05', dueBy: '2026-10-12' },
    { weekday: 'Tuesday', observedOn: '2026-10-06', dueBy: '2026-10-13' },
    { weekday: 'Wednesday', observedOn: '2026-10-07', dueBy: '2026-10-14' },
    { weekday: 'Thursday', observedOn: '2026-10-08', dueBy: '2026-10-15' },
    { weekday: 'Friday', observedOn: '2026-10-09', dueBy: '2026-10-16' },
    { weekday: 'Saturday', observedOn: '2026-10-10', dueBy: '2026-10-16' },
    { weekday: 'Sunday', observedOn: '2026-10-11', dueBy: '2026-10-16' },
  ];

  for (const { weekday, observedOn, dueBy } of cases) {
    it(`gives ${dueBy} for an observation on ${weekday} ${observedOn}`, () => {
      expect(correctionDueBy(observedOn)).toBe(dueBy);
    });
  }

  it('records no deadline for a date that is not a calendar date', () => {
    expect(correctionDueBy('2026-13-01')).toBeNull();
  });

  it('requires a correction when a factual error was observed', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      observedOn: '2026-10-05',
      factualErrors: ['The tool reported a different telephone number.'],
      correction: null,
    });
    const validation = validateCorrection(entry);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('due by 2026-10-12');
    expect(evaluateObservationEntry(entry).missingFields).toContain('correction');
  });

  it('accepts a correction recorded on the deadline', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      observedOn: '2026-10-05',
      factualErrors: ['The tool reported a different telephone number.'],
      correction: {
        incorrectFact: 'The telephone number reported was not 9353096264.',
        pageThatShouldCarryTheFact: '/contact',
        correctionMade: 'The contact page was checked and the number restated.',
        correctedOn: '2026-10-12',
      },
    });
    expect(validateCorrection(entry)).toEqual({ ok: true, failures: [] });
    expect(evaluateObservationEntry(entry).usable).toBe(true);
  });

  it('rejects a correction recorded a day after the deadline', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      observedOn: '2026-10-05',
      factualErrors: ['The tool reported a different telephone number.'],
      correction: {
        incorrectFact: 'The telephone number reported was not 9353096264.',
        pageThatShouldCarryTheFact: '/contact',
        correctionMade: 'The contact page was checked and the number restated.',
        correctedOn: '2026-10-13',
      },
    });
    const validation = validateCorrection(entry);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain(
      `after the ${CORRECTION_WORKING_DAYS}-working-day deadline of 2026-10-12`
    );
  });

  it('rejects a correction dated before the observation', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      observedOn: '2026-10-05',
      factualErrors: ['The tool reported a different telephone number.'],
      correction: {
        incorrectFact: 'The telephone number reported was not 9353096264.',
        pageThatShouldCarryTheFact: '/contact',
        correctionMade: 'The contact page was checked and the number restated.',
        correctedOn: '2026-10-01',
      },
    });
    expect(validateCorrection(entry).failures.join(' ')).toContain('before the observation');
  });

  it('rejects a correction recorded when no error was observed', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      factualErrors: [],
      correction: {
        incorrectFact: 'none',
        pageThatShouldCarryTheFact: '/contact',
        correctionMade: 'none',
        correctedOn: '2026-10-05',
      },
    });
    expect(validateCorrection(entry).failures.join(' ')).toContain(
      'a correction is recorded although no factual error was observed'
    );
  });
});

describe('Google Maps not-applicable handling', () => {
  it('accepts a Maps row recorded not applicable with the reason', () => {
    const validation = validateRound(ROUND, completeRoundEntries());
    expect(validation.ok).toBe(true);
  });

  it('rejects a Maps row recorded as an absence of mention', () => {
    const entries = completeRoundEntries().map((entry) =>
      entry.tool === 'google-maps' && entry.questionId === 'OBS-Q01'
        ? nonMapsEntry('OBS-Q01', 'google-maps')
        : entry
    );
    const validation = validateRound(ROUND, entries);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('recorded as applicable while no Maps presence is confirmed');
  });

  it('rejects a non-Maps row recorded not applicable', () => {
    const entries = completeRoundEntries().map((entry) =>
      entry.tool === 'perplexity' && entry.questionId === 'OBS-Q01'
        ? { ...mapsEntry('OBS-Q01'), tool: 'perplexity' as ObservationTool }
        : entry
    );
    const validation = validateRound(ROUND, entries);
    expect(validation.failures.join(' ')).toContain('the perplexity row is recorded not applicable');
  });

  it('rejects a not-applicable row that still records a determined value', () => {
    const entries = completeRoundEntries().map((entry) =>
      entry.tool === 'google-maps' && entry.questionId === 'OBS-Q01'
        ? mapsEntry('OBS-Q01', { citedUrl: { available: true, value: 'none' } })
        : entry
    );
    const validation = validateRound(ROUND, entries);
    expect(validation.failures.join(' ')).toContain(
      'citedUrl records a value although the tool does not apply'
    );
  });

  it('accepts a Maps row as an ordinary observation once a presence is confirmed', () => {
    const conditions: ObservationConditions = {
      ...OBSERVATION_CONDITIONS,
      googleMapsPresenceConfirmed: true,
    };
    const entries = completeRoundEntries().map((entry) =>
      entry.tool === 'google-maps' ? nonMapsEntry(entry.questionId, 'google-maps') : entry
    );
    expect(validateRound(ROUND, entries, { conditions }).failures).toEqual([]);
  });

  it('rejects a not-applicable Maps row once a presence is confirmed', () => {
    const conditions: ObservationConditions = {
      ...OBSERVATION_CONDITIONS,
      googleMapsPresenceConfirmed: true,
    };
    const validation = validateRound(ROUND, completeRoundEntries(), { conditions });
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('recorded not applicable');
  });
});

describe('entry field completeness', () => {
  it('names every absent field rather than the first', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      questionId: '',
      roundId: '',
      observedOn: '',
      observer: 'tbd',
    });
    const evaluation = evaluateObservationEntry(entry);
    expect(evaluation.usable).toBe(false);
    expect(evaluation.missingFields).toEqual(['questionId', 'roundId', 'observedOn', 'observer']);
  });

  it('requires a reason on any field recorded unavailable', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      citedUrl: { available: false, reason: '' },
      brandStringMatchesExactly: { available: false, reason: '   ' },
    });
    expect(evaluateObservationEntry(entry).missingFields).toEqual([
      'citedUrl.reason',
      'brandStringMatchesExactly.reason',
    ]);
  });

  it('requires a reason on a not-applicable row', () => {
    const entry = mapsEntry('OBS-Q01', { mentioned: { applicable: false, reason: '' } });
    expect(evaluateObservationEntry(entry).missingFields).toEqual(['mentioned.reason']);
  });

  it('accepts a recorded value of false as a determined value', () => {
    const entry = nonMapsEntry('OBS-Q01', 'google-organic', {
      mentioned: { applicable: true, result: { available: true, value: false } },
      brandStringMatchesExactly: { available: true, value: false },
    });
    expect(evaluateObservationEntry(entry).usable).toBe(true);
  });

  it('labels every entry a manual sample', () => {
    const description = describeObservationEntry(nonMapsEntry('OBS-Q01', 'google-organic'));
    expect(description).toContain('OBS-Q01');
    expect(description).toContain('2026-10-01');
    expect(description).toContain(OBSERVER);
    expect(description).toContain(MANUAL_SAMPLE_STATEMENT);
    expect(MANUAL_SAMPLE_STATEMENT).toContain('not a ranking');
  });
});
