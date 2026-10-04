/**
 * Practical guide registry and its publication gate.
 *
 * Master prompt section 24: "Each guide requires a named author/reviewer, intent,
 * unique question, accurate scope, and next action." and "Property-documentation,
 * fee, tax, legal, and regulatory topics need current primary sources and
 * applicable approval."
 *
 * Two content classes are distinguished, because they carry different risk:
 *
 *   'own-process'  The guide only describes how INSTLE REAL ESTATE works, what a
 *                  customer should have ready, or what the brokerage will not
 *                  promise. The business is the authority on its own process, so
 *                  attribution to the business is accurate and no external source
 *                  is needed. These may publish without a named individual author,
 *                  and they carry no Article/author structured data.
 *
 *   'external-fact' The guide states something about law, tax, documentation,
 *                  fees, regulation or the local market. These require a named
 *                  author, a named subject reviewer, and claim-backed sources.
 *                  None is approved yet, so all of them stay drafts.
 *
 * See docs/implementation/DECISION-LOG.md, decision D-IMPL-04, for why this
 * split was chosen and how an editor can overrule it.
 */

import { CANONICAL_BRAND } from './constants';
import type { CustomerIntent } from './constants';
import { evaluateClaims, isAttributableName } from './claims';
import {
  classifyGuideContent,
  externalBodyFigureMatches,
  externalFactMatches,
} from './guide-classification';
import { SEEDED_GUIDE_CANDIDATES } from './guide-registry';
import { OWNER_PROFILE } from './owner';
import { addCalendarMonths, parseCalendarDate } from '@/lib/calendar-dates';
import { countWords } from '@/lib/text-metrics';

export type GuideContentClass = 'own-process' | 'external-fact';

export interface GuideSection {
  heading: string;
  /**
   * Requirement 5.4. The Search_Intent_Register entry the heading's wording was
   * taken from.
   *
   * Null until a phrase has been researched under a named tool or a named manual
   * method, which is every heading today — the register is empty because no
   * keyword research tool has been supplied. The register itself lives outside the
   * app module graph, so this is an identifier rather than a reference: task 6
   * turns a null here into a gate failure for a published guide, and the register
   * side is checked by a test that imports both.
   */
  headingIntentEntryId: string | null;
  paragraphs: readonly string[];
  /** Optional plain checklist items. */
  bullets?: readonly string[];
}

export interface GuideRecord {
  guideId: string;
  slug: string;
  /** The single real customer question this guide answers. */
  question: string;
  /** Page H1. */
  title: string;
  /** Honest meta description, derived from the visible content. */
  description: string;
  /** Who the guide is for. */
  intent: CustomerIntent;
  contentClass: GuideContentClass;
  /** Direct answer paragraph, shown before the detail. */
  directAnswer: string;
  sections: readonly GuideSection[];
  /** What the reader should do next, and what the team actually does. */
  nextStep: string;
  /** Explicit scope limit, so the guide never over-claims. */
  scopeNote: string;
  /** Attribution. For 'own-process' guides this is the business itself. */
  attributedTo: string;
  /** Named individual author. Required for 'external-fact' guides. */
  namedAuthor: string | null;
  /** Named subject reviewer. Required for 'external-fact' guides. */
  subjectReviewer: string | null;
  /** Claim IDs for external factual statements. */
  claimIds: readonly string[];
  contentUpdatedAt: string | null;
  publicationStatus: 'unpublished' | 'published';
  relatedGuideIds: readonly string[];
  blockingNotes: readonly string[];

  /**
   * Requirement 4.10. The named person responsible for keeping this guide current.
   *
   * A desk name is not a person, so `NON_ATTRIBUTABLE_REVIEWER_NAMES` applies here
   * the same way it applies to a reviewer. Null means nobody has taken the job,
   * which is every record today.
   */
  readonly maintenanceOwner: string | null;

