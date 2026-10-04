#!/usr/bin/env node
/**
 * The honest progress report: every count derived from the publication gate.
 *
 * Requirement 13. The report answers one question — how many pages are genuinely
 * published, and what is holding the rest back — and it answers it by calling the
 * gate, never by reading a stored flag. `publicationStatus` is bookkeeping; the
 * design says so in as many words, and `findStatusGateDisagreements` is how the two
 * are held in step. So this generator asks `evaluateLocality`, `evaluateRegionHub`
 * and `evaluateGuide` for a verdict on every record and counts the verdicts. If the
 * stored flags and the gate ever disagreed, the report would state that as a finding
 * rather than quietly preferring one of them.
 *
 * Today the answer is **zero published localities**. That is the real number, and
 * the report states it plainly: no projection, no "coming soon", no candidate total
 * dressed up as progress. The 132 Research_Backlog localities and the 36
 * Route_Manifest guides are labelled candidates, which is what they are.
 *
 * Four separations are deliberate, because each one is a way a page count gets
 * overstated:
 *
 *  1. **Static routes are counted apart.** `/`, `/buy`, `/about` and the nine others
 *     are published pages, and not one of them is an area guide. They are reported
 *     as a separately labelled count outside the published page count
 *     (Requirement 13.5), so nobody can read "12" as twelve localities.
 *  2. **Preview routes and policy pages are excluded.** The route walk finds every
 *     `page.tsx` under `src/app`; anything not in `STATIC_PUBLIC_ROUTES` is listed
 *     as excluded rather than omitted silently, so a preview route added tomorrow
 *     shows up in the excluded list by itself.
 *  3. **Every failure, not the first.** A failing record carries the whole list the
 *     gate returned (Requirement 13.3). A single summary reason would hide four
 *     fifths of the work.
 *  4. **The register holds the wording.** Blocked counts name the Owner_Input_
 *     Register entry identifier and link to the register. The request wording is not
 *     restated here, because two copies of a request is how one of them goes stale
 *     (Requirement 13.4).
 *
 * Figures nobody has measured are recorded as unmeasured with no source and no date
 * (Requirements 13.7, 13.10). There is no traffic figure, no lead figure, no
 * conversion rate and no keyword volume in this repository, and an estimate in place
 * of one of them would be an invented business fact.
 *
 * Output, both regenerated on every run:
 *   docs/implementation/progress-report.json   the machine-readable report
 *   docs/implementation/PROGRESS-REPORT.md     the readable summary
 *
 * Usage:
 *   node scripts/generate-progress-report.mjs            # write both files
 *   node scripts/generate-progress-report.mjs --check    # compute and print, write nothing
 *   node scripts/generate-progress-report.mjs --json     # print the JSON to stdout
 *
 * Exit code 1 when a finding makes the arithmetic unsafe to publish — the candidate
 * total moving off 168, a record the eight states cannot classify, a checklist
 * identifier the register does not hold, or a stored flag disagreeing with the gate.
 * The report refuses to state a partition it cannot verify.
 *
 * The arithmetic below is pure and exported; `tests/progress-report.test.ts` drives
 * it. Nothing runs on import — the registries are loaded inside `main()`, behind the
 * argv guard, so importing this module neither registers a loader hook nor reads a
 * file.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');

/** Requirement 13.4. The one place the request wording lives. */
export const OWNER_INPUT_REGISTER = 'docs/implementation/OWNER-FACTS-CHECKLIST.md';
export const JSON_OUTPUT = 'docs/implementation/progress-report.json';
export const TEXT_OUTPUT = 'docs/implementation/PROGRESS-REPORT.md';

/** Requirement 13.2. */
export const PUBLISHED_PAGE_TARGET = 100;

/** Requirement 13.9. The candidate populations, named in the requirement itself. */
export const EXPECTED_LOCALITY_CANDIDATES = 132;
export const EXPECTED_GUIDE_CANDIDATES = 36;
export const EXPECTED_CANDIDATE_TOTAL = EXPECTED_LOCALITY_CANDIDATES + EXPECTED_GUIDE_CANDIDATES;

/**
 * The eight states, in order.
 *
 * A copy of `WORKFLOW_SEQUENCE` from `src/config/editorial-workflow.ts`, because a
 * `.mjs` module that imports nothing stays testable without a loader hook. The test
 * asserts the two lists are identical, so the copy cannot drift unnoticed.
 *
 * The annotation is the shipped `WorkflowState` union, imported as a type only — no
 * value crosses the boundary, so the module still runs with no loader hook, and a
 * consumer indexing by state gets the same eight strings `tsc` knows about. Widening
 * this to `string[]` is how a ninth state would slip in unnoticed.
 *
 * @type {readonly import('../src/config/editorial-workflow').WorkflowState[]}
 */
export const WORKFLOW_STATES = [
  'candidate',
  'research',
  'draft',
  'fact_review',
  'editorial_review',
  'seo_review',
  'approved',
  'published',
];

// ---------------------------------------------------------------------------
// The record assessment
// ---------------------------------------------------------------------------

