/**
 * LayoutGridMotif — the geometry of a Bengaluru planned layout, as a texture.
 *
 * Blocks of sites laid out the way a plotted residential layout is: each block two
 * sites deep, back to back, with the site lines at a regular frontage; narrow
 * cross roads between the blocks and two wider main roads, each with a centre
 * line. One block is left open as a park with a circular path, and one is a single
 * large civic amenity site. It is the shape of a layout rather than any layout: no
 * block number, no site number, no road name and no measurement.
 *
 * Decorative, so it is hidden from assistive technology and the register records
 * `altText: null` — the texture carries nothing a reader loses by not seeing it.
 * Because a name is set over this texture by `TypographicPlate`, the register
 * declares both colours it presents behind that text, and the token test computes
 * the ratio for each. The line colour is `--color-stone`, which is deliberate: it
 * is the one palette colour that does not clear 3:1 against the surface, and it is
 * used here and nowhere else, because a decorative texture that competed with the
 * text over it would be the wrong way round.
 *
 * It fills whatever box it is given with `xMidYMid slice`, so the lines keep their
 * drawn proportions however tall the name above it wraps, instead of stretching.
 */

import React from 'react';
import { LAYOUT_GRID_ASSET_ID, requireRegisteredAsset } from '@/config/media-register';
import { drawingProps } from './AssetFrame';

const WIDTH = 1200;
const HEIGHT = 320;

/** Site frontage along a block, and the depth of one row of sites. */
const FRONTAGE = 20;
const DEPTH = 28;
const BLOCK_WIDTH = 140;
const BLOCK_HEIGHT = DEPTH * 2;

/** Gap after each block column: 12 for a cross road, 24 for a main road. */
const COLUMN_GAPS: readonly number[] = [12, 24, 12, 12, 24, 12, 12, 12];
/** Gap after each block row. */
const ROW_GAPS: readonly number[] = [12, 24, 12, 12, 12];

function offsets(start: number, size: number, gaps: readonly number[]): number[] {
  const out: number[] = [];
  let at = start;
  for (const gap of gaps) {
    out.push(at);
    at += size + gap;
  }
  return out;
}

/** The layout bleeds past every edge, so a crop never shows where it ends. */
const COLUMNS = offsets(-14, BLOCK_WIDTH, COLUMN_GAPS);
const ROWS = offsets(-10, BLOCK_HEIGHT, ROW_GAPS);

/** The two blocks that are not rows of sites. Column index, row index. */
const PARK: readonly [number, number] = [3, 2];
const CIVIC_AMENITY: readonly [number, number] = [6, 1];

/** Centre lines of the two main roads, in the wider gaps. */
const MAIN_ROAD_X = COLUMNS[1]! + BLOCK_WIDTH + 12;
const MAIN_ROAD_X_2 = COLUMNS[4]! + BLOCK_WIDTH + 12;
const MAIN_ROAD_Y = ROWS[1]! + BLOCK_HEIGHT + 12;

/** The back-to-back line and the site lines of one block, as one path. */
function siteLines(x: number, y: number): string {
  const parts = [`M ${x} ${y + DEPTH} H ${x + BLOCK_WIDTH}`];
  for (let at = x + FRONTAGE; at < x + BLOCK_WIDTH; at += FRONTAGE) {
    parts.push(`M ${at} ${y} V ${y + BLOCK_HEIGHT}`);
  }
  return parts.join(' ');
}

export function LayoutGridMotif({ className }: { className?: string }) {
  const asset = requireRegisteredAsset(LAYOUT_GRID_ASSET_ID);
  const blocks = ROWS.flatMap((y, row) => COLUMNS.map((x, column) => ({ x, y, row, column })));
  const isPark = (block: { row: number; column: number }) => block.column === PARK[0] && block.row === PARK[1];
  const isCivic = (block: { row: number; column: number }) =>
    block.column === CIVIC_AMENITY[0] && block.row === CIVIC_AMENITY[1];

  return (
    <svg
      {...drawingProps(asset, `0 0 ${WIDTH} ${HEIGHT}`, {
        className,
        preserveAspectRatio: 'xMidYMid slice',
      })}
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="var(--color-paper-raised)" />

      {/* Block outlines: the road edges are the gaps between them. */}
      <g fill="none" stroke="var(--color-stone)" strokeWidth="1.6">
        {blocks.map((block) => (
          <rect key={`b${block.x}-${block.y}`} x={block.x} y={block.y} width={BLOCK_WIDTH} height={BLOCK_HEIGHT} />
        ))}
      </g>

      {/* Site lines inside each block of sites. */}
      <g fill="none" stroke="var(--color-stone)" strokeWidth="1">
        <path
          d={blocks
            .filter((block) => !isPark(block) && !isCivic(block))
            .map((block) => siteLines(block.x, block.y))
            .join(' ')}
        />
      </g>

      {/* The park: a circular path, and the civic amenity site left whole. */}
      <g fill="none" stroke="var(--color-stone)" strokeWidth="1.4">
        {blocks.filter(isPark).map((block) => (
          <circle
            key={`p${block.x}`}
            cx={block.x + BLOCK_WIDTH / 2}
            cy={block.y + BLOCK_HEIGHT / 2}
            r={DEPTH - 8}
          />
        ))}
        {blocks.filter(isCivic).map((block) => (
          <rect key={`c${block.x}`} x={block.x + 10} y={block.y + 10} width={BLOCK_WIDTH - 20} height={BLOCK_HEIGHT - 20} />
        ))}
      </g>

      {/* Main road centre lines. */}
      <g fill="none" stroke="var(--color-stone)" strokeWidth="1.2">
        <path d={`M ${MAIN_ROAD_X} 0 V ${HEIGHT} M ${MAIN_ROAD_X_2} 0 V ${HEIGHT} M 0 ${MAIN_ROAD_Y} H ${WIDTH}`} />
      </g>
    </svg>
  );
}
