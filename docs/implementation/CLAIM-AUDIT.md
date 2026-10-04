# Claim audit — locality records and public copy

* **Date:** 29 September 2026
* **Code:** `src/config/claims.ts` (ledger and gate), `src/config/localities.ts` (records and publication gate)
* **Tests:** `tests/claim-gate.test.ts`, `tests/locality-gate.test.ts`, `tests/public-content.test.ts`

## Part 1 — The gate

A significant factual locality claim publishes only when **all** of these hold. Each is checked in code, per claim, not per record.

| Requirement | Why |
|---|---|
| At least two sources | The project's corroboration rule. |
| At least two **distinct publishers** | Two URLs on one domain corroborate nothing. Independence is tracked as an explicit `independenceGroup`. |
| Each source has an exact URL or document reference | A homepage cannot establish a ward, a station, a typology or an opening date. `isOrganisationHomepageUrl` rejects bare origins. |
| Each source names the page, section or table | So a reviewer can find the statement again. |
| Each source records an access date | Ward boundaries and project statuses change. |
| Each source records the supporting excerpt or note | Proves somebody actually read it. |
| A real named reviewer | Names such as "INSTLE Research & Advisory Desk" are rejected by an explicit blocklist. |
| A review date | |
| Approval status `approved` | Status alone is never sufficient — it is one condition among nine. |
| Not past its recheck date | Expiry fails the gate. |

An unknown claim ID also fails. A typo in a content record cannot silently publish an unsupported section.

A record additionally needs: confirmed operational coverage, a named accountable person for that area, an author, a local reviewer, an SEO reviewer, all three approval timestamps, an unexpired content review, and at least one content section.

## Part 2 — The five existing records

None passes. Each is retained as a research candidate so the work has a starting point.

### `indiranagar` — Indiranagar

Previously `published`.

| Claim | What was cited | Why it fails |
|---|---|---|
| Purple Line operational at Indiranagar and SV Road | BMRCL homepage | One publisher, homepage only, no access date, no excerpt |
| BBMP East Zone, wards 80 and 89 | BBMP homepage | Same. Ward numbering changes with delimitation, so a dated notification is required |
| Developed as a planned BDA layout | BDA homepage | Same |
| "Established in the late 1960s" | **nothing** | No source was ever recorded. Removed from the record |

Also removed: typology and "advisory focus" statements asserted as local fact.

### `koramangala` — Koramangala

Previously `published`.

| Claim | What was cited | Why it fails |
|---|---|---|
| BBMP South Zone, ward 151 | BBMP homepage | One publisher, homepage only |
| Yellow Line and Silk Board interchange "in commissioning and testing" | BMRCL homepage | One publisher, homepage only — and this is a dated operational state published from memory. Planned or testing infrastructure must never read as operational |
| BDA layout master scheme | BDA homepage | One publisher, homepage only |

Additional problem: the registry record was named Koramangala while the homepage module covered "Koramangala & HSR Layout". The entity boundary needs an editorial decision before publication.

### `sadashivanagar` — Sadashivanagar

Previously `published`.

| Claim | What was cited | Why it fails |
|---|---|---|
| BBMP West Zone, ward 35 | BBMP homepage | One publisher, homepage only |
| Sankey Tank buffer and tree protection | karnataka.gov.in homepage | One publisher, homepage only. The actual notification with a section reference is required |
| "Heritage precinct", "heritage zoning setbacks" | **nothing** | No statutory heritage designation was evidenced. This materially affects what a buyer can build, so it needs the actual notification |
| "Premier", "high-capital private residences" | n/a | Unsupported value characterisation, not a fact. Removed |

### `north-bengaluru` — Hebbal / northern corridor

Previously `published`. Slug deliberately unchanged (see `DECISION-LOG.md` D-IMPL-06).

| Claim | What was cited | Why it fails |
|---|---|---|
| Metro airport link under construction on the NH 44 alignment | BMRCL homepage **and** NHAI homepage | Two publishers, so independence passes — but neither reference is specific, and **the NHAI source was cited for expressway status, not for the metro alignment**. Two different publishers supporting two different claims is not corroboration of either |
| NH 44 elevated expressway operational | NHAI homepage | One publisher, homepage only |
| "BMRDA Master Strategy" (homepage module) | n/a | A third, different body cited for the same corridor in a different surface. Nothing reconciled the three |

