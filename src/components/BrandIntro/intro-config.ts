/**
 * INSTLE brand intro — the parameters worth changing, in one place.
 *
 * Every time here is in milliseconds, measured from the first painted frame of the
 * homepage. The CSS timeline and the WebGL scene both read the resolved values, so
 * they cannot drift apart: the boot script writes them onto <html> as custom
 * properties, and the scene reads them from `resolveTimeline()`.
 *
 * Hard limit: the full sequence never exceeds MAX_TOTAL_MS. `resolveTimeline`
 * clamps rather than trusting an edit here.
 */

export type IntroMode = 'full' | 'still' | 'brief';

/** What a returning or reduced-motion visit gets instead of the full film. */
export type IntroFallback = 'brief' | 'still' | 'none';

export const MAX_TOTAL_MS = 5000;

export interface FullTimelineInput {
  /** Thin line of light appears and travels across the facade. */
  lineIn: number;
  lineDuration: number;
  /** Camera pull-back from facade detail to the settled composition. */
  cameraIn: number;
  cameraDuration: number;
  /** Interior lights come on, room by room. */
  windowsIn: number;
  windowsDuration: number;
  /** Distant towers, street lights and road hints come out of the haze. */
  cityIn: number;
  cityDuration: number;
  /** The lockup emerges: backlight, then face, then depth. */
  markIn: number;
  markDuration: number;
  /** One controlled light sweep across the letters. */
  sweepIn: number;
  sweepDuration: number;
  /** BENGALURU descriptor. */
  tagIn: number;
  /** Buy · Sell · Rent · Rent out — the property journey. */
  journeyIn: number;
  /** Dawn lift, lockup flight into the header, dissolve into the site. */
  handoffIn: number;
  handoffDuration: number;
}

export const INTRO_CONFIG = {
  /** Master switch. `false` removes the intro without touching the site. */
  enabled: true,

  full: {
    lineIn: 300,
    lineDuration: 1400,
    cameraIn: 550,
    cameraDuration: 2650,
    windowsIn: 1150,
    windowsDuration: 1550,
    cityIn: 1350,
    cityDuration: 1500,
    markIn: 2150,
    markDuration: 850,
    sweepIn: 2800,
    sweepDuration: 650,
    tagIn: 2700,
    journeyIn: 3000,
    handoffIn: 3550,
    handoffDuration: 800,
  } satisfies FullTimelineInput,

  /**
   * Camera speed. 1 is the designed pace; 0.9 is 10% quicker. Scales every full
   * timeline value, and is clamped so the total stays inside MAX_TOTAL_MS.
   */
  timeScale: 1,

  /** Extra delay before the lockup, applied to the lockup, journey and handoff. */
  logoDelay: 0,

  /**
   * 0–1. Scales the light sweep, the glow behind the lockup, dust and street
   * lights. Lower is quieter; 1 is the designed level, not a maximum to push.
   */
  intensity: 1,

  /** Reduced motion: a static composition, opacity only. */
  reducedMotion: 'still' as Exclude<IntroFallback, 'brief'>,
  still: { fadeIn: 400, handoffIn: 1450, handoffDuration: 550 },

  /**
   * Reload, back/forward, or arriving from another page of this site.
   * 'full' replays the whole film (the owner's choice); 'brief' is a light
   * sweep across the header lockup with no overlay; 'none' shows the site.
   */
  returningVisit: 'full' as 'full' | Exclude<IntroFallback, 'still'>,
  brief: { total: 900 },

  /**
   * The WebGL scene joins only if it is drawing before this point. After it, the
   * CSS scene is already showing architecture, and swapping renderers mid-shot
   * would be visible. Slow loads therefore get the CSS scene, which is also the
   * right answer for a slow device.
   */
  webglJoinDeadline: 900,

  quality: {
    /** Fine pointer and a wide viewport. */
    high: { maxPixelRatio: 2, renderScale: 1, antialias: true, cityBlocks: 44, dust: 140, streetLights: 320 },
    /** Touch devices and narrow viewports: simpler city, no dust, lower resolution. */
    lite: { maxPixelRatio: 1.5, renderScale: 0.85, antialias: false, cityBlocks: 22, dust: 0, streetLights: 140 },
  },
} as const;

export type SceneQualityName = keyof typeof INTRO_CONFIG.quality;
export type SceneQuality = (typeof INTRO_CONFIG.quality)[SceneQualityName];

export interface ResolvedFullTimeline extends FullTimelineInput {
  total: number;
}

export interface ResolvedStillTimeline {
  fadeIn: number;
  handoffIn: number;
  handoffDuration: number;
  total: number;
}

/** The full timeline with speed and logo delay applied, never longer than MAX_TOTAL_MS. */
export function resolveTimeline(): ResolvedFullTimeline {
  const base = INTRO_CONFIG.full;
  const delay = Math.max(0, INTRO_CONFIG.logoDelay);
  const rawTotal = (base.handoffIn + delay + base.handoffDuration) * INTRO_CONFIG.timeScale;
  // Shrink uniformly if an edit pushed the sequence past the limit.
  const scale = INTRO_CONFIG.timeScale * Math.min(1, MAX_TOTAL_MS / Math.max(rawTotal, 1));
  const at = (value: number, delayed = false) => Math.round((value + (delayed ? delay : 0)) * scale);
  const resolved: ResolvedFullTimeline = {
    lineIn: at(base.lineIn),
    lineDuration: at(base.lineDuration),
    cameraIn: at(base.cameraIn),
    cameraDuration: at(base.cameraDuration),
    windowsIn: at(base.windowsIn),
    windowsDuration: at(base.windowsDuration),
    cityIn: at(base.cityIn),
    cityDuration: at(base.cityDuration),
    markIn: at(base.markIn, true),
    markDuration: at(base.markDuration),
    sweepIn: at(base.sweepIn, true),
    sweepDuration: at(base.sweepDuration),
    tagIn: at(base.tagIn, true),
    journeyIn: at(base.journeyIn, true),
    handoffIn: at(base.handoffIn, true),
    handoffDuration: at(base.handoffDuration),
    total: 0,
  };
  resolved.total = resolved.handoffIn + resolved.handoffDuration;
  return resolved;
}

export function resolveStillTimeline(): ResolvedStillTimeline {
  const { fadeIn, handoffIn, handoffDuration } = INTRO_CONFIG.still;
  return { fadeIn, handoffIn, handoffDuration, total: Math.min(MAX_TOTAL_MS, handoffIn + handoffDuration) };
}
