import { describe, expect, it } from 'vitest';

import {
  COMPETITOR_OBSERVATIONS,
  INTENT_ASSIGNMENTS,
  KEYWORD_RESEARCH_TOOL_LICENCE,
  MAX_SUPPORTING_PHRASES_PER_PAGE,
  POSITION_SAMPLE_LABEL,
  SEARCH_INTENT_ENTRIES,
  SUPERLATIVE_BROKER_PHRASES,
  VOLUME_REQUERY_MAX_DAYS,
  assignPrimaryIntent,
  classifyPhraseUsage,
  describePositionSample,
  evaluateCompetitorObservation,
  evaluateIntentEntry,
  evaluateManualMethodOnlyMode,
  evaluateVolume,
  isSuperlativeBrokerPhrase,
  type CompetitorObservation,
  type IntentAssignment,
  type KeywordToolLicence,
  type SearchIntentEntry,
  type VolumeObservation,
} from '@internal/registers/search-intent';

/**
 * The search intent register.
 *
 * Three behaviours carry the requirements, and each is tested at the point where
 * it would be tempting to be helpful instead of honest:
 *
 *  - an entry missing a required field is held out of editorial use, and the
 *    evaluation names the field rather than summarising (Requirement 3.13);
 *  - a volume figure is unavailable unless every recorded condition holds, with
 *    no rounded or inferred value substituted (Requirements 3.2, 3.3);
 *  - while no tool licence is recorded, every volume is unavailable and every
 *    phrase comes from a named manual method (Requirement 3.15).
 *
 * The licence is passed explicitly where a test needs to reach past Requirement
 * 3.15 into the per-attribute branches; the default is the live, unsupplied state,
 * and one test asserts exactly that.
 */

const LICENCE_SUPPLIED: KeywordToolLicence = { supplied: true, ownerInputEntry: 'C13' };

const NOW = new Date('2026-09-29T00:00:00.000Z');

function completeVolume(overrides: Partial<VolumeObservation> = {}): VolumeObservation {
  return {
    figure: 1_900,
    toolName: 'Example Keyword Tool',
    queriedOn: '2026-09-01',
    toolSettings: {
      locationSetting: 'Bengaluru, Karnataka, India',
      languageSetting: 'English',
      dateRangeApplied: 'Aug 2025 – Jul 2026',
    },
    reQueryBy: '2026-11-01',
    ...overrides,
  };
}

function completeEntry(overrides: Partial<SearchIntentEntry> = {}): SearchIntentEntry {
  return {
    entryId: 'SIE-0001',
    phrase: 'how to sell a flat in bengaluru',
    source: { kind: 'manual', methodName: 'Recorded customer call notes' },
    observedOn: '2026-09-01',
    locationContext: { scope: 'city', city: 'Bengaluru' },
    primaryIntentQuestion: 'How do I sell my flat in Bengaluru?',
    destinationRoute: null,
    role: 'primary',
    volume: null,
    ...overrides,
  };
}

function completeCompetitorObservation(
  overrides: Partial<CompetitorObservation> = {}
): CompetitorObservation {
  return {
    observationId: 'CMP-0001',
    queryText: 'flat resale help bengaluru',
    observedOn: '2026-09-01',
    toolName: 'Example Search Tool',
    locationContext: { scope: 'locality', city: 'Bengaluru', locality: 'Jayanagar' },
    resultType: 'organic',
    positionSample: 7,
    ...overrides,
  };
}

describe('the live register', () => {
  it('holds no entry, no competitor sample and no assignment yet', () => {
    // Requirement 3.15: nothing has been researched under a licensed tool.
    expect(SEARCH_INTENT_ENTRIES).toEqual([]);
    expect(COMPETITOR_OBSERVATIONS).toEqual([]);
    expect(INTENT_ASSIGNMENTS).toEqual([]);
  });

  it('records the tool licence as unsupplied against its owner-input entry', () => {
    expect(KEYWORD_RESEARCH_TOOL_LICENCE.supplied).toBe(false);
    expect(KEYWORD_RESEARCH_TOOL_LICENCE.ownerInputEntry).toBe('C13');
  });
});

