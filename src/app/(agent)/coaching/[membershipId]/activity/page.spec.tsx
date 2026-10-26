import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, routeParams, stubFetch, type StubResponse } from '@test/harness';
import CoachingPersonLayout from '../layout';
import CoacheeActivityTab from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching/mem-rina/activity',
}));

const LEADER = makeMe({
  user: {
    id: 'u-agus', email: 'agus@kpm0417.test', fullName: 'Agus Santoso', preferredName: 'Agus',
    pronoun: 'he', initials: 'AS', platformRole: 'none',
  },
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['coaching_session:read', 'activity_log:read_raw', 'activity_ratios:read'],
});

const RINA = {
  membershipId: 'mem-rina', name: 'Rina Wijaya', pronoun: 'she', rung: { code: 'AGENT', label: 'Agent' },
  leader: { membershipId: 'mem-agus', name: 'Agus Santoso' }, direct: true, downline: { members: 0, leaders: 0 },
  today: '2026-09-28',
};

const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - i);
  const iso = d.toISOString().slice(0, 10);
  return { from: iso, to: iso, days: 1, kind: 'day' as const };
});
const type = (code: string, label: string, displayOrder: number, counts: number[], over = {}) => ({
  code, label, description: null, displayOrder, standing: 'shown', total: counts.reduce((a, b) => a + b, 0), counts, ...over,
});
const section = (code: string, label: string, types: ReturnType<typeof type>[], over = {}) => {
  const counts = types[0].counts.map((_, i) => types.reduce((t, ty) => t + ty.counts[i], 0));
  return { code, label, standing: 'shown', total: counts.reduce((a, b) => a + b, 0), counts, types, ...over };
};
const answer = (sections: ReturnType<typeof section>[], over = {}) => {
  const counts = (sections[0]?.counts ?? [0, 0, 0, 0, 0, 0, 0]).map((_, i) => sections.reduce((t, s) => t + s.counts[i], 0));
  return {
    range: 'ROLLING_7D', from: '2026-09-22', to: '2026-09-28', days: 7, today: '2026-09-28',
    buckets: days('2026-09-28', 7), sections, counts, total: counts.reduce((a, b) => a + b, 0),
    daysLogged: 4, correctedDays: 0, ...over,
  };
};

/**
 * Rina's week: she recruits, and she logged a team activity before *Team Development* was narrowed to
 * leaders — history the server keeps visible, as a section no longer shown to her rung.
 */
const WEEK = answer([
  section('RECRUITMENT', 'Recruitment', [type('RECRUIT_FOLLOWUP', 'Follow up calon agen', 8, [5, 4, 0, 0, 3, 0, 0])]),
  section('SELLING', 'Selling', [type('SELL_SUBMISSION', 'Submission polis', 6, [0, 0, 0, 0, 0, 0, 0])]),
  section(
    'TEAM_DEVELOPMENT', 'Team Development',
    [type('DEV_TEAM_ACTIVITY', 'Kegiatan tim', 12, [1, 0, 0, 0, 0, 0, 0], { standing: 'not_shown' })],
    { standing: 'not_shown' },
  ),
]);

/**
 * The office's published sections. *Team Development* is for leaders only: Agus (AB) is shown it, Rina
 * (Agent) is not — so a strip drawn on the reader's rung would have a tile Rina never logs against.
 */
const CONFIG = [
  ['LEADS_GENERATION', 'Leads Generation', [], 'LEADS_GENERATION', 'Leads Generation'],
  ['SELLING', 'Selling', [], 'SELLING', 'Selling'],
  ['RECRUITMENT', 'Recruitment', [], 'RECRUITMENT', 'Recruitment'],
  ['TEAM_DEVELOPMENT', 'Team Development', ['AB', 'AAB'], 'TEAM_DEVELOPMENT', 'Team Development'],
].map(([code, label, appliesToOrgLevelCodes, summaryGroupCode, summaryGroupLabel], i) => ({
  id: `c${i}`, code, label, description: null, appliesToOrgLevelCodes,
  displayOrder: i + 1, version: 1, status: 'active', summaryGroupCode, summaryGroupLabel, types: [],
}));

