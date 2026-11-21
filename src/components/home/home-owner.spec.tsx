import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { AGUS, LEADER, OWNER_VIEW, WILSON_OWNER } from '@test/home-fixtures';
import type { HomeView } from '@/lib/home';
import HomePage from '@/app/(agent)/home/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.unstubAllGlobals());

const open = async (view: HomeView, how: 'en' | 'id' = 'en', me = WILSON_OWNER) => {
  const stub = stubFetch({ '/home': { body: view } });
  (how === 'id' ? renderInIndonesian : renderWithSession)(<HomePage />, { me });
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(document.querySelector('[data-home-tiles]')).not.toBeNull());
  return stub;
};

const tile = (label: RegExp) => screen.getByText(label).closest('a')!;
const team = () => document.querySelector('[data-home-team]') as HTMLElement;
/** The unit lines, in the order drawn. */
const unitLines = () => [...team().querySelectorAll('[data-team-unit] > h3')].map((h) => h.textContent);
/** A person's row, by the name on it. */
const rowOf = (name: string) => [...team().querySelectorAll<HTMLElement>('[data-person-row]')]
  .find((r) => r.textContent!.includes(name))!;

/**
 * **P19.18-T4 — Home for the KPM Owner: the whole office** (ADR-0271 §7; the brief's part B, gap 1; `home-owner-mobile`).
 * The server sends `leader.office` to the Owner and an Admin; the screen draws what it says.
 */
