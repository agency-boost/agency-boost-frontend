import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { makeMe, renderWithSession, routeParams, stubFetch } from '@test/harness';
import OwnerInvitePage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/owner-invite/tok-1',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * **The KPM Owner's claim link** (`/owner-invite/[token]`; P19.23-T2 AC-3; OD-420): the banner read before anybody signs
 * in; signed out, *Sign in* coming back here and *Sign up* with the note to open the link again; signed in, *Accept &
 * become owner*, which opens KPM Overview; every refusal the server's own sentence. English is this spec's; the
 * Indonesian is `owner-invite-in-indonesian.spec.tsx`'s.
 */
const BANNER = {
  kpmName: 'Serpong Branch', kpmCode: '0418', companyName: 'Prudential', ownerName: 'BUDI HARTONO',
  expiresAt: '2026-11-27T03:00:00.000Z',
};
const NEWCOMER = makeMe({
  user: { ...makeMe().user, fullName: 'Budi Hartono', preferredName: null }, membership: null,
  permissions: ['join_via_code_link_qr'],
});
const SHELL = { '/notifications': { body: { items: [], unread: 0 } } };
const page = () => <OwnerInvitePage params={routeParams({ token: 'tok-1' })} />;

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe('P19.23-T2 AC-3 the Owner’s claim link', () => {
  it('P19.23-T2 AC-3 shows a skeleton while the link is checked, never an empty card', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
    renderWithSession(page(), { me: null });
    expect(screen.getByRole('status')).toHaveTextContent('Checking this invitation…');
  });

  it('P19.23-T2 AC-3 signed out: the KPM and company, who it is for, until when — then sign in, coming back', async () => {
    const { calls } = stubFetch({ '/owner-invites/tok-1': { body: BANNER } });
    renderWithSession(page(), { me: null });
    expect(await screen.findByText('KPM Serpong Branch · Prudential')).toBeInTheDocument();
    expect(screen.getByText('For BUDI HARTONO')).toBeInTheDocument();
    expect(screen.getByText(/^This link works until 27 Nov 2026\.$/)).toBeInTheDocument();
    expect(screen.getByText('Sign in first — you will come back to this invitation.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=%2Fowner-invite%2Ftok-1');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    expect(screen.getByText('Once you have signed up and verified your email, open this link again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept & become owner' })).not.toBeInTheDocument();
    // Public: the banner is read with no token.
    expect(calls[0].url).toContain('/owner-invites/tok-1');
  });

  it('P19.23-T2 AC-3 signed in: accepting makes them the Owner, reads the session again and opens KPM Overview', async () => {
    const { calls } = stubFetch({
      ...SHELL,
      'GET /owner-invites/tok-1': { body: BANNER },
      'POST /owner-invites/tok-1/accept': { body: { kpmId: 'kpm-0418', kpmName: 'Serpong Branch' } },
    });
    const { session } = renderWithSession(page(), { me: NEWCOMER });
    expect(await screen.findByText('Signed in as Budi Hartono.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Accept & become owner' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/kpm/overview'));
    expect(session.reload).toHaveBeenCalled();
    expect(calls.some((c) => c.url.includes('/owner-invites/tok-1/accept') && c.init.method === 'POST')).toBe(true);
  });

  it('P19.23-T2 AC-3 a refusal is the server’s sentence, and the button can be pressed again', async () => {
    stubFetch({
      ...SHELL,
      'GET /owner-invites/tok-1': { body: BANNER },
      'POST /owner-invites/tok-1/accept': {
        status: 409,
        body: { error: { code: 'AUTH_EMAIL_NOT_VERIFIED', message: 'Verify your email address first.', requestId: 'r-1' } },
      },
    });
    renderWithSession(page(), { me: NEWCOMER });
    await userEvent.click(await screen.findByRole('button', { name: 'Accept & become owner' }));
    expect(await screen.findByText('Verify your email address first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept & become owner' })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('P19.23-T2 AC-3 a link that opens nothing says why, and offers nothing to press', async () => {
    stubFetch({
      '/owner-invites/tok-1': {
        status: 404,
        body: { error: { code: 'NOT_FOUND', message: 'This owner invitation has expired. Ask AgencyBoost to send it again.', requestId: 'r-2' } },
      },
    });
    renderWithSession(page(), { me: null });
    expect(await screen.findByText('This owner invitation has expired. Ask AgencyBoost to send it again.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('P19.23-T2 AC-3 is accessible, banner and sign-in shown (axe)', async () => {
    stubFetch({ '/owner-invites/tok-1': { body: BANNER } });
    const { container } = renderWithSession(page(), { me: null });
    await screen.findByText('For BUDI HARTONO');
    // Contrast is measured in a browser, not in jsdom, which cannot draw a canvas (as every axe spec here).
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toEqual([]);
  });
});
