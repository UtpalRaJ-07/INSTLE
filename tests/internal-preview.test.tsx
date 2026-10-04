import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import InternalPreviewPage, {
  dynamic as previewDynamic,
  metadata as previewMetadata,
} from '@/app/internal-preview/page';
import robots from '@/app/robots';
import { GET as llmsRoute } from '@/app/llms.txt/route';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';
import { LOCALITY_REGISTRY, evaluateLocality } from '@/config/localities';
import {
  PREVIEW_BLOCKING_CHECKLIST_ENTRIES,
  PREVIEW_RECORD_PARAM,
  PREVIEW_ROUTE_PATH,
  getRecordPreview,
  listPreviewableRecords,
} from '@/lib/record-preview';
import { NON_PUBLIC_INTERNAL_ROUTES, STATIC_PUBLIC_ROUTES, getPublicRoutes } from '@/lib/public-routes';

import {
  EXCLUDED_PATH_FRAGMENTS,
  ROOT,
  computePublicSurfaceClosure,
} from './helpers/public-surface';
import { noindexScopeViolations, registeredPageRoutes, setEnv } from './helpers/robots-scope';

/**
 * The preview surface for a record that has not passed the publication gate
 * (task 17.4, Requirement 11.8).
 *
 * Requirement 11.8 wants a surface showing an unpublished record. Requirements 11.8
 * and 12.10, and Property 1 in
 * `tests/properties/gate-failing-leaks-nothing.property.test.tsx`, say an unpublished
 * record must reach no public reader. Both hold at once only if the surface is not
 * public, so this file asserts each of the four switches separately:
 *
 *  1. It 404s under a production deploy environment.
 *  2. It carries `noindex` in every environment.
 *  3. It is absent from `getPublicRoutes`, and so from the sitemap, from `llms.txt`
 *     and from every link on the public surface.
 *  4. Neither the page nor the module that reads the registry for it is in the
 *     Requirement 12.13 public-surface closure.
 *
 * And then that the mechanism actually works: in a non-production environment it
 * renders a named unpublished record with its full gate-failure list.
 */

const NOW = new Date('2026-09-29T00:00:00.000Z');

/** The digest prefix Next puts on the error `notFound()` throws. */
function digestOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return String((error as { digest?: unknown }).digest ?? '');
  }
  throw new Error('Expected notFound() to throw.');
}

const NOT_FOUND_DIGEST = digestOf(() => notFound());

async function renderPreview(record?: string): Promise<string> {
  const searchParams = Promise.resolve(record === undefined ? {} : { [PREVIEW_RECORD_PARAM]: record });
  return renderToStaticMarkup(await InternalPreviewPage({ searchParams }));
}

/**
 * Every `href` in the markup. A regex rather than the DOM, because
 * `tests/helpers/robots-scope.ts` resolves its paths from `import.meta.url` and so
 * cannot be imported into a jsdom environment — and the robots assertion below needs
 * it. The markup here is this file's own server-rendered output, so there is no
 * malformed-HTML case for a parser to disagree about.
 */
function hrefsIn(markup: string): string[] {
  return [...markup.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((match) => match[1]!);
}

/** Text as React writes it into markup, so a gate failure is compared as served. */
function escapeAsReactDoes(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** A record that does not pass the gate, taken from the live registry. */
const unpublished = LOCALITY_REGISTRY.find((record) => !evaluateLocality(record, NOW).eligible)!;

// ---------------------------------------------------------------------------
// 1. Switched off: 404 in a production deployment
// ---------------------------------------------------------------------------

describe('the preview route in a production deployment (Requirement 11.8)', () => {
  it('returns 404', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'production' });
    await expect(renderPreview(unpublished.entityId)).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
    expect(Number(NOT_FOUND_DIGEST.split(';')[1])).toBe(404);
  });

  it('returns 404 with a confirmed domain too, so the domain does not unblock it', async () => {
    setEnv({
      INSTLE_DEPLOY_ENV: 'production',
      INSTLE_PUBLIC_ORIGIN: 'https://example-instle.test',
      INSTLE_DOMAIN_CONFIRMED: 'true',
    });
    await expect(renderPreview()).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
  });

  it('is evaluated per request, so the guard cannot be frozen into a prerendered page', () => {
    expect(previewDynamic).toBe('force-dynamic');
  });

  it('follows the environment on each request rather than the first', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'preview' });
    await expect(renderPreview()).resolves.toContain('Internal preview');
    setEnv({ INSTLE_DEPLOY_ENV: 'production' });
    await expect(renderPreview()).rejects.toMatchObject({ digest: NOT_FOUND_DIGEST });
    setEnv({ INSTLE_DEPLOY_ENV: 'preview' });
    await expect(renderPreview()).resolves.toContain('Internal preview');
  });
});

// ---------------------------------------------------------------------------
// 2. noindex
// ---------------------------------------------------------------------------

