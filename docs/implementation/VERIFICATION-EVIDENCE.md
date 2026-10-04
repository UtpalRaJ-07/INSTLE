# Verification evidence

* **Date of run:** 29 September 2026
* **Machine:** macOS (darwin, arm64)
* **Node:** v24.18.0
* **Installed versions confirmed at runtime:** next 16.3.6, react 19.3.0, typescript 5.9.3, vitest 3.2.7

Everything below was run in this session. Nothing is carried over from earlier documentation.

---

## 1. Lint

```
npx eslint .
```

**Clean**, no errors and no warnings.

Three issues were found and fixed during the run:

1. `react-hooks/set-state-in-effect` in `LayoutShell` — closing the drawer on navigation used `setState` inside an effect. Replaced with the render-time adjustment pattern, keying the open state to the route it was opened on.
2. `react/no-unescaped-entities` in a Concept 2 prototype string edited earlier in this work.
3. An unused `eslint-disable` directive in `JsonLd`.

Note: `eslint.config.mjs` ignores `tests/**`. That was pre-existing and left alone to avoid changing unrelated configuration.

---

## 2. TypeScript

```
npx tsc --noEmit
```

**Clean.** No `typecheck` script existed before this work, which is why type errors in the three legacy test files had gone unnoticed.

---

## 3. Tests

```
npx vitest run
```

```
Test Files  16 passed (16)
     Tests  324 passed (324)
```

No Vitest configuration or setup file existed before this work, so `npm test` had nothing runnable. See `DECISION-LOG.md` D-IMPL-12 on the three legacy files.

| File | Tests | Covers |
|---|---|---|
| `claim-gate.test.ts` | 15 | Two-source gate; two same-publisher sources failing; homepage references rejected; missing excerpt and access date; fictional reviewer rejected; expiry; unknown claim ID failing closed |
| `locality-gate.test.ts` | 17 | Publication gate; unconfirmed coverage; missing reviewers; expired review; thin record; status flag unable to bypass failing claims; alias resolution; the live registry publishing nothing |
| `guides.test.ts` | 12 | Own-process vs external-fact gates; legal, tax, fee and commercial topics all blocked; the 30-day answer making no promise; related links only to publishable guides |
| `domain-gate.test.ts` | 22 | Origin parsing; a supplied origin not becoming canonical without confirmation; no canonical, absolute URL or breadcrumb graph while unset; canonical and OG URL once confirmed; preview never indexable |
| `route-policy.test.ts` | 19 | Sitemap membership; no draft route; navigation pointing only at registered routes; robots.txt in both modes; prototypes not disallowed in robots.txt; sitemap 404 until confirmed |
| `enquiry-schema.test.ts` | 25 | Phone validation including the rejected 10–15 digit fallback and four country codes; consent as literal true; marketing never preselected; enum-only option fields; bounds; no value echoed in errors |
| `request-body.test.ts` | 14 | Byte limit with a lying header, an absent header, and a chunked stream; content type; malformed and empty bodies; forwarded-header trust |
| `lead-operations.test.ts` | 28 | Adapter registration guards; success:false, throw, timeout and malformed result all failing; governance preconditions; idempotency including retry-after-failure and concurrent submissions; hashed keys; rate limiting; the durability guard keyed to deploy environment |
| `telemetry.test.ts` | 17 | Event allowlist; unknown fields dropping the event; free-text `sourceComponent` rejected; slug validated against the published registry; step bounds; rejection reasons not echoing values |
| `structured-data.test.ts` | 13 | Script-breaking escapes; no address, rating, offer, sameAs or founder claim; Organization not LocalBusiness |
| `public-content.test.ts` | 27 | Static scan of every public source file: brand, phone, superlatives, guarantees, inventory signals, business facts, client storage, accessibility structure |
| `design-tokens.test.ts` | 21 | Contrast computed from `tokens.css`; no external font; safe-area reservation; reduced motion |
| `accessibility.test.tsx` | 26 | Call-only mode collecting nothing; fieldsets; label association; radio groups; unticked consents; error summary focus and links; success not echoing personal data; failure states; nothing in client storage; conditional fields |
| `brand-invariants.test.tsx` | 14 | Rendered brand and phone in the shell; no disclaimer, address or hours in the footer; action bar targeting the current page |
| `concept-and-api.test.tsx` | 19 | `/api/enquiry` status codes, cache headers, no value echoed, no record leaked, idempotent repeat, rate limiting, consent notice requirement; prototype route classification |
| `ui/mobile-drawer.test.tsx` | 12 | Dialog semantics; focus entry and restoration; Escape; Tab and Shift+Tab trapping over 25 steps each; background inert; close on link activation |

---

## 4. Production build

```
npx next build
```

**Succeeded.** 18 static pages generated, including the 3 published guides. No locality page generated, because none is publishable.

---

## 5. Running server — domain unconfirmed (the default)

`next start`, default configuration.

```
/                                                            200
/buy /sell /rent /rent-out /commercial                       200
/areas /guides /how-it-works /about /contact                 200
/about/utpal-raj-kb                                          200
/guides/can-a-broker-guarantee-a-property-sale-in-30-days    200
/areas/indiranagar                                           404
/areas/north-bengaluru                                       404
/areas/whitefield-inner-enclaves                             404
/guides/how-brokerage-fees-work                              404
/nonexistent                                                 404
/sitemap.xml                                                 404
/robots.txt                                                  200
```

