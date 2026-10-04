/**
 * @vitest-environment jsdom
 */

/**
 * Task 10.1 — the internal link groups and their rules.
 * Requirements 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.9 and 8.11.
 *
 * Four layers:
 *
 *  - **The pure rules** in `src/lib/internal-links.ts`: link text, call actions,
 *    the footer's composition, and how a group is capped and emptied.
 *  - **A published locality page**, rendered from fixtures: its three groups, what
 *    each nearby link says and what sits beside it, what is left out and how, and
 *    the orientation plate, its decision and its Media_Register entry all drawing
 *    on one list of neighbours.
 *  - **Every public route**, rendered from `getPublicRoutes` — once against the live
 *    registries and once with the fixture localities published — and every link
 *    on it, shell included, held to the link-text rule; every page's own content
 *    held to 1 to 3 call actions.
 *  - **The footer**, held to 12 links drawn from the header's sections plus one call
 *    action, with no individual locality or guide.
 *
 * No real locality passes the gate, so the locality cases inject fixtures the same
 * way `tests/locality-page-template.test.tsx` does: fixture claims layered in front
 * of the live ledger and judged by the real claim gate, and the registry export
 * swapped per test so every accessor and gate that reads it is the real one. The
 * guides are the live ones; three of them pass today.
 */

import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClaimRecord, SourceRecord } from '@/config/claims';
import type { LocalityRecord, LocalitySection, NearbyRelationship } from '@/config/localities';

const injected = vi.hoisted(() => ({
  claims: new Map<string, ClaimRecord>(),
  registry: null as readonly LocalityRecord[] | null,
  pathname: '/',
}));

vi.mock('@/config/claims', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/claims')>();
  const getClaim = (claimId: string): ClaimRecord | undefined =>
    injected.claims.get(claimId) ?? actual.getClaim(claimId);
  return {
    ...actual,
    getClaim,
    // Same shape as the real `evaluateClaims`, reading through the layered ledger.
    evaluateClaims: (claimIds: readonly string[], now: Date = new Date()) => {
      const failures: string[] = [];
      for (const claimId of claimIds) {
        const claim = getClaim(claimId);
        if (!claim) {
          failures.push(`${claimId}: no such claim in the ledger.`);
          continue;
        }
        const evaluation = actual.evaluateClaim(claim, now);
        if (!evaluation.eligible) {
          failures.push(...evaluation.failures.map((reason) => `${claimId}: ${reason}`));
        }
      }
      return { eligible: failures.length === 0, failures };
    },
  };
});

vi.mock('@/config/localities', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/localities')>();
  return {
    ...actual,
    get LOCALITY_REGISTRY() {
      return injected.registry ?? actual.LOCALITY_REGISTRY;
    },
  };
});

vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/navigation')>();
  return { ...actual, usePathname: () => injected.pathname };
});

// A plain anchor: the assertions are about which hrefs and text the server markup
// carries. `prefetch` is a Link option rather than an anchor attribute.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...rest
  }: { href: string; children: React.ReactNode; prefetch?: boolean | null } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { evaluateClaim } from '@/config/claims';
import { HEADER_NAV_ITEMS, NAV_GROUPS, PRIMARY_PHONE_TEL } from '@/config/constants';
import { GUIDE_REGISTRY, getGuideById, getPublishedGuideBySlug } from '@/config/guides';
import { LOCALITY_REGISTRY, evaluateLocality } from '@/config/localities';
import { MIN_SECTION_WORDS, getPublishedAreaRecordBySlug } from '@/config/locality-sections';
import {
  LAYOUT_GRID_ASSET_ID,
  MIN_NEIGHBOUR_PLATES,
  areaOrientationAssetId,
  canRenderAreaOrientationPlate,
  localityVisualAssetIds,
} from '@/config/media-register';
import {
  GENERIC_LINK_TEXTS,
  MAX_CALL_ACTIONS_PER_PAGE,
  MAX_FOOTER_LINKS,
  MAX_LINKS_PER_GROUP,
  MAX_LINK_TEXT_LENGTH,
  MIN_CALL_ACTIONS_PER_PAGE,
  auditFooterLinks,
  buildLinkGroup,
  countCallActions,
  finaliseLinks,
  headerSectionHrefs,
  isBareUrl,
  isCallActionHref,
  isGenericLinkText,
  renderableLinkGroups,
  renderableNearbyRelationships,
  validateLinkText,
  type InternalLink,
} from '@/lib/internal-links';
import { STATIC_PUBLIC_ROUTES, getPublicRoutes } from '@/lib/public-routes';
import { RelatedLinks } from '@/components/RelatedLinks/RelatedLinks';
import { Footer } from '@/components/Footer/Footer';
import LocalityPage from '@/app/areas/[slug]/page';

