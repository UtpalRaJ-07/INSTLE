import { sep } from 'node:path';
import ts from 'typescript';

import { type ImportedFile, SRC, computePublicSurfaceClosure, readImportedFile } from './public-surface';

/**
 * What a module rendering a public route is allowed to import (Requirement 12.10).
 *
 * 12.10 fails the build when "a module that renders a registered public route
 * imports a synthetic review, lead or locality fixture … or imports a locality or
 * guide record that has not passed the publication gate". Two importable things
 * carry unpublished records: a fixture, whose records exist only to exercise tests,
 * and the registries themselves — `LOCALITY_REGISTRY` holds 132 records of which
 * none passes the gate, `GUIDE_REGISTRY` 36 of which three do. A page that reads
 * either has every unpublished record in its hands, and Property 1 found exactly
 * that mistake in the orientation plate.
 *
 * ## The scoping decision — why the config layer is outside this rule
 *
 * The rule is scoped to the **render layer**: the files in the derived public
 * surface closure that live under `src/app/` or `src/components/`. It is not scoped
 * to `src/config/` or `src/lib/`.
 *
 * The reason is that the gated accessors are *implemented* by reading the registry.
 * `getPublishedLocalities` filters `LOCALITY_REGISTRY`; `getPublishedGuides` filters
 * `GUIDE_REGISTRY`; `getPublishedAreaRecords` in `locality-sections.ts` applies the
 * section rules on top; `publication-sync.ts` exists to compare persisted status
 * against the gate, which it can only do by seeing records the gate rejects; and
 * `internal-links.ts` narrows a record's neighbours to the ones that pass. A rule
 * that forbade the registry everywhere would forbid the gate, which is the opposite
 * of what 12.10 protects. So the config and lib layers hold the registry, and the
 * render layer is allowed only what they hand out.
 *
 * That boundary is what makes the rule enforceable rather than advisory: there is
 * one place to audit, and a page cannot reach an unpublished record without an
 * accessor deciding to give it one.
 *
 * `src/styles/` is outside the rule too; a stylesheet imports no record.
 */

/** The identifiers that are the whole registry, gate or no gate. */
export const UNGATED_REGISTRY_EXPORTS: readonly string[] = ['LOCALITY_REGISTRY', 'GUIDE_REGISTRY'];

/**
 * Specifiers that name test material. `tests/` and `__fixtures__/` are directories
 * of it; `*.fixture.ts` and `*.fixtures.ts` are single modules of it; `synthetic-*`
 * is the naming the excluded-methods register uses for a fabricated record.
 */
export const FIXTURE_SPECIFIER_PATTERNS: readonly RegExp[] = [
  /(^|[\\/])tests?[\\/]/,
  /(^|[\\/])__tests__[\\/]/,
  /(^|[\\/])__fixtures__[\\/]/,
  /(^|[\\/])fixtures?[\\/]/,
  /\.fixtures?(\.[cm]?[jt]sx?)?$/,
  /(^|[\\/])[\w-]*fixtures?(\.[cm]?[jt]sx?)?$/,
  /(^|[\\/])synthetic[\w-]*/i,
  /\.(test|spec)(\.[cm]?[jt]sx?)?$/,
];

/** The layers 12.10 governs, as path fragments under `src/`. */
export const RENDER_LAYER_FRAGMENTS: readonly string[] = [`${sep}app${sep}`, `${sep}components${sep}`];

export function isRenderLayerFile(file: string): boolean {
  return file.startsWith(SRC) && RENDER_LAYER_FRAGMENTS.some((fragment) => file.includes(fragment));
}

/**
 * The modules that render a registered public route: the derived public surface
 * closure, narrowed to the render layer.
 */
export function renderLayerModules(): readonly ImportedFile[] {
  return computePublicSurfaceClosure().filter(isRenderLayerFile).map(readImportedFile);
}

export interface ImportBinding {
  /** The module specifier as written. */
  readonly specifier: string;
  /** The imported name, or `*` for a namespace import, or `default`. */
  readonly imported: string;
  /** 1-based. */
  readonly line: number;
}

/** Every name a file imports, with the module it came from. */
export function importBindings(file: string, source: string): ImportBinding[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const bindings: ImportBinding[] = [];
  const push = (specifier: string, imported: string, node: ts.Node) => {
    bindings.push({
      specifier,
      imported,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
    });
  };

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (!clause) {
        push(specifier, 'side-effect', statement);
        continue;
      }
      if (clause.name) push(specifier, 'default', statement);
      const { namedBindings } = clause;
      if (namedBindings && ts.isNamespaceImport(namedBindings)) push(specifier, '*', statement);
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          push(specifier, (element.propertyName ?? element.name).text, element);
        }
      }
      continue;
    }
    // `export { X } from '…'` re-exports into the importer's surface just the same.
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          push(specifier, (element.propertyName ?? element.name).text, element);
        }
      } else {
        push(specifier, '*', statement);
      }
    }
  }
  return bindings;
}

export type ForbiddenImportRule = 'synthetic-fixture' | 'ungated-registry';

export interface ForbiddenImport {
  readonly rule: ForbiddenImportRule;
  /** Repository-relative path of the importing file. */
  readonly path: string;
  /** The module specifier imported. */
  readonly module: string;
  readonly imported: string;
  readonly line: number;
  readonly detail: string;
}

/** One line naming the importing file and the imported module, for an assertion. */
export function describeForbiddenImport(violation: ForbiddenImport): string {
  return `${violation.path}:${violation.line} imports ${violation.imported} from ${violation.module} — ${violation.detail}`;
}

/** Requirement 12.10 over one render-layer module. */
export function findForbiddenImports(scanned: ImportedFile): ForbiddenImport[] {
  const violations: ForbiddenImport[] = [];
  for (const binding of importBindings(scanned.file, scanned.text)) {
    if (FIXTURE_SPECIFIER_PATTERNS.some((pattern) => pattern.test(binding.specifier))) {
      violations.push({
        rule: 'synthetic-fixture',
        path: scanned.path,
        module: binding.specifier,
        imported: binding.imported,
        line: binding.line,
        detail:
          'a module rendering a registered public route may not import test material; its records exist ' +
          'only to exercise tests and none has passed the publication gate',
      });
      continue;
    }
    if (UNGATED_REGISTRY_EXPORTS.includes(binding.imported)) {
      violations.push({
        rule: 'ungated-registry',
        path: scanned.path,
        module: binding.specifier,
        imported: binding.imported,
        line: binding.line,
        detail:
          `${binding.imported} holds every record, published or not; read the gated accessors ` +
          '(getPublishedLocalities, getPublishedLocalityBySlug, getPublishedAreaRecords, getPublishedGuides, ' +
          'getPublishedGuideBySlug) instead',
      });
    }
    if (binding.imported === '*' && /config[\\/](localities|guides)$/.test(binding.specifier)) {
      violations.push({
        rule: 'ungated-registry',
        path: scanned.path,
        module: binding.specifier,
        imported: binding.imported,
        line: binding.line,
        detail: 'a namespace import carries the registry with it; import the gated accessors by name',
      });
    }
  }
  return violations;
}
