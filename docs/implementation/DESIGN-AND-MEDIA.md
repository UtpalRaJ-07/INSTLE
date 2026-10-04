# Design tokens, media provenance and manual review log

* **Date:** 29 September 2026
* **Code:** `src/styles/tokens.css`, `src/components/ui/`
* **Tests:** `tests/design-tokens.test.ts` (contrast computed from the token file)
* **Screenshots:** `docs/implementation/screenshots/`
* **Machine audits:** `docs/implementation/responsive-audit.json`, `docs/implementation/form-state-audit.json`

---

## Part 1 — Design tokens

### Colour, with measured contrast

Ratios are computed from the hex values in `tokens.css` by the test, using the WCAG relative-luminance formula. Editing a token re-runs the arithmetic.

| Token | Value | Use |
|---|---|---|
| `--color-paper` | `#f6f4ef` | Page background |
| `--color-paper-raised` | `#fdfcfa` | Alternating section background |
| `--color-background-elevated` | `#eee9df` | Footer |
| `--color-ink` | `#202623` | Body text, headings |
| `--color-text-muted` | `#4a534d` | Secondary text |
| `--color-forest` | `#24443a` | Primary action background |
| `--color-forest-dark` | `#17302a` | Primary action hover |
| `--color-border` | `#d3cdc1` | Decorative dividers |
| `--color-border-strong` | `#767f78` | Input and radio boundaries |
| `--color-error` | `#9b3f27` | Error text and marks |
| `--focus-ring-color` | `#1a3a6b` | Focus indicator |

Body text, 4.5:1 minimum — all pass:

| Pairing | Ratio |
|---|---|
| ink on paper | 14.0:1 |
| ink on raised paper | 15.0:1 |
| ink on white | 15.2:1 |
| ink on elevated | 12.7:1 |
| muted on paper | 8.0:1 |
| muted on white | 8.7:1 |
| error on paper | 5.6:1 |
| white on forest | 8.7:1 |
| paper on forest | 8.0:1 |
| muted-on-dark on forest | 5.3:1 |

Non-text, 3:1 minimum — all pass:

| Pairing | Ratio |
|---|---|
| focus ring on paper | 10.3:1 |
| focus ring on white | 11.3:1 |
| control border on white | 4.1:1 |
| control border on paper | 3.8:1 |
| forest surface on paper | 10.4:1 |

Two tokens were changed because they measured short:

* `--color-accent` `#B9573E` → `--color-error` `#9b3f27`. The original was 4.0:1 on paper, below 4.5:1 for error text.
* `--color-border-strong` `#9aa39c` → `#767f78`. The original was 2.59:1 on white, below 3:1 for the visible boundary of an input.

### Type

System stack only — no external font request. Four Google Fonts families were removed (see `DECISION-LOG.md` D-IMPL-07).

Fluid scales via `clamp()`. Body text starts at 17 px on mobile and grows to 18 px, inside the 16–18 px guidance. Headings use `text-wrap: balance`, body copy `text-wrap: pretty`.

| Token | Mobile → desktop |
|---|---|
| display | 34 → 56 px |
| h1 | 31 → 48 px |
| h2 | 24 → 34 px |
| h3 | 19 → 23 px |
| body-large | 17 → 19 px |
| body | 16 → 17 px |

No long uppercase paragraphs. Uppercase is used only for short section eyebrows at 13 px with loose tracking.

### Spacing and layout

4 px base ladder. Content width 1200 px, prose measure 68ch. Edge padding `clamp(1rem, 0.5rem + 2.5vw, 3rem)`. Section rhythm `clamp(2.75rem, 2rem + 3.5vw, 5.5rem)`.

### Controls

Minimum target 44 px, control height 48 px, radius 6 px. Focus ring 3 px with 2 px offset. Breadcrumb links sized to a 24 px minimum; inline prose links get vertical padding that grows the hit area without changing line wrapping.

### Motion

150 ms for small state changes, 260 ms for panels. Both collapse to 0 ms under `prefers-reduced-motion: reduce`, along with `scroll-behavior`. Nothing in the interface depends on a transition to be usable — verified by capturing the drawer with reduced motion forced.

---

## Part 2 — Media register

### Currently published

