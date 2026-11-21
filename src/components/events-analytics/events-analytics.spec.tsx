import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { EventsSection } from '@/components/advanced-analytics/events-section';
import { eventAnalyticsMessages } from '@/i18n/messages/event-analytics';
import type { EventFeedback, Kehadiran, KehadiranFigure, KehadiranPerson, KehadiranTone } from '@/lib/event-analytics';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';

const search = { current: new URLSearchParams() };
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/kpm/advanced-analytics/events',
  useSearchParams: () => search.current,
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 3,
  },
  permissions: ['advanced_analytics:read', 'event_attendance:confirm', 'event_feedback:read'],
});

const tone = (pct: number | null): KehadiranTone | null => (pct === null ? null : pct >= 80 ? 'green' : pct >= 50 ? 'yellow' : 'red');
const fig = (hadir: number, expected: number, events = 1): KehadiranFigure => {
  const pct = Math.round((hadir / expected) * 100);
  return { hadir, expected, pct, tone: tone(pct), events };
};

/** Sixteen past events, newest first: fifteen recorded, and *Klinik penjualan* not. */
const TITLES = [
  'PRULink briefing', 'September Town Hall', 'Klinik penjualan', 'New Agent Bootcamp', 'Closing Clinic', 'Agustus Town Hall',
  'MDRT Sharing', 'Juli Kick-off', 'Briefing PRUWell', 'Juni Town Hall', 'Recruitment Day', 'April Town Hall',
  'Maret Town Hall', 'Product briefing PRUPrime', 'Februari Town Hall', 'Kick-off 2026',
];
const HADIR = [5, 24, 0, 6, 14, 22, 18, 25, 11, 21, 9, 23, 24, 12, 22, 30];
const past = TITLES.map((title, i) => ({
  eventId: `ev-${i}`, title, type: { code: 'TRAINING', label: 'Pelatihan' },
  startsOn: `2026-${String(10 - Math.floor(i / 2)).padStart(2, '0')}-${String(20 - (i % 2) * 10).padStart(2, '0')}`,
  recorded: i !== 2, figure: i === 2 ? null : fig(HADIR[i], 30),
}));

const person = (i: number, over: Partial<KehadiranPerson> = {}): KehadiranPerson => ({
  membershipId: `m-${i}`, name: `Anggota ${i}`, photoUrl: null, role: i === 0 ? 'ab' : i === 1 ? 'aab' : 'agent',
  phone: '+6281234567' + String(i).padStart(2, '0'), current: true,
  // Oldest twelve hadir for the first members, fewer for the last.
  marks: past.map((e, k) => (!e.recorded ? '?' : k % 12 < 12 - i ? '1' : '0')).join(''),
  attended: 15 - i, expected: 15, pct: Math.round(((15 - i) / 15) * 100), tone: tone(Math.round(((15 - i) / 15) * 100)),
  recentAttended: 15 - i, recentExpected: 15, lastEventId: 'ev-0', stale: false, underHalf: (15 - i) / 15 < 0.5, ...over,
});
const people = [
  ...Array.from({ length: 11 }, (_, i) => person(i)),
  person(11, { name: 'Yosef Tambunan', role: 'ab', marks: past.map((e) => (e.recorded ? '0' : '?')).join(''), attended: 0, pct: 0, tone: 'red', lastEventId: null, stale: true, underHalf: true, recentAttended: 0 }),
  person(12, { name: 'Pernah Keluar', current: false, phone: null }),
];

