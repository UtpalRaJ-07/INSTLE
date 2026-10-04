# Implementation decision log

Decisions taken during this implementation that a reviewer might reasonably question, each with its reasoning and how to reverse it. Routine choices (naming, spacing, file layout) are not listed.

Owner decisions are tracked separately in `OWNER-FACTS-CHECKLIST.md`.

---

## D-IMPL-01 — The four published locality pages were unpublished

**Decision.** All four locality records previously marked `published`, plus the one draft, are now unpublished research candidates. `/areas` shows an honest empty state and every `/areas/[slug]` returns 404.

**Why.** The audit of their actual evidence found:

* Every sign-off was attributed to "INSTLE Research & Advisory Desk", which is not a real named person. The master prompt forbids fictional research-desk approval outright.
* Ward numbers, zone names and metro project statuses were each cited to a single organisation **homepage** — `https://bbmp.gov.in`, `https://english.bmrc.co.in`, `https://bdabangalore.org`. A homepage cannot establish a specific ward or station.
* Three citations across three unrelated claims were being treated as satisfying a two-source gate. They corroborate nothing.
* Statements with no source at all: "established in the late 1960s", "15 minutes to MG Road and CBD", "heritage zoning setbacks", "premier"/"high-capital" characterisations.
* Project status was published as a current operational state ("in commissioning and testing") with no dated source.

**Reversal.** Research each claim to two independent publishers with exact references, access dates and excerpts; record a real named reviewer; confirm operational coverage and an accountable person. The gate then passes on its own. `CLAIM-AUDIT.md` lists what each record needs.

**Cost.** The site launches with no area content, which is the largest single loss against the owner's request for 100-plus area pages. The alternative was publishing facts nobody had checked.

---

## D-IMPL-02 — Guides are split into "own process" and "external fact"

**Decision.** A guide that only describes how the brokerage works, what a customer should have ready, or what the brokerage will not promise may publish attributed to `INSTLE REAL ESTATE`, with no named individual author and no `Article` structured data. A guide that states anything about law, tax, documentation, fees, regulation or the local market requires a named author, a named subject reviewer and claim-backed sources.

**Why.** The master prompt requires a named author and reviewer for guides, and no reviewer has been supplied (OWN-14). Applied flat, that leaves the site with no useful content at all. But the two kinds of content carry very different risk: the business is genuinely the authority on its own process, and attributing that to itself is accurate. It is not the authority on stamp duty.

Three guides publish under this rule. Four stay drafts, including the ones most real estate sites lead with — documents, taxes, fees, commercial leasing.

**Reversal.** An editor who disagrees can set `contentClass: 'external-fact'` on any of the three, which immediately fails the gate until a named author and reviewer exist. The split is one field per record.

---

## D-IMPL-03 — Conceptual architectural images removed from public pages

**Decision.** `concept1-garden-modernism.jpg` and `concept1-courtyard-detail.jpg` no longer appear on any public page. They remain in `public/media/` and in the prototype routes.

**Why.** They are design studies, not photographs of real places or available property. On a brokerage site, a large architectural image above the fold reads as property imagery however it is captioned. They also cost payload for no customer benefit, and the honest caption needed to keep them ("prototype design study; not an authentic location photograph") is itself a signal they do not belong on a customer-facing page.

The public site now uses no photography at all. That is a defensible launch state: nothing on it pretends to be something it is not.

**Reversal.** When rights-cleared Bengaluru photography exists, add it with a provenance record in `MEDIA-REGISTER.md`.

---

## D-IMPL-04 — Single-page form instead of a five-step wizard

**Decision.** The enquiry form is one page with three grouped fieldsets and real radio groups, replacing the five-step wizard in `Concept1Intake`.

**Why.** The wizard had four specific problems: it rendered a second `<h1>` on pages that already had one; it hid remaining questions so a customer could not see the commitment before starting; its step navigation added failure modes with no user benefit; and its option "buttons" were styled `<button>` elements, losing arrow-key navigation, group semantics and required-state announcement that real radios provide for free.

Six questions do not need pagination.

**Reversal.** The wizard components are untouched and still serve the prototype routes.

---

## D-IMPL-05 — Real submission disabled by default

**Decision.** `INSTLE_ENQUIRY_INTAKE_ENABLED` defaults to false. In that state the form is not rendered at all: the page shows what to have ready and the call action. The API returns 503 with the phone number.

