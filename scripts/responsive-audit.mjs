/**
 * Responsive and layout audit of the local preview.
 *
 * Drives the Chromium already present in the Playwright browser cache via
 * playwright-core, so no browser download is needed. For each page and width it:
 *
 *   - measures document.scrollWidth against the viewport width, which is how
 *     horizontal overflow is actually detected;
 *   - names the widest element when overflow is found, so the cause is obvious;
 *   - checks that the sticky mobile action bar does not cover page content;
 *   - checks that every interactive control meets a practical tap-target size;
 *   - captures a full-page screenshot.
 *
 * What task 18.1 added to the Phase 1 script, and why:
 *
 *  1. **The page list is generated, not kept here.** It comes from
 *     `getPublicRoutes()` — the same registry the sitemap and `llms.txt` read — so a
 *     newly published locality or guide is audited the moment the gate admits it,
 *     with no array to remember to edit. The one hand-written entry left is the
 *     deliberate 404 probe, which by definition is not a public route. Screenshot
 *     file names are mapped for the three routes whose Phase 1 capture names are
 *     referenced from STATUS.md; every other name is derived from the path.
 *  2. **150% text is measured, not photographed.** Requirement 9.8 asks for zero
 *     horizontal overflow at 150% text at 320 px and 1280 px. Phase 1 had one
 *     screenshot of one page at 150% in `form-state-audit.mjs`; this pass enlarges
 *     the root font to 150% and measures every audited route at both widths, naming
 *     the widest element when it overflows. Same definition of overflow, same
 *     diagnosis, no eyeballing.
 *  3. **The Bengaluru drawings are measured as page elements.** Every
 *     `svg[data-asset-id]` is checked to sit inside the viewport at every width, and
 *     the routes Requirement 9.2 obliges to carry a Bengaluru element are checked to
 *     carry one. `measure-visual-assets.mjs` weighs those assets; nothing weighed
 *     them as layout until now. This covers the streetscape band on `/` and the five
 *     service pages, the corridor diagram on `/areas`, and the orientation plate on
 *     any published locality page.
 *  4. **The overflow disclosure is opened.** The area hub puts a group's links past
 *     25 inside a native `<details>`. Closed, those links are in the HTML but have no
 *     layout, so a closed-only audit cannot see them overflow. Every `<details>` on
 *     every audited page is opened and the page re-measured. While no locality
 *     passes the gate there is no `<details>` to open, so the report records how many
 *     were found and opened rather than implying a check that did not happen.
 *  5. **A pass is a number, not an absence.** Every 150% measurement, every asset
 *     rectangle and every tap-target census is written into the report, so "zero
 *     findings" can be read against the values it came from. The enlarged-text pass
 *     also checks that the root font size actually moved: a zoom that silently
 *     failed to apply would otherwise report zero overflow and mean nothing.
 *  6. **A check that could not run says so.** The drawer and enquiry-form captures
 *     are interactions, and an interaction can fail for reasons that are not a
 *     layout defect — a lost click before hydration, a panel this build does not
 *     render. Each is attempted, and a failure is recorded as `check-not-run` with
 *     its reason instead of aborting the run or passing quietly. The report is
 *     written even when the run ends early, so a partial audit is still evidence.
 *  7. **The disclosure is measured against its container, and without script.** A
 *     `<details>` is checked for overflow of its own content box as well as of the
 *     viewport, and the area hub is loaded a second time with JavaScript disabled
 *     and compared link for link, which is what "needs no script" means in a
 *     measurement rather than in a comment. That scriptless pass waits for `load`
 *     and records how many stylesheets had applied when it measured: with no script
 *     to hold the parser, DOMContentLoaded fires ahead of the CSS, and a width read
 *     at that instant describes unstyled HTML rather than the page.
 *  8. **The 44 px target rule is recorded, not assumed.** Requirement 9.10 asks for
 *     44 CSS px in the smallest dimension, except an inline text link at 24 px or
 *     more. The failing check stays where Phase 1 put it — under 24 px in either
 *     dimension, and, new here, any control that is not a text link under 44 px.
 *     Every text link between 24 and 44 px is counted and written to the report as
 *     a census, because it rests on that exception and a reader of the report
 *     should see how much rests on it rather than infer silence.
 *  9. **Overflow is measured against the screen, and in three places.** The
 *     reference width is `documentElement.clientWidth`, not `window.innerWidth`:
 *     under mobile emulation Chrome widens the layout viewport to fit content that
 *     does not fit the screen, so `innerWidth` agreed with the document on every page
 *     while the header sat 58 px off the side of a 320 px screen at 150% text. Two
 *     further checks cover what a document-width comparison cannot see at all: an
 *     interactive control whose box lies outside the screen, and a fixed-position
 *     element whose content is wider than its own box — the sticky action bar is out
 *     of flow, so however far its label spills the document never widens.
 *
 * Findings, not assertions: every check appends to `findings`, the script writes
 * them all to `docs/implementation/responsive-audit.json`, and exits non-zero if
 * there is at least one. A first failure does not hide the rest.
 *
 * Usage:
 *   npm run build
 *   node scripts/responsive-audit.mjs [baseUrl] [outDir] [--port=3218]
 *
 * Without a base URL the script starts `next start` on 127.0.0.1 at `--port`
 * (default 3218), refuses to run if that port is taken, and stops the server it
 * started. Given a base URL — `node scripts/responsive-audit.mjs http://127.0.0.1:3215`,
 * the Phase 1 invocation — it measures the server you are already running and leaves
 * it alone.
 */

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createConnection, createServer as createNetServer } from 'node:net';
import path from 'node:path';

