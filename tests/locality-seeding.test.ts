import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  LOCALITY_REGISTRY,
  LOCALITY_SLUG_ALIASES,
  getPublishedLocalities,
  isLocalityPublishable,
  type LocalityRecord,
} from '@/config/localities';
import { SEEDED_LOCALITY_CANDIDATES } from '@/config/locality-registry';

import { ENTITY_BOUNDARY_DECISIONS } from '@internal/registers/entity-boundary-decisions';
import { SEARCH_INTENT_ENTRIES } from '@internal/registers/search-intent';

import {
  CSV_PATH,
  candidatesFromCsv,
  generateFromRepository,
  mapEntityType,
  stripResearchGroupSuffix,
} from '../scripts/seed-locality-candidates.mjs';

/**
 * Seeding the Research_Backlog.
 *
 * Requirement 1.1 says each of the 132 candidates becomes exactly one typed
 * record with a unique `entityId` and a unique `slug`, and that every field
 * carries a researched value or an explicit null or empty collection.
 * Requirement 1.15 says a candidate colliding with something already in the
 * registry is kept out and recorded as an open entity-boundary decision instead.
 *
 * Those two pull in opposite directions unless the arithmetic is written down, so
 * this file writes it down: **127 seeded + 5 held + 5 existing = 132**. A
 * candidate that quietly disappeared would break the sum, and a candidate seeded
 * over an existing slug would break the uniqueness assertion. Neither can pass
 * silently.
 *
 * The seeded records are generated, so the generator and the committed files are
 * compared here too. A hand edit to a generated file fails this suite rather than
 * surviving until the next regeneration overwrites it.
 */

const ROOT = join(__dirname, '..');
const NOW = new Date('2026-09-29T00:00:00.000Z');

const CSV_CANDIDATES = candidatesFromCsv(readFileSync(CSV_PATH, 'utf8'));
const GENERATED = generateFromRepository();

const HELD_CANDIDATE_IDS = ['AREA-016', 'AREA-021', 'AREA-053', 'AREA-055', 'AREA-077'] as const;

/** The five records the repository held before the backlog was seeded. */
const EXISTING_ENTITY_IDS = [
  'LOC-BLR-INDIRANAGAR',
  'LOC-BLR-KORAMANGALA',
  'LOC-BLR-SADASHIVANAGAR',
  'LOC-BLR-HEBBAL',
  'LOC-BLR-WHITEFIELD-INNER',
] as const;

