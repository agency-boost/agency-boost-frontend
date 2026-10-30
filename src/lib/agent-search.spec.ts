import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { agentHref, matchesAgent, searchAgents } from './agent-search';

describe('Search agent (UI V1, UI-012 / UI-059; D-14)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-012 asks GET /members/search with the trimmed query and the limit; none when blank', async () => {
    const { calls } = stubFetch({ '/members/search': { body: { members: [] } } });
    await searchAgents('  wahyu ');
    await searchAgents('');
    expect(calls[0].url).toMatch(/\/members\/search\?q=wahyu&limit=10$/);
    expect(calls[1].url).toMatch(/\/members\/search\?limit=10$/);
  });

  it('D-14 picking opens the agent dashboard on its Personal Summary tab', () => {
    expect(agentHref('m-1')).toBe('/coaching/m-1/summary');
  });

  it('UI-059 the Group Tree’s "Cari agen" matches as the server does: name, preferred name or code, any part, any case', () => {
    const wahyu = { fullName: 'Wahyu Saputra', preferredName: 'Yuyu', agentCode: '80014' };
    expect(matchesAgent('wahyu', wahyu)).toBe(true);
    expect(matchesAgent('SAPU', wahyu)).toBe(true);
    expect(matchesAgent('yuy', wahyu)).toBe(true);
    expect(matchesAgent('8001', wahyu)).toBe(true);
    expect(matchesAgent('novi', wahyu)).toBe(false);
    expect(matchesAgent('  ', wahyu)).toBe(true);
    expect(matchesAgent('x', { fullName: 'Dewi', agentCode: null })).toBe(false);
  });
});
