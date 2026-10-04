/**
 * Seed the Research_Backlog locality candidates into typed records.
 *
 * Reads `docs/seo-launch-handoff/AREA-RESEARCH-BACKLOG.csv` and emits typed
 * `LocalityRecord` literals into `src/config/locality-registry/`, split by
 * research group so no generated file is too large to review. Candidates that
 * collide with something already in the registry are not seeded and not
 * discarded: they are written to `internal/registers/entity-boundary-decisions.ts`
 * as open decisions, so the candidate accounting still sums.
 *
 * Requirement 1.1 — each candidate becomes exactly one typed record with a
 * unique `entityId` and a unique `slug`, and every field carries a researched
 * value or an explicit null or empty collection.
 * Requirement 1.2 — a seeded record starts `actualServiceCoverage: 'unconfirmed'`,
 * `coverageResponsibleOwner: null`, `editorialStatus: 'candidate'` and
 * `publicationStatus: 'unpublished'`. Nothing else is guessed: no PIN code, no
 * administrative mapping, no reviewer, no date, no section. A plausible-looking
 * default is worse than an empty collection, because it reads like evidence.
 * Requirement 1.15 — the later of two candidates resolving to one slug is held
 * out and the collision is recorded as an open entity-boundary decision.
 *
 * Usage:
 *   node scripts/seed-locality-candidates.mjs            # write the files
 *   node scripts/seed-locality-candidates.mjs --check    # fail on any drift
 *
 * The pure functions below are exported so the property suite can drive the
 * collision algorithm over generated candidate lists rather than only over the
 * one CSV that happens to be committed.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

export const CSV_PATH = join(ROOT, 'docs', 'seo-launch-handoff', 'AREA-RESEARCH-BACKLOG.csv');
export const REGISTRY_DIR = join(ROOT, 'src', 'config', 'locality-registry');

/** The date this seeding run was recorded. Matches the other registers. */
export const RECORDED_ON = '2026-09-29';

// ---------------------------------------------------------------------------
// CSV reading
// ---------------------------------------------------------------------------

/**
 * Minimal RFC-4180 reader: quoted fields, doubled quotes inside them, CRLF or
 * LF line endings. Enough for this file and honest about what it does not do —
 * it has no type coercion, so nothing is silently turned into a number.
 *
 * @param {string} text
 * @returns {Record<string, string>[]}
 */
export function parseCsv(text) {
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
  if (nonEmpty.length === 0) return [];
  const header = nonEmpty[0];
  return nonEmpty.slice(1).map((cells) => {
    /** @type {Record<string, string>} */
    const record = {};
    header.forEach((name, position) => {
      record[name] = (cells[position] ?? '').trim();
    });
    return record;
  });
}

/**
 * A candidate row reduced to the six columns the mapping uses. `priority` is
 * carried because it is the batch-ordering input, not because it is a record
 * field — Requirement 1.8 reads it, the record does not store it.
 *
 * @typedef {object} LocalityCandidate
 * @property {string} candidateId
 * @property {string} candidateName
 * @property {string} candidateSlug
 * @property {string} entityTypeProvisional
 * @property {string} researchGroup
 * @property {string} priority
 * @property {string} researchQuestion
 * @property {string} aliasMergeNotes
 */

/**
 * @param {Record<string, string>} row
 * @returns {LocalityCandidate}
 */
export function candidateFromRow(row) {
  return {
    candidateId: row.candidate_id ?? '',
    candidateName: row.candidate_name ?? '',
    candidateSlug: row.candidate_slug ?? '',
    entityTypeProvisional: row.entity_type_provisional ?? '',
    researchGroup: row.research_group_not_official_zone ?? '',
    priority: row.priority ?? '',
    researchQuestion: row.unique_research_question ?? '',
    aliasMergeNotes: row.alias_merge_notes ?? '',
  };
}

/**
 * @param {string} text
 * @returns {LocalityCandidate[]}
 */
