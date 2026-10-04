# Service capability and coverage matrix

* **Date:** 29 September 2026
* **Source of truth in code:** `src/config/service-matrix.ts`
* **Owner decision this depends on:** OWN-03

The owner answered "everything everything" when asked about service scope. This document separates what was **requested** from what has been **confirmed as deliverable**, because the website may only describe the second.

## Status meanings

| Status | Meaning | What the website does |
|---|---|---|
| `offered` | Operations has confirmed the brokerage handles this. | Describes the service. |
| `on-request` | Requested by the owner, delivery not yet confirmed. | Invites the enquiry and says capability is not settled. Claims nothing. |
| `not-offered` | Explicitly excluded. | Hidden from every selector. No public mention. |

Nothing moves to `offered` without an owner or operations confirmation recorded in this file.

## Residential

| Intent | Flat / apartment | Independent house | Villa | Site / plot |
|---|---|---|---|---|
| Buy | offered | offered | offered | offered |
| Sell | offered | offered | offered | offered |
| Rent | offered | offered | offered | not-offered |
| Rent out | offered | offered | offered | not-offered |

Basis for `offered`: this is the core residential brokerage service the existing site already described and the blueprint's V1 scope. Basis for the two `not-offered` cells: renting a residential site is not a service this site has ever described.

## Commercial

| Intent | Office | Shop / showroom | Warehouse | Industrial |
|---|---|---|---|---|
| Buy | on-request | on-request | on-request | on-request |
| Sell | on-request | on-request | on-request | on-request |
| Rent (take on lease) | on-request | on-request | on-request | on-request |
| Rent out (lease out) | on-request | on-request | on-request | on-request |
| General commercial enquiry | on-request | on-request | on-request | on-request |

Every commercial cell is `on-request`. `/commercial` therefore exists as an enquiry route that states plainly that the line has not been drawn on which commercial work the brokerage takes on. It describes no office-leasing or warehouse experience, and the four commercial detail pages remain unwritten rather than published as thin pages.

## "Other — discuss with the team"

`on-request` for every intent. Kept available so a customer with an unusual requirement has somewhere to go, without the site claiming specialist expertise in whatever it turns out to be.

## Explicitly not inferred from "everything"

The following were **not** added, because breadth of ambition is not evidence of capability:

* Agricultural land, farmland or plantation property.
* Investment advisory, portfolio or yield work.
* Property management or facilities management.
* Legal, title, tax or regulatory services.
* Valuation of any kind.
* Home loan arrangement or eligibility assessment.
* Tenant background verification, credit checks or employment checks.
* Any form of guaranteed outcome, yield, occupancy or appreciation.

## Geographic coverage

`CONFIRMED_SERVICE_AREAS` in code is an **empty list**. No locality is confirmed as operationally served.

Consequences enforced in code:

* No locality page can publish: the publication gate requires `actualServiceCoverage: 'confirmed-served'` and a named accountable person, and no record has either.
* The site says it works across Bengaluru and offers to tell a customer on the first call whether their area is one it can help in. It does not claim an office in any locality, or coverage of any PIN code.
* `/pin-codes` does not exist. No locality-to-PIN mapping has been sourced.

## What operations needs to supply to change this

For each combination to be marked `offered`:

1. Confirmation that the brokerage will take the work on.
2. A named person accountable for delivering it.
3. The geographical area within which it applies.
4. Any exclusion that should be stated publicly.

For each locality to become publishable, additionally:

5. Confirmation that the area is actually served, and by whom.
6. The research and review recorded in `CLAIM-AUDIT.md`.
