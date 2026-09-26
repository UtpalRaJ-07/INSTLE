# INSTLE REAL ESTATE — BENGALURU
## Master Product, Brand, UX, UI, Engineering, Content, SEO & Operations Blueprint

**Planning-only deliverable · Version 1.0 · 26 September 2026**  
**Project:** INSTLE REAL ESTATE — BENGALURU  
**Internal descriptor:** INSTLE REAL ESTATE — Bengaluru Real Estate Brokerage & Property Advisory Platform  
**Canonical brand:** **INSTLE REAL ESTATE**  
**Short reference:** **INSTLE**, where appropriate  
**Domain:** **TO BE CONFIRMED**  
**Primary phone:** **9353096264**  
**WhatsApp number:** TO BE CONFIRMED SEPARATELY  
**Status:** Product and delivery blueprint; no implementation has begun.

> Planning boundary: This document defines a future product. It does not authorize website implementation, production code, dependency installation, infrastructure configuration, or publishing. No public inventory, prices, availability, customer counts, credentials, testimonials, or legal/business claims are asserted here unless identified as verified and sourced.

## 0. Executive summary

INSTLE REAL ESTATE is planned as a premium Bengaluru real-estate advisory and brokerage experience. Its first public website should help buyers, tenants, sellers, landlords, and commercial seekers explain what they need and connect with a human brokerage team. It should not present itself as a property portal or manufacture an inventory to fill the screen.

The central product loop is: understand the service → choose an intent → provide a short, useful requirement → receive a clear confirmation → human follow-up → qualification and matching handled by the brokerage. Trust must come from transparent identity, process, real contact, useful local knowledge, clear limits, and documented handling—not invented reviews, availability, statistics, or guarantees.

V1 should include an editorial brand site, service/intent pages, a short buyer/renter lead flow, a seller/landlord lead flow, contact pathways, a modest set of researched locality pages, consent/privacy explanations, analytics with data minimisation, and a basic secure lead operations workflow. Public listings, automated valuation, transactions, payments, property verification claims, AI matching, and a complex map application are deferred.

**Recommended product decisions:** build server-rendered/indexable routes; model locality content as reviewed structured records; initially route leads into a controlled CRM or secure backend workflow; keep phone call as a first-class conversion path; launch only locality pages that pass quality review; make imagery licensed and traceable; adopt a calm architectural editorial design with restrained motion and no decorative 3D requirement.

**Build-readiness verdict:** Not ready for implementation. Blocking decisions include legal business identity, ownership/contact operations, domain, brokerage coverage and process, consent/legal copy, service response expectations, available proof points, design approval, and data/CRM hosting choices. These are recorded in the decision register.

## 1. First-principles decisions

| Question | Planning answer |
|---|---|
| What problem is solved? | People can state a real requirement and get a human-led brokerage response without scanning an unverified catalogue. Owners can describe a property and request a conversation. |
| Why call instead of search alone? | A broker can clarify priorities, local trade-offs, timing, and options across a fragmented market. The site must explain that assistance concretely and must not promise a match. |
| Why submit as a seller/landlord? | One concise path to share property basics and request contact from the team; no promise of buyer demand, valuation, or sale/rent outcome. |
| What creates trust without listings? | Exact business identity, verified contact details, clear service boundaries, process transparency, human response ownership, source-backed area guidance, privacy clarity, and real evidence only when approved. |
| What must the form ask? | Contact method, intent, property type, broad location, budget/price band if relevant, timing, and a small number of high-value qualifiers. Collect optional detail progressively. |
| How can area pages help? | Explain location context with distinct sourced facts, practical selection questions, transit/landmark context and relevant service CTA. Publish only when unique usefulness is demonstrable. |
| After submission? | Acknowledge receipt, give reference/status expectations only when operations can support them, notify a named queue, assign owner, contact, qualify, update state, and close or follow up. |
| How qualify leads? | Explicit intent + property class + locality + budget/timing + contactability; use human qualification and a reason-coded disposition. No sensitive financial documents in V1. |
| How scale without doorway pages? | A governed locality dataset and evidence gate; keep thin/unreviewed pages out of index and navigation; do not generate pages for every keyword or locality-intent permutation. |
| Premium and fast? | Art-directed photography, typography, whitespace, editorial hierarchy, server-rendered content, responsive image variants, restrained motion, no default map/3D bundle. |
| What is V1? | Brand/service discovery, buyer/renter and owner enquiries, calls, contact, curated area discovery, privacy/legal foundation, lead operations, analytics, accessibility, search foundation. |
| What is deferred? | Public property marketplace, listings feed, online booking/payment, valuation, mortgage/legal services, customer accounts, AI, user-generated reviews, elaborate 3D, live maps unless validated. |
| What stays flexible? | CMS, CRM, hosting, database, map provider, analytics vendor, WhatsApp provider, exact framework, commercial model, future inventory. Record ADRs before commitment. |

## 2. Business and product definition

### Vision, mission and value proposition

- **Vision:** Make Bengaluru property decisions easier to navigate through clear local knowledge and responsive human brokerage.
- **Mission:** Connect a person’s stated real-estate need or property offering with a considered brokerage process.
- **Public proposition to validate:** “Tell INSTLE REAL ESTATE what you are looking for; the team will understand the requirement and discuss relevant next steps.” This is a planning expression, not approved final marketing copy.
- **Differentiation hypothesis:** service-led requirement capture, curated human matching, Bengaluru-local discovery, transparent expectations, and a premium editorial brand.
- **Business model:** brokerage/agency revenue from successful transactions may be relevant, but commissions, representation, fees, conflicts, and disclosures must be approved before public claims or lead scripts are written.
- **Geographic scope:** Bengaluru urban market as initially defined by brokerage coverage. “Bengaluru” coverage boundary and outer-area inclusion require confirmation; administrative and marketing boundaries must not be conflated.

### Goals and measures

1. Help a first-time visitor identify the service and their next step in under one screen.
2. Capture contactable, sufficiently qualified enquiries without asking for excessive personal data.
3. Route enquiries to an accountable human owner and make follow-up measurable.
4. Publish useful locality information with source, review date, and accountable editor.
5. Establish a distinctive, consistent INSTLE REAL ESTATE identity.
6. Keep the website accessible, performant, secure, and indexable.

Outcome measures (targets TBD after baseline): intent CTA engagement, form-start-to-submit completion, call clicks, contact rate, qualified-lead rate, time to first human attempt, duplicate/spam rate, locality-page assisted conversions, consent withdrawal/complaints, Core Web Vitals, accessibility defects, and index coverage. Do not set numeric conversion promises before actual baseline and capacity data.

### Non-goals for V1

- No public property catalogue, invented or sample listings, fake availability/pricing, or availability search.
- No property sale/purchase contract, escrow, checkout, payments, mortgage facilitation, legal due diligence, title certification, valuation, or guaranteed investment return.
- No user accounts, agent marketplace, seller dashboard, public reviews module, or automated matching unless specifically approved later.
- No AI-generated property/location facts, citywide map dataset, or mass-produced locality landing pages.
- No claims of RERA registration, licensed expertise, awards, volume, years in business, or verified outcomes until evidence and legal approval exist.

## 3. Personas and jobs-to-be-done

All profiles below are hypotheses to validate with interviews and actual lead data, not demographic facts about Bengaluru residents.

| ID / persona | Job and information needed | Main friction / trust question | Useful CTA and minimum qualifying detail |
|---|---|---|---|
| P01 Apartment buyer | Narrow areas, bedrooms, budget, possession timing | “Will someone listen before sending random options?” | Share buying requirement; phone, intent, area, budget band, bedrooms, timeline |
| P02 Villa buyer | Compare locality, commute, land/home needs | “Will the team understand independent homes?” | Discuss villa requirement; area, budget band, timing, must-haves |
| P03 Site/land buyer | Specify plot/site type, location, intended use | “Are facts and documentation being represented responsibly?” | Request a conversation; intended use, area, size band, budget/timing; no legal guarantees |
| P04 Premium buyer | Discretion, curation, service quality | “Will my information be handled discreetly?” | Arrange a private consultation; preferred contact/time, broad requirements |
| P05 Tenant | Find rental options with location, move-in and furnishing needs | “Will this enquiry result in relevant follow-up?” | Share rental need; area, budget, type, move-in date, contact |
| P06 Seller | Present property and discuss brokerage process | “Who is receiving details and what happens next?” | Discuss selling; owner/authorized contact, location, type, size, timeline, expected range optional |
| P07 Landlord | Rent property and set occupancy conditions | “Can you handle tenant enquiry and updates?” | Discuss renting; location, type, furnishing, availability window, contact |
| P08 Commercial buyer | Identify office/retail/industrial requirement | “Does the team cover my asset and geography?” | Discuss commercial requirement; use, area, size band, budget, timeline |
| P09 Commercial tenant | Specify lease use, area, size, move-in, fit-out | “Can a human clarify suitability and terms?” | Share commercial leasing need; use, area, size, timing, contact |
| P10 Investor | Understand acquisition constraints and risk | “Will claims be evidence-based and conflicts clear?” | Request discussion; asset class, horizon, broad budget; no yield/return claims |
| P11 NRI/remote buyer | Remote coordination, communication time zone, trust | “Can I communicate without travelling first?” | Request remote consultation; contact preference, time zone, locality, type, timing |

Research plan: 8–12 interviews distributed across buyer/seller/tenant/landlord and commercial intents, then observe real enquiry handling. Confirm hypotheses before final field wording and interaction design. Never infer protected traits or use them for lead scoring.

## 4. Journeys and operating funnel

### Buyer / tenant journey
Landing → understand brokerage → choose buy/rent → property category → choose one or more preferred areas (or “open to guidance”) → budget range and key constraint → timing/contact → consent notice → review/submit → confirmation → human contact attempt → qualify → discuss options → match if possible → viewing coordination → negotiation/closure or reason-coded nurture/closed-lost.

