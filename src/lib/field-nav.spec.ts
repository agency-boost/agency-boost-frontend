import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import type { Me } from '@/lib/session';
import { adminNav, fieldNav, isUnder, type AdminWords } from './field-nav';

/** A member of the office, with only what a case is about spelled out. */
function member(over: Partial<NonNullable<Me['membership']>> = {}, me: Partial<Me> = {}): Me {
  return makeMe({
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
      isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
    },
    ...me,
  });
}

const AGENT = member();
const AAB_ALONE = member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 0 });
const AAB = member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 }, {
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
const AB = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }, {
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
const CORE_LEADER = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4, isCoreLeader: true }, {
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
const NEW_HIRE = member({}, { activation: { open: true, complete: false } });
const AB_ALONE = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 0 }, {
  permissions: ['member:invite', 'new_hires:read_roster', 'member:search_untagged_pool'],
});
/** On a rung the company named itself, of the AB's class (ADR-0156 §3): a Manulife *SBP*. */
const SBP_ALONE = member({ orgLevelCode: 'SBP', hierarchyRole: 'ab', directCount: 0 });
const OWNER = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 0 });
/** An Admin standing on the agent rung: running the office makes them a leader in their field view. */
const ADMIN = member({ isKpmAdmin: true, directCount: 0 });
const NO_KPM = makeMe({ membership: null, permissions: ['kpm:read_directory', 'profile:read_self'] });

/** *Tim saya* for a leader by role (UI-159 item 1, OD-247's default), in the client's order. */
const TIM_SAYA = ['unit', 'coaching', 'newHires', 'userManagement', 'groupTree'];
/** Every item an Agent has (D-37, UI-166 item 1): the bar, and the sheet's and the sidebar's groups. */
const AGENT_NAV = {
  tabs: ['activity', 'calendar', 'home', 'summary'],
  top: ['home', 'activity', 'calendar'],
  groups: {
    // *Survei* since P19.5-T4 (C-R2; OD-267, D-37): every field role's, at all times.
    saya: ['leads', 'goals', 'summary', 'training', 'surveys'],
    aktivitas: ['sales', 'recruitment'],
    timSaya: ['userManagement'],
    program: ['campaign', 'event'],
  },
};
/** Every item a leader has who is no Core Leader. */
const LEADER_NAV = {
  tabs: ['activity', 'calendar', 'home', 'unit'],
  top: ['home', 'activity', 'calendar', 'searchAgent'],
  groups: { ...AGENT_NAV.groups, timSaya: TIM_SAYA },
};

const ids = (nav: ReturnType<typeof fieldNav>) => ({
  tabs: nav.tabs.map((t) => t.id),
  top: nav.top.map((t) => t.id),
  groups: Object.fromEntries(nav.groups.map((g) => [g.id, g.items.map((i) => i.id)])),
});

/**
 * **UI-004's navigation model** (D-13, D-20; ADR-0180): the tab bar, the *Lainnya* sheet and the desktop sidebar, one
 * model, role by role — positive and negative. The routes keep their own guards; this decides what is offered.
 */
