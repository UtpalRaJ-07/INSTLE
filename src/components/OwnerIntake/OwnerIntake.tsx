'use client';

import React, { useState } from 'react';
import {
  CANONICAL_BRAND,
  PRIMARY_PHONE,
  PRIMARY_PHONE_TEL,
} from '@/config/constants';
import styles from './OwnerIntake.module.css';

interface OwnerFormData {
  intent: 'sell' | 'rent-out';
  propertyType: string;
  configuration: string;
  locality: string;
  otherLocality: string;
  timeline: string;
  expectedAmount: string;
  ownershipRole: string;
  name: string;
  phone: string;
  email: string;
  consent: boolean;
}

export function OwnerIntake() {
  const [step, setStep] = useState<number>(1);
  const [data, setData] = useState<OwnerFormData>({
    intent: 'sell',
    propertyType: '',
    configuration: '',
    locality: '',
    otherLocality: '',
    timeline: '',
    expectedAmount: '',
    ownershipRole: 'I am the owner',
    name: '',
    phone: '',
    email: '',
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [referenceId, setReferenceId] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  const validateContact = () => {
    const errs: Record<string, string> = {};
    if (!data.name.trim() || data.name.trim().length < 2) {
      errs.name = 'Enter your name';
    }
    const cleanPhone = data.phone.replace(/[^0-9]/g, '');
    const isIndian10Digit = /^[6-9]\d{9}$/.test(cleanPhone);
    const isStandardValid = cleanPhone.length >= 10 && cleanPhone.length <= 15;

    if (!cleanPhone || (!isIndian10Digit && !isStandardValid)) {
      errs.phone = 'Check your phone number';
    }
    if (data.consent !== true) {
      errs.consent = 'Please check the box to agree to INSTLE REAL ESTATE contacting you.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !data.propertyType) {
      setErrors({ propertyType: 'Please select a property type.' });
      return;
    }
    if (step === 2 && !data.locality && !data.otherLocality.trim()) {
      setErrors({ locality: 'Please choose an area or enter where your property is located.' });
      return;
    }
    if (step === 3) {
      if (!validateContact()) return;
      setErrors({});
      setStep(4);
      return;
    }
    setErrors({});
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateContact()) {
      setStep(3);
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      const cleanPhone = data.phone.replace(/[^0-9]/g, '');
      const finalLocality = data.otherLocality.trim() || data.locality || 'Bengaluru';
      const fullAsset = data.configuration
        ? `${data.propertyType} (${data.configuration})`
        : data.propertyType;

      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: data.intent,
          assetType: fullAsset || 'Property',
          localities: [finalLocality],
          timeline: data.timeline || 'Flexible',
          budgetBand: data.expectedAmount.trim() || 'Open to discussion',
          ownershipRole: data.ownershipRole,
          name: data.name.trim(),
          phone: cleanPhone,
          contactPreference: data.email.trim() ? `Phone & Email (${data.email.trim()})` : 'Phone Call',
          consent: data.consent === true,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to send enquiry.');
      }

      setReferenceId(resData.leadId);
      setSubmitted(true);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Unable to send enquiry. Please call our team directly at 9353096264.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper} aria-labelledby="owner-intake-heading">
      <div className={styles.container}>
        <div className={styles.formBox}>
          <div className={styles.metaRow}>
            <span className={styles.badge}>OWNER &amp; LANDLORD ENQUIRY</span>
            <span className={styles.stepCount}>STEP {step} OF 4</span>
          </div>

          <h2 id="owner-intake-heading" className={styles.heading}>
            {data.intent === 'sell'
              ? 'Sell your property in Bengaluru'
              : 'Rent out your property in Bengaluru'}
          </h2>

          <p className={styles.lead}>
            Share your property details with {CANONICAL_BRAND}. We speak to interested buyers and tenants about their requirement before arranging a visit, and we do not publish your details on classified portals.
          </p>

          {/* Stepper track */}
          <div
            className={styles.track}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label="Owner form progress"
          >
            <div className={styles.fill} style={{ width: `${(step / 4) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmBox} role="alert">
              <span className={styles.confirmBadge}>ENQUIRY SENT</span>
              <h3 className={styles.confirmTitle}>Your enquiry has been received</h3>
              <p className={styles.confirmText}>
                Thank you, {data.name}. Our brokerage team has received your property details and will speak with you soon.
              </p>
              <div className={styles.referenceBlock}>
                <span className={styles.refLabel}>Enquiry Reference Number:</span>
                <strong className={styles.refValue}>{referenceId}</strong>
              </div>
              <div className={styles.summaryTable}>
                <p>
                  <strong>Service:</strong>{' '}
                  {data.intent === 'sell' ? 'Sell Property' : 'Rent Out Property'}
                </p>
                <p>
                  <strong>Property type:</strong> {data.propertyType}
                  {data.configuration ? ` (${data.configuration})` : ''}
                </p>
                <p><strong>Area:</strong> {data.otherLocality.trim() || data.locality || 'Bengaluru'}</p>
                <p><strong>Timeline:</strong> {data.timeline || 'Not sure yet'}</p>
                {data.expectedAmount && (
                  <p>
                    <strong>Expected {data.intent === 'sell' ? 'price' : 'rent'}:</strong>{' '}
                    {data.expectedAmount}
                  </p>
                )}
                <p><strong>Your role:</strong> {data.ownershipRole}</p>
              </div>
              <p className={styles.confirmSubtext}>
                Have an urgent question? Speak directly with our team at{' '}
                <a href={PRIMARY_PHONE_TEL} className={styles.inlinePhone}>
                  {PRIMARY_PHONE}
                </a>
                .
              </p>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setSubmitted(false);
                  setStep(1);
                  setData({
                    intent: 'sell',
                    propertyType: '',
                    configuration: '',
                    locality: '',
                    otherLocality: '',
                    timeline: '',
                    expectedAmount: '',
                    ownershipRole: 'I am the owner',
                    name: '',
                    phone: '',
                    email: '',
                    consent: false,
                  });
                }}
              >
                Send another property enquiry
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {apiError && (
                <div className={styles.apiErrorBox} role="alert">
                  <span>{apiError}</span>
                  <a href={PRIMARY_PHONE_TEL} className={styles.errorPhoneBtn}>
                    ☎ Call {PRIMARY_PHONE}
                  </a>
                </div>
              )}

              {/* STEP 1: INTENT & PROPERTY TYPE */}
              {step === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>
                    01. Do you want to sell or rent out your property?
                  </legend>

                  <div className={styles.intentToggleRow}>
                    <button
                      type="button"
                      className={`${styles.intentToggleBtn} ${data.intent === 'sell' ? styles.activeIntent : ''}`}
                      onClick={() => setData({ ...data, intent: 'sell' })}
                    >
                      I want to sell
                    </button>
                    <button
                      type="button"
                      className={`${styles.intentToggleBtn} ${data.intent === 'rent-out' ? styles.activeIntent : ''}`}
                      onClick={() => setData({ ...data, intent: 'rent-out' })}
                    >
                      I want to rent out
                    </button>
                  </div>

                  <p className={styles.stepPrompt}>Select property type:</p>
                  {errors.propertyType && <span className={styles.errorMsg} role="alert">{errors.propertyType}</span>}

                  <div className={styles.optionsGrid}>
                    {[
                      'Flat / Apartment',
                      'Independent House / Villa',
                      ...(data.intent === 'sell' ? ['Site / Plot'] : []),
                      'Commercial Property',
                      'Other',
                    ].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`${styles.optionCard} ${data.propertyType === t ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setData({ ...data, propertyType: t });
                          setErrors({});
                        }}
                      >
                        <span className={styles.optionRadio}>{data.propertyType === t ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{t}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.chipGroup} style={{ marginTop: '24px' }}>
                    <span className={styles.chipGroupLabel}>Size or number of bedrooms:</span>
                    <div className={styles.chipsRow}>
                      {[
                        '1 BHK',
                        '2 BHK',
                        '3 BHK',
                        '4 BHK',
                        '5+ BHK',
                        'Plot / Land',
                        'Other size',
                      ].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`${styles.chipBtn} ${data.configuration === c ? styles.chipSelected : ''}`}
                          onClick={() => setData({ ...data, configuration: c })}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 2: LOCATION & TIMELINE */}
              {step === 2 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>02. Area, timeline &amp; expected price</legend>

                  <p className={styles.stepPrompt}>Where is the property located?</p>
                  {errors.locality && <span className={styles.errorMsg} role="alert">{errors.locality}</span>}

                  <div className={styles.optionsGrid}>
                    {[
                      'Indiranagar / Old Airport Road',
                      'Koramangala & HSR Layout',
                      'Sadashivanagar / Central North',
                      'North Bengaluru / Hebbal Corridor',
                      'Whitefield / East Bengaluru',
                    ].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className={`${styles.optionCard} ${data.locality === loc ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setData({ ...data, locality: loc, otherLocality: '' });
                          setErrors({});
                        }}
                      >
                        <span className={styles.optionRadio}>{data.locality === loc ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{loc}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.fieldGroup} style={{ marginTop: '16px' }}>
                    <label htmlFor="owner-other-locality" className={styles.label}>
                      Or enter another area:
                    </label>
                    <input
                      id="owner-other-locality"
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Jayanagar, JP Nagar, Sarjapur Road"
                      value={data.otherLocality}
                      onChange={(e) => {
                        setData({ ...data, otherLocality: e.target.value, locality: '' });
                        setErrors({});
                      }}
                    />
                  </div>

                  {/* Timing with compliant wording: Want to sell your property soon? Tell us your preferred timeline. */}
                  <div className={styles.chipGroup} style={{ marginTop: '24px' }}>
                    <span className={styles.chipGroupLabel}>
                      {data.intent === 'sell' ? 'When would you like to sell?' : 'When will it be available?'}
                    </span>
                    <p className={styles.fieldHelp} style={{ marginBottom: '10px' }}>
                      {data.intent === 'sell'
                        ? 'Want to sell your property soon? Tell us your preferred timeline.'
                        : 'Tell us when your property is ready for a tenant.'}
                    </p>
                    <div className={styles.chipsRow}>
                      {[
                        'Within 30 days',
                        'Within 3 months',
                        'Later',
                        'Not sure yet',
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.chipBtn} ${data.timeline === t ? styles.chipSelected : ''}`}
                          onClick={() => setData({ ...data, timeline: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.fieldGroup} style={{ marginTop: '20px' }}>
                    <label htmlFor="owner-price" className={styles.label}>
                      {data.intent === 'sell'
                        ? 'Expected price (optional)'
                        : 'Expected monthly rent (optional)'}
                    </label>
                    <input
                      id="owner-price"
                      type="text"
                      className={styles.input}
                      placeholder={
                        data.intent === 'sell'
                          ? 'e.g. ₹2.5 Crore, or open to discussion'
                          : 'e.g. ₹60,000 / month, or open to discussion'
                      }
                      value={data.expectedAmount}
                      onChange={(e) => setData({ ...data, expectedAmount: e.target.value })}
                    />
                  </div>

                  <div className={styles.chipGroup} style={{ marginTop: '20px' }}>
                    <span className={styles.chipGroupLabel}>What is your role?</span>
                    <div className={styles.chipsRow}>
                      {[
                        'I am the owner',
                        'Authorized family member',
                        'Representative',
                      ].map((role) => (
                        <button
                          key={role}
                          type="button"
                          className={`${styles.chipBtn} ${data.ownershipRole === role ? styles.chipSelected : ''}`}
                          onClick={() => setData({ ...data, ownershipRole: role })}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 3: CONTACT & CONSENT */}
              {step === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. Your contact details</legend>
                  <p className={styles.stepPrompt}>
                    How can our brokerage team reach you to discuss your property?
                  </p>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="owner-name" className={styles.label}>
                      Your name *
                    </label>
                    <input
                      id="owner-name"
                      type="text"
                      className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                      placeholder="e.g. Ramesh Basavaraj"
                      value={data.name}
                      onChange={(e) => setData({ ...data, name: e.target.value })}
                      required
                    />
                    {errors.name && <span className={styles.errorMsg} role="alert">{errors.name}</span>}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="owner-phone" className={styles.label}>
                      Phone number *
                    </label>
                    <div className={styles.inputWithPrefix}>
                      <span className={styles.phonePrefix}>🇮🇳 +91</span>
                      <input
                        id="owner-phone"
                        type="tel"
                        className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                        placeholder="9845012345"
                        value={data.phone}
                        onChange={(e) => setData({ ...data, phone: e.target.value })}
                        required
                      />
                    </div>
                    {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                    <span className={styles.help}>
                      We keep your details private. We do not publish your phone number or property details publicly.
                    </span>
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="owner-email" className={styles.label}>
                      Email (optional)
                    </label>
                    <input
                      id="owner-email"
                      type="email"
                      className={styles.input}
                      placeholder="e.g. ramesh@example.com"
                      value={data.email}
                      onChange={(e) => setData({ ...data, email: e.target.value })}
                    />
                  </div>

                  <div className={styles.consentGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={data.consent}
                        onChange={(e) => setData({ ...data, consent: e.target.checked })}
                      />
                      <span>
                        I agree to {CANONICAL_BRAND} storing and using my contact details to discuss my property. No marketing spam or data resale.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errorMsg} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 4: REVIEW */}
              {step === 4 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>04. Review your details</legend>
                  <p className={styles.stepPrompt}>
                    Please check your details before sending your enquiry:
                  </p>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Service</span>
                      <span className={styles.sumVal}>
                        {data.intent === 'sell' ? 'Sell Property' : 'Rent Out Property'}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Property type</span>
                      <span className={styles.sumVal}>
                        {data.propertyType || 'Specified'}
                        {data.configuration ? ` (${data.configuration})` : ''}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Area</span>
                      <span className={styles.sumVal}>
                        {data.otherLocality.trim() || data.locality || 'Bengaluru'}
                      </span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Preferred timeline</span>
                      <span className={styles.sumVal}>{data.timeline || 'Not sure yet'}</span>
                    </div>
                    {data.expectedAmount && (
                      <div className={styles.summaryRow}>
                        <span className={styles.sumKey}>Expected amount</span>
                        <span className={styles.sumVal}>{data.expectedAmount}</span>
                      </div>
                    )}
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Your role</span>
                      <span className={styles.sumVal}>{data.ownershipRole}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Contact details</span>
                      <span className={styles.sumVal}>
                        {data.name} (+91 {data.phone})
                        {data.email ? ` · ${data.email}` : ''}
                      </span>
                    </div>
                  </div>

                  <p className={styles.submitNotice}>
                    Sending this enquiry shares your property details with our team. This is an initial enquiry and does not commit you to an exclusive brokerage agreement.
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className={styles.btnRow}>
                {step > 1 && (
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    ← Edit
                  </button>
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    className={styles.nextBtn}
                    onClick={handleNext}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Sending enquiry...' : 'Send enquiry →'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
