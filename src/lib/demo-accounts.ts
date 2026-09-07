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
  /** Where this account lands after signing in, and why it is worth having. */
  readonly lands: string;
}

export interface DemoGroup {
  readonly label: string;
  readonly accounts: readonly DemoAccount[];
}

/** Every field account shares one password, so the panel stays readable. */
const FIELD = 'demo password field';

const SEEDED: readonly DemoGroup[] = [
  {
    label: 'Platform',
    accounts: [
      {
        role: 'Super Admin',
        email: 'superadmin@agencyboost.test',
        password: 'demo super admin',
        lands: 'The platform console — KPMs, companies, the audit log',
      },
      {
        role: 'Super Admin (second)',
        email: 'root@agencyboost.test',
        password: FIELD,
        lands: 'The same, and the one you impersonate to see that refusal',
      },
    ],
  },
  {
    label: 'KPM 0417 · BSD City Branch',
    accounts: [
      {
        role: 'KPM Owner',
        email: 'owner@kpm0417.test',
        password: 'demo password 0417',
        lands: 'Their office overview. An AB at the root of the tree as well',
      },
      {
        role: 'KPM Admin',
        email: 'admin@kpm0417.test',
        password: FIELD,
        lands: 'The same office. Also an AB — admin rights and hierarchy role are independent',
      },
      {
        role: 'Agency Builder',
        email: 'agus@kpm0417.test',
        password: FIELD,
        lands: 'Their unit. Neither Owner nor Admin, so the office settings stay closed',
      },
      {
        role: 'Associate AB · leads two',
        email: 'sari@kpm0417.test',
        password: FIELD,
        lands: 'Their unit, and the approval inbox once it is built',
      },
      {
        role: 'Associate AB · leads nobody',
        email: 'dewi@kpm0417.test',
        password: FIELD,
        lands: 'Their own day — no unit, because leading is the graph and not the role',
      },
      {
        role: 'Agent',
        email: 'rina@kpm0417.test',
        password: 'demo password rina',
        lands: 'Log activity. Reports to Sari',
      },
      {
        role: 'Agent',
        email: 'budi@kpm0417.test',
        password: FIELD,
        lands: 'The same. A second one, so a unit has more than one row',
      },
      {
        role: 'Waiting on a leader',
        email: 'pending@kpm0417.test',
        password: FIELD,
        lands: 'Find your leader — registered, request sent, not yet approved',
      },
      {
        role: 'Registered, asked nobody',
        email: 'untagged@kpm0417.test',
        password: FIELD,
        lands: 'Find your leader, with nothing sent yet',
      },
      {
        role: 'Removed',
        email: 'removed@kpm0417.test',
        password: FIELD,
        lands: 'Their account only. The row and its history stay with the office',
      },
    ],
  },
  {
    label: 'KPM 0555 · Kelapa Gading Branch',
    accounts: [
      {
        role: 'KPM Owner',
        email: 'owner@kpm0555.test',
        password: FIELD,
        lands: 'A second office — sign in here to see that neither can reach the other',
      },
      {
        role: 'Agent',
        email: 'agent@kpm0555.test',
        password: FIELD,
        lands: 'The same office, from the field',
      },
    ],
  },
  {
    label: 'Edge cases',
    accounts: [
      {
        role: 'No office at all',
        email: 'newcomer@agencyboost.test',
        password: FIELD,
        lands: 'Register KPM — the only thing there is to do',
      },
      {
        role: 'Office suspended',
        email: 'owner@kpm0999.test',
        password: FIELD,
        lands: 'Refused with TENANT_SUSPENDED, which is deliberately not a permission error',
      },
    ],
  },
];

export const DEMO_GROUPS: readonly DemoGroup[] =
  process.env.NODE_ENV === 'production' ? [] : SEEDED;

/** Flattened, for anything that wants the accounts without their grouping. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = DEMO_GROUPS.flatMap((g) => g.accounts);

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
