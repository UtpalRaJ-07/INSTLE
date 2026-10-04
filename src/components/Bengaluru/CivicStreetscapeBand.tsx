/**
 * CivicStreetscapeBand — a Bengaluru residential street, drawn as one flat band.
 *
 * What it draws, left to right:
 *
 *  - a coconut palm in a side setback;
 *  - a two-storey independent house: flat roof, parapet, a ribbed cylindrical
 *    water tank, a staircase headroom block, sunshades over grilled windows, a
 *    first-floor balcony with a railing, and a single pedestrian gate;
 *  - a flat-topped gulmohar in the gap between two houses;
 *  - an older single-storey house with a balustered parapet, potted plants on the
 *    parapet, a smaller tank, a monkey-top hood over an arched window with a fan
 *    light, a panelled door, and a double gate between capped piers, with
 *    bougainvillea spilling over the compound wall;
 *  - a rain tree on the footpath, with the wide, clumped umbrella crown and the
 *    low fork those trees have;
 *  - a three-storey house on stilts: parking bay behind a sliding gate, two floors
 *    of balconies, a solar water heater and a tank on the roof;
 *  - a concrete electric pole with a cross-arm, insulators, a street light, a
 *    transformer on a bracket and a coil of spare cable;
 *  - overhead wires sagging across the whole street, and the footpath with its
 *    painted kerb along the bottom.
 *
 * Every one of those is Bengaluru vernacular and none of them is a place. There is
 * no nameboard, no house number, no shop name, no registration plate and no
 * signage of any kind — the drawing contains no text at all; no human figure and
 * no face; no vehicle; and no recognisable landmark. A parapet tank is a thousand
 * streets; the Vidhana Soudha is one building and is not here. Requirements 9.4
 * and 9.14.
 *
 * Line work in two colours: `currentColor` — the frame sets it to `--color-ink` —
 * for everything built, and `--color-city-blue` for everything growing and for the
 * footpath. Shapes that sit in front of others are filled with the ground colour,
 * `--color-paper-raised`, so a wire passes behind a tree rather than through it;
 * that fill is the surface itself, not a third colour. The only solid marks are
 * the gate latch and the painted kerb stones. No opacity anywhere, so the colour
 * behind the caption is exactly the one the register declares.
 *
 * The cropped variant is the same geometry read through a tighter viewBox. It is a
 * crop in the photographic sense rather than a second drawing, so the two cannot
 * drift apart, and it is shorter — which is what a service page with a form below
 * it needs. On a narrow screen the stylesheet crops both variants again to a
 * taller shape, centred on the monkey-top house and the rain tree, so the line
 * work stays legible at 320px instead of shrinking to a hairline strip.
 */

import React from 'react';
import {
  STREETSCAPE_CROPPED_ASSET_ID,
  STREETSCAPE_FULL_ASSET_ID,
  requireRegisteredAsset,
} from '@/config/media-register';
import { AssetFigure, drawingProps } from './AssetFrame';
import styles from './Bengaluru.module.css';

export type StreetscapeVariant = 'full' | 'cropped';

const FRAME: Record<StreetscapeVariant, { assetId: string; viewBox: string }> = {
  /** The whole street: palm, three houses, two trees, the wall and the pole. */
  full: { assetId: STREETSCAPE_FULL_ASSET_ID, viewBox: '0 0 1200 256' },
  /** Cropped to the gulmohar, the monkey-top house, the gate and the rain tree. */
  cropped: { assetId: STREETSCAPE_CROPPED_ASSET_ID, viewBox: '300 44 700 196' },
};

/** Ground levels, in viewBox units. */
const WALL_TOP = 198;
const GROUND = 222;
const KERB_TOP = 234;
const KERB_FOOT = 240;

/** Positions from `start` to `end` inclusive, `step` apart. */
function steps(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let at = start; at <= end; at += step) out.push(at);
  return out;
}

