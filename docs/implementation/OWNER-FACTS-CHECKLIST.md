# Owner input checklist — one list, everything that is missing

* **Date:** 29 September 2026
* **Purpose:** the single place to look for what the build needs from the owner. Nothing else is waiting on an answer.
* **Rule:** "unknown" is a perfectly good answer. It keeps the corresponding capability switched off rather than guessed.

Do not put customer names, customer phone numbers, deeds, ID documents, lead exports, passwords or API keys in this file.

---

## A. Blocking a public release

These stop a release regardless of anything else.

| # | What is needed | What is blocked until it arrives | Refs |
|---|---|---|---|
| A1 | **The exact purchased domain**, as a bare `https://` origin, plus confirmation that the owner controls the registrar account and DNS. Apex or `www` — pick one. | Canonical tags, absolute URLs, the XML sitemap, Search Console, Bing Webmaster Tools. Everything else is built and tested in both modes. | OWN-01 |
| A2 | **Release authorisation**, after reviewing this build and its evidence. | Any deployment. Nothing has been deployed and nothing will be. | OWN-16 |
| A3 | **Which launch mode**: call-only (forms off, phone only) or full intake. Call-only needs nothing further from section B. | The intake configuration, and how `/contact` reads. | — |
| A4 | **Hosting choice**, with commercial-use terms confirmed and the account in the owner's name. | Deployment. No purchase has been made. | OWN-15 |

**C15 also blocks a release.** It is the search-crawler decision, and it is kept in section C next to the training-crawl decision it is easily confused with rather than restated here. It has to be answered before the release that confirms the domain.

---

## B. Needed only for full intake mode

If the answer to A3 is call-only, skip this whole section for now.

| # | What is needed | Why the code refuses without it |
|---|---|---|
| B1 | **The approved lead destination** — which CRM, database or queue, and confirmation it has passed a security and privacy review. | `registerProductionLeadDestination` throws unless the adapter declares itself approved for real data *and* durable. With none registered, production returns 503 and the phone number. |
| B2 | **The consent notice wording**, and a version identifier for it. | `processLeadEnquiry` refuses to store anything without `INSTLE_CONSENT_NOTICE_VERSION`. Consent recorded against unidentified wording cannot be evidenced later. |
| B3 | **The retention period**, in days, and who runs deletion. | A real-data destination is refused without `INSTLE_LEAD_RETENTION_DAYS`. The previous code wrote a 90-day timestamp that enforced nothing; that is now labelled proposed and only written when a policy is set. |
| B4 | **Who receives each enquiry, who covers their absence, and who checks failed deliveries.** | Notification is deliberately unimplemented — sending personal data to an unapproved destination would be an unreviewed disclosure. It currently reports "not delivered" honestly. |
| B5 | **The withdrawal process** — what happens when a customer asks to be removed. | Nothing in the site can implement this; it lives in the destination. |
| B6 | **A shared rate-limit and idempotency store**, once hosting is chosen. | Production refuses traffic while both stores report `isDistributed: false`. Both interfaces are small; any key-value store with TTL fits. |
| B7 | **Trusted proxy hop count** for the chosen host. | Without it `x-forwarded-for` is ignored and all clients share one rate-limit bucket. |

---

## C. Needed before specific content can publish

Each of these unblocks something specific. Only C15 blocks a release; none of the others does.

