import type { Me } from './session';

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

  // Running the office.
  if (membership.isKpmOwner || membership.isKpmAdmin) return '/kpm/overview';

  // Leading people — by the graph, not the role (OD-23). An AAB with no reports has no
  // unit to look at, and lands where their own work is instead.
  // if (membership.directCount > 0) return '/unit/dashboard';

  // Everyone else: their own day.
  return '/activity/log';
}
