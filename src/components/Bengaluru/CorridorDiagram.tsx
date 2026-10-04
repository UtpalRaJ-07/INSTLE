/**
 * CorridorDiagram — how Bengaluru is shaped, at the level of a sketch on paper.
 *
 * A ring road arc, open across the top; eight radial roads running out from a
 * plain centre marker, drawn only horizontally, vertically and at 45 degrees the
 * way a transit schematic is; interchange rings where the radials cross the ring;
 * and plain station markers along the radials. Nothing is named, nothing is
 * measured and nothing is to scale, which is the honest version of this drawing:
 * the repository holds no sourced geometry for a single Bengaluru road, so an
 * outline traced to look accurate would be an invented one. The spokes are evenly
 * spaced for the same reason — any other arrangement would be a claim about where
 * a real road runs.
 *
 * Requirement 9.3 in three parts. No external host, because the geometry is inline.
 * No commute time and no distance — the drawing carries no text at all, no scale
 * bar and no tick label, and the register records `showsCommuteTimes` and
 * `showsDistances` as literal `false` so an edit claiming otherwise will not
 * compile. No boundary and no filled zone, because no boundary claim has passed
 * the claim gate.
 *
 * Colours: `--color-forest` for the radials, `--color-city-blue` for the ring,
 * `currentColor` for the markers and `--color-accent` for the one centre dot. The
 * lines are drawn heavy on purpose: on a 320px screen this drawing renders at
 * about a third of its size, and a schematic whose lines vanish is no aid at all.
 */

import React from 'react';
import { CORRIDOR_ASSET_ID, requireRegisteredAsset } from '@/config/media-register';
import { AssetFigure, drawingProps } from './AssetFrame';

/** The centre of the schematic and the ring radius. */
const CX = 480;
const CY = 260;
const RING = 180;

/** Offset of a 45-degree point on the ring from the centre, on each axis. */
const DIAGONAL = Math.round((RING / Math.SQRT2) * 10) / 10;

/** Radial roads, as end points, clockwise from north. */
const RADIALS: readonly (readonly [number, number])[] = [
  [CX, 30],
  [CX + 226, CY - 226],
  [930, CY],
  [CX + 214, CY + 214],
  [CX, 494],
  [CX - 214, CY + 214],
  [30, CY],
  [CX - 226, CY - 226],
];

/** Where the ring crosses a radial. The north radial runs through the gap. */
const INTERCHANGES: readonly (readonly [number, number])[] = [
  [CX + DIAGONAL, CY - DIAGONAL],
  [CX + RING, CY],
  [CX + DIAGONAL, CY + DIAGONAL],
  [CX, CY + RING],
  [CX - DIAGONAL, CY + DIAGONAL],
  [CX - RING, CY],
  [CX - DIAGONAL, CY - DIAGONAL],
];

/** Plain station markers along the radials. No names, no numbers. */
const STATIONS: readonly (readonly [number, number])[] = [
  [CX, 170],
  [CX, 110],
  [CX, 56],
  [CX + 196, CY - 196],
  [CX + 90, CY],
  [770, CY],
  [860, CY],
  [CX + 64, CY + 64],
  [CX + 194, CY + 194],
  [CX, CY + 92],
  [CX, 474],
  [CX - 190, CY + 190],
  [CX - 92, CY],
  [190, CY],
  [96, CY],
  [CX - 200, CY - 200],
];

/** The ring's two open ends, 25 degrees either side of north. */
const RING_GAP = (25 * Math.PI) / 180;
const RING_START_X = Math.round((CX - RING * Math.sin(RING_GAP)) * 10) / 10;
const RING_END_X = Math.round((CX + RING * Math.sin(RING_GAP)) * 10) / 10;
const RING_END_Y = Math.round((CY - RING * Math.cos(RING_GAP)) * 10) / 10;

/**
 * The ring. The large-arc and sweep flags matter: `1 0` draws the long way round,
 * anticlockwise from the north-west end through west, south and east to the
 * north-east end, on the circle centred on the schematic.
 */
const RING_PATH = `M ${RING_START_X} ${RING_END_Y} A ${RING} ${RING} 0 1 0 ${RING_END_X} ${RING_END_Y}`;

export function CorridorDiagram() {
  const asset = requireRegisteredAsset(CORRIDOR_ASSET_ID);

  return (
    <AssetFigure asset={asset}>
      <svg {...drawingProps(asset, '0 0 960 520')}>
        <rect x="0" y="0" width="960" height="520" fill="var(--color-paper-raised)" />

        {/* Radial roads. */}
        <g fill="none" stroke="var(--color-forest)" strokeWidth="6" strokeLinecap="round">
          {RADIALS.map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M ${CX} ${CY} L ${x} ${y}`} />
          ))}
        </g>

        {/* The ring, as an arc rather than a closed circle: it is an impression of
            a ring road, and a closed circle would read as a claim about one. */}
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="9" strokeLinecap="round">
          <path d={RING_PATH} />
        </g>

        {/* Interchanges where a radial meets the ring, then the plain stations. */}
        <g stroke="currentColor" strokeWidth="3.5" fill="var(--color-paper-raised)">
          {INTERCHANGES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="12" />
          ))}
        </g>
        <g stroke="currentColor" strokeWidth="3" fill="var(--color-paper-raised)">
          {STATIONS.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7.5" />
          ))}
        </g>

        {/* Centre marker. A ring and a dot, no name: the reader supplies the city. */}
        <circle cx={CX} cy={CY} r="24" stroke="currentColor" strokeWidth="3.5" fill="var(--color-paper-raised)" />
        <circle cx={CX} cy={CY} r="11" fill="var(--color-accent)" />
      </svg>
    </AssetFigure>
  );
}
