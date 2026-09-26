import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';

export default function RentPage() {
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
        Tenant Advisory
      </span>
      <h1 style={{ fontSize: 'var(--font-size-h1)', margin: 'var(--space-4) 0' }}>
        Rent Property in Bengaluru
      </h1>
      <p
        style={{
          fontSize: 'var(--font-size-body-large)',
          color: 'var(--color-text-muted)',
          maxWidth: 'var(--reading-measure)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Share your rental timeline, preferred localities, and space requirements with {CANONICAL_BRAND}.
        Our brokerage team assists tenants in reviewing realistic rental options and discussing
        relevant next steps. To discuss your requirement, connect with our team directly by phone.
      </p>
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
        <span aria-hidden="true">☎</span> Speak with Our Team: {PRIMARY_PHONE}
      </a>
    </div>
  );
}
