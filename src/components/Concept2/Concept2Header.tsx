'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './Concept2Header.module.css';

export function Concept2Header() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { label: 'ACQUISITIONS', href: '/concept-2/intake' },
    { label: 'TENANCIES', href: '/concept-2#tenancies' },
    { label: 'REPRESENTATION', href: '/concept-2#representation' },
    { label: 'CORRIDORS', href: '/concept-2#corridors' },
    { label: 'METHODOLOGY', href: '/concept-2#methodology' },
    { label: 'CONTACT', href: '/concept-2#contact' },
  ];

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
      {/* High-Precision Status Banner */}
      <div className={styles.hudBar}>
        <div className={styles.hudInner}>
          <div className={styles.statusLive}>
            <span className={styles.pulseSquare} aria-hidden="true" />
            <span>ADVISORY DESK ACTIVE · BENGALURU METROPOLITAN AREA</span>
          </div>
          <div className={styles.hudRight}>
            <span className={styles.hudItem}>ZERO UNVERIFIED LISTINGS</span>
            <span className={styles.hudDivider}>/</span>
            <span className={styles.hudItem}>TELEPHONE: <a href={PRIMARY_PHONE_TEL} className={styles.hudPhone}>{PRIMARY_PHONE}</a></span>
          </div>
        </div>
      </div>

      <div className={styles.mainNav}>
        {/* Monolithic Brand Lockup */}
        <div className={styles.brandContainer}>
          <Link href="/concept-2" className={styles.brandLink}>
            <span className={styles.brandWordmark}>{CANONICAL_BRAND}</span>
            <span className={styles.brandTag}>[ BENGALURU BROKERAGE CONSOLE ]</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav aria-label="Precision Navigation" className={styles.desktopNav}>
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

        {/* Technical Callout Actions */}
        <div className={styles.actions}>
          <a href={PRIMARY_PHONE_TEL} className={styles.phoneAction}>
            <span className={styles.phonePrefix}>TEL //</span>
            <span className={styles.phoneDigits}>{PRIMARY_PHONE}</span>
          </a>

          <Link href="/concept-2/intake" className={styles.consoleBtn}>
            <span>OPEN CONSOLE</span>
            <span className={styles.btnIcon} aria-hidden="true">↗</span>
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
            <span className={styles.toggleLine} />
            <span className={styles.toggleLine} />
            <span className={styles.toggleLine} />
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
              <div className={styles.drawerPhoneBox}>
                <span className={styles.drawerPhoneLabel}>DIRECT ADVISORY HOTLINE:</span>
                <a href={PRIMARY_PHONE_TEL} className={styles.drawerPhoneLink}>
                  {PRIMARY_PHONE}
                </a>
              </div>
              <Link
                href="/concept-2/intake"
                className={styles.drawerCta}
                onClick={handleClose}
              >
                LAUNCH REQUIREMENTS CONSOLE ↗
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
