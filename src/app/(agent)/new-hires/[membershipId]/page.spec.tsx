import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { DATE_SETTLE_MS } from '@/components/activation-parts';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  ARIEF, leaderView, notFound, readOnlySession, RINA, rinaItems, SARI, SARI_ME, SHELL_STUBS,
} from '@test/activation-fixtures';
import NewHireDetailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires/mem-rina',
}));

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = SARI_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: leaderView() }, ...routes });
  const view = renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me });
  return { ...stub, ...view };
};

const ready = () => screen.findByRole('heading', { level: 2, name: 'Activation progress' });
const row = (code: string) => document.querySelector(`[data-code="${code}"]`) as HTMLElement;
const writes = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => (c.init.method ?? 'GET') !== 'GET').map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body ? JSON.parse(String(c.init.body)) : undefined]);

/** Rina's view once Sari has ticked *Set up company CRM system*. */
function crmTickedBySari() {
  const items = rinaItems().map((list) => list.map((it) => ({ ...it, note: null, date: null })));
  items[1][1] = { ...items[1][1], done: true, doneAt: '2026-10-03T02:00:00.000Z', source: 'leader', doneBy: SARI };
  return leaderView({ done: 6, pct: 38, aspects: leaderView().aspects.map((a, i) => (i === 1 ? { ...a, done: 3, items: items[1] } : a)) });
}

