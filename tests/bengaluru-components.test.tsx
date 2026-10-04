import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  AreaOrientationPlate,
  CivicStreetscapeBand,
  CorridorDiagram,
  LayoutGridMotif,
  PLATE_LABEL_STYLE,
  TypographicPlate,
  plateLabelLayout,
} from '@/components/Bengaluru';
import { LOCALITY_REGISTRY, type LocalityRecord } from '@/config/localities';
import { MAX_NEIGHBOUR_PLATES, buildAreaOrientationAsset } from '@/config/media-register';

import { PROPERTY_RUN_CONFIG } from './properties/arbitraries';

/**
 * Task 8.1: the five Bengaluru components, as each one renders.
 *
 * `tests/visual-identity.test.tsx` scans the component *sources* and checks the
 * Media_Register side. This file checks the *rendered markup* a reader and a
 * crawler receive, component by component: that each is an inline `<svg>`, that the
 * output reaches no external host and animates nothing, that it carries no signage
 * and no measurement, and that each is either hidden as decoration or named and
 * labelled for what it is.
 */

const COMPONENT_DIR = join(__dirname, '..', 'src', 'components', 'Bengaluru');

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
 * Neighbours as the locality page hands them over: gated, and carrying the name the
 * gate resolved. `AreaOrientationPlate` sets that name and never looks one up —
 * Requirement 12.10 forbids a component rendering a public route from holding the
 * registry — so a fixture standing in for the page carries the name too.
 */
function neighbours(slugs: readonly string[]) {
  return slugs.map((slug) => ({
    slug,
    relationship: 'sits beside this area',
    claimId: null,
    name: LOCALITY_REGISTRY.find((entry) => entry.slug === slug)!.canonicalName,
  }));
}

const PLATE_NEIGHBOURS = neighbours(['indiranagar', 'koramangala', 'north-bengaluru']);
const plateRecord = record({ approvedNearbyRelationships: PLATE_NEIGHBOURS });

/** An attribute value as React serialises it. */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Text a reader sees, with every tag removed. */
function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The opening tag of every `<svg>` in the markup. */
function svgTags(markup: string): string[] {
  return [...markup.matchAll(/<svg\b[^>]*>/g)].map((match) => match[0]);
}

/** Every `<text>` element's visible content. */
function svgTextContent(markup: string): string[] {
  return [...markup.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((match) => visibleText(match[1]!));
}

type Role = 'illustration' | 'map' | 'decorative' | 'typographic';

const RENDERED: readonly { readonly name: string; readonly role: Role; readonly markup: string }[] = [
  { name: 'CivicStreetscapeBand (full)', role: 'illustration', markup: renderToStaticMarkup(<CivicStreetscapeBand />) },
  {
    name: 'CivicStreetscapeBand (cropped)',
    role: 'illustration',
    markup: renderToStaticMarkup(<CivicStreetscapeBand variant="cropped" />),
  },
  { name: 'CorridorDiagram', role: 'map', markup: renderToStaticMarkup(<CorridorDiagram />) },
  { name: 'LayoutGridMotif', role: 'decorative', markup: renderToStaticMarkup(<LayoutGridMotif />) },
  {
    name: 'AreaOrientationPlate',
    role: 'map',
    markup: renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />),
  },
  {
    name: 'TypographicPlate',
    role: 'typographic',
    markup: renderToStaticMarkup(
      <TypographicPlate kicker="Bengaluru" name="Test Locality" note="No orientation map is published yet." />
    ),
  },
];

/** Six substrings that would mean an external request or something that moves. */
const FORBIDDEN_OUTPUT = ['<image', 'xlink:href', 'href="http', '<animate', '<animateTransform', '<set'];

/** A number with a unit of distance or time: what a map must never show. */
const MEASUREMENT =
  /\d+(\.\d+)?\s*(km|kms|kilometres?|kilometers?|m|metres?|meters?|mtrs?|mins?|minutes?|hrs?|hours?)\b/i;

/**
 * Signage a street drawing could carry: a house or door number, a plate-shaped
 * letters-and-digits group such as a vehicle registration, or a shopfront word.
 */
const SIGNAGE =
  /(\bno\.?\s*\d+|#\s*\d+|\b[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,2}\s?\d{3,4}\b|\b(stores?|shop|bakery|medicals?|traders|enterprises|hotel|darshini)\b)/i;

describe('each component renders inline SVG and nothing else that loads', () => {
  for (const { name, markup } of RENDERED) {
    it(`${name} returns an inline <svg> with a viewBox`, () => {
      const tags = svgTags(markup);
      expect(tags.length, name).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag, name).toMatch(/viewBox="[\d.\s-]+"/);
        // Sized by the stylesheet, never by an inline pixel width.
        expect(tag, name).not.toMatch(/style="[^"]*width/);
      }
    });

    it(`${name} renders no external reference and no animation`, () => {
      for (const forbidden of FORBIDDEN_OUTPUT) {
        expect(markup.includes(forbidden), `${name} renders ${forbidden}`).toBe(false);
      }
      expect(markup, name).not.toMatch(/<img\b|<foreignObject|<use\b|url\(/);
    });

    it(`${name} renders no commute time, distance or signage text`, () => {
      const text = visibleText(markup);
      expect(MEASUREMENT.test(text), `${name}: "${text}"`).toBe(false);
      expect(SIGNAGE.test(text), `${name}: "${text}"`).toBe(false);
    });
  }
});

