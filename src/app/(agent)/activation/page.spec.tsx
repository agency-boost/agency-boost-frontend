import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { DATE_SETTLE_MS } from '@/components/activation-parts';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import {
  activationView, completeView, notFound, readOnlySession, RINA, RINA_ME, rinaItems, SARI, SHELL_STUBS,
} from '@test/activation-fixtures';
import ActivationPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/activation',
}));

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = RINA_ME) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() }, ...routes });
  const view = renderInLayout(AgentLayout, <ActivationPage />, { me });
  return { ...stub, ...view };
};

/** Rina's view once she has ticked *Set up company CRM system*: 6 of 16, 38%. */
function crmTicked() {
  const items = rinaItems();
  items[1][1] = { ...items[1][1], done: true, doneAt: '2026-10-03T02:00:00.000Z', source: 'hire', doneBy: RINA };
  return activationView({}, items);
}

const ready = () => screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
const row = (code: string) => document.querySelector(`[data-code="${code}"]`) as HTMLElement;
const writes = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => (c.init.method ?? 'GET') !== 'GET').map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body ? JSON.parse(String(c.init.body)) : undefined]);

describe('/activation, the hire’s own 90-Day Activation (P13-T4)', () => {
  beforeEach(() => {
    nav.replace.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('P13-T4 AC-2, P18.95-T9 AC-2 is titled as its nav item, headed verbatim, and reads the reader’s own activation once', async () => {
    const { calls } = show();
    await ready();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Your 90-Day Activation$/);
    expect(screen.getByText('Your first 90 days, checklist by checklist.')).toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/activation/me')).map((c) => c.url)).toEqual(['http://api.test/api/v1/activation/me']);
  });

  it('P13-T4 AC-2, P18.96-T2 AC-3 AC-5 draws the join date read-only (OD-118): named Join date, shown, and no field to change it', async () => {
    show();
    await ready();
    const term = screen.getByText('Join date');
    expect(term.tagName).toBe('DT');
    expect(term.nextElementSibling).toHaveTextContent('6 Agu 2026');
    expect(screen.queryByLabelText('Join date')).not.toBeInTheDocument();
    // The prototype's *Start date* is gone: one name for the one date.
    expect(screen.queryByText('Start date')).not.toBeInTheDocument();
  });

  it('P13-T4 AC-2 prints the served tiles, bar and table: Day n/window, Completed n/items, the percentage', async () => {
    show();
    await ready();
    const day = screen.getByText('Day').parentElement!;
    expect(day).toHaveTextContent('Day59/90');
    expect(day).toHaveAttribute('data-variant', 'plain');
    const completed = screen.getByText('Completed').parentElement!;
    expect(completed).toHaveTextContent('Completed5/16');
    expect(completed).toHaveAttribute('data-variant', 'plain');
    expect(screen.getByRole('progressbar', { name: 'Your activation progress' })).toHaveAttribute('aria-valuenow', '31');
    expect(screen.getByText('31,0% complete')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Your activation progress' });
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Aspect', 'Items', 'Status']);
    expect(within(table).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual([
      'Introduction2/4In progress',
      'Initial Setup2/4In progress',
      'Training & Certification0/3Not started',
      'First Sale1/2In progress',
      'Ongoing Habits0/3Not started',
    ]);
  });

  it('P13-T4 AC-2 the Completed tile turns green when every item is done', async () => {
    show({ 'GET /activation/me': { body: completeView() } });
    await ready();
    expect(screen.getByText('Completed').parentElement).toHaveAttribute('data-variant', 'complete');
    expect(screen.getByText('100,0% complete')).toBeInTheDocument();
  });

  it('P13-T4 AC-6 prints the window it is served and “{window}+” past it, computing no day of its own', async () => {
    show({ 'GET /activation/me': { body: activationView({ day: 102, window: 90, overdue: true }) } });
    await ready();
    expect(screen.getByText('Day').parentElement).toHaveTextContent('Day90+/90');
    // The hire's page has no overdue state: the red tile is the leader's (`Overall.html:6801`).
    expect(screen.getByText('Day').parentElement).toHaveAttribute('data-variant', 'plain');
  });

  it('P13-T4 AC-6 an office with another window prints its own number', async () => {
    show({ 'GET /activation/me': { body: activationView({ day: 12, window: 60 }) } });
    await ready();
    expect(screen.getByText('Day').parentElement).toHaveTextContent('Day12/60');
  });

  it('P13-T4 AC-2 draws the five aspect cards numbered by position, each with its name once', async () => {
    show();
    await ready();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Your activation progress', '1Introduction', '2Initial Setup', '3Training & Certification', '4First Sale', '5Ongoing Habits',
      'Coaching note',
    ]);
  });

  it('P13-T4 AC-2 ends with the footer, verbatim', async () => {
    show();
    await ready();
    expect(screen.getByText('Visible only to new agents, for their first 6 months. Tenured agents won\'t see this section.')).toBeInTheDocument();
  });

  it('P13-T4 AC-3 a manual row: its box named by the item, and the chevron opening the hire’s own note and date', async () => {
    show();
    await ready();
    const basics = within(row('INSURANCE_BASICS'));
    expect(basics.getByRole('checkbox', { name: 'Learn insurance basics' })).toBeChecked();
    const chevron = basics.getByRole('button', { name: 'Show note and date' });
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(basics.queryByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    const note = basics.getByRole('textbox', { name: 'Note (optional) — Learn insurance basics' });
    expect(note).toHaveAttribute('placeholder', 'Note (optional)');
    expect(note).toHaveValue('Read the handbook');
    expect(note).toHaveAttribute('maxLength', '500');
    expect(basics.getByLabelText('Date — Learn insurance basics')).toHaveValue('2026-08-09');
    expect(document.getElementById(chevron.getAttribute('aria-controls')!)).not.toHaveAttribute('hidden');

    await userEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
  });

  it('P13-T4 AC-3 a tick is written at once, shown at once, and the answer settles the counts', async () => {
    const { calls } = show({ 'PUT /activation/me/items/': () => ({ body: crmTicked() }) });
    await ready();
    const box = within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' });
    await userEvent.click(box);
    expect(box).toBeChecked();
    await screen.findByText('38,0% complete');
    expect(box).toBeChecked();
    expect(within(row('CRM_SETUP')).getByRole('button', { name: 'Ticked by you · 3 Okt 2026' })).toBeInTheDocument();
    expect(writes(calls)).toEqual([['PUT', '/activation/me/items/CRM_SETUP', { done: true }]]);
  });

  it('P13-T4 AC-3 an untick sends the state, never a toggle', async () => {
    const { calls } = show({ 'PUT /activation/me/items/': () => ({ body: activationView() }) });
    await ready();
    await userEvent.click(within(row('INSURANCE_BASICS')).getByRole('checkbox'));
    await waitFor(() => expect(writes(calls)).toEqual([['PUT', '/activation/me/items/INSURANCE_BASICS', { done: false }]]));
  });

  it('P13-T4 AC-3 the percentage waits for the answer: the screen works none of it out', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const stub = stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: activationView() } });
    const original = stub.mock.getMockImplementation()!;
    stub.mock.mockImplementation(async (url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') {
        await held;
        return { ok: true, status: 200, json: async () => crmTicked() } as Response;
      }
      return original(url, init);
    });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(within(row('CRM_SETUP')).getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('31,0% complete')).toBeInTheDocument();
    await act(async () => { release(); });
    expect(await screen.findByText('38,0% complete')).toBeInTheDocument();
  });

  it('P13-T4 AC-7 a refused tick puts the box back and says why', async () => {
    show({
      'PUT /activation/me/items/': {
        status: 409, body: { error: { code: 'ACTIVATION_CLOSED', message: 'This activation is closed.', requestId: 'r-1' } },
      },
    });
    await ready();
    const box = within(row('CRM_SETUP')).getByRole('checkbox');
    await userEvent.click(box);
    expect(await within(row('CRM_SETUP')).findByRole('alert')).toHaveTextContent('Not saved. This activation is closed.');
    expect(box).not.toBeChecked();
  });

  it('P18.95-T1 AC-5: a tick says Saved ✓ beside its box once it lands', async () => {
    show({ 'PUT /activation/me/items/': () => ({ body: crmTicked() }) });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' }));

    const said = await within(row('CRM_SETUP')).findByText('Saved ✓');
    expect(said).toHaveAttribute('role', 'status');
    // On the box's own line, beside it.
    expect(said.parentElement).toContainElement(within(row('CRM_SETUP')).getByRole('checkbox'));
  });

  it('P18.95-T1 AC-5: a refused tick says Couldn’t save — retry, and the retry sends the same tick again', async () => {
    const { calls } = show({
      'PUT /activation/me/items/': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
        { body: crmTicked() },
      ],
    });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    const retry = await within(row('CRM_SETUP')).findByRole('button', { name: "Couldn't save — retry: Set up company CRM system" });
    // The row's own *Not saved.* still says why.
    expect(within(row('CRM_SETUP')).getByRole('alert')).toHaveTextContent('Not saved. Something went wrong.');

    await userEvent.click(retry);

    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/CRM_SETUP', { done: true }],
      ['PUT', '/activation/me/items/CRM_SETUP', { done: true }],
    ]));
    expect(await within(row('CRM_SETUP')).findByText('Saved ✓')).toBeInTheDocument();
    expect(within(row('CRM_SETUP')).getByRole('checkbox')).toBeChecked();
  });

  it('P18.95-T1 AC-5: the note says Saved ✓ under its own box, and the date has none of its own', async () => {
    show({ 'PUT /activation/me/items/': () => ({ body: activationView() }) });
    await ready();
    const crm = within(row('CRM_SETUP'));
    await userEvent.click(crm.getByRole('button', { name: 'Show note and date' }));
    const note = crm.getByRole('textbox');
    await userEvent.type(note, 'Asked IT');
    await userEvent.tab();

    const said = await crm.findByText('Saved ✓');
    expect(note.parentElement).toContainElement(said);
    expect(crm.getAllByText('Saved ✓')).toHaveLength(1);
  });

  it('P13-T4 AC-3 the note is saved when the field is left, once, and only when it changed', async () => {
    const { calls } = show({ 'PUT /activation/me/items/': () => ({ body: activationView() }) });
    await ready();
    const crm = within(row('CRM_SETUP'));
    await userEvent.click(crm.getByRole('button', { name: 'Show note and date' }));
    const note = crm.getByRole('textbox');
    await userEvent.click(note);
    await userEvent.tab();
    expect(writes(calls)).toEqual([]);

    await userEvent.type(note, '  Asked IT for access  ');
    expect(writes(calls)).toEqual([]);
    await userEvent.tab();
    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/CRM_SETUP', { done: false, note: 'Asked IT for access' }],
    ]));
  });

  it('P13-T4 AC-3 an emptied note is cleared', async () => {
    const { calls } = show({ 'PUT /activation/me/items/': () => ({ body: activationView() }) });
    await ready();
    const basics = within(row('INSURANCE_BASICS'));
    await userEvent.click(basics.getByRole('button', { name: 'Show note and date' }));
    await userEvent.clear(basics.getByRole('textbox'));
    await userEvent.tab();
    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/INSURANCE_BASICS', { done: true, note: null }],
    ]));
  });

  it('P13-T4 AC-3 the date is saved on change once it is whole, after a pause, and a half-typed one is never sent', async () => {
    const { calls } = show({ 'PUT /activation/me/items/': () => ({ body: activationView() }) });
    await ready();
    const crm = within(row('CRM_SETUP'));
    await userEvent.click(crm.getByRole('button', { name: 'Show note and date' }));
    const date = crm.getByLabelText('Date — Set up company CRM system');

    vi.useFakeTimers();
    fireEvent.change(date, { target: { value: '0202-09-14' } });
    await act(async () => { vi.advanceTimersByTime(DATE_SETTLE_MS); });
    expect(writes(calls)).toEqual([]);
    fireEvent.change(date, { target: { value: '2026-09-14' } });
    await act(async () => { vi.advanceTimersByTime(DATE_SETTLE_MS - 1); });
    expect(writes(calls)).toEqual([]);
    await act(async () => { vi.advanceTimersByTime(1); });
    vi.useRealTimers();
    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/CRM_SETUP', { done: false, date: '2026-09-14' }],
    ]));
  });

  it('P13-T4 AC-3 leaving the date writes it at once, and a cleared date is cleared', async () => {
    const { calls } = show({ 'PUT /activation/me/items/': () => ({ body: activationView() }) });
    await ready();
    const basics = within(row('INSURANCE_BASICS'));
    await userEvent.click(basics.getByRole('button', { name: 'Show note and date' }));
    const date = basics.getByLabelText('Date — Learn insurance basics');

    fireEvent.change(date, { target: { value: '' } });
    fireEvent.blur(date);
    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/INSURANCE_BASICS', { done: true, date: null }],
    ]));
  });

  it('P13-T4 AC-4 a linked row: the box disabled, Auto saying what it waits for, and Go to its screen', async () => {
    show();
    await ready();
    const goal = within(row('GOAL_SETTING'));
    expect(goal.getByRole('checkbox', { name: 'Goal setting: APE & activity targets' })).toBeDisabled();
    expect(goal.getByRole('checkbox')).toBeChecked();
    const auto = goal.getByRole('button', { name: 'Auto — completes when the hire has saved any goal since joining' });
    expect(auto).toHaveTextContent('Auto');
    await userEvent.click(auto);
    expect(goal.getByRole('tooltip')).toHaveTextContent('Completes when the hire has saved any goal since joining.');
    expect(goal.queryByRole('button', { name: 'Show note and date' })).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Go to Goal Settings →' })).toHaveAttribute('href', '/goals');
    expect(screen.getByRole('link', { name: 'Go to Leads Management →' })).toHaveAttribute('href', '/leads');
    expect(screen.getByRole('link', { name: 'Go to Activity Management →' })).toHaveAttribute('href', '/activity/log');
    expect(within(row('ACTIVITY_TRACKER_WEEKLY')).getByRole('checkbox')).not.toBeChecked();
  });

  it('P13-T4 AC-4 a link whose evaluator does not exist yet is ticked by hand (ADR-0031)', async () => {
    const view = activationView();
    view.aspects[2].items[0] = {
      ...view.aspects[2].items[0],
      link: { kind: 'training:PRODUCT', label: 'Training module', route: '/training', completesWhen: 'the hire has completed that training module', live: false, form: null },
    };
    show({ 'GET /activation/me': { body: view } });
    await ready();
    const training = within(row('MANDATORY_TRAINING'));
    expect(training.getByRole('checkbox')).toBeEnabled();
    expect(training.queryByText('Auto')).not.toBeInTheDocument();
    expect(training.getByRole('button', { name: 'Show note and date' })).toBeInTheDocument();
  });

  it('P13-T4 AC-5 every done row says who ticked it and when, or which link completed it', async () => {
    show();
    await ready();
    expect(within(row('INSURANCE_BASICS')).getByRole('button', { name: 'Ticked by you · 10 Agu 2026' })).toBeInTheDocument();
    expect(within(row('CAREER_MINDSET')).getByRole('button', { name: 'Ticked by Sari Puspita · 12 Agu 2026' })).toBeInTheDocument();
    expect(within(row('GOAL_SETTING')).getByRole('button', { name: 'Completed from Goal Settings by you · 15 Agu 2026' })).toBeInTheDocument();
    expect(within(row('ADD_PROSPECTS')).getByRole('button', { name: 'Completed from Leads Management by Sari Puspita · 16 Agu 2026' })).toBeInTheDocument();
    // An item not done carries none.
    expect(within(row('CRM_SETUP')).queryByText('ⓘ')).not.toBeInTheDocument();
  });

  it('P13-T4 AC-5, P18.96-T2 AC-5 a correction of the join date is said beside it', async () => {
    show({ 'GET /activation/me': { body: activationView({ startCorrected: { by: SARI, at: '2026-09-01T02:00:00.000Z' } }) } });
    await ready();
    expect(screen.getByRole('button', { name: 'Join date corrected by Sari Puspita · 1 Sep 2026' })).toBeInTheDocument();
  });

  it('P13-T6 AC-3 the leader’s coaching note is read here, read-only, with who wrote it and when', async () => {
    show();
    await ready();
    const card = screen.getByRole('region', { name: 'Coaching note' });
    expect(card).toHaveTextContent('Great pace on prospecting — let’s book your first JFW this week.');
    expect(card).toHaveTextContent('From Sari Puspita · 30 Sep 2026');
    expect(within(card).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(card).queryByRole('button')).not.toBeInTheDocument();
  });

  it('P13-T6 AC-3 no note, no card', async () => {
    show({ 'GET /activation/me': { body: activationView({ note: null }) } });
    await ready();
    expect(screen.queryByRole('region', { name: 'Coaching note' })).not.toBeInTheDocument();
  });

  it('P13-T7 AC-1, P18.96-T6 AC-5 Mark checklist complete is drawn disabled below 100%, saying why', async () => {
    show();
    await ready();
    const button = screen.getByRole('button', { name: 'Mark checklist complete' });
    expect(button).toBeDisabled();
    // The checklist's own total, served with it: sixteen on the seed's checklist.
    expect(button).toHaveAccessibleDescription('Unlocks when all 16 items are done');
    expect(screen.getByText('Unlocks when all 16 items are done')).toBeVisible();
  });

  it('P13-T7 AC-2 at 100% it asks in the product’s dialog, in the hire’s terms; Cancel leaves everything as it was', async () => {
    const { calls } = show({ 'GET /activation/me': { body: completeView() } });
    await ready();
    // P18.96-T6 AC-5: nothing left to wait on, so no reason is drawn.
    expect(screen.queryByText(/Unlocks when all/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark checklist complete' }));
    const dialog = screen.getByRole('dialog', { name: 'Mark your checklist complete? The 90-Day Activation menu will be removed.' });
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Confirm']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });

  it('P13-T7 AC-3 Confirm graduates, says so, re-reads the session and lands the reader where / would', async () => {
    const { calls, session } = show({
      'GET /activation/me': { body: completeView() },
      'POST /activation/me/graduate': { body: completeView({ state: 'graduated', graduatedAt: '2026-10-03T03:00:00.000Z', graduatedBy: RINA }) },
      // At 100%, as the session says once the last tick lands — and not where an unfinished one starts (P18.96-T3).
    }, { ...RINA_ME, activation: { open: true, complete: true } });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Mark checklist complete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('Marked as tenured agent — 90-Day Activation removed from menu.')).toBeInTheDocument();
    expect(writes(calls)).toEqual([['POST', '/activation/me/graduate', undefined]]);
    // An Agent who leads nobody lands on their own day (`landing.ts`), in place of the prototype's *New hires*.
    expect(nav.replace).toHaveBeenCalledWith('/activity/log');
    expect(session.reload).toHaveBeenCalled();
  });

  it('P13-T7 AC-1 a refused graduation stays on the page and says why', async () => {
    show({
      'GET /activation/me': { body: completeView() },
      'POST /activation/me/graduate': {
        status: 409, body: { error: { code: 'ACTIVATION_INCOMPLETE', message: 'Every item must be done first.', requestId: 'r-2' } },
      },
    });
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Mark checklist complete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Every item must be done first.');
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mark checklist complete' })).toBeEnabled();
  });

  it('P13-T4 AC-9 a read-only support session reads the page and draws no write control', async () => {
    const { calls } = show({ 'GET /activation/me': { body: completeView() } }, readOnlySession(RINA_ME));
    await ready();
    expect(screen.queryByRole('button', { name: 'Mark checklist complete' })).not.toBeInTheDocument();
    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
    const basics = within(row('INSURANCE_BASICS'));
    await userEvent.click(basics.getByRole('button', { name: 'Show note and date' }));
    expect(basics.getByRole('textbox')).toHaveAttribute('readonly');
    expect(basics.getByLabelText('Date — Learn insurance basics')).toHaveAttribute('readonly');
    expect(writes(calls)).toEqual([]);
  });

  it('P13-T4 AC-9 a reader without the tick permission sees the boxes and cannot use them, nor graduate', async () => {
    show({ 'GET /activation/me': { body: completeView() } }, { ...RINA_ME, permissions: ['activation:read'] });
    await ready();
    expect(screen.queryByRole('button', { name: 'Mark checklist complete' })).not.toBeInTheDocument();
    expect(within(row('CRM_SETUP')).getByRole('checkbox')).toBeDisabled();
  });

  it('P13-T4 AC-9 is refused, with no read, to a reader without activation:read', async () => {
    const { calls } = show({}, { ...RINA_ME, permissions: [] });
    expect(await screen.findByRole('alert')).toHaveAttribute('data-permission', 'activation:read');
    expect(calls.some((c) => c.url.includes('/activation/me'))).toBe(false);
  });

  it('P13-T4 AC-7 shows a skeleton while the activation is read', async () => {
    show();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your activation…');
    await ready();
  });

  it('P13-T4 AC-7 a failed read says why and reads again on Try again', async () => {
    const { calls } = show({
      'GET /activation/me': [
        { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something broke', requestId: 'r-9' } } },
        { body: activationView() },
      ],
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await ready();
    expect(calls.filter((c) => c.url.endsWith('/activation/me'))).toHaveLength(2);
  });

  it('P13-T4 AC-7 a reader with no activation meets the not-offered state, with no checklist', async () => {
    show({ 'GET /activation/me': notFound });
    expect(await screen.findByRole('heading', { level: 2, name: 'You have no 90-day activation.' })).toBeInTheDocument();
    expect(screen.getByText('It is for people in their first months as an agent.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Your own coaching' })).not.toBeInTheDocument();
  });

  it('P13-T7 AC-4 a graduated activation is not offered here, and says where the checklist now lives', async () => {
    show({ 'GET /activation/me': { body: completeView({ state: 'graduated', graduatedAt: '2026-09-29T03:00:00.000Z', graduatedBy: RINA }) } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Your 90-day checklist is complete.' })).toBeInTheDocument();
    expect(screen.getByText('You marked it complete on 29 Sep 2026.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Your own coaching' })).toHaveAttribute('href', '/coaching/me/activation');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('P13-T7 AC-4 an expired activation says when it ended', async () => {
    show({ 'GET /activation/me': { body: activationView({ state: 'expired', endsOn: '2026-09-30' }) } });
    expect(await screen.findByRole('heading', { level: 2, name: 'Your 90-day activation has ended.' })).toBeInTheDocument();
    expect(screen.getByText('It ran for six months, until 30 Sep 2026.')).toBeInTheDocument();
  });
});

/** Rina's view with every item done but *Set up company CRM system*: 15 of 16, one tick from complete. */
function allButCrm() {
  const items = completeView().aspects.map((a) => a.items.map((it) => ({ ...it })));
  items[1][1] = { ...items[1][1], done: false, doneAt: null, source: null, doneBy: null };
  return activationView({}, items);
}

describe('Phase 13 exit review — /activation', () => {
  beforeEach(() => {
    nav.replace.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Phase 13 exit review: an expired activation’s date is the short one every other date on these pages uses', async () => {
    show({ 'GET /activation/me': { body: activationView({ state: 'expired', endsOn: '2027-01-06' }) } });
    expect(await screen.findByText('It ran for six months, until 6 Jan 2027.')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/January/);
  });

  it('Phase 13 exit review: a graduation with no moment recorded falls back to today, in the short date too', async () => {
    show({ 'GET /activation/me': { body: completeView({ state: 'graduated', graduatedAt: null, today: '2027-01-06' }) } });
    expect(await screen.findByText('You marked it complete on 6 Jan 2027.')).toBeInTheDocument();
  });

  it('Phase 13 exit review: the hire’s own Day tile has no overdue state, and so no overdue word', async () => {
    show({ 'GET /activation/me': { body: activationView({ day: 102, window: 90, overdue: true }) } });
    await ready();
    expect(screen.getByText('Day').parentElement).toHaveTextContent(/^Day90\+\/90$/);
  });

  it('Phase 13 exit review: the tick that completes the checklist re-reads the session, so the nav’s check follows at once', async () => {
    const { session } = show({
      'GET /activation/me': { body: allButCrm() },
      'PUT /activation/me/items/': [{ body: completeView() }, { body: allButCrm() }],
    });
    await ready();
    expect(RINA_ME.activation).toEqual({ open: true, complete: false });

    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(await screen.findByText('100,0% complete')).toBeInTheDocument();
    expect(session.reload).toHaveBeenCalledTimes(1);

    // And back: the untick that takes it below 100% re-reads it too, so the check goes.
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(await screen.findByText('94,0% complete')).toBeInTheDocument();
    expect(session.reload).toHaveBeenCalledTimes(2);
  });

  it('Phase 13 exit review: a tick that leaves the checklist short of complete re-reads nothing', async () => {
    const { session } = show({ 'PUT /activation/me/items/': () => ({ body: crmTicked() }) });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(await screen.findByText('38,0% complete')).toBeInTheDocument();
    expect(session.reload).not.toHaveBeenCalled();
  });

  it('Phase 13 exit review: a refused tick re-reads nothing, and a session that carries no activation is never re-read', async () => {
    const refused = show({
      'GET /activation/me': { body: allButCrm() },
      'PUT /activation/me/items/': { status: 409, body: { error: { code: 'ACTIVATION_CLOSED', message: 'This activation is closed.', requestId: 'r-1' } } },
    });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(await within(row('CRM_SETUP')).findByRole('alert')).toHaveTextContent('Not saved. This activation is closed.');
    expect(refused.session.reload).not.toHaveBeenCalled();
    refused.unmount();
    vi.unstubAllGlobals();

    const factless = show({
      'GET /activation/me': { body: allButCrm() },
      'PUT /activation/me/items/': { body: completeView() },
    }, { ...RINA_ME, activation: null });
    await ready();
    await userEvent.click(within(row('CRM_SETUP')).getByRole('checkbox'));
    expect(await screen.findByText('100,0% complete')).toBeInTheDocument();
    expect(factless.session.reload).not.toHaveBeenCalled();
  });
});
