# INSTLE REAL ESTATE — SOURCES AND EVIDENCE LIMITS

Official pages consulted on 29 September 2026. Mutable policies, product behaviour, and pricing should be checked again before implementation/release. The planning recommendations and rupee allowances are our project proposals; sources do not endorse this business or quote those rupee budgets.

## Search, local profiles, and reviews

| Source | What it supports in this handoff |
|---|---|
| [Google AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) | Existing SEO practices apply to Google AI features; no special AI schema/file is required; eligibility does not guarantee inclusion |
| [Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | Avoid doorway/scaled-content abuse, keyword stuffing, and manipulative links; page count alone is not a strategy |
| [Google local-ranking guidance](https://support.google.com/business/answer/7091) | Local relevance, distance, and prominence matter; citywide Maps presence cannot be bought or promised |
| [Google Business Profile representation rules](https://support.google.com/business/answer/3038177) | Business identity/address/service-area and office eligibility must be accurate; no fictional local branches |
| [Google Maps contribution policy](https://support.google.com/contributionpolicy/answer/7400114) | Reviews should reflect genuine experience; no fake identities or incentivized positive-feedback scheme |
| [Google review snippet documentation](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) | Self-serving business reviews should not be treated as a route to brokerage review stars |
| [Google LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business) | Search-feature field requirements must not be filled with fabricated address or business information |
| [Google Business Profile product page](https://business.google.com/us/business-profile/) | The profile itself is offered free; eligibility and truthful representation still apply |
| [Google Search Console](https://search.google.com/search-console/about) | Owner-controlled search-performance and indexing setup after a domain is confirmed |

## AI search and URL discovery

| Source | What it supports in this handoff |
|---|---|
| [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots) | OAI-SearchBot serves ChatGPT search discovery; GPTBot is a separate training control; access does not establish a guaranteed recommendation |
| [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) | PerplexityBot supports its search discovery; official IP/user-agent guidance informs safe public crawler access |
| [IndexNow protocol](https://www.indexnow.org/documentation) | Optional URL-change notifications to participating search engines; it is not a universal ranking command |

No Claude crawler behaviour or platform-specific AI ranking formula was asserted as verified. The future engineer should consult that platform's current official guidance if adding controls. No tool is assumed to have live web retrieval in every mode. llms.txt is a low-priority optional proposal, not a verified universal indexing standard or ranking benefit.

## Costs and postal research

| Source | What was verified or planned |
|---|---|
| [Vercel pricing](https://vercel.com/pricing) | Pro displayed at US$20/month when checked; Hobby described as personal/non-commercial; actual checkout/seat/usage/tax details require confirmation |
| [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) | Advertises at-cost registration/renewal; no unchosen domain availability or rupee price verified |
| [India Post](https://www.indiapost.gov.in/) | Official starting portal for postcode/post-office research; this handoff has **not** verified locality-to-PIN mappings or an exhaustive Bengaluru PIN list |

No paid subscriptions, domain availability checks, checkout transactions, directory edits, business-profile edits, ads, messages, or deployment were performed.

## Repository evidence inspected

- [AGENTS.md](../../AGENTS.md): brand, phone, domain, truthfulness, locality gate, data governance, accessibility, installed Next.js guide requirement.
- [Master blueprint](../../INSTLE-REAL-ESTATE-BENGALURU-MASTER-BLUEPRINT.md): locality claim-level corroboration, current geographic modelling, release rules, data/operations requirements.
- [Existing corrected roadmap](../INSTLE-CORRECTED-ROADMAP-AND-DESIGN-RESET.md): historical implementation claims and deferred operational decisions; not current test evidence.
- [Package manifest](../../package.json): declared framework/runtime scripts, not a verified installed-version report.
- [Homepage](../../src/app/page.tsx), [hero](../../src/components/Concept1/Concept1Hero.tsx), and [services](../../src/components/Concept1/Concept1Pillars.tsx): current content/design baseline.
- [Business constants](../../src/config/constants.ts): exact brand/phone and unconfirmed domain.
- [Locality registry](../../src/config/localities.ts): four labelled-published records, one draft, status-only filtering, generic citations needing claim-level review.
- [Locality route](../../src/app/areas/[slug]/page.tsx): existing published-record page/static-params handling.
- [Lead operations](../../src/lib/lead-operations.ts): default staging-memory destination, local Maps, ignored dispatch success flag, retention timestamp, telemetry call.
- [Enquiry API](../../src/app/api/enquiry/route.ts): header-based body cap, default process call, success/error response paths.
- [Telemetry contract](../../src/lib/telemetry.ts): key allowlist and primitive values; no production analytics destination verified.
- [Header](../../src/components/Header/Header.tsx): existing focus/keyboard/drawer logic to preserve and improve.
- About/contact/service pages and installed Next.js metadata/robots/sitemap guides were also read for planning.

These findings are source inspection, not a browser audit or runtime security assessment. Application tests/build were not run because this turn creates planning artifacts, not application changes. Git state could not be verified because the local Git invocation required Xcode licence acceptance. No system licence was accepted and no unrelated source files were changed.

## Geographic evidence warning

The 132 candidates and their research groups are planning suggestions, not verified administrative classifications, service coverage, exhaustive geography, postcode data, or local infrastructure facts. Each must pass the existing project claim gate and actual editorial/operations approval before appearing as public locality content.