const SHELL = {
  '/kpm/config': { body: { activity: CONFIG, ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/coaching/coachees/': { body: RINA },
};

const show = (dashboard: StubResponse | StubResponse[] | Record<string, StubResponse> = { body: WEEK }, me = LEADER) => {
  const routes = 'body' in dashboard || Array.isArray(dashboard)
    ? { '/activity/dashboard': dashboard as StubResponse }
    : dashboard as Record<string, StubResponse>;
  const stub = stubFetch({ ...SHELL, ...routes });
  renderInLayout(
    AgentLayout,
    <CoachingPersonLayout params={routeParams({ membershipId: 'mem-rina' })}><CoacheeActivityTab /></CoachingPersonLayout>,
    { me },
  );
  return stub;
};

const dashboardCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/activity/dashboard'));

/** The strip's tiles, label and value each. */
function strip() {
  const row = screen.getByText('Total touches').closest('[data-total]')!.parentElement!;
  return [...row.children].map((tile) => [tile.children[0].textContent, tile.children[1].textContent]);
}

/** The six words coaching's own strings never use (ADR-0084). */
const SIX_WORDS = /\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned/i;

describe('a coachee’s Activity tab (P13.1-T9)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P13.1-T9 AC-3 reads her days through GET /activity/dashboard?for=, the last 7 days first', async () => {
    const { calls } = show();

    expect(await screen.findByRole('table', { name: 'Rina Wijaya’s activity' })).toBeInTheDocument();
    const asked = dashboardCalls(calls);
    expect(asked).toHaveLength(1);
    expect(asked[0].url).toContain('for=mem-rina');
    expect(asked[0].url).toContain('range=ROLLING_7D');
    expect(screen.getByRole('status')).toHaveTextContent('7 days · 22 Sep – 28 Sep 2026');
    expect(screen.getByRole('tab', { name: 'Last 7 days' })).toHaveAttribute('aria-selected', 'true');
  });

  it('P13.1-T9 AC-3 draws the dashboard: the range, the strip and the table, per type and per day', async () => {
    show();
    const table = await screen.findByRole('table', { name: 'Rina Wijaya’s activity' });

    expect(within(table).getByText('Follow up calon agen')).toBeInTheDocument();
    expect((await within(table).findAllByRole('columnheader')).map((h) => h.textContent).slice(0, 4))
      .toEqual(['Activity', 'Total', 'Sen28', 'Min27']);
    // A section moved out of her sections says so in her words, not the reader's.
    expect(within(table).getByText('No longer in her sections')).toBeInTheDocument();
    expect(screen.queryByText(/your sections/)).toBeNull();
  });

  it('P13.1-T9 AC-1 draws the strip on her rung, not the reader’s: no Team Development tile', async () => {
    show();
    await screen.findByText('Follow up calon agen');

    // Agus is shown Team Development and Rina is not, so it has no tile here; its count stays in the
    // table and in the total, which is the server's and counts everything.
    await waitFor(() => expect(strip()).toEqual([
      ['Leads Generation', '0'], ['Selling', '0'], ['Recruitment', '12'], ['Total touches', '13'],
    ]));
  });

  it('P13.1-T9 AC-3 offers no Log Activity link, even on a range she logged nothing in', async () => {
    show({ body: answer([section('SELLING', 'Selling', [type('SELL_SUBMISSION', 'Submission polis', 6, [0, 0, 0, 0, 0, 0, 0])])]) });

    expect(await screen.findByText('Nothing logged in this range yet.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Log Activity' })).toBeNull();
  });

  it('P13.1-T9 AC-3 moves to the last 30 days for her, and keeps naming her', async () => {
    const { calls } = show({
      '/activity/dashboard': { body: WEEK },
      '/activity/dashboard?range=ROLLING_30D': {
        body: answer(WEEK.sections, {
          range: 'ROLLING_30D', from: '2026-08-30', days: 30,
          buckets: [{ from: '2026-09-22', to: '2026-09-28', days: 7, kind: 'week' }],
          sections: [section('RECRUITMENT', 'Recruitment', [type('RECRUIT_FOLLOWUP', 'Follow up calon agen', 8, [12])])],
          counts: [12], total: 12,
        }),
      },
    });
    await screen.findByText('Follow up calon agen');

    await userEvent.click(screen.getByRole('tab', { name: 'Last 30 days' }));

    expect(await screen.findByRole('columnheader', { name: 'Week 1 22 Sep–28 Sep' })).toBeInTheDocument();
    const last = dashboardCalls(calls).at(-1)!.url;
    expect(last).toContain('range=ROLLING_30D');
    expect(last).toContain('for=mem-rina');
  });

  it('P13.1-T9 shows the error banner when her days cannot be read, under the shell', async () => {
    show({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Membership not found.', requestId: 'r-1' } } });

    expect(await screen.findByText(/Membership not found/)).toBeInTheDocument();
    // The shell stays: the person and the tabs are still there.
    expect(screen.getByRole('heading', { level: 2, name: 'Rina Wijaya' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Coaching' })).toBeInTheDocument();
  });

  it('P13.1-T9 AC-4 is refused, with no dashboard read, to a reader without activity_log:read_raw', async () => {
    const { calls } = show(undefined, makeMe({ ...LEADER, permissions: ['coaching_session:read'] }));

    await screen.findByRole('heading', { level: 2, name: 'Rina Wijaya' });
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect(dashboardCalls(calls)).toHaveLength(0);
  });

  it('P13.1-T9 uses none of ADR-0084’s six words, and has no axe violations', async () => {
    show();
    await screen.findByText('Follow up calon agen');

    expect(document.body.textContent).not.toMatch(SIX_WORDS);
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
  });
});
