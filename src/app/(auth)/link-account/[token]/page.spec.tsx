import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { englishOnly, englishShown } from '@test/english-left';
import { makeMe, renderInIndonesian, renderWithSession, resetLanguage, routeParams, stubFetch } from '@test/harness';
import { accountLinkMessages } from '@/i18n/messages/account-links';
import LinkAccountPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/link-account/tok',
}));

const ENGLISH = englishOnly(accountLinkMessages);
/** Colour contrast needs a canvas jsdom does not have; `contrast.spec.ts` pins the tokens instead. */
const RULES = { rules: { 'color-contrast': { enabled: false } } };

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

/**
 * **P19.2-T1 AC-8 — the link's page** (UI-169 item 5; ADR-0199 §2; ADR-0190 §1): `/link-account/[token]` sends nothing
 * when it loads — a mail scanner spends nothing — asks the password of the login the email went to, once, and sends the
 * token with it only when *Tautkan akun* is pressed.
 */
describe('P19.2-T1 AC-8 /link-account/[token]', () => {
  it('P19.2-T1 AC-8 sends nothing on load; the press sends the token and the password once, and says the logins are linked', async () => {
    const { calls } = stubFetch({ '/auth/links/confirm': { body: { status: 'linked' } } });
    renderWithSession(<LinkAccountPage params={routeParams({ token: 'tok-abc' })} />, { me: null });

    expect(screen.getByRole('heading', { level: 1, name: 'Link your logins' })).toBeInTheDocument();
    expect(calls).toHaveLength(0);
    const submit = screen.getByRole('button', { name: 'Link the logins' });
    expect(submit).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Password of this login'), 'other password');
    await userEvent.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent('Your two logins are linked.');
    const sent = calls.filter((c) => c.url.includes('/auth/links/confirm'));
    expect(sent).toHaveLength(1);
    expect(sent[0].init.method).toBe('POST');
    expect(JSON.parse(sent[0].init.body as string)).toEqual({ token: 'tok-abc', password: 'other password' });
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  it('P19.2-T1 AC-8 signed in here as the login that asked: the session is read again, and AgencyBoost opens', async () => {
    stubFetch({ '/auth/links/confirm': { body: { status: 'linked' } } });
    const reload = vi.fn(async () => undefined);
    renderWithSession(<LinkAccountPage params={routeParams({ token: 't' })} />, { me: makeMe(), reload });
    await userEvent.type(screen.getByLabelText('Password of this login'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Link the logins' }));

    expect(await screen.findByRole('link', { name: 'Open AgencyBoost' })).toHaveAttribute('href', '/');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('P19.2-T1 AC-8 a wrong password is said, the form stays, and the right one then links — never refreshed', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'never' } },
      '/auth/links/confirm': [
        { status: 401, body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'That is not the password of that login.', requestId: 'r' } } },
        { body: { status: 'linked' } },
      ],
    });
    renderWithSession(<LinkAccountPage params={routeParams({ token: 't' })} />, { me: null });
    await userEvent.type(screen.getByLabelText('Password of this login'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Link the logins' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That is not the password of that login.');
    expect(screen.getByLabelText('Password of this login')).toHaveValue('wrong');
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);

    await userEvent.clear(screen.getByLabelText('Password of this login'));
    await userEvent.type(screen.getByLabelText('Password of this login'), 'right');
    await userEvent.click(screen.getByRole('button', { name: 'Link the logins' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Your two logins are linked.');
  });

  it.each([
    ['used, replaced or expired', 400, 'AUTH_TOKEN_INVALID', 'That link is no longer valid. Request a new one.'],
    ['a login linked since', 409, 'AUTH_LINK_EXISTS', 'One of these two logins was linked to another since this link was sent, so nothing was linked.'],
    ['a login no longer an Owner’s, an Admin’s or a Super Admin’s', 403, 'PERM_DENIED', 'Only the logins of a KPM Owner, a KPM Admin or a Super Admin can be linked.'],
  ])('P19.2-T1 AC-8 a link %s: the server’s sentence, and how to ask again', async (_case, status, code, message) => {
    stubFetch({ '/auth/links/confirm': { status, body: { error: { code, message, requestId: 'r' } } } });
    renderWithSession(<LinkAccountPage params={routeParams({ token: 't' })} />, { me: null });
    await userEvent.type(screen.getByLabelText('Password of this login'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Link the logins' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText('A link works once and for 24 hours. Ask again from Add account in the avatar menu.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Password of this login')).not.toBeInTheDocument();
  });

  it('P19.2-T1 AC-8 in Indonesian: Tautkan akun Anda, the password of this login, Tautkan akun, and the linked line', async () => {
    stubFetch({ '/auth/links/confirm': { body: { status: 'linked' } } });
    renderInIndonesian(<LinkAccountPage params={routeParams({ token: 't' })} />, { me: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Tautkan akun Anda' })).toBeInTheDocument();
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
    await userEvent.type(screen.getByLabelText('Kata sandi akun ini'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Tautkan akun' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Kedua akun Anda sudah tertaut.');
    expect(screen.getByRole('link', { name: 'Buka halaman masuk' })).toHaveAttribute('href', '/login');
    expect(englishShown(document.body, ENGLISH)).toEqual([]);
  });

  it('P19.2-T1 AC-8 axe: the form, and the refusal', async () => {
    stubFetch({
      '/auth/links/confirm': { status: 400, body: { error: { code: 'AUTH_TOKEN_INVALID', message: 'That link is no longer valid.', requestId: 'r' } } },
    });
    const { container } = renderWithSession(<LinkAccountPage params={routeParams({ token: 't' })} />, { me: null });
    expect((await axe(container, RULES)).violations).toEqual([]);
    await userEvent.type(screen.getByLabelText('Password of this login'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Link the logins' }));
    await screen.findByRole('alert');
    expect((await axe(container, RULES)).violations).toEqual([]);
  });
});
