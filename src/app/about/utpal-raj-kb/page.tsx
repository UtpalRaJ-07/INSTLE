import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { OWNER_CONTACT_COPY, OWNER_INTRODUCTION, OWNER_PROFILE, hasApprovedBiography } from '@/config/owner';
import { buildPageMetadata } from '@/lib/metadata';
import { buildBreadcrumbNode, buildSiteGraph } from '@/lib/structured-data';
import { JsonLd } from '@/components/JsonLd/JsonLd';
import { OwnerPortrait } from '@/components/Photograph';
import {
  ActionRow,
  Breadcrumbs,
  CallButton,
  ContactBand,
  DetailList,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';

export const metadata: Metadata = buildPageMetadata({
  title: `${OWNER_PROFILE.name} — owner and CEO`,
  description: `${OWNER_INTRODUCTION} Call ${PRIMARY_PHONE} to discuss your property requirement with the team.`,
  path: OWNER_PROFILE.route,
});

/**
 * Owner and CEO profile.
 *
 * Contains exactly two supplied facts: the name and the role. There is no
 * portrait, because generating one would be fabricating evidence of a person, and
 * no approved photograph has been supplied. There is no biography section, and no
 * "coming soon" placeholder standing in for one.
 *
 * `<OwnerPortrait />` is the pathway for the one that may arrive: it reads
 * `OWNER_PROFILE.portrait`, and renders an element only when that entry is a
 * Media_Register photograph with complete provenance, an unexpired written release
 * naming Utpal Raj KB, and alt text naming him. With the entry null — checklist C7
 * unanswered — it renders nothing at all, which is what Requirement 10.9 requires:
 * no image element and no image placeholder. The text treatment below is therefore
 * the whole page today, and stays the whole page apart from the portrait once one
 * is recorded.
 *
 * When the owner supplies a biography or verified profile links, they go into
 * src/config/owner.ts and this page renders them.
 */
export default function OwnerProfilePage() {
  const breadcrumb = buildBreadcrumbNode([
    { name: 'Home', path: '/' },
    { name: `About ${CANONICAL_BRAND}`, path: '/about' },
    { name: OWNER_PROFILE.name, path: OWNER_PROFILE.route },
  ]);

  return (
    <>
      <JsonLd data={buildSiteGraph(breadcrumb ? [breadcrumb] : [])} />

      <div className="container" style={{ paddingTop: 'var(--space-6)' }}>
        <Breadcrumbs
          trail={[
            { label: 'Home', href: '/' },
            { label: 'About', href: '/about' },
            { label: OWNER_PROFILE.name },
          ]}
        />
      </div>

      <PageIntro
        eyebrow="Owner and CEO"
        titleId="owner-profile-heading"
        title={OWNER_PROFILE.name}
        lead={OWNER_INTRODUCTION}
      >
        <ActionRow>
          <CallButton />
          <SecondaryLink href="/contact">Contact us</SecondaryLink>
        </ActionRow>
      </PageIntro>

      <Section labelledBy="owner-detail-heading">
        <SectionHeader titleId="owner-detail-heading" eyebrow="Details" title="Role" />
        <OwnerPortrait />
        <DetailList
          items={[
            { key: 'Name', value: OWNER_PROFILE.name },
            { key: 'Role', value: OWNER_PROFILE.role },
            { key: 'Business', value: CANONICAL_BRAND },
            { key: 'Where', value: 'Bengaluru' },
            {
              key: 'Contact',
              value: OWNER_CONTACT_COPY,
            },
          ]}
        />
      </Section>

      {hasApprovedBiography() ? (
        <Section tone="raised" labelledBy="owner-bio-heading">
          <SectionHeader titleId="owner-bio-heading" eyebrow="Background" title={`About ${OWNER_PROFILE.name}`} />
          <Prose>
            {OWNER_PROFILE.biographyParagraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </Prose>
        </Section>
      ) : null}

      <ContactBand
        title="Speak to the team"
        text={`Call ${PRIMARY_PHONE} to discuss buying, selling, renting or renting out property in Bengaluru.`}
        enquiryHref="/about"
        enquiryLabel={`About ${CANONICAL_BRAND}`}
      />
    </>
  );
}
