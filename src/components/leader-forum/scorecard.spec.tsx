import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import {
  bodyOf, completedMeeting, makeMeetingView, makeScorecard, readOnlyMeeting, renderTab, versionConflict, writeFailed,
  writesIn,
} from '@test/leader-meetings-fixtures';
import { Scorecard } from './scorecard';
import { FORUM_COPY } from '@/lib/leader-meetings';

const table = () => screen.getByRole('table');
const target = (row: string) => screen.getByRole('textbox', { name: `Monthly Target, ${row}` });

describe('P18.1-T2 AC-4 Overview & Stats', () => {
  it('the five chips, as drawn (`:2788-2794`)', () => {
    renderTab(Scorecard);
    const chips = screen.getByText('Manpower', { selector: 'dt' }).closest('dl')!;
    const pairs = [...chips.querySelectorAll('div')].map((d) => [d.querySelector('dt')!.textContent, d.querySelector('dd')!.textContent]);
    expect(pairs).toEqual([['Manpower', '187'], ['# of agents', '155'], ['# of units', '8'], ['# of AB', '8'], ['# of AAB', '24']]);
  });

  it('the seven headers, *FY* and *YTD* from the meeting’s year (F-184)', () => {
    renderTab(Scorecard);
    expect(within(table()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Metrics', 'FY 2025', 'YTD 2026', 'This Month, Last Year', 'Last Month', 'This Month', 'Monthly Target',
    ]);
  });

  it('a meeting in another year names its own years', () => {
    renderTab(Scorecard, makeMeetingView({
      scorecard: makeScorecard({ periods: { fy: '2026', ytd: '2027', thisMonthLastYear: '2026-02', lastMonth: '2027-01', thisMonth: '2027-02' } }),
    }));
    expect(screen.getByRole('columnheader', { name: 'FY 2026' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'YTD 2027' })).toBeInTheDocument();
  });

  it('nine rows under the two section rows, the labels verbatim, *3M new agent %\\** with its asterisk', () => {
    renderTab(Scorecard);
    const firstCells = within(table()).getAllByRole('row').slice(1).map((r) => r.firstElementChild!.textContent);
    expect(firstCells).toEqual([
      'APE (IDR B)', 'Manpower', 'FLC (avg. monthly)', 'Producing agents',
      'Activation',
      'New AA (avg. monthly)', '3M new agent %*',
      'Productivity',
      'Avg. Monthly AA', 'Case submission', 'Average Case Size (IDR M)',
    ]);
    expect(screen.getByText('Activation')).toHaveAttribute('colspan', '7');
  });

  it('each figure rounded for display: APE in billions, case size in millions, averages whole, % to one decimal (ADR-0167 §1)', () => {
    renderTab(Scorecard);
    const cells = (label: string) =>
      [...screen.getByRole('rowheader', { name: label }).parentElement!.children].slice(1, 6).map((c) => c.textContent);
    expect(cells('APE (IDR B)')).toEqual(['12,1', expect.stringMatching(/^8,4/), '0,75', 'pending data', 'pending data']);
    expect(cells('Manpower')).toEqual(['201', '187', '196', '181', '187']);
    expect(cells('New AA (avg. monthly)')).toEqual(['3', '3', '4', 'pending data', 'pending data']);
    expect(cells('Avg. Monthly AA')).toEqual(['14', '11', '10', 'pending data', 'pending data']);
    expect(cells('3M new agent %*').slice(0, 2)).toEqual(['30,0%', 'pending data']);
    expect(cells('Average Case Size (IDR M)')[0]).toBe('19,8');
  });

  it('*pending data* grey and italic (`:698`), never 0 — FLC in every computed column (OD-26)', () => {
    renderTab(Scorecard);
    const flc = screen.getByRole('rowheader', { name: 'FLC (avg. monthly)' }).parentElement!;
    const pending = within(flc).getAllByText('pending data');
    expect(pending).toHaveLength(5);
    for (const cell of pending) expect(cell).toHaveClass('italic', 'text-muted');
  });

  it('the blocked cells navy, as drawn, and named *Not tracked* for a screen reader (I-255)', () => {
    renderTab(Scorecard);
    // Three rows, each blocked in the three months and *Monthly Target*.
    const blocked = screen.getAllByText('Not tracked');
    expect(blocked).toHaveLength(12);
    for (const name of blocked) {
      expect(name).toHaveClass('sr-only');
      expect(name.closest('td')).toHaveClass('bg-navy');
    }
  });

  it('*—* over no policies, its accessible words saying why', () => {
    renderTab(Scorecard);
    const size = screen.getByRole('rowheader', { name: 'Average Case Size (IDR M)' }).parentElement!;
    const ytd = size.children[2] as HTMLElement;
    expect(within(ytd).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(ytd).getByText('No policies in this period.')).toHaveClass('sr-only');
  });

  it('a figure over part of its period names the months it leaves out, as its name and its bubble', () => {
    renderTab(Scorecard);
    const marks = screen.getAllByRole('button', { name: 'Without Agu 2026: no figures uploaded for them yet.' });
    // *YTD* of APE, of *Producing agents* and of *Case submission*.
    expect(marks).toHaveLength(3);
    const apeYtd = screen.getByRole('rowheader', { name: 'APE (IDR B)' }).parentElement!.children[2] as HTMLElement;
    expect(within(apeYtd).getByRole('tooltip', { hidden: true })).toHaveTextContent('Without Agu 2026: no figures uploaded for them yet.');
    // On the first row the bubble opens below, where the table's scroll box leaves it room.
    expect(within(apeYtd).getByRole('tooltip', { hidden: true }).parentElement!.className).toContain('[&>[role=tooltip]]:top-full');
    const caseYtd = screen.getByRole('rowheader', { name: 'Case submission' }).parentElement!.children[2] as HTMLElement;
    expect(within(caseYtd).getByRole('tooltip', { hidden: true }).parentElement!.className).not.toContain('top-full');
    // A whole period says nothing.
    const fy = screen.getByRole('rowheader', { name: 'APE (IDR B)' }).parentElement!.children[1] as HTMLElement;
    expect(within(fy).queryByRole('button')).toBeNull();
  });

  it('the footnotes verbatim (`:2474-2475`)', () => {
    renderTab(Scorecard);
    const caption = screen.getByText(/^Note: AA/).closest('p')!;
    expect(caption.textContent).toBe(
      'Note: AA = Active Agent; 3M new agent % is the share of new agents producing at least one case in their join month or the following three months.'
      + 'Source: Manpower, APE, average case size, producing agents, avg. monthly AA, FLC and case submission as tagged to this KPM.',
    );
  });

  it('a past meeting draws the scorecard frozen onto it', () => {
    renderTab(Scorecard, completedMeeting());
    const chips = screen.getByText('Manpower', { selector: 'dt' }).closest('dl')!;
    expect(within(chips).getByText('181')).toBeInTheDocument();
  });

  it('AC-8: the table scrolls inside its card at 360px; the page does not', () => {
    renderTab(Scorecard);
    const wrapper = table().parentElement!;
    expect(wrapper).toHaveClass('overflow-x-auto');
    expect(table()).toHaveClass('min-w-[640px]', 'relative');
    expect(wrapper.parentElement).toHaveClass('overflow-hidden', 'rounded-lg');
  });
});

