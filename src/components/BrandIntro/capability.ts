/**
 * Which tier a device gets.
 *
 *   webgl/high  fine pointer, wide viewport, no reason to hold back
 *   webgl/lite  touch or narrow: simpler city, no dust, lower resolution
 *   css         the 2.5D scene, already on screen: low memory, few cores,
 *               Save-Data, a slow connection, no WebGL2, a software renderer,
 *               or a WebGL scene that could not keep up (see BrandIntro.tsx)
 *
 * Only signals the browser already exposes are read. Nothing is stored.
 */

import type { SceneQualityName } from './intro-config';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorHints {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: NetworkInformationLike;
}

export type Tier = { kind: 'css'; reason: string } | { kind: 'webgl'; quality: SceneQualityName };

export function chooseTier(): Tier {
  const hints = navigator as Navigator & NavigatorHints;
  if (hints.connection?.saveData) return { kind: 'css', reason: 'save-data' };
  // Only the clearly slow estimates. "3g" is reported for many ordinary mobile
  // and even desktop connections, and is too noisy to act on.
  if (/(^|-)2g$/.test(hints.connection?.effectiveType ?? '')) return { kind: 'css', reason: 'slow-network' };
  if (typeof hints.deviceMemory === 'number' && hints.deviceMemory < 4) return { kind: 'css', reason: 'memory' };
  if (typeof hints.hardwareConcurrency === 'number' && hints.hardwareConcurrency <= 2) {
    return { kind: 'css', reason: 'cores' };
  }
  if (typeof WebGL2RenderingContext === 'undefined') return { kind: 'css', reason: 'no-webgl2' };

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 900;
  return { kind: 'webgl', quality: coarse || narrow ? 'lite' : 'high' };
}
