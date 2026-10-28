import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { stubFetch } from '@test/harness';
import { completedMeeting, makeActionItems, makeMeetingView, makeScorecardKeptBefore } from '@test/leader-meetings-fixtures';
import { PrintLayout } from './print-layout';
import type { MeetingView } from '@/lib/leader-meetings';

const draw = (meeting: MeetingView = makeMeetingView()) => render(<PrintLayout meeting={meeting} />);
const tables = () => screen.getAllByRole('table');

describe('P18.1-T3 AC-4, P18.97-T1 AC-18 the print layout (`:2662-2695`; the reference slide’s table)', () => {
  it('off the screen and on the paper only', () => {
    const { container } = draw();
    expect(container.firstElementChild).toHaveClass('hidden', 'print:block');
  });

  it('P18.97-T1 AC-18 on landscape A4: the page size is the meeting’s while it is open', () => {
    const { container } = draw();
    expect(container.querySelector('style')!.textContent).toBe('@media print { @page { size: A4 landscape; margin: 10mm; } }');
  });

  it('the three sections in order under their headings, the stats’ title a level below', () => {
    draw();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Overview & Stats', 'Agenda', 'Action Items']);
    expect(screen.getByRole('heading', { level: 4, name: 'BSD City Branch: Sep 2026' })).toBeInTheDocument();
  });

  it('P18.97-T1 AC-18 the same table: the title and AS OF, the strip, the seven columns in their two groups, the targets as text', () => {
    draw();
    expect(screen.getByText('AS OF 5 Sep 2026')).toBeInTheDocument();
    const strip = screen.getByText('# of AAB:').closest('dl')!;
    expect(within(strip).getByText('24')).toBeInTheDocument();
    const [stats] = tables();
    expect(within(stats).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Metrics', '⟵ Full Year & YTD View ⟶', '⟵ Monthly View ⟶',
      "Full Year 2025(Jan-Des '25)", "YTD 2025(Jan-Sep '25)", "YTD 2026(Jan-Sep '26)", 'This Month, Last Year(Sep-25)',
      'Last Month(Agu-26)', 'This Month(Sep-26)', 'Monthly Target',
    ]);
    expect(within(stats).getByText('96 (3 @ unit)')).toBeInTheDocument();
    expect(within(stats).getByText('TBD')).toBeInTheDocument();
    expect(within(stats).getByText('12,1')).toBeInTheDocument();
    expect(within(stats).getByText('Activation')).toBeInTheDocument();
    // Nothing scrolls on paper, and nothing has a minimum width to run off it.
    expect(stats.parentElement).not.toHaveClass('overflow-x-auto');
    expect(stats).not.toHaveClass('min-w-[760px]');
  });

  it('P18.97-T1 AC-18 the hatch and the outline print as on the screen; no navy block', () => {
    draw();
    const [stats] = tables();
    expect(within(stats).getAllByText('Not tracked')).toHaveLength(16);
    expect(stats.querySelectorAll('td.bg-navy')).toHaveLength(0);
    const ape = within(stats).getByRole('rowheader', { name: 'APE (Rp M)' }).parentElement!;
    expect(ape.children[2].className).toContain('border-l-alert');
    expect(ape.children[3].className).toContain('border-r-alert');
  });

  it('P18.97-T1 AC-18 the footnotes and the (*) notes print, where the print’s † and its line were', () => {
    const { container } = draw();
    expect(screen.getByText(/^Annual Active Agents — members with APE/)).toBeInTheDocument();
    expect(screen.getByText('(*) YTD 2026 covers Jan–Sep 2026 without Agu 2026, not uploaded')).toBeInTheDocument();
    const [stats] = tables();
    expect(within(stats).getAllByText('*')).toHaveLength(4);
    expect(container.textContent).not.toContain('†');
    expect(screen.queryByText(/^Note: AA/)).toBeNull();
  });

  it('P18.97-T1 AC-18 a scorecard that leaves nothing out prints no * and no (*) note', () => {
    const m = makeMeetingView();
    draw({
      ...m,
      scorecard: {
        ...m.scorecard,
        partialPeriods: [],
        rows: m.scorecard.rows.map((r) => ({
          ...r,
          cells: Object.fromEntries(Object.entries(r.cells).map(([k, c]) => [k, c.kind === 'figure' ? { ...c, leavesOut: [] } : c])) as typeof r.cells,
        })),
      },
    });
    expect(within(tables()[0]).queryAllByText('*')).toEqual([]);
    expect(screen.queryByText(/^\(\*\)/)).toBeNull();
  });

  it('the agenda’s three columns side by side, each item with *"PIC: {name}"*, and no boxes', () => {
    draw();
    const during = screen.getByRole('heading', { name: 'During', level: 4 }).parentElement!;
    expect(during.parentElement).toHaveClass('grid-cols-3');
    expect(within(during).getByText('Process update — review prior follow-ups')).not.toHaveClass('line-through');
    expect(within(during).getAllByText('PIC: —')).toHaveLength(5);
    const prep = screen.getByRole('heading', { name: 'Preparation', level: 4 }).parentElement!;
    expect(within(prep).getAllByText('PIC: Wilson')).toHaveLength(2);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('the tracker’s six named columns, the status as its pill', () => {
    draw();
    const tracker = tables()[1];
    expect(within(tracker).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Key initiative', 'Success metric', 'Action item', 'PIC', 'Status', 'Remarks / Target'],
    );
    expect(within(tracker).getAllByRole('row')).toHaveLength(5);
    expect(within(tracker).getAllByText('Planned')[0]).toHaveClass('rounded-pill', 'bg-amber/15', 'text-navy');
  });

  it('no control: every field its text', () => {
    draw();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('P18.97-T1 AC-18 a past meeting prints its frozen figures — one kept before the slide its — and its own units', () => {
    const { unmount } = draw(completedMeeting());
    expect(within(screen.getByText('# of AAB:').closest('dl')!).getByText('23')).toBeInTheDocument();
    unmount();
    draw(completedMeeting({ scorecard: makeScorecardKeptBefore() }));
    expect(screen.getByText('AS OF —')).toBeInTheDocument();
    expect(within(screen.getByText('# of units:').closest('div')!).getByText('5')).toBeInTheDocument();
    expect(within(tables()[0]).getByText('5 (1 @ unit)')).toBeInTheDocument();
  });

  it('prints what the page holds, so it is never stale (flow doc §2.9)', () => {
    const { rerender } = draw();
    const rows = makeActionItems();
    rows[0] = { ...rows[0], remarks: 'Typed a moment ago' };
    rerender(<PrintLayout meeting={makeMeetingView({ actionItems: rows })} />);
    expect(screen.getByText('Typed a moment ago')).toBeInTheDocument();
  });

  it('writes nothing', () => {
    const { calls } = stubFetch({});
    draw();
    expect(calls).toHaveLength(0);
  });

  it('P18.1-T2 AC-8 an item, a PIC, a cell and a target printed as text, never markup', () => {
    const markup = '<b>bold</b><script>window.hacked=1</script>';
    const m = makeMeetingView();
    const { container } = draw({
      ...m,
      agenda: { ...m.agenda, post: [{ id: 'x', text: markup, pic: markup, done: false, version: 1 }] },
      actionItems: [{ ...makeActionItems()[0], action: markup }],
      scorecard: {
        ...m.scorecard,
        rows: m.scorecard.rows.map((r) => (r.key === 'ape' ? { ...r, monthlyTarget: { rate: null, value: null, typed: markup, version: 1 } } : r)),
      },
    });
    // The item, the tracker's cell and a target typed as text before rates; the PIC after its *PIC:*.
    expect(screen.getAllByText(markup)).toHaveLength(3);
    expect(screen.getByText(`PIC: ${markup}`)).toBeInTheDocument();
    expect(container.querySelector('b, script')).toBeNull();
    expect((window as { hacked?: number }).hacked).toBeUndefined();
  });
});
