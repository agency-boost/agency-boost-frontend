import { api, setAccessToken } from './api-client';

/**
 * **Linked logins, from the browser** (P19.2-T1 AC-8; UI-169 item 5;
 * [ADR-0199](../../../docs/04-adr/0199-a-second-login-is-linked-through-its-own-mailbox-and-password.md)).
 *
 * **No token is ever held by script.** Both logins' refresh tokens are `httpOnly` cookies the API sets and swaps
 * (`agencyboost_refresh`, `agencyboost_refresh_linked`); the access token a switch answers goes where every access token
 * goes, into `api-client`'s memory, and nowhere else.
 */

/** The code a switch answers when this browser holds no live session of the other login (`409`, ADR-0199 §4). */
export const LINK_SIGN_IN_REQUIRED = 'AUTH_LINK_SIGN_IN_REQUIRED';

/** A wrong password for a login is the route's answer, never an expired token: not refreshed and replayed. */
const WRONG_PASSWORD = ['AUTH_INVALID_CREDENTIALS'] as const;

/**
 * ***Tambah akun***: `POST /auth/links` `{ email, currentPassword }`. Resolves alike whatever the other address is —
 * the API answers the same `202` (ADR-0199 §2) — so the screen says *if* it can be linked, a link is on its way.
 */
export async function startLink(email: string, currentPassword: string): Promise<void> {
  await api('/auth/links', { method: 'POST', body: { email, currentPassword }, answers401: WRONG_PASSWORD });
}

/**
 * **The link's page**: `POST /auth/links/confirm` `{ token, password }` — the other login's password, sent only when the
 * page's button is pressed (ADR-0190 §1). Public, and never refreshed: a wrong password is the answer, not a session.
 */
export async function confirmLink(token: string, password: string): Promise<void> {
  await api('/auth/links/confirm', { method: 'POST', body: { token, password }, skipRefresh: true });
}

/**
 * **Switch to the linked login**: `POST /auth/links/switch` `{ userId, password? }`. On success the API has swapped the
 * two cookies and answers the other login's access token, which replaces this one in memory: every request after it is
 * the other login's. The caller then reads the session again and clears the cached reads (ADR-0198 §6).
 *
 * Refused `409 AUTH_LINK_SIGN_IN_REQUIRED` when this browser holds no session of that login — the switcher then asks its
 * password once and calls this again with it.
 */
export async function switchLogin(userId: string, password?: string): Promise<void> {
  const { accessToken } = await api<{ accessToken: string; expiresIn: number }>('/auth/links/switch', {
    method: 'POST',
    body: password === undefined ? { userId } : { userId, password },
    answers401: WRONG_PASSWORD,
  });
  setAccessToken(accessToken);
}

/** ***Hapus tautan***: `DELETE /auth/links/:linkId`, by either login of the pair, with no password (ADR-0199 §5). */
export async function removeLink(linkId: string): Promise<void> {
  await api(`/auth/links/${encodeURIComponent(linkId)}`, { method: 'DELETE' });
}
