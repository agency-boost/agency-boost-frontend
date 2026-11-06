import { waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HomeView } from '@/lib/home';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { AGENT_VIEW, AGUS, LEADER, NEW_LEADER } from '@test/home-fixtures';
import HomePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.unstubAllGlobals());

const open = async (view: HomeView, how: 'en' | 'id' = 'en') => {
  stubFetch({ '/home': { body: view } });
  (how === 'id' ? renderInIndonesian : renderWithSession)(<HomePage />, { me: AGUS });
  await waitFor(() => expect(document.querySelector('[data-home-tiles]')).not.toBeNull());
};

const timSaya = () => document.querySelector<HTMLElement>('[data-home-tim-saya]');
const tileOf = (label: string) => within(timSaya()!).getByText(label).closest('a')!;

/**
 * ***Tim saya* on Home** (P19-T4 AC-2; UI-159 item 2; ADR-0189 §4): every leader's, with or without a team — four
 * tiles, each with one call to action at zero.
 */
describe('P19-T4 Home: Tim saya', () => {
  it('P19-T4 AC-2 a leader with nobody yet sees Tim saya’s four tiles at 0, each with its call to action, in the handover’s words', async () => {
    await open(NEW_LEADER, 'id');
    const block = timSaya()!;
    expect(within(block).getByRole('heading', { name: 'Tim saya' })).toBeInTheDocument();
    expect(within(block).getAllByRole('link')).toHaveLength(4);
    expect(tileOf('Anggota tim')).toHaveAttribute('href', '/new-hires');
    expect(within(tileOf('Anggota tim')).getByText('Belum ada anggota · Tambah agent pertama →')).toBeInTheDocument();
    expect(tileOf('Coaching minggu ini')).toHaveAttribute('href', '/coaching');
    expect(within(tileOf('Coaching minggu ini')).getByText('Mulai coaching →')).toBeInTheDocument();
    expect(tileOf('Recruitment pipeline')).toHaveAttribute('href', '/recruitment/attack-plan');
    expect(within(tileOf('Recruitment pipeline')).getByText('Rencanakan recruitment →')).toBeInTheDocument();
    expect(tileOf('New hires')).toHaveAttribute('href', '/new-hires');
    expect(within(tileOf('New hires')).getByText('Tambah agent baru →')).toBeInTheDocument();
    for (const link of within(block).getAllByRole('link')) expect(link.textContent).toMatch(/0/);
  });

  it('P19-T4 AC-2 with nobody yet, no rings of 0 dari 0 and no empty Laporan tim: Tim saya says it', async () => {
    await open(NEW_LEADER);
    expect(document.querySelector('[data-home-team]')).toBeNull();
    expect(within(document.querySelector('[data-home-tiles]') as HTMLElement).queryByText(/Active Agent/)).toBeNull();
    // Unit Dashboard and Coaching are within two taps of Home: Coaching is one, on this block.
    expect(tileOf('Coaching this week')).toHaveAttribute('href', '/coaching');
  });

  it('P19-T4 AC-2 a leader with a team sees the figures, no calls to action, and the tiles and Laporan tim as before', async () => {
    await open(LEADER);
    expect(within(tileOf('Team members')).getByText('11')).toBeInTheDocument();
    expect(tileOf('Team members')).toHaveAttribute('href', '/group-tree');
    expect(within(tileOf('Recruiting pipeline')).getByText('5')).toBeInTheDocument();
    expect(tileOf('Recruiting pipeline')).toHaveAttribute('href', '/leads');
    expect(within(tileOf('New hires')).getByText('3')).toBeInTheDocument();
    expect(document.querySelector('[data-tim-saya-cta]')).toBeNull();
    expect(document.querySelector('[data-home-team]')).not.toBeNull();
  });

  it('P19-T4 AC-2 an Agent has no Tim saya: the server sends no leader block', async () => {
    await open(AGENT_VIEW);
    expect(timSaya()).toBeNull();
  });
});
