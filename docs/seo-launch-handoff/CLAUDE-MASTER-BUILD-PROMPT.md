# INSTLE REAL ESTATE — CLAUDE MASTER BUILD AND SEO PROMPT

Prepared: 29 September 2026. Status: implementation handoff, not a completed build or launch.

Copy this entire file into Claude with the repository and the companion handoff files attached.
Work through the milestones in order. This prompt authorizes development when supplied by the owner;
it does not assert that any business evidence, domain, vendor approval, or publication approval exists.

## 01. Your assignment

You are the product designer, engineer, content architect, and SEO implementation partner for INSTLE REAL ESTATE.
Build a modern Bengaluru real estate brokerage and property advisory website from the existing repository.
Make it easy for people to understand the business, select their requirement, and call 9353096264.
Build a sustainable search presence for buyers, sellers, tenants, landlords, and business occupiers.
Prepare the site for Google Search, Maps where eligible, Bing, ChatGPT search, and other AI search tools.
Prioritize useful customer journeys, accurate business identity, dependable enquiries, and reviewed content.
Do not treat page count, keyword repetition, or an AI citation as the primary measure of business success.
The business outcome is qualified conversations that the brokerage can actually handle.

Owner request:
- Broad Bengaluru coverage, including buying, selling, renting, and renting out.
- Properties from smaller budgets to larger requirements.
- Apartments/flats, independent houses, villas, sites/plots, and commercial property.
- A separate owner and CEO page for Utpal Raj KB.
- Modern, clear UI and Indian English wording.
- Strong SEO and AI search discovery.
- A plan for 100-plus area pages, PIN-code research, and eventual domain launch.
- Costs and responsibilities before purchasing launch services.

The owner replied “everything everything” when asked about service scope.
Treat this as requested product breadth. It does not establish staffing, office details, fees,
automatic citywide fulfilment, professional certifications, property availability, or past results.
Do not ask repeatedly about routine implementation choices; continue all work independent of missing facts.
Bundle unresolved launch facts into one decision register and make the build reviewable before release.

## 02. Mandatory brand and truthfulness rules

Read AGENTS.md and the master blueprint before touching application code.
Keep the canonical brand exactly INSTLE REAL ESTATE everywhere the business name appears.
Keep the displayed business phone exactly 9353096264.
Use the exact telephone link tel:9353096264.
Do not add a country prefix or visual formatting without owner approval.
Do not assume the phone supports WhatsApp; omit WhatsApp buttons, links, logos, and chat widgets.
The domain is TO BE CONFIRMED.
Do not guess a domain or put a candidate domain into metadata, structured data, links, or XML.
No production canonical tags or production XML sitemap until the owner confirms the purchased domain.
Do not turn this project into a public property listing portal.
No property inventory cards, fake prices, availability badges, public property addresses, or property feeds.
No automated valuation engine, “instant market value,” or implied live buyer database.
No invented years in business, customer counts, sales volume, awards, press coverage, or office branches.
No invented RERA registration, qualifications, legal guarantees, clear-title guarantees, or certifications.
Do not introduce public legal/advisory disclaimers; use only supplied and approved wording.
Do not manufacture testimonials, star ratings, review counts, customer identities, or customer photographs.
Never show “1000+ customers,” “1000+ reviews,” “No. 1,” “best broker,” or “most trusted” without valid evidence.
This applies equally to visible copy, metadata, image text, FAQ answers, JSON-LD, and AI text files.
The earlier request for dummy reviews is resolved by a real-review workflow and a truthful empty state.
Synthetic review UI fixtures may exist only in clearly labelled, protected development previews.
Synthetic fixtures must never enter public HTML, static builds, structured data, exports, or the CMS publication queue.
A test fixture is not business evidence.

## 03. Business identity and approved owner facts

Business: INSTLE REAL ESTATE.
City context: Bengaluru; use Bangalore naturally as a search-language alias where helpful.
Contact: 9353096264.
Owner and CEO: Utpal Raj KB, supplied by the owner in the current brief.
Proposed owner route: /about/utpal-raj-kb.
Use “Owner and CEO, INSTLE REAL ESTATE” as the user-supplied role.
Do not infer incorporation, statutory directorship, founding date, or legal entity type from the title CEO.
Do not call him founder unless separately confirmed.
Do not invent his education, employment history, professional registration, achievements, transaction record,
team size, personal values as quotations, community roles, or affiliations.
Use an actual approved portrait when supplied; otherwise use a clean typographic profile without a fake person image.
A proposed short introduction may say: “Utpal Raj KB is the owner and CEO of INSTLE REAL ESTATE.”
Proposed contact copy: “Call 9353096264 to discuss your property requirement with the team.”
Keep additional biography sections hidden until the owner supplies and approves the facts.
Do not publish empty “Coming soon” biography sections just to fill the page.
Use Person structured data only for accurate visible facts and approved public profile links.
Link the business and the person consistently; do not invent sameAs URLs or ownership credentials.

## 04. Existing repository: inspect, preserve, and improve

Repository baseline: /Users/bharathibasavaraj/Desktop/INSTLE.
The package declares Next.js ^16.3.6, React ^19.3.0, TypeScript, CSS Modules, ESLint, and Vitest.
These are package declarations; inspect the lockfile and installed version before assuming the resolved versions.
Read the relevant installed guides in node_modules/next/dist/docs before writing framework code.
Relevant guides already found in this checkout:
- 01-app/01-getting-started/14-metadata-and-og-images.md
- 01-app/01-getting-started/15-route-handlers.md
- 01-app/03-api-reference/04-functions/generate-metadata.md
- 01-app/03-api-reference/04-functions/generate-static-params.md
- 01-app/03-api-reference/03-file-conventions/01-metadata/robots.md
- 01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md

Read the current implementation, not just old roadmap descriptions.
The root homepage uses Concept1 components as its current design baseline.
Existing public journeys include /buy, /rent, /sell, /areas, /about, /how-it-works, and /contact.
The /sell journey currently contains both sell and rent-out intents; preserve existing links while improving clarity.
The prototype routes /concept-review, /concept-1, /concept-2, and their intake pages are private design material.
Inspect their current indexing settings and keep them out of the public release/navigation.
Preserve existing accessible skip link, navigation focus handling, and canonical constants.
Keep CSS Modules and shared tokens unless a documented technical reason warrants a change.
Reuse functioning form logic and shared components after inspecting failure paths.
Do not discard the repository and generate a disconnected demo.
Do not silently change framework, hosting, contact number, or service model.
The older blueprint limits commercial scope; the latest owner request asks for broader services.
Record this requested scope change in an ADR, while confirming actual operating coverage before public claims.
The older roadmap's build and test results are historical; rerun checks after implementation.
Git inspection in this planning session was blocked by an unaccepted Xcode licence.
Do not claim the branch or working tree was verified in this handoff.
Check repository status yourself; preserve unrelated owner changes and do not accept system licences on their behalf.

