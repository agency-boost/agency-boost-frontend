import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import SupportSessionsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/support-sessions',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', hierarchyRole: 'ab' as const,
    status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['impersonation:read_session_log'],
});

const entry = (over: Record<string, unknown> = {}) => ({
  sessionId: 's1',
  operatorName: 'Root',
  subjectName: 'Rina Wijaya',
  reason: 'Their overview will not load.',
  readOnly: true,
  elevatedByName: null,
  elevationReason: null,
  startedAt: '2026-09-10T08:00:00.000Z',
  endedAt: '2026-09-10T08:20:00.000Z',
  expiresAt: '2026-09-10T09:00:00.000Z',
  ...over,
});

function render(body: unknown = [entry()]) {
  stubFetch({ '/admin/tenants/kpm-1/impersonation-sessions': { body } });
  renderWithSession(<SupportSessionsPage />, { me: OWNER });
}

describe('support sessions, as an Owner reads them (P4-T10)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('names who was helped, who helped, and why', async () => {
    // Support an office cannot see is support an office cannot question.
    render();
    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Their overview will not load.')).toBeInTheDocument();
  });

  it('distinguishes a session that could only look from one that could change things', async () => {
    render([
      entry(),
      entry({
        sessionId: 's2',
        readOnly: false,
        elevatedByName: 'Second Operator',
        elevationReason: 'Their taxonomy has a duplicate code.',
      }),
    ]);
    expect(await screen.findByText('Look only')).toBeInTheDocument();
    expect(screen.getByText('Could make changes')).toBeInTheDocument();
  });

  it('names who approved the writing, and why looking was not enough', async () => {
    /*
     * Two reasons, two people. "Why look at this office" and "why is looking not enough"
     * are different questions, answered by different Super Admins, and the Owner reads
     * both.
     */
    render([entry({
      readOnly: false,
      elevatedByName: 'Second Operator',
      elevationReason: 'Their taxonomy has a duplicate code.',
    })]);
    expect(await screen.findByText(/approved by Second Operator/)).toBeInTheDocument();
    expect(screen.getByText(/To make changes: Their taxonomy has a duplicate code\./))
      .toBeInTheDocument();
  });

  it('says when one is still running', async () => {
    render([entry({ endedAt: null })]);
    expect(await screen.findByText('still running')).toBeInTheDocument();
  });

  it('says plainly when nobody has', async () => {
    render([]);
    expect(await screen.findByText(/Nobody has acted as a member of this office/))
      .toBeInTheDocument();
  });
});
