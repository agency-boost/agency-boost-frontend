import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import AgentLayout from '@/app/(agent)/layout';
import { atWidth, digestAt, renderInLayout, stubFetch, wears, type StubReply } from '@test/harness';
import {
  BOOTCAMP, eventList, guestEvent, KICKOFF, PRODUCT_REFRESH, PRULINK, RINA_ME, SHELL_STUBS, TOWN_HALL,
} from '@test/events-fixtures';
import EventsLayout from './layout';
import EventsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

/**
 * **`/events` on a tablet and a laptop** (P19.1-T5 AC-4, AC-5; UI-123, the `campaign-event-tablet-desktop` mockup's
 * screens 3 and 4). *"Card content as UI-108"*: the phone's two groups and compact cards, two to a row
 * (`minmax(340px, 1fr)`), the title and the place wrapping but never cut, *KPM | Semua agent* in plain grey; an empty
 * group hidden — never the *IKUT* section's *"Anda belum ikut event yang akan datang."* — and a status a tinted pill
 * with no dot. A phone draws what it drew, to the byte.
 */

type Routes = Record<string, StubReply | StubReply[]>;

/** The list's markup on a phone, on the build before P19.1-T5, from `eventList()`, 2026-11-05 (`digestAt`). */
const BEFORE_T5_PHONE = 'e2dde00390a6584e7e732c78d033de08519a38e0de80c22c7f00d9c562b819d8';

async function open(px: number, routes: Routes = {}) {
  atWidth(px);
  stubFetch({ ...SHELL_STUBS, 'GET /events': { body: eventList() }, ...routes });
  renderInLayout(AgentLayout, <EventsLayout><EventsPage /></EventsLayout>, { me: RINA_ME });
  await waitFor(() => expect(document.querySelector('[data-group]')).not.toBeNull());
}

const card = (title: string) => screen.getByRole('heading', { level: 3, name: title }).closest<HTMLElement>('[data-event]')!;

afterEach(() => vi.unstubAllGlobals());

describe('P19.1-T5 AC-4 /events on a tablet and a laptop (UI-123)', () => {
  it.each([768, 1024, 1280])('P19.1-T5 AC-4 at %ipx: two groups, their cards in columns of at least 340px — two to a row', async (px) => {
    await open(px);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Upcoming2', 'Past3']);
    for (const group of document.querySelectorAll<HTMLElement>('[data-group]')) {
      const list = within(group).getByRole('list');
      expect(wears(list, px).split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]']));
    }
  });

  it('P19.1-T5 AC-4 two to a row at 768, 1024 and 1280px: two 340px columns fit beside the shell, three do not', () => {
    // The page's content width beside the shell: a tablet's 24px gutters; the 64px rail at 1024; the 252px sidebar at 1280.
    const content = { 768: 768 - 48, 1024: 1024 - 64 - 80, 1280: 1280 - 252 - 80 };
    for (const width of Object.values(content)) {
      expect(2 * 340 + 10).toBeLessThanOrEqual(width);
      expect(3 * 340 + 2 * 10).toBeGreaterThan(width);
    }
  });

  it.each([768, 1280])('P19.1-T5 AC-4 at %ipx: KPM | Semua agent is a plain grey line above the title, not small capitals', async (px) => {
    await open(px);
    const line = card('Kickoff 2026').querySelector('[data-audience]') as HTMLElement;
    expect(line).toHaveTextContent(/^KPM \| All agents$/);
    const worn = wears(line, px).split(' ');
    expect(worn).toContain('text-muted');
    expect(worn).not.toContain('uppercase');
    expect(line.nextElementSibling).toBe(screen.getByRole('heading', { level: 3, name: 'Kickoff 2026' }));
  });

  it.each([768, 1280])('P19.1-T5 AC-4 at %ipx: the title and the place wrap to a second line and are never cut', async (px) => {
    const long = guestEvent({
      id: 'ev-long', title: 'Quarterly product refresh and compliance briefing for every agent',
      location: 'Kantor KPM, Ruang serbaguna lantai 3, Gedung Prudential Tower, Jakarta Selatan',
      startsAt: '2026-10-30T02:00:00.000Z', endsAt: '2026-10-30T04:00:00.000Z', startsOn: '2026-10-30',
    });
    await open(px, { 'GET /events': { body: eventList([long, KICKOFF]) } });
    const c = card(long.title);
    const title = within(c).getByRole('heading', { level: 3 });
    const place = within(c).getByText(long.location);
    for (const el of [title, place]) {
      const worn = wears(el, px).split(' ');
      expect(worn).toContain('break-words');
      expect(worn).not.toContain('truncate');
      expect(worn.some((cls) => cls.startsWith('line-clamp'))).toBe(false);
      expect(el).toHaveTextContent(el === title ? long.title : long.location);
    }
  });

  it.each([768, 1280])('P19.1-T5 AC-4 at %ipx: Semua | Akan datang | Sudah lewat, one segmented control — 44px, 40px', async (px) => {
    await open(px);
    const filter = screen.getByRole('group', { name: 'Show events' });
    const worn = wears(filter, px).split(' ');
    expect(worn).toEqual(expect.arrayContaining(['inline-flex', 'rounded-pill', 'bg-card']));
    expect(worn).toContain(px < 1024 ? 'h-11' : 'h-10');
  });

  it('P19.1-T5 AC-4 passes axe at 768px', async () => {
    await open(768);
    const rules = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } };
    expect((await axe(document.body, rules)).violations).toEqual([]);
  });
});