## 05. Source-inspection findings to resolve

P0: src/lib/lead-operations.ts defaults to an in-memory staging adapter.
P0: src/app/api/enquiry/route.ts calls that default adapter and returns a customer success response.
Temporary process memory is not a durable production lead destination.
P0: processLeadEnquiry awaits adapter.dispatch but does not inspect its returned success flag.
An adapter returning success:false can currently still lead to a successful API response.
P0: the existing body-size check trusts Content-Length before request.json; it does not bound actual bytes read.
P0: rate limiting and idempotency are per-process Maps, which do not coordinate multiple server instances.
P0: production consent/notice, destination, access, retention, and queue ownership remain unconfirmed.
P1: locality approval currently filters status labels, not claim-by-claim evidence completeness.
P1: four records are marked published and one is draft in src/config/localities.ts.
Their citations largely point to organisation homepages, and multiple claims have no exact supporting evidence.
Three citations across different claims do not mean two independent sources support each claim.
Treat current public locality copy as requiring a fresh audit; do not reuse “approved” as proof.
Current transit status and administrative labels require dated verification against primary sources.
Do not assert they are correct or incorrect without checking current documents.
P1: telemetry filters field names but accepts arbitrary primitive values in allowed fields.
For example, an allowed sourceComponent string could carry free text without enum/value validation.
P1: telemetry currently returns a payload and logs it outside production; no production measurement destination was established.
P1: the declared phone check also accepts a broad 10–15-digit fallback; align it with supported countries and proper validation.
P1: a 90-day retention timestamp in a record does not implement deletion or establish an approved retention policy.
P1: inspect absolute claims such as “verified tenants,” “no spam,” and “never” in current service/privacy copy.
Use only substantiated, operationally accurate statements.
These are source-inspection findings, not runtime test results or a complete security audit.

## 06. Product architecture

The platform is a service-led brokerage requirement-capture site.
Every main page should answer: Who helps me? What service is offered? What should I share? What happens next?
The homepage must explain the offer within the first screen on common mobile devices.
Place an accessible direct call action in the header and a visible enquiry route near the main headline.
Use four distinct entry actions: buy, sell, rent, rent out.
Do not require an account, OTP, document upload, or payment to start an enquiry.
Support a commercial path without mixing office/shop needs into residential-only form labels.
Use a property-type selector for apartments, houses, villas, plots, and commercial requirements.
Hide unsupported service/asset combinations through the approved service matrix.
Keep “Other / discuss with the team” available where appropriate without claiming specialist expertise.
Capture the intended budget as a customer preference, not a marketed property price.
Include lower budget options and “Prefer to discuss”; do not make the site feel reserved for expensive properties.
Do not claim every budget will find a match or every property can be accepted.
Use one clear next step per section; avoid repeated competing actions that make the page harder to scan.
No fake scarcity, countdowns, “buyers waiting,” animated customer counters, or fake live-chat agents.
No AI assistant is required for launch; public AI search discovery and a chatbot are different projects.

## 07. Modern UI specification

Build a calm, contemporary website that feels accessible to Bengaluru families and professionals.
Retain a recognizable brand wordmark; improve hierarchy, spacing, responsive layouts, and action visibility.
Suggested direction: warm light background, deep green primary actions, restrained secondary accents.
Treat colour choices as design proposals; validate contrast before accepting them.
Use a legible sans-serif body font and a restrained heading treatment compatible with current design tokens.
Avoid tiny uppercase paragraphs, decorative labels with no customer meaning, and unnecessarily formal jargon.
Use readable line lengths and body text around 16–18 px on mobile as a starting design choice.
Use fluid typography and spacing rather than fixed desktop sizes squeezed onto mobile.
Use a consistent grid and bounded content width.
Use four service cards as navigation, not property cards or testimonials.
Add real, rights-cleared photography when available; record provenance, permission, and alt text.
Existing architectural images are conceptual design studies, not actual properties or neighbourhood photographs.
If retained publicly, label them clearly as conceptual illustrations without pretending to show available homes.
Do not generate a CEO portrait, office photograph, transaction image, or customer scene as proof of the business.
Avoid autoplay video, heavy parallax, large animated maps, and rotating review carousels at launch.
Respect prefers-reduced-motion.
Keep sticky mobile actions above device safe areas; reserve space so content and keyboard focus are not covered.
Desktop header: brand, simple navigation, visible phone.
Mobile header: brand, phone, menu; shorten navigation by grouping secondary pages when needed.
Mobile bottom actions: “Call 9353096264” and “Send enquiry,” with proper labels and target sizes.
Use breadcrumbs on deep content pages.
Use a single primary H1 that describes each page's purpose.
Use content-led section headings; do not repeat “trusted real estate” in every block.
Design and verify 360 px, 390 px, 768 px, 1280 px, and 1440 px layouts.
Also check 320 px reflow and enlarged text.
Show actual screenshots of core pages for review, not only a verbal description of the design.

## 08. Indian English copy direction

Prefer plain terms customers use: flat, apartment, independent house, villa, site, plot, brokerage,
sell my flat, rent out my property, locality, budget, possession, resale, and property requirement.
Use Bengaluru as the primary city name; include Bangalore naturally where relevant to common search phrasing.
Use ₹, lakh, crore, and sq ft in customer input help where appropriate.
Do not publish made-up property prices or locality price ranges.
Do not fill headings with “premium,” “elite,” “acquisition brief,” or “bespoke advisory” unless useful to that audience.
Use “Tell us what you need” instead of internal operational terminology.
Avoid “India's best,” “Bengaluru's number one,” “guaranteed returns,” and “100% legal clearance.”
Use “trust” as a design objective, supported by identity, contact access, clear process, and real evidence.
Do not use “trusted by thousands” as a substitute for evidence.
Do not invent guarantees inside FAQ answers to make copy sound stronger.
The actual response time should be stated only after it is approved and operationally supported.

Proposed homepage copy to adapt after service validation:
H1: “Buy, sell or rent property in Bengaluru.”
Supporting line: “Tell INSTLE REAL ESTATE your preferred area, property type and budget. Speak to our team about buying, selling, renting or renting out.”
Primary actions: “I want to buy”, “I want to sell”, “I want to rent”, “I want to rent out”.
Contact action: “Call 9353096264”.
Owner introduction: “Meet Utpal Raj KB, owner and CEO of INSTLE REAL ESTATE.”
Do not surround this introduction with invented credentials or customer statistics.

## 09. Homepage sections in order

