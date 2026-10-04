/**
 * CinematicTimeline — one clock for the CSS layers and the WebGL scene.
 *
 * The CSS layers are the authority: they start on the first painted frame,
 * before any JavaScript has loaded, and finish on their own if it never does.
 * The script side reads the time from the root's `introClock` CSS animation
 * rather than from its own timer, so the WebGL frame and the CSS frame are the
 * same moment, and pausing or slowing the page's animations (DevTools, an audit
 * script) moves both together.
 */

import { INTRO_CONFIG, resolveStillTimeline, resolveTimeline, type IntroMode } from './intro-config';

/** Attribute the boot script sets on <html>. Its value is the IntroMode. */
export const MODE_ATTRIBUTE = 'data-instle-intro';
/** Set on <html> by the first key, press, wheel or touch-move. */
export const SKIP_ATTRIBUTE = 'data-instle-intro-skip';
/** Set on <html> while the lockup is flying into the header. */
export const HANDOFF_ATTRIBUTE = 'data-instle-handoff';
/** Name of the keyframes the root runs for the whole sequence. */
export const CLOCK_ANIMATION = 'introClock';
/** Name of the keyframes that fade the root out on a skip. */
export const SKIP_ANIMATION = 'skipOut';

/**
 * CSS Modules scope keyframe names (`BrandIntro-module__x__introClock`), so
 * animations are matched by the name they end with.
 */
export function isClockAnimation(name: string | undefined): boolean {
  return Boolean(name && name.includes(CLOCK_ANIMATION));
}

export function isSkipAnimation(name: string | undefined): boolean {
  return Boolean(name && name.includes(SKIP_ANIMATION));
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

export type Ease = (x: number) => number;

/** The same curve as CSS `cubic-bezier(x1, y1, x2, y2)`. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const error = sampleX(t) - x;
      const slope = slopeX(t);
      if (Math.abs(error) < 1e-5 || Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    // Bisection if Newton wandered out of range.
    if (t < 0 || t > 1 || Math.abs(sampleX(t) - x) > 1e-3) {
      let lo = 0;
      let hi = 1;
      t = x;
      for (let i = 0; i < 24; i += 1) {
        if (sampleX(t) < x) lo = t;
        else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return sampleY(t);
  };
}

/**
 * The curves, named for what they do. The CSS module repeats the same control
 * points; `EASE_CSS` is what the boot script writes, so the two are one source.
 */
export const EASE_POINTS = {
  /** Long, slow camera pull that settles without a bump. */
  camera: [0.5, 0.02, 0.14, 1],
  /** Light travelling across a surface. */
  light: [0.45, 0, 0.25, 1],
  /** Things arriving and coming to rest. */
  settle: [0.16, 1, 0.3, 1],
  /** The flight into the header: leaves gently, lands gently. */
  flight: [0.66, 0, 0.24, 1],
} as const;

export const EASE: Record<keyof typeof EASE_POINTS, Ease> = {
  camera: cubicBezier(...EASE_POINTS.camera),
  light: cubicBezier(...EASE_POINTS.light),
  settle: cubicBezier(...EASE_POINTS.settle),
  flight: cubicBezier(...EASE_POINTS.flight),
};

export function cssCubicBezier(points: readonly number[]): string {
  return `cubic-bezier(${points.join(', ')})`;
}

/** 0 before `start`, 1 after `start + duration`, linear between. */
export function progress(t: number, start: number, duration: number): number {
  if (duration <= 0) return t >= start ? 1 : 0;
  return Math.min(1, Math.max(0, (t - start) / duration));
}

// ---------------------------------------------------------------------------
// CSS custom properties, written onto <html> by the boot script
// ---------------------------------------------------------------------------

const ms = (value: number) => `${Math.round(value)}ms`;

/** Custom properties for one mode. Names are short because they ship inline. */
export function timelineCssVariables(mode: IntroMode): Record<string, string> {
  const ease = {
    '--ix-intensity': String(Math.min(1, Math.max(0, INTRO_CONFIG.intensity))),
    '--ix-ease-camera': cssCubicBezier(EASE_POINTS.camera),
    '--ix-ease-light': cssCubicBezier(EASE_POINTS.light),
    '--ix-ease-settle': cssCubicBezier(EASE_POINTS.settle),
    '--ix-ease-flight': cssCubicBezier(EASE_POINTS.flight),
  };
  if (mode === 'still') {
    const still = resolveStillTimeline();
    return {
      ...ease,
      '--ix-total': ms(still.total),
      '--ix-fade': ms(still.fadeIn),
      '--ix-hand-in': ms(still.handoffIn),
      '--ix-hand': ms(still.handoffDuration),
    };
  }
  if (mode === 'brief') {
    return { ...ease, '--ix-total': ms(INTRO_CONFIG.brief.total) };
  }
  const full = resolveTimeline();
  return {
    ...ease,
    '--ix-total': ms(full.total),
    '--ix-line-in': ms(full.lineIn),
    '--ix-line': ms(full.lineDuration),
    '--ix-cam-in': ms(full.cameraIn),
    '--ix-cam': ms(full.cameraDuration),
    '--ix-win-in': ms(full.windowsIn),
    '--ix-win': ms(full.windowsDuration),
    '--ix-city-in': ms(full.cityIn),
    '--ix-city': ms(full.cityDuration),
    '--ix-mark-in': ms(full.markIn),
    '--ix-mark': ms(full.markDuration),
    '--ix-sweep-in': ms(full.sweepIn),
    '--ix-sweep': ms(full.sweepDuration),
    '--ix-tag-in': ms(full.tagIn),
    '--ix-journey-in': ms(full.journeyIn),
    '--ix-hand-in': ms(full.handoffIn),
    '--ix-hand': ms(full.handoffDuration),
  };
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

export interface IntroClock {
  /** Milliseconds since the intro's first frame, on the CSS timeline. */
  now(): number;
  /** Jump every CSS animation in the overlay to its end. */
  finish(): void;
}

/**
 * Read time from the root's clock animation. Falls back to the page's own
 * timeline if the browser does not expose CSS animations to script.
 */
export function createClock(root: HTMLElement): IntroClock {
  const find = () =>
    typeof root.getAnimations === 'function'
      ? root
          .getAnimations()
          .find((animation) => isClockAnimation((animation as CSSAnimation).animationName))
      : undefined;
  const fallbackStart = performance.now();
  let clock = find();
  return {
    now() {
      if (!clock || clock.playState === 'idle') clock = find();
      const current = clock?.currentTime;
      if (typeof current === 'number') return current;
      if (current && typeof (current as CSSNumericValue).to === 'function') {
        return (current as CSSNumericValue).to('ms').value;
      }
      // No animation object: count from the first painted frame the page knows about.
      return performance.now() - fallbackStart;
    },
    finish() {
      if (typeof root.getAnimations !== 'function') return;
      for (const animation of root.getAnimations({ subtree: true })) {
        try {
          animation.finish();
        } catch {
          // An infinite or already-cancelled animation cannot finish; ignore it.
        }
      }
    },
  };
}
