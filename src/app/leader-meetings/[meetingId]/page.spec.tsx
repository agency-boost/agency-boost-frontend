import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import LeaderMeetingPage from './page';
import {
  CORE_LEADER_CAN, CORE_LEADER_ME, editors, FIELD_ME, LINK_CAN, MAYA, meetingView, notFound, OWNER_ME, refusal,
  SHELL_STUBS, WILSON, AGUS, SARI, YOSEF,
} from '../forum-fixtures';
import type { MeetingView } from '@/lib/leader-meetings';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings/m-14' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const page = (meetingId = 'm-14') => <LeaderMeetingPage params={routeParams({ meetingId })} />;

function open(meeting: MeetingView = meetingView(), routes: Record<string, StubReply | StubReply[]> = {}, me = OWNER_ME) {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': { body: meeting }, ...routes });
  const rendered = renderWithSession(page(), { me });
  return { ...stub, ...rendered };
}

const head = () => within(screen.getByRole('region', { name: /Strategic Check-in/ }));
const toast = () => screen.getAllByRole('status').find((el) => el.getAttribute('aria-live') === 'polite')!;
const writes = (calls: { url: string; init: RequestInit }[]) => calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');

describe('/leader-meetings/[meetingId] — a meeting (P18.1-T2, P18.1-T3)', () => {
  beforeEach(() => { nav.push.mockReset(); nav.replace.mockReset(); });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('the head (P18.1-T2 AC-3)', () => {
    it('P18.1-T2 AC-3: ← Back, the title, the date and state, the cadence note, Share · Save as PDF · Save', async () => {
      open();
      expect(await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' })).toBeInTheDocument();
      // Opening a meeting changes neither the page's title nor its line (flow doc §2.1).
      expect(screen.getByRole('heading', { level: 1, name: 'Strategic Leader Forum' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '← Back to all meetings' })).toHaveAttribute('href', '/leader-meetings');
      expect(head().getByText(/· Upcoming$/)).toBeInTheDocument();
      expect(head().getByText('Recommended: every 2 weeks · 60–90 mins')).toBeInTheDocument();
      const buttons = ['Share', 'Save as PDF', 'Save'].map((name) => head().getByRole('button', { name }));
      // *Save* is an action, so amber with navy words; *Share* and *Save as PDF* keep their navy outline (ADR-0137).
      expect(buttons[2]).toHaveClass('bg-amber', 'text-navy');
      expect(buttons[2]).not.toHaveClass('bg-navy');
      for (const outlined of buttons.slice(0, 2)) expect(outlined).toHaveClass('border-navy', 'text-navy');
    });

    it('P18.1-T2 AC-3: the date is a button for whoever may move the meeting, named for what it does (ADR-0130 §4)', async () => {
      open();
      const date = await screen.findByRole('button', { name: 'Change the date of Strategic Check-in — #14, 13 Okt 2026' });
      expect(date).toHaveTextContent('13 Okt 2026');
    });

    it('P18.1-T2 AC-3, P18.97-T2 AC-3: Can edit these minutes — the Owner first, then the Admins, then the Core Leaders, "(You)" after the reader', async () => {
      open();
      const label = await screen.findByText('Can edit these minutes');
      expect(screen.queryByText(/\bMOM\b/)).toBeNull();
      const chips = within(screen.getByRole('list', { name: 'Can edit these minutes' })).getAllByRole('listitem');
      expect(label).toBeInTheDocument();
      expect(chips.map((c) => c.textContent)).toEqual([
        'WTWilson Tanoto (You) · AB', 'MHMaya Halim · AAB', 'ASAgus Santoso · AB', 'SDSari Dewanti · AAB', 'YPYosef Pratama · AB',
      ]);
      // The Owner's avatar is amber (`:659`).
      expect(chips[0].querySelector('[aria-hidden="true"]')).toHaveClass('bg-amber');
      expect(chips[1].querySelector('[aria-hidden="true"]')).toHaveClass('bg-navy-soft');
      expect(screen.getByRole('link', { name: 'Manage tags →' })).toHaveAttribute('href', '/people/members');
    });

    it('P18.1-T2 AC-3: the three tabs, Overview & Stats first and selected; arrows move between them', async () => {
      open();
      const tabs = within(await screen.findByRole('tablist', { name: 'Strategic Check-in — #14' })).getAllByRole('tab');
      expect(tabs.map((t) => t.textContent)).toEqual(['Overview & Stats', 'Agenda', 'Action Items']);
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Overview & Stats');

      await userEvent.click(tabs[2]);
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Action Items');

      tabs[2].focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(tabs[0]).toHaveFocus();
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      await userEvent.keyboard('{End}');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    });

    it('all three panels stay mounted, the two not selected hidden, so a tab’s writes in flight survive a switch', async () => {
      const { container } = open();
      const tabs = within(await screen.findByRole('tablist')).getAllByRole('tab');
      const panels = [...container.querySelectorAll('[role="tabpanel"]')];
      expect(panels).toHaveLength(3);
      expect(panels.map((p) => p.hasAttribute('hidden'))).toEqual([false, true, true]);
      tabs.forEach((tab, i) => {
        expect(tab).toHaveAttribute('aria-controls', panels[i].id);
        expect(panels[i]).toHaveAttribute('aria-labelledby', tab.id);
      });

      await userEvent.click(tabs[1]);
      expect(panels.map((p) => p.hasAttribute('hidden'))).toEqual([true, false, true]);
      // The same elements: nothing was unmounted by the switch.
      expect([...container.querySelectorAll('[role="tabpanel"]')]).toEqual(panels);
      expect(screen.getAllByRole('tabpanel')).toEqual([panels[1]]);
    });

    it('P18.1-T2 AC-1: a Core Leader edits and shares, with no date control and no Manage tags →, in their own shell', async () => {
      open(meetingView({ can: CORE_LEADER_CAN, editors: editors({ coreLeaders: [{ ...AGUS, isReader: true }, SARI, YOSEF] }) }), {}, CORE_LEADER_ME);
      await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });
      expect(head().queryByRole('button', { name: /Change the date/ })).not.toBeInTheDocument();
      expect(head().getByText('13 Okt 2026 · Upcoming')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Manage tags →' })).not.toBeInTheDocument();
      for (const name of ['Share', 'Save as PDF', 'Save']) expect(head().getByRole('button', { name })).toBeInTheDocument();
      expect(screen.getByText('Agus Santoso (You) · AB')).toBeInTheDocument();
      expect(screen.queryByText('KPM OWNER')).not.toBeInTheDocument();
    });

    it('P18.1-T2 AC-1: a read-only support session draws no write control — only Save as PDF', async () => {
      open(meetingView({ can: LINK_CAN }));
      await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });
      expect(head().getByRole('button', { name: 'Save as PDF' })).toBeInTheDocument();
      for (const name of ['Share', 'Save', /Change the date/]) {
        expect(head().queryByRole('button', { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('link', { name: 'Manage tags →' })).not.toBeInTheDocument();
    });

    it('P18.1-T2 AC-3: a past meeting shows its frozen editors and reads Completed', async () => {
      open(meetingView({
        state: 'completed', date: '2026-09-26', title: 'Strategic Check-in — #13',
        editors: editors({ owner: { ...WILSON, isReader: true }, coreLeaders: [AGUS, SARI], coreLeaderCount: 2, frozen: true }),
        can: { ...meetingView().can, reschedule: false, delete: false },
      }));
      await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #13' });
      expect(head().getByText('26 Sep 2026 · Completed')).toBeInTheDocument();
      expect(within(screen.getByRole('list', { name: 'Can edit these minutes' })).getAllByRole('listitem')).toHaveLength(4);
    });
  });

  describe('saving (P18.1-T2 AC-7)', () => {
    it('P18.1-T2 AC-7: Save waits for every write and says All changes saved', async () => {
      const { calls } = open();
      await userEvent.click(await screen.findByRole('button', { name: 'Save' }));
      await waitFor(() => expect(toast()).toHaveTextContent('All changes saved'));
      // Save itself writes nothing: there was nothing in flight.
      expect(writes(calls)).toEqual([]);
    });
  });

  describe('the meeting dialog (OD-145, I-254)', () => {
    it('P18.1-T2 AC-2: Meeting details moves the date, sending only what changed with the head’s version, then reads the meeting again', async () => {
      const moved = meetingView({ date: '2026-10-20', version: 4 });
      const { calls } = open(meetingView(), {
        'GET /leader-meetings/m-14': [{ body: meetingView() }, { body: moved }],
        'PATCH /leader-meetings/m-14': { body: { ...moved } },
      });
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('Strategic Check-in — #14');
      const date = dialog.getByLabelText('Date');
      expect(date).toHaveValue('2026-10-13');
      await userEvent.clear(date);
      await userEvent.type(date, '2026-10-20');
      await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const patch = writes(calls).find((c) => c.init.method === 'PATCH')!;
      expect(JSON.parse(String(patch.init.body))).toEqual({ date: '2026-10-20', version: 3 });
      expect(await head().findByRole('button', { name: /20 Okt 2026$/ })).toBeInTheDocument();
    });

    it('P18.1-T2 AC-9: a move refused once the meeting has taken place says so under the date', async () => {
      open(meetingView(), {
        'PATCH /leader-meetings/m-14': refusal(409, 'LEADER_MEETING_COMPLETED', 'This meeting is completed.'),
      });
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      await userEvent.clear(dialog.getByLabelText('Date'));
      await userEvent.type(dialog.getByLabelText('Date'), '2026-10-20');
      await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
      expect(await dialog.findByText('This meeting has already taken place, so its date stays.')).toBeInTheDocument();
      expect(dialog.getByLabelText('Date')).toHaveAccessibleDescription('This meeting has already taken place, so its date stays.');
    });

    it('P18.1-T2 AC-7: a move against a head changed since it was read reads it again and says so', async () => {
      const theirs = meetingView({ title: 'Renamed by Maya', version: 5 });
      open(meetingView(), {
        'GET /leader-meetings/m-14': [{ body: meetingView() }, { body: theirs }],
        'PATCH /leader-meetings/m-14': refusal(409, 'VERSION_CONFLICT', 'Changed since read.'),
      });
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      await userEvent.type(dialog.getByRole('textbox', { name: 'Title' }), '!');
      await userEvent.click(dialog.getByRole('button', { name: 'Save changes' }));
      expect(await dialog.findByText('Someone else changed this while you were editing. It now shows what they saved.')).toBeInTheDocument();
      await waitFor(() => expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveValue('Renamed by Maya'));
    });

    it('P18.1-T2 AC-2: a meeting nobody has written in can be deleted, asked first in the dialog; Keep it goes back', async () => {
      const { calls } = open(meetingView({ writtenIn: false, can: { ...meetingView().can, delete: true } }), {
        'DELETE /leader-meetings/m-14': { status: 204 },
      });
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      await userEvent.click(dialog.getByRole('button', { name: 'Delete meeting' }));
      expect(dialog.getByText("Delete “Strategic Check-in — #14”? Nothing has been written in it yet, and it can't be brought back."))
        .toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Keep it' })).toHaveFocus();
      await userEvent.click(dialog.getByRole('button', { name: 'Keep it' }));
      expect(dialog.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
      expect(writes(calls)).toEqual([]);

      await userEvent.click(dialog.getByRole('button', { name: 'Delete meeting' }));
      await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/leader-meetings'));
      expect(writes(calls)[0].url).toMatch(/\/leader-meetings\/m-14\?version=3$/);
    });

    it('P18.1-T2 AC-9: a delete refused because something was written says so; a written meeting offers no delete', async () => {
      open(meetingView({ writtenIn: false, can: { ...meetingView().can, delete: true } }), {
        'DELETE /leader-meetings/m-14': refusal(409, 'LEADER_MEETING_HAS_MINUTES', 'Has minutes.'),
      });
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      await userEvent.click(dialog.getByRole('button', { name: 'Delete meeting' }));
      await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
      expect(await dialog.findByText("Something has been written in this meeting, so it can't be deleted.")).toBeInTheDocument();
      expect(nav.replace).not.toHaveBeenCalled();
    });

    it('a past meeting nobody wrote in: its date stays (read-only), and Delete meeting is still offered', async () => {
      open(meetingView({ state: 'completed', writtenIn: false, can: { ...meetingView().can, reschedule: false, delete: true } }));
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      expect(dialog.getByLabelText('Date')).toHaveAttribute('readonly');
      expect(dialog.getByRole('textbox', { name: 'Title' })).toHaveAttribute('readonly');
      expect(dialog.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Delete meeting' })).toBeInTheDocument();
    });

    it('a written meeting that is upcoming may be moved but offers no delete', async () => {
      open();
      await userEvent.click(await screen.findByRole('button', { name: /^Change the date of/ }));
      const dialog = within(screen.getByRole('dialog', { name: 'Meeting details' }));
      expect(dialog.queryByRole('button', { name: 'Delete meeting' })).not.toBeInTheDocument();
      expect(dialog.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    });
  });

  describe('Share these minutes (P18.1-T3, I-256; P18.97-T2 AC-3)', () => {
    const link = { token: 'tok_abc-123', expiresAt: '2026-10-23T18:00:00.000Z' };

    it('P18.1-T3 AC-1: each opening makes a fresh link, shows its address read-only and the hint, dated in Jakarta', async () => {
      const { calls } = open(meetingView(), {
        'POST /leader-meetings/m-14/share-links': [{ status: 201, body: link }, { status: 201, body: { ...link, token: 'tok_second' } }],
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      const dialog = within(screen.getByRole('dialog', { name: 'Share these minutes' }));
      const field = await dialog.findByRole('textbox', { name: 'Share these minutes' });
      expect(field).toHaveValue(`${window.location.origin}/leader-meetings/shared/tok_abc-123`);
      expect(field).toHaveAttribute('readonly');
      // 18:00 UTC on the 23rd is the 24th in Jakarta.
      expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
        "Anyone signed in to AgencyBoost at BSD City Branch can open this meeting's minutes with this link, read-only, until 24 Okt 2026.",
      );

      await userEvent.click(dialog.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Share' }));
      expect(await screen.findByDisplayValue(`${window.location.origin}/leader-meetings/shared/tok_second`)).toBeInTheDocument();
      expect(writes(calls).filter((c) => c.init.method === 'POST')).toHaveLength(2);
    });

    it('P18.1-T3 AC-1, P18.95-T1 AC-6: Copy link says "Link copied ✓"', async () => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      open(meetingView(), { 'POST /leader-meetings/m-14/share-links': { status: 201, body: link } });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/leader-meetings/shared/tok_abc-123`);
      await waitFor(() => expect(toast()).toHaveTextContent('Link copied ✓'));
    });

    it('P18.1-T3 AC-1: Stop sharing stops every live link and says "Sharing stopped"', async () => {
      const { calls } = open(meetingView(), {
        'POST /leader-meetings/m-14/share-links': { status: 201, body: link },
        'DELETE /leader-meetings/m-14/share-links': { body: { revoked: 2 } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      await screen.findByRole('button', { name: 'Copy link' });
      await userEvent.click(screen.getByRole('button', { name: 'Stop sharing' }));
      await waitFor(() => expect(toast()).toHaveTextContent('Sharing stopped'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls).some((c) => c.init.method === 'DELETE' && c.url.endsWith('/leader-meetings/m-14/share-links'))).toBe(true);
    });

    it('a link that could not be made says so, and Try again makes one', async () => {
      open(meetingView(), {
        'POST /leader-meetings/m-14/share-links': [refusal(500, 'INTERNAL_ERROR'), { status: 201, body: link }],
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      expect(await screen.findByText("Couldn't make a link. Try again.")).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    });
  });

  describe('Save as PDF (P18.1-T3 AC-4)', () => {
    it('P18.1-T3 AC-4: says the prototype’s line, then prints under the meeting’s name, and writes nothing', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const { calls } = open();
      const button = await screen.findByRole('button', { name: 'Save as PDF' });
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await userEvent.click(button);
      expect(toast()).toHaveTextContent('Preparing PDF — use your browser’s print dialog to save');
      expect(print).not.toHaveBeenCalled();
      let titled = '';
      print.mockImplementation(() => { titled = document.title; });
      act(() => { vi.advanceTimersByTime(400); });
      expect(print).toHaveBeenCalledTimes(1);
      expect(titled).toBe('Strategic Check-in — #14 – 13 Okt 2026');
      expect(writes(calls)).toEqual([]);
    });

    it('P18.1-T3 AC-4: the screen’s chrome is hidden in print as `:756-765` hides it', async () => {
      open();
      await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });
      expect(screen.getByRole('link', { name: '← Back to all meetings' })).toHaveClass('print:hidden');
      expect(screen.getByRole('tablist').closest('.print\\:hidden')).toContainElement(screen.getByRole('tabpanel'));
      expect(head().getByText('Recommended: every 2 weeks · 60–90 mins').parentElement).toHaveClass('print:hidden');
      expect(screen.getByRole('link', { name: 'Manage tags →' })).toHaveClass('print:hidden');
      // The head itself prints: the title, the date and who can edit, as the prototype prints them.
      expect(screen.getByRole('region', { name: /Strategic Check-in/ })).not.toHaveClass('print:hidden');
    });
  });

  describe('states (L-110)', () => {
    it('the wait is a skeleton of the head and a tab, named', () => {
      stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': () => new Promise(() => undefined) as never });
      renderWithSession(page(), { me: OWNER_ME });
      expect(screen.getByRole('status')).toHaveTextContent('Loading the meeting…');
    });

    it('an error is the banner with Try again', async () => {
      open(meetingView(), { 'GET /leader-meetings/m-14': [refusal(500, 'INTERNAL_ERROR', 'Something went wrong.'), { body: meetingView() }] });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' })).toBeInTheDocument();
    });

    it('P18.1-T2 AC-1: not found — the Owner is offered the list back', async () => {
      open(meetingView(), { 'GET /leader-meetings/m-14': notFound });
      expect(await screen.findByRole('heading', { name: "This meeting can't be found." })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '← Back to all meetings' })).toHaveAttribute('href', '/leader-meetings');
    });

    it('P18.1-T2 AC-1: not found — a field member is offered where they land', async () => {
      open(meetingView(), { 'GET /leader-meetings/m-14': notFound }, FIELD_ME);
      expect(await screen.findByRole('heading', { name: "This meeting can't be found." })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/activity/log');
    });

    it('a reader not signed in is sent to sign in, and back to this meeting after', async () => {
      // Sent by the shell since P18.8-T15 AC-2, from the address the browser is on.
      window.history.replaceState(null, '', '/leader-meetings/m-14');
      onTestFinished(() => window.history.replaceState(null, '', '/'));
      stubFetch({});
      renderWithSession(page(), { me: null });
      await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login?next=%2Fleader-meetings%2Fm-14'));
    });
  });

  describe('safety and phones (P18.1-T2 AC-8)', () => {
    it('P18.1-T2 AC-8: <b> and <script> in a title are drawn as typed, in the head and in the dialog’s question', async () => {
      const title = '<b>Bold</b><script>alert(1)</script>';
      const { container } = open(meetingView({ title, writtenIn: false, can: { ...meetingView().can, delete: true } }));
      expect(await screen.findByRole('heading', { level: 2, name: title })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Change the date of/ }));
      await userEvent.click(screen.getByRole('button', { name: 'Delete meeting' }));
      expect(screen.getByText(`Delete “${title}”? Nothing has been written in it yet, and it can't be brought back.`)).toBeInTheDocument();
      expect(container.querySelector('main b, main script')).toBeNull();
      expect(document.querySelector('[role="dialog"] b, [role="dialog"] script')).toBeNull();
    });

    it('P18.1-T2 AC-8: at 360px the head wraps — the title, then the note and the buttons — rather than widening the page', async () => {
      open();
      const title = await screen.findByRole('heading', { level: 2, name: 'Strategic Check-in — #14' });
      expect(title).toHaveClass('break-words');
      expect(title.parentElement).toHaveClass('min-w-0');
      expect(title.parentElement?.parentElement).toHaveClass('flex-wrap');
      expect(head().getByRole('button', { name: 'Save' }).parentElement).toHaveClass('flex-wrap');
      expect(screen.getByRole('tabpanel')).toHaveClass('min-w-0');
    });

    it('P18.1-T2 AC-8: at 360px the three tabs stay on one line, scrolling inside their own strip', async () => {
      open();
      const strip = await screen.findByRole('tablist');
      expect(strip).toHaveClass('flex', 'overflow-x-auto', 'whitespace-nowrap');
      expect(strip).not.toHaveClass('flex-wrap');
      for (const tab of within(strip).getAllByRole('tab')) expect(tab).toHaveClass('shrink-0');
    });

    it('an Admin is named among the editors as the server lists them', async () => {
      open(meetingView({ editors: editors({ owner: WILSON, admins: [{ ...MAYA, isReader: true }] }) }));
      expect(await screen.findByText('Maya Halim (You) · AAB')).toBeInTheDocument();
    });
  });
});
