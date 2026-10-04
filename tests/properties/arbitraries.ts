/**
 * Shared generators for the property suite.
 *
 * A property test should be about behaviour, not about fixture plumbing, so the
 * generators live here and each property test imports what it needs. Later tasks
 * extend this file with the record, asset, route and environment generators they
 * need; task 1.3 lands the four the design names first — `arbIsoDate`,
 * `arbSlug`, `arbSourceRecord` and `arbClaimRecord`.
 *
 * Two conventions run through everything below.
 *
 * **Marker strings.** Every generated text field carries a unique sentinel, so
 * "no draft text leaked onto a public surface" is a substring search for the
 * sentinel rather than an eyeball comparison — and it catches a leak through any
 * field, including fields added later.
 *
 * **Spanning the pass/fail space.** A generator that only ever produces broken
 * records proves nothing about the passing branch, and one that only produces
 * good records proves nothing about the failing branch. `arbClaimRecord` builds
 * a gate-ready skeleton and then applies a randomly chosen degradation, where
 * "no degradation" is one of the choices, so both branches are reached in a
 * hundred runs.
 */

import fc from 'fast-check';

import {
  NON_ATTRIBUTABLE_REVIEWER_NAMES,
  type ClaimApprovalStatus,
  type ClaimRecord,
  type SourceRecord,
} from '@/config/claims';
import { addCalendarDays, formatCalendarDate } from '@/lib/calendar-dates';
import {
  BENCHMARK_QUESTION_SEED,
  OBSERVATION_TOOLS,
  type Determined,
  type ObservationEntry,
} from '@internal/registers/observation';
import type {
  CompetitorObservation,
  IntentAssignmentRequest,
  LocationContext,
  PhraseSource,
  SearchIntentEntry,
  VolumeObservation,
} from '@internal/registers/search-intent';
import { CANONICAL_BRAND, PRIMARY_PHONE, type CustomerIntent } from '@/config/constants';
import type { GuideRecord } from '@/config/guides';
import {
  MIN_SECTION_WORDS,
  type LocalityEntityType,
  type LocalityRecord,
} from '@/config/localities';
import type { PostcodePair } from '@internal/registers/postcode-pairs';
import type { MediaProvenance, VisualAssetRecord } from '@/config/media-register';
import type { JsonLdObject } from '@/lib/structured-data';
import {
  FORBIDDEN_KEYS,
  PERMITTED_NESTED_TYPES,
  SCHEMA_ORG_CONTEXT,
} from '@/lib/structured-data-policy';
// The route and slug lexicons the policy suite scans with. Imported rather than
// restated, so a generated shape is judged by the same words the scan uses.
import { INTENT_SEGMENTS, NAMED_DOORWAY_PATHS, TYPE_SEGMENTS } from '../helpers/route-shape';
import { PROPERTY_TYPE_WORDS, TRANSACTION_INTENT_WORDS } from '../helpers/slug-shape';

/**
 * The minimum iteration count every property test in this suite runs at.
 * Spread it into `fc.assert` rather than restating the number, so the floor
 * cannot drift file by file.
 */
export const PROPERTY_RUN_CONFIG = { numRuns: 100 } as const;

/** Prefix that identifies generated text, for leak detection. */
export const MARKER_PREFIX = 'ZZMARKER';

/** A unique sentinel, e.g. `ZZMARKER-3f9a1c`. */
export const arbMarker: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `${MARKER_PREFIX}-${n.toString(16).padStart(6, '0')}`);

/** A sentence carrying a sentinel, so its presence anywhere is traceable. */
export function arbMarkedText(label: string): fc.Arbitrary<string> {
  return arbMarker.map((marker) => `${label} ${marker} draft wording, not approved.`);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * A real calendar date as `YYYY-MM-DD`.
 *
 * Bounded to a window either side of the project's working dates so generated
 * recheck and review dates land on both sides of a given `now` without the
 * generator wandering into year 275760. `noInvalidDate` keeps `Invalid Date` out,
 * because a malformed date string is a different test — the gate's own
 * `Number.isNaN` branch — not a property of the date space.
 */
export const arbIsoDate: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2035-12-31T00:00:00.000Z'),
    noInvalidDate: true,
  })
  .map((date) => date.toISOString().slice(0, 10));

/** A calendar date strictly before `reference`. */
export function arbIsoDateBefore(reference: Date): fc.Arbitrary<string> {
  return fc
    .date({
      min: new Date('2020-01-01T00:00:00.000Z'),
      max: new Date(reference.getTime() - 2 * 24 * 60 * 60 * 1000),
      noInvalidDate: true,
    })
    .map((date) => date.toISOString().slice(0, 10));
}

/** A calendar date strictly after `reference`. */
export function arbIsoDateAfter(reference: Date): fc.Arbitrary<string> {
  return fc
    .date({
      min: new Date(reference.getTime() + 2 * 24 * 60 * 60 * 1000),
      max: new Date('2035-12-31T00:00:00.000Z'),
      noInvalidDate: true,
    })
    .map((date) => date.toISOString().slice(0, 10));
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

const arbSlugToken: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
      minLength: 1,
      maxLength: 9,
    })
  )
  .map(([first, rest]) => `${first}${rest.join('')}`);

/**
 * A URL slug in the shape this repository uses: lowercase alphanumeric tokens
 * joined by single hyphens, no leading or trailing hyphen, no double hyphen.
 *
 * Deliberately not `fc.string()`. A generator that emits `%20` and `../` tests
 * the router, not slug resolution, and it would drown the interesting cases.
 */
export const arbSlug: fc.Arbitrary<string> = fc
  .array(arbSlugToken, { minLength: 1, maxLength: 8 })
  .map((tokens) => tokens.join('-'))
  .filter((slug) => slug.length <= 100);

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const REUSE_RIGHTS: readonly SourceRecord['reuseRights'][] = [
  'unknown',
  'reference-only',
  'quotation-permitted',
];

/**
 * Independence groups are drawn from a small pool on purpose. The gate's rule is
 * that two sources corroborate only when their groups differ, so the generator
 * has to produce collisions often enough to exercise the failing branch — a pool
 * of unique random strings never would.
 */
const INDEPENDENCE_GROUPS = ['bbmp', 'bmrcl', 'bda', 'nhai', 'karnataka-government'] as const;

const arbDeepUrl: fc.Arbitrary<string> = fc
  .tuple(fc.constantFrom('example-source-a.test', 'example-source-b.test'), arbSlug)
  .map(([host, path]) => `https://${host}/${path}`);

const arbHomepageUrl: fc.Arbitrary<string> = fc
  .constantFrom('example-source-a.test', 'example-source-b.test')
  .map((host) => `https://${host}/`);

/**
 * A source that satisfies every per-source condition in `evaluateSource`: a
 * specific reference, a supporting note, an access date and a location within
 * the source.
 */
const arbGateReadySource: fc.Arbitrary<SourceRecord> = fc.record({
  publisher: arbMarkedText('publisher'),
  independenceGroup: fc.constantFrom(...INDEPENDENCE_GROUPS),
  exactUrl: arbDeepUrl,
  documentReference: fc.constant(null),
  locationInSource: arbMarkedText('section'),
  publicationDate: arbIsoDate,
  accessDate: arbIsoDate,
  supportingNote: arbMarkedText('excerpt'),
  reuseRights: fc.constantFrom(...REUSE_RIGHTS),
});

/** Every way a single source can fail the gate, one at a time. */
type SourceDegradation =
  | 'none'
  | 'no-reference'
  | 'homepage-only'
  | 'no-supporting-note'
  | 'blank-supporting-note'
  | 'no-access-date'
  | 'no-location-in-source';

const SOURCE_DEGRADATIONS: readonly SourceDegradation[] = [
  'none',
  'no-reference',
  'homepage-only',
  'no-supporting-note',
  'blank-supporting-note',
  'no-access-date',
  'no-location-in-source',
];

function degradeSource(source: SourceRecord, degradation: SourceDegradation): SourceRecord {
  switch (degradation) {
    case 'none':
      return source;
    case 'no-reference':
      return { ...source, exactUrl: null, documentReference: null };
    case 'homepage-only':
      return { ...source, exactUrl: 'https://example-source-a.test', documentReference: null };
    case 'no-supporting-note':
      return { ...source, supportingNote: null };
    case 'blank-supporting-note':
      // The gate trims before checking, so whitespace must fail too.
      return { ...source, supportingNote: '   ' };
    case 'no-access-date':
      return { ...source, accessDate: null };
    case 'no-location-in-source':
      return { ...source, locationInSource: null };
  }
}

/**
 * A source record spanning the whole per-source pass/fail space, with a
 * document reference standing in for a URL some of the time so the
 * offline-reference branch is covered too.
 */
export const arbSourceRecord: fc.Arbitrary<SourceRecord> = fc
  .tuple(
    arbGateReadySource,
    fc.constantFrom(...SOURCE_DEGRADATIONS),
    fc.boolean(),
    arbMarkedText('document')
  )
  .map(([base, degradation, useDocumentReference, documentReference]) => {
    const withReference: SourceRecord = useDocumentReference
      ? { ...base, exactUrl: null, documentReference }
      : base;
    return degradeSource(withReference, degradation);
  });

/** Sources that will fail the gate on the reference itself, for negative cases. */
export const arbFailingSourceRecord: fc.Arbitrary<SourceRecord> = fc
  .tuple(arbGateReadySource, arbHomepageUrl)
  .map(([base, homepage]) => ({ ...base, exactUrl: homepage, documentReference: null }));

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

const CLAIM_APPROVAL_STATUSES: readonly ClaimApprovalStatus[] = [
  'candidate',
  'research',
  'draft',
  'fact_review',
  'editorial_review',
  'seo_review',
  'approved',
];

/**
 * Reviewer names that pass `isAttributableReviewer`. Two real names, because the
 * point of the check is that a person is accountable, not that the string is
 * long.
 */
const arbAttributableReviewer: fc.Arbitrary<string> = fc.constantFrom(
  'Utpal Raj KB',
  'A named local reviewer'
);

/**
 * Reviewer names that must be rejected: the recorded non-attributable desk names,
 * plus padded and case-varied near-duplicates, because the gate normalises before
 * comparing and a whitespace variant must not slip through.
 */
const arbNonAttributableReviewer: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...NON_ATTRIBUTABLE_REVIEWER_NAMES),
    fc.constantFrom<(value: string) => string>(
      (value) => value,
      (value) => value.toUpperCase(),
      (value) => `  ${value}  `,
      (value) => value.replace(/^./, (character) => character.toUpperCase())
    )
  )
  .map(([name, vary]) => vary(name));

const arbReviewer: fc.Arbitrary<string | null> = fc.oneof(
  { arbitrary: arbAttributableReviewer, weight: 3 },
  { arbitrary: arbNonAttributableReviewer, weight: 2 },
  { arbitrary: fc.constant(null), weight: 1 },
  // Under three characters, which the gate treats as unattributable.
  { arbitrary: fc.constantFrom('a', 'KB'), weight: 1 }
);

/** Every way a claim can fail the gate above the source level, one at a time. */
type ClaimDegradation =
  | 'none'
  | 'not-approved'
  | 'no-reviewer'
  | 'non-attributable-reviewer'
  | 'no-review-date'
  | 'expired-recheck'
  | 'single-source'
  | 'no-sources'
  | 'same-independence-group'
  | 'degraded-sources';

const CLAIM_DEGRADATIONS: readonly ClaimDegradation[] = [
  'none',
  'not-approved',
  'no-reviewer',
  'non-attributable-reviewer',
  'no-review-date',
  'expired-recheck',
  'single-source',
  'no-sources',
  'same-independence-group',
  'degraded-sources',
];

/**
 * The evaluation date the generated recheck dates are positioned against.
 * Property tests that need a different `now` should generate their own recheck
 * date rather than assume this one.
 */
export const PROPERTY_NOW = new Date('2026-09-29T00:00:00.000Z');

const arbGatePassingClaim: fc.Arbitrary<ClaimRecord> = fc
  .tuple(
    arbMarker,
    arbMarkedText('claim'),
    arbGateReadySource,
    arbGateReadySource,
    arbAttributableReviewer,
    arbIsoDateBefore(PROPERTY_NOW),
    arbIsoDateAfter(PROPERTY_NOW),
    fc.array(fc.constantFrom('/areas/example', '/guides/example'), { maxLength: 2 })
  )
  .map(
    ([
      marker,
      claimText,
      firstSource,
      secondSource,
      reviewer,
      reviewDate,
      recheckBy,
      usedByRoutes,
    ]): ClaimRecord => ({
      claimId: `CLM-${marker}`,
      claimText,
      sources: [
        { ...firstSource, independenceGroup: INDEPENDENCE_GROUPS[0] },
        { ...secondSource, independenceGroup: INDEPENDENCE_GROUPS[1] },
      ],
      reviewer,
      reviewDate,
      conflictingEvidenceNotes: null,
      approvalStatus: 'approved',
      recheckBy,
      usedByRoutes,
      evidenceGap: null,
    })
  );

function degradeClaim(
  claim: ClaimRecord,
  degradation: ClaimDegradation,
  spares: {
    readonly status: ClaimApprovalStatus;
    readonly reviewer: string;
    readonly pastDate: string;
    readonly degradedSources: readonly SourceRecord[];
  }
): ClaimRecord {
  switch (degradation) {
    case 'none':
      return claim;
    case 'not-approved':
      return {
        ...claim,
        approvalStatus: spares.status === 'approved' ? 'draft' : spares.status,
      };
    case 'no-reviewer':
      return { ...claim, reviewer: null };
    case 'non-attributable-reviewer':
      return { ...claim, reviewer: spares.reviewer };
    case 'no-review-date':
      return { ...claim, reviewDate: null };
    case 'expired-recheck':
      return { ...claim, recheckBy: spares.pastDate };
    case 'single-source':
      return { ...claim, sources: claim.sources.slice(0, 1) };
    case 'no-sources':
      return { ...claim, sources: [] };
    case 'same-independence-group':
      return {
        ...claim,
        sources: claim.sources.map((source) => ({
          ...source,
          independenceGroup: INDEPENDENCE_GROUPS[0],
        })),
      };
    case 'degraded-sources':
      return { ...claim, sources: spares.degradedSources };
  }
}

/**
 * A claim record spanning the whole pass/fail space, with a marker string in
 * every text field.
 *
 * One tenth of the generated records carry no degradation and therefore pass
 * `evaluateClaim` at `PROPERTY_NOW`; the rest fail on exactly one recorded
 * reason, which is what makes a counterexample readable.
 */
export const arbClaimRecord: fc.Arbitrary<ClaimRecord> = fc
  .tuple(
    arbGatePassingClaim,
    fc.constantFrom(...CLAIM_DEGRADATIONS),
    fc.constantFrom(...CLAIM_APPROVAL_STATUSES),
    arbNonAttributableReviewer,
    arbIsoDateBefore(PROPERTY_NOW),
    fc.array(arbFailingSourceRecord, { minLength: 2, maxLength: 3 }),
    fc.option(arbMarkedText('conflicting evidence'), { nil: null }),
    fc.option(arbMarkedText('evidence gap'), { nil: null })
  )
  .map(
    ([
      base,
      degradation,
      status,
      reviewer,
      pastDate,
      degradedSources,
      conflictingEvidenceNotes,
      evidenceGap,
    ]): ClaimRecord => ({
      ...degradeClaim(base, degradation, { status, reviewer, pastDate, degradedSources }),
      conflictingEvidenceNotes,
      evidenceGap,
    })
  );

// ---------------------------------------------------------------------------
// Search intent entries and volume observations
// ---------------------------------------------------------------------------

/**
 * A calendar date a fixed number of days from `PROPERTY_NOW`.
 *
 * Volume generators position dates arithmetically rather than drawing them from
 * `arbIsoDate`, because the interesting cases sit within a day of a boundary — the
 * 180-day re-query window and the re-query date itself — and a uniformly random
 * date in a fifteen-year span reaches them roughly never.
 */
export function calendarDateFromPropertyNow(offsetDays: number): string {
  return formatCalendarDate(addCalendarDays(PROPERTY_NOW, offsetDays));
}

export const arbLocationContext: fc.Arbitrary<LocationContext> = fc.oneof(
  fc.constant<LocationContext>({ scope: 'city', city: 'Bengaluru' }),
  arbMarker.map<LocationContext>((marker) => ({
    scope: 'locality',
    city: 'Bengaluru',
    locality: `Locality ${marker}`,
  }))
);

export const arbPhraseSource: fc.Arbitrary<PhraseSource> = fc.oneof(
  arbMarker.map<PhraseSource>((marker) => ({ kind: 'tool', toolName: `Tool ${marker}` })),
  arbMarker.map<PhraseSource>((marker) => ({ kind: 'manual', methodName: `Method ${marker}` }))
);

/**
 * A volume observation that satisfies every Requirement 3.2 condition at
 * `PROPERTY_NOW`: a named tool, a query date in the past, all three tool settings,
 * and a re-query date that is both in the future and inside the 180-day window.
 *
 * The figure is deliberately allowed a fractional part. A rounding branch would
 * show up as a returned figure that differs from the recorded one, and an integer
 * generator would hide it.
 */
const arbGateReadyVolume: fc.Arbitrary<VolumeObservation> = fc
  .tuple(
    arbMarker,
    fc.integer({ min: 1, max: 170 }),
    fc.double({ min: 0, max: 99_999, noNaN: true, noDefaultInfinity: true }),
    fc.integer({ min: 0, max: 9 })
  )
  .chain(([marker, queriedDaysAgo, figure, extra]) =>
    fc
      .integer({ min: queriedDaysAgo + 1, max: 180 })
      .map((windowDays): VolumeObservation => ({
        figure,
        toolName: `Tool ${marker}`,
        queriedOn: calendarDateFromPropertyNow(-queriedDaysAgo),
        toolSettings: {
          locationSetting: `Bengaluru setting ${marker}`,
          languageSetting: `English ${extra}`,
          dateRangeApplied: `range ${marker}`,
        },
        reQueryBy: calendarDateFromPropertyNow(windowDays - queriedDaysAgo),
      }))
  );

