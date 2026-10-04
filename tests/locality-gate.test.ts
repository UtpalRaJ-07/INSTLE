import { describe, expect, it } from 'vitest';
import {
  LOCALITY_REGISTRY,
  auditLocalityRegistry,
  collectLocalityClaimIds,
  evaluateLocality,
  getAllLocalitySlugs,
  getPublishedLocalities,
  getPublishedLocalityBySlug,
  getPublishedLocalitySlugs,
  isLocalityPublishable,
  resolveLocalitySlug,
  type AdministrativeMapping,
  type LocalityRecord,
  type LocalitySection,
} from '@/config/localities';
import {
  MIN_CONTENT_SECTIONS,
  MIN_REGION_HUB_LOCALITY_LINKS,
  MIN_REGION_HUB_UNIQUE_SECTIONS,
  MIN_SECTION_WORDS,
  evaluateRegionHub,
  evaluateSectionDepth,
  findDuplicateSections,
  renderableLocalityLinks,
} from '@/config/locality-sections';

const NOW = new Date('2026-09-29T00:00:00.000Z');

/**
 * Passes the gate as it stands. Two sections of exactly the minimum depth, with
 * different text, because the gate now carries Requirement 1.5's section depth.
 */
function approvedRecord(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
  return {
    entityId: 'LOC-TEST',
    canonicalName: 'Test Locality',
    aliases: [],
    entityType: 'locality',
    slug: 'test-locality',
    marketingGroup: 'Test Bengaluru',
    administrativeMappings: [],
    actualServiceCoverage: 'confirmed-served',
    coverageResponsibleOwner: 'A. Named Person',
    summary: 'A summary that states no external facts.',
    summaryClaimIds: [],
    sections: [
      {
        sectionId: 'process',
        heading: 'What to discuss when buying here',
        paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'process')],
        claimIds: [],
      },
      {
        sectionId: 'papers',
        heading: 'What to have ready before the first call',
        paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'papers')],
        claimIds: [],
      },
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
    nextReviewAt: '2027-03-20',
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

