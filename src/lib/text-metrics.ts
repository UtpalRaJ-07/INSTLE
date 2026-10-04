/**
 * Text measurement and comparison for the publication gates.
 *
 * Four bounds in this feature are stated in words: a guide's direct answer is 20
 * to 60 words (Requirements 5.3, 5.11), a guide section heading is at most 15
 * words (Requirement 5.4), and a locality content section is at least 120 words
 * (Requirement 1.5). Three different word counters would produce three different
 * verdicts at the boundary, so there is one, and the gate and the tests both call
 * it. The design says exactly this: "Word counting is one shared function so the
 * gate and the tests can never disagree."
 *
 * The counting rule is the simplest one that is defensible: trim, split on runs of
 * whitespace, drop empties. It is deterministic and locale-independent, which
 * matters because the same registry has to produce the same publication decision
 * on every machine.
 *
 * One consequence is worth stating rather than discovering. A spaced em dash —
 * like this one — counts as a word, because it is separated by whitespace on both
 * sides. That is arguably wrong about English and unarguably right about this
 * codebase: the alternative is a punctuation-stripping pass whose exact behaviour
 * an editor cannot predict from looking at the sentence, and a bound nobody can
 * predict is a bound nobody can write to. Editors who care about the difference
 * can see it, because every failure reports the measured count.
 */

/** Trim, split on whitespace runs, drop empties. Deterministic. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Normalise text for the duplicate-section comparison.
 *
 * Requirement 1.5 forbids a section whose text is reproduced on another published
 * locality page "either word for word or with only the place name substituted".
 * Collapsing whitespace and case is what makes "word for word" survive a reflow
 * and a capitalisation change, which are the two ways duplicated copy usually
 * arrives.
 */
export function normaliseComparableText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The placeholder every place name collapses to before comparison.
 *
 * Deliberately a token no copy would contain, so a section that genuinely
 * discusses placeholders is not mistaken for a substituted one.
 */
export const PLACE_NAME_PLACEHOLDER = '\u0000place\u0000';

/**
 * Replace each supplied name with the placeholder, longest name first.
 *
 * Longest first matters: "Whitefield (inner residential enclaves)" has to be
 * replaced before "Whitefield", or the substitution leaves a fragment behind and
 * two sections that differ only by place name stop looking alike.
 *
 * Names are matched case-insensitively on the already-normalised text, and each
 * name is escaped before it reaches a regular expression, because a canonical name
 * legitimately contains brackets.
 */
export function substitutePlaceNames(text: string, names: readonly string[]): string {
  const ordered = [...new Set(names.map((name) => normaliseComparableText(name)))]
    .filter((name) => name.length > 0)
    .sort((a, b) => b.length - a.length);

  let out = normaliseComparableText(text);
  for (const name of ordered) {
    out = out.split(name).join(PLACE_NAME_PLACEHOLDER);
  }
  return out;
}