/**
 * One record as this report sees it.
 *
 * @typedef {object} Assessment
 * @property {string} recordId
 * @property {'locality' | 'guide'} kind
 * @property {string} slug
 * @property {string} editorialStatus the seven-state editorial value
 * @property {boolean} eligible the gate's verdict, not a stored flag
 * @property {readonly string[]} failures every reason the gate returned
 * @property {readonly string[]} blockingNotes internal notes, never rendered
 */

/**
 * Requirement 11.1's derivation, with the gate's verdict in place of the stored
 * flag.
 *
 * `deriveWorkflowState` reads `publicationStatus`; this reads `eligible`. The rule
 * is otherwise identical, and the test asserts that by driving the real
 * `deriveWorkflowState` across all eight editorial values and both flags. Using the
 * gate here is the whole point of Requirement 13.1: a record whose flag says
 * published but whose evidence went stale is not a published page.
 */
/** @param {Assessment} assessment */
export function workflowStateOf(assessment) {
  return assessment.eligible ? 'published' : assessment.editorialStatus;
}

/**
 * A guide's editorial state, derived rather than stored.
 *
 * `GuideRecord` carries `publicationStatus` and no `editorialStatus` — the field
 * simply does not exist on the type — so the eight-state partition would leave every
 * unpublished guide unclassified. Rather than invent a status on the record, the
 * report derives one from what the record actually holds:
 *
 *  - no sections and no `contentUpdatedAt` → `candidate`. Nothing has been written.
 *  - anything else → `draft`. Text exists and the gate rejects it.
 *
 * Neither branch claims a review that has not happened: a guide cannot reach
 * `fact_review` or beyond through this function, because no field on the record
 * evidences one. A guide that needs a truer state needs a field to carry it.
 */
/** @param {{ sections: readonly unknown[]; contentUpdatedAt: string | null }} record */
export function guideEditorialStatus(record) {
  const hasContent = record.sections.length > 0 || record.contentUpdatedAt !== null;
  return hasContent ? 'draft' : 'candidate';
}

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

/** Requirement 13.1. The two counts and the sum, labelled. */
export function publishedCounts(/** @type {readonly Assessment[]} */ assessments) {
  const published = assessments.filter((assessment) => assessment.eligible);
  const localities = published.filter((assessment) => assessment.kind === 'locality').length;
  const guides = published.filter((assessment) => assessment.kind === 'guide').length;
  return {
    localities,
    guides,
    publishedPageCount: localities + guides,
    label: 'published page count: locality records plus guide records that pass the publication gate',
  };
}

/** Requirement 13.2. 100 minus the published page count, and zero rather than negative. */
export function remainingToTarget(publishedPageCount, target = PUBLISHED_PAGE_TARGET) {
  const difference = target - publishedPageCount;
  return {
    target,
    publishedPageCount,
    remaining: Math.max(0, difference),
    clamped: difference < 0,
  };
}

/**
 * Requirement 13.2. Every candidate in exactly one of the eight states.
 *
 * A record whose state is not one of the eight lands in `unclassified` and is
 * reported. Dropping it would make the counts sum to less than the population and
 * look correct while doing it.
 */
export function partitionWorkflowStates(/** @type {readonly Assessment[]} */ assessments) {
  /** @type {Record<string, string[]>} */
  const recordIdsByState = {};
  for (const state of WORKFLOW_STATES) recordIdsByState[state] = [];
  const unclassified = [];

  for (const assessment of assessments) {
    const state = workflowStateOf(assessment);
    if (WORKFLOW_STATES.includes(state)) recordIdsByState[state].push(assessment.recordId);
    else unclassified.push({ recordId: assessment.recordId, state: String(state) });
  }

  /** @type {Record<string, number>} */
  const counts = {};
  for (const state of WORKFLOW_STATES) counts[state] = recordIdsByState[state].length;

  return {
    counts,
    recordIdsByState,
    unclassified,
    sum: WORKFLOW_STATES.reduce((total, state) => total + counts[state], 0),
    population: assessments.length,
  };
}

/**
 * Requirement 13.2. The partition is exhaustive over the population and disjoint
 * between states, and the population is the expected candidate total.
 *
 * Disjointness is checked pairwise rather than argued from the derivation, because
 * "one function returns one value" is exactly the kind of premise that survives a
 * refactor as a comment and not as a fact.
 */
export function checkPartition(
  /** @type {ReturnType<typeof partitionWorkflowStates>} */ partition,
  /** @type {number} */ expectedTotal = EXPECTED_CANDIDATE_TOTAL
) {
  const failures = [];

  if (partition.unclassified.length > 0) {
    for (const entry of partition.unclassified) {
      failures.push(
        `${entry.recordId} derives the state "${entry.state}", which is not one of the eight workflow states.`
      );
    }
  }
  if (partition.sum !== partition.population) {
    failures.push(
      `The eight state counts sum to ${partition.sum} over a population of ${partition.population}; the partition is not exhaustive.`
    );
  }
  if (partition.population !== expectedTotal) {
    failures.push(
      `The candidate population is ${partition.population}, not the expected ${expectedTotal}. The report will not restate ${expectedTotal} while the registries hold another number.`
    );
  }

  for (let first = 0; first < WORKFLOW_STATES.length; first += 1) {
    for (let second = first + 1; second < WORKFLOW_STATES.length; second += 1) {
      const a = WORKFLOW_STATES[first];
      const b = WORKFLOW_STATES[second];
      const shared = partition.recordIdsByState[a].filter((recordId) =>
        partition.recordIdsByState[b].includes(recordId)
      );
      for (const recordId of shared) {
        failures.push(`${recordId} is counted in both ${a} and ${b}; the states are not disjoint.`);
      }
    }
  }

  const seen = new Set();
  for (const state of WORKFLOW_STATES) {
    for (const recordId of partition.recordIdsByState[state]) {
      if (seen.has(recordId)) failures.push(`${recordId} appears in more than one state.`);
      seen.add(recordId);
    }
  }

  return { ok: failures.length === 0, failures, exhaustive: partition.sum === partition.population };
}

