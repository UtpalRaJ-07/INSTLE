/**
 * Homepage brand intro — visual and runtime audit.
 *
 *   node scripts/intro-audit.mjs [base-url] [out-dir]
 *
 * Drives the locally installed Chrome (as the other audits do) against a running
 * build and, per viewport:
 *  - freezes the film at fixed moments by seeking every CSS animation — the
 *    WebGL scene reads the same clock, so both tiers are captured at the same
 *    instant — and screenshots each;
 *  - plays the handoff in real time and records when the overlay is released,
 *    whether the WebGL context was released, and the layout shift during it;
 *  - checks the returning-visit, reduced-motion, skip and no-JavaScript paths.
 *
 * Writes PNGs and intro-audit.json to the output directory. Uses no personal
 * data and writes nothing to the site.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? 'docs/implementation/intro-audit';
const executablePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'large-2560', width: 2560, height: 1440 },
  { name: 'tablet-820', width: 820, height: 1180, touch: true, scale: 2 },
  { name: 'mobile-430', width: 430, height: 932, touch: true, scale: 3 },
  { name: 'mobile-375', width: 375, height: 812, touch: true, scale: 3 },
  { name: 'mobile-320', width: 320, height: 640, touch: true, scale: 2 },
];
const MOMENTS = [150, 700, 1300, 2000, 2600, 3350];

const browser = await chromium.launch({
  executablePath,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'],
});
// The same film with WebGL off, so the CSS tier is captured on its own.
const noWebgl = await chromium.launch({ executablePath, args: ['--disable-webgl', '--disable-3d-apis'] });
const report = { base: BASE, viewports: [], paths: {} };

async function contextFor(viewport, extra = {}, using = browser) {
  return using.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale ?? 1,
    hasTouch: Boolean(viewport.touch),
    isMobile: Boolean(viewport.touch),
    ...extra,
  });
}

/** Everything the page can tell us about the intro right now. */
const probe = () => {
  const html = document.documentElement;
  const root = document.querySelector('[data-tier]');
  const canvas = document.querySelector('[data-tier] canvas');
  let renderer = null;
  return {
    mode: html.getAttribute('data-instle-intro'),
    tier: root?.getAttribute('data-tier') ?? null,
    reason: root?.getAttribute('data-reason') ?? null,
    overlay: Boolean(root),
    canvas: Boolean(canvas),
    renderer,
    h1: document.querySelectorAll('h1').length,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
};

try {
  await mkdir(OUT, { recursive: true });

  const passes = [
    ...VIEWPORTS.map((viewport) => ({ viewport, using: browser, prefix: '' })),
    ...[VIEWPORTS[0], VIEWPORTS[4]].map((viewport) => ({ viewport, using: noWebgl, prefix: 'css-' })),
  ];
  for (const { viewport, using, prefix } of passes) {
    const context = await contextFor(viewport, {}, using);
    const page = await context.newPage();
    const entry = { viewport: prefix + viewport.name, frames: [], errors: [] };
    page.on('pageerror', (error) => entry.errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') entry.errors.push(message.text());
    });

    // Layout shift, from the first paint on.
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const shift of list.getEntries()) if (!shift.hadRecentInput) window.__cls += shift.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto(BASE + '/', { waitUntil: 'commit' });
    // Give the WebGL tier its chance to join, then freeze the film.
    await page
      .waitForFunction(() => document.querySelector('[data-tier]')?.getAttribute('data-reason'), null, { timeout: 2500 })
      .catch(() => {});
    await page.waitForTimeout(250);
    entry.start = await page.evaluate(probe);
    await page.evaluate(() => {
      for (const animation of document.getAnimations().filter((a) => a.timeline === document.timeline)) animation.pause();
    });

    for (const t of MOMENTS) {
      await page.evaluate((time) => {
        for (const animation of document.getAnimations().filter((a) => a.timeline === document.timeline)) animation.currentTime = time;
      }, t);
      // A seek on paused animations reaches the compositor on its next commit;
      // two frames are not always enough for the first one.
      await page.waitForTimeout(300);
      const file = `${prefix}${viewport.name}-${String(t).padStart(4, '0')}ms.png`;
      await page.screenshot({ path: join(OUT, file) });
      entry.frames.push(file);
    }

    // Real time from here: play the handoff and watch the release.
    const released = await page.evaluate(async () => {
      const began = performance.now();
      for (const animation of document.getAnimations().filter((a) => a.timeline === document.timeline)) animation.play();
      const canvas = document.querySelector('[data-tier] canvas');
      const gl = canvas?.getContext('webgl2') ?? null;
      while (document.documentElement.hasAttribute('data-instle-intro')) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (performance.now() - began > 6000) break;
      }
      const ms = Math.round(performance.now() - began);
      await new Promise((resolve) => setTimeout(resolve, 150));
      return {
        afterMs: ms,
        overlayGone: !document.querySelector('[data-tier]'),
        canvasDetached: canvas ? !canvas.isConnected : null,
        contextLost: gl ? gl.isContextLost() : null,
        headerLockupOpacity: getComputedStyle(document.querySelector('header [data-lockup-part="name"]').closest('a'))
          .opacity,
        cls: window.__cls,
      };
    });
    entry.release = released;
    await page.screenshot({ path: join(OUT, `${prefix}${viewport.name}-after.png`) });
    entry.frames.push(`${prefix}${viewport.name}-after.png`);
    entry.end = await page.evaluate(probe);
    report.viewports.push(entry);
    await context.close();
  }

  // Real-time frame rate of the full film, per tier, on desktop and mobile.
  report.paths.frameRate = {};
  for (const [label, using, viewport] of [
    ['webgl-desktop', browser, VIEWPORTS[0]],
    ['webgl-mobile', browser, VIEWPORTS[4]],
    ['css-desktop', noWebgl, VIEWPORTS[0]],
  ]) {
    const context = await contextFor(viewport, {}, using);
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__frames = [];
      const tick = (now) => {
        window.__frames.push(now);
        if (window.__frames.length < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(BASE + '/');
    await page.waitForFunction(() => document.documentElement.hasAttribute('data-instle-intro'), null, { timeout: 3000 }).catch(() => {});
    const tier = await page.evaluate(() => document.querySelector('[data-tier]')?.getAttribute('data-reason'));
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-instle-intro'), null, { timeout: 8000 });
    report.paths.frameRate[label] = {
      tier,
      ...(await page.evaluate(() => {
        const f = window.__frames;
        const gaps = f.slice(1).map((now, i) => ({ gap: now - f[i], at: Math.round(f[i]) }));
        const sorted = gaps.map((g) => g.gap).sort((a, b) => a - b);
        const at = (q) => Math.round(sorted[Math.floor(sorted.length * q)] * 10) / 10;
        const worst = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          frames: f.length,
          medianMs: at(0.5),
          p95Ms: at(0.95),
          over50ms: gaps.filter((g) => g.gap > 50).length,
          worstMs: Math.round(worst.gap),
          worstAtMs: worst.at,
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        };
      })),
    };
    if (label === 'webgl-desktop') {
      report.paths.lazyChunks = await page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .filter((entry) => entry.name.includes('/_next/static/chunks/') && entry.initiatorType === 'script')
          .map((entry) => ({ name: entry.name.split('/').pop(), bytes: entry.encodedBodySize, startMs: Math.round(entry.startTime) }))
      );
    }
    await context.close();
  }

  // Returning visit: a reload gets the brief sweep, with no overlay.
  {
    const context = await contextFor(VIEWPORTS[0]);
    const page = await context.newPage();
    await page.goto(BASE + '/');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-instle-intro'), null, { timeout: 8000 });
    await page.reload({ waitUntil: 'commit' });
    await page.waitForTimeout(350);
    report.paths.reload = await page.evaluate(probe);
    await page.screenshot({ path: join(OUT, 'returning-reload-350ms.png'), clip: { x: 0, y: 0, width: 720, height: 120 } });
    // Arriving from another page of the site.
    await page.goto(BASE + '/buy');
    await page.click('header a[href="/"]');
    await page.waitForURL(BASE + '/');
    report.paths.inSiteNavigation = await page.evaluate(probe);
    await context.close();
  }

  // Reduced motion: a still composition, opacity only.
  {
    const context = await contextFor(VIEWPORTS[0], { reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'commit' });
    await page.waitForTimeout(900);
    report.paths.reducedMotion = await page.evaluate(probe);
    await page.screenshot({ path: join(OUT, 'reduced-motion-900ms.png') });
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-instle-intro'), null, { timeout: 5000 });
    report.paths.reducedMotion.releasedBy = 'film end';
    await context.close();
  }

  // Skip: the first key press ends the film at once, and focus lands where it should.
  {
    const context = await contextFor(VIEWPORTS[0]);
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'commit' });
    await page.waitForTimeout(800);
    const before = Date.now();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-instle-intro'), null, { timeout: 3000 });
    report.paths.skip = {
      releasedAfterMs: Date.now() - before,
      focused: await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40)),
      overlayGone: await page.evaluate(() => !document.querySelector('[data-tier]')),
    };
    await context.close();
  }

  // Touch skip on mobile.
  {
    const context = await contextFor(VIEWPORTS[3]);
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'commit' });
    await page.waitForTimeout(800);
    await page.touchscreen.tap(200, 400);
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-instle-intro'), null, { timeout: 3000 });
    await page.waitForTimeout(400);
    report.paths.tapSkip = { url: page.url(), stayedOnHome: page.url() === BASE + '/', overlayGone: await page.evaluate(() => !document.querySelector('[data-tier]')) };
    await context.close();
  }

  // No JavaScript: the CSS plays the film and removes the overlay on its own.
  {
    const context = await contextFor(VIEWPORTS[0], { javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'commit' });
    await page.waitForTimeout(600);
    const during = await page.evaluate(() => document.querySelector('[data-tier]') ? getComputedStyle(document.querySelector('[data-tier]')).display : 'absent');
    await page.waitForTimeout(5000);
    report.paths.noJavaScript = {
      overlayDisplayDuring: during,
      overlayVisibilityAfter: await page.evaluate(() => {
        const root = document.querySelector('[data-tier]');
        return root ? getComputedStyle(root).display + '/' + getComputedStyle(root).visibility : 'absent';
      }),
      headlineVisible: await page.isVisible('h1'),
    };
    await page.screenshot({ path: join(OUT, 'no-javascript-after.png') });
    await context.close();
  }

  // Other routes: no overlay, no mode.
  {
    const context = await contextFor(VIEWPORTS[0]);
    const page = await context.newPage();
    await page.goto(BASE + '/sell');
    report.paths.otherRoute = await page.evaluate(probe);
    await context.close();
  }
} finally {
  await browser.close();
  await noWebgl.close();
  await writeFile(join(OUT, 'intro-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