/** Every way a volume figure stops being a figure, one at a time. */
export type VolumeDegradation =
  | 'none'
  | 'no-tool-name'
  | 'blank-tool-name'
  | 'no-query-date'
  | 'malformed-query-date'
  | 'no-location-setting'
  | 'no-language-setting'
  | 'no-date-range'
  | 'no-requery-date'
  | 'requery-date-passed'
  | 'requery-window-too-long';

export const VOLUME_DEGRADATIONS: readonly VolumeDegradation[] = [
  'none',
  'no-tool-name',
  'blank-tool-name',
  'no-query-date',
  'malformed-query-date',
  'no-location-setting',
  'no-language-setting',
  'no-date-range',
  'no-requery-date',
  'requery-date-passed',
  'requery-window-too-long',
];

export function degradeVolume(
  volume: VolumeObservation,
  degradation: VolumeDegradation
): VolumeObservation {
  switch (degradation) {
    case 'none':
      return volume;
    case 'no-tool-name':
      return { ...volume, toolName: '' };
    case 'blank-tool-name':
      return { ...volume, toolName: '   ' };
    case 'no-query-date':
      return { ...volume, queriedOn: '' };
    case 'malformed-query-date':
      // A real-looking date that names no day: 2026 is not a leap year.
      return { ...volume, queriedOn: '2026-02-29' };
    case 'no-location-setting':
      return { ...volume, toolSettings: { ...volume.toolSettings, locationSetting: '' } };
    case 'no-language-setting':
      return { ...volume, toolSettings: { ...volume.toolSettings, languageSetting: '  ' } };
    case 'no-date-range':
      return { ...volume, toolSettings: { ...volume.toolSettings, dateRangeApplied: '' } };
    case 'no-requery-date':
      return { ...volume, reQueryBy: '' };
    case 'requery-date-passed':
      return { ...volume, reQueryBy: calendarDateFromPropertyNow(0) };
    case 'requery-window-too-long':
      return { ...volume, reQueryBy: '2035-12-31' };
  }
}

/** A volume observation spanning the whole available/unavailable space. */
export const arbVolumeObservation: fc.Arbitrary<VolumeObservation> = fc
  .tuple(arbGateReadyVolume, fc.constantFrom(...VOLUME_DEGRADATIONS))
  .map(([volume, degradation]) => degradeVolume(volume, degradation));

/** A search intent entry carrying every required field. */
export const arbCompleteIntentEntry: fc.Arbitrary<SearchIntentEntry> = fc
  .tuple(
    arbMarker,
    arbSlug,
    arbPhraseSource,
    arbLocationContext,
    fc.constantFrom<'primary' | 'supporting'>('primary', 'supporting'),
    fc.integer({ min: 1, max: 300 })
  )
  .map(
    ([marker, slug, source, locationContext, role, observedDaysAgo]): SearchIntentEntry => ({
      entryId: `SIE-${marker}`,
      // Within the 120-character bound; the boundary itself is a unit test.
      phrase: `how do i ${slug.slice(0, 40)} in bengaluru`,
      source,
      observedOn: calendarDateFromPropertyNow(-observedDaysAgo),
      locationContext,
      primaryIntentQuestion: `What happens when I ${slug.slice(0, 40)}?`,
      destinationRoute: null,
      role,
      volume: null,
    })
  );

/**
 * A search intent entry with a volume observation attached, spanning the whole
 * available/unavailable space. The entry itself always carries every required
 * field, because Property 8 is about the *figure* going unavailable while the
 * entry survives.
 */
export const arbIntentEntryWithVolume: fc.Arbitrary<SearchIntentEntry> = fc
  .tuple(arbCompleteIntentEntry, fc.option(arbVolumeObservation, { nil: null }))
  .map(([entry, volume]) => ({ ...entry, volume }));

// ---------------------------------------------------------------------------
// Observation entries
// ---------------------------------------------------------------------------

/**
 * A `Determined<T>` spanning all three shapes that matter: a recorded value, an
 * unavailable value with a reason, and an unavailable value whose reason was left
 * blank — which must be reported as a missing field rather than accepted.
 */
export function arbDetermined<T>(arbValue: fc.Arbitrary<T>): fc.Arbitrary<Determined<T>> {
  return fc.oneof(
    { arbitrary: arbValue.map<Determined<T>>((value) => ({ available: true, value })), weight: 3 },
    {
      arbitrary: arbMarkedText('unavailable because').map<Determined<T>>((reason) => ({
        available: false,
        reason,
      })),
      weight: 2,
    },
    {
      arbitrary: fc.constantFrom('', '   ').map<Determined<T>>((reason) => ({
        available: false,
        reason,
      })),
      weight: 1,
    }
  );
}

const arbObserver: fc.Arbitrary<string> = fc.oneof(
  { arbitrary: fc.constantFrom('Utpal Raj KB', 'A named local observer'), weight: 3 },
  { arbitrary: arbNonAttributableReviewer, weight: 1 }
);

/**
 * An observation entry spanning the determined/unavailable space on every field
 * Requirement 7.2 lists, with a Google Maps row reachable so the applicability
 * branch is covered.
 */
export const arbObservationEntry: fc.Arbitrary<ObservationEntry> = fc
  .tuple(
    fc.constantFrom(...BENCHMARK_QUESTION_SEED.map((question) => question.questionId)),
    fc.constantFrom(...OBSERVATION_TOOLS),
    fc.integer({ min: 0, max: 60 }),
    arbObserver,
    arbLocationContext,
    fc.boolean(),
    arbDetermined(fc.boolean()),
    arbDetermined(fc.oneof(fc.constant<'none'>('none'), arbDeepUrl)),
    arbDetermined(fc.boolean()),
    arbDetermined(fc.boolean()),
    fc.array(arbMarkedText('factual error'), { maxLength: 2 })
  )
  .map(
    ([
      questionId,
      tool,
      observedDaysAgo,
      observer,
      locationContext,
      applicable,
      mentionedResult,
      citedUrl,
      brandStringMatchesExactly,
      phoneMatchesExactly,
      factualErrors,
    ]): ObservationEntry => ({
      questionId,
      roundId: 'OBS-R001',
      tool,
      observedOn: calendarDateFromPropertyNow(-observedDaysAgo),
      observer,
      locationContext,
      mentioned: applicable
        ? { applicable: true, result: mentionedResult }
        : { applicable: false, reason: 'No presence is confirmed for this tool.' },
      citedUrl,
      brandStringMatchesExactly,
      phoneMatchesExactly,
      factualErrors,
      correction: null,
    })
  );

/**
 * A competitor observation carrying every Requirement 3.8 field, with a position
 * sample present some of the time so the dated-sample branch is reached.
 */
export const arbCompetitorObservation: fc.Arbitrary<CompetitorObservation> = fc
  .tuple(
    arbMarker,
    arbSlug,
    fc.integer({ min: 1, max: 300 }),
    arbLocationContext,
    fc.constantFrom<CompetitorObservation['resultType']>('organic', 'map', 'paid', 'ai-answer'),
    fc.option(fc.integer({ min: 1, max: 50 }), { nil: null })
  )
  .map(
    ([
      marker,
      slug,
      observedDaysAgo,
      locationContext,
      resultType,
      positionSample,
    ]): CompetitorObservation => ({
      observationId: `CMP-${marker}`,
      queryText: `${slug} bengaluru`,
      observedOn: calendarDateFromPropertyNow(-observedDaysAgo),
      toolName: `Tool ${marker}`,
      locationContext,
      resultType,
      positionSample,
    })
  );

/** An observation entry carrying every Requirement 7.2 field, nothing absent. */
export const arbCompleteObservationEntry: fc.Arbitrary<ObservationEntry> = fc
  .tuple(
    fc.constantFrom(...BENCHMARK_QUESTION_SEED.map((question) => question.questionId)),
    fc.constantFrom(...OBSERVATION_TOOLS),
    fc.integer({ min: 0, max: 60 }),
    fc.constantFrom('Utpal Raj KB', 'A named local observer'),
    arbLocationContext,
    fc.boolean(),
    fc.boolean(),
    fc.boolean()
  )
  .map(
    ([
      questionId,
      tool,
      observedDaysAgo,
      observer,
      locationContext,
      mentioned,
      brandMatches,
      phoneMatches,
    ]): ObservationEntry => ({
      questionId,
      roundId: 'OBS-R001',
      tool,
      observedOn: calendarDateFromPropertyNow(-observedDaysAgo),
      observer,
      locationContext,
      mentioned: { applicable: true, result: { available: true, value: mentioned } },
      citedUrl: { available: true, value: 'none' },
      brandStringMatchesExactly: { available: true, value: brandMatches },
      phoneMatchesExactly: { available: true, value: phoneMatches },
      factualErrors: [],
      correction: null,
    })
  );

// ---------------------------------------------------------------------------
// Visual assets
// ---------------------------------------------------------------------------

const arbMediaProvenance: fc.Arbitrary<MediaProvenance> = fc
  .tuple(
    arbMarkedText('creator'),
    arbMarkedText('source'),
    arbMarkedText('licence'),
    arbMarkedText('terms'),
    fc.constantFrom<MediaProvenance['permissionToAdapt']>('granted', 'refused'),
    fc.integer({ min: 1, max: 400 }),
    fc.option(fc.integer({ min: 1, max: 400 }), { nil: null })
  )
  .map(
    ([
      creator,
      sourceReference,
      licenceName,
      licenceTerms,
      permissionToAdapt,
      acquiredDaysAgo,
      expiresInDays,
    ]): MediaProvenance => ({
      creator,
      sourceReference,
      licenceName,
      licenceTerms,
      permissionToAdapt,
      acquiredOn: calendarDateFromPropertyNow(-acquiredDaysAgo),
      // Either no expiry recorded, or one still in the future — an expired licence
      // is a separate branch, covered by the unit tests at the boundary.
      licenceExpiresOn: expiresInDays === null ? null : calendarDateFromPropertyNow(expiresInDays),
    })
  );

const arbAssetBase = fc
  .tuple(
    arbMarker,
    fc.integer({ min: 16, max: 2_000 }),
    fc.integer({ min: 16, max: 2_000 }),
    arbMediaProvenance,
    fc.integer({ min: 1, max: 80_000 }),
    fc.constantFrom<'locality' | 'corridor' | 'civic-motif'>('locality', 'corridor', 'civic-motif'),
    arbMarkedText('subject'),
    fc.array(fc.constantFrom('#ffffff', '#f5f3ef', '#1c1c1c'), { maxLength: 2 })
  )
  .map(
    ([
      marker,
      intrinsicWidth,
      intrinsicHeight,
      provenance,
      compressedBytes,
      subjectKind,
      subjectName,
      backgroundColoursBehindText,
    ]) => ({
      marker,
      intrinsicWidth,
      intrinsicHeight,
      provenance,
      compressedBytes,
      subject: { kind: subjectKind, name: subjectName },
      backgroundColoursBehindText,
    })
  );

/**
 * A visual asset of each of the four kinds, complete and renderable at
 * `PROPERTY_NOW`.
 *
 * Alt text is short marked text, comfortably inside the 1–125 bound; the boundary
 * itself is a unit test rather than a property, because it is one number.
 */
export const arbVisualAsset: fc.Arbitrary<VisualAssetRecord> = arbAssetBase.chain((base) =>
  fc.oneof(
    // Illustration
    fc
      .tuple(arbMarkedText('alt'), fc.array(arbMarkedText('depicts'), { minLength: 1, maxLength: 3 }))
      .map(
        ([altText, depicts]): VisualAssetRecord => ({
          kind: 'illustration',
          assetId: `ILL-${base.marker}`,
          delivery: { mode: 'inline-svg', componentName: `Component${base.marker}` },
          intrinsicWidth: base.intrinsicWidth,
          intrinsicHeight: base.intrinsicHeight,
          altText: altText.slice(0, 120),
          decorative: false,
          subject: base.subject,
          provenance: base.provenance,
          backgroundColoursBehindText: base.backgroundColoursBehindText,
          compressedBytes: base.compressedBytes,
          depicts,
          illustrationLabel: 'Illustration',
        })
      ),
    // Map, with no boundary claim: every claim in the live ledger fails the gate,
    // so a generated boundary claim would only ever test the failing branch.
    arbMarkedText('alt').map(
      (altText): VisualAssetRecord => ({
        kind: 'map',
        assetId: `MAP-${base.marker}`,
        delivery: { mode: 'inline-svg', componentName: `Component${base.marker}` },
        intrinsicWidth: base.intrinsicWidth,
        intrinsicHeight: base.intrinsicHeight,
        altText: altText.slice(0, 120),
        decorative: false,
        subject: base.subject,
        provenance: base.provenance,
        backgroundColoursBehindText: base.backgroundColoursBehindText,
        compressedBytes: base.compressedBytes,
        orientationAidLabel: 'Orientation aid',
        boundaryClaimId: null,
        showsCommuteTimes: false,
        showsDistances: false,
      })
    ),
    // Texture: decorative, so no alt text at all.
    fc.constant<VisualAssetRecord>({
      kind: 'texture',
      assetId: `TEX-${base.marker}`,
      delivery: { mode: 'inline-svg', componentName: `Component${base.marker}` },
      intrinsicWidth: base.intrinsicWidth,
      intrinsicHeight: base.intrinsicHeight,
      altText: null,
      decorative: true,
      subject: base.subject,
      provenance: base.provenance,
      backgroundColoursBehindText: base.backgroundColoursBehindText,
      compressedBytes: base.compressedBytes,
    }),
    // Photograph: a recognisable face always carries its written release, because
    // the missing-release branch is what the blanking in the property removes.
    fc
      .tuple(arbMarkedText('alt'), fc.boolean(), fc.boolean(), arbMarkedText('person'))
      .map(
        ([altText, showsRecognisableFace, showsBuildingOrStreet, personName]): VisualAssetRecord => ({
          kind: 'photograph',
          assetId: `PHO-${base.marker}`,
          delivery: { mode: 'file', publicPath: `/media/${base.marker}.jpg` },
          intrinsicWidth: base.intrinsicWidth,
          intrinsicHeight: base.intrinsicHeight,
          altText: altText.slice(0, 120),
          decorative: false,
          subject: base.subject,
          provenance: base.provenance,
          backgroundColoursBehindText: base.backgroundColoursBehindText,
          compressedBytes: base.compressedBytes,
          personRelease: showsRecognisableFace
            ? {
                personName,
                permittedUses: ['Use on this site'],
                releasedOn: calendarDateFromPropertyNow(-30),
                expiresOn: null,
              }
            : null,
          caption: null,
          showsRecognisableFace,
          showsBuildingOrStreet,
        })
      )
  )
);

// ---------------------------------------------------------------------------
// Postcode pairs
// ---------------------------------------------------------------------------

/**
 * A locality-to-postcode pairing that satisfies Requirement 12.4: two sources from
 * two independence groups, a boundary version and a named reviewer.
 */
export const arbPostcodePair: fc.Arbitrary<PostcodePair> = fc
  .tuple(
    arbMarker,
    arbSlug,
    fc.integer({ min: 100_000, max: 999_999 }),
    arbGateReadySource,
    arbGateReadySource,
    arbMarkedText('boundary version'),
    fc.constantFrom('Utpal Raj KB', 'A named local reviewer')
  )
  .map(
    ([
      marker,
      localitySlug,
      postcode,
      firstSource,
      secondSource,
      boundaryVersion,
      reviewer,
    ]): PostcodePair => ({
      pairId: `PPC-${marker}`,
      localitySlug,
      postcode: String(postcode),
      sources: [
        { ...firstSource, independenceGroup: INDEPENDENCE_GROUPS[0] },
        { ...secondSource, independenceGroup: INDEPENDENCE_GROUPS[1] },
      ],
      boundaryVersion,
      reviewer,
    })
  );

// ---------------------------------------------------------------------------
// Locality candidates
// ---------------------------------------------------------------------------

/**
 * The shape `scripts/seed-locality-candidates.mjs` reads out of the backlog CSV.
 *
 * Declared here rather than imported, because the script is plain JavaScript and
 * the property test wants the field names checked at compile time.
 */
export interface LocalityCandidateRow {
  readonly candidateId: string;
  readonly candidateName: string;
  readonly candidateSlug: string;
  readonly entityTypeProvisional: string;
  readonly researchGroup: string;
  readonly priority: string;
  readonly researchQuestion: string;
  readonly aliasMergeNotes: string;
}

/** The `entity_type_provisional` values the backlog actually uses. */
export const CANDIDATE_ENTITY_TYPES: readonly string[] = [
  'locality',
  'corridor',
  'micro-locality',
  'junction-area',
  'outer-place',
];

/** The `research_group_not_official_zone` values the backlog actually uses. */
export const CANDIDATE_RESEARCH_GROUPS: readonly string[] = [
  'Central research group',
  'North and north-east research group',
  'East research group',
  'South and south-east research group',
  'West and south-west research group',
  'Outer-place research group; coverage conditional',
];

/**
 * A deliberately small name-and-slug pool.
 *
 * The interesting behaviour in seeding is what happens on a collision, so the
 * generator has to collide often. A pool of unique random slugs would seed 100
 * records and hold none, proving nothing about Requirement 1.15. The pool mixes
 * three kinds of value:
 *
 *  - fresh names that collide with nothing,
 *  - names and slugs belonging to records already in the registry,
 *  - the alias keys, which must never be seeded even though no record holds them.
 *
 * `slug` and `name` are drawn independently so a candidate can collide on one
 * without colliding on the other — which is exactly the Hebbal case, where the
 * name matches an existing record while the slug matches nothing.
 */
