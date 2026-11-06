import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnitDashboardPage from '@/app/(agent)/unit/dashboard/page';
import { InLanguage, makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import { AGUS_ME, dashboard } from '@test/unit-dashboard-fixtures';
import {
  orderedPeople, pillsOf, potensiMonths, type PotensiPerson, type PotensiUnit, type UnitPotensiPersonView,
  type UnitPotensiView,
} from '@/lib/unit-dashboard';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/**
 * **P19.1-T6 — the Unit Dashboard's *Potensi* tab** (UI-155, UI-159 item 4; the Potensi stop-motion, frames 11–31): the
 * tab and who sees it, the month picker, the two tiles that are the switch, the cards per unit with the leader first,
 * the pills and the rows in one order for both tiles, the read-only sheets, an earlier month and the empty states.
 */
const LEADER = makeMe({
  ...AGUS_ME,
  permissions: [...AGUS_ME.permissions, 'unit_dashboard:read_potensi', 'member:invite'],
});
const AGENT = makeMe({
  ...AGUS_ME,
  membership: { ...AGUS_ME.membership!, orgLevelCode: 'AGENT', hierarchyRole: 'agent' },
  permissions: ['unit_dashboard:read'],
});

const rung = (code: string) => ({ code, label: code === 'AGENT' ? 'Agent' : code });
const person = (name: string, code: string, over: Partial<PotensiPerson> = {}): PotensiPerson => ({
  membershipId: `m-${name.split(' ')[0].toLowerCase()}`, name, photoUrl: null, rung: rung(code), isLeader: false,
  isReader: false, opens: true, aa: { potensi: 0, aa: false, switched: 0 }, rekrut: { potensi: 0, rekrut: 0, switched: 0 },
  ...over,
});
const totalsOf = (people: PotensiPerson[]) => ({
  aa: {
    potensi: people.reduce((s, p) => s + p.aa.potensi, 0), aa: people.filter((p) => p.aa.aa).length,
    switchedPeople: people.filter((p) => p.aa.switched > 0).length,
    switchedPeopleAa: people.filter((p) => p.aa.switched > 0 && p.aa.aa).length,
  },
  rekrut: {
    potensi: people.reduce((s, p) => s + p.rekrut.potensi, 0), rekrut: people.reduce((s, p) => s + p.rekrut.rekrut, 0),
    switchedPeople: people.filter((p) => p.rekrut.switched > 0).length,
    switchedPeopleRekrut: people.filter((p) => p.rekrut.switched > 0 && p.rekrut.rekrut > 0).length,
  },
});
const unit = (kind: PotensiUnit['kind'], people: PotensiPerson[]): PotensiUnit => ({
  kind, leader: { membershipId: people[0].membershipId, name: people[0].name, rung: people[0].rung }, people, totals: totalsOf(people),
});

/** Agus's unit, as the stop-motion draws it: Sari's unit, then *Langsung ke AB Agus*. */
const SARI_UNIT = unit('unit', [
  person('Sari Puspita', 'AAB', { isLeader: true, aa: { potensi: 1, aa: true, switched: 2 } }),
  person('Andi Nugroho', 'AGENT'),
  person('Lina Marlina', 'AGENT', { aa: { potensi: 1, aa: true, switched: 1 } }),
  person('Rina Wijaya', 'AGENT', {
    aa: { potensi: 2, aa: false, switched: 2 }, rekrut: { potensi: 1, rekrut: 1, switched: 2 },
  }),
  person('Budi Santoso', 'AGENT', { aa: { potensi: 1, aa: false, switched: 1 } }),
]);
const AGUS_UNIT = unit('direct', [
  person('Agus Prasetyo', 'AB', { isLeader: true, isReader: true, aa: { potensi: 0, aa: true, switched: 0 } }),
  person('Eko Saputra', 'AGENT'),
  person('Yosef Tambunan', 'AGENT', { aa: { potensi: 0, aa: true, switched: 0 }, rekrut: { potensi: 1, rekrut: 0, switched: 1 } }),
]);
const potensi = (over: Partial<UnitPotensiView> = {}): UnitPotensiView => ({
  month: '2026-11', currentMonth: '2026-11', today: '2026-11-04',
  head: { membershipId: 'mem-agus', name: 'Agus Prasetyo', isReader: true },
  tiles: { aa: 4, rekrut: 1 }, units: [SARI_UNIT, AGUS_UNIT], ...over,
});
const SHEET: UnitPotensiPersonView = {
  month: '2026-11', currentMonth: '2026-11',
  person: { membershipId: 'm-rina', name: 'Rina Wijaya', rung: rung('AGENT'), phone: '+6281211002201', isReader: false },
  unit: { name: 'Sari Puspita', rung: rung('AAB') },
  sales: [
    { id: 'l1', name: 'Ibu Kartika Dewanti', statusCode: 'FOLLOW_UP', nextActionDate: '2026-11-04', nextActionNote: 'Coffee after her shift.' },
    { id: 'l2', name: 'Ibu Rosa Damayanti', statusCode: 'FOLLOW_UP', nextActionDate: '2026-11-04', nextActionNote: 'Grand Indonesia, 10:00' },
  ],
  kandidat: [
    { leadId: 'k1', name: 'Sdri. Tia Amelia', statusCode: 'MEETING_SCHEDULED', state: 'potensi', rekrutOn: null, newHireMembershipId: null },
    { leadId: 'k2', name: 'Sdri. Maya Lestari', statusCode: 'NEW_ACTIVE_AGENT', state: 'rekrut', rekrutOn: '2026-11-03', newHireMembershipId: 'm-maya' },
    { leadId: 'k3', name: 'Sdr. Arya Putra', statusCode: 'NEW_ACTIVE_AGENT', state: 'rekrut', rekrutOn: '2026-11-02', newHireMembershipId: null },
  ],
};

const SHELL = {
  '/kpm/config': {
    body: {
      activity: [], ratios: [], version: 1,
      leadPipelines: [
        { pipeline: 'sales', statuses: [{ id: 's', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' }] },
        { pipeline: 'recruitment', statuses: [{ id: 'r', pipeline: 'recruitment', code: 'MEETING_SCHEDULED', label: 'Meeting scheduled', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' }] },
      ],
    },
  },
  '/kpm/org-levels': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};

function render(view: UnitPotensiView | StubReply = potensi(), { me = LEADER, routes = {}, language }: {
  me?: ReturnType<typeof makeMe>; routes?: Record<string, StubReply | StubReply[]>; language?: 'id';
} = {}) {
  nav.search = 'tab=potensi';
  const stub = stubFetch({
    ...SHELL,
    'GET /unit/dashboard': { body: dashboard() },
    'GET /unit/dashboard/potensi': 'body' in view || 'status' in view ? view as StubReply : { body: view },
    'GET /unit/dashboard/potensi/m-rina': { body: SHEET },
    ...routes,
  });
  const ui = <TenantConfigProvider><UnitDashboardPage /></TenantConfigProvider>;
  renderWithSession(language ? <InLanguage language={language}>{ui}</InLanguage> : ui, { me });
  return stub;
}
const tiles = () => screen.findByRole('radiogroup', { name: 'AA or Rekrut' });
const cards = () => screen.getAllByRole('region').filter((r) => r.hasAttribute('data-potensi-unit'));
/** A row as read: its name (with a leader's role tag) and its pills, without the avatar's initials or the ›. */
const rowNames = (card: HTMLElement) => within(card).getAllByRole('listitem')
  .map((li) => `${li.querySelector('[data-potensi-name]')?.textContent}${li.querySelector('[data-potensi-pills]')?.textContent}`);

describe('P19.1-T6 the Potensi tab (UI-155)', () => {
  beforeEach(() => { nav.replace.mockClear(); nav.search = ''; });
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-1 the tab, and who sees it', () => {
    it('P19.1-T6 AC-1 the tabs read Overview | Activities | Potensi; the tab is ?tab=potensi and reads only its own endpoint', async () => {
      const { calls } = render();
      await tiles();
      const tablist = screen.getByRole('tablist', { name: 'Unit Dashboard' });
      expect(within(tablist).getAllByRole('tab').map((t) => [t.textContent, t.getAttribute('aria-selected')]))
        .toEqual([['Overview', 'false'], ['Activities', 'false'], ['Potensi', 'true']]);
      const reads = calls.map((c) => new URL(c.url).pathname).filter((p) => p.includes('/unit/'));
      expect(reads).toEqual(['/api/v1/unit/dashboard/potensi']);
    });

    it('P19.1-T6 AC-1 switching to it needs no reload: the address follows', async () => {
      nav.search = '';
      stubFetch({ ...SHELL, 'GET /unit/dashboard': { body: dashboard() }, 'GET /unit/dashboard/potensi': { body: potensi() } });
      renderWithSession(<UnitDashboardPage />, { me: LEADER });
      await userEvent.click(await screen.findByRole('tab', { name: 'Potensi' }));
      expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard?tab=potensi', { scroll: false });
      expect(await tiles()).toBeInTheDocument();
    });

    it('P19.1-T6 AC-1 an Agent sees no Potensi tab; a typed ?tab=potensi opens Overview and never asks the tab’s read', async () => {
      const { calls } = render(potensi(), { me: AGENT });
      await waitFor(() => expect(calls.some((c) => new URL(c.url).pathname === '/api/v1/unit/dashboard')).toBe(true));
      expect(screen.queryByRole('tab', { name: 'Potensi' })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
      expect(calls.some((c) => c.url.includes('/potensi'))).toBe(false);
    });
  });

  describe('AC-2 the month picker and the two tiles', () => {
    it('P19.1-T6 AC-2 opens on this month; the tiles are a switch, AA chosen; Rekrut swaps the list with no read', async () => {
      const { calls } = render();
      const group = await tiles();
      expect(screen.getByRole('combobox', { name: 'Month' })).toHaveDisplayValue('November 2026');
      const [aa, rekrut] = within(group).getAllByRole('radio');
      expect(aa).toHaveAttribute('aria-checked', 'true');
      expect(aa).toHaveClass('bg-secondary', 'text-secondary-contrast');
      expect(aa).toHaveTextContent(/^AA4$/);
      expect(rekrut).toHaveTextContent(/^Rekrut1$/);
      const before = calls.length;
      await userEvent.click(rekrut);
      expect(rekrut).toHaveAttribute('aria-checked', 'true');
      expect(aa).toHaveAttribute('aria-checked', 'false');
      expect(within(cards()[0]).getByText('1 potensi · 1 rekrut')).toBeInTheDocument();
      expect(calls.length).toBe(before);
    });

    it('P19.1-T6 AC-2 the picker offers this month and the eleven before it', () => {
      expect(potensiMonths('2026-11')).toEqual([
        '2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02',
        '2026-01', '2025-12',
      ]);
    });
  });

  describe('AC-3, AC-4 one list design for both tiles', () => {
    it('P19.1-T6 AC-3 one card per unit below, then the head’s own; each leader first with a navy role tag', async () => {
      render();
      await tiles();
      const [sari, agus] = cards();
      expect(sari).toHaveAccessibleName('Unit AAB Sari Puspita');
      expect(agus).toHaveAccessibleName('Direct to AB Agus');
      expect(within(sari).getByRole('banner')).toHaveClass('uppercase');
      expect(rowNames(sari)[0]).toMatch(/^AABSari Puspita/);
      expect(within(sari).getAllByRole('listitem')[0].querySelector('.bg-secondary')).toHaveTextContent('AAB');
    });

    it('P19.1-T6 AC-4 rows: the leader, then potensi only, then ✓, then ✕ — the same order on both tiles', async () => {
      render();
      await tiles();
      expect(rowNames(cards()[0])).toEqual([
        'AABSari Puspita1 potensiAA ✓', 'Rina Wijaya2 potensi', 'Budi Santoso1 potensi', 'Lina Marlina1 potensiAA ✓', 'Andi Nugroho✕',
      ]);
      expect(within(cards()[0]).getByText('5 potensi · 2 AA')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('radio', { name: /Rekrut/ }));
      expect(rowNames(cards()[0])).toEqual([
        'AABSari Puspita✕', 'Rina Wijaya1 potensi1 rekrut ✓', 'Andi Nugroho✕', 'Lina Marlina✕', 'Budi Santoso✕',
      ]);
    });

    it('P19.1-T6 AC-4 pills: n potensi in yellow left of the green ✓, or ✕ named with the person greyed', async () => {
      render();
      await tiles();
      const lina = within(cards()[0]).getAllByRole('listitem')[3];
      const [pot, done] = within(lina).getAllByText(/potensi|AA ✓/);
      expect(pot).toHaveClass('bg-potensi', 'text-potensi-ink');
      expect(done).toHaveClass('bg-pill-green', 'text-pill-green-ink');
      const andi = within(cards()[0]).getAllByRole('listitem')[4];
      expect(within(andi).getByRole('img', { name: 'No potensi and no ✓ yet' })).toHaveClass('bg-pill-grey');
      expect(within(andi).getByText('Andi Nugroho')).toHaveClass('text-pill-grey-ink');
    });

    it('P19.1-T6 AC-4 the order and pills are one rule, computed from the server’s figures', () => {
      const rows = orderedPeople(SARI_UNIT, 'aa').map((p) => p.name);
      expect(rows).toEqual(['Sari Puspita', 'Rina Wijaya', 'Budi Santoso', 'Lina Marlina', 'Andi Nugroho']);
      expect(pillsOf(SARI_UNIT.people[3], 'rekrut')).toEqual({ potensi: 1, done: 1, none: false });
      expect(pillsOf(SARI_UNIT.people[1], 'aa')).toEqual({ potensi: 0, done: 0, none: true });
    });
  });

  describe('AC-6, AC-7 the sheets', () => {
    it('P19.1-T6 AC-6 a row opens Agent Rina’s sheet: her clients by name, the next step, the stage, and Chat Agent Rina', async () => {
      render();
      await tiles();
      await userEvent.click(screen.getByRole('button', { name: 'Open Rina Wijaya' }));
      const sheet = within(await screen.findByRole('dialog', { name: 'Agent Rina Wijaya · 2 potensi' }));
      expect(sheet.getByText('Unit AAB Sari Puspita')).toBeInTheDocument();
      expect(await sheet.findByText('Ibu Kartika Dewanti')).toBeInTheDocument();
      expect(sheet.getAllByText('Follow-up')).toHaveLength(2);
      expect(sheet.getByText(/Coffee after her shift\./)).toBeInTheDocument();
      expect(sheet.getByRole('link', { name: 'Chat Agent Rina' })).toHaveAttribute('href', expect.stringContaining('wa.me/6281211002201'));
      // Read-only: nothing on it writes.
      expect(sheet.queryByRole('switch')).not.toBeInTheDocument();
      expect(sheet.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('P19.1-T6 AC-7 the Rekrut sheet: a kandidat’s Potensi, a rekrut’s date and New Hires ›, or Tambahkan ke unit › with the name typed in', async () => {
      const { calls } = render(potensi(), {
        routes: { '/auth/leader-code': { body: { code: 'AGUS01' } }, 'POST /new-hires/agents': { body: { outcome: 'linked', member: { membershipId: 'm-arya', fullName: 'Arya Putra' } } } },
      });
      await userEvent.click(within(await tiles()).getAllByRole('radio')[1]);
      await userEvent.click(screen.getByRole('button', { name: 'Open Rina Wijaya' }));
      const sheet = within(await screen.findByRole('dialog', { name: 'Agent Rina Wijaya · 1 potensi · 1 rekrut' }));
      expect(await sheet.findByText('Sdri. Tia Amelia')).toBeInTheDocument();
      expect(sheet.getByText('Potensi')).toHaveClass('bg-potensi');
      expect(sheet.getByText('Rekrut ✓ 3 Nov')).toHaveClass('bg-pill-green');
      expect(sheet.getByRole('link', { name: 'New Hires ›' })).toHaveAttribute('href', '/new-hires/m-maya');
      await userEvent.click(sheet.getByRole('button', { name: 'Add to unit ›' }));
      const form = await screen.findByRole('dialog', { name: /Add agent/i });
      expect(within(form).getByLabelText(/^Name/)).toHaveValue('Sdr. Arya Putra');
      await userEvent.type(within(form).getByLabelText(/Agent code/), '80777');
      await userEvent.type(within(form).getByLabelText(/WhatsApp/), '0812-3456-7890');
      await userEvent.click(within(form).getByRole('button', { name: 'Add & send invite' }));
      await waitFor(() => {
        const post = calls.find((c) => c.init.method === 'POST' && c.url.includes('/new-hires/agents'));
        expect(JSON.parse(String(post?.init.body))).toMatchObject({ fullName: 'Sdr. Arya Putra', recruitLeadId: 'k3' });
      });
    });
  });

  describe('AC-8 the words', () => {
    it('P19.1-T6 AC-8 the screen says potensi and rekrut — never calon, never kode — on both tiles and both sheets', async () => {
      render(potensi(), { language: 'id' });
      const group = await screen.findByRole('radiogroup', { name: 'AA atau Rekrut' });
      const words = [document.body.textContent ?? ''];
      await userEvent.click(within(group).getAllByRole('radio')[1]);
      words.push(document.body.textContent ?? '');
      await userEvent.click(screen.getByRole('button', { name: 'Buka Rina Wijaya' }));
      const sheet = await screen.findByRole('dialog', { name: 'Agent Rina Wijaya · 1 potensi · 1 rekrut' });
      await within(sheet).findByText('Sdri. Tia Amelia');
      words.push(document.body.textContent ?? '');
      expect(within(sheet).getByText('Chat Agent Rina')).toBeInTheDocument();
      for (const text of words) {
        expect(text).not.toMatch(/calon|kode/i);
        expect(text).toMatch(/potensi/);
      }
      expect(words[1]).toMatch(/rekrut/);
      expect(screen.getAllByText('LANGSUNG KE AB AGUS'.toLowerCase(), { exact: false, normalizer: (s) => s.toLowerCase() }).length).toBeGreaterThan(0);
    });
  });

  describe('AC-9, AC-10 an earlier month, and nothing yet', () => {
    it('P19.1-T6 AC-9 an earlier month: the tiles, and one row per unit — potensi x/y · n AA, potensi x/y rekrut', async () => {
      const { calls } = render(potensi({ month: '2026-10' }));
      await tiles();
      const list = screen.getByRole('list', { name: 'October 2026' });
      expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Unit AAB Sari Puspitapotensi 2/4 · 2 AA', 'Direct to AB Agus2 AA',
      ]);
      await userEvent.click(screen.getByRole('radio', { name: /Rekrut/ }));
      expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Unit AAB Sari Puspitapotensi 1/1 rekrut', 'Direct to AB Aguspotensi 0/1 rekrut',
      ]);
      // The month picked is asked for.
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-09');
      await waitFor(() => expect(calls.some((c) => c.url.includes('/unit/dashboard/potensi?month=2026-09'))).toBe(true));
    });

    it('P19.1-T6 AC-10 nobody with a potensi or a ✓: Belum ada potensi., and the line — never an error', async () => {
      const quiet = unit('direct', [person('Dewi Lestari', 'AAB', { isLeader: true, isReader: true })]);
      render(potensi({ tiles: { aa: 0, rekrut: 0 }, units: [quiet] }), { language: 'id' });
      await screen.findByRole('radiogroup', { name: 'AA atau Rekrut' });
      expect(screen.getByText('Belum ada potensi.')).toBeInTheDocument();
      expect(screen.getByText('Agent menyalakannya di Leads.')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await userEvent.click(screen.getAllByRole('radio')[1]);
      expect(screen.getByText('Belum ada potensi rekrut.')).toBeInTheDocument();
    });
  });
});
