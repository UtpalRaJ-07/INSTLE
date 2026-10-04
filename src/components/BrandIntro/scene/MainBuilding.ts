/**
 * MainBuilding — one residential tower, generic and original.
 *
 * Twenty floors over a double-height lobby: a 16 m square glass core, concrete
 * floor slabs that project past the glass, corner columns, and balconies that
 * step left and right on alternate floors across the two faces the camera sees.
 * A slender corner fin rises past the parapet. Nothing is modelled on a real
 * building.
 */

import { FACE, MATERIAL, MeshBuilder } from './geometry';

export const TOWER = {
  half: 8,
  lobby: 6,
  floor: 3.3,
  floors: 20,
  bay: 3.2,
  get top() {
    return this.lobby + this.floor * this.floors;
  },
} as const;

/** The corner the film opens on: front-left, two thirds of the way up. */
export const OPENING_CORNER: readonly [number, number, number] = [-TOWER.half, TOWER.lobby + TOWER.floor * 13, TOWER.half];

/** `rails` receives the balcony glass, which is drawn in a blended pass after everything opaque. */
export function buildMainBuilding(mesh: MeshBuilder, rails: MeshBuilder) {
  const { half, lobby, floor, floors, bay } = TOWER;
  const top = TOWER.top;
  const slab = 0.19;
  const reach = 0.55;

  // Plaza and lobby.
  mesh.box([-14, 0, -14], [14, 0.3, 14], MATERIAL.concrete, 0, FACE.py | FACE.sides);
  mesh.box([-half + 1, 0.3, -half + 1], [half - 1, lobby, half - 1], MATERIAL.lobby, 0, FACE.sides);
  mesh.box([-4.5, lobby - 0.55, half - 1], [4.5, lobby - 0.25, half + 3.4], MATERIAL.concrete, 0);

  // Glass core, lobby roof to parapet.
  mesh.box([-half, lobby, -half], [half, top, half], MATERIAL.glass, 0, FACE.sides);

  // Floor slabs, lobby roof included.
  for (let i = 0; i < floors; i += 1) {
    const y = lobby + i * floor;
    mesh.box([-half - reach, y - slab, -half - reach], [half + reach, y + slab, half + reach], MATERIAL.concrete, i);
  }

  // Roof and parapet, then plant enclosure set back from the edge.
  mesh.box([-half - reach, top - slab, -half - reach], [half + reach, top + 1.9, half + reach], MATERIAL.concrete, 99);
  mesh.box([-4.2, top + 1.9, -5.5], [4.8, top + 4.2, 3.2], MATERIAL.concrete, 98, FACE.sides | FACE.py);

  // Corner columns, and the fin that carries the front-left one past the roof.
  const c = half - 0.05;
  for (const [x, z] of [
    [-c, c],
    [c, c],
    [-c, -c],
    [c, -c],
  ] as const) {
    const isFin = x < 0 && z > 0;
    mesh.box([x - 0.5, 0.3, z - 0.5], [x + 0.5, isFin ? top + 9 : top + 1.9, z + 0.5], MATERIAL.concrete, 50);
  }

  // Balconies on the front (+z) and left (−x) faces, alternating sides per floor.
  const depth = 1.75;
  const railHeight = 1.1;
  for (let i = 1; i < floors; i += 1) {
    const y = lobby + i * floor;
    const bays = i % 2 === 0 ? [0, 1] : [3, 4];
    const a = -half + bays[0]! * bay + 0.2;
    const b = -half + (bays[1]! + 1) * bay - 0.2;
    const out = half + reach;
    const edge = half + depth;

    // Front face.
    mesh.box([a, y - slab, out], [b, y + slab, edge], MATERIAL.concrete, i);
    rails.box([a, y + slab, edge - 0.06], [b, y + railHeight, edge], MATERIAL.rail, i);
    rails.box([a, y + slab, out], [a + 0.06, y + railHeight, edge], MATERIAL.rail, i);
    rails.box([b - 0.06, y + slab, out], [b, y + railHeight, edge], MATERIAL.rail, i);
    mesh.box([a, y + railHeight, edge - 0.08], [b, y + railHeight + 0.06, edge + 0.02], MATERIAL.metal, i);

    // Left face: the same rhythm, mirrored so the two faces step in opposition.
    const za = -half + (4 - bays[1]!) * bay + 0.2;
    const zb = -half + (4 - bays[0]! + 1) * bay - 0.2;
    mesh.box([-edge, y - slab, za], [-out, y + slab, zb], MATERIAL.concrete, i);
    rails.box([-edge, y + slab, za], [-edge + 0.06, y + railHeight, zb], MATERIAL.rail, i);
    rails.box([-edge, y + slab, za], [-out, y + railHeight, za + 0.06], MATERIAL.rail, i);
    rails.box([-edge, y + slab, zb - 0.06], [-out, y + railHeight, zb], MATERIAL.rail, i);
    mesh.box([-edge - 0.02, y + railHeight, za], [-edge + 0.08, y + railHeight + 0.06, zb], MATERIAL.metal, i);
  }
}
