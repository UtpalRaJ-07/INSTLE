/**
 * @vitest-environment jsdom
 */

import fc from 'fast-check';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AreaHub, BROWSING_AID_NOTE } from '@/components/AreaHub/AreaHub';
import { evaluateGuide, type GuideRecord } from '@/config/guides';
import {
  evaluateLocality,
  getPublishedLocalities,
  type LocalityRecord,
} from '@/config/localities';
import {
  MAX_VISIBLE_LINKS_PER_GROUP,
  compareByName,
  compareGuideRecords,
  compareLocalityRecords,
  groupPublishedGuides,
  groupPublishedLocalities,
  type GuideGroup,
  type LocalityGroup,
} from '@/lib/locality-grouping';

import {
  PROPERTY_NOW,
  PROPERTY_RUN_CONFIG,
  arbPublishedGuideSet,
  arbPublishedLocalitySet,
  arbWithPermutation,
} from './arbitraries';

/**
 * **Property 7: Hub grouping partitions the published set deterministically and
 * caps every visible group at 25.**
 *
 * *For any* set of published locality records, the groups produced by
 * `groupPublishedLocalities` contain each record exactly once across all groups,
 * contain no empty group, are ordered by the total order `compareByName` produces
 * identical output for any permutation of the input, and for every group the
 * visible link count is the minimum of the group size and 25 while the visible and
 * overflow links together reproduce the group's records with no loss and no
 * duplication — at every group size, including sizes above 40.
 *
 * **Validates: Requirements 2.2, 2.3, 2.4, 2.6**
 *
 * `tests/locality-grouping.test.ts` and `tests/areas-hub.test.tsx` pin chosen
 * examples — sizes 24, 25, 26, 50, 51 and one four-group fixture. This file states
 * the same rules for every generated set: up to six groups at once, sizes weighted
 * at the cap boundary and above 50, names that collide on their ordering key, and
 * inputs in any order. The guide hub shares the implementation, so the same
 * partition, cap, order and permutation rules are asserted for
 * `groupPublishedGuides` too.
 *
 * The rendered half runs the real `AreaHub` through `renderToStaticMarkup` — the
 * first server response, with no effect and no client script — and parses it with
 * jsdom only to query the structure. Written as `.ts` with `createElement` rather
 * than `.tsx`, so the suite's iteration-floor guard, which walks `*.test.ts`, covers
 * this file.
 */

/**
 * A hundred runs, each drawing up to six groups of up to sixty gate-ready records and
 * — for three of these tests — rendering the whole hub to static markup twice, is
 * work that does not fit vitest's five-second default once the rest of the suite is
 * competing for the same cores. The file passes on its own in about twelve seconds
 * and timed out at three tests when run with everything else, which is a scheduling
 * fact and not a failing property.
 *
 * So the budget is stated per test, the way
 * `gate-failing-leaks-nothing.property.test.tsx` states it. The alternative — fewer
 * iterations or smaller sets — would buy speed by sampling less of the space the
 * property is about, and the cap this property turns on only appears at group sizes
 * of 24 and above.
 */
const PROPERTY_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// One shape for both hubs, so the partition rules are written once.
// ---------------------------------------------------------------------------

interface HubLink {
  readonly slug: string;
  /** The link text: a locality name, or a guide question. */
  readonly text: string;
}

interface HubGroup {
  readonly key: string;
  readonly visible: readonly HubLink[];
  readonly overflow: readonly HubLink[];
}

interface HubRules<R> {
  /** The grouping key the record should land under. */
  readonly keyOf: (record: R) => string;
  readonly slugOf: (record: R) => string;
  /** The record's own text, which the link must carry verbatim. */
  readonly textOf: (record: R) => string;
  /** The record comparator the hub orders a group by. */
  readonly compare: (a: R, b: R) => number;
}

function fromLocalityGroups(groups: readonly LocalityGroup[]): HubGroup[] {
  return groups.map((group) => ({
    key: group.marketingGroup,
    visible: group.visibleLinks.map((link) => ({ slug: link.slug, text: link.name })),
    overflow: group.overflowLinks.map((link) => ({ slug: link.slug, text: link.name })),
  }));
}

function fromGuideGroups(groups: readonly GuideGroup[]): HubGroup[] {
  return groups.map((group) => ({
    key: group.intent,
    visible: group.visibleLinks.map((link) => ({ slug: link.slug, text: link.question })),
    overflow: group.overflowLinks.map((link) => ({ slug: link.slug, text: link.question })),
  }));
}

const LOCALITY_RULES: HubRules<LocalityRecord> = {
  keyOf: (record) => record.marketingGroup,
  slugOf: (record) => record.slug,
  textOf: (record) => record.canonicalName,
  compare: compareLocalityRecords,
};

const GUIDE_RULES: HubRules<GuideRecord> = {
  keyOf: (record) => record.intent,
  slugOf: (record) => record.slug,
  textOf: (record) => record.question,
  compare: compareGuideRecords,
};

/** Sorted by UTF-16 code unit: only ever used to compare two collections as sets. */
function sortedForComparison(values: readonly string[]): string[] {
  return [...values].sort();
}

