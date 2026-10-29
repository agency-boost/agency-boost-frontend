import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { feedbackSummary, INVITEES, rollCall } from '@test/events-fixtures';
import EventsSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/events',
}));

const member = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({
  membership: member,
  permissions: ['tenant_config:read', 'tenant_config:write', 'event_settings:read', 'event_attendance:confirm', 'event_feedback:read'],
});
const READER = makeMe({ membership: member, permissions: ['tenant_config:read', 'event_settings:read'] });

const type = (over: Record<string, unknown> = {}) => ({
  id: 't1', code: 'TRAINING', label: 'Training', description: null, emoji: '📚',
  color: '#2D9CDB', displayOrder: 1, status: 'active', events: 0, ...over,
});

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1', code: 'KICKOFF', typeCode: 'TRAINING', title: 'Kickoff 2026',
  blurb: 'The year ahead', description: '',
  startsAt: '2026-10-01T02:00:00.000Z', endsAt: '2026-10-01T06:00:00.000Z',
  startsOn: '2026-10-01', location: 'Jakarta', locationUrl: null,
  audience: { issuer: 'kpm', scope: 'all_agents', inviteeMembershipIds: [] },
  phase: 'upcoming', status: 'active', version: 1, ...over,
});

function render(
  types: unknown[] = [type()], events: unknown[] = [event()], me = OWNER,
) {
  const stub = stubFetch({
    '/kpm/settings/events/types': { body: types },
    '/kpm/settings/events': { body: events },
    '/kpm/settings/publish-state': {
      body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
    },
    'GET /kpm/settings/events/invitees': { body: { people: INVITEES } },
    'GET /kpm/settings/events/e3/attendance': { body: rollCall({ eventId: 'e3', title: 'Last month' }) },
    'GET /kpm/settings/events/e3/feedback': { body: feedbackSummary({ eventId: 'e3', title: 'Last month' }) },
  });
  renderWithSession(<EventsSettingsPage />, { me });
  return stub;
}

/**
 * The events an office runs (P5-T6).
 *
 * What this screen has to get right, and the prototype does not: an audience is **two choices and
 * a list** rather than a sentence, and whether an event is happening is read off its dates rather
 * than off a label somebody typed.
 */
