import { screen, within } from '@testing-library/react';
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
  displayOrder: 1, status: 'active', archivedAt: null, ...over,
});

const LADDER = [
  rung(),
  rung({ orgLevelId: 'lvl-2', code: 'AAB', label: 'AAB', displayOrder: 2 }),
  rung({ orgLevelId: 'lvl-3', code: 'AB', label: 'AB', displayOrder: 3 }),
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
      companyId: 'co-1', code: 'SAB', label: 'Senior AB', displayOrder: 4,
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
    expect(screen.getByRole('alert')).toHaveTextContent('org_level:crud');
  });

  it('tells a company with no ladder what to do first', async () => {
    stubFetch({ '/admin/org-levels': { body: [] }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    expect(
      await screen.findByText('Prudential has no ladder yet. Add the most junior rung first.'),
    ).toBeInTheDocument();
  });
});