const CANDIDATE_SLUG_POOL: readonly string[] = [
  'alpha-place',
  'beta-place',
  'gamma-place',
  'delta-place',
  // Slugs an existing record already holds.
  'indiranagar',
  'koramangala',
  'sadashivanagar',
  'north-bengaluru',
  'whitefield-inner-enclaves',
  // Alias keys. No record holds them, and none may be seeded onto them.
  'indira-nagar',
  'sadashiva-nagar',
];

const CANDIDATE_NAME_POOL: readonly string[] = [
  'Alpha Place',
  'Beta Place',
  'Gamma Place',
  'Delta Place',
  // Canonical names and aliases an existing record already carries.
  'Indiranagar',
  'Indira Nagar',
  'Koramangala',
  'Sadashivanagar',
  'Hebbal',
  'Whitefield',
  'Whitefield (inner residential enclaves)',
];

/**
 * A single backlog row. `candidateId` is generated from the row's position by the
 * list generator below, so identifiers stay unique while names and slugs collide.
 */
export function arbLocalityCandidateRow(candidateId: string): fc.Arbitrary<LocalityCandidateRow> {
  return fc
    .tuple(
      fc.constantFrom(...CANDIDATE_NAME_POOL),
      fc.constantFrom(...CANDIDATE_SLUG_POOL),
      fc.constantFrom(...CANDIDATE_ENTITY_TYPES),
      fc.constantFrom(...CANDIDATE_RESEARCH_GROUPS),
      fc.constantFrom('P1-first-batch-candidate', 'P2-research', 'P3-later'),
      arbMarkedText('research question'),
      arbMarkedText('alias note')
    )
    .map(
      ([
        candidateName,
        candidateSlug,
        entityTypeProvisional,
        researchGroup,
        priority,
        researchQuestion,
        aliasMergeNotes,
      ]): LocalityCandidateRow => ({
        candidateId,
        candidateName,
        candidateSlug,
        entityTypeProvisional,
        researchGroup,
        priority,
        researchQuestion,
        aliasMergeNotes,
      })
    );
}

/**
 * A candidate list in any order, with unique identifiers and colliding slugs.
 *
 * Lists run from empty to 20 rows. Empty matters: a seeding run over no
 * candidates must account for nothing rather than throwing.
 */
export const arbLocalityCandidateRows: fc.Arbitrary<LocalityCandidateRow[]> = fc
  .integer({ min: 0, max: 20 })
  .chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_unused, index) =>
        arbLocalityCandidateRow(`AREA-${String(index + 1).padStart(3, '0')}`)
      )
    )
  )
  .map((rows) => [...rows]);

/**
 * A registry record the seeding run has to avoid colliding with.
 *
 * Only the four fields the collision algorithm reads. Generating the whole
 * `LocalityRecord` would add 28 fields the algorithm never looks at.
 */
export interface ExistingRecordView {
  readonly entityId: string;
  readonly slug: string;
  readonly canonicalName: string;
  readonly aliases: readonly string[];
}

/**
 * Existing-record sets drawn from the same pools, so a generated candidate can
 * collide with a generated existing record as well as with a real one.
 */
export const arbExistingRecordViews: fc.Arbitrary<ExistingRecordView[]> = fc
  .uniqueArray(fc.constantFrom(...CANDIDATE_SLUG_POOL.slice(0, 9)), { maxLength: 6 })
  .chain((slugs) =>
    fc.tuple(
      ...slugs.map((slug, index) =>
        fc
          .tuple(fc.constantFrom(...CANDIDATE_NAME_POOL), fc.subarray([...CANDIDATE_NAME_POOL], { maxLength: 2 }))
          .map(
            ([canonicalName, aliases]): ExistingRecordView => ({
              entityId: `LOC-EXISTING-${index + 1}`,
              slug,
              canonicalName,
              aliases: aliases.filter((alias) => alias !== canonicalName),
            })
          )
      )
    )
  )
  .map((records) => [...records]);

// ---------------------------------------------------------------------------
// Guide records and intent assignments
// ---------------------------------------------------------------------------

/**
 * A small pool of guide routes.
 *
 * Deliberately small. Property 10 is about two pages competing for one question,
 * and a generator drawing routes from an unbounded space would almost never
 * produce a competition inside a hundred runs.
 */
export const GUIDE_ROUTE_POOL: readonly string[] = [
  '/guides/what-happens-when-you-list-a-flat-for-sale',
  '/guides/what-to-check-before-you-agree-to-buy-a-flat',
  '/guides/how-a-rental-search-actually-proceeds',
  '/guides/questions-a-villa-purchase-raises',
  '/guides/property-enquiry-next-steps',
];

/** A small pool of customer questions, for the same reason. */
export const GUIDE_QUESTION_POOL: readonly string[] = [
  'What should I have ready before I call a broker?',
  'What does a landlord decide before listing a property?',
  'Which documents matter before agreeing to buy?',
  'How does a rental search actually proceed?',
];

/**
 * A slug pool spanning the three shapes Requirement 4.9 cares about: slugs that
 * differ by an intent word, slugs that differ by a property-type word, and slugs
 * that are unrelated.
 */
export const GUIDE_SLUG_POOL: readonly string[] = [
  'buy-flat-bengaluru',
  'sell-flat-bengaluru',
  'questions-a-villa-purchase-raises',
  'questions-a-site-purchase-raises',
  'how-a-rental-search-actually-proceeds',
  'property-enquiry-next-steps',
];

/** A small pool of register entry identifiers, so two pages can share one. */
export const GUIDE_INTENT_ENTRY_POOL: readonly string[] = ['SIE-A1', 'SIE-B2', 'SIE-C3'];

/**
 * A direct answer of 31 words: inside the 20-to-60-word band Requirements 5.3 and
 * 5.11 set, and carrying no word the external-fact lexicon matches.
 */
export const GENERATED_DIRECT_ANSWER =
  'Generated direct answer of a length the gate accepts, saying nothing about law, revenue, papers, charges or the wider property market, and telling a reader what to do next.';

/**
 * A guide record that passes `evaluateGuide` when its publication status says
 * published.
 *
 * `slug`, `question`, `primaryIntent` and `publicationStatus` are the interesting
 * dimensions and are drawn from the pools above; everything else is fixed, because
 * varying it would not reach a different branch of the rule under test.
 *
 * Task 6.2 added nine conditions to the gate and this generator had to grow to stay
 * gate-ready, which is the point of keeping it gate-ready rather than merely
 * plausible. Two of the changes matter beyond bookkeeping:
 *
 *  - **Two sections, both with question headings.** With one section the record
 *    stopped passing, and `published` would have been empty in every run of the
 *    one-question-one-page property — a test that passes while proving nothing.
 *  - **`headingIntentEntryId` tracks `primaryIntent`.** The new provenance condition
 *    binds a record that carries an approved phrase, so a record with a phrase and
 *    uncited headings fails. Leaving them null would have made the primary-intent
 *    collision branch of Property 10 unreachable, because no record carrying a phrase
 *    could ever publish. Tying the two together instead exercises both branches.
 *
 * The direct answer is deliberately free of every `EXTERNAL_FACT_LEXICON` word,
 * including the standalone `act` that the statute pattern matches.
 */
export const arbGateReadyGuideRecord: fc.Arbitrary<GuideRecord> = fc
  .tuple(
    arbMarker,
    fc.constantFrom(...GUIDE_SLUG_POOL),
    fc.constantFrom(...GUIDE_QUESTION_POOL),
    fc.option(fc.constantFrom(...GUIDE_INTENT_ENTRY_POOL), { nil: null }),
    fc.constantFrom<'published' | 'unpublished'>('published', 'unpublished'),
    fc.constantFrom<CustomerIntent>('buy', 'sell', 'rent', 'rent-out', 'commercial', 'general')
  )
  .map(
    ([marker, slug, question, intentEntryId, publicationStatus, intent]): GuideRecord => ({
      guideId: `GD-${marker}`,
      slug,
      question,
      title: question.replace(/\?$/, ''),
      description: `Generated record ${marker}.`,
      intent,
      contentClass: 'own-process',
      directAnswer: GENERATED_DIRECT_ANSWER,
      sections: [
        {
          heading: 'What happens first?',
          headingIntentEntryId: intentEntryId,
          paragraphs: ['Generated body paragraph.'],
        },
        {
          heading: 'What happens next?',
          headingIntentEntryId: intentEntryId,
          paragraphs: ['Another generated body paragraph.'],
        },
      ],
      nextStep: 'Call the number on the page.',
      scopeNote: 'Generated scope note.',
      attributedTo: CANONICAL_BRAND,
      namedAuthor: null,
      subjectReviewer: null,
      claimIds: [],
      contentUpdatedAt: calendarDateFromPropertyNow(-30),
      publicationStatus,
      relatedGuideIds: [],
      blockingNotes: [],
      maintenanceOwner: 'Utpal Raj KB',
      nextReviewAt: calendarDateFromPropertyNow(180),
      primaryIntent: intentEntryId ? { intentEntryId, phrase: `phrase ${intentEntryId}` } : null,
      supportingPhrases: [],
      visualAssetIds: [],
    })
  );

/** A registry-sized set of guide records, including the empty set. */
export const arbGuideRecords: fc.Arbitrary<GuideRecord[]> = fc.array(arbGateReadyGuideRecord, {
  minLength: 0,
  maxLength: 8,
});

/**
 * An intent assignment request drawn from the route and question pools.
 *
 * The entry is complete two thirds of the time and degraded the rest, so both the
 * accepted and the rejected branch of `assignPrimaryIntent` are reached. `role` is
 * forced to `primary`, because a supporting entry is rejected for a different
 * reason and Property 10 is about primary intents.
 */
export const arbIntentAssignmentRequest: fc.Arbitrary<IntentAssignmentRequest> = fc
  .tuple(
    arbCompleteIntentEntry,
    fc.constantFrom(...GUIDE_ROUTE_POOL),
    fc.constantFrom(...GUIDE_QUESTION_POOL),
    fc.constantFrom<'none' | 'blank-entry-id' | 'blank-phrase' | 'too-many-supporting'>(
      'none',
      'none',
      'blank-entry-id',
      'blank-phrase',
      'too-many-supporting'
    )
  )
  .map(([entry, route, question, degradation]): IntentAssignmentRequest => {
    const base: SearchIntentEntry = {
      ...entry,
      role: 'primary',
      primaryIntentQuestion: question,
    };
    switch (degradation) {
      case 'blank-entry-id':
        return { entry: { ...base, entryId: '  ' }, route };
      case 'blank-phrase':
        return { entry: { ...base, phrase: '' }, route };
      case 'too-many-supporting':
        return {
          entry: base,
          route,
          supportingPhrases: ['a', 'b', 'c', 'd', 'e', 'f'],
        };
      case 'none':
      default:
        return { entry: base, route };
    }
  });

/** A sequence of assignment requests, applied in order. */
export const arbIntentAssignmentRequests: fc.Arbitrary<IntentAssignmentRequest[]> = fc.array(
  arbIntentAssignmentRequest,
  { minLength: 0, maxLength: 8 }
);

// ---------------------------------------------------------------------------
// Locality records, and the evidence a gate decision turns on
// ---------------------------------------------------------------------------

/**
 * A locality record that passes `evaluateLocality` at `PROPERTY_NOW`.
 *
 * Confirmed coverage, a named accountable person, three named reviewers, three
 * approval timestamps, a live review date, two sections at the depth bar, and no
 * claim to check —
 * because no claim in the live ledger passes the gate, so a record carrying one could
 * never be the passing baseline a monotonicity property needs.
 *
 * `slug` and `canonicalName` are drawn from a small pool so two generated records
 * collide often enough to exercise the duplicate-section comparison.
 */
export const LOCALITY_NAME_POOL: readonly { slug: string; canonicalName: string }[] = [
  { slug: 'alpha-locality', canonicalName: 'Alphanagar' },
  { slug: 'beta-locality', canonicalName: 'Betapura' },
  { slug: 'gamma-locality', canonicalName: 'Gammahalli' },
];

/**
 * Two sections at the gate's depth bar, distinct from each other and — through the
 * seed — from every other generated record's.
 *
 * Task 9.3 made Requirement 1.5's section depth a condition of `evaluateLocality`:
 * at least `MIN_CONTENT_SECTIONS` sections of at least `MIN_SECTION_WORDS` words, no
 * two alike. With the single one-line section this generator used to carry, no
 * generated record would pass, and every property that starts from a gate-ready
 * baseline would pass while proving nothing — or, behind `fc.pre`, fail to find a
 * single run.
 */
function gateReadyLocalitySections(seed: string): LocalityRecord['sections'] {
  const paragraph = (label: string) =>
    Array.from({ length: MIN_SECTION_WORDS }, (_, index) =>
      index === 0 ? `${label}-${seed}` : 'word'
    ).join(' ');
  return [
    {
      sectionId: `sec-${seed}`,
      heading: 'What is worth knowing here?',
      paragraphs: [paragraph('knowing')],
      claimIds: [],
    },
    {
      sectionId: `sec-${seed}-ready`,
      heading: 'What should you have ready?',
      paragraphs: [paragraph('ready')],
      claimIds: [],
    },
  ];
}

export const arbGateReadyLocalityRecord: fc.Arbitrary<LocalityRecord> = fc
  .tuple(
    arbMarker,
    fc.constantFrom(...LOCALITY_NAME_POOL),
    fc.constantFrom<LocalityEntityType>('locality', 'micro-locality', 'corridor'),
    fc.integer({ min: 1, max: 120 })
  )
  .map(
    ([marker, place, entityType, approvedDaysAgo]): LocalityRecord => ({
      entityId: `LOC-${marker}`,
      canonicalName: place.canonicalName,
      aliases: [],
      entityType,
      slug: place.slug,
      marketingGroup: 'Generated group',
      administrativeMappings: [],
      actualServiceCoverage: 'confirmed-served',
      coverageResponsibleOwner: 'Utpal Raj KB',
      summary: `Generated summary ${marker}.`,
      summaryClaimIds: [],
      sections: gateReadyLocalitySections(marker),
      approvedFaq: [],
      approvedNearbyRelationships: [],
      relatedGuideIds: [],
      postalMappingIds: [],
      imageRightsRecords: [],
      author: 'A. Named Author',
      localReviewer: 'A. Named Local Reviewer',
      seoReviewer: 'A. Named SEO Reviewer',
      editorialApprovedAt: calendarDateFromPropertyNow(-approvedDaysAgo),
      localReviewApprovedAt: calendarDateFromPropertyNow(-approvedDaysAgo),
      seoReviewApprovedAt: calendarDateFromPropertyNow(-approvedDaysAgo),
      sourceCheckedAt: calendarDateFromPropertyNow(-approvedDaysAgo),
      nextReviewAt: calendarDateFromPropertyNow(180 - approvedDaysAgo),
      contentUpdatedAt: calendarDateFromPropertyNow(-approvedDaysAgo - 1),
      editorialStatus: 'approved',
      publicationStatus: 'published',
      blockingNotes: [],
      primaryIntent: null,
      supportingPhrases: [],
      visualAssetIds: [],
    })
  );

/**
 * A piece of evidence a locality gate decision turns on, named by the field that
 * holds it.
 *
 * Property 3 is about what happens when one of these is supplied or removed, so the
 * list is the property's input space rather than a convenience. Each entry is a field
 * whose absence the gate reports and whose presence the gate requires — exactly the
 * set Requirement 1.2, 1.13 and 1.14 enumerate.
 */
export type LocalityEvidenceField =
  | 'coverageResponsibleOwner'
  | 'author'
  | 'localReviewer'
  | 'seoReviewer'
  | 'editorialApprovedAt'
  | 'localReviewApprovedAt'
  | 'seoReviewApprovedAt'
  | 'actualServiceCoverage'
  | 'editorialStatus'
  | 'sections'
  | 'boundaryVersion';

export const LOCALITY_EVIDENCE_FIELDS: readonly LocalityEvidenceField[] = [
  'coverageResponsibleOwner',
  'author',
  'localReviewer',
  'seoReviewer',
  'editorialApprovedAt',
  'localReviewApprovedAt',
  'seoReviewApprovedAt',
  'actualServiceCoverage',
  'editorialStatus',
  'sections',
  'boundaryVersion',
];

/**
 * Remove one piece of evidence.
 *
 * "Remove" means put the field into the state that means *not supplied* for that
 * field's type: null for a name or a timestamp, `unconfirmed` for coverage, the
 * pre-approval status for the workflow, an empty list for sections, and — for the
 * boundary version — a mapping present with no version recorded, which is the case
 * Requirement 1.14 added.
 */
export function removeLocalityEvidence(
  record: LocalityRecord,
  field: LocalityEvidenceField
): LocalityRecord {
  switch (field) {
    case 'actualServiceCoverage':
      return { ...record, actualServiceCoverage: 'unconfirmed' };
    case 'editorialStatus':
      return { ...record, editorialStatus: 'seo_review' };
    case 'sections':
      return { ...record, sections: [] };
    case 'boundaryVersion':
      return {
        ...record,
        administrativeMappings: [
          {
            mappingType: 'BBMP zone and ward',
            value: 'East Zone, ward 80',
            boundaryVersion: null,
            claimId: null,
          },
        ],
      };
    default:
      return { ...record, [field]: null };
  }
}

