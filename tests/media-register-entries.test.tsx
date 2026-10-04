import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  CORRIDOR_ASSET_ID,
  GENERIC_SUBJECT_LEXICON,
  LAYOUT_GRID_ASSET_ID,
  MAX_NEIGHBOUR_PLATES,
  STATIC_ROUTE_VISUAL_ASSETS,
  STREETSCAPE_CROPPED_ASSET_ID,
  STREETSCAPE_FULL_ASSET_ID,
  VISUAL_ASSET_REGISTER,
  areGenericSubjects,
  areaOrientationAssetId,
  buildAreaOrientationAsset,
  getVisualAsset,
  localityVisualAssetIds,
  type VisualAssetRecord,
} from '@/config/media-register';
import { LOCALITY_REGISTRY, type LocalityRecord } from '@/config/localities';
import { GUIDE_REGISTRY } from '@/config/guides';
import {
  AreaOrientationPlate,
  CivicStreetscapeBand,
  CorridorDiagram,
  TypographicPlate,
} from '@/components/Bengaluru';

/**
 * The live Media_Register entries, checked against the drawings they describe.
 *
 * `tests/media-register.test.ts` checks the evaluation rules with fixtures. This
 * file checks the other direction: that what the register *records* about each
 * real drawing — its weight, its size, the colours behind its text, the nouns it
 * depicts, the records that render it — is true of the component as it renders
 * today. Each of these facts was stale once already, after a redraw, and nothing
 * failed; these assertions are what makes the next redraw fail instead.
 */

const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function record(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: 'LOC-BLR-TEST',
    canonicalName: 'Test Locality',
    aliases: [],
    entityType: 'locality',
    slug: 'test-locality',
    marketingGroup: 'Test group',
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    summary: 'A summary.',
    summaryClaimIds: [],
    sections: [],
    approvedFaq: [],
    approvedNearbyRelationships: [],
    relatedGuideIds: [],
    postalMappingIds: [],
    imageRightsRecords: [],
    author: 'A. Named Author',
    localReviewer: 'A. Named Local Reviewer',
    seoReviewer: 'A. Named SEO Reviewer',
    editorialApprovedAt: '2026-09-20',
    localReviewApprovedAt: '2026-09-20',
    seoReviewApprovedAt: '2026-09-20',
    sourceCheckedAt: '2026-09-20',
    nextReviewAt: '2027-03-20',
    contentUpdatedAt: '2026-09-20',
    editorialStatus: 'approved',
    publicationStatus: 'published',
    blockingNotes: [],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
    ...overrides,
  };
}

/**
 * Neighbours as the locality page hands them to the plate: gated, and carrying the
 * name the gate resolved. The plate sets that name rather than looking one up, so a
 * weight measured from a nameless relationship would be the weight of a drawing of
 * slugs rather than of the drawing the page renders.
 */
const NEIGHBOURS = [
  { slug: 'north-bengaluru', relationship: 'shares a corridor with this area', claimId: null },
  { slug: 'indiranagar', relationship: 'sits beside this area', claimId: null },
  { slug: 'koramangala', relationship: 'sits beside this area', claimId: null },
].map((relationship) => ({
  ...relationship,
  name: LOCALITY_REGISTRY.find((entry) => entry.slug === relationship.slug)!.canonicalName,
}));

/**
 * The heaviest plate the registry can produce: the longest canonical name in the
 * centre and the next four longest around it. Built the same way the weight test
 * in `tests/visual-identity.test.tsx` builds it, so both files weigh one drawing.
 */
function worstCasePlateRecord(): LocalityRecord {
  const longest = [...LOCALITY_REGISTRY]
    .sort((a, b) => b.canonicalName.length - a.canonicalName.length)
    .slice(0, 1 + MAX_NEIGHBOUR_PLATES);
  return record({
    canonicalName: longest[0]!.canonicalName,
    approvedNearbyRelationships: longest.slice(1).map((neighbour) => ({
      slug: neighbour.slug,
      relationship: 'sits beside this area',
      claimId: null,
      // The gated name, as the page supplies it. The plate sets this rather than
      // looking one up, so the worst case is the longest *names*, not slugs.
      name: neighbour.canonicalName,
    })),
  });
}

const plateRecord = worstCasePlateRecord();
const plateAsset = buildAreaOrientationAsset(plateRecord);

interface RenderedAsset {
  readonly asset: VisualAssetRecord;
  /** The whole component, figure and caption included. */
  readonly markup: string;
}

