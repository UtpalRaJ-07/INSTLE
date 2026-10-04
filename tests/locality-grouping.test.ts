import { describe, expect, it } from 'vitest';
import type { CustomerIntent } from '@/config/constants';
import { GUIDE_REGISTRY, getPublishedGuides, type GuideRecord } from '@/config/guides';
import {
  LOCALITY_REGISTRY,
  getPublishedLocalities,
  type LocalityRecord,
} from '@/config/localities';
import {
  MAX_VISIBLE_LINKS_PER_GROUP,
  compareByName,
  compareCodePoints,
  compareGuideRecords,
  compareLocalityRecords,
  groupPublishedGuides,
  groupPublishedLocalities,
  orderingKey,
  type GuideGroup,
  type LocalityGroup,
} from '@/lib/locality-grouping';

const NOW = new Date('2026-09-29T00:00:00.000Z');

/**
 * Fixtures copy a real registry record and replace only the fields grouping reads,
 * so every other field has a shape the type accepts. The names and groups are
 * synthetic on purpose: these tests are about ordering, not about any place.
 */
function locality(
  slug: string,
  canonicalName: string,
  marketingGroup: string,
  entityId = `LOC-${slug}`
): LocalityRecord {
  return { ...LOCALITY_REGISTRY[0], entityId, slug, canonicalName, marketingGroup };
}

function guide(
  slug: string,
  question: string,
  intent: CustomerIntent,
  guideId = `GD-${slug}`
): GuideRecord {
  return { ...GUIDE_REGISTRY[0], guideId, slug, question, intent };
}

/** `count` records in one group, handed in reverse so input order is not output order. */
function localitiesInOneGroup(count: number): LocalityRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(3, '0');
    return locality(`area-${n}`, `Area ${n}`, 'Only group');
  }).reverse();
}

function guidesInOneIntent(count: number): GuideRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const n = String(index + 1).padStart(3, '0');
    return guide(`guide-${n}`, `Question ${n}?`, 'buy');
  }).reverse();
}

function localityLinkSlugs(group: LocalityGroup): string[] {
  return [...group.visibleLinks, ...group.overflowLinks].map((link) => link.slug);
}

function guideLinkSlugs(group: GuideGroup): string[] {
  return [...group.visibleLinks, ...group.overflowLinks].map((link) => link.slug);
}

/** Every awkward case the comparator has to place: case, accents, punctuation, surrogates. */
const SAMPLE_STRINGS = [
  '',
  'a',
  'A',
  'é',
  'E',
  'HSR Layout',
  'hsr layout',
  'HSR-Layout',
  'Rent',
  'rent-out',
  'Zebra',
  'apple',
  'ａ',
  '𝐀',
  'ಬೆಂಗಳೂರು',
];

describe('orderingKey', () => {
  it('lowercases, strips diacritics and collapses non-alphanumerics to one space', () => {
    expect(orderingKey('Koramangala (5th Block)')).toBe('koramangala 5th block');
    expect(orderingKey('  HSR   Layout  ')).toBe('hsr layout');
    expect(orderingKey('Rajarajeshwari-Nagar')).toBe('rajarajeshwari nagar');
    expect(orderingKey('Électronic City')).toBe('electronic city');
  });

  it('keeps a non-Latin name and its vowel signs rather than collapsing it to nothing', () => {
    expect(orderingKey('ಬೆಂಗಳೂರು')).toBe('ಬೆಂಗಳೂರು');
  });
});