This record is the clearest illustration of why the gate is per claim rather than per record.

### `whitefield-inner-enclaves` — inner Whitefield enclaves

Already a draft. Needs an editorial decision on whether it is a distinct entity from Whitefield before a separate page is justified.

## Part 3 — Public copy corrections

Statements removed or rewritten across the public routes, with the reason.

| Was | Where | Problem | Now |
|---|---|---|---|
| "Verified Tenants" (badge) | services module | Asserts a verification service that does not exist | Removed. `/rent-out` states what the filtering conversation is, and that it is **not** a background check |
| "We help you find verified corporate executives and respectable families" | services module | Unverifiable, and filters people by occupation and social status | Rewritten. `/rent-out` says explicitly that tenants are not filtered by occupation, community, family status or origin |
| "Genuine Buyers" (badge) | services module | Implies a screening the business does not perform | "Buyer Conversations" |
| "without spam calls" | `/sell`, `/buy` | A promise about behaviour that cannot be guaranteed | Removed |
| "No spam calls." | form field help | Same | Removed |
| "We **never** sell your contact details or pass them to telemarketers" | `/how-it-works` | Absolute claim | "We do not sell contact details, and we do not hand them to third parties for marketing" |
| "Zero spam or data selling" / "Your name and phone number stay safe with us" | `/about` | Absolute and vague | Replaced with what is actually done |
| "We never send spam calls, automated messages or sell your data to any third party" | `/contact` | Absolute | A four-point list of what is actually done, plus an open statement that a full privacy notice is not yet published |
| "VERIFIED AREA GUIDANCE" (badge) | `/areas`, homepage | The guidance was not verified | Removed. `/areas` explains the standard a guide must meet before publication |
| "All locality facts are based on verified municipal and transit information" | homepage module | Untrue at the time it was written | Removed |
| "15 minutes to MG Road and CBD" | homepage module | Invented commute time | Removed. No commute time appears anywhere |
| "Blue Line Metro construction under Phase 2B" | homepage module | Project status with no dated source | Removed |
| "BMRDA Master Strategy" as a source label | homepage module | Non-specific reference to a third body | Removed |
| "We know Bengaluru neighbourhoods, metro lines, arterial roads, water availability" | `/about` | Claimed knowledge the site could not evidence | Replaced with a statement that the team says when it does not know |
| "We share honest price guidance for your area" | `/sell` | Implied locality price data the site does not have | Replaced with "we will tell you how your expectation looks, including if we think it will be difficult" |
| "connect you with genuine buyers and tenants" | `/sell` | Implied a vetted pool | Describes the actual conversation |

## Part 4 — How the copy is kept honest

`tests/public-content.test.ts` scans every public source file (excluding prototype and unused components, with the exclusions listed in the test) for:

* prohibited brand terms, any WhatsApp reference, any formatted or prefixed `tel:` value;
* customer counts, volume claims, years-in-business figures;
* superlatives — "No. 1", "best broker", "most trusted", "trusted by thousands", "award-winning";
* registration and legal-guarantee claims — RERA, clear-title, "100% legal", "certified", "licensed";
* timed outcome promises, matched as promissory phrasing near a day count rather than any mention of a timeframe;
* guaranteed returns, yields or appreciation;
* absolute "never sell your" and "no spam" promises;
* tenant verification and background-check claims;
* demographic and community filter language;
* inventory signals — availability, "ready to move", "buyers waiting", scarcity;
* automated valuation offers;
* office addresses, business hours, fee percentages, response-time commitments, invented email addresses;
* any absolute URL or candidate domain for this business;
* `localStorage` / `sessionStorage` use, logging of payloads, personal fields in query strings.

Comments are stripped before scanning, so an explanatory comment is not a violation. Sentences that legitimately contain a banned phrase in order to **deny** it — "we do not guarantee a sale", "no 'buyers waiting' counters" — are listed explicitly in `APPROVED_DENIALS` with the reason. A new occurrence still fails unless it is added deliberately.
