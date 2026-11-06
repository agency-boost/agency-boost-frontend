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
  permissions: ['kpm:list_all', 'org_level:read', 'org_level:crud', 'company:crud'],
});

const COMPANIES = [
  { _id: 'co-1', name: 'Manulife', slug: 'manulife', defaultCurrency: 'IDR', defaultTimezone: 'Asia/Jakarta', status: 'active' },
];

const rung = (over: Record<string, unknown> = {}) => ({
  orgLevelId: 'lvl-1', companyId: 'co-1', code: 'AGENT', label: 'Agent',
  displayOrder: 1, leaderTier: null, status: 'active', archivedAt: null, version: 0, ...over,
});

const AAB = rung({ orgLevelId: 'lvl-2', code: 'AAB', label: 'AAB', displayOrder: 2, leaderTier: 'associate', version: 3 });
const LADDER = [rung(), AAB];

const STALE = {
  status: 409,
  body: {
    error: {
      code: 'VERSION_CONFLICT',
      message: 'This record changed since you loaded it. Reload and try again.',
      details: { expectedVersion: 3, actualVersion: 4 },
      requestId: 'r-409',
    },
  },
};

const patched = (calls: { url: string; init: RequestInit }[]) =>
  JSON.parse(String(calls.find((c) => c.init.method === 'PATCH')!.init.body));

/**
 * **A rung changed by somebody else is not overwritten** (P19-T6 AC-2; the 11-03 handover's B1-10): every change sends
 * the rung's version as read; a `409 VERSION_CONFLICT` reads the ladder again and says so in this screen's words.
 */
describe('P19-T6 the org role ladder’s stale saves', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19-T6 AC-2 sends the version the rung was read at with an archive', async () => {
    const { calls } = stubFetch({
      'PATCH /admin/org-levels/lvl-2': { body: [LADDER[0], { ...AAB, status: 'archived', version: 4 }] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /AAB/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(patched(calls)).toEqual({ status: 'archived', expectedVersion: 3 });
  });

  it('P19-T6 AC-2 sends the version the rung was read at with a leader tier', async () => {
    const { calls } = stubFetch({
      'PATCH /admin/org-levels/lvl-2': { body: [LADDER[0], { ...AAB, leaderTier: 'senior', version: 4 }] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Leader tier of AAB' }), 'senior');
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(patched(calls)).toEqual({ leaderTier: 'senior', expectedVersion: 3 });
  });

  it('P19-T6 AC-2 reads the ladder again when somebody changed the rung first, and says so', async () => {
    const theirs = [LADDER[0], { ...AAB, status: 'archived', version: 4 }];
    const { calls } = stubFetch({
      'PATCH /admin/org-levels/lvl-2': STALE,
      '/admin/org-levels': [{ body: LADDER }, { body: theirs }],
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Leader tier of AAB' }), 'senior');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Someone else changed AAB after you opened this page, so your change was not saved. The ladder now shows what is '
        + 'stored; check it and try again.',
    );
    // The table shows what is stored: their archive, and the tier as it was.
    const row = within(screen.getByRole('table')).getByRole('row', { name: /AAB/ });
    await waitFor(() => expect(row).toHaveTextContent('Archived'));
    expect(within(row).getByRole('combobox', { name: 'Leader tier of AAB' })).toHaveValue('associate');
    expect(calls.filter((c) => c.url.includes('/admin/org-levels') && (c.init.method ?? 'GET') === 'GET')).toHaveLength(2);
  });

  it('P19-T6 AC-2 does the same for an archive', async () => {
    stubFetch({
      'PATCH /admin/org-levels/lvl-2': STALE,
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /AAB/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Archive' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed AAB after you opened this page');
  });
});