describe('compareByName', () => {
  it('orders by code point, not by UTF-16 code unit', () => {
    // U+FF41 FULLWIDTH SMALL A against U+1D400 MATHEMATICAL BOLD CAPITAL A. By code
    // point U+FF41 comes first; stored as UTF-16, U+1D400 begins with 0xD835, so
    // the default string order puts it first instead.
    expect('𝐀' < 'ａ').toBe(true);
    expect(['ａ', '𝐀'].sort()).toEqual(['𝐀', 'ａ']);
    expect(compareCodePoints('ａ', '𝐀')).toBe(-1);
    expect(['𝐀', 'ａ'].sort(compareByName)).toEqual(['ａ', '𝐀']);
  });

  it('breaks a folded tie by code point, where locale collation disagrees', () => {
    // Root collation orders lowercase before uppercase at tertiary strength. The
    // raw-string tie-break orders "A" (U+0041) before "a" (U+0061).
    expect(new Intl.Collator('en').compare('a', 'A')).toBeLessThan(0);
    expect(compareByName('A', 'a')).toBe(-1);
    expect(compareByName('HSR Layout', 'hsr layout')).toBe(-1);
  });

  it('is alphabetical for Latin names regardless of case', () => {
    expect(['Zebra', 'apple', 'Mango'].sort(compareByName)).toEqual(['apple', 'Mango', 'Zebra']);
    expect(['rent-out', 'rent', 'buy'].sort(compareByName)).toEqual(['buy', 'rent', 'rent-out']);
  });

  it('is antisymmetric and returns 0 only for identical strings', () => {
    for (const a of SAMPLE_STRINGS) {
      for (const b of SAMPLE_STRINGS) {
        const forward = compareByName(a, b);
        expect(Math.sign(forward) + Math.sign(compareByName(b, a)), `${a} / ${b}`).toBe(0);
        expect(forward === 0, `${a} / ${b}`).toBe(a === b);
      }
    }
  });

  it('is transitive', () => {
    for (const a of SAMPLE_STRINGS) {
      for (const b of SAMPLE_STRINGS) {
        for (const c of SAMPLE_STRINGS) {
          if (compareByName(a, b) <= 0 && compareByName(b, c) <= 0) {
            expect(compareByName(a, c), `${a} / ${b} / ${c}`).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('record comparators', () => {
  it('never lets two distinct locality records compare equal', () => {
    const sameName = locality('first', 'Same Name', 'G');
    const sameNameOtherSlug = locality('second', 'Same Name', 'G');
    const sameNameAndSlug = locality('first', 'Same Name', 'G', 'LOC-OTHER');

    expect(compareLocalityRecords(sameName, sameNameOtherSlug)).toBe(-1);
    expect(compareLocalityRecords(sameNameOtherSlug, sameName)).toBe(1);
    expect(compareLocalityRecords(sameName, sameNameAndSlug)).not.toBe(0);
    expect(compareLocalityRecords(sameName, sameName)).toBe(0);
  });

  it('never lets two distinct guide records compare equal', () => {
    const sameQuestion = guide('first', 'Same question?', 'buy');
    const sameQuestionOtherSlug = guide('second', 'Same question?', 'buy');
    const sameQuestionAndSlug = guide('first', 'Same question?', 'buy', 'GD-OTHER');

    expect(compareGuideRecords(sameQuestion, sameQuestionOtherSlug)).toBe(-1);
    expect(compareGuideRecords(sameQuestion, sameQuestionAndSlug)).not.toBe(0);
    expect(compareGuideRecords(sameQuestion, sameQuestion)).toBe(0);
  });
});

describe('groupPublishedLocalities', () => {
  const MIXED = [
    locality('zeta-park', 'Zeta Park', 'West side'),
    locality('alpha-layout', 'alpha Layout', 'West side'),
    locality('emile-nagar', 'Émile Nagar', 'West side'),
    locality('beta-road', 'Beta Road', 'East side'),
    locality('central-one', 'Central One', 'central'),
  ];

  it('renders nothing for an empty published set', () => {
    expect(groupPublishedLocalities([])).toEqual([]);
  });

  it('orders groups and links by compareByName and uses the name verbatim as link text', () => {
    expect(groupPublishedLocalities(MIXED)).toEqual([
      {
        marketingGroup: 'central',
        visibleLinks: [{ slug: 'central-one', name: 'Central One' }],
        overflowLinks: [],
      },
      {
        marketingGroup: 'East side',
        visibleLinks: [{ slug: 'beta-road', name: 'Beta Road' }],
        overflowLinks: [],
      },
      {
        marketingGroup: 'West side',
        visibleLinks: [
          { slug: 'alpha-layout', name: 'alpha Layout' },
          { slug: 'emile-nagar', name: 'Émile Nagar' },
          { slug: 'zeta-park', name: 'Zeta Park' },
        ],
        overflowLinks: [],
      },
    ]);
  });

  it('drops a group whose records are all unpublished', () => {
    const published = MIXED.filter((record) => record.marketingGroup !== 'East side');
    const groups = groupPublishedLocalities(published);

    expect(groups.map((group) => group.marketingGroup)).toEqual(['central', 'West side']);
    for (const group of groups) expect(group.visibleLinks.length).toBeGreaterThan(0);
  });

  it.each([24, 25, 26, 50, 51])(
    'splits a group of %i at 25 with no loss, duplication or reordering',
    (count) => {
      const [group] = groupPublishedLocalities(localitiesInOneGroup(count));
      const expectedSlugs = localitiesInOneGroup(count)
        .map((record) => record.slug)
        .sort(compareByName);

      expect(group.visibleLinks).toHaveLength(Math.min(count, MAX_VISIBLE_LINKS_PER_GROUP));
      expect(group.overflowLinks).toHaveLength(Math.max(count - MAX_VISIBLE_LINKS_PER_GROUP, 0));
      expect(localityLinkSlugs(group)).toEqual(expectedSlugs);
    }
  );

  it('splits each group independently', () => {
    const records = [
      ...localitiesInOneGroup(30),
      locality('small-1', 'Small One', 'Small group'),
      locality('small-2', 'Small Two', 'Small group'),
    ];
    const groups = groupPublishedLocalities(records);

    expect(groups.map((group) => [group.visibleLinks.length, group.overflowLinks.length])).toEqual([
      [25, 5],
      [2, 0],
    ]);
  });

  it('produces identical output for any order of the same set', () => {
    const records = [...MIXED, ...localitiesInOneGroup(27)];
    const expected = groupPublishedLocalities(records);

    expect(groupPublishedLocalities([...records].reverse())).toEqual(expected);
    expect(groupPublishedLocalities([...records.slice(7), ...records.slice(0, 7)])).toEqual(
      expected
    );
  });

  it('does not mutate its input', () => {
    const frozen = Object.freeze([...MIXED]);
    expect(() => groupPublishedLocalities(frozen)).not.toThrow();
    expect(frozen).toEqual(MIXED);
  });

  it('refuses two records with the same slug rather than silently keeping one', () => {
    const duplicate = locality('alpha-layout', 'Another Name', 'East side', 'LOC-DUP');
    expect(() => groupPublishedLocalities([...MIXED, duplicate])).toThrow(/alpha-layout/);
  });
});

describe('groupPublishedGuides', () => {
  const MIXED = [
    guide('sell-b', 'Why would I sell?', 'sell'),
    guide('rent-out-a', 'What does a landlord decide?', 'rent-out'),
    guide('rent-a', 'How does renting start?', 'rent'),
    guide('sell-a', 'can I sell quickly?', 'sell'),
    guide('buy-a', 'What should a buyer check?', 'buy'),
    guide('general-a', 'How do fees work?', 'general'),
    guide('commercial-a', 'How does leasing work?', 'commercial'),
  ];

  it('groups by intent, ordering intents and questions with compareByName', () => {
    const groups = groupPublishedGuides(MIXED);

    expect(groups.map((group) => group.intent)).toEqual([
      'buy',
      'commercial',
      'general',
      'rent',
      'rent-out',
      'sell',
    ]);
    expect(groups[5]).toEqual({
      intent: 'sell',
      visibleLinks: [
        { slug: 'sell-a', question: 'can I sell quickly?' },
        { slug: 'sell-b', question: 'Why would I sell?' },
      ],
      overflowLinks: [],
    });
  });

  it('drops an intent with no published guide', () => {
    const groups = groupPublishedGuides(MIXED.filter((record) => record.intent !== 'general'));
    expect(groups.map((group) => group.intent)).not.toContain('general');
    expect(groups).toHaveLength(5);
  });

  it.each([24, 25, 26, 50, 51])('splits an intent of %i guides at 25', (count) => {
    const [group] = groupPublishedGuides(guidesInOneIntent(count));

    expect(group.visibleLinks).toHaveLength(Math.min(count, MAX_VISIBLE_LINKS_PER_GROUP));
    expect(group.overflowLinks).toHaveLength(Math.max(count - MAX_VISIBLE_LINKS_PER_GROUP, 0));
    expect(guideLinkSlugs(group)).toEqual(
      guidesInOneIntent(count)
        .map((record) => record.slug)
        .sort(compareByName)
    );
  });

  it('produces identical output for any order of the same set', () => {
    expect(groupPublishedGuides([...MIXED].reverse())).toEqual(groupPublishedGuides(MIXED));
  });

  it('refuses two guides with the same slug', () => {
    expect(() => groupPublishedGuides([...MIXED, guide('buy-a', 'Other?', 'sell')])).toThrow(
      /buy-a/
    );
  });
});

describe('the live registries', () => {
  it('produce zero locality groups today, because zero localities pass the gate', () => {
    expect(groupPublishedLocalities(getPublishedLocalities(NOW))).toEqual([]);
  });

  it('keeps every group at 25 visible links or fewer even across all 132 records', () => {
    // A scale check on real names and real group labels, not a public surface:
    // nothing here renders, and the hub only ever receives the gate's output.
    const groups = groupPublishedLocalities(LOCALITY_REGISTRY);
    const slugs = groups.flatMap(localityLinkSlugs);

    expect(slugs).toHaveLength(LOCALITY_REGISTRY.length);
    expect(new Set(slugs).size).toBe(LOCALITY_REGISTRY.length);
    for (const group of groups) {
      expect(group.visibleLinks.length).toBeLessThanOrEqual(MAX_VISIBLE_LINKS_PER_GROUP);
    }
    const labels = groups.map((group) => group.marketingGroup);
    expect(labels).toEqual([...labels].sort(compareByName));
  });

  it('groups the three published guides by intent', () => {
    expect(getPublishedGuides(NOW)).toHaveLength(3);
    expect(groupPublishedGuides(getPublishedGuides(NOW))).toEqual([
      {
        intent: 'rent-out',
        visibleLinks: [
          {
            slug: 'decisions-to-make-before-you-rent-out-your-property',
            question: 'What should I decide before I rent out my flat or house?',
          },
        ],
        overflowLinks: [],
      },
      {
        intent: 'sell',
        visibleLinks: [
          {
            slug: 'can-a-broker-guarantee-a-property-sale-in-30-days',
            question: 'Can a broker guarantee that my property will sell in 30 days?',
          },
          {
            slug: 'what-to-tell-us-when-you-want-to-sell-your-property',
            question:
              'What information should I have ready when I approach a broker to sell my property?',
          },
        ],
        overflowLinks: [],
      },
    ]);
  });
});