describe('P19.1-T5 AC-5 /events: an empty group hidden, a status a pill without a dot, at every size', () => {
  it.each([375, 768, 1280])('P19.1-T5 AC-5 at %ipx: nothing joined is no empty IKUT section — no line, no heading', async (px) => {
    await open(px, { 'GET /events': { body: eventList([KICKOFF, PRULINK, TOWN_HALL]) } });
    expect(screen.queryByText("You haven't joined any upcoming events yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Going' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Upcoming1', 'Past2']);
  });

  it.each([375, 768, 1280])('P19.1-T5 AC-5 at %ipx: only past events — the Upcoming group is not drawn', async (px) => {
    await open(px, { 'GET /events': { body: eventList([PRULINK, TOWN_HALL, BOOTCAMP]) } });
    expect(document.querySelector('[data-group="upcoming"]')).toBeNull();
    expect(screen.queryByText('No upcoming events right now.')).not.toBeInTheDocument();
  });

  it.each([375, 768, 1280])('P19.1-T5 AC-5 at %ipx: each status a tinted pill in words, and no dot', async (px) => {
    await open(px);
    expect(within(card('PRULink briefing')).getByText('Feedback pending')).toHaveAttribute('data-tone', 'amber');
    expect(within(card('August Town Hall')).getByText("Didn't join")).toHaveAttribute('data-tone', 'grey');
    expect(within(card('New Agent Bootcamp')).getByText('Feedback sent')).toHaveAttribute('data-tone', 'green');
    for (const pill of document.querySelectorAll('[data-event] [data-tone]')) expect(pill.children).toHaveLength(0);
    expect(document.querySelector('[data-event] .rounded-full.h-1\\.5')).toBeNull();
    // An upcoming card's standing is its filled answer, not a *• Not joined* pill.
    expect(card('Kickoff 2026').querySelector('[data-tone]')).toBeNull();
    expect(card(PRODUCT_REFRESH.title).querySelector('[data-tone]')).toBeNull();
  });
});

describe('P19.1-T5 a phone is unchanged (UI-123’s scope: Tablet + Desktop)', () => {
  it.each([375, 360])('P19.1-T5 AC-4 at %ipx the list is drawn as before, to the byte', async (px) => {
    await open(px);
    const root = screen.getByRole('group', { name: 'Show events' }).parentElement!;
    expect(digestAt(root, px)).toBe(BEFORE_T5_PHONE);
    expect(root.querySelector('[data-audience]')).toBeNull();
  });
});
