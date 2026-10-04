/**
 * The photograph rendering pathway — Requirement 10, blocked on checklist C12.
 *
 * This file is the one place in `src/` that constructs an image element, and it is
 * deliberately the whole of that permission. Everything about it is built and
 * switched off: the Media_Register holds no `PhotographAsset`, because no
 * rights-cleared Bengaluru photography has been supplied under Owner_Input_Register
 * C12, so every call below returns nothing and no public page carries an image.
 *
 * What the component will not do, ever:
 *
 *  - render a placeholder, an empty frame or a substitute graphic when there is no
 *    photograph. Requirement 9.15 is explicit, and Requirement 10.9 repeats it for
 *    the owner portrait. Nothing renders means nothing renders.
 *  - render a photograph the Media_Register has not cleared. `evaluateAsset` is
 *    called on every render with the request date, and a refusal returns null. A
 *    licence or a person release that expired yesterday stops rendering today
 *    without anybody editing this file (Requirement 10.11).
 *  - reach for `next/image`. That component rewrites the source into a request to
 *    an image optimiser, which is an external host by default and a build-time
 *    dependency on a service this site does not use. The intrinsic dimensions,
 *    lazy loading and fetch priority Requirement 10.4 and 10.5 ask for are all
 *    attributes on the element itself.
 *
 * Why the element is written out here rather than kept out of `src/` altogether:
 * the mechanism has to be real to be testable, and a pathway that exists only as a
 * description is a pathway nobody has run. `tests/photograph-pathway.test.tsx`
 * renders it against fixtures — valid, missing provenance, expired licence, expired
 * release, unreleased face, over-long alt text, caption carrying an offer — and
 * `tests/visual-identity.test.tsx` holds the asset policy scan that permits the
 * element in this file only, and only under the conditions recorded there.
 */

import React from 'react';

import {
  type PhotographAsset,
  type PhotographPageEntry,
  ALT_TEXT_MAX_LENGTH,
  PHOTOGRAPHY_CHECKLIST_ENTRY,
  evaluateAsset,
  evaluatePhotographPage,
} from '@/config/media-register';

import styles from './Photograph.module.css';

/**
 * The checklist entry that switches this pathway on, restated at the point of use
 * so a reader of this file does not have to go looking. C12: rights-cleared
 * Bengaluru photography.
 */
export const PHOTOGRAPH_PATHWAY_BLOCKED_BY = PHOTOGRAPHY_CHECKLIST_ENTRY;

export interface PhotographProps {
  /**
   * The register entry to render. Null means no photograph is recorded, which is
   * the state today and renders nothing at all.
   */
  readonly asset: PhotographAsset | null;
  /** The request date every expiry is measured against. */
  readonly now?: Date;
  /**
   * Requirement 10.5. At most one per page, and only the element the Requirement 9
   * measurement identifies as the largest contentful paint element at 390 px and
   * 1280 px. `evaluatePhotographPage` counts them; this flag only carries the
   * decision onto the element.
   */
  readonly priority?: boolean;
}

/**
 * A recorded photograph's source, or null when it is not a file.
 *
 * A photograph is a file under `/public`. `inline-svg` delivery describes a drawn
 * component, and a photograph cannot be one — so an entry recorded that way is a
 * mis-recorded entry and renders nothing rather than guessing at a path.
 */
function photographSource(asset: PhotographAsset): string | null {
  return asset.delivery.mode === 'file' ? asset.delivery.publicPath : null;
}

/**
 * The accessible name the element carries: the recorded alt text, or the empty
 * string where the register records the photograph decorative — Requirement 10.4's
 * two permitted forms, and no third one. `evaluateAsset` has already held the
 * recorded text to 1 to {@link ALT_TEXT_MAX_LENGTH} characters, so this reads the
 * cleared value rather than re-deciding it.
 */
function accessibleName(asset: PhotographAsset): string {
  return asset.decorative ? '' : (asset.altText ?? '');
}

/**
 * One photograph, rendered only when the Media_Register clears it at `now`.
 *
 * A server component: no client JavaScript, so a crawler that runs none still
 * receives the element and its accessible name.
 */
export function Photograph({ asset, now = new Date(), priority = false }: PhotographProps) {
  if (!asset) return null;
  if (!evaluateAsset(asset, now).renderable) return null;

  const source = photographSource(asset);
  if (!source) return null;

  const caption = asset.caption?.trim() ?? '';

  return (
    <figure className={styles.figure} data-asset-id={asset.assetId}>
      {/* eslint-disable-next-line @next/next/no-img-element -- see the file comment: the framework image component rewrites the source into a request to an optimiser this site does not run. Width and height are the encoded pixel dimensions the register records (Requirement 10.4). */}
      <img
        className={styles.photograph}
        src={source}
        width={asset.intrinsicWidth}
        height={asset.intrinsicHeight}
        alt={accessibleName(asset)}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
      />
      {caption.length > 0 ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Every photograph one page references, with the page bounds of Requirement 10.7
 * applied to the set before any of them renders.
 *
 * A page that breaks a bound renders none of its photographs rather than the first
 * six of seven, because "at most six" is a statement about the page and a page that
 * silently dropped the seventh would pass a check it had failed.
 */
export function PhotographSet({
  entries,
  now = new Date(),
}: {
  readonly entries: readonly PhotographPageEntry[];
  readonly now?: Date;
}) {
  if (entries.length === 0) return null;
  if (!evaluatePhotographPage(entries, now).renderable) return null;

  return (
    <>
      {entries.map((entry) => (
        <Photograph key={entry.asset.assetId} asset={entry.asset} now={now} priority={entry.priority} />
      ))}
    </>
  );
}
