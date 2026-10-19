import type { Me } from './session';

/**
 * Where the office console starts: an Owner's or an Admin's landing (ADR-0070), and where the field
 * view's *Open Owner view* or *Open Admin view* goes back to (ADR-0114).
 */
export const OFFICE_LANDING = '/kpm/overview';

/**
 * A member's **field landing**: their unit's dashboard when they lead somebody, their own day when they
 * lead nobody.
 *
 * Leading is the graph, not the rung (OD-23, ADR-0087): a direct report is what makes a leader. A
 * leader lands on the Unit Dashboard (P15-T4 AC-4, D-landing), the roster of their whole unit, which is
 * built now; until it was, they landed on the coaching roster (P11-T6 AC-8). An AAB with no reports has
 * no unit to look at, and lands where their own work is instead.
 *
 * One function for two callers (ADR-0114): `landingFor`'s last branch, and the office console's *Open
 * agent view*, which takes an Owner or an Admin to the field screen a member of their rung would have
 * signed in to. So both moved to the Unit Dashboard together: two copies of the rule are how the link
 * and the sign-in would come to disagree. The Owner and the Admin still sign in to the console.
 */
export function fieldLandingFor(membership: Pick<NonNullable<Me['membership']>, 'directCount'>): string {
  return membership.directCount > 0 ? '/unit/dashboard' : '/activity/log';
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
 */
export function viewSwitchFor(me: Me | null, from: 'office' | 'field'): ViewSwitch | null {
  const membership = me?.membership;
  // Only an active membership has both views; a pending or removed one lands elsewhere (`landingFor`).
  if (!membership || membership.status !== 'active') return null;
  if (from === 'office') {
    return membership.isKpmOwner || membership.isKpmAdmin
      ? { href: fieldLandingFor(membership), label: 'Open agent view' }
      : null;
  }
  // The Owner first: somebody who is both is the Owner, as the console's chip already names them.
  if (membership.isKpmOwner) return { href: OFFICE_LANDING, label: 'Open Owner view' };
  if (membership.isKpmAdmin) return { href: OFFICE_LANDING, label: 'Open Admin view' };
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

  // Everyone else: leading people, by the graph and not the role, lands on the Unit Dashboard;
  // leading nobody, on their own day. The same function answers the console's *Open agent view*.
  return fieldLandingFor(membership);
}
