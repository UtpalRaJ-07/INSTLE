/**
 * The progress report's arithmetic, driven against the real gate.
 *
 * Requirements 13.1, 13.2, 13.4, 13.5 and 13.6. The generator writes two documents, and a
 * document assertion would only prove that a number was rendered. What matters is
 * that the number is the gate's answer, that the eight states account for every
 * candidate once, that the distance to 100 cannot go negative, that a failing record
 * carries every reason rather than the first, that a released batch reports its
 * identifier, its date and three named reviewers, and that twelve static routes are
 * never folded into the published page count.
 *
 * The pure functions come from `scripts/generate-progress-report.mjs`, which runs
 * nothing on import. The records come from the live registries, so a count here is
 * the count the report states — not a fixture that agrees with it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GUIDE_REGISTRY, evaluateGuide, getPublishedGuides } from '@/config/guides';
import { LOCALITY_REGISTRY, evaluateLocality, getPublishedLocalities } from '@/config/localities';
import {
  WORKFLOW_SEQUENCE,
  deriveWorkflowState,
  type WorkflowState,
} from '@/config/editorial-workflow';
import { evaluateRegionHub, getPublishedAreaRecords } from '@/config/locality-sections';
import { STATIC_PUBLIC_ROUTES } from '@/lib/public-routes';

import { CONTENT_BATCHES } from '@internal/registers/batches';

import {
  EXPECTED_CANDIDATE_TOTAL,
  EXPECTED_GUIDE_CANDIDATES,
  EXPECTED_LOCALITY_CANDIDATES,
  OWNER_INPUT_REGISTER,
  PUBLISHED_PAGE_TARGET,
  WORKFLOW_STATES,
  batchSummaries,
  blockedCountsByChecklistEntry,
  checkPartition,
  checklistEntryIdsIn,
  gateFailuresByRecord,
  guideEditorialStatus,
  parseRegisterEntryIds,
  partitionWorkflowStates,
  publishedCounts,
  remainingToTarget,
  routeCounts,
  workflowStateOf,
} from '../scripts/generate-progress-report.mjs';

const ROOT = join(__dirname, '..');
const NOW = new Date('2026-09-29T00:00:00.000Z');

interface Assessment {
  recordId: string;
  kind: 'locality' | 'guide';
  slug: string;
  editorialStatus: string;
  eligible: boolean;
  failures: readonly string[];
  blockingNotes: readonly string[];
}

/**
 * Every candidate, assessed by the gate the routes call.
 *
 * A region hub goes through `evaluateRegionHub`, exactly as `isAreaRecordPublishable`
 * sends it, so the verdict here is the verdict `/areas/[slug]` reaches.
 */
function assessAll(now: Date = NOW): Assessment[] {
  const publishedLocalities = getPublishedLocalities(now);

  const localities: Assessment[] = LOCALITY_REGISTRY.map((record) => {
    const evaluation =
      record.entityType === 'region-hub'
        ? evaluateRegionHub(record, publishedLocalities, now)
        : evaluateLocality(record, now);
    return {
      recordId: record.entityId,
      kind: 'locality',
      slug: record.slug,
      editorialStatus: record.editorialStatus,
      eligible: evaluation.eligible,
      failures: evaluation.failures,
      blockingNotes: record.blockingNotes,
    };
  });

  const guides: Assessment[] = GUIDE_REGISTRY.map((record) => {
    const evaluation = evaluateGuide(record, now);
    return {
      recordId: record.guideId,
      kind: 'guide',
      slug: record.slug,
      editorialStatus: guideEditorialStatus(record),
      eligible: evaluation.eligible,
      failures: evaluation.failures,
      blockingNotes: record.blockingNotes,
    };
  });

  return [...localities, ...guides];
}

/** A synthetic assessment, for the arithmetic that no real record exercises yet. */
function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    recordId: 'REC-TEST',
    kind: 'locality',
    slug: 'test-slug',
    editorialStatus: 'candidate',
    eligible: false,
    failures: [],
    blockingNotes: [],
    ...overrides,
  };
}

