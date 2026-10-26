import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import OrgLevelsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/org-levels',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // `kpm:list_all` is the **layout's** gate, not this screen's: being in the platform
  // console at all is checked once, above every route in the group (P3.5-T14 Stage 2).
  permissions: ['kpm:list_all', 'org_level:read', 'org_level:crud', 'company:crud'],
});

const COMPANIES = [
  { _id: 'co-1', name: 'Prudential', slug: 'prudential', defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta', status: 'active' },
];

const rung = (over: Record<string, unknown> = {}) => ({
  orgLevelId: 'lvl-1', companyId: 'co-1', code: 'AGENT', label: 'Agent',
  displayOrder: 1, leaderTier: null, status: 'active', archivedAt: null, ...over,
});

const LADDER = [
  rung(),
  rung({ orgLevelId: 'lvl-2', code: 'AAB', label: 'AAB', displayOrder: 2, leaderTier: 'associate' }),
  rung({ orgLevelId: 'lvl-3', code: 'AB', label: 'AB', displayOrder: 3, leaderTier: 'senior' }),
];

describe('org role ladder (P3.5-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: reads junior first, by the name of each rung', async () => {
    // The code used to be a column of its own. It is on the row's edit panel now: a reader
    // scanning a ladder is looking for *Agent*, and `AGENT` beside it was the same word twice.
    stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Agent'),
      expect.stringContaining('AAB'),
      expect.stringContaining('AB'),
    ]);
    expect(screen.getByText('Agent → AAB → AB')).toBeInTheDocument();
  });

  it('AC-1: the reading order shows only active rungs', async () => {
    // An archived rung on the ladder sentence would read as one somebody could still be
    // given. It stays in the table, because everybody who stood on it still renders.
    stubFetch({
      '/admin/org-levels': { body: [LADDER[0], { ...LADDER[1], status: 'archived' }, LADDER[2]] },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Agent → AB')).toBeInTheDocument();
    const row = within(screen.getByRole('table')).getByRole('row', { name: /AAB/ });
    expect(row).toHaveTextContent('Archived');
  });

  it('AC-3: archives rather than deletes, and offers the rung back', async () => {
    const { calls } = stubFetch({
      '/admin/org-levels/lvl-2': { body: [LADDER[0], { ...LADDER[1], status: 'archived' }, LADDER[2]] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /AAB/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));

    const patch = calls.find((c) => c.init.method === 'PATCH');
    expect(patch?.url).toContain('/admin/org-levels/lvl-2');
    expect(JSON.parse(String(patch?.init.body))).toEqual({ status: 'archived' });
    // No delete anywhere on this screen — there is no such affordance to find.
    expect(screen.queryByRole('button', { name: /Delete|Remove/ })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('AC-1: refuses a code the API would refuse, before the round trip', async () => {
    stubFetch({ '/admin/org-levels': { body: [] }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Code'), '9LEVEL');
    expect(screen.getByText('Letters, digits and underscores, starting with a letter.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add rung' })).toBeDisabled();
  });

  it('AC-1: adds to the end of the ladder, because a rung is appended not inserted', async () => {
    const { calls } = stubFetch({
      '/admin/org-levels': [{ body: LADDER }, { body: LADDER }],
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Code'), 'SAB');
    await userEvent.type(screen.getByLabelText('Label'), 'Senior AB');
    await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));

    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(String(post?.init.body))).toEqual({
      companyId: 'co-1', code: 'SAB', label: 'Senior AB', displayOrder: 4, leaderTier: null,
    });
  });

  it('AC-1: a taken code lands on the Code field, saying it may be archived', async () => {
    stubFetch({
      '/admin/org-levels': [
        { body: [] },
        {
          status: 409,
          body: {
            error: {
              code: 'ORG_LEVEL_CODE_TAKEN',
              message: 'Prudential already has a level with the code AAB, archived. An archived code is never reused.',
              requestId: 'req-1',
            },
          },
        },
      ],
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Code'), 'AAB');
    await userEvent.type(screen.getByLabelText('Label'), 'AAB');
    await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('An archived code is never reused');
    expect(screen.getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('AC-2: never renders for somebody without the permission', () => {
    // The screen's own gate. The API refuses too — `auth.e2e.int.spec.ts` proves that,
    // and a permission expressed only here would be a blocking defect.
    stubFetch({ '/admin/org-levels': { body: [] }, '/admin/companies': { body: COMPANIES } });
    // The office gate is granted deliberately, so what is being tested is *this screen's*
    // refusal rather than the layout's, which would come first and prove nothing.
    renderInLayout(AdminLayout, <OrgLevelsPage />, {
      me: makeMe({ ...SUPER_ADMIN, permissions: ['kpm:list_all'] }),
    });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    /*
     * `org_level:crud`, not `org_level:read` — and the change is the point. P4-T9 widened
     * the read to every member so badges could be drawn from the company's own ladder, and
     * this screen shared the permission name while showing *every* company's ladder. The
     * Phase 4 exit review read fifty-seven rungs across nineteen companies with a KPM
     * Owner's token. Members read their own company's ladder from `/kpm/org-levels`.
     */
    expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
    // The gate's code is on the refusal as data, and never in its words (P11-T6).
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'org_level:crud');
  });

  describe('P18.8-T1 the leader tier (ADR-0156)', () => {
    const tierOf = async (label: string) => screen.findByRole('combobox', { name: `Leader tier of ${label}` });

    it('AC-6 shows each rung’s tier in its own column, in the client’s words', async () => {
      stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByRole('columnheader', { name: 'Leader tier' })).toBeInTheDocument();
      expect(await tierOf('Agent')).toHaveDisplayValue('Not a leader');
      expect(await tierOf('AAB')).toHaveDisplayValue('Associate Leader');
      expect(await tierOf('AB')).toHaveDisplayValue('Senior Leader');
      const options = within(await tierOf('Agent')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['Senior Leader', 'Associate Leader', 'Not a leader']);
    });

    it('AC-6 saves a change of tier at once, Not a leader as null', async () => {
      const custom = [...LADDER, rung({ orgLevelId: 'lvl-4', code: 'SM', label: 'Senior Manager', displayOrder: 4 })];
      const { calls } = stubFetch({
        '/admin/org-levels/lvl-4': [
          { body: [...LADDER, { ...custom[3], leaderTier: 'senior' }] },
          { body: custom },
        ],
        '/admin/org-levels': { body: custom },
        '/admin/companies': { body: COMPANIES },
      });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      await userEvent.selectOptions(await tierOf('Senior Manager'), 'Senior Leader');
      expect(await tierOf('Senior Manager')).toHaveDisplayValue('Senior Leader');
      await userEvent.selectOptions(await tierOf('Senior Manager'), 'Not a leader');
      expect(await tierOf('Senior Manager')).toHaveDisplayValue('Not a leader');

      const patches = calls.filter((c) => c.init.method === 'PATCH');
      expect(patches.map((c) => [c.url.split('/api/v1')[1] ?? c.url, JSON.parse(String(c.init.body))])).toEqual([
        [expect.stringContaining('/admin/org-levels/lvl-4'), { leaderTier: 'senior' }],
        [expect.stringContaining('/admin/org-levels/lvl-4'), { leaderTier: null }],
      ]);
    });

    it('AC-6 says how many stand on a rung whose tier cannot change, and keeps the stored tier', async () => {
      stubFetch({
        '/admin/org-levels/lvl-3': {
          status: 409,
          body: {
            error: {
              code: 'ORG_LEVEL_TIER_IN_USE',
              message: 'The API’s sentence.',
              details: { orgLevelId: 'lvl-3', code: 'AB', members: 12 },
              requestId: 'req-2',
            },
          },
        },
        '/admin/org-levels': { body: LADDER },
        '/admin/companies': { body: COMPANIES },
      });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      await userEvent.selectOptions(await tierOf('AB'), 'Associate Leader');
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '12 people stand on AB, so its leader tier cannot change. Move them to another rung first, or add a new rung.',
      );
      expect(await tierOf('AB')).toHaveDisplayValue('Senior Leader');
    });

    it('AC-6 falls back to the API’s sentence when the refusal carries no count', async () => {
      stubFetch({
        '/admin/org-levels/lvl-3': {
          status: 409,
          body: { error: { code: 'ORG_LEVEL_TIER_IN_USE', message: 'Somebody stands on it.', requestId: 'req-3' } },
        },
        '/admin/org-levels': { body: LADDER },
        '/admin/companies': { body: COMPANIES },
      });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      await userEvent.selectOptions(await tierOf('AB'), 'Not a leader');
      expect(await screen.findByRole('alert')).toHaveTextContent('Somebody stands on it.');
    });

    it('AC-6 adds a rung with the tier chosen on Add a rung', async () => {
      const { calls } = stubFetch({
        '/admin/org-levels': [{ body: LADDER }, { body: LADDER }],
        '/admin/companies': { body: COMPANIES },
      });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByLabelText('Leader tier')).toHaveDisplayValue('Not a leader');
      await userEvent.type(screen.getByLabelText('Code'), 'UM');
      await userEvent.type(screen.getByLabelText('Label'), 'Unit Manager');
      await userEvent.selectOptions(screen.getByLabelText('Leader tier'), 'Associate Leader');
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));

      const post = calls.find((c) => c.init.method === 'POST');
      expect(JSON.parse(String(post?.init.body))).toMatchObject({ code: 'UM', leaderTier: 'associate' });
      // The form resets to the default, so the next rung is not marked a leader by accident.
      expect(await screen.findByLabelText('Leader tier')).toHaveDisplayValue('Not a leader');
    });

    describe('P18.95-T1 AC-5 — the tier says it is saved, beside its select', () => {
      /** The save confirmation in the select's own cell: the nearest ancestor with a status for a child. */
      const besides = (el: HTMLElement) => {
        for (let box = el.parentElement; box; box = box.parentElement) {
          const own = [...box.children].find((c) => c.getAttribute('role') === 'status');
          if (own) return own as HTMLElement;
          if (box.tagName === 'TD') break;
        }
        return null;
      };
      const RETAGGED = [LADDER[0], LADDER[1], { ...LADDER[2], leaderTier: 'associate' }];
      const patches = (calls: { url: string; init: RequestInit }[]) =>
        calls.filter((c) => c.init.method === 'PATCH').map((c) => [c.url.split('/admin/org-levels/')[1], JSON.parse(String(c.init.body))]);

      it('P18.95-T1 AC-5: says Saved ✓ under the select once the tier is kept, inside its own cell', async () => {
        stubFetch({
          '/admin/org-levels/lvl-3': { body: RETAGGED },
          '/admin/org-levels': { body: LADDER },
          '/admin/companies': { body: COMPANIES },
        });
        renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

        await userEvent.selectOptions(await tierOf('AB'), 'Associate Leader');

        await waitFor(() => expect(besides(screen.getByRole('combobox', { name: 'Leader tier of AB' }))).toHaveTextContent('Saved ✓'));
        expect(besides(screen.getByRole('combobox', { name: 'Leader tier of AB' }))).toHaveClass('text-success');
        expect(await tierOf('AB')).toHaveDisplayValue('Associate Leader');
        expect(besides(await tierOf('AAB'))).toBeNull();
        expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
      });

      it('P18.95-T1 AC-5: a failed tier says Couldn’t save — retry, and the retry sends the same tier again', async () => {
        const { calls } = stubFetch({
          '/admin/org-levels/lvl-3': [
            { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'req-9' } } },
            { body: RETAGGED },
          ],
          '/admin/org-levels': { body: LADDER },
          '/admin/companies': { body: COMPANIES },
        });
        renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
        await userEvent.selectOptions(await tierOf('AB'), 'Associate Leader');

        const retry = await screen.findByRole('button', { name: "Couldn't save — retry: Leader tier, AB" });
        expect(besides(await tierOf('AB'))).toContainElement(retry);
        // The reason stays in the banner at the top, where it always was; the select still shows the stored tier.
        expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong.');
        expect(await tierOf('AB')).toHaveDisplayValue('Senior Leader');

        await userEvent.click(retry);

        await waitFor(() => expect(patches(calls)).toEqual([
          ['lvl-3', { leaderTier: 'associate' }],
          ['lvl-3', { leaderTier: 'associate' }],
        ]));
        await waitFor(() => expect(besides(screen.getByRole('combobox', { name: 'Leader tier of AB' }))).toHaveTextContent('Saved ✓'));
        expect(await tierOf('AB')).toHaveDisplayValue('Associate Leader');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
      });

      it('P18.95-T1 AC-5: a tier refused while people stand on the rung (409) leaves no retry, the banner saying why', async () => {
        const { calls } = stubFetch({
          '/admin/org-levels/lvl-3': {
            status: 409,
            body: {
              error: {
                code: 'ORG_LEVEL_TIER_IN_USE', message: 'The API’s sentence.',
                details: { orgLevelId: 'lvl-3', code: 'AB', members: 12 }, requestId: 'req-10',
              },
            },
          },
          '/admin/org-levels': { body: LADDER },
          '/admin/companies': { body: COMPANIES },
        });
        renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
        await userEvent.selectOptions(await tierOf('AB'), 'Associate Leader');

        expect(await screen.findByRole('alert')).toHaveTextContent('12 people stand on AB, so its leader tier cannot change.');
        await waitFor(() => expect(besides(screen.getByRole('combobox', { name: 'Leader tier of AB' }))).toBeNull());
        expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
        expect(patches(calls)).toHaveLength(1);
      });
    });
  });

  it('tells a company with no ladder what to do first', async () => {
    stubFetch({ '/admin/org-levels': { body: [] }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    expect(
      await screen.findByText('Prudential has no ladder yet. Add the most junior rung first.'),
    ).toBeInTheDocument();
  });

  /*
   * **ADR-0168 §3 — the Template library's ladder is edited here** (amending P18.9-T3 AC-3, which left it out): it
   * is listed under *Company* by its name, an insurer still chosen first, and while it is chosen the *Template
   * library* badge of `/admin/companies` sits beside the select; its rungs take every write the insurers' do.
   */
  describe('the Template library (ADR-0168 §3)', () => {
    const LIBRARY = {
      _id: 'co-lib', name: 'Template', slug: 'template', defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta',
      status: 'active', kind: 'template',
    };
    const LIBRARY_LADDER = [
      rung({ orgLevelId: 'lib-1', companyId: 'co-lib' }),
      rung({ orgLevelId: 'lib-2', companyId: 'co-lib', code: 'AAB', label: 'AAB', displayOrder: 2, leaderTier: 'associate' }),
      rung({ orgLevelId: 'lib-3', companyId: 'co-lib', code: 'AB', label: 'Agency Builder', displayOrder: 3, leaderTier: 'senior' }),
    ];
    const routes = (extra: Parameters<typeof stubFetch>[0] = {}) => stubFetch({
      ...extra,
      '/admin/org-levels': { body: [...LADDER, ...LIBRARY_LADDER] },
      '/admin/companies': { body: [{ ...COMPANIES[0], kind: 'insurer' }, LIBRARY] },
    });

    it('lists it under Company, an insurer still chosen first, and no badge while an insurer is', async () => {
      routes();
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      const company = await screen.findByRole('combobox', { name: 'Company' });
      expect([...(company as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Prudential', 'Template']);
      expect(company).toHaveDisplayValue('Prudential');
      expect(await screen.findByText('Agent → AAB → AB')).toBeInTheDocument();
      expect(screen.queryByText('Template library')).not.toBeInTheDocument();
    });

    it('labels it Template library while it is chosen, the badge describing the select, and shows its ladder', async () => {
      routes();
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      const company = await screen.findByRole('combobox', { name: 'Company' });
      // The companies arrive after the select does: choose the library once it is an option.
      await screen.findByRole('option', { name: 'Template' });
      await userEvent.selectOptions(company, 'co-lib');
      const badge = await screen.findByText('Template library');
      expect(company).toHaveAccessibleDescription('Template library');
      // The same chip `/admin/companies` puts on the library's row: the component, its tone and its words.
      expect(badge).toHaveAttribute('data-tone', 'navy');
      expect(await screen.findByText('Agent → AAB → Agency Builder')).toBeInTheDocument();
    });

    it('takes a rung, a tier and an archive on its ladder, as on any company’s', async () => {
      const { calls } = routes({
        '/admin/org-levels/lib-2': { body: [LIBRARY_LADDER[0], { ...LIBRARY_LADDER[1], leaderTier: null }, LIBRARY_LADDER[2]] },
      });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      const company = await screen.findByRole('combobox', { name: 'Company' });
      await screen.findByRole('option', { name: 'Template' });
      await userEvent.selectOptions(company, 'co-lib');
      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Leader tier of AAB' }), 'Not a leader');
      const patch = calls.find((c) => c.init.method === 'PATCH');
      expect(patch?.url).toContain('/admin/org-levels/lib-2');
      expect(JSON.parse(String(patch?.init.body))).toEqual({ leaderTier: null });
      expect(await screen.findByRole('combobox', { name: 'Leader tier of AAB' })).toHaveDisplayValue('Not a leader');

      await userEvent.type(screen.getByLabelText('Code'), 'SM');
      await userEvent.type(screen.getByLabelText('Label'), 'Senior Manager');
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
      const post = calls.find((c) => c.init.method === 'POST');
      expect(JSON.parse(String(post?.init.body))).toMatchObject({ companyId: 'co-lib', code: 'SM', displayOrder: 4 });
    });

    it('is chosen where it is the only company', async () => {
      stubFetch({ '/admin/org-levels': { body: LIBRARY_LADDER }, '/admin/companies': { body: [LIBRARY] } });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByRole('combobox', { name: 'Company' })).toHaveDisplayValue('Template');
      expect(await screen.findByText('Agent → AAB → Agency Builder')).toBeInTheDocument();
      expect(screen.getByText('Template library')).toBeInTheDocument();
    });
  });
});
