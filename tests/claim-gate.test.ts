import { describe, expect, it } from 'vitest';
import {
  CLAIM_LEDGER,
  evaluateClaim,
  evaluateClaims,
  isOrganisationHomepageUrl,
  type ClaimRecord,
  type SourceRecord,
} from '@/config/claims';

/**
 * The claim gate is the mechanism that stops unsupported locality facts reaching a
 * public page. These tests exercise the failure modes the audit actually found,
 * not just the happy path.
 */

const NOW = new Date('2026-09-29T00:00:00.000Z');

function source(overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    publisher: 'Example Transport Authority',
    independenceGroup: 'example-transport',
    exactUrl: 'https://example.gov/network/stations/list',
    documentReference: null,
    locationInSource: 'Operational stations table, row 12',
    publicationDate: '2026-06-01',
    accessDate: '2026-09-20',
    supportingNote: 'Table lists the station as in passenger service.',
    reuseRights: 'reference-only',
    ...overrides,
  };
}

function claim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    claimId: 'CLM-TEST-001',
    claimText: 'The station is in passenger service.',
    sources: [
      source(),
      source({
        publisher: 'Example City Corporation',
        independenceGroup: 'example-city',
        exactUrl: 'https://city.example.gov/reports/2026/transport.pdf',
        locationInSource: 'Page 4',
      }),
    ],
    reviewer: 'A. Named Reviewer',
    reviewDate: '2026-09-21',
    conflictingEvidenceNotes: null,
    approvalStatus: 'approved',
    recheckBy: '2027-03-01',
    usedByRoutes: ['/areas/example'],
    evidenceGap: null,
    ...overrides,
  };
}

describe('isOrganisationHomepageUrl', () => {
  it('treats a bare origin as a homepage', () => {
    expect(isOrganisationHomepageUrl('https://bbmp.gov.in')).toBe(true);
    expect(isOrganisationHomepageUrl('https://bbmp.gov.in/')).toBe(true);
  });

  it('treats a specific page as not a homepage', () => {
    expect(isOrganisationHomepageUrl('https://bbmp.gov.in/maps/ward-80')).toBe(false);
    expect(isOrganisationHomepageUrl('https://bbmp.gov.in?ward=80')).toBe(false);
  });
});

describe('evaluateClaim', () => {
  it('passes a fully evidenced, reviewed and unexpired claim', () => {
    const result = evaluateClaim(claim(), NOW);
    expect(result.failures).toEqual([]);
    expect(result.eligible).toBe(true);
  });

  it('rejects a claim with only one source', () => {
    const result = evaluateClaim(claim({ sources: [source()] }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/requires two independent sources/);
  });

  // This is the specific defect the audit found: three citations existed, but they
  // were all the same publisher or supported different claims.
  it('rejects two sources controlled by the same publisher', () => {
    const result = evaluateClaim(
      claim({
        sources: [
          source({ exactUrl: 'https://example.gov/network/a' }),
          source({ exactUrl: 'https://example.gov/network/b' }),
        ],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/not independent/);
  });

  it('rejects an organisation homepage as a reference', () => {
    const result = evaluateClaim(
      claim({
        sources: [
          source({ exactUrl: 'https://example.gov' }),
          source({
            publisher: 'Other Body',
            independenceGroup: 'other-body',
            exactUrl: 'https://other.example.gov/report.pdf',
          }),
        ],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/organisation homepage/);
  });

  it('rejects a source with no supporting excerpt or access date', () => {
    const result = evaluateClaim(
      claim({
        sources: [
          source({ supportingNote: null, accessDate: null }),
          source({ publisher: 'Other', independenceGroup: 'other' }),
        ],
      }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/no supporting excerpt/);
    expect(result.failures.join(' ')).toMatch(/no access date/);
  });

  it('rejects a fictional "research desk" sign-off', () => {
    const result = evaluateClaim(
      claim({ reviewer: 'INSTLE Research & Advisory Desk' }),
      NOW
    );
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/not a real named person/);
  });

  it('rejects an unreviewed claim', () => {
    const result = evaluateClaim(claim({ reviewer: null, reviewDate: null }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/No named reviewer/);
  });

  it('rejects a claim whose evidence has expired', () => {
    const result = evaluateClaim(claim({ recheckBy: '2026-01-01' }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/expired/);
  });

  it('rejects a claim that has not reached approved status', () => {
    const result = evaluateClaim(claim({ approvalStatus: 'editorial_review' }), NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/not "approved"/);
  });
});

describe('evaluateClaims', () => {
  it('fails closed on an unknown claim id rather than silently passing', () => {
    const result = evaluateClaims(['CLM-DOES-NOT-EXIST'], NOW);
    expect(result.eligible).toBe(false);
    expect(result.failures.join(' ')).toMatch(/no such claim/);
  });

  it('passes an empty claim set, because a section with no facts needs no evidence', () => {
    expect(evaluateClaims([], NOW).eligible).toBe(true);
  });
});

describe('the live claim ledger', () => {
  it('has no claim currently eligible for publication', () => {
    const eligible = CLAIM_LEDGER.filter((record) => evaluateClaim(record, NOW).eligible);
    expect(eligible).toEqual([]);
  });

  it('records a written evidence gap for every failing claim', () => {
    for (const record of CLAIM_LEDGER) {
      expect(record.evidenceGap, `${record.claimId} must state what is missing`).toBeTruthy();
    }
  });

  it('never carries a non-attributable reviewer name', () => {
    for (const record of CLAIM_LEDGER) {
      expect(record.reviewer).toBeNull();
    }
  });
});
