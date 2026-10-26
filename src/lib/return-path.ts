import { landingFor } from './landing';
import { canOpen } from './route-access';
import type { Me } from './session';

/**
 * **Where sign-in returns to** (P18.1-T3 AC-2): a page that needs a session sends a signed-out reader to
 * `/login?next=<path>`, so a shared meeting's link opened before signing in lands on the meeting, not on the
 * home page.
 *
 * **Only for the person who can open it, and never after a deliberate sign-out** (the product owner's report,
 * 2026-10-11). The login page goes back to `next` only when `canOpen` (`lib/route-access.ts`) says the person
 * who just signed in can open it, and sends anybody else to their own landing: the Owner signed out of an
 * Owner page and an Agent signed in after them, and was sent to it. A reader who signs out themselves is not
 * given a `next` at all (`SessionValue.signedOut`); an expired session or a link opened signed out still is, and
 * an expired one says so (`reason=expired`, ADR-0168 §1).
 *
 * Only a path inside this app is honoured. A prefix check is not enough: the URL parser drops tabs and line
 * breaks and reads `\` as `/`, so `/\t/evil.test` and `/\evil.test` both resolve to another host. So `next` is
 * parsed the way the browser will parse it, against a placeholder origin, and kept only when it stays on that
 * origin and was written without a control character or a backslash; anything else — and a missing `next` —
 * falls back to `/`, which forwards by role.
 */
const PLACEHOLDER = 'http://return.invalid';

export function returnPathFrom(search: string): string {
  const next = new URLSearchParams(search).get('next');
  if (!next || !next.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) return '/';
  let parsed: URL;
  try {
    parsed = new URL(next, PLACEHOLDER);
  } catch {
    return '/';
  }
  // `/..//evil.test` stays on the origin but normalises to `//evil.test`, which a browser reads as a host.
  if (parsed.origin !== PLACEHOLDER || parsed.pathname.startsWith('//')) return '/';
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * **Why the sign-in page was opened** (ADR-0168 §1): `reason=expired` when the reader's session ended under them —
 * a plain word in the address, carrying nothing about the session. The sign-in page then reads *Your session
 * ended. Sign in again.*; any other value, or none, reads *Sign in to continue.*
 */
export const SESSION_EXPIRED_REASON = 'expired';

/** Whether the sign-in page's address says the reader's session ended (`?reason=expired`), and nothing else. */
export function sessionEndedIn(search: string | URLSearchParams): boolean {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get('reason') === SESSION_EXPIRED_REASON;
}

/**
 * How the session ended, as the guard that found it gone knows it (`SessionValue`): **`signedOut`**, the reader
 * pressed *Sign out*; **`expired`**, a session this tab had could no longer be refreshed (ADR-0168 §1). Neither,
 * and there was no session to end: a link or an address opened signed out.
 */
export interface SessionEnd {
  signedOut?: boolean;
  expired?: boolean;
}

/**
 * Where a page that needs a session sends a reader it no longer has one for — **the one helper every guard
 * uses**: `/login`, carrying the page they were on as `next` so signing in brings them back to it. The home page
 * and the login page itself carry nothing — `/` forwards by role anyway — and neither does a reader who **signed
 * out themselves** (`signedOut`, 2026-10-11): they are leaving, not on their way back, and the page would
 * otherwise be handed to whoever signs in next on the device.
 *
 * **A session that ended under the reader adds `reason=expired`** (ADR-0168 §1), so the sign-in page says so.
 * Three cases, then: signed out → `/login`; expired → `/login?next=<page>&reason=expired`; arrived signed out →
 * `/login?next=<page>`.
 */
export function signInPathFrom(
  location: { pathname: string; search: string },
  { signedOut = false, expired = false }: SessionEnd = {},
): string {
  if (signedOut) return '/login';
  const params: string[] = [];
  if (location.pathname !== '/' && !location.pathname.startsWith('/login')) {
    params.push(`next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
  }
  if (expired) params.push(`reason=${SESSION_EXPIRED_REASON}`);
  return params.length ? `/login?${params.join('&')}` : '/login';
}

/**
 * **Where the login page sends the person who just signed in**: back to `next` when it is a safe path in this
 * app *and* they can open it, otherwise their own landing (`landingFor`). One function, so the rule is
 * readable and tested without rendering the page. `me` is who `signIn` found — `null` when the session could
 * not be read, which lands on `/login` as `/` would.
 */
export function destinationAfterSignIn(search: string, me: Me | null): string {
  const next = returnPathFrom(search);
  return next !== '/' && canOpen(next, me) ? next : landingFor(me);
}
