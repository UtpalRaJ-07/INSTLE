import React from 'react';
import type { CustomerIntent } from '@/config/constants';
import { isRealIntakeEnabled } from '@/config/site';
import { EnquiryForm } from './EnquiryForm';

/**
 * Server wrapper for the enquiry form.
 *
 * Resolves intake mode and the approved consent wording on the server, so the
 * client cannot switch real submission on, and so a build with no approved
 * destination renders the call-only panel rather than a data-collecting form.
 */
export function EnquirySection({ intent }: { intent: CustomerIntent }) {
  const consentNoticeText = process.env.INSTLE_CONSENT_NOTICE_TEXT?.trim() || null;

  return (
    <EnquiryForm
      intent={intent}
      intakeEnabled={isRealIntakeEnabled()}
      consentNoticeText={consentNoticeText}
    />
  );
}
