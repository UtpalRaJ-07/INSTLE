/**
 * The coverage confirmation path — built, and switched off.
 *
 * Requirement 1.13: when the Owner_Input_Register records under **C1 / OWN-03** that
 * an area is served, together with a named person accountable for serving it, the
 * matching record's `actualServiceCoverage` becomes `confirmed-served` and its
 * `coverageResponsibleOwner` becomes that named person — and `publicationStatus`
 * stays `unpublished` until the reviewers supplied under **C2 / OWN-14** have
 * approved the record.
 *
 * Requirement 11.4: while any of the three C2 names is unsupplied, C2 is recorded as
 * the blocking dependency, the record is held at or before fact review, and the
 * publication gate fails.
 *
 * ## How this is switched off
 *
 * `RECORDED_COVERAGE_ANSWERS` is empty, because no answer has been recorded under
 * C1 / OWN-03. `applyRecordedCoverageAnswers` therefore returns the registry it was
 * given, record for record, and all 132 records keep `actualServiceCoverage:
 * 'unconfirmed'` and `coverageResponsibleOwner: null`. Nothing in this module
 * confirms coverage on its own: every function needs an answer passed to it, the
 * answer has to name the checklist entry it came from, and an answer naming an
 * unattributable person is rejected rather than trimmed into shape.
 *
 * ## What it does not do
 *
 * It adds no gate condition and relaxes none. `evaluateLocality` already fails a
 * record whose coverage is not `confirmed-served`, whose accountable person is
 * missing, or whose reviewers and approval timestamps are absent — so a confirmed
 * answer flows into the existing gate with no other change, and an answer on its own
 * moves nothing, because the reviewer conditions are still unmet.
 *
 * It also never publishes a record as a side effect of confirming coverage.
 * `publishWhenReviewersApproved` is a separate call that refuses unless the three
 * distinct, attributable sign-offs and their timestamps are recorded *and* the gate
 * would admit the published record. Publication stays a decision somebody takes,
 * with the evidence already in place.
 */

import { isAttributableName } from './claims';
import { validateApprovalSignOff } from './editorial-workflow';
import { evaluateLocality, type EditorialStatus, type LocalityRecord } from './localities';
import { isCalendarDate } from '@/lib/calendar-dates';

// ---------------------------------------------------------------------------
// The checklist entries this path is blocked on
// ---------------------------------------------------------------------------

/**
 * The register entry a coverage answer must come from: which Bengaluru areas are
 * actually served, and who is accountable for each.
 */
export const COVERAGE_CHECKLIST_ENTRY = 'C1 / OWN-03';

/**
 * The register entry that holds publication after coverage is confirmed: the named
 * local reviewer, editorial approver and SEO reviewer — three real, distinct people.
 */
export const REVIEWER_CHECKLIST_ENTRY = 'C2 / OWN-14';

/** Requirement 11.4. The furthest a record may sit while C2 is unsupplied. */
export const REVIEWER_BLOCKED_MAX_STATUS: EditorialStatus = 'fact_review';

/**
 * The editorial sequence, as `localities.ts` declares it, so "at or before fact
 * review" is computed rather than hand-listed.
 */
const EDITORIAL_SEQUENCE: readonly EditorialStatus[] = [
  'candidate',
  'research',
  'draft',
  'fact_review',
  'editorial_review',
  'seo_review',
  'approved',
] as const;

// ---------------------------------------------------------------------------
// The recorded answer
// ---------------------------------------------------------------------------

/**
 * One answer as the Owner_Input_Register records it.
 *
 * `checklistEntry` is carried on the answer rather than assumed by this module: an
 * answer that cannot say which register entry it came from is not evidence of
 * anything, and a coverage decision taken in a chat message is exactly what
 * Requirement 1.13 is written against.
 */
export interface CoverageRegisterAnswer {
  /** `entityId` of the record the answer is about. */
  readonly entityId: string;
  /** The area name as the owner wrote it, kept for the audit trail. */
  readonly areaNameAsRecorded: string;
  /** Whether the area is served. `false` is a complete answer. */
  readonly served: boolean;
  /** The person accountable for serving it. Required when `served` is true. */
  readonly accountablePerson: string | null;
  /** The date the answer was recorded, `YYYY-MM-DD`. */
  readonly recordedOn: string;
  /** Must be `COVERAGE_CHECKLIST_ENTRY`. */
  readonly checklistEntry: string;
}

