# ADR-0001: Web Framework, UI Architecture, and Mobile Navigation Specification

* **Status:** Approved for Milestone 1 Scaffolding
* **Date:** 2026-09-26
* **Project:** INSTLE REAL ESTATE — BENGALURU
* **Canonical Brand:** `INSTLE REAL ESTATE`
* **Reference:** [INSTLE-REAL-ESTATE-BENGALURU-MASTER-BLUEPRINT.md](file:///Users/bharathibasavaraj/Desktop/INSTLE/INSTLE-REAL-ESTATE-BENGALURU-MASTER-BLUEPRINT.md)

---

## 1. Context and Problem Statement

INSTLE REAL ESTATE requires a performant, search-engine indexable, and accessible web presence for its Bengaluru brokerage and property advisory service. The platform will not act as a listing portal or publish unverified inventory; its primary user journey is advisory discovery and requirement submission.

The architecture must satisfy:
1. **Server-Rendered Indexability:** Routes must deliver crawlable semantic HTML with zero reliance on client-side hydration for content indexing.
2. **Strict Performance Budgets:** Client JavaScript transferred on key landing routes must remain within the blueprint budget (≤170 KB compressed).
3. **Robust Lead Ingestion Endpoints:** Future milestones require validated server endpoints (`/api/leads/*`) with rate-limiting, schema validation, and decoupled storage adapters.
4. **WCAG 2.2 AA Accessibility:** Rigorous keyboard navigation, semantic landmark structure, contrast thresholds, and accessible dialogs.
5. **Brand and Domain Invariants:** Exact canonical brand `INSTLE REAL ESTATE` across all surfaces; domain kept `TO BE CONFIRMED` with canonical tags unset until domain confirmation.

---

## 2. Technology Evaluations and Trade-Offs

### A. Web Application Framework

| Candidate | Advantages | Trade-offs & Risks | Decision |
|---|---|---|---|
| **Next.js (App Router, TypeScript)** | • React Server Components render static editorial content with 0 KB client JS bundle.<br>• Native API route handlers (`/api/leads/*`) in the same codebase.<br>• Built-in metadata API supporting dynamic header/OG tags without hardcoding canonical domains.<br>• Well-established TypeScript ecosystem and testing harnesses. | • Requires Node/Edge server runtime for dynamic API endpoints.<br>• Framework footprint requires careful component boundaries to keep client bundles under 170 KB. | **Selected** |
| **Astro (Islands Architecture)** | • Zero client JS by default for editorial pages.<br>• Built-in content collections with schema validation. | • Dynamic API mutations and stateful multi-step form handlers require SSR adapter configuration.<br>• Less cohesive testing story for end-to-end multi-step interactive forms. | *Deferred / Alternative* |
| **Vite / Client SPA** | • Extremely lightweight local development and minimal configuration. | • Poor search engine crawlability and LCP on low-tier mobile networks without custom prerendering infrastructure.<br>• Requires separate backend service for API endpoints. | *Rejected* |

### B. Styling Architecture

| Candidate | Advantages | Trade-offs | Decision |
|---|---|---|---|
| **CSS Modules + CSS Custom Properties (Design Tokens)** | • Zero runtime JavaScript overhead.<br>• Direct mapping to blueprint Section 10 design tokens (`tokens.css`).<br>• Fully scoped styles per component without naming collisions.<br>• Full fidelity and control over focus rings, fluid typography, and reduced-motion media queries. | • Requires disciplined authoring of component CSS files rather than inline utility classes. | **Selected** |
| **TailwindCSS** | • Rapid utility-first composition. | • Adds compilation dependency; blueprint does not require it and project guidance prefers vanilla CSS tokens for direct design system control. | *Rejected* |

---

## 3. Mobile Navigation Specification (Modal vs. Disclosure)

The blueprint (Section 6, line 190) specifies:
> *"Mobile: short accessible drawer with persistent call/enquire actions, no mega-menu requirement."*

### Architectural Definition: Modal Navigation Drawer
To provide a focused, distraction-free mobile experience and prevent interaction with obscured page elements, the mobile navigation drawer is explicitly defined as a **Modal Dialog**:
* **ARIA Semantics:**
  * Toggle button: `aria-expanded="true|false"`, `aria-controls="mobile-navigation-menu"`, `aria-label="Toggle navigation menu"`.
  * Navigation container: `role="dialog"`, `aria-modal="true"`, `aria-label="Site navigation"`.
* **Keyboard & Focus Contract:**
  * When opened, focus moves to the first interactive element (close button or first link).
  * Focus is strictly trapped within the modal: pressing `Tab` on the last focusable element wraps to the first; pressing `Shift+Tab` on the first wraps to the last.
  * Pressing `Escape` immediately closes the modal.
  * When closed, focus is restored to the toggle trigger button.
* **Viewport & Body Scroll:**
  * Background scrolling is disabled (`overflow: hidden` on body) while the modal is active.

---

## 4. Accessibility Verification Strategy

A 2px focus ring alone does not constitute WCAG conformance. The project will enforce:
1. **Mathematical Contrast Verification:**
   * Automated unit tests checking relative luminance across all design token pairings:
     * Ink (`#202623`) on Paper (`#F6F4EF`): Ratio ≥ 14:1 (exceeds WCAG AAA requirement of 7:1).
     * White (`#FFFFFF`) on Deep Forest (`#24443A`): Ratio ≥ 8.5:1 (exceeds WCAG AAA).
     * Deep Forest (`#24443A`) on Paper (`#F6F4EF`): Ratio ≥ 8:1 (exceeds WCAG AAA).
     * Accent Vermilion (`#B9573E`) used on interactive UI components meets ≥ 3:1 against background.
2. **Keyboard Navigation & Trapping Audits:**
   * Automated component tests validating Tab order, SkipLink activation, and Modal drawer focus trapping and release.
3. **Screen Reader Semantic Roles:**
   * Native landmarks (`<header>`, `<nav>`, `<main id="main-content">`, `<footer>`) and accessible names on all interactive controls.

---

## 5. Privacy, Data Storage, and Domain Policies

1. **Synthetic Data Only:**
   * In Milestone 1 and all development phases, test fixtures utilize synthetic data only. No real personal data storage (local append-logs or unreviewed databases) will be implemented.
2. **Domain Status Unset:**
   * No canonical `<link rel="canonical">` will be rendered in `<head>`.
   * No XML sitemaps will be published until the domain is confirmed.
3. **Phone Display:**
   * Primary phone is rendered as canonical digits `9353096264` with `href="tel:9353096264"`. Zero WhatsApp assumptions or links.
4. **Zero Disclaimers without Approval:**
   * No unapproved legal or advisory disclaimers will be invented or displayed.
