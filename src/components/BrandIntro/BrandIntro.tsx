'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { chooseTier } from './capability';
import { CssArchitecture } from './CssArchitecture';
import { INTRO_CONFIG, resolveStillTimeline, resolveTimeline, type IntroMode } from './intro-config';
import { InstleLogoReveal } from './InstleLogoReveal';
import type { ArchitecturalSceneHandle } from './scene/ArchitecturalScene';
import {
  HANDOFF_ATTRIBUTE,
  MODE_ATTRIBUTE,
  SKIP_ATTRIBUTE,
  createClock,
  isClockAnimation,
  isSkipAnimation,
  timelineCssVariables,
} from './timeline';
import { fly, planFlight } from './transition';
import styles from './BrandIntro.module.css';

/**
 * INSTLEBrandIntro — the opening film on a first visit to the homepage.
 *
 *   ArchitecturalScene   scene/ — the WebGL tier, loaded on demand
 *   CssArchitecture      the 2.5D tier, server-rendered, always present
 *   InstleLogoReveal     the lockup and the journey line
 *   CinematicTimeline    timeline.ts — one clock for CSS and WebGL
 *   WebsiteTransition    transition.ts — dawn, flight into the header, release
 *
 * It is a layer over the site, not a gate in front of it. The page underneath
 * is server-rendered, complete and interactive from the start; the overlay is
 * aria-hidden, holds no focusable element, and the first key, press, wheel or
 * touch-move skips it. Once the inline boot script has run, the CSS plays the
 * film and hides the overlay on its own, even if the bundle never loads. With
 * JavaScript off entirely there is no boot script, so there is no film: the
 * overlay stays display:none and the site shows directly.
 *
 * The mode is decided before first paint by the boot script (boot-script.ts),
 * which writes it onto <html>. This component only reads it.
 */

// A tiny external store: "is a film playing?" Read from the attribute on <html>,
// changed only by the boot script and by `release()` below.
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const notify = () => listeners.forEach((listener) => listener());
const filmMode = (): IntroMode | null => {
  const mode = document.documentElement.getAttribute(MODE_ATTRIBUTE);
  return mode === 'full' || mode === 'still' ? mode : null;
};
const isFilmPlaying = () => filmMode() !== null;
// On the server the overlay is always rendered, so it paints with the page.
const serverSnapshot = () => INTRO_CONFIG.enabled;

/** Give <html> back exactly as the boot script found it. */
function release(mode: IntroMode) {
  const html = document.documentElement;
  html.removeAttribute(MODE_ATTRIBUTE);
  html.removeAttribute(SKIP_ATTRIBUTE);
  html.removeAttribute(HANDOFF_ATTRIBUTE);
  for (const property of Object.keys(timelineCssVariables(mode))) html.style.removeProperty(property);
  if (!html.getAttribute('style')) html.removeAttribute('style');
  notify();
}

/** Frames slower than this, sustained, send the film back to the CSS scene. */
const SLOW_FRAME_MS = 42;
const WATCH_FRAMES = 18;