/**
 * The recorded answers. Empty: nothing has been supplied under C1 / OWN-03.
 *
 * An empty list is the honest state, not a placeholder. The five existing records
 * and the 127 seeded candidates each carry a blocking note saying operational
 * coverage is unconfirmed, and they will carry it until a real answer lands here.
 */
export const RECORDED_COVERAGE_ANSWERS: readonly CoverageRegisterAnswer[] = [];

// ---------------------------------------------------------------------------
// Validating an answer
// ---------------------------------------------------------------------------

export interface CoverageAnswerValidation {
  readonly ok: boolean;
  readonly failures: readonly string[];
}

/**
 * Requirement 1.13. An answer is usable only when it names its register entry, names
 * the record it is about, carries a date, and — where it says the area is served —
 * names an accountable person a reader could actually ask.
 *
 * A `served: false` answer needs no person, because there is nobody to be
 * accountable for work that is not done. It is still a recorded answer.
 */
export function validateCoverageAnswer(answer: CoverageRegisterAnswer): CoverageAnswerValidation {
  const failures: string[] = [];

  if (answer.checklistEntry !== COVERAGE_CHECKLIST_ENTRY) {
    failures.push(
      `The answer records checklist entry "${answer.checklistEntry}"; a coverage answer comes from ${COVERAGE_CHECKLIST_ENTRY}.`
    );
  }
  if (answer.entityId.trim().length === 0) {
    failures.push('The answer names no record.');
  }
  if (answer.areaNameAsRecorded.trim().length === 0) {
    failures.push('The answer records no area name.');
  }
  if (!isCalendarDate(answer.recordedOn)) {
    failures.push(`The answer records "${answer.recordedOn}", which is not a calendar date.`);
  }
  if (answer.served && !isAttributableName(answer.accountablePerson)) {
    failures.push(
      `"${answer.accountablePerson ?? 'none'}" does not name a person accountable for serving ${answer.areaNameAsRecorded || 'this area'}, so the coverage answer is rejected.`
    );
  }
  if (!answer.served && answer.accountablePerson !== null) {
    failures.push(
      'The answer records the area as not served and still names an accountable person; one of the two is wrong.'
    );
  }

  return { ok: failures.length === 0, failures };
}

// ---------------------------------------------------------------------------
// Applying an answer
// ---------------------------------------------------------------------------

export interface CoverageConfirmationOutcome {
  /** The record after the answer is applied. Unchanged when `applied` is false. */
  readonly record: LocalityRecord;
  /** Whether the answer was applied at all. */
  readonly applied: boolean;
  /** Why it was not, or what is wrong with it. Empty when the answer is usable. */
  readonly failures: readonly string[];
  /**
   * Requirements 1.13 and 11.4. The checklist entries still holding this record
   * unpublished, in the order they have to be answered.
   */
  readonly blockingChecklistEntries: readonly string[];
  /** The sentence to record against the record while publication is held. */
  readonly publicationHold: string | null;
}

/** The note appended while C2 holds the record, worded so it names the entry. */
export function reviewerBlockingNote(): string {
  return `Publication held at unpublished: the named local reviewer, editorial approver and SEO reviewer requested under Owner_Input_Register ${REVIEWER_CHECKLIST_ENTRY} are not all recorded (Requirements 1.13 and 11.4).`;
}

function coverageConfirmedNote(answer: CoverageRegisterAnswer): string {
  return `Operational coverage confirmed under Owner_Input_Register ${COVERAGE_CHECKLIST_ENTRY} on ${answer.recordedOn}; ${answer.accountablePerson?.trim()} is accountable for serving this area.`;
}

function notServedNote(answer: CoverageRegisterAnswer): string {
  return `Recorded under Owner_Input_Register ${COVERAGE_CHECKLIST_ENTRY} on ${answer.recordedOn} as not served, so no page publishes for this area.`;
}

/** Append without duplicating, so applying the same answer twice adds one note. */
function withNote(notes: readonly string[], note: string): readonly string[] {
  return notes.includes(note) ? notes : [...notes, note];
}

