import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import PlatformAuditPage from './page';

const address = vi.hoisted(() => ({ search: '' }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/platform/audit',
  useSearchParams: () => new URLSearchParams(address.search),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'audit_log:read'],
});

/** A Super Admin's change inside a KPM, as the server answers it (frame f52's first line). */
const TARGET = {
  _id: 'a-1',
  actorUserId: 'u-root', actorName: 'Super Admin',
  effectiveUserId: null, effectiveName: null,
  action: 'ab_group_target.set', actionLabel: 'Mengubah target Active Agent', targetCollection: 'groups',
  targetKind: 'Grup', targetId: 'g-1', targetLabel: 'Group AGUS PRASETYO', change: '6 → 8',
  kpm: { id: 'kpm-1', code: '0417', branch: 'BSD City Branch' }, company: { id: 'co-pru', name: 'Prudential' },
  createdAt: '2026-11-19T16:33:00.000Z', count: 1, oldestAt: '2026-11-19T16:33:00.000Z',
};
const PUBLISHED = {
  ...TARGET, _id: 'a-2', action: 'company_template.published_to_kpms', actionLabel: 'Menerbitkan Activity types ke 5 KPM',
  targetLabel: null, targetId: null, change: null, kpm: null, createdAt: '2026-11-19T15:10:00.000Z', count: 3,
};

const page = (items: unknown[], nextCursor: string | null = null) => ({
  body: {
    items, page: { cursor: null, nextCursor, limit: 50, hasMore: nextCursor !== null },
    facets: {
      actions: ['ab_group_target.set'], actionLabels: [{ action: 'ab_group_target.set', label: 'Target grup diatur' }],
      actors: [{ userId: 'u-root', name: 'Super Admin' }],
    },
  },
});
const TENANTS = { body: [{ _id: 'kpm-1', code: '0417', branchName: 'BSD City Branch', companyName: 'Prudential', status: 'active' }] };
const COMPANIES = { body: [{ _id: 'co-pru', name: 'Prudential', kind: 'insurer' }] };

function show(audit: Parameters<typeof stubFetch>[0][string]) {
  const stub = stubFetch({ '/admin/audit': audit, '/admin/tenants': TENANTS, '/admin/companies': COMPANIES });
  renderWithSession(<PlatformAuditPage />, { me: SUPER_ADMIN });
  return stub;
}

const auditCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/admin/audit')).map((c) => c.url);

describe('Platform › Audit log (P19.23-T6 AC-1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    address.search = '';
  });

  it('P19.23-T6 AC-1 each line: when, what before → after, who · KPM · company', async () => {
    show(page([TARGET, PUBLISHED]));

    const list = await screen.findByRole('list', { name: 'Audit entries, newest first' });
    const [first, second] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent('Mengubah target Active Agent · Group AGUS PRASETYO · 6 → 8');
    expect(first).toHaveTextContent('Super Admin · BSD City Branch · Prudential');
    expect(first.querySelector('time')).toHaveAttribute('dateTime', TARGET.createdAt);
    // A platform row about no KPM names its company alone; a group of three carries its count.
    expect(second).toHaveTextContent('Menerbitkan Activity types ke 5 KPM×3');
    expect(second).toHaveTextContent('Super Admin · Prudential');
    expect(screen.getByText('Every Super Admin change: who, when, before → after')).toBeInTheDocument();
  });

  it('P19.23-T6 AC-1 reads Semua KPM by default — no scope sent', async () => {
    const { calls } = show(page([TARGET]));
    await screen.findByRole('list', { name: 'Audit entries, newest first' });
    expect(auditCalls(calls)[0]).not.toContain('kpmId=');
  });

  it('P19.23-T6 AC-1 Cari perubahan asks the server once the typing settles', async () => {
    const { calls } = show(page([TARGET]));
    await screen.findByRole('list', { name: 'Audit entries, newest first' });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search changes' }), 'agus');
    await vi.waitFor(() => expect(auditCalls(calls).some((u) => u.includes('q=agus'))).toBe(true), { timeout: 2000 });
    expect(auditCalls(calls).filter((u) => u.includes('q=')).length).toBe(1);
  });

  it('P19.23-T6 AC-1 Semua perusahaan, Semua KPM and Semua tindakan narrow it, each by its own parameter', async () => {
    const { calls } = show(page([TARGET]));
    await screen.findByRole('list', { name: 'Audit entries, newest first' });

    await userEvent.click(screen.getByRole('button', { name: 'Company: All companies' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Prudential' }));
    await userEvent.click(screen.getByRole('button', { name: 'KPM: Every KPM' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'KPM 0417 · BSD City Branch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Action: All actions' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Target grup diatur' }));

    const last = auditCalls(calls).at(-1)!;
    expect(last).toContain('companyId=co-pru');
    expect(last).toContain('kpmId=kpm-1');
    expect(last).toContain('action=ab_group_target.set');
    // One KPM: its whole log, and the note says so.
    expect(await screen.findByText('Every change in this KPM: who, when, before → after')).toBeInTheDocument();
  });

  it('P19.15-T4 AC-2 opens narrowed to what the address names, and drops what is not one', async () => {
    address.search = 'kpmId=66f0000000000000000000a1&action=rate_table.activated&companyId=nope&q=tarif';
    const { calls } = show(page([TARGET]));
    await screen.findByRole('list', { name: 'Audit entries, newest first' });
    const [first] = auditCalls(calls);
    expect(first).toContain('kpmId=66f0000000000000000000a1');
    expect(first).toContain('action=rate_table.activated');
    expect(first).toContain('q=tarif');
    expect(first).not.toContain('companyId=');
  });

  it('P19.2-T2 AC-6 Muat lagi asks for the next page with the cursor the read returned', async () => {
    const { calls } = show([page([TARGET], 'c-2'), page([PUBLISHED])]);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText(/Menerbitkan Activity types/)).toBeInTheDocument();
    expect(auditCalls(calls).at(-1)).toContain('cursor=c-2');
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('every state: nothing yet, nothing that matches, and the server’s refusal', async () => {
    show(page([]));
    expect(await screen.findByText('Nothing recorded yet.')).toBeInTheDocument();
    vi.unstubAllGlobals();

    address.search = 'action=kpm.created';
    show(page([]));
    expect(await screen.findByText('Nothing recorded matches these filters.')).toBeInTheDocument();
    vi.unstubAllGlobals();

    show({ status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'q must be at most 100 characters', requestId: 'r-1' } } });
    expect(await screen.findByText(/q must be at most 100 characters/)).toBeInTheDocument();
  });

  it('refuses a reader without audit_log:read', async () => {
    stubFetch({ '/admin/audit': page([]), '/admin/tenants': TENANTS, '/admin/companies': COMPANIES });
    await act(async () => {
      renderWithSession(<PlatformAuditPage />, { me: { ...SUPER_ADMIN, permissions: ['kpm:list_all'] } });
    });
    expect(screen.queryByRole('list', { name: 'Audit entries, newest first' })).toBeNull();
  });
});