function play(root: HTMLElement, host: HTMLElement): () => void {
  const mode = filmMode();
  if (!mode) return () => {};

  const html = document.documentElement;
  const clock = createClock(root);
  const full = resolveTimeline();
  const total = mode === 'full' ? full.total : resolveStillTimeline().total;
  let frame = 0;
  let stopped = false;
  let done = false;
  let handoff = false;
  let scene: ArchitecturalSceneHandle | null = null;
  let canvas: HTMLCanvasElement | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const frameTimes: number[] = [];

  const dropScene = (fallBack: boolean) => {
    scene?.dispose();
    scene = null;
    canvas?.remove();
    canvas = null;
    if (fallBack) root.dataset.tier = 'css';
  };

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    for (const timer of timers) clearTimeout(timer);
    observer.disconnect();
    root.removeEventListener('animationend', onAnimationEnd);
    dropScene(false);
  };

  const finish = () => {
    if (done) return;
    done = true;
    stop();
    release(mode);
  };

  const startHandoff = () => {
    handoff = true;
    const parts = planFlight(root);
    // No header lockup to land on: the CSS fade-out and header fade-in run instead.
    if (!parts) return;
    root.dataset.handoff = 'js';
    html.setAttribute(HANDOFF_ATTRIBUTE, '');
    const backlight = root.querySelector<HTMLElement>(`.${styles.backlight}`);
    backlight?.animate([{ opacity: getComputedStyle(backlight).opacity }, { opacity: 0 }], {
      duration: 300,
      fill: 'forwards',
    });
    fly(parts, full.handoffDuration * 0.95).then(finish, finish);
  };

  let last = 0;
  const tick = (now: number) => {
    if (stopped) return;
    const t = clock.now();
    if (scene) {
      scene.render(t);
      if (frameTimes.length < WATCH_FRAMES && last > 0) {
        frameTimes.push(now - last);
        if (frameTimes.length === WATCH_FRAMES) {
          const sorted = [...frameTimes].sort((a, b) => a - b);
          if (sorted[Math.floor(WATCH_FRAMES / 2)]! > SLOW_FRAME_MS) dropScene(true);
        }
      }
      last = now;
    }
    if (mode === 'full' && !handoff && t >= full.handoffIn) startHandoff();
    if (t >= total + 60) {
      finish();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  // The clock animation ends the film; a skip ends it sooner.
  function onAnimationEnd(event: AnimationEvent) {
    if (event.target !== root) return;
    if (isClockAnimation(event.animationName) || isSkipAnimation(event.animationName)) finish();
  }
  root.addEventListener('animationend', onAnimationEnd);

  const observer = new MutationObserver(() => {
    if (!html.hasAttribute(SKIP_ATTRIBUTE)) return;
    dropScene(false);
    // Longer than the 280 ms fade, in case animationend never arrives.
    timers.push(setTimeout(finish, 360));
  });
  observer.observe(html, { attributes: true, attributeFilter: [SKIP_ATTRIBUTE] });

  // A backstop if the tab was hidden and neither frames nor events arrived. It
  // checks the film's own clock, so a paused or slowed timeline is not cut short.
  const backstop = () => {
    if (clock.now() < total + 60) timers.push(setTimeout(backstop, 1000));
    else finish();
  };
  timers.push(setTimeout(backstop, total + 1500));

  // The WebGL tier joins only on the full film, and only if it is drawing early.
  if (mode === 'full' && !html.hasAttribute(SKIP_ATTRIBUTE)) {
    const tier = chooseTier();
    root.dataset.reason = tier.kind === 'css' ? tier.reason : tier.quality;
    if (tier.kind === 'webgl') {
      const tooLate = () =>
        stopped || clock.now() > INTRO_CONFIG.webglJoinDeadline || html.hasAttribute(SKIP_ATTRIBUTE);
      import('./scene/ArchitecturalScene')
        .then(async ({ createArchitecturalScene }) => {
          if (tooLate()) return;
          const element = document.createElement('canvas');
          element.setAttribute('aria-hidden', 'true');
          host.appendChild(element);
          const created = await createArchitecturalScene(element, {
            quality: INTRO_CONFIG.quality[tier.quality],
            timeline: full,
            intensity: Math.min(1, Math.max(0, INTRO_CONFIG.intensity)),
            onContextLost: () => dropScene(true),
            shouldAbort: tooLate,
          });
          if (!created || tooLate()) {
            created?.dispose();
            element.remove();
            if (!stopped) root.dataset.reason = created ? 'webgl-late' : 'webgl-unavailable';
            return;
          }
          canvas = element;
          scene = created;
          scene.render(clock.now());
          root.dataset.tier = 'webgl';
        })
        .catch(() => {
          // The chunk failed to load; the CSS scene is already playing.
        });
    }
  }

  frame = requestAnimationFrame(tick);
  return stop;
}

export function BrandIntro() {
  const playing = useSyncExternalStore(subscribe, isFilmPlaying, serverSnapshot);
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const host = hostRef.current;
    if (!playing || !root || !host) return;
    const mode = filmMode();
    const stop = play(root, host);
    return () => {
      stop();
      // Unmounted mid-film (not a Strict Mode re-run, which keeps the element):
      // hand <html> back so the header lockup is not left hidden.
      setTimeout(() => {
        if (!root.isConnected && mode && filmMode()) release(mode);
      }, 0);
    };
  }, [playing]);

  if (!playing) return null;

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true" data-tier="css">
      <div className={styles.stage}>
        <CssArchitecture />
        <div ref={hostRef} className={styles.canvasHost} />
        <div className={styles.dawn} />
      </div>
      <div className={styles.titles}>
        <InstleLogoReveal />
      </div>
      <div className={styles.shield} />
    </div>
  );
}
