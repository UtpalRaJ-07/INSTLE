import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import ts from 'typescript';

/**
 * The public surface: the source files that render a page a customer can reach.
 *
 * One enumeration, shared by every static scan of the public surface, so that two
 * policy suites cannot disagree about what "a public page" is. It is `src/` less
 * the fragments below.
 *
 * The prototype components under Concept1/ and Concept2/ are excluded, because
 * those routes are noindex and return 404 in a production deployment — they are
 * design material, not published content.
 *
 * The scan reads source rather than rendered HTML, so it is a guard rather than
 * proof. Rendered output is checked separately in the manual review log.
 */

export const ROOT = join(__dirname, '..', '..');
export const SRC = join(ROOT, 'src');

export const EXCLUDED_PATH_FRAGMENTS: readonly string[] = [
  /**
   * The Requirement 11.8 preview surface. Not public: it 404s in a production
   * deployment, carries `noindex`, is absent from `getPublicRoutes` and so from the
   * sitemap and `llms.txt`, and no public page links to it. It renders draft text and
   * internal blocking notes on purpose, which is exactly why it is outside the
   * surface Requirement 12.13 defines as "every source file that renders a registered
   * public route".
   */
  `${sep}internal-preview${sep}`,
  `${sep}Concept1${sep}`,
  `${sep}Concept2${sep}`,
  `${sep}ConceptSwitcher${sep}`,
  `${sep}concept-1${sep}`,
  `${sep}concept-2${sep}`,
  `${sep}concept-review${sep}`,
  // Legacy components that are not imported by any public route. Kept in the tree
  // because the Git state could not be verified, but not part of public output.
  `${sep}IntentRail${sep}`,
  `${sep}ProcessSteps${sep}`,
  `${sep}ContactBand${sep}`,
  `${sep}OwnerSection${sep}`,
  `${sep}OwnerIntake${sep}`,
  `${sep}RentalIntake${sep}`,
  `${sep}ArchitecturalGraphic${sep}`,
];

export function collectFiles(dir: string, extensions: readonly string[]): string[] {
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

export function isPublicSurfaceFile(file: string): boolean {
  return file.startsWith(SRC) && !EXCLUDED_PATH_FRAGMENTS.some((fragment) => file.includes(fragment));
}

/** Every public-surface file under `src/` with one of `extensions`. */
export function collectPublicSurfaceFiles(extensions: readonly string[] = ['.tsx', '.ts']): string[] {
  return collectFiles(SRC, extensions).filter(isPublicSurfaceFile);
}

/**
 * Remove comments before scanning. A comment explaining *why* a phrase is banned
 * is not public output, and treating it as a violation would make the guard
 * unusable. URL protocol slashes are protected so `https://` survives.
 */
export function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (_match, prefix: string) => prefix);
}

/**
 * `stripComments`, by file type. CSS has block comments only, so `//` in a
 * stylesheet is left alone — stripping it as a line comment would hide whatever
 * followed it, such as the rest of a `url(//host/…)`.
 */
export function stripCommentsFor(file: string, text: string): string {
  return file.endsWith('.css') ? text.replace(/\/\*[\s\S]*?\*\//g, ' ') : stripComments(text);
}

// ---------------------------------------------------------------------------
// Following imports — one walker, shared
// ---------------------------------------------------------------------------

/**
 * The import graph of the public surface.
 *
 * Two questions are asked of it, and they are not the same question:
 *
 *  - *What does a public file reach?* — `walkImportClosure` seeded with the whole
 *    enumeration above. `tests/visual-identity.test.tsx` asks this, because an
 *    image is a violation wherever a public file reaches it, whichever folder it
 *    was reached from.
 *  - *What must a scan of the public surface cover?* — `computePublicSurfaceClosure`,
 *    seeded with the route files alone. Requirement 12.13 defines the public
 *    surface as "every source file that renders a registered public route,
 *    excluding prototype components and components imported by no registered
 *    public route", and Requirement 12.15 fails a scan that reads fewer files than
 *    that. Seeded from the routes, the closure *is* that set: a component no
 *    registered route imports is never reached, so it never enters the floor.
 *
 * Both are the same walk over the same resolver, so the two cannot disagree about
 * what an import resolves to. Writing a second walker was the alternative, and a
 * second walker is how a scan quietly stops seeing a folder.
 */

/** The module specifiers a file imports, `@import` included for stylesheets. */
export function importSpecifiersOf(file: string, raw: string): string[] {
  if (file.endsWith('.css')) {
    return [...stripCommentsFor(file, raw).matchAll(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)].map(
      (match) => match[1]!
    );
  }
  return ts.preProcessFile(raw, true, true).importedFiles.map((reference) => reference.fileName);
}

/** True for a specifier naming a file in this repository rather than a package. */
export function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith('@/') || specifier.startsWith('.');
}

/**
 * The file a local specifier resolves to, or `null` when nothing is there.
 *
 * `@/x` is `src/x`; `./x` and `../x` are relative to the importing file. The
 * candidate order is the one `tsconfig.json` and the bundler use: the path as
 * written, then `.tsx`/`.ts`, then a directory's `index`.
 */
export function resolveLocalImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? join(dirname(from), specifier)
      : null;
  if (!base) return null;
  const candidates = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

