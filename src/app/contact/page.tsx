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
          marginBottom: 'var(--space-8)',
        }}
      >
        To discuss property requirements or property representation in Bengaluru, connect
        directly with {CANONICAL_BRAND} by telephone.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          maxWidth: '440px',
        }}
      >
        <div
          style={{
            padding: 'var(--space-6)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-control)',
            backgroundColor: 'var(--color-white)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-label)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: 'var(--space-2)',
            }}
          >
            Primary Business Phone:
          </span>
          <a
            href={PRIMARY_PHONE_TEL}
            style={{
              fontSize: 'var(--font-size-h3)',
              fontWeight: 700,
              color: 'var(--color-forest)',
              textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            {PRIMARY_PHONE}
          </a>
          <p
            style={{
              fontSize: 'var(--font-size-small)',
              color: 'var(--color-text-muted)',
              marginTop: 'var(--space-2)',
            }}
          >
            Direct telephone connection to the {CANONICAL_BRAND} brokerage team.
          </p>
        </div>
      </div>
    </div>
  );
}
