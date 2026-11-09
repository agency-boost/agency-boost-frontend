import { isUnder } from './field-nav';
import type { Me } from './session';

/**
 * **Where somebody in no office yet may go** (UI-166; ADR-0189 §5): the pages that are how one joins an office or are
 * the person's own — *User Management* (*Daftar KPM*, *Cari leader*), *Profil saya*, the inbox and an invite. Every
 * other field page needs a KPM, and shows `NoKpmYet` in its place without being mounted, so it asks the API for nothing
 * a person in no office cannot read.
 */
export const NO_KPM_ROUTES: readonly string[] = ['/user-management', '/profile', '/notifications', '/join'];

/**
 * **Somebody signed in who is not in an office yet**, and no Super Admin: who `NoKpmYet` is for — with no membership at
 * all (*Stefan, no KPM yet*), or one not active: registered to an office and waiting for a leader to accept them
 * (UI-166's staging case, *Registered, asked nobody*), or removed. Every office read refuses them alike.
 */
export function hasNoKpm(me: Me | null | undefined): boolean {
  if (!me || me.user.platformRole === 'super_admin') return false;
  return me.membership === null || me.membership.status !== 'active';
}

/** A page that needs a KPM, for this reader at this address: everything but `NO_KPM_ROUTES`. */
export function needsKpmHere(me: Me | null | undefined, pathname: string): boolean {
  return hasNoKpm(me) && !NO_KPM_ROUTES.some((route) => isUnder(pathname, route));
}
