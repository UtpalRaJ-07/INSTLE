import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { evaluateClaim } from '@/config/claims';
import { PERMITTED_TYPES, auditGraph, findHostname } from '@/lib/structured-data-policy';
import {
  GRAPH_NODE_TYPES,
  GRAPH_VIOLATION_KINDS,
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbAuditableGraph,
  arbClaimRecord,
  arbIsoDate,
  arbSlug,
  arbSourceRecord,
  graphViolationsFor,
} from './arbitraries';

/**
 * Generator contracts, and the iteration floor.
 *
 * This is not one of the sixteen correctness properties. It checks the
 * generators themselves, because a property test is only as good as the space it
 * samples: a slug generator that emits `%20`, a date generator that emits
 * `Invalid Date`, or a claim generator that never produces a passing record would
 * each make a downstream property look strong while proving very little.
 *
 * The second describe block enforces the design's configuration rule — every
 * property test runs a minimum of 100 iterations — as an assertion rather than a
 * convention, so a file added later cannot quietly sample ten cases.
 */

describe('shared generator contracts', () => {
  it('emits real calendar dates as YYYY-MM-DD', () => {
    fc.assert(
      fc.property(arbIsoDate, (value) => {
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        const parsed = new Date(`${value}T00:00:00.000Z`);
        expect(Number.isNaN(parsed.getTime())).toBe(false);
        // A round trip proves the date exists: 2026-02-30 would not survive it.
        expect(parsed.toISOString().slice(0, 10)).toBe(value);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('emits canonical slug shapes only', () => {
    fc.assert(
      fc.property(arbSlug, (slug) => {
        expect(slug).toMatch(/^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*$/);
        expect(slug.length).toBeLessThanOrEqual(100);
        expect(slug).toBe(encodeURIComponent(slug));
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('emits sources whose reference is either specific or absent, never invented', () => {
    fc.assert(
      fc.property(arbSourceRecord, (source) => {
        expect(source.publisher.length).toBeGreaterThan(0);
        expect(['unknown', 'reference-only', 'quotation-permitted']).toContain(source.reuseRights);
        if (source.exactUrl !== null) {
          expect(() => new URL(source.exactUrl as string)).not.toThrow();
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('emits claims on both sides of the claim gate', () => {
    const outcomes = fc.sample(arbClaimRecord, 200).map((claim) => {
      const evaluation = evaluateClaim(claim, PROPERTY_NOW);
      return evaluation.eligible;
    });

    // Both branches must be reachable, or a property using this generator would
    // only ever test one of them.
    expect(outcomes).toContain(true);
    expect(outcomes).toContain(false);
  });

  it('names a reason for every claim it rejects', () => {
    fc.assert(
      fc.property(arbClaimRecord, (claim) => {
        const evaluation = evaluateClaim(claim, PROPERTY_NOW);
        expect(evaluation.claimId).toBe(claim.claimId);
        expect(evaluation.eligible).toBe(evaluation.failures.length === 0);
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  /**
   * The structured data generator, task 13.5. Three contracts, because Property 14
   * is an equality between the audit's verdict and a recorded expectation, and an
   * equality is only worth asserting when both sides are reachable:
   *
   *  - a clean graph really is clean — every value visible, no hostname anywhere —
   *    so the admissible branch is exercised rather than asserted;
   *  - every one of the thirteen violations is reached, and both root shapes, so no
   *    rule of the policy goes undriven;
   *  - the phrase the injections use for "absent from the page" is genuinely absent.
   */
  it('emits graphs on both sides of the structured data audit', () => {
    const graphs = fc.sample(arbAuditableGraph, { ...PROPERTY_RUN_CONFIG, seed: 14 });
    const verdicts = graphs.map((generated) => auditGraph(generated.graph, generated.visibleText).ok);
    expect(verdicts, 'no generated graph is admissible').toContain(true);
    expect(verdicts, 'no generated graph is inadmissible').toContain(false);
  });

  it('reaches every recorded violation and both root shapes', () => {
    const graphs = fc.sample(arbAuditableGraph, { ...PROPERTY_RUN_CONFIG, seed: 14 });
    const reached = new Set(graphs.map((generated) => generated.violation));
    const unreached = GRAPH_VIOLATION_KINDS.filter((kind) => !reached.has(kind));
    expect(unreached, 'a recorded violation is never generated').toEqual([]);
    expect(new Set(graphs.map((generated) => generated.rootForm))).toEqual(new Set(['graph', 'node']));
    // The one violation a single-node root cannot express, and nothing more.
    expect(graphViolationsFor('node')).not.toContain('nested-type-as-node');
    expect(graphViolationsFor('node')).toHaveLength(GRAPH_VIOLATION_KINDS.length - 1);
  });

  it('builds clean graphs from permitted types, visible values and no hostname', () => {
    fc.assert(
      fc.property(arbAuditableGraph, (generated) => {
        // The page never shows the phrase the injections use for "absent".
        expect(generated.visibleText).not.toContain(generated.phrases.unseen);

        if (generated.violation !== 'none') return;
        const audit = auditGraph(generated.graph, generated.visibleText, { domainConfirmed: false });
        expect(audit.failures, `a clean ${generated.rootForm} graph must be admissible`).toEqual([]);
        for (const kind of generated.nodeKinds) {
          expect(PERMITTED_TYPES as readonly string[]).toContain(GRAPH_NODE_TYPES[kind]);
        }
        // No clean value carries a hostname, so the unconfirmed state is not what
        // makes a clean graph pass.
        const values = JSON.stringify(generated.graph['@graph'] ?? generated.graph);
        expect(findHostname(values.replace(/https:\/\/schema\.org/g, '')), values).toBeNull();
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

describe('property suite configuration', () => {
  const ROOT = resolve(__dirname, '..', '..');
  const PROPERTIES_DIR = __dirname;

  function collectTestFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...collectTestFiles(full));
        continue;
      }
      if (entry.endsWith('.test.ts')) out.push(full);
    }
    return out;
  }

  const testFiles = collectTestFiles(PROPERTIES_DIR);

  it('runs every property test at 100 iterations or more', () => {
    const offenders: string[] = [];

    for (const file of testFiles) {
      const text = readFileSync(file, 'utf8');
      const path = relative(ROOT, file);
      const assertions = [...text.matchAll(/fc\.assert\(/g)];
      if (assertions.length === 0) continue;

      // Either the shared config, or an explicit numRuns of at least 100.
      const usesSharedConfig = [...text.matchAll(/PROPERTY_RUN_CONFIG/g)].length > 0;
      const explicitRuns = [...text.matchAll(/numRuns:\s*(\d+)/g)].map((match) =>
        Number(match[1])
      );

      const covered = usesSharedConfig
        ? assertions.length
        : explicitRuns.filter((runs) => runs >= 100).length;

      if (covered < assertions.length) {
        offenders.push(
          `${path}: ${assertions.length} fc.assert call(s), ${covered} covered at 100 iterations or more`
        );
      }
      for (const runs of explicitRuns) {
        if (runs < 100) offenders.push(`${path}: numRuns ${runs} is below the 100-iteration floor`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the shared iteration floor at 100', () => {
    expect(PROPERTY_RUN_CONFIG.numRuns).toBeGreaterThanOrEqual(100);
  });

  it('is actually collected by the vitest include globs', () => {
    // This file running at all is the proof; the assertion records what it proves.
    expect(testFiles).toContain(join(PROPERTIES_DIR, 'arbitraries.test.ts'));
  });
});
