import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { englishOnly, englishShown } from '@test/english-left';
import {
  atWidth, InLanguage, renderInLayout, renderWithSession, routeParams, stubFetch, type StubReply,
} from '@test/harness';
import {
  BOOTCAMP, conflict, eventList, KICKOFF, NPS, PRODUCT_REFRESH, PRULINK, RINA_ME, SHELL_STUBS, TOWN_HALL,
} from '@test/events-fixtures';
import { eventsMessages } from '@/i18n/messages/events';
import {
  audienceLine, cancelledToast, goingToast, pickScoreToast, refusalOf, scaleHighLine, scaleLowLine, scoredLine,
} from '@/lib/events';
import { ApiRequestError } from '@/lib/api-client';
import type { GuestEvent } from '@/lib/events';
import EventsLayout from './layout';
import EventsPage from './page';
import EventModalPage from './[eventId]/page';

/**
 * **The agents' *Event List* in Indonesian** (P18.98-T4 AC-1 to AC-4, events, campaigns and the calendar): the list —
 * its line, filter, sections, cards with their audience line, pill and *Join* — an event's modal with its RSVP, a past
 * event's feedback form, didn't-join block and thanks, and the toasts. Their words the approved glossary's, each kept term
 * English (§A: the title, *event*, *KPM*, *{company} Event*), what the office typed as typed, and none of the module's
 * English left (`englishShown`). English is every other spec's, unchanged.
 */
const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), pathname: '/events' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: nav.back }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

type Routes = Record<string, StubReply | StubReply[]>;
const EVENTS_ENGLISH = englishOnly(eventsMessages);
const noEnglishLeft = () => expect(englishShown(document.body, EVENTS_ENGLISH)).toEqual([]);

function list(routes: Routes = {}, language: 'id' | 'en' = 'id') {
  nav.pathname = '/events';
  stubFetch({ ...SHELL_STUBS, 'GET /events': { body: eventList() }, ...routes });
  const page = <EventsLayout><EventsPage /></EventsLayout>;
  renderInLayout(AgentLayout, language === 'id' ? <InLanguage language="id">{page}</InLanguage> : page, { me: RINA_ME });
}

function modal(event: GuestEvent, routes: Routes = {}) {
  nav.pathname = `/events/${event.id}`;
  const stub = stubFetch({ ...SHELL_STUBS, 'GET /events': { body: eventList() }, [`GET /events/${event.id}`]: { body: event }, ...routes });
  renderWithSession(
    <InLanguage language="id"><EventsLayout><EventModalPage params={routeParams({ eventId: event.id })} /></EventsLayout></InLanguage>,
    { me: RINA_ME },
  );
  return stub;
}

afterEach(() => vi.unstubAllGlobals());