/** Requirement 13.3. Failing records, each with every reason the gate returned. */
export function gateFailuresByRecord(/** @type {readonly Assessment[]} */ assessments) {
  return assessments
    .filter((assessment) => !assessment.eligible)
    .map((assessment) => ({
      recordId: assessment.recordId,
      kind: assessment.kind,
      slug: assessment.slug,
      workflowState: workflowStateOf(assessment),
      failureCount: assessment.failures.length,
      failures: [...assessment.failures],
    }));
}

// ---------------------------------------------------------------------------
// Owner input
// ---------------------------------------------------------------------------

/**
 * Owner_Input_Register identifiers named in a record's blocking notes.
 *
 * A whole-token match on `C` followed by one or two digits. The notes name entries
 * as "Blocked on checklist C3"; the token form is what is matched, so a note that
 * says "C3" without the word checklist is still counted, and `checkPartition`'s
 * sibling check below rejects an identifier the register does not hold rather than
 * reporting a count against an entry nobody can read.
 */
export function checklistEntryIdsIn(/** @type {readonly string[]} */ notes) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const note of notes) {
    for (const match of note.matchAll(/\bC([1-9]\d?)\b/g)) ids.add(`C${match[1]}`);
  }
  return [...ids].sort(compareChecklistIds);
}

/**
 * @param {string} a
 * @param {string} b
 */
export function compareChecklistIds(a, b) {
  return Number(a.slice(1)) - Number(b.slice(1));
}

/**
 * Requirement 13.4. How many records each register entry is holding up.
 *
 * Counted over records that fail the gate only: a record the gate admits is not
 * blocked by anything, whatever its notes still say. A record naming two entries
 * counts once against each, because either answer unblocks part of its work — so
 * these counts do not sum to the number of blocked records, and the report says so.
 */
/**
 * @param {readonly Assessment[]} assessments
 * @param {readonly string[] | null} registerEntryIds the identifiers the register
 *   holds. Null means "not checked", and the caller gets `existsInRegister: null`
 *   rather than a silent `false`.
 */
export function blockedCountsByChecklistEntry(assessments, registerEntryIds = null) {
  /** @type {Map<string, string[]>} */
  const byEntry = new Map();

  for (const assessment of assessments) {
    if (assessment.eligible) continue;
    for (const entryId of checklistEntryIdsIn(assessment.blockingNotes)) {
      if (!byEntry.has(entryId)) byEntry.set(entryId, []);
      byEntry.get(entryId).push(assessment.recordId);
    }
  }

  return [...byEntry.entries()]
    .sort(([a], [b]) => compareChecklistIds(a, b))
    .map(([entryId, recordIds]) => ({
      entryId,
      blockedRecordCount: recordIds.length,
      recordIds,
      existsInRegister: registerEntryIds === null ? null : registerEntryIds.includes(entryId),
    }));
}

/**
 * Identifiers the register actually holds, read from its own table rows.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function parseRegisterEntryIds(markdown) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const match of markdown.matchAll(/^\|\s*(C[1-9]\d?)\s*\|/gm)) ids.add(match[1]);
  return [...ids].sort(compareChecklistIds);
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

/**
 * Requirement 13.6. Released batches, each with its identifier, release date and
 * three named reviewers.
 *
 * A batch with `releasedOn` null is prepared, not released, and is reported as such.
 */
/** @param {readonly import('../internal/registers/batches').ContentBatch[]} batches */
export function batchSummaries(batches) {
  /** @param {import('../internal/registers/batches').ContentBatch} batch */
  const describe = (batch) => ({
    batchId: batch.batchId,
    releasedOn: batch.releasedOn,
    recordCount: batch.recordIds.length,
    recordIds: [...batch.recordIds],
    reviewers: {
      localReviewer: batch.localReviewer,
      editorialApprover: batch.editorialApprover,
      seoReviewer: batch.seoReviewer,
    },
  });
  return {
    released: batches.filter((batch) => batch.releasedOn !== null).map(describe),
    prepared: batches.filter((batch) => batch.releasedOn === null).map(describe),
  };
}

// ---------------------------------------------------------------------------
// Routes that are not content pages
// ---------------------------------------------------------------------------

/**
 * Requirement 13.5. Published static routes, counted and labelled apart from the
 * published page count, plus every route deliberately outside it.
 *
 * `publishedStaticRoutes` is `STATIC_PUBLIC_ROUTES` — the registry the sitemap
 * reads. `excludedRoutes` is every other `page.tsx` found under `src/app`: protected
 * previews today, and anything added tomorrow, which is why the list is walked
 * rather than written down.
 */
/**
 * @param {readonly string[]} staticPublicRoutePaths
 * @param {readonly string[]} discoveredRoutePaths
 */