import {
  STATIC_ROUTE_PAGES,
  parseMarkup,
  renderRouteContent,
  renderShell,
  renderedLinks,
  accessibleLinkText,
} from './helpers/rendered-routes';

const NOW = new Date('2026-09-29T00:00:00.000Z');
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RELATIONSHIP_CLAIM_ID = 'CLM-FIXTURE-LINKS-RELATIONSHIP';

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'Example Survey Office',
    independenceGroup: 'example-survey',
    exactUrl: 'https://survey.example.gov/roads/fixture',
    documentReference: null,
    locationInSource: 'Schedule 2, row 4',
    publicationDate: '2026-06-01',
    accessDate: '2026-09-20',
    supportingNote: 'The schedule lists both places on the same road.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

function passingClaim(claimId: string): ClaimRecord {
  return {
    claimId,
    claimText: 'FIXTURE-LINKS-RELATIONSHIP-CLAIM',
    sources: [
      source(),
      source({
        publisher: 'Example Planning Authority',
        independenceGroup: 'example-planning',
        exactUrl: 'https://planning.example.gov/roads/fixture.pdf',
        locationInSource: 'Page 7',
      }),
    ],
    reviewer: 'A. Named Reviewer',
    reviewDate: '2026-09-21',
    conflictingEvidenceNotes: null,
    approvalStatus: 'approved',
    recheckBy: '2027-09-01',
    usedByRoutes: ['/areas/fixture-centre'],
    evidenceGap: null,
  };
}

function paragraphOfWords(words: number, seed: string): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
}

function deepSection(sectionId: string, heading: string, seed: string): LocalitySection {
  return { sectionId, heading, paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, seed)], claimIds: [] };
}

