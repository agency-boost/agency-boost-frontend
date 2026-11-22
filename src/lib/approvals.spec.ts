import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, makeSession, stubFetch } from '@test/harness';
import type { KpmRequestRow } from './admin';
import { APPROVALS_CHANGED, mergeApprovals, useApprovalsPending } from './approvals';
import type { LeaderLimitRequestRow } from './leader-limit-requests';
import { SessionContext, type Me } from './session';

const kpm = (over: Partial<KpmRequestRow>): KpmRequestRow => ({
  requestId: 'req', branchName: 'Branch', companyId: 'co', companyName: 'Prudential', requestedByName: 'A',
  requestedByEmail: 'a@x', requestedByPhone: null, requesterCompanyId: 'co', requesterCompanyName: 'Prudential',
  requesterEmailVerified: true, note: null, status: 'pending', requestedAt: '2026-11-01T00:00:00.000Z', decidedAt: null,
  decidedByName: null, reason: null, createdKpmId: null, createdKpm: null, ...over,
});
const limit = (over: Partial<LeaderLimitRequestRow>): LeaderLimitRequestRow => ({
  requestId: 'llr', kpmId: 'k', kpmCode: '0603', kpmBranchName: 'Tangerang', companyName: 'Prudential', subjectMembershipId: 'm',
  subjectName: 'R', subjectAgentCode: '1', action: 'promote', fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', reason: null,
  requestedByMembershipId: 'o', requestedByName: 'H', status: 'pending', requestedAt: '2026-11-02T00:00:00.000Z',
  decidedAt: null, decidedByName: null, declineReason: null, maxLeaders: 10, leadersUsed: 11, ...over,
});

const SUPER_ADMIN = makeMe({
  user: { id: 'u', email: 'r@x', fullName: 'Root', preferredName: null, pronoun: 'they', initials: 'R', platformRole: 'super_admin' },
  membership: null,
  permissions: ['kpm_request:read', 'leader_limit_request:read'],
});
const wrapper = (me: Me) => function Wrapper({ children }: { children: ReactNode }) {
  return createElement(SessionContext.Provider, { value: makeSession({ me }) }, children);
};

afterEach(() => vi.unstubAllGlobals());

describe('P19.23-T3 AC-2 Persetujuan’s one list (ADR-0277)', () => {
  it('P19.23-T3 AC-2 waiting first, newest asked first; then decided, newest decided first', () => {
    const merged = mergeApprovals(
      [kpm({ requestId: 'k-old' }), kpm({ requestId: 'k-done', status: 'approved', decidedAt: '2026-11-10T00:00:00.000Z' })],
      [limit({ requestId: 'l-new', requestedAt: '2026-11-05T00:00:00.000Z' }),
        limit({ requestId: 'l-done', status: 'declined', decidedAt: '2026-11-12T00:00:00.000Z' })],
    );
    expect(merged.map((a) => `${a.kind}:${a.id}`)).toEqual(['limit:l-new', 'kpm:k-old', 'limit:l-done', 'kpm:k-done']);
  });

  it('P19.23-T3 AC-2 a row from a server without the decider reads nobody, never undefined', () => {
    const [a] = mergeApprovals([{ ...kpm({}), decidedByName: undefined } as unknown as KpmRequestRow], []);
    expect(a.decidedByName).toBeNull();
  });
});

describe('P19.23-T3 useApprovalsPending — the nav’s count', () => {
  it('P19.23-T3 AC-2 counts both queues’ waiting requests, and reads again when told', async () => {
    stubFetch({
      '/admin/kpm-requests': [{ body: [kpm({}), kpm({ status: 'declined' })] }, { body: [] }],
      '/admin/leader-limit-requests': [{ body: [limit({})] }, { body: [] }],
    });
    const { result } = renderHook(() => useApprovalsPending(), { wrapper: wrapper(SUPER_ADMIN) });
    await waitFor(() => expect(result.current).toBe(2));
    window.dispatchEvent(new Event(APPROVALS_CHANGED));
    await waitFor(() => expect(result.current).toBe(0));
  });

  it('P19.23-T3 AC-2 is 0 for anybody but a Super Admin, without a read', () => {
    const { calls } = stubFetch({});
    const owner = makeMe({ permissions: ['kpm_request:read'] });
    const { result } = renderHook(() => useApprovalsPending(), { wrapper: wrapper(owner) });
    expect(result.current).toBe(0);
    expect(calls).toEqual([]);
  });

  it('P19.23-T3 AC-2 is 0 inside a support session, and on a failed read', async () => {
    const { calls } = stubFetch({});
    const { result } = renderHook(() => useApprovalsPending(), { wrapper: wrapper({ ...SUPER_ADMIN, isImpersonating: true }) });
    expect(result.current).toBe(0);
    expect(calls).toEqual([]);
    vi.unstubAllGlobals();
    stubFetch({ '/admin/kpm-requests': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'x' } } }, '/admin/leader-limit-requests': { body: [] } });
    const failed = renderHook(() => useApprovalsPending(), { wrapper: wrapper(SUPER_ADMIN) });
    await new Promise((r) => setTimeout(r, 20));
    expect(failed.result.current).toBe(0);
  });
});
