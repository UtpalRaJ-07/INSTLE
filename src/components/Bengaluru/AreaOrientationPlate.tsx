/**
 * AreaOrientationPlate — one locality as a plate, with the areas around it.
 *
 * The record's own area sits in a wide plate across the middle; two to four
 * approved neighbours sit in a row above it and a row below it; a corridor line
 * joins each neighbour to the centre with a marker at its midpoint. That is the
 * whole drawing. It answers "what is this place next to", which is the question a
 * reader who does not know the city actually has.
 *
 * The layout is two columns rather than a compass rose on purpose. A plate is
 * mostly text, and SVG text shrinks with the drawing: laid out wide, a 320px
 * screen set the neighbour names at about four pixels. Two columns keep the
 * viewBox narrow, so the same names render at roughly eleven pixels on the
 * smallest screen, and a name that does not fit on one line wraps onto a second
 * rather than shrinking to nothing. Every neighbour label is set at one shared
 * size, so no plate looks more important than another because its name is short.
 *
 * What it deliberately does not do:
 *
 *  - No boundary. Requirement 9.3 allows one only from a claim that has passed the
 *    claim gate, and a claim carries a ward or zone *value*, not a shape. Drawing
 *    an outline would mean inventing geometry no source supplied, so the
 *    administrative value and its boundary version render as page text instead and
 *    the register records `boundaryClaimId: null`.
 *  - No commute time, no distance, no scale. The plates are equal-sized boxes in
 *    fixed positions; their arrangement carries no direction and no separation —
 *    above and below mean nothing geographic. The register's literal `false`
 *    fields make the claim uncompilable.
 *  - Nothing below two neighbours. With fewer, there is nothing to orient against,
 *    and Requirement 9.15 says the page then renders the typographic treatment
 *    alone rather than an emptier version of this drawing.
 *
 * Renders on no page today, because no locality record passes the publication
 * gate. It is tested directly instead of being left until a record publishes.
 */

import React from 'react';
import {
  MAX_NEIGHBOUR_PLATES,
  MIN_NEIGHBOUR_PLATES,
  buildAreaOrientationAsset,
  hasEnoughNeighboursToDraw,
  requireRenderableAsset,
} from '@/config/media-register';
import { resolveLocalitySlug, type LocalityRecord, type NearbyRelationship } from '@/config/localities';
import { AssetFigure, drawingProps } from './AssetFrame';
import styles from './Bengaluru.module.css';

// ---------------------------------------------------------------------------
// Geometry, in viewBox units
// ---------------------------------------------------------------------------

/** The drawing's box. The register's intrinsic width and height match it. */
export const PLATE_VIEWBOX_WIDTH = 480;
export const PLATE_VIEWBOX_HEIGHT = 392;

const MARGIN = 12;
const COLUMN_GAP = 16;
const INNER_WIDTH = PLATE_VIEWBOX_WIDTH - MARGIN * 2;

/** A neighbour plate: half the inner width, less half the gap. */
const NEIGHBOUR_WIDTH = (INNER_WIDTH - COLUMN_GAP) / 2;
const NEIGHBOUR_HEIGHT = 84;

/** The centre plate spans the inner width. */
const CENTRE_X = MARGIN;
const CENTRE_WIDTH = INNER_WIDTH;
const CENTRE_HEIGHT = 104;

/** Vertical rhythm: row, corridor, centre, corridor, row. */
const TOP_ROW_Y = 16;
const CORRIDOR_LENGTH = 44;
const CENTRE_Y = TOP_ROW_Y + NEIGHBOUR_HEIGHT + CORRIDOR_LENGTH;
const BOTTOM_ROW_Y = CENTRE_Y + CENTRE_HEIGHT + CORRIDOR_LENGTH;

/** Horizontal padding inside a plate, each side, that a label keeps clear of. */
const LABEL_PADDING = 12;

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/**
 * How a label is set, per role.
 *
 * `emPerCharacter` is a deliberately generous estimate of the average advance of
 * a system sans-serif character: 0.55 em for regular, 0.6 em for the bold centre.
 * Overestimating costs a point of size; underestimating lets a name run out of
 * its plate, so the estimate leans the safe way.
 */
export const PLATE_LABEL_STYLE = {
  centre: { preferred: 24, minimum: 15, emPerCharacter: 0.6 },
  neighbour: { preferred: 22, minimum: 14, emPerCharacter: 0.55 },
} as const;

export type PlateLabelRole = keyof typeof PLATE_LABEL_STYLE;

export interface PlateLabelLayout {
  readonly lines: readonly string[];
  readonly fontSize: number;
}

/** The two-line split that keeps the longer line as short as possible. */
function balancedSplit(words: readonly string[]): readonly string[] {
  let best: readonly string[] = [words.join(' ')];
  let bestLongest = best[0]!.length;
  for (let at = 1; at < words.length; at += 1) {
    const first = words.slice(0, at).join(' ');
    const second = words.slice(at).join(' ');
    const longest = Math.max(first.length, second.length);
    if (longest < bestLongest) {
      best = [first, second];
      bestLongest = longest;
    }
  }
  return best;
}