/**
 * Supply one piece of evidence: the inverse of `removeLocalityEvidence`, restoring the
 * gate-ready value rather than an arbitrary one.
 *
 * For the boundary version the restored state is a mapping carrying a version *and* a
 * claim. The claim still has to pass the claim gate, and no ledger claim does, so this
 * case supplies the version and leaves the mapping's own claim failure in place —
 * which is the honest shape of the field and is why the property is stated as failure
 * sets shrinking rather than as verdicts flipping.
 */
export function supplyLocalityEvidence(
  record: LocalityRecord,
  field: LocalityEvidenceField
): LocalityRecord {
  switch (field) {
    case 'actualServiceCoverage':
      return { ...record, actualServiceCoverage: 'confirmed-served' };
    case 'editorialStatus':
      return { ...record, editorialStatus: 'approved' };
    case 'sections':
      return { ...record, sections: gateReadyLocalitySections('restored') };
    case 'boundaryVersion':
      return {
        ...record,
        administrativeMappings: record.administrativeMappings.map((mapping) => ({
          ...mapping,
          boundaryVersion: '2023 delimitation',
        })),
      };
    case 'coverageResponsibleOwner':
      return { ...record, coverageResponsibleOwner: 'Utpal Raj KB' };
    case 'author':
      return { ...record, author: 'A. Named Author' };
    case 'localReviewer':
      return { ...record, localReviewer: 'A. Named Local Reviewer' };
    case 'seoReviewer':
      return { ...record, seoReviewer: 'A. Named SEO Reviewer' };
    case 'editorialApprovedAt':
    case 'localReviewApprovedAt':
    case 'seoReviewApprovedAt':
      return { ...record, [field]: calendarDateFromPropertyNow(-30) };
  }
}

/** A subset of the evidence fields, including the empty and the whole set. */
export const arbLocalityEvidenceSubset: fc.Arbitrary<LocalityEvidenceField[]> = fc.uniqueArray(
  fc.constantFrom(...LOCALITY_EVIDENCE_FIELDS),
  { minLength: 0, maxLength: LOCALITY_EVIDENCE_FIELDS.length }
);

/**
 * A locality record with a randomly chosen subset of its evidence removed.
 *
 * Returned alongside the removed set, because a monotonicity property has to be able
 * to add one of them back and say which one it added.
 */
export const arbPartiallyEvidencedLocality: fc.Arbitrary<{
  readonly record: LocalityRecord;
  readonly removed: readonly LocalityEvidenceField[];
}> = fc
  .tuple(arbGateReadyLocalityRecord, arbLocalityEvidenceSubset)
  .map(([base, removed]) => ({
    record: removed.reduce(
      (accumulated, field) => removeLocalityEvidence(accumulated, field),
      base
    ),
    removed,
  }));

// ---------------------------------------------------------------------------
// Guide evidence, for the same two properties
// ---------------------------------------------------------------------------

export type GuideEvidenceField =
  | 'maintenanceOwner'
  | 'nextReviewAt'
  | 'contentUpdatedAt'
  | 'nextStep'
  | 'scopeNote'
  | 'secondSection';

export const GUIDE_EVIDENCE_FIELDS: readonly GuideEvidenceField[] = [
  'maintenanceOwner',
  'nextReviewAt',
  'contentUpdatedAt',
  'nextStep',
  'scopeNote',
  'secondSection',
];

export function removeGuideEvidence(record: GuideRecord, field: GuideEvidenceField): GuideRecord {
  switch (field) {
    case 'nextStep':
      return { ...record, nextStep: '' };
    case 'scopeNote':
      return { ...record, scopeNote: '' };
    case 'secondSection':
      return { ...record, sections: record.sections.slice(0, 1) };
    default:
      return { ...record, [field]: null };
  }
}

export function supplyGuideEvidence(record: GuideRecord, field: GuideEvidenceField): GuideRecord {
  switch (field) {
    case 'maintenanceOwner':
      return { ...record, maintenanceOwner: 'Utpal Raj KB' };
    case 'nextReviewAt':
      return { ...record, nextReviewAt: calendarDateFromPropertyNow(180) };
    case 'contentUpdatedAt':
      return { ...record, contentUpdatedAt: calendarDateFromPropertyNow(-30) };
    case 'nextStep':
      return { ...record, nextStep: 'Call the number on the page.' };
    case 'scopeNote':
      return { ...record, scopeNote: 'Generated scope note.' };
    case 'secondSection':
      return {
        ...record,
        sections: [
          record.sections[0] ?? {
            heading: 'What happens first?',
            headingIntentEntryId: record.primaryIntent?.intentEntryId ?? null,
            paragraphs: ['Generated body paragraph.'],
          },
          {
            heading: 'What happens next?',
            headingIntentEntryId: record.primaryIntent?.intentEntryId ?? null,
            paragraphs: ['Another generated body paragraph.'],
          },
        ],
      };
  }
}

export const arbGuideEvidenceSubset: fc.Arbitrary<GuideEvidenceField[]> = fc.uniqueArray(
  fc.constantFrom(...GUIDE_EVIDENCE_FIELDS),
  { minLength: 0, maxLength: GUIDE_EVIDENCE_FIELDS.length }
);

export const arbPartiallyEvidencedGuide: fc.Arbitrary<{
  readonly record: GuideRecord;
  readonly removed: readonly GuideEvidenceField[];
}> = fc.tuple(arbGateReadyGuideRecord, arbGuideEvidenceSubset).map(([base, removed]) => {
  const published: GuideRecord = { ...base, publicationStatus: 'published' };
  return {
    record: removed.reduce<GuideRecord>(
      (accumulated, field) => removeGuideEvidence(accumulated, field),
      published
    ),
    removed,
  };
});

// ---------------------------------------------------------------------------
// Staleness
// ---------------------------------------------------------------------------

/**
 * The ways evidence goes stale between two dates, from Property 4.
 *
 * `claim-recheck` is the claim ledger's own expiry; the other three belong to the
 * record. A photograph's licence and release expiry is the fifth and is generated by
 * `arbVisualAsset` above, which already spans expired and unexpired.
 */
export type StalenessKind =
  | 'claim-recheck'
  | 'record-review'
  | 'content-after-approval'
  | 'guide-review';

export const STALENESS_KINDS: readonly StalenessKind[] = [
  'claim-recheck',
  'record-review',
  'content-after-approval',
  'guide-review',
];

/**
 * A number of days after `PROPERTY_NOW` at which a second evaluation happens.
 *
 * At least one day, so the two dates are genuinely ordered, and up to two years, so a
 * staleness window sits comfortably inside the range.
 */
export const arbDaysLater: fc.Arbitrary<number> = fc.integer({ min: 1, max: 730 });

// ===========================================================================
// BEGIN hub grouping generators (task 9.5, Property 7)
//
// Whole published sets rather than single records: many records per group, group
// sizes on both sides of the 25-link cap and above 50, unique slugs, and names that
// stress the one comparator both hubs order by. Exported so any property that needs
// a published set — hub grouping, surface agreement — draws from the same space.
// ===========================================================================

/**
 * Display strings that stress the comparator. Each row targets one way ordering
 * goes wrong:
 *
 *  - case pairs ("HSR Layout" / "hsr layout") share an ordering key, so only the
 *    raw-string tie-break separates them;
 *  - accent triples, precomposed ("Émile", U+00C9), decomposed ("E" + U+0301) and
 *    bare, fold to one key and differ only in raw code points;
 *  - punctuation ("HSR-Layout", "Koramangala (5th Block)") collapses to spaces;
 *  - Kannada names keep their vowel signs through the fold;
 *  - "Ø" is a base letter with no decomposition, so the fold must leave it alone;
 *  - characters above U+FFFF ("𝐀", "🌳") sort after U+FF41 ("ａ") by code point but
 *    before it by UTF-16 code unit, which is the `<` operator's mistake.
 *
 * Plain stems recur on purpose, so two records in one group share a name often and
 * the slug tie-break is exercised. No stem carries a word the guide classifier's
 * lexicons match, so a guide question built from one stays own-process.
 */
export const HUB_NAME_STEMS: readonly string[] = [
  'HSR Layout',
  'hsr layout',
  'HSR-Layout',
  'Émile Nagar',
  'E\u0301mile Nagar',
  'emile nagar',
  'Alpha Layout',
  'alpha Layout',
  'Koramangala (5th Block)',
  'Zeta Park',
  'ಬೆಂಗಳೂರು',
  'ಮಲ್ಲೇಶ್ವರಂ',
  'Øster Cross',
  'ａ Park',
  '𝐀 Park',
  '🌳 Garden',
];

const HUB_NAME_SUFFIXES: readonly string[] = ['', ' Block', ' Stage', ' Cross', ' ಹಂತ'];

/**
 * A locality name or guide subject: a bare stem, or a stem with a suffix and a
 * number. The numbers run past 9 so "10" and "9" meet, which code-point order puts
 * the other way round from numeric order — deliberately not special-cased.
 */
export const arbHubDisplayName: fc.Arbitrary<string> = fc.oneof(
  { arbitrary: fc.constantFrom(...HUB_NAME_STEMS), weight: 2 },
  {
    arbitrary: fc
      .tuple(
        fc.constantFrom(...HUB_NAME_STEMS),
        fc.constantFrom(...HUB_NAME_SUFFIXES),
        fc.integer({ min: 1, max: 120 })
      )
      .map(([stem, suffix, n]) => `${stem}${suffix} ${n}`),
    weight: 3,
  }
);

/**
 * `marketingGroup` labels with the same stresses as the names: a case pair
 * ("Central" / "central") that are two distinct groups sharing one ordering key, an
 * accented variant, a Kannada label, a fullwidth and a supplementary-plane initial.
 * Nine labels, so a set can hold up to six groups without exhausting the pool.
 */
export const HUB_GROUP_LABEL_POOL: readonly string[] = [
  'Central',
  'central',
  'East side',
  'Éast side',
  'North and north-east',
  'ಪೂರ್ವ ಭಾಗ',
  'ｗest side',
  '𝐒outh side',
  'Lakeside (outer)',
];

/** Every customer intent, so a guide set can populate any of the six guide-hub groups. */
export const HUB_GUIDE_INTENTS: readonly CustomerIntent[] = [
  'buy',
  'sell',
  'rent',
  'rent-out',
  'commercial',
  'general',
];

/**
 * A group size weighted towards the cases the cap turns on: small groups, the
 * 24/25/26 boundary, sizes between 26 and 50 (so above 40), and 50, 51 and beyond,
 * where the overflow is itself longer than the visible list.
 */
export const arbHubGroupSize: fc.Arbitrary<number> = fc.oneof(
  { arbitrary: fc.integer({ min: 1, max: 5 }), weight: 3 },
  { arbitrary: fc.constantFrom(24, 25, 26), weight: 3 },
  { arbitrary: fc.integer({ min: 27, max: 49 }), weight: 1 },
  { arbitrary: fc.constantFrom(50, 51), weight: 1 },
  { arbitrary: fc.integer({ min: 52, max: 60 }), weight: 1 }
);

/** Distinct group keys, each with a size. Empty is a valid draw: nothing published. */
function arbHubGroupSizes<K extends string>(
  keys: readonly K[]
): fc.Arbitrary<(readonly [K, number])[]> {
  return fc.uniqueArray(fc.tuple(fc.constantFrom(...keys), arbHubGroupSize), {
    selector: ([key]) => key,
    minLength: 0,
    maxLength: Math.min(keys.length, 6),
  });
}

/** One group key per record, in group-major order; shuffled by the caller. */
function expandHubGroupSizes<K extends string>(groups: readonly (readonly [K, number])[]): K[] {
  return groups.flatMap(([key, size]) => Array.from({ length: size }, () => key));
}

/** `count` pairwise-distinct canonical slugs. */
function arbDistinctSlugs(count: number): fc.Arbitrary<string[]> {
  return fc.uniqueArray(arbSlug, { minLength: count, maxLength: count });
}

/** Every element of `list`, in a generated order. */
export function arbShuffled<T>(list: readonly T[]): fc.Arbitrary<T[]> {
  return fc.shuffledSubarray([...list], { minLength: list.length, maxLength: list.length });
}

/** A generated list paired with a generated permutation of it, for order-invariance properties. */
export function arbWithPermutation<T>(arb: fc.Arbitrary<T[]>): fc.Arbitrary<[T[], T[]]> {
  return arb.chain((list) => arbShuffled(list).map((permuted): [T[], T[]] => [list, permuted]));
}

/**
 * A published locality set: every record gate-ready at `PROPERTY_NOW`, slugs
 * pairwise distinct, up to six `marketingGroup`s from `HUB_GROUP_LABEL_POOL`, each
 * sized by `arbHubGroupSize`, handed back in a generated order rather than grouped.
 *
 * Built on one `arbGateReadyLocalityRecord` draw, overriding only fields the gate
 * does not read — identity, name, group, summary — plus the sections, re-seeded by
 * slug so no two records in a set carry the same section text.
 */
export const arbPublishedLocalitySet: fc.Arbitrary<LocalityRecord[]> = arbHubGroupSizes(
  HUB_GROUP_LABEL_POOL
)
  .chain((groups) => {
    const labels = expandHubGroupSizes(groups);
    return fc
      .tuple(
        arbGateReadyLocalityRecord,
        arbDistinctSlugs(labels.length),
        fc.array(arbHubDisplayName, { minLength: labels.length, maxLength: labels.length })
      )
      .map(([base, slugs, names]) =>
        labels.map(
          (marketingGroup, index): LocalityRecord => ({
            ...base,
            entityId: `LOC-HUB-${slugs[index]}`,
            slug: slugs[index],
            canonicalName: names[index],
            marketingGroup,
            summary: `Generated summary ${slugs[index]}.`,
            sections: gateReadyLocalitySections(slugs[index]),
          })
        )
      );
  })
  .chain(arbShuffled);

/**
 * Customer questions around a generated name, varying the leading case so
 * "what …" and "What …" meet. `{name}` is replaced with a function, so a name can
 * never be read as a replacement pattern.
 */
const HUB_GUIDE_QUESTION_FRAMES: readonly string[] = [
  'What should I check in {name}?',
  'what happens next in {name}?',
  'How does a search in {name} start?',
  '{name}?',
];

/**
 * A published guide set: every record gate-ready at `PROPERTY_NOW`, slugs pairwise
 * distinct, up to all six intents, each sized by `arbHubGroupSize`, in a generated
 * order.
 *
 * Built on one `arbGateReadyGuideRecord` draw with publication forced on and the
 * register phrase dropped, so a large set does not have dozens of records sharing
 * one primary intent — a registry-level conflict, not a hub-grouping one. Generated
 * slugs never reach a field the guide classifier reads.
 */
export const arbPublishedGuideSet: fc.Arbitrary<GuideRecord[]> = arbHubGroupSizes(HUB_GUIDE_INTENTS)
  .chain((groups) => {
    const intents = expandHubGroupSizes(groups);
    return fc
      .tuple(
        arbGateReadyGuideRecord,
        arbDistinctSlugs(intents.length),
        fc.array(fc.tuple(arbHubDisplayName, fc.constantFrom(...HUB_GUIDE_QUESTION_FRAMES)), {
          minLength: intents.length,
          maxLength: intents.length,
        })
      )
      .map(([base, slugs, subjects]) =>
        intents.map((intent, index): GuideRecord => {
          const [name, frame] = subjects[index];
          const question = frame.replace('{name}', () => name);
          return {
            ...base,
            guideId: `GD-HUB-${slugs[index]}`,
            slug: slugs[index],
            question,
            title: question.replace(/\?$/, ''),
            // Not the slug: the classifier scans the description, and a random slug
            // token reads as a figure ("rs9" is a rupee amount) or a lexicon word.
            description: `Generated hub record ${index + 1}.`,
            intent,
            publicationStatus: 'published',
            primaryIntent: null,
            sections: base.sections.map((section) => ({ ...section, headingIntentEntryId: null })),
          };
        })
      );
  })
  .chain(arbShuffled);

// ===========================================================================
// END hub grouping generators (task 9.5, Property 7)
// ===========================================================================

// ===========================================================================
// BEGIN gate-failing leak generators (task 9.6, Property 1)
// ===========================================================================
//
// Property 1: a record the publication gate rejects contributes nothing to any
// public surface. The generators below build such records from a gate-ready,
// fully marked baseline plus one or two recorded failure modes, so that:
//
//  - every text field that could leak carries the record's own marker, and a leak
//    through any field is a substring search whichever field it went through;
//  - each record fails for a reason a requirement names, not for whatever a random
//    record happens to lack, so a counterexample says which rule was bypassed;
//  - the baseline is gate-ready, so a test can assert it passes before the failure
//    is applied — a broken baseline shows up as a test bug, never as a vacuous pass.

/**
 * A marker naming its record: `ZZMARKER-fail2x3f9a1c` is failing record 2 of the
 * scenario salted `3f9a1c`.
 *
 * The index is closed by `x`, so marker 1 is never a prefix of marker 10. The kind
 * (`fail`, `pass`, `unev`, `gfail`, …) always carries a letter outside `a`–`f`, so a
 * leak marker can never be a substring of an `arbMarker` hex marker or the reverse.
 */
export function leakRecordMarker(kind: string, index: number, salt: string): string {
  return `${MARKER_PREFIX}-${kind}${index}x${salt}`;
}

/** One salt per generated scenario, shared by every marker and slug in it. */
export const arbLeakSalt: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 0xffffff })
  .map((value) => value.toString(16).padStart(6, '0'));

/** A paragraph of exactly `words` words whose first word carries the marker. */
function leakParagraph(marker: string, label: string, words: number): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? `${marker}-${label}` : 'word')).join(
    ' '
  );
}

/** The first `words` whitespace-separated words of `text`. */
function firstWords(text: string, words: number): string {
  return text.trim().split(/\s+/).slice(0, words).join(' ');
}

