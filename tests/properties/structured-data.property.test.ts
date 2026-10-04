/**
 * **Property 14: Structured data emits only permitted types and only values a
 * reader can see.**
 *
 * *For any* emitted JSON-LD graph and the visible text of the page emitting it,
 * every node's `@type` is one of the seven permitted types, no forbidden key
 * appears at any depth, and every string value that is not a schema vocabulary
 * value appears in that page's visible text after whitespace and case
 * normalisation — and while the domain is unconfirmed, no graph value and no page
 * element contains an absolute URL carrying a hostname.
 *
 * **Validates: Requirements 1.6, 4.4, 5.6, 5.7, 5.8, 5.13**
 *
 * The property has two halves, because the sentence above quantifies over two
 * things a test can generate independently.
 *
 * **The graph half.** `arbAuditableGraph` builds a graph out of the node shapes the
 * shipped builders emit, paired with the visible text of a page that shows every
 * value in it, and then applies one of thirteen recorded violations — one of which
 * is "none". The property asserts that `auditGraph`'s failure set equals the set
 * the generator recorded: same paths, same quoted values, same rules. That is an
 * equality, not a one-way implication, so it fails both for a violation the audit
 * misses and for a clean graph the audit rejects. The hostname violations are
 * recorded as faults *only while the domain is unconfirmed*, so the same graph is
 * asserted twice, once in each domain state, and a rule that fired in the wrong
 * state fails.
 *
 * **The page half.** A generated registry of localities and guides is installed in
 * front of the live one and the real pages are rendered — the homepage, the owner
 * profile, a service page, the generated area page and the generated guide page —
 * in both domain states. The graph each page emits is audited against the text of
 * the response that carried it, and three further things are checked on the graph
 * without going through `auditGraph` at all, so the audit cannot vouch for itself:
 * every `@type` at every depth is a permitted type or the one nested type its
 * holding property allows, no `FORBIDDEN_KEYS` entry appears at any depth, and no
 * value carries a hostname while the domain is unconfirmed.
 *
 * Two requirements ride on the page half specifically:
 *
 *  - **1.6** — `marketingGroup` is excluded from structured data. The generated
 *    record carries a marked browsing group, so its absence from every graph value
 *    is a search for a string that would be unmistakable if it leaked.
 *  - **4.4** — an own-process guide gets no `Article` node. Every generated guide
 *    is own-process, so this is asserted on each one.
 *  - **5.13** — the page half of the hostname rule: while the domain is
 *    unconfirmed, no URL-bearing attribute and no visible text in the served
 *    response carries a hostname.
 *
 * **What the visible text is.** The response a crawler receives: the header as
 * first served, the page's own markup and the footer, with script and style bodies
 * removed *first*. Removing the script bodies is what stops the JSON-LD vouching
 * for itself — a value that appears only inside the `<script type="application/
 * ld+json">` element is a value no reader can see. The header and footer are in
 * the same HTML as the page, so a value satisfied by the footer is genuinely
 * satisfied on that page; this is the same rule `tests/rendered-html.test.tsx` and
 * `tests/structured-data-pages.test.tsx` read the site by.
 *
 * **What is not mocked.** Nothing about the policy or the gates. `auditGraph`,
 * `findHostname`, `evaluateClaim`, the locality gate and the guide gate are the
 * shipped functions. The injection swaps the three registries and nothing else, in
 * the same way `tests/rendered-html.test.tsx` does, so the graph under test is the
 * graph the real page builder produced from a real gate-passing record.
 *
 * **The SVG namespace.** An inline `<svg xmlns="http://www.w3.org/2000/svg">`
 * carries a hostname in an attribute. It is exempt here for exactly the reason
 * `SCHEMA_ORG_CONTEXT` is exempt in `auditGraph`: it names a vocabulary, not a page
 * on this site, and no reader or crawler follows it as a link. The exemption is not
 * a blanket one — the property asserts that every `xmlns` in every rendered
 * response is that one namespace and nothing else, so a second absolute URL could
 * not hide behind the same attribute.
 */

import React from 'react';
import fc from 'fast-check';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClaimRecord } from '@/config/claims';
import type { GuideRecord } from '@/config/guides';
import type { LocalityRecord } from '@/config/localities';

const injected = vi.hoisted(() => ({
  claims: new Map<string, ClaimRecord>(),
  registry: null as readonly LocalityRecord[] | null,
  guides: null as readonly GuideRecord[] | null,
}));