describe('entry validity matrix', () => {
  it('accepts an entry carrying every required field', () => {
    expect(evaluateIntentEntry(completeEntry())).toEqual({ usable: true, missingFields: [] });
  });

  const blankings: readonly {
    readonly field: string;
    readonly entry: SearchIntentEntry;
  }[] = [
    { field: 'entryId', entry: completeEntry({ entryId: '   ' }) },
    { field: 'phrase', entry: completeEntry({ phrase: '' }) },
    {
      field: 'source.methodName',
      entry: completeEntry({ source: { kind: 'manual', methodName: '' } }),
    },
    {
      field: 'source.toolName',
      entry: completeEntry({ source: { kind: 'tool', toolName: '  ' } }),
    },
    { field: 'observedOn', entry: completeEntry({ observedOn: '' }) },
    {
      field: 'locationContext.locality',
      entry: completeEntry({
        locationContext: { scope: 'locality', city: 'Bengaluru', locality: '' },
      }),
    },
    { field: 'primaryIntentQuestion', entry: completeEntry({ primaryIntentQuestion: '' }) },
  ];

  for (const { field, entry } of blankings) {
    it(`names ${field} when it is absent, and holds the entry out of editorial use`, () => {
      const evaluation = evaluateIntentEntry(entry);
      expect(evaluation.usable).toBe(false);
      expect(evaluation.missingFields).toEqual([field]);
    });
  }

  it('names every absent field at once rather than the first', () => {
    const evaluation = evaluateIntentEntry(
      completeEntry({ entryId: '', phrase: '', observedOn: '', primaryIntentQuestion: '' })
    );
    expect(evaluation.usable).toBe(false);
    expect(evaluation.missingFields).toEqual([
      'entryId',
      'phrase',
      'observedOn',
      'primaryIntentQuestion',
    ]);
  });

  it('rejects a date that is not a calendar date', () => {
    // 2026 is not a leap year, so 29 February does not exist.
    expect(evaluateIntentEntry(completeEntry({ observedOn: '2026-02-29' })).usable).toBe(false);
    expect(evaluateIntentEntry(completeEntry({ observedOn: '01-09-2026' })).usable).toBe(false);
    expect(evaluateIntentEntry(completeEntry({ observedOn: '2026-09-01' })).usable).toBe(true);
  });

  it('holds the phrase to 120 characters at the boundary', () => {
    const atLimit = 'a'.repeat(120);
    const overLimit = 'a'.repeat(121);
    expect(evaluateIntentEntry(completeEntry({ phrase: atLimit })).usable).toBe(true);
    expect(evaluateIntentEntry(completeEntry({ phrase: overLimit })).missingFields).toEqual([
      'phrase',
    ]);
  });

  it('accepts a city-scoped location context with no locality named', () => {
    const evaluation = evaluateIntentEntry(
      completeEntry({ locationContext: { scope: 'city', city: 'Bengaluru' } })
    );
    expect(evaluation.usable).toBe(true);
  });
});

