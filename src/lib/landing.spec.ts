import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { landingFor } from './landing';
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

  it('prefers running the office over leading a unit, when both are true', () => {
    // An Owner is an AB at the root with a downline. Both branches match; the order
    // decides, and the office is the wider job.
    const both = member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5 });
    expect(landingFor(makeMe({ membership: both }))).toBe('/kpm/overview');
  });

  it('sends somebody who leads people to their own day, while the unit is a signpost', () => {
    /*
     * **The `/unit/dashboard` redirect is commented out in `landing.ts`** (`a47f4c8`), and this test
     * had gone on asserting it.
     *
     * The reason is worth keeping: `/unit/dashboard` is a `ComingInPhase` placeholder, and its nav item
     * *Upcoming* (P10.1-T2), so every AB and AAB signing in landed on a page that tells them to come
     * back later. Landing on work beats landing on a sign.
     *
     * **Restore the branch when the Unit Dashboard is built** — the route registry's *Placeholder
     * routes* table names the phase, P15-T4 when this was written — and this test with it. The rule it
     * encodes, that leading is the graph and not the role (OD-23), is unchanged and the test below
     * still holds it.
     */
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }) }))).toBe(
      '/activity/log',
    );
  });

  it('sends an AAB who leads nobody to their own day, not to an empty unit (OD-23)', () => {
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
