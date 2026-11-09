import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AgentShell } from '@/components/agent-shell';
import { ToastHost } from '@/components/ui/toast';
import type { Me } from '@/lib/session';
import { resetPending, type MySurveyRun, type SurveyPending } from '@/lib/surveys';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import { SurveyPopup } from './survey-popup';

const route = vi.hoisted(() => ({ path: '/home' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => route.path,
  useSearchParams: () => new URLSearchParams(),
}));

const INDAH: Me = makeMe({
  membership: {
    membershipId: 'mem-indah', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
});

/** The reminder mockup's run: *Survei NPS KPM Q4 2026*, 27 October to 9 November. */
const NPS: MySurveyRun = {
  runId: 'run-nps', kind: 'nps', periodKey: '2026-Q4', opensOn: '2026-10-27', closesOn: '2026-11-09', daysLeft: 6,
  answeredCount: 0, totalCount: 6, minutes: 3, anonymous: true, notice: 'anonymous',
};
const QUAL: MySurveyRun = { ...NPS, runId: 'run-qual', kind: 'qual', periodKey: '2026-12', totalCount: 9, minutes: 5, anonymous: false, notice: 'per_person' };
const pending = (over: Partial<SurveyPending> = {}): SurveyPending => ({
  today: '2026-11-03', kpmCode: '0417', open: [NPS], sentOpen: [], popup: null, ...over,
});

const tabBar = () => document.querySelector<HTMLElement>('[data-tab-bar]')!;

describe('P19.5-T4 the survey reminder (C-R1 to C-R10; survey-reminder-user-2026-11-03.html)', () => {
  beforeEach(() => {
    resetPending();
    route.path = '/home';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetPending();
  });

  describe('Lainnya: the dot, the Perlu diisi card and the Survei tile (C-R2, C2-2)', () => {
    async function openSheet(p: SurveyPending | { status: number }) {
      atWidth(375);
      stubFetch({ '/surveys/pending': 'status' in p ? { status: p.status, body: { error: { code: 'X', message: 'x' } } } : { body: p } });
      renderInIndonesian(<AgentShell title="Home">x</AgentShell>, { me: INDAH });
      return tabBar();
    }

    it('P19.5-T4 AC-8 C2-2 on an ordinary day: a red dot on Lainnya, the card heads the sheet, the tile has the dot', async () => {
      const bar = await openSheet(pending());
      const more = await within(bar).findByRole('button', { name: 'Lainnya, ada survei yang perlu diisi' });
      expect(more.querySelector('[data-survey-dot]')).not.toBeNull();
      await userEvent.click(more);
      const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
      const card = sheet.querySelector('[data-survey-card="run-nps"]')!;
      expect(within(sheet).getByRole('heading', { name: 'Perlu diisi' })).toBeInTheDocument();
      expect(card).toHaveTextContent('Survei NPS KPM Q4 2026');
      expect(card).toHaveTextContent('Berakhir 9 Nov · 6 hari lagi');
      expect(within(card as HTMLElement).getByRole('link', { name: 'Isi' })).toHaveAttribute('href', '/surveys/run-nps');
      const tile = within(sheet).getByRole('link', { name: 'Survei, ada survei yang perlu diisi' });
      expect(tile).toHaveAttribute('href', '/surveys');
      expect(tile.querySelector('[data-survey-dot]')).not.toBeNull();
      // The cards sit above the groups: the sheet's first heading.
      expect(within(sheet).getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Perlu diisi');
    });

    it('C-R6 with an answer saved the card says n dari M terjawab and Lanjutkan; the day before, Berakhir besok', async () => {
      const bar = await openSheet(pending({ open: [{ ...NPS, answeredCount: 1, daysLeft: 1 }] }));
      await userEvent.click(await within(bar).findByRole('button', { name: /Lainnya, ada survei/ }));
      const card = (await screen.findByRole('dialog', { name: 'Lainnya' })).querySelector('[data-survey-card]')!;
      expect(card).toHaveTextContent('Berakhir besok, 9 Nov · 1 dari 6 terjawab');
      expect(within(card as HTMLElement).getByRole('link', { name: 'Lanjutkan' })).toBeInTheDocument();
    });

    it('C-R7, C2-6 two surveys open at once: two cards in Lainnya', async () => {
      const bar = await openSheet(pending({ open: [NPS, QUAL] }));
      await userEvent.click(await within(bar).findByRole('button', { name: /Lainnya, ada survei/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
      expect(sheet.querySelectorAll('[data-survey-card]')).toHaveLength(2);
      expect(sheet.querySelector('[data-survey-card="run-qual"]')).toHaveTextContent('Survei kualitatif Des 2026');
    });

    it('C-R9, AC-6 sent and still open: no dot, the green Terima kasih card', async () => {
      const bar = await openSheet(pending({ open: [], sentOpen: [{ runId: 'run-nps', kind: 'nps', periodKey: '2026-Q4', closesOn: '2026-11-09' }] }));
      const more = within(bar).getByRole('button', { name: 'Lainnya' });
      await waitFor(() => expect(document.querySelector('[data-survey-dot]')).toBeNull());
      await userEvent.click(more);
      const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
      expect(sheet.querySelector('[data-survey-thanks]')).toHaveTextContent('Terima kasih, survei sudah diisi');
      expect(sheet.querySelector('[data-survey-card]')).toBeNull();
      // The tile is there all the same (D-37), with no dot.
      expect(within(sheet).getByRole('link', { name: 'Survei' })).toBeInTheDocument();
    });

    it('C-R1, C2-5 a member invited to nothing sees no dot and no card — and the tile, every role’s (OD-267)', async () => {
      const bar = await openSheet(pending({ open: [] }));
      await userEvent.click(within(bar).getByRole('button', { name: 'Lainnya' }));
      const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
      expect(sheet.querySelector('[data-survey-cards]')).toBeNull();
      expect(sheet.querySelector('[data-survey-dot]')).toBeNull();
      expect(within(sheet).getByRole('link', { name: 'Survei' })).toHaveAttribute('href', '/surveys');
    });

    it('a refused read draws the sheet as before: no card, no dot', async () => {
      const bar = await openSheet({ status: 403 });
      await userEvent.click(within(bar).getByRole('button', { name: 'Lainnya' }));
      const sheet = await screen.findByRole('dialog', { name: 'Lainnya' });
      expect(sheet.querySelector('[data-survey-cards]')).toBeNull();
    });
  });

  describe('the Home popup (C-R3 to C-R7; C2-1, C2-3, C2-6)', () => {
    function show(p: SurveyPending) {
      const stub = stubFetch({ '/surveys/pending': { body: p }, 'POST /surveys/popup/shown': { status: 204 } });
      const view = renderInIndonesian(<ToastHost><SurveyPopup /></ToastHost>, { me: INDAH });
      return { ...stub, ...view };
    }

    it('C-R3 on an ordinary day the server sends no popup, and none is drawn', async () => {
      const { calls } = show(pending());
      await waitFor(() => expect(calls.some((c) => c.url.includes('/surveys/pending'))).toBe(true));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('C2-1 the day before the end: the red Berakhir besok, its line, the facts; drawn, it is recorded at once', async () => {
      const { calls } = show(pending({ open: [{ ...NPS, daysLeft: 1 }], popup: { moment: 'last_day', runIds: ['run-nps'] } }));
      const dialog = await screen.findByRole('dialog', { name: 'Survei NPS KPM Q4 2026' });
      expect(within(dialog).getByText('Berakhir besok')).toHaveClass('text-pill-red-ink');
      expect(dialog).toHaveTextContent('Ditutup 9 Nov. Isi sekarang supaya suara Anda ikut dihitung.');
      expect(dialog).toHaveTextContent('6 pertanyaan · ±3 menit');
      expect(dialog).toHaveTextContent('NPS anonim');
      expect(within(dialog).getByRole('link', { name: 'Isi sekarang' })).toHaveAttribute('href', '/surveys/run-nps');
      await waitFor(() => expect(calls.find((c) => c.url.includes('/surveys/popup/shown'))?.init.body)
        .toBe(JSON.stringify({ moment: 'last_day', runIds: ['run-nps'] })));
    });

    it('C2-3 halfway, after 1 of 6: Tinggal n hari, “Anda sudah menjawab 1 dari 6”, and Lanjutkan', async () => {
      show(pending({ open: [{ ...NPS, answeredCount: 1, daysLeft: 7 }], popup: { moment: 'halfway', runIds: ['run-nps'] } }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Tinggal 7 hari');
      expect(dialog).toHaveTextContent('Anda sudah menjawab 1 dari 6. Lanjutkan dari situ.');
      expect(within(dialog).getByRole('link', { name: 'Lanjutkan' })).toHaveAttribute('href', '/surveys/run-nps');
    });

    it('C-R3 the opening: Survei baru, “KPM 0417 ingin mendengar pendapat Anda”', async () => {
      show(pending({ popup: { moment: 'opened', runIds: ['run-nps'] } }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Survei baru');
      expect(dialog).toHaveTextContent('KPM 0417 ingin mendengar pendapat Anda. Dibuka sampai 9 Nov.');
    });

    it('C-R7, C2-6 two surveys due: one popup, “2 survei menunggu Anda”, each named in its facts', async () => {
      show(pending({ open: [NPS, QUAL], popup: { moment: 'opened', runIds: ['run-nps', 'run-qual'] } }));
      expect(await screen.findAllByRole('dialog')).toHaveLength(1);
      const dialog = screen.getByRole('dialog', { name: '2 survei menunggu Anda' });
      expect(dialog).toHaveTextContent('Survei NPS KPM · 6 pertanyaan · ±3 menit');
      expect(dialog).toHaveTextContent('Survei kualitatif · 9 pertanyaan · ±5 menit');
    });

    it('C-R4 Nanti saja closes it, with the toast; it is not drawn again', async () => {
      show(pending({ popup: { moment: 'opened', runIds: ['run-nps'] } }));
      await userEvent.click(await screen.findByRole('button', { name: 'Nanti saja' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(await screen.findByText('Kami ingatkan lagi 1 hari sebelum berakhir')).toBeInTheDocument();
    });

    it('C-R5 never over another dialog or sheet already open', async () => {
      const other = document.createElement('div');
      other.setAttribute('role', 'dialog');
      other.setAttribute('aria-modal', 'true');
      document.body.appendChild(other);
      const { calls } = show(pending({ popup: { moment: 'opened', runIds: ['run-nps'] } }));
      await waitFor(() => expect(calls.some((c) => c.url.includes('/surveys/pending'))).toBe(true));
      await act(async () => { await Promise.resolve(); });
      expect(screen.queryByText('Survei baru')).toBeNull();
      expect(calls.some((c) => c.url.includes('/surveys/popup/shown'))).toBe(false);
      other.remove();
    });

    it('axe: the popup in English, clean', async () => {
      stubFetch({ '/surveys/pending': { body: pending({ popup: { moment: 'opened', runIds: ['run-nps'] } }) }, 'POST /surveys/popup/shown': { status: 204 } });
      renderWithSession(<ToastHost><SurveyPopup /></ToastHost>, { me: INDAH });
      const dialog = await screen.findByRole('dialog', { name: 'KPM NPS survey Q4 2026' });
      const results = await axe(dialog, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations).toEqual([]);
    });
  });
});
