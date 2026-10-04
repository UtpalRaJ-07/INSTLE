import React from 'react';
import styles from './BrandIntro.module.css';

/**
 * The CSS scene — the 2.5D tier.
 *
 * It is server-rendered with the page, so it is on screen from the first frame
 * whether or not any script ever runs. It is what low-end devices, slow loads,
 * browsers without WebGL and reduced-motion visitors see, and it tells the same
 * story as the WebGL scene: darkness, a line of light, one tower, rooms lighting
 * up, a quiet city, then the lockup.
 *
 * Everything is gradient geometry on plain elements. No image is requested, and
 * the homepage markup carries no <svg> or <canvas> — the page tests hold every
 * drawing on the homepage to the media register, and this is not a published
 * drawing, it is a transient decorative layer.
 *
 * Depth comes from layers that scale by different amounts during the camera
 * pull-back (see `.world > *` in the stylesheet); every animated property is a
 * transform or an opacity, so the compositor carries it on a slow device.
 */

/** Deterministic, so the server and the client render identical markup. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pct = (value: number) => `${Math.round(value * 1000) / 1000}%`;

/**
 * A rectangle of flat colour as one background layer. `x`, `y`, `w`, `h` are
 * fractions of the element. Background-position percentages align the layer's
 * own point with the element's, so a layer of width w placed at left x needs
 * position x / (1 − w).
 */
function rect(tint: string, x: number, y: number, w: number, h: number): string {
  const px = w >= 1 ? 0 : (x / (1 - w)) * 100;
  const py = h >= 1 ? 0 : (y / (1 - h)) * 100;
  return `linear-gradient(${tint}, ${tint}) ${pct(px)} ${pct(py)} / ${pct(w * 100)} ${pct(h * 100)} no-repeat`;
}

// ---------------------------------------------------------------------------
// The tower's lit rooms: 8 panes across, 21 floors, three groups that switch
// on one after another.
// ---------------------------------------------------------------------------

const PANES = 8;
const FLOORS = 21;
const WARM = ['#f2c48c', '#f6d3a4', '#eab77c', '#f8dcb8'];

function roomGroups(panes: number, floors: number, seed: number, share: number): string[] {
  const random = seeded(seed);
  const groups: string[][] = [[], [], []];
  const w = 1 / panes;
  const h = 1 / floors;
  for (let floor = 0; floor < floors; floor += 1) {
    for (let pane = 0; pane < panes; pane += 1) {
      if (random() > share) continue;
      const tint = WARM[Math.floor(random() * WARM.length)]!;
      // Lower floors come on first, with some scatter, so the building fills upward.
      const order = (floors - floor) / floors + (random() - 0.5) * 0.5;
      const group = order < 0.45 ? 0 : order < 0.8 ? 1 : 2;
      // Inset inside the cell, so slab and mullion lines stay between rooms.
      groups[group]!.push(rect(tint, pane * w + w * 0.08, floor * h + h * 0.18, w * 0.84, h * 0.7));
    }
  }
  return groups.map((layers) => layers.join(', ') || 'none');
}

const FRONT_ROOMS = roomGroups(PANES, FLOORS, 11, 0.4);
const SIDE_ROOMS = roomGroups(3, FLOORS, 29, 0.3);

// ---------------------------------------------------------------------------
// Distant city: silhouettes along the horizon, sparse lit windows.
// ---------------------------------------------------------------------------

function farSkyline(seed: number, count: number) {
  const random = seeded(seed);
  const blocks: string[] = [];
  const lights: string[] = [];
  let x = -0.01;
  for (let i = 0; i < count && x < 1; i += 1) {
    const w = 0.018 + random() * 0.045;
    // Keep the far city low where the tower stands, so it reads as distance.
    const h = 0.12 + random() * 0.55 * (random() > 0.75 ? 1 : 0.55);
    const tint = random() > 0.5 ? '#0c1514' : '#0e1817';
    blocks.push(rect(tint, x, 1 - h, w, h));
    const windows = Math.floor(random() * 4);
    for (let j = 0; j < windows; j += 1) {
      const lx = x + w * (0.2 + random() * 0.6);
      const ly = 1 - h * (0.15 + random() * 0.75);
      lights.push(rect(random() > 0.25 ? '#b99467' : '#8ea3a3', lx, ly, 0.0028, 0.012));
    }
    x += w + random() * 0.012;
  }
  return { blocks: blocks.join(', '), lights: lights.join(', ') || 'none' };
}

const FAR = farSkyline(7, 40);

/** Four mid-distance towers, darker and larger than the far city. */
const MID_TOWERS: readonly { x: number; w: number; h: number }[] = [
  { x: 0.06, w: 0.07, h: 0.46 },
  { x: 0.2, w: 0.05, h: 0.32 },
  { x: 0.44, w: 0.06, h: 0.38 },
  { x: 0.83, w: 0.08, h: 0.5 },
];

/**
 * `still` renders the settled composition — rooms lit, no darkness, no line —
 * for the homepage hero, where the film hands over to it. It is decorative, so
 * the whole scene is hidden from assistive technology.
 */
export function CssArchitecture({ still = false }: { still?: boolean }) {
  return (
    <div className={styles.art} data-still={still ? '' : undefined} aria-hidden="true">
      <div className={styles.sky} />
      {/* Each plane fills the viewport, so every depth zooms about the same point. */}
      <div className={styles.plane} data-depth="far">
        <div className={styles.far} style={{ background: FAR.blocks }}>
          <div className={styles.farLights} style={{ background: FAR.lights }} />
        </div>
      </div>
      <div className={styles.plane} data-depth="mid">
        <div className={styles.mid}>
          {MID_TOWERS.map((tower) => (
            <div
              key={tower.x}
              className={styles.midTower}
              style={{ left: pct(tower.x * 100), width: pct(tower.w * 100), height: pct(tower.h * 100) }}
            />
          ))}
        </div>
      </div>
      <div className={styles.plane} data-depth="ground">
        <div className={styles.ground} />
      </div>
      <div className={styles.plane} data-depth="tower">
        <div className={styles.tower}>
          <div className={styles.towerSide}>
            {SIDE_ROOMS.map((layers, index) => (
              <div key={index} className={styles.rooms} data-group={index} style={{ background: layers }} />
            ))}
            <div className={`${styles.towerGrid} ${styles.towerGridSide}`} />
          </div>
          <div className={styles.towerFront}>
            {FRONT_ROOMS.map((layers, index) => (
              <div key={index} className={styles.rooms} data-group={index} style={{ background: layers }} />
            ))}
            <div className={styles.towerGrid} />
            <div className={styles.towerLobby} />
          </div>
          <div className={styles.towerCrown} />
        </div>
      </div>
      <div className={styles.plane} data-depth="haze">
        <div className={styles.haze} />
      </div>
      {/* The darkness and the light that pushes it back move as one. */}
      <div className={styles.shade}>
        <div className={styles.line} />
      </div>
    </div>
  );
}
