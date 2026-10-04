import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CANONICAL_BRAND } from '@/config/constants';
import {
  GUIDE_REGISTRY,
  evaluateGuide,
  getPublishedGuides,
  isGuidePublishable,
  type GuideRecord,
} from '@/config/guides';
import { SEEDED_GUIDE_CANDIDATES } from '@/config/guide-registry';
import {
  AREA_TOKENS,
  EXTERNAL_FACT_LEXICON,
  INTENT_TOKENS,
  TYPE_TOKENS,
  classifyGuideContent,
  externalFactMatches,
  findPermutationSlugPairs,
  slugsDifferOnlyByPermutationToken,
  tokeniseSlug,
} from '@/config/guide-classification';
import { SEARCH_INTENT_ENTRIES } from '@internal/registers/search-intent';

import {
  ADDITIONAL_FORBIDDEN_SEGMENTS,
  ALREADY_SERVED_BY_EXISTING_RECORD,
  FORBIDDEN_ROUTE_SEGMENTS,
  GUIDE_SLUG_RENAMES,
  MANIFEST_PATH,
  PIN_CODE_WHOLE_SEGMENT_RULING,
  candidatesFromManifest,
  generateFromRepository,
  mapCustomerIntent,
  pathCarriesForbiddenSegment,
  readExistingGuideViews,
  workingTitle,
} from '../scripts/seed-guide-candidates.mjs';
import { APPROVED_DENIALS, bannedPatternsFor } from './helpers/banned-pattern-scan';

/**
 * Seeding the Route_Manifest guide candidates.
 *
 * Requirement 4.1 says every one of the 36 manifest candidates becomes a typed
 * record with a slug unique across the registry, one customer intent and one
 * customer question. Requirement 3.5 says a candidate asking a question an existing
 * page already answers does not get a second URL. Requirement 4.9 says two slugs
 * differing only by an intent word, a property-type word or an area name are the
 * same page twice.
 *
 * Those pull against each other unless the arithmetic is written down, so this file
 * writes it down: **29 seeded + 7 served elsewhere = 36 candidates**, and
 * **29 seeded + 7 existing = 36 registry records**. A candidate that quietly
 * disappeared would break the first sum; a candidate seeded over a question that is
 * already answered would break the second.
 *
 * The seeded records are generated, so the generator and the committed files are
 * compared here too. A hand edit to a generated file fails this suite rather than
 * surviving until the next regeneration overwrites it.
 */

const ROOT = join(__dirname, '..');
const NOW = new Date('2026-09-29T00:00:00.000Z');

const MANIFEST_CANDIDATES = candidatesFromManifest(readFileSync(MANIFEST_PATH, 'utf8'));
const GENERATED = generateFromRepository();
const EXISTING_VIEWS = readExistingGuideViews();

/** The seven records the repository held before the manifest was seeded. */
const EXISTING_GUIDE_IDS = [
  'GD-SELL-PREPARE',
  'GD-SELL-30-DAYS',
  'GD-RENTOUT-DECISIONS',
  'GD-BUY-DOCUMENTS',
  'GD-SELL-TAXES',
  'GD-GEN-BROKERAGE-FEES',
  'GD-COM-OFFICE',
] as const;

/** The three guides that passed the gate before this task, and still do. */
const PUBLISHED_BEFORE_SEEDING = [
  'what-to-tell-us-when-you-want-to-sell-your-property',
  'can-a-broker-guarantee-a-property-sale-in-30-days',
  'decisions-to-make-before-you-rent-out-your-property',
] as const;

