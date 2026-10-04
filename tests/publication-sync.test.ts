import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { GUIDE_REGISTRY, evaluateGuide, type GuideRecord } from '@/config/guides';
import {
  LOCALITY_REGISTRY,
  MIN_SECTION_WORDS,
  evaluateLocality,
  type LocalityRecord,
} from '@/config/localities';
import {
  findStatusGateDisagreements,
  guideRoutes,
  localityRoutes,
  needsFactReviewReturn,
  planPublicationSync,
  returnToFactReview,
  withdrawGuide,
  withdrawLocality,
} from '@/config/publication-sync';
import {
  WITHDRAWAL_ENTRIES,
  createWithdrawalEntry,
  validateWithdrawalEntry,
} from '@internal/registers/withdrawals';

const ROOT = join(__dirname, '..');
const NOW = new Date('2026-09-29T00:00:00.000Z');

/** A paragraph of exactly `words` words, seeded so two calls differ. */
function paragraphOfWords(words: number, seed: string): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
}

function locality(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: 'LOC-SYNC-TEST',
    canonicalName: 'Sync Test Locality',
    aliases: [],
    entityType: 'locality',
    slug: 'sync-test-locality',
    marketingGroup: 'Test Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    summary: 'A summary that states no external facts.',
    summaryClaimIds: [],
    // Two sections at the word minimum, because the gate requires both (Requirement 1.5).
    sections: [
      {
        sectionId: 'process',
        heading: 'What happens here?',
        paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'process')],
        claimIds: [],
      },
      {
        sectionId: 'papers',
        heading: 'What should you have ready?',
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
    publicationStatus: 'published',
    blockingNotes: [],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
    ...overrides,
  };
}

