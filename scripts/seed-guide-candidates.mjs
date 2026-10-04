/**
 * Seed the Route_Manifest guide candidates into typed records.
 *
 * Reads the `guide`-family rows of `docs/seo-launch-handoff/ROUTE-MANIFEST.csv`
 * and emits typed `GuideRecord` literals into `src/config/guide-registry/`, split
 * by customer intent so no generated file is too large to review.
 *
 * Requirement 4.1 — every one of the 36 manifest candidates is accounted for by
 * exactly one typed record with a slug unique across the registry, exactly one
 * customer intent and one customer question of at most 160 characters.
 * Requirement 4.2 and 4.6 — a seeded record is `unpublished` with an empty
 * `directAnswer`, no `sections` and `contentUpdatedAt: null`, so it is held out of
 * every public surface from the moment it exists.
 * Requirement 4.9 — seven manifest slugs differ from a sibling only by an intent
 * word or a property-type word. Each is renamed at seeding, and the distinctness
 * check runs over the seeded slugs so the pattern cannot come back.
 * Requirement 3.5 — a candidate whose question is already served by a record in
 * the registry does not get a second URL. It is recorded against the route that
 * already serves it.
 *
 * Usage:
 *   node scripts/seed-guide-candidates.mjs            # write the files
 *   node scripts/seed-guide-candidates.mjs --check    # fail on any drift
 *
 * The pure functions are exported so `tests/guide-seeding.test.ts` can drive them
 * and so the property suite can run the distinctness rule over generated slug
 * lists rather than only over the one manifest that happens to be committed.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// One CSV reader, not two. `parseCsv` is a pure function and the module it lives
// in only runs `main()` when it is the process entry point, so importing it here
// is free of side effects.
import { parseCsv } from './seed-locality-candidates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

export const MANIFEST_PATH = join(ROOT, 'docs', 'seo-launch-handoff', 'ROUTE-MANIFEST.csv');
export const GUIDE_REGISTRY_DIR = join(ROOT, 'src', 'config', 'guide-registry');
export const CLASSIFICATION_PATH = join(ROOT, 'src', 'config', 'guide-classification.ts');

/** The date this seeding run was recorded. Matches the other registers. */
export const RECORDED_ON = '2026-09-29';

/** The manifest prefix every guide route carries. */
export const GUIDE_ROUTE_PREFIX = '/guides/';

/** The brand suffix the manifest appends to every proposed title. */
export const TITLE_BRAND_SUFFIX = ' — INSTLE REAL ESTATE';

// ---------------------------------------------------------------------------
// Reading the manifest
// ---------------------------------------------------------------------------

/**
 * @typedef {object} GuideCandidate
 * @property {string} routeId
 * @property {string} path
 * @property {string} primaryUserIntent
 * @property {string} proposedTitle
 * @property {string} priority
 * @property {string} publicationGate
 */

/**
 * @param {Record<string, string>} row
 * @returns {GuideCandidate}
 */
export function candidateFromRow(row) {
  return {
    routeId: row.route_id ?? '',
    path: row.path ?? '',
    primaryUserIntent: row.primary_user_intent ?? '',
    proposedTitle: row.proposed_title ?? '',
    priority: row.priority ?? '',
    publicationGate: row.publication_gate ?? '',
  };
}

/**
 * The `guide`-family rows, in manifest order. The `guide-hub` row is a different
 * family and is not a guide record.
 *
 * @param {string} text
 * @returns {GuideCandidate[]}
 */