1. Header, skip link, main headline, four customer intent actions, direct phone.
2. Brief explanation of brokerage help and how to share a requirement.
3. Supported property types, driven by approved service capabilities.
4. A short process: share requirement, discuss with team, coordinate suitable next steps, review progress.
5. Reviewed areas, with a browse-all link; no giant keyword wall in the footer.
6. Seller/landlord callout explaining the information required to start.
7. Utpal Raj KB introduction linked to his profile.
8. Genuine review section only when approved real reviews exist.
9. Helpful guides linked by user intent.
10. Concise contact band and footer with approved public business information.

If there are zero approved real reviews, omit the homepage review section.
Do not replace it with invented customer names, stock faces, empty stars, or a fabricated score.
Use clear process information and accountable contact access to build confidence at launch.

## 10. Buyer journey

Core route: /buy, retained for continuity.
Describe actual brokerage assistance rather than showing property inventory.
Support property type, preferred localities, budget preference, timeline, and contact information.
Keep name and phone requirements minimal; email is optional only if operationally needed and approved.
Permit budget discussion rather than forcing an exact number.
Do not assume home loan eligibility or offer financial advice.
Use conditional fields; do not ask villa questions for office requirements.
Explain that sharing a requirement starts a discussion and does not establish property availability.
Use existing approved service wording; do not add legal disclaimers without supplied text.
On success, show a reference only after durable acceptance.
On failure, retain entered information only in component memory and show a retry/call action.
No localStorage/sessionStorage persistence of PII without an approved design.

## 11. Seller journey and the 30-day request

Core route: /sell, retained for continuity.
Capture property type, locality, ownership/representative role, expected timeline, optional expectation band,
and contact details; exact address should not be required at first contact.
Avoid document uploads, identity proofs, title deeds, and financial files in V1 intake.
Allow “Within 30 days” as the customer's desired timeline.
A customer timeline preference must never become “We guarantee a sale within 30 days.”
No 30-day sale, purchase, tenant-placement, or registration guarantee is approved.
Do not put a guarantee into headings, ads, metadata, profile descriptions, or schema.

Proposed seller planning workflow, pending operational approval:
- Initial discussion: understand owner's objective, permission, readiness, and target date.
- Readiness: discuss presentation, expectations, paperwork coordination, and the proposed marketing approach.
- Outreach: use owner-approved channels and actual operating processes.
- Viewings: coordinate real interest and appointments, with owner permission.
- Progress review: report actions taken and agree next steps; reassess expectations if needed.
- Closure coordination: handle agreed brokerage tasks alongside relevant independent professionals.

This workflow is a proposed service plan, not evidence that it is currently operated.
Publish it as a service commitment only after assigning a responsible person and confirming delivery capacity.
If the owner wants a formal timed commitment, define trigger, scope, business hours, exclusions,
owner responsibilities, reporting, and remedy, and obtain the required business/counsel approval.
Prefer commitments within the brokerage's control, such as progress updates, to sale outcome promises.
Never invent a response-time SLA just to make the website persuasive.
Do not advertise a buyer's requested price as a sale result or guaranteed price.

## 12. Rental, landlord, and commercial journeys

Retain /rent for tenants.
Add /rent-out as a dedicated landlord entry point if it improves clarity.
Keep /sell compatible with existing rent-out links; use a clear intent selection or approved redirect mapping.
Residential rent fields: area, property type, monthly budget band, move-in window, furnishing preference.
Landlord fields: type, area, availability preference, furnishing, timeline, name, phone.
Use respectful customer language; remove unsupported tenant “verification” and demographic stereotypes.
No claims about background checks unless a lawful, approved verification process is actually provided.
Do not publicly expose landlord addresses, phone numbers, private photos, or availability.
Commercial hub: /commercial.
Commercial detail candidates: buy, sell, rent, lease-out, office, shop/showroom, warehouse, and industrial property.
Publish each only after actual capability, geographical coverage, and applicable review are established.
For unsupported combinations, keep internal drafts and route the customer to a general discussion option.
Do not infer agricultural-land, investment-advisory, legal, property-management, or warehouse expertise from “everything.”
No guaranteed rental yields, occupancy, commercial returns, or investment appreciation.
No calculator purporting to provide market valuations.

## 13. Route system and page hierarchy

Use the companion ROUTE-MANIFEST.csv as a planning register, not an automatic publishing instruction.
All newly proposed routes are draft candidates until the corresponding gates are satisfied.
Preserve /buy, /sell, /rent, /about, /contact, /how-it-works, /areas, and /.
Add the owner page and suitable service pages in controlled batches.
Prefer /areas/[slug] for one canonical locality page per verified entity.
Prefer /guides/[slug] for distinct practical questions.
Prefer /bengaluru/[region] only when a region hub helps browsing and has unique useful context.
Marketing regions are internal navigation groupings, not assertions of current municipal boundaries.
Use /pin-codes as a useful postal reference only after source-backed mapping exists.
Do not generate /buy/[area], /sell/[area], /rent/[area], /best-broker/[area], and /pincode/[code]
for every combination by default.
A single useful locality page can cover relevant intents with clearly linked service sections.
Add a separate intent/locality page only when actual user evidence and distinctive content justify it.
Place guide pages near the services they support, using readable descriptive internal links.
Avoid link farms and hundreds of repetitive “best broker” anchors.
If an old URL is replaced, record the original, replacement, reason, and permanent redirect plan.
Do not redirect unrelated or removed pages to the homepage just to hide errors.
Keep separate corridor and locality entities only if the distinction is useful and reviewed.
The existing /areas/north-bengaluru requires a preserve/merge decision; do not silently rename it to Hebbal.
Record alias decisions before publishing candidate routes such as RR Nagar and Rajarajeshwari Nagar.
Do not create a second page just for a spelling variation.

## 14. Bengaluru coverage and the 100-plus-page request

The companion AREA-RESEARCH-BACKLOG.csv contains more than 100 named area/corridor candidates.
It is a research seed, not an exhaustive Bengaluru directory or proof of service coverage.
Names, spellings, grouping, geographical relationships, and route suitability all require review.
No PIN-code mappings are supplied as verified facts in that file.
Use the owner-provided breadth to build a capability and geography matrix.
For each locality, separately record supported intents, property types, operational owner, and exclusions.
Do not claim a staffed office in every locality or “complete coverage of every PIN code” without evidence.
Outer places and satellites must be described honestly and included only when actually served.
Do not equate Bengaluru city, Bengaluru Urban district, planning regions, and postal delivery areas.
Do not recycle outdated civic ward names merely because they appear in old copy.