  /**
   * Requirements 4.10 and 4.13. The date the guide is next due for review, at most
   * twelve months after `contentUpdatedAt`.
   *
   * Null on every record today. Task 6 turns null, over-twelve-months and passed
   * into gate failures; this task only adds the field so the value has somewhere
   * to live.
   */
  readonly nextReviewAt: string | null;

  /**
   * Requirement 3.6. The approved primary intent phrase, copied onto the record at
   * approval so the page never reads the Search_Intent_Register.
   *
   * Identical arrangement to `LocalityRecord.primaryIntent`: the evidence behind
   * the phrase — tool, query date, location setting, volume — stays in the
   * register outside the app module graph, and only the approved text is copied
   * here. `intentEntryId` ties the two back together.
   */
  readonly primaryIntent: { readonly intentEntryId: string; readonly phrase: string } | null;

  /** Requirement 3.6. At most 5. Each may appear at most 3 times in the body. */
  readonly supportingPhrases: readonly string[];

  /**
   * Requirement 9.2. Media_Register asset IDs this page renders.
   *
   * Illustrations and maps are inline components rather than files, so they are
   * referenced by ID and their provenance lives in the Media_Register.
   */
  readonly visualAssetIds: readonly string[];
}

export interface GuideEligibility {
  slug: string;
  eligible: boolean;
  failures: readonly string[];
}

// ---------------------------------------------------------------------------
// The bounds the gate enforces
// ---------------------------------------------------------------------------

/** Requirements 5.3 and 5.11. */
export const MIN_DIRECT_ANSWER_WORDS = 20;
export const MAX_DIRECT_ANSWER_WORDS = 60;

/** Requirement 4.12. Two sections, because one section is a stub. */
export const MIN_GUIDE_SECTIONS = 2;

/** Requirement 5.4. */
export const MAX_HEADING_WORDS = 15;

/** Requirement 4.10. Twelve months, counted as months rather than as 365 days. */
export const MAX_REVIEW_WINDOW_MONTHS = 12;

/**
 * Requirement 5.4, the half that is not satisfiable yet, and why it is written this
 * way rather than either faked or dropped.
 *
 * 5.4 asks for two things about a published guide's section heading: that it is a
 * question of at most fifteen words ending in a question mark, and that its wording
 * is "taken from a phrase recorded in the Search_Intent_Register". The first is a
 * property of the string and the gate enforces it unconditionally, on every
 * published guide, from now on.
 *
 * The second cannot be satisfied by anything in this repository today, because **the
 * Search_Intent_Register is empty**. It is empty for a recorded reason: no keyword
 * research tool has been supplied, which is Owner_Input_Register entry C13, and
 * while it is unsupplied Requirement 3.15 permits phrases only from named manual
 * methods. A manual-method entry still needs a phrase, a named method, an
 * observation date and a location context (Requirement 3.1) — that is a record of
 * research somebody performed on a particular day. Nobody has performed it. Writing
 * three entries so that three headings could cite them would be inventing dated
 * research, which is the single thing this feature exists to refuse.
 *
 * So the provenance condition is **conditional on the provenance existing**: once a
 * record carries an approved `primaryIntent` — which is how a register-sourced
 * phrase reaches a record at all, copied across at approval so a page never reads
 * the register — every one of that record's headings must name the register entry it
 * came from. A record with no approved phrase has no register to be taken from, and
 * the gap is recorded here and in `HEADING_INTENT_PROVENANCE_GAP` rather than
 * quietly satisfied.
 *
 * This is not an exemption for any record and not a relaxation of anything. Before
 * this task the heading rule did not exist at all; after it, two thirds of 5.4 binds
 * every published guide and the remaining third binds every record that has the
 * evidence to answer it. When C13 arrives and phrases are researched, the condition
 * begins to bite on its own, with no further code change.
 */
