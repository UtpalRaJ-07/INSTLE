import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Measures all JavaScript assets referenced in the generated Next.js homepage HTML.
 * Calculates both raw and gzip size for every <script src="..."> tag, including
 * framework chunks, app chunks, runtime, and polyfills.
 * Enforces the blueprint ceiling of <= 170 KB gzip.
 */
const htmlPath = path.resolve('.next/server/app/index.html');
const CEILING_GZIP_KB = 170.0;

if (!fs.existsSync(htmlPath)) {
  console.error(`[measure-homepage-js] Error: ${htmlPath} not found. Run "npm run build" first.`);
  process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/g)];
const scriptUrls = scriptMatches.map((m) => m[1]);

console.log('='.repeat(70));
console.log('INSTLE REAL ESTATE — HOMEPAGE JAVASCRIPT BUDGET AUDIT');
console.log('='.repeat(70));
console.log(`Generated HTML File: ${htmlPath}`);
console.log(`Total Script Tags Detected: ${scriptUrls.length}\n`);

let totalRawBytes = 0;
let totalGzipBytes = 0;

console.log(
  'Script File'.padEnd(46) +
  'Raw (KB)'.padStart(12) +
  'Gzip (KB)'.padStart(12)
);
console.log('-'.repeat(70));

for (const src of scriptUrls) {
  // Map /_next/static/... to .next/static/...
  const relativeStaticPath = src.replace(/^\/_next\//, '');
  const localFilePath = path.join('.next', relativeStaticPath);

  if (fs.existsSync(localFilePath)) {
    const rawBuffer = fs.readFileSync(localFilePath);
    const gzipBuffer = zlib.gzipSync(rawBuffer);

    totalRawBytes += rawBuffer.length;
    totalGzipBytes += gzipBuffer.length;

    const rawKb = (rawBuffer.length / 1024).toFixed(2);
    const gzipKb = (gzipBuffer.length / 1024).toFixed(2);
    const displaySrc = src.length > 44 ? '...' + src.slice(-41) : src;

    console.log(
      displaySrc.padEnd(46) +
      rawKb.padStart(12) +
      gzipKb.padStart(12)
    );
  } else {
    console.warn(`[WARNING] Referenced script file not found on disk: ${localFilePath}`);
  }
}

const totalRawKb = (totalRawBytes / 1024).toFixed(2);
const totalGzipKb = (totalGzipBytes / 1024).toFixed(2);
const headroomKb = (CEILING_GZIP_KB - parseFloat(totalGzipKb)).toFixed(2);
const passed = parseFloat(totalGzipKb) <= CEILING_GZIP_KB;

console.log('-'.repeat(70));
console.log(
  'TOTAL HOMEPAGE SCRIPTS'.padEnd(46) +
  `${totalRawKb} KB`.padStart(12) +
  `${totalGzipKb} KB`.padStart(12)
);
console.log('='.repeat(70));
console.log(`Ceiling Target:   <= ${CEILING_GZIP_KB.toFixed(2)} KB (Gzip)`);
console.log(`Actual Total:     ${totalGzipKb} KB (Gzip)`);
console.log(`Headroom:         ${headroomKb} KB`);
console.log(`Status:           ${passed ? 'PASS' : 'FAIL'}`);
console.log('='.repeat(70));

if (!passed) {
  console.error(`[measure-homepage-js] FAILED: Homepage JS exceeds budget of ${CEILING_GZIP_KB} KB`);
  process.exit(1);
}
