/**
 * Weighs the Bengaluru identity against the Requirement 9.17 budgets.
 *
 * 80 KB compressed for one illustration, map or texture; 150 KB compressed for
 * everything a single route requests. Both are measured, never asserted, in two
 * passes:
 *
 *  1. **Serialised.** Every drawing in the Media_Register is rendered with
 *     `renderToStaticMarkup` through the same Vite pipeline the test suite uses, so
 *     CSS module class names come out exactly as they do in
 *     `tests/media-register-entries.test.tsx`. The `<svg>` carrying the asset's
 *     `data-asset-id` is cut out and gzipped. This is the method the register's
 *     `compressedBytes` is recorded by, and the only way to weigh the texture and
 *     the per-locality plate while no published route renders them.
 *  2. **Served.** The production build is started with `next start`, every public
 *     route is fetched over HTTP, and each `<svg data-asset-id>` in the HTML is
 *     weighed. `/areas` and `/areas/[slug]` are rendered per request, so their HTML
 *     exists only when served; reading `.next/server/app` would miss them.
 *
 * What a route "requests" for a drawing is more than the `<svg>`. Every Bengaluru
 * component is a server component, so the App Router also serialises the same
 * element tree into the RSC payload (`self.__next_f.push(...)`) inline in the same
 * HTML, for hydration and client navigation — the `<svg>` row plus every row its
 * child components were outlined into. The served weight of an asset is therefore
 * its `<svg>` plus that flight copy, each gzipped on its own. Gzipping separately
 * over-counts slightly against the page's single gzip stream, which is the safe
 * direction for a ceiling.
 *
 * Served against recorded. The recorded weight is the serialised `<svg>`, and the
 * served `<svg>` is byte-identical to it except for CSS module class names: the
 * test pipeline emits `_drawing_ieu27_32`, the production build
 * `Bengaluru-module__0TwnnG__drawing`. So a served `<svg>` may sit a few bytes
 * above the recorded figure without the record being wrong. The script allows
 *
 *     max(16, ceil(1% of recorded)) + raw bytes of the served <svg>'s class values
 *
 * — the first term is the zlib tolerance the test already applies, the second an
 * upper bound on what naming alone can add, since class values are the only bytes
 * that differ. It checks that premise rather than assuming it: every served `<svg>`
 * is compared with its serialised twin with class values removed, and the result is
 * reported. A served `<svg>` heavier than recorded by more than the allowance fails:
 * that is a redraw the register did not follow, not naming noise.
 *
 * Exit code 1 on any finding, each named with the asset or route responsible:
 *
 *  - a serialised, recorded or served asset above 80 KB, or a route above 150 KB;
 *  - a recorded weight more than max(16 B, 1%) from the serialised measurement;
 *  - a served `<svg>` heavier than recorded by more than the allowance above;
 *  - a route whose served HTML carries an asset the register does not map to it,
 *    or omits one it does, so `STATIC_ROUTE_VISUAL_ASSETS` and
 *    `localityVisualAssetIds` are checked against what is served;
 *  - a Requirement 9.2 route carrying no Bengaluru element;
 *  - a public route that does not answer 200, a nested `<svg>`, an asset missing
 *    from the register, a register entry this script cannot serialise, or a flight
 *    copy that does not reach every element its `<svg>` draws (an undercount).
 *
 * Usage:
 *   npm run build
 *   node scripts/measure-visual-assets.mjs [outFile] [--port=3217] [--base-url=URL]
 *
 * Without `--base-url` the script starts `next start` on 127.0.0.1 at `--port`
 * (default 3217), refuses to run if that port is taken, and stops the server it
 * started before exiting. With `--base-url` it measures a server you already run and
 * leaves it alone. Output defaults to docs/implementation/visual-asset-weights.json.
 */

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createConnection, createServer as createNetServer } from 'node:net';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

import { registerTypeScriptResolution, REPOSITORY_ROOT } from './lib/ts-module-loader.mjs';

registerTypeScriptResolution();

