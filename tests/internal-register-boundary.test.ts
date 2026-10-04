import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STATIC_PUBLIC_ROUTES, getPublicRoutes } from '@/lib/public-routes';
import { GET as sitemapRoute } from '@/app/sitemap.xml/route';

import { SEARCH_INTENT_ENTRIES } from '@internal/registers/search-intent';
import { BENCHMARK_QUESTIONS, OBSERVATION_ENTRIES } from '@internal/registers/observation';
import { CONTENT_BATCHES } from '@internal/registers/batches';
import { WITHDRAWAL_ENTRIES } from '@internal/registers/withdrawals';
import { POSTCODE_PAIRS } from '@internal/registers/postcode-pairs';
import { ENTITY_BOUNDARY_DECISIONS } from '@internal/registers/entity-boundary-decisions';
import { EXCLUDED_METHODS } from '@internal/registers/excluded-methods';

/**
 * The internal register boundary.
 *
 * Requirements 3.12 and 7.8 say no register entry may appear on a public route,
 * in server-rendered public HTML or in a sitemap. A grep for leakage is a check;
 * a directory that cannot be imported is a guarantee. This file asserts the
 * guarantee three ways:
 *
 *  1. No file under `src/` names the `@internal` alias or walks up into
 *     `internal/` with a relative path.
 *  2. No module under `internal/registers/` appears in the transitive import
 *     closure of any registered public route, computed by resolving imports
 *     rather than by trusting the substring scan above.
 *  3. No register entry identifier appears in any public source file or in the
 *     served sitemap.
 *
 * The first two are structural and hold regardless of what the registers
 * contain. The third scans the live identifiers. Two registers now hold real
 * entries — the ten benchmark questions and the six excluded methods — so that
 * assertion has teeth; the rest are empty, which is the true state: no phrase has
 * been researched under a licensed tool, and no observation round has been taken
 * because no public URL exists to observe.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');
const APP = join(SRC, 'app');
const INTERNAL = join(ROOT, 'internal');

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full, extensions));
      continue;
    }
    if (extensions.some((extension) => entry.endsWith(extension))) out.push(full);
  }
  return out;
}

const srcFiles = collectFiles(SRC, SOURCE_EXTENSIONS);

/**
 * Any relative specifier that climbs out of its directory and lands on a path
 * segment named `internal`. `../internal/`, `../../internal/` and
 * `../../../internal/registers/x` all match.
 */
const RELATIVE_REACH_INTO_INTERNAL = /(?:\.\.\/)+(?:[\w.-]+\/)*internal\//;

