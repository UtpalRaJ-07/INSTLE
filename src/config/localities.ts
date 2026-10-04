/**
 * Bengaluru locality content records and the single shared publication gate.
 *
 * This replaces status-label filtering with claim-level evidence checking.
 * Master prompt section 15:
 *   "Create a shared eligibility function used by navigation, static params,
 *    metadata, sitemap, and content retrieval. Unknown, draft, expired, and
 *    unapproved slugs must not expose public page content."
 *
 * `isLocalityPublishable` is that function. Every public surface calls it.
 *
 * Current state: NO locality is publishable. The five records the repository
 * previously carried (four marked "published", one "draft") all fail on real
 * evidence grounds — homepage-level citations, a single publisher per claim, and
 * a sign-off attributed to a non-existent "Research & Advisory Desk". The records
 * are kept as research candidates with their exact gaps recorded, rather than
 * deleted, so the research work has a starting point.
 */

import { evaluateClaims } from './claims';
import { SEEDED_LOCALITY_CANDIDATES } from './locality-registry';
import { countWords, normaliseComparableText, substitutePlaceNames } from '../lib/text-metrics';

export type LocalityEntityType = 'locality' | 'micro-locality' | 'corridor' | 'region-hub';

export type EditorialStatus =
  | 'candidate'
  | 'research'
  | 'draft'
  | 'fact_review'
  | 'editorial_review'
  | 'seo_review'
  | 'approved';

export type LocalityCoverageStatus = 'unconfirmed' | 'confirmed-served' | 'not-served';

export type LocalityPublicationStatus = 'unpublished' | 'published';

export interface AdministrativeMapping {
  /** e.g. "BBMP zone", "ward", "planning district". */
  mappingType: string;
  /** The value claimed, e.g. "East Zone". */
  value: string;
  /** Version or notification identifying the boundary set this value belongs to. */
  boundaryVersion: string | null;
  /** Claim ID in the ledger that must support this mapping. */
  claimId: string | null;
}

export interface LocalitySection {
  /** Stable id so a section can be traced across revisions. */
  sectionId: string;
  heading: string;
  /** Body paragraphs. Procedural guidance needs no claim; facts do. */
  paragraphs: readonly string[];
  /**
   * Claim IDs supporting the factual statements in this section.
   * An empty array means the section asserts no external facts — only the
   * brokerage's own process, which the business itself can stand behind.
   */
  claimIds: readonly string[];
}

export interface ApprovedFaqItem {
  question: string;
  answer: string;
  /** Claim IDs needed for factual answers. Procedural answers may be empty. */
  claimIds: readonly string[];
}

export interface NearbyRelationship {
  slug: string;
  /** How the two places relate, e.g. "shares the 100 Feet Road corridor". */
  relationship: string;
  claimId: string | null;
}

export interface ImageRightsRecord {
  assetPath: string;
  creator: string | null;
  licence: string | null;
  permissionRecorded: boolean;
  altText: string;
  /** True when the image is a design study rather than a real place photograph. */
  isConceptualIllustration: boolean;
}

export interface LocalityRecord {
  entityId: string;
  canonicalName: string;
  aliases: readonly string[];
  entityType: LocalityEntityType;
  slug: string;

  /** Internal browsing grouping. Not an assertion about municipal boundaries. */
  marketingGroup: string;
  administrativeMappings: readonly AdministrativeMapping[];

  actualServiceCoverage: LocalityCoverageStatus;
  /** Person inside the business accountable for serving this area. */
  coverageResponsibleOwner: string | null;

  /** One-paragraph summary. Must be claim-backed if it states facts. */
  summary: string;
  summaryClaimIds: readonly string[];
  sections: readonly LocalitySection[];
  approvedFaq: readonly ApprovedFaqItem[];
  approvedNearbyRelationships: readonly NearbyRelationship[];
  relatedGuideIds: readonly string[];
  postalMappingIds: readonly string[];
  imageRightsRecords: readonly ImageRightsRecord[];

  author: string | null;
  localReviewer: string | null;
  seoReviewer: string | null;
  /** ISO timestamps. Null means the approval has not happened. */
  editorialApprovedAt: string | null;
  localReviewApprovedAt: string | null;
  seoReviewApprovedAt: string | null;

