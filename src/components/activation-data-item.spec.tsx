import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import ActivationPage from '@/app/(agent)/activation/page';
import NewHireDetailPage from '@/app/(agent)/new-hires/[membershipId]/page';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  activationView, leaderView, RINA, RINA_ME, rinaItems, SARI, SARI_ME, SHELL_STUBS, withWaitingCheckIn,
} from '@test/activation-fixtures';
import type { ActivationItemProgress, ActivationView } from '@/lib/activation';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/activation',
}));

/**
 * **The data-backed items on both pages** (P18.96-T4 AC-2 to AC-5; ADR-0171 §3): *Close first case independently*,
 * *Reach Independent Agent milestone* and *Weekly 1-on-1 check-in* — the *Auto* badge, the source line linked to the
 * record, a hand tick that opens its form in place and saves the tick and the record in one request, and *waiting for
 * data*. The hire's `/activation` and the leader's `/new-hires/[membershipId]` draw them with one component.
 */

const hirePage = (routes: Record<string, StubReply | StubReply[]> = {}, view: ActivationView = activationView()) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: view }, ...routes });
  renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
  return stub;
};
const leaderPage = (routes: Record<string, StubReply | StubReply[]> = {}, view: ActivationView = leaderView()) => {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: view }, ...routes });
  renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
  return stub;
};
const row = (code: string) => document.querySelector(`[data-code="${code}"]`) as HTMLElement;
const writes = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => (c.init.method ?? 'GET') !== 'GET').map((c) => [c.init.method, c.url.replace('http://api.test/api/v1', ''), c.init.body ? JSON.parse(String(c.init.body)) : undefined]);
/** `items`, with one changed. */
const changed = (code: string, over: Partial<ActivationItemProgress>, items = rinaItems()) =>
  items.map((list) => list.map((it) => (it.code === code ? { ...it, ...over } : it)));

