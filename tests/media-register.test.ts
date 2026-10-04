import { describe, expect, it } from 'vitest';

import {
  ALT_TEXT_MAX_LENGTH,
  CAPTION_MAX_LENGTH,
  VISUAL_ASSET_REGISTER,
  auditVisualAssets,
  daysUntilLicenceExpiry,
  evaluateAsset,
  getVisualAsset,
  type IllustrationAsset,
  type MapAsset,
  type MediaProvenance,
  type PersonRelease,
  type PhotographAsset,
  type TextureAsset,
} from '@/config/media-register';

/**
 * The Media_Register.
 *
 * Two of these tests are compile-time rather than run-time. A map asset that
 * claims to show a commute time, and a texture that carries alt text, are both
 * type errors — `@ts-expect-error` is the assertion, and `npm run typecheck` is
 * where it fires. If either constraint were weakened to `boolean`, the expected
 * error would disappear and the typecheck would fail, which is exactly the
 * behaviour wanted from a guard that is supposed to be structural.
 */

const NOW = new Date('2026-09-29T00:00:00.000Z');

function provenance(overrides: Partial<MediaProvenance> = {}): MediaProvenance {
  return {
    creator: 'INSTLE REAL ESTATE in-house illustration',
    sourceReference: 'docs/implementation/DESIGN-AND-MEDIA.md part 2, asset table',
    licenceName: 'Original work, all rights held by the business',
    licenceTerms: 'Unrestricted use on this site; no third-party redistribution.',
    permissionToAdapt: 'granted',
    acquiredOn: '2026-09-01',
    licenceExpiresOn: null,
    ...overrides,
  };
}

function illustration(overrides: Partial<IllustrationAsset> = {}): IllustrationAsset {
  return {
    kind: 'illustration',
    assetId: 'ILL-STREETSCAPE-001',
    delivery: { mode: 'inline-svg', componentName: 'CivicStreetscapeBand' },
    intrinsicWidth: 1440,
    intrinsicHeight: 320,
    altText: 'Line illustration of a generic street edge with low buildings and trees.',
    decorative: false,
    subject: { kind: 'civic-motif', name: 'Bengaluru street edge' },
    provenance: provenance(),
    backgroundColoursBehindText: ['#ffffff'],
    compressedBytes: 4_210,
    depicts: ['street edge', 'low building', 'tree canopy'],
    illustrationLabel: 'Illustration',
    ...overrides,
  };
}

function mapAsset(overrides: Partial<MapAsset> = {}): MapAsset {
  return {
    kind: 'map',
    assetId: 'MAP-CORRIDOR-001',
    delivery: { mode: 'inline-svg', componentName: 'CorridorDiagram' },
    intrinsicWidth: 960,
    intrinsicHeight: 540,
    altText: 'Schematic diagram of the corridors this site groups areas by.',
    decorative: false,
    subject: { kind: 'corridor', name: 'Bengaluru corridors' },
    provenance: provenance(),
    backgroundColoursBehindText: ['#ffffff'],
    compressedBytes: 6_820,
    orientationAidLabel: 'Orientation aid, not a boundary map',
    boundaryClaimId: null,
    showsCommuteTimes: false,
    showsDistances: false,
    ...overrides,
  };
}

function texture(overrides: Partial<TextureAsset> = {}): TextureAsset {
  return {
    kind: 'texture',
    assetId: 'TEX-GRID-001',
    delivery: { mode: 'inline-svg', componentName: 'LayoutGridMotif' },
    intrinsicWidth: 240,
    intrinsicHeight: 240,
    altText: null,
    decorative: true,
    subject: { kind: 'civic-motif', name: 'Layout grid motif' },
    provenance: provenance(),
    backgroundColoursBehindText: [],
    compressedBytes: 980,
    ...overrides,
  };
}

function personRelease(overrides: Partial<PersonRelease> = {}): PersonRelease {
  return {
    personName: 'Utpal Raj KB',
    permittedUses: ['Use on the about page of this site'],
    releasedOn: '2026-09-01',
    expiresOn: null,
    ...overrides,
  };
}

function photograph(overrides: Partial<PhotographAsset> = {}): PhotographAsset {
  return {
    kind: 'photograph',
    assetId: 'PHO-OWNER-001',
    delivery: { mode: 'file', publicPath: '/media/owner-portrait.jpg' },
    intrinsicWidth: 1200,
    intrinsicHeight: 1600,
    altText: 'Utpal Raj KB, owner and CEO.',
    decorative: false,
    subject: { kind: 'civic-motif', name: 'Owner portrait' },
    provenance: provenance({
      creator: 'A named photographer',
      sourceReference: 'Supplied by the owner under Owner_Input_Register C12',
      licenceName: 'Written permission from the photographer',
      licenceTerms: 'Use on this site only.',
    }),
    backgroundColoursBehindText: [],
    compressedBytes: 84_000,
    personRelease: personRelease(),
    caption: null,
    showsRecognisableFace: true,
    showsBuildingOrStreet: false,
    ...overrides,
  };
}

