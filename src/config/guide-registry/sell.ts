/**
 * Seeded guide candidates — customer intent "sell".
 *
 * GENERATED FILE. Edit `scripts/seed-guide-candidates.mjs` and re-run it rather
 * than editing this file; `tests/guide-seeding.test.ts` fails on drift between the
 * two.
 *
 * 2 candidates from the `guide` family of
 * `docs/seo-launch-handoff/ROUTE-MANIFEST.csv`. Every record is unpublished with an
 * empty direct answer, no sections and no content date, so none can pass
 * `evaluateGuide` and none reaches a reader. Requirements 4.1, 4.2, 4.6.
 */

import { CANONICAL_BRAND } from '@/config/constants';
import type { GuideRecord } from '@/config/guides';

export const SELL_GUIDE_CANDIDATES: readonly GuideRecord[] = [
  {
    guideId: 'GD-PAGE-042',
    slug: 'what-happens-when-you-list-a-flat-for-sale',
    question: 'How to Prepare to Sell a Flat in Bengaluru?',
    title: 'How to Prepare to Sell a Flat in Bengaluru',
    description: 'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.',
    intent: 'sell',
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
      'Route_Manifest candidate PAGE-042 (/guides/sell-flat-bengaluru), priority P2. Working title and working question are the manifest\'s proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).',
      'No guide text has been written: empty direct answer, no sections, no next step, no scope note, no content date. The record exists so the candidate is accounted for, not so it can be read.',
      'Renamed at seeding under Requirement 4.9: the manifest slug "sell-flat-bengaluru" differs from "buy-flat-bengaluru" only by a intent word, which is the doorway pattern. Seeded as "what-happens-when-you-list-a-flat-for-sale", which names the question instead.',
      'No maintenance owner and no next review date recorded (Requirement 4.10, checklist C2), so nobody is yet responsible for keeping this current.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-PAGE-061',
    slug: 'owner-privacy-during-sale',
    question: 'Discussing Privacy During a Property Sale?',
    title: 'Discussing Privacy During a Property Sale',
    description: 'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.',
    intent: 'sell',
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
      'Route_Manifest candidate PAGE-061 (/guides/owner-privacy-during-sale), priority P2. Working title and working question are the manifest\'s proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).',
      'No guide text has been written: empty direct answer, no sections, no next step, no scope note, no content date. The record exists so the candidate is accounted for, not so it can be read.',
      'No maintenance owner and no next review date recorded (Requirement 4.10, checklist C2), so nobody is yet responsible for keeping this current.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
];
