import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  AGUS_ME, dashboard, EMPTY, goalCell, RATIOS, ratio, rp, total, unitRow, UNITS,
} from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import AgentLayout from '../../layout';
import UnitDashboardPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
}));

const SHELL = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};

function render(
  view: UnitDashboardView | StubReply | StubReply[] = dashboard(),
  { me = AGUS_ME, period, routes = {} }: { me?: ReturnType<typeof makeMe>; period?: string; routes?: Record<string, StubReply | StubReply[]> } = {},
) {
  const reply = Array.isArray(view) || typeof view === 'function' || 'status' in view || 'body' in view ? view : { body: view };
  const stub = stubFetch({ 'GET /unit/dashboard': reply as StubReply, '/activity/ratios': { body: RATIOS }, ...routes });
  renderWithSession(<UnitDashboardPage searchParams={routeParams(period ? { period } : {})} />, { me });
  return stub;
}

const table = () => screen.findByRole('table', { name: 'Your team’s roster' });
/** A person's row, found by the link their name is. */
const rowOf = (name: string) => screen.getByRole('link', { name }).closest('tr')!;
const writes = (calls: { init: RequestInit }[]) => calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');

/** jsdom cannot follow a link: a click on one is kept from trying, as a test of a drill needs only its address. */
const stayPut = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('a')) e.preventDefault();
};

