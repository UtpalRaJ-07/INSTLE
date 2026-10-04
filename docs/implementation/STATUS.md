# Implementation status

* **Date:** 29 September 2026
* **Released:** no. Nothing has been deployed, purchased, or published externally.
* **Working preview:** running at **http://localhost:3300** (`npx next start -p 3300`). Port 3000 was already taken by an unrelated process on this machine.
* **Other modes:** see [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) section 1 for the confirmed-domain and intake-enabled builds.

## Where to look

| Document | What it holds |
|---|---|
| [M0-AUDIT.md](M0-AUDIT.md) | What the code actually did before this work, with severity. Includes findings that only appeared once it was running. |
| [CAPABILITY-MATRIX.md](CAPABILITY-MATRIX.md) | Requested scope versus confirmed scope, per intent and asset type. |
| [ROUTE-INDEXING-MATRIX.md](ROUTE-INDEXING-MATRIX.md) | Every route, its indexing state, canonical policy, and what is deliberately absent. |
| [CLAIM-AUDIT.md](CLAIM-AUDIT.md) | Why the four locality pages were unpublished, claim by claim, and every copy correction. |
| [LEAD-DATA-DICTIONARY.md](LEAD-DATA-DICTIONARY.md) | Fields, consent, retention, delivery guarantees, failure runbook. |
| [EVENT-DICTIONARY.md](EVENT-DICTIONARY.md) | The safe event contract, and what the numbers will not mean. |
| [DESIGN-AND-MEDIA.md](DESIGN-AND-MEDIA.md) | Tokens with measured contrast, media provenance, and the full review log. |
| [DECISION-LOG.md](DECISION-LOG.md) | Fourteen decisions a reviewer might question, with reasoning and how to reverse each. |
| [OWNER-FACTS-CHECKLIST.md](OWNER-FACTS-CHECKLIST.md) | **One list** of everything missing. Nothing else is waiting on an answer. |
| [PROGRESS-REPORT.md](PROGRESS-REPORT.md) | **Generated, not hand-written.** Candidate, gate and publication counts against the 100-plus page goal, every blocked record with the checklist entry blocking it, and what is unmeasured. Rewritten by `npm run report:progress`; machine form in `progress-report.json`. This page stays hand-maintained, which is why the report is its own file. |
| [VERIFICATION-EVIDENCE.md](VERIFICATION-EVIDENCE.md) | Every check run, with results and what was blocked. |
| [RELEASE-RUNBOOK.md](RELEASE-RUNBOOK.md) | Configuration, pre-release gate, release steps, rollback, maintenance. |
| [ADR-0002](../decisions/ADR-0002-requested-service-scope-expansion.md) | How the site handles requested-but-unconfirmed capability. |
| [screenshots/](screenshots/) | 36 captures: 14 pages at two widths, plus drawer, form states and enlarged text. |

## Milestones

| Milestone | State |
|---|---|
| M0 — Audit and decisions | Complete. Git state unverifiable on this machine. |
| M1 — Brand, UI, core journeys | Complete and verified. |
| M2 — Production intake foundation | Code complete and tested. Operationally blocked on an approved destination, notice and retention policy. |
| M3 — Technical SEO | Complete. Domain-unset mode live; confirmed-domain mode verified with a synthetic origin. |
| M4 — First reviewed content batch | Gate complete. Three guides published. No locality publishable: none passes the evidence gate. |
| M5 — Launch preparation | Complete. Checks run, runbook written, owner checklist consolidated. |
| M6 — Release | Not started. Requires a domain and recorded authorisation. |
| M7 — Expansion and measurement | Not started. Follows release. |

## Task register

`docs/seo-launch-handoff/IMPLEMENTATION-TASKS.csv`, all 78 rows updated with status, owner and evidence.

| Status | Count |
|---|---|
| built-and-tested | 24 |
| done | 14 |
| code-ready-blocked-owner-input | 7 |
| blocked-owner-input | 5 |
| not-started (content, blocked upstream) | 4 |
| partially-done | 2 |
| partially-done-blocked | 2 |
| done-with-open-decision | 2 |
| built-none-eligible | 1 |
| done-lab-only | 1 |
| ready-for-owner-review | 1 |
| not-started-blocked-release | 8 |
| not-started-post-release | 7 |

