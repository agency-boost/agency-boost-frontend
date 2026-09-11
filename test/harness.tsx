import { render, type RenderResult } from '@testing-library/react';
import { Suspense } from 'react';
import { vi } from 'vitest';
import { SessionContext, type Me, type SessionValue } from '@/lib/session';

/**
 * Test doubles for the two things every screen depends on: who is signed in, and what
 * the API answered.
 */

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    user: {
      id: 'u-1',
      email: 'rina@kpm0417.test',
      fullName: 'Rina Wijaya',
      preferredName: 'Rina',
      pronoun: 'they',
      initials: 'RW',
      platformRole: 'none',
    },
    membership: {
      membershipId: 'mem-1',
      kpmId: 'kpm-1',
      orgLevelCode: 'AGENT',
      hierarchyRole: 'agent',
      isKpmOwner: false,
      isKpmAdmin: false, status: 'active', directCount: 0,
    },
    isImpersonating: false,
    impersonationReadOnly: false,
    impersonatedBy: null,
    mustChangePassword: false,
    permissions: [],
    ...overrides,
  };
}

export function makeSession(overrides: Partial<SessionValue> = {}): SessionValue {
  return {
    me: makeMe(),
    loading: false,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    reload: vi.fn(async () => undefined),
    ...overrides,
  };
}

/**
 * The Suspense boundary is not decoration: a page that reads its route params with
 * `use(params)` suspends on the first render, and the App Router always provides a
 * boundary. Without one here the tree renders nothing and the failure looks like a
 * missing element rather than a missing boundary.
 */
export function renderWithSession(
  ui: React.ReactElement,
  session: Partial<SessionValue> = {},
): RenderResult & { session: SessionValue } {
  const value = makeSession(session);
  return {
    ...render(
      <SessionContext.Provider value={value}>
        <Suspense fallback={null}>{ui}</Suspense>
      </SessionContext.Provider>,
    ),
    session: value,
  };
}

/**
 * Route params as `use()` wants them.
 *
 * The App Router hands a page a promise, and `use()` unwraps it. A plain
 * `Promise.resolve(...)` does not work here: `use()` suspends on an untagged thenable
 * and — under jsdom with the act environment on — the resume never runs, so the tree
 * renders empty and the failure looks like a missing element. React reads `status` and
 * `value` off an already-settled thenable and returns synchronously, which is exactly
 * what a framework hands a page for params it already knows.
 */
export function routeParams<T extends object>(value: T): Promise<T> {
  return Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
}

export interface StubResponse {
  status?: number;
  body?: unknown;
}

/**
 * Route fetch calls by URL fragment.
 *
 * Matching on a fragment rather than the full URL keeps a test from silently passing
 * against the wrong version prefix — the fragment always includes the path, and
 * `fetchCalls` exposes the full URL for the assertions that care.
 */
export function stubFetch(routes: Record<string, StubResponse | StubResponse[]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const queues = new Map<string, StubResponse[]>(
    Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]),
  );

  const mock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = [...queues.keys()]
      .filter((k) => url.includes(k))
      // Longest match wins, so '/auth/me' does not shadow '/auth/me/extra'.
      .sort((a, b) => b.length - a.length)[0];
    if (!key) throw new Error(`No stub for ${url}. Stubbed: ${[...queues.keys()].join(', ')}`);
    const queue = queues.get(key)!;
    const stub = queue.length > 1 ? queue.shift()! : queue[0];
    const status = stub.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => stub.body,
    } as Response;
  });

  vi.stubGlobal('fetch', mock);
  return { calls, mock };
}

/**
 * Render a page inside its group layout, which is how a reader meets it.
 *
 * Route groups moved the chrome out of the page and into the layout above it, so a spec
 * that renders the page alone is testing half a screen — no sidebar, no sign-out, and no
 * session gate. Anything asserting either belongs in here.
 */
export function renderInLayout(
  Layout: (props: { children: React.ReactNode }) => React.ReactNode,
  ui: React.ReactNode,
  session: Parameters<typeof renderWithSession>[1] = {},
) {
  return renderWithSession(<Layout>{ui}</Layout>, session);
}
