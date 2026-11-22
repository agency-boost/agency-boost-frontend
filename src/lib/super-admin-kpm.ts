'use client';

/**
 * **The KPM a Super Admin is working inside** (ADR-0268 §3; P19.17 F2; the client's `PERMISSIONS.md` of 19 November and
 * the Super Admin spec of 20 November, §5 *Inside a KPM*).
 *
 * A Super Admin is the KPM Owner in every KPM, with no limits and no approval. While they are inside one, every request
 * the app sends names it in the **`X-Kpm-Id`** header (`api-client.ts`), and the API answers them as that KPM's Owner —
 * `GET /auth/me`'s `permissions` included — and records each change in that KPM's audit log with the Super Admin as the
 * actor. The API honours the header for a Super Admin alone and ignores it for anybody else, so it grants nothing by
 * itself; `route-access.ts` reads `insideKpm` to admit the Super Admin to the office's pages.
 *
 * **Not *Lihat sebagai*.** A support session acts as a member and only looks; this is the Super Admin acting as
 * themselves. The platform's own routes (`/admin/…`) are never sent the header: they are the platform's, in no KPM.
 *
 * Held per browser tab (`sessionStorage`), so a reload stays inside the KPM and another tab can be in another one. The
 * screens that enter and leave a KPM — the KPM switcher and the floating bar — come with the Super Admin's console;
 * this is their plumbing.
 */

/** The header the API reads (`backend/src/common/auth/auth.guard.ts`, `KPM_HEADER`). */
export const KPM_HEADER = 'X-Kpm-Id';

const STORAGE_KEY = 'agencyboost.superAdminKpm';
/** A KPM's id: a MongoDB ObjectId, 24 hexadecimal characters. Anything else is never sent. */
const KPM_ID = /^[0-9a-f]{24}$/i;

function stored(): string | null {
  try {
    const value = typeof window === 'undefined' ? null : window.sessionStorage.getItem(STORAGE_KEY);
    return value !== null && KPM_ID.test(value) ? value : null;
  } catch {
    // Storage refused (a private window, a blocked site): the tab simply starts outside every KPM.
    return null;
  }
}

function store(value: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (value === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Kept in memory for this page's life: the next reload starts outside, which is the safe direction.
  }
}

let entered: string | null = stored();
const listeners = new Set<(kpmId: string | null) => void>();

function announce(): void {
  for (const listener of listeners) listener(entered);
}

/** **Enter a KPM**: every request from now on is the Super Admin as its Owner. A malformed id is refused. */
export function enterKpm(kpmId: string): void {
  if (!KPM_ID.test(kpmId)) throw new Error(`Not a KPM id: ${kpmId}`);
  if (entered === kpmId) return;
  entered = kpmId;
  store(kpmId);
  announce();
}

/** **Leave the KPM**: back to the platform, in no KPM. Leaving when outside one changes nothing. */
export function leaveKpm(): void {
  if (entered === null) return;
  entered = null;
  store(null);
  announce();
}

/** The KPM entered in this tab, or `null` outside every KPM. */
export function enteredKpmId(): string | null {
  return entered;
}

/** Told whenever the KPM entered changes — the session re-reads `GET /auth/me` on it. Answers the unsubscribe. */
export function onKpmChange(listener: (kpmId: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * **The header a request carries**: `X-Kpm-Id` while a KPM is entered, and never on a platform route (`/admin/…`), which
 * is the Super Admin's own, in no KPM.
 */
export function kpmHeaderFor(path: string): Record<string, string> {
  if (entered === null || /^\/admin(\/|$|\?)/.test(path)) return {};
  return { [KPM_HEADER]: entered };
}

/**
 * **Is this reader a Super Admin working inside a KPM** — signed in as a Super Admin, as themselves (a support session is
 * a member's), with a KPM entered in this tab? What `route-access.ts` admits to the office's pages.
 */
export function insideKpm(me: { user: { platformRole: string }; isImpersonating?: boolean }): boolean {
  return me.user.platformRole === 'super_admin' && !me.isImpersonating && entered !== null;
}