### Owner journey
Landing → sell/rent CTA → property class and location → size/condition/availability → expected range optional → ownership/authority confirmation (not document upload) → contact/time → consent → submit → receipt confirmation → human verification → mandate/representation and fee discussion per approved process → matching/viewing → updates → closure.

### City discovery journey
Home → Bengaluru overview → region/corridor discovery → locality page with fact/source date and honest limitations → related localities → intent-specific CTA → requirement capture. No route should imply listing availability in a locality.

### Call-first and messaging
Call link (`tel:+919353096264`, subject to phone format confirmation) → native dialer → user-initiated call. Track click only, not call contents. WhatsApp CTA remains hidden until a separately confirmed number, account ownership, message text, privacy implications, and fallback are approved. Never invent a WhatsApp contact.

### Failure paths
- Form network timeout: retain current form data in memory/session only under explicit privacy design; show retry and call alternative; prevent duplicate submission using idempotency key.
- Lost connection: explain no submission was confirmed; allow retry; do not show false success.
- No match: human explains constraints and next agreed follow-up; no fabricated stock.
- Invalid/duplicate/spam: field-level correction or neutral rate-limit message; accessible, non-accusatory.
- Call unavailable: show callback form and business hours only after verified.
- User withdraws consent/request: route to a documented human privacy process and suppress unnecessary follow-up.

### Funnel and event map
`impression → visit → meaningful engagement → intent select → form_start → form_step_complete → form_submit_attempt → form_submit_success → lead_contact_attempt → lead_contacted → lead_qualified / disqualified → matched → viewing_requested / viewing_completed → negotiation → closed_won / closed_lost`.

Website analytics may measure the first seven events with pseudonymous session context where consent/legal basis permits. CRM events after submission require role access, retention, and audit controls. Do not send phone, email, free text, exact property address, or other direct identifiers to analytics. `click_to_call` logs placement, route, device class, and time only. Document opt-in/consent and vendor data flows before selecting analytics.

## 5. Brand validation and brand system

### Brand rules (mandatory)

- Canonical public brand: **INSTLE REAL ESTATE**. Use exact spelling and capitalization in navbar, brand lockup, page titles, footer, forms, confirmations, metadata, Open Graph, structured data, docs, analytics taxonomy, CRM labels, admin architecture, legal/privacy text, SEO and future app naming.
- Short reference: **INSTLE** only where appropriate. Avoid “Instle” unless sentence-style context is necessary and approved.
- Prohibited alternatives/placeholders: LUXERE, Luxere Real Estate, [REAL ESTATE BRAND], Bengaluru Real Estate as a company name, Generic Real Estate, and invented alternatives.
- Project title: **INSTLE REAL ESTATE — BENGALURU**. Internal descriptor may follow it, but never replace the brand.
- Domain: **TO BE CONFIRMED**. No candidate domain is canonical or assumed.
- Canonical telephone: **9353096264**. International display formatting and `tel:` value require owner confirmation. WhatsApp is unconfirmed.

### Brand validation checklist

Status at blueprint date: **not validated; work required before publication/name investment**. The exact string was searched on the public web on 2026-09-26; that is a preliminary query only, not a clearance. No result from web search would establish legal availability.

| Check | Required work / evidence | Gate |
|---|---|---|
| Spelling | Confirm legal owner’s intended spelling is INSTLE; test pronunciation, transliteration and common typo variants | Owner sign-off |
| Capitalization | Approve canonical all-caps lockup and sentence usage rules | Brand approval |
| Legal/business-name confirmation | Confirm entity name, proprietor/company name, authorized trading name, address and representations with owner/counsel | Legal approval; do not imply entity is registered before proof |
| Domain availability | Owner supplies candidate(s); check registrar/registry availability, conflicts and ownership; record date and evidence. Current domain remains **TO BE CONFIRMED** | Explicit owner selection |
| Social-handle availability | Check platform-native searches for exact and confusingly similar handles; reserve only with owner authorization | Evidence ledger |
| Trademark considerations | Search IP India public trademark search for wordmark, phonetic/visual variants and relevant classes; engage Indian trademark counsel for opinion/filing strategy | Counsel clearance; no legal conclusion from this plan |
| Logo availability | Search existing registered/unregistered marks, reverse image, marketplace and company marks; ensure commissioned design is original and assignment/licence is documented | Design and legal review |
| Brand collision risk | Search web, app stores, company registries where available, maps, directories, social platforms, phonetic variants and adjacent categories; maintain collision log | Counsel/owner disposition |
| SEO landscape | Search brand, misspellings, related organizations, search result ambiguity and query overlap; establish Search Console baseline only after domain is selected | SEO review |
| Existing companies using similar names | Search MCA/company directories, IP India, maps, web and professional networks; date each result, distinguish exact/near match and geography | Counsel review |

