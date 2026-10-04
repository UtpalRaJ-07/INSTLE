import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';

import {
  ROOT,
  collectPublicSurfaceFiles,
  computePublicSurfaceClosure,
  evaluateScanCoverage,
  isPublicSurfaceFile,
  publicRouteEntryFiles,
  readImportedFile,
  resolveLocalImport,
  walkImportClosure,
} from '../helpers/public-surface';
import {
  PROPERTY_RUN_CONFIG,
  arbImportGraph,
  arbProperSubsetOf,
  arbSubsetOf,
  type GeneratedImportGraph,
} from './arbitraries';

/**
 * Writing and walking a hundred generated module graphs is real file work, and it does
 * not fit vitest's five-second default once the rest of the suite is competing for the
 * same cores. The budget is stated per test, as
 * `gate-failing-leaks-nothing.property.test.tsx` states it. Fewer iterations or smaller
 * graphs would buy the speed by sampling less of the space the property is about.
 */
const PROPERTY_TIMEOUT_MS = 300_000;

/**
 * **Property 13: The policy scan covers the whole public surface, and a shrunken scan
 * cannot pass.**
 *
 * *For any* source tree, the set of files the policy scan reads is a superset of the
 * transitive import closure of every file rendering a registered public route, excludes
 * prototype components and components no registered route imports, and when the scanned
 * set is smaller than that closure the scan fails reporting both the scanned count and
 * the expected count together with each missing file.
 *
 * **Validates: Requirements 12.13, 12.15**
 *
 * This is the property that keeps the other fourteen honest. Every content rule in the
 * suite is an assertion that a scan found nothing, and "found nothing" is what a broken
 * scan says too. Requirement 12.15 is the answer — a scan smaller than the surface
 * fails — and the only way to know the answer works is to hand it scans that are too
 * small and require each one to fail, naming what it missed.
 *
 * Two halves, because the floor has two halves:
 *
 *  - **The walk.** Generated module graphs are written to a scratch directory outside
 *    the repository and walked with the real `walkImportClosure`. Cycles, imports that
 *    resolve to nothing and prototype folders are all generated, and the reached set is
 *    compared against reachability computed independently. Dropping a seed or an import
 *    must shrink the reached set by exactly the modules that lost their last path.
 *  - **The measurement.** Generated subsets of the real floor are put through
 *    `evaluateScanCoverage`, the function the policy suite reports with. A subset must
 *    fail and name every file it dropped, including the case that defeats a count
 *    comparison: a scan that reads the right number of the wrong files.
 */

// ---------------------------------------------------------------------------
// Reachability, computed independently of the walker
// ---------------------------------------------------------------------------

