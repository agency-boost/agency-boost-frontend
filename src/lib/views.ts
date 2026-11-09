import { useCallback, useSyncExternalStore } from 'react';
import { forgetInFlight } from './in-flight';
import { HOME, OFFICE_LANDING } from './landing';
import type { Me } from './session';

/**
 * **A person's views, and which one this tab is in** (P19.2-T1 AC-4 to AC-7; UI-169 items 1–4, UI-147;
 * [ADR-0198](../../../docs/04-adr/0198-a-person-switches-between-their-own-views-from-the-avatar-menu.md)).
 *
 * **A view is a menu, never a permission** (ADR-0198 §1). It decides which menu the shell draws, where a switch lands
 * and what the header names — nothing else. It is not in the token, it is never sent to the API, and no route, grant or
 * refusal depends on it: the server grants the union of the person's roles, per request, as it always has
 * (`roles-and-permissions.md` §1.1). A reader who types an office address from *Akun saya* is answered by the server
 * exactly as one who switched first.
 *
 * Pure where it can be — the kinds, the landing, which view a page belongs to — and a small per-tab store for the one
 * thing that is state: the view this browser tab is in (`sessionStorage`, a per-tab convenience).
 */

/**
 * The four views (ADR-0198 §1), named as `GET /auth/me`'s `linkedLogin.views` names them (ADR-0199 §3), so a linked
 * login's views are the same kinds:
 * - `self`: ***Akun saya*** — everybody with a membership, the Owner and the Admin included, and somebody in no office;
 * - `kpm_owner`: ***KPM Owner · <nama KPM>*** — the office's Owner;
 * - `kpm_admin`: ***KPM Admin · <nama KPM>*** — an Admin who is not the Owner;
 * - `super_admin`: ***Superadmin*** — a Super Admin login, which belongs to no office.
 */
export type ViewKind = 'self' | 'kpm_owner' | 'kpm_admin' | 'super_admin';

const KINDS: readonly ViewKind[] = ['self', 'kpm_owner', 'kpm_admin', 'super_admin'];

/** The office view, in either of its two names. */
export function isOfficeView(kind: ViewKind): boolean {
  return kind === 'kpm_owner' || kind === 'kpm_admin';
}

/**
 * **Where a view lands** (ADR-0198 §4): *Akun saya* on Home, the office view on the KPM Overview (`OFFICE_LANDING` keeps
 * its name), *Superadmin* on `/admin`. A switch always lands here, whatever page it is pressed on — so switching from the
 * office view to *Akun saya* on `/kpm/overview` lands on Home (P19.2-T1 AC-7).
 */
export const VIEW_LANDING: Readonly<Record<ViewKind, string>> = {
  self: HOME,
  kpm_owner: OFFICE_LANDING,
  kpm_admin: OFFICE_LANDING,
  super_admin: '/admin',
};

/**
 * **The views one login has, in the switcher's order** (ADR-0198 §1, §3): *Akun saya* · the office entry · *Superadmin*.
 *
 * - A Super Admin login has *Superadmin* alone: it is a user flag and belongs to no office.
 * - An active Owner has *Akun saya* and *KPM Owner*; an active Admin who is not the Owner *Akun saya* and *KPM Admin* —
 *   somebody who is the Owner and holds admin access is the Owner, as the console's chip always named them.
 * - Everybody else — an AB, an AAB, an Agent, a pending member, somebody in no office — has *Akun saya* alone.
 *
 * **One login has at most two** (one active membership per user). More come only from a linked login (ADR-0199),
 * whose views `GET /auth/me` carries as `linkedLogin.views` — P19.2-T1 AC-8, which adds them in `switcherFor`.
 * Inside a support session `me` is the member's, so the member's own views are offered (ADR-0198 §6).
 */
export function viewKindsOf(me: Me | null | undefined): ViewKind[] {
  if (!me) return ['self'];
  if (me.user.platformRole === 'super_admin') return ['super_admin'];
  const membership = me.membership;
  if (!membership || membership.status !== 'active') return ['self'];
  if (membership.isKpmOwner) return ['self', 'kpm_owner'];
  if (membership.isKpmAdmin) return ['self', 'kpm_admin'];
  return ['self'];
}

