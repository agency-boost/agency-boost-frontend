import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, showDemoAccounts } from './demo-accounts';

const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;

describe('demo accounts', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  });

  it('shows only when the environment explicitly says development', () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    expect(showDemoAccounts()).toBe(true);
  });

  it('fails closed on anything else, including unset', () => {
    // Credentials in a client bundle are safe only while this cannot be true by
    // accident. An unset variable must hide the panel, not reveal it.
    for (const value of ['production', 'staging', 'preview', '', 'Development']) {
      process.env.NEXT_PUBLIC_APP_ENV = value;
      expect(showDemoAccounts()).toBe(false);
    }
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(showDemoAccounts()).toBe(false);
  });

  it('has nothing to show once the list has compiled away', () => {
    // The structural gate is NODE_ENV: a built bundle holds an empty list, so the panel
    // cannot render even if NEXT_PUBLIC_APP_ENV somehow says development. This asserts
    // the runtime consequence; `scripts/check-no-demo-credentials.mjs` asserts that the
    // strings are genuinely absent from the build output.
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    expect(showDemoAccounts()).toBe(DEMO_ACCOUNTS.length > 0);
  });

  it('covers every role a reviewer needs to walk Phase 2', () => {
    expect(DEMO_ACCOUNTS.map((a) => a.role)).toEqual(['Super Admin', 'KPM Owner', 'Agent']);
  });

  it('matches the seed in backend/src/seed/demo.ts', () => {
    // Two repositories, so nothing can enforce this. Pinning the values here at least
    // makes a drifting seed fail a test rather than only failing a reviewer's sign-in.
    expect(DEMO_ACCOUNTS).toEqual([
      expect.objectContaining({
        email: 'superadmin@agencyboost.test',
        password: 'demo super admin',
      }),
      expect.objectContaining({
        email: 'owner@kpm0417.test',
        password: 'demo password 0417',
      }),
      expect.objectContaining({
        email: 'rina@kpm0417.test',
        password: 'demo password rina',
      }),
    ]);
  });
});
