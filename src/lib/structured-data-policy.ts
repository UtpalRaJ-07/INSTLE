/**
 * Structured data policy. Requirements 5.6, 5.7, 5.8 and 5.13.
 *
 * `structured-data.ts` builds the graph; this module decides whether a graph may
 * ship. The rules are held as data so a test can assert them, and `auditGraph`
 * applies every rule to every value at every depth and returns every failure,
 * each named by the path of the offending value — never just the first.
 *
 * The rules:
 *
 *  1. Every node's `@type` is one of PERMITTED_TYPES (Requirement 5.6). A typed
 *     value nested inside a node may instead be the single type
 *     PERMITTED_NESTED_TYPES names for the property holding it, because a
 *     BreadcrumbList cannot exist without its ListItems. Anywhere else, the same
 *     type fails.
 *  2. No key in FORBIDDEN_KEYS appears at any depth (Requirement 5.7). None of
 *     those facts is recorded as supplied in the owner register, so none may be
 *     emitted.
 *  3. Every scalar value appears in the visible text of the page emitting it,
 *     after whitespace and case normalisation (Requirement 5.6) — unless it sits
 *     under a key in STRUCTURAL_VALUE_KEYS, which holds schema vocabulary rather
 *     than a claim about the business.
 *  4. While the domain is unconfirmed, no value carries a hostname
 *     (Requirements 5.8 and 5.13). The one exception is SCHEMA_ORG_CONTEXT as the
 *     exact value of `@context`: it names the vocabulary, not a page on this site.
 *     Being structural does not exempt a value from this rule — `url`, `@id` and
 *     a breadcrumb's `item` are exactly the values it exists to catch.
 *
 * Visible text is an input rather than something derived here, because what a
 * reader sees is a property of the rendered page, not of the graph. The caller
 * passes the page's text with every script element removed, so the JSON-LD
 * cannot vouch for itself.
 */

import { isDomainConfirmed } from '@/config/site';
import type { JsonLdObject } from '@/lib/structured-data';

/** Requirement 5.6. The only node types any public page may emit. */
export const PERMITTED_TYPES = [
  'Organization',
  'Person',
  'BreadcrumbList',
  'WebSite',
  'WebPage',
  'Service',
  'Article',
] as const;

export type PermittedType = (typeof PERMITTED_TYPES)[number];

/**
 * Schema vocabulary values, not content. These are exempt from the visible-text
 * requirement because they are machine enums, not claims. `contactType:
 * 'customer service'` is a schema.org enumeration value, and `availableLanguage:
 * ['en']` is a language code; neither says anything a reader could check.
 *
 * `item` is here for the same reason as `@id` and `url`: in a breadcrumb
 * `ListItem` it holds the URL of the crumb, an identifier rather than a claim. A
 * reader sees the crumb's `name`, which is still checked; nobody sees its URL as
 * text. Only a scalar `item` is exempt — an object under `item` is walked like any
 * other node, each of its values checked under its own key — and rule 4 still
 * applies to it, so an `item` URL fails while the domain is unconfirmed.
 *
 * Kept short and explicit, and asserted to stay so: every key added here is a
 * key whose values no longer have to be true on the page.
 */
export const STRUCTURAL_VALUE_KEYS = [
  '@type',
  '@context',
  '@id',
  'url',
  'item',
  'position',
  'contactType',
  'availableLanguage',
] as const;

/**
 * Requirement 5.7. Business facts the owner has not supplied. Forbidden
 * regardless of the type carrying them, and at any depth.
 */
export const FORBIDDEN_KEYS = [
  'address',
  'openingHours',
  'openingHoursSpecification',
  'priceRange',
  'aggregateRating',
  'reviewCount',
  'review',
  'foundingDate',
  'award',
  'sameAs',
] as const;

/**
 * Typed values that may sit inside a permitted node, each keyed by the one
 * property allowed to hold it. These are parts of a node, not nodes: a ListItem
 * is a position in a BreadcrumbList, a ContactPoint is how to reach an
 * organisation, and a City is the area it serves. As a top-level node, or under
 * any other property, each fails rule 1.
 */
export const PERMITTED_NESTED_TYPES = {
  areaServed: 'City',
  contactPoint: 'ContactPoint',
  itemListElement: 'ListItem',
} as const;

/** The JSON-LD vocabulary declaration, the only hostname rule 4 exempts. */
export const SCHEMA_ORG_CONTEXT = 'https://schema.org';

export interface GraphAudit {
  readonly ok: boolean;
  /** Every failure, each as `<path>: <reason>`. */
  readonly failures: readonly string[];
}

export interface AuditGraphOptions {
  /**
   * Whether the purchased domain is confirmed. Defaults to `isDomainConfirmed()`;
   * injectable so both modes can be proved against the same graph.
   */
  readonly domainConfirmed?: boolean;
}

/**
 * The comparison form of visible text and of a structured data value: Unicode
 * NFC, every run of whitespace collapsed to one space, trimmed, lower case.
 */
export function normaliseVisibleText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Shapes of a hostname in a string value, each capturing the host.
 *
 * The bare form is limited to common top-level labels, because a real estate
 * page says "sq.ft" and "e.g." and neither is a host.
 */