describe('volume availability', () => {
  it('is unavailable with a reason while no tool licence is recorded', () => {
    const entry = completeEntry({ volume: completeVolume() });
    const availability = evaluateVolume(entry, NOW);
    expect(availability.available).toBe(false);
    expect(availability.available === false && availability.reason).toContain('C13');
  });

  it('is unavailable when no volume is recorded, and the phrase entry survives', () => {
    const entry = completeEntry({ volume: null });
    const availability = evaluateVolume(entry, NOW, LICENCE_SUPPLIED);
    expect(availability).toEqual({
      available: false,
      reason: 'No volume figure is recorded for this phrase.',
    });
    // Requirement 3.3: the entry is retained for editorial use.
    expect(evaluateIntentEntry(entry).usable).toBe(true);
  });

  const missingAttributes: readonly {
    readonly label: string;
    readonly volume: VolumeObservation;
    readonly reason: string;
  }[] = [
    {
      label: 'named tool',
      volume: completeVolume({ toolName: '  ' }),
      reason: 'The volume figure records no named tool.',
    },
    {
      label: 'query date',
      volume: completeVolume({ queriedOn: '' }),
      reason: 'The volume figure records no query date.',
    },
    {
      label: 'location setting',
      volume: completeVolume({
        toolSettings: {
          locationSetting: '',
          languageSetting: 'English',
          dateRangeApplied: 'Aug 2025 – Jul 2026',
        },
      }),
      reason: 'The volume figure records no location setting.',
    },
    {
      label: 'language setting',
      volume: completeVolume({
        toolSettings: {
          locationSetting: 'Bengaluru',
          languageSetting: '',
          dateRangeApplied: 'Aug 2025 – Jul 2026',
        },
      }),
      reason: 'The volume figure records no language setting.',
    },
    {
      label: 'date range applied',
      volume: completeVolume({
        toolSettings: {
          locationSetting: 'Bengaluru',
          languageSetting: 'English',
          dateRangeApplied: '   ',
        },
      }),
      reason: 'The volume figure records no date range applied.',
    },
    {
      label: 're-query date',
      volume: completeVolume({ reQueryBy: '' }),
      reason: 'The volume figure records no re-query date.',
    },
  ];

  for (const { label, volume, reason } of missingAttributes) {
    it(`is unavailable with a reason when the ${label} is absent`, () => {
      const availability = evaluateVolume(completeEntry({ volume }), NOW, LICENCE_SUPPLIED);
      expect(availability).toEqual({ available: false, reason });
    });
  }

  it('returns the recorded figure unchanged when every condition holds', () => {
    const entry = completeEntry({ volume: completeVolume({ figure: 1_873 }) });
    const availability = evaluateVolume(entry, new Date('2026-09-05T00:00:00.000Z'), LICENCE_SUPPLIED);
    expect(availability).toEqual({ available: true, figure: 1_873 });
  });

  it('substitutes nothing for an unavailable figure', () => {
    const entry = completeEntry({ volume: completeVolume({ toolName: '' }) });
    const availability = evaluateVolume(entry, NOW, LICENCE_SUPPLIED);
    expect(availability.available).toBe(false);
    expect(Object.keys(availability)).toEqual(['available', 'reason']);
    expect('figure' in availability).toBe(false);
  });

  describe('the 180-day re-query window', () => {
    it('accepts a re-query date exactly 180 days after the query date', () => {
      // 2026-09-01 + 180 days = 2027-02-28.
      const volume = completeVolume({ queriedOn: '2026-09-01', reQueryBy: '2027-02-28' });
      const availability = evaluateVolume(completeEntry({ volume }), NOW, LICENCE_SUPPLIED);
      expect(availability.available).toBe(true);
    });

    it('rejects a re-query date 181 days after the query date', () => {
      const volume = completeVolume({ queriedOn: '2026-09-01', reQueryBy: '2027-03-01' });
      const availability = evaluateVolume(completeEntry({ volume }), NOW, LICENCE_SUPPLIED);
      expect(availability.available).toBe(false);
      expect(availability.available === false && availability.reason).toContain(
        `beyond the ${VOLUME_REQUERY_MAX_DAYS}-day limit`
      );
    });

    it('rejects a re-query date recorded before the query date', () => {
      const volume = completeVolume({ queriedOn: '2026-09-01', reQueryBy: '2026-08-01' });
      const availability = evaluateVolume(completeEntry({ volume }), NOW, LICENCE_SUPPLIED);
      expect(availability.available).toBe(false);
      expect(availability.available === false && availability.reason).toContain('falls before');
    });
  });

  describe('the re-query date itself', () => {
    const volume = completeVolume({ queriedOn: '2026-09-01', reQueryBy: '2026-11-01' });
    const entry = completeEntry({ volume });

    it('is available the day before the re-query date', () => {
      const availability = evaluateVolume(
        entry,
        new Date('2026-10-31T23:59:59.000Z'),
        LICENCE_SUPPLIED
      );
      expect(availability.available).toBe(true);
    });

    it('is unavailable on the re-query date itself', () => {
      const availability = evaluateVolume(
        entry,
        new Date('2026-11-01T00:00:00.000Z'),
        LICENCE_SUPPLIED
      );
      expect(availability).toEqual({
        available: false,
        reason: 'The re-query date 2026-11-01 has passed.',
      });
    });

    it('is unavailable after the re-query date', () => {
      const availability = evaluateVolume(
        entry,
        new Date('2026-12-01T00:00:00.000Z'),
        LICENCE_SUPPLIED
      );
      expect(availability.available).toBe(false);
    });
  });
});

