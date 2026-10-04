import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { maskToCopy } from './public-copy';
import { ROOT, stripComments } from './public-surface';

/**
 * The banned-pattern scan of the public surface: the machinery, the approved-denial
 * list and the pattern catalogue.
 *
 * `tests/public-content.test.ts` is the Content_Policy_Test_Suite and holds the
 * assertions. What lives here is everything those assertions are *made of*, for one
 * reason: Property 11 (task 14.7) states the same rules over generated text, and a
 * property test cannot import a test file without re-registering its suites. So the
 * scanner takes its sources as an argument, the policy suite binds it to the real
 * public surface, and the property test binds it to synthetic files. One
 * implementation, two callers, no chance of the two disagreeing about what a banned
 * pattern is or what excuses one.
 */

// ---------------------------------------------------------------------------
// The approved-denial list
// ---------------------------------------------------------------------------

/**
 * A sentence that legitimately contains a banned phrase because it *denies* it.
 *
 * Saying "we do not guarantee a sale" is the opposite of a violation, but a naive
 * pattern match cannot tell the difference. Each entry is an exact fragment from
 * approved copy, so a new occurrence of a banned phrase still fails the test
 * unless it is added here deliberately.
 *
 * The list is typed rather than flat, because a bare string records only *that*
 * somebody excused an occurrence — not why, and not which rule it would otherwise
 * trip. An exemption nobody can read is an exemption nobody reviews, and the way a
 * policy suite stops meaning anything is one unexplained string at a time. The
 * reason is the argument for the entry, and the criterion is what it is an
 * exemption from, so a reviewer can check both against the copy.
 *
 * Two rules keep the list honest, and they pull in opposite directions on purpose:
 *
 *  - every entry must still match a file on the public surface, so a fragment whose
 *    copy has been rewritten fails and gets deleted rather than sitting there
 *    widening the amnesty over copy nobody wrote yet (`the approved-denial list`
 *    in the policy suite, Requirements 12.6 and 12.7);
 *  - the fragment is exact, so it excuses the sentence it quotes and nothing else.
 */
export interface ApprovedDenial {
  /** Exact fragment from approved copy. */
  readonly fragment: string;
  /** Why this occurrence is a denial of the pattern rather than a use of it. */
  readonly reason: string;
  /** The criterion the fragment would otherwise trip. */
  readonly criterion: string;
}

export const APPROVED_DENIALS: readonly ApprovedDenial[] = [
  {
    // /about — the "what we have not published" list.
    fragment: 'No awards, rankings, or “most trusted” claims.',
    reason:
      'Names the superlative categories in order to state that none of them is published. The sentence is a ' +
      'refusal of the claim, and deleting it would remove the disclosure rather than a claim.',
    criterion: '12.6 review counts, ratings and superlative claims',
  },
  {
    // /how-it-works — the limits list.
    fragment: 'We do not guarantee a sale, a purchase, a tenant, or a date. Nobody can.',
    reason: 'Refuses the guarantee outright, for each outcome Requirement 12.7 names.',
    criterion: '12.7 promissory word near an outcome',
  },
  {
    fragment: 'Must not become a clear-title or legal-clearance promise.',
    reason: 'An editorial instruction on a draft guide, forbidding the promise rather than making it.',
    criterion: '12.7 promissory word near an outcome',
  },
  {
    fragment: 'If someone offers you a guaranteed sale date, ask what happens if the date passes.',
    reason: 'Warns the reader against a guarantee somebody else offers; the advice is to distrust it.',
    criterion: '12.7 promissory word near a duration',
  },
  {
    fragment: 'Anyone guaranteeing you a date',
    reason: 'Attributes the guarantee to a third party as a warning sign, never to this business.',
    criterion: '12.7 promissory word near a duration',
  },
  {
    // Landlord expectation note — states what the filtering conversation is not.
    fragment: 'not a background check or a verification service',
    reason: 'States the limit of what the tenant conversation is, so the reader does not read more into it.',
    criterion: 'tenant verification claim',
  },
  {
    fragment: 'It is not a background check',
    reason: 'The same limit, stated on the service page rather than in the field note.',
    criterion: 'tenant verification claim',
  },
  {
    // The 30-day question and its answer, which both refuse the promise.
    fragment: 'Can a broker guarantee that my property will sell in 30 days?',
    reason:
      'The reader\u2019s own question, quoted as the heading of the answer that refuses it. Removing the ' +
      'question would leave an answer to nothing.',
    criterion: '12.7 promissory word near a duration',
  },
  {
    fragment:
      'A broker cannot guarantee that your property will sell within 30 days, and we do not make that promise.',
    reason: 'The refusal itself, in the two forms the scan looks for: cannot guarantee, and do not promise.',
    criterion: '12.7 promissory word near a duration',
  },
  {
    fragment: 'What we will not do is promise the property will sell within 30 days.',
    reason: 'States the promise as the thing that will not be made.',
    criterion: '12.7 promissory word near a duration',
  },
  {
    // /about and a guide, both listing what is NOT shown.
    fragment: 'no &ldquo;buyers waiting&rdquo; counters',
    reason: 'Discloses that no waiting-buyer count is published, quoting the phrase it refuses to show.',
    criterion: '12.6 fabricated counts',
  },
  {
    fragment: 'a number of buyers waiting. Anyone who does is guessing.',
    reason: 'Names the fabricated count in order to say that anybody publishing one is guessing.',
    criterion: '12.6 fabricated counts',
  },
  {
    // A guide, warning the reader off the valuation tools other sites offer.
    fragment: 'It is not a valuation, and this website does not produce one.',
    reason:
      'The sentence that refuses the valuation, immediately before the one warning that an automated number ' +
      'elsewhere claiming to value your property is a guess. The warning attributes the offer to other sites ' +
      'and denies it here; removing it would take away the warning, not the offer.',
    criterion: '12.5 offer to produce a property value or price estimate',
  },
];

