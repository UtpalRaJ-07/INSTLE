import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import OwnerProfilePage from '@/app/about/utpal-raj-kb/page';
import AboutPage from '@/app/about/page';
import { OWNER_PROFILE } from '@/config/owner';

import {
  ASSET_COMPRESSED_BYTE_BUDGET,
  CORRIDOR_ASSET_ID,
  ILLUSTRATION_LABEL,
  LAYOUT_GRID_ASSET_ID,
  MAX_NEIGHBOUR_PLATES,
  MIN_NEIGHBOUR_PLATES,
  ORIENTATION_AID_LABEL,
  ROUTE_COMPRESSED_BYTE_BUDGET,
  STATIC_ROUTE_VISUAL_ASSETS,
  STREETSCAPE_CROPPED_ASSET_ID,
  STREETSCAPE_FULL_ASSET_ID,
  VISUAL_ASSET_REGISTER,
  areGenericSubjects,
  areaOrientationAssetId,
  buildAreaOrientationAsset,
  canRenderAreaOrientationPlate,
  evaluateAsset,
  getVisualAsset,
  hasEnoughNeighboursToDraw,
  hasRenderablePhotograph,
  localityVisualAssetIds,
  registeredPhotographs,
  requireRegisteredAsset,
} from '@/config/media-register';
import { OwnerPortrait, Photograph, ownerPortraitPresentation } from '@/components/Photograph';
import { LOCALITY_REGISTRY, type LocalityRecord } from '@/config/localities';
import { GUIDE_REGISTRY } from '@/config/guides';
import {
  AreaOrientationPlate,
  CivicStreetscapeBand,
  CorridorDiagram,
  LayoutGridMotif,
  PLATE_LABEL_STYLE,
  PLATE_VIEWBOX_WIDTH,
  TypographicPlate,
  plateLabelLayout,
} from '@/components/Bengaluru';

import {
  type ImportClosure,
  type ImportedFile,
  ROOT,
  SRC,
  collectFiles,
  collectPublicSurfaceFiles,
  readImportedFile,
  stripComments,
  stripCommentsFor,
  walkImportClosure,
} from './helpers/public-surface';
import { STATIC_ROUTE_PAGES, renderRouteContent } from './helpers/rendered-routes';

/** One clock for every expiry this file evaluates. */
const NOW = new Date('2026-09-29T00:00:00.000Z');

/**
 * The Bengaluru identity, checked against Requirement 9.
 *
 * Three kinds of assertion, deliberately mixed:
 *
 *  - **Source scans**, for the properties an asset must not have. "Contains no
 *    `<image`" is a statement about the file, and a rendered snapshot would not
 *    catch a reference added inside a branch that this test happens not to render.
 *  - **Rendered markup**, for the properties a reader experiences: the label, the
 *    accessible name, the intrinsic dimensions, the absence of a visible numeral.
 *  - **Measured weight**, gzipped from the rendered markup, for the two assets no
 *    built route requests today — the ones `scripts/measure-visual-assets.mjs`
 *    cannot reach because no locality record passes the publication gate.
 */

const BENGALURU_DIR = join(SRC, 'components', 'Bengaluru');

/**
 * Comments are removed before scanning, the same way `tests/public-content.test.ts`
 * does it (`tests/helpers/public-surface.ts`). A comment explaining why `<img>` is
 * banned is not output, and treating it as a violation would make the scan
 * unusable — the files here document the ban at length, on purpose. A stylesheet
 * loses its block comments only, since `//` is not a comment in CSS.
 */
const bengaluruFiles = collectFiles(BENGALURU_DIR, ['.tsx', '.ts', '.css']).map((file) => ({
  path: relative(ROOT, file),
  text: stripCommentsFor(file, readFileSync(file, 'utf8')),
}));

/** Text a reader or an extracting system sees, with every tag removed. */
function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// 8.5 — the asset policy scan
// ---------------------------------------------------------------------------

/**
 * The six the design names, each matched as an element or an attribute rather
 * than as a bare substring, so `<set` cannot trip on `<section` or `<settings` and
 * `<image` cannot trip on `<imageFrame`. JSX spells two of them differently —
 * `xlinkHref`, and an `href` whose value is an expression or an object property —
 * so those spellings are matched too, as is a protocol-relative `//host` address.
 * `<animate` also covers `<animateMotion` and `<animateColor`, the other two SMIL
 * animation elements.
 */
