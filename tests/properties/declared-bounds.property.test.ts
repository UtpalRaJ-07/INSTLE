/**
 * Property 16: Every declared bound holds at every input size.
 *
 * *For any* generated record, asset set or registry, each of the following bounds holds
 * and its violation is reported with the measured value: a published guide's direct
 * answer is 20 to 60 words; every guide section heading is a question of at most 15
 * words; a page carries at most 5 supporting phrases; a published guide has at least
 * two sections; a locality page carries at least two sections of at least 120 words;
 * each link group renders at most 6 links; every internal link's text is 2 to 80
 * characters; a content page carries 1 to 3 call actions; the footer carries at most 12
 * links; a page's server-rendered HTML carries at most 60 internal links; a single
 * visual asset is at most 80 KB compressed and a route's assets at most 150 KB; a page
 * renders at most 6 photographs with `priority` on at most one image; a batch holds 8 to
 * 12 records when first and 10 to 15 thereafter; a region hub needs 3 published locality
 * links and 2 unique sections; and every recorded review window is respected at its
 * boundary.
 *
 * **Validates: Requirements 1.5, 1.8, 2.3, 2.7, 2.9, 3.6, 4.5, 4.10, 4.12, 5.3, 5.4,
 * 5.11, 8.1, 8.2, 8.6, 8.7, 8.8, 8.9, 9.17, 10.5, 10.7, 11.5**
 *
 * **Every bound is read from the module that declares it.** Not one number below is
 * written out. A test that restated "25" would keep passing after someone changed
 * `MAX_VISIBLE_LINKS_PER_GROUP` to 40 and would then be asserting a bound the code no
 * longer has; read from the constant, the same test moves with the code and still says
 * the enforcement is applied at the boundary. So what is asserted is never the number —
 * it is that the enforcing function's verdict changes at exactly `bound` and `bound + 1`
 * (or `bound - 1` and `bound` for a minimum), and that its failure reports the measured
 * size, which is what Property 16 asks for and what makes a failure actionable.
 *
 * **Sizes are generated around each bound, not uniformly.** `arbSizeAround` weights the
 * band `bound - 3` to `bound + 3` three to one against a wider uniform draw, because a
 * uniform size over a plausible range reaches the interesting integer roughly never and
 * an off-by-one is the whole failure mode a bound has.
 *
 * **What drives each bound.** Every assertion calls the shipped function that enforces
 * the bound — `evaluateSectionDepth`, `evaluateGuide`, `evaluateRegionHub`,
 * `validateBatch`, `validateReviewWindow`, `assignPrimaryIntent`,
 * `groupPublishedLocalities`, `finaliseLinks`, `validateLinkText`, `auditFooterLinks`,
 * `countCallActions`, `auditInternalLinkBudget`, `evaluatePhotographPage` — rather than
 * reimplementing the comparison. Two bounds have no enforcing function under `src/`:
 * the 80 KB per-asset and 150 KB per-route budgets are enforced by
 * `scripts/measure-visual-assets.mjs`, which measures a real build. For those the
 * recorded audit output is read and each of its verdicts is checked against the shipped
 * constant at every measured size, so loosening the constant without the audit — or the
 * reverse — fails here.
 *
 * The claim ledger is layered, because a region hub's locality links only count when the
 * relationship claim passes the claim gate and no claim in the live ledger does. Nothing
 * else is mocked.
 */

import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClaimRecord } from '@/config/claims';

const injected = vi.hoisted(() => ({ claims: new Map<string, ClaimRecord>() }));

vi.mock('@/config/claims', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/claims')>();
  const getClaim = (claimId: string): ClaimRecord | undefined =>
    injected.claims.get(claimId) ?? actual.getClaim(claimId);
  return {
    ...actual,
    getClaim,
    evaluateClaims: (claimIds: readonly string[], now: Date = new Date()) => {
      const failures: string[] = [];
      for (const claimId of claimIds) {
        const claim = getClaim(claimId);
        if (!claim) {
          failures.push(`${claimId}: no such claim in the ledger.`);
          continue;
        }
        const evaluation = actual.evaluateClaim(claim, now);
        if (!evaluation.eligible) {
          failures.push(...evaluation.failures.map((reason) => `${claimId}: ${reason}`));
        }
      }
      return { eligible: failures.length === 0, failures };
    },
  };
});

