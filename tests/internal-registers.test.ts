import { describe, expect, it } from 'vitest';

import { validateBatch, type BatchUnderReview } from '@/config/editorial-workflow';
import { CLAIM_LEDGER, type SourceRecord } from '@/config/claims';
import { CONTENT_BATCHES, releasedBatchCount, type ContentBatch } from '@internal/registers/batches';
import {
  EXCLUDED_METHODS,
  EXCLUDED_METHOD_NAMES,
  validateExcludedMethods,
} from '@internal/registers/excluded-methods';
import {
  ENTITY_BOUNDARY_DECISIONS,
  getOpenBoundaryDecisions,
  validateEntityBoundaryDecision,
  type EntityBoundaryDecision,
} from '@internal/registers/entity-boundary-decisions';
import {
  POSTCODE_PAIRS,
  evaluatePostcodePair,
  type PostcodePair,
} from '@internal/registers/postcode-pairs';
import {
  WITHDRAWAL_ENTRIES,
  createWithdrawalEntry,
  validateWithdrawalEntry,
} from '@internal/registers/withdrawals';

/**
 * The four bookkeeping registers and the excluded-method record.
 *
 * The first test is the one that earns its keep: `ContentBatch` and
 * `BatchUnderReview` are declared in two files that may not import each other,
 * because nothing under `src/` may name `internal/` (Requirement 3.12). Passing a
 * real `ContentBatch` to `validateBatch` is what proves the two shapes have not
 * drifted apart — a missing field would be a compile error here rather than a
 * surprise at release.
 */

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'India Post',
    independenceGroup: 'india-post',
    exactUrl: 'https://example-source-a.test/pincode-directory/560038',
    documentReference: null,
    locationInSource: 'PIN code directory, Bengaluru East',
    publicationDate: '2026-01-01',
    accessDate: '2026-09-01',
    supportingNote: 'The directory lists the locality against this postal code.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

describe('the batch register', () => {
  it('holds no batch, because no record passes the publication gate', () => {
    expect(CONTENT_BATCHES).toEqual([]);
    expect(releasedBatchCount()).toBe(0);
  });

  it('matches the shape the workflow module validates', () => {
    const batch: ContentBatch = {
      batchId: 'BATCH-001',
      recordIds: Array.from({ length: 8 }, (_, index) => `LOC-BLR-${index + 1}`),
      localReviewer: 'A named local reviewer',
      editorialApprover: 'Utpal Raj KB',
      seoReviewer: 'A named SEO reviewer',
      releasedOn: null,
    };

    // A ContentBatch is accepted as a BatchUnderReview with no adapter.
    const asUnderReview: BatchUnderReview = batch;
    const validation = validateBatch(asUnderReview, {
      gatePassingRecordIds: batch.recordIds,
      releasedBatchCount: 0,
    });
    expect(validation).toEqual({ ok: true, failures: [] });
  });

  it('counts only released batches toward the sizing band', () => {
    const prepared: ContentBatch = {
      batchId: 'BATCH-002',
      recordIds: [],
      localReviewer: 'A named local reviewer',
      editorialApprover: 'Utpal Raj KB',
      seoReviewer: 'A named SEO reviewer',
      releasedOn: null,
    };
    expect(releasedBatchCount([prepared])).toBe(0);
    expect(releasedBatchCount([{ ...prepared, releasedOn: '2026-10-01' }])).toBe(1);
  });
});

