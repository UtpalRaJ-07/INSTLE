/**
 * Guide content classification and slug distinctness.
 *
 * Two pure functions, both of which exist because a hand-applied label drifts and
 * a function does not.
 *
 * `classifyGuideContent` answers Requirement 4.11: a record that states anything
 * about law, tax, documentation, fees, regulation or a market fact *is*
 * external-fact content, whatever its stored `contentClass` says. Task 6 turns the
 * disagreement into a gate failure; this module is the authority the gate will
 * call.
 *
 * `slugsDifferOnlyByPermutationToken` answers Requirement 4.9: two guide slugs
 * that differ only by an intent word, a property-type word or an area name are the
 * same page twice, which is the doorway pattern this whole feature exists to
 * refuse.
 *
 * Neither function reads or writes anything. Both are deterministic, so the same
 * registry always produces the same answer on any machine.
 */

import type { GuideRecord } from './guides';
import { LOCALITY_REGISTRY } from './localities';

export type { GuideContentClass } from './guides';
import type { GuideContentClass } from './guides';

// ---------------------------------------------------------------------------
// External-fact classification
// ---------------------------------------------------------------------------

/**
 * The lexicon Requirement 4.11 turns into a test.
 *
 * Six families, each naming a thing an external body sets rather than a thing the
 * brokerage decides: statute, tax, title documentation, fees, named authorities
 * and market figures. The list is deliberately short and literal. A broader
 * lexicon would classify every guide external-fact and the distinction would stop
 * meaning anything; a narrower one would let a sentence about stamp duty publish
 * under the own-process conditions.
 */
export const EXTERNAL_FACT_LEXICON: readonly RegExp[] = [
  /\b(act|rule|regulation|notification|statute|section \d)\b/i,
  /\b(tax|taxes|stamp duty|registration charge|cess|GST|TDS)\b/i,
  /\b(khata|title deed|encumbrance|mutation|sale deed|conveyance)\b/i,
  /\b(brokerage fee|commission rate|fee percentage)\b/i,
  /\b(RERA|BBMP|BDA|BMRCL|sub-registrar)\b/i,
  /\b(market rate|price trend|prevailing rent|circle rate|guidance value)\b/i,
];

/**
 * The record text the classifier reads.
 *
 * Everything a reader would see, in one string: the customer question, the H1, the
 * meta description, the direct answer, every section heading, paragraph and bullet,
 * and the next step.
 *
 * **`scopeNote` is deliberately excluded, and `blockingNotes` with it.** A scope
 * note is a disclaimer — its whole job is to say what the guide does *not* cover,
 * and the standing own-process note reads "It is not legal, tax or financial
 * advice". Requirement 4.11 classifies a record that *states* something about tax;
 * a sentence denying that it states anything about tax is the opposite of that, and
 * scanning it would classify every own-process guide as external-fact, which would
 * empty the class of meaning. `blockingNotes` are internal editorial text rather
 * than statements to a reader, and including them would make the classification
 * circular: the notes are written from the classification.
 */
export function guideClassifiableText(record: GuideRecord): string {
  const parts: string[] = [
    record.question,
    record.title,
    record.description,
    record.directAnswer,
    record.nextStep,
  ];
  for (const section of record.sections) {
    parts.push(section.heading);
    parts.push(...section.paragraphs);
    parts.push(...(section.bullets ?? []));
  }
  return parts.filter((part) => part.trim().length > 0).join('\n');
}

/**
 * Which lexicon entries the record's own text matches, with the matched text.
 *
 * Returned rather than swallowed, because "this record is external-fact" is not
 * actionable and "this record says 'khata records'" is.
 */
export function externalFactMatches(
  record: GuideRecord
): readonly { readonly pattern: string; readonly matched: string }[] {
  const text = guideClassifiableText(record);
  const matches: { pattern: string; matched: string }[] = [];
  for (const pattern of EXTERNAL_FACT_LEXICON) {
    const found = pattern.exec(text);
    if (found) matches.push({ pattern: pattern.source, matched: found[0] });
  }
  return matches;
}

/** Returns the class the record's own text requires. Requirement 4.11. */
export function classifyGuideContent(record: GuideRecord): GuideContentClass {
  return externalFactMatches(record).length > 0 ? 'external-fact' : 'own-process';
}

// ---------------------------------------------------------------------------
// Figures set by somebody else
// ---------------------------------------------------------------------------

/**
 * Requirement 4.8: a figure, rate or threshold *set by an external body* must carry
 * a claim that has passed the claim gate.
 *
 * The hard part is not detecting numerals, it is not detecting the wrong ones. A
 * published guide says "five things", "four answers" and "within 30 days", and none
 * of those is a figure anybody outside this business set — the first two are
 * counting the page's own list and the third is the reader's own timeline. Flagging
 * them would make the condition noise, and a noisy condition gets switched off.
 *
 * So the patterns below look for the shapes a figure only takes when somebody else
 * fixed it: a percentage, a rupee amount, a lakh or crore amount, a numbered
 * statutory section, and a numeral sitting next to a term naming a charge an
 * authority levies. A guide can still discuss how a charge works — it just cannot
 * put a number on it without evidence.
 *
 * Each entry is named, because a failure saying "external-body figure detected" is
 * not actionable and one saying `percentage: 5%` is.
 */
