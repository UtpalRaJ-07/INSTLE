import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Audits JavaScript assets referenced in the generated Next.js homepage HTML (.next/server/app/index.html).
 * Per web standards (HTML Living Standard § 4.12.1.2) and Browserslist targets:
 * - Supported browsers (Chrome >= 100, Firefox >= 100, Safari >= 15, Edge >= 100, iOS Safari >= 15)
 *   download module and standard scripts, and skip scripts with the "nomodule" attribute.
 * - This script separates modern browser transfer from legacy fallback (nomodule) scripts,
 *   and reports both the actual browser download size and the combined unseparated total.
 */
const htmlPath = path.resolve('.next/server/app/index.html');
const CEILING_GZIP_KB = 170.0;

if (!fs.existsSync(htmlPath)) {
  console.error(`[measure-homepage-js] Error: ${htmlPath} not found. Run "npm run build" first.`);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = [...html.matchAll(/<script\b([^>]*)>/gi)];

const downloadedScripts = [];
const skippedNomoduleScripts = [];

for (const match of scriptMatches) {
  const attrs = match[1];
  const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
  if (!srcMatch) continue; // Skip inline scripts

  const src = srcMatch[1];
  const isNomodule = /nomodule/i.test(attrs);

  // Map /_next/static/... to .next/static/...
  const relativeStaticPath = src.replace(/^\/_next\//, '');
  const localFilePath = path.join('.next', relativeStaticPath);

  if (fs.existsSync(localFilePath)) {
    const rawBuffer = fs.readFileSync(localFilePath);
    const gzipBuffer = zlib.gzipSync(rawBuffer);

    const record = {
      src,
      rawBytes: rawBuffer.length,
      gzipBytes: gzipBuffer.length,
      rawKb: (rawBuffer.length / 1024).toFixed(2),
      gzipKb: (gzipBuffer.length / 1024).toFixed(2),
    };

    if (isNomodule) {
      skippedNomoduleScripts.push(record);
    } else {
      downloadedScripts.push(record);
    }
  } else {
    console.warn(`[WARNING] Referenced script file not found on disk: ${localFilePath}`);
  }
}

function printSection(title, list) {
  console.log(`\n${title}`);
  console.log('-'.repeat(74));
  console.log(
    'Script URL / Path'.padEnd(50) +
    'Raw (KB)'.padStart(12) +
    'Gzip (KB)'.padStart(12)
  );
  console.log('-'.repeat(74));

  let totalRaw = 0;
  let totalGzip = 0;

  for (const item of list) {
    totalRaw += item.rawBytes;
    totalGzip += item.gzipBytes;
    const displaySrc = item.src.length > 48 ? '...' + item.src.slice(-45) : item.src;
    console.log(
      displaySrc.padEnd(50) +
      item.rawKb.padStart(12) +
      item.gzipKb.padStart(12)
    );
  }

  const rawKb = (totalRaw / 1024).toFixed(2);
  const gzipKb = (totalGzip / 1024).toFixed(2);

  console.log('-'.repeat(74));
  console.log(
    'SUBTOTAL'.padEnd(50) +
    `${rawKb} KB`.padStart(12) +
    `${gzipKb} KB`.padStart(12)
  );

  return { totalRaw, totalGzip, rawKb, gzipKb };
}

console.log('='.repeat(74));
console.log('INSTLE REAL ESTATE — HOMEPAGE JAVASCRIPT BUDGET AUDIT');
console.log('='.repeat(74));
console.log(`Target Ceiling:              <= ${CEILING_GZIP_KB.toFixed(2)} KB (Gzip)`);
console.log(`Generated HTML File:         ${htmlPath}`);
console.log(`Total <script src="...">:    ${downloadedScripts.length + skippedNomoduleScripts.length}`);

// 1. Downloaded in Supported Browsers
const modernStats = printSection(
  '1. ACTUAL DOWNLOADS IN SUPPORTED BROWSERS (Modern Browserslist Target)',
  downloadedScripts
);

// 2. Skipped by Supported Browsers (nomodule fallback)
const legacyStats = printSection(
  '2. SKIPPED IN SUPPORTED BROWSERS (nomodule Fallback for Legacy Browsers)',
  skippedNomoduleScripts
);

// 3. Combined Totals
const combinedRawBytes = modernStats.totalRaw + legacyStats.totalRaw;
const combinedGzipBytes = modernStats.totalGzip + legacyStats.totalGzip;
const combinedRawKb = (combinedRawBytes / 1024).toFixed(2);
const combinedGzipKb = (combinedGzipBytes / 1024).toFixed(2);

const modernPassed = parseFloat(modernStats.gzipKb) <= CEILING_GZIP_KB;
const modernHeadroom = (CEILING_GZIP_KB - parseFloat(modernStats.gzipKb)).toFixed(2);

const combinedPassed = parseFloat(combinedGzipKb) <= CEILING_GZIP_KB;
const combinedOverage = (parseFloat(combinedGzipKb) - CEILING_GZIP_KB).toFixed(2);

console.log('\n' + '='.repeat(74));
console.log('SUMMARY EVALUATION');
console.log('='.repeat(74));
console.log(`Supported Browsers Actual Transfer:  ${modernStats.gzipKb} KB Gzip (${modernHeadroom} KB headroom) -> ${modernPassed ? 'PASS' : 'FAIL'}`);
console.log(`Legacy nomodule Skipped Fallback:   ${legacyStats.gzipKb} KB Gzip`);
console.log(`Combined Total (All HTML Scripts):   ${combinedGzipKb} KB Gzip (${combinedPassed ? 'PASS' : combinedOverage + ' KB over ceiling'})`);
console.log('='.repeat(74));
