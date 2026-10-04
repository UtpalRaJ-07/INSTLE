/**
 * @vitest-environment jsdom
 */

/**
 * The area hub, rendered to the HTML the server sends. Requirements 1.6, 2.1–2.6.
 *
 * `renderToStaticMarkup` produces the first server response and runs no effect
 * and no client script, so whatever these tests find in the markup is exactly
 * what a crawler that executes no JavaScript receives. jsdom is used only to
 * parse that markup for structural queries.
 *
 * Two halves:
 *   - the live page against the live registry, where nothing passes the gate, so
 *     the empty state is what actually ships;
 *   - the presentational `AreaHub` driven with synthetic records at scale, because
 *     no real record passes the gate and none may be made to for a test.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AreasPage, { metadata } from '@/app/areas/page';
import {
  AREA_PUBLICATION_CONDITIONS,
  AreaHub,
  BROWSING_AID_NOTE,
} from '@/components/AreaHub/AreaHub';
import { LOCALITY_REGISTRY, getPublishedLocalities, type LocalityRecord } from '@/config/localities';
import { MAX_VISIBLE_LINKS_PER_GROUP, groupPublishedLocalities } from '@/lib/locality-grouping';
import { buildSiteGraph, serialiseJsonLd } from '@/lib/structured-data';

const ROOT = process.cwd();

function parse(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

function areaLinks(root: ParentNode): HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="/areas/"]'));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word, case-sensitive: "East" must not match "Eastern" or "east". */
function containsLabel(haystack: string, label: string): boolean {
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(label)}($|[^\\p{L}\\p{N}])`, 'u').test(haystack);
}

const REGISTRY_GROUP_LABELS = [...new Set(LOCALITY_REGISTRY.map((record) => record.marketingGroup))];

// ---------------------------------------------------------------------------
// (a) The live page. Zero records pass the gate, so this is what ships today.
// ---------------------------------------------------------------------------

describe('the area hub today (Requirement 2.1)', () => {
  const published = getPublishedLocalities(new Date());
  // Throws instead of returning if the page called notFound() or failed to render,
  // so a successful render here is the HTTP 200 case.
  const markup = renderToStaticMarkup(<AreasPage />);
  const page = parse(markup);
  const text = page.textContent ?? '';

  it('is rendering the empty state because nothing passes the gate', () => {
    expect(published).toHaveLength(0);
    expect(groupPublishedLocalities(published)).toEqual([]);
  });

  it('renders at HTTP 200 with one h1 and zero area links', () => {
    expect(markup.length).toBeGreaterThan(0);
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(areaLinks(page)).toEqual([]);
    expect(page.querySelector('details')).toBeNull();
  });

  it('says that no area guide is published yet', () => {
    expect(text).toContain('No area guide is published yet');
  });

  it('names each of the four publication conditions', () => {
    expect(AREA_PUBLICATION_CONDITIONS).toHaveLength(4);
    for (const condition of AREA_PUBLICATION_CONDITIONS) {
      expect(text, condition).toContain(condition);
    }
    expect(text).toMatch(/at least two independent sources[^.]*every claim/i);
    expect(text).toMatch(/named reviewer[^.]*recheck date that has not yet passed/i);
    expect(text).toMatch(/confirmed operational coverage/i);
    expect(text).toMatch(/named person at INSTLE REAL ESTATE who is accountable/);
  });

  it('renders no name, summary, heading or slug of a gate-failing record (Requirement 2.5)', () => {
    for (const record of LOCALITY_REGISTRY) {
      expect(markup, record.slug).not.toContain(`/areas/${record.slug}`);
      expect(text, record.canonicalName).not.toContain(record.canonicalName);
      if (record.summary.trim().length > 0) {
        expect(text, record.slug).not.toContain(record.summary);
      }
      for (const section of record.sections) {
        expect(text, record.slug).not.toContain(section.heading);
      }
    }
    // With no group rendered there is no browsing note to accompany one.
    expect(text).not.toContain(BROWSING_AID_NOTE);
  });

  it('keeps every marketingGroup out of the metadata and structured data (Requirement 1.6)', () => {
    const serialisedMetadata = JSON.stringify(metadata);
    const serialisedGraph = serialiseJsonLd(buildSiteGraph());
    expect(markup).not.toContain('application/ld+json');
    for (const label of REGISTRY_GROUP_LABELS) {
      expect(containsLabel(serialisedMetadata, label), label).toBe(false);
      expect(containsLabel(serialisedGraph, label), label).toBe(false);
      expect(containsLabel(text, label), label).toBe(false);
    }
  });

  it('reads visibility only from the gate, called with the render date (Requirement 1.3)', () => {
    const source = readFileSync(join(ROOT, 'src', 'app', 'areas', 'page.tsx'), 'utf8');
    expect(source).toContain('groupPublishedLocalities(getPublishedLocalities(new Date()))');
    expect(source).not.toContain('LOCALITY_REGISTRY');
    expect(source).not.toContain("'use client'");
    const component = readFileSync(join(ROOT, 'src', 'components', 'AreaHub', 'AreaHub.tsx'), 'utf8');
    expect(component).not.toContain("'use client'");
    // The component takes groups as props and cannot reach the registry or the gate.
    expect(component).not.toMatch(/from '@\/config\/localities'/);
  });
});

// ---------------------------------------------------------------------------
// (b) The same component at scale, with synthetic published records.
// ---------------------------------------------------------------------------

/**
 * Copies a real record and replaces only what the hub reads. The names and group
 * labels are synthetic so no assertion here says anything about a real place.
 */
function fixture(slug: string, canonicalName: string, marketingGroup: string): LocalityRecord {
  return { ...LOCALITY_REGISTRY[0]!, entityId: `LOC-FIXTURE-${slug}`, slug, canonicalName, marketingGroup };
}

function fixturesInGroup(prefix: string, label: string, count: number): LocalityRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(2, '0');
    return fixture(`${prefix}-${n}`, `${label} Place ${n}`, label);
  });
}

const GROUP_SIZES: Readonly<Record<string, number>> = {
  'Fixture Lakeside': 32, // above 25, and above 30
  'Fixture Ridge': 25, // exactly at the cap: no disclosure
  'Fixture Market': 3,
  'Fixture Orchard': 1,
};

// Handed in reverse so input order is not output order.
const FIXTURES: readonly LocalityRecord[] = Object.entries(GROUP_SIZES)
  .flatMap(([label, count], index) => fixturesInGroup(`fx${index}`, label, count))
  .reverse();

describe('the area hub at scale (Requirements 2.2, 2.3, 2.4, 2.6)', () => {
  const groups = groupPublishedLocalities(FIXTURES);
  const markup = renderToStaticMarkup(<AreaHub groups={groups} />);
  const hub = parse(markup);
  const headings = Array.from(hub.querySelectorAll('h3'));

  it('renders one heading per non-empty group, in the grouping order', () => {
    expect(headings.map((heading) => heading.textContent)).toEqual(
      groups.map((group) => group.marketingGroup)
    );
    expect(new Set(headings.map((heading) => heading.textContent))).toEqual(
      new Set(Object.keys(GROUP_SIZES))
    );
    // No h1 in the component, and the group headings sit under one h2.
    expect(hub.querySelectorAll('h1')).toHaveLength(0);
    expect(hub.querySelectorAll('h2')).toHaveLength(1);
    expect(hub.textContent).not.toContain('No area guide is published yet');
  });

  it('renders the browsing-aid note directly beside every heading (Requirement 2.4)', () => {
    expect(BROWSING_AID_NOTE).toBe(
      'This grouping is how INSTLE REAL ESTATE organises areas for browsing. It is not a municipal, ward, zone or postal boundary.'
    );
    for (const heading of headings) {
      const note = heading.nextElementSibling;
      expect(note?.tagName, heading.textContent ?? '').toBe('P');
      expect(note?.textContent, heading.textContent ?? '').toBe(BROWSING_AID_NOTE);
    }
  });

  it('renders exactly one text link per published slug, with the name as the link text', () => {
    const links = areaLinks(hub);
    expect(links).toHaveLength(FIXTURES.length);
    const bySlug = new Map(FIXTURES.map((record) => [record.slug, record]));
    const seen = new Set<string>();
    for (const link of links) {
      const slug = link.getAttribute('href')!.slice('/areas/'.length);
      expect(seen.has(slug), slug).toBe(false);
      seen.add(slug);
      expect(link.textContent, slug).toBe(bySlug.get(slug)?.canonicalName);
    }
    expect(seen).toEqual(new Set(bySlug.keys()));
  });

  it('shows at most 25 links per group and puts the rest in a closed <details> (Requirement 2.3)', () => {
    for (const heading of headings) {
      const label = heading.textContent!;
      const size = GROUP_SIZES[label]!;
      const container = heading.parentElement!;
      const group = groups.find((entry) => entry.marketingGroup === label)!;

      const visibleList = container.querySelector(':scope > ul')!;
      const visible = areaLinks(visibleList);
      expect(visible.length, label).toBe(Math.min(size, MAX_VISIBLE_LINKS_PER_GROUP));
      expect(visible.map((link) => link.textContent), label).toEqual(
        group.visibleLinks.map((link) => link.name)
      );

      const disclosures = container.querySelectorAll(':scope > details');
      if (size > MAX_VISIBLE_LINKS_PER_GROUP) {
        expect(disclosures, label).toHaveLength(1);
        const details = disclosures[0]!;
        expect(details.hasAttribute('open'), label).toBe(false);
        const overflowCount = size - MAX_VISIBLE_LINKS_PER_GROUP;
        expect(details.querySelector('summary')?.textContent, label).toBe(
          `${overflowCount} more in ${label}`
        );
        expect(areaLinks(details).map((link) => link.textContent), label).toEqual(
          group.overflowLinks.map((link) => link.name)
        );
      } else {
        expect(disclosures, label).toHaveLength(0);
      }
    }
    // The 32-record group is the one that overflows: 25 visible, 7 disclosed.
    expect(hub.querySelectorAll('details')).toHaveLength(1);
    expect(areaLinks(hub.querySelector('details')!)).toHaveLength(7);
  });

  it('needs no JavaScript to reach any link (Requirement 2.6)', () => {
    expect(markup).not.toContain('<script');
    expect(markup).not.toMatch(/\son[a-z]+=/i);
    for (const link of areaLinks(hub)) {
      expect(link.getAttribute('href')).toMatch(/^\/areas\/[a-z0-9-]+$/);
    }
  });

  it('keeps marketingGroup out of structured data and of the page metadata (Requirement 1.6)', () => {
    expect(markup).not.toContain('application/ld+json');
    const serialisedMetadata = JSON.stringify(metadata);
    const serialisedGraph = serialiseJsonLd(buildSiteGraph());
    for (const label of Object.keys(GROUP_SIZES)) {
      expect(serialisedMetadata, label).not.toContain(label);
      expect(serialisedGraph, label).not.toContain(label);
    }
  });

  it('renders the same markup for the same record set in any order (Requirement 2.2)', () => {
    const shuffled = [...FIXTURES].sort((a, b) => (a.slug < b.slug ? 1 : -1));
    expect(renderToStaticMarkup(<AreaHub groups={groupPublishedLocalities(shuffled)} />)).toBe(markup);
  });

  it('renders the empty state for no groups', () => {
    const empty = parse(renderToStaticMarkup(<AreaHub groups={[]} />));
    expect(empty.textContent).toContain('No area guide is published yet');
    expect(areaLinks(empty)).toEqual([]);
    expect(empty.querySelectorAll('h3')).toHaveLength(0);
  });
});