IP India provides a public trademark search service; this blueprint did not complete a formal class-by-class clearance. Reference: [IP India e-services](https://ipindia.gov.in/pages/e-services) and [Trade Mark Public Search](https://tmrsearch.ipindia.gov.in/ESEARCH). Preliminary public web search for the exact phrase is not proof of non-use. No claim of availability is made.

### Personality, voice and visual identity

Personality: established, premium, modern, Bengaluru-aware, human, composed, transparent, precise. Voice: clear and helpful; state what the team can do and what it cannot guarantee. Avoid aggressive urgency, inflated luxury cues, unsubstantiated expertise, “AI-powered” claims, generic superlatives, and pressure copy.

Distinctive visual idea: **Bengaluru through architectural layers**—street-level human scale, mature trees and civic texture, mid-rise neighbourhoods, commercial corridors, and contemporary homes—framed like an architecture/editorial journal. Use strong typographic hierarchy, generous margins, field-note style locality facts, controlled crops, precise rules/lines, and a muted palette with a single confident brand accent. Do not default to black/gold, generic gradients, portal card walls, random glass, or stock-photo families.

Logo direction: custom wordmark “INSTLE” with “REAL ESTATE” as an optically balanced descriptor; test one-line and stacked lockups, small favicon monogram, dark/light and monochrome versions. Do not draw a generic roof/house-pin icon. Designer must investigate letterform distinction and actual collision before finalizing. Deliver vector master, clear-space/minimum-size, monochrome, favicon/app variants, usage examples and source/licence/assignment record.

Brand system outputs: brand principles, approved lockups, voice guide, UI copy guide, color tokens, type pairing, image art direction, icon style, motion principles, use/don’t-use examples, and a brand QA checklist that blocks prohibited names.

## 6. Product architecture, navigation and page inventory

### Homepage structures considered

| Concept | Shape | Advantages | Risks | Decision |
|---|---|---|---|---|
| A. Intent-first editorial (recommended) | City hero → “buy/rent/sell” paths → process → Bengaluru locality discovery → human contact | Clear action, explains service, supports brand and local SEO, scales without inventory | Needs precise concise copy and believable local imagery | Select for V1 |
| B. City atlas first | Interactive city/area discovery dominates hero | Strong local story and exploration | Can obscure service; map assets/accessibility/performance cost; may imply inventory | Defer map; borrow editorial locality modules |
| C. Brokerage profile first | Brand/process/team story then enquiry | Establishes trust without listings | CTA can be buried; relies on real team/process evidence not yet supplied | Use selected trust/process content below primary intent choices |

### Sitemap (indexability conditional on content readiness)

- `/` — brand and service overview, primary intent routing, phone CTA.
- `/buy` — buying requirement path and process.
- `/rent` — rental requirement path.
- `/sell` — selling property owner path.
- `/rent-out` — landlord path (could be combined with `/sell` if content cannot justify a distinct page).
- `/commercial` — commercial enquiries, if team confirms capability.
- `/areas/` — Bengaluru discovery index.
- `/areas/[locality-slug]/` — reviewed locality guide, publish-on-quality-gate.
- `/how-it-works/` — process, role boundaries, next steps.
- `/about/` — team/entity details only when verified.
- `/contact/` — 9353096264, approved contact details, form, location/hours only if verified.
- `/privacy/`, `/terms/`, `/cookie-preferences/` — counsel-reviewed and operationally accurate.
- `/thank-you/` or route-state confirmation — noindex; no PII in URL.
- `/404/` — helpful route recovery.

Avoid thin `/property-types/[type]` routes at launch unless each page has distinct demand, content and action. No locality × intent permutations unless each is substantively useful. Navigation A: logo; Buy, Rent, Sell; Areas; How it works; Contact; phone CTA. Mobile: short accessible drawer with persistent call/enquire actions, no mega-menu requirement.

### Page inventory (initial)

| Page ID | Route | Primary job | Primary CTA | Indexing |
|---|---|---|---|---|
| PG-01 | `/` | Explain INSTLE REAL ESTATE and route intent | Choose requirement / call | Index after copy and brand gate |
| PG-02 | `/buy` | Capture a buyer requirement | Share buying need | Index after process validated |
| PG-03 | `/rent` | Capture a tenant requirement | Share rental need | Index after coverage validated |
| PG-04 | `/sell` | Capture owner selling need | Discuss selling | Index after service/fee disclosure approved |
| PG-05 | `/rent-out` | Capture landlord need | Discuss renting out | Conditional; combine if redundant |
| PG-06 | `/areas/` | Navigate researched areas | Explore area / share need | Index when area records ready |
| PG-07 | `/areas/[slug]` | Useful locality discovery | Contact with requirement | Individually reviewed/indexable only |
| PG-08 | `/how-it-works/` | Explain human process and boundaries | Start a conversation | Index after operations confirm |
| PG-09 | `/about/` | Identify business/team | Contact | No publication until identity facts verified |
| PG-10 | `/contact/` | Give reliable contact options | Call 9353096264 | Index after business details verified |
| PG-11 | `/privacy/`, `/terms/` | Explain legally reviewed terms | N/A | Index; publish after counsel |
| PG-12 | confirmation | Confirm receipt and recovery path | Call / return | Noindex; no PII |

### Homepage layout specification

1. Accessible skip link and restrained header with exact canonical brand.
2. Editorial hero: Bengaluru-specific commissioned/licensed architecture photograph; concise statement naming city, brokerage/advisory role, and human next step; two intent actions (Find a property / List a property) with renter path visible; tap-to-call on mobile.
3. Intent rail: Buy, Rent, Sell/rent out, Commercial (only supported).
4. “How the process works” three steps: tell us → human discussion → relevant next step; no guaranteed match.
5. Bengaluru discovery: small set of genuinely researched localities with descriptions/facts and last-reviewed date; no listing cards.
6. Brand proof: verified people/process/contact evidence. Until supplied, use process transparency rather than fake testimonials.
7. Seller/owner section with explicit requirements and direct CTA.
8. Contact band and footer with service routes, curated areas, legal and phone.

Hero requirements: desktop crop composed around legible text; mobile art-directed crop or static image; 1–2 optimized variants, no autoplay video by default. Alt text describes meaningful subject/context, decorative imagery uses empty alt. No-JS content and anchor form actions remain useful. Reduced-motion removes transitions. Slow devices receive static AVIF/WebP/JPEG fallback. If hero image fails, maintain background color and readable layout.

## 7. Bengaluru geography, locality and content system

### Taxonomy and coverage

Model entities separately: metropolitan/marketing service area; administrative body and boundary version; planning zone/corridor; locality/neighbourhood; micro-locality; road; transit station/line; landmark; PIN/postal delivery area; property intent. A locality can map to several source geographies, and a postal code is not a neighbourhood definition. Record boundary/source date and alias history. Store display name, approved slug, Kannada/local variants where reviewed, geospatial point/polygon only with rights/provenance, parent links, confidence, citations, reviewer, and last checked date.

Starting research queue (not verified exhaustive, not declared full coverage):
- **Central:** MG Road, Indiranagar (edge classification may be East), Ulsoor, Vasanth Nagar, Shivajinagar, Frazer Town, Richmond Town, Jayanagar? (south); Basavanagudi, Malleshwaram? (west/northwest), CBD/Cubbon Park, Domlur.
- **North / North-East:** Hebbal, Jakkur, Yelahanka, Thanisandra, Hennur, Kalyan Nagar, Horamavu, Banaswadi, Nagawara, Vidyaranyapura, Jalahalli, Peenya, Dasarahalli, Yeshwanthpur.
- **East:** Whitefield, Brookefield, Kadugodi, Varthur, KR Puram, Mahadevapura, CV Raman Nagar, Kaggadasapura, Hoodi, Marathahalli.
- **South-East:** Bellandur, HSR Layout, Sarjapur Road, Koramangala, BTM Layout, Electronic City, Bommanahalli, Haralur, Kasavanahalli.
- **South:** Jayanagar, JP Nagar, Bannerghatta Road, Arekere, Gottigere, Banashankari, Kanakapura Road, Uttarahalli, Begur.
- **West / South-West:** Rajajinagar, Vijayanagar, Nagarbhavi, Kengeri, RR Nagar, Basaveshwaranagar, Chandra Layout, Mysore Road.
- **Outer Bengaluru / satellites:** Devanahalli, airport corridor, Hoskote, Anekal, Attibele, Nelamangala, Bidadi; include only if business covers them and boundaries are described honestly.

This is a seed research backlog, not a factual classification. Verify against current official mapping, applicable Greater Bengaluru Authority/corporation boundaries, BDA planning material, transport operators and local sources. A government map may represent wards/planning units rather than marketing localities. BBMP maps/GIS and BDA planning maps are reference sources, not automatically open data for republishing; check currency, rights, attribution, and boundary changes before use. Source: [BBMP maps](https://www.bbmp.gov.in/maps/), [GBA GIS viewer](https://bbmp.gov.in/gisviewer/index.html), [BDA master-plan page](https://eng.bdabangalore.org/masterplan.html).

### Locality page quality gate

Page must provide: distinct locality framing; access/context (only sourced); residential/commercial character with attribution/date; practical buyer/tenant/seller questions; real nearby-place relationships; authored editorial text; accurate image rights/caption/alt; reviewed FAQ only when truly useful; links to related places selected by geography; contact CTA without implied inventory. Require two credible independent sources for significant factual claims where possible, with primary source preferred. Record source URL, publisher, publication/update date, access date, exact claim supported, reviewer and expiry/recheck date.

A page is `draft` until editorial, local reviewer and SEO reviewer approve it. If it cannot pass uniqueness/usefulness/fact checks, keep it unpublished or `noindex`. Google says people-first usefulness matters and identifies doorway abuse and scaled content abuse; a large set of near-duplicate locality pages is not the plan. Sources: [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) and [spam policies](https://developers.google.com/search/docs/essentials/spam-policies).

### Locality content schema

`Locality` fields: id; canonical_name; slug; aliases; language labels; marketing_region; parent/admin mappings (versioned); centroid/boundary source and licence; summary; character statements; relevant intents; roads/transit/landmarks relationships; verified_facts[] (claim, source, source_date, checked_at, confidence, reviewer, next_review); image_asset_ids; related_localities; faq[] with evidence; SEO title/description; status; author; reviewer; created_at; updated_at; last_reviewed_at; indexing state. No exact live availability/prices. Include stale-content expiry and visible “Reviewed [date]” only when editorially useful.

### Landmark inventory fields

Landmark record includes name, canonical type, coordinates/source, locality relation, official/operator source, access/transit facts with date, image source/licence/creator, UI relevance, alt text, attribution, SEO relevance, review owner. Candidate examples: Vidhana Soudha, Bangalore Palace, Cubbon Park, Lalbagh, MG Road, Church Street, UB City, airport, ORR and metro stations. Confirm naming, boundaries, operation and visual rights individually before display.

## 8. Content and SEO architecture

### Content governance

Every claim tagged `VERIFIED`, `OWNER CONFIRMED`, `ASSUMPTION`, or `REQUIRES VERIFICATION`. No fabricated property facts, market statistics, market forecasts, reviews, awards, staff biographies, business address/hours, RERA status, client results, guarantees, or transaction counts. Writer creates claim ledger; reviewer checks linked source and date; business owner signs claims about the business; counsel reviews legal statements; SEO reviewer checks intent/duplication; editor approves publication and refresh date. Archive stale claims rather than quietly rewriting history.

### Search architecture

- One canonical host/domain selected by owner; until then all URL examples are path-only and domain metadata is unset.
- Unique page title/description per approved route, straightforward heading hierarchy, human-readable URL, canonical URL after domain decision, XML sitemap with only canonical indexable routes, robots directives, redirects for route changes, 404 behavior, internal breadcrumbs and crawlable anchors.
- Search Console/Bing Webmaster tools after domain ownership verification; monitor indexing, query intents, branded variants, crawl errors and sitemap.
- Local SEO: accurate real-world name/contact/address/hours only if applicable and confirmed; no virtual-office misrepresentation, fake service addresses, fabricated local profiles, or keyword-stuffed business name. Confirm eligibility and consistency before profile creation.
- Structured data: `Organization` on home/about if data is real; `LocalBusiness` only when its physical-location/business model facts satisfy current guidance. Use exact brand spelling. Include telephone only after formatting/consent confirmation, URL only after domain confirmation, logo only after final identity. No fake review, rating, offer, price, availability or property `Product` markup. Google requires accurate matching content and structured data eligibility; schema is not a ranking guarantee. Sources: [Organization data](https://developers.google.com/search/docs/appearance/structured-data/organization), [Local Business data](https://developers.google.com/search/docs/appearance/structured-data/local-business).
- Image SEO: descriptive filenames, appropriate alt, responsive sizes, relevant context, Open Graph image tied to page, avoid image text baked into hero. Source: [Google Images best practices](https://developers.google.com/search/docs/appearance/google-images).
- Avoid FAQ schema abuse, hidden content, doorway pages, city clones, duplicate locality/intent pages and keyword stuffing.
- Page matrix fields: SEO-ID, route, search intent, title rule, description, canonical, indexability gate, schema eligibility, primary internal links, image, unique evidence, reviewer, publish date, last reviewed.

Title pattern examples (not approved final copy): `Buy Property in Bengaluru | INSTLE REAL ESTATE`; `Property Guidance in [Locality] | INSTLE REAL ESTATE`. Domain-specific canonical, Open Graph URL and logo URL stay unset until selected.

### Page quality and release gates

A public indexable locality page requires: two-source claim ledger, genuine page differentiation, no fake inventory, useful original text, image provenance, contact path, title/description, canonical, breadcrumbs, mobile/accessibility review, and freshness owner. Until achieved, keep out of sitemap/navigation and `noindex`/unpublished. Google documentation as reviewed 2026-09-26 recommends useful human-oriented content, canonical hygiene, and sitemap URLs representing preferred canonicals; see [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) and [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## 9. UX, forms, contact and lead operations

### Buyer/renter form specification

Recommended first step: intent; second: type + preferred locality (multi-select plus “open to guidance”); third: budget band + timing + 1–2 relevant qualifiers; fourth: name + phone and optional email/preferred contact window; optional notes; privacy notice and consent controls as counsel approves. Distinguish required service-request processing from optional marketing consent. Explain who contacts them, why, and how to request deletion/withdraw. Do not require exact income, government ID, bank statements, or sensitive details. Phone validation should accept Indian formats with accessible errors; email optional unless operationally needed. Avoid forced account creation.

### Seller/landlord form

Intent (sell/rent); property class; broad locality/address optional (do not require public exact address); size/configuration; expected price/rent optional; availability/timing; confirmation that submitter is owner or authorized representative; name, phone, optional email; notes; notice/consent. No document upload V1. Do not represent the form as a valuation or verification.

### Shared interaction requirements

Progress indicator with step names; keyboard-first operation; labels persist; errors linked by `aria-describedby`; focus moves to error summary after failed submit; no color-only errors; autocomplete and mobile keyboard hints; back navigation preserves state; submit button pending/disabled and idempotent; inline privacy explanation; success/error/timeout/offline/duplicate states; client and server validation; spam controls with accessible fallback. CAPTCHA vendor is an open decision. Keep form data in memory unless explicit recovery policy and retention is approved. Strip PII from URLs, logs, analytics and exception traces.

### Contact placement and events

Phone 9353096264 appears in desktop header, mobile call CTA, hero, buyer/seller/rental pages, each locality CTA, contact page and footer. Each uses one content constant and `tel:` link. Desktop text display is exact canonical digits until a preferred readable display format is owner-approved. Events: `phone_click` with `page_id`, `placement`, `device_class`, `session_id` if permitted; no dialed/contact details in event payload. Confirm number is active and business-controlled before launch.

### Lead states and SLA design

States: `received → spam_review` (if flagged) → `queued → assigned → first_attempt → contacted → qualifying → qualified / disqualified → matching → matched / no_match → viewing → negotiation → won / lost → archived`. Add `duplicate`, `withdrawn`, `unable_to_contact`, `do_not_contact`. Require actor/time/reason for each state change. Set private operational targets only after staff capacity is confirmed: first response target, attempts cadence, seller verification steps, no-match update cadence, escalation owner. Do not publish SLA promises until tested and staffed.

Lead record: UUID; created_at; source route/campaign; intent; property type; localities; broad budget; timeline; qualifiers; contact details; preferred channel; consent/notice version and timestamp; status; assigned user; contact attempts; disposition; retention_until; deletion/withdrawal status; audit history. Separate identity data from product analytics. Access based on role, MFA, export auditing, transport/storage encryption, secrets management, backups/restore tests, retention and deletion workflow. CRM vendor and data processor terms must be reviewed before live lead data.

## 10. Design system and visual/interaction specifications

Initial token proposal is a design hypothesis; validate contrast and photography fit before implementation.

### Foundations

- **Palette:** warm paper `#F6F4EF`; ink `#202623`; deep forest `#24443A`; architectural stone `#C9C3B7`; city blue `#557C86`; accent vermilion `#B9573E` used sparingly; white `#FFFFFF`; semantic error/success/warning set contrast-tested. Avoid black/gold luxury shorthand and gradients as decoration.
- **Typography:** display/editorial serif with distinct shape (candidate pairing subject to licensed font availability) + highly legible sans for UI. Evaluate language coverage, Kannada glyph support if Kannada content ships, variable font loading and licence. Define Display XL 64/68 desktop, 48/52 tablet, 38/42 mobile; H1 52/58, 42/48, 34/39; H2 40/46, 34/40, 28/34; H3 28/34, 25/31, 22/28; body 18/28 large and 16/24 standard; small 14/21; labels 12/16. Use fluid clamp only after line-wrap tests. Avoid all-caps long body text.
- **Grid:** 12 columns desktop, 8 tablet, 4 mobile; 24px desktop gutters, 20px tablet, 16px mobile; max content width 1280px; reading measure 65–75 characters; edge padding 64/40/20px responsive. Editorial section rhythm 96/72/48px vertical.
- **Spacing:** base 4px; token ladder 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128.
- **Shape/elevation:** 0–4px control radius, 8px media/content radius when justified, large image edges mostly square; 1px rule; shadows reserved for overlays; no universal pill cards.
- **Controls:** minimum target 44×44 CSS px; input 48–56px height; buttons primary/quiet/text; visible focus ring at least 2px with offset and adequate contrast.
- **Breakpoints:** 360, 480, 768, 1024, 1280, 1440 CSS px as test anchors, not layout assumptions. Reflow based on content.
- **Motion:** 120–180ms small state, 220–320ms panel/route; standard ease-out; no scroll-jacking/parallax mandatory; reduced motion disables nonessential transforms. Animate opacity/transform only where safe; preserve focus and state.
- **Z layers:** base 0, sticky 10, drawer 30, modal 50, toast 60; document any new layer.
- **Icons:** consistent 20/24px line set; labels with icons where ambiguity exists; never use emoji for primary interface icons.

### Component inventory

`CMP-01 BrandLockup` variants and accessible name; `CMP-02 Header/Nav` desktop/mobile/focus; `CMP-03 Footer` curated route groups; `CMP-04 IntentSelector`; `CMP-05 LocalityLink/AreaFeature`; `CMP-06 EditorialHero`; `CMP-07 ProcessSteps`; `CMP-08 ContactBand/PhoneLink`; `CMP-09 CTAButton`; `CMP-10 FormStepper`; `CMP-11 Text/Phone/EmailInput`; `CMP-12 BudgetRange`; `CMP-13 LocalityCombobox`; `CMP-14 ConsentNotice`; `CMP-15 ErrorSummary/InlineError`; `CMP-16 SuccessConfirmation`; `CMP-17 Breadcrumb`; `CMP-18 Source/LastReviewed`; `CMP-19 ImageFigure/Credit`; `CMP-20 Accordion`; `CMP-21 MobileStickyAction`; `CMP-22 Toast/Status`; `CMP-23 SEO metadata composer`; `CMP-24 Privacy preference interface`. For each: props/data contract, states, responsive behavior, semantic markup, keyboard model, loading/error/empty state, motion/reduced-motion, analytics event, acceptance tests and dependencies documented before engineering.

### Motion and 3D

V1 uses only purposeful state transitions and subtle image reveals. No 3D is required to express the service. Any future 3D proposal must state user purpose, source/rights, file/texture/poly budget, GPU/mobile impact, loading, no-WebGL fallback, keyboard/AT access, reduced motion, SEO fallback, ownership and maintenance. A static illustrated locality/corridor visual is preferable to a decorative skyline model unless research demonstrates a discovery benefit.

## 11. Image and media system

Art direction: commission local architectural photography or purchase traceably licensed assets. Favor place-specific street/architecture, layered streetscapes, lived-in details, natural light, true color, human scale and diverse Bengaluru contexts. Avoid generic family key visuals, AI property images, fake skyline composites, identifiable people without releases, and images implying an actual property is for sale.

Asset ledger fields: asset ID; original filename; source URL/provider; creator; licence ID/version; commercial use; adaptation/crop permission; attribution; model/property releases; acquisition date; file hash; page placements; alt/caption; variants; expiry/renewal; owner; approval state. Never fetch random Google Images. Keep license files and source records with assets.

Performance plan: AVIF and WebP with JPEG fallback where needed; responsive `srcset`/`sizes`; set width/height; hero preload/fetchpriority only for actual LCP asset; below-fold lazy loading; no lazy-load LCP; CDN only after selection; blur-up placeholder only if cheap; compress and art-direct mobile. Initial budgets: hero ≤350 KB mobile / ≤600 KB desktop; other image ≤200 KB delivered where feasible; total initial image payload ≤900 KB mobile; total transfer ≤1.5 MB on key landing route before third-party scripts. Measure actual LCP distribution and adjust.

## 12. Technical architecture (planning recommendations)

### Architecture principles

Server-rendered HTML and static/pre-rendered content for crawlability and resilience; small client-side interaction islands for forms/navigation; content as version-controlled structured data or a simple CMS; form submission via server endpoint with validation, rate limiting, idempotency and secure CRM handoff; no browser-side CRM credentials. Use a modular monolith until validated traffic/team needs justify service separation. Select the exact framework only after the first architecture decision record and maintainability review.

### Stack options to compare (not selected)

- Web rendering: Next.js / Astro / Remix or another maintained SSR framework. Compare server rendering, route metadata, form handling, hosting portability, accessibility/tooling, team experience and operational burden.
- Content: Git-backed content for small reviewed locality set vs headless CMS when editorial workflow, preview and roles justify it. Do not install yet.
- Data/lead system: existing CRM (if owner has one and DPA/security/fit pass) vs managed relational database with minimal admin. Avoid building an admin platform before workflow is known.
- Hosting: choose based on India latency, data processing terms, logs, backups, uptime, portability, deployment review, regional availability and cost at current quote; no provider selected.
- Analytics: consent-aware first-party or privacy-reviewed vendor; server-side conversion events only after legal basis and minimization review.

### Conceptual services and APIs

- `POST /api/leads/buyer` and `/api/leads/renter`: validate, normalize, consent snapshot, dedupe/idempotency, spam scoring, durable write/CRM enqueue, generic response.
- `POST /api/leads/owner`: sell/rent-owner variant, same controls.
- `GET /api/localities?query=` only if an accessible locality autocomplete needs search; source from reviewed published set.
- `POST /api/privacy/request`: privacy request receipt routed to accountable privacy contact, only after workflow exists.
- No public listing/search API in V1. All endpoints require schema validation, length limits, rate limiting, origin/CSRF approach, safe errors, PII-safe logs, monitoring, abuse controls and security testing.

### Data entities

`Lead`, `LeadContact`, `LeadRequirement`, `LeadProperty`, `ConsentRecord`, `LeadStatusEvent`, `ContactAttempt`, `User/Agent`, `Locality`, `Place/Transit`, `SourceClaim`, `MediaAsset`, `PageContent`, `AuditEvent`, `RetentionRule`. Separate lead PII and public content store. Data dictionary for each: name/type/required/validation/source/privacy class/retention/relationship/index/future purpose. Encrypt sensitive fields as appropriate, minimize free text, avoid sensitive data, and avoid exact addresses in analytical stores.

### Admin / CRM

V1 can use a secure vendor CRM or existing business workflow only if reviewed. Required operations: queued lead view, assignment, allowed status changes, contact attempt log, duplicate resolution, call-back preference, no-match/disposition reason, do-not-contact, export audit, deletion/retention controls. Role types: owner/admin, lead handler, content editor, analyst (aggregate only). Admin requires MFA and least privilege. No shared accounts. Daily queue ownership and escalation must have named human owner before launch.

### Environments and delivery

Local → preview/staging → production; secrets distinct; production data absent from test fixtures; no fake listings even in demo. Branch/review/deploy/rollback workflow, database migration review, backup restoration rehearsal, error monitoring, uptime checks, security headers, dependency updates and incident ownership documented. Set production only after domain/DNS ownership and support process are verified.

## 13. Security, privacy and legal research

Legal review is mandatory before launch. This plan is not legal advice.

- India’s Digital Personal Data Protection Act 2023 and DPDP Rules 2025 are relevant research anchors; MeitY publishes the Act, Rules, explanatory note and an enforcement timeline. Applicability, phased commencement dates, notice/consent requirements, rights, processor terms, retention/deletion, children’s data exclusions and grievance process must be mapped by Indian privacy counsel at implementation time. Do not treat the rule publication date as meaning every requirement commenced at once. Source: [DPDP Act 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf), [DPDP Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa), [MeitY explanatory note](https://www.meity.gov.in/writereaddata/files/Explanatory-Note-DPDP-Rules-2025.pdf).
- The Real Estate (Regulation and Development) Act, 2016 includes real-estate agent provisions; determine whether and how INSTLE REAL ESTATE’s business activities trigger registration/disclosure duties, and confirm Karnataka RERA rules/registration before describing the brokerage publicly. Source: [India Code RERA Act](https://www.indiacode.nic.in/indiacode/bitstream/123456789/2158/1/A201616.pdf). No registration status is asserted.
- Counsel should review entity/trade name, brokerage representation, consumer-protection claims, terms, privacy, consent, electronic communication, retention, intermediary/vendor role, cookies/analytics, call recording (not planned), property claims and all fees/commission disclosures.
- Threat model: spam, enumeration, CSRF, injection, credential compromise, CRM exports, vendor breach, malicious uploads (none in V1), analytics leakage, session fixation, scraping, availability abuse, insider access. Controls: server validation, output encoding, rate limits, MFA, RBAC, TLS, secret rotation, dependency scanning, CSP/security headers, audit logs, tested backup/restore, incident response and vendor review.
- Data retention schedule: define purpose-based periods and deletion trigger; no indefinite lead retention. Log access and deletion; test restoration without resurrecting deleted data beyond lawful basis. Identify privacy contact and complaint process.
- Consent: separate service request processing notice from optional marketing opt-in; log notice version/time/channel; no prechecked optional boxes. Counsel to determine correct lawful basis and language.

## 14. Accessibility, performance and reliability

### Accessibility

Target WCAG 2.2 AA for new interface. W3C recommends using WCAG 2.2 for current work; audit semantic headings/landmarks, keyboard order, visible focus, contrast, zoom/reflow, target size, labels/errors, status announcements, autocomplete, reduced motion, accessible dialogs, image alternatives, language attributes and screen reader behavior. Source: [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). Test with automated checks plus keyboard, VoiceOver and NVDA/manual review; automated scores alone do not establish conformance.

### Core performance budgets

At the 75th percentile of real-user mobile visits, target Core Web Vitals “good”: LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1. Track separately mobile and desktop. Source: [web.dev Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds). Additional initial goals: HTML TTFB p75 ≤800 ms, JS transferred on homepage ≤170 KB compressed (not including analytics until chosen), CSS ≤70 KB, no autoplay video, no blocking third-party script, font payload ≤120 KB initial, hero image within budget above. Measure, don’t claim success before production field data.

Failure fallbacks: phone opens native dialer; form has retry/call fallback; image failure maintains readable content; map outage falls back to locality list; analytics outage never blocks actions; CMS outage serves last approved build; CRM queue failure retries durably and alerts owner; 3D has no-JS/static fallback (if later adopted).

## 15. Analytics and conversion optimization

Event catalog: `page_view`, `intent_select`, `area_open`, `form_start`, `form_step_complete`, `form_validation_error` (field identifier only), `form_submit_attempt`, `form_submit_success`, `form_submit_failure` (safe category), `phone_click`, `whatsapp_click` (only after approval), `privacy_preferences_update`, and consent state. Parameters limited to route/page, intent category, property category, locality slug where non-sensitive, placement, device class, status category, experiment ID and pseudonymous session where authorized. No names, phone/email, free text, exact budgets if deemed sensitive, precise coordinates, or lead IDs in general analytics.

Conversion optimization sequence: establish 4-week baseline; investigate form drop-off and call CTA visibility; conduct usability sessions; change one testable hypothesis at a time; avoid dark patterns/false urgency; review lead quality with operations, not just click volume; keep experiment assignment privacy-compliant; record decision and rollback. A/B testing only when traffic and consent regime support meaningful, privacy-safe analysis.

## 16. QA and acceptance architecture

### Cross-cutting quality gates

- Functional: each route, intent transition, form validation/state, phone link, confirmation, privacy controls, navigation, no dead CTA.
- UX/UI: hierarchy, copy clarity, contrast, focus, mobile reflow, no fake content, brand exactness, clear service limits.
- Accessibility: automated scan, keyboard-only flow, VoiceOver/NVDA, zoom/reflow, reduced motion, focus/error/status announcements, touch target review.
- Performance: Lighthouse lab budget as regression signal; real-user CWV; slow CPU/network, image failures, cache/cold load.
- SEO: rendered HTML, titles/descriptions/canonical, robots/noindex gates, sitemap, structured data accuracy, broken links, duplicate/cannibalization, image alt/OG.
- Security/privacy: endpoint abuse, rate limits, injection, CSRF, PII logs, role permission, consent versioning, deletion, vendor and secrets checks.
- Browsers/devices: Chrome/Safari/Firefox/Edge; iPhone/Android/iPad/Mac/Windows/large screen; keyboard, touch, high DPI.
- Failure: offline, intermittent connection, timeout, 4xx/5xx, duplicate submit, CRM/API unavailable, analytics blocked, invalid localities, deleted content, stale source, no match.
- Content/media: all numbers verified, 9353096264 consistent, domain remains TO BE CONFIRMED until supplied, no prohibited names, asset rights complete, citation/freshness traceable.

### Form scenario register (sample atomic cases)

`QA-F-001` empty submit → required labels/errors announced; no request sent. `QA-F-002` invalid phone → actionable inline correction. `QA-F-003` valid Indian number variants → normalised safely; preserve display when useful. `QA-F-004` invalid optional email → correction without losing values. `QA-F-005` long Unicode text → length limit, no layout overflow. `QA-F-006` script/SQL-like input → safely encoded/rejected; no execution. `QA-F-007` double tap/retry → one lead via idempotency. `QA-F-008` slow response → pending state and no duplicate. `QA-F-009` timeout → honest failure/retry, no false success. `QA-F-010` offline → local state maintained per policy and recovery explained. `QA-F-011` browser back → state preserved and labels/step correct. `QA-F-012` mobile autofill/keyboard → fields and submit remain usable. `QA-F-013` consent unchecked → service request behavior matches counsel-approved policy; optional marketing remains optional. `QA-F-014` screen-reader error recovery → focus/status announced. `QA-F-015` spam throttle → accessible, neutral message and fallback contact.

### Definition of done

Task: acceptance evidence attached, code/content reviewed, tests for changed behavior, docs updated. Component: state/responsive/keyboard/AT contracts satisfied. Page: brand/content/source/image/SEO/performance/accessibility approved. Feature: end-to-end success/failure/operations/privacy/security states tested. Milestone: exit criteria and risks accepted by named owners. Release: verified legal/business identity, operational queue and contact, DNS/security, privacy and terms, source/assets, restore and incident plan, analytics data-minimisation, no critical/high defects, monitoring owner and rollback rehearsed.

## 17. Competitor and reference research plan

No competitor-specific design conclusions are asserted from the limited preliminary searches. Before visual sign-off, create a dated insight matrix covering:

| Category | Examples to select and verify | Inspect | Transferable question |
|---|---|---|---|
| Indian listing portals | NoBroker, 99acres, Magicbricks, Housing.com (live URLs and current flows to verify) | search/listing density, lead gating, mobile, trust, SEO, speed | What user work does a portal force, and how can advisory reduce that effort? |
| Bengaluru brokerage/advisory | 4–6 locally operated brokerage/advisory firms found by current search | service promise, local expertise evidence, call capture, owner flow | What creates real trust without copying claims/design? |
| Premium real estate | Indian and global advisory brands selected for editorial craft | imagery, typography, process, property facts, forms | Which design principles read premium without gold/black clichés? |
| Architecture/hospitality | 3 architecture studios, 2 hospitality experiences | image art direction, whitespace, pacing, responsive behavior | How can city and architecture carry the brand story? |
| Product references | Apple, Linear, Stripe, Vercel, Airbnb as interaction references only | hierarchy, states, motion restraint, accessibility | What principle is transferable without cloning? |

For each reference capture URL, visit date, page, desktop/mobile screenshots (where rights allow internal research), navigation, hero, lead interaction, trust evidence, locality discovery, typography, image, motion, footer, SEO, accessibility/performance observations, weaknesses and opportunity. Do not reproduce copy, proprietary illustrations, or layouts. Recheck current live pages at design kickoff because products change.

## 18. Master task register and dependency graph

Task rows use: ID · phase/subsystem · action/output · dependencies · owner · priority/complexity · acceptance/validation. Priority: P0 blocker, P1 V1, P2 post-launch. Complexity: S/M/L. Owner role, not person, until assigned. Tasks are implementation-planning actions, not authorization to build now.

| ID | Phase / subsystem | Action and output | Depends on | Owner | P/C | Acceptance and validation |
|---|---|---|---|---|---|---|
| T-001 | M0 Brand | Confirm legal entity and trading-name relation | Owner records | Business + counsel | P0/M | Evidence saved; no unverified public assertion |
| T-002 | M0 Brand | Run trademark/collision clearance for INSTLE variants | T-001 | Counsel | P0/L | Written disposition across relevant classes/searches |
| T-003 | M0 Brand | Confirm domain candidates and select canonical domain | T-002 | Owner + IT | P0/S | Registrar ownership and DNS access documented; domain remains TO BE CONFIRMED until then |
| T-004 | M0 Brand | Check social handles and reserve approved names | T-002 | Marketing | P1/M | Platform evidence and ownership record |
| T-005 | M0 Business | Verify primary phone and preferred international/tel format | Owner | Operations | P0/S | Test call; same number across contact inventory |
| T-006 | M0 Business | Confirm WhatsApp availability, owner, and approved message | Owner | Operations + privacy | P1/S | Separate verified number and privacy-approved CTA |
| T-007 | M0 Research | Interview user segments and record jobs/objections | Recruitment | Product | P1/L | Findings and changed hypotheses documented |
| T-008 | M0 Research | Validate service territories and supported asset classes | Operations | Product + broker | P0/M | Signed coverage matrix and excluded areas |
| T-009 | M0 Operations | Map lead receipt, queue owner, assignment and escalation | T-008 | Operations | P0/M | Named owners and tested response workflow |
| T-010 | M0 Legal | Determine Karnataka RERA/agent registration obligations | Entity/service model | Counsel | P0/L | Written counsel decision and any proof/next step |
| T-011 | M0 Privacy | Map DPDP applicability/commencement and notice requirements | Entity, data flow | Privacy counsel | P0/L | Dated legal review and approved notice requirements |
| T-012 | M1 Product | Approve V1 goal/non-goal scope | T-007–011 | Product owner | P0/M | Signed scope and prioritized backlog |
| T-013 | M1 Product | Define fees/commission/conflict and service boundary | T-008, T-010 | Business + counsel | P0/L | Approved disclosures and scripts |
| T-014 | M1 UX | Validate buyer/renter field minimum in usability sessions | T-007 | UX research | P1/M | Completion and comprehension findings |
| T-015 | M1 UX | Validate owner form and authorization wording | T-007, T-013 | UX + counsel | P1/M | Tested flow and approved copy |
| T-016 | M1 Funnel | Define operational qualification/disposition rubric | T-009 | Operations | P1/M | Fields and states usable by lead handlers |
| T-017 | M2 IA | Approve sitemap and nav with route owners | T-012 | IA/SEO | P1/M | Page inventory, intended user, indexing gate |
| T-018 | M2 Geography | Build source-backed locality seed and alias registry | T-008 | Local researcher | P1/L | Source and review date per record; coverage owner |
| T-019 | M2 Content | Approve locality publication threshold/template | T-018 | Content + SEO | P1/M | Quality gate blocks thin pages |
| T-020 | M2 Content | Create claim ledger and anti-fabrication workflow | T-001, T-008 | Editorial + counsel | P0/M | All public claims status-tagged and reviewed |
| T-021 | M2 Brand | Complete brand collision, pronunciation and verbal identity | T-002 | Brand + counsel | P0/M | Brand validation checklist signed/risks assigned |
| T-022 | M2 Design | Create brand identity and wordmark exploration | T-021 | Creative director | P1/L | Distinctive variants, collision review, rationale |
| T-023 | M2 Design | Validate font licenses, scripts and Kannada coverage | T-022 | Design + legal | P1/M | License record and glyph proof |
| T-024 | M2 Design | Create token and responsive type prototypes | T-023 | Design systems | P1/M | Contrast/readability at breakpoints |
| T-025 | M2 Design | Produce homepage concepts A/B/C and red-team critique | T-012, T-021 | Product design | P1/L | Trade-offs, mobile, slow device and fallback reviewed |
| T-026 | M2 Research | Complete competitor/reference insight matrix | T-025 | Research + design | P1/M | Dated observations, no copied assets/copy |
| T-027 | M2 Media | Define original/licensed image budget and shot list | T-025 | Art director | P1/M | Shot list tied to routes and rights requirements |
| T-028 | M2 Media | Establish asset register and release/rights workflow | T-027 | Legal + content ops | P1/M | No asset publishable without licence evidence |
| T-029 | M3 Architecture | Compare SSR frameworks and record ADR | T-012, team skills | Architect | P0/M | Criteria, decision, alternatives and consequences |
| T-030 | M3 Architecture | Select content/CMS model and preview workflow | T-018, T-019 | Architect + editor | P1/M | Editors can draft/review/publish without bypassing gates |
| T-031 | M3 Architecture | Select CRM/backend path after vendor/privacy review | T-009, T-011 | Architect + operations | P0/L | Data processing, role, retention and failure behavior approved |
| T-032 | M3 Architecture | Design lead schema and retention/data dictionary | T-011, T-016 | Data architect | P0/M | Required/optional/privacy/validation/retention defined |
| T-033 | M3 Architecture | Define API validation, abuse and idempotency contracts | T-032 | Backend/security | P1/M | Schema, errors, rate limits, logs and abuse tests specified |
| T-034 | M3 Privacy | Approve privacy/terms/cookie notices and request flow | T-011, T-031 | Counsel + privacy owner | P0/L | Approved notices match actual processing/vendors |
| T-035 | M3 Security | Threat model, roles and incident/restore plan | T-031–034 | Security | P1/L | Risks, mitigations, owners and tabletop evidence |
| T-036 | M3 Analytics | Approve event map, consent and no-PII contract | T-011, T-016 | Analytics + privacy | P1/M | Payload inspection shows no prohibited fields |
| T-037 | M4 Content | Draft homepage and service copy from approved facts | T-020–021, T-025 | Content | P1/M | Owner/legal/editor review and brand scan |
| T-038 | M4 Content | Author first qualified locality pages | T-018–020, T-019 | Local editor | P1/L | Claim, image, unique-value and SEO gates passed |
| T-039 | M4 Media | Commission/cull, license, caption and optimize assets | T-027–028 | Art director | P1/L | Rights ledger complete; payload within budget |
| T-040 | M4 SEO | Create page metadata/structured data matrix | T-003, T-017, T-020 | SEO | P1/M | Canonical domain set; schema facts sourced |
| T-041 | M5 UX | Prototype responsive navigation and phone-first header | T-021, T-025 | UX/UI | P1/M | Keyboard/touch/focus tested at width extremes |
| T-042 | M5 UX | Prototype buyer/renter form states | T-014, T-034 | UX/UI | P1/M | Success/error/offline/accessibility reviewed |
| T-043 | M5 UX | Prototype owner form states | T-015, T-034 | UX/UI | P1/M | No false valuation/verification promise |
| T-044 | M5 UX | Prototype locality browse and page template | T-018–019 | UX/UI | P1/M | Useful without map/listings; source disclosure works |
| T-045 | M5 UX | Prototype confirmation and failure recovery | T-009, T-016 | UX | P1/S | Human follow-up expectation matches operations |
| T-046 | M6 Engineering | Implement route shell, metadata, nav/footer | T-029, T-037, T-041 | Frontend | P1/L | SSR, semantics, responsive and brand scan |
| T-047 | M6 Engineering | Implement home/service/about/contact pages | T-037, T-039, T-046 | Frontend | P1/L | Page acceptance and no fabricated proof |
| T-048 | M7 Engineering | Implement validated lead endpoints/CRM handoff | T-031–035, T-042–043 | Backend | P0/L | Success, duplicate, throttle, timeout and audit tests |
| T-049 | M7 Engineering | Connect forms and accessible statuses | T-042–043, T-048 | Frontend | P1/L | End-to-end tests incl. failure and no PII URL/log |
| T-050 | M7 Operations | Configure queue ownership/statuses/escalation | T-009, T-016, T-031 | CRM admin | P0/M | Simulated lead reaches owner and is dispositioned |
| T-051 | M8 Content | Publish only approved areas and internal links | T-038, T-040, T-044 | Content + SEO | P1/M | Sitemap contains only indexable approved pages |
| T-052 | M9 Analytics | Add consent-aware events and validate payloads | T-036, T-046, T-049 | Analytics engineer | P1/M | Network capture confirms event contract |
| T-053 | M10 Quality | Execute accessibility/browser/device matrix | T-046–052 | QA + accessibility | P1/L | No critical blocker; evidence attached |
| T-054 | M10 Quality | Run CWV, image and third-party budgets | T-039, T-046–052 | Performance | P1/M | Budget met in lab; field monitoring configured |
| T-055 | M10 Quality | Run security/privacy release review | T-034–035, T-048–052 | Security + counsel | P0/L | No unresolved critical/high release risk |
| T-056 | M10 SEO | Validate crawl/index/canonical/schema/sitemap | T-003, T-040, T-051 | SEO | P1/M | Tool reports and spot checks saved |
| T-057 | M11 Launch | Verify number, domain, contacts, queue and fallback | T-003, T-005, T-050 | Release owner | P0/M | All contact paths and live lead receipt proven |
| T-058 | M11 Launch | Rehearse rollback, restore, incident contact | T-035, production setup | Ops/DevOps | P0/M | Timed tabletop and recovery evidence |
| T-059 | M11 Launch | Publish approved site and monitor launch | T-053–058 | Release owner | P0/M | Smoke checks pass; owner watches errors/leads |
| T-060 | M12 Growth | Review lead quality, service capacity, locality value | Baseline period | Product + operations | P2/M | Evidence-led backlog; no vanity metric only |

### Dependencies and critical path

`T-001 → T-002 → T-021 → T-022`; `T-001/T-003 → T-040/T-046/T-056`; `T-005 → T-047/T-057`; `T-008 → T-009/T-018`; `T-009/T-011/T-013 → T-031/T-032/T-034`; `T-011 → T-034/T-035/T-036`; `T-012 → T-017/T-025/T-029`; `T-018 → T-019/T-038/T-044 → T-051`; `T-031–036 + T-042–043 → T-048–050`; `T-046–052 → T-053–056 → T-057–059`.

Critical path: legal/business identity and service coverage → operational lead handling and privacy/data design → brand/content decisions → technical/CRM choice → accessible forms + durable handoff → content/SEO quality → release QA/security/legal gates → launch. Brand identity can proceed in parallel with interviews and coverage research; no brand validation result may be represented as legal clearance.

### Milestones and exit criteria

- **M0 Discovery & clearance:** validate entity/name/domain/contact/coverage/legal obligations; interviews and research sources logged. Exit: blockers have owners and no unsupported claim is being planned as fact.
- **M1 Product definition:** goals, scope, personas, journeys, field model, operations, fee boundaries approved. Exit: no ambiguous user/lead handling step.
- **M2 Brand/IA/design/content:** canonical brand system, competitor matrix, homepage decision, locality template, image workflow, route and content strategy. Exit: brand checklist disposition and usable prototypes approved.
- **M3 Technical/privacy architecture:** ADRs, CRM/data, API, security, privacy, analytics and retention decisions. Exit: threat/data flow and operating owners signed off.
- **M4 Content/media readiness:** factual copy, sourced locality records and licensed assets. Exit: no placeholder company/domain/proof claims; each indexable page passes quality gate.
- **M5–M9 build increments:** shell/pages; forms; backend/CRM; areas/SEO; analytics. Exit each feature passes task and component DoD.
- **M10 quality:** accessibility, security/privacy, SEO, performance, browser/device/network. Exit no critical/high release blocker.
- **M11 launch readiness:** DNS, phone, lead queue, restore/rollback, support and monitoring verified. Exit release owner explicitly approves launch.
- **M12 evidence-led growth:** review conversion quality and service capacity; only then consider inventory/map/AI.

## 19. Risk register

| ID | Risk (probability/impact) | Detection | Mitigation / contingency | Owner |
|---|---|---|---|---|
| R-01 | INSTLE name collision or rights conflict (M/H) | trademark, registry, web/social search | legal clearance before spend; preserve exact public canonical while owner resolves rights | Counsel |
| R-02 | Legal entity or brokerage authority unclear (M/H) | document review | verify entity/agent obligations and disclosures; delay public claims | Owner/counsel |
| R-03 | No staffed lead response (M/H) | queue simulation/time-to-contact | named queue owner, private capacity-based SLA, pause form if unstaffed | Operations |
| R-04 | Thin locality SEO pages (H/M) | editorial audit/index quality | publication gate, limited geography, noindex/remove weak pages | Content/SEO |
| R-05 | False property availability/price inference (M/H) | copy and visual review | no fake listing UI; precise service boundary; remove misleading media | Product |
| R-06 | PII leakage to analytics/logs/vendor (M/H) | payload inspection/access audit | minimization, separate systems, DPA/security review, redaction and deletion | Privacy/security |
| R-07 | Low lead quality or spam (M/M) | disposition/reason analytics | simple qualifiers, rate limit, human review, accessible anti-spam fallback | Product/ops |
| R-08 | Overlong form abandonment (M/M) | step conversion/usability | progressive disclosure, test required fields, allow call route | UX |
| R-09 | Unlicensed image or identifiable person (M/H) | asset-ledger audit | rights workflow/releases, commissioned assets, remove disputed image | Creative/legal |
| R-10 | Image/video makes site slow (M/M) | CWV/network tests | budget variants, no autoplay, static fallback, monitor field data | Engineering |
| R-11 | CRM/vendor outage loses enquiries (L/H) | synthetic submissions/queue alert | durable retry, alert/fallback queue, reconciliation, export/portability plan | Engineering/ops |
| R-12 | Domain/social identity unresolved (M/M) | owner gate | keep domain TO BE CONFIRMED; no mock final metadata/QR/print | Owner |
| R-13 | Current urban boundaries misrepresented (M/M) | source/date audit | separate marketing/admin taxonomy, version boundary sources | Local researcher |
| R-14 | Unsubstantiated area/market advice harms trust (M/H) | claim ledger review | cite dated primary source, language limitations, counsel where material | Editorial |
| R-15 | RERA/consumer/privacy compliance changes (M/H) | legal monitoring | counsel review before launch and scheduled refresh | Counsel |
| R-16 | 3D/map vendor increases complexity/cost (M/M) | performance/cost review | exclude from V1 absent validated purpose; static fallback | Product/engineering |
| R-17 | Fake or self-serving testimonial/schema exposure (L/H) | content/schema review | only genuine permissioned proof; no self-serving review rich-result claim | Marketing/SEO |
| R-18 | Service scope exceeds staff capacity (M/H) | lead backlog and response time | cap supported intents/geographies, revise entry points, communicate limitations | Business |

## 20. Assumptions and open decision register

### Assumptions

| ID | Assumption | Why needed / risk | How to verify | Owner/status |
|---|---|---|---|---|
| A-01 | Website is lead-generation and advisory first, not inventory | Brief states service-led model; risk: later business expects portal | Owner confirms scope | Product / confirmed for planning |
| A-02 | 9353096264 is intended primary business phone | Supplied in source directive; risk: inactive/wrong ownership | Test and owner confirmation | Operations / pending |
| A-03 | Public brand must be exactly INSTLE REAL ESTATE | Direct non-negotiable instruction | Automated copy/metadata scan and approval | Brand / fixed |
| A-04 | Domain is not supplied | Avoid inventing identity | Owner supplies and registers | Owner / open |
| A-05 | No WhatsApp number has been confirmed | Avoid false CTA | Separate owner verification | Owner / open |
| A-06 | Brokerage coverage/service classes are not confirmed | Needed for routes and area promises | Operations matrix | Business / open |
| A-07 | No approved proof points supplied | Prevent fabricated credibility | Collect evidence and permission | Business / open |
| A-08 | Human follow-up is intended | Core promise but operational ownership unknown | Lead-routing rehearsal | Operations / open |
| A-09 | English is initial content language | No language requirements supplied | Confirm audience and staffing | Product / open |
| A-10 | Phone is not a WhatsApp number by default | Separate channel/consent | Explicit confirmation | Privacy / fixed |

### Open decisions

| ID | Question | Recommendation | Blocking? | Status |
|---|---|---|---|---|
| D-01 | What is the legal entity/trading-name relationship? | Verify before public About/terms/structured data | Yes | Open |
| D-02 | Is INSTLE clear to use as a mark and business name? | Formal counsel collision/trademark search | Yes | Open |
| D-03 | What domain is owned and canonical? | Owner supplies; record only after verification | Yes | **DOMAIN: TO BE CONFIRMED** |
| D-04 | Is phone 9353096264 active, business-controlled, and call staffed? | Test before using; define display format | Yes | Open |
| D-05 | Is a separate WhatsApp number/account authorized? | Do not show WhatsApp until confirmed | No for call-first V1 | Open |
| D-06 | What Bengaluru geographies and asset classes can team serve? | Approved matrix based on actual operations | Yes | Open |
| D-07 | Which fees/commission/representation apply? | Counsel-approved disclosure/script | Yes | Open |
| D-08 | What response time can the team actually meet? | Set internal target from capacity, no public claim yet | Yes for form launch | Open |
| D-09 | Existing CRM/lead inbox and responsible owners? | Review existing system before selecting vendor/build | Yes | Open |
| D-10 | CMS vs Git-backed editorial content? | Begin with simplest reviewable model; decide after editor workflow | No | Open |
| D-11 | Which hosting/region/vendors and DPAs? | Compare current offers and data flows before selection | Yes | Open |
| D-12 | Which analytics and consent approach? | Privacy-led minimal event set | Yes | Open |
| D-13 | How are source languages/local Kannada names managed? | Set language and review owner before area data | No | Open |
| D-14 | Do commercial real estate pages belong in V1? | Include only if staff and process are ready | No | Open |
| D-15 | Are area maps licensed/necessary? | Start with editorial locality navigation; map only if useful and rights clear | No | Open |
| D-16 | Public office address/hours? | Show only a verified customer-facing location/hours | Yes if displayed/schema-marked | Open |
| D-17 | Contact privacy/grievance owner? | Name and verify route before collecting PII | Yes | Open |
| D-18 | Logo/font candidates and language coverage? | Commission after collision research and font rights check | No | Open |

## 21. Requirements traceability and master relationships

| Requirement | Journey/page | Component/data/API | Analytics | QA / acceptance |
|---|---|---|---|---|
| Canonical brand exact | All pages/docs/metadata | BrandLockup, global constants, schema | brand taxonomy version only | prohibited-name and capitalization scan; owner review |
| Human-led enquiry | Home/buy/rent/sell/contact | Forms, Lead, lead APIs, CRM states | form and contact events | end-to-end queue simulation; human owner assigned |
| Phone-first access | Header/footer/hero/areas/mobile | PhoneLink, 9353096264 constant | `phone_click` no PII | tel link opens correct number on iOS/Android/desktop |
| No fabricated inventory | Home/area/service | Editorial components; no listing entity in V1 | no listing impression event | content/UI audit, no fake prices/availability |
| Useful local discovery | Areas/index/locality | Locality + Claim + Asset records | area open, CTA | source/date/uniqueness/image gate; crawl test |
| Privacy-respecting lead capture | Buyer/owner forms | ConsentRecord, lead API, retention | consent-safe aggregated events | consent, deletion, no PII payload/log audit |
| Accessible responsive flow | All pages/forms | semantic components and states | no accessibility tracking needed | WCAG 2.2 AA manual+automated suite |
| Performance resilience | Home/areas/forms | responsive media, SSR/static fallback | CWV field metrics | p75 CWV and transfer budgets; failure tests |
| SEO integrity | Indexable routes | metadata, canonical, sitemap/schema | Search Console | page matrix and Rich Results/schema validation |
| Lead accountability | Confirmation/CRM | status/contact/audit event | CRM funnel aggregates | simulated assignment, SLA report, permissions |

Master chain: **business requirement → persona/journey → route/page → component → content/data → API/CRM → analytics → QA → acceptance evidence → release owner**. Every future task ID must reference its upstream requirement and downstream acceptance evidence. A task is not complete because UI exists; it is complete when intended user outcome, operations, failure path, privacy, analytics and review criteria are met.

## 22. Documentation, governance and future implementation protocol

Recommended future docs (not created in the repository in this planning-only phase):

- `/docs/product.md` — vision, scope, personas, journeys, requirements, non-goals.
- `/docs/brand.md` — canonical INSTLE REAL ESTATE identity, validated assets, voice, collision gate.
- `/docs/architecture.md` and `/docs/decisions/ADR-*.md` — selected stack, boundaries, alternatives and consequences.
- `/docs/design-system.md` — tokens, type, component interaction/responsive/accessibility contracts.
- `/docs/content.md`, `/docs/areas.md`, `/docs/images.md` — governance, locality sources, asset/license ledger.
- `/docs/seo.md` — route matrix, canonical/index gates, schema and monitoring.
- `/docs/data.md`, `/docs/privacy.md`, `/docs/security.md` — data dictionary, consent, retention, threat model, incident plan.
- `/docs/analytics.md`, `/docs/operations.md`, `/docs/testing.md`, `/docs/roadmap.md`, `/docs/status.md`.
- `AGENTS.md` — project purpose, canonical brand, no-fabrication/no-listings rule, architecture/commands when known, accessibility/security/privacy/content/image/SEO rules, test requirements, small-batch workflow, no deployment without release approval.

Future implementation protocol: read blueprint and relevant docs → inspect repository and actual current state → confirm open blockers → select one milestone/task and its dependencies → implement smallest coherent batch → validate with specified tests (the future owner may authorize implementation/verification) → review visual, technical, privacy/security and content evidence → fix → update docs/traceability/status → mark task complete with acceptance evidence → proceed. Changes to scope/architecture require a decision record, impact assessment, dependency/task update, and owner approval; no silent substitutions.

### Change control

Any new requirement, technical constraint, legal finding, SEO issue, vendor price, performance regression or geography correction receives a change ID, source/date, impact (brand/product/data/security/content/SEO/cost/operations), dependency analysis, recommended option and owner decision. Update affected ADRs/tasks/traceability; preserve prior decisions and rationale. Recheck research-sensitive facts at implementation time.

## 23. Cost architecture

No prices are estimated because domain, vendor, traffic and service tier are unknown and prices change. Obtain dated quotes/terms for: domain/renewal; hosting/edge and egress; database/backups; CRM seats/automation; CMS/editor seats; image commissioning/licensing/CDN; maps/geocoding/tiles and attribution; email/SMS/WhatsApp; captcha/anti-abuse; analytics/consent; error monitoring/logging; security scanning; legal/trademark; accessibility review; maintenance/support. Compare annual and variable costs, vendor lock-in/export path, tax/currency, data region, per-seat limits, usage overages and cancellation. Keep low-volume V1 vendor count small.

## 24. Self-critique / red-team

**Product:** Why use us without listings? Only if the process, real human contact and supported scope are specific. Validate with interviews; if team cannot deliver follow-up, do not launch a lead promise. What if there is no match? Explain next step honestly and record no-match outcome.

**Brand/design:** Could this become a generic high-end template? Yes, if it leans on beige/serif/architecture alone. Require original Bengaluru art direction, wordmark distinctiveness, editorial local details, strong typographic composition and usability tests. Keep phone and service CTA obvious. Ensure it reads as brokerage/advisory, not architecture studio or property portal.

**Engineering:** Main risk is overbuilding CRM/map/3D before process is known. Keep modular, SSR-first and vendor decisions reversible. Ensure durable form delivery and no PII in analytics. Monitor real mobile CWV, not only polished desktop lab output.

**SEO/content:** Area-page expansion can create doorway/duplicate content; publish fewer pages with sourced specificity. No query permutations, fake FAQs or schema claims. Search features are not guaranteed.

**Customer/seller:** A visitor may assume submission guarantees immediate options, valuation, sale, or buyer demand. Copy and confirmation must define a conversation request and process; no implied promise.

**Mobile/accessibility:** Sticky call can hide fields or screen-reader controls; reserve safe-area space, allow dismissal, preserve focus, test on small viewport/zoom. Locality selection must be keyboard accessible and not map-only.

**Operations/legal:** Missing business identity, RERA status, fees, privacy contact and response owner are release blockers. A polished site without accountable humans would damage trust.

## 25. Research source log

Research checked **2026-09-26**. Sources below support planning constraints; they do not prove compliance or facts about INSTLE REAL ESTATE.

| Source/date | Claim relied on | Why it matters |
|---|---|---|
| Google Search Central, [people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content), accessed 2026-09-26 | Google recommends useful people-first content | Locality pages must serve visitors, not keyword volume |
| Google Search Central, [spam policies](https://developers.google.com/search/docs/essentials/spam-policies), accessed 2026-09-26 | Doorway abuse includes similar regional pages funneling users; scaled content abuse includes large volumes of low-value unoriginal pages | Publish gated, distinct locality content only |
| Google Search Central, [Organization structured data](https://developers.google.com/search/docs/appearance/structured-data/organization), accessed 2026-09-26 | Useful business identity fields include name, presence/contact and logo; schema must reflect real facts | Brand and entity facts must be verified before markup |
| Google Search Central, [LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business), accessed 2026-09-26 | Local business details require accurate business properties and guidelines | Do not invent address/reviews/hours or add inappropriate markup |
| Google Search Central, [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), accessed 2026-09-26 | Sitemaps can suggest preferred canonical URLs; redirects canonicalize duplicates | Keep one URL per published page and sitemap only preferred URLs |
| Google Search Central, [image best practices](https://developers.google.com/search/docs/appearance/google-images), accessed 2026-09-26 | Relevant high-quality images, descriptive names/alt, suitable OG images aid understanding | Image SEO and accessible asset metadata belong in asset workflow |
| MeitY, [DPDP Act 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf), and [Rules 2025](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa), accessed 2026-09-26 | Act and notified rules define India’s personal data protection framework; commencement is phased in the rules | Counsel must map applicable dates and obligations to actual data flows |
| India Code, [RERA Act 2016](https://www.indiacode.nic.in/indiacode/bitstream/123456789/2158/1/A201616.pdf), accessed 2026-09-26 | Act includes real-estate agent framework | Counsel must assess activity and state-level requirements; no status assumed |
| BBMP, [maps](https://www.bbmp.gov.in/maps/) and [GIS viewer](https://bbmp.gov.in/gisviewer/index.html), accessed 2026-09-26 | Public mapping interfaces exist for city/corporation geographies | Candidate authoritative geography sources; check current boundary and reuse rights |
| BDA, [master-plan page](https://eng.bdabangalore.org/masterplan.html), accessed 2026-09-26 | BDA publishes planning material | Planning areas are not interchangeable with neighbourhood taxonomy; verify currency |
| W3C, [WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/), accessed 2026-09-26 | WCAG 2.2 is the current W3C accessibility recommendation referenced here | Target WCAG 2.2 AA, with manual testing |
| web.dev, [Core Web Vitals thresholds](https://web.dev/articles/defining-core-web-vitals-thresholds), accessed 2026-09-26 | Core Web Vitals use LCP, INP and CLS thresholds for user experience | Set measurable field performance targets |
| IP India, [e-services](https://ipindia.gov.in/pages/e-services) and [public trademark search](https://tmrsearch.ipindia.gov.in/ESEARCH), accessed 2026-09-26 | Official public trademark search facility exists | Trademark search is a required clearance step; this plan makes no clearance claim |

## 26. Build-readiness checklist

- [ ] Exact canonical identity approved and brand collision/legal review disposition recorded.
- [ ] Business entity, trading name, authority and public contact details verified.
- [ ] Domain registered/controlled and selected; prior status remains **TO BE CONFIRMED**.
- [ ] Phone 9353096264 tested; call coverage and escalation owner confirmed.
- [ ] WhatsApp remains absent unless separately approved and verified.
- [ ] Service territory, asset classes, fees/commission, brokerage boundaries and no-match flow approved.
- [ ] Karnataka RERA/legal applicability decision and disclosures recorded by counsel.
- [ ] DPDP/consent/data processing/retention/vendor requirements reviewed with current commencement dates.
- [ ] Lead owner, queue, operational target, CRM and durable failure handling proven in rehearsal.
- [ ] Buyer/tenant and owner forms user-tested; privacy notice approved.
- [ ] Homepage and navigation chosen with mobile/slow-device/no-JS/reduced-motion fallbacks.
- [ ] Locality records sourced, distinct and reviewed; thin routes excluded from index.
- [ ] Every image has rights evidence, creator/credit and correct crop/alt.
- [ ] Design tokens and wordmark cleared for distinctiveness, font rights and language coverage.
- [ ] SEO matrix, canonical host, schema facts, sitemap and Search Console ownership prepared.
- [ ] WCAG 2.2 AA review, browser/device/network, security/privacy, performance and form failure QA passed.
- [ ] Restore, rollback, incident contacts, monitoring and post-launch operations owner confirmed.
- [ ] Release owner signs off all high-impact open decisions and evidence.

**Planning deliverable complete.** The checklist remains open until evidence is supplied and the implementation gates are approved. This file is the project planning source of truth; it does not by itself mark any implementation work complete.