/** A record that passes the locality gate as it stands, with sections of its own. */
function place(slug: string, canonicalName: string, overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: `LOC-${slug.toUpperCase()}`,
    canonicalName,
    aliases: [],
    entityType: 'locality',
    slug,
    marketingGroup: 'Fixture Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    summary: `${canonicalName} summary, stating no external facts.`,
    summaryClaimIds: [],
    sections: [
      deepSection(`${slug}-1`, `${slug} first question?`, `${slug}-paragraph-one`),
      deepSection(`${slug}-2`, `${slug} second question?`, `${slug}-paragraph-two`),
    ],
    approvedFaq: [],
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

function evidenced(slug: string, relationship: string): NearbyRelationship {
  return { slug, relationship, claimId: RELATIONSHIP_CLAIM_ID };
}

/** A real alias from the live table, so the real resolver is what runs. */
const ALIAS = 'indira-nagar';
const ALIAS_CANONICAL = 'indiranagar';

const LIVE_GUIDE_IDS = ['GD-SELL-PREPARE', 'GD-RENTOUT-DECISIONS'] as const;
/** In the live registry and unpublished: an external-fact guide awaiting review. */
const DRAFT_GUIDE_ID = 'GD-BUY-DOCUMENTS';

const EAST_STATEMENT = 'EAST-STATEMENT shares the fixture main road with this area';
const ALIAS_STATEMENT = 'ALIAS-STATEMENT sits on the fixture ring road beside this area';
const OMITTED_STATEMENTS = [
  'UNEVIDENCED-STATEMENT',
  'UNPUBLISHED-STATEMENT',
  'SELF-STATEMENT',
  'DUPLICATE-STATEMENT',
] as const;

const EIGHT_NEIGHBOURS = Array.from({ length: 8 }, (_, index) =>
  place(`fixture-n${index + 1}`, `Fixture Neighbour ${index + 1}`)
);

/**
 * The page every positive assertion reads. Two nearby relationships the page may
 * link, and one of every kind it may not.
 */
const centre = place('fixture-centre', 'Fixture Centre', {
  relatedGuideIds: [
    LIVE_GUIDE_IDS[0],
    DRAFT_GUIDE_ID,
    'GD-NO-SUCH-GUIDE',
    LIVE_GUIDE_IDS[1],
    LIVE_GUIDE_IDS[0],
  ],
  approvedNearbyRelationships: [
    evidenced('fixture-east', EAST_STATEMENT),
    // Recorded against the alias spelling, so the link shows the alias is resolved.
    evidenced(ALIAS, ALIAS_STATEMENT),
    // Published destination, no claim behind the relationship (8.4).
    { slug: 'fixture-west', relationship: 'UNEVIDENCED-STATEMENT', claimId: null },
    // Evidenced, but the destination fails the gate (8.5).
    evidenced('fixture-draft', 'UNPUBLISHED-STATEMENT'),
    // The page itself.
    evidenced('fixture-centre', 'SELF-STATEMENT'),
    // A second relationship to a destination already linked.
    evidenced('fixture-east', 'DUPLICATE-STATEMENT'),
    // Evidenced and published, but no statement to render.
    evidenced('fixture-south', '   '),
  ],
});

/**
 * Two recorded neighbours — enough to draw, counted raw — neither of which the page
 * may link, and no related guide.
 */
const lonely = place('fixture-lonely', 'Fixture Lonely', {
  approvedNearbyRelationships: [
    { slug: 'fixture-west', relationship: 'UNEVIDENCED-STATEMENT', claimId: null },
    evidenced('fixture-draft', 'UNPUBLISHED-STATEMENT'),
  ],
});

/** Eight evidenced, published neighbours: two more than a group may carry. */
const crowded = place('fixture-crowded', 'Fixture Crowded', {
  approvedNearbyRelationships: EIGHT_NEIGHBOURS.map((neighbour) =>
    evidenced(neighbour.slug, `${neighbour.canonicalName} shares the fixture road with this area`)
  ),
});

function fixtureRegistry(): LocalityRecord[] {
  return [
    centre,
    lonely,
    crowded,
    place('fixture-east', 'Fixture East'),
    place(ALIAS_CANONICAL, 'Fixture Indiranagar', { aliases: ['Indira Nagar'] }),
    place('fixture-west', 'Fixture West'),
    place('fixture-south', 'Fixture South'),
    place('fixture-draft', 'Fixture Draft', { actualServiceCoverage: 'unconfirmed' }),
    ...EIGHT_NEIGHBOURS,
  ];
}

const props = (slug: string) => ({ params: Promise.resolve({ slug }) });

async function renderLocality(slug: string): Promise<HTMLElement> {
  return parseMarkup(renderToStaticMarkup(await LocalityPage(props(slug))));
}

function group(page: ParentNode, key: string): HTMLUListElement | null {
  return page.querySelector(`ul[data-link-group="${key}"]`);
}

function groupLinks(page: ParentNode, key: string): { href: string; text: string }[] {
  const list = group(page, key);
  return list
    ? Array.from(list.querySelectorAll('a[href]')).map((anchor) => ({
        href: anchor.getAttribute('href') ?? '',
        text: accessibleLinkText(anchor),
      }))
    : [];
}

function navLabel(href: string): string {
  const item = NAV_GROUPS.flatMap((entry) => entry.items).find((candidate) => candidate.href === href);
  if (!item) throw new Error(`No navigation label for ${href}`);
  return item.label;
}

function guideTitle(guideId: string): string {
  const guide = getGuideById(guideId);
  if (!guide) throw new Error(`No guide ${guideId}`);
  return guide.title;
}

const ENV_KEYS = ['INSTLE_ENQUIRY_INTAKE_ENABLED'] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  injected.claims.clear();
  injected.claims.set(RELATIONSHIP_CLAIM_ID, passingClaim(RELATIONSHIP_CLAIM_ID));
  injected.registry = null;
  injected.pathname = '/';
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  injected.registry = null;
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ---------------------------------------------------------------------------
// The pure rules
// ---------------------------------------------------------------------------

describe('link text (Requirement 8.2)', () => {
  it('accepts a destination named in 2 to 80 characters', () => {
    for (const text of ['Buy property', 'Fixture East', 'Koramangala', 'OK', 'x'.repeat(MAX_LINK_TEXT_LENGTH)]) {
      expect(validateLinkText(text), text).toEqual([]);
    }
  });

  it('rejects text below 2 or above 80 characters, after whitespace is collapsed', () => {
    expect(validateLinkText('')).toContain('too-short');
    expect(validateLinkText('  A  ')).toContain('too-short');
    expect(validateLinkText('x'.repeat(MAX_LINK_TEXT_LENGTH + 1))).toContain('too-long');
    // 80 visible characters with the whitespace runs a template might leave.
    expect(validateLinkText(`  ${'x'.repeat(40)}   ${'y'.repeat(39)}  `)).toEqual([]);
  });

  it('rejects every member of the generic set, whatever the case and trailing punctuation', () => {
    for (const generic of GENERIC_LINK_TEXTS) {
      for (const variant of [generic, generic.toUpperCase(), ` ${generic}. `, `${generic} →`, `…${generic}`]) {
        expect(isGenericLinkText(variant), variant).toBe(true);
        expect(validateLinkText(variant), variant).toContain('generic');
      }
    }
  });

  it('does not treat a name that merely contains a generic word as generic', () => {
    for (const text of ['More about Utpal Raj KB', 'Here is how we work', 'Link Road area']) {
      expect(isGenericLinkText(text), text).toBe(false);
    }
  });

  it('rejects a bare URL, host name or path as link text', () => {
    for (const bare of [
      'https://example.com',
      'http://example.com/areas/indiranagar',
      'www.example.com',
      'example.co.in',
      'example.com/guides',
      '/areas/indiranagar',
      'tel:9353096264',
      'mailto:someone@example.com',
    ]) {
      expect(isBareUrl(bare), bare).toBe(true);
      expect(validateLinkText(bare), bare).toContain('bare-url');
    }
  });

  it('does not treat the phone digits or a sentence mentioning a site as bare', () => {
    for (const text of ['9353096264', 'Call 9353096264', 'Read our guide on example.com rules', 'No. 1 Main Road']) {
      expect(isBareUrl(text), text).toBe(false);
    }
  });
});

describe('call actions (Requirement 8.7)', () => {
  it('counts a link to the phone or to the contact route, and nothing else', () => {
    for (const href of [PRIMARY_PHONE_TEL, '/contact', '/contact/', '/contact#form', '/contact?from=home']) {
      expect(isCallActionHref(href), href).toBe(true);
    }
    for (const href of ['/contact-us', '/about', '/buy#enquiry', '#enquiry', '/']) {
      expect(isCallActionHref(href), href).toBe(false);
    }
    expect(countCallActions([PRIMARY_PHONE_TEL, '/buy', '/contact', '#enquiry'])).toBe(2);
  });
});

describe('the footer rule (Requirement 8.6)', () => {
  const sections = [...headerSectionHrefs()];

  it('draws the header sections from what the header actually renders', () => {
    const shell = renderShell();
    const rendered = new Set([...renderedLinks(shell.header), ...renderedLinks(shell.drawer)].map((link) => link.href));
    for (const href of sections) expect(rendered.has(href), href).toBe(true);
    // Both navigation lists are in the set.
    for (const item of [...HEADER_NAV_ITEMS, ...NAV_GROUPS.flatMap((entry) => entry.items)]) {
      expect(sections).toContain(item.href);
    }
  });

  it('accepts header sections plus the phone, up to 12 links', () => {
    expect(auditFooterLinks([...sections.slice(0, MAX_FOOTER_LINKS - 1), PRIMARY_PHONE_TEL]).failures).toEqual([]);
  });

  it('rejects a 13th link, a second phone link, a route the header does not render, and any locality or guide', () => {
    expect(auditFooterLinks([...sections, ...sections, PRIMARY_PHONE_TEL]).ok).toBe(false);
    expect(auditFooterLinks(['/buy', PRIMARY_PHONE_TEL, PRIMARY_PHONE_TEL]).failures.join(' ')).toMatch(/phone links/);
    expect(auditFooterLinks(['/buy', '/privacy']).failures.join(' ')).toMatch(/\/privacy/);
    expect(auditFooterLinks(['/buy', '/areas/indiranagar']).failures.join(' ')).toMatch(/locality page/);
    expect(auditFooterLinks(['/buy', '/guides/how-brokerage-fees-work']).failures.join(' ')).toMatch(/guide page/);
  });
});

describe('a link group (Requirements 8.1, 8.9)', () => {
  const link = (index: number, text = `Destination ${index}`): InternalLink => ({
    href: `/destination-${index}`,
    text,
    description: null,
  });

  it('keeps the first six distinct destinations whose text passes, in the caller’s order', () => {
    const links = [
      link(1),
      link(2, 'read more'),
      link(3, 'https://example.com'),
      link(1, 'A second link to one'),
      ...Array.from({ length: 8 }, (_, index) => link(index + 4)),
    ];
    const kept = finaliseLinks(links);
    expect(kept).toHaveLength(MAX_LINKS_PER_GROUP);
    expect(kept.map((entry) => entry.href)).toEqual([
      '/destination-1',
      '/destination-4',
      '/destination-5',
      '/destination-6',
      '/destination-7',
      '/destination-8',
    ]);
    expect(kept[0]!.text).toBe('Destination 1');
  });

  it('drops a group with no links, and renders nothing at all when every group is empty', () => {
    const empty = [buildLinkGroup('services', []), buildLinkGroup('guides', []), buildLinkGroup('nearby', [])];
    expect(renderableLinkGroups(empty)).toEqual([]);
    expect(renderToStaticMarkup(<RelatedLinks groups={empty} idPrefix="fixture" />)).toBe('');
  });

  it('renders a non-empty group as a heading and a list, one link and its context per item', () => {
    const groups = [
      buildLinkGroup('guides', []),
      buildLinkGroup('nearby', [{ href: '/areas/fixture-east', text: 'Fixture East', description: EAST_STATEMENT }]),
    ];
    const page = parseMarkup(renderToStaticMarkup(<RelatedLinks groups={groups} idPrefix="fixture" />));
    expect(page.querySelector('#fixture-guides-heading')).toBeNull();
    expect(page.querySelector('#fixture-nearby-heading')?.textContent).toBe('Areas next to this one');
    const items = page.querySelectorAll('ul[data-link-group="nearby"] > li');
    expect(items).toHaveLength(1);
    expect(items[0]!.querySelector('a')?.textContent).toBe('Fixture East');
    expect(items[0]!.textContent).toContain(EAST_STATEMENT);
  });
});

// ---------------------------------------------------------------------------
// A published locality page
// ---------------------------------------------------------------------------

describe('the fixtures', () => {
  beforeEach(() => {
    injected.registry = fixtureRegistry();
  });

  it('layer a relationship claim that passes the real claim gate', () => {
    expect(evaluateClaim(passingClaim(RELATIONSHIP_CLAIM_ID), NOW).failures).toEqual([]);
  });

  it('publish every fixture place but the draft, and leave the draft guide unpublished', () => {
    for (const record of fixtureRegistry()) {
      const failures = evaluateLocality(record, NOW).failures;
      if (record.slug === 'fixture-draft') expect(failures.length, record.slug).toBeGreaterThan(0);
      else expect(failures, record.slug).toEqual([]);
    }
    expect(getPublishedGuideBySlug(getGuideById(DRAFT_GUIDE_ID)!.slug, NOW)).toBeUndefined();
    for (const guideId of LIVE_GUIDE_IDS) {
      expect(getPublishedGuideBySlug(getGuideById(guideId)!.slug, NOW), guideId).toBeDefined();
    }
  });
});

describe('a published locality page renders the three groups (Requirements 8.1, 8.9)', () => {
  beforeEach(() => {
    injected.registry = fixtureRegistry();
  });

  it('renders services, related guides and nearby areas, in that order, each under its own heading', async () => {
    const page = await renderLocality('fixture-centre');
    const keys = Array.from(page.querySelectorAll('ul[data-link-group]')).map((list) =>
      list.getAttribute('data-link-group')
    );
    expect(keys).toEqual(['services', 'guides', 'nearby']);
    for (const key of keys) {
      const section = group(page, key!)!.closest('section')!;
      const headingId = `locality-${key}-heading`;
      expect(section.getAttribute('aria-labelledby')).toBe(headingId);
      expect(section.querySelector(`#${headingId}`)?.tagName).toBe('H2');
    }
    expect(page.querySelectorAll('h1')).toHaveLength(1);
  });

  it('links the service pages the brokerage has confirmed, named as the navigation names them', async () => {
    const links = groupLinks(await renderLocality('fixture-centre'), 'services');
    const hrefs = ['/buy', '/sell', '/rent', '/rent-out'];
    expect(links).toEqual(hrefs.map((href) => ({ href, text: navLabel(href) })));
    // Commercial coverage is on request, not confirmed, so it is not offered here.
    expect(links.map((link) => link.href)).not.toContain('/commercial');
  });

  it('links only the related guides that pass the guide gate, once each, by their titles', async () => {
    const links = groupLinks(await renderLocality('fixture-centre'), 'guides');
    expect(links).toEqual(
      LIVE_GUIDE_IDS.map((guideId) => ({
        href: `/guides/${getGuideById(guideId)!.slug}`,
        text: guideTitle(guideId),
      }))
    );
    const draft = getGuideById(DRAFT_GUIDE_ID)!;
    const markup = (await renderLocality('fixture-centre')).innerHTML;
    expect(markup).not.toContain(`/guides/${draft.slug}`);
    expect(markup).not.toContain(draft.title);
  });

  it('names each nearby area by its canonical name, never by its slug or an alias', async () => {
    const links = groupLinks(await renderLocality('fixture-centre'), 'nearby');
    expect(links).toEqual([
      { href: '/areas/fixture-east', text: 'Fixture East' },
      { href: `/areas/${ALIAS_CANONICAL}`, text: 'Fixture Indiranagar' },
    ]);
    for (const { text } of links) {
      expect(text).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
      expect(text).not.toBe(ALIAS);
    }
  });

  it('renders each claim-backed statement in the same list item as its link, outside the link (8.11)', async () => {
    const page = await renderLocality('fixture-centre');
    const items = Array.from(group(page, 'nearby')!.children);
    expect(items.map((item) => item.tagName)).toEqual(['LI', 'LI']);
    for (const [item, statement] of [
      [items[0]!, EAST_STATEMENT],
      [items[1]!, ALIAS_STATEMENT],
    ] as const) {
      const anchors = item.querySelectorAll('a[href]');
      expect(anchors).toHaveLength(1);
      expect(item.textContent).toContain(statement);
      expect(anchors[0]!.textContent).not.toContain(statement);
    }
  });

  it('omits every candidate it may not link, leaving no placeholder, partial sentence or disabled link (8.4)', async () => {
    const page = await renderLocality('fixture-centre');
    const markup = page.innerHTML;
    for (const statement of OMITTED_STATEMENTS) expect(markup, statement).not.toContain(statement);
    for (const slug of ['fixture-west', 'fixture-draft', 'fixture-south', ALIAS]) {
      expect(markup, slug).not.toContain(`href="/areas/${slug}"`);
    }
    expect(markup).not.toMatch(/aria-disabled|\sdisabled[\s=>]/);
    // Every item in the group is a whole link with its statement; nothing else.
    for (const item of Array.from(group(page, 'nearby')!.querySelectorAll('li'))) {
      expect(item.querySelector('a[href]')).not.toBeNull();
      expect(item.querySelector('p')?.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('carries at most six links in a group, however many qualify', async () => {
    expect(crowded.approvedNearbyRelationships.length).toBeGreaterThan(MAX_LINKS_PER_GROUP);
    const links = groupLinks(await renderLocality('fixture-crowded'), 'nearby');
    expect(links).toHaveLength(MAX_LINKS_PER_GROUP);
    expect(links.map((link) => link.text)).toEqual(
      EIGHT_NEIGHBOURS.slice(0, MAX_LINKS_PER_GROUP).map((neighbour) => neighbour.canonicalName)
    );
  });

  it('omits the heading and container of a group with nothing to link, and renders the rest unchanged (8.9)', async () => {
    const page = await renderLocality('fixture-lonely');
    const markup = page.innerHTML;
    expect(markup).not.toContain('id="locality-guides-heading"');
    expect(markup).not.toContain('id="locality-nearby-heading"');
    expect(group(page, 'guides')).toBeNull();
    expect(group(page, 'nearby')).toBeNull();
    expect(markup).not.toContain('Guides that may help');
    expect(markup).not.toContain('Areas next to this one');
    // The services group is still there, exactly as on a page with all three.
    expect(groupLinks(page, 'services')).toEqual(groupLinks(await renderLocality('fixture-centre'), 'services'));
    // No list anywhere is left empty.
    for (const list of Array.from(page.querySelectorAll('ul'))) {
      expect(list.querySelectorAll('li').length).toBeGreaterThan(0);
    }
  });
});

describe('the plate, its decision and its register entry draw on the neighbours the page links', () => {
  beforeEach(() => {
    injected.registry = fixtureRegistry();
  });

  it('draws the plate from exactly the linked neighbours, and the register names that plate', async () => {
    const page = await renderLocality('fixture-centre');
    const plateId = areaOrientationAssetId('fixture-centre');

    expect(renderableNearbyRelationships(centre, NOW).map((relationship) => relationship.name)).toEqual([
      'Fixture East',
      'Fixture Indiranagar',
    ]);
    expect(canRenderAreaOrientationPlate(centre, NOW)).toBe(true);
    expect(localityVisualAssetIds(centre, NOW)).toEqual([plateId]);
    expect(
      Array.from(page.querySelectorAll('[data-asset-id]')).map((element) => element.getAttribute('data-asset-id'))
    ).toEqual([plateId]);

    const plate = page.querySelector(`svg[data-asset-id="${plateId}"]`)!;
    // A long name wraps onto two tspans; a label is its lines read in order.
    const labels = Array.from(plate.querySelectorAll('text')).map((text) =>
      Array.from(text.querySelectorAll('tspan'))
        .map((line) => line.textContent)
        .join(' ')
    );
    expect(labels).toEqual(['Fixture Centre', 'Fixture East', 'Fixture Indiranagar']);
    for (const name of ['Fixture West', 'Fixture Draft', 'Fixture South']) {
      expect(plate.textContent, name).not.toContain(name);
    }
  });

  it('falls back when the recorded neighbours are enough to draw but none may be linked', async () => {
    // Counted raw, this record has enough neighbours for a plate. That count is what
    // `localityVisualAssetIds` and `canRenderAreaOrientationPlate` used to read.
    expect(lonely.approvedNearbyRelationships.length).toBeGreaterThanOrEqual(MIN_NEIGHBOUR_PLATES);
    expect(renderableNearbyRelationships(lonely, NOW)).toEqual([]);
    expect(canRenderAreaOrientationPlate(lonely, NOW)).toBe(false);
    expect(localityVisualAssetIds(lonely, NOW)).toEqual([LAYOUT_GRID_ASSET_ID]);

    const page = await renderLocality('fixture-lonely');
    expect(
      Array.from(page.querySelectorAll('[data-asset-id]')).map((element) => element.getAttribute('data-asset-id'))
    ).toEqual([LAYOUT_GRID_ASSET_ID]);
  });
});

// ---------------------------------------------------------------------------
// Every public route
// ---------------------------------------------------------------------------

describe('every public route is mapped to its page', () => {
  it('has a page component for every static public route', () => {
    expect(Object.keys(STATIC_ROUTE_PAGES).sort()).toEqual(STATIC_PUBLIC_ROUTES.map((route) => route.path).sort());
  });
});

interface LinkFinding {
  readonly route: string;
  readonly href: string;
  readonly text: string;
  readonly problem: string;
}

/**
 * Every way a route's links break Requirement 8.2: text that fails the rule, and a
 * locality or guide link whose text does not name the destination it opens.
 */
async function linkFindings(route: string): Promise<LinkFinding[]> {
  injected.pathname = route;
  const shell = renderShell();
  const markup = [await renderRouteContent(route), shell.header, shell.drawer, shell.footer, shell.actionBar].join(
    '\n'
  );
  const findings: LinkFinding[] = [];

  for (const { href, text } of renderedLinks(markup)) {
    for (const failure of validateLinkText(text)) findings.push({ route, href, text, problem: failure });

    const area = href.match(/^\/areas\/([^/?#]+)$/);
    if (area) {
      const destination = getPublishedAreaRecordBySlug(area[1]!, NOW);
      if (!destination) findings.push({ route, href, text, problem: 'links an area page that is not published' });
      else if (!text.toLowerCase().includes(destination.canonicalName.toLowerCase())) {
        findings.push({ route, href, text, problem: `does not name ${destination.canonicalName}` });
      }
    }

    const guide = href.match(/^\/guides\/([^/?#]+)$/);
    if (guide) {
      const destination = getPublishedGuideBySlug(guide[1]!, NOW);
      if (!destination) findings.push({ route, href, text, problem: 'links a guide that is not published' });
      else if (![destination.title, destination.question].some((name) => text.includes(name))) {
        findings.push({ route, href, text, problem: `does not name "${destination.title}"` });
      }
    }
  }
  return findings;
}

async function callActionCount(route: string): Promise<number> {
  return countCallActions(renderedLinks(await renderRouteContent(route)).map((link) => link.href));
}

describe.each([
  { world: 'the live registries', registry: (): LocalityRecord[] | null => null },
  { world: 'the fixture localities published', registry: (): LocalityRecord[] | null => fixtureRegistry() },
])('every public route, with $world', ({ registry }) => {
  beforeEach(() => {
    injected.registry = registry();
  });

  it('covers the static routes, the published guides and every published area', () => {
    const paths = getPublicRoutes(NOW).map((route) => route.path);
    for (const route of STATIC_PUBLIC_ROUTES) expect(paths).toContain(route.path);
    expect(paths.filter((path) => path.startsWith('/guides/')).length).toBeGreaterThan(0);
    if (injected.registry) expect(paths).toContain('/areas/fixture-centre');
  });

  it('renders no link whose text is generic, a bare URL, outside 2 to 80 characters, or not the destination’s name (8.2)', async () => {
    const findings: LinkFinding[] = [];
    let routesScanned = 0;
    for (const { path } of getPublicRoutes(NOW)) {
      findings.push(...(await linkFindings(path)));
      routesScanned += 1;
    }
    expect(routesScanned).toBeGreaterThan(STATIC_PUBLIC_ROUTES.length);
    expect(findings).toEqual([]);
  });

  it('places 1 to 3 call actions in each page’s own content, with the form off and on (8.7)', async () => {
    const outOfRange: { route: string; intake: string; count: number }[] = [];
    for (const intake of ['off', 'on'] as const) {
      if (intake === 'on') process.env.INSTLE_ENQUIRY_INTAKE_ENABLED = 'true';
      else delete process.env.INSTLE_ENQUIRY_INTAKE_ENABLED;
      for (const { path } of getPublicRoutes(NOW)) {
        const count = await callActionCount(path);
        if (count < MIN_CALL_ACTIONS_PER_PAGE || count > MAX_CALL_ACTIONS_PER_PAGE) {
          outOfRange.push({ route: path, intake, count });
        }
      }
    }
    expect(outOfRange).toEqual([]);
  });
});

describe('call actions on the homepage (Requirement 8.7)', () => {
  it('carries three: the hero call button, and the closing band’s call button and contact link', async () => {
    const hrefs = renderedLinks(await renderRouteContent('/'))
      .map((link) => link.href)
      .filter(isCallActionHref);
    expect(hrefs).toEqual([PRIMARY_PHONE_TEL, PRIMARY_PHONE_TEL, '/contact']);
  });
});

// ---------------------------------------------------------------------------
// The footer
// ---------------------------------------------------------------------------

describe('the footer (Requirement 8.6)', () => {
  it('carries at most 12 links, drawn from the header sections plus the phone', () => {
    const links = renderedLinks(renderToStaticMarkup(<Footer />));
    const audit = auditFooterLinks(links.map((link) => link.href));
    expect(audit.failures).toEqual([]);
    expect(audit.count).toBeLessThanOrEqual(MAX_FOOTER_LINKS);
    expect(links.filter((link) => link.href === PRIMARY_PHONE_TEL)).toHaveLength(1);
    // Still the canonical brand, as text rather than a second link home.
    expect(renderToStaticMarkup(<Footer />)).toContain('INSTLE REAL ESTATE');
  });

  it('carries no individual locality or guide link at any registry size', () => {
    const empty = renderToStaticMarkup(<Footer />);
    injected.registry = fixtureRegistry();
    const populated = renderToStaticMarkup(<Footer />);
    expect(populated).toBe(empty);
    for (const { href } of renderedLinks(populated)) {
      expect(href, href).not.toMatch(/^\/(areas|guides)\/[^/?#]+/);
    }
    // And it cannot grow with the registries: it reads neither of them.
    const footerSource = readFileSync(join(ROOT, 'src', 'components', 'Footer', 'Footer.tsx'), 'utf8');
    expect(footerSource).not.toMatch(/@\/config\/(localities|locality-sections|guides)|@\/lib\/public-routes/);
  });
});

// ---------------------------------------------------------------------------
// Every record's name can stand as link text
// ---------------------------------------------------------------------------

describe('every record can be linked by its own name (Requirement 8.2)', () => {
  it('holds for every locality and guide in the registries, published or not', () => {
    const failures = [
      ...LOCALITY_REGISTRY.map((record) => ({ name: record.canonicalName, failures: validateLinkText(record.canonicalName) })),
      ...GUIDE_REGISTRY.map((record) => ({ name: record.title, failures: validateLinkText(record.title) })),
    ].filter((entry) => entry.failures.length > 0);
    expect(failures).toEqual([]);
  });
});