const {
  VISUAL_ASSET_REGISTER,
  STATIC_ROUTE_VISUAL_ASSETS,
  ASSET_COMPRESSED_BYTE_BUDGET,
  ROUTE_COMPRESSED_BYTE_BUDGET,
  MEASURED_COMPRESSED_BYTES,
  MAX_NEIGHBOUR_PLATES,
  STREETSCAPE_FULL_ASSET_ID,
  STREETSCAPE_CROPPED_ASSET_ID,
  CORRIDOR_ASSET_ID,
  LAYOUT_GRID_ASSET_ID,
  areaOrientationAssetId,
  buildAreaOrientationAsset,
  getVisualAsset,
  localityVisualAssetIds,
} = await import('@/config/media-register');
const { LOCALITY_REGISTRY } = await import('@/config/localities');
const { getPublishedAreaRecords } = await import('@/config/locality-sections');
const { getPublicRoutes } = await import('@/lib/public-routes');

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const positional = argv.filter((arg) => !arg.startsWith('--'));

const OUT_FILE = positional[0] ?? join(REPOSITORY_ROOT, 'docs', 'implementation', 'visual-asset-weights.json');
const EXTERNAL_BASE_URL = flag('base-url')?.replace(/\/$/, '');
const PORT = Number(flag('port') ?? 3217);

/** Requirement 9.2: these routes must each carry at least one Bengaluru element. */
const ROUTES_REQUIRING_AN_ELEMENT = ['/', '/buy', '/sell', '/rent', '/rent-out', '/commercial'];

const findings = [];
function record(kind, detail) {
  findings.push({ kind, ...detail });
}

// ---------------------------------------------------------------------------
// Shared measurement
// ---------------------------------------------------------------------------

const gzipBytes = (text) => gzipSync(Buffer.from(text, 'utf8')).length;

/** The test suite's rule: 1%, and never less than 16 bytes. */
function zlibTolerance(bytes) {
  return Math.max(16, Math.ceil(bytes * 0.01));
}

/** Raw bytes of every `class` value inside the markup: the only bytes the renderers name differently. */
function classValueBytes(markup) {
  return [...markup.matchAll(/\sclass="([^"]*)"/g)].reduce(
    (total, match) => total + Buffer.byteLength(match[1], 'utf8'),
    0
  );
}

const withoutClassValues = (markup) => markup.replace(/\sclass="[^"]*"/g, '');

/**
 * Every `<svg>` in the markup that carries a `data-asset-id`, with its exact span.
 *
 * None of these drawings nests an `<svg>`, so the first `</svg>` after the opening
 * tag closes it — the same span the test cuts. The assumption is checked: a nested
 * `<svg` inside the span is reported.
 */
function extractDrawings(markup) {
  const drawings = [];
  for (const match of markup.matchAll(/<svg\b[^>]*>/g)) {
    const idMatch = match[0].match(/data-asset-id="([^"]+)"/);
    if (!idMatch) continue;
    const end = markup.indexOf('</svg>', match.index);
    if (end === -1) continue;
    const span = markup.slice(match.index, end + '</svg>'.length);
    drawings.push({ assetId: idMatch[1], markup: span, nested: span.slice(match[0].length).includes('<svg') });
  }
  return drawings;
}

// ---------------------------------------------------------------------------
// Pass 1: serialise every registered drawing
// ---------------------------------------------------------------------------

/**
 * The heaviest orientation plate the registry can produce: the longest canonical
 * name in the centre and the next four longest around it, as the weight test
 * builds it. A real record is used so the asset ID carries a real slug.
 */