const HOSTNAME_PATTERNS: readonly RegExp[] = [
  // An absolute URL: https://example.com, ftp://localhost.
  /[a-z][a-z\d+.-]*:\/\/([^\s/?#]+)/i,
  // A protocol-relative URL: //cdn.example.com.
  /(?:^|[\s("'])\/\/([^\s/?#]+)/,
  // A www host with no scheme: www.example.
  /(?:^|[^\w.-])(www\.[a-z\d-]+(?:\.[a-z\d-]+)*)/i,
  // A bare host, including an e-mail domain: example.com, example.co.in.
  /(?:^|[^\w.-])((?:[a-z\d][a-z\d-]*\.)+(?:com|in|net|org|co|io|app|dev|info|biz|site|online|test))(?![\w-])/i,
];

/** The first hostname a value carries, by position in the value, or null. */
export function findHostname(value: string): string | null {
  let earliest: { readonly index: number; readonly host: string } | null = null;
  for (const pattern of HOSTNAME_PATTERNS) {
    const match = pattern.exec(value);
    if (!match?.[1]) continue;
    if (earliest === null || match.index < earliest.index) earliest = { index: match.index, host: match[1] };
  }
  return earliest?.host ?? null;
}

const PERMITTED_TYPE_SET: ReadonlySet<string> = new Set<string>(PERMITTED_TYPES);
const STRUCTURAL_KEY_SET: ReadonlySet<string> = new Set<string>(STRUCTURAL_VALUE_KEYS);
const FORBIDDEN_KEY_SET: ReadonlySet<string> = new Set<string>(FORBIDDEN_KEYS);

interface AuditContext {
  /** Already normalised. */
  readonly visibleText: string;
  readonly domainConfirmed: boolean;
  readonly failures: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function childPath(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}

function label(path: string): string {
  return path === '' ? '(root)' : path;
}

function nestedTypeFor(holderKey: string): string | null {
  return Object.hasOwn(PERMITTED_NESTED_TYPES, holderKey)
    ? PERMITTED_NESTED_TYPES[holderKey as keyof typeof PERMITTED_NESTED_TYPES]
    : null;
}

/**
 * Rule 1. `holderKey` is null for a node — the root of a single-node graph or a
 * member of `@graph` — and otherwise names the property holding the object.
 */
function auditTypes(raw: unknown, path: string, holderKey: string | null, context: AuditContext): void {
  const types = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  if (types.length === 0) {
    if (holderKey === null) context.failures.push(`${label(path)}: a node must declare an @type`);
    return;
  }
  const typePath = childPath(path, '@type');
  for (const type of types) {
    if (typeof type !== 'string') {
      context.failures.push(`${typePath}: @type must be a string`);
      continue;
    }
    if (PERMITTED_TYPE_SET.has(type)) continue;
    if (holderKey !== null && nestedTypeFor(holderKey) === type) continue;
    context.failures.push(`${typePath}: "${type}" is not a permitted type`);
  }
}

/** Rules 3 and 4, on one string, number or boolean. */
function auditScalar(key: string, text: string, path: string, context: AuditContext): void {
  if (!STRUCTURAL_KEY_SET.has(key) && !context.visibleText.includes(normaliseVisibleText(text))) {
    context.failures.push(`${path}: "${text}" does not appear in the visible text of the page`);
  }
  if (context.domainConfirmed) return;
  if (key === '@context' && text === SCHEMA_ORG_CONTEXT) return;
  const host = findHostname(text);
  if (host !== null) {
    context.failures.push(`${path}: "${text}" carries the hostname "${host}" while the domain is unconfirmed`);
  }
}

/** Walks a value held under `key`. Array items inherit the key of their array. */
function auditValue(key: string, value: unknown, path: string, context: AuditContext): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => auditValue(key, item, `${path}[${index}]`, context));
    return;
  }
  if (isPlainObject(value)) {
    auditObject(value, path, key, context);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    auditScalar(key, String(value), path, context);
  }
}

/** Rule 2 on the key, then every rule on its value. */
function auditProperty(key: string, value: unknown, path: string, context: AuditContext): void {
  if (FORBIDDEN_KEY_SET.has(key)) context.failures.push(`${path}: "${key}" is a forbidden key`);
  auditValue(key, value, path, context);
}

function auditObject(
  object: Record<string, unknown>,
  path: string,
  holderKey: string | null,
  context: AuditContext
): void {
  auditTypes(object['@type'], path, holderKey, context);
  for (const [key, value] of Object.entries(object)) {
    if (key === '@type' || value === undefined) continue;
    auditProperty(key, value, childPath(path, key), context);
  }
}

/**
 * Audit a JSON-LD graph against the visible text of the page that emits it.
 *
 * A root carrying `@graph` is a container: its own keys (`@context`) are checked
 * as values and each `@graph` member as a node. Any other root is itself the node.
 */
export function auditGraph(
  graph: JsonLdObject,
  visibleText: string,
  options: AuditGraphOptions = {}
): GraphAudit {
  const context: AuditContext = {
    visibleText: normaliseVisibleText(visibleText),
    domainConfirmed: options.domainConfirmed ?? isDomainConfirmed(),
    failures: [],
  };

  if (Object.hasOwn(graph, '@graph')) {
    for (const [key, value] of Object.entries(graph)) {
      if (value === undefined) continue;
      if (key !== '@graph') {
        auditProperty(key, value, key, context);
        continue;
      }
      if (!Array.isArray(value)) {
        context.failures.push('@graph: must be an array of nodes');
        continue;
      }
      value.forEach((node, index) => {
        const nodePath = `@graph[${index}]`;
        if (isPlainObject(node)) auditObject(node, nodePath, null, context);
        else context.failures.push(`${nodePath}: a node must be an object`);
      });
    }
  } else {
    auditObject(graph, '', null, context);
  }

  return { ok: context.failures.length === 0, failures: context.failures };
}
