/**
 * @vitest-environment jsdom
 */

/**
 * Task 13.4 — the whole-site rendered HTML proof. Requirements 1.6, 5.1, 5.2, 5.5
 * and 5.12.
 *
 * Every other rendered-markup file in this suite proves one thing about one kind of
 * page. This one proves the same small set of things about *every* public route the
 * registries admit, taken from `getPublicRoutes` rather than from a list kept here,
 * so a newly published route type cannot be skipped:
 *
 *  - **5.1, 5.2** The served HTML carries the canonical brand, the exact telephone
 *    link, the city name, exactly one `<h1>`, and — for a guide or an area page —
 *    every section heading, every body paragraph, every bullet and every approved
 *    FAQ entry *held in the record*. Driving the assertion from the record is the
 *    point: a paragraph that exists in data and is never rendered fails here. That
 *    is the failure worth catching, because the publication gate counted that
 *    paragraph when it decided the page was thick enough to publish.
 *  - **5.3** The direct answer's position in the document, measured on the markup:
 *    after the `</h1>` and before the first `<h2>`.
 *  - **5.6** Every string an emitted JSON-LD graph carries appears in the visible
 *    text of the same page, through `auditGraph`.
 *  - **5.5, 5.12** No brand or telephone rendering differs by a single character:
 *    every case-insensitive "instle real estate" in the visible text or in an
 *    accessible attribute equals `INSTLE REAL ESTATE`, every `tel:` href equals
 *    `tel:9353096264`, and every phone-shaped digit run equals `9353096264`.
 *  - **1.6** A locality page renders its `marketingGroup` nowhere. The label is
 *    permitted "only as a browsing label whose surrounding wording identifies the
 *    grouping as a browsing aid"; that wording lives beside the group headings on
 *    `/areas`, and the locality page has none of it, so the label does not belong
 *    there. See the note on the `PageIntro` in `src/app/areas/[slug]/page.tsx`.
 *
 * **Run twice.** Once against the live registries, where three guides publish and
 * no locality does, and once with fixture localities published through the same
 * `vi.mock` registry injection `tests/link-integrity.test.tsx` uses — so the
 * locality template is held to all of the above before the first real area page
 * goes up, rather than after.
 *
 * **What counts as the page's visible text.** The whole served response: the skip
 * link, the header as first served, `<main>`, the footer and the mobile action bar,
 * with script and style bodies removed first. The header and the footer are in the
 * same HTML a crawler receives — a reader of `/guides/x` sees the footer's text on
 * `/guides/x`, not somewhere else — so a JSON-LD value satisfied by the footer is
 * genuinely satisfied on that page, and a brand misspelling in the footer is a
 * brand misspelling on every page. Removing the script bodies first is what stops
 * the JSON-LD vouching for itself.
 */

import React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ClaimRecord, SourceRecord } from '@/config/claims';
import type { LocalityRecord, LocalitySection } from '@/config/localities';

const injected = vi.hoisted(() => ({
  claims: new Map<string, ClaimRecord>(),
  registry: null as readonly LocalityRecord[] | null,
  pathname: '/',
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
 * The registry swapped per world, so every accessor and gate that reads it is the
 * real one — including `getPublishedLocalities`, which defaults its registry to the
 * module's own binding that a getter on the export cannot reach.
 */
vi.mock('@/config/localities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/localities')>();
  const live = (): readonly LocalityRecord[] => injected.registry ?? actual.LOCALITY_REGISTRY;
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return live();
    },
    getPublishedLocalities: (now?: Date, registry?: readonly LocalityRecord[]) =>
      actual.getPublishedLocalities(now ?? new Date(), registry ?? live()),
  };
});

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return { ...actual, usePathname: () => injected.pathname };
});

import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { getPublishedGuideBySlug, type GuideRecord } from '@/config/guides';
import { MIN_SECTION_WORDS } from '@/config/locality-sections';
import { getPublicRoutes } from '@/lib/public-routes';
import { auditGraph, normaliseVisibleText, type GraphAudit } from '@/lib/structured-data-policy';
import type { JsonLdObject } from '@/lib/structured-data';

import {
  SERVED_REGIONS,
  renderServedPage,
  renderedLinks,
  type ServedPage,
  type ServedRegion,
} from './helpers/rendered-routes';

/** The date the rest of the suite judges the live registries on. */
const NOW = new Date('2026-09-29T00:00:00.000Z');

const PASSES: GraphAudit = { ok: true, failures: [] };

// ---------------------------------------------------------------------------
// Fixture localities — the same shape link-integrity publishes, with an approved
// FAQ and an evidenced administrative mapping, so the parts of the template only a
// published record reaches are rendered too.
// ---------------------------------------------------------------------------

