import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderInLayout, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import {
  AAB_RUNG, AGUS, busy, DOWNLINE, entry, monthRead, peoplePage, person, RINA, SHELL_STUBS, trip, WEEK, weekRead,
} from '@test/calendar-fixtures';
import type { CalendarEntry, CalendarRead } from '@/lib/calendar';
import { HOUR_PX } from '@/lib/calendar-layout';
import { PHONE_QUERY } from '@/lib/use-phone';
import AgentLayout from '../layout';
import CalendarPage from './page';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/calendar',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The address's query (`useQuery`, `lib/use-query.ts`): each test names its own, and starts from none. */
beforeEach(() => { nav.search = ''; });

/**
 * jsdom has no `PointerEvent`, so a pointer event would arrive without its `clientY` and its type.
 * The grid takes a slot by pointer events (H-18), so the spec gives jsdom the one the browser has.
 */
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    class PointerEventDouble extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'mouse';
      }
    }
    Object.assign(window, { PointerEvent: PointerEventDouble });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const RANGE = '28 Sep – 4 Okt 2026';
const WEEK_READ = '/calendar/entries?view=week';
const MONTH_READ = '/calendar/entries?view=month';
/** The reader's own setting, *Hide my personal activities* (ADR-0110): off, as a new member's is. */
const SETTINGS = '/calendar/settings';

type Query = { view?: string; date?: string; entry?: string; with?: string };

function show(routes: Record<string, StubReply | StubReply[]> = {}, me = AGUS, query?: Query) {
  const stub = stubFetch({ [WEEK_READ]: { body: weekRead() }, [SETTINGS]: { body: { hideDetails: false } }, ...routes });
  nav.search = new URLSearchParams(query).toString();
  renderWithSession(<CalendarPage />, { me });
  return stub;
}

const grid = (range = RANGE) => screen.findByRole('region', { name: `Calendar, ${range}` });
const day = async (name: string) => within(await grid()).getByRole('group', { name });
const calls = (stub: ReturnType<typeof stubFetch>, fragment: string, method = 'GET') =>
  stub.calls.filter((c) => c.url.includes(fragment) && (c.init.method ?? 'GET') === method);
const bodyOf = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));
const refusal = (status: number, code: string, details?: Record<string, unknown>) => ({
  status, body: { error: { code, message: `Refused: ${code}`, requestId: 'req-1', ...(details ? { details } : {}) } },
});

/** A tap on a column at an office time: down and up where it went down. */
function tap(column: HTMLElement, minutes: number) {
  const clientY = (minutes / 60) * HOUR_PX;
  fireEvent.pointerDown(column, { clientY, pointerId: 1, pointerType: 'mouse', button: 0 });
  fireEvent.pointerUp(column, { clientY, pointerId: 1, pointerType: 'mouse', button: 0 });
}

function drag(column: HTMLElement, from: number, to: number) {
  const y = (m: number) => (m / 60) * HOUR_PX;
  fireEvent.pointerDown(column, { clientY: y(from), pointerId: 1, pointerType: 'mouse', button: 0 });
  fireEvent.pointerMove(column, { clientY: y(to), pointerId: 1, pointerType: 'mouse' });
  fireEvent.pointerUp(column, { clientY: y(to), pointerId: 1, pointerType: 'mouse' });
}

const standup = () => screen.getByRole('button', { name: 'Internal meeting: Weekly unit standup, 09.00–09.30' });

/**
 * The *Drag to block* pill's name: its visible words, then *": Block time — {name}"*, read and not drawn
 * (M2). jsdom puts a space before the colon, taking an element's text as a block's; a browser need not.
 */
const PILL_INDAH = /^Drag to block ?: Block time — Indah Permata$/;

