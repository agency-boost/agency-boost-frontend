import { messagesIn } from '@/i18n/catalogue';
import { SOURCE_LANGUAGE, type Language } from '@/i18n/language';
import { shellMessages } from '@/i18n/messages/shell';
import type { Me } from './session';

/**
 * Where the office console starts: an Owner's or an Admin's landing (ADR-0070), and where the field
 * view's *Open Owner view* or *Open Admin view* goes back to (ADR-0114).
 */
export const OFFICE_LANDING = '/kpm/overview';

/** Home (UI-100): the field's landing, and the centre tab of the bar (`field-nav.ts`). */
export const HOME = '/home';

/**
 * A member's **field landing**: **Home** (`/home`), whoever they are in the field (UI V1, 2026-10-30, ADR-0180 §10).
 *
 * Until then it followed the graph — the Unit Dashboard for somebody with a direct report (P15-T4 AC-4, D-landing), the
 * reader's own day for somebody without — and a new hire in their 90 days who led nobody started on their activation
 * (P18.96-T3 AC-4, ADR-0170 §3). **Home answers all three now**: it is about the reader, and for somebody who leads it
 * carries *Active Agent*, *Coaching 7 hari* and the team's report list (UI-100, UI-101), so a leader loses nothing by
 * starting there and a new hire finds their 90 days one tile away in the *Lainnya* sheet.
 *
 * One function for two callers (ADR-0114): `landingFor`'s last branch, and the office console's *Open agent view*,
 * which takes an Owner or an Admin to the field screen a member of their rung would have signed in to. So both land on
 * Home together: two copies of the rule are how the link and the sign-in would come to disagree. The Owner and the
 * Admin still sign in to the console. The membership is still taken, so a later rule can read it again.
 */
export function fieldLandingFor(_membership: Pick<NonNullable<Me['membership']>, 'directCount'>): string {
  return HOME;
}

/** A link from one view of the app to the other (ADR-0114): where it goes, and what it says. */
export interface ViewSwitch {
  href: string;
  label: string;
}

/**
 * **The view switch** (ADR-0114): the one link in the identity menu that crosses between the office
 * console and the field view, or `null` for a reader who has only one of them.
 *
 * - From the **office** console (the tenant shell), an Owner or an Admin is offered *Open agent view*, to
 *   their field landing.
 * - From the **field** view (the agent shell), an Owner is offered *Open Owner view* and an Admin who is
 *   not the Owner *Open Admin view*, both to the console's landing.
 *
 * Nobody else sees either: a field member has no console, and a Super Admin has no office. A support
 * session impersonating an Owner reads that Owner's session and is offered the same links. **No
 * permission follows from it**: every field route already answers an Owner or an Admin by their rung's
 * grants, and every one keeps its own guard — the link decides what is offered, never what is allowed.
 * Sign-in is unchanged, `landingFor` still sends both to the console.
 *
 * **Its words are the reader's** (P18.98-T1): the shells pass `useLanguage()`; English by default, as its spec reads.
 */
export function viewSwitchFor(
  me: Me | null,
  from: 'office' | 'field',
  language: Language = SOURCE_LANGUAGE,
): ViewSwitch | null {
  const membership = me?.membership;
  // Only an active membership has both views; a pending or removed one lands elsewhere (`landingFor`).
  if (!membership || membership.status !== 'active') return null;
  const t = messagesIn(shellMessages, language);
  if (from === 'office') {
    return membership.isKpmOwner || membership.isKpmAdmin
      ? { href: fieldLandingFor(membership), label: t.openAgentView }
      : null;
  }
  // The Owner first: somebody who is both is the Owner, as the console's chip already names them.
  if (membership.isKpmOwner) return { href: OFFICE_LANDING, label: t.openOwnerView };
  if (membership.isKpmAdmin) return { href: OFFICE_LANDING, label: t.openAdminView };
  return null;
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

  // Running the office. Since ADR-0114 an Owner or an Admin reaches their field view from the
  // console's identity menu; signing in still brings them here.
  if (membership.isKpmOwner || membership.isKpmAdmin) return OFFICE_LANDING;

  /*
   * *A new hire in their 90 days, who led nobody, started on their activation* (P18.96-T3 AC-4, ADR-0170 §3) until UI V1:
   * **they land on Home too** (ADR-0180 §10, the owner's UI-100), where the field begins for everybody; their checklist
   * keeps its place in the *Lainnya* sheet and the sidebar (T1).
   */
  // Everyone else — leading people or nobody, a new hire or not — lands on Home. The same function answers the
  // console's *Open agent view*.
  return fieldLandingFor(membership);
}