const MAPPING_CLAIM_ID = 'CLM-FIXTURE-RENDERED-MAPPING';

/** Distinctive, so its absence from a locality page means exactly that. */
const FIXTURE_GROUP = 'Fixture Browsing Shelf';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'Example Survey Office',
    independenceGroup: 'example-survey',
    exactUrl: 'https://survey.example.gov/wards/fixture',
    documentReference: null,
    locationInSource: 'Schedule 2, row 4',
    publicationDate: '2026-06-01',
    accessDate: '2026-09-20',
    supportingNote: 'The schedule records the zone this place sits in.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

function passingClaim(claimId: string): ClaimRecord {
  return {
    claimId,
    claimText: 'FIXTURE-RENDERED-MAPPING-CLAIM',
    sources: [
      source(),
      source({
        publisher: 'Example Planning Authority',
        independenceGroup: 'example-planning',
        exactUrl: 'https://planning.example.gov/wards/fixture.pdf',
        locationInSource: 'Page 7',
      }),
    ],
    reviewer: 'A. Named Reviewer',
    reviewDate: '2026-09-21',
    conflictingEvidenceNotes: null,
    approvalStatus: 'approved',
    recheckBy: '2027-09-01',
    usedByRoutes: ['/areas/fixture-rendered-one'],
    evidenceGap: null,
  };
}

/**
 * A section at the gate's minimum depth. The first word is unique to the section,
 * so "this paragraph reached the page" is a real assertion rather than a match on
 * filler.
 */
function deepSection(sectionId: string, heading: string, seed: string): LocalitySection {
  const paragraph = Array.from({ length: MIN_SECTION_WORDS }, (_, index) =>
    index === 0 ? seed : 'word'
  ).join(' ');
  return { sectionId, heading, paragraphs: [paragraph], claimIds: [] };
}

/** A record that passes the locality gate as it stands. */
function place(slug: string, canonicalName: string, overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: `LOC-${slug.toUpperCase()}`,
    canonicalName,
    aliases: [],
    entityType: 'locality',
    slug,
    marketingGroup: FIXTURE_GROUP,
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    // An apostrophe and an ampersand, so the entity decoding below is exercised by
    // real rendered output rather than assumed.
    summary: `${canonicalName} is where we work, and the owner's brief & the tenant's brief differ.`,
    summaryClaimIds: [],
    sections: [
      deepSection(`${slug}-1`, `${slug} first question?`, `${slug}-paragraph-one`),
      deepSection(`${slug}-2`, `${slug} second question?`, `${slug}-paragraph-two`),
    ],
    approvedFaq: [
      {
        question: `Do you actually work in ${canonicalName}?`,
        answer: `Yes — and we will say so plainly if a brief does not suit ${canonicalName}.`,
        claimIds: [],
      },
    ],
    approvedNearbyRelationships: [],
    relatedGuideIds: [],
    postalMappingIds: [],
    imageRightsRecords: [],
    author: 'A. Named Author',
    localReviewer: 'A. Named Local Reviewer',
    seoReviewer: 'A. Named SEO Reviewer',
    editorialApprovedAt: '2026-09-20',
    localReviewApprovedAt: '2026-09-20',
    seoReviewApprovedAt: '2026-09-20',
    sourceCheckedAt: '2026-09-20',
    nextReviewAt: '2027-06-01',
    contentUpdatedAt: '2026-09-20',
    editorialStatus: 'approved',
    publicationStatus: 'published',
    blockingNotes: [],
    primaryIntent: null,
    supportingPhrases: [],
    visualAssetIds: [],
    ...overrides,
  };
}

function fixtureRegistry(): LocalityRecord[] {
  return [
    place('fixture-rendered-one', 'Fixture Rendered One', {
      administrativeMappings: [
        {
          mappingType: 'planning district',
          value: 'Example planning district',
          boundaryVersion: '2023 delimitation',
          claimId: MAPPING_CLAIM_ID,
        },
      ],
    }),
    place('fixture-rendered-two', 'Fixture Rendered Two'),
    // A different browsing label, so the hub renders two groups and neither label
    // can pass the 1.6 check by being absent from the registry.
    place('fixture-rendered-three', 'Fixture Rendered Three', {
      marketingGroup: 'Fixture Browsing Annexe',
    }),
  ];
}

// ---------------------------------------------------------------------------
// Reading a served page
// ---------------------------------------------------------------------------