  sourceCheckedAt: string | null;
  nextReviewAt: string | null;
  contentUpdatedAt: string | null;

  editorialStatus: EditorialStatus;
  publicationStatus: LocalityPublicationStatus;

  /** Internal note on what still blocks publication. Never rendered publicly. */
  blockingNotes: readonly string[];

  /**
   * Requirement 3.6. The approved primary intent phrase, copied onto the record
   * at approval so the page can render it without reading the Search_Intent_Register.
   *
   * The register lives outside the app module graph, so a page cannot read it even
   * by accident; the evidence behind the phrase — tool, date, location context,
   * volume — stays there, and only the approved text is copied here.
   * `intentEntryId` is what ties the two back together, and a test importing both
   * sides asserts every phrase on a record traces to a register entry.
   *
   * Null until the record is approved, which is every record today.
   */
  readonly primaryIntent: { readonly intentEntryId: string; readonly phrase: string } | null;

  /** Requirement 3.6. At most 5. Each may appear at most 3 times in the body. */
  readonly supportingPhrases: readonly string[];

  /**
   * Requirement 9.2. Media_Register asset IDs this page renders.
   *
   * Illustrations and maps are components rather than files, so they are
   * referenced by ID and their provenance lives in the Media_Register.
   * `imageRightsRecords` above is unchanged and still carries photographs.
   */
  readonly visualAssetIds: readonly string[];
}

/** Every claim ID a record depends on, across all its surfaces. */
export function collectLocalityClaimIds(record: LocalityRecord): readonly string[] {
  const ids = new Set<string>();
  record.summaryClaimIds.forEach((id) => ids.add(id));
  record.sections.forEach((section) => section.claimIds.forEach((id) => ids.add(id)));
  record.approvedFaq.forEach((faq) => faq.claimIds.forEach((id) => ids.add(id)));
  record.administrativeMappings.forEach((mapping) => {
    if (mapping.claimId) ids.add(mapping.claimId);
  });
  record.approvedNearbyRelationships.forEach((rel) => {
    if (rel.claimId) ids.add(rel.claimId);
  });
  return Array.from(ids);
}

export interface LocalityEligibility {
  slug: string;
  eligible: boolean;
  failures: readonly string[];
}

// ---------------------------------------------------------------------------
// Section depth — Requirement 1.5
// ---------------------------------------------------------------------------
//
// These lived in `locality-sections.ts`, which re-exports every one of them
// unchanged. They moved here because `evaluateLocality` now calls
// `evaluateSectionDepth`, and `locality-sections.ts` imports this module: calling
// back into it would be an import cycle in which the gate could run, during this
// module's own initialisation, before the constants below it existed.

/** Requirement 1.5 and 2.7. Two sections, because one section is a stub. */
export const MIN_CONTENT_SECTIONS = 2;

/** Requirement 1.5. A section shorter than this helps nobody. */
export const MIN_SECTION_WORDS = 120;

/** Heading and paragraphs as one string, which is the unit of comparison. */
export function sectionText(section: LocalitySection): string {
  return [section.heading, ...section.paragraphs].join('\n');
}

/** Words in the section's paragraphs. The heading is not body text. */
export function sectionWordCount(section: LocalitySection): number {
  return countWords(section.paragraphs.join(' '));
}

/**
 * The two forms a section is compared in.
 *
 * `verbatim` catches copy pasted between pages and reflowed. `placeSubstituted`
 * catches the thing Requirement 1.5 actually exists to stop: the same paragraph
 * shipped 130 times with the area name swapped. Both the record's canonical name
 * and its aliases are substituted, because "Indira Nagar" and "Indiranagar" are
 * one place name spelled two ways and a rule that missed the alias would be
 * trivially evadable.
 */
export interface SectionComparisonKeys {
  readonly verbatim: string;
  readonly placeSubstituted: string;
}

export function sectionComparisonKeys(
  record: Pick<LocalityRecord, 'canonicalName' | 'aliases'>,
  section: LocalitySection
): SectionComparisonKeys {
  const text = sectionText(section);
  return {
    verbatim: normaliseComparableText(text),
    placeSubstituted: substitutePlaceNames(text, [record.canonicalName, ...record.aliases]),
  };
}

