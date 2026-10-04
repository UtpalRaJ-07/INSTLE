/**
 * Lets a `scripts/*.mjs` file import the project's TypeScript modules directly.
 *
 * The seeding scripts generate TypeScript and never read it back, so they needed
 * nothing like this. `sync-publication-status.mjs` is different: it has to ask the
 * *real* runtime gate which records it rejects, and a gate re-implemented in
 * JavaScript would be a second visibility rule — exactly what Requirement 1.3
 * exists to forbid. So the script imports `evaluateLocality` and `evaluateGuide`
 * themselves.
 *
 * Two things stand between a `.mjs` file and `src/config/guides.ts`:
 *
 *  1. **Types.** Node 24 strips erasable TypeScript syntax natively, so an
 *     interface, a type alias, an `import type` and an `as const` all load with no
 *     build step. Nothing in `src/` or `internal/` uses a construct that needs a
 *     transform — no enum, no namespace, no parameter property — which is why this
 *     works without a bundler.
 *  2. **Specifiers.** TypeScript source omits the file extension and uses the
 *     `@/` and `@internal/` aliases that `tsconfig.json` and `vitest.config.ts`
 *     declare. Node resolves neither. The resolve hook below applies the same two
 *     mappings and the same extension search, from one place, so the script cannot
 *     end up resolving a different file than `tsc` and vitest do.
 *
 * The hook deliberately does **not** widen the register boundary. It maps
 * `@internal/*` only for the importing script, and
 * `tests/internal-register-boundary.test.ts` still asserts that no file under
 * `src/` names the alias — a script bridging the two sides is the arrangement the
 * design describes, because the withdrawal register is internal working material
 * and the gate is app code.
 */

import { registerHooks } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ALIASES = [
  { prefix: '@internal/', directory: join(ROOT, 'internal') },
  { prefix: '@/', directory: join(ROOT, 'src') },
];

/** The extension search `tsc` performs, in the order it performs it. */
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '/index.ts', '/index.tsx'];

function firstExistingFile(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = `${basePath}${suffix}`;
    if (!existsSync(candidate)) continue;
    if (statSync(candidate).isDirectory()) continue;
    return candidate;
  }
  return null;
}

function resolveAlias(specifier) {
  for (const { prefix, directory } of ALIASES) {
    if (!specifier.startsWith(prefix)) continue;
    return firstExistingFile(join(directory, specifier.slice(prefix.length)));
  }
  return null;
}

function resolveExtensionlessRelative(specifier, parentURL) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  if (!parentURL || !parentURL.startsWith('file:')) return null;
  const parentDirectory = dirname(fileURLToPath(parentURL));
  return firstExistingFile(resolve(parentDirectory, specifier));
}

let registered = false;

/** Idempotent, so two scripts importing this module register one set of hooks. */
export function registerTypeScriptResolution() {
  if (registered) return;
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      const aliased = resolveAlias(specifier);
      if (aliased) {
        return { url: pathToFileURL(aliased).href, shortCircuit: true };
      }

      const relative = resolveExtensionlessRelative(specifier, context.parentURL);
      if (relative) {
        return { url: pathToFileURL(relative).href, shortCircuit: true };
      }

      return nextResolve(specifier, context);
    },
  });
}

export { ROOT as REPOSITORY_ROOT };