/**
 * The text of one region as a reader receives it: script and style bodies dropped
 * first, then tags read as a space, then the five entities `renderToStaticMarkup`
 * produces decoded back to characters.
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
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parse(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

/** The accessible attribute values a page renders: a name a reader can still meet. */
const ACCESSIBLE_ATTRIBUTES = ['aria-label', 'title', 'alt'] as const;

function accessibleAttributeValues(markup: string): string[] {
  const values: string[] = [];
  for (const element of Array.from(parse(markup).querySelectorAll('*'))) {
    for (const name of ACCESSIBLE_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value && value.trim().length > 0) values.push(value);
    }
  }
  return values;
}

interface Snapshot {
  readonly route: string;
  /** The page's own content, what the route renders inside `<main>`. */
  readonly main: string;
  /** Every region, concatenated in document order. */
  readonly served: string;
  /** Case preserved, whitespace collapsed, entities decoded. */
  readonly visible: string;
  /** `visible` through `normaliseVisibleText`, for containment checks. */
  readonly normalised: string;
  readonly h1Texts: readonly string[];
  readonly telHrefs: readonly string[];
  readonly attributeValues: readonly string[];
  readonly graphs: readonly JsonLdObject[];
}

const JSON_LD = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

function snapshot(page: ServedPage): Snapshot {
  const served = SERVED_REGIONS.map((region: ServedRegion) => page.regions[region]).join('\n');
  const visible = visibleTextOf(served);
  return {
    route: page.route,
    main: page.regions.main,
    served,
    visible,
    normalised: normaliseVisibleText(visible),
    h1Texts: Array.from(parse(served).querySelectorAll('h1')).map((heading) =>
      (heading.textContent ?? '').replace(/\s+/g, ' ').trim()
    ),
    telHrefs: renderedLinks(served)
      .map((link) => link.href)
      .filter((href) => href.toLowerCase().startsWith('tel')),
    attributeValues: accessibleAttributeValues(served),
    graphs: [...served.matchAll(JSON_LD)].map((match) => JSON.parse(match[1]!) as JsonLdObject),
  };
}

// ---------------------------------------------------------------------------
// The two worlds, each rendered once
// ---------------------------------------------------------------------------

interface World {
  readonly name: string;
  readonly registry: () => LocalityRecord[] | null;
}

const WORLDS: readonly World[] = [
  { name: 'the live registries', registry: () => null },
  { name: 'the fixture localities published', registry: () => fixtureRegistry() },
];

interface CapturedWorld {
  readonly routes: readonly string[];
  readonly pages: ReadonlyMap<string, Snapshot>;
  readonly localities: ReadonlyMap<string, LocalityRecord>;
}

/**
 * Render every public route of one world, at one date, once. Assertions then read
 * strings, so the registry injection is live for exactly as long as the rendering.
 */
async function capture(world: World): Promise<CapturedWorld> {
  const registry = world.registry();
  injected.claims.clear();
  injected.claims.set(MAPPING_CLAIM_ID, passingClaim(MAPPING_CLAIM_ID));
  injected.registry = registry;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  try {
    const routes = getPublicRoutes(NOW).map((route) => route.path);
    const pages = new Map<string, Snapshot>();
    for (const route of routes) {
      injected.pathname = route;
      pages.set(route, snapshot(await renderServedPage(route)));
    }
    const localities = new Map((registry ?? []).map((record) => [`/areas/${record.slug}`, record]));
    return { routes, pages, localities };
  } finally {
    vi.useRealTimers();
    injected.registry = null;
    injected.pathname = '/';
  }
}

// ---------------------------------------------------------------------------
// The rules, each held over every route of every world
// ---------------------------------------------------------------------------

/** Requirement 5.12. Every way the brand could be spelled on the page. */
const BRAND_OCCURRENCE = /instle\s+real\s+estate/gi;

/**
 * A phone-shaped run in visible text. Seven or more unseparated digits, or the
 * separated shapes an Indian mobile is usually typed in, or a country prefix. A
 * recorded date — "2026-09-20" — is four digits then two then two, so it is none
 * of these.
 */
const PHONE_SHAPES: readonly RegExp[] = [/\d{7,}/g, /\d{5}[\s-]\d{5}/g, /\d{3}[\s-]\d{3}[\s-]\d{4}/g, /\+\s*91/g];

function guideRecordFor(route: string): GuideRecord | null {
  const match = /^\/guides\/([^/]+)$/.exec(route);
  return match ? getPublishedGuideBySlug(match[1]!, NOW) ?? null : null;
}

