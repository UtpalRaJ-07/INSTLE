#!/usr/bin/env node
/**
 * Bring the persisted publication status back into agreement with the runtime gate.
 *
 * Requirements 1.12, 4.13, 11.6, 11.7, 11.9 and 11.12.
 *
 * The runtime gate already protects readers. `/areas/[slug]` and `/guides/[slug]`
 * both call the gate with the request date, so a record whose evidence went stale
 * overnight 404s on the next request whether or not this script ever runs. What this
 * script does is make the *stored* state say the same thing, and record what left
 * the site:
 *
 *   1. flips `publicationStatus` to `unpublished` for every record the gate rejects;
 *   2. writes a withdrawal entry carrying the record identifier, **every** gate
 *      failure string, the withdrawal date and every route removed;
 *   3. returns a record to `fact_review` when its `contentUpdatedAt` is later than
 *      any of its three approvals, because those approvals approved earlier text.
 *
 * **It deletes nothing.** Not a record, not a section, not a reviewer, not an
 * approval timestamp, not an earlier withdrawal entry. A withdrawal is a status flip
 * plus an append; the record stays complete so returning the page later is a review
 * rather than a rewrite. `tests/publication-sync.test.ts` asserts that this file
 * contains no deletion call at all.
 *
 * Usage:
 *   node scripts/sync-publication-status.mjs            # report the plan, write nothing
 *   node scripts/sync-publication-status.mjs --apply    # perform the edits
 *   node scripts/sync-publication-status.mjs --json     # machine-readable plan
 *
 * Reporting is the default because the edits touch typed source files. A run that
 * finds nothing to do exits 0 and says so, which is the expected outcome today: no
 * record carries a published status the gate disagrees with.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { registerTypeScriptResolution, REPOSITORY_ROOT } from './lib/ts-module-loader.mjs';

registerTypeScriptResolution();

const { GUIDE_REGISTRY } = await import('@/config/guides');
const { LOCALITY_REGISTRY } = await import('@/config/localities');
const { planPublicationSync } = await import('@/config/publication-sync');
const { createWithdrawalEntry, validateWithdrawalEntry } = await import(
  '@internal/registers/withdrawals'
);

const WITHDRAWALS_FILE = join(REPOSITORY_ROOT, 'internal', 'registers', 'withdrawals.ts');
const START_MARKER = '/* SYNC-MANAGED ENTRIES START */';
const END_MARKER = '/* SYNC-MANAGED ENTRIES END */';

/**
 * Where a record's literal lives.
 *
 * The hand-written records sit in the two registry modules; the seeded ones sit in
 * the generated per-group and per-intent files. The script searches the candidates
 * for the record's identifier rather than being told, so adding a registry file does
 * not require editing this list beyond the directory it lives in.
 */
const LOCALITY_SOURCE_FILES = [
  join(REPOSITORY_ROOT, 'src', 'config', 'localities.ts'),
  ...['central', 'east', 'north-and-north-east', 'outer-place', 'south-and-south-east', 'west-and-south-west'].map(
    (group) => join(REPOSITORY_ROOT, 'src', 'config', 'locality-registry', `${group}.ts`)
  ),
];

const GUIDE_SOURCE_FILES = [
  join(REPOSITORY_ROOT, 'src', 'config', 'guides.ts'),
  ...['buy', 'commercial', 'general', 'rent', 'rent-out', 'sell'].map((intent) =>
    join(REPOSITORY_ROOT, 'src', 'config', 'guide-registry', `${intent}.ts`)
  ),
];

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const asJson = args.has('--json');

const now = new Date();
const plan = planPublicationSync(now, LOCALITY_REGISTRY, GUIDE_REGISTRY);

/**
 * Flip the one field, in the one record.
 *
 * The edit is anchored on the record's identifier literal and applied to the first
 * `publicationStatus` or `editorialStatus` assignment after it, so it cannot reach a
 * neighbouring record. If the anchor is not found, or the field is already at the
 * target value, the function reports that instead of guessing.
 */
function flipField(filePath, identifier, field, fromValue, toValue) {
  const source = readFileSync(filePath, 'utf8');
  const anchor = source.indexOf(`'${identifier}'`);
  if (anchor < 0) return null;

  const fieldPattern = new RegExp(`${field}:\\s*'([a-z_]+)'`);
  const tail = source.slice(anchor);
  const match = fieldPattern.exec(tail);
  if (!match) {
    throw new Error(`${relative(REPOSITORY_ROOT, filePath)}: ${identifier} has no ${field} field.`);
  }
  if (match[1] === toValue) {
    return { filePath, changed: false, reason: `${field} is already "${toValue}"` };
  }
  if (match[1] !== fromValue) {
    throw new Error(
      `${relative(REPOSITORY_ROOT, filePath)}: ${identifier} has ${field} "${match[1]}", expected "${fromValue}".`
    );
  }

  const absoluteIndex = anchor + match.index;
  const updated =
    source.slice(0, absoluteIndex) +
    `${field}: '${toValue}'` +
    source.slice(absoluteIndex + match[0].length);

  return { filePath, changed: true, updated };
}

