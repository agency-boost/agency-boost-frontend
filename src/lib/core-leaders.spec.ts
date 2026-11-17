import { describe, expect, it } from 'vitest';
import { CORE_LEADERS_PAGE_ROWS, filterFromQuery, leadersFor, sameFilter, type CoreLeadersView } from './core-leaders';

const view = {
  year: '2026',
  leaders: [
    { membershipId: 'a', name: 'Agus Prasetyo', agentCode: '87001', role: 'ab', groupId: 'g1', isGroupLeader: true, isCoreLeader: true, targets: null },
    { membershipId: 'm', name: 'Maya Halim', agentCode: null, role: 'ab', groupId: null, isGroupLeader: false, isCoreLeader: false, targets: null },
    { membershipId: 's', name: 'Sari Dewi', agentCode: '80102', role: 'aab', groupId: 'g2', isGroupLeader: false, isCoreLeader: false, targets: null },
  ],
  groups: [],
  counts: { leaders: 3, core: 1, withGroup: 2, withoutGroup: 1 },
  canWrite: true,
  canEditTargets: false,
} satisfies CoreLeadersView;

const ids = (filter: Parameters<typeof leadersFor>[1], query = '') => leadersFor(view, filter, query).map((l) => l.membershipId);

describe('Core leaders & groups, the filters (P19.13-T3)', () => {
  it('P19.13-T3 AC-6 reads ?group= as the page’s filter: none, core, a group’s id, or everybody', () => {
    expect(filterFromQuery(null)).toBe('all');
    expect(filterFromQuery('')).toBe('all');
    expect(filterFromQuery('none')).toBe('none');
    expect(filterFromQuery('core')).toBe('core');
    expect(filterFromQuery('g1')).toEqual({ groupId: 'g1' });
  });

  it('P19.13-T3 AC-8 keeps the tiles’ and chips’ leaders, and searches a name or a code in any case', () => {
    expect(ids('all')).toEqual(['a', 'm', 's']);
    expect(ids('core')).toEqual(['a']);
    expect(ids('has')).toEqual(['a', 's']);
    expect(ids('none')).toEqual(['m']);
    expect(ids({ groupId: 'g2' })).toEqual(['s']);
    expect(ids('all', 'MAYA')).toEqual(['m']);
    expect(ids('all', '801')).toEqual(['s']);
    expect(ids('core', 'maya')).toEqual([]);
  });

  it('compares filters, a group by its id', () => {
    expect(sameFilter('all', 'all')).toBe(true);
    expect(sameFilter('all', { groupId: 'g1' })).toBe(false);
    expect(sameFilter({ groupId: 'g1' }, { groupId: 'g1' })).toBe(true);
    expect(sameFilter({ groupId: 'g1' }, { groupId: 'g2' })).toBe(false);
  });

  it('shows twelve rows before Lihat semua (the report: lists show 12 rows)', () => {
    expect(CORE_LEADERS_PAGE_ROWS).toBe(12);
  });
});
