/**
 * @vitest-environment jsdom
 */

/**
 * Task 12.3 — the llms.txt route. Requirements 6.9 and 6.12.
 *
 *  - 6.9: served only in production with a confirmed domain; a 404 everywhere else.
 *  - 6.12: every statement in the file is text a gate-passing page already shows a
 *    reader, and every link is the canonical URL of a gate-passing route. Checked
 *    against the markup the pages actually render, not against the records, so a
 *    page that stops saying something makes this suite — and so the build — fail.
 *
 * The guides are the live ones; three pass the gate today and none of the
 * localities do, so the file carries a guides section and no areas section.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CANONICAL_BRAND, PRIMARY_PHONE, PROHIBITED_BRAND_TERMS, isPrototypeRoute } from '@/config/constants';
import { GUIDE_REGISTRY, getPublishedGuides } from '@/config/guides';
import { LOCALITY_REGISTRY } from '@/config/localities';
import { getPublicRoutes } from '@/lib/public-routes';
import { GET as llmsRoute, dynamic as llmsDynamic } from '@/app/llms.txt/route';

import { parseMarkup, renderRouteContent } from './helpers/rendered-routes';

const NOW = new Date('2026-09-29T00:00:00.000Z');
/** After the live guides' `nextReviewAt` of 2027-09-29. */
const AFTER_GUIDE_REVIEW = new Date('2027-10-15T00:00:00.000Z');
const ORIGIN = 'https://example-instle.test';

function confirmDomain() {
  process.env.INSTLE_PUBLIC_ORIGIN = ORIGIN;
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
  process.env.INSTLE_DEPLOY_ENV = 'production';
}

async function servedBody(): Promise<string> {
  const response = await llmsRoute();
  expect(response.status).toBe(200);
  return response.text();
}

/** Whitespace-collapsed, applied identically to the file and to the pages. */
function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * What a reader sees: every text node, with scripts, styles and anything hidden
 * from view or from assistive technology removed. Element boundaries count as a
 * space so text from two elements never runs together into a false match.
 */
function visibleTextOf(markup: string): string {
  const root = parseMarkup(markup);
  root
    .querySelectorAll('script, style, template, [hidden], [aria-hidden="true"], .visually-hidden')
    .forEach((element) => element.remove());
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return normalise(parts.join(' '));
}

/** Visible text of every route that passes the gate at `NOW`, keyed by path. */
async function gatePassingPageTexts(): Promise<Map<string, string>> {
  const texts = new Map<string, string>();
  for (const route of getPublicRoutes(NOW)) {
    texts.set(route.path, visibleTextOf(await renderRouteContent(route.path)));
  }
  return texts;
}

/** `- label: note  (url)` or `- label  (url)`, as the route formats an entry. */
const ENTRY_LINE = /^- (.+)  \((\S+)\)$/;
const URL_PATTERN = /https?:\/\/[^\s)]+/g;

interface ParsedEntry {
  readonly line: string;
  /** Everything between the list marker and the URL. */
  readonly text: string;
  readonly url: string;
}

function parse(body: string) {
  const lines = body.split('\n').filter((line) => line.trim().length > 0);
  const headings = lines.filter((line) => line.startsWith('#'));
  const entries: ParsedEntry[] = [];
  const plain: string[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const match = line.match(ENTRY_LINE);
    if (match) entries.push({ line, text: match[1]!, url: match[2]! });
    else plain.push(line);
  }
  return { lines, headings, entries, plain };
}

/**
 * An entry's statements are its label and, when present, its note, joined by
 * ": ". A label could itself contain ": ", so every split point is tried; the
 * entry is honest when some split has both halves on the page it links to.
 */
function statementsOnPage(text: string, pageText: string): readonly string[] | null {
  if (pageText.includes(normalise(text))) return [normalise(text)];
  for (let index = text.indexOf(': '); index !== -1; index = text.indexOf(': ', index + 1)) {
    const label = normalise(text.slice(0, index));
    const note = normalise(text.slice(index + 2));
    if (label && note && pageText.includes(label) && pageText.includes(note)) return [label, note];
  }
  return null;
}

beforeEach(() => {
  // The route, the gate and the guide pages all read the clock themselves.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('llms.txt is served only in production with a confirmed domain (Requirement 6.9)', () => {
  it('is evaluated per request', () => {
    expect(llmsDynamic).toBe('force-dynamic');
  });

  it('returns 404 with no environment configured', async () => {
    const response = await llmsRoute();
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
  });

  it.each(['development', 'preview'])('returns 404 in %s even with a confirmed domain', async (env) => {
    confirmDomain();
    process.env.INSTLE_DEPLOY_ENV = env;
    expect((await llmsRoute()).status).toBe(404);
  });

  it('returns 404 in production while the origin is supplied but not confirmed', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    process.env.INSTLE_PUBLIC_ORIGIN = ORIGIN;
    expect((await llmsRoute()).status).toBe(404);
  });

  it('returns 404 in production while confirmation is set but no usable origin is', async () => {
    process.env.INSTLE_DEPLOY_ENV = 'production';
    process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
    expect((await llmsRoute()).status).toBe(404);
    process.env.INSTLE_PUBLIC_ORIGIN = 'http://example-instle.test';
    expect((await llmsRoute()).status).toBe(404);
  });

  it('returns 200 plain text in production with a confirmed domain', async () => {
    confirmDomain();
    const response = await llmsRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).not.toHaveLength(0);
  });
});