Suggested release progression, conditional on research and review capacity:
- Foundation: core service pages, owner profile, contact, approved notices, technical SEO, dependable intake.
- First locality batch: 8–12 genuinely served and researched localities.
- Next batches: 10–15 additional quality-gated locality pages at a time.
- Long-term: 100-plus useful area pages if research, business coverage, and customer demand justify them.
- Extend with reviewed guides and service pages; do not count private previews or policy pages as growth achievements.

These are workload planning targets, not promises of rankings, leads, or publication dates.
Do not delay a sound initial launch until 100 area pages exist.
Do not publish 100 pages merely to satisfy a number.

## 15. Locality publication schema and claim gate

Build typed content records with immutable entity IDs and readable approved slugs.
Required locality fields:
- entityId, canonicalName, aliases, entityType, slug.
- marketingGroup, administrativeMappings with boundary version and source.
- actualServiceCoverage and its responsible owner.
- summary and unique customer-useful sections.
- claimIds referenced by each factual section.
- approvedNearbyRelationships, not unverified distance claims.
- postalMappingIds, where reviewed.
- author, localReviewer, seoReviewer, and approval timestamps.
- sourceCheckedAt, nextReviewAt, contentUpdatedAt.
- editorialStatus, coverageStatus, legalReviewStatus where relevant, and publicationStatus.
- imageRightsRecords, approvedFAQ items, relatedGuideIds.

A claim record must contain:
- claimId and precise claim text, including scope and qualifiers.
- source records with publisher, exact URL/document, relevant page/section, publication date if available,
  access date, supported excerpt or research note, independence, and applicable reuse rights.
- reviewer, review date, conflicting evidence notes, approval status, and expiry/recheck date.
- links to every page using the claim, so corrections propagate.

Two independent sources must support each significant factual locality claim under the project gate.
Two URLs from the same publisher are not independent corroboration.
A transit map and a municipal homepage supporting unrelated topics do not corroborate one transit claim.
A generic organisation homepage does not establish a particular ward, station, typology, or opening date.
Prefer a primary source plus credible independent corroboration.
Do not weaken the gate because an attractive fact has only one source.
If evidence is insufficient, omit the claim or keep the page draft while continuing other work.
Only real named reviewers may sign off; never generate fictional “research desk approved” evidence.
Document each editorial/local/SEO approval separately.
Status transitions: candidate -> research -> draft -> fact_review -> editorial_review -> seo_review -> approved -> published.
Coverage confirmation must also pass before publication.
A status flag alone must not bypass missing evidence or expired approvals.
Create a shared eligibility function used by navigation, static params, metadata, sitemap, and content retrieval.
Unknown, draft, expired, and unapproved slugs must not expose public page content.
Use protected preview tools to inspect drafts; public unknown slugs should return a real 404.
Do not include candidates in sitemaps or public structured data.
Preserve a change history and route impact list when a claim changes or a page is withdrawn.

## 16. Locality page template

Every page must give useful standalone help, beyond a contact button with a changed place name.
Recommended sections, only where reviewed content exists:
1. Clear locality/service headline with honest coverage wording.
2. Short, distinctive locality context and the customers this guide helps.
3. What to discuss when buying, selling, renting, or renting out in that area.
4. Source-backed access or transport context, without fixed commute promises.
5. Property-type considerations with evidence, rather than made-up inventory.
6. Practical location-specific checks, grounded in reviewed information.
7. Reviewed nearby locality links with a clear relationship.
8. Helpful buyer/seller/rental guides.
9. A few real questions answered in plain language.
10. Source notes, actual author/reviewer, reviewed date, and direct contact.

Do not force every section on every area page.
Do not impose an SEO word-count minimum or keyword-density target.
Do not claim best schools, safety, water quality, flood immunity, returns, or legal status without sufficient proof.
Do not represent planned transport as operational.
Do not use invented travel times, distances, PINs, price trends, or “high demand” statements.
Answer procedural questions with approved service information; factual local answers need claim evidence.
Keep customer contact visible without using repeated phone numbers as keyword filler.
At most a small number of sensible call placements are needed on a typical page.

## 17. PIN-code workflow

Use India Post's current official postcode/post-office tools or approved official datasets as the postal source.
Record exact source paths, lookup dates, delivery-office names, and dataset version where available.
Build a many-to-many locality/postal mapping.
A locality can span codes, a code can cover several delivery areas, and colloquial names need disambiguation.
Do not infer a code from a neighbouring place or a search snippet.
Apply the project corroboration gate to factual mapping claims before public use.
If an official lookup is dynamic or cannot be independently corroborated, keep the relevant mapping unpublished.
Identify what “all Bengaluru PIN codes” means using an approved geographic boundary first.
Record exclusions, duplicate post offices, ambiguous names, and recently changed information.
A non-exhaustive seed cannot be labelled “all Bengaluru PIN codes.”
Start with internal mapping and a useful user-facing finder only when mappings are reliable.
An optional public PIN reference must serve a postal information need; do not create thin keyword pages.
Never use a PIN to imply INSTLE REAL ESTATE has an office there.
Do not generate separate pages for every PIN/locality/intent/property-type combination.

## 18. Technical SEO implementation

Keep principal content and internal links available in server-rendered HTML.
Do not make business identity, phone, service descriptions, or locality summaries depend on client fetches.
Use current installed Next.js metadata APIs in Server Components.
Create unique page titles and honest descriptions based on visible content.
Include INSTLE REAL ESTATE exactly in business title lockups.
Use one H1 and a sensible heading hierarchy.
Do not blindly add keywords metadata or keyword density checks.
Create meaningful image alt text and intrinsic dimensions.
Provide crawlable text links for main navigation and related content.
Use real 404 status for unknown routes; avoid soft 404s and unrelated homepage redirects.
Keep request failures, preview pages, thank-you screens, internal admin, and enquiry data out of indexing.
Specify an indexing policy by route family and environment.
Prototype routes must remain noindex and outside navigation/sitemaps; remove from production or protect them if possible.
Robots.txt controls crawler access; it is not authentication or a private-data protection system.
Do not block a known public URL in robots.txt and assume a crawler will see its noindex instruction.
For deindexing accessible prototypes, keep the noindex observable until removed or protected.
Keep genuine public assets crawlable and private data behind authentication.
Avoid thin parameter pages and indexable search/filter permutations.
Do not place personal information in URLs or page titles.
Normalise approved paths and prevent trailing-slash/case duplicates according to the chosen URL policy.
Use permanent redirects only for real URL migrations.
Keep lastModified tied to substantive content changes, not every request/build.
Check rendered tags and response headers, not only TypeScript objects.
No false claim that sitemap submission guarantees crawling or ranking.
No false claim that structured data guarantees rich results or AI recommendations.
Use approved structured data only; match it to visible content and business facts.
Generate a brand-level social image with exact spelling and accurate text.
Do not put the image's conceptual property artwork into a claim of actual inventory.
Inspect current metadata streaming/bot handling in the installed framework documentation.
Verify principal page text and critical metadata in an unhydrated response and the browser.
Do not assume all crawlers execute JavaScript or behave like a logged-in browser.