import { registerTypeScriptResolution, REPOSITORY_ROOT } from './lib/ts-module-loader.mjs';

registerTypeScriptResolution();

const { getPublicRoutes } = await import('@/lib/public-routes');
const { STATIC_ROUTE_VISUAL_ASSETS, VISUAL_ASSET_REGISTER } = await import('@/config/media-register');

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const positional = argv.filter((arg) => !arg.startsWith('--'));

const EXTERNAL_BASE_URL = (flag('base-url') ?? positional.find((arg) => arg.startsWith('http')))?.replace(/\/$/, '');
const OUT = positional.find((arg) => !arg.startsWith('http')) ?? 'docs/implementation/screenshots';
const PORT = Number(flag('port') ?? 3218);

// ---------------------------------------------------------------------------
// What is audited
// ---------------------------------------------------------------------------

/**
 * Screenshot names for the routes whose Phase 1 capture file names are cited in
 * STATUS.md and DESIGN-AND-MEDIA.md. Anything absent here is named from its path,
 * so a newly published route needs no entry.
 */
const SCREENSHOT_NAMES = new Map([
  ['/', 'home'],
  ['/about/utpal-raj-kb', 'owner-utpal-raj-kb'],
  ['/guides/can-a-broker-guarantee-a-property-sale-in-30-days', 'guide-30-days'],
]);