// ---------------------------------------------------------------------------
// The scanner
// ---------------------------------------------------------------------------

export interface Hit {
  path: string;
  match: string;
  line: string;
}

/**
 * What a scan reads.
 *
 * `'source'` is the file without comments, line by line, which is right for rules
 * about code as well as wording (tel: links, storage APIs, absolute URLs).
 * `'copy'` is only the text a reader sees, which is right for rules about wording
 * alone — the Indian English list, say. `'raw'` is the file exactly as written,
 * comments included, which one rule needs: Requirement 5.10 covers text addressed
 * to an AI system "in visible text, in hidden text, in an attribute value or in a
 * code comment", and a comment is the likeliest place somebody would put it.
 */
export type ScanView = 'source' | 'copy' | 'raw';

/** A file as the scan sees it: raw, comment-stripped, and masked to visible copy. */
export interface ScannedSource {
  /** Repository-relative path, for an assertion message. */
  readonly path: string;
  readonly raw: string;
  /** `raw` with comments removed. */
  readonly text: string;
  /** The visible copy only, line-aligned to `raw`. See tests/helpers/public-copy.ts. */
  readonly copy: string;
}

/** A source as the scan sees it, from text held in memory. */
export function scanSource(path: string, raw: string, fileName = path): ScannedSource {
  return { path, raw, text: stripComments(raw), copy: maskToCopy(raw, fileName) };
}

/** Every public-surface file, read and masked once. */
export function readScannedSources(files: readonly string[]): ScannedSource[] {
  return files.map((file) => scanSource(relative(ROOT, file), readFileSync(file, 'utf8'), file));
}

export function collapse(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/**
 * Let a literal space in a pattern match any run of whitespace, outside character
 * classes. Copy is scanned as a whole file rather than line by line, so a
 * two-word term that formatted JSX breaks across lines — or that an inline element
 * separates, which the copy mask turns into spaces — is still one match.
 *
 * A space that carries a quantifier is translated with it, rather than before it.
 * `chat ?gpt` — the pattern that catches both spellings of a product name — became
 * `chat\s+?gpt` under the earlier rewrite, which is a *lazy one or more*: the space
 * the author made optional had become compulsory, and `ChatGPT` written as one word
 * passed the copy scan. Property 11 found it with the Requirement 7.5 group. So ` ?`
 * and ` *` become `\s*`, ` +` becomes `\s+`, and a space before `{n,m}` becomes a
 * single `\s` with the count left to apply to it. Each translation widens what
 * matches, never narrows it.
 */
export function spaceAcrossLines(source: string): string {
  let out = '';
  let inClass = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (char === '\\') {
      out += char + (source[index + 1] ?? '');
      index += 1;
      continue;
    }
    if (char === '[') inClass = true;
    if (char === ']') inClass = false;
    if (char !== ' ' || inClass) {
      out += char;
      continue;
    }
    const next = source[index + 1];
    if (next === '?' || next === '*') {
      out += '\\s*';
      index += 1;
    } else if (next === '+') {
      out += '\\s+';
      index += 1;
    } else if (next === '{') {
      out += '\\s';
    } else {
      out += '\\s+';
    }
  }
  return out;
}

