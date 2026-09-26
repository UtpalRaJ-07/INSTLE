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
  assetType: string;
  locality: string;
  ownershipRole: string;
  name: string;
  phone: string;
  consent: boolean;
}

export function OwnerIntake() {
  const [step, setStep] = useState<number>(1);
  const [data, setData] = useState<OwnerFormData>({
    intent: 'sell',
    assetType: '',
    locality: '',
    ownershipRole: '',
    name: '',
    phone: '',
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
      errs.name = 'Full name is required (minimum 2 characters).';
    }
    const cleanPhone = data.phone.replace(/[^0-9]/g, '');
    const isIndian10Digit = /^[6-9]\d{9}$/.test(cleanPhone);
    const isStandardValid = cleanPhone.length >= 10 && cleanPhone.length <= 15;

    if (!cleanPhone || (!isIndian10Digit && !isStandardValid)) {
      errs.phone = 'Valid telephone contact number is required.';
    }
    if (data.consent !== true) {
      errs.consent = 'DPDP consent acknowledgment is required.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !data.assetType) {
      setErrors({ assetType: 'Please select an asset typology.' });
      return;
    }
    if (step === 2 && !data.locality) {
      setErrors({ locality: 'Please select a micro-market or specify your location.' });
      return;
    }
    if (step === 3) {
      if (!validateContact()) return;
      setStep(4);
    } else {
      setErrors({});
      setStep((prev) => Math.min(prev + 1, 4));
    }
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
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: data.intent,
          assetType: data.assetType || 'Open to Guidance',
          localities: data.locality ? [data.locality] : ['Bengaluru'],
          ownershipRole: data.ownershipRole || 'Direct Owner',
          name: data.name.trim(),
          phone: cleanPhone,
          consent: data.consent === true,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Failed to submit mandate.');
      }

      setReferenceId(resData.leadId);
      setSubmitted(true);
    } catch (err: unknown) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'Unable to register mandate. Please call our advisory desk at 9353096264.'
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
            <span className={styles.badge}>OWNER &amp; LANDLORD MANDATE</span>
            <span className={styles.stepCount}>STEP {step} OF 4</span>
          </div>

          <h2 id="owner-intake-heading" className={styles.heading}>
            {data.intent === 'sell'
              ? 'Represent a Property Sale'
              : 'Represent a Landlord Leasing Mandate'}
          </h2>

          <p className={styles.lead}>
            Discreet brokerage representation for Bengaluru property owners. We evaluate buyer or tenant suitability without broadcasting your property details to public listing portals.
          </p>

          {/* Stepper track */}
          <div
            className={styles.track}
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label="Owner intake progress"
          >
            <div className={styles.fill} style={{ width: `${(step / 4) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmBox} role="alert">
              <span className={styles.confirmBadge}>MANDATE REGISTERED</span>
              <h3 className={styles.confirmTitle}>Property Representation Brief Logged</h3>
              <p className={styles.confirmText}>
                Thank you, {data.name}. Your property representation parameters have been logged in our advisory queue.
              </p>
              <div className={styles.referenceBlock}>
                <span className={styles.refLabel}>Mandate Reference:</span>
                <strong className={styles.refValue}>{referenceId}</strong>
              </div>
              <div className={styles.summaryTable}>
                <p><strong>Mandate Type:</strong> {data.intent === 'sell' ? 'Property Sale' : 'Leasing / Rent-Out'}</p>
                <p><strong>Asset Typology:</strong> {data.assetType || 'Specified'}</p>
                <p><strong>Micro-Market:</strong> {data.locality || 'Bengaluru'}</p>
                <p><strong>Ownership Role:</strong> {data.ownershipRole || 'Direct Owner'}</p>
              </div>
              <p className={styles.confirmSubtext}>
                Our team reviews owner representations directly. For immediate consultation or documentation questions, connect with our desk directly at <a href={PRIMARY_PHONE_TEL} className={styles.inlinePhone}>{PRIMARY_PHONE}</a>.
              </p>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setSubmitted(false);
                  setStep(1);
                  setData({
                    intent: 'sell',
                    assetType: '',
                    locality: '',
                    ownershipRole: '',
                    name: '',
                    phone: '',
                    consent: false,
                  });
                }}
              >
                Submit Another Property
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

              {/* STEP 1: INTENT & ASSET */}
              {step === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. Mandate Scope &amp; Asset Typology</legend>
                  
                  <div className={styles.intentToggleRow}>
                    <button
                      type="button"
                      className={`${styles.intentToggleBtn} ${data.intent === 'sell' ? styles.activeIntent : ''}`}
                      onClick={() => setData({ ...data, intent: 'sell' })}
                    >
                      Sell Property
                    </button>
                    <button
                      type="button"
                      className={`${styles.intentToggleBtn} ${data.intent === 'rent-out' ? styles.activeIntent : ''}`}
                      onClick={() => setData({ ...data, intent: 'rent-out' })}
                    >
                      Lease to Tenant (Landlord)
                    </button>
                  </div>

                  <p className={styles.stepPrompt}>Select property typology:</p>
                  {errors.assetType && <span className={styles.errorMsg} role="alert">{errors.assetType}</span>}
                  
                  <div className={styles.optionsGrid}>
                    {[
                      'Independent Villa / House',
                      'High-Specification Apartment',
                      'Penthouse / Luxury Duplex',
                      'Residential Plot / Land Parcel',
                      'Commercial Property (Held Pending Counsel Approval)',
                    ].map((t) => {
                      const isCommercial = t.includes('Commercial');
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={isCommercial}
                          className={`${styles.optionCard} ${data.assetType === t ? styles.selectedOption : ''} ${isCommercial ? styles.disabledOption : ''}`}
                          onClick={() => {
                            if (!isCommercial) {
                              setData({ ...data, assetType: t });
                              setErrors({});
                            }
                          }}
                        >
                          <span className={styles.optionRadio}>{data.assetType === t ? '●' : '○'}</span>
                          <span className={styles.optionLabel}>{t}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {/* STEP 2: LOCATION & OWNERSHIP ROLE */}
              {step === 2 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>02. Location &amp; Ownership Verification</legend>
                  
                  <p className={styles.stepPrompt}>Where is the property located?</p>
                  {errors.locality && <span className={styles.errorMsg} role="alert">{errors.locality}</span>}
                  
                  <div className={styles.optionsGrid}>
                    {[
                      'Indiranagar / Old Airport Road',
                      'Koramangala & Surrounding Blocks',
                      'Sadashivanagar / Palace Orchards',
                      'North Bengaluru / Hebbal Corridor',
                      'Other Prime Bengaluru Enclave',
                    ].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        className={`${styles.optionCard} ${data.locality === loc ? styles.selectedOption : ''}`}
                        onClick={() => {
                          setData({ ...data, locality: loc });
                          setErrors({});
                        }}
                      >
                        <span className={styles.optionRadio}>{data.locality === loc ? '●' : '○'}</span>
                        <span className={styles.optionLabel}>{loc}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.fieldGroup} style={{ marginTop: '20px' }}>
                    <label htmlFor="owner-role" className={styles.label}>
                      Your Representation Role
                    </label>
                    <select
                      id="owner-role"
                      className={styles.select}
                      value={data.ownershipRole}
                      onChange={(e) => setData({ ...data, ownershipRole: e.target.value })}
                    >
                      <option value="">Select your role</option>
                      <option value="Direct Title Owner">Direct Title Owner</option>
                      <option value="Co-Owner / Family Representative">Co-Owner / Family Representative</option>
                      <option value="Authorized Corporate Representative">Authorized Corporate Representative</option>
                    </select>
                  </div>
                </fieldset>
              )}

              {/* STEP 3: CONTACT & DPDP CONSENT */}
              {step === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. Owner Contact &amp; Confidentiality</legend>
                  <p className={styles.stepPrompt}>Provide your direct telephone details for confidential communication:</p>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="owner-name" className={styles.label}>
                      Full Legal / Representative Name *
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
                      Telephone Number *
                    </label>
                    <input
                      id="owner-phone"
                      type="tel"
                      className={`${styles.input} ${errors.phone ? styles.inputError : ''}`}
                      placeholder="e.g. 9845012345"
                      value={data.phone}
                      onChange={(e) => setData({ ...data, phone: e.target.value })}
                      required
                    />
                    {errors.phone && <span className={styles.errorMsg} role="alert">{errors.phone}</span>}
                    <span className={styles.help}>Strict confidentiality: We do not publish your property or telephone number publicly.</span>
                  </div>

                  <div className={styles.consentGroup}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={data.consent}
                        onChange={(e) => setData({ ...data, consent: e.target.checked })}
                      />
                      <span>
                        I consent to {CANONICAL_BRAND} storing and processing these details under Indian privacy principles solely for advisory communication.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errorMsg} role="alert">{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 4: REVIEW */}
              {step === 4 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>04. Review &amp; Register Mandate</legend>
                  <p className={styles.stepPrompt}>Verify your representation details before transmitting to our advisory queue:</p>

                  <div className={styles.summaryCard}>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Mandate Objective</span>
                      <span className={styles.sumVal}>{data.intent === 'sell' ? 'Property Sale' : 'Lease to Tenant'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Asset Typology</span>
                      <span className={styles.sumVal}>{data.assetType || 'Specified'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Micro-Market</span>
                      <span className={styles.sumVal}>{data.locality || 'Bengaluru'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Ownership Role</span>
                      <span className={styles.sumVal}>{data.ownershipRole || 'Direct Owner'}</span>
                    </div>
                    <div className={styles.summaryRow}>
                      <span className={styles.sumKey}>Contact</span>
                      <span className={styles.sumVal}>{data.name} ({data.phone})</span>
                    </div>
                  </div>

                  <p className={styles.submitNotice}>
                    Submitting registers this mandate in our internal queue. You can also connect directly by calling {PRIMARY_PHONE}.
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
                    ← Back
                  </button>
                )}

                {step < 4 ? (
                  <button
                    type="button"
                    className={styles.nextBtn}
                    onClick={handleNext}
                  >
                    Next Stage →
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Registering Mandate...' : 'Transmit Owner Mandate →'}
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
