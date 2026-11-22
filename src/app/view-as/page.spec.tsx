import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { InLanguage, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { viewAsMessages } from '@/i18n/messages/view-as';
import { getAccessToken, isImpersonating, setAccessToken, setImpersonating } from '@/lib/api-client';
import { isViewAsWindow } from '@/lib/view-as';
import ViewAsPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/view-as',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  permissions: ['kpm:list_all', 'impersonation:start'],
});

const CODE = 'abcDEF_123-ghijklmnopqrstuvwxyz0123456789AB';

/**
 * **P19.23-T2 AC-7 — the view-as window's own page** (ADR-0277): the code out of the address at once, redeemed once as
 * the Super Admin, the session taken up in this window's memory, then the person's landing.
 */
describe('P19.23-T2 AC-7 /view-as', () => {
  beforeEach(() => {
    setAccessToken('superadmin-token');
    setImpersonating(false);
    replace.mockClear();
    window.history.replaceState(null, '', `/view-as#${CODE}`);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('P19.23-T2 AC-7 takes the code out of the address, redeems it once, and lands on the person\'s page', async () => {
    const { calls } = stubFetch({
      'POST /admin/impersonate/handoff': { body: {
        accessToken: 'session-token', expiresAt: '2026-11-20T04:00:00.000Z', sessionId: 's-1', readOnly: true,
      } },
    });
    const { session } = renderWithSession(<ViewAsPage />, { me: SUPER_ADMIN, loading: false });

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(window.location.hash).toBe('');
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ code: CODE });
    expect(getAccessToken()).toBe('session-token');
    expect(isImpersonating()).toBe(true);
    expect(isViewAsWindow()).toBe(true);
    expect(session.reload).toHaveBeenCalled();
  });

  it('P19.23-T2 AC-7 waits for the Super Admin\'s own session before asking, saying what is opening', () => {
    const { calls } = stubFetch({});
    renderWithSession(<ViewAsPage />, { me: null, loading: true });
    expect(screen.getByText('Opening their view…')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('P19.23-T2 AC-7 a window with no code says so, and asks nothing', async () => {
    window.history.replaceState(null, '', '/view-as');
    const { calls } = stubFetch({});
    renderWithSession(<ViewAsPage />, { me: SUPER_ADMIN, loading: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('opened without its one-time code');
    expect(screen.getByRole('button', { name: 'Close this window' })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('P19.23-T2 AC-7 a browser signed out asks the reader to sign in as a Super Admin first', async () => {
    const { calls } = stubFetch({});
    renderWithSession(<ViewAsPage />, { me: null, loading: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign in as a Super Admin in this browser first');
    expect(calls).toHaveLength(0);
  });

  it('P19.23-T2 AC-7 a spent code shows the server\'s words, a way to close, and the KPM list', async () => {
    stubFetch({
      'POST /admin/impersonate/handoff': { status: 410, body: { error: {
        code: 'IMPERSONATION_HANDOFF_SPENT', requestId: 'r-1',
        message: 'This window was already opened once. Close it and press Buka jendela baru again on the KPM page.',
      } } },
    });
    const { container } = renderWithSession(<ViewAsPage />, { me: SUPER_ADMIN, loading: false });
    expect(await screen.findByText(/already opened once/)).toBeInTheDocument();
    const close = vi.fn();
    vi.stubGlobal('close', close);
    screen.getByRole('button', { name: 'Close this window' }).click();
    expect(close).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Back to the KPM list' })).toHaveAttribute('href', '/admin/tenants');
    expect(isImpersonating()).toBe(false);
    // jsdom draws no colour, so contrast is the tokens' (`theme.spec.ts`), as every screen's axe run here says.
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations ?? []).toHaveLength(0);
  });

  it('P19.23-T2 AC-7 reads in Indonesian', async () => {
    window.history.replaceState(null, '', '/view-as');
    stubFetch({});
    renderWithSession(<InLanguage language="id"><ViewAsPage /></InLanguage>, { me: SUPER_ADMIN, loading: false });
    expect(await screen.findByRole('heading', { name: 'Lihat sebagai' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Jendela ini terbuka tanpa kode sekali pakainya.');
    expect(screen.getByRole('button', { name: 'Tutup jendela ini' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kembali ke daftar KPM' })).toBeInTheDocument();
    expect(englishShown(document.body, englishOnly(viewAsMessages))).toEqual([]);
  });
});
