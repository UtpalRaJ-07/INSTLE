/**
 * @vitest-environment jsdom
 */
/**
 * The photograph pathway, run rather than described — Requirement 10, tasks 17.1
 * and 17.2.
 *
 * Nothing in this pathway renders on the site today: `VISUAL_ASSET_REGISTER` holds
 * no `PhotographAsset` because no rights-cleared Bengaluru photography has been
 * supplied under Owner_Input_Register C12, and `OWNER_PROFILE.portrait` is null
 * because no released portrait has been supplied under C7. A mechanism that has
 * never been executed is not a mechanism, though, so every branch is exercised here
 * against fixtures: one that clears and renders, and one for each way the register
 * can refuse.
 *
 * The refusals are the point. A pathway that renders the good case is easy; the
 * reason this one can be left switched on is that each of the seven refusals
 * produces exactly nothing — no element, no frame, no caption, no substitute
 * graphic (Requirements 9.15 and 10.9). So every refusal assertion below compares
 * the rendered markup to the empty string rather than to "no `<img>`": an empty
 * frame would satisfy the weaker form.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import OwnerProfilePage from '@/app/about/utpal-raj-kb/page';
import {
  OWNER_PORTRAIT_BLOCKED_BY,
  OwnerPortrait,
  PHOTOGRAPH_PATHWAY_BLOCKED_BY,
  Photograph,
  PhotographSet,
  ownerPortraitPresentation,
} from '@/components/Photograph';
import {
  ALT_TEXT_MAX_LENGTH,
  CAPTION_MAX_LENGTH,
  OWNER_PORTRAIT_CHECKLIST_ENTRY,
  PHOTOGRAPHS_PER_PAGE_MAX,
  PHOTOGRAPHY_CHECKLIST_ENTRY,
  PHOTOGRAPH_PAGE_COMPRESSED_BYTE_BUDGET,
  type MediaProvenance,
  type PersonRelease,
  type PhotographAsset,
  type PhotographPageEntry,
  evaluateAsset,
  hasRenderablePhotograph,
  registeredPhotographs,
  requirePhotographPage,
} from '@/config/media-register';
import { OWNER_PROFILE } from '@/config/owner';

/** One clock. Every expiry below is placed either side of it deliberately. */
const NOW = new Date('2026-09-29T00:00:00.000Z');

function provenance(overrides: Partial<MediaProvenance> = {}): MediaProvenance {
  return {
    creator: 'R. Named Photographer',
    sourceReference: 'Supplied by the owner under Owner_Input_Register C12',
    licenceName: 'Written permission from the photographer',
    licenceTerms: 'Use on this site only; no redistribution.',
    permissionToAdapt: 'refused',
    acquiredOn: '2026-09-01',
    licenceExpiresOn: null,
    ...overrides,
  };
}

function personRelease(overrides: Partial<PersonRelease> = {}): PersonRelease {
  return {
    personName: 'Utpal Raj KB',
    permittedUses: ['Use on the about page of this site'],
    releasedOn: '2026-09-01',
    expiresOn: null,
    ...overrides,
  };
}

/**
 * A street photograph that clears every condition: a file under `/public`, recorded
 * provenance, no recognisable face, intrinsic dimensions, alt text inside the
 * bound, and a caption of the area name and the date taken and nothing else.
 */
function streetPhotograph(overrides: Partial<PhotographAsset> = {}): PhotographAsset {
  return {
    kind: 'photograph',
    assetId: 'PHO-JAYANAGAR-001',
    delivery: { mode: 'file', publicPath: '/media/jayanagar-4th-block-2027-03.jpg' },
    intrinsicWidth: 1600,
    intrinsicHeight: 1067,
    altText: 'A tree-lined residential street in Jayanagar 4th Block, Bengaluru.',
    decorative: false,
    subject: { kind: 'locality', name: 'Jayanagar 4th Block' },
    provenance: provenance(),
    backgroundColoursBehindText: [],
    compressedBytes: 120_000,
    personRelease: null,
    caption: 'Jayanagar 4th Block, March 2027',
    showsRecognisableFace: false,
    showsBuildingOrStreet: true,
    ...overrides,
  };
}

/** A portrait of the owner with a written release, as C7 would supply one. */
function ownerPortrait(overrides: Partial<PhotographAsset> = {}): PhotographAsset {
  return {
    kind: 'photograph',
    assetId: 'PHO-OWNER-001',
    delivery: { mode: 'file', publicPath: '/media/utpal-raj-kb.jpg' },
    intrinsicWidth: 1200,
    intrinsicHeight: 1500,
    altText: 'Utpal Raj KB, owner and CEO of INSTLE REAL ESTATE.',
    decorative: false,
    subject: { kind: 'civic-motif', name: 'Utpal Raj KB' },
    provenance: provenance({ sourceReference: 'Supplied by the owner under Owner_Input_Register C7' }),
    backgroundColoursBehindText: [],
    compressedBytes: 96_000,
    personRelease: personRelease(),
    caption: null,
    showsRecognisableFace: true,
    showsBuildingOrStreet: false,
    ...overrides,
  };
}

