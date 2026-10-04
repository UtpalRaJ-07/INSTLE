import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { LOCALITY_REGISTRY, LOCALITY_SLUG_ALIASES } from '@/config/localities';
import {
  validateEntityBoundaryDecision,
  type EntityBoundaryDecision,
} from '@internal/registers/entity-boundary-decisions';

import {
  PROPERTY_RUN_CONFIG,
  arbExistingRecordViews,
  arbLocalityCandidateRows,
  type ExistingRecordView,
  type LocalityCandidateRow,
} from './arbitraries';

import { seedLocalityCandidates } from '../../scripts/seed-locality-candidates.mjs';

/**
 * Property 6: Seeding a candidate list preserves identity and accounts for every
 * input.
 *
 * **Validates: Requirements 1.1, 1.2, 1.15, 4.1, 4.2**
 *
 * The one CSV in the repository exercises one ordering of one candidate set. The
 * rule that matters is about orderings in general: the earlier of two candidates
 * sharing a slug is seeded and the later is held. A unit test over the committed
 * CSV cannot distinguish "the algorithm resolves collisions by position" from "the
 * CSV happens to be ordered so that the right one wins".
 *
 * So the generator draws names and slugs from a small pool on purpose. Collisions
 * are the interesting case, and a pool of unique random slugs would seed every
 * candidate and hold none.
 */

type SeedResult = {
  seeded: Record<string, unknown>[];
  held: Record<string, unknown>[];
  accounting: {
    candidates: number;
    seeded: number;
    held: number;
    existing: number;
    registryTotal: number;
  };
};

const ALIAS_KEYS = { ...LOCALITY_SLUG_ALIASES };

/** The field set `LocalityRecord` defines, read off a hand-written record. */
const RECORD_FIELDS = Object.keys(LOCALITY_REGISTRY[0]).sort();

const REAL_EXISTING_RECORDS: readonly ExistingRecordView[] = LOCALITY_REGISTRY.slice(0, 5).map(
  (record) => ({
    entityId: record.entityId,
    slug: record.slug,
    canonicalName: record.canonicalName,
    aliases: record.aliases,
  })
);

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Every canonical name and alias the existing records answer to. */
function existingNameSet(records: readonly ExistingRecordView[]): Set<string> {
  const names = new Set<string>();
  for (const record of records) {
    names.add(normalise(record.canonicalName));
    for (const alias of record.aliases) names.add(normalise(alias));
  }
  return names;
}

function seed(
  rows: readonly LocalityCandidateRow[],
  existingRecords: readonly ExistingRecordView[]
): SeedResult {
  return seedLocalityCandidates(rows, {
    existingRecords,
    aliasKeys: ALIAS_KEYS,
    recordedOn: '2026-09-29',
  }) as SeedResult;
}

const arbSeedingInput = fc.tuple(arbLocalityCandidateRows, arbExistingRecordViews);

