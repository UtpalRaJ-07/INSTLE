import { describe, expect, it } from 'vitest';

import { NON_ATTRIBUTABLE_REVIEWER_NAMES } from '@/config/claims';
import {
  EDITORIAL_SIGN_OFF_FIELD,
  FIRST_BATCH_SIZE,
  LATER_BATCH_SIZE,
  SOURCE_CHECK_MAX_DAYS,
  WORKFLOW_SEQUENCE,
  batchSizeBand,
  deriveWorkflowState,
  transition,
  validateApprovalSignOff,
  validateBatch,
  validateReviewWindow,
  type BatchUnderReview,
  type WorkflowState,
} from '@/config/editorial-workflow';
import { LOCALITY_REGISTRY, type EditorialStatus, type LocalityRecord } from '@/config/localities';

/**
 * The editorial workflow.
 *
 * The transition table is tested exhaustively — all 64 ordered pairs — rather than
 * by sampling, because the rule is small enough to enumerate and the interesting
 * failures are the near misses: `draft` to `editorial_review` skips a state,
 * `approved` to `approved` is not a move, and every backward step is legitimate
 * rework.
 *
 * Sign-off distinctness is tested against padded and case-varied near-duplicates
 * as well as desk names, because those are the two ways the previous
 * implementation's "INSTLE Research & Advisory Desk" sign-off could come back.
 */

const BASE_RECORD = LOCALITY_REGISTRY[0];

function recordWith(overrides: Partial<LocalityRecord>): LocalityRecord {
  return { ...BASE_RECORD, ...overrides };
}

const APPROVED_RECORD = recordWith({
  author: 'Utpal Raj KB',
  localReviewer: 'A named local reviewer',
  seoReviewer: 'A named SEO reviewer',
  localReviewApprovedAt: '2026-09-01T00:00:00.000Z',
  editorialApprovedAt: '2026-09-02T00:00:00.000Z',
  seoReviewApprovedAt: '2026-09-03T00:00:00.000Z',
});

describe('the derived eight-state view', () => {
  const editorialStatuses: readonly EditorialStatus[] = [
    'candidate',
    'research',
    'draft',
    'fact_review',
    'editorial_review',
    'seo_review',
    'approved',
  ];

  it('holds exactly eight states in the Requirement 11.1 order', () => {
    expect(WORKFLOW_SEQUENCE).toEqual([
      'candidate',
      'research',
      'draft',
      'fact_review',
      'editorial_review',
      'seo_review',
      'approved',
      'published',
    ]);
  });

  it('derives the state from the two existing status fields', () => {
    for (const editorialStatus of editorialStatuses) {
      expect(deriveWorkflowState({ editorialStatus, publicationStatus: 'unpublished' })).toBe(
        editorialStatus
      );
      expect(deriveWorkflowState({ editorialStatus, publicationStatus: 'published' })).toBe(
        'published'
      );
    }
  });

  it('derives every one of the eight states from some combination', () => {
    const derived = new Set<WorkflowState>();
    for (const editorialStatus of editorialStatuses) {
      derived.add(deriveWorkflowState({ editorialStatus, publicationStatus: 'unpublished' }));
      derived.add(deriveWorkflowState({ editorialStatus, publicationStatus: 'published' }));
    }
    expect([...derived].sort()).toEqual([...WORKFLOW_SEQUENCE].sort());
  });
});