function guide(overrides: Partial<GuideRecord> = {}): GuideRecord {
  return {
    guideId: 'GD-SYNC-TEST',
    slug: 'sync-test-guide',
    question: 'A real question?',
    title: 'A real question',
    description: 'A description.',
    intent: 'buy',
    contentClass: 'own-process',
    directAnswer:
      'A direct answer written at a length the gate accepts, which means more than twenty words and fewer than sixty, and which tells a reader what to do next without scrolling.',
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

/**
 * Requirement 11.12, and the reason the rest of this file exists.
 *
 * The runtime gate is authoritative. The persisted status is bookkeeping. If the two
 * ever disagree, then something is reporting a page as published that the gate would
 * 404, which makes every count in the progress report wrong.
 */
describe('the persisted status and the runtime gate agree', () => {
  it('holds for every record in both live registries', () => {
    expect(findStatusGateDisagreements(NOW)).toEqual([]);
  });

  it('holds at the real build date as well as at the pinned one', () => {
    expect(findStatusGateDisagreements(new Date())).toEqual([]);
  });

  it('states the implication in both registries directly', () => {
    for (const record of LOCALITY_REGISTRY) {
      if (record.publicationStatus !== 'published') continue;
      expect(evaluateLocality(record, NOW).eligible, record.slug).toBe(true);
    }
    for (const record of GUIDE_REGISTRY) {
      if (record.publicationStatus !== 'published') continue;
      expect(evaluateGuide(record, NOW).eligible, record.slug).toBe(true);
    }
  });

  /**
   * One direction only. A record can satisfy every gate condition while its persisted
   * status still says unpublished, because release happens in reviewed batches
   * (Requirement 1.8) rather than automatically on evidence. Asserting the converse
   * would turn "ready" into "live".
   */
  it('does not report a gate-passing record whose status says unpublished', () => {
    const ready = locality({ publicationStatus: 'unpublished' });
    expect(evaluateLocality({ ...ready, publicationStatus: 'published' }, NOW).eligible).toBe(true);
    expect(findStatusGateDisagreements(NOW, [ready], [])).toEqual([]);
  });

  it('reports a record whose status says published while the gate rejects it', () => {
    const stale = locality({ nextReviewAt: '2026-01-01' });
    const disagreements = findStatusGateDisagreements(NOW, [stale], []);
    expect(disagreements).toHaveLength(1);
    expect(disagreements[0].recordId).toBe('LOC-SYNC-TEST');
    expect(disagreements[0].kind).toBe('locality');
    // Every failure the gate returned, not a summary.
    expect(disagreements[0].gateFailures).toEqual(evaluateLocality(stale, NOW).failures);
  });
});

describe('the withdrawal plan', () => {
  it('finds nothing to do against the live registries', () => {
    const plan = planPublicationSync(NOW);
    expect(plan.withdrawals).toEqual([]);
    expect(plan.factReviewReturns).toEqual([]);
    expect(plan.disagreements).toEqual([]);
    expect(plan.publishedLocalityCount).toBe(0);
    expect(plan.publishedGuideCount).toBe(3);
  });

  it('carries every gate failure string, the date and every route removed', () => {
    // Two independent failures, because the point of Requirement 11.9 is that a
    // withdrawal keeps all of them rather than the first or a tidy summary of both.
    const stale = locality({
      nextReviewAt: '2026-01-01',
      administrativeMappings: [
        {
          mappingType: 'BBMP zone and ward',
          value: 'East Zone, ward 80',
          boundaryVersion: null,
          claimId: null,
        },
      ],
    });
    const plan = planPublicationSync(NOW, [stale], []);

    expect(plan.withdrawals).toHaveLength(1);
    const [withdrawal] = plan.withdrawals;
    expect(withdrawal.recordId).toBe('LOC-SYNC-TEST');
    expect(withdrawal.withdrawnOn).toBe('2026-09-29');
    expect(withdrawal.routesRemoved).toEqual(['/areas/sync-test-locality']);
    expect(withdrawal.gateFailures).toEqual(evaluateLocality(stale, NOW).failures);

    const joined = withdrawal.gateFailures.join(' ');
    expect(joined).toMatch(/review expired on 2026-01-01/);
    expect(joined).toMatch(/records no boundary version/);
    expect(joined).toMatch(/names no claim/);
    expect(withdrawal.gateFailures.length).toBeGreaterThan(1);
  });

  it('withdraws a guide whose review date has passed, naming its route', () => {
    const stale = guide({ contentUpdatedAt: '2025-06-01', nextReviewAt: '2026-06-01' });
    const plan = planPublicationSync(NOW, [], [stale]);
    expect(plan.withdrawals).toHaveLength(1);
    expect(plan.withdrawals[0].routesRemoved).toEqual(['/guides/sync-test-guide']);
    expect(plan.withdrawals[0].gateFailures.join(' ')).toMatch(/review was due on 2026-06-01/);
  });

  it('builds a valid register entry from the plan, without a summary field to fill', () => {
    const stale = locality({ nextReviewAt: '2026-01-01' });
    const [withdrawal] = planPublicationSync(NOW, [stale], []).withdrawals;
    const entry = createWithdrawalEntry(withdrawal);
    expect(validateWithdrawalEntry(entry).ok).toBe(true);
    expect(entry.gateFailures).toEqual(withdrawal.gateFailures);
  });

  it('routes a record to exactly one public path', () => {
    expect(localityRoutes(locality())).toEqual(['/areas/sync-test-locality']);
    expect(guideRoutes(guide())).toEqual(['/guides/sync-test-guide']);
  });

  it('holds an empty live register, because nothing has ever been withdrawn', () => {
    expect(WITHDRAWAL_ENTRIES).toEqual([]);
  });
});

/**
 * Requirement 11.9. "Retained" is the whole point: a withdrawal has to be reversible
 * by a review rather than by a rewrite, so the record keeps its sections, its three
 * reviewers and all three approval timestamps.
 */
describe('a withdrawal retains the record and its approvals', () => {
  it('changes publicationStatus and nothing else on a locality', () => {
    const before = locality();
    const after = withdrawLocality(before);

    expect(after.publicationStatus).toBe('unpublished');
    for (const key of Object.keys(before) as (keyof LocalityRecord)[]) {
      if (key === 'publicationStatus') continue;
      expect(after[key], key).toEqual(before[key]);
    }
    // Named explicitly, because these are the fields somebody would be tempted to clear.
    expect(after.author).toBe(before.author);
    expect(after.localReviewer).toBe(before.localReviewer);
    expect(after.seoReviewer).toBe(before.seoReviewer);
    expect(after.editorialApprovedAt).toBe(before.editorialApprovedAt);
    expect(after.localReviewApprovedAt).toBe(before.localReviewApprovedAt);
    expect(after.seoReviewApprovedAt).toBe(before.seoReviewApprovedAt);
    expect(after.sections).toEqual(before.sections);
  });

  it('changes publicationStatus and nothing else on a guide', () => {
    const before = guide();
    const after = withdrawGuide(before);
    expect(after.publicationStatus).toBe('unpublished');
    for (const key of Object.keys(before) as (keyof GuideRecord)[]) {
      if (key === 'publicationStatus') continue;
      expect(after[key], key).toEqual(before[key]);
    }
  });

  it('changes editorialStatus and nothing else when returning to fact review', () => {
    const before = locality();
    const after = returnToFactReview(before);
    expect(after.editorialStatus).toBe('fact_review');
    for (const key of Object.keys(before) as (keyof LocalityRecord)[]) {
      if (key === 'editorialStatus') continue;
      expect(after[key], key).toEqual(before[key]);
    }
  });
});

/** Requirement 11.7. Approvals approved the earlier text. */
describe('returning a record to fact review', () => {
  it('returns a record whose content moved after any one of the three approvals', () => {
    for (const field of [
      'localReviewApprovedAt',
      'editorialApprovedAt',
      'seoReviewApprovedAt',
    ] as const) {
      const record = locality({
        contentUpdatedAt: '2026-09-25',
        localReviewApprovedAt: '2026-09-26',
        editorialApprovedAt: '2026-09-26',
        seoReviewApprovedAt: '2026-09-26',
        [field]: '2026-09-24',
      });
      expect(needsFactReviewReturn(record), field).toBe(true);
    }
  });

  it('leaves a record whose content predates every approval', () => {
    expect(needsFactReviewReturn(locality())).toBe(false);
  });

  /**
   * Same-day is not later. The records carry calendar dates rather than instants, and
   * inventing an ordering within a day would invent evidence about who did what first.
   */
  it('treats a same-day update as not later than the approval', () => {
    const record = locality({
      contentUpdatedAt: '2026-09-20',
      editorialApprovedAt: '2026-09-20',
    });
    expect(needsFactReviewReturn(record)).toBe(false);
  });

  it('does not treat a missing or malformed date as a reason to return the record', () => {
    expect(needsFactReviewReturn(locality({ contentUpdatedAt: null }))).toBe(false);
    expect(needsFactReviewReturn(locality({ editorialApprovedAt: null }))).toBe(false);
    expect(needsFactReviewReturn(locality({ contentUpdatedAt: '2026-02-30' }))).toBe(false);
  });

  it('lists the record in the plan when it needs returning', () => {
    const record = locality({ contentUpdatedAt: '2026-09-27' });
    expect(planPublicationSync(NOW, [record], []).factReviewReturns).toEqual(['LOC-SYNC-TEST']);
  });
});

/**
 * The script's one hard promise, asserted against its source rather than trusted.
 *
 * A withdrawal is a status flip plus an append. If the script could delete a file, a
 * record or an earlier register entry, then "the record and its approvals are
 * retained" would be a claim about intent rather than about behaviour.
 */
describe('the sync script never deletes anything', () => {
  const script = readFileSync(join(ROOT, 'scripts', 'sync-publication-status.mjs'), 'utf8');

  it('calls no deletion or truncation API', () => {
    for (const pattern of [
      /\bunlinkSync?\b/,
      /\brmSync?\b/,
      /\brmdirSync?\b/,
      /\brimraf\b/,
      /\btruncateSync?\b/,
      /\bsplice\(/,
      /\bfilter\([^)]*WITHDRAWAL/,
    ]) {
      expect(script, pattern.source).not.toMatch(pattern);
    }
  });

  it('writes only the registry sources and the withdrawal register', () => {
    // Exactly two write sites: the field flip, and the register append. Both write a
    // whole file built from the file that was read, so neither can drop content.
    expect(script.match(/writeFileSync\(/g) ?? []).toHaveLength(2);
    expect(script).toContain('SYNC-MANAGED ENTRIES END');
  });

  it('flips only publicationStatus and editorialStatus', () => {
    const flipped = [...script.matchAll(/'(publicationStatus|editorialStatus)',/g)].map(
      (match) => match[1]
    );
    expect(new Set(flipped)).toEqual(new Set(['publicationStatus', 'editorialStatus']));
  });

  it('reports rather than writes unless --apply is passed', () => {
    expect(script).toContain("args.has('--apply')");
    expect(script).toContain('Re-run with --apply');
  });

  it('inserts new register entries before the closing marker, keeping earlier ones', () => {
    expect(script).toContain('source.slice(0, endIndex) + rendered + source.slice(endIndex)');
  });
});
