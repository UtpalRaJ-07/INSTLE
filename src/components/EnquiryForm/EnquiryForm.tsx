'use client';

import React, { useId, useMemo, useRef, useState } from 'react';
import { CANONICAL_BRAND, PRIMARY_PHONE, PRIMARY_PHONE_TEL } from '@/config/constants';
import type { CustomerIntent } from '@/config/constants';
import { validatePhone } from '@/lib/enquiry-schema';
import { trackSafeEvent } from '@/lib/telemetry';
import {
  CONFIGURATION_OPTIONS,
  CONTACT_PREFERENCE_OPTIONS,
  FURNISHING_OPTIONS_LIST,
  OWNERSHIP_OPTIONS,
  getFormConfig,
  type Option,
} from './form-config';
import styles from './EnquiryForm.module.css';

export interface EnquiryFormProps {
  intent: CustomerIntent;
  /**
   * Whether real submission is switched on. Resolved on the server from
   * INSTLE_ENQUIRY_INTAKE_ENABLED, because the client must not decide this.
   */
  intakeEnabled: boolean;
  /** Approved consent notice text. Null when none has been approved. */
  consentNoticeText: string | null;
}

interface FormState {
  assetType: string;
  configuration: string;
  areas: string;
  money: string;
  timeline: string;
  furnishing: string;
  ownershipRole: string;
  notes: string;
  name: string;
  phone: string;
  contactPreference: string;
  consent: boolean;
  marketingConsent: boolean;
}

const EMPTY_STATE: FormState = {
  assetType: '',
  configuration: '',
  areas: '',
  money: '',
  timeline: '',
  furnishing: '',
  ownershipRole: '',
  notes: '',
  name: '',
  phone: '',
  contactPreference: 'phone-call',
  consent: false,
  marketingConsent: false,
};

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; reference: string; isDuplicate: boolean }
  | { kind: 'failure'; message: string; retriable: boolean };

/** Asset types that are homes, so the bedroom question makes sense. */
const RESIDENTIAL_HOME_ASSETS = new Set(['flat', 'independent-house', 'villa']);

/**
 * Per-attempt submission token. Random and carries nothing about the customer,
 * so a double submit is deduplicated server-side without a personal identifier.
 */