`robots.txt`:

```
User-Agent: *
Disallow: /
```

Homepage head and body:

| Check | Result |
|---|---|
| `<title>` | `Buy, sell or rent property in Bengaluru — INSTLE REAL ESTATE` |
| canonical tags | 0 |
| `og:url` tags | 0 |
| robots meta | `noindex, nofollow` |
| external font requests | 0 |
| `<h1>` count | 1 |
| phone digits in unhydrated HTML | 35 |
| `tel:` links | 6, all exactly `tel:9353096264` |
| brand occurrences | 32, all exact |

JSON-LD: `Organization` + `Person` only. No `@id`, no `url`, no address, no rating, no `sameAs`, no founder claim.

---

## 6. Running server — domain confirmed, production

Built and run with `INSTLE_DEPLOY_ENV=production INSTLE_DOMAIN_CONFIRMED=true INSTLE_PUBLIC_ORIGIN=https://verification-only.example`. A throwaway origin, used only to prove the mechanism.

| Check | Result |
|---|---|
| `/concept-1`, `/concept-1/intake`, `/concept-2`, `/concept-2/intake`, `/concept-review` | **404** |
| `robots.txt` | `Allow: /`, `Disallow: /api/`, `Sitemap: https://verification-only.example/sitemap.xml` |
| `/sitemap.xml` | 200, **15 URLs** — 12 static plus 3 guides. No locality slug, no prototype |
| `/buy` canonical | `https://verification-only.example/buy` |
| `/buy` robots meta | `index, follow` |
| `/buy` `og:url` | `https://verification-only.example/buy` |
| `/areas/indiranagar` | Still 404, still `noindex` |
| Owner profile JSON-LD | Organization + Person + BreadcrumbList, all with absolute URLs |

This found V-2 in the audit: `robots.txt`, the sitemap and the prototype guard had been statically prerendered, so confirming a domain after the build had no effect. All six now render per request.

---

## 7. Enquiry API — synthetic end-to-end

### Call-only mode (the default)

```
POST /api/enquiry  →  503
{"success":false,"code":"intake-disabled",
 "error":"Online enquiries are not switched on yet. Please call 9353096264 ...",
 "phone":"9353096264"}

GET /api/enquiry   →  405
Cache-Control: no-store, no-cache, must-revalidate
X-Robots-Tag: noindex, nofollow
```

### Intake enabled, synthetic data only

| Case | Status | Body |
|---|---|---|
| Valid submission | **200** | `reference: IRE-1S485F3O0561`, `isDuplicate: false`. No name, phone, area or record field in the response |
| Identical repeat | **200** | Same reference, `isDuplicate: true` |
| `consent: false` | **422** | `errors.consent` |
| `consent: "true"` (string) | **422** | `errors.consent` — not coerced |
| `content-type: text/plain` | **415** | Plus the phone number |
| Malformed JSON | **400** | Plus the phone number |
| 40 KB body, **chunked, no Content-Length** | **413** | This is the P0 finding, proven fixed |
| Rent a plot (excluded combination) | **422** | `errors.assetType` |
| `phone: "0000000000"` | **422** | `errors.phone` |
| Sell with no ownership role | **422** | `errors.ownershipRole` |
| 6 submissions from one client bucket | 200×5 then **429** | Rate limit holds |

Failure-mode behaviour (adapter returning `success: false`, throwing, timing out, returning a malformed result, and no destination at all) is covered by unit tests rather than the running server, because it needs an adapter that misbehaves on demand. All produce a retriable failure and the call path; none produces success.

---

## 8. Responsive and layout audit

`node scripts/responsive-audit.mjs` — 14 pages × 6 widths (320, 360, 390, 768, 1280, 1440).

**0 findings.** Full detail and the three rounds it took in `DESIGN-AND-MEDIA.md`, machine output in `responsive-audit.json`.

The script was extended in task 18.1 — the page list now comes from `getPublicRoutes()`, 150% text is measured rather than photographed, and the Bengaluru drawings and the overflow disclosure are checked. See section 13.5 for that run; `responsive-audit.json` now holds its output rather than this one's.

## 9. Form state audit

`node scripts/form-state-audit.mjs` — **0 findings** across 10 checks. Machine output in `form-state-audit.json`.

## 10. Performance, lab only

`npm run measure:js`: **137.67 KB gzip** downloaded by a modern browser against a 170 KB budget, 32.33 KB headroom. Build-artifact gzip estimate, not a browser network measurement.

---

## 11. Blocked and not done

| Item | Why |
|---|---|
| **Git state** | `git status`, `git rev-parse` and `git log` all fail with "You have not agreed to the Xcode license agreements." `/usr/bin/git` is the only Git on the machine. Accepting a system licence on the owner's behalf is not appropriate, so branch, HEAD and uncommitted changes are **unverified**. No file was deleted; every change is a new file or a targeted edit to a file read first. |
| **Screen reader testing** | No VoiceOver or NVDA pass. Structure and focus were verified; how they sound was not. |
| **Real device testing** | Chrome with device emulation on one machine. No physical phone, no Safari, no Firefox. |
| **Field performance** | No traffic exists. Lab measurement only. |
| **Live search behaviour** | No domain, so no Search Console, no Bing Webmaster Tools, no indexing, no ranking, no AI-search observation. None of it was simulated. |
| **Real lead delivery** | No approved destination. All traffic went to the in-memory staging adapter with synthetic data. |
| **Deployment** | None. No purchase, no DNS change, no external profile edit, no customer contact. |

