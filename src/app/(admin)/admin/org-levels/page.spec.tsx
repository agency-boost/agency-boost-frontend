import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderInLayout, renderWithSession, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
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
  // console at all is checked once, above every route in the group (P3.1-T14 Stage 2).
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

/**
 * ***+ Tambah jenjang* on the title row, and the sheet it opens** (P19.2-T2 AC-3; UI-133): the add form is a sheet at
 * every size since 2026-11-06, where it was a card beside the table. Its fields are found inside it.
 */
async function openAdd() {
  await userEvent.click(await screen.findByRole('button', { name: 'Add rung' }));
  return screen.findByRole('dialog', { name: 'Add a rung' });
}

describe('org role ladder (P3.1-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: reads junior first, by the name of each rung', async () => {
    // The code used to be a column of its own. It is on the row's edit panel now: a reader
    // scanning a ladder is looking for *Agent*, and `AGENT` beside it was the same word twice.
    stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1);
    // Each label in its own field since P19.4-T5 (ADR-0213 §1): edited where it is read.
    expect(rows.map((r) => (within(r).getByRole('textbox') as HTMLInputElement).value)).toEqual(['Agent', 'AAB', 'AB']);
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
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
    // Delete is offered on an archived rung only (P19.4-T5, ADR-0213 §2): the one just archived, and no other.
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(1);
    expect(within(within(screen.getByRole('table')).getByRole('row', { name: /AAB/ })).getByRole('button', { name: 'Delete' }))
      .toBeInTheDocument();
  });

  // In the add sheet since P19.2-T2 AC-3 (UI-133), whose main button is enabled: the shape is said as it is typed, and
  // pressing sends nothing — where it was a disabled button.
  it('AC-1: refuses a code the API would refuse, before the round trip', async () => {
    const { calls } = stubFetch({ '/admin/org-levels': { body: [] }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    const sheet = await openAdd();
    await userEvent.type(within(sheet).getByLabelText('Code'), '9LEVEL');
    await userEvent.type(within(sheet).getByLabelText('Label'), 'Level');
    expect(within(sheet).getByText('Letters, digits and underscores, starting with a letter.')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add rung' }));
    expect(calls.filter((c) => c.init.method === 'POST')).toEqual([]);
  });

  it('AC-1: adds to the end of the ladder, because a rung is appended not inserted', async () => {
    const { calls } = stubFetch({
      '/admin/org-levels': [{ body: LADDER }, { body: LADDER }],
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    await screen.findByRole('table');
    const sheet = await openAdd();
    expect(within(sheet).getByText('It goes on the end of the ladder, at position 4.')).toBeInTheDocument();
    await userEvent.type(within(sheet).getByLabelText('Code'), 'SAB');
    await userEvent.type(within(sheet).getByLabelText('Label'), 'Senior AB');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add rung' }));

    await waitFor(() => expect(calls.find((c) => c.init.method === 'POST')).toBeDefined());
    const post = calls.find((c) => c.init.method === 'POST');
    expect(JSON.parse(String(post?.init.body))).toEqual({
      companyId: 'co-1', code: 'SAB', label: 'Senior AB', displayOrder: 4, leaderTier: null,
    });
    // The sheet closes on the ladder the write answers.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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

    const sheet = await openAdd();
    await userEvent.type(within(sheet).getByLabelText('Code'), 'AAB');
    await userEvent.type(within(sheet).getByLabelText('Label'), 'AAB');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add rung' }));

    expect(await within(sheet).findByRole('alert')).toHaveTextContent('An archived code is never reused');
    expect(within(sheet).getByLabelText('Code')).toHaveAttribute('aria-invalid', 'true');
    // The sheet stays open on the refusal, with what was typed.
    expect(within(sheet).getByLabelText('Label')).toHaveValue('AAB');
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

  describe('P18.5-T1 the leader tier (ADR-0156)', () => {
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

      // Three choice rows in the sheet since P19.2-T2 AC-4 (UI-134: *choice rows … for 2–5 options*, the leader tier).
      await screen.findByRole('table');
      let sheet = await openAdd();
      const tier = () => within(sheet).getByRole('radiogroup', { name: 'Leader tier' });
      expect(within(tier()).getAllByRole('radio').map((r) => r.textContent))
        .toEqual(['Senior Leader', 'Associate Leader', 'Not a leader']);
      expect(within(tier()).getByRole('radio', { name: 'Not a leader' })).toHaveAttribute('aria-checked', 'true');
      await userEvent.type(within(sheet).getByLabelText('Code'), 'UM');
      await userEvent.type(within(sheet).getByLabelText('Label'), 'Unit Manager');
      await userEvent.click(within(tier()).getByRole('radio', { name: 'Associate Leader' }));
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add rung' }));

      await waitFor(() => expect(calls.find((c) => c.init.method === 'POST')).toBeDefined());
      const post = calls.find((c) => c.init.method === 'POST');
      expect(JSON.parse(String(post?.init.body))).toMatchObject({ code: 'UM', leaderTier: 'associate' });
      // The sheet opens on the default again, so the next rung is not marked a leader by accident.
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      sheet = await openAdd();
      expect(within(tier()).getByRole('radio', { name: 'Not a leader' })).toHaveAttribute('aria-checked', 'true');
    });

    describe('P18.7-T1 AC-5 — the tier says it is saved, beside its select', () => {
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

      it('P18.7-T1 AC-5: says Saved ✓ under the select once the tier is kept, inside its own cell', async () => {
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

      it('P18.7-T1 AC-5: a failed tier says Couldn’t save — retry, and the retry sends the same tier again', async () => {
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

      it('P18.7-T1 AC-5: a tier refused while people stand on the rung (409) leaves no retry, the banner saying why', async () => {
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
   * **ADR-0168 §3 — the Template library's ladder is edited here** (amending P18.6-T3 AC-3, which left it out): it
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
      expect(screen.queryByText('AgencyBoost built-in templates')).not.toBeInTheDocument();
    });

    it('ADR-0185 §1 labels it AgencyBoost built-in templates while it is chosen, the badge describing the select, and shows its ladder', async () => {
      routes();
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      const company = await screen.findByRole('combobox', { name: 'Company' });
      // The companies arrive after the select does: choose the library once it is an option.
      await screen.findByRole('option', { name: 'Template' });
      await userEvent.selectOptions(company, 'co-lib');
      const badge = await screen.findByText('AgencyBoost built-in templates');
      expect(company).toHaveAccessibleDescription('AgencyBoost built-in templates');
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

      const sheet = await openAdd();
      await userEvent.type(within(sheet).getByLabelText('Code'), 'SM');
      await userEvent.type(within(sheet).getByLabelText('Label'), 'Senior Manager');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Add rung' }));
      await waitFor(() => expect(calls.find((c) => c.init.method === 'POST')).toBeDefined());
      const post = calls.find((c) => c.init.method === 'POST');
      expect(JSON.parse(String(post?.init.body))).toMatchObject({ companyId: 'co-lib', code: 'SM', displayOrder: 4 });
    });

    it('is chosen where it is the only company', async () => {
      stubFetch({ '/admin/org-levels': { body: LIBRARY_LADDER }, '/admin/companies': { body: [LIBRARY] } });
      renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

      expect(await screen.findByRole('combobox', { name: 'Company' })).toHaveDisplayValue('Template');
      expect(await screen.findByText('Agent → AAB → Agency Builder')).toBeInTheDocument();
      expect(screen.getByText('AgencyBoost built-in templates')).toBeInTheDocument();
    });
  });
});

describe('P19.2-T2 AC-7 the ladder’s two explanations (UI-136, Appendix A)', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Waits for the ladder as the width draws it: rows below 1024px, the table from it (P19.2-T2 AC-1).
  const show = async (px: number) => {
    atWidth(px);
    stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
    renderWithSession(<OrgLevelsPage />, { me: SUPER_ADMIN });
    await screen.findByRole(px < 1024 ? 'list' : 'table', { name: 'Role ladder, junior first' });
  };

  it('P19.2-T2 AC-7 the reading order: not drawn on a phone', async () => {
    await show(375);
    expect(wears(document.querySelector('[data-explains="reading-order"]')!, 375)).toContain('hidden');
    expect(document.querySelector('[data-explains="reading-order-tip"]')).toBeNull();
  });

  it('P19.2-T2 AC-7 the reading order behind an ⓘ on a tablet, its words unchanged', async () => {
    await show(768);
    expect(wears(document.querySelector('[data-explains="reading-order"]')!, 768)).toContain('hidden');
    const tip = document.querySelector('[data-explains="reading-order-tip"]') as HTMLElement;
    await userEvent.click(within(tip).getByRole('button', { name: 'About Role ladder' }));
    expect(within(tip).getByRole('tooltip')).toHaveTextContent(/^Reading order is junior first: Agent → AAB → AB\. Archiving/);
  });

  // The code's rule is the add sheet's since P19.2-T2 AC-3: read with the sheet open.
  it('P19.2-T2 AC-7 both written out on a laptop', async () => {
    await show(1280);
    expect(wears(document.querySelector('[data-explains="reading-order"]')!, 1280)).not.toContain('hidden');
    const sheet = await openAdd();
    expect(within(sheet).getByLabelText('Code')).toHaveAccessibleDescription(/^Stable and semantic/);
    expect(within(sheet).queryByRole('button', { name: 'About Code' })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-7 at %ipx the code’s rule is behind an ⓘ beside the field', async (px) => {
    await show(px);
    const sheet = await openAdd();
    expect(within(sheet).getByLabelText('Code')).not.toHaveAccessibleDescription(/^Stable and semantic/);
    const glyph = within(sheet).getByRole('button', { name: 'About Code' });
    await userEvent.click(glyph);
    expect(glyph).toHaveAccessibleDescription(/^Stable and semantic — AGENT, AAB, AB\./);
  });
});

/**
 * **P19.2-T2 — the ladder's layout** (UI-126, UI-133, UI-134, UI-135; `admin-mobile` screen 4): below 1024px one 56px
 * row per rung — its order in a circle, its label, its code, its tier a pill, ⋯ — and the company a pill; the table kept
 * from 1024px at the content's width; *Tambah jenjang* a sheet at every size; no native select at 375 or 768; 44px.
 */
describe('P19.2-T2 the org role ladder (UI-126, UI-133, UI-134, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const VERSIONED = LADDER.map((l, i) => ({ ...l, version: i }));
  const ARCHIVED = [...VERSIONED, rung({ orgLevelId: 'lvl-4', code: 'OLD', label: 'Penasihat', displayOrder: 4, status: 'archived', version: 5 })];
  const TWO = [...COMPANIES, { ...COMPANIES[0], _id: 'co-2', name: 'Manulife', slug: 'manulife' }];
  const MANULIFE = [rung({ orgLevelId: 'm-1', companyId: 'co-2', code: 'AGENT', label: 'Agent' }),
    rung({ orgLevelId: 'm-2', companyId: 'co-2', code: 'BP', label: 'BP', displayOrder: 2, leaderTier: 'associate' })];

  const show = (levels: unknown[] = ARCHIVED, extra: Parameters<typeof stubFetch>[0] = {}) => {
    const stub = stubFetch({ ...extra, '/admin/org-levels': { body: levels }, '/admin/companies': { body: TWO } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    return stub;
  };
  const rowOf = (label: string) => screen.getByText(label, { selector: '[data-list-row] span' }).closest('[data-list-row]') as HTMLElement;

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx draws no table: one 56px row per rung — order, label, code, tier pill, ⋯', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Role ladder, junior first' });
    expect(screen.queryByRole('table')).toBeNull();
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(wears(rows[0], px)).toContain('min-h-14');
    expect(rows[1]).toHaveTextContent(/^2AABAAB/);
    expect(within(rows[1]).getByRole('button', { name: 'Leader tier of AAB: Associate Leader' })).toHaveTextContent('Associate Leader');
    expect(within(rows[0]).getByRole('button', { name: 'Leader tier of Agent: Not a leader' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: 'Actions for AAB' })).toHaveTextContent('⋯');
    // An archived rung says so on its line; the rows have no ›: a rung opens nothing.
    expect(rows[3]).toHaveTextContent('OLD · Archived');
    expect(list.querySelectorAll('[data-row-main]')).toHaveLength(0);
    // The company a pill (UI-134), the active ladder beside it as `admin-mobile` screen 4 draws it.
    expect(screen.getByRole('button', { name: 'Company: Prudential' })).toBeInTheDocument();
    expect(document.querySelector('[data-ladder-line]')).toHaveTextContent('Agent → AAB → AB');
  });

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx ⋯ holds Rename and Archive on a live rung, Rename, Restore and Delete on an archived one', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('AAB')).getByRole('button', { name: 'Actions for AAB' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Rename', 'Archive']);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(rowOf('Penasihat')).getByRole('button', { name: 'Actions for Penasihat' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Rename', 'Restore', 'Delete']);
  });

  it('P19.2-T2 AC-1 at 375px Archive from ⋯ sends the version read, and the row says Archived from the answer', async () => {
    atWidth(375);
    const { calls } = show(VERSIONED, {
      'PATCH /admin/org-levels/lvl-2': { body: [VERSIONED[0], { ...VERSIONED[1], status: 'archived', version: 2 }, VERSIONED[2]] },
    });
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('AAB')).getByRole('button', { name: 'Actions for AAB' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    await waitFor(() => expect(rowOf('AAB')).toHaveTextContent('AAB · Archived'));
    const patch = calls.find((c) => c.init.method === 'PATCH');
    expect(JSON.parse(String(patch?.init.body))).toEqual({ status: 'archived', expectedVersion: 1 });
  });

  it('P19.2-T2 AC-1 at 375px Delete from ⋯ asks first, then deletes the archived rung', async () => {
    atWidth(375);
    const { calls } = show(ARCHIVED, { 'DELETE /admin/org-levels/lvl-4': { body: VERSIONED } });
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('Penasihat')).getByRole('button', { name: 'Actions for Penasihat' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const ask = await screen.findByRole('dialog', { name: /^Delete Penasihat\?/ });
    expect(calls.filter((c) => c.init.method === 'DELETE')).toEqual([]);
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Penasihat')).toBeNull());
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toContain('/admin/org-levels/lvl-4?expectedVersion=5');
  });

  it('P19.2-T2 AC-1 at 375px Rename from ⋯ saves the label alone, pinned to its version, and closes', async () => {
    atWidth(375);
    const { calls } = show(VERSIONED, {
      'PATCH /admin/org-levels/lvl-2': { body: [VERSIONED[0], { ...VERSIONED[1], label: 'Associate Agency Builder', version: 2 }, VERSIONED[2]] },
    });
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('AAB')).getByRole('button', { name: 'Actions for AAB' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const sheet = await screen.findByRole('dialog', { name: 'Label of AAB' });
    const field = within(sheet).getByLabelText('Label');
    expect(field).toHaveValue('AAB');
    await userEvent.clear(field);
    await userEvent.type(field, 'Associate Agency Builder');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const patch = calls.find((c) => c.init.method === 'PATCH');
    expect(JSON.parse(String(patch?.init.body))).toEqual({ label: 'Associate Agency Builder', expectedVersion: 1 });
    expect(screen.getByText('Associate Agency Builder')).toBeInTheDocument();
  });

  it('P19.2-T2 AC-1 at 375px Rename sends nothing for a label left as it was, and says Required on an empty one', async () => {
    atWidth(375);
    const { calls } = show(VERSIONED);
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('AAB')).getByRole('button', { name: 'Actions for AAB' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const sheet = await screen.findByRole('dialog', { name: 'Label of AAB' });
    await userEvent.clear(within(sheet).getByLabelText('Label'));
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(within(sheet).getByLabelText('Label')).toHaveAccessibleDescription(expect.stringContaining('Required.'));
    await userEvent.type(within(sheet).getByLabelText('Label'), 'AAB');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.filter((c) => c.init.method === 'PATCH')).toEqual([]);
  });

  it('P19.2-T2 AC-1 AC-4 at 375px the tier pill opens three choice rows; a choice saves at once and says Saved ✓ under it', async () => {
    atWidth(375);
    const { calls } = show(VERSIONED, {
      'PATCH /admin/org-levels/lvl-3': { body: [VERSIONED[0], VERSIONED[1], { ...VERSIONED[2], leaderTier: 'associate', version: 3 }] },
    });
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('AB')).getByRole('button', { name: 'Leader tier of AB: Senior Leader' }));
    const sheet = await screen.findByRole('dialog', { name: 'Choose leader tier of ab' });
    expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Senior Leader', 'Associate Leader', 'Not a leader']);
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Associate Leader' }));
    await waitFor(() => expect(within(rowOf('AB')).getByRole('button', { name: 'Leader tier of AB: Associate Leader' })).toBeInTheDocument());
    expect(await within(rowOf('AB')).findByText('Saved ✓')).toBeInTheDocument();
    const patch = calls.find((c) => c.init.method === 'PATCH');
    expect(JSON.parse(String(patch?.init.body))).toEqual({ leaderTier: 'associate', expectedVersion: 2 });
  });

  it('P19.2-T2 AC-1 at 375px a tier refused while people stand on the rung keeps the stored tier, the banner saying how many', async () => {
    atWidth(375);
    show(VERSIONED, {
      'PATCH /admin/org-levels/lvl-3': {
        status: 409,
        body: { error: { code: 'ORG_LEVEL_TIER_IN_USE', message: 'x', details: { members: 12 }, requestId: 'r' } },
      },
    });
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(within(rowOf('AB')).getByRole('button', { name: 'Leader tier of AB: Senior Leader' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('radio', { name: 'Not a leader' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('12 people stand on AB, so its leader tier cannot change.');
    expect(within(rowOf('AB')).getByRole('button', { name: 'Leader tier of AB: Senior Leader' })).toBeInTheDocument();
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx the company is a pill opening the companies; a choice shows its ladder', async (px) => {
    atWidth(px);
    show([...VERSIONED, ...MANULIFE]);
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(screen.getByRole('button', { name: 'Company: Prudential' }));
    const sheet = await screen.findByRole('dialog', { name: 'Choose company' });
    expect(within(sheet).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Prudential', 'Manulife']);
    await userEvent.click(within(sheet).getByRole('radio', { name: 'Manulife' }));
    expect(await screen.findByRole('button', { name: 'Company: Manulife' })).toBeInTheDocument();
    expect(document.querySelector('[data-ladder-line]')).toHaveTextContent('Agent → BP');
    expect(screen.getByRole('button', { name: 'Leader tier of BP: Associate Leader' })).toBeInTheDocument();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the table at the content’s width, and no add form beside it', async (px) => {
    atWidth(px);
    show();
    const table = await screen.findByRole('table', { name: 'Role ladder, junior first' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Order', 'Rung', 'Leader tier', 'Status', 'Actions']);
    expect(screen.queryByRole('heading', { name: 'Add a rung' })).toBeNull();
    expect(screen.queryByLabelText('Code')).toBeNull();
    expect(table.closest('.lg\\:grid-cols-\\[minmax\\(0\\,1fr\\)_20rem\\]')).toBeNull();
    // A laptop may keep its selects (UI-134): the tier's and the company's.
    expect(within(table).getByRole('combobox', { name: 'Leader tier of AB' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Company' })).toBeInTheDocument();
  });

  it.each([375, 768, 1024, 1280])('P19.2-T2 AC-3 at %ipx shows no form until + is pressed; the sheet’s main button is enabled and says what is missing', async (px) => {
    atWidth(px);
    const { calls } = show();
    await screen.findByRole(px < 1024 ? 'list' : 'table', { name: 'Role ladder, junior first' });
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
    const add = screen.getByRole('button', { name: 'Add rung' });
    expect(add).toHaveAttribute('aria-haspopup', 'dialog');
    if (px < 768) expect(add).toHaveTextContent(/^$/);
    else expect(add).toHaveTextContent('Add rung');
    const sheet = await openAdd();
    expect(sheet.closest('[data-placement]')).toHaveAttribute('data-placement', px < 768 ? 'sheet' : 'center');
    const main = within(sheet).getByRole('button', { name: 'Add rung' });
    expect(main).toBeEnabled();
    await userEvent.click(main);
    expect(within(sheet).getByLabelText('Code')).toHaveAccessibleDescription(expect.stringContaining('Required.'));
    expect(within(sheet).getByLabelText('Label')).toHaveAccessibleDescription(expect.stringContaining('Required.'));
    expect(calls.filter((c) => c.init.method === 'POST')).toEqual([]);
    expect(within(sheet).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it.each(['Escape', 'close', 'cancel'] as const)('P19.2-T2 AC-3 %s closes the sheet without saving', async (how) => {
    const { calls } = show();
    await screen.findByRole('table');
    const sheet = await openAdd();
    await userEvent.type(within(sheet).getByLabelText('Code'), 'SM');
    if (how === 'Escape') await userEvent.keyboard('{Escape}');
    else if (how === 'close') await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    else await userEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.filter((c) => c.init.method === 'POST')).toEqual([]);
    expect(within(await openAdd()).getByLabelText('Code')).toHaveValue('');
  });

  it.each([375, 768])('P19.2-T2 AC-4 at %ipx draws no native select, on the page or in the add sheet', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    expect(document.querySelector('select')).toBeNull();
    await openAdd();
    expect(document.querySelector('select')).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main, in the add sheet or in a tier’s choices', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
    const sheet = await openAdd();
    expect(smallTargets(sheet, px)).toEqual([]);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(within(rowOf('AB')).getByRole('button', { name: 'Leader tier of AB: Senior Leader' }));
    expect(smallTargets(await screen.findByRole('dialog'), px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 AC-3 at %ipx has no axe violations: the ladder, then the add sheet open', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole(px < 1024 ? 'list' : 'table', { name: 'Role ladder, junior first' });
    const clean = async () => expect(
      (await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations,
    ).toEqual([]);
    await clean();
    await openAdd();
    await clean();
  });
});
