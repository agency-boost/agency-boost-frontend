import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import type { Me } from '@/lib/session';
import { fieldNav, isUnder } from './field-nav';

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
    ['an AAB who leads nobody', AAB_ALONE],
    ['somebody in no office', makeMe({ membership: null })],
  ])('O-10 gives %s Personal Summary as the fourth tab, labelled Summary, and no Unit Dashboard anywhere', (_, me) => {
    const nav = fieldNav(me, '/leads');
    expect(nav.tabs[3]).toMatchObject({ id: 'summary', href: '/summary', short: 'Summary' });
    expect(nav.top.map((t) => t.id)).toEqual(['home', 'activity', 'calendar']);
    expect(JSON.stringify(nav)).not.toContain('/unit/dashboard');
  });

  it('D-20 gives a Core Leader every group, in the owner’s order, and the desktop’s first section with Search agent', () => {
    expect(ids(fieldNav(CORE_LEADER, '/goals'))).toEqual({
      tabs: ['activity', 'calendar', 'home', 'unit'],
      top: ['home', 'activity', 'calendar', 'unit', 'searchAgent'],
      groups: {
        saya: ['leads', 'goals', 'summary', 'training'],
        aktivitas: ['sales', 'recruitment'],
        timSaya: ['coaching', 'newHires', 'groupTree', 'userManagement'],
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
    expect([named('unit').short, named('unit').label]).toEqual(['Unit', 'Unit Dashboard']);
    expect(named('advancedAnalytics')).toMatchObject({ soon: true, active: false });
  });

  it('OD-23 gives an AAB who leads somebody the Unit tab, Search agent and Tim saya’s leader items — leading is the graph', () => {
    const nav = ids(fieldNav(AAB, '/goals'));
    expect(nav.tabs[3]).toBe('unit');
    expect(nav.top).toEqual(['home', 'activity', 'calendar', 'unit', 'searchAgent']);
    expect(nav.groups.timSaya).toEqual(['coaching', 'newHires', 'groupTree', 'userManagement']);
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

  it('P18.96-T3 AC-1 offers New Hires to a reader with hires, or a leader who may add agents — and to nobody else', () => {
    const hasNewHires = (me: Me) => ids(fieldNav(me, '/goals')).groups.timSaya?.includes('newHires') ?? false;
    expect(hasNewHires(AB)).toBe(true);
    expect(hasNewHires(member({}, { newHires: true }))).toBe(true);
    expect(hasNewHires(AGENT)).toBe(false);
    expect(hasNewHires(member({ directCount: 2 }, { permissions: ['member:invite'] }))).toBe(false);
  });

  it('the lead’s intake: a new hire’s own activation is the first tile of Saya, while it is open, with the check at 100%', () => {
    const open = fieldNav(NEW_HIRE, '/activation');
    expect(open.groups[0].items.map((i) => i.id)).toEqual(['activation', 'leads', 'goals', 'summary', 'training']);
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
      '/leader-meetings', '/kpm/analytics', '/kpm/advanced-analytics',
    ]));
  });
});
