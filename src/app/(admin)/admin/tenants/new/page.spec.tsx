import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch as stubRoutes } from '@test/harness';
import NewTenantPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants/new',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create'],
});

const COMPANIES = [
  { _id: 'co-1', name: 'Prudential', slug: 'prudential' },
  { _id: 'co-2', name: 'Sejahtera Baru Life', slug: 'sejahtera-baru-life' },
];

/** A company's templates, as `GET /admin/companies/:id/templates` lists them (ADR-0115 §3). */
const template = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id, companyId: 'co-1', name, isDefault: false, status: 'active', archivedAt: null, origin: { kind: 'empty' },
  publishedVersions: {}, officeCount: 0, createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
  ...over,
});
const PRUDENTIAL_TEMPLATES = [
  template('t-jkt', 'Jakarta branches'),
  template('t-default', 'Prudential template', { isDefault: true }),
  template('t-old', 'Old settings', { status: 'archived' }),
];
const BLANK_TEMPLATES = [template('t-blank', 'Sejahtera Baru Life template', { companyId: 'co-2', isDefault: true })];

/** Every spec here reads each company's templates beneath its own routes. */
const stubFetch: typeof stubRoutes = (routes) => stubRoutes({
  '/admin/companies/co-1/templates': { body: PRUDENTIAL_TEMPLATES },
  '/admin/companies/co-2/templates': { body: BLANK_TEMPLATES },
  ...routes,
});

