/**
 * **Where sign-in returns to** (P18.1-T3 AC-2): a page that needs a session sends a signed-out reader to
 * `/login?next=<path>`, and the login page goes back there once they are in — a shared meeting's link
 * opened before signing in lands on the meeting, not on the home page.
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
 * Where a page that needs a session sends a signed-out reader: `/login`, carrying the page they were on as
 * `next` so signing in brings them back to it. The home page and the login page itself carry nothing — `/`
 * forwards by role anyway.
 */
export function signInPathFrom(location: { pathname: string; search: string }): string {
  const here = `${location.pathname}${location.search}`;
  if (location.pathname === '/' || location.pathname.startsWith('/login')) return '/login';
  return `/login?next=${encodeURIComponent(here)}`;
}
