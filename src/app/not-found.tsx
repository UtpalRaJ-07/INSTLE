import React from 'react';
import Link from 'next/link';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';

export default function NotFound() {
  return (
    <div className="container" style={{ padding: 'var(--section-rhythm) 0', textAlign: 'center' }}>
      <h1 style={{ fontSize: 'var(--font-size-display)', marginBottom: 'var(--space-4)' }}>404</h1>
      <p style={{ fontSize: 'var(--font-size-body-large)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-8)' }}>
        The requested page does not exist or has been moved.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/"
          style={{
            padding: 'var(--space-3) var(--space-6)',
            backgroundColor: 'var(--color-forest)',
            color: 'var(--color-paper)',
            borderRadius: 'var(--radius-control)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Return to Overview
        </Link>
        <a
          href={PRIMARY_PHONE_TEL}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            border: '1px solid var(--color-ink)',
            color: 'var(--color-ink)',
            borderRadius: 'var(--radius-control)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Call {PRIMARY_PHONE}
        </a>
      </div>
    </div>
  );
}
