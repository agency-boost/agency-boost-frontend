/**
 * The accounts `pnpm seed:demo` creates, offered on the sign-in screen so a reviewer
 * does not have to keep the seed output in another window.
 *
 * **This mirrors `backend/src/seed/demo.ts`.** They are two repositories, so nothing can
 * enforce the match — if you change the seed, change this. A mismatch is self-diagnosing:
 * the panel says where the accounts come from, and sign-in fails with the ordinary error.
 *
 * Passwords in client source are safe here and only here, because these accounts exist
 * only in a seeded development database — and because they are **compiled out** of any
 * built bundle, not merely hidden at runtime.
 *
 * That distinction was not free. A runtime-only guard hid the panel but still shipped
 * the strings: `grep "demo super admin" .next/static` found them in a production build.
 * `process.env.NODE_ENV` is inlined as a literal by Next, so the ternary below folds to
 * `[]` at build time and the real list is eliminated. `next build` always sets
 * `NODE_ENV=production`, so the panel exists in `next dev` and nowhere else — which is
 * where it is wanted.
 */
export interface DemoAccount {
  readonly role: string;
  readonly email: string;
  readonly password: string;
  /** Where this account lands after signing in, and why. */
  readonly lands: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] =
  process.env.NODE_ENV === 'production'
    ? []
    : [
        {
          role: 'Super Admin',
          email: 'superadmin@agencyboost.test',
          password: 'demo super admin',
          lands: 'The platform console — tenants, companies, the audit log',
        },
        {
          role: 'KPM Owner',
          email: 'owner@kpm0417.test',
          password: 'demo password 0417',
          lands: 'Their office, 0417 BSD City Branch, with its seeded configuration',
        },
        {
          role: 'Agent',
          email: 'rina@kpm0417.test',
          password: 'demo password rina',
          lands: 'Their account — no office yet, which is the valid new-agent state',
        },
      ];

/**
 * Two gates, and they do different jobs.
 *
 * `NODE_ENV` is the structural one: a built bundle has no accounts to show because the
 * list above compiled to `[]`. `NEXT_PUBLIC_APP_ENV` is the operational one, so the
 * panel can be turned off in a dev server without a code change; it fails closed, so an
 * unset or unrecognised value hides the panel rather than revealing it.
 */
export function showDemoAccounts(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_APP_ENV === 'development' &&
    DEMO_ACCOUNTS.length > 0
  );
}
