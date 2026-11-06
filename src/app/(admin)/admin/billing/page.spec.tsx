import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import type { BillingKpmRow, BillingTier } from '@/lib/billing';
import { atWidth, makeMe, renderInLayout, renderWithSession, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import BillingPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/billing',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // `kpm:list_all` is the console's gate; `billing:read_prices` this route's own.
  permissions: ['kpm:list_all', 'billing:read_prices'],
});

const rp = (major: number) => major * 100;
const TIERS: BillingTier[] = [
  { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10, standardMinor: rp(500_000), sixMonthMinor: rp(400_000), annualMinor: rp(380_000), customPricing: false },
  { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20, standardMinor: rp(475_000), sixMonthMinor: rp(375_000), annualMinor: rp(356_250), customPricing: false },
  { code: 'TIER_21_50', minLeaders: 21, maxLeaders: 50, standardMinor: rp(450_000), sixMonthMinor: rp(350_000), annualMinor: rp(332_500), customPricing: false },
  { code: 'TIER_51_100', minLeaders: 51, maxLeaders: 100, standardMinor: rp(425_000), sixMonthMinor: rp(300_000), annualMinor: rp(285_000), customPricing: false },
  { code: 'TIER_101_PLUS', minLeaders: 101, maxLeaders: null, standardMinor: rp(375_000), sixMonthMinor: rp(250_000), annualMinor: rp(237_500), customPricing: true },
];
const PRICES = { currency: 'IDR', tiers: TIERS, annualDiscountPct: 5 };
const INBOX = { items: [], total: 0, page: 1, pageSize: 1, unread: 0 };

const PRU = { id: 'co-pru', name: 'Prudential' };
const MAN = { id: 'co-man', name: 'Manulife' };
const ROWS: BillingKpmRow[] = [
  {
    kpmId: 'kpm-1', code: '0417', branch: 'BSD City', company: PRU, leadersUsed: 9,
    tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, plan: 'annual', renewalDate: '2027-01-05', status: 'active',
  },
  {
    kpmId: 'kpm-2', code: '0602', branch: 'Bekasi Barat', company: PRU, leadersUsed: 2,
    tier: { code: 'TIER_1_10', minLeaders: 1, maxLeaders: 10 }, plan: 'six_months', renewalDate: '2026-10-02',
    status: 'ended_kept_active',
  },
  {
    kpmId: 'kpm-3', code: '0100', branch: 'Sudirman', company: MAN, leadersUsed: 13,
    tier: { code: 'TIER_11_20', minLeaders: 11, maxLeaders: 20 }, plan: null, renewalDate: null, status: 'none',
  },
];

function renderPage(routes: Parameters<typeof stubFetch>[0] = {
  '/admin/billing/prices': { body: PRICES },
  '/admin/billing/kpms': { body: ROWS },
}) {
  const fetched = stubFetch(routes);
  renderWithSession(<BillingPage />, { me: SUPER_ADMIN });
  return fetched;
}

const table = () => screen.getByRole('table', { name: 'Every KPM, its leaders, tier, plan and renewal' });
const list = () => screen.getByRole('list', { name: 'Every KPM, its leaders, tier, plan and renewal' });
const kpmCalls = (calls: { url: string }[]) => calls
  .map((c) => new URL(c.url))
  .filter((u) => u.pathname.endsWith('/admin/billing/kpms'))
  .map((u) => u.search);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-05T03:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * **`/admin/billing`, one row per KPM** (P19.4-T3 AC-10; ADR-0211 §3; SA UI-015, SA R6, SA case 8): the tiers as a
 * reference strip with no *"TINGKAT ANDA"*, and the list of KPMs — filtered by company and sorted by a column on the
 * server — each row opening the KPM's *Billing* tab, where the calculator moved (its tests are
 * `components/admin/kpm-billing-tab.spec.tsx`).
 */