/** Requirement 11.4. Hold the record at or before fact review. */
function heldEditorialStatus(status: EditorialStatus): EditorialStatus {
  const current = EDITORIAL_SEQUENCE.indexOf(status);
  const limit = EDITORIAL_SEQUENCE.indexOf(REVIEWER_BLOCKED_MAX_STATUS);
  return current > limit ? REVIEWER_BLOCKED_MAX_STATUS : status;
}

/**
 * Requirements 1.13 and 11.4. Apply one recorded coverage answer to one record.
 *
 * Returns a new record rather than mutating, so a caller can compare the two and see
 * exactly which fields moved — and so an answer that fails validation cannot leave a
 * half-applied record behind.
 *
 * `publicationStatus` is never set to `published` here. Confirming coverage answers
 * one of the gate's conditions; it is not a release.
 *
 * @param editorialApprover the editorial sign-off name, defaulting to the record's
 * `author` as `EDITORIAL_SIGN_OFF_FIELD` in `editorial-workflow.ts` records.
 */
export function confirmCoverageFromRegister(
  record: LocalityRecord,
  answer: CoverageRegisterAnswer,
  editorialApprover: string | null = record.author
): CoverageConfirmationOutcome {
  const validation = validateCoverageAnswer(answer);
  if (!validation.ok) {
    return {
      record,
      applied: false,
      failures: validation.failures,
      blockingChecklistEntries: [COVERAGE_CHECKLIST_ENTRY],
      publicationHold: `Publication held at unpublished: no usable coverage answer is recorded under Owner_Input_Register ${COVERAGE_CHECKLIST_ENTRY}.`,
    };
  }

  if (answer.entityId !== record.entityId) {
    return {
      record,
      applied: false,
      failures: [
        `The answer is recorded against ${answer.entityId} and this record is ${record.entityId}; a coverage answer applies to the record it names.`,
      ],
      blockingChecklistEntries: [COVERAGE_CHECKLIST_ENTRY],
      publicationHold: `Publication held at unpublished: no coverage answer for ${record.entityId} is recorded under Owner_Input_Register ${COVERAGE_CHECKLIST_ENTRY}.`,
    };
  }

  if (!answer.served) {
    return {
      record: {
        ...record,
        actualServiceCoverage: 'not-served',
        coverageResponsibleOwner: null,
        publicationStatus: 'unpublished',
        blockingNotes: withNote(record.blockingNotes, notServedNote(answer)),
      },
      applied: true,
      failures: [],
      blockingChecklistEntries: [],
      publicationHold: notServedNote(answer),
    };
  }

  const signOff = validateApprovalSignOff(record, editorialApprover);
  const reviewersApproved = signOff.ok;

  const confirmed: LocalityRecord = {
    ...record,
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: answer.accountablePerson!.trim(),
    // Requirement 1.13. Confirming coverage publishes nothing.
    publicationStatus: 'unpublished',
    editorialStatus: reviewersApproved ? record.editorialStatus : heldEditorialStatus(record.editorialStatus),
    blockingNotes: reviewersApproved
      ? withNote(record.blockingNotes, coverageConfirmedNote(answer))
      : withNote(withNote(record.blockingNotes, coverageConfirmedNote(answer)), reviewerBlockingNote()),
  };

  return {
    record: confirmed,
    applied: true,
    failures: [],
    blockingChecklistEntries: reviewersApproved ? [] : [REVIEWER_CHECKLIST_ENTRY],
    publicationHold: reviewersApproved ? null : reviewerBlockingNote(),
  };
}

/**
 * Every recorded answer applied to a registry, in one pass.
 *
 * With zero recorded answers this returns the registry unchanged, which is what it
 * does today. An answer naming a record the registry does not hold is reported
 * rather than dropped: a confirmation for an area nobody has a record for is a
 * research gap, not a no-op.
 */
export interface CoverageApplicationReport {
  readonly records: readonly LocalityRecord[];
  readonly applied: readonly string[];
  readonly rejected: readonly string[];
  /** Answers naming an `entityId` the registry does not hold. */
  readonly unmatchedAnswers: readonly string[];
  /** Requirement 11.4. Entries still holding at least one record unpublished. */
  readonly blockingChecklistEntries: readonly string[];
}

