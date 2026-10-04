/**
 * What the preview surface is allowed to know about a record that has not passed
 * the publication gate.
 *
 * Requirement 11.8 asks for "a preview surface for inspecting a record that has not
 * passed the publication gate", returning 404 in every production build and absent
 * from the sitemap and from every link on a public page.
 *
 * The reading of that requirement this module implements, and the reason for it:
 *
 *  - Requirements 11.8 and 12.10 pull in opposite directions. 11.8 wants a surface
 *    that shows an unpublished record; 12.10 fails the build when a module rendering a
 *    *registered public route* holds the ungated registry. Both hold at once only if
 *    the preview surface is not a public route at all — so the route that renders this
 *    data 404s in a production deployment, carries `noindex`, is absent from
 *    `getPublicRoutes` and therefore from the sitemap and `llms.txt`, and is reachable
 *    from no link on any public page.
 *  - The registry read lives here, in the lib layer, rather than in the page. The
 *    gated accessors are implemented by reading the registry, which is why the config
 *    and lib layers may hold it and the render layer may not. The page asks this
 *    module a question and renders the answer.
 *
 * What the preview shows is deliberately *more* than a page would: the gate's exact
 * failures and the record's internal blocking notes are the whole point of inspecting
 * a record before release. That is also precisely why the surface must never be
 * public, and why nothing in this module is imported by a page a reader can reach.
 */

import {
  LOCALITY_REGISTRY,
  collectLocalityClaimIds,
  evaluateLocality,
  resolveLocalitySlug,
  sectionWordCount,
  type LocalityRecord,
} from '@/config/localities';
import { COVERAGE_CHECKLIST_ENTRY, REVIEWER_CHECKLIST_ENTRY } from '@/config/coverage-confirmation';

/** The route the preview surface is served from. Not a public route. */
export const PREVIEW_ROUTE_PATH = '/internal-preview';

/** The query parameter naming the record to inspect: an `entityId` or a slug. */
export const PREVIEW_RECORD_PARAM = 'record';

/**
 * The checklist entries that would let a previewed locality record publish.
 *
 * The preview mechanism itself needs no owner answer — it is built and reachable in
 * development and preview builds today. What the records it shows are waiting for is
 * C1 / OWN-03 for confirmed coverage and an accountable person, and C2 / OWN-14 for
 * the three named reviewers. Recorded here so the surface can say so on the page
 * rather than leaving a reader to infer it from a list of failures.
 */
export const PREVIEW_BLOCKING_CHECKLIST_ENTRIES: readonly string[] = [
  COVERAGE_CHECKLIST_ENTRY,
  REVIEWER_CHECKLIST_ENTRY,
] as const;

export interface PreviewSection {
  readonly sectionId: string;
  readonly heading: string;
  readonly wordCount: number;
}

export interface RecordPreview {
  readonly entityId: string;
  readonly canonicalName: string;
  readonly slug: string;
  readonly entityType: string;
  readonly editorialStatus: string;
  readonly publicationStatus: string;
  readonly actualServiceCoverage: string;
  readonly coverageResponsibleOwner: string | null;
  readonly author: string | null;
  readonly localReviewer: string | null;
  readonly seoReviewer: string | null;
  readonly nextReviewAt: string | null;
  /** True only when the shared gate admits the record at the evaluation date. */
  readonly passesGate: boolean;
  /** Every failure string the shared gate returned, unedited. */
  readonly gateFailures: readonly string[];
  /** The record's internal blocking notes. Internal material. */
  readonly blockingNotes: readonly string[];
  readonly sections: readonly PreviewSection[];
  readonly claimIds: readonly string[];
  /** The checklist entries the record is waiting on. */
  readonly blockingChecklistEntries: readonly string[];
}

export interface PreviewIndexEntry {
  readonly entityId: string;
  readonly canonicalName: string;
  readonly slug: string;
  readonly editorialStatus: string;
  readonly passesGate: boolean;
  readonly gateFailureCount: number;
}

function toPreview(record: LocalityRecord, now: Date): RecordPreview {
  const evaluation = evaluateLocality(record, now);
  return {
    entityId: record.entityId,
    canonicalName: record.canonicalName,
    slug: record.slug,
    entityType: record.entityType,
    editorialStatus: record.editorialStatus,
    publicationStatus: record.publicationStatus,
    actualServiceCoverage: record.actualServiceCoverage,
    coverageResponsibleOwner: record.coverageResponsibleOwner,
    author: record.author,
    localReviewer: record.localReviewer,
    seoReviewer: record.seoReviewer,
    nextReviewAt: record.nextReviewAt,
    passesGate: evaluation.eligible,
    gateFailures: evaluation.failures,
    blockingNotes: record.blockingNotes,
    sections: record.sections.map((section) => ({
      sectionId: section.sectionId,
      heading: section.heading,
      wordCount: sectionWordCount(section),
    })),
    claimIds: collectLocalityClaimIds(record),
    blockingChecklistEntries: PREVIEW_BLOCKING_CHECKLIST_ENTRIES,
  };
}

/**
 * The record a preview request names, or `null`.
 *
 * A reference is an `entityId`, a canonical slug or an alias slug — whichever the
 * person inspecting has to hand. Aliases resolve through the live table first, so the
 * preview cannot disagree with the route about which record a slug means.
 */
export function getRecordPreview(
  reference: string,
  now: Date = new Date(),
  registry: readonly LocalityRecord[] = LOCALITY_REGISTRY
): RecordPreview | null {
  const trimmed = reference.trim();
  if (trimmed.length === 0) return null;
  const canonical = resolveLocalitySlug(trimmed);
  const record = registry.find(
    (candidate) => candidate.entityId === trimmed || candidate.slug === canonical
  );
  return record ? toPreview(record, now) : null;
}

/** Every record the preview surface can show, in registry order. */
export function listPreviewableRecords(
  now: Date = new Date(),
  registry: readonly LocalityRecord[] = LOCALITY_REGISTRY
): readonly PreviewIndexEntry[] {
  return registry.map((record) => {
    const evaluation = evaluateLocality(record, now);
    return {
      entityId: record.entityId,
      canonicalName: record.canonicalName,
      slug: record.slug,
      editorialStatus: record.editorialStatus,
      passesGate: evaluation.eligible,
      gateFailureCount: evaluation.failures.length,
    };
  });
}