const FORBIDDEN_IN_IDENTITY: readonly { readonly name: string; readonly pattern: RegExp }[] = [
  { name: '<image', pattern: /<image[\s/>]/ },
  { name: 'xlink:href', pattern: /xlink:href|xlinkHref/ },
  { name: 'href="http', pattern: /\bhref\s*[:=]\s*\{?\s*["'`]\s*(https?:)?\/\//i },
  { name: '<animate', pattern: /<animate(Motion|Color)?[\s/>]/ },
  { name: '<animateTransform', pattern: /<animateTransform[\s/>]/ },
  { name: '<set', pattern: /<set[\s/>]/ },
];

function forbiddenPattern(name: string): RegExp {
  return FORBIDDEN_IN_IDENTITY.find((entry) => entry.name === name)!.pattern;
}

/**
 * Requirements 9.9 and 9.11, for the identity folder.
 *
 * Every `.ts`, `.tsx` and `.css` file under `src/components/Bengaluru/` is scanned,
 * the stylesheet included, for two reasons. A `url(…)` is a request the page makes
 * whether it is written in markup or in CSS. And a `@keyframes` rule, an
 * `animation` or a `transition` in the stylesheet is motion this feature would be
 * introducing, which Requirement 9.9 would then need suppressed. The design meets
 * 9.9 by there being nothing to suppress — stronger than a media query — and that
 * is only true if the stylesheet holds no motion either.
 */
describe('asset policy: the identity requests nothing and moves nothing (Requirements 9.9, 9.11)', () => {
  it('scans every file in the folder, and every file there is .ts, .tsx or .css', () => {
    // An .svg or .png dropped into the folder would sit outside a scan filtered by
    // extension, so the filtered list must be the whole folder.
    const everyFile = collectFiles(BENGALURU_DIR, [''])
      .filter((file) => !basename(file).startsWith('.'))
      .map((file) => relative(ROOT, file));
    expect(bengaluruFiles.map((file) => file.path).sort()).toEqual([...everyFile].sort());

    const names = bengaluruFiles.map((file) => file.path);
    for (const expected of [
      'CivicStreetscapeBand.tsx',
      'CorridorDiagram.tsx',
      'LayoutGridMotif.tsx',
      'AreaOrientationPlate.tsx',
      'TypographicPlate.tsx',
      'Bengaluru.module.css',
    ]) {
      expect(names.some((name) => name.endsWith(expected)), expected).toBe(true);
    }
  });

  it('matches each forbidden name as an element, not as the start of a longer name', () => {
    expect(forbiddenPattern('<set').test('<set attributeName="x" to="1" />')).toBe(true);
    expect(forbiddenPattern('<set').test('<section className="band">')).toBe(false);
    expect(forbiddenPattern('<set').test('<settings />')).toBe(false);
    expect(forbiddenPattern('<image').test('<image href="a.png" />')).toBe(true);
    expect(forbiddenPattern('<image').test('<imageFrame />')).toBe(false);
    expect(forbiddenPattern('<animate').test('<animate attributeName="x" />')).toBe(true);
    expect(forbiddenPattern('<animateTransform').test('<animateTransform type="rotate" />')).toBe(true);
    expect(forbiddenPattern('xlink:href').test('<use xlinkHref="#a" />')).toBe(true);
    expect(forbiddenPattern('href="http').test('<a href={"https://example.com"}>')).toBe(true);
    expect(forbiddenPattern('href="http').test("{ href: '//cdn.example.com/a.svg' }")).toBe(true);
    expect(forbiddenPattern('href="http').test('<a href="#main-content">')).toBe(false);
  });

  for (const { name, pattern } of FORBIDDEN_IN_IDENTITY) {
    it(`contains no ${name} anywhere under src/components/Bengaluru/`, () => {
      const hits = bengaluruFiles.filter((file) => pattern.test(file.text)).map((file) => file.path);
      expect(hits).toEqual([]);
    });
  }

  it('creates none of those elements by name through createElement either', () => {
    for (const file of bengaluruFiles) {
      expect(file.text, file.path).not.toMatch(/createElement\(\s*["'`](image|animate\w*|set)["'`]/);
    }
  });

  it('declares no animation, transition or scroll behaviour, in the stylesheet or in script', () => {
    const MOTION: readonly RegExp[] = [
      /@keyframes\b/,
      // animation:, animation-name:, animationName: — CSS and inline style alike.
      /\banimation[\w-]*\s*:/i,
      /\btransition[\w-]*\s*:/i,
      // scroll-behavior in CSS, scrollBehavior in a style object or a scroll call.
      /\bscroll-?behavior\b/i,
      /\bscroll(IntoView|To|By)\s*\(/,
      // The Web Animations API and a frame loop are motion too.
      /\.animate\s*\(/,
      /\brequestAnimationFrame\b/,
    ];
    for (const file of bengaluruFiles) {
      for (const pattern of MOTION) {
        expect(pattern.test(file.text), `${file.path} matches ${pattern.source}`).toBe(false);
      }
    }
  });

  it('loads nothing: no url(), @import or @font-face, and no address but the SVG namespace', () => {
    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
    for (const file of bengaluruFiles) {
      expect(file.text, file.path).not.toMatch(/\burl\s*\(|@import\b|@font-face\b|image-set\s*\(|next\/font/i);
      const addresses = [...file.text.matchAll(/(?:https?:)?\/\/[\w.-]+\.[a-z]{2,}[^\s'"`)]*/gi)]
        .map((match) => match[0])
        .filter((address) => address !== SVG_NAMESPACE);
      expect(addresses, file.path).toEqual([]);
    }
  });

  it('sets type only through the font tokens, so no drawing asks for a font the system stack lacks', () => {
    for (const file of bengaluruFiles) {
      const values = [...file.text.matchAll(/\bfont-?family\s*[:=]\s*\{?\s*["'`]?([^;"'`}\n]+)/gi)].map((match) =>
        match[1]!.trim()
      );
      for (const value of values) {
        expect(value, file.path).toMatch(/^var\(--font-[a-z-]+\)$/);
      }
    }
  });

  it('uses no opacity, so every colour behind text is a known value and not a blend', () => {
    for (const file of bengaluruFiles) {
      expect(file.text, file.path).not.toMatch(/fillOpacity|strokeOpacity|opacity[:=]/);
    }
  });

  it('renders no raster image element and imports no image component', () => {
    for (const file of bengaluruFiles) {
      expect(file.text, file.path).not.toMatch(/<img\b|<picture\b|<foreignObject\b|next\/image|data:image\//);
    }
  });
});

// ---------------------------------------------------------------------------
// 8.5 — no generated or photographic image on a public page (Requirement 9.14)
// ---------------------------------------------------------------------------

/** Raster and photographic formats. A generated picture of anything is one of these. */
const RASTER_EXTENSIONS: readonly string[] = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  '.bmp',
];
const RASTER_REFERENCE = /\.(jpe?g|png|webp|avif|gif|heic|heif|tiff?|bmp)\b/i;

/**
 * Words that, in an image's file name, source or alt text, describe a generated
 * picture or one of the five subjects Requirement 9.14 bans. A photograph admitted
 * later under Requirement 10 carries an area name and a date (Requirement 10.6), so
 * none of these belongs in its name or its alt text.
 */
const BANNED_IMAGE_SUBJECTS: readonly { readonly subject: string; readonly words: readonly string[] }[] = [
  {
    subject: 'generated',
    words: ['ai', 'generated', 'synthetic', 'midjourney', 'dalle', 'dall', 'diffusion', 'sdxl', 'firefly', 'cgi', 'render', 'rendered', 'rendering'],
  },
  {
    subject: 'portrait',
    words: ['portrait', 'headshot', 'selfie', 'avatar', 'face', 'owner', 'founder', 'ceo', 'team', 'staff', 'person', 'people'],
  },
  {
    subject: 'office',
    words: ['office', 'workspace', 'desk', 'reception', 'boardroom', 'conference', 'consultation', 'meeting'],
  },
  {
    subject: 'transaction',
    words: ['handshake', 'keys', 'handover', 'signing', 'contract', 'agreement', 'deal', 'sold', 'closing'],
  },
  {
    subject: 'customer',
    words: ['customer', 'client', 'buyer', 'seller', 'tenant', 'landlord', 'family', 'couple', 'testimonial'],
  },
  {
    subject: 'property',
    words: ['property', 'villa', 'apartment', 'flat', 'penthouse', 'bungalow', 'condo', 'house', 'home', 'residence', 'residential', 'interior', 'exterior', 'facade', 'listing', 'building'],
  },
];

/** The banned subject an image name or alt text describes, if any. */
function bannedImageSubject(reference: string): string | null {
  const tokens = reference
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const { subject, words } of BANNED_IMAGE_SUBJECTS) {
    if (tokens.some((token) => words.some((word) => token === word || token === `${word}s` || token === `${word}es`))) {
      return subject;
    }
  }
  return null;
}

type ScannedFile = ImportedFile;

/**
 * "A public page" is the enumeration in `tests/helpers/public-surface.ts` — the same
 * one `tests/public-content.test.ts` scans — plus whatever a file in it imports
 * from outside it, found by following the imports. A page references what it
 * renders, whichever folder that lives in, so an excluded folder is only safe to
 * exclude while nothing public imports it. Today the walk reaches one excluded
 * file, `ConceptSwitcher`, which `LayoutShell` renders on the prototype routes
 * only; it is scanned like everything else.
 *
 * The walk itself is `walkImportClosure` in the shared helper, the same one the
 * Requirement 12.15 coverage floor is derived from. One resolver, so this scan and
 * that floor cannot disagree about what an import resolves to. The difference is
 * only the seed: everything public here, the route files alone there.
 */
function walkPublicSurface(): ImportClosure {
  return walkImportClosure(collectPublicSurfaceFiles(['.tsx', '.ts', '.css']));
}

/** Every value that names an image: a source, an alt text, a raster path or a CSS url(). */
function imageReferences(scanned: ScannedFile): string[] {
  const out: string[] = [];
  if (scanned.file.endsWith('.css')) {
    for (const match of scanned.text.matchAll(/\burl\s*\(\s*["']?([^"')]*)["']?\s*\)/gi)) out.push(match[1]!);
    return out;
  }
  for (const match of scanned.text.matchAll(/\b(src|srcSet|poster|alt)\s*[:=]\s*\{?\s*(["'`])([^"'`]*)\2/g)) {
    out.push(match[3]!);
  }
  for (const match of scanned.text.matchAll(/["'`]([^"'`\s]+\.(?:jpe?g|png|webp|avif|gif|heic|heif|tiff?|bmp|svg))["'`]/gi)) {
    out.push(match[1]!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The one gated pathway, and the conditions that come with naming it
// ---------------------------------------------------------------------------

/**
 * The single file permitted to write an image element, and the only file.
 *
 * Requirement 10 is an optional pathway for real Bengaluru photography, and a
 * pathway that exists only as prose is a pathway nobody has run. So one file —
 * `src/components/Photograph/Photograph.tsx` — writes the element, and this scan
 * stops reporting the bare `<img` literal there. Nothing else about that file is
 * relaxed: a raster path, a `data:` source, `next/image`, `srcSet`, a CSS
 * background, a structured-data image key and every generated-subject word are all
 * still violations in it, and `<picture`, `<Image` and `<image` still are too.
 *
 * Naming one file is a smaller permission than the scan gave before, but it is
 * still a permission, so three conditions are added to pay for it and none is
 * removed:
 *
 *  1. the list holds exactly one entry, it is that file, and that file is actually
 *     in the scanned closure — a permission for a file nobody reads would let the
 *     element move somewhere else unnoticed;
 *  2. the same text at any other path is still reported, so the permission belongs
 *     to the pathway rather than to the pattern;
 *  3. **the register condition**: no markup a public route sends may carry an image
 *     element while the Media_Register holds no renderable `PhotographAsset`.
 *     `VISUAL_ASSET_REGISTER` holds zero photographs today, so a rendered image is
 *     forbidden outright — the element exists in the source of a component that
 *     cannot produce one. That condition reads what a reader receives rather than
 *     what a file contains, which is the thing Requirements 9.14, 9.15 and 10.9 are
 *     actually about, and it is a check this suite did not have before.
 *
 * So this is not an amnesty. Before, an image element anywhere under `src/` failed.
 * Now an image element anywhere under `src/` except one named, provably inert
 * component fails, *and* an image element in anything a route sends fails until a
 * cleared photograph is recorded. The set of states that pass has shrunk.
 */
const PHOTOGRAPH_PATHWAY_FILES: readonly string[] = [
  join('src', 'components', 'Photograph', 'Photograph.tsx'),
];

/** The bare element, the one pattern the gated pathway is permitted to carry. */
const PATHWAY_PERMITTED_PATTERN = /<img\b/;

/** Everything on the public surface that would put a raster or external image on a page. */
function imageViolations(scanned: ScannedFile): string[] {
  const hits: string[] = [];
  if (scanned.file.endsWith('.css')) {
    // A fragment reference, url(#id), points into the page itself and loads nothing.
    for (const pattern of [/\burl\s*\(\s*(?!["']?#)/i, /image-set\s*\(/i]) {
      if (pattern.test(scanned.text)) hits.push(pattern.source);
    }
    return hits;
  }
  const patterns: readonly RegExp[] = [
    RASTER_REFERENCE,
    /data:image\//i,
    /<img\b/,
    /<picture\b/,
    /<Image\b/,
    /<image[\s/>]/,
    /\bsrcSet\b/,
    /\bposter\s*=/,
    /\bbackgroundImage\b/,
    /background(-image)?\s*:[^;'"`]*url\(/i,
    // An Open Graph, Twitter or structured-data image.
    /\b(images|image|logo|thumbnailUrl)\s*:/,
    /["'](image|logo|thumbnailUrl)["']\s*:/,
    // A generator named, or an image described as generated.
    /midjourney/i,
    /dall[\s-]?e\b/i,
    /stable[\s-]diffusion/i,
    /\bai[\s-](generated|created|rendered)\b/i,
    /(generated|synthetic)\s+(portrait|photo|photograph|image|headshot|scene)/i,
  ];
  const isGatedPathway = PHOTOGRAPH_PATHWAY_FILES.includes(scanned.path);
  for (const pattern of patterns) {
    if (isGatedPathway && pattern.source === PATHWAY_PERMITTED_PATTERN.source) continue;
    if (pattern.test(scanned.text)) hits.push(pattern.source);
  }
  for (const specifier of scanned.packages) {
    // next/og renders an image from code, so it is as much an image as a file is.
    if (/^next\/(legacy\/)?image$|^next\/og$/.test(specifier) || RASTER_REFERENCE.test(specifier)) {
      hits.push(`imports ${specifier}`);
    }
  }
  return hits;
}

/**
 * The register condition, stated over markup rather than over source text.
 *
 * `\bsrcset=` and a non-fragment `url(` are in here as well as the elements: an
 * image reaches a reader through a responsive source or a background just as well
 * as through a tag. `url(#id)` points into the document and loads nothing, so it is
 * excluded the same way the stylesheet scan excludes it.
 */
const RENDERED_IMAGE_PATTERNS: readonly RegExp[] = [
  /<img\b/i,
  /<picture\b/i,
  /<image[\s/>]/i,
  /\bsrcset=/i,
  /\bbackground(-image)?\s*:[^;"']*url\(/i,
  /url\(\s*(?!["']?#)/i,
];

/**
 * Why markup a public route sends may not carry an image element, if it may not.
 *
 * The permission is conditional on the register: an image element is allowed in
 * served markup only while `VISUAL_ASSET_REGISTER` holds at least one
 * `PhotographAsset` that `evaluateAsset` clears at `now`. It holds none, so every
 * image element in served markup is a violation today, and the reason names the
 * empty register rather than the pattern alone.
 */
function renderedImagePolicyFailures(markup: string, now: Date): string[] {
  const found = RENDERED_IMAGE_PATTERNS.filter((pattern) => pattern.test(markup)).map(
    (pattern) => pattern.source
  );
  if (found.length === 0) return [];
  if (hasRenderablePhotograph(now)) return [];
  return found.map(
    (pattern) =>
      `${pattern} is rendered while the Media_Register holds no renderable photograph (${registeredPhotographs().length} recorded)`
  );
}

describe('asset policy: no generated or photographic image on a public page (Requirement 9.14)', () => {
  const surface = walkPublicSurface();

  it('follows every local import to a file, and reaches the pages and their stylesheets', () => {
    expect(surface.unresolved).toEqual([]);
    const paths = surface.files.map((scanned) => scanned.path);
    expect(paths.length).toBeGreaterThan(40);
    expect(paths).toContain(join('src', 'app', 'layout.tsx'));
    expect(paths).toContain(join('src', 'styles', 'globals.css'));
    expect(paths.some((path) => path.endsWith('.module.css'))).toBe(true);
  });

  it('reaches no ArchitecturalGraphic and no prototype image component from any public file', () => {
    // The earlier phase took the conceptual architectural images off the public
    // pages. These folders still hold them, so none may be reachable.
    const reached = surface.files
      .map((scanned) => scanned.path)
      .filter((path) =>
        [`ArchitecturalGraphic${sep}`, `Concept1${sep}`, `Concept2${sep}`, `concept-review${sep}`].some((folder) =>
          path.includes(`${sep}${folder}`)
        )
      );
    expect(reached).toEqual([]);
  });

  it('references no raster, external or generated image anywhere a public page reaches', () => {
    const hits = surface.files.flatMap((scanned) =>
      imageViolations(scanned).map((pattern) => `${scanned.path} matches ${pattern}`)
    );
    expect(hits).toEqual([]);
  });

  it('permits the image element in exactly one file, and that file is on the scanned surface', () => {
    // A permission granted to a file the scan never reads would be no permission at
    // all, and the element could then move into a file nobody checks.
    expect(PHOTOGRAPH_PATHWAY_FILES).toEqual([join('src', 'components', 'Photograph', 'Photograph.tsx')]);
    const scanned = surface.files.filter((file) => PHOTOGRAPH_PATHWAY_FILES.includes(file.path));
    expect(scanned).toHaveLength(1);
    expect(scanned[0]!.text).toMatch(PATHWAY_PERMITTED_PATTERN);
  });

  it('still refuses that same element at any other path, so the permission is the pathway and not the pattern', () => {
    const pathway = surface.files.find((file) => PHOTOGRAPH_PATHWAY_FILES.includes(file.path))!;
    for (const elsewhere of [
      join('src', 'components', 'Header', 'Header.tsx'),
      join('src', 'app', 'about', 'page.tsx'),
      join('src', 'components', 'Photograph', 'OwnerPortrait.tsx'),
      join('src', 'components', 'Photograph', 'Photograph.ts'),
    ]) {
      expect(imageViolations({ ...pathway, path: elsewhere }), elsewhere).toContain('<img\\b');
    }
    // And the permission covers the bare element only: the framework component,
    // <picture> and the SVG element are still refused inside the pathway itself.
    for (const [label, text] of [
      ['<Image', '<Image src={source} alt="" />'],
      ['<picture', '<picture><source /></picture>'],
      ['<image', '<image href="/media/x" />'],
      ['a raster path', 'const source = "/media/jayanagar.jpg";'],
      ['a data source', 'const source = "data:image/png;base64,AAA";'],
    ] as const) {
      expect(imageViolations({ ...pathway, text }), label).not.toEqual([]);
    }
  });

  it('refuses a rendered image element while the register holds no renderable photograph', () => {
    // The register condition, with teeth. Zero photographs are recorded, so served
    // markup carrying an image element is refused and the refusal says why.
    expect(registeredPhotographs()).toEqual([]);
    expect(hasRenderablePhotograph(NOW)).toBe(false);
    for (const markup of [
      '<figure><img src="/media/jayanagar-2027-03.jpg" width="1200" height="800" alt="Jayanagar, March 2027" /></figure>',
      '<picture><source srcset="/media/a.webp" /></picture>',
      '<div style="background-image:url(/media/a.jpg)"></div>',
      '<svg><image href="/media/a.png" /></svg>',
    ]) {
      const failures = renderedImagePolicyFailures(markup, NOW);
      expect(failures, markup).not.toEqual([]);
      expect(failures.join(' ')).toContain('no renderable photograph');
    }
    // A fragment reference loads nothing, so it is not an image.
    expect(renderedImagePolicyFailures('<svg><rect fill="url(#grid)" /></svg>', NOW)).toEqual([]);
  });

  it('sends no image element from any public route, because none may render today', async () => {
    for (const route of Object.keys(STATIC_ROUTE_PAGES)) {
      const markup = await renderRouteContent(route);
      expect(renderedImagePolicyFailures(markup, NOW), route).toEqual([]);
    }
  });

  it('keeps the gated pathway inert: nothing is recorded, so nothing it can be asked for renders', () => {
    // The element exists in a component that cannot presently produce one. The
    // source permission above is paid for by this being true and stays paid for
    // only while it is, because the register condition reads the same register.
    expect(renderToStaticMarkup(<Photograph asset={null} now={NOW} />)).toBe('');
    expect(renderToStaticMarkup(<OwnerPortrait now={NOW} />)).toBe('');
    expect(ownerPortraitPresentation(NOW).kind).toBe('text-treatment');
    expect(hasRenderablePhotograph(NOW)).toBe(false);
  });

  it('references no image file held under public/', () => {
    const held = collectFiles(join(ROOT, 'public'), [...RASTER_EXTENSIONS, '.svg', '.ico']).map((file) =>
      basename(file)
    );
    const hits = surface.files.flatMap((scanned) =>
      held.filter((name) => scanned.text.includes(name)).map((name) => `${scanned.path} references public/…/${name}`)
    );
    expect(hits).toEqual([]);
  });

  it('holds no image file on the public surface under src/, so no icon or social-card image is served', () => {
    // Next.js serves a file named icon, apple-icon, opengraph-image or twitter-image
    // under src/app on every page beneath it, with no reference in the page source.
    const images = collectPublicSurfaceFiles(RASTER_EXTENSIONS).map((file) => relative(ROOT, file));
    const metadataImages = collectPublicSurfaceFiles([''])
      .filter((file) => /^(icon|apple-icon|opengraph-image|twitter-image)\d*\.\w+$/.test(basename(file)))
      .map((file) => relative(ROOT, file));
    expect([...images, ...metadataImages]).toEqual([]);
  });

  it('names no generated image and no portrait, office, transaction, customer or property picture', () => {
    const hits = surface.files.flatMap((scanned) =>
      imageReferences(scanned)
        .map((reference) => ({ reference, subject: bannedImageSubject(reference) }))
        .filter((entry) => entry.subject !== null)
        .map((entry) => `${scanned.path}: "${entry.reference}" reads as a ${entry.subject} image`)
    );
    expect(hits).toEqual([]);
  });

  it('recognises each banned subject in a file name or alt text, and passes an area-and-date photograph', () => {
    const examples: readonly [string, string | null][] = [
      ['/media/ai-villa-hero.png', 'generated'],
      ['stable-diffusion-render.webp', 'generated'],
      ['ownerHeadshot.jpg', 'portrait'],
      ['Portrait of the owner and CEO', 'portrait'],
      ['/media/office-reception.jpg', 'office'],
      ['Broker handshake over the sale agreement', 'transaction'],
      ['keys-handover.jpg', 'transaction'],
      ['happy-customers.jpg', 'customer'],
      ['property-photo-01.jpg', 'property'],
      ['/media/luxury-apartments.avif', 'property'],
      ['/media/jayanagar-4th-block-2027-03.jpg', null],
      ['Jayanagar 4th Block, March 2027', null],
    ];
    for (const [reference, subject] of examples) {
      expect(bannedImageSubject(reference), reference).toBe(subject);
    }
  });

  it('catches the conceptual images the prototype routes still carry, so the scan is not passing blind', () => {
    // The same scan, pointed at the prototype folders the public enumeration
    // excludes. They carry the four conceptual renderings that used to be public;
    // if these folders are ever deleted, delete this test with them.
    const prototypes = collectFiles(SRC, ['.tsx'])
      .filter((file) => /[\\/](Concept1|Concept2|concept-review)[\\/]/.test(file))
      .map(readImportedFile);
    expect(prototypes.some((scanned) => imageViolations(scanned).length > 0)).toBe(true);
    const references = prototypes.flatMap(imageReferences);
    for (const name of [
      'concept1-garden-modernism.jpg',
      'concept1-courtyard-detail.jpg',
      'concept2-metropolitan-monolith.jpg',
      'concept2-gallery-console.jpg',
    ]) {
      expect(references.some((reference) => reference.endsWith(name)), name).toBe(true);
      expect(existsSync(join(ROOT, 'public', 'media', name)), name).toBe(true);
    }
    // "Conceptual architectural rendering … residential design": a generated image.
    expect(references.some((reference) => bannedImageSubject(reference) !== null)).toBe(true);
  });

  it('references no owner portrait: none is recorded, and neither page about the owner renders an image', () => {
    // Until a real photograph with a written person release exists, there is no
    // portrait to show, and none may be generated in its place.
    expect(OWNER_PROFILE.portrait).toBeNull();
    for (const [label, markup] of [
      ['/about/utpal-raj-kb', renderToStaticMarkup(<OwnerProfilePage />)],
      ['/about', renderToStaticMarkup(<AboutPage />)],
    ] as const) {
      expect(markup, label).toContain(OWNER_PROFILE.name);
      expect(markup, label).not.toMatch(/<img\b|<picture\b|<image[\s/>]|\bsrcset=|url\(/i);
    }
  });
});

// ---------------------------------------------------------------------------
// The five components, as they render
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
 * Neighbours as the locality page hands them to the plate: resolved through the
 * gate, and carrying the name the gate resolved. The plate sets that name rather
 * than looking one up, because Requirement 12.10 forbids a component rendering a
 * public route from holding `LOCALITY_REGISTRY`.
 */
const NEIGHBOURS = [
  { slug: 'north-bengaluru', relationship: 'shares a corridor with this area', claimId: null },
  { slug: 'indiranagar', relationship: 'sits beside this area', claimId: null },
  { slug: 'koramangala', relationship: 'sits beside this area', claimId: null },
].map((relationship) => ({
  ...relationship,
  name: LOCALITY_REGISTRY.find((entry) => entry.slug === relationship.slug)!.canonicalName,
}));

const plateRecord = record({ approvedNearbyRelationships: NEIGHBOURS });

const RENDERED: readonly { readonly label: string; readonly assetId: string; readonly markup: string }[] = [
  {
    label: 'CivicStreetscapeBand, full',
    assetId: STREETSCAPE_FULL_ASSET_ID,
    markup: renderToStaticMarkup(<CivicStreetscapeBand />),
  },
  {
    label: 'CivicStreetscapeBand, cropped',
    assetId: STREETSCAPE_CROPPED_ASSET_ID,
    markup: renderToStaticMarkup(<CivicStreetscapeBand variant="cropped" />),
  },
  {
    label: 'CorridorDiagram',
    assetId: CORRIDOR_ASSET_ID,
    markup: renderToStaticMarkup(<CorridorDiagram />),
  },
  {
    // Measured as it is actually used — inside the typographic fallback, which adds
    // the positioning class to the same element — rather than bare.
    label: 'LayoutGridMotif',
    assetId: LAYOUT_GRID_ASSET_ID,
    markup: renderToStaticMarkup(
      <TypographicPlate kicker="Bengaluru" name="Test Locality" note="No orientation map yet." />
    ),
  },
  {
    label: 'AreaOrientationPlate',
    assetId: areaOrientationAssetId(plateRecord.slug),
    markup: renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />),
  },
];

describe('every drawing carries what Requirement 9.16 requires', () => {
  for (const { label, assetId, markup } of RENDERED) {
    it(`${label} renders its asset id, intrinsic size and accessible name`, () => {
      const asset = getVisualAsset(assetId) ?? buildAreaOrientationAsset(plateRecord);
      expect(markup).toContain(`data-asset-id="${assetId}"`);
      expect(markup).toContain(`width="${asset.intrinsicWidth}"`);
      expect(markup).toContain(`height="${asset.intrinsicHeight}"`);

      if (asset.decorative) {
        // The inline-SVG equivalent of the empty alt attribute.
        expect(markup).toContain('aria-hidden="true"');
        expect(asset.altText).toBeNull();
      } else {
        expect(markup).toContain('role="img"');
        expect(markup).toContain(`aria-label="${asset.altText}"`);
      }
    });
  }

  it('builds every drawing from path, rect and circle primitives only', () => {
    for (const { label, markup } of RENDERED) {
      const elements = [...markup.matchAll(/<(\w+)[\s>]/g)].map((match) => match[1]);
      // Geometry: path, rect, circle, grouped by g, labelled by text. The rest are
      // the frame and, for the typographic fallback, the HTML text it sets.
      const permitted = new Set([
        'svg',
        'g',
        'path',
        'rect',
        'circle',
        'text',
        // A plate label that wraps sets each line as a tspan of its one text element.
        'tspan',
        'figure',
        'figcaption',
        'div',
        'span',
        'p',
      ]);
      const unexpected = [...new Set(elements)].filter((element) => !permitted.has(element!));
      expect(unexpected, label).toEqual([]);
    }
  });
});

describe('the visible labels (Requirements 9.3, 9.4)', () => {
  it('labels each illustration an illustration, in the same section', () => {
    for (const variant of ['full', 'cropped'] as const) {
      const markup = renderToStaticMarkup(<CivicStreetscapeBand variant={variant} />);
      expect(visibleText(markup)).toContain(ILLUSTRATION_LABEL);
    }
  });

  it('labels each map an orientation aid, in the same section', () => {
    expect(visibleText(renderToStaticMarkup(<CorridorDiagram />))).toContain(ORIENTATION_AID_LABEL);
    expect(visibleText(renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />))).toContain(
      ORIENTATION_AID_LABEL
    );
  });

  it('renders no commute time and no distance on any map or illustration', () => {
    const MEASUREMENT = /\d+(\.\d+)?\s*(km|kms|kilometre|kilometres|metres?|mtrs?|mins?|minutes?|hrs?|hours?)\b/i;
    for (const { label, markup } of RENDERED) {
      expect(MEASUREMENT.test(visibleText(markup)), label).toBe(false);
    }
  });

  it('renders no nameboard, house number, shop name or registration plate text', () => {
    // The streetscape and the corridor carry no text element at all. The orientation
    // plate carries area names, which are map labels rather than signage, and every
    // one of them comes from a registry record.
    for (const assetId of [STREETSCAPE_FULL_ASSET_ID, STREETSCAPE_CROPPED_ASSET_ID, CORRIDOR_ASSET_ID]) {
      const entry = RENDERED.find((item) => item.assetId === assetId)!;
      expect(entry.markup).not.toContain('<text');
      expect(visibleText(entry.markup).replace(ILLUSTRATION_LABEL, '').replace(ORIENTATION_AID_LABEL, '')).toBe(
        ''
      );
    }
  });
});

describe('CivicStreetscapeBand', () => {
  it('crops rather than redrawing, so the two variants cannot drift apart', () => {
    const full = renderToStaticMarkup(<CivicStreetscapeBand />);
    const cropped = renderToStaticMarkup(<CivicStreetscapeBand variant="cropped" />);
    const geometry = (markup: string) => [...markup.matchAll(/ d="([^"]+)"/g)].map((match) => match[1]);
    expect(geometry(cropped)).toEqual(geometry(full));
    expect(full).toContain('viewBox="0 0 1200 256"');
    expect(cropped).toContain('viewBox="300 44 700 196"');
  });

  it('draws the Bengaluru elements the register records as depicted', () => {
    const asset = requireRegisteredAsset(STREETSCAPE_FULL_ASSET_ID);
    expect(asset.kind).toBe('illustration');
    if (asset.kind !== 'illustration') return;
    expect(areGenericSubjects(asset.depicts)).toBe(true);
    for (const noun of ['parapet water tank', 'monkey-top window hood', 'rain tree canopy', 'compound gate']) {
      expect(asset.depicts).toContain(noun);
    }
  });

  it('rejects a specific place dressed as a generic noun', () => {
    expect(areGenericSubjects(['3rd Block Jayanagar house'])).toBe(false);
    expect(areGenericSubjects(['low-rise independent house'])).toBe(true);
  });
});

describe('AreaOrientationPlate', () => {
  it('draws one plate per approved neighbour, capped at four', () => {
    const many = record({
      approvedNearbyRelationships: [
        ...NEIGHBOURS,
        { slug: 'whitefield', relationship: 'sits beside this area', claimId: null },
        { slug: 'hebbal', relationship: 'sits beside this area', claimId: null },
      ],
    });
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={many} />);
    // One text element per plate; a wrapped name is one element with two tspans.
    const texts = [...markup.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map((match) => visibleText(match[1]!));
    // The centre plate plus four neighbours, and no more.
    expect(texts).toHaveLength(MAX_NEIGHBOUR_PLATES + 1);
    expect(texts).toContain(many.canonicalName);
  });

  it('refuses to draw below two neighbours, so the page falls back instead', () => {
    for (const count of [0, 1]) {
      const thin = record({ approvedNearbyRelationships: NEIGHBOURS.slice(0, count) });
      expect(hasEnoughNeighboursToDraw(thin.approvedNearbyRelationships)).toBe(false);
      expect(canRenderAreaOrientationPlate(thin)).toBe(false);
      expect(() => renderToStaticMarkup(<AreaOrientationPlate record={thin} />)).toThrow(
        /TypographicPlate instead/
      );
    }
    // The draw rule alone, over the neighbours handed to the plate.
    const enough = record({ approvedNearbyRelationships: NEIGHBOURS.slice(0, MIN_NEIGHBOUR_PLATES) });
    expect(hasEnoughNeighboursToDraw(enough.approvedNearbyRelationships)).toBe(true);
    // The page's decision counts only the neighbours it may link (task 10.1). These
    // fixture neighbours carry no claim and no published page, so the page would
    // not link them, and so it does not draw them: it falls back.
    expect(canRenderAreaOrientationPlate(enough)).toBe(false);
  });

  it('draws no boundary, because no boundary claim has passed the claim gate', () => {
    const asset = buildAreaOrientationAsset(plateRecord);
    expect(asset.boundaryClaimId).toBeNull();
    expect(evaluateAsset(asset, new Date('2026-09-29T00:00:00.000Z')).failures).toEqual([]);
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />);
    expect(markup).not.toContain('stroke-dasharray');
  });

  it('names its neighbours from the gated relationship rather than from a slug', () => {
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />);
    const registryName = LOCALITY_REGISTRY.find((entry) => entry.slug === 'indiranagar')?.canonicalName;
    expect(registryName).toBeTruthy();
    expect(visibleText(markup)).toContain(registryName!);
    expect(visibleText(markup)).not.toContain('indiranagar');
  });

  it('sets the slug, and no invented name, for a neighbour that did not come through the gate', () => {
    // Requirement 12.10: the drawing holds no registry, so it has nothing to look a
    // name up in. An ungated relationship is a record error, and the plate shows the
    // slug rather than reaching past the page for a name the gate did not approve.
    const ungated = record({
      approvedNearbyRelationships: NEIGHBOURS.map(({ name, ...rest }) => {
        void name;
        return rest;
      }),
    });
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={ungated} />);
    expect(visibleText(markup)).toContain('indiranagar');
    expect(visibleText(markup)).not.toContain(
      LOCALITY_REGISTRY.find((entry) => entry.slug === 'indiranagar')!.canonicalName
    );
  });

  it('keeps a long area name inside its plate by wrapping it, not by shrinking it away', () => {
    const long = record({
      canonicalName: 'A Very Long Bengaluru Area Name Indeed',
      approvedNearbyRelationships: NEIGHBOURS,
    });
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={long} />);
    const sizes = [...markup.matchAll(/font-size="(\d+)"/g)].map((match) => Number(match[1]));
    const floor = Math.min(PLATE_LABEL_STYLE.centre.minimum, PLATE_LABEL_STYLE.neighbour.minimum);
    const ceiling = Math.max(PLATE_LABEL_STYLE.centre.preferred, PLATE_LABEL_STYLE.neighbour.preferred);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(floor);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(ceiling);

    // The centre name wraps onto two lines, and each line fits the plate at the
    // size it is set, by the same per-character estimate the layout uses.
    const centre = plateLabelLayout(long.canonicalName, PLATE_VIEWBOX_WIDTH - 24, 'centre');
    expect(centre.lines).toHaveLength(2);
    expect(centre.lines.join(' ')).toBe(long.canonicalName);
    for (const line of centre.lines) {
      expect(line.length * PLATE_LABEL_STYLE.centre.emPerCharacter * centre.fontSize).toBeLessThanOrEqual(
        PLATE_VIEWBOX_WIDTH - 24 - 24
      );
    }
  });

  it('sets every neighbour label at one shared size', () => {
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={plateRecord} />);
    const neighbourSizes = [...markup.matchAll(/<text[^>]*plateLabelNeighbour[^>]*font-size="(\d+)"/g)].map(
      (match) => Number(match[1])
    );
    expect(neighbourSizes).toHaveLength(NEIGHBOURS.length);
    expect(new Set(neighbourSizes).size).toBe(1);
  });
});

describe('TypographicPlate (Requirement 9.15)', () => {
  const markup = renderToStaticMarkup(
    <TypographicPlate kicker="Bengaluru" name="Test Locality" note="No orientation map is published yet." />
  );

  it('renders the name and the reason, and nothing shaped like a failed image', () => {
    expect(visibleText(markup)).toContain('Test Locality');
    expect(visibleText(markup)).toContain('No orientation map is published yet.');
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('placeholder');
  });

  it('sets the name as HTML text, so it scales with the reader font size', () => {
    expect(markup).toMatch(/<p class="[^"]*plateName[^"]*">Test Locality<\/p>/);
  });

  it('renders the layout texture behind it, hidden from assistive technology', () => {
    expect(markup).toContain(`data-asset-id="${LAYOUT_GRID_ASSET_ID}"`);
    expect(markup).toContain('aria-hidden="true"');
  });
});

// ---------------------------------------------------------------------------
// 8.7 — weight, for the assets no built route reaches
// ---------------------------------------------------------------------------

describe('asset weight (Requirement 9.17)', () => {
  /**
   * `scripts/measure-visual-assets.mjs` measures from the built HTML, which cannot
   * reach the layout texture or the orientation plate: both render on the published
   * locality template, and no locality record passes the publication gate. They are
   * measured here instead, from the same serialised markup, so neither asset's
   * weight rests on an estimate.
   */
  for (const { label, markup } of RENDERED) {
    it(`${label} stays inside the 80 KB asset budget`, () => {
      const svg = markup.slice(markup.indexOf('<svg'), markup.lastIndexOf('</svg>') + 6);
      const compressed = gzipSync(Buffer.from(svg, 'utf8')).length;
      expect(compressed, `${label} measures ${compressed} bytes compressed`).toBeLessThanOrEqual(
        ASSET_COMPRESSED_BYTE_BUDGET
      );
    });
  }

  /**
   * The per-locality plate is the one asset whose weight depends on its record: the
   * area names are in the markup. So the recorded weight is measured from the worst
   * case the registry can actually produce — the longest canonical name in the
   * centre and the next four longest around it — and this test fails if a future
   * record beats it, rather than letting the recorded number quietly understate.
   */
  it('records the plate weight measured from the longest names the registry holds', () => {
    const longest = [...LOCALITY_REGISTRY]
      .sort((a, b) => b.canonicalName.length - a.canonicalName.length)
      .slice(0, 1 + MAX_NEIGHBOUR_PLATES);
    const worst = record({
      canonicalName: longest[0]!.canonicalName,
      approvedNearbyRelationships: longest.slice(1).map((neighbour) => ({
        slug: neighbour.slug,
        relationship: 'sits beside this area',
        claimId: null,
      })),
    });
    const markup = renderToStaticMarkup(<AreaOrientationPlate record={worst} />);
    const svg = markup.slice(markup.indexOf('<svg'), markup.lastIndexOf('</svg>') + 6);
    const compressed = gzipSync(Buffer.from(svg, 'utf8')).length;
    expect(compressed, `the worst-case plate measures ${compressed} bytes compressed`).toBeLessThanOrEqual(
      buildAreaOrientationAsset(worst).compressedBytes
    );
  });

  it('records a compressed weight at or below the budget for every register entry', () => {
    for (const asset of VISUAL_ASSET_REGISTER) {
      expect(asset.compressedBytes, asset.assetId).toBeGreaterThan(0);
      expect(asset.compressedBytes, asset.assetId).toBeLessThanOrEqual(ASSET_COMPRESSED_BYTE_BUDGET);
    }
    expect(buildAreaOrientationAsset(plateRecord).compressedBytes).toBeLessThanOrEqual(
      ASSET_COMPRESSED_BYTE_BUDGET
    );
  });

  it('keeps every route inside the 150 KB route budget', () => {
    for (const [route, assetIds] of Object.entries(STATIC_ROUTE_VISUAL_ASSETS)) {
      const total = assetIds.reduce((sum, assetId) => sum + (getVisualAsset(assetId)?.compressedBytes ?? 0), 0);
      expect(total, route).toBeLessThanOrEqual(ROUTE_COMPRESSED_BYTE_BUDGET);
    }
  });
});

// ---------------------------------------------------------------------------
// 8.3 — the pages that must carry an element
// ---------------------------------------------------------------------------

describe('the pages that carry a Bengaluru element (Requirement 9.2)', () => {
  const PAGE_FILE: Readonly<Record<string, string>> = {
    '/': join('src', 'app', 'page.tsx'),
    '/buy': join('src', 'app', 'buy', 'page.tsx'),
    '/sell': join('src', 'app', 'sell', 'page.tsx'),
    '/rent': join('src', 'app', 'rent', 'page.tsx'),
    '/rent-out': join('src', 'app', 'rent-out', 'page.tsx'),
    '/commercial': join('src', 'app', 'commercial', 'page.tsx'),
    '/areas': join('src', 'app', 'areas', 'page.tsx'),
  };

  const COMPONENT_FOR_ASSET: Readonly<Record<string, string>> = {
    [STREETSCAPE_FULL_ASSET_ID]: 'CivicStreetscapeBand',
    [STREETSCAPE_CROPPED_ASSET_ID]: 'CivicStreetscapeBand',
    [CORRIDOR_ASSET_ID]: 'CorridorDiagram',
  };

  it('maps every route Requirement 9.2 names to an asset', () => {
    for (const route of ['/', '/buy', '/sell', '/rent', '/rent-out', '/commercial']) {
      expect(STATIC_ROUTE_VISUAL_ASSETS[route], route).toBeTruthy();
      expect(STATIC_ROUTE_VISUAL_ASSETS[route]!.length, route).toBeGreaterThan(0);
    }
  });

  it('renders the mapped component in each route source', () => {
    for (const [route, assetIds] of Object.entries(STATIC_ROUTE_VISUAL_ASSETS)) {
      const source = readFileSync(join(ROOT, PAGE_FILE[route]!), 'utf8');
      for (const assetId of assetIds) {
        expect(source, route).toContain(`<${COMPONENT_FOR_ASSET[assetId]}`);
      }
      // Server-rendered, so a crawler that runs no JavaScript still reaches it.
      expect(source, route).not.toContain("'use client'");
    }
  });

  it('renders the cropped variant on the service pages and the full band on the homepage', () => {
    const home = readFileSync(join(ROOT, PAGE_FILE['/']!), 'utf8');
    expect(home).toContain('<CivicStreetscapeBand />');
    for (const route of ['/buy', '/sell', '/rent', '/rent-out', '/commercial']) {
      const source = readFileSync(join(ROOT, PAGE_FILE[route]!), 'utf8');
      expect(source, route).toContain('<CivicStreetscapeBand variant="cropped" />');
    }
  });

  it('falls back to the typographic treatment on a locality page with no map', () => {
    const template = stripComments(
      readFileSync(join(ROOT, 'src', 'app', 'areas', '[slug]', 'page.tsx'), 'utf8')
    );
    expect(template).toContain('canRenderAreaOrientationPlate');
    expect(template).toContain('<AreaOrientationPlate');
    expect(template).toContain('<TypographicPlate');
    // Requirement 9.15: nothing else stands in for the missing asset.
    expect(template).not.toMatch(/<img|placeholder|Skeleton/);
  });
});

// ---------------------------------------------------------------------------
// 8.2 — records and the register agree
// ---------------------------------------------------------------------------

describe('records and the Media_Register agree', () => {
  it('records the asset ids a locality page would render, and no others', () => {
    for (const locality of LOCALITY_REGISTRY) {
      expect([...locality.visualAssetIds], locality.slug).toEqual([
        ...localityVisualAssetIds(locality),
      ]);
    }
  });

  it('references only registered assets from guide records', () => {
    for (const guide of GUIDE_REGISTRY) {
      for (const assetId of guide.visualAssetIds) {
        expect(getVisualAsset(assetId), `${guide.slug} references ${assetId}`).toBeDefined();
      }
    }
  });

  it('names a generic subject for every illustration', () => {
    for (const asset of VISUAL_ASSET_REGISTER) {
      if (asset.kind !== 'illustration') continue;
      expect(areGenericSubjects(asset.depicts), asset.assetId).toBe(true);
    }
  });
});