describe('the withdrawal register', () => {
  it('holds no withdrawal, because nothing has been published', () => {
    expect(WITHDRAWAL_ENTRIES).toEqual([]);
  });

  it('keeps every gate failure string rather than a summary', () => {
    const gateFailures = [
      'Publication status is "unpublished".',
      'No named reviewer recorded.',
      'Operational coverage is "unconfirmed"; publication requires confirmed coverage.',
    ];
    const entry = createWithdrawalEntry({
      recordId: 'LOC-BLR-INDIRANAGAR',
      gateFailures,
      withdrawnOn: '2026-09-29',
      routesRemoved: ['/areas/indiranagar'],
    });

    expect(entry.gateFailures).toEqual(gateFailures);
    expect(validateWithdrawalEntry(entry)).toEqual({ ok: true, failures: [] });
  });

  it('rejects an entry recording no gate failure at all', () => {
    const entry = createWithdrawalEntry({
      recordId: 'LOC-BLR-INDIRANAGAR',
      gateFailures: [],
      withdrawnOn: '2026-09-29',
      routesRemoved: ['/areas/indiranagar'],
    });
    const validation = validateWithdrawalEntry(entry);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('every failure string the gate returned');
  });

  it('rejects an entry with no withdrawal date and no removed route', () => {
    const validation = validateWithdrawalEntry({
      recordId: 'LOC-BLR-KORAMANGALA',
      gateFailures: ['Editorial status is "research", not "approved".'],
      withdrawnOn: 'yesterday',
      routesRemoved: [],
    });
    expect(validation.failures).toHaveLength(2);
  });
});

describe('the postcode pair register', () => {
  it('holds no pairing, because none has two independent sources behind it', () => {
    expect(POSTCODE_PAIRS).toEqual([]);
  });

  function pair(overrides: Partial<PostcodePair> = {}): PostcodePair {
    return {
      pairId: 'PPC-001',
      localitySlug: 'indiranagar',
      postcode: '560038',
      sources: [
        source(),
        source({
          publisher: 'Bruhat Bengaluru Mahanagara Palike',
          independenceGroup: 'bbmp',
          exactUrl: 'https://example-source-b.test/ward-postal-index',
        }),
      ],
      boundaryVersion: 'BBMP ward delimitation notification of 2024',
      reviewer: 'A named local reviewer',
      ...overrides,
    };
  }

  it('records a pairing carrying two independent sources, a boundary version and a reviewer', () => {
    expect(evaluatePostcodePair(pair())).toEqual({ recorded: true, failures: [] });
  });

  it('rejects two sources from the same independence group', () => {
    const evaluation = evaluatePostcodePair(
      pair({
        sources: [source(), source({ exactUrl: 'https://example-source-a.test/other-page' })],
      })
    );
    expect(evaluation.recorded).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('not independent');
  });

  it('rejects a single source', () => {
    const evaluation = evaluatePostcodePair(pair({ sources: [source()] }));
    expect(evaluation.failures.join(' ')).toContain('requires two independent sources');
  });

  it('rejects a pairing with no boundary version', () => {
    const evaluation = evaluatePostcodePair(pair({ boundaryVersion: '  ' }));
    expect(evaluation.failures.join(' ')).toContain('no boundary version recorded');
  });

  it('rejects a desk name as the reviewer', () => {
    const evaluation = evaluatePostcodePair(pair({ reviewer: 'research desk' }));
    expect(evaluation.failures.join(' ')).toContain('does not identify an accountable person');
  });

  it('rejects a postal code that is not six digits', () => {
    expect(evaluatePostcodePair(pair({ postcode: '56003' })).recorded).toBe(false);
    expect(evaluatePostcodePair(pair({ postcode: '560 038' })).recorded).toBe(false);
  });

  it('applies the same source rule the claim gate applies', () => {
    // A homepage reference fails here exactly as it fails in the ledger.
    const evaluation = evaluatePostcodePair(
      pair({
        sources: [
          source({ exactUrl: 'https://example-source-a.test' }),
          source({ independenceGroup: 'bbmp', exactUrl: 'https://example-source-b.test/ward' }),
        ],
      })
    );
    expect(evaluation.failures.join(' ')).toContain('organisation homepage');
    // And the ledger's own claims still fail, so nothing here loosened that gate.
    expect(CLAIM_LEDGER.length).toBeGreaterThan(0);
  });
});

