import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import AuditPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/audit',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'audit_log:read'],
});

const ENTRY = {
  _id: 'a-1',
  actorUserId: 'u-root', actorName: 'Root Operator',
  effectiveUserId: null, effectiveName: null,
  action: 'kpm.created', targetCollection: 'kpms', targetId: 'kpm-1',
  targetLabel: '0417 · Surabaya Branch',
  createdAt: '2026-09-04T02:00:00.000Z',
  count: 1,
  oldestAt: '2026-09-04T02:00:00.000Z',
};

/** The page the API answers: these groups, a cursor while there is more, and the chips' options on the first. */
const page = (items: unknown[], nextCursor: string | null = null, facets: unknown = { actions: [], actors: [] }) => ({
  body: { items, page: { cursor: null, nextCursor, limit: 50, hasMore: nextCursor !== null }, facets },
});

const TENANTS = { body: [{ _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', status: 'active' }] };
const COMPANIES = {
  body: [
    { _id: 'co-pru', name: 'Prudential', kind: 'insurer' },
    { _id: 'co-lib', name: 'Template bawaan AgencyBoost', kind: 'template' },
  ],
};

function show(audit: Parameters<typeof stubFetch>[0][string]) {
  const stub = stubFetch({ '/admin/audit': audit, '/admin/tenants': TENANTS, '/admin/companies': COMPANIES });
  renderWithSession(<AuditPage />, { me: SUPER_ADMIN });
  return stub;
}

const auditCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/admin/audit')).map((c) => c.url);

/** Open a chip's sheet and choose one of its rows. */
async function choose(chip: RegExp, option: string | RegExp) {
  await userEvent.click(screen.getByRole('button', { name: chip }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: option }));
}

describe('audit log', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to the platform log — where provisioning is actually recorded', async () => {
    // A Super Admin has no tenant, so their own events carry a null kpmId. Defaulting
    // to a tenant scope would show them an empty log that looks correct.
    const { calls } = show(page([ENTRY]));

    await screen.findByRole('table');
    expect(auditCalls(calls)).toHaveLength(1);
    expect(auditCalls(calls)[0]).not.toContain('kpmId=');
  });

  it('names both people for an impersonated action', async () => {
    show(page([{ ...ENTRY, effectiveUserId: 'u-owner', effectiveName: 'Rangga Wibisono' }]));

    const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
    expect(within(row).getByText('Root Operator')).toBeInTheDocument();
    expect(within(row).getByText('as Rangga Wibisono')).toBeInTheDocument();
  });

  describe('naming what a row is about', () => {
    it('names the target and the actor', async () => {
      show(page([ENTRY]));

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
      expect(within(row).getByText('0417 · Surabaya Branch')).toBeInTheDocument();
      expect(within(row).getByText('Root Operator')).toBeInTheDocument();
      expect(within(row).queryByText('kpm-1')).toBeNull();
    });

    it('falls back to the id when nothing names it', async () => {
      // A collection nobody has taught the resolver about is *this is all we know*, not
      // *nothing happened* — so the id stays rather than the cell going blank.
      show(page([{ ...ENTRY, targetCollection: 'goals', targetId: 'g-9', targetLabel: null, actorName: null }]));

      const row = within(await screen.findByRole('table')).getByRole('row', { name: /kpm.created/ });
      expect(within(row).getByText('g-9')).toBeInTheDocument();
      expect(within(row).getByText('u-root')).toBeInTheDocument();
    });
  });

  it('tells an empty tenant scope apart from an empty platform scope', async () => {
    show(page([]));

    expect(await screen.findByText(/Nothing recorded at platform level yet/)).toBeInTheDocument();
    await choose(/^Scope/, /0417/);
    expect(await screen.findByText('Nothing recorded for this office yet.')).toBeInTheDocument();
  });

  it('shows pre-rename rows under the name the product now uses (ADR-0023)', async () => {
    /*
     * The database still says `platform_template.published`, and will for ever — an
     * append-only evidence log is not rewritten so a rename looks tidy. The reader sees
     * one vocabulary all the same.
     */
    show(page([{ ...ENTRY, _id: 'a-old', action: 'platform_template.published', targetCollection: 'platformTemplates' }]));

    expect(await screen.findByText('company_template.published')).toBeInTheDocument();
    expect(screen.getByText('companyTemplates')).toBeInTheDocument();
    expect(screen.queryByText('platform_template.published')).not.toBeInTheDocument();
  });

  /**
   * **P19.4-T3 AC-11 (SA UI-016; SA case 9): names instead of ids, actions in words, a filter by KPM.** The words are the
   * server's, in the reader's language; the page draws them, and falls back to the code only where none was sent.
   */
  describe('P19.4-T3 AC-11 the log in words', () => {
    const SAVES = {
      ...ENTRY, _id: 'g-1', action: 'company_template.draft_saved', actionLabel: 'Draf template disimpan',
      targetCollection: 'companyTemplates', targetKind: 'Bagian template', targetId: 'ct-1',
      targetLabel: 'Prudential template · Aktivitas & rasio', count: 28, createdAt: '2026-11-02T16:14:00.000Z',
    };
    const PRODUCT = {
      ...ENTRY, _id: 'g-2', action: 'product.updated', actionLabel: 'Produk diubah',
      targetCollection: 'products', targetKind: 'Produk', targetId: 'p-1', targetLabel: 'PRUProsper',
      createdAt: '2026-11-02T16:10:00.000Z',
    };

    it('P19.4-T3 AC-11 at 1280px reads “Draf template disimpan ×28” on a section named by its template, never an id', async () => {
      atWidth(1280);
      show(page([SAVES, PRODUCT]));

      const table = await screen.findByRole('table');
      const saves = within(table).getByRole('row', { name: /Draf template disimpan/ });
      expect(within(saves).getByText('Draf template disimpan')).toBeInTheDocument();
      expect(within(saves).getByText('×28')).toBeInTheDocument();
      expect(within(saves).getByText('Bagian template')).toBeInTheDocument();
      expect(within(saves).getByText('Prudential template · Aktivitas & rasio')).toBeInTheDocument();
      const product = within(table).getByRole('row', { name: /Produk diubah/ });
      expect(within(product).getByText('PRUProsper')).toBeInTheDocument();
      // No code and no id where a name was sent.
      expect(within(table).queryByText('company_template.draft_saved')).toBeNull();
      expect(within(table).queryByText('p-1')).toBeNull();
      expect(within(table).queryByText('products')).toBeNull();
    });

    it('P19.4-T3 AC-11 at 375px draws the same words on each day’s lines', async () => {
      atWidth(375);
      show(page([SAVES, PRODUCT]));

      const day = await screen.findByRole('region', { name: 'Audit entries, newest first' });
      const rows = day.querySelectorAll('[data-audit-row]');
      expect(rows[0]).toHaveTextContent('Draf template disimpan');
      expect(rows[0].querySelector('p + p')).toHaveTextContent(
        /^Bagian template\s*Prudential template · Aktivitas & rasio · Root Operator$/,
      );
      expect(rows[1].querySelector('p + p')).toHaveTextContent(/^Produk\s*PRUProsper · Root Operator$/);
    });

    it('P19.4-T3 AC-11 offers Tindakan in words, and Cakupan as KPM 0417 · the branch — the filter by KPM', async () => {
      const { calls } = show(page([PRODUCT], null, {
        actions: ['company_template.draft_saved', 'product.updated'],
        actionLabels: [
          { action: 'company_template.draft_saved', label: 'Draf template disimpan' },
          { action: 'product.updated', label: 'Produk diubah' },
        ],
        actors: [],
      }));
      await screen.findByRole('table');

      await choose(/^Scope/, 'KPM 0417 · BSD City Branch');
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toContain('kpmId=kpm-1'));
      await choose(/^Action/, 'Draf template disimpan');
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toContain('action=company_template.draft_saved'));
    });
  });

  describe('P19.2-T2 AC-6 paged, filtered and grouped on the server (UI-132)', () => {
    it('P19.2-T2 AC-6 draws the server’s count as ×28, and nothing for a group of one', async () => {
      show(page([
        { ...ENTRY, _id: 'g-1', action: 'company_template.draft_saved', count: 28, oldestAt: '2026-09-04T01:52:00.000Z' },
        ENTRY,
      ]));

      const grouped = within(await screen.findByRole('table')).getByRole('row', { name: /draft_saved/ });
      expect(within(grouped).getByText('×28')).toBeInTheDocument();
      expect(within(grouped).getByText('28 times')).toHaveClass('sr-only');
      expect(within(screen.getByRole('row', { name: /kpm.created/ })).queryByText(/×/)).toBeNull();
    });

    it('P19.2-T2 AC-6 loads the next page with the cursor on Muat lagi, below what it has, and stops on the last', async () => {
      const { calls } = show([
        page([ENTRY], 'cur-2'),
        page([{ ...ENTRY, _id: 'a-2', action: 'company.created' }], null, null),
      ]);

      await screen.findByRole('table');
      await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

      await screen.findByRole('row', { name: /company.created/ });
      expect(auditCalls(calls)[1]).toContain('cursor=cur-2');
      expect(screen.getAllByRole('row')).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });

    it('P19.2-T2 AC-6 sends each chip’s choice to the server: Cakupan, Perusahaan, Tindakan, Pelaku', async () => {
      const { calls } = show(page([ENTRY], null, {
        actions: ['company.created', 'kpm.created'],
        actors: [{ userId: 'u-root', name: 'Root Operator' }, { userId: 'u-gone', name: null }],
      }));
      await screen.findByRole('table');

      await choose(/^Scope/, /0417/);
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toContain('kpmId=kpm-1'));
      await choose(/^Company/, 'Prudential');
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toContain('companyId=co-pru'));
      await choose(/^Action/, 'company.created');
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toContain('action=company.created'));
      await choose(/^Actor/, 'Root Operator');
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toContain('actorUserId=u-root'));
    });

    it('P19.2-T2 AC-6 offers the insurers, not the Template library, and an actor whose account is gone by their id', async () => {
      show(page([ENTRY], null, { actions: [], actors: [{ userId: 'u-gone', name: null }] }));
      await screen.findByRole('table');

      await userEvent.click(screen.getByRole('button', { name: /^Company/ }));
      expect(within(screen.getByRole('dialog')).queryByRole('radio', { name: /Template bawaan/ })).toBeNull();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', { name: /^Actor/ }));
      expect(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Unknown account (u-gone)' })).toBeInTheDocument();
    });

    it('P19.2-T2 AC-6 Tanggal sends two office days, and Any date lifts them', async () => {
      const { calls } = show(page([ENTRY]));
      await screen.findByRole('table');

      await userEvent.click(screen.getByRole('button', { name: /^Date/ }));
      const sheet = screen.getByRole('dialog');
      await userEvent.type(within(sheet).getByLabelText('From'), '2026-11-01');
      await userEvent.type(within(sheet).getByLabelText('To'), '2026-11-02');
      await userEvent.click(within(sheet).getByRole('button', { name: 'Apply' }));
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).toMatch(/from=2026-11-01&to=2026-11-02/));

      await userEvent.click(screen.getByRole('button', { name: /^Date/ }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Any date' }));
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).not.toContain('from='));
    });

    it('P19.2-T2 AC-6 an empty filtered read says so, and Clear filters goes back to the whole scope', async () => {
      const { calls } = show([page([ENTRY], null, { actions: ['kpm.created'], actors: [] }), page([], null, null), page([ENTRY])]);
      await screen.findByRole('table');

      await choose(/^Action/, 'kpm.created');
      expect(await screen.findByText('Nothing recorded matches these filters.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      await vi.waitFor(() => expect(auditCalls(calls).at(-1)).not.toContain('action='));
    });

    it('P19.2-T2 AC-6 a laptop’s table keeps its header in view while the page scrolls', async () => {
      atWidth(1280);
      show(page([ENTRY]));

      const headers = within(await screen.findByRole('table')).getAllByRole('columnheader');
      expect(headers.map((h) => h.textContent)).toEqual(['When', 'Action', 'Target', 'Actor']);
      for (const th of headers) expect(th).toHaveClass('sticky', 'top-0');
    });

    it.each([375, 768])('P19.2-T2 AC-1 AC-6 at %ipx draws no table: the lines by office day — time, action, target · actor', async (px) => {
      atWidth(px);
      show(page([
        // 23.14 and 23.10 on 2 Nov in Jakarta; 23.08 on 1 Nov.
        { ...ENTRY, _id: 'g-1', action: 'product.updated', createdAt: '2026-11-02T16:14:00.000Z' },
        { ...ENTRY, _id: 'g-2', action: 'company_template.draft_saved', count: 28, createdAt: '2026-11-02T16:10:00.000Z' },
        { ...ENTRY, _id: 'g-3', action: 'company.created', createdAt: '2026-11-01T16:08:00.000Z' },
      ]));

      const day = await screen.findByRole('region', { name: 'Audit entries, newest first' });
      expect(screen.queryByRole('table')).toBeNull();
      expect(within(day).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['2 Nov 2026', '1 Nov 2026']);
      const rows = day.querySelectorAll('[data-audit-row]');
      expect(rows).toHaveLength(3);
      const first = within(rows[0] as HTMLElement);
      expect(first.getByText('23:14')).toBeInTheDocument();
      expect(first.getByText('product.updated')).toBeInTheDocument();
      expect(rows[0].querySelector('p + p')).toHaveTextContent(/^kpms\s*0417 · Surabaya Branch · Root Operator$/);
      expect(within(rows[1] as HTMLElement).getByText('×28')).toBeInTheDocument();
    });

    it.each([375, 768, 1024, 1280])('P19.2-T2 AC-4 AC-7 at %ipx no native select and no grey sub-line', async (px) => {
      atWidth(px);
      show(page([ENTRY]));
      await screen.findByText('kpm.created');

      expect(document.querySelector('select')).toBeNull();
      expect(screen.queryByText(/Append-only\./)).toBeNull();
    });

    it.each([375, 768])('P19.2-T2 AC-5 at %ipx every chip and Muat lagi are 44px targets', async (px) => {
      atWidth(px);
      show(page([ENTRY], 'cur-2'));
      await screen.findByRole('region', { name: 'Audit entries, newest first' });

      for (const chip of within(screen.getByRole('group', { name: 'Filter the log' })).getAllByRole('button')) {
        expect(chip).toHaveClass('min-h-11');
      }
      expect(screen.getByRole('button', { name: 'Load more' })).toHaveClass('h-12');
    });
  });
});