describe('the published page count comes from the gate', () => {
  it('counts localities and guides the gate admits, and labels the sum', () => {
    const counts = publishedCounts(assessAll());

    expect(counts.localities).toBe(getPublishedAreaRecords(NOW).length);
    expect(counts.guides).toBe(getPublishedGuides(NOW).length);
    expect(counts.publishedPageCount).toBe(counts.localities + counts.guides);
    expect(counts.label).toContain('published page count');
  });

  it('states zero published localities, which is the real number today', () => {
    // Not a target. If a locality is published tomorrow this expectation changes
    // with it, and the point of the assertion is that the figure is the gate's.
    expect(publishedCounts(assessAll()).localities).toBe(getPublishedAreaRecords(NOW).length);
    expect(getPublishedAreaRecords(NOW)).toHaveLength(0);
  });

  it('ignores a stored published flag the gate rejects', () => {
    const counts = publishedCounts([
      assessment({ recordId: 'REC-FLAGGED', eligible: false, editorialStatus: 'approved' }),
      assessment({ recordId: 'REC-REAL', eligible: true, editorialStatus: 'approved' }),
    ]);

    expect(counts.publishedPageCount).toBe(1);
  });
});

describe('the distance to 100', () => {
  it('is 100 minus the published page count', () => {
    const counts = publishedCounts(assessAll());
    const remaining = remainingToTarget(counts.publishedPageCount);

    expect(remaining.target).toBe(100);
    expect(remaining.remaining).toBe(PUBLISHED_PAGE_TARGET - counts.publishedPageCount);
    expect(remaining.clamped).toBe(false);
  });

  it('is zero at the target, and zero above it rather than negative', () => {
    expect(remainingToTarget(99).remaining).toBe(1);
    expect(remainingToTarget(100).remaining).toBe(0);
    expect(remainingToTarget(100).clamped).toBe(false);

    for (const published of [101, 137, 1000]) {
      expect(remainingToTarget(published).remaining).toBe(0);
      expect(remainingToTarget(published).clamped).toBe(true);
    }
  });
});

describe('the eight-state partition', () => {
  it('uses the shipped state list', () => {
    expect(WORKFLOW_STATES).toEqual([...WORKFLOW_SEQUENCE]);
  });

  it('derives the same state as deriveWorkflowState, with the gate in place of the flag', () => {
    for (const editorialStatus of WORKFLOW_SEQUENCE) {
      if (editorialStatus === 'published') continue; // not an editorial value
      for (const eligible of [true, false]) {
        expect(workflowStateOf(assessment({ editorialStatus, eligible }))).toBe(
          deriveWorkflowState({
            editorialStatus,
            publicationStatus: eligible ? 'published' : 'unpublished',
          })
        );
      }
    }
  });

  it('accounts for all 168 candidates exactly once', () => {
    const assessments = assessAll();
    expect(assessments).toHaveLength(EXPECTED_CANDIDATE_TOTAL);
    expect(assessments.filter((item) => item.kind === 'locality')).toHaveLength(
      EXPECTED_LOCALITY_CANDIDATES
    );
    expect(assessments.filter((item) => item.kind === 'guide')).toHaveLength(
      EXPECTED_GUIDE_CANDIDATES
    );

    const partition = partitionWorkflowStates(assessments);
    const check = checkPartition(partition);

    expect(check.failures).toEqual([]);
    expect(check.ok).toBe(true);
    expect(partition.sum).toBe(EXPECTED_CANDIDATE_TOTAL);
    expect(partition.unclassified).toEqual([]);

    // Exhaustive: every record identifier appears in some state.
    const placed = WORKFLOW_STATES.flatMap((state: WorkflowState) => partition.recordIdsByState[state]);
    expect(placed).toHaveLength(EXPECTED_CANDIDATE_TOTAL);
    expect(new Set(placed).size).toBe(EXPECTED_CANDIDATE_TOTAL);

    // Disjoint: no identifier in two states.
    for (const [first, second] of WORKFLOW_STATES.flatMap((a: WorkflowState) =>
      WORKFLOW_STATES.filter((b: WorkflowState) => b !== a).map((b: WorkflowState) => [a, b])
    )) {
      const shared = partition.recordIdsByState[first].filter((recordId: string) =>
        partition.recordIdsByState[second].includes(recordId)
      );
      expect(shared).toEqual([]);
    }
  });

  it('reports a record it cannot classify instead of dropping it', () => {
    const partition = partitionWorkflowStates([
      assessment({ recordId: 'REC-UNKNOWN', editorialStatus: 'invented_state' }),
      assessment({ recordId: 'REC-OK' }),
    ]);
    const check = checkPartition(partition, 2);

    expect(partition.sum).toBe(1);
    expect(partition.unclassified).toEqual([{ recordId: 'REC-UNKNOWN', state: 'invented_state' }]);
    expect(check.ok).toBe(false);
    expect(check.failures.join(' ')).toContain('REC-UNKNOWN');
  });

  it('rejects a population that is no longer 168', () => {
    const check = checkPartition(partitionWorkflowStates([assessment()]), EXPECTED_CANDIDATE_TOTAL);
    expect(check.ok).toBe(false);
    expect(check.failures.join(' ')).toContain('168');
  });

  it('places a guide with no written content in candidate, and written text in draft', () => {
    expect(guideEditorialStatus({ sections: [], contentUpdatedAt: null })).toBe('candidate');
    expect(guideEditorialStatus({ sections: [], contentUpdatedAt: '2026-09-29' })).toBe('draft');
    expect(guideEditorialStatus({ sections: [{ heading: 'x' }], contentUpdatedAt: null })).toBe(
      'draft'
    );
  });
});