describe('no file under src/ names the internal boundary', () => {
  it('scans every TypeScript file under src/', () => {
    // A scan that silently stopped covering the app cannot report success.
    expect(srcFiles.length).toBeGreaterThan(20);
    expect(srcFiles.some((file) => file.startsWith(APP + sep))).toBe(true);
  });

  it('contains no `@internal` alias reference', () => {
    const offenders = srcFiles
      .filter((file) => readFileSync(file, 'utf8').includes('@internal'))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('contains no relative path segment reaching internal/', () => {
    const offenders = srcFiles
      .filter((file) => RELATIVE_REACH_INTO_INTERNAL.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});

/**
 * Import extraction.
 *
 * Covers static `import`, `export ... from`, bare side-effect `import 'x'`,
 * dynamic `import('x')` and `require('x')`. Enough to follow the app's module
 * graph, which uses static ESM imports throughout.
 */
const SPECIFIER_PATTERNS: readonly RegExp[] = [
  /\bimport\s+(?:[\s\S]*?\bfrom\s*)?['"]([^'"]+)['"]/g,
  /\bexport\s+[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function extractSpecifiers(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of SPECIFIER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

/** Resolve a specifier to a file on disk, or null when it is a package. */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@internal/')) {
    base = join(INTERNAL, specifier.slice('@internal/'.length));
  } else if (specifier.startsWith('@/')) {
    base = join(SRC, specifier.slice('@/'.length));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    // A bare specifier is a package, not a file in this repository.
    return null;
  }

  const candidates = [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * The route file that serves a registered route path.
 *
 * Static paths map directly. A locality or guide route maps to its dynamic
 * segment file, because that is the module Next.js compiles for it.
 */
function routeEntryFile(routePath: string): string | null {
  const segments = routePath.split('/').filter((segment) => segment.length > 0);
  const direct = join(APP, ...segments, 'page.tsx');
  if (existsSync(direct)) return direct;

  if (segments.length >= 2) {
    const dynamic = join(APP, ...segments.slice(0, -1), '[slug]', 'page.tsx');
    if (existsSync(dynamic)) return dynamic;
  }
  return null;
}

/** Route modules that are not in the public route registry but are served. */
const ALWAYS_SERVED = [
  join(APP, 'layout.tsx'),
  join(APP, 'not-found.tsx'),
  join(APP, 'robots.ts'),
  join(APP, 'sitemap.xml', 'route.ts'),
  join(APP, 'api', 'enquiry', 'route.ts'),
];

const NOW = new Date('2026-09-29T00:00:00.000Z');

function publicSurfaceEntryFiles(): string[] {
  const registered = [
    ...STATIC_PUBLIC_ROUTES.map((route) => route.path),
    ...getPublicRoutes(NOW).map((route) => route.path),
    // The dynamic templates are compiled whether or not a record currently
    // passes the gate, so they are part of the surface either way.
    '/areas/any-slug',
    '/guides/any-slug',
  ];

  const files = new Set<string>();
  for (const routePath of registered) {
    const entry = routeEntryFile(routePath);
    if (entry) files.add(entry);
  }
  for (const file of ALWAYS_SERVED) {
    if (existsSync(file)) files.add(file);
  }
  return [...files];
}

function importClosure(entryFiles: readonly string[]): string[] {
  const visited = new Set<string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (visited.has(file)) continue;
    visited.add(file);
    const text = readFileSync(file, 'utf8');
    for (const specifier of extractSpecifiers(text)) {
      const resolved = resolveSpecifier(specifier, file);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return [...visited];
}

describe('transitive import closure of the public surface', () => {
  const entryFiles = publicSurfaceEntryFiles();
  const closure = importClosure(entryFiles);

  it('starts from every registered route module', () => {
    // If the entry set collapsed, the closure assertion below would pass while
    // proving nothing.
    expect(entryFiles.length).toBeGreaterThanOrEqual(STATIC_PUBLIC_ROUTES.length);
    expect(entryFiles).toContain(join(APP, 'page.tsx'));
    expect(entryFiles).toContain(join(APP, 'areas', '[slug]', 'page.tsx'));
    expect(entryFiles).toContain(join(APP, 'sitemap.xml', 'route.ts'));
  });

  it('follows imports rather than stopping at the route files', () => {
    expect(closure.length).toBeGreaterThan(entryFiles.length);
    expect(closure).toContain(join(SRC, 'config', 'localities.ts'));
    expect(closure).toContain(join(SRC, 'config', 'claims.ts'));
  });

  it('contains no module under internal/', () => {
    const offenders = closure
      .filter((file) => file.startsWith(INTERNAL + sep))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('contains no module under internal/registers/ in particular', () => {
    const registersDir = join(INTERNAL, 'registers');
    const registerModules = collectFiles(registersDir, SOURCE_EXTENSIONS);
    expect(registerModules.length).toBe(7);
    for (const module of registerModules) {
      expect(closure, `${relative(ROOT, module)} must stay outside the public surface`).not.toContain(
        module
      );
    }
  });
});

describe('register entry identifiers', () => {
  /**
   * Every register, resolved through the `@internal/*` alias. Importing them here
   * is also what proves the alias wiring works — the boundary is one-directional,
   * not a wall.
   */
  const registers = {
    'search-intent': SEARCH_INTENT_ENTRIES.map((entry) => entry.entryId),
    /**
     * An observation entry is identified by its round and its question — the
     * design gives it no separate identifier, because one entry *is* one
     * question sampled in one round against one tool. The benchmark question
     * identifiers are scanned too: those are seeded, so this assertion has teeth
     * today rather than only once a round has been taken.
     */
    observation: [
      ...OBSERVATION_ENTRIES.map((entry) => `${entry.roundId}/${entry.questionId}`),
      ...BENCHMARK_QUESTIONS.map((question) => question.questionId),
    ],
    batches: CONTENT_BATCHES.map((batch) => batch.batchId),
    withdrawals: WITHDRAWAL_ENTRIES.map((entry) => entry.recordId),
    'postcode-pairs': POSTCODE_PAIRS.map((pair) => pair.pairId),
    'entity-boundary-decisions': ENTITY_BOUNDARY_DECISIONS.map((decision) => decision.decisionId),
    'excluded-methods': EXCLUDED_METHODS.map((method) => method.methodId),
  } as const;

  const identifiers = Object.entries(registers).flatMap(([register, ids]) =>
    ids.map((id) => ({ register, id }))
  );

  it('resolves every register through the @internal alias', () => {
    expect(Object.keys(registers)).toHaveLength(7);
    for (const [register, ids] of Object.entries(registers)) {
      expect(Array.isArray(ids), `${register} must export a collection`).toBe(true);
    }
  });

  it('appears in no public source file', () => {
    const sources = srcFiles.map((file) => ({
      path: relative(ROOT, file),
      text: readFileSync(file, 'utf8'),
    }));
    const leaks = identifiers.flatMap(({ register, id }) =>
      sources
        .filter((source) => source.text.includes(id))
        .map((source) => `${register}:${id} in ${source.path}`)
    );
    expect(leaks).toEqual([]);
  });

  it('appears in no served sitemap', async () => {
    process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
    process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
    process.env.INSTLE_DEPLOY_ENV = 'production';

    const response = await sitemapRoute();
    expect(response.status).toBe(200);
    const body = await response.text();

    const leaks = identifiers
      .filter(({ id }) => body.includes(id))
      .map(({ register, id }) => `${register}:${id}`);
    expect(leaks).toEqual([]);
  });
});
