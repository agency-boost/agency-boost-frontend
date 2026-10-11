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
 * given a `next` at all (`SessionValue.signedOut`); an expired session or a link opened signed out still is.
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
 * Where a page that needs a session sends a reader it no longer has one for: `/login`, carrying the page they
 * were on as `next` so signing in brings them back to it. The home page and the login page itself carry
 * nothing — `/` forwards by role anyway — and neither does a reader who **signed out themselves**
 * (`signedOut`, 2026-10-11): they are leaving, not on their way back, and the page would otherwise be handed
 * to whoever signs in next on the device.
 */
export function signInPathFrom(
  location: { pathname: string; search: string },
  { signedOut = false }: { signedOut?: boolean } = {},
): string {
  const here = `${location.pathname}${location.search}`;
  if (signedOut || location.pathname === '/' || location.pathname.startsWith('/login')) return '/login';
  return `/login?next=${encodeURIComponent(here)}`;
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