export function applyRecordedCoverageAnswers(
  records: readonly LocalityRecord[],
  answers: readonly CoverageRegisterAnswer[] = RECORDED_COVERAGE_ANSWERS
): CoverageApplicationReport {
  const byEntityId = new Map(answers.map((answer) => [answer.entityId, answer]));
  const applied: string[] = [];
  const rejected: string[] = [];
  const blocking = new Set<string>();

  const updated = records.map((record) => {
    const answer = byEntityId.get(record.entityId);
    if (!answer) return record;
    const outcome = confirmCoverageFromRegister(record, answer);
    if (outcome.applied) applied.push(record.entityId);
    else rejected.push(`${record.entityId}: ${outcome.failures.join(' ')}`);
    for (const entry of outcome.blockingChecklistEntries) blocking.add(entry);
    return outcome.record;
  });

  const known = new Set(records.map((record) => record.entityId));
  const unmatchedAnswers = answers
    .filter((answer) => !known.has(answer.entityId))
    .map(
      (answer) =>
        `${answer.entityId} (${answer.areaNameAsRecorded}): recorded under ${COVERAGE_CHECKLIST_ENTRY}, but no locality record carries that identifier.`
    );

  return {
    records: updated,
    applied,
    rejected,
    unmatchedAnswers,
    blockingChecklistEntries: [...blocking],
  };
}

// ---------------------------------------------------------------------------
// Publication, once the reviewers have approved
// ---------------------------------------------------------------------------

export interface PublicationAttempt {
  readonly record: LocalityRecord;
  readonly published: boolean;
  /** Every reason the record stayed unpublished. Empty when it published. */
  readonly failures: readonly string[];
  readonly blockingChecklistEntries: readonly string[];
}

/**
 * Requirement 1.13. Flip `publicationStatus` to `published` only when coverage is
 * confirmed with a named accountable person, the three C2 sign-offs and their
 * timestamps are recorded in order, and the publication gate admits the resulting
 * record.
 *
 * The gate is evaluated on the *would-be published* record rather than on the
 * current one, because `publicationStatus` is itself a gate condition; asking the
 * gate about the unpublished record would always return the same failure and tell
 * nobody whether the rest of the evidence is in place. Every other condition —
 * the approved editorial state, the sections, the claims, the boundary versions, the
 * review date — is the real gate's answer, so this function cannot publish anything
 * the gate would reject. In particular `editorialStatus` is read, never written: a
 * record that has not walked the workflow to `approved` fails here with the gate's
 * own wording rather than being moved there by a publication call.
 */
export function publishWhenReviewersApproved(
  record: LocalityRecord,
  now: Date = new Date(),
  editorialApprover: string | null = record.author
): PublicationAttempt {
  const failures: string[] = [];
  const blocking = new Set<string>();

  if (record.actualServiceCoverage !== 'confirmed-served' || !record.coverageResponsibleOwner) {
    failures.push(
      `Operational coverage is "${record.actualServiceCoverage}" with ${record.coverageResponsibleOwner ? 'an' : 'no'} accountable person recorded; publication requires a confirmed answer under ${COVERAGE_CHECKLIST_ENTRY}.`
    );
    blocking.add(COVERAGE_CHECKLIST_ENTRY);
  }

  const signOff = validateApprovalSignOff(record, editorialApprover);
  if (!signOff.ok) {
    failures.push(...signOff.failures);
    blocking.add(REVIEWER_CHECKLIST_ENTRY);
  }

  const candidate: LocalityRecord = { ...record, publicationStatus: 'published' };
  const gate = evaluateLocality(candidate, now);
  if (!gate.eligible) failures.push(...gate.failures);

  if (failures.length > 0) {
    return {
      record: {
        ...record,
        publicationStatus: 'unpublished',
        editorialStatus: signOff.ok ? record.editorialStatus : heldEditorialStatus(record.editorialStatus),
      },
      published: false,
      failures,
      blockingChecklistEntries: [...blocking],
    };
  }

  return { record: candidate, published: true, failures: [], blockingChecklistEntries: [] };
}