**Why.** There is no approved destination, no approved notice, no retention process and no named queue owner (OWN-07, OWN-08, OWN-09). Rendering a form that collects a name and phone number with nowhere approved to put them would be the exact thing the data rules prohibit. A disabled-looking form is a worse experience than a page that says plainly what the position is.

The enabled path is fully implemented and verified against the running API, so switching it on is configuration, not development.

**Reversal.** Set the flag, register an approved durable adapter, and set `INSTLE_CONSENT_NOTICE_VERSION` and `INSTLE_LEAD_RETENTION_DAYS`. The API refuses to store anything if any of those is missing.

---

## D-IMPL-06 — `/areas/north-bengaluru` slug preserved

**Decision.** The slug is unchanged, while the record is named "Hebbal" with `entityType: 'corridor'`.

**Why.** The master prompt requires a preserve/merge decision and forbids silently renaming this route to Hebbal. The two names describe different scopes: a marketing region versus a locality. Choosing needs an editorial decision about what the page is actually about.

**Open.** Three options, for the owner and editorial to choose: keep `/areas/north-bengaluru` as a region hub covering several localities; rename to `/areas/hebbal` with a permanent redirect from the old slug; or drop the corridor and publish individual localities. Nothing is indexed either way at present, so the decision carries no SEO cost today.

---

## D-IMPL-07 — Google Fonts removed

**Decision.** `tokens.css` no longer imports Inter, Plus Jakarta Sans, Space Grotesk and JetBrains Mono. All type uses a system stack.

**Why.** The import was a render-blocking CSS `@import` plus a third-party request on every page, for four families the design does not depend on — two of them used only by the prototype routes. The system stack renders on first paint with no layout shift and no external dependency. A test asserts no external font request returns.

**Reversal.** If a licensed brand typeface is commissioned, self-host it with `font-display` and a documented licence, rather than reinstating the CDN import.

---

## D-IMPL-08 — Drawer inertness lifted into the shell

**Decision.** The mobile drawer's open state lives in `LayoutShell`, which marks `main` and `footer` `inert` while it is open.

**Why.** The previous implementation used a backdrop and `overflow: hidden` on the body. That stops mouse clicks and scrolling, and leaves every link behind the drawer reachable by Tab and by assistive technology. The requirement is to prevent interaction with the obscured background, not just scrolling. `inert` is the mechanism that actually does that.

Verified in a real browser: with the drawer open, `main` and `footer` both carry `inert`, and focus is inside the dialog.

---

## D-IMPL-09 — `x-forwarded-for` not trusted by default

**Decision.** The header is only read when `INSTLE_TRUSTED_PROXY_HOPS` declares how many proxies sit in front of the app. Without it, all requests share one rate-limit bucket and the identifier is reported as untrusted.

**Why.** Trusting the leftmost entry, as the previous code did, lets any client prepend an arbitrary address and get a fresh bucket per request — the limiter is then decorative. Sharing one bucket is a blunt instrument, but it is an honest one, and it is visibly wrong rather than invisibly broken.

**Reversal.** Set the hop count to match the deployment once the host is chosen.

---

## D-IMPL-10 — Production refuses traffic while abuse controls are per-process

**Decision.** With `INSTLE_DEPLOY_ENV=production`, the API returns 503 and the phone number if the rate-limit or idempotency store reports `isDistributed: false`.

**Why.** Both stores are per-process `Map`s. On more than one instance they silently stop working, which is the normal deployment shape for this framework. Refusing is safer than appearing to enforce a limit that does not hold. The `isDistributed` flag makes the property explicit rather than implicit.

**Reversal.** Implement `RateLimitStore` and `IdempotencyStore` against the chosen shared store and register them. Both interfaces are small and deliberately shaped for a key-value backend with TTL.

---

## D-IMPL-11 — Prototype routes 404 in production

**Decision.** The five prototype pages call a guard that returns 404 when `INSTLE_DEPLOY_ENV=production`, and they render per request so the guard cannot be frozen by a build.

**Why.** `noindex` alone leaves unapproved copy publicly reachable. The master prompt asks for removal or protection in production where possible. A 404 is the simplest protection that does not require auth infrastructure.

Verified: all five return 404 in a production-configured build.

---

## D-IMPL-12 — Three legacy test files rewritten

**Decision.** `tests/accessibility.test.tsx`, `tests/brand-invariants.test.tsx` and `tests/concept-and-api.test.tsx` were rewritten rather than deleted or left in place.

**Why.** They could not run: no Vitest config, no jsdom environment, no `jest-dom` registration, and references to APIs that do not exist (`<Header />` with no props, `validateLeadPayload` from `lead-operations`). Their locality assertions also encoded the behaviour this work removed — for example requiring at least four published locality records.