**No photography.** None exists, none has been supplied under checklist C12, and none is generated. What the public site does carry is original inline SVG drawings: four fixed entries, plus one orientation plate per published locality built from its record. All are typed entries in the Media_Register at `src/config/media-register.ts`, rendered by the server components under `src/components/Bengaluru/`.

#### Provenance (Requirement 9.13)

| Asset ID | Kind | Source reference | Creator | Licence | Permission to adapt | Acquired | Licence expiry |
|---|---|---|---|---|---|---|---|
| `ILL-STREETSCAPE-001` | Illustration | `src/components/Bengaluru/CivicStreetscapeBand.tsx` | INSTLE REAL ESTATE, in-house drawing | Original work owned by INSTLE REAL ESTATE | granted | 2026-09-29 | none recorded |
| `ILL-STREETSCAPE-002` | Illustration | `src/components/Bengaluru/CivicStreetscapeBand.tsx`, cropped | INSTLE REAL ESTATE, in-house drawing | Original work owned by INSTLE REAL ESTATE | granted | 2026-09-29 | none recorded |
| `MAP-CORRIDOR-001` | Map | `src/components/Bengaluru/CorridorDiagram.tsx` | INSTLE REAL ESTATE, in-house drawing | Original work owned by INSTLE REAL ESTATE | granted | 2026-09-29 | none recorded |
| `TEX-LAYOUT-GRID-001` | Texture | `src/components/Bengaluru/LayoutGridMotif.tsx` | INSTLE REAL ESTATE, in-house drawing | Original work owned by INSTLE REAL ESTATE | granted | 2026-09-29 | none recorded |
| `MAP-AREA-<slug>` | Map | `src/components/Bengaluru/AreaOrientationPlate.tsx` | INSTLE REAL ESTATE, in-house drawing | Original work owned by INSTLE REAL ESTATE | granted | 2026-09-29 | none recorded |

Licence terms, the same on every entry: drawn for this site as inline SVG geometry; no third-party asset is traced, adapted or embedded, and nothing is generated from a photograph.

#### What each draws

| Asset ID | What it draws |
|---|---|
| `ILL-STREETSCAPE-001` | A Bengaluru residential street, left to right: a coconut palm; a two-storey independent house with a parapet water tank, a staircase headroom block, sunshaded grilled windows and a balcony railing; a gulmohar; an older single-storey house with a balustered parapet, potted plants, a monkey-top hood over an arched window, a panelled door, a wall ventilator and a double gate, with bougainvillea over the compound wall; a rain tree; a three-storey house over stilt parking with a solar water heater; an electric pole with insulators, a street light, a transformer and a cable coil; overhead wires, the footpath and a painted kerb across the width. No text, no figure, no vehicle, no landmark. |
| `ILL-STREETSCAPE-002` | The same geometry through a tighter viewBox (x 300–1000, y 44–240): the gulmohar, the monkey-top house with its bougainvillea and double gate, the rain tree and the left bay of the stilt house. The palm, the pole, the headroom block and the solar heater fall outside it, and its `depicts` list leaves them out. |
| `MAP-CORRIDOR-001` | A ring road arc open across the top, eight evenly spaced radial roads from an unnamed centre marker, seven interchange rings and sixteen plain station markers. No name, no scale, no boundary. |
| `TEX-LAYOUT-GRID-001` | The geometry of a plotted residential layout: blocks two sites deep, cross roads and two main roads with centre lines, one park with a circular path and one civic amenity site. No block, site or road number. |
| `MAP-AREA-<slug>` | The area in a wide centre plate, two to four neighbouring plates in a row above and below it, and a corridor line with a midpoint marker to each. The area names are the only text; nothing shows a boundary, a distance or a direction. |

#### How each renders (Requirements 9.2, 9.16, 9.17)