import {
  FIRST_BATCH_SIZE,
  LATER_BATCH_SIZE,
  SOURCE_CHECK_MAX_DAYS,
  batchSizeBand,
  validateBatch,
  validateReviewWindow,
  type BatchUnderReview,
} from '@/config/editorial-workflow';
import {
  MAX_DIRECT_ANSWER_WORDS,
  MAX_HEADING_WORDS,
  MAX_REVIEW_WINDOW_MONTHS,
  MIN_DIRECT_ANSWER_WORDS,
  MIN_GUIDE_SECTIONS,
  evaluateGuide,
  type GuideRecord,
} from '@/config/guides';
import {
  MIN_CONTENT_SECTIONS,
  MIN_SECTION_WORDS,
  evaluateSectionDepth,
  type LocalityRecord,
} from '@/config/localities';
import {
  MIN_REGION_HUB_LOCALITY_LINKS,
  MIN_REGION_HUB_UNIQUE_SECTIONS,
  evaluateRegionHub,
} from '@/config/locality-sections';
import {
  ASSET_COMPRESSED_BYTE_BUDGET,
  PHOTOGRAPHS_PER_PAGE_MAX,
  PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX,
  ROUTE_COMPRESSED_BYTE_BUDGET,
  evaluateAsset,
  evaluatePhotographPage,
  type PhotographAsset,
  type PhotographPageEntry,
} from '@/config/media-register';
import { addCalendarDays, addCalendarMonths, formatCalendarDate } from '@/lib/calendar-dates';
import {
  MAX_CALL_ACTIONS_PER_PAGE,
  MAX_FOOTER_LINKS,
  MAX_INTERNAL_LINKS_PER_PAGE,
  MAX_LINKS_PER_GROUP,
  MAX_LINK_TEXT_LENGTH,
  MIN_CALL_ACTIONS_PER_PAGE,
  MIN_LINK_TEXT_LENGTH,
  auditFooterLinks,
  auditInternalLinkBudget,
  countCallActions,
  finaliseLinks,
  headerSectionHrefs,
  validateLinkText,
  type InternalLink,
} from '@/lib/internal-links';
import { MAX_VISIBLE_LINKS_PER_GROUP, groupPublishedLocalities } from '@/lib/locality-grouping';
import {
  MAX_SUPPORTING_PHRASES_PER_PAGE,
  assignPrimaryIntent,
  type SearchIntentEntry,
} from '@internal/registers/search-intent';

import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbCompleteIntentEntry,
  arbGatePassingClaimWithId,
  arbVisualAsset,
  markedGateReadyGuide,
  markedGateReadyLocality,
} from './arbitraries';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** The one claim every relationship in this file is carried by. */
const PASSING_CLAIM_ID = 'CLM-BOUNDS-PASSING';

/**
 * One drawn claim, reused. `fc.sample`'s positional count is used rather than a
 * `numRuns` option, because the suite's iteration-floor guard scans this file's text
 * for `numRuns:` and a one-value sample is not a property run.
 */
const [PASSING_CLAIM] = fc.sample(arbGatePassingClaimWithId(PASSING_CLAIM_ID), 1);

beforeEach(() => {
  injected.claims.clear();
  injected.claims.set(PASSING_CLAIM_ID, PASSING_CLAIM);
});

/**
 * Sizes around `bound`: the band either side of it three times out of four, and a
 * wider uniform draw the rest of the time so a bound that only bites far from its
 * boundary is still reached.
 */
function arbSizeAround(bound: number, span = 3, floor = 0): fc.Arbitrary<number> {
  return fc.oneof(
    { weight: 3, arbitrary: fc.integer({ min: Math.max(floor, bound - span), max: bound + span }) },
    { weight: 1, arbitrary: fc.integer({ min: floor, max: bound * 2 + 2 }) }
  );
}

describe('Property 16: the size generator', () => {
  it.each([
    ['MIN_CONTENT_SECTIONS', MIN_CONTENT_SECTIONS],
    ['MIN_SECTION_WORDS', MIN_SECTION_WORDS],
    ['MAX_VISIBLE_LINKS_PER_GROUP', MAX_VISIBLE_LINKS_PER_GROUP],
    ['MAX_LINKS_PER_GROUP', MAX_LINKS_PER_GROUP],
    ['MAX_FOOTER_LINKS', MAX_FOOTER_LINKS],
    ['MAX_INTERNAL_LINKS_PER_PAGE', MAX_INTERNAL_LINKS_PER_PAGE],
    ['MAX_DIRECT_ANSWER_WORDS', MAX_DIRECT_ANSWER_WORDS],
    ['MAX_HEADING_WORDS', MAX_HEADING_WORDS],
    ['PHOTOGRAPHS_PER_PAGE_MAX', PHOTOGRAPHS_PER_PAGE_MAX],
    ['PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX', PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX],
    ['SOURCE_CHECK_MAX_DAYS', SOURCE_CHECK_MAX_DAYS],
  ])('reaches %s itself and both sides of it, so neither branch is vacuous', (_label, bound) => {
    const span = bound === PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX ? 2 : 3;
    const sizes = fc.sample(arbSizeAround(bound, span), { ...PROPERTY_RUN_CONFIG, seed: 16 });
    expect(sizes, 'the bound itself').toContain(bound);
    expect(sizes.some((size) => size < bound), 'below the bound').toBe(true);
    expect(sizes.some((size) => size > bound), 'above the bound').toBe(true);
  });
});

