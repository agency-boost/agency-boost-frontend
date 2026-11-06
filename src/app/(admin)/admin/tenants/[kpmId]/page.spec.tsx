import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, routeParams, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import TenantDetailPage from './page';

const push = vi.hoisted(() => vi.fn());
/** The address's query: `?tab=` picks the KPM page's tab (P19.4-T3). */
const address = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/admin/tenants/kpm-1',
  useSearchParams: () => new URLSearchParams(address.search),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:read_profile', 'kpm:suspend', 'kpm:assign_owner'],
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
    // Nor a placeholder where it stood: *Ringkasan*'s cards are the page (P19.4-T3 AC-9) — the Owner, the Admins, the
    // members, then the KPM's profile and lifecycle.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
      .toEqual(['Owner', 'Admin', 'Members', 'Profile', 'Lifecycle']);
  });

  it('P3.1-T14 AC-7: names the owner, and keeps the one id support asks for', async () => {
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
    expect(await screen.findByRole('link', { name: 'Change owner' })).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();

    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null } } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
    expect(await screen.findByRole('link', { name: 'Set owner' })).toBeInTheDocument();
    expect(screen.getByText(/Nobody can run this KPM until one is set/)).toBeInTheDocument();
  });

  /*
   * **P19.4-T2 AC-3, AC-8 (UI-151; Overview case 10; ADR-0206 §6): no *Impor roster*.** The people are the KPM's; the
   * *People* card says its Owner or an Admin adds them, and nothing on the page links to an import or an upload.
   */
  it('P19.4-T2 AC-3 offers no import or upload of the KPM’s, and says the Owner or an Admin adds the members', async () => {
    const IMPERSONATOR = { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'impersonation:start'] };
    // P19.4-T3 AC-9 (A2, UI-151): with nobody but the Owner, *"Belum ada anggota"* says the Owner or an Admin imports —
    // with no link to an import.
    stubFetch({ '/admin/tenants/kpm-1': { body: { ...KPM, memberCount: 1, membersBesidesOwner: 0 } } });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: IMPERSONATOR });
    const warning = await screen.findByRole('note');
    expect(warning).toHaveTextContent('No members yet. The KPM’s Owner or an Admin imports its members, on their People page.');
    expect(within(warning).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /import|roster|upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import|roster|upload/i })).not.toBeInTheDocument();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).not.toMatch(/roster|data-upload|people\/import|purpose=/);
    }
  });

  /*
   * *Open as Owner* on the Owner card, to the start screen of a session as them that only looks (P19.4-T2 AC-1, AC-7;
   * ADR-0206 §3; it was a setup session's, ADR-0162). Only where there is an Owner, the office is active and the reader
   * may start a session.
   */
  describe('Open as Owner (ADR-0206)', () => {
    const IMPERSONATOR = { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'impersonation:start'] };

    it('P19.4-T2 AC-7 opens the start screen as the office’s Owner, from the Owner card, naming no purpose', async () => {
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: IMPERSONATOR });

      const link = await screen.findByRole('link', { name: 'Open as Owner' });
      // No purpose: there is one kind of session, *Hanya melihat* (UI-151, ADR-0206 §3).
      expect(link).toHaveAttribute('href', '/admin/impersonate/u-owner?kpmId=kpm-1');
      const card = screen.getByRole('heading', { name: 'Owner' }).parentElement!;
      expect(within(card).getByRole('link', { name: 'Open as Owner' })).toBe(link);
    });

    it.each([
      ['an office with no Owner', { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null }],
      ['a suspended office', { ...KPM, status: 'suspended' }],
      ['an archived office', { ...KPM, status: 'archived' }],
    ])('AC-5 is not offered for %s', async (_case, body) => {
      stubFetch({ '/admin/tenants/kpm-1': { body } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: IMPERSONATOR });
      expect(await screen.findByRole('heading', { name: 'Owner' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open as Owner' })).not.toBeInTheDocument();
    });

    it('is not offered to a reader who may not start a session', async () => {
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
      expect(await screen.findByRole('link', { name: 'Change owner' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open as Owner' })).not.toBeInTheDocument();
    });
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
    ['active', '2027-01-05', 'Active until 5 Jan 2027', 'Active'],
    ['ended', '2026-09-25', 'Ended 25 Sep 2026', 'Ended'],
    ['ended_kept_active', '2026-10-02', 'Ended 2 Oct 2026 — kept active', 'Ended — kept active'],
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

  /** P19-T3 (ADR-0191 §5; UI-168 points 1 and 4): moving an office, and deleting an empty one. */
  describe('P19-T3 move and delete', () => {
    const MOVER = makeMe({
      user: SUPER_ADMIN.user, membership: null,
      permissions: [...SUPER_ADMIN.permissions, 'kpm:update_company_tag', 'kpm:archive'],
    });
    const INSURERS = { body: [{ _id: 'co-1', name: 'Prudential' }, { _id: 'co-2', name: 'Manulife' }] };

    it('P19-T3 AC-6 moves the office to another company and says where its settings now come from', async () => {
      const { calls } = stubFetch({
        '/admin/tenants/kpm-1/company': { body: { ...KPM, companyId: 'co-2', companyName: 'Manulife' } },
        '/admin/tenants/kpm-1': { body: KPM },
        '/companies': INSURERS,
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: MOVER });

      await userEvent.click(await screen.findByRole('button', { name: 'Move to another company' }));
      expect(screen.getByText(/Only for an office with no member but its Owner/)).toBeInTheDocument();
      await screen.findByRole('option', { name: 'Manulife' });
      // The company it is in is not offered.
      expect(screen.queryByRole('option', { name: 'Prudential' })).toBeNull();
      await userEvent.selectOptions(screen.getByLabelText('New company'), 'co-2');
      await userEvent.click(screen.getByRole('button', { name: 'Move' }));

      const patch = calls.find((c) => c.init.method === 'PATCH' && c.url.endsWith('/company'))!;
      expect(JSON.parse(patch.init.body as string)).toEqual({ companyId: 'co-2' });
      expect(await screen.findByText('Moved to Manulife. Its settings now come from Manulife’s default template.')).toBeInTheDocument();
    });

    it('P19-T3 AC-6 shows the refusal for an office with members, with the reason', async () => {
      stubFetch({
        '/admin/tenants/kpm-1/company': { status: 409, body: { error: {
          code: 'TENANT_NOT_EMPTY', message: 'This office has 3 members besides its Owner, so it cannot move to another company.',
          details: { members: 3 }, requestId: 'r-1',
        } } },
        '/admin/tenants/kpm-1': { body: KPM },
        '/companies': INSURERS,
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: MOVER });
      await userEvent.click(await screen.findByRole('button', { name: 'Move to another company' }));
      await screen.findByRole('option', { name: 'Manulife' });
      await userEvent.selectOptions(screen.getByLabelText('New company'), 'co-2');
      await userEvent.click(screen.getByRole('button', { name: 'Move' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('3 members besides its Owner');
    });

    it('P19-T3 AC-7 deletes an empty office after a confirmation that shows the counts', async () => {
      push.mockClear();
      const { calls } = stubFetch({
        '/admin/tenants/kpm-1/contents': { body: { members: 0, records: 0, deletable: true } },
        'DELETE /admin/tenants/kpm-1': { body: { deleted: true, kpmId: 'kpm-1' } },
        '/admin/tenants/kpm-1': { body: { ...KPM, ownerUserId: null, ownerName: null, ownerEmail: null } },
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: MOVER });

      await userEvent.click(await screen.findByRole('button', { name: 'Delete KPM' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Delete KPM 0417 · BSD City Branch? It has 0 members and 0 records.');
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete KPM' }));

      await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/admin/tenants'));
      expect(calls.some((c) => c.init.method === 'DELETE' && c.url.endsWith('/admin/tenants/kpm-1'))).toBe(true);
    });

    it('P19-T3 AC-7 offers Archive instead for an office with a member or a record, and never deletes it', async () => {
      const { calls } = stubFetch({
        '/admin/tenants/kpm-1/contents': { body: { members: 4, records: 120, deletable: false } },
        '/admin/tenants/kpm-1/status': { body: {} },
        '/admin/tenants/kpm-1': { body: KPM },
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: MOVER });

      await userEvent.click(await screen.findByRole('button', { name: 'Delete KPM' }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('KPM 0417 · BSD City Branch has 4 members and 120 records, so it cannot be deleted. Archive it instead?');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

      await vi.waitFor(() => expect(calls.some((c) => c.url.endsWith('/status') && c.init.method === 'PATCH')).toBe(true));
      const patch = calls.find((c) => c.url.endsWith('/status'))!;
      expect(JSON.parse(patch.init.body as string)).toMatchObject({ status: 'archived' });
      expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    });

    it('P19-T3 offers neither to a reader without the grants: the API refuses them too', async () => {
      stubFetch({ '/admin/tenants/kpm-1': { body: KPM } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
      expect(await screen.findByRole('heading', { name: 'Owner' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Move to another company' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete KPM' })).toBeNull();
    });
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

  /*
   * P18.6-T2 AC-3 (ADR-0163): the office's activity binding, kept by the Super Admin — which activities each cascade
   * stage counts, and a replacement added beside the old one.
   */
  describe('Activity binding (P18.6-T2)', () => {
    const KEEPER = { ...SUPER_ADMIN, permissions: [...SUPER_ADMIN.permissions, 'activity_binding:read', 'activity_binding:write'] };
    const BINDING = {
      kpmId: 'kpm-1', leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION'], closings: ['SELL_SUBMISSION'],
      version: 1, updatedAt: null,
      types: [
        { code: 'LEADS_CONTACTED', label: 'Set Appointment', categoryCode: 'LEADS_GENERATION', displayOrder: 3, status: 'active' },
        { code: 'SELL_PRESENTATION', label: 'Presentasi', categoryCode: 'SELLING', displayOrder: 4, status: 'active' },
        { code: 'SALES_MEETING', label: 'Sales meeting baru', categoryCode: 'SELLING', displayOrder: 5, status: 'active' },
        { code: 'SELL_SUBMISSION', label: 'Submission', categoryCode: 'SELLING', displayOrder: 6, status: 'active' },
        { code: 'OLD_CALLS', label: 'Telepon lama', categoryCode: 'LEADS_GENERATION', displayOrder: 7, status: 'archived' },
      ],
    };
    const mount = (me = KEEPER, binding: unknown = { body: BINDING }) => {
      const stub = stubFetch({ '/admin/tenants/kpm-1': { body: KPM }, '/admin/tenants/kpm-1/activity-binding': binding as never });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me });
      return stub;
    };
    const card = async () => (await screen.findByRole('heading', { name: 'Activity binding' })).parentElement!;

    it('AC-3 lists what each stage counts, archived types marked, and says old codes keep counting', async () => {
      mount();
      const binding = await card();
      expect(binding).toHaveTextContent('what was logged against the old one keeps counting');
      const meeting = await within(binding).findByRole('group', { name: 'Sales meeting' });
      expect(within(meeting).getByRole('list', { name: 'Sales meeting counts' })).toHaveTextContent('Presentasi');
      // Offered: the types no stage holds, the archived one marked.
      const add = within(binding).getByRole('combobox', { name: 'Add an activity to Set appointment' });
      expect([...(add as HTMLSelectElement).options].map((o) => o.textContent))
        .toEqual(['Add an activity…', 'Sales meeting baru', 'Telepon lama (archived)']);
      // Nothing changed, nothing to save.
      expect(within(binding).getByRole('button', { name: 'Save binding' })).toBeDisabled();
    });

    it('AC-3 adds the replacement beside the old one and saves the whole binding with the version read', async () => {
      const { calls } = mount(KEEPER, [
        { body: BINDING },
        { body: { ...BINDING, appointments: ['SELL_PRESENTATION', 'SALES_MEETING'], version: 2 } },
      ]);
      const binding = await card();
      await userEvent.selectOptions(
        await within(binding).findByRole('combobox', { name: 'Add an activity to Sales meeting' }), 'SALES_MEETING',
      );
      expect(within(within(binding).getByRole('list', { name: 'Sales meeting counts' })).getAllByRole('listitem')
        .map((item) => item.firstChild?.textContent)).toEqual(['Presentasi', 'Sales meeting baru']);
      await userEvent.click(within(binding).getByRole('button', { name: 'Save binding' }));

      expect(await within(binding).findByRole('status')).toHaveTextContent('Saved. The summary counts it from now.');
      const put = calls.find((c) => c.init.method === 'PUT')!;
      expect(put.url).toContain('/admin/tenants/kpm-1/activity-binding');
      expect(JSON.parse(put.init.body as string)).toEqual({
        leads: ['LEADS_CONTACTED'], appointments: ['SELL_PRESENTATION', 'SALES_MEETING'], closings: ['SELL_SUBMISSION'],
        expectedVersion: 1,
      });
    });

    it('AC-3 shows the server’s refusal, and keeps what was typed', async () => {
      mount(KEEPER, [
        { body: BINDING },
        { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Sales meeting counts no activity type.', requestId: 'r-1' } } },
      ]);
      const binding = await card();
      await userEvent.click(await within(binding).findByRole('button', { name: 'Remove Presentasi from Sales meeting' }));
      expect(within(binding).getByRole('list', { name: 'Sales meeting counts' })).toHaveTextContent('Counts nothing yet.');
      await userEvent.click(within(binding).getByRole('button', { name: 'Save binding' }));
      expect(await within(binding).findByRole('alert')).toHaveTextContent('Sales meeting counts no activity type.');
      expect(within(binding).getByRole('list', { name: 'Sales meeting counts' })).toHaveTextContent('Counts nothing yet.');
    });

    it('is not drawn for a reader without activity_binding:read, and asks nothing', async () => {
      const { calls } = mount(SUPER_ADMIN);
      expect(await screen.findByRole('heading', { name: 'Lifecycle' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Activity binding' })).not.toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/activity-binding'))).toBe(false);
    });

    it('has no axe violations', async () => {
      mount();
      const binding = await card();
      await within(binding).findByRole('group', { name: 'Submission polis' });
      expect((await axe(binding, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
    });
  });

  /*
   * **The KPM page's tabs** (P19.4-T3 AC-9, AC-10; the setup spec's A2; the route registry): *Ringkasan · Anggota · Data
   * bulanan · Lihat sebagai KPM · Billing*, four in the query and *Lihat sebagai KPM* its own route — each drawn for a
   * reader whose grants open it, every one read-only.
   */
  describe('P19.4-T3 — the KPM page’s tabs', () => {
    const READER = {
      ...SUPER_ADMIN,
      permissions: [...SUPER_ADMIN.permissions, 'platform_members:read', 'platform_kpm_figures:read', 'billing:read_prices'],
    };
    const PROFILE = {
      ...KPM, memberCount: 9, membersBesidesOwner: 8, ownerState: 'active', ownerPhone: '+6281234567890',
      admins: [{ fullName: 'Maya Kusuma', state: 'invited' }],
      membersByRole: [{ code: 'AB', label: 'AB', count: 2 }, { code: 'AAB', label: 'AAB', count: 3 }, { code: 'AGENT', label: 'Agent', count: 4 }],
    };
    const DATA = {
      kpmId: 'kpm-1',
      months: [
        ...['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map((month) => ({ month, status: 'none' })),
        { month: '2026-07', status: 'missing' }, { month: '2026-08', status: 'complete' }, { month: '2026-09', status: 'complete' },
        { month: '2026-10', status: 'missing' },
      ],
      uploads: [{ month: '2026-09', by: 'Rina Wijaya', at: '2026-10-05T03:00:00.000Z', agents: 41, note: { status: 'committed', asOf: null } }],
    };
    afterEach(() => { address.search = ''; });

    it.each([375, 1280])('P19.4-T3 AC-9 at %ipx Ringkasan: the Owner, the Admins read-only, the members by role, the 12 months', async (px) => {
      atWidth(px);
      stubFetch({ '/admin/tenants/kpm-1/data': { body: DATA }, '/admin/tenants/kpm-1': { body: PROFILE } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: READER });
      const tabs = await screen.findByRole('navigation', { name: 'KPM page' });
      expect(within(tabs).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
        ['At a glance', '/admin/tenants/kpm-1'], ['Members', '/admin/tenants/kpm-1?tab=anggota'], ['Monthly data', '/admin/tenants/kpm-1?tab=data'],
        ['View as KPM', '/admin/tenants/kpm-1/analytics'], ['Billing', '/admin/tenants/kpm-1?tab=billing'],
      ]);
      expect(within(tabs).getByRole('link', { name: 'At a glance' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByText('Maya Kusuma')).toBeInTheDocument();
      expect(screen.getByText('The Owner adds and removes Admins.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add admin/i })).not.toBeInTheDocument();
      expect(screen.getByText('AB 2 · AAB 3 · Agent 4')).toBeInTheDocument();
      const grid = (await screen.findByRole('heading', { name: 'Monthly data · last 12 months' })).parentElement!;
      expect(within(grid).getAllByRole('listitem')).toHaveLength(12);
      expect(within(grid).getAllByText('Complete')).toHaveLength(2);
      expect(within(grid).queryByText(/HQ/)).not.toBeInTheDocument();
    });

    it('P19.4-T3 AC-9 Anggota: the KPM’s members, read-only — no add, no import', async () => {
      address.search = 'tab=anggota';
      const { calls } = stubFetch({
        '/admin/members': { body: { rows: [], page: 1, pageSize: 50, total: 0 } },
        '/admin/tenants/kpm-1': { body: PROFILE },
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: READER });
      expect(await screen.findByText('Read only. The KPM’s Owner and Admins add, change and import members.')).toBeInTheDocument();
      expect(await screen.findByText('No members yet. Members appear here once a KPM imports people.')).toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/admin/members?kpmId=kpm-1'))).toBe(true);
      expect(screen.queryByRole('button', { name: /add member|import/i })).not.toBeInTheDocument();
    });

    it('P19.4-T3 AC-9 Anggota’s table: Kode agen, Nama, Peran, Upline, Bergabung, Status — Aktif · Diundang · Belum diundang', async () => {
      address.search = 'tab=anggota';
      const row = (over: Record<string, unknown>) => ({
        membershipId: 'm-1', fullName: 'Rina Wijaya', agentCode: '70045001', company: { id: 'co-1', name: 'Prudential' },
        kpm: { id: 'kpm-1', code: '0417', branch: 'BSD City Branch' }, role: { code: 'AB', label: 'AB', isOwner: true, isAdmin: false },
        leader: null, status: 'active', invitation: 'signed_in', joinedOn: '2024-03-01', lastActiveOn: null, ...over,
      });
      stubFetch({
        '/admin/members': {
          body: {
            rows: [
              row({}),
              row({ membershipId: 'm-2', fullName: 'Bayu Saputra', agentCode: '70045002', invitation: 'invited', leader: { fullName: 'Rina Wijaya' } }),
              row({ membershipId: 'm-3', fullName: 'Dewi Lestari', agentCode: '70045003', invitation: 'not_invited' }),
            ],
            page: 1, pageSize: 50, total: 3,
          },
        },
        '/admin/tenants/kpm-1': { body: PROFILE },
      });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: READER });
      const table = await screen.findByRole('table', { name: 'Every member on the platform' });
      expect(within(table).getAllByRole('columnheader').map((h) => h.textContent))
        .toEqual(['Agent code', 'Name', 'Role', 'Upline', 'Joined', 'Status']);
      expect(within(within(table).getByRole('row', { name: /70045001/ })).getByText('Active')).toBeInTheDocument();
      expect(within(within(table).getByRole('row', { name: /70045002/ })).getByText('Invited')).toBeInTheDocument();
      expect(within(within(table).getByRole('row', { name: /70045003/ })).getByText('Not invited')).toBeInTheDocument();
    });

    it('P19.4-T3 AC-9 Data bulanan: the grid and the upload history, by name, with no upload', async () => {
      address.search = 'tab=data';
      stubFetch({ '/admin/tenants/kpm-1/data': { body: DATA }, '/admin/tenants/kpm-1': { body: PROFILE } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: READER });
      const history = await screen.findByRole('table', { name: 'Upload history' });
      expect(within(history).getByRole('row', { name: /Rina Wijaya/ })).toHaveTextContent('41');
      expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
    });

    it('P19.4-T3 AC-16 a reader without the platform grants sees only Ringkasan, and nothing reads the figures', async () => {
      const { calls } = stubFetch({ '/admin/tenants/kpm-1': { body: PROFILE } });
      renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: SUPER_ADMIN });
      const tabs = await screen.findByRole('navigation', { name: 'KPM page' });
      expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['At a glance']);
      expect(calls.some((c) => c.url.includes('/data') || c.url.includes('/admin/members'))).toBe(false);
    });
  });
});

/**
 * **P19.2-T2 — a KPM's page below 1024px** (UI-134, UI-135): *Status*, *Pindahkan ke perusahaan lain* and *Simpan
 * sebagai template*'s company draw no native select on a phone or a tablet — three choice rows for the state, a pill
 * opening its choices for a company — and the laptop keeps its selects; every target in `main` is 44px. What each does
 * is the same.
 */
describe('P19.2-T2 a KPM’s page below 1024px (UI-134, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ALL = makeMe({
    user: SUPER_ADMIN.user, membership: null,
    permissions: [...SUPER_ADMIN.permissions, 'kpm:update_company_tag', 'kpm:archive', 'company_template:write', 'company:crud'],
  });
  const INSURERS = { body: [{ _id: 'co-1', name: 'Prudential' }, { _id: 'co-2', name: 'Manulife' }] };
  const mount = (routes: Parameters<typeof stubFetch>[0] = {}) => {
    const stub = stubFetch({ '/admin/tenants/kpm-1': { body: KPM }, '/companies': INSURERS, ...routes });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, { me: ALL });
    return stub;
  };

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx Status is three choice rows, and a suspension sends its reason as before', async (px) => {
    atWidth(px);
    const { calls } = mount({
      '/admin/tenants/kpm-1/status': { body: {} },
      '/admin/tenants/kpm-1': [{ body: KPM }, { body: { ...KPM, status: 'suspended', suspendedReason: 'unpaid invoice' } }],
    });
    const status = await screen.findByRole('radiogroup', { name: 'Status' });
    expect(document.querySelector('select')).toBeNull();
    expect(within(status).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Active', 'Suspended', 'Archived']);
    expect(within(status).getByRole('radio', { name: 'Active' })).toBeChecked();
    await userEvent.click(within(status).getByRole('radio', { name: 'Suspended' }));
    await userEvent.type(screen.getByLabelText('Reason'), 'unpaid invoice');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string)).toEqual({ status: 'suspended', reason: 'unpaid invoice' });
    expect(await screen.findByText('Suspended: unpaid invoice')).toBeInTheDocument();
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx moving a KPM: a pill opening the companies, the one it is in left out', async (px) => {
    atWidth(px);
    const { calls } = mount({ '/admin/tenants/kpm-1/company': { body: { ...KPM, companyId: 'co-2', companyName: 'Manulife' } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Move to another company' }));
    const pill = screen.getByRole('button', { name: 'New company: New company' });
    expect(pill).toHaveAccessibleDescription(expect.stringContaining('Only for an office with no member but its Owner'));
    expect(document.querySelector('select')).toBeNull();
    // Nothing chosen, nothing to move.
    expect(screen.getByRole('button', { name: 'Move' })).toBeDisabled();
    await userEvent.click(pill);
    const sheet = await screen.findByRole('dialog', { name: 'Choose new company' });
    // The companies arrive once the move is open; the sheet lists them as they do.
    await waitFor(() => expect(within(sheet).getAllByRole('radio')).toHaveLength(1));
    expect(within(sheet).queryByRole('radio', { name: 'Prudential' })).toBeNull();
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Manulife' }));
    expect(screen.getByRole('button', { name: 'New company: Manulife' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    const patch = calls.find((c) => c.init.method === 'PATCH' && c.url.endsWith('/company'))!;
    expect(JSON.parse(patch.init.body as string)).toEqual({ companyId: 'co-2' });
    expect(await screen.findByText('Moved to Manulife. Its settings now come from Manulife’s default template.')).toBeInTheDocument();
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx Save as template’s company is a pill, the office’s own first and chosen', async (px) => {
    atWidth(px);
    const { calls } = mount({
      '/admin/companies': { body: [
        { _id: 'co-2', name: 'Allianz Life', slug: 'allianz-life', status: 'active', usesPlatformDefaults: true },
        { _id: 'co-1', name: 'Prudential', slug: 'prudential', status: 'active', usesPlatformDefaults: true },
      ] },
      'POST /admin/tenants/kpm-1/template': { status: 201, body: { id: 't-1', companyId: 'co-2', name: 'For Allianz', dropped: [] } },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Save as template' }));
    const dialog = screen.getByRole('dialog', { name: 'Save as template' });
    const pill = await within(dialog).findByRole('button', { name: 'Company: Prudential' });
    expect(document.querySelector('select')).toBeNull();
    await userEvent.click(pill);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Choose company' })).getByRole('radio', { name: 'Allianz Life' }));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'For Allianz');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save template' }));
    expect(JSON.parse(calls.find((c) => c.init.method === 'POST')!.init.body as string)).toEqual({ name: 'For Allianz', companyId: 'co-2' });
  });

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx Data bulanan’s upload history is a row per upload, no table', async (px) => {
    atWidth(px);
    address.search = 'tab=data';
    stubFetch({
      '/admin/tenants/kpm-1/data': { body: {
        kpmId: 'kpm-1', months: [{ month: '2026-09', status: 'complete' }],
        uploads: [{ month: '2026-09', by: 'Rina Wijaya', at: '2026-10-05T03:00:00.000Z', agents: 41, note: { status: 'committed', asOf: null } }],
      } },
      '/admin/tenants/kpm-1': { body: KPM },
    });
    renderInLayout(AdminLayout, <TenantDetailPage params={params} />, {
      me: { ...ALL, permissions: [...ALL.permissions, 'platform_kpm_figures:read'] },
    });
    const list = await screen.findByRole('list', { name: 'Upload history' });
    expect(screen.queryByRole('table')).toBeNull();
    const [row] = within(list).getAllByRole('listitem');
    expect(row).toHaveTextContent('Sep 2026');
    expect(row).toHaveTextContent('Rina Wijaya · 5 Oct 2026');
    expect(row).toHaveTextContent('Agent rows 41 · Imported');
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
    address.search = '';
  });

  it.each([1024, 1280])('P19.2-T2 AC-4 at %ipx keeps the laptop’s selects: Status and New company', async (px) => {
    atWidth(px);
    mount();
    expect((await screen.findByLabelText('Status')).tagName).toBe('SELECT');
    await userEvent.click(screen.getByRole('button', { name: 'Move to another company' }));
    expect(screen.getByLabelText('New company').tagName).toBe('SELECT');
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main, the move open', async (px) => {
    atWidth(px);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Move to another company' }));
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-4 at %ipx has no axe violations, the move open', async (px) => {
    atWidth(px);
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Move to another company' }));
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
