# M0 — Repository Audit (actual source inspection)

* **Date of inspection:** 29 September 2026
* **Inspected by:** Kiro (implementation agent), working from `CLAUDE-MASTER-BUILD-PROMPT.md`
* **Scope:** `/Users/bharathibasavaraj/Desktop/INSTLE`
* **Nature of evidence:** source reading plus commands run in this session. This is **not** a browser audit, penetration test, or completed security assessment.

## 1. Handoff files actually read in this session

| File | Read |
|---|---|
| `AGENTS.md` | Yes, in full |
| `INSTLE-REAL-ESTATE-BENGALURU-MASTER-BLUEPRINT.md` | Yes, in full (678 lines, read in three ranges) |
| `docs/seo-launch-handoff/README.md` | Yes, in full |
| `docs/seo-launch-handoff/CLAUDE-MASTER-BUILD-PROMPT.md` | Yes, in full (937 lines, read in three ranges) |
| `docs/seo-launch-handoff/OWNER-DECISIONS.md` | Yes, in full |
| `docs/seo-launch-handoff/LAUNCH-BUDGET.md` | Yes, in full |
| `docs/seo-launch-handoff/SOURCES.md` | Yes, in full |
| `docs/seo-launch-handoff/IMPLEMENTATION-TASKS.csv` | Yes, in full (78 task rows) |
| `docs/seo-launch-handoff/ROUTE-MANIFEST.csv` | Yes (210 records) |
| `docs/seo-launch-handoff/AREA-RESEARCH-BACKLOG.csv` | Yes (132 candidate records) |
| `docs/decisions/ADR-0001-stack-and-ui-architecture.md` | Yes, in full |
| `docs/INSTLE-CORRECTED-ROADMAP-AND-DESIGN-RESET.md` | Treated as historical; its build/test claims are not reused as evidence |

`docs/seo-launch-handoff/INSTLE-REAL-ESTATE-CLAUDE-HANDOFF.zip` was not extracted; it is a packaged copy of the same folder.

## 2. Toolchain observed (not copied from docs)

Commands run in this session:

| Item | Declared in `package.json` | Actually installed |
|---|---|---|
| Node.js | not declared | `v24.18.0` |
| `next` | `^16.3.6` | `16.3.6` |
| `react` / `react-dom` | `^19.3.0` | `19.3.0` |
| `typescript` | `^5.7.0` | `5.9.3` |
| `vitest` | `^3.0.0` | `3.2.7` |

Scripts present before this work: `dev`, `build`, `measure:js`, `start`, `lint`, `test`.

Gaps found and fixed in this milestone set:

* **The test suite could not run.** Three test files existed (`tests/accessibility.test.tsx`, `tests/brand-invariants.test.tsx`, `tests/concept-and-api.test.tsx`, dated 26 September) but there was no Vitest config, no setup file, and no `@testing-library/jest-dom` registration. With Vitest's default `node` environment, every `render()` call would fail, and matchers such as `toBeInTheDocument` were never registered. The three files also referenced `<Header />` with no props and `validateLeadPayload` from `@/lib/lead-operations`, neither of which matches the code.
  Consequence: any earlier statement that these tests passed is not reproducible. They have been rewritten against the current architecture, and `vitest.config.ts`, `tests/setup.ts` and a full suite have been added.
* No `typecheck` script existed, so type errors in the test files went unnoticed. `tsc --noEmit` is now wired as `npm run typecheck`, and `npm run verify` chains lint, typecheck, test and build.
* `eslint.config.mjs` ignores `tests/**`, so the test files were never linted either. That ignore has been left in place to avoid changing unrelated configuration.

### Blocker: Git state could not be verified

`git status`, `git rev-parse` and `git log` all fail on this machine with:

```
You have not agreed to the Xcode license agreements.
```

`/usr/bin/git` is the only Git on `PATH` (no Homebrew/MacPorts Git). Per instruction, **no system licence was accepted on the owner's behalf**, so:

