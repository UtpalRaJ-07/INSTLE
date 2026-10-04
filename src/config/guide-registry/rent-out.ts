/**
 * Seeded guide candidates — customer intent "rent-out".
 *
 * GENERATED FILE. Edit `scripts/seed-guide-candidates.mjs` and re-run it rather
 * than editing this file; `tests/guide-seeding.test.ts` fails on drift between the
 * two.
 *
 * 1 candidate from the `guide` family of
 * `docs/seo-launch-handoff/ROUTE-MANIFEST.csv`. Every record is unpublished with an
 * empty direct answer, no sections and no content date, so none can pass
 * `evaluateGuide` and none reaches a reader. Requirements 4.1, 4.2, 4.6.
 */

import { CANONICAL_BRAND } from '@/config/constants';
import type { GuideRecord } from '@/config/guides';

export const RENT_OUT_GUIDE_CANDIDATES: readonly GuideRecord[] = [
  {
    guideId: 'GD-PAGE-059',
    slug: 'landlord-first-enquiry',
    question: 'What to Share in a Landlord Enquiry?',
    title: 'What to Share in a Landlord Enquiry',
    description: 'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.',
    intent: 'rent-out',
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
      'Route_Manifest candidate PAGE-059 (/guides/landlord-first-enquiry), priority P2. Working title and working question are the manifest\'s proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).',
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