## 12. Reproducing all of it

```bash
npm run verify        # lint, typecheck, test, build

# Domain-unset preview (the launch-ready state)
npx next start -p 3215

# Confirmed-domain mode, to check canonicals, sitemap and prototype 404s
INSTLE_DEPLOY_ENV=production INSTLE_DOMAIN_CONFIRMED=true \
  INSTLE_PUBLIC_ORIGIN=https://verification-only.example npx next build
INSTLE_DEPLOY_ENV=production INSTLE_DOMAIN_CONFIRMED=true \
  INSTLE_PUBLIC_ORIGIN=https://verification-only.example npx next start -p 3212

# Intake enabled, synthetic data only
INSTLE_ENQUIRY_INTAKE_ENABLED=true npx next build
INSTLE_DEPLOY_ENV=preview INSTLE_ENQUIRY_INTAKE_ENABLED=true \
  INSTLE_CONSENT_NOTICE_VERSION=local-verification-v1 \
  INSTLE_TRUSTED_PROXY_HOPS=1 npx next start -p 3216

# Audits and screenshots
node scripts/responsive-audit.mjs http://127.0.0.1:3215
node scripts/form-state-audit.mjs http://127.0.0.1:3216
npm run measure:js
```

---


# 13. Task 18.2 — the gate run for SEO content and Bengaluru identity

* **Date of run:** 29 September 2026, 19:09 to 20:12 IST
* **Machine:** macOS (darwin, arm64), same machine as the run above. It was quiet until
  about 19:42, after which unrelated workloads — an Android emulator, a `node` process at
  106% CPU, a `java` process, a Virtualization VM — took the load average to 62. Every
  gate had already produced a figure before that. Which runs were contended, and what it
  did to them, is in 13.3; nothing else in this section is a contended measurement.
* **Node:** v24.18.0 · next 16.3.6 · vitest 3.2.7 · fast-check 4.10.2 · playwright-core 1.57.0
* **Build under test:** `.next` BUILD\_ID `TGrTHs2AcF1J-QbO-ppfJ`, produced by `npm run build`
* **State the tree was in:** task 18.1 had just changed `src/components/Header/Header.module.css`,
  `src/components/MobileActionBar/MobileActionBar.module.css` and `src/styles/tokens.css`.
  Every gate below was re-run against that state rather than carried over.

Every command is recorded with the exit code it returned and the figures it printed.
Three checks failed on their first run. All three were harness defects, not defects in
the site; each is written up in full with how it was diagnosed and what was changed.
No threshold, budget, gate or test was altered to make any line read green.

> This section replaces an earlier, partial 18.2 write-up. That attempt ran while other
> tasks were editing `tests/` and it recorded two figures that this run shows were
> wrong: it explained the `MAP-AREA` weight drift as the script serialising something
> other than the worst case, and the true cause is the opposite — see 13.5. Its test
> tallies are superseded by 13.3.

## 13.1 Command by command

| # | Command | Exit | Headline figure |
|---|---|---|---|
| 1 | `npm run lint` | **0** | eslint over the repository: zero errors, zero warnings |
| 2 | `npm run typecheck` | **0** | `tsc --noEmit`: zero errors |
| 3 | `npm run test` | **0** | **69 test files, 1,939 tests, all passed** in 30.75 s. Exit 0 on five of eleven runs, including the last one; the six non-zero runs are load, not code. Every run, good and bad, is in 13.3 |
| 4 | `npm run build` | **0** | `prebuild` passed (69 files, 1,939 tests), then `next build` compiled in 740 ms, TypeScript in 1,924 ms, 10 static pages generated, deployable output written to `.next` |
| 5 | `node scripts/responsive-audit.mjs --port=3217` | **0** | **0 findings.** 16 pages × 6 widths, 32 measurements at 150% text, 42 Bengaluru elements, 96 tap-target censuses |
| 6 | `npm run measure:js` | **1** | **Not run.** `.next/server/app/index.html not found` — the homepage is force-dynamic, so nothing is prerendered for this script to read. See 13.4 |
| 6a | `node scripts/measure-served-scripts.mjs --route=/ --route=/buy --route=/areas` | **0** | Homepage **139.64 KB gzip** against the 170 KB first-load budget, **30.36 KB headroom** |
| 7 | `node scripts/measure-visual-assets.mjs` | **0** | **0 findings.** Heaviest asset 3,630 B serialised / 7,924 B served against 80 KB; heaviest route 7.74 KB against 150 KB |
| 8 | `node scripts/form-state-audit.mjs http://127.0.0.1:3219` | **0** | **0 findings** across its 11 failure conditions |
| 9 | `node scripts/sync-publication-status.mjs` | **0** | 0 localities pass the gate, 3 guides pass, 0 to withdraw, 0 to return to fact review |
| 10 | `npm run report:progress` | **0** | Wrote `progress-report.json` and `PROGRESS-REPORT.md`; 3 published pages, 97 short of the 100-page goal |
| 11 | `node scripts/seed-locality-candidates.mjs --check` | **0** | No drift. `candidates 132 = seeded 127 + held 5 + existing 5`; registry total 132 |
| 12 | `node scripts/seed-guide-candidates.mjs --check` | **0** | No drift. `candidates 36 = seeded 29 + served elsewhere 7 + rejected 0`; registry total 36 |

