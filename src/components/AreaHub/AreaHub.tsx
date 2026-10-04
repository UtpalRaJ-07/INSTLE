/**
 * The area hub's browsing structure: the grouped directory and the empty state.
 *
 * Presentational only. It never reads the registry, the clock or the publication
 * gate. `src/app/areas/page.tsx` asks the gate — `getPublishedLocalities(now)` —
 * hands the result to `groupPublishedLocalities`, and passes the groups in. One
 * gate, one place that decides visibility, and a component a test can drive with
 * any set of groups. Requirements 1.3 and 2.5.
 *
 * Everything renders on the server. The overflow links sit inside a native
 * `<details>` element, so they are in the first HTML response, reachable by a
 * crawler that runs no JavaScript, and cost no script. Requirements 2.3 and 2.6.
 *
 * `marketingGroup` is rendered here as a heading and nowhere else: it is a
 * browsing label, carried next to a note that says so, and it never reaches page
 * metadata or structured data. Requirement 1.6.
 */

import React from 'react';
import Link from 'next/link';
import { CANONICAL_BRAND } from '@/config/constants';
import type { LocalityGroup, LocalityLink } from '@/lib/locality-grouping';
import {
  ActionRow,
  BulletList,
  CallButton,
  EmptyState,
  EmptyStateText,
  Section,
  SectionHeader,
} from '@/components/ui';
import styles from './AreaHub.module.css';

/**
 * Requirement 2.4. Rendered beside every group heading.
 *
 * Requirement 2.8 forbids a ward number, zone name, PIN code or municipal term in
 * a group heading or note. This sentence names those categories only to deny that
 * the grouping is one of them.
 */
export const BROWSING_AID_NOTE =
  'This grouping is how INSTLE REAL ESTATE organises areas for browsing. It is not a municipal, ward, zone or postal boundary.';

/**
 * Requirement 2.1. The four conditions the empty state names, in customer terms.
 *
 * They describe what the gate checks without claiming to be all of it: the gate
 * also requires editorial approval and real content, so the copy around this list
 * says a guide must meet each of these, not that meeting them is enough.
 */
export const AREA_PUBLICATION_CONDITIONS: readonly string[] = [
  'At least two independent sources, from different publishers, behind every claim the guide makes.',
  'A named reviewer who has checked it, with a recheck date that has not yet passed.',
  'Confirmed operational coverage: we have confirmed that we actually work in that area.',
  `A named person at ${CANONICAL_BRAND} who is accountable for serving that area.`,
];

const LIST_HEADING_ID = 'areas-list-heading';

function areaHref(slug: string): string {
  return `/areas/${slug}`;
}

/**
 * One list of area links. The link text is the locality name, verbatim.
 *
 * `prefetch={false}` because a directory can hold a hundred links and prefetching
 * every one in view is traffic nobody asked for. The link is a plain `<a href>` in
 * the server HTML either way.
 */
function AreaLinkList({ links }: { links: readonly LocalityLink[] }) {
  return (
    <ul className={styles.linkList}>
      {links.map((link) => (
        <li key={link.slug} className={styles.linkItem}>
          <Link href={areaHref(link.slug)} prefetch={false} className={styles.link}>
            {link.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AreaGroup({ group, headingId }: { group: LocalityGroup; headingId: string }) {
  const overflowCount = group.overflowLinks.length;
  return (
    <div className={styles.group}>
      <h3 id={headingId} className={styles.groupHeading}>
        {group.marketingGroup}
      </h3>
      <p className={styles.groupNote}>{BROWSING_AID_NOTE}</p>
      <AreaLinkList links={group.visibleLinks} />
      {overflowCount > 0 ? (
        // Closed by default, so the visible list stays at 25; every remaining
        // link is still in this HTML response. Requirement 2.3.
        <details className={styles.overflowGroup}>
          <summary className={styles.overflowSummary}>
            {overflowCount} more in {group.marketingGroup}
          </summary>
          <AreaLinkList links={group.overflowLinks} />
        </details>
      ) : null}
    </div>
  );
}

/** Requirements 2.2 to 2.4 and 2.6. One heading per group, in the order given. */
export function AreaHubDirectory({ groups }: { groups: readonly LocalityGroup[] }) {
  return (
    <Section labelledBy={LIST_HEADING_ID}>
      <SectionHeader
        titleId={LIST_HEADING_ID}
        eyebrow="Area guides"
        title="Area guides we have published"
      />
      <div className={styles.groups}>
        {groups.map((group, index) => (
          <AreaGroup key={group.marketingGroup} group={group} headingId={`area-group-${index + 1}`} />
        ))}
      </div>
    </Section>
  );
}

/** Requirement 2.1. Shown while no locality record passes the gate. */
export function AreaHubEmptyState() {
  return (
    <Section>
      <EmptyState title="No area guide is published yet">
        <EmptyStateText>
          Before an area guide appears on this page, it has to meet each of these conditions:
        </EmptyStateText>
        <div className={styles.conditions}>
          <BulletList items={AREA_PUBLICATION_CONDITIONS} />
        </div>
        <EmptyStateText>
          None has cleared our checks yet, so this page lists no areas.
        </EmptyStateText>
        <EmptyStateText>
          We had four area guides here before. We took them down, because when we checked the
          evidence behind them it was not good enough: ward numbers and metro project statuses sourced
          from organisation homepages rather than the actual notifications, a commute time nobody had
          measured, and a review sign-off attributed to a &ldquo;research desk&rdquo; that does not
          exist.
        </EmptyStateText>
        <ActionRow>
          <CallButton />
        </ActionRow>
      </EmptyState>
    </Section>
  );
}

/**
 * The hub's list section: the grouped directory when any group exists, the empty
 * state otherwise. `groupPublishedLocalities` drops empty groups, so an empty
 * array means no record passed the gate.
 */
export function AreaHub({ groups }: { groups: readonly LocalityGroup[] }) {
  return groups.length > 0 ? <AreaHubDirectory groups={groups} /> : <AreaHubEmptyState />;
}