export const EXTERNAL_BODY_FIGURE_PATTERNS: readonly {
  readonly name: string;
  readonly pattern: RegExp;
}[] = [
  { name: 'percentage', pattern: /\d+(?:\.\d+)?\s*(?:%|per ?cent\b)/i },
  { name: 'rupee amount', pattern: /(?:₹|\bRs\.?|\bINR\b)\s*\d/i },
  { name: 'lakh or crore amount', pattern: /\b\d+(?:\.\d+)?\s*(?:lakh|lakhs|crore|crores)\b/i },
  { name: 'statutory section number', pattern: /\bsection\s+\d+/i },
  {
    name: 'numeral beside an externally set charge',
    pattern:
      /\b(?:stamp duty|registration charge|registration fee|cess|GST|TDS|guidance value|circle rate|property tax)\b[^.?!]{0,40}\d|\d[^.?!]{0,40}\b(?:stamp duty|registration charge|registration fee|cess|GST|TDS|guidance value|circle rate|property tax)\b/i,
  },
] as const;

/**
 * Which external-body figure shapes the record's own text carries, with the matched
 * text.
 *
 * Reads the same reader-facing fields `classifyGuideContent` reads, for the same
 * reason: `scopeNote` denies that the guide states external facts, and scanning a
 * denial would flag every guide that carries the standing disclaimer.
 */
