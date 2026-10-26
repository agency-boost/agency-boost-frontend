import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import ActivityDashboardPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/activity/dashboard',
}));

const AGENT = makeMe({ permissions: ['activity_log:read_raw', 'activity_ratios:read'] });

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

/** Seven days, most recent first, ending Monday September 28. */
const WEEK = (() => {
  const sections = [
    section('LEADS_GENERATION', 'Leads Generation', [
      type('LEADS_CONTACTED', 'Menghubungi prospek', 3, [5, 4, 0, 0, 3, 0, 0], { description: 'Telepon, WhatsApp' }),
    ]),
    section('SELLING', 'Selling', [
      type('SELL_PRESENTATION', 'Presentasi penjualan', 4, [2, 3, 1, 0, 0, 0, 0]),
      type('SELL_SUBMISSION', 'Submission polis', 6, [1, 0, 0, 0, 0, 0, 0]),
    ]),
  ];
  const counts = sections[0].counts.map((_, i) => sections.reduce((t, s) => t + s.counts[i], 0));
  return {
    range: 'ROLLING_7D', from: '2026-09-22', to: '2026-09-28', days: 7, today: '2026-09-28',
    buckets: days('2026-09-28', 7), sections, counts, total: counts.reduce((a, b) => a + b, 0),
    daysLogged: 4, correctedDays: 0,
  };
})();

const MONTH = {
  ...WEEK,
  range: 'ROLLING_30D', from: '2026-08-30', days: 30,
  buckets: [
    { from: '2026-09-22', to: '2026-09-28', days: 7, kind: 'week' },
    { from: '2026-09-15', to: '2026-09-21', days: 7, kind: 'week' },
    { from: '2026-09-08', to: '2026-09-14', days: 7, kind: 'week' },
    { from: '2026-09-01', to: '2026-09-07', days: 7, kind: 'week' },
    { from: '2026-08-30', to: '2026-08-31', days: 2, kind: 'remainder' },
  ],
  sections: [section('SELLING', 'Selling', [type('SELL_SUBMISSION', 'Submission polis', 6, [1, 2, 0, 0, 1])])],
  counts: [1, 2, 0, 0, 1], total: 4, correctedDays: 1,
};

const dashboardCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/activity/dashboard'));

/** The five seeded sections, grouped as the seed groups them (ADR-0064). The strip is drawn from these. */
const SEEDED = [
  ['LEADS_GENERATION', 'Leads Generation', 'LEADS_GENERATION', 'Leads Generation'],
  ['SELLING', 'Selling', 'SELLING', 'Selling'],
  ['RECRUITMENT', 'Recruitment', 'RECRUITMENT', 'Recruitment'],
  ['PERSONAL_DEVELOPMENT', 'Personal Development', 'DEVELOPMENT', 'Development'],
  ['TEAM_DEVELOPMENT', 'Team Development', 'DEVELOPMENT', 'Development'],
].map(([code, label, summaryGroupCode, summaryGroupLabel], i) => ({
  id: `c${i}`, code, label, description: null, appliesToOrgLevelCodes: [] as string[],
  displayOrder: i + 1, version: 1, status: 'active', summaryGroupCode, summaryGroupLabel, types: [],
}));