function worstCasePlateRecord() {
  const longest = [...LOCALITY_REGISTRY]
    .sort((a, b) => b.canonicalName.length - a.canonicalName.length)
    .slice(0, 1 + MAX_NEIGHBOUR_PLATES);
  return {
    ...longest[0],
    approvedNearbyRelationships: longest.slice(1).map((neighbour) => ({
      slug: neighbour.slug,
      relationship: 'sits beside this area',
      claimId: null,
      // The gated name, exactly as a locality page hands it over.
      // `neighbourDisplayName` falls back to the slug when a relationship carries
      // no name, and a slug is shorter than the canonical name it came from — so
      // omitting this drew a *lighter* plate than the registry can produce and
      // called it the worst case. Task 18.2 saw the consequence: this script
      // serialised 742 B against the 759 B recorded in `media-register.ts`, and
      // reported 17 B of drift, while `tests/media-register-entries.test.tsx`
      // — which does set the name — measured the recorded figure and passed.
      // The register's own basis is "the longest canonical name in the centre and
      // the next four longest around it", which is names, not slugs.
      name: neighbour.canonicalName,
    })),
  };
}

async function serialiseDrawings() {
  // `vitest/node` re-exports Vite's server, so this is the declared devDependency
  // and the test suite's own config, not a second pipeline.
  const { createViteServer } = await import('vitest/node');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');

  const vite = await createViteServer({
    root: REPOSITORY_ROOT,
    configFile: join(REPOSITORY_ROOT, 'vitest.config.ts'),
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
  });

  try {
    const components = await vite.ssrLoadModule('/src/components/Bengaluru/index.ts');
    const plateRecord = worstCasePlateRecord();
    const plateAssetId = areaOrientationAssetId(plateRecord.slug);

    const subjects = [
      { assetId: STREETSCAPE_FULL_ASSET_ID, element: createElement(components.CivicStreetscapeBand) },
      {
        assetId: STREETSCAPE_CROPPED_ASSET_ID,
        element: createElement(components.CivicStreetscapeBand, { variant: 'cropped' }),
      },
      { assetId: CORRIDOR_ASSET_ID, element: createElement(components.CorridorDiagram) },
      {
        // The texture renders only inside the typographic fallback, so it is
        // weighed there, carrying the positioning class that context adds.
        assetId: LAYOUT_GRID_ASSET_ID,
        element: createElement(components.TypographicPlate, {
          kicker: 'Bengaluru',
          name: plateRecord.canonicalName,
          note: 'No orientation map yet.',
        }),
      },
      {
        assetId: plateAssetId,
        registerKey: 'MAP-AREA',
        note: `worst case: ${plateRecord.canonicalName} with the ${MAX_NEIGHBOUR_PLATES} next-longest names`,
        element: createElement(components.AreaOrientationPlate, { record: plateRecord }),
      },
    ];

    const serialised = subjects.map((subject) => {
      const drawing = extractDrawings(renderToStaticMarkup(subject.element)).find(
        (candidate) => candidate.assetId === subject.assetId
      );
      if (!drawing) throw new Error(`${subject.assetId} is not in its component's rendered markup`);
      const recordedBytes =
        subject.registerKey !== undefined
          ? MEASURED_COMPRESSED_BYTES[subject.registerKey]
          : getVisualAsset(subject.assetId)?.compressedBytes;
      return {
        assetId: subject.assetId,
        registerKey: subject.registerKey ?? subject.assetId,
        note: subject.note,
        markup: drawing.markup,
        rawBytes: Buffer.byteLength(drawing.markup, 'utf8'),
        compressedBytes: gzipBytes(drawing.markup),
        recordedBytes,
      };
    });

    for (const asset of VISUAL_ASSET_REGISTER) {
      if (!serialised.some((entry) => entry.assetId === asset.assetId)) {
        record('asset-not-serialised', { assetId: asset.assetId, component: asset.delivery.componentName });
      }
    }
    return serialised;
  } finally {
    await vite.close();
  }
}

const serialised = await serialiseDrawings();

