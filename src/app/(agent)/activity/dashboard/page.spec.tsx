import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import { PHONE_QUERY } from '@/lib/use-phone';
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
  // A tile's label without the ⓘ the total carries (P18.95-T9 AC-3), which `touchTip` asserts on its own.
  return [...row.children].map((tile) => [tile.children[0].textContent!.replace(/ ⓘ.*$/, ''), tile.children[1].textContent]);
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
    expect(headers.slice(0, 4)).toEqual(['Activity', 'Total', 'Mon28', 'Sun27']);
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
    expect(screen.getByRole('columnheader', { name: 'Remaining 2 days 30 Aug–31 Aug' })).toBeInTheDocument();
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
    expect(screen.getByRole('status')).toHaveTextContent(/^30 days · 30 Aug – 28 Sep 2026$/);
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

/*
 * **Totals on a phone, and a tap for the days** (P18.95-T3 AC-6, ADR-0167 §6; the client's UI review of 2026-10-26,
 * UI-012: *Total* and every day off the screen to the right). The phone is `matchMedia` answering `usePhone`'s
 * query; every spec above is the table a tablet and a desktop keep.
 */
describe('P18.95-T3 — the Activity Dashboard on a phone', () => {
  const onPhone = (matches = true) => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: matches && query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
  })));
  const list = () => screen.findByRole('list', { name: 'Your activity' });
  /** A line's button, by the item it names. */
  const lineOf = (label: string) => screen.getAllByRole('button', { expanded: false }).concat(screen.queryAllByRole('button', { expanded: true }))
    .find((b) => b.querySelector('span > span')?.textContent === label)!;

  afterEach(() => vi.unstubAllGlobals());

  it('P18.95-T3 AC-6 draws each item’s total in place of the day columns, in the table’s order, and no table', async () => {
    onPhone();
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    const lines = within(await list()).getAllByRole('listitem');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(lines.map((li) => li.querySelector('button')!.textContent)).toEqual([
      'Leads Generation, total 12⌄',
      '3Menghubungi prospekTelepon, WhatsApp, total 12⌄',
      'Selling, total 7⌄',
      '4Presentasi penjualan, total 6⌄',
      '6Submission polis, total 1⌄',
    ]);
    // A section keeps its band, and nothing of a day is drawn until a line is opened.
    expect(lines[0]).toHaveClass('bg-navy/5');
    expect(within(await list()).queryByRole('term')).not.toBeInTheDocument();
    // The strip and the range are the table's, above it.
    expect(screen.getByRole('status')).toHaveTextContent('7 days · 22 Sep – 28 Sep 2026');
  });

  it('P18.95-T3 AC-6 opens an item’s days from a tap or the keyboard, each day above its count, the table’s figures', async () => {
    // The table's row for an item, as a tablet draws it …
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    const table = await screen.findByRole('table', { name: 'Your activity' });
    const row = within(table).getAllByRole('row').find((r) => within(r).queryByText('Presentasi penjualan'))!;
    const tableCounts = within(row).getAllByRole('cell').slice(2).map((c) => c.textContent);
    const headings = within(table).getAllByRole('columnheader').slice(2).map((h) => h.textContent);
    cleanup();

    // … and the same on the phone, once the line is opened.
    onPhone();
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    await list();
    const line = lineOf('Presentasi penjualan');
    expect(line).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(line);
    expect(line).toHaveAttribute('aria-expanded', 'true');
    const days = document.getElementById(line.getAttribute('aria-controls')!)!;
    expect(days.tagName).toBe('DL');
    const terms = within(days).getAllByRole('term').map((t) => t.textContent);
    const counts = within(days).getAllByRole('definition').map((d) => d.textContent);
    expect(terms).toEqual(headings.map((h) => h!.replace(/^(\D+)(\d+)$/, '$1 $2')));
    expect(terms.slice(0, 2)).toEqual(['Mon 28', 'Sun 27']);
    expect(counts).toEqual(tableCounts);
    expect(counts).toEqual(['2', '3', '1', '0', '0', '0', '0']);
    expect(within(days).getAllByRole('definition')[3]).toHaveClass('text-muted');

    // The keyboard closes it as a tap does, and another line opens on its own.
    line.focus();
    await userEvent.keyboard('{Enter}');
    expect(line).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(days.id)).toBeNull();
    await userEvent.keyboard(' ');
    expect(line).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(lineOf('Selling'));
    expect(lineOf('Selling')).toHaveAttribute('aria-expanded', 'true');
    expect(line).toHaveAttribute('aria-expanded', 'true');
  });

  it('P18.95-T3 AC-6 in 30-day mode leads with Total — all categories, and opens each week and the days left over', async () => {
    onPhone();
    stubFetch({
      ...config(),
      '/activity/dashboard': { body: WEEK },
      '/activity/dashboard?range=ROLLING_30D': { body: MONTH },
    });
    render();
    await list();
    await userEvent.click(screen.getByRole('tab', { name: 'Last 30 days' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Your activity' })).getAllByRole('listitem')[0])
      .toHaveTextContent('Total — all categories, total 4'));
    const all = lineOf('Total — all categories');
    await userEvent.click(all);
    const weeks = document.getElementById(all.getAttribute('aria-controls')!)!;
    expect(within(weeks).getAllByRole('term').map((t) => t.textContent)).toEqual([
      'Week 122 Sep–28 Sep', 'Week 215 Sep–21 Sep', 'Week 38 Sep–14 Sep', 'Week 41 Sep–7 Sep', 'Remaining 2 days30 Aug–31 Aug',
    ]);
    expect(within(weeks).getAllByRole('definition').map((d) => d.textContent)).toEqual(['1', '2', '0', '0', '1']);
  });

  it('P18.95-T3 AC-6 marks history the office has since hidden on its line, as the table does', async () => {
    onPhone();
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
    stubFetch({ ...config(), '/activity/dashboard': { body: archived } });
    render();
    const items = within(await list());
    expect(items.getByText('Archived')).toBeInTheDocument();
    expect(items.getByText('No longer in your sections')).toBeInTheDocument();
  });

  it('P18.95-T3 AC-6 never draws the table first on a phone: the width is asked before the first answer', async () => {
    onPhone();
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    expect(await drewATable(async () => {
      render();
      await list();
    })).toBe(false);
  });

  it('P18.95-T3 AC-6 keeps the table at 768px and wider', async () => {
    onPhone(false);
    stubFetch({ ...config(), '/activity/dashboard': { body: WEEK } });
    render();
    expect(await screen.findByRole('table', { name: 'Your activity' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Your activity' })).not.toBeInTheDocument();
  });
});

/** Whether a `<table>` was ever put on the page while `run` waited: a phone's first paint must already be its cards. */
async function drewATable(run: () => Promise<unknown>) {
  let seen = false;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('table') || node.querySelector('table'))) seen = true;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  await run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  observer.disconnect();
  return seen;
}
