/**
 * Media_Register — provenance for every visual asset a public page renders.
 *
 * Requirement 9.13 is the rule this file exists to make unavoidable: a page may
 * not reference an asset whose creator, source, licence, permission to adapt,
 * acquisition date or alt text is unrecorded. `evaluateAsset` returns every absent
 * value by name, because an editor fixing provenance needs the whole list, not the
 * first problem.
 *
 * Two type-level decisions do work that a test cannot:
 *
 * `showsCommuteTimes: false` and `showsDistances: false` are **literal** types
 * rather than booleans. A map asset that claims to show a commute time does not
 * compile, so Requirement 9.3 cannot be broken by an edit that a reviewer waves
 * through. The same trick makes `TextureAsset` decorative with no alt text: a
 * texture carrying alt text is a contradiction, and the compiler says so.
 *
 * `PhotographAsset` exists and the register is empty. No photograph has been
 * supplied under Owner_Input_Register C12, so the honest state is a register with
 * the shape ready and nothing in it — not a placeholder entry.
 */

import { evaluateClaims } from './claims';
import { MILLISECONDS_PER_DAY } from '@/lib/calendar-dates';
import { renderableNearbyRelationships } from '@/lib/internal-links';
import type { LocalityRecord, NearbyRelationship } from './localities';

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export interface MediaProvenance {
  readonly creator: string;
  readonly sourceReference: string;
  readonly licenceName: string;
  readonly licenceTerms: string;
  readonly permissionToAdapt: 'granted' | 'refused';
  /** Calendar date. */
  readonly acquiredOn: string;
  /** Requirement 10.11. Null means no expiry recorded. */
  readonly licenceExpiresOn: string | null;
}