/**
 * The lines and size that keep a name inside a plate of the given width.
 *
 * One line at the preferred size when it fits. Otherwise the name is split into
 * two balanced lines, and only if the longer of those still does not fit is the
 * size reduced, never below the role's minimum. Bengaluru area names run from
 * "Hebbal" to "Whitefield (inner residential enclaves)", so neither a fixed size
 * nor a single line would serve both ends.
 */
export function plateLabelLayout(text: string, plateWidth: number, role: PlateLabelRole): PlateLabelLayout {
  const style = PLATE_LABEL_STYLE[role];
  const name = text.trim().replace(/\s+/g, ' ');
  const usable = plateWidth - LABEL_PADDING * 2;
  const fits = (line: string, size: number) => line.length * style.emPerCharacter * size <= usable;
  const fittedSize = (lines: readonly string[]) => {
    const longest = Math.max(1, ...lines.map((line) => line.length));
    const size = Math.floor(usable / (longest * style.emPerCharacter));
    return Math.max(style.minimum, Math.min(style.preferred, size));
  };

  if (fits(name, style.preferred)) {
    return { lines: [name], fontSize: style.preferred };
  }

  const lines = balancedSplit(name.split(' '));
  return { lines, fontSize: fittedSize(lines) };
}

/**
 * A relationship as the locality page hands it over: narrowed to a neighbour the
 * page may link, and carrying that neighbour's name.
 *
 * `renderableNearbyRelationships` resolves the alias, checks the destination is a
 * published area record at the request date, checks the adjacency claim passes the
 * claim gate, and puts the destination's canonical name on the relationship. The
 * name on the relationship is therefore a *gated* name, which is the only kind the
 * drawing may set.
 */
export type NamedNearbyRelationship = NearbyRelationship & { readonly name?: string };

/**
 * The name to set on a neighbour plate.
 *
 * Read off the relationship the page supplies, never looked up. The plate used to
 * search `LOCALITY_REGISTRY` for the name, which meant a component rendering a
 * public route held all 132 records including the 132 that fail the publication
 * gate — the import Requirement 12.10 forbids, and the reason it forbids it: a
 * lookup in the whole registry cannot tell a published name from an unpublished
 * one, so one careless caller would have set an unpublished area's name in a
 * drawing. `areaOrientationPlateRecord` already resolves each neighbour through the
 * gate and carries its name, so the name is there to be used.
 *
 * Falls back to the canonical slug when the relationship carries no name, which
 * means it did not come through the gate. The drawing does not invent a name, and
 * it does not reach past the page to find one.
 */
export function neighbourDisplayName(relationship: NamedNearbyRelationship): string {
  const name = relationship.name?.trim();
  return name && name.length > 0 ? name : resolveLocalitySlug(relationship.slug);
}

// ---------------------------------------------------------------------------
// Neighbour placement
// ---------------------------------------------------------------------------

interface NeighbourSlot {
  readonly x: number;
  readonly y: number;
  /** The corridor runs vertically at this x, from `fromY` to `toY`. */
  readonly corridorX: number;
  readonly fromY: number;
  readonly toY: number;
}

/** The x of each plate in a row holding `count` plates, centred as a group. */
function rowXs(count: number): number[] {
  if (count <= 1) return [MARGIN + (INNER_WIDTH - NEIGHBOUR_WIDTH) / 2];
  return [MARGIN, MARGIN + NEIGHBOUR_WIDTH + COLUMN_GAP];
}

/**
 * Where each neighbour goes. Neighbours alternate top and bottom — first, second
 * below, third beside the first, fourth beside the second — so two neighbours
 * give one above and one below, and three or four stay balanced about the centre.
 */
function neighbourSlots(count: number): NeighbourSlot[] {
  const top = Math.ceil(count / 2);
  const bottom = Math.floor(count / 2);
  const topXs = rowXs(top);
  const bottomXs = rowXs(bottom);
  const slots: NeighbourSlot[] = [];
  for (let index = 0; index < count; index += 1) {
    const above = index % 2 === 0;
    const x = (above ? topXs : bottomXs)[Math.floor(index / 2)]!;
    const corridorX = x + NEIGHBOUR_WIDTH / 2;
    slots.push(
      above
        ? { x, y: TOP_ROW_Y, corridorX, fromY: TOP_ROW_Y + NEIGHBOUR_HEIGHT, toY: CENTRE_Y }
        : { x, y: BOTTOM_ROW_Y, corridorX, fromY: CENTRE_Y + CENTRE_HEIGHT, toY: BOTTOM_ROW_Y }
    );
  }
  return slots;
}