describe('the Unit Dashboard (P15-T2)', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.push.mockClear();
    document.addEventListener('click', stayPut);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  describe('the page, verbatim (AC-2)', () => {
    it('P15-T2 AC-1 is the roster now, not the sign it replaces', async () => {
      render();
      await table();
      expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: /^Upcoming/ })).not.toBeInTheDocument();
    });

    it('P15-T2 AC-2 is titled Unit Dashboard with no subtitle', async () => {
      render();
      await table();
      const title = screen.getByRole('heading', { level: 1 });
      expect(title).toHaveTextContent(/^Unit Dashboard$/);
      expect(title.nextElementSibling).toBeNull();
    });

    it('P15-T2 AC-2 offers Last 7 days · This month · This year, This month pressed first', async () => {
      render();
      await table();
      const group = screen.getByRole('group', { name: 'Period' });
      const buttons = within(group).getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(['Last 7 days', 'This month', 'This year']);
      expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    });

    it('P15-T2 AC-2 draws the four tiles in the prototype’s words', async () => {
      render();
      await table();
      expect(screen.getByText('Your team')).toBeInTheDocument();
      expect(screen.getByText('16 agents')).toBeInTheDocument();
      expect(screen.getByText('4 direct agents (including you) · 3 AAB units · 9 agents under AABs')).toBeInTheDocument();
      expect(screen.getByText('Direct Group production')).toBeInTheDocument();
      expect(screen.getByText('Rp 1.000.000.000 / Rp 1.280.000.000')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
      expect(screen.getByText('Potential Monthly Active Agents (Group)')).toBeInTheDocument();
      expect(screen.getByText('12 / 16 agents')).toBeInTheDocument();
      expect(screen.getByText('Potential Recruits (Group)')).toBeInTheDocument();
      const recruits = screen.getByText('Your unit').closest('p')!;
      expect(recruits).toHaveTextContent('Your unit1 candidate');
      expect(screen.getByText('Your AABs').closest('p')).toHaveTextContent('Your AABs1 candidate');
    });

    it('P15-T2 AC-2 names in the production tile who it leaves out, and says nothing is uploaded rather than 0', async () => {
      render(dashboard({
        tiles: {
          ...dashboard().tiles,
          directGroupProduction: { targetMinor: rp(320), actualMinor: null, attainmentPct: null, missing: 16, gapMinor: null, overMinor: null, period: 'month' },
        },
      }));
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(within(tile).getByText('Not uploaded yet')).toBeInTheDocument();
      expect(within(tile).getByText('of Rp 320.000.000 target')).toBeInTheDocument();
      expect(within(tile).getByRole('button', { name: /^Not uploaded yet for 16 people/ })).toBeInTheDocument();
      expect(tile.textContent).not.toMatch(/Rp 0\b|0%/);
    });

    it('P15-T2 AC-2 names Siti and Yanti in the production tile, the two the rows hold no figure for', async () => {
      render();
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(within(tile).getByRole('button', { name: 'Not uploaded yet for Siti Rahma, Yanti Puspita, so not counted in this total.' }))
        .toBeInTheDocument();
    });

    it('P15-T2 AC-2 says the year’s target is made, never “/ Rp 0”, when every target-holding row made it (ADR-0047)', async () => {
      render(dashboard({
        tiles: { ...dashboard().tiles, directGroupProduction: { targetMinor: 0, actualMinor: rp(10), attainmentPct: null, missing: 0, gapMinor: 0, overMinor: rp(10), period: 'month' } },
      }));
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(tile).toHaveTextContent('Rp 10.000.000');
      expect(within(tile).getByText('Year’s target made')).toBeInTheDocument();
      expect(tile.textContent).not.toMatch(/\/ Rp 0|of Rp 0|0%/);
    });

    it('P15-T2 AC-2 says No goal set in the production tile when nobody has a target', async () => {
      render(dashboard({
        tiles: { ...dashboard().tiles, directGroupProduction: { targetMinor: null, actualMinor: rp(10), attainmentPct: null, missing: 0, gapMinor: null, overMinor: null, period: 'month' } },
      }));
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(tile).toHaveTextContent('Rp 10.000.000');
      expect(tile).toHaveTextContent('No goal set');
    });

    it('P18.5-T7 AC-7 heads the roster Name · Goal progress · Chasing MDRT · Leads · Activity · Last 1:1 · Status, and a blank Remarks', async () => {
      render();
      const roster = await table();
      const headers = within(roster).getAllByRole('columnheader');
      expect(headers.map((h) => h.textContent!.split('ⓘ')[0].replace(/Chasing MDRT.*$/, 'Chasing MDRT'))).toEqual([
        'Name', 'Goal progress', 'Chasing MDRT', 'Leads', 'Activity', 'Last 1:1', 'Status', 'Details',
      ]);
      // The last heading is a name for a screen reader, blank on screen (OD-139).
      expect(within(headers[7]).getByText('Details')).toHaveClass('sr-only');
      expect(screen.queryByText('Remarks')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-2 puts the Status rules, verbatim, behind a control a keyboard reaches', async () => {
      render();
      await table();
      const info = screen.getByRole('button', { name: 'How is status decided?' });
      expect(info).toHaveAccessibleDescription([
        'Evaluated for the current calendar month, regardless of the period toggle above.',
        '1. Not projected to submit ≥1 policy this month? → Needs attention, full stop.',
        '2. Will qualify. Projected pace ≥90% of target? → On track.',
        '3. Will qualify, but pace under 90%? → Watch closely.',
      ].join('\n'));
      act(() => info.focus());
      expect(screen.getByText(/^Evaluated for the current calendar month/, { selector: '[role="tooltip"]' })).toBeVisible();
    });

    /*
     * P18.8-T15 AC-5 (ADR-0165 §2; the client's UI review, UI-001): the figure counts the types a goal is built from,
     * not every logged item, so it is not called touches and its header names the three.
     */
    it('P18.8-T15 AC-5 names the three goal activities behind the Activity header, a control a keyboard reaches', async () => {
      render();
      await table();
      const info = screen.getByRole('button', { name: 'What counts as a goal activity?' });
      expect(info).toHaveAccessibleDescription(
        'The activities a goal is built from: Set appointment, Sales meeting, Submission polis. Not every activity logged.',
      );
      act(() => info.focus());
      expect(screen.getByText(/^The activities a goal is built from/, { selector: '[role="tooltip"]' })).toBeVisible();
      expect(screen.getByRole('table')).not.toHaveTextContent(/touches/);
    });

    it('P15-T2 AC-2 titles the roster Your team’s roster, with Update production beside it', async () => {
      render();
      await table();
      expect(screen.getByRole('heading', { level: 2, name: 'Your team’s roster' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update production' })).toBeEnabled();
    });
  });

  describe('a row, verbatim (AC-3)', () => {
    it('P15-T2 AC-3 names the reader’s own row You (Agus), starred, with — for Last 1:1 and no Personal tag', async () => {
      render();
      await table();
      const row = rowOf('You (Agus)');
      expect(row).toHaveTextContent('★');
      expect(within(row).getAllByRole('cell')[4]).toHaveTextContent(/^—$/);
      expect(row).not.toHaveTextContent('Personal');
      expect(row).toHaveClass('bg-amber/5');
    });

    it('P15-T2 AC-3 marks a potential monthly active agent with a named ✓, and nobody else', async () => {
      render();
      await table();
      const dimas = rowOf('Dimas Pratama');
      const check = within(dimas).getByRole('button', {
        name: 'Potential Monthly Active Agent — pacing to submit at least 1 policy this month.',
      });
      expect(check).toHaveTextContent('✓');
      expect(within(rowOf('Siti Rahma')).queryByText('✓')).not.toBeInTheDocument();
      expect(within(rowOf('Sari Wulandari')).queryByText('✓')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-3 tags each unit head’s own row Personal', async () => {
      render();
      await table();
      for (const head of ['Arief Wibowo', 'Sari Wulandari', 'Wulan Sari']) {
        expect(within(rowOf(head)).getByText('Personal')).toBeInTheDocument();
      }
      expect(within(rowOf('Dimas Pratama')).queryByText('Personal')).not.toBeInTheDocument();
      // Dewi is on a leader rung and leads nobody: a unit of one, no Personal row.
      expect(within(rowOf('Dewi Kartika')).queryByText('Personal')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-3 writes the goal over or short, over achieved of target', async () => {
      render();
      await table();
      expect(rowOf('You (Agus)')).toHaveTextContent('135% · +Rp 28.000.000 overRp 108.000.000 of Rp 80.000.000');
      expect(rowOf('Dimas Pratama')).toHaveTextContent('82% · Rp 14.400.000 shortRp 65.600.000 of Rp 80.000.000');
      expect(within(rowOf('You (Agus)')).getByText('135% · +Rp 28.000.000 over')).toHaveClass('text-success');
      expect(within(rowOf('Dimas Pratama')).getByText('82% · Rp 14.400.000 short')).toHaveClass('text-alert');
    });

    it('P15-T2 AC-3 says Not uploaded yet and No goal set, never 0', async () => {
      render();
      await table();
      expect(within(rowOf('Siti Rahma')).getAllByRole('cell')[0]).toHaveTextContent(/^Not uploaded yetof Rp 80\.000\.000 target$/);
      expect(within(rowOf('Sari Wulandari')).getAllByRole('cell')[0]).toHaveTextContent(/^No goal setRp 65\.600\.000$/);
    });

    it('P15-T2 AC-3 writes the leads lines, the recruit line a dash with nothing to recruit', async () => {
      render();
      await table();
      expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[2]).toHaveTextContent('Sales: 9 · 4 closingRecruit: —');
      expect(within(rowOf('Indah Lestari')).getAllByRole('cell')[2]).toHaveTextContent('Sales: 6 · 2 closingRecruit: 2 · 1 nominated');
    });

    it('P15-T2 AC-3 writes the goal activities against their target, with the bar', async () => {
      render();
      await table();
      const cell = within(rowOf('Dimas Pratama')).getAllByRole('cell')[3];
      // *Goal activities*, not *touches* (ADR-0165 §2, P18.8-T15 AC-5).
      expect(cell).toHaveTextContent('85 / 95 goal activities');
      expect(cell.querySelector('[aria-hidden="true"] > div')).toHaveStyle({ width: '89%' });
    });

    it('P15-T2 AC-3 and P15-T4 AC-1 write Last 1:1 as coaching does: No 1:1 yet, Today, days ago, overdue in red and in words, by whom', async () => {
      render();
      await table();
      const last = (name: string) => within(rowOf(name)).getAllByRole('cell')[4];
      expect(last('Siti Rahma')).toHaveTextContent(/^No 1:1 yet$/);
      expect(within(last('Siti Rahma')).getByText('No 1:1 yet')).toHaveClass('text-alert');
      expect(last('Rina Wijaya')).toHaveTextContent(/^Todayby Sari Wulandari$/);
      expect(last('Indah Lestari')).toHaveTextContent(/^4 days agoby Agus Santoso$/);
      expect(within(last('Indah Lestari')).getByText('4 days ago')).toHaveClass('text-success');
      // *Overdue* in visible words, not by colour alone (P18.8-T15 AC-7).
      expect(last('Dimas Pratama')).toHaveTextContent(/^12 days ago · overdueby Agus Santoso$/);
      expect(within(last('Dimas Pratama')).getByText('12 days ago · overdue')).toHaveClass('text-alert');
      expect(last('Dimas Pratama').querySelector('.sr-only')).toBeNull();
    });

    it('P15-T2 AC-3 writes one day as one day ago', async () => {
      render(dashboard({
        yourUnit: {
          ...dashboard().yourUnit,
          rows: [unitRow('mem-x', 'Xena Putri', { lastOneOnOne: { days: 1, date: '2026-10-07', overdue: false, coach: null } })],
        },
        units: [],
      }));
      await table();
      expect(within(rowOf('Xena Putri')).getAllByRole('cell')[4]).toHaveTextContent(/^1 day ago$/);
    });

    it('P15-T2 AC-3 puts each status in its pill, with its tooltip as the pill’s description', async () => {
      render();
      await table();
      const pill = (name: string) => within(rowOf(name)).getAllByRole('cell')[5].querySelector('button')!;
      expect(pill('Indah Lestari')).toHaveAccessibleName('On track');
      expect(pill('Indah Lestari')).toHaveAccessibleDescription(
        'Pacing to qualify as a Monthly Active Agent, at or above 90% of expected goal pace.',
      );
      expect(pill('Dimas Pratama')).toHaveAccessibleName('Watch closely');
      expect(pill('Dimas Pratama')).toHaveAccessibleDescription(
        'Still pacing to qualify as a Monthly Active Agent, but under 90% of expected goal pace — worth a check-in.',
      );
      expect(pill('Siti Rahma')).toHaveAccessibleName('Needs attention');
      expect(pill('Siti Rahma')).toHaveAccessibleDescription(
        'Not projected to submit a policy this month — will not qualify as a Monthly Active Agent.',
      );
      expect(pill('Sari Wulandari')).toHaveAccessibleName('No goal set');
      expect(pill('Sari Wulandari')).toHaveAccessibleDescription('No goal saved for this year, so there is no pace to measure this month against.');
    });

    it('P15-T3 AC-1 marks a corrected figure with who and when, and the file’s own with nothing', async () => {
      render();
      await table();
      const goal = within(rowOf('Indah Lestari')).getAllByRole('cell')[0];
      expect(within(goal).getByRole('button', {
        name: 'Corrected after the production upload, October 2026, by Ibu Ratna on Oct 6, 2026',
      })).toHaveTextContent('ⓘ');
      expect(within(within(rowOf('Dimas Pratama')).getAllByRole('cell')[0]).queryByRole('button')).not.toBeInTheDocument();
    });

    it('P15-T3 AC-1 marks the agent’s own figure as theirs', async () => {
      const own = { provenance: 'self_reported' as const, month: null, correctedBy: null, correctedAt: null };
      render(dashboard({
        yourUnit: { ...dashboard().yourUnit, rows: [unitRow('mem-x', 'Xena Putri', { goal: goalCell({ source: own }) })] },
        units: [],
      }));
      await table();
      expect(screen.getByRole('button', { name: 'Their own figure, entered in Goal Settings' })).toBeInTheDocument();
    });

    it('P15-T2 AC-9 names each ⌄ View details for its person, closed', async () => {
      render();
      await table();
      expect(screen.getByRole('button', { name: 'View details for you' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByRole('button', { name: 'View details for Dimas Pratama' })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getAllByRole('button', { name: /^View details for / })).toHaveLength(14);
    });
  });

  describe('groups and totals (AC-4)', () => {
    it('P15-T2 AC-4 groups Your Unit · 4 and its total, then AAB units, each unit’s total before its head', async () => {
      render();
      const roster = await table();
      const headers = within(roster).getAllByRole('rowheader').map((h) => h.textContent!.replace(/[▶★✓ⓘ↳]/g, '').trim());
      expect(headers.map((h) => h.split(/Potential Monthly|Personal|Not uploaded/)[0].trim())).toEqual([
        'Your Unit · 4', 'Your Unit — Total', 'You (Agus)', 'Dimas Pratama', 'Indah Lestari', 'Siti Rahma',
        'AAB units',
        'Arief Wibowo’s Unit — Total', 'Arief Wibowo', 'Novi Anggraini', 'Wahyu Hidayat',
        'Dewi Kartika’s Unit — Total', 'Dewi Kartika',
        'Sari Wulandari’s Unit — Total', 'Sari Wulandari', 'Budi Santoso', 'Rina Wijaya', 'Yanti Puspita',
        'Wulan Sari’s Unit — Total', 'Wulan Sari', 'Tono Saputra',
      ]);
    });

    it('P15-T2 AC-4 draws a total’s goal, leads, recruits, touches, — for Last 1:1 and its potential active', async () => {
      render();
      await table();
      const totalRow = screen.getByRole('rowheader', { name: 'Your Unit — Total' }).closest('tr')!;
      const cells = within(totalRow).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent('82% · Rp 57.600.000 shortRp 262.400.000 of Rp 320.000.000');
      // A total chases nothing (`:7458`, P18.5-T7 AC-7).
      expect(cells[1]).toHaveTextContent(/^—$/);
      expect(within(cells[1]).queryByRole('button')).not.toBeInTheDocument();
      expect(cells[2]).toHaveTextContent('Sales: 36 · 16 closingRecruit: 1 potential recruit');
      expect(cells[3]).toHaveTextContent('340 / 380 goal activities');
      expect(cells[4]).toHaveTextContent(/^—$/);
      expect(cells[5]).toHaveTextContent('3/4 potential active');
    });

    it('P15-T2 AC-4 names in a unit’s total who it leaves out', async () => {
      render();
      await table();
      const sari = screen.getByRole('rowheader', { name: 'Sari Wulandari’s Unit — Total' }).closest('tr')!;
      expect(within(sari).getByRole('button', { name: 'Not uploaded yet for Yanti Puspita, so not counted in this total.' }))
        .toBeInTheDocument();
    });

    /*
     * P18.8-T15 AC-6 (ADR-0165 §1; the client's UI review, UI-004): the total pairs each target with the production it
     * measures, so the shortfall is the server's, from those pairs — never the screen's own subtraction.
     */
    it('P18.8-T15 AC-6 writes a total’s shortfall as the server paired it, and names who is left out', async () => {
      const paired = dashboard({
        yourUnit: {
          ...dashboard().yourUnit,
          total: total({ goal: { targetMinor: rp(142.666667), actualMinor: rp(13), attainmentPct: 9, missing: 2, gapMinor: rp(129.666667), overMinor: 0 } }),
        },
      });
      render(paired);
      await table();
      const cells = within(screen.getByRole('rowheader', { name: 'Your Unit — Total' }).closest('tr')!).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent('9% · Rp 129.666.667 short');
      expect(cells[0]).toHaveTextContent('Rp 13.000.000 of Rp 142.666.667');
    });

    it('P18.8-T15 AC-6 a total with nobody’s production held reads Not uploaded yet, beside its target, as a row does', async () => {
      render(dashboard({
        yourUnit: {
          ...dashboard().yourUnit,
          total: total({ goal: { targetMinor: rp(135), actualMinor: null, attainmentPct: null, missing: 4, gapMinor: null, overMinor: null } }),
        },
      }));
      await table();
      const cells = within(screen.getByRole('rowheader', { name: 'Your Unit — Total' }).closest('tr')!).getAllByRole('cell');
      expect(cells[0]).toHaveTextContent('Not uploaded yet');
      expect(cells[0]).toHaveTextContent('of Rp 135.000.000 target');
      expect(cells[0]).not.toHaveTextContent('short');
    });

    it('P15-T2 AC-4 nests a unit inside a unit one step further in, behind ↳', async () => {
      render();
      await table();
      const indent = (name: string) => (rowOf(name).querySelector('th > div') as HTMLElement).style.paddingLeft;
      expect(indent('Dimas Pratama')).toBe('');
      expect(indent('Arief Wibowo')).toBe('26px');
      expect(indent('Novi Anggraini')).toBe('26px');
      expect(indent('Wulan Sari')).toBe('52px');
      expect(indent('Tono Saputra')).toBe('52px');
    });

    it('P15-T2 AC-4 draws no AAB units when there are none, and no Your Unit when it holds nobody', async () => {
      render(dashboard({ units: [] }));
      await table();
      expect(screen.queryByText('AAB units')).not.toBeInTheDocument();

      vi.unstubAllGlobals();
      document.body.innerHTML = '';
      render(dashboard({ yourUnit: { ...dashboard().yourUnit, rows: [] } }));
      await table();
      expect(screen.queryByText('Your Unit — Total')).not.toBeInTheDocument();
      expect(screen.getByText('AAB units')).toBeInTheDocument();
    });
  });

  describe('the expanded detail (AC-5)', () => {
    it('P15-T2 AC-5 opens on the ⌄: Gap, Activity breakdown, Ratios and the follow-up, overdue', async () => {
      const { calls } = render();
      await table();
      const button = screen.getByRole('button', { name: 'View details for Dimas Pratama' });
      await userEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      const detail = document.getElementById(button.getAttribute('aria-controls')!)!;
      expect(detail.tagName).toBe('TD');
      expect(within(detail).getByRole('heading', { name: 'Gap' })).toBeInTheDocument();
      expect(detail).toHaveTextContent('Rp 14.400.000 remaining');
      expect(detail).toHaveTextContent('≈ 1 policy needed at their avg case size of Rp 18.000.000.');
      expect(detail).toHaveTextContent('Activity breakdownSet appointment63/70Sales meeting18/20Submission polis4/5');
      // P18.5-T7 AC-8: the last tile opens with the chases, the follow-up beneath them.
      expect(detail).toHaveTextContent(
        'Campaigns they’re chasing🚀 MDRT Qualification🚀 Q4 APE SprintFlagged follow-up (system-detected)Overdue 3dRole-play objection handling before next presentation',
      );
      // The ratios are read now, for this person, and drawn as the prototype's chips.
      await within(detail).findByText('Selling success rate');
      expect(calls.filter((c) => c.url.includes('/activity/ratios')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/activity/ratios?for=mem-dimas']);
      expect(detail).toHaveTextContent('Selling success rate18.0%');
      expect(detail).toHaveTextContent('Recruitment success rate–');
      expect(detail).toHaveTextContent('Selling vs Recruitment70% Selling · 30% Recruitment');
    });

    it('P15-T2 AC-5 reads no ratios for somebody the reader does not coach, and draws no drill for them', async () => {
      const outside = unitRow('mem-out', 'Orang Luar', { coached: false });
      const { calls } = render({ body: dashboard({ yourUnit: { ...dashboard().yourUnit, rows: [...dashboard().yourUnit.rows, outside] } }) });
      await table();
      expect(screen.queryByRole('link', { name: 'Orang Luar' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'View details for Orang Luar' }));
      expect(await screen.findAllByRole('heading', { name: 'Gap' })).not.toHaveLength(0);
      expect(screen.queryByRole('heading', { name: 'Ratios' })).not.toBeInTheDocument();
      expect(calls.some((c) => c.url.includes('/activity/ratios'))).toBe(false);
    });

    it('P15-T2 AC-5 reads no ratios until a row is opened, and once for a row opened twice', async () => {
      const { calls } = render();
      await table();
      expect(calls.some((c) => c.url.includes('/activity/ratios'))).toBe(false);
      const button = screen.getByRole('button', { name: 'View details for Dimas Pratama' });
      await userEvent.click(button);
      await screen.findByText('Selling success rate');
      await userEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      await userEvent.click(button);
      await screen.findByText('Selling success rate');
      expect(calls.filter((c) => c.url.includes('/activity/ratios'))).toHaveLength(1);
    });

    it('P15-T2 AC-5 reads the reader’s own ratios with no for, and writes an upcoming item’s date', async () => {
      const { calls } = render();
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'View details for you' }));
      await screen.findByText('Selling success rate');
      expect(calls.filter((c) => c.url.includes('/activity/ratios')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/activity/ratios']);
      await userEvent.click(screen.getByRole('button', { name: 'View details for Indah Lestari' }));
      const detail = document.getElementById(
        screen.getByRole('button', { name: 'View details for Indah Lestari' }).getAttribute('aria-controls')!,
      )!;
      expect(detail).toHaveTextContent('Oct 12Send the illustration to Pak Hendra');
    });

    it('P15-T2 AC-5 draws no follow-up tile when there is none, and the gap’s own words without a goal', async () => {
      render();
      await table();
      const button = screen.getByRole('button', { name: 'View details for Sari Wulandari' });
      await userEvent.click(button);
      const detail = document.getElementById(button.getAttribute('aria-controls')!)!;
      expect(detail).not.toHaveTextContent('Flagged follow-up');
      // The chases' tile is always drawn (P18.5-T7 AC-8): Sari chases nothing.
      expect(within(detail).getAllByRole('heading').map((h) => h.textContent))
        .toEqual(['Gap', 'Activity breakdown', 'Ratios', 'Campaigns they’re chasing']);
      expect(detail).toHaveTextContent('Campaigns they’re chasingNot currently chasing any campaigns.');
      expect(detail).toHaveTextContent('GapNo goal set');
    });

    it('P15-T2 AC-5 waits for the ratios in its own skeleton, and fails in its own place with a retry', async () => {
      render(dashboard(), {
        routes: {
          '/activity/ratios': [
            { status: 500, body: { error: { code: 'INTERNAL', message: 'The ratios could not be read.', requestId: 'r-1' } } },
            { body: RATIOS },
          ],
        },
      });
      await table();
      const button = screen.getByRole('button', { name: 'View details for Dimas Pratama' });
      fireEvent.click(button);
      const detail = document.getElementById(button.getAttribute('aria-controls')!)!;
      expect(within(detail).getByText('Working out the ratios…')).toBeInTheDocument();
      expect(await within(detail).findByRole('alert')).toHaveTextContent('The ratios could not be read.');
      // The rest of the detail is there all the same.
      expect(detail).toHaveTextContent('Rp 14.400.000 remaining');
      await userEvent.click(within(detail).getByRole('button', { name: 'Try again' }));
      expect(await within(detail).findByText('Selling success rate')).toBeInTheDocument();
    });

    it('P15-T2 AC-5 says Sales-only for a balance all on the selling side, and when there are no ratios', async () => {
      render(dashboard(), {
        routes: {
          '/activity/ratios': [
            {
              body: {
                ...RATIOS,
                ratios: [ratio({
                  code: 'BAL', label: 'Selling vs Recruitment', comparison: 'band', displayUnit: 'points', benchmark: 30,
                  value: 100, share: 100, numeratorCount: 5, denominatorCount: 0, sides: { numerator: 'Selling', denominator: 'Recruitment' }, status: 'alert',
                }), ratio({ code: 'LPA', label: 'Leads per activity', displayUnit: 'decimal', benchmark: 0.3, value: 0.4, status: 'success' }),
                // A balance whose sides have no one name each says how far it leans, in points.
                ratio({ code: 'LEAN', label: 'Leaning', comparison: 'band', displayUnit: 'points', benchmark: 30, value: 10, share: 55, sides: null, status: 'success' })],
              },
            },
            { body: { ...RATIOS, ratios: [] } },
          ],
        },
      });
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
      expect(await screen.findByText('Sales-only')).toHaveClass('text-muted');
      expect(screen.getByText('0.40')).toHaveClass('text-success');
      expect(screen.getByText('Leaning').nextElementSibling).toHaveTextContent(/points/);
      await userEvent.click(screen.getByRole('button', { name: 'View details for Siti Rahma' }));
      expect(await screen.findByText('There are no ratios for this role yet.')).toBeInTheDocument();
    });

    it('P15-T2 AC-9 toggles the detail from the row itself, and not from a click on a drill', async () => {
      render();
      await table();
      const row = rowOf('Dimas Pratama');
      const button = screen.getByRole('button', { name: 'View details for Dimas Pratama' });
      fireEvent.click(within(row).getAllByRole('cell')[3]);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(within(row).getAllByRole('cell')[3]);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(screen.getByRole('link', { name: 'Dimas Pratama' }));
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('the period switch (AC-6)', () => {
    it('P15-T2 AC-6 re-reads the dashboard for each period and puts it in the address', async () => {
      const { calls } = render([
        { body: dashboard() },
        { body: dashboard({ period: '7d' }) },
        { body: dashboard({ period: 'year' }) },
      ]);
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
      expect(nav.replace).toHaveBeenLastCalledWith('/unit/dashboard?period=7d', { scroll: false });
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'This year' }));
      expect(nav.replace).toHaveBeenLastCalledWith('/unit/dashboard?period=year', { scroll: false });
      await table();
      expect(calls.filter((c) => c.url.includes('/unit/dashboard')).map((c) => c.url)).toEqual([
        'http://api.test/api/v1/unit/dashboard?period=month',
        'http://api.test/api/v1/unit/dashboard?period=7d',
        'http://api.test/api/v1/unit/dashboard?period=year',
      ]);
    });

    it('P15-T2 AC-6 does not read again for the period already on', async () => {
      const { calls } = render();
      await table();
      await userEvent.click(screen.getByRole('button', { name: 'This month' }));
      expect(nav.replace).not.toHaveBeenCalled();
      expect(calls.filter((c) => c.url.includes('/unit/dashboard'))).toHaveLength(1);
    });

    it('P15-T2 AC-6 reads This month when the address carries no query at all', async () => {
      const { calls } = stubFetch({ 'GET /unit/dashboard': { body: dashboard() } });
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
      await table();
      expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute('aria-pressed', 'true');
      expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=month');
    });

    it('P15-T2 AC-6 opens on the address’s period, so a refresh keeps it', async () => {
      const { calls } = render(dashboard({ period: 'year' }), { period: 'year' });
      await table();
      expect(screen.getByRole('button', { name: 'This year' })).toHaveAttribute('aria-pressed', 'true');
      expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=year');
    });

    it('P15-T2 AC-6 keeps Status and the ✓ across the periods, as the server answers them', async () => {
      render([{ body: dashboard() }, { body: dashboard({ period: '7d' }) }]);
      await table();
      const before = screen.getAllByRole('button', { name: /^(On track|Watch closely|Needs attention|No goal set)$/ }).map((b) => b.textContent);
      const checks = screen.getAllByRole('button', { name: /^Potential Monthly Active Agent/ }).length;
      await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      await table();
      expect(screen.getAllByRole('button', { name: /^(On track|Watch closely|Needs attention|No goal set)$/ }).map((b) => b.textContent))
        .toEqual(before);
      expect(screen.getAllByRole('button', { name: /^Potential Monthly Active Agent/ })).toHaveLength(checks);
    });

    it('P15-T2 AC-3 and D-period say this month under Last 7 days, and pro-rated targets', async () => {
      render(dashboard({ period: '7d' }), { period: '7d' });
      await table();
      expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[0]).toHaveTextContent('Rp 65.600.000 of Rp 80.000.000 · this month');
      expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[3]).toHaveTextContent('85 / 95 pro-rated goal activities');
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(within(tile).getByText('this month')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
      expect(screen.getByText('63/70 pro-rated')).toBeInTheDocument();
    });

    it('P15-T2 AC-6 says nothing of this month on the month and the year', async () => {
      render(dashboard({ period: 'year' }), { period: 'year' });
      await table();
      expect(screen.queryByText(/this month$/)).not.toBeInTheDocument();
      expect(screen.queryByText(/pro-rated/)).not.toBeInTheDocument();
    });
  });

  describe('the drills (AC-7)', () => {
    it('P15-T2 AC-7 opens a person’s Personal Summary, Goal Setting and Coaching Session tabs, in the same tab', async () => {
      render();
      await table();
      const row = rowOf('Dimas Pratama');
      const links = within(row).getAllByRole('link');
      expect(links.map((l) => l.getAttribute('href'))).toEqual([
        '/coaching/mem-dimas/summary', '/coaching/mem-dimas/goal-setting', '/coaching/mem-dimas/session',
      ]);
      for (const link of links) expect(link).not.toHaveAttribute('target');
    });

    it('P15-T2 AC-7 opens the reader’s own screens from their own row', async () => {
      render();
      await table();
      expect(within(rowOf('You (Agus)')).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/summary', '/goals', '/leads']);
    });

    it('P15-T2 AC-7 writes nothing when a drill is followed, nor when a row opens', async () => {
      const { calls } = render();
      await table();
      for (const link of within(rowOf('Dimas Pratama')).getAllByRole('link')) fireEvent.click(link);
      await userEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
      await screen.findByText('Selling success rate');
      expect(writes(calls)).toEqual([]);
    });
  });

  describe('the states the prototype lacks (AC-8)', () => {
    it('P15-T2 AC-8 waits in a skeleton shaped like the tiles and the table', async () => {
      stubFetch({ 'GET /unit/dashboard': { body: dashboard() } });
      renderWithSession(<UnitDashboardPage searchParams={routeParams({})} />, { me: AGUS_ME });
      expect(screen.getByText('Loading your team’s roster…').closest('[role="status"]')).toBeInTheDocument();
      await table();
      expect(screen.queryByText('Loading your team’s roster…')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-8 fails with a retry that keeps the period', async () => {
      const { calls } = render([
        { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.', requestId: 'r-9' } } },
        { body: dashboard({ period: 'year' }) },
      ], { period: 'year' });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await table();
      expect(calls.map((c) => c.url)).toEqual([
        'http://api.test/api/v1/unit/dashboard?period=year',
        'http://api.test/api/v1/unit/dashboard?period=year',
      ]);
    });

    it('P15-T2 AC-8 shows somebody who leads nobody an empty unit in plain words, pointing to their own screens', async () => {
      const { container } = (() => {
        stubFetch({ 'GET /unit/dashboard': { body: EMPTY } });
        return renderWithSession(<UnitDashboardPage searchParams={routeParams({})} />, { me: AGUS_ME });
      })();
      expect(await screen.findByText('Nobody is in your unit yet.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Personal summary' })).toHaveAttribute('href', '/summary');
      expect(screen.getByRole('link', { name: 'Activity management' })).toHaveAttribute('href', '/activity/log');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Period' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
      expect(container.textContent).not.toMatch(/\d|phase/i);
      expect(container.textContent).not.toMatch(/office|KPM|reports to|tagged to|untagged|unassigned/i);
    });
  });

  describe('who sees what (AC-10)', () => {
    const member = (over: Record<string, unknown>) => makeMe({
      membership: {
        membershipId: 'mem-x', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
        isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...over,
      },
      permissions: ['unit_dashboard:read'],
    });

    it.each([
      ['an AB who leads', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 })],
      ['an AAB who leads', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 2 })],
      ['the Owner in their field view', member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 5, isKpmOwner: true })],
      ['the Admin in their field view', member({ orgLevelCode: 'AAB', hierarchyRole: 'aab', directCount: 1, isKpmAdmin: true })],
    ])('P15-T2 AC-10 reads the roster for %s', async (_who, me) => {
      const { calls } = render(dashboard(), { me });
      await table();
      expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=month');
    });

    it('P15-T2 AC-10 answers an Agent who leads nobody with the empty unit, not a refusal', async () => {
      render(EMPTY, { me: member({}) });
      expect(await screen.findByText('Nobody is in your unit yet.')).toBeInTheDocument();
      expect(screen.queryByText('Not available to you')).not.toBeInTheDocument();
    });

    it('P15-T2 AC-10 refuses a reader without the grant, naming no code and asking for nothing', () => {
      const { calls } = render(dashboard(), { me: makeMe({ permissions: [] }) });
      expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert').textContent).not.toMatch(/[a-z_]+:[a-z_]+/);
      expect(calls).toHaveLength(0);
    });

    it('P15-T2 AC-10 and P15-T3 AC-4 draw no Update production in a read-only support session', async () => {
      const support = makeMe({ ...AGUS_ME, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'Root' });
      render(dashboard(), { me: support });
      await table();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    });

    it('P15-T3 AC-4 draws no Update production when the server says the reader may not use it', async () => {
      render(dashboard({ production: { month: '2026-10', revision: 7, locked: false, canUpdate: false } }));
      await table();
      expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    });

    it('P15-T2 AC-1 sits inside the agent shell, with Unit dashboard the current item', async () => {
      stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() } });
      renderInLayout(AgentLayout, <UnitDashboardPage searchParams={routeParams({})} />, { me: AGUS_ME });
      await table();
      const main = screen.getByRole('navigation', { name: 'Main' });
      expect(within(main).getByRole('link', { name: 'Unit dashboard' })).toHaveAttribute('aria-current', 'page');
    });
  });
});