/** One path of vertical strokes, one at each x. */
function verticals(xs: readonly number[], top: number, bottom: number): string {
  return xs.map((x) => `M ${x} ${top} V ${bottom}`).join(' ');
}

/**
 * A ribbed plastic water tank seen from the street: the elliptical lid, the two
 * sides and one rib. The bottom is hidden behind the parapet, as it is in life.
 */
function WaterTank({ cx, top, bottom, radius }: { cx: number; top: number; bottom: number; radius: number }) {
  const left = cx - radius;
  const right = cx + radius;
  const ry = Math.round(radius / 4);
  const rib = Math.round((top + bottom) / 2);
  return (
    <g>
      <rect x={left} y={top} width={radius * 2} height={bottom - top} fill="var(--color-paper-raised)" stroke="none" />
      <path
        d={`M ${left} ${top} A ${radius} ${ry} 0 0 1 ${right} ${top} A ${radius} ${ry} 0 0 1 ${left} ${top} Z`}
        fill="var(--color-paper-raised)"
      />
      <path
        d={`M ${left} ${top} V ${bottom} M ${right} ${top} V ${bottom} M ${left} ${rib} A ${radius} ${ry} 0 0 0 ${right} ${rib}`}
        fill="none"
      />
      <rect x={cx - 5} y={top - ry - 4} width="10" height="4" fill="var(--color-paper-raised)" />
    </g>
  );
}

/** A window with a sunshade over it and vertical grille bars. */
function GrilledWindow({ x, y, width, height, bars }: { x: number; y: number; width: number; height: number; bars: number }) {
  const pitch = width / (bars + 1);
  const xs = Array.from({ length: bars }, (_, index) => Math.round(x + pitch * (index + 1)));
  return (
    <g>
      <rect x={x - 6} y={y - 7} width={width + 12} height="4" />
      <rect x={x} y={y} width={width} height={height} />
      <path d={verticals(xs, y, y + height)} />
    </g>
  );
}

/** A railing: a top rail with balusters down to the slab. */
function Railing({ left, right, top, bottom, pitch }: { left: number; right: number; top: number; bottom: number; pitch: number }) {
  return <path d={`M ${left} ${top} H ${right} ${verticals(steps(left, right, pitch), top, bottom)}`} />;
}

/** A gate pier with its cap and a small pyramid on top. */
function Pier({ x }: { x: number }) {
  return (
    <g>
      <rect x={x} y={WALL_TOP - 10} width="14" height={GROUND - WALL_TOP + 10} />
      <rect x={x - 2} y={WALL_TOP - 14} width="18" height="4" />
      <path d={`M ${x - 1} ${WALL_TOP - 14} L ${x + 7} ${WALL_TOP - 21} L ${x + 15} ${WALL_TOP - 14} Z`} />
    </g>
  );
}

/** Compound wall runs, between the piers. */
const WALL_RUNS: readonly [number, number][] = [
  [-2, 136],
  [198, 551],
  [643, 944],
  [1092, 1202],
];

const PIERS: readonly number[] = [136, 184, 551, 629, 944, 1078];