* The branch name, HEAD commit, and pre-existing uncommitted changes are **unverified**.
* To protect unrelated owner work, this implementation **deleted no files**. Every change is either a new file or a targeted edit to a file read first in this session. The prototype routes, prototype components, and all existing docs remain in place.

## 3. Findings

Severity uses the master prompt's own P0/P1 labels where it named them.

### P0 — Enquiry intake could report success without durable acceptance

| # | Finding | Evidence (pre-change) | Status after this milestone set |
|---|---|---|---|
| P0-1 | Default lead destination was process memory | `src/lib/lead-operations.ts` exported `stagingLeadStore = new MemoryStagingAdapter()` and used it as the default parameter of `processLeadEnquiry` | Fixed. `src/lib/lead-destination.ts` resolves the adapter from explicit configuration. Memory staging is only selectable outside production. In production with no approved destination the API returns `503` and the call path, never a fake success. |
| P0-2 | Adapter result was not checked | `await adapter.dispatch(record);` — return value discarded, then `return { success: true, ... }` | Fixed. The dispatch result is inspected; `success: false`, a thrown error, and a timeout all produce a retriable failure. |
| P0-3 | Body-size cap trusted `Content-Length` | `src/app/api/enquiry/route.ts` read the header and never bounded actual bytes read | Fixed. `src/lib/request-body.ts` streams the body and aborts past the limit regardless of the declared header. |
| P0-4 | Rate limit and idempotency were per-process `Map`s | module-level `RATE_LIMIT_STORE` / `IDEMPOTENCY_STORE` | Partly fixed in code, still an operational dependency. Both now sit behind a store interface with a declared `isDistributed` flag; the API refuses production traffic while the configured store is non-distributed. No distributed backend is provisioned because no vendor is approved (OWN-07). |
| P0-5 | Idempotency key derived from the customer's phone number | dedupe key template `${payload.phone}-${payload.intent}-...` | Fixed. The key is a SHA-256 fingerprint; raw phone digits are never used as a map key, and a client-supplied key is bound to the payload fingerprint so one client key cannot return another person's reference. |
| P0-6 | Dedupe entry was written before durable acceptance was known | `IDEMPOTENCY_STORE.set(...)` ran unconditionally after dispatch | Fixed. The entry is only recorded after the adapter confirms acceptance. |
| P0-7 | Consent, destination, access, retention and queue ownership unapproved | no approved notice text supplied anywhere in the repo | Not resolvable in code. Real submission is **disabled by default**; `/contact` and every service page lead with the call path. Requirements recorded in `OWNER-FACTS-CHECKLIST.md`. |

### P1 — Content, claims and measurement