/** Requirement 10.3. Required for any recognisable face. */
export interface PersonRelease {
  readonly personName: string;
  readonly permittedUses: readonly string[];
  readonly releasedOn: string;
  /**
   * Requirement 10.11 fails the build when a recorded release expires, so the
   * expiry has to be recordable. Null means the release records no expiry — which
   * is different from a release that has expired, and the two must not collapse.
   */
  readonly expiresOn: string | null;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface VisualAssetBase {
  readonly assetId: string;
  /**
   * Inline SVG is a server component; a file lives under /public. Illustrations
   * and maps in this feature are all inline, so they cost zero extra requests.
   */
  readonly delivery:
    | { readonly mode: 'inline-svg'; readonly componentName: string }
    | { readonly mode: 'file'; readonly publicPath: string };
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  /** 1–125 characters, or null when `decorative` is true. */
  readonly altText: string | null;
  readonly decorative: boolean;
  /** Requirement 9.2. The named Bengaluru subject. */
  readonly subject: {
    readonly kind: 'locality' | 'corridor' | 'civic-motif';
    readonly name: string;
  };
  readonly provenance: MediaProvenance;
  /**
   * Requirement 9.5. Every colour the asset presents behind text. The token test
   * computes 4.5:1 for the text colour against each of these.
   */
  readonly backgroundColoursBehindText: readonly string[];
  /** Measured, not estimated. Requirement 9.17 and 10.7. */
  readonly compressedBytes: number;
}

export interface IllustrationAsset extends VisualAssetBase {
  readonly kind: 'illustration';
  /** Generic nouns only. Checked against a lexicon. Requirement 9.4. */
  readonly depicts: readonly string[];
  /** Visible text that labels the asset an illustration. Requirement 9.4. */
  readonly illustrationLabel: string;
}

export interface MapAsset extends VisualAssetBase {
  readonly kind: 'map';
  /** Visible text labelling the map an orientation aid. Requirement 9.3. */
  readonly orientationAidLabel: string;
  /** A boundary is drawn only from a claim that passed the gate. */
  readonly boundaryClaimId: string | null;
  /** Both structurally false — the type forbids the value. Requirement 9.3. */
  readonly showsCommuteTimes: false;
  readonly showsDistances: false;
}

export interface TextureAsset extends VisualAssetBase {
  readonly kind: 'texture';
  readonly decorative: true;
  readonly altText: null;
}

/** Requirement 10. Nothing of this kind exists yet. */
export interface PhotographAsset extends VisualAssetBase {
  readonly kind: 'photograph';
  readonly personRelease: PersonRelease | null;
  /** At most 120 characters: area name and date taken only. Requirement 10.6. */
  readonly caption: string | null;
  readonly showsRecognisableFace: boolean;
  readonly showsBuildingOrStreet: boolean;
}

export type VisualAssetRecord = IllustrationAsset | MapAsset | TextureAsset | PhotographAsset;

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/** Requirement 10.1 and 9.16. */
export const ALT_TEXT_MIN_LENGTH = 1;
export const ALT_TEXT_MAX_LENGTH = 125;

/** Requirement 10.6. */
export const CAPTION_MAX_LENGTH = 120;

/**
 * Requirement 10.7, per page: at most six photographs, at most 500 KB of
 * photograph bytes, and `priority` on at most one image.
 */
export const PHOTOGRAPHS_PER_PAGE_MAX = 6;
export const PHOTOGRAPH_PAGE_COMPRESSED_BYTE_BUDGET = 500 * 1024;
export const PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX = 1;

/**
 * The checklist entries that unblock the two photograph pathways.
 *
 * Recorded here rather than written into a comment on each call site, so the
 * answer that switches a pathway on is named in one place and the progress report
 * can read it. `docs/implementation/OWNER-FACTS-CHECKLIST.md` holds the wording.
 */
export const PHOTOGRAPHY_CHECKLIST_ENTRY = 'C12';
export const OWNER_PORTRAIT_CHECKLIST_ENTRY = 'C7';

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export interface AssetEvaluation {
  readonly renderable: boolean;
  /** Every reason, so provenance can be completed in one pass. */
  readonly failures: readonly string[];
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A recorded acquisition, licence-expiry or release date.
 *
 * Accepts a calendar date or a full timestamp, because a licence document may
 * carry either, and returns null for anything that is not a date so a malformed
 * value fails loudly rather than comparing as 1970.
 */
function parseRecordedDate(value: string | null): Date | null {
  if (isBlank(value)) return null;
  const trimmed = (value as string).trim();
  const parsed = new Date(CALENDAR_DATE_PATTERN.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function provenanceFailures(asset: VisualAssetRecord): string[] {
  const failures: string[] = [];
  const provenance = asset.provenance;
  const label = `Asset ${asset.assetId}`;

  if (!provenance) {
    failures.push(`${label}: no provenance recorded.`);
    return failures;
  }

  if (isBlank(provenance.creator)) failures.push(`${label}: no creator recorded.`);
  if (isBlank(provenance.sourceReference)) failures.push(`${label}: no source reference recorded.`);
  if (isBlank(provenance.licenceName)) failures.push(`${label}: no licence name recorded.`);
  if (isBlank(provenance.licenceTerms)) failures.push(`${label}: no licence terms recorded.`);
  if (provenance.permissionToAdapt !== 'granted' && provenance.permissionToAdapt !== 'refused') {
    failures.push(`${label}: no permission-to-adapt value recorded.`);
  }
  if (!parseRecordedDate(provenance.acquiredOn)) {
    failures.push(`${label}: no acquisition date recorded.`);
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Captions, Requirement 10.6
// ---------------------------------------------------------------------------

const CAPTION_MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * The date forms a caption may carry, longest first so the fuller form wins.
 *
 * `2027-03`, `2027-03-12`, `March 2027`, `12 March 2027` and `March 12, 2027`.
 */
const CAPTION_DATE_PATTERNS: readonly RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  new RegExp(`\\b\\d{1,2}\\s+(?:${CAPTION_MONTH_NAMES.join('|')})\\s+\\d{4}\\b`, 'i'),
  new RegExp(`\\b(?:${CAPTION_MONTH_NAMES.join('|')})\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'i'),
  new RegExp(`\\b(?:${CAPTION_MONTH_NAMES.join('|')})\\s+\\d{4}\\b`, 'i'),
  /\b\d{4}-\d{2}\b/,
];

/**
 * Requirement 10.6, enforced as a whitelist rather than as a list of words to
 * refuse.
 *
 * The rule the requirement states is that the caption carries *only* the area
 * name and the date the photograph was taken. Written as a list of terms to
 * refuse, the rule would hold for exactly the wording somebody thought of; written
 * as "the area name, a date, and nothing else with a letter or a digit in it", it
 * holds for every wording. The caption of a street photograph is the shortest path
 * from a picture of a locality to an advertisement for a flat on it, so the text
 * that survives removing the two permitted parts is reported word by word.
 *
 * `tests/public-content.test.ts` keeps its own scan of registered captions for the
 * specific terms Requirement 10.10 names. That scan and this rule agree today and
 * are deliberately not the same check: one names the wording that must never
 * appear, this one names the only wording that may.
 */
export function photographCaptionFailures(asset: PhotographAsset): string[] {
  const failures: string[] = [];
  const label = `Asset ${asset.assetId}`;
  const caption = asset.caption;
  if (caption === null) return failures;

  const trimmed = caption.trim();
  if (trimmed.length === 0) {
    failures.push(`${label}: caption is recorded and empty; record null for no caption.`);
    return failures;
  }
  if (trimmed.length > CAPTION_MAX_LENGTH) {
    failures.push(
      `${label}: caption is ${trimmed.length} characters; at most ${CAPTION_MAX_LENGTH} are permitted.`
    );
  }

  const areaName = asset.subject?.name?.trim() ?? '';
  let remainder = trimmed;

  if (areaName.length === 0) {
    failures.push(`${label}: caption cannot be checked because no Bengaluru subject is named.`);
  } else {
    const index = remainder.toLowerCase().indexOf(areaName.toLowerCase());
    if (index < 0) {
      failures.push(`${label}: caption does not name the recorded area "${areaName}".`);
    } else {
      remainder = remainder.slice(0, index) + remainder.slice(index + areaName.length);
    }
  }

  const datePattern = CAPTION_DATE_PATTERNS.find((pattern) => pattern.test(remainder));
  if (!datePattern) {
    failures.push(`${label}: caption records no date the photograph was taken.`);
  } else {
    remainder = remainder.replace(datePattern, ' ');
  }

  const leftover = remainder
    .split(/[^\p{L}\p{N}]+/u)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
  if (leftover.length > 0) {
    failures.push(
      `${label}: caption carries ${leftover.map((word) => `"${word}"`).join(', ')} beyond the area name and the date taken.`
    );
  }

  return failures;
}

/** Requirements 9.13, 9.16, 10.1, 10.2, 10.3, 10.4 and 10.11. */
export function evaluateAsset(asset: VisualAssetRecord, now: Date = new Date()): AssetEvaluation {
  const failures: string[] = [];
  const label = `Asset ${asset.assetId}`;

  if (isBlank(asset.assetId)) failures.push('An asset carries no identifier.');

  if (asset.delivery.mode === 'inline-svg') {
    if (isBlank(asset.delivery.componentName)) {
      failures.push(`${label}: inline delivery names no component.`);
    }
  } else if (isBlank(asset.delivery.publicPath)) {
    failures.push(`${label}: file delivery names no public path.`);
  }

  // Requirement 9.16 and 10.4: intrinsic dimensions are rendered, so they must be
  // recorded as real numbers rather than left to the browser to guess.
  if (!Number.isFinite(asset.intrinsicWidth) || asset.intrinsicWidth <= 0) {
    failures.push(`${label}: no intrinsic width recorded.`);
  }
  if (!Number.isFinite(asset.intrinsicHeight) || asset.intrinsicHeight <= 0) {
    failures.push(`${label}: no intrinsic height recorded.`);
  }

  // Requirement 9.16: recorded alt text, or an empty alt attribute where the
  // register records the asset decorative. Never one standing in for the other.
  if (asset.decorative) {
    if (asset.altText !== null) {
      failures.push(
        `${label}: recorded decorative while carrying alt text; a decorative asset renders an empty alt attribute.`
      );
    }
  } else if (isBlank(asset.altText)) {
    failures.push(`${label}: no alt text recorded and the asset is not recorded decorative.`);
  } else {
    const length = (asset.altText as string).trim().length;
    if (length < ALT_TEXT_MIN_LENGTH || length > ALT_TEXT_MAX_LENGTH) {
      failures.push(
        `${label}: alt text is ${length} characters; ${ALT_TEXT_MIN_LENGTH} to ${ALT_TEXT_MAX_LENGTH} are permitted.`
      );
    }
  }

  if (isBlank(asset.subject?.name)) failures.push(`${label}: no Bengaluru subject named.`);

  if (!Number.isFinite(asset.compressedBytes) || asset.compressedBytes <= 0) {
    failures.push(`${label}: no measured compressed weight recorded.`);
  }

  failures.push(...provenanceFailures(asset));

  // Requirement 10.11: an expired licence fails while any page still references
  // the asset, so the asset stops being renderable on the expiry date itself.
  const licenceExpiresOn = asset.provenance?.licenceExpiresOn ?? null;
  if (licenceExpiresOn !== null) {
    const expiry = parseRecordedDate(licenceExpiresOn);
    if (!expiry) {
      failures.push(`${label}: licence expiry "${licenceExpiresOn}" is not a date.`);
    } else if (now.getTime() >= expiry.getTime()) {
      failures.push(`${label}: the licence expired on ${licenceExpiresOn}.`);
    }
  }

  switch (asset.kind) {
    case 'illustration': {
      if (asset.depicts.length === 0) {
        failures.push(`${label}: no depicted subject recorded.`);
      }
      if (asset.depicts.some((noun) => isBlank(noun))) {
        failures.push(`${label}: a depicted subject is blank.`);
      }
      // Requirement 9.4: the reader is told it is an illustration.
      if (isBlank(asset.illustrationLabel)) {
        failures.push(`${label}: no visible label recording the asset as an illustration.`);
      }
      break;
    }
    case 'map': {
      // Requirement 9.3: the reader is told it is an orientation aid.
      if (isBlank(asset.orientationAidLabel)) {
        failures.push(`${label}: no visible label recording the map as an orientation aid.`);
      }
      if (asset.boundaryClaimId !== null) {
        const claimEvaluation = evaluateClaims([asset.boundaryClaimId], now);
        if (!claimEvaluation.eligible) {
          failures.push(
            ...claimEvaluation.failures.map(
              (reason) => `${label}: boundary claim is not usable — ${reason}`
            )
          );
        }
      }
      break;
    }
    case 'texture':
      break;
    case 'photograph': {
      // Requirement 10.3: a recognisable face needs a written release naming the
      // person, the uses permitted and the release date.
      if (asset.showsRecognisableFace) {
        const release = asset.personRelease;
        if (!release) {
          failures.push(
            `${label}: shows a recognisable face and records no written person release.`
          );
        } else {
          if (isBlank(release.personName)) failures.push(`${label}: the release names no person.`);
          if (release.permittedUses.length === 0) {
            failures.push(`${label}: the release records no permitted use.`);
          }
          const releasedOn = parseRecordedDate(release.releasedOn);
          if (!releasedOn) {
            failures.push(`${label}: the release records no date.`);
          } else if (releasedOn.getTime() > now.getTime()) {
            failures.push(`${label}: the release is dated ${release.releasedOn}, in the future.`);
          }
          // Requirement 10.11: an expired release fails the same way a licence does.
          if (release.expiresOn !== null) {
            const releaseExpiry = parseRecordedDate(release.expiresOn);
            if (!releaseExpiry) {
              failures.push(`${label}: release expiry "${release.expiresOn}" is not a date.`);
            } else if (now.getTime() >= releaseExpiry.getTime()) {
              failures.push(`${label}: the person release expired on ${release.expiresOn}.`);
            }
          }
        }
      } else if (asset.personRelease) {
        // A release for a photograph with no recognisable face is not a failure,
        // but it is worth naming: it usually means one of the two is mis-recorded.
        failures.push(
          `${label}: records a person release while recording no recognisable face; one of the two is wrong.`
        );
      }

      // Requirement 10.6: the caption carries the area name and the date taken,
      // and nothing else. The length bound is part of that rule.
      failures.push(...photographCaptionFailures(asset));
      break;
    }
  }

  return { renderable: failures.length === 0, failures };
}

/** Days until a recorded licence expires, for a maintenance view. Null when none. */
export function daysUntilLicenceExpiry(asset: VisualAssetRecord, now: Date = new Date()): number | null {
  const expiry = parseRecordedDate(asset.provenance?.licenceExpiresOn ?? null);
  if (!expiry) return null;
  return Math.round((expiry.getTime() - now.getTime()) / MILLISECONDS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Generic subjects
// ---------------------------------------------------------------------------

/**
 * The generic nouns a `depicts` value may name. Requirement 9.4.
 *
 * A closed list rather than a pattern, because the failure mode is a specific
 * subject dressed as a generic one: "3rd Block Jayanagar house" reads like a
 * noun phrase and is a named place. Adding a drawing element therefore means
 * adding its noun here, which is a review step rather than a formality.
 *
 * Every entry is a lower-case common noun: a kind of thing found on a thousand
 * Bengaluru streets, never a place, a landmark, a building or a brand. "Gulmohar"
 * is the common name of a tree species, as "rain tree" is. The test suite checks
 * that no entry carries a digit or matches a locality name or alias in the registry.
 */
export const GENERIC_SUBJECT_LEXICON: readonly string[] = [
  // Houses and what is on them.
  'low-rise independent house',
  'parapet water tank',
  'staircase headroom block',
  'parapet baluster',
  'potted plant',
  'window grille',
  'window sunshade',
  'arched window',
  'fanlight',
  'monkey-top window hood',
  'panelled door',
  'wall ventilator',
  'balcony railing',
  'stilt parking',
  'solar water heater',
  // Trees and planting.
  'coconut palm',
  'gulmohar tree',
  'rain tree canopy',
  'bougainvillea',
  // The compound edge.
  'compound wall',
  'compound gate',
  'gate pier',
  // Street services.
  'overhead electric pole',
  'pole insulator',
  'street light',
  'transformer box',
  'cable coil',
  'overhead wire',
  // The footpath.
  'kerb line',
  'painted kerb stone',
  'footpath edge',
  // Schematic and texture vocabulary.
  'ring road arc',
  'radial road',
  'station marker',
  'corridor band',
  'locality plate',
  'neighbouring locality plate',
  'corridor line',
  'layout main road',
  'layout cross road',
  'corner site',
];

/** True when every noun in the list is a member of the lexicon. */
export function areGenericSubjects(depicts: readonly string[]): boolean {
  return depicts.every((noun) => GENERIC_SUBJECT_LEXICON.includes(noun.trim().toLowerCase()));
}

// ---------------------------------------------------------------------------
// Budgets, Requirement 9.17
// ---------------------------------------------------------------------------

/** 80 KB compressed for one illustration, map or texture. */
export const ASSET_COMPRESSED_BYTE_BUDGET = 80 * 1024;

/** 150 KB compressed for everything a single route requests. */
export const ROUTE_COMPRESSED_BYTE_BUDGET = 150 * 1024;

// ---------------------------------------------------------------------------
// The live register
// ---------------------------------------------------------------------------

/**
 * Shared provenance for the inline drawings.
 *
 * Every one of them was drawn for this repository as hand-written SVG geometry.
 * Nothing is traced from a photograph, adapted from a third-party drawing or
 * generated, so the creator is the business and the source reference is the file
 * the geometry lives in. `licenceExpiresOn` is null because an owned original
 * does not expire — unlike a licensed photograph, which is why the field exists.
 */
function originalDrawing(sourceReference: string): MediaProvenance {
  return {
    creator: 'INSTLE REAL ESTATE, in-house drawing',
    sourceReference,
    licenceName: 'Original work owned by INSTLE REAL ESTATE',
    licenceTerms:
      'Drawn for this site as inline SVG geometry. No third-party asset is traced, adapted or embedded, and nothing is generated from a photograph.',
    permissionToAdapt: 'granted',
    acquiredOn: '2026-09-29',
    licenceExpiresOn: null,
  };
}

/**
 * Colours presented behind text, as the token names `src/styles/tokens.css` defines.
 *
 * Read off the components rather than assumed, and all at full opacity, so each
 * is one known value rather than a blend:
 *
 *  - every caption sits on the figure, whose surface is `--color-paper-raised`
 *    (#fdfcfa, `.figure` in `Bengaluru.module.css`); each drawing's ground
 *    rectangle is the same token;
 *  - the orientation plate sets its own area name on a plate filled with that
 *    surface, and each neighbour's name on a plate filled with
 *    `--color-background-elevated` (#eee9df);
 *  - the typographic fallback sets its kicker and name over the whole layout
 *    texture, so both colours the texture paints are behind that text: its ground,
 *    the surface, and its line colour `--color-stone` (#c9c3b7).
 *
 * The streetscape and the corridor schematic carry no text inside the drawing, so
 * the surface under the caption is the only colour behind their text.
 * `tests/media-register-entries.test.tsx` re-derives each list from the rendered
 * markup, and the token test computes the contrast for each declared colour.
 */
const FIGURE_SURFACE = '--color-paper-raised';
const NEIGHBOUR_PLATE_FILL = '--color-background-elevated';
const LAYOUT_LINE = '--color-stone';

/** Requirement 9.3 and 9.4 visible labels, rendered from the register itself. */
export const ILLUSTRATION_LABEL =
  'Illustration drawn for INSTLE REAL ESTATE. A generic Bengaluru street, not a specific property, building or person.';

export const ORIENTATION_AID_LABEL =
  'Orientation aid, not a map to scale. It shows no boundary, no distance and no travel time.';

/**
 * Measured compressed weight, in bytes, of each drawing's `<svg>`.
 *
 * How they are measured: the component is serialised with `renderToStaticMarkup`,
 * the `<svg>` carrying the asset's `data-asset-id` is cut out from its opening tag
 * to its closing tag — the same span `scripts/measure-visual-assets.mjs` cuts from
 * the built HTML — and that span is gzipped at Node's default level. The texture is
 * weighed inside `TypographicPlate`, the only place it renders. The per-locality
 * plate is weighed at the heaviest case the registry can produce: the longest
 * canonical name in the centre and the next four longest around it.
 *
 * `tests/media-register-entries.test.tsx` re-measures every one of these on each
 * run and fails when a recorded value sits more than 1% (at least 16 bytes) from
 * the fresh measurement. The previous values went stale when the drawings were
 * redrawn and nothing noticed; now a redraw that forgets this table fails the suite.
 *
 * What these are not is the served weight. The test renderer and a production
 * build name CSS module classes differently — `_drawing_<hash>` against
 * `Bengaluru-module__<hash>__drawing` — so a served `<svg>` that carries a class
 * gzips a few bytes heavier than the figure here. The build script weighs the
 * served markup against the 80 KB and 150 KB budgets and reports any served weight
 * above the recorded one.
 */
export const MEASURED_COMPRESSED_BYTES = {
  'ILL-STREETSCAPE-001': 3625,
  'ILL-STREETSCAPE-002': 3624,
  'MAP-CORRIDOR-001': 627,
  'TEX-LAYOUT-GRID-001': 1317,
  'MAP-AREA': 759,
} as const;

/**
 * What the full street band draws, left to right, as lexicon nouns: the palm in
 * the side setback, the two-storey house, the gulmohar, the older house with the
 * monkey-top, the rain tree, the house on stilts, the electric pole, and the wires,
 * wall, footpath and kerb running across the whole width.
 */
const STREETSCAPE_FULL_DEPICTS: readonly string[] = [
  'coconut palm',
  'low-rise independent house',
  'parapet water tank',
  'staircase headroom block',
  'window sunshade',
  'window grille',
  'balcony railing',
  'gulmohar tree',
  'parapet baluster',
  'potted plant',
  'arched window',
  'fanlight',
  'monkey-top window hood',
  'panelled door',
  'wall ventilator',
  'bougainvillea',
  'rain tree canopy',
  'stilt parking',
  'solar water heater',
  'compound wall',
  'gate pier',
  'compound gate',
  'overhead wire',
  'overhead electric pole',
  'pole insulator',
  'street light',
  'transformer box',
  'cable coil',
  'footpath edge',
  'kerb line',
  'painted kerb stone',
];

/**
 * What the cropped band shows: its viewBox runs from x 300 to 1000 and y 44 to
 * 240, which keeps the gulmohar, the whole monkey-top house with its bougainvillea,
 * the rain tree and the left bay of the stilt house. The palm, the two-storey house
 * (bar a sliver of its right edge, so its headroom block and balcony are gone), the
 * electric pole and its fittings, and the roof tank, solar heater and balconies of
 * the stilt house all fall outside it.
 */
const STREETSCAPE_CROPPED_DEPICTS: readonly string[] = [
  'low-rise independent house',
  'parapet water tank',
  'window sunshade',
  'window grille',
  'gulmohar tree',
  'parapet baluster',
  'potted plant',
  'arched window',
  'fanlight',
  'monkey-top window hood',
  'panelled door',
  'wall ventilator',
  'bougainvillea',
  'rain tree canopy',
  'stilt parking',
  'compound wall',
  'gate pier',
  'compound gate',
  'overhead wire',
  'footpath edge',
  'kerb line',
  'painted kerb stone',
];

export const STREETSCAPE_FULL_ASSET_ID = 'ILL-STREETSCAPE-001';
export const STREETSCAPE_CROPPED_ASSET_ID = 'ILL-STREETSCAPE-002';
export const CORRIDOR_ASSET_ID = 'MAP-CORRIDOR-001';
export const LAYOUT_GRID_ASSET_ID = 'TEX-LAYOUT-GRID-001';

/** The per-locality orientation plate ID for a slug. Requirement 9.2. */
export function areaOrientationAssetId(slug: string): string {
  return `MAP-AREA-${slug}`;
}

/**
 * The live register.
 *
 * Four inline drawings and no photograph. `PhotographAsset` still has no entry:
 * nothing has been supplied under Owner_Input_Register C12, and an empty
 * photograph set is the honest state rather than a placeholder row.
 *
 * The per-locality orientation plate is absent by construction. Its subject is a
 * record, so its entry is built from that record by `buildAreaOrientationAsset`
 * below; hard-coding one entry per registry record, when none of them can publish,
 * would record assets that no route requests.
 */
export const VISUAL_ASSET_REGISTER: readonly VisualAssetRecord[] = [
  {
    assetId: STREETSCAPE_FULL_ASSET_ID,
    kind: 'illustration',
    delivery: { mode: 'inline-svg', componentName: 'CivicStreetscapeBand' },
    intrinsicWidth: 1200,
    intrinsicHeight: 256,
    altText:
      'Line drawing of a Bengaluru street: low-rise houses with parapet water tanks, a monkey-top window, a rain tree, a gate.',
    decorative: false,
    subject: { kind: 'civic-motif', name: 'Bengaluru residential street motif' },
    provenance: originalDrawing('src/components/Bengaluru/CivicStreetscapeBand.tsx'),
    backgroundColoursBehindText: [FIGURE_SURFACE],
    compressedBytes: MEASURED_COMPRESSED_BYTES['ILL-STREETSCAPE-001'],
    depicts: STREETSCAPE_FULL_DEPICTS,
    illustrationLabel: ILLUSTRATION_LABEL,
  },
  {
    assetId: STREETSCAPE_CROPPED_ASSET_ID,
    kind: 'illustration',
    delivery: { mode: 'inline-svg', componentName: 'CivicStreetscapeBand' },
    intrinsicWidth: 700,
    intrinsicHeight: 196,
    altText:
      'Line drawing of a Bengaluru house with a monkey-top window, a rain tree and a compound gate behind a wall.',
    decorative: false,
    subject: { kind: 'civic-motif', name: 'Bengaluru residential street motif, cropped' },
    provenance: originalDrawing('src/components/Bengaluru/CivicStreetscapeBand.tsx'),
    backgroundColoursBehindText: [FIGURE_SURFACE],
    compressedBytes: MEASURED_COMPRESSED_BYTES['ILL-STREETSCAPE-002'],
    depicts: STREETSCAPE_CROPPED_DEPICTS,
    illustrationLabel: ILLUSTRATION_LABEL,
  },
  {
    assetId: CORRIDOR_ASSET_ID,
    kind: 'map',
    delivery: { mode: 'inline-svg', componentName: 'CorridorDiagram' },
    intrinsicWidth: 960,
    intrinsicHeight: 520,
    altText:
      'Schematic of a ring road arc with radial roads and plain station markers. An orientation aid, not to scale.',
    decorative: false,
    subject: { kind: 'corridor', name: 'Bengaluru ring and radial corridor schematic' },
    provenance: originalDrawing('src/components/Bengaluru/CorridorDiagram.tsx'),
    backgroundColoursBehindText: [FIGURE_SURFACE],
    compressedBytes: MEASURED_COMPRESSED_BYTES['MAP-CORRIDOR-001'],
    orientationAidLabel: ORIENTATION_AID_LABEL,
    boundaryClaimId: null,
    showsCommuteTimes: false,
    showsDistances: false,
  },
  {
    assetId: LAYOUT_GRID_ASSET_ID,
    kind: 'texture',
    delivery: { mode: 'inline-svg', componentName: 'LayoutGridMotif' },
    intrinsicWidth: 1200,
    intrinsicHeight: 320,
    altText: null,
    decorative: true,
    subject: { kind: 'civic-motif', name: 'Bengaluru planned layout grid' },
    provenance: originalDrawing('src/components/Bengaluru/LayoutGridMotif.tsx'),
    // The typographic fallback sets a name over this texture, so the ground and
    // the line colour are both declared: they are the two colours behind that text.
    backgroundColoursBehindText: [FIGURE_SURFACE, LAYOUT_LINE],
    compressedBytes: MEASURED_COMPRESSED_BYTES['TEX-LAYOUT-GRID-001'],
  },
];

export function getVisualAsset(assetId: string): VisualAssetRecord | undefined {
  return VISUAL_ASSET_REGISTER.find((asset) => asset.assetId === assetId);
}

/** Every asset that may render right now, with the reasons the others may not. */
export function auditVisualAssets(now: Date = new Date()): readonly AssetEvaluation[] {
  return VISUAL_ASSET_REGISTER.map((asset) => evaluateAsset(asset, now));
}

// ---------------------------------------------------------------------------
// Route to asset mapping, Requirement 9.2
// ---------------------------------------------------------------------------

/**
 * The Bengaluru element each static route renders.
 *
 * Requirement 9.2 names the homepage and every service page. The area hub is not
 * required to carry one, and carries the corridor schematic because browsing areas
 * is exactly where an orientation aid helps.
 *
 * `scripts/measure-visual-assets.mjs` reads this table, finds the asset in the
 * route's built HTML by its `data-asset-id`, and fails when a route's markup and
 * this table disagree — so the mapping is verified against the build rather than
 * asserted here.
 */
export const STATIC_ROUTE_VISUAL_ASSETS: Readonly<Record<string, readonly string[]>> = {
  '/': [STREETSCAPE_FULL_ASSET_ID],
  '/buy': [STREETSCAPE_CROPPED_ASSET_ID],
  '/sell': [STREETSCAPE_CROPPED_ASSET_ID],
  '/rent': [STREETSCAPE_CROPPED_ASSET_ID],
  '/rent-out': [STREETSCAPE_CROPPED_ASSET_ID],
  '/commercial': [STREETSCAPE_CROPPED_ASSET_ID],
  '/areas': [CORRIDOR_ASSET_ID],
};

// ---------------------------------------------------------------------------
// The per-locality orientation plate
// ---------------------------------------------------------------------------

/** A plate needs a centre and two to four neighbours to mean anything. */
export const MIN_NEIGHBOUR_PLATES = 2;
export const MAX_NEIGHBOUR_PLATES = 4;

/**
 * The draw rule alone: enough neighbours, among the ones handed over, to orient a
 * reader against. `AreaOrientationPlate` applies it to the record it is given and
 * draws exactly that record; deciding which neighbours it is given is the page's
 * job, through `canRenderAreaOrientationPlate` and `areaOrientationPlateRecord`.
 */
export function hasEnoughNeighboursToDraw(relationships: readonly NearbyRelationship[]): boolean {
  return relationships.length >= MIN_NEIGHBOUR_PLATES;
}

/**
 * True when a locality record's page draws the orientation plate.
 *
 * Counted over `renderableNearbyRelationships` — the neighbours the page may link,
 * at the same date and by the same rule — and never over the raw record. A
 * neighbour whose own page fails the gate, or whose relationship has no
 * gate-passing claim, is one the page may not link, so it may not be drawn or
 * counted towards drawing either. Counting the raw record let this answer "plate"
 * for a page that then drew the typographic fallback, and let the Media_Register
 * declare an asset the page never rendered.
 *
 * Below the minimum there is nothing to orient the reader against, so the page
 * renders the typographic treatment alone — Requirement 9.15, which forbids a
 * placeholder, an empty frame or a substitute graphic in that case.
 *
 * `registry` is injectable for tests only; every public caller omits it.
 */
export function canRenderAreaOrientationPlate(
  record: LocalityRecord,
  now: Date = new Date(),
  registry?: readonly LocalityRecord[]
): boolean {
  return hasEnoughNeighboursToDraw(renderableNearbyRelationships(record, now, registry));
}

/**
 * The record the locality page hands `AreaOrientationPlate`: the same record with
 * its neighbours narrowed to `renderableNearbyRelationships`, canonical slugs and
 * all. Property 1 found the plate naming a recorded neighbour whose own page failed
 * the gate; drawing from this record is what rules that out.
 */
export function areaOrientationPlateRecord(
  record: LocalityRecord,
  now: Date = new Date(),
  registry?: readonly LocalityRecord[]
): LocalityRecord {
  return { ...record, approvedNearbyRelationships: renderableNearbyRelationships(record, now, registry) };
}

/** The neighbour slugs the plate draws, capped at four. */
export function areaOrientationNeighbourSlugs(record: LocalityRecord): readonly string[] {
  return record.approvedNearbyRelationships
    .slice(0, MAX_NEIGHBOUR_PLATES)
    .map((relationship) => relationship.slug);
}

/**
 * The Media_Register entry for one locality's orientation plate.
 *
 * `boundaryClaimId` is null and stays null. Requirement 9.3 permits a boundary
 * only from a gate-passing claim, and a claim carries a ward or zone *value*, not
 * a shape — so drawing an outline would mean inventing geometry no source
 * supplied. The administrative value and its boundary version render as text on
 * the page instead, which is what the evidence actually supports.
 */
export function buildAreaOrientationAsset(record: LocalityRecord): MapAsset {
  const name = record.canonicalName;
  const descriptive = `Orientation plate for ${name} with the areas around it. Not to scale.`;
  const altText = descriptive.length <= ALT_TEXT_MAX_LENGTH ? descriptive : `Orientation plate for ${name}.`;

  return {
    assetId: areaOrientationAssetId(record.slug),
    kind: 'map',
    delivery: { mode: 'inline-svg', componentName: 'AreaOrientationPlate' },
    // Equal to the plate's viewBox, so the reserved box has the drawing's shape.
    intrinsicWidth: 480,
    intrinsicHeight: 392,
    altText,
    decorative: false,
    subject: { kind: 'locality', name },
    provenance: originalDrawing('src/components/Bengaluru/AreaOrientationPlate.tsx'),
    // The caption and the centre name sit on the surface; each neighbour name sits
    // on a neighbour plate.
    backgroundColoursBehindText: [FIGURE_SURFACE, NEIGHBOUR_PLATE_FILL],
    compressedBytes: MEASURED_COMPRESSED_BYTES['MAP-AREA'],
    orientationAidLabel: ORIENTATION_AID_LABEL,
    boundaryClaimId: null,
    showsCommuteTimes: false,
    showsDistances: false,
  };
}

/**
 * The asset IDs a locality record's page renders, derived from the record.
 *
 * An unpublished record has no page, so it renders nothing and records nothing.
 * A published one renders exactly one of two things, as the locality template
 * does: the orientation plate when `canRenderAreaOrientationPlate` says so — the
 * same call, over the same neighbours the page may link, at the same date — or the
 * typographic fallback, whose only asset is the layout texture. Recording the
 * texture there matters, because Requirement 9.17 weighs every texture a route
 * requests, not only illustrations and maps.
 *
 * A record's `visualAssetIds` must equal this list. The test asserts the two
 * agree, so publishing a record with an unrecorded asset fails rather than
 * rendering a drawing with no provenance behind it.
 *
 * Static pages carry no record, so their assets are mapped by route in
 * `STATIC_ROUTE_VISUAL_ASSETS` above instead.
 */
export function localityVisualAssetIds(
  record: LocalityRecord,
  now: Date = new Date(),
  registry?: readonly LocalityRecord[]
): readonly string[] {
  if (record.publicationStatus !== 'published') return [];
  return canRenderAreaOrientationPlate(record, now, registry)
    ? [areaOrientationAssetId(record.slug)]
    : [LAYOUT_GRID_ASSET_ID];
}

// ---------------------------------------------------------------------------
// Render-time enforcement, Requirement 9.13
// ---------------------------------------------------------------------------

/**
 * Returns the asset, or throws naming every absent value.
 *
 * Requirement 9.13 says the build fails when a page references an asset whose
 * provenance is incomplete. The components call this while rendering, so an
 * incomplete entry fails `next build` at prerender — before anything is
 * deployable — rather than being caught by a test that somebody may not run.
 */
export function requireRenderableAsset<T extends VisualAssetRecord>(asset: T, now: Date = new Date()): T {
  const evaluation = evaluateAsset(asset, now);
  if (!evaluation.renderable) {
    throw new Error(
      `Media_Register: asset ${asset.assetId} may not render. ${evaluation.failures.join(' ')}`
    );
  }
  return asset;
}

// ---------------------------------------------------------------------------
// Photographs, Requirement 10
// ---------------------------------------------------------------------------

/** Every photograph the register holds. Empty while C12 is unanswered. */
export function registeredPhotographs(): readonly PhotographAsset[] {
  return VISUAL_ASSET_REGISTER.filter((asset): asset is PhotographAsset => asset.kind === 'photograph');
}

/**
 * True when at least one registered photograph may render at `now`.
 *
 * The switch the whole pathway hangs on, and the condition the asset policy scan
 * reads: while this is false, no public page may put an image element in its
 * markup, because there is nothing to put there.
 */
export function hasRenderablePhotograph(now: Date = new Date()): boolean {
  return registeredPhotographs().some((asset) => evaluateAsset(asset, now).renderable);
}

/** One photograph as a page references it. Requirement 10.5's `priority` included. */
export interface PhotographPageEntry {
  readonly asset: PhotographAsset;
  /**
   * Requirement 10.5. Set on at most one image per page, and only on the image the
   * Requirement 9 measurement identifies as the largest contentful paint element.
   */
  readonly priority: boolean;
}

/**
 * Requirement 10.7, over the photographs one page references.
 *
 * Counted per page rather than per asset, because every bound in 10.7 is a page
 * bound: six photographs, 500 KB of photograph bytes, one `priority`. The measured
 * total is reported with the failure, so the fix is a decision about which
 * photograph to drop rather than an investigation.
 */
export function evaluatePhotographPage(
  entries: readonly PhotographPageEntry[],
  now: Date = new Date()
): AssetEvaluation {
  const failures: string[] = [];

  for (const entry of entries) {
    failures.push(...evaluateAsset(entry.asset, now).failures);
  }

  if (entries.length > PHOTOGRAPHS_PER_PAGE_MAX) {
    failures.push(
      `A page references ${entries.length} photographs; at most ${PHOTOGRAPHS_PER_PAGE_MAX} are permitted.`
    );
  }

  const totalBytes = entries.reduce((sum, entry) => sum + (entry.asset.compressedBytes || 0), 0);
  if (totalBytes > PHOTOGRAPH_PAGE_COMPRESSED_BYTE_BUDGET) {
    failures.push(
      `A page references ${totalBytes} bytes of photographs; at most ${PHOTOGRAPH_PAGE_COMPRESSED_BYTE_BUDGET} are permitted.`
    );
  }

  const prioritised = entries.filter((entry) => entry.priority);
  if (prioritised.length > PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX) {
    failures.push(
      `A page sets priority on ${prioritised.length} images (${prioritised
        .map((entry) => entry.asset.assetId)
        .join(', ')}); at most ${PRIORITY_PHOTOGRAPHS_PER_PAGE_MAX} is permitted.`
    );
  }

  return { renderable: failures.length === 0, failures };
}

/**
 * Returns the entries, or throws naming every failure.
 *
 * Requirements 10.2 and 10.11 say the build fails while a page references a
 * photograph whose provenance is incomplete or whose licence or release has
 * expired. A page that references photographs calls this while rendering, so the
 * failure lands at prerender — before anything is deployable — and the photograph
 * leaves the public pages before the next release rather than after somebody
 * notices. Blocked on checklist C12; no page calls it yet, because no photograph
 * is recorded.
 */
export function requirePhotographPage(
  entries: readonly PhotographPageEntry[],
  now: Date = new Date()
): readonly PhotographPageEntry[] {
  const evaluation = evaluatePhotographPage(entries, now);
  if (!evaluation.renderable) {
    throw new Error(`Media_Register: a page may not render its photographs. ${evaluation.failures.join(' ')}`);
  }
  return entries;
}

/** The registered asset for an ID, required to be renderable. */
export function requireRegisteredAsset(assetId: string, now: Date = new Date()): VisualAssetRecord {
  const asset = getVisualAsset(assetId);
  if (!asset) {
    throw new Error(`Media_Register: no entry recorded for asset ${assetId}.`);
  }
  return requireRenderableAsset(asset, now);
}