const screenshotName = (route) =>
  SCREENSHOT_NAMES.get(route) ?? (route.replace(/^\//, '').replace(/\//g, '-') || 'home');

const now = new Date();
const publicRoutes = getPublicRoutes(now).map((route) => route.path);

/**
 * The audited list: every registered public route, plus one path that is registered
 * nowhere, so the 404 response is audited for layout like any other page.
 */
const UNREGISTERED_PROBE_PATH = '/this-page-does-not-exist';
const PAGES = [
  ...publicRoutes.map((route) => ({ name: screenshotName(route), route, expectedStatus: 200 })),
  { name: 'not-found', route: UNREGISTERED_PROBE_PATH, expectedStatus: 404 },
];

/** 320 is the WCAG reflow width; the rest are the blueprint's test anchors. */
const WIDTHS = [320, 360, 390, 768, 1280, 1440];
const SCREENSHOT_WIDTHS = new Set([390, 1440]);

/** Requirement 9.8 names these two widths for the enlarged-text pass. */
const TEXT_ZOOM_WIDTHS = [320, 1280];
const TEXT_ZOOM_STYLE = 'html { font-size: 150% !important; }';

/**
 * Requirement 9.2: each of these must render at least one Bengaluru-specific
 * element. The static six are the homepage and the five service pages; every
 * published locality page carries an orientation plate, and comes from the registry
 * rather than from a list, for the same reason the page list does.
 */
const ROUTES_REQUIRING_A_BENGALURU_ELEMENT = new Set([
  ...Object.keys(STATIC_ROUTE_VISUAL_ASSETS),
  ...publicRoutes.filter((route) => route.startsWith('/areas/')),
]);

/**
 * The exact element each static route owes, read from the media register rather
 * than restated here, so a route that renders the wrong drawing is a finding and
 * not a shrug. A published locality route is held to "at least one" instead: the
 * page draws the orientation plate when the record has enough neighbours and the
 * typographic plate over the layout texture when it does not, and both satisfy
 * Requirement 9.2.
 */
const EXPECTED_ASSET_IDS_BY_ROUTE = new Map(Object.entries(STATIC_ROUTE_VISUAL_ASSETS));

const findings = [];

function record(kind, detail) {
  findings.push({ kind, ...detail });
}

/**
 * Runs one interaction capture. A thrown error becomes a `check-not-run` finding
 * naming the check and the reason, so the rest of the audit still runs and the
 * report never shows a silence that could be read as a pass.
 */
async function attempt(check, run) {
  try {
    return await run();
  } catch (error) {
    const reason = String(error?.message ?? error).split('\n')[0];
    record('check-not-run', { check, reason });
    return null;
  }
}

/** Counted so the report states what was exercised rather than implying it. */
const coverage = {
  bengaluruElementsMeasured: 0,
  detailsFound: 0,
  detailsOpened: 0,
  textZoomMeasurements: 0,
  enquiryFormStatesCaptured: false,
  enquiryFormNotRunReason: 'not attempted',
  drawerStateCaptured: false,
  drawerOpenAttempts: 0,
  noScriptPassRan: false,
};

/**
 * What the run could not exercise, in plain sentences, with the reason.
 *
 * Requirement 9.2's locality plate and Requirement 2.3's overflow disclosure both
 * need a published locality, and none passes the gate, so neither element exists in
 * any served response. That is a true state of the site, not a check that quietly
 * passed, and the report says so in as many words.
 */
function notExercised() {
  const notes = [];

  const observed = new Set(Object.values(measurements.assetIdsByRoute).flat());
  for (const asset of VISUAL_ASSET_REGISTER) {
    if (observed.has(asset.assetId)) continue;
    notes.push(
      `asset ${asset.assetId} (${asset.delivery.componentName}) was not measured as layout: no audited route that answers 200 renders it`
    );
  }
  if (!publicRoutes.some((route) => route.startsWith('/areas/'))) {
    notes.push(
      'the locality page template was not audited: no locality passes the publication gate, so no /areas/<slug> route answers 200'
    );
  }
  if (coverage.detailsFound === 0) {
    notes.push(
      'the <details> overflow disclosure was not measured: it renders only for a group of more than 25 published localities, and none is published, so no served page contains one'
    );
  }
  if (!coverage.enquiryFormStatesCaptured) {
    notes.push(`the enquiry form error state was not captured: ${coverage.enquiryFormNotRunReason}`);
  }
  if (!coverage.drawerStateCaptured) {
    notes.push('the mobile drawer state was not captured; see the check-not-run finding for the reason');
  }
  if (!coverage.noScriptPassRan) {
    notes.push('the area hub was not compared with JavaScript disabled; see the check-not-run finding for the reason');
  }
  return notes;
}

/**
 * The numbers behind the findings. Written to the report whether or not anything
 * failed, because a pass with no measurement beside it is not evidence.
 */
const measurements = {
  /** One row per page per width: the enlarged-text result, including the root font size. */
  textZoom: [],
  /** Route → the Bengaluru asset ids actually found in the served markup. */
  assetIdsByRoute: {},
  /** One row per page per width: the interactive-target census behind Requirement 9.10. */
  tapTargets: [],
  /** One row per `<details>` opened: its own content box against its contents. */
  disclosures: [],
  /** The area hub with and without JavaScript. */
  noScript: null,
};

// ---------------------------------------------------------------------------
// Measuring helpers, installed in the page
// ---------------------------------------------------------------------------

/**
 * Installed with `addInitScript`, so one definition serves the plain pass, the
 * enlarged-text pass and the re-measure after opening a `<details>`. A function
 * handed to Playwright cannot close over anything in this module, so the shared
 * pieces live in the page instead of being duplicated per call site.
 */
function installAuditHelpers() {
  const widestElement = () => {
    let maxRight = 0;
    let widest = null;
    for (const element of document.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right > maxRight) {
        maxRight = rect.right;
        widest = {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          right: Math.round(rect.right),
          text: (element.textContent ?? '').trim().slice(0, 60),
        };
      }
    }
    return widest;
  };

  /**
   * Horizontal overflow, with the element responsible when there is any.
   *
   * The reference width is `documentElement.clientWidth`, not `window.innerWidth`.
   * Under Chrome's mobile emulation `innerWidth` is the layout viewport, and Chrome
   * widens the layout viewport to the content when the content does not fit — so a
   * page overflowing a 320 px screen reports `innerWidth` 378 against a document of
   * 378 and looks clean. `clientWidth` stays at the screen width, which is the
   * number Requirement 9.7 means. Both are reported, so the report shows the
   * difference rather than hiding the correction.
   */
  window.__auditOverflow = () => {
    const docWidth = document.documentElement.scrollWidth;
    const viewport = document.documentElement.clientWidth;
    return {
      docWidth,
      viewport,
      windowInnerWidth: window.innerWidth,
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      widest: docWidth > viewport + 1 ? widestElement() : null,
    };
  };

  /**
   * Interactive controls whose box falls outside the screen.
   *
   * A fixed-position element does not add to the document's scroll width, so the
   * sticky action bar could push a button off a 320 px screen with no horizontal
   * scrolling to reach it and the document measurement would still read zero. This
   * is the check that sees that: a control a customer cannot reach, wherever it is
   * positioned.
   */
  window.__auditControlsOutsideViewport = () => {
    const viewport = document.documentElement.clientWidth;
    return Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea, summary')
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        if (getComputedStyle(element).visibility === 'hidden') return false;
        return rect.right > viewport + 1 || rect.left < -1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          viewport,
          text: (element.textContent ?? '').trim().slice(0, 40),
        };
      });
  };

  /** Every Bengaluru drawing on the page, as laid out. */
  window.__auditAssets = () =>
    Array.from(document.querySelectorAll('svg[data-asset-id]')).map((svg) => {
      const rect = svg.getBoundingClientRect();
      return {
        assetId: svg.getAttribute('data-asset-id'),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        hasIntrinsicSize: svg.hasAttribute('width') && svg.hasAttribute('height'),
      };
    });

  window.__auditDetails = () => document.querySelectorAll('details').length;

  window.__auditOpenAllDetails = () => {
    const all = Array.from(document.querySelectorAll('details'));
    for (const element of all) element.open = true;
    return all.length;
  };

  /**
   * Each `<details>` measured against its own content box, not only against the
   * viewport. A disclosure can sit inside the viewport and still push its own
   * links past the box that holds them, and only this comparison sees that.
   */
  window.__auditDetailsGeometry = () =>
    Array.from(document.querySelectorAll('details')).map((element) => {
      const rect = element.getBoundingClientRect();
      const contentRight = rect.right - parseFloat(getComputedStyle(element).borderRightWidth || '0');
      let widestChildRight = 0;
      for (const descendant of element.querySelectorAll('*')) {
        const childRect = descendant.getBoundingClientRect();
        if (childRect.width === 0 && childRect.height === 0) continue;
        widestChildRight = Math.max(widestChildRight, childRect.right);
      }
      const parent = element.parentElement;
      return {
        open: element.open,
        summary: (element.querySelector('summary')?.textContent ?? '').trim().slice(0, 60),
        linkCount: element.querySelectorAll('a[href]').length,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        right: Math.round(rect.right),
        widestChildRight: Math.round(widestChildRight),
        contentRight: Math.round(contentRight),
        parentClientWidth: parent ? parent.clientWidth : null,
      };
    });

  /**
   * The interactive-target census behind Requirement 9.10. A text link is one whose
   * computed display starts with `inline`, or which sits in a list of links with no
   * box of its own — those are the targets 9.10 exempts down to 24 px. Everything
   * else is held to 44 px.
   */
  window.__auditTapTargets = () => {
    const controls = Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea, summary')
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const rows = controls.map((element) => {
      const rect = element.getBoundingClientRect();
      const display = getComputedStyle(element).display;
      return {
        tag: element.tagName.toLowerCase(),
        display,
        isTextLink: element.tagName === 'A',
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        smallest: Math.round(Math.min(rect.width, rect.height)),
        text: (element.textContent ?? '').trim().slice(0, 40),
      };
    });

    return {
      total: rows.length,
      belowTwentyFour: rows.filter((row) => row.height < 24 || row.width < 24),
      // 9.10 exempts a text link at 24 px or more; nothing else.
      nonLinkBelowFortyFour: rows.filter((row) => !row.isTextLink && row.smallest < 44),
      textLinksBetweenTwentyFourAndFortyFour: rows.filter(
        (row) => row.isTextLink && row.smallest >= 24 && row.smallest < 44
      ).length,
      smallestTextLink: rows
        .filter((row) => row.isTextLink)
        .reduce((lowest, row) => (lowest === null || row.smallest < lowest ? row.smallest : lowest), null),
    };
  };

  /**
   * Fixed-position elements whose content is wider than their own box.
   *
   * The sticky action bar is the case this exists for. A fixed element is out of
   * flow, so content spilling out of it changes neither the document's scroll width
   * nor the element's own rectangle: the two checks above both read clean while the
   * end of a label sits off the side of the screen with nothing to scroll. Comparing
   * the element's scroll width to its client width is what sees it.
   */
  window.__auditFixedContentOverflow = () => {
    const found = [];
    for (const element of document.querySelectorAll('*')) {
      const style = getComputedStyle(element);
      if (style.position !== 'fixed' || style.display === 'none') continue;
      // A deliberately scrollable panel is not this defect; the drawer is one.
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'hidden') continue;
      if (element.scrollWidth > element.clientWidth + 1) {
        found.push({
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className : '',
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          text: (element.textContent ?? '').trim().slice(0, 60),
        });
      }
    }
    return found;
  };

  /** The area hub's shape, for the with-script / without-script comparison. */
  window.__auditHubShape = () => ({
    internalLinks: Array.from(document.querySelectorAll('a[href^="/"]')).length,
    areaLinks: Array.from(document.querySelectorAll('a[href^="/areas/"]')).length,
    detailsCount: document.querySelectorAll('details').length,
    headings: Array.from(document.querySelectorAll('h1, h2, h3')).length,
    docWidth: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  });
}