export function CivicStreetscapeBand({ variant = 'full' }: { variant?: StreetscapeVariant }) {
  const frame = FRAME[variant];
  const asset = requireRegisteredAsset(frame.assetId);

  return (
    <AssetFigure asset={asset}>
      <svg
        {...drawingProps(asset, frame.viewBox, {
          className: styles.band,
          preserveAspectRatio: 'xMidYMid slice',
        })}
      >
        {/* Ground: the drawing's own surface, the one colour the register declares
            behind the caption. Full opacity, so nothing blends. */}
        <rect x="0" y="0" width="1200" height="256" fill="var(--color-paper-raised)" />

        {/* ---------- Behind the houses ---------- */}

        {/* Coconut palm in the side setback: a leaning ringed trunk, drooping fronds
            and a cluster of nuts under the crown. */}
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="2.6" strokeLinecap="round">
          <path d="M 66 222 C 70 170 58 112 72 54" />
        </g>
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M 62 190 H 71 M 60 160 H 69 M 59 130 H 68 M 60 100 H 69 M 64 76 H 72" />
          <path d="M 72 54 C 56 42 36 44 20 60" />
          <path d="M 72 54 C 60 32 40 26 24 30" />
          <path d="M 72 54 C 74 32 86 20 102 18" />
          <path d="M 72 54 C 90 42 110 44 124 58" />
          <path d="M 72 54 C 86 32 108 30 122 36" />
          <path d="M 72 54 C 62 66 52 80 46 94" />
          <path d="M 72 54 C 84 66 94 80 98 94" />
          <circle cx="67" cy="61" r="3.5" />
          <circle cx="75" cy="62" r="3.5" />
          <circle cx="71" cy="67" r="3.5" />
        </g>

        {/* Gulmohar in the gap between two houses: the flat, feathered umbrella
            crown, with a few blossoms picked out. */}
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M 372 222 C 372 196 370 178 367 162" />
          <path d="M 367 168 C 356 158 344 150 330 140 M 368 166 C 380 156 396 148 414 140 M 368 164 C 368 154 366 146 360 138" />
        </g>
        <g stroke="var(--color-city-blue)" strokeWidth="1.8" strokeLinejoin="round">
          <path
            d="M 316 136 A 8 8 0 0 1 322 122 A 8 8 0 0 1 332 112 A 8 8 0 0 1 344 106 A 8 8 0 0 1 356 104 A 8 8 0 0 1 368 103 A 8 8 0 0 1 380 103 A 8 8 0 0 1 392 104 A 8 8 0 0 1 404 105 A 8 8 0 0 1 414 108 A 8 8 0 0 1 424 116 A 8 8 0 0 1 430 128 A 8 8 0 0 1 428 138 A 10 10 0 0 1 412 140 A 10 10 0 0 1 394 138 A 10 10 0 0 1 376 141 A 10 10 0 0 1 358 138 A 10 10 0 0 1 340 141 A 10 10 0 0 1 324 140 A 6 6 0 0 1 316 136 Z"
            fill="var(--color-paper-raised)"
          />
        </g>
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="1.2" strokeLinecap="round">
          {/* Feathered fronds and a scatter of blossom. */}
          <path d="M 330 124 Q 348 117 366 121 M 378 115 Q 396 111 416 118 M 346 133 Q 370 127 396 131" />
          <circle cx="342" cy="116" r="2.2" />
          <circle cx="360" cy="112" r="2.2" />
          <circle cx="386" cy="124" r="2.2" />
          <circle cx="404" cy="112" r="2.2" />
          <circle cx="414" cy="130" r="2.2" />
          <circle cx="334" cy="132" r="2.2" />
        </g>

        {/* ---------- House A: two storeys ---------- */}
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="100" y="94" width="210" height="128" />
          <rect x="100" y="70" width="210" height="18" />
          <rect x="97" y="66" width="216" height="4" />
          <rect x="94" y="88" width="222" height="6" />
          <rect x="94" y="146" width="222" height="6" />
          {/* Staircase headroom block, with its slab and door. */}
          <rect x="234" y="40" width="50" height="30" />
          <rect x="228" y="34" width="62" height="6" />
          <rect x="250" y="48" width="18" height="22" />
        </g>
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <WaterTank cx={150} top={42} bottom={70} radius={18} />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <GrilledWindow x={118} y={106} width={40} height={30} bars={3} />
          <GrilledWindow x={176} y={106} width={36} height={30} bars={3} />
          {/* Balcony door, and the railing in front of it. */}
          <rect x="246" y="102" width="30" height="44" />
          <path d="M 261 102 V 146" />
          <Railing left={230} right={310} top={124} bottom={146} pitch={8} />
          {/* Ground floor: the door behind the pedestrian gate, and a window. */}
          <rect x="154" y="162" width="26" height="60" />
          <path d="M 167 162 V 222" />
          <GrilledWindow x={214} y={166} width={52} height={28} bars={4} />
        </g>

        {/* ---------- House B: one storey, older, with the monkey-top ---------- */}
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="420" y="123" width="240" height="99" />
          <rect x="420" y="104" width="240" height="14" />
          <rect x="414" y="118" width="252" height="5" />
        </g>
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <WaterTank cx={452} top={84} bottom={104} radius={16} />
          {/* Potted plants along the parapet. */}
          <path d="M 598 94 H 614 L 612 104 H 600 Z" />
          <path d="M 624 94 H 640 L 638 104 H 626 Z" />
        </g>
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M 597 94 A 5 5 0 0 1 603 86 A 5 5 0 0 1 611 85 A 5 5 0 0 1 615 94" />
          <path d="M 623 94 A 5 5 0 0 1 629 86 A 5 5 0 0 1 637 85 A 5 5 0 0 1 641 94" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          {/* Parapet balusters. */}
          <path d={verticals(steps(432, 648, 12), 107, 115)} />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <GrilledWindow x={440} y={150} width={36} height={36} bars={3} />
          {/* Door: sunshade, fan light, two leaves with a panel each. */}
          <rect x="576" y="143" width="42" height="4" />
          <rect x="582" y="150" width="30" height="72" />
          <rect x="582" y="150" width="30" height="10" />
          <path d="M 597 160 V 222" />
          <rect x="586" y="168" width="7" height="20" />
          <rect x="601" y="168" width="7" height="20" />
          {/* A small ventilator. */}
          <rect x="632" y="150" width="18" height="12" />
          <path d="M 638 150 V 162 M 644 150 V 162" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {/* Arched window: jambs, a semicircular head, and the reveal inside it. */}
          <path d="M 498 208 V 184 A 22 22 0 0 1 542 184 V 208" />
          {/* The monkey-top hood: a bell-curved gable, its eaves, and a finial. */}
          <path d="M 484 156 Q 508 150 520 132 Q 532 150 556 156 Z" fill="var(--color-paper-raised)" />
          <path d="M 520 132 V 128" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <path d="M 502 208 V 184 A 18 18 0 0 1 538 184 V 208" />
          <path d="M 520 166 V 208 M 502 184 H 538 M 520 184 L 507.3 171.3 M 520 184 L 532.7 171.3 M 514 184 A 6 6 0 0 1 526 184" />
          <path d="M 496 156 Q 512 151 520 140 Q 528 151 544 156" />
          <path d="M 488 156 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0 a 4 4 0 0 0 8 0" />
          <circle cx="520" cy="126" r="2" />
        </g>

        {/* ---------- House C: three storeys on stilts ---------- */}
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <WaterTank cx={966} top={18} bottom={40} radius={16} />
          {/* Solar water heater: the horizontal tank, its legs and the tubes. */}
          <rect x="1044" y="14" width="52" height="10" rx="5" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d={`${verticals(steps(1050, 1090, 6), 24, 40)} M 1046 20 L 1040 40 M 1094 20 L 1100 40`} />
        </g>
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <rect x="928" y="54" width="172" height="168" />
          <rect x="928" y="40" width="172" height="14" />
          <rect x="925" y="37" width="178" height="3" />
          <rect x="922" y="54" width="184" height="5" />
          <rect x="922" y="106" width="184" height="5" />
          <rect x="922" y="158" width="184" height="5" />
          {/* Stilt columns, with the parking bay open between them. */}
          <rect x="934" y="163" width="10" height="59" />
          <rect x="1009" y="163" width="10" height="59" />
          <rect x="1084" y="163" width="10" height="59" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          <GrilledWindow x={950} y={72} width={44} height={26} bars={3} />
          <GrilledWindow x={950} y={124} width={44} height={26} bars={3} />
          <rect x="1040" y="66" width="30" height="40" />
          <rect x="1040" y="118" width="30" height="40" />
          <path d="M 1055 66 V 106 M 1055 118 V 158" />
          <Railing left={1022} right={1106} top={88} bottom={106} pitch={7} />
          <Railing left={1022} right={1106} top={140} bottom={158} pitch={7} />
          {/* The beam over the parking bay. */}
          <path d="M 944 170 H 1084" />
        </g>

        {/* ---------- Compound wall, piers and gates ---------- */}
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          {WALL_RUNS.map(([from, to]) => (
            <rect key={from} x={from} y={WALL_TOP} width={to - from} height={GROUND - WALL_TOP} />
          ))}
          {PIERS.map((x) => (
            <Pier key={x} x={x} />
          ))}
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          {/* Coping under-edge, and the pilasters that break a long wall up. */}
          <path d={WALL_RUNS.map(([from, to]) => `M ${Math.max(from, 0)} ${WALL_TOP + 4} H ${Math.min(to, 1200)}`).join(' ')} />
          <path d={verticals([60, 290, 400, 700, 870, 1120], WALL_TOP + 4, GROUND)} />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
          {/* House A: a single pedestrian gate. */}
          <rect x="150" y="190" width="34" height="32" />
          <path d={`M 150 204 H 184 ${verticals([157, 164, 171, 178], 190, 222)}`} />
          {/* House B: a double gate with an arched top rail. */}
          <rect x="565" y="186" width="32" height="36" />
          <rect x="597" y="186" width="32" height="36" />
          <path d="M 565 194 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0 a 4 4 0 0 1 8 0" />
          <path d={verticals([573, 581, 589, 605, 613, 621], 194, 222)} />
          {/* House C: a sliding gate across the parking bay. */}
          <rect x="958" y="190" width="120" height="32" />
          <path d={`M 958 198 H 1078 M 958 206 H 1078 M 958 214 H 1078 ${verticals([988, 1018, 1048], 190, 222)}`} />
        </g>
        <circle cx="597" cy="206" r="2.4" fill="currentColor" />

        {/* Bougainvillea spilling over the wall of the older house. */}
        <g stroke="var(--color-city-blue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M 424 208 A 7 7 0 0 1 430 196 A 8 8 0 0 1 442 188 A 8 8 0 0 1 456 186 A 8 8 0 0 1 470 188 A 7 7 0 0 1 482 192 A 6 6 0 0 1 490 200 A 5 5 0 0 1 494 208 C 470 214 448 214 424 208 Z"
            fill="var(--color-paper-raised)"
          />
          <path d="M 436 210 C 434 214 437 218 435 222 M 458 212 C 456 216 459 219 457 222 M 480 211 C 482 215 479 218 481 221" fill="none" />
        </g>
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="1.2">
          <circle cx="440" cy="198" r="2" />
          <circle cx="452" cy="193" r="2" />
          <circle cx="465" cy="195" r="2" />
          <circle cx="476" cy="199" r="2" />
          <circle cx="447" cy="205" r="2" />
          <circle cx="470" cy="205" r="2" />
        </g>

        {/* ---------- Overhead wires, in front of the houses ---------- */}
        <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
          <path d="M 0 50 C 380 100 800 96 1128 40" />
          <path d="M 0 58 C 400 108 820 104 1172 40" />
          <path d="M 0 66 C 380 106 780 106 1145 88" />
        </g>

        {/* ---------- Rain tree on the footpath ---------- */}
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M 781 166 C 762 150 736 136 704 124" />
          <path d="M 786 162 C 778 146 770 132 758 122" />
          <path d="M 800 162 C 808 146 818 132 830 122" />
          <path d="M 805 166 C 826 150 852 136 884 124" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M 740 138 C 736 130 730 126 722 124 M 846 140 C 852 132 860 128 868 126" />
        </g>
        <path
          d="M 784 231 C 787 208 786 186 780 166 L 806 166 C 800 186 799 208 802 231 Z"
          fill="var(--color-paper-raised)"
          stroke="none"
        />
        <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M 784 231 C 787 208 786 186 780 166 M 802 231 C 799 208 800 186 806 166" />
          <path d="M 772 232 Q 793 226 814 232" />
        </g>
        {/* The crown: a broad, low umbrella, nearly four times as wide as it is
            deep, clumped along the top and nearly flat underneath. Its highest
            clump sits at about y 48, inside the cropped variant's top edge at 44,
            so the service-page crop shows the whole crown rather than cutting it. */}
        <g stroke="var(--color-city-blue)" strokeWidth="2" strokeLinejoin="round">
          <path
            d="M 650 112 A 16 16 0 0 1 664 92 A 20 20 0 0 1 692 76 A 22 22 0 0 1 728 68 A 24 24 0 0 1 770 62 A 25 25 0 0 1 814 62 A 24 24 0 0 1 856 68 A 22 22 0 0 1 892 76 A 20 20 0 0 1 920 92 A 16 16 0 0 1 934 112 A 26 26 0 0 1 900 120 A 26 26 0 0 1 864 118 A 26 26 0 0 1 828 122 A 26 26 0 0 1 792 118 A 26 26 0 0 1 756 122 A 26 26 0 0 1 720 118 A 26 26 0 0 1 684 122 A 26 26 0 0 1 650 112 Z"
            fill="var(--color-paper-raised)"
          />
        </g>
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="1.4" strokeLinecap="round">
          <path d="M 736 84 A 24 24 0 0 1 780 78 M 804 78 A 24 24 0 0 1 848 84" />
          <path d="M 680 106 A 22 22 0 0 1 720 96 M 760 102 A 26 26 0 0 1 808 100 M 864 96 A 22 22 0 0 1 904 106" />
          <path d="M 716 114 A 20 20 0 0 1 752 108 M 832 108 A 20 20 0 0 1 868 114" />
        </g>

        {/* ---------- Electric pole ---------- */}
        <g fill="var(--color-paper-raised)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M 1145 222 L 1147 34 H 1153 L 1155 222 Z" />
          <rect x="1122" y="44" width="56" height="5" />
          {/* Transformer on its bracket: the tank, two bushings, cooling fins. */}
          <rect x="1162" y="100" width="30" height="40" />
          <rect x="1167" y="94" width="4" height="6" />
          <rect x="1183" y="94" width="4" height="6" />
          {/* Street light. */}
          <rect x="1104" y="65" width="16" height="5" rx="2" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <circle cx="1128" cy="40" r="3" />
          <circle cx="1150" cy="30" r="3" />
          <circle cx="1172" cy="40" r="3" />
          <path d="M 1168 106 V 134 M 1174 106 V 134 M 1180 106 V 134 M 1186 106 V 134" />
          <path d="M 1155 106 H 1162 M 1155 134 H 1162" />
          <path d="M 1147 64 C 1136 60 1126 61 1118 65" />
          {/* A coil of spare cable hung on the pole. */}
          <path d="M 1145 142 L 1138 144" />
          <circle cx="1136" cy="152" r="8" />
          <circle cx="1136" cy="152" r="5.5" />
        </g>

        {/* ---------- Footpath and kerb ---------- */}
        <g fill="none" stroke="var(--color-city-blue)" strokeWidth="1.1">
          <path
            d={verticals(
              steps(20, 1180, 40).filter((x) => (x < 768 || x > 818) && (x < 1140 || x > 1160)),
              GROUND,
              KERB_TOP
            )}
          />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d={`M 0 ${GROUND} H 1200 M 0 ${KERB_TOP} H 1200`} />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d={`M 0 ${KERB_FOOT} H 1200`} />
        </g>
        {/* The kerb stones, painted alternately, as Bengaluru kerbs are. */}
        <g fill="currentColor" stroke="none">
          {steps(0, 1176, 48).map((x) => (
            <rect key={x} x={x} y={KERB_TOP} width="24" height={KERB_FOOT - KERB_TOP} />
          ))}
        </g>
      </svg>
    </AssetFigure>
  );
}