describe('the candidate accounting', () => {
  it('reads all 36 guide-family rows of the manifest', () => {
    expect(MANIFEST_CANDIDATES).toHaveLength(36);
    for (const candidate of MANIFEST_CANDIDATES) {
      expect(candidate.routeId, JSON.stringify(candidate)).toMatch(/^PAGE-\d{3}$/);
      expect(candidate.path).toMatch(/^\/guides\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(workingTitle(candidate.proposedTitle).length).toBeGreaterThan(0);
      expect(candidate.primaryUserIntent.length).toBeGreaterThan(0);
    }
  });

  it('accounts for every candidate as seeded or served elsewhere', () => {
    const { accounting } = GENERATED.result;
    expect(accounting.candidates).toBe(36);
    expect(accounting.seeded).toBe(29);
    expect(accounting.servedElsewhere).toBe(7);
    expect(accounting.rejected).toBe(0);
    expect(accounting.existing).toBe(7);
    expect(accounting.seeded + accounting.servedElsewhere).toBe(accounting.candidates);
  });

  /**
   * 29 seeded, 7 served elsewhere, 7 existing — and two separate sums that both
   * land on 36.
   *
   *   29 seeded + 7 served elsewhere = 36 manifest candidates accounted for
   *   29 seeded + 7 existing records = 36 registry records
   *
   * The two sevens are the same seven questions seen from either side, which is why
   * both sums agree: each pre-existing record answers exactly one candidate. The
   * assertion below says that explicitly, because "36" appearing twice for
   * unrelated reasons would be a coincidence worth distrusting.
   */
  it('sums 29 seeded with 7 served elsewhere to the candidates, and with 7 existing to the registry', () => {
    expect(SEEDED_GUIDE_CANDIDATES).toHaveLength(29);
    expect(ALREADY_SERVED_BY_EXISTING_RECORD).toHaveLength(7);
    expect(EXISTING_GUIDE_IDS).toHaveLength(7);

    expect(SEEDED_GUIDE_CANDIDATES.length + ALREADY_SERVED_BY_EXISTING_RECORD.length).toBe(36);
    expect(SEEDED_GUIDE_CANDIDATES.length + EXISTING_GUIDE_IDS.length).toBe(36);

    const serving = ALREADY_SERVED_BY_EXISTING_RECORD.map((entry) => entry.servedByGuideId);
    expect(new Set(serving).size).toBe(7);
    expect([...serving].sort()).toEqual([...EXISTING_GUIDE_IDS].sort());
  });

  it('holds 36 registry records once the existing seven are counted', () => {
    expect(GUIDE_REGISTRY).toHaveLength(36);
    const ids = GUIDE_REGISTRY.map((record) => record.guideId);
    for (const guideId of EXISTING_GUIDE_IDS) {
      expect(ids).toContain(guideId);
    }
  });

  it('reads the seven hand-written records out of the source it seeds alongside', () => {
    // The generator reads `guides.ts` as text to learn which slugs are taken. If
    // that read silently returned nothing, a colliding slug would be seeded, so the
    // count is asserted rather than trusted.
    expect(EXISTING_VIEWS).toHaveLength(7);
    expect(EXISTING_VIEWS.map((view) => view.guideId).sort()).toEqual(
      [...EXISTING_GUIDE_IDS].sort()
    );
  });

  it('names the route that serves each held-out candidate, and a real reason', () => {
    const registrySlugs = new Set(GUIDE_REGISTRY.map((record) => record.slug));
    const registryIds = new Set(GUIDE_REGISTRY.map((record) => record.guideId));

    for (const entry of ALREADY_SERVED_BY_EXISTING_RECORD) {
      expect(entry.routeId, entry.manifestSlug).toMatch(/^PAGE-\d{3}$/);
      expect(registryIds.has(entry.servedByGuideId), entry.servedByGuideId).toBe(true);
      expect(entry.servedByRoute).toBe(
        `/guides/${entry.servedByRoute.replace('/guides/', '')}`
      );
      expect(registrySlugs.has(entry.servedByRoute.replace('/guides/', ''))).toBe(true);
      // A reason has to be an argument, not a label.
      expect(entry.reason.length, entry.routeId).toBeGreaterThan(80);
    }
  });

  it('seeds neither the manifest slug nor the renamed slug of a served candidate', () => {
    const registrySlugs = new Set(GUIDE_REGISTRY.map((record) => record.slug));
    for (const entry of GENERATED.result.servedElsewhere) {
      expect(registrySlugs.has(entry.manifestSlug), entry.manifestSlug).toBe(false);
      expect(
        registrySlugs.has(entry.seededSlugWouldHaveBeen),
        entry.seededSlugWouldHaveBeen
      ).toBe(false);
    }
  });
});

describe('the seven renames', () => {
  it('records all seven, each against the sibling it collided with', () => {
    expect(GUIDE_SLUG_RENAMES).toHaveLength(7);
    expect(
      GUIDE_SLUG_RENAMES.map((rename) => [
        rename.manifestSlug,
        rename.seededSlug,
        rename.permutationKind,
      ])
    ).toEqual([
      ['sell-flat-bengaluru', 'what-happens-when-you-list-a-flat-for-sale', 'intent word'],
      ['buy-flat-bengaluru', 'what-to-check-before-you-agree-to-buy-a-flat', 'intent word'],
      ['rent-home-bengaluru', 'how-a-rental-search-actually-proceeds', 'intent word'],
      ['rent-out-flat-bengaluru', 'what-a-landlord-decides-before-listing', 'intent word'],
      ['buy-villa-checklist', 'questions-a-villa-purchase-raises', 'property-type word'],
      ['buy-site-plot-checklist', 'questions-a-site-purchase-raises', 'property-type word'],
      [
        'independent-house-checklist',
        'questions-an-independent-house-purchase-raises',
        'property-type word',
      ],
    ]);
  });

  it('leaves no permutation slug anywhere in the registry', () => {
    const slugs = new Set(GUIDE_REGISTRY.map((record) => record.slug));
    for (const rename of GUIDE_SLUG_RENAMES) {
      expect(slugs.has(rename.manifestSlug), `${rename.manifestSlug} must not be seeded`).toBe(
        false
      );
    }
  });

  /**
   * Six of the seven rename targets are seeded records. The seventh,
   * `what-a-landlord-decides-before-listing`, is recorded as served by the
   * published `decisions-to-make-before-you-rent-out-your-property` instead —
   * because once the manifest slug is renamed to the question it actually asks, it
   * *is* that published page's question. The rename is applied and recorded either
   * way; what it produces is a destination rather than a second URL.
   */
  it('accounts for every rename target as a seeded record or a recorded destination', () => {
    const seededSlugs = new Set(SEEDED_GUIDE_CANDIDATES.map((record) => record.slug));
    const servedTargets = new Set(
      GENERATED.result.servedElsewhere.map((entry) => entry.seededSlugWouldHaveBeen)
    );

    const asRecords = GUIDE_SLUG_RENAMES.filter((rename) => seededSlugs.has(rename.seededSlug));
    const asDestinations = GUIDE_SLUG_RENAMES.filter((rename) =>
      servedTargets.has(rename.seededSlug)
    );

    expect(asRecords).toHaveLength(6);
    expect(asDestinations.map((rename) => rename.seededSlug)).toEqual([
      'what-a-landlord-decides-before-listing',
    ]);
    expect(asRecords.length + asDestinations.length).toBe(7);
  });

  /**
   * The rename table is an editorial record, and the detection function is an
   * independent check on it. Six pairs the function confirms. One it does not:
   * `rent-home-bengaluru` and `rent-out-flat-bengaluru` differ by `home` on one
   * side and `out` plus `flat` on the other, and `home` is not in `TYPE_TOKENS`.
   * The gap is asserted rather than closed, because widening a token list is a
   * change to the rule itself and belongs in front of whoever owns the rule.
   */
  it('has the function confirm six of the seven pairs, and records the seventh gap', () => {
    for (const rename of GUIDE_SLUG_RENAMES) {
      expect(
        slugsDifferOnlyByPermutationToken(rename.manifestSlug, rename.collidesWith),
        `${rename.manifestSlug} vs ${rename.collidesWith}`
      ).toBe(rename.detectedByFunction);
    }
    expect(GUIDE_SLUG_RENAMES.filter((rename) => rename.detectedByFunction)).toHaveLength(5);
    expect(GUIDE_SLUG_RENAMES.filter((rename) => !rename.detectedByFunction)).toHaveLength(2);
    expect(TYPE_TOKENS).not.toContain('home');
  });
});

describe('slug distinctness over the seeded slugs', () => {
  const allSlugs = GUIDE_REGISTRY.map((record) => record.slug);

  it('gives every record in the registry a unique slug and a unique identifier', () => {
    expect(new Set(allSlugs).size).toBe(allSlugs.length);
    const ids = GUIDE_REGISTRY.map((record) => record.guideId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the tokeniser from splitting a multi-part lexicon phrase', () => {
    expect(tokeniseSlug('rent-out-flat-bengaluru')).toEqual(['rent-out', 'flat', 'bengaluru']);
    expect(tokeniseSlug('sell-flat-bengaluru')).toEqual(['sell', 'flat', 'bengaluru']);
    expect(INTENT_TOKENS).toContain('rent-out');
  });

  it('derives the area lexicon from the locality registry plus the two city names', () => {
    expect(AREA_TOKENS).toContain('bengaluru');
    expect(AREA_TOKENS).toContain('bangalore');
    expect(AREA_TOKENS).toContain('indiranagar');
    expect(AREA_TOKENS).toContain('koramangala');
    // Whole hyphenated names, not their parts: a slug token of `city` or `layout`
    // is not an area word, or half the guide slugs would start colliding.
    expect(AREA_TOKENS).not.toContain('city');
    expect(AREA_TOKENS).not.toContain('layout');
    expect(AREA_TOKENS.length).toBeGreaterThan(100);
  });

  it('flags a reordering and ignores an identical slug', () => {
    expect(slugsDifferOnlyByPermutationToken('buy-flat', 'flat-buy')).toBe(true);
    expect(slugsDifferOnlyByPermutationToken('buy-flat', 'buy-flat')).toBe(false);
    expect(
      slugsDifferOnlyByPermutationToken('what-a-landlord-decides', 'what-a-tenant-decides')
    ).toBe(false);
  });

  /** Requirement 4.9 binds published records. No pair, because no pair can exist. */
  it('leaves no colliding pair among the published guides', () => {
    const publishedSlugs = getPublishedGuides(NOW).map((record) => record.slug);
    expect(findPermutationSlugPairs(publishedSlugs)).toEqual([]);
  });

  /**
   * One latent pair survives among the 36 records, and it is worth naming rather
   * than hiding: the design's own rename targets for the villa and site checklists
   * differ only by `villa` against `site`, both property-type words. Renaming
   * `buy-villa-checklist` and `buy-site-plot-checklist` moved the permutation from
   * the front of the slug to the middle without removing it.
   *
   * Requirement 4.9 fails the build when two *published* guides carry such slugs,
   * and both of these are unpublished, so nothing is broken today. What would break
   * is publishing both. Recording the pair as an exact expected set means a *new*
   * latent pair fails this test, while this known one stays visible until somebody
   * decides whether the two questions are really one question.
   */
  it('records the one latent pair among all 36 records, and admits no new one', () => {
    expect(findPermutationSlugPairs(allSlugs)).toEqual([
      { a: 'questions-a-site-purchase-raises', b: 'questions-a-villa-purchase-raises' },
    ]);
  });
});

describe('every seeded record starts in the Requirement 4.2 and 4.6 state', () => {
  /** The field set `GuideRecord` defines, taken from a hand-written record. */
  const FIELD_NAMES = Object.keys(GUIDE_REGISTRY[0]).sort();

  it('declares every field the type requires', () => {
    expect(FIELD_NAMES.length).toBeGreaterThan(20);
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      expect(Object.keys(record).sort(), record.guideId).toEqual(FIELD_NAMES);
    }
  });

  it('seeds every record unpublished with nothing written', () => {
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      expect(record.publicationStatus, record.slug).toBe('unpublished');
      expect(record.directAnswer, record.slug).toBe('');
      expect(record.sections, record.slug).toEqual([]);
      expect(record.contentUpdatedAt, record.slug).toBeNull();
      expect(record.nextStep, record.slug).toBe('');
      expect(record.scopeNote, record.slug).toBe('');
    }
  });

  it('leaves every unresearched field an explicit null', () => {
    const nullFields = [
      'namedAuthor',
      'subjectReviewer',
      'contentUpdatedAt',
      'maintenanceOwner',
      'nextReviewAt',
      'primaryIntent',
    ] as const;
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      for (const field of nullFields) {
        expect(record[field], `${record.slug}.${field}`).toBeNull();
      }
    }
  });

  it('leaves every unresearched collection empty rather than plausible', () => {
    const emptyFields = [
      'sections',
      'claimIds',
      'relatedGuideIds',
      'supportingPhrases',
      'visualAssetIds',
    ] as const;
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      for (const field of emptyFields) {
        expect(record[field], `${record.slug}.${field}`).toEqual([]);
      }
    }
  });

  it('attributes every record to the exact canonical brand', () => {
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      expect(record.attributedTo, record.slug).toBe(CANONICAL_BRAND);
    }
  });

  it('carries one intent and one question of at most 160 characters', () => {
    const questions = new Set<string>();
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      expect(record.question.length, record.slug).toBeGreaterThan(0);
      expect(record.question.length, record.slug).toBeLessThanOrEqual(160);
      expect(record.question.endsWith('?'), record.slug).toBe(true);
      expect(questions.has(record.question), `${record.slug} repeats a question`).toBe(false);
      questions.add(record.question);
      expect(
        ['buy', 'sell', 'rent', 'rent-out', 'commercial', 'general'],
        record.slug
      ).toContain(record.intent);
    }
    expect(questions.size).toBe(29);
  });

  it('maps a multi-audience manifest value to general without claiming it', () => {
    const multi = MANIFEST_CANDIDATES.filter(
      (candidate) => !mapCustomerIntent(candidate.primaryUserIntent).single
    );
    expect(multi.length).toBeGreaterThan(0);
    for (const candidate of multi) {
      const record = SEEDED_GUIDE_CANDIDATES.find(
        (seeded) => seeded.guideId === `GD-${candidate.routeId}`
      );
      if (!record) continue; // served by an existing record instead
      expect(record.intent, candidate.routeId).toBe('general');
      // The original value survives as a note rather than becoming an intent.
      expect(record.blockingNotes.join(' ')).toContain(candidate.primaryUserIntent);
    }
  });

  it('says why each candidate is blocked, naming its manifest row', () => {
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      expect(record.blockingNotes.length, record.slug).toBeGreaterThan(0);
      expect(record.blockingNotes[0], record.slug).toMatch(/^Route_Manifest candidate PAGE-\d{3}/);
      expect(record.blockingNotes.join(' '), record.slug).toContain('Requirement 4.10');
    }
  });

  it('holds no researched phrase, and says so rather than inventing one', () => {
    expect(SEARCH_INTENT_ENTRIES).toEqual([]);
    for (const record of GUIDE_REGISTRY) {
      expect(record.primaryIntent, record.slug).toBeNull();
      expect(record.supportingPhrases, record.slug).toEqual([]);
      expect(record.visualAssetIds, record.slug).toEqual([]);
      for (const section of record.sections) {
        expect(section.headingIntentEntryId, `${record.slug}: ${section.heading}`).toBeNull();
      }
    }
  });

  it('fails the gate on every seeded record', () => {
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      const evaluation = evaluateGuide(record, NOW);
      expect(evaluation.eligible, record.slug).toBe(false);
      expect(evaluation.failures.length, record.slug).toBeGreaterThan(0);
    }
  });

  it('changes no published count', () => {
    // 29 more records, still the same three pages. The gate is the only visibility
    // rule and none of these records carries a direct answer, a section or a date.
    const published = getPublishedGuides(NOW).map((record) => record.slug);
    expect(published.sort()).toEqual([...PUBLISHED_BEFORE_SEEDING].sort());
    expect(published).toHaveLength(3);
  });
});

