import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { ProcessSteps } from '@/components/ProcessSteps/ProcessSteps';

export default function HowItWorksPage() {
  return (
    <div className="container" style={{ padding: 'var(--section-rhythm) 0' }}>
      <span
        style={{
          fontSize: 'var(--font-size-label)',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--color-forest)',
        }}
      >
        Advisory Methodology
      </span>
      <h1 style={{ fontSize: 'var(--font-size-h1)', margin: 'var(--space-4) 0' }}>
        How {CANONICAL_BRAND} Operates
      </h1>
      <p
        style={{
          fontSize: 'var(--font-size-body-large)',
          color: 'var(--color-text-muted)',
          maxWidth: 'var(--reading-measure)',
          marginBottom: 'var(--space-8)',
        }}
      >
        We connect people with a considered, human brokerage process rather than an unverified
        property catalogue. Here is how our requirement engagement works from initial contact to
        coordinated discussions.
      </p>

      <ProcessSteps />

      <div style={{ marginTop: 'var(--space-12)' }}>
        <a
          href={PRIMARY_PHONE_TEL}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            backgroundColor: 'var(--color-forest)',
            color: 'var(--color-paper)',
            padding: 'var(--space-3) var(--space-6)',
            borderRadius: 'var(--radius-control)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <span aria-hidden="true">☎</span> Direct Consultation: {PRIMARY_PHONE}
        </a>
      </div>
    </div>
  );
}