Two notes on the command names, so the list can be reproduced exactly:

* Row 7 is also reachable as `npm run measure:visuals`, which runs the same file.
  It was run as the file, the way the task names it.
* `npm run verify` was deliberately not used. It runs the suite twice — once as `test`
  and once through `build`'s `prebuild` — so its four stages were run as rows 1, 2, 3
  and 4 instead, and every figure is attributable to one command.

`npm run lint` and `npm run typecheck` were each run three times — once as the gate and
again after the harness fixes and after the documentation edits — and were clean every
time. The build ran three times: `npm run build` at the start, an intake-enabled
`npx next build` for row 8, and `npm run build` again to restore the launch-ready
artefact. The suite ran eleven times; 13.3 gives every tally, not only the good ones.

## 13.2 The three checks that failed first, and what was wrong

None of the three was a defect in the site. All three were defects in the measuring
scripts — two of which had been reporting a pass they had not earned.

### 13.2.1 A false overflow finding: the area hub measured before its CSS applied

The first responsive-audit run exited 1 with one finding:

```
[area-hub-overflow-without-javascript] {"route":"/areas","width":390,"docWidth":1008,"viewport":390}
```

Read plainly that says `/areas` runs 618 px off the side of a 390 px screen with
JavaScript off. It does not. The script's scriptless pass navigated with
`waitUntil: 'domcontentloaded'`, and with scripts disabled there is no script to hold
the parser behind the two `<link rel="stylesheet">` chunks, so DOMContentLoaded fires
before the CSS has applied. A probe measured that instant directly:

| Navigation | Scripts | Applied stylesheets | `document.scrollWidth` |
|---|---|---|---|
| `domcontentloaded` | off | **0 of 2** | **1008** |
| `domcontentloaded`, +1.5 s, same navigation | off | 2 of 2 | **390** |
| `load` | off | 2 of 2 | **390** |
| `load` | on | 2 of 2 | 390 |

The audit had photographed unstyled HTML. Its own shape comparison agreed the content
was identical either way — 21 internal links, 0 area links, 0 `<details>`, 8 headings,
with and without script — because those counts do not depend on CSS and the width does.

**Changed in `scripts/responsive-audit.mjs`:** the scriptless pass waits for `load`,
and it now records how many stylesheets had applied when it measured. A width read off
an unstyled document is meaningless in *both* directions — it can invent an overflow
and it could hide one — so zero applied stylesheets is itself a new finding rather than
a quiet pass. The overflow check is unchanged; only the moment it reads moved. The
re-run measured `docWidth 390, viewport 390, styleSheets 2` and returned 0 findings.

This was a latent race, not a regression from 18.1: nothing in the CSS that task
touched decides whether a stylesheet has arrived. The earlier 18.2 attempt happened to
land on the other side of it and reported 0 findings, which is exactly why the
stylesheet count is now written into the report.

### 13.2.2 A 17-byte weight drift: the "worst case" plate was not the worst case

`measure-visual-assets.mjs` exited 1 with:

```
[recorded-weight-drift] {"assetId":"MAP-AREA-whitefield-inner-enclaves",
                         "recordedBytes":759,"serialisedBytes":742,"toleranceBytes":16}
```

The register records 759 B for `MAP-AREA` and documents its basis as "the longest
canonical name in the centre and the next four longest around it".
`tests/media-register-entries.test.tsx` re-measures that and passes. The script
measured 742 B from what it called the same worst case. Both build the record with the
same `worstCasePlateRecord()` — except the script's copy omitted one field.

`AreaOrientationPlate` reads each neighbour's name off the relationship the page hands
it, and `neighbourDisplayName` falls back to the **slug** when no name is carried. A
slug is shorter than the canonical name it came from, so the script was drawing a
plate with `whitefield-inner-enclaves`-style slugs where the register's basis puts full
canonical names. It was measuring a *lighter* plate and calling it the heaviest.

**Changed in `scripts/measure-visual-assets.mjs`:** the worst-case record now carries
`name: neighbour.canonicalName` on each relationship, exactly as a locality page hands
it over and exactly as the test already did. The plate now serialises **767 B** against
the 759 B recorded — 8 B of drift inside the 16 B tolerance, and the heavier figure, so
the check is stricter than it was, not looser. 0 findings.

The recorded 759 B was right all along. What was wrong was the script's basis for
comparison, and the earlier 18.2 write-up's explanation of it — which said the script
serialised something *other* than the worst case and concluded the register should be
left alone. Leaving the register alone was the right call for the wrong reason.

### 13.2.3 A crashed audit: one lost pre-hydration click took the whole run down

`form-state-audit.mjs` aborted:

