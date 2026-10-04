/**
 * Task 14.2 — slug and PIN code scanning. Requirements 12.2 and 12.3.
 *
 * Three rules, each failing with an assertion that names the offending slug,
 * route path or file path:
 *
 *  - **12.2 Slug validation.** Every slug `/areas/[slug]` can resolve — every
 *    registry slug, every `LOCALITY_SLUG_ALIASES` key, every published area slug —
 *    resolves to the exact `slug` of exactly one locality record, and no such slug
 *    carries a transaction-intent word, a property-type word or a six-digit
 *    numeric group. Aliases are included so a spelling variant cannot smuggle in a
 *    banned shape the canonical slug does not have.
 *  - **12.3 PIN route segments.** No registered route path, public route path,
 *    locality slug or guide slug carries a segment that *is* a PIN or postcode
 *    term, or *is* a six-digit literal. "Matching" is read as whole-segment
 *    equality — the recorded ruling `PIN_CODE_WHOLE_SEGMENT_RULING`, which names
 *    `pin-code-locality-difference` as the case it protects.
 *  - **12.3 PIN copy.** No public page presents a six-digit numeral as a PIN code:
 *    no six-digit numeral within 40 characters of a PIN or postcode term, in the
 *    copy of any public-surface file, in its source data, or in the markup any
 *    public route renders.
 *
 * The ruling, the forbidden segment list and `pathCarriesForbiddenSegment` live in
 * `scripts/seed-guide-candidates.mjs`, which applies them when it seeds guide
 * slugs. They are imported here rather than restated, so the seeder and this
 * suite cannot hold two readings of 12.3.
 */
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  // The mobile action bar reads the path; this suite scans its copy, not its href.
  return { ...actual, usePathname: () => '/' };
});

import { GUIDE_REGISTRY } from '@/config/guides';
import {
  LOCALITY_REGISTRY,
  LOCALITY_SLUG_ALIASES,
  getAllLocalitySlugs,
  resolveLocalitySlug,
} from '@/config/localities';
import { getPublishedAreaSlugs } from '@/config/locality-sections';
import { STATIC_PUBLIC_ROUTES, getPublicRoutes } from '@/lib/public-routes';
import {
  PIN_CODE_WHOLE_SEGMENT_RULING,
  pathCarriesForbiddenSegment,
} from '../scripts/seed-guide-candidates.mjs';
import { maskToCopy } from './helpers/public-copy';
import {
  PROPERTY_TYPE_WORDS,
  TRANSACTION_INTENT_WORDS,
  bannedSlugParts,
  slugResolutionFailures,
} from './helpers/slug-shape';
import { ROOT, SRC, collectPublicSurfaceFiles, stripCommentsFor } from './helpers/public-surface';
import { renderRouteContent, renderShell } from './helpers/rendered-routes';
import { enumerateRegisteredRoutes } from './helpers/route-shape';