describe('Update production (P15-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const open = async () => {
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'Update production' }));
    return screen.getByRole('dialog', { name: 'Update production' });
  };
  const box = (dialog: HTMLElement, which: 'Month' | 'Year', name: string) =>
    within(dialog).getByRole('textbox', { name: `${which} achieved (Rp), ${name}` });

  it('P15-T3 AC-3 opens the dialog verbatim, its first box focused', async () => {
    render();
    const dialog = await open();
    expect(dialog).toHaveAccessibleDescription(
      'Enter the latest figures from the company report — month and year are updated independently.',
    );
    expect(within(dialog).getAllByRole('columnheader').map((h) => h.textContent))
      .toEqual(['Name', 'Month achieved (Rp)', 'Year achieved (Rp)']);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveTextContent('✕');
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save all' })).toBeInTheDocument();
    expect(box(dialog, 'Month', 'You (Agus)')).toHaveFocus();
  });

  it('P15-T3 AC-3 groups the rows as drawn, and prefills the month table’s figures, blank where it holds none', async () => {
    render();
    const dialog = await open();
    expect(within(dialog).getAllByRole('rowheader').filter((h) => h.getAttribute('scope') === 'rowgroup').map((h) => h.textContent))
      .toEqual(['Your direct agents', 'Arief Wibowo’s unit', 'Dewi Kartika’s unit', 'Sari Wulandari’s unit']);
    expect(box(dialog, 'Month', 'Dimas Pratama')).toHaveValue('65.600.000');
    expect(box(dialog, 'Year', 'Dimas Pratama')).toHaveValue('620.000.000');
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('');
    expect(box(dialog, 'Year', 'Yanti Puspita')).toHaveValue('120.000.000');
    // Nested beneath their head, one step further in for each level.
    expect((within(dialog).getByText('Tono Saputra') as HTMLElement).style.paddingLeft).toBe('36px');
  });

  it('P15-T3 AC-3 sends only the changed cells in minor units, toasts the rows changed, and reads the dashboard again', async () => {
    const { calls } = render([{ body: dashboard() }, { body: dashboard() }], {
      routes: { 'PATCH /unit/dashboard/production': { body: { updated: 2, state: {} } } },
    });
    const dialog = await open();
    await userEvent.clear(box(dialog, 'Month', 'Dimas Pratama'));
    await userEvent.type(box(dialog, 'Month', 'Dimas Pratama'), '70000000');
    expect(box(dialog, 'Month', 'Dimas Pratama')).toHaveValue('70.000.000');
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '12500000');
    // Emptied: unchanged, not cleared.
    await userEvent.clear(box(dialog, 'Year', 'Budi Santoso'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));

    expect(await screen.findByText('Production updated for 2 agents.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const save = writes(calls);
    expect(save).toHaveLength(1);
    expect(save[0].init.method).toBe('PATCH');
    expect(JSON.parse(save[0].init.body as string)).toEqual({
      month: '2026-10',
      revision: 7,
      rows: [
        { membershipId: 'mem-dimas', apeMonthlyMinor: rp(70) },
        { membershipId: 'mem-yanti', apeMonthlyMinor: rp(12.5) },
      ],
    });
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/unit/dashboard?'))).toHaveLength(2));
  });

  it('P15-T3 AC-3 says one agent in the singular, and sends nothing when nothing changed', async () => {
    const { calls } = render([{ body: dashboard() }, { body: dashboard() }], {
      routes: { 'PATCH /unit/dashboard/production': { body: { updated: 1, state: {} } } },
    });
    let dialog = await open();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await screen.findByText('Production updated for 0 agents.')).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);

    dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await screen.findByText('Production updated for 1 agent.')).toBeInTheDocument();
  });

  it('P15-T3 AC-3 keeps what was typed when the month is locked, and shows why in the dialog', async () => {
    render(dashboard(), {
      routes: {
        'PATCH /unit/dashboard/production': {
          status: 409, body: { error: { code: 'UPLOAD_MONTH_LOCKED', message: 'October 2026 is locked.', requestId: 'r-2' } },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '9000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('October 2026 is locked.');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('9.000.000');
  });

  it('P15-T3 AC-3 marks the box a figure out of bounds names', async () => {
    render(dashboard(), {
      routes: {
        'PATCH /unit/dashboard/production': {
          status: 422,
          body: {
            error: {
              code: 'UPLOAD_VALUE_OUT_OF_RANGE', message: 'That figure is out of range.', requestId: 'r-3',
              details: { membershipId: 'mem-yanti', cadence: 'monthly' },
            },
          },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '999999999999');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('That figure is out of range.');
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveAttribute('aria-invalid', 'true');
    expect(box(dialog, 'Year', 'Yanti Puspita')).not.toHaveAttribute('aria-invalid');
  });

  it('P15-T3 AC-3 reads the dashboard again behind a stale revision, and pins the next save to the new one', async () => {
    const { calls } = render([
      { body: dashboard() },
      { body: dashboard({ production: { month: '2026-10', revision: 8, locked: false, canUpdate: true } }) },
    ], {
      routes: {
        'PATCH /unit/dashboard/production': [
          { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Somebody else changed these figures.', requestId: 'r-4' } } },
          { body: { updated: 1, state: {} } },
        ],
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Somebody else changed these figures.');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/unit/dashboard?'))).toHaveLength(2));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save all' }));
    await screen.findByText('Production updated for 1 agent.');
    const saves = writes(calls).map((c) => JSON.parse(c.init.body as string));
    expect(saves.map((s) => s.revision)).toEqual([7, 8]);
    expect(saves[1].rows).toEqual([{ membershipId: 'mem-yanti', apeMonthlyMinor: rp(5) }]);
  });

  it('P15-T3 AC-3 reads the dashboard again when the month was locked meanwhile, so the button takes the lock', async () => {
    const { calls } = render([
      { body: dashboard() },
      { body: dashboard({ production: { month: '2026-10', revision: 8, locked: true, canUpdate: true } }) },
    ], {
      routes: {
        'PATCH /unit/dashboard/production': {
          status: 409, body: { error: { code: 'UPLOAD_MONTH_LOCKED', message: 'October 2026 is locked.', requestId: 'r-5' } },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('October 2026 is locked.');
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/unit/dashboard?'))).toHaveLength(2));
  });

  it('P15-T3 AC-3 closes on Cancel and on ✕, writing nothing', async () => {
    const { calls } = render();
    let dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    dialog = await open();
    // Opened again, it starts from the month table's figures, not from what was typed and cancelled.
    expect(box(dialog, 'Month', 'Yanti Puspita')).toHaveValue('');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('P15-T3 draws Update production unusable on a locked month, saying who reopens it', async () => {
    render(dashboard({ production: { month: '2026-10', revision: 7, locked: true, canUpdate: true } }));
    await table();
    const button = screen.getByRole('button', { name: 'Update production' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Production for October 2026 is locked. The Owner or Admin can reopen it.');
    await userEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P15-T3 AC-3 keeps the units’ other rows within reach of the dialog', async () => {
    render(dashboard({ units: [UNITS[2]] }));
    const dialog = await open();
    expect(box(dialog, 'Month', 'Wulan Sari')).toBeInTheDocument();
    expect(box(dialog, 'Year', 'Tono Saputra')).toBeInTheDocument();
  });
});

describe('Chasing MDRT and Campaigns they’re chasing (P18.5-T7 AC-7, AC-8)', () => {
  beforeEach(() => document.addEventListener('click', stayPut));
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  const mdrt = (name: string) => within(rowOf(name)).getAllByRole('cell')[1];

  it('P18.5-T7 AC-7 draws the column between Goal progress and Leads, at the prototype’s eight widths', async () => {
    render();
    const roster = await table();
    const widths = [...roster.querySelectorAll('col')].map((c) => c.className);
    expect(widths).toEqual(['w-[17%]', 'w-[13%]', 'w-[11%]', 'w-[15%]', 'w-[13%]', 'w-[10%]', 'w-[12%]', 'w-[9%]']);
    expect(roster).toHaveClass('min-w-[1080px]');
    // Every group's band and an open detail span all eight.
    expect(screen.getByRole('rowheader', { name: /^Your Unit · 4/ })).toHaveAttribute('colspan', '8');
  });

  it('P18.5-T7 AC-7 the header’s tooltip is the server’s sentence about the MDRT campaign (OD-152), its description', async () => {
    render();
    await table();
    const header = screen.getByRole('button', { name: 'Chasing MDRT' });
    expect(header).toHaveAccessibleDescription('Chasing MDRT (Million Dollar Round Table) this year — APE achieved ≥ Rp 2.400.000.000.');
    act(() => header.focus());
    expect(screen.getByText(/^Chasing MDRT \(Million Dollar Round Table\)/, { selector: '[role="tooltip"]' })).toBeVisible();
  });

  it('P18.5-T7 AC-7 says so when the office runs no MDRT campaign, and the column is drawn all the same', async () => {
    const tooltip = 'Chasing MDRT (Million Dollar Round Table) this year — no MDRT campaign is running.';
    render(dashboard({ mdrt: { running: false, tooltip } }));
    await table();
    expect(screen.getByRole('button', { name: 'Chasing MDRT' })).toHaveAccessibleDescription(tooltip);
    expect(within(mdrt('Siti Rahma')).getByRole('button', { name: 'Not currently chasing MDRT.' })).toBeInTheDocument();
  });

  it('P18.5-T7 AC-7 ✓ with the prototype’s tooltip for a chaser — the reader by first name — and — for anybody else', async () => {
    render();
    await table();
    const own = within(mdrt('You (Agus)')).getByRole('button', { name: 'Agus is chasing MDRT this year.' });
    expect(own).toHaveTextContent('✓');
    expect(within(mdrt('Dimas Pratama')).getByRole('button', { name: 'Dimas Pratama is chasing MDRT this year.' })).toHaveTextContent('✓');
    expect(within(mdrt('Rina Wijaya')).getByRole('button', { name: 'Rina Wijaya is chasing MDRT this year.' })).toBeInTheDocument();
    const not = within(mdrt('Siti Rahma')).getByRole('button', { name: 'Not currently chasing MDRT.' });
    expect(not).toHaveTextContent('—');
  });

  it('P18.5-T7 AC-7 the ✓ is gold-ink, the token at ≥ 3:1, never the prototype’s raw gold', async () => {
    render();
    await table();
    const check = within(mdrt('Dimas Pratama')).getByRole('button');
    expect(check).toHaveClass('text-gold-ink');
    expect(check.className).not.toMatch(/#|text-gold(?!-ink)/);
  });

  it('P18.5-T7 AC-7 claims nothing for somebody whose chases the reader may not read: a plain —', async () => {
    const beyond = unitRow('mem-x', 'Xena Putri', { chasingMdrt: null, campaigns: null });
    render(dashboard({ yourUnit: { ...dashboard().yourUnit, rows: [beyond] }, units: [] }));
    await table();
    expect(mdrt('Xena Putri')).toHaveTextContent(/^—$/);
    expect(within(mdrt('Xena Putri')).queryByRole('button')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View details for Xena Putri' }));
    expect(await screen.findAllByRole('heading', { name: 'Gap' })).not.toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Campaigns they’re chasing' })).not.toBeInTheDocument();
  });

  it('P18.5-T7 AC-8 the detail’s chips are 🚀 and the title, and the tile is drawn with nothing chased', async () => {
    render();
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
    const tile = screen.getByRole('heading', { name: 'Campaigns they’re chasing' }).parentElement!;
    expect(within(tile).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['🚀 MDRT Qualification', '🚀 Q4 APE Sprint']);
    await userEvent.click(screen.getByRole('button', { name: 'View details for Siti Rahma' }));
    const tiles = screen.getAllByRole('heading', { name: 'Campaigns they’re chasing' });
    expect(tiles).toHaveLength(2);
    expect(tiles[1].parentElement).toHaveTextContent('Not currently chasing any campaigns.');
  });

  it('P18.5-T7 AC-8 reads the chases in the dashboard’s one read, and asks for no campaign besides', async () => {
    const { calls } = render();
    await table();
    await userEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
    await screen.findByText('Selling success rate');
    expect(calls.some((c) => /\/campaigns/.test(c.url))).toBe(false);
  });
});
