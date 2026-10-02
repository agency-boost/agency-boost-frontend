import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe } from '@test/harness';
import { SessionProvider } from '@/components/session-provider';
import { setAccessToken } from '@/lib/api-client';
import AgentLayout from './(agent)/layout';
import CoachingRosterPage from './(agent)/coaching/page';
import NotificationsPage from './notifications/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
}));

/**
 * P11-T6 AC-13. **A hard load draws no 401.**
 *
 * A reload drops the access token, which lives in memory only, and the session gets it back from the
 * refresh cookie. Every hard load used to send the office's configuration reads before that refresh
 * had finished: two requests with no token, two 401s, and a refresh posted by each beside the
 * session's own. This loads a leader's landing screen cold, through the real session provider and the
 * real layout, against a server that refuses any request without a token, as the API does.
 */
const LEADER = makeMe({
  membership: {
    membershipId: 'mem-jordan', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 1,
  },
  permissions: ['coaching_session:read', 'notification:read_inbox', 'notification:mark_read'],
});

const ANSWERS: Record<string, unknown> = {
  '/auth/me': LEADER,
  '/kpm/config': { activity: [], ratios: [], leadPipelines: [], version: 1 },
  '/kpm/org-levels': [],
  '/notifications': { items: [], unread: 0 },
  '/coaching/coachees': {
    today: '2026-10-02',
    overdueAfterDays: 7,
    directAgents: [{
      membershipId: 'mem-rina', name: 'Rina Wijaya', rung: { code: 'AGENT', label: 'Agent' }, depth: 1,
      lastOneOnOne: null, status: 'no_goal_set',
    }],
    units: [],
  },
};

/** The API, as far as a hard load meets it: the cookie refreshes, and a request with no token is refused. */
function coldServer() {
  const seen: { path: string; status: number }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.split('/api/v1')[1].split('?')[0];
    const bearer = (init.headers as Record<string, string>).Authorization;
    let status = 200;
    let body: unknown;
    if (path === '/auth/refresh') body = { accessToken: 'from-the-cookie' };
    else if (bearer !== 'Bearer from-the-cookie') {
      status = 401;
      body = { error: { code: 'AUTH_REQUIRED', message: 'Sign in.', requestId: 'req-401' } };
    } else if (path in ANSWERS) body = ANSWERS[path];
    else throw new Error(`No answer for ${path}`);
    seen.push({ path, status });
    return { ok: status < 300, status, json: async () => body } as Response;
  }));
  return seen;
}

describe('a hard load (P11-T6 AC-13)', () => {
  beforeEach(() => setAccessToken(null));
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it('P11-T6 AC-13 draws no 401, and refreshes once', async () => {
    const seen = coldServer();
    render(
      <SessionProvider>
        <AgentLayout>
          <CoachingRosterPage />
        </AgentLayout>
      </SessionProvider>,
    );

    expect(await screen.findByText('Rina Wijaya')).toBeInTheDocument();
    expect(seen.filter((r) => r.status === 401)).toEqual([]);
    expect(seen.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    // The refresh is first, then who is signed in; the office's configuration waits for both.
    expect(seen.slice(0, 2).map((r) => r.path)).toEqual(['/auth/refresh', '/auth/me']);
    expect(seen.map((r) => r.path)).toEqual(expect.arrayContaining(['/kpm/config', '/kpm/org-levels', '/coaching/coachees']));
  });

  it('P11-T8’s walk: /notifications, outside the group layouts, draws no 401 either', async () => {
    const seen = coldServer();
    render(
      <SessionProvider>
        <NotificationsPage />
      </SessionProvider>,
    );

    expect(await screen.findByText('Nothing yet. This is where you will hear about your unit.')).toBeInTheDocument();
    expect(seen.filter((r) => r.status === 401)).toEqual([]);
    expect(seen.filter((r) => r.path === '/auth/refresh')).toHaveLength(1);
    expect(seen.slice(0, 2).map((r) => r.path)).toEqual(['/auth/refresh', '/auth/me']);
    expect(seen.map((r) => r.path)).toContain('/notifications');
  });
});