describe('P18.98-T4 the Event List in Indonesian', () => {
  it('reads the English it is looking for, so a silent zero cannot pass: the same list in English shows it', async () => {
    expect(EVENTS_ENGLISH.length).toBeGreaterThan(40);
    list({}, 'en');
    await screen.findByRole('heading', { level: 3, name: 'Kickoff 2026' });
    expect(englishShown(document.body, EVENTS_ENGLISH)).toEqual(expect.arrayContaining(['Going', 'View event', 'Show events']));
  });

  it('P18.98-T4 AC-1, AC-2 the list: its title kept, its line, filter, sections, pills and Join Indonesian', async () => {
    list();
    await screen.findByRole('heading', { level: 3, name: 'Kickoff 2026' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Event List$/);
    expect(screen.getByText('Lihat event yang akan datang dan yang sudah lewat dari KPM Anda — ikut, dan berikan feedback setelah event selesai.'))
      .toBeInTheDocument();
    const filter = screen.getByRole('group', { name: 'Tampilkan event' });
    expect(within(filter).getAllByRole('button').map((b) => b.textContent)).toEqual(['Semua', 'Akan datang', 'Sudah lewat']);
    for (const name of ['Ikut', 'Akan datang', 'Sudah lewat']) expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    const kickoff = screen.getByRole('heading', { level: 3, name: 'Kickoff 2026' }).closest<HTMLElement>('[data-event]')!;
    // The audience line: the issuer kept (*KPM*), the scope Indonesian; the company's own event, *{company} Event* (§C5).
    expect(within(kickoff).getByText('KPM | Semua agent')).toBeInTheDocument();
    const refresh = screen.getByRole('heading', { level: 3, name: 'Product refresh briefing' }).closest<HTMLElement>('[data-event]')!;
    expect(within(refresh).getByText('Prudential Event | Semua agent')).toBeInTheDocument();
    // A figure in Indonesian: the reader chose it (`InLanguage`).
    expect(within(refresh).getByText(/15 Okt 2026, 14\.00/)).toBeInTheDocument();
    expect(within(kickoff).getByRole('button', { name: 'Ikut Kickoff 2026' })).toHaveTextContent('Ikut');
    expect(within(kickoff).getByText('Belum ikut')).toBeInTheDocument();
    expect(within(kickoff).getByRole('button', { name: 'Lihat event' })).toBeInTheDocument();
    // Typed content as typed: the title, the line, the place.
    expect(within(kickoff).getByText("ev-kickoff's line.")).toBeInTheDocument();
    for (const pill of ['Feedback belum dikirim', 'Tidak ikut', 'Feedback terkirim']) expect(screen.getByText(pill)).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the empty sections, in Indonesian', async () => {
    list({ 'GET /events': { body: eventList([]) } });
    expect(await screen.findByText('Anda belum ikut event yang akan datang.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada event yang akan datang saat ini.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada event yang sudah lewat.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 Join from the card: the shared confirmation and the event, both in Indonesian', async () => {
    list({ 'POST /events/ev-kickoff/rsvp': { body: { ...KICKOFF, me: { rsvp: 'going', claimed: false, feedback: null } } } });
    await userEvent.click(await screen.findByRole('button', { name: 'Ikut Kickoff 2026' }));
    expect(await screen.findByText('Berhasil bergabung ✓ — Anda ikut Kickoff 2026')).toBeInTheDocument();
  });

  it('P18.98-T4 AC-1 a refusal the screen words itself, in Indonesian; the server’s own as it came', async () => {
    list({ 'POST /events/ev-kickoff/rsvp': conflict('EVENT_RSVP_CLOSED', 'Event ini sudah berakhir, jadi RSVP-nya ditutup.') });
    await userEvent.click(await screen.findByRole('button', { name: 'Ikut Kickoff 2026' }));
    expect(await screen.findByText('Event ini sudah berakhir.')).toBeInTheDocument();
  });
});

describe('P18.98-T4 an event’s modal in Indonesian', () => {
  it('P18.98-T4 AC-1 to AC-4 an upcoming event: the tag, audience, date and time, place, and Join event', async () => {
    modal(KICKOFF);
    const box = await screen.findByRole('dialog', { name: 'Kickoff 2026' });
    expect(within(box).getByText('Belum ikut')).toBeInTheDocument();
    expect(within(box).getByText('KPM | Semua agent')).toBeInTheDocument();
    expect(within(box).getByText('24 Okt 2026', { selector: 'strong' })).toBeInTheDocument();
    expect(within(box).getByText('About ev-kickoff.')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Ikut event' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 going: Anda ikut and Batalkan RSVP, the place a link that says it opens a new tab', async () => {
    modal(PRODUCT_REFRESH);
    const box = await screen.findByRole('dialog', { name: 'Product refresh briefing' });
    expect(within(box).getByText('Anda ikut')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Batalkan RSVP' })).toBeInTheDocument();
    expect(within(box).getByRole('link', { name: /Online — Zoom.*\(terbuka di tab baru\)/ })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the feedback form: its question, scale, fields and the toast without a score', async () => {
    modal(PRULINK);
    const box = await screen.findByRole('dialog', { name: 'PRULink briefing' });
    expect(within(box).getByRole('radiogroup', {
      name: 'Seberapa besar kemungkinan Anda merekomendasikan event ini kepada rekan kerja Anda?',
    })).toBeInTheDocument();
    expect(within(box).getByText('0 — Sama sekali tidak mungkin')).toBeInTheDocument();
    expect(within(box).getByText('10 — Sangat mungkin')).toBeInTheDocument();
    expect(within(box).getByLabelText(/^Mengapa\?/)).toHaveAttribute('placeholder', 'Apa yang paling berkesan, baik atau buruk?');
    expect(within(box).getByLabelText(/^Apa yang bisa kami perbaiki\?/)).toHaveAttribute('placeholder', 'Ada saran untuk lain kali?');
    await userEvent.click(within(box).getByRole('button', { name: 'Kirim feedback' }));
    expect(await screen.findByText('Pilih skor dari 0–10 terlebih dahulu')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the didn’t-join block and its claim, and the thanks with the member’s own words as typed', async () => {
    modal(TOWN_HALL);
    const box = await screen.findByRole('dialog', { name: 'August Town Hall' });
    expect(within(box).getByText('Anda tidak ikut event ini')).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Saya sebenarnya hadir di event ini' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-4 the thanks: the score and the member’s why, as typed', async () => {
    modal(BOOTCAMP);
    const box = await screen.findByRole('dialog', { name: 'New Agent Bootcamp' });
    expect(within(box).getByText('Terima kasih atas feedback Anda')).toBeInTheDocument();
    expect(within(box).getByText('Anda memberi skor 9/10 untuk event ini — "Clear and practical."')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('P18.98-T4 AC-1 the not-found state, in Indonesian', async () => {
    modal(KICKOFF, { 'GET /events/ev-kickoff': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'x', requestId: 'r' } } } });
    expect(await screen.findByText('Event ini tidak dapat Anda buka.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembali ke daftar event' })).toBeInTheDocument();
    noEnglishLeft();
  });
});

describe('P18.98-T4 lib/events.ts in each language', () => {
  it('writes its sentences in the language passed, English when none is', () => {
    expect(goingToast('Kickoff', 'id')).toBe('Berhasil bergabung ✓ — Anda ikut Kickoff');
    expect(goingToast('Kickoff')).toBe('Joined ✓ — you\'re going to Kickoff');
    expect(cancelledToast('Kickoff', 'id')).toBe('RSVP untuk Kickoff dibatalkan');
    expect([scaleLowLine(NPS, 'id'), scaleHighLine(NPS, 'id'), pickScoreToast(NPS, 'id')])
      .toEqual(['0 — Sama sekali tidak mungkin', '10 — Sangat mungkin', 'Pilih skor dari 0–10 terlebih dahulu']);
    expect(scoredLine({ score: 7, why: '' }, NPS, 'id')).toBe('Anda memberi skor 7/10 untuk event ini');
    expect(audienceLine({ issuer: 'company', scope: 'leaders' }, 'Prudential', 'id')).toBe('Prudential Event | Khusus leader');
    expect(audienceLine({ issuer: 'group', scope: 'select_agents' }, 'Prudential', 'id')).toBe('Event grup | Agent terpilih');
    const refused = refusalOf(new ApiRequestError(409, { code: 'EVENT_NOT_ENDED', message: 'x', requestId: 'r' }), 'id');
    expect(refused.message).toBe('Event ini belum berakhir.');
  });
});

/** **UI V1 on a phone, in Indonesian** (UI-108): *Ikut* and *Tidak ikut*, *Feedback* not *Masukan*, the office's clock. */
describe('UI-108 the Event List on a phone, in Indonesian', () => {
  it('UI-108 Ikut / Tidak ikut on an upcoming card, Feedback belum dikirim on a past one, 14.00 – 16.00, no English left', async () => {
    atWidth(375);
    list({ 'GET /events': { body: eventList([PRODUCT_REFRESH, KICKOFF, PRULINK, TOWN_HALL, BOOTCAMP]) } });
    await screen.findByRole('heading', { level: 3, name: 'Kickoff 2026' });
    const kickoff = await screen.findByRole('group', { name: 'Jawaban Anda untuk Kickoff 2026' });
    expect(within(kickoff).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ikut', 'Tidak ikut']);
    expect(screen.getByRole('region', { name: 'Akan datang' })).toHaveTextContent('14.00 – 16.00');
    expect(screen.getByText('Feedback belum dikirim')).toBeInTheDocument();
    expect(screen.getByText('Feedback terkirim')).toBeInTheDocument();
    expect(screen.queryByText(/[Mm]asukan/)).not.toBeInTheDocument();
    noEnglishLeft();
  });
});
