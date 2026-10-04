/**
 * Deterministic grouping for the area hub and the guide hub.
 *
 * Requirement 2.2 asks that "the same record set always produces the same page".
 * Locale-aware collation cannot promise that: `localeCompare` and `Intl.Collator`
 * read ICU data, and the build machine and the runtime need not carry the same ICU
 * build. So ordering here uses one explicit, pure comparator over Unicode code
 * points, and the same comparator orders groups, locality links and guide links.
 *
 * Every function in this module is pure. None reads the clock, the registry or the
 * publication gate: the caller asks the gate — `getPublishedLocalities(now)` or
 * `getPublishedGuides(now)` — and hands the published set in. That keeps one gate
 * and one place that decides visibility, and it is what lets a property test drive
 * these functions with any generated set of records.
 *
 * `marketingGroup` appears on `LocalityGroup` only because it is the heading a
 * reader browses under. It is a browsing label, not a boundary claim, and nothing
 * here is shaped for page metadata or structured data.
 */

import type { CustomerIntent } from '@/config/constants';
import type { GuideRecord } from '@/config/guides';
import type { LocalityRecord } from '@/config/localities';

/** Requirement 2.3. No visible group list may exceed this many links. */
export const MAX_VISIBLE_LINKS_PER_GROUP = 25;

/**
 * The Combining Diacritical Marks block, U+0300 to U+036F.
 *
 * Deliberately this block and not every combining mark: after decomposition it
 * holds exactly the accents Latin letters carry, so "É" becomes "e" while the
 * vowel signs of a Kannada name, which live in their own block, survive intact.
 */
const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

/**
 * Any run of characters that is not a letter, a combining mark or a number.
 *
 * Marks are kept so a non-Latin name is not shredded into single letters; the
 * Latin accents have already been removed by `COMBINING_DIACRITICS`.
 */
const NON_ALPHANUMERIC_RUN = /[^\p{L}\p{M}\p{N}]+/gu;

/**
 * Lowercase, strip diacritics, collapse non-alphanumerics to a single space.
 *
 * `toLowerCase` rather than `toLocaleLowerCase`, because the locale variant is the
 * thing this module exists to avoid. Lowercasing happens before decomposition so
 * that a character whose lowercase form carries a combining accent — "İ" becomes
 * "i" plus U+0307 — has that accent stripped too.
 *
 * "Koramangala (5th Block)" becomes "koramangala 5th block".
 */
export function orderingKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(NON_ALPHANUMERIC_RUN, ' ')
    .trim();
}

/**
 * Compare two strings code point by code point.
 *
 * Not the `<` operator: that compares UTF-16 code units, which puts a character
 * above U+FFFF (stored as a surrogate pair starting 0xD800 to 0xDBFF) before a
 * character between U+E000 and U+FFFF, the opposite of their code point order.
 * When one string is a prefix of the other, the shorter sorts first. Returns -1, 0
 * or 1, and 0 only when the two strings are identical.
 */