// Fixture claims layered in front of the live ledger, judged by the real claim gate.
vi.mock('@/config/claims', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/claims')>();
  const getClaim = (claimId: string): ClaimRecord | undefined =>
    injected.claims.get(claimId) ?? actual.getClaim(claimId);
  return {
    ...actual,
    getClaim,
    evaluateClaims: (claimIds: readonly string[], now: Date = new Date()) => {
      const failures: string[] = [];
      for (const claimId of claimIds) {
        const claim = getClaim(claimId);
        if (!claim) {
          failures.push(`${claimId}: no such claim in the ledger.`);
          continue;
        }
        const evaluation = actual.evaluateClaim(claim, now);
        if (!evaluation.eligible) failures.push(...evaluation.failures.map((reason) => `${claimId}: ${reason}`));
      }
      return { eligible: failures.length === 0, failures };
    },
  };
});

/**
 * The registry swapped through a getter, and `getPublishedLocalities`' default
 * argument swapped too, because `/areas` and the homepage call it with no registry
 * and a getter on the export cannot reach the module's own binding.
 */
vi.mock('@/config/localities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/localities')>();
  const current = (): readonly LocalityRecord[] => injected.registry ?? actual.LOCALITY_REGISTRY;
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return current();
    },
    getPublishedLocalities: (now: Date = new Date(), registry: readonly LocalityRecord[] = current()) =>
      actual.getPublishedLocalities(now, registry),
    getPublishedLocalitySlugs: (now: Date = new Date()) =>
      actual.getPublishedLocalities(now, current()).map((record) => record.slug),
  };
});

vi.mock('@/config/guides', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/guides')>();
  const current = (): readonly GuideRecord[] => injected.guides ?? actual.GUIDE_REGISTRY;
  const published = (now: Date) => current().filter((record) => actual.isGuidePublishable(record, now));
  return {
    ...actual,
    get GUIDE_REGISTRY() {
      return current();
    },
    getPublishedGuides: (now: Date = new Date()) => published(now),
    getPublishedGuideBySlug: (slug: string, now: Date = new Date()) => {
      const record = current().find((candidate) => candidate.slug === slug);
      return record && actual.isGuidePublishable(record, now) ? record : undefined;
    },
    getPublishedGuideSlugs: (now: Date = new Date()) => published(now).map((record) => record.slug),
    getPublishedGuidesForIntent: (intent: GuideRecord['intent'], now: Date = new Date()) =>
      published(now).filter((record) => record.intent === intent),
    getGuideById: (guideId: string) => current().find((record) => record.guideId === guideId),
  };
});

import { Footer } from '@/components/Footer/Footer';
import { Header } from '@/components/Header/Header';
import { getPublishedAreaSlugs } from '@/config/locality-sections';
import { getPublishedGuideSlugs } from '@/config/guides';
import {
  FORBIDDEN_KEYS,
  PERMITTED_NESTED_TYPES,
  PERMITTED_TYPES,
  SCHEMA_ORG_CONTEXT,
  STRUCTURAL_VALUE_KEYS,
  auditGraph,
  findHostname,
  normaliseVisibleText,
} from '@/lib/structured-data-policy';
import type { JsonLdObject } from '@/lib/structured-data';

import { renderRouteContent } from '../helpers/rendered-routes';
import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbAuditableGraph,
  arbGatePassingClaimWithId,
  arbLeakGuideIntent,
  arbLeakSalt,
  leakRecordMarker,
  markedGateReadyGuide,
  markedGateReadyLocality,
  type AuditableGraph,
  type ExpectedGraphFailure,
} from './arbitraries';

/** Rendering five pages in two domain states, a hundred runs, outlasts the default. */
const PROPERTY_TIMEOUT_MS = 300_000;

/** The one hostname a rendered response may carry: the SVG vocabulary. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** The five service pages, one of which each scenario renders. */
const SERVICE_ROUTES = ['/buy', '/sell', '/rent', '/rent-out', '/commercial'] as const;

// ---------------------------------------------------------------------------
// Reading a graph
// ---------------------------------------------------------------------------

/** One scalar of a graph, with the path and the key it sits under. */
interface GraphScalar {
  readonly path: string;
  readonly key: string;
  readonly value: string;
}

/**
 * Every scalar in a graph, and every `@type` with the property holding the object
 * that declared it — walked here rather than through `auditGraph`, so the type,
 * forbidden-key and hostname checks on a real page do not depend on the module
 * they are checking.
 */
