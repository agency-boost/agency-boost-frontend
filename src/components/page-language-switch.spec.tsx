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
/** The quote tool's price table, as `GET /admin/billing/prices` serves it. */
const PRICES = {
  currency: 'IDR',
  annualDiscountPct: 5,
  tiers: [
    { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), sixMonthMinor: rp(400_000), annualMinor: rp(380_000), customPricing: false },
    { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), sixMonthMinor: rp(375_000), annualMinor: rp(356_250), customPricing: false },
    { code: 'TIER_21_50', minLeaders: 21, maxLeaders: 50, standardMinor: rp(450_000), sixMonthMinor: rp(350_000), annualMinor: rp(332_500), customPricing: false },
    { code: 'TIER_51_100', minLeaders: 51, maxLeaders: 100, standardMinor: rp(425_000), sixMonthMinor: rp(300_000), annualMinor: rp(285_000), customPricing: false },
    { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: rp(375_000), sixMonthMinor: rp(250_000), annualMinor: rp(237_500), customPricing: true },
  ],
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
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: [] } });
    renderLive(inShell(<BillingPage />), { me: SUPER_ADMIN });

    await screen.findByRole('heading', { level: 1 });
    expect(switchIn(document.querySelector('main')!)).toBeNull();
  });

  it('P19.2-T1 AC-11 Billing carries none while the switch is not live either', async () => {
    atWidth(1280);
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: [] } });
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
