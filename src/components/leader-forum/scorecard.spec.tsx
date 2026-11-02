import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, browserChose, resetLanguage, wears } from '@test/harness';
import {
  billions, bodyOf, completedMeeting, makeMeetingView, makeScorecard, makeScorecardKeptBefore, readOnlyMeeting, renderTab,
  versionConflict, writeFailed, writesIn,
} from '@test/leader-meetings-fixtures';
import { Scorecard } from './scorecard';
import { FORUM_COPY, type MeetingView, type ScorecardRow } from '@/lib/leader-meetings';

const table = () => screen.getByRole('table');
const target = (row: string) => screen.getByRole('textbox', { name: `Monthly Target per unit, ${row}` });
const rowOf = (label: string) => screen.getByRole('rowheader', { name: new RegExp(`^${label.replace(/[()%.*]/g, '\\$&')}\\s?\\d?$`) }).parentElement!;
/** A row's six computed cells and its target, as read. */
const cells = (label: string) => [...rowOf(label).children].slice(1, 7).map((c) => c.textContent);
const withRows = (change: (row: ScorecardRow) => ScorecardRow, base: MeetingView = makeMeetingView()): MeetingView => ({
  ...base, scorecard: { ...base.scorecard, rows: base.scorecard.rows.map(change) },
});

afterEach(() => vi.unstubAllGlobals());

