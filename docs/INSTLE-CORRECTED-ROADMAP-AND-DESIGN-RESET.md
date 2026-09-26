# INSTLE REAL ESTATE — CORRECTED DELIVERY ROADMAP & IMPLEMENTATION BLUEPRINT

**Document Date:** September 2026  
**Reference Baseline:** Working tree on branch `feature/milestone-1-scaffolding-and-shell`  
**Governing Documents:**
- `INSTLE-ANTIGRAVITY-RECOVERY-BRIEF.md` (Authority delivery correction)
- `INSTLE-AUDIT-fab789c-AND-CORRECTION-PROMPT.md` (Integrity audit & correction instructions)
- `INSTLE-REAL-ESTATE-BENGALURU-MASTER-BLUEPRINT.md` (Version 1.0 Master Blueprint)
- `AGENTS.md` (Strict project invariants and compliance guardrails)

---

## 1. Project Invariants & Non-Negotiables

| Invariant | Mandatory Specification | Prohibited / Out of Scope |
|---|---|---|
| **Canonical Brand** | **`INSTLE REAL ESTATE`** (exact spelling, all-caps lockup). Short reference: **`INSTLE`**. | `LUXERE`, `Luxere`, `Instle Real Estate` (mixed case in lockup), `Generic Real Estate`. |
| **Canonical Phone** | **`9353096264`**; visual display `9353096264`; link `href="tel:9353096264"`. | No WhatsApp assumptions, buttons, links, or icons. |
| **Domain Status** | **`TO BE CONFIRMED`**. `<link rel="canonical">` remains unset. | Do not hardcode assumed domain in metadata, Open Graph, or sitemaps. |
| **Truthfulness & Anti-Fabrication** | Real human brokerage advisory model only. No fake inventory, prices, availability, or customer statistics. | No public property listings, inventory cards, fake feeds, or automated valuation engines. |
| **Accessibility Standard** | **WCAG 2.2 AA** target across all breakpoints, forms, and dialogs. | Blanket claims of "WCAG AAA" or "flawless" accessibility without test evidence. |
| **Branch & Environment** | Work remains on `feature/milestone-1-scaffolding-and-shell`. | No direct commits to `main`; no unauthorized production deployment. |

---

## 2. Decision Register Alignment (Canonical Blueprint IDs)

The roadmap uses the actual Master Blueprint Decision and Task IDs:

| Blueprint ID | Domain & Scope | Current Status & Dependency | Roadmap Treatment |
|---|---|---|---|
| **D-01** | Legal entity / trading name relationship | Open (Counsel/Owner) | Public `/about` displays professional corporate profile; statutory entity filings held pending formal registration. |
| **D-02** | INSTLE mark collision & trademark clearance | Open (Counsel) | Brand lockup preserved; legal registration claims omitted. |
| **D-03** | Canonical Domain registration & URL | **DOMAIN: TO BE CONFIRMED** | Canonical tags remain omitted; sitemap generation deferred. |
| **D-04** | Phone `9353096264` business control & staffing | Implemented | Preserved across all headers, footers, hero viewports, and forms. |
| **D-05** | Authorized WhatsApp channel | Disabled | Omitted completely from user-facing UI, links, and navigation. |
| **D-06** | Service territory & asset classes | Active in Core Markets | Core residential advisory: Indiranagar, Koramangala, Sadashivanagar, North Bengaluru. Commercial services held conditional (D-14). |
| **D-07** | Fees, commission & representation disclosures | Open (Business + Counsel; Task **T-013**) | Plain advisory intake; zero unverified fee percentages or legal guarantees. |
| **D-08** | Operational response time & SLA | Open (Operations) | Truthful desk intake notice; no automated 15-minute response promises. |
| **D-09** | Existing CRM / lead inbox & queue owner | In Staging / Open for Production | In-memory staging queue adapter active with schema validation and rate limiting; production CRM adapter path defined. |
| **D-10** | CMS vs. Git-backed editorial content | Decided for V1: Git-backed | Structured TypeScript / JSON locality datasets with claim-level citations and publication gate. |
| **D-11** | Hosting, regions, vendors & DPAs | Open (Tech + Counsel; Task **T-011**) | Next.js hybrid SSR; data minimisation architecture; zero unreviewed local logs. |
| **D-12** | Analytics & consent approach | Implemented (Contract) | Privacy-first telemetry contract (`trackSafeEvent`) with strict runtime key filtering; zero PII in telemetry. |
| **D-13** | Source languages & local Kannada naming | Open (Editorial) | Sourced locality aliases recorded; multilingual deferred to post-V1. |
| **D-14** | Commercial real estate pages inclusion | Conditional | Excluded from public navigation; commercial options in owner intake disabled with explanatory notice. |
| **D-15** | Area maps requirement & licensing | Decided for V1: Editorial first | Curated locality profiles with transit/civic context; zero heavy third-party map tiles. |
| **D-16** | Public office address & hours | Open (Operations) | Physical consultations by prior appointment; address disclosure held pending corporate filing. |
| **D-17** | Accountable privacy & grievance contact | Open (Counsel + Operations; Task **T-034**) | Affirmative DPDP consent checkboxes implemented; privacy notice references Indian statutory principles. |
| **D-18** | Typography licenses & font assets | Implemented | Cormorant Garamond serif and system sans stacks with high contrast. |

