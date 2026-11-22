import { screen, waitFor, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnitDashboardPage from '@/app/(agent)/unit/dashboard/page';
import { atWidth, InLanguage, makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import { TenantConfigProvider } from '@/lib/tenant-config-cache';
import { AGUS_ME, dashboard } from '@test/unit-dashboard-fixtures';
import {
  potensiMonths, type PotensiPerson, type PotensiUnit, type UnitPotensiPersonView, type UnitPotensiView,
} from '@/lib/unit-dashboard';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/**
 * **P19.1-T6 — the Unit Dashboard's *Potensi* tab** (UI-155, UI-159 item 4; the Potensi stop-motion, frames 11–31) —
 * **as the owner's mobile review of 7 November 2026 redrew it** (P19.8-T4; MOB UI-171, UI-179, UI-182, UI-186; ADR-0229
 * §1, §4, §8; `unit-mobile-stopmotion-2026-11-07.html?tab=potensi`): the tab and who sees it, the month picker (a menu
 * under its button), the *Active Agent* and *Rekrut* tiles with their *potensi x*, the legend, the cards in the
 * Overview's order with the whole team in every month, the marks, and the read-only sheets.
 *
 * *Rewritten 2026-11-07:* P19.1-T6's AC-3 order (units first, *Langsung ke AB* last), AC-4's pills and sorting, AC-9's
 * one row per unit in an earlier month and AC-10's empty card gave way to ADR-0229; their tests went with them.
 *
 * *Changed 2026-11-20 (P19.18-T3; ADR-0271 §8):* the ✓ is *Active Agent* from the upload and the Rekrut view's green mark a
 * number (the new hires a person registered who joined this month); a card's *Active Agent* header counts **people** with a
 * potensi, its *Rekrut* header reads *n rekrut · potensi m*; the leader's photo on every header; the level label orange.
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
    // The server's since P19.18-T3 AC-1 (ADR-0271 §8): the people with a sales potensi — never the sum of their leads.
    potensi: people.filter((p) => p.aa.potensi > 0).length, aa: people.filter((p) => p.aa.aa).length,
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

/** Agus's group, as the server answers it since ADR-0229 §4: *Unit Anda* (Agus's own card) first, then Sari's unit. */
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
  tiles: { aa: 4, rekrut: 1, potensi: { aa: 4, rekrut: 2 } }, units: [AGUS_UNIT, SARI_UNIT],
  scope: 'direct', scopes: { offered: ['direct'], default: 'direct' }, informal: null, ...over,
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
const tiles = () => screen.findByRole('radiogroup', { name: 'Active Agent or Rekrut' });
const cards = () => screen.getAllByRole('region').filter((r) => r.hasAttribute('data-potensi-unit'));

describe('P19.1-T6, P19.8-T4 the Potensi tab', () => {
  beforeEach(() => { nav.replace.mockClear(); nav.search = ''; });
  afterEach(() => vi.unstubAllGlobals());

  describe('AC-1 the tab, and who sees it (P19.1-T6)', () => {
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

  describe('P19.8-T4 AC-12 MOB UI-171 the month picker: a menu under its button', () => {
    it('P19.8-T4 AC-12 MOB UI-171 opens on this month, a header button — no native select; the menu holds this month and the eleven before it', async () => {
      const { calls } = render();
      await tiles();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(document.querySelector('select')).toBeNull();
      const button = screen.getByRole('button', { name: 'Month November 2026' });
      expect(button).toHaveClass('min-h-11', 'text-base', 'font-semibold');
      await userEvent.click(button);
      const menu = screen.getByRole('listbox', { name: 'Month' });
      expect(within(menu).getAllByRole('option')).toHaveLength(12);
      expect(within(menu).getByRole('option', { name: 'November 2026', selected: true })).toBeInTheDocument();
      await userEvent.click(within(menu).getByRole('option', { name: 'October 2026' }));
      await waitFor(() => expect(calls.some((c) => c.url.includes('/unit/dashboard/potensi?month=2026-10'))).toBe(true));
    });

    it('P19.1-T6 AC-2 the picker offers this month and the eleven before it', () => {
      expect(potensiMonths('2026-11')).toEqual([
        '2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02',
        '2026-01', '2025-12',
      ]);
    });
  });

  describe('P19.8-T4 AC-9 MOB UI-186 the tiles: Active Agent and Rekrut, each with potensi x', () => {
    it('P19.8-T4 AC-9 MOB UI-186 the tiles read Active Agent and Rekrut, the number, and potensi x under it — not dari 12', async () => {
      const { calls } = render();
      const group = await tiles();
      const [aa, rekrut] = within(group).getAllByRole('radio');
      expect(aa).toHaveAttribute('aria-checked', 'true');
      expect(aa).toHaveClass('bg-secondary', 'text-secondary-contrast');
      expect(aa).toHaveTextContent(/^Active Agent4potensi 4$/);
      expect(rekrut).toHaveTextContent(/^Rekrut1potensi 2$/);
      expect(group.textContent).not.toMatch(/dari|of \d/);
      const before = calls.length;
      await userEvent.click(rekrut);
      expect(rekrut).toHaveAttribute('aria-checked', 'true');
      expect(rekrut).toHaveClass('bg-secondary');
      expect(aa).toHaveAttribute('aria-checked', 'false');
      // The answer holds both: no read.
      expect(calls.length).toBe(before);
    });

    it('P19.18-T3 AC-2 the legend: ① potensi · ✓ Active Agent, and ① potensi rekrut (kandidat) · ① jumlah berhasil rekrut on Rekrut', async () => {
      render(potensi(), { language: 'id' });
      await screen.findByRole('radiogroup', { name: 'Active Agent atau Rekrut' });
      // The orange number first, then the green mark — the rows' order.
      const legend = document.querySelector('[data-potensi-legend]')!;
      expect(legend.textContent).toBe('1potensiActive Agent');
      await userEvent.click(screen.getAllByRole('radio')[1]);
      const rekrut = document.querySelector('[data-potensi-legend]')!;
      expect(rekrut.textContent).toBe('1potensi rekrut (kandidat)1jumlah berhasil rekrut');
      expect(rekrut.querySelector('[data-recruited]')).toHaveClass('bg-pill-green', 'text-pill-green-ink');
    });

    it('P19.8-T4 AC-9 MOB UI-186 a person’s mark: the orange number, the green ✓, both, or the grey ✕ — per tile', async () => {
      render();
      await tiles();
      const [agus, sari] = cards();
      const rows = (card: HTMLElement) => within(card).getAllByRole('listitem');
      const marks = (li: HTMLElement) => li.querySelector('[data-potensi-marks]')!;
      // Sari: potensi 1 and Active Agent — the number, then the ✓.
      const sariRow = rows(sari)[0];
      const [number, check] = Array.from(marks(sariRow).children).filter((el) => el.getAttribute('aria-hidden') === 'true');
      expect(number).toHaveTextContent('1');
      expect(number).toHaveClass('bg-primary-50', 'text-primary-deep');
      expect(check).toHaveClass('bg-pill-green', 'text-pill-green-ink');
      expect(sariRow.querySelector('.sr-only')).toHaveTextContent('1 potensi, Active Agent');
      // Eko: neither — the grey ✕.
      const eko = rows(agus)[1];
      expect(eko.querySelector('[data-potensi-marks] .text-signal-grey')).not.toBeNull();
      expect(eko.querySelector('.sr-only')).toHaveTextContent('No potensi and no ✓ yet');
      // No yellow pill and no green AA ✓ pill any more.
      expect(document.querySelector('.bg-potensi')).toBeNull();
      expect(document.body.textContent).not.toContain('AA ✓');
      // On Rekrut: Rina's recruit potensi and the one she recruited, Yosef's recruit potensi alone.
      await userEvent.click(screen.getAllByRole('radio')[1]);
      expect(rows(cards()[1])[3].querySelector('.sr-only')).toHaveTextContent('1 potensi, 1 recruited this month');
      expect(rows(cards()[0])[2].querySelector('.sr-only')).toHaveTextContent('1 potensi');
    });
  });

  describe('P19.8-T4 AC-4 MOB UI-179 one group order and name, as the Overview', () => {
    it('P19.8-T4 AC-4 MOB UI-179 Unit Anda first, then Unit Sari Puspita, in sentence case; each leader first with the orange level label', async () => {
      render(potensi(), { language: 'id' });
      await screen.findByRole('radiogroup', { name: 'Active Agent atau Rekrut' });
      const [agus, sari] = cards();
      expect(agus).toHaveAccessibleName('Unit Anda');
      expect(sari).toHaveAccessibleName('Unit Sari Puspita');
      expect(within(sari).getByRole('heading', { name: 'Unit Sari Puspita' })).not.toHaveClass('uppercase');
      expect(within(sari).getByRole('heading', { name: 'Unit Sari Puspita' })).toHaveClass('text-md', 'font-bold');
      const firstRow = within(sari).getAllByRole('listitem')[0];
      expect(firstRow.querySelector('[data-potensi-name]')!.textContent).toBe('AABSari Puspita');
      // P19.18-T3 AC-3 (ADR-0266 §3): small bold orange text, never the navy tag.
      expect(firstRow.querySelector('[data-rung-tag]')).toHaveTextContent('AAB');
      expect(firstRow.querySelector('[data-rung-tag]')).toHaveClass('text-primary-ink');
      expect(firstRow.querySelector('.bg-secondary')).toBeNull();
    });

    it('P19.11-T6 AC-4 one rule with the roster: the tag is a leader’s rung’s — AB, AAB — never an Agent’s, even at a card’s head', async () => {
      // A card led by somebody on an Agent's rung who leads somebody (the server's `isUnitHead`): no tag before them.
      const ledByAgent = unit('unit', [
        person('Dedi Kurniawan', 'AGENT', { isLeader: true }),
        person('Fajar Nugraha', 'AGENT'),
      ]);
      render(potensi({ units: [AGUS_UNIT, SARI_UNIT, ledByAgent] }));
      await tiles();
      const tags = [...document.querySelectorAll('[data-rung-tag]')].map((tag) => tag.textContent);
      expect(tags).toEqual(['AB', 'AAB']);
      const dedi = within(cards()[2]).getAllByRole('listitem')[0];
      expect(dedi.querySelector('[data-potensi-name]')!.textContent).toBe('Dedi Kurniawan');
    });

    it('P19.8-T4 AC-4 MOB UI-179 a unit below the reader names its head’s card Unit {name}', async () => {
      render(potensi({ head: { membershipId: 'mem-agus', name: 'Agus Prasetyo', isReader: false } }), { language: 'id' });
      await screen.findByRole('radiogroup', { name: 'Active Agent atau Rekrut' });
      expect(cards()[0]).toHaveAccessibleName('Unit Agus Prasetyo');
    });

    it('P19.8-T4 AC-4 MOB UI-179 the rows keep the roster’s order on both tiles: the same people, the same places', async () => {
      render();
      await tiles();
      const names = () => within(cards()[1]).getAllByRole('listitem').map((li) => li.querySelector('[data-potensi-name]')!.textContent);
      const onAa = names();
      expect(onAa).toEqual(['AABSari Puspita', 'Andi Nugroho', 'Lina Marlina', 'Rina Wijaya', 'Budi Santoso']);
      await userEvent.click(screen.getAllByRole('radio')[1]);
      expect(names()).toEqual(onAa);
      expect(within(cards()[1]).getByText('1 rekrut · potensi 1')).toBeInTheDocument();
    });
  });

  describe('P19.8-T4 AC-10 MOB UI-182 the whole team in every month', () => {
    it('P19.8-T4 AC-10 MOB UI-182 an earlier month lists everybody under each group; the headers keep their words', async () => {
      render(potensi({ month: '2026-10' }));
      await tiles();
      const [agus, sari] = cards();
      expect(within(sari).getAllByRole('listitem')).toHaveLength(5);
      expect(within(agus).getAllByRole('listitem')).toHaveLength(3);
      expect(within(sari).getByText('potensi 2/4 · 2 AA')).toBeInTheDocument();
      expect(within(agus).getByText('2 AA')).toBeInTheDocument();
      await userEvent.click(screen.getAllByRole('radio')[1]);
      expect(within(sari).getByText('potensi 1/1 rekrut')).toBeInTheDocument();
      expect(within(agus).getByText('potensi 0/1 rekrut')).toBeInTheDocument();
    });

    it('P19.8-T4 AC-10 MOB UI-182 a month with nothing switched on: the whole team, each ✕, and no empty line', async () => {
      const quiet = (p: PotensiPerson): PotensiPerson => ({
        ...p, aa: { potensi: 0, aa: false, switched: 0 }, rekrut: { potensi: 0, rekrut: 0, switched: 0 },
      });
      render(potensi({
        month: '2025-12',
        tiles: { aa: 0, rekrut: 0, potensi: { aa: 0, rekrut: 0 } },
        units: [unit('direct', AGUS_UNIT.people.map(quiet)), unit('unit', SARI_UNIT.people.map(quiet))],
      }), { language: 'id' });
      await screen.findByRole('radiogroup', { name: 'Active Agent atau Rekrut' });
      const rows = cards().flatMap((card) => within(card).getAllByRole('listitem'));
      expect(rows).toHaveLength(8);
      expect(rows.every((li) => li.getAttribute('data-potensi-row') === 'none')).toBe(true);
      expect(screen.queryByText('Belum ada potensi.')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('P19.8-T4 AC-10 MOB UI-182 a person’s sheet opens from an earlier month, for that month', async () => {
      const { calls } = render(potensi({ month: '2026-10' }), {
        routes: { 'GET /unit/dashboard/potensi/m-rina': { body: { ...SHEET, month: '2026-10' } } },
      });
      await tiles();
      await userEvent.click(screen.getByRole('button', { name: /^Open Rina Wijaya/ }));
      expect(await screen.findByRole('dialog', { name: 'Agent Rina Wijaya · 2 potensi' })).toBeInTheDocument();
      expect(calls.some((c) => c.url.endsWith('/unit/dashboard/potensi/m-rina?month=2026-10'))).toBe(true);
    });
  });

  describe('P19.18-T3 the counts, the marks and the cards (ADR-0271 §8)', () => {
    /** Indah 3 potensi, Lukman 1 (the brief's example), Lukman 2 recruited and 2 kandidat, Indah 1 recruited, Budi 1 kandidat. */
    const EXAMPLE = unit('direct', [
      person('Agus Prasetyo', 'AB', { isLeader: true, isReader: true, photoUrl: 'https://cdn.test/agus.jpg' }),
      // An AAB with no team of her own sits in Unit Anda, after the AB (the server's placing).
      person('Dewi Lestari', 'AAB', { aa: { potensi: 0, aa: true, switched: 0 } }),
      person('Indah Permatasari', 'AGENT', { aa: { potensi: 3, aa: false, switched: 3 }, rekrut: { potensi: 0, rekrut: 1, switched: 0 } }),
      person('Lukman Hakim', 'AGENT', { aa: { potensi: 1, aa: true, switched: 1 }, rekrut: { potensi: 2, rekrut: 2, switched: 2 } }),
      person('Budi Santoso', 'AGENT', { rekrut: { potensi: 1, rekrut: 0, switched: 1 } }),
      person('Yanti Kusuma', 'AGENT'),
    ]);
    const example = () => potensi({ units: [EXAMPLE], tiles: { aa: 2, rekrut: 3, potensi: { aa: 2, rekrut: 3 } } });

    it('P19.18-T3 AC-1 the Active Agent header and tile count people who can become Active Agent: Indah 3 + Lukman 1 → 2 potensi', async () => {
      render(example());
      const group = await tiles();
      expect(within(cards()[0]).getByText('2 potensi · 2 AA')).toBeInTheDocument();
      expect(within(group).getAllByRole('radio')[0]).toHaveTextContent(/^Active Agent2potensi 2$/);
      // A person's orange number is still their own count: Indah 3.
      const indah = within(cards()[0]).getAllByRole('listitem')[2];
      expect(indah.querySelector('[data-potensi-marks] .bg-primary-50')).toHaveTextContent('3');
    });

    it('P19.18-T3 AC-2 the Rekrut view: the orange number first, then the green number — n recruited — or the grey ✕; the header and the tile sums', async () => {
      render(example());
      await userEvent.click(within(await tiles()).getAllByRole('radio')[1]);
      const rows = within(cards()[0]).getAllByRole('listitem');
      const marks = (li: HTMLElement) => Array.from(li.querySelector('[data-potensi-marks]')!.children)
        .filter((el) => el.getAttribute('aria-hidden') === 'true');
      // Lukman: 2 kandidat, then 2 recruited — orange, then green.
      const [orange, green] = marks(rows[3]);
      expect(orange).toHaveTextContent('2');
      expect(orange).toHaveClass('bg-primary-50', 'text-primary-deep');
      expect(green).toHaveTextContent('2');
      expect(green).toHaveAttribute('data-recruited', '2');
      expect(green).toHaveClass('bg-pill-green', 'text-pill-green-ink');
      // Indah: recruited 1, no kandidat — the green number alone; Budi: a kandidat alone; Yanti: neither, the grey ✕.
      expect(marks(rows[2]).map((el) => el.getAttribute('data-recruited'))).toEqual(['1']);
      expect(marks(rows[4])).toHaveLength(1);
      expect(marks(rows[4])[0]).toHaveClass('bg-primary-50');
      expect(rows[5].getAttribute('data-potensi-row')).toBe('none');
      expect(rows[5].querySelector('[data-potensi-marks] .text-signal-grey')).not.toBeNull();
      // Never a ✓ on Rekrut: one person can recruit several.
      expect(cards()[0].querySelector('[data-potensi-marks] svg.lucide-check, [data-potensi-marks] [data-icon="check"]')).toBeNull();
      // The header: *n rekrut · potensi m*, both sums; the tile *Rekrut n · potensi m*.
      expect(within(cards()[0]).getByText('3 rekrut · potensi 3')).toBeInTheDocument();
      expect(within(screen.getByRole('radiogroup')).getAllByRole('radio')[1]).toHaveTextContent(/^Rekrut3potensi 3$/);
    });

    it('P19.18-T3 AC-3 every header carries its leader’s photo — initials without one — and every person theirs; an AAB in Unit Anda keeps her label', async () => {
      render(potensi({ units: [EXAMPLE, SARI_UNIT] }));
      await tiles();
      const [own, sari] = cards();
      expect(own.querySelector('[data-potensi-leader-photo] img')).toHaveAttribute('src', 'https://cdn.test/agus.jpg');
      // Sari has no photo: her initials in the header's avatar.
      expect(sari.querySelector('[data-potensi-leader-photo] img')).toBeNull();
      expect(sari.querySelector('[data-potensi-leader-photo]')).toHaveTextContent('SP');
      expect(within(own).getAllByRole('listitem')[0].querySelector('img')).toHaveAttribute('src', 'https://cdn.test/agus.jpg');
      // Dewi, an AAB with no team, sits after the AB with her orange label — though she leads no card.
      const dewi = within(own).getAllByRole('listitem')[1];
      expect(dewi.querySelector('[data-potensi-name]')!.textContent).toBe('AABDewi Lestari');
      expect(dewi.querySelector('[data-rung-tag]')).toHaveClass('text-primary-ink');
    });

    it('P19.18-T3 AC-3 from 768px three people a row under a header across the card, on the orange tint; one card under another', async () => {
      atWidth(1024);
      render(potensi({ units: [EXAMPLE, SARI_UNIT] }));
      await tiles();
      const [own] = cards();
      expect(own.parentElement).not.toHaveClass('md:grid-cols-2');
      expect(own.querySelector('ul')).toHaveClass('md:grid', 'md:grid-cols-3');
      expect(own.querySelector('header')).toHaveClass('md:bg-primary/[0.12]');
      // Each person but the third of a row is ruled on its right.
      expect(within(own).getAllByRole('listitem')[0]).toHaveClass('md:[&:not(:nth-child(3n))]:border-r');
    });
  });

  describe('AC-6, AC-7 the sheets (P19.1-T6)', () => {
    it('P19.1-T6 AC-6 a row opens Agent Rina’s sheet: her clients by name, the next step, the stage, and Chat Agent Rina', async () => {
      render();
      await tiles();
      await userEvent.click(screen.getByRole('button', { name: /^Open Rina Wijaya/ }));
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
      await userEvent.click(screen.getByRole('button', { name: /^Open Rina Wijaya/ }));
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

  describe('AC-8 the words (P19.1-T6)', () => {
    it('P19.1-T6 AC-8 the screen says potensi and rekrut — never calon, never kode — on both tiles and both sheets', async () => {
      render(potensi(), { language: 'id' });
      const group = await screen.findByRole('radiogroup', { name: 'Active Agent atau Rekrut' });
      const words = [document.body.textContent ?? ''];
      await userEvent.click(within(group).getAllByRole('radio')[1]);
      words.push(document.body.textContent ?? '');
      await userEvent.click(screen.getByRole('button', { name: /^Buka Rina Wijaya/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Agent Rina Wijaya · 1 potensi · 1 rekrut' });
      await within(sheet).findByText('Sdri. Tia Amelia');
      words.push(document.body.textContent ?? '');
      expect(within(sheet).getByText('Chat Agent Rina')).toBeInTheDocument();
      for (const text of words) {
        expect(text).not.toMatch(/calon|kode/i);
        expect(text).toMatch(/potensi/);
      }
      expect(words[1]).toMatch(/rekrut/);
    });
  });

  describe('P19.8-T4 AC-1, AC-15 on a phone, 375 and 360', () => {
    it.each([375, 360])('P19.8-T4 AC-15 MOB UI-182 at %ipx: the picker under the slider, names never cut; axe clean', async (px) => {
      atWidth(px);
      render();
      await tiles();
      // The slider on its own row, the month picker on the row below it.
      const slider = screen.getByRole('tablist', { name: 'Unit Dashboard' });
      const picker = screen.getByRole('button', { name: 'Month November 2026' });
      expect(slider.parentElement!.contains(picker)).toBe(false);
      for (const name of document.querySelectorAll('[data-potensi-name]')) expect(name.className).not.toMatch(/truncate|line-clamp/);
      // Contrast is the tokens' (a11y.spec.tsx); the landmarks are the layout's, which `screens.a11y.spec.tsx` renders.
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  });
});

/**
 * **The views on *Potensi*** (P19.12-T6; ADR-0249): the same view as the Overview, read with the tab's month, the picker
 * beside the month, and the office-wide view's people with no leader as a card of their own, last.
 */
describe('P19.12-T6 the Potensi tab’s view', () => {
  beforeEach(() => { nav.replace.mockClear(); nav.search = ''; });
  afterEach(() => vi.unstubAllGlobals());

  const UNLED = {
    kind: 'unled' as const, leader: null,
    people: [person('Nora Siregar', 'AGENT')],
    totals: totalsOf([person('Nora Siregar', 'AGENT')]),
  };

  it('P19.12-T6 AC-2 the view asked for is read, the picker beside the month; Belum punya leader is the last card', async () => {
    const { calls } = render(potensi({
      units: [AGUS_UNIT, SARI_UNIT, UNLED], scope: 'downline', scopes: { offered: ['direct', 'downline'], default: 'downline' },
    }));
    await tiles();
    const month = screen.getByRole('button', { name: /^Month / });
    expect(month.parentElement).toContainElement(screen.getByRole('button', { name: 'View All downline' }));
    expect(cards().map((c) => c.getAttribute('aria-label'))).toEqual(['Your Unit', 'Sari Puspita’s Unit', 'No leader yet']);
    expect(cards().at(-1)).toHaveTextContent('Nora Siregar');
    await userEvent.click(screen.getByRole('button', { name: 'View All downline' }));
    await userEvent.click(within(screen.getByRole('listbox', { name: 'View' })).getByRole('option', { name: 'Direct group' }));
    expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard?tab=potensi&scope=direct', { scroll: false });
    await waitFor(() => expect(calls.map((c) => c.url)).toContain('http://api.test/api/v1/unit/dashboard/potensi?scope=direct'));
  });

  it('P19.12-T6 AC-2 one view offered: no picker beside the month', async () => {
    render();
    await tiles();
    expect(screen.queryByRole('button', { name: /^View / })).toBeNull();
  });
});
