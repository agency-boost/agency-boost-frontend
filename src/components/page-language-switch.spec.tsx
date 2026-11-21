import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderLive, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import BillingPage from '@/app/(admin)/admin/billing/page';
import { fieldChrome } from '@test/shell-fixtures';
import { AppShell, type NavSection } from './app-shell';
import { PersonIdentity } from './coaching-person';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/billing',
  // P19.23-T5: *Langganan & akses* reads its tab from the query.
  useSearchParams: () => new URLSearchParams(),
}));

const SECTIONS: readonly NavSection[] = [{ label: null, items: [{ label: 'Overview', href: '/admin', icon: 'gauge' }] }];

/** A page in a shell, as a group layout draws one. */
function inShell(page: React.ReactNode) {
  return <AppShell field={fieldChrome()} sections={SECTIONS} user={{ name: 'Root', role: 'Superadmin', initials: 'R' }}>{page}</AppShell>;
}

const SUPER_ADMIN = makeMe({
  user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['billing:read_prices'],
});
const rp = (major: number) => major * 100;
/** *Langganan & akses*' price list, as `GET /admin/billing/prices` serves it (P19.23-T5; ADR-0279 §1). */
const PRICES = {
  currency: 'IDR',
  tiers: [
    { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), offerMinor: rp(400_000), customPricing: false },
    { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), offerMinor: rp(375_000), customPricing: false },
    { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: null, offerMinor: null, customPricing: true },
  ],
  annualDiscountPct: 5, trialDays: 30, graceDays: 7, endingSoonDays: 30, daysPerMonth: 30, perDayRoundingMinor: rp(100),
  bulkPercentMax: 100, noteMax: 500, kpmNameMax: 120, countMax: 10_000, rateMaxMinor: rp(100_000_000),
  breakEven: { policyApeMinor: rp(20_000_000), commissionPct: 20, overridingPct: 10, bonusPct: 10, incomePerPolicyMinor: rp(8_000_000) },
};
/** *Langganan per KPM*, empty. */
const NO_KPMS = {
  summary: { monthlyRevenueMinor: 0, payingKpms: 0, leadersBilled: 0, endingSoon: 0, needsAction: 0, kpms: 0 },
  total: { kpms: 0, leadersUsed: 0, weightedRateMinor: null, perMonthMinor: 0, periodTotalMinor: 0, needsAction: 0 },
  rows: [],
};
const switchIn = (el: HTMLElement) => within(el).queryByRole('group', { name: /^(Language|Bahasa)$/ });

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/**
 * **The two pages that draw their own heading block** carried the switch where `PageHeader` would (P18.10-T2 AC-3).
 * *Changed 2026-11-05 (P19.2-T1 AC-11; UI-129, ADR-0197 §5):* **no page carries it at any size** — it lives in the
 * account menu alone. These pin that the two pages' own headers lost it too, live or not.
 */
describe('P19.2-T1 AC-11 no switch on a page that draws its own header (P18.10-T2 AC-3 reversed)', () => {
  it('P19.2-T1 AC-11 Billing & subscription’s title carries no ID | EN, live', async () => {
    atWidth(1280);
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: NO_KPMS } });
    renderLive(inShell(<BillingPage />), { me: SUPER_ADMIN });

    await screen.findByRole('heading', { level: 1 });
    expect(switchIn(document.querySelector('main')!)).toBeNull();
  });

  it('P19.2-T1 AC-11 Billing carries none while the switch is not live either', async () => {
    atWidth(1280);
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: NO_KPMS } });
    renderWithSession(inShell(<BillingPage />), { me: SUPER_ADMIN });

    await screen.findByRole('heading', { level: 1 });
    expect(switchIn(document.body)).toBeNull();
  });

  it('P19.2-T1 AC-11 a coachee’s name as the page’s title carries no switch beside its toggle, live', () => {
    atWidth(1280);
    stubFetch({});
    renderLive(inShell(
      <PersonIdentity initials="RW" name="Rina Wijaya" line="Agent · Hendra's unit" title>
        <button type="button">Leader view</button>
      </PersonIdentity>,
    ));
    expect(screen.getByRole('button', { name: 'Leader view' })).toBeInTheDocument();
    expect(switchIn(document.querySelector('main')!)).toBeNull();
  });
});