describe('the office’s Events screen', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows an event with its phase worked out, not a stored label', async () => {
    render([type()], [
      event(),
      event({ id: 'e2', code: 'NOW', title: 'Happening', phase: 'running' }),
      event({ id: 'e3', code: 'LAST', title: 'Last month', phase: 'past' }),
    ]);

    expect(await screen.findByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Happening now')).toBeInTheDocument();
    expect(screen.getByText('Past')).toBeInTheDocument();
  });

  it('reads the audience as two plain choices, not a slash-separated string', async () => {
    // The prototype's value is *"Prudential Event | All agents"* — one string nothing can filter.
    render([type()], [event({
      audience: { issuer: 'company', scope: 'leaders', inviteeMembershipIds: [] },
    })]);

    expect(await screen.findByText(/Your company/)).toBeInTheDocument();
    expect(screen.getByText(/anybody with somebody under them/)).toBeInTheDocument();
  });

  it('shows the day in the office’s timezone, as the server worked it out', async () => {
    // 23:30 UTC is already the next day in Jakarta; a browser deriving it would disagree.
    render([type()], [event({ startsAt: '2026-10-01T23:30:00.000Z', startsOn: '2026-10-02' })]);

    // Written as every screen writes a date (ADR-0167 §1), never the ISO day the read carries.
    expect(await screen.findByText(/^2 Oct 2026 ·/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-02/)).not.toBeInTheDocument();
  });

  it('archives an event type and says what that affects', async () => {
    const stub = render([type({ events: 3 })], []);
    await screen.findByRole('checkbox', { name: 'Show archived' });
    await userEvent.click(screen.getByRole('link', { name: 'Event types' }));
    await screen.findByText('Training');

    const button = await screen.findByRole('button', { name: 'Archive' });
    expect(button).toHaveAttribute('title', expect.stringContaining('3 event(s)'));

    await userEvent.click(button);
    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/types/t1/archive'))).toBe(true));
  });

  it('edits an event without ever sending its code', async () => {
    const stub = render([type()], [event()]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));

    // The code is the identity and is shown locked: an event that already happened points at it.
    expect(screen.getByLabelText('Code')).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff, moved');
    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent.title).toBe('Kickoff, moved');
    expect(sent).not.toHaveProperty('code');
  });

  it('never offers a delete, for a type or an event', async () => {
    render([type()], [event()]);
    await screen.findByText('Kickoff 2026');

    // An event that already happened renders the type it was; a deleted type would leave it
    // describing nothing.
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('will not let an event be added with no end time', async () => {
    render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));

    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff');
    await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01T09:00');

    // Without an end, nothing can say whether the event is running — which is why the prototype
    // had to have somebody type a status in by hand.
    expect(screen.getByRole('button', { name: 'Add the event' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Ends'), '2026-10-01T13:00');
    expect(screen.getByRole('button', { name: 'Add the event' })).toBeEnabled();
  });

  it('fills the code in from the title', async () => {
    render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));

    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff 2026');
    expect(screen.getByLabelText('Code')).toHaveValue('KICKOFF_2026');
  });

  it('says why an event cannot be added when there is no type to file it under', async () => {
    render([type({ status: 'archived' })], []);

    expect(await screen.findByText(/no active event types/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add an event' })).toBeDisabled();
  });

  it('shows a reader who cannot write the events without a control to change them', async () => {
    render([type()], [event()], READER);
    await screen.findByText('Kickoff 2026');

    expect(screen.queryByRole('button', { name: 'Add an event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
  });

  it('creates an event, sending the dates as instants and the audience as two fields', async () => {
    const stub = render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));

    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff 2026');
    await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01T09:00');
    await userEvent.type(screen.getByLabelText('Ends'), '2026-10-01T13:00');
    await userEvent.type(screen.getByLabelText('Where'), 'Jakarta');
    await userEvent.selectOptions(screen.getByLabelText('Who is invited'), 'leaders');
    await userEvent.click(screen.getByRole('button', { name: 'Add the event' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body));
    expect(sent).toMatchObject({
      code: 'KICKOFF_2026', typeCode: 'TRAINING', title: 'Kickoff 2026', location: 'Jakarta',
      audience: { issuer: 'kpm', scope: 'leaders' },
    });
    // Sent as instants, so the server never has to guess which clock a wall time belongs to.
    expect(sent.startsAt).toMatch(/Z$/);
    expect(new Date(sent.endsAt).getTime()).toBeGreaterThan(new Date(sent.startsAt).getTime());
  });

  it('P18.5-T5 AC-10 Chosen people and Chosen leaders are live, no longer coming soon (D-picker)', async () => {
    render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));

    const scope = screen.getByLabelText('Who is invited');
    expect(within(scope).getByRole('option', { name: 'Chosen people' })).toBeEnabled();
    expect(within(scope).getByRole('option', { name: 'Chosen leaders' })).toBeEnabled();
    expect(scope).not.toHaveTextContent(/coming soon/i);
  });

  it('P18.5-T5 AC-10 Chosen people: a searchable checklist of the active members, and Save waits for one', async () => {
    const stub = render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Bootcamp');
    await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01T09:00');
    await userEvent.type(screen.getByLabelText('Ends'), '2026-10-01T13:00');
    await userEvent.selectOptions(screen.getByLabelText('Who is invited'), 'select_agents');

    const picker = await screen.findByRole('searchbox', { name: 'Search people' });
    expect(screen.getAllByRole('checkbox', { name: /Agus|Budi|Dewi|Rina|Sari/ })).toHaveLength(5);
    expect(screen.getByText('0 chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the event' })).toBeDisabled();
    expect(screen.getByLabelText('Who is invited')).toHaveAccessibleDescription('Pick at least one person below to save.');

    await userEvent.type(picker, 'rina');
    expect(screen.getAllByRole('checkbox', { name: /Agus|Budi|Dewi|Rina|Sari/ }).map((c) => c.closest('label')!.textContent))
      .toEqual(['Rina WijayaAgent']);
    await userEvent.click(screen.getByRole('checkbox', { name: /Rina Wijaya/ }));
    await userEvent.clear(picker);
    await userEvent.click(screen.getByRole('checkbox', { name: /Budi Santoso/ }));
    expect(screen.getByText('2 chosen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the event' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Add the event' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body));
    expect(sent.audience).toEqual({ issuer: 'kpm', scope: 'select_agents', inviteeMembershipIds: ['mem-rina', 'mem-budi'] });
    expect(stub.calls.filter((c) => c.url.endsWith('/kpm/settings/events/invitees'))).toHaveLength(1);
  });

  it('P18.5-T5 AC-10 Chosen leaders lists only members who lead somebody (the graph, not the title)', async () => {
    render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));
    await userEvent.selectOptions(screen.getByLabelText('Who is invited'), 'select_leaders');
    await screen.findByRole('searchbox', { name: 'Search people' });
    // Dewi is an AAB who leads nobody: she is not offered.
    expect(screen.getAllByRole('checkbox').filter((c) => c.closest('[data-part="audience-picker"]'))
      .map((c) => c.closest('label')!.querySelector('span')!.textContent)).toEqual(['Agus Wibowo', 'Sari Puspita']);
  });

  it('P18.5-T5 AC-10 a chosen person the list cannot offer is kept, never dropped, and saving unchanged sends no audience', async () => {
    const stub = render([type()], [event({
      audience: { issuer: 'kpm', scope: 'select_agents', inviteeMembershipIds: ['mem-rina', 'mem-gone'] },
    })]);
    expect(await screen.findByText(/Chosen people · 2 invited/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByRole('searchbox', { name: 'Search people' });
    expect(screen.getByRole('checkbox', { name: /Rina Wijaya/ })).toBeChecked();
    // Somebody who has left has no name on the read: one row, ticked, saying so.
    expect(screen.getByRole('checkbox', { name: 'Somebody who has left' })).toBeChecked();
    expect(screen.getByText('2 chosen')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff, renamed');
    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent.title).toBe('Kickoff, renamed');
    expect(sent).not.toHaveProperty('audience');
    expect(sent).not.toHaveProperty('startsAt');
    expect(sent).not.toHaveProperty('endsAt');
  });

  it('P18.5-T5 AC-10 a chosen leader who leads nobody now is kept with the reason, and can be cleared but not chosen again', async () => {
    const stub = render([type()], [event({
      audience: { issuer: 'kpm', scope: 'select_leaders', inviteeMembershipIds: ['mem-agus', 'mem-dewi'] },
    })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await screen.findByRole('searchbox', { name: 'Search people' });
    const dewi = screen.getByRole('checkbox', { name: /Dewi Lestari/ });
    expect(dewi).toBeChecked();
    expect(dewi.closest('label')).toHaveTextContent('Leads nobody now');
    await userEvent.click(dewi);
    expect(screen.queryByRole('checkbox', { name: /Dewi Lestari/ })).not.toBeInTheDocument();
    expect(screen.getByText('1 chosen')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent.audience).toEqual({ issuer: 'kpm', scope: 'select_leaders', inviteeMembershipIds: ['mem-agus'] });
  });

  it('P18.5-T5 AC-9 an audience change the server refuses is said under Who is invited, the panel kept', async () => {
    stubFetch({
      '/kpm/settings/events/types': { body: [type()] },
      '/kpm/settings/events': { body: [event({ phase: 'past', title: 'Town Hall' })] },
      'PATCH /kpm/settings/events/e1': {
        status: 409,
        body: { error: { code: 'EVENT_HAS_RESPONSES', message: 'People have answered this event, so its audience stays as it is.', requestId: 'r-9' } },
      },
      '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } },
    });
    renderWithSession(<EventsSettingsPage />, { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByLabelText('Who is invited'), 'leaders');
    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));
    const line = await screen.findByText('People have answered this event, so its audience stays as it is.');
    expect(screen.getByLabelText('Who is invited')).toHaveAccessibleDescription(
      'A leader is somebody with people under them — not a job title. People have answered this event, so its audience stays as it is.',
    );
    expect(line).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Save the event' })).toBeInTheDocument();
  });

  it('P18.5-T5 AC-9 moving an answered event back into the future: the spec’s line under Ends', async () => {
    stubFetch({
      '/kpm/settings/events/types': { body: [type()] },
      '/kpm/settings/events': { body: [event({ phase: 'past', title: 'Town Hall' })] },
      'PATCH /kpm/settings/events/e1': {
        status: 409,
        body: { error: { code: 'EVENT_HAS_RESPONSES', message: 'People have already answered this event.', requestId: 'r-9' } },
      },
      '/kpm/settings/publish-state': { body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null } },
    });
    renderWithSession(<EventsSettingsPage />, { me: OWNER });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.clear(screen.getByLabelText('Ends'));
    await userEvent.type(screen.getByLabelText('Ends'), '2027-01-01T13:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));
    expect(await screen.findByText('People have already responded to this event, so its start can’t move and it can’t end in the future.'))
      .toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText('Ends')).toHaveValue('2027-01-01T13:00');
  });

  it('P18.5-T5 AC-10 a scope with no list sends none', async () => {
    const stub = render([type()], [event({ audience: { issuer: 'kpm', scope: 'select_agents', inviteeMembershipIds: ['mem-rina'] } })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(screen.getByLabelText('Who is invited'), 'all_agents');
    expect(screen.queryByRole('searchbox', { name: 'Search people' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent.audience).toEqual({ issuer: 'kpm', scope: 'all_agents' });
  });

  it('P18.5-T5 AC-7 View feedback on a past row only, opening the roll call and the Feedback Summary', async () => {
    render([type()], [
      event(),
      event({ id: 'e2', code: 'NOW', title: 'Happening', phase: 'running' }),
      event({ id: 'e3', code: 'LAST', title: 'Last month', phase: 'past' }),
    ]);
    await screen.findByText('Last month');
    const buttons = screen.getAllByRole('button', { name: 'View feedback' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('li')).toHaveTextContent('Last month');

    await userEvent.click(buttons[0]);
    const box = await screen.findByRole('dialog', { name: 'Last month' });
    // Two tabs since P18.8-T13 (ADR-0161 §6): the roll call open, the summary a tab away.
    expect(await within(box).findByRole('heading', { name: 'Roll call' })).toBeInTheDocument();
    await userEvent.click(within(box).getByRole('tab', { name: 'Feedback summary' }));
    expect(await within(box).findByRole('heading', { name: 'Last month — Feedback Summary' })).toBeInTheDocument();
    await userEvent.click(within(box).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P18.5-T5 AC-7 View feedback is a read: a reader who cannot write still has it', async () => {
    const reader = makeMe({ membership: member, permissions: ['tenant_config:read', 'event_settings:read', 'event_feedback:read'] });
    render([type()], [event({ id: 'e3', code: 'LAST', title: 'Last month', phase: 'past' })], reader);
    await screen.findByText('Last month');
    expect(screen.getByRole('button', { name: 'View feedback' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('P18.5-T5 AC-2 the list is the office’s administration’s: without event_settings:read nothing is read', async () => {
    const stub = render([type()], [event()], makeMe({ membership: member, permissions: ['tenant_config:read'] }));
    await waitFor(() => expect(screen.queryByText('Kickoff 2026')).not.toBeInTheDocument());
    expect(stub.calls.some((c) => /\/kpm\/settings\/events(\?|$)/.test(c.url))).toBe(false);
  });

  it('adds and edits an event type, never resending its code', async () => {
    const stub = render([type()], []);
    await screen.findByRole('checkbox', { name: 'Show archived' });
    await userEvent.click(screen.getByRole('link', { name: 'Event types' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Add an event type' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Town hall');
    expect(screen.getByLabelText('Code')).toHaveValue('TOWN_HALL');
    await userEvent.type(screen.getByLabelText('Emoji'), '🏛️');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body)))
      .toEqual({ code: 'TOWN_HALL', label: 'Town hall', emoji: '🏛️' });

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Code')).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Training day');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    expect(JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body)))
      .not.toHaveProperty('code');
  });

  it('restores an archived event', async () => {
    const stub = render([type()], [event({ status: 'archived' })]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }));

    await waitFor(() => expect(stub.calls.some((c) => c.url.includes('/e1/restore'))).toBe(true));
  });

  it('says what the server refused, and leaves the panel open to fix it', async () => {
    stubFetch({
      '/kpm/settings/events/types': { body: [type()] },
      '/kpm/settings/events': [
        { body: [] },
        {
          status: 400,
          body: {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'endsAt must be after startsAt.',
              requestId: 'r-1',
            },
          },
        },
      ],
      '/kpm/settings/publish-state': {
        body: { publishedVersion: 1, workingVersion: 1, hasUnpublishedChanges: false, publishedAt: null },
      },
    });
    renderWithSession(<EventsSettingsPage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff');
    await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01T09:00');
    await userEvent.type(screen.getByLabelText('Ends'), '2026-10-01T13:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add the event' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/endsAt must be after startsAt/);
    expect(screen.getByLabelText('Title')).toHaveValue('Kickoff');
  });

  it('P18.8-T13 AC-2 the events are one bordered list, a row each, the row’s actions one group with View feedback first', async () => {
    render([type()], [
      event(),
      event({ id: 'e3', code: 'LAST', title: 'Last month', phase: 'past' }),
    ]);
    await screen.findByText('Last month');

    const lists = screen.getAllByRole('list');
    expect(lists).toHaveLength(1);
    expect(lists[0]).toHaveClass('divide-y', 'divide-hairline');
    expect(within(lists[0]).getAllByRole('listitem')).toHaveLength(2);
    const past = screen.getByText('Last month').closest('li')!;
    const actions = within(past).getAllByRole('button').map((b) => b.textContent);
    expect(actions).toEqual(['View feedback', 'Edit', 'Archive']);
    expect(within(past).getByRole('button', { name: 'View feedback' }).parentElement)
      .toBe(within(past).getByRole('button', { name: 'Edit' }).parentElement);
  });

  it('P18.8-T13 AC-2 the toolbar: Show archived and the tab’s add button together, above the list, on both tabs', async () => {
    render([type()], [event()]);
    const toggle = await screen.findByRole('checkbox', { name: 'Show archived' });
    const add = screen.getByRole('button', { name: 'Add an event' });
    expect(toggle.closest('div')).toBe(add.parentElement);
    expect(add.compareDocumentPosition(screen.getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await userEvent.click(screen.getByRole('link', { name: 'Event types' }));
    const addType = await screen.findByRole('button', { name: 'Add an event type' });
    expect(screen.getByRole('checkbox', { name: 'Show archived' }).closest('div')).toBe(addType.parentElement);
    expect(screen.queryByRole('button', { name: 'Add an event' })).not.toBeInTheDocument();
  });

  it('hides archived rows until asked', async () => {
    render([type()], [event({ status: 'archived' })]);
    await screen.findByRole('checkbox', { name: 'Show archived' });

    expect(screen.queryByText('Kickoff 2026')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(await screen.findByText('Kickoff 2026')).toBeInTheDocument();
  });
});

/**
 * **The panel's times are the office's, whatever the browser's zone** (invariant §9, ADR-0016; the exit review).
 * The browser here is in Los Angeles, fifteen hours behind Jakarta in October: a field read or written in the
 * browser's own zone would be off by that much.
 */
describe('the office’s Events screen in a browser outside Jakarta', () => {
  const original = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'America/Los_Angeles'; });
  afterAll(() => { process.env.TZ = original; });
  afterEach(() => vi.unstubAllGlobals());

  it('P18.5-T5 AC-9 a typed time is read as Jakarta’s: 09:00 there is 02:00 UTC', async () => {
    expect(new Date('2026-10-01T09:00').toISOString()).toBe('2026-10-01T16:00:00.000Z');
    const stub = render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));
    await userEvent.type(screen.getByLabelText('Title'), 'Kickoff');
    await userEvent.type(screen.getByLabelText('Starts'), '2026-10-01T09:00');
    await userEvent.type(screen.getByLabelText('Ends'), '2026-10-01T13:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add the event' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'POST')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'POST')!.init.body));
    expect(sent.startsAt).toBe('2026-10-01T02:00:00.000Z');
    expect(sent.endsAt).toBe('2026-10-01T06:00:00.000Z');
  });

  it('P18.5-T5 AC-9 a stored instant is shown as Jakarta’s wall clock, and saved back unchanged when untouched', async () => {
    const stub = render([type()], [event({ startsAt: '2026-10-01T02:00:00.000Z', endsAt: '2026-10-01T06:00:00.000Z' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Starts')).toHaveValue('2026-10-01T09:00');
    expect(screen.getByLabelText('Ends')).toHaveValue('2026-10-01T13:00');
    await userEvent.clear(screen.getByLabelText('Ends'));
    await userEvent.type(screen.getByLabelText('Ends'), '2026-10-01T14:30');
    await userEvent.click(screen.getByRole('button', { name: 'Save the event' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const sent = JSON.parse(String(stub.calls.find((c) => c.init.method === 'PATCH')!.init.body));
    expect(sent.startsAt).toBe('2026-10-01T02:00:00.000Z');
    expect(sent.endsAt).toBe('2026-10-01T07:30:00.000Z');
  });
});

/**
 * **The events settings in order** (P18.97-T4 AC-8, ADR-0176 §8; the client's KPM Owner review of 2026-10-27, UI-030:
 * *"past events first, upcoming at the bottom"*): upcoming soonest first, then happening now, then past latest first —
 * the order the agents' Events list reads its sections in.
 */
describe('P18.97-T4 AC-8 the events settings: upcoming, then running, then past', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.97-T4 AC-8 lists upcoming soonest first, then happening now, then past latest first', async () => {
    render([type()], [
      event({ id: 'e1', code: 'BOOTCAMP', title: 'New Agent Bootcamp', phase: 'past', startsAt: '2026-09-08T02:00:00.000Z' }),
      event({ id: 'e2', code: 'AWARDS', title: 'Awards night', phase: 'past', startsAt: '2026-10-10T11:00:00.000Z' }),
      event({ id: 'e3', code: 'TOWNHALL', title: 'Town Hall', phase: 'running', startsAt: '2026-10-28T02:00:00.000Z' }),
      event({ id: 'e4', code: 'KICKOFF', title: 'Kickoff 2027', phase: 'upcoming', startsAt: '2027-01-08T02:00:00.000Z' }),
      event({ id: 'e5', code: 'LAUNCH', title: 'Product launch', phase: 'upcoming', startsAt: '2026-11-12T02:00:00.000Z' }),
    ]);
    await screen.findByText('Town Hall');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Product launch', 'Kickoff 2027', 'Town Hall', 'Awards night', 'New Agent Bootcamp',
    ]);
  });

  it('P18.97-T4 AC-8 keeps an archived event in its own phase’s place when archived ones are shown', async () => {
    render([type()], [
      event({ id: 'e1', code: 'OLD', title: 'Archived launch', phase: 'past', status: 'archived', startsAt: '2026-10-20T02:00:00.000Z' }),
      event({ id: 'e2', code: 'NEXT', title: 'Next training', phase: 'upcoming', startsAt: '2026-11-01T02:00:00.000Z' }),
      event({ id: 'e3', code: 'PAST', title: 'Older training', phase: 'past', startsAt: '2026-08-01T02:00:00.000Z' }),
    ]);
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Show archived' }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Next training', 'Archived launch', 'Older training',
    ]);
  });
});
