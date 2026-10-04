/**
 * BackgroundBuildings — an abstract city, not a skyline.
 *
 * Blocks sit inside a 110 m street grid (the roads the ground shader draws),
 * mostly mid-rise with a few towers further out, some with a set-back crown.
 * Nothing is placed between the camera and the tower, and nothing is a
 * landmark: no block has a distinctive silhouette, and the heights are random.
 */

import { FACE, MATERIAL, MeshBuilder } from './geometry';
import { normalize, seeded, type Vec3 } from './math';

export const STREET_GRID = 110;

export function buildBackgroundBuildings(mesh: MeshBuilder, count: number, cameraDirection: Vec3) {
  const random = seeded(20260929);
  const toCamera = normalize([cameraDirection[0], 0, cameraDirection[2]]);
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 20) {
    attempts += 1;
    const ci = Math.round((random() - 0.5) * 9);
    const cj = Math.round((random() - 0.5) * 9);
    if (ci === 0 && cj === 0) continue; // the tower's own block
    // Inside the block: roads run at ±55 m from each block's middle, 9 m wide.
    const x = ci * STREET_GRID + (random() - 0.5) * 44;
    const z = cj * STREET_GRID + (random() - 0.5) * 44;
    const distance = Math.hypot(x, z);
    if (distance < 60 || distance > 560) continue;
    // Keep the camera's line of sight to the tower clear.
    const along = (x * toCamera[0] + z * toCamera[2]) / distance;
    if (along > 0.55 && distance < 320) continue;
    if (along > 0.2 && distance < 140) continue;

    const w = 12 + random() * 16;
    const d = 12 + random() * 16;
    const far = Math.min(1, distance / 450);
    const h = 14 + Math.pow(random(), 1.8) * (40 + 80 * far);
    const seed = random() * 10;
    mesh.box([x - w / 2, 0, z - d / 2], [x + w / 2, h, z + d / 2], MATERIAL.city, seed, FACE.sides | FACE.py);
    if (h > 45 && random() > 0.55) {
      const inset = 2 + random() * 3;
      mesh.box(
        [x - w / 2 + inset, h, z - d / 2 + inset],
        [x + w / 2 - inset, h + 4 + random() * 10, z + d / 2 - inset],
        MATERIAL.city,
        seed + 1,
        FACE.sides | FACE.py
      );
    }
    placed += 1;
  }
}