describe('all 64 state-transition pairs', () => {
  const pairs = WORKFLOW_SEQUENCE.flatMap((from) =>
    WORKFLOW_SEQUENCE.map((to) => ({ from, to }))
  );

  it('enumerates every pair', () => {
    expect(pairs).toHaveLength(64);
  });

  for (const { from, to } of WORKFLOW_SEQUENCE.flatMap((from) =>
    WORKFLOW_SEQUENCE.map((to) => ({ from, to }))
  )) {
    const fromIndex = WORKFLOW_SEQUENCE.indexOf(from);
    const toIndex = WORKFLOW_SEQUENCE.indexOf(to);
    const expected = toIndex < fromIndex || toIndex === fromIndex + 1;

    it(`${expected ? 'accepts' : 'rejects'} ${from} → ${to}`, () => {
      const result = transition(from, to);
      expect(result.ok).toBe(expected);
      if (result.ok) {
        expect(result.next).toBe(to);
      } else {
        // Requirement 11.11: the error names the rejected transition.
        expect(result.error).toContain(from);
        expect(result.error).toContain(to);
      }
    });
  }

  it('accepts 35 pairs and rejects 29', () => {
    const accepted = pairs.filter(({ from, to }) => transition(from, to).ok);
    expect(accepted).toHaveLength(35);
    expect(pairs.length - accepted.length).toBe(29);
  });

  it('accepts one step forward and nothing further forward', () => {
    expect(transition('draft', 'fact_review').ok).toBe(true);
    expect(transition('draft', 'editorial_review').ok).toBe(false);
    expect(transition('draft', 'published').ok).toBe(false);
  });

  it('accepts any number of steps back as rework', () => {
    expect(transition('published', 'fact_review').ok).toBe(true);
    expect(transition('approved', 'candidate').ok).toBe(true);
    expect(transition('seo_review', 'draft').ok).toBe(true);
  });

  it('rejects a move to the state the record is already in', () => {
    for (const state of WORKFLOW_SEQUENCE) {
      const result = transition(state, state);
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.error).toContain('already in');
    }
  });

  it('rejects a state name that is not a workflow state', () => {
    const result = transition('draft', 'archived' as WorkflowState);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain('archived');
  });
});

describe('approval sign-off', () => {
  it('accepts three distinct attributable names in the right order', () => {
    expect(validateApprovalSignOff(APPROVED_RECORD)).toEqual({ ok: true, failures: [] });
  });

  it('reads the editorial sign-off from the author field unless one is supplied', () => {
    expect(EDITORIAL_SIGN_OFF_FIELD).toBe('author');
    const validation = validateApprovalSignOff(
      recordWith({ ...APPROVED_RECORD, author: null }),
      'A named editorial approver'
    );
    expect(validation).toEqual({ ok: true, failures: [] });
  });

  it('names each absent sign-off', () => {
    const validation = validateApprovalSignOff(
      recordWith({ ...APPROVED_RECORD, author: null, localReviewer: null, seoReviewer: null })
    );
    expect(validation.ok).toBe(false);
    expect(validation.failures).toContain('No editorial approval name recorded.');
    expect(validation.failures).toContain('No local reviewer name recorded.');
    expect(validation.failures).toContain('No SEO reviewer name recorded.');
  });

  describe('distinctness', () => {
    const variants: readonly { readonly label: string; readonly second: string }[] = [
      { label: 'the same string', second: 'Utpal Raj KB' },
      { label: 'padded with whitespace', second: '   Utpal Raj KB   ' },
      { label: 'upper-cased', second: 'UTPAL RAJ KB' },
      { label: 'lower-cased', second: 'utpal raj kb' },
      { label: 'mixed case and padded', second: '  uTPAL raj KB ' },
    ];

    for (const { label, second } of variants) {
      it(`rejects a second sign-off that is ${label}`, () => {
        const validation = validateApprovalSignOff(
          recordWith({ ...APPROVED_RECORD, localReviewer: second })
        );
        expect(validation.ok).toBe(false);
        expect(validation.failures.join(' ')).toContain('same person');
      });
    }

    it('rejects all three being the same person, reporting each pairing', () => {
      const validation = validateApprovalSignOff(
        recordWith({
          ...APPROVED_RECORD,
          localReviewer: 'Utpal Raj KB',
          seoReviewer: '  utpal raj kb ',
        })
      );
      expect(validation.failures.filter((failure) => failure.includes('same person'))).toHaveLength(
        3
      );
    });
  });

  describe('attributability', () => {
    for (const deskName of NON_ATTRIBUTABLE_REVIEWER_NAMES) {
      it(`rejects "${deskName}" as a sign-off`, () => {
        const validation = validateApprovalSignOff(
          recordWith({ ...APPROVED_RECORD, seoReviewer: deskName })
        );
        expect(validation.ok).toBe(false);
        expect(validation.failures.join(' ')).toContain('does not identify an accountable person');
      });

      it(`rejects "${deskName}" padded and case-varied`, () => {
        const validation = validateApprovalSignOff(
          recordWith({ ...APPROVED_RECORD, seoReviewer: `  ${deskName.toUpperCase()}  ` })
        );
        expect(validation.ok).toBe(false);
        expect(validation.failures.join(' ')).toContain('does not identify an accountable person');
      });
    }

    it('rejects a name shorter than three characters after trimming', () => {
      const validation = validateApprovalSignOff(recordWith({ ...APPROVED_RECORD, seoReviewer: ' KB ' }));
      expect(validation.ok).toBe(false);
    });
  });

  describe('timestamp ordering', () => {
    it('accepts three timestamps on the same instant', () => {
      const validation = validateApprovalSignOff(
        recordWith({
          ...APPROVED_RECORD,
          localReviewApprovedAt: '2026-09-02T00:00:00.000Z',
          editorialApprovedAt: '2026-09-02T00:00:00.000Z',
          seoReviewApprovedAt: '2026-09-02T00:00:00.000Z',
        })
      );
      expect(validation).toEqual({ ok: true, failures: [] });
    });

    it('rejects a local review approved after the editorial approval', () => {
      const validation = validateApprovalSignOff(
        recordWith({ ...APPROVED_RECORD, localReviewApprovedAt: '2026-09-02T00:00:01.000Z' })
      );
      expect(validation.ok).toBe(false);
      expect(validation.failures.join(' ')).toContain('localReviewApprovedAt');
    });

    it('rejects an editorial approval after the SEO review', () => {
      const validation = validateApprovalSignOff(
        recordWith({ ...APPROVED_RECORD, editorialApprovedAt: '2026-09-04T00:00:00.000Z' })
      );
      expect(validation.ok).toBe(false);
      expect(validation.failures.join(' ')).toContain('seoReviewApprovedAt');
    });

    it('names each absent timestamp', () => {
      const validation = validateApprovalSignOff(
        recordWith({
          ...APPROVED_RECORD,
          localReviewApprovedAt: null,
          editorialApprovedAt: null,
          seoReviewApprovedAt: null,
        })
      );
      expect(validation.failures).toContain('No localReviewApprovedAt recorded.');
      expect(validation.failures).toContain('No editorialApprovedAt recorded.');
      expect(validation.failures).toContain('No seoReviewApprovedAt recorded.');
    });

    it('rejects a timestamp that is not a date', () => {
      const validation = validateApprovalSignOff(
        recordWith({ ...APPROVED_RECORD, editorialApprovedAt: 'last Tuesday' })
      );
      expect(validation.ok).toBe(false);
      expect(validation.failures.join(' ')).toContain('is not a date');
    });
  });
});

