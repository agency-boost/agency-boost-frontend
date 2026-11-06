import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { fieldLandingFor, landingFor, OFFICE_LANDING } from './landing';
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

  it('P19.2-T1 AC-4 sends a KPM Owner to their own Home, in Akun saya (UI-169 item 1; their office until then)', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, directCount: 3 }) }))).toBe('/home');
  });

  it('P19.2-T1 AC-4 sends a KPM Admin to their own Home too, an Admin who leads nobody included (ADR-0189)', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true }) }))).toBe('/home');
  });

  it('P19.2-T1 AC-4 running the office is no branch of its own: the Owner and the Admin take the field member’s row', () => {
    // OD-102 sent both to the office (P11-T6 AC-8); ADR-0198 §4 moves them to Home, by the same function as every member.
    const both = member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5 });
    expect(landingFor(makeMe({ membership: both }))).toBe(fieldLandingFor(both!));
    const adminLeader = member({ isKpmAdmin: true, orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 });
    expect(landingFor(makeMe({ membership: adminLeader }))).toBe(fieldLandingFor(adminLeader!));
    // A pending or removed Owner is still answered by the status first.
    expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, status: 'pending' }) }))).toBe('/user-management/leader');
  });

  it('UI-100 (ADR-0180 §10) sends somebody who leads people to Home, no longer the Unit Dashboard', () => {
    // Home carries a leader's Active Agent, Coaching 7 hari and the team's report list: a leader loses nothing there.
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }) }))).toBe('/home');
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 1 }) }))).toBe('/home');
    // An Agent with a report, and an AB with nobody: the same Home — the graph no longer splits the landing.
    expect(landingFor(makeMe({ membership: member({ directCount: 1 }) }))).toBe('/home');
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 0 }) }))).toBe('/home');
  });

  it('UI-100 sends an AAB who leads nobody, and an agent, to Home rather than their log', () => {
    expect(landingFor(makeMe({ membership: member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 }) }))).toBe('/home');
    expect(landingFor(makeMe({ membership: member() }))).toBe('/home');
  });

  it('UI-100 sends a new hire in their 90 days to Home too — reversing P18.8-T3 AC-4 (ADR-0180 §10)', () => {
    const hire = member({ directCount: 0 });
    for (const activation of [{ open: true, complete: false }, { open: true, complete: true }, { open: false, complete: true }]) {
      expect(landingFor(makeMe({ membership: hire, activation }))).toBe('/home');
    }
    expect(landingFor(makeMe({ membership: member({ directCount: 2 }), activation: { open: true, complete: false } }))).toBe('/home');
    // The office's people sign in to Home as well since P19.2-T1 (UI-169 item 1).
    expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true }), activation: { open: true, complete: false } }))).toBe('/home');
  });

  it('lets a pending membership win over any role it carries', () => {
    // The order runs most specific first: several of these are true at once, and being
    // unapproved outranks being an AB.
    const pendingAb = member({ status: 'pending', orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 });
    expect(landingFor(makeMe({ membership: pendingAb }))).toBe('/user-management/leader');
  });
});

describe('the field landing, one function for every active member (P13.2-T5 AC-1; P19.2-T1 AC-4)', () => {
  it('UI-100 is Home, with a direct report or without (ADR-0180 §10)', () => {
    expect(fieldLandingFor({ directCount: 3 })).toBe('/home');
    expect(fieldLandingFor({ directCount: 1 })).toBe('/home');
    expect(fieldLandingFor({ directCount: 0 })).toBe('/home');
  });

  it('P19.2-T1 AC-4 is exactly where landingFor sends every active member, the Owner and the Admin included', () => {
    // The landing order's last branch *is* the function: no second copy of the rule to drift.
    for (const directCount of [0, 1, 4]) {
      for (const [orgLevelCode, hierarchyRole] of [['AB', 'ab'], ['AAB', 'aab'], ['AGENT', 'agent']] as const) {
        for (const office of [{}, { isKpmOwner: true }, { isKpmAdmin: true }]) {
          const m = member({ orgLevelCode, hierarchyRole, directCount, ...office });
          expect(landingFor(makeMe({ membership: m }))).toBe(fieldLandingFor(m!));
        }
      }
    }
  });

  it('P19.2-T1 AC-4 where each reader signs in: Home for every member, /admin for a Super Admin', () => {
    // One table for the exit review (UI-147, UI-169 item 1). The office view is reached from the avatar menu
    // (`lib/views.ts`), and its landing, `OFFICE_LANDING`, is a switch's, never a sign-in's.
    const cases = [
      ['an AB who leads people', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }), '/home'],
      ['an AAB who leads nobody', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 }), '/home'],
      ['an Agent', member(), '/home'],
      ['the Owner, leading people', member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5 }), '/home'],
      ['the Owner, leading nobody', member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 0 }), '/home'],
      ['the Admin, leading people', member({ isKpmAdmin: true, orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1 }), '/home'],
      ['the Admin, leading nobody', member({ isKpmAdmin: true, directCount: 0 }), '/home'],
    ] as const;
    for (const [who, m, signIn] of cases) {
      expect([who, landingFor(makeMe({ membership: m }))]).toEqual([who, signIn]);
    }
    expect(landingFor(superAdmin)).toBe('/admin');
    expect(OFFICE_LANDING).toBe('/kpm/overview');
  });

  it('P19.2-T1 AC-3 offers no view switch link any more: viewSwitchFor is gone (UI-147, UI-169 item 3)', async () => {
    const landing = await import('./landing');
    expect('viewSwitchFor' in landing).toBe(false);
  });
});