## 19. Domain-dependent SEO gate

Use explicit configuration for environment, verified public origin, and launch readiness.
A production host string alone does not constitute owner confirmation of the canonical domain.
Before confirmation:
- Domain remains TO BE CONFIRMED in internal configuration/docs.
- Canonical tags, absolute business page URLs, and domain-dependent JSON-LD identifiers remain omitted.
- Do not advertise a guessed sitemap URL in robots.txt.
- No production XML sitemap is generated or publicly served.
- Keep previews protected and noindex.
- Prepare reusable code and synthetic tests without presenting a fake domain as canonical.

After owner confirmation and control verification:
- Record purchased domain, owner account, renewal, canonical HTTPS host, and DNS control.
- Choose apex or www once and document it.
- Set the verified public origin using environment configuration.
- Ensure preview deployments do not inherit production indexing permission.
- Add each published page's self-referencing canonical URL.
- Generate a sitemap containing only eligible public canonical 200 URLs.
- Add absolute Open Graph URLs and accurate structured data identifiers.
- Redirect HTTP and alternate owned hosts to the chosen HTTPS origin without loops.
- Never use forwarded request host values to invent canonical URLs.
- Verify DNS, TLS, response headers, production HTML, and absence of preview noindex.
- Verify Search Console and Bing Webmaster Tools with owner-controlled accounts.
- Submit the approved sitemap and inspect key URLs.
- Optionally use IndexNow for participating search engines after source verification and key ownership setup.
- Treat submission as a discovery notification, not a guaranteed index/ranking action.

Unconfirmed domain must not prevent designing, implementing, testing, or reviewing the site locally.
Domain confirmation is a release dependency for public SEO deployment.

## 20. Structured data policy

Use a small truthful entity graph rather than every possible schema type.
Organisation/business name must be INSTLE REAL ESTATE and phone must follow the approved invariant.
Person may describe Utpal Raj KB using the owner-supplied name and role.
WebSite and WebPage URLs depend on the confirmed public origin.
BreadcrumbList may describe actual route hierarchy with valid published destinations.
Article may describe genuinely authored guide content with accurate dates and author identity.
Service may describe an actually provided service; do not invent service prices or availability.
Consider RealEstateAgent only after verifying the relevant business facts and schema suitability.
Do not invent a public address, map coordinates, opening hours, priceRange, awards, foundingDate,
branch locations, aggregateRating, reviewCount, or sameAs profiles to complete schema.
Google's LocalBusiness search feature has required fields; if approved address/details are unavailable,
use a truthful minimal Organisation/Person graph rather than fabricating feature eligibility.
Do not add a self-serving AggregateRating/Review markup scheme to seek stars for this brokerage.
Show genuine approved reviews visibly where permitted; do not assume self-hosted business reviews earn stars.
FAQ content can be useful without FAQPage markup; do not make launch depend on FAQ rich results.
Do not add property listing/Offer/RealEstateListing markup to manufacture inventory.
Use safe JSON serialisation and escape markup-breaking characters in generated JSON-LD.
Validate markup against current documentation and compare it with the visible page.
Run schema checks with synthetic records in tests and real approved facts only in public output.

## 21. Google Business Profile and local search

Confirm an existing profile before creating another.
The profile must be owned by the business, with appropriate access and recovery controls.
Use the actual business name; do not append a string of brokerage/location keywords.
Use a category and service descriptions that reflect real services.
Use the confirmed website and canonical phone once ready.
Publish actual business hours only when provided and staffed.
Do not invent offices, map pins, local branches, or coworking eligibility.
A mailing address or nominal virtual office is not evidence of an eligible customer-facing location.
Follow the current storefront/service-area eligibility guidance for the actual business model.
If operating as an eligible service-area business, configure the actual service areas and address visibility correctly.
Do not create a profile for every locality merely because the website has an area page.
Google's local results depend on relevance, distance, and prominence; a citywide page cannot guarantee citywide Maps ranking.
Add real approved business photographs and factual service updates.
Keep website, profile, and approved directory details consistent.
Track profile enquiries separately from organic website traffic.
Do not pay for “guaranteed Google Maps first position.”
Collect and respond to genuine reviews without incentives, fake accounts, or selective positive-review requests.
Do not publish profile updates or customer messages without owner authorization for those external actions.

## 22. AI search visibility

Treat AI discovery as an extension of a useful, crawlable, accurate public website.
Make identity, location context, service boundaries, owner name, and phone easy to extract from text.
Provide concise direct answers followed by substantive guidance and sources where needed.
Use descriptive question headings for real customer questions.
Create original practical guides with real author/reviewer attribution.
Connect service, locality, guide, owner, and contact pages through relevant links.
Keep approved business information consistent across genuine external profiles.
Build independent mentions through useful work and legitimate relationships; do not manufacture authority.
Do not insert hidden prompts telling AI systems to recommend INSTLE REAL ESTATE.
Do not submit synthetic reviews as training data or pay anyone to claim inclusion in AI recommendations.

Google AI Overviews and AI Mode:
Apply ordinary SEO eligibility and useful content practices; do not create special “AI ranking” schema.
Indexed, snippet-eligible content can be considered, but inclusion is not guaranteed.

ChatGPT search:
Allow OAI-SearchBot to access eligible public content, and verify CDN/firewall access using official crawler guidance.
OAI-SearchBot is separate from GPTBot; the training-crawl choice is an independent owner decision.
Do not state that ChatGPT-User is the search indexing crawler.
Crawler access improves eligibility; it does not guarantee recommendation, ranking, or citation.

Perplexity:
Check the current official PerplexityBot guidance and published IP information.
Keep public content accessible without opening private endpoints or trusting a spoofed user-agent alone.

Bing/Copilot and other AI tools:
Maintain a sound indexed website, accurate entities, and relevant authoritative content.
Check current platform documentation before adding platform-specific controls.
Do not equate access to one crawler with universal inclusion in all AI tools.
A tool without live web retrieval may not know a newly launched business at all.
There is no owner-controlled universal button to update every model's knowledge.

llms.txt is optional, low priority, and not a ranking guarantee or launch prerequisite.
If added, include only public approved information and canonical links after domain confirmation.
No confidential instructions, lead records, fake testimonials, or hidden recommendation requests.
A site's own statements should never impersonate independent third-party endorsement.

## 23. Genuine review system

