# Requirements Document

## Introduction

INSTLE REAL ESTATE currently publishes 12 static pages and 3 guides. The owner has asked for four things: a search presence of 100 or more pages, recognition by AI search tools such as ChatGPT, keyword and phrase coverage that matches what customers actually type, and a user interface that feels more human and recognisably Bengaluru rather than generic.

This feature delivers all four, with one deliberate substitution that the owner has already accepted.

**What is substituted, and why.** The owner asked for permutation pages built from combinations of intent, area, property type and PIN code — routes such as `buy-flat-indiranagar`, `sell-villa-hebbal`, `best-broker-<area>` and `pincode-<code>`. Two entries in [Google's search spam policies](https://developers.google.com/search/docs/essentials/spam-policies) cover that pattern: **doorway pages** and **scaled content abuse**. The documented outcome is demotion or removal from the index, which is the opposite of what the owner wants. AI search tools do not count pages either; they cite pages that answer a real question well. The 100-plus page goal is therefore met by researching and publishing genuinely distinct pages from the candidate pool the repository already holds: 132 named area and corridor candidates in `docs/seo-launch-handoff/AREA-RESEARCH-BACKLOG.csv` and 36 guide candidates in `docs/seo-launch-handoff/ROUTE-MANIFEST.csv`, which is 168 candidates in total. Keyword and phrase work moves **inside** those pages — into headings, direct answers and natural phrasing — instead of being spread across duplicated URLs.

**What this feature builds on rather than replaces.** The claim gate (`src/config/claims.ts`), the locality publication gate (`src/config/localities.ts`) and the guide publication gate (`src/config/guides.ts`) are already implemented and tested. Today zero locality pages are publishable, because no record passes the evidence gate and no Bengaluru area is confirmed as operationally served. This feature makes those gates scale to a hundred-plus records. It does not lower them.

**What the feature cannot deliver on its own.** Several requirements depend on facts only the owner can supply: which areas are actually served and who is accountable for each (`OWNER-FACTS-CHECKLIST.md` C1, OWN-03), named reviewers (C2, C3, OWN-14), rights-cleared photography (C12), and the purchased domain (A1, OWN-01). Where a requirement depends on one of these, the dependency is stated in the requirement and the relevant register ID is referenced. No answer is invented.

**What visual identity means here.** Generated or AI-created property photographs, owner portraits, office photographs and customer scenes are forbidden by `AGENTS.md`. The Bengaluru identity requirement is therefore written so that it can be satisfied entirely without photography, using original illustration, area and corridor maps, local colour and typography, texture and layout warmth. A separate optional requirement covers real commissioned or licensed photography if and when the owner supplies assets with provenance and rights recorded.

---

## Glossary

Terms are defined before use. System names in acceptance criteria refer to the entries below.

### Concepts

- **Doorway page**: A page created mainly to rank for a search variation, which offers a reader no material help beyond a page that already exists. Named as a spam pattern in Google's search spam policies. A set of pages differing only by a place name, property type or intent word is the canonical example.
- **Scaled content abuse**: Generating many pages primarily to manipulate search rankings rather than to help a reader, regardless of whether generation is automated, templated or manual. Also named in Google's search spam policies.
- **Claim gate**: The per-claim evidence check implemented by `evaluateClaim` in `src/config/claims.ts`. A significant factual locality claim passes only when it carries at least two sources from at least two distinct publishers, each with an exact URL or document reference, a named location within the source, an access date and a supporting excerpt, plus a real named reviewer, a review date, an `approved` status, and an unexpired recheck date.
- **Independent source**: A source whose `independenceGroup` differs from that of every other source cited for the same claim. Two URLs controlled by one publisher are not independent. A source cited for a different claim does not corroborate this one.
- **Publication gate**: The record-level check implemented by `evaluateLocality` in `src/config/localities.ts` and `evaluateGuide` in `src/config/guides.ts`. A record publishes only when the claim gate passes for every claim the record uses **and** the record-level conditions pass, including confirmed operational coverage and a named accountable person.
- **Search intent**: The single question or task a reader is trying to resolve when a query is typed. One page serves one primary search intent.
- **Own-process content**: Content that describes only how INSTLE REAL ESTATE works, what a customer should have ready, or what the brokerage will not promise. The business is the authority on its own process, so attribution to the business is accurate and no external source is required.
- **External-fact content**: Content that states something about law, tax, documentation, fees, regulation or the local market. Requires a named author, a named subject reviewer and claim-backed sources.
- **Observation panel**: A dated record of manual samples taken from Google organic results, Google Maps, ChatGPT search, Perplexity and Bing or Copilot for a fixed set of benchmark questions. A sample records what one observer saw on one date in one context. A sample is not a ranking, and a sample is not a guarantee.
- **Batch**: A group of locality or guide records taken through research and review together and released as one unit.

### Systems

- **Locality_Content_System**: The typed locality records in `src/config/localities.ts`, together with every public surface that reads them — `/areas`, `/areas/[slug]`, `generateStaticParams`, `generateMetadata`, the sitemap route and internal navigation.
- **Claim_Ledger**: The claim and source records in `src/config/claims.ts`.
- **Guide_Registry**: The guide records in `src/config/guides.ts`.
- **Area_Hub**: The `/areas` route and its browsing structure.
- **Research_Backlog**: `docs/seo-launch-handoff/AREA-RESEARCH-BACKLOG.csv`, holding 132 locality and corridor candidates.
- **Route_Manifest**: `docs/seo-launch-handoff/ROUTE-MANIFEST.csv`, holding 36 guide candidates among its route rows.
- **Search_Intent_Register**: A new dated record of researched customer phrases, the primary intent assigned to each, and the page that serves it.
- **Observation_Register**: A new dated record holding the observation panel samples.
- **Internal_Link_System**: The components and helpers that render links between service pages, locality pages, guides, the owner profile and contact routes.
- **Visual_Identity_System**: `src/styles/tokens.css`, the shared components in `src/components/ui/`, and the original illustration and map assets this feature introduces.
- **Media_Register**: The provenance table in `docs/implementation/DESIGN-AND-MEDIA.md` part 2, together with the `imageRightsRecords` field on locality records.
- **Crawler_Access_Configuration**: The `robots.txt` route handler and any per-crawler rules it serves.
- **Editorial_Workflow**: The documented sequence of roles, states and approvals that moves a record from candidate to published.
- **Content_Policy_Test_Suite**: The automated policy tests, currently `tests/public-content.test.ts` and `tests/route-policy.test.ts`, extended by this feature.
- **Owner_Input_Register**: `docs/implementation/OWNER-FACTS-CHECKLIST.md`.
- **Progress_Report**: The published-content status summary in `docs/implementation/STATUS.md`.
- **Build_System**: The `next build`, `tsc`, `eslint` and `vitest` pipeline.

---

## Requirements

### Requirement 1: A locality content system that scales to 100-plus pages through reviewed batches

**User Story:** As the owner, I want a hundred or more area pages published over time, so that customers searching for property help in a specific Bengaluru locality find a page from INSTLE REAL ESTATE that actually helps them.

#### Acceptance Criteria

1. THE Locality_Content_System SHALL hold each of the 132 candidates in the Research_Backlog as exactly one typed locality record, SHALL give each record a unique `entityId` and a unique `slug`, and SHALL populate every field defined in `src/config/localities.ts` with either a researched value or an explicit null or empty collection.
2. WHEN a locality record is added to the Locality_Content_System, THE Locality_Content_System SHALL set `actualServiceCoverage` to `unconfirmed`, `coverageResponsibleOwner` to null, `editorialStatus` to `candidate` and `publicationStatus` to `unpublished`.
3. WHEN `/areas`, `/areas/[slug]`, `generateStaticParams`, `generateMetadata`, the sitemap route or internal navigation requests locality content, THE Locality_Content_System SHALL determine visibility only by calling the publication gate with the date of that request, so that every one of those surfaces shares one decision and no surface carries a second visibility rule.
4. IF a locality record fails the publication gate, THEN THE Locality_Content_System SHALL return HTTP 404 for that slug, SHALL return a "Page not found" title carrying `noindex`, and SHALL exclude every value held in that record's `summary`, `sections`, `approvedFaq`, `administrativeMappings` and `blockingNotes` from the response, so that no draft text and no internal blocking note reaches a reader or a crawler.
5. WHERE a locality record has passed the publication gate, THE Locality_Content_System SHALL render at least two content sections of at least 120 words each whose headings and paragraph text are reproduced on no other published locality page, either word for word or with only the place name substituted, so that the page helps a reader beyond a contact action with a changed place name.
6. THE Locality_Content_System SHALL render `marketingGroup` only as a browsing label whose surrounding wording identifies the grouping as a browsing aid, and SHALL exclude `marketingGroup` from page metadata, from structured data and from every statement of a municipal, administrative or postal boundary.
7. THE Locality_Content_System SHALL render an administrative zone value or a ward value only where the mapping names a claim that has passed the claim gate and records a non-null `boundaryVersion`, and SHALL render that boundary version in the same page element as the value.
8. WHEN a batch is prepared, THE Editorial_Workflow SHALL include only records that pass the publication gate, SHALL size the first batch at 8 to 12 records and each later batch at 10 to 15 records, and SHALL hold a batch unreleased until the batch minimum is met, so that review capacity governs release pace.
9. IF the number of records that pass the publication gate is below 100, THEN THE Progress_Report SHALL state that count, the count still in research and the date the gate was evaluated, rather than reporting candidate totals as published pages.
10. THE Locality_Content_System SHALL preserve the existing slug `north-bengaluru`, and SHALL hold no second record whose slug or alias covers the same corridor entity, until the preserve, merge or alias decision recorded as open in `docs/implementation/DECISION-LOG.md` D-IMPL-06 is closed.
11. WHEN a request arrives for a slug listed in `LOCALITY_SLUG_ALIASES`, THE Locality_Content_System SHALL resolve that slug to the canonical slug before evaluating the publication gate, and SHALL exclude the alias slug from navigation links, from static params and from the sitemap, so that one place has one page.
12. WHEN a claim in the Claim_Ledger is corrected or withdrawn, THE Locality_Content_System SHALL re-evaluate every record whose collected claim IDs include that claim before serving any further public response for that record's route, and SHALL set `publicationStatus` to `unpublished` for every re-evaluated record that no longer passes the publication gate.
13. WHEN the Owner_Input_Register records under C1 and OWN-03 that an area is served, together with a named person accountable for serving it, THE Locality_Content_System SHALL set `actualServiceCoverage` to `confirmed-served` and `coverageResponsibleOwner` to that named person on the matching record, and SHALL keep `publicationStatus` at `unpublished` until the named reviewers supplied under Owner_Input_Register C2 have approved the record.
14. IF an administrative mapping on a record names a claim that fails the claim gate or records no `boundaryVersion`, THEN THE Locality_Content_System SHALL treat the record as failing the publication gate until that mapping is either evidenced or removed from the record, so that no page publishes with an unevidenced boundary value.
15. IF two Research_Backlog candidates resolve to the same slug, or a candidate's slug matches an existing record's slug or a key in `LOCALITY_SLUG_ALIASES`, THEN THE Locality_Content_System SHALL keep the later candidate out of the registry and THE Editorial_Workflow SHALL record the collision as an open entity-boundary decision, so that one place does not gain two records.

---

### Requirement 2: An area hub that stays browsable at a hundred-plus pages

**User Story:** As a customer looking for help in my own locality, I want to find the right area page quickly, so that I do not have to read a wall of links.

#### Acceptance Criteria

1. WHILE zero locality records pass the publication gate, THE Area_Hub SHALL return HTTP 200, SHALL render zero area links, and SHALL render an empty-state message that states that no area guide is published yet and that names each condition a record must satisfy before publication: at least two independent sources for every claim the record uses, a named reviewer with an unexpired recheck date, confirmed operational coverage, and a named accountable person.
2. WHEN at least one locality record passes the publication gate, THE Area_Hub SHALL render one group heading for each `marketingGroup` that holds at least one published record, SHALL omit every `marketingGroup` that holds zero published records, SHALL render exactly one crawlable text link per canonical published slug with the locality name as the link text, and SHALL order the groups and the links within each group alphabetically, so that the same record set always produces the same page.
3. WHERE a `marketingGroup` holds more than 25 published locality records, THE Area_Hub SHALL render at most 25 links in that group's visible list and SHALL render every remaining link of that group within the same server-rendered HTML response reachable without executing JavaScript, so that no single visible group exceeds 25 links at any published count, including counts above 40.
4. THE Area_Hub SHALL render, adjacent to each group heading, a note stating that the grouping is an internal browsing aid used by INSTLE REAL ESTATE and is not a municipal, ward, zone or postal boundary.
5. THE Area_Hub SHALL exclude every locality record that fails the publication gate from its links, from `generateStaticParams` and from the sitemap, and SHALL render no name, heading, summary or slug of such a record.
6. WHEN the Area_Hub renders, THE Area_Hub SHALL serve every group heading, every group note and every area link in the first server-rendered HTML response, and SHALL require no client-side fetch for any of them, so that a crawler that does not execute JavaScript reaches each page.
7. WHERE a region hub route is introduced, THE Locality_Content_System SHALL publish the region hub only when the region hub links to at least three published locality pages and carries at least two content sections whose text appears on none of the locality pages the region hub links to.
8. IF a group heading or a group note rendered by the Area_Hub contains a ward number, a zone name, a PIN code, or a municipal or constituency term, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System, because such wording converts a browsing aid into an unsourced boundary claim.
9. IF a region hub route links to fewer than three published locality pages or carries fewer than two content sections that are unique to the region hub, THEN THE Locality_Content_System SHALL return HTTP 404 for that route and SHALL exclude the route from links, from static params and from the sitemap.

---

### Requirement 3: Search intent and keyword research captured as dated evidence

**User Story:** As the content owner, I want to know the actual phrases Bengaluru customers type, so that each page answers a real question in the reader's own words instead of guessing.

#### Acceptance Criteria

1. WHEN a researched phrase is added to the Search_Intent_Register, THE Search_Intent_Register SHALL record the phrase text at 120 characters or fewer, the named tool or the named manual method used, the observation date as a single calendar date, the location context stated as Bengaluru or as a named Bengaluru locality, and the primary intent expressed as the single customer question the phrase asks.
2. WHEN a volume figure is recorded, THE Search_Intent_Register SHALL record the named tool, the query date, the tool settings covering the location setting, the language setting and the date range applied, and a re-query date falling at most 180 days after the query date.
3. IF a volume figure lacks a named tool, lacks a query date, lacks any recorded tool setting or has passed its re-query date, THEN THE Search_Intent_Register SHALL record the volume as unavailable, SHALL retain the phrase entry for editorial use, and SHALL store no estimated, rounded or inferred figure in place of the unavailable value.
4. THE Search_Intent_Register SHALL assign exactly one primary intent to each page and SHALL record that page's route against that intent, so that two pages do not compete for one question.
5. WHEN a phrase maps to an intent already served by an existing page, THE Editorial_Workflow SHALL record that existing page's route as the only destination for that phrase, so that a second URL is not created for a wording variation.
6. THE Locality_Content_System and THE Guide_Registry SHALL render a page's primary intent phrase in that page's single `<h1>` or in one section heading and in the direct answer paragraph, and SHALL carry at most 5 supporting researched phrases per page with each supporting phrase appearing at most 3 times in the body wording, so that phrase coverage lives inside pages without repetition padding.
7. THE Editorial_Workflow SHALL record in the Owner_Input_Register, as a new entry in section C numbered after the last existing section C entry, the keyword research tool choice requested, the licence required, the owner decision awaited and the register work that stays blocked until that decision arrives, because no tool has been supplied and no existing section C entry covers one.
8. WHERE a competitor observation is recorded, THE Search_Intent_Register SHALL record the query text, the observation date as a single calendar date, the named tool, the location context stated as Bengaluru or as a named Bengaluru locality, and the result type observed as an organic result, a map result, a paid result or an AI answer.
9. THE Search_Intent_Register SHALL record a competitor position only when that position was observed on a stated date through a named tool, and SHALL label each recorded position a dated sample rather than a ranking.
10. THE Search_Intent_Register SHALL treat superlative broker phrases, including "best real estate broker", "top broker", "number one broker", "leading broker" and "most trusted broker", as research queries only.
11. IF a superlative broker phrase appears as a self-description in public copy, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL report the file and the phrase that caused the failure.
12. THE Build_System SHALL exclude the Search_Intent_Register from public routes and from the sitemap, so that no register entry returns HTTP 200 on a public route and no register entry appears in a sitemap, because the register is internal working material.
13. IF a Search_Intent_Register entry lacks the phrase text, the named tool or manual method, the observation date, the location context or the primary intent, THEN THE Search_Intent_Register SHALL hold that entry out of every editorial assignment and SHALL record which required field is missing.
14. IF a primary intent is already recorded against another page, THEN THE Editorial_Workflow SHALL reject the second assignment, SHALL keep the second record unpublished and SHALL record the conflicting route, so that one question is served by one page.
15. WHILE the keyword research tool licence requested under the new section C entry is unsupplied, THE Search_Intent_Register SHALL record phrases from named manual methods only and SHALL record every volume figure as unavailable.

---

### Requirement 4: A guide programme expanded toward the 36 candidates

**User Story:** As a customer with a specific question about buying, selling or renting in Bengaluru, I want a page that answers that one question directly, so that I can act without calling first.

#### Acceptance Criteria

1. THE Guide_Registry SHALL accept every one of the 36 guide candidates in the Route_Manifest as a typed guide record carrying the fields already defined in `src/config/guides.ts`, where each record carries a slug unique among all records, exactly one customer intent and one customer question of at most 160 characters.
2. WHEN a guide record is added, THE Guide_Registry SHALL set the record's publication status to unpublished and SHALL classify the record as own-process content or external-fact content, so that no candidate reaches a reader before the class that governs it is decided.
3. WHERE a guide record is classified as external-fact content, THE Guide_Registry SHALL require a named author, a named subject reviewer who is a person rather than the business, and at least one claim that has passed the claim gate before the record publishes, and THE Editorial_Workflow SHALL record the dependency on Owner_Input_Register C3 and OWN-14.
4. WHERE a guide record is classified as own-process content, THE Guide_Registry SHALL permit publication attributed to INSTLE REAL ESTATE with no named individual author and no `Article` structured data, and SHALL require the record to state no figure, rate or threshold set by an external body.
5. WHEN a guide record publishes, THE Guide_Registry SHALL render a direct answer of at most 60 words before the detailed sections, so that a reader reaches the answer without scrolling past supporting detail.
6. IF a guide record has no direct answer, fewer than two content sections, no recorded content class, no attribution or no recorded content date, THEN THE Guide_Registry SHALL keep the record unpublished, SHALL return HTTP 404 for the slug with a "Page not found" title carrying `noindex`, and SHALL exclude the slug from static params, from internal links and from the sitemap, so that no draft text reaches a reader or a crawler.
7. THE Guide_Registry SHALL keep the brokerage fee guide unpublished until the fee wording recorded as Owner_Input_Register C5 is supplied and approved, SHALL keep the tax and documentation guides unpublished until the legal and tax reviewers recorded as Owner_Input_Register C3 are named, and SHALL keep the commercial leasing guide unpublished until the commercial capability recorded as Owner_Input_Register C4 is confirmed.
8. WHEN a guide record states a figure, a rate or a threshold set by an external body, THE Guide_Registry SHALL require that figure to carry a claim that has passed the claim gate.
9. IF two published guide records carry the same customer question, carry the same primary search intent recorded in the Search_Intent_Register, or carry slugs that differ only by an area name, a property type word or an intent word, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System, so that two guides do not restate one another.
10. THE Editorial_Workflow SHALL assign to each published guide, before publication, a named maintenance owner and a next review date falling no more than 12 months after the recorded content date, so that no guide is published without somebody responsible for keeping the guide current.
11. IF a guide record states anything about law, tax, documentation, fees, regulation or a market fact, THEN THE Guide_Registry SHALL classify that record as external-fact content, so that a record mixing own-process material with external facts is never published under the own-process conditions.
12. WHEN a guide record publishes, THE Guide_Registry SHALL render at least two content sections, a heading phrased as the descriptive question each section answers, one next step naming a contact action, and one scope note stating what the guide does not cover.
13. IF a claim referenced by a published guide is corrected or withdrawn, or the guide's next review date passes with no later review recorded, THEN THE Guide_Registry SHALL return the record to unpublished and SHALL return HTTP 404 for the slug until a named reviewer records a new review date, so that a stale or unsupported guide stops being served.

---

### Requirement 5: AI search visibility through crawlable, answer-first content

**User Story:** As the owner, I want ChatGPT, Perplexity, Copilot and Google's AI results to describe INSTLE REAL ESTATE correctly when somebody asks about property help in Bengaluru, so that the business is found the way people now search.

#### Acceptance Criteria

1. WHEN a public page that passes the publication gate is requested, THE Locality_Content_System and THE Guide_Registry SHALL serve, in the initial HTML response and before any client-side JavaScript executes, the canonical brand `INSTLE REAL ESTATE`, the telephone link `tel:9353096264`, the service description for that page, the city name `Bengaluru`, the owner name `Utpal Raj KB` on every page that names the owner, and the complete principal page text, where principal page text means the single `<h1>`, every section heading and every body paragraph that the rendered page presents to a reader.
2. IF the initial HTML response for a public page omits the canonical brand, the telephone link, the `<h1>`, any section heading or any body paragraph that the rendered page presents to a reader, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL report the page and the missing element, so that a crawler that does not execute JavaScript still reads the content.
3. WHEN a published guide page renders, THE Guide_Registry SHALL place a direct answer of 20 to 60 words in the first text block after the `<h1>` and before the first section heading, so that an extracting system reads the answer first.
4. THE Guide_Registry SHALL phrase every section heading on a published guide as a question of at most 15 words ending in a question mark, taken from a phrase recorded in the Search_Intent_Register, so that a heading matches the question being answered.
5. THE Locality_Content_System and THE Guide_Registry SHALL render the business name as the exact string `INSTLE REAL ESTATE` and the telephone link as the exact string `tel:9353096264` on every page that carries either, with no variation in spelling, case, spacing or punctuation.
6. THE Build_System SHALL restrict structured data on every public page to the types `Organization`, `Person`, `BreadcrumbList`, `WebSite`, `WebPage`, `Service` and `Article`, and SHALL emit a property value only when that same value appears in the visible text of the same page.
7. IF a public page emits a structured data type outside the permitted list, a property value absent from the visible text of that page, or an address, opening hours, a price range, an aggregate rating, a review count, a founding date, an award or a `sameAs` URL that is not recorded as supplied in the Owner_Input_Register, THEN THE Build_System SHALL fail and SHALL report the page and the offending property.
8. WHILE the purchased domain is unconfirmed under Owner_Input_Register A1, THE Build_System SHALL omit canonical tags, absolute Open Graph URLs, domain-dependent structured data identifiers and the XML sitemap, and SHALL keep every other requirement in this document deliverable.
9. THE Progress_Report SHALL state, in each dated update, that crawler access and structured data improve eligibility for citation, and SHALL state that neither guarantees citation, recommendation or ranking.
10. IF any public source file contains text addressed to an AI system requesting a recommendation, a preference, a ranking or a citation, whether in visible text, in hidden text, in an attribute value or in a code comment, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL report the file and the matched text.
11. IF a published guide has no direct answer, a direct answer shorter than 20 words, a direct answer longer than 60 words, or a direct answer positioned after the first section heading, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL report the guide slug and the measured word count.
12. IF a public page renders an occurrence of the business name that differs by any character from `INSTLE REAL ESTATE`, or a telephone link that differs by any character from `tel:9353096264`, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL report the page and the differing string, so that entity information stays consistent across the site.
13. WHILE the purchased domain is unconfirmed under Owner_Input_Register A1, IF a public page or an emitted structured data value contains an absolute URL carrying a hostname, THEN THE Build_System SHALL fail and SHALL report the page and the URL.

---

### Requirement 6: Correct and documented crawler access

**User Story:** As the owner, I want the crawlers that power AI search to be able to read the public site, so that eligibility is not lost to a misconfigured rule.

#### Acceptance Criteria

1. WHILE `INSTLE_DEPLOY_ENV` holds any value other than `production`, or the domain is unconfirmed under Owner_Input_Register A1 and OWN-01, THE Crawler_Access_Configuration SHALL serve, on every request, a single `User-agent: *` group containing `Disallow: /` with no `Allow` line and no sitemap reference, so that an absent, empty or unreadable environment value produces the blocked response rather than an indexable one.
2. WHILE `INSTLE_DEPLOY_ENV` equals `production` and the domain is confirmed under Owner_Input_Register A1 and OWN-01, THE Crawler_Access_Configuration SHALL serve, on every request, a `User-agent: *` group that allows every route passing the publication gate, that disallows `/api/`, that names the sitemap location on the confirmed domain, and that applies to every user agent not named in a separate group.
3. THE Crawler_Access_Configuration SHALL serve `OAI-SearchBot` and `GPTBot` as two separate user-agent groups whose rules are read from two separate recorded decisions, and SHALL keep a change to either group from altering the other group, because search access and training access are separate decisions.
4. THE Crawler_Access_Configuration SHALL record the search-crawler access decision and the training-crawl access decision as two separate entries, each carrying a decision value of `allowed` or `disallowed`, the deciding person and the decision date, and THE Editorial_Workflow SHALL record the training-crawl decision as an owner choice in a new entry in section C of the Owner_Input_Register.
5. THE Editorial_Workflow SHALL verify each crawler rule against the crawler operator's current published guidance before each release and at intervals of at most 90 days, and SHALL record for each verification the crawler name, the guidance document reference, the verification date and the verifying person.
6. IF a route carrying `noindex`, including every prototype route, appears under any `Disallow` line in the Crawler_Access_Configuration, THEN THE Build_System SHALL fail, because a crawler that cannot fetch a page never reads that page's `noindex` instruction.
7. THE Crawler_Access_Configuration SHALL keep `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow` on every enquiry API response, including success responses, validation-failure responses and server-error responses, so that a personal response is neither cached nor indexed.
8. THE Editorial_Workflow SHALL record in the Progress_Report, and SHALL restate on each release, that a crawler lacking live web retrieval may not know the business at all, and that no owner-controlled method exists for updating a model's stored knowledge.
9. WHERE an `llms.txt` file is added, THE Build_System SHALL serve the file only while `INSTLE_DEPLOY_ENV` equals `production` and the domain is confirmed under Owner_Input_Register A1 and OWN-01, and SHALL limit the file to statements that already appear on a public page passing the publication gate and to canonical links for routes passing that gate.
10. WHILE the training-crawl access decision is unrecorded in the Owner_Input_Register, THE Crawler_Access_Configuration SHALL serve `Disallow: /` for `GPTBot`, so that training access is never granted by default.
11. IF the most recent recorded verification date for any crawler rule is more than 90 days before the build date, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System, so that no rule is released against guidance nobody has rechecked.
12. WHERE an `llms.txt` file is served, IF the file contains a statement that appears on no public page passing the publication gate, or a link to a route that fails the publication gate, THEN THE Build_System SHALL fail.

---

### Requirement 7: A dated observation panel for search and AI mentions

**User Story:** As the owner, I want to see whether AI tools and Google actually mention INSTLE REAL ESTATE, so that I can judge progress from evidence rather than from a promise.

#### Acceptance Criteria

1. THE Observation_Register SHALL hold exactly 10 benchmark questions, each carrying a stable question identifier, covering: a broker for selling an apartment in Bengaluru, choosing a broker to sell a flat, help buying an apartment, a broker for renting out a house, brokerage near a location confirmed as served under Owner_Input_Register C1, the INSTLE REAL ESTATE contact number, the identity of Utpal Raj KB, resale help in a locality that has passed the publication gate, a commercial property broker, and whether a broker can guarantee a sale in 30 days.
2. WHEN an observation is recorded, THE Observation_Register SHALL record the question identifier, the sampling round identifier, the tool sampled, the observation date, the named observer, the location context sampled, whether the business was mentioned as yes or no, the URL cited or `none`, whether the business name the tool reported matches `INSTLE REAL ESTATE` exactly, whether the phone number the tool reported matches `9353096264` exactly, and each factual error observed or `none`.
3. THE Observation_Register SHALL sample Google organic results, Google Maps, ChatGPT search, Perplexity, and Bing or Copilot as five separate tools, recording one entry per question per tool per sampling round, and WHERE the owner has not confirmed a Google Maps presence for the business, THE Observation_Register SHALL record the Google Maps entry as not applicable with the reason rather than as an absence of mention.
4. THE Observation_Register SHALL label each entry with the observation date, the single named observer, the single location context sampled, and a statement that the entry is a manual sample rather than a ranking or an endorsement.
5. IF any public source file presents an observation as a ranking position, as a position number, as a score, as a trend, as an endorsement, as a recommendation, or as a claim that a tool now reports the business correctly without a later dated observation held in the Observation_Register, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System.
6. IF a tool reports a fact about the business incorrectly, THEN THE Editorial_Workflow SHALL record, within 5 working days of the observation date, the incorrect fact, the page that should carry the correct fact, the correction made on the site and the date of that correction.
7. WHILE the commercial capability recorded as Owner_Input_Register C4 is unconfirmed, THE Observation_Register SHALL mark the commercial-broker question as excluded with the reason referencing C4, and SHALL exclude that question from every sampling round and from every reported count.
8. THE Build_System SHALL exclude the Observation_Register from public routes, from server-rendered public HTML and from the sitemap, because the register is internal working material.
9. WHEN the domain is confirmed under Owner_Input_Register A1, THE Editorial_Workflow SHALL complete the first sampling round within 7 calendar days of that confirmation, and WHILE the domain is unconfirmed THE Editorial_Workflow SHALL record no observation and THE Progress_Report SHALL state that observation recording has not begun because no public URL exists to observe.
10. WHILE observation recording is active, THE Editorial_Workflow SHALL complete one further sampling round at least once every 30 calendar days, where a round covers every reportable question against every tool listed in this requirement within a window of at most 2 calendar days.
11. IF a field required by this requirement cannot be determined when the observation is taken, THEN THE Observation_Register SHALL record that field as unavailable together with the reason, and SHALL record neither an estimate nor a recalled value.
12. WHEN the Progress_Report presents observation results, THE Progress_Report SHALL state the sampling round identifier, the round date, the tool, the count of questions where the business was mentioned and the count of questions sampled, and SHALL state that the figures are manual samples taken by one named observer in one location context.

---

### Requirement 8: Internal linking that helps a reader

**User Story:** As a reader on a locality page, I want relevant next pages offered to me, so that I can find the guide or service page I need without going back to the menu.

#### Acceptance Criteria

1. WHEN a locality page that passes the publication gate renders, THE Internal_Link_System SHALL render in the server-rendered HTML three link groups — service pages relevant to that area, related guides that pass the publication gate, and nearby localities that pass the publication gate — where each group carries at least 1 link whenever at least one qualifying destination exists for that group and at most 6 links in any case.
2. THE Internal_Link_System SHALL render link text of 2 to 80 characters that names the destination page's subject, and SHALL render no link whose text consists only of a member of the generic set "click here", "read more", "learn more", "more", "here", "this page", "link", or a bare URL, compared case-insensitively.
3. IF anchor text appears on more than one page that combines a superlative word from the set "best", "top", "number one", "no. 1", "#1", "leading", "finest", "greatest" with a brokerage word from the set "broker", "agent", "agency", "real estate", "property dealer", compared case-insensitively, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL identify each offending page and each matching anchor text.
4. IF a nearby locality candidate has no stated relationship to the current locality that is carried by a claim which has passed the claim gate, THEN THE Locality_Content_System SHALL omit the link to that candidate and SHALL render no placeholder, partial sentence or disabled link in its place, because an unexplained adjacency claim is an unsourced fact.
5. THE Internal_Link_System SHALL render an internal link only when the destination record passes the publication gate and the destination route returns HTTP 200 when requested during the build.
6. THE Internal_Link_System SHALL limit the footer to at most 12 links, drawn only from the main sections rendered in the site header plus one call action, and SHALL render no individual locality link and no individual guide link in the footer.
7. THE Internal_Link_System SHALL place at least 1 and at most 3 call actions on a content page, where a call action is a link to `tel:9353096264` or a link to the contact route, so that the phone number is available without becoming keyword filler.
8. IF the server-rendered HTML of a single page contains more than 60 internal links, counted across header, main content and footer with repeated destinations counted separately, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL identify the page and the counted total, so that a link farm pattern is detected before release.
9. IF zero qualifying destinations exist for one of the three link groups on a locality page, THEN THE Internal_Link_System SHALL omit that group's heading and container entirely and SHALL render the remaining groups unchanged, so that a reader never sees an empty link group.
10. IF an internal link destination fails the publication gate or does not return HTTP 200 during the build, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System and SHALL identify the source page and the unreachable destination route.
11. WHEN a nearby locality link renders, THE Internal_Link_System SHALL render the claim-backed relationship statement in the same list item as the link, so that a reader reads why the two localities are related without leaving the page.

---

### Requirement 9: A warmer, recognisably Bengaluru interface without property photography

**User Story:** As a Bengaluru family or professional visiting the site, I want the site to feel local and human rather than like a generic template, so that I trust the business enough to call.

#### Acceptance Criteria

1. THE Visual_Identity_System SHALL satisfy every criterion in this section using only original illustration, area and corridor maps, colour, typography, texture and layout, and SHALL depend on no photograph of a property, a person, an office or a customer.
2. WHEN the homepage, a service page or a published locality page renders, THE Visual_Identity_System SHALL render at least one Bengaluru-specific visual element in the server-rendered HTML, where that element is an original illustration, an area or corridor map, or a typographic treatment, and where the element's subject is a Bengaluru locality, corridor or civic motif named in the Media_Register entry for that element.
3. WHERE a map is rendered, THE Visual_Identity_System SHALL serve the map from assets held by this site with zero requests to an external host, SHALL render visible text in the same section labelling the map an orientation aid, SHALL omit every commute time and every distance, and SHALL render an administrative zone or ward boundary only from a claim that has passed the claim gate.
4. WHERE an illustration is rendered, THE Visual_Identity_System SHALL render visible text in the same section labelling the asset an illustration, and SHALL keep the subject generic so that the illustration identifies no specific property, no specific building and no identifiable person.
5. THE Visual_Identity_System SHALL measure every text colour pairing at 4.5:1 or higher and every non-text pairing at 3:1 or higher, computed from `src/styles/tokens.css` by the existing token test, and WHERE text is rendered over an illustration, a map or a texture, THE Visual_Identity_System SHALL measure 4.5:1 or higher against every colour that asset presents behind that text.
6. WHEN the homepage is built, THE Build_System SHALL keep the compressed weight of the scripts the homepage requests on first load at or below 170 KB, measured from the production build output.
7. WHEN each public route that returns HTTP 200 is measured at viewport widths of 320, 360, 390, 768, 1280 and 1440 px, THE Build_System SHALL report zero horizontal overflow, where zero horizontal overflow means no element's scrollable width exceeds the viewport width by any amount, and SHALL report exactly one `<h1>` per page.
8. WHEN each public route that returns HTTP 200 is measured at 150% text size at viewport widths of 320 px and 1280 px, THE Build_System SHALL report zero horizontal overflow, using the same definition of zero horizontal overflow as the width measurement above.
9. WHILE `prefers-reduced-motion: reduce` is set, THE Visual_Identity_System SHALL render every transition, animation and scroll behaviour introduced by this feature at a duration of 0 ms, so that no element animates, shifts on scroll or scrolls automatically.
10. THE Visual_Identity_System SHALL keep every interactive target at 44 CSS pixels or larger in the target's smallest dimension at each viewport width measured above, except where an inline text link measures at least 24 CSS pixels in the smallest dimension.
11. THE Visual_Identity_System SHALL render every public page using the system font stack and SHALL issue zero font requests to an external host.
12. THE Visual_Identity_System SHALL use Indian English wording on every public page, taking flat, independent house, villa, site, plot, locality, possession, resale and brokerage as the primary term for each of those concepts, and THE Content_Policy_Test_Suite SHALL check every public page's copy against that term list.
13. IF a public page references an image asset while the Media_Register records no creator, no source, no licence, no permission to adapt, no acquisition date or no alt text for that asset, THEN THE Build_System SHALL fail.
14. IF a public page references a generated or AI-created portrait, office image, transaction scene, customer image or property image, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System.
15. IF no illustration asset and no map asset in the Media_Register applies to a page that must carry a Bengaluru-specific visual element, THEN THE Visual_Identity_System SHALL render the typographic treatment alone and SHALL render no placeholder image, no empty frame and no substitute graphic.
16. WHEN an illustration or a map renders on a public page, THE Visual_Identity_System SHALL render intrinsic width and height for that asset, and SHALL render either the alt text recorded in the Media_Register or an empty alt attribute where the Media_Register records the asset as decorative.
17. WHEN a public route is built, THE Build_System SHALL keep the combined compressed weight of the illustration, map and texture assets that route requests at or below 150 KB, and SHALL keep each single such asset at or below 80 KB compressed.

---

### Requirement 10: An optional pathway for real Bengaluru photography

**User Story:** As the owner, I want to add real photographs of Bengaluru later, so that the site can feel even more local once I have images I am allowed to use.

#### Acceptance Criteria

1. WHERE the owner supplies a photograph under Owner_Input_Register C12, THE Media_Register SHALL record, as non-empty values before the photograph appears on any public page, the creator name, the source reference, the licence name and the licence terms, whether permission to adapt is granted or refused, the acquisition date as a calendar date, and alt text of 1 to 125 characters.
2. IF a photograph recorded in the Media_Register carries an absent or empty licence value, an absent or empty permission-to-adapt value, or a missing person release required by criterion 3, THEN THE Build_System SHALL fail with an error naming the photograph and each missing value, so that the photograph reaches no public page while the recorded entry is retained.
3. WHERE a supplied photograph shows a person whose face is recognisable at the size the page renders, THE Media_Register SHALL record, before the photograph appears on any public page, a written release naming that person, the uses that person permits and the release date.
4. WHERE a photograph is published, THE Visual_Identity_System SHALL render intrinsic width and height values equal to the photograph's encoded pixel dimensions together with either alt text of 1 to 125 characters naming the subject and the locality shown, or an empty alt attribute where the photograph carries no information beyond the surrounding text.
5. WHERE a photograph is published, THE Visual_Identity_System SHALL set `priority` on at most one image per page and only on the image that the Requirement 9 measurement identifies as the largest contentful paint element at 390 px and at 1280 px viewport width.
6. IF a photograph shows a building or a street, THEN THE Locality_Content_System SHALL restrict the caption to at most 120 characters carrying only the area name and the date the photograph was taken, so that the caption carries no statement about availability, price or a property being offered.
7. WHERE a photograph is published, THE Build_System SHALL keep the 170 KB compressed homepage script budget in Requirement 9 and the Requirement 9 responsive checks at 320, 360, 390, 768, 1280 and 1440 px and at 150% text size passing, while no public page renders more than 6 photographs or more than 500 KB of total photograph bytes.
8. WHERE the owner supplies a portrait of Utpal Raj KB under Owner_Input_Register C7 and the Media_Register records the release required by criterion 3, THE Visual_Identity_System SHALL render the portrait on `/about/utpal-raj-kb` with alt text of 1 to 125 characters naming Utpal Raj KB.
9. WHILE no portrait of Utpal Raj KB is recorded in the Media_Register under Owner_Input_Register C7, THE Visual_Identity_System SHALL render no image element and no image placeholder on `/about/utpal-raj-kb`.
10. IF a caption rendered for a photograph on a public page contains a term indicating availability, an asking price, a rent amount, a sale, a booking or a property being offered, THEN THE Content_Policy_Test_Suite SHALL fail the Build_System.
11. WHEN the licence or the release recorded for a published photograph expires or is withdrawn, THE Build_System SHALL fail while any public page still references that photograph, so that the photograph leaves the public pages before the next release.

---

### Requirement 11: An editorial workflow that can sustain batch publication

**User Story:** As the person accountable for content, I want a defined workflow with named roles, so that a hundred pages can be published over time without the quality gate slipping.

#### Acceptance Criteria

1. THE Editorial_Workflow SHALL hold each record in exactly one of the eight states candidate, research, draft, fact review, editorial review, SEO review, approved and published, SHALL advance a record only to the state immediately following its current state in that sequence, and SHALL accept a move to any earlier state in that sequence as a rework.
2. WHEN a locality record enters the approved state, THE Editorial_Workflow SHALL require three distinct sign-off names — one for the editorial approval, one in `localReviewer` and one in `seoReviewer`, each at least 3 characters after surrounding whitespace is trimmed and no two of them equal after trimming and letter-case normalisation — together with a date in each of `editorialApprovedAt`, `localReviewApprovedAt` and `seoReviewApprovedAt`, in the order `localReviewApprovedAt` not later than `editorialApprovedAt` and `editorialApprovedAt` not later than `seoReviewApprovedAt`.
3. IF a sign-off name, after surrounding whitespace is trimmed and letter case is normalised, matches an entry in `NON_ATTRIBUTABLE_REVIEWER_NAMES` or is shorter than 3 characters, THEN THE Editorial_Workflow SHALL reject the sign-off, SHALL leave the record in its current state with its previously recorded approvals and timestamps unchanged, and SHALL return an error indicating that the name does not identify an accountable person, so that a desk name cannot stand in for an accountable person.
4. WHILE any of the named local reviewer, the named editorial approver and the named SEO reviewer requested as Owner_Input_Register C2 is unsupplied, THE Editorial_Workflow SHALL record Owner_Input_Register C2 as the blocking dependency, SHALL hold every locality record at or before the fact review state, and SHALL fail the publication gate for every locality record.
5. WHEN a record enters the approved state, THE Editorial_Workflow SHALL record `sourceCheckedAt` as the date the record's sources were last checked, `contentUpdatedAt` as the date the record's content last changed, and `nextReviewAt` as a date no earlier than `sourceCheckedAt` and no more than 180 days after `sourceCheckedAt`.
6. WHILE a record carries no `nextReviewAt` value, or the evaluation date is on or after its `nextReviewAt`, THE Locality_Content_System SHALL fail the publication gate for that record, SHALL omit the record's route from `generateStaticParams`, from the `/areas` listing and from the sitemap, and SHALL return HTTP 404 for that route, until a fresh review records the three sign-off names and dates in criterion 2, a new `sourceCheckedAt` and a new `nextReviewAt`.
7. WHILE the evaluation date is on or after a claim's `recheckBy` date, THE Claim_Ledger SHALL fail the claim gate for that claim, and THE Locality_Content_System SHALL withdraw every record that references that claim from public surfaces until the claim passes the claim gate again, so that expiry withdraws the dependent content automatically.
8. THE Editorial_Workflow SHALL provide a preview surface for inspecting a record that has not passed the publication gate, THE Build_System SHALL return HTTP 404 for that surface in every production build, and THE Build_System SHALL omit that surface from the sitemap and from every link rendered on a public page.
9. WHEN a record is withdrawn from public surfaces, THE Editorial_Workflow SHALL record the record identifier, the specific publication gate failure that caused the withdrawal, the withdrawal date and every route removed, and SHALL retain the record together with its recorded approvals rather than deleting them, so that the record can re-enter review.
10. WHEN a batch is released, THE Editorial_Workflow SHALL record in the Progress_Report the batch identifier, the count of records released in that batch, the named local reviewer, named editorial approver and named SEO reviewer for that batch, and the release date.
11. IF a record is moved to a state that is neither the state immediately following its current state nor an earlier state in the sequence in criterion 1, THEN THE Editorial_Workflow SHALL reject the move, SHALL leave the record in its current state, and SHALL return an error indicating the rejected transition.
12. IF a record's `contentUpdatedAt` is later than any of `localReviewApprovedAt`, `editorialApprovedAt` or `seoReviewApprovedAt`, THEN THE Editorial_Workflow SHALL return the record to the fact review state, and THE Locality_Content_System SHALL withdraw the record from public surfaces until all three approvals in criterion 2 are recorded again with dates not earlier than `contentUpdatedAt`.

---

### Requirement 12: Non-goals enforced automatically

**User Story:** As the owner, I want the harmful shortcuts kept out of the build, so that the site is not demoted for a pattern somebody adds later without realising the consequence.

#### Acceptance Criteria

1. IF a registered route path matches `/buy/[area]`, `/sell/[area]`, `/rent/[area]`, `/rent-out/[area]`, `/best-broker/[area]` or `/pincode/[code]`, or places a dynamic segment directly beneath a segment naming a transaction intent (`buy`, `sell`, `rent`, `rent-out`, `broker`, `best-broker`) or a property type (`apartment`, `flat`, `villa`, `plot`, `house`, `commercial`, `office`), or carries two or more dynamic segments, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming that route path, because that pattern is a doorway page pattern under Google's search spam policies.
2. IF a route under `/areas/` resolves to a slug that is not the exact `slug` of exactly one locality record in the Locality_Content_System, or resolves to a slug containing a transaction-intent word, a property-type word or a six-digit numeric group, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming that slug, because generating one page per intent, type or postcode combination rather than per named place entity is scaled content abuse under Google's search spam policies.
3. IF a route path carries a segment matching, case-insensitively, `pin`, `pin-code`, `pincode`, `pincodes`, `postcode` or `postal-code`, or a segment that is a six-digit numeric literal, or a public page presents a six-digit numeric value as a PIN code, postcode or postal code, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the offending route path or file path.
4. WHILE no many-to-many locality-to-postcode mapping has passed the claim gate, THE Editorial_Workflow SHALL hold every locality-to-postcode pair in a non-public register, each pair carrying at least two independent sources, an access date for each source, the boundary version the pair was taken from and a named reviewer.
5. IF a public page presents a rupee, lakh or crore amount associated with an identified property, a street-level property address, a statement that a property is available, reserved, ready to move or newly launched, a repeated per-property component carrying two or more of price, built-up area, bedroom count or property location, a list of two or more properties, or an offer to produce a property value or price estimate from visitor input, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the file path and the matched text.
6. IF a public page presents a review count, a star rating value, an aggregate rating value, a numeral or number-word paired with customers, clients, families, reviews, transactions or properties sold, or a years-in-business or years-of-experience figure, and that occurrence is not registered in the approved-denial list of the Content_Policy_Test_Suite, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the file path and the matched text.
7. IF a public page places a promissory word (`guarantee`, `guarantees`, `guaranteed`, `promise`, `promises`, `assured`, `assure`) in the same sentence as a sale, a purchase, a tenant placement, a buyer, a rental yield, a search ranking, an AI citation or a duration in days, and that occurrence is not registered in the approved-denial list of the Content_Policy_Test_Suite, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the file path and the matched text.
8. WHILE a locality record carries an `actualServiceCoverage` value of `unconfirmed` or `not-served`, IF a public page names that locality and asserts service, presence, an office, coverage or availability in it, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the file path and the locality.
9. IF a public page presents a prohibited brand term, a rendering of the brand other than the exact string `INSTLE REAL ESTATE`, a WhatsApp or `wa.me` reference, a `tel:` value other than `tel:9353096264`, the primary phone digits carrying a country prefix or an internal separator, or an absolute `http` or `https` URL whose host contains `instle` while no confirmed domain is recorded in the Owner_Input_Register, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the file path and the matched text.
10. IF a module that renders a registered public route imports a synthetic review, lead or locality fixture, being a module whose records exist only to exercise tests, or imports a locality or guide record that has not passed the publication gate, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion naming the importing file path and the imported module.
11. THE Editorial_Workflow SHALL record purchased ranking links, private blog networks, comment placements, paid directory profiles, incentivised reviews and synthetic reviews as excluded methods, one entry per method, each entry carrying the reason for exclusion and the date the exclusion was recorded.
12. WHEN the Progress_Report is updated for this feature, THE Progress_Report SHALL carry a dated statement that page count, structured data and crawler permission guarantee neither a search ranking nor an AI citation.
13. WHEN the Build_System runs, THE Build_System SHALL execute the Content_Policy_Test_Suite over the public surface, being every source file that renders a registered public route, excluding prototype components and components imported by no registered public route.
14. IF the Content_Policy_Test_Suite records one or more failing assertions, THEN THE Build_System SHALL stop with a non-zero exit status before producing a deployable output.
15. IF the Content_Policy_Test_Suite scans fewer source files than the number of files that render registered public routes, THEN THE Content_Policy_Test_Suite SHALL fail with an assertion reporting the scanned count and the expected count, so that an empty scan cannot pass.

---

### Requirement 13: Honest progress reporting against the 100-plus page goal

**User Story:** As the owner, I want to know how many pages are genuinely published and what is holding the rest back, so that I can supply what is missing instead of waiting.

#### Acceptance Criteria

1. THE Progress_Report SHALL state, as whole numbers, the count of locality records that pass the publication gate, the count of guide records that pass the publication gate, and the sum of those two counts, and SHALL label that sum as the published page count.
2. THE Progress_Report SHALL state the count of records held in each of the states candidate, research, draft, fact review, editorial review, SEO review, approved and published, SHALL account for every candidate in the Research_Backlog and the Route_Manifest in exactly one of those state counts so that the state counts sum to the 168 candidates, and SHALL state the number of further published pages needed to reach 100 as 100 minus the published page count, or as zero when the published page count is 100 or more.
3. IF a record fails the publication gate, THEN THE Progress_Report SHALL state the record identifier together with every failure reason the publication gate returns for that record, rather than a single summary reason.
4. IF a record fails the publication gate because a required owner input has not been supplied, THEN THE Progress_Report SHALL state the record identifier together with the identifier of the blocking Owner_Input_Register entry, SHALL state the number of records blocked by each such entry, and SHALL reference that entry as the only place the request wording is held.
5. THE Progress_Report SHALL exclude from the published page count every record held in the candidate, research, draft, fact review, editorial review, SEO review or approved state, every protected preview route, and every policy page, and SHALL report published static routes that are neither locality records nor guide records as a separately labelled count outside the published page count.
6. IF the published page count reaches 100 or more, THEN THE Progress_Report SHALL state that count together with, for each batch that contributed to it, the batch identifier, the release date and the named reviewers who approved that batch.
7. WHEN the Progress_Report states a traffic figure, a lead figure, a conversion rate or a keyword volume, THE Progress_Report SHALL state the named measurement source, the measurement date and the measurement period alongside that figure.
8. WHEN a batch is released, a record is withdrawn, or a record changes workflow state, THE Progress_Report SHALL restate every count required by this requirement and SHALL state the date on which those counts were computed.
9. WHILE zero locality records pass the publication gate, THE Progress_Report SHALL state the published locality page count as zero and SHALL label the 132 Research_Backlog entries and the 36 Route_Manifest guide entries as candidates rather than as published or in-progress pages.
10. IF a traffic figure, a lead figure, a conversion rate or a keyword volume has no named measurement source or no measurement date, THEN THE Progress_Report SHALL record that figure as unmeasured and SHALL state that no measurement exists, rather than stating an estimate or a projection.