describe('P19.18-T4 Home for the KPM Owner', () => {
  it('P19.18-T4 AC-1 Active Agent and Coaching 7 hari read x dari N over the whole office, with no split chips', async () => {
    await open(OWNER_VIEW);
    const active = tile(/^Active Agent October$/);
    expect(active).toHaveAttribute('href', '/unit/dashboard');
    expect(active).toHaveTextContent('2of 30');
    expect(active.querySelectorAll('li')).toHaveLength(0);
    const coached = tile(/^Coaching 7 days$/);
    expect(coached).toHaveAttribute('href', '/coaching');
    expect(coached).toHaveTextContent('5of 30');
    expect(coached.querySelectorAll('li')).toHaveLength(0);
  });

  it('P19.18-T4 AC-1 in Indonesian: Active Agent 2 dari 30, Coaching 7 hari 5 dari 30', async () => {
    await open(OWNER_VIEW, 'id');
    expect(tile(/^Active Agent Oktober$/)).toHaveTextContent('2dari 30');
    expect(tile(/^Coaching 7 hari$/)).toHaveTextContent('5dari 30');
  });

  it('P19.18-T4 AC-1 a month not uploaded reads – on Active Agent, never 0, with no ring and no chips — for every leader', async () => {
    const notHeld = (view: HomeView): HomeView => ({
      ...view, leader: { ...view.leader!, activeAgent: { ...view.leader!.activeAgent, count: 0, held: false } },
    });
    await open(notHeld(OWNER_VIEW));
    const owner = tile(/^Active Agent October$/);
    expect(owner).toHaveTextContent('–of 30');
    expect(within(owner).queryByRole('img')).toBeNull();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    await open(notHeld(LEADER), 'en', AGUS);
    const leader = tile(/^Active Agent October$/);
    expect(leader).toHaveTextContent('–of 12');
    expect(leader.querySelectorAll('li')).toHaveLength(0);
    // Coaching 7 hari is the app's own record, not the upload: it stays.
    expect(tile(/^Coaching 7 days$/)).toHaveTextContent('2of 12');
  });

  it('P19.18-T4 AC-2 Laporan aktivitas tim lists everyone grouped by AB unit, each unit line orange-tinted, five people then Semua ›', async () => {
    const user = userEvent.setup();
    await open(OWNER_VIEW, 'id');
    expect(within(team()).getByRole('heading', { level: 2, name: 'Laporan aktivitas tim' })).toBeInTheDocument();
    expect(unitLines()).toEqual(['Unit AGUS PRASETYO', 'Unit SATRIA NUGRAHA']);
    expect(team().querySelector('[data-team-unit] > h3')).toHaveClass('bg-primary/[0.12]');
    expect(team().querySelectorAll('[data-person-row]')).toHaveLength(5);
    await user.click(screen.getByRole('button', { name: 'Semua 7 orang' }));
    expect(unitLines()).toEqual(['Unit AGUS PRASETYO', 'Unit SATRIA NUGRAHA', 'Unit YOSEF TAMBUNAN']);
    expect(team().querySelectorAll('[data-person-row]')).toHaveLength(7);
  });

  it('P19.18-T4 AC-2 inside a unit: the AB, the AAB, then agents — each leader with the orange label before the NAME; Kmrn · Hari ini, WhatsApp', async () => {
    await open(OWNER_VIEW, 'id');
    const agus = team().querySelector('[data-team-unit="m-agus"]') as HTMLElement;
    const rows = [...agus.querySelectorAll('[data-person-row]')].map((r) => r.textContent ?? '');
    expect(rows.map((text) => ['Agus Prasetyo', 'Dewi Lestari', 'Lukman Hakim'].find((n) => text.includes(n))))
      .toEqual(['Agus Prasetyo', 'Dewi Lestari', 'Lukman Hakim']);
    expect(within(rowOf('Agus Prasetyo')).getByText('AB')).toHaveClass('text-primary-ink', 'font-extrabold');
    expect(within(rowOf('Dewi Lestari')).getByText('AAB')).toHaveAttribute('data-rung-tag', 'AAB');
    expect(rowOf('Lukman Hakim').querySelector('[data-rung-tag]')).toBeNull();
    // The two days and WhatsApp, as a leader's list.
    expect(rowOf('Agus Prasetyo').querySelectorAll('[data-logged]')).toHaveLength(2);
    expect(within(rowOf('Agus Prasetyo')).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(screen.getByText('Kmrn')).toBeInTheDocument();
  });

  it('P19.18-T4 AC-2 Semua downline ⌄ in place of Unit | Group: the views offered, and a choice reads Home again with ?scope=', async () => {
    const user = userEvent.setup();
    const { calls } = await open(OWNER_VIEW, 'id');
    expect(within(team()).queryByRole('button', { name: 'Unit' })).toBeNull();
    const picker = within(team()).getByRole('button', { name: /Tampilan/ });
    expect(picker).toHaveTextContent('Semua downline');
    await user.click(picker);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Direct Unit', 'Grup langsung', 'Grup informal', 'Semua downline']);
    await user.click(screen.getByRole('option', { name: 'Grup langsung' }));
    await waitFor(() => expect(calls.map((c) => c.url)).toContain('http://api.test/api/v1/home?scope=direct'));
  });

  it('P19.18-T4 AC-2 a leader’s own list keeps Unit | Group, no unit lines and no labels (UX-15)', async () => {
    await open(LEADER, 'en', AGUS);
    expect(within(team()).getByRole('button', { name: 'Unit' })).toBeInTheDocument();
    expect(team().querySelector('[data-team-unit]')).toBeNull();
    expect(team().querySelector('[data-rung-tag]')).toBeNull();
    expect(team()).not.toHaveAttribute('data-office');
  });

  it('P19.18-T4 AC-2 the reader’s own unit is Unit Anda, and nobody without a leader is under Belum punya leader', async () => {
    const view: HomeView = {
      ...OWNER_VIEW,
      leader: {
        ...OWNER_VIEW.leader!,
        team: [
          { ...OWNER_VIEW.leader!.team[2], unitKey: 'm-wilson' },
          { ...OWNER_VIEW.leader!.team[4], unitKey: 'unled' },
        ],
        office: {
          ...OWNER_VIEW.leader!.office!,
          units: [
            { key: 'm-wilson', leader: { membershipId: 'm-wilson', name: 'Wilson Tanoto', photoUrl: null }, isReader: true, count: 1 },
            { key: 'unled', leader: null, isReader: false, count: 1 },
          ],
        },
      },
    };
    await open(view, 'id');
    expect(unitLines()).toEqual(['Unit Anda', 'Belum punya leader']);
  });
});
