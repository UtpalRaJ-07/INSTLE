import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CANONICAL_BRAND, CUSTOMER_INTENTS, PRIMARY_PHONE } from '@/config/constants';
import { buildPageMetadata } from '@/lib/metadata';
import {
  ActionRow,
  BulletList,
  CallButton,
  Callout,
  CalloutText,
  ContactBand,
  IntentCards,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
  SecondaryLink,
} from '@/components/ui';

export const metadata: Metadata = buildPageMetadata({
  title: 'How we work',
  description: `What happens when you contact ${CANONICAL_BRAND} about property in Bengaluru, what we do at each stage, and what we do not promise. Call ${PRIMARY_PHONE}.`,
  path: '/how-it-works',
});

export default function HowItWorksPage() {
  return (
    <>
      <PageIntro
        eyebrow="Our process"
        titleId="how-heading"
        title="How we work"
        lead="What happens after you get in touch, stage by stage, including the parts we cannot promise."
      >
        <ActionRow>
          <CallButton />
          <SecondaryLink href="/contact">Contact us</SecondaryLink>
        </ActionRow>
      </PageIntro>

      <Section labelledBy="how-stages-heading">
        <SectionHeader
          titleId="how-stages-heading"
          eyebrow="Stage by stage"
          title="The whole thing, honestly"
        />
        <Prose>
          <h3>1. You tell us what you need</h3>
          <p>
            By phone, or by sending the details from the page that matches what you want to do. We ask
            for as little as we can get away with: property type, area, roughly what you can spend or
            expect, when, and a number.
          </p>
          <h3>2. We talk it through</h3>
          <p>
            This is the part that matters. We go through the areas you are considering, whether the
            budget works in them, and what is likely to get in the way. If your expectation is
            difficult, this is where you hear it.
          </p>
          <h3>3. We coordinate the next step</h3>
          <p>
            Reaching the other side, arranging visits at times that actually happen, and going through
            terms before anyone commits to anything. Most of the value is in the logistics.
          </p>
          <h3>4. We tell you where it stands</h3>
          <p>
            What we did, what came back, and what we think should change if it is not moving. Including
            when the answer is that nothing has happened.
          </p>
          <h3>5. Closing</h3>
          <p>
            We handle the brokerage side and coordinate with the independent professionals involved in
            the paperwork. We are not those professionals, and we will not pretend to be.
          </p>
        </Prose>
      </Section>

      <Section tone="raised" labelledBy="how-not-heading">
        <SectionHeader
          titleId="how-not-heading"
          eyebrow="Limits"
          title="What we do not do"
          lead="Shorter than the list of what we do, and more useful to read."
        />
        <Prose>
          <BulletList
            items={[
              'We do not guarantee a sale, a purchase, a tenant, or a date. Nobody can.',
              'We do not value property, and there is no instant-valuation tool on this site.',
              'We do not give legal, tax or financial advice, and we do not certify that paperwork is in order.',
              'We do not arrange home loans or assess what you can borrow.',
              'We do not run background checks on tenants or describe our filtering conversation as verification.',
              'We do not publish your details, your address, or photographs of your property.',
              'We do not promise a response time, because we have not staffed one yet.',
            ]}
          />
        </Prose>
        <Callout title="On response times">
          <CalloutText>
            A response-time promise we have not resourced would just be marketing. When we publish
            one, it will say who is responsible for meeting it. Until then, calling{' '}
            {PRIMARY_PHONE} is the fastest route.
          </CalloutText>
        </Callout>
      </Section>

      <Section labelledBy="how-portal-heading">
        <SectionHeader
          titleId="how-portal-heading"
          eyebrow="Fair question"
          title="Why not just use a listings portal?"
        />
        <Prose>
          <p>
            Use one. They are useful, and they will show you more property than we ever will. What they
            will not do is tell you that the two-bedroom flat you liked backs onto a road that floods,
            or call the owner for the fourth time, or say out loud that your budget does not work in
            the area you have set your heart on.
          </p>
          <p>
            A portal is a search problem. A broker is a judgement and coordination problem. Most people
            end up needing both.
          </p>
        </Prose>
      </Section>

      <Section tone="raised" labelledBy="how-start-heading">
        <SectionHeader titleId="how-start-heading" eyebrow="Start here" title="What would you like to do?" />
        <IntentCards intents={CUSTOMER_INTENTS} />
        <Prose>
          <p style={{ marginTop: 'var(--space-6)' }}>
            Commercial property is on the <Link href="/commercial">commercial page</Link>.
          </p>
        </Prose>
      </Section>

      <ContactBand
        title="Still not sure where to start?"
        text={`Call ${PRIMARY_PHONE} and describe it in your own words. We will work out which of these it is.`}
      />
    </>
  );
}
