import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import TenantsPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create', 'company:crud'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', companyName: 'Prudential', code: '0417',
  branchName: 'BSD City Branch', address: null, contactPhone: null,
  ownerUserId: 'u-owner', ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z',
  settings: {},
  // P13.2-T3: the Super Admin's rows carry the subscription, Leaders used and the ended state.
  subscription: null, leadersUsed: 6, subscriptionState: 'none',
  // P19.4-T3: the Owner's state and the members (ADR-0212), and the data status (AC-8).
  ownerState: 'active', ownerPhone: null, ownerInvitedAt: null, pendingOwner: null, memberCount: 12, membersBesidesOwner: 11,
  dataStatus: { latestMonth: '2026-09', missingMonth: null },
};

const SUBSCRIPTION = {
  startDate: '2026-01-06', endDate: '2027-01-05', pricePerLeaderMinor: 350_000_00, currency: 'IDR',
  maxLeaders: 10, keepActiveAfterEnd: false,
};

describe('tenants list', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a real table with the company named, from one request', async () => {
    const { calls } = stubFetch({ '/admin/tenants': { body: [KPM] } });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /0417/ });
    expect(within(row).getByText('BSD City Branch')).toBeInTheDocument();
    expect(within(row).getByText('Prudential')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();

    // The company name arrives on the payload. It used to be joined from a second
    // request, so a KPM whose company was missing from that list showed a raw ObjectId.
    expect(calls.filter((c) => c.url.includes('/admin/companies'))).toHaveLength(0);
  });

  it('P3.1-T14 AC-7: names the owner, rather than printing their id', async () => {
    stubFetch({ '/admin/tenants': { body: [KPM] } });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /0417/ });
    expect(within(row).getByText('Rina Wijaya')).toBeInTheDocument();
    expect(within(row).getByText('rina@kpm0417.test')).toBeInTheDocument();
    // The id was a 24-character hex string in a column headed **Owner**.
    expect(within(row).queryByText('u-owner')).not.toBeInTheDocument();
  });

  it('P3.1-T14: says an owner is Unknown rather than making the office look unowned', async () => {
    // An owner whose account has gone is a different problem from no owner at all, and
    // the two must not collapse into the same red call to act.
    stubFetch({
      '/admin/tenants': { body: [{ ...KPM, ownerName: 'Unknown', ownerEmail: null }] },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /0417/ });
    expect(within(row).getByText('Unknown')).toBeInTheDocument();
    expect(within(row).queryByRole('link', { name: 'Assign an owner' })).not.toBeInTheDocument();
  });

  it('flags an office with no owner as an action, not a blank cell', async () => {
    // Nobody can administer an office until an owner is assigned, so an empty cell
    // would hide the one thing that still needs doing.
    stubFetch({
      '/admin/tenants': { body: [{ ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null }] },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('link', { name: 'Assign an owner' })).toHaveAttribute(
      'href',
      '/admin/tenants/kpm-1/owner',
    );
  });

  it('offers creation from the empty state as well as the header', async () => {
    stubFetch({ '/admin/tenants': { body: [] }, '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('No KPMs yet.')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /New office|Create the first one/ });
    expect(links.length).toBeGreaterThanOrEqual(2);
  });

  it('shows the error envelope when the list cannot be read', async () => {
    stubFetch({
      '/admin/tenants': {
        status: 403,
        body: { error: { code: 'PERM_DENIED', message: 'Nope.', requestId: 'req-3' } },
      },
      '/admin/companies': { body: [] },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Nope.');
    expect(alert).toHaveTextContent('req-3');
  });

  describe('subscriptions (P13.2-T3 AC-7, P13.2-T4 AC-7)', () => {
    it('shows the end date and "{used} / {max}", or the count alone with no limit', async () => {
      stubFetch({
        '/admin/tenants': {
          body: [
            { ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' },
            { ...KPM, _id: 'kpm-2', code: '0555', branchName: 'Kelapa Gading Branch', leadersUsed: 2 },
          ],
        },
      });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

      const table = await screen.findByRole('table');
      expect(within(table).getByRole('columnheader', { name: 'End date' })).toBeInTheDocument();
      expect(within(table).getByRole('columnheader', { name: 'Leaders' })).toBeInTheDocument();
      const limited = within(table).getByRole('row', { name: /^0417/ });
      expect(within(limited).getByText('5 Jan 2027')).toBeInTheDocument();
      expect(within(limited).getByText('6 / 10')).toBeInTheDocument();
      const unlimited = within(table).getByRole('row', { name: /^0555/ });
      expect(within(unlimited).getByText('2')).toBeInTheDocument();
      expect(within(unlimited).getByText('—')).toBeInTheDocument();
    });

    it('P18.5-T2 AC-7 reads 13 / 10 and “3 over” past the limit, and says it whole to a screen reader', async () => {
      stubFetch({
        '/admin/tenants': {
          body: [
            { ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active', leadersUsed: 13 },
            { ...KPM, _id: 'kpm-2', code: '0555', branchName: 'Kelapa Gading Branch', subscription: SUBSCRIPTION, subscriptionState: 'active', leadersUsed: 10 },
          ],
        },
      });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

      const table = await screen.findByRole('table');
      const over = within(table).getByRole('row', { name: /^0417/ });
      expect(within(over).getByText('13 / 10')).toBeInTheDocument();
      expect(within(over).getByText('3 over')).toBeInTheDocument();
      expect(within(over).getByText('13 leaders of a limit of 10, 3 over')).toHaveClass('sr-only');
      // At the limit, not past it: no overage.
      const at = within(table).getByRole('row', { name: /^0555/ });
      expect(within(at).getByText('10 / 10')).toBeInTheDocument();
      expect(within(at).queryByText(/over/)).not.toBeInTheDocument();
    });

    it.each([
      ['ended', 'Ended'],
      ['ended_kept_active', 'Ended — kept active'],
    ])('reads %s in the Status column as “%s”, in place of Active', async (state, word) => {
      stubFetch({ '/admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: state }] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      const row = within(await screen.findByRole('table')).getByRole('row', { name: /0417/ });
      expect(within(row).getByText(word)).toBeInTheDocument();
      expect(within(row).queryByText('Active')).not.toBeInTheDocument();
    });

    it('a suspended office keeps its own word, ended or not', async () => {
      stubFetch({ '/admin/tenants': { body: [{ ...KPM, status: 'suspended', subscriptionState: 'ended' }] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      const row = within(await screen.findByRole('table')).getByRole('row', { name: /0417/ });
      expect(within(row).getByText('Suspended')).toBeInTheDocument();
    });

    it('opens Edit subscription from a button named for its office, with the five fields and the leaders used now', async () => {
      stubFetch({ '/admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });

      await userEvent.click(await screen.findByRole('button', { name: 'Edit subscription for KPM 0417 · BSD City Branch' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit subscription' });
      expect(within(dialog).getByLabelText('Start date')).toHaveValue('2026-01-06');
      expect(within(dialog).getByLabelText('End date')).toHaveValue('2027-01-05');
      expect(within(dialog).getByLabelText('Price per leader per month')).toHaveValue('350,000');
      expect(within(dialog).getByLabelText('Maximum leaders')).toHaveValue('10');
      expect(within(dialog).getByRole('switch', { name: 'Keep active after the end date' })).not.toBeChecked();
      expect(dialog).toHaveTextContent('Leaders used now: 6');
    });

    it('the list and its open dialog have no accessibility violations', async () => {
      stubFetch({ '/admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'ended' }] } });
      const { container } = renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: /Edit subscription for KPM 0417/ }));
      const results = await axe(container.ownerDocument.body, { rules: { 'color-contrast': { enabled: false } } });
      expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
    });

    it('warns, before saving, when the limit is below the leaders used — and lowering it demotes nobody', async () => {
      stubFetch({ '/admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: /Edit subscription for KPM 0417/ }));
      const dialog = screen.getByRole('dialog');
      const max = within(dialog).getByLabelText('Maximum leaders');
      await userEvent.clear(max);
      await userEvent.type(max, '4');
      expect(dialog).toHaveTextContent('This office has 6 leaders now, more than 4. Nobody is demoted');
    });

    it('warns when the end date has already passed in the office’s day', async () => {
      stubFetch({ '/admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: /Edit subscription for KPM 0417/ }));
      const dialog = screen.getByRole('dialog');
      const end = within(dialog).getByLabelText('End date');
      await userEvent.clear(end);
      await userEvent.type(end, '2020-01-31');
      expect(dialog).toHaveTextContent('This end date, 31 Jan 2020, has passed. Once you save, nobody in this office');
      await userEvent.click(within(dialog).getByRole('switch', { name: 'Keep active after the end date' }));
      expect(dialog).toHaveTextContent('The office stays open because it is kept active.');
    });

    it('saves all five fields, in sen, and redraws the row from the answer', async () => {
      const saved = { ...KPM, subscription: { ...SUBSCRIPTION, maxLeaders: 12 }, subscriptionState: 'active' };
      const { calls } = stubFetch({
        'GET /admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] },
        'PATCH /admin/tenants/kpm-1/subscription': { body: saved },
      });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: /Edit subscription for KPM 0417/ }));
      const dialog = screen.getByRole('dialog');
      const max = within(dialog).getByLabelText('Maximum leaders');
      await userEvent.clear(max);
      await userEvent.type(max, '12');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const patch = calls.find((c) => c.init.method === 'PATCH')!;
      expect(JSON.parse(patch.init.body as string)).toEqual({
        startDate: '2026-01-06', endDate: '2027-01-05', pricePerLeaderMinor: 350_000_00, maxLeaders: 12,
        // P19.4-T3 (ADR-0211 §1): *Paket*, none on this office.
        keepActiveAfterEnd: false, plan: null,
      });
      const row = within(screen.getByRole('table')).getByRole('row', { name: /0417/ });
      expect(within(row).getByText('6 / 12')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Subscription saved for KPM 0417.');
    });

    it('refuses an end before the start, under the field, without asking the API', async () => {
      const { calls } = stubFetch({ 'GET /admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: /Edit subscription for KPM 0417/ }));
      const dialog = screen.getByRole('dialog');
      const end = within(dialog).getByLabelText('End date');
      await userEvent.clear(end);
      await userEvent.type(end, '2025-12-31');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(within(dialog).getByLabelText('End date')).toHaveAttribute('aria-invalid', 'true');
      expect(dialog).toHaveTextContent('The end date is on or after the start date.');
      expect(calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(0);
    });

    it('names the field the API refused, and shows any other refusal in the dialog', async () => {
      stubFetch({
        'GET /admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] },
        'PATCH /admin/tenants/kpm-1/subscription': [
          { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'maxLeaders must be a whole number from 1 to 10000, or none.', details: { field: 'maxLeaders' }, requestId: 'r' } } },
          { status: 403, body: { error: { code: 'PERM_DENIED', message: 'You do not have permission to perform this action.', requestId: 'r-2' } } },
        ],
      });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      await userEvent.click(await screen.findByRole('button', { name: /Edit subscription for KPM 0417/ }));
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(within(dialog).getByLabelText('Maximum leaders')).toHaveAttribute('aria-invalid', 'true'));

      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(await within(dialog).findByRole('alert')).toHaveTextContent('You do not have permission');
    });
  });

  it('never renders for a session without the platform permission', () => {
    // A Super Admin without the grant: anybody else is sent to their own landing first (2026-10-11).
    renderInLayout(AdminLayout, <TenantsPage />, { me: makeMe({ ...SUPER_ADMIN, permissions: [] }) });
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm:list_all');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  describe('P19.4-T3 AC-8 — KPM · Pemilik · Anggota · Data terakhir · Perlu tindakan', () => {
    const NEEDS = {
      ...KPM, _id: 'kpm-2', code: '0602', branchName: 'Bandung Dago', ownerName: 'Wulan Kartika', ownerEmail: 'wulan@kpm.test',
      ownerState: 'invited', memberCount: 1, membersBesidesOwner: 0,
      dataStatus: { latestMonth: null, missingMonth: '2026-10' },
    };

    // Moved 2026-11-06 (P19.2-T2 AC-1; UI-126): below 1024px the list is rows, so the 375px case reads the row (below);
    // the table's case is the laptop's.
    it.each([1024, 1280])('P19.4-T3 AC-8 at %ipx: the Owner’s chip, the members, the latest data and what needs doing', async (px) => {
      atWidth(px);
      stubFetch({ '/admin/tenants': { body: [KPM, NEEDS] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      const table = await screen.findByRole('table');
      const done = within(table).getByRole('row', { name: /0417/ });
      expect(within(done).getByText('Signed in')).toBeInTheDocument();
      expect(within(done).getByText('12')).toBeInTheDocument();
      expect(within(done).getByText('Sep 2026')).toBeInTheDocument();
      expect(within(done).getByText('Nothing')).toBeInTheDocument();
      const open = within(table).getByRole('row', { name: /0602/ });
      expect(within(open).getByText('Invited')).toBeInTheDocument();
      expect(within(open).getByText('No data yet')).toBeInTheDocument();
      expect(within(open).getByText('The owner has not accepted the invitation')).toBeInTheDocument();
      expect(within(open).getByText('No members yet')).toBeInTheDocument();
      expect(within(open).getByText('Oct 2026 data not uploaded')).toBeInTheDocument();
    });

    it.each([375, 768])('P19.4-T3 AC-8 at %ipx a row says the Owner’s chip, the members, the latest data and what needs doing', async (px) => {
      atWidth(px);
      stubFetch({ '/admin/tenants': { body: [KPM, NEEDS] } });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      const list = await screen.findByRole('list', { name: 'Offices on the platform' });
      const [done, open] = within(list).getAllByRole('listitem');
      expect(done).toHaveTextContent('Prudential · 12 members · Sep 2026');
      expect(done).toHaveTextContent('Owner: Rina Wijaya');
      expect(within(done).getByText('Signed in')).toBeInTheDocument();
      // Nothing to do is the row's silence: no alert line, where the table's cell says *Nothing*.
      expect(done.querySelector('.text-alert')).toBeNull();
      expect(open).toHaveTextContent('Prudential · 1 member · No data yet');
      expect(within(open).getByText('Invited')).toBeInTheDocument();
      expect(within(open).getByText('The owner has not accepted the invitation')).toBeInTheDocument();
      expect(within(open).getByText('No members yet')).toBeInTheDocument();
      expect(within(open).getByText('Oct 2026 data not uploaded')).toBeInTheDocument();
    });

    it('P19.4-T3 AC-8 an office with nobody named reads “No owner yet”, and a pending Owner is named, not invited', async () => {
      stubFetch({
        '/admin/tenants': {
          body: [
            { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null, ownerState: 'none', memberCount: 0, membersBesidesOwner: 0 },
            {
              ...KPM, _id: 'kpm-3', code: '0603', ownerUserId: null, ownerName: null, ownerEmail: null, ownerState: 'not_invited',
              pendingOwner: { fullName: 'Dewi Anggraini', phone: '+6281200000000', agentCode: null },
            },
          ],
        },
      });
      renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
      const table = await screen.findByRole('table');
      expect(within(within(table).getByRole('row', { name: /0417/ })).getByText('No owner yet')).toBeInTheDocument();
      const pending = within(table).getByRole('row', { name: /0603/ });
      expect(within(pending).getByText('Dewi Anggraini')).toBeInTheDocument();
      expect(within(pending).getByText('Not invited')).toBeInTheDocument();
    });
  });
});

/**
 * **P19.2-T2 — the KPMs list's layout** (UI-126, UI-135): rows below 1024px, the table from it; the row's actions in ⋯
 * opening what the table's controls open; 44px targets.
 */
describe('P19.2-T2 the KPMs list (UI-126, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const OVER = {
    ...KPM, _id: 'kpm-2', code: '0602', branchName: 'Bandung Dago', ownerUserId: null, ownerName: null, ownerEmail: null,
    ownerState: 'none', subscription: SUBSCRIPTION, subscriptionState: 'active', leadersUsed: 13,
  };
  const show = (rows: unknown[] = [KPM, OVER]) => {
    const stub = stubFetch({ 'GET /admin/tenants': { body: rows } });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
    return stub;
  };

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx draws no table: one row per KPM — code · branch opening it, its state, ⋯', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Offices on the platform' });
    expect(screen.queryByRole('table')).toBeNull();
    const [first, second] = within(list).getAllByRole('listitem');
    expect(wears(first, px)).toContain('min-h-14');
    expect(within(first).getByRole('link', { name: '0417 · BSD City Branch' })).toHaveAttribute('href', '/admin/tenants/kpm-1');
    expect(within(first).getByText('Active')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Actions for 0417 · BSD City Branch' })).toHaveTextContent('⋯');
    // Past the limit (ADR-0157 §4): the count, *3 over*, and the sentence a screen reader hears whole.
    expect(second).toHaveTextContent('Leaders 13 / 10');
    expect(within(second).getByText('3 over')).toBeInTheDocument();
    expect(within(second).getByText('13 leaders of a limit of 10, 3 over')).toHaveClass('sr-only');
    // Within the limit the row does not repeat the count: it is the laptop's column, and the dialog's line.
    expect(first).not.toHaveTextContent('Leaders');
    expect(within(second).getByText('No owner yet')).toBeInTheDocument();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table, its columns as before', async (px) => {
    atWidth(px);
    show();
    const table = await screen.findByRole('table', { name: 'Offices on the platform' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'KPM', 'Company', 'Owner', 'Members', 'Latest data', 'Needs action', 'Status', 'End date', 'Leaders', 'Subscription',
    ]);
    expect(screen.queryByRole('list', { name: 'Offices on the platform' })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx ⋯ opens Edit subscription, the dialog the table’s button opens, and saves the same', async (px) => {
    atWidth(px);
    const { calls } = stubFetch({
      'GET /admin/tenants': { body: [{ ...KPM, subscription: SUBSCRIPTION, subscriptionState: 'active' }] },
      'PATCH /admin/tenants/kpm-1/subscription': { body: { ...KPM, subscription: { ...SUBSCRIPTION, maxLeaders: 12 }, subscriptionState: 'active' } },
    });
    renderInLayout(AdminLayout, <TenantsPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for 0417 · BSD City Branch' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit subscription']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit subscription' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit subscription' });
    expect(dialog).toHaveTextContent('Leaders used now: 6');
    const max = within(dialog).getByLabelText('Maximum leaders');
    await userEvent.clear(max);
    await userEvent.type(max, '12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(JSON.parse(calls.find((c) => c.init.method === 'PATCH')!.init.body as string)).toMatchObject({ maxLeaders: 12 });
    expect(screen.getByRole('status')).toHaveTextContent('Subscription saved for KPM 0417.');
  });

  it('P19.2-T2 AC-1 at 375px an office with no owner offers Assign an owner in ⋯, to the owner page', async () => {
    atWidth(375);
    push.mockClear();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for 0602 · Bandung Dago' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit subscription', 'Assign an owner']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Assign an owner' }));
    expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-2/owner');
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Offices on the platform' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 768])('P19.2-T2 AC-4 AC-5 at %ipx the subscription dialog draws no select and no target under 44px', async (px) => {
    atWidth(px);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Actions for 0417 · BSD City Branch' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit subscription' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit subscription' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Plan' })).toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
    expect(smallTargets(dialog, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText(/BSD City Branch/);
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
