import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderLive, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import BillingPage from '@/app/(admin)/admin/billing/page';
import { AppShell, type NavSection } from './app-shell';
import { PersonIdentity } from './coaching-person';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/billing',
}));

const SECTIONS: readonly NavSection[] = [{ label: null, items: [{ label: 'Overview', href: '/admin', icon: 'gauge' }] }];

/** A page in a shell, as a group layout draws one. */
function inShell(page: React.ReactNode) {
  return <AppShell sections={SECTIONS} user={{ name: 'Root', role: 'Superadmin', initials: 'R' }}>{page}</AppShell>;
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
 * **P18.98-T2 AC-3: the two pages that draw their own heading block** carry the switch where `PageHeader` would: at the
 * top right, before their own controls, from 768px. Nothing until it is live.
 */
describe('P18.98-T2 the switch on a page that draws its own header', () => {
  it('AC-3 sits at the top right of Billing & subscription’s title and launch line, and never on its paper', async () => {
    atWidth(1280);
    stubFetch({ '/admin/billing/prices': { body: PRICES } });
    renderLive(inShell(<BillingPage />), { me: SUPER_ADMIN });

    const heading = await screen.findByRole('heading', { level: 1 });
    const block = heading.parentElement!.parentElement!;
    const group = switchIn(block)!;
    expect(Array.from(block.children)).toEqual([heading.parentElement, group]);
    expect(group).toHaveClass('print:hidden');
  });

  it('AC-3 leaves Billing’s heading as it was while the switch is not live', async () => {
    atWidth(1280);
    stubFetch({ '/admin/billing/prices': { body: PRICES } });
    renderWithSession(inShell(<BillingPage />), { me: SUPER_ADMIN });

    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading.parentElement!.className).toBe('mb-[18px]');
    expect(switchIn(document.body)).toBeNull();
  });

  it('AC-3 sits before a coachee’s view toggle when their name is the page’s title, and not under another title', () => {
    atWidth(1280);
    stubFetch({});
    renderLive(inShell(
      <>
        <PersonIdentity initials="RW" name="Rina Wijaya" line="Agent · Hendra's unit" title>
          <button type="button">Leader view</button>
        </PersonIdentity>
        <PersonIdentity initials="BS" name="Budi Santoso" line={null}>
          <button type="button">Open</button>
        </PersonIdentity>
      </>,
    ));

    const toggle = screen.getByRole('button', { name: 'Leader view' });
    const group = switchIn(document.querySelector('main')!)!;
    expect(Array.from(toggle.parentElement!.children)).toEqual([group, toggle]);
    // The second, an `<h2>` under the page's own title, has no switch of its own.
    expect(within(document.querySelector('main')!).getAllByRole('group', { name: /^(Language|Bahasa)$/ })).toHaveLength(1);
  });
});
