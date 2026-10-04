/**
 * Captures the enquiry form states for the manual review log, and checks the
 * behaviour that matters when things go wrong.
 *
 * Requires a preview built with INSTLE_ENQUIRY_INTAKE_ENABLED=true, because the
 * intake mode is resolved on the server when the page is rendered.
 *
 * Usage: node scripts/form-state-audit.mjs [baseUrl] [outDir]
 */

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3216';
const OUT = process.argv[3] ?? 'docs/implementation/screenshots';
const executablePath =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const findings = [];
const browser = await chromium.launch({ executablePath });

async function mobilePage() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  return { context, page: await context.newPage() };
}

/** Synthetic data only. */
async function fillForm(page) {
  await page.getByRole('radio', { name: /flat \/ apartment/i }).check();
  await page.getByLabel(/your name/i).fill('Synthetic Verification Person');
  await page.getByLabel(/phone number/i).fill('9845012345');
  await page.getByRole('checkbox', { name: /happy for/i }).check();
}

try {
  await mkdir(OUT, { recursive: true });

  // 1. Empty state.
  {
    const { context, page } = await mobilePage();
    await page.goto(`${BASE}/buy`, { waitUntil: 'networkidle' });
    await page.locator('#enquiry').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, 'mobile-form-empty.png'), fullPage: true });
    await context.close();
  }

  // 2. Validation error state, plus the focus and association checks.
  {
    const { context, page } = await mobilePage();
    await page.goto(`${BASE}/buy`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /send my requirement/i }).click();
    await page.waitForSelector('[role="alert"]');
    await page.screenshot({ path: path.join(OUT, 'mobile-form-errors.png'), fullPage: true });

    const checks = await page.evaluate(() => {
      const summary = document.querySelector('[role="alert"]');
      const links = Array.from(summary?.querySelectorAll('a') ?? []);
      return {
        focusOnSummary: document.activeElement === summary,
        linkCount: links.length,
        allTargetsExist: links.every((link) =>
          Boolean(document.getElementById(link.getAttribute('href').slice(1)))
        ),
        invalidFieldsMarked: document.querySelectorAll('[aria-invalid="true"]').length,
      };
    });
    if (!checks.focusOnSummary) findings.push({ kind: 'error-summary-not-focused', checks });
    if (!checks.allTargetsExist) findings.push({ kind: 'error-link-target-missing', checks });
    await context.close();
  }

  // 3. Success state, against the real API.
  {
    const { context, page } = await mobilePage();
    await page.goto(`${BASE}/buy`, { waitUntil: 'networkidle' });
    await fillForm(page);
    await page.getByRole('button', { name: /send my requirement/i }).click();
    await page.waitForSelector('[role="status"]', { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT, 'mobile-form-success.png'), fullPage: true });

    const text = await page.locator('[role="status"]').first().innerText();
    if (!/IRE-/.test(text)) findings.push({ kind: 'success-missing-reference', text });
    if (/Synthetic Verification Person|9845012345/.test(text)) {
      findings.push({ kind: 'success-echoes-personal-data', text });
    }
    await context.close();
  }

  // 4. Network failure state.
  {
    const { context, page } = await mobilePage();
    await page.route('**/api/enquiry', (route) => route.abort());
    await page.goto(`${BASE}/sell`, { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: /flat \/ apartment/i }).check();
    await page.getByRole('radio', { name: /i own the property/i }).check();
    await page.getByLabel(/your name/i).fill('Synthetic Verification Person');
    await page.getByLabel(/phone number/i).fill('9845012345');
    await page.getByRole('checkbox', { name: /happy for/i }).check();
    await page.getByRole('button', { name: /send my property details/i }).click();
    await page.waitForSelector('[role="alert"]');
    await page.screenshot({ path: path.join(OUT, 'mobile-form-network-failure.png'), fullPage: true });

    const checks = await page.evaluate(() => {
      const alerts = Array.from(document.querySelectorAll('[role="alert"]'));
      const text = alerts.map((alert) => alert.textContent ?? '').join(' ');
      const nameInput = document.querySelector('input[name="name"]');
      return {
        saysNotSent: /has not been sent|could not/i.test(text),
        offersPhone: Boolean(document.querySelector('a[href="tel:9353096264"]')),
        retainsEnteredName: nameInput?.value === 'Synthetic Verification Person',
        localStorageEntries: window.localStorage.length,
        sessionStorageEntries: window.sessionStorage.length,
      };
    });
    if (!checks.saysNotSent) findings.push({ kind: 'failure-not-stated-plainly', checks });
    if (!checks.offersPhone) findings.push({ kind: 'failure-no-call-fallback', checks });
    if (!checks.retainsEnteredName) findings.push({ kind: 'failure-loses-entered-data', checks });
    if (checks.localStorageEntries > 0 || checks.sessionStorageEntries > 0) {
      findings.push({ kind: 'personal-data-written-to-client-storage', checks });
    }
    await context.close();
  }

  // 5. Call-only state on a page built without intake, for comparison. Rendered
  //    from the same component, so this is captured separately in the review log.

  // 6. Reduced motion, to confirm nothing depends on a transition.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    // The drawer is a client component, so a click that lands before hydration is
    // simply lost and nothing opens. One click and a 30 s wait aborted the whole
    // run in task 18.2 and wrote no report; a probe then opened the drawer on the
    // second click, with role="dialog", aria-modal="true" and aria-expanded="true"
    // all correct. So the click is retried, the way `responsive-audit.mjs` retries
    // it, and a drawer that never opens becomes a finding rather than a crash —
    // the other nine checks and the report survive it either way.
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    let drawerOpen = false;
    let clickAttempts = 0;
    for (let tryNumber = 1; tryNumber <= 4 && !drawerOpen; tryNumber += 1) {
      clickAttempts = tryNumber;
      await menu.click();
      try {
        await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
        drawerOpen = true;
      } catch {
        /* Retried; recorded as a finding below if every attempt is lost. */
      }
    }
    if (drawerOpen) {
      await page.screenshot({ path: path.join(OUT, 'mobile-drawer-reduced-motion.png') });
    } else {
      findings.push({ kind: 'drawer-did-not-open-under-reduced-motion', clickAttempts });
    }
    await context.close();
  }

  // 7. Enlarged text, to confirm the layout survives it.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${BASE}/buy`, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: 'html { font-size: 150% !important; }' });
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    await page.screenshot({ path: path.join(OUT, 'mobile-buy-text-150pc.png'), fullPage: true });
    if (overflow > 1) findings.push({ kind: 'overflow-at-150-percent-text', overflow });
    await context.close();
  }

  await writeFile(
    path.join(OUT, '..', 'form-state-audit.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE, findings }, null, 2)}\n`
  );

  console.log(`Findings: ${findings.length}`);
  for (const finding of findings) console.log(`  ${JSON.stringify(finding)}`);
} finally {
  await browser.close();
}
