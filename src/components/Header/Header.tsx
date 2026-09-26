'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLockup/BrandLockup';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL, PRIMARY_NAV_ITEMS } from '@/config/constants';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Manage body scroll and initial focus shift when modal opens/closes
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('modal-open');
      // Direct focus shift to initial focusable control inside dialog
      closeButtonRef.current?.focus();
    } else {
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isMenuOpen]);

  // Handle Escape key and focus trapping in modal
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        toggleButtonRef.current?.focus();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const handleClose = () => {
    setIsMenuOpen(false);
    toggleButtonRef.current?.focus();
  };

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <BrandLockup />

        {/* Desktop Navigation */}
        <nav className={styles.desktopNav} aria-label="Main Navigation">
          <ul className={styles.navList}>
            {PRIMARY_NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact CTA */}
        <div className={styles.headerActions}>
          <a
            href={PRIMARY_PHONE_TEL}
            className={styles.phoneLink}
            aria-label={`Call primary phone ${PRIMARY_PHONE}`}
          >
            <span className={styles.phoneIcon} aria-hidden="true">
              ☎
            </span>
            <span className={styles.phoneDigits}>{PRIMARY_PHONE}</span>
          </a>

          {/* Mobile Menu Toggle Button */}
          <button
            ref={toggleButtonRef}
            type="button"
            className={styles.menuToggle}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav-modal"
            aria-label="Toggle navigation menu"
          >
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
          </button>
        </div>
      </div>

      {/* Mobile Navigation Modal Drawer */}
      {isMenuOpen && (
        <div
          id="mobile-nav-modal"
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={styles.mobileModal}
        >
          <div className={styles.modalBackdrop} onClick={handleClose} />
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>MENU</span>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={handleClose}
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </div>

            <nav aria-label="Mobile Navigation" className={styles.mobileNav}>
              <ul className={styles.mobileNavList}>
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <li key={item.href} className={styles.mobileNavItem}>
                    <Link
                      href={item.href}
                      className={styles.mobileNavLink}
                      onClick={handleClose}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.modalFooter}>
              <a
                href={PRIMARY_PHONE_TEL}
                className={styles.mobilePhoneCta}
                aria-label={`Call ${PRIMARY_PHONE}`}
                onClick={handleClose}
              >
                <span aria-hidden="true">☎</span> Call {PRIMARY_PHONE}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