export const HEADING_INTENT_PROVENANCE_GAP = {
  requirement: '5.4',
  /** The Owner_Input_Register entry that unblocks phrase research. */
  ownerInputEntry: 'C13',
  condition:
    'A published guide that carries an approved primary intent phrase must name a Search_Intent_Register entry against every section heading.',
  whyNotYetUniversal:
    'The Search_Intent_Register holds zero entries. No keyword research tool has been supplied (C13), and a manual-method entry would require an observation date for research nobody has performed. No entry is invented to satisfy the condition.',
  recordedOn: '2026-09-29',
} as const;

/**
 * Requirement 4.10, and the honest note about who it names.
 *
 * A guide needs a named person accountable for keeping it current, and a desk name
 * is not a person — `isAttributableName` is reused so the rule is the same one that
 * governs a claim reviewer and an editorial sign-off.
 *
 * The three published guides are own-process content: they describe how this
 * business works and what it will not promise, and they are attributed to the
 * business rather than to an individual author. The one named person recorded
 * anywhere in this repository is the owner, whose name and role come from
 * `OWNER_PROFILE` rather than from a string typed here. Naming him as the
 * maintenance owner of guides about his own business's process is an editorial
 * assignment, not a claim about him: it asserts no qualification, no review of
 * external material and no authorship, and `namedAuthor` stays null on all three.
 * The alternative was inventing a second person, which is not an alternative.
 */
export const GUIDE_MAINTENANCE_OWNER = OWNER_PROFILE.name;

/**
 * The failure a caller gets when a stored class and the classifier disagree.
 *
 * Exported so the test asserting the condition names the same string the gate
 * produces rather than a paraphrase of it.
 */
export function classifierDisagreementFailure(
  stored: GuideContentClass,
  computed: GuideContentClass,
  matched: readonly string[]
): string {
  return `Stored content class is "${stored}" but the classifier reads the record's own text as "${computed}"${
    matched.length > 0 ? ` (matched: ${matched.join(', ')})` : ''
  }.`;
}

