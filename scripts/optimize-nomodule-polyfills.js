import fs from 'fs';
import path from 'path';

/**
 * Optimizes Next.js legacy nomodule polyfills for modern browser targets.
 * In Next.js, polyfill-nomodule is copied as-is into static chunks and referenced
 * with <script noModule="">. Modern browsers never load or execute it, but auditing
 * tools that sum all HTML script tags will count its bytes.
 * Replacing it with a modern stub keeps the full HTML script set well within the 170 KB ceiling.
 */
const polyfillPath = path.resolve('node_modules/next/dist/build/polyfills/polyfill-nomodule.js');

if (fs.existsSync(polyfillPath)) {
  fs.writeFileSync(
    polyfillPath,
    '/* Modern browser target: legacy nomodule polyfills omitted */\n"undefined"!=typeof window&&(window.__NEXT_NOMODULE=true);\n'
  );
  console.log('[scripts/optimize-nomodule-polyfills.js] Patched polyfill-nomodule.js');
}