const byEvent = (h: number, n: number) => past.map((e) => (e.recorded ? fig(h, n) : null));
const KEHADIRAN: Kehadiran = {
  period: { kind: 'ytd', month: null, from: '2026-01-01', to: '2026-11-20' }, currentMonth: '2026-11', members: 30,
  recordedEvents: 15, recentEvents: 15, summary: { hadir: 18, expected: 30, pct: 59, tone: 'yellow', events: 15 },
  past,
  upcoming: [
    {
      eventId: 'up-1', title: 'November Town Hall', type: { code: 'COMMUNITY', label: 'Town hall' }, startsOn: '2026-11-21',
      startsAt: '2026-11-21T08:00:00.000Z', daysUntil: 1, running: false,
      going: ['m-0', 'm-1', 'm-2'], declined: [{ membershipId: 'm-3', reason: 'Ada janji nasabah' }, { membershipId: 'm-4', reason: null }],
      pending: ['m-5', 'm-6', 'm-7', 'm-8', 'm-11'],
    },
    {
      eventId: 'up-2', title: 'Closing Clinic Desember', type: { code: 'TRAINING', label: 'Pelatihan' }, startsOn: '2026-12-03',
      startsAt: '2026-12-03T06:00:00.000Z', daysUntil: 13, running: false, going: [], declined: [], pending: ['m-0'],
    },
  ],
  groups: [
    {
      key: 'g-1', group: { groupId: 'g-1', name: 'Top Producers 2026' }, leaders: [{ membershipId: 'm-0', name: 'Wilson Tanoto', photoUrl: null, role: 'ab' }],
      people: 10, period: fig(7, 10, 15), recent: { hadir: 7.1, expected: 10, pct: 71, tone: 'yellow', events: 15 }, byEvent: byEvent(3, 10),
      abGroups: [{
        ab: { membershipId: 'm-0', name: 'Wilson Tanoto', photoUrl: null, role: 'ab' }, people: 10,
        period: fig(7, 10, 15), recent: { hadir: 4.5, expected: 10, pct: 45, tone: 'red', events: 15 }, byEvent: byEvent(3, 10),
      }],
    },
    {
      key: 'none', group: null, leaders: [], people: 15, period: fig(7, 15, 15),
      recent: { hadir: 7.2, expected: 15, pct: 48, tone: 'red', events: 15 }, byEvent: byEvent(2, 15), abGroups: [],
    },
  ],
  people,
  canRecord: true,
};

const FEEDBACK: EventFeedback = {
  period: KEHADIRAN.period, currentMonth: '2026-11', events: 16,
  summary: { nps: 32, average: 8.1, answers: 121, shares: { promoter: 45, passive: 42, detractor: 13 }, tone: 'green', few: false, hadir: 206, share: 59 },
  rows: [
    {
      eventId: 'ev-10', title: 'Recruitment Day', type: { code: 'RECRUITMENT', label: 'Recruitment' }, startsOn: '2026-05-15', recorded: true,
      nps: -10, average: 6.9, answers: 6, shares: { promoter: 20, passive: 50, detractor: 30 }, tone: 'red', few: false,
      why: [{ role: 'leader', text: 'Tempat penuh, suara di belakang kurang jelas.' }], improve: [{ role: 'agent', text: 'Mulai tepat waktu.' }],
    },
    {
      eventId: 'ev-3', title: 'New Agent Bootcamp', type: { code: 'TRAINING', label: 'Pelatihan' }, startsOn: '2026-09-08', recorded: true,
      nps: 0, average: 8, answers: 1, shares: { promoter: 0, passive: 100, detractor: 0 }, tone: 'yellow', few: true,
      why: [{ role: 'agent', text: 'Praktis.' }], improve: [],
    },
    ...Array.from({ length: 5 }, (_, i) => ({
      eventId: `ev-f${i}`, title: `Acara ${i}`, type: { code: 'TRAINING', label: 'Pelatihan' }, startsOn: '2026-06-01', recorded: true,
      nps: 30 + i, average: 8, answers: 10, shares: { promoter: 40, passive: 50, detractor: 10 }, tone: 'green' as const, few: false, why: [], improve: [],
    })),
    {
      eventId: 'ev-2', title: 'Klinik penjualan', type: { code: 'TRAINING', label: 'Pelatihan' }, startsOn: '2026-10-10', recorded: false,
      nps: null, average: null, answers: 0, shares: null, tone: null, few: true, why: [], improve: [],
    },
  ],
  constants: { scaleMin: 0, scaleMax: 10, promoterMin: 9, detractorMax: 6 },
};

function show(width = 1024, language: 'en' | 'id' = 'id', feedback: EventFeedback = FEEDBACK) {
  atWidth(width);
  const stub = stubFetch({
    'GET /kpm/advanced-analytics/events/attendance': { body: KEHADIRAN },
    'GET /kpm/advanced-analytics/events/feedback': { body: feedback },
  });
  (language === 'id' ? renderInIndonesian : renderWithSession)(<EventsSection />, { me: OWNER });
  return stub;
}

beforeEach(() => { search.current = new URLSearchParams(); });
afterEach(() => vi.unstubAllGlobals());

