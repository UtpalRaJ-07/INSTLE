import React from 'react';
import Link from 'next/link';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './IntentRail.module.css';

interface IntentOption {
  title: string;
  audience: string;
  description: string;
  href: string;
  ctaText: string;
}

const INTENTS: IntentOption[] = [
  {
    title: 'Buy property',
    audience: 'Home & Site Buyers',
    description:
      'Tell us what you are looking for, your preferred area and your budget. We assist you with flats, independent houses, villas and plots.',
    href: '/buy',
    ctaText: 'Tell us what you need',
  },
  {
    title: 'Rent a home',
    audience: 'Tenants & Relocations',
    description:
      'Tell us where you want to stay, your monthly rent budget and when you plan to move. We help you find suitable residences across Bengaluru.',
    href: '/rent',
    ctaText: 'Share rental details',
  },
  {
    title: 'Sell property',
    audience: 'Property Owners',
    description:
      'Share your property type, area and when you would like to sell. We speak to interested buyers before arranging a visit.',
    href: '/sell',
    ctaText: 'Sell with our team',
  },
  {
    title: 'Rent out property',
    audience: 'Landlords',
    description:
      'Share your property details and when the property is available. We speak to prospective tenants about their requirement before arranging a visit.',
    href: '/sell',
    ctaText: 'Find tenants',
  },
];

export const IntentRail: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="intents-title">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Our Services</span>
        <h2 id="intents-title" className={styles.title}>
          How can we help you today?
        </h2>
        <p className={styles.subtitle}>
          Choose an option below to share your requirement, or speak directly with our team by telephone.
        </p>
      </div>

      <div className={styles.grid}>
        {INTENTS.map((intent) => (
          <div key={intent.title} className={styles.card}>
            <span className={styles.audience}>{intent.audience}</span>
            <h3 className={styles.cardTitle}>{intent.title}</h3>
            <p className={styles.cardDescription}>{intent.description}</p>
            <div className={styles.cardFooter}>
              <Link href={intent.href} className={styles.cardLink}>
                {intent.ctaText} →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.callout}>
        <span>Prefer an immediate conversation?</span>
        <a href={PRIMARY_PHONE_TEL} className={styles.calloutPhone}>
          <span aria-hidden="true">☎</span> Call {PRIMARY_PHONE}
        </a>
      </div>
    </section>
  );
};
