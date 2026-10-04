/**
 * Entity boundary decision register — internal working material.
 *
 * Requirement 1.15: a candidate held out of seeding is not discarded. When a
 * candidate's slug or canonical name collides with an existing record, or
 * overlaps a preserved corridor entity, the candidate is written here with the
 * colliding slug, both candidate identifiers and the question to be answered, so
 * the candidate accounting still sums and the decision stays visible instead of
 * being lost to a deletion.
 *
 * The five candidates the locality seeding held out are AREA-016, AREA-021,
 * AREA-053, AREA-055 and AREA-077. All five are recorded below and all five are
 * open.
 */

import { parseCalendarDate } from '@/lib/calendar-dates';

/** How the candidate collides with something already in the registry. */
export type BoundaryCollisionKind =
  /** The candidate's slug is the slug of an existing record. */
  | 'existing-record-slug'
  /** The candidate's slug is a key in `LOCALITY_SLUG_ALIASES`. */
  | 'alias-key'
  /** An earlier candidate in the same seeding run already took the slug. */
  | 'seeded-candidate-slug'
  /** The candidate's canonical name or alias matches an existing record's. */
  | 'existing-record-name'
  /** The candidate overlaps an entity whose slug is preserved by an open decision. */
  | 'preserved-entity-overlap';

/**
 * How an open decision was eventually closed.
 *
 * Null while the decision is open, which is the state every entry starts in. The
 * three outcomes are the ones Requirement 1.10 names for `north-bengaluru`:
 * preserve the existing record, merge the candidate into it, or record the
 * candidate's slug as an alias of it.
 */
export type BoundaryResolution =
  | { readonly outcome: 'preserve-existing'; readonly decidedBy: string; readonly decidedOn: string }
  | { readonly outcome: 'merge-into-existing'; readonly decidedBy: string; readonly decidedOn: string }
  | { readonly outcome: 'alias-to-existing'; readonly decidedBy: string; readonly decidedOn: string }
  | { readonly outcome: 'seed-as-separate-entity'; readonly decidedBy: string; readonly decidedOn: string };

/** One held-out candidate awaiting an entity boundary decision. */
export interface EntityBoundaryDecision {
  readonly decisionId: string; // EBD-001 …
  /** The Research_Backlog identifier, e.g. AREA-016. */
  readonly candidateId: string;
  /** The candidate name exactly as the CSV recorded it. */
  readonly candidateName: string;
  /** The slug the candidate would have taken. */
  readonly candidateSlug: string;
  readonly collisionKind: BoundaryCollisionKind;
  /** The slug already in use, which is why the candidate is held. */
  readonly collidingSlug: string;
  /** The record already holding that slug, when there is one. */
  readonly existingEntityId: string | null;
  /** The decision-log entry tracking this question, when one exists. */
  readonly decisionLogReference: string | null;
  /** The question a person has to answer before the candidate can be seeded. */
  readonly questionToAnswer: string;
  readonly recordedOn: string;
  /** Null while the decision is open. */
  readonly resolution: BoundaryResolution | null;
}

/**
 * The live register.
 *
 * Five entries, one per candidate the locality seeding held out. The block below
 * is emitted by `scripts/seed-locality-candidates.mjs` and pasted here, and
 * `tests/locality-seeding.test.ts` asserts it still matches what the seeding run
 * produces, so the held-out list cannot drift from the registry it explains.
 *
 * Three are plain slug collisions: the backlog carries Sadashivanagar,
 * Indiranagar and Koramangala as fresh candidates, but each of those slugs is
 * already held by a record the repository kept as a research candidate.
 *
 * Two are name overlaps, which need a wider question than "same place?":
 *   - AREA-021 Hebbal does not collide textually with anything, but the existing
 *     record *named* Hebbal sits on the preserved slug `north-bengaluru`, whose
 *     preserve/merge/alias decision D-IMPL-06 is open. Requirement 1.10 forbids a
 *     second record covering that entity until it closes, so the collision kind
 *     records the preserved-entity overlap rather than a plain name match.
 *   - AREA-055 Whitefield matches the alias of `whitefield-inner-enclaves`. That
 *     slug is not preserved by an open slug decision, so the kind is the plain
 *     name match; the question is whether the candidate is the wider area that
 *     contains the existing micro-locality.
 *
 * Every entry is open. Nothing here has been decided, and nothing here is
 * rendered — this module sits outside the app module graph by construction.
 */
