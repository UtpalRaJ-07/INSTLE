/**
 * Camera — one slow, controlled pull-back.
 *
 * It opens a few metres off the tower's front-left corner, two thirds of the
 * way up, so the first thing seen is slab edge, glass and a balcony rail. It
 * then pulls straight back and down to a settled three-quarter view. It never
 * orbits or rolls: the eye travels on a straight line, and the aim point eases
 * slightly ahead of it so the shot settles rather than stops.
 *
 * Landscape and portrait have different end compositions rather than one frame
 * scaled down: landscape keeps the tower on the right third with the lockup on
 * the left; portrait puts the tower at the top and the lockup below it.
 */

import { add, lerp, mix, normalize, sub, type Vec3 } from './math';
import { OPENING_CORNER, TOWER } from './MainBuilding';

export interface CameraPose {
  eye: Vec3;
  target: Vec3;
  /** Vertical field of view, radians. */
  fov: number;
}

const DEG = Math.PI / 180;

interface Composition {
  start: CameraPose;
  end: CameraPose;
}

const START: CameraPose = {
  eye: add(OPENING_CORNER, [-5.2, -1.4, 7.4]),
  target: add(OPENING_CORNER, [1.6, 0.9, -1.4]),
  fov: 34 * DEG,
};

const LANDSCAPE_END: CameraPose = {
  eye: [-96, 11, 118],
  target: [-18, TOWER.top * 0.46, -12],
  fov: 36 * DEG,
};

const PORTRAIT_END: CameraPose = {
  eye: [-104, 4, 128],
  target: [-2, TOWER.top * 0.28, 0],
  fov: 58 * DEG,
};

/** Between portrait and landscape, blend the two so no aspect ratio is a cliff edge. */
export function compositionFor(aspect: number): Composition {
  const k = Math.min(1, Math.max(0, (aspect - 0.7) / (1.25 - 0.7)));
  const end: CameraPose = {
    eye: mix(PORTRAIT_END.eye, LANDSCAPE_END.eye, k),
    target: mix(PORTRAIT_END.target, LANDSCAPE_END.target, k),
    fov: lerp(PORTRAIT_END.fov, LANDSCAPE_END.fov, k),
  };
  const start: CameraPose = { ...START, fov: lerp(46 * DEG, START.fov, k) };
  return { start, end };
}

/**
 * `p` is the eased camera progress, 0–1. The aim point runs a little ahead of
 * the eye, which is what makes a real dolly feel intentional.
 */
export function cameraAt(p: number, composition: Composition): CameraPose {
  const { start, end } = composition;
  const aim = 1 - Math.pow(1 - p, 1.35);
  return {
    eye: mix(start.eye, end.eye, p),
    target: mix(start.target, end.target, aim),
    fov: lerp(start.fov, end.fov, p),
  };
}

/** Screen-right in the settled shot, flattened to the ground. The light sweeps along it. */
export function sweepDirection(composition: Composition): Vec3 {
  const forward = sub(composition.end.target, composition.end.eye);
  return normalize([-forward[2], 0, forward[0]]);
}
