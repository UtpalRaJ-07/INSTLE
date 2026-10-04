/**
 * Section depth, section uniqueness, and the region hub gate.
 *
 * Three rules that all turn on the same question — is this page's text actually
 * its own? — so they share one comparison rather than three.
 *
 *  - **Requirement 1.5.** A published locality page carries at least two sections
 *    of at least 120 words whose headings and paragraphs are reproduced on no other
 *    published locality page, "either word for word or with only the place name
 *    substituted".
 *  - **Requirements 2.7 and 2.9.** A region hub publishes only with at least three
 *    published locality links and at least two sections whose text appears on none
 *    of the localities it links to.
 *
 * The design is explicit that these are one implementation: "Text uniqueness is
 * checked by normalising whitespace and case and comparing paragraph strings — the
 * same comparison Requirement 1.5 uses for locality sections, including the
 * place-name-substituted case, so one implementation serves both." A second
 * comparison would be a second answer to "is this the same section?", and the two
 * would drift on the first reflowed paragraph.
 *
 * The region hub gate is wired in through `isAreaRecordPublishable` and the
 * `getPublishedArea*` accessors at the end of this file. `/areas/[slug]` (page,
 * `generateStaticParams`, `generateMetadata`) and `getPublicRoutes`, and through
 * it the sitemap, read those accessors and nothing else, so a region hub below
 * either threshold is absent from all of them and its route returns 404.
 */

import { evaluateClaims } from './claims';
import {
  LOCALITY_REGISTRY,
  MIN_SECTION_WORDS,
  evaluateLocality,
  getPublishedLocalities,
  isLocalityPublishable,
  resolveLocalitySlug,
  sectionComparisonKeys,
  sectionWordCount,
  type LocalityRecord,
} from './localities';

/**
 * The section-depth half of Requirement 1.5 is now a condition of `evaluateLocality`
 * itself, so a thin record fails on every surface at once rather than only here.
 * Its implementation therefore lives in `localities.ts` (this module imports that
 * one, so the reverse import would be a cycle) and is re-exported unchanged, so
 * every existing import from this module keeps working.
 */
export {
  MIN_CONTENT_SECTIONS,
  MIN_SECTION_WORDS,
  evaluateSectionDepth,
  sectionComparisonKeys,
  sectionText,
  sectionWordCount,
  type SectionComparisonKeys,
} from './localities';

/** Requirement 2.7. */
export const MIN_REGION_HUB_LOCALITY_LINKS = 3;

/** Requirements 2.7 and 2.9. */
export const MIN_REGION_HUB_UNIQUE_SECTIONS = 2;

export interface DuplicateSection {
  /** Slug of the record the section was first seen on. */
  readonly a: string;
  /** Slug of the record reproducing it. */
  readonly b: string;
  /** The reproduced section's heading, as recorded on `a`. */
  readonly heading: string;
}

/**
 * Every section reproduced across two records, in first-appearance order.
 *
 * Cross-record only, because that is what Requirement 1.5 binds — "reproduced on
 * no *other* published locality page". A record repeating itself is a different
 * defect and `evaluateSectionDepth` reports it, so neither case is silently
 * dropped and neither is reported as the other.
 *
 * The caller decides what a duplicate means. Requirement 1.5 binds published
 * records; two unpublished candidates sharing a placeholder summary is not a
 * finding, and passing only the published set is how a caller says so.
 */
export function findDuplicateSections(
  records: readonly LocalityRecord[]
): readonly DuplicateSection[] {
  const duplicates: DuplicateSection[] = [];

  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const left = records[i];
      const right = records[j];
      if (left.slug === right.slug) continue;

      for (const leftSection of left.sections) {
        const leftKeys = sectionComparisonKeys(left, leftSection);
        for (const rightSection of right.sections) {
          const rightKeys = sectionComparisonKeys(right, rightSection);
          const matches =
            leftKeys.verbatim === rightKeys.verbatim ||
            leftKeys.placeSubstituted === rightKeys.placeSubstituted;
          if (!matches) continue;
          duplicates.push({ a: left.slug, b: right.slug, heading: leftSection.heading });
        }
      }
    }
  }

  return duplicates;
}

export interface RegionHubEligibility {
  readonly eligible: boolean;
  readonly failures: readonly string[];
}

/**
 * The locality links a region hub would actually render.
 *
 * Two conditions, and the second is the one worth stating. A nearby relationship
 * renders only when its claim passes the claim gate — Requirement 8.4 forbids a
 * placeholder, a partial sentence or a disabled link in place of an unevidenced
 * one, so an unevidenced relationship renders nothing at all. A link that renders
 * nothing cannot be one of the three Requirement 2.7 counts, which is why the
 * claim check belongs here rather than only at render time.
 */
export function renderableLocalityLinks(
  record: LocalityRecord,
  publishedLocalities: readonly LocalityRecord[],
  now: Date = new Date()
): readonly string[] {
  const publishedSlugs = new Set(publishedLocalities.map((published) => published.slug));

  const links = new Set<string>();
  for (const relationship of record.approvedNearbyRelationships) {
    const target = resolveLocalitySlug(relationship.slug);
    if (target === record.slug) continue;
    if (!publishedSlugs.has(target)) continue;
    if (!relationship.claimId) continue;
    if (!evaluateClaims([relationship.claimId], now).eligible) continue;
    links.add(target);
  }
  return [...links];
}