function createSubmissionToken(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalCrypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for environments without Web Crypto. Not used in a real browser.
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Shared enquiry form for every customer journey.
 *
 * Design notes worth stating, because each one is a deliberate choice:
 *
 *  - One page with grouped fieldsets rather than a five-step wizard. A wizard hid
 *    the remaining questions, added its own navigation failure modes, and put a
 *    second `<h1>` on pages that already had one.
 *  - Real `<input type="radio">` groups, not styled buttons. Arrow-key navigation,
 *    group semantics and required-state announcement come for free.
 *  - Entered values live in component state only. Nothing is written to
 *    localStorage or sessionStorage, so a failed submission does not leave the
 *    customer's phone number on a shared device.
 *  - On success the reference is shown, and nothing else. The previous confirmation
 *    echoed the customer's name, phone number and full requirement back into the
 *    page, which also put it into any screenshot or shared screen.
 */
export function EnquiryForm({ intent, intakeEnabled, consentNoticeText }: EnquiryFormProps) {
  const config = useMemo(() => getFormConfig(intent), [intent]);
  const baseId = useId();
  const [form, setForm] = useState<FormState>(EMPTY_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [hasStarted, setHasStarted] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  /** Stable per-attempt token so a double submit cannot create two records. */
  const idempotencyKeyRef = useRef<string | null>(null);

  const fieldId = (name: string) => `${baseId}-${name}`;
  const errorId = (name: string) => `${baseId}-${name}-error`;
  const helpId = (name: string) => `${baseId}-${name}-help`;

  const showConfiguration =
    config.showConfiguration && RESIDENTIAL_HOME_ASSETS.has(form.assetType);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!hasStarted) {
      setHasStarted(true);
      trackSafeEvent('form_start', { intent, sourceComponent: 'enquiry-form' });
    }
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const next = { ...previous };
      delete next[key as string];
      return next;
    });
  }

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};

    if (!form.assetType) {
      found.assetType = 'Please choose a property type.';
    }
    if (!form.name.trim() || form.name.trim().length < 2) {
      found.name = 'Please tell us your name.';
    }
    const phone = validatePhone(form.phone);
    if (!phone.valid) {
      found.phone =
        'Please check the phone number. Ten digits is enough for an Indian mobile. For another country, start with + and the country code.';
    }
    if (config.showOwnershipRole && !form.ownershipRole) {
      found.ownershipRole = 'Please tell us whether you are the owner or representing the owner.';
    }
    if (!form.consent) {
      found.consent = 'Please tick the box so we know it is alright to contact you.';
    }

    return found;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'submitting') return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStatus({ kind: 'idle' });
      // Move focus to the summary so a keyboard or screen-reader user lands on
      // the list of problems rather than having to hunt for them.
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setErrors({});
    setStatus({ kind: 'submitting' });
    trackSafeEvent('form_submit_attempt', { intent, sourceComponent: 'enquiry-form' });

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createSubmissionToken();
    }

    const preferredAreas = form.areas
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 5);

    const body: Record<string, unknown> = {
      intent,
      assetType: form.assetType,
      preferredAreas,
      timeline: form.timeline || undefined,
      contactPreference: form.contactPreference,
      name: form.name.trim(),
      phone: form.phone.trim(),
      consent: true,
      marketingConsent: form.marketingConsent,
      idempotencyKey: idempotencyKeyRef.current,
    };

    if (showConfiguration && form.configuration) body.configuration = form.configuration;
    if (config.moneyQuestion === 'budget' && form.money) body.budgetBand = form.money;
    if (config.moneyQuestion === 'rent' && form.money) body.rentBand = form.money;
    if (config.showFurnishing && form.furnishing) body.furnishing = form.furnishing;
    if (config.showOwnershipRole && form.ownershipRole) body.ownershipRole = form.ownershipRole;
    if (form.notes.trim()) body.notes = form.notes.trim();

    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: unknown = await response.json().catch(() => null);
      const payload = (data ?? {}) as {
        success?: boolean;
        reference?: string;
        isDuplicate?: boolean;
        error?: string;
        errors?: Record<string, string>;
        retriable?: boolean;
      };

      if (response.ok && payload.success && payload.reference) {
        setStatus({
          kind: 'success',
          reference: payload.reference,
          isDuplicate: Boolean(payload.isDuplicate),
        });
        trackSafeEvent('form_submit_success', {
          intent,
          sourceComponent: 'enquiry-form',
          statusCode: 200,
        });
        return;
      }

      if (payload.errors && Object.keys(payload.errors).length > 0) {
        setErrors(payload.errors);
        setStatus({ kind: 'idle' });
        requestAnimationFrame(() => errorSummaryRef.current?.focus());
        return;
      }

      // Anything else is a failure. The customer is told plainly that we do not
      // have the enquiry, so they do not sit and wait for a call that is not coming.
      setStatus({
        kind: 'failure',
        message:
          payload.error ??
          `We could not save your enquiry, so please do not assume we have it. Call ${PRIMARY_PHONE} and we will take it over the phone.`,
        retriable: payload.retriable !== false,
      });
      trackSafeEvent('form_submit_error', { intent, sourceComponent: 'enquiry-form' });
    } catch {
      setStatus({
        kind: 'failure',
        message: `We could not reach our system just now, so your enquiry has not been sent. Please try again, or call ${PRIMARY_PHONE}.`,
        retriable: true,
      });
      trackSafeEvent('form_submit_error', { intent, sourceComponent: 'enquiry-form' });
    }
  }

  // ---------------------------------------------------------------------------
  // Call-only mode
  // ---------------------------------------------------------------------------
  if (!intakeEnabled) {
    return (
      <div className={styles.wrapper} id="enquiry">
        <div className={styles.callOnlyPanel}>
          <h2 className={styles.heading}>{config.heading}</h2>
          <p className={styles.callOnlyLead}>
            The online form is not switched on yet, so right now the way to reach us is a phone
            call. We would rather say that plainly than collect your details with nowhere proper to
            put them.
          </p>
          <p className={styles.callOnlyLead}>
            Call <strong>{PRIMARY_PHONE}</strong> and we will take your requirement over the phone.
          </p>
          <a href={PRIMARY_PHONE_TEL} className={styles.callOnlyAction}>
            Call {PRIMARY_PHONE}
          </a>
          <div className={styles.callOnlyDetail}>
            <h3 className={styles.callOnlyDetailTitle}>Useful to have ready</h3>
            <ul className={styles.callOnlyList}>
              <li>{config.assetTypeLabel.replace(/\?$/, '')}</li>
              <li>{config.areaLabel.replace(/\?$/, '')}</li>
              {config.moneyQuestion !== 'none' ? (
                <li>{config.moneyLabel.replace(/ \(optional\)/, '').replace(/\?$/, '')}</li>
              ) : null}
              <li>{config.timelineLabel.replace(/\?$/, '')}</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------
  if (status.kind === 'success') {
    return (
      <div className={styles.wrapper} id="enquiry">
        <div className={styles.successPanel} role="status">
          <h2 className={styles.heading}>
            {status.isDuplicate ? 'We already have this enquiry' : 'We have your enquiry'}
          </h2>
          <p className={styles.successText}>
            Your reference is <strong className={styles.reference}>{status.reference}</strong>. Keep
            it handy if you call us.
          </p>
          <p className={styles.successText}>
            Someone from our team will call you on the number you gave us. If you would rather speak
            now, call {PRIMARY_PHONE}.
          </p>
          <a href={PRIMARY_PHONE_TEL} className={styles.callOnlyAction}>
            Call {PRIMARY_PHONE}
          </a>
        </div>
      </div>
    );
  }

  const errorEntries = Object.entries(errors);
  const submitting = status.kind === 'submitting';

  return (
    <div className={styles.wrapper} id="enquiry">
      <div className={styles.formPanel}>
        <h2 className={styles.heading}>{config.heading}</h2>
        <p className={styles.intro}>{config.intro}</p>

        {/*
          Error summary. `tabIndex={-1}` so focus can be moved here
          programmatically, and role="alert" so it is announced on appearance.
        */}
        {errorEntries.length > 0 ? (
          <div
            ref={errorSummaryRef}
            tabIndex={-1}
            role="alert"
            className={styles.errorSummary}
            aria-labelledby={`${baseId}-error-summary-title`}
          >
            <h3 id={`${baseId}-error-summary-title`} className={styles.errorSummaryTitle}>
              Please check {errorEntries.length === 1 ? 'one thing' : `${errorEntries.length} things`}
            </h3>
            <ul className={styles.errorSummaryList}>
              {errorEntries.map(([field, message]) => (
                <li key={field}>
                  <a href={`#${fieldId(field)}`}>{message}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {status.kind === 'failure' ? (
          <div role="alert" className={styles.failurePanel}>
            <p className={styles.failureText}>{status.message}</p>
            <a href={PRIMARY_PHONE_TEL} className={styles.failureCall}>
              Call {PRIMARY_PHONE}
            </a>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
          {/* ---------- What you need ---------- */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>What you need</legend>

            <RadioGroup
              name="assetType"
              legend={config.assetTypeLabel}
              options={config.assetTypeOptions}
              value={form.assetType}
              onChange={(value) => update('assetType', value)}
              required
              error={errors.assetType}
              fieldId={fieldId('assetType')}
              errorId={errorId('assetType')}
            />

            {showConfiguration ? (
              <RadioGroup
                name="configuration"
                legend="How many bedrooms?"
                options={CONFIGURATION_OPTIONS}
                value={form.configuration}
                onChange={(value) => update('configuration', value)}
                fieldId={fieldId('configuration')}
                errorId={errorId('configuration')}
              />
            ) : null}

            {config.showFurnishing ? (
              <RadioGroup
                name="furnishing"
                legend="Furnishing"
                options={FURNISHING_OPTIONS_LIST}
                value={form.furnishing}
                onChange={(value) => update('furnishing', value)}
                fieldId={fieldId('furnishing')}
                errorId={errorId('furnishing')}
              />
            ) : null}

            {config.showOwnershipRole ? (
              <RadioGroup
                name="ownershipRole"
                legend="Your relationship to the property"
                options={OWNERSHIP_OPTIONS}
                value={form.ownershipRole}
                onChange={(value) => update('ownershipRole', value)}
                required
                error={errors.ownershipRole}
                fieldId={fieldId('ownershipRole')}
                errorId={errorId('ownershipRole')}
              />
            ) : null}
          </fieldset>

          {/* ---------- Where and when ---------- */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Where and when</legend>

            <div className={styles.field}>
              <label htmlFor={fieldId('areas')} className={styles.label}>
                {config.areaLabel}
              </label>
              <p id={helpId('areas')} className={styles.help}>
                {config.areaHelp}
              </p>
              <input
                id={fieldId('areas')}
                name="areas"
                type="text"
                className={styles.input}
                value={form.areas}
                onChange={(event) => update('areas', event.target.value)}
                aria-describedby={helpId('areas')}
                autoComplete="off"
                maxLength={200}
              />
            </div>

            {config.moneyQuestion !== 'none' ? (
              <RadioGroup
                name="money"
                legend={config.moneyLabel}
                options={config.moneyOptions}
                value={form.money}
                onChange={(value) => update('money', value)}
                fieldId={fieldId('money')}
                errorId={errorId('money')}
                help={
                  config.intent === 'sell' || config.intent === 'rent-out'
                    ? 'This helps us understand your expectations. It is not a valuation.'
                    : 'Pick the closest band, or choose “Prefer to discuss”.'
                }
                helpId={helpId('money')}
              />
            ) : null}

            <RadioGroup
              name="timeline"
              legend={config.timelineLabel}
              options={config.timelineOptions}
              value={form.timeline}
              onChange={(value) => update('timeline', value)}
              fieldId={fieldId('timeline')}
              errorId={errorId('timeline')}
              help={
                config.intent === 'sell'
                  ? 'This is your target. It is not a date we commit to.'
                  : undefined
              }
              helpId={helpId('timeline')}
            />

            <div className={styles.field}>
              <label htmlFor={fieldId('notes')} className={styles.label}>
                {config.notesLabel}
              </label>
              <p id={helpId('notes')} className={styles.help}>
                {config.notesHelp}
              </p>
              <textarea
                id={fieldId('notes')}
                name="notes"
                className={styles.textarea}
                value={form.notes}
                onChange={(event) => update('notes', event.target.value)}
                aria-describedby={helpId('notes')}
                rows={3}
                maxLength={400}
              />
            </div>
          </fieldset>

          {/* ---------- How to reach you ---------- */}
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>How to reach you</legend>

            <div className={styles.field}>
              <label htmlFor={fieldId('name')} className={styles.label}>
                Your name <span className={styles.required}>(required)</span>
              </label>
              <input
                id={fieldId('name')}
                name="name"
                type="text"
                className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                autoComplete="name"
                required
                maxLength={80}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? errorId('name') : undefined}
              />
              {errors.name ? (
                <p id={errorId('name')} className={styles.error}>
                  <span className={styles.errorMark} aria-hidden="true">
                    !
                  </span>
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <label htmlFor={fieldId('phone')} className={styles.label}>
                Phone number <span className={styles.required}>(required)</span>
              </label>
              <p id={helpId('phone')} className={styles.help}>
                Ten digits is enough for an Indian mobile. Calling from outside India? Start with +
                and your country code.
              </p>
              <input
                id={fieldId('phone')}
                name="phone"
                type="tel"
                inputMode="tel"
                className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                value={form.phone}
                onChange={(event) => update('phone', event.target.value)}
                autoComplete="tel"
                required
                maxLength={20}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={
                  errors.phone ? `${helpId('phone')} ${errorId('phone')}` : helpId('phone')
                }
              />
              {errors.phone ? (
                <p id={errorId('phone')} className={styles.error}>
                  <span className={styles.errorMark} aria-hidden="true">
                    !
                  </span>
                  {errors.phone}
                </p>
              ) : null}
            </div>

            <RadioGroup
              name="contactPreference"
              legend="Best time to call"
              options={CONTACT_PREFERENCE_OPTIONS}
              value={form.contactPreference}
              onChange={(value) => update('contactPreference', value)}
              fieldId={fieldId('contactPreference')}
              errorId={errorId('contactPreference')}
            />

            <div className={styles.field}>
              <div className={styles.checkboxRow}>
                <input
                  id={fieldId('consent')}
                  name="consent"
                  type="checkbox"
                  className={styles.checkbox}
                  checked={form.consent}
                  onChange={(event) => update('consent', event.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? errorId('consent') : undefined}
                />
                <label htmlFor={fieldId('consent')} className={styles.checkboxLabel}>
                  {consentNoticeText ??
                    `I am happy for ${CANONICAL_BRAND} to keep these details and contact me about this property requirement.`}
                </label>
              </div>
              {errors.consent ? (
                <p id={errorId('consent')} className={styles.error}>
                  <span className={styles.errorMark} aria-hidden="true">
                    !
                  </span>
                  {errors.consent}
                </p>
              ) : null}

              {/* Separate, optional, never preselected. */}
              <div className={styles.checkboxRow}>
                <input
                  id={fieldId('marketingConsent')}
                  name="marketingConsent"
                  type="checkbox"
                  className={styles.checkbox}
                  checked={form.marketingConsent}
                  onChange={(event) => update('marketingConsent', event.target.checked)}
                />
                <label htmlFor={fieldId('marketingConsent')} className={styles.checkboxLabel}>
                  Optional: you may also contact me about other property that might suit me.
                </label>
              </div>
            </div>
          </fieldset>

          <p className={styles.expectation}>{config.expectationNote}</p>

          <div className={styles.submitRow}>
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting ? 'Sending…' : config.submitLabel}
            </button>
            <a href={PRIMARY_PHONE_TEL} className={styles.submitRowPhone}>
              or call {PRIMARY_PHONE}
            </a>
          </div>

          {/*
            Polite live region for the sending state. Separate from the error
            summary so a pending announcement does not interrupt an error one.
          */}
          <p role="status" aria-live="polite" className="visually-hidden">
            {submitting ? 'Sending your enquiry.' : ''}
          </p>
        </form>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Radio group
// -----------------------------------------------------------------------------

function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  required = false,
  error,
  fieldId,
  errorId,
  help,
  helpId,
}: {
  name: string;
  legend: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  fieldId: string;
  errorId: string;
  help?: string;
  helpId?: string;
}) {
  const describedBy = [help && helpId ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <fieldset
      className={styles.radioFieldset}
      aria-describedby={describedBy || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className={styles.radioLegend} id={fieldId}>
        {legend} {required ? <span className={styles.required}>(required)</span> : null}
      </legend>
      {help && helpId ? (
        <p id={helpId} className={styles.help}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          <span className={styles.errorMark} aria-hidden="true">
            !
          </span>
          {error}
        </p>
      ) : null}
      <div className={styles.radioGrid}>
        {options.map((option) => {
          const id = `${fieldId}-${option.value}`;
          const selected = value === option.value;
          return (
            <div key={option.value} className={`${styles.radioOption} ${selected ? styles.radioOptionSelected : ''}`}>
              <input
                id={id}
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className={styles.radioInput}
              />
              <label htmlFor={id} className={styles.radioLabel}>
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