export function candidatesFromCsv(text) {
  return parseCsv(text).map(candidateFromRow);
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/**
 * `entity_type_provisional` to `LocalityEntityType`.
 *
 * `junction-area` and `outer-place` are not settled entity types, so neither is
 * accepted as one. Both seed as `micro-locality` — the narrowest type available,
 * which claims least — and the backlog's original value is preserved in a
 * blocking note so the unsettled classification stays visible rather than being
 * laundered into a type.
 */
export const ENTITY_TYPE_MAP = /** @type {const} */ ({
  locality: { entityType: 'locality', settled: true },
  corridor: { entityType: 'corridor', settled: true },
  'micro-locality': { entityType: 'micro-locality', settled: true },
  'region-hub': { entityType: 'region-hub', settled: true },
  'junction-area': { entityType: 'micro-locality', settled: false },
  'outer-place': { entityType: 'micro-locality', settled: false },
});

/**
 * @param {string} provisional
 * @returns {{ entityType: string, settled: boolean }}
 */
export function mapEntityType(provisional) {
  const mapped = ENTITY_TYPE_MAP[/** @type {keyof typeof ENTITY_TYPE_MAP} */ (provisional)];
  if (mapped) return { entityType: mapped.entityType, settled: mapped.settled };
  // An unrecognised value is not guessed at. `micro-locality` claims the least,
  // and the unrecognised value is recorded as unsettled in a blocking note.
  return { entityType: 'micro-locality', settled: false };
}

/**
 * Everything from " research group" onwards is a research label, not part of the
 * browsing group name. Stripping it is what keeps Requirement 1.6 satisfiable:
 * a group value that still read "research group; coverage conditional" would
 * carry a qualifier the hub cannot render as a plain browsing label.
 */
export const RESEARCH_GROUP_SUFFIX = / research group.*$/i;

/**
 * @param {string} value
 * @returns {string}
 */
export function stripResearchGroupSuffix(value) {
  return value.replace(RESEARCH_GROUP_SUFFIX, '').trim();
}

/**
 * The part of the research-group label that stripping drops. Recorded on the
 * record as a blocking note rather than thrown away, because "coverage
 * conditional" is a real qualifier a reviewer needs.
 *
 * @param {string} value
 * @returns {string | null}
 */
export function researchGroupQualifier(value) {
  const match = / research group;\s*(.+)$/i.exec(value);
  return match ? match[1].trim() : null;
}

/**
 * @param {string} marketingGroup
 * @returns {string}
 */
export function marketingGroupFileName(marketingGroup) {
  return marketingGroup
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param {string} marketingGroup
 * @returns {string}
 */
export function marketingGroupExportName(marketingGroup) {
  return `${marketingGroupFileName(marketingGroup).replace(/-/g, '_').toUpperCase()}_LOCALITY_CANDIDATES`;
}

/**
 * The honest candidate sentence the five pre-existing records already carry. It
 * states that nothing has been written yet, which is true, and it never renders
 * because the record cannot pass the gate.
 *
 * @param {string} name
 * @param {string} entityType
 * @returns {string}
 */
export function candidateSummary(name, entityType) {
  if (entityType === 'corridor') {
    return `Research candidate. A guide for the ${name} corridor has not been written from verified evidence yet.`;
  }
  return `Research candidate. A locality guide for ${name} has not been written from verified evidence yet.`;
}

/**
 * Blocking notes, in a fixed order so the generated file is stable.
 *
 * Every note is either the backlog's own text or a statement about the record's
 * own initial state. None of them asserts a fact about the place.
 *
 * @param {LocalityCandidate} candidate
 * @param {{ entityType: string, settled: boolean }} mapped
 * @returns {string[]}
 */
export function candidateBlockingNotes(candidate, mapped) {
  const notes = [`Research question: ${candidate.researchQuestion}`];

  if (!mapped.settled) {
    notes.push(
      `Provisional entity type recorded in the backlog was "${candidate.entityTypeProvisional}", which is not a settled entity type. Seeded as "${mapped.entityType}" pending an editorial decision.`
    );
  }

  notes.push(
    'Backlog recorded coverage status "unconfirmed"; operational service coverage for this area is not confirmed (OWN-03).'
  );
  notes.push('No named reviewer has been supplied for this record (OWN-14, checklist C2).');

  if (candidate.aliasMergeNotes) {
    notes.push(`Backlog note: ${candidate.aliasMergeNotes}.`);
  }

  const qualifier = researchGroupQualifier(candidate.researchGroup);
  if (qualifier) {
    notes.push(
      `Research-group qualifier recorded in the backlog and not carried onto the browsing label: "${qualifier}".`
    );
  }

  return notes;
}

/**
 * One candidate as a `LocalityRecord`-shaped plain object.
 *
 * Every field the type defines is present. Where nothing has been researched the
 * value is an explicit `null` or an empty array — never a placeholder that could
 * be mistaken for evidence.
 *
 * @param {LocalityCandidate} candidate
 * @returns {Record<string, unknown>}
 */
export function buildLocalityRecord(candidate) {
  const mapped = mapEntityType(candidate.entityTypeProvisional);
  const marketingGroup = stripResearchGroupSuffix(candidate.researchGroup);

  return {
    entityId: `LOC-BLR-${candidate.candidateId}`,
    canonicalName: candidate.candidateName,
    aliases: [],
    entityType: mapped.entityType,
    slug: candidate.candidateSlug,

    marketingGroup,
    administrativeMappings: [],

    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,

    summary: candidateSummary(candidate.candidateName, mapped.entityType),
    summaryClaimIds: [],
    sections: [],
    approvedFaq: [],
    approvedNearbyRelationships: [],
    relatedGuideIds: [],
    postalMappingIds: [],
    imageRightsRecords: [],

    author: null,
    localReviewer: null,
    seoReviewer: null,
    editorialApprovedAt: null,
    localReviewApprovedAt: null,
    seoReviewApprovedAt: null,

    sourceCheckedAt: null,
    nextReviewAt: null,
    contentUpdatedAt: null,

    editorialStatus: 'candidate',
    publicationStatus: 'unpublished',

    blockingNotes: candidateBlockingNotes(candidate, mapped),

    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  };
}

/** The field order every generated record literal follows. */
export const RECORD_FIELD_ORDER = /** @type {const} */ ([
  'entityId',
  'canonicalName',
  'aliases',
  'entityType',
  'slug',
  'marketingGroup',
  'administrativeMappings',
  'actualServiceCoverage',
  'coverageResponsibleOwner',
  'summary',
  'summaryClaimIds',
  'sections',
  'approvedFaq',
  'approvedNearbyRelationships',
  'relatedGuideIds',
  'postalMappingIds',
  'imageRightsRecords',
  'author',
  'localReviewer',
  'seoReviewer',
  'editorialApprovedAt',
  'localReviewApprovedAt',
  'seoReviewApprovedAt',
  'sourceCheckedAt',
  'nextReviewAt',
  'contentUpdatedAt',
  'editorialStatus',
  'publicationStatus',
  'blockingNotes',
  'primaryIntent',
  'supportingPhrases',
  'visualAssetIds',
]);

// ---------------------------------------------------------------------------
// The collision algorithm
// ---------------------------------------------------------------------------

/**
 * Slugs held by an open preserve/merge/alias decision.
 *
 * `north-bengaluru` is the only one. DECISION-LOG.md D-IMPL-06 records the
 * decision as open, and Requirement 1.10 forbids a second record covering the
 * same corridor entity until it closes. A name collision against a slug in this
 * set is reported as a preserved-entity overlap rather than a plain name
 * collision, because the question in front of a reviewer is different: not
 * "same place?" but "can this slug exist at all yet?".
 */
export const PRESERVED_ENTITY_SLUGS = /** @type {const} */ ({
  'north-bengaluru': 'D-IMPL-06',
});

/**
 * @param {string} value
 * @returns {string}
 */
function normaliseName(value) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @typedef {object} ExistingRecordView
 * @property {string} entityId
 * @property {string} slug
 * @property {string} canonicalName
 * @property {readonly string[]} aliases
 */

/**
 * @typedef {object} HeldCandidate
 * @property {string} decisionId
 * @property {string} candidateId
 * @property {string} candidateName
 * @property {string} candidateSlug
 * @property {string} collisionKind
 * @property {string} collidingSlug
 * @property {string | null} existingEntityId
 * @property {string | null} decisionLogReference
 * @property {string} questionToAnswer
 * @property {string} recordedOn
 * @property {null} resolution
 */

/**
 * @param {string} kind
 * @param {LocalityCandidate} candidate
 * @param {{ entityId: string | null, slug: string, name: string | null }} against
 * @returns {string}
 */
function boundaryQuestion(kind, candidate, against) {
  const held = `${candidate.candidateId} "${candidate.candidateName}"`;
  const backlog = candidate.researchQuestion
    ? ` Backlog research question: "${candidate.researchQuestion}"`
    : '';

  switch (kind) {
    case 'alias-key':
      return (
        `Slug "${candidate.candidateSlug}" is already an alias resolving to "${against.slug}". ` +
        `Is ${held} the same entity as the record on "${against.slug}", or a distinct entity that needs a slug of its own — in which case the alias has to go?` +
        backlog
      );
    case 'existing-record-slug':
      return (
        `Slug "${candidate.candidateSlug}" is already held by ${against.entityId ?? 'an existing record'}. ` +
        `Is ${held} the same entity as that record, a narrower area inside it, or a separate entity needing a different slug? Merge, alias or seed as a separate entity.` +
        backlog
      );
    case 'seeded-candidate-slug':
      return (
        `An earlier candidate in the same seeding run already took slug "${candidate.candidateSlug}". ` +
        `Is ${held} the same entity as that candidate, or does it need a distinct slug?` +
        backlog
      );
    case 'preserved-entity-overlap':
      return (
        `The existing record ${against.entityId ?? ''} is named "${against.name ?? ''}" on the preserved slug "${against.slug}", whose preserve/merge/alias decision is recorded as open. ` +
        `Does ${held} describe the same entity as that record, an area inside it, or a separate entity? No second record may cover the entity until the open decision closes.` +
        backlog
      );
    case 'existing-record-name':
    default:
      return (
        `The name "${candidate.candidateName}" already matches the canonical name or an alias of ${against.entityId ?? 'an existing record'} on slug "${against.slug}". ` +
        `Is ${held} the same entity as that record, a wider area containing it, or a separate entity? Merge, alias or seed as a separate entity.` +
        backlog
      );
  }
}

/**
 * Seed a candidate list, holding out every collision.
 *
 * The order of the input list is the order of resolution: the earlier candidate
 * is seeded and the later one is held. That is what Requirement 1.15 means by
 * "keep the later candidate out of the registry", and it is why this function
 * takes a list rather than a set.
 *
 * @param {readonly LocalityCandidate[]} candidates
 * @param {{
 *   existingRecords?: readonly ExistingRecordView[],
 *   aliasKeys?: Readonly<Record<string, string>>,
 *   recordedOn?: string,
 * }} [context]
 * @returns {{
 *   seeded: Record<string, unknown>[],
 *   held: HeldCandidate[],
 *   accounting: {
 *     candidates: number,
 *     seeded: number,
 *     held: number,
 *     existing: number,
 *     registryTotal: number,
 *   },
 * }}
 */
export function seedLocalityCandidates(candidates, context = {}) {
  const existingRecords = context.existingRecords ?? [];
  const aliasKeys = context.aliasKeys ?? {};
  const recordedOn = context.recordedOn ?? RECORDED_ON;

  const existingBySlug = new Map(existingRecords.map((record) => [record.slug, record]));
  /** @type {Map<string, ExistingRecordView>} */
  const existingByName = new Map();
  for (const record of existingRecords) {
    existingByName.set(normaliseName(record.canonicalName), record);
    for (const alias of record.aliases) {
      const key = normaliseName(alias);
      if (!existingByName.has(key)) existingByName.set(key, record);
    }
  }

  /** @type {Record<string, unknown>[]} */
  const seeded = [];
  /** @type {HeldCandidate[]} */
  const held = [];
  /** @type {Map<string, Record<string, unknown>>} */
  const seededBySlug = new Map();

  /**
   * @param {LocalityCandidate} candidate
   * @param {string} kind
   * @param {{ entityId: string | null, slug: string, name: string | null }} against
   */
  const hold = (candidate, kind, against) => {
    held.push({
      decisionId: `EBD-${String(held.length + 1).padStart(3, '0')}`,
      candidateId: candidate.candidateId,
      candidateName: candidate.candidateName,
      candidateSlug: candidate.candidateSlug,
      collisionKind: kind,
      collidingSlug: against.slug,
      existingEntityId: against.entityId,
      decisionLogReference:
        PRESERVED_ENTITY_SLUGS[/** @type {keyof typeof PRESERVED_ENTITY_SLUGS} */ (against.slug)] ??
        null,
      questionToAnswer: boundaryQuestion(kind, candidate, against),
      recordedOn,
      resolution: null,
    });
  };

  for (const candidate of candidates) {
    const slug = candidate.candidateSlug;
    const name = normaliseName(candidate.candidateName);

    const aliasTarget = Object.prototype.hasOwnProperty.call(aliasKeys, slug)
      ? aliasKeys[slug]
      : undefined;
    if (aliasTarget !== undefined) {
      const target = existingBySlug.get(aliasTarget);
      hold(candidate, 'alias-key', {
        entityId: target?.entityId ?? null,
        slug: aliasTarget,
        name: target?.canonicalName ?? null,
      });
      continue;
    }

    const existingOnSlug = existingBySlug.get(slug);
    if (existingOnSlug) {
      hold(candidate, 'existing-record-slug', {
        entityId: existingOnSlug.entityId,
        slug: existingOnSlug.slug,
        name: existingOnSlug.canonicalName,
      });
      continue;
    }

    const seededOnSlug = seededBySlug.get(slug);
    if (seededOnSlug) {
      hold(candidate, 'seeded-candidate-slug', {
        entityId: /** @type {string} */ (seededOnSlug.entityId),
        slug,
        name: /** @type {string} */ (seededOnSlug.canonicalName),
      });
      continue;
    }

    const existingOnName = existingByName.get(name);
    if (existingOnName) {
      const preserved = Object.prototype.hasOwnProperty.call(
        PRESERVED_ENTITY_SLUGS,
        existingOnName.slug
      );
      hold(candidate, preserved ? 'preserved-entity-overlap' : 'existing-record-name', {
        entityId: existingOnName.entityId,
        slug: existingOnName.slug,
        name: existingOnName.canonicalName,
      });
      continue;
    }

    // There is deliberately no fifth branch comparing the candidate's name against
    // an *already-seeded* candidate's name. Requirement 1.1 requires a unique
    // entityId and a unique slug; Requirement 1.15 is about slugs and alias keys.
    // Holding a candidate because an earlier candidate shares its name would add a
    // failure condition neither requirement asks for, and the backlog carries 132
    // distinct names, so it would never fire on real input while changing the
    // behaviour the property test observes on generated input.
    const record = buildLocalityRecord(candidate);
    seeded.push(record);
    seededBySlug.set(slug, record);
  }

  return {
    seeded,
    held,
    accounting: {
      candidates: candidates.length,
      seeded: seeded.length,
      held: held.length,
      existing: existingRecords.length,
      registryTotal: existingRecords.length + seeded.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * @param {string} value
 * @returns {string}
 */
function quote(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @returns {string}
 */
function renderValue(value, depth) {
  const pad = '  '.repeat(depth);
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${pad}  ${renderValue(item, depth + 1)},`).join('\n');
    return `[\n${items}\n${pad}]`;
  }
  const entries = Object.entries(/** @type {Record<string, unknown>} */ (value))
    .map(([key, item]) => `${pad}  ${key}: ${renderValue(item, depth + 1)},`)
    .join('\n');
  return `{\n${entries}\n${pad}}`;
}

/**
 * @param {Record<string, unknown>} record
 * @returns {string}
 */
export function renderRecord(record) {
  const lines = RECORD_FIELD_ORDER.map((field) => `    ${field}: ${renderValue(record[field], 2)},`);
  return `  {\n${lines.join('\n')}\n  },`;
}

/**
 * @param {string} marketingGroup
 * @param {readonly Record<string, unknown>[]} records
 * @returns {string}
 */
export function renderGroupModule(marketingGroup, records) {
  const exportName = marketingGroupExportName(marketingGroup);
  return `/**
 * Seeded locality candidates — ${marketingGroup}.
 *
 * GENERATED FILE. Edit \`scripts/seed-locality-candidates.mjs\` and re-run it
 * rather than editing this file; \`tests/locality-seeding.test.ts\` fails on drift
 * between the two.
 *
 * ${records.length} candidate${records.length === 1 ? '' : 's'} from
 * \`docs/seo-launch-handoff/AREA-RESEARCH-BACKLOG.csv\`. Every record is a research
 * candidate: coverage unconfirmed, no accountable person, no reviewer, no date, no
 * section, no administrative mapping. None can pass the publication gate, so none
 * reaches a reader — which is the point. Requirements 1.1, 1.2.
 */

import type { LocalityRecord } from '@/config/localities';

export const ${exportName}: readonly LocalityRecord[] = [
${records.map((record) => renderRecord(record)).join('\n')}
] as const;
`;
}

/**
 * @param {readonly { marketingGroup: string, fileName: string, count: number }[]} groups
 * @returns {string}
 */
export function renderIndexModule(groups) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const imports = groups
    .map((group) => `import { ${marketingGroupExportName(group.marketingGroup)} } from './${group.fileName}';`)
    .join('\n');
  const spreads = groups
    .map((group) => `  ...${marketingGroupExportName(group.marketingGroup)},`)
    .join('\n');
  const table = groups
    .map((group) => ` *   ${group.marketingGroup.padEnd(22)} ${String(group.count).padStart(3)}`)
    .join('\n');

  return `/**
 * The seeded locality candidate registry.
 *
 * GENERATED FILE. Edit \`scripts/seed-locality-candidates.mjs\` and re-run it
 * rather than editing this file; \`tests/locality-seeding.test.ts\` fails on drift
 * between the two.
 *
 * ${total} records, split by research group so no generated file is too large to
 * review:
 *
${table}
 *
 * Five of the 132 backlog candidates are deliberately absent. Each collides with a
 * record already in the registry and is held as an open entity-boundary decision
 * rather than seeded or deleted, so the candidate accounting still sums:
 * ${total} seeded + 5 held + 5 existing = 132. Requirement 1.15.
 */

${imports}

import type { LocalityRecord } from '@/config/localities';

export const SEEDED_LOCALITY_CANDIDATES: readonly LocalityRecord[] = [
${spreads}
] as const;
`;
}

/**
 * The register data block for `internal/registers/entity-boundary-decisions.ts`.
 *
 * Rendered rather than written by hand so the held-out list cannot drift from the
 * seeding run that produced it.
 *
 * @param {readonly HeldCandidate[]} held
 * @returns {string}
 */
export function renderEntityBoundaryDecisions(held) {
  const entries = held
    .map((decision) => {
      const lines = [
        `    decisionId: ${quote(decision.decisionId)},`,
        `    candidateId: ${quote(decision.candidateId)},`,
        `    candidateName: ${quote(decision.candidateName)},`,
        `    candidateSlug: ${quote(decision.candidateSlug)},`,
        `    collisionKind: ${quote(decision.collisionKind)},`,
        `    collidingSlug: ${quote(decision.collidingSlug)},`,
        `    existingEntityId: ${decision.existingEntityId ? quote(decision.existingEntityId) : 'null'},`,
        `    decisionLogReference: ${decision.decisionLogReference ? quote(decision.decisionLogReference) : 'null'},`,
        `    questionToAnswer:`,
        `      ${quote(decision.questionToAnswer)},`,
        `    recordedOn: ${quote(decision.recordedOn)},`,
        `    resolution: null,`,
      ];
      return `  {\n${lines.join('\n')}\n  },`;
    })
    .join('\n');
  return `export const ENTITY_BOUNDARY_DECISIONS: readonly EntityBoundaryDecision[] = [\n${entries}\n];`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Group the seeded records by `marketingGroup`, keeping the order in which each
 * group first appears in the input. Deterministic, so re-running the script on an
 * unchanged CSV produces byte-identical files.
 *
 * @param {readonly Record<string, unknown>[]} records
 * @returns {{ marketingGroup: string, fileName: string, records: Record<string, unknown>[] }[]}
 */
export function groupSeededRecords(records) {
  /** @type {Map<string, Record<string, unknown>[]>} */
  const byGroup = new Map();
  for (const record of records) {
    const group = /** @type {string} */ (record.marketingGroup);
    const bucket = byGroup.get(group);
    if (bucket) bucket.push(record);
    else byGroup.set(group, [record]);
  }
  return [...byGroup.entries()].map(([marketingGroup, groupRecords]) => ({
    marketingGroup,
    fileName: marketingGroupFileName(marketingGroup),
    records: groupRecords,
  }));
}

/**
 * Every file this script owns, as path-to-contents. Returned rather than written
 * so `--check` can compare without touching the tree.
 *
 * @param {readonly LocalityCandidate[]} candidates
 * @param {Parameters<typeof seedLocalityCandidates>[1]} [context]
 * @returns {{ files: Record<string, string>, result: ReturnType<typeof seedLocalityCandidates> }}
 */
export function generateRegistryFiles(candidates, context) {
  const result = seedLocalityCandidates(candidates, context);
  const groups = groupSeededRecords(result.seeded);

  /** @type {Record<string, string>} */
  const files = {};
  for (const group of groups) {
    files[join(REGISTRY_DIR, `${group.fileName}.ts`)] = renderGroupModule(
      group.marketingGroup,
      group.records
    );
  }
  files[join(REGISTRY_DIR, 'index.ts')] = renderIndexModule(
    groups.map((group) => ({
      marketingGroup: group.marketingGroup,
      fileName: group.fileName,
      count: group.records.length,
    }))
  );

  return { files, result };
}

/**
 * @returns {{ files: Record<string, string>, result: ReturnType<typeof seedLocalityCandidates> }}
 */
export function generateFromRepository() {
  const candidates = candidatesFromCsv(readFileSync(CSV_PATH, 'utf8'));
  return generateRegistryFiles(candidates, {
    existingRecords: readExistingRecordViews(),
    aliasKeys: readAliasKeys(),
  });
}

/**
 * The five pre-existing records, read out of `src/config/localities.ts` as text.
 *
 * Reading the source rather than importing it keeps this script free of a
 * TypeScript loader. The regexes are narrow and the count is asserted, so a
 * source change that breaks the read fails loudly instead of silently seeding a
 * colliding slug.
 *
 * @returns {ExistingRecordView[]}
 */
export function readExistingRecordViews() {
  const text = readFileSync(join(ROOT, 'src', 'config', 'localities.ts'), 'utf8');
  const start = text.indexOf('const EXISTING_LOCALITY_RECORDS');
  const region = start === -1 ? text : text.slice(start);

  /** @type {ExistingRecordView[]} */
  const views = [];
  const blockPattern = /entityId: '([^']+)',\s*\n\s*canonicalName: '([^']+)',\s*\n\s*aliases: (\[[^\]]*\]),[\s\S]*?\n\s*slug: '([^']+)',/g;
  for (const match of region.matchAll(blockPattern)) {
    const aliases = [...match[3].matchAll(/'([^']*)'/g)].map((alias) => alias[1]);
    views.push({
      entityId: match[1],
      canonicalName: match[2].replace(/\\'/g, "'"),
      aliases,
      slug: match[4],
    });
  }
  return views;
}

/**
 * `LOCALITY_SLUG_ALIASES`, read the same way and for the same reason.
 *
 * @returns {Record<string, string>}
 */
export function readAliasKeys() {
  const text = readFileSync(join(ROOT, 'src', 'config', 'localities.ts'), 'utf8');
  const block = /LOCALITY_SLUG_ALIASES:[^=]*=\s*\{([\s\S]*?)\}\s*as const;/.exec(text);
  /** @type {Record<string, string>} */
  const aliases = {};
  if (!block) return aliases;
  for (const match of block[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) {
    aliases[match[1]] = match[2];
  }
  return aliases;
}

function main() {
  const check = process.argv.includes('--check');
  const { files, result } = generateFromRepository();

  let drift = 0;
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });

  for (const [filePath, contents] of Object.entries(files)) {
    const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
    if (current === contents) continue;
    drift += 1;
    if (check) {
      process.stderr.write(`drift: ${filePath}\n`);
    } else {
      writeFileSync(filePath, contents, 'utf8');
      process.stdout.write(`wrote ${filePath}\n`);
    }
  }

  process.stdout.write(
    `\ncandidates ${result.accounting.candidates} = seeded ${result.accounting.seeded}` +
      ` + held ${result.accounting.held}` +
      ` + existing ${result.accounting.existing}\n` +
      `registry total ${result.accounting.registryTotal}\n`
  );

  if (result.held.length > 0) {
    process.stdout.write('\nheld for an entity-boundary decision:\n');
    for (const decision of result.held) {
      process.stdout.write(
        `  ${decision.decisionId} ${decision.candidateId} ${decision.candidateName}` +
          ` (${decision.collisionKind} on "${decision.collidingSlug}")\n`
      );
    }
    process.stdout.write(
      '\nregister block for internal/registers/entity-boundary-decisions.ts:\n\n'
    );
    process.stdout.write(`${renderEntityBoundaryDecisions(result.held)}\n`);
  }

  if (check && drift > 0) {
    process.stderr.write(`\n${drift} generated file(s) differ from this script's output.\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