describe('drawings carry no text of their own', () => {
  it('the streetscape, the corridor and the texture contain no <text> element', () => {
    for (const { name, markup } of RENDERED.filter((item) =>
      /CivicStreetscapeBand|CorridorDiagram|LayoutGridMotif/.test(item.name)
    )) {
      expect(markup, name).not.toContain('<text');
    }
  });

  it('the orientation plate sets only the record name and its gated neighbour names', () => {
    const expected = [plateRecord.canonicalName, ...PLATE_NEIGHBOURS.map((relationship) => relationship.name)];
    const markup = RENDERED.find((item) => item.name === 'AreaOrientationPlate')!.markup;
    expect(svgTextContent(markup).sort()).toEqual([...expected].sort());
  });
});

describe('accessibility: decorative is hidden, meaningful is named and labelled', () => {
  for (const { name, role, markup } of RENDERED) {
    it(`${name} exposes the right accessible treatment`, () => {
      const [tag] = svgTags(markup);
      if (role === 'decorative' || role === 'typographic') {
        // The texture, alone or behind the typographic plate, is decoration.
        expect(tag, name).toContain('aria-hidden="true"');
        expect(tag, name).not.toContain('role="img"');
        return;
      }
      expect(tag, name).toContain('role="img"');
      expect(tag, name).toMatch(/aria-label="[^"]{1,125}"/);
      expect(tag, name).not.toContain('aria-hidden');
    });
  }

  it('labels every illustration an illustration in visible text beside it', () => {
    for (const { name, markup } of RENDERED.filter((item) => item.role === 'illustration')) {
      const caption = markup.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '';
      expect(visibleText(caption).toLowerCase(), name).toContain('illustration');
    }
  });

  it('labels every map an orientation aid in visible text beside it', () => {
    for (const { name, markup } of RENDERED.filter((item) => item.role === 'map')) {
      const caption = markup.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '';
      expect(visibleText(caption).toLowerCase(), name).toContain('orientation aid');
    }
  });

  it('sets the typographic name as visible HTML text, not SVG text', () => {
    const markup = RENDERED.find((item) => item.role === 'typographic')!.markup;
    expect(markup).toMatch(/<p\b[^>]*>Test Locality<\/p>/);
    expect(visibleText(markup)).toContain('No orientation map is published yet.');
  });
});

describe('the components are server components', () => {
  it("no file under src/components/Bengaluru declares 'use client'", () => {
    for (const file of readdirSync(COMPONENT_DIR).filter((entry) => /\.tsx?$/.test(entry))) {
      const source = readFileSync(join(COMPONENT_DIR, file), 'utf8');
      expect(source, file).not.toMatch(/['"]use client['"]/);
    }
  });
});

describe('plateLabelLayout', () => {
  it('keeps a short name on one line at the preferred size', () => {
    expect(plateLabelLayout('Hebbal', 216, 'neighbour')).toEqual({
      lines: ['Hebbal'],
      fontSize: PLATE_LABEL_STYLE.neighbour.preferred,
    });
  });

  it('wraps a long name onto two balanced lines before shrinking it', () => {
    const layout = plateLabelLayout('Kengeri Satellite Town', 216, 'neighbour');
    expect(layout.lines).toEqual(['Kengeri', 'Satellite Town']);
    expect(layout.fontSize).toBeGreaterThanOrEqual(PLATE_LABEL_STYLE.neighbour.minimum);
  });

  it('never goes below the role minimum, even for one unbreakable word', () => {
    const layout = plateLabelLayout('Averyveryverylongsingleword', 120, 'neighbour');
    expect(layout.lines).toHaveLength(1);
    expect(layout.fontSize).toBe(PLATE_LABEL_STYLE.neighbour.minimum);
  });
});

// Feature: seo-content-and-bengaluru-identity, Property 9 (rendering clause): a
// renderable asset renders its recorded values exactly as recorded and adds none.

/**
 * **Validates: Requirements 9.3, 9.16**
 *
 * For any locality record carrying two to six approved neighbours drawn from the
 * real registry, the orientation plate renders the intrinsic width, height and alt
 * text its Media_Register entry records, one label per plate capped at four
 * neighbours, the visible orientation-aid label, and no measurement.
 */
describe('Property 9, rendering clause: the orientation plate renders its register entry and adds nothing', () => {
  const slugs = LOCALITY_REGISTRY.map((entry) => entry.slug);

  it('holds for any two to six registry neighbours and any centre name', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...slugs), { minLength: 2, maxLength: 6 }),
        fc.constantFrom(...LOCALITY_REGISTRY.map((entry) => entry.canonicalName)),
        (neighbourSlugs, centreName) => {
          const subject = record({ canonicalName: centreName, approvedNearbyRelationships: neighbours(neighbourSlugs) });
          const asset = buildAreaOrientationAsset(subject);
          const markup = renderToStaticMarkup(<AreaOrientationPlate record={subject} />);
          const [tag] = svgTags(markup);

          expect(tag).toContain(`width="${asset.intrinsicWidth}"`);
          expect(tag).toContain(`height="${asset.intrinsicHeight}"`);
          expect(tag).toContain(`viewBox="0 0 ${asset.intrinsicWidth} ${asset.intrinsicHeight}"`);
          expect(tag).toContain(`aria-label="${escapeAttribute(asset.altText ?? '')}"`);
          expect(svgTextContent(markup)).toHaveLength(Math.min(neighbourSlugs.length, MAX_NEIGHBOUR_PLATES) + 1);
          expect(visibleText(markup)).toContain(asset.orientationAidLabel);
          expect(MEASUREMENT.test(visibleText(markup))).toBe(false);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  });
});
