# Release, rollback and support runbook

* **Date:** 29 September 2026
* **Status:** not released. No deployment, purchase or external account change has been made, and none will be without owner authorisation.

---

## 1. Configuration reference

No variable is prefixed `NEXT_PUBLIC_`, so none reaches the browser bundle.

| Variable | Default | Effect when unset |
|---|---|---|
| `INSTLE_DEPLOY_ENV` | unset | Treated as **preview**, not production. Nothing indexable. |
| `INSTLE_PUBLIC_ORIGIN` | unset | No canonical, no absolute URL, no sitemap. |
| `INSTLE_DOMAIN_CONFIRMED` | unset | Same. Required **in addition** to the origin — a host string alone is not owner confirmation. |
| `INSTLE_ENQUIRY_INTAKE_ENABLED` | unset | Call-only. The form is not rendered; the API returns 503 with the phone number. |
| `INSTLE_CONSENT_NOTICE_VERSION` | unset | Nothing can be stored. |
| `INSTLE_CONSENT_NOTICE_TEXT` | unset | A plain default consent label is used. |
| `INSTLE_LEAD_RETENTION_DAYS` | unset | A real-data destination is refused. |
| `INSTLE_LEAD_QUEUE` | unset | No queue recorded on records. |
| `INSTLE_TRUSTED_PROXY_HOPS` | unset | `x-forwarded-for` ignored; all clients share one rate-limit bucket. |

### Build-time versus request-time

This matters and is easy to get wrong.

**Needed at build time**, because they affect statically prerendered pages:

* `INSTLE_PUBLIC_ORIGIN` and `INSTLE_DOMAIN_CONFIRMED` — canonical tags and Open Graph URLs are baked into the static HTML.
* `INSTLE_ENQUIRY_INTAKE_ENABLED` — whether a service page renders the form or the call-only panel is decided when the page is rendered.
* `INSTLE_DEPLOY_ENV` — page-level robots meta.

**Evaluated per request:** `robots.txt`, `/sitemap.xml`, the five prototype pages, and everything in `/api/enquiry`.

Consequence: **changing the domain or the intake mode requires a rebuild, not just a restart.** Verified by observing the failure — a runtime-only change had no effect on the prerendered pages.

This is deliberate rather than merely accepted. A statically prerendered page that cannot begin collecting personal data because of a runtime environment change is the safer property.

---

## 2. Pre-release gate

Do not proceed while any of these is unticked. Sections reference `OWNER-FACTS-CHECKLIST.md`.

### Identity and content

- [ ] Public business identity and service scope approved (A-section, C4)
- [ ] Phone `9353096264` tested end to end, with a person who answers it
- [ ] `/about/utpal-raj-kb` content confirmed as accurate by the owner
- [ ] Every published locality page passes the claim gate — currently **none is published**, which is a valid launch state
- [ ] No fabricated review, rating, count, guarantee, biography or implied inventory — enforced by `public-content.test.ts`

### Domain and hosting

- [ ] Domain purchased, in the owner's account, with the owner holding DNS (A1)
- [ ] Apex or `www` chosen and recorded
- [ ] Renewal date and auto-renew recorded; recovery contact set
- [ ] Hosting selected with commercial-use terms confirmed, account in the owner's name (A4)
- [ ] Preview deployments protected and **not** given the production `INSTLE_DEPLOY_ENV`

### Intake — full mode only

- [ ] Approved durable destination registered via `registerProductionLeadDestination` (B1)
- [ ] Destination security and privacy review complete (B1)
- [ ] Consent notice wording approved; `INSTLE_CONSENT_NOTICE_VERSION` set (B2)
- [ ] `INSTLE_LEAD_RETENTION_DAYS` set; deletion process owned (B3)
- [ ] Enquiry receiver, backup and failed-delivery checker named (B4)
- [ ] Withdrawal process defined (B5)
- [ ] Distributed rate-limit and idempotency stores registered (B6) — **production returns 503 without these**
- [ ] `INSTLE_TRUSTED_PROXY_HOPS` matches the host (B7)

### Intake — call-only mode

- [ ] `INSTLE_ENQUIRY_INTAKE_ENABLED` left unset
- [ ] Confirmed the phone is answered during the hours customers will call

### Checks

- [ ] `npm run verify` passes on the release commit
- [ ] `node scripts/responsive-audit.mjs` reports 0 findings
- [ ] `node scripts/form-state-audit.mjs` reports 0 findings (full-intake releases)
- [ ] `npm run measure:js` within budget
- [ ] Domain-confirmed build inspected locally before deploying

