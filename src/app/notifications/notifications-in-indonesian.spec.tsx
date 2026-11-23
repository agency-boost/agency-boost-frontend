import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notificationMessages } from '@/i18n/messages/notifications';
import { uiMessages } from '@/i18n/messages/ui';
import { englishOnly, englishShown } from '@test/english-left';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, stubFetch } from '@test/harness';
import NotificationsPage from './page';

/**
 * **`/notifications` in Indonesian** (P18.10-T4 AC-1, AC-2, AC-4; the shared pieces): the inbox's own words — its line,
 * *Mark all read*, a row's toggle and *Unread:*, a repeated notice, the modal's *Close*, the pager, the wait and the
 * empty state — are the approved glossary's, its title kept (§A.2), and **a notice's own words are the API's**, shown
 * as they come (P18.10-T5 AC-4). English is every other spec's, unchanged.
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/notifications',
}));

const READER = makeMe({ permissions: ['notification:read_inbox', 'notification:mark_read'] });

const item = (over: Record<string, unknown> = {}) => ({
  notificationId: 'n-1', templateId: 'join_request.approved',
  title: 'Anda sudah bergabung', detail: 'Permintaan Anda disetujui.', href: null as string | null,
  kpmId: 'kpm-1', createdAt: '2026-09-01T00:00:00.000Z', readAt: null as string | null, ...over,
});
const pageOf = (items: ReturnType<typeof item>[], over: Record<string, unknown> = {}) => ({
  items, unread: items.filter((i) => i.readAt === null).length, total: items.length, page: 1, pageSize: 20, ...over,
});

const ENGLISH = englishOnly(notificationMessages, uiMessages);
const noEnglishLeft = () => expect(englishShown(document.body, ENGLISH)).toEqual([]);

describe('P18.10-T4 /notifications in Indonesian', () => {
  const swallow = (event: Event) => event.preventDefault();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-03T03:00:00Z') });
    document.addEventListener('click', swallow);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.removeEventListener('click', swallow);
  });

  it('AC-1, AC-2 the chrome in Indonesian, the title kept, and a notice as the API wrote it', async () => {
    stubFetch({
      '/notifications': {
        body: pageOf([
          item(),
          item({ notificationId: 'n-2', title: 'Sesi coaching difinalkan', detail: null, readAt: '2026-09-02T00:00:00.000Z' }),
          item({ notificationId: 'n-3', title: 'Sesi coaching difinalkan', detail: null, readAt: '2026-09-02T00:00:00.000Z' }),
        ], { total: 45 }),
      },
    });
    renderInIndonesian(<NotificationsPage />, { me: READER });

    expect(await screen.findByRole('button', { name: 'Belum dibaca: Anda sudah bergabung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('Hal-hal yang sudah terjadi dan perlu Anda ketahui.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai semua sudah dibaca' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai sudah dibaca' })).toBeInTheDocument();
    // Two repeats in a row are one line, named in Indonesian; its toggle reads both.
    expect(screen.getByRole('button', { name: 'Sesi coaching difinalkan, 2 notifikasi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai 2 notifikasi ini belum dibaca' })).toBeInTheDocument();
    // The pager, its landmark and its words.
    const pages = screen.getByRole('navigation', { name: 'Halaman notifikasi' });
    expect(within(pages).getByText('Halaman 1 dari 3')).toBeInTheDocument();
    expect(within(pages).getByRole('button', { name: 'Sebelumnya' })).toBeDisabled();
    expect(within(pages).getByRole('button', { name: 'Berikutnya' })).toBeEnabled();
    noEnglishLeft();

    await userEvent.click(screen.getByRole('button', { name: 'Belum dibaca: Anda sudah bergabung' }));
    const modal = screen.getByRole('dialog', { name: 'Anda sudah bergabung' });
    expect(within(modal).getByRole('button', { name: 'Tutup' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 its wait and its empty state', async () => {
    stubFetch({ '/notifications': [{ body: pageOf([]) }] });
    renderInIndonesian(<NotificationsPage />, { me: READER });
    expect(screen.getByRole('status')).toHaveTextContent('Memuat kotak masuk Anda…');
    expect(await screen.findByText('Belum ada apa pun. Di sinilah Anda akan mendapat kabar tentang unit Anda.')).toBeInTheDocument();
    noEnglishLeft();
  });

  it('AC-1 a refusal the browser composed reads in Indonesian, a server’s as it came', async () => {
    stubFetch({ '/notifications': { status: 503, body: null } });
    renderInIndonesian(<NotificationsPage />, { me: READER });
    expect(await screen.findByRole('alert')).toHaveTextContent('Terjadi kesalahan. Silakan coba lagi.');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
    noEnglishLeft();
  });

  it('EN mode reads as before', async () => {
    stubFetch({ '/notifications': { body: pageOf([]) } });
    renderWithSession(<NotificationsPage />, { me: READER });
    expect(await screen.findByText('Nothing yet. This is where you will hear about your unit.')).toBeInTheDocument();
  });

  /*
   * **P19.26-T5 AC-5 (UI-213, UI-218 (21 Nov)): the Super Admin's page on a phone** — *Notifikasi*, and *Belum ada
   * notifikasi* alone: a Super Admin has no unit. From 768px, and for everybody else, as before (ADR-0283 §3).
   */
  describe('P19.26-T5 AC-5 the Super Admin on a phone', () => {
    const SUPER_ADMIN = makeMe({
      user: {
        id: 'u-root', email: 'superadmin@agencyboost.test', fullName: 'Platform Operator', preferredName: null,
        pronoun: 'they', initials: 'PO', platformRole: 'super_admin',
      },
      membership: null,
      permissions: ['notification:read_inbox', 'notification:mark_read'],
    });

    it('titles it Notifikasi and says only Belum ada notifikasi', async () => {
      atWidth(375);
      stubFetch({ '/notifications': { body: pageOf([]) } });
      renderInIndonesian(<NotificationsPage />, { me: SUPER_ADMIN });
      expect(await screen.findByText('Belum ada notifikasi')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Notifikasi' })).toBeInTheDocument();
      expect(screen.queryByText(/kabar tentang/)).toBeNull();
    });

    it('from 768px reads as before', async () => {
      atWidth(1024);
      stubFetch({ '/notifications': { body: pageOf([]) } });
      renderInIndonesian(<NotificationsPage />, { me: SUPER_ADMIN });
      expect(await screen.findByText('Belum ada apa pun. Di sinilah Anda akan mendapat kabar tentang unit Anda.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    });

    /*
     * The integration round's walk (2026-11-22): beside the avatar *Tandai semua sudah dibaca* covered the title
     * (*Notifika…* at 375px). On a phone it stands under the title row; from 768px it is the row's action as before.
     */
    it.each([[375, false], [1024, true]] as const)('at %ipx Tandai semua sudah dibaca in the title row: %s', async (px, inRow) => {
      atWidth(px);
      stubFetch({ '/notifications': { body: pageOf([item()]) } });
      renderInIndonesian(<NotificationsPage />, { me: SUPER_ADMIN });
      const button = await screen.findByRole('button', { name: 'Tandai semua sudah dibaca' });
      expect(button.closest('[data-title-row]') !== null).toBe(inRow);
      expect(button.closest('[data-mark-all-row]') !== null).toBe(!inRow);
    });

    it('changes nothing for another role on a phone', async () => {
      atWidth(375);
      stubFetch({ '/notifications': { body: pageOf([]) } });
      renderInIndonesian(<NotificationsPage />, { me: READER });
      expect(await screen.findByText('Belum ada apa pun. Di sinilah Anda akan mendapat kabar tentang unit Anda.')).toBeInTheDocument();
    });
  });
});