| # | Finding | Evidence (pre-change) | Status |
|---|---|---|---|
| P1-1 | Locality approval filtered status labels only | `getPublishedLocalities()` filtered `publicationStatus === 'published' && reviewStatus === 'approved'` | Fixed. Publication now requires claim-level evidence via `src/config/claims.ts` and a single shared gate in `src/config/localities.ts`. |
| P1-2 | Reviewer identity was fabricated | all four "published" records carried `editorialSignOffBy: 'INSTLE Research & Advisory Desk'` — no such named reviewer exists | Fixed. Every record's sign-off is now `null` pending a real named reviewer. The master prompt forbids fictional "research desk approved" evidence. |
| P1-3 | Citations pointed at organisation homepages | e.g. a ward-delimitation claim cited `https://bbmp.gov.in` (a homepage), a BDA layout claim cited `https://bdabangalore.org` | Fixed by unpublishing. Homepage-level references cannot support a specific ward, station, typology or opening date. Each claim now records `evidenceState: 'insufficient'` with the exact reason. |
| P1-4 | Three citations across unrelated claims were treated as two-source corroboration | Indiranagar had 3 citations for 3 different claims, none independently corroborated | Fixed. The gate is per-claim and requires two **distinct publishers** per claim. |
| P1-5 | Homepage locality module hardcoded unsourced facts | `Concept1Gazetteer.tsx` asserted "15 minutes to MG Road and CBD", "Blue Line Metro construction under Phase 2B", "BMRDA Master Strategy" | Fixed. The public homepage no longer renders that module. Commute-time and project-status claims are removed from public output. |
| P1-6 | Public copy contained absolute and unverifiable claims | "Verified Tenants", "verified corporate executives and respectable families", "No spam calls", "We **never** sell your contact details", "Zero spam or data selling", "VERIFIED AREA GUIDANCE", "All locality facts are based on verified municipal and transit information" | Fixed in all public routes. Replaced with statements the brokerage can actually stand behind, or removed. Detail in `CLAIM-AUDIT.md`. |
| P1-7 | Telemetry allowed arbitrary values in allowed keys | `trackSafeEvent` checked key names and `typeof` only; `sourceComponent` accepted any string | Fixed. `src/lib/telemetry.ts` now validates each field against enums, numeric ranges and the approved slug/component registries, and drops the event if a value fails. |
| P1-8 | Phone validation had a broad 10–15 digit fallback | `isStandardValid = cleanPhone.length >= 10 && cleanPhone.length <= 15` accepted `0000000000` | Fixed. Indian mobile numbers validate strictly; other countries require an explicit `+` country code from an allowlist, so legitimate non-Indian customers are not excluded by accident. |
| P1-9 | A 90-day timestamp was presented as retention policy | `retentionExpiresAt` written into every record with no deletion path | Partly fixed. The field is now labelled a **proposed** period and is only written when a retention policy is configured. Actual deletion depends on the destination (OWN-08). |
| P1-10 | No production measurement destination | telemetry returned a payload and `console.debug`-ed outside production | Unchanged by design. Documented as a contract, not live analytics, in `EVENT-DICTIONARY.md`. |

### Additional findings not listed in the handoff

| # | Severity | Finding |
|---|---|---|
| A-1 | P1 | `src/styles/tokens.css` loads four Google Fonts families over a render-blocking CSS `@import`, and a third-party request fires on every page. Replaced with a system font stack; no external font request remains. |
| A-2 | P1 | `Concept1Hero.tsx` rendered five competing primary buttons plus two more phone treatments above the fold, against the prompt's "one clear next step per section". The new homepage uses four intent cards and one call action. |
| A-3 | P1 | Two separate intent actions ("I want to sell", "I want to rent out") both linked to `/sell`, so the landlord path had no distinct destination. `/rent-out` now exists; `/sell` is preserved and cross-links. |
| A-4 | P2 | `Concept1Intake` rendered `<h1>` ("Share your property requirement") inside `/buy`, which already had an `<h1>`. Two `<h1>` elements on one page. The new shared form renders no `<h1>`. |
| A-5 | P2 | `Concept1Intake` had an unlabelled visual-only phone prefix `🇮🇳 +91` while the API normalises numbers itself, and the confirmation screen echoed the full submitted record including name and phone back into the DOM. The new form shows a reference and the call path only. |
| A-6 | P1 | `src/components/IntentRail`, `ProcessSteps`, `ContactBand`, `OwnerSection`, `ArchitecturalGraphic` existed but were imported by nothing. Left in place (unverified Git state), and not wired into public routes. |
| A-7 | P1 | No `robots.txt` or sitemap route existed at all, so crawler policy was undefined. `src/app/robots.ts` and `src/app/sitemap.ts` added, both domain-gated. |
| A-8 | P0 | The `/api/enquiry` response was `NextResponse.json(...)` with no cache directive. A personal reference number could be cached by an intermediary. `Cache-Control: no-store` is now set on every enquiry response. |
| A-9 | P2 | `metadataBase` was never set and no Open Graph data existed. Both are now handled by the shared metadata builder, which omits absolute URLs entirely while the domain is unconfirmed. |