describe('/new-hires/[membershipId], one hire as a leader reads it (P13-T5, P13-T6)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('P13-T5 AC-5 is titled with the hire’s name, the subtitle and heading verbatim, and the way back', async () => {
    const { calls } = show();
    await ready();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Rina Wijaya$/);
    expect(screen.getByText('You can update their 90-Day Activation status, plus your coaching note.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to New Hires' })).toHaveAttribute('href', '/new-hires');
    expect(calls.filter((c) => c.url.includes('/new-hires/')).map((c) => c.url)).toEqual(['http://api.test/api/v1/new-hires/mem-rina']);
  });

  it('P13-T5 AC-5 the tiles, bar, table and five cards are the hire’s page’s, and the Day tile turns red when overdue', async () => {
    show({ 'GET /new-hires/mem-rina': { body: leaderView({ day: 95, overdue: true }) } });
    await ready();
    const day = screen.getByText('Day').parentElement!;
    expect(day).toHaveTextContent('Day90+/90');
    expect(day).toHaveAttribute('data-variant', 'overdue');
    expect(screen.getByText('Completed').parentElement).toHaveTextContent('Completed5/16');
    expect(screen.getByText('31,0% complete')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Activation progress' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Activation progress' })).toHaveAttribute('aria-valuenow', '31');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Activation progress', '1Introduction', '2Initial Setup', '3Training & Certification', '4First Sale', '5Ongoing Habits',
      'Coaching note',
    ]);
  });

  it('P13-T5 AC-5 a hire within the window keeps a plain Day tile', async () => {
    show();
    await ready();
    expect(screen.getByText('Day').parentElement).toHaveAttribute('data-variant', 'plain');
  });

  it('P13-T5 AC-6 manual items are boxes the leader ticks; each write toasts verbatim and carries their name', async () => {
    const { calls } = show({ 'PUT /new-hires/mem-rina/items/': () => ({ body: crmTickedBySari() }) });
    await ready();
    const box = within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' });
    expect(box).toBeEnabled();
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(await screen.findByText('Activation status updated.')).toBeInTheDocument();
    expect(writes(calls)).toEqual([['PUT', '/new-hires/mem-rina/items/CRM_SETUP', { done: true }]]);
    expect(within(row('CRM_SETUP')).getByRole('button', { name: 'Ticked by you · 3 Okt 2026' })).toBeInTheDocument();
  });

  it('P18.95-T1 AC-5: a leader’s tick says Saved ✓ beside its box, and keeps the prototype’s toast', async () => {
    show({ 'PUT /new-hires/mem-rina/items/': () => ({ body: crmTickedBySari() }) });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' }));

    expect(await within(row('CRM_SETUP')).findByText('Saved ✓')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Activation status updated.')).toBeInTheDocument();
  });

  it('P18.95-T1 AC-5: a refused tick offers the retry, which sends the same state again', async () => {
    const { calls } = show({
      'PUT /new-hires/mem-rina/items/': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
        { body: crmTickedBySari() },
      ],
    });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    await userEvent.click(await within(row('CRM_SETUP')).findByRole('button', { name: "Couldn't save — retry: Set up company CRM system" }));

    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/new-hires/mem-rina/items/CRM_SETUP', { done: true }],
      ['PUT', '/new-hires/mem-rina/items/CRM_SETUP', { done: true }],
    ]));
    expect(await within(row('CRM_SETUP')).findByText('Saved ✓')).toBeInTheDocument();
  });

  it('P18.95-T1 AC-5, P18.96-T2 AC-5: a corrected join date says Saved ✓ under the field, and a refused one offers the retry', async () => {
    const corrected = leaderView({ startDate: '2026-08-01', day: 64, startCorrected: { by: SARI, at: '2026-10-03T02:00:00.000Z' } });
    const { calls } = show({
      'PUT /new-hires/mem-rina/start-date': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
        { body: corrected },
      ],
    });
    await ready();
    const field = screen.getByLabelText('Join date');
    fireEvent.change(field, { target: { value: '2026-08-01' } });
    fireEvent.blur(field);

    await userEvent.click(await screen.findByRole('button', { name: "Couldn't save — retry: Join date" }));

    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/new-hires/mem-rina/start-date', { startDate: '2026-08-01' }],
      ['PUT', '/new-hires/mem-rina/start-date', { startDate: '2026-08-01' }],
    ]));
    expect(await screen.findByText('Saved ✓')).toHaveAttribute('role', 'status');
  });

  it('P13-T5 AC-6 a leader unticks too, sending the state', async () => {
    const { calls } = show({ 'PUT /new-hires/mem-rina/items/': () => ({ body: leaderView() }) });
    await ready();
    await userEvent.click(within(row('CAREER_MINDSET')).getByRole('checkbox'));
    await waitFor(() => expect(writes(calls)).toEqual([['PUT', '/new-hires/mem-rina/items/CAREER_MINDSET', { done: false }]]));
  });

  it('P13-T5 AC-6 the linked items are disabled with Auto, as on the hire’s page (contradiction 1)', async () => {
    show();
    await ready();
    for (const code of ['GOAL_SETTING', 'ADD_PROSPECTS', 'ACTIVITY_TRACKER_WEEKLY']) {
      const linked = within(row(code));
      expect(linked.getByRole('checkbox')).toBeDisabled();
      expect(linked.getByRole('button', { name: /^Auto — completes when / })).toBeInTheDocument();
    }
    // No *Go to* on a leader's detail: it would open the leader's own screens.
    expect(screen.queryByRole('link', { name: /^Go to / })).not.toBeInTheDocument();
  });

  it('P13-T5 AC-6 no note or date fields on a row, as drawn', async () => {
    show();
    await ready();
    expect(screen.queryByRole('button', { name: 'Show note and date' })).not.toBeInTheDocument();
    expect(within(row('INSURANCE_BASICS')).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('P13-T5 AC-6 each done row says who ticked it: the hire by name, the reader as you', async () => {
    show();
    await ready();
    expect(within(row('INSURANCE_BASICS')).getByRole('button', { name: 'Ticked by Rina Wijaya · 10 Agu 2026' })).toBeInTheDocument();
    expect(within(row('CAREER_MINDSET')).getByRole('button', { name: 'Ticked by you · 12 Agu 2026' })).toBeInTheDocument();
    expect(within(row('ADD_PROSPECTS')).getByRole('button', { name: 'Completed from Leads Management by you · 16 Agu 2026' })).toBeInTheDocument();
  });

  it('P13-T4 AC-7 a refused tick puts the box back and says why', async () => {
    show({
      'PUT /new-hires/mem-rina/items/': {
        status: 409, body: { error: { code: 'ACTIVATION_ITEM_AUTOMATIC', message: 'This item completes on its own.', requestId: 'r-1' } },
      },
    });
    await ready();
    const box = within(row('CRM_SETUP')).getByRole('checkbox');
    await userEvent.click(box);
    expect(await within(row('CRM_SETUP')).findByRole('alert')).toHaveTextContent('Not saved. This item completes on its own.');
    expect(box).not.toBeChecked();
    expect(screen.queryByText('Activation status updated.')).not.toBeInTheDocument();
  });

  it('P13-T5 AC-5, P18.96-T2 AC-3 AC-4 the join date is the leader’s to correct, in the shared field, within the bounds, written once it is whole', async () => {
    const corrected = leaderView({ startDate: '2026-08-01', day: 64, startCorrected: { by: SARI, at: '2026-10-03T02:00:00.000Z' } });
    const { calls } = show({ 'PUT /new-hires/mem-rina/start-date': { body: corrected } });
    await ready();
    const field = screen.getByLabelText('Join date');
    expect(field).toHaveValue('2026-08-06');
    expect(field).toHaveAttribute('max', '2026-10-03');
    expect(field).toHaveAttribute('min', '2025-10-03');
    // P18.96-T2 AC-4: the date as the app writes it, on the shared field's face — never the browser's mm/dd/yyyy.
    expect(field.nextElementSibling).toHaveTextContent('6 Agu 2026');

    vi.useFakeTimers();
    fireEvent.change(field, { target: { value: '2026-08-01' } });
    await act(async () => { vi.advanceTimersByTime(DATE_SETTLE_MS); });
    vi.useRealTimers();
    await waitFor(() => expect(writes(calls)).toEqual([['PUT', '/new-hires/mem-rina/start-date', { startDate: '2026-08-01' }]]));
    expect(await screen.findByText('Join date updated.')).toBeInTheDocument();
    expect(screen.getByText('Day').parentElement).toHaveTextContent('Day64/90');
    expect(screen.getByRole('button', { name: 'Join date corrected by you · 3 Okt 2026' })).toBeInTheDocument();
  });

  it('P13-T5 AC-5 a date after today, or more than a year back, is refused before it is sent', async () => {
    const { calls } = show();
    await ready();
    const field = screen.getByLabelText('Join date');
    fireEvent.change(field, { target: { value: '2026-10-04' } });
    fireEvent.blur(field);
    expect(await screen.findByText('Choose a date from 3 Okt 2025 to today.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(field, { target: { value: '2025-10-02' } });
    fireEvent.blur(field);
    expect(await screen.findByText('Choose a date from 3 Okt 2025 to today.')).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('P13-T5 AC-5 a correction the server refuses puts the date back and says why', async () => {
    show({
      'PUT /new-hires/mem-rina/start-date': {
        status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'That date is out of range.', requestId: 'r-3' } },
      },
    });
    await ready();
    const field = screen.getByLabelText('Join date');
    fireEvent.change(field, { target: { value: '2026-08-01' } });
    fireEvent.blur(field);
    expect(await screen.findByText('Not saved. That date is out of range.')).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveValue('2026-08-06'));
  });

  it('P13-T6 AC-1 the coaching note card, verbatim, holding the note there now and who saved it', async () => {
    show();
    await ready();
    const card = screen.getByRole('region', { name: 'Coaching note' });
    expect(within(card).getByText('Visible to this agent on their own 90-Day Activation page.')).toBeInTheDocument();
    const box = within(card).getByRole('textbox', { name: 'Coaching note' });
    expect(box).toHaveAttribute('placeholder', 'e.g. Great pace on prospecting — let\'s focus on booking your first joint field work this week.');
    expect(box).toHaveValue('Great pace on prospecting — let’s book your first JFW this week.');
    expect(box).toHaveAttribute('maxLength', '1000');
    expect(within(card).getByRole('button', { name: 'Last saved by you · 30 Sep 2026' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Save note' })).toBeEnabled();
  });

  it('P13-T6 AC-1, AC-2 Save note replaces the note, trimmed, and toasts verbatim with the hire’s full name', async () => {
    const { calls } = show({
      'PUT /new-hires/mem-rina/note': { body: { note: { text: 'Book the JFW with Pak Hendra.', by: SARI, at: '2026-10-03T03:00:00.000Z' } } },
    });
    await ready();
    const card = within(screen.getByRole('region', { name: 'Coaching note' }));
    const box = card.getByRole('textbox');
    await userEvent.clear(box);
    await userEvent.type(box, '  Book the JFW with Pak Hendra.  ');
    await userEvent.click(card.getByRole('button', { name: 'Save note' }));
    expect(await screen.findByText('Coaching note saved — visible to Rina Wijaya.')).toBeInTheDocument();
    expect(writes(calls)).toEqual([['PUT', '/new-hires/mem-rina/note', { text: 'Book the JFW with Pak Hendra.' }]]);
    const saved = within(screen.getByRole('region', { name: 'Coaching note' }));
    expect(saved.getByRole('button', { name: 'Last saved by you · 3 Okt 2026' })).toBeInTheDocument();
    expect(saved.getByRole('textbox')).toHaveValue('Book the JFW with Pak Hendra.');
  });

  it('P13-T6 AC-2 an empty note is not sent', async () => {
    const { calls } = show({ 'GET /new-hires/mem-rina': { body: leaderView({ note: null }) } });
    await ready();
    const card = within(screen.getByRole('region', { name: 'Coaching note' }));
    expect(card.getByRole('textbox')).toHaveValue('');
    expect(card.queryByText('ⓘ')).not.toBeInTheDocument();
    await userEvent.click(card.getByRole('button', { name: 'Save note' }));
    expect(card.getByRole('alert')).toHaveTextContent('Write a note before saving.');
    expect(writes(calls)).toEqual([]);
  });

  it('P13-T6 AC-2 a note another leader saved names them', async () => {
    show({ 'GET /new-hires/mem-rina': { body: leaderView({ note: { text: 'Keep going.', by: ARIEF, at: '2026-09-28T03:00:00.000Z' } }) } });
    await ready();
    expect(screen.getByRole('button', { name: 'Last saved by Arief Hidayat · 28 Sep 2026' })).toBeInTheDocument();
  });

  it('P13-T6 AC-6 a refused note says why and keeps what was typed', async () => {
    show({
      'PUT /new-hires/mem-rina/note': { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Too long.', requestId: 'r-4' } } },
    });
    await ready();
    const card = within(screen.getByRole('region', { name: 'Coaching note' }));
    await userEvent.type(card.getByRole('textbox'), ' More.');
    await userEvent.click(card.getByRole('button', { name: 'Save note' }));
    expect(await card.findByRole('alert')).toHaveTextContent('Too long.');
    expect(card.getByRole('textbox')).toHaveValue('Great pace on prospecting — let’s book your first JFW this week. More.');
  });

  it('P13-T5 AC-8, P13-T6 AC-5 a read-only support session reads the page and draws no write control', async () => {
    const { calls } = show({}, readOnlySession(SARI_ME));
    await ready();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(screen.queryByLabelText('Join date')).not.toBeInTheDocument();
    expect(screen.getByText('Join date').nextElementSibling).toHaveTextContent('6 Agu 2026');
    expect(screen.getByRole('textbox', { name: 'Coaching note' })).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save note' })).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('P13-T5 AC-8 a hire outside the reader’s reach is the not-found state, naming nobody', async () => {
    show({ 'GET /new-hires/mem-rina': notFound });
    expect(await screen.findByRole('heading', { level: 2, name: 'This person isn’t one of your new hires.' })).toBeInTheDocument();
    expect(screen.getByText('They may have moved to another leader, or the address may be mistyped.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to New Hires' })).toHaveAttribute('href', '/new-hires');
    expect(document.body.textContent).not.toMatch(/mem-rina|NOT_FOUND|Rina/);
  });

  it('P13-T5 AC-8 a write answered 404 — the hire moved away meanwhile — turns the page to not-found', async () => {
    show({ 'PUT /new-hires/mem-rina/items/': notFound });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(await screen.findByRole('heading', { level: 2, name: 'This person isn’t one of your new hires.' })).toBeInTheDocument();
  });

  it('P13-T7 AC-4 a graduated activation is read, says how it ended, and draws no write control at all', async () => {
    const { calls } = show({
      'GET /new-hires/mem-rina': { body: leaderView({ state: 'graduated', graduatedAt: '2026-10-01T03:00:00.000Z', graduatedBy: RINA }) },
    });
    await ready();
    expect(screen.getByText('Marked complete by Rina Wijaya on 1 Okt 2026.')).toBeInTheDocument();
    // Phase 13's docs audit (parity L-89): the line takes the subtitle's place, which would otherwise
    // say the leader can still update it.
    expect(screen.queryByText('You can update their 90-Day Activation status, plus your coaching note.')).not.toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(screen.queryByLabelText('Join date')).not.toBeInTheDocument();
    expect(screen.getByText('Join date').nextElementSibling).toHaveTextContent('6 Agu 2026');
    // The server refuses the note on a closed activation too (409 ACTIVATION_CLOSED), so it is not offered.
    expect(screen.getByRole('textbox', { name: 'Coaching note' })).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save note' })).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('P13-T6 AC-6 a note refused because the activation closed meanwhile says why, through the product’s words', async () => {
    show({
      'PUT /new-hires/mem-rina/note': {
        status: 409, body: { error: { code: 'ACTIVATION_CLOSED', message: 'This activation is closed.', requestId: 'r-5' } },
      },
    });
    await ready();
    const card = within(screen.getByRole('region', { name: 'Coaching note' }));
    await userEvent.click(card.getByRole('button', { name: 'Save note' }));
    expect(await card.findByRole('alert')).toHaveTextContent('This activation is closed.');
    expect(screen.queryByText(/Coaching note saved/)).not.toBeInTheDocument();
  });

  it('P13-T7 AC-4 an expired activation says when it ended, read-only as a graduated one is', async () => {
    show({ 'GET /new-hires/mem-rina': { body: leaderView({ state: 'expired', endsOn: '2026-09-30' }) } });
    await ready();
    expect(screen.getByText('Ended on 30 Sep 2026, six months after it started.')).toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save note' })).not.toBeInTheDocument();
  });

  it('Phase 13 exit review: the overdue Day tile says so in words to a screen reader, and adds nothing visible', async () => {
    // Colour is never the only cue (`frontend/CLAUDE.md`): *", overdue"* after the day (*The module's own strings*).
    show({ 'GET /new-hires/mem-rina': { body: leaderView({ day: 95, overdue: true }) } });
    await ready();
    const day = screen.getByText('Day').parentElement!;
    expect(day).toHaveAttribute('data-variant', 'overdue');
    expect(day).toHaveTextContent(/^Day90\+\/90, overdue$/);
    expect(within(day).getByText(', overdue')).toHaveClass('sr-only');
  });

  it('Phase 13 exit review: a Day tile within the window carries no overdue word', async () => {
    show();
    await ready();
    const day = screen.getByText('Day').parentElement!;
    expect(day).toHaveTextContent(/^Day59\/90$/);
    expect(within(day).queryByText(', overdue')).not.toBeInTheDocument();
  });

  it('Phase 13 exit review: an expired activation’s date is the short one every other date on these pages uses', async () => {
    show({ 'GET /new-hires/mem-rina': { body: leaderView({ state: 'expired', endsOn: '2027-01-06' }) } });
    await ready();
    expect(screen.getByText('Ended on 6 Jan 2027, six months after it started.')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/January/);
  });

  it('Phase 13 exit review: a refused note reads “Not saved. {why}”, as every other write here does (L-85)', async () => {
    show({
      'PUT /new-hires/mem-rina/note': { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'Too long.', requestId: 'r-4' } } },
    });
    await ready();
    const card = within(screen.getByRole('region', { name: 'Coaching note' }));
    await userEvent.click(card.getByRole('button', { name: 'Save note' }));
    expect(await card.findByRole('alert')).toHaveTextContent(/^Not saved\. Too long\.$/);
  });

  it('Phase 13 exit review: an empty note is not a refusal, and keeps its own words without the prefix', async () => {
    show({ 'GET /new-hires/mem-rina': { body: leaderView({ note: null }) } });
    await ready();
    const card = within(screen.getByRole('region', { name: 'Coaching note' }));
    await userEvent.click(card.getByRole('button', { name: 'Save note' }));
    expect(card.getByRole('alert')).toHaveTextContent(/^Write a note before saving\.$/);
  });

  it('shows a skeleton while the hire is read, then the title', async () => {
    show();
    // The skeleton's live region, beside the toast's, which the page keeps in place for its writes.
    expect(screen.getAllByRole('status').map((s) => s.textContent)).toContain('Loading this activation…');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    await ready();
  });

  it('a failed read says why, and Try again reads again', async () => {
    const { calls } = show({
      'GET /new-hires/mem-rina': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke', requestId: 'r-9' } } },
        { body: leaderView() },
      ],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await ready();
    expect(calls.filter((c) => c.url.endsWith('/new-hires/mem-rina'))).toHaveLength(2);
  });

  it('P13-T5 AC-8 is refused, with no read, to a reader without activation:read', async () => {
    const { calls } = show({}, { ...SARI_ME, permissions: [] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'activation:read');
    expect(calls.some((c) => c.url.includes('/new-hires'))).toBe(false);
  });
});
