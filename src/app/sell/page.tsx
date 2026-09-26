import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';

export default function SellPage() {
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
        Owner Representation
      </span>
      <h1 style={{ fontSize: 'var(--font-size-h1)', margin: 'var(--space-4) 0' }}>
        Property Representation with {CANONICAL_BRAND}
      </h1>
      <p
        style={{
          fontSize: 'var(--font-size-body-large)',
          color: 'var(--color-text-muted)',
          maxWidth: 'var(--reading-measure)',
          marginBottom: 'var(--space-6)',
        }}
      >
        Property owners can share property basics to request a direct conversation with the
        brokerage team. We discuss representation terms, property parameters, and realistic
        next steps. To discuss your property, connect with our team by phone.
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
        <span aria-hidden="true">☎</span> Contact Brokerage Team: {PRIMARY_PHONE}
      </a>
    </div>
  );
}
