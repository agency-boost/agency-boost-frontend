import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import TenantAdminsPage from './page';

/** The address's query: the people tab unless a test opens *Perubahan oleh pengelola* (P19.15-T4). */
const address = vi.hoisted(() => ({ search: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenant-admins',
  useSearchParams: () => new URLSearchParams(address.search),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm_admin:list_platform'],
});

/** What every render of the people tab reads beside the rows: the live grants and the insurers to tick. */
const AROUND = {
  '/admin/product-data-grants': { body: [] },
  '/admin/companies': { body: [] },
};

const row = (over: Record<string, unknown> = {}) => ({
  membershipId: 'mem-1', userId: 'u-wilson', fullName: 'Wilson Tanoto', email: 'wilson@kpm0417.test',
  initials: 'WT', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD City Branch',
  isOwner: true, isAdmin: false, grantedAt: null, ...over,
});

describe('KPM Owners & Admins (P3.1-T12)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: names the person, their office, and what access they hold', async () => {
    stubFetch({ ...AROUND, '/admin/tenant-admins': { body: [row()] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Wilson Tanoto')).toBeInTheDocument();
    expect(screen.getByText('KPM 0417 — BSD City Branch')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it("AC-1: says an Owner's rights came with the office, rather than leaving a blank", async () => {
    // A blank date would read as missing data. An Owner has no grant date because
    // nobody granted it — the office did.
    stubFetch({ ...AROUND, '/admin/tenant-admins': { body: [row()] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('With the office')).toBeInTheDocument();
  });

  it('AC-1: dates a delegated Admin, because somebody granted that', async () => {
    stubFetch({
      ...AROUND,
      '/admin/tenant-admins': {
        body: [row({ fullName: 'Agus Prasetyo', isOwner: false, isAdmin: true, grantedAt: '2026-09-01T00:00:00.000Z' })],
      },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('1 Sep 2026')).toBeInTheDocument();
  });

  it('AC-2: offers no control over office administration, and says why — only Manage product data (P19.15-T4)', async () => {
    // Granting and revoking stay inside the office. A platform screen that could hand
    // out office administration would route around a decision the office owns. *Kelola data produk* is not office
    // administration: it is leave to keep an insurer's data, the platform's to give (ADR-0260 §4).
    stubFetch({ ...AROUND, '/admin/tenant-admins': { body: [row()] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText(/granted and revoked inside the office, by its Owner/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Grant|Revoke/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Manage product data for Wilson Tanoto' })).toBeInTheDocument();
  });

  it('says no office has one yet, rather than showing an empty table', async () => {
    stubFetch({ ...AROUND, '/admin/tenant-admins': { body: [] } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('No office has an administrator yet.')).toBeInTheDocument();
  });
});

/** **P19.2-T2 — the list below 1024px** (UI-126): one row per person, read only; the laptop keeps its table. */
describe('P19.2-T2 KPM Owners & Admins below 1024px (UI-126, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ROWS = [
    row(),
    row({ membershipId: 'mem-2', userId: 'u-agus', fullName: 'Agus Prasetyo', email: 'agus@kpm0417.test', isOwner: false, isAdmin: true, grantedAt: '2026-09-01T00:00:00.000Z' }),
  ];
  const show = () => {
    stubFetch({ ...AROUND, '/admin/tenant-admins': { body: ROWS } });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
  };

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx draws a row per person: the name, email · office, the grant, the pills', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Office administrators' });
    expect(screen.queryByRole('table')).toBeNull();
    const [owner, admin] = within(list).getAllByRole('listitem');
    expect(wears(owner, px)).toContain('min-h-14');
    expect(owner).toHaveTextContent('Wilson Tanoto');
    expect(owner).toHaveTextContent('wilson@kpm0417.test · KPM 0417 — BSD City Branch');
    expect(owner).toHaveTextContent('With the office');
    expect(within(owner).getByText('Owner')).toBeInTheDocument();
    expect(admin).toHaveTextContent('Granted 1 Sep 2026');
    expect(within(admin).getByText('Admin')).toBeInTheDocument();
    // No control over office administration (P3.1-T12 AC-2): a row's one button is *Kelola data produk*'s (P19.15-T4).
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Manage product data for Wilson Tanoto', 'Manage product data for Agus Prasetyo']);
    expect(within(list).queryByRole('link')).toBeNull();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table', async (px) => {
    atWidth(px);
    show();
    expect(await screen.findByRole('table', { name: 'Office administrators' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Office administrators' })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Office administrators' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText('Agus Prasetyo');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});

/**
 * **P19.15-T4 AC-2 — *Kelola data produk*, given here** (ADR-0260 §4; the P1b spec's *Giving access*: the switch, then
 * one or more insurers ticked): a row's button opens the dialog; on with Prudential ticked saves `PUT`, and the row then
 * reads *Manage product data · Prudential*; off removes it with `DELETE`; on with nothing ticked is refused before any
 * request. A grant kept for somebody no longer an Admin reads grey, and says so.
 */
describe('P19.15-T4 Kelola data produk on KPM Owners & Admins', () => {
  afterEach(() => vi.unstubAllGlobals());

  const MAYA = row({ membershipId: 'mem-maya', userId: 'u-maya', fullName: 'Maya Halim', isOwner: false, isAdmin: true, grantedAt: '2026-03-01T00:00:00.000Z' });
  const COMPANIES = { body: [
    { _id: 'co-pru', name: 'Prudential', kind: 'insurer' }, { _id: 'co-manu', name: 'Manulife', kind: 'insurer' },
    { _id: 'co-lib', name: 'Template bawaan AgencyBoost', kind: 'template' },
  ] };
  const GRANT = {
    userId: 'u-maya', fullName: 'Maya Halim', email: 'maya@kpm0417.test', kpmId: 'kpm-1', kpmLabel: 'KPM 0417 — BSD',
    holds: true, companies: [{ companyId: 'co-pru', name: 'Prudential' }], grantedAt: '2026-11-12T03:00:00.000Z',
    grantedByName: 'Root', updatedAt: '2026-11-12T03:00:00.000Z',
  };

  it('P19.15-T4 AC-2 gives Maya Kelola data produk for Prudential: switch on, tick, Save', async () => {
    atWidth(1280);
    const stub = stubFetch({
      '/admin/tenant-admins': { body: [MAYA] }, '/admin/companies': COMPANIES,
      'GET /admin/product-data-grants': { body: [] },
      'PUT /admin/product-data-grants/u-maya': ({ body }) => ({ body: { ...GRANT, companies: (body as { companyIds: string[] }).companyIds.map((companyId) => ({ companyId, name: 'Prudential' })) } }),
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Manage product data for Maya Halim' }));
    const dialog = screen.getByRole('dialog', { name: 'Manage product data' });
    // The Template library is no insurer, and is never offered.
    expect(within(dialog).queryByRole('checkbox', { name: /Template/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole('switch', { name: 'Manage product data' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Prudential' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    const put = stub.calls.find((c) => c.init.method === 'PUT')!;
    expect(put.url).toContain('/admin/product-data-grants/u-maya');
    expect(JSON.parse(String(put.init.body))).toEqual({ companyIds: ['co-pru'] });
    expect(await screen.findByText('Manage product data · Prudential')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('P19.15-T4 AC-2 refuses Save with nothing ticked, and sends nothing', async () => {
    const stub = stubFetch({
      '/admin/tenant-admins': { body: [MAYA] }, '/admin/companies': COMPANIES, '/admin/product-data-grants': { body: [] },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Manage product data for Maya Halim' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('switch'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Tick at least one insurer.');
    expect(stub.calls.some((c) => c.init.method === 'PUT')).toBe(false);
  });

  it('P19.15-T4 AC-2 removes it at once: switch off, Save, DELETE, and the pill is gone', async () => {
    const stub = stubFetch({
      '/admin/tenant-admins': { body: [MAYA] }, '/admin/companies': COMPANIES,
      'GET /admin/product-data-grants': { body: [GRANT] },
      'DELETE /admin/product-data-grants/u-maya': { body: { userId: 'u-maya', revokedAt: '2026-11-12T04:00:00.000Z' } },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Manage product data · Prudential')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Manage product data for Maya Halim' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('switch')).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Prudential' })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('switch'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(stub.calls.some((c) => c.init.method === 'DELETE' && c.url.includes('/admin/product-data-grants/u-maya'))).toBe(true);
    await screen.findByText('Maya Halim can no longer manage product data.');
    expect(screen.queryByText('Manage product data · Prudential')).toBeNull();
  });

  it('P19.15-T4 AC-2 shows the server\'s refusal in the dialog, as written', async () => {
    stubFetch({
      '/admin/tenant-admins': { body: [MAYA] }, '/admin/companies': COMPANIES, 'GET /admin/product-data-grants': { body: [] },
      'PUT /admin/product-data-grants/u-maya': { status: 409, body: { error: { code: 'PRODUCT_DATA_GRANT_NOT_ELIGIBLE', message: 'Only a KPM Owner or a KPM Admin can be given access to manage product data.', requestId: 'r-1' } } },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Manage product data for Maya Halim' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('switch'));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Manulife' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/Only a KPM Owner or a KPM Admin/)).toBeInTheDocument();
  });

  it('P19.15-T4 AC-2 a grant kept for somebody no longer an Admin reads grey, and says it is not in force', async () => {
    stubFetch({
      '/admin/tenant-admins': { body: [MAYA] }, '/admin/companies': COMPANIES,
      '/admin/product-data-grants': { body: [{ ...GRANT, holds: false }] },
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    const pill = (await screen.findByText('Manage product data · Prudential')).closest('[data-tone]')!;
    expect(pill).toHaveAttribute('data-tone', 'grey');
    expect(pill).toHaveTextContent('Not in force: no longer an Owner or Admin');
  });
});

/**
 * **P19.15-T4 AC-2 — *Perubahan oleh pengelola*** (ADR-0260 §6; the P1b spec's *Rules*): the page's second tab, every
 * change a product data manager made, each linking to its company's *Proposal* tab and to its line in the audit log.
 */
describe('P19.15-T4 Perubahan oleh pengelola', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    address.search = '';
  });

  const CHANGE = {
    auditId: 'a-1', createdAt: '2026-11-12T03:00:00.000Z', action: 'rate_table.activated', actionLabel: 'Premium table turned on',
    targetCollection: 'rateTables', targetKind: 'Premium table', targetId: 'rt-1', actorUserId: '66f0000000000000000000e2',
    actorName: 'Maya Halim', kpmId: '66f0000000000000000000a1', officeLabel: 'KPM 0417 · BSD', companyId: 'co-pru',
    companyName: 'Prudential', productId: 'p-1', productName: 'PRUCritical Benefit 88',
  };
  const PAGE = (items: unknown[], nextCursor: string | null = null) => ({
    body: { items, page: { cursor: null, nextCursor, limit: 50, hasMore: nextCursor !== null } },
  });

  it.each([375, 1280])('P19.15-T4 AC-2 at %ipx lists each change with its Proposal tab and its audit line', async (px) => {
    atWidth(px);
    address.search = 'tab=changes';
    stubFetch({ '/admin/product-data-grants/changes': PAGE([CHANGE]) });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Premium table turned on')).toBeInTheDocument();
    expect(screen.getByText('PRUCritical Benefit 88 · Prudential')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Prudential Proposal tab' })).toHaveAttribute('href', '/admin/companies/co-pru/proposal');
    expect(screen.getByRole('link', { name: 'In the audit log' })).toHaveAttribute(
      'href', '/admin/audit?actorUserId=66f0000000000000000000e2&action=rate_table.activated',
    );
    expect(screen.getByRole('link', { name: 'Changes by managers' })).toHaveAttribute('aria-current', 'page');
  });

  it('P19.15-T4 AC-2 loads the next fifty from the cursor, and says when nobody changed anything', async () => {
    address.search = 'tab=changes';
    const stub = stubFetch({
      '/admin/product-data-grants/changes?cursor=c2': PAGE([{ ...CHANGE, auditId: 'a-2', actionLabel: 'Product rules changed' }]),
      '/admin/product-data-grants/changes': PAGE([CHANGE], 'c2'),
    });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Product rules changed')).toBeInTheDocument();
    expect(stub.calls.some((c) => c.url.includes('cursor=c2'))).toBe(true);

    vi.unstubAllGlobals();
    stubFetch({ '/admin/product-data-grants/changes': PAGE([]) });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('No product data manager has changed anything yet.')).toBeInTheDocument();
  });

  it.each([375, 768])('P19.15-T4 AC-2 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    address.search = 'tab=changes';
    stubFetch({ '/admin/product-data-grants/changes': PAGE([CHANGE], 'c2') });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await screen.findByText('Premium table turned on');
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it('P19.15-T4 AC-2 at 1280px has no axe violations', async () => {
    atWidth(1280);
    address.search = 'tab=changes';
    stubFetch({ '/admin/product-data-grants/changes': PAGE([CHANGE]) });
    renderInLayout(AdminLayout, <TenantAdminsPage />, { me: SUPER_ADMIN });
    await screen.findByText('Maya Halim');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
