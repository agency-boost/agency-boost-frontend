import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import {
  atWidth, makeMe, renderInIndonesian, renderInLayout, renderWithSession, stubFetch, wears, type StubReply,
} from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { EMPTY, KAIZEN, NOBODY, NOT_LOGGED, noTeam, overviewView, setupWith } from './overview-fixtures';
import KpmOverviewPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/kpm/overview',
}));

const READ = ['member:read_profile', 'kpm_overview:read'];
const WRITE = [...READ, 'kpm_overview:set_recruit_target'];
/** P19.3-T2: an Owner who may open Data upload, where each month still open leads. */
const UPLOADER_PERMISSIONS = [...WRITE, 'data_upload:read'];

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 2,
  },
  permissions: WRITE,
});

const ADMIN = makeMe({
  membership: {
    membershipId: 'mem-admin', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: true, directCount: 0,
  },
  permissions: WRITE,
});

/** An AB in the field: the tenant shell's gate lets them in, the Overview's does not (roles §3.9). */
const FIELD_AB = makeMe({
  membership: {
    membershipId: 'mem-ab', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 4,
  },
  permissions: ['member:read_profile'],
});

/** A Super Admin outside a support session holds no office permission at all. */
const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'kpm:create'],
});

/** The same Super Admin inside a read-only support session: the member's reads, no writes (roles §3.13). */
const SUPPORT_READ_ONLY = makeMe({
  ...OWNER,
  // What `/auth/me` answers inside a read-only session: the member's reads, and no write verb at all.
  permissions: (OWNER.permissions ?? []).filter((p) => p !== 'kpm_overview:set_recruit_target'),
  isImpersonating: true,
  impersonationReadOnly: true,
});

const main = () => screen.getByRole('main');
const section = (name: string) => screen.getByRole('region', { name });
const overviewCalls = (calls: { url: string }[]) => calls.filter((c) => /\/kpm\/overview$/.test(c.url));
const listCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.includes('/kpm/overview/not-logged'));
const writes = (calls: { url: string; init: RequestInit }[]) =>
  calls.filter((c) => c.url.includes('/kpm/overview/recruit-target') && c.init.method === 'PUT');

function render(
  me = OWNER,
  routes: Record<string, StubReply | StubReply[]> = {},
  view = overviewView(),
) {
  // *Since P19.3-T2 (AC-2):* the desktop's *Belum mencatat · 7 hari* card reads the list as it mounts there.
  const stub = stubFetch({ '/kpm/overview': { body: view }, '/kpm/overview/not-logged': { body: NOT_LOGGED }, ...routes });
  renderWithSession(<KpmOverviewPage />, { me });
  return stub;
}

/*
 * *Changed 2026-11-05 (P19.2-T3 AC-5; the client's UI-143):* the five sections are four stat tiles, two lists and three
 * small cards. A list or a card is a region named by its heading; a tile is found by its label.
 */
const loaded = () => screen.findByRole('region', { name: 'AB coaching frequency' });
/** A stat tile, by the words its label starts with (a label may carry an ⓘ after them). */
const statTile = (label: string) => {
  const found = [...document.querySelectorAll<HTMLElement>('[data-stat-tile]')]
    .find((t) => t.querySelector('p')?.textContent?.startsWith(label));
  if (!found) throw new Error(`No tile labelled ${label}`);
  return found;
};
/** A tile's label, without its ⓘ. */
const labelOf = (t: Element) => t.querySelector('p')!.textContent!.replace(/\s*ⓘ.*$/s, '').trim();