/**
 * Requirement 1.5, the half that is about the record on its own: two sections, each
 * of at least 120 words, and no section repeated inside the record.
 *
 * Returns failure strings rather than a boolean, in the shape the gates use, so a
 * caller can concatenate them into a gate verdict without translating.
 */
export function evaluateSectionDepth(record: LocalityRecord): readonly string[] {
  const failures: string[] = [];

  if (record.sections.length < MIN_CONTENT_SECTIONS) {
    failures.push(
      `Record carries ${record.sections.length} content section(s); publication requires at least ${MIN_CONTENT_SECTIONS}.`
    );
  }

  for (const section of record.sections) {
    const words = sectionWordCount(section);
    if (words < MIN_SECTION_WORDS) {
      failures.push(
        `Section "${section.heading}" carries ${words} words; publication requires at least ${MIN_SECTION_WORDS}.`
      );
    }
  }

  const seen = new Map<string, string>();
  for (const section of record.sections) {
    const { verbatim } = sectionComparisonKeys(record, section);
    const first = seen.get(verbatim);
    if (first !== undefined) {
      failures.push(
        `Section "${section.heading}" repeats the text of section "${first}" on the same record.`
      );
      continue;
    }
    seen.set(verbatim, section.heading);
  }

  return failures;
}

/**
 * THE shared publication gate.
 *
 * Called by /areas, /areas/[slug], generateStaticParams, generateMetadata,
 * the sitemap, and internal navigation. A record is publishable only when
 * every gate passes, including claim-level evidence.
 */
export function evaluateLocality(
  record: LocalityRecord,
  now: Date = new Date()
): LocalityEligibility {
  const failures: string[] = [];

  if (record.publicationStatus !== 'published') {
    failures.push(`Publication status is "${record.publicationStatus}".`);
  }
  if (record.editorialStatus !== 'approved') {
    failures.push(`Editorial status is "${record.editorialStatus}", not "approved".`);
  }
  if (record.actualServiceCoverage !== 'confirmed-served') {
    failures.push(
      `Operational coverage is "${record.actualServiceCoverage}"; publication requires confirmed coverage.`
    );
  }
  if (!record.coverageResponsibleOwner) {
    failures.push('No named person is accountable for serving this area.');
  }
  if (!record.author) failures.push('No author recorded.');
  if (!record.localReviewer) failures.push('No local reviewer recorded.');
  if (!record.seoReviewer) failures.push('No SEO reviewer recorded.');
  if (!record.editorialApprovedAt) failures.push('No editorial approval timestamp.');
  if (!record.localReviewApprovedAt) failures.push('No local review approval timestamp.');
  if (!record.seoReviewApprovedAt) failures.push('No SEO review approval timestamp.');

  /**
   * Requirement 11.6: the gate fails "while a record carries no `nextReviewAt` value,
   * or the evaluation date is on or after its `nextReviewAt`".
   *
   * Property 1 found three records this condition used to admit. It only checked a
   * review date that was present, parseable and strictly earlier than `now`, so a
   * record with no review date, with one no parser can read ("after the monsoon"),
   * or evaluated at the very instant its review fell due all passed. Each of those is
   * a record with no live review commitment behind it. Additive: the expiry message
   * is unchanged, and every record that failed before still fails.
   */
  if (!record.nextReviewAt || record.nextReviewAt.trim().length === 0) {
    failures.push('No next review date recorded.');
  } else {
    const nextReview = new Date(record.nextReviewAt);
    if (Number.isNaN(nextReview.getTime())) {
      failures.push(`Next review date "${record.nextReviewAt}" is not a date.`);
    } else if (nextReview.getTime() <= now.getTime()) {
      failures.push(`Content review expired on ${record.nextReviewAt}.`);
    }
  }

  if (record.sections.length === 0) {
    failures.push('Record has no content sections, so the page would be thin.');
  }

  /**
   * Requirement 1.5. A published page carries at least two sections of at least
   * 120 words, and none repeats another on the same record.
   *
   * This belongs in the gate rather than in the page template: a template that
   * skipped a short section would publish a partial page, and a template that
   * 404'd on one would be a second visibility rule the hub, the sitemap and the
   * static params did not share. Here, a thin record is simply not published —
   * on every surface at once.
   *
   * Additive: the condition above stays, so an empty record reports both.
   */
  failures.push(...evaluateSectionDepth(record));

  /**
   * Requirements 1.7 and 1.14. An administrative mapping publishes only when it
   * names a claim that passed the claim gate *and* records the boundary set the
   * value came from.
   *
   * The claim half was already enforced, because `collectLocalityClaimIds` picks
   * up `mapping.claimId`. What is new is the two failures below. The first closes
   * a hole rather than restating the claim check: a mapping with `claimId: null`
   * contributes nothing to the collected IDs, so before this condition existed a
   * mapping with no claim at all was quietly ignored while a mapping naming a bad
   * claim was caught. The second is Requirement 1.14 — a ward number without its
   * delimitation is a boundary assertion the reader cannot check, and "East Zone,
   * ward 80" is a different statement under two different delimitations.
   *
   * All five pre-existing records carry `boundaryVersion: null`, so this adds a
   * failure to records that already fail for other reasons. It changes no count
   * today and prevents a specific class of wrong page tomorrow.
   */
  for (const mapping of record.administrativeMappings) {
    if (!mapping.claimId) {
      failures.push(`Administrative mapping "${mapping.mappingType}" names no claim.`);
    }
    if (!mapping.boundaryVersion || mapping.boundaryVersion.trim().length === 0) {
      failures.push(
        `Administrative mapping "${mapping.mappingType}" records no boundary version.`
      );
    }
  }

  const claimIds = collectLocalityClaimIds(record);
  const claimEvaluation = evaluateClaims(claimIds, now);
  if (!claimEvaluation.eligible) {
    failures.push(...claimEvaluation.failures);
  }

  return { slug: record.slug, eligible: failures.length === 0, failures };
}

