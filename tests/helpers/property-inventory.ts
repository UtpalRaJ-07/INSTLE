import ts from 'typescript';

/**
 * Per-property component and property-list detection (Requirement 12.5).
 *
 * Requirement 12.5 forbids, among other things, "a repeated per-property component
 * carrying two or more of price, built-up area, bedroom count or property location"
 * and "a list of two or more properties". Both are the shape a listing portal has,
 * and the platform is not one — so the shape is refused before any copy exists to
 * scan, because the first version of a listing card usually carries placeholder
 * text a wording scan would not recognise.
 *
 * ### Why this reads the syntax tree rather than the words
 *
 * A regular expression over source cannot tell a listing card from an enquiry form.
 * Both mention a budget, a bedroom count and a locality; the form asks for them,
 * the card states them. What separates the two is *where the values come from*: a
 * card reads them off an item being repeated, so the facets appear as fields of one
 * record — `flat.price`, `flat.bhk` — or as keys of the objects in a list. A form
 * reads them off the visitor, so its facets are field labels, and its repeated item
 * carries `label`, `name` and `options` instead.
 *
 * So two shapes are looked for, both structural:
 *
 *  1. **A repeated element built from an item's fields.** A `.map`, `.flatMap` or
 *     `.forEach` callback returning JSX, where the facets are read off the callback
 *     parameter — by member access or by destructuring.
 *  2. **A list of property records.** An array literal of two or more object
 *     literals where one object's own keys cover two or more facets.
 *
 * Two or more facets is the requirement's own threshold. One facet is not inventory:
 * a page may name an area, and a guide may discuss what a price depends on.
 *
 * ### The facet lexicons, and what is deliberately left out
 *
 * `budget` is not a price facet. The enquiry form asks a visitor for a budget band,
 * which is the opposite of quoting a price for a property. Bare `area` is not an
 * area facet either: in this codebase an "area" is a locality, so `record.area`
 * would be a place, and Requirement 12.5's facet is *built-up* area — square feet,
 * carpet area, plot size. Reading `area` as floor space would fail the area hub for
 * doing its job.
 */

export type PropertyFacet = 'price' | 'built-up area' | 'bedroom count' | 'property location';

/**
 * Field names that state a facet of one property.
 *
 * Matched against a normalised field name: camelCase and snake_case split into
 * words, lowercased, so `builtUpArea`, `built_up_area` and `BuiltUpArea` are one
 * name. A name matches a facet when its words contain the entry's words in order.
 */
const FACET_FIELD_NAMES: Readonly<Record<PropertyFacet, readonly string[]>> = {
  price: [
    'price',
    'asking price',
    'expected price',
    'quoted price',
    'price per sqft',
    'rate per sqft',
    'rent amount',
    'monthly rent',
    'deposit amount',
    'cost',
    'lakh',
    'crore',
  ],
  'built-up area': [
    'built up area',
    'builtup area',
    'super built up',
    'carpet area',
    'plot area',
    'plot size',
    'sqft',
    'sq ft',
    'square feet',
    'area sqft',
    'floor area',
    'dimensions',
  ],
  'bedroom count': ['bhk', 'bedroom', 'bedrooms', 'bedroom count', 'beds', 'bed count'],
  'property location': [
    'location',
    'address',
    'street address',
    'property address',
    'property location',
    'landmark',
    'door number',
    'flat number',
  ],
};

/** `builtUpArea` and `built_up_area` both become `['built', 'up', 'area']`. */
function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/** True when `words` contains `phrase`'s words consecutively. */
function containsPhrase(words: readonly string[], phrase: string): boolean {
  const target = phrase.split(' ');
  for (let at = 0; at + target.length <= words.length; at += 1) {
    if (target.every((word, offset) => words[at + offset] === word)) return true;
  }
  return false;
}

/** The facet a field name states, or null. */
export function facetOfFieldName(name: string): PropertyFacet | null {
  const words = nameWords(name);
  if (words.length === 0) return null;
  for (const [facet, phrases] of Object.entries(FACET_FIELD_NAMES) as [PropertyFacet, readonly string[]][]) {
    if (phrases.some((phrase) => containsPhrase(words, phrase))) return facet;
  }
  return null;
}