describe('P12-T2 — my calendar, week view', () => {
  it('P12-T2 AC-1 puts Calendar fifth in Personal tools, after Personal summary, with a glyph of its own', async () => {
    stubFetch({ ...SHELL_STUBS, [WEEK_READ]: { body: weekRead() } });
    renderInLayout(AgentLayout, <CalendarPage />, { me: AGUS });
    const link = (await screen.findByText('Calendar', { selector: 'a *, a' })).closest('a')!;
    expect(link).toHaveAttribute('href', '/calendar');
    const items = [...link.closest('ul')!.querySelectorAll('a')].map((a) => a.textContent?.trim());
    expect(items.indexOf('Calendar')).toBe(items.indexOf('Personal summary') + 1);
    expect(items.slice(0, 5)).toEqual(['Activity management', 'Leads management', 'Goal settings', 'Personal summary', 'Calendar']);
    const eventList = screen.getByText('Event list').closest('a')!;
    expect(link.querySelector('svg')!.innerHTML).not.toBe(eventList.querySelector('svg')!.innerHTML);
  });

  it('P12-T2 AC-2 draws the page verbatim: title, toolbar, legend, the Monday-first week and its hours', async () => {
    show();
    expect(screen.getByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument();
    const region = await grid();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous week' })).toHaveTextContent('‹');
    expect(screen.getByRole('button', { name: 'Next week' })).toHaveTextContent('›');
    expect(screen.getByText(RANGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '+ New event' })).toBeInTheDocument();
    const legend = screen.getByText('Internal meeting').closest('ul')!;
    expect([...legend.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Internal meeting', '1:1 coaching', 'Client meeting', 'Task', 'Travel',
    ]);
    const pane = region.closest('section')!;
    expect(within(pane).getByText('Agus Santoso')).toBeInTheDocument();
    expect(within(pane).getByText('AB · You')).toBeInTheDocument();
    for (const [weekday, number] of [['Sen', '28'], ['Rab', '30'], ['Kam', '1 Okt'], ['Min', '4']]) {
      expect(within(pane).getByText(number).parentElement).toHaveTextContent(`${weekday}${number}`);
    }
    for (const hour of ['00.00', '07.00', '12.00', '23.00']) expect(within(region).getByText(hour)).toBeInTheDocument();
    // A half-hour entry has room for its title alone (P13.1-T8 AC-1): the time is in its name.
    expect(standup()).toHaveTextContent(/^Weekly unit standup$/);
    expect(screen.getByRole('button', { name: 'Task: Prospecting call block, 10.00–11.30' }))
      .toHaveTextContent('Prospecting call block10.00–11.30');
    // Opened scrolled to 07.00 (`DEFAULT_SCROLL_HOUR`, `:455`).
    expect(region.scrollTop).toBe(7 * HOUR_PX);
  });

  it('P12-T2 AC-2 tints today and the weekend, and today’s number is amber-ink (H-19)', async () => {
    show();
    const monday = await day('Senin, 28 Sep 2026');
    expect(monday.className).toContain('bg-amber/[0.08]');
    expect((await day('Sabtu, 3 Okt 2026')).className).toContain('bg-navy/[0.015]');
    expect(screen.getByText('28').className).toContain('text-amber-ink');
    expect(screen.getByText('29').className).toContain('text-navy');
  });

  describe('P12-T2 AC-3 the office’s clock', () => {
    it('asks for no date, and labels the week the server answered', async () => {
      const stub = show();
      await grid();
      expect(calls(stub, '/calendar/entries')[0].url).toMatch(/\/calendar\/entries\?view=week$/);
    });

    it('draws the now-line in today’s column only, at the read’s minute', async () => {
      show();
      const monday = await day('Senin, 28 Sep 2026');
      const line = monday.querySelector<HTMLElement>('[data-now]')!;
      expect(parseFloat(line.style.top)).toBeCloseTo((585 / 60) * HOUR_PX);
      expect(document.querySelectorAll('[data-now]')).toHaveLength(1);
    });

    it('draws no now-line in a week that is not this one', async () => {
      show({ [WEEK_READ]: { body: weekRead({ today: '2026-10-07' }) } });
      await grid();
      expect(document.querySelector('[data-now]')).toBeNull();
    });

    // Heavy under a loaded CI runner (5s was missed there on 2026-10-26, alone it takes under a second).
    it('moves the line each minute, and reads again once it passes midnight', { timeout: 20_000 }, async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'Date'] });
      const late = weekRead({ now: { at: '2026-09-28T16:58:00.000Z', minute: 1438 } });
      const stub = show({ [WEEK_READ]: { body: late } });
      const monday = await day('Senin, 28 Sep 2026');
      const top = () => parseFloat(monday.querySelector<HTMLElement>('[data-now]')!.style.top);
      expect(top()).toBeCloseTo((1438 / 60) * HOUR_PX);
      // The line's clock starts in a passive effect, which a slow runner may not have run when the grid shows: flush it
      // first, or the minute is advanced before the clock exists and it starts a minute late (CI, 2026-10-28).
      await act(async () => {});
      await act(async () => { vi.advanceTimersByTime(60_000); });
      expect(top()).toBeCloseTo((1439 / 60) * HOUR_PX);
      expect(calls(stub, WEEK_READ)).toHaveLength(1);
      await act(async () => { vi.advanceTimersByTime(60_000); });
      await waitFor(() => expect(calls(stub, WEEK_READ)).toHaveLength(2));
    });
  });

  /*
   * P18.96-T6 AC-4 (ADR-0173 §3): `/new-hires`' *Schedule 1:1* opens `/calendar?with={membershipId}` — the new-entry
   * dialog as a 1:1 with them. The name comes from the reader's own downline; the address carries only the id.
   */
  describe('P18.96-T6 AC-4 a 1:1 asked for by the address', () => {
    it('P18.96-T6 AC-4 opens New event as 1:1 coaching with them — titled, invited — on the office’s today', async () => {
      const stub = show({ '/calendar/downline': { body: DOWNLINE } }, AGUS, { with: 'mem-indah' });
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
      expect(within(dialog).getByRole('button', { name: '1:1 coaching' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByLabelText('Title')).toHaveValue('1:1 with Indah Permata');
      expect(within(dialog).getByText('Indah Permata')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-28');
      expect(calls(stub, '/calendar/downline')).toHaveLength(1);
    });

    it('P18.96-T6 AC-4 somebody not in the downline: the coaching entry with nobody invited and no name', async () => {
      show({ '/calendar/downline': { body: DOWNLINE } }, AGUS, { with: 'mem-nobody' });
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
      expect(within(dialog).getByRole('button', { name: '1:1 coaching' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByLabelText('Title')).toHaveValue('');
    });

    it('P18.96-T6 AC-4 a reader who may not create an entry is opened nothing, and nothing is read for it', async () => {
      const stub = show({ '/calendar/downline': { body: DOWNLINE } }, { ...AGUS, permissions: ['calendar_entry:read'] }, { with: 'mem-indah' });
      await grid();
      expect(screen.queryByRole('dialog', { name: 'New event' })).not.toBeInTheDocument();
      expect(calls(stub, '/calendar/downline')).toHaveLength(0);
    });
  });

  describe('P12-T2 AC-4 creating', () => {
    it('opens *New event* from the button on the office’s today, 10:00 to 10:30, an Internal meeting', async () => {
      show();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      const dialog = screen.getByRole('dialog', { name: 'New event' });
      expect(dialog).toHaveAccessibleDescription('Add a meeting, task, or coaching session to your calendar.');
      expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-28');
      expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00');
      expect(within(dialog).getByLabelText('End')).toHaveValue('10:30');
      expect(within(dialog).getByRole('button', { name: 'Internal meeting' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByLabelText('Title')).toHaveAttribute('placeholder', 'e.g. Weekly unit standup');
      expect(within(dialog).getByLabelText('Notes / location')).toHaveAttribute('placeholder', 'Zoom link, office, or agenda notes');
    });

    it('opens on the first day shown when today is not in view', async () => {
      show({ [WEEK_READ]: { body: weekRead({ today: '2026-10-07' }) } });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      expect(screen.getByLabelText('Date')).toHaveValue('2026-09-28');
    });

    it('shows Travel’s two dates, that day and the next, and any type can be chosen', async () => {
      show();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      for (const type of ['1:1 coaching', 'Client meeting', 'Task']) {
        await userEvent.click(screen.getByRole('button', { name: type }));
        expect(screen.getByRole('button', { name: type })).toHaveAttribute('aria-pressed', 'true');
      }
      await userEvent.click(screen.getByRole('button', { name: 'Travel' }));
      expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Departure date')).toHaveValue('2026-09-28');
      expect(screen.getByLabelText('Return date')).toHaveValue('2026-09-29');
    });

    it('resets every field on every open (contradiction 18)', async () => {
      show();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Leftover');
      await userEvent.click(screen.getByRole('button', { name: 'Task' }));
      fireEvent.change(screen.getByLabelText('Start'), { target: { value: '15:00' } });
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      expect(screen.getByLabelText('Title')).toHaveValue('');
      expect(screen.getByLabelText('Start')).toHaveValue('10:00');
      expect(screen.getByRole('button', { name: 'Internal meeting' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('a tap on an empty slot opens it at the prototype’s half hour; a drag snaps to a quarter', async () => {
      show();
      tap(await day('Selasa, 29 Sep 2026'), 14 * 60 + 5);
      const dialog = await screen.findByRole('dialog', { name: 'New event' });
      expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-29');
      expect(within(dialog).getByLabelText('Start')).toHaveValue('14:00');
      expect(within(dialog).getByLabelText('End')).toHaveValue('14:30');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      drag(await day('Rabu, 30 Sep 2026'), 10 * 60, 11 * 60 + 25);
      expect(screen.getByLabelText('Date')).toHaveValue('2026-09-30');
      expect(screen.getByLabelText('Start')).toHaveValue('10:00');
      expect(screen.getByLabelText('End')).toHaveValue('11:30');
    });

    it('P12-T2 AC-5 a drag to the grid’s foot ends at 00:00, never 24:00', async () => {
      show();
      drag(await day('Kamis, 1 Okt 2026'), 23 * 60, 24 * 60);
      expect(screen.getByLabelText('Start')).toHaveValue('23:00');
      expect(screen.getByLabelText('End')).toHaveValue('00:00');
    });

    it('draws the selection while dragging, takes no slot from a press on an entry, and drops a cancelled drag', async () => {
      show();
      const monday = await day('Senin, 28 Sep 2026');
      fireEvent.pointerDown(monday, { clientY: 600, pointerId: 1, pointerType: 'pen', button: 0 });
      fireEvent.pointerMove(monday, { clientY: 700, pointerId: 1, pointerType: 'pen' });
      expect(monday.querySelector('[data-selection]')).not.toBeNull();
      fireEvent.pointerCancel(monday, { pointerId: 1, pointerType: 'pen' });
      expect(monday.querySelector('[data-selection]')).toBeNull();
      fireEvent.pointerDown(standup(), { clientY: 510, pointerId: 1, pointerType: 'mouse', button: 0 });
      fireEvent.pointerDown(monday, { clientY: 900, pointerId: 1, pointerType: 'mouse', button: 2 });
      expect(monday.querySelector('[data-selection]')).toBeNull();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('saves a new entry and moves the grid to its week, and says Event created ✓ (P18.95-T1 AC-6)', async () => {
      const saved = entry({ entryId: 'e-new', title: 'Call list', date: '2026-10-06', start: '10:00', end: '10:30' });
      const stub = show({ 'POST /calendar/entries': { status: 201, body: saved } });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Call list');
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-06' } });
      await userEvent.type(screen.getByLabelText('Notes / location'), 'Desk');
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(bodyOf(calls(stub, '/calendar/entries', 'POST')[0])).toEqual({
        type: 'meeting', title: 'Call list', notes: 'Desk', date: '2026-10-06', start: '10:00', end: '10:30', inviteeIds: [],
      });
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-10-06`)).toHaveLength(1));
      // The toast said nothing until 2026-10-26; the client's UI review asked for it (UI-008).
      expect(screen.getByText('Event created ✓').closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-6: a refused new entry toasts nothing; its reason stays in the dialog', async () => {
      show({ 'POST /calendar/entries': refusal(500, 'INTERNAL_ERROR') });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Call list');
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));

      const dialog = screen.getByRole('dialog', { name: 'New event' });
      expect(await within(dialog).findByText('Refused: INTERNAL_ERROR')).toBeInTheDocument();
      expect(screen.queryByText('Event created ✓')).not.toBeInTheDocument();
    });
  });

  describe('P12-T2 AC-5 validation', () => {
    it('says what is wrong under the field and sends nothing', async () => {
      const stub = show();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      fireEvent.change(screen.getByLabelText('End'), { target: { value: '09:00' } });
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '' } });
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      expect(screen.getByText('Choose an end time after the start.')).toBeInTheDocument();
      expect(screen.getByText('Choose a date.')).toBeInTheDocument();
      expect(screen.getByLabelText('End')).toHaveAccessibleDescription('Choose an end time after the start.');
      expect(calls(stub, '/calendar/entries', 'POST')).toHaveLength(0);
    });

    it('holds a trip to its rules', async () => {
      show();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.click(screen.getByRole('button', { name: 'Travel' }));
      fireEvent.change(screen.getByLabelText('Return date'), { target: { value: '2026-09-20' } });
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      expect(screen.getByText('Choose a return date on or after the departure date.')).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('Return date'), { target: { value: '2026-11-30' } });
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      expect(screen.getByText('A trip can be at most 31 days.')).toBeInTheDocument();
    });

    it('puts a server refusal under its field, and keeps the dialog open on anything else (P12-T2 AC-14)', async () => {
      show({
        'POST /calendar/entries': [
          refusal(400, 'VALIDATION_FAILED', { violations: ['title must be 0–120 characters.'] }),
          refusal(500, 'INTERNAL_ERROR'),
        ],
      });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      expect(await screen.findByText('Keep the title to 120 characters.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      const dialog = screen.getByRole('dialog', { name: 'New event' });
      expect(await within(dialog).findByText('Refused: INTERNAL_ERROR')).toBeInTheDocument();
      expect(within(dialog).getByText('INTERNAL_ERROR · req-1')).toBeInTheDocument();
    });
  });

  it('P12-T2 AC-6 puts entries that overlap side by side, and stacks trips that overlap', async () => {
    show({
      [WEEK_READ]: {
        body: weekRead({
          entries: [
            entry({ entryId: 'a', title: 'Goal review', start: '09:00', end: '10:00' }),
            entry({ entryId: 'b', type: 'client', title: 'Client review', start: '09:30', end: '10:30' }),
            trip({ entryId: 't1' }),
            trip({ entryId: 't2', title: 'Training — Jakarta', startsOn: '2026-09-29', endsOn: '2026-09-30' }),
          ],
        }),
      },
    });
    await grid();
    const goal = screen.getByRole('button', { name: /^Internal meeting: Goal review/ });
    const client = screen.getByRole('button', { name: /^Client meeting: Client review/ });
    expect(goal.style.width).toBe('calc(50% - 6px)');
    expect(client.style.left).toBe('calc(50% + 3px)');
    const bars = [screen.getByRole('button', { name: 'Travel: Client trip — Surabaya' }), screen.getByRole('button', { name: 'Travel: Training — Jakarta' })];
    expect(bars.map((b) => b.style.top)).toEqual(['3px', '28px']);
    expect((bars[0].parentElement!.parentElement as HTMLElement).style.minHeight).toBe('53px');
  });

  describe('P12-T2 AC-7 the detail dialog', () => {
    it('reads the badge in the legend’s words, When, the notes and no one else invited, with Delete, Close and Edit for the organiser', async () => {
      show();
      await grid();
      await userEvent.click(standup());
      const dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
      // P18.95-T8 AC-2: the legend's name, not the prototype's capitalised code (*Meeting*).
      expect(within(dialog).getByText('Internal meeting')).toBeInTheDocument();
      expect(within(dialog).getByText('Senin, 28 Sep 2026 · 09.00 – 09.30')).toBeInTheDocument();
      // P18.95-T8 AC-2: the seed's bare *zoom.us/j/…* is a link, *Join Zoom*; the words around it stay.
      expect(within(dialog).getByText('Location / notes').nextElementSibling).toHaveTextContent('Zoom — Join Zoom, opens in a new tab');
      expect(within(dialog).getByText('No one else invited')).toBeInTheDocument();
      expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Delete', 'Close', 'Edit']);
    });

    it('reads an empty title and notes as the prototype does', async () => {
      show({ [WEEK_READ]: { body: weekRead({ entries: [entry({ title: '', notes: '' })] }) } });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: \(untitled event\)/ }));
      const dialog = screen.getByRole('dialog', { name: '(untitled event)' });
      expect(within(dialog).getByText('—')).toBeInTheDocument();
    });

    it('opens a trip from its bar, its When two dates, and edits it as its two dates (contradiction 6)', async () => {
      show();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: 'Travel: Client trip — Surabaya' }));
      const dialog = screen.getByRole('dialog', { name: 'Client trip — Surabaya' });
      expect(within(dialog).getByText('Travel')).toBeInTheDocument();
      expect(within(dialog).getByText('Senin, 28 Sep 2026 – Selasa, 29 Sep 2026')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Edit' }));
      expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
      expect(screen.getByLabelText('Departure date')).toHaveValue('2026-09-28');
      expect(screen.getByLabelText('Return date')).toHaveValue('2026-09-29');
    });

    it('offers anybody but the organiser Close alone (D-write)', async () => {
      show({ [WEEK_READ]: { body: weekRead({ entries: [entry({ readerIs: 'ancestor' })] }) } });
      await grid();
      await userEvent.click(standup());
      const dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
      expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['★Organiser', 'Close']);
      expect(within(dialog).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });
  });

  describe('P12-T2 AC-8 editing', () => {
    it('fills *Edit event* from the entry and saves it pinned to the version it read', async () => {
      const stub = show({
        'PATCH /calendar/entries/e-standup': ({ body }) => ({ body: entry({ ...(body as Partial<CalendarEntry>), version: 2 }) }),
      });
      await grid();
      await userEvent.click(standup());
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit event' });
      expect(dialog).toHaveAccessibleDescription('Update the details below.');
      expect(within(dialog).getByLabelText('Title')).toHaveValue('Weekly unit standup');
      expect(within(dialog).getByLabelText('Start')).toHaveValue('09:00');
      await userEvent.clear(within(dialog).getByLabelText('Title'));
      await userEvent.type(within(dialog).getByLabelText('Title'), 'Unit standup');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save event' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(bodyOf(calls(stub, '/calendar/entries/e-standup', 'PATCH')[0])).toMatchObject({
        version: 1, title: 'Unit standup', date: '2026-09-28', start: '09:00', end: '09:30', inviteeIds: [],
      });
      // An edit creates nothing: the entry it redraws is its answer (P18.95-T1 AC-6).
      expect(screen.queryByText('Event created ✓')).not.toBeInTheDocument();
    });

    it('reads a stale entry again, and says so (409 VERSION_CONFLICT)', async () => {
      const stub = show({
        'PATCH /calendar/entries/e-standup': refusal(409, 'VERSION_CONFLICT'),
        'GET /calendar/entries/e-standup': { body: entry({ version: 3, title: 'Standup, moved', start: '10:00', end: '10:30' }) },
      });
      await grid();
      await userEvent.click(standup());
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      expect(await screen.findByText('This entry was changed somewhere else, so it has been read again.')).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('Standup, moved');
      expect(screen.getByLabelText('Start')).toHaveValue('10:00');
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      expect(bodyOf(calls(stub, '/calendar/entries/e-standup', 'PATCH')[1]).version).toBe(3);
    });
  });

  describe('P12-T2 AC-9 deleting', () => {
    it('asks *Delete "{title}"?* in the product’s dialog, with no *can’t be undone*, and deletes pinned', async () => {
      const stub = show({ 'DELETE /calendar/entries/e-standup': { body: { entryId: 'e-standup', deletedAt: '2026-09-28T03:00:00.000Z' } } });
      await grid();
      await userEvent.click(standup());
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const question = screen.getByRole('dialog', { name: 'Delete "Weekly unit standup"?' });
      expect(question).not.toHaveTextContent(/undone/);
      await userEvent.click(within(question).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(calls(stub, '/calendar/entries/e-standup?version=1', 'DELETE')).toHaveLength(1);
      expect(calls(stub, WEEK_READ)).toHaveLength(2);
    });

    it('keeps the entry when the question is cancelled, and reads a stale one again', async () => {
      const stub = show({
        'DELETE /calendar/entries/e-standup': refusal(409, 'VERSION_CONFLICT'),
        'GET /calendar/entries/e-standup': { body: entry({ version: 2 }) },
      });
      await grid();
      await userEvent.click(standup());
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Weekly unit standup"?' })).getByRole('button', { name: 'Cancel' }));
      expect(calls(stub, '/calendar/entries/e-standup', 'DELETE')).toHaveLength(0);
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Weekly unit standup"?' })).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('This entry was changed somewhere else, so it has been read again.')).toBeInTheDocument();
    });

    const deleted = { body: { entryId: 'e-standup', deletedAt: '2026-09-28T03:00:00.000Z' } };
    const confirmDelete = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Weekly unit standup"?' })).getByRole('button', { name: 'Delete' }));
    };

    it('m7 puts the focus on the reader’s own week once the read without the entry lands', async () => {
      show({
        [WEEK_READ]: [{ body: weekRead() }, { body: weekRead({ entries: [] }) }],
        'DELETE /calendar/entries/e-standup': deleted,
      });
      await grid();
      await userEvent.click(standup());
      await confirmDelete();
      await waitFor(() => expect(screen.queryByRole('button', { name: /^Internal meeting: Weekly unit standup/ })).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('region', { name: `Calendar, ${RANGE}` })).toHaveFocus());
    });

    it('m7 puts it on *+ New event* in Month, where there is no week to land on', async () => {
      show({
        [MONTH_READ]: [{ body: monthRead() }, { body: monthRead({ entries: [] }) }],
        'DELETE /calendar/entries/e-standup': deleted,
      }, AGUS, { view: 'month' });
      await userEvent.click(await screen.findByRole('button', { name: 'Internal meeting: 9-9.30 Weekly unit standup' }));
      await confirmDelete();
      await waitFor(() => expect(screen.queryByRole('button', { name: /^Internal meeting: 9-9.30 Weekly unit standup/ })).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: '+ New event' })).toHaveFocus());
    });

    it('shows a refused delete in the detail', async () => {
      show({ 'DELETE /calendar/entries/e-standup': refusal(403, 'PERM_DENIED') });
      await grid();
      await userEvent.click(standup());
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Weekly unit standup"?' })).getByRole('button', { name: 'Delete' }));
      expect(await screen.findByText('Refused: PERM_DENIED')).toBeInTheDocument();
    });
  });

  describe('P12-T2 AC-10 moving about', () => {
    it('steps a week with ‹ and ›, by the dates the server named, and Today returns to 07.00', async () => {
      const stub = show();
      const region = await grid();
      await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-10-05`)).toHaveLength(1));
      await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-09-21`)).toHaveLength(1));
      region.scrollTop = 900;
      await userEvent.click(screen.getByRole('button', { name: 'Today' }));
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-09-28`)).toHaveLength(1));
      expect(region.scrollTop).toBe(7 * HOUR_PX);
    });
  });

  it('P12-T2 AC-11 names every entry by its type, title and time, and the grid by its week', async () => {
    show();
    const region = await grid();
    expect(region).toHaveAttribute('tabindex', '0');
    expect(standup().tagName).toBe('BUTTON');
    expect(screen.getByRole('button', { name: 'Task: Prospecting call block, 10.00–11.30' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Travel: Client trip — Surabaya' })).toBeInTheDocument();
  });

  it('P12-T2 AC-11 closes the dialogs on Escape and gives the focus back', async () => {
    show();
    await grid();
    await userEvent.click(standup());
    expect(screen.getByRole('dialog', { name: 'Weekly unit standup' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(standup()).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
    expect(screen.getByRole('button', { name: 'Internal meeting' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: '+ New event' })).toHaveFocus();
  });

  it('P12-T2 AC-13 lets a pane scroll sideways inside itself on a phone, never the page', async () => {
    show();
    const region = await grid();
    const sideways = region.parentElement!;
    expect(sideways.className).toContain('max-md:min-w-[388px]');
    expect(sideways.parentElement!.className).toContain('overflow-x-auto');
  });

  describe('P12-T2 AC-14 the states the prototype lacks', () => {
    it('holds a skeleton grid while the read is out', async () => {
      show();
      // The toast's live region is always in the page too, so the skeleton is found by what it says.
      expect(screen.getAllByRole('status').some((r) => r.textContent?.includes('Loading the calendar…'))).toBe(true);
      await grid();
    });

    it('says the calendar could not be loaded, with the code and a way to try again', async () => {
      const stub = show({ [WEEK_READ]: [refusal(500, 'INTERNAL_ERROR'), { body: weekRead() }] });
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('The calendar couldn\'t be loaded.');
      expect(alert).toHaveTextContent('INTERNAL_ERROR · req-1');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await grid();
      expect(calls(stub, WEEK_READ)).toHaveLength(2);
    });

    it('draws an empty week as the bare grid, with no sentence added', async () => {
      show({ [WEEK_READ]: { body: weekRead({ entries: [] }) } });
      const region = await grid();
      expect(within(region).queryAllByRole('button')).toHaveLength(0);
      expect(screen.queryByText(/nothing|no entries|empty/i)).not.toBeInTheDocument();
    });
  });

  it('P12-T2 AC-15 shows a role with no calendar the refusal, and asks the API for nothing', () => {
    const stub = stubFetch({});
    renderWithSession(<CalendarPage />, { me: makeMe({ permissions: [] }) });
    expect(screen.getByRole('heading', { name: 'Not available to you' })).toBeInTheDocument();
    expect(stub.calls).toHaveLength(0);
  });
});

describe('P12-T3 — month view', () => {
  const fourOnTheDay = [
    entry({ entryId: 'm1' }),
    entry({ entryId: 'm2', type: 'coaching', title: '1:1 Coaching — Rina Wijaya', start: '11:00', end: '12:00' }),
    entry({ entryId: 'm3', type: 'client', title: 'Client review — Hartono family', start: '14:00', end: '15:00' }),
    entry({ entryId: 'm4', title: 'Quick call', start: '16:00', end: '16:30' }),
    entry({ entryId: 'm5', type: 'task', title: 'Leads follow-up block', date: '2026-10-01', start: '13:00', end: '14:00' }),
    trip({ entryId: 'm6', startsOn: '2026-09-29', endsOn: '2026-09-30' }),
  ];
  const showMonth = (routes: Record<string, StubReply | StubReply[]> = {}) => show({
    [MONTH_READ]: { body: monthRead({ entries: fourOnTheDay }) },
    ...routes,
  });

  it('P12-T3 AC-1 switches to the month, labelled *Sep 2026*, Mon to Sun, a month at a time', async () => {
    const stub = showMonth();
    await grid();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(await screen.findByText('Sep 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(calls(stub, MONTH_READ)[0].url).toMatch(/\?view=month$/);
    for (const name of ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^\S+, \d{1,2} \S+ 2026$/ })).toHaveLength(35);
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));
    await waitFor(() => expect(calls(stub, `${MONTH_READ}&date=2026-10-01`)).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    await waitFor(() => expect(calls(stub, `${MONTH_READ}&date=2026-08-01`)).toHaveLength(1));
  });

  it('opens on the month from the address, its frame held while the read is out', async () => {
    const stub = show({ [MONTH_READ]: { body: monthRead() } }, AGUS, { view: 'month', date: '2026-09-14' });
    // The toast's live region is always in the page too, so the skeleton is found by what it says.
      expect(screen.getAllByRole('status').some((r) => r.textContent?.includes('Loading the calendar…'))).toBe(true);
    expect(await screen.findByText('Sep 2026')).toBeInTheDocument();
    expect(calls(stub, MONTH_READ)[0].url).toMatch(/\?view=month&date=2026-09-14$/);
  });

  it('P12-T3 AC-2, AC-3 lists a day’s entries by start, three then *+{n} more…*, in the month’s own time', async () => {
    showMonth();
    await grid();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    await screen.findByText('Sep 2026');
    const cell = document.querySelector<HTMLElement>('[data-date="2026-09-28"]')!;
    const lines = within(cell).getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual(['9-9.30Weekly unit standup', '11-121:1 Coaching — Rina Wijaya', '14-15Client review — Hartono family', '+1 more…']);
    expect(within(cell).getByRole('button', { name: 'Internal meeting: 9-9.30 Weekly unit standup' })).toBeInTheDocument();
    // An adjacent month's day shows its entries; a trip shows on each day it spans, with no time.
    const october = document.querySelector<HTMLElement>('[data-date="2026-10-01"]')!;
    expect(within(october).getByText('Leads follow-up block')).toBeInTheDocument();
    for (const date of ['2026-09-29', '2026-09-30']) {
      const trips = within(document.querySelector<HTMLElement>(`[data-date="${date}"]`)!);
      expect(trips.getByRole('button', { name: 'Travel: Client trip — Surabaya' })).toBeInTheDocument();
    }
  });

  it('P12-T3 AC-6 mutes only an adjacent month’s number, and marks today in amber-ink', async () => {
    showMonth();
    await grid();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    await screen.findByText('Sep 2026');
    const number = (date: string) => document.querySelector(`[data-date="${date}"] > span`)!;
    expect(number('2026-08-31').className).toContain('text-muted');
    expect(number('2026-09-28').className).toContain('text-amber-ink');
    expect(number('2026-09-15').className).toContain('text-navy');
    expect(screen.getByRole('button', { name: 'Senin, 28 Sep 2026' })).toHaveAttribute('aria-current', 'date');
  });

  it('F4 draws *+{n} more…* as its count alone on a phone, the whole phrase read, and keeps it in its cell', async () => {
    showMonth();
    await grid();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    const more = await screen.findByRole('button', { name: '+1 more…' });
    expect(more).toHaveTextContent('+1 more…');
    expect(more.firstChild!.textContent).toBe('+1');
    const rest = more.querySelector('span')!;
    expect(rest.textContent).toBe(' more…');
    expect(rest.className).toContain('max-sm:sr-only');
    expect(more.className).toContain('max-w-full');
    expect(more.className).toContain('truncate');
    expect(more.closest('li')!.className).toContain('min-w-0');
  });

  describe('P12-T3 AC-4 clicking (D-month)', () => {
    it('a cell opens Week on that day’s week, and *+{n} more…* the week it hides', async () => {
      const stub = showMonth();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Rabu, 16 Sep 2026' }));
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-09-16`)).toHaveLength(1));
      expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await userEvent.click(await screen.findByRole('button', { name: '+1 more…' }));
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-09-28`)).toHaveLength(1));
    });

    it('a line opens its entry’s detail', async () => {
      showMonth();
      await grid();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await userEvent.click(await screen.findByRole('button', { name: '1:1 coaching: 11-12 1:1 Coaching — Rina Wijaya' }));
      expect(screen.getByRole('dialog', { name: '1:1 Coaching — Rina Wijaya' })).toBeInTheDocument();
    });

    it('P18.95-T8 AC-2 offers compare in Month as in Week (UI-020): the chips stay, and each compared month is a pane of its own, read once', async () => {
      const indahMonth = monthRead({
        subject: { membershipId: 'mem-indah', name: 'Indah Permata', rung: { code: 'AGENT', label: 'Agent' } },
        entries: [
          entry({ entryId: 'i-m1', type: 'task', title: 'Prospecting', date: '2026-09-15', organiser: { membershipId: 'mem-indah', name: 'Indah Permata' }, readerIs: 'ancestor' }),
          busy({ date: '2026-09-16' }),
        ],
      });
      const stub = showMonth({
        '/calendar/downline': { body: DOWNLINE },
        'for=mem-indah': { body: weekRead() },
        'view=month&date=2026-09-01&for=mem-indah': { body: indahMonth },
      });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
      await userEvent.click(await screen.findByRole('button', { name: /Indah Permata/ }));
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await screen.findByText('Sep 2026');
      // The same controls as the week's: the compare button and the chip chosen.
      expect(screen.getByRole('button', { name: '+ Compare with downline' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove Indah Permata' })).toBeInTheDocument();
      // Her month under its head, her entries in full and her busy block as *Busy*, which opens nothing.
      const theirs = await screen.findByRole('region', { name: 'Indah Permata' });
      expect(within(theirs).getByText('Agent')).toBeInTheDocument();
      expect(within(theirs).getByRole('button', { name: 'Task: 9-9.30 Prospecting' })).toBeInTheDocument();
      const busyLine = within(theirs.querySelector<HTMLElement>('[data-date="2026-09-16"]')!).getByText('Busy');
      expect(busyLine.closest('[data-busy]')).toHaveTextContent('13-14Busy');
      expect(busyLine.closest('button')).toBeNull();
      // The reader's own month heads its pane too, as the week's does.
      expect(screen.getByRole('region', { name: 'Agus Santoso' })).toHaveTextContent('AB · You');
      expect(calls(stub, 'view=month&date=2026-09-01&for=mem-indah')).toHaveLength(1);
      // Back in Week, her week again, from its last read.
      await userEvent.click(screen.getByRole('button', { name: 'Week' }));
      expect(await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` })).toBeInTheDocument();
      expect(calls(stub, 'view=week&date=2026-09-28&for=mem-indah')).toHaveLength(1);
    });
  });

  it('P12-T3 AC-7 keeps seven columns at any width', async () => {
    showMonth();
    await grid();
    await userEvent.click(screen.getByRole('button', { name: 'Month' }));
    await screen.findByText('Sep 2026');
    expect(document.querySelector('[data-date="2026-09-28"]')!.parentElement!.className).toContain('grid-cols-7');
  });
});

describe('P12-T4 — invitations and the people picker', () => {
  const openNew = async () => {
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
    return screen.getByRole('dialog', { name: 'New event' });
  };

  it('P12-T4 AC-1, AC-3 lists the office on focus, grouped relative to the reader, tagged by rung and leader', async () => {
    const stub = show({ '/calendar/people': { body: peoplePage() } });
    const dialog = await openNew();
    const field = within(dialog).getByLabelText('Invite (optional) — anyone in your KPM');
    expect(field).toHaveAttribute('placeholder', 'Search your KPM by name…');
    await userEvent.click(field);
    const heading = await within(dialog).findByText('Your direct unit');
    expect(calls(stub, '/calendar/people')[0].url).toMatch(/\/calendar\/people\?limit=50$/);
    expect(heading).toBeInTheDocument();
    for (const name of ['Your group (AAB teams)', 'Other units in your KPM', 'KPM leadership']) {
      expect(within(dialog).getByText(name)).toBeInTheDocument();
    }
    const tag = (name: string) => within(dialog).getByRole('option', { name: new RegExp(`^${name}`) }).textContent;
    expect(tag('Indah Permata')).toBe('IPIndah PermataAgent');
    expect(tag('Sari Dewi')).toBe('SDSari DewiAAB');
    expect(tag('Rina Wijaya')).toBe('RWRina WijayaAgent · under Sari Dewi');
    expect(tag('Budi Wicaksono')).toBe('BWBudi WicaksonoAB · under Hendra Kusnadi');
    expect(tag('Hendra Kusnadi')).toBe('HKHendra KusnadiAB');
  });

  it('P12-T4 AC-3 takes a direct report from the server’s `direct`, never from a leader’s name matching the reader’s', async () => {
    show({
      '/calendar/people': {
        body: peoplePage([
          // An AAB in Agus's group who reports to him, as the server says.
          person('mem-sari', 'Sari Dewi', 'group', { rung: AAB_RUNG, direct: true }),
          // An agent in his group led by a namesake of his: the same name, somebody else.
          person('mem-dewi', 'Dewi Lestari', 'group', { leaderName: 'Agus Santoso', direct: false }),
        ]),
      },
    });
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
    const tag = async (name: string) => (await within(dialog).findByRole('option', { name: new RegExp(`^${name}`) })).textContent;
    expect(await tag('Sari Dewi')).toBe('SDSari DewiAAB');
    expect(await tag('Dewi Lestari')).toBe('DLDewi LestariAgent · under Agus Santoso');
  });

  it('P12-T4 AC-1 draws an empty group not at all: an Agent sees the last two', async () => {
    show({ '/calendar/people': { body: peoplePage([PEOPLE_OTHER, PEOPLE_LEAD]) } }, RINA);
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
    await within(dialog).findByText('Other units in your KPM');
    expect(within(dialog).queryByText('Your direct unit')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Your group (AAB teams)')).not.toBeInTheDocument();
  });

  it('P12-T4 AC-1 picks into a chip, keeps the list open without them, searches on the server, and removes', async () => {
    const stub = show({
      '/calendar/people?limit': { body: peoplePage() },
      '/calendar/people?q=zz': { body: peoplePage([]) },
      'POST /calendar/entries': { status: 201, body: entry() },
    });
    const dialog = await openNew();
    const field = within(dialog).getByLabelText('Invite (optional) — anyone in your KPM');
    await userEvent.click(field);
    await userEvent.click(await within(dialog).findByRole('option', { name: /^Indah Permata/ }));
    expect(within(dialog).getByRole('button', { name: 'Remove Indah Permata' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('option', { name: /^Indah Permata/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /^Sari Dewi/ })).toBeInTheDocument();
    expect(field).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('option', { name: /^Sari Dewi/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Sari Dewi' }));
    await userEvent.type(field, 'zz');
    expect(await within(dialog).findByText('No matches.')).toBeInTheDocument();
    expect(calls(stub, '/calendar/people?q=zz')).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(calls(stub, '/calendar/entries', 'POST')).toHaveLength(1));
    expect(bodyOf(calls(stub, '/calendar/entries', 'POST')[0]).inviteeIds).toEqual(['mem-indah']);
  });

  it('closes the list on Escape without closing the dialog, and on a press outside it', async () => {
    show({ '/calendar/people': { body: peoplePage() } });
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
    await within(dialog).findByText('Your direct unit');
    await userEvent.keyboard('{Escape}');
    expect(within(dialog).queryByText('Your direct unit')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New event' })).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'), 'i');
    await within(dialog).findByText('Your direct unit');
    await userEvent.click(within(dialog).getByLabelText('Title'));
    expect(within(dialog).queryByText('Your direct unit')).not.toBeInTheDocument();
  });

  it('says *Searching…*, and when the list fails, says so with a way to try again', async () => {
    const stub = show({ '/calendar/people': [refusal(500, 'INTERNAL_ERROR'), { body: peoplePage() }] });
    // The first search is held, so the wait can be seen; the stub answers it once released.
    const answer = stub.mock.getMockImplementation()!;
    let release = () => {};
    const held = new Promise<void>((resolve) => { release = resolve; });
    const dialog = await openNew();
    stub.mock.mockImplementationOnce(async (url: string, init?: RequestInit) => {
      await held;
      return answer(url, init);
    });
    await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
    expect(within(dialog).getByText('Searching…')).toBeInTheDocument();
    release();
    expect(await within(dialog).findByText('The list couldn\'t be loaded.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(await within(dialog).findByText('Your direct unit')).toBeInTheDocument();
  });

  it('loads the next page when the list is scrolled to its foot', async () => {
    const stub = show({
      '/calendar/people?limit': { body: peoplePage(PEOPLE_FIRST, true) },
      '/calendar/people?cursor=c-2': { body: peoplePage([PEOPLE_LEAD]) },
    });
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
    const list = (await within(dialog).findByText('Your direct unit')).closest('[id$="-people"]')!;
    fireEvent.scroll(list);
    expect(await within(dialog).findByRole('option', { name: /^Hendra Kusnadi/ })).toBeInTheDocument();
    expect(calls(stub, '/calendar/people?cursor=c-2&limit=50')).toHaveLength(1);
  });

  const combobox = (dialog: HTMLElement) => within(dialog).getByRole('combobox', { name: 'Invite (optional) — anyone in your KPM' });

  it('m1 is a combobox: ↓ and ↑ reach a person, Enter picks them, and the focus stays in the field', async () => {
    const stub = show({ '/calendar/people': { body: peoplePage() } });
    const dialog = await openNew();
    const field = combobox(dialog);
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).toHaveAttribute('aria-autocomplete', 'list');
    await userEvent.click(field);
    expect(field).toHaveAttribute('aria-expanded', 'true');
    const list = await within(dialog).findByRole('listbox', { name: 'Invite (optional) — anyone in your KPM' });
    expect(field).toHaveAttribute('aria-controls', list.id);
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.tabIndex)).toEqual(options.map(() => -1));
    expect(field).not.toHaveAttribute('aria-activedescendant');

    await userEvent.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(field).toHaveAttribute('aria-activedescendant', options[1].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAccessibleName(/^Sari Dewi/);

    // Enter picks; it does not save the dialog around the field.
    await userEvent.keyboard('{Enter}');
    expect(within(dialog).getByRole('button', { name: 'Remove Sari Dewi' })).toBeInTheDocument();
    expect(calls(stub, '/calendar/entries', 'POST')).toHaveLength(0);
    expect(field).toHaveFocus();
    // The next person takes the place of the one picked.
    expect(field).toHaveAttribute('aria-activedescendant', within(dialog).getByRole('option', { name: /^Rina Wijaya/ }).id);

    await userEvent.keyboard('{Escape}');
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: 'New event' })).toBeInTheDocument();
    // ↓ opens it again; ↑ from nobody reaches the last person.
    await userEvent.keyboard('{ArrowDown}');
    await within(dialog).findByRole('listbox');
    await userEvent.keyboard('{ArrowUp}');
    expect(field).toHaveAttribute('aria-activedescendant', within(dialog).getByRole('option', { name: /^Hendra Kusnadi/ }).id);
  });

  it('m1 closes the list when the focus leaves the field, and not when it moves to a chip’s ✕', async () => {
    show({ '/calendar/people': { body: peoplePage() } });
    const dialog = await openNew();
    const field = combobox(dialog);
    await userEvent.click(field);
    await userEvent.click(await within(dialog).findByRole('option', { name: /^Indah Permata/ }));
    expect(field).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(within(dialog).getByRole('button', { name: 'Remove Indah Permata' })).toHaveFocus();
    expect(within(dialog).getByRole('listbox')).toBeInTheDocument();
    await userEvent.tab();
    expect(field).toHaveFocus();
    await userEvent.tab();
    expect(within(dialog).getByLabelText('Date')).toHaveFocus();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('m1 Escape from the list’s *Try again* closes it, and gives the focus back to the field', async () => {
    show({ '/calendar/people': refusal(500, 'INTERNAL_ERROR') });
    const dialog = await openNew();
    const field = combobox(dialog);
    await userEvent.click(field);
    await within(dialog).findByText('The list couldn\'t be loaded.');
    expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.tab();
    expect(within(dialog).getByRole('button', { name: 'Try again' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: 'New event' })).toBeInTheDocument();
  });

  it('m1 ↓ past the last person asks for the next page', async () => {
    const stub = show({
      '/calendar/people?limit': { body: peoplePage(PEOPLE_FIRST, true) },
      '/calendar/people?cursor=c-2': { body: peoplePage([PEOPLE_LEAD]) },
    });
    const dialog = await openNew();
    const field = combobox(dialog);
    await userEvent.click(field);
    await within(dialog).findByRole('option', { name: /^Sari Dewi/ });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(calls(stub, '/calendar/people?cursor=c-2')).toHaveLength(0);
    await userEvent.keyboard('{ArrowDown}');
    const hendra = await within(dialog).findByRole('option', { name: /^Hendra Kusnadi/ });
    expect(calls(stub, '/calendar/people?cursor=c-2&limit=50')).toHaveLength(1);
    await userEvent.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', hendra.id);
  });

  it('m6 asks for the next page by itself when everybody on the page is chosen, rather than saying *No matches.*', async () => {
    const stub = show({
      '/calendar/people?limit': { body: peoplePage(PEOPLE_FIRST, true) },
      '/calendar/people?cursor=c-2': { body: peoplePage([PEOPLE_LEAD]) },
    });
    const dialog = await openNew();
    await userEvent.click(combobox(dialog));
    await userEvent.click(await within(dialog).findByRole('option', { name: /^Indah Permata/ }));
    expect(calls(stub, '/calendar/people?cursor=c-2')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('option', { name: /^Sari Dewi/ }));
    expect(await within(dialog).findByRole('option', { name: /^Hendra Kusnadi/ })).toBeInTheDocument();
    expect(within(dialog).queryByText('No matches.')).not.toBeInTheDocument();
    expect(calls(stub, '/calendar/people?cursor=c-2&limit=50')).toHaveLength(1);
  });

  it('marks somebody who can no longer be invited, and says what to do', async () => {
    show({
      '/calendar/people': { body: peoplePage() },
      'POST /calendar/entries': refusal(404, 'NOT_FOUND', { inviteeIds: ['mem-indah'] }),
    });
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByLabelText('Invite (optional) — anyone in your KPM'));
    await userEvent.click(await within(dialog).findByRole('option', { name: /^Indah Permata/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save event' }));
    expect(await within(dialog).findByText('Someone you invited can\'t be invited any more. Remove them and save again.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remove Indah Permata' }).closest('li')).toHaveAttribute('data-refused');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Indah Permata' }));
    expect(within(dialog).queryByRole('button', { name: 'Remove Indah Permata' })).not.toBeInTheDocument();
  });

  describe('WCAG 2.4.3 removing a chip keeps the focus in the dialog, never on the page behind it', () => {
    // Each name picked into a chip, in order, and the list closed: the focus is back in the field.
    const withChips = async (names: string[]) => {
      show({ '/calendar/people': { body: peoplePage() } });
      const dialog = await openNew();
      const field = combobox(dialog);
      await userEvent.click(field);
      for (const name of names) {
        await userEvent.click(await within(dialog).findByRole('option', { name: new RegExp(`^${name}`) }));
      }
      await userEvent.keyboard('{Escape}');
      expect(field).toHaveFocus();
      return { dialog, field };
    };
    const remover = (dialog: HTMLElement, name: string) => within(dialog).getByRole('button', { name: `Remove ${name}` });

    it('hands it to the next chip’s ✕ when a middle chip is removed', async () => {
      const { dialog } = await withChips(['Indah Permata', 'Sari Dewi', 'Rina Wijaya']);
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      expect(remover(dialog, 'Sari Dewi')).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(within(dialog).queryByRole('button', { name: 'Remove Sari Dewi' })).not.toBeInTheDocument();
      expect(remover(dialog, 'Rina Wijaya')).toHaveFocus();
      expect(screen.getByRole('dialog', { name: 'New event' })).toBeInTheDocument();
    });

    it('hands it to the previous chip’s ✕ when the last chip is removed', async () => {
      const { dialog } = await withChips(['Indah Permata', 'Sari Dewi']);
      await userEvent.tab({ shift: true });
      expect(remover(dialog, 'Sari Dewi')).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(within(dialog).queryByRole('button', { name: 'Remove Sari Dewi' })).not.toBeInTheDocument();
      expect(remover(dialog, 'Indah Permata')).toHaveFocus();
    });

    it('hands it to the field, without opening the list, when the only chip is removed', async () => {
      const { dialog, field } = await withChips(['Indah Permata']);
      await userEvent.tab({ shift: true });
      expect(remover(dialog, 'Indah Permata')).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(within(dialog).queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
      expect(field).toHaveFocus();
      expect(field).toHaveAttribute('aria-expanded', 'false');
      expect(within(dialog).queryByRole('listbox')).not.toBeInTheDocument();
      // The quiet focus is spent: the next focus the reader gives the field opens the list as before.
      await userEvent.tab({ shift: true });
      await userEvent.tab();
      expect(await within(dialog).findByRole('listbox')).toBeInTheDocument();
    });
  });

  it('P12-T4 AC-4 names a pending invitation as waiting for the reader’s answer', async () => {
    show({ [WEEK_READ]: { body: weekRead({ entries: [entry({ readerIs: 'invitee', myAnswer: 'pending' })] }) } });
    await grid();
    expect(screen.getByRole('button', { name: 'Internal meeting: Weekly unit standup, 09.00–09.30, waiting for your answer' })).toBeInTheDocument();
  });

  describe('P12-T4 AC-5 answering (ADR-0097)', () => {
    const invited = entry({
      readerIs: 'invitee',
      myAnswer: 'pending',
      organiser: { membershipId: 'mem-sari', name: 'Sari Dewi' },
      invitees: [{ membershipId: 'mem-agus', name: 'Agus Santoso', placed: false, readerCoaches: false }],
    });

    it('puts Decline in Delete’s place and Accept in Edit’s, and the organiser’s chip first', async () => {
      show({ [WEEK_READ]: { body: weekRead({ entries: [invited] }) } });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Weekly unit standup/ }));
      const dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
      expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['★Organiser', 'Decline', 'Close', 'Accept']);
      const [first, second] = within(dialog).getAllByRole('listitem');
      expect(first).toHaveTextContent(/^SDSari Dewi/);
      expect(within(first).getByRole('button', { name: 'Organiser' })).toBeInTheDocument();
      expect(second).toHaveTextContent('Agus Santoso');
      expect(within(dialog).getByRole('button', { name: 'Accept' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('after an answer the detail closes, a toast says what changed, the grid reads again and the badge is told (the product owner’s walk, 2026-10-03)', async () => {
      const stub = show({
        [WEEK_READ]: { body: weekRead({ entries: [invited] }) },
        'POST /calendar/entries/e-standup/answer': ({ body }) => ({ body: { ...invited, myAnswer: (body as { answer: string }).answer } }),
      });
      const heard = vi.fn();
      window.addEventListener('agencyboost:inbox-changed', heard);
      try {
        await grid();
        const reads = () => calls(stub, '/calendar/entries?', 'GET').length;
        const before = reads();

        await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Weekly unit standup/ }));
        await userEvent.click(within(screen.getByRole('dialog', { name: 'Weekly unit standup' })).getByRole('button', { name: 'Accept' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Weekly unit standup' })).not.toBeInTheDocument());
        expect(bodyOf(calls(stub, '/answer', 'POST')[0])).toEqual({ answer: 'accepted' });
        expect(await screen.findByText('Invitation accepted.')).toBeInTheDocument();
        expect(heard).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(reads()).toBeGreaterThan(before));

        await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Weekly unit standup/ }));
        await userEvent.click(within(screen.getByRole('dialog', { name: 'Weekly unit standup' })).getByRole('button', { name: 'Decline' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Weekly unit standup' })).not.toBeInTheDocument());
        expect(bodyOf(calls(stub, '/answer', 'POST')[1])).toEqual({ answer: 'declined' });
        expect(await screen.findByText('Invitation declined. It is no longer on your calendar.')).toBeInTheDocument();
        expect(heard).toHaveBeenCalledTimes(2);
      } finally {
        window.removeEventListener('agencyboost:inbox-changed', heard);
      }
    });

    it('shows a refused answer in the dialog', async () => {
      show({
        [WEEK_READ]: { body: weekRead({ entries: [invited] }) },
        'POST /calendar/entries/e-standup/answer': refusal(404, 'NOT_FOUND'),
      });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Weekly unit standup/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
      expect(await screen.findByText('Refused: NOT_FOUND')).toBeInTheDocument();
    });

    it('marks each invitee’s answer on the organiser’s chips, and a placed member’s chip as placed', async () => {
      show({
        [WEEK_READ]: {
          body: weekRead({
            entries: [entry({
              invitees: [
                { membershipId: 'mem-indah', name: 'Indah Permata', placed: false, answer: 'accepted', readerCoaches: false },
                { membershipId: 'mem-sari', name: 'Sari Dewi', placed: false, answer: 'pending', readerCoaches: false },
                { membershipId: 'mem-rina', name: 'Rina Wijaya', placed: false, answer: 'declined', readerCoaches: false },
                { membershipId: 'mem-arief', name: 'Arief Nugroho', placed: true, readerCoaches: false },
              ],
            })],
          }),
        },
      });
      await grid();
      await userEvent.click(standup());
      const dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
      for (const name of ['Accepted', 'No answer yet', 'Declined']) {
        expect(within(dialog).getByRole('button', { name })).toBeInTheDocument();
      }
      expect(within(dialog).getByText('Arief Nugroho').closest('li')).toHaveTextContent('Arief Nugroho, time placed by the organiser');
      expect(within(dialog).getByText('Arief Nugroho').closest('li')!.querySelector('button')).toBeNull();
    });
  });

  it('P12-T4 AC-7 opens a notice’s entry on its week, with its detail', async () => {
    const stub = show({
      'GET /calendar/entries/e-9': { body: entry({ entryId: 'e-9', title: 'Goal review — Q4 planning', date: '2026-09-30' }) },
    }, AGUS, { entry: 'e-9', date: '2026-09-29' });
    expect(await screen.findByRole('dialog', { name: 'Goal review — Q4 planning' })).toBeInTheDocument();
    await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-09-30`)).toHaveLength(1));
  });

  it('P12-T4 AC-7 opens the notice’s week, and says the entry is gone, when it no longer reads', async () => {
    const stub = show({ 'GET /calendar/entries/e-9': refusal(404, 'NOT_FOUND') }, AGUS, { entry: 'e-9', date: '2026-10-02' });
    expect(await screen.findByText('This entry isn\'t on your calendar any more.')).toBeInTheDocument();
    await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-10-02`)).toHaveLength(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the notice’s week, and shows the refusal, when the entry’s read fails another way', async () => {
    show({ 'GET /calendar/entries/e-9': refusal(500, 'INTERNAL_ERROR') }, AGUS, { entry: 'e-9', date: 'not-a-date' });
    expect(await screen.findByText('Refused: INTERNAL_ERROR')).toBeInTheDocument();
    await grid();
  });
});

const PEOPLE_FIRST = peoplePage().items.slice(0, 2);
const PEOPLE_OTHER = peoplePage().items[3];
const PEOPLE_LEAD = peoplePage().items[4];

describe('P12-T5 — compare and Block time', () => {
  const COMPARED = `${WEEK_READ}&date=2026-09-28&for=`;
  const indahWeek = weekRead({
    subject: { membershipId: 'mem-indah', name: 'Indah Permata', rung: { code: 'AGENT', label: 'Agent' } },
    entries: [
      entry({ entryId: 'i-1', type: 'task', title: 'Prospecting', organiser: { membershipId: 'mem-indah', name: 'Indah Permata' }, readerIs: 'ancestor', date: '2026-09-29' }),
      busy(),
      busy({ allDay: true, date: null, start: null, end: null, startsOn: '2026-10-02', endsOn: '2026-10-02' }),
    ],
  });
  const showCompare = (routes: Record<string, StubReply | StubReply[]> = {}, me = AGUS) => show({
    '/calendar/downline': { body: DOWNLINE },
    [`${COMPARED}mem-indah`]: { body: indahWeek },
    [`${COMPARED}mem-sari`]: { body: weekRead({ subject: { membershipId: 'mem-sari', name: 'Sari Dewi', rung: { code: 'AAB', label: 'Associate Agency Builder' } }, entries: [] }) },
    [`${COMPARED}mem-rina`]: { body: weekRead({ entries: [] }) },
    ...routes,
  }, me);

  const openPopover = async () => {
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
    return screen.getByPlaceholderText('Search your downline…');
  };

  it('P12-T5 AC-1 draws the bar verbatim, and no compare for somebody who leads nobody', async () => {
    showCompare();
    await grid();
    expect(screen.getByText('Viewing:')).toBeInTheDocument();
    expect(screen.getByText('My Calendar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Compare with downline' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('P12-T5 AC-1 keeps *Viewing:* and *My Calendar* for an Agent, with nothing to add', async () => {
    show({ [WEEK_READ]: { body: weekRead() } }, RINA);
    await grid();
    expect(screen.getByText('My Calendar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Compare with downline' })).not.toBeInTheDocument();
  });

  it('P12-T5 AC-2 lists everyone the reader coaches, an AAB’s agents after their AAB, and filters by name', async () => {
    showCompare();
    const search = await openPopover();
    expect(search).toHaveFocus();
    await screen.findByText('Direct unit');
    expect(screen.getByText('AAB & their teams (group)')).toBeInTheDocument();
    const rows = screen.getAllByRole('button', { name: /Permata|Dewi|Wijaya/ }).map((b) => b.textContent);
    expect(rows).toEqual(['IPIndah PermataAgent', 'SDSari DewiAAB', 'RWRina WijayaAgent · under Sari Dewi']);
    await userEvent.type(search, 'zz');
    expect(screen.getByText('No matches.')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'RIN');
    expect(screen.getByRole('button', { name: /Rina Wijaya/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Indah Permata/ })).not.toBeInTheDocument();
  });

  it('P12-T5 AC-2 marks somebody added, stays open after a pick, and at two disables everybody', async () => {
    showCompare();
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    const added = screen.getByRole('button', { name: /^Indah Permata/ });
    expect(added).toBeDisabled();
    expect(added).toHaveTextContent('Agent · added ✓');
    await userEvent.click(screen.getByRole('button', { name: /^Sari Dewi/ }));
    expect(screen.getByText('You\'re comparing 2 people already — remove one below to add another.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rina Wijaya/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Indah Permata' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Sari Dewi' })).toBeInTheDocument();
  });

  it('P12-T5 AC-2 closes on Escape, giving the focus back, and on a press outside it', async () => {
    showCompare();
    await openPopover();
    await screen.findByText('Direct unit');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Search your downline…')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Compare with downline' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
    await screen.findByText('Direct unit');
    await userEvent.click(screen.getByText('Viewing:'));
    expect(screen.queryByPlaceholderText('Search your downline…')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
    expect(screen.queryByPlaceholderText('Search your downline…')).not.toBeInTheDocument();
  });

  it('says when the list could not be loaded, and tries again', async () => {
    showCompare({ '/calendar/downline': [refusal(500, 'INTERNAL_ERROR'), { body: DOWNLINE }] });
    await openPopover();
    expect(await screen.findByText('The list couldn\'t be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Direct unit')).toBeInTheDocument();
  });

  it('P12-T5 AC-3, AC-4 draws the member’s week beside the reader’s: their entries, busy blocks, hours when stacked', async () => {
    const stub = showCompare();
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    const theirs = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
    expect(calls(stub, `${COMPARED}mem-indah`)).toHaveLength(1);
    const pane = theirs.closest('section')!;
    expect(within(pane).getByText('Agent')).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: 'Task: Prospecting, 09.00–09.30' })).toBeInTheDocument();
    const busyBlock = within(theirs).getByText('Busy').parentElement!;
    expect(busyBlock.tagName).toBe('DIV');
    expect(busyBlock).toHaveTextContent('Busy, 13.00–14.00');
    expect(within(pane).getAllByText('Busy')).toHaveLength(2);
    // Every stacked pane draws its own hours (contradiction 8): the gutter shows below 980px.
    expect(within(theirs).getByText('07.00').parentElement!.className).toContain('max-[979.98px]:block');
    expect(theirs.scrollTop).toBe(7 * HOUR_PX);
  });

  it('P12-T5 AC-4 opens a downline’s entry with Close alone', async () => {
    showCompare();
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Task: Prospecting, 09.00–09.30' }));
    const dialog = screen.getByRole('dialog', { name: 'Prospecting' });
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['★Organiser', 'Close']);
  });

  it('P12-T5 AC-3 moves every pane together, and back to 07.00 when somebody is removed', async () => {
    showCompare();
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    const theirs = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
    const mine = await grid();
    mine.scrollTop = 800;
    fireEvent.scroll(mine);
    expect(theirs.scrollTop).toBe(800);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Remove Indah Permata' }));
    expect(mine.scrollTop).toBe(7 * HOUR_PX);
    expect(screen.queryByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` })).not.toBeInTheDocument();
  });

  it('P12-T5 AC-5 takes somebody the read now refuses out of the bar, and says so', async () => {
    showCompare({ [`${COMPARED}mem-indah`]: refusal(404, 'NOT_FOUND') });
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    expect(await screen.findAllByText('You can no longer view Indah Permata\'s calendar.')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Remove Indah Permata' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('You can no longer view Indah Permata\'s calendar.')).not.toBeInTheDocument();
  });

  it('shows a compared pane’s failure in its own frame, with a way to try again', async () => {
    showCompare({ [`${COMPARED}mem-indah`]: [refusal(500, 'INTERNAL_ERROR'), { body: indahWeek }] });
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    expect(await screen.findByText('The calendar couldn\'t be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` })).toBeInTheDocument();
  });

  /*
   * Every read of a compared pane writes an audit entry on the server, so a pane is read when what it
   * shows changes — its week, its person, or a write of the reader's that touched them — and never
   * because the reader's own calendar read again.
   */
  describe('D-audit: a compared pane reads again only when what it shows changes', () => {
    const NEXT = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    const nextWeek = (over: Partial<CalendarRead> = {}) => weekRead({
      from: NEXT[0], to: NEXT[6], days: NEXT.map((date) => ({ date, inPeriod: true })),
      previous: '2026-09-28', next: '2026-10-12', entries: [], ...over,
    });
    const SARI = { membershipId: 'mem-sari', name: 'Sari Dewi', rung: { code: 'AAB', label: 'Associate Agency Builder' } };
    const INDAH = { membershipId: 'mem-indah', name: 'Indah Permata', rung: { code: 'AGENT', label: 'Agent' } };
    const reads = (stub: ReturnType<typeof stubFetch>, who: string, date = '2026-09-28') =>
      stub.calls.filter((c) => c.url.endsWith(`view=week&date=${date}&for=${who}`));
    const own = (stub: ReturnType<typeof stubFetch>, date: string) =>
      stub.calls.filter((c) => c.url.endsWith(`view=week&date=${date}`));
    const invitee = (membershipId: string, name: string) => ({ membershipId, name, placed: false, answer: 'pending' as const, readerCoaches: false });

    /** Indah and Sari side by side with the reader, each read once. */
    const compareBoth = async (stub: ReturnType<typeof stubFetch>) => {
      await openPopover();
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await userEvent.click(screen.getByRole('button', { name: /^Sari Dewi/ }));
      await userEvent.keyboard('{Escape}');
      await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
      await screen.findByRole('region', { name: `Calendar, Sari Dewi, ${RANGE}` });
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);
    };

    it('reads no compared pane again when the reader saves their own entry, or answers one', async () => {
      const invited = entry({
        entryId: 'e-invited', title: 'Agency kickoff', readerIs: 'invitee', myAnswer: 'pending', date: '2026-10-01',
        organiser: { membershipId: 'mem-hendra', name: 'Hendra Kusnadi' },
        invitees: [{ membershipId: 'mem-agus', name: 'Agus Santoso', placed: false, readerCoaches: false }],
      });
      const mine = entry({ entryId: 'e-new', title: 'Call list', date: '2026-09-30', start: '10:00', end: '10:30' });
      const stub = showCompare({
        [WEEK_READ]: { body: weekRead({ entries: [invited] }) },
        [`${WEEK_READ}&date=2026-09-30`]: { body: weekRead({ entries: [invited, mine] }) },
        'POST /calendar/entries': { status: 201, body: mine },
        'POST /calendar/entries/e-invited/answer': { body: { ...invited, myAnswer: 'accepted' } },
      });
      await compareBoth(stub);

      await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
      await userEvent.type(screen.getByLabelText('Title'), 'Call list');
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-30' } });
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      // The reader's own week has read again and drawn the entry: their calendar alone.
      expect(await within(await grid()).findByRole('button', { name: /^Internal meeting: Call list/ })).toBeInTheDocument();
      expect(own(stub, '2026-09-30')).toHaveLength(1);
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);

      await userEvent.click(within(await grid()).getByRole('button', { name: /^Internal meeting: Agency kickoff/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
      await waitFor(() => expect(own(stub, '2026-09-30')).toHaveLength(2));
      await act(async () => {});
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);
    });

    it('‹ and › read each compared pane once, for the week the server named', async () => {
      const stub = showCompare({
        [`${WEEK_READ}&date=2026-10-05`]: { body: nextWeek() },
        [`${WEEK_READ}&date=2026-10-05&for=mem-indah`]: { body: nextWeek({ subject: INDAH }) },
        [`${WEEK_READ}&date=2026-10-05&for=mem-sari`]: { body: nextWeek({ subject: SARI }) },
      });
      await compareBoth(stub);

      await userEvent.click(screen.getByRole('button', { name: 'Next week' }));
      await screen.findByRole('region', { name: 'Calendar, Indah Permata, 5 Okt – 11 Okt 2026' });
      await screen.findByRole('region', { name: 'Calendar, Sari Dewi, 5 Okt – 11 Okt 2026' });
      await act(async () => {});
      expect(reads(stub, 'mem-indah', '2026-10-05')).toHaveLength(1);
      expect(reads(stub, 'mem-sari', '2026-10-05')).toHaveLength(1);
      // Not the week left behind, read again on the way out.
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Previous week' }));
      await waitFor(() => expect(reads(stub, 'mem-indah')).toHaveLength(2));
      await waitFor(() => expect(reads(stub, 'mem-sari')).toHaveLength(2));
      await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
      await act(async () => {});
      expect(reads(stub, 'mem-indah')).toHaveLength(2);
      expect(reads(stub, 'mem-sari')).toHaveLength(2);
      expect(reads(stub, 'mem-indah', '2026-10-05')).toHaveLength(1);
    });

    it('reads again, once, the pane of the member a block is placed on, and nobody else’s', async () => {
      const blocked = entry({
        entryId: 'e-block', type: 'coaching', title: '1:1 with Indah Permata', start: '10:00', end: '10:30',
        invitees: [{ membershipId: 'mem-indah', name: 'Indah Permata', placed: true, readerCoaches: true }],
      });
      const stub = showCompare({ 'POST /calendar/blocks': { status: 201, body: blocked } });
      await compareBoth(stub);

      await userEvent.click(screen.getByRole('button', { name: PILL_INDAH }));
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      await waitFor(() => expect(reads(stub, 'mem-indah')).toHaveLength(2));
      await waitFor(() => expect(own(stub, '2026-09-28')).toHaveLength(1));
      await act(async () => {});
      expect(reads(stub, 'mem-indah')).toHaveLength(2);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);
    });

    it('reads again the pane of somebody an edit takes off an entry, and of somebody on an entry deleted', async () => {
      const review = entry({ entryId: 'e-review', title: 'Unit review', invitees: [invitee('mem-sari', 'Sari Dewi')] });
      const visit = entry({
        entryId: 'e-visit', type: 'client', title: 'Field visit', date: '2026-09-29', start: '13:00', end: '14:00',
        invitees: [invitee('mem-indah', 'Indah Permata')],
      });
      const stub = showCompare({
        [WEEK_READ]: { body: weekRead({ entries: [review, visit] }) },
        'PATCH /calendar/entries/e-review': { body: { ...review, version: 2, invitees: [] } },
        'DELETE /calendar/entries/e-visit': { body: { entryId: 'e-visit', deletedAt: '2026-09-28T03:00:00.000Z' } },
      });
      await compareBoth(stub);

      await userEvent.click(within(await grid()).getByRole('button', { name: /^Internal meeting: Unit review/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit event' });
      await userEvent.click(within(dialog).getByRole('button', { name: 'Remove Sari Dewi' }));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save event' }));
      // Sari is no longer on it, so it left her calendar: her pane reads again. Indah's does not.
      await waitFor(() => expect(reads(stub, 'mem-sari')).toHaveLength(2));
      await act(async () => {});
      expect(reads(stub, 'mem-indah')).toHaveLength(1);

      await userEvent.click(within(await grid()).getByRole('button', { name: /^Client meeting: Field visit/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Field visit"?' })).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(reads(stub, 'mem-indah')).toHaveLength(2));
      await act(async () => {});
      expect(reads(stub, 'mem-sari')).toHaveLength(2);
    });

    it('reads a touched pane once, for the week the grid lands on, when the write also moves the grid', async () => {
      const review = entry({ entryId: 'e-review', title: 'Unit review', invitees: [invitee('mem-sari', 'Sari Dewi')] });
      const moved = { ...review, version: 2, date: '2026-10-06' };
      const stub = showCompare({
        [WEEK_READ]: { body: weekRead({ entries: [review] }) },
        'PATCH /calendar/entries/e-review': { body: moved },
        [`${WEEK_READ}&date=2026-10-06`]: { body: nextWeek({ entries: [moved] }) },
        [`${WEEK_READ}&date=2026-10-05&for=mem-indah`]: { body: nextWeek({ subject: INDAH }) },
        [`${WEEK_READ}&date=2026-10-05&for=mem-sari`]: { body: nextWeek({ subject: SARI }) },
      });
      await compareBoth(stub);

      await userEvent.click(within(await grid()).getByRole('button', { name: /^Internal meeting: Unit review/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-06' } });
      await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
      await screen.findByRole('region', { name: 'Calendar, Sari Dewi, 5 Okt – 11 Okt 2026' });
      await screen.findByRole('region', { name: 'Calendar, Indah Permata, 5 Okt – 11 Okt 2026' });
      await act(async () => {});
      // Sari's week is read once, where the grid went; the week it left is not read on the way out.
      expect(reads(stub, 'mem-sari', '2026-10-05')).toHaveLength(1);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);
      expect(reads(stub, 'mem-indah', '2026-10-05')).toHaveLength(1);
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
    });

    it('draws the pane again from its last read, back from Month, and reads afresh somebody compared again', async () => {
      const stub = showCompare({ [MONTH_READ]: { body: monthRead() } });
      await compareBoth(stub);

      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await screen.findByText('Sep 2026');
      // P18.95-T8 AC-2: Month compares too, so each person's month is read — once — for the month shown.
      await waitFor(() => expect(stub.calls.filter((c) => c.url.endsWith('view=month&date=2026-09-01&for=mem-indah'))).toHaveLength(1));
      await userEvent.click(screen.getByRole('button', { name: 'Week' }));
      expect(await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` })).toBeInTheDocument();
      await act(async () => {});
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
      expect(reads(stub, 'mem-sari')).toHaveLength(1);
      expect(stub.calls.filter((c) => c.url.endsWith('view=month&date=2026-09-01&for=mem-sari'))).toHaveLength(1);

      await userEvent.click(screen.getByRole('button', { name: 'Remove Indah Permata' }));
      await openPopover();
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await waitFor(() => expect(reads(stub, 'mem-indah')).toHaveLength(2));
      expect(reads(stub, 'mem-sari')).toHaveLength(1);
    });

    it('moves a compared pane’s today on at midnight from the reader’s read, without reading it again', async () => {
      // `clearInterval` too, so each query's polling stops with it rather than ticking through the minute.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      const stub = showCompare({
        [WEEK_READ]: [
          { body: weekRead({ now: { at: '2026-09-28T16:59:00.000Z', minute: 1439 } }) },
          { body: weekRead({ today: '2026-09-29', now: { at: '2026-09-28T17:00:00.000Z', minute: 0 } }) },
        ],
      });
      await openPopover();
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await userEvent.keyboard('{Escape}');
      const theirs = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
      const nowIn = (name: string) => within(theirs).getByRole('group', { name }).querySelector('[data-now]');
      expect(nowIn('Senin, 28 Sep 2026')).not.toBeNull();

      await act(async () => { vi.advanceTimersByTime(60_000); });
      await waitFor(() => expect(calls(stub, WEEK_READ).filter((c) => !c.url.includes('for='))).toHaveLength(2));
      await waitFor(() => expect(nowIn('Selasa, 29 Sep 2026')).not.toBeNull());
      expect(nowIn('Senin, 28 Sep 2026')).toBeNull();
      expect(reads(stub, 'mem-indah')).toHaveLength(1);
    });
  });

  describe('P12-T5 AC-6 Block time (ADR-0098, D-block-key)', () => {
    const blocked = entry({
      entryId: 'e-block', type: 'coaching', title: '1:1 with Indah Permata', start: '10:00', end: '10:30',
      invitees: [{ membershipId: 'mem-indah', name: 'Indah Permata', placed: true, readerCoaches: true }],
    });

    it('opens from the pill as a button, at the next half hour of today, preset and placed', async () => {
      const stub = showCompare({ 'POST /calendar/blocks': { status: 201, body: blocked } });
      await openPopover();
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await userEvent.keyboard('{Escape}');
      const pill = await screen.findByRole('button', { name: PILL_INDAH });
      expect(pill).toHaveTextContent('Drag to block');
      await userEvent.click(pill);
      const dialog = screen.getByRole('dialog', { name: 'Block time — Indah Permata' });
      expect(dialog).toHaveAccessibleDescription('This goes straight onto their calendar — no approval needed, they\'ll just see it appear.');
      expect(within(dialog).getByText('Indah Permata', { selector: 'strong' }).parentElement).toHaveTextContent('Inviting Indah Permata to this slot');
      expect(dialog).not.toHaveTextContent(/request to accept/);
      expect(within(dialog).getByLabelText('Title')).toHaveValue('1:1 with Indah Permata');
      expect(within(dialog).getByRole('button', { name: '1:1 coaching' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-28');
      expect(within(dialog).getByLabelText('Start')).toHaveValue('10:00');
      expect(within(dialog).getByLabelText('End')).toHaveValue('10:30');
      expect(within(dialog).queryByRole('button', { name: 'Remove Indah Permata' })).not.toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save event' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(bodyOf(calls(stub, '/calendar/blocks', 'POST')[0])).toEqual({
        membershipId: 'mem-indah', type: 'coaching', title: '1:1 with Indah Permata', notes: '',
        date: '2026-09-28', start: '10:00', end: '10:30', inviteeIds: [],
      });
    });

    it('opens from a tap on the member’s pane', async () => {
      showCompare();
      await openPopover();
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await userEvent.keyboard('{Escape}');
      const theirs = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
      tap(within(theirs).getByRole('group', { name: 'Jumat, 2 Okt 2026' }), 15 * 60);
      expect(screen.getByRole('dialog', { name: 'Block time — Indah Permata' })).toBeInTheDocument();
      expect(screen.getByLabelText('Date')).toHaveValue('2026-10-02');
      expect(screen.getByLabelText('Start')).toHaveValue('15:00');
    });

    it('lets the member read it with Close alone, and names the block as placed on their grid', async () => {
      show({
        [WEEK_READ]: {
          body: weekRead({
            entries: [{ ...blocked, readerIs: 'placed', organiser: { membershipId: 'mem-agus', name: 'Agus Santoso' } }],
          }),
        },
      }, RINA);
      await grid();
      const block = screen.getByRole('button', { name: '1:1 coaching: 1:1 with Indah Permata, 10.00–10.30, placed on your calendar' });
      await userEvent.click(block);
      const dialog = screen.getByRole('dialog', { name: '1:1 with Indah Permata' });
      expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['★Organiser', 'Close']);
    });

    it('lets the leader edit their own block, the member kept on it', async () => {
      const stub = show({
        [WEEK_READ]: { body: weekRead({ entries: [blocked] }) },
        'PATCH /calendar/entries/e-block': { body: blocked },
      });
      await grid();
      await userEvent.click(screen.getByRole('button', { name: /^1:1 coaching: 1:1 with Indah Permata/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit event' });
      expect(within(dialog).getByText('Indah Permata').closest('li')!.querySelector('button')).toBeNull();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save event' }));
      await waitFor(() => expect(calls(stub, '/calendar/entries/e-block', 'PATCH')).toHaveLength(1));
      expect(bodyOf(calls(stub, '/calendar/entries/e-block', 'PATCH')[0]).inviteeIds).toEqual([]);
    });
  });

  const compareIndah = async () => {
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    await userEvent.keyboard('{Escape}');
    return screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
  };

  it('M2 names the pill by the words drawn on it, then what it opens, with no aria-label (WCAG 2.5.3)', async () => {
    showCompare();
    await compareIndah();
    const pill = await screen.findByRole('button', { name: PILL_INDAH });
    expect(pill).not.toHaveAttribute('aria-label');
    expect(pill).toHaveTextContent('Drag to block: Block time — Indah Permata');
    const drawn = [...pill.childNodes]
      .filter((node) => !(node instanceof HTMLElement && node.classList.contains('sr-only')))
      .map((node) => node.textContent)
      .join('');
    expect(drawn).toBe('Drag to block');
    expect(pill.querySelector('.sr-only')!.textContent).toBe(': Block time — Indah Permata');
  });

  it('F2 keeps the focus in the popover after a pick, so Escape still closes it; ✕ hands it to the compare button', async () => {
    showCompare();
    await openPopover();
    const indah = await screen.findByRole('button', { name: /^Indah Permata/ });
    await userEvent.click(indah);
    expect(indah).toBeDisabled();
    // The next row that can still be picked.
    expect(screen.getByRole('button', { name: /^Sari Dewi/ })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    // At two, every row is disabled: the search.
    expect(screen.getByRole('button', { name: /^Rina Wijaya/ })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search your downline…')).toHaveFocus();

    // A browser drops the focus of a button that turns disabled to the page: Escape is heard there too.
    act(() => (document.activeElement as HTMLElement).blur());
    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Search your downline…')).not.toBeInTheDocument();
    const compare = screen.getByRole('button', { name: '+ Compare with downline' });
    expect(compare).toHaveFocus();

    // Escape with the focus elsewhere on the page closes it, and leaves the focus where it is.
    await userEvent.click(compare);
    await screen.findByText('Direct unit');
    const today = screen.getByRole('button', { name: 'Today' });
    act(() => today.focus());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByPlaceholderText('Search your downline…')).not.toBeInTheDocument();
    expect(today).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Indah Permata' }));
    expect(screen.queryByRole('button', { name: 'Remove Indah Permata' })).not.toBeInTheDocument();
    expect(compare).toHaveFocus();
  });

  it('F3 opens nothing from a busy block on a compared pane: it takes no slot', async () => {
    showCompare();
    const theirs = await compareIndah();
    const block = within(theirs).getByText('Busy').parentElement!;
    expect(block).toHaveAttribute('data-busy');
    const clientY = (13.5 * 60 / 60) * HOUR_PX;
    fireEvent.pointerDown(block, { clientY, pointerId: 1, pointerType: 'mouse', button: 0 });
    expect(document.querySelector('[data-selection]')).toBeNull();
    fireEvent.pointerUp(block, { clientY, pointerId: 1, pointerType: 'mouse', button: 0 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // A free slot on the same pane still opens *Block time*.
    tap(within(theirs).getByRole('group', { name: 'Rabu, 30 Sep 2026' }), 9 * 60);
    expect(screen.getByRole('dialog', { name: 'Block time — Indah Permata' })).toBeInTheDocument();
  });

  describe('D-write: a read-only support session draws no write', () => {
    const support = makeMe({ ...AGUS, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-admin' });
    const invited = entry({
      entryId: 'e-invited', title: 'Agency kickoff', readerIs: 'invitee', myAnswer: 'pending', date: '2026-10-01',
      organiser: { membershipId: 'mem-hendra', name: 'Hendra Kusnadi' },
      invitees: [{ membershipId: 'mem-agus', name: 'Agus Santoso', placed: false, readerCoaches: false }],
    });
    const buttonsIn = (name: string) => within(screen.getByRole('dialog', { name })).getAllByRole('button').map((b) => b.textContent);

    /** No *+ New event*, no slot, *Close* alone in the detail, and no *Block time* on a compared pane. */
    const expectNoWrite = async (stub: ReturnType<typeof stubFetch>) => {
      const region = await grid();
      expect(screen.queryByRole('button', { name: '+ New event' })).not.toBeInTheDocument();
      tap(within(region).getByRole('group', { name: 'Selasa, 29 Sep 2026' }), 15 * 60);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await userEvent.click(standup());
      expect(buttonsIn('Weekly unit standup')).toEqual(['Close']);
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Agency kickoff/ }));
      expect(buttonsIn('Agency kickoff')).toEqual(['★Organiser', 'Close']);
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));

      const theirs = await compareIndah();
      expect(screen.queryByRole('button', { name: PILL_INDAH })).not.toBeInTheDocument();
      tap(within(theirs).getByRole('group', { name: 'Jumat, 2 Okt 2026' }), 15 * 60);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(stub.calls.filter((c) => (c.init.method ?? 'GET') !== 'GET')).toEqual([]);
    };

    it('hides create, edit, delete, answer and block in a read-only session, whatever permissions it lists', async () => {
      const stub = showCompare({ [WEEK_READ]: { body: weekRead({ entries: [entry(), invited] }) } }, support);
      await expectNoWrite(stub);
    });

    it('hides them as well for a reader whose permissions the server served without the writes', async () => {
      const readsOnly = makeMe({ ...AGUS, permissions: ['calendar_entry:read', 'calendar_invitee:search'] });
      const stub = showCompare({ [WEEK_READ]: { body: weekRead({ entries: [entry(), invited] }) } }, readsOnly);
      await expectNoWrite(stub);
    });

    it('keeps every write for a support session that may write', async () => {
      showCompare({}, makeMe({ ...AGUS, isImpersonating: true, impersonationReadOnly: false, impersonatedBy: 'u-admin' }));
      await grid();
      expect(screen.getByRole('button', { name: '+ New event' })).toBeInTheDocument();
      await userEvent.click(standup());
      expect(buttonsIn('Weekly unit standup')).toEqual(['Delete', 'Close', 'Edit']);
    });
  });

  it('offers no pill and takes no slot on a compared pane for a reader who may not block', async () => {
    const noBlock = makeMe({ ...AGUS, permissions: AGUS.permissions.filter((p) => p !== 'calendar_entry:block') });
    showCompare({}, noBlock);
    await openPopover();
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
    expect(screen.queryByRole('button', { name: PILL_INDAH })).not.toBeInTheDocument();
  });
});

describe('P12-T6 — 1:1 coaching entries (ADR-0099)', () => {
  const oneToOne = (readerCoaches: boolean, over: Partial<CalendarEntry> = {}) => entry({
    type: 'coaching',
    title: '1:1 Coaching — Indah Permata',
    invitees: [
      { membershipId: 'mem-indah', name: 'Indah Permata', placed: false, answer: 'accepted', readerCoaches },
      { membershipId: 'mem-arief', name: 'Arief Nugroho', placed: false, answer: 'pending', readerCoaches: false },
    ],
    ...over,
  });

  it('P12-T6 AC-1 links the chip of each invitee the reader coaches to their Coaching Session tab', async () => {
    show({ [WEEK_READ]: { body: weekRead({ entries: [oneToOne(true)] }) } });
    await grid();
    await userEvent.click(screen.getByRole('button', { name: /^1:1 coaching: 1:1 Coaching — Indah Permata/ }));
    const dialog = screen.getByRole('dialog', { name: '1:1 Coaching — Indah Permata' });
    expect(within(dialog).getByRole('link', { name: 'Indah Permata' })).toHaveAttribute('href', '/coaching/mem-indah/session');
    expect(within(dialog).queryByRole('link', { name: 'Arief Nugroho' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Accepted' })).toBeInTheDocument();
  });

  it('P12-T6 AC-1 links nowhere for the coachee, nor on an entry of any other type', async () => {
    show({
      [WEEK_READ]: {
        body: weekRead({
          entries: [
            oneToOne(false, { readerIs: 'invitee', myAnswer: 'accepted', organiser: { membershipId: 'mem-sari', name: 'Sari Dewi' } }),
            entry({ entryId: 'e-meet', title: 'Goal review', start: '13:00', end: '14:00', invitees: [{ membershipId: 'mem-indah', name: 'Indah Permata', placed: false, answer: 'accepted', readerCoaches: true }] }),
          ],
        }),
      },
    }, RINA);
    await grid();
    await userEvent.click(screen.getByRole('button', { name: /^1:1 coaching: 1:1 Coaching — Indah Permata/ }));
    // The notes' Zoom address is a link of its own (P18.95-T8 AC-2); no chip is.
    expect(within(screen.getByRole('dialog')).getAllByRole('link').map((a) => a.textContent)).toEqual(['Join Zoom, opens in a new tab']);
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Goal review/ }));
    expect(within(screen.getByRole('dialog')).getAllByRole('link').map((a) => a.textContent)).toEqual(['Join Zoom, opens in a new tab']);
  });

  it('P12-T6 AC-4 lets any field role make a 1:1 entry', async () => {
    const stub = show({ 'POST /calendar/entries': { status: 201, body: oneToOne(false) } }, RINA);
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ New event' }));
    await userEvent.click(screen.getByRole('button', { name: '1:1 coaching' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(calls(stub, '/calendar/entries', 'POST')).toHaveLength(1));
    expect(bodyOf(calls(stub, '/calendar/entries', 'POST')[0]).type).toBe('coaching');
  });

  it('P12-T6 AC-7 writes none of the six words, and no phase, on the page and in its dialogs', async () => {
    show({ [WEEK_READ]: { body: weekRead({ entries: [oneToOne(true)] }) } });
    await grid();
    const own = (text: string) => text
      // The prototype's own strings keep *KPM* (ADR-0096); everything else is the calendar's.
      .replaceAll('anyone in your KPM', '').replaceAll('Search your KPM by name…', '');
    expect(own(document.body.textContent ?? '')).not.toMatch(/\boffice\b|\bKPM\b|reports to|tagged to|untagged|unassigned|\bphase\b/i);
    await userEvent.click(screen.getByRole('button', { name: /^1:1 coaching:/ }));
    expect(own(document.body.textContent ?? '')).not.toMatch(/\boffice\b|\bKPM\b|\bphase\b/i);
  });
});

describe('P13.1-T8 — an entry’s words, and Hide my personal activities (ADR-0110)', () => {
  const HIDE = 'Hide my personal activities';
  const TIP = 'Leaders who view your calendar see only "Busy" and the time. People you invite still see the details.';
  const LONG = 'Quarterly review with the Hartono family on their two children’s education plans';

  it('P13.1-T8 AC-1 lays an entry’s words out from its top, the title on one line cut with an ellipsis, whole in its name and tooltip', async () => {
    show({ [WEEK_READ]: { body: weekRead({ entries: [entry({ title: LONG, start: '09:00', end: '10:00' })] }) } });
    await grid();
    const block = screen.getByRole('button', { name: `Internal meeting: ${LONG}, 09.00–10.00` });
    // A button centres what it holds; this one is a column from its top edge, as the prototype's `.event`.
    expect(block.className.split(' ')).toEqual(expect.arrayContaining(['flex', 'flex-col', 'justify-start']));
    const title = within(block).getByText(LONG);
    expect(title.className.split(' ')).toEqual(expect.arrayContaining(['truncate', 'shrink-0']));
    expect(title).toHaveAttribute('title', `${LONG}, 09.00–10.00`);
    expect(within(block).getByText('09.00–10.00')).toBeInTheDocument();
  });

  it('P13.1-T8 AC-1 draws the time only where the title and the time both fit whole: not on a half hour, on 45 minutes', async () => {
    show({
      [WEEK_READ]: {
        body: weekRead({
          entries: [
            entry(),
            entry({ entryId: 'e-quick', type: 'task', title: 'Quick call', date: '2026-09-29', start: '08:00', end: '08:15' }),
            entry({ entryId: 'e-call', type: 'client', title: 'Client call', date: '2026-09-29', start: '11:00', end: '11:45' }),
          ],
        }),
      },
    });
    await grid();
    for (const [name, title] of [
      ['Internal meeting: Weekly unit standup, 09.00–09.30', 'Weekly unit standup'],
      ['Task: Quick call, 08.00–08.15', 'Quick call'],
    ]) {
      const block = screen.getByRole('button', { name });
      expect([name, block.textContent]).toEqual([name, title]);
      // What is not drawn is still said, and still shown to a pointer.
      expect(within(block).getByText(title)).toHaveAttribute('title', `${title}, ${name.split(', ').pop()}`);
    }
    expect(screen.getByRole('button', { name: 'Client meeting: Client call, 11.00–11.45' })).toHaveTextContent('Client call11.00–11.45');
  });

  it('P13.1-T8 AC-1 a short busy block on a compared pane reads Busy, its time said and not drawn', async () => {
    const COMPARED = `${WEEK_READ}&date=2026-09-28&for=`;
    show({
      '/calendar/downline': { body: DOWNLINE },
      [`${COMPARED}mem-indah`]: {
        body: weekRead({
          subject: { membershipId: 'mem-indah', name: 'Indah Permata', rung: { code: 'AGENT', label: 'Agent' } },
          entries: [busy({ start: '13:00', end: '13:30' }), busy({ date: '2026-10-01', start: '09:00', end: '10:00' })],
        }),
      },
    });
    await grid();
    await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
    await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
    const theirs = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
    const [short, long] = within(theirs).getAllByText('Busy').map((b) => b.parentElement!);
    expect(short).toHaveTextContent('Busy, 13.00–13.30');
    expect(within(short).getByText('13.00–13.30')).toHaveClass('sr-only');
    expect(within(short).getByText('Busy')).toHaveAttribute('title', 'Busy, 13.00–13.30');
    expect(within(long).getByText('09.00–10.00')).not.toHaveClass('sr-only');
  });

  it('P13.1-T8 AC-2 draws the switch in the toolbar, as read, with what it does as its description and in its ⓘ', async () => {
    show();
    const toggle = await screen.findByRole('switch', { name: HIDE });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription(TIP);
    expect(screen.getByRole('button', { name: TIP })).toHaveTextContent('ⓘ');
    // In the toolbar's right-hand group, before *Week* and *Month*.
    const group = screen.getByRole('group', { name: 'View' }).parentElement!;
    expect(group).toContainElement(toggle);
  });

  it('P18.95-T7 AC-1 says what it does in its ⓘ alone, at every size — the client’s ⓘ, which it already was (grey text row 14)', async () => {
    show();
    await screen.findByRole('switch', { name: HIDE });
    // Never a sentence on the page: the bubble, hidden until asked for, and the switch's description, which is not drawn.
    for (const el of screen.getAllByText(TIP, { ignore: false })) {
      expect(el.getAttribute('role') === 'tooltip' || el.classList.contains('sr-only')).toBe(true);
    }
    expect(screen.getByRole('button', { name: TIP }).parentElement!.className).not.toMatch(/hidden/);
  });

  it('P13.1-T8 AC-2 reads it on for a member who turned it on, an Agent included', async () => {
    show({ [SETTINGS]: { body: { hideDetails: true } } }, RINA);
    expect(await screen.findByRole('switch', { name: HIDE })).toBeChecked();
  });

  it('P13.1-T8 AC-2 switches at once and saves the whole setting', async () => {
    const stub = show({ [`PUT ${SETTINGS}`]: { body: { hideDetails: true } } });
    const toggle = await screen.findByRole('switch', { name: HIDE });
    fireEvent.click(toggle);
    // On before the server has answered.
    expect(toggle).toBeChecked();
    await waitFor(() => expect(calls(stub, SETTINGS, 'PUT')).toHaveLength(1));
    expect(bodyOf(calls(stub, SETTINGS, 'PUT')[0])).toEqual({ hideDetails: true });
    expect(toggle).toBeChecked();
    expect(screen.queryByText(/couldn't be saved/)).not.toBeInTheDocument();
  });

  it('P13.1-T8 AC-2 puts it back when the save is refused, and says so with the code and the request id', async () => {
    show({ [`PUT ${SETTINGS}`]: refusal(500, 'INTERNAL_ERROR') });
    const toggle = await screen.findByRole('switch', { name: HIDE });
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
    await waitFor(() => expect(toggle).not.toBeChecked());
    const banner = screen.getByText('Your setting couldn\'t be saved, so it has been put back.').closest('[role="alert"]')!;
    expect(banner).toHaveTextContent('INTERNAL_ERROR · req-1');
  });

  it('P18.95-T1 AC-5: the switch says Saved ✓ beside it once the setting is saved', async () => {
    show({ [`PUT ${SETTINGS}`]: { body: { hideDetails: true } } });
    const toggle = await screen.findByRole('switch', { name: HIDE });
    fireEvent.click(toggle);

    const said = await screen.findByText('Saved ✓');
    expect(said).toHaveAttribute('role', 'status');
    expect(toggle.closest('span.inline-flex.items-center.gap-1')).toContainElement(said);
  });

  it('P18.95-T1 AC-5: a refused switch offers the retry, which switches it again and sends the same setting', async () => {
    const stub = show({ [`PUT ${SETTINGS}`]: [refusal(500, 'INTERNAL_ERROR'), { body: { hideDetails: true } }] });
    const toggle = await screen.findByRole('switch', { name: HIDE });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());

    fireEvent.click(await screen.findByRole('button', { name: "Couldn't save — retry: Hide my personal activities" }));

    await waitFor(() => expect(calls(stub, SETTINGS, 'PUT')).toHaveLength(2));
    expect(calls(stub, SETTINGS, 'PUT').map(bodyOf)).toEqual([{ hideDetails: true }, { hideDetails: true }]);
    expect(await screen.findByText('Saved ✓')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: HIDE })).toBeChecked();
  });

  it('P13.1-T8 AC-2 is not drawn, and not asked for, in a read-only support session or without the edit grant', async () => {
    const support = makeMe({ ...AGUS, isImpersonating: true, impersonationReadOnly: true, impersonatedBy: 'u-admin' });
    const readsOnly = makeMe({ ...AGUS, permissions: ['calendar_entry:read', 'calendar_invitee:search'] });
    for (const me of [support, readsOnly]) {
      const stub = show({}, me);
      await grid();
      expect(screen.queryByRole('switch', { name: HIDE })).not.toBeInTheDocument();
      expect(calls(stub, SETTINGS)).toHaveLength(0);
      cleanup();
    }
  });

  it('P13.1-T8 AC-1, AC-2 the switch, its ⓘ, a short entry and a long title pass axe (WCAG 2.1 AA)', async () => {
    show({
      [WEEK_READ]: {
        body: weekRead({ entries: [entry(), entry({ entryId: 'e-long', title: LONG, date: '2026-09-29', start: '10:00', end: '11:00' })] }),
      },
    });
    await screen.findByRole('switch', { name: HIDE });
    // jsdom samples no pixels: contrast is held by the tokens, as the screens' axe suite does. The page is
    // drawn here without its shell, whose landmarks hold it, so `region` is the screens' suite's to read.
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect((results.violations ?? []).map((v) => v.id)).toEqual([]);
  });

  it('P13.1-T8 AC-2 is not drawn when the setting cannot be read: there is no state to show', async () => {
    const stub = show({ [SETTINGS]: refusal(500, 'INTERNAL_ERROR') });
    await grid();
    await waitFor(() => expect(calls(stub, SETTINGS)).toHaveLength(1));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole('switch', { name: HIDE })).not.toBeInTheDocument();
  });
});

/*
 * P18.95-T8 (the client's UI review of 2026-10-26, UI-020; ADR-0167): below 768px the page opens on an
 * agenda, a month's tap lists its day, and the controls sit in one row with *Filters* for the rest; at
 * every size the popup's meeting link is *Join Zoom* or *Join meeting*, the types have one set of names,
 * and Week and Month offer the same controls. The phone is jsdom with `matchMedia` answering the query
 * `usePhone` asks; without it, the spec is the desktop every test above was written against.
 */
describe('P18.95-T8 — the calendar on a phone, its links and its names (UI-020)', () => {
  const onPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    media: query,
    matches: query === PHONE_QUERY,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })));
  const agenda = (range = RANGE) => screen.findByRole('region', { name: `Calendar, ${range}` });
  const WEEKDAYS = [
    'Senin, 28 Sep 2026', 'Selasa, 29 Sep 2026', 'Rabu, 30 Sep 2026', 'Kamis, 1 Okt 2026',
    'Jumat, 2 Okt 2026', 'Sabtu, 3 Okt 2026', 'Minggu, 4 Okt 2026',
  ];
  const dayOf = (region: HTMLElement, date: string) => region.querySelector<HTMLElement>(`[data-day="${date}"]`)!;

  describe('P18.95-T8 AC-1 the agenda', () => {
    it('P18.95-T8 AC-1 opens on the Agenda on a phone: the week’s one read, as a list by day, each entry by time, title and type', async () => {
      onPhone();
      const stub = show();
      const region = await agenda();
      expect(within(region).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(WEEKDAYS);
      expect(within(region).getByRole('heading', { name: 'Senin, 28 Sep 2026' })).toHaveAttribute('aria-current', 'date');
      // Named as the grid names it; its time, title and type drawn in full.
      const standupLine = within(region).getByRole('button', { name: 'Internal meeting: Weekly unit standup, 09.00–09.30' });
      expect(standupLine).toHaveTextContent('09.00–09.30Weekly unit standupInternal meeting');
      // A trip on each day it spans, first; a day with nothing says so.
      expect(within(dayOf(region, '2026-09-29')).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
        'Travel: Client trip — Surabaya', 'Task: Prospecting call block, 10.00–11.30',
      ]);
      expect(within(dayOf(region, '2026-09-30')).getByText('No events')).toBeInTheDocument();
      // No hours: it is not the grid. One read, the week's, and nothing else asked for.
      expect(within(region).queryByText('07.00')).not.toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('agenda');
      expect(calls(stub, '/calendar/entries')).toHaveLength(1);
      expect(calls(stub, WEEK_READ)[0].url).toMatch(/\?view=week$/);
      // A line opens the detail the grid opens.
      await userEvent.click(standupLine);
      expect(screen.getByRole('dialog', { name: 'Weekly unit standup' })).toBeInTheDocument();
    });

    it('P18.95-T8 AC-1 at 768px and wider opens on Week as before: the grid, the toolbar, no Agenda and no Filters', async () => {
      show();
      const region = await grid();
      expect(within(region).getByText('07.00')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('combobox', { name: 'View' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
      expect(screen.queryByText('Agenda')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+ Compare with downline' })).toBeInTheDocument();
    });

    it('P18.95-T8 AC-1 a phone keeps Week and Month: view=week opens the grid, and the Agenda and the Week share one read', async () => {
      onPhone();
      const stub = show({ [MONTH_READ]: { body: monthRead() } }, AGUS, { view: 'week' });
      const region = await grid();
      expect(within(region).getByText('07.00')).toBeInTheDocument();
      const views = screen.getByRole('combobox', { name: 'View' });
      expect(views).toHaveValue('week');
      expect(within(views).getAllByRole('option').map((o) => o.textContent)).toEqual(['Agenda', 'Week', 'Month']);
      await userEvent.selectOptions(views, 'agenda');
      expect(within(await agenda()).getAllByRole('heading', { level: 2 })).toHaveLength(7);
      expect(calls(stub, WEEK_READ)).toHaveLength(1);
      await userEvent.selectOptions(views, 'month');
      expect(await screen.findByText('Sep 2026')).toBeInTheDocument();
      expect(calls(stub, MONTH_READ)).toHaveLength(1);
    });

    it('P18.95-T8 AC-1 opens a notice’s entry on its week’s agenda, with its detail', async () => {
      onPhone();
      show({ '/calendar/entries/e-standup': { body: entry() }, [`${WEEK_READ}&date=2026-09-28`]: { body: weekRead() } }, AGUS, {
        entry: 'e-standup', date: '2026-09-28',
      });
      expect(await screen.findByRole('dialog', { name: 'Weekly unit standup' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('agenda');
    });

    it('P18.95-T8 AC-1 m7 puts the focus on the reader’s own agenda once the read without a deleted entry lands', async () => {
      onPhone();
      show({
        [WEEK_READ]: [{ body: weekRead() }, { body: weekRead({ entries: [] }) }],
        'DELETE /calendar/entries/e-standup': { body: { entryId: 'e-standup', deletedAt: '2026-09-28T03:00:00.000Z' } },
      });
      await userEvent.click(within(await agenda()).getByRole('button', { name: /^Internal meeting: Weekly unit standup/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(within(screen.getByRole('dialog', { name: 'Delete "Weekly unit standup"?' })).getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.getByRole('region', { name: `Calendar, ${RANGE}` })).toHaveFocus());
    });
  });

  describe('P18.95-T8 AC-1 the month on a phone', () => {
    it('P18.95-T8 AC-1 draws a day’s entries as dots, and a tap on the day lists them under the grid, the agenda’s own list', async () => {
      onPhone();
      const stub = show({ [MONTH_READ]: { body: monthRead() } }, AGUS, { view: 'month' });
      expect(await screen.findByText('Sep 2026')).toBeInTheDocument();
      // Today's list, until another day is tapped.
      const today = screen.getByRole('button', { name: 'Senin, 28 Sep 2026, 2 events' });
      expect(today).toHaveAttribute('aria-pressed', 'true');
      expect(today).toHaveAttribute('aria-current', 'date');
      expect(screen.getByRole('heading', { level: 2, name: 'Senin, 28 Sep 2026' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Internal meeting: Weekly unit standup, 09.00–09.30' })).toBeInTheDocument();
      // A cell holds no line to aim at: the dots are drawn, not read, and its name counts them.
      const cell = document.querySelector<HTMLElement>('[data-date="2026-09-28"]')!;
      expect(within(cell).getAllByRole('button')).toEqual([today]);
      expect(cell.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(2);
      // A tap on another day lists that one, and opens no week.
      await userEvent.click(screen.getByRole('button', { name: 'Selasa, 29 Sep 2026, 2 events' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Selasa, 29 Sep 2026' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Task: Prospecting call block, 10.00–11.30' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Selasa, 29 Sep 2026, 2 events' })).toHaveAttribute('aria-pressed', 'true');
      expect(today).toHaveAttribute('aria-pressed', 'false');
      expect(calls(stub, WEEK_READ)).toHaveLength(0);
      // An empty day says so; a listed entry opens its detail.
      await userEvent.click(screen.getByRole('button', { name: 'Rabu, 30 Sep 2026' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Rabu, 30 Sep 2026' }).parentElement).toHaveTextContent('No events');
      await userEvent.click(screen.getByRole('button', { name: 'Senin, 28 Sep 2026, 2 events' }));
      await userEvent.click(screen.getByRole('button', { name: 'Internal meeting: Weekly unit standup, 09.00–09.30' }));
      expect(screen.getByRole('dialog', { name: 'Weekly unit standup' })).toBeInTheDocument();
    });

    it('P18.95-T8 AC-1 at 768px and wider a month cell still opens its week, its lines drawn as before', async () => {
      const stub = show({ [MONTH_READ]: { body: monthRead() } }, AGUS, { view: 'month' });
      await screen.findByText('Sep 2026');
      expect(screen.queryByRole('heading', { level: 2, name: 'Senin, 28 Sep 2026' })).not.toBeInTheDocument();
      const cell = document.querySelector<HTMLElement>('[data-date="2026-09-28"]')!;
      expect(within(cell).getByRole('button', { name: 'Internal meeting: 9-9.30 Weekly unit standup' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Rabu, 16 Sep 2026' }));
      await waitFor(() => expect(calls(stub, `${WEEK_READ}&date=2026-09-16`)).toHaveLength(1));
    });
  });

  describe('P18.95-T8 AC-1 the controls in one row, and Filters', () => {
    it('P18.95-T8 AC-1 puts Today, ‹ ›, the view and Filters in one row, the range and + New event under it', async () => {
      onPhone();
      show({ '/calendar/downline': { body: DOWNLINE } });
      await agenda();
      const row = screen.getByRole('button', { name: 'Today' }).parentElement!;
      expect([...row.children].map((el) => el.getAttribute('aria-label') ?? el.textContent)).toEqual(['Today', '‹›', 'View', 'Filters']);
      for (const name of ['Previous week', 'Next week', 'Filters']) expect(within(row).getByRole('button', { name })).toBeInTheDocument();
      expect(within(row).getByRole('combobox', { name: 'View' })).toBeInTheDocument();
      const next = row.nextElementSibling as HTMLElement;
      expect(next).toHaveTextContent(RANGE);
      expect(within(next).getByRole('button', { name: '+ New event' })).toBeInTheDocument();
      // Every control a 44px target.
      for (const control of [...row.querySelectorAll('button, select')]) expect(control.className).toMatch(/\bh-11\b/);
    });

    it('P18.95-T8 AC-1 Filters opens in place what the row has no room for — compare, the legend, the switch — and closes it', async () => {
      onPhone();
      show({ '/calendar/downline': { body: DOWNLINE } });
      await agenda();
      const filters = screen.getByRole('button', { name: 'Filters' });
      expect(filters).toHaveAttribute('aria-expanded', 'false');
      const panel = document.getElementById(filters.getAttribute('aria-controls')!)!;
      expect(panel).not.toBeVisible();
      expect(screen.queryByRole('button', { name: '+ Compare with downline' })).not.toBeInTheDocument();
      expect(screen.queryByRole('switch', { name: 'Hide my personal activities' })).not.toBeInTheDocument();
      await userEvent.click(filters);
      expect(filters).toHaveAttribute('aria-expanded', 'true');
      expect(within(panel).getByRole('button', { name: '+ Compare with downline' })).toBeInTheDocument();
      expect(within(panel).getByRole('switch', { name: 'Hide my personal activities' })).toBeInTheDocument();
      expect([...within(panel).getAllByRole('list')[0].querySelectorAll('li')].map((li) => li.textContent)).toEqual([
        'Internal meeting', '1:1 coaching', 'Client meeting', 'Task', 'Travel',
      ]);
      await userEvent.click(filters);
      expect(filters).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('button', { name: '+ Compare with downline' })).not.toBeInTheDocument();
    });

    it('P18.95-T8 AC-1, AC-2 compares on a phone: a person picked under Filters gets an agenda of their week, read once, which the Week shares', async () => {
      onPhone();
      const indah = weekRead({
        subject: { membershipId: 'mem-indah', name: 'Indah Permata', rung: { code: 'AGENT', label: 'Agent' } },
        entries: [
          entry({ entryId: 'i-1', type: 'task', title: 'Prospecting', organiser: { membershipId: 'mem-indah', name: 'Indah Permata' }, readerIs: 'ancestor', date: '2026-09-29' }),
          busy(),
        ],
      });
      const stub = show({ '/calendar/downline': { body: DOWNLINE }, [`${WEEK_READ}&date=2026-09-28&for=mem-indah`]: { body: indah } });
      await agenda();
      await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
      await userEvent.click(screen.getByRole('button', { name: '+ Compare with downline' }));
      await userEvent.click(await screen.findByRole('button', { name: /^Indah Permata/ }));
      await userEvent.keyboard('{Escape}');
      const theirs = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
      expect(within(theirs).getByRole('button', { name: 'Task: Prospecting, 09.00–09.30' })).toBeInTheDocument();
      expect(within(dayOf(theirs, '2026-09-30')).getByText('Busy').closest('[data-busy]')).toHaveTextContent('13.00–14.00Busy');
      expect(screen.getByRole('region', { name: 'Indah Permata' })).toHaveTextContent('Agent');
      // Beside somebody compared, the reader's own list says whose it is.
      expect(screen.getByRole('region', { name: 'Agus Santoso' })).toHaveTextContent('AB · You');
      expect(calls(stub, 'for=mem-indah')).toHaveLength(1);
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'View' }), 'week');
      const grid2 = await screen.findByRole('region', { name: `Calendar, Indah Permata, ${RANGE}` });
      expect(within(grid2).getByText('07.00')).toBeInTheDocument();
      await act(async () => {});
      expect(calls(stub, 'for=mem-indah')).toHaveLength(1);
    });
  });

  describe('P18.95-T8 AC-2 Join Zoom, Join meeting', () => {
    const NOTES = 'Zoom: https://us02web.zoom.us/j/81234567890?pwd=abc — backup meet.google.com/abc-defg-hij. Not a link: javascript:alert(1)';

    it('P18.95-T8 AC-2 makes a Zoom address Join Zoom and any other Join meeting, each opening a new tab with no opener and no referrer', async () => {
      show({ [WEEK_READ]: { body: weekRead({ entries: [entry({ notes: NOTES })] }) } });
      await grid();
      await userEvent.click(standup());
      const dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
      const [zoom, meet] = within(dialog).getAllByRole('link');
      // jsdom reads the hidden words as a block's, with a space before the comma; a browser need not.
      expect(zoom).toHaveAccessibleName(/^Join Zoom ?, opens in a new tab$/);
      expect(zoom).toHaveTextContent(/^Join Zoom/);
      expect(zoom).toHaveAttribute('href', 'https://us02web.zoom.us/j/81234567890?pwd=abc');
      expect(meet).toHaveAccessibleName(/^Join meeting ?, opens in a new tab$/);
      expect(meet).toHaveAttribute('href', 'https://meet.google.com/abc-defg-hij');
      for (const link of [zoom, meet]) {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        // The address is never hidden: it is the link's tooltip.
        expect(link).toHaveAttribute('title', link.getAttribute('href'));
        expect(link.className).toContain('max-md:min-h-11');
      }
      // What is not an http(s) address stays the organiser's words, and nothing else is a link.
      const notes = within(dialog).getByText('Location / notes').nextElementSibling!;
      expect(notes).toHaveTextContent('Zoom: Join Zoom, opens in a new tab — backup Join meeting, opens in a new tab. Not a link: javascript:alert(1)');
      expect(within(dialog).getAllByRole('link')).toHaveLength(2);
      expect(dialog.querySelector('a[href^="javascript"]')).toBeNull();
    });

    it('P18.95-T8 AC-2 draws notes with no address as written, and none as —', async () => {
      show({
        [WEEK_READ]: {
          body: weekRead({ entries: [entry({ notes: 'Office — Meeting Room 2' }), entry({ entryId: 'e-bare', title: 'Bare', notes: '', date: '2026-09-29' })] }),
        },
      });
      await grid();
      await userEvent.click(standup());
      let dialog = screen.getByRole('dialog', { name: 'Weekly unit standup' });
      expect(within(dialog).getByText('Office — Meeting Room 2')).toBeInTheDocument();
      expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('button', { name: /^Internal meeting: Bare/ }));
      dialog = screen.getByRole('dialog', { name: 'Bare' });
      expect(within(dialog).getByText('Location / notes').nextElementSibling).toHaveTextContent(/^—$/);
    });
  });

  describe('P18.95-T8 AC-2 one set of type names, the same controls in Week and Month', () => {
    it('P18.95-T8 AC-2 names each type in the popup as the legend names it, and the grid’s entry by the same word', async () => {
      const types = [['meeting', 'e-m'], ['coaching', 'e-c'], ['client', 'e-cl'], ['task', 'e-t']] as const;
      show({
        [WEEK_READ]: {
          body: weekRead({
            entries: [
              ...types.map(([type, id], i) => entry({ entryId: id, type, title: `Entry ${id}`, date: WEEK[i + 1] })),
              trip({ title: 'Trip t', startsOn: '2026-10-03', endsOn: '2026-10-03' }),
            ],
          }),
        },
      });
      await grid();
      const legend = [...screen.getByText('Internal meeting', { selector: 'li' }).closest('ul')!.querySelectorAll('li')].map((li) => li.textContent!);
      const titles = ['Entry e-m', 'Entry e-c', 'Entry e-cl', 'Entry e-t', 'Trip t'];
      for (const [i, title] of titles.entries()) {
        const line = screen.getByRole('button', { name: new RegExp(`^${legend[i]}: ${title}`) });
        await userEvent.click(line);
        const dialog = screen.getByRole('dialog', { name: title });
        expect([title, dialog.querySelector('[class*="rounded-pill"]')!.textContent]).toEqual([title, legend[i]]);
        await userEvent.keyboard('{Escape}');
      }
      expect(document.body.textContent).not.toMatch(/\bMeeting\b(?!:)|Coaching\b(?! —)|\bClient\b(?! meeting)/);
    });

    it('P18.95-T8 AC-2 offers the same controls in Week and in Month, + Compare with downline included', async () => {
      show({ [MONTH_READ]: { body: monthRead() }, '/calendar/downline': { body: DOWNLINE } });
      await grid();
      const controls = () => ({
        today: !!screen.queryByRole('button', { name: 'Today' }),
        views: ['Week', 'Month'].every((name) => !!screen.queryByRole('button', { name })),
        create: !!screen.queryByRole('button', { name: '+ New event' }),
        compare: !!screen.queryByRole('button', { name: '+ Compare with downline' }),
        viewing: !!screen.queryByText('Viewing:'),
        hide: !!screen.queryByRole('switch', { name: 'Hide my personal activities' }),
        legend: !!screen.queryByText('Internal meeting', { selector: 'li' }),
        steps: screen.getAllByRole('button', { name: /^(Previous|Next) (week|month)$/ }).length,
      });
      const week = controls();
      await userEvent.click(screen.getByRole('button', { name: 'Month' }));
      await screen.findByText('Sep 2026');
      expect(controls()).toEqual(week);
      expect(week).toEqual({ today: true, views: true, create: true, compare: true, viewing: true, hide: true, legend: true, steps: 2 });
    });
  });

  it('P18.95-T8 AC-1, AC-2 the agenda, Filters open, a month’s day list and a Join link pass axe (WCAG 2.1 AA)', async () => {
    onPhone();
    show({
      [WEEK_READ]: { body: weekRead({ entries: [...weekRead().entries, entry({ entryId: 'e-z', title: 'Client call', type: 'client', notes: 'https://zoom.us/j/1', date: '2026-09-30' })] }) },
      [MONTH_READ]: { body: monthRead() },
      '/calendar/downline': { body: DOWNLINE },
    });
    const clean = async (state: string) => {
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect([state, (results.violations ?? []).map((v) => v.id)]).toEqual([state, []]);
    };
    await agenda();
    await clean('agenda');
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await clean('filters open');
    await userEvent.click(screen.getByRole('button', { name: /^Client meeting: Client call/ }));
    await screen.findByRole('link', { name: /^Join Zoom ?, opens in a new tab$/ });
    await clean('detail with Join Zoom');
    await userEvent.keyboard('{Escape}');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'View' }), 'month');
    await screen.findByText('Sep 2026');
    await clean('month with its day list');
  });
});
