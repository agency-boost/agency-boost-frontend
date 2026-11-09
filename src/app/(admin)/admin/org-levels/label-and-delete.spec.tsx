import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
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
/** Manulife's ladder as the owner left it (the 11-03 handover, Part A): Agent → BP → SBP, AAB archived. */
const AGENT = rung();
const BP = rung({ orgLevelId: 'lvl-bp', code: 'BP', label: 'BP', displayOrder: 2 });
const AAB = rung({ orgLevelId: 'lvl-aab', code: 'AAB', label: 'AAB', displayOrder: 3, status: 'archived', version: 2 });
const LADDER = [AGENT, BP, AAB];

const label = (code: string) => screen.getByRole('textbox', { name: `Label of ${code}` }) as HTMLInputElement;
const rowOf = (code: string) => label(code).closest('tr') as HTMLElement;
const sent = (calls: { url: string; init: RequestInit }[], method: string) => calls.filter((c) => c.init.method === method);

/**
 * **`/admin/org-levels`: a rung's label edited where it is read, an archived rung deleted, and the table answered after
 * every write** (P19.4-T5 AC-1, AC-2, AC-3; ADR-0213 §1, §2; the 11-03 handover's B1-6).
 */
describe('P19.4-T5 the org role ladder: the label, the delete, the table', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.4-T5 AC-1 saves an edited label as its field is left — never the code — and says Saved ✓ beside it', async () => {
    const { calls } = stubFetch({
      'PATCH /admin/org-levels/lvl-bp': { body: [AGENT, { ...BP, label: 'Business Partner', version: 1 }, AAB] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    const field = await screen.findByRole('textbox', { name: 'Label of BP' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Business Partner{Enter}');

    await waitFor(() => expect(sent(calls, 'PATCH')).toHaveLength(1));
    expect(JSON.parse(String(sent(calls, 'PATCH')[0].init.body))).toEqual({ label: 'Business Partner', expectedVersion: 0 });
    expect(await within(rowOf('BP')).findByText('Saved ✓')).toBeInTheDocument();
    expect(label('BP').value).toBe('Business Partner');
  });

  it('P19.4-T5 AC-1 sends nothing for a label left as it was, or emptied — the stored one comes back', async () => {
    const { calls } = stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    const field = await screen.findByRole('textbox', { name: 'Label of BP' });
    await userEvent.click(field);
    await userEvent.tab();
    await userEvent.clear(field);
    await userEvent.tab();
    expect(sent(calls, 'PATCH')).toEqual([]);
    expect(label('BP').value).toBe('BP');
  });

  it('P19.4-T5 AC-3 after Arsipkan the table shows the rung archived at once, from the answer, with no second read', async () => {
    const { calls } = stubFetch({
      'PATCH /admin/org-levels/lvl-bp': { body: [AGENT, { ...BP, status: 'archived', version: 1 }, AAB] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('textbox', { name: 'Label of BP' });
    const reads = calls.filter((c) => (c.init.method ?? 'GET') === 'GET' && c.url.includes('/admin/org-levels')).length;
    await userEvent.click(within(rowOf('BP')).getByRole('button', { name: 'Archive' }));

    expect(await within(rowOf('BP')).findByText('Archived')).toBeInTheDocument();
    expect(within(rowOf('BP')).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(within(rowOf('BP')).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(calls.filter((c) => (c.init.method ?? 'GET') === 'GET' && c.url.includes('/admin/org-levels')).length).toBe(reads);
  });

  it('P19.4-T5 AC-2 offers Delete on an archived rung only, asks first, and drops it from the table', async () => {
    const { calls } = stubFetch({
      'DELETE /admin/org-levels/lvl-aab': { body: [AGENT, BP] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('textbox', { name: 'Label of AAB' });
    expect(within(rowOf('BP')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

    await userEvent.click(within(rowOf('AAB')).getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Delete AAB? Only an archived rung that nothing in this company names can be deleted');
    expect(sent(calls, 'DELETE')).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Label of AAB' })).not.toBeInTheDocument());
    expect(sent(calls, 'DELETE')[0].url).toContain('/admin/org-levels/lvl-aab?expectedVersion=2');
  });

  it('P19.4-T5 AC-2 a rung something names: the server’s reason in the banner, the row kept', async () => {
    stubFetch({
      'DELETE /admin/org-levels/lvl-aab': {
        status: 409,
        body: {
          error: {
            code: 'ORG_LEVEL_IN_USE',
            message: 'AAB cannot be deleted: 2 membership(s) still name it. It stays archived, so what stands on it keeps its meaning.',
            details: { references: [{ kind: 'memberships', count: 2 }] },
            requestId: 'r-1',
          },
        },
      },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('textbox', { name: 'Label of AAB' });
    await userEvent.click(within(rowOf('AAB')).getByRole('button', { name: 'Delete' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/AAB cannot be deleted: 2 membership\(s\) still name it/)).toBeInTheDocument();
    expect(label('AAB')).toBeInTheDocument();
  });

  it('P19.4-T5 AC-1, AC-2 the label field and Delete at 1280px, in Indonesian', async () => {
    atWidth(1280);
    stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
    renderInIndonesian(<OrgLevelsPage />, { me: SUPER_ADMIN });
    const field = await screen.findByRole('textbox', { name: 'Label AAB' });
    expect(field).toHaveValue('AAB');
    const row = field.closest('tr') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Hapus' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Pulihkan' })).toBeInTheDocument();
  });

  // Moved 2026-11-06 (P19.2-T2 AC-1; UI-126, UI-135): below 1024px a rung is a row, its label changed from *Ganti nama*
  // in its ⋯ and *Pulihkan* and *Hapus* there beside it, where the row held the field and the two buttons.
  it('P19.4-T5 AC-1, AC-2 the label field and Delete at 375px, in the rung’s ⋯, in Indonesian', async () => {
    atWidth(375);
    stubFetch({ '/admin/org-levels': { body: LADDER }, '/admin/companies': { body: COMPANIES } });
    renderInIndonesian(<OrgLevelsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('list', { name: 'Susunan jenjang, dari yang paling junior' });
    await userEvent.click(screen.getByRole('button', { name: 'Tindakan untuk AAB' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Ganti nama', 'Pulihkan', 'Hapus']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Ganti nama' }));
    const sheet = await screen.findByRole('dialog', { name: 'Label AAB' });
    expect(within(sheet).getByRole('textbox', { name: 'Label' })).toHaveValue('AAB');
    expect(within(sheet).getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  });

  it('P19.4-T5 AC-1 at 375px a label saved from the rung’s sheet is the label alone — never the code — at the version read', async () => {
    atWidth(375);
    const { calls } = stubFetch({
      'PATCH /admin/org-levels/lvl-bp': { body: [AGENT, { ...BP, label: 'Business Partner', version: 1 }, AAB] },
      '/admin/org-levels': { body: LADDER },
      '/admin/companies': { body: COMPANIES },
    });
    renderInLayout(AdminLayout, <OrgLevelsPage />, { me: SUPER_ADMIN });
    await screen.findByRole('list', { name: 'Role ladder, junior first' });
    await userEvent.click(screen.getByRole('button', { name: 'Actions for BP' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const sheet = await screen.findByRole('dialog', { name: 'Label of BP' });
    await userEvent.clear(within(sheet).getByLabelText('Label'));
    await userEvent.type(within(sheet).getByLabelText('Label'), 'Business Partner');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sent(calls, 'PATCH')).toHaveLength(1));
    expect(JSON.parse(String(sent(calls, 'PATCH')[0].init.body))).toEqual({ label: 'Business Partner', expectedVersion: 0 });
    expect(await screen.findByText('Business Partner')).toBeInTheDocument();
  });
});