```
page.waitForSelector: Timeout 30000ms exceeded.
  - waiting for locator('[role="dialog"]') to be visible
  at scripts/form-state-audit.mjs:143
```

That is step 6, the reduced-motion drawer capture. Two candidates: the drawer no longer
opens — 18.1 did touch `Header.module.css` — or the click landed before hydration and
was lost. A probe clicking up to four times settled it:

```
reducedMotion=reduce          opened=true attempts=2  dialogVisible=visible display=flex aria-expanded=true aria-modal=true
reducedMotion=no-preference   opened=true attempts=1  dialogVisible=visible display=flex aria-expanded=true aria-modal=true
```

The drawer opens, with the dialog semantics AGENTS.md requires. The first click was
simply lost. `responsive-audit.mjs` already retries this exact click and documents why;
`form-state-audit.mjs` did not, so a lost click threw, skipped the four remaining
checks, and wrote no report at all.

**Changed in `scripts/form-state-audit.mjs`:** the click is retried up to four times,
matching the responsive audit, and a drawer that never opens is recorded as the
finding `drawer-did-not-open-under-reduced-motion` with the attempt count instead of
crashing the run. The re-run returned 0 findings. Drawer semantics are independently
covered by `tests/ui/mobile-drawer.test.tsx`, 12 tests, in the passing suite.

## 13.3 The test suite, every run

The gate is `npm run test`, and it passed: **69 files, 1,939 tests, 0 failures,
exit 0** — on five of eleven runs, including once as `prebuild` inside `npm run build`,
and on the last run of the session against the tree as it now stands. The other six runs
are recorded here too, because the failures are reproducible under one specific
condition and that condition is not the code.

| Run | Time | Files | Tests | Result | Wall clock | 1-min load average |
|---|---|---|---|---|---|---|
| 1 | 19:09 | 69 | 1,939 | **all passed**, exit 0 | 40.89 s | machine quiet |
| 2 | 19:31 | 69 | 1,939 | 4 failed / 1,935 passed, exit 1 | 88.46 s | 32.15 |
| 3 | 19:33 | 69 | 1,939 | 3 failed / 1,936 passed, exit 1 | — | above 26 |
| 4 | 19:38 | 69 | 1,939 | **all passed**, exit 0 | 27.93 s | 10.63 |
| 5 | 19:39 | 69 | 1,939 | **all passed**, exit 0 | 30.75 s | settled |
| 6 | 19:45 | 69 | 1,939 | **all passed**, exit 0 — run as `prebuild`, inside `npm run build` | 29.86 s | settled |
| 7 | 19:53 | 69 | 1,939 | **all 1,939 tests passed**, exit **1** — see the reporter note below | 75.64 s | rising |
| 8 | 19:56 | 69 | 1,939 | 18 failed / 1,921 passed, exit 1. Failure reasons not captured for this run | 134.01 s | **62.48** |
| 9 | 20:05 | 69 | 1,939 | 1 failed / 1,938 passed, exit 1 | 62.90 s | 15.41, 5-min 31.94 |
| 10 | 20:09 | 69 | 1,939 | 1 failed / 1,938 passed, exit 1. Failure reason not captured for this run | 49.92 s | 15.12, 5-min 24.46 |
| 11 | 20:11 | 69 | 1,939 | **all passed**, exit 0 — the last run, on the tree as it stands | 39.51 s | 18.28, 5-min 23.49 |

**Not one assertion failure was observed in any run.** Every failure whose reason was
captured — runs 2, 3 and 9 — was `Test timed out in 5000ms`, and always in the same two
files, the two that render every public route several times over against a
registry-scale fixture. Runs 8 and 10 were not captured in that detail and are recorded
as uncharacterised rather than assumed to be the same thing.

| File | Cases that timed out under load |
|---|---|
| `tests/link-integrity.test.tsx` | both D-IMPL-17 searches — the published-locality count at which `/areas`, and then the homepage, first exceeds 60 internal links. This is the file run 9's single failure was in |
| `tests/internal-links.test.tsx` | the 1-to-3 call-action rule, and in run 2 the generic-link-text rule, over every route with the fixture localities published |

**What changed between run 6 and run 7 was the machine, not the repository.** From about
19:42 a set of unrelated workloads appeared on it — an Android emulator (`qemu-system-aarch64`),
a `node` process at 106% CPU, a `java` process, a Virtualization VM, WhatsApp and
ChatGPT — and the 1-minute load average went from around 10 to **62**. Runs 7 to 11 were
all measured through that, and run 11 came out clean anyway. The only repository change
in between was to this file and to `STATUS.md`, and run 7 shows all 1,939 tests passing
after those edits.

So this is a load budget, not a defect: `vitest.config.ts` sets no `testTimeout`, and
vitest's 5,000 ms default is close to what those cases cost when nine workers are
competing with an emulator. On a quiet machine they finish well inside it — run 1 shows
`link-integrity.test.tsx` at 16.8 s for 30 tests and `internal-links.test.tsx` at 12.8 s
for 36, with no individual case above 3.32 s. **The timeout was deliberately not
raised to make this read green.** It is recorded as what it is: a gate that passes on a
quiet machine, and whose two heaviest cases have little headroom on a busy one. Raising
`testTimeout`, or reducing what those cases render, is a one-line decision for whoever
owns them.

