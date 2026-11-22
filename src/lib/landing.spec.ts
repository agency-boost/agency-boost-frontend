import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { fieldLandingFor, landingFor, OFFICE_LANDING } from './landing';
import { enterKpm, leaveKpm } from './super-admin-kpm';
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

const KPM = '66f0000000000000000002a1';

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

  /*
   * Found 2026-11-20: a Super Admin inside a KPM who opened a page its Owner may not — *Buka profil*'s Personal Summary,
   * the Unit Dashboard — was sent to `/admin`, whose page leaves the KPM: thrown out of it, never asked. Their landing
   * inside is the KPM's own page, which keeps it entered.
   */
  it('keeps a Super Admin inside a KPM in it: the KPM’s own page, never the Dashboard', () => {
    enterKpm(KPM);
    try {
      expect(landingFor(superAdmin)).toBe(`/admin/tenants/${KPM}`);
      // A support session is a member's, and the KPM entered is not theirs to land in.
      expect(landingFor({ ...superAdmin, isImpersonating: true })).toBe('/admin');
    } finally {
      leaveKpm();
    }
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

  it('P19.17-T3 AC-8 sends a KPM Owner to the KPM Overview (ADR-0269 §6; the brief’s *Landing page stays KPM Overview*)', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, directCount: 3 }) }))).toBe('/kpm/overview');
    expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab' }) }))).toBe(OFFICE_LANDING);
  });

  it('P19.17-T3 AC-8 sends a KPM Admin to the KPM Overview too, an Admin who leads nobody included', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true }) }))).toBe('/kpm/overview');
  });

  it('P19.17-T3 AC-8 a core leader, who has the same KPM group, still lands on Home: the brief names the Owner’s alone', () => {
    const core = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isCoreLeader: true, directCount: 4 });
    expect(landingFor(makeMe({ membership: core }))).toBe('/home');
  });

  it('P19.17-T3 AC-8 a pending or removed Owner is still answered by the status first', () => {
    expect(landingFor(makeMe({ membership: member({ isKpmOwner: true, status: 'pending' }) }))).toBe('/user-management/leader');
    expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true, status: 'removed' }) }))).toBe('/user-management/kpm');
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
    // P19.17-T3 AC-8: an Admin in their 90 days lands on the KPM Overview, as every Admin does.
    expect(landingFor(makeMe({ membership: member({ isKpmAdmin: true }), activation: { open: true, complete: false } }))).toBe('/kpm/overview');
  });

  it('lets a pending membership win over any role it carries', () => {
    // The order runs most specific first: several of these are true at once, and being
    // unapproved outranks being an AB.
    const pendingAb = member({ status: 'pending', orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 });
    expect(landingFor(makeMe({ membership: pendingAb }))).toBe('/user-management/leader');
  });
});

describe('the field landing, one function for every active member but the office’s (P13.2-T5 AC-1; P19.17-T3 AC-8)', () => {
  it('UI-100 is Home, with a direct report or without (ADR-0180 §10)', () => {
    expect(fieldLandingFor({ directCount: 3 })).toBe('/home');
    expect(fieldLandingFor({ directCount: 1 })).toBe('/home');
    expect(fieldLandingFor({ directCount: 0 })).toBe('/home');
  });

  it('P19.17-T3 AC-8 is exactly where landingFor sends every active member who does not run the office', () => {
    // The landing order's last branch *is* the function: no second copy of the rule to drift.
    for (const directCount of [0, 1, 4]) {
      for (const [orgLevelCode, hierarchyRole] of [['AB', 'ab'], ['AAB', 'aab'], ['AGENT', 'agent']] as const) {
        for (const tag of [{}, { isCoreLeader: true }]) {
          const m = member({ orgLevelCode, hierarchyRole, directCount, ...tag });
          expect(landingFor(makeMe({ membership: m }))).toBe(fieldLandingFor(m!));
        }
      }
    }
  });

  it('P19.17-T3 AC-8 where each reader signs in: the KPM Overview for the Owner and the Admins, Home for every other member', () => {
    // One table for the exit review (ADR-0269 §6; OD-381's default). There is no view to switch to any more.
    const cases = [
      ['an AB who leads people', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }), '/home'],
      ['an AAB who leads nobody', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 }), '/home'],
      ['an Agent', member(), '/home'],
      ['a core leader', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isCoreLeader: true }), '/home'],
      ['the Owner, leading people', member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5 }), '/kpm/overview'],
      ['the Owner, leading nobody', member({ isKpmOwner: true, orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 0 }), '/kpm/overview'],
      ['the Admin, leading people', member({ isKpmAdmin: true, orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1 }), '/kpm/overview'],
      ['the Admin, leading nobody', member({ isKpmAdmin: true, directCount: 0 }), '/kpm/overview'],
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