describe('per-record failure lists', () => {
  it('carry every reason the gate returned, not the first', () => {
    const assessments = assessAll();
    const reported = gateFailuresByRecord(assessments);
    const failing = assessments.filter((item) => !item.eligible);

    expect(reported).toHaveLength(failing.length);

    for (const record of reported) {
      const source = failing.find((item) => item.recordId === record.recordId);
      expect(source).toBeDefined();
      expect(record.failures).toEqual([...(source as Assessment).failures]);
      expect(record.failureCount).toBe(source?.failures.length);
    }

    // At least one record fails for several reasons, so "every reason" is a real
    // distinction here and not a claim about a one-element list.
    expect(Math.max(...reported.map((record) => record.failureCount))).toBeGreaterThan(1);
  });

  it('lists no record the gate admits', () => {
    const reported = gateFailuresByRecord([
      assessment({ recordId: 'REC-PASS', eligible: true }),
      assessment({ recordId: 'REC-FAIL', failures: ['first reason', 'second reason'] }),
    ]);

    expect(reported.map((record) => record.recordId)).toEqual(['REC-FAIL']);
    expect(reported[0].failures).toEqual(['first reason', 'second reason']);
  });
});

describe('blocked counts per Owner_Input_Register entry', () => {
  it('counts the records each entry holds up, and names only identifiers', () => {
    const registerIds = parseRegisterEntryIds(readFileSync(join(ROOT, OWNER_INPUT_REGISTER), 'utf8'));
    const entries = blockedCountsByChecklistEntry(assessAll(), registerIds);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.entryId).toMatch(/^C[1-9]\d?$/);
      expect(entry.existsInRegister).toBe(true);
      expect(entry.blockedRecordCount).toBe(entry.recordIds.length);
      expect(new Set(entry.recordIds).size).toBe(entry.recordIds.length);
    }

    // The counts are per entry, so they may exceed the number of blocked records.
    const blockedRecords = new Set(entries.flatMap((entry) => entry.recordIds));
    expect(blockedRecords.size).toBeLessThanOrEqual(
      entries.reduce((total, entry) => total + entry.blockedRecordCount, 0)
    );
  });

  it('counts a record against every entry it names, and no record the gate admits', () => {
    const entries = blockedCountsByChecklistEntry(
      [
        assessment({
          recordId: 'REC-TWO-ENTRIES',
          blockingNotes: ['Blocked on checklist C3: see the register.', 'Also blocked on C5.'],
        }),
        assessment({
          recordId: 'REC-ONE-ENTRY',
          blockingNotes: ['Blocked on checklist C3: see the register.'],
        }),
        assessment({
          recordId: 'REC-PUBLISHED',
          eligible: true,
          blockingNotes: ['A stale note naming C3.'],
        }),
      ],
      ['C3', 'C5']
    );

    expect(entries).toEqual([
      {
        entryId: 'C3',
        blockedRecordCount: 2,
        recordIds: ['REC-TWO-ENTRIES', 'REC-ONE-ENTRY'],
        existsInRegister: true,
      },
      { entryId: 'C5', blockedRecordCount: 1, recordIds: ['REC-TWO-ENTRIES'], existsInRegister: true },
    ]);
  });

  it('flags an identifier the register does not hold rather than counting against it', () => {
    const entries = blockedCountsByChecklistEntry(
      [assessment({ blockingNotes: ['Blocked on checklist C99.'] })],
      ['C1', 'C2']
    );

    expect(entries).toEqual([
      { entryId: 'C99', blockedRecordCount: 1, recordIds: ['REC-TEST'], existsInRegister: false },
    ]);
  });

  it('reads identifiers as whole tokens, in numeric order', () => {
    expect(checklistEntryIdsIn(['Blocked on checklist C2 and checklist C11.'])).toEqual(['C2', 'C11']);
    expect(checklistEntryIdsIn(['OWN-03 and C12 apply.'])).toEqual(['C12']);
    expect(checklistEntryIdsIn(['No identifier here. ABC123 is not one.'])).toEqual([]);
  });
});