describe('Property 6: seeding accounts for every candidate', () => {
  it('seeds or holds every input row, and never both', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const { seeded, held, accounting } = seed(rows, existing);

        expect(seeded.length + held.length).toBe(rows.length);
        expect(accounting.candidates).toBe(rows.length);
        expect(accounting.seeded).toBe(seeded.length);
        expect(accounting.held).toBe(held.length);

        const seededIds = seeded.map((record) => String(record.entityId).replace('LOC-BLR-', ''));
        const heldIds = held.map((decision) => String(decision.candidateId));
        // Every row appears exactly once across the two outputs.
        expect([...seededIds, ...heldIds].sort()).toEqual(
          rows.map((row) => row.candidateId).sort()
        );
        expect(seededIds.filter((id) => heldIds.includes(id))).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('produces pairwise-distinct entityId and slug values', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const { seeded } = seed(rows, existing);

        const ids = seeded.map((record) => record.entityId);
        expect(new Set(ids).size).toBe(ids.length);

        const slugs = seeded.map((record) => record.slug);
        expect(new Set(slugs).size).toBe(slugs.length);

        // And distinct from everything already in the registry, including aliases.
        const existingSlugs = new Set(existing.map((record) => record.slug));
        const aliasKeys = new Set(Object.keys(ALIAS_KEYS));
        for (const slug of slugs) {
          expect(existingSlugs.has(String(slug))).toBe(false);
          expect(aliasKeys.has(String(slug))).toBe(false);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('seeds the earliest eligible candidate on each slug', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const aliasKeys = new Set(Object.keys(ALIAS_KEYS));
        const existingSlugs = new Set(existing.map((record) => record.slug));
        const existingNames = existingNameSet(existing);
        const { seeded } = seed(rows, existing);

        for (const record of seeded) {
          const slug = String(record.slug);
          // Every row that could legitimately have taken this slug, in input order.
          const eligible = rows.filter(
            (row) =>
              row.candidateSlug === slug &&
              !aliasKeys.has(row.candidateSlug) &&
              !existingSlugs.has(row.candidateSlug) &&
              !existingNames.has(normalise(row.candidateName))
          );
          expect(eligible.length, `nothing was eligible for "${slug}"`).toBeGreaterThan(0);
          // The earliest of them is the one that got it.
          expect(record.entityId).toBe(`LOC-BLR-${eligible[0].candidateId}`);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('holds the later candidate, naming what already held the slug', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const aliasKeys = new Set(Object.keys(ALIAS_KEYS));
        const existingBySlug = new Map(existing.map((record) => [record.slug, record]));
        const existingNames = existingNameSet(existing);
        const { seeded, held } = seed(rows, existing);

        const indexOf = new Map(rows.map((row, index) => [row.candidateId, index]));
        const seededIndex = new Map(
          seeded.map((record) => [
            String(record.slug),
            indexOf.get(String(record.entityId).replace('LOC-BLR-', '')) ?? -1,
          ])
        );

        for (const decision of held) {
          const candidateId = String(decision.candidateId);
          const slug = String(decision.candidateSlug);
          const kind = String(decision.collisionKind);

          switch (kind) {
            case 'alias-key':
              expect(aliasKeys.has(slug), `${candidateId}: "${slug}" is not an alias key`).toBe(true);
              expect(decision.collidingSlug).toBe(ALIAS_KEYS[slug as keyof typeof ALIAS_KEYS]);
              break;
            case 'existing-record-slug':
              expect(existingBySlug.has(slug), `${candidateId}: "${slug}" is free`).toBe(true);
              expect(decision.existingEntityId).toBe(existingBySlug.get(slug)!.entityId);
              break;
            case 'seeded-candidate-slug': {
              // An earlier candidate took the slug, so the held one is genuinely later.
              const earlier = seededIndex.get(slug);
              expect(earlier, `${candidateId}: nothing was seeded on "${slug}"`).toBeDefined();
              expect(earlier!).toBeLessThan(indexOf.get(candidateId)!);
              expect(decision.collidingSlug).toBe(slug);
              break;
            }
            case 'existing-record-name':
            case 'preserved-entity-overlap':
              expect(
                existingNames.has(normalise(String(decision.candidateName))),
                `${candidateId}: "${String(decision.candidateName)}" matches no existing name`
              ).toBe(true);
              // The colliding slug is the existing record's, not the candidate's.
              expect(decision.collidingSlug).not.toBe(slug);
              break;
            default:
              throw new Error(`unrecognised collision kind "${kind}"`);
          }
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('records a usable entity-boundary decision for every held candidate', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const { held } = seed(rows, existing);
        for (const decision of held) {
          const validation = validateEntityBoundaryDecision(
            decision as unknown as EntityBoundaryDecision
          );
          expect(validation, String(decision.decisionId)).toEqual({ ok: true, failures: [] });
          // The question has to name the candidate it defers, or a reader cannot
          // act on it.
          expect(String(decision.questionToAnswer)).toContain(String(decision.candidateId));
          expect(decision.resolution).toBeNull();
        }
        // Decision identifiers are unique within a run.
        const ids = held.map((decision) => decision.decisionId);
        expect(new Set(ids).size).toBe(ids.length);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('populates every field with a value, an explicit null or an empty collection', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const { seeded } = seed(rows, existing);
        for (const record of seeded) {
          expect(Object.keys(record).sort()).toEqual(RECORD_FIELDS);
          for (const field of RECORD_FIELDS) {
            // `undefined` is the one thing a seeded field may never be: it reads
            // the same as "not yet decided" and the same as "forgotten".
            expect(record[field], `${String(record.entityId)}.${field}`).not.toBeUndefined();
          }
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('starts every seeded record unconfirmed, unowned, candidate and unpublished', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const { seeded } = seed(rows, existing);
        for (const record of seeded) {
          expect(record.actualServiceCoverage).toBe('unconfirmed');
          expect(record.coverageResponsibleOwner).toBeNull();
          expect(record.editorialStatus).toBe('candidate');
          expect(record.publicationStatus).toBe('unpublished');
          // Nothing plausible-looking anywhere else.
          expect(record.administrativeMappings).toEqual([]);
          expect(record.postalMappingIds).toEqual([]);
          expect(record.sections).toEqual([]);
          expect(record.author).toBeNull();
          expect(record.localReviewer).toBeNull();
          expect(record.seoReviewer).toBeNull();
          expect(record.nextReviewAt).toBeNull();
          expect(record.primaryIntent).toBeNull();
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('carries the candidate name and slug through verbatim', () => {
    fc.assert(
      fc.property(arbSeedingInput, ([rows, existing]) => {
        const { seeded } = seed(rows, existing);
        const rowById = new Map(rows.map((row) => [row.candidateId, row]));
        for (const record of seeded) {
          const row = rowById.get(String(record.entityId).replace('LOC-BLR-', ''));
          expect(row).toBeDefined();
          expect(record.canonicalName).toBe(row!.candidateName);
          expect(record.slug).toBe(row!.candidateSlug);
          // The research question survives as the first blocking note.
          expect((record.blockingNotes as string[])[0]).toBe(
            `Research question: ${row!.researchQuestion}`
          );
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('accounts for every candidate against the five records the repository holds', () => {
    // The generated existing-record sets are drawn from the same pools, which
    // makes them adversarial. This case pins the property to the real registry.
    fc.assert(
      fc.property(arbLocalityCandidateRows, (rows) => {
        const { seeded, held } = seed(rows, REAL_EXISTING_RECORDS);
        expect(seeded.length + held.length).toBe(rows.length);
        const realSlugs = new Set(REAL_EXISTING_RECORDS.map((record) => record.slug));
        for (const record of seeded) {
          expect(realSlugs.has(String(record.slug))).toBe(false);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});