describe('the review window', () => {
  it('accepts a next review exactly 180 days after the source check', () => {
    expect(
      validateReviewWindow({
        sourceCheckedAt: '2026-09-01T00:00:00.000Z',
        contentUpdatedAt: '2026-09-01T00:00:00.000Z',
        nextReviewAt: '2027-02-28T00:00:00.000Z',
      })
    ).toEqual({ ok: true, failures: [] });
  });

  it('rejects a next review 181 days after the source check', () => {
    const validation = validateReviewWindow({
      sourceCheckedAt: '2026-09-01T00:00:00.000Z',
      contentUpdatedAt: '2026-09-01T00:00:00.000Z',
      nextReviewAt: '2027-03-01T00:00:00.000Z',
    });
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain(`beyond the ${SOURCE_CHECK_MAX_DAYS}-day limit`);
  });

  it('rejects a next review earlier than the source check', () => {
    const validation = validateReviewWindow({
      sourceCheckedAt: '2026-09-01T00:00:00.000Z',
      contentUpdatedAt: '2026-09-01T00:00:00.000Z',
      nextReviewAt: '2026-08-31T00:00:00.000Z',
    });
    expect(validation.failures.join(' ')).toContain('earlier than sourceCheckedAt');
  });

  it('names each of the three absent dates', () => {
    const validation = validateReviewWindow({
      sourceCheckedAt: null,
      contentUpdatedAt: null,
      nextReviewAt: null,
    });
    expect(validation.failures).toEqual([
      'No sourceCheckedAt recorded.',
      'No contentUpdatedAt recorded.',
      'No nextReviewAt recorded.',
    ]);
  });

  it('holds every live locality record out of the approved window', () => {
    // The honest current state: no record carries any of the three dates.
    for (const record of LOCALITY_REGISTRY) {
      expect(validateReviewWindow(record).ok).toBe(false);
    }
  });
});

