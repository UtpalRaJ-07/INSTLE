'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './Concept1Header.module.css';

export function Concept1Header() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { label: 'Buy', href: '/concept-1/intake' },
    { label: 'Rent', href: '/rent' },
    { label: 'Sell', href: '/sell' },
    { label: 'Areas', href: '/areas' },
    { label: 'How It Works', href: '/how-it-works' },
    { label: 'Contact', href: '/contact' },
  ];

  // Mobile modal focus trap and escape handling
  useEffect(() => {
    if (!isOpen) return;

    document.body.classList.add('modal-open');
    closeRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('modal-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <header className={styles.header}>
      {/* Editorial top line datum */}
      <div className={styles.topDatum}>
        <div className={styles.topDatumInner}>
          <span className={styles.datumItem}>12°58′N 77°35′E · BENGALURU</span>
          <span className={styles.datumItem}>SERVICE-LED REAL ESTATE BROKERAGE &amp; ADVISORY</span>
          <span className={styles.datumItem}>
            DIRECT CALL:{' '}
            <a href={PRIMARY_PHONE_TEL} className={styles.datumPhone}>
              {PRIMARY_PHONE}
            </a>
          </span>
        </div>
      </div>

      <div className={styles.mainNav}>
        <div className={styles.brandGroup}>
          <Link href="/concept-1" className={styles.brandLink}>
            <span className={styles.brandTitle}>{CANONICAL_BRAND}</span>
            <span className={styles.brandSubtitle}>BENGALURU PROPERTY ADVISORY</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav aria-label="Primary Navigation" className={styles.desktopNav}>
          <ul className={styles.navList}>
            {navLinks.map((link) => (
              <li key={link.label} className={styles.navItem}>
                <Link href={link.href} className={styles.link}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Action button */}
        <div className={styles.actions}>
          <a href={PRIMARY_PHONE_TEL} className={styles.phoneButton}>
            <span className={styles.phoneIcon} aria-hidden="true">☎</span>
            <span>{PRIMARY_PHONE}</span>
          </a>

          <Link href="/concept-1/intake" className={styles.ctaButton}>
            <span>Submit Brief</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            ref={toggleRef}
            type="button"
            className={styles.mobileToggle}
            aria-expanded={isOpen}
            aria-label="Toggle navigation menu"
            onClick={() => setIsOpen(true)}
          >
            <span className={styles.toggleBar} />
            <span className={styles.toggleBar} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Modal */}
      {isOpen && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site Navigation"
          className={styles.mobileDrawer}
        >
          <div className={styles.drawerBackdrop} onClick={handleClose} />
          <div className={styles.drawerContent}>
            <div className={styles.drawerHeader}>
              <span className={styles.drawerBrand}>{CANONICAL_BRAND}</span>
              <button
                ref={closeRef}
                type="button"
                className={styles.closeButton}
                aria-label="Close navigation menu"
                onClick={handleClose}
              >
                ✕
              </button>
            </div>

            <nav aria-label="Mobile Navigation" className={styles.drawerNav}>
              <ul className={styles.drawerList}>
                {navLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={styles.drawerLink}
                      onClick={handleClose}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.drawerFooter}>
              <p className={styles.drawerMeta}>BENGALURU REAL ESTATE BROKERAGE</p>
              <a href={PRIMARY_PHONE_TEL} className={styles.drawerPhoneLink}>
                Call Advisory: {PRIMARY_PHONE}
              </a>
              <Link
                href="/concept-1/intake"
                className={styles.drawerCta}
                onClick={handleClose}
              >
                Commission Acquisition Brief
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