/**
 * Partition, no empty group, the cap, and the order — for one hub's output against
 * the records it was given.
 */
function expectPartitionCapAndOrder<R>(
  records: readonly R[],
  groups: readonly HubGroup[],
  rules: HubRules<R>
): void {
  const bySlug = new Map(records.map((record) => [rules.slugOf(record), record]));
  // Generator contract: a published set has one record per canonical slug.
  expect(bySlug.size).toBe(records.length);

  // Partition: every input slug appears exactly once across every group's visible
  // and overflow links, and no slug appears that was not in the input.
  const linkedSlugs = groups.flatMap((group) =>
    [...group.visible, ...group.overflow].map((link) => link.slug)
  );
  expect(linkedSlugs).toHaveLength(records.length);
  expect(sortedForComparison(linkedSlugs)).toEqual(
    sortedForComparison(records.map(rules.slugOf))
  );

  // One group per key that holds a record, and no other.
  expect(sortedForComparison(groups.map((group) => group.key))).toEqual(
    sortedForComparison([...new Set(records.map(rules.keyOf))])
  );

  // Groups in strictly increasing compareByName order: sorted, and no key twice.
  for (let index = 1; index < groups.length; index += 1) {
    const previous = groups[index - 1].key;
    const next = groups[index].key;
    expect(compareByName(previous, next), `${previous} / ${next}`).toBe(-1);
  }

  for (const group of groups) {
    const size = group.visible.length + group.overflow.length;

    // No empty group, and the split at 25: visible is min(size, 25), and the
    // overflow is non-empty only when the visible list is full.
    expect(group.visible.length, group.key).toBeGreaterThan(0);
    expect(group.visible.length, group.key).toBeLessThanOrEqual(MAX_VISIBLE_LINKS_PER_GROUP);
    expect(group.visible.length, group.key).toBe(Math.min(size, MAX_VISIBLE_LINKS_PER_GROUP));
    expect(group.overflow.length, group.key).toBe(Math.max(size - MAX_VISIBLE_LINKS_PER_GROUP, 0));
    if (group.overflow.length > 0) {
      expect(group.visible.length, group.key).toBe(MAX_VISIBLE_LINKS_PER_GROUP);
    }

    // Every link sits under its own record's key and carries its text verbatim.
    const members = [...group.visible, ...group.overflow].map((link) => {
      const record = bySlug.get(link.slug) as R;
      expect(rules.keyOf(record), link.slug).toBe(group.key);
      expect(link.text, link.slug).toBe(rules.textOf(record));
      return record;
    });

    // Visible then overflow is one list in strictly increasing record order, so the
    // split happens after sorting and the text a reader scans is alphabetical.
    for (let index = 1; index < members.length; index += 1) {
      const previous = members[index - 1];
      const next = members[index];
      const context = `${group.key}: ${rules.slugOf(previous)} / ${rules.slugOf(next)}`;
      expect(rules.compare(previous, next), context).toBe(-1);
      expect(compareByName(rules.textOf(previous), rules.textOf(next)), context).toBeLessThanOrEqual(0);
    }
  }
}

// ---------------------------------------------------------------------------
// The rendered area hub.
// ---------------------------------------------------------------------------

function renderHub(groups: readonly LocalityGroup[]): string {
  return renderToStaticMarkup(createElement(AreaHub, { groups }));
}

function parse(markup: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = markup;
  return container;
}

function areaLinks(root: ParentNode): HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="/areas/"]'));
}

function hrefSlug(link: HTMLAnchorElement): string {
  return (link.getAttribute('href') ?? '').slice('/areas/'.length);
}

// ---------------------------------------------------------------------------
// The generators span the space the property is about.
// ---------------------------------------------------------------------------

describe('hub grouping generators', () => {
  it('draw sets whose groups sit below, at and above the cap, and above 50', () => {
    const sizes = fc
      .sample(arbPublishedLocalitySet, { ...PROPERTY_RUN_CONFIG, seed: 7 })
      .flatMap((records) => {
        const counts = new Map<string, number>();
        for (const record of records) {
          counts.set(record.marketingGroup, (counts.get(record.marketingGroup) ?? 0) + 1);
        }
        return [...counts.values()];
      });

    expect(sizes.some((size) => size < MAX_VISIBLE_LINKS_PER_GROUP)).toBe(true);
    expect(sizes).toContain(MAX_VISIBLE_LINKS_PER_GROUP);
    expect(sizes).toContain(MAX_VISIBLE_LINKS_PER_GROUP + 1);
    expect(sizes.some((size) => size > 40)).toBe(true);
    expect(sizes.some((size) => size > 50)).toBe(true);
  }, PROPERTY_TIMEOUT_MS);

  it('draw records that actually pass their gates, so the sets are published sets', () => {
    for (const records of fc.sample(arbPublishedLocalitySet, { ...PROPERTY_RUN_CONFIG, seed: 11 })) {
      for (const record of records) {
        expect(evaluateLocality(record, PROPERTY_NOW).failures, record.slug).toEqual([]);
      }
      expect(getPublishedLocalities(PROPERTY_NOW, records)).toHaveLength(records.length);
    }
    for (const records of fc.sample(arbPublishedGuideSet, { ...PROPERTY_RUN_CONFIG, seed: 13 })) {
      for (const record of records) {
        expect(evaluateGuide(record, PROPERTY_NOW).failures, record.slug).toEqual([]);
      }
    }
  }, PROPERTY_TIMEOUT_MS);
});

