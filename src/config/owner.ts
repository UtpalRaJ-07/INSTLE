/**
 * Approved owner facts for INSTLE REAL ESTATE.
 *
 * Everything in this file is limited to what the owner actually supplied.
 * Master prompt section 03:
 *   "Do not invent his education, employment history, professional registration,
 *    achievements, transaction record, team size, personal values as quotations,
 *    community roles, or affiliations."
 *
 * Adding a field here without an owner-supplied value is a truthfulness breach.
 * `null` means "not supplied"; the UI omits the section entirely rather than
 * rendering a "Coming soon" placeholder.
 */

import { CANONICAL_BRAND } from './constants';
import type { PhotographAsset } from './media-register';

export interface OwnerProfile {
  /** Exact name as supplied by the owner. */
  name: string;
  /** Exact role as supplied by the owner. */
  role: string;
  /** Route for the dedicated profile page. */
  route: string;
  /**
   * Approved portrait, as a Media_Register entry — Requirement 10.8, blocked on
   * checklist C7.
   *
   * Null until the owner supplies a real photograph with permission, and a
   * `PhotographAsset` rather than a loose source-and-alt pair once he does, so the
   * creator, the licence, the permission to adapt, the acquisition date and the
   * written person release all have to be recorded before anything can render it.
   * A portrait must never be generated, and the four-field shape this used to hold
   * had nowhere to record the release that makes a real one publishable.
   */
  portrait: PhotographAsset | null;
  /** Approved biography paragraphs. Empty until supplied and approved. */
  biographyParagraphs: readonly string[];
  /** Verified public profile URLs for schema `sameAs`. Empty until supplied. */
  verifiedProfileUrls: readonly string[];
  /** Facts explicitly NOT established, recorded so nobody re-adds them later. */
  notEstablished: readonly string[];
}

export const OWNER_PROFILE: OwnerProfile = {
  name: 'Utpal Raj KB',
  role: `Owner and CEO, ${CANONICAL_BRAND}`,
  route: '/about/utpal-raj-kb',
  portrait: null,
  biographyParagraphs: [],
  verifiedProfileUrls: [],
  notEstablished: [
    'Founder status — the supplied title is Owner and CEO; "founder" was not confirmed.',
    'Legal entity type, incorporation, statutory directorship, or founding date.',
    'Education, employment history, professional registration or certification.',
    'Awards, press coverage, transaction record, or years in business.',
    'Team size, office locations, or community and industry affiliations.',
    'Portrait photograph and any quoted personal statement.',
  ],
} as const;

/**
 * The one-sentence introduction proposed by the master prompt, section 03.
 * Kept as a constant so the wording cannot drift into invented credentials.
 */
export const OWNER_INTRODUCTION = `${OWNER_PROFILE.name} is the owner and CEO of ${CANONICAL_BRAND}.`;

/** Proposed contact copy from the master prompt, section 03. */
export const OWNER_CONTACT_COPY =
  'Call 9353096264 to discuss your property requirement with the team.';

/** True when there is enough approved material for a biography section. */
export function hasApprovedBiography(): boolean {
  return OWNER_PROFILE.biographyParagraphs.length > 0;
}
