import { describe, expect, it } from 'vitest';

import {
  PRIMARY_TERMS,
  PROSCRIBED_TERMS,
  findProscribedTerms,
} from '@/config/indian-english-terms';
import { maskToCopy } from './helpers/public-copy';

/**
 * The Indian English term list and the copy extractor it is applied through.
 * Requirement 9.12.
 *
 * The scan of every public page lives in `tests/public-content.test.ts`, in the
 * "Indian English on every public page" block, so it runs over the same
 * enumeration of the public surface and the same approved-denial window as every
 * other content rule. This file tests the two pieces that scan is built from.
 */

/** Collapse a copy mask to the words in it, for readable assertions. */
function words(masked: string): string {
  return masked.replace(/\s+/g, ' ').trim();
}

describe('the term list itself', () => {
  it('names the nine primary terms Requirement 9.12 lists, in its order', () => {
    expect([...PRIMARY_TERMS]).toEqual([
      'flat',
      'independent house',
      'villa',
      'site',
      'plot',
      'locality',
      'possession',
      'resale',
      'brokerage',
    ]);
  });

  it('names a non-empty replacement for every proscribed term', () => {
    expect(PROSCRIBED_TERMS.length).toBe(11);
    for (const entry of PROSCRIBED_TERMS) {
      expect(entry.use.trim().length, entry.term.source).toBeGreaterThan(0);
    }
  });

  it('never proscribes a replacement or a primary term', () => {
    // A replacement that is itself proscribed would send an author in a circle.
    for (const entry of PROSCRIBED_TERMS) {
      expect(findProscribedTerms(entry.use), entry.term.source).toEqual([]);
    }
    for (const term of PRIMARY_TERMS) {
      expect(findProscribedTerms(term), term).toEqual([]);
    }
  });

  it('reports the matched wording together with what to write instead', () => {
    expect(findProscribedTerms('Homes in a quiet neighborhood near the metro')).toEqual([
      { matched: 'neighborhood', use: 'locality' },
    ]);
    expect(findProscribedTerms('Ask your Realtor about closing costs')).toEqual([
      { matched: 'Realtor', use: 'broker' },
      { matched: 'closing costs', use: 'registration and transfer charges' },
    ]);
  });

  it('leaves the Indian English form alone', () => {
    expect(
      findProscribedTerms(
        'The locality has a centre, a colour scheme, an owners association and an organisation behind it.'
      )
    ).toEqual([]);
  });

  it('matches whole words only, so a longer legitimate word never fires', () => {
    for (const legitimate of [
      'condone', // condo
      'condor', // condo
      'WHOA', // HOA
      'HOAX', // HOA
      'colorectal', // color
      'Colorado', // color
      'apartment complexity', // apartment complex
      'unzip codes', // zip code
    ]) {
      expect(findProscribedTerms(legitimate), legitimate).toEqual([]);
    }
  });

  it('still matches a proscribed word next to punctuation or an HTML entity', () => {
    expect(findProscribedTerms('the realtor’s fee')).toEqual([{ matched: 'realtor', use: 'broker' }]);
    expect(findProscribedTerms('&ldquo;condominium&rdquo;')).toEqual([{ matched: 'condominium', use: 'flat' }]);
    expect(findProscribedTerms('Ask the HOA.')).toEqual([{ matched: 'HOA', use: 'owners association' }]);
    expect(findProscribedTerms('color-coded')).toEqual([{ matched: 'color', use: 'colour' }]);
  });
});

describe('the copy mask', () => {
  it('keeps JSX text and prose strings, and drops the code around them', () => {
    const sample = [
      "import styles from './page.module.css';",
      "const style = { color: 'var(--color-text-on-dark)', textAlign: 'center' };",
      "const schema = { '@type': 'Organization', name: 'x' };",
      'const view = (',
      '  <div>',
      '    <p className="lead">We handle flats in every locality we work in.</p>',
      '    <path d="M 100 62 A 26 9 0 0 1 152 62" />',
      '  </div>',
      ');',
    ].join('\n');
    const copy = words(maskToCopy(sample, 'sample.tsx'));
    expect(copy).toBe('We handle flats in every locality we work in.');
  });

  it('keeps prose on both sides of a JSX expression', () => {
    const copy = words(maskToCopy('<p>Talk to {BRAND} about your locality.</p>', 'sample.tsx'));
    expect(copy).toBe('Talk to about your locality.');
  });

  it('keeps a one-word value only under a copy-bearing key', () => {
    const copy = words(
      maskToCopy(
        [
          "const option = { value: 'villa', label: 'Villa' };",
          '<TypographicPlate kicker="Bengaluru" variant="cropped" alt="Streetscape" />',
        ].join('\n'),
        'sample.tsx'
      )
    );
    expect(copy).toBe('Villa Bengaluru Streetscape');
  });

  it('keeps the static parts of a template literal and drops the interpolation', () => {
    const copy = words(
      maskToCopy('const note = `Near ${area.color} is a quiet ${kind} locality`;', 'sample.ts')
    );
    expect(copy).toBe('Near is a quiet locality');
  });

  it('never reads a comment as copy', () => {
    const copy = words(
      maskToCopy(
        [
          '// The neighborhood wording is banned; see the term list.',
          '/* color and center are CSS words */',
          '<p>{/* a JSX comment about a realtor */}Plain copy here.</p>',
        ].join('\n'),
        'sample.tsx'
      )
    );
    expect(copy).toBe('Plain copy here.');
  });

  it('keeps every newline, so a match reports the line the author will edit', () => {
    const sample = "const a = 1;\nconst b = 'second line prose';\n<p>third line prose</p>";
    const masked = maskToCopy(sample, 'sample.tsx');
    expect(masked.length).toBe(sample.length);
    expect(masked.split('\n')).toHaveLength(3);
    expect(masked.split('\n')[1]).toContain('second line prose');
    expect(masked.split('\n')[2]).toContain('third line prose');
  });
});
