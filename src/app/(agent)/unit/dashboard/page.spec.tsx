import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderInLayout, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import {
  AGUS_ME, dashboard, EMPTY, goalCell, NEW_HIRE_VIEW, RATIOS, ratio, rp, total, unitRow, UNITS,
} from '@test/unit-dashboard-fixtures';
import { TERMS } from '@/lib/terms';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import { PHONE_QUERY } from '@/lib/use-phone';
import AgentLayout from '../../layout';
import UnitDashboardPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

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
  nav.search = new URLSearchParams(period ? { period } : {}).toString();
  renderWithSession(<UnitDashboardPage />, { me });
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
      // P18.95-T7 AC-1 (grey text row 19): the client's line, its two parts adding up to the headline — 4 + 3 + 9.
      expect(screen.getByText('4 direct · 12 under AABs')).toBeInTheDocument();
      expect(screen.queryByText(/direct agents \(including/)).not.toBeInTheDocument();
      expect(screen.getByText('Direct Group production')).toBeInTheDocument();
      expect(screen.getByText('Rp 1 M / 1,3 M')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
      // P18.95-T9 AC-4: the prototype's *Potential Monthly Active Agents (Group)*, in plain words — on pace, not active.
      expect(screen.getByText('On pace to be active (Group)')).toBeInTheDocument();
      expect(screen.queryByText('Potential Monthly Active Agents (Group)')).not.toBeInTheDocument();
      expect(screen.queryByText(/Active this month/)).not.toBeInTheDocument();
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
      expect(within(tile).getByText('of Rp 320 jt target')).toBeInTheDocument();
      expect(within(tile).getByRole('button', { name: /^Not uploaded yet for 16 people/ })).toBeInTheDocument();
      expect(tile.textContent).not.toMatch(/Rp 0\b|0%/);
    });

    it('P15-T2 AC-2, P18.95-T7 AC-1 names Siti and Yanti in the production tile’s ⓘ, the two the rows hold no figure for', async () => {
      render();
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      const words = 'Not uploaded yet for Siti Rahma, Yanti Puspita, so not counted in this total.';
      expect(within(tile).getByRole('button', { name: words })).toBeInTheDocument();
      // Grey text row 20, the client's *ⓘ*: it is one at every size already, and never a sentence on the tile.
      expect(within(tile).getAllByText(words).every((el) => el.getAttribute('role') === 'tooltip' || el.classList.contains('sr-only')))
        .toBe(true);
    });

    it('P15-T2 AC-2 says the year’s target is made, never “/ Rp 0”, when every target-holding row made it (ADR-0047)', async () => {
      render(dashboard({
        tiles: { ...dashboard().tiles, directGroupProduction: { targetMinor: 0, actualMinor: rp(10), attainmentPct: null, missing: 0, gapMinor: 0, overMinor: rp(10), period: 'month' } },
      }));
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(tile).toHaveTextContent('Rp 10 jt');
      expect(within(tile).getByText('Year’s target made')).toBeInTheDocument();
      expect(tile.textContent).not.toMatch(/\/ Rp 0|of Rp 0|0%/);
    });

    it('P15-T2 AC-2 says No goal set in the production tile when nobody has a target', async () => {
      render(dashboard({
        tiles: { ...dashboard().tiles, directGroupProduction: { targetMinor: null, actualMinor: rp(10), attainmentPct: null, missing: 0, gapMinor: null, overMinor: null, period: 'month' } },
      }));
      await table();
      const tile = screen.getByText('Direct Group production').parentElement!;
      expect(tile).toHaveTextContent('Rp 10 jt');
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

    it('P15-T2 AC-3, P18.95-T9 AC-4 marks a potential monthly active agent with a named ✓, and nobody else', async () => {
      render();
      await table();
      const dimas = rowOf('Dimas Pratama');
      // Named for a screen reader, and no longer a button repeating the sentence on every row (UI-028).
      const mark = within(dimas).getByText('Potential Monthly Active Agent');
      expect(mark).toHaveClass('sr-only');
      expect(mark.parentElement).toHaveTextContent(/^✓Potential Monthly Active Agent$/);
      expect(within(dimas).queryByRole('button', { name: /pacing to submit/ })).not.toBeInTheDocument();
      expect(within(rowOf('Siti Rahma')).queryByText('Potential Monthly Active Agent')).not.toBeInTheDocument();
      expect(within(rowOf('Sari Wulandari')).queryByText('Potential Monthly Active Agent')).not.toBeInTheDocument();
    });

    it('P18.95-T9 AC-4 explains the ✓ once, as the Name heading’s ⓘ, in the one-line definition', async () => {
      render();
      await table();
      const name = screen.getByRole('columnheader', { name: /^Name/ });
      const tip = within(name).getByRole('button', { name: 'What is a Potential Monthly Active Agent?' });
      expect(tip).toHaveAccessibleDescription(TERMS.POTENTIAL_MAA.definition);
      expect(TERMS.POTENTIAL_MAA.definition).toMatch(/pacing, from this month’s activity, to submit at least 1 policy this month/);
      // Once on the screen, however many rows carry a ✓.
      expect(screen.getAllByRole('button', { name: 'What is a Potential Monthly Active Agent?' })).toHaveLength(1);
      expect(screen.getAllByText('Potential Monthly Active Agent').length).toBeGreaterThan(1);
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

    it('P15-T2 AC-3, P18.97-T3 AC-1 writes the goal over or short, its percentage whole, over achieved of target', async () => {
      render();
      await table();
      expect(rowOf('You (Agus)')).toHaveTextContent('135% · +Rp 28 jt overRp 108 jt of 80 jt');
      expect(rowOf('Dimas Pratama')).toHaveTextContent('82% · Rp 14,4 jt shortRp 65,6 jt of 80 jt');
      expect(within(rowOf('You (Agus)')).getByText('135% · +Rp 28 jt over')).toHaveClass('text-success');
      expect(within(rowOf('Dimas Pratama')).getByText('82% · Rp 14,4 jt short')).toHaveClass('text-alert');
    });

    it('P15-T2 AC-3 says Not uploaded yet and No goal set, never 0', async () => {
      render();
      await table();
      expect(within(rowOf('Siti Rahma')).getAllByRole('cell')[0]).toHaveTextContent(/^Not uploaded yetof Rp 80 jt target$/);
      expect(within(rowOf('Sari Wulandari')).getAllByRole('cell')[0]).toHaveTextContent(/^No goal setproduced Rp 65,6 jt$/);
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
        name: 'Corrected after the production upload, Okt 2026, by Ibu Ratna on 6 Okt 2026',
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

    it('P18.95-T1 AC-10 takes a tap on a 44px square on a phone, and keeps its outlined 28px box', async () => {
      // UI-029: the ⌄ was 28px. Below 768px only; the box a tablet and a desktop draw is unchanged.
      render();
      await table();
      const toggle = screen.getByRole('button', { name: 'View details for Dimas Pratama' });
      expect(toggle).toHaveClass('h-7', 'w-7', 'border', 'max-md:relative', 'max-md:after:absolute', 'max-md:after:h-[max(100%,2.75rem)]', 'max-md:after:w-[max(100%,2.75rem)]');
      expect(toggle).not.toHaveClass('relative');
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
      expect(cells[0]).toHaveTextContent('82% · Rp 57,6 jt shortRp 262,4 jt of 320 jt');
      // A total chases nothing (`:7458`, P18.5-T7 AC-7).
      expect(cells[1]).toHaveTextContent(/^—$/);
      expect(within(cells[1]).queryByRole('button')).not.toBeInTheDocument();
      expect(cells[2]).toHaveTextContent('Sales: 36 · 16 closingRecruit: 1 potential recruit');
      expect(cells[3]).toHaveTextContent('340 / 380 goal activities');
      expect(cells[4]).toHaveTextContent(/^—$/);
      // P18.95-T9 AC-4: what it counts, in plain words — members on pace, `POTENTIAL_MAA_COUNT_IN_UNIT`.
      expect(cells[5]).toHaveTextContent(/^On pace to be active: 3\/4$/);
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
      expect(cells[0]).toHaveTextContent('9% · Rp 129,7 jt short');
      expect(cells[0]).toHaveTextContent('Rp 13 jt of 142,7 jt');
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
      expect(cells[0]).toHaveTextContent('of Rp 135 jt target');
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
      expect(detail).toHaveTextContent('Rp 14,4 jt remaining');
      expect(detail).toHaveTextContent('≈ 1 policy needed at their avg case size of Rp 18 jt.');
      expect(detail).toHaveTextContent('Activity breakdownSet appointment63/70Sales meeting18/20Submission polis4/5');
      // P18.5-T7 AC-8: the last tile opens with the chases, the follow-up beneath them.
      expect(detail).toHaveTextContent(
        'Campaigns they’re chasing🚀 MDRT Qualification🚀 Q4 APE SprintFlagged follow-up (system-detected)Overdue 3dRole-play objection handling before next presentation',
      );
      // The ratios are read now, for this person, and drawn as the prototype's chips.
      await within(detail).findByText('Selling success rate');
      expect(calls.filter((c) => c.url.includes('/activity/ratios')).map((c) => c.url))
        .toEqual(['http://api.test/api/v1/activity/ratios?for=mem-dimas']);
      expect(detail).toHaveTextContent('Selling success rate18,0%');
      expect(detail).toHaveTextContent('Recruitment success rate–');
      expect(detail).toHaveTextContent('Selling vs Recruitment70,0% Selling · 30,0% Recruitment');
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
      expect(detail).toHaveTextContent('12 OktSend the illustration to Pak Hendra');
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
      expect(detail).toHaveTextContent('Rp 14,4 jt remaining');
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
      expect(screen.getByText('0,40')).toHaveClass('text-success');
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
      const checks = screen.getAllByText('Potential Monthly Active Agent').length;
      await userEvent.click(screen.getByRole('button', { name: 'Last 7 days' }));
      await table();
      expect(screen.getAllByRole('button', { name: /^(On track|Watch closely|Needs attention|No goal set)$/ }).map((b) => b.textContent))
        .toEqual(before);
      expect(screen.getAllByText('Potential Monthly Active Agent')).toHaveLength(checks);
    });

    it('P15-T2 AC-3 and D-period say this month under Last 7 days, and pro-rated targets', async () => {
      render(dashboard({ period: '7d' }), { period: '7d' });
      await table();
      expect(within(rowOf('Dimas Pratama')).getAllByRole('cell')[0]).toHaveTextContent('Rp 65,6 jt of 80 jt · this month');
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
      renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
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
        return renderWithSession(<UnitDashboardPage />, { me: AGUS_ME });
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
      renderInLayout(AgentLayout, <UnitDashboardPage />, { me: AGUS_ME });
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
          status: 409, body: { error: { code: 'UPLOAD_MONTH_LOCKED', message: 'Okt 2026 is locked.', requestId: 'r-2' } },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '9000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Okt 2026 is locked.');
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
          status: 409, body: { error: { code: 'UPLOAD_MONTH_LOCKED', message: 'Okt 2026 is locked.', requestId: 'r-5' } },
        },
      },
    });
    const dialog = await open();
    await userEvent.type(box(dialog, 'Month', 'Yanti Puspita'), '5000000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save all' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Okt 2026 is locked.');
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
    expect(button).toHaveAccessibleDescription('Production for Okt 2026 is locked. The Owner or Admin can reopen it.');
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
    expect(header).toHaveAccessibleDescription('Chasing MDRT (Million Dollar Round Table) this year — APE achieved ≥ Rp 2,4 M.');
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

/*
 * **The roster as cards below 768px** (P18.95-T3 AC-1, AC-2; ADR-0167 §6; the client's UI review of 2026-10-26,
 * UI-010 and UI-030). On a phone only *Name* and *Goal progress* fitted: *Status*, *Last 1:1* and the ⌄ sat some
 * 760px to the right, names were cut (*Indah Permat…*), *Personal* lay over *No goal set*, and the opened detail was
 * as wide as the table. The phone is `matchMedia` answering `usePhone`'s query; jsdom has none, so every spec above
 * is the table a tablet and a desktop draw.
 */
describe('P18.95-T3 — the roster as cards on a phone', () => {
  const onPhone = (matches = true) => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: matches && query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
  })));
  /** A person's card, found by the link their name is. */
  const cardOf = (name: string) => screen.getByRole('link', { name }).closest('li')!;
  const cards = () => screen.findByRole('list', { name: 'Your Unit' });
  const toggleOf = (name: string) => screen.getByRole('button', { name: `View details for ${name}` });

  beforeEach(() => document.addEventListener('click', stayPut));
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  it('P18.95-T3 AC-1 draws a card per person below 768px, and no table', async () => {
    onPhone();
    render();
    await cards();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Fourteen people, fourteen cards, each with its ⌄ — as many as the table has rows.
    expect(screen.getAllByRole('button', { name: /^View details for / })).toHaveLength(14);
    expect(screen.getByRole('heading', { level: 2, name: 'Your team’s roster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update production' })).toBeInTheDocument();
  });

  it('P18.95-T9 AC-4 explains the ✓ once on a phone too, beside the roster’s heading, with no Name heading to hold it', async () => {
    onPhone();
    render();
    await cards();
    const tips = screen.getAllByRole('button', { name: 'What is a Potential Monthly Active Agent?' });
    expect(tips).toHaveLength(1);
    expect(tips[0]).toHaveAccessibleDescription(TERMS.POTENTIAL_MAA.definition);
    expect(screen.getByRole('heading', { level: 2, name: 'Your team’s roster' }).parentElement).toContainElement(tips[0]);
  });

  it('P18.95-T3 AC-1 keeps the table’s groups and order: Your Unit · 4 and its total, AAB units, each unit’s total before its head', async () => {
    onPhone();
    render();
    await cards();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Your Unit · 4', 'AAB units']);
    expect(screen.getAllByRole('list').map((l) => l.getAttribute('aria-label'))).toEqual([
      'Your Unit', 'Arief Wibowo’s Unit', 'Dewi Kartika’s Unit', 'Sari Wulandari’s Unit', 'Wulan Sari’s Unit',
    ]);
    // A total's card names its unit; a person's card is named by the link their name is.
    const lines = (list: string) => within(screen.getByRole('list', { name: list })).getAllByRole('listitem')
      .map((li) => (li.querySelector('a') ?? li.querySelector('p'))!.textContent);
    expect(lines('Your Unit')).toEqual(['Your Unit — Total', 'You (Agus)', 'Dimas Pratama', 'Indah Lestari', 'Siti Rahma']);
    expect(lines('Sari Wulandari’s Unit')).toEqual([
      'Sari Wulandari’s Unit — Total', 'Sari Wulandari', 'Budi Santoso', 'Rina Wijaya', 'Yanti Puspita',
    ]);
    // A unit inside a unit one step further in, as the table's ↳ is — half its step, on a phone.
    const indent = (name: string) => cardOf(name).style.paddingLeft;
    expect(indent('Dimas Pratama')).toBe('');
    expect(indent('Arief Wibowo')).toBe('28px');
    expect(indent('Wulan Sari')).toBe('40px');
    expect(indent('Tono Saputra')).toBe('40px');
  });

  it('P18.95-T3 AC-1 says on a card what the table’s row says: the pill, the goal, Last 1:1 and who held it', async () => {
    // The table's cells first, read as a tablet draws them …
    render();
    await table();
    const row = rowOf('Dimas Pratama');
    const goal = within(row).getAllByRole('cell')[0].textContent;
    const last = within(row).getAllByRole('cell')[4].textContent;
    cleanup();

    // … and the same words on the phone's card.
    onPhone();
    render();
    await cards();
    const dimas = cardOf('Dimas Pratama');
    expect(dimas).toHaveTextContent(goal!);
    expect(dimas).toHaveTextContent(last!);
    expect(goal).toBe('82% · Rp 14,4 jt shortRp 65,6 jt of 80 jt');
    expect(last).toBe('12 days ago · overdueby Agus Santoso');
    expect(within(dimas).getByText('12 days ago · overdue')).toHaveClass('text-alert');
    expect(within(dimas).getByRole('button', { name: 'Watch closely' })).toHaveAccessibleDescription(
      'Still pacing to qualify as a Monthly Active Agent, but under 90% of expected goal pace — worth a check-in.',
    );
    // Each value under its column's name, label above value (ADR-0167 §6).
    expect([...dimas.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Goal progress', 'Last 1:1']);
    // The status rules the table keeps in its heading, beside the pill on a card.
    expect(within(dimas).getByRole('button', { name: 'How is status decided?' })).toBeInTheDocument();
    expect(cardOf('Siti Rahma')).toHaveTextContent('Not uploaded yetof Rp 80 jt target');
    expect(cardOf('Siti Rahma')).toHaveTextContent('No 1:1 yet');
  });

  it('P18.95-T3 AC-1 draws the goal bar from the server’s percentage, in the goal’s tone, and none without a figure', async () => {
    onPhone();
    render();
    await cards();
    const bar = (name: string) => cardOf(name).querySelector<HTMLElement>('[data-goal-bar]');
    expect(bar('Dimas Pratama')).toHaveAttribute('data-goal-bar', '82');
    expect(bar('Dimas Pratama')!.firstElementChild).toHaveStyle({ width: '82%' });
    expect(bar('Dimas Pratama')!.firstElementChild).toHaveClass('bg-alert');
    expect(bar('You (Agus)')!.firstElementChild).toHaveStyle({ width: '100%' });
    expect(bar('You (Agus)')!.firstElementChild).toHaveClass('bg-success');
    // The figures carry it: the bar is their picture, hidden from a screen reader.
    expect(bar('Dimas Pratama')).toHaveAttribute('aria-hidden', 'true');
    expect(bar('Siti Rahma')).toBeNull();
    expect(bar('Sari Wulandari')).toBeNull();
  });

  it('P18.95-T3 AC-1 writes a name in full, never cut, and keeps Personal on the name’s line, apart from the goal', async () => {
    onPhone();
    const long = unitRow('mem-indah', 'Indah Permatasari Wijayakusuma', { leads: true });
    render(dashboard({ yourUnit: { ...dashboard().yourUnit, rows: [AGUS_ME_ROW(), long] } }));
    await cards();
    const name = screen.getByRole('link', { name: 'Indah Permatasari Wijayakusuma' });
    expect(name).not.toHaveClass('truncate');
    expect(name).toHaveClass('break-words');
    const sari = cardOf('Sari Wulandari');
    const badge = within(sari).getByText('Personal');
    expect(badge.closest('p')).toContainElement(within(sari).getByRole('link', { name: 'Sari Wulandari' }));
    expect(badge.closest('dl')).toBeNull();
    const goal = sari.querySelector('dd')!;
    expect(goal).toHaveTextContent('No goal set');
    expect(goal).not.toContainElement(badge);
  });

  it('P18.95-T3 AC-1 opens the rest from the ⌄ by keyboard, each label above its value, nothing cut, and closes it', async () => {
    onPhone();
    render();
    await cards();
    const button = toggleOf('Dimas Pratama');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const detail = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(cardOf('Dimas Pratama')).toContainElement(detail);
    // The table's other columns, under their names …
    expect([...detail.querySelectorAll(':scope > dl > div > dt')].map((dt) => dt.textContent)).toEqual([
      'Leads', expect.stringMatching(/^Activityⓘ/), expect.stringMatching(/^Chasing MDRT/),
    ]);
    expect(detail).toHaveTextContent('Sales: 9 · 4 closingRecruit: —');
    expect(detail).toHaveTextContent('85 / 95 goal activities');
    expect(within(detail).getByRole('button', { name: 'Dimas Pratama is chasing MDRT this year.' })).toBeInTheDocument();
    expect(within(detail).getByRole('button', { name: 'What counts as a goal activity?' })).toBeInTheDocument();
    // … then the detail's tiles, whole: the gap's sentence wraps in the card rather than running off it.
    expect(within(detail).getAllByRole('heading').map((h) => h.textContent))
      .toEqual(['Gap', 'Activity breakdown', 'Ratios', 'Campaigns they’re chasing', 'Flagged follow-up (system-detected)']);
    expect(detail).toHaveTextContent('≈ 1 policy needed at their avg case size of Rp 18 jt.');
    const appointment = within(detail).getByText('Set appointment').parentElement!;
    expect(appointment).toHaveClass('flex-col');
    expect(appointment).toHaveTextContent('Set appointment63/70');
    const rate = (await within(detail).findByText('Selling success rate')).parentElement!;
    expect(rate).toHaveClass('flex-col');
    expect(within(detail).getByText('70,0% Selling · 30,0% Recruitment')).not.toHaveClass('whitespace-nowrap');

    await userEvent.keyboard(' ');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(detail.id)).toBeNull();
  });

  it('P18.95-T3 AC-1 opens a card from a tap on it, and not from a tap on a drill or a control', async () => {
    onPhone();
    render();
    await cards();
    const button = toggleOf('Dimas Pratama');
    fireEvent.click(within(cardOf('Dimas Pratama')).getByText('12 days ago · overdue'));
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(cardOf('Dimas Pratama')).getByText('12 days ago · overdue'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('link', { name: 'Dimas Pratama' }));
    fireEvent.click(within(cardOf('Dimas Pratama')).getByRole('button', { name: 'Watch closely' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('P18.95-T3 AC-1 keeps every drill the row has: the name, the goal and, opened, the leads', async () => {
    onPhone();
    render();
    await cards();
    const hrefs = (name: string) => [...cardOf(name).querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs('Dimas Pratama')).toEqual(['/coaching/mem-dimas/summary', '/coaching/mem-dimas/goal-setting']);
    await userEvent.click(toggleOf('Dimas Pratama'));
    expect(hrefs('Dimas Pratama')).toEqual([
      '/coaching/mem-dimas/summary', '/coaching/mem-dimas/goal-setting', '/coaching/mem-dimas/session',
    ]);
    await userEvent.click(toggleOf('you'));
    expect(hrefs('You (Agus)')).toEqual(['/summary', '/goals', '/leads']);
  });

  it('P18.95-T3 AC-1 draws a total as a card: its goal, leads, goal activities and potential active, who it leaves out', async () => {
    onPhone();
    render();
    await cards();
    const total = within(screen.getByRole('list', { name: 'Your Unit' })).getAllByRole('listitem')[0];
    expect([...total.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Goal progress', 'Leads', 'Activity', 'Status']);
    expect(total).toHaveTextContent('82% · Rp 57,6 jt short');
    expect(total).toHaveTextContent('Sales: 36 · 16 closingRecruit: 1 potential recruit');
    expect(total).toHaveTextContent('340 / 380 goal activities');
    expect(total).toHaveTextContent('On pace to be active: 3/4');
    expect(total).not.toHaveTextContent('potential active');
    expect(total.querySelector('button[aria-expanded]')).toBeNull();
    const sari = within(screen.getByRole('list', { name: 'Sari Wulandari’s Unit' })).getAllByRole('listitem')[0];
    expect(within(sari).getByRole('button', { name: 'Not uploaded yet for Yanti Puspita, so not counted in this total.' }))
      .toBeInTheDocument();
  });

  it('P18.95-T3 AC-1 stars the reader’s own card and draws no Last 1:1 on it', async () => {
    onPhone();
    render();
    await cards();
    const own = cardOf('You (Agus)');
    expect(own).toHaveTextContent('★');
    expect(own).toHaveClass('bg-amber/5');
    expect(own).not.toHaveTextContent('Last 1:1');
    expect(own).not.toHaveTextContent('Personal');
  });

  it('P18.95-T3 AC-2 labels the reader’s own figure at every size: No goal set · produced Rp 29 jt', async () => {
    const own = { ...AGUS_ME_ROW(), goal: goalCell({ set: false, targetMinor: null, actualMinor: rp(29), attainmentPct: null }) };
    const view = dashboard({ yourUnit: { ...dashboard().yourUnit, rows: [own] }, units: [] });
    render(view);
    await table();
    expect(within(rowOf('You (Agus)')).getAllByRole('cell')[0]).toHaveTextContent(/^No goal setproduced Rp 29 jt$/);
    cleanup();

    onPhone();
    render(view);
    await cards();
    expect(cardOf('You (Agus)')).toHaveTextContent('No goal setproduced Rp 29 jt');
  });

  it('P18.95-T3 AC-1 never draws the table first on a phone: the width is asked before the roster answers', async () => {
    onPhone();
    expect(await drewATable(async () => {
      render();
      await cards();
    })).toBe(false);
  });

  it('P18.95-T3 AC-1 keeps the table at 768px and wider', async () => {
    onPhone(false);
    render();
    await table();
    expect(screen.queryByRole('list', { name: 'Your Unit' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^View details for / })).toHaveLength(14);
  });
});

/**
 * **P18.96-T5 — who counts where** (ADR-0172; the client's report of 2026-10-27, UI-003). A new hire before their first
 * sale is in the team, tagged *New hire* in *Personal*'s chip, and in neither total's production nor *On pace to be
 * active* — which the totals' ⓘ say. The server decides who and sums the totals; the screen draws what it is sent.
 */
describe('P18.96-T5 — who counts where (ADR-0172)', () => {
  const onPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query, matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
  })));
  const YANTI_LEFT_OUT = 'No first sale yet for Yanti Puspita, a new hire, so not counted in this total.';
  /** The tag, by what a screen reader reads of it: its words and its sr-only reason, one element. */
  const tagIn = (scope: HTMLElement) => within(scope).getByText((_, el) => el?.textContent === 'New hire, no first sale yet');

  beforeEach(() => document.addEventListener('click', stayPut));
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  it('P18.96-T5 AC-3 tags a new hire before a first sale New hire, in Personal’s chip, named for a screen reader', async () => {
    render(NEW_HIRE_VIEW);
    await table();
    const tag = tagIn(rowOf('Yanti Puspita'));
    expect(tag).toHaveTextContent(/^New hire, no first sale yet$/);
    expect(within(tag).getByText(', no first sale yet')).toHaveClass('sr-only');
    // *Personal*'s own classes: one tag style on the roster.
    expect(tag.className).toBe(within(rowOf('Sari Wulandari')).getByText('Personal').className);
    for (const name of ['Budi Santoso', 'Rina Wijaya', 'Dimas Pratama', 'Sari Wulandari']) {
      expect({ name, tag: within(rowOf(name)).queryByText(/New hire/) }).toEqual({ name, tag: null });
    }
  });

  it('P18.96-T5 AC-3 draws no tag from the first sale’s day: the server says so, and nobody is tagged', async () => {
    render();
    await table();
    expect(screen.queryByText(/New hire/)).not.toBeInTheDocument();
    // And no ⓘ about new hires on any total or tile.
    expect(screen.queryByRole('button', { name: /No first sale yet/ })).not.toBeInTheDocument();
  });

  it('P18.96-T5 AC-4 a unit’s total says it leaves the new hire out, beside its goal and beside On pace', async () => {
    render(NEW_HIRE_VIEW);
    await table();
    const sari = screen.getByRole('rowheader', { name: 'Sari Wulandari’s Unit — Total' }).closest('tr')!;
    const cells = within(sari).getAllByRole('cell');
    // The goal's ⓘ: Yanti is no longer *missing*, she is left out as a new hire.
    expect(within(cells[0]).getByRole('button', { name: YANTI_LEFT_OUT })).toBeInTheDocument();
    expect(within(cells[0]).queryByRole('button', { name: /Not uploaded yet/ })).not.toBeInTheDocument();
    // On pace counts five of the six rows below, and says who it left out.
    expect(cells[5]).toHaveTextContent(/^On pace to be active: 3\/5/);
    expect(within(cells[5]).getByRole('button', { name: YANTI_LEFT_OUT })).toBeInTheDocument();
    // A total with no new hire in it says nothing of them.
    const yours = screen.getByRole('rowheader', { name: 'Your Unit — Total' }).closest('tr')!;
    expect(within(yours).queryByRole('button', { name: /No first sale yet/ })).not.toBeInTheDocument();
  });

  it('P18.96-T5 AC-1, AC-4 the tiles: the team counts her; production and On pace say they leave her out', async () => {
    render(NEW_HIRE_VIEW);
    await table();
    const team = screen.getByText('Your team').parentElement!;
    expect(team).toHaveTextContent('16 agents');
    const production = screen.getByText('Direct Group production').parentElement!;
    expect(within(production).getByRole('button', {
      name: `Not uploaded yet for Siti Rahma, so not counted in this total. ${YANTI_LEFT_OUT}`,
    })).toBeInTheDocument();
    const onPace = screen.getByText('On pace to be active (Group)').parentElement!;
    expect(onPace).toHaveTextContent('11 / 15 agents');
    expect(within(onPace).getByRole('button', { name: YANTI_LEFT_OUT })).toBeInTheDocument();
  });

  it('P18.96-T5 AC-3, AC-4 on a phone: the tag on her card’s name line, and the total card’s two ⓘ', async () => {
    onPhone();
    render(NEW_HIRE_VIEW);
    await screen.findByRole('list', { name: 'Your Unit' });
    const card = screen.getByRole('link', { name: 'Yanti Puspita' }).closest('li')!;
    const tag = tagIn(card);
    expect(tag.closest('p')).toContainElement(within(card).getByRole('link', { name: 'Yanti Puspita' }));
    expect(tag.closest('dl')).toBeNull();
    const sari = within(screen.getByRole('list', { name: 'Sari Wulandari’s Unit' })).getAllByRole('listitem')[0];
    expect(sari).toHaveTextContent('On pace to be active: 3/5');
    expect(within(sari).getAllByRole('button', { name: YANTI_LEFT_OUT })).toHaveLength(2);
    expect(within(screen.getByRole('link', { name: 'Budi Santoso' }).closest('li')!).queryByText(/New hire/)).not.toBeInTheDocument();
  });
});

/** The reader's own row as the fixture holds it. */
/**
 * **The roster's cards read their pieces from `components/ui/row-cards.tsx`** (P18.97-T7 AC-1, ADR-0178 §4): *CardField*
 * and *CardGroup* moved out of the roster so the Owner's wide tables draw the same cards on a phone. The move changed
 * no markup: the cards, two opened, digested as they were drawn before it.
 */
describe('P18.97-T7 AC-1 the roster’s cards from the shared pieces', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  /** The roster's cards on the build before P18.97-T7, two of them opened, from this fixture on 2026-10-28. */
  const BEFORE_T7 = 'f433b4f8bcee69f2fdceed03ed851f1087a68590c25650bfc8aff7ac973cd7f4';

  it('P18.97-T7 AC-1 draws the roster’s cards as they were, to the byte', async () => {
    document.addEventListener('click', stayPut);
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query, matches: query === PHONE_QUERY, addEventListener: () => {}, removeEventListener: () => {},
    })));
    render();
    const list = await screen.findByRole('list', { name: 'Your Unit' });
    const roster = list.closest('.rounded-lg')!;
    // A person's card and the reader's own opened, so their details are in the markup too.
    fireEvent.click(screen.getByRole('button', { name: 'View details for Dimas Pratama' }));
    fireEvent.click(screen.getByRole('button', { name: 'View details for you' }));
    const html = roster.outerHTML.replace(/_r_[0-9a-z]+_/g, '_id_');
    expect(createHash('sha256').update(html).digest('hex')).toBe(BEFORE_T7);
  });
});

function AGUS_ME_ROW() {
  return dashboard().yourUnit.rows[0];
}

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