// ---------------------------------------------------------------------------
// Property 7 — the area hub.
// ---------------------------------------------------------------------------

describe('Property 7: groupPublishedLocalities', () => {
  it('partitions the published set into non-empty, ordered groups capped at 25 visible links', () => {
    fc.assert(
      fc.property(arbPublishedLocalitySet, (records) => {
        expectPartitionCapAndOrder(
          records,
          fromLocalityGroups(groupPublishedLocalities(records)),
          LOCALITY_RULES
        );
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('produces identical groups and identical markup for any permutation of the input', () => {
    fc.assert(
      fc.property(arbWithPermutation(arbPublishedLocalitySet), ([records, permuted]) => {
        const groups = groupPublishedLocalities(records);
        const fromPermuted = groupPublishedLocalities(permuted);
        expect(fromPermuted).toEqual(groups);
        expect(renderHub(fromPermuted)).toBe(renderHub(groups));
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('renders one heading, one note and one link per slug, overflow in <details>, no script', () => {
    fc.assert(
      fc.property(arbPublishedLocalitySet, (records) => {
        const groups = groupPublishedLocalities(records);
        const markup = renderHub(groups);

        // Requirement 2.6: nothing on the hub needs a script to reach.
        expect(markup).not.toContain('<script');
        expect(markup).not.toMatch(/\son[a-z]+=/i);

        const hub = parse(markup);
        const headings = Array.from(hub.querySelectorAll('h3'));
        expect(headings.map((heading) => heading.textContent)).toEqual(
          groups.map((group) => group.marketingGroup)
        );

        // Requirement 2.2: exactly one crawlable text link per published slug, with
        // the locality name verbatim as its text.
        const bySlug = new Map(records.map((record) => [record.slug, record]));
        const links = areaLinks(hub);
        expect(sortedForComparison(links.map(hrefSlug))).toEqual(
          sortedForComparison(records.map((record) => record.slug))
        );
        for (const link of links) {
          const slug = hrefSlug(link);
          expect(link.getAttribute('href'), slug).toBe(`/areas/${slug}`);
          expect(link.textContent, slug).toBe(bySlug.get(slug)?.canonicalName);
        }

        headings.forEach((heading, index) => {
          const group = groups[index];
          const label = group.marketingGroup;

          // Requirement 2.4: the browsing-aid note directly beside every heading.
          const note = heading.nextElementSibling;
          expect(note?.tagName, label).toBe('P');
          expect(note?.textContent, label).toBe(BROWSING_AID_NOTE);

          // Requirement 2.3: at most 25 in the visible list, in the grouping's order;
          // the rest inside one closed native <details> in the same response.
          const container = heading.parentElement as HTMLElement;
          const visibleList = container.querySelector(':scope > ul') as HTMLElement;
          const visible = areaLinks(visibleList).map(hrefSlug);
          expect(visible.length, label).toBeLessThanOrEqual(MAX_VISIBLE_LINKS_PER_GROUP);
          expect(visible, label).toEqual(group.visibleLinks.map((link) => link.slug));

          const disclosures = container.querySelectorAll(':scope > details');
          if (group.overflowLinks.length > 0) {
            expect(disclosures, label).toHaveLength(1);
            expect(disclosures[0].hasAttribute('open'), label).toBe(false);
            expect(areaLinks(disclosures[0]).map(hrefSlug), label).toEqual(
              group.overflowLinks.map((link) => link.slug)
            );
          } else {
            expect(disclosures, label).toHaveLength(0);
          }

          // The group's container holds its own links and no other group's.
          expect(areaLinks(container).map(hrefSlug), label).toEqual(
            [...group.visibleLinks, ...group.overflowLinks].map((link) => link.slug)
          );
        });

        expect(hub.querySelectorAll('details')).toHaveLength(
          groups.filter((group) => group.overflowLinks.length > 0).length
        );
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);
});

// ---------------------------------------------------------------------------
// Property 7 — the guide hub, which shares the implementation.
// ---------------------------------------------------------------------------

describe('Property 7: groupPublishedGuides', () => {
  it('partitions the published set into non-empty, ordered intent groups capped at 25', () => {
    fc.assert(
      fc.property(arbPublishedGuideSet, (records) => {
        expectPartitionCapAndOrder(
          records,
          fromGuideGroups(groupPublishedGuides(records)),
          GUIDE_RULES
        );
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);

  it('produces identical groups for any permutation of the input', () => {
    fc.assert(
      fc.property(arbWithPermutation(arbPublishedGuideSet), ([records, permuted]) => {
        expect(groupPublishedGuides(permuted)).toEqual(groupPublishedGuides(records));
      }),
      PROPERTY_RUN_CONFIG
    );
  }, PROPERTY_TIMEOUT_MS);
});
