import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import RetiredKpmRequestsAddress from '../kpm-requests/page';
import RetiredLeaderLimitAddress from '../leader-limit-requests/page';
import ApprovalsPage from './page';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin/approvals',
  useSearchParams: () => new URLSearchParams(),
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm_request:read', 'kpm_request:decide', 'leader_limit_request:read', 'leader_limit_request:decide'],
});

const kpm = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', branchName: 'Surabaya Barat Branch', companyId: 'co-1', companyName: 'Prudential',
  requestedByName: 'Rizal Pratama', requestedByEmail: 'rizal@example.test', requestedByPhone: '+62 812 1', note: null,
  status: 'pending', requestedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), decidedAt: null, decidedByName: null,
  reason: null, createdKpmId: null, requesterCompanyId: 'co-1', requesterCompanyName: 'Prudential', requesterEmailVerified: true,
  createdKpm: null, ...over,
});
const limit = (over: Record<string, unknown> = {}) => ({
  requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch', companyName: 'Prudential',
  subjectMembershipId: 'mem-1', subjectName: 'Rizky Ramadhan', subjectAgentCode: '86114', action: 'promote',
  fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: null, requestedByMembershipId: 'mem-owner',
  requestedByName: 'Hendra Gunawan', status: 'pending', requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null,
  decidedByName: null, declineReason: null, maxLeaders: 10, leadersUsed: 11, ...over,
});
const QUEUES = {
  '/admin/kpm-requests': {
    body: [kpm(), kpm({
      requestId: 'req-9', branchName: 'Bekasi Barat Branch', status: 'approved', requestedByName: 'Yohanes Saputra',
      decidedAt: '2026-10-12T03:00:00.000Z', decidedByName: 'Dina Kusuma',
    })],
  },
  '/admin/leader-limit-requests': {
    body: [limit(), limit({
      requestId: 'llr-9', subjectName: 'Arief Hidayat', kpmBranchName: 'BSD City Branch', status: 'declined',
      decidedAt: '2026-10-03T03:00:00.000Z', decidedByName: 'Platform Operator', declineReason: 'Naikkan paket dulu.',
    })],
  },
  '/companies': { body: [{ _id: 'co-1', name: 'Prudential' }, { _id: 'co-2', name: 'Allianz Life' }] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockClear();
});

const show = (routes: Record<string, unknown> = {}) => {
  const stub = stubFetch({ ...QUEUES, ...routes } as never);
  renderInLayout(AdminLayout, <ApprovalsPage />, { me: SUPER_ADMIN });
  return stub;
};