**Run 7's exit code has a separate cause.** All 1,939 tests passed and the process still
exited 1, on five `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors.
That is the reporter's RPC to a worker giving up while the workers saturate the
machine — 349 s of test time inside 75.64 s of wall clock. No test is attributed to it.

### Property tests, and the 100-iteration floor

17 files under `tests/properties/` carry **205 of the 1,939 tests**; the other 52 files
carry 1,734.

| Property file | Tests | | Property file | Tests |
|---|---|---|---|---|
| `gate-failing-leaks-nothing.property.test.tsx` | 44 | | `banned-pattern-detection.property.test.ts` | 14 |
| `declared-bounds.property.test.ts` | 34 | | `scan-coverage.property.test.ts` | 14 |
| `route-and-slug-shape.property.test.ts` | 12 | | `arbitraries.test.ts` (the floor guard) | 11 |
| `one-question-one-page.property.test.ts` | 9 | | `candidate-seeding.property.test.ts` | 9 |
| `gate-monotonicity.property.test.ts` | 8 | | `staleness-cascade.property.test.ts` | 8 |
| `slug-resolution.property.test.ts` | 8 | | `field-completeness.property.test.ts` | 8 |
| `crawler-access.property.test.ts` | 7 | | `hub-grouping.property.test.ts` | 7 |
| `surface-gate-agreement.property.test.tsx` | 5 | | `unavailable-not-substituted.property.test.ts` | 4 |
| `structured-data.property.test.ts` | 3 | | | |

The task requires each property test to run at least 100 iterations. That is not taken
on trust: `tests/properties/arbitraries.ts` exports
`PROPERTY_RUN_CONFIG = { numRuns: 100 }`, and `tests/properties/arbitraries.test.ts`
reads the text of every property file and fails any that neither uses the shared config
nor declares an explicit `numRuns` of 100 or more. Those 11 guard tests are in the
passing suite, so the floor is enforced on every run rather than asserted here.
`crawler-access.property.test.ts` samples 300.

## 13.4 `npm run measure:js` — not run, and the budget measured another way

```
npm run measure:js
[measure-homepage-js] Error: .../.next/server/app/index.html not found. Run "npm run build" first.
exit 1
```

**Recorded as not run.** Not as a pass, and not as a budget breach.

The build is fine; the artefact it reads does not exist. `scripts/measure-homepage-js.js`
reads the prerendered homepage HTML, and `src/app/page.tsx` carries
`export const dynamic = 'force-dynamic'` so the homepage lists what the gate admits at
the date of the request — Requirement 1.3, and the surface-versus-gate disagreement
Property 2 rules out. A force-dynamic route is not prerendered, so no `index.html` is
written. The build's own route table agrees: `/` is `ƒ (Dynamic)`.

The budget is still measurable, from the HTML a browser is actually served.
`scripts/measure-served-scripts.mjs` starts the production server, fetches the route,
resolves every `<script src>` to its file under `.next/` and gzips each one separately,
counting `nomodule` apart — the same arithmetic as the older script, from a served
response instead of a build file.

```
node scripts/measure-served-scripts.mjs --route=/ --route=/buy --route=/areas
/            modern  139.64 KB gzip (7 scripts, 30.36 KB headroom against 170 KB) | nomodule 38.7 KB | combined 178.34 KB
/buy         modern  167.98 KB gzip (8 scripts,  2.02 KB headroom against 170 KB) | nomodule 38.7 KB | combined 206.68 KB
/areas       modern  139.64 KB gzip (7 scripts, 30.36 KB headroom against 170 KB) | nomodule 38.7 KB | combined 178.34 KB
exit 0
```

| Figure | Value | Against what |
|---|---|---|
| **Homepage first load, modern browser** | **139.64 KB gzip**, 7 scripts | **170 KB budget (Requirement 9.6), 30.36 KB headroom — inside budget.** This is the gate figure |
| Homepage, September figure | 137.67 KB gzip | +1.97 KB over the whole of this feature. Next's chunking, not components: every Bengaluru element is a server component and `<details>` needs no script |
| Homepage, as the earlier 18.2 attempt measured it | 139.63 KB gzip | +0.01 KB, which is 10 bytes. Whatever has changed since then, script weight is not it |
| Homepage "combined" with `nomodule` | 178.34 KB gzip | **The stricter figure, and not the Requirement 9.6 measurement.** It adds a 38.7 KB legacy polyfill chunk that no browser in the declared Browserslist range downloads. The older script printed this as "Combined Unseparated Size … over ceiling"; that line pre-dates this feature and is not a breach of the 170 KB first-load budget |
| `/buy`, modern browser | 167.98 KB gzip | 2.02 KB of headroom. Requirement 9.6 budgets the homepage only, so this is not a breach — but it is the page that will breach first, and it is written down so nobody meets it by surprise |

Machine output: `served-script-weights.json`.

**Open item, not fixed here:** `npm run measure:js` is a named gate that cannot run.
Repairing it means either pointing it at the served homepage or retiring it in favour
of `measure-served-scripts.mjs`, and both change what a named gate measures — including
whether that combined `nomodule` line keeps being printed. That is the owner's call,
not this task's, so the command is left failing and reported failing rather than
quietly swapped.

## 13.5 Visual asset weights (Requirement 9.17) — 0 findings

```
node scripts/measure-visual-assets.mjs
Served from: next start (build TGrTHs2AcF1J-QbO-ppfJ), http://127.0.0.1:3217
Per asset budget: <= 80.00 KB gzip   Per route budget: <= 150.00 KB gzip
Findings: 0
exit 0
```

| Asset | Recorded | Serialised | Served max | 80 KB budget |
|---|---|---|---|---|
| `ILL-STREETSCAPE-001` | 3,625 B | 3,630 B | 7,924 B | **PASS** |
| `ILL-STREETSCAPE-002` | 3,624 B | 3,628 B | 7,891 B | **PASS** |
| `MAP-CORRIDOR-001` | 627 B | 628 B | 1,513 B | **PASS** |
| `TEX-LAYOUT-GRID-001` | 1,317 B | 1,320 B | — no public route serves it | **PASS** |
| `MAP-AREA-whitefield-inner-enclaves` | 759 B | 767 B | — no public route serves it | **PASS** |

The heaviest asset uses 4.4% of its 80 KB budget.

| Route | Asset | Served | Of the 150 KB route budget |
|---|---|---|---|
| `/` | `ILL-STREETSCAPE-001` | 7,924 B | 7.74 KB — **PASS** |
| `/buy` `/sell` `/rent` `/rent-out` `/commercial` | `ILL-STREETSCAPE-002` | 7,891 B each | 7.71 KB each — **PASS** |
| `/areas` | `MAP-CORRIDOR-001` | 1,513 B | 1.48 KB — **PASS** |

Every served `<svg>` sits 12 to 15 B above its recorded weight, inside a 49 to 101 B
allowance, and the script confirms each difference is class-name-only: the test renderer
and a production build name CSS module classes differently, so a served `<svg>` gzips a
few bytes heavier than the figure in the register.

Eight public routes carry no Bengaluru asset — `/guides`, `/how-it-works`, `/about`,
`/about/utpal-raj-kb`, `/contact` and the three published guides — and Requirement 9.2
obliges none of them to. Machine output: `visual-asset-weights.json`.

## 13.6 Responsive and layout audit — 0 findings

```
node scripts/responsive-audit.mjs --port=3217
Served from: http://127.0.0.1:3217
Run completed: true
Widths tested: 320, 360, 390, 768, 1280, 1440
Pages tested: 16 (from getPublicRoutes: 15)
150% text measurements: 32 at 320 and 1280 px
Bengaluru elements measured: 42
Disclosures found / opened: 0 / 0
Tap-target censuses: 96
Findings: 0
exit 0
```

| Check | What this run covered |
|---|---|
| Page list | Generated from `getPublicRoutes()` — 15 routes, the 12 static pages plus the 3 published guides — plus one unregistered path so the 404 page is measured for layout too. A newly published locality is audited with no array to edit |
| Horizontal overflow (9.7) | **96 measurements**, 16 pages × 6 widths, `document.scrollWidth` against `documentElement.clientWidth`, naming the widest element when it exceeds. Zero overflow |
| **150% text (9.8)** | **32 measurements** — every audited page at 320 px and 1280 px with the root font at 150%, with the enlargement confirmed to have applied. Zero overflow, zero controls outside the screen, zero fixed elements spilling their own box |
| Tap targets (9.10) | **96 censuses**, one per page per width. Every text link between 24 and 44 px is counted into the report rather than passed over in silence, because the rule's exception rests on it |
| **Bengaluru elements (9.2)** | **42 measured** — every `svg[data-asset-id]`, checked to sit inside the viewport and carry intrinsic width and height, at all six widths. The streetscape band on `/` and the five service pages, the corridor diagram on `/areas`. Each of those seven routes is also checked to carry at least one |
| Area hub without script (2.3, 2.6) | Loaded twice at 390 px, scripted and scriptless, and compared: 21 internal links, 0 area links, 0 `<details>`, 8 headings, `docWidth` 390 both ways, **2 of 2 stylesheets applied** when measured. See 13.2.1 |
| Single `<h1>`, action bar not covering content | Unchanged from September, across the same six widths |

Four things the script reports as **not exercised**, rather than as passes:

1. `TEX-LAYOUT-GRID-001` was not measured as layout — no audited route that answers 200 renders it.
2. The locality page template was not audited — no locality passes the gate, so no `/areas/<slug>` answers 200.
3. The `<details>` overflow disclosure was not measured — it renders only for a group of more than 25 published localities, and none is published, so no served page contains one. The branch is written and has never met real markup.
4. The enquiry error state was not captured here — this build renders the call-only panel, so there is no submit control on `/buy`. `form-state-audit.mjs` covers it against an intake-enabled preview, row 8.

The 404 probe answered 404 at every width, and the drawer opened on the first click in
this run. Screenshot names are unchanged, so the 36 captures listed in `STATUS.md`
still match. Machine output: `responsive-audit.json`.

## 13.7 Form state audit — 0 findings

Run against a preview built and served with intake on, synthetic data only:

```
INSTLE_ENQUIRY_INTAKE_ENABLED=true npx next build
INSTLE_DEPLOY_ENV=preview INSTLE_ENQUIRY_INTAKE_ENABLED=true \
  INSTLE_CONSENT_NOTICE_VERSION=local-verification-v1 \
  INSTLE_TRUSTED_PROXY_HOPS=1 npx next start -p 3219 -H 127.0.0.1

