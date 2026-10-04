/**
 * Test setup.
 *
 * Each test file that depends on environment configuration sets and restores its
 * own variables, so the default here is a clean slate: no confirmed domain, no
 * enabled intake, development environment.
 */

import { afterEach, beforeEach } from 'vitest';

const MANAGED_KEYS = [
  'INSTLE_DEPLOY_ENV',
  'INSTLE_PUBLIC_ORIGIN',
  'INSTLE_DOMAIN_CONFIRMED',
  'INSTLE_ENQUIRY_INTAKE_ENABLED',
  'INSTLE_CONSENT_NOTICE_VERSION',
  'INSTLE_CONSENT_NOTICE_TEXT',
  'INSTLE_LEAD_RETENTION_DAYS',
  'INSTLE_LEAD_QUEUE',
  'INSTLE_TRUSTED_PROXY_HOPS',
];

function clearManagedEnv() {
  for (const key of MANAGED_KEYS) {
    delete process.env[key];
  }
}

beforeEach(() => {
  clearManagedEnv();
});

afterEach(() => {
  clearManagedEnv();
});
