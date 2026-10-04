import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { getOfferedAssetTypes } from '@/config/service-matrix';
import { serviceLinkGroups } from '@/lib/internal-links';
import { buildPageMetadata } from '@/lib/metadata';
import { buildServiceGraph, type ServiceIntro } from '@/lib/structured-data';
import { EnquirySection } from '@/components/EnquiryForm/EnquirySection';
import { JsonLd } from '@/components/JsonLd/JsonLd';
import { RelatedLinks } from '@/components/RelatedLinks/RelatedLinks';
import {
  ActionRow,
  BulletList,
  CallButton,
  Callout,
  CalloutText,
  ContactBand,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';
import { CivicStreetscapeBand } from '@/components/Bengaluru';

export const metadata: Metadata = buildPageMetadata({
  title: 'Rent out your property in Bengaluru',
  description: `Putting a flat, house or villa on rent in Bengaluru? Tell ${CANONICAL_BRAND} about the property and when it is available, or call ${PRIMARY_PHONE}.`,
  path: '/rent-out',
});

/**
 * Rendered per request. The page lists the published guides for its intent, so it
 * shows what the gate admits at the date of the request (Requirement 1.3);
 * prerendered, it would keep linking a guide after its review date passed and its
 * own page began returning 404 — the disagreement Property 2 rules out. Adds no
 * client JavaScript.
 */
export const dynamic = 'force-dynamic';

/** The `<h1>` and lead, rendered once and read by the Service node verbatim. */
const INTRO: ServiceIntro = {
  title: 'Rent out your property in Bengaluru',
  lead: 'Tell us what the property is, where it is, and when someone could actually move in.',
  path: '/rent-out',
};

export default function RentOutPage() {
  const assetTypes = getOfferedAssetTypes('rent-out');

  return (
    <>
      <JsonLd data={buildServiceGraph(INTRO)} />

      <PageIntro eyebrow="Landlords" titleId="rent-out-heading" title={INTRO.title} lead={INTRO.lead}>
        <ActionRow>
          <CallButton />
          <SecondaryLink href="#enquiry">Send property details</SecondaryLink>
        </ActionRow>
      </PageIntro>

      {/*
        The Bengaluru element, Requirement 9.2. The cropped variant of the street
        drawing: one house with a monkey-top window, a rain tree and a compound
        gate. Labelled an illustration in the figure's own caption.
      */}
      <Section tight>
        <CivicStreetscapeBand variant="cropped" />
      </Section>

      <Section labelledBy="rent-out-decide-heading">
        <SectionHeader
          titleId="rent-out-decide-heading"
          eyebrow="Before it goes on rent"
          title="Four decisions worth making first"
          lead="These four answers shape everything that follows, and changing them halfway through is where most of the friction comes from."
        />
        <Prose>
          <h3>Rent and deposit</h3>
          <p>
            Decide both, and decide which of the two you have room to move on. A firm rent with a
            flexible deposit behaves very differently from the other way round.
          </p>
          <h3>Furnished, semi-furnished or unfurnished</h3>
          <p>
            Be specific about appliances and what you are taking with you. That is where most
            disagreements start, usually at handover.
          </p>
          <h3>When it is genuinely available</h3>
          <p>
            Availability means the date someone could move in, after painting, cleaning and repairs.
            An optimistic date creates a problem for you, not for us.
          </p>
          <h3>Who handles it day to day</h3>
          <p>
            Decide who the tenant calls about a leaking tap and who holds keys. If you are not in
            Bengaluru, settle this before anyone moves in.
          </p>
        </Prose>
      </Section>

      {/* This is the section the old copy got wrong. Stated plainly instead. */}
      <Section tone="raised" labelledBy="rent-out-tenants-heading">
        <SectionHeader
          titleId="rent-out-tenants-heading"
          eyebrow="Tenants"
          title="What we do about tenants, stated plainly"
        />
        <Prose>
          <p>
            We speak to prospective tenants about their requirement and budget before arranging a
            visit, so you are not showing your property to people it clearly does not suit. That is a
            filtering conversation, and it is worth having.
          </p>
          <p>
            It is not a background check, a credit check, an employment check, or a verification
            service, and we do not describe it as one. If you want formal verification of a tenant,
            that is a separate service from a separate provider and you should arrange it
            deliberately rather than assume it has happened.
          </p>
          <p>
            We also do not filter people by occupation, community, family status, or where they are
            from, and we will not take a brief to do so.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="rent-out-privacy-heading">
        <SectionHeader titleId="rent-out-privacy-heading" eyebrow="Your details" title="What we do not publish" />
        <Callout>
          <CalloutText>
            We do not post your phone number, your exact address, or photographs of your property on
            public classified portals as part of this service.
          </CalloutText>
          <CalloutText>
            If you want the property advertised publicly, that is a separate decision for you to make
            deliberately, and we will tell you what it involves rather than do it quietly.
          </CalloutText>
        </Callout>
      </Section>

      <Section tone="raised" labelledBy="rent-out-types-heading">
        <SectionHeader titleId="rent-out-types-heading" eyebrow="Property types" title="What we handle" />
        <Prose>
          <BulletList items={assetTypes.map((asset) => asset.label)} />
          <p>
            Selling instead of renting out? That is the <Link href="/sell">sell page</Link>. Leasing
            out commercial space is on the <Link href="/commercial">commercial page</Link>.
          </p>
        </Prose>
      </Section>

      <EnquirySection intent="rent-out" />

      <RelatedLinks groups={serviceLinkGroups('rent-out')} idPrefix="rent-out" tone="paper" />

      <ContactBand
        title="Rather just talk?"
        text={`Call ${PRIMARY_PHONE} and tell us about the property and when it is free.`}
      />
    </>
  );
}
