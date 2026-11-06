import { screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { atWidth, makeMe, renderInLayout, stubFetch, wears } from '@test/harness';
import { smallTargets } from '@test/touch-audit';
import LeaderLimitRequestsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/leader-limit-requests',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', preferredName: null,
    pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'leader_limit_request:read', 'leader_limit_request:decide'],
});

const req = (over: Record<string, unknown> = {}) => ({
  requestId: 'llr-1', kpmId: 'kpm-1', kpmCode: '0603', kpmBranchName: 'Tangerang Branch',
  subjectMembershipId: 'mem-1', subjectName: 'Rizky Ramadhan', subjectAgentCode: '86114', action: 'promote',
  fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: 'Ready to bring on his own agents',
  requestedByMembershipId: 'mem-owner', requestedByName: 'Hendra Gunawan', status: 'pending',
  requestedAt: '2026-10-25T00:00:00.000Z', decidedAt: null, declineReason: null, maxLeaders: 10, leadersUsed: 13,
  ...over,
});

/**
 * **Leaders past the limit** (P18.5-T2 AC-6, ADR-0157 §3): the Super Admin's queue — pending first, approve, decline
 * with a reason, the decided list — and its count in the console's nav.
 */
describe('Leaders past the limit (P18.5-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-6 names who, the change, the office, who asked and why, and what approving makes the count', async () => {
    stubFetch({ '/admin/leader-limit-requests': { body: [req()] } });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Rizky Ramadhan · Agent → AAB')).toBeInTheDocument();
    expect(screen.getByText(/KPM 0603 · Tangerang Branch · asked by/)).toHaveTextContent('leaders 13 / 10');
    expect(screen.getByText('Ready to bring on his own agents')).toBeInTheDocument();
    expect(screen.getByText(/the office's leaders become 14 \/ 10\. The limit does not change\./)).toBeInTheDocument();
  });

  it('AC-6 approves, and the queue the server returns replaces the list', async () => {
    const { calls } = stubFetch({
      '/admin/leader-limit-requests/llr-1/approve': { body: [req({ status: 'approved', leadersUsed: 14 })] },
      '/admin/leader-limit-requests': { body: [req()] },
    });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(calls.some((c) => c.url.endsWith('/approve') && c.init.method === 'POST')).toBe(true);
    const decided = await screen.findByRole('table', { name: 'Decided requests' });
    expect(within(decided).getByText('Approved')).toBeInTheDocument();
    expect(await screen.findByText('No office is waiting to add a leader past its limit.')).toBeInTheDocument();
  });

  it('AC-6 will not decline without a reason, and sends the one typed', async () => {
    const { calls } = stubFetch({
      '/admin/leader-limit-requests/llr-1/decline': {
        body: [req({ status: 'declined', declineReason: 'Raise the limit at renewal instead.' })],
      },
      '/admin/leader-limit-requests': { body: [req()] },
    });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('button', { name: 'Decline' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Why not?'), 'Raise the limit at renewal instead.');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const sent = calls.find((c) => c.url.endsWith('/decline'));
    expect(JSON.parse(String(sent?.init.body))).toEqual({ reason: 'Raise the limit at renewal instead.' });
    expect(await screen.findByText('Raise the limit at renewal instead.')).toBeInTheDocument();
  });

  it('AC-4 says why a request no longer applied, and reads the queue again', async () => {
    const { calls } = stubFetch({
      '/admin/leader-limit-requests/llr-1/approve': {
        status: 409,
        body: {
          error: {
            code: 'LEADER_LIMIT_REQUEST_STALE', requestId: 'r-1',
            message: 'This request no longer applies: They have moved rung since it was asked. It has been closed, and nothing was changed.',
          },
        },
      },
      '/admin/leader-limit-requests': [{ body: [req()] }, { body: [req({ status: 'declined', declineReason: 'No longer applies: They have moved rung since it was asked.' })] }],
    });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, { me: SUPER_ADMIN });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer applies');
    expect(calls.filter((c) => c.url.endsWith('/admin/leader-limit-requests')).length).toBeGreaterThan(1);
    expect(await screen.findByText('No longer applies: They have moved rung since it was asked.')).toBeInTheDocument();
  });

  it('AC-6 lists the queue in the console’s nav with its pending count', async () => {
    stubFetch({ '/admin/leader-limit-requests': { body: [req(), req({ requestId: 'llr-2' }), req({ requestId: 'llr-3', status: 'approved' })] } });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, { me: SUPER_ADMIN });

    const link = await screen.findByRole('link', { name: /Leaders past the limit/ });
    expect(link).toHaveAttribute('href', '/admin/leader-limit-requests');
    await vi.waitFor(() => expect(link).toHaveTextContent('2'));
  });

  it('refuses a reader who may not decide', async () => {
    stubFetch({ '/admin/leader-limit-requests': { body: [] } });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, {
      me: makeMe({ ...SUPER_ADMIN, permissions: ['kpm:list_all'] }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
  });
});

/**
 * **P19.2-T2 — the queue below 1024px** (UI-126, UI-135): the decided requests as rows, read only; the pending cards'
 * targets 44px. The laptop keeps its table.
 */
describe('P19.2-T2 Leaders past the limit below 1024px (UI-126, UI-135)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const ROWS = [
    req(),
    req({ requestId: 'llr-2', subjectName: 'Sari Dewi', status: 'approved', decidedAt: '2026-11-01T00:00:00.000Z' }),
    req({ requestId: 'llr-3', subjectName: 'Budi Santoso', status: 'declined', declineReason: 'Wait for the new year.' }),
  ];
  const show = () => {
    stubFetch({ '/admin/leader-limit-requests': { body: ROWS } });
    renderInLayout(AdminLayout, <LeaderLimitRequestsPage />, { me: SUPER_ADMIN });
  };

  it.each([375, 768])('P19.2-T2 AC-1 at %ipx the decided requests are rows: the member, office · change · asked by, the state', async (px) => {
    atWidth(px);
    show();
    const list = await screen.findByRole('list', { name: 'Decided requests' });
    expect(screen.queryByRole('table')).toBeNull();
    const [approved, declined] = within(list).getAllByRole('listitem');
    expect(wears(approved, px)).toContain('min-h-14');
    expect(approved).toHaveTextContent('Sari Dewi');
    expect(approved).toHaveTextContent('KPM 0603 · Tangerang Branch · Agent → AAB · asked by Hendra Gunawan');
    expect(within(approved).getByText('Approved')).toBeInTheDocument();
    expect(declined).toHaveTextContent('Wait for the new year.');
    expect(within(declined).getByText('Declined')).toBeInTheDocument();
    // Read only, as the table is.
    expect(within(list).queryByRole('link')).toBeNull();
    expect(within(list).queryByRole('button')).toBeNull();
  });

  it.each([1024, 1280])('P19.2-T2 AC-1 at %ipx keeps the decided table', async (px) => {
    atWidth(px);
    show();
    const table = await screen.findByRole('table', { name: 'Decided requests' });
    expect(within(table).getByText('Sari Dewi')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Decided requests' })).toBeNull();
  });

  it.each([375, 768])('P19.2-T2 AC-5 at %ipx finds no target under 44px in main', async (px) => {
    atWidth(px);
    show();
    await screen.findByRole('list', { name: 'Decided requests' });
    expect(smallTargets(document.querySelector('main')!, px)).toEqual([]);
  });

  it.each([375, 1280])('P19.2-T2 AC-1 at %ipx has no axe violations', async (px) => {
    atWidth(px);
    show();
    await screen.findByText('Sari Dewi');
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