describe('P19.4-T3 AC-10 Billing & subscription lists the KPMs', () => {
  it('P19.4-T3 AC-10 lists each KPM: company, leaders, tier, plan, renewal and status', async () => {
    renderPage();
    await screen.findByRole('table');

    const headers = within(table()).getAllByRole('columnheader').map((h) => h.textContent?.replace(/[▲▼⇅]/g, '').trim());
    expect(headers).toEqual(['KPM', 'Company', 'Leaders', 'Tier', 'Plan', 'Renewal', 'Status']);
    const rows = within(table()).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['0417BSD City', 'Prudential', '9', '1–10', 'Annual', '5 Jan 2027', 'Active'],
      ['0602Bekasi Barat', 'Prudential', '2', '1–10', '6 months', '2 Oct 2026', 'Ended — kept active'],
      ['0100Sudirman', 'Manulife', '13', '11–20', '—', '—', 'No subscription yet'],
    ]);
  });

  it('P19.4-T3 AC-10 a row opens the KPM’s Billing tab, named for its office', async () => {
    renderPage();
    const link = await screen.findByRole('link', { name: 'KPM 0417 · BSD City, billing' });
    expect(link).toHaveAttribute('href', '/admin/tenants/kpm-1?tab=billing');
  });

  it('P19.4-T3 AC-10 keeps the tiers as a reference strip: no “Your tier”, no calculator, no Talk to us', async () => {
    renderPage();
    const strip = await screen.findByRole('list', { name: 'Price tiers' });
    expect(within(strip).getAllByRole('listitem')).toHaveLength(5);
    expect(strip).toHaveTextContent('IDR 400,000 /leader/mo');
    expect(screen.queryByText('Your tier')).not.toBeInTheDocument();
    expect(screen.queryByText('Estimate your price')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Talk to us' })).not.toBeInTheDocument();
    // The 101+ tier's rates are never on the strip.
    expect(within(strip).getAllByRole('listitem')[4]).not.toHaveTextContent(/Rp|IDR/);
  });

  it('P19.4-T3 AC-10 filters by company on the server, from the companies the list holds', async () => {
    const { calls } = renderPage({
      '/admin/billing/prices': { body: PRICES },
      '/admin/billing/kpms': [{ body: ROWS }, { body: ROWS.slice(2) }],
    });
    await screen.findByRole('table');
    const company = screen.getByLabelText('Company');
    expect(within(company).getAllByRole('option').map((o) => o.textContent)).toEqual(['All companies', 'Manulife', 'Prudential']);

    await userEvent.selectOptions(company, 'Manulife');
    await waitFor(() => expect(within(table()).getAllByRole('row')).toHaveLength(2));
    expect(kpmCalls(calls).at(-1)).toBe('?companyId=co-man&sort=kpm&dir=asc');
    // The other companies stay offered while one is chosen.
    expect(within(company).getAllByRole('option')).toHaveLength(3);
  });

  // P19.2-T2 AC-4 (UI-134: *No native <select> on /admin at 375 or 768*; *a pill that opens a sheet for long lists
  // (company)*): below 1024px the same filter as a pill, navy once it narrows; a laptop keeps the select above.
  it.each([375, 768])('P19.2-T2 AC-4 at %ipx the company filter is a 44px pill opening the companies; a choice filters on the server', async (px) => {
    atWidth(px);
    const { calls } = renderPage({
      '/admin/billing/prices': { body: PRICES },
      '/admin/billing/kpms': [{ body: ROWS }, { body: ROWS.slice(2) }],
    });
    // Rows below 1024px since P19.2-T2 AC-1 (below), where this read a table.
    await screen.findByRole('list', { name: 'Every KPM, its leaders, tier, plan and renewal' });
    expect(document.querySelector('select')).toBeNull();
    const pill = screen.getByRole('button', { name: 'Company: All companies' });
    expect(wears(pill, px)).toContain('min-h-11');
    await userEvent.click(pill);
    const sheet = await screen.findByRole('dialog', { name: 'Choose company' });
    expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['All companies', 'Manulife', 'Prudential']);
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Manulife' }));
    await waitFor(() => expect(within(list()).getAllByRole('listitem')).toHaveLength(1));
    expect(kpmCalls(calls).at(-1)).toBe('?companyId=co-man&sort=kpm&dir=asc');
    expect(screen.getByRole('button', { name: 'Company: Manulife' })).toHaveTextContent('Manulife');
  });

  it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx a laptop keeps the company select', async (px) => {
    atWidth(px);
    renderPage();
    await screen.findByRole('table');
    expect(screen.getByRole('combobox', { name: 'Company' })).toBeInTheDocument();
  });

  it('P19.4-T3 AC-10 sorts by a column on the server, said by aria-sort, the other way on a second press', async () => {
    const { calls } = renderPage();
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: /KPM/ })).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(screen.getByRole('button', { name: /Renewal/ }));
    await waitFor(() => expect(kpmCalls(calls).at(-1)).toBe('?sort=renewal&dir=asc'));
    expect(await screen.findByRole('columnheader', { name: /Renewal/ })).toHaveAttribute('aria-sort', 'ascending');

    await userEvent.click(screen.getByRole('button', { name: /Renewal/ }));
    await waitFor(() => expect(kpmCalls(calls).at(-1)).toBe('?sort=renewal&dir=desc'));
  });

  it('P19.4-T3 AC-10 says when there is no KPM yet', async () => {
    renderPage({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: [] } });
    expect(await screen.findByText('No KPM on the platform yet.')).toBeInTheDocument();
  });

  it('P19.4-T3 AC-10 says the list could not be read, and tries again', async () => {
    const { calls } = renderPage({
      '/admin/billing/prices': { body: PRICES },
      '/admin/billing/kpms': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke.', requestId: 'req-9' } } },
        { body: ROWS },
      ],
    });
    expect(await screen.findByText("The KPMs couldn't be loaded.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(kpmCalls(calls)).toHaveLength(2);
  });

  it('P19.4-T3 AC-10 refuses a reader without the permission, and asks the API for nothing', () => {
    const { calls } = stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: ROWS } });
    renderWithSession(<BillingPage />, { me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    expect(calls).toEqual([]);
  });
  // In Indonesian — SA UI-015's own column names, and no *Tingkat Anda* — is `console-in-indonesian.spec.tsx`'s.
});