describe('P18.1-T2 AC-4 *Monthly Target*, the only typed cells', () => {
  it('a labelled input on each of the six typed rows, bounded by the served limit, for an editor', () => {
    renderTab(Scorecard);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.map((i) => i.getAttribute('aria-label'))).toEqual([
      'Monthly Target, APE (IDR B)', 'Monthly Target, Manpower', 'Monthly Target, FLC (avg. monthly)',
      'Monthly Target, New AA (avg. monthly)', 'Monthly Target, Avg. Monthly AA', 'Monthly Target, Case submission',
    ]);
    expect(target('APE (IDR B)')).toHaveValue('TBD');
    expect(target('Manpower')).toHaveValue('');
    expect(target('FLC (avg. monthly)')).toHaveAttribute('maxLength', '40');
  });

  it('read-only text, and no control, for anybody who may not edit', () => {
    renderTab(Scorecard, readOnlyMeeting());
    expect(screen.queryByRole('textbox')).toBeNull();
    // The only buttons left are the ⓘ marks, which write nothing.
    expect(screen.queryAllByRole('button')).toHaveLength(screen.getAllByRole('button', { name: /^Without / }).length);
    expect(screen.getByText('22 (3 @ unit)')).toBeInTheDocument();
  });
});

describe('P18.1-T2 AC-7 saving a target', () => {
  it('one write on leaving the cell, only when it changed, with the version it read; *Saved*', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/manpower': ({ body }) => ({
        body: { value: (body as { value: string }).value, version: 1 },
      }),
    });
    // A visit that changes nothing writes nothing and says nothing.
    await user.click(target('Manpower'));
    await user.tab();
    expect(writesIn(calls)).toHaveLength(0);

    await user.click(target('Manpower'));
    await user.type(target('Manpower'), '  190 ');
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    const writes = writesIn(calls);
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toContain('/leader-meetings/m14/monthly-targets/manpower');
    expect(writes[0].init.method).toBe('PUT');
    expect(bodyOf(writes[0])).toEqual({ value: '190', version: 0 });
    expect(target('Manpower')).toHaveValue('190');
    expect(held().scorecard.rows[1].monthlyTarget).toEqual({ value: '190', version: 1 });
    expect(held().writtenIn).toBe(true);
  });

  it('the next write sends the version the last one answered', async () => {
    const user = userEvent.setup();
    let version = 2;
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/ape': ({ body }) => ({
        body: { value: (body as { value: string }).value, version: ++version },
      }),
    });
    await user.clear(target('APE (IDR B)'));
    await user.type(target('APE (IDR B)'), '1.2');
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(1));
    await user.click(target('APE (IDR B)'));
    await user.type(target('APE (IDR B)'), '5');
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(2));
    expect(writesIn(calls).map((c) => bodyOf(c))).toEqual([{ value: '1.2', version: 2 }, { value: '1.25', version: 3 }]);
  });

  it('a 409: the meeting is read again, the cell shows what the other leader saved, and one line says so', async () => {
    const user = userEvent.setup();
    const theirs = makeMeetingView({
      scorecard: makeScorecard({
        rows: makeScorecard().rows.map((r) => (r.key === 'ape' ? { ...r, monthlyTarget: { value: '1.5', version: 3 } } : r)),
      }),
    });
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/ape': versionConflict,
      'GET /leader-meetings/m14': { body: theirs },
    });
    await user.clear(target('APE (IDR B)'));
    await user.type(target('APE (IDR B)'), '1.2');
    await user.tab();
    await screen.findByText(FORUM_COPY.conflict);
    expect(target('APE (IDR B)')).toHaveValue('1.5');
    expect(calls.filter((c) => (c.init.method ?? 'GET') === 'GET')).toHaveLength(1);
  });

  it('any other failure keeps what was typed, says so, and leaving the cell again sends it again', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(Scorecard, makeMeetingView(), {
      'PUT /leader-meetings/m14/monthly-targets/flc': [writeFailed, { body: { value: '9', version: 2 } }],
    });
    await user.clear(target('FLC (avg. monthly)'));
    await user.type(target('FLC (avg. monthly)'), '9');
    await user.tab();
    await screen.findByText(FORUM_COPY.failed);
    expect(target('FLC (avg. monthly)')).toHaveValue('9');

    await user.click(target('FLC (avg. monthly)'));
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    expect(writesIn(calls).map((c) => bodyOf(c))).toEqual([{ value: '9', version: 1 }, { value: '9', version: 1 }]);
  });
});