| Asset ID | Intrinsic size | Alt text | Visible label | Colours behind text | Rendered by | Compressed |
|---|---|---|---|---|---|---|
| `ILL-STREETSCAPE-001` | 1200 × 256 | "Line drawing of a Bengaluru street: low-rise houses with parapet water tanks, a monkey-top window, a rain tree, a gate." | Illustration label | `--color-paper-raised` #fdfcfa | `/` | 3,625 B |
| `ILL-STREETSCAPE-002` | 700 × 196 | "Line drawing of a Bengaluru house with a monkey-top window, a rain tree and a compound gate behind a wall." | Illustration label | `--color-paper-raised` #fdfcfa | `/buy`, `/sell`, `/rent`, `/rent-out`, `/commercial` | 3,624 B |
| `MAP-CORRIDOR-001` | 960 × 520 | "Schematic of a ring road arc with radial roads and plain station markers. An orientation aid, not to scale." | Orientation-aid label | `--color-paper-raised` #fdfcfa | `/areas` | 627 B |
| `TEX-LAYOUT-GRID-001` | 1200 × 320 | none — recorded decorative, renders `aria-hidden` | none — decorative | `--color-paper-raised` #fdfcfa, `--color-stone` #c9c3b7 | `TypographicPlate`, on a published locality page with fewer than two approved neighbours. No record today. | 1,317 B |
| `MAP-AREA-<slug>` | 480 × 392 | "Orientation plate for \<area\> with the areas around it. Not to scale." | Orientation-aid label | `--color-paper-raised` #fdfcfa, `--color-background-elevated` #eee9df | A published locality page with two to four approved neighbours. No record today. | 759 B, heaviest case |

The two labels, rendered as each figure's caption from the register entry:

* Illustration label: "Illustration drawn for INSTLE REAL ESTATE. A generic Bengaluru street, not a specific property, building or person."
* Orientation-aid label: "Orientation aid, not a map to scale. It shows no boundary, no distance and no travel time."

Notes that matter more than the tables:

* **Provenance.** Every drawing is hand-written `path`, `rect` and `circle` geometry created for this repository. Nothing is traced from a photograph, adapted from a third-party drawing or generated. That is why the creator is the business and the source reference is the component file.
* **Generic by construction.** `depicts` on each illustration lists nouns from `GENERIC_SUBJECT_LEXICON`: "coconut palm", "gulmohar tree", "bougainvillea", "balcony railing", "solar water heater", "stilt parking", "street light", "monkey-top window hood", "painted kerb stone" and the rest. The cropped entry lists only what its viewBox shows. `tests/media-register-entries.test.tsx` checks every noun is in the lexicon, and that no lexicon entry carries a digit, a capital or the name or alias of any locality in the registry. There is no nameboard, house number, shop name or signage text anywhere, no human figure or face, and no recognisable landmark.
* **Labels.** Each map renders the recorded orientation-aid label and each illustration the recorded illustration label, as the figure's own caption, read from the register entry so the recorded and rendered wording cannot drift.
* **No boundary, no distance, no time.** `showsCommuteTimes` and `showsDistances` are literal `false`, so a map claiming either does not compile. `boundaryClaimId` is null on every entry: a claim carries a ward or zone *value*, not a shape, so drawing an outline would mean inventing geometry no source supplied. The administrative value and its boundary version render as page text instead.
* **Which records carry which ID.** Static pages have no record, so their assets are mapped by route in `STATIC_ROUTE_VISUAL_ASSETS`, which is the "Rendered by" column above. A locality record's `visualAssetIds` must equal `localityVisualAssetIds(record)`: nothing while the record is unpublished, because its route renders nothing; `MAP-AREA-<slug>` once published with two to four approved neighbours; `TEX-LAYOUT-GRID-001` once published with fewer, because the typographic fallback renders the texture. No locality record is published, so every one records an empty list today. No guide template renders a drawing, so every guide record's list is empty too.
* **Per-locality entries are derived, not listed.** The orientation plate's subject is a record, so `buildAreaOrientationAsset(record)` builds the entry from the record. Hard-coding one entry per registry record, when none can publish, would record assets no route requests.
* **Two assets render on no page today.** The texture and the orientation plate both belong to the published locality template, and no locality record passes the publication gate. They are built, registered and tested directly rather than left until a record publishes.
* **Weight.** Each recorded weight is measured: the component is serialised with `renderToStaticMarkup`, the `<svg>` carrying the asset id is cut out, and that span is gzipped. The texture is weighed inside `TypographicPlate`; the plate at the heaviest case the registry produces, the longest name in the centre and the next four around it. `tests/media-register-entries.test.tsx` re-measures every entry on each run and fails when a recorded value sits more than 1% (at least 16 bytes) from the fresh figure. The tolerance exists because gzip output is not guaranteed byte-identical across machines. The earlier values went stale by a factor of nearly three when the drawings were redrawn; that would now fail the suite. These are serialised-markup weights, not served weights: a production build names CSS module classes `Bengaluru-module__<hash>__<name>` where the test renderer uses `_<name>_<hash>`, so a served `<svg>` carrying a class gzips a few bytes heavier. `node scripts/measure-visual-assets.mjs` weighs the served markup against the 80 KB and 150 KB budgets and reports any served weight above the recorded one.
* **Contrast.** Each entry declares every colour it presents behind text in `backgroundColoursBehindText`: the figure surface under every caption, the two plate fills under the orientation plate's names, and both colours of the texture under the typographic plate's name. `tests/media-register-entries.test.tsx` re-derives those lists from the rendered markup. `tests/design-tokens.test.ts` reads the text colours out of `Bengaluru.module.css` and the SVG `<text>` fills (today `--color-ink` and `--color-text-muted`), resolves every name against `tokens.css`, and computes 4.5:1 for each text colour against every declared colour: ink measures 15.03:1 on `--color-paper-raised`, 12.74:1 on `--color-background-elevated` and 8.79:1 on `--color-stone`; muted measures 7.77:1, 6.59:1 and 4.54:1. The typographic plate's kicker and name are ink, so the text set over the texture's lines clears 8.79:1. It also parses every `fill` and `stroke` in each component and fails any value that is not `none`, `currentColor`, an opaque `tokens.css` colour or one the asset declares, and computes 3:1 for every mark (each stroke, and each fill that is not a declared surface) against every declared colour: ink 12.74:1 at the lowest, `--color-city-blue` 5.27:1, `--color-accent` 5.54:1, `--color-forest` 10.43:1. `--color-stone` measures 1.71:1 against the surface, so it appears only in the decorative texture; the test exempts that texture from 3:1 only after checking it is recorded decorative, renders `aria-hidden` with no accessible name, and holds no `<text>`, `<title>` or `<desc>`.