function flipInFirstMatchingFile(candidateFiles, identifier, field, fromValue, toValue) {
  for (const filePath of candidateFiles) {
    const result = flipField(filePath, identifier, field, fromValue, toValue);
    if (!result) continue;
    if (result.changed) writeFileSync(filePath, result.updated, 'utf8');
    return result;
  }
  throw new Error(`No source file carries the identifier ${identifier}.`);
}

/** Render a withdrawal entry as the TypeScript literal the register holds. */
function renderEntry(entry) {
  const failures = entry.gateFailures
    .map((failure) => `      ${JSON.stringify(failure)},`)
    .join('\n');
  const routes = entry.routesRemoved.map((route) => `      ${JSON.stringify(route)},`).join('\n');
  return [
    '  {',
    `    recordId: ${JSON.stringify(entry.recordId)},`,
    '    gateFailures: [',
    failures,
    '    ],',
    `    withdrawnOn: ${JSON.stringify(entry.withdrawnOn)},`,
    '    routesRemoved: [',
    routes,
    '    ],',
    '  },',
  ].join('\n');
}

/**
 * Append entries between the markers, keeping everything already there.
 *
 * Insertion is before the closing marker, so previous entries are untouched. There
 * is no code path in this script that removes an entry.
 */
function appendWithdrawalEntries(entries) {
  const source = readFileSync(WITHDRAWALS_FILE, 'utf8');
  const endIndex = source.indexOf(END_MARKER);
  if (source.indexOf(START_MARKER) < 0 || endIndex < 0) {
    throw new Error('withdrawals.ts has lost its sync-managed markers.');
  }
  const rendered = `${entries.map(renderEntry).join('\n')}\n  `;
  const updated = source.slice(0, endIndex) + rendered + source.slice(endIndex);
  writeFileSync(WITHDRAWALS_FILE, updated, 'utf8');
}

const entries = plan.withdrawals.map((withdrawal) => createWithdrawalEntry(withdrawal));
const invalid = entries
  .map((entry) => validateWithdrawalEntry(entry))
  .filter((validation) => !validation.ok);

if (invalid.length > 0) {
  console.error('Refusing to write: a withdrawal entry is incomplete.');
  for (const validation of invalid) {
    for (const failure of validation.failures) console.error(`  - ${failure}`);
  }
  process.exit(1);
}

if (asJson) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(`Publication sync, evaluated ${plan.evaluatedOn}`);
  console.log(`  localities passing the gate: ${plan.publishedLocalityCount}`);
  console.log(`  guides passing the gate:     ${plan.publishedGuideCount}`);
  console.log(`  records to withdraw:         ${plan.withdrawals.length}`);
  console.log(`  records to return to fact review: ${plan.factReviewReturns.length}`);
  for (const withdrawal of plan.withdrawals) {
    console.log(`\n  ${withdrawal.recordId} → unpublished`);
    console.log(`    routes removed: ${withdrawal.routesRemoved.join(', ')}`);
    for (const failure of withdrawal.gateFailures) console.log(`    - ${failure}`);
  }
  for (const recordId of plan.factReviewReturns) {
    console.log(`\n  ${recordId} → fact_review (content updated after an approval)`);
  }
}

if (!apply) {
  if (plan.withdrawals.length > 0 || plan.factReviewReturns.length > 0) {
    console.log('\nNothing written. Re-run with --apply to perform these edits.');
  }
  process.exit(0);
}

for (const withdrawal of plan.withdrawals) {
  const disagreement = plan.disagreements.find((item) => item.recordId === withdrawal.recordId);
  const files = disagreement.kind === 'locality' ? LOCALITY_SOURCE_FILES : GUIDE_SOURCE_FILES;
  const result = flipInFirstMatchingFile(
    files,
    withdrawal.recordId,
    'publicationStatus',
    'published',
    'unpublished'
  );
  console.log(
    `${result.changed ? 'updated' : 'unchanged'} ${relative(REPOSITORY_ROOT, result.filePath)} for ${withdrawal.recordId}`
  );
}

for (const recordId of plan.factReviewReturns) {
  const record = LOCALITY_REGISTRY.find((candidate) => candidate.entityId === recordId);
  const result = flipInFirstMatchingFile(
    LOCALITY_SOURCE_FILES,
    recordId,
    'editorialStatus',
    record.editorialStatus,
    'fact_review'
  );
  console.log(
    `${result.changed ? 'updated' : 'unchanged'} ${relative(REPOSITORY_ROOT, result.filePath)} for ${recordId} → fact_review`
  );
}

if (entries.length > 0) {
  appendWithdrawalEntries(entries);
  console.log(`appended ${entries.length} withdrawal entr${entries.length === 1 ? 'y' : 'ies'}`);
}