/** A claim passing the claim gate at `PROPERTY_NOW` and for two days after, under a fixed ID. */
export function arbGatePassingClaimWithId(claimId: string): fc.Arbitrary<ClaimRecord> {
  return arbGatePassingClaim.map((claim) => ({ ...claim, claimId }));
}

const FAILING_CLAIM_DEGRADATIONS: readonly ClaimDegradation[] = CLAIM_DEGRADATIONS.filter(
  (degradation) => degradation !== 'none'
);

/**
 * A claim failing the claim gate for exactly one recorded reason, under a fixed ID.
 *
 * Every degradation except `none` is a failure that does not depend on the clock
 * running backwards — an expired recheck is at least two days in the past — so the
 * claim fails at `PROPERTY_NOW` and at every later instant.
 */
export function arbGateFailingClaimWithId(claimId: string): fc.Arbitrary<ClaimRecord> {
  return fc
    .tuple(
      arbGatePassingClaim,
      fc.constantFrom(...FAILING_CLAIM_DEGRADATIONS),
      fc.constantFrom(...CLAIM_APPROVAL_STATUSES),
      arbNonAttributableReviewer,
      arbIsoDateBefore(PROPERTY_NOW),
      fc.array(arbFailingSourceRecord, { minLength: 2, maxLength: 3 })
    )
    .map(([base, degradation, status, reviewer, pastDate, degradedSources]) => ({
      ...degradeClaim(base, degradation, { status, reviewer, pastDate, degradedSources }),
      claimId,
    }));
}

/**
 * A locality record that passes the locality gate from `PROPERTY_NOW` to the end of
 * that day, carrying `marker` in every field a page, the hub, a link, the metadata or
 * the sitemap could print: name, alias, browsing group, summary, both section
 * headings and paragraphs, the FAQ question and answer, the administrative mapping's
 * type, value and boundary version, the blocking note, the intent phrases and the
 * entity identifier.
 *
 * `mappingClaimId` must name a claim that passes the claim gate — the caller layers it
 * into the ledger — or be null for a record with no administrative mapping.
 */
