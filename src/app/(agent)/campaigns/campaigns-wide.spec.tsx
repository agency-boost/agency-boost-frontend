import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { shareOf } from '@/components/campaigns/campaign-list';
import { atWidth, digestAt, renderInLayout, stubFetch, wears, type StubReply } from '@test/harness';
import { campaign, CHALLENGE, LIST, PUSH, RINA_ME, SHELL_STUBS } from '@test/campaigns-fixtures';
import CampaignsLayout from './layout';
import CampaignsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/campaigns',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/**
 * **`/campaigns` on a tablet and a laptop** (P19.1-T5 AC-4, AC-5; UI-123: *Campaign and Event lists waste the width*, the
 * `campaign-event-tablet-desktop` mockup's screens 1 and 2). *"Card content as UI-108"*: the phone's compact cards in a
 * grid `repeat(auto-fill, minmax(300px, 1fr))`, a group of one or two cards sharing a row with the next, the empty groups
 * hidden (D-08). A phone draws what it drew, to the byte.
 */

type Routes = Record<string, StubReply | StubReply[]>;

/** The list's markup on a phone, on the build before P19.1-T5, from `LIST`, 2026-11-05 (`digestAt`). */
const BEFORE_T5_PHONE = 'a187d162d3e83efca4074b1e3e8060fd93b714ef3bcde5daf1f9cca687437838';

async function open(px: number, routes: Routes = {}) {
  atWidth(px);
  stubFetch({ ...SHELL_STUBS, 'GET /campaigns': { body: LIST }, ...routes });
  renderInLayout(AgentLayout, <CampaignsLayout><CampaignsPage /></CampaignsLayout>, { me: RINA_ME });
  await screen.findByRole('tablist', { name: 'Campaign types' });
  await waitFor(() => expect(document.querySelector('[data-campaign-card]')).not.toBeNull());
}

const groups = () => document.querySelector<HTMLElement>('[data-campaign-groups]');
const cardOf = (title: string) => screen.getByRole('article', { name: title });

/** The page's content width beside the shell at a size: the sidebar or the rail, and the field shell's gutters. */
const CONTENT_PX = { 768: 768 - 2 * 24, 1280: 1280 - 252 - 2 * 40 } as const;
/** What `shareOf` asks for a group of `n` cards: 300px a card and a 10px gap between two. */
const basis = (n: number) => n * 300 + (n - 1) * 10;

afterEach(() => vi.unstubAllGlobals());

describe('P19.1-T5 AC-4 /campaigns on a tablet and a laptop (UI-123)', () => {
  it.each([768, 1024, 1280])('P19.1-T5 AC-4 at %ipx: UI-108’s card — icon tile, name, KPM and the period, the star, Hadiah and Syarat', async (px) => {
    await open(px);
    const sprint = cardOf('Q4 APE Sprint');
    expect(sprint.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(within(sprint).getByText('KPM')).toBeInTheDocument();
    expect(sprint).toHaveTextContent('1 Okt – 31 Des 2026');
    expect([...sprint.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Prize', 'Requirements']);
    expect(within(sprint).getByRole('button', { name: 'Chase Q4 APE Sprint' })).toHaveAttribute('aria-pressed', 'true');
    // An ended campaign is the phone's short row with ›.
    expect(screen.getByRole('button', { name: /^Mid-Year Persistency Push/ })).not.toHaveAttribute('data-chase');
    // No status row; no poster, blurb or *View details*.
    expect(screen.queryByRole('group', { name: 'Show campaigns' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View details' })).not.toBeInTheDocument();
  });

  it.each([768, 1024, 1280])('P19.1-T5 AC-4 at %ipx: each group’s cards in a grid of columns at least 300px', async (px) => {
    await open(px);
    for (const name of ['Running', 'Upcoming', 'Ended']) {
      const grid = screen.getByRole('region', { name }).querySelector(':scope > div') as HTMLElement;
      expect(wears(grid, px).split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]']));
    }
    expect(wears(groups()!, px).split(' ')).toEqual(expect.arrayContaining(['flex', 'flex-wrap']));
  });

  it('P19.1-T5 AC-4 a group of one or two cards asks for their width and grows by its share; three or more take a row', () => {
    expect(shareOf(1)).toEqual({ flex: '1 1 calc(1 * 300px + 0 * 0.625rem)' });
    expect(shareOf(2)).toEqual({ flex: '2 1 calc(2 * 300px + 1 * 0.625rem)' });
    expect(shareOf(3)).toEqual({ flex: '1 1 100%' });
    expect(shareOf(4)).toEqual({ flex: '1 1 100%' });
  });

  it('P19.1-T5 AC-4 at 1280px Berjalan (2) | Akan datang (1) share a row: three cards to it, no half-empty row', () => {
    // The two groups' widths and the gap between them fit beside the full sidebar…
    expect(basis(2) + 10 + basis(1)).toBeLessThanOrEqual(CONTENT_PX[1280]);
    // …and each grows by its count, so every card is the same width: a third of the row.
    const grow = (n: number) => Number(String(shareOf(n).flex).split(' ')[0]);
    const spare = CONTENT_PX[1280] - (basis(2) + 10 + basis(1));
    const cardOf2 = (basis(2) + spare * (grow(2) / (grow(2) + grow(1))) - 10) / 2;
    const cardOf1 = basis(1) + spare * (grow(1) / (grow(2) + grow(1)));
    expect(Math.abs(cardOf2 - cardOf1)).toBeLessThan(1);
  });

  it('P19.1-T5 AC-4 at 768px a single Berjalan card and a single Akan datang card share the row, as `campaign-event-tablet-desktop` 2', () => {
    expect(basis(1) + 10 + basis(1)).toBeLessThanOrEqual(CONTENT_PX[768]);
  });

  it('P19.1-T5 AC-4 the groups say their size to the browser: the share on each, the order the server’s', async () => {
    await open(1280);
    const sections = [...groups()!.querySelectorAll(':scope > section')] as HTMLElement[];
    expect(sections.map((s) => s.getAttribute('data-section'))).toEqual(['running', 'upcoming', 'ended']);
    for (const s of sections) expect(s).toHaveClass('min-w-0');
  });

  it.each([768, 1280])('P19.1-T5 AC-4 at %ipx: Musiman | Struktural is one segmented control — 44px on a tablet, 40px on a laptop', async (px) => {
    await open(px);
    const tabs = screen.getByRole('tablist', { name: 'Campaign types' });
    const worn = wears(tabs, px).split(' ');
    expect(worn).toEqual(expect.arrayContaining(['inline-flex', 'rounded-pill', 'bg-card']));
    expect(worn).toContain(px < 1024 ? 'h-11' : 'h-10');
    expect(within(tabs).getByRole('tab', { name: 'Seasonal' })).toHaveClass('bg-secondary', 'text-secondary-contrast');
  });

  it('P19.1-T5 AC-4 at 1280px: each group’s heading in sentence case with its count, 14px or more, outside the cards', async () => {
    await open(1280);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(['Running2', 'Upcoming1', 'Ended1']);
    for (const h of headings) {
      expect(h).not.toHaveClass('uppercase');
      expect(h).toHaveClass('font-bold', 'text-navy');
    }
  });

  it('P19.1-T5 AC-4 passes axe at 768px', async () => {
    await open(768);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});

describe('P19.1-T5 AC-5 /campaigns: an empty group is hidden at every size (D-08)', () => {
  it.each([375, 768, 1280])('P19.1-T5 AC-5 at %ipx: only the groups with a campaign are drawn', async (px) => {
    await open(px, { 'GET /campaigns': { body: { campaigns: [CHALLENGE, PUSH], can: { chase: true } } } });
    await screen.findByRole('region', { name: 'Upcoming' });
    expect(screen.queryByRole('region', { name: 'Running' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Ended' })).toBeInTheDocument();
    expect(screen.queryByText('No running campaigns right now.')).not.toBeInTheDocument();
  });

  it.each([375, 768, 1280])('P19.1-T5 AC-5 at %ipx: no dot anywhere on the list', async (px) => {
    await open(px, { 'GET /campaigns': { body: { campaigns: [...LIST.campaigns, campaign({ code: 'Z', title: 'Zed' })], can: { chase: true } } } });
    expect(document.querySelector('[data-campaign-card] .rounded-full.h-1\\.5, [data-campaign-card] .rounded-full.h-2')).toBeNull();
  });
});

describe('P19.1-T5 a phone is unchanged (UI-123’s scope: Tablet + Desktop)', () => {
  it.each([375, 360])('P19.1-T5 AC-4 at %ipx the list is drawn as before, to the byte', async (px) => {
    await open(px);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Show campaigns' })).not.toBeInTheDocument());
    const root = screen.getByRole('tablist').parentElement!.parentElement!;
    expect(digestAt(root, px)).toBe(BEFORE_T5_PHONE);
    expect(groups()).toBeNull();
  });
});
