/**
 * Indian English on every public page. Requirement 9.12.
 *
 * The requirement names nine primary terms. The check is written as a
 * proscription list rather than "the primary term must always appear", for a
 * reason that matters in practice: approved copy legitimately writes
 * "Flat / apartment" as a field label, and a rule demanding the primary term
 * everywhere would fail reviewed wording that is already correct. A proscription
 * list catches American vocabulary and American spelling without touching that,
 * and each entry names the replacement — so a failure tells the author what to
 * write instead of only what not to.
 *
 * `tests/public-content.test.ts` applies `PROSCRIBED_TERMS` to the visible copy of
 * every public source file — JSX text and prose strings, not the code around
 * them, so a `--color-*` token or the schema.org type name is never mistaken for
 * wording. The patterns match whole words only.
 */

/** Requirement 9.12. The primary term for each concept. */
export const PRIMARY_TERMS = [
  'flat',
  'independent house',
  'villa',
  'site',
  'plot',
  'locality',
  'possession',
  'resale',
  'brokerage',
] as const;

export type PrimaryTerm = (typeof PRIMARY_TERMS)[number];

/** Wording that must not appear on a public page, and what to write instead. */
export const PROSCRIBED_TERMS: readonly { term: RegExp; use: string }[] = [
  { term: /\bneighborhood\b/i, use: 'locality' },
  { term: /\brealtor\b/i, use: 'broker' },
  { term: /\bzip code\b/i, use: 'PIN code' },
  { term: /\bcondo(minium)?\b/i, use: 'flat' },
  { term: /\bapartment complex\b/i, use: 'apartment project' },
  { term: /\bHOA\b/, use: 'owners association' },
  { term: /\bclosing costs\b/i, use: 'registration and transfer charges' },
  { term: /\bescrow\b/i, use: 'the agreed payment arrangement' },
  { term: /\bcolor\b/i, use: 'colour' },
  { term: /\bcenter\b/i, use: 'centre' },
  { term: /\borganiz(e|ed|ation)\b/i, use: 'organis…' },
];

/**
 * Every proscribed term a piece of copy contains, with its replacement.
 *
 * Returns matches rather than a boolean, so a failing page can name each term and
 * the word to use — Requirement 9.12 is an editorial rule, and an editorial rule
 * that reports "failed" and nothing else does not get followed.
 */
export function findProscribedTerms(
  copy: string
): readonly { readonly matched: string; readonly use: string }[] {
  const found: { matched: string; use: string }[] = [];
  for (const entry of PROSCRIBED_TERMS) {
    const match = copy.match(entry.term);
    if (match) found.push({ matched: match[0], use: entry.use });
  }
  return found;
}