describe('UI-004 fieldNav: the tab bar, the Lainnya sheet and the sidebar, from one model', () => {
  it('UI-004 orders the bar Activity · Calendar · Home · Unit (Lainnya is the bar’s own, fifth) for a leader', () => {
    const nav = fieldNav(AB, '/goals');
    expect(nav.tabs.map((t) => [t.short, t.href])).toEqual([
      ['Activity', '/activity/log'], ['Calendar', '/calendar'], ['Home', '/home'], ['Unit', '/unit/dashboard'],
    ]);
  });

  it.each([
    ['an Agent', AGENT],
    ['somebody in no office', makeMe({ membership: null })],
  ])('O-10 gives %s Personal Summary as the fourth tab, labelled Summary, and no Unit Dashboard anywhere', (_, me) => {
    const nav = fieldNav(me, '/leads');
    expect(nav.tabs[3]).toMatchObject({ id: 'summary', href: '/summary', short: 'Summary' });
    expect(nav.top.map((t) => t.id)).toEqual(['home', 'activity', 'calendar']);
    expect(JSON.stringify(nav)).not.toContain('/unit/dashboard');
  });

  it('P19-T4 AC-1 keeps the leader items for somebody on an Agent rung who already leads people (ADR-0189 §1)', () => {
    const nav = fieldNav(member({ directCount: 2 }), '/leads');
    expect(nav.tabs[3]).toMatchObject({ id: 'unit', href: '/unit/dashboard' });
    expect(nav.groups.find((g) => g.id === 'timSaya')?.items.map((i) => i.id)).toEqual(TIM_SAYA);
  });

  it('D-20 gives a Core Leader every group, in the owner’s order, and the desktop’s first section with Search agent', () => {
    expect(ids(fieldNav(CORE_LEADER, '/goals'))).toEqual({
      tabs: ['activity', 'calendar', 'home', 'unit'],
      top: ['home', 'activity', 'calendar', 'searchAgent'],
      groups: {
        saya: ['leads', 'goals', 'summary', 'training', 'surveys'],
        aktivitas: ['sales', 'recruitment'],
        timSaya: TIM_SAYA,
        program: ['campaign', 'event'],
        kpm: ['forum', 'kpmAnalytics', 'advancedAnalytics'],
      },
    });
  });

  it('D-20 writes the sheet’s short names and the sidebar’s full ones', () => {
    const nav = fieldNav(CORE_LEADER, '/goals');
    const all = [...nav.top, ...nav.groups.flatMap((g) => g.items)];
    const named = (id: string) => all.find((d) => d.id === id)!;
    expect([named('userManagement').short, named('userManagement').label]).toEqual(['User Mgmt', 'User Management']);
    expect([named('forum').short, named('forum').label]).toEqual(['Leader Forum', 'Strategic Leader Forum']);
    expect([named('unit').short, named('unit').label]).toEqual(['Unit Dashboard', 'Unit Dashboard']);
    expect([nav.tabs[3].short, nav.tabs[3].label]).toEqual(['Unit', 'Unit Dashboard']);
    // P19.5-T3 AC-1: a working item, opening the page's index — the template's first section that is on.
    expect(named('advancedAnalytics')).toMatchObject({ href: '/kpm/advanced-analytics', active: false });
    expect(named('advancedAnalytics').soon).toBeUndefined();
    expect(named('surveys')).toMatchObject({ href: '/surveys', label: 'Survei', short: 'Survei' });
  });

  it('P19.5-T4 AC-8 the Survei tile is in Saya for every role, named in the reader’s words, current on /surveys and the form', () => {
    for (const me of [AGENT, AB, AAB, CORE_LEADER, OWNER, ADMIN, NO_KPM]) {
      expect(fieldNav(me, '/home').groups[0].items.map((i) => i.id)).toContain('surveys');
    }
    const en = fieldNav(AGENT, '/surveys/run-1', 'self', { surveys: 'Surveys' });
    expect(en.groups[0].items.find((i) => i.id === 'surveys')).toMatchObject({ label: 'Surveys', active: true });
    expect(en.inSheet).toBe(true);
    expect(fieldNav(CORE_LEADER, '/kpm/advanced-analytics/qual').groups.flatMap((g) => g.items)
      .find((i) => i.id === 'advancedAnalytics')!.active).toBe(true);
  });

  it('P19-T4 AC-1 gives an AAB who leads somebody the Unit tab, Search agent and Tim saya’s five', () => {
    const nav = ids(fieldNav(AAB, '/goals'));
    expect(nav.tabs[3]).toBe('unit');
    expect(nav.top).toEqual(['home', 'activity', 'calendar', 'searchAgent']);
    expect(nav.groups.timSaya).toEqual(TIM_SAYA);
    expect(nav.groups.kpm).toBeUndefined();
  });

  it('D-20 hides the KPM group from a leader who is no Core Leader, and Tim saya’s leader items from an Agent', () => {
    expect(ids(fieldNav(AB, '/goals')).groups.kpm).toBeUndefined();
    const agent = ids(fieldNav(AGENT, '/goals')).groups;
    // An Agent keeps User Management — it is where they find their office and their leader — and nothing else there.
    expect(agent.timSaya).toEqual(['userManagement']);
    expect(agent.kpm).toBeUndefined();
    expect(Object.keys(agent)).toEqual(['saya', 'aktivitas', 'timSaya', 'program']);
  });

  it('UI-085 opens User Mgmt on Add New Agents for a reader who may add people, on Register KPM for an Agent', () => {
    const um = (me: Me) => fieldNav(me, '/goals').groups.flatMap((g) => g.items).find((i) => i.id === 'userManagement')!;
    expect(um(AB).href).toBe('/user-management/add');
    expect(um(AGENT).href).toBe('/user-management/kpm');
    expect(fieldNav(AGENT, '/user-management/leader').groups.flatMap((g) => g.items).find((i) => i.id === 'userManagement'))
      .toMatchObject({ active: true });
  });

  it('P19-T4 AC-1 offers New Hires by role (ADR-0189 amends ADR-0106): every AB and AAB, never an Agent', () => {
    const hasNewHires = (me: Me) => ids(fieldNav(me, '/goals')).groups.timSaya?.includes('newHires') ?? false;
    expect(hasNewHires(AB)).toBe(true);
    expect(hasNewHires(AAB_ALONE)).toBe(true);
    // No open activation in reach, no grant to add agents yet: still a leader's (a pending or new AB).
    expect(hasNewHires(member({ orgLevelCode: 'AB', hierarchyRole: 'ab' }))).toBe(true);
    expect(hasNewHires(member({}, { newHires: true }))).toBe(true); // data adds, never removes (ADR-0106 kept)
    expect(hasNewHires(AGENT)).toBe(false);
    expect(hasNewHires(member({ directCount: 2 }, { permissions: ['member:invite'] }))).toBe(true); // leads somebody
  });

  it('the lead’s intake: a new hire’s own activation is the first tile of Saya, while it is open, with the check at 100%', () => {
    const open = fieldNav(NEW_HIRE, '/activation');
    expect(open.groups[0].items.map((i) => i.id)).toEqual(['activation', 'leads', 'goals', 'summary', 'training', 'surveys']);
    expect(open.groups[0].items[0]).toMatchObject({ href: '/activation', active: true, short: '90-day activation' });
    const done = fieldNav(member({}, { activation: { open: true, complete: true } }), '/goals');
    expect(done.groups[0].items[0].done).toBe(true);
    // Closed — graduated or expired — it is offered nowhere.
    expect(JSON.stringify(fieldNav(member({}, { activation: { open: false, complete: true } }), '/goals'))).not.toContain('/activation');
  });

  it.each([
    ['/activity/log', 'activity'], ['/activity/ratio', 'activity'], ['/calendar', 'calendar'], ['/home', 'home'],
    ['/unit/dashboard/mem-9', 'unit'],
  ])('UI-004 marks the bar’s tab current on %s, and Lainnya is not', (path, tab) => {
    const nav = fieldNav(AB, path);
    expect(nav.tabs.filter((t) => t.active).map((t) => t.id)).toEqual([tab]);
    expect(nav.inSheet).toBe(false);
  });

  it.each(['/leads', '/goals', '/product-catalog/PRUMAPAN', '/recruitment/pitch-materials', '/coaching/mem-9/session', '/events'])(
    'UI-004 makes Lainnya the current tab on %s, a page the sheet holds and the bar does not',
    (path) => {
      const nav = fieldNav(AB, path);
      expect(nav.tabs.some((t) => t.active)).toBe(false);
      expect(nav.inSheet).toBe(true);
    },
  );

  it.each(['/proposal', '/proposal/new', '/proposal/66f0000000000000000000p1'])(
    'P19.7-T2 AC-1 Aktivitas → Sales is current on %s, and the sheet holds the page',
    (path) => {
      for (const me of [AB, AGENT]) {
        const nav = fieldNav(me, path);
        const sales = nav.groups.flatMap((g) => g.items).find((d) => d.id === 'sales')!;
        expect(sales).toMatchObject({ href: '/attack-plan', active: true });
        expect(nav.inSheet).toBe(true);
      }
    },
  );

  it('O-10 an Agent on Personal Summary is on the bar’s fourth tab, and Lainnya is not current', () => {
    const nav = fieldNav(AGENT, '/summary');
    expect(nav.tabs[3].active).toBe(true);
    expect(nav.inSheet).toBe(false);
  });

  it('a prefix is not a parent', () => {
    expect(isUnder('/recruitments', '/recruitment')).toBe(false);
    expect(isUnder('/recruitment/attack-plan', '/recruitment')).toBe(true);
    expect(fieldNav(AB, '/unit/dashboards').tabs[3].active).toBe(false);
  });

  it('every destination opens a route the app has, or the Home another task builds', () => {
    const nav = fieldNav(CORE_LEADER, '/goals');
    const hrefs = [...nav.tabs, ...nav.top, ...nav.groups.flatMap((g) => g.items)].map((d) => d.href);
    expect(new Set(hrefs)).toEqual(new Set([
      '/activity/log', '/calendar', '/home', '/unit/dashboard', '/group-tree', '/leads', '/goals', '/summary', '/training',
      '/attack-plan', '/recruitment/attack-plan', '/coaching', '/new-hires', '/user-management/add', '/campaigns', '/events',
      '/leader-meetings', '/kpm/analytics', '/kpm/advanced-analytics', '/surveys',
    ]));
  });
  /*
   * **P19-T4: the menu follows the role, never the data** (D-37, UI-159, UI-166; ADR-0189 §1, OD-247's default). Every
   * role, with a team and without, and somebody in no office: the exact items of the bar, the sidebar's first section
   * and each group — the sheet and the sidebar are drawn from the same groups.
   */
  describe('P19-T4 the menu follows the role', () => {
    it.each([
      ['an AB with no team', AB_ALONE],
      ['an AAB with no team', AAB_ALONE],
      ['an AB on a rung the company named (SBP), with no team', SBP_ALONE],
    ])('P19-T4 AC-1 %s sees Unit Dashboard, Coaching, New Hires, User Management and Group Tree, in that order', (_, me) => {
      const nav = fieldNav(me, '/goals');
      expect(ids(nav)).toEqual(LEADER_NAV);
      // Two taps from Home: the bar's Unit tab is one; Lainnya → Coaching is two (the sheet holds Tim saya).
      expect(nav.tabs[3]).toMatchObject({ id: 'unit', href: '/unit/dashboard' });
      expect(nav.groups.find((g) => g.id === 'timSaya')!.items.map((i) => i.href)).toEqual([
        '/unit/dashboard', '/coaching', '/new-hires', expect.stringMatching(/^\/user-management\//), '/group-tree',
      ]);
    });

    it('P19-T4 AC-1 a leader with a team sees exactly what one with none sees', () => {
      expect(ids(fieldNav(AB, '/goals'))).toEqual(ids(fieldNav(AB_ALONE, '/goals')));
      expect(ids(fieldNav(AAB, '/goals'))).toEqual(ids(fieldNav(AAB_ALONE, '/goals')));
    });

    it('P19-T4 AC-6 an Agent sees every Agent item and no leader item (OD-247: User Management stays)', () => {
      expect(ids(fieldNav(AGENT, '/goals'))).toEqual(AGENT_NAV);
    });

    it('P19-T4 AC-6 an Agent who leads somebody keeps a leader’s items: a count adds, never removes (ADR-0189 §1)', () => {
      expect(ids(fieldNav(member({ directCount: 3 }), '/goals'))).toEqual(LEADER_NAV);
    });

    it('P19-T4 AC-6 an Agent with a hire in reach keeps New Hires beside User Management (ADR-0106, kept)', () => {
      expect(ids(fieldNav(member({}, { newHires: true }), '/goals')).groups.timSaya).toEqual(['newHires', 'userManagement']);
    });

    it.each([
      ['a KPM Owner on the AB rung, with no team', OWNER],
      ['a KPM Admin on the agent rung, with no team', ADMIN],
      ['a KPM Owner with a team', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 6 })],
    ])('P19-T4 AC-6 %s, in the field view, sees a leader’s items', (_, me) => {
      expect(ids(fieldNav(me, '/goals'))).toEqual(LEADER_NAV);
    });

    it('P19-T4 AC-4 somebody in no office sees every Agent item, User Management opening on Register KPM', () => {
      const nav = fieldNav(NO_KPM, '/home');
      expect(ids(nav)).toEqual(AGENT_NAV);
      expect(nav.groups.flatMap((g) => g.items).find((i) => i.id === 'userManagement')!.href).toBe('/user-management/kpm');
    });

    it.each(['pending', 'removed'] as const)('P19-T4 AC-4 a %s membership is not in the office yet: the Agent’s items, whatever its rung', (status) => {
      expect(ids(fieldNav(member({ hierarchyRole: 'ab', status }), '/goals'))).toEqual(AGENT_NAV);
    });

    it('P19-T4 AC-6 every item of every role opens a route the app has', () => {
      const routes = new Set([
        '/activity/log', '/calendar', '/home', '/unit/dashboard', '/group-tree', '/leads', '/goals', '/summary', '/training',
        '/attack-plan', '/recruitment/attack-plan', '/coaching', '/new-hires', '/user-management/add', '/user-management/kpm',
        '/campaigns', '/events', '/leader-meetings', '/kpm/analytics', '/kpm/advanced-analytics', '/activation', '/surveys',
      ]);
      for (const me of [AGENT, AAB_ALONE, AB_ALONE, AAB, AB, CORE_LEADER, OWNER, ADMIN, NO_KPM, NEW_HIRE]) {
        const nav = fieldNav(me, '/home');
        for (const d of [...nav.tabs, ...nav.top, ...nav.groups.flatMap((g) => g.items)]) expect(routes).toContain(d.href);
      }
    });
  });
});