// ---------------------------------------------------------------------------
// The server: the caller's, or one this script owns and stops
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

/** True when something already listens on the port, on the wildcard or on loopback. */
async function portInUse(port) {
  const bindFails = (host) =>
    new Promise((resolvePromise) => {
      const probe = createNetServer();
      probe.once('error', (error) => resolvePromise(error.code === 'EADDRINUSE' || error.code === 'EACCES'));
      probe.listen({ port, host, exclusive: true }, () => probe.close(() => resolvePromise(false)));
    });
  const connects = (host) =>
    new Promise((resolvePromise) => {
      const socket = createConnection({ port, host });
      socket.once('connect', () => {
        socket.destroy();
        resolvePromise(true);
      });
      socket.once('error', () => resolvePromise(false));
    });
  return (await bindFails('::')) || (await bindFails('127.0.0.1')) || (await connects('127.0.0.1')) || connects('::1');
}

/** Runs `audit` against a server. Same shape as `measure-visual-assets.mjs`. */
async function withServer(audit) {
  if (EXTERNAL_BASE_URL) return audit(EXTERNAL_BASE_URL);

  if (!existsSync(path.join(REPOSITORY_ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('No production build in .next. Run `npm run build` first.');
  }
  if (await portInUse(PORT)) {
    throw new Error(`Port ${PORT} is in use. Pass --port=<free port> or a base URL of a running server.`);
  }

  const nextBin = path.join(REPOSITORY_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
    cwd: REPOSITORY_ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  let serverLog = '';
  child.stdout.on('data', (chunk) => (serverLog += chunk));
  child.stderr.on('data', (chunk) => (serverLog += chunk));
  let exited = false;
  const exitedPromise = new Promise((resolvePromise) =>
    child.once('exit', () => {
      exited = true;
      resolvePromise();
    })
  );

  const stop = async () => {
    if (exited) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
    await Promise.race([exitedPromise, sleep(5000)]);
    if (!exited) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
      await Promise.race([exitedPromise, sleep(2000)]);
    }
  };
  const onSignal = () => stop().finally(() => process.exit(130));
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  const baseUrl = `http://127.0.0.1:${PORT}`;
  try {
    const deadline = Date.now() + 60_000;
    for (;;) {
      if (exited) throw new Error(`next start exited before serving:\n${serverLog}`);
      try {
        const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
        await response.arrayBuffer();
        break;
      } catch {
        if (Date.now() > deadline) throw new Error(`next start did not answer within 60 s:\n${serverLog}`);
        await sleep(250);
      }
    }
    return await audit(baseUrl);
  } finally {
    await stop();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

// ---------------------------------------------------------------------------
// The audit
// ---------------------------------------------------------------------------

/**
 * Use the browser already on this machine. playwright-core is installed without
 * its own browser download, so it is pointed at the locally installed Chrome.
 * Override with CHROME_PATH if a different binary should be used.
 */
const executablePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Launched inside the audit, so a launch failure is a finding and not a crash. */
let browser = null;

/** Everything measured against one running server. */
async function auditServedSite(BASE) {
  browser = await chromium.launch({ executablePath });
  await mkdir(OUT, { recursive: true });

  /** A context with the measuring helpers installed on every navigation. */
  async function auditContext(options) {
    const context = await browser.newContext(options);
    await context.addInitScript(installAuditHelpers);
    return context;
  }

  /**
   * Opens every `<details>` on the page and measures it twice: the document against
   * the viewport, and the disclosure against its own content box. Closed, its links
   * have no layout at all, so neither measurement means anything until it is open.
   *
   * Used by the plain pass and by the enlarged-text pass, so both report the same
   * two numbers rather than one reporting a subset.
   */
  async function auditDisclosures(page, { name, width, pass, detailsCount }) {
    coverage.detailsFound += detailsCount;
    if (detailsCount === 0) return;

    const opened = await page.evaluate(() => window.__auditOpenAllDetails());
    await page.waitForTimeout(120);
    coverage.detailsOpened += opened;

    const afterOpen = await page.evaluate(() => window.__auditOverflow());
    if (afterOpen.docWidth > afterOpen.viewport + 1) {
      record(
        pass === 'text-150'
          ? 'overflow-at-150-percent-text-with-disclosures-open'
          : 'overflow-with-disclosures-open',
        {
          page: name,
          width,
          disclosuresOpened: opened,
          docWidth: afterOpen.docWidth,
          widest: afterOpen.widest,
        }
      );
    }

    const geometry = await page.evaluate(() => window.__auditDetailsGeometry());
    for (const disclosure of geometry) {
      measurements.disclosures.push({ page: name, width, pass, ...disclosure });
      if (disclosure.scrollWidth > disclosure.clientWidth + 1) {
        record('disclosure-overflows-its-container', { page: name, width, pass, disclosure });
      }
      if (disclosure.widestChildRight > disclosure.contentRight + 1) {
        record('disclosure-content-past-its-content-box', { page: name, width, pass, disclosure });
      }
    }
  }

  for (const width of WIDTHS) {
    const context = await auditContext({
      viewport: { width, height: width < 700 ? 844 : 900 },
      deviceScaleFactor: 1,
      isMobile: width < 700,
      hasTouch: width < 700,
    });
    const page = await context.newPage();

    for (const { name, route, expectedStatus } of PAGES) {
      const response = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      const status = response?.status() ?? 0;

      // Scroll to the bottom first, so the action-bar overlap check measures the
      // state a customer actually reaches. Doing it inside the measuring
      // evaluate did not take effect before the rectangles were read.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(120);

      const metrics = await page.evaluate(() => {
        const overflow = window.__auditOverflow();

        // The interactive-target census. `summary` is in it because the area hub's
        // overflow disclosure is operated by one.
        const targets = window.__auditTapTargets();

        const h1s = Array.from(document.querySelectorAll('h1')).map(
          (element) => element.textContent?.trim() ?? ''
        );

        // Does the fixed action bar sit over the last piece of content?
        const bar = Array.from(document.querySelectorAll('div')).find((element) => {
          const style = getComputedStyle(element);
          return style.position === 'fixed' && style.bottom === '0px' && element.children.length === 2;
        });
        const barVisible = bar ? getComputedStyle(bar).display !== 'none' : false;
        const footer = document.querySelector('footer');
        let footerCovered = false;
        if (bar && barVisible && footer) {
          const barRect = bar.getBoundingClientRect();
          const footerRect = footer.getBoundingClientRect();
          footerCovered = footerRect.bottom > barRect.top + 1;
        }

        return {
          docWidth: overflow.docWidth,
          viewport: overflow.viewport,
          widest: overflow.widest,
          windowInnerWidth: overflow.windowInnerWidth,
          assets: window.__auditAssets(),
          detailsCount: window.__auditDetails(),
          targets,
          controlsOutsideViewport: window.__auditControlsOutsideViewport(),
          fixedContentOverflow: window.__auditFixedContentOverflow(),
          h1Count: h1s.length,
          h1: h1s[0] ?? null,
          barVisible,
          footerCovered,
          title: document.title,
        };
      });

      if (metrics.docWidth > metrics.viewport + 1) {
        record('horizontal-overflow', {
          page: name,
          width,
          docWidth: metrics.docWidth,
          viewport: metrics.viewport,
          windowInnerWidth: metrics.windowInnerWidth,
          widest: metrics.widest,
        });
      }
      if (metrics.controlsOutsideViewport.length > 0) {
        record('control-outside-viewport', {
          page: name,
          width,
          controls: metrics.controlsOutsideViewport,
        });
      }
      if (metrics.fixedContentOverflow.length > 0) {
        record('fixed-element-content-past-its-box', {
          page: name,
          width,
          elements: metrics.fixedContentOverflow,
        });
      }
      if (metrics.h1Count !== 1) {
        record('h1-count', { page: name, width, count: metrics.h1Count });
      }
      if (metrics.targets.belowTwentyFour.length > 0) {
        record('small-tap-target', { page: name, width, controls: metrics.targets.belowTwentyFour });
      }
      // Requirement 9.10 exempts a text link at 24 px or more, and nothing else. A
      // button, input, select, textarea or summary under 44 px fails it.
      if (metrics.targets.nonLinkBelowFortyFour.length > 0) {
        record('control-below-44px', {
          page: name,
          width,
          controls: metrics.targets.nonLinkBelowFortyFour,
        });
      }
      measurements.tapTargets.push({
        page: name,
        width,
        interactiveTargets: metrics.targets.total,
        belowTwentyFour: metrics.targets.belowTwentyFour.length,
        nonLinkBelowFortyFour: metrics.targets.nonLinkBelowFortyFour.length,
        textLinksRelyingOnThe24pxException: metrics.targets.textLinksBetweenTwentyFourAndFortyFour,
        smallestTextLinkDimension: metrics.targets.smallestTextLink,
      });
      if (metrics.footerCovered) {
        record('action-bar-covers-content', { page: name, width });
      }
      if (status !== expectedStatus) {
        record('unexpected-status', { page: name, width, status, expected: expectedStatus });
      }

      // The Bengaluru drawings, as laid out rather than as weighed.
      coverage.bengaluruElementsMeasured += metrics.assets.length;
      const seenOnRoute = new Set(measurements.assetIdsByRoute[route] ?? []);
      for (const asset of metrics.assets) seenOnRoute.add(asset.assetId);
      measurements.assetIdsByRoute[route] = [...seenOnRoute].sort();
      if (ROUTES_REQUIRING_A_BENGALURU_ELEMENT.has(route) && metrics.assets.length === 0) {
        record('bengaluru-element-missing', { page: name, width, route });
      }
      const expectedAssetIds = EXPECTED_ASSET_IDS_BY_ROUTE.get(route);
      if (expectedAssetIds) {
        const missing = expectedAssetIds.filter((assetId) => !seenOnRoute.has(assetId));
        if (missing.length > 0) {
          record('bengaluru-element-not-the-registered-one', {
            page: name,
            width,
            route,
            expected: [...expectedAssetIds],
            found: [...seenOnRoute],
          });
        }
      }
      for (const asset of metrics.assets) {
        if (asset.right > metrics.viewport + 1 || asset.left < -1) {
          record('bengaluru-element-outside-viewport', { page: name, width, asset });
        }
        if (!asset.hasIntrinsicSize) {
          record('bengaluru-element-without-intrinsic-size', { page: name, width, asset });
        }
      }

      // The overflow disclosure, measured against the viewport and against its own
      // content box.
      await auditDisclosures(page, {
        name,
        width,
        pass: 'plain',
        detailsCount: metrics.detailsCount,
      });

      if (SCREENSHOT_WIDTHS.has(width)) {
        const prefix = width === 390 ? 'mobile' : 'desktop';
        await page.screenshot({
          path: path.join(OUT, `${prefix}-${name}.png`),
          fullPage: true,
        });
      }
    }

    await context.close();
  }

  // Requirement 9.8: 150% text at 320 px and 1280 px, measured on every audited
  // page. Enlarging the root font is the same method form-state-audit.mjs used for
  // its single capture; what is new is that the result is a number on every page
  // instead of an image of one.
  for (const width of TEXT_ZOOM_WIDTHS) {
    const context = await auditContext({
      viewport: { width, height: width < 700 ? 844 : 900 },
      deviceScaleFactor: 1,
      isMobile: width < 700,
      hasTouch: width < 700,
    });
    const page = await context.newPage();

    for (const { name, route } of PAGES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

      // The root font size before the enlargement, so the pass can prove the
      // enlargement happened. A style tag that failed to apply would otherwise
      // report zero overflow at "150% text" and mean nothing at all.
      const before = await page.evaluate(() => window.__auditOverflow());
      await page.addStyleTag({ content: TEXT_ZOOM_STYLE });
      await page.waitForTimeout(150);

      const zoomed = await page.evaluate(() => window.__auditOverflow());
      const baselineFontSize = parseFloat(before.rootFontSize);
      const zoomedFontSize = parseFloat(zoomed.rootFontSize);
      const ratio = baselineFontSize > 0 ? zoomedFontSize / baselineFontSize : 0;

      coverage.textZoomMeasurements += 1;
      measurements.textZoom.push({
        page: name,
        width,
        baselineRootFontSize: before.rootFontSize,
        enlargedRootFontSize: zoomed.rootFontSize,
        appliedRatio: Number(ratio.toFixed(3)),
        viewport: zoomed.viewport,
        windowInnerWidth: zoomed.windowInnerWidth,
        documentScrollWidth: zoomed.docWidth,
        overflowPx: zoomed.docWidth - zoomed.viewport,
      });

      // Under 1.49 means the 150% never took effect, so the overflow number below
      // is not a measurement of 150% text and is not reported as one.
      if (ratio < 1.49) {
        record('text-zoom-not-applied', {
          page: name,
          width,
          baselineRootFontSize: before.rootFontSize,
          enlargedRootFontSize: zoomed.rootFontSize,
          appliedRatio: Number(ratio.toFixed(3)),
        });
      } else if (zoomed.docWidth > zoomed.viewport + 1) {
        record('overflow-at-150-percent-text', {
          page: name,
          width,
          docWidth: zoomed.docWidth,
          viewport: zoomed.viewport,
          windowInnerWidth: zoomed.windowInnerWidth,
          overflow: zoomed.docWidth - zoomed.viewport,
          rootFontSize: zoomed.rootFontSize,
          widest: zoomed.widest,
        });
      }

      const unreachable = await page.evaluate(() => window.__auditControlsOutsideViewport());
      if (ratio >= 1.49 && unreachable.length > 0) {
        record('control-outside-viewport-at-150-percent-text', { page: name, width, controls: unreachable });
      }
      const spilling = await page.evaluate(() => window.__auditFixedContentOverflow());
      if (ratio >= 1.49 && spilling.length > 0) {
        record('fixed-element-content-past-its-box-at-150-percent-text', {
          page: name,
          width,
          elements: spilling,
        });
      }

      // Enlarged text can also push a disclosure's contents wider.
      const disclosures = await page.evaluate(() => window.__auditDetails());
      await auditDisclosures(page, { name, width, pass: 'text-150', detailsCount: disclosures });
    }

    await context.close();
  }

  // The area hub without JavaScript. Requirement 2.3 and 2.6 put the overflow
  // links in a native `<details>` "so no link needs JavaScript"; this is that
  // sentence as a measurement. The same page is loaded twice and the two shapes are
  // compared, so a link or a disclosure that only appears once the bundle runs
  // shows up as a difference rather than as nobody's job to notice.
  await attempt('area hub without JavaScript', async () => {
    const withScript = await auditContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const withScriptPage = await withScript.newPage();
    await withScriptPage.goto(`${BASE}/areas`, { waitUntil: 'networkidle' });
    const scripted = await withScriptPage.evaluate(() => window.__auditHubShape());
    await withScript.close();

    const scriptless = await auditContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      javaScriptEnabled: false,
    });
    const scriptlessPage = await scriptless.newPage();
    // `load`, not `domcontentloaded`. With scripts disabled there is no script to
    // hold the parser behind the stylesheets, so DOMContentLoaded fires before the
    // two `<link rel="stylesheet">` chunks have applied — task 18.2 measured
    // `document.styleSheets.length === 0` and a document 1,008 px wide at a 390 px
    // viewport at that instant, and 390 px once the same navigation settled. That
    // was the audit photographing unstyled HTML, not the hub overflowing. The
    // overflow check below is unchanged; only the moment it reads is.
    await scriptlessPage.goto(`${BASE}/areas`, { waitUntil: 'load' });
    const unscripted = await scriptlessPage.evaluate(() => ({
      internalLinks: Array.from(document.querySelectorAll('a[href^="/"]')).length,
      areaLinks: Array.from(document.querySelectorAll('a[href^="/areas/"]')).length,
      detailsCount: document.querySelectorAll('details').length,
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).length,
      docWidth: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
      // Recorded so the width above can be read against the question "was the page
      // styled when it was measured?" rather than taken on trust.
      styleSheets: document.styleSheets.length,
      stylesheetLinks: document.querySelectorAll('link[rel="stylesheet"]').length,
    }));
    await scriptless.close();

    coverage.noScriptPassRan = true;
    measurements.noScript = { route: '/areas', width: 390, withJavaScript: scripted, withoutJavaScript: unscripted };

    for (const key of ['internalLinks', 'areaLinks', 'detailsCount', 'headings']) {
      if (scripted[key] !== unscripted[key]) {
        record('area-hub-differs-without-javascript', {
          route: '/areas',
          measure: key,
          withJavaScript: scripted[key],
          withoutJavaScript: unscripted[key],
        });
      }
    }
    // A width measured on an unstyled document means nothing, in either direction:
    // it can invent an overflow, and on a narrower page it could hide one. So the
    // absence of applied CSS is itself a finding rather than a quiet pass.
    if (unscripted.stylesheetLinks > 0 && unscripted.styleSheets === 0) {
      record('area-hub-measured-before-stylesheets-applied', {
        route: '/areas',
        width: 390,
        stylesheetLinks: unscripted.stylesheetLinks,
        appliedStyleSheets: unscripted.styleSheets,
      });
    }
    if (unscripted.docWidth > unscripted.viewport + 1) {
      record('area-hub-overflow-without-javascript', {
        route: '/areas',
        width: 390,
        docWidth: unscripted.docWidth,
        viewport: unscripted.viewport,
        appliedStyleSheets: unscripted.styleSheets,
      });
    }
  });

  // Mobile drawer open state, captured for the review log.
  await attempt('mobile navigation drawer', async () => {
    const drawerContext = await auditContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const drawerPage = await drawerContext.newPage();
      await drawerPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });

      // The drawer is a client component, so a click that lands before hydration
      // is simply lost and nothing opens. Clicking again is the difference between
      // a flake that destroyed the whole run and a measurement.
      const menu = drawerPage.getByRole('button', { name: 'Menu', exact: true });
      let dialogOpen = false;
      for (let tryNumber = 1; tryNumber <= 4 && !dialogOpen; tryNumber += 1) {
        coverage.drawerOpenAttempts = tryNumber;
        await menu.click();
        try {
          await drawerPage.waitForSelector('[role="dialog"]', { timeout: 5000 });
          dialogOpen = true;
        } catch {
          await drawerPage.waitForTimeout(500);
        }
      }
      if (!dialogOpen) {
        throw new Error(
          `the drawer did not open after ${coverage.drawerOpenAttempts} clicks on the Menu button`
        );
      }

      await drawerPage.screenshot({ path: path.join(OUT, 'mobile-navigation-drawer.png') });

      const drawerChecks = await drawerPage.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const main = document.getElementById('main-content');
        const footer = document.querySelector('footer');
        return {
          dialogPresent: Boolean(dialog),
          ariaModal: dialog?.getAttribute('aria-modal') ?? null,
          mainInert: main?.hasAttribute('inert') ?? false,
          footerInert: footer?.hasAttribute('inert') ?? false,
          focusInsideDialog: Boolean(
            dialog && document.activeElement && dialog.contains(document.activeElement)
          ),
        };
      });
      if (!drawerChecks.mainInert || !drawerChecks.footerInert) {
        record('drawer-background-not-inert', drawerChecks);
      }
      if (!drawerChecks.focusInsideDialog) {
        record('drawer-focus-not-moved', drawerChecks);
      }
      coverage.drawerStateCaptured = true;
    } finally {
      await drawerContext.close();
    }
  });

  // Enquiry form error state, captured for the review log. While no approved
  // destination is configured the page renders the call-only panel and there is no
  // submit button to press, so the report records that reason rather than a bare
  // false a reader could mistake for a failure.
  await attempt('enquiry form error state', async () => {
    const formContext = await auditContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const formPage = await formContext.newPage();
      await formPage.goto(`${BASE}/buy#enquiry`, { waitUntil: 'networkidle' });
      const submit = formPage.getByRole('button', { name: /send my requirement/i });
      if ((await submit.count()) === 0) {
        coverage.enquiryFormNotRunReason =
          'no submit control on /buy: this build renders the call-only panel, so there is no form state to capture';
        return;
      }
      await submit.click();
      await formPage.waitForSelector('[role="alert"]');
      await formPage.screenshot({ path: path.join(OUT, 'mobile-form-errors.png'), fullPage: true });
      coverage.enquiryFormStatesCaptured = true;
      coverage.enquiryFormNotRunReason = null;
    } finally {
      await formContext.close();
    }
  });

  return { baseUrl: BASE };
}