describe('P18.1-T2 AC-8 a typed target is text, never markup (F-187)', () => {
  const markup = '<b>bold</b><script>window.hacked=1</script>';
  const withMarkup = (m = makeMeetingView()) => ({
    ...m,
    scorecard: { ...m.scorecard, rows: m.scorecard.rows.map((r) => (r.key === 'ape' ? { ...r, monthlyTarget: { value: markup, version: 1 } } : r)) },
  });

  it('in the input', () => {
    const { container } = renderTab(Scorecard, withMarkup());
    expect(target('APE (IDR B)')).toHaveValue(markup);
    expect(container.querySelector('b, script')).toBeNull();
  });

  it('read-only', () => {
    const { container } = renderTab(Scorecard, withMarkup(readOnlyMeeting()));
    expect(screen.getByText(markup)).toBeInTheDocument();
    expect(container.querySelector('b, script')).toBeNull();
    expect((window as { hacked?: number }).hacked).toBeUndefined();
  });
});

describe('P18.1-T2 AC-8 no axe violations', () => {
  // jsdom samples no pixels: contrast is the tokens' (`a11y.spec.tsx`), as `screens.a11y.spec.tsx` has it. A tab
  // drawn alone sits in no landmark; on its page it is inside `<main>`, where that spec checks it.
  const clean = async () =>
    (await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [];

  it('for an editor', async () => {
    renderTab(Scorecard);
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });

  it('read-only', async () => {
    renderTab(Scorecard, readOnlyMeeting());
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });
});