function registered(assetId: string): VisualAssetRecord {
  const asset = getVisualAsset(assetId);
  if (!asset) throw new Error(`No register entry for ${assetId}`);
  return asset;
}

/** Each asset rendered the way a page renders it. */
const RENDERED: readonly RenderedAsset[] = [
  { asset: registered(STREETSCAPE_FULL_ASSET_ID), markup: renderToStaticMarkup(<CivicStreetscapeBand />) },
  {
    asset: registered(STREETSCAPE_CROPPED_ASSET_ID),
    markup: renderToStaticMarkup(<CivicStreetscapeBand variant="cropped" />),
  },
  { asset: registered(CORRIDOR_ASSET_ID), markup: renderToStaticMarkup(<CorridorDiagram />) },
  {
    // The texture renders only inside the typographic fallback, so it is weighed
    // there, carrying the positioning class that context adds.
    asset: registered(LAYOUT_GRID_ASSET_ID),
    markup: renderToStaticMarkup(
      <TypographicPlate kicker="Bengaluru" name="Test Locality" note="No orientation map yet." />
    ),
  },
  { asset: plateAsset, markup: renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />) },
];

/**
 * The `<svg>` carrying this asset's id, from its opening tag to its first closing
 * tag — the same extraction `scripts/measure-visual-assets.mjs` applies to the
 * built HTML, so the two measure the same span.
 */
function assetSvg(markup: string, assetId: string): string {
  const at = markup.indexOf(`data-asset-id="${assetId}"`);
  if (at === -1) throw new Error(`${assetId} is not in the rendered markup`);
  const start = markup.lastIndexOf('<svg', at);
  const end = markup.indexOf('</svg>', at);
  return markup.slice(start, end + '</svg>'.length);
}

function measuredBytes(markup: string, assetId: string): number {
  return gzipSync(Buffer.from(assetSvg(markup, assetId), 'utf8')).length;
}

// ---------------------------------------------------------------------------
// Weight, Requirement 9.17
// ---------------------------------------------------------------------------

/**
 * How far a recorded weight may sit from a fresh measurement: 1%, and never less
 * than 16 bytes.
 *
 * Not zero, because gzip output is not guaranteed byte-identical across machines:
 * the zlib Node bundles can take different code paths on different CPUs, so the
 * same markup may compress a few bytes apart on the machine that recorded the value
 * and the runner that builds it, and `prebuild` runs this suite, so an exact
 * assertion could fail a deploy over nothing. Not wider, because the point is to
 * catch a redraw: the last one took the street band from 1,275 to 3,625 bytes, and
 * nothing noticed.
 */
function weightTolerance(measured: number): number {
  return Math.max(16, Math.ceil(measured * 0.01));
}