describe('manual-method-only mode', () => {
  it('holds every volume unavailable, however complete the recording', () => {
    const entries = [
      completeEntry({ entryId: 'SIE-0001', volume: completeVolume() }),
      completeEntry({ entryId: 'SIE-0002', volume: completeVolume({ figure: 40 }) }),
    ];
    for (const entry of entries) {
      expect(evaluateVolume(entry, NOW).available).toBe(false);
    }
  });

  it('rejects a tool-sourced entry and a recorded volume, naming the owner-input entry', () => {
    const evaluation = evaluateManualMethodOnlyMode([
      completeEntry({
        entryId: 'SIE-0003',
        source: { kind: 'tool', toolName: 'Example Keyword Tool' },
        volume: completeVolume(),
      }),
    ]);
    expect(evaluation.compliant).toBe(false);
    expect(evaluation.failures).toHaveLength(2);
    for (const failure of evaluation.failures) {
      expect(failure).toContain('SIE-0003');
      expect(failure).toContain('C13');
    }
  });

  it('accepts a manual-method entry carrying no volume', () => {
    expect(evaluateManualMethodOnlyMode([completeEntry()])).toEqual({
      compliant: true,
      failures: [],
    });
  });

  it('imposes no restriction once a licence is recorded', () => {
    const evaluation = evaluateManualMethodOnlyMode(
      [completeEntry({ source: { kind: 'tool', toolName: 'Example Keyword Tool' } })],
      LICENCE_SUPPLIED
    );
    expect(evaluation).toEqual({ compliant: true, failures: [] });
  });
});

describe('superlative broker phrases', () => {
  it('classifies each of the five recorded phrases as a research query only', () => {
    expect(SUPERLATIVE_BROKER_PHRASES).toHaveLength(5);
    for (const phrase of SUPERLATIVE_BROKER_PHRASES) {
      expect(isSuperlativeBrokerPhrase(phrase)).toBe(true);
      expect(classifyPhraseUsage(phrase)).toBe('research-query-only');
    }
  });

  it('catches a superlative paired with a brokerage word that is not in the five', () => {
    expect(classifyPhraseUsage('finest property dealer in bengaluru')).toBe('research-query-only');
    expect(classifyPhraseUsage('no. 1 real estate agency bengaluru')).toBe('research-query-only');
  });

  it('leaves an ordinary customer phrase assignable', () => {
    expect(classifyPhraseUsage('how to sell a flat in bengaluru')).toBe('assignable');
    expect(classifyPhraseUsage('documents needed to sell a site')).toBe('assignable');
  });
});

describe('competitor observations', () => {
  it('accepts an observation carrying every required field', () => {
    expect(evaluateCompetitorObservation(completeCompetitorObservation())).toEqual({
      usable: true,
      missingFields: [],
    });
  });

  it('names every absent field', () => {
    const evaluation = evaluateCompetitorObservation(
      completeCompetitorObservation({ queryText: '', observedOn: '', toolName: '' })
    );
    expect(evaluation.usable).toBe(false);
    expect(evaluation.missingFields).toEqual(['queryText', 'observedOn', 'toolName']);
  });

  it('labels a recorded position a dated sample rather than a ranking', () => {
    const description = describePositionSample(completeCompetitorObservation());
    expect(description).toContain(POSITION_SAMPLE_LABEL);
    expect(description).toContain('2026-09-01');
    expect(description).toContain('Example Search Tool');
    expect(description).toContain('not a ranking');
  });

  it('describes no position when none was seen', () => {
    expect(describePositionSample(completeCompetitorObservation({ positionSample: null }))).toBeNull();
  });

  it('describes no position when the date or the tool that would date it is absent', () => {
    expect(describePositionSample(completeCompetitorObservation({ observedOn: '' }))).toBeNull();
    expect(describePositionSample(completeCompetitorObservation({ toolName: '' }))).toBeNull();
  });
});