/** The office's configuration, which the shell's provider reads once and the strip groups by. */
const config = (activity: unknown[] = SEEDED) => ({
  '/kpm/config': { body: { activity, ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
});

/** The page as the agent layout hands it over: inside the office's configuration. */
const render = () => renderWithSession(
  <TenantConfigProvider><ActivityDashboardPage /></TenantConfigProvider>,
  { me: AGENT },
);

/** The strip's tiles, label and value each. */
function strip() {
  const row = screen.getByText('Total touches').closest('[data-total]')!.parentElement!;
  return [...row.children].map((tile) => [tile.children[0].textContent, tile.children[1].textContent]);
}

describe('the Activity Dashboard (P10-T1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1, AC-4: opens on the last 7 days, and says which days they are', async () => {
    const { calls } = stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();

    // After the table: while it loads, the skeleton is the screen's one live region.
    await screen.findByText('Menghubungi prospek');
    expect(screen.getByRole('status')).toHaveTextContent('7 days · 22 Sep – 28 Sep 2026');
    expect(dashboardCalls(calls)[0].url).toContain('range=ROLLING_7D');
    // The reader's own days: no subject is named (P13.1-T9 — `for` is coaching's Activity tab's).
    expect(dashboardCalls(calls)[0].url).not.toContain('for=');
    expect(screen.getByRole('tab', { name: 'Last 7 days' })).toHaveAttribute('aria-selected', 'true');
  });

  it('AC-2: heads a day’s column with its weekday and date, most recent first', async () => {
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();

    const headers = (await screen.findAllByRole('columnheader')).map((h) => h.textContent);
    expect(headers.slice(0, 4)).toEqual(['Activity', 'Total', 'Sen28', 'Min27']);
  });

  it('AC-2: heads the last 30 days as weeks with their dates, and the two days left over', async () => {
    const { calls } = stubFetch({
      ...config(),
      '/activity/dashboard': { body: WEEK },
      '/activity/dashboard?range=ROLLING_30D': { body: MONTH },
    });
    render();
    await screen.findByText('Menghubungi prospek');

    await userEvent.click(screen.getByRole('tab', { name: 'Last 30 days' }));

    expect(await screen.findByRole('columnheader', { name: 'Week 1 22 Sep–28 Sep' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Remaining 2 days 30 Agu–31 Agu' })).toBeInTheDocument();
    expect(dashboardCalls(calls).at(-1)!.url).toContain('range=ROLLING_30D');
  });

  it('P10.1-T5 AC-6: says how many days and which, and no longer how many were corrected', async () => {
    // The Dashboard shows sums, not a corrected record: the log is where a correction is said
    // (ADR-0042). `MONTH` carries `correctedDays: 1`, and nothing reads it.
    stubFetch({
      ...config(),
      '/activity/dashboard': { body: WEEK },
      '/activity/dashboard?range=ROLLING_30D': { body: MONTH },
    });
    render();
    await screen.findByText('Menghubungi prospek');

    await userEvent.click(screen.getByRole('tab', { name: 'Last 30 days' }));

    await screen.findByRole('columnheader', { name: 'Week 1 22 Sep–28 Sep' });
    expect(screen.getByRole('status')).toHaveTextContent(/^30 days · 30 Agu – 28 Sep 2026$/);
    expect(screen.queryByText(/corrected/)).toBeNull();
  });

  it('P10.1-T5 AC-6: the same strip as Log Activity — the office’s tiles, then the total, over the range', async () => {
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    await screen.findByText('Menghubungi prospek');

    // `Overall.html:2752-2757`. Recruitment and Development have nothing in this range, and still
    // have their tiles: the grouping is the office's, not the answer's.
    await waitFor(() => expect(strip()).toEqual([
      ['Leads Generation', '12'], ['Selling', '7'], ['Recruitment', '0'], ['Development', '0'],
      ['Total touches', '19'],
    ]));
  });

  it('P10.1-T5 AC-6: counts Personal and Team Development in one Development tile', async () => {
    const dev = {
      ...WEEK,
      sections: [
        section('PERSONAL_DEVELOPMENT', 'Personal Development', [type('DEV_TRAINING', 'Training', 10, [1, 1, 0, 0, 0, 0, 0])]),
        section('TEAM_DEVELOPMENT', 'Team Development', [type('DEV_TEAM', 'Team', 12, [3, 0, 0, 0, 0, 0, 0])]),
      ],
      counts: [4, 1, 0, 0, 0, 0, 0], total: 5,
    };
    stubFetch({ ...config(), '/activity/dashboard': { body: dev } });
    render();
    await screen.findByText('Training');

    await waitFor(() => expect(strip()).toEqual([
      ['Leads Generation', '0'], ['Selling', '0'], ['Recruitment', '0'], ['Development', '5'],
      ['Total touches', '5'],
    ]));
  });

  it('P10.1-T5 AC-6: the total row is drawn in 30-day mode only, as the prototype draws it', async () => {
    // `renderDashboard` (`Overall.html:5101-5116`) adds it when `rangeMode === '30'`. I-135 had it on
    // every range, as an Improvement ADR-0062 §4 no longer licenses.
    stubFetch({
      ...config(),
      '/activity/dashboard': { body: WEEK },
      '/activity/dashboard?range=ROLLING_30D': { body: MONTH },
    });
    render();
    const week = await screen.findByRole('table', { name: 'Your activity' });
    expect(within(week).queryByText('Total — all categories')).toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: 'Last 30 days' }));
    await screen.findByRole('columnheader', { name: 'Week 1 22 Sep–28 Sep' });

    const month = screen.getByRole('table', { name: 'Your activity' });
    expect(within(month).getAllByRole('row')[1]).toHaveTextContent('Total — all categories4');
  });

  it('P10.1-T5 AC-6: the total row stays out of a custom range too', async () => {
    const { calls } = stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    await screen.findByText('Menghubungi prospek');

    await userEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    await waitFor(() => expect(dashboardCalls(calls).at(-1)!.url).toContain('range=CUSTOM'));

    expect(screen.queryByText('Total — all categories')).toBeNull();
  });

  it('AC-6: each section’s totals, and each type with its number and a muted zero', async () => {
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    const table = await screen.findByRole('table', { name: 'Your activity' });

    const rows = within(table).getAllByRole('row');
    // The first body row is a section: the grand total is the 30-day view's alone.
    expect(rows[1]).toHaveTextContent('Leads Generation12');
    const selling = rows.find((r) => within(r).queryByText('Selling'))!;
    expect(within(selling).getAllByRole('cell').slice(1, 3).map((c) => c.textContent)).toEqual(['7', '3']);

    const submission = rows.find((r) => within(r).queryByText('Submission polis'))!;
    expect(submission).toHaveTextContent('6'); // the number beside it
    const cells = within(submission).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('1');
    expect(cells[3]).toHaveTextContent('0');
    expect(cells[3]).toHaveClass('text-muted');
    expect(within(table).getByText('Telepon, WhatsApp')).toBeInTheDocument();
  });

  it('AC-3: opens Custom on the last seven days and asks for exactly those', async () => {
    const { calls } = stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    await screen.findByText('Menghubungi prospek');

    await userEvent.click(screen.getByRole('tab', { name: 'Custom' }));

    expect(screen.getByLabelText('From')).toHaveValue('2026-09-22');
    expect(screen.getByLabelText('To')).toHaveValue('2026-09-28');
    expect(screen.getByLabelText('To')).toHaveAttribute('max', '2026-09-28');
    await waitFor(() => expect(dashboardCalls(calls).at(-1)!.url).toContain('range=CUSTOM'));
    expect(dashboardCalls(calls).at(-1)!.url).toContain('from=2026-09-22');
  });

  it('AC-3: says why a range cannot be shown, beside the dates, and does not ask', async () => {
    const { calls } = stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    await screen.findByText('Menghubungi prospek');
    await userEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    await waitFor(() => expect(dashboardCalls(calls).at(-1)!.url).toContain('range=CUSTOM'));
    const asked = dashboardCalls(calls).length;

    await userEvent.clear(screen.getByLabelText('From'));
    await userEvent.type(screen.getByLabelText('From'), '2026-09-30');

    expect(await screen.findByRole('status')).toHaveTextContent('Pick a valid range — The range starts after it ends.');
    expect(screen.queryByRole('table', { name: 'Your activity' })).not.toBeInTheDocument();
    expect(dashboardCalls(calls)).toHaveLength(asked);
  });

  it('AC-3: asks about a date once it stops changing, not about every value it passes through', async () => {
    const { calls } = stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    await screen.findByText('Menghubungi prospek');
    await userEvent.click(screen.getByRole('tab', { name: 'Custom' }));
    await waitFor(() => expect(dashboardCalls(calls).at(-1)!.url).toContain('range=CUSTOM'));

    // A year typed a digit at a time passes through 0202 on the way to 2026.
    const from = screen.getByLabelText('From');
    fireEvent.change(from, { target: { value: '0202-09-01' } });
    fireEvent.change(from, { target: { value: '2026-09-01' } });

    await waitFor(() => expect(dashboardCalls(calls).at(-1)!.url).toContain('from=2026-09-01'));
    expect(dashboardCalls(calls).some((c) => c.url.includes('from=0202'))).toBe(false);
  });

  it('AC-3: shows the server’s reason when it refuses a range — a year at most', async () => {
    stubFetch({
      ...config(),
      '/activity/dashboard': { body: WEEK },
      '/activity/dashboard?range=CUSTOM': {
        status: 400,
        body: { error: { code: 'VALIDATION_FAILED', message: 'The range covers 400 days. The dashboard shows up to 366 at a time.', details: { max: 366 } } },
      },
    });
    render();
    await screen.findByText('Menghubungi prospek');

    await userEvent.click(screen.getByRole('tab', { name: 'Custom' }));

    expect(await screen.findByText(/Pick a valid range — The range covers 400 days/)).toBeInTheDocument();
  });

  it('AC-8: marks history the office has since hidden, so the totals still add up', async () => {
    const archived = {
      ...WEEK,
      sections: [
        section('SELLING', 'Selling', [
          type('SELL_SUBMISSION', 'Submission polis', 6, [1, 0, 0, 0, 0, 0, 0], { standing: 'archived' }),
        ]),
        section('TEAM_DEVELOPMENT', 'Team Development', [
          type('DEV_TEAM_ACTIVITY', 'Team development', 12, [2, 0, 0, 0, 0, 0, 0], { standing: 'not_shown' }),
        ], { standing: 'not_shown' }),
      ],
    };
    // The office has since narrowed Team Development to AB: this agent is not shown it.
    stubFetch({
      ...config(SEEDED.map((c) => (c.code === 'TEAM_DEVELOPMENT' ? { ...c, appliesToOrgLevelCodes: ['AB'] } : c))),
      '/activity/dashboard': { body: archived },
    });
    render();
    const table = await screen.findByRole('table', { name: 'Your activity' });

    expect(within(table).getByText('Archived')).toBeInTheDocument();
    expect(within(table).getByText('No longer in your sections')).toBeInTheDocument();
    // A section no longer shown adds to no tile; its history is in the table and the total.
    await waitFor(() => expect(strip()).toEqual([
      ['Leads Generation', '0'], ['Selling', '1'], ['Recruitment', '0'], ['Development', '0'],
      ['Total touches', '19'],
    ]));
  });

  it('AC-11: nothing logged is still a table, with a way to log', async () => {
    const empty = {
      ...WEEK,
      sections: WEEK.sections.map((s) => ({
        ...s, total: 0, counts: s.counts.map(() => 0),
        types: s.types.map((t) => ({ ...t, total: 0, counts: t.counts.map(() => 0) })),
      })),
      counts: WEEK.counts.map(() => 0), total: 0, daysLogged: 0,
    };
    stubFetch({ ...config(), '/activity/dashboard': { body: empty } });
    render();

    const note = await screen.findByText(/Nothing logged in this range yet/);
    expect(within(note).getByRole('link', { name: 'Log Activity' })).toHaveAttribute('href', '/activity/log');
    expect(screen.getByText('Submission polis')).toBeInTheDocument();
  });

  it('AC-11: waits in the shape of the table, and says so when it fails', async () => {
    stubFetch({
      ...config(),
      '/activity/dashboard': { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } } },
    });
    render();

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Your activity' })).not.toBeInTheDocument();
  });
});
