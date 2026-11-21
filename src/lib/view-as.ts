'use client';

import { api } from './api-client';

/**
 * ***Lihat sebagai* — a new window showing what one person sees** (P19.23-T2 AC-7; ADR-0277; the Super Admin spec of
 * 20 November, §5: *"pick a real person of that KPM → Buka jendela baru opens a new window showing exactly what that
 * person sees, view only, logged"*).
 *
 * The support session's token lives in memory and nowhere else (frontend `CLAUDE.md`), so a new window cannot be handed
 * one. Instead the session is started **for a window**: the API answers a one-time code and no token
 * (`POST /admin/impersonate/:userId`, `handoff: true`), the new window opens on `VIEW_AS_PATH` with the code in its
 * address's **fragment** — never sent to any server — restores the Super Admin from the refresh cookie as every tab
 * does, and redeems the code (`POST /admin/impersonate/handoff`) for the session's token, into its own memory. The
 * console's tab never holds the session and stays where it was, inside the KPM.
 */

/** The page the new window opens on: `/view-as#<code>` (`app/view-as/page.tsx`). */
export const VIEW_AS_PATH = '/view-as';

/** The browser refused to open a window: the card says so, and nothing was started. */
export class ViewAsBlocked extends Error {
  readonly code = 'VIEW_AS_BLOCKED';
  constructor() {
    super('The browser blocked the new window.');
    this.name = 'ViewAsBlocked';
  }
}

/** What a start for a window answers: a one-time code, and no token. */
export interface ViewAsStarted {
  handoffCode: string;
  handoffExpiresAt: string;
  expiresAt: string;
  sessionId: string;
  readOnly: true;
}

/** What redeeming the code answers: the session's token, as a same-tab start answers it. */
export interface ViewAsSession {
  accessToken: string;
  expiresAt: string;
  sessionId: string;
  readOnly: true;
}

/** Start a view-only session for a new window (`handoff: true`): checked, recorded and announced as any session. */
export const startViewAs = (userId: string, reason: string) =>
  api<ViewAsStarted>(`/admin/impersonate/${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: { reason, handoff: true },
  });

/** The new window takes up its session: the code, once, as the Super Admin who started it. */
export const redeemViewAs = (code: string) =>
  api<ViewAsSession>('/admin/impersonate/handoff', { method: 'POST', body: { code } });

/** The new window's address: the code in the fragment, so no server's log ever reads it. */
export const viewAsUrl = (code: string) => `${VIEW_AS_PATH}#${encodeURIComponent(code)}`;

/**
 * ***Buka jendela baru*** — called **synchronously from the click**: the window is opened first, inside the gesture,
 * which is the only moment a browser lets a page open one; then the session is started and the window sent to its
 * one-time address. The window is cut loose from this tab (`opener = null`), so nothing in it can reach the console.
 *
 * - The browser blocks the window: `ViewAsBlocked`, and no session is started.
 * - The start is refused (another Super Admin, an office suspended, no reason …): the window is closed and the refusal
 *   rethrown as it came — an `ApiRequestError` the card shows through `toDisplayError`.
 */
export async function openViewAsWindow(target: { userId: string; fullName: string }, reason: string): Promise<void> {
  const opened = window.open('', '_blank');
  if (!opened) throw new ViewAsBlocked();
  try {
    opened.opener = null;
    // A word while the session starts, rather than a blank white window (the window is ours: same origin, empty).
    opened.document.title = target.fullName;
  } catch {
    // A browser that will not let us touch it still gets its address below.
  }
  let started: ViewAsStarted;
  try {
    started = await startViewAs(target.userId, reason);
  } catch (err) {
    opened.close();
    throw err;
  }
  // Absolute: a relative address would be read against the blank window's own, which has none worth trusting.
  opened.location.href = `${window.location.origin}${viewAsUrl(started.handoffCode)}`;
}

/**
 * **This tab is a view-as window** — set by `/view-as` once it has taken up its session, so *Selesai* on the bar
 * (`ImpersonationBanner`) closes the window after ending the session, rather than turning it into a second console.
 * Memory only: after a reload the window is the Super Admin's own again, the session gone from it.
 */
let viewAsWindow = false;

export function markViewAsWindow(): void {
  viewAsWindow = true;
}

export function isViewAsWindow(): boolean {
  return viewAsWindow;
}
