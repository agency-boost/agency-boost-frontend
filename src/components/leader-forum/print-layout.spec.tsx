import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { stubFetch } from '@test/harness';
import { completedMeeting, makeActionItems, makeMeetingView } from '@test/leader-meetings-fixtures';
import { PrintLayout } from './print-layout';
import type { MeetingView } from '@/lib/leader-meetings';

const draw = (meeting: MeetingView = makeMeetingView()) => render(<PrintLayout meeting={meeting} />);
const tables = () => screen.getAllByRole('table');

describe('P18.1-T3 AC-4 the print layout (`:2662-2695`)', () => {
  it('off the screen and on the paper only', () => {
    const { container } = draw();
    expect(container.firstElementChild).toHaveClass('hidden', 'print:block');
  });

  it('the three sections in order under their headings', () => {
    draw();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Overview & Stats', 'Agenda', 'Action Items']);
  });

  it('the chips and the table, *pending data* in plain type, the blocked cells navy, the targets as text', () => {
    draw();
    const chips = screen.getByText('# of AAB').closest('dl')!;
    expect(within(chips).getByText('24')).toBeInTheDocument();
    const [stats] = tables();
    expect(within(stats).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Metrics', 'FY 2025', 'YTD 2026', 'This Month, Last Year', 'Last Month', 'This Month', 'Monthly Target',
    ]);
    for (const cell of within(stats).getAllByText('pending data')) expect(cell).not.toHaveClass('italic');
    expect(stats.querySelectorAll('td.bg-navy')).toHaveLength(12);
    expect(within(stats).getByText('22 (3 @ unit)')).toBeInTheDocument();
    expect(within(stats).getByText('12,1')).toBeInTheDocument();
    expect(within(stats).getByText('Activation')).toBeInTheDocument();
  });

  it('a partial figure prints its † and one line under the table naming the months it leaves out', () => {
    draw();
    const [stats] = tables();
    const ape = within(stats).getByRole('rowheader', { name: 'APE (IDR B)' }).parentElement!;
    expect(ape.children[1]).toHaveTextContent(/^12,1$/);
    expect(ape.children[2]).toHaveTextContent(/^8,4†$/);
    // *YTD* of APE, of *Producing agents* and of *Case submission* leave August out.
    expect(stats.querySelectorAll('td')).toSatisfy((cells: NodeListOf<HTMLElement>) =>
      [...cells].filter((c) => c.textContent?.endsWith('†')).length === 3);
    const line = screen.getByText(/^† Without/);
    expect(line).toHaveTextContent('† Without Agu 2026: no figures uploaded for them yet.');
    expect(stats.closest('div')!.nextElementSibling).toBe(line);
  });

  it('the line names every month left out, once each, in month order', () => {
    const m = makeMeetingView();
    draw({
      ...m,
      scorecard: {
        ...m.scorecard,
        rows: m.scorecard.rows.map((r) => (r.key === 'manpower'
          ? { ...r, cells: { ...r.cells, fy: { kind: 'figure', value: 201, leavesOut: ['2025-03', '2025-01'] } } }
          : r)),
      },
    });
    expect(screen.getByText(/^† Without/))
      .toHaveTextContent('† Without Jan 2025, Mar 2025 and Agu 2026: no figures uploaded for them yet.');
  });

  it('a scorecard that leaves nothing out prints no † and no line', () => {
    const m = makeMeetingView();
    const { container } = draw({
      ...m,
      scorecard: {
        ...m.scorecard,
        rows: m.scorecard.rows.map((r) => ({
          ...r,
          cells: Object.fromEntries(Object.entries(r.cells).map(([k, c]) => [k, c.kind === 'figure' ? { ...c, leavesOut: [] } : c])) as typeof r.cells,
        })),
      },
    });
    expect(container.textContent).not.toContain('†');
    expect(screen.queryByText(/Without/)).toBeNull();
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

  it('no control, and no footnotes — as the prototype prints it', () => {
    draw();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/^Note: AA/)).toBeNull();
    expect(screen.queryByText(/^Source:/)).toBeNull();
  });

  it('a past meeting prints the scorecard frozen onto it', () => {
    draw(completedMeeting());
    expect(within(screen.getByText('# of AAB').closest('dl')!).getByText('23')).toBeInTheDocument();
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
        rows: m.scorecard.rows.map((r) => (r.key === 'ape' ? { ...r, monthlyTarget: { value: markup, version: 1 } } : r)),
      },
    });
    // The item, the tracker's cell and the target; the PIC after its *PIC:*.
    expect(screen.getAllByText(markup)).toHaveLength(3);
    expect(screen.getByText(`PIC: ${markup}`)).toBeInTheDocument();
    expect(container.querySelector('b, script')).toBeNull();
    expect((window as { hacked?: number }).hacked).toBeUndefined();
  });
});
