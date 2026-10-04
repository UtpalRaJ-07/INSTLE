/**
 * @vitest-environment jsdom
 */

/**
 * Task 13.3 — the direct answer component. Requirements 5.3 and 5.11.
 *
 * Requirement 5.3 places a published guide's 20-to-60-word direct answer "in the
 * first text block after the `<h1>` and before the first section heading". The gate
 * (`evaluateGuide`) already holds the word count on the record; this file checks
 * the rendered page, because position exists only in markup. Every assertion runs
 * on what `GuidePage` actually renders for the live registry, parsed into a DOM,
 * with the block located by its inert `data-direct-answer` attribute rather than
 * by a class name.
 *
 * "Text block", as used here: a block-level element whose content a reader or an
 * extracting system takes in as one unit of prose — a paragraph, a list item, a
 * description term or detail, a blockquote, a heading of any level, preformatted
 * text, a figure caption, a table cell or caption, or a disclosure summary. Inline
 * elements (a link, a span) are parts of a block, not blocks. That is the reading
 * of "block" the HTML content model gives, and it is what an extractor segments on.
 *
 * The element list alone would miss text left loose in a `<div>` or a `<span>`
 * between the two, so the page test also asserts the stronger condition: no text
 * node with a visible character lies between the end of the `<h1>` and the start of
 * the answer. Together they mean nothing readable separates the question from its
 * answer, whatever element a later edit might put it in.
 */

import React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GuidePage from '@/app/guides/[slug]/page';
import { GuideDirectAnswer } from '@/components/GuideDirectAnswer/GuideDirectAnswer';
import {
  getPublishedGuides,
  MAX_DIRECT_ANSWER_WORDS,
  MIN_DIRECT_ANSWER_WORDS,
  type GuideRecord,
} from '@/config/guides';
import { countWords } from '@/lib/text-metrics';

/** The date the rest of the suite judges the live guide registry on. */
const NOW = new Date('2026-09-29T00:00:00.000Z');

/** The block-level elements that count as a "text block" (see the header). */
const TEXT_BLOCK_SELECTOR =
  'p, li, dt, dd, blockquote, h1, h2, h3, h4, h5, h6, pre, figcaption, caption, td, th, summary';

const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();

function parse(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

async function renderGuide(slug: string): Promise<HTMLElement> {
  const element = await GuidePage({ params: Promise.resolve({ slug }) });
  return parse(renderToStaticMarkup(element));
}

/** True when `node` follows `a` and precedes `b` in document order, inside neither. */
function liesBetween(node: Node, a: Element, b: Element): boolean {
  const fromA = a.compareDocumentPosition(node);
  const fromB = b.compareDocumentPosition(node);
  return (
    (fromA & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    (fromA & Node.DOCUMENT_POSITION_CONTAINED_BY) === 0 &&
    (fromB & Node.DOCUMENT_POSITION_PRECEDING) !== 0 &&
    // An ancestor of `b` also precedes it; an ancestor is not "between".
    (fromB & Node.DOCUMENT_POSITION_CONTAINS) === 0
  );
}

function follows(node: Node, reference: Element): boolean {
  const position = reference.compareDocumentPosition(node);
  return (
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    (position & Node.DOCUMENT_POSITION_CONTAINED_BY) === 0
  );
}

/** Every text node under `root` carrying a visible character. */
function visibleTextNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (/\S/.test(node.textContent ?? '')) found.push(node as Text);
  }
  return found;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GuideDirectAnswer on its own', () => {
  const text =
    "For the first conversation we only need five things, and the owner's name is not one of them — everything else can wait until we speak.";

  it('renders one ordinary paragraph carrying the text and the inert locator', () => {
    const root = parse(renderToStaticMarkup(<GuideDirectAnswer text={text} />));

    expect(root.children).toHaveLength(1);
    const block = root.firstElementChild!;
    expect(block.tagName).toBe('P');
    expect(block.getAttribute('data-direct-answer')).toBe('');
    // Rendered as text, not as markup: the apostrophe and dash arrive as characters.
    expect(block.children).toHaveLength(0);
    expect(block.textContent).toBe(text);
  });

  it('is plain readable text: not hidden, not a live region, no role, no inline style', () => {
    const block = parse(renderToStaticMarkup(<GuideDirectAnswer text={text} />)).firstElementChild!;
    const attributes = block.getAttributeNames().sort();
    // A class for the stylesheet and the locator, and nothing that changes how an
    // assistive technology announces it.
    expect(attributes.filter((name) => name !== 'class')).toEqual(['data-direct-answer']);
  });
});