export function routeCounts(staticPublicRoutePaths, discoveredRoutePaths) {
  const published = [...staticPublicRoutePaths];
  const dynamic = discoveredRoutePaths.filter((path) => path.includes('['));
  const excluded = discoveredRoutePaths.filter(
    (path) => !path.includes('[') && !published.includes(path)
  );
  return {
    publishedStaticRoutes: {
      count: published.length,
      paths: published.sort(),
      label:
        'Service, hub and company pages. Not one of them is a locality record or a guide record, and none is counted in the published page count.',
    },
    excludedRoutes: {
      count: excluded.length,
      paths: excluded.sort(),
      label: 'Protected previews, and any other page that is not published content.',
    },
    contentRouteTemplates: {
      count: dynamic.length,
      paths: dynamic.sort(),
      label: 'A template serves only the records the gate admits, so it is not a page count.',
    },
  };
}

/** Every route with a `page.tsx`, as a route path. */
export function discoverRoutePaths(appDirectory, read = { readdirSync, statSync }) {
  const paths = [];
  const walk = (directory, segments) => {
    let entries;
    try {
      entries = read.readdirSync(directory);
    } catch {
      return;
    }
    if (entries.includes('page.tsx') || entries.includes('page.ts')) {
      paths.push(`/${segments.join('/')}` === '/' ? '/' : `/${segments.join('/')}`);
    }
    for (const entry of entries) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue;
      const child = join(directory, entry);
      if (!read.statSync(child).isDirectory()) continue;
      // A route group `(name)` adds no path segment.
      const isGroup = entry.startsWith('(') && entry.endsWith(')');
      walk(child, isGroup ? segments : [...segments, entry]);
    }
  };
  walk(appDirectory, []);
  return paths.sort();
}

// ---------------------------------------------------------------------------
// Figures nobody has measured
// ---------------------------------------------------------------------------

/**
 * Requirements 13.7 and 13.10.
 *
 * Every figure of this kind is recorded as unmeasured, with a null source, a null
 * date and a null period. Requirement 13.7 says a stated figure carries its source,
 * date and period; the honest consequence while none exists is that the figure is
 * not stated at all, and the absence is.
 */
/**
 * @param {string | null} keywordVolumeBlockedBy the Owner_Input_Register identifier
 *   holding the keyword tool request, cited by identifier and never restated.
 */
