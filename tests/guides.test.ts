import { describe, expect, it } from 'vitest';
import {
  GUIDE_REGISTRY,
  HEADING_INTENT_PROVENANCE_GAP,
  MAX_DIRECT_ANSWER_WORDS,
  MAX_HEADING_WORDS,
  MIN_DIRECT_ANSWER_WORDS,
  MIN_GUIDE_SECTIONS,
  evaluateGuide,
  getPublishedGuideBySlug,
  getPublishedGuides,
  getPublishedGuidesForIntent,
  isGuidePublishable,
  type GuideRecord,
} from '@/config/guides';
import { classifyGuideContent } from '@/config/guide-classification';
import { countWords } from '@/lib/text-metrics';

const NOW = new Date('2026-09-29T00:00:00.000Z');

/**
 * A direct answer inside the 20-to-60-word band, so length is not the variable.
 *
 * Deliberately free of every `EXTERNAL_FACT_LEXICON` word, which is less obvious
 * than it sounds: the first draft of this string ended "something a reader could act
 * on", and the lexicon matches a standalone `act` because that is how "the Act"
 * appears in a sentence about statute. Every test below would then have been
 * measuring the classifier condition instead of the one it names.
 */
const VALID_DIRECT_ANSWER =
  'A direct answer written at a length the gate accepts, which means more than twenty words and fewer than sixty, and which tells a reader what to do next without scrolling past supporting detail.';

/**
 * A gate-ready own-process guide.
 *
 * Every field is set to a value the gate accepts, so a test that changes one field
 * is testing that one condition. Two sections rather than one, because
 * Requirement 4.12 now needs two; question headings, because Requirement 5.4 now
 * needs them; a named maintenance owner and a live review date, because
 * Requirement 4.10 now needs both.
 */
function guide(overrides: Partial<GuideRecord> = {}): GuideRecord {
  return {
    guideId: 'GD-TEST',
    slug: 'test-guide',
    question: 'A real question?',
    title: 'A real question',
    description: 'A description.',
    intent: 'buy',
    contentClass: 'own-process',
    directAnswer: VALID_DIRECT_ANSWER,
    sections: [
      { heading: 'What happens first?', headingIntentEntryId: null, paragraphs: ['Body.'] },
      { heading: 'What happens next?', headingIntentEntryId: null, paragraphs: ['More body.'] },
    ],
    nextStep: 'Call us.',
    scopeNote: 'Scope.',
    attributedTo: 'INSTLE REAL ESTATE',
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: '2026-09-29',
    publicationStatus: 'published',
    relatedGuideIds: [],
    blockingNotes: [],
    maintenanceOwner: 'Utpal Raj KB',
    nextReviewAt: '2027-09-29',
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
    ...overrides,
  };
}

/** A heading of exactly `words` words, ending in a question mark. */
function headingOfWords(words: number): string {
  return `${Array.from({ length: words - 1 }, () => 'word').join(' ')} why?`;
}