### Authorisation

- [ ] Owner has reviewed the build and the evidence
- [ ] Owner has authorised release, recorded with a date (A2)

---

## 3. Release

1. Confirm the gate above is complete.
2. Set the build-time variables in the hosting project:
   ```
   INSTLE_DEPLOY_ENV=production
   INSTLE_PUBLIC_ORIGIN=https://<the purchased domain>
   INSTLE_DOMAIN_CONFIRMED=true
   # full intake only:
   INSTLE_ENQUIRY_INTAKE_ENABLED=true
   INSTLE_CONSENT_NOTICE_VERSION=<version>
   INSTLE_LEAD_RETENTION_DAYS=<days>
   INSTLE_LEAD_QUEUE=<queue>
   INSTLE_TRUSTED_PROXY_HOPS=<hops>
   ```
3. Build and deploy.
4. Post-deploy verification, in this order:
   - [ ] HTTPS serves; TLS certificate valid for the chosen host
   - [ ] HTTP and the alternate host redirect to the canonical origin, with no loop
   - [ ] `/robots.txt` shows `Allow: /` and the correct sitemap URL
   - [ ] `/sitemap.xml` returns 200 and contains only the expected URLs
   - [ ] `/buy` carries a self-referencing canonical on the real domain
   - [ ] `/concept-1`, `/concept-2`, `/concept-review` return **404**
   - [ ] `/areas/indiranagar` returns 404
   - [ ] Every `tel:` link is exactly `tel:9353096264`; place a real test call
   - [ ] `POST /api/enquiry` behaves as configured. In full-intake mode, send one **synthetic** enquiry and confirm it reaches the destination — never a real customer record
   - [ ] Enquiry responses carry `Cache-Control: no-store`
   - [ ] No preview URL is reachable without protection
5. Only after the above: verify Search Console and Bing Webmaster Tools with owner-controlled accounts, and submit the sitemap. Submission is a discovery notification, not an indexing or ranking guarantee.

---

## 4. Rollback

**Trigger any of these and roll back:**

* An enquiry reaches nowhere, or a customer is shown success without a durable record.
* Personal data appears in a log, a URL, an analytics payload or an error page.
* A draft locality or a prototype route becomes publicly reachable.
* Any fabricated claim appears in public output.
* A `tel:` link is wrong.
* The canonical origin is wrong, or a redirect loop exists.

**Procedure:**

1. Redeploy the previous build. The site is stateless, so this is sufficient for anything presentational.
2. If intake is implicated, unset `INSTLE_ENQUIRY_INTAKE_ENABLED` and rebuild. The site reverts to call-only and every page leads with the phone number. This is the single most useful lever: it turns off data collection without taking the site down.
3. If a content page is implicated, set its record's `publicationStatus` to `unpublished` and rebuild. It becomes a 404 and leaves the sitemap.
4. If personal data may have been mishandled, stop intake first, then follow the destination's incident process before anything else.

**Data implications:** the application stores nothing itself. Records live only in the configured destination, so a rollback does not lose or resurrect data. There is no migration to reverse.

---

## 5. Support ownership

| Area | Owner | Escalation |
|---|---|---|
| Domain and DNS | *unassigned* | |
| Hosting and deployment | *unassigned* | |
| Enquiry receipt and follow-up | *unassigned* (B4) | |
| Failed-delivery monitoring | *unassigned* (B4) | |
| Content corrections | *unassigned* (C2) | |
| Privacy requests | *unassigned* (C6) | |
| Phone answering | *unassigned* | |

Every row is unassigned. Assigning them is a release prerequisite for anything beyond a call-only launch, and the phone row is a prerequisite even for that.

---

## 6. Maintenance

**Weekly:** check failed deliveries; check the phone is being answered; note enquiries received against enquiries handled.

**Monthly:** review Search Console coverage; check claim recheck dates in `src/config/claims.ts`; run `npm run verify`.

**Quarterly:** re-verify locality claims whose recheck date is approaching; confirm the capability matrix still matches what the business does; check dependency updates.

**Whenever a source changes:** update the claim, and use the claim's `usedByRoutes` to find every page that needs correcting. If evidence no longer supports a claim, unpublish the page rather than soften the wording.

**Before publishing any new locality page:** two independent publishers per factual claim, exact references with access dates, a real named reviewer, confirmed coverage with a named accountable person. The gate enforces all of it; the work is the research.
