import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { homeMessages } from '@/i18n/messages/home';
import { languageOf } from '@/components/home/home-quote';
import type { HomeView } from '@/lib/home';
import { englishOnly, englishShown } from '@test/english-left';
import { renderInIndonesian, renderWithSession, stubFetch, wears } from '@test/harness';
import { AGENT_VIEW, AGUS, AGUS_AB, LEADER, WIWIK_TASK } from '@test/home-fixtures';
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
    // *Changed 2026-11-07 (P19.8-T2 AC-4; MOB UI-164):* *+ Log* alone across the tile — no *Kemarin* chip beside it.
    expect(mine).not.toHaveTextContent('Yesterday');
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

  // *Rewritten 2026-11-10 (P19.11-T1 AC-3; UX-2):* the Calendar's own rows, today's alone — where they were Home's own,
  // and the third the next day's.
  it('P19.11-T1 AC-3 Aksi hari ini: today’s tasks first as the Calendar’s task rows, then today’s entry as the Agenda’s row; Semua › opens the Agenda from today', async () => {
    // The AB with the Calendar's writes, so each task carries its checkbox.
    stubFetch({ '/home': { body: LEADER } });
    renderWithSession(<HomePage />, { me: AGUS_AB });
    await waitFor(() => expect(document.querySelector('[data-home-actions]')).not.toBeNull());
    const section = document.querySelector('[data-home-actions]') as HTMLElement;
    expect(within(section).getByRole('link', { name: 'All of today in Calendar' })).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    const tasks = within(section).getByRole('list', { name: 'Today’s tasks' });
    const rows = [...tasks.querySelectorAll<HTMLElement>('[data-task]')];
    expect(rows.map((r) => r.getAttribute('data-task'))).toEqual(['coaching:s-1:i-1', 'lead:l-1']);
    // Each the Calendar's own row: a checkbox, the source icon, the name in bold over the note, green WhatsApp, a ›.
    expect(within(rows[0]).getByRole('checkbox', { name: 'Done: From: Wilson Tanoto' })).not.toBeChecked();
    expect(rows[0]).toHaveTextContent('From: WILSON TANOTO');
    expect(rows[0]).toHaveTextContent('Siapkan daftar 20 prospek baru');
    expect(within(rows[0]).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6281299990000');
    expect(within(rows[1]).getByRole('checkbox', { name: 'Done: Ibu Wiwik Setyaningsih' })).not.toBeChecked();
    expect(within(rows[1]).getByRole('button', { name: 'Open Ibu Wiwik Setyaningsih' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', 'https://wa.me/6281211112222');
    expect(rows[1].querySelector('[data-chevron]')).not.toBeNull();
    // Then the entry, the Agenda's row: its time range, title and type, the 3px accent bar in its tone.
    const timed = within(section).getByRole('list', { name: 'Today’s events' });
    const huddle = within(timed).getByRole('button', { name: /^Internal meeting: Weekly unit huddle, 15:00–16:00/ });
    expect(huddle).toHaveTextContent(/15:00–16:00\s*Weekly unit huddle\s*Internal meeting/);
    expect(huddle.className.split(' ')).toEqual(expect.arrayContaining(['border-l-[3px]', 'border-navy-soft']));
    expect(tasks.compareDocumentPosition(timed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('UI-100 the chart shows the 7 days ending today, Hari ini last and in the accent, the total on the header', async () => {
    await open(LEADER);
    const chart = document.querySelector('[data-home-chart]') as HTMLElement;
    expect(chart).toHaveTextContent('18 activities');
    expect(within(chart).getByRole('link')).toHaveAttribute('href', '/activity/log');
    const bars = chart.querySelectorAll('.grid-cols-7')[0].children;
    expect([...bars].map((b) => b.textContent)).toEqual(['0', '0', '3', '6', '4', '5', '0']);
    expect(bars[6]).toHaveAttribute('data-today', 'true');
    expect(bars[6].className).toContain('text-primary-ink');
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

  it('UI-100 P19.11-T1 AC-4 agents see no leader tiles and no Laporan tim; nothing today, Aksi hari ini says so', async () => {
    await open(AGENT_VIEW);
    // *Changed 2026-11-07 (P19.8-T2 AC-4; OD-284):* the Agent's *Leads* joins their two.
    expect(document.querySelectorAll('[data-stat-tile]')).toHaveLength(3);
    expect(tile(/^Leads$/)).toHaveAttribute('href', '/leads');
    expect(screen.queryByText(/Active Agent/)).toBeNull();
    expect(screen.queryByText(/^Coaching 7 days$/)).toBeNull();
    expect(document.querySelector('[data-home-team]')).toBeNull();
    // *Changed 2026-11-10 (P19.11-T1 AC-4; UXQ6):* nothing today — the card stays, one line saying so, *Semua* above it,
    // where it was hidden (D-08).
    const actions = document.querySelector('[data-home-actions]') as HTMLElement;
    expect(within(actions).getByText('Nothing scheduled for today.')).toBeInTheDocument();
    expect(within(actions).getByRole('link', { name: 'All of today in Calendar' })).toHaveAttribute('href', '/calendar?view=agenda&date=2026-10-30');
    expect(within(actions).queryByRole('list')).toBeNull();
  });

  it('UI-100 a read that fails says so through the shared banner', async () => {
    stubFetch({ '/home': { status: 500, body: { error: { code: 'INTERNAL', message: 'Something went wrong.' } } } });
    renderWithSession(<HomePage />, { me: AGUS });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('UI-101 Laporan tim', () => {
  const rowsOf = () => [...document.querySelectorAll('[data-home-team] [data-person-row]')] as HTMLElement[];
  // The name alone: no row draws a level tag before it, on Unit or Group (P19.11-T6 AC-3).
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
    // *Changed 2026-11-08 (P19.9-T2 AC-1; ADR-0235, OD-278 option 3):* *Semua ›* opens the rest in place again, where
    // from P19.8-T2 it opened the Unit Dashboard's *Aktivitas* tab.
    const all = screen.getByRole('button', { name: 'All 7 people' });
    expect(all).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /on the Unit Dashboard/ })).toBeNull();
    await user.click(all);
    expect(namesOf()).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('UI-101 a day reads an orange count when they logged and Belum lapor when not — a saved 0 is Belum lapor too', async () => {
    const user = userEvent.setup();
    await open(LEADER);
    await user.click(screen.getByRole('button', { name: 'Group' }));
    const rina = rowsOf().find((r) => r.textContent!.includes('Rina Wijaya'))!;
    const pills = rina.querySelectorAll('[data-logged]');
    // *Changed 2026-11-07 (P19.8-T2 AC-8; MOB UI-165, D-22):* *Belum lapor* is a grey ✕ of that name, not a pill.
    expect([...pills].map((p) => [p.getAttribute('data-logged'), p.textContent || p.getAttribute('aria-label')]))
      .toEqual([['true', '1'], ['false', 'Not reported']]);
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

  it('UI-101 nothing scrolls sideways at 360: names that wrap rather than cut on a phone, fixed 52px day cells', async () => {
    await open(LEADER);
    const row = rowsOf()[0];
    // *Changed 2026-11-07 (P19.8-T2 AC-8; MOB UI-165):* never cut on a phone, two lines; one line with … from 768px.
    expect(wears(row.querySelector('[class*="uppercase"]')!, 360).split(' ')).toContain('whitespace-normal');
    expect(wears(row.querySelector('[class*="uppercase"]')!, 1280).split(' ')).toContain('truncate');
    expect(row.querySelectorAll('.w-\\[3\\.25rem\\]')).toHaveLength(2);
  });
});

describe('UI-100 Home in ID mode', () => {
  it('UI-100 writes the report’s words, Indonesian figures, and no English message of its own', async () => {
    await open(LEADER, 'id');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pagi, AGUS');
    // *Changed 2026-11-07 (P19.8-T2 AC-8; MOB UI-165):* *Laporan aktivitas tim*, the owner's copy change.
    for (const words of ['Aktivitas saya', 'Jadwal hari ini', 'Aksi hari ini', 'Laporan aktivitas tim', 'Aktivitas 7 hari terakhir', 'Coaching 7 hari', 'Active Agent Oktober']) {
      expect(screen.getByText(words)).toBeInTheDocument();
    }
    expect(tile(/^Jadwal hari ini$/)).toHaveTextContent('2meeting');
    expect(tile(/^Jadwal hari ini$/)).toHaveTextContent('Tugas 3');
    // *Changed 2026-11-07 (P19.8-T2 AC-4):* *+ Log* alone when today is 0; *Kemarin 5* beside a count (`home-review.spec.tsx`).
    expect(tile(/^Aktivitas saya$/)).toHaveTextContent('Log');
    expect(screen.getByText('Dari: WILSON TANOTO')).toBeInTheDocument();
    expect(screen.getByText('18 aktivitas')).toBeInTheDocument();
    expect(screen.getByText('Kmrn')).toBeInTheDocument();
    const english = englishOnly(homeMessages);
    expect(englishShown(document.body, english)).toEqual([]);
  });

  it('UI-100 the greeting follows the office’s clock: Siang, Sore, Malam', async () => {
    for (const [minute, words] of [[12 * 60, 'Siang, AGUS'], [16 * 60, 'Sore, AGUS'], [20 * 60, 'Malam, AGUS'], [2 * 60, 'Malam, AGUS']] as const) {
      const { unmount } = await open({ ...LEADER, now: { ...LEADER.now, minute } }, 'id');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(words);
      unmount();
    }
  });
});

/**
 * **P19.11-T1 — *Aksi hari ini* as the Calendar's own rows** (UX-1, UX-2; UXQ6, UXQ8): the AB with the Calendar's writes,
 * so each task carries its checkbox.
 */
describe('P19.11-T1 Aksi hari ini ticks, counts open tasks, says when today is empty, and turns with the day', () => {
  const homeReads = (stub: ReturnType<typeof stubFetch>) => stub.calls.filter((c) => c.url.endsWith('/home'));
  const show = async (view: HomeView, routes: Parameters<typeof stubFetch>[0] = {}) => {
    const stub = stubFetch({ '/home': { body: view }, ...routes });
    renderWithSession(<HomePage />, { me: AGUS_AB });
    await waitFor(() => expect(document.querySelector('[data-home-actions]')).not.toBeNull());
    return stub;
  };
  const rowOf = (taskId: string) => document.querySelector<HTMLElement>(`[data-task="${taskId}"]`)!;
  /** The one completed style (AC-1): checked, struck, WhatsApp and › faded — WhatsApp still a link. */
  const drawnDone = (row: HTMLElement) => {
    expect(row).toHaveAttribute('data-done');
    expect(within(row).getByRole('checkbox')).toBeChecked();
    expect(within(row).getByText('IBU WIWIK SETYANINGSIH').className).toContain('line-through');
    expect(within(row).getByText('Invite BOP').className).toContain('line-through');
    expect(within(row).getByRole('link', { name: /WhatsApp/ }).closest('.opacity-40')).not.toBeNull();
    expect(row.querySelector('[data-chevron]')!.className).toContain('opacity-40');
  };

  it('P19.11-T1 AC-1 AC-2 AC-3 a tap ticks the task at its source in the completed style, and Tugas n counts open tasks alone; Undo restores both', async () => {
    const user = userEvent.setup();
    const stub = await show(LEADER, {
      'PUT /leads/l-1/next-action/done': [{ body: { id: 'l-1', version: 3 } }, { body: { id: 'l-1', version: 4 } }],
    });
    expect(tile(/^Today’s schedule$/)).toHaveTextContent('Tasks 3');
    await user.click(within(rowOf('lead:l-1')).getByRole('checkbox', { name: 'Done: Ibu Wiwik Setyaningsih' }));
    await waitFor(() => expect(rowOf('lead:l-1')).toHaveAttribute('data-done'));
    const ticks = stub.calls.filter((c) => c.url.includes('/next-action/done'));
    expect(JSON.parse(ticks[0].init.body as string)).toEqual({ done: true, version: 2 });
    drawnDone(rowOf('lead:l-1'));
    // Still listed, in its place; the chip counts what is left.
    expect([...document.querySelectorAll('[data-task]')].map((r) => r.getAttribute('data-task'))).toEqual(['coaching:s-1:i-1', 'lead:l-1']);
    expect(tile(/^Today’s schedule$/)).toHaveTextContent('Tasks 2');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rowOf('lead:l-1')).not.toHaveAttribute('data-done'));
    expect(JSON.parse(stub.calls.filter((c) => c.url.includes('/next-action/done'))[1].init.body as string)).toEqual({ done: false, version: 3 });
    expect(tile(/^Today’s schedule$/)).toHaveTextContent('Tasks 3');
    expect(homeReads(stub)).toHaveLength(1);
  });

  it('P19.11-T1 AC-1 AC-2 a task read ticked from the server is drawn in the same completed style and not counted; unticking pins its version and restores it', async () => {
    const user = userEvent.setup();
    const ticked: HomeView = {
      ...LEADER,
      schedule: { ...LEADER.schedule, tasks: 2 },
      actions: LEADER.actions.map((a) => (a.kind === 'task' && a.task.taskId === WIWIK_TASK.taskId ? { kind: 'task', task: { ...WIWIK_TASK, done: true } } : a)),
    };
    const stub = await show(ticked, { 'PUT /leads/l-1/next-action/done': { body: { id: 'l-1', version: 3 } } });
    drawnDone(rowOf('lead:l-1'));
    expect(tile(/^Today’s schedule$/)).toHaveTextContent('Tasks 2');
    await user.click(within(rowOf('lead:l-1')).getByRole('checkbox'));
    await waitFor(() => expect(rowOf('lead:l-1')).not.toHaveAttribute('data-done'));
    expect(JSON.parse(stub.calls.find((c) => c.url.includes('/next-action/done'))!.init.body as string)).toEqual({ done: false, version: 2 });
    expect(within(rowOf('lead:l-1')).getByText('IBU WIWIK SETYANINGSIH').className).not.toContain('line-through');
    expect(tile(/^Today’s schedule$/)).toHaveTextContent('Tasks 3');
  });

  it('P19.11-T1 AC-3 a task with no number fills it from the row: the lead is read first, so its email and version are its own', async () => {
    const user = userEvent.setup();
    const lead = {
      id: 'l-1', ownerMembershipId: 'mem-agus', type: 'sales', name: 'Ibu Wiwik Setyaningsih',
      contact: { phone: null, email: 'wiwik@example.test' }, statusCode: null, thisMonth: false, remarks: null,
      nextActionDate: null, nextActionNote: null, outcome: null, source: null, dateRegistered: '2026-09-04T03:00:00.000Z',
      version: 3, flags: [], overdueDays: null, committedMonths: [], lastEditedBy: null, history: [],
    };
    const noNumber: HomeView = { ...LEADER, actions: [{ kind: 'task', task: { ...WIWIK_TASK, phone: null, done: true } }] };
    const stub = await show(noNumber, {
      'GET /leads/l-1': { body: lead },
      'PATCH /leads/l-1': { body: { ...lead, contact: { phone: '+6281211112222', email: 'wiwik@example.test' }, version: 4 } },
    });
    await user.click(within(rowOf('lead:l-1')).getByRole('button', { name: /WhatsApp/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Enter WhatsApp number' });
    await user.type(within(sheet).getByLabelText('WhatsApp number'), '081211112222');
    await user.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(stub.calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const patch = stub.calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(String(patch.init.body))).toEqual({ contact: { phone: expect.any(String), email: 'wiwik@example.test' }, version: 3 });
  });

  it('P19.11-T1 AC-3 without calendar_entry:update a task row has no checkbox — the server refuses the tick too', async () => {
    await open(LEADER);
    expect(document.querySelectorAll('[data-task]')).toHaveLength(2);
    expect(within(document.querySelector('[data-home-actions]') as HTMLElement).queryByRole('checkbox')).toBeNull();
  });

  it('P19.11-T1 AC-4 nothing today in Indonesian: Tidak ada tugas atau jadwal hari ini., Semua still there', async () => {
    stubFetch({ '/home': { body: { ...LEADER, actions: [] } } });
    renderInIndonesian(<HomePage />, { me: AGUS_AB });
    const actions = await waitFor(() => {
      const el = document.querySelector('[data-home-actions]') as HTMLElement | null;
      expect(el).not.toBeNull();
      return el!;
    });
    expect(within(actions).getByText('Tidak ada tugas atau jadwal hari ini.')).toBeInTheDocument();
    expect(within(actions).getByRole('link', { name: 'Semua untuk hari ini di Kalender' })).toBeInTheDocument();
  });

  it('P19.11-T1 AC-5 Home reads itself again after the office’s midnight and draws the new day’s list', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      // 23:59 in Jakarta; the read after midnight answers the next day, with nothing on it yet.
      const late: HomeView = { ...LEADER, now: { minute: 23 * 60 + 59, at: '2026-10-30T16:59:00.000Z' } };
      const next: HomeView = { ...LEADER, today: '2026-10-31', yesterday: '2026-10-30', actions: [], now: { minute: 0, at: '2026-10-30T17:00:05.000Z' } };
      const stub = stubFetch({ '/home': [{ body: late }, { body: next }] });
      renderWithSession(<HomePage />, { me: AGUS_AB });
      await waitFor(() => expect(document.querySelectorAll('[data-task]')).toHaveLength(2));
      expect(homeReads(stub)).toHaveLength(1);
      await act(async () => { vi.advanceTimersByTime(75_000); });
      await waitFor(() => expect(homeReads(stub)).toHaveLength(2));
      await waitFor(() => expect(screen.getByText('Nothing scheduled for today.')).toBeInTheDocument());
      expect(document.querySelectorAll('[data-task]')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
