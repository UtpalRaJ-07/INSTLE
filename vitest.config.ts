import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest configuration.
 *
 * `npm test` was declared in package.json before this work but there was no config
 * and no test file, so `vitest run` had nothing to execute. The suite added here
 * targets publication and security boundaries rather than mirroring copy.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      // Named explicitly so the property suite cannot fall outside the run if the
      // globs above are ever narrowed.
      'tests/properties/**/*.test.ts',
    ],
    // Files needing a DOM declare `@vitest-environment jsdom` in a docblock.
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      /**
       * Internal registers live outside `src/`, so `@/...` cannot reach them and
       * `next.config.ts` never compiles them. This alias is for tests and for
       * `scripts/` only; `tests/internal-register-boundary.test.ts` asserts that
       * no file under `src/` names it.
       *
       * Declared before `@` so the more specific prefix is matched first.
       */
      '@internal': fileURLToPath(new URL('./internal', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
