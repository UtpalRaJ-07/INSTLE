/**
 * @vitest-environment jsdom
 */

/**
 * The pages that must carry a Bengaluru element, rendered to the HTML the server
 * sends. Task 8.3; Requirements 9.2, 9.3, 9.4, 9.15, 9.16.
 *
 * `visual-identity.test.tsx` checks each component on its own and checks that the
 * page sources name the right component. This file renders the pages themselves,
 * so what is asserted is what a crawler that runs no JavaScript receives:
 *
 *  - the asset IDs in the markup are exactly the ones `STATIC_ROUTE_VISUAL_ASSETS`
 *    records for the route, so the register cannot drift from the page and no page
 *    renders an asset it has not declared;
 *  - the homepage renders the full street band and each service page the cropped
 *    one, compared against the component rendered on its own rather than against
 *    a copied viewBox;
 *  - each illustration sits in a figure whose own caption carries the register's
 *    illustration label, in the same section as the drawing;
 *  - nothing on the page is a placeholder, an empty frame or a substitute graphic;
 *  - the band follows the page's single `<h1>` and its call action, so it never
 *    pushes the phone number further down a small screen.
 *
 * jsdom is used only to parse that markup for structural queries.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from '@/app/page';
import BuyPage from '@/app/buy/page';
import SellPage from '@/app/sell/page';
import RentPage from '@/app/rent/page';
import RentOutPage from '@/app/rent-out/page';
import CommercialPage from '@/app/commercial/page';
import AreasPage from '@/app/areas/page';
import { CivicStreetscapeBand } from '@/components/Bengaluru';
import { PRIMARY_PHONE_TEL } from '@/config/constants';
import {
  CORRIDOR_ASSET_ID,
  ILLUSTRATION_LABEL,
  ORIENTATION_AID_LABEL,
  STATIC_ROUTE_VISUAL_ASSETS,
  STREETSCAPE_CROPPED_ASSET_ID,
  STREETSCAPE_FULL_ASSET_ID,
  requireRegisteredAsset,
} from '@/config/media-register';

function parse(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

function renderedAssetIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('[data-asset-id]')).map(
    (element) => element.getAttribute('data-asset-id') ?? ''
  );
}

function follows(earlier: Node, later: Node): boolean {
  return Boolean(earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/** A commute time or a distance, in the forms a map or caption would state one. */
const MEASUREMENT =
  /\d+(\.\d+)?\s*(km|kms|kilometres?|metres?|mtrs?|m\b|mins?|minutes?|hrs?|hours?)\b/i;

// ---------------------------------------------------------------------------
// The six routes Requirement 9.2 names, and the design's mapping for each.
// ---------------------------------------------------------------------------

type StreetscapeVariant = 'full' | 'cropped';

interface RequiredPage {
  readonly route: string;
  readonly Page: () => React.ReactElement;
  readonly variant: StreetscapeVariant;
  readonly assetId: string;
}

const REQUIRED_PAGES: readonly RequiredPage[] = [
  { route: '/', Page: HomePage, variant: 'full', assetId: STREETSCAPE_FULL_ASSET_ID },
  { route: '/buy', Page: BuyPage, variant: 'cropped', assetId: STREETSCAPE_CROPPED_ASSET_ID },
  { route: '/sell', Page: SellPage, variant: 'cropped', assetId: STREETSCAPE_CROPPED_ASSET_ID },
  { route: '/rent', Page: RentPage, variant: 'cropped', assetId: STREETSCAPE_CROPPED_ASSET_ID },
  { route: '/rent-out', Page: RentOutPage, variant: 'cropped', assetId: STREETSCAPE_CROPPED_ASSET_ID },
  { route: '/commercial', Page: CommercialPage, variant: 'cropped', assetId: STREETSCAPE_CROPPED_ASSET_ID },
];

/** Every static route the register maps, so a new entry without a page here fails. */
const PAGE_FOR_ROUTE: Readonly<Record<string, () => React.ReactElement>> = {
  ...Object.fromEntries(REQUIRED_PAGES.map(({ route, Page }) => [route, Page])),
  '/areas': AreasPage,
};

const BAND_MARKUP: Readonly<Record<StreetscapeVariant, string>> = {
  full: renderToStaticMarkup(<CivicStreetscapeBand />),
  cropped: renderToStaticMarkup(<CivicStreetscapeBand variant="cropped" />),
};

describe('the register and the pages agree (Requirement 9.2)', () => {
  it('maps a page to every static route the register records', () => {
    expect(Object.keys(STATIC_ROUTE_VISUAL_ASSETS).sort()).toEqual(Object.keys(PAGE_FOR_ROUTE).sort());
  });

  for (const [route, Page] of Object.entries(PAGE_FOR_ROUTE)) {
    it(`${route} renders exactly the assets the register records for it, and no others`, () => {
      const page = parse(renderToStaticMarkup(<Page />));
      expect(renderedAssetIds(page)).toEqual([...(STATIC_ROUTE_VISUAL_ASSETS[route] ?? [])]);
    });
  }

  it('records the design mapping for the six routes Requirement 9.2 names', () => {
    for (const { route, assetId } of REQUIRED_PAGES) {
      expect(STATIC_ROUTE_VISUAL_ASSETS[route], route).toEqual([assetId]);
    }
  });
});

