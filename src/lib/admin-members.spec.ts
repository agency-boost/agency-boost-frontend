import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { readAnggota, readMemberDetail, setTestAccount, statusChoiceOf, statusFilters } from './admin-members';

afterEach(() => vi.unstubAllGlobals());

describe('P19.23-T3 AC-1 Anggota’s client (ADR-0277; OD-421)', () => {
  it('P19.23-T3 AC-1 Akun tes is its own filter, never a status, and back again', () => {
    expect(statusFilters('test')).toEqual({ status: undefined, testAccount: 'only' });
    expect(statusFilters('active')).toEqual({ status: 'active', testAccount: undefined });
    expect(statusFilters('')).toEqual({ status: undefined, testAccount: undefined });
    expect(statusChoiceOf({ testAccount: 'only' })).toBe('test');
    expect(statusChoiceOf({ status: 'removed' })).toBe('removed');
    expect(statusChoiceOf({})).toBe('');
  });

  it('P19.23-T3 AC-1 reads the list with its filters, the detail by id, and writes the switch', async () => {
    const { calls } = stubFetch({
      '/admin/members?': { body: { rows: [], page: 1, pageSize: 50, total: 0, kpmCount: 0 } },
      '/admin/members/m 1': { body: {} },
      'PATCH /admin/users/u-1/test-account': { body: { userId: 'u-1', testAccount: false, memberships: 2 } },
    });
    await readAnggota({ role: 'aab', testAccount: 'only', page: 1 });
    expect(calls[0].url).toContain('/admin/members?role=aab&testAccount=only');
    await readMemberDetail('m 1').catch(() => undefined);
    expect(calls[1].url).toContain('/admin/members/m%201');
    expect(await setTestAccount('u-1', false)).toEqual({ userId: 'u-1', testAccount: false, memberships: 2 });
    expect(JSON.parse(String(calls[2].init.body))).toEqual({ testAccount: false });
  });
});
