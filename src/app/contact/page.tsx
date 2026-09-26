import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';

export default function ContactPage() {
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
        Direct Communications
      </span>
      <h1 style={{ fontSize: 'var(--font-size-h1)', margin: 'var(--space-4) 0' }}>
        Connect with {CANONICAL_BRAND}
      </h1>
      <p
        style={{
          fontSize: 'var(--font-size-body-large)',
          color: 'var(--color-text-muted)',
          maxWidth: 'var(--reading-measure)',
          marginBottom: 'var(--space-6)',
        }}
      >
        For inquiries regarding Bengaluru property requirements or advisory services, contact our
        team directly by telephone. Online enquiry routing will be introduced in subsequent
        milestones.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: '400px' }}>
        <div style={{ padding: 'var(--space-4)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', backgroundColor: 'var(--color-white)' }}>
          <span style={{ fontSize: 'var(--font-size-label)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 'var(--space-1)' }}>
            Primary Contact Phone:
          </span>
          <a
            href={PRIMARY_PHONE_TEL}
            style={{
              fontSize: 'var(--font-size-h3)',
              fontWeight: 600,
              color: 'var(--color-forest)',
              textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {PRIMARY_PHONE}
          </a>
        </div>
      </div>
    </div>
  );
}