/** The distinct facets a set of field names covers, in requirement order. */
export function facetsOf(names: Iterable<string>): PropertyFacet[] {
  const found = new Set<PropertyFacet>();
  for (const name of names) {
    const facet = facetOfFieldName(name);
    if (facet) found.add(facet);
  }
  const order: readonly PropertyFacet[] = ['price', 'built-up area', 'bedroom count', 'property location'];
  return order.filter((facet) => found.has(facet));
}

export type InventoryShape = 'per-property-component' | 'property-list';

export interface InventoryFinding {
  readonly shape: InventoryShape;
  /** 1-based, so it names the line the author edits. */
  readonly line: number;
  readonly facets: readonly PropertyFacet[];
  /** The field names that carried the facets. */
  readonly fields: readonly string[];
  readonly detail: string;
}

const REPEATING_METHODS = new Set(['map', 'flatMap', 'forEach']);

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function containsJsx(node: ts.Node): boolean {
  let found = false;
  const visit = (child: ts.Node): void => {
    if (found) return;
    if (
      ts.isJsxElement(child) ||
      ts.isJsxSelfClosingElement(child) ||
      ts.isJsxFragment(child)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/** Every field name read off `parameter` inside `body`, by access or destructuring. */
function fieldsReadOffParameter(parameter: ts.ParameterDeclaration, body: ts.Node): string[] {
  const names: string[] = [];

  // `({ price, bhk }) => …`
  const collectBinding = (element: ts.BindingElement): void => {
    const key = element.propertyName ?? element.name;
    if (ts.isIdentifier(key) || ts.isStringLiteral(key)) names.push(key.text);
    if (ts.isObjectBindingPattern(element.name)) element.name.elements.forEach(collectBinding);
  };
  if (ts.isObjectBindingPattern(parameter.name)) parameter.name.elements.forEach(collectBinding);

  if (ts.isIdentifier(parameter.name)) {
    const parameterName = parameter.name.text;
    const visit = (node: ts.Node): void => {
      // `flat.price`
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === parameterName) {
        names.push(node.name.text);
      }
      // `flat['price']`
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === parameterName &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        names.push(node.argumentExpression.text);
      }
      // `const { price, bhk } = flat`
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        node.initializer.text === parameterName &&
        ts.isObjectBindingPattern(node.name)
      ) {
        node.name.elements.forEach(collectBinding);
      }
      ts.forEachChild(node, visit);
    };
    visit(body);
  }

  return names;
}

/**
 * A repeated element built from the fields of the item it repeats over, carrying
 * two or more facets of one property.
 */
export function findPerPropertyComponents(source: string, fileName: string): InventoryFinding[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const findings: InventoryFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      REPEATING_METHODS.has(node.expression.name.text)
    ) {
      const callback = node.arguments[0];
      if (
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        callback.parameters.length > 0 &&
        containsJsx(callback.body)
      ) {
        const fields = fieldsReadOffParameter(callback.parameters[0]!, callback.body);
        const facets = facetsOf(fields);
        if (facets.length >= 2) {
          findings.push({
            shape: 'per-property-component',
            line: lineOf(sourceFile, node),
            facets,
            fields: [...new Set(fields.filter((field) => facetOfFieldName(field) !== null))],
            detail:
              `a repeated element reads ${facets.join(' and ')} off each item ` +
              `(${[...new Set(fields.filter((field) => facetOfFieldName(field) !== null))].join(', ')})`,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

/** An array literal of two or more property records. */
export function findPropertyListLiterals(source: string, fileName: string): InventoryFinding[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const findings: InventoryFinding[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isArrayLiteralExpression(node)) {
      const objects = node.elements.filter(ts.isObjectLiteralExpression);
      if (objects.length >= 2) {
        for (const object of objects) {
          const fields = object.properties
            .map((property) => {
              const name = property.name;
              if (!name) return null;
              if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
              return null;
            })
            .filter((name): name is string => name !== null);
          const facets = facetsOf(fields);
          if (facets.length >= 2) {
            findings.push({
              shape: 'property-list',
              line: lineOf(sourceFile, object),
              facets,
              fields: fields.filter((field) => facetOfFieldName(field) !== null),
              detail:
                `a list of ${objects.length} records, each carrying ${facets.join(' and ')} ` +
                `(${fields.filter((field) => facetOfFieldName(field) !== null).join(', ')})`,
            });
            break;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

/** Both shapes, for one file. */
export function findInventoryShapes(source: string, fileName: string): InventoryFinding[] {
  return [...findPerPropertyComponents(source, fileName), ...findPropertyListLiterals(source, fileName)];
}