/**
 * Requirements 2.7 and 2.9. The region hub gate.
 *
 * It begins by inheriting every failure `evaluateLocality` returns rather than
 * re-deriving any of them, so a region hub can never publish on evidence a
 * locality would be rejected for, and then adds the two conditions that are about
 * being a hub: enough published destinations to be worth browsing, and enough text
 * of its own to be worth reading.
 *
 * "Text of its own" is measured with the same comparison Requirement 1.5 uses, and
 * two details of how it is measured are deliberate additions rather than readings.
 *
 * **The comparison set is every published locality, not only the ones the hub links
 * to.** Requirement 2.7 asks for sections whose text "appears on none of the locality
 * pages the region hub links to"; the linked set is a subset of the published set, so
 * comparing against the published set satisfies 2.7 and additionally catches a hub
 * that borrowed its copy from a published page it does not happen to link to. It also
 * means the condition still does work while no relationship claim passes the claim
 * gate and the countable link total is therefore zero — under the narrower reading the
 * uniqueness check would be vacuous exactly when the hub has no links, which is the
 * state every hub is in today.
 *
 * **A qualifying section must clear the 120-word depth bar.** A hub whose two unique
 * sections are one line each satisfies the letter of "carries two content sections"
 * and none of its purpose, and a gate condition satisfiable by a sentence is not a
 * gate condition.
 */
export function evaluateRegionHub(
  record: LocalityRecord,
  publishedLocalities: readonly LocalityRecord[],
  now: Date = new Date()
): RegionHubEligibility {
  const failures: string[] = [...evaluateLocality(record, now).failures];

  if (record.entityType !== 'region-hub') {
    failures.push(
      `Record entity type is "${record.entityType}"; the region hub rule applies to a "region-hub" record.`
    );
  }

  const links = renderableLocalityLinks(record, publishedLocalities, now);
  if (links.length < MIN_REGION_HUB_LOCALITY_LINKS) {
    failures.push(
      `Region hub links to ${links.length} published locality page(s); publication requires at least ${MIN_REGION_HUB_LOCALITY_LINKS}.`
    );
  }

  // The hub itself is excluded, or every one of its sections would match itself the
  // moment the hub appears in the published set it is being compared against.
  const comparisonRecords = publishedLocalities.filter(
    (published) => published.slug !== record.slug
  );
  const comparisonKeys = new Set<string>();
  for (const other of comparisonRecords) {
    for (const section of other.sections) {
      const keys = sectionComparisonKeys(other, section);
      comparisonKeys.add(keys.verbatim);
      comparisonKeys.add(keys.placeSubstituted);
    }
  }

  const uniqueSections = record.sections.filter((section) => {
    const keys = sectionComparisonKeys(record, section);
    if (comparisonKeys.has(keys.verbatim) || comparisonKeys.has(keys.placeSubstituted)) return false;
    return sectionWordCount(section) >= MIN_SECTION_WORDS;
  });

  if (uniqueSections.length < MIN_REGION_HUB_UNIQUE_SECTIONS) {
    failures.push(
      `Region hub carries ${uniqueSections.length} section(s) of at least ${MIN_SECTION_WORDS} words that appear on no other published locality page; publication requires at least ${MIN_REGION_HUB_UNIQUE_SECTIONS}.`
    );
  }

  return { eligible: failures.length === 0, failures };
}

/**
 * Requirements 1.3, 2.7 and 2.9. THE visibility rule for a record served under
 * `/areas/[slug]`.
 *
 * One rule with two branches rather than two rules. A region hub is decided by
 * `evaluateRegionHub`, which already inherits every `evaluateLocality` failure;
 * any other record is decided by the locality gate. So a hub can only ever fail
 * more than a locality would, never less, and no surface needs to know which kind
 * of record it is holding.
 *
 * `publishedLocalities` is the set a hub is measured against: published locality
 * pages, which by construction contain no hub. A hub linking to another hub does
 * not count towards its three, because Requirement 2.7 counts locality pages.
 */
export function isAreaRecordPublishable(
  record: LocalityRecord,
  publishedLocalities: readonly LocalityRecord[],
  now: Date = new Date()
): boolean {
  if (record.entityType === 'region-hub') {
    return evaluateRegionHub(record, publishedLocalities, now).eligible;
  }
  return isLocalityPublishable(record, now);
}

/**
 * Every record `/areas/[slug]` may serve at `now`: published localities plus any
 * region hub that clears its gate, in registry order.
 *
 * Every public surface that addresses an area route — static params, metadata, the
 * page itself, the public route registry and so the sitemap — calls this, or one of
 * the two accessors below that are defined in terms of it. `registry` is injectable
 * for tests only; every public caller omits it.
 */
export function getPublishedAreaRecords(
  now: Date = new Date(),
  registry: readonly LocalityRecord[] = LOCALITY_REGISTRY
): readonly LocalityRecord[] {
  const publishedLocalities = getPublishedLocalities(now, registry);
  return registry.filter((record) => isAreaRecordPublishable(record, publishedLocalities, now));
}

/**
 * The published record an `/areas/[slug]` request resolves to, or `undefined`.
 *
 * The slug is resolved through the alias table first, so a spelling variant finds
 * its canonical record and is then held to that record's gate — never to a gate of
 * its own.
 */
export function getPublishedAreaRecordBySlug(
  slug: string,
  now: Date = new Date(),
  registry: readonly LocalityRecord[] = LOCALITY_REGISTRY
): LocalityRecord | undefined {
  const canonical = resolveLocalitySlug(slug);
  return getPublishedAreaRecords(now, registry).find((record) => record.slug === canonical);
}

/** Slugs `generateStaticParams` and any area link may use. */
export function getPublishedAreaSlugs(
  now: Date = new Date(),
  registry: readonly LocalityRecord[] = LOCALITY_REGISTRY
): readonly string[] {
  return getPublishedAreaRecords(now, registry).map((record) => record.slug);
}