export function markedGateReadyLocality(
  marker: string,
  slug: string,
  mappingClaimId: string | null
): LocalityRecord {
  return {
    entityId: `LOC-${marker}`,
    canonicalName: `${marker}-name`,
    aliases: [`${marker}-alias`],
    entityType: 'locality',
    slug,
    marketingGroup: `${marker}-group`,
    administrativeMappings: mappingClaimId
      ? [
          {
            mappingType: `${marker}-mapping-type`,
            value: `${marker}-mapping-value`,
            boundaryVersion: `${marker}-boundary-version`,
            claimId: mappingClaimId,
          },
        ]
      : [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'Utpal Raj KB',
    summary: `${marker}-summary states no external facts.`,
    summaryClaimIds: [],
    sections: [
      {
        sectionId: `${marker}-a`,
        heading: `${marker}-heading-a?`,
        paragraphs: [leakParagraph(marker, 'paragraph-a', MIN_SECTION_WORDS)],
        claimIds: [],
      },
      {
        sectionId: `${marker}-b`,
        heading: `${marker}-heading-b?`,
        paragraphs: [leakParagraph(marker, 'paragraph-b', MIN_SECTION_WORDS)],
        claimIds: [],
      },
    ],
    approvedFaq: [{ question: `${marker}-faq-question?`, answer: `${marker}-faq-answer.`, claimIds: [] }],
    approvedNearbyRelationships: [],
    relatedGuideIds: [],
    postalMappingIds: [],
    imageRightsRecords: [],
    author: 'A. Named Author',
    localReviewer: 'A. Named Local Reviewer',
    seoReviewer: 'A. Named SEO Reviewer',
    editorialApprovedAt: calendarDateFromPropertyNow(-10),
    localReviewApprovedAt: calendarDateFromPropertyNow(-10),
    seoReviewApprovedAt: calendarDateFromPropertyNow(-10),
    sourceCheckedAt: calendarDateFromPropertyNow(-10),
    nextReviewAt: calendarDateFromPropertyNow(90),
    contentUpdatedAt: calendarDateFromPropertyNow(-11),
    editorialStatus: 'approved',
    publicationStatus: 'published',
    blockingNotes: [`${marker}-blocking-note`],
    primaryIntent: { intentEntryId: `SIE-${marker}`, phrase: `${marker}-intent-phrase` },
    supportingPhrases: [`${marker}-supporting-phrase`],
    visualAssetIds: [],
  };
}

/**
 * Every way a locality record fails the publication gate, each traceable to the
 * requirement that names it: publication and editorial status and coverage (1.2,
 * 1.13), sign-offs (11.2), the review date — absent, unreadable, passed, or equal to
 * the evaluation date (11.6, "on or after") — section depth (1.5), mappings (1.7,
 * 1.14), claims on any surface of the record including one reviewed by a desk name
 * (1.12, 11.3 via the claim gate), and a region hub below its thresholds (2.9).
 */
export const LOCALITY_GATE_FAILURE_MODES = [
  'unpublished',
  'editorial-not-approved',
  'coverage-not-confirmed',
  'no-coverage-owner',
  'missing-sign-off-name',
  'missing-approval-timestamp',
  'review-date-passed',
  'review-due-on-evaluation-date',
  'no-review-date',
  'unparseable-review-date',
  'no-sections',
  'one-section',
  'shallow-section',
  'repeated-section',
  'mapping-without-boundary-version',
  'mapping-without-claim',
  'mapping-claim-fails',
  'summary-claim-fails',
  'section-claim-reviewed-by-desk-name',
  'faq-claim-not-in-ledger',
  'relationship-claim-fails',
  'region-hub-below-threshold',
] as const;

export type LocalityGateFailureMode = (typeof LOCALITY_GATE_FAILURE_MODES)[number];

/** A claim ID no ledger holds, so the gate reports it missing. */
export const UNLEDGERED_CLAIM_ID = 'CLM-ZZ-HELD-IN-NO-LEDGER';

/** One to two failure modes, and the values each mode needs to be applied. */
export interface LocalityGateFailure {
  readonly modes: readonly LocalityGateFailureMode[];
  readonly signOffField: 'author' | 'localReviewer' | 'seoReviewer';
  readonly approvalField: 'editorialApprovedAt' | 'localReviewApprovedAt' | 'seoReviewApprovedAt';
  readonly editorialStatus: Exclude<LocalityRecord['editorialStatus'], 'approved'>;
  readonly coverage: Exclude<LocalityRecord['actualServiceCoverage'], 'confirmed-served'>;
  /** At least one, so a passed review date is genuinely in the past. */
  readonly reviewDaysAgo: number;
  /** Fails the claim gate for one recorded reason. The caller layers it into the ledger. */
  readonly failingClaim: ClaimRecord;
  /** Passes the claim gate in every respect but its reviewer, a desk name. Layered too. */
  readonly deskReviewedClaim: ClaimRecord;
}

/** `claimIdPrefix` keeps the two claims' IDs distinct across records in one scenario. */
export function arbLocalityGateFailure(claimIdPrefix: string): fc.Arbitrary<LocalityGateFailure> {
  return fc.record({
    modes: fc.uniqueArray(fc.constantFrom(...LOCALITY_GATE_FAILURE_MODES), { minLength: 1, maxLength: 2 }),
    signOffField: fc.constantFrom<LocalityGateFailure['signOffField']>('author', 'localReviewer', 'seoReviewer'),
    approvalField: fc.constantFrom<LocalityGateFailure['approvalField']>(
      'editorialApprovedAt',
      'localReviewApprovedAt',
      'seoReviewApprovedAt'
    ),
    editorialStatus: fc.constantFrom<LocalityGateFailure['editorialStatus']>(
      'candidate',
      'research',
      'draft',
      'fact_review',
      'editorial_review',
      'seo_review'
    ),
    coverage: fc.constantFrom<LocalityGateFailure['coverage']>('unconfirmed', 'not-served'),
    reviewDaysAgo: fc.integer({ min: 1, max: 400 }),
    failingClaim: arbGateFailingClaimWithId(`${claimIdPrefix}-FAILING`),
    deskReviewedClaim: fc
      .tuple(arbGatePassingClaim, arbNonAttributableReviewer)
      .map(([claim, reviewer]) => ({ ...claim, claimId: `${claimIdPrefix}-DESK`, reviewer })),
  });
}

/** Maps every mapping, adding a marked one first if the record carries none. */
function withEveryMapping(
  record: LocalityRecord,
  change: (mapping: LocalityRecord['administrativeMappings'][number]) => LocalityRecord['administrativeMappings'][number]
): LocalityRecord {
  const mappings =
    record.administrativeMappings.length > 0
      ? record.administrativeMappings
      : [
          {
            mappingType: `${record.canonicalName}-mapping-type`,
            value: `${record.canonicalName}-mapping-value`,
            boundaryVersion: `${record.canonicalName}-boundary-version`,
            claimId: null,
          },
        ];
  return { ...record, administrativeMappings: mappings.map(change) };
}

function applyLocalityGateFailureMode(
  record: LocalityRecord,
  mode: LocalityGateFailureMode,
  failure: LocalityGateFailure
): LocalityRecord {
  switch (mode) {
    case 'unpublished':
      return { ...record, publicationStatus: 'unpublished' };
    case 'editorial-not-approved':
      return { ...record, editorialStatus: failure.editorialStatus };
    case 'coverage-not-confirmed':
      return { ...record, actualServiceCoverage: failure.coverage };
    case 'no-coverage-owner':
      return { ...record, coverageResponsibleOwner: null };
    case 'missing-sign-off-name':
      return { ...record, [failure.signOffField]: null };
    case 'missing-approval-timestamp':
      return { ...record, [failure.approvalField]: null };
    case 'review-date-passed':
      return { ...record, nextReviewAt: calendarDateFromPropertyNow(-failure.reviewDaysAgo) };
    case 'review-due-on-evaluation-date':
      return { ...record, nextReviewAt: calendarDateFromPropertyNow(0) };
    case 'no-review-date':
      return { ...record, nextReviewAt: null };
    case 'unparseable-review-date':
      return { ...record, nextReviewAt: 'after the monsoon' };
    case 'no-sections':
      return { ...record, sections: [] };
    case 'one-section':
      return { ...record, sections: record.sections.slice(0, 1) };
    case 'shallow-section':
      return {
        ...record,
        sections: record.sections.map((section, index) =>
          index === record.sections.length - 1
            ? { ...section, paragraphs: [firstWords(section.paragraphs.join(' '), MIN_SECTION_WORDS - 1)] }
            : section
        ),
      };
    case 'repeated-section': {
      const [first] = record.sections;
      if (!first) return record;
      return { ...record, sections: [first, { ...first, sectionId: `${first.sectionId}-again` }] };
    }
    case 'mapping-without-boundary-version':
      return withEveryMapping(record, (mapping) => ({ ...mapping, boundaryVersion: null }));
    case 'mapping-without-claim':
      return withEveryMapping(record, (mapping) => ({ ...mapping, claimId: null }));
    case 'mapping-claim-fails':
      return withEveryMapping(record, (mapping) => ({ ...mapping, claimId: failure.failingClaim.claimId }));
    case 'summary-claim-fails':
      return { ...record, summaryClaimIds: [...record.summaryClaimIds, failure.failingClaim.claimId] };
    case 'section-claim-reviewed-by-desk-name':
      return record.sections.length > 0
        ? {
            ...record,
            sections: record.sections.map((section, index) =>
              index === 0 ? { ...section, claimIds: [...section.claimIds, failure.deskReviewedClaim.claimId] } : section
            ),
          }
        : { ...record, summaryClaimIds: [...record.summaryClaimIds, failure.deskReviewedClaim.claimId] };
    case 'faq-claim-not-in-ledger':
      return {
        ...record,
        approvedFaq: [
          {
            question: `${record.canonicalName} unledgered question?`,
            answer: `${record.canonicalName} unledgered answer.`,
            claimIds: [UNLEDGERED_CLAIM_ID],
          },
          ...record.approvedFaq,
        ],
      };
    case 'relationship-claim-fails':
      return {
        ...record,
        approvedNearbyRelationships: [
          ...record.approvedNearbyRelationships,
          {
            slug: `${record.slug}-next-door`,
            relationship: `${record.canonicalName} nearby statement`,
            claimId: failure.failingClaim.claimId,
          },
        ],
      };
    case 'region-hub-below-threshold':
      return { ...record, entityType: 'region-hub' };
  }
}

/** Applies each mode in order. Every mode only removes evidence, so order changes no verdict. */
export function applyLocalityGateFailure(record: LocalityRecord, failure: LocalityGateFailure): LocalityRecord {
  return failure.modes.reduce(
    (current, mode) => applyLocalityGateFailureMode(current, mode, failure),
    record
  );
}

/**
 * A guide record that passes `evaluateGuide` from `PROPERTY_NOW` to the end of that
 * day, carrying `marker` in every field a page could print: question, title,
 * description, direct answer, both section headings, paragraphs and bullets, next
 * step, scope note, blocking note and intent phrases.
 *
 * The direct answer is the marker plus `GENERATED_DIRECT_ANSWER`, 30 words, and no
 * marked field carries a lexicon word or a figure shape, so the classifier agrees the
 * record is own-process. Headings name the register entry the record's approved
 * phrase came from, so the heading provenance condition binds and is met.
 */
export function markedGateReadyGuide(marker: string, slug: string, intent: CustomerIntent): GuideRecord {
  const entryId = `SIE-${marker}`;
  return {
    guideId: `GD-${marker}`,
    slug,
    question: `${marker} what should I ask first?`,
    title: `${marker} what to ask first`,
    description: `${marker}-description.`,
    intent,
    contentClass: 'own-process',
    directAnswer: `${marker} ${GENERATED_DIRECT_ANSWER}`,
    sections: [
      {
        heading: `${marker} what happens first?`,
        headingIntentEntryId: entryId,
        paragraphs: [`${marker}-paragraph-a.`],
        bullets: [`${marker}-bullet-a`],
      },
      {
        heading: `${marker} what happens next?`,
        headingIntentEntryId: entryId,
        paragraphs: [`${marker}-paragraph-b.`],
      },
    ],
    nextStep: `${marker} call the number on the page.`,
    scopeNote: `${marker}-scope-note.`,
    attributedTo: CANONICAL_BRAND,
    namedAuthor: null,
    subjectReviewer: null,
    claimIds: [],
    contentUpdatedAt: calendarDateFromPropertyNow(-30),
    publicationStatus: 'published',
    relatedGuideIds: [],
    blockingNotes: [`${marker}-blocking-note`],
    maintenanceOwner: 'Utpal Raj KB',
    nextReviewAt: calendarDateFromPropertyNow(180),
    primaryIntent: { intentEntryId: entryId, phrase: `${marker}-intent-phrase` },
    supportingPhrases: [`${marker}-supporting-phrase`],
    visualAssetIds: [],
  };
}

/**
 * Every way a guide fails `evaluateGuide`: the five conditions Requirement 4.6 names
 * that the type can express (direct answer, two sections, attribution, content date;
 * the content class is a required field, so "no class" is not representable), and the
 * conditions later requirements added — publication status, the 20-to-60-word answer
 * (5.3), question headings (5.4), a named maintenance owner and a live review date
 * within twelve months (4.10, 4.13), a next step and a scope note (4.12), the
 * external-fact conditions (4.3, 4.11) and the claim gate (4.8).
 */
export const GUIDE_GATE_FAILURE_MODES = [
  'unpublished',
  'no-direct-answer',
  'direct-answer-over-60-words',
  'no-sections',
  'one-section',
  'heading-not-a-question',
  'no-attribution',
  'no-content-date',
  'no-maintenance-owner',
  'maintenance-owner-not-attributable',
  'no-review-date',
  'review-date-passed',
  'review-window-over-12-months',
  'no-next-step',
  'no-scope-note',
  'external-fact-without-evidence',
  'classifier-reads-external-fact',
  'claim-fails',
] as const;

export type GuideGateFailureMode = (typeof GUIDE_GATE_FAILURE_MODES)[number];

export interface GuideGateFailure {
  readonly modes: readonly GuideGateFailureMode[];
  readonly deskName: string;
  readonly reviewDaysAgo: number;
  /** Fails the claim gate for one recorded reason. The caller layers it into the ledger. */
  readonly failingClaim: ClaimRecord;
}

export function arbGuideGateFailure(claimId: string): fc.Arbitrary<GuideGateFailure> {
  return fc.record({
    modes: fc.uniqueArray(fc.constantFrom(...GUIDE_GATE_FAILURE_MODES), { minLength: 1, maxLength: 2 }),
    deskName: arbNonAttributableReviewer,
    reviewDaysAgo: fc.integer({ min: 1, max: 400 }),
    failingClaim: arbGateFailingClaimWithId(claimId),
  });
}

function applyGuideGateFailureMode(
  record: GuideRecord,
  mode: GuideGateFailureMode,
  failure: GuideGateFailure
): GuideRecord {
  switch (mode) {
    case 'unpublished':
      return { ...record, publicationStatus: 'unpublished' };
    case 'no-direct-answer':
      return { ...record, directAnswer: '' };
    case 'direct-answer-over-60-words':
      return {
        ...record,
        directAnswer: `${record.guideId} ${GENERATED_DIRECT_ANSWER} ${GENERATED_DIRECT_ANSWER} ${GENERATED_DIRECT_ANSWER}`,
      };
    case 'no-sections':
      return { ...record, sections: [] };
    case 'one-section':
      return { ...record, sections: record.sections.slice(0, 1) };
    case 'heading-not-a-question':
      return {
        ...record,
        sections: record.sections.map((section, index) =>
          index === 0 ? { ...section, heading: section.heading.replace(/\?+\s*$/, '') } : section
        ),
      };
    case 'no-attribution':
      return { ...record, attributedTo: '' };
    case 'no-content-date':
      return { ...record, contentUpdatedAt: null };
    case 'no-maintenance-owner':
      return { ...record, maintenanceOwner: null };
    case 'maintenance-owner-not-attributable':
      return { ...record, maintenanceOwner: failure.deskName };
    case 'no-review-date':
      return { ...record, nextReviewAt: null };
    case 'review-date-passed':
      return { ...record, nextReviewAt: calendarDateFromPropertyNow(-failure.reviewDaysAgo) };
    case 'review-window-over-12-months':
      return { ...record, nextReviewAt: calendarDateFromPropertyNow(400) };
    case 'no-next-step':
      return { ...record, nextStep: '' };
    case 'no-scope-note':
      return { ...record, scopeNote: '' };
    case 'external-fact-without-evidence':
      return { ...record, contentClass: 'external-fact' };
    case 'classifier-reads-external-fact':
      return { ...record, description: `${record.description} Who pays the stamp duty on the agreement.` };
    case 'claim-fails':
      return { ...record, claimIds: [...record.claimIds, failure.failingClaim.claimId] };
  }
}

export function applyGuideGateFailure(record: GuideRecord, failure: GuideGateFailure): GuideRecord {
  return failure.modes.reduce((current, mode) => applyGuideGateFailureMode(current, mode, failure), record);
}

/** Any customer intent, so a failing guide can land on every service page that lists guides. */
export const arbLeakGuideIntent: fc.Arbitrary<CustomerIntent> = fc.constantFrom<CustomerIntent>(
  'buy',
  'sell',
  'rent',
  'rent-out',
  'commercial',
  'general'
);
// ===========================================================================
// END gate-failing leak generators (task 9.6, Property 1)
// ===========================================================================

// ===========================================================================
// BEGIN crawler access generators (task 12.5, Property 15)
// ===========================================================================
//
// Property 15: crawler access fails closed, and the two crawler decisions are
// independent. The generators below span every recorded field of a crawler
// decision and every environment input robots.txt reads, and each one carries
// its own oracle, worked out field by field from the requirement rather than by
// calling the code under test:
//
//  - a decision's `expectedGrant` is true only for the value `allowed` with an
//    accountable decider, a decision date on or before the evaluation day, a
//    guidance reference, an accountable verifier and a verification 0 to 90 days
//    old (Requirements 6.4, 6.5, 6.10 and 6.11);
//  - an environment's `opensCrawling` is true only for a deploy value of exactly
//    `production` with a usable https origin and a truthy confirmation flag
//    (Requirements 6.1 and 6.2).
//
// Every good option is weighted up, so a hundred runs reach the granting branch
// and the open environment often enough to prove something about both sides.
// Dates are positioned from `PROPERTY_NOW`'s calendar day, because the 90-day
// boundary is the interesting place and a uniform date reaches it roughly never.

import type { CrawlerAccessDecision } from '@/config/crawler-access';

/** One generated field value and whether the requirement accepts it. */
interface CrawlerField<T> {
  readonly value: T;
  readonly ok: boolean;
}

const good = <T>(value: T): CrawlerField<T> => ({ value, ok: true });
const bad = <T>(value: T): CrawlerField<T> => ({ value, ok: false });

const RECOGNISED_ACCESS_DECISIONS: readonly string[] = ['allowed', 'disallowed', 'unrecorded'];

/**
 * A decision value: the three recognised values, and strings that are none of
 * them — near misses in case and spacing included, since `Allowed` granting
 * access would be the fail-open mistake.
 */
export const arbCrawlerDecisionValue: fc.Arbitrary<{
  readonly value: string;
  readonly kind: 'allowed' | 'disallowed' | 'unrecorded' | 'invalid';
}> = fc.oneof(
  { weight: 5, arbitrary: fc.constant({ value: 'allowed', kind: 'allowed' as const }) },
  { weight: 2, arbitrary: fc.constant({ value: 'disallowed', kind: 'disallowed' as const }) },
  { weight: 1, arbitrary: fc.constant({ value: 'unrecorded', kind: 'unrecorded' as const }) },
  {
    weight: 2,
    arbitrary: fc
      .oneof(
        fc.constantFrom('Allowed', 'ALLOWED', ' allowed', 'allowed ', 'allow', 'yes', 'true', ''),
        fc.string({ maxLength: 12 })
      )
      .filter((value) => !RECOGNISED_ACCESS_DECISIONS.includes(value))
      .map((value) => ({ value, kind: 'invalid' as const })),
  }
);

/**
 * A deciding or verifying person. Accountable names pass; null, blank, too-short
 * and desk names — in any case and with padding — do not.
 */
export const arbCrawlerPerson: fc.Arbitrary<CrawlerField<string | null>> = fc.oneof(
  {
    weight: 5,
    arbitrary: fc.oneof(
      fc.constantFrom('Fixture Decider', 'Fixture Verifier', 'Fixture Person'),
      arbMarker.map((marker) => `Person ${marker}`)
    ).map(good),
  },
  {
    weight: 1,
    arbitrary: fc
      .oneof(
        fc.constantFrom<string | null>(null, '', '   ', 'Al', ' Al '),
        fc
          .tuple(
            fc.constantFrom(...NON_ATTRIBUTABLE_REVIEWER_NAMES),
            fc.constantFrom<(name: string) => string>(
              (name) => name,
              (name) => name.toUpperCase(),
              (name) => name.replace(/\b\w/g, (letter) => letter.toUpperCase()),
              (name) => `  ${name}  `
            )
          )
          .map(([name, variant]) => variant(name))
      )
      .map(bad),
  }
);

/** Strings that are not a calendar date that exists. */
const arbMalformedCalendarDate: fc.Arbitrary<string | null> = fc.constantFrom<string | null>(
  null,
  '',
  '   ',
  '2026-02-30',
  '2026-9-1',
  '29/09/2026',
  'yesterday'
);

/** A decision date: on or before the evaluation day passes; later, absent or malformed does not. */
export const arbCrawlerDecisionDate: fc.Arbitrary<CrawlerField<string | null>> = fc.oneof(
  { weight: 5, arbitrary: fc.integer({ min: 0, max: 400 }).map((days) => good(calendarDateFromPropertyNow(-days))) },
  {
    weight: 1,
    arbitrary: fc.oneof(
      fc.integer({ min: 1, max: 60 }).map((days) => bad<string | null>(calendarDateFromPropertyNow(days))),
      arbMalformedCalendarDate.map(bad)
    ),
  }
);

/** A guidance document reference: any non-blank text passes. */
export const arbCrawlerGuidanceReference: fc.Arbitrary<CrawlerField<string | null>> = fc.oneof(
  { weight: 5, arbitrary: arbMarkedText('Crawler operator guidance').map((text) => good<string | null>(text)) },
  { weight: 1, arbitrary: fc.constantFrom<string | null>(null, '', '   ').map(bad) }
);

/**
 * A verification date and its age in whole calendar days before the evaluation
 * day. Ages cluster on the 90-day boundary; a negative age is a future date.
 */
export const arbCrawlerVerificationDate: fc.Arbitrary<
  CrawlerField<string | null> & { readonly ageDays: number | null }
> = fc.oneof(
  { weight: 3, arbitrary: fc.integer({ min: 85, max: 95 }) },
  { weight: 3, arbitrary: fc.integer({ min: 0, max: 90 }) },
  { weight: 1, arbitrary: fc.integer({ min: 91, max: 400 }) },
  { weight: 1, arbitrary: fc.integer({ min: -60, max: -1 }) },
  { weight: 1, arbitrary: arbMalformedCalendarDate }
).map((age) =>
  typeof age === 'number'
    ? { value: calendarDateFromPropertyNow(-age), ok: age >= 0 && age <= 90, ageDays: age }
    : { value: age, ok: false, ageDays: null }
);

export interface GeneratedCrawlerDecision {
  readonly decision: CrawlerAccessDecision;
  /** The oracle: every field is in order and the value is `allowed`. */
  readonly expectedGrant: boolean;
  /** Days from a valid recorded verification to the evaluation day; null when none. */
  readonly verificationAgeDays: number | null;
}

/**
 * A crawler decision for one fixed identity. The decision id and user agents are
 * the shipped ones, so a generated record can stand in for either constant in
 * robots.txt; every recorded field is generated.
 */
export function arbCrawlerAccessDecision(
  identity: Pick<CrawlerAccessDecision, 'decisionId' | 'userAgents'>
): fc.Arbitrary<GeneratedCrawlerDecision> {
  return fc
    .record({
      value: arbCrawlerDecisionValue,
      decidedBy: arbCrawlerPerson,
      decidedOn: arbCrawlerDecisionDate,
      guidanceReference: arbCrawlerGuidanceReference,
      verifiedOn: arbCrawlerVerificationDate,
      verifiedBy: arbCrawlerPerson,
    })
    .map((fields) => ({
      decision: {
        decisionId: identity.decisionId,
        userAgents: [...identity.userAgents],
        // Deliberately unchecked: an unrecognised value must be representable.
        decision: fields.value.value as CrawlerAccessDecision['decision'],
        decidedBy: fields.decidedBy.value,
        decidedOn: fields.decidedOn.value,
        guidanceReference: fields.guidanceReference.value,
        verifiedOn: fields.verifiedOn.value,
        verifiedBy: fields.verifiedBy.value,
      },
      expectedGrant:
        fields.value.kind === 'allowed' &&
        fields.decidedBy.ok &&
        fields.decidedOn.ok &&
        fields.guidanceReference.ok &&
        fields.verifiedOn.ok &&
        fields.verifiedBy.ok,
      verificationAgeDays: fields.verifiedOn.ageDays,
    }));
}

/** A clock reading inside `PROPERTY_NOW`'s UTC day, so calendar truncation is exercised. */
export const arbMillisecondsIntoPropertyDay: fc.Arbitrary<number> = fc.integer({ min: 0, max: 86_399_999 });

/** The three variables robots.txt reads, in the shape `setEnv` in `tests/robots.test.ts` takes. */
export type CrawlerEnvironmentVariables = Partial<
  Record<'INSTLE_DEPLOY_ENV' | 'INSTLE_PUBLIC_ORIGIN' | 'INSTLE_DOMAIN_CONFIRMED', string>
>;

export interface GeneratedCrawlerEnvironment {
  readonly env: CrawlerEnvironmentVariables;
  /** `INSTLE_DEPLOY_ENV` is the exact string `production`. */
  readonly exactlyProduction: boolean;
  /** A usable https origin and a truthy confirmation flag (A1, OWN-01). */
  readonly domainConfirmed: boolean;
  /** The origin the sitemap must be named on, when the domain is confirmed. */
  readonly expectedOrigin: string | null;
  /** Only this combination may serve anything but the blocked response. */
  readonly opensCrawling: boolean;
}

/** `undefined` is an absent variable; `setEnv` deletes it. NUL cannot survive `process.env`. */
const arbEnvString: fc.Arbitrary<string> = fc.string({ maxLength: 16 }).filter((value) => !value.includes('\0'));

/**
 * A deploy value. Only the exact string `production` counts: capitals, padding
 * and near names are the variants a normalising reader would wrongly accept.
 */
const arbCrawlerDeployValue: fc.Arbitrary<CrawlerField<string | undefined>> = fc.oneof(
  { weight: 2, arbitrary: fc.constant(good<string | undefined>('production')) },
  {
    weight: 1,
    arbitrary: fc
      .oneof(
        fc.constantFrom<string | undefined>(
          undefined,
          '',
          '   ',
          'PRODUCTION',
          'Production',
          ' production',
          'production ',
          '\tproduction\n',
          'prod',
          'preview',
          'development',
          'staging'
        ),
        arbEnvString.filter((value) => value !== 'production')
      )
      .map(bad),
  }
);

/** A supplied origin, with the origin a usable one normalises to. */
const arbCrawlerOrigin: fc.Arbitrary<CrawlerField<string | undefined> & { readonly origin: string | null }> =
  fc.oneof(
    {
      weight: 2,
      arbitrary: fc.constantFrom(
        { value: 'https://example-instle.test', ok: true, origin: 'https://example-instle.test' },
        { value: 'https://example-instle.test/', ok: true, origin: 'https://example-instle.test' },
        { value: '  https://example-instle.test  ', ok: true, origin: 'https://example-instle.test' },
        { value: 'https://www.example-instle.test', ok: true, origin: 'https://www.example-instle.test' }
      ),
    },
    {
      weight: 1,
      arbitrary: fc
        .constantFrom<string | undefined>(
          undefined,
          '',
          '   ',
          'http://example-instle.test',
          'https://example-instle.test/path',
          'https://example-instle.test/?q=1',
          'https://example-instle.test/#top',
          'https://user:secret@example-instle.test',
          'example-instle.test',
          'not a url'
        )
        .map((value) => ({ value, ok: false, origin: null })),
    }
  );

/** Spellings `INSTLE_DOMAIN_CONFIRMED` accepts once trimmed and lower-cased. */
const TRUTHY_CONFIRMATION_FLAGS: readonly string[] = ['1', 'true', 'yes', 'on'];

const arbCrawlerConfirmationFlag: fc.Arbitrary<CrawlerField<string | undefined>> = fc.oneof(
  { weight: 2, arbitrary: fc.constantFrom('true', 'TRUE', ' true ', '1', 'yes', 'on', 'On').map(good) },
  {
    weight: 1,
    arbitrary: fc
      .oneof(
        fc.constantFrom<string | undefined>(undefined, '', '  ', 'false', '0', 'no', 'off', 'truee', 'y'),
        arbEnvString.filter((value) => !TRUTHY_CONFIRMATION_FLAGS.includes(value.trim().toLowerCase()))
      )
      .map(bad),
  }
);

/** Every environment robots.txt can be served under. */
export const arbCrawlerEnvironment: fc.Arbitrary<GeneratedCrawlerEnvironment> = fc
  .record({ deploy: arbCrawlerDeployValue, origin: arbCrawlerOrigin, flag: arbCrawlerConfirmationFlag })
  .map(({ deploy, origin, flag }) => {
    const domainConfirmed = origin.ok && flag.ok;
    return {
      env: {
        INSTLE_DEPLOY_ENV: deploy.value,
        INSTLE_PUBLIC_ORIGIN: origin.value,
        INSTLE_DOMAIN_CONFIRMED: flag.value,
      },
      exactlyProduction: deploy.ok,
      domainConfirmed,
      expectedOrigin: domainConfirmed ? origin.origin : null,
      opensCrawling: deploy.ok && domainConfirmed,
    };
  });
// ===========================================================================
// END crawler access generators (task 12.5, Property 15)
// ===========================================================================

// ===========================================================================
// BEGIN policy scan generators (tasks 14.7, 14.8, 14.9 — Properties 11, 12, 13)
// ===========================================================================

/**
 * Generators for the three Requirement 12 properties: banned-pattern detection,
 * route and slug shape, and scan coverage.
 *
 * All three are properties about a *scan*, so what has to be generated is the
 * material a scan reads — text in varied positions and casings, route paths and
 * slugs in every shape the router allows, and subsets of a file set — rather than a
 * record. The rules themselves are never restated here: the lexicons come from
 * `tests/helpers/route-shape.ts` and `tests/helpers/slug-shape.ts`, which are the
 * lexicons the policy suite scans with.
 */

// ---------------------------------------------------------------------------
// Text: casing and benign surroundings (Property 11)
// ---------------------------------------------------------------------------

/**
 * How a generated fragment is cased.
 *
 * A banned pattern written with the `i` flag bans the phrase, not a spelling of it,
 * so the property drives every casing through the scan. `alternating` is the one
 * somebody reaches for to slip a phrase past a naive check.
 */
export type LetterCasing = 'as-written' | 'upper' | 'lower' | 'title' | 'alternating';

export const arbLetterCasing: fc.Arbitrary<LetterCasing> = fc.constantFrom<LetterCasing>(
  'as-written',
  'upper',
  'lower',
  'title',
  'alternating'
);

export function applyCasing(text: string, casing: LetterCasing): string {
  switch (casing) {
    case 'upper':
      return text.toUpperCase();
    case 'lower':
      return text.toLowerCase();
    case 'title':
      return text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    case 'alternating':
      return [...text]
        .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char.toLowerCase()))
        .join('');
    default:
      return text;
  }
}

/**
 * A sentence that breaks no rule, for padding around an injected fragment.
 *
 * Deliberately a fixed pool rather than `fc.string()`: random characters would
 * produce no readable prose, and — worse — could stumble into a banned phrase and
 * make a passing case look like a failing one. Every line here is drawn from the
 * kind of wording the site actually uses.
 */
export const arbBenignLine: fc.Arbitrary<string> = fc.constantFrom(
  'A call tells you more than a form does.',
  'We talk through what you are trying to do, and what it will take.',
  'This page explains the process, step by step.',
  'Bring your documents to the first conversation.',
  'Ask what happens if the timeline slips.',
  'The locality note explains how the area is filed for browsing.',
  'Nothing here is a listing, and nothing here is an offer.',
  'Speak to an advisor about what you need next.'
);

/** Between none and six benign lines. */
export const arbBenignLines: fc.Arbitrary<string[]> = fc.array(arbBenignLine, { minLength: 0, maxLength: 6 });

/** Where an injected fragment sits inside a generated file. */
export type InjectionPosition = 'first' | 'middle' | 'last';

export const arbInjectionPosition: fc.Arbitrary<InjectionPosition> = fc.constantFrom<InjectionPosition>(
  'first',
  'middle',
  'last'
);

/** A component name for a synthetic file, so each generated source is distinct. */
export const arbSyntheticComponentName: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `Generated${n.toString(16).padStart(6, '0')}`);