describe('KPM Overview (P18-T1)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('the page, verbatim (AC-2)', () => {
    it('AC-2, P18.7-T9 AC-2: is titled Overview, the nav item’s word, its sub-line composed from the office', async () => {
      render();
      await loaded();
      const title = screen.getByRole('heading', { level: 1 });
      // The prototype titled it *KPM Overview* under a nav item reading *Overview* (UI-027).
      expect(title).toHaveTextContent(/^Overview$/);
      expect(screen.getByText('Prudential · KPM 0417 — BSD City Branch')).toBeInTheDocument();
    });

    it('AC-2, P19.2-T3 AC-5, P19.3-T2 AC-1: draws four tiles, three lists and two cards, in the client’s order (UI-143, UI-148)', async () => {
      render();
      await loaded();
      const tiles = [...document.querySelectorAll('[data-overview="tiles"] [data-stat-tile]')];
      expect(tiles.map(labelOf)).toEqual([
        'Total members', 'Active members this month', 'Coached in last 7 days', 'Production — this year',
      ]);
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'AB coaching frequency', 'Units furthest behind target', 'Not logged · 7 days', 'Recruitment pipeline',
      ]);
      // The lists in the second row — *Belum mencatat · 7 hari* the third card from 1024px — the cards in the third.
      expect(document.querySelector('[data-overview="lists"]')!.querySelectorAll('section')).toHaveLength(3);
      const cards = document.querySelector('[data-overview="cards"]')!;
      expect(cards.querySelectorAll('section')).toHaveLength(1);
      expect(cards.querySelector('[data-settings-card]')).not.toBeNull();
    });

    it('AC-2: is no longer a sign — nothing upcoming, nothing pointing elsewhere', async () => {
      render();
      await loaded();
      expect(screen.queryByText('Upcoming')).not.toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/phase/i);
    });

    it('AC-2: asks for the Overview once, with no query parameter', async () => {
      const { calls } = render();
      await loaded();
      expect(overviewCalls(calls)).toHaveLength(1);
      expect(overviewCalls(calls)[0].url).not.toContain('?');
      expect(listCalls(calls)).toHaveLength(0);
    });
  });

  describe('Team composition (AC-3)', () => {
    it('AC-3: Total members is the headcount, with how many are new this month', async () => {
      render();
      await loaded();
      const tile = within(statTile('Total members'));
      expect(tile.getByText('187')).toBeInTheDocument();
      expect(tile.getByText('+6 new this month')).toBeInTheDocument();
    });

    /*
     * *Changed 2026-11-05 (P19.2-T3 AC-5; UI-143: "Total members with AB/AAB/Agent chips"):* the rungs are the tile's
     * chips, where each was a tile of its own.
     */
    it('AC-3, P19.2-T3 AC-5: one chip per rung, in the ladder’s order, named by the ladder, summing to the total', async () => {
      render();
      await loaded();
      const tile = statTile('Total members');
      // Each rung by its badge's name (P18.7-T9 AC-1), *AAB* with its ⓘ (AC-3), which the words leave out here.
      const chips = within(tile).getAllByRole('listitem').map((li) => li.textContent!.replace(/\s*ⓘ.*$/s, ''));
      expect(chips).toEqual(['8 AB', '24 AAB', '155 Agent']);
      expect(within(tile).getByRole('button', { name: 'What is AAB?' })).toBeInTheDocument();
      expect(chips.map((c) => Number(c.split(' ')[0])).reduce((a, b) => a + b, 0)).toBe(187);
    });

    it('AC-3, P19.2-T3 AC-5: a chip’s words say the rung, and no coloured dot does (D-27)', async () => {
      render();
      await loaded();
      expect(statTile('Total members').querySelector('[class*="bg-role-"]')).toBeNull();
    });
  });

  describe('Engagement (AC-4; P19.3-T1 AC-1, P19.3-T2 AC-1, AC-2, AC-9 — Aktif bulan ini and Pengguna aktif)', () => {
    it('P19.3-T2 AC-1, P19.3-T1 AC-1: the first tile is Active this month — D1 from the upload — with its day and its ⓘ', async () => {
      render();
      await loaded();
      const tile = statTile('Active members this month');
      expect(within(tile).getByRole('button', { name: 'Members whose upload for this month shows APE or a policy, of today’s members' })).toBeInTheDocument();
      expect(labelOf(tile)).toBe('Active members this month');
      expect(tile.textContent).toContain('142/ 18776%as of 7 Oct 2026');
      expect(screen.queryByText('Agents who logged activity this month')).not.toBeInTheDocument();
    });

    it('P19.3-T1 AC-1: a month not uploaded reads – and Not uploaded yet, never 0 of 2', async () => {
      render(OWNER, {}, EMPTY);
      await loaded();
      const tile = statTile('Active members this month');
      expect(within(tile).getByLabelText('Not uploaded yet')).toHaveTextContent('–');
      expect(within(tile).getByText('Not uploaded yet')).toBeInTheDocument();
      expect(tile.textContent).not.toMatch(/(^|[^\d])0\/ 2/);
    });

    it('P19.3-T2 AC-9 OWN UI-023: on 2 November nothing reads −100% against a full October, nor any month’s trend', async () => {
      render(OWNER, {}, overviewView({ today: '2026-11-02', month: '2026-11' }));
      await loaded();
      expect(document.body.textContent).not.toMatch(/−100%|Down from|Up from|Same as last month|last month \(/);
    });

    it('P19.3-T2 AC-1 (Pengguna aktif): the tile’s pill says who has not logged in 7 days, named for what it counts', async () => {
      render();
      await loaded();
      const pill = within(statTile('Active members this month')).getByRole('button', { name: /^App users, 7 days: 69 of 187 have not logged/ });
      expect(pill).toHaveTextContent('7 days: 69 not yet ›');
      expect(pill).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('P19.3-T2 AC-2 from 1024px Belum mencatat · 7 hari is the third card: n of N, three 56px rows, All n ›', async () => {
      const { calls } = render();
      await loaded();
      const card = await screen.findByRole('region', { name: 'Not logged · 7 days' });
      expect(await within(card).findByText('69 of 187')).toBeInTheDocument();
      const rows = within(card).getAllByRole('listitem');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent('SINTA HALIM'.toLowerCase() === '' ? '' : 'Sinta Halim');
      expect(rows[0]).toHaveTextContent('Agent · under Sari · Never');
      expect(rows[1]).toHaveTextContent('Agent · under Agus · 12 days ago');
      expect(within(card).getByRole('link', { name: 'All 69 ›' })).toHaveAttribute('href', '/people/members');
      // Read once, as the card mounts on a desktop (D-audit: each name is an audited read).
      expect(listCalls(calls)).toHaveLength(1);
    });

    it('P19.3-T2 AC-2: a row opens the member page; the D-22 WhatsApp reminder on each row with a number, none on the reader’s own', async () => {
      render();
      await loaded();
      const card = await screen.findByRole('region', { name: 'Not logged · 7 days' });
      await within(card).findAllByRole('listitem');
      expect(within(card).getByRole('link', { name: 'Sinta Halim' })).toHaveAttribute('href', '/people/members/mem-sinta');
      const whatsApp = within(card).getByRole('link', { name: /WhatsApp.*Sinta Halim/i });
      expect(whatsApp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/6281211110001\?text=/);
      expect(decodeURIComponent(whatsApp.getAttribute('href')!)).toContain('Hi Sinta 👋');
      // Dedy has no number on file, and the Owner and an Admin may not save one: no reminder the API would refuse.
      expect(within(card).queryByRole('link', { name: /WhatsApp.*Dedy Pranata/i })).not.toBeInTheDocument();
      // The Owner's own row (Wilson, the third silent) says *You* and has no reminder.
      const own = within(card).getAllByRole('listitem')[2];
      expect(own).toHaveTextContent('AB · You · 16 days ago');
      expect(within(own).queryByRole('link', { name: /WhatsApp/i })).not.toBeInTheDocument();
    });

    it('P19.3-T2 AC-2 on a desktop the pill moves the keyboard to the card, and reads nothing more', async () => {
      const { calls } = render();
      await loaded();
      await screen.findByRole('region', { name: 'Not logged · 7 days' });
      await userEvent.click(within(statTile('Active members this month')).getByRole('button', { name: /^App users/ }));
      expect(screen.getByRole('heading', { name: 'Not logged · 7 days' })).toHaveFocus();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(listCalls(calls)).toHaveLength(1);
    });

    it.each([375, 768])('P19.3-T2 AC-2 at %ipx: nothing is read until the pill opens the sheet — five rows, read once', async (px) => {
      atWidth(px);
      const { calls } = render();
      await loaded();
      expect(listCalls(calls)).toHaveLength(0);
      const pill = within(statTile('Active members this month')).getByRole('button', { name: /^App users/ });
      await userEvent.click(pill);
      const sheet = await screen.findByRole('dialog', { name: 'Not logged · 7 days' });
      expect(await within(sheet).findAllByRole('listitem')).toHaveLength(5);
      expect(sheet).toHaveTextContent('69 of 187');
      expect(within(sheet).getByRole('link', { name: 'All 69 ›' })).toBeInTheDocument();
      await userEvent.click(within(sheet).getByRole('button', { name: /close|tutup/i }));
      await userEvent.click(pill);
      await screen.findByRole('dialog', { name: 'Not logged · 7 days' });
      expect(listCalls(calls)).toHaveLength(1);
    });

    it('AC-9, P19.3-T2 AC-2: a list that fails to load says so, and tries again', async () => {
      const { calls } = render(OWNER, {
        '/kpm/overview/not-logged': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-1' } } },
          { body: NOT_LOGGED },
        ],
      });
      await loaded();
      const card = await screen.findByRole('region', { name: 'Not logged · 7 days' });
      expect(await within(card).findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(within(card).getByRole('button', { name: 'Try again' }));
      expect(await within(card).findByText('Sinta Halim')).toBeInTheDocument();
      expect(listCalls(calls)).toHaveLength(2);
    });

    it('AC-4: says so when everybody has logged by the time the list is read', async () => {
      render(OWNER, { '/kpm/overview/not-logged': { body: { total: 0, members: [] } } });
      await loaded();
      expect(await screen.findByText('Everybody has logged in the last 7 days.')).toBeInTheDocument();
    });

    it('AC-4, P19.3-T2 AC-2: nobody silent in the week — no pill, no card, nothing read', async () => {
      const { calls } = render(OWNER, {}, overviewView({
        engagement: {
          activeThisMonth: { count: 187, of: 187, pct: 100, month: '2026-10', asOf: '2026-10-07' },
          loggedThisWeek: { logged: 187, notLogged: 0, pct: 100 },
        },
      }));
      await loaded();
      expect(screen.queryByRole('button', { name: /^App users/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Not logged · 7 days' })).not.toBeInTheDocument();
      expect(listCalls(calls)).toHaveLength(0);
    });
  });

  describe('Coaching coverage (AC-5; P19.3-T2 AC-1, AC-6)', () => {
    it('AC-5, P19.3-T2 AC-1: coached in the last 7 days on the tile, the 30 days on its line, in the status colours', async () => {
      render();
      await loaded();
      const seven = statTile('Coached in last 7 days');
      expect(seven).toHaveTextContent('112/ 18760%30 days: 148');
      expect(within(seven as HTMLElement).getByText('60%').className).toContain('text-alert');
      expect(screen.queryByRole('region', { name: 'Coached in last 30 days' })).not.toBeInTheDocument();
    });

    it('P19.3-T2 AC-1: Coached 7 hari opens Coaching for the Owner; an Admin who leads nobody sees it without a ›', async () => {
      render({ ...OWNER, permissions: [...WRITE, 'coaching_session:read'] });
      await loaded();
      expect(statTile('Coached in last 7 days').closest('a')).toHaveAttribute('href', '/coaching');
      vi.unstubAllGlobals();
      document.body.innerHTML = '';
      render({ ...ADMIN, permissions: [...WRITE, 'coaching_session:read'] });
      await loaded();
      expect(statTile('Coached in last 7 days').tagName).not.toBe('A');
    });

    it('AC-5, P19.2-T3 AC-5, P19.3-T2 AC-1: AB coaching frequency, lowest first, three shown, each row the AB’s member page', async () => {
      render();
      await loaded();
      const board = within(section('AB coaching frequency'));
      const rows = board.getAllByRole('listitem');
      expect(rows.map((r) => r.textContent)).toEqual([
        'HWHendra Wibowo31 in team6/31 · 19%',
        'BSBudi Santoso18 in team5/18 · 28%',
        'FNFajar Nugroho22 in team9/22 · 41%',
      ]);
      expect(board.getByRole('link', { name: 'Hendra Wibowo' })).toHaveAttribute('href', '/people/members/mem-hendra');
      expect(board.getByRole('button', { name: 'All 8 ›' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('AC-5 (D-coverage): Semua 8 › expands the same card in place, and folds back', async () => {
      const { calls } = render();
      await loaded();
      // The desktop's third card reads its list as it mounts; nothing after it is read by the ranking.
      await screen.findByText('69 of 187');
      const board = within(section('AB coaching frequency'));
      const more = board.getByRole('button', { name: 'All 8 ›' });
      const before = calls.length;
      await userEvent.click(more);
      expect(more).toHaveAttribute('aria-expanded', 'true');
      expect(board.getAllByRole('listitem')).toHaveLength(8);
      expect(board.getByText('Wilson Tanoto').closest('li')).toHaveTextContent('23/28 · 82%');
      expect(calls.length).toBe(before);
      await userEvent.click(board.getByRole('button', { name: 'show fewer' }));
      expect(board.getAllByRole('listitem')).toHaveLength(3);
    });

    it('P18.9-T3 AC-5: every AB is listed — one who leads nobody last, No team where the rate would be (UI-017)', async () => {
      const view = overviewView();
      const leaderboard = [...view.coaching.leaderboard, noTeam('mem-maya-h', 'Maya Halim')];
      render(OWNER, {}, { ...view, coaching: { ...view.coaching, leaderboard } });
      await loaded();
      const board = within(section('AB coaching frequency'));
      await userEvent.click(board.getByRole('button', { name: 'All 9 ›' }));
      const rows = board.getAllByRole('listitem');
      expect(rows).toHaveLength(9);
      expect(rows[8]).toHaveTextContent(/Maya HalimNo team$/);
      expect(rows[8].querySelector('[aria-hidden="true"].rounded-pill.border-hairline')).toBeNull();
      expect(rows[8].textContent).not.toMatch(/0%|in team|—/);
    });

    it('P19.3-T2 AC-6 (D-08): AB coaching frequency is hidden while no AB leads anyone; the four tiles always show', async () => {
      render(OWNER, {}, NOBODY);
      await loaded().catch(() => undefined);
      await screen.findByText('Total members');
      expect(screen.queryByRole('region', { name: 'AB coaching frequency' })).not.toBeInTheDocument();
      expect(document.querySelectorAll('[data-overview="tiles"] [data-stat-tile]')).toHaveLength(4);
      const seven = statTile('Coached in last 7 days');
      expect(within(seven).getAllByText('No rate: nobody to count')).toHaveLength(1);
      expect(seven.textContent).not.toMatch(/(^|[^\d,])0(,0)?%/);
    });
  });

  describe('Recruitment pipeline (AC-6; P18.9-T3 AC-7 — the Target a value with Edit)', () => {
    const pipeline = () => within(section('Recruitment pipeline'));
    /** The *Target* tile: its label, and what is under it. */
    const tile = () => pipeline().getByText('Target').parentElement as HTMLElement;
    const edit = () => pipeline().getByRole('button', { name: 'Edit target' });
    const box = () => screen.getByLabelText('Target') as HTMLInputElement;
    const accept = { 'PUT /kpm/overview/recruit-target': (call: { body: unknown }) => ({ body: call.body }) };
    const refused = {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } },
    };
    /** Edit, and the box emptied: ready for a number. */
    const openBox = async () => {
      await userEvent.click(edit());
      await userEvent.clear(box());
    };

    it('AC-6, P19.3-T2 AC-1: the four tiles are figures, not links; the controls are the card’s › to the target sheet and Edit', async () => {
      render();
      await loaded();
      expect(pipeline().getByText('Expected to close').nextElementSibling).toHaveTextContent('13');
      // P19.3-T1 AC-3 (D2): the upload's recruitment, named for it.
      expect(pipeline().getByText('Recruitment last month').nextElementSibling).toHaveTextContent('11');
      expect(pipeline().getByText('Pipeline now').nextElementSibling).toHaveTextContent('80');
      expect(pipeline().queryByRole('link')).not.toBeInTheDocument();
      expect(pipeline().getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Recruitment target this month', 'Edit target']);
    });

    it('P18.9-T3 AC-7: the Target reads as a labelled value — Target, 15 — with Edit, and no box until Edit is pressed', async () => {
      render();
      await loaded();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(pipeline().queryByRole('spinbutton')).not.toBeInTheDocument();
      // The visible word is *Edit*; its name says what it edits (WCAG 2.5.3: the words are in the name).
      expect(edit()).toHaveTextContent(/^Edit$/);
      expect(pipeline().getByText('2 short of target (13 of 15)').className).toContain('text-alert');
    });

    it('P18.9-T3 AC-7: Edit opens the labelled number input in the value’s place, holding the target, focused', async () => {
      render();
      await loaded();
      await userEvent.click(edit());
      expect(box()).toHaveAttribute('type', 'number');
      expect(box()).toHaveValue(15);
      expect(box()).toHaveFocus();
      expect(pipeline().queryByRole('button', { name: 'Edit target' })).not.toBeInTheDocument();
    });

    it('P18.9-T3 AC-7: Enter saves the office’s current month, reads as a value again, and the toast says Target saved ✓', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '18{Enter}');

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target18Edit$/));
      expect(writes(calls)).toHaveLength(1);
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 18 });
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      // The field's own *Saved ✓* is the toast's now (OD-200), and the keyboard is back on *Edit*.
      expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
      expect(edit()).toHaveFocus();
      expect(pipeline().getByText('5 short of target (13 of 18)')).toBeInTheDocument();
    });

    it('P18.9-T3 AC-7: leaving the box saves what it holds at once, and the toast confirms it', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '22');
      expect(writes(calls)).toHaveLength(0);
      await userEvent.tab();

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target22Edit$/));
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 22 });
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      // Nothing is sent while typing, nor after: no pause saves anything (OD-200's autosave is Enter or leaving).
      await act(() => new Promise((r) => { setTimeout(r, 700); }));
      expect(writes(calls)).toHaveLength(1);
    });

    it('P18.9-T3 AC-7: Escape leaves without saving, the value as it was, and gives the keyboard back to Edit', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '30');
      // The pill judges what is typed, as `updateRecruitStatus()` does — and goes back with the value.
      expect(pipeline().getByText('17 short of target (13 of 30)')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(edit()).toHaveFocus();
      expect(pipeline().getByText('2 short of target (13 of 15)')).toBeInTheDocument();
      await act(() => new Promise((r) => { setTimeout(r, 50); }));
      expect(writes(calls)).toHaveLength(0);
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();
    });

    it('AC-6, P18.9-T3 AC-7: the pill’s three sentences, verbatim, as the number is typed', async () => {
      render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '13');
      expect(pipeline().getByText('On track to hit target (13 of 13)').className).toContain('text-success');

      await userEvent.clear(box());
      await userEvent.type(box(), '10');
      expect(pipeline().getByText('3 ahead of target (13 of 10)').className).toContain('text-success');
    });

    it('P18.9-T3 AC-7: the target kept already sends nothing, and reads as the value again', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await userEvent.click(edit());
      await userEvent.keyboard('{Enter}');

      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(writes(calls)).toHaveLength(0);
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();
    });

    it('AC-6, P18.9-T3 AC-7: a number that is not a whole number from 0 is never sent, the box says why, and leaving it keeps 15', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.type(box(), '-3{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0.');
      expect(box()).toHaveAttribute('aria-invalid', 'true');
      await userEvent.tab();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(0);
    });

    it('P18.9-T3 AC-7: Enter on an empty box says what it takes; leaving it empty clears nothing', async () => {
      const { calls } = render(OWNER, accept);
      await loaded();
      await openBox();
      await userEvent.keyboard('{Enter}');

      expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0.');
      expect(box()).toHaveFocus();
      await userEvent.tab();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(writes(calls)).toHaveLength(0);
    });

    it('P18.9-T3 AC-7: a refusal keeps the box with Couldn’t save — retry, and the retry sends the same target again', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': [refused, (call) => ({ body: call.body })] });
      await loaded();
      await openBox();
      await userEvent.type(box(), '20{Enter}');

      const retry = await within(tile()).findByRole('button', { name: "Couldn't save — retry: Target" });
      // The box stays, holding what was refused, and the refusal's reason is said under the tiles.
      expect(box()).toHaveValue(20);
      expect(screen.getByRole('alert')).toHaveTextContent('The target was not saved. Something went wrong.');
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();

      await userEvent.click(retry);

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target20Edit$/));
      // The retry sent it once more; leaving the box towards the retry sent nothing of its own.
      expect(writes(calls).map((c) => JSON.parse(c.init.body as string))).toEqual([
        { month: '2026-10', target: 20 }, { month: '2026-10', target: 20 },
      ]);
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(edit()).toHaveFocus();
    });

    it('P18.9-T3 AC-7: a newer target typed after a refusal is saved in its place, and the retry goes', async () => {
      const { calls } = render(OWNER, { 'PUT /kpm/overview/recruit-target': [refused, (call) => ({ body: call.body })] });
      await loaded();
      await openBox();
      await userEvent.type(box(), '20{Enter}');
      await within(tile()).findByRole('button', { name: "Couldn't save — retry: Target" });

      await userEvent.clear(box());
      await userEvent.type(box(), '17{Enter}');

      await waitFor(() => expect(tile()).toHaveTextContent(/^Target17Edit$/));
      expect(writes(calls).map((c) => JSON.parse(c.init.body as string).target)).toEqual([20, 17]);
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('P18.7-T1 AC-5, P18.9-T3 AC-7: says Saving… beside the box while the target is on its way, then the toast', async () => {
      const { mock } = stubFetch({ '/kpm/overview': { body: overviewView() } });
      let release: () => void = () => {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method !== 'PUT') return mock(url, init);
        await new Promise<void>((resolve) => { release = resolve; });
        return { ok: true, status: 200, json: async () => ({ month: '2026-10', target: 18 }) } as Response;
      }));
      renderWithSession(<KpmOverviewPage />, { me: OWNER });
      await loaded();
      await openBox();
      await userEvent.type(box(), '18{Enter}');

      await waitFor(() => expect(within(tile()).getByText('Saving…')).toBeInTheDocument());
      // Inside the Target's own tile, and the box holds still while it goes.
      expect(box()).toHaveAttribute('readonly');
      await act(async () => { release(); });
      await waitFor(() => expect(tile()).toHaveTextContent(/^Target18Edit$/));
      expect(screen.getByText('Target saved ✓')).toBeInTheDocument();
      expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();
    });

    it('P18.7-T1 AC-5, P18.9-T3 AC-7: leaving the page with the box open still sends what it holds, with nothing drawn', async () => {
      const { calls } = stubFetch({ '/kpm/overview': { body: overviewView() }, ...accept });
      const { unmount } = renderWithSession(<KpmOverviewPage />, { me: OWNER });
      await loaded();
      await openBox();
      await userEvent.type(box(), '30');
      expect(writes(calls)).toHaveLength(0);

      unmount();

      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(JSON.parse(writes(calls)[0].init.body as string)).toEqual({ month: '2026-10', target: 30 });
      expect(screen.queryByText('Target saved ✓')).not.toBeInTheDocument();
    });

    it('AC-6, P18.9-T3 AC-7: none set reads No target set with Edit — and no pill judged against the prototype’s 15', async () => {
      render(OWNER, {}, EMPTY);
      await loaded();
      expect(tile()).toHaveTextContent(/^TargetNo target setEdit$/);
      expect(pipeline().queryByText(/of target|target \(/)).not.toBeInTheDocument();
      await userEvent.click(edit());
      expect(box()).toHaveValue(null);
    });

    it.each([
      ['an Admin, who holds it too (ADR-0028)', ADMIN, true],
      ['an Owner', OWNER, true],
      ['a reader without the target’s permission', makeMe({ ...OWNER, permissions: READ }), false],
    ])('AC-1, P18.9-T3 AC-7: Edit is offered to %s: %s', async (_who, me, offered) => {
      render(me);
      await loaded();
      if (offered) {
        expect(edit()).toBeEnabled();
      } else {
        expect(pipeline().queryByRole('button', { name: 'Edit target' })).not.toBeInTheDocument();
        expect(pipeline().queryByRole('spinbutton')).not.toBeInTheDocument();
        expect(tile()).toHaveTextContent(/^Target15$/);
        // The pill still reads against the target that is kept.
        expect(pipeline().getByText('2 short of target (13 of 15)')).toBeInTheDocument();
      }
    });

    it('AC-1, P18.9-T3 AC-7: a read-only support session sees the member’s Edit disabled, and writes nothing (roles §3.13)', async () => {
      const { calls } = render(SUPPORT_READ_ONLY);
      await loaded();
      expect(edit()).toBeDisabled();
      expect(tile()).toHaveTextContent(/^Target15Edit$/);
      expect(pipeline().queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(calls.some((c) => c.init?.method === 'PUT')).toBe(false);
    });

    it('AC-6, P18.9-T3 AC-7: a reader who cannot set it and has none reads No target set, never a 0', async () => {
      render(makeMe({ ...OWNER, permissions: READ }), {}, EMPTY);
      await loaded();
      expect(tile()).toHaveTextContent(/^TargetNo target set$/);
    });
  });

  describe('Production — this year (AC-7)', () => {
    it('AC-7: Rp achieved of Rp target, in the product’s money formatter, and its percentage', async () => {
      render();
      await loaded();
      // A stat tile since P19.2-T3 (UI-143: "Production this year with bar").
      const production = within(statTile('Production — this year'));
      expect(production.getByText('IDR 8.4B')).toBeInTheDocument();
      expect(production.getByText('of IDR 12.5B target')).toBeInTheDocument();
      expect(production.getAllByText('67%')[0].className).toContain('text-alert');
      // Never the prototype's bare *8.4B*: every sum through the formatter, its mark before it — a pair's second after
      // its *IDR … /* (P18.10-T4: the English shapes).
      for (const piece of [statTile('Production — this year'), section('Units furthest behind target')]) {
        expect(piece.textContent!.replace(/(IDR|\/) \d+(\.\d)?[BMK]/g, '')).not.toMatch(/\d(\.\d)?[BM]\b/);
      }
    });

    /*
     * *Changed 2026-11-05 (P19.2-T3 AC-5; UI-143):* the tile's bar is the year's share; the projection stays, in words,
     * under it, where its marker on a bar of its own and the bar's *0 … Target* ends were.
     */
    it('AC-7, P19.2-T3 AC-5: the projection in words under the tile’s bar, the bar the year’s share', async () => {
      render();
      await loaded();
      const tile = statTile('Production — this year');
      expect(within(tile).getByText('Projected: IDR 11.9B')).toBeInTheDocument();
      const bar = tile.querySelector('[aria-hidden="true"] > div') as HTMLElement;
      expect(bar.style.width).toBe('67%');
    });

    it('AC-7: no projection until a month of the year is held', async () => {
      const view = overviewView();
      render(OWNER, {}, overviewView({ production: { ...view.production, projectionMinor: null } }));
      await loaded();
      expect(within(statTile('Production — this year')).queryByText(/Projected:/)).not.toBeInTheDocument();
    });

    it('AC-7, P19.3-T2 AC-7: the total names in its tooltip only the months still open, and the members it leaves out', async () => {
      render();
      await loaded();
      expect(within(statTile('Production — this year')).getByRole('button', {
        name: 'Not uploaded yet for Sep 2026 and Oct 2026, so not counted in this total. 3 members have no goal set, so the target leaves them out.',
      })).toBeInTheDocument();
    });

    it('P19.3-T2 AC-7 Overview case 8: each month still open is a pill that opens Data upload on itself', async () => {
      render({ ...OWNER, permissions: UPLOADER_PERMISSIONS });
      await loaded();
      const tile = within(statTile('Production — this year'));
      expect(tile.getByRole('link', { name: 'Sep 2026 not uploaded ›' })).toHaveAttribute('href', '/kpm/data-upload?month=2026-09');
      expect(tile.getByRole('link', { name: 'Oct 2026 not uploaded ›' })).toHaveAttribute('href', '/kpm/data-upload?month=2026-10');
    });

    it('AC-7, P19.2-T3 AC-5, P19.3-T2 AC-1: Units furthest behind target — three, lowest first, each opening the AB’s Unit Dashboard', async () => {
      render(OWNER);
      await loaded();
      const production = within(section('Units furthest behind target'));
      expect(production.getByRole('button', { name: 'Tap a row to open that AB’s Unit Dashboard' })).toBeInTheDocument();
      const rows = production.getAllByRole('listitem');
      expect(rows.map((r) => r.textContent)).toEqual([
        'HWHendra WibowoABIDR 620M / 1.5B unit target41%',
        'BSBudi SantosoABIDR 540M / 900M unit target60%',
        'FNFajar NugrohoABIDR 700M / 1.1B unit target64%',
      ]);
      expect(production.getByRole('button', { name: 'All 6 ›' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('P19.3-T2 AC-1 Overview case 6: a unit’s row opens that AB’s Unit Dashboard, for whoever may open one', async () => {
      render({ ...OWNER, permissions: [...WRITE, 'unit_dashboard:read'] });
      await loaded();
      const production = within(section('Units furthest behind target'));
      expect(production.getByRole('link', { name: 'Hendra Wibowo' })).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
      // No expander inside: the Unit Dashboard shows the AAB units.
      expect(production.queryByRole('button', { name: /^Hendra Wibowo/ })).not.toBeInTheDocument();
    });

    it('AC-7: Semua 6 › shows every agency in place, a figure not held as a dash', async () => {
      render();
      await loaded();
      const production = within(section('Units furthest behind target'));
      await userEvent.click(production.getByRole('button', { name: 'All 6 ›' }));
      const rudi = production.getByText('Rudi Hartono').closest('li')!;
      expect(rudi).toHaveTextContent('Not uploaded yet / IDR 600M unit target');
      expect(rudi).toHaveTextContent('—');
      expect(rudi.textContent).not.toMatch(/\b0(,0)?%/);
    });

    it('AC-9, P19.3-T2 AC-6, AC-8: a year with no file and nobody with a goal says so — no 0 — with its next step; no unit to rank', async () => {
      render({ ...OWNER, permissions: UPLOADER_PERMISSIONS }, {}, EMPTY);
      await loaded();
      const tile = within(statTile('Production — this year'));
      expect(tile.getByText('Not uploaded yet')).toBeInTheDocument();
      expect(tile.getByText('No goal set')).toBeInTheDocument();
      expect(tile.queryByText(/Projected:/)).not.toBeInTheDocument();
      expect(tile.queryByText('IDR 0')).not.toBeInTheDocument();
      // UI-157's Overview line: *Belum diunggah* always carries its next step.
      expect(tile.getByRole('link', { name: 'Upload Oct 2026 ›' })).toHaveAttribute('href', '/kpm/data-upload?month=2026-10');
      // No unit has a target: the list is hidden (D-08).
      expect(screen.queryByRole('region', { name: 'Units furthest behind target' })).not.toBeInTheDocument();
    });
  });

  describe('the states the prototype lacks (AC-9)', () => {
    it('AC-9: the page in outline while the read is on its way', async () => {
      let answer: (value: unknown) => void = () => undefined;
      vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { answer = resolve; })));
      renderWithSession(<KpmOverviewPage />, { me: OWNER });
      expect(screen.getByRole('status')).toHaveTextContent('Loading the overview…');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Overview$/);
      await act(async () => answer({ ok: true, status: 200, json: async () => overviewView() }));
      expect(await loaded()).toBeInTheDocument();
      expect(screen.queryByText('Loading the overview…')).not.toBeInTheDocument();
    });

    it('AC-9: an error with a retry, which reads again', async () => {
      const { calls } = stubFetch({
        '/kpm/overview': [
          { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'r-9' } } },
          { body: overviewView() },
        ],
      });
      renderWithSession(<KpmOverviewPage />, { me: OWNER });
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await loaded()).toBeInTheDocument();
      expect(overviewCalls(calls)).toHaveLength(2);
    });

    it('AC-9: an office with nobody in it divides nothing by zero', async () => {
      render(OWNER, {}, NOBODY);
      await screen.findByText('Total members');
      expect(within(statTile('Total members')).getByText('+0 new this month')).toBeInTheDocument();
      const active = statTile('Active members this month');
      expect(active.textContent).not.toMatch(/NaN|Infinity|(^|[^\d,])0(,0)?%/);
      expect(within(active).getByText('Not uploaded yet')).toBeInTheDocument();
    });
  });

  describe('accessibility and phones (AC-10)', () => {
    it('AC-10: both expanders are buttons that say whether they are open', async () => {
      render(OWNER, { '/kpm/overview/not-logged': { body: NOT_LOGGED } });
      await loaded();
      for (const name of ['All 8 ›', 'All 6 ›']) {
        for (const button of screen.getAllByRole('button', { name })) {
          expect(button).toHaveAttribute('aria-expanded', 'false');
          expect(document.getElementById(button.getAttribute('aria-controls')!)).not.toBeNull();
        }
      }
    });

    it('AC-10: every bar is a picture of a figure printed beside it, hidden from assistive technology', async () => {
      render();
      await loaded();
      const bars = [...document.body.querySelectorAll('span.rounded-pill.border-hairline.bg-base')];
      expect(bars.length).toBeGreaterThan(5);
      for (const bar of bars) expect(bar).toHaveAttribute('aria-hidden', 'true');
      // The tiles' bar, the shared stat tile's, likewise (P19.2-T3).
      for (const bar of document.body.querySelectorAll('[data-stat-tile] .bg-base')) expect(bar).toHaveAttribute('aria-hidden', 'true');
    });

    it('AC-10: colours are tokens — no raw hex anywhere in the page’s markup', async () => {
      render();
      await loaded();
      expect(document.body.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });
  });

  describe('who may open it (AC-1)', () => {
    it.each([
      ['an Owner', OWNER],
      ['an Admin', ADMIN],
    ])('AC-1: %s reads the Overview', async (_who, me) => {
      const { calls } = render(me);
      expect(await loaded()).toBeInTheDocument();
      expect(overviewCalls(calls)).toHaveLength(1);
    });

    it('AC-1: a support session reads what its member reads', async () => {
      render(SUPPORT_READ_ONLY);
      expect(await loaded()).toBeInTheDocument();
    });

    it.each([
      ['a field AB', FIELD_AB],
      ['a Super Admin outside a support session', SUPER_ADMIN],
    ])('AC-1: %s is refused, and nothing is asked of the API', async (_who, me) => {
      const { calls } = stubFetch({ '/kpm/overview': { body: overviewView() } });
      renderWithSession(<KpmOverviewPage />, { me });
      expect(screen.getByRole('alert')).toHaveTextContent('Not available to you');
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'kpm_overview:read');
      expect(overviewCalls(calls)).toHaveLength(0);
    });

    it('AC-1: inside the tenant shell, as the Owner lands on it', async () => {
      stubFetch({ '/kpm/overview': { body: overviewView() } });
      renderInLayout(TenantLayout, <KpmOverviewPage />, { me: OWNER });
      expect(await within(main()).findByRole('region', { name: 'AB coaching frequency' })).toBeInTheDocument();
    });
  });
});

