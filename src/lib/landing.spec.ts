import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { fieldLandingFor, landingFor, OFFICE_LANDING, viewSwitchFor } from './landing';
import type { Me } from './session';

/** The membership shape, with only what a given case is about spelled out. */
function member(over: Partial<NonNullable<Me['membership']>> = {}): Me['membership'] {
  return {
    membershipId: 'mem-1',
    kpmId: 'kpm-1',
    orgLevelCode: 'AGENT', hierarchyRole: 'agent',
    status: 'active',
    isKpmOwner: false,
    isKpmAdmin: false,
    directCount: 0,
    ...over,
  };
}

const superAdmin = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
});

describe('where signing in takes you', () => {
  it('sends nobody to the sign-in page', () => {
    expect(landingFor(null)).toBe('/login');
  });

  it('sends a Super Admin to the platform console', () => {
    // Checked before anything about offices, because they belong to none.
    expect(landingFor(superAdmin)).toBe('/admin');
  });

  it('sends somebody in no office to find one', () => {
    expect(landingFor(makeMe({ membership: null }))).toBe('/user-management/kpm');
  });

  it('sends somebody waiting on a leader to the thing they are waiting on', () => {
    // Not to a dashboard: that would be a screen about a unit they are not in yet.
    expect(landingFor(makeMe({ membership: member({ status: 'pending' }) }))).toBe(
      '/user-management/leader',
    );
  });

  it('sends somebody who has left to find an office, the same as somebody with none', () => {
    // In practice they arrive with no membership at all — the resolver only hands out an
    // active or pending one — so this is the same answer by a different route. It is
    // asserted so a removed membership constructed by hand cannot fall through to "log
    // your activity" for an office the person is no longer in.
    expect(landingFor(makeMe({ membership: member({ status: 'removed' }) }))).toBe(
      '/user-management/kpm',
    );
  });

  it('sends a KPM Owner to their office', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, directCount: 3 }) }))).toBe(
      '/kpm/overview',
    );
  });

  it('sends a KPM Admin to the same place', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true }) }))).toBe('/kpm/overview');
  });

  it('P11-T6 AC-8 prefers running the office over leading a unit, when both are true (OD-102)', () => {
    // An Owner is an AB at the root with a downline. Both branches match; the order
    // decides, and the office is the wider job. The roster does not change it, and nor does
    // an Admin who also leads people.
    const both = member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5 });
    expect(landingFor(makeMe({ membership: both }))).toBe('/kpm/overview');
    const adminLeader = member({ isKpmAdmin: true, orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 });
    expect(landingFor(makeMe({ membership: adminLeader }))).toBe('/kpm/overview');
  });

  it('P11-T6 AC-8 sends somebody who leads people to the roster of everyone they coach', () => {
    /*
     * The leader branch was commented out (`a47f4c8`) while the only leader screen was the Unit
     * Dashboard's sign: landing on work beats landing on a page that says come back later. The roster
     * is built, so a leader lands there. `/unit/dashboard` is still a sign, and is not where anybody
     * lands.
     */
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }) }))).toBe(
      '/coaching',
    );
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 1 }) }))).toBe(
      '/coaching',
    );
  });

  it('P11-T6 AC-8 leads by the graph, not the rung: an Agent with a report is a leader too (OD-23)', () => {
    // Whatever the rung says, a direct report is what makes a leader. A rule keyed on the role label
    // would send this member to their log and an AB with nobody to the roster.
    expect(landingFor(makeMe({ membership: member({ directCount: 1 }) }))).toBe('/coaching');
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 0 }) }))).toBe(
      '/activity/log',
    );
  });

  it('P11-T6 AC-8 sends an AAB who leads nobody to their own day, not to an empty roster (OD-23)', () => {
    // Leading is the graph, not the role. A childless AAB has no unit to look at.
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 }) }))).toBe(
      '/activity/log',
    );
  });

  it('sends an agent to their own day', () => {
    expect(landingFor(makeMe({ membership: member() }))).toBe('/activity/log');
  });

  it('lets a pending membership win over any role it carries', () => {
    // The order runs most specific first: several of these are true at once, and being
    // unapproved outranks being an AB.
    const pendingAb = member({ status: 'pending', orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 });
    expect(landingFor(makeMe({ membership: pendingAb }))).toBe('/user-management/leader');
  });
});