## 4. What was deliberately not done

* No domain was guessed. No canonical tag, no `metadataBase`, no absolute URL, and no production sitemap is emitted while `INSTLE_PUBLIC_ORIGIN` / `INSTLE_DOMAIN_CONFIRMED` are unset.
* No locality page is published. All five records fail the claim gate on real evidence grounds, so `/areas` renders a truthful empty state and every `/areas/[slug]` returns a genuine 404.
* No review, rating, review count, or testimonial appears anywhere in public output. The homepage review section is omitted, not filled with an empty star widget.
* No 30-day sale, tenant-placement, or response-time commitment is stated.
* No biography, portrait, qualification, or profile link was invented for Utpal Raj KB.
* No purchase, deployment, external profile edit, or outbound customer contact was made.
* No file was deleted, and no unrelated source file was rewritten.

## 5. Findings discovered during implementation and verification

These were not visible from source reading. They came out of running the built site.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| V-1 | P1 | The durability guard in `processLeadEnquiry` keyed off `NODE_ENV`. `next start` sets `NODE_ENV=production` for a **preview** build too, so a synthetic preview submission failed with `not-durable` and the full delivery path could not be exercised. | Re-keyed to the declared deploy environment. Covered by two tests. |
| V-2 | P1 | Environment-dependent output was frozen at build time. `robots.txt`, the sitemap and the prototype 404 guard were statically prerendered, so confirming a domain after the build had no effect. | `robots.txt`, `/sitemap.xml` and the five prototype pages are now rendered per request. Verified: prototypes return 404 and the sitemap serves 15 URLs when built and run with a confirmed domain. |
| V-3 | P2 | The mobile action bar label was page-specific. "Commercial enquiry" wrapped to two lines at 390 px, making the fixed bar 87 px tall against 64 px of reserved space, so it sat over the footer on `/commercial`. | One short label on one line, and reserved space raised to 72 px. Re-audited: zero overlap at 320, 360 and 390 px. |
| V-4 | P2 | `--color-border-strong` measured 2.59:1 against white. It is the visible boundary of every text input and radio, so WCAG 1.4.11 requires 3:1. | Darkened to `#767f78` (4.14:1 on white). The contrast test now computes ratios from `tokens.css`, so a future token edit fails the build. |
| V-5 | P2 | Breadcrumb links rendered 18 px tall. The WCAG 2.5.8 inline exception covers links *in a sentence*; a breadcrumb is a list of links, so it does not apply. | Breadcrumb links sized to a 24 px minimum; inline prose links given vertical padding that grows the hit area without changing line wrapping. |
| V-6 | P1 | `validatePhone` read `+65 9123 4567` as an Indian mobile, because a Singapore number with its country code is ten digits beginning with 6. | The international branch now runs first whenever the customer typed a `+`. Covered by tests for `+91`, `+65`, `+44` and `+971`. |
| V-7 | Note | Intake mode is resolved when a page is rendered, so a statically prerendered service page keeps the mode it was built with. | Left as is: a static page that cannot start collecting personal data at runtime is the safer property. Recorded as a build-time configuration requirement in `RELEASE-RUNBOOK.md`. |

## 6. Prototype content not brought up to public standard

`src/components/Concept2/*` contains superseded design material with language this project would not publish: "off-market", "verified mandates", "qualified capital", "premier residential sectors", "bespoke architectural commissions". The outright guarantee-style claims were removed (`clear-title parcels`, `CLAIM GATE: … VERIFIED`, `ZERO UNVERIFIED LISTINGS`, `verified liquidity`), but the register as a whole was not rewritten.

That is a deliberate scope decision, not an oversight. These routes are `noindex`, absent from navigation and the sitemap, and now return a genuine 404 in a production deployment, so none of it is public. If the owner wants Concept 2 kept as a live design reference, its copy needs the same treatment as the public pages first.
