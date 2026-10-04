import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND } from '@/config/constants';
import { assertPrototypeAccessAllowed } from '@/lib/prototype-guard';
import {
  PREVIEW_BLOCKING_CHECKLIST_ENTRIES,
  PREVIEW_RECORD_PARAM,
  PREVIEW_ROUTE_PATH,
  getRecordPreview,
  listPreviewableRecords,
} from '@/lib/record-preview';

/**
 * The preview surface for a record that has not passed the publication gate.
 *
 * Requirement 11.8: the workflow provides a surface for inspecting such a record,
 * the build returns 404 for it in every production build, and it appears in no
 * sitemap and in no link on a public page.
 *
 * ## How it is switched off
 *
 * Four separate mechanisms, because this page renders draft text and internal
 * blocking notes and Requirements 11.8 and 12.10 both say a reader must never see
 * them:
 *
 *  1. `assertPrototypeAccessAllowed()` — a genuine 404 in a production deployment,
 *     the same guard the design prototypes use.
 *  2. `dynamic = 'force-dynamic'` — evaluated per request, so the guard cannot be
 *     frozen into a prerendered page by a build that ran with another environment.
 *  3. `robots: { index: false, follow: false }` — `noindex` in every environment, so
 *     the preview cannot be indexed where it does answer.
 *  4. Absent from `getPublicRoutes`, and therefore from the sitemap, from `llms.txt`
 *     and from every navigation and footer link, all of which read that registry.
 *     `src/lib/public-routes.ts` records the exclusion by name so it is a decision
 *     rather than an omission.
 *
 * ## What unblocks the records it shows
 *
 * The surface itself waits on nothing. The records do:
 * `PREVIEW_BLOCKING_CHECKLIST_ENTRIES` names C1 / OWN-03 for confirmed coverage with
 * an accountable person, and C2 / OWN-14 for the three named reviewers. Today every
 * one of the 132 records fails the gate on both.
 */

export const metadata: Metadata = {
  title: `[INTERNAL PREVIEW] Unpublished record inspection — ${CANONICAL_BRAND}`,
  description:
    'Internal editorial preview of a locality record that has not passed the publication gate. Not public content.',
  robots: {
    index: false,
    follow: false,
  },
};

// Rendered per request so the production 404 guard cannot be frozen into a
// prerendered page by a build that ran with a different environment.
export const dynamic = 'force-dynamic';

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function InternalPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Internal editorial material: 404 in a production deployment.
  assertPrototypeAccessAllowed();

  const reference = firstValue((await searchParams)[PREVIEW_RECORD_PARAM]).trim();
  const preview = reference.length > 0 ? getRecordPreview(reference) : null;
  const index = listPreviewableRecords();

  return (
    <div>
      <h1>Internal preview: unpublished record inspection</h1>
      <p>
        This surface is internal editorial material. It returns 404 in a production deployment, it
        is registered on no public route, it is in no sitemap, and no public page links to it. It
        exists so a record can be read before release, not after.
      </p>
      <p>
        Records shown here are waiting on the owner register entries{' '}
        {PREVIEW_BLOCKING_CHECKLIST_ENTRIES.join(' and ')}.
      </p>

      {reference.length > 0 && !preview ? (
        <section aria-labelledby="preview-unknown-heading">
          <h2 id="preview-unknown-heading">No record carries that reference</h2>
          <p>
            Nothing in the registry carries the identifier or slug that was asked for. The list
            below is every record this surface can show.
          </p>
        </section>
      ) : null}

      {preview ? (
        <section aria-labelledby="preview-record-heading">
          <h2 id="preview-record-heading">
            {preview.canonicalName} ({preview.entityId})
          </h2>
          <p>
            {preview.passesGate
              ? 'This record passes the publication gate at the current date. Release is a separate batch decision.'
              : `This record does not pass the publication gate: ${preview.gateFailures.length} condition(s) are unmet.`}
          </p>

          <h3>Recorded state</h3>
          <dl>
            <dt>Route it would serve</dt>
            <dd>/areas/{preview.slug}</dd>
            <dt>Entity type</dt>
            <dd>{preview.entityType}</dd>
            <dt>Editorial state</dt>
            <dd>{preview.editorialStatus}</dd>
            <dt>Publication state</dt>
            <dd>{preview.publicationStatus}</dd>
            <dt>Operational coverage</dt>
            <dd>{preview.actualServiceCoverage}</dd>
            <dt>Accountable person</dt>
            <dd>{preview.coverageResponsibleOwner ?? 'none recorded'}</dd>
            <dt>Author</dt>
            <dd>{preview.author ?? 'none recorded'}</dd>
            <dt>Local reviewer</dt>
            <dd>{preview.localReviewer ?? 'none recorded'}</dd>
            <dt>SEO reviewer</dt>
            <dd>{preview.seoReviewer ?? 'none recorded'}</dd>
            <dt>Next review date</dt>
            <dd>{preview.nextReviewAt ?? 'none recorded'}</dd>
          </dl>

          <h3>Publication gate failures</h3>
          {preview.gateFailures.length === 0 ? (
            <p>None. Every gate condition is met at the current date.</p>
          ) : (
            <ol>
              {preview.gateFailures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ol>
          )}

          <h3>Content sections</h3>
          {preview.sections.length === 0 ? (
            <p>No content section is recorded on this record.</p>
          ) : (
            <ul>
              {preview.sections.map((section) => (
                <li key={section.sectionId}>
                  {section.heading} — {section.wordCount} words
                </li>
              ))}
            </ul>
          )}

          <h3>Claims the record depends on</h3>
          {preview.claimIds.length === 0 ? (
            <p>No claim is collected from this record.</p>
          ) : (
            <ul>
              {preview.claimIds.map((claimId) => (
                <li key={claimId}>{claimId}</li>
              ))}
            </ul>
          )}

          <h3>Internal blocking notes</h3>
          {preview.blockingNotes.length === 0 ? (
            <p>No blocking note is recorded on this record.</p>
          ) : (
            <ul>
              {preview.blockingNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section aria-labelledby="preview-index-heading">
        <h2 id="preview-index-heading">Records this surface can show ({index.length})</h2>
        <ul>
          {index.map((entry) => (
            <li key={entry.entityId}>
              <a href={`${PREVIEW_ROUTE_PATH}?${PREVIEW_RECORD_PARAM}=${entry.entityId}`}>
                {entry.canonicalName}
              </a>{' '}
              — {entry.editorialStatus},{' '}
              {entry.passesGate
                ? 'passes the gate'
                : `${entry.gateFailureCount} unmet gate condition(s)`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