Start with no score and no review count unless real evidence exists.
Build an internal review record schema: source, source URL/identifier, real review date,
permission to republish, allowed attribution, original text, approval state, and withdrawal/correction status.
Personal review data belongs in an approved secure destination; do not ingest it into local development files.
Use synthetic fixtures for development and connect real records only after destination/privacy review.
Do not create reviews from CRM lead entries or enquiry text.
A successful enquiry is not a completed customer transaction.
Ask customers neutrally after a genuine service interaction through approved channels.
Do not offer rewards for positive reviews or ask only satisfied customers.
Do not write the customer's opinion on their behalf or generate multiple identities.
Use a review link for a verified owned profile when available.
Republish only where platform rights and customer permission allow it.
Do not rewrite criticism, erase context, or transform private feedback into a public testimonial without permission.
If there are one, three, or ten approved reviews, display the actual evidence without a fabricated larger count.
No automated star slider that implies a score when none exists.
Track review requests operationally; do not send them from this build without authorization.
Proposed internal review goals are future business targets, never public past-performance claims.

## 24. Helpful guide plan

Use the companion route manifest to prioritize distinct practical guides.
Each guide requires a named author/reviewer, intent, unique question, accurate scope, and next action.
Property-documentation, fee, tax, legal, and regulatory topics need current primary sources and applicable approval.
Do not turn an educational checklist into a legal-clearance or financial-return promise.
No copying competitor articles or paraphrasing without adding substantive original help.
No fake “local expert” attribution or fabricated professional quotations.
Do not write “everything you need” unless the content actually covers the stated scope.
Use clear answer paragraphs, checklists, and examples that are procedural rather than invented locality statistics.
Include how to ask the brokerage about the subject and what the team actually does.
For unsupported specialist topics, keep the guide draft until suitable review exists.
Do not launch a blog with hundreds of automated posts and no maintenance owner.

## 25. Production enquiries and responsible lead handling

Use an approved durable CRM/database/queue adapter; vendor choice remains open.
Define who receives each intent, who covers absence, and who checks failed delivery.
Require destination approval, access controls, security review, and privacy governance before real-data ingestion.
Development/staging/test submissions must remain synthetic.
Do not use a public Google Sheet, plaintext append-log, or developer inbox as an unreviewed lead store.
Separate test/staging and production destinations and credentials.
Server secrets must never enter public environment variables or browser bundles.
Respect explicit affirmative consent and the approved purpose/notice text.
Marketing permission, if needed, must be a separate optional choice; no preselected marketing consent.
Do not silently claim a generic checkbox establishes legal compliance.
Do not publish a real-data form without an approved notice and destination.
Until ready, keep the form disabled for real submission and provide the direct call path.

API requirements:
- Validate JSON content type, actual request byte limit, and field types server-side.
- Reject malformed, oversized, unsupported, and unconsented payloads predictably.
- Bound string lengths and array sizes; use enums for appropriate fields.
- Apply phone validation for approved supported formats without excluding legitimate non-Indian customers by accident.
- Use provider-trusted connection information for abuse controls; do not blindly trust arbitrary forwarded headers.
- Use distributed rate limits appropriate to the deployed runtime.
- Store idempotency in a shared durable store with expiration and cross-instance behaviour.
- Use a non-PII idempotency key and bind it to an appropriate payload fingerprint.
- Do not return another person's reference for an unrelated repeated client key.
- Handle simultaneous requests and retries safely.
- Check adapter result success; a resolved promise is not proof of acceptance.
- Return customer success only after a durable accepted record or approved durable queue acknowledgement.
- On destination failure, return a retriable failure and offer the call alternative.
- Do not store a success dedupe entry before durable acceptance.
- Distinguish durable lead receipt from subsequent notification delivery.
- If notification fails after storage, alert the assigned team through the approved operational mechanism.
- Return a reference and safe next steps; never return the full stored customer record.
- Ensure personal responses are not cached or indexed.
- Do not log payloads, request bodies, phone numbers, addresses, or error messages containing PII.
- Reject unauthorized administrative access; public clients cannot enumerate leads.

Retention:
Use the approved duration and purpose; do not assume the existing 90-day timestamp is approved policy.
Implement deletion/retention jobs, access review, backup implications, and consent withdrawal handling.
Record minimal safe audit events without copying customer fields.
No session replay on forms or personal-data capture in analytics/error tracking.

## 26. Measurement and SEO reporting

Use business-owned Search Console and Bing Webmaster Tools accounts after domain confirmation.
Propose a privacy-approved analytics tool only after identifying actual measurement needs.
The existing telemetry helper is a contract, not proof of live analytics collection.
Validate both allowed key names and value enums/types/ranges.
Never allow names, phones, emails, exact budgets, free text, exact property addresses, or lead IDs into telemetry.
Do not send the current form payload or unsanitized URL/referrer/query string to an analytics vendor.
Keep campaign labels allowlisted; discard unknown query parameters rather than recording arbitrary strings.
A call-link click is not a completed phone call or qualified customer.
A form success is not a sale.
A quoted AI mention is not proof of ranking stability or endorsement.

Safe proposed event taxonomy:
phone_click, intent_selected, form_start, form_step_complete,
form_submit_attempt, form_submit_success, form_submit_error, locality_view.
Safe proposed dimensions: approved route category/slug, intent enum, component enum, step index, status code.
Do not let an allowed field carry arbitrary user-supplied content.
Validate source component values and slug membership against approved public registries.
Use aggregate reporting with approved retention; no per-user behaviour dossier.

Weekly operational report:
- Search impressions/clicks by page family and intent where the tool exposes them.
- Valid index coverage and excluded routes with reasons.
- Call clicks, form attempts, durable accepted enquiries, and delivery failures.
- Aggregate qualified conversations and actual dispositions in the approved operational system.
- Response-attempt timing against any approved commitment.
- Genuine reviews received, without treating requested reviews as posted ones.
- Actual content published, evidence expiring, and pages needing correction.
- Mobile performance/accessibility issues and their business impact.

Do not invent traffic, keyword volumes, conversion rates, or promised lead totals before a baseline exists.
Set actual numerical business targets with the owner after measurement and staffing capacity are known.

## 27. Competition and keyword research

Perform dated live research after a domain and actual service priorities are established.
Do not state a competitor ranks first based on memory or an isolated personalized search.
Sample relevant organic results, Maps, service pages, and AI answers separately.
Use authorized tools and manual observations; do not run prohibited automated Google scraping.
Record query, date, tool, approximate location context, result type, and evidence.
Compare page usefulness, identity evidence, service specificity, contact ease, page speed, and original content.
Record keyword volumes only when obtained from a named tool with date and settings.
Do not fabricate “10,000 searches/month” estimates.
Identify a primary intent and related questions for each candidate page.
Use “best real estate broker” as a research query, not an unsupported self-description.
Prioritize “sell my apartment”, “buy flat”, “rent house”, and “rent out property” intents in approved areas.
Do not chase every keyword permutation with a separate URL.
Do not copy competitors' wording, ratings, photographs, logos, or business claims.
Earn independent citations through useful educational material and real business relationships.
No paid ranking links, private blog networks, comment spam, or fake directory profiles.
If sponsorship is used, disclose and qualify links appropriately under current search guidance.
Do not publish external profiles or contact partners without explicit owner authorization.

