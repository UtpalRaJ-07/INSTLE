# Safe event dictionary and measurement limitations

* **Date:** 29 September 2026
* **Code:** `src/lib/telemetry.ts`
* **Tests:** `tests/telemetry.test.ts`

## Status

This is a **contract, not a live analytics integration**. No measurement vendor is approved (OWN-15), so nothing is transmitted anywhere. `trackSafeEvent` validates an event and returns the payload; outside development it does not even log.

Saying so matters: the previous implementation was sometimes described as if analytics were collecting. It was not, and it still is not.

## Events

| Event | Fired when |
|---|---|
| `phone_click` | A `tel:` link is activated |
| `intent_selected` | A customer chooses one of the four intents |
| `form_start` | First interaction with any form field |
| `form_step_complete` | Reserved. The form is single-page, so this is unused |
| `form_submit_attempt` | Submit pressed and client validation passed |
| `form_submit_success` | The API confirmed durable acceptance |
| `form_submit_error` | Validation, rate limit, or delivery failure |
| `locality_view` | A published locality page is viewed. Currently unreachable: none is published |

Anything else is dropped.

## Fields, and the values each accepts

Every field is validated against a closed set. The previous version checked key *names* and `typeof`, so an allowed key such as `sourceComponent` accepted any string — a free-text channel straight into analytics.

| Field | Accepted values |
|---|---|
| `intent` | `buy`, `rent`, `sell`, `rent-out`, `commercial`, `general` |
| `routeCategory` | `home`, `service`, `area-hub`, `area-detail`, `guide-hub`, `guide-detail`, `about`, `owner-profile`, `process`, `contact`, `not-found` |
| `sourceComponent` | `header-phone`, `footer-phone`, `hero-phone`, `mobile-action-bar-phone`, `contact-page-phone`, `service-page-phone`, `guide-page-phone`, `intent-card`, `enquiry-form`, `enquiry-api` |
| `statusCode` | 200, 202, 400, 409, 413, 415, 422, 429, 500, 503 |
| `step` | Integer 0–10 |
| `localitySlug` | Must be in the **published** locality registry at call time |
| `guideSlug` | Must be in the **published** guide registry at call time |

Validating slugs against the published registry has a second benefit: a draft slug cannot be measured, so telemetry cannot reveal that a draft page exists.

## Rejection behaviour

An unknown field, or an invalid value in an allowed field, **drops the whole event**. A partially sanitised event would hide the bug that produced it.

Rejection reasons name the field but never the value, because an invalid value is exactly the case where it might be personal data.

## Never permitted

Asserted by test: `name`, `phone`, `email`, `notes`, `budget`, `leadId`, `reference`, `address`, `referrer`, `query`, `url`.

Also excluded by design: the form payload, raw query strings, the full referrer, exact budget figures, free text of any kind, exact property addresses, and any per-user identifier.

There is no session replay, and no analytics on form fields.

## Route categories, not paths

`routeCategory` is a family, not a URL. A raw path can carry a query string, and a query string can carry anything. A raw path is rejected by the validator — `/buy?name=someone` fails.

## What the numbers will and will not mean

Worth writing down before anyone reports on them:

* A `phone_click` is a click on a link. It is not a completed call, a conversation, or a customer. On desktop it often opens nothing at all.
* A `form_submit_success` is a durable record. It is not a qualified lead and certainly not a sale.
* A `form_submit_error` mixes typos, rate limits and genuine outages. Split by `statusCode` before drawing any conclusion.
* `form_start` fires on first field interaction, so a curious visitor who touches one field and leaves counts as a start.
* `locality_view` will read zero for as long as no locality page is published. That is correct, not a tracking fault.

## Weekly report once measurement exists

| Line | Source |
|---|---|
| Impressions and clicks by page family | Search Console, after domain confirmation |
| Valid index coverage, and excluded routes with reasons | Search Console |
| Call-link clicks | `phone_click`, with the caveat above |
| Form attempts, durable acceptances, delivery failures | `form_submit_*` |
| Qualified conversations and dispositions | The approved operational system, not this site |
| Genuine reviews received | Manual. A requested review is not a posted one |
| Content published, evidence expiring, pages needing correction | The claim ledger's recheck dates |

No baseline exists. Setting numerical targets before one exists would be inventing them.

## Before anything is switched on

1. Identify what decision the measurement will inform.
2. Choose a vendor and complete a privacy review (OWN-15).
3. Confirm the event set against that vendor's payload limits.
4. Capture the network requests and confirm no field outside this dictionary appears.
5. Agree aggregate-only reporting and a retention period.