/** One label, centred on a point, one `tspan` per line. */
function PlateLabel({
  layout,
  cx,
  cy,
  className,
}: {
  layout: PlateLabelLayout;
  cx: number;
  cy: number;
  className: string;
}) {
  const lineHeight = Math.round(layout.fontSize * 1.2);
  // 0.35 em lifts an alphabetic baseline to sit a line's x-height on the centre.
  const firstBaseline = cy - ((layout.lines.length - 1) * lineHeight) / 2 + Math.round(layout.fontSize * 0.35);
  return (
    <text textAnchor="middle" className={className} fontSize={layout.fontSize} fill="currentColor">
      {layout.lines.map((line, index) => (
        <tspan key={index} x={cx} y={firstBaseline + index * lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/**
 * Draws exactly the record it is given. The locality page gives it
 * `areaOrientationPlateRecord(record, now)` — the neighbours it may link — and
 * only after `canRenderAreaOrientationPlate` has said there are enough of them.
 */
export function AreaOrientationPlate({ record }: { record: LocalityRecord }) {
  if (!hasEnoughNeighboursToDraw(record.approvedNearbyRelationships)) {
    throw new Error(
      `AreaOrientationPlate: ${record.slug} carries ${record.approvedNearbyRelationships.length} approved ` +
        `nearby relationships; ${MIN_NEIGHBOUR_PLATES} to ${MAX_NEIGHBOUR_PLATES} are needed. ` +
        'Render TypographicPlate instead.'
    );
  }

  const asset = requireRenderableAsset(buildAreaOrientationAsset(record));
  const names = record.approvedNearbyRelationships.slice(0, MAX_NEIGHBOUR_PLATES).map(neighbourDisplayName);
  const slots = neighbourSlots(names.length);

  // One size for every neighbour, the smallest any of them needs.
  const neighbourLayouts = names.map((name) => plateLabelLayout(name, NEIGHBOUR_WIDTH, 'neighbour'));
  const neighbourSize = Math.min(...neighbourLayouts.map((layout) => layout.fontSize));
  const neighbours = names.map((name, index) => ({
    key: `${index}-${name}`,
    slot: slots[index]!,
    layout: { lines: neighbourLayouts[index]!.lines, fontSize: neighbourSize },
  }));
  const centreLayout = plateLabelLayout(record.canonicalName, CENTRE_WIDTH, 'centre');

  const centreRight = CENTRE_X + CENTRE_WIDTH;
  const centreBottom = CENTRE_Y + CENTRE_HEIGHT;

  return (
    <AssetFigure asset={asset}>
      <svg
        {...drawingProps(asset, `0 0 ${PLATE_VIEWBOX_WIDTH} ${PLATE_VIEWBOX_HEIGHT}`, {
          className: styles.plateMap,
        })}
      >
        <rect x="0" y="0" width={PLATE_VIEWBOX_WIDTH} height={PLATE_VIEWBOX_HEIGHT} fill="var(--color-paper-raised)" />

        {/* Corridor lines, each with a plain marker at its midpoint. */}
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="3" strokeLinecap="round">
          {neighbours.map(({ key, slot }) => (
            <path key={key} d={`M ${slot.corridorX} ${slot.fromY} V ${slot.toY}`} />
          ))}
        </g>
        <g stroke="var(--color-city-blue)" strokeWidth="2" fill="var(--color-paper-raised)">
          {neighbours.map(({ key, slot }) => (
            <circle key={key} cx={slot.corridorX} cy={(slot.fromY + slot.toY) / 2} r="6" />
          ))}
        </g>

        {/* Neighbour plates. */}
        <g stroke="currentColor" strokeWidth="1.6" fill="var(--color-background-elevated)">
          {neighbours.map(({ key, slot }) => (
            <rect key={key} x={slot.x} y={slot.y} width={NEIGHBOUR_WIDTH} height={NEIGHBOUR_HEIGHT} rx="8" />
          ))}
        </g>

        {/* The record's own plate, heavier, and marked with the one accent in the
            drawing so a reader knows which plate is the page they are on. */}
        <rect
          x={CENTRE_X}
          y={CENTRE_Y}
          width={CENTRE_WIDTH}
          height={CENTRE_HEIGHT}
          rx="10"
          stroke="currentColor"
          strokeWidth="2.6"
          fill="var(--color-paper-raised)"
        />
        <g fill="none" stroke="var(--color-accent)" strokeWidth="3.4" strokeLinecap="round">
          <path d={`M ${CENTRE_X + 22} ${CENTRE_Y} H ${CENTRE_X} V ${CENTRE_Y + 22}`} />
          <path d={`M ${centreRight - 22} ${centreBottom} H ${centreRight} V ${centreBottom - 22}`} />
        </g>

        <PlateLabel
          layout={centreLayout}
          cx={CENTRE_X + CENTRE_WIDTH / 2}
          cy={CENTRE_Y + CENTRE_HEIGHT / 2}
          className={styles.plateLabelCentre}
        />
        {neighbours.map(({ key, slot, layout }) => (
          <PlateLabel
            key={key}
            layout={layout}
            cx={slot.x + NEIGHBOUR_WIDTH / 2}
            cy={slot.y + NEIGHBOUR_HEIGHT / 2}
            className={styles.plateLabelNeighbour}
          />
        ))}
      </svg>
    </AssetFigure>
  );
}