export const ENTITY_BOUNDARY_DECISIONS: readonly EntityBoundaryDecision[] = [
  {
    decisionId: 'EBD-001',
    candidateId: 'AREA-016',
    candidateName: 'Sadashivanagar',
    candidateSlug: 'sadashivanagar',
    collisionKind: 'existing-record-slug',
    collidingSlug: 'sadashivanagar',
    existingEntityId: 'LOC-BLR-SADASHIVANAGAR',
    decisionLogReference: null,
    questionToAnswer:
      'Slug "sadashivanagar" is already held by LOC-BLR-SADASHIVANAGAR. Is AREA-016 "Sadashivanagar" the same entity as that record, a narrower area inside it, or a separate entity needing a different slug? Merge, alias or seed as a separate entity. Backlog research question: "Audit existing claims and the Palace Orchards naming relationship."',
    recordedOn: '2026-09-29',
    resolution: null,
  },
  {
    decisionId: 'EBD-002',
    candidateId: 'AREA-021',
    candidateName: 'Hebbal',
    candidateSlug: 'hebbal',
    collisionKind: 'preserved-entity-overlap',
    collidingSlug: 'north-bengaluru',
    existingEntityId: 'LOC-BLR-HEBBAL',
    decisionLogReference: 'D-IMPL-06',
    questionToAnswer:
      'The existing record LOC-BLR-HEBBAL is named "Hebbal" on the preserved slug "north-bengaluru", whose preserve/merge/alias decision is recorded as open. Does AREA-021 "Hebbal" describe the same entity as that record, an area inside it, or a separate entity? No second record may cover the entity until the open decision closes. Backlog research question: "Distinguish locality content from the existing north-Bengaluru corridor page."',
    recordedOn: '2026-09-29',
    resolution: null,
  },
  {
    decisionId: 'EBD-003',
    candidateId: 'AREA-053',
    candidateName: 'Indiranagar',
    candidateSlug: 'indiranagar',
    collisionKind: 'existing-record-slug',
    collidingSlug: 'indiranagar',
    existingEntityId: 'LOC-BLR-INDIRANAGAR',
    decisionLogReference: null,
    questionToAnswer:
      'Slug "indiranagar" is already held by LOC-BLR-INDIRANAGAR. Is AREA-053 "Indiranagar" the same entity as that record, a narrower area inside it, or a separate entity needing a different slug? Merge, alias or seed as a separate entity. Backlog research question: "Audit existing combined Indiranagar and Old Airport Road record."',
    recordedOn: '2026-09-29',
    resolution: null,
  },
  {
    decisionId: 'EBD-004',
    candidateId: 'AREA-055',
    candidateName: 'Whitefield',
    candidateSlug: 'whitefield',
    collisionKind: 'existing-record-name',
    collidingSlug: 'whitefield-inner-enclaves',
    existingEntityId: 'LOC-BLR-WHITEFIELD-INNER',
    decisionLogReference: null,
    questionToAnswer:
      'The name "Whitefield" already matches the canonical name or an alias of LOC-BLR-WHITEFIELD-INNER on slug "whitefield-inner-enclaves". Is AREA-055 "Whitefield" the same entity as that record, a wider area containing it, or a separate entity? Merge, alias or seed as a separate entity. Backlog research question: "Resolve the existing Whitefield inner-enclaves draft and alias strategy."',
    recordedOn: '2026-09-29',
    resolution: null,
  },
  {
    decisionId: 'EBD-005',
    candidateId: 'AREA-077',
    candidateName: 'Koramangala',
    candidateSlug: 'koramangala',
    collisionKind: 'existing-record-slug',
    collidingSlug: 'koramangala',
    existingEntityId: 'LOC-BLR-KORAMANGALA',
    decisionLogReference: null,
    questionToAnswer:
      'Slug "koramangala" is already held by LOC-BLR-KORAMANGALA. Is AREA-077 "Koramangala" the same entity as that record, a narrower area inside it, or a separate entity needing a different slug? Merge, alias or seed as a separate entity. Backlog research question: "Audit existing ward/transit claims and clarify block coverage."',
    recordedOn: '2026-09-29',
    resolution: null,
  },
];

/** Requirement 1.15. An entry that records no question decides nothing. */
export function validateEntityBoundaryDecision(decision: EntityBoundaryDecision): {
  readonly ok: boolean;
  readonly failures: readonly string[];
} {
  const failures: string[] = [];
  const blank = (value: string) => value.trim().length === 0;
  const label = blank(decision.decisionId) ? '(unidentified decision)' : decision.decisionId;

  if (blank(decision.decisionId)) failures.push('No decision identifier recorded.');
  if (blank(decision.candidateId)) failures.push(`${label}: no candidate identifier recorded.`);
  if (blank(decision.candidateName)) failures.push(`${label}: no candidate name recorded.`);
  if (blank(decision.candidateSlug)) failures.push(`${label}: no candidate slug recorded.`);
  if (blank(decision.collidingSlug)) failures.push(`${label}: no colliding slug recorded.`);
  if (blank(decision.questionToAnswer)) {
    failures.push(`${label}: no question recorded, so the entry defers nothing to anybody.`);
  }
  if (!parseCalendarDate(decision.recordedOn)) {
    failures.push(`${label}: "${decision.recordedOn}" is not a recorded date.`);
  }
  if (decision.resolution) {
    if (blank(decision.resolution.decidedBy)) {
      failures.push(`${label}: the resolution names no decider.`);
    }
    if (!parseCalendarDate(decision.resolution.decidedOn)) {
      failures.push(`${label}: the resolution records no decision date.`);
    }
  }

  return { ok: failures.length === 0, failures };
}

/** Decisions still waiting on a person. */
export function getOpenBoundaryDecisions(
  decisions: readonly EntityBoundaryDecision[] = ENTITY_BOUNDARY_DECISIONS
): readonly EntityBoundaryDecision[] {
  return decisions.filter((decision) => decision.resolution === null);
}
