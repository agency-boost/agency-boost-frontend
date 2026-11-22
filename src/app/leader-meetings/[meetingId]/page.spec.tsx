import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import LeaderMeetingPage from './page';
import {
  ACTION_ITEMS, AGENDA, CORE_LEADER_ME, meetingView, notFound, OWNER_ME, refusal, SHELL_STUBS,
} from '../forum-fixtures';
import type { MeetingView } from '@/lib/leader-meetings';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), pathname: '/leader-meetings/m-14', search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
// Advanced analytics' own sections, as the forum's first two tabs draw them: stood in for, as their own specs cover them.
vi.mock('@/components/advanced-analytics/mapa-section', () => ({
  MapaSection: ({ canUpload }: { canUpload: boolean }) => <div data-testid="mapa-section" data-can-upload={String(canUpload)} />,
}));
vi.mock('@/components/advanced-analytics/subgroup-section', () => ({
  SubgroupSection: () => <div data-testid="subgroup-section" />,
}));

const page = () => <LeaderMeetingPage params={routeParams({ meetingId: 'm-14' })} />;

function open(meeting: MeetingView = meetingView(), routes: Record<string, StubReply | StubReply[]> = {}, me = OWNER_ME) {
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': { body: meeting }, ...routes });
  renderWithSession(page(), { me });
  return stub;
}
const writes = (calls: { url: string; init: RequestInit }[]) => calls.filter((c) => (c.init.method ?? 'GET') !== 'GET');
const bodyOf = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));
const row = (id: string) => within(document.querySelector(`[data-action-item="${id}"]`) as HTMLElement);
const line = (id: string) => within(document.querySelector(`[data-agenda-line="${id}"]`) as HTMLElement);