Each file now covers the same intent against the current code, and the overlapping coverage moved to more specific files: contrast arithmetic to `design-tokens.test.ts` where it is computed from `tokens.css`, drawer focus to `ui/mobile-drawer.test.tsx`, and copy scanning to `public-content.test.ts` where it reads every public source file rather than a hand-maintained list.

**Note for the reviewer.** Any earlier claim that these tests passed is not reproducible.

---

## D-IMPL-13 — Legacy unused components left in the tree

**Decision.** `IntentRail`, `ProcessSteps`, `ContactBand`, `OwnerSection`, `ArchitecturalGraphic`, `OwnerIntake` and `RentalIntake` are not imported by any public route, and were left in place rather than deleted. Their worst claims were corrected.

**Why.** Git state could not be verified on this machine (the Xcode licence blocks it, and accepting a system licence on the owner's behalf is not appropriate), so there is no way to tell what is committed and what is uncommitted owner work. Deleting files under that uncertainty risks destroying something unrelated. They are excluded from the public-content scan with the reason recorded in the test.

**Follow-up.** Once Git is usable, confirm they are committed and unused, then remove them.

---

## D-IMPL-14 — Two test dependencies added

**Decision.** `@testing-library/user-event@14.6.1` and `playwright-core@1.57.0`, both exact-pinned dev dependencies.

**Why.** `user-event` is needed to simulate Tab for the focus-trap tests; `fireEvent` cannot move focus the way a real Tab does. `playwright-core` drives the browser already installed on this machine — no browser download — and is what makes the responsive audit real: it measures `document.scrollWidth` against the viewport at six widths, names the widest element when something overflows, and checks tap-target sizes and the action-bar overlap. Chrome's CLI screenshot flag cannot measure anything.

Both are dev-only and absent from the production bundle.

---
## D-IMPL-15 — Heading provenance binds where a register phrase exists, and the gap is recorded rather than filled
**Decision.** Requirement 5.4 asks for two things about a published guide's section heading: that it is a question of at most fifteen words ending in a question mark, and that its wording is taken from a phrase recorded in the Search_Intent_Register. `evaluateGuide` enforces the first half unconditionally on every published guide. The second half — a non-null `headingIntentEntryId` on every section — is enforced on any record that carries an approved `primaryIntent`, which is the only evidence inside the app that a register entry exists at all. No record carries one today, so the provenance condition is currently inert. It is recorded as `HEADING_INTENT_PROVENANCE_GAP` in `src/config/guides.ts`, naming Owner_Input_Register entry **C13**, and asserted in `tests/guides.test.ts`.

**Why.** The Search_Intent_Register holds zero entries. No keyword research tool has been supplied — that is checklist entry C13 — and while it is unsupplied, Requirement 3.15 permits phrases from named manual methods only. A manual-method entry still needs a phrase, a named method, a single observation date and a location context under Requirement 3.1: that is a record of research somebody performed on a particular day. Nobody has performed it. Writing three entries so that the three published guides could cite them would be inventing dated research, which is the one thing this whole feature exists to refuse.

The alternatives were both worse. Enforcing the provenance condition universally today would unpublish all three guides on the absence of an owner input that does not block anything a reader can see — the headings are honest questions either way — and the task required the copy to be fixed rather than the count to drop. Dropping the condition would mean 5.4's provenance half was never implemented, and nothing would fail when the register fills.

**What this is not.** It is not an exemption for any record: no slug is named, no denial-list entry was added, and `EXTERNAL_FACT_LEXICON` was not narrowed. It is not a relaxation: before task 6.2 the heading rule did not exist at all, and after it two thirds of 5.4 binds every published guide unconditionally. The scoping is on evidence, not on content.

**Follow-up.** When C13 is answered — or when phrase research from a named manual method is genuinely performed and dated — populate the register, copy the approved phrase onto each record at approval, and the condition begins to bite with no code change. At that point every heading on a record carrying a phrase must name the entry it came from, and the three published guides will fail the gate until they do.

---
## D-IMPL-16 — The maintenance owner of the three published guides is the business owner
**Decision.** `maintenanceOwner` on the three published guides is `OWNER_PROFILE.name` — `Utpal Raj KB` — read from the owner register rather than typed as a literal, and exported as `GUIDE_MAINTENANCE_OWNER`. `nextReviewAt` is `2027-09-29`, twelve months after the recorded content date and the widest window Requirement 4.10 permits.

**Why.** Requirement 4.10 requires a named person accountable for keeping each published guide current, and `isAttributableName` rejects a desk name, so "editorial desk" is not an answer. The only named person recorded anywhere in this repository is the owner. All three guides are own-process content describing how this business works and what it will not promise; they are attributed to the business, `namedAuthor` stays null on all three, and no `Article` structured data is emitted. Naming the owner as the person who keeps pages about his own business's process current asserts no qualification, no review of external material and no authorship of anything. Inventing a second person would have been the only alternative, and it is not one.

Twelve months rather than six is deliberate. The review date is a commitment that somebody will re-read these pages, and nobody has asked the named person how often he can do that. Recording the outer bound the requirement allows states the maximum interval that may pass before the page unpublishes itself; a shorter interval would assert a review cadence nobody agreed to. Past that date `evaluateGuide` removes all three pages and the routes 404 with no rebuild, which is Requirement 4.13 working.

**Follow-up.** Confirm the assignment and the interval with the owner under the same conversation that supplies checklist C2 reviewers, and shorten the interval if he wants a tighter one.

---
## D-IMPL-17 — OPEN: `/areas` and the homepage cannot list every published page and stay within 60 internal links
**Status.** Open, awaiting an owner/user decision. It must be taken before the homepage reaches **27** published localities (with today's three guides) or `/areas` reaches **40**, because at those counts the build fails.

**The conflict.** Requirement 2.3, and the design's "Grouping and the 25-link rule", have `/areas` render one link per published locality in a single server-rendered response: at most 25 visible per group, the rest in a closed `<details>` in the same HTML. Requirement 8.8 fails the build when a page's server-rendered HTML carries more than 60 internal links across header, main content and footer, with repeats counted. `<details>` hides links from view but not from the HTML, so every one of them counts. The design lists both bounds side by side in Property 16 and does not reconcile them. Region hubs (Requirements 2.7, 2.9) are specified as optional pages with their own publication gate. The design does not use them to shrink `/areas`.

**What is measured.** `tests/link-integrity.test.tsx` publishes fixture localities through the real gate and renders each page as served. Every page carries 19 shell links: header 7, footer 11, action bar 1. The drawer is not in the first response, and the fragment-only skip link opens no other page, so neither is counted.
* `/areas` carries 21 plus one per published locality, so it first carries 61 at **40**. The registry holds 132 records.
* The homepage lists every published locality and every published guide, and neither list is capped. It carries 31 plus one per locality plus one per guide, so it first carries 61 when the two together reach **30**. With today's three guides that is **27** localities. If every one of the 36 guide records published, the homepage would be over budget with no locality at all.
* `/guides` carries 19 plus one per guide, so it would first fail at 42. That is above the 36 guide records, so there is no conflict at the current registry size.

Requirement 1.8 sizes the first batch at 8 to 12 records and later batches at 10 to 15, so the homepage can cross during the second or third batch.

**What was done.** Requirement 8.8 is enforced on every public page with no exemption. When a count above is reached, the build fails and names the page and its total. That outcome is intended until this decision is taken. The design sets no cap on the homepage's area or guide lists, so none was added: a cap is a design change and should come from this decision. No requirement asks the homepage to list every locality.

**Option A — keep 8.8 absolute, and let the hubs scale by structure.** Once the count nears 40, `/areas` links to one page per group, or to region hubs, and each of those lists its own localities. The homepage shows a capped selection, for example at most six areas and six guides, plus its existing "All areas" and "All guides" links.
* *For:* the link-farm guard stays meaningful on every page, and no page carries a directory wall.
* *Against:* Requirement 2.3's "same server-rendered HTML response" would have to be amended to "the group's own page". A region hub publishes only with three published localities and two sections of its own (2.7), so it is editorial work per region, and a region cannot get its page until it has three localities. Each locality is also one click further from `/areas`.

**Option B — keep 2.3 as written, and scope 8.8.** Either the `/areas` directory list stops counting toward the 60, or `/areas` gets a separately stated ceiling of its own, for example the registry size plus its fixed links.
* *For:* every locality stays one click from `/areas`, and no new page type is needed.
* *Against:* the page left unchecked is the one most like the pattern 8.8 exists to catch, a long list of place-name links. The exemption would have to be written into 8.8 and into Property 16 so it cannot become a silent amnesty. The homepage would still need a cap, since nothing requires it to list every locality.

Under either option the homepage needs a cap. The two options differ only on `/areas`.

**Follow-up.** Once decided, amend Requirement 2.3 or 8.8 and Property 16 to match, implement the change, and update the four measured constants at the end of `tests/link-integrity.test.tsx` together with this entry. That block fails whenever the measured counts move, so this entry cannot go stale unnoticed.

---

## D-IMPL-18 — Homepage brand intro: a layer over the site, remembered without storage

**Decision.** A first visit to `/` plays a 4.35-second opening film (`src/components/BrandIntro/`). It shows darkness, then a line of light, one tower, rooms lighting up, a quiet city, and then the INSTLE REAL ESTATE lockup, which flies into the header lockup. The film is an `aria-hidden` overlay above the fully server-rendered page. It holds no focusable element, and the first key, press, wheel or touch-move skips it. There are three tiers: raw WebGL2 (desktop and lite quality, loaded on demand), a 2.5D CSS scene (low-end devices, no WebGL, slow frames, late loads), and a still composition under `prefers-reduced-motion`. By owner request (29 September 2026), a reload, a back or forward navigation, or arriving from another page of this site plays the full film too; `INTRO_CONFIG.returningVisit` switches it back to a 0.9-second sweep across the header lockup (`'brief'`) or to nothing (`'none'`).

**Why these choices.**

* **No client storage.** Returning visits are recognised from the navigation type and a same-origin referrer. The public surface uses no `localStorage` or `sessionStorage` (`tests/public-content.test.ts`), and a cross-session "seen it" flag or cookie is a privacy decision for the owner and counsel. The cost is that a visitor who comes back in a new session sees the full film again.
* **No overlay in the page markup tests.** The homepage tests hold every `<svg>` on `/` to the media register and forbid `<canvas>`. The overlay is therefore rendered by `LayoutShell` rather than the page, the CSS scene is gradient geometry on plain elements, and the canvas is created only after mount. It is not a published drawing and is not registered.
* **No 3D library.** The scene is a few thousand box vertices and four shaders. The lazy WebGL chunk is 8.4 KB gzip. A general engine would outweigh the rest of the homepage.
* **Brand fidelity.** The site has no drawn logo, only the typeset lockup. The film sets that lockup large in the same stack, weight and tracking, which is what makes the landing on the header lockup exact. It uses no tagline: none exists, and none was invented. The only words are the brand, BENGALURU, and the four intent labels already in the navigation.

**Measured** (`scripts/intro-audit.mjs`, `docs/implementation/intro-audit/`; local Chrome, Apple M5, device emulation):

* 60 fps median on every tier.
* Zero layout shift.
* The WebGL context is released and the canvas removed at the end.
* Both skips leave the visitor on `/`, and focus goes to the skip link.
* No overlay with JavaScript off, and none on other routes.
* The homepage's first-load script rises from 175.77 KB to 177.72 KB gzip. The other routes are unchanged, because the intro is a separate chunk loaded only on `/`.

**Not verified.** Safari, Firefox, and physical iOS and Android devices; field performance.

**Open.** The homepage was already over the 170 KB budget before this change (175.77 KB, from other work).

**Reversal.** Set `INTRO_CONFIG.enabled = false` in `src/components/BrandIntro/intro-config.ts`. The boot script then emits nothing and the overlay never renders.

---

## D-IMPL-19 — Site-wide visual language follows the opening film

**Decision.** By owner request, the interface was redesigned in the film's visual language. The content, routes, headings and link structure are unchanged.

* **Night surfaces.** The header, every page intro, contact bands, the footer, the mobile action bar and the homepage hero use the film's palette. The pages hold warm gallery paper for reading between those surfaces.
* **Homepage hero.** The hero holds the film's settled architecture, so the film dissolves into the same scene.
* **Components.** Cards are raised with layered shadows. Buttons are pills. Intent cards are dark architectural tiles with a light that passes on hover.
* **Motion.** Sections rise into view through CSS scroll-driven animation. Every motion is off under reduced motion.

**How.** A `.surface-night` scope in `globals.css` re-points the semantic tokens, so components adapt without dark variants. The paper palette's hex values are unchanged, so `tests/design-tokens.test.ts` still measures what the paper surfaces render. `tests/night-surface-contrast.test.ts` computes every night pairing: text 4.5:1 or better, controls and focus ring 3:1 or better.

**Not verified.** Safari, Firefox and physical devices. `animation-timeline: view()` is Chrome and Edge only today. Elsewhere, sections are simply present without the rise.

**Reversal.** Remove `surface-night` from the components and the night block from `globals.css`. The paper palette is untouched.
