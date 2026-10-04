# Route, indexing and canonical matrix

* **Date:** 29 September 2026
* **Source of truth in code:** `src/lib/public-routes.ts`, `src/lib/metadata.ts`, `src/config/site.ts`
* **Verified against:** a running `next start` build, in both domain modes

## How indexing is decided

Two independent signals must both be true before any page is indexable or carries a canonical URL:

1. `INSTLE_DEPLOY_ENV=production`
2. `INSTLE_DOMAIN_CONFIRMED=true` **and** `INSTLE_PUBLIC_ORIGIN` set to a valid bare https origin

Anything else is `noindex, nofollow`, with no canonical tag, no `metadataBase`, no absolute Open Graph URL, and no sitemap. A hosting provider's own host variable is never consulted, and a forwarded request header is never used to build a canonical URL.

Deliberate default: a build with no `INSTLE_DEPLOY_ENV` is treated as **preview**, not production. A preview cannot inherit production indexing permission by forgetting a variable.

## Public routes

All indexable once the domain is confirmed. All carry a self-referencing canonical at that point.

| Route | Purpose | In sitemap | Notes |
|---|---|---|---|
| `/` | Offer, four intents, direct phone | yes | Canonical is the bare origin, no trailing slash |
| `/buy` | Buyer journey | yes | |
| `/sell` | Seller journey | yes | Preserved; cross-links to `/rent-out` |
| `/rent` | Tenant journey | yes | |
| `/rent-out` | Landlord journey | yes | New. Previously both owner intents pointed at `/sell` |
| `/commercial` | Commercial enquiry route | yes | States that capability is unconfirmed |
| `/areas` | Area hub | yes | Currently an honest empty state |
| `/guides` | Guide hub | yes | |
| `/guides/[slug]` | Published guides | eligible only | 3 published, 4 drafts return 404 |
| `/how-it-works` | Process and limits | yes | |
| `/about` | Business identity | yes | |
| `/about/utpal-raj-kb` | Owner and CEO profile | yes | Name and role only |
| `/contact` | Contact routes | yes | |

## Content routes behind the publication gate

| Route | State | Behaviour |
|---|---|---|
| `/areas/[slug]` | 0 of 5 records publishable | Genuine 404 for every slug. `generateStaticParams` returns an empty array. `generateMetadata` returns a "Page not found" title with `noindex`, so no draft title leaks. |
| `/guides/[slug]` | 3 of 7 publishable | Published guides are 200 and indexable. The 4 drafts are 404. |

Verified on the running build:

```
/areas/indiranagar                404
/areas/north-bengaluru            404
/areas/whitefield-inner-enclaves  404
/guides/how-brokerage-fees-work   404
```

## Private routes

| Route | Indexing | Production behaviour | In robots.txt? |
|---|---|---|---|
| `/concept-1`, `/concept-1/intake` | `noindex, nofollow` | 404 | No — deliberately |
| `/concept-2`, `/concept-2/intake` | `noindex, nofollow` | 404 | No — deliberately |
| `/concept-review` | `noindex, nofollow` | 404 | No — deliberately |

Why they are not disallowed in `robots.txt`: a blocked URL can still be indexed from an external link, and a crawler that cannot fetch the page never sees its `noindex`. Keeping them crawlable makes the `noindex` observable. In production they are 404 anyway, which is the stronger control.

Verified with `INSTLE_DEPLOY_ENV=production`: all five return 404.

## API and non-page routes

| Route | Method | Behaviour |
|---|---|---|
| `/api/enquiry` | POST | `Cache-Control: no-store, no-cache, must-revalidate` and `X-Robots-Tag: noindex, nofollow` on every response. Disallowed in `robots.txt` once crawling is allowed. |
| `/api/enquiry` | GET | 405. A public client cannot read enquiries. |
| `/robots.txt` | GET | Rendered per request. `Disallow: /` until indexing is permitted. |
| `/sitemap.xml` | GET | **404** until the domain is confirmed and the environment is production. Implemented as a route handler rather than the sitemap file convention precisely so it can 404 — the file convention would always serve a document, and an empty sitemap is still a served sitemap. |

## Verified robots.txt output

Domain unconfirmed (the current default):

```
User-Agent: *
Disallow: /
```

Built and run with `INSTLE_DEPLOY_ENV=production INSTLE_DOMAIN_CONFIRMED=true INSTLE_PUBLIC_ORIGIN=https://verification-only.example`:

```
User-Agent: *
Allow: /
Disallow: /api/
Sitemap: https://verification-only.example/sitemap.xml
```

The sitemap then served exactly 15 URLs: 12 static public routes plus the 3 published guides. No locality slug, no prototype route.

## Aliases and redirects

| From | To | Type | Status |
|---|---|---|---|
| `/areas/indira-nagar` | `/areas/indiranagar` | 308 permanent | Registered. Inactive while the target is unpublished, so it 404s rather than redirecting to a 404. |
| `/areas/sadashiva-nagar` | `/areas/sadashivanagar` | 308 permanent | Same. |

No other redirect exists. Nothing redirects to the homepage to hide a missing page.

**Open decision:** `/areas/north-bengaluru` holds the slug while the record is named "Hebbal". These describe different scopes — a corridor versus a locality. The slug is deliberately unchanged pending a preserve/merge/alias decision (see `DECISION-LOG.md`, D-IMPL-06). Renaming it silently is explicitly forbidden by the master prompt.

## Routes deliberately absent

| Route | Why not |
|---|---|
| `/privacy`, `/terms`, `/cookie-preferences` | No approved wording supplied (OWN-09). Inventing legal text is forbidden. `/contact` instead states plainly what happens to a customer's details and that a full notice is not published yet. |
| `/pin-codes`, `/pincode/[code]` | No source-backed postal mapping exists. |
| `/bengaluru/[region]` | A region hub needs unique useful context first. |
| `/buy/[area]`, `/sell/[area]`, `/rent/[area]`, `/best-broker/[area]` | Cartesian keyword pages. A single useful locality page can cover the intents. |
| `/thank-you` | The confirmation is a form state, so no URL ever carries a reference number. |
| `/property-types/[type]` | Thin at launch. The service pages already list the types. |

A test in `tests/route-policy.test.ts` asserts the first two absences, so adding them requires a deliberate decision rather than slipping in.

## URL policy

* Lowercase, hyphen-separated, no trailing slash.
* No query parameter is used to vary content, so there are no indexable filter permutations.
* No personal data in any URL or page title.
