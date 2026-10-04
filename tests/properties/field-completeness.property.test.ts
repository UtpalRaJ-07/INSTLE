import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { VISUAL_ASSET_REGISTER, evaluateAsset, type VisualAssetRecord } from '@/config/media-register';
import { evaluateObservationEntry, type ObservationEntry } from '@internal/registers/observation';
import { evaluatePostcodePair, type PostcodePair } from '@internal/registers/postcode-pairs';
import {
  evaluateCompetitorObservation,
  evaluateIntentEntry,
  type CompetitorObservation,
  type SearchIntentEntry,
} from '@internal/registers/search-intent';

import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbCompetitorObservation,
  arbCompleteIntentEntry,
  arbCompleteObservationEntry,
  arbPostcodePair,
  arbVisualAsset,
} from './arbitraries';

// Feature: seo-content-and-bengaluru-identity, Property 9: A record is usable only
// when every field its type requires is present, and the failure names each absent
// field

/**
 * **Validates: Requirements 3.1, 3.8, 3.13, 7.2, 8.11, 9.1, 9.13, 9.14, 9.16, 10.1,
 * 10.2, 10.3, 12.4**
 *
 * The shape of every case below is the same, and it is the shape that makes the
 * property worth more than a matrix of unit tests: take a complete record, remove a
 * **random subset** of the fields its type requires, and assert two things at once —
 * the record is usable exactly when the subset is empty, and the failure list names
 * every field in the subset. A summary reason passes the first assertion and fails
 * the second, which is precisely the failure mode the requirement is written against.
 *
 * The required-field lists here are written independently of the implementation. If
 * `evaluateIntentEntry` stopped checking a field, the record would come back usable
 * with the field blank and the property would fail — which is the point of not
 * importing the implementation's own list.
 *
 * Two clauses of Property 9 are not reachable yet. The rendering clause — an asset
 * renders its recorded dimensions and either its alt text or an empty alt attribute,
 * and a nearby link renders its claim-backed statement in the same list item — needs
 * the components built in task 8, and the last assertion below states the part that
 * is true today: no photograph is recorded at all, so nothing can render one.
 */

/** Set a nested field to a blank string, returning a new record. */
function blank<T extends object>(record: T, path: string): T {
  const segments = path.split('.');
  const [head, ...rest] = segments;
  const key = head as keyof T;
  if (rest.length === 0) {
    return { ...record, [key]: '' };
  }
  const child = record[key];
  return { ...record, [key]: blank(child as unknown as object, rest.join('.')) };
}

function blankAll<T extends object>(record: T, paths: readonly string[]): T {
  return paths.reduce<T>((current, path) => blank(current, path), record);
}

/** A subset of `values`, in the original order, possibly empty. */
function arbSubset<T>(values: readonly T[]): fc.Arbitrary<readonly T[]> {
  return fc
    .tuple(...values.map(() => fc.boolean()))
    .map((flags) => values.filter((_, index) => flags[index]));
}

function requiredIntentFields(entry: SearchIntentEntry): readonly string[] {
  return [
    'entryId',
    'phrase',
    entry.source.kind === 'tool' ? 'source.toolName' : 'source.methodName',
    'observedOn',
    'primaryIntentQuestion',
    ...(entry.locationContext.scope === 'locality' ? ['locationContext.locality'] : []),
  ];
}

function requiredCompetitorFields(observation: CompetitorObservation): readonly string[] {
  return [
    'observationId',
    'queryText',
    'observedOn',
    'toolName',
    ...(observation.locationContext.scope === 'locality' ? ['locationContext.locality'] : []),
  ];
}

function requiredObservationFields(entry: ObservationEntry): readonly string[] {
  return [
    'questionId',
    'roundId',
    'observedOn',
    'observer',
    ...(entry.locationContext.scope === 'locality' ? ['locationContext.locality'] : []),
  ];
}

/** Provenance and presentation fields, each with the words its failure must carry. */
const ASSET_FIELD_EXPECTATIONS: readonly { readonly path: string; readonly names: string }[] = [
  { path: 'provenance.creator', names: 'creator' },
  { path: 'provenance.sourceReference', names: 'source reference' },
  { path: 'provenance.licenceName', names: 'licence name' },
  { path: 'provenance.licenceTerms', names: 'licence terms' },
  { path: 'provenance.acquiredOn', names: 'acquisition date' },
  { path: 'subject.name', names: 'Bengaluru subject' },
];

const POSTCODE_FIELD_EXPECTATIONS: readonly { readonly path: string; readonly names: string }[] = [
  { path: 'pairId', names: 'pair identifier' },
  { path: 'localitySlug', names: 'locality slug' },
  { path: 'postcode', names: 'six-digit postal code' },
  { path: 'boundaryVersion', names: 'boundary version' },
  { path: 'reviewer', names: 'reviewer' },
];

