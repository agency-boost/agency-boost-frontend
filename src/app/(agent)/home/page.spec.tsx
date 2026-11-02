import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeMessages } from '@/i18n/messages/home';
import { languageOf } from '@/components/home/home-quote';
import type { HomeView } from '@/lib/home';
import { englishOnly, englishShown } from '@test/english-left';
import { renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { AGENT_VIEW, AGUS, LEADER } from '@test/home-fixtures';
import HomePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/home',
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.unstubAllGlobals());

const open = async (view: HomeView, how: 'en' | 'id' = 'en') => {
  stubFetch({ '/home': { body: view } });
  const result = (how === 'id' ? renderInIndonesian : renderWithSession)(<HomePage />, { me: AGUS });
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(document.querySelector('[data-home-tiles]')).not.toBeNull());
  return result;
};

const tile = (label: RegExp) => screen.getByText(label).closest('a')!;

describe('UI-100 Home', () => {
  it('UI-100 the title row is the greeting — the part of the office’s day and the first name in capitals — no goal card, no + Log there', async () => {
    await open(LEADER);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Morning, AGUS');
    // No goal card, no next-event line: the page holds the quote, the tiles, the list, the team and the chart only.
    expect(document.querySelector('[data-goal-hero]')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).parentElement!.textContent).not.toContain('Log');
  });

  it('UI-100 the quote is its own card: Boost of the day, the words in their own language, the person named with no dash', async () => {
    await open(LEADER);
    const card = document.querySelector('[data-home-quote]')!;
    expect(card.querySelector('[data-boost="thinking"]')).not.toBeNull();
    expect(card.querySelector('p')).toHaveAttribute('lang', 'en');
    expect(card.querySelector('cite')).toHaveTextContent(/^Robert Collier$/);
    expect(languageOf('Gantungkan cita-citamu setinggi langit.')).toBe('id');
    expect(languageOf('Habis gelap terbitlah terang.')).toBe('id');
    expect(languageOf('Ing ngarsa sung tuladha.')).toBe('id');
    expect(languageOf('Well done is better than well said.')).toBe('en');
  });

  it('UI-100 the quote is the same words in ID mode: content, never translated', async () => {
    await open(LEADER, 'id');
    expect(document.querySelector('[data-home-quote] p')).toHaveTextContent(LEADER.quote.text);
  });

  it('UI-100 Aktivitas saya shows + Log when today is 0, and opens /activity/log', async () => {
    await open(LEADER);
    const mine = tile(/^My activity$/);
    expect(mine).toHaveAttribute('href', '/activity/log');
    expect(within(mine).getByText('Log').closest('[data-log-pill]')).not.toBeNull();
    expect(mine).toHaveTextContent('Yesterday 5');
  });

  it('UI-100 Aktivitas saya shows today’s count otherwise, with its chip hidden at 0; both open /activity/log', async () => {
    await open(AGENT_VIEW);
    const mine = tile(/^My activity$/);
    expect(mine).toHaveAttribute('href', '/activity/log');
    expect(mine).toHaveTextContent('2today');
    expect(mine.querySelector('[data-log-pill]')).toBeNull();
    expect(mine).not.toHaveTextContent('Yesterday');
  });

  it('UI-100 Jadwal hari ini: n meeting, the Tugas chip, and it opens Calendar on today in Agenda', async () => {
    await open(LEADER);
    const schedule = tile(/^Today’s schedule$/);
    expect(schedule).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    expect(schedule).toHaveTextContent('2meetings');
    expect(schedule).toHaveTextContent('Tasks 3');
  });

  it('UI-100 Active Agent and Coaching 7 hari show the Unit Dashboard’s numbers and format: 4 of 12, the ring, Unit 1/4 · AAB 3/8', async () => {
    await open(LEADER);
    const active = tile(/^Active Agent October$/);
    expect(active).toHaveAttribute('href', '/unit/dashboard');
    expect(active).toHaveTextContent('4of 12');
    expect(within(active).getByRole('img')).toHaveAccessibleName(/33%/);
    expect([...active.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Unit 1/4', 'AAB 3/8']);

    const coached = tile(/^Coaching 7 days$/);
    expect(coached).toHaveAttribute('href', '/coaching');
    expect(coached).toHaveTextContent('2of 12');
    expect(within(coached).getByRole('img')).toHaveAccessibleName(/17%/);
    expect([...coached.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Unit 1/4', 'AAB 1/8']);
  });

  it('UI-100 Aksi hari ini rows and Semua › open /calendar; three rows, a person’s with WhatsApp and Call', async () => {
    await open(LEADER);
    const section = document.querySelector('[data-home-actions]') as HTMLElement;
    expect(within(section).getByRole('link', { name: 'All of today in Calendar' })).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    const rows = section.querySelectorAll('[data-action-row]');
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.querySelector('a[data-row-main]')).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    }
    expect(rows[0]).toHaveTextContent('From: WILSON TANOTO');
    expect(rows[0]).toHaveTextContent('Siapkan daftar 20 prospek baru');
    expect(within(rows[0] as HTMLElement).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6281299990000');
    expect(rows[1]).toHaveTextContent('Ibu Wiwik Setyaningsih');
    expect(within(rows[1] as HTMLElement).getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:+6281211112222');
    // The next day's agenda item: its time in the box, its type and its day under the title, a ›.
    expect(rows[2]).toHaveTextContent('15:00');
    expect(rows[2]).toHaveTextContent('Weekly unit huddle');
    expect(rows[2]).toHaveTextContent(/Internal meeting · 31 Oct/);
  });

  it('UI-100 the chart shows the 7 days ending today, Hari ini last and in the accent, the total on the header', async () => {
    await open(LEADER);
    const chart = document.querySelector('[data-home-chart]') as HTMLElement;
    expect(chart).toHaveTextContent('18 activities');
    expect(within(chart).getByRole('link')).toHaveAttribute('href', '/activity/log');
    const bars = chart.querySelectorAll('.grid-cols-7')[0].children;
    expect([...bars].map((b) => b.textContent)).toEqual(['0', '0', '3', '6', '4', '5', '0']);
    expect(bars[6]).toHaveAttribute('data-today', 'true');
    expect(bars[6].className).toContain('text-amber-ink');
    const days = chart.querySelectorAll('.grid-cols-7')[1].children;
    expect([...days].map((d) => d.textContent)).toEqual(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Today']);
    // A screen reader hears each day and its count.
    expect(chart).toHaveTextContent('Your activity per day, last 7 days: Sat: 0, Sun: 0, Mon: 3');
  });

  it('UI-100 nothing in all seven days: Boost sleeping and one line in the chart’s place (UI-102)', async () => {
    await open({ ...AGENT_VIEW, activity: { today: 0, yesterday: 0, total: 0, days: LEADER.activity.days.map((d) => ({ ...d, count: 0 })) } });
    const chart = document.querySelector('[data-home-chart]') as HTMLElement;
    expect(chart.querySelector('[data-boost]')).not.toBeNull();
    expect(chart).toHaveTextContent('No activity in the last 7 days');
    expect(chart).not.toHaveTextContent('activities');
  });

  it('UI-100 agents see no leader tiles and no Laporan tim; empty sections are hidden', async () => {
    await open(AGENT_VIEW);
    expect(document.querySelectorAll('[data-stat-tile]')).toHaveLength(2);
    expect(screen.queryByText(/Active Agent/)).toBeNull();
    expect(screen.queryByText(/^Coaching 7 days$/)).toBeNull();
    expect(document.querySelector('[data-home-team]')).toBeNull();
    // Nothing to do and nothing ahead: no *Aksi hari ini* at all, not a sentence saying so (D-08).
    expect(document.querySelector('[data-home-actions]')).toBeNull();
  });

  it('UI-100 a read that fails says so through the shared banner', async () => {
    stubFetch({ '/home': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.' } } } });
    renderWithSession(<HomePage />, { me: AGUS });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('UI-101 Laporan tim', () => {
  const rowsOf = () => [...document.querySelectorAll('[data-home-team] [data-person-row]')] as HTMLElement[];
  const namesOf = () => rowsOf().map((r) => r.querySelector('[class*="uppercase"]')!.textContent);

  it('UI-101 starts on Unit, the server’s order kept, the leader never on it', async () => {
    await open(LEADER);
    expect(namesOf()).toEqual(['Lukman Hakim', 'Siti Rahmawati', 'Indah Permatasari']);
    expect(namesOf()).not.toContain('Agus Prasetyo');
  });

  it('UI-101 Group lists everybody in that order — empty both days, then empty today, then the rest — five, then Semua ›', async () => {
    const user = userEvent.setup();
    await open(LEADER);
    await user.click(screen.getByRole('button', { name: 'Group' }));
    expect(screen.getByRole('button', { name: 'Group' })).toHaveAttribute('aria-pressed', 'true');
    expect(namesOf()).toEqual(['Lukman Hakim', 'Herman Widjaja', 'Siti Rahmawati', 'Dewi Lestari', 'Rina Wijaya']);
    await user.click(screen.getByRole('button', { name: 'Show all 7' }));
    expect(namesOf()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
  });

  it('UI-101 a day reads an orange count when they logged and Belum lapor when not — a saved 0 is Belum lapor too', async () => {
    const user = userEvent.setup();
    await open(LEADER);
    await user.click(screen.getByRole('button', { name: 'Group' }));
    const rina = rowsOf().find((r) => r.textContent!.includes('Rina Wijaya'))!;
    const pills = rina.querySelectorAll('[data-logged]');
    expect([...pills].map((p) => [p.getAttribute('data-logged'), p.textContent])).toEqual([['true', '1'], ['false', 'Not reported']]);
  });

  it('UI-101 the reminder opens WhatsApp with the prefilled text — kemarin & hari ini when both days are empty', async () => {
    const user = userEvent.setup();
    await open(LEADER, 'id');
    await user.click(screen.getByRole('button', { name: 'Group' }));
    const href = (name: string) => decodeURIComponent(
      within(rowsOf().find((r) => r.textContent!.includes(name))!).getByRole('link', { name: /WhatsApp/ }).getAttribute('href')!,
    );
    expect(href('Herman Widjaja')).toBe(
      `https://wa.me/6281211002200?text=Halo Herman 👋 Aktivitas kemarin & hari ini belum diisi. Yuk lapor, 1 menit: ${window.location.host}/activity/log – Agus`,
    );
    expect(href('Siti Rahmawati')).toContain('Halo Siti 👋 Aktivitas hari ini belum diisi.');
    // Shown for everybody, those who logged included.
    expect(href('Rina Wijaya')).toContain('wa.me');
  });

  it('UI-101 a missing number goes through Isi nomor WhatsApp, saved on the agent', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch({
      '/home': { body: LEADER },
      'PUT /members/m-lukman/phone': { body: { membershipId: 'm-lukman', phone: '+6281233334444' } },
    });
    renderWithSession(<HomePage />, { me: AGUS });
    await screen.findByText('Lukman Hakim');
    const lukman = rowsOf().find((r) => r.textContent!.includes('Lukman Hakim'))!;
    await user.click(within(lukman).getByRole('button', { name: /WhatsApp/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '81233334444');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/members/m-lukman/phone') && c.init.method === 'PUT')).toBe(true));
  });

  it('UI-101 a leader who may not save a number (an Agent who leads) gets no sheet, only the reminders that can be sent', async () => {
    stubFetch({ '/home': { body: LEADER } });
    renderWithSession(<HomePage />, { me: { ...AGUS, permissions: ['personal_summary:read'] } });
    await screen.findByText('Lukman Hakim');
    const lukman = rowsOf().find((r) => r.textContent!.includes('Lukman Hakim'))!;
    expect(within(lukman).queryByRole('button', { name: /WhatsApp/ })).toBeNull();
    const siti = rowsOf().find((r) => r.textContent!.includes('Siti Rahmawati'))!;
    expect(within(siti).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
  });

  it('UI-101 nothing scrolls sideways at 360: one-line names that give way with …, fixed 52px day cells', async () => {
    await open(LEADER);
    const row = rowsOf()[0];
    expect(row.querySelector('[class*="uppercase"]')!.className).toContain('truncate');
    expect(row.querySelectorAll('.w-\\[3\\.25rem\\]')).toHaveLength(2);
  });
});

describe('UI-100 Home in ID mode', () => {
  it('UI-100 writes the report’s words, Indonesian figures, and no English message of its own', async () => {
    await open(LEADER, 'id');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pagi, AGUS');
    for (const words of ['Aktivitas saya', 'Jadwal hari ini', 'Aksi hari ini', 'Laporan tim', 'Aktivitas 7 hari terakhir', 'Coaching 7 hari', 'Active Agent Oktober']) {
      expect(screen.getByText(words)).toBeInTheDocument();
    }
    expect(tile(/^Jadwal hari ini$/)).toHaveTextContent('2meeting');
    expect(tile(/^Jadwal hari ini$/)).toHaveTextContent('Tugas 3');
    expect(tile(/^Aktivitas saya$/)).toHaveTextContent('Kemarin 5');
    expect(screen.getByText('Dari: WILSON TANOTO')).toBeInTheDocument();
    expect(screen.getByText('18 aktivitas')).toBeInTheDocument();
    expect(screen.getByText('Kmrn')).toBeInTheDocument();
    const english = englishOnly(homeMessages);
    expect(englishShown(document.body, english)).toEqual([]);
  });

  it('UI-100 the greeting follows the office’s clock: Siang, Sore, Malam', async () => {
    for (const [minute, words] of [[12 * 60, 'Siang, AGUS'], [16 * 60, 'Sore, AGUS'], [20 * 60, 'Malam, AGUS'], [2 * 60, 'Malam, AGUS']] as const) {
      const { unmount } = await open({ ...LEADER, now: { minute } }, 'id');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(words);
      unmount();
    }
  });
});
