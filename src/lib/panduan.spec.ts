import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeMe } from '@test/harness';
import { PANDUAN, PANDUAN_ROLE, panduanHref } from './panduan';
import type { Me } from './session';
import { viewKindsOf, type ViewKind } from './views';

/**
 * **P19.6-T5 AC-2 — which guide each person opens** (ADR-0219 §5; the guide spec's table, rewritten for one shell and by
 * role, ADR-0189): row by row, from the view and the rung, never from whether anybody reports to them.
 */
const member = (over: Partial<NonNullable<Me['membership']>> = {}, me: Partial<Me> = {}): Me => makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
  },
  ...me,
});

const AGENT = member();
const AB = member({ orgLevelCode: 'AB', hierarchyRole: 'ab' });
const AAB = member({ orgLevelCode: 'AAB', hierarchyRole: 'aab' });
const OWNER_ON_AB = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 3 });
const ADMIN_ON_AGENT = member({ isKpmAdmin: true });
const NEWCOMER = makeMe({ membership: null });
const SUPER_ADMIN = makeMe({ user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null });

const AGENT_GUIDE = '/panduan/agent-leader.html#agent';
const LEADER_GUIDE = '/panduan/agent-leader.html#leader';

describe('P19.6-T5 AC-2 panduanHref, the table row by row', () => {
  it.each([
    ['an Agent, Akun saya', AGENT, 'self', AGENT_GUIDE],
    ['an AB, Akun saya', AB, 'self', LEADER_GUIDE],
    ['an AAB, Akun saya', AAB, 'self', LEADER_GUIDE],
    ['the KPM Owner, KPM Owner · <nama KPM>', OWNER_ON_AB, 'kpm_owner', '/panduan/kpm-owner-admin.html#owner'],
    ['the KPM Admin, KPM Admin · <nama KPM>', ADMIN_ON_AGENT, 'kpm_admin', '/panduan/kpm-owner-admin.html#admin'],
    ['the Owner on an AB rung, in Akun saya: their field rung', OWNER_ON_AB, 'self', LEADER_GUIDE],
    ['the Admin on an Agent rung, in Akun saya: their field rung', ADMIN_ON_AGENT, 'self', AGENT_GUIDE],
    ['somebody in no office yet', NEWCOMER, 'self', AGENT_GUIDE],
    ['the Super Admin, Superadmin', SUPER_ADMIN, 'super_admin', '/admin/panduan'],
    ['no session read yet', null, 'self', AGENT_GUIDE],
  ] as const)('Panduan-AC2 P19.6-T5 AC-2 %s opens %s', (_who, me, view: ViewKind, href) => {
    expect(panduanHref(me, view)).toBe(href);
  });

  it('Panduan-AC2 P19.6-T5 AC-2 an AB or an AAB opens #leader whether or not they lead anyone — the role, never the data', () => {
    for (const role of ['ab', 'aab'] as const) {
      for (const directCount of [0, 4]) {
        expect(panduanHref(member({ hierarchyRole: role, orgLevelCode: role.toUpperCase(), directCount }), 'self')).toBe(LEADER_GUIDE);
      }
    }
    // An Agent who already leads somebody keeps the Agent's guide: data adds nothing here.
    expect(panduanHref(member({ directCount: 2 }), 'self')).toBe(AGENT_GUIDE);
  });

  it('Panduan-AC2 P19.6-T5 AC-2 a Super Admin in a view-as session opens the viewed role’s guide (me is the member’s)', () => {
    const viewing = (who: Me) => ({ ...who, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-root' }) as Me;
    for (const [who, view, href] of [
      [viewing(AGENT), 'self', AGENT_GUIDE],
      [viewing(AB), 'self', LEADER_GUIDE],
      [viewing(OWNER_ON_AB), 'kpm_owner', '/panduan/kpm-owner-admin.html#owner'],
      [viewing(ADMIN_ON_AGENT), 'kpm_admin', '/panduan/kpm-owner-admin.html#admin'],
    ] as const) {
      expect(viewKindsOf(who)).toContain(view);
      expect(panduanHref(who, view)).toBe(href);
    }
  });

  it('Panduan-AC2 P19.6-T5 AC-2 a pending or removed membership opens its rung’s guide, as the menu offers it', () => {
    expect(panduanHref(member({ status: 'pending' }), 'self')).toBe(AGENT_GUIDE);
    expect(panduanHref(member({ status: 'pending', hierarchyRole: 'ab', orgLevelCode: 'AB' }), 'self')).toBe(LEADER_GUIDE);
  });

  it('P19.6-T5 AC-2 every address is a fixed path with no date, and a fragment the guide itself opens on', () => {
    for (const path of Object.values(PANDUAN)) expect(path).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    const fragments: Record<string, string[]> = {
      [PANDUAN.agentLeader]: [PANDUAN_ROLE.agent, PANDUAN_ROLE.leader],
      [PANDUAN.kpmOwnerAdmin]: [PANDUAN_ROLE.owner, PANDUAN_ROLE.admin],
    };
    for (const [path, roles] of Object.entries(fragments)) {
      const html = readFileSync(join(__dirname, '..', '..', 'public', path), 'utf8');
      // The role buttons the guide builds from its data: `{id:"agent", …}`, opened by `location.hash`.
      for (const role of roles) expect([path, role, html.includes(`id:"${role}"`)]).toEqual([path, role, true]);
      expect(html).toContain("location.hash");
    }
  });
});

describe('P19.6-T5 AC-7 the app’s ID | EN does not change the guide', () => {
  it('Panduan-AC5 P19.6-T5 AC-7 the address is the same in either language: the language is no input to it', () => {
    expect(panduanHref.length).toBe(2);
    expect(panduanHref(AB, 'self')).toBe(LEADER_GUIDE);
    // The guides are in Bahasa, with no English twin to switch to.
    for (const path of [PANDUAN.agentLeader, PANDUAN.kpmOwnerAdmin]) {
      expect(readFileSync(join(__dirname, '..', '..', 'public', path), 'utf8')).toMatch(/^<!doctype html>\s*<html lang="id">/);
    }
  });
});
