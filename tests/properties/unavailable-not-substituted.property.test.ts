import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  KEYWORD_RESEARCH_TOOL_LICENCE,
  VOLUME_REQUERY_MAX_DAYS,
  evaluateIntentEntry,
  evaluateManualMethodOnlyMode,
  evaluateVolume,
  type KeywordToolLicence,
} from '@internal/registers/search-intent';
import { evaluateObservationEntry } from '@internal/registers/observation';
import { differenceInCalendarDays, parseCalendarDate } from '@/lib/calendar-dates';

import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbIntentEntryWithVolume,
  arbObservationEntry,
} from './arbitraries';

// Feature: seo-content-and-bengaluru-identity, Property 8: A value that cannot be
// evidenced is recorded unavailable with a reason, never substituted

/**
 * **Validates: Requirements 3.2, 3.3, 3.15, 7.11, 13.10**
 *
 * The property has three halves, which is one more than a half but each is the
 * same statement seen from a different register:
 *
 *  1. A keyword volume is available exactly when every Requirement 3.2 attribute
 *     is recorded and the re-query date has not passed. When it is unavailable the
 *     result carries a reason and **no figure key at all** — there is nothing for a
 *     caller to read as an approximation, which is stronger than returning zero.
 *  2. The phrase entry survives its figure going unavailable (Requirement 3.3),
 *     and while no tool licence is recorded every figure is unavailable however
 *     completely it was recorded (Requirement 3.15).
 *  3. An observation field recorded unavailable carries a reason and no value
 *     (Requirement 7.11), and a blank reason is reported as a missing field rather
 *     than accepted as an explanation.
 *
 * Requirement 13.10 states the same rule for a traffic, lead or conversion figure
 * in the progress report. The report is built in a later task; this file is where
 * that check joins, because the rule is identical and should not be restated.
 *
 * The figure generator emits fractional values on purpose. A rounding branch is
 * invisible to an integer generator, and `Object.is` on the returned figure is what
 * proves no branch exists.
 */

const LICENCE_SUPPLIED: KeywordToolLicence = { supplied: true, ownerInputEntry: 'C13' };

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

describe('Property 8: an unevidenced value is recorded unavailable with a reason', () => {
  it('never substitutes a figure for an unavailable keyword volume', () => {
    fc.assert(
      fc.property(arbIntentEntryWithVolume, (entry) => {
        const availability = evaluateVolume(entry, PROPERTY_NOW, LICENCE_SUPPLIED);
        const volume = entry.volume;

        // What the recording itself says, computed independently of the register.
        const queriedOn = volume ? parseCalendarDate(volume.queriedOn) : null;
        const reQueryBy = volume ? parseCalendarDate(volume.reQueryBy) : null;
        const windowDays =
          queriedOn && reQueryBy ? differenceInCalendarDays(reQueryBy, queriedOn) : null;

        const shouldBeAvailable =
          volume !== null &&
          !isBlank(volume.toolName) &&
          queriedOn !== null &&
          !isBlank(volume.toolSettings.locationSetting) &&
          !isBlank(volume.toolSettings.languageSetting) &&
          !isBlank(volume.toolSettings.dateRangeApplied) &&
          reQueryBy !== null &&
          windowDays !== null &&
          windowDays >= 0 &&
          windowDays <= VOLUME_REQUERY_MAX_DAYS &&
          PROPERTY_NOW.getTime() < reQueryBy.getTime() &&
          Number.isFinite(volume.figure);

        expect(availability.available).toBe(shouldBeAvailable);

        if (availability.available) {
          // Recorded exactly as recorded: no rounding, no coercion.
          expect(Object.is(availability.figure, volume?.figure)).toBe(true);
        } else {
          expect(availability.reason.trim().length).toBeGreaterThan(0);
          // Nothing an optimistic caller could read as the number.
          expect(Object.keys(availability).sort()).toEqual(['available', 'reason']);
          expect('figure' in availability).toBe(false);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('retains the phrase entry for editorial use when its figure is unavailable', () => {
    fc.assert(
      fc.property(arbIntentEntryWithVolume, (entry) => {
        const availability = evaluateVolume(entry, PROPERTY_NOW, LICENCE_SUPPLIED);
        if (availability.available) return;
        // Requirement 3.3: the figure goes, the entry stays.
        expect(evaluateIntentEntry(entry)).toEqual({ usable: true, missingFields: [] });
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('records every figure unavailable while no keyword research tool licence is recorded', () => {
    fc.assert(
      fc.property(arbIntentEntryWithVolume, (entry) => {
        const availability = evaluateVolume(entry, PROPERTY_NOW);
        expect(availability.available).toBe(false);
        expect(availability.available === false && availability.reason).toContain(
          KEYWORD_RESEARCH_TOOL_LICENCE.ownerInputEntry
        );

        // And the register-wide rule agrees: a tool-sourced entry or a recorded
        // volume is a recording that should not exist yet.
        const compliance = evaluateManualMethodOnlyMode([entry]);
        const expectedFailures =
          (entry.source.kind === 'tool' ? 1 : 0) + (entry.volume !== null ? 1 : 0);
        expect(compliance.failures).toHaveLength(expectedFailures);
        expect(compliance.compliant).toBe(expectedFailures === 0);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('records an undeterminable observation field with a reason and no value', () => {
    fc.assert(
      fc.property(arbObservationEntry, (entry) => {
        const determinedFields = [
          ['citedUrl', entry.citedUrl],
          ['brandStringMatchesExactly', entry.brandStringMatchesExactly],
          ['phoneMatchesExactly', entry.phoneMatchesExactly],
        ] as const;

        const evaluation = evaluateObservationEntry(entry);

        for (const [name, field] of determinedFields) {
          if (field.available) {
            // A determined field carries a value and no reason to explain away.
            expect(Object.keys(field).sort()).toEqual(['available', 'value']);
            expect(evaluation.missingFields).not.toContain(`${name}.reason`);
          } else {
            expect(Object.keys(field).sort()).toEqual(['available', 'reason']);
            expect('value' in field).toBe(false);
            // A blank reason is not an explanation; the field is named as absent.
            expect(evaluation.missingFields.includes(`${name}.reason`)).toBe(isBlank(field.reason));
          }
        }

        if (!entry.mentioned.applicable) {
          expect(entry.mentioned.reason.trim().length).toBeGreaterThan(0);
          expect('result' in entry.mentioned).toBe(false);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});
