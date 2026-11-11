import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { cancelTransferRequest, requestTransfer } from './invites';
import { changeLeader, readLeaderChoices } from './org';

/**
 * **Changing who somebody reports to — the calls** (P19.12-T4; ADR-0247): the picker's leaders, a move made at once, a
 * leader's request to the office, and withdrawing it. Paths and bodies as the contract has them, ids encoded, a blank
 * reason and a blank search not sent.
 */
describe('P19.12-T4 the leader change calls', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.12-T4 AC-2 AC-3 calls the contract’s paths with its bodies', async () => {
    const { calls } = stubFetch({ '/': { body: {} } });
    await readLeaderChoices('mem/1');
    await readLeaderChoices('mem-1', '  Yosef ');
    await readLeaderChoices('mem-1', '   ');
    await changeLeader('mem-1', 'mem-2', '  Closer to home ');
    await changeLeader('mem-1', 'mem-2', '   ');
    await requestTransfer('mem-1', 'mem-3', 'Dekat kantor');
    await requestTransfer('mem-1', 'mem-3');
    await cancelTransferRequest('tr/9');
    expect(calls.map((c) => [c.init.method ?? 'GET', c.url.replace('http://api.test/api/v1', ''), c.init.body])).toEqual([
      ['GET', '/members/mem%2F1/leader-choices', undefined],
      ['GET', '/members/mem-1/leader-choices?q=Yosef', undefined],
      ['GET', '/members/mem-1/leader-choices', undefined],
      ['PUT', '/members/mem-1/leader', '{"leaderMembershipId":"mem-2","reason":"Closer to home"}'],
      ['PUT', '/members/mem-1/leader', '{"leaderMembershipId":"mem-2"}'],
      ['POST', '/members/mem-1/transfer-request', '{"leaderMembershipId":"mem-3","reason":"Dekat kantor"}'],
      ['POST', '/members/mem-1/transfer-request', '{"leaderMembershipId":"mem-3"}'],
      ['DELETE', '/transfer-requests/tr%2F9', undefined],
    ]);
  });
});
