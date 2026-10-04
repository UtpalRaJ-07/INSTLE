/**
 * Seeded guide candidates — customer intent "commercial".
 *
 * GENERATED FILE. Edit `scripts/seed-guide-candidates.mjs` and re-run it rather
 * than editing this file; `tests/guide-seeding.test.ts` fails on drift between the
 * two.
 *
 * 3 candidates from the `guide` family of
 * `docs/seo-launch-handoff/ROUTE-MANIFEST.csv`. Every record is unpublished with an
 * empty direct answer, no sections and no content date, so none can pass
 * `evaluateGuide` and none reaches a reader. Requirements 4.1, 4.2, 4.6.
 */

import { CANONICAL_BRAND } from '@/config/constants';
import type { GuideRecord } from '@/config/guides';

export const COMMERCIAL_GUIDE_CANDIDATES: readonly GuideRecord[] = [
  {
    guideId: 'GD-PAGE-072',
    slug: 'commercial-requirement-checklist',
    question: 'Sharing a Commercial Property Requirement?',
    title: 'Sharing a Commercial Property Requirement',
    description: 'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.',
    intent: 'commercial',
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
      'Route_Manifest candidate PAGE-072 (/guides/commercial-requirement-checklist), priority P2. Working title and working question are the manifest\'s proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).',
      'No guide text has been written: empty direct answer, no sections, no next step, no scope note, no content date. The record exists so the candidate is accounted for, not so it can be read.',
      'Blocked on checklist C4: which commercial work the brokerage actually takes on, and in which areas, is unconfirmed. Publishing commercial guidance would imply capability that has not been established.',
      'No maintenance owner and no next review date recorded (Requirement 4.10, checklist C2), so nobody is yet responsible for keeping this current.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-PAGE-074',
    slug: 'shop-showroom-requirement',
    question: 'Preparing a Shop or Showroom Requirement?',
    title: 'Preparing a Shop or Showroom Requirement',
    description: 'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.',
    intent: 'commercial',
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
      'Route_Manifest candidate PAGE-074 (/guides/shop-showroom-requirement), priority P2. Working title and working question are the manifest\'s proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).',
      'No guide text has been written: empty direct answer, no sections, no next step, no scope note, no content date. The record exists so the candidate is accounted for, not so it can be read.',
      'Blocked on checklist C4: which commercial work the brokerage actually takes on, and in which areas, is unconfirmed. Publishing commercial guidance would imply capability that has not been established.',
      'No maintenance owner and no next review date recorded (Requirement 4.10, checklist C2), so nobody is yet responsible for keeping this current.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
  {
    guideId: 'GD-PAGE-075',
    slug: 'warehouse-requirement-questions',
    question: 'Questions to Raise for Warehouse Requirements?',
    title: 'Questions to Raise for Warehouse Requirements',
    description: 'Seeded Route_Manifest candidate. No guide text has been written from verified evidence yet.',
    intent: 'commercial',
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
      'Route_Manifest candidate PAGE-075 (/guides/warehouse-requirement-questions), priority P2. Working title and working question are the manifest\'s proposed title; no customer question has been researched, because no keyword research tool has been supplied and the Search_Intent_Register is empty (Requirement 3.7).',
      'No guide text has been written: empty direct answer, no sections, no next step, no scope note, no content date. The record exists so the candidate is accounted for, not so it can be read.',
      'Blocked on checklist C4: which commercial work the brokerage actually takes on, and in which areas, is unconfirmed. Publishing commercial guidance would imply capability that has not been established.',
      'No maintenance owner and no next review date recorded (Requirement 4.10, checklist C2), so nobody is yet responsible for keeping this current.',
    ],
    maintenanceOwner: null,
    nextReviewAt: null,
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
  },
];