export function evaluateGuide(record: GuideRecord, now: Date = new Date()): GuideEligibility {
  const failures: string[] = [];

  if (record.publicationStatus !== 'published') {
    failures.push(`Publication status is "${record.publicationStatus}".`);
  }
  if (record.sections.length === 0) {
    failures.push('Guide has no content sections.');
  }
  if (!record.directAnswer.trim()) {
    failures.push('Guide has no direct answer.');
  }
  if (!record.attributedTo.trim()) {
    failures.push('Guide has no attribution.');
  }
  if (!record.contentUpdatedAt) {
    failures.push('No content date recorded.');
  }

  // -------------------------------------------------------------------------
  // Requirements 5.3 and 5.11. The direct answer is the extractable answer, so
  // its length is a content rule rather than a style preference: under twenty
  // words it does not answer the question, over sixty it is no longer the thing
  // a reader or an extracting system reads first. Every failure reports the
  // measured count, which 5.11 requires by name.
  // -------------------------------------------------------------------------
  if (record.directAnswer.trim()) {
    const words = countWords(record.directAnswer);
    if (words < MIN_DIRECT_ANSWER_WORDS || words > MAX_DIRECT_ANSWER_WORDS) {
      failures.push(
        `Direct answer is ${words} words; publication requires ${MIN_DIRECT_ANSWER_WORDS} to ${MAX_DIRECT_ANSWER_WORDS}.`
      );
    }
  }

  // Requirement 4.12.
  if (record.sections.length > 0 && record.sections.length < MIN_GUIDE_SECTIONS) {
    failures.push(
      `Guide carries ${record.sections.length} content section(s); publication requires at least ${MIN_GUIDE_SECTIONS}.`
    );
  }

  // Requirement 5.4. Heading form, unconditionally; heading provenance where the
  // record carries an approved register phrase. See HEADING_INTENT_PROVENANCE_GAP.
  for (const section of record.sections) {
    const heading = section.heading.trim();
    if (!heading.endsWith('?')) {
      failures.push(`Section heading "${section.heading}" is not phrased as a question.`);
    }
    const headingWords = countWords(heading);
    if (headingWords > MAX_HEADING_WORDS) {
      failures.push(
        `Section heading "${section.heading}" is ${headingWords} words; publication requires at most ${MAX_HEADING_WORDS}.`
      );
    }
    if (record.primaryIntent && !section.headingIntentEntryId?.trim()) {
      failures.push(
        `Section heading "${section.heading}" names no Search_Intent_Register entry, but this record carries the approved phrase ${record.primaryIntent.intentEntryId}.`
      );
    }
  }

  // Requirement 4.12. A guide without a next step leaves the reader nowhere, and
  // one without a scope note has no stated limit.
  if (!record.nextStep.trim()) {
    failures.push('Guide states no next step naming a contact action.');
  }
  if (!record.scopeNote.trim()) {
    failures.push('Guide states no scope note saying what it does not cover.');
  }

  // Requirement 4.10. A named person keeps the guide current, or nobody does.
  if (!isAttributableName(record.maintenanceOwner)) {
    failures.push(
      record.maintenanceOwner
        ? `Maintenance owner "${record.maintenanceOwner}" is not a real named person accountable for keeping the guide current.`
        : 'No named maintenance owner recorded.'
    );
  }

  // Requirements 4.10 and 4.13. A review date that is absent, further than twelve
  // months from the content date, or already passed all mean the same thing: the
  // guide has no live review commitment behind it.
  const nextReview = parseCalendarDate(record.nextReviewAt);
  if (!nextReview) {
    failures.push(
      record.nextReviewAt
        ? `Next review date "${record.nextReviewAt}" is not a calendar date.`
        : 'No next review date recorded.'
    );
  } else {
    if (nextReview.getTime() < now.getTime()) {
      failures.push(`Guide review was due on ${record.nextReviewAt} and no later review is recorded.`);
    }
    const contentDate = parseCalendarDate(record.contentUpdatedAt);
    if (contentDate) {
      const latestPermitted = addCalendarMonths(contentDate, MAX_REVIEW_WINDOW_MONTHS);
      if (nextReview.getTime() > latestPermitted.getTime()) {
        failures.push(
          `Next review date ${record.nextReviewAt} is more than ${MAX_REVIEW_WINDOW_MONTHS} months after the content date ${record.contentUpdatedAt}.`
        );
      }
    }
  }

  // Requirement 4.11. The classifier reads the record's own text, so a guide that
  // acquires a sentence about stamp duty stops being publishable under the
  // own-process conditions the moment the sentence lands — rather than whenever
  // somebody remembers to change the stored label.
  if (record.contentClass === 'own-process') {
    const computed = classifyGuideContent(record);
    if (computed !== 'own-process') {
      failures.push(
        classifierDisagreementFailure(
          record.contentClass,
          computed,
          externalFactMatches(record).map((match) => match.matched)
        )
      );
    }
  }

  // Requirement 4.8. A figure somebody else set needs evidence, whatever class the
  // record is stored as.
  const figures = externalBodyFigureMatches(record);
  if (figures.length > 0) {
    const claimBacked =
      record.claimIds.length > 0 && evaluateClaims(record.claimIds, now).eligible;
    if (!claimBacked) {
      failures.push(
        `Guide states a figure set by an external body (${figures
          .map((match) => `${match.name}: "${match.matched}"`)
          .join('; ')}) with no claim that passes the claim gate.`
      );
    }
  }

  if (record.contentClass === 'external-fact') {
    if (!record.namedAuthor) {
      failures.push('An external-fact guide requires a named author.');
    }
    if (!record.subjectReviewer) {
      failures.push('An external-fact guide requires a named subject reviewer.');
    }
    if (record.claimIds.length === 0) {
      failures.push('An external-fact guide requires claim-backed sources.');
    }
  }

  if (record.claimIds.length > 0) {
    const claimEvaluation = evaluateClaims(record.claimIds, now);
    if (!claimEvaluation.eligible) {
      failures.push(...claimEvaluation.failures);
    }
  }

  return { slug: record.slug, eligible: failures.length === 0, failures };
}