describe.each(WORLDS)('every public route, served as HTML, with $name', (world) => {
  let captured: CapturedWorld;

  beforeAll(async () => {
    captured = await capture(world);
  }, 120_000);

  afterAll(() => {
    injected.claims.clear();
    injected.registry = null;
  });

  const page = (route: string): Snapshot => {
    const found = captured.pages.get(route);
    if (!found) throw new Error(`${route} was not rendered.`);
    return found;
  };

  it('renders every route the registries admit, and the counts this world expects', () => {
    const localityRoutes = captured.routes.filter((route) => route.startsWith('/areas/'));
    const guideRoutes = captured.routes.filter((route) => route.startsWith('/guides/'));
    // Three guides publish today and the fixture registry publishes three areas.
    expect(guideRoutes).toHaveLength(3);
    expect(localityRoutes).toHaveLength(world.registry() === null ? 0 : 3);
    expect(captured.pages.size).toBe(captured.routes.length);
  });

  describe('the initial HTML response (Requirements 5.1, 5.2)', () => {
    it('carries the canonical brand, the telephone link and the city on every route', () => {
      for (const route of captured.routes) {
        const served = page(route);
        expect(served.visible, route).toContain(CANONICAL_BRAND);
        expect(served.served, route).toContain(`href="${PRIMARY_PHONE_TEL}"`);
        expect(served.visible, route).toContain(PRIMARY_PHONE);
        expect(served.visible, route).toContain('Bengaluru');
      }
    });

    it('carries exactly one <h1> on every route, and it is not empty', () => {
      for (const route of captured.routes) {
        const served = page(route);
        expect(served.h1Texts, route).toHaveLength(1);
        expect(served.h1Texts[0]!.length, route).toBeGreaterThan(0);
      }
    });

    it('spells the owner name exactly wherever a page names the owner (Requirement 5.1)', () => {
      const named = captured.routes.filter((route) => /utpal/i.test(page(route).visible));
      expect(named.length).toBeGreaterThan(0);
      for (const route of named) {
        const occurrences = page(route).visible.match(/utpal[^,.\n]*/gi) ?? [];
        for (const occurrence of occurrences) {
          expect(occurrence.startsWith('Utpal Raj KB'), `${route}: "${occurrence}"`).toBe(true);
        }
      }
    });
  });

  describe('the principal page text a record holds (Requirement 5.2)', () => {
    it('renders every guide record in full: answer, headings, paragraphs, bullets, next step, scope', () => {
      const guideRoutes = captured.routes.filter((route) => route.startsWith('/guides/'));
      for (const route of guideRoutes) {
        const record = guideRecordFor(route);
        expect(record, route).not.toBeNull();
        const served = page(route);
        const holds = (text: string, what: string) => {
          // An empty needle is in every haystack, so the record's own text is
          // checked to be text before it is looked for.
          expect(normaliseVisibleText(text).length, `${route}: ${what} is empty in the record`).toBeGreaterThan(0);
          expect(served.normalised, `${route}: ${what}`).toContain(normaliseVisibleText(text));
        };

        expect(served.h1Texts[0], route).toBe(record!.title);
        holds(record!.directAnswer, 'direct answer');
        holds(record!.nextStep, 'next step');
        holds(record!.scopeNote, 'scope note');
        for (const section of record!.sections) {
          holds(section.heading, `section heading "${section.heading}"`);
          for (const paragraph of section.paragraphs) holds(paragraph, 'a section paragraph');
          for (const bullet of section.bullets ?? []) holds(bullet, `bullet "${bullet}"`);
        }
      }
    });

    it('renders every locality record in full: summary, headings, paragraphs, FAQ, boundaries', () => {
      for (const [route, record] of captured.localities) {
        const served = page(route);
        const holds = (text: string, what: string) => {
          expect(normaliseVisibleText(text).length, `${route}: ${what} is empty in the record`).toBeGreaterThan(0);
          expect(served.normalised, `${route}: ${what}`).toContain(normaliseVisibleText(text));
        };

        expect(served.h1Texts[0], route).toBe(`Property in ${record.canonicalName}`);
        holds(record.summary, 'summary');
        for (const section of record.sections) {
          holds(section.heading, `section heading "${section.heading}"`);
          for (const paragraph of section.paragraphs) holds(paragraph, 'a section paragraph');
        }
        for (const faq of record.approvedFaq) {
          holds(faq.question, `FAQ question "${faq.question}"`);
          holds(faq.answer, 'a FAQ answer');
        }
        // Requirement 1.7: the value and its boundary set in the same element.
        for (const mapping of record.administrativeMappings) {
          if (!mapping.boundaryVersion) continue;
          holds(`${mapping.value} (${mapping.boundaryVersion})`, 'an administrative mapping');
        }
      }
    });
  });

  describe("the direct answer's position in the document (Requirement 5.3)", () => {
    it('falls after the </h1> and before the first <h2> on every guide, and nowhere else', () => {
      for (const route of captured.routes) {
        const main = page(route).main;
        const locators = [...main.matchAll(/data-direct-answer/g)];
        if (!route.startsWith('/guides/')) {
          expect(locators, route).toHaveLength(0);
          continue;
        }
        expect(locators, route).toHaveLength(1);
        const answerAt = locators[0]!.index;
        const afterH1 = main.indexOf('</h1>');
        const firstH2 = main.search(/<h2\b/);
        expect(afterH1, route).toBeGreaterThanOrEqual(0);
        expect(firstH2, route).toBeGreaterThanOrEqual(0);
        expect(answerAt, `${route}: answer after the </h1>`).toBeGreaterThan(afterH1);
        expect(answerAt, `${route}: answer before the first <h2>`).toBeLessThan(firstH2);
      }
    });
  });

  describe('every emitted JSON-LD value is text a reader of that page can see (Requirement 5.6)', () => {
    it('passes the audit on every route that emits a graph', () => {
      for (const route of captured.routes) {
        const served = page(route);
        for (const graph of served.graphs) {
          expect(auditGraph(graph, served.visible, { domainConfirmed: false }), route).toEqual(PASSES);
        }
      }
    });

    /**
     * An audit of nothing passes, so the set of routes that emit nothing is named
     * rather than left to chance. These five are the site's navigational and
     * about-us pages: none describes a service, a person or a breadcrumb trail
     * worth emitting while the domain is unconfirmed, and 13.2 settled that. Every
     * other route — the homepage, the five service pages, the owner profile, every
     * guide and every published area — emits one graph and the audit above holds
     * over it. Publishing a graph on one of these five means editing this list.
     */
    const ROUTES_WITHOUT_A_GRAPH = ['/areas', '/guides', '/how-it-works', '/about', '/contact'];

    it('emits exactly one graph on every route outside the named set', () => {
      const withoutGraph: string[] = [];
      for (const route of captured.routes) {
        const count = page(route).graphs.length;
        if (count === 0) withoutGraph.push(route);
        else expect(count, route).toBe(1);
      }
      expect(withoutGraph).toEqual(ROUTES_WITHOUT_A_GRAPH);
    });
  });

  describe('brand and telephone, character for character (Requirements 5.5, 5.12)', () => {
    it('renders no occurrence of the business name that differs from the canonical lockup', () => {
      for (const route of captured.routes) {
        const served = page(route);
        const sources = [served.visible, ...served.attributeValues];
        for (const text of sources) {
          for (const occurrence of text.match(BRAND_OCCURRENCE) ?? []) {
            expect(occurrence, `${route}: "${occurrence}"`).toBe(CANONICAL_BRAND);
          }
        }
      }
    });

    it('carries at least one brand occurrence per route, so the rule above has something to hold', () => {
      for (const route of captured.routes) {
        expect((page(route).visible.match(BRAND_OCCURRENCE) ?? []).length, route).toBeGreaterThan(0);
      }
    });

    it('renders every tel: href as the exact canonical link', () => {
      for (const route of captured.routes) {
        const served = page(route);
        expect(served.telHrefs.length, route).toBeGreaterThan(0);
        for (const href of served.telHrefs) expect(href, route).toBe(PRIMARY_PHONE_TEL);
      }
    });

    it('renders no phone-shaped digit run other than the canonical number', () => {
      for (const route of captured.routes) {
        const served = page(route);
        for (const shape of PHONE_SHAPES) {
          for (const occurrence of served.visible.match(shape) ?? []) {
            expect(occurrence, `${route}: "${occurrence}"`).toBe(PRIMARY_PHONE);
          }
        }
      }
    });
  });

  describe('the browsing label stays a browsing label (Requirement 1.6)', () => {
    it('renders no marketingGroup on a locality page, in its text, its attributes or its graph', () => {
      const labels = [...new Set([...captured.localities.values()].map((record) => record.marketingGroup))];
      if (captured.localities.size > 0) expect(labels.length).toBeGreaterThan(0);

      for (const route of captured.localities.keys()) {
        const served = page(route);
        for (const label of labels) {
          const needle = normaliseVisibleText(label);
          expect(served.normalised, `${route}: "${label}" in visible text`).not.toContain(needle);
          for (const value of served.attributeValues) {
            expect(normaliseVisibleText(value), `${route}: "${label}" in an attribute`).not.toContain(needle);
          }
          for (const graph of served.graphs) {
            expect(normaliseVisibleText(JSON.stringify(graph)), `${route}: "${label}" in JSON-LD`).not.toContain(
              needle
            );
          }
        }
      }
    });
  });
});