for (const entry of serialised) {
  if (entry.compressedBytes > ASSET_COMPRESSED_BYTE_BUDGET) {
    record('asset-over-budget', {
      assetId: entry.assetId,
      measuredAs: 'serialised',
      compressedBytes: entry.compressedBytes,
      budget: ASSET_COMPRESSED_BYTE_BUDGET,
    });
  }
  if (typeof entry.recordedBytes !== 'number') {
    record('asset-not-registered', { assetId: entry.assetId, measuredAs: 'serialised' });
    continue;
  }
  if (entry.recordedBytes > ASSET_COMPRESSED_BYTE_BUDGET) {
    record('asset-over-budget', {
      assetId: entry.assetId,
      measuredAs: 'recorded',
      compressedBytes: entry.recordedBytes,
      budget: ASSET_COMPRESSED_BYTE_BUDGET,
    });
  }
  const drift = Math.abs(entry.recordedBytes - entry.compressedBytes);
  if (drift > zlibTolerance(entry.compressedBytes)) {
    record('recorded-weight-drift', {
      assetId: entry.assetId,
      recordedBytes: entry.recordedBytes,
      serialisedBytes: entry.compressedBytes,
      toleranceBytes: zlibTolerance(entry.compressedBytes),
    });
  }
}

// ---------------------------------------------------------------------------
// Pass 2: fetch every public route from the production server
// ---------------------------------------------------------------------------

