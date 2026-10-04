/**
 * Weighs the scripts the homepage requests, from the HTML a browser is actually served.
 *
 * Why this exists beside `measure-homepage-js.js`. That script reads
 * `.next/server/app/index.html`, the prerendered homepage. The homepage is now
 * `export const dynamic = 'force-dynamic'` — it lists what the publication gate
 * admits at the date of the request, which is Requirement 1.3 and the disagreement
 * Property 2 rules out — so the build produces no prerendered homepage HTML and
 * `npm run measure:js` exits 1 with "index.html not found". The budget in
 * Requirement 9.6 is about what a browser downloads, and that is still measurable:
 * start the production server, fetch the page, and weigh every script it references.
 *
 * Method, deliberately the same arithmetic as `measure-homepage-js.js` so the two
 * figures are comparable:
 *
 *  - every `<script src>` in the served HTML is resolved to its file under `.next/`
 *    and gzipped on its own;
 *  - a `nomodule` script is counted separately, because a browser in the declared
 *    Browserslist range does not download it;
 *  - the modern total is the figure compared with the 170 KB ceiling.
 *
 * Gzipping each file separately over-counts slightly against one stream per
 * response, which is the safe direction for a ceiling. These are build-artefact
 * gzip estimates, not a browser network measurement.
 *
 * Usage:
 *   npm run build
 *   node scripts/measure-served-scripts.mjs [--port=3219] [--base-url=URL] [--route=/]
 *
 * Exits 1 if a route's modern total exceeds the ceiling, or if a referenced script
 * is missing from disk.
 */

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createConnection, createServer as createNetServer } from 'node:net';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

import { REPOSITORY_ROOT } from './lib/ts-module-loader.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const EXTERNAL_BASE_URL = flag('base-url')?.replace(/\/$/, '');
const PORT = Number(flag('port') ?? 3219);
const ROUTES = argv.filter((arg) => arg.startsWith('--route=')).map((arg) => arg.slice('--route='.length));
const CEILING_GZIP_KB = 170;

const routes = ROUTES.length > 0 ? ROUTES : ['/'];
const findings = [];
const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** True when something already listens on the port, on the wildcard or on loopback. */
async function portInUse(port) {
  const bindFails = (host) =>
    new Promise((resolvePromise) => {
      const probe = createNetServer();
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

/** Runs `measure` against a server: the caller's, or a `next start` this script owns and stops. */
async function withServer(measure) {
  if (EXTERNAL_BASE_URL) return measure(EXTERNAL_BASE_URL);

  if (!existsSync(join(REPOSITORY_ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('No production build in .next. Run `npm run build` first.');
  }
  if (await portInUse(PORT)) {
    throw new Error(`Port ${PORT} is in use. Pass --port=<free port> or --base-url=<running server>.`);
  }

  const nextBin = join(REPOSITORY_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
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

const kb = (bytes) => Number((bytes / 1024).toFixed(2));

const report = await withServer(async (baseUrl) => {
  const routeReports = [];

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: 'manual', headers: { accept: 'text/html' } });
    const html = await response.text();
    if (response.status !== 200) {
      findings.push({ kind: 'route-not-served', route, status: response.status });
      continue;
    }

    const modern = [];
    const legacy = [];
    let inlineScripts = 0;

    for (const match of html.matchAll(/<script\b([^>]*)>/gi)) {
      const attributes = match[1];
      const src = attributes.match(/src=["']([^"']+)["']/i)?.[1];
      if (!src) {
        inlineScripts += 1;
        continue;
      }
      const filePath = join(REPOSITORY_ROOT, '.next', src.replace(/^\/_next\//, ''));
      if (!existsSync(filePath)) {
        findings.push({ kind: 'referenced-script-missing', route, src, filePath });
        continue;
      }
      const raw = readFileSync(filePath);
      const entry = { src, rawBytes: raw.length, compressedBytes: gzipSync(raw).length };
      (/nomodule/i.test(attributes) ? legacy : modern).push(entry);
    }

    const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);
    const modernCompressed = sum(modern, 'compressedBytes');
    const legacyCompressed = sum(legacy, 'compressedBytes');

    if (kb(modernCompressed) > CEILING_GZIP_KB) {
      findings.push({
        kind: 'over-script-budget',
        route,
        compressedKb: kb(modernCompressed),
        ceilingKb: CEILING_GZIP_KB,
      });
    }

    routeReports.push({
      route,
      status: response.status,
      inlineScripts,
      modernScripts: modern.length,
      legacyNomoduleScripts: legacy.length,
      modernCompressedKb: kb(modernCompressed),
      modernRawKb: kb(sum(modern, 'rawBytes')),
      legacyCompressedKb: kb(legacyCompressed),
      combinedCompressedKb: kb(modernCompressed + legacyCompressed),
      headroomKb: Number((CEILING_GZIP_KB - kb(modernCompressed)).toFixed(2)),
      scripts: [...modern, ...legacy].map((entry) => ({
        src: entry.src,
        compressedKb: kb(entry.compressedBytes),
        nomodule: legacy.includes(entry),
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    baseUrl,
    buildId: existsSync(join(REPOSITORY_ROOT, '.next', 'BUILD_ID'))
      ? readFileSync(join(REPOSITORY_ROOT, '.next', 'BUILD_ID'), 'utf8').trim()
      : null,
    ceilingCompressedKb: CEILING_GZIP_KB,
    method: 'served HTML, each <script src> gzipped from .next on its own; nomodule counted apart',
    routes: routeReports,
    findings,
  };
});

const outFile = join(REPOSITORY_ROOT, 'docs', 'implementation', 'served-script-weights.json');
await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Served from: ${report.baseUrl} (build ${report.buildId})`);
for (const route of report.routes) {
  console.log(
    `${route.route.padEnd(12)} modern ${String(route.modernCompressedKb).padStart(7)} KB gzip ` +
      `(${route.modernScripts} scripts, ${route.headroomKb} KB headroom against ${CEILING_GZIP_KB} KB) ` +
      `| nomodule ${route.legacyCompressedKb} KB | combined ${route.combinedCompressedKb} KB`
  );
}
console.log(`Findings: ${findings.length}`);
for (const finding of findings) console.log(`  ${JSON.stringify(finding)}`);
console.log(`wrote ${outFile}`);

if (findings.length > 0) process.exitCode = 1;
