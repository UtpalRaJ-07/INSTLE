import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, PRIMARY_PHONE } from '@/config/constants';
import { OWNER_PROFILE } from '@/config/owner';
import { GEOGRAPHIC_COVERAGE_STATEMENT } from '@/config/service-matrix';
import { getReviewDisplayState } from '@/config/reviews';
import { buildPageMetadata } from '@/lib/metadata';
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

export const metadata: Metadata = buildPageMetadata({
  title: `About ${CANONICAL_BRAND}`,
  description: `${CANONICAL_BRAND} is a real estate brokerage in Bengaluru working with buyers, sellers, tenants and landlords. Call ${PRIMARY_PHONE}.`,
  path: '/about',
});

export default function AboutPage() {
  const reviews = getReviewDisplayState();

  return (
    <>
      <PageIntro
        eyebrow="About us"
        titleId="about-heading"
        title={`About ${CANONICAL_BRAND}`}
        lead="A real estate brokerage in Bengaluru, working with people buying, selling, renting and renting out property."
      />

      <Section labelledBy="about-what-heading">
        <SectionHeader
          titleId="about-what-heading"
          eyebrow="What we are"
          title="A brokerage, not a portal"
        />
        <Prose>
          <p>
            {CANONICAL_BRAND} helps people buy, sell, rent and rent out residential property in
            Bengaluru — flats, independent houses, villas and sites. You tell us what you need, we
            talk it through, and we work on it with you.
          </p>
          <p>
            There is no catalogue on this website. That is deliberate. Property portals already exist
            and they do that job. What they do not do is tell you which of those listings is worth
            your time, or call the owner back for the fourth time.
          </p>
          <p>{GEOGRAPHIC_COVERAGE_STATEMENT}</p>
        </Prose>
      </Section>

      <Section tone="raised" labelledBy="about-how-heading">
        <SectionHeader
          titleId="about-how-heading"
          eyebrow="How we work"
          title="Three things we hold ourselves to"
        />
        <Prose>
          <h3>We do not invent inventory</h3>
          <p>
            No sample listings, no placeholder prices, no &ldquo;buyers waiting&rdquo; counters. If we
            do not have something that fits, we say so.
          </p>
          <h3>We say when we do not know</h3>
          <p>
            Local knowledge is genuinely useful, and it is also the easiest thing in this business to
            fake. When we are not sure about a ward boundary, a road plan or a project status, we say
            we are not sure rather than sound confident about it.
          </p>
          <h3>We do not pass your details on</h3>
          <p>
            Your phone number is used by our team to talk to you about your requirement. We do not
            sell contact details, and we do not hand them to third parties for marketing.
          </p>
        </Prose>
      </Section>

      <Section labelledBy="about-limits-heading">
        <SectionHeader
          titleId="about-limits-heading"
          eyebrow="Being straight with you"
          title="What we have not published"
        />
        <Prose>
          <p>
            There are things a brokerage website usually has that this one does not, and it is worth
            saying why rather than leaving gaps.
          </p>
          <BulletList
            items={[
              'No customer count, transaction volume, or years-in-business figure. We have not published numbers we cannot evidence.',
              'No awards, rankings, or “most trusted” claims.',
              'No star rating or review count. We would rather show nothing than something invented.',
              'No office address or business hours on the site yet.',
              'No registration or certification claims.',
              'No brokerage fee percentage, because the wording has not been settled.',
            ]}
          />
          <p>
            These will appear as they become real and checkable. Until then, the phone number and a
            conversation are what we have to offer, and both are genuine.
          </p>
        </Prose>
        {!reviews.hasApprovedReviews ? (
          <Callout title="On reviews">
            <CalloutText>
              We have not published any customer reviews. When customers do leave them, we will show
              the actual ones, with their permission, and the actual number of them.
            </CalloutText>
          </Callout>
        ) : null}
      </Section>

      <Section tone="raised" labelledBy="about-owner-heading">
        <SectionHeader
          titleId="about-owner-heading"
          eyebrow="Who runs this"
          title={`${OWNER_PROFILE.name}, ${'owner and CEO'}`}
        />
        <Prose>
          <p>
            {OWNER_PROFILE.name} is the owner and CEO of {CANONICAL_BRAND}.
          </p>
          <p>
            <Link href={OWNER_PROFILE.route}>More about {OWNER_PROFILE.name}</Link>
          </p>
        </Prose>
        <ActionRow>
          <CallButton />
          <SecondaryLink href="/contact">Contact us</SecondaryLink>
        </ActionRow>
      </Section>

      <ContactBand
        title="Want to talk to us?"
        text={`Call ${PRIMARY_PHONE}. That reaches our team directly.`}
        enquiryHref="/how-it-works"
        enquiryLabel="How we work"
      />
    </>
  );
}