/** True when something already listens on the port, on the wildcard or on loopback. */
async function portInUse(port) {
  // Binding 127.0.0.1 alone can succeed beside an existing `*:port` listener on
  // macOS, and the script would then fetch from whichever socket the OS picks. So
  // the wildcard bind is tried first, then a plain connection attempt on loopback.
  const bindFails = (host) =>
    new Promise((resolvePromise) => {
      const probe = createNetServer();
      // A host without IPv6 answers EADDRNOTAVAIL or EAFNOSUPPORT, which says nothing about the port.
      probe.once('error', (error) => resolvePromise(error.code === 'EADDRINUSE' || error.code === 'EACCES'));
      probe.listen({ port, host, exclusive: true }, () => probe.close(() => resolvePromise(false)));
    });
  const connects = (host) =>
    new Promise((resolvePromise) => {
      const socket = createConnection({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.once('error', () => resolvePromise(false));
    });
  return (await bindFails('::')) || (await bindFails('127.0.0.1')) || (await connects('127.0.0.1')) || connects('::1');
}

async function assertPortFree(port) {
  if (await portInUse(port)) {
    throw new Error(`Port ${port} is in use. Pass --port=<free port> or --base-url=<running server>.`);
  }
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** Runs `measure` against a server: the caller's, or a `next start` this script owns and stops. */
async function withServer(measure) {
  if (EXTERNAL_BASE_URL) return measure(EXTERNAL_BASE_URL);

  if (!existsSync(join(REPOSITORY_ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('No production build in .next. Run `npm run build` first.');
  }
  await assertPortFree(PORT);

  const nextBin = join(REPOSITORY_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  // Detached into its own process group so the whole group can be stopped,
  // including any worker `next start` forks.
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: REPOSITORY_ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  let serverLog = '';
  child.stdout.on('data', (chunk) => (serverLog += chunk));
  child.stderr.on('data', (chunk) => (serverLog += chunk));
  let exited = false;
  const exitedPromise = new Promise((resolvePromise) =>
    child.once('exit', () => {
      exited = true;
      resolvePromise();
    })
  );

  const stop = async () => {
    if (exited) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    await Promise.race([exitedPromise, sleep(5000)]);
    if (!exited) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
      await Promise.race([exitedPromise, sleep(2000)]);
    }
  };
  const onSignal = () => stop().finally(() => process.exit(130));
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  const baseUrl = `http://127.0.0.1:${PORT}`;
  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      if (exited) throw new Error(`next start exited before serving:\n${serverLog}`);
      try {
        const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
        await response.arrayBuffer();
        break;
      } catch {
        if (Date.now() > deadline) throw new Error(`next start did not answer within 60 s:\n${serverLog}`);
        await sleep(250);
      }
    }
    return await measure(baseUrl);
  } finally {
    await stop();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

/** Next's `htmlEscapeJsonString`: how a flight chunk is escaped inside the inline script. */
const HTML_JSON_ESCAPES = { '&': '\\u0026', '<': '\\u003c', '>': '\\u003e', '\u2028': '\\u2028', '\u2029': '\\u2029' };
const escapeForInlineScript = (text) => text.replace(/[&<>\u2028\u2029]/g, (character) => HTML_JSON_ESCAPES[character]);

/** The RSC payload an App Router page inlines, decoded and concatenated. */
function decodeFlight(html) {
  let flight = '';
  for (const match of html.matchAll(/<script>self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try {
      const chunk = JSON.parse(match[1]);
      if (chunk[0] === 1 && typeof chunk[1] === 'string') flight += chunk[1];
    } catch {
      /* not a text chunk */
    }
  }
  return flight;
}

/** Index of the bracket closing the JSON array or object opened at `start`. */
function matchingBracket(text, start) {
  let depth = 0;
  let inString = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (character === '\\') index += 1;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === '[' || character === '{') depth += 1;
    else if (character === ']' || character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** UTF-8 length of one code point. */
const utf8Length = (codePoint) => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4);

/**
 * The flight stream's rows by ID: `<hex id>:<payload>\n`, or `<hex id>:T<hex byte
 * length>,<text>` for an outlined string, which has no newline. Hint rows carry no
 * ID and are skipped.
 */
function indexFlightRows(flight) {
  const rows = new Map();
  let index = 0;
  while (index < flight.length) {
    const colon = flight.indexOf(':', index);
    if (colon === -1) break;
    const id = flight.slice(index, colon);
    if (!/^[0-9a-f]+$/.test(id)) {
      const newline = flight.indexOf('\n', index);
      if (newline === -1) break;
      index = newline + 1;
      continue;
    }
    if (flight[colon + 1] === 'T') {
      const comma = flight.indexOf(',', colon);
      const byteLength = Number.parseInt(flight.slice(colon + 2, comma), 16);
      let end = comma + 1;
      for (let counted = 0; counted < byteLength && end < flight.length; ) {
        const codePoint = flight.codePointAt(end);
        counted += utf8Length(codePoint);
        end += codePoint > 0xffff ? 2 : 1;
      }
      rows.set(id, { start: index, end, kind: 'text' });
      index = end;
      continue;
    }
    const newline = flight.indexOf('\n', colon);
    const end = newline === -1 ? flight.length : newline + 1;
    const lead = flight[colon + 1];
    rows.set(id, { start: index, end, kind: lead === '[' || lead === '{' || lead === '"' ? 'model' : 'other' });
    index = end;
  }
  return rows;
}

/** Row IDs a flight model references: `"$<id>"`, `"$L<id>"` (lazy), `"$@<id>"`, with or without a `:path`. */
const flightReferences = (text) => [...text.matchAll(/"\$[L@]?([0-9a-f]+)(?::[^"]*)?"/g)].map((match) => match[1]);

/**
 * The flight copy of each asset's `<svg>` element, in order of appearance, as the
 * bytes that sit in the HTML.
 *
 * The element does not arrive in one piece: each child component's output is
 * outlined into its own row and referenced as `"$L1e"`, so the copy is the element
 * plus every model or text row it reaches, followed transitively. Module-reference
 * and hint rows are not drawing bytes and are not followed. `locatedVerbatim`
 * records whether every piece, escaped as Next escapes it, was found in the served
 * HTML — false only if a push-chunk boundary splits one.
 */
function flightCopies(html, flight, rows, assetId) {
  const copies = [];
  const needle = `"data-asset-id":"${assetId}"`;
  for (let at = flight.indexOf(needle); at !== -1; at = flight.indexOf(needle, at + needle.length)) {
    const start = flight.lastIndexOf('["$","svg",', at);
    const end = start === -1 ? -1 : matchingBracket(flight, start);
    if (end === -1) continue;

    const pieces = [flight.slice(start, end + 1)];
    const seen = new Set();
    const queue = flightReferences(pieces[0]);
    while (queue.length > 0) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const row = rows.get(id);
      if (!row || row.kind === 'other') continue;
      const text = flight.slice(row.start, row.end);
      pieces.push(text);
      if (row.kind === 'model') queue.push(...flightReferences(text));
    }

    const served = pieces.map((piece) => escapeForInlineScript(JSON.stringify(piece).slice(1, -1)));
    const joined = served.join('');
    copies.push({
      rows: pieces.length,
      hostElements: pieces.reduce((total, piece) => total + (piece.match(/\["\$","[a-z][a-zA-Z0-9]*"/g) ?? []).length, 0),
      rawBytes: Buffer.byteLength(joined, 'utf8'),
      compressedBytes: gzipBytes(joined),
      locatedVerbatim: served.every((piece) => html.includes(piece)),
    });
  }
  return copies;
}

const now = new Date();
const publishedAreas = new Map(getPublishedAreaRecords(now).map((area) => [`/areas/${area.slug}`, area]));

/** What the register says a route renders. */
function declaredAssetIds(route) {
  if (STATIC_ROUTE_VISUAL_ASSETS[route]) return [...STATIC_ROUTE_VISUAL_ASSETS[route]];
  const area = publishedAreas.get(route);
  return area ? [...localityVisualAssetIds(area)] : [];
}

/** The register entry for an asset ID, including a published record's plate. */
function registeredAsset(assetId) {
  const asset = getVisualAsset(assetId);
  if (asset) return asset;
  for (const area of publishedAreas.values()) {
    if (areaOrientationAssetId(area.slug) === assetId) return buildAreaOrientationAsset(area);
  }
  return undefined;
}

const serialisedById = new Map(serialised.map((entry) => [entry.assetId, entry]));

const routes = [
  ...new Set([...getPublicRoutes(now).map((route) => route.path), ...Object.keys(STATIC_ROUTE_VISUAL_ASSETS)]),
];

let buildId = null;
try {
  buildId = readFileSync(join(REPOSITORY_ROOT, '.next', 'BUILD_ID'), 'utf8').trim();
} catch {
  /* reported as null */
}

const { servedFrom, routeReports } = await withServer(async (baseUrl) => {
  const reports = [];
  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual', headers: { accept: 'text/html' } });
    const html = await response.text();
    if (response.status !== 200) {
      record('route-not-served', { route, status: response.status });
      reports.push({ route, status: response.status, assets: [], routeCompressedBytes: 0 });
      continue;
    }

    const flight = decodeFlight(html);
    const flightRows = indexFlightRows(flight);
    const drawings = extractDrawings(html);
    const flightById = new Map();

    const assets = drawings.map((drawing) => {
      if (drawing.nested) record('nested-svg', { route, assetId: drawing.assetId });
      if (!flightById.has(drawing.assetId)) {
        flightById.set(drawing.assetId, flightCopies(html, flight, flightRows, drawing.assetId));
      }
      const flightCopy = flightById.get(drawing.assetId).shift() ?? null;
      // The flight copy must reach every element the <svg> draws, or it is undercounted.
      const svgElements = (drawing.markup.match(/<[a-z][a-zA-Z0-9]*[\s>/]/g) ?? []).length;
      if (flightCopy && (flightCopy.hostElements !== svgElements || !flightCopy.locatedVerbatim)) {
        record('flight-copy-incomplete', {
          route,
          assetId: drawing.assetId,
          svgElements,
          flightHostElements: flightCopy.hostElements,
          locatedVerbatim: flightCopy.locatedVerbatim,
        });
      }

      const svgCompressedBytes = gzipBytes(drawing.markup);
      const servedCompressedBytes = svgCompressedBytes + (flightCopy?.compressedBytes ?? 0);
      if (servedCompressedBytes > ASSET_COMPRESSED_BYTE_BUDGET) {
        record('asset-over-budget', {
          route,
          assetId: drawing.assetId,
          measuredAs: 'served',
          compressedBytes: servedCompressedBytes,
          budget: ASSET_COMPRESSED_BYTE_BUDGET,
        });
      }

      const recordedBytes = registeredAsset(drawing.assetId)?.compressedBytes ?? null;
      const twin = serialisedById.get(drawing.assetId);
      const allowanceBytes = recordedBytes === null ? null : zlibTolerance(recordedBytes) + classValueBytes(drawing.markup);
      const servedMinusRecordedBytes = recordedBytes === null ? null : svgCompressedBytes - recordedBytes;

      if (recordedBytes === null) {
        record('asset-not-registered', { route, assetId: drawing.assetId });
      } else if (servedMinusRecordedBytes > allowanceBytes) {
        record('served-weight-understated', {
          route,
          assetId: drawing.assetId,
          recordedBytes,
          servedSvgBytes: svgCompressedBytes,
          allowanceBytes,
        });
      }

      return {
        assetId: drawing.assetId,
        svg: { rawBytes: Buffer.byteLength(drawing.markup, 'utf8'), compressedBytes: svgCompressedBytes },
        flightCopy,
        servedCompressedBytes,
        recordedBytes,
        servedMinusRecordedBytes,
        allowanceBytes,
        identicalToSerialisedApartFromClassNames: twin
          ? withoutClassValues(twin.markup) === withoutClassValues(drawing.markup)
          : null,
      };
    });

    const routeCompressedBytes = assets.reduce((total, asset) => total + asset.servedCompressedBytes, 0);
    if (routeCompressedBytes > ROUTE_COMPRESSED_BYTE_BUDGET) {
      record('route-over-budget', { route, compressedBytes: routeCompressedBytes, budget: ROUTE_COMPRESSED_BYTE_BUDGET });
    }

    const rendered = assets.map((asset) => asset.assetId).sort();
    const declared = declaredAssetIds(route).sort();
    if (rendered.join('|') !== declared.join('|')) {
      record('route-asset-mismatch', { route, declared, rendered });
    }

    reports.push({ route, status: response.status, assets, routeCompressedBytes });
  }
  return { servedFrom: EXTERNAL_BASE_URL ? baseUrl : `next start (build ${buildId}), ${baseUrl}`, routeReports: reports };
});

for (const route of ROUTES_REQUIRING_AN_ELEMENT) {
  const report = routeReports.find((entry) => entry.route === route);
  if (!report || report.assets.length === 0) record('required-element-absent', { route });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const assetSummary = serialised.map((entry) => {
  const servedOn = routeReports.flatMap((report) =>
    report.assets.filter((asset) => asset.assetId === entry.assetId).map((asset) => ({ route: report.route, asset }))
  );
  const heaviestServed = servedOn.reduce((max, { asset }) => Math.max(max, asset.servedCompressedBytes), 0);
  return {
    assetId: entry.assetId,
    registerKey: entry.registerKey,
    ...(entry.note ? { note: entry.note } : {}),
    recordedBytes: entry.recordedBytes,
    serialised: { rawBytes: entry.rawBytes, compressedBytes: entry.compressedBytes },
    servedOnRoutes: servedOn.map(({ route }) => route),
    heaviestServedCompressedBytes: servedOn.length > 0 ? heaviestServed : null,
    budgetBytes: ASSET_COMPRESSED_BYTE_BUDGET,
    withinBudget: Math.max(entry.compressedBytes, entry.recordedBytes ?? 0, heaviestServed) <= ASSET_COMPRESSED_BYTE_BUDGET,
  };
});

const assetRoutes = routeReports.filter((report) => report.assets.length > 0);
const report = {
  generatedAt: now.toISOString(),
  requirement: '9.17',
  budgets: {
    perAssetCompressedBytes: ASSET_COMPRESSED_BYTE_BUDGET,
    perRouteCompressedBytes: ROUTE_COMPRESSED_BYTE_BUDGET,
  },
  method: {
    compression: 'gzip, Node zlib default level, each span compressed on its own (18-byte header included)',
    serialised:
      'renderToStaticMarkup through the vitest.config.ts Vite pipeline; the <svg data-asset-id> span is weighed — the method compressedBytes is recorded by',
    served: `HTTP GET of every public route from ${servedFrom}; an asset's served weight is its <svg> span plus its RSC flight copy inlined in the same HTML`,
    servedAgainstRecorded:
      'served <svg> may exceed recorded by max(16, ceil(1% of recorded)) + raw bytes of its class values; production and test CSS module class names differ and nothing else does (checked per asset below)',
  },
  assets: assetSummary,
  routes: assetRoutes,
  routesWithoutAssets: routeReports.filter((entry) => entry.assets.length === 0).map((entry) => entry.route),
  findings,
};

await writeFile(OUT_FILE, `${JSON.stringify(report, null, 2)}\n`);

const kb = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
const bytes = (value) => (value === null || value === undefined ? '—' : `${value} B`);
const line = (character) => console.log(character.repeat(96));

line('=');
console.log('INSTLE REAL ESTATE — BENGALURU VISUAL ASSET WEIGHT AUDIT (Requirement 9.17)');
line('=');
console.log(`Per asset budget:  <= ${kb(ASSET_COMPRESSED_BYTE_BUDGET)} gzip   Per route budget:  <= ${kb(ROUTE_COMPRESSED_BYTE_BUDGET)} gzip`);
console.log(`Served from:       ${servedFrom}`);
line('-');
console.log('PER ASSET'.padEnd(40) + 'Recorded'.padStart(12) + 'Serialised'.padStart(12) + 'Served max'.padStart(12) + '  Budget');
line('-');
for (const asset of assetSummary) {
  console.log(
    asset.assetId.slice(0, 39).padEnd(40) +
      bytes(asset.recordedBytes).padStart(12) +
      bytes(asset.serialised.compressedBytes).padStart(12) +
      bytes(asset.heaviestServedCompressedBytes).padStart(12) +
      `  ${asset.withinBudget ? 'PASS' : 'FAIL'}${asset.servedOnRoutes.length === 0 ? ' (no public route serves it)' : ''}`
  );
}
line('-');
console.log(
  'PER ROUTE'.padEnd(16) +
    'Asset'.padEnd(24) +
    '<svg>'.padStart(9) +
    'flight'.padStart(9) +
    'served'.padStart(9) +
    'vs rec.'.padStart(10) +
    'allow'.padStart(8) +
    '  class-only diff'
);
line('-');
for (const routeReport of assetRoutes) {
  for (const asset of routeReport.assets) {
    const delta = asset.servedMinusRecordedBytes;
    console.log(
      routeReport.route.padEnd(16) +
        asset.assetId.slice(0, 23).padEnd(24) +
        bytes(asset.svg.compressedBytes).padStart(9) +
        bytes(asset.flightCopy?.compressedBytes).padStart(9) +
        bytes(asset.servedCompressedBytes).padStart(9) +
        (delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta} B`).padStart(10) +
        bytes(asset.allowanceBytes).padStart(8) +
        `  ${asset.identicalToSerialisedApartFromClassNames === null ? '—' : asset.identicalToSerialisedApartFromClassNames ? 'yes' : 'NO'}`
    );
  }
  console.log(
    `${routeReport.route.padEnd(16)}${'ROUTE TOTAL'.padEnd(24)}${''.padStart(18)}${bytes(routeReport.routeCompressedBytes).padStart(9)}` +
      `  (${kb(routeReport.routeCompressedBytes)} of ${kb(ROUTE_COMPRESSED_BYTE_BUDGET)}) ${routeReport.routeCompressedBytes <= ROUTE_COMPRESSED_BYTE_BUDGET ? 'PASS' : 'FAIL'}`
  );
}
line('-');
console.log(`Public routes with no Bengaluru asset: ${report.routesWithoutAssets.join(', ') || 'none'}`);
console.log(`Report: ${relative(REPOSITORY_ROOT, OUT_FILE)}`);
console.log(`Findings: ${findings.length}`);
for (const finding of findings) console.log(`  [${finding.kind}] ${JSON.stringify(finding)}`);
line('=');

if (findings.length > 0) process.exitCode = 1;
