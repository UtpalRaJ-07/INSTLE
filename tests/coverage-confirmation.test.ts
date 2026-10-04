import { describe, expect, it } from 'vitest';

import {
  COVERAGE_CHECKLIST_ENTRY,
  RECORDED_COVERAGE_ANSWERS,
  REVIEWER_BLOCKED_MAX_STATUS,
  REVIEWER_CHECKLIST_ENTRY,
  applyRecordedCoverageAnswers,
  confirmCoverageFromRegister,
  publishWhenReviewersApproved,
  validateCoverageAnswer,
  type CoverageRegisterAnswer,
} from '@/config/coverage-confirmation';
import { LOCALITY_REGISTRY, evaluateLocality, type LocalityRecord } from '@/config/localities';
import { MIN_SECTION_WORDS } from '@/config/locality-sections';

/**
 * The coverage confirmation path (task 17.3, Requirements 1.13 and 11.4).
 *
 * Two things are asserted here, and they are not the same thing:
 *
 *  1. **The path confirms nothing today.** Zero answers are recorded under
 *     C1 / OWN-03, every one of the 132 records carries `unconfirmed` coverage and a
 *     null accountable person, and applying the live answer list returns the registry
 *     record for record. The mechanism is built and switched off.
 *  2. **A recorded answer flows into the existing gate with no other change.** A
 *     served answer naming an accountable person, on a record that already satisfies
 *     every other gate condition, publishes. The same answer on a record whose
 *     reviewers are unrecorded publishes nothing and names C2 / OWN-14.
 *
 * Nothing below lowers a gate condition. `publishWhenReviewersApproved` is asserted
 * against `evaluateLocality`, the shared gate, so the test cannot pass by agreeing
 * with a second visibility rule.
 */

const NOW = new Date('2026-09-29T00:00:00.000Z');

function paragraphOfWords(words: number, seed: string): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
}

/**
 * A record that satisfies every publication gate condition **except** coverage: the
 * three distinct reviewers are named, the approval dates are in order, the review
 * window is open, and two sections carry the minimum depth with different text.
 *
 * Coverage is left exactly as a seeded record carries it — `unconfirmed`, with no
 * accountable person — so a test that publishes this record can only have done so
 * through the coverage answer.
 */
function coverageOnlyBlocked(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: 'LOC-COVERAGE-FIXTURE',
    canonicalName: 'Coverage Fixture',
    aliases: [],
    entityType: 'locality',
    slug: 'coverage-fixture',
    marketingGroup: 'Test Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,
    summary: 'A summary that states no external facts.',
    summaryClaimIds: [],
    sections: [
      {
        sectionId: 'process',
        heading: 'What to discuss when buying here',
        paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'process')],
        claimIds: [],
      },
      {
        sectionId: 'papers',
        heading: 'What to have ready before the first call',
        paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'papers')],
        claimIds: [],
      },
    ],
    approvedFaq: [],
    approvedNearbyRelationships: [],
    relatedGuideIds: [],
    postalMappingIds: [],
    imageRightsRecords: [],
    author: 'A. Named Author',
    localReviewer: 'A. Named Local Reviewer',
    seoReviewer: 'A. Named SEO Reviewer',
    editorialApprovedAt: '2026-09-20',
    localReviewApprovedAt: '2026-09-20',
    seoReviewApprovedAt: '2026-09-20',
    sourceCheckedAt: '2026-09-20',
    nextReviewAt: '2027-03-20',
    contentUpdatedAt: '2026-09-20',
    editorialStatus: 'approved',
    publicationStatus: 'unpublished',
    blockingNotes: [],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
    ...overrides,
  };
}

/** The same record with no reviewer recorded, which is the true state under C2. */
function reviewersUnsupplied(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return coverageOnlyBlocked({
    author: null,
    localReviewer: null,
    seoReviewer: null,
    editorialApprovedAt: null,
    localReviewApprovedAt: null,
    seoReviewApprovedAt: null,
    editorialStatus: 'draft',
    ...overrides,
  });
}