describe('Property 9: a record is usable only when every required field is present', () => {
  it('names every absent field on a search intent entry', () => {
    fc.assert(
      fc.property(
        arbCompleteIntentEntry.chain((entry) =>
          arbSubset(requiredIntentFields(entry)).map((removed) => ({ entry, removed }))
        ),
        ({ entry, removed }) => {
          const degraded = blankAll(entry, removed);
          const evaluation = evaluateIntentEntry(degraded);

          expect(evaluation.usable).toBe(removed.length === 0);
          expect([...evaluation.missingFields].sort()).toEqual([...removed].sort());
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('names every absent field on a competitor observation', () => {
    fc.assert(
      fc.property(
        arbCompetitorObservation.chain((observation) =>
          arbSubset(requiredCompetitorFields(observation)).map((removed) => ({
            observation,
            removed,
          }))
        ),
        ({ observation, removed }) => {
          const degraded = blankAll(observation, removed);
          const evaluation = evaluateCompetitorObservation(degraded);

          expect(evaluation.usable).toBe(removed.length === 0);
          expect([...evaluation.missingFields].sort()).toEqual([...removed].sort());
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('names every absent field on an observation entry', () => {
    fc.assert(
      fc.property(
        arbCompleteObservationEntry.chain((entry) =>
          arbSubset(requiredObservationFields(entry)).map((removed) => ({ entry, removed }))
        ),
        ({ entry, removed }) => {
          const degraded = blankAll(entry, removed);
          const evaluation = evaluateObservationEntry(degraded);

          expect(evaluation.usable).toBe(removed.length === 0);
          expect([...evaluation.missingFields].sort()).toEqual([...removed].sort());
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('names every absent provenance value on a visual asset', () => {
    fc.assert(
      fc.property(
        arbVisualAsset.chain((asset) =>
          arbSubset(ASSET_FIELD_EXPECTATIONS).map((removed) => ({ asset, removed }))
        ),
        ({ asset, removed }) => {
          const degraded: VisualAssetRecord = blankAll(
            asset,
            removed.map((field) => field.path)
          );
          const evaluation = evaluateAsset(degraded, PROPERTY_NOW);

          expect(evaluation.renderable).toBe(removed.length === 0);
          // Each absent value is named, rather than one summary failure for all.
          expect(evaluation.failures.length).toBeGreaterThanOrEqual(removed.length);
          for (const field of removed) {
            expect(
              evaluation.failures.some(
                (failure) => failure.includes(field.names) && failure.includes(asset.assetId)
              ),
              `expected a failure naming ${field.names}`
            ).toBe(true);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('requires a written release for any recognisable face', () => {
    fc.assert(
      fc.property(arbVisualAsset, (asset) => {
        if (asset.kind !== 'photograph') return;

        const withoutRelease: VisualAssetRecord = { ...asset, personRelease: null };
        const evaluation = evaluateAsset(withoutRelease, PROPERTY_NOW);

        if (asset.showsRecognisableFace) {
          expect(evaluation.renderable).toBe(false);
          expect(evaluation.failures.join(' ')).toContain('person release');
        } else {
          expect(evaluation.renderable).toBe(true);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('renders a renderable asset exactly as recorded, adding nothing', () => {
    fc.assert(
      fc.property(arbVisualAsset, (asset) => {
        const evaluation = evaluateAsset(asset, PROPERTY_NOW);
        expect(evaluation.renderable).toBe(true);

        // The values a page will render come from the record, unchanged: intrinsic
        // dimensions, and either recorded alt text or an empty alt attribute.
        expect(asset.intrinsicWidth).toBeGreaterThan(0);
        expect(asset.intrinsicHeight).toBeGreaterThan(0);
        if (asset.decorative) {
          expect(asset.altText).toBeNull();
        } else {
          expect((asset.altText as string).length).toBeGreaterThan(0);
          expect((asset.altText as string).length).toBeLessThanOrEqual(125);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('names every absent field on a locality-to-postcode pairing', () => {
    fc.assert(
      fc.property(
        arbPostcodePair.chain((pair) =>
          arbSubset(POSTCODE_FIELD_EXPECTATIONS).map((removed) => ({ pair, removed }))
        ),
        ({ pair, removed }) => {
          const degraded: PostcodePair = blankAll(
            pair,
            removed.map((field) => field.path)
          );
          const evaluation = evaluatePostcodePair(degraded);

          expect(evaluation.recorded).toBe(removed.length === 0);
          for (const field of removed) {
            expect(
              evaluation.failures.some((failure) => failure.includes(field.names)),
              `expected a failure naming ${field.names}`
            ).toBe(true);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });

  it('records no photograph at all, so no page can reference one', () => {
    // Requirement 9.1 and 9.14: every Bengaluru-specific element the register holds
    // is an illustration, a map or a texture, and every one of them is complete.
    // The register held nothing when this property was first written; the condition
    // is now stricter, because an incomplete entry fails it where an empty register
    // could not.
    expect(VISUAL_ASSET_REGISTER.filter((asset) => asset.kind === 'photograph')).toEqual([]);
    expect(VISUAL_ASSET_REGISTER.length).toBeGreaterThan(0);
    for (const asset of VISUAL_ASSET_REGISTER) {
      expect(['illustration', 'map', 'texture']).toContain(asset.kind);
      expect(evaluateAsset(asset, new Date('2026-09-29T00:00:00.000Z')).failures).toEqual([]);
    }
  });
});
