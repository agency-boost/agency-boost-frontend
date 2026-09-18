import { afterEach, describe, expect, it } from 'vitest';
import { DEMO_ACCOUNTS, DEMO_GROUPS, showDemoAccounts } from './demo-accounts';

const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;

describe('demo accounts', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
  });

  it('shows on development and on staging, and on nothing else', () => {
    // Staging was added deliberately (ADR-0041): it runs against the same seeded tenant
    // and is tried by people who are not developers, who have no other way in.
    for (const value of ['development', 'staging']) {
      process.env.NEXT_PUBLIC_APP_ENV = value;
      expect(showDemoAccounts()).toBe(true);
    }
  });

  it('fails closed on anything else, including unset', () => {
    // Credentials in a client bundle are safe only while this cannot be true by
    // accident. An unset variable must hide the panel, not reveal it.
    for (const value of ['production', 'preview', 'staging-2', 'Staging', '', 'Development']) {
      process.env.NEXT_PUBLIC_APP_ENV = value;
      expect(showDemoAccounts()).toBe(false);
    }
    delete process.env.NEXT_PUBLIC_APP_ENV;
    expect(showDemoAccounts()).toBe(false);
  });

  it('has nothing to show once the list has compiled away', () => {
    // The structural gate is NEXT_PUBLIC_APP_ENV read at module load: a bundle built for
    // production holds an empty list, so the panel cannot render even if the variable is
    // somehow flipped afterwards. This asserts the runtime consequence;
    // `scripts/check-no-demo-credentials.mjs` asserts that the strings are genuinely
    // absent from the build output.
    process.env.NEXT_PUBLIC_APP_ENV = 'development';
    expect(showDemoAccounts()).toBe(DEMO_ACCOUNTS.length > 0);
  });

  it('groups the accounts by where they live', () => {
    expect(DEMO_GROUPS.map((g) => g.label)).toEqual([
      'Platform',
      'KPM 0417 · BSD City Branch',
      'KPM 0555 · Kelapa Gading Branch',
      'Edge cases',
    ]);
  });

  it('covers every role the product has, not only the ones with screens', () => {
    const roles = DEMO_ACCOUNTS.map((a) => a.role).join(' | ');
    for (const role of ['Super Admin', 'KPM Owner', 'KPM Admin', 'Agency Builder', 'Associate AB', 'Agent']) {
      expect(roles).toContain(role);
    }
  });

  it('covers the states a role alone cannot reach', () => {
    // Each of these exists because some behaviour is only visible through it. A cast
    // that is only one account per role cannot demonstrate any of them.
    const roles = DEMO_ACCOUNTS.map((a) => a.role);
    expect(roles).toContain('Associate AB · leads nobody'); // OD-23
    expect(roles).toContain('Waiting on a leader'); // the join gate
    expect(roles).toContain('Registered, asked nobody'); // the untagged pool
    expect(roles).toContain('Removed'); // what survives leaving
    expect(roles).toContain('No office at all'); // where everybody starts
    expect(roles).toContain('Office suspended'); // an error that is not a permission error
  });

  it('offers two offices, so isolation is something you can see rather than trust', () => {
    const offices = new Set(
      DEMO_ACCOUNTS.map((a) => a.email.match(/@kpm(\d+)\./)?.[1]).filter(Boolean),
    );
    expect(offices.size).toBeGreaterThanOrEqual(2);
  });

  it('matches the seed in backend/src/seed/demo.ts', () => {
    // Two repositories, so nothing can enforce this. Pinning the values here at least
    // makes a drifting seed fail a test rather than only failing a reviewer's sign-in.
    const byEmail = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [a.email, a.password]));
    expect(byEmail['superadmin@agencyboost.test']).toBe('demo super admin');
    expect(byEmail['owner@kpm0417.test']).toBe('demo password 0417');
    expect(byEmail['rina@kpm0417.test']).toBe('demo password rina');
    // Everything else shares one, so the panel stays readable.
    const shared = DEMO_ACCOUNTS.filter(
      (a) => !['superadmin@agencyboost.test', 'owner@kpm0417.test', 'rina@kpm0417.test'].includes(a.email),
    );
    expect(shared.every((a) => a.password === 'demo password field')).toBe(true);
  });

  it('says where each one lands, so a reviewer can pick without guessing', () => {
    expect(DEMO_ACCOUNTS.every((a) => a.lands.length > 10)).toBe(true);
  });
});
