/**
 * @vitest-environment jsdom
 */

/**
 * Form accessibility and failure behaviour.
 *
 * This file previously combined contrast arithmetic with mobile-drawer focus
 * assertions. Both moved to better homes: contrast is now computed from
 * tokens.css in tests/design-tokens.test.ts, and the drawer has its own file in
 * tests/ui/mobile-drawer.test.tsx.
 *
 * What is here instead is the enquiry form, which is where a customer can actually
 * get stuck: labels, error association, the error summary, and what happens when
 * the destination fails.
 *
 * All data used is synthetic.
 */

import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import { EnquiryForm } from '@/components/EnquiryForm/EnquiryForm';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderForm(intakeEnabled = true) {
  return render(
    <EnquiryForm intent="buy" intakeEnabled={intakeEnabled} consentNoticeText={null} />
  );
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: /flat \/ apartment/i }));
  await user.type(screen.getByLabelText(/your name/i), 'Synthetic Test Person');
  await user.type(screen.getByLabelText(/phone number/i), '9845012345');
  await user.click(screen.getByRole('checkbox', { name: /happy for/i }));
}

describe('call-only mode', () => {
  it('collects nothing and leads with the phone number', () => {
    const { container } = renderForm(false);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).not.toBeNull();
    expect(container.textContent).toMatch(/not switched on yet/i);
  });

  it('still tells the customer what to have ready', () => {
    const { container } = renderForm(false);
    expect(container.textContent).toMatch(/useful to have ready/i);
  });
});

describe('form structure', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders no h1, because the page already has one', () => {
    const { container } = renderForm();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('groups fields into named fieldsets', () => {
    renderForm();
    expect(screen.getByRole('group', { name: /what you need/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: /where and when/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: /how to reach you/i })).toBeTruthy();
  });

  it('gives every text input a programmatically associated label', () => {
    const { container } = renderForm();
    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input[type="text"], input[type="tel"], textarea'
      )
    );
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(container.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
    }
  });

  it('uses real radio groups so arrow keys and group semantics work', () => {
    renderForm();
    const group = screen.getByRole('group', { name: /what would you like to buy/i });
    expect(within(group).getAllByRole('radio').length).toBeGreaterThan(3);
  });

  it('leaves both consent checkboxes unticked', () => {
    renderForm();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    for (const checkbox of checkboxes) {
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    }
  });

  it('keeps marketing permission separate from the service consent', () => {
    renderForm();
    expect(screen.getByRole('checkbox', { name: /optional/i })).toBeTruthy();
  });

  it('sets autocomplete hints on name and phone', () => {
    renderForm();
    expect(screen.getByLabelText(/your name/i).getAttribute('autocomplete')).toBe('name');
    expect(screen.getByLabelText(/phone number/i).getAttribute('autocomplete')).toBe('tel');
  });

  it('offers a call alternative alongside the submit button', () => {
    const { container } = renderForm();
    expect(container.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).not.toBeNull();
  });

  it('states plainly that sending does not reserve a property', () => {
    const { container } = renderForm();
    expect(container.textContent).toMatch(/does not reserve/i);
  });
});

describe('client-side validation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows an error summary and does not call the API on an empty submit', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toMatch(/please check/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('moves focus to the error summary so it is announced', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    const summary = await screen.findByRole('alert');
    await waitFor(() => expect(document.activeElement).toBe(summary));
  });

  it('links each summary item to the field it refers to', async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    const summary = await screen.findByRole('alert');
    const links = Array.from(summary.querySelectorAll('a'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const id = link.getAttribute('href')!.slice(1);
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('marks an invalid field with aria-invalid and an associated message', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('radio', { name: /flat \/ apartment/i }));
    await user.type(screen.getByLabelText(/your name/i), 'Synthetic Test Person');
    await user.type(screen.getByLabelText(/phone number/i), '12345');
    await user.click(screen.getByRole('checkbox', { name: /happy for/i }));
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    const phone = screen.getByLabelText(/phone number/i);
    await waitFor(() => expect(phone.getAttribute('aria-invalid')).toBe('true'));

    const describedBy = phone.getAttribute('aria-describedby')!;
    const ids = describedBy.split(/\s+/);
    const messages = ids
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    expect(messages).toMatch(/check the phone number/i);
  });

  it('requires consent before submitting', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('radio', { name: /flat \/ apartment/i }));
    await user.type(screen.getByLabelText(/your name/i), 'Synthetic Test Person');
    await user.type(screen.getByLabelText(/phone number/i), '9845012345');
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    const summary = await screen.findByRole('alert');
    expect(summary.textContent).toMatch(/tick the box/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not signal an error by colour alone', async () => {
    const user = userEvent.setup();
    const { container } = renderForm();
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    // Each inline error carries a text message plus a non-colour mark.
    const errors = container.querySelectorAll('[id$="-error"]');
    expect(errors.length).toBeGreaterThan(0);
    for (const error of Array.from(errors)) {
      expect((error.textContent ?? '').replace(/[!\s]/g, '').length).toBeGreaterThan(5);
    }
  });
});

