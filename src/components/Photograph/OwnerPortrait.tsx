/**
 * The owner portrait pathway — Requirements 10.8 and 10.9, blocked on checklist C7.
 *
 * `OWNER_PROFILE.portrait` is null. C7 asks the owner for a real photograph of
 * Utpal Raj KB together with permission to use it; until that arrives,
 * `/about/utpal-raj-kb` carries the supplied name and role as text and nothing
 * else. Requirement 10.9 is the rule that matters here and it is absolute: no image
 * element and no image placeholder. Not a grey square, not an initialled circle,
 * not an outline of a head — a reader who sees a shape where a face should be has
 * been told something about the business that is not true.
 *
 * So the decision is a function, `ownerPortraitPresentation`, and its two outcomes
 * are the only two there are: the recorded photograph, or the text treatment that
 * the page already renders. There is no third branch to fill in later.
 *
 * What a recorded portrait has to satisfy before it renders, over and above the
 * provenance every asset needs:
 *
 *  - a written person release (Requirement 10.3). A portrait always shows a
 *    recognisable face, so the release is not conditional on a flag: an entry that
 *    records no release, or records one that has expired, or records one naming
 *    somebody else, renders nothing.
 *  - alt text naming Utpal Raj KB, 1 to 125 characters (Requirement 10.8). A
 *    portrait with a generic accessible name is a portrait of nobody.
 *  - a recorded permitted use, so the release says what it permits rather than
 *    existing as a date.
 *
 * Each refusal is returned by name, because a portrait held back for an unrecorded
 * release and a portrait held back because the release expired are different
 * problems with different owners.
 */

import React from 'react';

import { OWNER_PROFILE } from '@/config/owner';
import {
  type PhotographAsset,
  ALT_TEXT_MAX_LENGTH,
  ALT_TEXT_MIN_LENGTH,
  OWNER_PORTRAIT_CHECKLIST_ENTRY,
  evaluateAsset,
} from '@/config/media-register';

import { Photograph } from './Photograph';

/** C7: a portrait of Utpal Raj KB, with permission and a written release. */
export const OWNER_PORTRAIT_BLOCKED_BY = OWNER_PORTRAIT_CHECKLIST_ENTRY;

export type OwnerPortraitPresentation =
  | {
      readonly kind: 'photograph';
      readonly asset: PhotographAsset;
      /** The accessible name the element will carry. */
      readonly altText: string;
    }
  | {
      readonly kind: 'text-treatment';
      /** Every reason the portrait is not rendered, by name. */
      readonly reasons: readonly string[];
      /** The checklist entry that answers them. */
      readonly blockedBy: string;
    };

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(value: string | null): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const trimmed = value.trim();
  const parsed = new Date(CALENDAR_DATE.test(trimmed) ? `${trimmed}T00:00:00.000Z` : trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function namesTheOwner(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.toLowerCase().includes(OWNER_PROFILE.name.toLowerCase());
}

/**
 * What `/about/utpal-raj-kb` shows for the portrait at `now`.
 *
 * Pure, so the page's behaviour either side of C7 is a value a test can read
 * rather than markup it has to interpret.
 */
export function ownerPortraitPresentation(
  now: Date = new Date(),
  /**
   * The recorded portrait. Defaults to the one the register holds, which is null
   * while C7 is unanswered.
   *
   * It is a parameter so that the behaviour on the other side of C7 can be run
   * rather than described: `tests/photograph-pathway.test.tsx` passes a released
   * portrait and a set of refused ones, and reads what each produces. The page
   * passes nothing and gets `OWNER_PROFILE.portrait`, so the default is the only
   * value any public route can reach.
   */
  portrait: PhotographAsset | null = OWNER_PROFILE.portrait
): OwnerPortraitPresentation {
  const asset = portrait;
  const blockedBy = OWNER_PORTRAIT_BLOCKED_BY;

  if (!asset) {
    return {
      kind: 'text-treatment',
      reasons: [`No portrait of ${OWNER_PROFILE.name} is recorded in the Media_Register.`],
      blockedBy,
    };
  }

  const reasons: string[] = [...evaluateAsset(asset, now).failures];
  const label = `Portrait ${asset.assetId}`;

  const release = asset.personRelease;
  if (!release) {
    reasons.push(`${label}: no written person release is recorded, and a portrait always shows a face.`);
  } else {
    if (!namesTheOwner(release.personName)) {
      reasons.push(`${label}: the release names "${release.personName}", not ${OWNER_PROFILE.name}.`);
    }
    if (release.permittedUses.length === 0) {
      reasons.push(`${label}: the release records no permitted use.`);
    }
    if (!asDate(release.releasedOn)) {
      reasons.push(`${label}: the release records no date.`);
    }
    const expiry = asDate(release.expiresOn);
    if (release.expiresOn !== null && !expiry) {
      reasons.push(`${label}: release expiry "${release.expiresOn}" is not a date.`);
    } else if (expiry && now.getTime() >= expiry.getTime()) {
      reasons.push(`${label}: the person release expired on ${release.expiresOn}.`);
    }
  }

  const altText = asset.altText?.trim() ?? '';
  if (altText.length < ALT_TEXT_MIN_LENGTH || altText.length > ALT_TEXT_MAX_LENGTH) {
    reasons.push(
      `${label}: alt text is ${altText.length} characters; ${ALT_TEXT_MIN_LENGTH} to ${ALT_TEXT_MAX_LENGTH} are permitted, and a portrait is never decorative.`
    );
  } else if (!namesTheOwner(altText)) {
    reasons.push(`${label}: alt text does not name ${OWNER_PROFILE.name}.`);
  }

  if (reasons.length > 0) return { kind: 'text-treatment', reasons, blockedBy };
  return { kind: 'photograph', asset, altText };
}

/**
 * The portrait on `/about/utpal-raj-kb`, or nothing.
 *
 * Nothing is the state today and it is not a degraded state: the page's text
 * treatment — the name, the role, the contact line — is the whole of what has been
 * supplied, and it stands alone without a gap where a picture would go.
 */
export function OwnerPortrait({
  now = new Date(),
  portrait = OWNER_PROFILE.portrait,
}: { readonly now?: Date; readonly portrait?: PhotographAsset | null } = {}) {
  const presentation = ownerPortraitPresentation(now, portrait);
  if (presentation.kind !== 'photograph') return null;
  return <Photograph asset={presentation.asset} now={now} />;
}
