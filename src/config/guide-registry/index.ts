/**
 * The seeded guide candidate registry.
 *
 * GENERATED FILE. Edit `scripts/seed-guide-candidates.mjs` and re-run it rather
 * than editing this file; `tests/guide-seeding.test.ts` fails on drift between the
 * two.
 *
 * 29 records, split by customer intent so no generated file is too large to
 * review:
 *
 *   buy            6
 *   sell           2
 *   rent           4
 *   rent-out       1
 *   commercial     3
 *   general       13
 *
 * 7 of the 36 manifest candidates are deliberately absent. Each asks a
 * question a record already in the registry answers, so Requirement 3.5 keeps the
 * existing route as the only destination rather than creating a second URL for a
 * wording variation:
 *
 *   PAGE-046  seller-readiness-checklist   -> GD-SELL-PREPARE
 *   PAGE-047  seller-timeline-planning     -> GD-SELL-30-DAYS
 *   PAGE-049  brokerage-fees-questions     -> GD-GEN-BROKERAGE-FEES
 *   PAGE-058  rent-out-flat-bengaluru      -> GD-RENTOUT-DECISIONS
 *   PAGE-063  property-document-questions  -> GD-BUY-DOCUMENTS
 *   PAGE-067  property-tax-questions       -> GD-SELL-TAXES
 *   PAGE-073  office-lease-questions       -> GD-COM-OFFICE
 *
 * That makes both sums land on 36: 29 seeded + 7 served elsewhere = 36 manifest
 * candidates, and 29 seeded + 7 existing records = 36 registry records.
 */

import { BUY_GUIDE_CANDIDATES } from './buy';
import { SELL_GUIDE_CANDIDATES } from './sell';
import { RENT_GUIDE_CANDIDATES } from './rent';
import { RENT_OUT_GUIDE_CANDIDATES } from './rent-out';
import { COMMERCIAL_GUIDE_CANDIDATES } from './commercial';
import { GENERAL_GUIDE_CANDIDATES } from './general';

import type { GuideRecord } from '@/config/guides';

export const SEEDED_GUIDE_CANDIDATES: readonly GuideRecord[] = [
  ...BUY_GUIDE_CANDIDATES,
  ...SELL_GUIDE_CANDIDATES,
  ...RENT_GUIDE_CANDIDATES,
  ...RENT_OUT_GUIDE_CANDIDATES,
  ...COMMERCIAL_GUIDE_CANDIDATES,
  ...GENERAL_GUIDE_CANDIDATES,
];
