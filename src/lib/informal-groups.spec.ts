import { describe, expect, it } from 'vitest';
import { stubFetch } from '../../test/harness';
import {
  abGroupRowOf, addAbsToGroup, appointGroupLeader, createInformalGroup, deleteInformalGroup, groupOfAb, monthsBetween,
  readAbGroupTargets, readInformalGroups, removeGroupLeader, renameInformalGroup, saveAbGroupTarget, setAbGroup,
  type AbGroupTargetsView, type InformalGroupsView,
} from './informal-groups';

/** P19.17-T4 (ADR-0270): the client's routes and its three helpers. */
describe('lib/informal-groups', () => {
  it('P19.17-T4 calls each route with its verb and body', async () => {
    const { calls } = stubFetch({ '/members': { body: {} }, '/kpm/ab-group-targets': { body: {} } });
    await readInformalGroups();
    await createInformalGroup('Circle');
    await createInformalGroup('Circle', 'm-1');
    await renameInformalGroup('g/1', 'New');
    await deleteInformalGroup('g1');
    await setAbGroup('m-1', null);
    await appointGroupLeader('g1', 'm-1');
    await removeGroupLeader('g1', 'm-1');
    await addAbsToGroup('g1', ['m-1']);
    await readAbGroupTargets();
    await readAbGroupTargets('2026-11');
    await saveAbGroupTarget('m-1', { month: '2026-11', activeAgentTarget: 6, rekrutTarget: 3 });
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url.replace(/^.*\/api\/v1/, ''), c.init.body ?? null])).toEqual([
      ['GET', '/members/groups', null],
      ['POST', '/members/groups', JSON.stringify({ name: 'Circle' })],
      ['POST', '/members/groups', JSON.stringify({ name: 'Circle', abMembershipId: 'm-1' })],
      ['PUT', '/members/groups/g%2F1', JSON.stringify({ name: 'New' })],
      ['DELETE', '/members/groups/g1', null],
      ['PUT', '/members/m-1/group', JSON.stringify({ groupId: null })],
      ['PUT', '/members/groups/g1/leaders/m-1', null],
      ['DELETE', '/members/groups/g1/leaders/m-1', null],
      ['POST', '/members/groups/g1/members', JSON.stringify({ membershipIds: ['m-1'] })],
      ['GET', '/kpm/ab-group-targets', null],
      ['GET', '/kpm/ab-group-targets?month=2026-11', null],
      ['PUT', '/kpm/ab-group-targets/m-1', JSON.stringify({ month: '2026-11', activeAgentTarget: 6, rekrutTarget: 3 })],
    ]);
  });

  it('lists the months newest first, across a year end', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(monthsBetween('2026-03', '2026-02')).toEqual([]);
  });

  it('finds an AB group’s row and an AB’s group', () => {
    const row = { abMembershipId: 'm-1' };
    const view = { groups: [{ group: null, abGroups: [row] }] } as unknown as AbGroupTargetsView;
    expect(abGroupRowOf(view, 'm-1')?.row).toBe(row);
    expect(abGroupRowOf(view, 'm-2')).toBeNull();
    const groups = { groups: [{ groupId: 'g1', abs: [{ membershipId: 'm-1' }] }] } as unknown as InformalGroupsView;
    expect(groupOfAb(groups, 'm-1')?.groupId).toBe('g1');
    expect(groupOfAb(groups, 'm-2')).toBeNull();
  });
});