describe('evaluateGuide', () => {
  it('publishes an own-process guide attributed to the business', () => {
    expect(evaluateGuide(guide(), NOW).eligible).toBe(true);
  });

  it('blocks a guide with no sections or no direct answer', () => {
    expect(evaluateGuide(guide({ sections: [] }), NOW).eligible).toBe(false);
    expect(evaluateGuide(guide({ directAnswer: '' }), NOW).eligible).toBe(false);
  });

  it('blocks a guide with no content date', () => {
    expect(evaluateGuide(guide({ contentUpdatedAt: null }), NOW).eligible).toBe(false);
  });

  /**
   * External-fact guides carry the higher bar, because they state something about
   * law, tax, documentation or the market rather than about our own process.
   */
  it('requires a named author and subject reviewer for an external-fact guide', () => {
    const result = evaluateGuide(guide({ contentClass: 'external-fact' }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/named author/);
    expect(result.failures.join(' ')).toMatch(/named subject reviewer/);
  });

  it('requires claim-backed sources for an external-fact guide', () => {
    const result = evaluateGuide(
      guide({
        contentClass: 'external-fact',
        namedAuthor: 'A. Author',
        subjectReviewer: 'A. Reviewer',
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/claim-backed sources/);
  });

  it('blocks an external-fact guide whose claims fail the claim gate', () => {
    const result = evaluateGuide(
      guide({
        contentClass: 'external-fact',
        namedAuthor: 'A. Author',
        subjectReviewer: 'A. Reviewer',
        claimIds: ['CLM-IND-WARD-001'],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/CLM-IND-WARD-001/);
  });
});

/**
 * Task 6.2's additions. Each block changes exactly one field of the gate-ready
 * fixture, so a failure names the condition rather than the fixture.
 */
describe('the direct answer word bound', () => {
  it('accepts an answer at each end of the 20-to-60-word band', () => {
    for (const words of [MIN_DIRECT_ANSWER_WORDS, MAX_DIRECT_ANSWER_WORDS]) {
      const answer = Array.from({ length: words }, () => 'word').join(' ');
      expect(countWords(answer)).toBe(words);
      expect(evaluateGuide(guide({ directAnswer: answer }), NOW).eligible, `${words} words`).toBe(
        true
      );
    }
  });

  it('rejects an answer one word outside either end, and reports the measured count', () => {
    for (const words of [MIN_DIRECT_ANSWER_WORDS - 1, MAX_DIRECT_ANSWER_WORDS + 1]) {
      const answer = Array.from({ length: words }, () => 'word').join(' ');
      const result = evaluateGuide(guide({ directAnswer: answer }), NOW);
      expect(result.eligible, `${words} words`).toBe(false);
      // Requirement 5.11 asks for the measured count by name, not a bare verdict.
      expect(result.failures.join(' ')).toContain(`Direct answer is ${words} words`);
    }
  });
});

describe('section count and heading form', () => {
  it(`rejects a guide with fewer than ${MIN_GUIDE_SECTIONS} sections`, () => {
    const result = evaluateGuide(
      guide({
        sections: [{ heading: 'Only one?', headingIntentEntryId: null, paragraphs: ['Body.'] }],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/carries 1 content section/);
  });

  it('rejects a heading that is not phrased as a question', () => {
    const result = evaluateGuide(
      guide({
        sections: [
          { heading: 'Rent and deposit', headingIntentEntryId: null, paragraphs: ['Body.'] },
          { heading: 'What next?', headingIntentEntryId: null, paragraphs: ['Body.'] },
        ],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toContain('"Rent and deposit" is not phrased as a question');
  });

  it(`accepts a heading of exactly ${MAX_HEADING_WORDS} words and rejects one more`, () => {
    const atBound = headingOfWords(MAX_HEADING_WORDS);
    const overBound = headingOfWords(MAX_HEADING_WORDS + 1);
    expect(countWords(atBound)).toBe(MAX_HEADING_WORDS);

    const sections = (heading: string) => [
      { heading, headingIntentEntryId: null, paragraphs: ['Body.'] },
      { heading: 'What next?', headingIntentEntryId: null, paragraphs: ['Body.'] },
    ];

    expect(evaluateGuide(guide({ sections: sections(atBound) }), NOW).eligible).toBe(true);
    const over = evaluateGuide(guide({ sections: sections(overBound) }), NOW);
    expect(over.eligible).toBe(false);
    expect(over.failures.join(' ')).toContain(`is ${MAX_HEADING_WORDS + 1} words`);
  });
});

/**
 * Requirement 5.4's provenance half, and the gap it currently sits in.
 *
 * The condition binds a record that carries an approved primary intent phrase,
 * because that is the only in-app evidence that a Search_Intent_Register entry
 * exists at all. The register holds zero entries today — no keyword research tool
 * has been supplied, which is Owner_Input_Register C13 — so no published guide can
 * name one, and inventing an entry would mean inventing an observation date for
 * research nobody performed.
 *
 * What these tests pin down is that the condition is real rather than decorative:
 * the moment a record carries a phrase, every heading on it must cite one.
 */
describe('heading provenance', () => {
  it('records the gap and names the checklist entry that unblocks it', () => {
    expect(HEADING_INTENT_PROVENANCE_GAP.requirement).toBe('5.4');
    expect(HEADING_INTENT_PROVENANCE_GAP.ownerInputEntry).toBe('C13');
    expect(HEADING_INTENT_PROVENANCE_GAP.whyNotYetUniversal).toMatch(/zero entries/);
    expect(HEADING_INTENT_PROVENANCE_GAP.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not bind a record with no approved phrase, because there is nothing to cite', () => {
    expect(evaluateGuide(guide({ primaryIntent: null }), NOW).eligible).toBe(true);
  });

  it('binds every heading the moment the record carries an approved phrase', () => {
    const withPhrase = guide({
      primaryIntent: { intentEntryId: 'SIE-001', phrase: 'sell my flat in bengaluru' },
    });
    const result = evaluateGuide(withPhrase, NOW);
    expect(result.eligible).toBe(false);
    // Both headings, not just the first.
    expect(
      result.failures.filter((failure) => failure.includes('names no Search_Intent_Register entry'))
    ).toHaveLength(2);
    expect(result.failures.join(' ')).toContain('SIE-001');
  });

  it('accepts the same record once every heading cites an entry', () => {
    const cited = guide({
      primaryIntent: { intentEntryId: 'SIE-001', phrase: 'sell my flat in bengaluru' },
      sections: [
        { heading: 'What happens first?', headingIntentEntryId: 'SIE-001', paragraphs: ['Body.'] },
        { heading: 'What happens next?', headingIntentEntryId: 'SIE-002', paragraphs: ['Body.'] },
      ],
    });
    expect(evaluateGuide(cited, NOW).eligible).toBe(true);
  });

  it('treats a blank entry id as absent', () => {
    const blank = guide({
      primaryIntent: { intentEntryId: 'SIE-001', phrase: 'a phrase' },
      sections: [
        { heading: 'What happens first?', headingIntentEntryId: '   ', paragraphs: ['Body.'] },
        { heading: 'What happens next?', headingIntentEntryId: 'SIE-002', paragraphs: ['Body.'] },
      ],
    });
    expect(evaluateGuide(blank, NOW).eligible).toBe(false);
  });
});

describe('maintenance owner and review date', () => {
  it('rejects a guide with no named maintenance owner', () => {
    const result = evaluateGuide(guide({ maintenanceOwner: null }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toContain('No named maintenance owner recorded.');
  });

  it('rejects a desk name as a maintenance owner, case and padding included', () => {
    for (const name of ['Research Desk', '  editorial desk  ', 'TBD']) {
      const result = evaluateGuide(guide({ maintenanceOwner: name }), NOW);
      expect(result.eligible, name).toBe(false);
      expect(result.failures.join(' ')).toMatch(/not a real named person/);
    }
  });

  it('rejects a guide with no next review date', () => {
    const result = evaluateGuide(guide({ nextReviewAt: null }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toContain('No next review date recorded.');
  });

  it('rejects a review date that has passed', () => {
    const result = evaluateGuide(
      guide({ contentUpdatedAt: '2025-06-01', nextReviewAt: '2026-06-01' }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/review was due on 2026-06-01/);
  });

  /** Twelve months counted as months, so the boundary day is the same day number. */
  it('accepts twelve months to the day and rejects a day more', () => {
    expect(
      evaluateGuide(guide({ contentUpdatedAt: '2026-09-29', nextReviewAt: '2027-09-29' }), NOW)
        .eligible
    ).toBe(true);

    const over = evaluateGuide(
      guide({ contentUpdatedAt: '2026-09-29', nextReviewAt: '2027-09-30' }),
      NOW
    );
    expect(over.eligible).toBe(false);
    expect(over.failures.join(' ')).toMatch(/more than 12 months after the content date/);
  });

  it('rejects a malformed review date rather than reading it as a date', () => {
    const result = evaluateGuide(guide({ nextReviewAt: '2027-02-30' }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/is not a calendar date/);
  });
});

describe('next step and scope note', () => {
  it('rejects an empty next step or an empty scope note', () => {
    expect(evaluateGuide(guide({ nextStep: '   ' }), NOW).failures.join(' ')).toContain(
      'no next step'
    );
    expect(evaluateGuide(guide({ scopeNote: '' }), NOW).failures.join(' ')).toContain(
      'no scope note'
    );
  });
});

describe('the classifier contradicting the stored class', () => {
  it('rejects an own-process record whose own text states an external fact', () => {
    const record = guide({
      sections: [
        {
          heading: 'What paperwork applies?',
          headingIntentEntryId: null,
          paragraphs: ['A sale deed is registered at the sub-registrar office.'],
        },
        { heading: 'What next?', headingIntentEntryId: null, paragraphs: ['Body.'] },
      ],
    });
    expect(classifyGuideContent(record)).toBe('external-fact');

    const result = evaluateGuide(record, NOW);
    expect(result.eligible).toBe(false);
    const joined = result.failures.join(' ');
    // The verdict, and the text that produced it, so the failure is arguable.
    expect(joined).toContain('the classifier reads the record\'s own text as "external-fact"');
    expect(joined).toMatch(/sale deed|sub-registrar/);
  });

  it('still admits a record whose scope note denies stating external facts', () => {
    const record = guide({ scopeNote: 'This is not legal, tax or financial advice.' });
    expect(classifyGuideContent(record)).toBe('own-process');
    expect(evaluateGuide(record, NOW).eligible).toBe(true);
  });
});

describe('a figure set by an external body', () => {
  it('rejects a percentage, a rupee amount and a statutory section with no claim', () => {
    const cases: readonly [string, string][] = [
      ['percentage', 'Stamp duty is charged at 5% of the consideration.'],
      ['rupee amount', 'The registration charge is Rs. 25,000.'],
      ['statutory section number', 'Relief is available under section 54 of the statute.'],
    ];
    for (const [name, paragraph] of cases) {
      const result = evaluateGuide(
        guide({
          sections: [
            { heading: 'What applies?', headingIntentEntryId: null, paragraphs: [paragraph] },
            { heading: 'What next?', headingIntentEntryId: null, paragraphs: ['Body.'] },
          ],
        }),
        NOW
      );
      expect(result.eligible, name).toBe(false);
      expect(result.failures.join(' '), name).toContain('figure set by an external body');
    }
  });

  /**
   * The condition has to leave honest copy alone or it becomes noise. "five things"
   * counts the page's own list and "within 30 days" is the reader's own timeline;
   * neither is a figure an external body set.
   */
  it('leaves a counted list and a customer timeline alone', () => {
    const record = guide({
      directAnswer: VALID_DIRECT_ANSWER,
      sections: [
        {
          heading: 'What do we ask for?',
          headingIntentEntryId: null,
          paragraphs: [
            'We need five things, and if your target is within 30 days we will say whether that is realistic.',
          ],
        },
        { heading: 'What next?', headingIntentEntryId: null, paragraphs: ['Body.'] },
      ],
    });
    expect(evaluateGuide(record, NOW).eligible).toBe(true);
  });
});

describe('the live guide registry', () => {
  const published = getPublishedGuides(NOW);

  it('publishes only own-process guides right now', () => {
    expect(published.length).toBeGreaterThan(0);
    for (const record of published) {
      expect(record.contentClass).toBe('own-process');
    }
  });

  it('keeps every legal, tax, documentation and fee topic unpublished', () => {
    const blocked = GUIDE_REGISTRY.filter((record) => !isGuidePublishable(record, NOW));
    const blockedSlugs = blocked.map((record) => record.slug);
    expect(blockedSlugs).toContain('property-documents-to-check-before-buying-in-bengaluru');
    expect(blockedSlugs).toContain('taxes-and-charges-when-selling-property-in-bengaluru');
    expect(blockedSlugs).toContain('how-brokerage-fees-work');
    expect(blockedSlugs).toContain('what-to-consider-when-leasing-office-space-in-bengaluru');
  });

  it('records why each unpublished guide is blocked', () => {
    for (const record of GUIDE_REGISTRY) {
      if (!isGuidePublishable(record, NOW)) {
        expect(record.blockingNotes.length, `${record.slug} must say why`).toBeGreaterThan(0);
      }
    }
  });

  it('never exposes an unpublished guide through the by-slug lookup', () => {
    expect(getPublishedGuideBySlug('how-brokerage-fees-work', NOW)).toBeUndefined();
    expect(getPublishedGuideBySlug('not-a-guide', NOW)).toBeUndefined();
  });

  it('answers the 30-day question without making a promise', () => {
    const answer = getPublishedGuideBySlug('can-a-broker-guarantee-a-property-sale-in-30-days', NOW);
    expect(answer).toBeTruthy();
    expect(answer!.directAnswer).toMatch(/^No\./);
    const fullText = [answer!.directAnswer, ...answer!.sections.flatMap((s) => s.paragraphs)].join(' ');
    expect(fullText).not.toMatch(/we guarantee/i);
  });

  it('gives each published guide a distinct question and slug', () => {
    const questions = published.map((record) => record.question);
    const slugs = published.map((record) => record.slug);
    expect(new Set(questions).size).toBe(questions.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('gives each published guide a next step and a scope note', () => {
    for (const record of published) {
      expect(record.nextStep.length).toBeGreaterThan(10);
      expect(record.scopeNote.length).toBeGreaterThan(10);
    }
  });

  it('filters by intent', () => {
    expect(getPublishedGuidesForIntent('sell', NOW).length).toBeGreaterThan(0);
    for (const record of getPublishedGuidesForIntent('sell', NOW)) {
      expect(record.intent).toBe('sell');
    }
  });

  it('links only to publishable related guides', () => {
    const publishedIds = new Set(published.map((record) => record.guideId));
    for (const record of published) {
      for (const relatedId of record.relatedGuideIds) {
        expect(publishedIds.has(relatedId), `${record.slug} -> ${relatedId}`).toBe(true);
      }
    }
  });
});

/**
 * Task 6.3, stated as assertions rather than as a claim in a commit message.
 *
 * The three published guides are the same three as before task 6. They stayed
 * published because their copy was edited to satisfy the new conditions — not
 * because any condition was scoped down, and not because any record was exempted.
 */
describe('the three published guides under the new conditions', () => {
  const published = getPublishedGuides(NOW);

  it('still publishes exactly three guides', () => {
    expect(published.map((record) => record.slug).sort()).toEqual([
      'can-a-broker-guarantee-a-property-sale-in-30-days',
      'decisions-to-make-before-you-rent-out-your-property',
      'what-to-tell-us-when-you-want-to-sell-your-property',
    ]);
  });

  it('gives every one a direct answer inside the 20-to-60-word band', () => {
    for (const record of published) {
      const words = countWords(record.directAnswer);
      expect(words, `${record.slug} measured ${words}`).toBeGreaterThanOrEqual(
        MIN_DIRECT_ANSWER_WORDS
      );
      expect(words, `${record.slug} measured ${words}`).toBeLessThanOrEqual(
        MAX_DIRECT_ANSWER_WORDS
      );
    }
  });

  it('phrases every heading as a question of at most fifteen words', () => {
    for (const record of published) {
      expect(record.sections.length).toBeGreaterThanOrEqual(MIN_GUIDE_SECTIONS);
      for (const section of record.sections) {
        expect(section.heading.trim().endsWith('?'), `${record.slug}: ${section.heading}`).toBe(
          true
        );
        expect(countWords(section.heading), `${record.slug}: ${section.heading}`).toBeLessThanOrEqual(
          MAX_HEADING_WORDS
        );
      }
    }
  });

  it('names a maintenance owner and a live review date on every one', () => {
    for (const record of published) {
      expect(record.maintenanceOwner, record.slug).toBe('Utpal Raj KB');
      expect(record.nextReviewAt, record.slug).toBe('2027-09-29');
    }
  });

  /**
   * The heading provenance gap, seen from the live registry. Every heading cites
   * nothing, because there is nothing to cite, and the records carry no approved
   * phrase — so the condition is inert rather than evaded.
   */
  it('cites no register entry anywhere, and carries no approved phrase either', () => {
    for (const record of published) {
      expect(record.primaryIntent, record.slug).toBeNull();
      for (const section of record.sections) {
        expect(section.headingIntentEntryId, `${record.slug}: ${section.heading}`).toBeNull();
      }
    }
  });

  it('agrees with the classifier on every published record', () => {
    for (const record of published) {
      expect(classifyGuideContent(record), record.slug).toBe(record.contentClass);
      expect(record.contentClass, record.slug).toBe('own-process');
    }
  });

  /**
   * Requirement 4.4. An own-process guide publishes attributed to the business with
   * no named individual author, and the route emits no `Article` node — checked here
   * on the data and in `tests/structured-data.test.ts` on the emitted graph.
   */
  it('publishes attributed to the business with no named author', () => {
    for (const record of published) {
      expect(record.attributedTo, record.slug).toBe('INSTLE REAL ESTATE');
      expect(record.namedAuthor, record.slug).toBeNull();
      expect(record.subjectReviewer, record.slug).toBeNull();
    }
  });

  /** The four owner-blocked slugs, each against the checklist entry that unblocks it. */
  it('keeps each owner-blocked guide blocked against a named checklist entry', () => {
    const expectations: readonly [string, string][] = [
      ['property-documents-to-check-before-buying-in-bengaluru', 'C3'],
      ['taxes-and-charges-when-selling-property-in-bengaluru', 'C3'],
      ['how-brokerage-fees-work', 'C5'],
      ['what-to-consider-when-leasing-office-space-in-bengaluru', 'C4'],
    ];
    for (const [slug, checklistEntry] of expectations) {
      const record = GUIDE_REGISTRY.find((candidate) => candidate.slug === slug);
      expect(record, slug).toBeDefined();
      expect(isGuidePublishable(record!, NOW), slug).toBe(false);
      expect(record!.blockingNotes.join(' '), slug).toContain(`checklist ${checklistEntry}`);
    }
  });
});