export interface ImportedFile {
  /** Absolute path. */
  readonly file: string;
  /** Repository-relative path, for an assertion message. */
  readonly path: string;
  /** The file's text, without comments. */
  readonly text: string;
  /** Packages imported, such as `next/image`. */
  readonly packages: readonly string[];
  /** Local specifiers, as written. */
  readonly localSpecifiers: readonly string[];
}

export interface ImportClosure {
  readonly files: readonly ImportedFile[];
  /** `<file> imports <specifier>` for every local specifier that resolved to nothing. */
  readonly unresolved: readonly string[];
}

export function readImportedFile(file: string): ImportedFile {
  const raw = readFileSync(file, 'utf8');
  const packages: string[] = [];
  const localSpecifiers: string[] = [];
  for (const specifier of importSpecifiersOf(file, raw)) {
    if (isLocalSpecifier(specifier)) localSpecifiers.push(specifier);
    else packages.push(specifier);
  }
  return { file, path: relative(ROOT, file), text: stripCommentsFor(file, raw), packages, localSpecifiers };
}

export interface WalkOptions {
  /** Drop a reached file rather than walking it. Prototype folders, say. */
  readonly accept?: (file: string) => boolean;
}

/** Every file reachable from `seeds` by following local imports, seeds included. */
export function walkImportClosure(seeds: readonly string[], options: WalkOptions = {}): ImportClosure {
  const accept = options.accept ?? (() => true);
  const queue = seeds.filter(accept);
  const seen = new Set<string>();
  const files: ImportedFile[] = [];
  const unresolved: string[] = [];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const scanned = readImportedFile(file);
    files.push(scanned);
    for (const specifier of scanned.localSpecifiers) {
      const resolved = resolveLocalImport(file, specifier);
      if (!resolved) {
        unresolved.push(`${scanned.path} imports ${specifier}`);
        continue;
      }
      if (accept(resolved)) queue.push(resolved);
    }
  }
  return { files, unresolved };
}

/**
 * The files that register a public route: every `page.tsx` and `route.ts` a route
 * is served from, plus every `layout.tsx` wrapping one.
 *
 * Layouts are taken from the tree rather than from `enumerateRegisteredRoutes`,
 * which enumerates what answers at a URL. A layout answers at none, and yet it
 * renders on every page beneath it, so it seeds the closure too.
 */
export function publicRouteEntryFiles(): string[] {
  const appDir = join(SRC, 'app');
  const entries = collectFiles(appDir, ['.tsx', '.ts']).filter((file) => {
    const name = basename(file);
    return /^(page|route|layout)\.(tsx|ts)$/.test(name);
  });
  // A private `_folder` is not routable, and a prototype route is not published.
  return entries.filter((file) => !file.split(sep).some((part) => part.startsWith('_'))).filter(isPublicSurfaceFile);
}

/**
 * Requirement 12.13's public surface, derived: the transitive import closure of
 * every file rendering a registered public route, less the prototype folders.
 *
 * This is the floor Requirement 12.15 measures a scan against. It is derived from
 * the tree on every run, so a new page — or a new component an existing page
 * imports — raises the floor by itself, and a scan that stops reaching a file
 * fails naming it rather than passing on a smaller set.
 */
export function computePublicSurfaceClosure(): readonly string[] {
  const closure = walkImportClosure(publicRouteEntryFiles(), { accept: isPublicSurfaceFile });
  return closure.files
    .map((scanned) => scanned.file)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .sort();
}
// ---------------------------------------------------------------------------
// Coverage of the floor — Requirement 12.15
// ---------------------------------------------------------------------------

export interface ScanCoverage {
  /** True only when every file in the floor was read. */
  readonly ok: boolean;
  readonly scannedCount: number;
  readonly expectedCount: number;
  /** Repository-relative paths of the files in the floor the scan did not read. */
  readonly missing: readonly string[];
  /** The assertion message: both counts together with each missing file. */
  readonly report: string;
}

/**
 * Requirement 12.15, as a function: a scan that read fewer files than the floor
 * fails, reporting the scanned count, the expected count and each missing file.
 *
 * Taken as arguments rather than reading the tree, so the same arithmetic is used by
 * the policy suite over the real scan and by Property 13 over a deliberately
 * shrunken one. A count comparison alone would pass a scan that read the right
 * *number* of the wrong files, so the missing set is computed by identity and the
 * count is reported beside it.
 */
export function evaluateScanCoverage(
  scanned: readonly string[],
  expected: readonly string[]
): ScanCoverage {
  const read = new Set(scanned);
  const missing = expected.filter((file) => !read.has(file)).map((file) => relative(ROOT, file));
  const scannedCount = new Set(scanned).size;
  const expectedCount = new Set(expected).size;
  const report =
    missing.length === 0 && scannedCount >= expectedCount
      ? `scanned ${scannedCount} files, covering all ${expectedCount} that render a registered public route`
      : `the scan read ${scannedCount} of the ${expectedCount} files that render a registered public route; ` +
        `${missing.length} were missed:\n${missing.map((file) => `  - ${file}`).join('\n')}`;
  return { ok: missing.length === 0 && scannedCount >= expectedCount, scannedCount, expectedCount, missing, report };
}