node scripts/form-state-audit.mjs http://127.0.0.1:3219
Findings: 0
exit 0
```

All 11 failure conditions clear: the error summary takes focus and every one of its
links has a target; success shows an `IRE-` reference and echoes back neither the
synthetic name nor the synthetic phone number; a failed submission says plainly that
nothing was sent, offers the phone number and keeps what was typed; nothing is written
to `localStorage` or `sessionStorage`; the drawer opens under reduced motion; and
`/buy` does not overflow at 150% text. Six screenshots written. Machine output:
`form-state-audit.json`.

The default build was restored afterwards with `npm run build`, so the artefact left in
`.next` is the launch-ready one with intake off.

## 13.8 The held state, as served

This is the state the site is meant to be in. It is not a failure.

```
localities passing the publication gate      0   of 132 candidates
guides passing the publication gate          3   of 36 candidates
records failing the gate                   165   carrying 2,022 failures in total
batches released                             0
withdrawals written by this run               0
records returned to fact review               0
published page count                         3   — 97 short of the 100-page goal
published static routes                     12   — outside the published page count
```

Both crawler decisions are `unrecorded`, so the served `robots.txt` is a blanket
refusal. Confirmed against the running build rather than inferred:

```
curl http://127.0.0.1:3221/robots.txt
User-Agent: *
Disallow: /

