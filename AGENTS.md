# AGENTS.md — INSTLE REAL ESTATE

This document establishes the mandatory operational guardrails, brand rules, compliance constraints, and code conventions for all agents and developers working on this codebase.

## 1. Project Purpose & Scope
* **Project Name:** INSTLE REAL ESTATE — BENGALURU
* **Internal Descriptor:** INSTLE REAL ESTATE — Bengaluru Real Estate Brokerage & Property Advisory Platform
* **Model:** Service-led advisory and brokerage requirement capture.
* **Core Rule:** This platform is **NOT** a property listing portal. Never create, mock, or imply public listings, inventory cards, fake property prices, availability feeds, or automated valuation engines.

## 2. Canonical Brand & Contact Invariants
* **Canonical Brand:** **`INSTLE REAL ESTATE`** (exact spelling and all-caps lockup).
  * Always preserve exact spelling and capitalization in titles, headers, footers, metadata, and docs.
  * Prohibited terms: `LUXERE`, `Luxere`, `Instle Real Estate` (mixed case in user-facing lockup), `Generic Real Estate`.
* **Canonical Phone:** **`9353096264`**.
  * Visual display: Canonical digits `9353096264` (until owner approves a formatted string).
  * Markup link: `href="tel:9353096264"`.
  * **Zero WhatsApp Assumptions:** Do not assume this is a WhatsApp number. Do not display WhatsApp links, buttons, or branding.
* **Domain Status:** **`TO BE CONFIRMED`**.
  * Canonical `<link rel="canonical">` tags must remain **unset** in HTML `<head>`.
  * Do not hardcode any assumed domain name in metadata, Open Graph, or sitemaps.
  * Production XML sitemap generation remains disabled until the domain is confirmed.

## 3. Anti-Fabrication & Truthfulness Mandate
* Never invent business facts, awards, years in business, transaction volumes, customer counts, or testimonials.
* Never claim RERA registration, legal guarantees, or licensed certifications unless verified documentation and counsel approval are provided.
* Never add unapproved legal or advisory disclaimers unless explicitly supplied and approved.
* All locality information must satisfy the blueprint's two-source claim gate and remain unpublished until approved.

## 4. Personal Data & Privacy Rules
* **Synthetic Data Only:** In development, testing, and staging, use synthetic data fixtures only. Never store or ingest real personal data without an approved destination, security review, and privacy governance.
* **No Unreviewed Local Logs:** Do not create unreviewed local files or append-logs for personal data.
* **No PII in Telemetry:** Never send names, phone numbers, email addresses, exact budgets, or free text to analytics or error tracking.

## 5. Accessibility & Quality Standards
* Target: WCAG 2.2 AA.
* Enforce semantic landmarks (`<header>`, `<nav>`, `<main id="main-content">`, `<footer>`).
* Provide an accessible SkipLink as the first focusable element.
* Verify contrast ratios (minimum 4.5:1 for body text, 3:1 for large text/interactive components).
* Mobile navigation drawer is a modal dialog (`role="dialog"`, `aria-modal="true"`) requiring focus trapping and Escape key closure.
