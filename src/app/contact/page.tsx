import React from 'react';
import type { Metadata } from 'next';
import { CANONICAL_BRAND, CUSTOMER_INTENTS, PRIMARY_PHONE } from '@/config/constants';
import { isRealIntakeEnabled } from '@/config/site';
import { buildPageMetadata } from '@/lib/metadata';
import {
  ActionRow,
  BulletList,
  CallButton,
  Callout,
  CalloutText,
  ContactBand,
  IntentCards,
  LinkCard,
  LinkCardGrid,
  PageIntro,
  Prose,
  Section,
  SectionHeader,
} from '@/components/ui';

export const metadata: Metadata = buildPageMetadata({
  title: 'Contact us',
  description: `Call ${CANONICAL_BRAND} on ${PRIMARY_PHONE} to discuss buying, selling, renting or renting out property in Bengaluru.`,
  path: '/contact',
});

export default function ContactPage() {
  const intakeEnabled = isRealIntakeEnabled();

  return (
    <>
      <PageIntro
        eyebrow="Contact"
        titleId="contact-heading"
        title="Talk to us about your property requirement"
        lead={`The phone is the direct route. Call ${PRIMARY_PHONE} and tell us what you need.`}
      >
        <ActionRow>
          <CallButton />
        </ActionRow>
      </PageIntro>

      <Section labelledBy="contact-phone-heading">
        <SectionHeader
          titleId="contact-phone-heading"
          eyebrow="By phone"
          title={PRIMARY_PHONE}
          lead="This reaches our team. It is the number to use for anything — buying, selling, renting, renting out, or just working out whether we are the right people to ask."
        />
        <Prose>
          <p>
            Handy to have ready: what kind of property, which area, roughly what you can spend or
            expect, and when. None of it has to be settled.
          </p>
          <p>
            We have not published business hours yet, because we are not going to advertise hours we
            have not committed to staffing. If a call is not answered, try again — there is no queue
            system swallowing it.
          </p>
        </Prose>
        <Callout title="About this number">
          <CalloutText>
            {PRIMARY_PHONE} is our business phone line. We have not set up messaging or chat on it, so
            please do not expect a reply to a message sent to it.
          </CalloutText>
        </Callout>
      </Section>

      <Section tone="raised" labelledBy="contact-online-heading">
        <SectionHeader
          titleId="contact-online-heading"
          eyebrow="Online"
          title={intakeEnabled ? 'Send your details instead' : 'The online form is not switched on yet'}
          lead={
            intakeEnabled
              ? 'Pick the page that matches what you want to do. Each one asks only what is relevant.'
              : 'We would rather say that plainly than take your details with nowhere proper to put them. The pages below explain what to have ready for a call.'
          }
        />
        <IntentCards intents={CUSTOMER_INTENTS} />
        <LinkCardGrid>
          <LinkCard href="/commercial" title="Commercial property">
            Office, shop, warehouse or industrial. We will say whether we can help.
          </LinkCard>
          <LinkCard href="/how-it-works" title="How we work">
            What happens at each stage, and what we do not promise.
          </LinkCard>
        </LinkCardGrid>
      </Section>

      <Section labelledBy="contact-privacy-heading">
        <SectionHeader
          titleId="contact-privacy-heading"
          eyebrow="Your details"
          title="What happens to what you tell us"
        />
        <Prose>
          <BulletList
            items={[
              'Your name and number are used by our team to talk to you about your requirement.',
              'We do not sell contact details or pass them to third parties for marketing.',
              'We do not publish your requirement, your address, or photographs of your property.',
              'If you ask us to stop contacting you, we stop.',
            ]}
          />
          <p>
            A full privacy notice is not published on this site yet. We are not going to put up legal
            wording that has not been properly drawn up. Until it is there, the four points above are
            what we do, and you are welcome to ask about any of it on the phone.
          </p>
        </Prose>
      </Section>

      <ContactBand
        title={`Call ${PRIMARY_PHONE}`}
        text="One number, our team, no hold menu."
        enquiryHref="/how-it-works"
        enquiryLabel="How we work"
      />
    </>
  );
}