/                    200      /sitemap.xml         404
/areas               200      /areas/indiranagar   404
/guides              200
canonical tags on /    0      robots meta on /     noindex, nofollow
```

The domain is **TO BE CONFIRMED**, so canonical tags stay unset, `/sitemap.xml` stays a
404 and no assumed domain appears anywhere. Blocked on owner input, from
`npm run report:progress`: C2 on 156 records, C3 on 4, C4 on 4, C5 on 1, C11 on 1.
C13, C14 and C15 block capabilities rather than records, and C15 — the search-crawl
decision for OAI-SearchBot — blocks a release.

Page count, structured data and crawler permission guarantee neither a search ranking
nor an AI citation.

## 13.9 What this run changed, and what it did not

Three files changed, all of them measuring scripts. No source file, no test, no
threshold, no budget:

* `scripts/responsive-audit.mjs` — scriptless pass waits for `load`, records applied stylesheet count, and treats zero applied stylesheets as a finding.
* `scripts/measure-visual-assets.mjs` — worst-case plate carries the gated neighbour name, so it measures the heaviest plate the registry can produce.
* `scripts/form-state-audit.mjs` — reduced-motion drawer click is retried, and a drawer that never opens is a finding rather than a crash.

Five generated report files were rewritten by the scripts that own them:
`responsive-audit.json`, `visual-asset-weights.json`, `form-state-audit.json`,
`served-script-weights.json`, and `progress-report.json` with `PROGRESS-REPORT.md`.
Six form-state screenshots were re-captured under their existing names. This file and
`STATUS.md` were updated by hand, `STATUS.md` to carry today's figures and a pointer to
the generated progress report.

Two temporary probe scripts were written to diagnose 13.2.1 and 13.2.3
(`scripts/tmp-noscript-probe.mjs`, `scripts/tmp-drawer-probe.mjs`) and both were
deleted after the run. No other file was deleted. `src/components/BrandIntro/` was not
touched.

Nothing was deployed. No domain was bought, no DNS changed, no external profile edited,
no customer contacted. No real personal data was used anywhere; the form audit's name
and phone number are synthetic.

## 13.10 Still unverified, for the same reasons as before

| Item | Why |
|---|---|
| **Git state** | `git` on this machine fails with "You have not agreed to the Xcode license agreements", and it is the only Git installed. Branch, HEAD and uncommitted changes are unverified. Accepting a system licence on the owner's behalf is not this task's call |
| **`npm run measure:js`** | Cannot run against a force-dynamic homepage. The budget itself is met, measured from the served page. Repair is an owner decision — see 13.4 |
| **`npm run test` under load** | Passes on a quiet machine, four times. Two heavy files sit near vitest's 5,000 ms default once the machine is saturated by unrelated work. `testTimeout` deliberately left alone — see 13.3 |
| **`<details>` overflow disclosure** | Written, never measured against real markup. It needs a group of more than 25 published localities, and zero are published |
| **Locality page template, `/areas/<slug>`** | Not audited as a served page. Nothing passes the gate, so nothing is served |
| **Screen readers** | Structure and focus verified; how they sound was not. No VoiceOver or NVDA pass |
| **Real devices, Safari, Firefox** | Chrome with device emulation on one machine only |
| **Field performance** | No traffic exists. Lab measurement only |
| **Live search and AI-search visibility** | No domain, so no Search Console, no Bing Webmaster Tools, no indexing, no ranking, no citation observation. None of it was simulated |
| **Real lead delivery** | No approved destination. The in-memory staging adapter and synthetic data throughout |
| **Deployment** | None |