describe('recorded weights are measured from the drawings (Requirement 9.17)', () => {
  for (const { asset, markup } of RENDERED) {
    it(`${asset.assetId} records the weight its markup gzips to`, () => {
      const measured = measuredBytes(markup, asset.assetId);
      const drift = Math.abs(asset.compressedBytes - measured);
      expect(
        drift,
        `${asset.assetId} records ${asset.compressedBytes} bytes; its markup gzips to ${measured}`
      ).toBeLessThanOrEqual(weightTolerance(measured));
    });
  }

  it('weighs the per-locality plate at the heaviest case the registry produces', () => {
    // A lighter record must not record a weight below what the heaviest one serves.
    for (const locality of LOCALITY_REGISTRY.slice(0, 5)) {
      const candidate = record({
        canonicalName: locality.canonicalName,
        slug: locality.slug,
        approvedNearbyRelationships: NEIGHBOURS,
      });
      const markup = renderToStaticMarkup(<AreaOrientationPlate record={candidate} />);
      expect(measuredBytes(markup, areaOrientationAssetId(candidate.slug)), locality.slug).toBeLessThanOrEqual(
        buildAreaOrientationAsset(candidate).compressedBytes
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Intrinsic size, Requirement 9.16
// ---------------------------------------------------------------------------

describe('recorded intrinsic sizes are the drawings’ own (Requirement 9.16)', () => {
  for (const { asset, markup } of RENDERED) {
    it(`${asset.assetId} records the width and height of its viewBox`, () => {
      const svg = assetSvg(markup, asset.assetId);
      const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
      expect(viewBox, asset.assetId).toBeTruthy();
      const [, , width, height] = viewBox!.split(/\s+/).map(Number);
      expect(asset.intrinsicWidth).toBe(width);
      expect(asset.intrinsicHeight).toBe(height);
    });
  }

  it('records the orientation plate at 480 by 392', () => {
    expect([plateAsset.intrinsicWidth, plateAsset.intrinsicHeight]).toEqual([480, 392]);
  });
});

// ---------------------------------------------------------------------------
// Colours behind text, Requirement 9.5 (declared here, computed in 8.4)
// ---------------------------------------------------------------------------

const tokensCss = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8');
const moduleCss = readFileSync(join(ROOT, 'src', 'components', 'Bengaluru', 'Bengaluru.module.css'), 'utf8');

function definedTokens(): Set<string> {
  return new Set([...tokensCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]!));
}

/** The `background-color` token a CSS module rule sets. */
function ruleBackground(selector: string): string {
  const block = moduleCss.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))?.[1];
  const token = block?.match(/background-color:\s*var\((--[a-z0-9-]+)\)/)?.[1];
  if (!token) throw new Error(`.${selector} sets no background-color token`);
  return token;
}

/** `var(--x)` → `--x`; anything else unchanged. */
function tokenName(value: string): string {
  return value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i)?.[1] ?? value;
}

describe('every colour presented behind text is declared (Requirement 9.5)', () => {
  const tokens = definedTokens();
  const figureSurface = ruleBackground('figure');

  it('declares only colours tokens.css defines', () => {
    for (const { asset } of RENDERED) {
      for (const declared of asset.backgroundColoursBehindText) {
        expect(tokens.has(declared), `${asset.assetId} declares ${declared}`).toBe(true);
      }
    }
  });

  it('declares the figure surface the caption sits on, for every asset', () => {
    for (const { asset } of RENDERED) {
      expect(asset.backgroundColoursBehindText, asset.assetId).toContain(figureSurface);
    }
  });

  it('declares only the figure surface where the drawing itself carries no text', () => {
    for (const assetId of [STREETSCAPE_FULL_ASSET_ID, STREETSCAPE_CROPPED_ASSET_ID, CORRIDOR_ASSET_ID]) {
      const { asset, markup } = RENDERED.find((entry) => entry.asset.assetId === assetId)!;
      expect(assetSvg(markup, assetId)).not.toContain('<text');
      expect([...asset.backgroundColoursBehindText], assetId).toEqual([figureSurface]);
    }
  });

  it('declares every colour the texture paints, because the name sits over all of it', () => {
    const { asset, markup } = RENDERED.find((entry) => entry.asset.assetId === LAYOUT_GRID_ASSET_ID)!;
    const painted = new Set(
      [...assetSvg(markup, LAYOUT_GRID_ASSET_ID).matchAll(/\b(?:fill|stroke)="([^"]+)"/g)]
        .map((match) => match[1]!)
        .filter((value) => value !== 'none')
        .map(tokenName)
    );
    painted.add(ruleBackground('plate'));
    expect([...asset.backgroundColoursBehindText].sort()).toEqual([...painted].sort());
  });

  it('declares the fill of every plate the orientation labels sit on', () => {
    const svg = assetSvg(RENDERED.find((entry) => entry.asset === plateAsset)!.markup, plateAsset.assetId);
    const centre = [...svg.matchAll(/<rect[^>]*\brx="[^"]*"[^>]*\bfill="([^"]+)"/g)].map((match) => match[1]!);
    const neighbours = [...svg.matchAll(/<g[^>]*\bfill="([^"]+)"[^>]*>\s*<rect[^>]*\brx=/g)].map(
      (match) => match[1]!
    );
    expect(centre.length).toBeGreaterThan(0);
    expect(neighbours.length).toBeGreaterThan(0);
    const plateFills = new Set([...centre, ...neighbours].map(tokenName));
    plateFills.add(figureSurface);
    expect([...plateAsset.backgroundColoursBehindText].sort()).toEqual([...plateFills].sort());
  });
});

// ---------------------------------------------------------------------------
// Generic subjects, Requirement 9.4
// ---------------------------------------------------------------------------

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('illustrations depict generic nouns only (Requirement 9.4)', () => {
  const full = registered(STREETSCAPE_FULL_ASSET_ID);
  const cropped = registered(STREETSCAPE_CROPPED_ASSET_ID);

  it('records every drawn element of the street as a lexicon noun', () => {
    if (full.kind !== 'illustration') throw new Error('expected an illustration');
    expect(areGenericSubjects(full.depicts)).toBe(true);
    for (const noun of [
      'coconut palm',
      'gulmohar tree',
      'bougainvillea',
      'balcony railing',
      'solar water heater',
      'stilt parking',
      'street light',
      'overhead electric pole',
      'transformer box',
      'overhead wire',
      'compound wall',
      'compound gate',
      'parapet water tank',
      'monkey-top window hood',
      'painted kerb stone',
    ]) {
      expect(full.depicts, noun).toContain(noun);
    }
  });

  it('records for the crop only what the crop shows, all of it drawn in the full band', () => {
    if (full.kind !== 'illustration' || cropped.kind !== 'illustration') throw new Error('expected illustrations');
    expect(areGenericSubjects(cropped.depicts)).toBe(true);
    for (const noun of cropped.depicts) expect(full.depicts, noun).toContain(noun);
    // Outside the crop's viewBox: the palm, the pole and its fittings, the roof heater.
    for (const outside of ['coconut palm', 'overhead electric pole', 'transformer box', 'street light', 'solar water heater']) {
      expect(cropped.depicts, outside).not.toContain(outside);
    }
  });

  it('keeps the lexicon to lower-case common nouns, each listed once', () => {
    expect(new Set(GENERIC_SUBJECT_LEXICON).size).toBe(GENERIC_SUBJECT_LEXICON.length);
    for (const noun of GENERIC_SUBJECT_LEXICON) {
      expect(noun, noun).toBe(noun.toLowerCase());
      expect(noun, noun).not.toMatch(/\d/);
      expect(noun, noun).toMatch(/^[a-z][a-z -]*[a-z]$/);
      expect(noun, noun).not.toMatch(/\b(bengaluru|bangalore)\b/);
    }
  });

  it('names no locality in the registry, by canonical name or alias', () => {
    const names = LOCALITY_REGISTRY.flatMap((locality) => [locality.canonicalName, ...locality.aliases]).map(
      (name) => new RegExp(`\\b${escapeRegExp(name.toLowerCase())}\\b`)
    );
    for (const noun of GENERIC_SUBJECT_LEXICON) {
      const hit = names.find((pattern) => pattern.test(noun));
      expect(hit, `${noun} matches ${hit?.source}`).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Which records render which asset, Requirement 9.2
// ---------------------------------------------------------------------------

describe('visualAssetIds name exactly what a record’s page renders (Requirement 9.2)', () => {
  it('names nothing for an unpublished record, because its route renders nothing', () => {
    expect(
      localityVisualAssetIds(record({ publicationStatus: 'unpublished', approvedNearbyRelationships: NEIGHBOURS }))
    ).toEqual([]);
  });

  it('names the layout texture when the recorded neighbours are ones the page may not link', () => {
    // Three recorded neighbours, none carried by a gate-passing claim and none with a
    // published page: the page links none of them, so it draws the typographic
    // fallback, and the register must say so rather than count the raw record.
    // (This case used to expect the plate, counting the unfiltered relationships;
    // the positive path, with evidenced and published neighbours, is asserted
    // against the rendered page in `tests/internal-links.test.tsx`.)
    expect(localityVisualAssetIds(record({ approvedNearbyRelationships: NEIGHBOURS }))).toEqual([
      LAYOUT_GRID_ASSET_ID,
    ]);
    expect(localityVisualAssetIds(record({ approvedNearbyRelationships: NEIGHBOURS }))).not.toContain(
      areaOrientationAssetId('test-locality')
    );
  });

  it('names the layout texture for a published record that falls back to the typographic plate', () => {
    expect(localityVisualAssetIds(record({ approvedNearbyRelationships: NEIGHBOURS.slice(0, 1) }))).toEqual([
      LAYOUT_GRID_ASSET_ID,
    ]);
  });

  it('records on every locality record what its page renders, which today is nothing', () => {
    for (const locality of LOCALITY_REGISTRY) {
      expect([...locality.visualAssetIds], locality.slug).toEqual([...localityVisualAssetIds(locality)]);
      expect(locality.visualAssetIds, locality.slug).toEqual([]);
    }
  });

  it('records nothing on a guide record, because the guide template renders no drawing', () => {
    const template = readFileSync(join(ROOT, 'src', 'app', 'guides', '[slug]', 'page.tsx'), 'utf8');
    expect(template).not.toContain('@/components/Bengaluru');
    for (const guide of GUIDE_REGISTRY) {
      expect([...guide.visualAssetIds], guide.slug).toEqual([]);
    }
  });

  it('maps every static route only to registered assets', () => {
    for (const [route, assetIds] of Object.entries(STATIC_ROUTE_VISUAL_ASSETS)) {
      for (const assetId of assetIds) {
        expect(getVisualAsset(assetId), `${route} → ${assetId}`).toBeDefined();
      }
    }
  });
});
