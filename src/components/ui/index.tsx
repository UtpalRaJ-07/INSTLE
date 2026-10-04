/**
 * Shared server-rendered building blocks for the public site.
 *
 * Everything here renders on the server. Nothing is a client component, so the
 * homepage and content pages ship no JavaScript for layout, headings or links —
 * which is what keeps the script budget available for the enquiry form.
 */

import React from 'react';
import Link from 'next/link';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './ui.module.css';

type SectionTone = 'paper' | 'raised' | 'forest';

const TONE_CLASS: Record<SectionTone, string> = {
  paper: styles.sectionPaper,
  raised: styles.sectionRaised,
  forest: styles.sectionForest,
};

export function Section({
  children,
  tone = 'paper',
  tight = false,
  labelledBy,
  id,
}: {
  children: React.ReactNode;
  tone?: SectionTone;
  tight?: boolean;
  labelledBy?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${tight ? styles.sectionTight : styles.section} ${TONE_CLASS[tone]}${
        tone === 'forest' ? ' surface-night' : ''
      }`}
    >
      <div className="container reveal">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  titleId,
  lead,
  headingLevel = 2,
}: {
  eyebrow?: string;
  title: string;
  titleId: string;
  lead?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.sectionHeader}>
      {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
      <Heading id={titleId}>{title}</Heading>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </div>
  );
}

/** Page-level intro block containing the single H1. */
export function PageIntro({
  eyebrow,
  title,
  titleId,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  titleId: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={`${styles.pageIntro} surface-night`} aria-labelledby={titleId}>
      <div className="container">
        <div className={styles.pageIntroInner}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          <h1 id={titleId}>{title}</h1>
          {lead ? <p className={styles.lead}>{lead}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return <div className={styles.prose}>{children}</div>;
}

export function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className={styles.bulletList}>
      {items.map((item) => (
        <li key={item} className={styles.bulletItem}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function CardGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div className={`${styles.cardGrid} ${columns === 3 ? styles.cardGridThree : ''}`}>
      {children}
    </div>
  );
}

export function Card({
  title,
  titleId,
  children,
}: {
  title: string;
  titleId?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.cardTitle}>
        {title}
      </h3>
      <div className={styles.cardText}>{children}</div>
    </article>
  );
}

export function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.actionRow}>{children}</div>;
}

export function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={styles.buttonPrimary}>
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={styles.buttonSecondary}>
      {children}
    </Link>
  );
}

/**
 * The call action.
 *
 * Always renders the canonical digits and the exact `tel:9353096264` link. The
 * accessible name spells out that it starts a phone call, because "9353096264"
 * alone is read as a digit string with no context.
 */
export function CallButton({ variant = 'primary' }: { variant?: 'primary' | 'secondary' | 'onDark' }) {
  const className =
    variant === 'onDark'
      ? styles.buttonOnDark
      : variant === 'secondary'
        ? styles.buttonSecondary
        : styles.buttonPrimary;
  return (
    <a href={PRIMARY_PHONE_TEL} className={className}>
      Call {PRIMARY_PHONE}
    </a>
  );
}

/** Inline phone link for use inside a sentence. */
export function PhoneInline() {
  return (
    <a href={PRIMARY_PHONE_TEL} className={styles.phoneInline}>
      {PRIMARY_PHONE}
    </a>
  );
}

export function Callout({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.callout}>
      {title ? <h3 className={styles.calloutTitle}>{title}</h3> : null}
      <div>{children}</div>
    </div>
  );
}

export function CalloutText({ children }: { children: React.ReactNode }) {
  return <p className={styles.calloutText}>{children}</p>;
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ trail }: { trail: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
      <ol className={styles.breadcrumbList}>
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${crumb.label}-${index}`}>
              {crumb.href && !isLast ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <span className={styles.breadcrumbCurrent} aria-current="page">
                  {crumb.label}
                </span>
              )}
              {!isLast ? (
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                  {' '}
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Closing contact band. One heading, one explanation, two actions. */
export function ContactBand({
  title,
  text,
  enquiryHref,
  enquiryLabel,
}: {
  title: string;
  text: string;
  enquiryHref?: string;
  enquiryLabel?: string;
}) {
  const headingId = 'contact-band-heading';
  return (
    <section className={`${styles.contactBand} surface-night`} aria-labelledby={headingId}>
      <div className={`container reveal ${styles.contactBandInner}`}>
        <div>
          <h2 id={headingId} className={styles.contactBandTitle}>
            {title}
          </h2>
          <p className={styles.contactBandText}>{text}</p>
        </div>
        <div className={styles.contactBandActions}>
          <CallButton variant="onDark" />
          {enquiryHref && enquiryLabel ? (
            <Link href={enquiryHref} className={styles.buttonSecondary}>
              {enquiryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function DetailList({
  items,
}: {
  items: readonly { key: string; value: React.ReactNode }[];
}) {
  return (
    <dl className={styles.detailList}>
      {items.map((item) => (
        <div key={item.key} className={styles.detailRow}>
          <dt className={styles.detailKey}>{item.key}</dt>
          <dd className={styles.detailValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <h2 className={styles.emptyStateTitle}>{title}</h2>
      {children}
    </div>
  );
}

export function EmptyStateText({ children }: { children: React.ReactNode }) {
  return <p className={styles.emptyStateText}>{children}</p>;
}

/**
 * A list of link cards. A `<ul>`, because a set of destinations is a list, and a
 * screen reader announces how many there are before reading the first.
 *
 * `group` names the Internal_Link_System group the list renders, when it renders
 * one, so a test can find the group without depending on its heading wording.
 */
export function LinkCardGrid({ children, group }: { children: React.ReactNode; group?: string }) {
  return (
    <ul className={styles.linkCardGrid} data-link-group={group}>
      {children}
    </ul>
  );
}

/**
 * One destination: the link, and any context beside it.
 *
 * Only the title is inside the anchor. The description sits in the same list item
 * but outside the link, so the link text is the destination's name and nothing
 * else — 2 to 80 characters that say where it goes (Requirement 8.2) — while the
 * context stays next to it for the reader (Requirement 8.11). The whole card is
 * still one click target: the anchor's `::after` covers the card.
 */
export function LinkCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className={styles.linkCard}>
      <Link href={href} className={styles.linkCardLink}>
        <span className={styles.linkCardTitle}>{title}</span>
      </Link>
      {children ? <p className={styles.linkCardText}>{children}</p> : null}
    </li>
  );
}

/** The four customer intents as navigation. Not property cards. */
export function IntentCards({
  intents,
}: {
  intents: readonly { intent: string; actionLabel: string; audience: string; href: string }[];
}) {
  return (
    <div className={styles.intentGrid}>
      {intents.map((item) => (
        <Link key={item.intent} href={item.href} className={styles.intentCard}>
          <span className={styles.intentCardLabel}>{item.actionLabel}</span>
          <span className={styles.intentCardAudience}>{item.audience}</span>
          <span className={styles.intentCardArrow} aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
