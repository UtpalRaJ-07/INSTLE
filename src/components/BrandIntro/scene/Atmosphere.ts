/**
 * Atmosphere — haze, street lights and dust.
 *
 * Height fog does most of the work (see `applyFog` in the shaders): it pushes
 * the city back and gives each layer its own value. The points here are the
 * quiet signs of life: street lights along the roads the ground draws, coming
 * on in a scattered order, and, on capable devices only, a little dust that is
 * visible only where the sweep passes through it.
 */

import { STREET_GRID } from './BackgroundBuildings';
import { seeded } from './math';

export const FOG_DENSITY = 0.0036;

/** Interleaved: position (3), info (3: kind, seed, size in metres). */
export const POINT_FLOATS = 6;

export function buildPoints(streetLights: number, dust: number): Float32Array {
  const random = seeded(88);
  const lamps: number[] = [];
  const half = STREET_GRID / 2;
  for (let k = -4; k <= 4; k += 1) {
    const road = k * STREET_GRID + half;
    for (let along = -520; along <= 520; along += 26) {
      const at = along + 13;
      for (const side of [-7, 7]) {
        // Roads run both ways: along x at z = road, and along z at x = road.
        lamps.push(road + side, 7, at, 0, random() * 0.8, 0.9);
        lamps.push(at, 7, road + side, 0, random() * 0.8, 0.9);
      }
    }
  }
  // A scattered subset, nearer lamps kept preferentially so the foreground reads.
  const chosen: number[] = [];
  const count = lamps.length / POINT_FLOATS;
  const order = Array.from({ length: count }, (_, i) => i)
    .map((i) => {
      const x = lamps[i * POINT_FLOATS]!;
      const z = lamps[i * POINT_FLOATS + 2]!;
      return { i, key: Math.hypot(x, z) * (0.6 + random()) };
    })
    .sort((a, b) => a.key - b.key)
    .slice(0, streetLights);
  for (const { i } of order) chosen.push(...lamps.slice(i * POINT_FLOATS, (i + 1) * POINT_FLOATS));

  for (let i = 0; i < dust; i += 1) {
    chosen.push(-34 + random() * 40, 26 + random() * 36, 6 + random() * 38, 1, random(), 0.05 + random() * 0.04);
  }
  return new Float32Array(chosen);
}
