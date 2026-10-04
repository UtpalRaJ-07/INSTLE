import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contrast on the night surfaces (header, page intros, contact bands, footer,
 * mobile bar, homepage hero), computed from the hex values in tokens.css the
 * same way tests/design-tokens.test.ts does for the paper palette. Editing a
 * night token re-runs the arithmetic.
 *
 * `.surface-night` in globals.css re-points the semantic tokens to these, so
 * the pairs below are the ones every component inside a night surface renders.
 */

const tokensCss = readFileSync(join(__dirname, '..', 'src', 'styles', 'tokens.css'), 'utf8');
const globalsCss = readFileSync(join(__dirname, '..', 'src', 'styles', 'globals.css'), 'utf8');

function token(name: string): string {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
  if (!match) throw new Error(`Token --${name} not found in tokens.css`);
  return match[1]!;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const night = token('night');
const raised = token('night-raised');
const card = token('night-card');
const surfaces: readonly [string, string][] = [
  ['night', night],
  ['night-raised', raised],
  ['night-card', card],
];

describe('night surfaces: text (WCAG 1.4.3, 4.5:1)', () => {
  for (const [label, foreground] of [
    ['night-text', token('night-text')],
    ['night-muted', token('night-muted')],
    ['night-accent', token('night-accent')],
  ] as const) {
    for (const [surface, background] of surfaces) {
      it(`${label} on ${surface}`, () => {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('the primary action: dark ink on warm light, and on its hover state', () => {
    expect(contrast(token('night-accent-ink'), token('night-accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('night-accent-ink'), token('night-accent-hover'))).toBeGreaterThanOrEqual(4.5);
  });

  it('error text inside a night surface', () => {
    const error = globalsCss.match(/\.surface-night\s*\{[^}]*--color-error:\s*(#[0-9a-fA-F]{6});/)?.[1];
    expect(error).toBeTruthy();
    for (const [, background] of surfaces) expect(contrast(error!, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('night surfaces: controls (WCAG 1.4.11, 3:1)', () => {
  for (const [label, foreground] of [
    ['focus ring', token('night-focus')],
    ['control border', token('night-border-strong')],
    ['primary action surface', token('night-accent')],
  ] as const) {
    for (const [surface, background] of surfaces) {
      it(`${label} on ${surface}`, () => {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
      });
    }
  }
});

describe('the night scope re-points the tokens components read', () => {
  const scope = globalsCss.match(/\.surface-night\s*\{([^}]*)\}/)?.[1] ?? '';
  for (const name of [
    'color-ink',
    'color-text-primary',
    'color-text-muted',
    'color-paper',
    'color-background-card',
    'color-border-strong',
    'color-forest',
    'color-white',
    'focus-ring-color',
  ]) {
    it(`redefines --${name}`, () => {
      expect(scope).toMatch(new RegExp(`--${name}:`));
    });
  }
});
