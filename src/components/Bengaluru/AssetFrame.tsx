/**
 * The frame every Bengaluru drawing renders inside, and the attributes every one
 * of them carries.
 *
 * This is not one of the five subjects. It exists so that three things cannot be
 * forgotten on a new drawing:
 *
 *  - the visible label. Requirement 9.3 needs a map labelled an orientation aid
 *    and Requirement 9.4 needs an illustration labelled an illustration, both in
 *    the same section as the asset. The label text is read from the Media_Register
 *    entry rather than written into the page, so the recorded label and the
 *    rendered label cannot drift apart.
 *  - the intrinsic width and height, and the accessible name or the empty-alt
 *    equivalent. Requirement 9.16.
 *  - `data-asset-id`, which is how `scripts/measure-visual-assets.mjs` finds the
 *    markup in the built HTML and weighs it against the budget. Without it the
 *    budget would be measured from the source rather than from what is served.
 */

import React from 'react';
import type { VisualAssetRecord } from '@/config/media-register';
import styles from './Bengaluru.module.css';

/** The label a reader sees for this asset, from the register entry. */
export function visibleAssetLabel(asset: VisualAssetRecord): string | null {
  switch (asset.kind) {
    case 'illustration':
      return asset.illustrationLabel;
    case 'map':
      return asset.orientationAidLabel;
    default:
      return null;
  }
}

export interface DrawingProps {
  readonly className: string;
  readonly viewBox: string;
  readonly width: number;
  readonly height: number;
  readonly xmlns: string;
  readonly preserveAspectRatio?: string;
  readonly 'data-asset-id': string;
  readonly role?: 'img';
  readonly 'aria-label'?: string;
  readonly 'aria-hidden'?: true;
}

export interface DrawingOptions {
  /** An extra class, appended to the shared drawing class. */
  readonly className?: string;
  /**
   * How the drawing fits a box whose shape differs from its viewBox. Only matters
   * where CSS gives the element another aspect ratio: the street band on a narrow
   * screen, and the texture behind the typographic plate. `slice` keeps every
   * line at its drawn proportion instead of stretching it.
   */
  readonly preserveAspectRatio?: 'xMidYMid meet' | 'xMidYMid slice';
}

/**
 * The attributes the `<svg>` element carries.
 *
 * A decorative asset is hidden from assistive technology, which is the inline-SVG
 * equivalent of the empty alt attribute Requirement 9.16 permits. Anything else
 * carries the recorded alt text as its accessible name, exposed as one image so a
 * screen reader announces the name once rather than walking a hundred shapes.
 *
 * The intrinsic width and height stay on the element so the browser reserves the
 * right aspect ratio before layout; the stylesheet then sets `width: 100%` and
 * `height: auto`, so no drawing ever imposes a pixel width on a 320px screen.
 */
export function drawingProps(
  asset: VisualAssetRecord,
  viewBox: string,
  options: DrawingOptions = {}
): DrawingProps {
  const base = {
    className: options.className ? `${styles.drawing} ${options.className}` : styles.drawing,
    viewBox,
    width: asset.intrinsicWidth,
    height: asset.intrinsicHeight,
    xmlns: 'http://www.w3.org/2000/svg',
    ...(options.preserveAspectRatio ? { preserveAspectRatio: options.preserveAspectRatio } : {}),
    'data-asset-id': asset.assetId,
  } as const;

  return asset.decorative
    ? { ...base, 'aria-hidden': true }
    : { ...base, role: 'img', 'aria-label': asset.altText ?? '' };
}

export function AssetFigure({
  asset,
  children,
}: {
  asset: VisualAssetRecord;
  children: React.ReactNode;
}) {
  const label = visibleAssetLabel(asset);
  return (
    <figure className={styles.figure}>
      <div className={styles.frame}>{children}</div>
      {label ? <figcaption className={styles.caption}>{label}</figcaption> : null}
    </figure>
  );
}