describe('P18.97-T1 the forum’s stats table, the client’s reference slide (ADR-0175)', () => {
  it('P18.97-T1 AC-13 the title "{Branch}: {Mon YYYY}" — the meeting’s month — and AS OF the day of the latest upload at its right', () => {
    renderTab(Scorecard);
    expect(screen.getByRole('heading', { level: 3, name: 'BSD City Branch: Sep 2026' })).toBeInTheDocument();
    expect(screen.getByText('AS OF 5 Sep 2026')).toBeInTheDocument();
  });

  it('P18.97-T1 AC-13 an office with no file draws no AS OF; one kept before it reads AS OF —, said to a screen reader', () => {
    const { unmount } = renderTab(Scorecard, makeMeetingView({ scorecard: makeScorecard({ asOf: { kind: 'none' } }) }));
    expect(screen.queryByText(/^AS OF/)).toBeNull();
    unmount();
    renderTab(Scorecard, completedMeeting({ scorecard: makeScorecardKeptBefore() }));
    expect(screen.getByText('AS OF —')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('AS OF: not recorded for this meeting')).toHaveClass('sr-only');
  });

  it('P18.97-T1 AC-14 the strip: one line a cell, large, bold and centred — Manpower dark red, agents and units mid pink, AB and AAB light pink', () => {
    renderTab(Scorecard);
    const strip = screen.getByText('Manpower:', { selector: 'dt' }).closest('dl')!;
    const tiles = [...strip.children];
    expect(tiles.map((t) => t.textContent)).toEqual(['Manpower:187', '# of agents:155', '# of units:32', '# of AB:8', '# of AAB:24']);
    for (const tile of tiles) expect(tile).toHaveClass('flex', 'justify-center', 'text-center', 'text-xl', 'font-extrabold', 'whitespace-nowrap');
    expect(tiles[0]).toHaveClass('bg-alert', 'text-white');
    for (const tile of tiles.slice(1, 3)) expect(tile).toHaveClass('bg-alert/25', 'text-navy');
    for (const tile of tiles.slice(3)) expect(tile).toHaveClass('bg-alert/10', 'text-navy');
    // Tokens only: nothing in the strip names a colour of its own.
    expect(strip.outerHTML).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it('P18.97-T1 AC-1, AC-2 the seven columns, red and in title case, each its name over its period from the meeting’s month', () => {
    renderTab(Scorecard);
    const headers = within(table()).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual([
      'Metrics', '⟵ Full Year & YTD View ⟶', '⟵ Monthly View ⟶',
      "Full Year 2025(Jan-Dec '25)", "YTD 2025(Jan-Sep '25)", "YTD 2026(Jan-Sep '26)", 'This Month, Last Year(Sep-25)',
      'Last Month(Aug-26)', 'This Month(Sep-26)', 'Monthly Target',
    ]);
    const ytd = screen.getByRole('columnheader', { name: "YTD 2025 (Jan-Sep '25)" });
    expect(ytd).toHaveClass('text-alert');
    expect([...ytd.children].map((line) => line.className)).toEqual(['block', 'block font-semibold']);
    expect(ytd.className).not.toMatch(/uppercase/);
  });

  it('P18.97-T1 AC-2 a January meeting’s YTD reads its January alone; a December one’s Full Year and last year’s YTD both run to Des', () => {
    const january = makeScorecard({
      periods: {
        fy: { from: '2025-01', to: '2025-12' }, ytdLastYear: { from: '2025-01', to: '2025-01' }, ytd: { from: '2026-01', to: '2026-01' },
        thisMonthLastYear: { from: '2025-01', to: '2025-01' }, lastMonth: { from: '2025-12', to: '2025-12' }, thisMonth: { from: '2026-01', to: '2026-01' },
      },
    });
    const { unmount } = renderTab(Scorecard, makeMeetingView({ date: '2026-01-13', scorecard: january }));
    expect(screen.getByRole('columnheader', { name: "YTD 2026 (Jan '26)" })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: "YTD 2025 (Jan '25)" })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Month (Dec-25)' })).toBeInTheDocument();
    unmount();
    const december = makeScorecard({
      periods: {
        fy: { from: '2025-01', to: '2025-12' }, ytdLastYear: { from: '2025-01', to: '2025-12' }, ytd: { from: '2026-01', to: '2026-12' },
        thisMonthLastYear: { from: '2025-12', to: '2025-12' }, lastMonth: { from: '2026-11', to: '2026-11' }, thisMonth: { from: '2026-12', to: '2026-12' },
      },
    });
    renderTab(Scorecard, makeMeetingView({ date: '2026-12-15', scorecard: december }));
    expect(screen.getByRole('columnheader', { name: "Full Year 2025 (Jan-Dec '25)" })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: "YTD 2025 (Jan-Dec '25)" })).toBeInTheDocument();
  });

  it('P18.97-T1 AC-3 the two groups are header cells over their columns (colgroup), their arrows hidden; a dashed line between', () => {
    const { container } = renderTab(Scorecard);
    const year = screen.getByRole('columnheader', { name: 'Full Year & YTD View' });
    const month = screen.getByRole('columnheader', { name: 'Monthly View' });
    expect([year.getAttribute('scope'), year.getAttribute('colspan'), month.getAttribute('scope'), month.getAttribute('colspan')])
      .toEqual(['colgroup', '3', 'colgroup', '4']);
    for (const arrow of [...year.querySelectorAll('[aria-hidden="true"]'), ...month.querySelectorAll('[aria-hidden="true"]')]) {
      expect(arrow.textContent).toMatch(/^\s*[⟵⟶]\s*$/);
    }
    expect([...container.querySelectorAll('colgroup')].map((g) => g.getAttribute('span') ?? String(g.children.length))).toEqual(['1', '3', '4']);
    // The line runs down the table: the group, the YTD header, and every row's last year column.
    expect(year).toHaveClass('[border-right-style:dashed]');
    expect(screen.getByRole('columnheader', { name: "YTD 2026 (Jan-Sep '26)" })).toHaveClass('[border-right-style:dashed]');
    expect(rowOf('Manpower').children[3]).toHaveClass('[border-right-style:dashed]');
  });

  it('P18.97-T1 AC-4 the slide’s rows in its order, its section bands, its bold and indented rows; New AA drawn nowhere', () => {
    renderTab(Scorecard);
    const firstCells = within(table()).getAllByRole('row').slice(2).map((r) => r.firstElementChild!.textContent);
    expect(firstCells).toEqual([
      'APE (IDR B)', 'Manpower', 'FLC (avg. monthly)', 'Annual Active Agents1',
      'Activation',
      '3M new agent %2', 'Avg. monthly AA3',
      'Productivity',
      'Case submission4', 'Cases/producing agents', 'Avg. Case Size (IDR M)4',
    ]);
    expect(screen.queryByText(/New AA/)).toBeNull();
    expect(screen.queryByText(/Producing agents/)).toBeNull();
    expect(rowOf('APE (IDR B)').firstElementChild).toHaveClass('font-bold');
    const manpower = rowOf('Manpower').firstElementChild!;
    expect(manpower).toHaveClass('font-bold');
    expect(manpower.className).toMatch(/color-mix\(in_srgb,var\(--color-alert\)_4%/);
    expect(rowOf('FLC (avg. monthly)').firstElementChild).toHaveClass('pl-7', 'font-normal');
    expect(rowOf('Annual Active Agents').firstElementChild).toHaveClass('pl-7', 'font-bold');
    expect(rowOf('Cases/producing agents').firstElementChild).toHaveClass('font-bold');
    expect(rowOf('Avg. Case Size (IDR M)').firstElementChild!.className).toMatch(/color-mix\(in_srgb,var\(--color-alert\)_4%/);
    expect(screen.getByText('Activation').className).toMatch(/color-mix\(in_srgb,var\(--color-alert\)_6%/);
  });

  it('P18.97-T1 AC-15 the numbers as the slide writes them: APE in miliar and case size in juta to a tenth, % whole, counts whole, a comma', () => {
    renderTab(Scorecard);
    expect(cells('APE (IDR B)')).toEqual(['12.1', '7.9', '8.4*, covers part of its period; see the notes below', '0.8', 'pending data', 'pending data']);
    expect(cells('Manpower')).toEqual(['201', '190', '187', '196', '181', '187']);
    expect(cells('Avg. monthly AA').slice(0, 4)).toEqual(['14', '12', '11', '10']);
    expect(cells('3M new agent %').slice(0, 3)).toEqual(['30%', '25%', 'pending data']);
    expect(cells('Cases/producing agents').slice(0, 2)).toEqual(['4.4', '3.8']);
    expect(cells('Avg. Case Size (IDR M)').slice(0, 2)).toEqual(['19.8', '17.6']);
  });

  it('P18.98-T3 AC-1 in Indonesian: APE (Rp M) and Avg. Case Size (Rp jt), each figure with a comma, the months Indonesian', () => {
    renderTab(Scorecard, makeMeetingView(), {}, 'id');
    // The table's own words in Indonesian too since P18.98-T4 moved them into the catalogue.
    expect(cells('APE (Rp M)')).toEqual(['12,1', '7,9', '8,4*, hanya mencakup sebagian periodenya; lihat catatan di bawah', '0,8', 'menunggu data', 'menunggu data']);
    expect(cells('Avg. Case Size (Rp jt)').slice(0, 2)).toEqual(['19,8', '17,6']);
    expect(cells('Cases/producing agents').slice(0, 2)).toEqual(['4,4', '3,8']);
    expect(screen.queryByText(/IDR/)).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Last Month (Agu-26)' })).toBeInTheDocument();
    expect(screen.getByText('AS OF 5 Sep 2026')).toBeInTheDocument();
  });

  it('P18.98-T3 AC-1, AC-2 a small sum reads < 0,1 in Indonesian and < 0.1 in English — the same figure, never 0', () => {
    const small = withRows((row) => (row.key === 'ape'
      ? { ...row, cells: { ...row.cells, fy: { kind: 'figure', value: billions(0.04), leavesOut: [] } } }
      : row));
    const { unmount } = renderTab(Scorecard, small, {}, 'id');
    expect(cells('APE (Rp M)')[0]).toBe('< 0,1');
    unmount();
    renderTab(Scorecard, small);
    expect(cells('APE (IDR B)')[0]).toBe('< 0.1');
  });

  it('P18.97-T1 AC-15 a sum that is not zero and rounds to 0,0 reads < 0,1; nothing reads the old two places below 1', () => {
    renderTab(Scorecard, withRows((row) => (row.key === 'ape'
      ? { ...row, cells: { ...row.cells, fy: { kind: 'figure', value: billions(0.04), leavesOut: [] }, ytdLastYear: { kind: 'figure', value: billions(0.1), leavesOut: [] } } }
      : row)));
    expect(cells('APE (IDR B)').slice(0, 2)).toEqual(['< 0.1', '0.1']);
  });

  it('P18.97-T1 AC-7 a Not tracked cell is a light hatch from a token, nothing to see, Not tracked to a screen reader — never a navy block', () => {
    const { container } = renderTab(Scorecard);
    const hatched = screen.getAllByText('Not tracked');
    // Four rows the table does not track month by month, each in the three months; and their four Monthly Targets.
    expect(hatched).toHaveLength(16);
    for (const name of hatched) {
      expect(name).toHaveClass('sr-only');
      expect(name.closest('td')!.className).toContain('bg-[repeating-linear-gradient(135deg,var(--color-hairline)_0_1px,transparent_1px_6px)]');
    }
    expect(container.querySelector('td.bg-navy')).toBeNull();
  });

  it('P18.97-T1 AC-8 a red outline frames the YTD pair on APE, Annual Active Agents and Case submission, and nowhere else', () => {
    renderTab(Scorecard);
    for (const label of ['APE (IDR B)', 'Annual Active Agents', 'Case submission']) {
      const [lastYear, thisYear] = [rowOf(label).children[2], rowOf(label).children[3]];
      expect([label, lastYear.className]).toEqual([label, expect.stringContaining('border-y-2 border-l-2 border-y-alert border-l-alert')]);
      expect([label, thisYear.className]).toEqual([label, expect.stringContaining('border-y-2 border-r-2 border-y-alert border-r-alert')]);
    }
    for (const label of ['Manpower', 'Avg. monthly AA', 'Cases/producing agents']) {
      expect([label, rowOf(label).children[2].className]).toEqual([label, expect.not.stringContaining('border-alert')]);
      expect([label, rowOf(label).children[2].className]).toEqual([label, expect.not.stringContaining('border-y-alert')]);
    }
  });

  it('P18.97-T1 AC-12 numbered footnotes in our metrics’ words, without a gap, in the order the rows reach them; no Note, no Source, no ⓘ', () => {
    renderTab(Scorecard);
    const notes = screen.getByText(/^Annual Active Agents — /).closest('ol')!;
    expect([...notes.children].map((li) => li.textContent)).toEqual([
      '1Annual Active Agents — members with APE or a policy in the monthly production file in at least one month of the period.',
      '23M new agent % — of the new hires who joined in the period and whose result is decided, the share with a first paid and issued case by day 90 of their join date. A first case after day 90 counts on neither side.',
      '3AA — Active Agent, a member whose month shows APE or a policy in the monthly production file.',
      '4Case submission and Avg. Case Size — the policies in the monthly production file, and its APE over them.',
    ]);
    expect(screen.queryByText(/^Note:/)).toBeNull();
    expect(screen.queryByText(/^Source:/)).toBeNull();
    expect(screen.queryByText(/Net APE/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Without / })).toBeNull();
  });

  it('P18.97-T1 AC-12 one (*) note per partial period, in the client’s words, each figure it applies to marked *', () => {
    const partial = withRows((row) => (row.key === 'ape'
      ? { ...row, cells: { ...row.cells, fy: { kind: 'figure', value: billions(5), leavesOut: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07'] } } }
      : row));
    renderTab(Scorecard, { ...partial, scorecard: { ...partial.scorecard, partialPeriods: [
      { column: 'fy', leavesOut: ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07'] },
      { column: 'ytd', leavesOut: ['2026-08'] },
    ] } });
    expect(screen.getByText('(*) Full Year 2025 covers Aug–Dec 2025 only; earlier months not uploaded')).toBeInTheDocument();
    expect(screen.getByText('(*) YTD 2026 covers Jan–Sep 2026 without Aug 2026, not uploaded')).toBeInTheDocument();
    // Marked: APE's Full Year and the three YTD figures that leave August out; nothing else.
    const marks = within(table()).getAllByText('*');
    expect(marks).toHaveLength(5);
    for (const mark of marks) expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(rowOf('Manpower').textContent).not.toContain('*');
  });

  it('P18.97-T1 AC-19 a scorecard kept before the slide reads — where it lacks a column or a row, said to a screen reader; its own units', () => {
    renderTab(Scorecard, completedMeeting({ scorecard: makeScorecardKeptBefore() }));
    const lastYear = rowOf('Manpower').children[2] as HTMLElement;
    expect(within(lastYear).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(lastYear).getByText('Not recorded for this meeting.')).toHaveClass('sr-only');
    expect(cells('Cases/producing agents').slice(0, 3).map((t) => t?.startsWith('—'))).toEqual([true, true, true]);
    expect(screen.getByText('# of units:', { selector: 'dt' }).nextElementSibling).toHaveTextContent('5');
    expect(target('FLC (avg. monthly)')).toHaveValue('5 (1 @ unit)');
  });

  it('*—* over nothing says why: no policies, no annual active agents', () => {
    renderTab(Scorecard, withRows((row) => (row.key === 'cases_per_producing_agent' ? { ...row, cells: { ...row.cells, ytd: { kind: 'none' } } } : row)));
    expect(within(rowOf('Avg. Case Size (IDR M)').children[3] as HTMLElement).getByText('No policies in this period.')).toHaveClass('sr-only');
    expect(within(rowOf('Cases/producing agents').children[3] as HTMLElement).getByText('No annual active agents in this period.')).toHaveClass('sr-only');
  });

  it('*pending data* grey and italic (`:698`), never 0 — FLC in every computed column (OD-26)', () => {
    renderTab(Scorecard);
    const pending = within(rowOf('FLC (avg. monthly)')).getAllByText('pending data');
    expect(pending).toHaveLength(6);
    for (const cell of pending) expect(cell).toHaveClass('italic', 'text-muted');
  });

  it('a past meeting draws the scorecard frozen onto it', () => {
    renderTab(Scorecard, completedMeeting());
    expect(screen.getByText('Manpower:', { selector: 'dt' }).nextElementSibling).toHaveTextContent('181');
  });
});

describe('P18.97-T1 AC-16, AC-17 the table on a tablet and on a phone', () => {
  it('P18.97-T1 AC-16 768–1023px: Metrics stays in view while the table scrolls, on its own ground; the strip one row of five, smaller', () => {
    renderTab(Scorecard);
    const metrics = screen.getByRole('columnheader', { name: 'Metrics' });
    const manpower = rowOf('Manpower').firstElementChild!;
    const flc = rowOf('FLC (avg. monthly)').firstElementChild!;
    for (const px of [768, 1023]) {
      for (const cell of [metrics, manpower, flc]) expect(wears(cell, px)).toMatch(/\bsticky\b.*\bleft-0\b/);
      expect(wears(flc, px)).toContain('bg-card');
    }
    // 1024px and wider, and a phone's: unchanged by it.
    for (const px of [767, 1024, 1280]) for (const cell of [metrics, manpower, flc]) expect(wears(cell, px)).not.toMatch(/\bsticky\b/);
    const strip = screen.getByText('Manpower:', { selector: 'dt' }).closest('dl')!;
    expect(wears(strip, 800)).toContain('grid-cols-5');
    expect(wears(strip.firstElementChild!, 800)).toContain('text-md');
    expect(wears(strip.firstElementChild!, 1280)).not.toContain('text-md');
    expect(table().parentElement).toHaveClass('overflow-x-auto');
  });

  it('P18.97-T1 AC-17 below 768px: one card per metric and no table — YTD against last year’s with the change, the months, the target', async () => {
    atWidth(375);
    renderTab(Scorecard);
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    const cards = screen.getAllByRole('listitem').filter((li) => li.querySelector('h4'));
    expect(cards.map((c) => c.querySelector('h4')!.textContent)).toEqual([
      'APE (IDR B)', 'Manpower', 'FLC (avg. monthly)', 'Annual Active Agents1', '3M new agent %2', 'Avg. monthly AA3',
      'Case submission4', 'Cases/producing agents', 'Avg. Case Size (IDR M)4',
    ]);
    const ape = within(cards[0]);
    const pairs = [...cards[0].querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
    expect(pairs).toEqual([
      ["YTD 2026(Jan-Sep '26)", '8.4*, covers part of its period; see the notes below'],
      ["YTD 2025(Jan-Sep '25)", '7.9'],
      ['Change', '+6%'],
      ['This Month(Sep-26)', 'pending data'],
      ['Last Month(Aug-26)', 'pending data'],
      ['Monthly Target', ''],
    ]);
    expect(ape.getByRole('textbox', { name: 'Monthly Target per unit, APE (IDR B)' })).toHaveValue('TBD');
    // A row the table does not track month by month leaves its months and its target off its card.
    const producing = [...cards[3].querySelectorAll('dt')].map((dt) => dt.textContent);
    expect(producing).toEqual(["YTD 2026(Jan-Sep '26)", "YTD 2025(Jan-Sep '25)", 'Change']);
    expect(within(cards[3]).getByText('-11%')).toBeInTheDocument();
    // — where last year's is none.
    expect([...cards[2].querySelectorAll('dd')][2]).toHaveTextContent('—');
    // The footnotes and the (*) notes follow the cards.
    const notes = screen.getByText(/^Annual Active Agents — /).closest('ol')!;
    expect(cards.at(-1)!.compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('(*) YTD 2026 covers Jan–Sep 2026 without Aug 2026, not uploaded')).toBeInTheDocument();
  });

  it('P18.97-T1 AC-17 768px and wider draw the table, not the cards', async () => {
    atWidth(768);
    renderTab(Scorecard);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(screen.queryAllByRole('listitem').filter((li) => li.querySelector('h4'))).toEqual([]);
  });
});

/**
 * **The phone's cards, as the production build's walk found them** (P18.97-T8): a percentage row's change read as a
 * relative percentage (F1, parity F-256), and an editor's *Monthly Target* field widened every row's value column until
 * the labels beside the figures wrapped mid-phrase (F2, I-493's note).
 */
describe('P18.97-T8 the phone’s cards after the walk (F1, F2)', () => {
  const cards = () => screen.getAllByRole('listitem').filter((li) => li.querySelector('h4'));
  const cardOf = (name: string) => cards().find((li) => li.querySelector('h4')!.firstChild!.textContent === name)!;
  const pairs = (card: HTMLElement) => [...card.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
  const fig = (value: number) => ({ kind: 'figure' as const, value, leavesOut: [] });
  const threeMonths = (ytd: number, ytdLastYear: number, change: number) => withRows((row) => (row.key === 'new_agent_3m'
    ? { ...row, cells: { ...row.cells, ytd: fig(ytd), ytdLastYear: fig(ytdLastYear) }, ytdChange: { kind: 'figure', value: change, unit: 'points' } }
    : row));
  const onAPhone = async (meeting?: MeetingView) => {
    atWidth(375);
    const rendered = renderTab(Scorecard, meeting);
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    return rendered;
  };

  it('P18.97-T8 F1 at 375px 3M new agent % at 60% against 100% reads -40 points, and at 45% against 30% +15 points — never a percentage', async () => {
    const { unmount } = await onAPhone(threeMonths(60, 100, -40));
    expect(pairs(cardOf('3M new agent %'))).toEqual([
      ["YTD 2026(Jan-Sep '26)", '60%'],
      ["YTD 2025(Jan-Sep '25)", '100%'],
      ['Change', '-40 points'],
    ]);
    unmount();
    await onAPhone(threeMonths(45, 30, 15));
    expect(within(cardOf('3M new agent %')).getByText('+15 points')).toBeInTheDocument();
    expect(screen.queryByText('+50%')).toBeNull();
  });

  it('P18.97-T8 F1 at 375px every other card keeps its change as a percentage of last year’s, and — where there is none', async () => {
    await onAPhone();
    expect(pairs(cardOf('Manpower'))[2]).toEqual(['Change', '-2%']);
    expect(pairs(cardOf('Cases/producing agents'))[2]).toEqual(['Change', '-26%']);
    // 3M new agent % with this year's figure pending: no change to give.
    expect(pairs(cardOf('3M new agent %'))[2]).toEqual(['Change', '—']);
  });

  it('P18.97-T8 F2 at 375px an editor’s target is a line of its own under the figures, outside their grid; the field fills it', async () => {
    await onAPhone();
    const ape = cardOf('APE (IDR B)');
    const [figures, target, ...more] = [...ape.querySelectorAll('dl')];
    expect(more).toEqual([]);
    // The figures' two-column grid holds the figures alone: no field sets the width of their value column.
    expect(figures).toHaveClass('grid', 'grid-cols-[1fr_auto]');
    expect(within(figures).queryByRole('textbox')).toBeNull();
    expect([...figures.querySelectorAll('dt')].map((dt) => dt.textContent)).not.toContain('Monthly Target');
    // The target after it, in the card: its label, then the field, which takes the rest of the line — or a line of its
    // own under the label, on a card too narrow for both.
    expect(target.parentElement).toBe(ape);
    expect(figures.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(target).not.toHaveClass('grid');
    expect(target).toHaveClass('flex', 'flex-wrap');
    expect(within(target).getByText('Monthly Target').tagName).toBe('DT');
    const field = within(target).getByRole('textbox', { name: 'Monthly Target per unit, APE (IDR B)' });
    expect(field.closest('dd')).toHaveClass('flex-1');
    expect(field).toHaveValue('TBD');
  });

  it('P18.97-T8 F2 at 375px each label’s name and period are kept whole: a narrow card breaks between them, never inside one', async () => {
    await onAPhone();
    const figures = cardOf('Avg. monthly AA').querySelector('dl')!;
    const labels = [...figures.querySelectorAll('dt')].filter((dt) => dt.textContent !== 'Change');
    expect(labels.map((dt) => [...dt.querySelectorAll('.whitespace-nowrap')].map((run) => run.textContent))).toEqual([
      ['YTD 2026', "(Jan-Sep '26)"],
      ['YTD 2025', "(Jan-Sep '25)"],
      ['This Month', '(Sep-26)'],
      ['Last Month', '(Aug-26)'],
    ]);
    for (const dt of labels) expect(dt.firstElementChild).toHaveClass('flex', 'flex-wrap');
  });

  it('P18.97-T8 F2 at 375px read-only, the target’s words are their own line too; a row with no target has none', async () => {
    await onAPhone(readOnlyMeeting());
    const [figures, target] = [...cardOf('FLC (avg. monthly)').querySelectorAll('dl')];
    expect(figures.textContent).not.toContain('Monthly Target');
    expect(pairs(target as HTMLElement)).toEqual([['Monthly Target', '32 (1 @ unit)']]);
    expect(cardOf('Annual Active Agents').querySelectorAll('dl')).toHaveLength(1);
  });
});

describe('P18.97-T1 AC-10 *Monthly Target*, typed as a rate per unit', () => {
  it('P18.97-T1 AC-10 shown "{rate × units} ({rate} @ unit)" from the server; APE reads TBD with no rate, every other row blank', () => {
    renderTab(Scorecard);
    expect(screen.getAllByRole('textbox').map((i) => [i.getAttribute('aria-label'), (i as HTMLInputElement).value])).toEqual([
      ['Monthly Target per unit, APE (IDR B)', 'TBD'],
      ['Monthly Target per unit, Manpower', ''],
      ['Monthly Target per unit, FLC (avg. monthly)', '32 (1 @ unit)'],
      ['Monthly Target per unit, Avg. monthly AA', '96 (3 @ unit)'],
      ['Monthly Target per unit, Case submission', ''],
    ]);
    expect(target('FLC (avg. monthly)')).toHaveAttribute('maxLength', '40');
    expect(target('FLC (avg. monthly)')).toHaveAttribute('inputMode', 'decimal');
  });

  it('P18.97-T1 AC-10 read-only text, and no control, for anybody who may not edit', () => {
    renderTab(Scorecard, readOnlyMeeting());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.getByText('96 (3 @ unit)')).toBeInTheDocument();
    expect(screen.getByText('TBD')).toBeInTheDocument();
  });

  it('P18.97-T1 AC-10 the field holds the rate while focused; one write on leaving it, only when it changed, a comma read; *Saved*', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/flc': ({ body }) => ({
        body: { rate: (body as { rate: number }).rate, value: (body as { rate: number }).rate * 32, typed: null, version: 2 },
      }),
    });
    await user.click(target('FLC (avg. monthly)'));
    expect(target('FLC (avg. monthly)')).toHaveValue('1');
    // A visit that changes nothing writes nothing and says nothing; the field shows the target again.
    await user.tab();
    expect(writesIn(calls)).toHaveLength(0);
    expect(target('FLC (avg. monthly)')).toHaveValue('32 (1 @ unit)');

    await user.click(target('FLC (avg. monthly)'));
    await user.clear(target('FLC (avg. monthly)'));
    await user.type(target('FLC (avg. monthly)'), ' 1,5 ');
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    const writes = writesIn(calls);
    expect(writes).toHaveLength(1);
    expect(writes[0].init.method).toBe('PUT');
    expect(bodyOf(writes[0])).toEqual({ rate: 1.5, version: 1 });
    expect(target('FLC (avg. monthly)')).toHaveValue('48 (1.5 @ unit)');
    expect(held().scorecard.rows.find((r) => r.key === 'flc')!.monthlyTarget).toEqual({ rate: 1.5, value: 48, typed: null, version: 2 });
    expect(held().writtenIn).toBe(true);
  });

  it('P18.97-T1 AC-10 APE’s rate is typed in miliar and sent in sen; emptying a rate clears it, null', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/ape': { body: { rate: 50_000_000_000, value: 1_600_000_000_000, typed: null, version: 3 } },
      'PUT /leader-meetings/m14/monthly-targets/avg_monthly_aa': { body: { rate: null, value: null, typed: null, version: 2 } },
    });
    await user.click(target('APE (IDR B)'));
    expect(target('APE (IDR B)')).toHaveValue('');
    expect(target('APE (IDR B)')).toHaveAttribute('placeholder', 'TBD');
    await user.type(target('APE (IDR B)'), '0,5');
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(1));
    expect(bodyOf(writesIn(calls)[0])).toEqual({ rate: 50_000_000_000, version: 2 });
    await waitFor(() => expect(target('APE (IDR B)')).toHaveValue('16.0 (0.5 @ unit)'));

    await user.click(target('Avg. monthly AA'));
    await user.clear(target('Avg. monthly AA'));
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(2));
    expect(bodyOf(writesIn(calls)[1])).toEqual({ rate: null, version: 1 });
  });

  it('P18.97-T1 AC-10 a rate that is not a number is not sent, and the field says so; a number then sends', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/manpower': { body: { rate: 2, value: 64, typed: null, version: 1 } },
    });
    await user.click(target('Manpower'));
    await user.type(target('Manpower'), 'about 2');
    await user.tab();
    expect(writesIn(calls)).toHaveLength(0);
    expect(target('Manpower')).toHaveAttribute('aria-invalid', 'true');
    expect(target('Manpower')).toHaveValue('about 2');
    expect(target('Manpower')).toHaveAccessibleDescription('Type a number from 0, like 1 or 0.5.');
    for (const typed of ['-1', '1,2,3']) {
      await user.clear(target('Manpower'));
      await user.type(target('Manpower'), typed);
      await user.tab();
      expect([typed, writesIn(calls)]).toEqual([typed, []]);
    }
    await user.clear(target('Manpower'));
    await user.type(target('Manpower'), '2');
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(1));
    expect(bodyOf(writesIn(calls)[0])).toEqual({ rate: 2, version: 0 });
    await waitFor(() => expect(target('Manpower')).not.toHaveAttribute('aria-invalid'));
    expect(screen.queryByText('Type a number from 0, like 1 or 0.5.')).toBeNull();
  });

  it('a 409: the meeting is read again, the cell shows what the other leader saved, and one line says so', async () => {
    const user = userEvent.setup();
    const theirs = withRows((r) => (r.key === 'flc' ? { ...r, monthlyTarget: { rate: 2, value: 64, typed: null, version: 3 } } : r));
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/flc': versionConflict,
      'GET /leader-meetings/m14': { body: theirs },
    });
    await user.click(target('FLC (avg. monthly)'));
    await user.clear(target('FLC (avg. monthly)'));
    await user.type(target('FLC (avg. monthly)'), '4');
    await user.tab();
    await screen.findByText(FORUM_COPY.conflict);
    await waitFor(() => expect(target('FLC (avg. monthly)')).toHaveValue('64 (2 @ unit)'));
    expect(calls.filter((c) => (c.init.method ?? 'GET') === 'GET')).toHaveLength(1);
  });

  it('any other failure keeps what was typed, says so, and leaving the cell again sends it again', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/flc': [writeFailed, { body: { rate: 9, value: 288, typed: null, version: 2 } }],
    });
    await user.click(target('FLC (avg. monthly)'));
    await user.clear(target('FLC (avg. monthly)'));
    await user.type(target('FLC (avg. monthly)'), '9');
    await user.tab();
    await screen.findByText(FORUM_COPY.failed);
    expect(target('FLC (avg. monthly)')).toHaveValue('9');

    await user.click(target('FLC (avg. monthly)'));
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    expect(writesIn(calls).map((c) => bodyOf(c))).toEqual([{ rate: 9, version: 1 }, { rate: 9, version: 1 }]);
  });

  it('P18.97-T1 AC-11 a target the migration kept as typed shows its text as typed, as text, until a rate is entered', () => {
    const markup = '<b>Ask Hellen</b><script>window.hacked=1</script>';
    const kept = withRows((r) => (r.key === 'case_submission' ? { ...r, monthlyTarget: { rate: null, value: null, typed: markup, version: 1 } } : r));
    const { container, unmount } = renderTab(Scorecard, kept);
    expect(target('Case submission')).toHaveValue(markup);
    expect(container.querySelector('b, script')).toBeNull();
    unmount();
    renderTab(Scorecard, { ...kept, via: 'link', can: { ...kept.can, edit: false } });
    expect(screen.getByText(markup)).toBeInTheDocument();
    expect((window as { hacked?: number }).hacked).toBeUndefined();
  });
});

