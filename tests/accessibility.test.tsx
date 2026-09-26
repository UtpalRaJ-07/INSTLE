import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SkipLink } from '@/components/SkipLink/SkipLink';
import { Header } from '@/components/Header/Header';

/**
 * WCAG 2.2 Relative Luminance and Contrast Calculation
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

function getLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((val) => {
    const sRGB = val / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Accessibility & Contrast Verification (WCAG 2.2 AA / AAA)', () => {
  const PALETTE = {
    paper: '#F6F4EF',
    ink: '#202623',
    forest: '#24443A',
    stone: '#C9C3B7',
    cityBlue: '#557C86',
    accent: '#B9573E',
    white: '#FFFFFF',
  };

  it('validates Ink (#202623) on Paper (#F6F4EF) exceeds WCAG AAA (7:1) for normal text', () => {
    const ratio = getContrastRatio(PALETTE.ink, PALETTE.paper);
    expect(ratio).toBeGreaterThanOrEqual(7.0);
    // Calculated ratio is approx 14.5:1
  });

  it('validates Forest (#24443A) on Paper (#F6F4EF) exceeds WCAG AA (4.5:1) for text', () => {
    const ratio = getContrastRatio(PALETTE.forest, PALETTE.paper);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Calculated ratio is approx 8.0:1
  });

  it('validates White (#FFFFFF) on Forest (#24443A) exceeds WCAG AA (4.5:1) for text/buttons', () => {
    const ratio = getContrastRatio(PALETTE.white, PALETTE.forest);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Calculated ratio is approx 8.9:1
  });

  it('validates Paper (#F6F4EF) on Forest (#24443A) exceeds WCAG AA (4.5:1) for primary CTA buttons', () => {
    const ratio = getContrastRatio(PALETTE.paper, PALETTE.forest);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    // Calculated ratio is approx 8.0:1
  });

  it('validates Accent Vermilion (#B9573E) on Paper (#F6F4EF) meets WCAG 2.2 (3:1) for UI components/large text', () => {
    const ratio = getContrastRatio(PALETTE.accent, PALETTE.paper);
    expect(ratio).toBeGreaterThanOrEqual(3.0);
    // Calculated ratio is approx 4.0:1
  });

  it('verifies SkipLink renders with accessible target and label', () => {
    render(<SkipLink targetId="main-content" />);
    const link = screen.getByRole('link', { name: /skip to main content/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('verifies Mobile Navigation focus management: entry, trap wrapping, and restoration on close', () => {
    render(<Header />);

    const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.body.classList.contains('modal-open')).toBe(false);

    // 1. Open mobile modal drawer
    fireEvent.click(toggleButton);

    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.classList.contains('modal-open')).toBe(true);

    const dialog = screen.getByRole('dialog', { name: /site navigation/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    // 2. Focus enters dialog: initial active element is the close button
    const closeButton = screen.getByRole('button', { name: /close navigation menu/i });
    expect(document.activeElement).toBe(closeButton);

    // Identify first and last focusable elements in dialog
    const focusableInModal = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    const firstElement = focusableInModal[0];
    const lastElement = focusableInModal[focusableInModal.length - 1];

    expect(firstElement).toBe(closeButton);

    // 3. Focus wrapping: Shift+Tab on first element wraps focus to last element
    closeButton.focus();
    expect(document.activeElement).toBe(firstElement);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastElement);

    // 4. Focus wrapping: Tab on last element wraps focus back to first element
    lastElement.focus();
    expect(document.activeElement).toBe(lastElement);
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(firstElement);

    // 5. Focus restoration: Escape closes dialog and returns focus to toggle trigger
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /site navigation/i })).not.toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(toggleButton);

    // 6. Focus restoration on explicit close button click
    fireEvent.click(toggleButton); // reopen
    const closeBtnReopened = screen.getByRole('button', { name: /close navigation menu/i });
    fireEvent.click(closeBtnReopened); // click close
    expect(screen.queryByRole('dialog', { name: /site navigation/i })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(toggleButton);
  });
});
