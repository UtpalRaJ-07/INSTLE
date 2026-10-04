#!/usr/bin/env node
/**
 * Print the observation section of the progress report.
 *
 * Requirements 7.9 and 7.12. The renderer itself lives in
 * `internal/reporting/observation-report.ts`, beside the register it reads: no file
 * under `src/` may reach `internal/`, so the reporting side of the observation panel
 * is a script and a module rather than a page and a component. This file is the
 * bridge the design describes — it loads the TypeScript module through the shared
 * resolution hook and writes the section to stdout, so the progress report can
 * include it without either side crossing the register boundary.
 *
 * Usage:
 *   node scripts/render-observation-report.mjs           # the markdown section
 *   node scripts/render-observation-report.mjs --json     # the same counts as data
 *
 * Today it prints the empty state: zero rounds are recorded, because observation
 * recording has not begun while no public URL exists to observe. The section says
 * that, names the register entry that starts it, and reports no figure.
 */
import { registerTypeScriptResolution } from './lib/ts-module-loader.mjs';

registerTypeScriptResolution();

const { buildObservationReport, renderObservationReport } = await import(
  '@internal/reporting/observation-report'
);

const asJson = process.argv.includes('--json');

if (asJson) {
  process.stdout.write(`${JSON.stringify(buildObservationReport(), null, 2)}\n`);
} else {
  process.stdout.write(renderObservationReport());
}