export function compareCodePoints(a: string, b: string): number {
  let index = 0;
  while (index < a.length && index < b.length) {
    // Both strings agree on every code point before `index`, so they share the
    // same UTF-16 offset and one index serves both.
    const left = a.codePointAt(index) as number;
    const right = b.codePointAt(index) as number;
    if (left !== right) return left < right ? -1 : 1;
    index += left > 0xffff ? 2 : 1;
  }
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

/**
 * Code-point compare on `orderingKey`; ties broken by the raw string. Total order.
 *
 * The raw-string tie-break is what makes it total: two strings that share an
 * ordering key, such as "HSR Layout" and "hsr layout", still get a fixed order —
 * here uppercase first, because "H" is U+0048 and "h" is U+0068 — and the result is
 * 0 only when `a === b`. Because the raw string determines its own key, this is
 * the lexicographic order on the pair (key, raw), so it is antisymmetric and
 * transitive by construction.
 */
export function compareByName(a: string, b: string): number {
  const byKey = compareCodePoints(orderingKey(a), orderingKey(b));
  return byKey !== 0 ? byKey : compareCodePoints(a, b);
}

/** A link on the area hub. */
export interface LocalityLink {
  readonly slug: string;
  /** The locality name, used verbatim as link text. Requirement 2.2. */
  readonly name: string;
}

/** One `marketingGroup` heading on the area hub and the links under it. */
export interface LocalityGroup {
  readonly marketingGroup: string;
  /** At most 25, ordered. Requirement 2.3. */
  readonly visibleLinks: readonly LocalityLink[];
  /** The remainder, ordered. Rendered in the same HTML response. */
  readonly overflowLinks: readonly LocalityLink[];
}

/** A link on the guide hub. */
export interface GuideLink {
  readonly slug: string;
  /** The guide's customer question, used verbatim as link text, as the hub does today. */
  readonly question: string;
}

/** One customer intent heading on the guide hub and the links under it. */
export interface GuideGroup {
  readonly intent: CustomerIntent;
  /** At most 25, ordered. */
  readonly visibleLinks: readonly GuideLink[];
  /** The remainder, ordered. */
  readonly overflowLinks: readonly GuideLink[];
}

/**
 * Hub order for locality records: name, then slug, then entityId.
 *
 * The name is compared with `compareByName` because it is what the reader sees.
 * Slug and entityId are identifiers, so they are compared by raw code point with no
 * folding. Two records compare equal only when all three match, and the grouping
 * below refuses a set where two records share a slug, so two records that reach
 * a group never compare equal.
 */
export function compareLocalityRecords(a: LocalityRecord, b: LocalityRecord): number {
  return (
    compareByName(a.canonicalName, b.canonicalName) ||
    compareCodePoints(a.slug, b.slug) ||
    compareCodePoints(a.entityId, b.entityId)
  );
}

/**
 * Hub order for guide records: question, then slug, then guideId.
 *
 * The question is the link text, so it is what the reader scans in order. The
 * tie-breaks mirror `compareLocalityRecords`.
 */
export function compareGuideRecords(a: GuideRecord, b: GuideRecord): number {
  return (
    compareByName(a.question, b.question) ||
    compareCodePoints(a.slug, b.slug) ||
    compareCodePoints(a.guideId, b.guideId)
  );
}

interface GroupingRules<R, K extends string, L> {
  /** Named in the error message when two records share a slug. */
  readonly surface: string;
  readonly keyOf: (record: R) => K;
  readonly slugOf: (record: R) => string;
  readonly compare: (a: R, b: R) => number;
  readonly toLink: (record: R) => L;
}

interface SplitGroup<K extends string, L> {
  readonly key: K;
  readonly visibleLinks: readonly L[];
  readonly overflowLinks: readonly L[];
}

/**
 * The one implementation behind both hubs.
 *
 * Buckets records by key, orders the keys with `compareByName`, orders each
 * bucket with the record comparator, and splits each ordered bucket at
 * `MAX_VISIBLE_LINKS_PER_GROUP`: the first 25 are visible, the rest overflow.
 * Groups come from records rather than from a list of known labels, and a group
 * with no records is dropped, so an empty heading can never be emitted.
 *
 * Throws when two records share a slug. Requirement 2.2 allows exactly one link
 * per canonical slug, and silently keeping one of two would make the surviving
 * record depend on input order. The registry already guarantees unique slugs, so
 * this only fires on a broken registry, and a statically rendered hub then fails
 * the build instead of shipping a duplicate link.
 *
 * The input is never mutated.
 */
function groupAndSplit<R, K extends string, L>(
  records: readonly R[],
  rules: GroupingRules<R, K, L>
): readonly SplitGroup<K, L>[] {
  const seenSlugs = new Set<string>();
  const buckets = new Map<K, R[]>();

  for (const record of records) {
    const slug = rules.slugOf(record);
    if (seenSlugs.has(slug)) {
      throw new Error(`${rules.surface}: two published records share the slug "${slug}".`);
    }
    seenSlugs.add(slug);

    const key = rules.keyOf(record);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(record);
    else buckets.set(key, [record]);
  }

  return [...buckets.keys()]
    .sort(compareByName)
    .map((key) => {
      const ordered = [...(buckets.get(key) ?? [])].sort(rules.compare).map(rules.toLink);
      return {
        key,
        visibleLinks: ordered.slice(0, MAX_VISIBLE_LINKS_PER_GROUP),
        overflowLinks: ordered.slice(MAX_VISIBLE_LINKS_PER_GROUP),
      };
    })
    .filter((group) => group.visibleLinks.length > 0);
}

/**
 * Groups published records by marketingGroup, drops empty groups, orders groups
 * and links by compareByName, and splits each group at 25.
 * Requirements 2.2, 2.3, 2.5.
 *
 * Pass the output of `getPublishedLocalities(now)`. This function does not consult
 * the gate, so a record that reaches it is treated as published.
 */
export function groupPublishedLocalities(
  records: readonly LocalityRecord[]
): readonly LocalityGroup[] {
  return groupAndSplit(records, {
    surface: 'groupPublishedLocalities',
    keyOf: (record) => record.marketingGroup,
    slugOf: (record) => record.slug,
    compare: compareLocalityRecords,
    toLink: (record): LocalityLink => ({ slug: record.slug, name: record.canonicalName }),
  }).map(({ key, visibleLinks, overflowLinks }) => ({
    marketingGroup: key,
    visibleLinks,
    overflowLinks,
  }));
}

/**
 * The guide hub's sibling of `groupPublishedLocalities`: groups published guides
 * by customer intent with the same comparator, the same split and the same
 * implementation.
 *
 * Pass the output of `getPublishedGuides(now)`. This function does not consult the
 * gate, so a record that reaches it is treated as published.
 */
export function groupPublishedGuides(records: readonly GuideRecord[]): readonly GuideGroup[] {
  return groupAndSplit(records, {
    surface: 'groupPublishedGuides',
    keyOf: (record) => record.intent,
    slugOf: (record) => record.slug,
    compare: compareGuideRecords,
    toLink: (record): GuideLink => ({ slug: record.slug, question: record.question }),
  }).map(({ key, visibleLinks, overflowLinks }) => ({
    intent: key,
    visibleLinks,
    overflowLinks,
  }));
}
