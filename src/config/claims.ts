/**
 * Claim and source ledger.
 *
 * Master prompt section 15 is the specification this implements:
 *   "Two independent sources must support each significant factual locality claim
 *    under the project gate. Two URLs from the same publisher are not independent
 *    corroboration. ... A generic organisation homepage does not establish a
 *    particular ward, station, typology, or opening date."
 *
 * The previous implementation filtered status labels. This file instead evaluates
 * the evidence attached to each individual claim, so a record cannot be published
 * by flipping a flag.
 */

export type ClaimApprovalStatus =
  | 'candidate'
  | 'research'
  | 'draft'
  | 'fact_review'
  | 'editorial_review'
  | 'seo_review'
  | 'approved';

/**
 * Names that have appeared in this repository as sign-off values but do not
 * identify a real accountable person. The gate rejects them outright.
 *
 * Master prompt section 15: "Only real named reviewers may sign off; never
 * generate fictional 'research desk approved' evidence."
 */
export const NON_ATTRIBUTABLE_REVIEWER_NAMES: readonly string[] = [
  'instle research & advisory desk',
  'instle research and advisory desk',
  'research desk',
  'research & advisory desk',
  'editorial desk',
  'draft review in progress',
  'internal desk',
  'tbd',
  'unknown',
] as const;

export interface SourceRecord {
  /** Organisation that published the source, e.g. "Bangalore Metro Rail Corporation Limited". */
  publisher: string;
  /**
   * Independence group. Two sources corroborate a claim only if these differ.
   * Use the controlling organisation, so two URLs on one domain share a group.
   */
  independenceGroup: string;
  /** Exact URL of the page or document that carries the claim. */
  exactUrl: string | null;
  /** Offline document reference, when the source is not a URL. */
  documentReference: string | null;
  /** Page, section or table within the source. */
  locationInSource: string | null;
  /** ISO date the source was published or last updated, when stated. */
  publicationDate: string | null;
  /** ISO date a person actually opened the source. */
  accessDate: string | null;
  /** The excerpt or research note that supports the claim text. */
  supportingNote: string | null;
  /** Whether the excerpt may be reproduced on the site. */
  reuseRights: 'unknown' | 'reference-only' | 'quotation-permitted';
}

export interface ClaimRecord {
  claimId: string;
  /** The precise claim, including scope and qualifiers. */
  claimText: string;
  sources: readonly SourceRecord[];
  /** Real named person who checked the evidence. Null means unreviewed. */
  reviewer: string | null;
  /** ISO date of that review. */
  reviewDate: string | null;
  /** Anything found that contradicts or complicates the claim. */
  conflictingEvidenceNotes: string | null;
  approvalStatus: ClaimApprovalStatus;
  /** ISO date after which the claim must be rechecked. */
  recheckBy: string | null;
  /** Routes that render this claim, so corrections can be propagated. */
  usedByRoutes: readonly string[];
  /**
   * Plain-language record of what is missing. Written by whoever inspected the
   * evidence; surfaced in internal tooling, never on a public page.
   */
  evidenceGap: string | null;
}

export interface ClaimEvaluation {
  claimId: string;
  eligible: boolean;
  /** Every reason the claim failed, so an editor can fix all of them at once. */
  failures: readonly string[];
}

/**
 * A URL that is only an origin (or a bare "/") cannot establish a specific fact.
 * Exported for testing because this heuristic is a real gate, not a formality.
 */
export function isOrganisationHomepageUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const hasPath = parsed.pathname.replace(/\/+$/, '').length > 0;
  const hasQuery = parsed.search.length > 0;
  return !hasPath && !hasQuery;
}

/**
 * Whether a recorded name identifies a real accountable person.
 *
 * Exported because the same rule governs a claim reviewer, an editorial sign-off
 * (Requirement 11.3) and a named observer (Requirement 7.2). One definition, so a
 * desk name is rejected in one place rather than three, and adding a name to
 * `NON_ATTRIBUTABLE_REVIEWER_NAMES` tightens every caller at once.
 *
 * Comparison is on the trimmed, lower-cased value, so "  Research Desk  " and
 * "RESEARCH DESK" are rejected along with the recorded spelling.
 */
export function isAttributableName(name: string | null | undefined): boolean {
  if (typeof name !== 'string') return false;
  const normalised = name.trim().toLowerCase();
  if (normalised.length < 3) return false;
  return !NON_ATTRIBUTABLE_REVIEWER_NAMES.includes(normalised);
}

function isAttributableReviewer(reviewer: string | null): boolean {
  return isAttributableName(reviewer);
}