describe('batch validation', () => {
  function batchOf(count: number, overrides: Partial<BatchUnderReview> = {}): BatchUnderReview {
    return {
      batchId: 'BATCH-001',
      recordIds: Array.from({ length: count }, (_, index) => `LOC-BLR-${index + 1}`),
      localReviewer: 'A named local reviewer',
      editorialApprover: 'Utpal Raj KB',
      seoReviewer: 'A named SEO reviewer',
      releasedOn: null,
      ...overrides,
    };
  }

  function contextFor(batch: BatchUnderReview, releasedBatchCount: number) {
    return { gatePassingRecordIds: batch.recordIds, releasedBatchCount };
  }

  it('reports which band applies', () => {
    expect(batchSizeBand(0)).toEqual(FIRST_BATCH_SIZE);
    expect(batchSizeBand(1)).toEqual(LATER_BATCH_SIZE);
    expect(FIRST_BATCH_SIZE).toEqual({ min: 8, max: 12 });
    expect(LATER_BATCH_SIZE).toEqual({ min: 10, max: 15 });
  });

  describe('the first batch holds 8 to 12 records', () => {
    for (const count of [7, 8, 12, 13]) {
      const permitted = count >= 8 && count <= 12;
      it(`${permitted ? 'accepts' : 'rejects'} ${count} records`, () => {
        const batch = batchOf(count);
        const validation = validateBatch(batch, contextFor(batch, 0));
        expect(validation.ok).toBe(permitted);
        if (!permitted) {
          expect(validation.failures.join(' ')).toContain(`holds ${count} record(s)`);
          expect(validation.failures.join(' ')).toContain('first batch holds 8 to 12');
        }
      });
    }
  });

  describe('a later batch holds 10 to 15 records', () => {
    for (const count of [9, 10, 15, 16]) {
      const permitted = count >= 10 && count <= 15;
      it(`${permitted ? 'accepts' : 'rejects'} ${count} records`, () => {
        const batch = batchOf(count);
        const validation = validateBatch(batch, contextFor(batch, 1));
        expect(validation.ok).toBe(permitted);
        if (!permitted) {
          expect(validation.failures.join(' ')).toContain('later batch holds 10 to 15');
        }
      });
    }
  });

  it('holds the whole batch unreleased when one member fails the gate', () => {
    const batch = batchOf(10);
    const validation = validateBatch(batch, {
      gatePassingRecordIds: batch.recordIds.slice(1),
      releasedBatchCount: 1,
    });
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('LOC-BLR-1');
    expect(validation.failures.join(' ')).toContain('the whole batch stays unreleased');
  });

  it('names every member that fails the gate rather than the first', () => {
    const batch = batchOf(10);
    const validation = validateBatch(batch, {
      gatePassingRecordIds: [],
      releasedBatchCount: 1,
    });
    expect(validation.failures.filter((failure) => failure.includes('publication gate'))).toHaveLength(
      10
    );
  });

  it('requires three distinct attributable reviewers', () => {
    const batch = batchOf(10, { seoReviewer: '  a named local reviewer ' });
    const validation = validateBatch(batch, contextFor(batch, 1));
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('same person');
  });

  it('rejects a desk name as a batch reviewer', () => {
    const batch = batchOf(10, { editorialApprover: 'Editorial Desk' });
    const validation = validateBatch(batch, contextFor(batch, 1));
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('does not identify an accountable person');
  });

  it('rejects a repeated record identifier', () => {
    const batch = batchOf(10);
    const repeated: BatchUnderReview = {
      ...batch,
      recordIds: [...batch.recordIds.slice(0, 9), batch.recordIds[0]],
    };
    const validation = validateBatch(repeated, contextFor(repeated, 1));
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('more than once');
  });

  it('rejects a release date that is not a date', () => {
    const batch = batchOf(10, { releasedOn: 'soon' });
    const validation = validateBatch(batch, contextFor(batch, 1));
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('is not a date');
  });

  it('accepts a released batch that met every condition', () => {
    const batch = batchOf(12, { releasedOn: '2026-10-01' });
    expect(validateBatch(batch, contextFor(batch, 0))).toEqual({ ok: true, failures: [] });
  });
});
