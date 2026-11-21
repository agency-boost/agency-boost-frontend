import type { Me } from './session';
import { enteredKpmId, insideKpm } from './super-admin-kpm';

/**
 * **Where the Owner and the Admins land after signing in: the KPM Overview** (P19.17-T3 AC-8;
 * [ADR-0269](../../../docs/04-adr/0269-one-login-one-menu-one-title-row.md) §6; OD-381's default; the brief's *Landing page
 * stays KPM Overview*). It was a view switch's landing between P19.2-T1 and P19.17 (ADR-0198 §4), when they signed in to
 * Home; with one login there is no view to switch to, and the office's page is theirs again, as ADR-0070 and OD-102 had
 * it. The core leaders, who have the same *KPM* group, land on Home: the brief names the Owner's landing alone.
 */
export const OFFICE_LANDING = '/kpm/overview';

/** Home (UI-100): the field's landing, and the centre tab of the bar (`field-nav.ts`). */
export const HOME = '/home';

/**
 * A member's **field landing**: **Home** (`/home`), whoever they are in the field (UI V1, 2026-10-30, ADR-0180 §10).
 *
 * Until then it followed the graph — the Unit Dashboard for somebody with a direct report (P15-T4 AC-4, D-landing), the
 * reader's own day for somebody without — and a new hire in their 90 days who led nobody started on their activation
 * (P18.8-T3 AC-4, ADR-0170 §3). **Home answers all three now**: it is about the reader, and for somebody who leads it
 * carries *Active Agent*, *Coaching 7 hari* and the team's report list (UI-100, UI-101), so a leader loses nothing by
 * starting there and a new hire finds their 90 days one tile away in the *Lainnya* sheet.
 *
 * **Not the Owner's or the Admins'** since P19.17-T3 (ADR-0269 §6): `landingFor` answers them with the KPM Overview
 * before it asks this. The membership is still taken, so a later rule can read it again.
 */
export function fieldLandingFor(_membership: Pick<NonNullable<Me['membership']>, 'directCount'>): string {
  return HOME;
}

/**
 * Where a person goes after signing in.
 *
 * One function, because the answer is needed in three places — the landing route, the
 * login screen and the tests — and three copies would drift. It is pure but for one read, the KPM a Super Admin has
 * entered in this tab (`enteredKpmId`), so the rule is readable without running the app.
 *
 * The order matters and is not alphabetical: it runs from the most specific state to the
 * least, because several of these are true at once. A KPM Owner is also an AB with a
 * downline; a pending member is also somebody with an office.
 */
export function landingFor(me: Me | null): string {
  // Nobody signed in.
  if (!me) return '/login';

  /*
   * Platform first: a Super Admin belongs to no office, so nothing below applies. **Inside a KPM** (`super-admin-kpm.ts`)
   * their landing is that KPM's own page, never the Dashboard (found 2026-11-20): a page the KPM's Owner may not open —
   * a member's field page, *Buka profil*'s Personal Summary, the Unit Dashboard — sent them to `/admin`, whose page
   * leaves the KPM, so they were thrown out of it without being asked. `/admin/tenants/<id>` keeps the KPM entered.
   */
  if (me.user.platformRole === 'super_admin') {
    const kpmId = enteredKpmId();
    return kpmId !== null && insideKpm(me) ? `/admin/tenants/${kpmId}` : '/admin';
  }

  const membership = me.membership;

  // Registered nowhere. The one thing to do is find an office.
  if (!membership) return '/user-management/kpm';

  // Registered, waiting on a leader. Sending them to a dashboard would show a screen
  // about a unit they are not in yet; the thing they are waiting on is the leader
  // request, so that is where they land.
  if (membership.status === 'pending') return '/user-management/leader';

  // Left the office. In practice this arrives as no membership at all — the resolver
  // only hands out an active or pending one — and the branch above already answers that.
  // It is here so a removed membership constructed by hand gets the same answer as the
  // real path, instead of falling through to "log your activity" for an office the
  // person is no longer in. Re-joining creates a new membership; the old one stays put.
  if (membership.status === 'removed') return '/user-management/kpm';

  /*
   * **Running the office: the KPM Overview** (P19.17-T3 AC-8; ADR-0269 §6). An active Owner or Admin lands on the
   * office's page, as they did until P19.2-T1 (ADR-0070, OD-102) — one login now, so no view is chosen first. Somebody
   * who is the Owner of an office and pending, or removed, was answered above.
   */
  if (membership.isKpmOwner || membership.isKpmAdmin) return OFFICE_LANDING;

  /*
   * *A new hire in their 90 days, who led nobody, started on their activation* (P18.8-T3 AC-4, ADR-0170 §3) until UI V1:
   * **they land on Home too** (ADR-0180 §10, the owner's UI-100), where the field begins for everybody; their checklist
   * keeps its place in the *Lainnya* sheet and the sidebar (T1).
   */
  // Everyone else — leading people or nobody, a new hire or not, a core leader — lands on Home.
  return fieldLandingFor(membership);
}
