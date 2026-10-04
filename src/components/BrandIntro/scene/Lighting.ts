/**
 * Lighting — what the light is doing at each moment of the film.
 *
 * Four layers, each driven by the shared timeline:
 *  - key: a soft, cool directional light from the upper left, the blue hour;
 *  - rim: a warm afterglow from behind, low on the right, catching edges;
 *  - interior: rooms coming on, lobby first, then floors in a scattered order;
 *  - sweep: one thin sheet of light crossing the facade from left to right,
 *    leaving the structure lit behind it.
 * Exposure starts low so the opening frame is close to black, and rises as the
 * sweep passes, so the architecture emerges from darkness rather than fading up.
 */

import type { ResolvedFullTimeline } from '../intro-config';
import { EASE, progress } from '../timeline';
import { normalize, smoothstep, type Vec3 } from './math';

export const KEY_DIRECTION: Vec3 = normalize([-0.62, 0.6, 0.5]);
export const RIM_DIRECTION: Vec3 = normalize([0.72, 0.2, -0.66]);

export interface LightState {
  sweepPos: number;
  sweepGain: number;
  revealAll: number;
  windows: number;
  city: number;
  exposure: number;
  lift: number;
}

/** Where the sweep starts and ends, in metres along the sweep direction. */
const SWEEP_FROM = -17;
const SWEEP_TO = 19;

export function lightAt(t: number, timeline: ResolvedFullTimeline, intensity: number): LightState {
  const line = progress(t, timeline.lineIn, timeline.lineDuration);
  const travelled = EASE.light(line);
  // Fades in quickly, holds while crossing, fades as it leaves the tower.
  const gain = smoothstep(0, 0.12, line) * (1 - smoothstep(0.78, 1, line));
  const city = progress(t, timeline.cityIn, timeline.cityDuration);
  return {
    sweepPos: SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * travelled,
    sweepGain: gain * (0.7 + 0.3 * intensity),
    revealAll: EASE.settle(city),
    windows: progress(t, timeline.windowsIn, timeline.windowsDuration),
    city,
    exposure: 0.42 + 0.58 * smoothstep(0, 0.7, line),
    // The site is night, so the scene no longer lifts towards paper at the end.
    lift: 0,
  };
}