function parse(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

// ---------------------------------------------------------------------------
// Switched off, and naming what would switch it on
// ---------------------------------------------------------------------------

describe('the pathway as it stands today (Requirements 9.15, 10.9)', () => {
  it('holds no photograph in the register, so nothing can render', () => {
    expect(registeredPhotographs()).toEqual([]);
    expect(hasRenderablePhotograph(NOW)).toBe(false);
  });

  it('records no owner portrait, and renders nothing in place of one', () => {
    expect(OWNER_PROFILE.portrait).toBeNull();
    expect(renderToStaticMarkup(<OwnerPortrait now={NOW} />)).toBe('');
  });

  it('names the checklist entry that would unblock each pathway', () => {
    // A blocked mechanism that does not say what unblocks it is a mechanism
    // somebody has to go and ask about. C12 is the photography; C7 is the portrait.
    expect(PHOTOGRAPH_PATHWAY_BLOCKED_BY).toBe(PHOTOGRAPHY_CHECKLIST_ENTRY);
    expect(PHOTOGRAPH_PATHWAY_BLOCKED_BY).toBe('C12');
    expect(OWNER_PORTRAIT_BLOCKED_BY).toBe(OWNER_PORTRAIT_CHECKLIST_ENTRY);
    expect(OWNER_PORTRAIT_BLOCKED_BY).toBe('C7');

    const presentation = ownerPortraitPresentation(NOW);
    expect(presentation.kind).toBe('text-treatment');
    if (presentation.kind !== 'text-treatment') throw new Error('unreachable');
    expect(presentation.blockedBy).toBe('C7');
    expect(presentation.reasons.join(' ')).toContain('No portrait of Utpal Raj KB is recorded');
  });

  it('renders nothing for a null asset and nothing for an empty page set', () => {
    expect(renderToStaticMarkup(<Photograph asset={null} now={NOW} />)).toBe('');
    expect(renderToStaticMarkup(<PhotographSet entries={[]} now={NOW} />)).toBe('');
  });

  it('attaches the portrait pathway to /about/utpal-raj-kb, and that page renders no image today', () => {
    // The pathway has to be wired to the route, or a recorded portrait would sit in
    // the register with nothing rendering it. The route renders it with no props, so
    // the only portrait it can ever reach is `OWNER_PROFILE.portrait`.
    const source = readFileSync(join(__dirname, '..', 'src', 'app', 'about', 'utpal-raj-kb', 'page.tsx'), 'utf8');
    expect(source).toContain("import { OwnerPortrait } from '@/components/Photograph'");
    expect(source).toContain('<OwnerPortrait />');

    const markup = renderToStaticMarkup(<OwnerProfilePage />);
    expect(markup).toContain(OWNER_PROFILE.name);
    expect(markup).not.toMatch(/<img\b|<picture\b|<image[\s/>]|\bsrcset=/i);
  });
});

// ---------------------------------------------------------------------------
// The one case that renders — Requirements 10.1, 10.4, 10.6
// ---------------------------------------------------------------------------

describe('a cleared photograph (Requirements 10.1, 10.4, 10.6)', () => {
  it('renders the element with its recorded alt text and intrinsic size', () => {
    const asset = streetPhotograph();
    expect(evaluateAsset(asset, NOW)).toEqual({ renderable: true, failures: [] });

    const image = parse(renderToStaticMarkup(<Photograph asset={asset} now={NOW} />)).querySelector('img');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('src')).toBe('/media/jayanagar-4th-block-2027-03.jpg');
    expect(image!.getAttribute('alt')).toBe(asset.altText);
    // Requirement 10.4: the values are the encoded pixel dimensions, not a guess.
    expect(image!.getAttribute('width')).toBe(String(asset.intrinsicWidth));
    expect(image!.getAttribute('height')).toBe(String(asset.intrinsicHeight));
  });

  it('renders the caption as the area name and the date taken', () => {
    const markup = renderToStaticMarkup(<Photograph asset={streetPhotograph()} now={NOW} />);
    expect(parse(markup).querySelector('figcaption')?.textContent).toBe('Jayanagar 4th Block, March 2027');
  });

  it('renders an empty alt attribute where the register records the photograph decorative', () => {
    const asset = streetPhotograph({ decorative: true, altText: null });
    const image = parse(renderToStaticMarkup(<Photograph asset={asset} now={NOW} />)).querySelector('img');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('alt')).toBe('');
  });

  it('marks the one prioritised image eagerly and every other image lazily (Requirement 10.5)', () => {
    const lazy = parse(
      renderToStaticMarkup(<Photograph asset={streetPhotograph()} now={NOW} />)
    ).querySelector('img');
    expect(lazy!.getAttribute('loading')).toBe('lazy');
    expect(lazy!.getAttribute('fetchpriority')).toBe('auto');

    const eager = parse(
      renderToStaticMarkup(<Photograph asset={streetPhotograph()} now={NOW} priority />)
    ).querySelector('img');
    expect(eager!.getAttribute('loading')).toBe('eager');
    expect(eager!.getAttribute('fetchpriority')).toBe('high');
  });

  it('renders the released owner portrait with alt text naming him (Requirement 10.8)', () => {
    const asset = ownerPortrait();
    expect(evaluateAsset(asset, NOW)).toEqual({ renderable: true, failures: [] });

    const presentation = ownerPortraitPresentation(NOW, asset);
    expect(presentation.kind).toBe('photograph');

    const image = parse(
      renderToStaticMarkup(<OwnerPortrait now={NOW} portrait={asset} />)
    ).querySelector('img');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('alt')).toContain(OWNER_PROFILE.name);
    expect(image!.getAttribute('alt')!.length).toBeLessThanOrEqual(ALT_TEXT_MAX_LENGTH);
    expect(image!.getAttribute('width')).toBe('1200');
    expect(image!.getAttribute('height')).toBe('1500');
  });
});