function readGraph(graph: JsonLdObject): {
  readonly scalars: readonly GraphScalar[];
  readonly types: readonly { readonly path: string; readonly type: string; readonly holder: string | null }[];
  readonly keys: readonly { readonly path: string; readonly key: string }[];
} {
  const scalars: GraphScalar[] = [];
  const types: { path: string; type: string; holder: string | null }[] = [];
  const keys: { path: string; key: string }[] = [];

  const walkObject = (object: Record<string, unknown>, path: string, holder: string | null): void => {
    const declared = object['@type'];
    for (const type of Array.isArray(declared) ? declared : declared === undefined ? [] : [declared]) {
      types.push({ path: path === '' ? '(root)' : path, type: String(type), holder });
    }
    for (const [key, value] of Object.entries(object)) {
      if (value === undefined) continue;
      const childPath = path === '' ? key : `${path}.${key}`;
      keys.push({ path: childPath, key });
      if (key !== '@type') walkValue(key, value, childPath);
    }
  };

  const walkValue = (key: string, value: unknown, path: string): void => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walkValue(key, item, `${path}[${index}]`));
      return;
    }
    if (typeof value === 'object') {
      walkObject(value as Record<string, unknown>, path, key);
      return;
    }
    scalars.push({ path, key, value: String(value) });
  };

  const members = graph['@graph'];
  if (Array.isArray(members)) {
    for (const [key, value] of Object.entries(graph)) {
      if (key === '@graph' || value === undefined) continue;
      const childPath = key;
      keys.push({ path: childPath, key });
      walkValue(key, value, childPath);
    }
    members.forEach((node, index) => {
      if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
        walkObject(node as Record<string, unknown>, `@graph[${index}]`, null);
      }
    });
  } else {
    walkObject(graph as Record<string, unknown>, '', null);
  }

  return { scalars, types, keys };
}

/** Whether `type` may be declared at a value held under `holder`. */
function typeIsAllowed(type: string, holder: string | null): boolean {
  if ((PERMITTED_TYPES as readonly string[]).includes(type)) return true;
  if (holder === null) return false;
  return Object.hasOwn(PERMITTED_NESTED_TYPES, holder)
    ? PERMITTED_NESTED_TYPES[holder as keyof typeof PERMITTED_NESTED_TYPES] === type
    : false;
}

/** The scalars that carry a hostname, `@context` aside. */
function hostnameCarrying(graph: JsonLdObject): readonly string[] {
  return readGraph(graph)
    .scalars.filter((scalar) => !(scalar.key === '@context' && scalar.value === SCHEMA_ORG_CONTEXT))
    .filter((scalar) => findHostname(scalar.value) !== null)
    .map((scalar) => `${scalar.path}: "${scalar.value}" carries the hostname "${findHostname(scalar.value)}"`);
}

// ---------------------------------------------------------------------------
// Reading a page
// ---------------------------------------------------------------------------

/**
 * The text a reader sees. Script and style bodies go first, so a value that
 * appears only in the page's own JSON-LD cannot satisfy the rule that it appear on
 * the page. React's `<!-- -->` text-node separators are removed rather than turned
 * into a space, because they sit *between* adjacent words of one sentence.
 */
function visibleTextOf(markup: string): string {
  return markup
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const noop = () => undefined;

/** The layout shell every route is served inside, rendered at call time. */
function shellMarkup(): string {
  return (
    renderToStaticMarkup(React.createElement(Header, { isMenuOpen: false, onMenuOpenChange: noop })) +
    renderToStaticMarkup(React.createElement(Footer))
  );
}

interface RenderedPage {
  readonly route: string;
  /** The page's own markup plus the shell it is served inside. */
  readonly markup: string;
  readonly visibleText: string;
  readonly graphs: readonly JsonLdObject[];
}

async function renderPage(route: string): Promise<RenderedPage> {
  const markup = `${shellMarkup()}${await renderRouteContent(route)}`;
  const graphs = [
    ...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((match) => JSON.parse(match[1]!) as JsonLdObject);
  return { route, markup, visibleText: visibleTextOf(markup), graphs };
}

/** Attributes a reader or a crawler follows as a URL. */
const URL_ATTRIBUTES = /\s(?:href|src|srcset|action|formaction|poster|content|data-href)="([^"]*)"/g;

/** Every `xmlns` value in the markup. */
const XMLNS_VALUES = /\sxmlns(?::[a-z]+)?="([^"]*)"/g;

// ---------------------------------------------------------------------------
// The generated scenario for the page half
// ---------------------------------------------------------------------------

/** The claim behind the generated locality's administrative mapping. */
const MAPPING_CLAIM_ID = 'CLM-GRAPH-MAPPING';

interface GraphScenario {
  readonly locality: LocalityRecord;
  readonly guide: GuideRecord;
  readonly claim: ClaimRecord;
  readonly serviceRoute: (typeof SERVICE_ROUTES)[number];
}

