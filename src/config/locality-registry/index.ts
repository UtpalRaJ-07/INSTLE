/**
 * The seeded locality candidate registry.
 *
 * GENERATED FILE. Edit `scripts/seed-locality-candidates.mjs` and re-run it
 * rather than editing this file; `tests/locality-seeding.test.ts` fails on drift
 * between the two.
 *
 * 127 records, split by research group so no generated file is too large to
 * review:
 *
 *   Central                 19
 *   North and north-east    31
 *   East                    22
 *   South and south-east    27
 *   West and south-west     18
 *   Outer-place             10
 *
 * Five of the 132 backlog candidates are deliberately absent. Each collides with a
 * record already in the registry and is held as an open entity-boundary decision
 * rather than seeded or deleted, so the candidate accounting still sums:
 * 127 seeded + 5 held + 5 existing = 132. Requirement 1.15.
 */

import { CENTRAL_LOCALITY_CANDIDATES } from './central';
import { NORTH_AND_NORTH_EAST_LOCALITY_CANDIDATES } from './north-and-north-east';
import { EAST_LOCALITY_CANDIDATES } from './east';
import { SOUTH_AND_SOUTH_EAST_LOCALITY_CANDIDATES } from './south-and-south-east';
import { WEST_AND_SOUTH_WEST_LOCALITY_CANDIDATES } from './west-and-south-west';
import { OUTER_PLACE_LOCALITY_CANDIDATES } from './outer-place';

import type { LocalityRecord } from '@/config/localities';

export const SEEDED_LOCALITY_CANDIDATES: readonly LocalityRecord[] = [
  ...CENTRAL_LOCALITY_CANDIDATES,
  ...NORTH_AND_NORTH_EAST_LOCALITY_CANDIDATES,
  ...EAST_LOCALITY_CANDIDATES,
  ...SOUTH_AND_SOUTH_EAST_LOCALITY_CANDIDATES,
  ...WEST_AND_SOUTH_WEST_LOCALITY_CANDIDATES,
  ...OUTER_PLACE_LOCALITY_CANDIDATES,
] as const;