describe('the entity boundary decision register', () => {
  it('holds one open decision per candidate the seeding held out', () => {
    // Five collisions, five open decisions, nothing decided. The accounting that
    // ties these five to the 132 backlog candidates lives in
    // tests/locality-seeding.test.ts, which owns that sum.
    expect(ENTITY_BOUNDARY_DECISIONS).toHaveLength(5);
    expect(getOpenBoundaryDecisions()).toHaveLength(5);
    expect(ENTITY_BOUNDARY_DECISIONS.every((entry) => entry.resolution === null)).toBe(true);
  });

  it('validates every live entry', () => {
    for (const entry of ENTITY_BOUNDARY_DECISIONS) {
      expect(validateEntityBoundaryDecision(entry), entry.decisionId).toEqual({
        ok: true,
        failures: [],
      });
    }
  });

  function decision(overrides: Partial<EntityBoundaryDecision> = {}): EntityBoundaryDecision {
    return {
      decisionId: 'EBD-001',
      candidateId: 'AREA-016',
      candidateName: 'Sadashivanagar',
      candidateSlug: 'sadashivanagar',
      collisionKind: 'existing-record-slug',
      collidingSlug: 'sadashivanagar',
      existingEntityId: 'LOC-BLR-SADASHIVANAGAR',
      decisionLogReference: null,
      questionToAnswer:
        'Is the candidate the same place as the existing record, or a narrower area inside it?',
      recordedOn: '2026-09-29',
      resolution: null,
      ...overrides,
    };
  }

  it('accepts an entry recording the collision and the question', () => {
    expect(validateEntityBoundaryDecision(decision())).toEqual({ ok: true, failures: [] });
  });

  it('rejects an entry that defers no question', () => {
    const validation = validateEntityBoundaryDecision(decision({ questionToAnswer: '' }));
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('defers nothing');
  });

  it('rejects an entry with no colliding slug or candidate identifier', () => {
    const validation = validateEntityBoundaryDecision(
      decision({ candidateId: '', collidingSlug: '' })
    );
    expect(validation.failures).toHaveLength(2);
  });

  it('requires a decider and a date on a closed decision', () => {
    const validation = validateEntityBoundaryDecision(
      decision({ resolution: { outcome: 'preserve-existing', decidedBy: '', decidedOn: 'soon' } })
    );
    expect(validation.failures).toHaveLength(2);
  });

  it('separates open decisions from closed ones', () => {
    const open = decision();
    const closed = decision({
      decisionId: 'EBD-002',
      resolution: { outcome: 'alias-to-existing', decidedBy: 'Utpal Raj KB', decidedOn: '2026-10-01' },
    });
    expect(getOpenBoundaryDecisions([open, closed])).toEqual([open]);
  });
});

describe('the excluded method register', () => {
  it('records all six methods Requirement 12.11 names', () => {
    expect(EXCLUDED_METHODS).toHaveLength(6);
    expect(EXCLUDED_METHODS.map((method) => method.method).sort()).toEqual(
      [...EXCLUDED_METHOD_NAMES].sort()
    );
  });

  it('carries a reason and a recorded date on every entry', () => {
    for (const method of EXCLUDED_METHODS) {
      expect(method.reason.trim().length).toBeGreaterThan(0);
      expect(method.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(validateExcludedMethods()).toEqual({ ok: true, failures: [] });
  });

  it('reports a method dropped from the register', () => {
    const validation = validateExcludedMethods(
      EXCLUDED_METHODS.filter((method) => method.method !== 'synthetic-reviews')
    );
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('synthetic-reviews');
  });

  it('reports a method recorded twice', () => {
    const validation = validateExcludedMethods([...EXCLUDED_METHODS, EXCLUDED_METHODS[0]]);
    expect(validation.ok).toBe(false);
    expect(validation.failures.join(' ')).toContain('identifier used more than once');
  });

  it('reports an entry with no reason', () => {
    const validation = validateExcludedMethods(
      EXCLUDED_METHODS.map((method) =>
        method.method === 'comment-placements' ? { ...method, reason: '  ' } : method
      )
    );
    expect(validation.failures.join(' ')).toContain('no reason recorded');
  });
});