describe('classification is computed, not hand-labelled', () => {
  it('stores the class the real classifier returns for every seeded record', () => {
    // The generator parses `EXTERNAL_FACT_LEXICON` out of the module rather than
    // restating it, so this assertion is what proves the two have not drifted.
    for (const record of SEEDED_GUIDE_CANDIDATES) {
      expect(classifyGuideContent(record), record.slug).toBe(record.contentClass);
    }
  });

  it('keeps the lexicon at the six families the rule defines', () => {
    expect(EXTERNAL_FACT_LEXICON).toHaveLength(6);
  });

  /**
   * The classifier is the authority, so the split is recorded rather than assumed.
   *
   * On empty-bodied candidates it reads only the working question, the working
   * title and the description, so it fires once — on the statutory-register guide,
   * whose title names the regulator. The design expected roughly eleven
   * external-fact records; that is an expectation about *finished* guides, and the
   * design says so explicitly ("the exact split is produced by the function at seed
   * time and recorded, not asserted here"). A record acquires the class when it
   * acquires the sentence, which is the whole point of computing it.
   */
  it('records the split the classifier actually produces at seed time', () => {
    const external = SEEDED_GUIDE_CANDIDATES.filter(
      (record) => record.contentClass === 'external-fact'
    );
    expect(external.map((record) => record.slug)).toEqual(['rera-verification-questions']);
    expect(SEEDED_GUIDE_CANDIDATES.length - external.length).toBe(28);
  });

  it('names the matched text, so a classification is arguable rather than opaque', () => {
    const record = SEEDED_GUIDE_CANDIDATES.find(
      (candidate) => candidate.slug === 'rera-verification-questions'
    );
    expect(record).toBeDefined();
    const matches = externalFactMatches(record!);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((match) => /RERA/i.test(match.matched))).toBe(true);
  });

  /**
   * One hand-written record used to disagree with the classifier. Task 6.3 resolved
   * it by editing the copy, and this test now records the resolution.
   *
   * `what-to-tell-us-when-you-want-to-sell-your-property` is stored `own-process`
   * and published. A bullet in its "what we do not ask for" section used to name
   * the documents we do not ask for — "title deeds, khata records, tax receipts" —
   * and the lexicon matched all three, so the classifier read this own-process guide
   * as external-fact content. Task 6.2 made that disagreement a gate failure, which
   * on the old text would have unpublished the page.
   *
   * The fix was the copy, not the gate. The sentence now says we ask for no
   * ownership papers, identity proof or financial statements through this website,
   * which is the same true statement without naming document types the guide would
   * then be stating something about. No exemption was added, the lexicon was not
   * narrowed, and `guideClassifiableText` still excludes only the scope note.
   */
  it('leaves no record whose stored class the classifier contradicts', () => {
    const disagreements = GUIDE_REGISTRY.filter(
      (record) =>
        record.contentClass === 'own-process' && classifyGuideContent(record) === 'external-fact'
    ).map((record) => record.slug);
    expect(disagreements).toEqual([]);

    // The record that used to disagree still publishes, on edited copy.
    const edited = GUIDE_REGISTRY.find(
      (record) => record.slug === 'what-to-tell-us-when-you-want-to-sell-your-property'
    )!;
    expect(isGuidePublishable(edited, NOW)).toBe(true);
    const bodyText = edited.sections
      .flatMap((section) => [...section.paragraphs, ...(section.bullets ?? [])])
      .join(' ');
    expect(bodyText).not.toMatch(/title deed|khata|tax receipt/i);
    expect(bodyText).toMatch(/ownership papers/i);
  });

  it('reads a reader-facing field and not the scope note', () => {
    const base = GUIDE_REGISTRY.find(
      (record) => record.slug === 'can-a-broker-guarantee-a-property-sale-in-30-days'
    )!;
    expect(classifyGuideContent(base)).toBe('own-process');
    // The standing own-process scope note contains the words "legal, tax or
    // financial advice". A disclaimer denying that the guide states anything about
    // tax is not the guide stating something about tax.
    expect(base.scopeNote).toMatch(/\btax\b/);
    expect(classifyGuideContent({ ...base, scopeNote: 'stamp duty is 5%' })).toBe('own-process');
    expect(classifyGuideContent({ ...base, directAnswer: 'Stamp duty applies.' })).toBe(
      'external-fact'
    );
  });
});