/**
 * True when the match on line `index` sits inside an approved denial.
 *
 * A banned phrase may straddle a line break in formatted JSX, so the check looks at
 * a small window around the match rather than at the line alone. The comparison is
 * whitespace-collapsed and otherwise exact, including case: a fragment that merely
 * resembles a denial-listed one is not exempt.
 */
export function isDenied(
  lines: readonly string[],
  index: number,
  denials: readonly ApprovedDenial[] = APPROVED_DENIALS
): boolean {
  const window = collapse(lines.slice(Math.max(0, index - 2), index + 3).join(' '));
  return denials.some((approved) => window.includes(collapse(approved.fragment)));
}

/** Every match of `pattern` in `sources`, less approved denials. */
export function findMatchesIn(
  sources: readonly ScannedSource[],
  pattern: RegExp,
  view: ScanView = 'source',
  denials: readonly ApprovedDenial[] = APPROVED_DENIALS
): Hit[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const hits: Hit[] = [];
  for (const source of sources) {
    if (view === 'copy') {
      const lines = source.raw.split('\n');
      const regex = new RegExp(spaceAcrossLines(pattern.source), flags);
      for (const match of source.copy.matchAll(regex)) {
        const index = source.copy.slice(0, match.index).split('\n').length - 1;
        if (isDenied(lines, index, denials)) continue;
        hits.push({ path: source.path, match: collapse(match[0]), line: lines[index]!.trim() });
      }
      continue;
    }
    const lines = (view === 'raw' ? source.raw : source.text).split('\n');
    const regex = new RegExp(pattern.source, flags);
    for (const [index, line] of lines.entries()) {
      regex.lastIndex = 0;
      for (const match of line.matchAll(regex)) {
        if (isDenied(lines, index, denials)) continue;
        hits.push({ path: source.path, match: match[0], line: line.trim() });
      }
    }
  }
  return hits;
}

/** `path: "match" — line` for each hit, which is what an assertion should print. */
export function describeHits(hits: readonly Hit[]): string[] {
  return hits.map((hit) => `${hit.path}: "${hit.match}" — ${hit.line}`);
}

// ---------------------------------------------------------------------------
// The pattern catalogue
// ---------------------------------------------------------------------------

/**
 * What a group of patterns is read against.
 *
 * Most groups are read against the public surface. Two are narrower on purpose:
 * Requirement 2.8's boundary terms are read against the browsing labels alone — the
 * `marketingGroup` headings and the note beside them — because a locality page
 * renders an administrative value next to its boundary version, correctly, under
 * Requirement 1.7. Requirement 10.10's offer terms are read against registered
 * photograph captions, because a caption is limited to the area name and the date
 * taken while the surrounding page may discuss what a rent depends on.
 */
export type BannedPatternScope = 'public-surface' | 'browsing-label' | 'photograph-caption';

export interface BannedPatternGroup {
  /** Stable identifier, used by the policy suite and by Property 11. */
  readonly id: string;
  /** The acceptance criterion the group enforces. */
  readonly criterion: string;
  /** The view the policy suite reads the group against. */
  readonly view: ScanView;
  readonly scope: BannedPatternScope;
  readonly patterns: readonly RegExp[];
}

/**
 * Every banned pattern the Content_Policy_Test_Suite holds, in one place.
 *
 * The patterns were inline in the suite until task 14.7. They are here because
 * Property 11 is a statement about *all* of them — "a banned pattern anywhere on the
 * public surface is detected and reported" — and a property that drove a copy of the
 * list would prove nothing about the list the build actually enforces. Adding a
 * pattern here puts it under both the suite's assertions and the property's.
 *
 * The Indian English terms are not restated: they are `PROSCRIBED_TERMS` in
 * `src/config/indian-english-terms.ts`, which is the register both the suite and the
 * property read.
 */