describe('the street band on the homepage and the service pages (Requirements 9.2, 9.4, 9.16)', () => {
  for (const { route, Page, variant, assetId } of REQUIRED_PAGES) {
    describe(route, () => {
      const markup = renderToStaticMarkup(<Page />);
      const page = parse(markup);
      const svg = page.querySelector(`svg[data-asset-id="${assetId}"]`);
      const figure = svg?.closest('figure') ?? null;
      const asset = requireRegisteredAsset(assetId);

      it(`renders the ${variant} band, identical to the component rendered on its own`, () => {
        expect(svg, route).not.toBeNull();
        // Compared as served markup, byte for byte, so no serialiser sits between them.
        expect(markup.includes(BAND_MARKUP[variant]), route).toBe(true);
        expect(figure?.outerHTML).toBe(parse(BAND_MARKUP[variant]).firstElementChild?.outerHTML);
        // The other variant is not on the page as well.
        const other = variant === 'full' ? STREETSCAPE_CROPPED_ASSET_ID : STREETSCAPE_FULL_ASSET_ID;
        expect(page.querySelector(`[data-asset-id="${other}"]`), route).toBeNull();
      });

      it('labels the drawing an illustration in its own caption, in the same section', () => {
        expect(asset.kind).toBe('illustration');
        const caption = figure?.querySelector('figcaption') ?? null;
        expect(caption?.textContent).toBe(ILLUSTRATION_LABEL);
        expect(caption?.textContent).toMatch(/^Illustration\b/);
        expect(caption?.closest('section')).toBe(svg?.closest('section'));
      });

      it('carries the recorded intrinsic size and accessible name', () => {
        expect(svg?.getAttribute('width')).toBe(String(asset.intrinsicWidth));
        expect(svg?.getAttribute('height')).toBe(String(asset.intrinsicHeight));
        if (asset.decorative) {
          expect(svg?.getAttribute('aria-hidden')).toBe('true');
        } else {
          expect(svg?.getAttribute('role')).toBe('img');
          expect(svg?.getAttribute('aria-label')).toBe(asset.altText);
        }
      });

      it('states no commute time and no distance in or beside the drawing', () => {
        expect(figure?.textContent ?? '').not.toMatch(MEASUREMENT);
        expect(figure?.querySelector('text')).toBeNull();
      });

      it('renders no placeholder image, empty frame or substitute graphic (Requirement 9.15)', () => {
        expect(page.querySelector('img, picture, canvas, video, iframe, object, embed')).toBeNull();
        expect(markup).not.toMatch(/placeholder|skeleton/i);
        // Every drawing on the page is a registered asset with content inside it.
        for (const drawing of Array.from(page.querySelectorAll('svg'))) {
          expect(drawing.getAttribute('data-asset-id'), route).toBeTruthy();
          expect(drawing.children.length, route).toBeGreaterThan(0);
        }
        // Every figure holds a drawing and its caption, never an empty box.
        const figures = Array.from(page.querySelectorAll('figure'));
        expect(figures).toHaveLength(1);
        for (const frame of figures) {
          expect(frame.querySelector('svg[data-asset-id]'), route).not.toBeNull();
          expect((frame.querySelector('figcaption')?.textContent ?? '').trim().length, route).toBeGreaterThan(0);
        }
      });

      it('keeps one h1, and adds no heading to the outline', () => {
        const headings = Array.from(page.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        expect(page.querySelectorAll('h1')).toHaveLength(1);
        expect(headings[0]?.tagName).toBe('H1');
        // The band carries no heading of its own, so it cannot change the page's
        // heading order.
        expect(svg?.closest('section')?.querySelector('h1, h2, h3, h4, h5, h6') ?? null).toBeNull();
        expect(svg?.closest('figure')?.querySelector('h1, h2, h3, h4, h5, h6') ?? null).toBeNull();
      });

      it('sits after the h1 and the call action, so the phone number stays near the top', () => {
        const h1 = page.querySelector('h1')!;
        const call = page.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`);
        expect(PRIMARY_PHONE_TEL).toBe('tel:9353096264');
        expect(call, route).not.toBeNull();
        expect(follows(h1, svg!)).toBe(true);
        expect(follows(call!, svg!)).toBe(true);
        // The call action lives in the intro section itself, not further down.
        expect(h1.closest('section')?.contains(call!)).toBe(true);
        // And the band is the section directly after that intro.
        expect(h1.closest('section')?.nextElementSibling).toBe(svg!.closest('section'));
      });
    });
  }
});

describe('the corridor schematic on /areas (Requirement 9.3)', () => {
  const page = parse(renderToStaticMarkup(<AreasPage />));
  const svg = page.querySelector(`svg[data-asset-id="${CORRIDOR_ASSET_ID}"]`);

  it('labels the map an orientation aid in its own caption, in the same section', () => {
    const asset = requireRegisteredAsset(CORRIDOR_ASSET_ID);
    expect(asset.kind).toBe('map');
    const caption = svg?.closest('figure')?.querySelector('figcaption') ?? null;
    expect(caption?.textContent).toBe(ORIENTATION_AID_LABEL);
    expect(caption?.closest('section')).toBe(svg?.closest('section'));
  });

  it('draws no boundary and states no commute time or distance', () => {
    const asset = requireRegisteredAsset(CORRIDOR_ASSET_ID);
    if (asset.kind !== 'map') throw new Error('expected a map');
    expect(asset.boundaryClaimId).toBeNull();
    expect(svg?.closest('figure')?.textContent ?? '').not.toMatch(MEASUREMENT);
    expect(page.querySelector('img, picture, canvas')).toBeNull();
  });
});