describe('P19.25-T1 Event › Kehadiran', () => {
  it('P19.25-T1 AC-1 two parts and one filter, the period; no AB filter; the month reads again', async () => {
    const stub = show();
    expect(await screen.findByRole('tab', { name: 'Kehadiran', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeInTheDocument();
    const period = screen.getByLabelText('Periode');
    expect(within(period).getAllByRole('option')[0]).toHaveTextContent('Sejak awal tahun');
    expect(screen.queryByLabelText(/AB/)).not.toBeInTheDocument();
    await userEvent.selectOptions(period, '2026-10');
    await waitFor(() => expect(stub.calls.some((c) => c.url.endsWith('/events/attendance?month=2026-10'))).toBe(true));
  });

  it('P19.25-T1 AC-2 the navy card: the average, "rata-rata 18 dari 30 anggota hadir per event", a coloured tile per group', async () => {
    show();
    const card = await screen.findByText(/^Kehadiran · 15 event sejak awal tahun · 30 anggota$/).then((el) => el.closest('[data-card]')!);
    expect(card).toHaveTextContent('59%');
    expect(card).toHaveTextContent('rata-rata 18 dari 30 anggota hadir per event');
    const tiles = card.querySelectorAll('[data-group-tile]');
    expect([...tiles].map((t) => [t.textContent?.includes('Top Producers 2026') || t.textContent?.includes('Tanpa group'), t.getAttribute('data-tone')]))
      .toEqual([[true, 'yellow'], [true, 'red']]);
    expect(tiles[0]).toHaveTextContent('rata-rata 7 dari 10 hadir');
    expect(screen.getByText('Hadir atau tidak hadir · 15 event')).toBeInTheDocument();
  });

  it('P19.25-T1 AC-3 Akan datang: Besok and 13 hari lagi; a planned event’s answers — tiles, the reason, Ingatkan n orang', async () => {
    show();
    const upcoming = await screen.findByText('November Town Hall').then((el) => el.closest('ul')!);
    expect(upcoming).toHaveTextContent('Besok');
    expect(upcoming).toHaveTextContent('13 hari lagi');
    expect(within(upcoming).getAllByRole('link', { name: /^Ingatkan semua anggota tentang/ })[0])
      .toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/\?text=/));
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    await userEvent.click(within(upcoming).getByRole('button', { name: /November Town Hall/ }));
    const detail = document.querySelector('[data-detail]')!;
    expect(detail.className).toContain('md:sticky');
    expect(within(detail as HTMLElement).getByText('November Town Hall · Besok')).toBeInTheDocument();
    expect([...detail.querySelectorAll('[data-answer]')].map((t) => t.textContent)).toEqual(['3Akan ikut', '2Tidak ikut', '5Belum jawab']);
    expect(detail).toHaveTextContent('Ada janji nasabah');
    expect(detail).toHaveTextContent('tanpa alasan');
    expect(within(detail as HTMLElement).getByText('Belum jawab · 5')).toBeInTheDocument();
    await userEvent.click(within(detail as HTMLElement).getByRole('button', { name: 'Ingatkan 5 orang' }));
    const sheet = await screen.findByRole('dialog', { name: /Ingatkan yang belum jawab/ });
    expect(within(sheet).getAllByRole('link', { name: /^WhatsApp / })).toHaveLength(5);
    // A tapped row never scrolls the page.
    expect(scroll).not.toHaveBeenCalled();
  });

  it('P19.25-T1 AC-3 Sudah lewat: newest first, %, hadir n/30, six then Lihat semua; a past event’s Tidak hadir and Hadir', async () => {
    show();
    const list = await screen.findByText('PRULink briefing').then((el) => el.closest('[data-list]')!);
    expect(within(list as HTMLElement).getAllByRole('button', { name: /./ }).filter((b) => b.hasAttribute('aria-pressed'))).toHaveLength(6);
    expect(list).toHaveTextContent('17%');
    expect(list).toHaveTextContent('5/30');
    expect(list).toHaveTextContent('Belum dicatat');
    await userEvent.click(within(list as HTMLElement).getByRole('button', { name: 'Lihat semua (16) ›' }));
    expect(within(list as HTMLElement).getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'))).toHaveLength(16);
    await userEvent.click(within(list as HTMLElement).getByRole('button', { name: /September Town Hall/ }));
    const detail = document.querySelector('[data-detail]') as HTMLElement;
    expect(within(detail).getByText('September Town Hall · 80% hadir')).toBeInTheDocument();
    expect(within(detail).getByText(/^Tidak hadir · \d+$/)).toBeInTheDocument();
    expect(within(detail).getByText(/^Hadir · \d+$/)).toBeInTheDocument();
    expect(detail).toHaveTextContent(/hadir \d+ dari 15 event/);
    expect(within(detail).getByRole('button', { name: 'Ubah kehadiran ›' })).toBeInTheDocument();
  });

  it('P19.25-T1 AC-3 an event not recorded says so, and offers Catat kehadiran ›', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Klinik penjualan/ }));
    const detail = document.querySelector('[data-detail]') as HTMLElement;
    expect(detail).toHaveTextContent('Kehadiran event ini belum dicatat.');
    expect(within(detail).getByRole('button', { name: 'Catat kehadiran ›' })).toBeInTheDocument();
  });

  it('P19.25-T1 AC-3 on a phone the detail opens right under the tapped row, and there is no side column', async () => {
    show(390);
    await userEvent.click(await screen.findByRole('button', { name: /September Town Hall/ }));
    const under = document.querySelector('[data-detail-under]')!;
    expect(under.closest('li')).toHaveTextContent('September Town Hall');
    expect(document.querySelector('[data-detail]')).toBeNull();
  });

  it('P19.25-T1 AC-4 Per group: Bandingkan dengan the newest recorded event; two tiles, the % big; open, the AB groups’ pills', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Per group' }));
    const picker = screen.getByLabelText('Bandingkan dengan') as HTMLSelectElement;
    expect(picker.selectedOptions[0].textContent).toMatch(/^PRULink briefing · /);
    expect(within(picker).getAllByRole('option')).toHaveLength(15);
    const card = await waitFor(() => {
      const found = document.querySelector('[data-group-card="g-1"]') as HTMLElement | null;
      if (!found) throw new Error('the card has not loaded');
      return found;
    });
    expect(card).toHaveTextContent('Group Leader WILSON TANOTO · 10 orang');
    expect(card).toHaveTextContent('1 AB group');
    expect(card).toHaveTextContent('Rata-rata · 15 event terakhir');
    expect(card).toHaveTextContent('71%');
    expect(card).toHaveTextContent('7,1 dari 10 orang');
    expect(card).toHaveTextContent('3 dari 10 orang');
    const ab = card.querySelector('[data-ab-group="m-0"]')!;
    expect(ab).toHaveTextContent('45%4,5 / 10');
    await userEvent.selectOptions(picker, String(past.findIndex((e) => e.title === 'Kick-off 2026')));
    expect(card).toHaveTextContent(/Kick-off 2026 · /);
  });

  it('P19.25-T1 AC-5 Per orang: Hadir lowest first, 15 squares old → new, red Terakhir hadir, WhatsApp under half, ten then Lihat semua', async () => {
    show(1280);
    await userEvent.click(await screen.findByRole('tab', { name: 'Per orang' }));
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(10);
    expect(rows[0]).toHaveTextContent('Yosef Tambunan');
    expect(rows[0]).toHaveTextContent('0 dari 15 event');
    expect(rows[0].querySelector('[data-stale]')).toHaveTextContent('Belum pernah');
    expect(rows[0].querySelectorAll('[data-mark]')).toHaveLength(15);
    expect(within(rows[0]).getByRole('link', { name: /WhatsApp/ })).toBeInTheDocument();
    expect(within(rows[9]).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /15 event terakhir · lama → baru/ })).toBeInTheDocument();
    // The one who has left is only named in an event's lists.
    expect(table).not.toHaveTextContent('Pernah Keluar');
    await userEvent.click(within(table).getByRole('button', { name: 'Urutkan menurut Hadir' }));
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('15 dari 15 event');
    await userEvent.click(screen.getByRole('button', { name: 'Lihat semua (12) ›' }));
    expect(within(table).getAllByRole('row')).toHaveLength(13);
  });

  it('P19.25-T1 AC-5 a square’s tooltip names the event, its date and Hadir / Tidak hadir', async () => {
    show(1280);
    await userEvent.click(await screen.findByRole('tab', { name: 'Per orang' }));
    await screen.findByRole('table');
    const came = document.querySelector('[data-mark="1"]')!;
    const missed = document.querySelector('[data-mark="0"]')!;
    expect(TITLES.some((title) => came.textContent!.startsWith(`${title} · `))).toBe(true);
    expect(came.textContent).toMatch(/Hadir$/);
    expect(missed.textContent).toMatch(/Tidak hadir$/);
    // Below the square, so it never covers the headers.
    expect(came.querySelector('span')!.className).toContain('top-[17px]');
  });

  it('P19.25-T1 every word in Indonesian, at 390, 1024 and 1280; no axe violation', async () => {
    const english = englishOnly(eventAnalyticsMessages);
    for (const width of [390, 1024, 1280]) {
      show(width);
      await screen.findByText(/^Kehadiran · 15 event/);
      expect([width, englishShown(document.body, english)]).toEqual([width, []]);
      cleanup();
      vi.unstubAllGlobals();
    }
    show(1024);
    await screen.findByText(/^Kehadiran · 15 event/);
    // The section alone, outside the page's landmarks (`region` is the page's, checked in screens.a11y.spec.tsx); contrast
    // is checked from the tokens, which jsdom cannot sample.
    const results = await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
  });
});