/**
 * One gate-passing locality and one gate-passing own-process guide, each carrying a
 * marker in every field a page could print — including the `marketingGroup`
 * Requirement 1.6 keeps out of structured data — plus the passing claim its
 * administrative mapping names, and one of the five service pages to render beside
 * them.
 */
const arbGraphScenario: fc.Arbitrary<GraphScenario> = fc
  .tuple(
    arbLeakSalt,
    arbGatePassingClaimWithId(MAPPING_CLAIM_ID),
    arbLeakGuideIntent,
    fc.constantFrom(...SERVICE_ROUTES)
  )
  .map(([salt, claim, intent, serviceRoute]): GraphScenario => {
    const locality = markedGateReadyLocality(
      leakRecordMarker('grl', 0, salt),
      `graph-area-${salt}`,
      MAPPING_CLAIM_ID
    );
    const guide = markedGateReadyGuide(leakRecordMarker('grg', 0, salt), `graph-guide-${salt}`, intent);
    return { locality, guide, claim, serviceRoute };
  });

function install(scenario: GraphScenario) {
  injected.claims.clear();
  injected.claims.set(scenario.claim.claimId, scenario.claim);
  injected.registry = [scenario.locality];
  injected.guides = [scenario.guide];
}

function confirmDomain() {
  process.env.INSTLE_PUBLIC_ORIGIN = 'https://example-instle.test';
  process.env.INSTLE_DOMAIN_CONFIRMED = 'true';
}

function unconfirmDomain() {
  delete process.env.INSTLE_PUBLIC_ORIGIN;
  delete process.env.INSTLE_DOMAIN_CONFIRMED;
}

beforeEach(() => {
  injected.claims.clear();
  injected.registry = null;
  injected.guides = null;
  // Every gate, page and builder reads the clock itself.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PROPERTY_NOW);
});

afterEach(() => {
  injected.claims.clear();
  injected.registry = null;
  injected.guides = null;
  vi.useRealTimers();
  unconfirmDomain();
});

// ---------------------------------------------------------------------------
// The graph half
// ---------------------------------------------------------------------------

/** `auditGraph`'s failures, each split into the path it names and the rest. */
function pathsOf(failures: readonly string[]): string[] {
  return failures.map((failure) => failure.slice(0, failure.indexOf(': ')));
}

/**
 * The failures the generator says the audit must report in this domain state. A
 * hostname fault is a fault only while the domain is unconfirmed; every other
 * fault holds in both states.
 */
function expectedIn(generated: AuditableGraph, domainConfirmed: boolean): readonly ExpectedGraphFailure[] {
  if (generated.onlyWhileUnconfirmed && domainConfirmed) return [];
  return generated.expected;
}

