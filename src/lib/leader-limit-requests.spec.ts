import { describe, expect, it } from 'vitest';
import { leaderLimitWords } from '@/components/leader-limit-notice';
import { rungLabel } from '@/components/ui/role-badge';
import {
  canRequestApproval, pendingFor, requestedChange, type LeaderLimitRequestRow,
} from './leader-limit-requests';

const row = (over: Partial<LeaderLimitRequestRow> = {}) => ({
  requestId: 'llr-1', subjectMembershipId: 'mem-1', status: 'pending', action: 'promote',
  fromOrgLevelCode: 'AGENT', toOrgLevelCode: 'AAB', ...over,
}) as LeaderLimitRequestRow;

/** A leader past the limit, as the office's screens read the API (P18.8-T2, ADR-0157). */
describe('leader-limit requests (P18.8-T2)', () => {
  it('AC-2 a refusal may be asked about only where the API says so', () => {
    expect(canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: { canRequest: true } })).toBe(true);
    expect(canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: { canRequest: false } })).toBe(false);
    expect(canRequestApproval({ code: 'LEADER_LIMIT_REACHED', details: { maxLeaders: 2 } })).toBe(false);
    expect(canRequestApproval({ code: 'VERSION_CONFLICT', details: { canRequest: true } })).toBe(false);
    expect(canRequestApproval(null)).toBe(false);
  });

  it('finds the open request about one member, and none in anything but a list', () => {
    const rows = [row({ status: 'declined' }), row({ requestId: 'llr-2' }), row({ requestId: 'llr-3', subjectMembershipId: 'mem-2' })];
    expect(pendingFor(rows, 'mem-1')?.requestId).toBe('llr-2');
    expect(pendingFor(rows, 'mem-9')).toBeNull();
    expect(pendingFor(null, 'mem-1')).toBeNull();
    expect(pendingFor({} as never, 'mem-1')).toBeNull();
  });

  it('says what waits: the rung change, or letting a pending leader in', () => {
    expect(requestedChange(row(), (code) => rungLabel(code))).toBe('Agent → Associate Agency Builder');
    expect(requestedChange(row({ action: 'activate', fromOrgLevelCode: 'AAB', toOrgLevelCode: null }), (code) => rungLabel(code)))
      .toBe('Let in as Associate Agency Builder');
  });

  it('AC-9 the roster’s words name the way through that asks; a role change’s offer the ask where it may be made', () => {
    const details = { maxLeaders: 10, leadersUsed: 10 };
    expect(leaderLimitWords({ details }, 'office', 'roster').said)
      .toContain('Import them as Agents, then promote them on their page: past the limit, that asks AgencyBoost to approve it.');
    expect(leaderLimitWords({ details: { ...details, canRequest: true } }, 'office', 'role').said)
      .toContain('Ask AgencyBoost to approve this one past the limit, or to raise it.');
    expect(leaderLimitWords({ details }, 'office', 'role').said).toContain('AgencyBoost can raise it.');
  });
});