describe('/leader-meetings/[meetingId] — one forum (P19.22-T8 AC-2 to AC-4)', () => {
  beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
    nav.search = '';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('P19.22-T8 AC-2 the header card and the tabs', () => {
    it('P19.22-T8 AC-2 ‹ All forums, Forum #14, date · time · state, the core leaders, Share and PDF; four tabs, Agenda open', async () => {
      open();
      expect(await screen.findByRole('heading', { level: 2, name: 'Forum #14' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'All forums' })).toHaveAttribute('href', '/leader-meetings');
      expect(screen.getByText(/15 Nov 2026 · 14[.:]00 · Done$/)).toBeInTheDocument();
      expect(screen.getByText('3 core leaders · everyone can edit')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Share' })).toHaveClass('bg-success');
      expect(screen.getByRole('button', { name: 'PDF' })).toBeInTheDocument();
      expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['MAPA driver', 'Informal group', 'Agenda', 'Action items']);
      expect(screen.getByRole('tab', { name: 'Agenda' })).toHaveAttribute('aria-selected', 'true');
      // A forum held, written in: nothing to move or delete.
      expect(screen.queryByRole('button', { name: 'Change date and time' })).not.toBeInTheDocument();
    });

    it('P19.22-T8 AC-2 MAPA driver and Informal group are Advanced analytics’ own, each under its note; the tab is the address’s', async () => {
      open();
      await userEvent.click(await screen.findByRole('tab', { name: 'MAPA driver' }));
      expect(await screen.findByTestId('mapa-section')).toHaveAttribute('data-can-upload', 'true');
      expect(screen.getByText('Same as Advanced analytics › MAPA driver')).toBeInTheDocument();
      expect(nav.replace).toHaveBeenCalledWith('/leader-meetings/m-14?tab=mapa', { scroll: false });
      await userEvent.click(screen.getByRole('tab', { name: 'Informal group' }));
      expect(await screen.findByTestId('subgroup-section')).toBeInTheDocument();
      expect(screen.getByText('Same as Advanced analytics › Informal group')).toBeInTheDocument();
    });

    it('P19.22-T8 AC-1 ?tab=actions opens on the action items (Siapkan agenda opens on the agenda)', async () => {
      nav.search = 'tab=actions';
      open();
      expect(await screen.findByRole('tab', { name: 'Action items' })).toHaveAttribute('aria-selected', 'true');
    });

    it('P19.22-T8 AC-2 Share: a link, then WhatsApp with the forum’s text and the link, in the window opened at the tap', async () => {
      const win = { location: { href: '' }, close: vi.fn() };
      vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
      open(meetingView(), { 'POST /leader-meetings/m-14/share-links': { status: 201, body: { token: 'tok_abc', expiresAt: '2026-12-04T03:00:00.000Z' } } });
      await userEvent.click(await screen.findByRole('button', { name: 'Share' }));
      await waitFor(() => expect(win.location.href).toMatch(/^https:\/\/wa\.me\/\?text=/));
      const text = decodeURIComponent(win.location.href.replace('https://wa.me/?text=', ''));
      expect(text).toContain('Strategic Leader Forum · Forum #14 · ');
      expect(text).toContain('✓ Review angka MAPA driver dan informal group (Wilson)');
      expect(text).toContain('✓ Update action items forum #13 (Everyone)');
      expect(text).toMatch(/• Siapkan Closing Clinic Desember — Sari · 2 De[sc] · Not yet/);
      expect(text).toContain('/leader-meetings/shared/tok_abc');
    });

    it('P19.22-T8 AC-2 PDF: the print layout of the agenda and the action items, then the browser’s print', async () => {
      const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'PDF' }));
      await waitFor(() => expect(document.querySelector('[data-forum-print]')).not.toBeNull());
      const sheet = within(document.querySelector('[data-forum-print]') as HTMLElement);
      expect(sheet.getByText('Rencana Closing Clinic Desember')).toBeInTheDocument();
      expect(sheet.getAllByText('from forum #13')).toHaveLength(2);
      await waitFor(() => expect(print).toHaveBeenCalled());
    });

    it('P19.22-T8 AC-1 a forum to come moves its time in the dialog; one nobody wrote in can be deleted', async () => {
      const fresh = meetingView({ state: 'upcoming', writtenIn: false, can: { edit: true, share: true, reschedule: true, delete: true, print: true } });
      const { calls } = open(fresh, {
        'PATCH /leader-meetings/m-14': { body: { ...fresh, time: '15:30' } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Change date and time' }));
      const dialog = within(await screen.findByRole('dialog', { name: 'Forum date and time' }));
      await userEvent.clear(dialog.getByLabelText('Time'));
      await userEvent.type(dialog.getByLabelText('Time'), '15:30');
      await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(bodyOf(writes(calls)[0])).toEqual({ time: '15:30', version: 1 });
    });

    it('P19.22-T8 AC-2 a forum not there is one not-found state', async () => {
      stubFetch({ ...SHELL_STUBS, 'GET /leader-meetings/m-14': notFound });
      renderWithSession(page(), { me: OWNER_ME });
      expect(await screen.findByText("This forum can't be found.")).toBeInTheDocument();
    });
  });

  describe('P19.22-T8 AC-3 the agenda: one checklist', () => {
    it('P19.22-T8 AC-3 each line: its box, its text, its PIC (photo and first name, or Everyone)', async () => {
      open();
      await screen.findByText('Rencana Closing Clinic Desember');
      expect(line('a-1').getByRole('checkbox', { name: 'Done: Review angka MAPA driver dan informal group' })).toBeChecked();
      expect(line('a-1').getByRole('button', { name: /^PIC for/ })).toHaveTextContent('Wilson');
      expect(line('a-2').getByRole('button', { name: /^PIC for/ })).toHaveTextContent('Everyone');
      expect(line('a-5').getByRole('button', { name: /^PIC for/ })).toHaveTextContent('+ PIC');
    });

    it('P19.22-T8 AC-3 ticked during the forum: the box is one write with the line’s version', async () => {
      const { calls } = open(meetingView(), { 'PATCH /leader-meetings/m-14/agenda-items/a-4': { body: { ...AGENDA[3], done: true, version: 2 } } });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Done: Rencana Closing Clinic Desember' }));
      await waitFor(() => expect(line('a-4').getByRole('checkbox')).toBeChecked());
      expect(bodyOf(writes(calls)[0])).toEqual({ done: true, version: 1 });
    });

    it('P19.22-T8 AC-3 a PIC chosen from the editors, or Everyone; a text edited on a tap', async () => {
      const { calls } = open(meetingView(), {
        'PATCH /leader-meetings/m-14/agenda-items/a-5': [
          { body: { ...AGENDA[4], picMembershipId: 'mem-yosef', version: 2 } },
          { body: { ...AGENDA[4], picMembershipId: 'mem-yosef', text: 'Kesepakatan baru', version: 3 } },
        ],
      });
      await userEvent.click(await screen.findByRole('button', { name: 'PIC for Kesepakatan dan action items baru' }));
      const menu = within(screen.getByRole('menu'));
      // The editors, Everyone, No PIC — never a PIC no longer an editor.
      expect(menu.getAllByRole('menuitemradio')).toHaveLength(7);
      for (const name of ['Wilson', 'Maya', 'Agus', 'Sari', 'Yosef', 'Everyone', 'No PIC']) {
        expect(menu.getByRole('menuitemradio', { name })).toBeInTheDocument();
      }
      expect(menu.queryByRole('menuitemradio', { name: 'Hendra' })).not.toBeInTheDocument();
      await userEvent.click(menu.getByRole('menuitemradio', { name: 'Yosef' }));
      await waitFor(() => expect(line('a-5').getByRole('button', { name: /^PIC for/ })).toHaveTextContent('Yosef'));
      expect(bodyOf(writes(calls)[0])).toEqual({ pic: 'mem-yosef', version: 1 });

      await userEvent.click(line('a-5').getByRole('button', { name: 'Edit: Kesepakatan dan action items baru' }));
      const field = line('a-5').getByRole('textbox');
      await userEvent.clear(field);
      await userEvent.type(field, 'Kesepakatan baru{Enter}');
      await waitFor(() => expect(writes(calls)).toHaveLength(2));
      expect(bodyOf(writes(calls)[1])).toEqual({ text: 'Kesepakatan baru', version: 2 });
    });

    it('P19.22-T8 AC-3 + Add agenda types a line in place, then sends it', async () => {
      const { calls } = open(meetingView(), {
        'POST /leader-meetings/m-14/agenda-items': { status: 201, body: { id: 'a-6', text: 'Persiapan Q1', picMembershipId: null, picAll: false, done: false, version: 1 } },
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Add agenda' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New agenda line' }), 'Persiapan Q1{Enter}');
      expect(await screen.findByText('Persiapan Q1')).toBeInTheDocument();
      expect(bodyOf(writes(calls)[0])).toEqual({ text: 'Persiapan Q1' });
    });

    it('P19.22-T8 AC-3 a line somebody changed first: the forum is read again and the reader told', async () => {
      const { calls } = open(meetingView(), {
        'PATCH /leader-meetings/m-14/agenda-items/a-4': refusal(409, 'VERSION_CONFLICT', 'Changed.'),
      });
      await userEvent.click(await screen.findByRole('checkbox', { name: 'Done: Rencana Closing Clinic Desember' }));
      expect(await screen.findByText(/Someone else changed this/)).toBeInTheDocument();
      expect(calls.filter((c) => c.url.endsWith('/leader-meetings/m-14') && (c.init.method ?? 'GET') === 'GET')).toHaveLength(2);
    });
  });

  describe('P19.22-T8 AC-4 the action items', () => {
    const toActions = async () => {
      await userEvent.click(await screen.findByRole('tab', { name: 'Action items' }));
      await screen.findByText('Siapkan Closing Clinic Desember');
    };

    it('P19.22-T8 AC-4 each row: the item, from forum #n when carried, PIC, due, the state pill, a trash; the two hints', async () => {
      open();
      await toActions();
      expect(row('x-1').getByText('from forum #13')).toBeInTheDocument();
      expect(row('x-2').queryByText(/from forum/)).not.toBeInTheDocument();
      expect(row('x-1').getByRole('button', { name: /^PIC for/ })).toHaveTextContent('Yosef');
      // A PIC no longer an editor is still drawn.
      expect(row('x-5').getByRole('button', { name: /^PIC for/ })).toHaveTextContent('Hendra');
      expect(row('x-1').getByRole('button', { name: /^Status / })).toHaveTextContent('In progress');
      expect(row('x-1').getByRole('button', { name: /^Status / })).toHaveClass('bg-pill-amber');
      expect(row('x-3').getByRole('button', { name: /^Status / })).toHaveClass('bg-pill-green');
      expect(row('x-4').getByRole('button', { name: /^Status / })).toHaveClass('bg-pill-red');
      expect(row('x-1').getByRole('button', { name: 'Delete: Aktifkan 3 agent yang belum aktif di Tanpa group' })).toBeInTheDocument();
      expect(screen.getByText('Unfinished action items move to the next forum automatically')).toBeInTheDocument();
      expect(screen.getByText('Tap a status to change it · tap a text to edit it')).toBeInTheDocument();
    });

    it('P19.22-T8 AC-4 the status: tapped, a menu of Not yet · In progress · Done, one write', async () => {
      const { calls } = open(meetingView(), { 'PATCH /leader-meetings/m-14/action-items/x-4': { body: { ...ACTION_ITEMS[3], status: 'doing', version: 2 } } });
      await toActions();
      await userEvent.click(row('x-4').getByRole('button', { name: /^Status / }));
      const menu = within(screen.getByRole('menu'));
      expect(menu.getAllByRole('menuitemradio').map((m) => m.textContent)).toEqual(['Not yet', 'In progress', 'Done']);
      await userEvent.click(menu.getByRole('menuitemradio', { name: 'In progress' }));
      await waitFor(() => expect(row('x-4').getByRole('button', { name: /^Status / })).toHaveTextContent('In progress'));
      expect(bodyOf(writes(calls)[0])).toEqual({ status: 'doing', version: 1 });
    });

    it('P19.22-T8 AC-4 the text edited on a tap; Escape puts it back and sends nothing', async () => {
      const { calls } = open(meetingView(), { 'PATCH /leader-meetings/m-14/action-items/x-2': { body: { ...ACTION_ITEMS[1], text: '2 presentasi rekrut', version: 2 } } });
      await toActions();
      await userEvent.click(row('x-2').getByRole('button', { name: 'Edit: 1 presentasi rekrut per AB per minggu' }));
      await userEvent.keyboard('{Escape}');
      expect(writes(calls)).toHaveLength(0);
      await userEvent.click(row('x-2').getByRole('button', { name: 'Edit: 1 presentasi rekrut per AB per minggu' }));
      const field = row('x-2').getByRole('textbox');
      await userEvent.clear(field);
      await userEvent.type(field, '2 presentasi rekrut{Enter}');
      expect(await screen.findByText('2 presentasi rekrut')).toBeInTheDocument();
      expect(bodyOf(writes(calls)[0])).toEqual({ text: '2 presentasi rekrut', version: 1 });
    });

    it('P19.22-T8 AC-4 the trash asks Delete action item?, Cancel keeps it, Delete removes it (and from the next forum)', async () => {
      const { calls } = open(meetingView(), { 'DELETE /leader-meetings/m-14/action-items/x-4': { status: 204, body: null } });
      await toActions();
      await userEvent.click(row('x-4').getByRole('button', { name: 'Delete: Siapkan Closing Clinic Desember' }));
      let dialog = within(await screen.findByRole('dialog', { name: 'Delete action item?' }));
      expect(dialog.getByText('“Siapkan Closing Clinic Desember”')).toBeInTheDocument();
      expect(dialog.getByText('Also gone from the next forum. It cannot be undone.')).toBeInTheDocument();
      await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
      expect(writes(calls)).toHaveLength(0);
      await userEvent.click(row('x-4').getByRole('button', { name: 'Delete: Siapkan Closing Clinic Desember' }));
      dialog = within(await screen.findByRole('dialog', { name: 'Delete action item?' }));
      expect(dialog.getByRole('button', { name: 'Delete' })).toHaveClass('bg-alert');
      await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(document.querySelector('[data-action-item="x-4"]')).toBeNull());
      expect(writes(calls)[0].url).toMatch(/\/action-items\/x-4\?version=1$/);
    });

    it('P19.22-T8 AC-4 + Add action item types one in place, then sends it', async () => {
      const added = { id: 'x-6', lineageId: 'x-6', text: 'Jadwalkan JFW', picMembershipId: null, dueOn: null, status: 'todo', fromNumber: null, version: 1 };
      const { calls } = open(meetingView(), { 'POST /leader-meetings/m-14/action-items': { status: 201, body: added } });
      await toActions();
      await userEvent.click(screen.getByRole('button', { name: 'Add action item' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'New action item' }), 'Jadwalkan JFW{Enter}');
      expect(await screen.findByText('Jadwalkan JFW')).toBeInTheDocument();
      expect(bodyOf(writes(calls)[0])).toEqual({ text: 'Jadwalkan JFW' });
    });

    it('P19.22-T8 AC-4 a core leader edits as the Owner does', async () => {
      open(meetingView(), {}, CORE_LEADER_ME);
      await toActions();
      expect(screen.getByRole('button', { name: 'Add action item' })).toBeInTheDocument();
      expect(row('x-1').getByRole('button', { name: /^Status / })).toBeEnabled();
    });
  });
});
