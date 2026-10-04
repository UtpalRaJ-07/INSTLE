# ADR-0002: Requested service scope expansion, and how the site handles unconfirmed capability

* **Status:** Accepted for implementation; the capability confirmations it depends on remain open
* **Date:** 29 September 2026
* **Supersedes:** nothing. Extends ADR-0001, which stays in force for stack and UI architecture.
* **References:** `INSTLE-REAL-ESTATE-BENGALURU-MASTER-BLUEPRINT.md` section 2 (non-goals), `docs/seo-launch-handoff/CLAUDE-MASTER-BUILD-PROMPT.md` sections 01, 06, 12, `docs/implementation/CAPABILITY-MATRIX.md`

## Context

The master blueprint scoped V1 narrowly: residential brokerage requirement capture, with commercial property listed as an open decision (D-14: "Include only if staff and process are ready") and a long list of non-goals.

The owner has since asked for materially broader scope, answering "everything everything" when asked what services to offer, and specifically requesting apartments, independent houses, villas, sites and **commercial property**, across buying, selling, renting and renting out, from small budgets to large.

This creates a conflict the codebase has to resolve one way or another:

* Build to the narrow blueprint and the site does not reflect what the owner asked for.
* Build to the broad request and the site claims services nobody has confirmed the business can deliver — which the project's own truthfulness rule forbids.

A third pressure: the request is *product breadth*, and breadth of ambition says nothing about staffing, fees, professional competence, or whether a warehouse enquiry can actually be handled well.

## Decision

Represent scope as **data with a per-combination coverage status**, rather than as copy.

`src/config/service-matrix.ts` holds one row per intent × asset-type combination, each with a status:

* `offered` — confirmed deliverable. The site describes the service.
* `on-request` — requested but unconfirmed. The site invites the enquiry and says the line has not been drawn. It claims nothing.
* `not-offered` — excluded. Hidden from every selector; no public mention.

Every public surface reads from this matrix: the property-type lists on the service pages, the options in the enquiry form, and the server-side validation that rejects a combination the brokerage has said it does not handle.

Consequences of the initial values:

1. Residential buy, sell, rent and rent-out are `offered`. This is the service the existing site already described and the blueprint's own V1 scope, so it is not a new claim.
2. Every commercial combination is `on-request`. `/commercial` exists — the owner asked for it, and customers ask about it — but it is written as an enquiry route that states openly that the brokerage has not settled which commercial work it takes on, and it describes no commercial experience.
3. The four commercial detail topics (office, shop, warehouse, industrial) stay unwritten rather than becoming four thin pages.
4. Nothing beyond the requested asset types was inferred from "everything": no agricultural land, investment advisory, property management, legal or tax service, valuation, or loan arrangement.
5. Geographic coverage is a separate, empty list. No locality is confirmed as served, which is one of the reasons no locality page can publish.

## Alternatives considered

**Publish the commercial pages with confident service copy.** Rejected. It would assert capability that has not been established, which is the precise failure mode `AGENTS.md` section 3 prohibits, and it sets up a customer to be let down on the first call.

**Omit `/commercial` entirely until capability is confirmed.** Rejected. Customers ask about commercial property regardless, and sending them nowhere is worse for them than a page that says "tell us and we will be straight with you". It also loses the enquiry signal that would tell the owner whether the capability is worth building.

**Put the scope decision in page copy and review it by reading the pages.** Rejected. Copy drifts, and a reviewer cannot check thirty-six combinations by reading prose. As data it is reviewable in one table and enforced by the form and the API.

## Consequences

Good:

* The site reflects the owner's requested breadth without asserting unproven capability.
* Confirming a capability is a one-line data change plus a recorded confirmation, not a copy rewrite.
* The API refuses combinations the business has excluded, so the operational promise and the intake agree.
* A reviewer can audit the whole scope question from one table.

Costs and risks:

* `on-request` wording is less persuasive than a confident service page. That is the intended trade.
* The matrix has to be maintained. If operations confirms a capability verbally and nobody updates the file, the site understates what the business does.
* A customer could read `/commercial` as reluctance. The copy is written to read as candour instead, but it is worth watching the enquiry mix.

## Open dependencies

| Item | Needed from | Blocks |
|---|---|---|
| Confirmation of which commercial work is taken on, and by whom | Owner and operations (OWN-03) | Moving commercial rows to `offered`; publishing commercial detail pages |
| Territory matrix — which Bengaluru areas are actually served | Owner and operations (OWN-03) | Any locality page publishing at all |
| Fee, commission and representation wording | Owner and applicable counsel (OWN-06) | The brokerage-fees guide, which is written but unpublished |
| Named reviewers for editorial and specialist content | Owner and editorial (OWN-14) | Guides that state external legal, tax or documentation facts |

Until these land, the site runs on the initial matrix values above, and the register in `OWNER-FACTS-CHECKLIST.md` tracks them.
