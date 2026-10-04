import React from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import styles from './ContactBand.module.css';

export const ContactBand: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="contact-band-title">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>Direct Contact</span>
          <h2 id="contact-band-title" className={styles.title}>
            Let’s discuss your property requirement
          </h2>
          <p className={styles.text}>
            Looking for a flat, house, villa or plot in Bengaluru? Speak directly with our team to discuss your budget, preferred area and timeline.
          </p>
        </div>

        <div className={styles.action}>
          <a
            href={PRIMARY_PHONE_TEL}
            className={styles.phoneCta}
            aria-label={`Call ${CANONICAL_BRAND} at ${PRIMARY_PHONE}`}
          >
            <span className={styles.phoneIcon} aria-hidden="true">
              ☎
            </span>
            <div className={styles.phoneDetails}>
              <span className={styles.phoneLabel}>Call Our Team</span>
              <span className={styles.phoneDigits}>{PRIMARY_PHONE}</span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
};
