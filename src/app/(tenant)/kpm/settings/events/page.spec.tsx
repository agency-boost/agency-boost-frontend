import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import EventsSettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/settings/events',
}));

const member = {
  membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab' as const,
  status: 'active' as const, isKpmOwner: true, isKpmAdmin: false, directCount: 0,
};
const OWNER = makeMe({ membership: member, permissions: ['tenant_config:read', 'tenant_config:write'] });
const READER = makeMe({ membership: member, permissions: ['tenant_config:read'] });

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

    expect(await screen.findByText(/2026-10-02/)).toBeInTheDocument();
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

  it('shows the chosen-people options as coming soon, and will not let either be picked', async () => {
    // The roster picker that chooses invitees is not built. Offering a "chosen people" event with
    // no way to choose them would be a control that cannot work, so both options are shown disabled
    // and marked, as the client asked of everything not built (2026-10-01). The mark is the
    // prototype's *coming soon* (`Overall.html:3773`): *Upcoming* on this screen is an event's status.
    // No sentence names a phase in their place.
    render([type()], []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add an event' }));

    const scope = screen.getByLabelText('Who is invited');
    const option = (name: string) => within(scope).getByRole('option', { name });
    expect(option('Chosen people — coming soon')).toBeDisabled();
    expect(option('Chosen leaders — coming soon')).toBeDisabled();
    expect(within(scope).queryByRole('option', { name: /upcoming/i })).not.toBeInTheDocument();
    expect(option('Everybody in the office')).toBeEnabled();
    expect(option('Leaders — anybody with somebody under them')).toBeEnabled();

    // A disabled option cannot be chosen: user-event skips it, as a browser does.
    await userEvent.selectOptions(scope, 'select_agents');
    expect(scope).toHaveValue('all_agents');
    expect(document.body).not.toHaveTextContent(/roster picker|phase \d/i);
  });

  it('keeps an event the API saved with a chosen list readable, and unsaveable here', async () => {
    // Only the API can make one. The list reads its plain label; the edit panel cannot send the
    // invitee list, so Save waits until a scope it can send is picked.
    render([type()], [event({
      audience: { issuer: 'kpm', scope: 'select_agents', inviteeMembershipIds: ['mem-2', 'mem-3'] },
    })]);

    expect(await screen.findByText(/Chosen people · 2 invited/)).toBeInTheDocument();
    expect(screen.queryByText(/Chosen people — coming soon ·/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const scope = screen.getByLabelText('Who is invited');
    expect(scope).toHaveValue('select_agents');
    expect(screen.getByRole('button', { name: 'Save the event' })).toBeDisabled();
    // The disabled Save carries its reason, on the field's own hint line, linked to the select.
    const why = 'Pick Everybody or Leaders to save — a chosen list can’t be edited here yet.';
    expect(scope).toHaveAccessibleDescription(why);
    expect(screen.queryByText('A leader is somebody with people under them — not a job title.')).not.toBeInTheDocument();

    await userEvent.selectOptions(scope, 'all_agents');
    expect(screen.getByRole('button', { name: 'Save the event' })).toBeEnabled();
    // Once a scope this screen can send is picked, the reason goes and the field's usual hint is back.
    expect(screen.queryByText(why)).not.toBeInTheDocument();
    expect(scope).toHaveAccessibleDescription('A leader is somebody with people under them — not a job title.');
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

  it('hides archived rows until asked', async () => {
    render([type()], [event({ status: 'archived' })]);
    await screen.findByRole('checkbox', { name: 'Show archived' });

    expect(screen.queryByText('Kickoff 2026')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show archived' }));
    expect(await screen.findByText('Kickoff 2026')).toBeInTheDocument();
  });
});