export function isLocalityPublishable(record: LocalityRecord, now: Date = new Date()): boolean {
  return evaluateLocality(record, now).eligible;
}

/**
 * The five records the repository already held before the backlog was seeded.
 *
 * Note what is NOT here any more: commute-time statements, "premier"/"heritage
 * belt" characterisations, project-status claims presented as current, and
 * typology descriptions asserted as local fact. Those were unsourced.
 *
 * These five stay hand-written rather than generated. Each carries specific
 * blocking notes recording what was wrong with the copy it used to publish, and
 * `north-bengaluru` carries a slug that must not change until DECISION-LOG.md
 * D-IMPL-06 closes. Generating them would lose both.
 */
const EXISTING_LOCALITY_RECORDS: readonly LocalityRecord[] = [
  {
    entityId: 'LOC-BLR-INDIRANAGAR',
    canonicalName: 'Indiranagar',
    aliases: ['Indira Nagar'],
    entityType: 'locality',
    slug: 'indiranagar',
    marketingGroup: 'East Bengaluru',
    administrativeMappings: [
      {
        mappingType: 'BBMP zone and ward',
        value: 'East Zone, wards 80 and 89',
        boundaryVersion: null,
        claimId: 'CLM-IND-WARD-001',
      },
    ],
    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,
    summary:
      'Research candidate. A locality guide for Indiranagar has not been written from verified evidence yet.',
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
    editorialStatus: 'research',
    publicationStatus: 'unpublished',
    blockingNotes: [
      'Previously marked published with a sign-off attributed to "INSTLE Research & Advisory Desk", which is not a real named reviewer.',
      'Transit, ward and layout claims each rest on a single organisation homepage.',
      'The "late 1960s" establishment date had no source at all and has been removed.',
      'Operational service coverage for this area is not confirmed (OWN-03).',
    ],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    entityId: 'LOC-BLR-KORAMANGALA',
    canonicalName: 'Koramangala',
    aliases: [],
    entityType: 'locality',
    slug: 'koramangala',
    marketingGroup: 'South-East Bengaluru',
    administrativeMappings: [
      {
        mappingType: 'BBMP zone and ward',
        value: 'South Zone, ward 151',
        boundaryVersion: null,
        claimId: 'CLM-KOR-WARD-001',
      },
    ],
    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,
    summary:
      'Research candidate. A locality guide for Koramangala has not been written from verified evidence yet.',
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
    editorialStatus: 'research',
    publicationStatus: 'unpublished',
    blockingNotes: [
      'Previously marked published on a non-attributable sign-off.',
      'The previous record also covered HSR Layout in one homepage module while the registry record named only Koramangala. The entity boundary needs a decision before publication.',
      'Metro project status was described as "in commissioning and testing" — a dated operational state published without a dated source.',
      'Operational service coverage for this area is not confirmed (OWN-03).',
    ],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    entityId: 'LOC-BLR-SADASHIVANAGAR',
    canonicalName: 'Sadashivanagar',
    aliases: ['Sadashiva Nagar'],
    entityType: 'locality',
    slug: 'sadashivanagar',
    marketingGroup: 'Central Bengaluru',
    administrativeMappings: [
      {
        mappingType: 'BBMP zone and ward',
        value: 'West Zone, ward 35',
        boundaryVersion: null,
        claimId: 'CLM-SAD-WARD-001',
      },
    ],
    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,
    summary:
      'Research candidate. A locality guide for Sadashivanagar has not been written from verified evidence yet.',
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
    editorialStatus: 'research',
    publicationStatus: 'unpublished',
    blockingNotes: [
      'Previously marked published on a non-attributable sign-off.',
      'Described as a heritage precinct with "heritage zoning setbacks" and as "premier"/"high-capital". No statutory heritage designation was evidenced, and the value characterisation is unsupported marketing language.',
      'Operational service coverage for this area is not confirmed (OWN-03).',
    ],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    entityId: 'LOC-BLR-HEBBAL',
    canonicalName: 'Hebbal',
    aliases: [],
    entityType: 'corridor',
    // Slug preserved. The master prompt requires a preserve/merge decision
    // before renaming, and forbids silently renaming this route to Hebbal.
    slug: 'north-bengaluru',
    marketingGroup: 'North Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,
    summary:
      'Research candidate. A guide for the northern corridor has not been written from verified evidence yet.',
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
    editorialStatus: 'research',
    publicationStatus: 'unpublished',
    blockingNotes: [
      'Slug "north-bengaluru" and the name "Hebbal & Bellary Road Corridor" describe different scopes. A preserve/merge/alias decision is recorded as open in DECISION-LOG.md; the slug is deliberately unchanged.',
      'Previously marked published on a non-attributable sign-off.',
      'Cited "BMRDA Master Strategy" in one surface and "BMRCL Phase 2B" in another for the same corridor; neither reference was specific.',
      'Operational service coverage for this corridor is not confirmed (OWN-03).',
    ],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    entityId: 'LOC-BLR-WHITEFIELD-INNER',
    canonicalName: 'Whitefield (inner residential enclaves)',
    aliases: ['Whitefield'],
    entityType: 'micro-locality',
    slug: 'whitefield-inner-enclaves',
    marketingGroup: 'East Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'unconfirmed',
    coverageResponsibleOwner: null,
    summary:
      'Research candidate. A guide for the inner Whitefield enclaves has not been written from verified evidence yet.',
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
    editorialStatus: 'research',
    publicationStatus: 'unpublished',
    blockingNotes: [
      'Was already a draft. The distinction between this micro-locality and Whitefield as a whole needs an editorial decision before a separate page is justified.',
      'Operational service coverage for this area is not confirmed (OWN-03).',
    ],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
] as const;

/**
 * Locality registry.
 *
 * The five pre-existing records first, then the candidates seeded from
 * `docs/seo-launch-handoff/AREA-RESEARCH-BACKLOG.csv` by
 * `scripts/seed-locality-candidates.mjs`.
 *
 * The accounting, asserted in `tests/locality-seeding.test.ts`: 127 seeded plus 5
 * held for an open entity-boundary decision plus 5 existing equals the 132
 * backlog candidates, and the registry holds 132 records. The held five are not
 * deleted — they are recorded as open decisions in the entity-boundary register,
 * outside the app module graph.
 *
 * Adding 127 records changes no count that matters to a reader: every one of them
 * is a research candidate with unconfirmed coverage and no reviewer, so the
 * publication gate still admits zero localities. Requirements 1.1, 1.2, 1.15.
 */
export const LOCALITY_REGISTRY: readonly LocalityRecord[] = [
  ...EXISTING_LOCALITY_RECORDS,
  ...SEEDED_LOCALITY_CANDIDATES,
];

const LOCALITY_BY_SLUG = new Map(LOCALITY_REGISTRY.map((record) => [record.slug, record]));

/** Alias slug -> canonical slug. Prevents a second page for a spelling variant. */
export const LOCALITY_SLUG_ALIASES: Readonly<Record<string, string>> = {
  'indira-nagar': 'indiranagar',
  'sadashiva-nagar': 'sadashivanagar',
} as const;

/**
 * Alias slug to canonical slug. Requirement 1.11: one place, one page.
 *
 * The lookup goes through a `Map` rather than indexing the object literal.
 * Property 5 found why: the argument is a URL path segment, so it is
 * attacker-controlled text, and an object literal answers for every key on
 * `Object.prototype`. `resolveLocalitySlug('__proto__')` used to return
 * `Object.prototype` and `resolveLocalitySlug('constructor')` used to return a
 * function — a declared `string` return that was not a string. Neither leaked
 * anything, because the registry lookup that followed simply missed and the route
 * 404'd, but a resolver that can hand back an object is a resolver whose callers
 * cannot rely on its type.
 *
 * A `Map` has no inherited keys, so an unknown segment now falls through to
 * itself, which is what every caller already assumed.
 */
const LOCALITY_ALIAS_LOOKUP = new Map(Object.entries(LOCALITY_SLUG_ALIASES));

export function resolveLocalitySlug(slug: string): string {
  return LOCALITY_ALIAS_LOOKUP.get(slug) ?? slug;
}

/**
 * Requirements 2.7 and 2.9. A region hub is never a published *locality*.
 *
 * A hub publishes only when it also clears the region hub gate — three published
 * locality links and two sections of its own — and that gate needs the published
 * locality set as its input, so it cannot be answered here without this module
 * importing the one that imports it. The accessors in this module therefore leave
 * every hub out, which only ever removes a record, and a hub reaches a public
 * surface solely through `getPublishedAreaRecords` in `locality-sections.ts`.
 *
 * That is also why `/areas` and the homepage, which list this accessor's output,
 * cannot link a hub that fails its gate: they never receive one.
 */
function isPublishedLocalityPage(record: LocalityRecord, now: Date): boolean {
  return record.entityType !== 'region-hub' && isLocalityPublishable(record, now);
}

/**
 * Records eligible for public display as locality pages. Currently empty, by design.
 *
 * `registry` is injectable so the region hub gate and its tests can evaluate a
 * fixture set through the same rule; every public caller omits it.
 */
export function getPublishedLocalities(
  now: Date = new Date(),
  registry: readonly LocalityRecord[] = LOCALITY_REGISTRY
): readonly LocalityRecord[] {
  return registry.filter((record) => isPublishedLocalityPage(record, now));
}

export function getPublishedLocalityBySlug(
  slug: string,
  now: Date = new Date()
): LocalityRecord | undefined {
  const record = LOCALITY_BY_SLUG.get(resolveLocalitySlug(slug));
  if (!record) return undefined;
  return isPublishedLocalityPage(record, now) ? record : undefined;
}

/** Slugs a sitemap or generateStaticParams may include. */
export function getPublishedLocalitySlugs(now: Date = new Date()): readonly string[] {
  return getPublishedLocalities(now).map((record) => record.slug);
}

/** Every slug in the registry, published or not. For internal tooling only. */
export function getAllLocalitySlugs(): readonly string[] {
  return LOCALITY_REGISTRY.map((record) => record.slug);
}

/** Full audit view for internal documentation and tests. */
export function auditLocalityRegistry(now: Date = new Date()): readonly LocalityEligibility[] {
  return LOCALITY_REGISTRY.map((record) => evaluateLocality(record, now));
}

/**
 * Retained export name from the previous implementation so nothing breaks.
 * Evaluated lazily via a getter would be preferable, but the previous export was
 * a value; keeping it a function-backed constant would change its type. Callers
 * should prefer getPublishedLocalities().
 *
 * @deprecated Use getPublishedLocalities().
 */
export const VERIFIED_LOCALITIES: readonly LocalityRecord[] = getPublishedLocalities();