function evaluateSource(source: SourceRecord, index: number): string[] {
  const failures: string[] = [];
  const label = `source ${index + 1} (${source.publisher})`;

  if (!source.exactUrl && !source.documentReference) {
    failures.push(`${label}: no exact URL or document reference.`);
  }
  if (source.exactUrl && isOrganisationHomepageUrl(source.exactUrl)) {
    failures.push(
      `${label}: reference is an organisation homepage, which cannot establish a specific fact.`
    );
  }
  if (!source.supportingNote || source.supportingNote.trim().length === 0) {
    failures.push(`${label}: no supporting excerpt or research note recorded.`);
  }
  if (!source.accessDate) {
    failures.push(`${label}: no access date recorded.`);
  }
  if (!source.locationInSource) {
    failures.push(`${label}: no page or section recorded within the source.`);
  }
  return failures;
}

/**
 * The two-independent-sources rule and the per-source conditions, as one check.
 *
 * Exported because the same rule governs a locality-to-postcode pairing
 * (Requirement 12.4), which is held in an internal register rather than in this
 * ledger. Reusing the function rather than restating the rule means a pairing
 * cannot be admitted on evidence a claim would be rejected for.
 */
export function evaluateSourceIndependence(sources: readonly SourceRecord[]): readonly string[] {
  const failures: string[] = [];

  if (sources.length < 2) {
    failures.push(
      `Only ${sources.length} source(s) recorded; the gate requires two independent sources.`
    );
  }

  const independenceGroups = new Set(
    sources.map((source) => source.independenceGroup.trim().toLowerCase())
  );
  if (independenceGroups.size < 2) {
    failures.push(
      'Sources are not independent: two references controlled by the same publisher do not corroborate each other.'
    );
  }

  sources.forEach((source, index) => {
    failures.push(...evaluateSource(source, index));
  });

  return failures;
}

/**
 * Evaluate one claim against the project gate.
 *
 * @param claim the claim to evaluate
 * @param now evaluation date, injectable so expiry behaviour is testable
 */
export function evaluateClaim(claim: ClaimRecord, now: Date = new Date()): ClaimEvaluation {
  const failures: string[] = [];

  if (claim.approvalStatus !== 'approved') {
    failures.push(`Approval status is "${claim.approvalStatus}", not "approved".`);
  }

  if (!isAttributableReviewer(claim.reviewer)) {
    failures.push(
      claim.reviewer
        ? `Reviewer "${claim.reviewer}" is not a real named person accountable for the sign-off.`
        : 'No named reviewer recorded.'
    );
  }

  if (!claim.reviewDate) {
    failures.push('No review date recorded.');
  }

  if (claim.recheckBy) {
    const recheck = new Date(claim.recheckBy);
    if (!Number.isNaN(recheck.getTime()) && recheck.getTime() < now.getTime()) {
      failures.push(`Evidence expired on ${claim.recheckBy} and needs a recheck.`);
    }
  }

  failures.push(...evaluateSourceIndependence(claim.sources));

  return { claimId: claim.claimId, eligible: failures.length === 0, failures };
}

/**
 * The live claim ledger.
 *
 * Every entry below was created during the M0/M4 audit of the locality records
 * that the repository previously marked "published". None of them currently
 * passes the gate. They are retained — rather than deleted — so the exact
 * evidence gap is visible to whoever does the real research.
 *
 * The sources listed are the references the previous implementation actually
 * cited. They are recorded honestly: organisation homepages, with no access
 * date, no location within the source, and no supporting excerpt. That is
 * precisely why each claim fails.
 */
