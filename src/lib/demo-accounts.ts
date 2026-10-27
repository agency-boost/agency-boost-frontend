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
        role: 'AB',
        email: 'agus@kpm0417.test',
        password: FIELD,
        lands: 'Their unit. Neither Owner nor Admin, so the office settings stay closed',
      },
      {
        role: 'AAB · leads two',
        email: 'sari@kpm0417.test',
        password: FIELD,
        lands: 'Their unit, and the approval inbox once it is built',
      },
      {
        role: 'AAB · leads nobody',
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

/**
 * Which environments may show seeded credentials, and the only ones.
 *
 * This used to be keyed on `NODE_ENV !== 'production'`, which cannot express what is
 * wanted: `next build` sets `NODE_ENV=production` for *every* deployment, staging
 * included, so the list compiled to `[]` and the panel could never appear on a deployed
 * environment at all. Staging runs against the seeded demo tenant and exists to be tried
 * by people who are not developers, so the accounts belong there — and nowhere else.
 *
 * `NEXT_PUBLIC_APP_ENV` names the environment rather than the build mode, which is the
 * distinction that was missing.
 *
 * **Written twice on purpose**, because the two gates have incompatible requirements:
 *
 * - `IS_DEMO_BUILD` must be a literal comparison Next can inline and the minifier can
 *   fold, so a build for anywhere else drops `SEEDED` from the bundle entirely. A
 *   function call here would not fold, and the credentials would ship. `pnpm
 *   check:secrets` asserts that against the artifact, not the config.
 * - `showDemoAccounts` must read the variable *on each call*, because that is the only
 *   gate a test can move and a dev server can change without a rebuild.
 *
 * Both fail closed: unset, misspelled, or `production` all mean no.
 *
 * **A prospect-facing demo deployment is not a demo-accounts environment** (ADR-0041, amended
 * 2026-10-01, P10.1-T2 AC-11). It names itself `demo`, which is deliberately not in this list,
 * so its build folds `SEEDED` away like production's: an office being shown the product must
 * never be shown a seeded password. Staging keeps the panel for the people ADR-0041 kept it
 * for — testers who are not developers. `pnpm check:secrets` is the proof, against the artifact.
 */
const IS_DEMO_BUILD =
  process.env.NEXT_PUBLIC_APP_ENV === 'development' ||
  process.env.NEXT_PUBLIC_APP_ENV === 'staging';

export const DEMO_GROUPS: readonly DemoGroup[] = IS_DEMO_BUILD ? SEEDED : [];

/** Flattened, for anything that wants the accounts without their grouping. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = DEMO_GROUPS.flatMap((g) => g.accounts);

/**
 * The operational gate, read fresh each call — see the note above for why it repeats the
 * comparison rather than sharing a helper.
 *
 * The length check is the belt: if the seed list is ever empty, a heading with nothing
 * under it is worse than no panel at all.
 */
export function showDemoAccounts(): boolean {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  return (
    (appEnv === 'development' || appEnv === 'staging') &&
    DEMO_ACCOUNTS.length > 0
  );
}