describe('P18.97-T1 AC-21 no axe violations: the groups, the hatched cells, the cards', () => {
  // jsdom samples no pixels: contrast is the tokens' (`a11y.spec.tsx`), as `screens.a11y.spec.tsx` has it. A tab
  // drawn alone sits in no landmark; on its page it is inside `<main>`, where that spec checks it.
  const clean = async () =>
    (await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [];

  it('for an editor', async () => {
    renderTab(Scorecard);
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });

  it('read-only, and a scorecard kept before the slide', async () => {
    renderTab(Scorecard, completedMeeting({ scorecard: makeScorecardKeptBefore(), via: 'link', can: { ...readOnlyMeeting().can } }));
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });

  it('on a phone, the cards', async () => {
    atWidth(375);
    renderTab(Scorecard);
    await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });

  it('P18.97-T8 F1, F2 on a phone, read-only: a change in points, each target on its own line', async () => {
    atWidth(375);
    renderTab(Scorecard, readOnlyMeeting({
      scorecard: {
        ...makeScorecard(),
        rows: makeScorecard().rows.map((row) => (row.key === 'new_agent_3m'
          ? { ...row, cells: { ...row.cells, ytd: { kind: 'figure', value: 45, leavesOut: [] } }, ytdChange: { kind: 'figure', value: 20, unit: 'points' } }
          : row)),
      },
    }));
    await screen.findByText('+20 points');
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });
});

/**
 * **P18.98-T3 figures on the forum's scorecard** (ADR-0174, ADR-0179 §6): written in the reader's chosen language,
 * and in Indonesian with no choice, whether or not the switch is live. Until it is, a reader with no choice reads the
 * table as it was before T3 — its words English, its figures *APE (Rp M)*, *12,1*, *Agu* — never *APE (IDR B)* beside
 * an unwired screen's *Rp 5,8 M* (the client's UI-019). Rendered under the app's own provider (`renderTab`'s `{ live }`).
 */
describe('P18.98-T3 figures on the forum’s scorecard', () => {
  afterEach(() => resetLanguage());

  const INDONESIAN_APE = ['12,1', '7,9', '8,4*, covers part of its period; see the notes below', '0,8', 'pending data', 'pending data'];
  /** The same figures with the table's own words in Indonesian, a reader's who chose it or once live (P18.98-T4). */
  const INDONESIAN_APE_AND_WORDS = ['12,1', '7,9', '8,4*, hanya mencakup sebagian periodenya; lihat catatan di bawah', '0,8', 'menunggu data', 'menunggu data'];
  const ENGLISH_APE = ['12.1', '7.9', '8.4*, covers part of its period; see the notes below', '0.8', 'pending data', 'pending data'];

  it('P18.98-T3 figures, unchosen and not live: English words and Indonesian figures — APE (Rp M), 12,1, Agu', () => {
    renderTab(Scorecard, makeMeetingView(), {}, { live: false });

    expect(cells('APE (Rp M)')).toEqual(INDONESIAN_APE);
    expect(cells('Avg. Case Size (Rp jt)').slice(0, 2)).toEqual(['19,8', '17,6']);
    expect(cells('Cases/producing agents').slice(0, 2)).toEqual(['4,4', '3,8']);
    expect(screen.getByRole('columnheader', { name: 'Last Month (Agu-26)' })).toBeInTheDocument();
    expect(screen.queryByText(/IDR/)).toBeNull();
    // Its words English, as before the phase: the title, the columns, *pending data* above, the screen's language.
    expect(screen.getByRole('heading', { level: 3, name: 'BSD City Branch: Sep 2026' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Metrics' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('P18.98-T3 figures, chosen English by the browser, not live: APE (IDR B), 12.1, Aug', () => {
    browserChose('en');
    renderTab(Scorecard, makeMeetingView(), {}, { live: false });

    expect(cells('APE (IDR B)')).toEqual(ENGLISH_APE);
    expect(cells('Avg. Case Size (IDR M)').slice(0, 2)).toEqual(['19.8', '17.6']);
    expect(screen.getByRole('columnheader', { name: 'Last Month (Aug-26)' })).toBeInTheDocument();
  });

  it('P18.98-T3 figures, chosen Indonesian by the browser, not live: APE (Rp M), 12,1, and the screen in Indonesian', () => {
    browserChose('id');
    renderTab(Scorecard, makeMeetingView(), {}, { live: false });

    expect(cells('APE (Rp M)')).toEqual(INDONESIAN_APE_AND_WORDS);
    expect(screen.queryByText(/IDR/)).toBeNull();
    expect(document.documentElement.lang).toBe('id');
  });

  it('P18.98-T3 figures, live and unchosen: Indonesian figures on a screen whose language is Indonesian', () => {
    renderTab(Scorecard, makeMeetingView(), {}, { live: true });

    expect(cells('APE (Rp M)')).toEqual(INDONESIAN_APE_AND_WORDS);
    expect(screen.getByRole('columnheader', { name: 'Last Month (Agu-26)' })).toBeInTheDocument();
    // The words' language too (`<html lang>`), the table's own words with it since P18.98-T4.
    expect(document.documentElement.lang).toBe('id');
  });
});