---

## 3. Phased Implementation Roadmap & Feature Delivery Matrix

### Implementation Status Matrix

| Component / Feature | Blueprint / Brief Task | Delivery Status | Technical Implementation & Notes |
|---|---|---|---|
| **Visual Concepts Comparison Lab** | Brief Section 2 | Prototype Preview | Isolated to `/concept-review`, `/concept-1`, `/concept-2`. Marked with `robots: noindex, nofollow`. Removed from main site layout. |
| **Refined Homepage (`/`)** | T-025, T-041 | Implemented & Verified | Compact header (64px), concise Buy/Rent/Sell navigation, shorter headline, mobile above-the-fold layout, phone link `9353096264`. |
| **Buyer Journey (`/buy`)** | T-042, T-047 | Implemented & Verified | 5-step Acquisition Brief with empty initial choices, Indian phone validation, affirmative DPDP consent, live `/api/enquiry` submission, Reference ID display. |
| **Rental Tenancy Journey (`/rent`)** | T-047 | Implemented & Verified | Dedicated 5-step tenancy intake: monthly rent bands (₹40k–₹75k, ₹75k–₹1.5L, ₹1.5L–₹3L, ₹3L–₹5L, ₹5L+), furnishing, lease duration, move-in window. |
| **Owner Representation (`/sell`)** | T-047 | Implemented & Verified | Distinct toggle ("Sell Property" vs "Lease to Tenant"), empty initial state, ownership role, real `/api/enquiry` submission. |
| **Enquiry API & Validation (`/api/enquiry`)** | T-032, T-033, T-048 | Implemented & Verified | Payload size cap (32 KB), sliding-window client rate limiter (5 req/10 min), strict runtime schema validation, 15-min idempotency deduplication. |
| **Lead Operations Queue** | T-050 | Staging Memory Adapter | Staging memory adapter (`stagingLeadStore`) retains complete customer details for desk follow-up. Production CRM dispatch blocked on D-09. |
| **Locality Intelligence Engine (`/areas`)** | T-018, T-019, T-051 | Implemented & Verified | Published records gated via `getPublishedLocalities()`. Claim-level citations citing BMRCL, BBMP, BDA. Draft records unindexed. |
| **Brokerage Methodology (`/how-it-works`)** | T-047 | Implemented & Verified | 4-stage advisory framework; unverified competitor accusations removed; plain service copy. |
| **Corporate Profile (`/about`)** | T-047 | Implemented & Verified | Internal blueprint codes removed from UI; dignified corporate profile and governance statement. |
| **Contact Desk (`/contact`)** | T-047 | Implemented & Verified | Direct telephone access `9353096264`; invented operating hours removed; clear service tracks. |
| **Telemetry & Privacy Safeguards** | T-036, T-052 | Implemented & Verified | Strict runtime key allowlist in `trackSafeEvent`; all PII stripped at runtime before logging. |

---

## 4. Media & Rights Attribution Register

All photographic assets currently used in the application are **internal conceptual design studies** (synthesized architectural illustrations) designed to explore visual atmosphere, material palettes, and editorial composition. They are **not** authentic location photographs of specific Bengaluru properties.

| Asset Path | Concept Context | Description & Subject Matter | Provenance & Nature | Usage & Rights Status |
|---|---|---|---|---|
| `public/media/concept1-garden-modernism.jpg` | Concept 1 / Home | Atmospheric study of contemporary Bengaluru residential architecture: Sadahalli stone, teak louvers, and reflection court. | Conceptual AI Architectural Study. | Prototype Mood Study; explicitly labelled Non-Inventory Conceptual Illustration. |
| `public/media/concept1-courtyard-detail.jpg` | Concept 1 / Buyer | Interior light court with natural bamboo and limestone elements. | Conceptual AI Architectural Study. | Prototype Mood Study; non-inventory reference. |
| `public/media/concept2-metropolitan-monolith.jpg` | Concept 2 / Home | Cantilevered dark granite and glass facade study at twilight. | Conceptual AI Architectural Study. | Concept 2 Internal Prototype Preview only. |
| `public/media/concept2-gallery-console.jpg` | Concept 2 / Intake | Executive conference and consultation lounge study. | Conceptual AI Architectural Study. | Concept 2 Internal Prototype Preview only. |

*Production Media Plan:* Prior to public launch, authentic Bengaluru architectural photography must be commissioned from a professional architectural photographer on location in Indiranagar, Koramangala, and Sadashivanagar, with full copyright assignment and property owner releases.

---

## 5. Verification & Test Evidence

- **Automated Test Suite (Vitest):** 25/25 passing tests across `accessibility.test.tsx`, `brand-invariants.test.tsx`, and `concept-and-api.test.tsx`.
- **Linter & Typecheck:** 0 errors, 0 warnings across ESLint v9 and TypeScript v5.7.
- **Next.js 16 Static Build:** 20/20 routes prerendered cleanly.
- **Modern Script Transfer Budget:** 147.21 KB Gzip estimate (22.79 KB headroom below 170 KB limit).
- **Browser Subagent Verification:** Verified desktop homepage, mobile above-the-fold layout, live buyer intake form submission with Reference ID generation, and dedicated rental journey.