function servedAnswer(overrides: Partial<CoverageRegisterAnswer> = {}): CoverageRegisterAnswer {
  return {
    entityId: 'LOC-COVERAGE-FIXTURE',
    areaNameAsRecorded: 'Coverage Fixture',
    served: true,
    accountablePerson: 'A. Named Accountable Person',
    recordedOn: '2026-09-25',
    checklistEntry: COVERAGE_CHECKLIST_ENTRY,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Switched off
// ---------------------------------------------------------------------------

describe('the coverage path is switched off (Requirement 1.13)', () => {
  it('names the checklist entries that unblock it', () => {
    expect(COVERAGE_CHECKLIST_ENTRY).toBe('C1 / OWN-03');
    expect(REVIEWER_CHECKLIST_ENTRY).toBe('C2 / OWN-14');
    expect(REVIEWER_BLOCKED_MAX_STATUS).toBe('fact_review');
  });

  it('holds no recorded answer', () => {
    expect(RECORDED_COVERAGE_ANSWERS).toEqual([]);
  });

  it('leaves every one of the 132 records unconfirmed with no accountable person', () => {
    expect(LOCALITY_REGISTRY).toHaveLength(132);
    for (const record of LOCALITY_REGISTRY) {
      expect(record.actualServiceCoverage, record.entityId).toBe('unconfirmed');
      expect(record.coverageResponsibleOwner, record.entityId).toBeNull();
    }
  });

  it('returns the registry record for record when the live answer list is applied', () => {
    const report = applyRecordedCoverageAnswers(LOCALITY_REGISTRY);

    expect(report.applied).toEqual([]);
    expect(report.rejected).toEqual([]);
    expect(report.unmatchedAnswers).toEqual([]);
    expect(report.blockingChecklistEntries).toEqual([]);
    expect(report.records).toHaveLength(LOCALITY_REGISTRY.length);
    for (const [index, record] of report.records.entries()) {
      expect(record, record.entityId).toBe(LOCALITY_REGISTRY[index]);
    }
  });

  it('publishes nothing through the gate while no answer is recorded', () => {
    const published = applyRecordedCoverageAnswers(LOCALITY_REGISTRY).records.filter(
      (record) => evaluateLocality(record, NOW).eligible
    );
    expect(published).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// A recorded answer, and what it is allowed to move
// ---------------------------------------------------------------------------

describe('a recorded coverage answer (Requirement 1.13)', () => {
  it('sets confirmed-served coverage and the named accountable person', () => {
    const outcome = confirmCoverageFromRegister(coverageOnlyBlocked(), servedAnswer());

    expect(outcome.applied).toBe(true);
    expect(outcome.failures).toEqual([]);
    expect(outcome.record.actualServiceCoverage).toBe('confirmed-served');
    expect(outcome.record.coverageResponsibleOwner).toBe('A. Named Accountable Person');
  });

  it('leaves publicationStatus at unpublished, so confirming coverage is not a release', () => {
    const outcome = confirmCoverageFromRegister(coverageOnlyBlocked(), servedAnswer());
    expect(outcome.record.publicationStatus).toBe('unpublished');
  });

  it('changes nothing else on the record', () => {
    const before = coverageOnlyBlocked();
    const after = confirmCoverageFromRegister(before, servedAnswer()).record;

    const { actualServiceCoverage, coverageResponsibleOwner, blockingNotes, ...restAfter } = after;
    const {
      actualServiceCoverage: _coverage,
      coverageResponsibleOwner: _owner,
      blockingNotes: _notes,
      ...restBefore
    } = before;
    expect(restAfter).toStrictEqual(restBefore);
  });

  it('records the confirmation against the checklist entry it came from', () => {
    const outcome = confirmCoverageFromRegister(coverageOnlyBlocked(), servedAnswer());
    expect(outcome.record.blockingNotes.join(' ')).toContain(COVERAGE_CHECKLIST_ENTRY);
    expect(outcome.record.blockingNotes.join(' ')).toContain('A. Named Accountable Person');
  });

  it('applies the same answer twice without duplicating the note', () => {
    const once = confirmCoverageFromRegister(coverageOnlyBlocked(), servedAnswer()).record;
    const twice = confirmCoverageFromRegister(once, servedAnswer()).record;
    expect(twice.blockingNotes).toEqual(once.blockingNotes);
  });

  it('records a not-served answer as not-served, with no accountable person', () => {
    const outcome = confirmCoverageFromRegister(
      coverageOnlyBlocked(),
      servedAnswer({ served: false, accountablePerson: null })
    );

    expect(outcome.applied).toBe(true);
    expect(outcome.record.actualServiceCoverage).toBe('not-served');
    expect(outcome.record.coverageResponsibleOwner).toBeNull();
    expect(outcome.record.publicationStatus).toBe('unpublished');
    expect(evaluateLocality(outcome.record, NOW).eligible).toBe(false);
  });
});

describe('an answer that is not evidence is rejected (Requirement 1.13)', () => {
  it.each<[string, Partial<CoverageRegisterAnswer>]>([
    ['an unnamed accountable person', { accountablePerson: null }],
    ['a desk name rather than a person', { accountablePerson: 'Research Desk' }],
    ['a desk name in another letter case', { accountablePerson: '  EDITORIAL DESK  ' }],
    ['a placeholder', { accountablePerson: 'TBD' }],
    ['a name too short to identify anyone', { accountablePerson: 'AB' }],
    ['no register entry', { checklistEntry: '' }],
    ['the wrong register entry', { checklistEntry: 'C12' }],
    ['no record named', { entityId: '' }],
    ['no area name', { areaNameAsRecorded: '  ' }],
    ['no date', { recordedOn: 'last week' }],
  ])('rejects %s', (_label, overrides) => {
    const answer = servedAnswer(overrides);
    expect(validateCoverageAnswer(answer).ok).toBe(false);

    const outcome = confirmCoverageFromRegister(coverageOnlyBlocked(), answer);
    expect(outcome.applied).toBe(false);
    expect(outcome.failures.length).toBeGreaterThan(0);
    expect(outcome.record.actualServiceCoverage).toBe('unconfirmed');
    expect(outcome.record.coverageResponsibleOwner).toBeNull();
    expect(outcome.blockingChecklistEntries).toContain(COVERAGE_CHECKLIST_ENTRY);
  });

  it('rejects an answer recorded against another record', () => {
    const outcome = confirmCoverageFromRegister(
      coverageOnlyBlocked(),
      servedAnswer({ entityId: 'LOC-SOMEWHERE-ELSE' })
    );
    expect(outcome.applied).toBe(false);
    expect(outcome.record.actualServiceCoverage).toBe('unconfirmed');
    expect(outcome.failures.join(' ')).toContain('LOC-SOMEWHERE-ELSE');
  });

  it('reports an answer naming a record the registry does not hold', () => {
    const report = applyRecordedCoverageAnswers([coverageOnlyBlocked()], [
      servedAnswer({ entityId: 'LOC-NOT-IN-REGISTRY', areaNameAsRecorded: 'Nowhere' }),
    ]);
    expect(report.applied).toEqual([]);
    expect(report.unmatchedAnswers.join(' ')).toContain('LOC-NOT-IN-REGISTRY');
  });
});

// ---------------------------------------------------------------------------
// The two fixture cases the task asks for
// ---------------------------------------------------------------------------

describe('confirmed coverage plus every other gate condition publishes (Requirement 1.13)', () => {
  it('publishes the record, and the shared gate agrees', () => {
    const confirmed = confirmCoverageFromRegister(coverageOnlyBlocked(), servedAnswer()).record;
    const attempt = publishWhenReviewersApproved(confirmed, NOW);

    expect(attempt.failures).toEqual([]);
    expect(attempt.published).toBe(true);
    expect(attempt.blockingChecklistEntries).toEqual([]);
    expect(attempt.record.publicationStatus).toBe('published');
    expect(evaluateLocality(attempt.record, NOW).eligible).toBe(true);
  });

  it('is the coverage answer that moved it: the same record without the answer fails', () => {
    const withoutAnswer = coverageOnlyBlocked();
    expect(evaluateLocality({ ...withoutAnswer, publicationStatus: 'published' }, NOW).eligible).toBe(
      false
    );
    expect(publishWhenReviewersApproved(withoutAnswer, NOW).published).toBe(false);
  });
});

describe('coverage alone does not publish (Requirements 1.13 and 11.4)', () => {
  it('holds the record unpublished and names C2 / OWN-14 while the reviewers are unsupplied', () => {
    const outcome = confirmCoverageFromRegister(reviewersUnsupplied(), servedAnswer());

    expect(outcome.applied).toBe(true);
    expect(outcome.record.actualServiceCoverage).toBe('confirmed-served');
    expect(outcome.record.publicationStatus).toBe('unpublished');
    expect(outcome.blockingChecklistEntries).toEqual([REVIEWER_CHECKLIST_ENTRY]);
    expect(outcome.publicationHold).toContain(REVIEWER_CHECKLIST_ENTRY);
    expect(outcome.record.blockingNotes.join(' ')).toContain(REVIEWER_CHECKLIST_ENTRY);
  });

  it('holds the record at or before fact review (Requirement 11.4)', () => {
    for (const status of ['editorial_review', 'seo_review', 'approved'] as const) {
      const outcome = confirmCoverageFromRegister(
        reviewersUnsupplied({ editorialStatus: status }),
        servedAnswer()
      );
      expect(outcome.record.editorialStatus, status).toBe(REVIEWER_BLOCKED_MAX_STATUS);
    }
  });

  it('leaves a record earlier than fact review where it is', () => {
    for (const status of ['candidate', 'research', 'draft', 'fact_review'] as const) {
      const outcome = confirmCoverageFromRegister(
        reviewersUnsupplied({ editorialStatus: status }),
        servedAnswer()
      );
      expect(outcome.record.editorialStatus, status).toBe(status);
    }
  });

  it('refuses publication, and the shared gate refuses with it', () => {
    const confirmed = confirmCoverageFromRegister(reviewersUnsupplied(), servedAnswer()).record;
    const attempt = publishWhenReviewersApproved(confirmed, NOW);

    expect(attempt.published).toBe(false);
    expect(attempt.record.publicationStatus).toBe('unpublished');
    expect(attempt.blockingChecklistEntries).toEqual([REVIEWER_CHECKLIST_ENTRY]);
    expect(evaluateLocality({ ...confirmed, publicationStatus: 'published' }, NOW).eligible).toBe(
      false
    );
  });

  it('refuses publication for every other single gate condition left unmet', () => {
    const cases: readonly (readonly [string, Partial<LocalityRecord>])[] = [
      ['the review window has closed', { nextReviewAt: '2026-01-01' }],
      ['no review date is recorded', { nextReviewAt: null }],
      ['the record has not reached the approved state', { editorialStatus: 'seo_review' }],
      ['a section is missing', { sections: [] }],
      [
        'two reviewers are the same person',
        { localReviewer: 'A. Named Author', seoReviewer: 'A. Named Author' },
      ],
    ];

    for (const [label, overrides] of cases) {
      const confirmed = confirmCoverageFromRegister(
        coverageOnlyBlocked(overrides),
        servedAnswer()
      ).record;
      const attempt = publishWhenReviewersApproved(confirmed, NOW);
      expect(attempt.published, label).toBe(false);
      expect(attempt.record.publicationStatus, label).toBe('unpublished');
      expect(attempt.failures.length, label).toBeGreaterThan(0);
    }
  });

  it('never moves a record into the approved state as a side effect of publishing', () => {
    const confirmed = confirmCoverageFromRegister(
      coverageOnlyBlocked({ editorialStatus: 'seo_review' }),
      servedAnswer()
    ).record;
    const attempt = publishWhenReviewersApproved(confirmed, NOW);
    expect(attempt.record.editorialStatus).toBe('seo_review');
  });
});