describe('P19.4-T3 AC-10 at a phone’s width and a laptop’s', () => {
  // Changed 2026-11-06 (P19.2-T2 AC-1; UI-126: *no sideways scroll inside any /admin table or list at 375, 768, 1024 and
  // 1280*): a phone draws rows, and the laptop's table takes the content's width — its 46rem minimum, which kept a phone's
  // table scrolling inside its box, is gone. The box stays, for a cell that cannot wrap.
  it.each([375, 1280])('P19.4-T3 AC-10 at %ipx the title is the console’s, and nothing scrolls sideways', async (px) => {
    atWidth(px);
    renderPage();
    await screen.findByRole(px < 1024 ? 'list' : 'table', { name: 'Every KPM, its leaders, tier, plan and renewal' });
    const titles = screen.getAllByRole('heading', { level: 1 });
    expect(titles).toHaveLength(1);
    // 20px on a phone like every /admin title (UI-138), the page header's own size from a laptop.
    if (px < 768) expect(wears(titles[0], px)).toContain('text-title');
    else expect(wears(titles[0], px)).toContain('font-display');
    if (px >= 1024) {
      expect(table().className).not.toMatch(/min-w-\[/);
      expect(table().parentElement).toHaveClass('overflow-x-auto');
    } else {
      expect(screen.queryByRole('table')).toBeNull();
    }
    expect(screen.getAllByRole('list')[0]).toHaveClass('grid-cols-[repeat(auto-fit,minmax(170px,1fr))]');
  });
});

describe('the console', () => {
  it('AC-4: “Billing & subscription” is the last item of the KPMs group, and it is current here', async () => {
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: ROWS }, '/notifications': { body: INBOX } });
    renderInLayout(AdminLayout, <BillingPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');

    const nav = screen.getByRole('navigation', { name: 'Main' });
    const link = within(nav).getByRole('link', { name: 'Billing & subscription' });
    expect(link).toHaveAttribute('href', '/admin/billing');
    expect(link).toHaveAttribute('aria-current', 'page');
  });

  it('passes axe in the console, the strip and the list', async () => {
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: ROWS }, '/notifications': { body: INBOX } });
    renderInLayout(AdminLayout, <BillingPage />, { me: SUPER_ADMIN });
    await screen.findByRole('table');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect((results.violations ?? []).map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  });
});