### Held, not published

| Asset | What it is | Creator | Licence | Where it is used |
|---|---|---|---|---|
| `public/media/concept1-garden-modernism.jpg` | Conceptual architectural rendering | not recorded | not recorded | Prototype routes only |
| `public/media/concept1-courtyard-detail.jpg` | Conceptual courtyard rendering | not recorded | not recorded | Prototype routes only |
| `public/media/concept2-metropolitan-monolith.jpg` | Conceptual rendering | not recorded | not recorded | Prototype routes only |
| `public/media/concept2-gallery-console.jpg` | Conceptual rendering | not recorded | not recorded | Prototype routes only |

All four are design studies. None shows a real place or an available property. Creator and licence were never recorded, which is itself a reason not to publish them.

They were removed from the public pages (`DECISION-LOG.md` D-IMPL-03): on a brokerage site a large architectural image reads as property imagery however it is captioned.

### Rules for adding an image

1. Record creator, source, licence, permission to adapt, and acquisition date **before** it goes in a page.
2. No generated portrait of Utpal Raj KB, no generated office, no generated transaction scene, no generated customer. An image cannot be used as evidence that something exists.
3. Identifiable people need a release.
4. Meaningful alt text, or empty alt if decorative. Intrinsic width and height always.
5. `priority` on at most one image per page, and only if it is genuinely the largest contentful paint element.
6. A conceptual illustration must be labelled as one.
7. An inline drawing is added by adding its register entry first, its nouns to `GENERIC_SUBJECT_LEXICON`, and its colours to `backgroundColoursBehindText`. The component reads its own entry while rendering, so an incomplete entry fails `next build` rather than shipping a drawing nobody can account for.

### Owner portrait

`OWNER_PROFILE.portrait` is `null`. `/about/utpal-raj-kb` renders no image and no placeholder. Supplying a real photograph with permission is C7 in the owner checklist.

---

## Part 3 — Manual and machine review log

### Machine audit — responsive and layout

`node scripts/responsive-audit.mjs`, driving the Chrome installed on this machine through `playwright-core`. 14 pages × 6 widths (320, 360, 390, 768, 1280, 1440), 84 page loads.

Checks: `document.scrollWidth` against viewport width, naming the widest element on overflow; exactly one `<h1>`; interactive controls at least 24×24; the fixed action bar not covering content at maximum scroll; expected HTTP status.

**Result after fixes: 0 findings.**

Three rounds were needed:

