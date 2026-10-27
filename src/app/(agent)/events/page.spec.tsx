import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  BOOTCAMP, CAN_NONE, conflict, eventList, guestEvent, KICKOFF, notFound, PRODUCT_REFRESH, PRULINK, READ_ONLY_RINA,
  RINA_EVENTS, RINA_ME, serverError, SHELL_STUBS, TOWN_HALL,
} from '@test/events-fixtures';
import type { GuestEvent } from '@/lib/events';
import EventsLayout from './layout';
import EventsPage from './page';
import EventModalPage from './[eventId]/page';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/events' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;

/** The list alone, at `/events`. */
function list(routes: Routes = {}, me = RINA_ME) {
  nav.pathname = '/events';
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /events': { body: eventList() }, ...routes });
  renderInLayout(AgentLayout, <EventsLayout><EventsPage /></EventsLayout>, { me });
  return stub;
}

/** The modal over the list, at `/events/{id}`. */
function modal(event: GuestEvent, routes: Routes = {}, me = RINA_ME) {
  nav.pathname = `/events/${event.id}`;
  const stub = stubFetch({
    ...SHELL_STUBS,
    'GET /events': { body: eventList() },
    [`GET /events/${event.id}`]: { body: event },
    ...routes,
  });
  renderInLayout(AgentLayout, <EventsLayout><EventModalPage params={routeParams({ eventId: event.id })} /></EventsLayout>, { me });
  return stub;
}

const listReady = () => screen.findByRole('heading', { level: 3, name: 'Kickoff 2026' });
const dialog = (name: string) => screen.findByRole('dialog', { name });
const section = (name: string) => screen.getByRole('region', { name });
const titlesIn = (name: string) => within(section(name)).queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);
const card = (title: string) => screen.getByRole('heading', { level: 3, name: title }).closest<HTMLElement>('[data-event]')!;
const bodyOf = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));