export const CLAIM_LEDGER: readonly ClaimRecord[] = [
  {
    claimId: 'CLM-IND-TRANSIT-001',
    claimText:
      'Namma Metro Purple Line passenger service is operational at Indiranagar and Swami Vivekananda Road stations.',
    sources: [
      {
        publisher: 'Bangalore Metro Rail Corporation Limited (BMRCL)',
        independenceGroup: 'bmrcl',
        exactUrl: 'https://english.bmrc.co.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes: null,
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap:
      'Single publisher, homepage-level reference only. Needs the specific BMRCL network/station page plus independent corroboration, each with access date and excerpt.',
  },
  {
    claimId: 'CLM-IND-WARD-001',
    claimText:
      'Indiranagar falls under BBMP East Zone, wards 80 (Hoysala Nagar) and 89 (Jogupalya).',
    sources: [
      {
        publisher: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
        independenceGroup: 'bbmp',
        exactUrl: 'https://bbmp.gov.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes:
      'Ward numbering and zone names change with delimitation and with the Greater Bengaluru Authority reorganisation. A dated boundary version is required, not a homepage.',
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap:
      'Needs the dated delimitation notification naming these ward numbers, plus independent corroboration. Boundary version must be recorded.',
  },
  {
    claimId: 'CLM-IND-LAYOUT-001',
    claimText: 'Indiranagar was developed as a planned BDA residential layout scheme.',
    sources: [
      {
        publisher: 'Bangalore Development Authority (BDA)',
        independenceGroup: 'bda',
        exactUrl: 'https://bdabangalore.org',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes:
      'The previous copy also asserted establishment "in the late 1960s". No source was recorded for that date at all.',
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap:
      'Needs a specific BDA layout record and an independent source. The founding-decade claim has no evidence and is removed from the record.',
  },
  {
    claimId: 'CLM-KOR-WARD-001',
    claimText: 'Koramangala falls under BBMP South Zone, ward 151.',
    sources: [
      {
        publisher: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
        independenceGroup: 'bbmp',
        exactUrl: 'https://bbmp.gov.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes: null,
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap: 'Homepage reference, single publisher, no access date or excerpt.',
  },
  {
    claimId: 'CLM-KOR-TRANSIT-001',
    claimText:
      'A Namma Metro Yellow Line and the Central Silk Board interchange are under construction near Koramangala.',
    sources: [
      {
        publisher: 'Bangalore Metro Rail Corporation Limited (BMRCL)',
        independenceGroup: 'bmrcl',
        exactUrl: 'https://english.bmrc.co.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes:
      'Project status is time-sensitive. The previous copy said "in commissioning and testing"; that is a dated operational state which must not be published from memory.',
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap:
      'Needs a dated BMRCL status bulletin plus independent corroboration, and the page must not present planned or testing infrastructure as operational.',
  },
  {
    claimId: 'CLM-SAD-WARD-001',
    claimText: 'Sadashivanagar falls under BBMP West Zone, ward 35 (Aramane Nagar).',
    sources: [
      {
        publisher: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
        independenceGroup: 'bbmp',
        exactUrl: 'https://bbmp.gov.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes: null,
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap: 'Homepage reference, single publisher, no access date or excerpt.',
  },
  {
    claimId: 'CLM-SAD-HERITAGE-001',
    claimText:
      'Tree protection and buffer regulations apply around the Sankey Tank precinct.',
    sources: [
      {
        publisher: 'Government of Karnataka',
        independenceGroup: 'karnataka-government',
        exactUrl: 'https://karnataka.gov.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes:
      'The previous copy also described the area as a "heritage precinct" with "heritage zoning setbacks". No source established a statutory heritage designation. Such a claim affects buyers materially and needs the actual notification.',
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap:
      'Needs the actual notification or regulation text with section reference, plus independent corroboration. Any heritage-zoning or setback claim must be evidenced separately.',
  },
  {
    claimId: 'CLM-HEB-TRANSIT-001',
    claimText:
      'A Namma Metro airport link is under construction along the Bellary Road / NH 44 alignment.',
    sources: [
      {
        publisher: 'Bangalore Metro Rail Corporation Limited (BMRCL)',
        independenceGroup: 'bmrcl',
        exactUrl: 'https://english.bmrc.co.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
      {
        publisher: 'National Highways Authority of India (NHAI)',
        independenceGroup: 'nhai',
        exactUrl: 'https://nhai.gov.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes:
      'These two sources support different claims. The NHAI reference was cited for expressway status, not for the metro alignment, so it does not corroborate the metro claim even though it is a different publisher.',
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap:
      'Two publishers are present but neither reference is specific, and the NHAI source does not address the metro claim. Needs exact alignment documents for this claim alone.',
  },
  {
    claimId: 'CLM-WHF-TRANSIT-001',
    claimText:
      'Namma Metro Purple Line passenger service extends to Whitefield (Kadugodi).',
    sources: [
      {
        publisher: 'Bangalore Metro Rail Corporation Limited (BMRCL)',
        independenceGroup: 'bmrcl',
        exactUrl: 'https://english.bmrc.co.in',
        documentReference: null,
        locationInSource: null,
        publicationDate: null,
        accessDate: null,
        supportingNote: null,
        reuseRights: 'unknown',
      },
    ],
    reviewer: null,
    reviewDate: null,
    conflictingEvidenceNotes: null,
    approvalStatus: 'research',
    recheckBy: null,
    usedByRoutes: [],
    evidenceGap: 'Single publisher, homepage-level reference only.',
  },
] as const;

const CLAIM_BY_ID = new Map(CLAIM_LEDGER.map((claim) => [claim.claimId, claim]));

export function getClaim(claimId: string): ClaimRecord | undefined {
  return CLAIM_BY_ID.get(claimId);
}

/**
 * Evaluate a set of claim IDs. A missing claim ID is a failure, not a pass —
 * otherwise a typo in a content record would silently publish an unsupported
 * section.
 */
export function evaluateClaims(
  claimIds: readonly string[],
  now: Date = new Date()
): { eligible: boolean; failures: readonly string[] } {
  const failures: string[] = [];

  for (const claimId of claimIds) {
    const claim = getClaim(claimId);
    if (!claim) {
      failures.push(`${claimId}: no such claim in the ledger.`);
      continue;
    }
    const evaluation = evaluateClaim(claim, now);
    if (!evaluation.eligible) {
      failures.push(...evaluation.failures.map((reason) => `${claimId}: ${reason}`));
    }
  }

  return { eligible: failures.length === 0, failures };
}