| Round | Findings | What they were |
|---|---|---|
| 1 | 126 | Small tap targets (breadcrumbs 18 px, inline links 19–21 px) across all pages; action-bar overlap reported at every width |
| 2 | 3 | Tap targets fixed. Overlap was a false positive from a scroll that had not applied — the audit was corrected. Remaining: real overlap on `/commercial` only |
| 3 | **0** | `/commercial` overlap was the action-bar label "Commercial enquiry" wrapping to two lines at 390 px, making the bar 87 px against 64 px reserved. One short label on one line, reserved space raised to 72 px |

No horizontal overflow at any width, including 320 px.

### Machine audit — form states

`node scripts/form-state-audit.mjs`, against a preview built with intake enabled, using synthetic data only. **0 findings.**

| Checked | Result |
|---|---|
| Error summary receives focus on failed submit | pass |
| Every summary link resolves to a real element id | pass |
| Invalid fields carry `aria-invalid` and an associated message | pass |
| Success shows a reference | pass |
| Success does **not** echo the name or phone number | pass |
| Network failure says plainly the enquiry was not sent | pass |
| Network failure offers the phone number | pass |
| Network failure keeps entered values so nothing is retyped | pass |
| Nothing written to `localStorage` or `sessionStorage` | pass |
| No horizontal overflow at 150% text | pass |

### Machine audit — drawer

With the drawer open: `role="dialog"` and `aria-modal="true"` present, focus inside the dialog, and both `main` and `footer` carrying `inert`. Captured with reduced motion forced as well.

### Server-rendered output, checked on the running build

| Check | Result |
|---|---|
| Exactly one `<h1>` per page | pass |
| Phone number present in unhydrated HTML | 35 occurrences on the homepage |
| Every `tel:` link | `tel:9353096264`, no exceptions |
| Canonical tags, domain unconfirmed | 0 |
| `og:url` tags, domain unconfirmed | 0 |
| External font requests | 0 |
| Skip link before the shell inside `<body>` | pass |
| JSON-LD | Organization + Person only; no address, rating, offer or sameAs |
| Draft locality slugs | 404 |
| Draft guide slugs | 404 |
| Unknown route | 404, not a redirect |
| `/sitemap.xml`, domain unconfirmed | 404 |
| Prototype routes, production config | 404 |

### Screenshots

Full-page captures at 390 px (`mobile-*`) and 1440 px (`desktop-*`) for all 14 pages, plus:

| File | State |
|---|---|
| `mobile-navigation-drawer.png` | Drawer open |
| `mobile-drawer-reduced-motion.png` | Drawer open, reduced motion |
| `mobile-form-empty.png` | Form, initial |
| `mobile-form-errors.png` | Form, validation errors and summary |
| `mobile-form-success.png` | Form, success with reference |
| `mobile-form-network-failure.png` | Form, network failure |
| `mobile-buy-text-150pc.png` | 150% text size |

Note on reading them: full-page captures show the sticky header a second time partway down. That is a capture artifact, not a layout bug.

### Not covered — be aware

* **Screen readers.** No VoiceOver or NVDA pass was run. Semantics, labels, roles and focus management were implemented to the contract and verified structurally, which is not the same as hearing them.
* **Real devices.** All measurements come from Chrome on this machine with device emulation. No physical phone, no Safari, no Firefox.
* **Field performance.** No real traffic exists, so LCP, INP and CLS at the 75th percentile cannot be reported. Only the lab measurement below exists.
* **Colour-blind simulation.** Not run. Errors and selection are signalled by text and shape as well as colour, which addresses the underlying requirement.

### Lab performance

`npm run measure:js`, against the built homepage:

| Measure | Value |
|---|---|
| Scripts downloaded by a modern browser | **137.67 KB gzip** (466 KB raw) |
| Budget | 170 KB gzip |
| Headroom | 32.33 KB |
| `nomodule` legacy fallback, not downloaded by modern browsers | 38.70 KB gzip |
| Combined including the legacy fallback | 176.37 KB gzip |

Method: gzip of the build artifacts referenced by `<script src>` in the generated homepage HTML. This is a build-artifact estimate, not a browser network measurement, and the two are not identical.

The modern figure is inside the budget. The combined figure exceeds it by 6.37 KB, which only matters for a browser that takes the `nomodule` path — outside the proposed browserslist baseline, which itself still needs owner confirmation.

No image payload, no external font, no third-party script on any public page.