export const BANNED_PATTERN_GROUPS: readonly BannedPatternGroup[] = [
  {
    id: 'non-canonical-brand-lockup',
    criterion: '12.9 a rendering of the brand other than INSTLE REAL ESTATE',
    view: 'source',
    scope: 'public-surface',
    patterns: [/Instle Real Estate/],
  },
  {
    id: 'non-canonical-telephone',
    criterion: '12.9 a tel: value other than tel:9353096264, or the digits with a prefix or separator',
    view: 'source',
    scope: 'public-surface',
    patterns: [/tel:(?!9353096264)[+\d\s()-]+/, /\+91[\s-]?9353096264/, /93530[\s-]96264/],
  },
  {
    id: 'whatsapp-reference',
    criterion: '12.9 a WhatsApp or wa.me reference',
    view: 'source',
    scope: 'public-surface',
    patterns: [/whatsapp/i, /wa\.me/i],
  },
  {
    id: 'fabricated-count',
    criterion: '12.6 a numeral paired with customers, clients, reviews or transactions, or a years-in-business figure',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\d[\d,]*\s*\+?\s*(customers|clients|reviews|families|transactions|properties sold)/i,
      /\b\d+\s*(years|yrs)\s+(of\s+)?experience/i,
    ],
  },
  {
    /**
     * Requirement 3.11 and Requirement 12.6's superlative clause.
     *
     * The superlative broker phrases are recorded in the Search_Intent_Register as
     * research queries — they are what people type, and knowing that is useful. What
     * they may never be is a self-description, because the claim is unverifiable by
     * anyone including us, and Google's spam policies treat it as one of the markers
     * of a doorway site.
     */
    id: 'superlative-self-description',
    criterion: '12.6 and 3.11 superlative self-description',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\bno\.?\s*1\b/i,
      /\bnumber one\b/i,
      /\bbest (real estate )?(broker|brokerage|agent)\b/i,
      /\bmost trusted\b/i,
      /\btrusted by (thousands|hundreds|\d)/i,
      /\bindia'?s (best|leading|top)\b/i,
      /\bbengaluru'?s (best|leading|top|number)\b/i,
      /\baward[- ]winning\b/i,
      // Added with Requirement 3.11: the same claim in its other usual wordings.
      /\b(?:top|leading|premier|finest|foremost|unmatched|unrivalled|unrivaled)\s+(?:real estate\s+)?(?:broker|brokerage|agency|agent|advisor|consultant)s?\b/i,
      /\bmost (?:reliable|reputed|experienced|recommended|preferred)\b/i,
      /\b(?:city|bangalore|bengaluru|karnataka|india)'?s\s+(?:most|finest|premier)\b/i,
      /\b(?:we are|are) the best\b/i,
      /\bwinner of\b/i,
      /\branked (?:among|amongst|in) the (?:top|best)\b/i,
    ],
  },
  {
    id: 'unverified-registration',
    criterion: '12.7 a registration, certification or legal guarantee',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\bRERA\s*(registered|registration|approved)/i,
      /\bclear[- ]title\b/i,
      /\b100%\s*legal\b/i,
      /\blegally guaranteed\b/i,
      /\bcertified (broker|agent|advisor)\b/i,
      /\blicensed (broker|agent)\b/i,
    ],
  },
  {
    id: 'timed-outcome-promise',
    criterion: '12.7 a promissory word in the same sentence as an outcome or a duration',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      // Promissory phrasing, rather than any mention of a timeframe. A heading
      // such as "If you need to sell within 30 days" is honest framing of the
      // customer's situation; "we guarantee a sale in 30 days" is not.
      /\b(guarantee|guarantees|guaranteed|promise|promises|promised|assured|assure)\b[^.!?]{0,60}\b\d+\s*days\b/i,
      /\b\d+\s*days\b[^.!?]{0,60}\b(guaranteed|assured|promised)\b/i,
      /\bguarantee[ds]?\s+(a\s+)?(sale|sold|tenant|buyer)\b/i,
      /\bsold in \d+ days\b/i,
      /\bguaranteed (returns|appreciation|yield|rental)/i,
      /\bassured (returns|rent|sale)/i,
    ],
  },
  {
    // "We never sell your contact details" and "No spam calls" were both present
    // before this work. The replacement wording states what we do, not what can
    // never happen.
    id: 'absolute-operational-promise',
    criterion: '12.7 an absolute promise about operations',
    view: 'source',
    scope: 'public-surface',
    patterns: [/\bnever sell your\b/i, /\bno spam calls?\b/i, /\bzero spam\b/i],
  },
  {
    id: 'tenant-verification-claim',
    criterion: 'tenant verification claim',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\bverified tenants?\b/i,
      /\btenant verification\b/i,
      /\bbackground[- ]check(ed)?\b/i,
      /\bpolice verification\b/i,
    ],
  },
  {
    id: 'demographic-filter',
    criterion: 'demographic or community filter language',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\brespectable families\b/i,
      /\bcorporate executives\b/i,
      /\bbachelors? not allowed\b/i,
      /\bvegetarians? only\b/i,
      /\bfamilies only\b/i,
    ],
  },
  {
    id: 'property-inventory',
    criterion: '12.5 a price, an availability statement or a listing count',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\b\d+\s*(properties|flats|homes|listings)\s+(available|for sale|in stock)\b/i,
      /\bavailable now\b/i,
      /\bready to move\b/i,
      /\bbuyers waiting\b/i,
      /\bhot deal/i,
      /\blimited (time|offer|units)\b/i,
    ],
  },
  {
    id: 'automated-valuation',
    criterion: '12.5 an automated valuation',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\binstant (property )?valuation\b/i,
      /\binstant market value\b/i,
      /\bfree valuation\b/i,
      /\bproperty value calculator\b/i,
    ],
  },
  {
    // Requirement 12.5's last clause. An estimate produced from visitor input is a
    // valuation however it is worded, and no valuation method has been recorded, so
    // the number would be invented. The patterns are the offer, not the noun: a
    // guide may discuss what a price depends on. The policy suite reads this group
    // in both views, because the offer can be worded in copy or wired in code.
    id: 'value-estimate-offer',
    criterion: '12.5 an offer to produce a property value or price estimate from visitor input',
    view: 'copy',
    scope: 'public-surface',
    patterns: [
      /\b(get|know|find out|discover|check|see)\b[^.!?]{0,30}\b(your|my)\b[^.!?]{0,20}\bproperty(?:'s|’s)?\s*(value|worth|price)\b/i,
      /\bwhat(?:'s| is)\s+(your|my)\s+(property|flat|home|house|plot|villa)\s+worth\b/i,
      /\b(estimate|calculate|value|appraise)\b[^.!?]{0,20}\byour\s+(property|flat|home|house|plot|villa)\b/i,
      /\b(price|value|valuation|rent)\s+(estimator|calculator|estimate tool)\b/i,
      /\benter\b[^.!?]{0,40}\bto (get|see|receive)\b[^.!?]{0,20}\b(estimate|valuation|price)\b/i,
    ],
  },
  {
    id: 'office-address',
    criterion: '12.5 a street-level address, and an unapproved office claim',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\b\d{1,4}[a-z]?\s+(main|cross)\s+road\b.*\bbengaluru\b/i,
      /\bregistered office\b/i,
      /\bour office at\b/i,
      /\bvisit us at\b/i,
    ],
  },
  {
    id: 'business-hours',
    criterion: 'unapproved business facts: opening hours',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\bmon(day)?\s*[-–to]+\s*sat(urday)?\b/i,
      /\b(9|10)\s*(am|AM)\s*[-–to]+\s*\d{1,2}\s*(pm|PM)\b/,
      /\bopen(ing)? hours\b/i,
      /\b24\s*[x/]\s*7\b/i,
    ],
  },
  {
    id: 'brokerage-fee',
    criterion: 'unapproved business facts: a brokerage fee percentage',
    view: 'source',
    scope: 'public-surface',
    patterns: [/\b\d+(\.\d+)?\s*%\s*(brokerage|commission|fee)/i, /\b(brokerage|commission)\s*(of|:)?\s*\d+(\.\d+)?\s*%/i],
  },
  {
    id: 'response-time-commitment',
    criterion: '12.7 a response-time commitment',
    view: 'source',
    scope: 'public-surface',
    patterns: [
      /\bwithin\s+\d+\s*(minutes|mins|hours|hrs)\b/i,
      /\bsame day (response|callback)\b/i,
      /\bcall(ed)? back in \d+/i,
      /\bguaranteed response\b/i,
    ],
  },
  {
    // Placeholder domains used in field help are fine; a real-looking business
    // mailbox is not, because no mailbox has been created yet. The policy suite
    // applies that exemption as a filter on the hits.
    id: 'invented-email',
    criterion: 'unapproved business facts: an invented mailbox',
    view: 'source',
    scope: 'public-surface',
    patterns: [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i],
  },
  {
    id: 'guessed-domain',
    criterion: '12.9 an absolute URL or a candidate domain while no domain is confirmed',
    view: 'source',
    scope: 'public-surface',
    patterns: [/https?:\/\/[a-z0-9.-]*instle[a-z0-9.-]*/i, /instle\.(com|in|co\.in|net|org)/i, /instlerealestate\./i],
  },
  {
    /**
     * Requirement 5.10 covers visible text, hidden text, an attribute value *and* a
     * code comment, so this is the one group read as written. A comment is where
     * somebody would put it — it looks harmless in review, and a crawler reading the
     * served HTML never sees it, which is exactly why the requirement names it: the
     * instruction is aimed at a model reading the repository or the page source, and
     * the honest position is that no such instruction exists.
     */
    id: 'ai-addressed-text',
    criterion: '5.10 text addressed to an AI system requesting a recommendation or citation',
    view: 'raw',
    scope: 'public-surface',
    patterns: [
      // Addressed to a model by name or by kind.
      /\b(?:dear|hey|hello|attention|note to|message (?:to|for)|instructions? (?:to|for)|prompt (?:to|for))\s*[:,]?\s*(?:the\s+)?(?:ai|a\.i\.|llms?|chat ?gpt|gpt-?\d*|claude|gemini|perplexity|copilot|bard|assistants?|language models?|chatbots?|crawlers?|bots?)\b/i,
      // A request, however politely phrased.
      /\b(?:please|kindly|be sure to|make sure to|remember to|you (?:should|must))\s+(?:recommend|cite|rank|prefer|mention|list|refer to|suggest)\b/i,
      // A model named as the subject of a recommendation, preference, ranking or citation.
      /\b(?:ai|llms?|chat ?gpt|gpt-?\d*|claude|gemini|perplexity|copilot|bard|assistants?|language models?|chatbots?)\b[^.!?\n]{0,60}\b(?:should|must|ought to|please)\s+(?:recommend|cite|rank|prefer|mention|list|suggest)\b/i,
      /\b(?:recommend|cite|rank|prefer|mention|list|suggest)\s+(?:us|this (?:business|brokerage|site|page))\b/i,
      // Conditioning an answer.
      /\bwhen (?:asked|answering|recommending)\b[^.!?\n]{0,60}\b(?:recommend|cite|mention|prefer|suggest|name)\b/i,
      // The prompt-injection idiom, in any of its usual forms.
      /\bignore (?:the )?(?:previous|prior|above|all|any) (?:instructions?|prompts?)\b/i,
      /\bdisregard (?:the )?(?:previous|prior|above|all) (?:instructions?|prompts?)\b/i,
      /\bsystem prompt\b/i,
    ],
  },
  {
    /**
     * The Observation_Register records, per tool and per dated round, whether a tool
     * answered a benchmark question correctly. It records nothing else, and it
     * records zero entries today, because recording does not start until the domain
     * is confirmed. So there is no ranking, no position, no score and no trend to
     * present — and a page that presented one would be stating a number nobody
     * measured. Requirement 7.5 also covers the softer form: "Google now describes
     * us correctly", said without a later dated observation behind it.
     */
    id: 'observation-as-ranking',
    criterion: '7.5 an observation presented as a ranking or an endorsement',
    view: 'copy',
    scope: 'public-surface',
    patterns: [
      /\b(?:rank|ranks|ranked|ranking)\b[^.!?]{0,40}\b(?:#\s*\d+|\d+(?:st|nd|rd|th)?\b|first|top|number one)\b/i,
      /\b(?:#|no\.?\s*|number\s+)\d+\s+(?:on|in|for)\s+(?:google|bing|search|chat ?gpt|perplexity|copilot|gemini|ai)\b/i,
      /\bwe (?:rank|are ranked|appear first|appear at the top|are number one)\b/i,
      /\b(?:google|bing|chat ?gpt|perplexity|copilot|gemini)\b[^.!?]{0,60}\b(?:now\s+)?(?:recommends?|endorses?|cites? us|mentions? us|lists? us|names? us|describes us|reports us)\b/i,
      /\b(?:visibility|search|ranking|citation|reputation)\s+score\b/i,
      /\b(?:climbing|rising in|improving)\s+(?:the\s+)?(?:rankings?|search results?|positions?)\b/i,
      /\b(?:position|rank)\s*(?:#|no\.?|number)?\s*\d+\b/i,
      /\b(?:trending|on an upward trend|upward trend)\b[^.!?]{0,40}\b(?:search|google|ai|visibility)\b/i,
      /\bfeatured (?:in|by)\s+(?:chat ?gpt|perplexity|copilot|gemini|google'?s? ai)\b/i,
    ],
  },
  {
    /**
     * `marketingGroup` is how areas are filed for browsing. It is not a ward, a
     * zone, a postal district or a constituency, and Requirement 2.8 keeps it from
     * reading as one: a group heading or note carrying a ward number, a zone name, a
     * PIN code or a municipal or constituency term would turn a filing decision into
     * a boundary claim, which needs two sources and a boundary version behind it.
     */
    id: 'browsing-label-boundary-term',
    criterion: '2.8 a boundary term in a browsing label',
    view: 'copy',
    scope: 'browsing-label',
    patterns: [
      /\bward\b/i,
      /\bzone\b/i,
      /\bzonal\b/i,
      /\bbbmp\b/i,
      /\bbda\b/i,
      /\bbmrda\b/i,
      /\bmunicipal(?:ity)?\b/i,
      /\bcorporation\b/i,
      /\bconstituency\b/i,
      /\bassembly segment\b/i,
      /\btaluk\b/i,
      /\bhobli\b/i,
      /\bpanchayat\b/i,
      /\bpin ?code\b/i,
      /\bpostal\b/i,
      /\bpostcode\b/i,
      /\b\d{6}\b/,
    ],
  },
  {
    /**
     * Requirement 10.6 limits a photograph caption to the area name and the date
     * taken; 10.10 fails the build when one carries a term indicating availability,
     * an asking price, a rent amount, a sale, a booking or a property being offered.
     * A caption is the shortest path from a photograph of a street to an
     * advertisement for a flat on it.
     */
    id: 'photograph-caption-offer',
    criterion: '10.10 an availability, price or offer term in a photograph caption',
    view: 'copy',
    scope: 'photograph-caption',
    patterns: [
      /\bavailable\b/i,
      /\bavailability\b/i,
      /\bfor sale\b/i,
      /\bfor rent\b/i,
      /\bto let\b/i,
      /\bsold\b/i,
      /\bsale\b/i,
      /\brent(?:al|ed)?\b/i,
      /\blease[ds]?\b/i,
      /\bbook(?:ing|ed|able)?\b/i,
      /\breserved?\b/i,
      /\basking (?:price|rent)\b/i,
      /\bprice\b/i,
      /\b(?:rs\.?|inr|₹)\s*[\d,]+/i,
      /\b[\d.,]+\s*(?:lakh|lakhs|crore|crores)\b/i,
      /\bready to move\b/i,
      /\bnew(?:ly)? launch(?:ed)?\b/i,
      /\bon offer\b/i,
      /\boffered?\b/i,
      /\bmove[- ]in\b/i,
      /\bpossession\b/i,
    ],
  },
];

/** The group with this identifier. Throws rather than silently scanning nothing. */
export function bannedPatternGroup(id: string): BannedPatternGroup {
  const group = BANNED_PATTERN_GROUPS.find((candidate) => candidate.id === id);
  if (!group) throw new Error(`no banned-pattern group "${id}" in BANNED_PATTERN_GROUPS`);
  return group;
}

/** The patterns of the group with this identifier. */
export function bannedPatternsFor(id: string): readonly RegExp[] {
  return bannedPatternGroup(id).patterns;
}
