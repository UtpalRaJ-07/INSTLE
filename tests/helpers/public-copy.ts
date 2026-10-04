import ts from 'typescript';

/**
 * The copy in a public source file, separated from the code around it.
 *
 * Some content rules govern *wording*, not code. The Indian English list
 * (Requirement 9.12) is the clearest case: `--color-paper` contains "color",
 * `textAlign: 'center'` contains "center" and `'@type': 'Organization'` contains
 * "Organization", and all three are correct code that must not be rewritten. A
 * scan of raw source cannot tell them apart from prose, so this module parses
 * the file with the TypeScript compiler and keeps only what a reader can see:
 *
 * - JSX text, always — it is rendered as written;
 * - a string or template literal that reads as prose (more than one word and
 *   nothing shaped like CSS, a path, a URL or SVG path data);
 * - a one-word string only where it is the value of a copy-bearing key or JSX
 *   attribute (`label: 'Villa'`, `alt="…"`, `kicker="Bengaluru"`), because a bare
 *   one-word string is as likely to be an identifier as a word.
 *
 * Comments are trivia to the parser, so they never reach the copy. Module
 * specifiers, string-literal types, property names and directives are skipped.
 *
 * The result is a *mask*, not an extract: the returned string is the same length
 * as the input, every character that is not copy is a space, and every newline
 * is kept. Line N of the mask is line N of the file, so a match found in the
 * mask can be reported against the line the author will actually edit.
 */

/** Keys and JSX attributes whose value is read by a customer even when it is one word. */
const COPY_KEYS: ReadonlySet<string> = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'caption',
  'description',
  'heading',
  'kicker',
  'label',
  'note',
  'placeholder',
  'summary',
  'title',
]);

/** Shaped like code rather than copy, even when it contains a space. */
const NOT_COPY: readonly RegExp[] = [
  /var\(--/, // CSS custom property reference
  /--[a-z]/i, // CSS custom property name
  /:\/\//, // URL
  /^(@\/|\.{1,2}\/)/, // module or relative path
  /\d(px|rem|em|vw|vh|ms)\b/, // CSS length or duration
  /^[MLACVHZSQTmlacvhzsqt0-9\s.,+-]+$/, // SVG path data
  /^[\d\s.,:/-]+$/, // numbers, viewBox, dates
];

function isProse(text: string): boolean {
  const trimmed = text.trim();
  if (!/\s/.test(trimmed)) return false;
  if (!/[A-Za-z]{3}/.test(trimmed)) return false;
  return !NOT_COPY.some((pattern) => pattern.test(trimmed));
}

function isOneWord(text: string): boolean {
  // A camelCase or kebab-case token is an identifier, not a word.
  return /^[A-Za-z][a-z]+$/.test(text.trim()) || /^[A-Z]{2,}$/.test(text.trim());
}

/** The key a literal is the value of, if any. */
function keyOf(node: ts.Node): string | null {
  const parent = node.parent;
  if (!parent) return null;
  if (ts.isJsxAttribute(parent)) return parent.name.getText();
  if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent)) {
    return parent.parent.name.getText();
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name) ? parent.name.text : null;
  }
  return null;
}

/** String literals that are structure, not text a reader sees. */
function isStructural(node: ts.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isLiteralTypeNode(parent)) return true; // type Intent = 'buy' | 'sell'
  if (ts.isExpressionStatement(parent)) return true; // 'use client'
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true; // { 'aria-label': … }
  if (ts.isElementAccessExpression(parent) && parent.argumentExpression === node) return true;
  return false;
}

function scriptKindFor(fileName: string): ts.ScriptKind {
  return fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

/**
 * Mask `source` down to its copy. See the module comment for what counts as copy.
 *
 * `fileName` decides whether JSX is parsed (`.tsx`) or not (`.ts`), because
 * `<T>value` is a type assertion in one and an element in the other.
 */
export function maskToCopy(source: string, fileName: string): string {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(fileName)
  );
  const keep = new Uint8Array(source.length);
  const mark = (start: number, end: number) => keep.fill(1, Math.max(0, start), Math.min(source.length, end));

  const visit = (node: ts.Node): void => {
    // Module specifiers name files, not anything a reader sees.
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;

    if (ts.isJsxText(node)) {
      if (!node.containsOnlyTriviaWhiteSpaces) mark(node.pos, node.end);
      return;
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (isStructural(node)) return;
      const key = keyOf(node);
      const isCopy = isProse(node.text) || (key !== null && COPY_KEYS.has(key) && isOneWord(node.text));
      // Inside the quotes only, so the delimiters never join two words together.
      if (isCopy) mark(node.getStart(sourceFile) + 1, node.end - 1);
      return;
    }

    if (ts.isTemplateExpression(node)) {
      // The static parts are copy; the interpolated expressions are code.
      const staticText = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ');
      if (isProse(staticText)) {
        // Inside the delimiters: the head is `…${, a middle }…${ and the tail }…`.
        mark(node.head.getStart(sourceFile) + 1, node.head.end - 2);
        for (const { literal } of node.templateSpans) {
          mark(literal.getStart(sourceFile) + 1, literal.end - (ts.isTemplateTail(literal) ? 1 : 2));
        }
      }
      for (const span of node.templateSpans) visit(span.expression);
      return;
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  let masked = '';
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    masked += keep[index] === 1 || char === '\n' ? char : ' ';
  }
  return masked;
}