describe('P19.23-T3 AC-2 — Persetujuan (/admin/approvals)', () => {
  it('P19.23-T3 AC-2 Menunggu: both kinds, the KPM by name and company, who asked and when, Tolak · Setujui', async () => {
    atWidth(1280);
    show();
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    expect(screen.getByRole('tab', { name: 'Waiting 2' })).toHaveAttribute('aria-selected', 'true');
    expect(within(list).getByText('New KPM · Surabaya Barat Branch')).toBeInTheDocument();
    expect(within(list).getByText(/RIZAL PRATAMA/)).toHaveTextContent('Prudential · asked by RIZAL PRATAMA (proposed Owner) · 2 days ago');
    expect(within(list).getByText('Leader past the limit · Tangerang Branch (Prudential)')).toBeInTheDocument();
    expect(within(list).getByText(/RIZKY RAMADHAN/)).toHaveTextContent(
      'RIZKY RAMADHAN Agent → AAB · plan 10 leader, now 11 · asked by HENDRA GUNAWAN',
    );
    expect(within(list).getAllByRole('button', { name: 'Approve' })).toHaveLength(2);
    expect(within(list).getAllByRole('button', { name: 'Decline' })).toHaveLength(2);
    expect(screen.getByText('Everything that needs a Super Admin\'s approval is here')).toBeInTheDocument();
  });

  it('P19.23-T3 AC-2 Sudah diputuskan: the result, the day and who decided, and a decline’s reason', async () => {
    atWidth(1280);
    show();
    await screen.findByRole('list', { name: 'Requests waiting' });
    await userEvent.click(screen.getByRole('tab', { name: 'Already decided' }));
    const list = await screen.findByRole('list', { name: 'Decided requests' });
    expect(within(list).getByText('Approved')).toBeInTheDocument();
    expect(within(list).getByText('Declined')).toBeInTheDocument();
    expect(within(list).getByText(/DINA KUSUMA/)).toHaveTextContent('Prudential · asked by YOHANES SAPUTRA · 12 Oct · DINA KUSUMA');
    expect(within(list).getByText(/PLATFORM OPERATOR/)).toHaveTextContent(
      'ARIEF HIDAYAT Agent → AAB · plan 10 leader · 3 Oct · PLATFORM OPERATOR',
    );
    expect(within(list).getByText('Naikkan paket dulu.')).toBeInTheDocument();
    expect(screen.getByText('Who decided and when · recorded in the audit log')).toBeInTheDocument();
  });

  it('P19.23-T3 AC-2 Setujui on a KPM registration is one press: no code, the server makes it; both queues read again', async () => {
    atWidth(1280);
    const { calls } = show({ 'POST /admin/kpm-requests/req-1/approve': { body: [] } });
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    const changed = vi.fn();
    window.addEventListener('agencyboost:approvals-changed', changed);
    await userEvent.click(within(list).getAllByRole('button', { name: 'Approve' })[0]);
    const sent = calls.find((c) => c.url.endsWith('/admin/kpm-requests/req-1/approve'));
    expect(sent?.init.method).toBe('POST');
    expect(JSON.parse(String(sent?.init.body))).toEqual({});
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(await screen.findByText('Approved.')).toBeInTheDocument();
    window.removeEventListener('agencyboost:approvals-changed', changed);
  });

  it('P19.23-T3 AC-2 Setujui on a leader past the limit is one press', async () => {
    atWidth(1280);
    const { calls } = show({ 'POST /admin/leader-limit-requests/llr-1/approve': { body: [] } });
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    await userEvent.click(within(list).getAllByRole('button', { name: 'Approve' })[1]);
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/leader-limit-requests/llr-1/approve'))).toBe(true));
  });

  it('P19.23-T3 AC-2 an applicant of another company: Setujui opens Atur & setujui, which names why and lets the company be chosen', async () => {
    atWidth(1280);
    const { calls } = show({
      '/admin/kpm-requests': { body: [kpm({ requesterCompanyId: 'co-2', requesterCompanyName: 'Allianz Life' })] },
      '/admin/leader-limit-requests': { body: [] },
      'POST /admin/kpm-requests/req-1/approve': { body: [] },
      '/admin/tenants/code-availability': { body: { available: true, takenBy: null } },
      '/admin/companies/': { body: [] },
      '/admin/template-library': { body: [] },
    });
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    await userEvent.click(within(list).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve Surabaya Barat Branch' });
    expect(within(dialog).getByText(/Rizal Pratama signed up with Allianz Life/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Approve & make Owner' })).toBeDisabled();
    expect(calls.some((c) => c.url.includes('/approve'))).toBe(false);
  });

  it('P19.23-T3 AC-2 ⋯ keeps Atur & setujui: a typed code is sent, and a malformed one is refused before', async () => {
    atWidth(1280);
    const { calls } = show({
      '/admin/leader-limit-requests': { body: [] },
      'POST /admin/kpm-requests/req-1/approve': { body: [] },
      '/admin/tenants/code-availability': { body: { available: true, takenBy: null } },
    });
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    await userEvent.click(within(list).getByRole('button', { name: /Surabaya Barat Branch/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Set up & approve' }));
    const dialog = await screen.findByRole('dialog', { name: 'Approve Surabaya Barat Branch' });
    const code = within(dialog).getByLabelText('KPM code (optional)');
    await userEvent.type(code, '12');
    expect(within(dialog).getByText('Four digits, or leave it empty.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Approve & make Owner' })).toBeDisabled();
    await userEvent.type(code, '34');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve & make Owner' }));
    const sent = calls.find((c) => c.url.endsWith('/admin/kpm-requests/req-1/approve'));
    expect(JSON.parse(String(sent?.init.body))).toMatchObject({ code: '1234' });
  });

  it('P19.23-T3 AC-2 Tolak: optional for a KPM registration, required for a leader past the limit', async () => {
    atWidth(1280);
    const { calls } = show({
      'POST /admin/kpm-requests/req-1/decline': { body: [] },
      'POST /admin/leader-limit-requests/llr-1/decline': { body: [] },
    });
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    await userEvent.click(within(list).getAllByRole('button', { name: 'Decline' })[0]);
    let dialog = await screen.findByRole('dialog', { name: 'Decline' });
    expect(within(dialog).getByLabelText('Reason (optional)')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/req-1/decline'))).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith('/req-1/decline'))?.init.body))).toEqual({});

    await userEvent.click(within(await screen.findByRole('list', { name: 'Requests waiting' })).getAllByRole('button', { name: 'Decline' })[1]);
    dialog = await screen.findByRole('dialog', { name: 'Decline' });
    expect(within(dialog).getByRole('button', { name: 'Decline' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Naikkan paket dulu.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/llr-1/decline'))).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url.endsWith('/llr-1/decline'))?.init.body))).toEqual({ reason: 'Naikkan paket dulu.' });
  });

  it('P19.23-T3 AC-2 a refused decision says why above the list, and the queues are read again', async () => {
    atWidth(1280);
    const { calls } = show({
      'POST /admin/leader-limit-requests/llr-1/approve': {
        status: 409, body: { error: { code: 'LEADER_LIMIT_REQUEST_STALE', message: 'The member has since moved rung.' } },
      },
    });
    const list = await screen.findByRole('list', { name: 'Requests waiting' });
    const reads = calls.filter((c) => c.url.endsWith('/admin/leader-limit-requests')).length;
    await userEvent.click(within(list).getAllByRole('button', { name: 'Approve' })[1]);
    expect(await screen.findByText('The member has since moved rung.')).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/admin/leader-limit-requests')).length).toBeGreaterThan(reads));
  });

  it('P19.23-T3 AC-2 each tab’s empty line, and a failed read with Try again', async () => {
    atWidth(1280);
    show({ '/admin/kpm-requests': { body: [] }, '/admin/leader-limit-requests': { body: [] } });
    expect(await screen.findByText('Nothing is waiting for approval.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Already decided' }));
    expect(await screen.findByText('Nothing has been decided yet.')).toBeInTheDocument();
    vi.unstubAllGlobals();

    stubFetch({
      '/admin/kpm-requests': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
        QUEUES['/admin/kpm-requests'],
      ],
      '/admin/leader-limit-requests': QUEUES['/admin/leader-limit-requests'],
      '/companies': QUEUES['/companies'],
    });
    renderInLayout(AdminLayout, <ApprovalsPage />, { me: SUPER_ADMIN });
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('New KPM · Surabaya Barat Branch')).toBeInTheDocument();
  });

  it('P19.23-T3 T7 at 390px: equal tabs, rows stacked, every target 44px, no axe violations', async () => {
    atWidth(390);
    show();
    await screen.findByRole('list', { name: 'Requests waiting' });
    expect(smallTargets(document.querySelector('main')!, 390)).toEqual([]);
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('P19.23-T3 AC-2 the two old addresses redirect here, replacing', () => {
    stubFetch({ '/admin/kpm-requests': { body: [] }, '/admin/leader-limit-requests': { body: [] } });
    renderInLayout(AdminLayout, <RetiredKpmRequestsAddress />, { me: SUPER_ADMIN });
    renderInLayout(AdminLayout, <RetiredLeaderLimitAddress />, { me: SUPER_ADMIN });
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenNthCalledWith(1, '/admin/approvals');
    expect(replace).toHaveBeenNthCalledWith(2, '/admin/approvals');
  });
});