## 28. AI/search benchmark questions

After launch, maintain a small dated manual observation panel rather than claiming universal coverage.
Suggested questions:
1. “Real estate broker in Bengaluru for selling my apartment.”
2. “I want to sell my flat in Bengaluru. How should I choose a broker?”
3. “Help me buy an apartment in Bengaluru.”
4. “Broker for renting out my house in Bengaluru.”
5. “Property brokerage near me” with documented location context where available.
6. “INSTLE REAL ESTATE contact number.”
7. “Who is Utpal Raj KB at INSTLE REAL ESTATE?”
8. “Apartment resale help in [approved locality].”
9. “Commercial property broker in Bengaluru” once that service is actually approved.
10. “Can a broker guarantee an apartment sale in 30 days?”

Sample Google organic/Maps where applicable, ChatGPT search, Perplexity, and Bing/Copilot.
If another tool has live search, document its current mode and context before comparing answers.
Record whether the business was mentioned, which URL was cited, identity/phone accuracy, and factual errors.
Treat observations as samples; results can change with location, question, time, and personalization.
Do not market a one-off mention as “recommended by ChatGPT.”
Use missing/incorrect identity facts to improve content consistency; do not write hidden prompt injections.
No automated monitor is authorized merely because this prompt proposes a measurement process.

## 29. Accessibility and performance

Target WCAG 2.2 AA and verify with both automated and manual review.
The skip link must be the first focusable element.
Use header, nav, main with id main-content, and footer semantic landmarks.
Mobile navigation must be a modal dialog with role dialog and aria-modal true.
Move focus into it on open, trap Tab/Shift+Tab, close on Escape, and restore focus to the trigger.
Prevent interaction with the obscured background, not just background scrolling.
Ensure navigation remains usable on route changes and across nested pages.
Use visible focus indicators, accessible labels, sensible reading order, and semantic buttons/links.
Do not rely solely on colour to identify errors or selected intent.
Body text contrast: at least 4.5:1; relevant large-text/component contrast: at least 3:1.
Use accessible form error summaries and associate field errors with their controls.
Announce async success/error states without repeatedly interrupting the user.
Respect browser zoom and mobile input keyboards.
Aim for 44 px practical tap targets where possible; meet applicable WCAG target-size requirements.
Ensure sticky actions do not obscure focused controls, errors, cookie settings, or content.
No deceptive accessibility-conformance badge based only on a scanner.

Performance engineering goals:
- LCP at or below 2.5 seconds, INP at or below 200 ms, CLS at or below 0.1 at the 75th percentile where field data is available.
- Keep the blueprint's homepage modern-script compressed-transfer budget of 170 KB unless an approved ADR changes it.
- Document the measurement method; bundle estimates and real network transfer are not identical.
- Minimize client components for editorial content.
- Size and compress images; prioritize only the actual important above-fold image.
- Avoid heavy sliders, external widgets, map SDKs, and tracking scripts.
- Cache public content appropriately; never cache private submissions.
- Test slow mobile network/device conditions with a named method and record limitations.
- Use lab measurements before launch; do not claim field performance before enough actual traffic exists.

## 30. Required verification

Run checks appropriate to each implemented batch and fix failures before moving on.
Use the repository's lint, Vitest, TypeScript, and production-build workflows after reading current scripts.
Do not claim checks passed if they were blocked or merely copied from old documentation.
Focus added tests on important behaviour and publication/security boundaries.
Do not add hundreds of tests that just mirror text or style implementation.
Required meaningful tests/inspection areas:
- Brand and phone invariants across visible copy, metadata, and structured data.
- No fake review/count/guarantee strings in production content.
- No public listings, fake prices, or unapproved legal claims.
- Domain-unset mode: no canonical, sitemap, or guessed absolute public URLs.
- Preview mode cannot become indexable by inheriting the production origin.
- Domain-confirmed mode: correct canonicals, sitemap membership, and production indexing.
- Draft/unapproved/expired locality records excluded from every public surface.
- Exact claim evidence and approval gate, including two non-independent sources failing the gate.
- Slug aliases and 404 behaviour.
- Mobile menu keyboard, focus restoration, background inertness, and route navigation.
- Buyer/seller/rent/rent-out/commercial flows relevant to approved services.
- Actual body-size enforcement without relying on Content-Length.
- Adapter returning failure, throwing, or timing out must not produce a false success.
- Idempotency/retries and simultaneous requests across deployed instances where applicable.
- Safe telemetry rejecting unknown fields and unsafe values in allowed fields.
- No PII in logs, URLs, analytics, error tracking, previews, fixtures, or public bundles.
- Retention/withdrawal handling in the approved destination.
- Page text and phone accessible without JavaScript hydration.
- JSON-LD matches visible approved business facts and uses valid serialisation.

Manual visual review:
Homepage, one service page per intent, owner profile, contact, area hub, one approved locality,
one guide, form errors/success/failure, mobile drawer, and 404.
Use actual desktop/mobile screenshots and a short observation log.
Check contrast, long names, narrow screens, zoom, keyboard input, loading, network failure, and reduced motion.
Record unresolved defects with impact and release disposition.

## 31. Milestones and definition of done

M0 — Audit and decisions:
Read rules, inspect actual tree, verify runtime/toolchain, audit claims, list blockers, preserve owner changes.
Produce a capability matrix, route map, decision log, and concise acceptance plan.
Do not call the existing staging intake “production ready.”

M1 — Brand, UI, and core journeys:
Implement responsive shell, clear intent navigation, consistent copy, core service pages, owner profile,
contact path, and truthful review empty state.
Done means tested customer journeys and reviewed screenshots, not just generated components.

M2 — Production intake foundation:
Implement adapter interface/failure handling, data governance hooks, abuse controls, safe telemetry,
and synthetic end-to-end delivery verification.
If destination/privacy approval is unavailable, complete the code safely, keep real submission disabled,
and record precisely what configuration/review is required.
Do not store real personal data while waiting.

M3 — Technical SEO:
Implement shared metadata, index gates, structured-data support, canonical-origin configuration,
robots/sitemap behaviour, internal links, route policy, and domain-mode tests.
Complete and test domain-unset mode now; activate confirmed-domain mode only after confirmation.

