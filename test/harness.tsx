import { act, render, type RenderResult } from '@testing-library/react';
import { createHash } from 'node:crypto';
import { Suspense } from 'react';
import { vi } from 'vitest';
import { SessionContext, type Me, type SessionValue } from '@/lib/session';

/**
 * Test doubles for the things every screen depends on: who is signed in, what the API answered, and — for a
 * screen that changes by size — how wide the screen is.
 */

/**
 * Whether a media query holds at a width, read the way a browser reads the ones this app asks:
 * `(min-width: Npx)` and `(max-width: Npx)` joined by `and`, a comma list of them, and Tailwind's
 * `not all and (min-width: Npx)`, which is what a `max-lg:` class compiles to. Anything else — a pointer, a
 * colour scheme — does not hold, as the phone-only stubs before this answered it.
 */
export function matchesAt(query: string, px: number): boolean {
  return query.split(',').some((part) => {
    let rest = part.trim();
    const negated = /^not\s+all\s+and\s+/.exec(rest);
    if (negated) rest = rest.slice(negated[0].length);
    const features = rest.split(/\s+and\s+/);
    const read = features.map((feature) => /^\((min|max)-width:\s*([\d.]+)px\)$/.exec(feature.trim()));
    if (read.some((m) => m === null)) return false;
    const holds = read.every((m) => (m![1] === 'min' ? px >= Number(m![2]) : px <= Number(m![2])));
    return negated ? !holds : holds;
  });
}

/**
 * **A screen of a given width, as far as a component can ask** — `matchMedia`, which jsdom does not have —
 * answering every query by `matchesAt`, so the three ranges of `useMediaQuery` (`lib/use-media-query.ts`) are each
 * the width's: 767 is a phone, 768 and 1023 a tablet, 1024 a desktop (P18.97-T6 AC-2). `resize` moves the width
 * afterwards and tells whoever is listening, as a tablet turned on its side does.
 *
 * A spec about the phone alone may still stub `matches: query === PHONE_QUERY`; a spec about a tablet must use
 * this, since a phone-only stub reads every tablet query as false and draws the desktop at 768.
 */
export function atWidth(px: number) {
  let width = px;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query,
    get matches() { return matchesAt(query, width); },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })));
  return {
    resize(next: number) {
      width = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

/** Tailwind's screens, as `tailwind.config.ts` leaves them: its defaults. */
const SCREENS: Record<string, number> = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

/**
 * **What an element wears at a width**: its classes whose screen variants hold there, each with those variants
 * taken off — `max-lg:flex-nowrap` is `flex-nowrap` at 1023 and nothing at 1024, `md:w-sidebar` is `w-sidebar` from
 * 768. jsdom applies no stylesheet, so this is how a spec reads a size that CSS decides; the order is the class
 * attribute's, and the stylesheet still decides between two that conflict. A state variant (`focus-visible:`) stays.
 */
export function wears(el: Element, px: number): string {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).flatMap((token) => {
    const variants: string[] = [];
    let rest = token;
    for (let m = /^([a-z0-9-]+):/.exec(rest); m; m = /^([a-z0-9-]+):/.exec(rest)) {
      variants.push(m[1]);
      rest = rest.slice(m[0].length);
    }
    const screens = variants.filter((v) => v.replace(/^max-/, '') in SCREENS);
    const holds = screens.every((v) => (v.startsWith('max-') ? px < SCREENS[v.slice(4)] : px >= SCREENS[v]));
    return holds ? [[...variants.filter((v) => !screens.includes(v)), rest].join(':')] : [];
  }).join(' ');
}

/**
 * **An element as it is printed at a width** (P18.97-T7): every element's classes those that hold there (`wears`), and
 * React's generated ids made one, so a screen's markup at 768px or 1280px can be pinned to a digest taken before a
 * phone-only change and compared after it — a `max-md:` class added for a phone wears nothing from 768px, and a
 * component that renders something else on a phone renders what it did.
 */
export function drawnAt(el: Element, px: number): string {
  const copy = el.cloneNode(true) as Element;
  for (const node of [copy, ...Array.from(copy.querySelectorAll('*'))]) {
    if (node.hasAttribute('class')) node.setAttribute('class', wears(node, px));
  }
  return copy.outerHTML.replace(/_r_[0-9a-z]+_/g, '_id_');
}

/** `drawnAt`'s markup as a SHA-256 digest, the form a spec records it in. */
export function digestAt(el: Element, px: number): string {
  return createHash('sha256').update(drawnAt(el, px)).digest('hex');
}

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
    activation: null,
    newHires: false,
    ...overrides,
  };
}

/**
 * A session as a screen sees it. `signIn` resolves to the session's own `me`, as the provider's resolves
 * to whoever it just read; a login spec about *who* signed in passes a `signIn` of its own.
 */
export function makeSession(overrides: Partial<SessionValue> = {}): SessionValue {
  const me = 'me' in overrides ? overrides.me ?? null : makeMe();
  return {
    me,
    loading: false,
    signedOut: false,
    expired: false,
    signIn: vi.fn(async () => me),
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

/** A reply worked out from the request — for a write whose answer depends on what was sent. */
export type StubReply = StubResponse | ((call: { url: string; method: string; body: unknown }) => StubResponse);

const METHOD_KEY = /^(GET|POST|PUT|PATCH|DELETE) (.+)$/;

/**
 * Route fetch calls by URL fragment.
 *
 * Matching on a fragment rather than the full URL keeps a test from silently passing
 * against the wrong version prefix — the fragment always includes the path, and
 * `fetchCalls` exposes the full URL for the assertions that care.
 *
 * **A key may name its method** — `'PUT /coaching/sessions/'` — for a path a screen both reads and
 * writes; it then answers that method only, and beats a bare fragment of the same length. A reply may
 * be a function of the request, for a write whose answer echoes what was sent.
 */
export function stubFetch(routes: Record<string, StubReply | StubReply[]>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const queues = new Map<string, StubReply[]>(
    Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]),
  );
  const parts = (key: string) => {
    const m = METHOD_KEY.exec(key);
    return m ? { method: m[1], fragment: m[2] } : { method: null, fragment: key };
  };

  const mock = vi.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const method = init.method ?? 'GET';
    const key = [...queues.keys()]
      .filter((k) => {
        const p = parts(k);
        return url.includes(p.fragment) && (p.method === null || p.method === method);
      })
      // Longest match wins, so '/auth/me' does not shadow '/auth/me/extra'; a key that names the
      // method wins over one that does not.
      .sort((a, b) => (parts(b).fragment.length - parts(a).fragment.length)
        || (parts(b).method ? 1 : 0) - (parts(a).method ? 1 : 0))[0];
    if (!key) throw new Error(`No stub for ${method} ${url}. Stubbed: ${[...queues.keys()].join(', ')}`);
    const queue = queues.get(key)!;
    const reply = queue.length > 1 ? queue.shift()! : queue[0];
    const stub = typeof reply === 'function'
      ? reply({ url, method, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body })
      : reply;
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
