import type { Me } from './session';

/**
 * **Where the office view lands** (ADR-0198 §4): a switch to *KPM Owner* or *KPM Admin* opens here (`VIEW_LANDING`,
 * `lib/views.ts`). Until P19.2-T1 it was an Owner's or an Admin's sign-in landing (ADR-0070, OD-102); since UI-169 item 1
 * they sign in to Home, in *Akun saya*.
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
 * **The Owner and the Admin land here too** (P19.2-T1 AC-4; UI-169 item 1, UI-147; ADR-0198 §4): their own Home, in
 * *Akun saya* — an Admin who leads nobody sees Home as their rung gives it (ADR-0189). It answered ADR-0114's *Open agent
 * view* as well until P19.2-T1 removed it. The membership is still taken, so a later rule can read it again.
 */
export function fieldLandingFor(_membership: Pick<NonNullable<Me['membership']>, 'directCount'>): string {
  return HOME;
}

/**
 * Where a person goes after signing in.
 *
 * One function, because the answer is needed in three places — the landing route, the
 * login screen and the tests — and three copies would drift. It is pure, so the rule is
 * readable without running the app.
 *
 * The order matters and is not alphabetical: it runs from the most specific state to the
 * least, because several of these are true at once. A KPM Owner is also an AB with a
 * downline; a pending member is also somebody with an office.
 */
export function landingFor(me: Me | null): string {
  // Nobody signed in.
  if (!me) return '/login';

  // Platform first: a Super Admin belongs to no office, so nothing below applies.
  if (me.user.platformRole === 'super_admin') return '/admin';

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
   * **Running the office is no branch of its own any more** (P19.2-T1 AC-4; UI-169 item 1; ADR-0198 §4). An Owner or an
   * Admin signed in to `/kpm/overview` until UI-169 (ADR-0070, OD-102); now they land on their own Home, in *Akun saya*,
   * as every active member does, and reach the office view from the avatar menu (`lib/views.ts`).
   */

  /*
   * *A new hire in their 90 days, who led nobody, started on their activation* (P18.8-T3 AC-4, ADR-0170 §3) until UI V1:
   * **they land on Home too** (ADR-0180 §10, the owner's UI-100), where the field begins for everybody; their checklist
   * keeps its place in the *Lainnya* sheet and the sidebar (T1).
   */
  // Everyone else — leading people or nobody, a new hire or not, the office's Owner and its Admins — lands on Home.
  return fieldLandingFor(membership);
}