describe('submission outcomes', () => {
  it('shows a reference on success and echoes no personal data back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, reference: 'IRE-ABC123DEF456', isDuplicate: false }),
      })
    );

    const user = userEvent.setup();
    const { container } = renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    await waitFor(() => {
      expect(container.textContent).toContain('IRE-ABC123DEF456');
    });

    // The previous confirmation screen printed the name, phone and requirement.
    expect(container.textContent).not.toContain('Synthetic Test Person');
    expect(container.textContent).not.toContain('9845012345');
  });

  it('tells the customer plainly when the enquiry was not saved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          code: 'destination-rejected',
          error: 'We could not save your enquiry.',
          retriable: true,
        }),
      })
    );

    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    const alerts = await screen.findAllByRole('alert');
    const text = alerts.map((alert) => alert.textContent).join(' ');
    expect(text).toMatch(/could not save/i);
  });

  it('never reports success when the response body says otherwise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Destination unavailable.' }),
      })
    );

    const user = userEvent.setup();
    const { container } = renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    await screen.findAllByRole('alert');
    expect(container.textContent).not.toMatch(/we have your enquiry/i);
  });

  it('offers the phone number when submission fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const user = userEvent.setup();
    const { container } = renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    await screen.findAllByRole('alert');
    expect(container.textContent).toContain(PRIMARY_PHONE);
    expect(container.querySelector(`a[href="${PRIMARY_PHONE_TEL}"]`)).not.toBeNull();
  });

  it('keeps entered values in the form after a failure so nothing is retyped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    await screen.findAllByRole('alert');
    expect((screen.getByLabelText(/your name/i) as HTMLInputElement).value).toBe(
      'Synthetic Test Person'
    );
  });

  it('writes nothing to localStorage or sessionStorage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));
    await screen.findAllByRole('alert');

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('sends one request and disables the button while in flight', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);

    const submit = screen.getByRole('button', { name: /send my requirement/i });
    await user.click(submit);

    await waitFor(() => {
      expect((screen.getByRole('button', { name: /sending/i }) as HTMLButtonElement).disabled).toBe(
        true
      );
    });

    resolveFetch?.({
      ok: true,
      json: async () => ({ success: true, reference: 'IRE-XYZ', isDuplicate: false }),
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('sends enum values rather than free text', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, reference: 'IRE-XYZ', isDuplicate: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderForm();
    await fillRequiredFields(user);
    await user.click(screen.getByRole('radio', { name: /₹50 lakh to ₹1 crore/i }));
    await user.click(screen.getByRole('button', { name: /send my requirement/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.assetType).toBe('flat');
    expect(body.budgetBand).toBe('50-lakh-to-1-crore');
    expect(body.consent).toBe(true);
    expect(body.marketingConsent).toBe(false);
    expect(typeof body.idempotencyKey).toBe('string');
  });
});

describe('conditional fields', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('asks about bedrooms for a home but not for a site', async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByRole('group', { name: /how many bedrooms/i })).toBeNull();

    await user.click(screen.getByRole('radio', { name: /flat \/ apartment/i }));
    expect(screen.getByRole('group', { name: /how many bedrooms/i })).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: /site \/ plot/i }));
    expect(screen.queryByRole('group', { name: /how many bedrooms/i })).toBeNull();
  });

  it('does not ask a buyer about furnishing or ownership role', () => {
    renderForm();
    expect(screen.queryByRole('group', { name: /furnishing/i })).toBeNull();
    expect(screen.queryByRole('group', { name: /relationship to the property/i })).toBeNull();
  });
});
