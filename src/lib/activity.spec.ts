import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { readActivityRatios, readActivitySummary } from './activity';

/**
 * The coaching session's two activity reads (P11-T4, P11-T8): the coachee's ratios on their rung, and
 * their last 7 days against pro-rated targets. Each names its subject the way its route does — `for`
 * on the ratios, `membershipId` on the summary (`functional/coaching.md`, *Data contract*).
 */
describe('a coachee’s activity reads (P11-T8 AC-5, AC-6)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T8 AC-5 reads her ratios with ?for=, and the reader’s own with no query', async () => {
    const { calls } = stubFetch({ '/activity/ratios': { body: {} } });
    await readActivityRatios('mem-rina');
    await readActivityRatios();
    expect(calls.map((c) => c.url)).toEqual([
      'http://api.test/api/v1/activity/ratios?for=mem-rina',
      'http://api.test/api/v1/activity/ratios',
    ]);
  });

  it('P11-T8 AC-6 reads her last 7 days by membershipId and period', async () => {
    const { calls } = stubFetch({ '/activity/summary': { body: {} } });
    await readActivitySummary({ membershipId: 'mem-rina', period: 'ROLLING_7D' });
    await readActivitySummary();
    expect(calls.map((c) => c.url)).toEqual([
      'http://api.test/api/v1/activity/summary?membershipId=mem-rina&period=ROLLING_7D',
      'http://api.test/api/v1/activity/summary',
    ]);
  });
});