describe('P19.2-T1 AC-6 the office view’s menu (UI-147; ADR-0198 §2)', () => {
  const groupsOf = (nav: ReturnType<typeof fieldNav>) => nav.groups.map((g) => g.id);
  const itemsOf = (nav: ReturnType<typeof fieldNav>, id: string) =>
    nav.groups.find((g) => g.id === id)?.items.map((d) => d.label) ?? [];
  const CORE_OWNER = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, isCoreLeader: true });

  it('P19.2-T1 AC-6 adds, after Program, KPM · Pengaturan · People for the Owner, in the console’s order', () => {
    const nav = fieldNav(OWNER, '/kpm/overview', 'kpm_owner');
    expect(groupsOf(nav)).toEqual(['saya', 'aktivitas', 'timSaya', 'program', 'kpm', 'pengaturan', 'people']);
    expect(itemsOf(nav, 'kpm')).toEqual(['Overview', 'KPM Analytics', 'Advanced analytics', 'Strategic Leader Forum', 'Data upload']);
    expect(itemsOf(nav, 'pengaturan')).toEqual([
      'Activity types', 'Lead statuses', 'Activation checklist', 'Training', 'Capability Mapping', 'Events', 'Campaigns',
      'Products', 'Recruitment pitch', 'Branch info',
      // P19.6-T1 (ADR-0218 §1; §B7): *Pengaturan → Tampilan KPM*, after *Branch info*.
      'Tampilan KPM',
    ]);
    expect(itemsOf(nav, 'people')).toEqual(['All members', 'Import people', 'Org tree', 'Manage KPM admins']);
    // P19.5-T3 AC-1: Advanced analytics opens the page's index (no longer *Segera hadir*, nor the survey tabs alone).
    const advanced = nav.groups.flatMap((g) => g.items).find((d) => d.id === 'advancedAnalytics')!;
    expect(advanced).toMatchObject({ href: '/kpm/advanced-analytics', active: false });
  });

  it('P19.2-T1 AC-6 gives an Admin KPM · Pengaturan · People without Manage KPM admins (§1.6)', () => {
    const nav = fieldNav(ADMIN, '/kpm/overview', 'kpm_admin');
    expect(groupsOf(nav)).toEqual(['saya', 'aktivitas', 'timSaya', 'program', 'kpm', 'pengaturan', 'people']);
    expect(itemsOf(nav, 'people')).toEqual(['All members', 'Import people', 'Org tree']);
  });

  it('P19.2-T1 AC-6 keeps the leader bar in the office view: Activity · Calendar · Home · Unit, and Lainnya current on an office page', () => {
    const nav = fieldNav(ADMIN, '/kpm/settings/products', 'kpm_admin');
    expect(nav.tabs.map((t) => t.short)).toEqual(['Activity', 'Calendar', 'Home', 'Unit']);
    expect(nav.inSheet).toBe(true);
    expect(nav.groups.flatMap((g) => g.items).filter((d) => d.active).map((d) => d.id)).toEqual(['products']);
  });

  it('P19.2-T1 AC-6 the office’s KPM takes the place of a Core Leader’s: one KPM group, the forum and analytics in it once', () => {
    const nav = fieldNav(CORE_OWNER, '/home', 'kpm_owner');
    expect(groupsOf(nav).filter((g) => g === 'kpm')).toHaveLength(1);
    expect(itemsOf(nav, 'kpm')).toContain('Strategic Leader Forum');
    expect(nav.groups.flatMap((g) => g.items).filter((d) => d.id === 'forum')).toHaveLength(1);
  });

  it('P19.2-T1 AC-6 Akun saya keeps the field menu the rung gives: no office group for the Owner or the Admin there', () => {
    for (const me of [OWNER, ADMIN]) {
      const nav = fieldNav(me, '/home', 'self');
      expect(groupsOf(nav)).not.toContain('pengaturan');
      expect(groupsOf(nav)).not.toContain('people');
      expect(nav.groups.find((g) => g.id === 'timSaya')!.items.map((d) => d.id)).toEqual(TIM_SAYA);
    }
    // A Core Leader who is the Owner keeps their own KPM group in Akun saya, as before.
    expect(itemsOf(fieldNav(CORE_OWNER, '/home', 'self'), 'kpm')).toEqual(['Strategic Leader Forum', 'KPM Analytics', 'Advanced analytics']);
  });

  it('P19.2-T1 AC-6 an office view the reader does not hold draws the field menu: the view is a menu, never a grant', () => {
    for (const me of [AB, AGENT, member({ isKpmOwner: true, status: 'pending' })]) {
      expect(groupsOf(fieldNav(me, '/home', 'kpm_owner'))).not.toContain('pengaturan');
    }
  });

  it('P19.2-T1 AC-6 every office page is two taps away at most: Lainnya, then its tile', () => {
    const nav = fieldNav(OWNER, '/home', 'kpm_owner');
    const hrefs = nav.groups.flatMap((g) => g.items).filter((d) => !d.soon).map((d) => d.href);
    for (const href of [
      '/kpm/overview', '/kpm/analytics', '/kpm/data-upload', '/leader-meetings', '/kpm/settings/activity-types',
      '/kpm/settings/lead-statuses', '/kpm/settings/activation-checklist', '/kpm/settings/training',
      '/kpm/settings/capability-mapping', '/kpm/settings/events', '/kpm/settings/campaigns', '/kpm/settings/products',
      '/kpm/settings/recruitment-pitch', '/kpm/settings/branch-info', '/people/members', '/people/import',
      '/people/org-tree', '/people/admins',
    ]) expect(hrefs).toContain(href);
  });
});

