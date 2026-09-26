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
    assetType: 'Independent Villa / House',
    locality: 'Indiranagar / Old Airport Road',
    ownershipRole: 'Direct Title Owner',
    name: '',
    phone: '',
    consent: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);

  const validateContact = () => {
    const errs: Record<string, string> = {};
    if (!data.name.trim()) errs.name = 'Full name is required.';
    const cleanPhone = data.phone.replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      errs.phone = 'Valid telephone contact number is required.';
    }
    if (!data.consent) {
      errs.consent = 'DPDP consent acknowledgment is required.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 3) {
      if (!validateContact()) return;
      setStep(4);
    } else {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateContact()) {
      setStep(3);
      return;
    }
    setSubmitted(true);
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
              ? 'Commission a Property Sale Representation'
              : 'Commission a Landlord Leasing Mandate'}
          </h2>

          <p className={styles.lead}>
            Discreet brokerage representation for Bengaluru property owners. We evaluate buyer or tenant suitability without broadcasting your property details to public listing portals.
          </p>

          {/* Stepper track */}
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${(step / 4) * 100}%` }} />
          </div>

          {submitted ? (
            <div className={styles.confirmBox} role="alert">
              <span className={styles.confirmBadge}>LOCAL PREVIEW RECEIPT</span>
              <h3 className={styles.confirmTitle}>Mandate Inquiry Received</h3>
              <p className={styles.confirmText}>
                Thank you, {data.name}. This local preview simulates an owner mandate submission for {CANONICAL_BRAND}. An assigned brokerage lead will contact you at {data.phone} to review documentation and next steps.
              </p>
              <div className={styles.summaryTable}>
                <p><strong>Mandate Type:</strong> {data.intent === 'sell' ? 'Property Sale' : 'Leasing / Rent-Out'}</p>
                <p><strong>Asset Classification:</strong> {data.assetType}</p>
                <p><strong>Micro-Market:</strong> {data.locality}</p>
                <p><strong>Ownership Role:</strong> {data.ownershipRole}</p>
              </div>
              <button
                type="button"
                className={styles.resetBtn}
                onClick={() => {
                  setSubmitted(false);
                  setStep(1);
                }}
              >
                Submit Another Mandate
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* STEP 1: INTENT & ASSET */}
              {step === 1 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>01. Mandate Scope &amp; Asset Classification</legend>
                  
                  <div className={styles.subBlock}>
                    <label className={styles.blockLabel}>Select Representation Intent</label>
                    <div className={styles.intentToggle}>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${data.intent === 'sell' ? styles.toggleActive : ''}`}
                        onClick={() => setData({ ...data, intent: 'sell' })}
                      >
                        Sell Property
                      </button>
                      <button
                        type="button"
                        className={`${styles.toggleBtn} ${data.intent === 'rent-out' ? styles.toggleActive : ''}`}
                        onClick={() => setData({ ...data, intent: 'rent-out' })}
                      >
                        Lease / Rent-Out
                      </button>
                    </div>
                  </div>

                  <div className={styles.subBlock} style={{ marginTop: '20px' }}>
                    <label className={styles.blockLabel}>Property Classification</label>
                    <div className={styles.cardGrid}>
                      {[
                        'Independent Villa / House',
                        'Prime Penthouse / Apartment',
                        'Plotted Land Parcel',
                        'Other Residential Asset',
                      ].map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`${styles.selectBtn} ${data.assetType === t ? styles.btnSelected : ''}`}
                          onClick={() => setData({ ...data, assetType: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 2: LOCATION & OWNERSHIP */}
              {step === 2 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>02. Locality &amp; Ownership Authorization</legend>

                  <div className={styles.subBlock}>
                    <label className={styles.blockLabel}>Bengaluru Micro-Market</label>
                    <div className={styles.cardGrid}>
                      {[
                        'Indiranagar / Old Airport Road',
                        'Koramangala / HSR Layout',
                        'Sadashivanagar / Central Heritage',
                        'Hebbal / Bellary Road Corridor',
                        'Whitefield / Outer Ring Road',
                        'Other Bengaluru Locality',
                      ].map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          className={`${styles.selectBtn} ${data.locality === loc ? styles.btnSelected : ''}`}
                          onClick={() => setData({ ...data, locality: loc })}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.subBlock} style={{ marginTop: '20px' }}>
                    <label className={styles.blockLabel}>Your Representation Authority</label>
                    <div className={styles.cardGrid}>
                      {[
                        'Direct Title Owner',
                        'Joint / Family Co-Owner',
                        'Authorized Power of Attorney',
                        'Family Estate Representative',
                      ].map((role) => (
                        <button
                          key={role}
                          type="button"
                          className={`${styles.selectBtn} ${data.ownershipRole === role ? styles.btnSelected : ''}`}
                          onClick={() => setData({ ...data, ownershipRole: role })}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {/* STEP 3: CONTACT & DPDP CONSENT */}
              {step === 3 && (
                <fieldset className={styles.fieldset}>
                  <legend className={styles.legend}>03. Owner Contact Details</legend>
                  <p className={styles.prompt}>
                    Details are maintained under strict confidentiality. We do not broadcast ownership information.
                  </p>

                  <div className={styles.inputGroup}>
                    <label htmlFor="owner-name" className={styles.inputLabel}>
                      Full Name *
                    </label>
                    <input
                      id="owner-name"
                      type="text"
                      className={`${styles.input} ${errors.name ? styles.inputErr : ''}`}
                      value={data.name}
                      onChange={(e) => setData({ ...data, name: e.target.value })}
                      placeholder="e.g. Basavaraj"
                      required
                    />
                    {errors.name && <span className={styles.errSpan}>{errors.name}</span>}
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="owner-phone" className={styles.inputLabel}>
                      Telephone Number *
                    </label>
                    <input
                      id="owner-phone"
                      type="tel"
                      className={`${styles.input} ${errors.phone ? styles.inputErr : ''}`}
                      value={data.phone}
                      onChange={(e) => setData({ ...data, phone: e.target.value })}
                      placeholder="e.g. 9845012345"
                      required
                    />
                    {errors.phone && <span className={styles.errSpan}>{errors.phone}</span>}
                  </div>

                  <div className={styles.consentWrap}>
                    <label className={styles.consentLabel}>
                      <input
                        type="checkbox"
                        checked={data.consent}
                        onChange={(e) => setData({ ...data, consent: e.target.checked })}
                        className={styles.check}
                        required
                      />
                      <span>
                        I consent to {CANONICAL_BRAND} contacting me regarding this property representation request under India DPDP Act 2023. Zero disclosure to unauthorized third parties.
                      </span>
                    </label>
                    {errors.consent && <span className={styles.errSpan}>{errors.consent}</span>}
                  </div>
                </fieldset>
              )}

              {/* STEP 4: REVIEW & CONFIRM */}
              {step === 4 && (
                <div className={styles.fieldset}>
                  <legend className={styles.legend}>04. Review Representation Parameters</legend>
                  <p className={styles.prompt}>Verify details prior to transmitting to our advisory desk.</p>

                  <div className={styles.summaryTable}>
                    <div className={styles.sumRow}>
                      <span>Mandate Track:</span>
                      <strong>{data.intent === 'sell' ? 'Property Sale' : 'Leasing / Rent-Out'}</strong>
                    </div>
                    <div className={styles.sumRow}>
                      <span>Property Category:</span>
                      <strong>{data.assetType}</strong>
                    </div>
                    <div className={styles.sumRow}>
                      <span>Micro-Market:</span>
                      <strong>{data.locality}</strong>
                    </div>
                    <div className={styles.sumRow}>
                      <span>Ownership Status:</span>
                      <strong>{data.ownershipRole}</strong>
                    </div>
                    <div className={styles.sumRow}>
                      <span>Contact Representative:</span>
                      <strong>{data.name} ({data.phone})</strong>
                    </div>
                  </div>

                  <p className={styles.notice}>
                    Or discuss immediately with our senior brokerage desk: <a href={PRIMARY_PHONE_TEL}>{PRIMARY_PHONE}</a>.
                  </p>
                </div>
              )}

              <div className={styles.navRow}>
                {step > 1 && (
                  <button type="button" className={styles.backBtn} onClick={() => setStep((s) => s - 1)}>
                    ← Back
                  </button>
                )}

                {step < 4 ? (
                  <button type="button" className={styles.nextBtn} onClick={handleNext}>
                    Next Step →
                  </button>
                ) : (
                  <button type="submit" className={styles.submitBtn}>
                    Submit Mandate Request →
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