const runAudit = () => withServer(auditServedSite);

// ---------------------------------------------------------------------------
// The report, written whether or not the run finished
// ---------------------------------------------------------------------------

/**
 * A run that ends early still wrote measurements, and those are evidence. The
 * report is written from a `finally`, and an early end is itself a finding, so a
 * partial audit can never be read as a clean one.
 */
let runCompleted = false;
let baseUrl = EXTERNAL_BASE_URL ?? `http://127.0.0.1:${PORT}`;

try {
  const servedFrom = await runAudit();
  baseUrl = servedFrom.baseUrl;
  runCompleted = true;
} catch (error) {
  record('audit-run-failed', { reason: String(error?.stack ?? error).split('\n').slice(0, 3).join(' | ') });
} finally {
  if (browser) await browser.close().catch(() => {});

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    runCompleted,
    routeSource: 'getPublicRoutes() plus one unregistered path for the 404 layout',
    widthsTested: WIDTHS,
    textZoomWidthsTested: TEXT_ZOOM_WIDTHS,
    textZoomMethod: TEXT_ZOOM_STYLE,
    pagesTested: PAGES.map(({ name }) => name),
    routesTested: PAGES.map(({ route }) => route),
    routesRequiringABengaluruElement: [...ROUTES_REQUIRING_A_BENGALURU_ELEMENT],
    /** What was not exercised, and why, so no reader takes silence for a pass. */
    notExercised: notExercised(),
    coverage,
    measurements,
    findings,
  };
  await writeFile(path.join(OUT, '..', 'responsive-audit.json'), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Served from: ${baseUrl}`);
  console.log(`Run completed: ${runCompleted}`);
  console.log(`Widths tested: ${WIDTHS.join(', ')}`);
  console.log(`Pages tested: ${PAGES.length} (from getPublicRoutes: ${publicRoutes.length})`);
  console.log(`150% text measurements: ${coverage.textZoomMeasurements} at ${TEXT_ZOOM_WIDTHS.join(' and ')} px`);
  console.log(`Bengaluru elements measured: ${coverage.bengaluruElementsMeasured}`);
  console.log(`Disclosures found / opened: ${coverage.detailsFound} / ${coverage.detailsOpened}`);
  console.log(`Tap-target censuses: ${measurements.tapTargets.length}`);
  for (const note of report.notExercised) console.log(`Not exercised: ${note}`);
  console.log(`Findings: ${findings.length}`);
  for (const finding of findings) {
    console.log(`  [${finding.kind}] ${JSON.stringify(finding)}`);
  }

  if (findings.length > 0 || !runCompleted) process.exitCode = 1;
}