| # | What is needed | What it unblocks |
|---|---|---|
| C1 | **Which Bengaluru areas are actually served, and who is accountable for each.** | Any locality page at all. `/areas` is an empty state because no record has confirmed coverage or a named owner. |
| C2 | **Named local reviewer, editorial reviewer and SEO reviewer** — real people who will sign off area content. | Locality publication. The gate rejects the previous "INSTLE Research & Advisory Desk" sign-off as non-attributable. |
| C3 | **Named author and subject reviewer for legal, tax and documentation content.** | Four written-but-unpublished guides: property documents, taxes on sale, brokerage fees, commercial leasing. |
| C4 | **Which commercial work the brokerage actually takes on**, and in which areas. | Moving commercial from "on-request" to a described service, and the four commercial detail pages. |
| C5 | **Brokerage fee, commission and representation wording.** | The brokerage-fees guide. No percentage or arrangement appears anywhere on the site today. |
| C6 | **Privacy and terms wording, and an accountable privacy contact.** | `/privacy` and `/terms`, which do not exist. `/contact` currently states plainly what happens to a customer's details and that a full notice is not yet published. |
| C7 | **Portrait of Utpal Raj KB** (a real photograph, with permission), any **biography** facts, and any **verified public profile URLs**. | The portrait and biography sections on `/about/utpal-raj-kb`. The page currently carries the supplied name and role only, with no placeholder and no generated image. |
| C8 | **Public office address**, and whether customers are received there. | An address anywhere on the site, `LocalBusiness` structured data, and a map. None exists today. |
| C9 | **Actual staffed business hours.** | Publishing hours. `/contact` says openly that hours are not published because none has been committed to. |
| C10 | **A response or progress commitment the team can actually meet**, and who owns it. | Any stated response time. `/how-it-works` says openly that none is published because none is staffed. |
| C11 | **Genuine customer reviews**, with the source, the date, and permission to republish. | The review section, which is omitted entirely — not filled with empty stars or a zero count. |
| C12 | **Rights-cleared Bengaluru photography.** | Any photography. The site currently uses none; the conceptual renderings were removed from public pages. |
| C13 | **Which keyword research tool should be licensed**, under whose account, and whether its commercial-use terms have been confirmed. "None, work manually" is a complete answer. Either way, each phrase still needs the date it was observed on, because a register entry without a single calendar date is held out of editorial use. | Search volume figures, which are every one of them recorded unavailable today, and the primary intent phrase carried by each locality and guide record. The search intent register holds zero entries because no tool has been supplied, so no published guide can name the register entry a section heading came from — the gap is recorded in code as `HEADING_INTENT_PROVENANCE_GAP` against Requirement 5.4 and starts to bite by itself once phrases exist. Without the tool, phrases may still be recorded from named manual methods — autocomplete observation, related-search observation, actual enquiry wording — each carrying its own observation date. What stays blocked is every volume figure, and no figure is estimated, rounded or inferred in place of one. |
| C14 | **Whether `GPTBot` may crawl the public site for model training.** The answer needs the decision itself, the deciding person's name, the decision date, and a reference to the crawler operator's guidance document the rule was checked against. Someone named must make that check, and repeat it at least every 90 days. This is a separate decision from C15: allowing `GPTBot` affects whether the content may be used to train a model, and does not affect whether the site can appear in ChatGPT search answers. "Don't allow it" needs no further work. | A recorded `GPTBot` rule, either way. Until one is recorded, `GPTBot` receives `Disallow: /`, so training access is never granted by default. |
| C15 | **Blocking release.** Should `OAI-SearchBot` be allowed to crawl the public site, so its pages can be found and cited in ChatGPT search results? This is a separate decision from C14: allowing `OAI-SearchBot` affects whether the site can appear in ChatGPT search answers, and does not permit the content to be used for model training. The answer needs the deciding person's name and the decision date. Before release, someone named must also check the rule against the crawler operator's current published guidance and record the document reference, the check date and their name. That check is repeated at least every 90 days. | A recorded `OAI-SearchBot` rule. Until this is recorded, `OAI-SearchBot` gets `Disallow: /`. That costs nothing while the domain is unconfirmed, because `robots.txt` serves `Disallow: /` to every crawler until production on a confirmed domain, but it blocks the crawler once the site is live on the confirmed domain, so it has to be answered before that release. Left unanswered it defeats the stated goal of being recognised by ChatGPT, which is why this one blocks a release. |

---

## D. Worksheet

Fill in what exists. Leave the rest.

```
Purchased domain (bare https origin):
Registrar account holder:
DNS controlled by:
Apex or www:

Launch mode (call-only / full intake):
Hosting provider chosen:
Hosting account holder:

Lead destination:
Destination security review done by / date:
Consent notice wording approved by / date:
Consent notice version identifier:
Retention period (days):
Deletion process owner:
Enquiry receiver:
Backup receiver:
Failed-delivery checker:

Areas actually served:
Accountable person per area:
Local reviewer (real name):
Editorial reviewer (real name):
SEO reviewer (real name):
Legal / tax content reviewer (real name and qualification):

Commercial work actually taken on:
Commercial areas covered:
Brokerage fee wording:
Privacy notice wording approved by / date:
Privacy contact:

Utpal Raj KB portrait supplied (y/n):
Utpal Raj KB biography facts:
Verified profile URLs:

Public office address (or "none"):
Customers received at office (y/n):
Business hours (or "not published"):
Response commitment (or "none"):

Genuine reviews available (source, date, permission):
Photography available (source, licence):

Keyword research tool (or "none, work manually"):
Tool account holder:
Tool commercial-use terms confirmed by / date:

GPTBot training crawl (allow / disallow):
Training decision made by / date:
Training rule checked against (guidance document) / by / date:

OAI-SearchBot search crawl (allow / disallow):
Search decision made by / date:
Search rule checked against (guidance document) / by / date:

Monthly infrastructure budget:
Release reviewer and date:
```

---

## E. What is deliberately NOT waiting on the owner

So the register does not grow with things that are already decided:

* Design direction, colour, type and spacing — implemented and contrast-tested.
* Framework, styling approach, hosting portability — ADR-0001 stands.
* Route structure and URL policy — `ROUTE-INDEXING-MATRIX.md`.
* Form fields, validation rules and error wording — implemented and tested.
* Event taxonomy — `EVENT-DICTIONARY.md`. No vendor is needed to have a contract.
* Whether to publish the four existing locality pages — no. They failed the evidence gate.
* Whether to publish a 30-day sale promise — no. `/sell` and a guide both explain why.