describe('new tenant', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends users to create an insurer first when there is none', async () => {
    // An office belongs to exactly one insurer, so the form is unusable without one.
    stubFetch({ '/admin/companies': { body: [] } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('link', { name: 'Create a company first' })).toHaveAttribute(
      'href',
      '/admin/companies',
    );
    expect(screen.queryByLabelText('Office code')).not.toBeInTheDocument();
  });

  it('rejects a code the API would reject, before the round trip', async () => {
    stubFetch({ '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Office code'), 'has space');
    expect(screen.getByText('2–16 characters: letters, digits and hyphens.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create office' })).toBeDisabled();
  });

  it('omits blank optional fields instead of sending empty strings', async () => {
    const { calls } = stubFetch({
      '/admin/companies': { body: COMPANIES },
      '/admin/tenants': { status: 201, body: { _id: 'kpm-9' } },
    });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Office code'), '0417');
    await userEvent.type(screen.getByLabelText('Branch name'), 'BSD City Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));

    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(post.init.body as string)).toEqual({
      companyId: 'co-1',
      code: '0417',
      branchName: 'BSD City Branch',
      // The company's default, chosen first (ADR-0115 §4).
      startFrom: { kind: 'template', templateId: 't-default' },
    });
    expect(push).toHaveBeenCalledWith('/admin/tenants/kpm-9');
  });

  it('surfaces a duplicate code as the server explains it', async () => {
    stubFetch({
      '/admin/companies': { body: COMPANIES },
      '/admin/tenants': {
        status: 409,
        body: {
          error: {
            code: 'TENANT_CODE_TAKEN',
            message: 'KPM code 0417 is already used by Prudential.',
            requestId: 'req-4',
          },
        },
      },
    });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Office code'), '0417');
    await userEvent.type(screen.getByLabelText('Branch name'), 'BSD City Branch');
    await userEvent.click(screen.getByRole('button', { name: 'Create office' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already used by Prudential');
    expect(push).not.toHaveBeenCalledWith('/admin/tenants/kpm-9');
  });

  it('P3.5-T14 AC-7: shows the time zone and refuses to let anybody type one', async () => {
    // This asserted "Blank inherits the insurer's" — a hint on a free-text box that
    // accepted `Asia/Jakata` in both halves and broke every day boundary in that office
    // for ever, silently. The requirement it protected survives: the value is explained
    // rather than left a mystery. What changed is that it is no longer a control.
    stubFetch({ '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.getByText(/v1 runs every office on Jakarta time/)).toBeInTheDocument();
    // Not a disabled input either: disabled reads as "not available right now", and this
    // is a permanent product decision (ADR-0016).
    expect(screen.queryByLabelText('Time zone')).not.toBeInTheDocument();
  });

  /*
   * **P13.2-T6 AC-7 — Start from** (ADR-0115 §4): the company's active templates, the default first and
   * chosen, then the AgencyBoost defaults and Empty; read again when the company changes.
   */
  describe('Start from (P13.2-T6)', () => {
    it('offers the company’s active templates, the default first and chosen, then the defaults and Empty', async () => {
      stubFetch({ '/admin/companies': { body: COMPANIES } });
      renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

      const select = await screen.findByRole('combobox', { name: 'Start from' });
      await vi.waitFor(() => expect(select).toHaveDisplayValue('Prudential template · Default'));
      expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
        'Prudential template · Default', 'Jakarta branches', 'AgencyBoost defaults', 'Empty',
      ]);
      // The archived one is not offered.
      expect(screen.queryByRole('option', { name: 'Old settings' })).not.toBeInTheDocument();
    });

    it('reads the templates again when the company changes', async () => {
      stubFetch({ '/admin/companies': { body: COMPANIES } });
      renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Company' }), 'co-2');
      const select = screen.getByRole('combobox', { name: 'Start from' });
      await vi.waitFor(() => expect(select).toHaveDisplayValue('Sejahtera Baru Life template · Default'));
      expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
        'Sejahtera Baru Life template · Default', 'AgencyBoost defaults', 'Empty',
      ]);
    });

    it('exit review, finding 7: a failed read of the templates offers nothing, sends nothing, and reads again', async () => {
      const { calls } = stubFetch({
        '/admin/companies': { body: COMPANIES },
        '/admin/companies/co-1/templates': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.', requestId: 'r-1' } } },
          { body: PRUDENTIAL_TEMPLATES },
        ],
      });
      renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

      const select = await screen.findByRole('combobox', { name: 'Start from' });
      expect(await screen.findByText(/This company’s templates could not be read, so there is nothing to start from yet\. Something went wrong on our side\./))
        .toBeInTheDocument();
      // Not the AgencyBoost defaults chosen behind the reader's back: nothing is, and nothing can be sent.
      expect(select).toBeDisabled();
      expect([...(select as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Not loaded']);
      await userEvent.type(screen.getByLabelText('Office code'), '0701');
      await userEvent.type(screen.getByLabelText('Branch name'), 'Cempaka Putih Branch');
      expect(screen.getByRole('button', { name: 'Create office' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await vi.waitFor(() => expect(select).toHaveDisplayValue('Prudential template · Default'));
      expect(screen.queryByText(/could not be read/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create office' })).toBeEnabled();
      expect(calls.filter((c) => c.url.includes('/admin/companies/co-1/templates'))).toHaveLength(2);
      expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
    });

    it.each([
      ['Empty', { kind: 'empty' }, /Nothing but the three activity types/],
      ['AgencyBoost defaults', { kind: 'defaults' }, /Every section as AgencyBoost ships it/],
      ['Jakarta branches', { kind: 'template', templateId: 't-jkt' }, /copied from this template/],
    ] as const)('sends %s, and says what it gives the office', async (label, startFrom, hint) => {
      const { calls } = stubFetch({
        '/admin/companies': { body: COMPANIES },
        '/admin/tenants': { status: 201, body: { _id: 'kpm-9' } },
      });
      renderInLayout(AdminLayout, <NewTenantPage />, { me: SUPER_ADMIN });

      const select = await screen.findByRole('combobox', { name: 'Start from' });
      await vi.waitFor(() => expect(select).toBeEnabled());
      await userEvent.selectOptions(select, screen.getByRole('option', { name: label }));
      expect(screen.getByText(hint)).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Office code'), '0701');
      await userEvent.type(screen.getByLabelText('Branch name'), 'Cempaka Putih Branch');
      await userEvent.click(screen.getByRole('button', { name: 'Create office' }));

      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(JSON.parse(post.init.body as string).startFrom).toEqual(startFrom);
    });
  });
});