describe('the candidate accounting', () => {
  it('reads all 132 backlog candidates', () => {
    expect(CSV_CANDIDATES).toHaveLength(132);
    // A parser that dropped a column would still count rows, so check the row
    // shape too: every candidate needs an ID, a name and a slug to be seedable.
    for (const candidate of CSV_CANDIDATES) {
      expect(candidate.candidateId, JSON.stringify(candidate)).toMatch(/^AREA-\d{3}$/);
      expect(candidate.candidateName.length).toBeGreaterThan(0);
      expect(candidate.candidateSlug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('accounts for every candidate as seeded or held', () => {
    const { accounting } = GENERATED.result;
    expect(accounting.seeded).toBe(127);
    expect(accounting.held).toBe(5);
    expect(accounting.existing).toBe(5);
    expect(accounting.seeded + accounting.held).toBe(accounting.candidates);
    expect(accounting.candidates).toBe(132);
  });

  /**
   * 127 seeded, 5 held, 5 existing — and two separate sums that both land on 132.
   *
   *   127 seeded + 5 held     = 132 backlog candidates accounted for
   *   127 seeded + 5 existing = 132 registry records
   *
   * The two fives are the same five places seen from either side, which is why
   * both sums agree: each pre-existing record blocks exactly one candidate. The
   * assertion below says that explicitly, because "132" appearing twice for
   * unrelated reasons would be a coincidence worth distrusting.
   */
  it('sums 127 seeded with 5 held to the candidates, and with 5 existing to the registry', () => {
    expect(SEEDED_LOCALITY_CANDIDATES).toHaveLength(127);
    expect(ENTITY_BOUNDARY_DECISIONS).toHaveLength(5);
    expect(EXISTING_ENTITY_IDS).toHaveLength(5);

    expect(SEEDED_LOCALITY_CANDIDATES.length + ENTITY_BOUNDARY_DECISIONS.length).toBe(132);
    expect(SEEDED_LOCALITY_CANDIDATES.length + EXISTING_ENTITY_IDS.length).toBe(132);

    const blocking = ENTITY_BOUNDARY_DECISIONS.map((decision) => decision.existingEntityId);
    expect(new Set(blocking).size).toBe(5);
    expect([...blocking].sort()).toEqual([...EXISTING_ENTITY_IDS].sort());
  });

  it('holds 132 registry records once the existing five are counted', () => {
    expect(LOCALITY_REGISTRY).toHaveLength(132);
    for (const entityId of EXISTING_ENTITY_IDS) {
      expect(LOCALITY_REGISTRY.map((record) => record.entityId)).toContain(entityId);
    }
  });

  it('holds out exactly the five candidates that collide', () => {
    expect(GENERATED.result.held.map((decision) => decision.candidateId)).toEqual([
      ...HELD_CANDIDATE_IDS,
    ]);
    expect(ENTITY_BOUNDARY_DECISIONS.map((decision) => decision.candidateId)).toEqual([
      ...HELD_CANDIDATE_IDS,
    ]);
    // And none of them reached the registry.
    const seededIds = SEEDED_LOCALITY_CANDIDATES.map((record) => record.entityId);
    for (const candidateId of HELD_CANDIDATE_IDS) {
      expect(seededIds).not.toContain(`LOC-BLR-${candidateId}`);
    }
  });

  it('records each held candidate against the slug that blocked it', () => {
    expect(
      ENTITY_BOUNDARY_DECISIONS.map((decision) => [
        decision.candidateId,
        decision.candidateSlug,
        decision.collisionKind,
        decision.collidingSlug,
      ])
    ).toEqual([
      ['AREA-016', 'sadashivanagar', 'existing-record-slug', 'sadashivanagar'],
      ['AREA-021', 'hebbal', 'preserved-entity-overlap', 'north-bengaluru'],
      ['AREA-053', 'indiranagar', 'existing-record-slug', 'indiranagar'],
      ['AREA-055', 'whitefield', 'existing-record-name', 'whitefield-inner-enclaves'],
      ['AREA-077', 'koramangala', 'existing-record-slug', 'koramangala'],
    ]);
  });

  it('records both identifiers and a real question on every held candidate', () => {
    for (const decision of ENTITY_BOUNDARY_DECISIONS) {
      expect(decision.candidateId, decision.decisionId).toMatch(/^AREA-\d{3}$/);
      expect(decision.existingEntityId, decision.decisionId).toMatch(/^LOC-BLR-/);
      expect(decision.questionToAnswer, decision.decisionId).toContain('?');
      expect(decision.questionToAnswer, decision.decisionId).toContain(decision.candidateId);
      expect(decision.resolution, `${decision.decisionId} must still be open`).toBeNull();
    }
  });
});

describe('the preserved north-bengaluru record', () => {
  const preserved = LOCALITY_REGISTRY.find((record) => record.slug === 'north-bengaluru');

  it('is still in the registry, unchanged', () => {
    expect(preserved).toBeDefined();
    expect(preserved!.entityId).toBe('LOC-BLR-HEBBAL');
    expect(preserved!.canonicalName).toBe('Hebbal');
    expect(preserved!.entityType).toBe('corridor');
    expect(preserved!.marketingGroup).toBe('North Bengaluru');
  });

  it('gained no second record covering the same entity', () => {
    // Requirement 1.10. Seeding `hebbal` would have created two records for one
    // entity, so the candidate is held rather than seeded.
    expect(LOCALITY_REGISTRY.map((record) => record.slug)).not.toContain('hebbal');
    expect(
      LOCALITY_REGISTRY.filter((record) => record.canonicalName.toLowerCase() === 'hebbal')
    ).toHaveLength(1);
  });

  it('keeps D-IMPL-06 open and names it on the held candidate', () => {
    const log = readFileSync(join(ROOT, 'docs', 'implementation', 'DECISION-LOG.md'), 'utf8');
    const section = log.slice(log.indexOf('## D-IMPL-06'));
    expect(section.length).toBeGreaterThan(0);
    expect(section.toLowerCase()).toContain('open');

    const hebbal = ENTITY_BOUNDARY_DECISIONS.find((entry) => entry.candidateId === 'AREA-021');
    expect(hebbal?.decisionLogReference).toBe('D-IMPL-06');
    expect(hebbal?.resolution).toBeNull();
  });
});

describe('identity is preserved across seeding', () => {
  it('gives every record in the registry a unique entityId', () => {
    const ids = LOCALITY_REGISTRY.map((record) => record.entityId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every record in the registry a unique slug', () => {
    const slugs = LOCALITY_REGISTRY.map((record) => record.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('seeds no slug that is an alias key', () => {
    const aliasKeys = Object.keys(LOCALITY_SLUG_ALIASES);
    expect(aliasKeys.length).toBeGreaterThan(0);
    for (const record of LOCALITY_REGISTRY) {
      expect(aliasKeys, `${record.slug} must not shadow an alias`).not.toContain(record.slug);
    }
  });

  it('carries the candidate name and slug through verbatim', () => {
    const byId = new Map(CSV_CANDIDATES.map((candidate) => [candidate.candidateId, candidate]));
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      const candidateId = record.entityId.replace('LOC-BLR-', '');
      const candidate = byId.get(candidateId);
      expect(candidate, `${record.entityId} must trace to a backlog row`).toBeDefined();
      expect(record.canonicalName).toBe(candidate!.candidateName);
      expect(record.slug).toBe(candidate!.candidateSlug);
      expect(record.entityId).toBe(`LOC-BLR-${candidate!.candidateId}`);
    }
  });

  it('maps the two unsettled provisional types without claiming them', () => {
    const unsettled = CSV_CANDIDATES.filter(
      (candidate) => !mapEntityType(candidate.entityTypeProvisional).settled
    );
    // One `junction-area` row and nine `outer-place` rows in the backlog today.
    // Neither is a settled entity type, so neither becomes one.
    expect(unsettled).toHaveLength(10);
    expect(
      new Set(unsettled.map((candidate) => candidate.entityTypeProvisional))
    ).toEqual(new Set(['junction-area', 'outer-place']));

    for (const candidate of unsettled) {
      const record = SEEDED_LOCALITY_CANDIDATES.find(
        (seeded) => seeded.entityId === `LOC-BLR-${candidate.candidateId}`
      );
      expect(record, candidate.candidateId).toBeDefined();
      expect(record!.entityType).toBe('micro-locality');
      // The original value survives as a note rather than becoming a type.
      expect(record!.blockingNotes.join(' ')).toContain(candidate.entityTypeProvisional);
    }
  });

  it('strips the research-group label off every browsing group', () => {
    const groups = new Set(SEEDED_LOCALITY_CANDIDATES.map((record) => record.marketingGroup));
    expect(groups.size).toBe(6);
    for (const group of groups) {
      expect(group).not.toMatch(/research group/i);
      expect(group).not.toMatch(/\b(ward|zone|bbmp|bda|pin\s*code|postal|municipal)\b/i);
      expect(stripResearchGroupSuffix(group)).toBe(group);
    }
  });
});

describe('every seeded record starts in the Requirement 1.2 state', () => {
  /** The field set `LocalityRecord` defines, taken from a hand-written record. */
  const FIELD_NAMES = Object.keys(LOCALITY_REGISTRY[0]).sort();

  it('declares every field the type requires', () => {
    expect(FIELD_NAMES.length).toBeGreaterThan(30);
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      expect(Object.keys(record).sort(), record.entityId).toEqual(FIELD_NAMES);
    }
  });

  it('records coverage as unconfirmed with nobody accountable', () => {
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      expect(record.actualServiceCoverage, record.entityId).toBe('unconfirmed');
      expect(record.coverageResponsibleOwner, record.entityId).toBeNull();
      expect(record.editorialStatus, record.entityId).toBe('candidate');
      expect(record.publicationStatus, record.entityId).toBe('unpublished');
    }
  });

  it('leaves every unresearched field an explicit null', () => {
    const nullFields = [
      'coverageResponsibleOwner',
      'author',
      'localReviewer',
      'seoReviewer',
      'editorialApprovedAt',
      'localReviewApprovedAt',
      'seoReviewApprovedAt',
      'sourceCheckedAt',
      'nextReviewAt',
      'contentUpdatedAt',
      'primaryIntent',
    ] as const;
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      for (const field of nullFields) {
        expect(record[field], `${record.entityId}.${field}`).toBeNull();
      }
    }
  });

  it('leaves every unresearched collection empty rather than plausible', () => {
    const emptyFields = [
      'aliases',
      'administrativeMappings',
      'summaryClaimIds',
      'sections',
      'approvedFaq',
      'approvedNearbyRelationships',
      'relatedGuideIds',
      'postalMappingIds',
      'imageRightsRecords',
      'supportingPhrases',
      'visualAssetIds',
    ] as const;
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      for (const field of emptyFields) {
        expect(record[field], `${record.entityId}.${field}`).toEqual([]);
      }
    }
  });

  it('says why each candidate is blocked, in its own words', () => {
    const questions = new Set<string>();
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      expect(record.blockingNotes.length, record.entityId).toBeGreaterThan(0);
      const question = record.blockingNotes[0];
      expect(question, record.entityId).toMatch(/^Research question: /);
      // 132 distinct research questions in the backlog: a shared note would mean
      // a template rather than research.
      expect(questions.has(question), `${record.entityId} repeats a research question`).toBe(false);
      questions.add(question);
    }
    expect(questions.size).toBe(127);
  });

  it('changes no publishable count', () => {
    // 127 more records, still zero pages. The gate is the only visibility rule and
    // none of these records carries coverage, a reviewer, a date or a section.
    expect(getPublishedLocalities(NOW)).toEqual([]);
    for (const record of LOCALITY_REGISTRY) {
      expect(isLocalityPublishable(record, NOW), record.slug).toBe(false);
    }
  });
});

describe('the generated files match the generator', () => {
  it('writes the seeded records into one file per research group', () => {
    const generatedPaths = Object.keys(GENERATED.files)
      .map((filePath) => relative(ROOT, filePath))
      .sort();
    expect(generatedPaths).toEqual([
      join('src', 'config', 'locality-registry', 'central.ts'),
      join('src', 'config', 'locality-registry', 'east.ts'),
      join('src', 'config', 'locality-registry', 'index.ts'),
      join('src', 'config', 'locality-registry', 'north-and-north-east.ts'),
      join('src', 'config', 'locality-registry', 'outer-place.ts'),
      join('src', 'config', 'locality-registry', 'south-and-south-east.ts'),
      join('src', 'config', 'locality-registry', 'west-and-south-west.ts'),
    ]);
  });

  it('has no drift between the committed files and a fresh run', () => {
    const drift: string[] = [];
    for (const [filePath, contents] of Object.entries(GENERATED.files)) {
      const onDisk = readFileSync(filePath as string, 'utf8');
      if (onDisk !== (contents as string)) drift.push(relative(ROOT, filePath as string));
    }
    expect(drift).toEqual([]);
  });

  it('produces the same records the registry exports', () => {
    const fresh = new Map(
      GENERATED.result.seeded.map((record: Record<string, unknown>) => [record.entityId, record])
    );
    expect(fresh.size).toBe(SEEDED_LOCALITY_CANDIDATES.length);
    for (const record of SEEDED_LOCALITY_CANDIDATES) {
      expect(fresh.get(record.entityId), record.entityId).toEqual(record);
    }
  });
});

describe('the three fields Requirement 3.6 and 9.2 add', () => {
  it('defaults them on every record, seeded and hand-written alike', () => {
    for (const record of LOCALITY_REGISTRY) {
      expect(record.primaryIntent, record.slug).toBeNull();
      expect(record.supportingPhrases, record.slug).toEqual([]);
      expect(record.visualAssetIds, record.slug).toEqual([]);
    }
  });

  it('retains imageRightsRecords alongside visualAssetIds', () => {
    // Requirement 10 photographs keep their own field. `visualAssetIds` points at
    // Media_Register components, which are not files and carry no licence.
    for (const record of LOCALITY_REGISTRY) {
      expect(Array.isArray(record.imageRightsRecords), record.slug).toBe(true);
      expect(record.imageRightsRecords, record.slug).toEqual([]);
    }
  });

  /**
   * The point of copying the phrase onto the record is that the page never reads
   * the Search_Intent_Register — the register is outside the app module graph, so
   * it cannot. This test is the other half of that arrangement: it imports both
   * sides and asserts the copy is faithful.
   *
   * No record carries a phrase yet, because no phrase has been researched under a
   * named tool. The assertion is written over whatever both sides hold, so it
   * gains teeth the moment the first approval happens rather than needing to be
   * rewritten then.
   */
  it('traces every phrase on a record back to a register entry', () => {
    const entriesById = new Map(SEARCH_INTENT_ENTRIES.map((entry) => [entry.entryId, entry]));
    const registerPhrases = new Set(SEARCH_INTENT_ENTRIES.map((entry) => entry.phrase));

    const untraceable: string[] = [];
    for (const record of LOCALITY_REGISTRY) {
      if (record.primaryIntent) {
        const entry = entriesById.get(record.primaryIntent.intentEntryId);
        if (!entry) {
          untraceable.push(`${record.slug}: no register entry ${record.primaryIntent.intentEntryId}`);
        } else if (entry.phrase !== record.primaryIntent.phrase) {
          untraceable.push(
            `${record.slug}: phrase "${record.primaryIntent.phrase}" does not match entry ${entry.entryId}`
          );
        }
      }
      for (const phrase of record.supportingPhrases) {
        if (!registerPhrases.has(phrase)) {
          untraceable.push(`${record.slug}: supporting phrase "${phrase}" is in no register entry`);
        }
      }
      expect(record.supportingPhrases.length, `${record.slug} may carry at most 5`).toBeLessThanOrEqual(
        5
      );
    }
    expect(untraceable).toEqual([]);
  });

  it('holds no phrase today, and says so rather than inventing one', () => {
    expect(SEARCH_INTENT_ENTRIES).toEqual([]);
    const withPhrases = LOCALITY_REGISTRY.filter(
      (record: LocalityRecord) => record.primaryIntent !== null || record.supportingPhrases.length > 0
    );
    expect(withPhrases).toEqual([]);
  });
});
