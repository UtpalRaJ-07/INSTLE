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
    title: 'Buying Advisory',
    audience: 'Home & Site Seekers',
    description:
      'Share your property parameters, timeline, and preferred areas to discuss your requirement directly with the brokerage team.',
    href: '/buy',
    ctaText: 'Discuss Buying Requirements',
  },
  {
    title: 'Rental Guidance',
    audience: 'Tenants & Relocations',
    description:
      'Specify your move-in window, preferred localities, and space requirements to discuss your rental requirement directly with the team.',
    href: '/rent',
    ctaText: 'Discuss Rental Guidance',
  },
  {
    title: 'Owner Representation',
    audience: 'Sellers & Landlords',
    description:
      'Share property basics to request a direct conversation with the brokerage team regarding representation and next steps.',
    href: '/sell',
    ctaText: 'Discuss Your Property',
  },
];

export const IntentRail: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="intents-title">
      <div className={styles.header}>
        <span className={styles.eyebrow}>Service Pathways</span>
        <h2 id="intents-title" className={styles.title}>
          Select Your Property Objective
        </h2>
        <p className={styles.subtitle}>
          Choose the pathway that matches your need, or speak directly with our team by telephone.
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