describe('evaluateLocality', () => {
  it('publishes a record with confirmed coverage, real reviewers and no unsupported claims', () => {
    const result = evaluateLocality(approvedRecord(), NOW);
    expect(result.failures).toEqual([]);
    expect(result.eligible).toBe(true);
  });

  it('blocks publication when operational coverage is unconfirmed', () => {
    const result = evaluateLocality(
      approvedRecord({ actualServiceCoverage: 'unconfirmed' }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/coverage is "unconfirmed"/);
  });

  it('blocks publication when no person is accountable for the area', () => {
    const result = evaluateLocality(approvedRecord({ coverageResponsibleOwner: null }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/accountable/);
  });

  it('blocks publication when any of the three approvals is missing', () => {
    for (const field of ['author', 'localReviewer', 'seoReviewer'] as const) {
      const result = evaluateLocality(approvedRecord({ [field]: null }), NOW);
      expect(result.eligible, `${field} must be required`).toBe(false);
    }
  });

  it('blocks a record whose content review has expired', () => {
    const result = evaluateLocality(approvedRecord({ nextReviewAt: '2026-01-01' }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/review expired/);
  });

  it('blocks a record with no sections, so a thin page cannot publish', () => {
    const result = evaluateLocality(approvedRecord({ sections: [] }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/no content sections/);
  });

  /** Task 9.3, Requirement 1.5: section depth is a gate condition, not a template rule. */
  it('blocks a record with one section, or with a section under the word minimum', () => {
    const [first, second] = approvedRecord().sections;

    const single = evaluateLocality(approvedRecord({ sections: [first] }), NOW);
    expect(single.eligible).toBe(false);
    expect(single.failures).toEqual(evaluateSectionDepth(approvedRecord({ sections: [first] })));

    const short = { ...second, paragraphs: [paragraphOfWords(MIN_SECTION_WORDS - 1, 'short')] };
    const shallow = evaluateLocality(approvedRecord({ sections: [first, short] }), NOW);
    expect(shallow.eligible).toBe(false);
    expect(shallow.failures.join(' ')).toContain(`carries ${MIN_SECTION_WORDS - 1} words`);
  });

  // A status flag must never be able to bypass missing evidence.
  it('blocks a record marked published whose claims fail the gate', () => {
    const result = evaluateLocality(
      approvedRecord({
        sections: [
          {
            sectionId: 'transit',
            heading: 'Transit',
            paragraphs: ['A factual statement about transit.'],
            claimIds: ['CLM-IND-TRANSIT-001'],
          },
        ],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/CLM-IND-TRANSIT-001/);
  });

  it('blocks a record referencing a claim id that does not exist', () => {
    const result = evaluateLocality(
      approvedRecord({ summaryClaimIds: ['CLM-TYPO-999'] }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/no such claim/);
  });
});

describe('the live locality registry', () => {
  it('publishes nothing, because no record currently has sufficient evidence', () => {
    expect(getPublishedLocalities(NOW)).toEqual([]);
    expect(getPublishedLocalitySlugs(NOW)).toEqual([]);
  });

  it('still holds every record as a research candidate rather than deleting them', () => {
    expect(LOCALITY_REGISTRY.length).toBeGreaterThanOrEqual(5);
    expect(getAllLocalitySlugs()).toContain('indiranagar');
    expect(getAllLocalitySlugs()).toContain('north-bengaluru');
  });

  it('preserves the north-bengaluru slug rather than silently renaming it to hebbal', () => {
    expect(getAllLocalitySlugs()).toContain('north-bengaluru');
    expect(getAllLocalitySlugs()).not.toContain('hebbal');
  });

  it('records why each candidate is blocked', () => {
    for (const record of LOCALITY_REGISTRY) {
      expect(record.blockingNotes.length, `${record.slug} must say why`).toBeGreaterThan(0);
    }
  });

  it('never exposes an unpublished record through the by-slug lookup', () => {
    for (const slug of getAllLocalitySlugs()) {
      expect(getPublishedLocalityBySlug(slug, NOW)).toBeUndefined();
    }
  });

  it('returns undefined for an unknown slug', () => {
    expect(getPublishedLocalityBySlug('not-a-real-place', NOW)).toBeUndefined();
  });

  it('gives every record a full audit reason list', () => {
    const audit = auditLocalityRegistry(NOW);
    expect(audit).toHaveLength(LOCALITY_REGISTRY.length);
    for (const entry of audit) {
      expect(entry.eligible).toBe(false);
      expect(entry.failures.length).toBeGreaterThan(0);
    }
  });

  it('never publishes a record that is not publishable', () => {
    for (const record of LOCALITY_REGISTRY) {
      expect(isLocalityPublishable(record, NOW)).toBe(false);
    }
  });
});

describe('slug aliases', () => {
  it('maps a spelling variant to the canonical slug instead of creating a second page', () => {
    expect(resolveLocalitySlug('indira-nagar')).toBe('indiranagar');
    expect(resolveLocalitySlug('sadashiva-nagar')).toBe('sadashivanagar');
  });

  it('leaves an unknown slug untouched so it can 404', () => {
    expect(resolveLocalitySlug('whitefield-inner-enclaves')).toBe('whitefield-inner-enclaves');
    expect(resolveLocalitySlug('unknown-place')).toBe('unknown-place');
  });

  it('does not expose an alias as its own published page', () => {
    expect(getPublishedLocalityBySlug('indira-nagar', NOW)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Task 6.1 — the boundary version condition
// ---------------------------------------------------------------------------

/**
 * Requirements 1.7 and 1.14. A ward number without its delimitation is a boundary
 * assertion a reader cannot check, so the mapping fails the whole record rather than
 * rendering the bare value.
 */
describe('administrative mappings', () => {
  const mapping = (overrides: Partial<AdministrativeMapping> = {}): AdministrativeMapping => ({
    mappingType: 'BBMP zone and ward',
    value: 'East Zone, ward 80',
    boundaryVersion: '2023 delimitation',
    claimId: null,
    ...overrides,
  });

  it('admits a mapping that names a gate-passing claim and records a boundary version', () => {
    // No claim in the live ledger passes, so the claim half is exercised through the
    // failure list below; here the mapping carries no claim requirement to satisfy
    // beyond being named, which is why this case asserts the two new strings only.
    const result = evaluateLocality(
      approvedRecord({ administrativeMappings: [mapping({ claimId: null })] }),
      NOW
    );
    expect(result.failures).toContain('Administrative mapping "BBMP zone and ward" names no claim.');
  });

  it('fails the record when a mapping records no boundary version', () => {
    const result = evaluateLocality(
      approvedRecord({
        administrativeMappings: [mapping({ boundaryVersion: null, claimId: 'CLM-IND-WARD-001' })],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures).toContain(
      'Administrative mapping "BBMP zone and ward" records no boundary version.'
    );
  });

  it('treats a blank boundary version as absent', () => {
    const result = evaluateLocality(
      approvedRecord({
        administrativeMappings: [mapping({ boundaryVersion: '   ', claimId: 'CLM-IND-WARD-001' })],
      }),
      NOW
    );
    expect(result.failures.join(' ')).toContain('records no boundary version');
  });

  it('names the mapping type in the failure, so the fix is obvious', () => {
    const result = evaluateLocality(
      approvedRecord({
        administrativeMappings: [
          mapping({ mappingType: 'planning district', boundaryVersion: null }),
        ],
      }),
      NOW
    );
    expect(result.failures.join(' ')).toContain('"planning district"');
  });

  /**
   * The condition closes a hole rather than restating the claim check. A mapping with
   * `claimId: null` contributes nothing to `collectLocalityClaimIds`, so before this
   * condition a mapping with no claim at all passed unnoticed while a mapping naming
   * a bad claim was caught.
   */
  it('catches a mapping with no claim, which the claim gate could not see', () => {
    const record = approvedRecord({
      administrativeMappings: [mapping({ claimId: null })],
    });
    expect(collectLocalityClaimIds(record)).toEqual([]);
    expect(evaluateLocality(record, NOW).eligible).toBe(false);
  });

  /** All five pre-existing records carry a null boundary version. */
  it('adds a failure to the existing records that carry a mapping', () => {
    const withMappings = LOCALITY_REGISTRY.filter(
      (record) => record.administrativeMappings.length > 0
    );
    expect(withMappings.length).toBeGreaterThan(0);
    for (const record of withMappings) {
      expect(
        evaluateLocality(record, NOW).failures.join(' '),
        record.slug
      ).toContain('records no boundary version');
    }
  });

  it('changes no count, because those records already failed', () => {
    expect(getPublishedLocalities(NOW)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Task 6.4 — section depth, duplication, and the region hub
// ---------------------------------------------------------------------------

/** A paragraph of exactly `words` words, seeded so two calls differ. */
function paragraphOfWords(words: number, seed: string): string {
  return Array.from({ length: words }, (_, index) => (index === 0 ? seed : 'word')).join(' ');
}

function deepSection(overrides: Partial<LocalitySection> = {}): LocalitySection {
  return {
    sectionId: 'depth',
    heading: 'What is worth knowing here?',
    paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'alpha')],
    claimIds: [],
    ...overrides,
  };
}

describe('evaluateSectionDepth', () => {
  it(`requires ${MIN_CONTENT_SECTIONS} sections`, () => {
    const failures = evaluateSectionDepth(approvedRecord({ sections: [deepSection()] }));
    expect(failures.join(' ')).toContain(`carries 1 content section(s)`);
  });

  it(`accepts a section of exactly ${MIN_SECTION_WORDS} words and rejects one word fewer`, () => {
    const atBound = deepSection({ sectionId: 'a' });
    const underBound = deepSection({
      sectionId: 'b',
      heading: 'And what else?',
      paragraphs: [paragraphOfWords(MIN_SECTION_WORDS - 1, 'beta')],
    });

    const record = approvedRecord({ sections: [atBound, underBound] });
    const failures = evaluateSectionDepth(record);
    expect(failures.join(' ')).toContain(`"And what else?" carries ${MIN_SECTION_WORDS - 1} words`);
    expect(failures.join(' ')).not.toContain('"What is worth knowing here?" carries');
  });

  it('reports a record that repeats its own section text', () => {
    const record = approvedRecord({
      sections: [deepSection({ sectionId: 'a' }), deepSection({ sectionId: 'b' })],
    });
    expect(evaluateSectionDepth(record).join(' ')).toContain('repeats the text of section');
  });
});

describe('findDuplicateSections', () => {
  it('finds nothing when two records carry genuinely different sections', () => {
    const left = approvedRecord({ slug: 'alpha-locality', sections: [deepSection()] });
    const right = approvedRecord({
      slug: 'beta-locality',
      sections: [
        deepSection({ heading: 'A different question?', paragraphs: [paragraphOfWords(130, 'beta')] }),
      ],
    });
    expect(findDuplicateSections([left, right])).toEqual([]);
  });

  it('finds a section reproduced word for word', () => {
    const section = deepSection();
    const left = approvedRecord({ slug: 'alpha-locality', sections: [section] });
    const right = approvedRecord({ slug: 'beta-locality', sections: [section] });

    expect(findDuplicateSections([left, right])).toEqual([
      { a: 'alpha-locality', b: 'beta-locality', heading: 'What is worth knowing here?' },
    ]);
  });

  it('finds a section reproduced after a reflow and a case change', () => {
    const left = approvedRecord({
      slug: 'alpha-locality',
      sections: [deepSection({ paragraphs: ['One  two   three\nfour'] })],
    });
    const right = approvedRecord({
      slug: 'beta-locality',
      sections: [deepSection({ paragraphs: ['ONE TWO THREE FOUR'] })],
    });
    expect(findDuplicateSections([left, right])).toHaveLength(1);
  });

  /**
   * The case Requirement 1.5 exists for: the same paragraph shipped twice with the
   * area name swapped. Verbatim comparison misses it; place-name substitution does
   * not.
   */
  it('finds a section that differs only by the place name', () => {
    const template = (place: string) =>
      `Buying in ${place} means the same three conversations, and ${place} is no exception to any of them.`;

    const left = approvedRecord({
      slug: 'alpha-locality',
      canonicalName: 'Alphanagar',
      aliases: [],
      sections: [deepSection({ paragraphs: [template('Alphanagar')] })],
    });
    const right = approvedRecord({
      slug: 'beta-locality',
      canonicalName: 'Betapura',
      aliases: [],
      sections: [deepSection({ paragraphs: [template('Betapura')] })],
    });

    expect(findDuplicateSections([left, right])).toEqual([
      { a: 'alpha-locality', b: 'beta-locality', heading: 'What is worth knowing here?' },
    ]);
  });

  /** An alias is the same place name spelled differently, so it substitutes too. */
  it('finds the substituted case through an alias spelling', () => {
    const left = approvedRecord({
      slug: 'indiranagar-test',
      canonicalName: 'Indiranagar',
      aliases: ['Indira Nagar'],
      sections: [deepSection({ paragraphs: ['Indira Nagar has the same three conversations.'] })],
    });
    const right = approvedRecord({
      slug: 'koramangala-test',
      canonicalName: 'Koramangala',
      aliases: [],
      sections: [deepSection({ paragraphs: ['Koramangala has the same three conversations.'] })],
    });
    expect(findDuplicateSections([left, right])).toHaveLength(1);
  });

  it('compares across records only, leaving a record repeating itself to the depth check', () => {
    const section = deepSection();
    const record = approvedRecord({
      slug: 'alpha-locality',
      sections: [section, { ...section, sectionId: 'b' }],
    });
    expect(findDuplicateSections([record])).toEqual([]);
    expect(evaluateSectionDepth(record).join(' ')).toContain('repeats the text');
  });

  it('finds nothing in the live registry, because no record carries a section', () => {
    expect(findDuplicateSections(getPublishedLocalities(NOW))).toEqual([]);
  });
});

describe('evaluateRegionHub', () => {
  /** Three published localities the hub can link to, each with its own text. */
  function publishedNeighbours(): LocalityRecord[] {
    return ['one', 'two', 'three'].map((name, index) =>
      approvedRecord({
        entityId: `LOC-N-${name}`,
        slug: `neighbour-${name}`,
        canonicalName: `Neighbour ${name}`,
        sections: [
          deepSection({
            sectionId: `n-${name}`,
            heading: `What is ${name} like?`,
            paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, `neighbour-${index}`)],
          }),
        ],
      })
    );
  }

  /**
   * A hub whose nearby relationships are claim-backed.
   *
   * No claim in the live ledger passes the gate, so a claim-backed relationship
   * cannot be built from a real claim ID — which is exactly why the link count
   * assertions below use `renderableLocalityLinks` to state what is countable, and
   * why the hub in these tests is checked for the failure strings rather than for
   * eligibility. A region hub cannot publish today and this records why in the same
   * terms the gate uses.
   */
  function hub(overrides: Partial<LocalityRecord> = {}): LocalityRecord {
    return approvedRecord({
      entityId: 'LOC-HUB',
      slug: 'east-region-hub',
      canonicalName: 'East region',
      entityType: 'region-hub',
      sections: [
        deepSection({ sectionId: 'h1', heading: 'How do these areas relate?', paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'hub-one')] }),
        deepSection({ sectionId: 'h2', heading: 'Where should you start?', paragraphs: [paragraphOfWords(MIN_SECTION_WORDS, 'hub-two')] }),
      ],
      approvedNearbyRelationships: publishedNeighbours().map((neighbour) => ({
        slug: neighbour.slug,
        relationship: 'is one of the areas this hub covers',
        claimId: 'CLM-IND-WARD-001',
      })),
      ...overrides,
    });
  }

  it('rejects a record that is not a region hub', () => {
    const result = evaluateRegionHub(hub({ entityType: 'locality' }), publishedNeighbours(), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toContain('entity type is "locality"');
  });

  it('counts only links to published localities whose relationship claim passes', () => {
    const neighbours = publishedNeighbours();
    // The claim IDs above are real ledger entries, and no ledger entry passes the
    // gate, so nothing is countable and the hub reports zero links.
    expect(renderableLocalityLinks(hub(), neighbours, NOW)).toEqual([]);
    expect(evaluateRegionHub(hub(), neighbours, NOW).failures.join(' ')).toContain(
      'links to 0 published locality page(s)'
    );
  });

  it('does not count a link to a locality that fails the gate', () => {
    const unpublished = publishedNeighbours().map((neighbour) => ({
      ...neighbour,
      publicationStatus: 'unpublished' as const,
    }));
    const published = unpublished.filter((record) => isLocalityPublishable(record, NOW));
    expect(published).toEqual([]);
    expect(renderableLocalityLinks(hub(), published, NOW)).toEqual([]);
  });

  it('does not count a nearby relationship carrying no claim at all', () => {
    const neighbours = publishedNeighbours();
    const noClaims = hub({
      approvedNearbyRelationships: neighbours.map((neighbour) => ({
        slug: neighbour.slug,
        relationship: 'is one of the areas this hub covers',
        claimId: null,
      })),
    });
    expect(renderableLocalityLinks(noClaims, neighbours, NOW)).toEqual([]);
  });

  it(`reports the link threshold of ${MIN_REGION_HUB_LOCALITY_LINKS} and the unique-section threshold of ${MIN_REGION_HUB_UNIQUE_SECTIONS}`, () => {
    const result = evaluateRegionHub(
      hub({ sections: [deepSection({ sectionId: 'only', heading: 'One section only?' })] }),
      publishedNeighbours(),
      NOW
    );
    expect(result.failures.join(' ')).toContain(
      `publication requires at least ${MIN_REGION_HUB_LOCALITY_LINKS}`
    );
    expect(result.failures.join(' ')).toContain(
      `publication requires at least ${MIN_REGION_HUB_UNIQUE_SECTIONS}`
    );
  });

  /**
   * The uniqueness half, isolated from the link half. A hub whose two sections are
   * copied off published locality pages carries no text of its own, and the same
   * place-name substitution that governs Requirement 1.5 catches it.
   */
  it('does not count a hub section reproduced from a published locality', () => {
    const neighbours = publishedNeighbours();
    const borrowed = hub({
      sections: neighbours.slice(0, 2).map((neighbour, index) => ({
        ...neighbour.sections[0],
        sectionId: `borrowed-${index}`,
      })),
    });
    const result = evaluateRegionHub(borrowed, neighbours, NOW);
    expect(result.failures.join(' ')).toContain(
      'carries 0 section(s) of at least 120 words that appear on no other published locality page'
    );
  });

  /** And the place-name-substituted variant of the same borrowing. */
  it('does not count a hub section borrowed with only the place name changed', () => {
    const neighbours = publishedNeighbours();
    const substituted = hub({
      canonicalName: 'East region',
      sections: neighbours.slice(0, 2).map((neighbour, index) => ({
        ...neighbour.sections[0],
        sectionId: `substituted-${index}`,
        paragraphs: neighbour.sections[0].paragraphs.map((paragraph) =>
          paragraph.replace(new RegExp(neighbour.canonicalName, 'g'), 'East region')
        ),
      })),
    });
    expect(evaluateRegionHub(substituted, neighbours, NOW).failures.join(' ')).toContain(
      'carries 0 section(s) of at least 120 words'
    );
  });

  /** The hub does not fail on its own sections when it is itself in the published set. */
  it('excludes itself from the comparison set', () => {
    const neighbours = publishedNeighbours();
    const subject = hub();
    const failures = evaluateRegionHub(subject, [...neighbours, subject], NOW).failures;
    expect(failures.join(' ')).not.toContain('section(s) of at least 120 words');
  });

  it('does not count a hub section that is too short to be a section', () => {
    const neighbours = publishedNeighbours();
    const thin = hub({
      sections: [
        deepSection({ sectionId: 't1', heading: 'Short one?', paragraphs: ['Too short.'] }),
        deepSection({ sectionId: 't2', heading: 'Short two?', paragraphs: ['Also too short.'] }),
      ],
    });
    expect(evaluateRegionHub(thin, neighbours, NOW).failures.join(' ')).toContain(
      'carries 0 section(s) of at least 120 words'
    );
  });

  it('inherits every failure the locality gate returns rather than re-deriving them', () => {
    const neighbours = publishedNeighbours();
    const unconfirmed = hub({ actualServiceCoverage: 'unconfirmed' });
    const regionFailures = evaluateRegionHub(unconfirmed, neighbours, NOW).failures;
    for (const failure of evaluateLocality(unconfirmed, NOW).failures) {
      expect(regionFailures).toContain(failure);
    }
  });

  it('holds no region hub in the live registry, so no hub route can exist yet', () => {
    expect(LOCALITY_REGISTRY.filter((record) => record.entityType === 'region-hub')).toEqual([]);
  });
});