describe('the preview route carries noindex (Requirement 11.8)', () => {
  it('records index: false and follow: false', () => {
    const { robots } = previewMetadata as Metadata;
    expect(robots).toMatchObject({ index: false, follow: false });
  });

  it('sits under no Disallow line in production, so tests/robots.test.ts keeps passing', () => {
    const routes = registeredPageRoutes();
    expect(routes).toContain(PREVIEW_ROUTE_PATH);

    setEnv({
      INSTLE_DEPLOY_ENV: 'production',
      INSTLE_PUBLIC_ORIGIN: 'https://example-instle.test',
      INSTLE_DOMAIN_CONFIRMED: 'true',
    });
    expect(noindexScopeViolations(robots(), [PREVIEW_ROUTE_PATH])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Absent from every public surface
// ---------------------------------------------------------------------------

describe('the preview route is on no public surface (Requirement 11.8)', () => {
  it('is recorded as deliberately non-public', () => {
    expect(NON_PUBLIC_INTERNAL_ROUTES).toContain(PREVIEW_ROUTE_PATH);
  });

  it('is absent from getPublicRoutes and from the static route list', () => {
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    expect(paths.length).toBeGreaterThan(0);
    for (const route of NON_PUBLIC_INTERNAL_ROUTES) {
      expect(paths, route).not.toContain(route);
      expect(STATIC_PUBLIC_ROUTES.map((entry) => entry.path), route).not.toContain(route);
    }
  });

  it('is absent from the served sitemap', async () => {
    setEnv({
      INSTLE_DEPLOY_ENV: 'production',
      INSTLE_PUBLIC_ORIGIN: 'https://example-instle.test',
      INSTLE_DOMAIN_CONFIRMED: 'true',
    });
    const response = await sitemapRoute();
    expect(response.status).toBe(200);
    const body = await response.text();
    // Not vacuous: the sitemap does carry the static routes.
    expect(body).toContain('/contact');
    expect(body).not.toContain(PREVIEW_ROUTE_PATH);
  });

  it('is absent from the served llms.txt', async () => {
    setEnv({
      INSTLE_DEPLOY_ENV: 'production',
      INSTLE_PUBLIC_ORIGIN: 'https://example-instle.test',
      INSTLE_DOMAIN_CONFIRMED: 'true',
    });
    const response = await llmsRoute();
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain(PREVIEW_ROUTE_PATH);
  });

  it('is linked from no file on the Requirement 12.13 public surface', () => {
    const closure = computePublicSurfaceClosure();
    expect(closure.length).toBeGreaterThan(20);

    const mentions = closure
      .filter((file) => readFileSync(file, 'utf8').includes(PREVIEW_ROUTE_PATH))
      .map((file) => relative(ROOT, file));

    // One mention only, and it is the registry recording the exclusion by name.
    expect(mentions).toEqual(['src/lib/public-routes.ts']);
  });

  it('keeps the page and the module that reads the registry for it outside that surface', () => {
    const closure = computePublicSurfaceClosure().map((file) => relative(ROOT, file));
    expect(closure).not.toContain('src/app/internal-preview/page.tsx');
    expect(closure).not.toContain('src/lib/record-preview.ts');
  });

  it('records the route fragment among the excluded path fragments', () => {
    expect(EXCLUDED_PATH_FRAGMENTS).toContain(`${sep}internal-preview${sep}`);
  });

  it('links only to itself, so nothing it renders points at a public draft route', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'preview' });
    const hrefs = hrefsIn(await renderPreview());
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith(`${PREVIEW_ROUTE_PATH}?`), href).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. What it shows, where it does answer
// ---------------------------------------------------------------------------

describe('the preview surface renders an unpublished record (Requirement 11.8)', () => {
  it('names the checklist entries the records it shows are waiting on', () => {
    expect(PREVIEW_BLOCKING_CHECKLIST_ENTRIES).toEqual(['C1 / OWN-03', 'C2 / OWN-14']);
  });

  it('has an unpublished record to show, which is the true state today', () => {
    expect(LOCALITY_REGISTRY).toHaveLength(132);
    expect(listPreviewableRecords(NOW)).toHaveLength(132);
    expect(listPreviewableRecords(NOW).every((entry) => !entry.passesGate)).toBe(true);
  });

  it('renders the named record with its full gate-failure list', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'development' });
    const failures = evaluateLocality(unpublished, new Date()).failures;
    expect(failures.length).toBeGreaterThan(0);

    const markup = await renderPreview(unpublished.entityId);
    expect(markup).toContain(unpublished.canonicalName);
    expect(markup).toContain(unpublished.entityId);
    expect(markup).toContain('does not pass the publication gate');
    expect(markup).toContain(`${failures.length} condition(s) are unmet`);
    for (const failure of failures) {
      expect(markup, failure).toContain(escapeAsReactDoes(failure));
    }
  });

  it('resolves a record by slug as well as by identifier', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'development' });
    const bySlug = await renderPreview(unpublished.slug);
    expect(bySlug).toContain(unpublished.entityId);
    expect(getRecordPreview(unpublished.slug, NOW)?.entityId).toBe(unpublished.entityId);
    expect(getRecordPreview(unpublished.entityId, NOW)?.entityId).toBe(unpublished.entityId);
  });

  it('reports an unknown reference rather than an empty page', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'development' });
    expect(getRecordPreview('no-such-record', NOW)).toBeNull();
    const markup = await renderPreview('no-such-record');
    expect(markup).toContain('No record carries that reference');
  });

  it('shows the internal blocking notes, which is what it exists for', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'development' });
    const withNotes = LOCALITY_REGISTRY.find((record) => record.blockingNotes.length > 0)!;
    const markup = await renderPreview(withNotes.entityId);
    expect(markup).toContain('Internal blocking notes');
    for (const note of withNotes.blockingNotes) {
      expect(markup, note).toContain(escapeAsReactDoes(note));
    }
  });

  it('says on the page that it is internal and returns 404 in production', async () => {
    setEnv({ INSTLE_DEPLOY_ENV: 'development' });
    const markup = await renderPreview();
    expect(markup).toContain('internal editorial material');
    expect(markup).toContain('404 in a production deployment');
    expect(markup).toContain('C1 / OWN-03');
    expect(markup).toContain('C2 / OWN-14');
  });
});