describe('the three records that need their own ruling', () => {
  function record(slug: string): GuideRecord {
    const found = SEEDED_GUIDE_CANDIDATES.find((candidate) => candidate.slug === slug);
    expect(found, `${slug} must be seeded`).toBeDefined();
    return found!;
  }

  function readerFacingText(candidate: GuideRecord): string {
    return [
      candidate.question,
      candidate.title,
      candidate.description,
      candidate.directAnswer,
      candidate.nextStep,
      candidate.scopeNote,
      ...candidate.sections.flatMap((section) => [
        section.heading,
        ...section.paragraphs,
        ...(section.bullets ?? []),
      ]),
    ].join('\n');
  }

  describe('honest-customer-review', () => {
    const review = record('honest-customer-review');

    it('is seeded as a record about sourcing feedback, not as a review page', () => {
      expect(review.publicationStatus).toBe('unpublished');
      const notes = review.blockingNotes.join(' ');
      expect(notes).toContain('checklist C11');
      expect(notes).toMatch(/not a review page/i);
      expect(notes).toMatch(/never become one/i);
    });

    it('carries no review text, rating, star count or testimonial', () => {
      // Scanned over reader-facing text only. The blocking notes *forbid* each of
      // these, and a note saying "no testimonial" is the opposite of a violation —
      // the assertion below checks the notes say exactly that.
      const text = readerFacingText(review);
      for (const pattern of [
        /\b\d(\.\d)?\s*(star|stars|\/\s*5|out of 5)\b/i,
        /\baverage rating\b/i,
        /\btestimonial\b/i,
        /\brating\b/i,
        /\b\d+\s*(reviews|ratings)\b/i,
        /\u2605/,
      ]) {
        expect(text, pattern.source).not.toMatch(pattern);
      }
      // No customer words at all: the record has no body to put them in.
      expect(review.sections).toEqual([]);
      expect(review.directAnswer).toBe('');
    });

    it('states the prohibition in its own notes rather than leaving it implied', () => {
      const notes = review.blockingNotes.join(' ');
      for (const forbidden of ['no rating', 'no star count', 'no testimonial', 'no customer words']) {
        expect(notes, forbidden).toContain(forbidden);
      }
    });
  });

  describe('rera-verification-questions', () => {
    const statutory = record('rera-verification-questions');

    /**
     * The ban this copy is written around already exists in
     * `tests/public-content.test.ts`. It is not weakened, not scoped down, and no
     * denial-list entry is added for it — the phrasing simply stays clear of it.
     */
    const EXISTING_BAN = /\bRERA\s*(registered|registration|approved)/i;

    it('classifies external-fact and blocks on the reviewer checklist', () => {
      expect(statutory.contentClass).toBe('external-fact');
      expect(statutory.blockingNotes.join(' ')).toContain('checklist C3');
    });

    it('matches none of the banned phrasings anywhere in the record', () => {
      const text = `${readerFacingText(statutory)}\n${statutory.blockingNotes.join('\n')}`;
      expect(text).not.toMatch(EXISTING_BAN);
      expect(text).not.toMatch(/\bclear[- ]title\b/i);
      expect(text).not.toMatch(/\blicensed (broker|agent)\b/i);
    });

    it('leaves the existing ban in place and adds no denial-list entry for it', () => {
      // The catalogue the Content_Policy_Test_Suite scans with, read as data rather
      // than as the text of a test file: the ban is still there, by pattern.
      const registration = bannedPatternsFor('unverified-registration').map((pattern) => pattern.source);
      expect(registration).toContain(EXISTING_BAN.source);

      // The approved-denial list is where an exemption would have to go. No entry
      // mentions the regulator, so nothing about this record is exempted.
      expect(APPROVED_DENIALS.length).toBeGreaterThan(0);
      for (const denial of APPROVED_DENIALS) {
        expect(`${denial.fragment} ${denial.reason} ${denial.criterion}`).not.toMatch(/RERA/i);
      }
    });
  });

  describe('pin-code-locality-difference', () => {
    const postal = record('pin-code-locality-difference');

    /**
     * The recorded reading of Requirement 12.3.
     *
     * 12.3 forbids a route path carrying "a segment matching, case-insensitively,
     * `pin`, `pin-code`, `pincode`, `pincodes`, `postcode` or `postal-code`". Read
     * as **whole-segment equality** rather than substring containment, because that
     * is what makes the rule do its job: the rule exists to stop one page per
     * postcode, which is scaled content abuse. A single guide explaining that a
     * postal code is not a locality is the opposite — it stops a reader being
     * misled by exactly the conflation the doorway pattern trades on.
     *
     * So `/pin-codes` and `/areas/560001` stay forbidden, and
     * `/guides/pin-code-locality-difference` is permitted. The second half of 12.3
     * is untouched and binds the copy: no six-digit numeral may be presented as a
     * postal code.
     */
    const PIN_CODE_SEGMENT_READING = 'whole-segment equality';

    it('records the ruling as a constant with its reasoning', () => {
      expect(PIN_CODE_WHOLE_SEGMENT_RULING.ruling).toBe(PIN_CODE_SEGMENT_READING);
      expect(PIN_CODE_WHOLE_SEGMENT_RULING.permittedSlug).toBe('pin-code-locality-difference');
      expect(PIN_CODE_WHOLE_SEGMENT_RULING.reasoning.length).toBeGreaterThan(200);
      expect(PIN_CODE_WHOLE_SEGMENT_RULING.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('permits this route and still forbids every route the rule aims at', () => {
      expect(pathCarriesForbiddenSegment('/guides/pin-code-locality-difference')).toBe(false);
      for (const forbidden of PIN_CODE_WHOLE_SEGMENT_RULING.forbiddenExamples) {
        expect(pathCarriesForbiddenSegment(forbidden), forbidden).toBe(true);
      }
      for (const segment of FORBIDDEN_ROUTE_SEGMENTS) {
        expect(pathCarriesForbiddenSegment(`/${segment}`), segment).toBe(true);
        expect(pathCarriesForbiddenSegment(`/areas/${segment}`), segment).toBe(true);
      }
      // Case-insensitive, per 12.3.
      expect(pathCarriesForbiddenSegment('/PinCodes')).toBe(true);
      expect(pathCarriesForbiddenSegment('/Postal-Code')).toBe(true);
    });

    /**
     * The check adds a failure condition; it never removes one. `pin-codes` — the
     * hyphenated plural the design names as forbidden — is absent from 12.3's six
     * terms, so it is recorded as an addition rather than read as permission.
     */
    it('keeps every segment 12.3 lists and adds the forms it omits', () => {
      expect([...FORBIDDEN_ROUTE_SEGMENTS]).toEqual([
        'pin',
        'pin-code',
        'pincode',
        'pincodes',
        'postcode',
        'postal-code',
      ]);
      expect([...ADDITIONAL_FORBIDDEN_SEGMENTS]).toEqual([
        'pin-codes',
        'postcodes',
        'postal-codes',
      ]);
      for (const segment of ADDITIONAL_FORBIDDEN_SEGMENTS) {
        expect(FORBIDDEN_ROUTE_SEGMENTS as readonly string[]).not.toContain(segment);
        expect(pathCarriesForbiddenSegment(`/${segment}`), segment).toBe(true);
      }
    });

    it('presents no six-digit numeral as a postal code, not even a fictional one', () => {
      const text = `${readerFacingText(postal)}\n${postal.blockingNotes.join('\n')}`;
      expect(text).not.toMatch(/\d{6}/);
      expect(postal.blockingNotes.join(' ')).toMatch(/no six-digit numeral/i);
    });

    it('carries no six-digit numeral in any generated registry file', () => {
      for (const filePath of Object.keys(GENERATED.files)) {
        const contents = readFileSync(filePath as string, 'utf8');
        expect(contents, relative(ROOT, filePath as string)).not.toMatch(/\d{6}/);
      }
    });
  });
});

describe('the generated files match the generator', () => {
  it('writes the seeded records into one file per customer intent', () => {
    const generatedPaths = Object.keys(GENERATED.files)
      .map((filePath) => relative(ROOT, filePath))
      .sort();
    expect(generatedPaths).toEqual([
      join('src', 'config', 'guide-registry', 'buy.ts'),
      join('src', 'config', 'guide-registry', 'commercial.ts'),
      join('src', 'config', 'guide-registry', 'general.ts'),
      join('src', 'config', 'guide-registry', 'index.ts'),
      join('src', 'config', 'guide-registry', 'rent-out.ts'),
      join('src', 'config', 'guide-registry', 'rent.ts'),
      join('src', 'config', 'guide-registry', 'sell.ts'),
    ]);
  });

  it('has no drift between the committed files and a fresh run', () => {
    const drift: string[] = [];
    for (const [filePath, contents] of Object.entries(GENERATED.files)) {
      const onDisk = readFileSync(filePath as string, 'utf8');
      if (onDisk !== (contents as string)) drift.push(relative(ROOT, filePath as string));
    }
    expect(drift).toEqual([]);
  });

  it('produces the same records the registry exports', () => {
    const fresh = new Map(
      GENERATED.result.seeded.map((seeded: Record<string, unknown>) => [seeded.guideId, seeded])
    );
    expect(fresh.size).toBe(SEEDED_GUIDE_CANDIDATES.length);
    for (const candidate of SEEDED_GUIDE_CANDIDATES) {
      const generated = fresh.get(candidate.guideId) as Record<string, unknown> | undefined;
      expect(generated, candidate.guideId).toBeDefined();
      // `attributedTo` renders as the `CANONICAL_BRAND` identifier rather than a
      // literal, so it is compared by value against the constant instead.
      expect({ ...generated, attributedTo: CANONICAL_BRAND }, candidate.guideId).toEqual(candidate);
    }
  });
});