// ---------------------------------------------------------------------------
// The refusals — Requirements 10.2, 10.3, 10.6, 10.10, 10.11
// ---------------------------------------------------------------------------

/**
 * Each entry: a fixture that must be refused, and a phrase the refusal has to
 * name. The phrase matters because "refused" without a reason is a dead end for
 * whoever has to fix the register entry.
 */
const REFUSALS: readonly { readonly label: string; readonly asset: PhotographAsset; readonly reason: string }[] = [
  {
    label: 'missing provenance (Requirement 10.2)',
    asset: streetPhotograph({
      provenance: provenance({ creator: '', licenceName: '', licenceTerms: '', acquiredOn: '' }),
    }),
    reason: 'no creator recorded',
  },
  {
    label: 'no provenance at all (Requirement 10.2)',
    asset: streetPhotograph({ provenance: undefined as unknown as MediaProvenance }),
    reason: 'no provenance recorded',
  },
  {
    label: 'an expired licence (Requirement 10.11)',
    asset: streetPhotograph({ provenance: provenance({ licenceExpiresOn: '2026-09-29' }) }),
    reason: 'the licence expired on 2026-09-29',
  },
  {
    label: 'an expired person release (Requirement 10.11)',
    asset: ownerPortrait({ personRelease: personRelease({ expiresOn: '2026-09-28' }) }),
    reason: 'the person release expired on 2026-09-28',
  },
  {
    label: 'a recognisable face with no release (Requirement 10.3)',
    asset: ownerPortrait({ personRelease: null }),
    reason: 'records no written person release',
  },
  {
    label: 'alt text over the limit (Requirement 10.4)',
    asset: streetPhotograph({ altText: `Jayanagar ${'a'.repeat(ALT_TEXT_MAX_LENGTH)}` }),
    reason: `${ALT_TEXT_MAX_LENGTH} are permitted`,
  },
  {
    label: 'a caption carrying an availability term (Requirement 10.10)',
    asset: streetPhotograph({ caption: 'Jayanagar 4th Block, March 2027 — 3 BHK available now' }),
    reason: 'beyond the area name and the date taken',
  },
  {
    label: 'a caption carrying an asking price (Requirement 10.10)',
    asset: streetPhotograph({ caption: 'Jayanagar 4th Block, March 2027, 1.4 crore' }),
    reason: 'beyond the area name and the date taken',
  },
  {
    label: 'a caption carrying an offer (Requirement 10.10)',
    asset: streetPhotograph({ caption: 'Flat for sale in Jayanagar 4th Block, March 2027' }),
    reason: 'beyond the area name and the date taken',
  },
  {
    label: 'a caption over the length bound (Requirement 10.6)',
    asset: streetPhotograph({
      caption: `Jayanagar 4th Block${' '.repeat(CAPTION_MAX_LENGTH - 18 - 10)}March 2027`,
    }),
    reason: `${CAPTION_MAX_LENGTH + 1} characters`,
  },
];