describe('the live register', () => {
  /**
   * The register held nothing until the inline identity was drawn. It now holds the
   * four drawings the site renders, and still no photograph — so the assertion
   * moves from "empty" to "these four, all renderable, and nothing else", which is
   * a condition the previous state would also have failed.
   */
  it('holds exactly the four inline drawings', () => {
    expect(VISUAL_ASSET_REGISTER.map((asset) => asset.assetId)).toEqual([
      'ILL-STREETSCAPE-001',
      'ILL-STREETSCAPE-002',
      'MAP-CORRIDOR-001',
      'TEX-LAYOUT-GRID-001',
    ]);
    expect(getVisualAsset('ILL-STREETSCAPE-001')).toBeDefined();
    expect(getVisualAsset('ILL-NOT-A-REAL-ASSET')).toBeUndefined();
  });

  it('records every one of them as renderable, with no missing provenance', () => {
    for (const evaluation of auditVisualAssets(NOW)) {
      expect(evaluation.failures).toEqual([]);
      expect(evaluation.renderable).toBe(true);
    }
  });

  it('records no photograph, so no page can reference one', () => {
    expect(VISUAL_ASSET_REGISTER.filter((asset) => asset.kind === 'photograph')).toEqual([]);
  });

  it('delivers every asset inline, so the identity issues no external request', () => {
    for (const asset of VISUAL_ASSET_REGISTER) {
      expect(asset.delivery.mode).toBe('inline-svg');
    }
  });

  it('draws no boundary, because no boundary claim has passed the claim gate', () => {
    for (const asset of VISUAL_ASSET_REGISTER) {
      if (asset.kind !== 'map') continue;
      expect(asset.boundaryClaimId).toBeNull();
      expect(asset.showsCommuteTimes).toBe(false);
      expect(asset.showsDistances).toBe(false);
    }
  });
});

describe('provenance completeness', () => {
  it('accepts an asset carrying every recorded value', () => {
    expect(evaluateAsset(illustration(), NOW)).toEqual({ renderable: true, failures: [] });
  });

  const blankings: readonly {
    readonly label: string;
    readonly overrides: Partial<MediaProvenance>;
    readonly expected: string;
  }[] = [
    { label: 'creator', overrides: { creator: '' }, expected: 'no creator recorded' },
    {
      label: 'source reference',
      overrides: { sourceReference: '   ' },
      expected: 'no source reference recorded',
    },
    { label: 'licence name', overrides: { licenceName: '' }, expected: 'no licence name recorded' },
    {
      label: 'licence terms',
      overrides: { licenceTerms: '' },
      expected: 'no licence terms recorded',
    },
    {
      label: 'acquisition date',
      overrides: { acquiredOn: '' },
      expected: 'no acquisition date recorded',
    },
  ];

  for (const { label, overrides, expected } of blankings) {
    it(`fails naming the absent ${label}`, () => {
      const evaluation = evaluateAsset(illustration({ provenance: provenance(overrides) }), NOW);
      expect(evaluation.renderable).toBe(false);
      expect(evaluation.failures.join(' ')).toContain(expected);
      expect(evaluation.failures.join(' ')).toContain('ILL-STREETSCAPE-001');
    });
  }

  it('names every absent value at once rather than the first', () => {
    const evaluation = evaluateAsset(
      illustration({
        provenance: provenance({ creator: '', sourceReference: '', licenceName: '', acquiredOn: '' }),
      }),
      NOW
    );
    expect(evaluation.failures).toHaveLength(4);
  });

  it('rejects an acquisition date that is not a date', () => {
    const evaluation = evaluateAsset(
      illustration({ provenance: provenance({ acquiredOn: 'last spring' }) }),
      NOW
    );
    expect(evaluation.renderable).toBe(false);
  });

  it('accepts a recorded refusal of permission to adapt as a recorded value', () => {
    const evaluation = evaluateAsset(
      illustration({ provenance: provenance({ permissionToAdapt: 'refused' }) }),
      NOW
    );
    expect(evaluation.renderable).toBe(true);
  });

  it('requires recorded intrinsic dimensions and a measured weight', () => {
    const evaluation = evaluateAsset(
      illustration({ intrinsicWidth: 0, intrinsicHeight: -1, compressedBytes: 0 }),
      NOW
    );
    expect(evaluation.failures.join(' ')).toContain('no intrinsic width recorded');
    expect(evaluation.failures.join(' ')).toContain('no intrinsic height recorded');
    expect(evaluation.failures.join(' ')).toContain('no measured compressed weight recorded');
  });
});