export function candidatesFromManifest(text) {
  return parseCsv(text)
    .filter((row) => row.family === 'guide')
    .map(candidateFromRow);
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

/**
 * `primary_user_intent` to `CustomerIntent`.
 *
 * Requirement 4.1 permits exactly one customer intent per record. A manifest value
 * naming two audiences — "Buyer and seller", "Tenant and landlord" — is therefore
 * not a customer intent, and is not laundered into one. It maps to `general` and
 * the original value is preserved in a blocking note, the same treatment the
 * locality seeding gives an unsettled entity type.
 */
export const INTENT_MAP = /** @type {const} */ ({
  Buyer: { intent: 'buy', single: true },
  Seller: { intent: 'sell', single: true },
  Tenant: { intent: 'rent', single: true },
  Landlord: { intent: 'rent-out', single: true },
  Commercial: { intent: 'commercial', single: true },
  'All intents': { intent: 'general', single: true },
  'Buyer and seller': { intent: 'general', single: false },
  'Buyer and tenant': { intent: 'general', single: false },
  'Tenant and landlord': { intent: 'general', single: false },
  'Seller and landlord': { intent: 'general', single: false },
  'Existing real customers': { intent: 'general', single: false },
});

/**
 * @param {string} value
 * @returns {{ intent: string, single: boolean }}
 */
export function mapCustomerIntent(value) {
  const mapped = INTENT_MAP[/** @type {keyof typeof INTENT_MAP} */ (value)];
  if (mapped) return { intent: mapped.intent, single: mapped.single };
  // An unrecognised audience is not guessed at. `general` claims the least, and
  // the unrecognised value is recorded as unmapped in a blocking note.
  return { intent: 'general', single: false };
}

/** The intents the registry files are split across, in a fixed order. */
export const INTENT_FILE_ORDER = /** @type {const} */ ([
  'buy',
  'sell',
  'rent',
  'rent-out',
  'commercial',
  'general',
]);

/**
 * The manifest's `proposed_title` with the brand suffix removed.
 *
 * The suffix belongs in page metadata, not in an H1, and leaving it on would put a
 * second brand lockup inside the title string.
 *
 * @param {string} proposedTitle
 * @returns {string}
 */
export function workingTitle(proposedTitle) {
  return proposedTitle.endsWith(TITLE_BRAND_SUFFIX)
    ? proposedTitle.slice(0, -TITLE_BRAND_SUFFIX.length).trim()
    : proposedTitle.trim();
}

/**
 * The working customer question.
 *
 * Requirement 4.1 needs one question of at most 160 characters on every record.
 * No question has been researched — the Search_Intent_Register is empty because no
 * keyword research tool has been supplied (Requirement 3.7) — so the question is
 * derived from the manifest's own proposed title by one documented transform and
 * nothing else: the title, with a question mark. Some read awkwardly. That is the
 * honest signal that they are working placeholders taken from a route plan rather
 * than questions somebody heard a customer ask, and every record says so in a
 * blocking note. Writing 29 plausible-sounding questions would read like research.
 *
 * @param {string} title
 * @returns {string}
 */
export function workingQuestion(title) {
  const trimmed = title.trim().replace(/[?.]+$/, '');
  return `${trimmed}?`;
}

/**
 * The honest candidate description. Never rendered, because the record cannot pass
 * the gate, and never a summary of content that does not exist.
 */
export const CANDIDATE_DESCRIPTION =
  'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.';

// ---------------------------------------------------------------------------
// The seven renames
// ---------------------------------------------------------------------------

/**
 * Requirement 4.9. Seven manifest slugs differ from a sibling only by an intent
 * word or a property-type word — `sell-flat-bengaluru` against
 * `buy-flat-bengaluru`, `buy-villa-checklist` against `buy-site-plot-checklist`.
 * That is the doorway pattern, and a slug that names the *question* rather than the
 * *permutation* is what makes the page distinct.
 *
 * Each entry records the sibling it collided with, so the rename is reviewable
 * rather than asserted. `detectedByFunction` records whether
 * `slugsDifferOnlyByPermutationToken` independently flags the pair: six of the
 * seven it does. The rent pair it does not, because the two slugs differ by `home`
 * and by `out`+`flat`, and `home` is not in the design's `TYPE_TOKENS`. The rename
 * stands on the recorded editorial judgement in that one case, and the gap is
 * asserted in `tests/guide-seeding.test.ts` rather than papered over by widening a
 * token list this task is not the place to change.
 */
export const GUIDE_SLUG_RENAMES = /** @type {const} */ ([
  {
    manifestSlug: 'sell-flat-bengaluru',
    seededSlug: 'what-happens-when-you-list-a-flat-for-sale',
    collidesWith: 'buy-flat-bengaluru',
    permutationKind: 'intent word',
    detectedByFunction: true,
  },
  {
    manifestSlug: 'buy-flat-bengaluru',
    seededSlug: 'what-to-check-before-you-agree-to-buy-a-flat',
    collidesWith: 'sell-flat-bengaluru',
    permutationKind: 'intent word',
    detectedByFunction: true,
  },
  {
    manifestSlug: 'rent-home-bengaluru',
    seededSlug: 'how-a-rental-search-actually-proceeds',
    collidesWith: 'rent-out-flat-bengaluru',
    permutationKind: 'intent word',
    detectedByFunction: false,
  },
  {
    manifestSlug: 'rent-out-flat-bengaluru',
    seededSlug: 'what-a-landlord-decides-before-listing',
    collidesWith: 'rent-home-bengaluru',
    permutationKind: 'intent word',
    detectedByFunction: false,
  },
  {
    manifestSlug: 'buy-villa-checklist',
    seededSlug: 'questions-a-villa-purchase-raises',
    collidesWith: 'buy-site-plot-checklist',
    permutationKind: 'property-type word',
    detectedByFunction: true,
  },
  {
    manifestSlug: 'buy-site-plot-checklist',
    seededSlug: 'questions-a-site-purchase-raises',
    collidesWith: 'buy-villa-checklist',
    permutationKind: 'property-type word',
    detectedByFunction: true,
  },
  {
    manifestSlug: 'independent-house-checklist',
    seededSlug: 'questions-an-independent-house-purchase-raises',
    collidesWith: 'buy-villa-checklist',
    permutationKind: 'property-type word',
    detectedByFunction: true,
  },
]);

const RENAME_BY_MANIFEST_SLUG = new Map(
  GUIDE_SLUG_RENAMES.map((rename) => [rename.manifestSlug, rename])
);

/**
 * @param {string} path
 * @returns {string}
 */
export function manifestSlug(path) {
  return path.startsWith(GUIDE_ROUTE_PREFIX) ? path.slice(GUIDE_ROUTE_PREFIX.length) : path;
}

/**
 * The slug a candidate is seeded under. Requirement 4.9.
 *
 * @param {string} path
 * @returns {{ slug: string, renamedFrom: string | null }}
 */
export function seededSlug(path) {
  const original = manifestSlug(path);
  const rename = RENAME_BY_MANIFEST_SLUG.get(original);
  return rename
    ? { slug: rename.seededSlug, renamedFrom: original }
    : { slug: original, renamedFrom: null };
}

// ---------------------------------------------------------------------------
// The PIN-code route ruling
// ---------------------------------------------------------------------------

/**
 * Requirement 12.3's list, verbatim: a route path segment *matching* `pin`,
 * `pin-code`, `pincode`, `pincodes`, `postcode` or `postal-code`.
 */
export const FORBIDDEN_ROUTE_SEGMENTS = /** @type {const} */ ([
  'pin',
  'pin-code',
  'pincode',
  'pincodes',
  'postcode',
  'postal-code',
]);

/**
 * Forms the requirement's list omits and the rule plainly means.
 *
 * The design names `/pin-codes` as a route this rule forbids, and `pin-codes` — the
 * hyphenated plural — is not one of 12.3's six terms. Rather than read the omission
 * as permission, it is recorded here as an addition. This only ever adds a failure
 * condition: every segment 12.3 lists is still forbidden, and one more is too.
 */
export const ADDITIONAL_FORBIDDEN_SEGMENTS = /** @type {const} */ ([
  'pin-codes',
  'postcodes',
  'postal-codes',
]);

/**
 * The recorded reading of "matching" in Requirement 12.3: **whole-segment
 * equality**, not substring containment.
 *
 * `/pin-codes` and `/areas/560001` are forbidden because their whole segment is a
 * forbidden term or a six-digit literal. `/guides/pin-code-locality-difference` is
 * permitted because its segment is a question about the difference between a PIN
 * code and a locality, which is exactly the kind of page that stops a reader being
 * misled — the opposite of a postcode doorway.
 *
 * The second half of 12.3 still binds, and binds harder: the guide may explain the
 * concept but may not present any six-digit numeral as a PIN code. Not a real one,
 * not an illustrative one, not a fictional one. There is no honest way to show an
 * example, because a reader cannot tell an illustration from a fact, so the record
 * carries a blocking note saying so and the seeded text contains no six-digit
 * numeral at all.
 */
export const PIN_CODE_WHOLE_SEGMENT_RULING = {
  ruling: 'whole-segment equality',
  permittedSlug: 'pin-code-locality-difference',
  forbiddenExamples: ['/pin-codes', '/areas/560001', '/pincode/560038'],
  reasoning:
    'Requirement 12.3 forbids a route segment matching a postcode term. Read as whole-segment equality, a guide slug that contains the words while naming a different subject is permitted; a route whose segment IS the term, or IS a six-digit literal, is not. The ban on presenting a six-digit numeral as a PIN code is unaffected and applies to the guide body.',
  recordedOn: RECORDED_ON,
};

/**
 * True when a route path carries a forbidden whole segment or a six-digit literal
 * segment. Requirement 12.3 under the ruling above.
 *
 * @param {string} path
 * @returns {boolean}
 */
export function pathCarriesForbiddenSegment(path) {
  const banned = new Set([...FORBIDDEN_ROUTE_SEGMENTS, ...ADDITIONAL_FORBIDDEN_SEGMENTS]);
  return path
    .split('/')
    .filter((segment) => segment.length > 0)
    .some((segment) => banned.has(segment.toLowerCase()) || /^\d{6}$/.test(segment));
}

// ---------------------------------------------------------------------------
// Candidates already served by an existing record
// ---------------------------------------------------------------------------

/**
 * Requirement 3.5 and Requirement 4.9. Seven manifest candidates ask a question a
 * record in the registry already answers. None of them gets a second URL: the
 * existing route stays the only destination for the question.
 *
 * This is the guide-side equivalent of the locality seeding's entity-boundary
 * hold-outs, and it is the reason 36 candidates produce 29 new records rather than
 * 36. Each existing record accounts for exactly one candidate, so both sums land on
 * 36: 29 seeded + 7 served elsewhere = 36 candidates, and 29 seeded + 7 existing =
 * 36 registry records.
 *
 * One entry needs reading carefully. `PAGE-058` is also one of the seven renames,
 * and the rename is what makes the duplication undeniable: once
 * `rent-out-flat-bengaluru` is renamed to the question it actually asks —
 * `what-a-landlord-decides-before-listing` — it is word for word the question
 * `decisions-to-make-before-you-rent-out-your-property` already answers, and that
 * page is published. Seeding it anyway would plant a one-question-two-pages
 * collision that Requirement 4.9 fails the build for the moment both publish. So
 * the rename is applied and recorded, and the renamed candidate is then served by
 * the existing route. Six of the seven renames produce a seeded record; this one
 * produces a recorded destination.
 */
export const ALREADY_SERVED_BY_EXISTING_RECORD = /** @type {const} */ ([
  {
    routeId: 'PAGE-046',
    manifestSlug: 'seller-readiness-checklist',
    servedByGuideId: 'GD-SELL-PREPARE',
    servedByRoute: '/guides/what-to-tell-us-when-you-want-to-sell-your-property',
    reason:
      'A seller readiness checklist is the question "what should I have ready when I approach a broker to sell my property?", which the published record answers in full — the five details asked for at the first conversation and the documents not asked for.',
  },
  {
    routeId: 'PAGE-047',
    manifestSlug: 'seller-timeline-planning',
    servedByGuideId: 'GD-SELL-30-DAYS',
    servedByRoute: '/guides/can-a-broker-guarantee-a-property-sale-in-30-days',
    reason:
      'Planning a sale timeline is the question the published record answers: what a timeline can and cannot be committed to, and what "within 30 days" usefully means as a goal rather than a delivery date.',
  },
  {
    routeId: 'PAGE-049',
    manifestSlug: 'brokerage-fees-questions',
    servedByGuideId: 'GD-GEN-BROKERAGE-FEES',
    servedByRoute: '/guides/how-brokerage-fees-work',
    reason:
      'Questions to ask about brokerage fees and how brokerage fees work are one question. The existing record holds it, unpublished, until the wording recorded as checklist C5 is supplied.',
  },
  {
    routeId: 'PAGE-058',
    manifestSlug: 'rent-out-flat-bengaluru',
    servedByGuideId: 'GD-RENTOUT-DECISIONS',
    servedByRoute: '/guides/decisions-to-make-before-you-rent-out-your-property',
    reason:
      'Renamed to what-a-landlord-decides-before-listing under Requirement 4.9, at which point it is the same question as the published "What should I decide before I rent out my flat or house?" — rent and deposit, furnishing, availability, and who handles the property. The rename is recorded; the second URL is not created.',
  },
  {
    routeId: 'PAGE-063',
    manifestSlug: 'property-document-questions',
    servedByGuideId: 'GD-BUY-DOCUMENTS',
    servedByRoute: '/guides/property-documents-to-check-before-buying-in-bengaluru',
    reason:
      'Questions to ask about property documents and which documents to check before buying are one question. The existing record holds it, unpublished, until checklist C3 names an author and a subject reviewer.',
  },
  {
    routeId: 'PAGE-067',
    manifestSlug: 'property-tax-questions',
    servedByGuideId: 'GD-SELL-TAXES',
    servedByRoute: '/guides/taxes-and-charges-when-selling-property-in-bengaluru',
    reason:
      'Both ask what a reader should raise about tax records and charges on a transaction. The existing record holds the question, unpublished, until checklist C3 names an author and a subject reviewer.',
  },
  {
    routeId: 'PAGE-073',
    manifestSlug: 'office-lease-questions',
    servedByGuideId: 'GD-COM-OFFICE',
    servedByRoute: '/guides/what-to-consider-when-leasing-office-space-in-bengaluru',
    reason:
      'Questions to ask about an office lease and what to consider when leasing office space are one question. The existing record holds it, unpublished, until checklist C4 confirms commercial capability.',
  },
]);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * `EXTERNAL_FACT_LEXICON`, read out of `src/config/guide-classification.ts` as
 * text.
 *
 * Reading the source rather than importing it keeps this script free of a
 * TypeScript loader, and reading it rather than restating it keeps the script and
 * the module from drifting: there is one lexicon, and the test asserts the
 * classification this script recorded matches what `classifyGuideContent` returns
 * on the committed records.
 *
 * @returns {RegExp[]}
 */
export function readExternalFactLexicon() {
  const text = readFileSync(CLASSIFICATION_PATH, 'utf8');
  const block = /EXTERNAL_FACT_LEXICON:[^=]*=\s*\[([\s\S]*?)\n\];/.exec(text);
  if (!block) {
    throw new Error(`Could not find EXTERNAL_FACT_LEXICON in ${CLASSIFICATION_PATH}`);
  }
  const patterns = [...block[1].matchAll(/^\s*\/(.+)\/([a-z]*),\s*$/gm)].map(
    (match) => new RegExp(match[1], match[2])
  );
  if (patterns.length === 0) {
    throw new Error(`EXTERNAL_FACT_LEXICON in ${CLASSIFICATION_PATH} parsed to zero patterns`);
  }
  return patterns;
}

/**
 * The text the classifier reads, mirroring `guideClassifiableText`: everything a
 * reader would see, and deliberately not `scopeNote` or `blockingNotes`.
 *
 * @param {Record<string, unknown>} record
 * @returns {string}
 */
export function classifiableText(record) {
  const parts = [
    record.question,
    record.title,
    record.description,
    record.directAnswer,
    record.nextStep,
  ];
  for (const section of /** @type {{ heading: string, paragraphs: string[], bullets?: string[] }[]} */ (
    record.sections ?? []
  )) {
    parts.push(section.heading, ...section.paragraphs, ...(section.bullets ?? []));
  }
  return parts
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .join('\n');
}

/**
 * @param {Record<string, unknown>} record
 * @param {readonly RegExp[]} lexicon
 * @returns {{ contentClass: string, matched: string[] }}
 */
export function classifyRecord(record, lexicon) {
  const text = classifiableText(record);
  const matched = [];
  for (const pattern of lexicon) {
    const found = pattern.exec(text);
    if (found) matched.push(found[0]);
  }
  return {
    contentClass: matched.length > 0 ? 'external-fact' : 'own-process',
    matched,
  };
}

// ---------------------------------------------------------------------------
// Blocking notes
// ---------------------------------------------------------------------------

/** The record whose whole subject is the fee wording recorded as checklist C5. */
export const BROKERAGE_FEE_SLUGS = /** @type {const} */ (['brokerage-fees-questions']);

/** Requirement 4.7 and checklist C11. */
export const REVIEW_SOURCING_SLUG = 'honest-customer-review';

/** The record whose copy has to be written around an existing content-policy ban. */
export const STATUTORY_REGISTER_SLUG = 'rera-verification-questions';

/**
 * Blocking notes, in a fixed order so the generated file is stable.
 *
 * Every note is either the manifest's own text or a statement about the record's
 * own initial state and what blocks it. None asserts a fact about law, tax, a
 * place, or a customer.
 *
 * @param {GuideCandidate} candidate
 * @param {{ slug: string, renamedFrom: string | null }} slugging
 * @param {{ intent: string, single: boolean }} mappedIntent
 * @param {{ contentClass: string, matched: string[] }} classification
 * @returns {string[]}
 */
export function candidateBlockingNotes(candidate, slugging, mappedIntent, classification) {
  const notes = [
    `Route_Manifest candidate ${candidate.routeId} (${candidate.path}), priority ${candidate.priority}. Working title and working question are the manifest's proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).`,
    'No guide text has been written: empty direct answer, no sections, no next step, no scope note, no content date. The record exists so the candidate is accounted for, not so it can be read.',
  ];

  if (slugging.renamedFrom) {
    const rename = RENAME_BY_MANIFEST_SLUG.get(slugging.renamedFrom);
    notes.push(
      `Renamed at seeding under Requirement 4.9: the manifest slug "${slugging.renamedFrom}" differs from "${rename?.collidesWith}" only by a ${rename?.permutationKind}, which is the doorway pattern. Seeded as "${slugging.slug}", which names the question instead.`
    );
  }

  if (!mappedIntent.single) {
    notes.push(
      `Manifest primary user intent was "${candidate.primaryUserIntent}", which names more than one audience. Requirement 4.1 permits exactly one customer intent per record, so this seeds as "${mappedIntent.intent}" pending an editorial decision on whether the question should split.`
    );
  }

  if (classification.contentClass === 'external-fact') {
    notes.push(
      `Classified external-fact content by classifyGuideContent, which matched: ${classification.matched.map((match) => `"${match}"`).join(', ')}. Blocked on checklist C3: no named author and no named subject reviewer has been supplied for legal, tax and documentation content, and Requirement 4.3 needs both plus a gate-passing claim.`
    );
  }

  if (mappedIntent.intent === 'commercial') {
    notes.push(
      'Blocked on checklist C4: which commercial work the brokerage actually takes on, and in which areas, is unconfirmed. Publishing commercial guidance would imply capability that has not been established.'
    );
  }

  if (BROKERAGE_FEE_SLUGS.includes(/** @type {'brokerage-fees-questions'} */ (slugging.slug))) {
    notes.push(
      'Blocked on checklist C5: no fee, commission or representation wording has been supplied, so no figure, rate, percentage or arrangement may appear here.'
    );
  }

  if (slugging.slug === REVIEW_SOURCING_SLUG) {
    notes.push(
      'Blocked on checklist C11: no genuine customer feedback with a source, a date and permission to republish has been supplied.'
    );
    notes.push(
      'This record describes how feedback would be sourced and what permission it would need. It is not a review page and must never become one: no customer words, no rating, no star count, no testimonial, and no count of how many people have said anything. If checklist C11 is never satisfied, the honest outcome is that this page never publishes.'
    );
  }

  if (slugging.slug === STATUTORY_REGISTER_SLUG) {
    notes.push(
      "External-fact content about a statutory register. The copy has to be written around an existing content-policy ban in tests/public-content.test.ts, which rejects any claim of status under the state real-estate regulator. The honest framing is what a project's entry in the state register does and does not tell a buyer, which stays clear of the banned wording without needing a denial-list entry. No status is asserted for this brokerage or for any project."
    );
  }

  if (slugging.slug === PIN_CODE_WHOLE_SEGMENT_RULING.permittedSlug) {
    notes.push(
      `Permitted under Requirement 12.3 on the recorded reading that "matching" means ${PIN_CODE_WHOLE_SEGMENT_RULING.ruling}: the segment names the difference between a postal code and a locality rather than being a postal-code term or a six-digit literal.`
    );
    notes.push(
      'The second half of Requirement 12.3 binds the copy: this guide explains the concept and presents no six-digit numeral as a postal code — not a real one, not an illustrative one, not a fictional one, because a reader cannot tell an illustration from a fact. Locality-to-postal-code pairings stay in the non-public register until two independent sources and a named reviewer exist.'
    );
  }

  notes.push(
    'No maintenance owner and no next review date recorded (Requirement 4.10, checklist C2), so nobody is yet responsible for keeping this current.'
  );

  return notes;
}

// ---------------------------------------------------------------------------
// Record construction
// ---------------------------------------------------------------------------

/** A marker telling the renderer to emit an identifier rather than a string. */
const raw = (identifier) => ({ __raw: identifier });

/** The field order every generated record literal follows. */
export const GUIDE_FIELD_ORDER = /** @type {const} */ ([
  'guideId',
  'slug',
  'question',
  'title',
  'description',
  'intent',
  'contentClass',
  'directAnswer',
  'sections',
  'nextStep',
  'scopeNote',
  'attributedTo',
  'namedAuthor',
  'subjectReviewer',
  'claimIds',
  'contentUpdatedAt',
  'publicationStatus',
  'relatedGuideIds',
  'blockingNotes',
  'maintenanceOwner',
  'nextReviewAt',
  'primaryIntent',
  'supportingPhrases',
  'visualAssetIds',
]);

/**
 * One candidate as a `GuideRecord`-shaped plain object.
 *
 * Every field the type defines is present. Where nothing has been written the value
 * is an explicit `null`, an empty string or an empty array — never a placeholder
 * that could be mistaken for content.
 *
 * @param {GuideCandidate} candidate
 * @param {readonly RegExp[]} lexicon
 * @returns {Record<string, unknown>}
 */
export function buildGuideRecord(candidate, lexicon) {
  const slugging = seededSlug(candidate.path);
  const mappedIntent = mapCustomerIntent(candidate.primaryUserIntent);
  const title = workingTitle(candidate.proposedTitle);

  const base = {
    guideId: `GD-${candidate.routeId}`,
    slug: slugging.slug,
    question: workingQuestion(title),
    title,
    description: CANDIDATE_DESCRIPTION,
    intent: mappedIntent.intent,
    contentClass: 'own-process',
    directAnswer: '',
    sections: [],
    nextStep: '',
    scopeNote: '',
    attributedTo: raw('CANONICAL_BRAND'),
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: null,
    publicationStatus: 'unpublished',
    relatedGuideIds: [],
    blockingNotes: [],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  };

  const classification = classifyRecord(
    { ...base, description: CANDIDATE_DESCRIPTION },
    lexicon
  );

  return {
    ...base,
    contentClass: classification.contentClass,
    blockingNotes: candidateBlockingNotes(candidate, slugging, mappedIntent, classification),
  };
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ServedElsewhere
 * @property {string} routeId
 * @property {string} manifestSlug
 * @property {string} seededSlugWouldHaveBeen
 * @property {string} servedByGuideId
 * @property {string} servedByRoute
 * @property {string} reason
 * @property {string} recordedOn
 */

/**
 * Seed a candidate list.
 *
 * Manifest order is the order of resolution, the same way the locality seeding
 * resolves in CSV order. A candidate is held out when its question is already
 * served by a record in the registry (Requirement 3.5), when its seeded slug is
 * already taken (Requirement 4.1), or when its route path would carry a forbidden
 * segment (Requirement 12.3). Nothing is discarded: every hold-out is returned with
 * the route that serves it instead.
 *
 * @param {readonly GuideCandidate[]} candidates
 * @param {{
 *   existingSlugs?: readonly string[],
 *   existingGuideIds?: readonly string[],
 *   servedElsewhere?: readonly { routeId: string, manifestSlug: string, servedByGuideId: string, servedByRoute: string, reason: string }[],
 *   lexicon?: readonly RegExp[],
 *   recordedOn?: string,
 * }} [context]
 * @returns {{
 *   seeded: Record<string, unknown>[],
 *   servedElsewhere: ServedElsewhere[],
 *   rejected: { routeId: string, reason: string }[],
 *   accounting: {
 *     candidates: number,
 *     seeded: number,
 *     servedElsewhere: number,
 *     rejected: number,
 *     existing: number,
 *     registryTotal: number,
 *   },
 * }}
 */
export function seedGuideCandidates(candidates, context = {}) {
  const existingSlugs = context.existingSlugs ?? [];
  const existingGuideIds = context.existingGuideIds ?? [];
  const servedTable = context.servedElsewhere ?? ALREADY_SERVED_BY_EXISTING_RECORD;
  const lexicon = context.lexicon ?? readExternalFactLexicon();
  const recordedOn = context.recordedOn ?? RECORDED_ON;

  const servedByRouteId = new Map(servedTable.map((entry) => [entry.routeId, entry]));
  const takenSlugs = new Set(existingSlugs);
  const takenGuideIds = new Set(existingGuideIds);

  /** @type {Record<string, unknown>[]} */
  const seeded = [];
  /** @type {ServedElsewhere[]} */
  const servedElsewhere = [];
  /** @type {{ routeId: string, reason: string }[]} */
  const rejected = [];

  for (const candidate of candidates) {
    const slugging = seededSlug(candidate.path);

    const served = servedByRouteId.get(candidate.routeId);
    if (served) {
      servedElsewhere.push({
        routeId: served.routeId,
        manifestSlug: served.manifestSlug,
        seededSlugWouldHaveBeen: slugging.slug,
        servedByGuideId: served.servedByGuideId,
        servedByRoute: served.servedByRoute,
        reason: served.reason,
        recordedOn,
      });
      continue;
    }

    if (pathCarriesForbiddenSegment(`${GUIDE_ROUTE_PREFIX}${slugging.slug}`)) {
      rejected.push({
        routeId: candidate.routeId,
        reason: `Route /guides/${slugging.slug} carries a segment Requirement 12.3 forbids.`,
      });
      continue;
    }

    if (takenSlugs.has(slugging.slug)) {
      rejected.push({
        routeId: candidate.routeId,
        reason: `Slug "${slugging.slug}" is already held by another record.`,
      });
      continue;
    }

    const record = buildGuideRecord(candidate, lexicon);
    if (takenGuideIds.has(/** @type {string} */ (record.guideId))) {
      rejected.push({
        routeId: candidate.routeId,
        reason: `Guide identifier "${record.guideId}" is already held by another record.`,
      });
      continue;
    }

    takenSlugs.add(slugging.slug);
    takenGuideIds.add(/** @type {string} */ (record.guideId));
    seeded.push(record);
  }

  return {
    seeded,
    servedElsewhere,
    rejected,
    accounting: {
      candidates: candidates.length,
      seeded: seeded.length,
      servedElsewhere: servedElsewhere.length,
      rejected: rejected.length,
      existing: existingSlugs.length,
      registryTotal: existingSlugs.length + seeded.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * @param {string} value
 * @returns {string}
 */
function quote(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * @param {unknown} value
 * @param {number} depth
 * @returns {string}
 */
function renderValue(value, depth) {
  const pad = '  '.repeat(depth);
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${pad}  ${renderValue(item, depth + 1)},`).join('\n');
    return `[\n${items}\n${pad}]`;
  }
  const record = /** @type {Record<string, unknown>} */ (value);
  if (typeof record.__raw === 'string') return record.__raw;
  const entries = Object.entries(record)
    .map(([key, item]) => `${pad}  ${key}: ${renderValue(item, depth + 1)},`)
    .join('\n');
  return `{\n${entries}\n${pad}}`;
}

/**
 * @param {Record<string, unknown>} record
 * @returns {string}
 */
export function renderRecord(record) {
  const lines = GUIDE_FIELD_ORDER.map((field) => `    ${field}: ${renderValue(record[field], 2)},`);
  return `  {\n${lines.join('\n')}\n  },`;
}

/**
 * @param {string} intent
 * @returns {string}
 */
export function intentExportName(intent) {
  return `${intent.replace(/-/g, '_').toUpperCase()}_GUIDE_CANDIDATES`;
}

/**
 * @param {string} intent
 * @param {readonly Record<string, unknown>[]} records
 * @returns {string}
 */
export function renderIntentModule(intent, records) {
  const exportName = intentExportName(intent);
  return `/**
 * Seeded guide candidates — customer intent "${intent}".
 *
 * GENERATED FILE. Edit \`scripts/seed-guide-candidates.mjs\` and re-run it rather
 * than editing this file; \`tests/guide-seeding.test.ts\` fails on drift between the
 * two.
 *
 * ${records.length} candidate${records.length === 1 ? '' : 's'} from the \`guide\` family of
 * \`docs/seo-launch-handoff/ROUTE-MANIFEST.csv\`. Every record is unpublished with an
 * empty direct answer, no sections and no content date, so none can pass
 * \`evaluateGuide\` and none reaches a reader. Requirements 4.1, 4.2, 4.6.
 */

import { CANONICAL_BRAND } from '@/config/constants';
import type { GuideRecord } from '@/config/guides';

export const ${exportName}: readonly GuideRecord[] = [
${records.map((record) => renderRecord(record)).join('\n')}
];
`;
}

/**
 * @param {readonly { intent: string, count: number }[]} groups
 * @param {readonly ServedElsewhere[]} servedElsewhere
 * @returns {string}
 */
export function renderIndexModule(groups, servedElsewhere) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const imports = groups
    .map((group) => `import { ${intentExportName(group.intent)} } from './${group.intent}';`)
    .join('\n');
  const spreads = groups.map((group) => `  ...${intentExportName(group.intent)},`).join('\n');
  const table = groups
    .map((group) => ` *   ${group.intent.padEnd(12)} ${String(group.count).padStart(3)}`)
    .join('\n');
  const served = servedElsewhere
    .map(
      (entry) =>
        ` *   ${entry.routeId}  ${entry.manifestSlug.padEnd(28)} -> ${entry.servedByGuideId}`
    )
    .join('\n');

  return `/**
 * The seeded guide candidate registry.
 *
 * GENERATED FILE. Edit \`scripts/seed-guide-candidates.mjs\` and re-run it rather
 * than editing this file; \`tests/guide-seeding.test.ts\` fails on drift between the
 * two.
 *
 * ${total} records, split by customer intent so no generated file is too large to
 * review:
 *
${table}
 *
 * ${servedElsewhere.length} of the 36 manifest candidates are deliberately absent. Each asks a
 * question a record already in the registry answers, so Requirement 3.5 keeps the
 * existing route as the only destination rather than creating a second URL for a
 * wording variation:
 *
${served}
 *
 * That makes both sums land on 36: ${total} seeded + ${servedElsewhere.length} served elsewhere = 36 manifest
 * candidates, and ${total} seeded + ${servedElsewhere.length} existing records = 36 registry records.
 */

${imports}

import type { GuideRecord } from '@/config/guides';

export const SEEDED_GUIDE_CANDIDATES: readonly GuideRecord[] = [
${spreads}
];
`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Group seeded records by customer intent, in `INTENT_FILE_ORDER`, dropping empty
 * intents. Deterministic, so re-running on an unchanged manifest produces
 * byte-identical files.
 *
 * @param {readonly Record<string, unknown>[]} records
 * @returns {{ intent: string, records: Record<string, unknown>[] }[]}
 */
export function groupSeededRecords(records) {
  return INTENT_FILE_ORDER.map((intent) => ({
    intent,
    records: records.filter((record) => record.intent === intent),
  })).filter((group) => group.records.length > 0);
}

/**
 * @param {readonly GuideCandidate[]} candidates
 * @param {Parameters<typeof seedGuideCandidates>[1]} [context]
 * @returns {{ files: Record<string, string>, result: ReturnType<typeof seedGuideCandidates> }}
 */
export function generateRegistryFiles(candidates, context) {
  const result = seedGuideCandidates(candidates, context);
  const groups = groupSeededRecords(result.seeded);

  /** @type {Record<string, string>} */
  const files = {};
  for (const group of groups) {
    files[join(GUIDE_REGISTRY_DIR, `${group.intent}.ts`)] = renderIntentModule(
      group.intent,
      group.records
    );
  }
  files[join(GUIDE_REGISTRY_DIR, 'index.ts')] = renderIndexModule(
    groups.map((group) => ({ intent: group.intent, count: group.records.length })),
    result.servedElsewhere
  );

  return { files, result };
}

/**
 * The seven hand-written records, read out of `src/config/guides.ts` as text.
 *
 * Reading the source rather than importing it keeps this script free of a
 * TypeScript loader. The regex is narrow and the count is asserted in the test, so
 * a source change that breaks the read fails loudly instead of silently seeding a
 * colliding slug.
 *
 * @returns {{ guideId: string, slug: string }[]}
 */
export function readExistingGuideViews() {
  const text = readFileSync(join(ROOT, 'src', 'config', 'guides.ts'), 'utf8');
  const start = text.indexOf('const EXISTING_GUIDE_RECORDS');
  const region = start === -1 ? text : text.slice(start);
  return [...region.matchAll(/guideId: '([^']+)',\s*\n\s*slug: '([^']+)',/g)].map((match) => ({
    guideId: match[1],
    slug: match[2],
  }));
}

/**
 * @returns {{ files: Record<string, string>, result: ReturnType<typeof seedGuideCandidates> }}
 */
export function generateFromRepository() {
  const candidates = candidatesFromManifest(readFileSync(MANIFEST_PATH, 'utf8'));
  const existing = readExistingGuideViews();
  return generateRegistryFiles(candidates, {
    existingSlugs: existing.map((view) => view.slug),
    existingGuideIds: existing.map((view) => view.guideId),
  });
}

function main() {
  const check = process.argv.includes('--check');
  const { files, result } = generateFromRepository();

  let drift = 0;
  if (!existsSync(GUIDE_REGISTRY_DIR)) mkdirSync(GUIDE_REGISTRY_DIR, { recursive: true });

  for (const [filePath, contents] of Object.entries(files)) {
    const current = existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
    if (current === contents) continue;
    drift += 1;
    if (check) {
      process.stderr.write(`drift: ${filePath}\n`);
    } else {
      writeFileSync(filePath, contents, 'utf8');
      process.stdout.write(`wrote ${filePath}\n`);
    }
  }

  const { accounting } = result;
  process.stdout.write(
    `\ncandidates ${accounting.candidates} = seeded ${accounting.seeded}` +
      ` + served elsewhere ${accounting.servedElsewhere}` +
      ` + rejected ${accounting.rejected}\n` +
      `registry total ${accounting.registryTotal}` +
      ` (seeded ${accounting.seeded} + existing ${accounting.existing})\n`
  );

  const external = result.seeded.filter((record) => record.contentClass === 'external-fact');
  process.stdout.write(
    `\nclassifier split over the seeded records: ${external.length} external-fact,` +
      ` ${result.seeded.length - external.length} own-process\n`
  );
  for (const record of external) {
    process.stdout.write(`  external-fact  ${record.slug}\n`);
  }

  if (result.servedElsewhere.length > 0) {
    process.stdout.write('\nserved by an existing record rather than seeded:\n');
    for (const entry of result.servedElsewhere) {
      process.stdout.write(
        `  ${entry.routeId} ${entry.manifestSlug} -> ${entry.servedByGuideId} ${entry.servedByRoute}\n`
      );
    }
  }

  if (result.rejected.length > 0) {
    process.stdout.write('\nrejected:\n');
    for (const entry of result.rejected) {
      process.stdout.write(`  ${entry.routeId} ${entry.reason}\n`);
    }
  }

  if (check && drift > 0) {
    process.stderr.write(`\n${drift} generated file(s) differ from this script's output.\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