describe('P19.25-T2 Event › Feedback', () => {
  it('P19.25-T2 AC-1, AC-2 the navy card: +32, rata-rata 8,1, 121 jawaban, 121 dari 206; rows lowest NPS first, sedikit jawaban', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Feedback' }));
    const card = await screen.findByText(/otomatis setelah event$/).then((el) => el.closest('[data-card]')!);
    expect(card).toHaveTextContent('+32');
    expect(card).toHaveTextContent('NPS event · rata-rata 8,1 · 121 jawaban');
    expect(card).toHaveTextContent('121 dari 206 yang hadir memberi feedback (59%)');
    expect(within(card as HTMLElement).getByRole('img', { name: /Promoter 45%/ })).toBeInTheDocument();
    const rows = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));
    expect(rows.map((r) => r.querySelector('span')!.textContent).slice(0, 2)).toEqual(['Recruitment Day', 'New Agent Bootcamp']);
    expect(rows).toHaveLength(6);
    expect(rows[0].closest('li')).toHaveTextContent('−10');
    expect(rows[0].closest('li')!.querySelector('.text-signal-red')).not.toBeNull();
    expect(rows[1].closest('li')).toHaveTextContent('sedikit jawaban');
    expect(screen.getByText('NPS terendah dulu')).toBeInTheDocument();
    expect(screen.getByText('Promoter 9–10')).toBeInTheDocument();
    expect(screen.getByText('Detractor 0–6')).toBeInTheDocument();
  });

  it('P19.25-T2 AC-2 tapping a row: Kenapa memberi nilai ini and Yang bisa diperbaiki, tagged Leader / Agent; no AI summary', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Feedback' }));
    await userEvent.click(await screen.findByRole('button', { name: /Recruitment Day/ }));
    const detail = document.querySelector('[data-detail]') as HTMLElement;
    expect(within(detail).getByText('Kenapa memberi nilai ini')).toBeInTheDocument();
    expect(within(detail).getByText('Yang bisa diperbaiki')).toBeInTheDocument();
    expect(detail).toHaveTextContent('LeaderTempat penuh, suara di belakang kurang jelas.');
    expect(detail).toHaveTextContent('AgentMulai tepat waktu.');
    expect(document.body).not.toHaveTextContent(/Ringkasan AI/);
  });

  it('P19.25-T3 AC-1 Lihat masukan › lands here: ?view=feedback&event= opens Feedback with that event chosen, in its month', async () => {
    search.current = new URLSearchParams('view=feedback&event=ev-3&month=2026-09');
    const stub = show(1024, 'id', { ...FEEDBACK, period: { kind: 'month', month: '2026-09', from: '2026-09-01', to: '2026-09-30' } });
    await waitFor(() => expect(stub.calls.some((c) => c.url.endsWith('/events/feedback?month=2026-09'))).toBe(true));
    expect(stub.calls.some((c) => c.url.includes('/events/attendance'))).toBe(false);
    expect(await screen.findByRole('tab', { name: 'Feedback', selected: true })).toBeInTheDocument();
    const detail = document.querySelector('[data-detail]') as HTMLElement;
    expect(within(detail).getByRole('heading', { name: 'New Agent Bootcamp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Agent Bootcamp/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