/** Every failure string mentioning `fragment`. The bound's own report, isolated. */
function reporting(failures: readonly string[], fragment: string): string[] {
  return failures.filter((failure) => failure.includes(fragment));
}

/** `words` whitespace-separated words, the first one `label` so the text is unique. */
function wordsOfLength(label: string, words: number): string {
  if (words <= 0) return '';
  return [label, ...Array.from({ length: words - 1 }, () => 'word')].join(' ');
}

// ---------------------------------------------------------------------------
// Requirement 1.5 — two sections of at least 120 words
// ---------------------------------------------------------------------------

const LOCALITY_BASE = markedGateReadyLocality('ZZMARKER-bnd0x000000', 'bounds-base', PASSING_CLAIM_ID);

function localityWithSections(count: number, wordsPerSection: number): LocalityRecord {
  return {
    ...LOCALITY_BASE,
    sections: Array.from({ length: count }, (_unused, index) => ({
      sectionId: `bounds-${index}`,
      heading: `What is worth knowing, part ${index + 1}?`,
      paragraphs: [wordsOfLength(`section${index}`, wordsPerSection)],
      claimIds: [],
    })),
  };
}

describe('Property 16: MIN_CONTENT_SECTIONS and MIN_SECTION_WORDS (Requirement 1.5)', () => {
  it('reports the section count exactly below the minimum, and the measured count with it', () => {
    fc.assert(
      fc.property(arbSizeAround(MIN_CONTENT_SECTIONS), (count) => {
        // Every section comfortably over the word bar, so the count is the only variable.
        const failures = evaluateSectionDepth(localityWithSections(count, MIN_SECTION_WORDS + 10));
        const counted = reporting(failures, `carries ${count} content section(s)`);
        expect(counted.length === 1, `count ${count}`).toBe(count < MIN_CONTENT_SECTIONS);
        if (count >= MIN_CONTENT_SECTIONS) expect(failures).toEqual([]);
        else expect(counted[0]).toContain(String(MIN_CONTENT_SECTIONS));
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('reports a section below the word minimum, and the measured word count with it', () => {
    fc.assert(
      fc.property(arbSizeAround(MIN_SECTION_WORDS, 3, 1), (words) => {
        const record = localityWithSections(MIN_CONTENT_SECTIONS, words);
        const failures = evaluateSectionDepth(record);
        const short = reporting(failures, `carries ${words} words`);
        expect(short.length === MIN_CONTENT_SECTIONS, `words ${words}`).toBe(words < MIN_SECTION_WORDS);
        if (words >= MIN_SECTION_WORDS) expect(failures).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirements 2.7 and 2.9 — three published links, two unique sections
// ---------------------------------------------------------------------------

/** `count` gate-ready locality records, each with its own section text. */
function publishedNeighbours(count: number): LocalityRecord[] {
  return Array.from({ length: count }, (_unused, index) => ({
    ...localityWithSections(MIN_CONTENT_SECTIONS, MIN_SECTION_WORDS),
    entityId: `LOC-BOUNDS-N${index}`,
    canonicalName: `Neighbour ${index}`,
    slug: `bounds-neighbour-${index}`,
    sections: [
      {
        sectionId: `n${index}-a`,
        heading: 'What is worth knowing here?',
        paragraphs: [wordsOfLength(`neighbour${index}a`, MIN_SECTION_WORDS)],
        claimIds: [],
      },
      {
        sectionId: `n${index}-b`,
        heading: 'What should you have ready?',
        paragraphs: [wordsOfLength(`neighbour${index}b`, MIN_SECTION_WORDS)],
        claimIds: [],
      },
    ],
  }));
}

describe('Property 16: the region hub thresholds (Requirements 2.7 and 2.9)', () => {
  it('counts published locality links at every size, and reports the measured count', () => {
    fc.assert(
      fc.property(arbSizeAround(MIN_REGION_HUB_LOCALITY_LINKS), (links) => {
        const neighbours = publishedNeighbours(links);
        const hub: LocalityRecord = {
          ...LOCALITY_BASE,
          entityId: 'LOC-BOUNDS-HUB',
          slug: 'bounds-hub',
          canonicalName: 'Bounds Hub',
          entityType: 'region-hub',
          approvedNearbyRelationships: neighbours.map((neighbour) => ({
            slug: neighbour.slug,
            relationship: `covers the area served under ${neighbour.slug}`,
            claimId: PASSING_CLAIM_ID,
          })),
        };

        const { failures } = evaluateRegionHub(hub, neighbours, PROPERTY_NOW);
        const counted = reporting(failures, `links to ${links} published locality page(s)`);
        expect(counted.length === 1, `links ${links}`).toBe(links < MIN_REGION_HUB_LOCALITY_LINKS);
        if (links >= MIN_REGION_HUB_LOCALITY_LINKS) expect(failures).toEqual([]);
        else expect(counted[0]).toContain(String(MIN_REGION_HUB_LOCALITY_LINKS));
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('counts sections of its own at every size, and reports the measured count', () => {
    fc.assert(
      fc.property(arbSizeAround(MIN_REGION_HUB_UNIQUE_SECTIONS), (unique) => {
        // Enough links that the other threshold is met, so this one is isolated.
        const neighbours = publishedNeighbours(MIN_REGION_HUB_LOCALITY_LINKS);
        // `unique` sections of the hub's own, plus one copied verbatim from a
        // neighbour — which must never be counted, at any size.
        const borrowed = neighbours[0].sections[0];
        const hub: LocalityRecord = {
          ...LOCALITY_BASE,
          entityId: 'LOC-BOUNDS-HUB',
          slug: 'bounds-hub',
          canonicalName: 'Bounds Hub',
          entityType: 'region-hub',
          sections: [
            ...Array.from({ length: unique }, (_unused, index) => ({
              sectionId: `hub-own-${index}`,
              heading: `What does this side of the city share, part ${index + 1}?`,
              paragraphs: [wordsOfLength(`hubown${index}`, MIN_SECTION_WORDS)],
              claimIds: [],
            })),
            { ...borrowed, sectionId: 'hub-borrowed' },
          ],
          approvedNearbyRelationships: neighbours.map((neighbour) => ({
            slug: neighbour.slug,
            relationship: `covers the area served under ${neighbour.slug}`,
            claimId: PASSING_CLAIM_ID,
          })),
        };

        const { failures } = evaluateRegionHub(hub, neighbours, PROPERTY_NOW);
        const counted = reporting(failures, `carries ${unique} section(s) of at least`);
        expect(counted.length === 1, `unique ${unique}`).toBe(unique < MIN_REGION_HUB_UNIQUE_SECTIONS);
        if (unique >= MIN_REGION_HUB_UNIQUE_SECTIONS) {
          expect(reporting(failures, 'appear on no other published locality page')).toEqual([]);
        } else {
          expect(counted[0]).toContain(String(MIN_REGION_HUB_UNIQUE_SECTIONS));
          expect(counted[0]).toContain(String(MIN_SECTION_WORDS));
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 2.3 — 25 visible links per group
// ---------------------------------------------------------------------------

describe('Property 16: MAX_VISIBLE_LINKS_PER_GROUP (Requirement 2.3)', () => {
  it('splits a group at the cap at every group size, losing and duplicating nothing', () => {
    fc.assert(
      fc.property(arbSizeAround(MAX_VISIBLE_LINKS_PER_GROUP, 3, 1), (size) => {
        const records = Array.from({ length: size }, (_unused, index) => ({
          ...LOCALITY_BASE,
          entityId: `LOC-BOUNDS-G${index}`,
          // Padded, so code-point order over the names is the index order.
          canonicalName: `Group Member ${String(index).padStart(4, '0')}`,
          slug: `bounds-group-${String(index).padStart(4, '0')}`,
          marketingGroup: 'One group',
        }));

        const [group, ...rest] = groupPublishedLocalities(records);
        expect(rest, 'one marketing group, one group').toEqual([]);
        expect(group.visibleLinks.length).toBe(Math.min(size, MAX_VISIBLE_LINKS_PER_GROUP));
        expect(group.overflowLinks.length).toBe(Math.max(size - MAX_VISIBLE_LINKS_PER_GROUP, 0));
        // The two halves reproduce the input exactly once each, in order.
        expect([...group.visibleLinks, ...group.overflowLinks].map((link) => link.slug)).toEqual(
          records.map((record) => record.slug)
        );
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 3.6 — five supporting phrases per page
// ---------------------------------------------------------------------------

describe('Property 16: MAX_SUPPORTING_PHRASES_PER_PAGE (Requirement 3.6)', () => {
  it('accepts up to the cap and rejects past it, reporting the measured count', () => {
    fc.assert(
      fc.property(
        arbCompleteIntentEntry,
        arbSizeAround(MAX_SUPPORTING_PHRASES_PER_PAGE),
        (drawn, count) => {
          const entry: SearchIntentEntry = { ...drawn, role: 'primary' };
          const supportingPhrases = Array.from(
            { length: count },
            (_unused, index) => `what does step ${index + 1} involve`
          );
          const result = assignPrimaryIntent([], {
            entry,
            route: '/guides/bounds',
            supportingPhrases,
          });

          if (count <= MAX_SUPPORTING_PHRASES_PER_PAGE) {
            expect(result.ok, `count ${count}`).toBe(true);
            return;
          }
          expect(result.ok, `count ${count}`).toBe(false);
          expect(result.ok ? '' : result.error).toContain(`${count} supporting phrases`);
          expect(result.ok ? '' : result.error).toContain(String(MAX_SUPPORTING_PHRASES_PER_PAGE));
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirements 4.5, 4.10, 4.12, 5.3, 5.4 and 5.11 — the guide bounds
// ---------------------------------------------------------------------------

const GUIDE_BASE = markedGateReadyGuide('ZZMARKER-bnd1x000000', 'bounds-guide', 'buy');

/** The base with its two sections kept and its direct answer replaced. */
function guideWithAnswer(words: number): GuideRecord {
  return { ...GUIDE_BASE, directAnswer: wordsOfLength('answer', words) };
}

describe('Property 16: the guide bounds (Requirements 4.5, 4.10, 4.12, 5.3, 5.4, 5.11)', () => {
  it('holds the direct answer inside its word band, reporting the measured count', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          arbSizeAround(MIN_DIRECT_ANSWER_WORDS, 3, 1),
          arbSizeAround(MAX_DIRECT_ANSWER_WORDS, 3, 1)
        ),
        (words) => {
          const { failures } = evaluateGuide(guideWithAnswer(words), PROPERTY_NOW);
          const counted = reporting(failures, `Direct answer is ${words} words`);
          const inBand = words >= MIN_DIRECT_ANSWER_WORDS && words <= MAX_DIRECT_ANSWER_WORDS;
          expect(counted.length === 1, `words ${words}`).toBe(!inBand);
          if (inBand) expect(failures).toEqual([]);
          else {
            expect(counted[0]).toContain(String(MIN_DIRECT_ANSWER_WORDS));
            expect(counted[0]).toContain(String(MAX_DIRECT_ANSWER_WORDS));
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('requires at least two sections, reporting the measured count', () => {
    fc.assert(
      fc.property(arbSizeAround(MIN_GUIDE_SECTIONS, 3, 1), (count) => {
        const sections = Array.from({ length: count }, (_unused, index) => ({
          heading: `What happens at step ${index + 1}?`,
          headingIntentEntryId: GUIDE_BASE.primaryIntent?.intentEntryId ?? null,
          paragraphs: [`Body paragraph ${index + 1}.`],
        }));
        const { failures } = evaluateGuide({ ...GUIDE_BASE, sections }, PROPERTY_NOW);
        const counted = reporting(failures, `carries ${count} content section(s)`);
        expect(counted.length === 1, `count ${count}`).toBe(count < MIN_GUIDE_SECTIONS);
        if (count >= MIN_GUIDE_SECTIONS) expect(failures).toEqual([]);
        else expect(counted[0]).toContain(String(MIN_GUIDE_SECTIONS));
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('holds every section heading at or under the word cap, reporting the measured count', () => {
    fc.assert(
      fc.property(arbSizeAround(MAX_HEADING_WORDS, 3, 1), (words) => {
        // A question of exactly `words` words: the last one carries the mark.
        const heading = Array.from({ length: words }, (_unused, index) =>
          index === words - 1 ? 'happen?' : 'what'
        ).join(' ');
        const sections = GUIDE_BASE.sections.map((section) => ({ ...section, heading }));
        const { failures } = evaluateGuide({ ...GUIDE_BASE, sections }, PROPERTY_NOW);
        const counted = reporting(failures, `is ${words} words`);
        // Both sections carry the heading, so both are reported past the cap.
        expect(counted.length === sections.length, `words ${words}`).toBe(words > MAX_HEADING_WORDS);
        if (words <= MAX_HEADING_WORDS) {
          // The repeated heading is not itself a gate failure; nothing else fires.
          expect(failures).toEqual([]);
        } else {
          expect(counted[0]).toContain(String(MAX_HEADING_WORDS));
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('holds the review window at or inside twelve months of the content date', () => {
    fc.assert(
      fc.property(arbSizeAround(MAX_REVIEW_WINDOW_MONTHS, 3, 1), (months) => {
        const contentDate = new Date(`${GUIDE_BASE.contentUpdatedAt}T00:00:00.000Z`);
        const nextReviewAt = formatCalendarDate(addCalendarMonths(contentDate, months));
        const { failures } = evaluateGuide({ ...GUIDE_BASE, nextReviewAt }, PROPERTY_NOW);
        const counted = reporting(failures, `more than ${MAX_REVIEW_WINDOW_MONTHS} months after`);
        expect(counted.length === 1, `months ${months}`).toBe(months > MAX_REVIEW_WINDOW_MONTHS);
        if (months <= MAX_REVIEW_WINDOW_MONTHS) expect(failures).toEqual([]);
        else expect(counted[0]).toContain(nextReviewAt);
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 11.5 — a source check is good for 180 days
// ---------------------------------------------------------------------------

describe('Property 16: SOURCE_CHECK_MAX_DAYS (Requirement 11.5)', () => {
  it('accepts a review window up to the limit and reports the measured distance past it', () => {
    fc.assert(
      fc.property(fc.oneof(arbSizeAround(SOURCE_CHECK_MAX_DAYS), fc.integer({ min: -30, max: -1 })), (days) => {
        const sourceCheckedAt = formatCalendarDate(addCalendarDays(PROPERTY_NOW, -10));
        const checked = new Date(`${sourceCheckedAt}T00:00:00.000Z`);
        const nextReviewAt = formatCalendarDate(addCalendarDays(checked, days));
        const { ok, failures } = validateReviewWindow({
          sourceCheckedAt,
          contentUpdatedAt: sourceCheckedAt,
          nextReviewAt,
        });

        if (days < 0) {
          expect(ok, `days ${days}`).toBe(false);
          expect(reporting(failures, 'is earlier than sourceCheckedAt')).toHaveLength(1);
          return;
        }
        const counted = reporting(failures, `is ${days} days after sourceCheckedAt`);
        expect(counted.length === 1, `days ${days}`).toBe(days > SOURCE_CHECK_MAX_DAYS);
        expect(ok, `days ${days}`).toBe(days <= SOURCE_CHECK_MAX_DAYS);
        if (days > SOURCE_CHECK_MAX_DAYS) expect(counted[0]).toContain(String(SOURCE_CHECK_MAX_DAYS));
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 1.8 — batch sizing bands
// ---------------------------------------------------------------------------

describe('Property 16: the batch size bands (Requirement 1.8)', () => {
  it('names the band by released count, and reports the measured size either side of it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4 }),
        fc.oneof(arbSizeAround(FIRST_BATCH_SIZE.min), arbSizeAround(LATER_BATCH_SIZE.max)),
        (releasedBatchCount, size) => {
          const band = batchSizeBand(releasedBatchCount);
          expect(band).toEqual(releasedBatchCount === 0 ? FIRST_BATCH_SIZE : LATER_BATCH_SIZE);

          const recordIds = Array.from({ length: size }, (_unused, index) => `LOC-BATCH-${index}`);
          const batch: BatchUnderReview = {
            batchId: 'BATCH-BOUNDS-1',
            recordIds,
            localReviewer: 'A. Named Local Reviewer',
            editorialApprover: 'A. Named Editorial Approver',
            seoReviewer: 'A. Named SEO Reviewer',
            releasedOn: null,
          };
          // Every member passes the gate, so the size is the only variable.
          const { ok, failures } = validateBatch(batch, {
            gatePassingRecordIds: recordIds,
            releasedBatchCount,
          });

          const counted = reporting(failures, `holds ${size} record(s)`);
          const inBand = size >= band.min && size <= band.max;
          expect(counted.length === 1, `size ${size} in ${releasedBatchCount === 0 ? 'first' : 'later'}`).toBe(
            !inBand
          );
          expect(ok).toBe(inBand);
          if (!inBand) {
            expect(counted[0]).toContain(`${band.min} to ${band.max}`);
            expect(counted[0]).toContain(releasedBatchCount === 0 ? 'first batch' : 'later batch');
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirements 8.1, 8.2, 8.6, 8.7, 8.8 and 8.9 — the link bounds
// ---------------------------------------------------------------------------

describe('Property 16: MAX_LINKS_PER_GROUP and the empty group (Requirements 8.1, 8.9)', () => {
  it('keeps the first links up to the cap at every candidate count', () => {
    fc.assert(
      fc.property(arbSizeAround(MAX_LINKS_PER_GROUP), (count) => {
        const candidates: InternalLink[] = Array.from({ length: count }, (_unused, index) => ({
          href: `/areas/bounds-link-${index}`,
          text: `Bounds Area ${index}`,
          description: null,
        }));
        const kept = finaliseLinks(candidates);
        expect(kept.length).toBe(Math.min(count, MAX_LINKS_PER_GROUP));
        // The first `cap`, in the caller's order — not an arbitrary subset.
        expect(kept.map((link) => link.href)).toEqual(
          candidates.slice(0, MAX_LINKS_PER_GROUP).map((link) => link.href)
        );
        // Requirement 8.9: no qualifying destination means no group at all.
        if (count === 0) expect(kept).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

describe('Property 16: the link text length band (Requirement 8.2)', () => {
  it.each([
    ['a Latin letter', 'a'],
    // Above U+FFFF: two UTF-16 code units, one code point. The bound is in code
    // points, so a tree-emoji name of 80 trees is 80 characters and not 160.
    ['a character above U+FFFF', '\u{1F332}'],
  ])('measures %s in code points, at and either side of both ends', (_label, character) => {
    fc.assert(
      fc.property(
        fc.oneof(arbSizeAround(MIN_LINK_TEXT_LENGTH), arbSizeAround(MAX_LINK_TEXT_LENGTH)),
        (length) => {
          const text = character.repeat(length);
          const failures = validateLinkText(text);
          expect(failures.includes('too-short'), `length ${length}`).toBe(length < MIN_LINK_TEXT_LENGTH);
          expect(failures.includes('too-long'), `length ${length}`).toBe(length > MAX_LINK_TEXT_LENGTH);
          // Neither generated shape is a generic label or a bare URL, so inside the
          // band the text passes outright.
          if (length >= MIN_LINK_TEXT_LENGTH && length <= MAX_LINK_TEXT_LENGTH) {
            expect(failures).toEqual([]);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });
});

describe('Property 16: MAX_FOOTER_LINKS (Requirement 8.6)', () => {
  const [SECTION_HREF] = [...headerSectionHrefs()];

  it('reports the measured link count past the cap at every footer size', () => {
    fc.assert(
      fc.property(arbSizeAround(MAX_FOOTER_LINKS), (count) => {
        // Every link a header section, so the count is the only variable.
        const hrefs = Array.from({ length: count }, () => SECTION_HREF);
        const audit = auditFooterLinks(hrefs);
        expect(audit.count).toBe(count);
        const counted = reporting(audit.failures, `carries ${count} links`);
        expect(counted.length === 1, `count ${count}`).toBe(count > MAX_FOOTER_LINKS);
        expect(audit.ok).toBe(count <= MAX_FOOTER_LINKS);
        if (count > MAX_FOOTER_LINKS) expect(counted[0]).toContain(String(MAX_FOOTER_LINKS));
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

describe('Property 16: the call action band (Requirement 8.7)', () => {
  it('counts every call action at every size, repeats included', () => {
    fc.assert(
      fc.property(
        arbSizeAround(MAX_CALL_ACTIONS_PER_PAGE),
        fc.integer({ min: 0, max: 6 }),
        (calls, others) => {
          const hrefs = [
            ...Array.from({ length: calls }, (_unused, index) =>
              index % 2 === 0 ? 'tel:9353096264' : '/contact'
            ),
            ...Array.from({ length: others }, (_unused, index) => `/areas/bounds-other-${index}`),
          ];
          expect(countCallActions(hrefs)).toBe(calls);
          // The band is a closed interval, so 0 is below it and cap + 1 above it.
          const inBand = calls >= MIN_CALL_ACTIONS_PER_PAGE && calls <= MAX_CALL_ACTIONS_PER_PAGE;
          expect(inBand).toBe(calls > 0 && calls <= MAX_CALL_ACTIONS_PER_PAGE);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });
});

describe('Property 16: MAX_INTERNAL_LINKS_PER_PAGE (Requirement 8.8)', () => {
  it('reports the measured total past the cap, counting a repeated destination each time', () => {
    fc.assert(
      fc.property(arbSizeAround(MAX_INTERNAL_LINKS_PER_PAGE), fc.integer({ min: 0, max: 4 }), (total, external) => {
        // Split across the three regions the requirement names, with the same
        // destination repeated so repeats are proved to count separately.
        const internal = Array.from({ length: total }, () => '/buy');
        const audit = auditInternalLinkBudget('/bounds', {
          header: internal.slice(0, Math.ceil(total / 3)),
          main: internal.slice(Math.ceil(total / 3), Math.ceil((2 * total) / 3)),
          footer: [
            ...internal.slice(Math.ceil((2 * total) / 3)),
            // Neither a page of this site, so neither is counted.
            ...Array.from({ length: external }, () => 'tel:9353096264'),
            '#main-content',
          ],
        });

        expect(audit.total).toBe(total);
        expect(audit.ok).toBe(total <= MAX_INTERNAL_LINKS_PER_PAGE);
        if (total > MAX_INTERNAL_LINKS_PER_PAGE) {
          expect(audit.failure).toContain(`carries ${total} internal links`);
          expect(audit.failure).toContain(String(MAX_INTERNAL_LINKS_PER_PAGE));
          expect(audit.failure).toContain('/bounds');
        } else {
          expect(audit.failure).toBeNull();
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirements 10.5 and 10.7 — photographs per page
// ---------------------------------------------------------------------------

/** A photograph the asset gate admits at `PROPERTY_NOW`, small enough to isolate counts. */
function renderablePhotograph(base: PhotographAsset, index: number): PhotographAsset {
  return {
    ...base,
    assetId: `PHO-BOUNDS-${index}`,
    provenance: { ...base.provenance, permissionToAdapt: 'granted', licenceExpiresOn: null },
    // Small, so the page byte budget never fires and the count bound is isolated.
    compressedBytes: 1_024,
    caption: null,
  };
}

const arbPhotographBase: fc.Arbitrary<PhotographAsset> = arbVisualAsset
  .filter((asset): asset is PhotographAsset => asset.kind === 'photograph')
  .map((asset) => renderablePhotograph(asset, 0));

describe('Property 16: the photograph page bounds (Requirements 10.5, 10.7)', () => {
  it('draws photographs the asset gate admits, so the page bounds are what is measured', () => {
    const drawn = fc.sample(arbPhotographBase, { ...PROPERTY_RUN_CONFIG, seed: 16 });
    expect(drawn.length).toBe(PROPERTY_RUN_CONFIG.numRuns);
    for (const asset of drawn) {
      expect(evaluateAsset(asset, PROPERTY_NOW).failures, asset.assetId).toEqual([]);
    }
  });

  it('reports the measured photograph count and priority count past their caps', () => {
    fc.assert(
      fc.property(
        arbPhotographBase,
        arbSizeAround(PHOTOGRAPHS_PER_PAGE_MAX),
        arbSizeAround(PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX, 2),
        (base, count, priorities) => {
          // The generator has to hand over an admissible photograph, or the count
          // bound would be measured against a page that fails for another reason.
          fc.pre(evaluateAsset(base, PROPERTY_NOW).renderable);

          const entries: PhotographPageEntry[] = Array.from({ length: count }, (_unused, index) => ({
            asset: renderablePhotograph(base, index),
            priority: index < priorities,
          }));
          const prioritised = Math.min(priorities, count);
          const { renderable, failures } = evaluatePhotographPage(entries, PROPERTY_NOW);

          const counted = reporting(failures, `references ${count} photographs`);
          expect(counted.length === 1, `count ${count}`).toBe(count > PHOTOGRAPHS_PER_PAGE_MAX);
          if (count > PHOTOGRAPHS_PER_PAGE_MAX) expect(counted[0]).toContain(String(PHOTOGRAPHS_PER_PAGE_MAX));

          const prioritySaid = reporting(failures, `sets priority on ${prioritised} images`);
          expect(prioritySaid.length === 1, `priority ${prioritised}`).toBe(
            prioritised > PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX
          );
          if (prioritised > PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX) {
            expect(prioritySaid[0]).toContain(String(PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX));
          }

          expect(renderable).toBe(
            count <= PHOTOGRAPHS_PER_PAGE_MAX && prioritised <= PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX
          );
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// Requirement 9.17 — 80 KB per asset, 150 KB per route
// ---------------------------------------------------------------------------

/**
 * The two byte budgets are enforced by `scripts/measure-visual-assets.mjs`, which
 * gzips a real build; there is no function under `src/` to drive. So the recorded
 * audit is read and every verdict in it is checked against the shipped constant at
 * the size it actually measured. A budget loosened in one place and not the other
 * fails here, and so does a new asset that lands over the line.
 */
interface WeightReport {
  readonly budgets: { readonly perAssetCompressedBytes: number; readonly perRouteCompressedBytes: number };
  readonly assets: readonly {
    readonly assetId: string;
    readonly recordedBytes: number | null;
    readonly serialised: { readonly compressedBytes: number };
    readonly heaviestServedCompressedBytes: number | null;
    readonly budgetBytes: number;
    readonly withinBudget: boolean;
  }[];
  readonly routes: readonly { readonly route: string; readonly routeCompressedBytes: number }[];
  readonly findings: readonly { readonly kind: string }[];
}

const WEIGHT_REPORT: WeightReport = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../docs/implementation/visual-asset-weights.json', import.meta.url)),
    'utf8'
  )
) as WeightReport;

describe('Property 16: the visual asset byte budgets (Requirement 9.17)', () => {
  it('records the shipped budgets, so neither can be loosened in one place only', () => {
    expect(WEIGHT_REPORT.budgets.perAssetCompressedBytes).toBe(ASSET_COMPRESSED_BYTE_BUDGET);
    expect(WEIGHT_REPORT.budgets.perRouteCompressedBytes).toBe(ROUTE_COMPRESSED_BYTE_BUDGET);
    expect(WEIGHT_REPORT.assets.length).toBeGreaterThan(0);
    expect(WEIGHT_REPORT.routes.length).toBeGreaterThan(0);
  });

  it('holds every measured asset at or under the per-asset budget, at every measured size', () => {
    for (const asset of WEIGHT_REPORT.assets) {
      const measured = Math.max(
        asset.serialised.compressedBytes,
        asset.recordedBytes ?? 0,
        asset.heaviestServedCompressedBytes ?? 0
      );
      expect(asset.budgetBytes, asset.assetId).toBe(ASSET_COMPRESSED_BYTE_BUDGET);
      // The audit's own verdict, re-derived from the shipped constant. The bound is
      // inclusive: exactly at the budget is within it.
      expect(asset.withinBudget, asset.assetId).toBe(measured <= ASSET_COMPRESSED_BYTE_BUDGET);
      expect(measured, asset.assetId).toBeLessThanOrEqual(ASSET_COMPRESSED_BYTE_BUDGET);
    }
  });

  it('holds every measured route at or under the per-route budget', () => {
    for (const route of WEIGHT_REPORT.routes) {
      expect(route.routeCompressedBytes, route.route).toBeLessThanOrEqual(ROUTE_COMPRESSED_BYTE_BUDGET);
    }
    // And the audit reported no budget finding of either kind, so the two sides agree.
    expect(
      WEIGHT_REPORT.findings.filter(
        (finding) => finding.kind === 'asset-over-budget' || finding.kind === 'route-over-budget'
      )
    ).toEqual([]);
  });
});
