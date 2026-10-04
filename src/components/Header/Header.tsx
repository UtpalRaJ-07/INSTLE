'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BrandLockup } from '@/components/BrandLockup/BrandLockup';
import {
  HEADER_NAV_ITEMS,
  NAV_GROUPS,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './Header.module.css';

export interface HeaderProps {
  isMenuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}

/**
 * Site header.
 *
 * Accessibility contract, which the tests and the manual checklist both cover:
 *  - The drawer is a modal dialog: role="dialog", aria-modal="true".
 *  - Focus moves into the dialog on open and is trapped inside it.
 *  - Escape closes it and focus returns to the toggle button.
 *  - Background inertness is handled by LayoutShell, which marks main and footer
 *    inert while the drawer is open.
 */
export const Header: React.FC<HeaderProps> = ({ isMenuOpen, onMenuOpenChange }) => {
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  /** Remembers whether we opened the drawer, so focus is only restored then. */
  const wasOpenRef = useRef(false);

  const close = useCallback(() => {
    onMenuOpenChange(false);
  }, [onMenuOpenChange]);

  // Move focus into the dialog on open, and back to the trigger on close.
  useEffect(() => {
    if (isMenuOpen) {
      wasOpenRef.current = true;
      closeButtonRef.current?.focus();
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      toggleButtonRef.current?.focus();
    }
  }, [isMenuOpen]);

  // Escape to close, Tab cycling constrained to the dialog.
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      // If focus has escaped the dialog entirely, pull it back in.
      if (!active || !dialog.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isMenuOpen, close]);

  return (
    <header className={`${styles.header} surface-night`}>
      <div className={`container ${styles.headerInner}`}>
        <BrandLockup className={styles.brand} />

        <nav className={styles.desktopNav} aria-label="Main">
          <ul className={styles.navList}>
            {HEADER_NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.navLink}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.headerActions}>
          <a href={PRIMARY_PHONE_TEL} className={styles.phoneLink}>
            <span className={styles.phoneLabel}>Call</span>
            <span className={styles.phoneDigits}>{PRIMARY_PHONE}</span>
          </a>

          <button
            ref={toggleButtonRef}
            type="button"
            className={styles.menuToggle}
            onClick={() => onMenuOpenChange(!isMenuOpen)}
            aria-expanded={isMenuOpen}
            aria-controls="site-navigation-drawer"
          >
            <span className={styles.menuBars} aria-hidden="true">
              <span className={styles.menuBar} />
              <span className={styles.menuBar} />
              <span className={styles.menuBar} />
            </span>
            <span className={styles.menuToggleLabel}>Menu</span>
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <div className={styles.drawerLayer}>
          {/* Backdrop is presentational; keyboard users close with Escape or the
              close button, so it carries no role and no tab stop. */}
          <div className={styles.backdrop} onClick={close} aria-hidden="true" />
          <div
            id="site-navigation-drawer"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className={styles.drawer}
          >
            <div className={styles.drawerHeader}>
              <span className={styles.drawerTitle}>Menu</span>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.closeButton}
                onClick={close}
              >
                <span aria-hidden="true">✕</span>
                <span className="visually-hidden">Close menu</span>
              </button>
            </div>

            <nav aria-label="Site sections" className={styles.drawerNav}>
              {NAV_GROUPS.map((group) => (
                <div key={group.title ?? 'ungrouped'} className={styles.drawerGroup}>
                  {group.title ? (
                    <h2 className={styles.drawerGroupTitle}>{group.title}</h2>
                  ) : null}
                  <ul className={styles.drawerList}>
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href} className={styles.drawerLink} onClick={close}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>

            <div className={styles.drawerFooter}>
              <a href={PRIMARY_PHONE_TEL} className={styles.drawerCall} onClick={close}>
                Call {PRIMARY_PHONE}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
};
