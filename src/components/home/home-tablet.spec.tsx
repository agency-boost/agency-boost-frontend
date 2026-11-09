import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import HomePage from '@/app/(agent)/home/page';
import type { HomeView } from '@/lib/home';
import { atWidth, digestAt, makeMe, renderInLayout, renderWithSession, stubFetch, wears } from '@test/harness';
import { AGENT_VIEW, AGUS_AB, LEADER, NEW_LEADER } from '@test/home-fixtures';
import { SHELL_STUBS } from '@test/events-fixtures';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **Home on a tablet** (P19.1-T5 AC-3; UI-113: *Home: quote full width, the 4 tiles 2×2, then Laporan tim | Aktivitas 7
 * hari side by side*; the `home-tablet` mockup). The phone's blocks in the phone's order, in two columns where two fit.
 * *Tim saya* (P19-T4) and *Aksi hari ini*, which the mockup's empty account does not draw, keep their place in that order,
 * full width. A phone and a laptop draw what they drew, to the byte.
 *
 * *Changed 2026-11-07 (P19.8-T2 AC-1; ADR-0228 §1, §2; MOB UI-164 — content order All sizes):* *Tim saya* is gone and the
 * button row stands above the tiles, full width; *Laporan aktivitas tim* is every leader's, so a leader with nobody has
 * it beside the chart, and only an Agent's chart is full width. The tablet's columns are as they were.
 */

/**
 * Home's markup from `LEADER`, read with `AGUS_AB` — his writes draw the button row (`digestAt`). *Re-recorded 2026-11-07 (P19.8-T2):* the order, the removal
 * of *Tim saya*, the 64px *Aksi hari ini* rows, *Laporan aktivitas tim* and the header-control *Unit | Group* change it at
 * every size, as MOB UI-164 (*content order All sizes*), UI-163 and UI-169 are scoped; it was the build before P19.1-T5,
 * recorded 2026-11-05.
 */
const BEFORE_T5: Record<375 | 1024 | 1280, string> = {
  375: '898129a8326899a954946a4f9ee97455c3c10d1f0f812e0fbf3377e320f36554',
  1024: '76bb13413b4b72b76676a69537a3328ba49a213c6c324da6be0cc8c06e5b934b',
  1280: '76bb13413b4b72b76676a69537a3328ba49a213c6c324da6be0cc8c06e5b934b',
};

const BLOCKS = ['quote', 'buttons', 'tiles', 'actions', 'team', 'chart'] as const;
const block = (name: (typeof BLOCKS)[number]) => document.querySelector<HTMLElement>(`[data-home-${name}]`);

async function open(px: number, view: HomeView = LEADER, me = AGUS_AB) {
  atWidth(px);
  stubFetch({ '/home': { body: view } });
  renderWithSession(<HomePage />, { me });
  await waitFor(() => expect(block('chart')).not.toBeNull());
  return document.querySelector('[data-home]') as HTMLElement;
}

const spans = (el: HTMLElement | null, px: number) => wears(el!, px).split(' ').includes('col-span-2');

afterEach(() => vi.unstubAllGlobals());

describe('P19.1-T5 AC-3 Home on a tablet (UI-113, home-tablet)', () => {
  it.each([768, 1023])('P19.1-T5 AC-3 at %ipx: the phone’s blocks in the phone’s order, two columns', async (px) => {
    const home = await open(px);
    const drawn = BLOCKS.map(block);
    expect(drawn.every((el) => el !== null)).toBe(true);
    for (let i = 1; i < drawn.length; i += 1) {
      expect(drawn[i - 1]!.compareDocumentPosition(drawn[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(wears(home.firstElementChild!, px).split(' ')).toContain('grid-cols-2');
  });

  it.each([768, 1023])('P19.1-T5 AC-3 at %ipx: the quote full width, the tiles 2×2 across it, then Laporan tim | Aktivitas 7 hari side by side', async (px) => {
    await open(px);
    expect(spans(block('quote'), px)).toBe(true);
    // P19.8-T2 AC-1: the button row full width, between the quote and the tiles.
    expect(spans(block('buttons'), px)).toBe(true);
    expect(spans(block('tiles'), px)).toBe(true);
    expect(wears(block('tiles')!, px).split(' ')).toContain('grid-cols-2');
    // *Aksi hari ini* keeps its place in the phone's order, full width, above the pair.
    expect(spans(block('actions'), px)).toBe(true);
    // The pair: one column each.
    expect(spans(block('team'), px)).toBe(false);
    expect(spans(block('chart'), px)).toBe(false);
    expect(screen.getByRole('heading', { name: 'Activity, last 7 days' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team activity report' })).toBeInTheDocument();
  });

  it('P19.1-T5 AC-3 at 768px: a leader with nobody keeps Laporan aktivitas tim beside the chart; an Agent’s chart is full width', async () => {
    // P19.8-T2 AC-9: the team report is every leader's by role — with nobody, its one line.
    await open(768, NEW_LEADER);
    expect(block('team')).not.toBeNull();
    expect(spans(block('chart'), 768)).toBe(false);
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    await open(768, AGENT_VIEW, makeMe({ user: { ...makeMe().user, fullName: 'Rina Wijaya' }, permissions: ['personal_summary:read'] }));
    expect(block('team')).toBeNull();
    expect(spans(block('chart'), 768)).toBe(true);
    expect(spans(block('quote'), 768)).toBe(true);
  });

  it('P19.1-T5 AC-3 at 768px: the tab bar is at most 470px, centred', async () => {
    atWidth(768);
    stubFetch({ ...SHELL_STUBS, '/home': { body: LEADER } });
    renderInLayout(AgentLayout, <HomePage />, { me: AGUS_AB });
    await waitFor(() => expect(block('chart')).not.toBeNull());
    const bar = document.querySelector('[data-tab-bar]')!;
    expect(wears(bar, 768).split(' ')).toEqual(expect.arrayContaining(['max-w-[470px]', 'mx-auto']));
  });

  it.each([375, 1024, 1280] as const)('P19.1-T5 AC-3 at %ipx Home is drawn as recorded, to the byte', async (px) => {
    const home = await open(px);
    expect(digestAt(home, px)).toBe(BEFORE_T5[px]);
  });

  it('P19.1-T5 AC-3 passes axe at 768px', async () => {
    await open(768);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});