// ---------------------------------------------------------------------------
// Route shapes (Property 12)
// ---------------------------------------------------------------------------

/** Segment names that are a transaction intent, a property type or a PIN term. */
const DOORWAY_PARENT_SEGMENTS: readonly string[] = [
  ...INTENT_SEGMENTS,
  ...TYPE_SEGMENTS,
  ...NAMED_DOORWAY_PATHS.map((named) => named.split('/').filter((segment) => segment !== '')[0]!),
];

/**
 * A static segment that is nobody's doorway parent: not an intent word, not a
 * property type, not a PIN term, not six digits.
 *
 * Drawn from the shapes the tree really uses — `areas`, `guides`, `about` — plus
 * generated tokens, so the property covers both the routes that exist and the ones
 * somebody adds next.
 */
export const arbInnocentSegment: fc.Arbitrary<string> = fc
  .oneof(
    { weight: 2, arbitrary: fc.constantFrom('areas', 'guides', 'about', 'how-it-works', 'contact', 'regions') },
    { weight: 1, arbitrary: arbSlug }
  )
  .filter((segment) => !DOORWAY_PARENT_SEGMENTS.includes(segment.toLowerCase()) && !/^\d{6}$/.test(segment));

export const arbIntentSegment: fc.Arbitrary<string> = fc.constantFrom(...INTENT_SEGMENTS);
export const arbTypeSegment: fc.Arbitrary<string> = fc.constantFrom(...TYPE_SEGMENTS);

/** The first segment of each named doorway path: `buy`, `sell`, …, `pincode`. */
export const arbNamedDoorwayParent: fc.Arbitrary<string> = fc.constantFrom(
  ...NAMED_DOORWAY_PATHS.map((named) => named.split('/').filter((segment) => segment !== '')[0]!)
);

/** `[slug]`, `[...rest]` and `[[...rest]]`: every dynamic form the router accepts. */
export const arbDynamicSegment: fc.Arbitrary<string> = fc
  .tuple(fc.constantFrom('slug', 'area', 'code', 'rest', 'path'), fc.constantFrom('plain', 'catch-all', 'optional'))
  .map(([name, form]) =>
    form === 'plain' ? `[${name}]` : form === 'catch-all' ? `[...${name}]` : `[[...${name}]]`
  );

/** A route group `(marketing)` or a parallel slot `@panel`: no URL segment at all. */
export const arbInvisibleDirectory: fc.Arbitrary<string> = fc.constantFrom(
  '(marketing)',
  '(content)',
  '(site)',
  '@panel',
  '@aside'
);

/** A six-digit segment, and a whole-segment PIN term: Requirement 12.3's shapes. */
export const arbSixDigitSegment: fc.Arbitrary<string> = fc
  .integer({ min: 100_000, max: 999_999 })
  .map((value) => String(value));

export const arbPinTermSegment: fc.Arbitrary<string> = fc.constantFrom(
  'pin',
  'pin-code',
  'pincode',
  'pincodes',
  'postcode',
  'postal-code',
  'pin-codes',
  'postcodes',
  'postal-codes'
);

/**
 * A generated route, with the directory names it would be written as and whether the
 * shape is a doorway.
 *
 * `directories` carries the route groups and parallel slots that add no URL segment,
 * because a group is exactly how somebody would hide a doorway from a reader of the
 * tree: `app/(marketing)/buy/[area]/page.tsx` serves `/buy/[area]`.
 */
export interface GeneratedRouteShape {
  /** URL segments as served, dynamic brackets included. */
  readonly segments: readonly string[];
  /** Directory names under `src/app`, invisible directories included. */
  readonly directories: readonly string[];
  /** True when the shape is one Requirement 12.1 rejects. */
  readonly doorway: boolean;
  /** Why, for an assertion message. */
  readonly why: string;
}

/** Sprinkle invisible directories through a segment list, keeping the URL identical. */
function arbDirectoriesFor(segments: readonly string[]): fc.Arbitrary<string[]> {
  return fc
    .array(fc.option(arbInvisibleDirectory, { nil: null }), {
      minLength: segments.length + 1,
      maxLength: segments.length + 1,
    })
    .map((invisible) => {
      const out: string[] = [];
      for (const [index, segment] of segments.entries()) {
        const before = invisible[index];
        if (before) out.push(before);
        out.push(segment);
      }
      const last = invisible[segments.length];
      if (last) out.push(last);
      return out;
    });
}

function shape(segments: readonly string[], doorway: boolean, why: string): fc.Arbitrary<GeneratedRouteShape> {
  return arbDirectoriesFor(segments).map((directories) => ({ segments, directories, doorway, why }));
}

/** Zero to two static segments, as a prefix or a suffix that changes no shape rule. */
const arbInnocentRun: fc.Arbitrary<string[]> = fc.array(arbInnocentSegment, { minLength: 0, maxLength: 2 });

/**
 * A doorway route: a dynamic segment beneath an intent, a type or a named PIN
 * parent, or two or more dynamic segments — at any depth, behind any prefix.
 */
export const arbDoorwayRouteShape: fc.Arbitrary<GeneratedRouteShape> = fc
  .oneof(
    fc
      .tuple(arbInnocentRun, arbIntentSegment, arbDynamicSegment, arbInnocentRun)
      .map(([prefix, intent, dynamic, suffix]) => ({
        segments: [...prefix, intent, dynamic, ...suffix],
        why: `dynamic ${dynamic} directly beneath transaction-intent segment ${intent}`,
      })),
    fc
      .tuple(arbInnocentRun, arbTypeSegment, arbDynamicSegment, arbInnocentRun)
      .map(([prefix, type, dynamic, suffix]) => ({
        segments: [...prefix, type, dynamic, ...suffix],
        why: `dynamic ${dynamic} directly beneath property-type segment ${type}`,
      })),
    fc
      .tuple(arbInnocentRun, arbNamedDoorwayParent, arbDynamicSegment)
      .map(([prefix, parent, dynamic]) => ({
        segments: [...prefix, parent, dynamic],
        why: `matches a named doorway path beneath ${parent}`,
      })),
    fc
      .tuple(arbInnocentSegment, arbDynamicSegment, arbInnocentRun, arbDynamicSegment)
      .map(([parent, first, middle, second]) => ({
        segments: [parent, first, ...middle, second],
        why: `carries two dynamic segments (${first}, ${second})`,
      }))
  )
  .chain(({ segments, why }) => shape(segments, true, why));

/**
 * A legitimate route: static segments only, or exactly one dynamic segment whose
 * parent is no intent word, type word or PIN term.
 *
 * An intent segment is included with a *static* child, because `/buy/checklist` is a
 * page about buying rather than a doorway, and a rule that rejected it would reject
 * the routes the site actually has.
 */
export const arbLegitimateRouteShape: fc.Arbitrary<GeneratedRouteShape> = fc
  .oneof(
    fc.array(arbInnocentSegment, { minLength: 0, maxLength: 3 }).map((segments) => ({
      segments,
      why: 'static segments only',
    })),
    fc.tuple(arbInnocentSegment, arbDynamicSegment).map(([parent, dynamic]) => ({
      segments: [parent, dynamic],
      why: `one dynamic segment beneath ${parent}`,
    })),
    fc.tuple(arbInnocentRun, arbInnocentSegment, arbDynamicSegment).map(([prefix, parent, dynamic]) => ({
      segments: [...prefix, parent, dynamic],
      why: `one dynamic segment beneath ${parent}, behind a prefix`,
    })),
    fc.tuple(arbIntentSegment, arbInnocentSegment).map(([intent, child]) => ({
      segments: [intent, child],
      why: `static child ${child} beneath intent segment ${intent}`,
    })),
    arbDynamicSegment.map((dynamic) => ({ segments: [dynamic], why: 'one dynamic segment at the root' }))
  )
  .chain(({ segments, why }) => shape(segments, false, why));

export const arbRouteShape: fc.Arbitrary<GeneratedRouteShape> = fc.oneof(
  arbDoorwayRouteShape,
  arbLegitimateRouteShape
);

// ---------------------------------------------------------------------------
// Slug shapes (Property 12, Requirements 12.2 and 12.3)
// ---------------------------------------------------------------------------

/** A hyphen token that is no intent word and no property-type word. */
const arbPlaceToken: fc.Arbitrary<string> = fc
  .oneof(
    fc.constantFrom(
      'indiranagar',
      'koramangala',
      'whitefield',
      'jayanagar',
      'hebbal',
      'yelahanka',
      'layout',
      'nagar',
      'halli',
      'pura',
      'inner',
      'enclaves'
    ),
    arbSlug.map((slug) => slug.split('-')[0]!)
  )
  .filter(
    (token) =>
      token.length >= 3 &&
      !TRANSACTION_INTENT_WORDS.includes(token) &&
      !PROPERTY_TYPE_WORDS.includes(token) &&
      !/\d/.test(token)
  );

/** A slug naming a place and nothing else: the only shape Requirement 12.2 accepts. */
export const arbPlaceSlug: fc.Arbitrary<string> = fc
  .array(arbPlaceToken, { minLength: 1, maxLength: 4 })
  .map((tokens) => tokens.join('-'))
  .filter((slug) => slug.length <= 100);

/** How a slug offends Requirement 12.2. */
export type SlugOffence = 'intent-word' | 'type-word' | 'six-digit-group' | 'six-digit-inside-token';

export interface GeneratedSlug {
  readonly slug: string;
  /** Null for a slug the rule accepts. */
  readonly offence: SlugOffence | null;
  /** The token or numeral the scan should name. */
  readonly offending: string | null;
}

export const arbOffendingSlug: fc.Arbitrary<GeneratedSlug> = fc.oneof(
  fc
    .tuple(arbPlaceSlug, fc.constantFrom(...TRANSACTION_INTENT_WORDS), fc.boolean())
    .map(([place, word, leading]) => ({
      slug: leading ? `${word}-${place}` : `${place}-${word}`,
      offence: 'intent-word' as const,
      offending: word,
    })),
  fc
    .tuple(arbPlaceSlug, fc.constantFrom(...PROPERTY_TYPE_WORDS), fc.boolean())
    .map(([place, word, leading]) => ({
      slug: leading ? `${word}-${place}` : `${place}-${word}`,
      offence: 'type-word' as const,
      offending: word,
    })),
  fc.tuple(arbPlaceSlug, arbSixDigitSegment).map(([place, digits]) => ({
    slug: `${place}-${digits}`,
    offence: 'six-digit-group' as const,
    offending: digits,
  })),
  fc.tuple(arbPlaceToken, arbSixDigitSegment).map(([token, digits]) => ({
    slug: `${token}${digits}`,
    offence: 'six-digit-inside-token' as const,
    offending: digits,
  }))
);

export const arbAcceptableSlug: fc.Arbitrary<GeneratedSlug> = arbPlaceSlug.map((slug) => ({
  slug,
  offence: null,
  offending: null,
}));

export const arbGeneratedSlug: fc.Arbitrary<GeneratedSlug> = fc.oneof(arbOffendingSlug, arbAcceptableSlug);

/**
 * A registry as the resolution rule sees it: records, an alias map, and whether the
 * three shapes Requirement 12.2 rejects are present — a slug held by two records, an
 * alias key that is also a record slug, and an alias resolving to no record.
 */
export interface GeneratedSlugRegistry {
  readonly records: readonly { readonly slug: string }[];
  readonly aliases: Readonly<Record<string, string>>;
  readonly resolvesToExactlyOne: boolean;
  readonly why: string;
}

export const arbSlugRegistry: fc.Arbitrary<GeneratedSlugRegistry> = fc
  .uniqueArray(arbPlaceSlug, { minLength: 2, maxLength: 6 })
  .chain((slugs) =>
    fc
      .constantFrom<'clean' | 'duplicate-record' | 'alias-is-record-slug' | 'alias-to-nothing'>(
        'clean',
        'duplicate-record',
        'alias-is-record-slug',
        'alias-to-nothing'
      )
      .map((mode) => {
        const records = slugs.map((slug) => ({ slug }));
        const aliases: Record<string, string> = { [`${slugs[0]!}-alias`]: slugs[0]! };
        switch (mode) {
          case 'duplicate-record':
            return {
              records: [...records, { slug: slugs[0]! }],
              aliases,
              resolvesToExactlyOne: false,
              why: `${slugs[0]} is the slug of two records`,
            };
          case 'alias-is-record-slug':
            return {
              records,
              aliases: { ...aliases, [slugs[1]!]: slugs[0]! },
              resolvesToExactlyOne: false,
              why: `${slugs[1]} is an alias key that is also a record slug`,
            };
          case 'alias-to-nothing':
            return {
              records,
              aliases: { ...aliases, 'unknown-alias': 'no-such-record' },
              resolvesToExactlyOne: false,
              why: 'unknown-alias resolves to no record',
            };
          default:
            return { records, aliases, resolvesToExactlyOne: true, why: 'every slug names one record' };
        }
      })
  );

// ---------------------------------------------------------------------------
// Import graphs (Property 13)
// ---------------------------------------------------------------------------

/**
 * A module graph, as file names and import edges.
 *
 * Property 13 is about the *floor* a scan is measured against — the transitive import
 * closure of the files that render a registered route — so the generated material is a
 * graph: modules, which of them a route is served from, and what imports what. The
 * property writes the graph to a scratch directory and walks it with the real
 * `walkImportClosure`, because a model of the walker would prove nothing about the
 * walker the build uses.
 *
 * Edges are unconstrained, so cycles are generated: `a` importing `b` importing `a` is
 * ordinary in a component tree, and a walker that did not track what it had seen would
 * hang on one. Some edges point at a module the graph never defines, which is how an
 * import that no longer resolves reaches the `unresolved` list rather than being
 * silently dropped. And some modules sit under a prototype folder, which the closure
 * must never enter however many files reach it.
 */
export interface GeneratedImportGraph {
  /** Module names, without a directory: `m0`, `m1`, … */
  readonly modules: readonly string[];
  /** The modules a route is served from. Always non-empty. */
  readonly seeds: readonly string[];
  /** `[importer, imported]`, where `imported` may be a module the graph omits. */
  readonly edges: readonly (readonly [string, string])[];
  /** Modules under a prototype folder: reachable, and excluded all the same. */
  readonly prototypes: readonly string[];
}

const arbModuleIndex = fc.integer({ min: 0, max: 11 });

export const arbImportGraph: fc.Arbitrary<GeneratedImportGraph> = fc
  .record({
    moduleCount: fc.integer({ min: 2, max: 12 }),
    prototypeCount: fc.integer({ min: 0, max: 2 }),
    seedCount: fc.integer({ min: 1, max: 3 }),
    rawEdges: fc.array(fc.tuple(arbModuleIndex, arbModuleIndex), { minLength: 0, maxLength: 20 }),
    danglingEdges: fc.array(arbModuleIndex, { minLength: 0, maxLength: 3 }),
    prototypeEdges: fc.array(fc.tuple(arbModuleIndex, fc.integer({ min: 0, max: 1 })), {
      minLength: 0,
      maxLength: 3,
    }),
  })
  .map(({ moduleCount, prototypeCount, seedCount, rawEdges, danglingEdges, prototypeEdges }) => {
    const modules = Array.from({ length: moduleCount }, (_unused, index) => `m${index}`);
    const prototypes = Array.from({ length: prototypeCount }, (_unused, index) => `Concept1/p${index}`);
    const seeds = modules.slice(0, Math.min(seedCount, moduleCount));
    const edges: (readonly [string, string])[] = [];
    for (const [from, to] of rawEdges) {
      const importer = modules[from % moduleCount]!;
      const imported = modules[to % moduleCount]!;
      if (importer !== imported) edges.push([importer, imported]);
    }
    for (const from of danglingEdges) {
      // A module the graph never writes: the specifier resolves to nothing.
      edges.push([modules[from % moduleCount]!, 'absent-module']);
    }
    for (const [from, to] of prototypeEdges) {
      if (prototypes.length > 0) edges.push([modules[from % moduleCount]!, prototypes[to % prototypes.length]!]);
    }
    return { modules, seeds, edges, prototypes };
  });

// ---------------------------------------------------------------------------
// Set shrinking (Property 13)
// ---------------------------------------------------------------------------

/** A subset of `items`, in the original order, holding between `min` and all of them. */
export function arbSubsetOf<T>(items: readonly T[], min = 0): fc.Arbitrary<T[]> {
  return fc
    .array(fc.boolean(), { minLength: items.length, maxLength: items.length })
    .map((keep) => items.filter((_item, index) => keep[index]!))
    .filter((subset) => subset.length >= min);
}

/**
 * A strictly smaller subset of `items`: at least one dropped, so it models a scan
 * that stopped reading part of the surface. Undefined for an empty input, which is
 * why the caller asserts the input is not empty first.
 */
export function arbProperSubsetOf<T>(items: readonly T[]): fc.Arbitrary<T[]> {
  return fc
    .uniqueArray(fc.integer({ min: 0, max: Math.max(0, items.length - 1) }), {
      minLength: 1,
      maxLength: Math.max(1, items.length),
    })
    .map((dropped) => {
      const drop = new Set(dropped);
      return items.filter((_item, index) => !drop.has(index));
    });
}

/** One element of `items`. */
export function arbElementOf<T>(items: readonly T[]): fc.Arbitrary<T> {
  return fc.integer({ min: 0, max: items.length - 1 }).map((index) => items[index]!);
}

// ===========================================================================
// END policy scan generators (tasks 14.7, 14.8, 14.9 — Properties 11, 12, 13)
// ===========================================================================