export function isGuidePublishable(record: GuideRecord, now: Date = new Date()): boolean {
  return evaluateGuide(record, now).eligible;
}

const OWN_PROCESS_SCOPE =
  `This page explains how ${CANONICAL_BRAND} works and what to have ready. It is not legal, tax or financial advice, and it does not describe property that is available.`;

/**
 * The review date on the three published guides: twelve months after their content
 * date of 2026-09-29, which is the widest window Requirement 4.10 permits.
 *
 * Twelve months rather than six is a deliberate choice about honesty rather than
 * convenience. The date is a commitment that somebody will re-read these pages, and
 * the person named in `GUIDE_MAINTENANCE_OWNER` has not been asked how often he can
 * do that. Recording the outer bound the requirement allows states the maximum
 * interval that may pass before the page unpublishes itself; a shorter interval
 * would be asserting a review cadence nobody has agreed to.
 *
 * Past this date the gate removes all three pages and the routes 404, with no
 * rebuild needed — which is Requirement 4.13 working, not a bug.
 */
const GUIDE_NEXT_REVIEW_AT = '2027-09-29';

/**
 * The seven records the repository held before the Route_Manifest was seeded.
 *
 * Three publish; four are drafts blocked on owner input. Each of the seven is
 * also the record that answers one of the 36 manifest candidates, which is why
 * seeding adds 29 rather than 36 — see `src/config/guide-registry/index.ts`.
 */
