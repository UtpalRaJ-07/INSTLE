# Lead data dictionary, consent, retention and failure runbook

* **Date:** 29 September 2026
* **Code:** `src/lib/lead-types.ts`, `src/lib/enquiry-schema.ts`, `src/lib/lead-operations.ts`, `src/lib/lead-destination.ts`, `src/app/api/enquiry/route.ts`
* **Current state:** real intake is **disabled by default**. Everything below is implemented and verified with synthetic data.

## 1. Fields collected

| Field | Type | Required | Validation | Privacy class |
|---|---|---|---|---|
| `intent` | enum | yes | buy / sell / rent / rent-out / commercial / general | none |
| `assetType` | enum | yes | From the service matrix. A `not-offered` combination is rejected | none |
| `configuration` | enum | no | 1–5+ BHK or "Not decided". Shown only for homes | none |
| `preferredAreas` | string[] | no | Max 5 items, 60 chars each. Free text the customer typed | low |
| `budgetBand` | enum | no | 6 bands including "Prefer to discuss" | preference, not financial detail |
| `rentBand` | enum | no | 6 bands including "Prefer to discuss" | preference |
| `timeline` | enum | no | 5 values including "Within 30 days" and "Not decided" | none |
| `furnishing` | enum | no | 4 values. Rental journeys only | none |
| `ownershipRole` | enum | conditional | **Required** for sell and rent-out | low |
| `notes` | string | no | Max 400 chars, truncated not rejected | low, free text |
| `contactPreference` | enum | defaulted | Any time / morning / evening | none |
| `name` | string | **yes** | 2–80 chars, rejects `< > { } \` | **personal** |
| `phone` | string | **yes** | Strict validation, see below | **personal** |
| `consent` | boolean | **yes** | Must be literal `true` | consent record |
| `marketingConsent` | boolean | defaults false | Must be boolean. Never preselected | consent record |
| `idempotencyKey` | string | no | Max 100 chars, `[A-Za-z0-9_-]` only. Not personal data | none |

**Not collected:** email address, exact property address, date of birth, income, PAN, Aadhaar, occupation, family details, employer, documents of any kind, file uploads. There is no upload control anywhere on the site.

## 2. Phone validation

| Input | Result |
|---|---|
| `9845012345` | valid, stored as `9845012345` |
| `98450 12345` | valid, punctuation stripped |
| `+919845012345` / `919845012345` / `09845012345` | valid, normalised to the ten national digits |
| `0000000000`, `1234567890`, `5555555555` | **rejected** — the previous 10–15 digit fallback accepted these |
| `98450123456` | rejected — an eleven-digit domestic typo, not reinterpreted as foreign |
| `+971501234567`, `+6591234567`, `+442079460958` | valid, with the country code recorded |
| `971501234567` without `+` | rejected — an explicit `+` is required for a foreign number |
| `+2991234567` | rejected — unsupported country code |

Twenty country calling codes are supported, chosen to cover where Bengaluru property enquiries realistically originate. The international branch runs **first** whenever the customer typed a `+`: a Singapore number with its country code is ten digits beginning with 6, which is also the Indian mobile pattern, and honouring the `+` resolves the ambiguity.

## 3. Stored record

```
id                    IRE-<12 random base36 chars>   reference given to the customer
createdAt             ISO 8601
intent                enum
customer.name         personal
customer.phone        personal, normalised digits
customer.contactPreference
requirement.*         the fields above
governance.serviceConsentGiven        always true; false never reaches here
governance.consentTimestamp
governance.consentNoticeVersion       from INSTLE_CONSENT_NOTICE_VERSION
governance.marketingConsentGiven
governance.proposedRetentionUntil     null unless a retention period is configured
governance.retentionPolicyConfigured
governance.status                     new
governance.assignedQueue              null until operations assign one
```

The reference is random. The previous format embedded the intent and a timestamp, which made references guessable and enumerable.

## 4. What the customer gets back

On success, exactly this:

```json
{ "success": true, "reference": "IRE-...", "isDuplicate": false,
  "message": "...", "nextSteps": "...", "phone": "9353096264" }