export function externalBodyFigureMatches(
  record: GuideRecord
): readonly { readonly name: string; readonly matched: string }[] {
  const text = guideClassifiableText(record);
  const matches: { name: string; matched: string }[] = [];
  for (const { name, pattern } of EXTERNAL_BODY_FIGURE_PATTERNS) {
    const found = pattern.exec(text);
    if (found) matches.push({ name, matched: found[0].trim() });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Slug distinctness
// ---------------------------------------------------------------------------

/**
 * Intent words. Requirement 4.9.
 *
 * `rent-out` is two hyphen-separated parts, so the tokeniser below matches the
 * longest lexicon phrase first rather than splitting blindly on hyphens.
 */
export const INTENT_TOKENS: readonly string[] = [
  'buy',
  'sell',
  'rent',
  'rent-out',
  'let',
  'purchase',
  'buying',
  'selling',
  'renting',
];

/** Property-type words. Requirement 4.9. */
export const TYPE_TOKENS: readonly string[] = [
  'flat',
  'apartment',
  'villa',
  'plot',
  'site',
  'house',
  'independent',
  'commercial',
  'office',
  'shop',
  'showroom',
  'warehouse',
];

/** Lowercase and hyphenate a place name, e.g. `HSR Layout` → `hsr-layout`. */
export function hyphenatePlaceName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Area names. Requirement 4.9.
 *
 * Every canonical name and alias in the locality registry, lowercased and
 * hyphenated, plus the two city names. Read as **whole hyphenated names** rather
 * than as their individual parts: `electronic-city` is one area token, and `city`
 * on its own is not. Splitting them would put `layout`, `nagar`, `road`, `park`
 * and `city` into the lexicon and start collapsing slugs that are genuinely
 * different questions.
 */
export const AREA_TOKENS: readonly string[] = (() => {
  const tokens = new Set<string>(['bengaluru', 'bangalore']);
  for (const record of LOCALITY_REGISTRY) {
    const canonical = hyphenatePlaceName(record.canonicalName);
    if (canonical) tokens.add(canonical);
    for (const alias of record.aliases) {
      const hyphenated = hyphenatePlaceName(alias);
      if (hyphenated) tokens.add(hyphenated);
    }
  }
  return [...tokens].sort();
})();

/** Every permutation token, longest first, so the tokeniser matches greedily. */
const PERMUTATION_PHRASES: readonly string[] = [
  ...INTENT_TOKENS,
  ...TYPE_TOKENS,
  ...AREA_TOKENS,
].sort((a, b) => b.split('-').length - a.split('-').length || b.length - a.length);

const PERMUTATION_TOKEN_SET = new Set(PERMUTATION_PHRASES);

/** True when the token is drawn from the intent, property-type or area lexicons. */
export function isPermutationToken(token: string): boolean {
  return PERMUTATION_TOKEN_SET.has(token);
}

/**
 * Split a slug into tokens, keeping multi-part lexicon phrases whole.
 *
 * `rent-out-flat-bengaluru` becomes `[rent-out, flat, bengaluru]` rather than
 * `[rent, out, flat, bengaluru]`, because `rent-out` is one intent word and `out`
 * is not a word this rule knows. The same greedy match keeps `electronic-city`
 * and `hsr-layout` whole.
 */
export function tokeniseSlug(slug: string): readonly string[] {
  const parts = slug.split('-').filter((part) => part.length > 0);
  const tokens: string[] = [];
  let index = 0;
  while (index < parts.length) {
    let matched: string | null = null;
    for (const phrase of PERMUTATION_PHRASES) {
      const phraseParts = phrase.split('-');
      if (phraseParts.length < 2 || index + phraseParts.length > parts.length) continue;
      if (phraseParts.every((part, offset) => parts[index + offset] === part)) {
        matched = phrase;
        break;
      }
    }
    if (matched) {
      tokens.push(matched);
      index += matched.split('-').length;
      continue;
    }
    tokens.push(parts[index]);
    index += 1;
  }
  return tokens;
}

/** The tokens in `a` that `b` does not account for, counting repeats. */
function multisetDifference(a: readonly string[], b: readonly string[]): string[] {
  const remaining = new Map<string, number>();
  for (const token of b) remaining.set(token, (remaining.get(token) ?? 0) + 1);
  const out: string[] = [];
  for (const token of a) {
    const count = remaining.get(token) ?? 0;
    if (count > 0) remaining.set(token, count - 1);
    else out.push(token);
  }
  return out;
}

/**
 * Requirement 4.9. Two slugs collide when their token multisets differ only by
 * tokens drawn from the intent, property-type or area lexicons.
 *
 * Identical slugs return `false`: that is a uniqueness failure, checked separately,
 * and reporting it here would bury the interesting case. Two slugs carrying the
 * same tokens in a different order return `true` — a reordering is the purest form
 * of the permutation pattern.
 */
export function slugsDifferOnlyByPermutationToken(a: string, b: string): boolean {
  if (a === b) return false;

  const left = tokeniseSlug(a);
  const right = tokeniseSlug(b);
  const onlyInLeft = multisetDifference(left, right);
  const onlyInRight = multisetDifference(right, left);

  if (onlyInLeft.length === 0 && onlyInRight.length === 0) return true;

  return [...onlyInLeft, ...onlyInRight].every((token) => isPermutationToken(token));
}

/**
 * Every colliding pair in a slug list, ordered by first appearance.
 *
 * The caller decides what a collision means. Requirement 4.9 fails the build only
 * for two *published* guides; an unpublished candidate pair is a recorded decision
 * to resolve before either publishes.
 */
export function findPermutationSlugPairs(
  slugs: readonly string[]
): readonly { readonly a: string; readonly b: string }[] {
  const pairs: { a: string; b: string }[] = [];
  for (let i = 0; i < slugs.length; i += 1) {
    for (let j = i + 1; j < slugs.length; j += 1) {
      if (slugsDifferOnlyByPermutationToken(slugs[i], slugs[j])) {
        pairs.push({ a: slugs[i], b: slugs[j] });
      }
    }
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// One question, one page
// ---------------------------------------------------------------------------

export interface OneQuestionOnePageCollision {
  readonly kind: 'question' | 'primary-intent' | 'permutation-slug';
  /** The two slugs involved, in the order they appear in the input. */
  readonly a: string;
  readonly b: string;
  /** What the two share, quoted, so the failure is actionable. */
  readonly detail: string;
}

/** Collapse whitespace and case, so a reflowed question is still the same question. */
function normaliseQuestion(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The three ways Requirement 4.9 says two guides restate one another: the same
 * customer question, the same recorded primary intent, or slugs that differ only by
 * a permutation token.
 *
 * Takes the records the caller has already established are published, rather than a
 * date, because the rule binds published pages and the gate is the authority on
 * which those are. Every collision names both slugs and what they share.
 */
export function findOneQuestionOnePageCollisions(
  published: readonly GuideRecord[]
): readonly OneQuestionOnePageCollision[] {
  const collisions: OneQuestionOnePageCollision[] = [];

  for (let i = 0; i < published.length; i += 1) {
    for (let j = i + 1; j < published.length; j += 1) {
      const left = published[i];
      const right = published[j];

      if (normaliseQuestion(left.question) === normaliseQuestion(right.question)) {
        collisions.push({
          kind: 'question',
          a: left.slug,
          b: right.slug,
          detail: `both answer "${left.question.trim()}"`,
        });
      }

      if (
        left.primaryIntent &&
        right.primaryIntent &&
        left.primaryIntent.intentEntryId === right.primaryIntent.intentEntryId
      ) {
        collisions.push({
          kind: 'primary-intent',
          a: left.slug,
          b: right.slug,
          detail: `both carry primary intent ${left.primaryIntent.intentEntryId}`,
        });
      }

      if (slugsDifferOnlyByPermutationToken(left.slug, right.slug)) {
        collisions.push({
          kind: 'permutation-slug',
          a: left.slug,
          b: right.slug,
          detail: 'slugs differ only by an intent, property-type or area token',
        });
      }
    }
  }

  return collisions;
}