/**
 * **P18.10-T4 the KPM Overview in Indonesian** (`i18n/messages/kpm-overview.ts`; ADR-0179): the title, each section's
 * and each card's name kept English (§A.4's Overview labels), every other word the approved glossary's, the office's
 * line and every name as the office has them, and the figures Indonesian.
 */
describe('P18.10-T4 the KPM Overview in Indonesian', () => {
  afterEach(() => vi.unstubAllGlobals());

  function renderIndonesian(view = overviewView(), routes: Record<string, StubReply> = {}) {
    // *Since P19.3-T2 (AC-2):* the desktop's *Belum mencatat · 7 hari* card reads the list as it mounts there.
    const stub = stubFetch({ '/kpm/overview': { body: view }, '/kpm/overview/not-logged': { body: NOT_LOGGED }, ...routes });
    renderInIndonesian(<KpmOverviewPage />, { me: { ...OWNER, permissions: UPLOADER_PERMISSIONS } });
    return stub;
  }

  it('P18.10-T4, P19.3-T2: keeps the sections’ names and writes the cards’ words and figures in Indonesian', async () => {
    renderIndonesian();
    await loaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    for (const name of ['Total members', 'Aktif bulan ini', 'Coached in last 7 days', 'Production — this year']) {
      expect(statTile(name)).toBeInTheDocument();
    }
    for (const name of ['AB coaching frequency', 'Units furthest behind target', 'Recruitment pipeline', 'Belum mencatat · 7 hari']) {
      expect(section(name)).toBeInTheDocument();
    }
    expect(within(statTile('Total members')).getByText('+6 baru bulan ini')).toBeInTheDocument();
    const active = within(statTile('Aktif bulan ini'));
    expect(active.getByText('per 7 Okt 2026')).toBeInTheDocument();
    expect(active.getByRole('button', { name: /^Pengguna aktif, 7 hari: 69 dari 187 belum mencatat/ })).toHaveTextContent('7 hari: 69 belum ›');
    expect(within(statTile('Coached in last 7 days')).getByText('30 hari: 148')).toBeInTheDocument();
    const production = within(statTile('Production — this year'));
    expect(production.getByText('Rp 8,4 M')).toBeInTheDocument();
    expect(production.getByText('dari target Rp 12,5 M')).toBeInTheDocument();
    expect(production.getByText('Proyeksi: Rp 11,9 M')).toBeInTheDocument();
    expect(production.getByRole('button', {
      name: 'Belum diunggah untuk Sep 2026 dan Okt 2026, jadi tidak dihitung dalam total ini. 3 anggota belum mengatur goal, jadi target tidak menghitung mereka.',
    })).toBeInTheDocument();
    expect(production.getByRole('link', { name: 'Okt 2026 belum diunggah ›' })).toBeInTheDocument();
    const units = within(section('Units furthest behind target'));
    expect(units.getByRole('button', { name: 'Ketuk baris untuk membuka Unit Dashboard AB itu' })).toBeInTheDocument();
    expect(units.getByText('Hendra Wibowo').closest('li')).toHaveTextContent('Rp 620 jt / 1,5 M target unit');
    expect(units.getByRole('button', { name: 'Semua 6 ›' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pengaturan KPM' })).toBeInTheDocument();
    expect(englishOnly(kpmOverviewMessages).length).toBeGreaterThan(20);
    expect(document.body.textContent).toContain('belum diunggah');
    expect(englishShown(document.body, englishOnly(kpmOverviewMessages))).toEqual([]);
  });

  it('P18.10-T4 writes the recruitment card, its pill and its Edit in Indonesian, the tiles’ names kept', async () => {
    renderIndonesian();
    await loaded();
    const recruitment = within(section('Recruitment pipeline'));
    for (const name of ['Expected to close', 'Target', 'Recruitment last month', 'Pipeline now']) expect(recruitment.getByText(name)).toBeInTheDocument();
    expect(recruitment.getByRole('button', { name: 'Ubah target' })).toHaveTextContent('Ubah');
    expect(recruitment.getByText(/^(Sesuai|Lebih \d+ dari|Kurang \d+ dari) target \(\d+ dari \d+\)$/)).toBeInTheDocument();
  });

  it('P18.10-T4, P19.3-T2 AC-2: Belum mencatat · 7 hari in Indonesian — "Agent · ke Sari · Belum pernah"', async () => {
    renderIndonesian();
    await loaded();
    const card = await screen.findByRole('region', { name: 'Belum mencatat · 7 hari' });
    const rows = await within(card).findAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Agent · ke Sari · Belum pernah');
    expect(rows[1]).toHaveTextContent('Agent · ke Agus · 12 hari lalu');
    expect(rows[2]).toHaveTextContent('AB · Anda · 16 hari lalu');
    expect(within(card).getByText('69 dari 187')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Semua 69 ›' })).toBeInTheDocument();
    expect(decodeURIComponent(within(card).getByRole('link', { name: /WhatsApp.*Sinta Halim/i }).getAttribute('href')!)).toContain('Halo Sinta 👋');
  });

  it('P18.10-T4 says an empty office in Indonesian: no file, no goal, no target, nobody to rank', async () => {
    renderIndonesian(EMPTY);
    await loaded();
    const production = within(statTile('Production — this year'));
    expect(production.getByText('Belum diunggah')).toBeInTheDocument();
    expect(production.getByText('Goal belum diatur')).toBeInTheDocument();
    expect(within(section('Recruitment pipeline')).getByText('Target belum diatur')).toBeInTheDocument();
    expect(englishShown(document.body, englishOnly(kpmOverviewMessages))).toEqual([]);
  });
});

/**
 * **P19.2-T3 AC-5 the Overview's layout**, as P19.3-T2 redraws it (the client's UI-143, UI-148, UI-149;
 * `kpm-overview-*-2026-11-03`, which win for this page): a phone and a tablet — the tablet uses the phone's layout — draw
 * the four tiles two by two, the lists one under the other and the cards one under the other; a laptop draws four tiles
 * in one row, the three lists side by side — *Belum mencatat · 7 hari* the third — and the two cards side by side. jsdom
 * applies no stylesheet, so each width is read through the classes that hold there (`wears`).
 */
describe('P19.2-T3 AC-5, P19.3-T2 the Overview laid out as tiles, lists and cards (UI-143, UI-148)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const part = (name: 'tiles' | 'lists' | 'cards') => document.querySelector(`[data-overview="${name}"]`)!;
  const classesAt = (el: Element, px: number) => wears(el, px).split(' ');

  it.each([375, 768])('P19.2-T3 AC-5, P19.3-T2 at %ipx: the tiles two by two, the lists and the cards one under the other, no third card', async (px) => {
    atWidth(px);
    render();
    await loaded();
    expect(classesAt(part('tiles'), px)).toContain('grid-cols-2');
    expect(classesAt(part('tiles'), px)).not.toContain('grid-cols-4');
    expect(classesAt(part('lists'), px)).toContain('grid-cols-1');
    expect(classesAt(part('cards'), px)).toContain('grid-cols-1');
    // *Belum mencatat · 7 hari* is the sheet below 1024px: its card is not drawn there.
    expect(classesAt(document.querySelector('[data-not-logged-card]')!, px)).toContain('hidden');
  });

  it.each([1024, 1280])('P19.2-T3 AC-5, P19.3-T2 at %ipx: four tiles in one row, three lists side by side, two cards below', async (px) => {
    atWidth(px);
    render();
    await loaded();
    expect(classesAt(part('tiles'), px)).toContain('grid-cols-4');
    expect(classesAt(part('lists'), px)).toContain('grid-cols-3');
    expect(classesAt(part('cards'), px)).toContain('grid-cols-2');
    expect(classesAt(document.querySelector('[data-not-logged-card]')!, px)).not.toContain('hidden');
    expect(part('tiles').querySelectorAll('[data-stat-tile]')).toHaveLength(4);
  });

  it('P19.2-T3 AC-5: the office’s line beside the title from 1024px, and not on a phone or a tablet', async () => {
    render();
    await loaded();
    const line = screen.getByText('Prudential · KPM 0417 — BSD City Branch');
    for (const px of [375, 768]) expect(classesAt(line, px)).toContain('hidden');
    for (const px of [1024, 1280]) expect(classesAt(line, px)).not.toContain('hidden');
  });

  it('P19.2-T3 AC-5: every tile is the shared stat tile, and each list three rows with its Semua n ›', async () => {
    render();
    await loaded();
    for (const t of part('tiles').children) expect(t).toHaveAttribute('data-stat-tile');
    expect(within(section('AB coaching frequency')).getAllByRole('listitem')).toHaveLength(3);
    expect(section('Units furthest behind target').querySelector('ul')!.children).toHaveLength(3);
    for (const name of ['Team composition', 'Engagement', 'Coaching coverage']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
    }
  });

  it.each([375, 768, 1024])('P19.2-T3 AC-5, P19.3-T2 at %ipx: Semua n ›, the week’s pill and a month’s pill are 44px targets below 1024px', async (px) => {
    atWidth(px);
    render({ ...OWNER, permissions: UPLOADER_PERMISSIONS });
    await loaded();
    const targets = [
      screen.getByRole('button', { name: 'All 8 ›' }),
      screen.getByRole('button', { name: /^App users/ }),
      screen.getByRole('link', { name: 'Sep 2026 not uploaded ›' }),
    ];
    for (const target of targets) {
      if (px < 1024) expect(classesAt(target, px)).toContain('min-h-11');
      else expect(classesAt(target, px)).not.toContain('min-h-11');
    }
  });
});

/**
 * **P19.3-T2 — every problem opens its fix, a new KPM's setup card, and the KPM's first month** (UI-148, UI-149, UI-150;
 * Overview R1, R1b, R2, R3; the flow report's cases 0, 0b, 1, 4 to 8). Each width the ticket lists: 375, 768 and 1280.
 */
describe('P19.3-T2 the KPM Overview: problems open their fix, Siapkan KPM, the KPM’s first month', () => {
  afterEach(() => vi.unstubAllGlobals());

  const SETTING_UP = { ...OWNER, permissions: [...WRITE, 'data_upload:read', 'kpm:import_roster', 'unit_dashboard:read', 'coaching_session:read'] };
  const setupCard = () => screen.getByRole('region', { name: 'Set up your KPM' });

  it.each([375, 768, 1280])('P19.3-T2 AC-1 at %ipx: every tile and row opens its page (Overview R1)', async (px) => {
    atWidth(px);
    render(SETTING_UP);
    await loaded();
    expect(statTile('Total members').closest('a')).toHaveAttribute('href', '/people/members');
    expect(statTile('Coached in last 7 days').closest('a')).toHaveAttribute('href', '/coaching');
    expect(within(statTile('Production — this year')).getByRole('link', { name: 'Oct 2026 not uploaded ›' }))
      .toHaveAttribute('href', '/kpm/data-upload?month=2026-10');
    expect(within(section('AB coaching frequency')).getByRole('link', { name: 'Hendra Wibowo' })).toHaveAttribute('href', '/people/members/mem-hendra');
    expect(within(section('Units furthest behind target')).getByRole('link', { name: 'Hendra Wibowo' })).toHaveAttribute('href', '/unit/dashboard/mem-hendra');
    expect(within(section('Recruitment pipeline')).getByRole('button', { name: 'Recruitment target this month' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('button', { name: 'KPM settings' })).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('P19.3-T2 AC-1 Overview case 7: an AB with nobody coached opens their member page', async () => {
    render(SETTING_UP);
    await loaded();
    const hendra = within(section('AB coaching frequency')).getByRole('link', { name: 'Hendra Wibowo' });
    expect(hendra.closest('li')).toHaveTextContent('6/31 · 19%');
    expect(hendra).toHaveAttribute('href', '/people/members/mem-hendra');
  });

  it.each([375, 768, 1280])('P19.3-T2 AC-3 at %ipx: Pengaturan KPM is on the Overview, its line says what waits, and it opens the settings list', async (px) => {
    atWidth(px);
    render(SETTING_UP);
    await loaded();
    const card = document.querySelector('[data-settings-card]')!;
    expect(card).toHaveTextContent('KPM settings11 settings · 2 products waiting for you · checklist draft version 2');
    await userEvent.click(screen.getByRole('button', { name: 'KPM settings' }));
    const sheet = await screen.findByRole('dialog', { name: 'KPM settings' });
    const rows = within(sheet).getAllByRole('listitem');
    // The ten pages in the menu's order, Activity types first, Branch info last.
    expect(rows.map((r) => within(r).getAllByRole('link')[0].textContent)).toEqual([
      'Activity types', 'Lead statuses', 'Activation checklist', 'Training', 'Capability Mapping', 'Events', 'Campaigns',
      'Products', 'Recruitment pitch', 'Branch info',
    ]);
    // Amber pills for what waits; Ratio benchmarks its own link under Activity types — two taps from the Overview.
    expect(rows[7]).toHaveTextContent('2 waiting');
    expect(rows[2]).toHaveTextContent('Draft version 2');
    expect(within(rows[0]).getByRole('link', { name: 'and Ratio benchmarks' })).toHaveAttribute('href', '/kpm/settings/ratio-benchmarks');
    expect(within(rows[1]).getByRole('link', { name: 'Lead statuses' })).toHaveAttribute('href', '/kpm/settings/lead-statuses');
  });

  it('P19.3-T2 AC-3 Overview case 0: Lead statuses is two taps from a running KPM’s Overview', async () => {
    render(SETTING_UP);
    await loaded();
    await userEvent.click(screen.getByRole('button', { name: 'KPM settings' }));
    expect(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Lead statuses' })).toHaveAttribute('href', '/kpm/settings/lead-statuses');
  });

  it.each([375, 768, 1280])('P19.3-T2 AC-4 Overview case 1 at %ipx: KaiZen — Siapkan KPM 0 of 7, seven steps and All settings; four tiles; no ranking list', async (px) => {
    atWidth(px);
    render(SETTING_UP, {}, KAIZEN);
    await screen.findByRole('region', { name: 'Set up your KPM' });
    const card = within(setupCard());
    expect(card.getByText('0 of 7 done')).toBeInTheDocument();
    const steps = card.getAllByRole('listitem');
    expect(steps.map((li) => li.textContent!.replace(/ — (done|to do)/, ''))).toEqual([
      '1Branch infoAddress and phone not filled in yet',
      '2Activity typesCheck the activities and ratio benchmarks',
      '3Activation checklistCheck the 90-day checklist for new agents',
      '4ProductsChoose the products agents sell',
      '5Import membersOnly 1 member so far: you',
      '6Upload production Nov 2026Open until 7 Dec 2026',
      '7Set the recruitment targetNo target set',
      'All settings11 pages',
    ]);
    expect(document.querySelectorAll('[data-overview="tiles"] [data-stat-tile]')).toHaveLength(4);
    for (const name of ['AB coaching frequency', 'Units furthest behind target', 'Recruitment pipeline', 'Not logged · 7 days']) {
      expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
    }
    // Production: *Belum diunggah* and *Unggah Nov 2026 ›*; January to October named nowhere (UI-150).
    expect(within(statTile('Production — this year')).getByRole('link', { name: 'Upload Nov 2026 ›' })).toHaveAttribute('href', '/kpm/data-upload?month=2026-11');
    expect(document.body.textContent).not.toMatch(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct) 2026/);
    // Pengaturan KPM stays on every Overview (R1b).
    expect(document.querySelector('[data-settings-card]')).not.toBeNull();
  });

  it('P19.3-T2 AC-4: each step opens its page — a settings page, Import people, Data upload on the open month', async () => {
    render(SETTING_UP, {}, KAIZEN);
    await screen.findByRole('region', { name: 'Set up your KPM' });
    const hrefs = [...setupCard().querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/kpm/settings/branch-info', '/kpm/settings/activity-types', '/kpm/settings/activation-checklist', '/kpm/settings/products',
      '/people/import', '/kpm/data-upload?month=2026-11',
    ]);
    // *Semua pengaturan ›* opens the same settings list as *Pengaturan KPM ›*.
    await userEvent.click(within(setupCard()).getByRole('button', { name: /^All settings/ }));
    expect(await screen.findByRole('dialog', { name: 'KPM settings' })).toBeInTheDocument();
  });

  it('P19.3-T2 AC-4: from 1024px the steps sit in two rows of four, the eighth cell All settings; one column below it', async () => {
    render(SETTING_UP, {}, KAIZEN);
    await screen.findByRole('region', { name: 'Set up your KPM' });
    const grid = setupCard().querySelector('ol')!;
    expect(grid.children).toHaveLength(8);
    for (const px of [1024, 1280]) expect(wears(grid, px).split(' ')).toContain('grid-cols-4');
    for (const px of [375, 768]) expect(wears(grid, px).split(' ')).toContain('grid-cols-1');
    // 48px steps.
    for (const step of setupCard().querySelectorAll('[data-step]')) expect(step.className).toContain('min-h-12');
  });

  it('P19.3-T2 AC-5: a step done is ticked — its ✓, and said done to a screen reader', async () => {
    render(SETTING_UP, {}, { ...KAIZEN, setup: setupWith(['activation-checklist', 'import'], { members: 11 }) });
    await screen.findByRole('region', { name: 'Set up your KPM' });
    const card = within(setupCard());
    expect(card.getByText('2 of 7 done')).toBeInTheDocument();
    const steps = card.getAllByRole('listitem');
    expect(steps[2]).toHaveTextContent('✓Activation checklist — done');
    expect(steps[4]).toHaveTextContent('Import members — done11 members');
    expect(steps[0]).toHaveTextContent('1Branch info — to do');
  });

  it('P19.3-T2 AC-5 step 7: the target sheet saves this month’s target, says Saved, and ticks the step without a reload', async () => {
    const { calls } = render(SETTING_UP, {
      'PUT /kpm/overview/recruit-target': (call: { body: unknown }) => ({ body: call.body }),
    }, { ...KAIZEN, setup: setupWith(['import']) });
    await screen.findByRole('region', { name: 'Set up your KPM' });
    await userEvent.click(within(setupCard()).getByRole('button', { name: /^Set the recruitment target/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Recruitment target this month' });
    await userEvent.type(within(sheet).getByLabelText('Target'), '3');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByRole('status')).toHaveTextContent('Saved');
    expect(writes(calls).map((c) => JSON.parse(String(c.init.body)))).toEqual([{ month: '2026-11', target: 3 }]);
    expect(within(setupCard()).getByText('2 of 7 done')).toBeInTheDocument();
    expect(within(setupCard()).getAllByRole('listitem')[6]).toHaveTextContent('Set the recruitment target — doneTarget 3');
    expect(overviewCalls(calls)).toHaveLength(1);
  });

  it('P19.3-T2 AC-5 Overview case 4: the seventh step done takes the card away', async () => {
    render(SETTING_UP, {
      'PUT /kpm/overview/recruit-target': (call: { body: unknown }) => ({ body: call.body }),
    }, { ...KAIZEN, setup: setupWith(['branch-info', 'activity-types', 'activation-checklist', 'products', 'import', 'upload']) });
    await screen.findByRole('region', { name: 'Set up your KPM' });
    await userEvent.click(within(setupCard()).getByRole('button', { name: /^Set the recruitment target/ }));
    const sheet = await screen.findByRole('dialog');
    await userEvent.type(within(sheet).getByLabelText('Target'), '5');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Set up your KPM' })).not.toBeInTheDocument());
  });

  it('P19.3-T2 AC-4 UI-149: a running KPM — setup null — draws no card', async () => {
    render(SETTING_UP);
    await loaded();
    expect(screen.queryByRole('region', { name: 'Set up your KPM' })).not.toBeInTheDocument();
  });

  it('P19.3-T2 AC-4: KaiZen’s Overview stays within 1.2 screens at 375 × 812 — the card, the tiles and Pengaturan KPM alone', async () => {
    atWidth(375);
    render(SETTING_UP, {}, KAIZEN);
    await screen.findByRole('region', { name: 'Set up your KPM' });
    // jsdom lays nothing out, so the budget is read as the blocks drawn: the card (8 rows of 48px), two rows of tiles,
    // and one row — nothing else below the tiles.
    const blocks = [...document.querySelectorAll('[data-setup-card], [data-overview]')].map((el) => el.getAttribute('data-overview') ?? 'setup');
    expect(blocks).toEqual(['setup', 'tiles', 'cards']);
    expect(document.querySelector('[data-overview="cards"]')!.children).toHaveLength(1);
  });

  it('P19.3-T2 AC-1: a reader the server would refuse a page sees it without a link — no Data upload, no Unit Dashboard', async () => {
    render(OWNER);
    await loaded();
    expect(within(statTile('Production — this year')).queryByRole('link')).not.toBeInTheDocument();
    expect(within(section('Units furthest behind target')).queryByRole('link')).not.toBeInTheDocument();
  });
});
