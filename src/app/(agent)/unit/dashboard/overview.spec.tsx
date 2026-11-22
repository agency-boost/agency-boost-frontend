import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderWithSession, stubFetch, type StubReply } from '@test/harness';
import {
  AGUS_ME, AGUS_ROW, ARIEF, dashboard, DIMAS, EMPTY, INDAH, NEW_HIRE_VIEW, rp, SITI, UNITS,
} from '@test/unit-dashboard-fixtures';
import type { UnitDashboardView } from '@/lib/unit-dashboard';
import UnitDashboardPage from './page';

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  usePathname: () => '/unit/dashboard',
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The Owner in their field view: `member:invite`, so *+ Tambah agent* is theirs; the card is the server's to say. */
const OWNER_ME = makeMe({
  ...AGUS_ME,
  membership: { ...AGUS_ME.membership!, isKpmOwner: true },
  permissions: [...AGUS_ME.permissions, 'member:invite', 'member:update_phone'],
});

function render(
  view: UnitDashboardView | StubReply | StubReply[] = dashboard(),
  { me = AGUS_ME, search = '' }: { me?: ReturnType<typeof makeMe>; search?: string } = {},
) {
  const reply = Array.isArray(view) || typeof view === 'function' || 'status' in view || 'body' in view ? view : { body: view };
  const stub = stubFetch({ 'GET /unit/dashboard': reply as StubReply });
  nav.search = search;
  renderWithSession(<UnitDashboardPage />, { me });
  return stub;
}

const roster = () => screen.findByRole('region', { name: /^Your team’s roster/ });
const panel = () => document.querySelector<HTMLElement>('[data-unit-panel]')!;
const person = (id: string) => document.querySelector<HTMLElement>(`[data-person="${id}"]`)!;
const section = (key: string) => document.querySelector<HTMLElement>(`[data-unit-section="${key}"]`)!;
/** jsdom cannot follow a link: a click on one is kept from trying, as a test of a drill needs only its address. */
const stayPut = (e: MouseEvent) => {
  if ((e.target as HTMLElement).closest('a')) e.preventDefault();
};

/*
 * **P19.18-T1 — the Overview for the whole office** (ADR-0271 §1–§6; the brief of 19 November 2026, part A;
 * `unit-overview-{mobile,tablet,laptop}`): Tahun ini first, the four views, one orange panel and its two sheets, unit
 * cards at every size with team lines, navy/green progress, the coaching status tile and the period's leads from 768px,
 * and the KPM Owner's person card.
 */
