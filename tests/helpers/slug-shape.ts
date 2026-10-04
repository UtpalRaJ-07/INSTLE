import { INTENT_TOKENS, TYPE_TOKENS } from '@/config/guide-classification';

/**
 * Slug shape scanning (Requirement 12.2, design "Slug and PIN code scanning").
 *
 * The lexicons and the two pure rules `tests/slug-and-pin-scan.test.ts` holds the
 * registry to, extracted in task 14.8 so Property 12 states the same rules over
 * generated slugs and generated record sets. One implementation: a slug the property
 * accepts is a slug the suite accepts.
 *
 * The route-path half of Requirement 12.1 lives in `tests/helpers/route-shape.ts`,
 * and the whole-segment PIN ruling lives in `scripts/seed-guide-candidates.mjs`,
 * which applies it when it seeds guide slugs.
 */

/**
 * Transaction-intent words: the Requirement 4.9 lexicon plus `broker`, which
 * Requirement 12.1 names as a transaction intent (`broker`, `best-broker`) and
 * the 4.9 lexicon does not carry. The union only adds failure conditions.
 */
export const TRANSACTION_INTENT_WORDS: readonly string[] = [...new Set([...INTENT_TOKENS, 'broker'])];

/**
 * Property-type words: the Requirement 4.9 lexicon, unioned with the type
 * segments Requirement 12.1 lists so that neither list can drift out of the other.
 */
export const PROPERTY_TYPE_WORDS: readonly string[] = [
  ...new Set([...TYPE_TOKENS, 'apartment', 'flat', 'villa', 'plot', 'house', 'commercial', 'office']),
];

/** A run of exactly six digits anywhere in the slug, hyphenated or not. */
export const SIX_DIGIT_GROUP = /(?<!\d)\d{6}(?!\d)/;

/**
 * The banned words and numeric groups a slug carries.
 *
 * Words are matched as **whole hyphen-separated tokens**, the design's definition
 * of a slug token, with a multi-part word such as `rent-out` matched as a
 * contiguous run of parts. `tokeniseSlug` is deliberately not used: it keeps an
 * area name whole, so a locality slug would come back as one area token and any
 * intent or type word inside it would be hidden.
 */
export function bannedSlugParts(slug: string): string[] {
  const parts = slug.toLowerCase().split('-').filter((part) => part.length > 0);
  const hits: string[] = [];
  for (const word of [...TRANSACTION_INTENT_WORDS, ...PROPERTY_TYPE_WORDS]) {
    const wordParts = word.split('-');
    for (let index = 0; index + wordParts.length <= parts.length; index += 1) {
      if (wordParts.every((part, offset) => parts[index + offset] === part)) {
        hits.push(word);
        break;
      }
    }
  }
  const digits = SIX_DIGIT_GROUP.exec(slug);
  if (digits) hits.push(digits[0]);
  return hits;
}

/**
 * Every way a slug fails to resolve to exactly one record, one line per failure,
 * each naming the slug. Taken as arguments so synthetic cases exercise the same
 * function the live registry is held to.
 */
export function slugResolutionFailures(
  records: readonly { readonly slug: string }[],
  aliases: Readonly<Record<string, string>>,
  resolve: (slug: string) => string
): string[] {
  const failures: string[] = [];
  const counts = new Map<string, number>();
  for (const { slug } of records) counts.set(slug, (counts.get(slug) ?? 0) + 1);

  for (const [slug, count] of counts) {
    if (count > 1) failures.push(`${slug}: the slug of ${count} records`);
  }
  for (const key of Object.keys(aliases)) {
    if (counts.has(key)) failures.push(`${key}: an alias key that is also a record slug`);
  }
  for (const input of [...counts.keys(), ...Object.keys(aliases)]) {
    const resolved = resolve(input);
    const count = counts.get(resolved) ?? 0;
    if (count !== 1) failures.push(`${input}: resolves to ${resolved}, the slug of ${count} records`);
    else if (resolve(resolved) !== resolved) failures.push(`${input}: resolves to ${resolved}, which resolves again`);
  }
  return failures;
}