const NOW = new Date('2026-09-29T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Requirement 12.2 — slug validation
// ---------------------------------------------------------------------------

/** Every slug `/areas/[slug]` can be asked for and answer from. */
function resolvableAreaSlugs(): string[] {
  return [
    ...new Set([...getAllLocalitySlugs(), ...Object.keys(LOCALITY_SLUG_ALIASES), ...getPublishedAreaSlugs(NOW)]),
  ];
}

describe('Requirement 12.2: every /areas/ slug names one place', () => {
  it('scans all 132 registry slugs and every alias key', () => {
    const slugs = resolvableAreaSlugs();
    expect(LOCALITY_REGISTRY).toHaveLength(132);
    for (const slug of getAllLocalitySlugs()) expect(slugs).toContain(slug);
    for (const key of Object.keys(LOCALITY_SLUG_ALIASES)) expect(slugs).toContain(key);
  });

  it('resolves every registry slug and alias key to the exact slug of exactly one record', () => {
    expect(slugResolutionFailures(LOCALITY_REGISTRY, LOCALITY_SLUG_ALIASES, resolveLocalitySlug)).toEqual([]);
    for (const slug of getPublishedAreaSlugs(NOW)) {
      expect(LOCALITY_REGISTRY.filter((record) => record.slug === slug), slug).toHaveLength(1);
    }
  });

  it('carries no transaction-intent word, property-type word or six-digit group in any slug', () => {
    const slugs = resolvableAreaSlugs();
    // A floor on what was scanned: 132 records plus the two alias keys, neither of
    // which is a record slug. An enumeration that silently shrank cannot pass.
    expect(slugs).toHaveLength(LOCALITY_REGISTRY.length + Object.keys(LOCALITY_SLUG_ALIASES).length);
    const offenders = slugs
      .map((slug) => ({ slug, carries: bannedSlugParts(slug) }))
      .filter((entry) => entry.carries.length > 0);
    expect(offenders).toEqual([]);
  });

  /**
   * The type lexicon carries `site`, `house`, `plot` and `independent`, and a real
   * Bengaluru locality name could legitimately contain any of them — `Sri Sai
   * Layout` does not, but `Site No 4 Layout` would. Nothing in the registry is
   * exempted, so this records what the scan actually found: no slug carries a
   * banned word under the whole-token reading the design specifies, and none
   * carries one under the stricter substring reading either. Should a future
   * locality collide, this assertion fails and the collision is decided in the
   * open rather than waived here.
   */
  it('finds no collision even under the stricter substring reading', () => {
    const words = [...TRANSACTION_INTENT_WORDS, ...PROPERTY_TYPE_WORDS];
    const offenders = resolvableAreaSlugs()
      .map((slug) => ({ slug, contains: words.filter((word) => slug.toLowerCase().includes(word)) }))
      .filter((entry) => entry.contains.length > 0);
    expect(offenders).toEqual([]);
  });

  it('names each slug that fails to resolve to exactly one record', () => {
    const aliases = { beta: 'alpha', 'gamma-variant': 'gamma' };
    const lookup = new Map(Object.entries(aliases));
    const failures = slugResolutionFailures(
      [{ slug: 'alpha' }, { slug: 'alpha' }, { slug: 'beta' }],
      aliases,
      (slug) => lookup.get(slug) ?? slug
    );
    expect(failures).toContain('alpha: the slug of 2 records');
    expect(failures).toContain('beta: an alias key that is also a record slug');
    expect(failures).toContain('beta: resolves to alpha, the slug of 2 records');
    expect(failures).toContain('gamma-variant: resolves to gamma, the slug of 0 records');
  });

  it('names the intent word, type word or six-digit group a slug carries', () => {
    expect(bannedSlugParts('buy-flat-indiranagar')).toEqual(['buy', 'flat']);
    expect(bannedSlugParts('rent-out-hebbal')).toEqual(['rent', 'rent-out']);
    expect(bannedSlugParts('best-broker-whitefield')).toEqual(['broker']);
    expect(bannedSlugParts('koramangala-560034')).toEqual(['560034']);
    expect(bannedSlugParts('hsr560102')).toEqual(['560102']);
    expect(bannedSlugParts('example-site-layout')).toEqual(['site']);
    // Whole tokens, not substrings: a place name that merely contains the letters passes.
    expect(bannedSlugParts('kengeri-satellite-town')).toEqual([]);
    expect(bannedSlugParts('whitefield-inner-enclaves')).toEqual([]);
    // A year or a seven-digit run is not a six-digit group.
    expect(bannedSlugParts('layout-2026')).toEqual([]);
    expect(bannedSlugParts('layout-1234567')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Requirement 12.3 — PIN route segments
// ---------------------------------------------------------------------------

/**
 * Every route path `src/app` registers, pages and route handlers alike, route
 * groups dropped and dynamic segments kept as written (`/areas/[slug]`).
 *
 * `enumerateRegisteredRoutes` from the Requirement 12.1 helper is the one
 * enumeration of the app tree; it already resolves route groups, parallel slots,
 * intercepting folders and private `_folders`. Restating the walk here would let
 * 12.1 and 12.3 disagree about which routes exist.
 */
function registeredRoutePaths(): string[] {
  return [...new Set(enumerateRegisteredRoutes().map((route) => route.path))].sort();
}

describe('Requirement 12.3: no route segment is a PIN term or a six-digit literal', () => {
  it('records whole-segment equality as a named decision protecting pin-code-locality-difference', () => {
    expect(PIN_CODE_WHOLE_SEGMENT_RULING.ruling).toBe('whole-segment equality');
    expect(PIN_CODE_WHOLE_SEGMENT_RULING.permittedSlug).toBe('pin-code-locality-difference');
    expect(PIN_CODE_WHOLE_SEGMENT_RULING.reasoning).toContain('whole-segment equality');
  });

  it('protects a guide that exists, and one a substring reading would have forbidden', () => {
    const { permittedSlug } = PIN_CODE_WHOLE_SEGMENT_RULING;
    expect(GUIDE_REGISTRY.map((guide) => guide.slug)).toContain(permittedSlug);
    expect(pathCarriesForbiddenSegment(`/guides/${permittedSlug}`)).toBe(false);
    expect(permittedSlug.includes('pin-code')).toBe(true);
  });

  it('holds the rule over every registered route path', () => {
    const paths = registeredRoutePaths();
    // A floor, so an enumeration that walks nothing cannot pass.
    expect(paths).toEqual(expect.arrayContaining(['/', '/areas/[slug]', '/guides/[slug]', '/sitemap.xml']));
    expect(paths.filter((routePath) => pathCarriesForbiddenSegment(routePath))).toEqual([]);
  });

  it('holds the rule over every public route path', () => {
    const paths = [
      ...STATIC_PUBLIC_ROUTES.map((route) => route.path),
      ...getPublicRoutes(NOW).map((route) => route.path),
    ];
    expect(paths.filter((routePath) => pathCarriesForbiddenSegment(routePath))).toEqual([]);
  });

  it('holds the rule over every locality slug, alias key and guide slug', () => {
    const paths = [
      ...resolvableAreaSlugs().map((slug) => `/areas/${slug}`),
      ...GUIDE_REGISTRY.map((guide) => `/guides/${guide.slug}`),
    ];
    expect(paths.length).toBeGreaterThan(LOCALITY_REGISTRY.length);
    expect(paths.filter((routePath) => pathCarriesForbiddenSegment(routePath))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Requirement 12.3 — a six-digit numeral presented as a PIN code
// ---------------------------------------------------------------------------

/** Characters allowed between a PIN or postcode term and the numeral, either side. */
const PIN_PROXIMITY_WINDOW = 40;

/**
 * `PIN`, `pin code`, `pin-code`, `pincode`, `postcode`, `post code`, `postal code`,
 * `postalCode` and their plurals, case-insensitively.
 */
const PIN_TERM = /\bpin(?:[- ]?codes?)?\b|\bpost(?:al)?[- ]?codes?\b/gi;

/**
 * A six-digit numeral: six digits in a row with no digit either side, as the
 * design's `\b\d{6}\b` — or, as a recorded addition, the spaced `560 038` form a
 * PIN code is often written in, when no further digit group joins it. The
 * addition only ever adds a failure condition. The primary phone number is ten
 * digits, so neither form matches inside it, spaced or not.
 */
const SIX_DIGIT_NUMERAL = /(?<!\d)\d{6}(?!\d)|(?<!\d ?)\d{3} \d{3}(?! ?\d)/g;

interface PinCodePresentation {
  readonly index: number;
  readonly numeral: string;
  readonly term: string;
}

/** Every six-digit numeral within the window of a PIN or postcode term. */
function findPinCodePresentations(text: string): PinCodePresentation[] {
  const terms = [...text.matchAll(PIN_TERM)];
  const found: PinCodePresentation[] = [];
  for (const numeral of text.matchAll(SIX_DIGIT_NUMERAL)) {
    const start = numeral.index;
    const end = start + numeral[0].length;
    const term = terms.find((candidate) => {
      const termStart = candidate.index;
      const termEnd = termStart + candidate[0].length;
      const gap = termEnd <= start ? start - termEnd : termStart - end;
      return gap >= 0 && gap <= PIN_PROXIMITY_WINDOW;
    });
    if (term) found.push({ index: start, numeral: numeral[0], term: term[0] });
  }
  return found;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** File-relative offender lines, `path:line: numeral near term`. */
function offendersIn(file: string, text: string): string[] {
  return findPinCodePresentations(text).map(
    (hit) => `${relative(ROOT, file)}:${lineOf(text, hit.index)}: ${hit.numeral} near "${hit.term}"`
  );
}

/** Attributes a reader or a crawler reads as text. */
const TEXT_ATTRIBUTES = /\s(?:alt|title|aria-label|aria-description|placeholder|content)="([^"]*)"/g;

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * The text a served page carries: element text with each tag read as a space, so
 * markup between a label and its value does not stretch the window, script bodies
 * kept so JSON-LD is read, and every text-bearing attribute value on its own line.
 */
function scannableMarkupText(markup: string): string {
  const text = decodeEntities(markup.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]*>/g, ' '));
  const attributes = [...markup.matchAll(TEXT_ATTRIBUTES)].map((match) => decodeEntities(match[1]!));
  return [text, ...attributes].join('\n');
}

describe('Requirement 12.3: no public page presents a six-digit numeral as a PIN code', () => {
  const publicFiles = collectPublicSurfaceFiles();

  it('scans a public surface that is not empty', () => {
    expect(publicFiles.length).toBeGreaterThan(20);
  });

  it('finds none in the copy of any public-surface file', () => {
    const offenders = publicFiles.flatMap((file) => offendersIn(file, maskToCopy(readFileSync(file, 'utf8'), file)));
    expect(offenders).toEqual([]);
  });

  /**
   * The copy mask keeps only prose, and a digits-only string is not prose, so a
   * value such as `postalCode: '560001'` would pass it unseen. The comment-stripped
   * source keeps it, and the key beside it is the term.
   */
  it('finds none in the source data of any public-surface file', () => {
    const offenders = publicFiles.flatMap((file) =>
      offendersIn(file, stripCommentsFor(file, readFileSync(file, 'utf8')))
    );
    expect(offenders).toEqual([]);
  });

  describe('in the markup every public route renders', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('finds none in any route content or in the shell around it', async () => {
      const routes = getPublicRoutes(NOW).map((route) => route.path);
      expect(routes.length).toBeGreaterThanOrEqual(STATIC_PUBLIC_ROUTES.length);

      const offenders: string[] = [];
      for (const route of routes) {
        const text = scannableMarkupText(await renderRouteContent(route));
        offenders.push(...findPinCodePresentations(text).map((hit) => `${route}: ${hit.numeral} near "${hit.term}"`));
      }
      const shell = renderShell();
      for (const [region, markup] of Object.entries(shell)) {
        const text = scannableMarkupText(markup);
        offenders.push(...findPinCodePresentations(text).map((hit) => `shell ${region}: ${hit.numeral} near "${hit.term}"`));
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('the detector', () => {
    const numeralsIn = (text: string) => findPinCodePresentations(text).map((hit) => hit.numeral);

    it('fires on a six-digit numeral beside a PIN or postcode term, either side, any case', () => {
      expect(numeralsIn('PIN 560038')).toEqual(['560038']);
      expect(numeralsIn('postcode: 560001')).toEqual(['560001']);
      expect(numeralsIn('Postal code 560 001')).toEqual(['560 001']);
      expect(numeralsIn('the pin-code is 560102')).toEqual(['560102']);
      expect(numeralsIn('Pincodes: 560034, 560095')).toEqual(['560034', '560095']);
      expect(numeralsIn('{"postalCode":"560001"}')).toEqual(['560001']);
      expect(numeralsIn('560038 is the PIN code for this area')).toEqual(['560038']);
      expect(numeralsIn(`postcode${' '.repeat(PIN_PROXIMITY_WINDOW)}560001`)).toEqual(['560001']);
    });

    it('does not fire on the phone number, a year, a distant numeral or a numeral with no term', () => {
      expect(numeralsIn('Call 9353096264 with any PIN code question')).toEqual([]);
      expect(numeralsIn('tel:9353096264 — postcode')).toEqual([]);
      expect(numeralsIn('Call 935 309 6264 about PIN codes')).toEqual([]);
      expect(numeralsIn('PIN codes were last checked in 2026')).toEqual([]);
      expect(numeralsIn('PIN code 5600')).toEqual([]);
      expect(numeralsIn('postcode 5600012')).toEqual([]);
      expect(numeralsIn(`postcode${' '.repeat(PIN_PROXIMITY_WINDOW + 1)}560001`)).toEqual([]);
      expect(numeralsIn('Reference 560001')).toEqual([]);
      expect(numeralsIn('A spinning 560001')).toEqual([]);
    });

    it('reads a data value the copy mask discards, and ignores a comment', () => {
      const file = join(SRC, 'example.ts');
      const source = "// PIN 560001 is only an example in a comment\nexport const address = { postalCode: '560001' };\n";
      expect(offendersIn(file, maskToCopy(source, file))).toEqual([]);
      expect(offendersIn(file, stripCommentsFor(file, source))).toEqual([
        `${join('src', 'example.ts')}:2: 560001 near "postalCode"`,
      ]);
    });

    it('reads rendered markup across tags, in attributes and in JSON-LD', () => {
      const scan = (markup: string) => findPinCodePresentations(scannableMarkupText(markup)).map((hit) => hit.numeral);
      expect(scan('<dl><dt class="label-with-a-long-class-name">PIN code</dt><dd class="value-cell">560001</dd></dl>')).toEqual([
        '560001',
      ]);
      expect(scan('<img alt="Postcode 560038" src="/x.svg"/>')).toEqual(['560038']);
      expect(scan('<script type="application/ld+json">{"postalCode":"560095"}</script>')).toEqual(['560095']);
      expect(scan('<svg viewBox="0 0 960 520"><title>Bengaluru</title></svg>')).toEqual([]);
    });
  });
});