describe('every refusal renders nothing at all', () => {
  for (const { label, asset, reason } of REFUSALS) {
    it(`refuses ${label}`, () => {
      const evaluation = evaluateAsset(asset, NOW);
      expect(evaluation.renderable, label).toBe(false);
      expect(evaluation.failures.join(' '), label).toContain(reason);
      // Requirement 9.15: no placeholder, no empty frame, no substitute graphic.
      expect(renderToStaticMarkup(<Photograph asset={asset} now={NOW} />), label).toBe('');
    });
  }

  it('refuses a portrait whose release names somebody else, and names who it does name', () => {
    const asset = ownerPortrait({ personRelease: personRelease({ personName: 'A. Different Person' }) });
    const presentation = ownerPortraitPresentation(NOW, asset);
    expect(presentation.kind).toBe('text-treatment');
    if (presentation.kind !== 'text-treatment') throw new Error('unreachable');
    expect(presentation.reasons.join(' ')).toContain('A. Different Person');
    expect(renderToStaticMarkup(<OwnerPortrait now={NOW} portrait={asset} />)).toBe('');
  });

  it('refuses a portrait whose alt text does not name him (Requirement 10.8)', () => {
    const asset = ownerPortrait({ altText: 'The owner of the business.' });
    const presentation = ownerPortraitPresentation(NOW, asset);
    expect(presentation.kind).toBe('text-treatment');
    expect(renderToStaticMarkup(<OwnerPortrait now={NOW} portrait={asset} />)).toBe('');
  });

  it('refuses a photograph recorded as an inline drawing, rather than guessing at a path', () => {
    const asset = streetPhotograph({
      delivery: { mode: 'inline-svg', componentName: 'CivicStreetscapeBand' },
    });
    expect(renderToStaticMarkup(<Photograph asset={asset} now={NOW} />)).toBe('');
  });

  it('renders the licensed photograph the day before its licence expires, and not on the day', () => {
    // The boundary, so "expired" means the expiry date itself rather than the day after.
    const stillValid = streetPhotograph({ provenance: provenance({ licenceExpiresOn: '2026-09-30' }) });
    expect(renderToStaticMarkup(<Photograph asset={stillValid} now={NOW} />)).toContain('<img');
    const expired = streetPhotograph({ provenance: provenance({ licenceExpiresOn: '2026-09-29' }) });
    expect(renderToStaticMarkup(<Photograph asset={expired} now={NOW} />)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The page bounds — Requirement 10.7, and the build failure of 10.2 and 10.11
// ---------------------------------------------------------------------------

describe('the page bounds (Requirements 10.2, 10.7, 10.11)', () => {
  const entry = (index: number, overrides: Partial<PhotographAsset> = {}): PhotographPageEntry => ({
    asset: streetPhotograph({ assetId: `PHO-JAYANAGAR-${index}`, compressedBytes: 60_000, ...overrides }),
    priority: false,
  });

  it('renders a page of six photographs', () => {
    const entries = Array.from({ length: PHOTOGRAPHS_PER_PAGE_MAX }, (_, index) => entry(index));
    const images = parse(renderToStaticMarkup(<PhotographSet entries={entries} now={NOW} />)).querySelectorAll('img');
    expect(images).toHaveLength(PHOTOGRAPHS_PER_PAGE_MAX);
  });

  it('renders none of seven, rather than the first six', () => {
    // "At most six" is a statement about the page. Dropping the seventh silently
    // would let a page pass a bound it had broken.
    const entries = Array.from({ length: PHOTOGRAPHS_PER_PAGE_MAX + 1 }, (_, index) => entry(index));
    expect(renderToStaticMarkup(<PhotographSet entries={entries} now={NOW} />)).toBe('');
  });

  it('renders none of a page over the byte budget', () => {
    const entries = [entry(0, { compressedBytes: PHOTOGRAPH_PAGE_COMPRESSED_BYTE_BUDGET + 1 })];
    expect(renderToStaticMarkup(<PhotographSet entries={entries} now={NOW} />)).toBe('');
  });

  it('renders none of a page that prioritises two images (Requirement 10.5)', () => {
    const entries: PhotographPageEntry[] = [
      { ...entry(0), priority: true },
      { ...entry(1), priority: true },
    ];
    expect(renderToStaticMarkup(<PhotographSet entries={entries} now={NOW} />)).toBe('');
  });

  it('renders none of a page holding one refused photograph', () => {
    const entries: PhotographPageEntry[] = [
      entry(0),
      { asset: ownerPortrait({ personRelease: null }), priority: false },
    ];
    expect(renderToStaticMarkup(<PhotographSet entries={entries} now={NOW} />)).toBe('');
  });

  it('fails the build for a page that references a photograph it may not render', () => {
    // Requirements 10.2 and 10.11: the failure lands at prerender, so the
    // photograph leaves the public pages before the next release.
    expect(() =>
      requirePhotographPage([{ asset: ownerPortrait({ personRelease: null }), priority: false }], NOW)
    ).toThrow(/may not render its photographs/);
    expect(() => requirePhotographPage([entry(0)], NOW)).not.toThrow();
  });
});