describe('llms.txt says nothing the gate-passing pages do not (Requirement 6.12)', () => {
  it('finds every non-heading line on a gate-passing page, and each entry on the page it links to', async () => {
    confirmDomain();
    const { lines, entries, plain } = parse(await servedBody());
    const pages = await gatePassingPageTexts();
    const allPages = [...pages.values()];

    // The file is not trivially empty, and every line was classified.
    expect(plain.length).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
    expect(plain.length + entries.length).toBe(lines.filter((line) => !line.startsWith('#')).length);

    for (const line of plain) {
      // A plain line carries no link; links belong to entries, which are held to
      // the route rule below.
      expect(line, line).not.toMatch(/https?:\/\//);
      expect(allPages.some((text) => text.includes(normalise(line))), `not on any gate-passing page: ${line}`).toBe(
        true
      );
    }

    for (const entry of entries) {
      const path = new URL(entry.url).pathname;
      const pageText = pages.get(path);
      expect(pageText, `links to a route that is not gate-passing: ${entry.url}`).toBeDefined();
      const statements = statementsOnPage(entry.text, pageText!);
      expect(statements, `label or note not on ${path}: ${entry.line}`).not.toBeNull();
      // The label, the entry's own claim about what the link is, is on some page.
      expect(allPages.some((text) => text.includes(statements![0]!))).toBe(true);
    }
  });

  it('uses only the headings the format defines', async () => {
    confirmDomain();
    const { headings } = parse(await servedBody());
    expect(headings[0]).toBe(`# ${CANONICAL_BRAND}`);
    for (const heading of headings.slice(1)) {
      expect(['## Guides', '## Areas']).toContain(heading);
    }
  });

  it('links only to absolute canonical URLs of gate-passing routes on the confirmed origin', async () => {
    confirmDomain();
    const body = await servedBody();
    const gatePassing = new Set(getPublicRoutes(NOW).map((route) => route.path));
    const urls = body.match(URL_PATTERN) ?? [];
    expect(urls.length).toBeGreaterThan(0);

    for (const url of urls) {
      const parsed = new URL(url);
      expect(parsed.origin).toBe(ORIGIN);
      expect(gatePassing.has(parsed.pathname), `not a gate-passing route: ${url}`).toBe(true);
      // Canonical form: origin plus the registered path, nothing appended.
      expect(url).toBe(`${ORIGIN}${parsed.pathname}`);
      expect(parsed.pathname.startsWith('/api/')).toBe(false);
      expect(isPrototypeRoute(parsed.pathname)).toBe(false);
    }
    // No relative link slips past the origin check.
    expect(body).not.toMatch(/\(\//);
  });

  it('lists every published guide and nothing unpublished', async () => {
    confirmDomain();
    const body = await servedBody();
    const listed = new Set(parse(body).entries.map((entry) => new URL(entry.url).pathname));
    const published = getPublishedGuides(NOW);
    expect(published.length).toBe(3);

    for (const guide of published) expect(listed.has(`/guides/${guide.slug}`)).toBe(true);

    const publishedIds = new Set(published.map((guide) => guide.guideId));
    for (const guide of GUIDE_REGISTRY) {
      if (publishedIds.has(guide.guideId)) continue;
      expect(body, guide.slug).not.toContain(`/guides/${guide.slug}`);
      expect(body, guide.slug).not.toContain(guide.title);
    }
    // No locality passes the gate today, so neither its URL nor an areas heading.
    for (const record of LOCALITY_REGISTRY) expect(body).not.toContain(`/areas/${record.slug}`);
    expect(body).not.toContain('## Areas');
  });

  it('writes the brand and the phone exactly as the shared constants', async () => {
    confirmDomain();
    const body = await servedBody();
    expect(body.split('\n')[0]).toBe(`# ${CANONICAL_BRAND}`);
    expect(body).toContain(`Call ${PRIMARY_PHONE}.`);

    // Every phone-shaped run of digits is the canonical number, unformatted.
    for (const run of body.match(/\+?\d[\d\s-]{6,}\d/g) ?? []) expect(run).toBe(PRIMARY_PHONE);
    // Every spelling of the brand is the all-caps lockup.
    for (const spelling of body.match(/instle real estate/gi) ?? []) expect(spelling).toBe(CANONICAL_BRAND);
    for (const term of PROHIBITED_BRAND_TERMS) expect(body).not.toContain(term);
  });

  it('drops the guides once their review date passes, with no rebuild', async () => {
    confirmDomain();
    const before = await servedBody();
    const liveGuides = getPublishedGuides(NOW);
    expect(before).toContain('## Guides');
    for (const guide of liveGuides) expect(guide.nextReviewAt).toBe('2027-09-29');

    vi.setSystemTime(AFTER_GUIDE_REVIEW);
    expect(getPublishedGuides(new Date())).toHaveLength(0);
    const after = await servedBody();
    expect(after).not.toContain('## Guides');
    expect(after).not.toContain('/guides/');
    for (const guide of liveGuides) {
      expect(after).not.toContain(guide.title);
      expect(after).not.toContain(guide.directAnswer);
    }
    // What remains is still only the brand, the descriptor and the call line.
    expect(after.split('\n')[0]).toBe(`# ${CANONICAL_BRAND}`);
    expect(after).toContain(`Call ${PRIMARY_PHONE}.`);

    // The same module, back at a date the guides pass, serves them again.
    vi.setSystemTime(NOW);
    expect(await servedBody()).toBe(before);
  });
});