describe('released batches carry their identifier, date and three reviewers', () => {
  // Requirement 13.6. `CONTENT_BATCHES` is empty today, so the live register proves
  // only that the report states zero. The shape a released batch reports is what
  // matters when the count reaches 100, and it is unexercised until then.
  const released = {
    batchId: 'BATCH-001',
    recordIds: ['LOC-001', 'LOC-002'],
    localReviewer: 'A Named Local Reviewer',
    editorialApprover: 'A Named Editorial Approver',
    seoReviewer: 'A Named SEO Reviewer',
    releasedOn: '2026-10-15',
  };

  it('reports the live register as zero released and zero prepared', () => {
    const summaries = batchSummaries(CONTENT_BATCHES);

    expect(CONTENT_BATCHES).toHaveLength(0);
    expect(summaries.released).toEqual([]);
    expect(summaries.prepared).toEqual([]);
  });

  it('names all three reviewers and the release date for a released batch', () => {
    const summaries = batchSummaries([released]);

    expect(summaries.prepared).toEqual([]);
    expect(summaries.released).toEqual([
      {
        batchId: 'BATCH-001',
        releasedOn: '2026-10-15',
        recordCount: 2,
        recordIds: ['LOC-001', 'LOC-002'],
        reviewers: {
          localReviewer: 'A Named Local Reviewer',
          editorialApprover: 'A Named Editorial Approver',
          seoReviewer: 'A Named SEO Reviewer',
        },
      },
    ]);
  });

  it('keeps a batch with no release date out of the released list', () => {
    const summaries = batchSummaries([{ ...released, releasedOn: null }]);

    expect(summaries.released).toEqual([]);
    expect(summaries.prepared.map((batch) => batch.batchId)).toEqual(['BATCH-001']);
  });
});

describe('static routes stay outside the published page count', () => {
  it('counts and labels them separately', () => {
    const counts = routeCounts(
      STATIC_PUBLIC_ROUTES.map((route) => route.path),
      ['/', '/buy', '/areas', '/areas/[slug]', '/guides/[slug]', '/concept-1']
    );

    expect(counts.publishedStaticRoutes.count).toBe(STATIC_PUBLIC_ROUTES.length);
    expect(counts.publishedStaticRoutes.label).toContain(
      'none is counted in the published page count'
    );
    expect(counts.excludedRoutes.paths).toEqual(['/concept-1']);
    expect(counts.contentRouteTemplates.paths).toEqual(['/areas/[slug]', '/guides/[slug]']);
  });

  it('adds nothing to the published page count', () => {
    const assessments = assessAll();
    const counts = publishedCounts(assessments);
    const routes = routeCounts(
      STATIC_PUBLIC_ROUTES.map((route) => route.path),
      []
    );

    expect(counts.publishedPageCount).toBe(counts.localities + counts.guides);
    expect(counts.publishedPageCount).toBeLessThan(routes.publishedStaticRoutes.count);
    expect(remainingToTarget(counts.publishedPageCount).remaining).toBe(
      PUBLISHED_PAGE_TARGET - counts.localities - counts.guides
    );

    // No static route is a locality slug or a guide slug.
    const contentSlugs = new Set(assessments.map((item) => `/${item.slug}`));
    for (const path of routes.publishedStaticRoutes.paths) {
      expect(contentSlugs.has(path)).toBe(false);
    }
  });
});