describe('alt text and decorative assets', () => {
  it('accepts alt text at the 125-character boundary', () => {
    const atLimit = 'a'.repeat(ALT_TEXT_MAX_LENGTH);
    expect(evaluateAsset(illustration({ altText: atLimit }), NOW).renderable).toBe(true);
  });

  it('rejects alt text one character over the boundary', () => {
    const overLimit = 'a'.repeat(ALT_TEXT_MAX_LENGTH + 1);
    const evaluation = evaluateAsset(illustration({ altText: overLimit }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('126 characters');
  });

  it('rejects a non-decorative asset with no alt text', () => {
    const evaluation = evaluateAsset(illustration({ altText: null }), NOW);
    expect(evaluation.failures.join(' ')).toContain('no alt text recorded');
  });

  it('rejects a non-decorative asset with blank alt text', () => {
    const evaluation = evaluateAsset(illustration({ altText: '   ' }), NOW);
    expect(evaluation.renderable).toBe(false);
  });

  it('accepts a decorative texture with no alt text', () => {
    expect(evaluateAsset(texture(), NOW)).toEqual({ renderable: true, failures: [] });
  });

  it('rejects an asset recorded decorative while carrying alt text', () => {
    const evaluation = evaluateAsset(
      illustration({ decorative: true, altText: 'A decorative band.' }),
      NOW
    );
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('recorded decorative while carrying alt text');
  });

  it('does not compile a texture that carries alt text', () => {
    const asset: TextureAsset = {
      ...texture(),
      // @ts-expect-error Requirement 9.16: a texture is decorative, so its alt text is null.
      altText: 'A decorative band.',
    };
    expect(asset.altText).toBe('A decorative band.');
  });
});

describe('the literal-false map constraints', () => {
  it('accepts a map recorded showing neither commute times nor distances', () => {
    expect(evaluateAsset(mapAsset(), NOW)).toEqual({ renderable: true, failures: [] });
  });

  it('does not compile a map that claims to show commute times', () => {
    const asset: MapAsset = {
      ...mapAsset(),
      // @ts-expect-error Requirement 9.3: the literal type forbids a commute time.
      showsCommuteTimes: true,
    };
    expect(asset.showsCommuteTimes).toBe(true);
  });

  it('does not compile a map that claims to show distances', () => {
    const asset: MapAsset = {
      ...mapAsset(),
      // @ts-expect-error Requirement 9.3: the literal type forbids a distance.
      showsDistances: true,
    };
    expect(asset.showsDistances).toBe(true);
  });

  it('requires the visible orientation-aid label', () => {
    const evaluation = evaluateAsset(mapAsset({ orientationAidLabel: '' }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('orientation aid');
  });

  it('draws a boundary only from a claim that passes the claim gate', () => {
    // Every claim in the live ledger fails the gate today, which is the point.
    const evaluation = evaluateAsset(mapAsset({ boundaryClaimId: 'CLM-IND-WARD-001' }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('boundary claim is not usable');
  });

  it('names a boundary claim that is not in the ledger at all', () => {
    const evaluation = evaluateAsset(mapAsset({ boundaryClaimId: 'CLM-DOES-NOT-EXIST' }), NOW);
    expect(evaluation.failures.join(' ')).toContain('CLM-DOES-NOT-EXIST');
  });
});

describe('the illustration label', () => {
  it('requires the visible illustration label', () => {
    const evaluation = evaluateAsset(illustration({ illustrationLabel: '' }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('as an illustration');
  });

  it('requires at least one depicted subject', () => {
    const evaluation = evaluateAsset(illustration({ depicts: [] }), NOW);
    expect(evaluation.failures.join(' ')).toContain('no depicted subject recorded');
  });

  it('rejects a blank depicted subject', () => {
    const evaluation = evaluateAsset(illustration({ depicts: ['street edge', ' '] }), NOW);
    expect(evaluation.failures.join(' ')).toContain('a depicted subject is blank');
  });
});

describe('the person release', () => {
  it('accepts a photograph with a recognisable face and a written release', () => {
    expect(evaluateAsset(photograph(), NOW)).toEqual({ renderable: true, failures: [] });
  });

  it('rejects a recognisable face with no release', () => {
    const evaluation = evaluateAsset(photograph({ personRelease: null }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('records no written person release');
  });

  it('names each absent value in the release', () => {
    const evaluation = evaluateAsset(
      photograph({
        personRelease: personRelease({ personName: '', permittedUses: [], releasedOn: '' }),
      }),
      NOW
    );
    expect(evaluation.failures.join(' ')).toContain('names no person');
    expect(evaluation.failures.join(' ')).toContain('records no permitted use');
    expect(evaluation.failures.join(' ')).toContain('records no date');
  });

  it('rejects a release dated in the future', () => {
    const evaluation = evaluateAsset(
      photograph({ personRelease: personRelease({ releasedOn: '2027-01-01' }) }),
      NOW
    );
    expect(evaluation.failures.join(' ')).toContain('in the future');
  });

  it('reports a release recorded against a photograph showing no recognisable face', () => {
    const evaluation = evaluateAsset(photograph({ showsRecognisableFace: false }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('one of the two is wrong');
  });

  it('accepts a photograph with no face and no release', () => {
    const evaluation = evaluateAsset(
      photograph({ showsRecognisableFace: false, personRelease: null }),
      NOW
    );
    expect(evaluation.renderable).toBe(true);
  });

  it('holds the caption to 120 characters', () => {
    /*
     * The bound is 120 and it stays 120 — Requirement 10.6. What was wrong here was
     * the fixture, not the bound: a run of 120 letters is refused whatever its
     * length, because it names no area and carries no date, so the old assertion
     * could never have distinguished a correct bound from a broken one. It failed
     * for the right reason.
     *
     * The caption is therefore built from the two parts Requirement 10.6 permits —
     * the recorded area name and the date the photograph was taken — spaced out to
     * land exactly on the limit. Spacing is the only padding available, because the
     * rule refuses any other word; that is the rule working, not a loophole.
     */
    const area = 'Jayanagar 4th Block';
    const dateTaken = 'March 2027';
    const subject = { kind: 'locality', name: area } as const;
    const atLimit = `${area}${' '.repeat(CAPTION_MAX_LENGTH - area.length - dateTaken.length)}${dateTaken}`;
    expect(atLimit).toHaveLength(CAPTION_MAX_LENGTH);
    expect(evaluateAsset(photograph({ subject, caption: atLimit }), NOW)).toEqual({
      renderable: true,
      failures: [],
    });

    const overLimit = `${area}${' '.repeat(CAPTION_MAX_LENGTH - area.length - dateTaken.length + 1)}${dateTaken}`;
    expect(overLimit).toHaveLength(CAPTION_MAX_LENGTH + 1);
    const evaluation = evaluateAsset(photograph({ subject, caption: overLimit }), NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('121 characters');
    // And the length is the only thing wrong with it, so the bound is what refused it.
    expect(evaluation.failures).toHaveLength(1);
  });
});

describe('licence and release expiry at the boundary', () => {
  it('renders while the licence expiry is still in the future', () => {
    const asset = illustration({
      provenance: provenance({ licenceExpiresOn: '2026-09-30' }),
    });
    expect(evaluateAsset(asset, NOW).renderable).toBe(true);
    expect(daysUntilLicenceExpiry(asset, NOW)).toBe(1);
  });

  it('fails on the licence expiry date itself', () => {
    const asset = illustration({ provenance: provenance({ licenceExpiresOn: '2026-09-29' }) });
    const evaluation = evaluateAsset(asset, NOW);
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('the licence expired on 2026-09-29');
    expect(daysUntilLicenceExpiry(asset, NOW)).toBe(0);
  });

  it('fails after the licence expiry date', () => {
    const asset = illustration({ provenance: provenance({ licenceExpiresOn: '2026-01-01' }) });
    expect(evaluateAsset(asset, NOW).renderable).toBe(false);
  });

  it('records no expiry as no expiry rather than as an expired licence', () => {
    expect(daysUntilLicenceExpiry(illustration(), NOW)).toBeNull();
    expect(evaluateAsset(illustration(), NOW).renderable).toBe(true);
  });

  it('fails on the person-release expiry date itself', () => {
    const evaluation = evaluateAsset(
      photograph({ personRelease: personRelease({ expiresOn: '2026-09-29' }) }),
      NOW
    );
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('the person release expired on 2026-09-29');
  });

  it('renders while the person release is still in force', () => {
    const evaluation = evaluateAsset(
      photograph({ personRelease: personRelease({ expiresOn: '2026-09-30' }) }),
      NOW
    );
    expect(evaluation.renderable).toBe(true);
  });

  it('rejects a licence expiry that is not a date', () => {
    const evaluation = evaluateAsset(
      illustration({ provenance: provenance({ licenceExpiresOn: 'when the owner says' }) }),
      NOW
    );
    expect(evaluation.renderable).toBe(false);
    expect(evaluation.failures.join(' ')).toContain('is not a date');
  });
});