describe('the data-backed checklist items (P18.96-T4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('P18.96-T4 AC-2 a done item shows Auto and its source line, “Completed from Sales data · {date}”, linked to the lead on the hire’s page', async () => {
    hirePage();
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const first = within(row('FIRST_CASE_CLOSED'));
    expect(first.getByRole('checkbox')).toBeChecked();
    expect(first.getByRole('checkbox')).toBeDisabled();
    expect(first.getByText('Auto')).toBeInTheDocument();
    expect(first.getByRole('link', { name: 'Completed from Sales data · 20 Sep 2026' })).toHaveAttribute('href', '/leads');
    // No *Go to*: its way in is its form.
    expect(first.queryByRole('link', { name: /^Go to/ })).not.toBeInTheDocument();
  });

  it('P18.96-T4 AC-2 the coaching item links its session: the hire’s own coaching, the leader’s archive', async () => {
    const items = changed('WEEKLY_CHECK_IN', {
      done: true, doneAt: '2026-10-01T03:00:00.000Z', source: 'link', doneBy: SARI, record: { collection: 'coachingSessions', id: 's-4' },
    });
    hirePage({}, activationView({}, items));
    const own = within(await screen.findByText('Completed from Coaching sessions · 1 Okt 2026').then(() => row('WEEKLY_CHECK_IN')));
    expect(own.getByRole('link', { name: 'Completed from Coaching sessions · 1 Okt 2026' })).toHaveAttribute('href', '/coaching/me?session=s-4');
  });

  it('P18.96-T4 AC-2 a leader’s detail links a session to its archive, and draws a lead’s source line with no link', async () => {
    const items = changed('WEEKLY_CHECK_IN', {
      done: true, doneAt: '2026-10-01T03:00:00.000Z', source: 'link', doneBy: SARI, record: { collection: 'coachingSessions', id: 's-4' },
    }).map((list) => list.map((it) => ({ ...it, note: null, date: null })));
    leaderPage({}, { ...leaderView(), aspects: activationView({}, items).aspects });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    expect(within(row('WEEKLY_CHECK_IN')).getByRole('link', { name: 'Completed from Coaching sessions · 1 Okt 2026' }))
      .toHaveAttribute('href', '/coaching/mem-rina/archive/s-4');
    const first = within(row('FIRST_CASE_CLOSED'));
    expect(first.getByText('Completed from Sales data · 20 Sep 2026')).toBeInTheDocument();
    expect(first.queryByRole('link', { name: /Completed from/ })).not.toBeInTheDocument();
  });

  it('P18.96-T4 AC-4 a tick its data has not confirmed reads “Ticked by {name}, waiting for data”, the tick’s own date kept in its ⓘ', async () => {
    hirePage({}, activationView({}, withWaitingCheckIn()));
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const checkIn = within(row('WEEKLY_CHECK_IN'));
    expect(checkIn.getByText('Ticked by Sari Puspita, waiting for data')).toBeInTheDocument();
    expect(checkIn.getByRole('button', { name: 'Ticked by Sari Puspita · 25 Sep 2026' })).toBeInTheDocument();
    expect(checkIn.getByText('Auto')).toBeInTheDocument();
    // A tick by hand is the hand's to take back.
    expect(checkIn.getByRole('checkbox')).toBeEnabled();
  });

  it('P18.96-T4 AC-3 the hire’s Which case?: their closings listed, a new one logged — the tick and the record in one request', async () => {
    const after = activationView({}, changed('INDEPENDENT_AGENT_MILESTONE', {
      done: true, doneAt: '2026-10-03T03:00:00.000Z', source: 'hire', doneBy: RINA, waiting: true, record: { collection: 'leads', id: 'l-new' },
    }));
    const { calls } = hirePage({
      'GET /activation/me/closings': { body: { closings: [{ leadId: 'l-1', name: 'Ibu Ratna', date: '2026-09-20' }] } },
      'PUT /activation/me/items/INDEPENDENT_AGENT_MILESTONE': { body: after },
    });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const milestone = within(row('INDEPENDENT_AGENT_MILESTONE'));
    await userEvent.click(milestone.getByRole('checkbox'));
    // Nothing is saved by the box: it opens the form.
    expect(writes(calls)).toEqual([]);
    const form = within(await milestone.findByRole('group', { name: 'Which case?' }));
    expect(await form.findByRole('radio', { name: 'Ibu Ratna · 20 Sep 2026' })).toBeChecked();
    await userEvent.click(form.getByRole('radio', { name: 'Log a new closing' }));
    await userEvent.type(form.getByLabelText('Sold to'), 'Pak Yusuf');
    await userEvent.click(form.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/INDEPENDENT_AGENT_MILESTONE', {
        done: true, record: { kind: 'closing', name: 'Pak Yusuf', date: '2026-10-03' },
      }],
    ]));
    expect(await milestone.findByText('Ticked by you, waiting for data')).toBeInTheDocument();
    expect(milestone.queryByRole('group', { name: 'Which case?' })).not.toBeInTheDocument();
    expect(await milestone.findByText('Saved ✓')).toBeInTheDocument();
  });

  it('P18.96-T4 AC-3 names an existing closing by its lead, and Cancel sends nothing and leaves the box unticked', async () => {
    const { calls } = hirePage({
      'GET /activation/me/closings': { body: { closings: [{ leadId: 'l-1', name: 'Ibu Ratna', date: '2026-09-20' }] } },
      'PUT /activation/me/items/INDEPENDENT_AGENT_MILESTONE': { body: activationView() },
    });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const milestone = within(row('INDEPENDENT_AGENT_MILESTONE'));
    await userEvent.click(milestone.getByRole('checkbox'));
    let form = within(await milestone.findByRole('group', { name: 'Which case?' }));
    await form.findByRole('radio', { name: 'Ibu Ratna · 20 Sep 2026' });
    await userEvent.click(form.getByRole('button', { name: 'Cancel' }));
    expect(milestone.getByRole('checkbox')).not.toBeChecked();
    expect(writes(calls)).toEqual([]);

    await userEvent.click(milestone.getByRole('checkbox'));
    form = within(await milestone.findByRole('group', { name: 'Which case?' }));
    await form.findByRole('radio', { name: 'Ibu Ratna · 20 Sep 2026' });
    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual([
      ['PUT', '/activation/me/items/INDEPENDENT_AGENT_MILESTONE', { done: true, record: { kind: 'closing', leadId: 'l-1' } }],
    ]));
  });

  it('P18.96-T4 AC-3 a new closing with no name is not sent: the form says so', async () => {
    const { calls } = hirePage({ 'GET /activation/me/closings': { body: { closings: [] } } });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const milestone = within(row('INDEPENDENT_AGENT_MILESTONE'));
    await userEvent.click(milestone.getByRole('checkbox'));
    const form = within(await milestone.findByRole('group', { name: 'Which case?' }));
    expect(await form.findByText('No closing in Leads Management yet. Log the case below.')).toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    expect(form.getByRole('alert')).toHaveTextContent('Fill in every field first.');
    expect(writes(calls)).toEqual([]);
  });

  it('P18.96-T4 AC-3 the leader’s Log 1:1: a date and a note, sent with the tick; a refusal keeps the box unticked and says why', async () => {
    const { calls } = leaderPage({
      'PUT /new-hires/mem-rina/items/WEEKLY_CHECK_IN': [
        { status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'record.date is a day from the join date.', requestId: 'r-1' } } },
        { body: { ...leaderView(), aspects: activationView({}, withWaitingCheckIn()).aspects } },
      ],
    });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    const checkIn = within(row('WEEKLY_CHECK_IN'));
    await userEvent.click(checkIn.getByRole('checkbox'));
    const form = within(checkIn.getByRole('group', { name: 'Log 1:1' }));
    await userEvent.type(form.getByLabelText('Note'), 'Went through his first presentations.');
    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    expect(await checkIn.findByText(/Not saved\. record\.date is a day from the join date\./)).toBeInTheDocument();
    // Still open, the tick not taken.
    expect(checkIn.getByRole('group', { name: 'Log 1:1' })).toBeInTheDocument();

    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(writes(calls)[1]).toEqual(['PUT', '/new-hires/mem-rina/items/WEEKLY_CHECK_IN', {
      done: true, record: { kind: 'one_on_one', date: '2026-10-03', note: 'Went through his first presentations.' },
    }]);
    // Sari reads her own tick as hers.
    expect(await checkIn.findByText('Ticked by you, waiting for data')).toBeInTheDocument();
    expect(checkIn.queryByRole('group', { name: 'Log 1:1' })).not.toBeInTheDocument();
  });

  it('P18.96-T4 AC-3 unticking a waiting tick saves at once, with no form and no record', async () => {
    const { calls } = leaderPage({
      'PUT /new-hires/mem-rina/items/WEEKLY_CHECK_IN': { body: leaderView() },
    }, { ...leaderView(), aspects: activationView({}, withWaitingCheckIn()).aspects });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    await userEvent.click(within(row('WEEKLY_CHECK_IN')).getByRole('checkbox'));
    await waitFor(() => expect(writes(calls)).toEqual([['PUT', '/new-hires/mem-rina/items/WEEKLY_CHECK_IN', { done: false }]]));
  });

  it('P18.96-T4 AC-3 an Agent who leads ticks none of the three by hand: their boxes are inert, no form opens', async () => {
    const stub = stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: leaderView() } });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, {
      me: { ...SARI_ME, permissions: SARI_ME.permissions.filter((p) => !p.startsWith('coaching_session:')) },
    });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    expect(within(row('WEEKLY_CHECK_IN')).getByRole('checkbox')).toBeDisabled();
    expect(within(row('INDEPENDENT_AGENT_MILESTONE')).getByRole('checkbox')).toBeDisabled();
    // A manual item is still theirs to tick.
    expect(within(row('CRM_SETUP')).getByRole('checkbox')).toBeEnabled();
    expect(writes(stub.calls)).toEqual([]);
  });

  it('P18.96-T4 AC-5 the leader’s detail and the hire’s page draw the same items the same way, the reader named “you” on their own', async () => {
    const items = withWaitingCheckIn();
    const state = () => ['FIRST_CASE_CLOSED', 'WEEKLY_CHECK_IN', 'INDEPENDENT_AGENT_MILESTONE'].map((code) => [
      code, row(code).querySelector('[data-testid="source-line"]')?.textContent ?? null, (within(row(code)).getByRole('checkbox') as HTMLInputElement).checked,
    ]);
    hirePage({}, activationView({}, items));
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    expect(state()).toEqual([
      ['FIRST_CASE_CLOSED', 'Completed from Sales data · 20 Sep 2026', true],
      ['WEEKLY_CHECK_IN', 'Ticked by Sari Puspita, waiting for data', true],
      ['INDEPENDENT_AGENT_MILESTONE', null, false],
    ]);
    document.body.innerHTML = '';
    leaderPage({}, { ...leaderView(), aspects: activationView({}, items.map((l) => l.map((it) => ({ ...it, note: null, date: null })))).aspects });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    expect(state()).toEqual([
      ['FIRST_CASE_CLOSED', 'Completed from Sales data · 20 Sep 2026', true],
      ['WEEKLY_CHECK_IN', 'Ticked by you, waiting for data', true],
      ['INDEPENDENT_AGENT_MILESTONE', null, false],
    ]);
  });
});