/** Every node reachable from `seeds` along `edges`, seeds included, accepted only. */
function reachable(
  seeds: readonly string[],
  edges: readonly (readonly [string, string])[],
  accept: (node: string) => boolean
): Set<string> {
  const out = new Set<string>();
  const queue = seeds.filter(accept);
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (out.has(node)) continue;
    out.add(node);
    for (const [from, to] of edges) {
      if (from === node && accept(to)) queue.push(to);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Half one: the walk, over generated graphs
// ---------------------------------------------------------------------------

const scratchRoot = mkdtempSync(join(tmpdir(), 'instle-import-graph-'));
let scratchRun = 0;

afterAll(() => {
  rmSync(scratchRoot, { recursive: true, force: true });
});

interface WrittenGraph {
  readonly dir: string;
  /** Absolute path of each module the graph defines. */
  readonly fileOf: (module: string) => string;
  readonly seedFiles: readonly string[];
  /** Absolute-path edges, including edges to a module the graph does not define. */
  readonly edges: readonly (readonly [string, string])[];
  readonly definedFiles: readonly string[];
}

/** Write a generated graph to a fresh scratch directory as real TypeScript files. */
function writeGraph(graph: GeneratedImportGraph, omitEdge: readonly [string, string] | null = null): WrittenGraph {
  scratchRun += 1;
  const dir = join(scratchRoot, `run-${scratchRun}`);
  const fileOf = (module: string) => join(dir, `${module}.ts`);
  const defined = [...graph.modules, ...graph.prototypes];
  const kept = graph.edges.filter((edge) => !(omitEdge && edge[0] === omitEdge[0] && edge[1] === omitEdge[1]));

  for (const module of defined) {
    const specifiers = kept
      .filter(([from]) => from === module)
      .map(([, to]) => {
        // A relative specifier from this module's directory to the imported module.
        const target = fileOf(to);
        const rel = relative(dirname(fileOf(module)), target).split(sep).join('/').replace(/\.ts$/, '');
        return rel.startsWith('.') ? rel : `./${rel}`;
      });
    const body = [
      ...specifiers.map((specifier) => `import '${specifier}';`),
      `export const ${module.replace(/[^a-zA-Z0-9]/g, '_')} = true;`,
      '',
    ].join('\n');
    mkdirSync(dirname(fileOf(module)), { recursive: true });
    writeFileSync(fileOf(module), body, 'utf8');
  }

  return {
    dir,
    fileOf,
    seedFiles: graph.seeds.map(fileOf),
    edges: kept.map(([from, to]) => [fileOf(from), fileOf(to)] as const),
    definedFiles: defined.map(fileOf),
  };
}

/** The prototype exclusion, in the shape `walkImportClosure` takes it. */
const acceptsNoPrototype = (file: string) => !file.includes(`${sep}Concept1${sep}`);

function walked(seeds: readonly string[]): { files: string[]; unresolved: string[] } {
  const closure = walkImportClosure(seeds, { accept: acceptsNoPrototype });
  return { files: closure.files.map((scanned) => scanned.file).sort(), unresolved: [...closure.unresolved] };
}

/** Reachability over the written graph, restricted to modules the graph defines. */
function expectedFiles(written: WrittenGraph, seeds: readonly string[]): string[] {
  const defined = new Set(written.definedFiles);
  return [...reachable(seeds, written.edges, (file) => defined.has(file) && acceptsNoPrototype(file))].sort();
}

describe('Property 13: the derived floor is the import closure of the route files', () => {
  it('reaches exactly what is reachable from the seeds, cycles and all', () => {
    fc.assert(
      fc.property(arbImportGraph, (graph) => {
        const written = writeGraph(graph);
        const { files } = walked(written.seedFiles);
        expect(files).toEqual(expectedFiles(written, written.seedFiles));
        // The seeds are in the floor, and nothing outside the graph is.
        for (const seed of written.seedFiles) expect(files).toContain(seed);
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('never enters a prototype folder, however many files import it', () => {
    fc.assert(
      fc.property(
        arbImportGraph.filter((graph) => graph.prototypes.length > 0),
        (graph) => {
          const written = writeGraph(graph);
          const { files } = walked(written.seedFiles);
          expect(files.filter((file) => file.includes(`${sep}Concept1${sep}`))).toEqual([]);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('names an import that resolves to nothing rather than dropping it quietly', () => {
    fc.assert(
      fc.property(
        arbImportGraph.filter((graph) => graph.edges.some(([, to]) => to === 'absent-module')),
        (graph) => {
          const written = writeGraph(graph);
          const { files, unresolved } = walked(written.seedFiles);
          const reachedImporters = graph.edges
            .filter(([from, to]) => to === 'absent-module' && files.includes(written.fileOf(from)))
            .map(([from]) => written.fileOf(from));
          if (reachedImporters.length === 0) return;
          expect(unresolved.length).toBeGreaterThan(0);
          expect(unresolved.every((line) => line.includes('absent-module'))).toBe(true);
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('shrinks by exactly the modules that lose their last path when a seed is dropped', () => {
    fc.assert(
      fc.property(
        arbImportGraph.filter((graph) => graph.seeds.length >= 2),
        fc.integer({ min: 0, max: 2 }),
        (graph, offset) => {
          const written = writeGraph(graph);
          const dropped = written.seedFiles[offset % written.seedFiles.length]!;
          const remaining = written.seedFiles.filter((seed) => seed !== dropped);

          const full = walked(written.seedFiles).files;
          const smaller = walked(remaining).files;

          // A floor can only shrink when a seed goes, and it shrinks to exactly what
          // the remaining seeds still reach.
          expect(smaller.every((file) => full.includes(file))).toBe(true);
          expect(smaller).toEqual(expectedFiles(written, remaining));
          // And the scan measured against the unchanged floor now fails, naming the gap.
          const coverage = evaluateScanCoverage(smaller, full);
          if (smaller.length < full.length) {
            expect(coverage.ok).toBe(false);
            for (const file of full.filter((candidate) => !smaller.includes(candidate))) {
              expect(coverage.report).toContain(relative(ROOT, file));
            }
          } else {
            expect(coverage.ok).toBe(true);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('shrinks by exactly the modules that lose their last path when an import is dropped', () => {
    fc.assert(
      fc.property(
        arbImportGraph.filter((graph) => graph.edges.some(([, to]) => to !== 'absent-module')),
        fc.integer({ min: 0, max: 19 }),
        (graph, offset) => {
          const candidates = graph.edges.filter(([, to]) => to !== 'absent-module');
          const edge = candidates[offset % candidates.length]!;

          const withEdge = writeGraph(graph);
          const withoutEdge = writeGraph(graph, edge);

          const full = walked(withEdge.seedFiles).files.map((file) => relative(withEdge.dir, file)).sort();
          const smaller = walked(withoutEdge.seedFiles).files
            .map((file) => relative(withoutEdge.dir, file))
            .sort();

          expect(smaller.every((file) => full.includes(file))).toBe(true);
          expect(smaller).toEqual(
            expectedFiles(withoutEdge, withoutEdge.seedFiles).map((file) => relative(withoutEdge.dir, file)).sort()
          );

          // The imported module leaves the floor when nothing else reachable imports it
          // and it is no seed itself: an import removed is a file no longer covered.
          const importedRel = `${edge[1]}.ts`;
          const otherImporters = graph.edges.filter(
            ([from, to]) => to === edge[1] && !(from === edge[0] && to === edge[1])
          );
          const stillImported = otherImporters.some(([from]) => smaller.includes(`${from}.ts`));
          if (!stillImported && !graph.seeds.includes(edge[1]) && full.includes(importedRel)) {
            expect(smaller).not.toContain(importedRel);
          }
        }
      ),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);
});

// ---------------------------------------------------------------------------
// Half two: the measurement, over the real floor
// ---------------------------------------------------------------------------

describe('Property 13: a shrunken scan cannot pass', () => {
  const floor = computePublicSurfaceClosure();
  const scanned = collectPublicSurfaceFiles(['.tsx', '.ts']);

  it('measures against a floor derived from the tree, not a constant', () => {
    // Both ends: the floor is real work, and it is not the whole of `src/` either.
    expect(floor.length).toBeGreaterThan(40);
    expect(floor.length).toBeLessThanOrEqual(scanned.length);
    expect(floor).toContain(join(ROOT, 'src', 'app', 'layout.tsx'));
    expect(floor).toContain(join(ROOT, 'src', 'app', 'page.tsx'));
    expect(floor.every(isPublicSurfaceFile)).toBe(true);
  });

  it('passes only because the scan is a superset of the floor', () => {
    const coverage = evaluateScanCoverage(scanned, floor);
    expect(coverage.missing, coverage.report).toEqual([]);
    expect(coverage.ok).toBe(true);
    expect(coverage.expectedCount).toBe(floor.length);
  });

  it('fails any proper subset of the floor, naming every file it dropped', () => {
    fc.assert(
      fc.property(arbProperSubsetOf(floor), (shrunken) => {
        const coverage = evaluateScanCoverage(shrunken, floor);
        const dropped = floor.filter((file) => !shrunken.includes(file)).map((file) => relative(ROOT, file));

        expect(coverage.ok, `a scan of ${shrunken.length} of ${floor.length} files passed`).toBe(false);
        expect(coverage.missing.slice().sort()).toEqual(dropped.slice().sort());
        expect(coverage.scannedCount).toBe(shrunken.length);
        expect(coverage.expectedCount).toBe(floor.length);
        // Requirement 12.15: both counts, and each missing file.
        expect(coverage.report).toContain(String(shrunken.length));
        expect(coverage.report).toContain(String(floor.length));
        for (const file of dropped) expect(coverage.report).toContain(file);
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('fails a scan that reads the right number of the wrong files', () => {
    // The case a count comparison cannot see, and the reason coverage is computed by
    // identity: swap files out of the floor for files outside it and the total is
    // unchanged while the surface is no longer covered.
    const outside = scanned.filter((file) => !floor.includes(file));
    expect(outside.length, 'no file outside the floor to substitute').toBeGreaterThan(0);

    fc.assert(
      fc.property(fc.integer({ min: 1, max: Math.min(outside.length, 8) }), (swapCount) => {
        const substituted = [...floor.slice(swapCount), ...outside.slice(0, swapCount)];
        expect(substituted.length).toBe(floor.length);

        const coverage = evaluateScanCoverage(substituted, floor);
        expect(coverage.ok, 'a scan of the right size but the wrong files passed').toBe(false);
        expect(coverage.scannedCount).toBe(coverage.expectedCount);
        expect(coverage.missing.length).toBe(swapCount);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('fails an empty scan, which is the shape a broken scan takes', () => {
    const coverage = evaluateScanCoverage([], floor);
    expect(coverage.ok).toBe(false);
    expect(coverage.scannedCount).toBe(0);
    expect(coverage.missing.length).toBe(floor.length);
  });

  it('passes a scan that reads the floor and more, because the surface is the floor or wider', () => {
    fc.assert(
      fc.property(arbSubsetOf(scanned.filter((file) => !floor.includes(file))), (extra) => {
        const coverage = evaluateScanCoverage([...floor, ...extra], floor);
        expect(coverage.ok, coverage.report).toBe(true);
        expect(coverage.missing).toEqual([]);
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// What the floor leaves out, and why
// ---------------------------------------------------------------------------

describe('Property 13: the floor excludes prototypes and modules no route imports', () => {
  const floor = computePublicSurfaceClosure();
  const scanned = collectPublicSurfaceFiles(['.tsx', '.ts']);
  const outside = scanned.filter((file) => !floor.includes(file));

  it('starts from the files a route is served from', () => {
    const seeds = publicRouteEntryFiles();
    expect(seeds.length).toBeGreaterThan(10);
    expect(seeds.every((seed) => floor.includes(seed))).toBe(true);
  });

  it('excludes every prototype and preview module', () => {
    for (const fragment of ['Concept1', 'Concept2', 'concept-1', 'concept-2', 'internal-preview']) {
      expect(floor.filter((file) => file.includes(fragment)), fragment).toEqual([]);
    }
  });

  /**
   * What the floor reaches, resolved once. Reading the floor again for every sampled
   * file would be a hundred times the work for the same answer, and the answer does
   * not change between runs: the tree is read from disk, not generated.
   */
  const reachedFromFloor = new Map<string, string[]>();
  for (const file of floor) {
    for (const specifier of readImportedFile(file).localSpecifiers) {
      const resolved = resolveLocalImport(file, specifier);
      if (!resolved) continue;
      reachedFromFloor.set(resolved, [...(reachedFromFloor.get(resolved) ?? []), file]);
    }
  }

  it('excludes a module only when nothing in the floor imports it', () => {
    fc.assert(
      fc.property(arbSubsetOf(outside, 0), (sample) => {
        for (const file of sample) {
          const importers = (reachedFromFloor.get(file) ?? []).map((importer) => relative(ROOT, importer));
          expect(
            importers,
            `${relative(ROOT, file)} is outside the floor while a file in the floor imports it`
          ).toEqual([]);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});