/** Whether `pathname` is `href` or a page beneath it (as `field-nav.ts`'s `isUnder`, which imports this module). */
function under(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * **A page that belongs to the office view** (ADR-0198 §5): every `/kpm/*` and `/people/*` page. A link or a typed
 * address to one shows the office view's menu and header, and sets the tab's view, so the field and shared pages
 * opened after it keep it. Every other page keeps the tab's view.
 */
export function isOfficePage(pathname: string): boolean {
  return under(pathname, '/kpm') || under(pathname, '/people');
}

/**
 * **Which view a page is in** (ADR-0198 §5): a person with one view is always in it; an office page is in the office
 * view; any other page in the view the tab remembers, when it is one the person has; otherwise *Akun saya*. With storage
 * refused nothing is remembered across a reload, and the page decides the same way: an office page is in the office
 * view, every other page in *Akun saya*.
 */
export function resolveView(kinds: readonly ViewKind[], remembered: ViewKind | null, pathname: string): ViewKind {
  const [first] = kinds;
  if (kinds.length === 1) return first;
  const office = kinds.find(isOfficeView);
  if (office && isOfficePage(pathname)) return office;
  if (remembered && kinds.includes(remembered)) return remembered;
  return first;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The tab's view: `sessionStorage`, one key, every read and write in try/catch.                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Where the tab's view lives: `sessionStorage`, so it is this tab's — another tab, or a new window, starts on its own. */
export const VIEW_KEY = 'ab.view';

/**
 * **The tab's view while storage is refused** — a private window, storage switched off. Kept as long as this page of the
 * app lives, so a switch still holds as the reader moves around; gone on a reload, where the page decides
 * (`resolveView`). Never a fallback that outlives the tab: it is a variable, not storage.
 */
let held: ViewKind | null = null;
/** Bumped by every switch: the shell's content is keyed by it, so every page and its reads start afresh (AC-7). */
let generation = 0;
const listeners = new Set<() => void>();

function isViewKind(value: unknown): value is ViewKind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value);
}

function tell(): void {
  for (const listen of listeners) listen();
}

function subscribe(listen: () => void): () => void {
  listeners.add(listen);
  return () => listeners.delete(listen);
}

/**
 * The view this tab remembers, or `null`. Storage is the one answer while it can be read; refused, the view held for
 * this page's life stands in.
 */
export function rememberedView(): ViewKind | null {
  try {
    const stored = window.sessionStorage.getItem(VIEW_KEY);
    return isViewKind(stored) ? stored : null;
  } catch {
    return held;
  }
}

/** Remember the tab's view. Storage refused, it is held for this page's life and the switch still works. */
export function rememberView(kind: ViewKind): void {
  held = kind;
  try {
    window.sessionStorage.setItem(VIEW_KEY, kind);
  } catch {
    // A private window, or storage switched off: `held` stands in until a reload.
  }
  tell();
}

/**
 * **Forget the tab's view** — signing in and signing out (ADR-0198 §5: sign-in sets *Akun saya*), so the next session
 * in this tab starts where a new one starts, on Home in *Akun saya*, whatever the last one was in.
 */
export function forgetView(): void {
  held = null;
  try {
    window.sessionStorage.removeItem(VIEW_KEY);
  } catch {
    // Nothing was stored.
  }
  tell();
}

/**
 * **Clear the client's cached reads** (ADR-0198 §6; P19.2-T1 AC-7): the reads still joining (`joinInFlight`) are let
 * go, and the shell's content, keyed by the switch's generation, mounts afresh — so every page, and every provider under
 * the shell, reads again in the new view and no figure of the old one is carried over.
 */
export function clearCachedReads(): void {
  forgetInFlight();
  generation += 1;
  tell();
}

/** The switch's generation, for the shell's key. */
export function useViewGeneration(): number {
  return useSyncExternalStore(subscribe, () => generation, () => 0);
}

/**
 * **The view this page is in, for this person, and a way to switch** (ADR-0198 §3 to §5). `null` from the store on the
 * server and on the first client render, so the two agree; the page decides then as it does with storage refused.
 */
export function useActiveView(me: Me | null | undefined, pathname: string): {
  kinds: ViewKind[];
  active: ViewKind;
  /** Switch to one of this login's views: remember it, clear the cached reads, and hand back the landing to go to. */
  switchTo: (kind: ViewKind) => string;
} {
  const remembered = useSyncExternalStore(subscribe, rememberedView, () => null);
  const kinds = viewKindsOf(me);
  const active = resolveView(kinds, remembered, pathname);
  const switchTo = useCallback((kind: ViewKind) => {
    rememberView(kind);
    clearCachedReads();
    return VIEW_LANDING[kind];
  }, []);
  return { kinds, active, switchTo };
}

/** For a spec: the tab as a new one, nothing remembered, no switch made. */
export function resetViewsForTest(): void {
  held = null;
  generation = 0;
  try {
    window.sessionStorage.removeItem(VIEW_KEY);
  } catch {
    // Nothing to clear.
  }
}