/**
 * **P19.2-T2 — the KPMs below 1024px** (UI-126, UI-134, UI-135): a row per KPM opening its *Billing* tab; the sort a pill,
 * on the server as the headings sort; 44px targets. The laptop keeps its table.
 */
describe('P19.2-T2 Billing’s list below 1024px (UI-126, UI-134, UI-135)', () => {
  it.each([375, 768])('P19.2-T2 AC-1 at %ipx a row per KPM: code · branch opening its Billing tab, the figures after their columns', async (px) => {
    atWidth(px);
    renderPage();
    await screen.findByRole('list', { name: 'Every KPM, its leaders, tier, plan and renewal' });
    expect(screen.queryByRole('table')).toBeNull();
    const [bsd, bekasi, sudirman] = within(list()).getAllByRole('listitem');
    expect(wears(bsd, px)).toContain('min-h-14');
    expect(within(bsd).getByRole('link', { name: 'KPM 0417 · BSD City, billing' })).toHaveAttribute('href', '/admin/tenants/kpm-1?tab=billing');
    expect(bsd).toHaveTextContent('0417 · BSD City');
    expect(bsd).toHaveTextContent('Prudential');
    expect(bsd).toHaveTextContent('Leaders 9 · Tier 1–10 · Plan Annual · Renewal 5 Jan 2027');
    expect(within(bsd).getByText('Active')).toBeInTheDocument();
    expect(within(bekasi).getByText('Ended — kept active')).toBeInTheDocument();
    expect(sudirman).toHaveTextContent('Plan — · Renewal —');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx the sort is a pill: a column as its heading’s first press, again the other way', async (px) => {
    atWidth(px);
    const { calls } = renderPage();
    await screen.findByRole('list', { name: 'Every KPM, its leaders, tier, plan and renewal' });
    await userEvent.click(screen.getByRole('button', { name: 'Sort order: KPM ↑' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose sort order' })).getByRole('radio', { name: 'Renewal' }));
    await waitFor(() => expect(kpmCalls(calls).at(-1)).toBe('?sort=renewal&dir=asc'));
    await userEvent.click(await screen.findByRole('button', { name: 'Sort order: Renewal ↑' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose sort order' })).getByRole('radio', { name: 'Renewal ↑' }));
    await waitFor(() => expect(kpmCalls(calls).at(-1)).toBe('?sort=renewal&dir=desc'));
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table and its sortable headings, no sort pill', async (px) => {
    atWidth(px);
    renderPage();
    expect(await screen.findByRole('table', { name: 'Every KPM, its leaders, tier, plan and renewal' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Sort order/ })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: ROWS }, '/notifications': { body: INBOX } });
    renderInLayout(AdminLayout, <BillingPage />, { me: SUPER_ADMIN });
    await screen.findByRole('list', { name: 'Every KPM, its leaders, tier, plan and renewal' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    stubFetch({ '/admin/billing/prices': { body: PRICES }, '/admin/billing/kpms': { body: ROWS }, '/notifications': { body: INBOX } });
    renderInLayout(AdminLayout, <BillingPage />, { me: SUPER_ADMIN });
    await screen.findByText(/BSD City/);
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