describe('the direct answer on every published guide page (Requirements 5.3, 5.11)', () => {
  const published: readonly GuideRecord[] = getPublishedGuides(NOW);

  it('checks the three guides that publish today', () => {
    expect(published.map((record) => record.slug)).toHaveLength(3);
  });

  describe.each(published.map((record) => [record.slug, record] as const))('%s', (slug, record) => {
    it("renders exactly one direct answer, holding the record's text, inside the 20-to-60-word band", async () => {
      const root = await renderGuide(slug);
      const answers = root.querySelectorAll('[data-direct-answer]');
      expect(answers, slug).toHaveLength(1);

      const answer = answers[0]!;
      expect(answer.tagName, slug).toBe('P');
      const rendered = normalise(answer.textContent ?? '');
      expect(rendered, slug).toBe(normalise(record.directAnswer));

      // Measured on the rendered text with the gate's own counter; 5.11 asks for
      // the slug and the count, so both are in the message.
      const words = countWords(rendered);
      const report = `${slug}: direct answer measured ${words} words`;
      expect(words, report).toBeGreaterThanOrEqual(MIN_DIRECT_ANSWER_WORDS);
      expect(words, report).toBeLessThanOrEqual(MAX_DIRECT_ANSWER_WORDS);
    });

    it('follows the single <h1> and precedes the first section heading', async () => {
      const root = await renderGuide(slug);
      const headings = root.querySelectorAll('h1');
      expect(headings, slug).toHaveLength(1);
      const h1 = headings[0]!;
      const answer = root.querySelector('[data-direct-answer]')!;

      expect(follows(answer, h1), `${slug}: answer after the <h1>`).toBe(true);

      // `querySelector` returns the first match in document order. It is the first
      // section heading, not some other <h2>, and the answer comes before it.
      const firstH2 = root.querySelector('h2');
      expect(firstH2, slug).not.toBeNull();
      expect(normalise(firstH2!.textContent ?? ''), slug).toBe(record.sections[0]!.heading);
      expect(follows(firstH2!, answer), `${slug}: answer before the first <h2>`).toBe(true);
    });

    it('is the first text block after the <h1>, with nothing readable in between', async () => {
      const root = await renderGuide(slug);
      const h1 = root.querySelector('h1')!;
      const answer = root.querySelector('[data-direct-answer]')!;

      const blocks = Array.from(root.querySelectorAll(TEXT_BLOCK_SELECTOR));
      expect(blocks.find((block) => follows(block, h1)), slug).toBe(answer);
      expect(
        blocks.filter((block) => liesBetween(block, h1, answer)).map((block) => block.outerHTML),
        slug
      ).toEqual([]);

      const strayText = visibleTextNodes(root)
        .filter((node) => liesBetween(node, h1, answer))
        .map((node) => node.textContent);
      expect(strayText, slug).toEqual([]);
    });

    it('is announced as ordinary text inside the region the <h1> labels', async () => {
      const root = await renderGuide(slug);
      const h1 = root.querySelector('h1')!;
      const answer = root.querySelector('[data-direct-answer]')!;

      expect(answer.closest('section')?.getAttribute('aria-labelledby'), slug).toBe(h1.id);
      for (let node: Element | null = answer; node && node !== root; node = node.parentElement) {
        expect(node.hasAttribute('hidden'), `${slug}: <${node.tagName}> hidden`).toBe(false);
        expect(node.getAttribute('aria-hidden'), `${slug}: <${node.tagName}> aria-hidden`).not.toBe('true');
        expect(node.hasAttribute('aria-live'), `${slug}: <${node.tagName}> aria-live`).toBe(false);
      }
      expect(answer.hasAttribute('role'), slug).toBe(false);
    });
  });
});

describe('the locator stays inert', () => {
  const srcRoot = join(process.cwd(), 'src');
  const files = readdirSync(srcRoot, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(tsx?|jsx?|mjs|css)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
  const component = join('src', 'components', 'GuideDirectAnswer', 'GuideDirectAnswer.tsx');

  it('is named by the component alone, so no stylesheet or script depends on it', () => {
    expect(files.length).toBeGreaterThan(40);
    const naming = files
      .filter((file) => /data-direct-answer|dataset\.directAnswer/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file));
    expect(naming).toEqual([component]);
  });

  it('ships in a server component', () => {
    const source = readFileSync(join(process.cwd(), component), 'utf8');
    expect(source).not.toMatch(/['"]use client['"]/);
  });
});