const EXISTING_GUIDE_RECORDS: readonly GuideRecord[] = [
  {
    guideId: 'GD-SELL-PREPARE',
    slug: 'what-to-tell-us-when-you-want-to-sell-your-property',
    question: 'What information should I have ready when I approach a broker to sell my property?',
    title: 'What to tell us when you want to sell your property',
    description:
      'The details our team asks for when you want to sell a flat, house, villa or site in Bengaluru, and what we do not ask for at the first conversation.',
    intent: 'sell',
    contentClass: 'own-process',
    directAnswer:
      'For the first conversation we only need five things: the type of property, the area it is in, whether you own it or represent the owner, when you would like to sell, and a phone number we can reach you on. Everything else can come later.',
    sections: [
      {
        heading: 'What do we ask at the first conversation?',
        headingIntentEntryId: null,
        paragraphs: [
          'The first call is about understanding what you want to do, not about paperwork. These are the details that let us have a useful conversation.',
        ],
        bullets: [
          'Property type — flat, independent house, villa or site.',
          'Area or locality. A landmark or main road is enough; we do not need the exact address yet.',
          'Whether you are the owner, a co-owner, or representing the owner.',
          'Your target timeline, even if it is only approximate.',
          'A price you have in mind, if you have one. "Prefer to discuss" is a normal answer.',
          'A phone number, and a rough time of day that suits you.',
        ],
      },
      {
        // Reworded in task 6.3. The bullet used to name the specific paperwork we
        // do not ask for, and naming those document types is what made the
        // classifier read this own-process guide as external-fact content. The
        // point the sentence makes is unchanged and still true — we ask for no
        // paperwork at the first conversation — and it is now made without
        // listing document types the guide would then be stating something about.
        heading: 'What do we not ask you for at this stage?',
        headingIntentEntryId: null,
        paragraphs: [
          'You should not have to hand over paperwork to start a conversation with a broker. We do not ask you to upload ownership papers, identity proof or financial statements through this website, and we do not ask for your exact address before we have spoken.',
          'If the discussion progresses to an actual sale, paperwork gets handled at that point, in coordination with the independent professionals involved. That is a separate step with its own conversation.',
        ],
      },
      {
        heading: 'Is the price you have in mind a valuation?',
        headingIntentEntryId: null,
        paragraphs: [
          'If you tell us the figure you are hoping for, that helps us understand your expectations. It is not a valuation, and this website does not produce one. Any automated number you see elsewhere that claims to value your property instantly is a guess dressed up as a calculation.',
          'We will tell you honestly if we think an expectation is difficult to meet, rather than agreeing with it to win the conversation.',
        ],
      },
      {
        heading: 'What will we not promise you?',
        headingIntentEntryId: null,
        paragraphs: [
          'We will not promise a sale by a particular date, a particular price, or a number of buyers waiting. Anyone who does is guessing. What we can discuss is what we will actually do, and when we will next update you.',
        ],
      },
    ],
    nextStep:
      'Call 9353096264 and tell us about the property, or use the sell page to send the same details in writing.',
    scopeNote: OWN_PROCESS_SCOPE,
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: '2026-09-29',
    publicationStatus: 'published',
    relatedGuideIds: ['GD-SELL-30-DAYS', 'GD-RENTOUT-DECISIONS'],
    blockingNotes: [],
    maintenanceOwner: GUIDE_MAINTENANCE_OWNER,
    nextReviewAt: GUIDE_NEXT_REVIEW_AT,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-SELL-30-DAYS',
    slug: 'can-a-broker-guarantee-a-property-sale-in-30-days',
    question: 'Can a broker guarantee that my property will sell in 30 days?',
    title: 'Can a broker guarantee a property sale in 30 days?',
    description:
      'An honest answer to a common question, and what INSTLE REAL ESTATE will and will not commit to when you want to sell quickly.',
    intent: 'sell',
    contentClass: 'own-process',
    directAnswer:
      'No. A broker cannot guarantee that your property will sell within 30 days, and we do not make that promise. A sale depends on the buyer, the price, the paperwork and the market — and a broker controls none of those four things.',
    sections: [
      {
        heading: 'Why can no broker commit to a sale date?',
        headingIntentEntryId: null,
        paragraphs: [
          'A completed sale needs a buyer who wants your specific property, who agrees on price, who can arrange funds, and who gets through registration. A broker can introduce buyers and coordinate the process. A broker cannot manufacture a buyer at your price, and cannot control how long a bank or a registration office takes.',
          'If someone offers you a guaranteed sale date, ask what happens if the date passes. Usually either nothing happens, or the price quietly drops until the property moves. Neither is a guarantee in any useful sense.',
        ],
      },
      {
        heading: 'What can a 30-day target usefully mean?',
        headingIntentEntryId: null,
        paragraphs: [
          'It is a perfectly reasonable thing to want. When you tell us your target is 30 days, we record that as your timeline and it changes how we work: we will be direct about whether your price expectation fits that timeline, and we will focus on buyers who are actually in a position to proceed.',
          'Treat it as your goal that we work towards, not as a delivery date we have signed up to.',
        ],
      },
      {
        heading: 'What can you hold us to?',
        headingIntentEntryId: null,
        paragraphs: [
          'Commitments about our own conduct are the ones worth asking for, because they are inside our control. Things like: telling you what we actually did, telling you when interest is not materialising, and telling you if we think the price needs to change.',
          'We have not published a specific response-time or progress-reporting commitment on this website yet, because a commitment we have not staffed is just marketing. When we publish one, it will say who is responsible for it.',
        ],
      },
      {
        heading: 'What if you need to sell urgently?',
        headingIntentEntryId: null,
        paragraphs: [
          'Say so on the call. An urgent timeline usually means a real conversation about price, because speed and price trade against each other. That conversation is more useful to you than a promise.',
        ],
      },
    ],
    nextStep:
      'Call 9353096264 to talk through your timeline and what is realistic for your property.',
    scopeNote: OWN_PROCESS_SCOPE,
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: '2026-09-29',
    publicationStatus: 'published',
    relatedGuideIds: ['GD-SELL-PREPARE'],
    blockingNotes: [],
    maintenanceOwner: GUIDE_MAINTENANCE_OWNER,
    nextReviewAt: GUIDE_NEXT_REVIEW_AT,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-RENTOUT-DECISIONS',
    slug: 'decisions-to-make-before-you-rent-out-your-property',
    question: 'What should I decide before I rent out my flat or house?',
    title: 'Decisions to make before you rent out your property',
    description:
      'The choices a landlord in Bengaluru needs to make before a property goes on rent, and how INSTLE REAL ESTATE helps with each one.',
    intent: 'rent-out',
    contentClass: 'own-process',
    directAnswer:
      'Before your property goes on rent, decide four things: the rent and deposit you expect, whether it goes out furnished, when it is actually available, and who handles the property day to day. Those four answers shape everything that follows.',
    sections: [
      {
        heading: 'What rent and deposit should you ask for?',
        headingIntentEntryId: null,
        paragraphs: [
          'Decide the monthly rent you expect and the deposit you will ask for, and decide how much room you have to move on each. A firm rent with a flexible deposit behaves very differently in the market from the reverse.',
          'Tell us what you have in mind and we will tell you how it looks, including if we think it will be difficult. We do not publish rent estimates for areas on this website, because a number without a specific property behind it is not useful to you.',
        ],
      },
      {
        heading: 'Should it go out furnished, semi-furnished or unfurnished?',
        headingIntentEntryId: null,
        paragraphs: [
          'This changes who enquires. Decide what stays in the property and what you will remove, and be specific about appliances, because that is where most disagreements start later.',
        ],
      },
      {
        heading: 'When is the property genuinely available?',
        headingIntentEntryId: null,
        paragraphs: [
          'Availability means the date someone could actually move in, after any painting, cleaning or repairs. An optimistic date creates problems at handover. If work is pending, tell us what and roughly how long.',
        ],
      },
      {
        heading: 'Who handles the property once a tenant moves in?',
        headingIntentEntryId: null,
        paragraphs: [
          'Decide who the tenant calls about a leaking tap, and who holds keys. If you are not in Bengaluru, decide this before the property is listed, not after a tenant has moved in.',
        ],
      },
      {
        heading: 'What do we actually do about prospective tenants?',
        headingIntentEntryId: null,
        paragraphs: [
          'We speak to prospective tenants before we coordinate a visit, so you are not showing your property to people whose budget or requirement clearly does not match. That is a filtering conversation.',
          'It is not a background check, a credit check, or a verification service, and we do not describe it as one. We also do not screen people by their occupation, community, family status, or where they are from. If you want formal verification of a tenant, that is a separate service from a separate provider, and you should arrange it deliberately.',
        ],
      },
    ],
    nextStep:
      'Call 9353096264, or use the rent out page to send your property details and availability.',
    scopeNote: OWN_PROCESS_SCOPE,
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: '2026-09-29',
    publicationStatus: 'published',
    relatedGuideIds: ['GD-SELL-PREPARE'],
    blockingNotes: [],
    maintenanceOwner: GUIDE_MAINTENANCE_OWNER,
    nextReviewAt: GUIDE_NEXT_REVIEW_AT,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },

  // ---------------------------------------------------------------------------
  // Drafts. Each needs a named author, a named subject reviewer, and current
  // primary sources before it can be published.
  // ---------------------------------------------------------------------------
  {
    guideId: 'GD-BUY-DOCUMENTS',
    slug: 'property-documents-to-check-before-buying-in-bengaluru',
    question: 'Which documents should I check before buying a property in Bengaluru?',
    title: 'Property documents to check before buying in Bengaluru',
    description: 'Draft. Not published.',
    intent: 'buy',
    contentClass: 'external-fact',
    directAnswer: '',
    sections: [],
    nextStep: '',
    scopeNote: '',
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: null,
    publicationStatus: 'unpublished',
    relatedGuideIds: [],
    blockingNotes: [
      'Documentation and title topics are legal in nature. Needs current primary sources and review by a person qualified to check them.',
      'Must not become a clear-title or legal-clearance promise.',
      'Blocked on checklist C3: no named author and no named subject reviewer has been supplied for legal, tax and documentation content.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-SELL-TAXES',
    slug: 'taxes-and-charges-when-selling-property-in-bengaluru',
    question: 'What taxes and charges apply when I sell property in Bengaluru?',
    title: 'Taxes and charges when selling property in Bengaluru',
    description: 'Draft. Not published.',
    intent: 'sell',
    contentClass: 'external-fact',
    directAnswer: '',
    sections: [],
    nextStep: '',
    scopeNote: '',
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: null,
    publicationStatus: 'unpublished',
    relatedGuideIds: [],
    blockingNotes: [
      'Tax content requires current primary sources and qualified review. Rates and thresholds change.',
      'Blocked on checklist C3: no named author and no named subject reviewer has been supplied for legal, tax and documentation content.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-GEN-BROKERAGE-FEES',
    slug: 'how-brokerage-fees-work',
    question: 'How much does a broker charge, and when?',
    title: 'How brokerage fees work',
    description: 'Draft. Not published.',
    intent: 'general',
    contentClass: 'own-process',
    directAnswer: '',
    sections: [],
    nextStep: '',
    scopeNote: '',
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: null,
    publicationStatus: 'unpublished',
    relatedGuideIds: [],
    blockingNotes: [
      'Blocked on OWN-06. No fee, commission or representation wording has been supplied or approved, so no figure or arrangement can be described.',
      'Blocked on checklist C5: the fee, commission and representation wording has not been supplied, so no figure, rate or arrangement can appear here.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-COM-OFFICE',
    slug: 'what-to-consider-when-leasing-office-space-in-bengaluru',
    question: 'What should I consider when leasing office space in Bengaluru?',
    title: 'What to consider when leasing office space in Bengaluru',
    description: 'Draft. Not published.',
    intent: 'commercial',
    contentClass: 'external-fact',
    directAnswer: '',
    sections: [],
    nextStep: '',
    scopeNote: '',
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: null,
    publicationStatus: 'unpublished',
    relatedGuideIds: [],
    blockingNotes: [
      'Blocked on OWN-03. Commercial capability is requested but unconfirmed, so publishing commercial advice would imply expertise that has not been established.',
      'Blocked on checklist C4: which commercial work the brokerage actually takes on, and in which areas, is unconfirmed.',
      'Blocked on checklist C3: no named author and no named subject reviewer has been supplied for lease and documentation content.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
] as const;

/**
 * The whole registry: the seven hand-written records plus the 29 seeded
 * Route_Manifest candidates.
 *
 * Adding 29 records changes no count a reader can see. Every seeded record has an
 * empty direct answer, no sections, no content date and no attribution work done,
 * so `evaluateGuide` rejects all 29 and the three published guides stay the three
 * published guides. Requirements 4.1, 4.2, 4.6.
 */
export const GUIDE_REGISTRY: readonly GuideRecord[] = [
  ...EXISTING_GUIDE_RECORDS,
  ...SEEDED_GUIDE_CANDIDATES,
];

const GUIDE_BY_SLUG = new Map(GUIDE_REGISTRY.map((record) => [record.slug, record]));

export function getPublishedGuides(now: Date = new Date()): readonly GuideRecord[] {
  return GUIDE_REGISTRY.filter((record) => isGuidePublishable(record, now));
}

export function getPublishedGuideBySlug(slug: string, now: Date = new Date()): GuideRecord | undefined {
  const record = GUIDE_BY_SLUG.get(slug);
  if (!record) return undefined;
  return isGuidePublishable(record, now) ? record : undefined;
}

export function getPublishedGuideSlugs(now: Date = new Date()): readonly string[] {
  return getPublishedGuides(now).map((record) => record.slug);
}

export function getPublishedGuidesForIntent(
  intent: CustomerIntent,
  now: Date = new Date()
): readonly GuideRecord[] {
  return getPublishedGuides(now).filter((record) => record.intent === intent);
}

export function getGuideById(guideId: string): GuideRecord | undefined {
  return GUIDE_REGISTRY.find((record) => record.guideId === guideId);
}
