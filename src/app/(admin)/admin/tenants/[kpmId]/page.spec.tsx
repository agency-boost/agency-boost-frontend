import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import TenantDetailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-1',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:read_profile', 'kpm:suspend'],
});

const KPM = {
  _id: 'kpm-1', companyId: 'co-1', code: '0417', branchName: 'BSD City Branch',
  address: 'Jl. Raya Serpong', contactPhone: null, ownerUserId: 'u-owner',
  ownerName: 'Rina Wijaya', ownerEmail: 'rina@kpm0417.test', companyName: 'Prudential',
  timezone: 'Asia/Jakarta', locale: 'id-ID', currency: 'IDR', status: 'active',
  suspendedAt: null, suspendedReason: null, createdAt: '2026-09-01T00:00:00.000Z',
  settings: { activationWindowDays: 90 },
  // P13.2-T3: the Super Admin's read carries the subscription, Leaders used and the ended state.
  subscription: null, leadersUsed: 6, subscriptionState: 'none',
};

const params = routeParams({ kpmId: 'kpm-1' });

describe('tenant detail', () => {
  afterEach(() => vi.unstubAllGlobals());

  /*
   * P10.1-T2. The page carried a *Seeded settings* card: the office's settings by their raw keys,
   * for "a reviewer", under a sentence naming the phase the office would take them over in. It
   * went, and nothing took its slot — no feature is coming to it, so a sign would promise one. The
   * payload still carries `settings`; this screen just does not print them.
   */
  it('shows no seeded settings, no raw setting key and no phase', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Asia/Jakarta')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Seeded settings' })).not.toBeInTheDocument();
    expect(screen.queryByText('activationWindowDays')).not.toBeInTheDocument();
    expect(screen.queryByText(/phase \d/i)).not.toBeInTheDocument();
    // Nor a placeholder where it stood: the four cards are the page.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Profile', 'Owner', 'People', 'Lifecycle']);
  });

  it('P3.5-T14 AC-7: names the owner, and keeps the one id support asks for', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    // The Owner card's whole body used to be a <code> holding an ObjectId.
    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('rina@kpm0417.test')).toBeInTheDocument();
    expect(screen.queryByText('u-owner')).not.toBeInTheDocument();

    // The company is named too, rather than joined client-side or shown as an id.
    expect(screen.getByText('Prudential')).toBeInTheDocument();

    // The KPM id stays — `04-managing-a-kpm.md` tells the reader support will ask for it
    // — under the term I-49 settled, not the retired `Tenant id`.
    expect(screen.getByText('KPM id')).toBeInTheDocument();
    expect(screen.getByText('kpm-1')).toBeInTheDocument();
    expect(screen.queryByText('Tenant id')).not.toBeInTheDocument();
  });

  it('offers a transfer when an owner exists and an assignment when none does', async () => {
    stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
    const { unmount } = renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Transfer owner' })).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null } } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Assign owner' })).toBeInTheDocument();
    expect(screen.getByText(/Nobody can administer this office/)).toBeInTheDocument();
  });

  it('sends the reason with a suspension and reloads the office afterwards', async () => {
    const { calls } = stubFetch({
      '/admin/tenants/kpm-1/status': { body: {} },
      '/admin/tenants/kpm-1': [
        { body: KPM },
        { body: { ...KPM, status: 'suspended', suspendedReason: 'unpaid invoice' } },
      ],
    });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'suspended');
    await userEvent.type(screen.getByLabelText('Reason'), 'unpaid invoice');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string)).toEqual({
      status: 'suspended',
      reason: 'unpaid invoice',
    });
    expect(await screen.findByText('Suspended: unpaid invoice')).toBeInTheDocument();
  });

  it.each([
    ['none', null, 'No end date', 'Active'],
    ['active', '2027-01-05', 'Active until January 5, 2027', 'Active'],
    ['ended', '2026-09-25', 'Ended September 25, 2026', 'Ended'],
    ['ended_kept_active', '2026-10-02', 'Ended October 2, 2026 — kept active', 'Ended — kept active'],
  ])('P13.2-T3 AC-8: the Lifecycle card shows a %s subscription beside the office’s status', async (state, endDate, line, word) => {
    stubFetch({
      '/admin/tenants/kpm-1': {
        body: {
          ...KPM, subscriptionState: state,
          subscription: endDate === null ? null : {
            startDate: '2026-01-01', endDate, pricePerLeaderMinor: null, currency: 'IDR', maxLeaders: null,
            keepActiveAfterEnd: state === 'ended_kept_active',
          },
        },
      },
    });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });

    expect(await screen.findByText(line)).toBeInTheDocument();
    expect(screen.getByText('Subscription:')).toBeInTheDocument();
    // The header's pill reads as the list's Status column does.
    expect(screen.getAllByText(word).length).toBeGreaterThan(0);
  });

  it('shows the error envelope instead of an empty shell when the office cannot be read', async () => {
    stubFetch({
      '/admin/tenants/kpm-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'KPM not found.', requestId: 'req-2' } },
      },
    });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('alert')).toHaveTextContent('KPM not found.');
  });

  /**
   * **P13.2-T7 AC-7: Save as template** (ADR-0115 §5): what the office's agents read, as a new template of
   * its own company or another — the dialog's fields, states and refusals.
   */
  describe('Save as template (P13.2-T7)', () => {
    const WRITER = makeMe({
      user: SUPER_ADMIN.user,
      membership: null,
      permissions: [...SUPER_ADMIN.permissions, 'company_template:write', 'company:crud'],
    });
    const COMPANIES = [
      { _id: 'co-2', name: 'Allianz Life', slug: 'allianz-life', status: 'active', usesPlatformDefaults: true },
      { _id: 'co-1', name: 'Prudential', slug: 'prudential', status: 'active', usesPlatformDefaults: true },
    ];
    const SAVED = {
      id: 't-bsd', companyId: 'co-1', name: 'BSD City settings', isDefault: false, status: 'active', archivedAt: null,
      origin: { kind: 'office', kpmId: 'kpm-1', companyId: 'co-1' }, officeCount: 0,
      publishedVersions: {
        activity_taxonomy: 1, lead_pipeline: 1, ratio_set: 1, activation_checklist: 1,
        training_taxonomy: 1, capability_ladder: 1, event_types: 1,
      },
      createdAt: '2026-10-07T03:00:00.000Z', updatedAt: '2026-10-07T03:00:00.000Z',
    };
    const mount = (routes: Parameters<typeof stubFetch>[0] = {}, me = WRITER) => {
      const stub = stubFetch({
        '/admin/tenants/kpm-1': { body: KPM },
        '/admin/companies': { body: COMPANIES },
        ...routes,
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me });
      return stub;
    };
    const open = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Save as template' }));
      return screen.getByRole('dialog', { name: 'Save as template' });
    };

    it('is offered only to a reader who may write a template', async () => {
      mount({}, SUPER_ADMIN);
      expect(await screen.findByText('Asia/Jakarta')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save as template' })).not.toBeInTheDocument();
    });

    it('saves into the office’s own company, chosen first, and says so once it is made', async () => {
      const { calls } = mount({ 'POST /admin/tenants/kpm-1/template': { status: 201, body: SAVED } });
      const dialog = await open();
      // Says what crosses and what never does.
      expect(dialog).toHaveAccessibleDescription(/No member, log or lead is copied/);
      const company = await within(dialog).findByRole('combobox', { name: 'Company' });
      expect(within(company).getAllByRole('option').map((o) => o.textContent)).toEqual(['Prudential', 'Allianz Life']);
      expect(company).toHaveDisplayValue('Prudential');

      await userEvent.type(within(dialog).getByLabelText('Name'), 'BSD City settings');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));

      const post = calls.find((c) => c.init.method === 'POST')!;
      expect(post.url).toContain('/admin/tenants/kpm-1/template');
      expect(JSON.parse(post.init.body as string)).toEqual({ name: 'BSD City settings', companyId: 'co-1' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Saved as BSD City settings, a template of Prudential.');
    });

    it('exit review, finding 2: says what the template left out because it names something archived', async () => {
      const dropped = [
        {
          kind: 'ratio_set', code: 'LEADS_PER_ACTIVITY',
          reason: 'Ratio LEADS_PER_ACTIVITY was left out: its numerator counts only LEADS_NEW_PROSPECT, which is not an active activity type in this office.',
        },
        {
          kind: 'activation_checklist', code: 'CRM_SETUP',
          reason: 'Checklist item CRM_SETUP is kept as a manual item: the training module PROSPECT_LIST it linked to is not offered in this office.',
        },
      ];
      mount({ 'POST /admin/tenants/kpm-1/template': { status: 201, body: { ...SAVED, dropped } } });
      const dialog = await open();
      await within(dialog).findByRole('combobox', { name: 'Company' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'BSD City settings');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));

      const status = await screen.findByRole('status');
      await vi.waitFor(() => expect(status).toHaveTextContent('Saved as BSD City settings, a template of Prudential.'));
      expect(status).toHaveTextContent('Left out or changed, because they name something archived:');
      expect(status).toHaveTextContent(dropped[0].reason);
      expect(status).toHaveTextContent(dropped[1].reason);
    });

    it('saves into another company, and says in its words that the ladder lacks a role', async () => {
      const { calls } = mount({
        'POST /admin/tenants/kpm-1/template': [
          {
            status: 409,
            body: { error: {
              code: 'TEMPLATE_RUNG_UNKNOWN', requestId: 'r-1', details: { codes: ['SM'] },
              message: 'This company’s role ladder has no SM, and the settings being copied show ratios or activity sections to that role. Add it to the company’s ladder first, or copy other settings.',
            } },
          },
        ],
      });
      const dialog = await open();
      await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Company' }), 'co-2');
      await userEvent.type(within(dialog).getByLabelText('Name'), 'For Allianz');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));

      expect(JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string))
        .toEqual({ name: 'For Allianz', companyId: 'co-2' });
      expect(await within(dialog).findByText(/role ladder has no SM/)).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Save as template' })).toBeInTheDocument();
    });

    it('asks for a name, and says a taken one under it', async () => {
      const { calls } = mount({
        'POST /admin/tenants/kpm-1/template': {
          status: 409,
          body: { error: { code: 'TEMPLATE_NAME_TAKEN', message: 'This company already has a template called BSD. Choose another name.', requestId: 'r-2', details: { name: 'BSD' } } },
        },
      });
      const dialog = await open();
      await within(dialog).findByRole('combobox', { name: 'Company' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));
      expect(within(dialog).getByText('Give the template a name.')).toBeInTheDocument();
      expect(calls.some((c) => c.init.method === 'POST')).toBe(false);

      await userEvent.type(within(dialog).getByLabelText('Name'), 'BSD');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));
      expect(await within(dialog).findByText(/already has a template called BSD/)).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    });

    it('says when the office’s settings would make a broken office, as the API words it', async () => {
      mount({
        'POST /admin/tenants/kpm-1/template': {
          status: 400,
          body: { error: { code: 'VALIDATION_FAILED', message: 'KPM 0417’s published settings would produce a broken office, so nothing was created.', requestId: 'r-3' } },
        },
      });
      const dialog = await open();
      await within(dialog).findByRole('combobox', { name: 'Company' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'Broken');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));
      expect(await within(dialog).findByText(/would produce a broken office/)).toBeInTheDocument();
    });

    it('waits for the companies with a skeleton, and cannot be sent until they are here', async () => {
      let release: () => void = () => undefined;
      const pending = new Promise<void>((resolve) => { release = resolve; });
      mount();
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      const real = fetchMock.getMockImplementation()! as (url: string, init?: RequestInit) => Promise<Response>;
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/admin/companies')) await pending;
        return real(url, init);
      });
      const dialog = await open();
      expect(within(dialog).getByRole('status')).toHaveTextContent('Loading companies…');
      expect(within(dialog).getByRole('button', { name: 'Save template' })).toBeDisabled();
      release();
      expect(await within(dialog).findByRole('combobox', { name: 'Company' })).toBeInTheDocument();
    });

    it('has no axe violations with the dialog open', async () => {
      mount();
      const dialog = await open();
      await within(dialog).findByRole('combobox', { name: 'Company' });
      expect((await axe(dialog, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
    });
  });
});
