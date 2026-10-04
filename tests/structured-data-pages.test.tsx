import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderRouteContent } from './helpers/rendered-routes';
import { Footer } from '@/components/Footer/Footer';
import { Header } from '@/components/Header/Header';
import { getPublishedGuideBySlug, getPublishedGuideSlugs } from '@/config/guides';
import { auditGraph, type GraphAudit } from '@/lib/structured-data-policy';
import { buildOwnerNode, type JsonLdObject } from '@/lib/structured-data';

/**
 * Task 13.2. Every page that emits JSON-LD, audited against what a reader of that
 * page sees: the Organization node without the description no page showed, a
 * Service node on each service page read from that page's own `<h1>` and lead,
 * and no Article node on an own-process guide. Requirements 4.4, 5.6 and 5.7.
 *
 * A page's visible text is its content plus the header and footer every route is
 * served inside, with script and style bodies removed first, so the JSON-LD in
 * the page can never supply the text it is checked against.
 */

function visibleTextOf(markup: string): string {
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const noop = () => undefined;
const SHELL_TEXT = visibleTextOf(
  renderToStaticMarkup(<Header isMenuOpen={false} onMenuOpenChange={noop} />) +
    renderToStaticMarkup(<Footer />)
);

interface RenderedPage {
  readonly markup: string;
  readonly text: string;
  readonly graphs: readonly JsonLdObject[];
}

/** Renders at call time, so a test that confirms the domain first gets the confirmed graph. */
async function renderPage(route: string): Promise<RenderedPage> {
  const markup = await renderRouteContent(route);
  const graphs = [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]!) as JsonLdObject
  );
  return { markup, text: `${SHELL_TEXT} ${visibleTextOf(markup)}`, graphs };
}

function auditsOf(page: RenderedPage): GraphAudit[] {
  return page.graphs.map((graph) => auditGraph(graph, page.text));
}

function nodesOf(graph: JsonLdObject): JsonLdObject[] {
  return graph['@graph'] as JsonLdObject[];
}

/** Every `@type` at any depth. */
function typesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(typesIn);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === '@type' ? (Array.isArray(child) ? child.map(String) : [String(child)]) : typesIn(child)
  );
}

/** The text of the first element matched, whitespace collapsed. */
function textOfFirst(markup: string, pattern: RegExp): string {
  const match = pattern.exec(markup);
  expect(match, String(pattern)).not.toBeNull();
  return visibleTextOf(match![1]!).replace(/\s+/g, ' ').trim();
}

function confirmDomain() {
  process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
}

const PASSES: GraphAudit = { ok: true, failures: [] };

/** The owner node's role, "Owner and CEO". */
const OWNER_JOB_TITLE = String(buildOwnerNode().jobTitle);

const SERVICE_ROUTES = ['/buy', '/sell', '/rent', '/rent-out', '/commercial'] as const;

describe.each(SERVICE_ROUTES)('the Service node on %s', (route) => {
  it("takes its name and description verbatim from the page's <h1> and lead", async () => {
    const page = await renderPage(route);
    expect(page.graphs).toHaveLength(1);
    const nodes = nodesOf(page.graphs[0]!);
    expect(nodes.map((node) => node['@type'])).toEqual(['Service']);

    const [service] = nodes;
    expect(service!.name).toBe(textOfFirst(page.markup, /<h1\b[^>]*>([\s\S]*?)<\/h1>/));
    // The lead is the paragraph PageIntro renders directly after the <h1>.
    expect(service!.description).toBe(textOfFirst(page.markup, /<\/h1>\s*<p\b[^>]*>([\s\S]*?)<\/p>/));
  });

  it('is provided by the organisation, and carries no owner role the page does not show', async () => {
    const page = await renderPage(route);
    const [service] = nodesOf(page.graphs[0]!);
    expect((service!.provider as JsonLdObject)['@type']).toBe('Organization');
    expect(page.graphs.flatMap(typesIn)).not.toContain('Person');
    expect(page.text).not.toContain(OWNER_JOB_TITLE);
  });

  it('passes the audit while the domain is unconfirmed, and once it is confirmed', async () => {
    expect(auditsOf(await renderPage(route))).toEqual([PASSES]);
    confirmDomain();
    const confirmed = await renderPage(route);
    expect(nodesOf(confirmed.graphs[0]!)[0]!.url).toBe(`https://example-instle.test${route}`);
    expect(auditsOf(confirmed)).toEqual([PASSES]);
  });
});

describe('the other pages that emit the site graph', () => {
  /** How many graphs each page emits, so an audit can never pass by finding none. */
  const EXPECTED_GRAPHS: Readonly<Record<string, number>> = {
    '/': 1,
    '/about': 0,
    '/about/utpal-raj-kb': 1,
  };

  it.each(Object.entries(EXPECTED_GRAPHS))('%s passes the audit', async (route, count) => {
    const page = await renderPage(route);
    expect(page.graphs).toHaveLength(count);
    expect(auditsOf(page)).toEqual(Array.from({ length: count }, () => PASSES));
  });

  it('passes on the owner profile once the domain is confirmed and its breadcrumbs are emitted', async () => {
    confirmDomain();
    const page = await renderPage('/about/utpal-raj-kb');
    const types = nodesOf(page.graphs[0]!).map((node) => node['@type']);
    expect(types).toEqual(['Organization', 'Person', 'BreadcrumbList']);
    expect(auditsOf(page)).toEqual([PASSES]);
  });
});

describe('published guides', () => {
  const now = new Date();
  const slugs = getPublishedGuideSlugs(now);
  const ownProcess = slugs.filter((slug) => getPublishedGuideBySlug(slug, now)?.contentClass === 'own-process');

  it('publishes own-process guides to check', () => {
    expect(ownProcess.length).toBeGreaterThan(0);
  });

  it.each(ownProcess)('/guides/%s emits no Article node (Requirement 4.4)', async (slug) => {
    for (const confirmed of [false, true]) {
      if (confirmed) confirmDomain();
      const page = await renderPage(`/guides/${slug}`);
      expect(page.graphs.length).toBeGreaterThan(0);
      expect(page.graphs.flatMap(typesIn)).not.toContain('Article');
    }
  });

  /**
   * Previously pinned as a known defect: the guide page emitted `buildSiteGraph`,
   * which carries the owner's Person node. The footer names the owner on every
   * page, but a guide page shows the owner's role nowhere, so `jobTitle` was a
   * value no reader of a guide could see. Task 13.4 moved the page onto
   * `buildOrganisationGraph`, which carries no owner node, and the pin is now
   * flipped as this comment instructed: the audit passes in both domain states.
   */
  it.each(slugs)('/guides/%s passes the audit, and shows no owner role', async (slug) => {
    const unconfirmed = await renderPage(`/guides/${slug}`);
    expect(nodesOf(unconfirmed.graphs[0]!).map((node) => node['@type'])).toEqual(['Organization']);
    expect(unconfirmed.text).not.toContain(OWNER_JOB_TITLE);
    expect(auditsOf(unconfirmed)).toEqual([PASSES]);

    confirmDomain();
    const confirmed = await renderPage(`/guides/${slug}`);
    expect(nodesOf(confirmed.graphs[0]!).map((node) => node['@type'])).toEqual([
      'Organization',
      'BreadcrumbList',
    ]);
    expect(confirmed.graphs.flatMap(typesIn)).not.toContain('Person');
    expect(auditsOf(confirmed)).toEqual([PASSES]);
  });
});