// ===========================================================================
// BEGIN structured data generators (task 13.5, Property 14)
// ===========================================================================
//
// Property 14: structured data emits only permitted types and only values a
// reader can see. The generated material is a JSON-LD graph *paired with the
// visible text of the page emitting it*, because neither half means anything
// alone: a graph is judged against the page, and the same graph is admissible on
// one page and not on another.
//
// Two conventions, both the same ones the rest of this file runs on.
//
// **A clean base, then one recorded degradation.** `arbAuditableGraph` builds a
// graph out of the node shapes the shipped builders actually emit — the
// Organization with its City and ContactPoint, the Person with its worksFor, the
// BreadcrumbList with its ListItems, the Service with its provider — plus the
// three permitted types nothing emits yet, so the policy's allowance for them is
// exercised rather than assumed. It then applies one of thirteen violations,
// where `none` is one of the thirteen. Every value in a clean graph appears in the
// generated visible text and carries no hostname, so a clean graph is admissible
// in both domain states and the passing branch is genuinely reached.
//
// **The generator knows what the audit must say.** Each violation carries the
// path it was injected at, the value or key the failure must quote, and a
// fragment of the reason, so the property asserts that the *right* rule fired at
// the *right* place with the offending value named — not merely that something
// failed.
//
// Values in the graph are case- and whitespace-varied against the visible text on
// purpose. Requirement 5.6 is satisfied "after whitespace and case
// normalisation", so a graph whose values were byte-identical to the page would
// never exercise the normalisation and an implementation that compared raw
// strings would pass.

/** The one hostname the injections use. Absent from every clean value. */
export const GRAPH_HOSTNAME = 'example-audit-host.test';

/** An absolute URL carrying `GRAPH_HOSTNAME`, the shape Requirement 5.13 catches. */
export const GRAPH_HOSTNAME_URL = `https://${GRAPH_HOSTNAME}/reference`;

/**
 * The phrases one generated page shows a reader, and the one phrase it does not.
 *
 * Every field but `unseen` is written into the generated visible text; `unseen` is
 * built from the same marker under a different label, so it can never be a
 * substring of the text even accidentally — which is what makes "this value is
 * absent from the page" a fact rather than a probability.
 */
export interface GraphPhrases {
  readonly brand: string;
  readonly phone: string;
  readonly place: string;
  readonly title: string;
  readonly lead: string;
  readonly crumb: string;
  readonly personName: string;
  readonly role: string;
  /** In no visible text, and in no clean graph value. */
  readonly unseen: string;
}

const arbGraphPhrases: fc.Arbitrary<GraphPhrases> = arbMarker.map((marker) => ({
  brand: CANONICAL_BRAND,
  phone: PRIMARY_PHONE,
  place: 'Bengaluru',
  title: `${marker}-visible-title`,
  lead: `${marker}-visible-lead sentence a reader can see.`,
  crumb: `${marker}-visible-crumb`,
  personName: `${marker}-visible-person`,
  role: `${marker}-visible-role`,
  unseen: `${marker}-unseen-value`,
}));

/**
 * How a graph value is written relative to the page. Each of these normalises to
 * the same thing, so all four must be accepted.
 */
const GRAPH_VALUE_VARIANTS: readonly ((value: string) => string)[] = [
  (value) => value,
  (value) => value.toUpperCase(),
  (value) => value.toLowerCase(),
  (value) => `  ${value.replace(/ /g, '   ')}\n`,
];

/** The node shapes a generated graph is built from. */
export type GraphNodeKind =
  | 'organisation'
  | 'person'
  | 'breadcrumb'
  | 'service'
  | 'website'
  | 'webpage'
  | 'article';

export const GRAPH_NODE_KINDS: readonly GraphNodeKind[] = [
  'organisation',
  'person',
  'breadcrumb',
  'service',
  'website',
  'webpage',
  'article',
];

/** The `@type` each node kind declares. One per permitted type, so all seven are driven. */
export const GRAPH_NODE_TYPES: Readonly<Record<GraphNodeKind, string>> = {
  organisation: 'Organization',
  person: 'Person',
  breadcrumb: 'BreadcrumbList',
  service: 'Service',
  website: 'WebSite',
  webpage: 'WebPage',
  article: 'Article',
};

/**
 * One node of the generated graph. `vary` rewrites the content values; the
 * vocabulary values (`contactType`, `availableLanguage`, `position`) are left
 * alone, because they are schema enums that appear in no visible text and the
 * policy exempts them under `STRUCTURAL_VALUE_KEYS`.
 */
function buildGraphNode(
  kind: GraphNodeKind,
  phrases: GraphPhrases,
  vary: (value: string) => string
): JsonLdObject {
  const organisation: JsonLdObject = {
    '@type': GRAPH_NODE_TYPES.organisation,
    name: vary(phrases.brand),
    telephone: vary(phrases.phone),
    areaServed: { '@type': PERMITTED_NESTED_TYPES.areaServed, name: vary(phrases.place) },
    contactPoint: {
      '@type': PERMITTED_NESTED_TYPES.contactPoint,
      telephone: vary(phrases.phone),
      contactType: 'customer service',
      availableLanguage: ['en'],
    },
  };
  switch (kind) {
    case 'organisation':
      return organisation;
    case 'person':
      return {
        '@type': GRAPH_NODE_TYPES.person,
        name: vary(phrases.personName),
        jobTitle: vary(phrases.role),
        worksFor: { '@type': GRAPH_NODE_TYPES.organisation, name: vary(phrases.brand) },
      };
    case 'breadcrumb':
      return {
        '@type': GRAPH_NODE_TYPES.breadcrumb,
        itemListElement: [
          { '@type': PERMITTED_NESTED_TYPES.itemListElement, position: 1, name: vary(phrases.crumb) },
          { '@type': PERMITTED_NESTED_TYPES.itemListElement, position: 2, name: vary(phrases.title) },
        ],
      };
    case 'service':
      return {
        '@type': GRAPH_NODE_TYPES.service,
        name: vary(phrases.title),
        description: vary(phrases.lead),
        provider: organisation,
      };
    case 'website':
      return { '@type': GRAPH_NODE_TYPES.website, name: vary(phrases.brand) };
    case 'webpage':
      return {
        '@type': GRAPH_NODE_TYPES.webpage,
        name: vary(phrases.title),
        description: vary(phrases.lead),
      };
    case 'article':
      return {
        '@type': GRAPH_NODE_TYPES.article,
        headline: vary(phrases.title),
        description: vary(phrases.lead),
      };
  }
}

/** Every way an emitted graph stops being admissible, one at a time. */
export type GraphViolationKind =
  | 'none'
  | 'unpermitted-node-type'
  | 'unpermitted-type-at-depth'
  | 'nested-type-under-wrong-property'
  | 'nested-type-as-node'
  | 'no-type'
  | 'forbidden-key-on-node'
  | 'forbidden-key-at-depth'
  | 'invisible-value-on-node'
  | 'invisible-value-at-depth'
  | 'invisible-value-in-array'
  | 'hostname-in-content-value'
  | 'hostname-under-structural-key';

export const GRAPH_VIOLATION_KINDS: readonly GraphViolationKind[] = [
  'none',
  'unpermitted-node-type',
  'unpermitted-type-at-depth',
  'nested-type-under-wrong-property',
  'nested-type-as-node',
  'no-type',
  'forbidden-key-on-node',
  'forbidden-key-at-depth',
  'invisible-value-on-node',
  'invisible-value-at-depth',
  'invisible-value-in-array',
  'hostname-in-content-value',
  'hostname-under-structural-key',
];

/**
 * A root carrying `@graph` is what every shipped builder emits; a bare node root
 * is the other shape `auditGraph` accepts, and the only one that exercises its
 * `(root)` path label. A single-node root cannot hold a second node, so
 * `nested-type-as-node` does not apply to it.
 */
export type GraphRootForm = 'graph' | 'node';

/** One failure the audit must report, as the generator recorded it. */
export interface ExpectedGraphFailure {
  /** The path the failure names, exactly as `auditGraph` labels it. */
  readonly path: string;
  /** The value or key the message must quote, or null where the reason names none. */
  readonly quoted: string | null;
  /** A fragment of the reason, so the right rule is what fired. */
  readonly reason: string;
}

export interface AuditableGraph {
  readonly graph: JsonLdObject;
  /** The visible text of the page emitting `graph`, as a reader would read it. */
  readonly visibleText: string;
  readonly rootForm: GraphRootForm;
  readonly nodeKinds: readonly GraphNodeKind[];
  readonly violation: GraphViolationKind;
  /** Empty when `violation` is `none`. */
  readonly expected: readonly ExpectedGraphFailure[];
  /**
   * True when the injected fault is a fault only while the domain is unconfirmed —
   * the hostname rule, and nothing else.
   */
  readonly onlyWhileUnconfirmed: boolean;
  readonly phrases: GraphPhrases;
}

/** The violations that can be applied to a graph of this shape. */
export function graphViolationsFor(rootForm: GraphRootForm): readonly GraphViolationKind[] {
  return rootForm === 'graph'
    ? GRAPH_VIOLATION_KINDS
    : GRAPH_VIOLATION_KINDS.filter((kind) => kind !== 'nested-type-as-node');
}

/** The path `auditGraph` gives a value held `rest` deep inside node `index`. */
function graphNodePath(rootForm: GraphRootForm, index: number, rest: string): string {
  const base = rootForm === 'graph' ? `@graph[${index}]` : '';
  if (rest === '') return base === '' ? '(root)' : base;
  return base === '' ? rest : `${base}.${rest}`;
}

interface AppliedViolation {
  readonly nodes: readonly JsonLdObject[];
  readonly expected: readonly ExpectedGraphFailure[];
  readonly onlyWhileUnconfirmed: boolean;
  /** Text the page must also show, so the injection trips one rule rather than two. */
  readonly visibleAddition: string;
}

/**
 * Apply one violation to one node of a clean graph.
 *
 * Each case is written so that exactly one rule fires. A forbidden key is given a
 * value a reader can see, and the hostname cases are given text the page shows —
 * otherwise a single injection would report two failures and the property would be
 * asserting the sum of two rules rather than either one.
 */
function applyGraphViolation(
  nodes: readonly JsonLdObject[],
  index: number,
  violation: GraphViolationKind,
  rootForm: GraphRootForm,
  phrases: GraphPhrases,
  forbiddenKey: string
): AppliedViolation {
  const at = (rest: string) => graphNodePath(rootForm, index, rest);
  const clean = { nodes, expected: [], onlyWhileUnconfirmed: false, visibleAddition: '' };
  const replace = (node: JsonLdObject): readonly JsonLdObject[] =>
    nodes.map((existing, position) => (position === index ? node : existing));
  const target = nodes[index]!;

  switch (violation) {
    case 'none':
      return clean;

    case 'unpermitted-node-type':
      return {
        ...clean,
        nodes: replace({ ...target, '@type': 'RealEstateAgent' }),
        expected: [{ path: at('@type'), quoted: 'RealEstateAgent', reason: 'is not a permitted type' }],
      };

    case 'unpermitted-type-at-depth':
      return {
        ...clean,
        nodes: replace({ ...target, makesOffer: { '@type': 'Offer', name: phrases.place } }),
        expected: [{ path: at('makesOffer.@type'), quoted: 'Offer', reason: 'is not a permitted type' }],
      };

    case 'nested-type-under-wrong-property':
      // City is permitted under `areaServed` and nowhere else.
      return {
        ...clean,
        nodes: replace({
          ...target,
          location: { '@type': PERMITTED_NESTED_TYPES.areaServed, name: phrases.place },
        }),
        expected: [
          {
            path: at('location.@type'),
            quoted: PERMITTED_NESTED_TYPES.areaServed,
            reason: 'is not a permitted type',
          },
        ],
      };

    case 'nested-type-as-node':
      // ListItem is part of a BreadcrumbList, never a node of the graph.
      return {
        ...clean,
        nodes: [
          ...nodes,
          { '@type': PERMITTED_NESTED_TYPES.itemListElement, position: 1, name: phrases.crumb },
        ],
        expected: [
          {
            path: graphNodePath(rootForm, nodes.length, '@type'),
            quoted: PERMITTED_NESTED_TYPES.itemListElement,
            reason: 'is not a permitted type',
          },
        ],
      };

    case 'no-type': {
      const { '@type': _dropped, ...rest } = target;
      return {
        ...clean,
        nodes: replace(rest),
        expected: [{ path: at(''), quoted: null, reason: 'must declare an @type' }],
      };
    }

    case 'forbidden-key-on-node':
      return {
        ...clean,
        nodes: replace({ ...target, [forbiddenKey]: phrases.place }),
        expected: [{ path: at(forbiddenKey), quoted: forbiddenKey, reason: 'is a forbidden key' }],
      };

    case 'forbidden-key-at-depth':
      return {
        ...clean,
        nodes: replace({
          ...target,
          mainEntity: { '@type': 'WebPage', name: phrases.title, [forbiddenKey]: phrases.place },
        }),
        expected: [
          { path: at(`mainEntity.${forbiddenKey}`), quoted: forbiddenKey, reason: 'is a forbidden key' },
        ],
      };

    case 'invisible-value-on-node':
      return {
        ...clean,
        nodes: replace({ ...target, description: phrases.unseen }),
        expected: [
          {
            path: at('description'),
            quoted: phrases.unseen,
            reason: 'does not appear in the visible text of the page',
          },
        ],
      };

    case 'invisible-value-at-depth':
      return {
        ...clean,
        nodes: replace({ ...target, mainEntity: { '@type': 'WebPage', name: phrases.unseen } }),
        expected: [
          {
            path: at('mainEntity.name'),
            quoted: phrases.unseen,
            reason: 'does not appear in the visible text of the page',
          },
        ],
      };

    case 'invisible-value-in-array':
      // Array items inherit the key of their array, so the second item is checked
      // under `knowsAbout` and reported at its own index.
      return {
        ...clean,
        nodes: replace({ ...target, knowsAbout: [phrases.place, phrases.unseen] }),
        expected: [
          {
            path: at('knowsAbout[1]'),
            quoted: phrases.unseen,
            reason: 'does not appear in the visible text of the page',
          },
        ],
      };

    case 'hostname-in-content-value': {
      // Shown on the page, so the visible-text rule is satisfied and only the
      // hostname rule can fire.
      const value = `See ${GRAPH_HOSTNAME_URL} for the record.`;
      return {
        nodes: replace({ ...target, description: value }),
        expected: [{ path: at('description'), quoted: value, reason: 'carries the hostname' }],
        onlyWhileUnconfirmed: true,
        visibleAddition: value,
      };
    }

    case 'hostname-under-structural-key':
      // `url` is exempt from the visible-text rule and not from this one: being
      // structural is exactly what an identifier is, and an identifier is what
      // Requirements 5.8 and 5.13 withhold until the domain is confirmed.
      return {
        nodes: replace({ ...target, url: GRAPH_HOSTNAME_URL }),
        expected: [{ path: at('url'), quoted: GRAPH_HOSTNAME_URL, reason: 'carries the hostname' }],
        onlyWhileUnconfirmed: true,
        visibleAddition: '',
      };
  }
}

/**
 * A JSON-LD graph paired with the visible text of the page emitting it, spanning
 * the whole admissible/inadmissible space.
 *
 * One in thirteen generated graphs carries no violation and is admissible in both
 * domain states; the rest carry exactly one, at a recorded path, with the
 * offending value recorded beside it.
 */
export const arbAuditableGraph: fc.Arbitrary<AuditableGraph> = fc
  .tuple(
    arbGraphPhrases,
    fc.constantFrom<GraphRootForm>('graph', 'graph', 'graph', 'graph', 'node'),
    fc.array(fc.constantFrom(...GRAPH_NODE_KINDS), { minLength: 1, maxLength: 3 }),
    fc.array(fc.integer({ min: 0, max: GRAPH_VALUE_VARIANTS.length - 1 }), {
      minLength: 3,
      maxLength: 3,
    }),
    fc.integer({ min: 0, max: 999 }),
    fc.constantFrom(...FORBIDDEN_KEYS),
    arbMarkedText('page copy'),
    fc.integer({ min: 0, max: 999 })
  )
  .chain(([phrases, rootForm, drawnKinds, variantChoices, targetSeed, forbiddenKey, noise, kindSeed]) =>
    fc.constantFrom(...graphViolationsFor(rootForm)).map((violation): AuditableGraph => {
      const nodeKinds = rootForm === 'node' ? [drawnKinds[kindSeed % drawnKinds.length]!] : drawnKinds;
      const cleanNodes = nodeKinds.map((kind, position) =>
        buildGraphNode(kind, phrases, GRAPH_VALUE_VARIANTS[variantChoices[position % 3]!]!)
      );
      const index = targetSeed % cleanNodes.length;
      const applied = applyGraphViolation(
        cleanNodes,
        index,
        violation,
        rootForm,
        phrases,
        forbiddenKey
      );

      // Built from the phrases, never from the graph: the page is what the graph is
      // judged against, so deriving one from the other would prove nothing.
      const visibleText = [
        noise,
        phrases.brand,
        `Call ${phrases.phone}`,
        phrases.place,
        phrases.title,
        phrases.lead,
        phrases.crumb,
        phrases.personName,
        phrases.role,
        applied.visibleAddition,
      ]
        .filter((part) => part.length > 0)
        .join('\n');

      const graph: JsonLdObject =
        rootForm === 'graph'
          ? { '@context': SCHEMA_ORG_CONTEXT, '@graph': [...applied.nodes] }
          : { '@context': SCHEMA_ORG_CONTEXT, ...applied.nodes[0]! };

      return {
        graph,
        visibleText,
        rootForm,
        nodeKinds,
        violation,
        expected: applied.expected,
        onlyWhileUnconfirmed: applied.onlyWhileUnconfirmed,
        phrases,
      };
    })
  );

// ===========================================================================
// END structured data generators (task 13.5, Property 14)
// ===========================================================================