describe('Property 14: the audit admits exactly the graphs the policy permits', () => {
  it('reports every recorded violation, at its path, quoting the offending value — and nothing else', () => {
    fc.assert(
      fc.property(arbAuditableGraph, fc.boolean(), (generated, domainConfirmed) => {
        const audit = auditGraph(generated.graph, generated.visibleText, { domainConfirmed });
        const expected = expectedIn(generated, domainConfirmed);
        const detail =
          `${generated.violation} in a ${generated.rootForm} root of ` +
          `[${generated.nodeKinds.join(', ')}], domainConfirmed=${domainConfirmed}\n` +
          `reported: ${JSON.stringify(audit.failures, null, 2)}`;

        // The verdict, both ways round: a violation the audit misses fails here, and
        // so does a clean graph it rejects.
        expect(audit.ok, detail).toBe(expected.length === 0);
        expect(pathsOf(audit.failures), detail).toEqual(expected.map((failure) => failure.path));

        // The right rule, at the right place, naming the measured value.
        audit.failures.forEach((failure, index) => {
          const want = expected[index]!;
          expect(failure, detail).toContain(want.reason);
          if (want.quoted !== null) expect(failure, detail).toContain(`"${want.quoted}"`);
        });
      }),
      PROPERTY_RUN_CONFIG
    );
  });

  it('judges every value a reader can see after whitespace and case normalisation only', () => {
    fc.assert(
      fc.property(arbAuditableGraph, (generated) => {
        if (generated.violation !== 'none') return;
        const normalised = normaliseVisibleText(generated.visibleText);
        // Every content value of a clean graph is in the page, and is there only
        // after normalisation in the cases the generator varied — which is why the
        // raw string is not asserted.
        for (const scalar of readGraph(generated.graph).scalars) {
          // The vocabulary allowlist is read from the policy, never restated: a key
          // this test exempted on its own would be a key the policy still checks.
          if ((STRUCTURAL_VALUE_KEYS as readonly string[]).includes(scalar.key)) continue;
          expect(normalised, `${scalar.path}: "${scalar.value}"`).toContain(
            normaliseVisibleText(scalar.value)
          );
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  });
});

// ---------------------------------------------------------------------------
// The page half
// ---------------------------------------------------------------------------

describe('Property 14: every page emits a graph a reader of that page can verify', () => {
  it('admits the graph on every rendered page, in both domain states', async () => {
    await fc.assert(
      fc.asyncProperty(arbGraphScenario, async (scenario) => {
        install(scenario);
        const areaSlugs = getPublishedAreaSlugs(PROPERTY_NOW);
        const guideSlugs = getPublishedGuideSlugs(PROPERTY_NOW);
        // The generated records really do publish, or every page below is a 404 and
        // the assertions are vacuous.
        expect(areaSlugs, 'the generated locality fails the gate').toEqual([scenario.locality.slug]);
        expect(guideSlugs, 'the generated guide fails the gate').toEqual([scenario.guide.slug]);

        const routes = [
          '/',
          '/about/utpal-raj-kb',
          scenario.serviceRoute,
          `/areas/${scenario.locality.slug}`,
          `/guides/${scenario.guide.slug}`,
        ];

        for (const domainConfirmed of [false, true]) {
          if (domainConfirmed) confirmDomain();
          else unconfirmDomain();

          let graphsSeen = 0;
          for (const route of routes) {
            const page = await renderPage(route);
            expect(page.graphs.length, `${route} emits no JSON-LD`).toBeGreaterThan(0);
            graphsSeen += page.graphs.length;

            for (const [index, graph] of page.graphs.entries()) {
              const where = `${route} graph ${index} (domainConfirmed=${domainConfirmed})`;
              const read = readGraph(graph);

              // Requirement 5.6, through the shipped audit: every value a reader of
              // this page can see, every type permitted, every key allowed.
              const audit = auditGraph(graph, page.visibleText, { domainConfirmed });
              expect(audit.failures, where).toEqual([]);

              // Requirements 5.6 and 5.7 again, without going through the audit.
              const badTypes = read.types
                .filter((entry) => !typeIsAllowed(entry.type, entry.holder))
                .map((entry) => `${entry.path}: "${entry.type}" under ${entry.holder ?? 'a graph node'}`);
              expect(badTypes, where).toEqual([]);

              const forbidden = read.keys
                .filter((entry) => (FORBIDDEN_KEYS as readonly string[]).includes(entry.key))
                .map((entry) => entry.path);
              expect(forbidden, where).toEqual([]);

              // Requirement 1.6: the browsing group is not structured data.
              const group = normaliseVisibleText(scenario.locality.marketingGroup);
              const leaked = read.scalars
                .filter((scalar) => normaliseVisibleText(scalar.value).includes(group))
                .map((scalar) => `${scalar.path}: "${scalar.value}"`);
              expect(leaked, `${where} carries the browsing group`).toEqual([]);

              // Requirement 4.4: an own-process guide carries no Article node.
              if (route.startsWith('/guides/')) {
                expect(scenario.guide.contentClass, 'the generated guide is own-process').toBe(
                  'own-process'
                );
                expect(read.types.map((entry) => entry.type), where).not.toContain('Article');
              }

              // Requirements 5.8 and 5.13, the graph half.
              if (!domainConfirmed) expect(hostnameCarrying(graph), where).toEqual([]);
            }

            // Requirement 5.13, the page half.
            if (!domainConfirmed) {
              const attributeUrls = [...page.markup.matchAll(URL_ATTRIBUTES)]
                .map((match) => match[1]!)
                .filter((value) => findHostname(value) !== null)
                .map((value) => `${value} (hostname "${findHostname(value)}")`);
              expect(attributeUrls, `${route} links an absolute URL`).toEqual([]);
              const inText = findHostname(page.visibleText);
              expect(inText, `${route} shows the hostname "${inText}" as text`).toBeNull();
            }

            // The one hostname a response may carry names a vocabulary, not a page.
            const namespaces = [...page.markup.matchAll(XMLNS_VALUES)].map((match) => match[1]!);
            expect(
              namespaces.filter((value) => value !== SVG_NAMESPACE),
              `${route} declares a namespace other than the SVG one`
            ).toEqual([]);
          }
          expect(graphsSeen, 'no graph was audited on any page').toBeGreaterThan(routes.length - 1);
        }
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);
});
