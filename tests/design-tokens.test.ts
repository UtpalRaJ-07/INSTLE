import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  VISUAL_ASSET_REGISTER,
  buildAreaOrientationAsset,
  type VisualAssetRecord,
} from '@/config/media-register';
import { LOCALITY_REGISTRY } from '@/config/localities';
import { LayoutGridMotif } from '@/components/Bengaluru';

/**
 * Contrast is computed from the token file, not asserted from a comment. Editing a
 * colour in tokens.css therefore fails this test rather than silently shipping an
 * inaccessible palette.
 *
 * Automated contrast checking is not the same as WCAG conformance. It covers
 * 1.4.3 and 1.4.11 for the pairings listed here; keyboard, reflow and screen-reader
 * behaviour are covered by the manual checklist.
 */

const tokensCss = readFileSync(join(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');

function readToken(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8});`));
  if (!match) throw new Error(`Token --${name} not found in tokens.css`);
  return match[1]!;
}

function channelLuminance(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const normalised = hex.replace('#', '');
  const full =
    normalised.length === 3
      ? normalised
          .split('')
          .map((char) => char + char)
          .join('')
      : normalised;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
  );
}

function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const paper = readToken('color-paper');
const paperRaised = readToken('color-paper-raised');
const white = readToken('color-white');
const ink = readToken('color-ink');
const muted = readToken('color-text-muted');
const forest = readToken('color-forest');
const forestDark = readToken('color-forest-dark');
const error = readToken('color-error');
const focusRing = readToken('focus-ring-color');
const borderStrong = readToken('color-border-strong');
const elevated = readToken('color-background-elevated');
const onDarkMuted = readToken('color-text-on-dark-muted');

describe('body text contrast (WCAG 1.4.3, 4.5:1)', () => {
  const bodyPairs: [string, string, string][] = [
    ['ink on paper', ink, paper],
    ['ink on raised paper', ink, paperRaised],
    ['ink on white', ink, white],
    ['ink on elevated surface', ink, elevated],
    ['muted text on paper', muted, paper],
    ['muted text on raised paper', muted, paperRaised],
    ['muted text on white', muted, white],
    ['muted text on elevated surface', muted, elevated],
    ['error text on paper', error, paper],
    ['error text on white', error, white],
    ['white on forest', white, forest],
    ['white on dark forest', white, forestDark],
    ['paper on forest', paper, forest],
    ['muted-on-dark on forest', onDarkMuted, forest],
  ];

  for (const [label, foreground, background] of bodyPairs) {
    it(`${label} clears 4.5:1`, () => {
      const ratio = contrastRatio(foreground, background);
      expect(ratio, `${label} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('non-text contrast (WCAG 1.4.11, 3:1)', () => {
  const uiPairs: [string, string, string][] = [
    ['focus ring on paper', focusRing, paper],
    ['focus ring on white', focusRing, white],
    ['focus ring on elevated surface', focusRing, elevated],
    ['control border on white', borderStrong, white],
    ['control border on paper', borderStrong, paper],
    ['forest surface against paper', forest, paper],
  ];

  for (const [label, foreground, background] of uiPairs) {
    it(`${label} clears 3:1`, () => {
      const ratio = contrastRatio(foreground, background);
      expect(ratio, `${label} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('token hygiene', () => {
  it('loads no external font', () => {
    expect(tokensCss).not.toContain('fonts.googleapis.com');
    expect(tokensCss).not.toContain('@import url(');
  });

  it('reserves space for the mobile action bar above the device safe area', () => {
    expect(tokensCss).toContain('--mobile-action-bar-space');
    expect(tokensCss).toContain('env(safe-area-inset-bottom');
  });

  it('keeps a 44px minimum touch target token', () => {
    expect(tokensCss).toMatch(/--min-touch-target:\s*44px/);
  });

  it('disables non-essential motion under prefers-reduced-motion', () => {
    expect(tokensCss).toContain('prefers-reduced-motion: reduce');
    expect(tokensCss).toMatch(/--transition-fast:\s*0ms/);
  });
});

// ---------------------------------------------------------------------------
// Requirement 9.5 over the Bengaluru assets
// ---------------------------------------------------------------------------

/**
 * Contrast over an illustration, a map or a texture.
 *
 * Requirement 9.5 asks for 4.5:1 against *every* colour an asset presents behind
 * text, which only stays tractable because of three decisions made in the drawings
 * themselves: text never sits over stroke work, every ground is a flat token colour
 * at full opacity so nothing behind text is a blend (`tests/visual-identity.test.tsx`
 * bans opacity in these files), and each asset declares the colours it presents in
 * `backgroundColoursBehindText` (`tests/media-register-entries.test.tsx` re-derives
 * those lists from the rendered markup).
 *
 * So everything below is computed from three real sources and nothing else: the
 * values in `tokens.css`, the declarations in the Media_Register, and the colours
 * written into `Bengaluru.module.css` and the component files. The text colours are
 * read out of the stylesheet rather than listed here, so a rule that starts setting
 * a new text colour is measured the moment it exists. A new tint added to a drawing
 * without being a token fails, and a declared colour that does not clear the ratio
 * fails with the asset, the pairing and the computed ratio.
 */

const bengaluruDir = join(__dirname, '..', 'src', 'components', 'Bengaluru');

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const TOKEN_REFERENCE = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i;
const OPAQUE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Every custom property `tokens.css` defines, name to declared value. */
const tokenValues = new Map<string, string>(
  [...withoutComments(tokensCss).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [
    match[1]!,
    match[2]!.trim(),
  ])
);

/** `#abc` and `#AABBCC` alike, as lower-case six-digit hex. */
function normaliseHex(hex: string): string {
  const digits = hex.slice(1).toLowerCase();
  return `#${digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits}`;
}

/**
 * A token as the flat colour a reader sees, following `var(--alias)` chains.
 *
 * Anything that is not an opaque hex — an `rgba()`, an eight-digit hex, a gradient —
 * throws, because the arithmetic here is only true of a colour that does not blend
 * with what is under it.
 */
function tokenHex(name: string, seen: readonly string[] = []): string {
  const declared = tokenValues.get(name);
  if (declared === undefined) throw new Error(`${name} is not defined in tokens.css`);
  if (OPAQUE_HEX.test(declared)) return normaliseHex(declared);
  const alias = declared.match(TOKEN_REFERENCE)?.[1];
  if (alias && !seen.includes(alias)) return tokenHex(alias, [...seen, name]);
  throw new Error(`${name} is "${declared}" in tokens.css, not an opaque colour`);
}

/** Every opaque colour `tokens.css` defines: the only hex a drawing may write. */
const tokenHexes = new Set(
  [...tokenValues.keys()].flatMap((name) => {
    try {
      return [tokenHex(name)];
    } catch {
      return [];
    }
  })
);

// ---- The stylesheet: the frame colour and every text colour ----

const bengaluruModuleCss = readFileSync(join(bengaluruDir, 'Bengaluru.module.css'), 'utf8');

/** Each `.class { … }` rule in the module, including those inside a media query. */
const moduleRules = [
  ...withoutComments(bengaluruModuleCss).matchAll(/\.([A-Za-z][\w-]*)\s*\{([^{}]*)\}/g),
].map((match) => ({ selector: match[1]!, body: match[2]! }));

/** Every `color:` the module sets — not `background-color`, not `border-color`. */
const moduleTextColours = moduleRules.flatMap(({ selector, body }) =>
  [...body.matchAll(/(?<![-\w])color\s*:\s*([^;]+);/g)].map((match) => ({
    source: `.${selector} color`,
    value: match[1]!.trim(),
  }))
);

/** The token a CSS or SVG colour value names; `currentColor` is the frame's. */
function colourToken(value: string, frameToken: string): string {
  if (value === 'currentColor') return frameToken;
  const token = value.match(TOKEN_REFERENCE)?.[1];
  if (!token) throw new Error(`"${value}" is not a token reference`);
  return token;
}

/** The frame sets `color`, so every `currentColor` in a drawing is this token. */
const frameColourToken =
  moduleTextColours.find((entry) => entry.source === '.figure color')?.value.match(TOKEN_REFERENCE)?.[1] ??
  'unset';

/** A value as its token, or nothing; the tests that need a token assert it separately. */
function tokenOrNothing(value: string): string[] {
  try {
    return [colourToken(value, frameColourToken)];
  } catch {
    return [];
  }
}

// ---- The components: every fill and stroke they write ----

const bengaluruComponents = readdirSync(bengaluruDir)
  .filter((entry) => entry.endsWith('.tsx'))
  .map((entry) => ({ name: entry, text: readFileSync(join(bengaluruDir, entry), 'utf8') }));

interface ColourLiteral {
  readonly attribute: 'fill' | 'stroke';
  readonly value: string;
  /** Written as an expression rather than a string, so it cannot be checked here. */
  readonly computed: boolean;
}

/**
 * Every `fill` and `stroke` in a component: `fill="…"`, and `fill={…}` whether the
 * braces hold a string literal or an expression. An expression is recorded as
 * computed and fails the allow-list, because a colour arriving through a variable
 * is one this test cannot see.
 */
function colourLiterals(source: string): ColourLiteral[] {
  const quoted = [...source.matchAll(/\b(fill|stroke)="([^"]*)"/g)].map((match) => ({
    attribute: match[1] as 'fill' | 'stroke',
    value: match[2]!,
    computed: false,
  }));
  const braced = [...source.matchAll(/\b(fill|stroke)=\{([^}]*)\}/g)].map((match) => {
    const literal = match[2]!.trim().match(/^(['"`])([^'"`$]*)\1$/);
    return {
      attribute: match[1] as 'fill' | 'stroke',
      value: literal ? literal[2]! : match[2]!.trim(),
      computed: !literal,
    };
  });
  return [...quoted, ...braced];
}

/** SVG `<text>` is text too: its fill is a text colour. */
const svgTextColours = bengaluruComponents.flatMap((component) =>
  [...component.text.matchAll(/<text\b[^>]*\bfill="([^"]+)"/g)].map((match) => ({
    source: `${component.name} <text> fill`,
    value: match[1]!,
  }))
);

/**
 * Every asset a Bengaluru component renders, including the per-locality plate.
 *
 * The plate has no static register entry — its subject is a record — so it is built
 * from a real registry record here rather than being left out of the arithmetic.
 */
const bengaluruAssets: readonly VisualAssetRecord[] = [
  ...VISUAL_ASSET_REGISTER,
  buildAreaOrientationAsset(LOCALITY_REGISTRY[0]!),
];

function assetsDrawnBy(componentFile: string): VisualAssetRecord[] {
  const name = componentFile.replace(/\.tsx$/, '');
  return bengaluruAssets.filter(
    (asset) => asset.delivery.mode === 'inline-svg' && asset.delivery.componentName === name
  );
}

/** A literal as a hex colour: a token through `tokens.css`, a hex as written. */
function literalHex(value: string): string {
  return OPAQUE_HEX.test(value) ? normaliseHex(value) : tokenHex(colourToken(value, frameColourToken));
}

function declaredHexes(asset: VisualAssetRecord): string[] {
  return asset.backgroundColoursBehindText.map((declared) => tokenHex(declared));
}

/**
 * Why a literal is not allowed on this asset, or null when it is.
 *
 * Allowed: `none`; `currentColor`, which the frame sets to a token; a `var(--token)`
 * that `tokens.css` defines as an opaque colour; or a colour the asset declares.
 * A hex is allowed only where it equals a declared colour or a `tokens.css` value,
 * so a tint typed into a drawing fails even when it happens to pass contrast.
 */
function allowListFailure(literal: ColourLiteral, asset: VisualAssetRecord): string | null {
  const label = `${literal.attribute}=${literal.computed ? `{${literal.value}}` : `"${literal.value}"`}`;
  if (literal.computed) return `${label} is an expression; write the colour as a literal token`;
  if (literal.value === 'none' || literal.value === 'currentColor') return null;
  const token = literal.value.match(TOKEN_REFERENCE)?.[1];
  if (token) {
    if (asset.backgroundColoursBehindText.includes(token)) return null;
    try {
      tokenHex(token);
      return null;
    } catch (failure) {
      return `${label}: ${(failure as Error).message}`;
    }
  }
  if (OPAQUE_HEX.test(literal.value)) {
    const hex = normaliseHex(literal.value);
    if (declaredHexes(asset).includes(hex) || tokenHexes.has(hex)) return null;
    return `${label} is a hex tokens.css does not define and ${asset.assetId} does not declare`;
  }
  return `${label} is neither none, currentColor, a token nor a tokens.css colour`;
}

describe('text over an illustration, map or texture (Requirement 9.5, WCAG 1.4.3)', () => {
  it('declares a background colour for every asset', () => {
    for (const asset of bengaluruAssets) {
      expect(asset.backgroundColoursBehindText.length, asset.assetId).toBeGreaterThan(0);
    }
  });

  it('sets the frame colour to a token, so currentColor resolves to one rather than an inherited value', () => {
    expect(frameColourToken).toMatch(/^--/);
    expect(() => tokenHex(frameColourToken)).not.toThrow();
  });

  it('sets every text colour in the stylesheet and on SVG text through a token', () => {
    const sources = [...moduleTextColours, ...svgTextColours];
    // The caption, the plate kicker, the plate name and the orientation labels at least.
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const { source, value } of sources) {
      expect(() => tokenHex(colourToken(value, frameColourToken)), `${source}: ${value}`).not.toThrow();
    }
  });

  /** Every colour a reader's text is set in, deduplicated to the token. */
  const textColourTokens = [
    ...new Set([...moduleTextColours, ...svgTextColours].flatMap(({ value }) => tokenOrNothing(value))),
  ].sort();

  it('measures at least the frame ink and the muted caption colour', () => {
    expect(textColourTokens).toContain(frameColourToken);
    expect(textColourTokens.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * Every text colour against every declared colour. That is wider than strictly
   * needed — the caption never sits over the texture's lines, only the plate's
   * kicker and name do — but it is the version that cannot be wrong about which
   * text sits where, and it is the version that fails if a rule moves.
   */
  for (const asset of bengaluruAssets) {
    for (const declared of asset.backgroundColoursBehindText) {
      for (const textToken of textColourTokens) {
        it(`${asset.assetId}: ${textToken} text on ${declared} clears 4.5:1`, () => {
          const ratio = contrastRatio(tokenHex(textToken), tokenHex(declared));
          expect(
            ratio,
            `${asset.assetId}: ${textToken} on ${declared} is ${ratio.toFixed(2)}:1`
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe('Bengaluru drawing colours come from the tokens (Requirement 9.5)', () => {
  it('parses a colour literal from every component that draws', () => {
    const drawing = bengaluruComponents.filter((component) => colourLiterals(component.text).length > 0);
    expect(drawing.map((component) => component.name).sort()).toEqual([
      'AreaOrientationPlate.tsx',
      'CivicStreetscapeBand.tsx',
      'CorridorDiagram.tsx',
      'LayoutGridMotif.tsx',
    ]);
  });

  it('rejects a colour this test cannot account for', () => {
    const asset = bengaluruAssets[0]!;
    const verdict = (value: string, computed = false) =>
      allowListFailure({ attribute: 'fill', value, computed }, asset);
    expect(verdict('#123456')).not.toBeNull();
    expect(verdict('rgb(32, 38, 35)')).not.toBeNull();
    expect(verdict('var(--color-not-a-token)')).not.toBeNull();
    // Defined, but translucent: not a flat colour, so contrast over it is unknowable.
    expect(verdict('var(--c2-blue-glow)')).not.toBeNull();
    expect(verdict('colour', true)).not.toBeNull();
    // The same ink, written as the token, as its hex and as the frame colour.
    expect(verdict('var(--color-ink)')).toBeNull();
    expect(verdict(tokenHex('--color-ink').toUpperCase())).toBeNull();
    expect(verdict('currentColor')).toBeNull();
  });

  for (const component of bengaluruComponents) {
    const literals = colourLiterals(component.text);
    if (literals.length === 0) continue;

    it(`${component.name}: every fill and stroke is none, currentColor, a tokens.css colour or a declared one`, () => {
      const assets = assetsDrawnBy(component.name);
      expect(assets.length, `no register entry names ${component.name}`).toBeGreaterThan(0);
      for (const asset of assets) {
        const failures = literals
          .map((literal) => allowListFailure(literal, asset))
          .filter((failure): failure is string => failure !== null);
        expect(failures, asset.assetId).toEqual([]);
      }
    });
  }
});

describe('Bengaluru line work that carries meaning (Requirement 9.5, WCAG 1.4.11)', () => {
  /**
   * The marks in a drawing: every stroke, and every fill that is not itself one of
   * the declared surfaces. A fill equal to a declared surface is ground, not a mark
   * — the paper-raised disc inside a station ring, the elevated neighbour plate —
   * and its edge is carried by the stroke drawn around it, which is measured.
   */
  function marks(literals: readonly ColourLiteral[], asset: VisualAssetRecord): string[] {
    const grounds = new Set(declaredHexes(asset));
    return [
      ...new Set(
        literals
          .filter((literal) => literal.value !== 'none')
          .filter((literal) => literal.attribute === 'stroke' || !grounds.has(literalHex(literal.value)))
          .map((literal) => literal.value)
      ),
    ];
  }

  /**
   * A component is exempt from 3:1 only when it conveys nothing, and that is
   * checked rather than asserted. WCAG 1.4.11 asks 3:1 of the parts of a graphic a
   * reader needs to understand the content. The layout texture is decoration: it is
   * recorded decorative with no alt text, it renders `aria-hidden="true"` with no
   * accessible name, and it holds no `<text>`, `<title>` or `<desc>` — nothing in it
   * names, labels or marks anything, so a reader who cannot see its lines loses
   * nothing. That is the only reason its line colour, `--color-stone`, may sit
   * below 3:1 against the surface, and the meaningful-marks test below is what stops
   * stone appearing anywhere a reader would need to see it.
   *
   * Exempt from 1.4.11 is not exempt from 1.4.3. `TypographicPlate` sets the name
   * and kicker over this texture, so both of its colours are declared and the text
   * is computed against each of them above.
   */
  const renderers: Record<string, () => string> = {
    'LayoutGridMotif.tsx': () => renderToStaticMarkup(createElement(LayoutGridMotif)),
  };

  const drawing = bengaluruComponents.filter((component) => colourLiterals(component.text).length > 0);
  const decorative = drawing.filter((component) => {
    const assets = assetsDrawnBy(component.name);
    return assets.length > 0 && assets.every((asset) => asset.decorative);
  });

  it('exempts exactly the decorative texture, so a new exemption has to be seen', () => {
    expect(decorative.map((component) => component.name)).toEqual(['LayoutGridMotif.tsx']);
  });

  for (const component of decorative) {
    const literals = colourLiterals(component.text);
    // The weakest line against the surface under it, for the test name only. The
    // texture declares its own line colour (text sits over it), so that colour is
    // skipped as a ground for itself. An unresolvable literal fails the allow-list.
    let lowest = Number.NaN;
    try {
      lowest = Math.min(
        ...assetsDrawnBy(component.name).flatMap((asset) =>
          marks(literals, asset).flatMap((mark) =>
            declaredHexes(asset)
              .filter((ground) => ground !== literalHex(mark))
              .map((ground) => contrastRatio(literalHex(mark), ground))
          )
        )
      );
    } catch {
      // Left as NaN.
    }

    it(`${component.name}: line work down to ${lowest.toFixed(2)}:1 is exempt only because it conveys nothing`, () => {
      const render = renderers[component.name];
      expect(render, `add a renderer for ${component.name} so its exemption is checked`).toBeDefined();
      const markup = render!();
      const svgTag = markup.match(/<svg\b[^>]*>/)?.[0] ?? '';
      expect(svgTag).toContain('aria-hidden="true"');
      expect(svgTag).not.toContain('role="img"');
      expect(svgTag).not.toContain('aria-label');
      expect(markup).not.toMatch(/<(text|title|desc)\b/);
      for (const asset of assetsDrawnBy(component.name)) {
        expect(asset.kind, asset.assetId).toBe('texture');
        expect(asset.altText, asset.assetId).toBeNull();
      }
    });
  }

  for (const component of drawing) {
    if (decorative.includes(component)) continue;
    const literals = colourLiterals(component.text);

    it(`${component.name}: every mark clears 3:1 against every colour its asset declares`, () => {
      const assets = assetsDrawnBy(component.name);
      expect(assets.length, `no register entry names ${component.name}`).toBeGreaterThan(0);
      for (const asset of assets) {
        const assetMarks = marks(literals, asset);
        expect(assetMarks.length, asset.assetId).toBeGreaterThan(0);
        for (const mark of assetMarks) {
          for (const declared of asset.backgroundColoursBehindText) {
            const ratio = contrastRatio(literalHex(mark), tokenHex(declared));
            expect(
              ratio,
              `${asset.assetId}: ${mark} on ${declared} is ${ratio.toFixed(2)}:1`
            ).toBeGreaterThanOrEqual(3);
          }
        }
      }
    });
  }
});