describe('P19.18-T1 the Unit Dashboard’s Overview', () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.search = '';
    document.addEventListener('click', stayPut);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.removeEventListener('click', stayPut);
  });

  describe('AC-1 the period opens on Tahun ini', () => {
    it('P19.18-T1 AC-1 reads Tahun ini with no period in the address, and the picker says so', async () => {
      const { calls } = render();
      await roster();
      expect(calls[0].url).toBe('http://api.test/api/v1/unit/dashboard?period=year');
      expect(screen.getByRole('button', { name: 'Period This year' })).toBeInTheDocument();
    });

    it('P19.18-T1 AC-1 another period goes into the address; Tahun ini leaves it clean', async () => {
      render(dashboard(), { search: 'period=month' });
      await roster();
      await userEvent.click(screen.getByRole('button', { name: 'Period This month' }));
      const menu = screen.getByRole('listbox', { name: 'Period' });
      expect(within(menu).getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim()))
        .toEqual(['Last 7 days', 'This month', 'This year']);
      await userEvent.click(within(menu).getByRole('option', { name: 'This year' }));
      expect(nav.replace).toHaveBeenCalledWith('/unit/dashboard', { scroll: false });
    });
  });

  describe('AC-2 the downline filter', () => {
    const OWNER_VIEWS: Pick<UnitDashboardView, 'scope' | 'scopes'> = {
      scope: 'downline', scopes: { offered: ['unit', 'direct', 'informal', 'downline'], default: 'downline' },
    };

    it('P19.18-T1 AC-2 Direct Unit · Grup langsung · Grup informal · Semua downline beside the period; a choice reads it', async () => {
      const { calls } = render(dashboard({ ...OWNER_VIEWS }), { me: OWNER_ME });
      await roster();
      await userEvent.click(screen.getByRole('button', { name: 'View All downline' }));
      const menu = screen.getByRole('listbox', { name: 'View' });
      expect(within(menu).getAllByRole('option').map((o) => o.textContent?.replace('✓', '').trim()))
        .toEqual(['Direct Unit', 'Direct group', 'Informal group', 'All downline']);
      await userEvent.click(within(menu).getByRole('option', { name: 'Direct Unit' }));
      await waitFor(() => expect(calls.at(-1)!.url).toBe('http://api.test/api/v1/unit/dashboard?period=year&scope=unit'));
      expect(nav.replace).toHaveBeenLastCalledWith('/unit/dashboard?scope=unit', { scroll: false });
    });

    it('P19.18-T1 AC-2 a leader with only a unit is offered Direct Unit alone: no picker', async () => {
      render(dashboard({ scope: 'unit', scopes: { offered: ['unit'], default: 'unit' } }));
      await roster();
      expect(screen.queryByRole('button', { name: /^View / })).not.toBeInTheDocument();
    });
  });

  describe('AC-3 one orange panel', () => {
    it('P19.18-T1 AC-3 Produksi Group, its navy % pill, Rp realised of target and a navy bar', async () => {
      render();
      await roster();
      const p = panel();
      expect(p).toHaveClass('bg-primary', 'text-primary-contrast');
      expect(within(p).getByText('Group production')).toBeInTheDocument();
      expect(p.querySelector('[data-panel-pct]')).toHaveTextContent('78%');
      expect(p.querySelector('[data-panel-pct]')).toHaveClass('bg-secondary', 'text-secondary-contrast');
      expect(p.querySelector('[data-panel-production]')).toHaveTextContent('IDR 1B');
      expect(p).toHaveTextContent('of IDR 1.3B');
      expect(p.querySelector('[data-panel-bar] span')).toHaveClass('bg-secondary');
    });

    it('P19.18-T1 AC-3 three tiles — Tim Anda white, Active Agent and Recruitment navy, the number orange — one number each, no chips', async () => {
      render();
      await roster();
      const tiles = panel().querySelector<HTMLElement>('[data-panel-tiles]')!;
      expect(tiles).toHaveClass('grid', 'grid-cols-[0.86fr_1.07fr_1.07fr]', 'gap-1.5');
      const [team, active, recruit] = [...tiles.children] as HTMLElement[];
      expect(team).toHaveClass('bg-card');
      expect(team).toHaveTextContent('16Your team');
      expect(active).toHaveClass('bg-secondary');
      expect(active.querySelector('[data-number-size]')).toHaveClass('text-primary-on-secondary');
      expect(active).toHaveTextContent('2OctActive Agent');
      expect(recruit).toHaveTextContent('1OctRecruitment');
      // No split chips and no "/total" (the brief: *"the downline filter does that"*).
      expect(panel()).not.toHaveTextContent(/AAB|langsung|direct|of 16/);
      expect(document.querySelector('[data-stat-tile]')).toBeNull();
    });

    it('P19.18-T1 AC-3 the three numbers share one size, 24px to start (they step down together to 16px)', async () => {
      render();
      await roster();
      const sizes = [...panel().querySelectorAll('[data-number-size]')].map((n) => n.getAttribute('data-number-size'));
      expect(sizes).toEqual(['24', '24', '24']);
      for (const n of panel().querySelectorAll<HTMLElement>('[data-number-size]')) expect(n.style.fontSize).toBe('24px');
    });

    it('P19.18-T1 AC-3 the month not uploaded: Active Agent reads –, never 0; nothing held reads Not uploaded yet', async () => {
      render(dashboard({
        tiles: {
          ...dashboard().tiles,
          activeAgent: { month: '2026-10', held: false, count: null, people: [] },
          directGroupProduction: { ...dashboard().tiles.directGroupProduction, actualMinor: null, attainmentPct: null },
        },
      }));
      await roster();
      expect(panel().querySelector('[data-panel-tile="activeAgent"] [data-number-size]')).toHaveTextContent('–');
      expect(panel().querySelector('[data-panel-production]')).toHaveTextContent('Not uploaded yet');
      expect(panel().querySelector('[data-panel-pct]')).toBeNull();
    });

    it('P19.18-T1 AC-3 from 1024px Produksi left and the three tiles right', async () => {
      atWidth(1280);
      render();
      await roster();
      expect(panel()).toHaveClass('lg:grid', 'lg:grid-cols-[minmax(0,1fr)_25rem]');
    });
  });

  describe('AC-4 the sheets behind the navy tiles', () => {
    it('P19.18-T1 AC-4 Active Agent lists the active people: photo, NAME, unit, APE · policies that month', async () => {
      render();
      await roster();
      await userEvent.click(screen.getByRole('button', { name: 'Active Agent October: 2' }));
      const sheet = await screen.findByRole('dialog', { name: 'Active Agent · October' });
      expect(sheet).toHaveAccessibleDescription('2 of 16 · from the uploaded production data');
      const rows = [...sheet.querySelectorAll<HTMLElement>('[data-sheet-person]')];
      expect(rows.map((r) => r.getAttribute('data-sheet-person'))).toEqual(['mem-agus', 'mem-novi']);
      expect(within(rows[0]).getByText('Agus Santoso')).toHaveClass('uppercase');
      expect(rows[0]).toHaveTextContent('Your Unit · APE IDR 12M · 1 policy');
      expect(rows[1]).toHaveTextContent('ARIEF WIBOWO’s Unit · APE IDR 6M · 1 policy');
    });

    it('P19.18-T1 AC-4 the month not uploaded: the sheet says so and lists nobody', async () => {
      render(dashboard({ tiles: { ...dashboard().tiles, activeAgent: { month: '2026-10', held: false, count: null, people: [] } } }));
      await roster();
      await userEvent.click(screen.getByRole('button', { name: 'Active Agent October: –' }));
      const sheet = await screen.findByRole('dialog', { name: 'Active Agent · October' });
      expect(sheet).toHaveAccessibleDescription('This month’s production is not uploaded yet');
      expect(sheet.querySelector('[data-sheet-person]')).toBeNull();
    });

    it('P19.18-T1 AC-4 Recruitment lists who joined that month — Direkrut oleh, the joining date — and See in New Hires', async () => {
      render();
      await roster();
      await userEvent.click(screen.getByRole('button', { name: 'Recruitment October: 1' }));
      const sheet = await screen.findByRole('dialog', { name: 'Recruitment · October' });
      expect(sheet).toHaveAccessibleDescription('1 new agent joined this month');
      const row = sheet.querySelector<HTMLElement>('[data-sheet-person="mem-tono"]')!;
      expect(row).toHaveTextContent('Tono Saputra');
      expect(row).toHaveTextContent('Recruited by Sari Wulandari · Joined 3 Oct 2026');
      expect(within(sheet).getByRole('link', { name: 'See in New Hires' })).toHaveAttribute('href', '/new-hires');
    });
  });

  describe('AC-5 progress is navy below 100%, green from 100%', () => {
    it('P19.18-T1 AC-5 on rows, unit headers and team lines — never red', async () => {
      render();
      await roster();
      expect(person('mem-agus').querySelector('[data-progress-tone]')).toHaveAttribute('data-progress-tone', 'green');
      expect(person('mem-agus').querySelector('[data-progress-tone]')).toHaveClass('text-signal-green');
      expect(person('mem-dimas').querySelector('[data-progress-tone]')).toHaveAttribute('data-progress-tone', 'navy');
      expect(person('mem-dimas').querySelector('[data-progress-tone]')).toHaveClass('text-navy');
      expect(person('mem-dimas').querySelector('[data-goal-bar] span')).toHaveClass('bg-secondary');
      expect(section('own').querySelector('[data-unit-line] [data-progress-tone]')).toHaveAttribute('data-progress-tone', 'navy');
      expect(document.querySelector('[data-team-line="mem-wulan"] [data-progress-tone]')).toHaveAttribute('data-progress-tone', 'navy');
      expect(document.querySelector('[data-roster] .text-signal-red, [data-roster] .bg-signal-red')).toBeNull();
    });
  });

  describe('AC-6 the roster: units, team lines, order', () => {
    it('P19.18-T1 AC-6 one header per unit — leader’s photo, n orang, the unit’s progress — Your Unit first', async () => {
      render();
      await roster();
      const lines = [...document.querySelectorAll<HTMLElement>('[data-unit-section]')];
      expect(lines.map((l) => l.getAttribute('data-unit-section'))).toEqual(['own', 'mem-arief', 'mem-dewi', 'mem-sari']);
      const own = section('own').querySelector<HTMLElement>('[data-unit-line]')!;
      expect(own).toHaveTextContent('Your Unit·4 people82%IDR 262.4M / 320M');
      expect(own.querySelector('[aria-hidden="true"].rounded-full')).toBeInTheDocument();
      expect(section('mem-sari').querySelector('[data-unit-line]')).toHaveTextContent('SARI WULANDARI’s Unit·6 people');
      expect(section('mem-sari').querySelector('[data-unit-line]')).toHaveTextContent('55%IDR 131.2M / 240M');
    });

    it('P19.18-T1 AC-6 a team inside a unit is a team line in the same orange tint, its own progress — never a folder', async () => {
      render();
      await roster();
      const team = document.querySelector<HTMLElement>('[data-team-line="mem-wulan"]')!;
      expect(team).toHaveClass('bg-primary/[0.12]');
      expect(team).toHaveTextContent('WULAN SARI’s Unit·2 people');
      expect(team.closest('button')).toBeNull();
      // Wulan's team, in Sari's unit, after Sari's own rows.
      const blocks = [...section('mem-sari').querySelectorAll('[data-roster-block]')].map((b) => b.getAttribute('data-roster-block'));
      expect(blocks).toEqual(['own', 'mem-wulan']);
    });

    it('P19.18-T1 AC-6 rows in the server’s order: the AB, then the AAB(s), then the agents', async () => {
      render();
      await roster();
      const ids = [...section('own').querySelectorAll('[data-person]')].map((r) => r.getAttribute('data-person'));
      expect(ids).toEqual([AGUS_ROW.membershipId, DIMAS.membershipId, INDAH.membershipId, SITI.membershipId]);
    });

    it('P19.18-T1 AC-6 on a phone Your Unit is open and every other unit closed, each still showing its progress', async () => {
      atWidth(375);
      render();
      await roster();
      expect(within(section('own')).getByRole('button', { name: /^Your Unit/ })).toHaveAttribute('aria-expanded', 'true');
      const sari = within(section('mem-sari')).getByRole('button', { name: /^SARI WULANDARI’s Unit/ });
      expect(sari).toHaveAttribute('aria-expanded', 'false');
      expect(sari).toHaveTextContent('55%IDR 131.2M / 240M');
      await userEvent.click(sari);
      expect(sari).toHaveAttribute('aria-expanded', 'true');
      expect(person('mem-budi')).toBeInTheDocument();
    });
  });

  describe('AC-7 a person row', () => {
    it('P19.18-T1 AC-7 photo, the orange label before the NAME in capitals, % + Rp x / y + a thin bar; agents carry no label', async () => {
      render();
      await roster();
      const agus = person('mem-agus');
      expect(agus.querySelector('[data-rung-tag]')).toHaveTextContent('AB');
      expect(agus.querySelector('[data-rung-tag]')).toHaveClass('text-primary-ink');
      expect(within(agus).getByRole('link', { name: 'You (Agus)' })).toHaveClass('uppercase');
      expect(agus).toHaveTextContent('135%IDR 108M / 80M');
      expect(person('mem-dimas').querySelector('[data-rung-tag]')).toBeNull();
      expect(person('mem-arief').querySelector('[data-rung-tag]')).toHaveTextContent('AAB');
    });

    it('P19.18-T1 AC-7 Belum diunggah and Goal belum diatur on that line, beside a dashed bar — never a floating pill', async () => {
      render();
      await roster();
      expect(person('mem-siti')).toHaveTextContent('Not uploaded yet');
      expect(person('mem-siti').querySelector('[data-goal-bar="none"]')).toHaveClass('border-dashed');
      expect(person('mem-sari')).toHaveTextContent('No goal set');
      // OD-391: no status pill and no status chips — the % colour carries it.
      expect(document.querySelector('[data-roster] [data-tone]')).toBeNull();
      expect(screen.queryByRole('group', { name: 'Filter by status' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Watch closely|Needs attention|On track/)).not.toBeInTheDocument();
    });

    it('P19.18-T1 AC-7 WhatsApp on the row where there is a number; none on the reader’s own', async () => {
      render();
      await roster();
      expect(within(person('mem-indah')).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6281234567001');
      expect(within(person('mem-agus')).queryByRole('link', { name: /WhatsApp/ })).toBeNull();
    });

    it('P19.18-T1 AC-7 the production’s ⓘ still names a new hire it leaves out', async () => {
      render(NEW_HIRE_VIEW);
      await roster();
      expect(within(panel()).getByRole('button', { name: /No first sale yet for Yanti Puspita/ })).toBeInTheDocument();
    });
  });

  describe('AC-8 tablet and laptop', () => {
    it('P19.18-T1 AC-8 every unit open, three people a row; under each bar the coaching status tile and the period’s leads', async () => {
      atWidth(1280);
      render(dashboard(), { me: OWNER_ME });
      await roster();
      for (const header of document.querySelectorAll('[data-unit-line]')) expect(header).toHaveAttribute('aria-expanded', 'true');
      expect(section('own').querySelector('ul')).toHaveClass('grid', 'md:grid-cols-2', 'lg:grid-cols-3');
      const dimas = person('mem-dimas');
      const tile = dimas.querySelector('[data-coaching-status]')!;
      expect(tile).toHaveTextContent('Coached 12 days ago');
      expect(tile).toHaveClass('w-full', 'text-center', 'bg-pill-green');
      expect(person('mem-siti').querySelector('[data-coaching-status]')).toHaveTextContent('Never coached');
      expect(person('mem-sari').querySelector('[data-coaching-status]')).toHaveClass('bg-pill-amber');
      expect(dimas.querySelector('[data-period-leads]')).toHaveTextContent('Sales leads 5Recruit leads 2');
      // The tile and the bar share one box: the tile exactly as wide as the bar.
      expect(tile.parentElement).toBe(dimas.querySelector('[data-goal-bar]')!.closest('div'));
    });

    it('P19.18-T1 AC-8 + Tambah agent and Perbarui produksi on the roster’s title row; no wide table', async () => {
      atWidth(1280);
      render(dashboard(), { me: OWNER_ME });
      const region = await roster();
      expect(within(region).getByRole('button', { name: 'Update production' })).toBeInTheDocument();
      expect(within(region).getByRole('button', { name: '+ Add agent' })).toBeInTheDocument();
      expect(document.querySelector('table')).toBeNull();
      expect(document.querySelector('[data-unit-fab]')).toBeNull();
    });

    it('P19.18-T1 AC-8 a phone: no coaching tile and no leads line on a row, the floating + in place of the title row’s buttons', async () => {
      atWidth(375);
      render(dashboard(), { me: OWNER_ME });
      const region = await roster();
      expect(person('mem-dimas').querySelector('[data-coaching-status]')).toBeNull();
      expect(person('mem-dimas').querySelector('[data-period-leads]')).toBeNull();
      expect(within(region).queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+ Add agent' })).toHaveAttribute('data-unit-fab', '');
    });
  });

  describe('AC-9 tapping a person', () => {
    it('P19.18-T1 AC-9 an AB goes straight to the person’s Personal Summary', async () => {
      render();
      await roster();
      expect(within(person('mem-dimas')).getByRole('link', { name: 'Dimas Pratama' }))
        .toHaveAttribute('href', `/coaching/mem-dimas/summary?from=${encodeURIComponent('/unit/dashboard')}`);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('P19.18-T1 AC-9 the KPM Owner first sees a card: photo, role once, four numbers, the coaching tile, Buka profil, WhatsApp; no Proposal', async () => {
      atWidth(1280);
      render(dashboard({ personCard: true, units: UNITS.map((u) => (u.head.membershipId === ARIEF.membershipId ? u : u)) }), { me: OWNER_ME });
      await roster();
      await userEvent.click(within(person('mem-indah')).getByRole('button', { name: 'Indah Lestari' }));
      const card = await screen.findByRole('dialog', { name: 'INDAH LESTARI' });
      expect(card).toHaveAccessibleDescription('Agent · Your Unit');
      expect(card.querySelector('[data-person-card-photo]')).toBeInTheDocument();
      const figures = [...card.querySelectorAll<HTMLElement>('[data-card-figure]')].map((f) => f.textContent);
      expect(figures).toEqual([
        'Sales leads51 potensi', 'Recruitment leads20 potensi', 'Goal progress82%IDR 65.6M / 80M', 'Activity12last 7 days',
      ]);
      expect(card.querySelector('[data-person-card-numbers]')).toHaveClass('grid-cols-2', 'md:grid-cols-4');
      expect(card.querySelector('[data-coaching-status]')).toHaveTextContent('Coached 4 days ago');
      expect(within(card).getByRole('link', { name: 'Open profile' }))
        .toHaveAttribute('href', `/coaching/mem-indah/summary?from=${encodeURIComponent('/unit/dashboard')}`);
      expect(within(card).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/6281234567001');
      expect(card).not.toHaveTextContent(/Proposal/);
      // The goal's % is navy below 100% here too (AC-5), never the mockup's red.
      expect(card.querySelector('[data-card-figure]:nth-child(3) dd')).toHaveClass('text-navy');
    });

    it('P19.18-T1 AC-9 the reader’s own row still goes to their own Summary, card or not', async () => {
      render(dashboard({ personCard: true }), { me: OWNER_ME });
      await roster();
      expect(within(person('mem-agus')).getByRole('link', { name: 'You (Agus)' })).toHaveAttribute('href', '/summary');
    });

    it('P19.18-T1 AC-9 the card is axe-clean, centred from 1024px', async () => {
      atWidth(1280);
      render(dashboard({ personCard: true }), { me: OWNER_ME });
      await roster();
      await userEvent.click(within(person('mem-dimas')).getByRole('button', { name: 'Dimas Pratama' }));
      const card = await screen.findByRole('dialog', { name: 'DIMAS PRATAMA' });
      expect(card.closest('[data-placement]')).toHaveAttribute('data-placement', 'responsive');
      // Rendered without the shell's landmarks: `region` is the shell's (the a11y pass renders the page in its layout).
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  });

  describe('UI-011 back to where the roster was left', () => {
    it('UI-011 the scroll is kept on leaving through a row, and restored on return', async () => {
      const scrollTo = vi.fn();
      vi.stubGlobal('scrollTo', scrollTo);
      sessionStorage.clear();
      render();
      await roster();
      Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
      await userEvent.click(screen.getByRole('link', { name: 'Indah Lestari' }));
      expect(JSON.parse(sessionStorage.getItem('unit-dashboard:return')!)).toEqual({ at: '/unit/dashboard', y: 640 });
      cleanup();
      render();
      await roster();
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(0, 640));
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    });
  });

  describe('the populated Overview through axe', () => {
    it.each([375, 1024, 1280])('P19.18-T1 at %ipx the panel and the roster are axe-clean', async (px) => {
      atWidth(px);
      render(dashboard(), { me: OWNER_ME });
      await roster();
      // Rendered without the shell's landmarks: `region` is the shell's (the a11y pass renders the page in its layout).
      const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
      expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });

    it('P19.18-T1 the empty unit keeps the panel at zero and draws no sheet button', async () => {
      render(EMPTY);
      await screen.findByText('Example');
      expect(panel().querySelector('button')).toBeNull();
      expect(rp(1)).toBe(100_000_000);
    });
  });
});