describe('P19.2-T1 AC-9 the Super Admin’s menu (UI-127; ADR-0197 §3)', () => {
  const WORDS = {
    overview: 'Overview', manageCompanies: 'Manage companies', orgRoleLadder: 'Org role ladder', allKpms: 'All KPMs',
    allMembers: 'All members', pendingKpmRequests: 'Pending KPM requests', leadersPastTheLimit: 'Leaders past the limit',
    billing: 'Billing & subscription', tenantAdmins: 'KPM Owners & Admins', audit: 'Audit / role change log',
    crossPlatformAnalytics: 'Cross-platform analytics', barKpms: 'KPMs', barCompanies: 'Perusahaan', barAnalytics: 'Analytics',
  } as unknown as AdminWords;

  it('P19.2-T1 AC-9 the bar: Overview /admin · KPMs /admin/tenants · Perusahaan /admin/companies · Analytics /admin/analytics', () => {
    const nav = adminNav('/admin', WORDS);
    expect(nav.tabs.map((t) => [t.short, t.href])).toEqual([
      ['Overview', '/admin'], ['KPMs', '/admin/tenants'], ['Perusahaan', '/admin/companies'], ['Analytics', '/admin/analytics'],
    ]);
    expect(nav.tabs[0].active).toBe(true);
    expect(adminNav('/admin/tenants/kpm-1', WORDS).tabs.map((t) => t.active)).toEqual([false, true, false, false]);
  });

  it('P19.2-T1 AC-9 the sheet and the laptop sidebar: the sidebar’s groups unchanged, Overview alone at its top', () => {
    const nav = adminNav('/admin', WORDS, { leaderLimitPending: 2 });
    expect(nav.top.map((d) => d.label)).toEqual(['Overview']);
    expect(nav.groups.map((g) => [g.id, g.items.map((d) => d.label)])).toEqual([
      ['companies', ['Manage companies', 'Org role ladder']],
      // P19.4-T3 AC-1 (SA UI-010): *All members* after *All KPMs*.
      ['kpms', ['All KPMs', 'All members', 'Pending KPM requests', 'Leaders past the limit', 'Billing & subscription']],
      ['platformAdmin', ['KPM Owners & Admins', 'Audit / role change log']],
      ['reporting', ['Cross-platform analytics']],
    ]);
    expect(nav.groups[1].items[1].href).toBe('/admin/members');
    expect(nav.groups[1].items[3].badge).toBe(2);
  });

  it('P19.2-T1 AC-9 every Super Admin page in two taps: on the bar, or Lainnya then a tile — and Lainnya current there', () => {
    const nav = adminNav('/admin/audit', WORDS);
    expect(nav.inSheet).toBe(true);
    const reach = new Set([...nav.tabs, ...nav.groups.flatMap((g) => g.items)].map((d) => d.href));
    for (const href of [
      '/admin', '/admin/companies', '/admin/org-levels', '/admin/tenants', '/admin/members', '/admin/kpm-requests',
      '/admin/leader-limit-requests', '/admin/billing', '/admin/tenant-admins', '/admin/audit', '/admin/analytics',
    ]) expect(reach).toContain(href);
    // Overview is current on /admin alone: every other admin route starts with it.
    expect(nav.tabs[0].active).toBe(false);
  });
});