export function unmeasuredFigures(keywordVolumeBlockedBy = null) {
  const unmeasured = (figure, why) => ({
    figure,
    state: 'unmeasured',
    value: null,
    source: null,
    measuredOn: null,
    period: null,
    statement: `No measurement of ${figure} exists. ${why} No estimate and no projection is recorded in its place.`,
  });
  return [
    unmeasured('search traffic', 'The site is not released and has no public URL, so nothing has been served.'),
    unmeasured('enquiries received', 'No enquiry destination is approved, so no enquiry has been delivered or counted.'),
    unmeasured('conversion rate', 'A rate needs both a traffic figure and an enquiry figure; neither exists.'),
    unmeasured(
      'keyword search volume',
      keywordVolumeBlockedBy
        ? `No keyword research tool has been licensed; Owner_Input_Register ${keywordVolumeBlockedBy} holds that request.`
        : 'No keyword research tool has been licensed.'
    ),
  ];
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

/**
 * The whole report, as data, from inputs the caller has already gathered.
 *
 * Pure: no clock, no filesystem, no registry import. `main()` collects the inputs
 * and `tests/progress-report.test.ts` supplies its own.
 */
export function buildProgressReport(input) {
  const {
    evaluatedOn,
    generatedAt,
    assessments,
    staticPublicRoutePaths,
    discoveredRoutePaths,
    batches,
    registerEntryIds,
    mechanismBlockedEntries = [],
    statusGateDisagreements = [],
    withdrawalsRecorded = 0,
    domainConfirmed = false,
    keywordVolumeBlockedBy = null,
    expectedLocalityCandidates = EXPECTED_LOCALITY_CANDIDATES,
    expectedGuideCandidates = EXPECTED_GUIDE_CANDIDATES,
  } = input;

  const localityAssessments = assessments.filter((assessment) => assessment.kind === 'locality');
  const guideAssessments = assessments.filter((assessment) => assessment.kind === 'guide');

  const published = publishedCounts(assessments);
  const partition = partitionWorkflowStates(assessments);
  const expectedTotal = expectedLocalityCandidates + expectedGuideCandidates;
  const partitionCheck = checkPartition(partition, expectedTotal);
  const blocked = blockedCountsByChecklistEntry(assessments, registerEntryIds);

  const findings = [...partitionCheck.failures];
  if (localityAssessments.length !== expectedLocalityCandidates) {
    findings.push(
      `The locality registry holds ${localityAssessments.length} records, not the ${expectedLocalityCandidates} Requirement 13.9 names.`
    );
  }
  if (guideAssessments.length !== expectedGuideCandidates) {
    findings.push(
      `The guide registry holds ${guideAssessments.length} records, not the ${expectedGuideCandidates} Requirement 13.9 names.`
    );
  }
  for (const entry of blocked) {
    if (entry.existsInRegister === false) {
      findings.push(
        `${entry.blockedRecordCount} record(s) name Owner_Input_Register entry ${entry.entryId}, which the register does not hold.`
      );
    }
  }
  for (const entry of mechanismBlockedEntries) {
    if (registerEntryIds && !registerEntryIds.includes(entry.entryId)) {
      findings.push(
        `${entry.entryId} is named in code as blocking "${entry.blocks}", and the register does not hold it.`
      );
    }
  }
  for (const disagreement of statusGateDisagreements) {
    findings.push(
      `${disagreement.recordId} stores publicationStatus "${disagreement.persistedStatus}" while the gate rejects it; the counts above follow the gate.`
    );
  }

  return {
    requirement: '13',
    generatedAt,
    evaluatedOn,
    countsComputedOn: evaluatedOn,
    method: {
      countsFrom:
        'evaluateLocality, evaluateRegionHub and evaluateGuide, called with the evaluation date. No count is read from publicationStatus.',
      workflowState:
        'The eight-state derivation of editorial-workflow.ts, with the gate verdict in place of the stored publication flag.',
      guideEditorialState:
        'GuideRecord carries no editorialStatus. A guide with no sections and no contentUpdatedAt is a candidate; a guide with either is a draft. No guide is placed in a review state, because no field on the record evidences a review.',
      restatement:
        'Every count in this report is recomputed from the registries on each run, so a batch release, a withdrawal or a state change restates all of them together with the date above.',
    },
    publishedPageCount: published,
    remainingToTarget: remainingToTarget(published.publishedPageCount),
    candidates: {
      localities: localityAssessments.length,
      guides: guideAssessments.length,
      total: assessments.length,
      expected: {
        localities: expectedLocalityCandidates,
        guides: expectedGuideCandidates,
        total: expectedTotal,
      },
      label:
        'A candidate is a typed, accounted-for record. It is not a published page and not a page in progress.',
    },
    workflowStates: {
      counts: partition.counts,
      sum: partition.sum,
      population: partition.population,
      partition: {
        ok: partitionCheck.ok,
        exhaustive: partitionCheck.exhaustive,
        disjoint: partitionCheck.failures.length === 0,
        failures: partitionCheck.failures,
      },
      recordIdsByState: partition.recordIdsByState,
      unclassified: partition.unclassified,
    },
    routes: routeCounts(staticPublicRoutePaths, discoveredRoutePaths),
    gateFailuresByRecord: gateFailuresByRecord(assessments),
    blockedByOwnerInput: {
      register: OWNER_INPUT_REGISTER,
      wordingSource: `The request wording for every entry below lives only in ${OWNER_INPUT_REGISTER}. This report names identifiers and counts, and does not restate a request.`,
      countingNote:
        'A record naming two entries is counted against each, so these counts do not sum to the number of blocked records.',
      entries: blocked,
      mechanismsBlocked: mechanismBlockedEntries,
    },
    batches: {
      ...batchSummaries(batches),
      note:
        'A released batch carries its identifier, its release date and three named reviewers. Requirement 13.6 asks for those three facts per batch once the published page count reaches 100.',
    },
    withdrawals: {
      recorded: withdrawalsRecorded,
      statusGateDisagreements,
    },
    unmeasuredFigures: unmeasuredFigures(keywordVolumeBlockedBy),
    statements: {
      noGuarantee: `Recorded ${evaluatedOn}: a page count, structured data and crawler permission guarantee neither a search ranking nor a citation by an AI assistant. Nothing in this repository can promise either, and no figure here should be read as a forecast of one.`,
      crawlerWithoutRetrieval:
        'A crawler or assistant without live retrieval may not know this business at all. No owner-controlled method updates a model\u2019s stored knowledge; the only thing within reach is what a retrieving crawler can fetch at the time it is asked.',
      observationRecording: domainConfirmed
        ? 'Observation recording is possible: a domain is confirmed.'
        : 'Observation recording has not begun, because no public URL exists. Zero sampling rounds are recorded, and none is projected.',
      publishedLocalities:
        published.localities === 0
          ? 'Zero locality records pass the publication gate. The 132 Research_Backlog localities and the 36 Route_Manifest guides are candidates, not published pages and not pages in progress.'
          : `${published.localities} locality record(s) pass the publication gate.`,
    },
    refusesToState: [
      'A date by which the published page count reaches 100. Release pace depends on three named reviewers and on owner answers, neither of which this report can measure.',
      'Any traffic, lead, conversion or keyword volume figure. Each is recorded as unmeasured above.',
      'A candidate total presented as a page count, or a partial page presented as a page in progress.',
      'A ranking or AI-citation expectation of any kind.',
    ],
    findings,
  };
}

// ---------------------------------------------------------------------------
// The readable summary
// ---------------------------------------------------------------------------

const bullet = (text) => `* ${text}`;

/** The markdown summary. Pure: the same report renders the same text every time. */
export function renderProgressReport(report) {
  const lines = [];
  const push = (...text) => lines.push(...text);

  push(
    '# Progress against the 100-plus page goal',
    '',
    `*Generated by \`scripts/generate-progress-report.mjs\`. Every count below is computed by calling the publication gate on the evaluation date, not read from a stored flag. Regenerate with \`npm run report:progress\`; do not edit this file by hand.*`,
    '',
    bullet(`**Counts computed on:** ${report.countsComputedOn}`),
    bullet(`**Gate evaluated on:** ${report.evaluatedOn}`),
    bullet(`**Requirement:** ${report.requirement}`),
    ''
  );

  const published = report.publishedPageCount;
  push(
    '## Published page count',
    '',
    '| Passing the publication gate | Count |',
    '|---|---|',
    `| Locality records | **${published.localities}** |`,
    `| Guide records | **${published.guides}** |`,
    `| **Published page count** | **${published.publishedPageCount}** |`,
    '',
    bullet(
      `Further published pages needed to reach ${report.remainingToTarget.target}: **${report.remainingToTarget.remaining}**` +
        (report.remainingToTarget.clamped
          ? ' (the published page count is at or above the target, so the figure is zero rather than negative).'
          : '.')
    ),
    bullet(report.statements.publishedLocalities),
    ''
  );

  push(
    '## Routes that are not content pages',
    '',
    bullet(
      `**${report.routes.publishedStaticRoutes.count} published static routes**, counted separately and outside the published page count. ${report.routes.publishedStaticRoutes.label} ${report.routes.publishedStaticRoutes.paths.map((path) => `\`${path}\``).join(' · ')}`
    ),
    bullet(
      report.routes.excludedRoutes.count === 0
        ? 'No further route sits outside the published page count.'
        : `**${report.routes.excludedRoutes.count} excluded routes.** ${report.routes.excludedRoutes.label} ${report.routes.excludedRoutes.paths.map((path) => `\`${path}\``).join(' · ')}`
    ),
    bullet(
      `**${report.routes.contentRouteTemplates.count} dynamic templates.** ${report.routes.contentRouteTemplates.label} ${report.routes.contentRouteTemplates.paths.map((path) => `\`${path}\``).join(' · ')}`
    ),
    ''
  );

  push(
    '## The eight workflow states',
    '',
    `Every one of the ${report.candidates.total} candidates sits in exactly one state.`,
    '',
    '| State | Records |',
    '|---|---|'
  );
  for (const state of WORKFLOW_STATES) {
    push(`| ${state} | ${report.workflowStates.counts[state]} |`);
  }
  push(
    `| **Total** | **${report.workflowStates.sum}** |`,
    '',
    bullet(
      `Partition over ${report.workflowStates.population} records: exhaustive ${report.workflowStates.partition.exhaustive ? 'yes' : 'no'}, disjoint ${report.workflowStates.partition.disjoint ? 'yes' : 'no'}.`
    ),
    bullet(
      `Candidates: ${report.candidates.localities} localities + ${report.candidates.guides} guides = ${report.candidates.total}. ${report.candidates.label}`
    ),
    bullet(report.method.guideEditorialState),
    ''
  );

  push(
    '## Blocked on owner input',
    '',
    report.blockedByOwnerInput.wordingSource,
    '',
    '| Register entry | Records blocked |',
    '|---|---|'
  );
  if (report.blockedByOwnerInput.entries.length === 0) {
    push('| — | No failing record names a register entry. |');
  }
  for (const entry of report.blockedByOwnerInput.entries) {
    const known =
      entry.existsInRegister === false ? ' — **not held in the register**' : '';
    push(
      `| [${entry.entryId}](${OWNER_INPUT_REGISTER})${known} | ${entry.blockedRecordCount} |`
    );
  }
  push('', bullet(report.blockedByOwnerInput.countingNote));
  for (const mechanism of report.blockedByOwnerInput.mechanismsBlocked) {
    push(
      bullet(
        `[${mechanism.entryId}](${OWNER_INPUT_REGISTER}) blocks ${mechanism.blocks}. No record is counted against it; the mechanism is built and switched off.`
      )
    );
  }
  push('');

  push('## Batches', '');
  if (report.batches.released.length === 0) {
    push(bullet('No batch has been released. Zero batches, zero release dates, zero reviewer sign-offs.'));
  }
  for (const batch of report.batches.released) {
    push(
      bullet(
        `${batch.batchId} — released ${batch.releasedOn} — ${batch.recordCount} record(s) — local reviewer ${batch.reviewers.localReviewer}, editorial approver ${batch.reviewers.editorialApprover}, SEO reviewer ${batch.reviewers.seoReviewer}.`
      )
    );
  }
  if (report.batches.prepared.length === 0) {
    push(bullet('No batch is prepared and awaiting release.'));
  }
  for (const batch of report.batches.prepared) {
    push(bullet(`${batch.batchId} — prepared, not released — ${batch.recordCount} record(s).`));
  }
  push(bullet(report.batches.note), '');

  push(
    '## Figures nobody has measured',
    '',
    '| Figure | State | Source | Date | Period |',
    '|---|---|---|---|---|'
  );
  for (const figure of report.unmeasuredFigures) {
    push(`| ${figure.figure} | ${figure.state} | none | none | none |`);
  }
  push('');
  for (const figure of report.unmeasuredFigures) push(bullet(figure.statement));
  push('');

  push(
    '## What this report will not say',
    '',
    bullet(report.statements.noGuarantee),
    bullet(report.statements.crawlerWithoutRetrieval),
    bullet(report.statements.observationRecording),
    ''
  );
  for (const refusal of report.refusesToState) push(bullet(refusal));
  push('');

  push(
    '## Stored status against the gate',
    '',
    bullet(
      report.withdrawals.statusGateDisagreements.length === 0
        ? 'No record stores a published status the gate disagrees with.'
        : `${report.withdrawals.statusGateDisagreements.length} record(s) store a published status the gate rejects. The counts above follow the gate.`
    ),
    bullet(`Withdrawal entries recorded: ${report.withdrawals.recorded}.`),
    ''
  );

  if (report.findings.length > 0) {
    push('## Findings', '');
    for (const finding of report.findings) push(bullet(finding));
    push('');
  }

  push(
    '## Every record the gate rejects, with every reason',
    '',
    `${report.gateFailuresByRecord.length} record(s) fail the publication gate. Each reason below is one the gate returned; none is a summary.`,
    ''
  );
  for (const record of report.gateFailuresByRecord) {
    push(
      `### ${record.recordId} — ${record.kind} \`${record.slug}\` — ${record.workflowState} — ${record.failureCount} failure(s)`,
      ''
    );
    for (const failure of record.failures) push(bullet(failure));
    push('');
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// The CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has('--check');
  const asJson = args.has('--json');

  const { registerTypeScriptResolution } = await import('./lib/ts-module-loader.mjs');
  registerTypeScriptResolution();

  const { LOCALITY_REGISTRY, evaluateLocality, getPublishedLocalities } = await import(
    '@/config/localities'
  );
  const { GUIDE_REGISTRY, evaluateGuide, HEADING_INTENT_PROVENANCE_GAP } = await import('@/config/guides');
  const { evaluateRegionHub, getPublishedAreaRecords } = await import('@/config/locality-sections');
  const { WORKFLOW_SEQUENCE, deriveWorkflowState } = await import('@/config/editorial-workflow');
  const { findStatusGateDisagreements } = await import('@/config/publication-sync');
  const { STATIC_PUBLIC_ROUTES } = await import('@/lib/public-routes');
  const { isDomainConfirmed } = await import('@/config/site');
  const { CRAWLER_DECISION_CHECKLIST_ENTRIES } = await import('@/config/crawler-access');
  const { CONTENT_BATCHES } = await import('@internal/registers/batches');
  const { WITHDRAWAL_ENTRIES } = await import('@internal/registers/withdrawals');

  // The copied state list must be the real one.
  if (WORKFLOW_SEQUENCE.join('|') !== WORKFLOW_STATES.join('|')) {
    throw new Error(
      `The eight states in this script (${WORKFLOW_STATES.join(', ')}) no longer match WORKFLOW_SEQUENCE (${WORKFLOW_SEQUENCE.join(', ')}).`
    );
  }

  const now = new Date();
  const evaluatedOn = now.toISOString().slice(0, 10);
  const publishedLocalities = getPublishedLocalities(now);

  /** @type {Assessment[]} */
  const assessments = [];

  for (const record of LOCALITY_REGISTRY) {
    // The same branch `isAreaRecordPublishable` takes, so the verdict here is the
    // verdict `/areas/[slug]` reaches.
    const evaluation =
      record.entityType === 'region-hub'
        ? evaluateRegionHub(record, publishedLocalities, now)
        : evaluateLocality(record, now);
    assessments.push({
      recordId: record.entityId,
      kind: 'locality',
      slug: record.slug,
      editorialStatus: record.editorialStatus,
      eligible: evaluation.eligible,
      failures: evaluation.failures,
      blockingNotes: record.blockingNotes,
    });
  }

  for (const record of GUIDE_REGISTRY) {
    const evaluation = evaluateGuide(record, now);
    assessments.push({
      recordId: record.guideId,
      kind: 'guide',
      slug: record.slug,
      editorialStatus: guideEditorialStatus(record),
      eligible: evaluation.eligible,
      failures: evaluation.failures,
      blockingNotes: record.blockingNotes,
    });
  }

  // The derivation used above must agree with the shipped one.
  for (const assessment of assessments) {
    const derived = deriveWorkflowState({
      editorialStatus: assessment.editorialStatus,
      publicationStatus: assessment.eligible ? 'published' : 'unpublished',
    });
    if (derived !== workflowStateOf(assessment)) {
      throw new Error(
        `${assessment.recordId}: this script derives "${workflowStateOf(assessment)}" where deriveWorkflowState gives "${derived}".`
      );
    }
  }

  const registerMarkdown = readFileSync(join(ROOT, OWNER_INPUT_REGISTER), 'utf8');
  const registerEntryIds = parseRegisterEntryIds(registerMarkdown);

  const report = buildProgressReport({
    evaluatedOn,
    generatedAt: now.toISOString(),
    assessments,
    staticPublicRoutePaths: STATIC_PUBLIC_ROUTES.map((route) => route.path),
    discoveredRoutePaths: discoverRoutePaths(join(ROOT, 'src', 'app')),
    batches: CONTENT_BATCHES,
    registerEntryIds,
    // Requirement 13.4. Identifiers only: the request wording lives in the
    // register, and `tests/owner-facts-checklist.test.ts` asserts that no file under
    // src/, internal/ or scripts/ carries a request sentence. Each line below names
    // what stays switched off, which is a fact about this repository rather than a
    // restatement of what the owner was asked.
    mechanismBlockedEntries: [
      {
        entryId: HEADING_INTENT_PROVENANCE_GAP.ownerInputEntry,
        blocks: 'keyword phrase research, and so every search volume figure',
      },
      {
        entryId: CRAWLER_DECISION_CHECKLIST_ENTRIES['training-crawl'],
        blocks: 'the training-crawl decision for GPTBot',
      },
      {
        entryId: CRAWLER_DECISION_CHECKLIST_ENTRIES['search-crawl'],
        blocks: 'the search-crawl decision for OAI-SearchBot, which blocks a release',
      },
    ].filter((entry) => entry.entryId !== null),
    statusGateDisagreements: findStatusGateDisagreements(now).map((disagreement) => ({
      recordId: disagreement.recordId,
      persistedStatus: disagreement.persistedStatus,
      gateFailures: [...disagreement.gateFailures],
    })),
    withdrawalsRecorded: WITHDRAWAL_ENTRIES.length,
    domainConfirmed: isDomainConfirmed(),
    keywordVolumeBlockedBy: HEADING_INTENT_PROVENANCE_GAP.ownerInputEntry,
  });

  // Cross-check: the gate verdicts this script collected must match the accessor
  // every public surface calls.
  const accessorSlugs = getPublishedAreaRecords(now)
    .map((record) => record.slug)
    .sort();
  const assessedSlugs = assessments
    .filter((assessment) => assessment.kind === 'locality' && assessment.eligible)
    .map((assessment) => assessment.slug)
    .sort();
  if (accessorSlugs.join('|') !== assessedSlugs.join('|')) {
    report.findings.push(
      `getPublishedAreaRecords admits [${accessorSlugs.join(', ')}] where this report's verdicts admit [${assessedSlugs.join(', ')}].`
    );
  }

  const text = renderProgressReport(report);
  const line = (character) => process.stdout.write(`${character.repeat(88)}\n`);

  if (asJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const remaining = report.remainingToTarget;
    line('=');
    process.stdout.write('INSTLE REAL ESTATE — BENGALURU PROGRESS REPORT (Requirement 13)\n');
    line('=');
    process.stdout.write(`Gate evaluated on:            ${report.evaluatedOn}\n`);
    process.stdout.write(`Published localities:         ${report.publishedPageCount.localities}\n`);
    process.stdout.write(`Published guides:             ${report.publishedPageCount.guides}\n`);
    process.stdout.write(`Published page count:         ${report.publishedPageCount.publishedPageCount}\n`);
    process.stdout.write(`Further pages to reach ${remaining.target}:  ${remaining.remaining}\n`);
    process.stdout.write(
      `Published static routes:      ${report.routes.publishedStaticRoutes.count}  (outside the published page count)\n`
    );
    line('-');
    for (const state of WORKFLOW_STATES) {
      process.stdout.write(`  ${state.padEnd(26)}${String(report.workflowStates.counts[state]).padStart(4)}\n`);
    }
    process.stdout.write(
      `  ${'sum'.padEnd(26)}${String(report.workflowStates.sum).padStart(4)}  over ${report.workflowStates.population} candidates ` +
        `(exhaustive ${report.workflowStates.partition.exhaustive ? 'yes' : 'no'}, disjoint ${report.workflowStates.partition.disjoint ? 'yes' : 'no'})\n`
    );
    line('-');
    process.stdout.write('BLOCKED ON OWNER INPUT\n');
    for (const entry of report.blockedByOwnerInput.entries) {
      process.stdout.write(
        `  ${entry.entryId.padEnd(6)}${String(entry.blockedRecordCount).padStart(4)} record(s)${entry.existsInRegister === false ? '  — not held in the register' : ''}\n`
      );
    }
    for (const mechanism of report.blockedByOwnerInput.mechanismsBlocked) {
      process.stdout.write(`  ${mechanism.entryId.padEnd(6)}   0 records — ${mechanism.blocks}\n`);
    }
    process.stdout.write(`  wording: ${OWNER_INPUT_REGISTER} only\n`);
    line('-');
    process.stdout.write(
      `Records failing the gate:     ${report.gateFailuresByRecord.length}, carrying ${report.gateFailuresByRecord.reduce((total, record) => total + record.failureCount, 0)} failure(s) in total\n`
    );
    process.stdout.write(`Batches released:             ${report.batches.released.length}\n`);
    process.stdout.write('Traffic / leads / conversion / keyword volume: unmeasured, no source, no date\n');
    line('-');
    process.stdout.write(`${report.statements.publishedLocalities}\n`);
    if (report.findings.length > 0) {
      line('-');
      process.stdout.write('FINDINGS\n');
      for (const finding of report.findings) process.stdout.write(`  - ${finding}\n`);
    }
  }

  if (!check) {
    writeFileSync(join(ROOT, JSON_OUTPUT), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(ROOT, TEXT_OUTPUT), text);
    if (!asJson) {
      line('-');
      process.stdout.write(`wrote ${JSON_OUTPUT}\n`);
      process.stdout.write(`wrote ${TEXT_OUTPUT}\n`);
    }
  } else if (!asJson) {
    process.stdout.write(`\nNothing written (--check). ${relative(ROOT, join(ROOT, TEXT_OUTPUT))} is unchanged.\n`);
  }

  if (report.findings.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
