/**
 * @vitest-environment jsdom
 */

import React, { useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// next/link needs the App Router context to render, which is not present in a unit
// test. A plain anchor is behaviourally equivalent for the keyboard and focus
// assertions below.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Header } from '@/components/Header/Header';

/**
 * Harness mirroring LayoutShell: it owns the open state and marks the background
 * inert, which is how background interaction is actually prevented.
 */
function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Header isMenuOpen={open} onMenuOpenChange={setOpen} />
      <main id="main-content" inert={open}>
        <a href="/background-link">Background link</a>
      </main>
    </>
  );
}

afterEach(cleanup);

describe('mobile navigation drawer', () => {
  it('is closed initially and the toggle reports collapsed state', () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: /menu/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens as a modal dialog with an accessible name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^menu$/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Site navigation');
  });

  it('links the toggle to the drawer it controls', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: /^menu$/i });
    await user.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(screen.getByRole('dialog').id);
  });

  it('moves focus into the drawer on open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^menu$/i }));

    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /close menu/i }));
    });
  });

  it('closes on Escape and restores focus to the toggle', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: /^menu$/i });
    await user.click(toggle);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(toggle);
    });
  });

  it('closes via the close button and restores focus to the toggle', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: /^menu$/i });
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /close menu/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(toggle);
    });
  });

  it('traps Tab inside the drawer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    const dialog = screen.getByRole('dialog');

    // Walk forward well past the number of focusable elements in the drawer.
    for (let step = 0; step < 25; step += 1) {
      await user.tab();
      expect(
        dialog.contains(document.activeElement),
        `focus escaped the drawer after ${step + 1} tabs`
      ).toBe(true);
    }
  });

  it('traps Shift+Tab inside the drawer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    const dialog = screen.getByRole('dialog');

    for (let step = 0; step < 25; step += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('marks the background inert while the drawer is open', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const main = document.getElementById('main-content')!;
    expect(main.hasAttribute('inert')).toBe(false);

    await user.click(screen.getByRole('button', { name: /^menu$/i }));
    expect(main.hasAttribute('inert')).toBe(true);
  });

  it('closes when a navigation link inside the drawer is activated', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^menu$/i }));

    const dialog = screen.getByRole('dialog');
    const link = dialog.querySelector('a[href="/buy"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    await user.click(link);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('exposes the canonical phone number as an unformatted tel link', () => {
    render(<Harness />);
    const phoneLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
    expect(phoneLinks.length).toBeGreaterThan(0);
    for (const link of phoneLinks) {
      expect(link.getAttribute('href')).toBe('tel:9353096264');
    }
  });

  it('groups the drawer navigation under headings', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /^menu$/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('h2').length).toBeGreaterThanOrEqual(3);
  });
});
