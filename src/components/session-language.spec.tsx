import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { languageCookie, resetLanguage, stubFetch } from '@test/harness';
import { LanguageProvider, useLanguage } from '@/i18n/language-provider';
import { setAccessToken, setImpersonating } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { SessionProvider } from './session-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/activity/log',
}));

/** Every frame the probe rendered, so a spec can say none of them was a signed-in screen in the wrong language. */
const frames: string[] = [];

/** Who is signed in, and the language the screen is in — in one render, so a frame of the wrong one would show. */
function Probe() {
  const { me, loading, signIn } = useSession();
  const language = useLanguage();
  const said = loading ? 'loading' : `${me?.user.email ?? 'anonymous'} · ${language}`;
  frames.push(said);
  return (
    <div>
      <p data-testid="state">{said}</p>
      <button type="button" onClick={() => void signIn('rina@kpm0417.test', 'pw')}>sign in</button>
    </div>
  );
}

/** `GET /auth/me` for an account whose language is `locale`, chosen or not. */
const me = (locale: 'id' | 'en', localeChosen: boolean, over: Record<string, unknown> = {}) => ({
  user: { id: 'u-1', email: 'rina@kpm0417.test', fullName: 'Rina', initials: 'R', platformRole: 'none', locale, localeChosen },
  membership: null, isImpersonating: false, impersonatedBy: null, permissions: [], ...over,
});

/** A browser that chose `language` on an earlier visit: the cookie, and `<html lang>` as the pre-paint script leaves it. */
function browserChose(language: 'id' | 'en') {
  document.cookie = `ab_lang=${language}; Path=/`;
  document.documentElement.lang = language;
}

function open() {
  render(<LanguageProvider live><SessionProvider><Probe /></SessionProvider></LanguageProvider>);
}
const state = () => screen.getByTestId('state');

/**
 * **P18.98-T2 AC-5: the cookie against the account** (ADR-0179 §2). The session reads who is signed in and hands the
 * language provider the account's language in the same render: a saved one wins and rewrites the cookie; an account
 * with none keeps the browser's and writes nothing — not the cookie, and not the account.
 */
describe('P18.98-T2 AC-5 the cookie against the account', () => {
  beforeEach(() => {
    setAccessToken(null);
    setImpersonating(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetLanguage();
    frames.length = 0;
  });

  it('AC-5 at sign-in by a refresh, lets the account’s saved language win, in the session’s first frame, and rewrites the cookie', async () => {
    browserChose('en');
    const { calls } = stubFetch({ '/auth/refresh': { body: { accessToken: 't' } }, '/auth/me': { body: me('id', true) } });
    open();

    await waitFor(() => expect(state()).toHaveTextContent('rina@kpm0417.test'));
    // Never `… · en` with somebody signed in: the account's language came with the account, in the same render.
    expect(state()).toHaveTextContent('rina@kpm0417.test · id');
    expect(frames.filter((f) => f.startsWith('rina'))).not.toContain('rina@kpm0417.test · en');
    expect(languageCookie()).toBe('id');
    expect(document.documentElement.lang).toBe('id');
    // The session's read was asked in the browser's language; the next request goes in the account's.
    const read = calls.find((c) => c.url.endsWith('/auth/me'))!;
    expect((read.init.headers as Record<string, string>)['Accept-Language']).toBe('en');
  });

  it('AC-5 gives an account with no saved language the cookie’s, and writes nothing: not the cookie, not the account', async () => {
    browserChose('en');
    const { calls } = stubFetch({ '/auth/refresh': { body: { accessToken: 't' } }, '/auth/me': { body: me('id', false) } });
    const write = vi.spyOn(document, 'cookie', 'set');
    open();

    await waitFor(() => expect(state()).toHaveTextContent('rina@kpm0417.test · en'));
    expect(write).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(0);
    write.mockRestore();
  });

  it('AC-5 at sign-in on the form, follows the account that signed in', async () => {
    browserChose('id');
    stubFetch({
      '/auth/refresh': { status: 401, body: {} },
      '/auth/login': { body: { accessToken: 'tok' } },
      '/auth/me': { body: me('en', true) },
    });
    open();
    await waitFor(() => expect(state()).toHaveTextContent('anonymous · id'));

    await userEvent.click(screen.getByRole('button', { name: 'sign in' }));

    await waitFor(() => expect(state()).toHaveTextContent('rina@kpm0417.test · en'));
    expect(languageCookie()).toBe('en');
  });

  it('AC-2 never takes up a person’s language in a support session: the support person’s browser keeps its own', async () => {
    browserChose('en');
    stubFetch({
      '/auth/refresh': { body: { accessToken: 't' } },
      '/auth/me': { body: me('id', true, { isImpersonating: true, impersonatedBy: 'sa-1' }) },
    });
    open();

    await waitFor(() => expect(state()).toHaveTextContent('rina@kpm0417.test · en'));
    expect(languageCookie()).toBe('en');
  });
});