describe('/events, KPM Events (P18.5-T5, T6)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.back.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the list, verbatim (T5 AC-4)', () => {
    it('P18.5-T5 AC-4 Event list is live in the nav, no pill, and current', async () => {
      list();
      await listReady();
      const item = screen.getByRole('link', { name: 'Event list' });
      expect(item).toHaveAttribute('href', '/events');
      expect(item).not.toHaveAttribute('aria-disabled');
      expect(item).toHaveAttribute('aria-current', 'page');
      expect(within(item).queryByText('Upcoming')).not.toBeInTheDocument();
    });

    it('P18.5-T5 AC-4 is titled and sub-titled as drawn, and reads the list once', async () => {
      const { calls } = list();
      await listReady();
      // P18.95-T9 AC-2: the nav item's words, *Event list*, where the prototype titled it *KPM Events*.
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Event List$/);
      expect(screen.getByText('Browse upcoming and past events from your KPM — join, and share feedback once they wrap up.'))
        .toBeInTheDocument();
      expect(calls.filter((c) => /\/events$/.test(c.url))).toHaveLength(1);
    });

    it('P18.5-T5 AC-4 the filter All · Upcoming · Past, the one on pressed and navy (ADR-0137 §2)', async () => {
      list();
      await listReady();
      const buttons = within(screen.getByRole('group', { name: 'Show events' })).getAllByRole('button');
      expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
        ['All', 'true'], ['Upcoming', 'false'], ['Past', 'false'],
      ]);
      expect(buttons[0]).toHaveClass('bg-navy', 'text-white');
      expect(buttons[0]).not.toHaveClass('bg-amber');
    });

    it('P18.5-T5 AC-4 Going, Upcoming and Past in their orders: soonest first, the past latest first', async () => {
      const later = guestEvent({ id: 'ev-later', title: 'Later one', startsAt: '2026-11-02T02:00:00.000Z', startsOn: '2026-11-02' });
      list({ 'GET /events': { body: eventList([later, ...RINA_EVENTS]) } });
      await listReady();
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Going', 'Upcoming', 'Past']);
      expect(titlesIn('Going')).toEqual(['Product refresh briefing']);
      expect(titlesIn('Upcoming')).toEqual(['Kickoff 2026', 'Later one']);
      expect(titlesIn('Past')).toEqual(['PRULink briefing', 'August Town Hall', 'New Agent Bootcamp']);
    });

    it('P18.5-T5 AC-4 a running event sits with the upcoming ones (F-42)', async () => {
      const huddle = guestEvent({ id: 'ev-huddle', title: "Leaders' huddle", phase: 'running', me: { rsvp: 'going', claimed: false, feedback: null } });
      list({ 'GET /events': { body: eventList([huddle, KICKOFF]) } });
      await listReady();
      expect(titlesIn('Going')).toEqual(["Leaders' huddle"]);
      expect(within(card("Leaders' huddle")).getByText('Going', { selector: '[data-pill]' })).toBeInTheDocument();
    });

    it('P18.5-T5 AC-4 Upcoming shows Going and Upcoming, Past only the past', async () => {
      list();
      await listReady();
      await userEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Going', 'Upcoming']);
      expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(screen.getByRole('button', { name: 'Past' }));
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Past']);
    });

    it('P18.5-T5 AC-4 the three empty rows, verbatim', async () => {
      list({ 'GET /events': { body: eventList([]) } });
      expect(await screen.findByText("You haven't joined any upcoming events yet.")).toBeInTheDocument();
      expect(screen.getByText('No upcoming events right now.')).toBeInTheDocument();
      expect(screen.getByText('No past events yet.')).toBeInTheDocument();
    });

    it('P18.5-T5 AC-4, P18.95-T10 AC-1 each card: the type’s icon, audience line, title, date and time, place ↗, blurb, pill, View event', async () => {
      list();
      await listReady();
      const refresh = card('Product refresh briefing');
      expect(within(refresh).getByText('Going', { selector: '[data-pill]' })).toBeInTheDocument();
      expect(within(refresh).getByText('Prudential Event | All agents')).toBeInTheDocument();
      expect(within(refresh).getByText(/15 Okt 2026, 14.00/)).toBeInTheDocument();
      const where = within(refresh).getByRole('link', { name: /Online — Zoom/ });
      expect(where).toHaveAttribute('href', 'https://zoom.us/j/1234567890');
      expect(where).toHaveAttribute('target', '_blank');
      expect(where).toHaveTextContent('↗');
      expect(within(refresh).getByText("ev-refresh's line.")).toBeInTheDocument();
      expect(within(refresh).getByRole('button', { name: 'View event' })).toBeInTheDocument();
      // The type's colour is the icon's, as the office set it.
      expect(refresh.querySelector('[style]')).toHaveStyle({ backgroundColor: '#2D9CDB' });
      // A place with no address is words, not a link.
      expect(within(card('Kickoff 2026')).queryByRole('link')).not.toBeInTheDocument();
      expect(within(card('Kickoff 2026')).getByText('KPM | All agents')).toBeInTheDocument();
    });

    it('P18.5-T5 AC-4, T6 AC-4 the five foot pills', async () => {
      list();
      await listReady();
      const pill = (title: string) => card(title).querySelector('[data-pill]')!.textContent;
      expect(pill('Product refresh briefing')).toBe('Going');
      expect(pill('Kickoff 2026')).toBe('Not joined');
      expect(pill('PRULink briefing')).toBe('Feedback pending');
      expect(pill('August Town Hall')).toBe("Didn't join");
      expect(pill('New Agent Bootcamp')).toBe('Feedback sent');
    });

    it('P18.95-T10 AC-1 one status per card: the pill, in words, and no poster tag saying it again', async () => {
      list();
      await listReady();
      for (const title of ['Product refresh briefing', 'Kickoff 2026', 'PRULink briefing', 'August Town Hall', 'New Agent Bootcamp']) {
        const c = card(title);
        expect(c.querySelectorAll('[data-pill]')).toHaveLength(1);
        expect(c.querySelector('[data-tag]')).toBeNull();
        // Never colour alone: the one status carries its words.
        expect(c.querySelector('[data-pill]')!.textContent!.trim()).not.toBe('');
      }
      expect(within(card('Kickoff 2026')).getAllByText(/not joined/i)).toHaveLength(1);
      expect(within(card('August Town Hall')).queryByText(/not joined/i)).not.toBeInTheDocument();
      expect(within(card('Product refresh briefing')).getAllByText(/^going$/i)).toHaveLength(1);
    });

    it('P18.95-T10 AC-1 the icon in place of the banner: the type’s emoji at 32px on its colour, hidden from a screen reader', async () => {
      list();
      await listReady();
      const kickoff = card('Kickoff 2026');
      const emoji = within(kickoff).getByText('🏆');
      expect(emoji).toHaveAttribute('aria-hidden', 'true');
      const icon = emoji.parentElement!;
      expect(icon).toHaveClass('h-8', 'w-8', 'shrink-0', 'rounded-md');
      expect(icon).toHaveStyle({ backgroundColor: '#27AE60' });
      // No 110px poster on any card.
      expect(document.querySelector('[data-event] .h-\\[110px\\]')).toBeNull();
      // The icon sits beside the audience line and the title, inside the card's body.
      expect(icon.parentElement).toContainElement(screen.getByRole('heading', { level: 3, name: 'Kickoff 2026' }));
      // A past event's icon keeps its veil.
      expect(within(card('August Town Hall')).getByText('📚').parentElement!.className).toMatch(/before:bg-navy/);
    });

    it('P18.95-T10 AC-1 an event with no colour or emoji: a navy icon and 📅', async () => {
      const plain = guestEvent({ id: 'ev-plain', title: 'Plain one', type: { code: 'X', label: 'X', emoji: null, color: null } });
      list({ 'GET /events': { body: eventList([plain]) } });
      const emoji = within(await screen.findByRole('heading', { level: 3, name: 'Plain one' }).then((h) => h.closest<HTMLElement>('[data-event]')!))
        .getByText('📅');
      expect(emoji.parentElement).toHaveClass('bg-navy', 'h-8', 'w-8');
    });

    it('P18.5-T5 AC-4 a past card is grey; an upcoming one is not', async () => {
      list();
      await listReady();
      expect(card('PRULink briefing')).toHaveClass('grayscale-[45%]');
      expect(card('Kickoff 2026')).not.toHaveClass('grayscale-[45%]');
    });

    it('P18.5-T5 AC-4 one column on a phone: the grid is one column until the md breakpoint', async () => {
      list();
      await listReady();
      const grid = within(section('Going')).getByRole('list');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid.className).toMatch(/md:grid-cols-\[repeat\(auto-fill,minmax\(280px,1fr\)\)\]/);
    });

    it('P18.5-T5 AC-3 the reader is never sent an invitee list, and the screen asks for none', async () => {
      const { calls } = list();
      await listReady();
      expect(calls.some((c) => c.url.includes('/kpm/settings/events'))).toBe(false);
    });

    it('P18.5-T5 AC-4 the card and View event both open the modal at its own address', async () => {
      list();
      await listReady();
      await userEvent.click(within(card('Kickoff 2026')).getByRole('button', { name: 'View event' }));
      expect(nav.push).toHaveBeenCalledWith('/events/ev-kickoff', { scroll: false });
      await userEvent.click(screen.getByRole('heading', { level: 3, name: 'August Town Hall' }));
      expect(nav.push).toHaveBeenLastCalledWith('/events/ev-townhall', { scroll: false });
    });

    it('P18.5-T5 contradiction 25: authored words are text, never markup', async () => {
      const evil = guestEvent({ id: 'ev-x', title: '<script>alert(1)</script>', blurb: '<img src=x onerror=alert(1)>' });
      list({ 'GET /events': { body: eventList([evil]) } });
      expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
      expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
      expect(document.querySelector('script, img[src="x"]')).toBeNull();
    });
  });

  describe('the list’s states (Fills, L-01)', () => {
    it('P18.5-T5 AC-4 a skeleton shaped like the cards while it loads', async () => {
      list({ 'GET /events': { body: eventList() } });
      expect((await screen.findByText('Loading events…')).closest('[role="status"]')).not.toBeNull();
      await listReady();
    });

    it('P18.5-T5 AC-4 an error with a retry that reads again', async () => {
      const { calls } = list({ 'GET /events': [serverError, { body: eventList() }] });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      await listReady();
      expect(calls.filter((c) => /\/events$/.test(c.url))).toHaveLength(2);
    });

    it('P18.5-T5 AC-1 a reader without event:read_list is not shown the list', async () => {
      const { calls } = list({}, { ...RINA_ME, permissions: [] });
      await waitFor(() => expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument());
      expect(calls.some((c) => /\/events$/.test(c.url))).toBe(false);
    });
  });

  describe('Join on the card (P18.95-T10 AC-1)', () => {
    const joinOn = (title: string) => within(card(title)).queryByRole('button', { name: `Join ${title}` });

    it('P18.95-T10 AC-1 Join is on a card the reader may join, and on no other', async () => {
      list();
      await listReady();
      expect(joinOn('Kickoff 2026')).toBeInTheDocument();
      // Going already, past, and past unjoined: the one status says so, and there is nothing to press.
      expect(joinOn('Product refresh briefing')).not.toBeInTheDocument();
      expect(joinOn('PRULink briefing')).not.toBeInTheDocument();
      expect(joinOn('August Town Hall')).not.toBeInTheDocument();
      expect(joinOn('New Agent Bootcamp')).not.toBeInTheDocument();
      // Its words are the client's Join, its name the event's too, beside View event.
      expect(joinOn('Kickoff 2026')).toHaveTextContent(/^Join$/);
      expect(within(card('Kickoff 2026')).getByRole('button', { name: 'View event' })).toBeInTheDocument();
    });

    it('P18.95-T10 AC-1 Join is the action button: amber, navy words (ADR-0137)', async () => {
      list();
      await listReady();
      expect(joinOn('Kickoff 2026')).toHaveClass('bg-amber', 'text-navy');
    });

    it('P18.95-T10 AC-1, P18.95-T1 AC-10 Join is a 44px target on a phone, 32px from 768px', async () => {
      list();
      await listReady();
      expect(joinOn('Kickoff 2026')).toHaveClass('h-8', 'max-md:min-h-11');
    });

    it('P18.95-T10 AC-1 a read-only support session is shown no Join on any card', async () => {
      list({ 'GET /events': { body: eventList(RINA_EVENTS, { can: CAN_NONE }) } }, READ_ONLY_RINA);
      await listReady();
      expect(screen.queryByRole('button', { name: /^Join/ })).not.toBeInTheDocument();
      expect(card('Kickoff 2026').querySelector('[data-pill]')).toHaveTextContent('Not joined');
    });

    it('P18.95-T10 AC-1 a running event the reader has not joined can be joined from its card', async () => {
      const huddle = guestEvent({ id: 'ev-huddle', title: "Leaders' huddle", phase: 'running' });
      list({ 'GET /events': { body: eventList([huddle, KICKOFF]) } });
      await listReady();
      expect(joinOn("Leaders' huddle")).toBeInTheDocument();
    });

    it('P18.95-T10 AC-1, P18.95-T1 AC-6 Join is the modal’s call: POST …/rsvp, "Joined ✓ — you\'re going to {title}", the card to Going', async () => {
      const going = { ...KICKOFF, me: { ...KICKOFF.me, rsvp: 'going' as const } };
      const { calls } = list({ 'POST /events/ev-kickoff/rsvp': { status: 201, body: going } });
      await listReady();
      await userEvent.click(joinOn('Kickoff 2026')!);
      expect(await screen.findByText("Joined ✓ — you're going to Kickoff 2026")).toBeInTheDocument();
      const post = calls.find((c) => c.url.endsWith('/events/ev-kickoff/rsvp'))!;
      expect(post.init.method).toBe('POST');
      expect(bodyOf(post)).toEqual({});
      await waitFor(() => expect(titlesIn('Going')).toContain('Kickoff 2026'));
      expect(card('Kickoff 2026').querySelector('[data-pill]')).toHaveTextContent('Going');
      expect(joinOn('Kickoff 2026')).not.toBeInTheDocument();
      // A press on Join is not a press on the card: the modal stays shut.
      expect(nav.push).not.toHaveBeenCalled();
      // The Join it was on is gone; the focus follows the card to its View event.
      await waitFor(() => expect(within(card('Kickoff 2026')).getByRole('button', { name: 'View event' })).toHaveFocus());
    });

    it('P18.95-T10 AC-1 a refusal is said under the card in the spec’s words, and the list read again: the card moves to Past', async () => {
      const ended = { ...KICKOFF, phase: 'past' as const, ended: true };
      const { calls } = list({
        'GET /events': [{ body: eventList() }, { body: eventList([PRODUCT_REFRESH, ended, PRULINK, TOWN_HALL, BOOTCAMP]) }],
        'POST /events/ev-kickoff/rsvp': conflict('EVENT_RSVP_CLOSED', 'This event has ended, so its RSVP is closed.'),
      });
      await listReady();
      await userEvent.click(joinOn('Kickoff 2026')!);
      const alert = await within(card('Kickoff 2026')).findByRole('alert');
      expect(alert).toHaveTextContent('This event has already ended.');
      expect(alert).toHaveTextContent('EVENT_RSVP_CLOSED');
      await waitFor(() => expect(titlesIn('Past')).toContain('Kickoff 2026'));
      expect(calls.filter((c) => /\/events$/.test(c.url))).toHaveLength(2);
      expect(card('Kickoff 2026').querySelector('[data-pill]')).toHaveTextContent("Didn't join");
      expect(joinOn('Kickoff 2026')).not.toBeInTheDocument();
      expect(screen.queryByText(/^Joined ✓/)).not.toBeInTheDocument();
      expect(nav.push).not.toHaveBeenCalled();
    });

    it('P18.95-T10 AC-1 another refusal is said and the list is not read again', async () => {
      const { calls } = list({ 'POST /events/ev-kickoff/rsvp': serverError });
      await listReady();
      await userEvent.click(joinOn('Kickoff 2026')!);
      expect(await within(card('Kickoff 2026')).findByRole('alert')).toHaveTextContent('Something went wrong.');
      expect(calls.filter((c) => /\/events$/.test(c.url))).toHaveLength(1);
      expect(joinOn('Kickoff 2026')).toBeInTheDocument();
    });
  });

  describe('the modal (T5 AC-5)', () => {
    it('P18.5-T5 AC-5 opens over the list at its address, named by the event, with the tag, audience, 📅, 📍 and description', async () => {
      modal(KICKOFF);
      const box = await dialog('Kickoff 2026');
      expect(within(box).getByText('Not Joined')).toBeInTheDocument();
      expect(within(box).getByText('KPM | All agents')).toBeInTheDocument();
      expect(within(box).getByText('24 Okt 2026', { selector: 'strong' })).toBeInTheDocument();
      expect(within(box).getByText(/, 18.00/)).toBeInTheDocument();
      expect(within(box).getByText('BSD City Branch')).toBeInTheDocument();
      expect(within(box).getByText('About ev-kickoff.')).toBeInTheDocument();
      expect(box).toHaveAttribute('aria-modal', 'true');
    });

    it('P18.5-T5 AC-5 the ✕ is named Close; Close, Escape and the scrim each close it', async () => {
      modal(KICKOFF);
      const box = await dialog('Kickoff 2026');
      await userEvent.click(within(box).getByRole('button', { name: 'Close' }));
      expect(nav.replace).toHaveBeenCalledWith('/events', { scroll: false });
      box.focus();
      await userEvent.keyboard('{Escape}');
      expect(nav.replace).toHaveBeenCalledTimes(2);
      await userEvent.click(document.querySelector<HTMLElement>('[data-scrim]')!);
      expect(nav.replace).toHaveBeenCalledTimes(3);
    });

    it('P18.5-T5 AC-5 the focus moves into the dialog and Tab stays inside it', async () => {
      modal(KICKOFF);
      const box = await dialog('Kickoff 2026');
      await waitFor(() => expect(box).toHaveFocus());
      const close = within(box).getByRole('button', { name: 'Close' });
      const join = within(box).getByRole('button', { name: 'Join event' });
      join.focus();
      await userEvent.tab();
      expect(close).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(join).toHaveFocus();
    });

    it('P18.5-T5 AC-5 the list behind the open modal takes no focus and no click', async () => {
      modal(KICKOFF);
      await dialog('Kickoff 2026');
      const behind = document.querySelector('[inert]');
      expect(behind).not.toBeNull();
      expect(behind).toContainElement(screen.getByRole('group', { name: 'Show events', hidden: true }));
    });

    it('P18.5-T5 AC-5, P18.95-T1 AC-6 Join event → "Joined ✓ — you\'re going to {title}", the card moves to Going', async () => {
      const going = { ...KICKOFF, me: { ...KICKOFF.me, rsvp: 'going' as const } };
      const { calls } = modal(KICKOFF, { 'POST /events/ev-kickoff/rsvp': { status: 201, body: going } });
      const box = await dialog('Kickoff 2026');
      await userEvent.click(within(box).getByRole('button', { name: 'Join event' }));
      expect(await screen.findByText("Joined ✓ — you're going to Kickoff 2026")).toBeInTheDocument();
      expect(within(box).getByText("You're going")).toBeInTheDocument();
      expect(within(box).getByRole('button', { name: 'Cancel RSVP' })).toBeInTheDocument();
      expect(within(box).queryByRole('button', { name: 'Join event' })).not.toBeInTheDocument();
      expect(calls.find((c) => c.url.endsWith('/events/ev-kickoff/rsvp'))!.init.method).toBe('POST');
      await waitFor(() => expect(titlesIn('Going')).toContain('Kickoff 2026'));
    });

    it('P18.5-T5 AC-5 Join event is the action button: amber, navy words (ADR-0137)', async () => {
      modal(KICKOFF);
      const join = within(await dialog('Kickoff 2026')).getByRole('button', { name: 'Join event' });
      expect(join).toHaveClass('bg-amber', 'text-navy');
    });

    it('P18.5-T5 AC-5 You\'re going + Cancel RSVP → "RSVP cancelled for {title}"', async () => {
      const cancelled = { ...PRODUCT_REFRESH, me: { ...PRODUCT_REFRESH.me, rsvp: 'cancelled' as const } };
      modal(PRODUCT_REFRESH, { 'POST /events/ev-refresh/rsvp/cancel': { status: 201, body: cancelled } });
      const box = await dialog('Product refresh briefing');
      expect(within(box).getByText("You're going")).toBeInTheDocument();
      await userEvent.click(within(box).getByRole('button', { name: 'Cancel RSVP' }));
      expect(await screen.findByText('RSVP cancelled for Product refresh briefing')).toBeInTheDocument();
      expect(within(box).getByRole('button', { name: 'Join event' })).toBeInTheDocument();
    });

    it('P18.5-T5 AC-5 a refusal from endsAt is said in the spec’s words beside the button, and the event read again', async () => {
      const ended = { ...KICKOFF, phase: 'past' as const, ended: true };
      const { calls } = modal(KICKOFF, {
        [`GET /events/${KICKOFF.id}`]: [{ body: KICKOFF }, { body: ended }],
        'POST /events/ev-kickoff/rsvp': conflict('EVENT_RSVP_CLOSED', 'This event has ended, so its RSVP is closed.'),
      });
      const box = await dialog('Kickoff 2026');
      await userEvent.click(within(box).getByRole('button', { name: 'Join event' }));
      const alert = await within(box).findByRole('alert');
      expect(alert).toHaveTextContent('This event has already ended.');
      expect(alert).toHaveTextContent('EVENT_RSVP_CLOSED');
      expect(alert).not.toHaveTextContent('its RSVP is closed');
      await within(box).findByText("You didn't join this event");
      expect(calls.filter((c) => c.url.endsWith('/events/ev-kickoff'))).toHaveLength(2);
    });

    it('P18.5-T5 AC-5 after a refusal the card behind takes the re-read: it moves to Past', async () => {
      const ended = { ...KICKOFF, phase: 'past' as const, ended: true };
      modal(KICKOFF, {
        [`GET /events/${KICKOFF.id}`]: [{ body: KICKOFF }, { body: ended }],
        'POST /events/ev-kickoff/rsvp': conflict('EVENT_RSVP_CLOSED', 'Closed.'),
      });
      const box = await dialog('Kickoff 2026');
      await screen.findByRole('heading', { level: 3, name: 'Kickoff 2026', hidden: true });
      await userEvent.click(within(box).getByRole('button', { name: 'Join event' }));
      await within(box).findByText("You didn't join this event");
      const pastTitles = () => within(screen.getByRole('region', { name: 'Past', hidden: true }))
        .queryAllByRole('heading', { level: 3, hidden: true }).map((h) => h.textContent);
      await waitFor(() => expect(pastTitles()).toContain('Kickoff 2026'));
      const behind = screen.getByRole('heading', { level: 3, name: 'Kickoff 2026', hidden: true }).closest('[data-event]')!;
      expect(behind.querySelector('[data-pill]')).toHaveTextContent("Didn't join");
    });

    it('P18.5-T5 AC-5 at 360px the toast is in front of the full-screen modal', async () => {
      const width = window.innerWidth;
      window.innerWidth = 360;
      window.dispatchEvent(new Event('resize'));
      try {
        const going = { ...KICKOFF, me: { ...KICKOFF.me, rsvp: 'going' as const } };
        modal(KICKOFF, { 'POST /events/ev-kickoff/rsvp': { status: 201, body: going } });
        const box = await dialog('Kickoff 2026');
        await userEvent.click(within(box).getByRole('button', { name: 'Join event' }));
        const toast = await screen.findByText("Joined ✓ — you're going to Kickoff 2026");
        const z = (el: Element | null) => Number(/(?:^|\s)z-(?:\[)?(\d+)/.exec(el?.className ?? '')?.[1] ?? 0);
        const toastLayer = toast.closest('[data-layer="toast"]');
        const modalLayer = box.closest('.fixed');
        expect(toastLayer).not.toBeNull();
        expect(box).not.toContainElement(toast);
        expect(z(toastLayer)).toBeGreaterThan(z(modalLayer));
        expect(z(toastLayer)).toBeGreaterThan(z(document.querySelector('[data-scrim]')));
        // Not under the list's `inert` either: it is announced and seen while the modal is open.
        expect(toast.closest('[inert]')).toBeNull();
      } finally {
        window.innerWidth = width;
      }
    });

    it('P18.5-T5 AC-5 not found: an event outside the reader’s audience, archived, or none', async () => {
      modal(KICKOFF, { [`GET /events/${KICKOFF.id}`]: notFound });
      expect(await screen.findByText('This event isn’t one you can open.')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Back to events' }));
      expect(nav.replace).toHaveBeenCalledWith('/events', { scroll: false });
    });

    it('P18.5-T5 AC-5 an error reading the event, with a retry', async () => {
      modal(KICKOFF, { [`GET /events/${KICKOFF.id}`]: [serverError, { body: KICKOFF }] });
      const box = await screen.findByRole('dialog', { name: 'Event List' });
      expect(await within(box).findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(within(box).getByRole('button', { name: 'Try again' }));
      expect(await dialog('Kickoff 2026')).toBeInTheDocument();
    });

    it('P18.5-T5 AC-1 a read-only support session reads the event and draws no write control', async () => {
      modal(PRODUCT_REFRESH, { 'GET /events': { body: eventList(RINA_EVENTS, { can: CAN_NONE }) } }, READ_ONLY_RINA);
      const box = await dialog('Product refresh briefing');
      expect(within(box).getByText("You're going")).toBeInTheDocument();
      expect(within(box).queryByRole('button', { name: 'Cancel RSVP' })).not.toBeInTheDocument();
      expect(within(box).queryByRole('button', { name: 'Join event' })).not.toBeInTheDocument();
    });
  });

  describe('a past event: the claim (T5 AC-6)', () => {
    it('P18.5-T5 AC-6 for a past event the reader did not join: the block, its sub-line, and the claim', async () => {
      modal(TOWN_HALL);
      const box = await dialog('August Town Hall');
      expect(within(box).getByText("You didn't join this event")).toBeInTheDocument();
      expect(within(box).getByText("Feedback is only collected from agents who attended, so there's nothing to fill out here."))
        .toBeInTheDocument();
      expect(within(box).queryByRole('button', { name: 'Join event' })).not.toBeInTheDocument();
    });

    it('P18.5-T5 AC-6 I actually attended this event writes the claim only, says so, and opens the form', async () => {
      const claimed = { ...TOWN_HALL, me: { ...TOWN_HALL.me, claimed: true } };
      const { calls } = modal(TOWN_HALL, { 'POST /events/ev-townhall/attendance/claim': { status: 201, body: claimed } });
      const box = await dialog('August Town Hall');
      await userEvent.click(within(box).getByRole('button', { name: 'I actually attended this event' }));
      expect(await screen.findByText('Marked as attended — you can now leave feedback')).toBeInTheDocument();
      expect(within(box).getByRole('heading', { name: 'How likely are you to recommend this event to your colleagues?' }))
        .toBeInTheDocument();
      const claim = calls.find((c) => c.url.endsWith('/attendance/claim'))!;
      expect(claim.init.method).toBe('POST');
      expect(bodyOf(claim)).toEqual({});
      // Nothing the reader sees says whether anybody confirmed them (OD-31, D-status).
      expect(box).not.toHaveTextContent(/confirm/i);
    });

    it('P18.5-T5 AC-6 a claim before the end (409 EVENT_NOT_ENDED) is said in the spec’s words, and the event read again', async () => {
      const { calls } = modal(TOWN_HALL, {
        'POST /events/ev-townhall/attendance/claim': conflict('EVENT_NOT_ENDED', 'This event has not ended yet.'),
      });
      const box = await dialog('August Town Hall');
      await userEvent.click(within(box).getByRole('button', { name: 'I actually attended this event' }));
      expect(await within(box).findByRole('alert')).toHaveTextContent('This event hasn’t ended yet.');
      await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/events/ev-townhall'))).toHaveLength(2));
    });

    it('P18.5-T5 AC-1 a read-only support session reads the block with no claim', async () => {
      modal(TOWN_HALL, { 'GET /events': { body: eventList(RINA_EVENTS, { can: CAN_NONE }) } }, READ_ONLY_RINA);
      const box = await dialog('August Town Hall');
      expect(within(box).getByText("You didn't join this event")).toBeInTheDocument();
      expect(within(box).queryByRole('button', { name: 'I actually attended this event' })).not.toBeInTheDocument();
    });
  });

  describe('a past event: feedback (T6)', () => {
    it('P18.5-T6 AC-2 the form verbatim: question, hint, eleven scores as a radio group, ends, two labelled fields', async () => {
      modal(PRULINK);
      const box = await dialog('PRULink briefing');
      expect(within(box).getByText('This is the last step for this event — your feedback helps shape future ones.')).toBeInTheDocument();
      const group = within(box).getByRole('radiogroup', { name: 'How likely are you to recommend this event to your colleagues?' });
      expect(within(group).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(
        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
      );
      expect(group).toHaveAccessibleDescription('0 — Not at all likely 10 — Extremely likely');
      const why = within(box).getByLabelText('Why? (optional)');
      expect(why).toHaveAttribute('placeholder', 'What stood out, good or bad?');
      expect(why).toHaveAttribute('maxLength', '1000');
      expect(within(box).getByLabelText('How can we improve? (optional)')).toHaveAttribute('placeholder', 'Any suggestions for next time?');
      expect(within(box).getByRole('button', { name: 'Submit feedback' })).toHaveClass('bg-amber');
    });

    it('P18.5-T6 AC-2 the chosen score is checked and navy', async () => {
      modal(PRULINK);
      const box = await dialog('PRULink briefing');
      await userEvent.click(within(box).getByRole('radio', { name: '8' }));
      expect(within(box).getByRole('radio', { name: '8' })).toBeChecked();
      expect(within(box).getByText('8', { selector: 'span' })).toHaveClass('bg-navy', 'text-white');
      expect(within(box).getByText('7', { selector: 'span' })).not.toHaveClass('bg-navy');
    });

    it('P18.5-T6 AC-2 without a score: "Pick a score from 0–10 first", and nothing is sent', async () => {
      const { calls } = modal(PRULINK);
      const box = await dialog('PRULink briefing');
      await userEvent.click(within(box).getByRole('button', { name: 'Submit feedback' }));
      expect(await screen.findByText('Pick a score from 0–10 first')).toBeInTheDocument();
      expect(calls.some((c) => c.url.endsWith('/feedback'))).toBe(false);
    });

    it('P18.5-T6 AC-2, AC-3 submits the score, the why and the improve; says thanks; the card reads Feedback sent', async () => {
      const answered = {
        ...PRULINK,
        me: { ...PRULINK.me, feedback: { score: 8, why: 'Clear.', improve: 'Shorter.', submittedAt: '2026-10-10T03:00:00.000Z' } },
      };
      const { calls } = modal(PRULINK, { 'POST /events/ev-prulink/feedback': { status: 201, body: answered } });
      const box = await dialog('PRULink briefing');
      await userEvent.click(within(box).getByRole('radio', { name: '8' }));
      await userEvent.type(within(box).getByLabelText('Why? (optional)'), 'Clear.');
      await userEvent.type(within(box).getByLabelText('How can we improve? (optional)'), 'Shorter.');
      await userEvent.click(within(box).getByRole('button', { name: 'Submit feedback' }));
      expect(await screen.findByText('Feedback submitted — thank you!')).toBeInTheDocument();
      expect(bodyOf(calls.find((c) => c.url.endsWith('/feedback'))!)).toEqual({ score: 8, why: 'Clear.', improve: 'Shorter.' });
      expect(within(box).getByText('Thanks for your feedback')).toBeInTheDocument();
      expect(within(box).getByText('You scored this event 8/10 — "Clear."')).toBeInTheDocument();
      await waitFor(() => expect(card('PRULink briefing').querySelector('[data-pill]')).toHaveTextContent('Feedback sent'));
    });

    it('P18.5-T6 AC-3 leaves the optional fields out when empty', async () => {
      const answered = { ...PRULINK, me: { ...PRULINK.me, feedback: { score: 3, why: '', improve: '', submittedAt: '2026-10-10T03:00:00.000Z' } } };
      const { calls } = modal(PRULINK, { 'POST /events/ev-prulink/feedback': { status: 201, body: answered } });
      const box = await dialog('PRULink briefing');
      await userEvent.click(within(box).getByRole('radio', { name: '3' }));
      await userEvent.type(within(box).getByLabelText('Why? (optional)'), '   ');
      await userEvent.click(within(box).getByRole('button', { name: 'Submit feedback' }));
      await within(box).findByText('Thanks for your feedback');
      expect(bodyOf(calls.find((c) => c.url.endsWith('/feedback'))!)).toEqual({ score: 3 });
      expect(within(box).getByText('You scored this event 3/10')).toBeInTheDocument();
    });

    it('P18.5-T6 AC-3 an answer already sent (409) brings back the thanks, read again', async () => {
      const answered = {
        ...PRULINK, me: { ...PRULINK.me, feedback: { score: 7, why: 'Sent from my phone.', improve: '', submittedAt: '2026-10-10T03:00:00.000Z' } },
      };
      const { calls } = modal(PRULINK, {
        [`GET /events/${PRULINK.id}`]: [{ body: PRULINK }, { body: answered }],
        'POST /events/ev-prulink/feedback': conflict('EVENT_FEEDBACK_ALREADY_SUBMITTED', 'You have already given feedback for this event.'),
      });
      const box = await dialog('PRULink briefing');
      await userEvent.click(within(box).getByRole('radio', { name: '9' }));
      await userEvent.click(within(box).getByRole('button', { name: 'Submit feedback' }));
      expect(await within(box).findByText('You scored this event 7/10 — "Sent from my phone."')).toBeInTheDocument();
      expect(calls.filter((c) => c.url.endsWith('/events/ev-prulink'))).toHaveLength(2);
      await waitFor(() => expect(card('PRULink briefing').querySelector('[data-pill]')).toHaveTextContent('Feedback sent'));
    });

    it('P18.5-T6 AC-4 thanks: the stored score and why, as text', async () => {
      const evil = { ...BOOTCAMP, me: { ...BOOTCAMP.me, feedback: { ...BOOTCAMP.me.feedback!, why: '<script>alert(1)</script>' } } };
      modal(evil);
      const box = await dialog('New Agent Bootcamp');
      expect(within(box).getByText('Thanks for your feedback')).toBeInTheDocument();
      expect(within(box).getByText('You scored this event 9/10 — "<script>alert(1)</script>"')).toBeInTheDocument();
      expect(box.querySelector('script')).toBeNull();
      expect(within(box).queryByRole('radiogroup')).not.toBeInTheDocument();
    });

    it('P18.5-T6 AC-2 the scale’s ends and the text bound are the served ones, never written on the screen', async () => {
      modal(PRULINK, {
        'GET /events': { body: eventList(RINA_EVENTS, { limits: { feedbackTextMax: 500, nps: { scaleMin: 0, scaleMax: 5, promoterMin: 5, detractorMax: 3 } } }) },
      });
      const box = await dialog('PRULink briefing');
      expect(within(box).getAllByRole('radio')).toHaveLength(6);
      expect(within(box).getByText('5 — Extremely likely')).toBeInTheDocument();
      expect(within(box).getByLabelText('Why? (optional)')).toHaveAttribute('maxLength', '500');
    });

    it('P18.5-T6 AC-2 a read-only support session is shown no form at all: no write control', async () => {
      modal(PRULINK, { 'GET /events': { body: eventList(RINA_EVENTS, { can: CAN_NONE }) } }, READ_ONLY_RINA);
      const box = await dialog('PRULink briefing');
      expect(within(box).getByText('About ev-prulink.')).toBeInTheDocument();
      expect(within(box).queryByRole('radiogroup')).not.toBeInTheDocument();
      expect(within(box).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(box).queryByRole('button', { name: 'Submit feedback' })).not.toBeInTheDocument();
      expect(box.querySelector('hr')).toBeNull();
      expect(within(box).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close']);
    });

    it('P18.5-T6 AC-4 a read-only support session still reads the thanks', async () => {
      modal(BOOTCAMP, { 'GET /events': { body: eventList(RINA_EVENTS, { can: CAN_NONE }) } }, READ_ONLY_RINA);
      const box = await dialog('New Agent Bootcamp');
      expect(within(box).getByText('You scored this event 9/10 — "Clear and practical."')).toBeInTheDocument();
    });
  });
});