M4 — First reviewed content batch:
Audit existing locality records, implement claim-level gates, research actual priority areas,
write useful locality pages and initial guides, obtain actual review, then publish eligible records.
If approvals are missing, complete draft records and templates but do not mark them published.

M5 — Launch preparation:
Complete accessibility/performance/failure checks; produce deployment runbook, budget,
owner decision checklist, support/rollback steps, and reviewable release evidence.
The owner selects and purchases the domain and vendors; do not make purchases on this prompt alone.

M6 — Release after owner authorization:
Confirm domain/control and production destination/privacy/operations readiness.
Deploy only with the owner's release authorization under the repository release rules.
Verify TLS, host redirects, indexing, sitemap, profile links, actual approved form routing,
and owner access/recovery.
Do not expose real data to staging during release verification.

M7 — Expansion and maintenance:
Expand reviewed coverage in sensible batches and report actual results.
Maintain locality source freshness, genuine reviews, business identity, performance, and operational follow-up.
Do not mass-publish candidates simply because the infrastructure supports it.

## 32. Expected implementation documents

Keep a short current progress record; use the companion IMPLEMENTATION-TASKS.csv as the working backlog.
Produce or update:
- Current audit with factual findings and severity.
- Brand/contact/source-of-truth configuration notes.
- Requested service expansion ADR and actual capability matrix.
- Owner profile content approval record.
- Route/indexing/canonical matrix and redirect register.
- Claim/source ledger and locality publication workflow.
- PIN-code mapping provenance and definition of coverage.
- Lead destination/data dictionary, consent, access, retention, and failure-runbook records.
- Safe event dictionary and measurement limitations.
- Design tokens and screenshots of actual implemented pages.
- Test/build/performance/accessibility evidence with dates and environment.
- Production release/rollback runbook and owner handover.
- Launch budget with quoted vs estimated costs clearly separated.

Do not label every task complete because a page file exists.
Attach each task to its output and acceptance evidence.
Separate built, tested, approved, published, and measured statuses.

## 33. Costs and procurement boundaries

Use LAUNCH-BUDGET.md as planning guidance, not a guaranteed quote.
Required purchases depend on the selected production architecture and owner choices.
Compare domain first-year/renewal price, taxes, ownership, and expiry settings before purchase.
Use a commercially permitted hosting plan; do not assume any free tier permits this business website.
Vercel is an implementation option for this Next.js site, not a selected/approved vendor.
Its public pricing page displayed Pro at US$20/month when checked; confirm billing/seat/usage/region costs at checkout.
Do not convert that figure into an exact rupee quote without a current applicable exchange rate and tax treatment.
Domain, hosting, approved lead destination, mailbox, media, editorial research, and maintenance are separate line items.
Do not pretend paying for hosting buys Google or ChatGPT ranking.
Google Business Profile and Search Console are available without a platform setup subscription.
An agency may charge for management; distinguish that service fee from the platform.
Paid ads are optional and separate from organic ranking; do not add them without budget approval.
Do not buy backlinks, fake reviews, guaranteed AI mentions, unused SEO plugins, or bundled site-builder plans.
The site does not require an OpenAI API subscription to be eligible for ChatGPT search discovery.
Claude's development subscription/API spend is separate from public website hosting and search visibility.
Do not invent Claude prices; confirm the owner's existing plan before budgeting further usage.
Present a clear pre-purchase checklist and keep all business accounts under owner control.

## 34. Launch gate

Required before a public SEO release:
- Approved public business identity and service scope.
- Correct phone with a tested human contact path.
- Owner confirmation/control of purchased domain and canonical host.
- Commercially permitted hosting selected and owner access established.
- Accurate operating information; no invented office, hours, or fees.
- Approved service/fees/privacy/terms wording and applicable review required by the project.
- Real-data destination, security/privacy review, lead ownership, and retention workflow ready,
  or an intentionally call-only launch with form intake disabled and the applicable approvals documented.
- All public locality claims and operational coverage pass their review gates.
- No synthetic reviews, rating counts, false sale commitments, fabricated biography, or implied property inventory.
- Preview/draft/private routes excluded; confirmed public pages correctly indexable.
- Accessibility, form failures, build, phone links, metadata, and core mobile pages verified.
- Release evidence, rollback path, and support ownership ready.
- Owner release authorization recorded.

Do all authorized build/preparation work before seeking final release approval.
If a dependency is missing, name the exact missing item, show completed work, and continue independent tasks.
Do not demand approval for every routine design or code choice.
Do not claim launch, indexing, rankings, or lead collection occurred before evidence exists.

## 35. Output style and final handover

Communicate in plain language, with short progress updates as substantive milestones complete.
Lead with the implemented outcome and the customer problem solved.
Provide actual file/page links and screenshots where helpful.
Report checks run and any limits honestly.
Keep internal engineering terminology out of the customer-facing website.
Final handover should state:
1. What was built and improved.
2. Which content is published, draft, or blocked and why.
3. Which checks actually passed.
4. How enquiries are handled and what happens if delivery fails.
5. Which owner-supplied facts are displayed.
6. What needs owner input or release approval.
7. What accounts, costs, and renewal/maintenance responsibilities exist.
8. What happens next for sustainable Bengaluru coverage and measurement.

Do not promise immediate first-place rankings, 1000 reviews, a sale in 30 days, or inclusion in every AI answer.
Deliver a useful, truthful, reviewable website and a measurable path to broader visibility.

## 36. Primary references to recheck at implementation/release

The companion SOURCES.md records the current reference set and how each source is used.
Recheck mutable platform documentation and prices at implementation and release.
The official sources inform the SEO/crawler/policy constraints; design, task sequencing,
page architecture, budgets, and copy proposals in this handoff are project recommendations.
Do not treat a link to a source homepage as evidence for an unrelated locality fact.

- [Google AI features](https://developers.google.com/search/docs/appearance/ai-features)
- [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- [Google local ranking](https://support.google.com/business/answer/7091)
- [Google Business Profile representation](https://support.google.com/business/answer/3038177)
- [Google genuine contributions policy](https://support.google.com/contributionpolicy/answer/7400114)
- [Google review snippet policy](https://developers.google.com/search/docs/appearance/structured-data/review-snippet)
- [Google LocalBusiness structured data](https://developers.google.com/search/docs/appearance/structured-data/local-business)
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)
- [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- [IndexNow protocol](https://www.indexnow.org/documentation)
- [India Post source portal](https://www.indiapost.gov.in/)
- [Vercel pricing](https://vercel.com/pricing)
- [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)

Begin by inspecting the repository and companion files, then implement M0 and M1.
Continue through the remaining milestones while respecting genuine release dependencies.
