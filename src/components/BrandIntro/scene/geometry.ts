/**
 * Box geometry, which is all this architecture needs: slabs, glass, columns,
 * balconies and city blocks are all axis-aligned boxes. Surface detail — rooms,
 * mullions, windows — is drawn by the shaders from world position, so the
 * vertex count stays in the low thousands.
 *
 * Vertex layout, interleaved: position (3), normal (3), attributes (2:
 * material id, seed).
 */

export const MATERIAL = {
  concrete: 0,
  glass: 1,
  lobby: 2,
  metal: 3,
  city: 4,
  rail: 5,
} as const;

export const FLOATS_PER_VERTEX = 8;

/** Faces, as bit flags, so hidden faces (a slab's underside on the ground) can be skipped. */
export const FACE = {
  px: 1,
  nx: 2,
  py: 4,
  ny: 8,
  pz: 16,
  nz: 32,
  all: 63,
  sides: 1 | 2 | 16 | 32,
} as const;

export class MeshBuilder {
  private readonly vertices: number[] = [];
  private readonly indices: number[] = [];

  get vertexCount() {
    return this.vertices.length / FLOATS_PER_VERTEX;
  }

  box(
    min: readonly [number, number, number],
    max: readonly [number, number, number],
    material: number,
    seed = 0,
    faces: number = FACE.all
  ) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const quad = (corners: number[][], normal: readonly [number, number, number]) => {
      const base = this.vertexCount;
      for (const corner of corners) this.vertices.push(corner[0]!, corner[1]!, corner[2]!, ...normal, material, seed);
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    // Counter-clockwise seen from outside.
    if (faces & FACE.pz) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
    if (faces & FACE.nz) quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1]);
    if (faces & FACE.px) quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0]);
    if (faces & FACE.nx) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0]);
    if (faces & FACE.py) quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0]);
    if (faces & FACE.ny) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
  }

  build() {
    return {
      vertices: new Float32Array(this.vertices),
      indices: new Uint32Array(this.indices),
    };
  }
}

export type MeshData = ReturnType<MeshBuilder['build']>;