```

Verified: the response contains no name, no phone number, no area, no consent timestamp, and no part of the stored record. Every response carries `Cache-Control: no-store, no-cache, must-revalidate` and `X-Robots-Tag: noindex, nofollow`, so a reference is never cached by an intermediary or indexed.

## 5. Consent

* Unticked by default. `consent` must be literal boolean `true` — `"true"`, `1` and `"yes"` are all rejected.
* Marketing permission is a **separate** optional checkbox, unticked, and never bundled into the service consent.
* The notice version shown to the customer is stored with the record. Without `INSTLE_CONSENT_NOTICE_VERSION` the pipeline refuses to store anything, because consent recorded against unidentified wording cannot be evidenced later.
* No approved notice wording has been supplied (OWN-09). The default checkbox label states plainly what happens; it makes no legal claim.

## 6. Retention

* `INSTLE_LEAD_RETENTION_DAYS` is unset, so `proposedRetentionUntil` is `null` and `retentionPolicyConfigured` is `false`.
* An adapter marked `approvedForRealData` is **refused** without a configured period.
* The field is labelled *proposed*. A timestamp in a record is not enforcement — deletion happens in the destination, and who runs it is OWN-08.
* The previous code wrote a 90-day timestamp into every record with no deletion path anywhere. That is corrected.

## 7. Delivery guarantees

The contract, and how each part is tested:

| Guarantee | Test |
|---|---|
| Success only after a durable destination confirms acceptance | `processLeadEnquiry — false success prevention` |
| `success: false` from the adapter never becomes a customer success | ✓ |
| A thrown adapter error never becomes a customer success | ✓ |
| A hung adapter times out at 8 s and returns a retriable failure | ✓ |
| An adapter returning a malformed result is treated as a failure | ✓ |
| No destination at all returns a retriable failure | ✓ |
| A memory store never produces success in production | ✓ |
| Durable receipt is reported separately from queue notification | ✓ |
| An identical repeat returns the same reference, one record | `idempotency` |
| A failed delivery does **not** block a retry | ✓ |
| The same client key with a different payload never returns the other person's reference | ✓ |
| Two concurrent identical submissions create one record | ✓ |
| Store keys contain no readable personal data | ✓ |

## 8. Abuse controls

* 5 requests per 10 minutes per client key.
* `x-forwarded-for` is only read when `INSTLE_TRUSTED_PROXY_HOPS` declares the proxy depth. Otherwise all clients share one bucket and the identifier is flagged untrusted, because trusting the leftmost entry lets a client mint a fresh bucket per request.
* Both the rate-limit and idempotency stores declare `isDistributed`. Production returns 503 and the phone number while either is per-process, rather than appearing to enforce a limit it cannot.
* Body limit 16 KB, applied to **bytes actually read** from the stream. Verified with a 40 KB chunked body carrying no `Content-Length`: 413.

## 9. Response codes

| Code | Meaning | Customer sees |
|---|---|---|
| 200 | Accepted durably | Reference plus next steps |
| 400 | Malformed JSON | Plain message plus the phone number |
| 405 | GET on the endpoint | Method not allowed |
| 413 | Body over 16 KB | Plain message plus the phone number |
| 415 | Not `application/json` | Plain message plus the phone number |
| 422 | Validation failed, or consent notice unconfigured | Field-level messages. Never echoes a submitted value |
| 429 | Rate limited | Wait, or call |
| 503 | Intake disabled, no destination, abuse controls unavailable, or delivery failed | "Please do not assume we have it", plus the phone number |

The 503 wording is deliberate: a customer who thinks their enquiry went through and waits for a call that is not coming is worse off than one who is told plainly to phone.

## 10. Logging and telemetry

* No payload, request body, phone number, name, area or error message containing submitted data is logged. The API's catch block logs nothing at all, because an error message can contain a submitted value.
* Telemetry carries only the intent enum, a component enum from a closed list, and a status code from a closed list. See `EVENT-DICTIONARY.md`.
* No session replay, no analytics on form fields.

## 11. Failure runbook

**A customer says they submitted but got no call.** Ask for the reference. No reference means the submission failed and they saw the 503 message — nothing was stored. With a reference, the record exists in the destination; the failure is in follow-up, not intake.

**The destination is down.** Customers get 503 with the phone number; nothing is silently dropped, and nothing is stored in a way that looks accepted. The failed idempotency reservation is released so a retry works. No queue or buffer exists — adding one is an explicit decision requiring its own privacy review, because it would mean personal data at rest in a second place.

**Delivery worked but nobody was notified.** `notificationDelivered: false` is returned. No notification transport is configured, so this is currently always false. Assigning B4 in the owner checklist is what changes it.

**Duplicate records suspected.** Idempotency covers a 15-minute window keyed on a payload fingerprint. Two genuinely different enquiries from one person create two records, which is correct.

**A customer asks to be removed.** Handled in the destination. No process exists yet (OWN-08).

## 12. Environment variables

| Variable | Default | Effect |
|---|---|---|
| `INSTLE_ENQUIRY_INTAKE_ENABLED` | unset | Unset: call-only. The form is not rendered and the API returns 503. |
| `INSTLE_CONSENT_NOTICE_VERSION` | unset | Required to store anything. |
| `INSTLE_CONSENT_NOTICE_TEXT` | unset | Overrides the consent checkbox label with approved wording. |
| `INSTLE_LEAD_RETENTION_DAYS` | unset | Required for a real-data destination. |
| `INSTLE_LEAD_QUEUE` | unset | Recorded on the record as the owning queue. |
| `INSTLE_TRUSTED_PROXY_HOPS` | unset | Proxy depth for client identification. |

None is a `NEXT_PUBLIC_` variable, so none reaches the browser bundle.