Statuses are deliberately distinct: *built* is not *tested*, and neither is *approved*, *published* or *measured*.

## What is published

12 static pages and 3 guides.

`/` · `/buy` · `/sell` · `/rent` · `/rent-out` · `/commercial` · `/areas` · `/guides` · `/how-it-works` · `/about` · `/about/utpal-raj-kb` · `/contact`

Guides: what to tell us when selling · can a broker guarantee a sale in 30 days · decisions before renting out.

## What is not published, and why

| Not published | Why |
|---|---|
| 5 locality pages | None passes the claim gate. Homepage-level citations, single publishers, a fictional reviewer, unsourced dates and commute times. |
| 4 guides | Legal, tax, fee and commercial topics need a named author and subject reviewer. |
| Privacy and terms pages | No approved wording supplied. |
| Reviews of any kind | None exists. The section is omitted, not filled with empty stars. |
| Office address, hours, fees | Not supplied. |
| Owner portrait and biography | Not supplied. A portrait will not be generated. |
| Response-time commitment | None staffed. |
| Any photography | No rights-cleared asset. Conceptual renderings removed from public pages. |
| `/pin-codes` | No sourced postal mapping. |
| 4 commercial detail pages | Capability unconfirmed. |

## Headline checks

Last run 29 September 2026, 19:09 to 20:12. Every command, its exit code and its
figures — including the three harness defects found and fixed — in
[VERIFICATION-EVIDENCE.md](VERIFICATION-EVIDENCE.md) section 13.

```
npm run lint          exit 0    clean, zero errors and zero warnings
npm run typecheck     exit 0    clean
npm run test          exit 0    69 files, 1939 tests, all passed — on 5 of 11 runs,
                                incl. once as prebuild inside npm run build and on the
                                last run of the session. 6 runs exited non-zero while
                                unrelated workloads pushed the load average to 62:
                                every captured failure was the 5000 ms default timeout
                                in the same 2 heavy files, and one run exited 1 with
                                all 1939 tests passing, on reporter errors. No
                                assertion failure in any run; testTimeout deliberately
                                left alone (13.3)
npm run build         exit 0    prebuild passed, then next build; deployable output
responsive audit      exit 0    0 findings  (16 pages x 6 widths 320-1440, 32 measurements
                                at 150% text, 42 Bengaluru elements, 96 tap-target censuses)
form state audit      exit 0    0 findings  (11 failure conditions, intake-enabled preview)
visual asset weights  exit 0    0 findings  (heaviest asset 4.4% of its 80 KB budget,
                                heaviest route 7.74 KB of 150 KB)
homepage script                 139.64 KB gzip against a 170 KB budget, 30.36 KB headroom,
                                measured from the served page
npm run measure:js    exit 1    NOT RUN, not a pass: the homepage is force-dynamic, so
                                nothing is prerendered for this script to read (13.4)
seed --check          exit 0    no drift, localities and guides
publication sync      exit 0    0 of 132 localities, 3 of 36 guides
```

## Where the numbers come from

Counts, gates and everything blocked on an owner answer are generated, not typed:
**[PROGRESS-REPORT.md](PROGRESS-REPORT.md)** is rewritten by `npm run report:progress`,
with the machine form in `progress-report.json`. Read that for the current position
against the 100-page goal; this page is hand-maintained and can fall behind it.

## Not verified

* Git state — Xcode licence blocks the only Git on the machine. No file was deleted.
* `npm run measure:js` — cannot run against a force-dynamic homepage. The budget itself is met, measured from the served page. Repairing the command changes what a named gate measures, so it is an owner decision.
* The `<details>` overflow disclosure and the `/areas/<slug>` template — written, never measured against a served page, because nothing passes the publication gate.
* Screen readers — structure verified, not audio behaviour.
* Real devices, Safari, Firefox — Chrome emulation only.
* Field performance — no traffic exists.
* Live search and AI-search visibility — no domain.
* Real lead delivery — no approved destination. Synthetic data throughout.