describe('the field landing, one function for sign-in and the view switch (P13.2-T5 AC-1, ADR-0114)', () => {
  it('P13.2-T5 AC-1 is the roster with a direct report, and the reader’s own day without', () => {
    expect(fieldLandingFor({ directCount: 3 })).toBe('/coaching');
    expect(fieldLandingFor({ directCount: 1 })).toBe('/coaching');
    expect(fieldLandingFor({ directCount: 0 })).toBe('/activity/log');
  });

  it('P13.2-T5 AC-1 is exactly where landingFor sends every active member who does not run the office', () => {
    // The landing order's last branch *is* the function: no second copy of the rule to drift.
    for (const directCount of [0, 1, 4]) {
      for (const [orgLevelCode, hierarchyRole] of [['AB', 'ab'], ['AAB', 'aab'], ['AGENT', 'agent']] as const) {
        const m = member({ orgLevelCode, hierarchyRole, directCount });
        expect(landingFor(makeMe({ membership: m }))).toBe(fieldLandingFor(m!));
      }
    }
  });

  it('P13.2-T5 AC-4 leaves sign-in as it was: an Owner and an Admin land on the console, reports or none', () => {
    // ADR-0114: the switch is a link, not a mode. Signing in does not read it.
    for (const directCount of [0, 3]) {
      expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, directCount }) }))).toBe(OFFICE_LANDING);
      expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true, directCount }) }))).toBe(OFFICE_LANDING);
    }
    expect(OFFICE_LANDING).toBe('/kpm/overview');
  });
});

describe('the view switch (P13.2-T5 AC-1, AC-2, AC-5; ADR-0114)', () => {
  const owner = (directCount = 3) => makeMe({
    membership: member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount }),
  });
  const admin = (directCount = 0) => makeMe({
    membership: member({ isKpmAdmin: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount }),
  });

  it('P13.2-T5 AC-1 offers an Owner, in the console, Open agent view to their field landing', () => {
    expect(viewSwitchFor(owner(3), 'office')).toEqual({ label: 'Open agent view', href: '/coaching' });
    expect(viewSwitchFor(owner(0), 'office')).toEqual({ label: 'Open agent view', href: '/activity/log' });
  });

  it('P13.2-T5 AC-1 offers an Admin the same, to their own field landing', () => {
    expect(viewSwitchFor(admin(0), 'office')).toEqual({ label: 'Open agent view', href: '/activity/log' });
    expect(viewSwitchFor(admin(2), 'office')).toEqual({ label: 'Open agent view', href: '/coaching' });
  });

  it('P13.2-T5 AC-2 offers an Owner, in the field view, Open Owner view to the console', () => {
    expect(viewSwitchFor(owner(), 'field')).toEqual({ label: 'Open Owner view', href: '/kpm/overview' });
  });

  it('P13.2-T5 AC-2 offers an Admin who is not the Owner Open Admin view, to the same place', () => {
    expect(viewSwitchFor(admin(), 'field')).toEqual({ label: 'Open Admin view', href: '/kpm/overview' });
  });

  it('P13.2-T5 AC-2 names somebody who is both the Owner, as the console’s chip does', () => {
    const both = makeMe({ membership: member({ isKpmOwner: true, isKpmAdmin: true, directCount: 1 }) });
    expect(viewSwitchFor(both, 'field')?.label).toBe('Open Owner view');
  });

  it('P13.2-T5 AC-2 offers no field role either link, in either shell', () => {
    for (const [orgLevelCode, hierarchyRole, directCount] of [
      ['AB', 'ab', 4], ['AB', 'ab', 0], ['AAB', 'aab', 2], ['AAB', 'aab', 0], ['AGENT', 'agent', 1], ['AGENT', 'agent', 0],
    ] as const) {
      const me = makeMe({ membership: member({ orgLevelCode, hierarchyRole, directCount }) });
      expect([orgLevelCode, directCount, viewSwitchFor(me, 'office')]).toEqual([orgLevelCode, directCount, null]);
      expect([orgLevelCode, directCount, viewSwitchFor(me, 'field')]).toEqual([orgLevelCode, directCount, null]);
    }
  });

  it('P13.2-T5 AC-2 offers nobody signed in, nobody in an office, and a Super Admin nothing', () => {
    for (const me of [null, makeMe({ membership: null }), superAdmin]) {
      expect(viewSwitchFor(me, 'office')).toBeNull();
      expect(viewSwitchFor(me, 'field')).toBeNull();
    }
  });

  it('P13.2-T5 AC-2 offers a membership that is not active nothing, as landingFor sends it elsewhere', () => {
    for (const status of ['pending', 'removed'] as const) {
      const me = makeMe({ membership: member({ isKpmOwner: true, status, directCount: 2 }) });
      expect(viewSwitchFor(me, 'office')).toBeNull();
      expect(viewSwitchFor(me, 'field')).toBeNull();
    }
  });

  it('P13.2-T5 AC-5 offers a support session impersonating an Owner the Owner’s links, read-only or not', () => {
    // The session is the Owner's, as `/auth/me` answers it during a support session (§3.13). The links
    // grant nothing: every field route keeps its guard, and a read-only session still writes nothing.
    for (const impersonationReadOnly of [true, false]) {
      const supporting = { ...owner(3), isImpersonating: true, impersonationReadOnly, impersonatedBy: 'u-support' };
      expect(viewSwitchFor(supporting, 'office')).toEqual({ label: 'Open agent view', href: '/coaching' });
      expect(viewSwitchFor(supporting, 'field')).toEqual({ label: 'Open Owner view', href: '/kpm/overview' });
    }
  });
});