describe('one question, one page', () => {
  const entry = completeEntry({ entryId: 'SIE-0100' });

  it('assigns a primary intent to a route', () => {
    const result = assignPrimaryIntent([], { entry, route: '/guides/selling-a-flat' });
    expect(result.ok).toBe(true);
    expect(result.ok === true && result.assignments).toEqual([
      {
        route: '/guides/selling-a-flat',
        intentEntryId: 'SIE-0100',
        primaryIntentQuestion: 'How do I sell my flat in Bengaluru?',
        supportingPhrases: [],
      },
    ]);
  });

  it('rejects a second assignment of an already-served intent and names the conflicting route', () => {
    const first = assignPrimaryIntent([], { entry, route: '/guides/selling-a-flat' });
    const existing: readonly IntentAssignment[] = first.ok === true ? first.assignments : [];

    const second = assignPrimaryIntent(existing, {
      entry: completeEntry({
        entryId: 'SIE-0101',
        // Same question, different wording of the phrase and different casing.
        phrase: 'sell my flat bengaluru',
        primaryIntentQuestion: '  how do i SELL my flat in bengaluru?  ',
      }),
      route: '/guides/flat-sale-steps',
    });

    expect(second.ok).toBe(false);
    if (second.ok === false) {
      expect(second.conflictingRoute).toBe('/guides/selling-a-flat');
      expect(second.recordStaysUnpublished).toBe(true);
      expect(second.error).toContain('/guides/selling-a-flat');
    }
    // The first assignment is untouched: the function is pure.
    expect(existing).toHaveLength(1);
  });

  it('permits at most one primary intent per route', () => {
    const first = assignPrimaryIntent([], { entry, route: '/guides/selling-a-flat' });
    const existing: readonly IntentAssignment[] = first.ok === true ? first.assignments : [];

    const second = assignPrimaryIntent(existing, {
      entry: completeEntry({
        entryId: 'SIE-0102',
        primaryIntentQuestion: 'What does a broker do when I sell?',
      }),
      route: '/guides/selling-a-flat',
    });

    expect(second.ok).toBe(false);
    expect(second.ok === false && second.conflictingRoute).toBe('/guides/selling-a-flat');
  });

  it('permits at most five supporting phrases on a page', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map((token) => `${token} phrase about selling`);
    const accepted = assignPrimaryIntent([], {
      entry,
      route: '/guides/selling-a-flat',
      supportingPhrases: five,
    });
    expect(accepted.ok).toBe(true);
    expect(five).toHaveLength(MAX_SUPPORTING_PHRASES_PER_PAGE);

    const rejected = assignPrimaryIntent([], {
      entry,
      route: '/guides/selling-a-flat',
      supportingPhrases: [...five, 'f phrase about selling'],
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.ok === false && rejected.error).toContain('at most 5');
  });

  it('rejects an entry that is held out of editorial use, naming the missing fields', () => {
    const result = assignPrimaryIntent([], {
      entry: completeEntry({ entryId: 'SIE-0103', primaryIntentQuestion: '' }),
      route: '/guides/selling-a-flat',
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toContain('primaryIntentQuestion');
      expect(result.conflictingRoute).toBeNull();
      expect(result.recordStaysUnpublished).toBe(true);
    }
  });

  it('rejects a supporting-role entry as a route primary intent', () => {
    const result = assignPrimaryIntent([], {
      entry: completeEntry({ entryId: 'SIE-0104', role: 'supporting' }),
      route: '/guides/selling-a-flat',
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('supporting');
  });

  it('assigns no page to a superlative broker phrase', () => {
    const result = assignPrimaryIntent([], {
      entry: completeEntry({
        entryId: 'SIE-0105',
        phrase: 'best real estate broker in bengaluru',
      }),
      route: '/guides/selling-a-flat',
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('research query only');
  });

  it('rejects a superlative supporting phrase', () => {
    const result = assignPrimaryIntent([], {
      entry,
      route: '/guides/selling-a-flat',
      supportingPhrases: ['top broker bengaluru'],
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('superlative');
  });

  it('serves distinct intents from distinct routes without complaint', () => {
    const first = assignPrimaryIntent([], { entry, route: '/guides/selling-a-flat' });
    const existing: readonly IntentAssignment[] = first.ok === true ? first.assignments : [];
    const second = assignPrimaryIntent(existing, {
      entry: completeEntry({
        entryId: 'SIE-0106',
        phrase: 'how to rent out a flat in bengaluru',
        primaryIntentQuestion: 'How do I rent out my flat in Bengaluru?',
      }),
      route: '/guides/renting-out-a-flat',
    });
    expect(second.ok).toBe(true);
    expect(second.ok === true && second.assignments).toHaveLength(2);
  });
});
