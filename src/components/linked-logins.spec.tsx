import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import { getAccessToken, setAccessToken } from '@/lib/api-client';
import { joinInFlight } from '@/lib/in-flight';
import { useSession, type LinkedLogin, type Me } from '@/lib/session';
import { VIEW_KEY, resetViewsForTest } from '@/lib/views';
import { Page } from './page';
import { SessionProvider } from './session-provider';
import { Shell } from './shell';

/**
 * **P19.2-T1 AC-8 — linked logins in the avatar menu** (UI-169 item 5;
 * [ADR-0199](../../../docs/04-adr/0199-a-second-login-is-linked-through-its-own-mailbox-and-password.md) §3, §4, §5;
 * ADR-0198 §3): the linked login's views in the switcher's one order, a switch that changes the session and lands, the
 * password asked once on a browser with no session of the other login, *Tambah akun* for whoever is offered it, and
 * *Keluar* ending both sessions.
 */
const nav = vi.hoisted(() => ({ path: '/home', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(),
}));

const SA_LOGIN: LinkedLogin = {
  linkId: 'link-1', userId: 'u-sa', email: 'wilson@agencyboost.test', fullName: 'Wilson Tanoto',
  views: [{ kind: 'super_admin', officeName: null }],
};
const OWNER_LOGIN: LinkedLogin = {
  linkId: 'link-1', userId: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto',
  views: [{ kind: 'self', officeName: null }, { kind: 'kpm_owner', officeName: 'BSD City Branch' }],
};

function owner(me: Partial<Me> = {}): Me {
  return makeMe({
    user: { ...makeMe().user, id: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', initials: 'WT' },
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 3, office: { code: '0417', branch: 'BSD City Branch' },
    },
    permissions: ['member:read_profile', 'kpm_overview:read', 'account_link:create', 'account_link:manage_self'],
    ...me,
  });
}

function superAdmin(me: Partial<Me> = {}): Me {
  return makeMe({
    user: {
      id: 'u-sa', email: 'wilson@agencyboost.test', fullName: 'Wilson Tanoto', preferredName: null, pronoun: 'he',
      initials: 'WT', platformRole: 'super_admin',
    },
    membership: null,
    permissions: ['kpm:list_all', 'account_link:create', 'account_link:manage_self'],
    ...me,
  });
}

function agent(me: Partial<Me> = {}): Me {
  return makeMe({ permissions: ['account_link:manage_self'], ...me });
}

const page = (title = 'Home') => <Shell><Page title={title}><p>content</p></Page></Shell>;
const titleAvatar = () => document.querySelector<HTMLElement>('[data-title-avatar]')!;
async function openViews() {
  await userEvent.click(titleAvatar());
  return within(document.querySelector<HTMLElement>('[data-view-menu]')!);
}
const entryWords = (menu: ReturnType<typeof within>) =>
  within(menu.getByRole('list')).getAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  resetViewsForTest();
  setAccessToken('tok-owner');
});

afterEach(() => {
  vi.unstubAllGlobals();
  nav.path = '/home';
  nav.push.mockClear();
  resetLanguage();
});

describe('P19.2-T1 AC-8 the linked login in the switcher (ADR-0199 §3)', () => {
  it('P19.2-T1 AC-8 the owner’s case: Akun saya ✓ · KPM Owner · <nama KPM> · Superadmin, and no Tambah akun', async () => {
    renderInIndonesian(page(), { me: owner({ linkedLogin: SA_LOGIN }) });
    const menu = await openViews();
    expect(entryWords(menu)).toEqual(['Akun saya', 'KPM Owner · BSD City Branch', 'Superadmin']);
    const [self, , linked] = within(menu.getByRole('list')).getAllByRole('button');
    expect(self).toHaveAttribute('aria-current', 'true');
    expect(linked).not.toHaveAttribute('aria-current');
    expect(linked).toHaveClass('min-h-11');
    // A login with a link is offered no second one (ADR-0199 §1).
    expect(document.querySelector('[data-view-action="add-account"]')).toBeNull();
    // The header names the active view: three views now.
    expect(titleAvatar()).toHaveAccessibleName('Akun Anda: Akun saya');
  });

  it('P19.2-T1 AC-8 the same order whichever login is active: as the Super Admin login, Superadmin ✓ last', async () => {
    nav.path = '/admin';
    renderWithSession(page('Overview'), { me: superAdmin({ linkedLogin: OWNER_LOGIN }) });
    const menu = await openViews();
    expect(entryWords(menu)).toEqual(['My account', 'KPM Owner · BSD City Branch', 'Superadmin']);
    expect(within(menu.getByRole('list')).getAllByRole('button')[2]).toHaveAttribute('aria-current', 'true');
  });

  it('P19.2-T1 AC-8 two field logins: each entry of the same name adds its login’s address', async () => {
    const otherOffice: LinkedLogin = {
      linkId: 'link-2', userId: 'u-admin', email: 'admin@kpm0555.test', fullName: 'Wilson T.',
      views: [{ kind: 'self', officeName: null }, { kind: 'kpm_admin', officeName: 'Kelapa Gading Branch' }],
    };
    renderWithSession(page(), { me: owner({ linkedLogin: otherOffice }) });
    const menu = await openViews();
    expect(entryWords(menu)).toEqual([
      'My account · owner@kpm0417.test',
      'My account · admin@kpm0555.test',
      'KPM Owner · BSD City Branch',
      'KPM Admin · Kelapa Gading Branch',
    ]);
  });

  it('P19.2-T1 AC-8 a support session offers the member’s own views alone, and never Tambah akun', async () => {
    renderWithSession(page(), {
      me: owner({ linkedLogin: SA_LOGIN, isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true }),
    });
    const menu = await openViews();
    expect(entryWords(menu)).toEqual(['My account', 'KPM Owner · BSD City Branch']);
    expect(document.querySelector('[data-view-action="add-account"]')).toBeNull();
  });
});

describe('P19.2-T1 AC-8 choosing the linked login switches the session (ADR-0199 §4)', () => {
  it('P19.2-T1 AC-8 POST /auth/links/switch, then me read again, the cached reads cleared, the view remembered, its landing', async () => {
    const order: string[] = [];
    const { calls } = stubFetch({
      '/auth/links/switch': () => { order.push('switch'); return { body: { accessToken: 'tok-sa', expiresIn: 900 } }; },
    });
    const reload = vi.fn(async () => { order.push('reload'); });
    nav.push.mockImplementation(() => { order.push('push'); });
    renderWithSession(page(), { me: owner({ linkedLogin: SA_LOGIN }), reload });

    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Superadmin' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/admin'));
    expect(order).toEqual(['switch', 'reload', 'push']);
    const sent = calls.find((c) => c.url.includes('/auth/links/switch'))!;
    expect(sent.init.method).toBe('POST');
    expect(JSON.parse(sent.init.body as string)).toEqual({ userId: 'u-sa' });
    // The cookies go with the request; the answer's access token replaces this one in memory, and nowhere else.
    expect(sent.init.credentials).toBe('include');
    expect(getAccessToken()).toBe('tok-sa');
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBe('super_admin');
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).not.toContain('tok-sa');
  });

  it('P19.2-T1 AC-8 no session of the other login here: its password once, a wrong one said, the right one switches', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'never' } },
      '/auth/links/switch': [
        { status: 409, body: { error: { code: 'AUTH_LINK_SIGN_IN_REQUIRED', message: 'That login is not signed in on this browser.', requestId: 'r1' } } },
        { status: 401, body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'That is not the password of that login.', requestId: 'r2' } } },
        { body: { accessToken: 'tok-sa', expiresIn: 900 } },
      ],
    });
    const reload = vi.fn(async () => undefined);
    renderWithSession(page(), { me: owner({ linkedLogin: SA_LOGIN }), reload });

    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Superadmin' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Switch account' }));
    expect(sheet.getByText(/wilson@agencyboost\.test is not signed in on this browser yet/)).toBeInTheDocument();

    await userEvent.type(sheet.getByLabelText('Password'), 'wrong one');
    await userEvent.click(sheet.getByRole('button', { name: 'Switch' }));
    expect(await sheet.findByRole('alert')).toHaveTextContent('That is not the password of that login.');
    // A wrong password is the route's answer: never refreshed and sent again, which would count it twice.
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);
    expect(reload).not.toHaveBeenCalled();

    await userEvent.clear(sheet.getByLabelText('Password'));
    await userEvent.type(sheet.getByLabelText('Password'), 'the right one');
    await userEvent.click(sheet.getByRole('button', { name: 'Switch' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/admin'));
    const bodies = calls.filter((c) => c.url.includes('/auth/links/switch')).map((c) => JSON.parse(c.init.body as string));
    expect(bodies).toEqual([
      { userId: 'u-sa' },
      { userId: 'u-sa', password: 'wrong one' },
      { userId: 'u-sa', password: 'the right one' },
    ]);
    expect(reload).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Switch account' })).not.toBeInTheDocument());
  });

  it('P19.2-T1 AC-8 any other refusal is said, and the reader stays where they are', async () => {
    stubFetch({
      '/auth/links/switch': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Linked login not found.', requestId: 'r' } } },
    });
    renderWithSession(page(), { me: owner({ linkedLogin: SA_LOGIN }) });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Superadmin' }));
    expect(await screen.findByText('Linked login not found.')).toBeInTheDocument();
    expect(nav.push).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('tok-owner');
  });
});

describe('P19.2-T1 AC-8 Tambah akun (ADR-0199 §1, §2)', () => {
  it.each([
    ['an Owner', owner()],
    ['an Admin', owner({
      membership: { ...owner().membership!, isKpmOwner: false, isKpmAdmin: true },
    })],
  ])('P19.2-T1 AC-8 is offered to %s with no link, after the views', async (_who, me) => {
    renderInIndonesian(page(), { me });
    const menu = await openViews();
    const add = menu.getByRole('button', { name: 'Tambah akun' });
    expect(add).toHaveAttribute('data-view-action', 'add-account');
    expect(add).toHaveClass('min-h-11');
    // After the views and after nothing else of theirs.
    expect(within(menu.getByRole('list')).getAllByRole('button')).toHaveLength(2);
  });

  it('P19.2-T1 AC-8 a Super Admin with no link: the menu holds Tambah akun alone, and the header names no view', async () => {
    nav.path = '/admin';
    renderWithSession(page('Overview'), { me: superAdmin() });
    expect(titleAvatar().tagName).toBe('BUTTON');
    expect(titleAvatar()).toHaveAccessibleName('Account');
    expect(document.querySelector('[data-active-view]')).toBeNull();
    const menu = await openViews();
    expect(menu.queryByRole('list')).toBeNull();
    expect(menu.getByRole('button', { name: 'Add account' })).toBeInTheDocument();
  });

  it.each([
    ['an Agent', agent()],
    ['an AB', agent({ membership: { ...makeMe().membership!, hierarchyRole: 'ab', orgLevelCode: 'AB', directCount: 4 } })],
  ])('P19.2-T1 AC-8 is not offered to %s, who keeps one view and no switcher', (_who, me) => {
    renderWithSession(page(), { me });
    expect(titleAvatar().tagName).toBe('A');
    expect(document.querySelector('[data-view-action]')).toBeNull();
  });

  it('P19.2-T1 AC-8 the sheet: the other login’s email and your password, then check the other mailbox — which says if, never whether', async () => {
    const { calls } = stubFetch({ '/auth/links': { status: 202, body: { status: 'accepted' } } });
    renderWithSession(page(), { me: owner() });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Add account' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Add account' }));
    const send = sheet.getByRole('button', { name: 'Send link' });
    expect(send).toBeDisabled();

    await userEvent.type(sheet.getByLabelText('Email of the other login'), ' wilson@agencyboost.test ');
    await userEvent.type(sheet.getByLabelText('Your password'), 'my password');
    await userEvent.click(send);

    const sent = within(await screen.findByRole('dialog', { name: 'Check the other mailbox' }));
    expect(sent.getByRole('status')).toHaveTextContent(
      /^If wilson@agencyboost\.test is a KPM Owner, KPM Admin or Super Admin login that is not linked yet, a link is on its way to it\./,
    );
    const start = calls.find((c) => c.url.endsWith('/auth/links'))!;
    expect(start.init.method).toBe('POST');
    expect(JSON.parse(start.init.body as string)).toEqual({ email: 'wilson@agencyboost.test', currentPassword: 'my password' });
    await userEvent.click(sent.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('P19.2-T1 AC-8 a refusal is the server’s sentence in the sheet, which stays — a wrong password is not refreshed', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'never' } },
      '/auth/links': { status: 401, body: { error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'Your current password is not correct.', requestId: 'r' } } },
    });
    renderWithSession(page(), { me: owner() });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Add account' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Add account' }));
    await userEvent.type(sheet.getByLabelText('Email of the other login'), 'wilson@agencyboost.test');
    await userEvent.type(sheet.getByLabelText('Your password'), 'wrong');
    await userEvent.click(sheet.getByRole('button', { name: 'Send link' }));

    expect(await sheet.findByRole('alert')).toHaveTextContent('Your current password is not correct.');
    expect(sheet.getByLabelText('Email of the other login')).toHaveValue('wilson@agencyboost.test');
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);
  });

  it('P19.2-T1 AC-8 axe: the menu with the linked login, and the Tambah akun sheet', async () => {
    /** Colour contrast needs a canvas jsdom does not have; `contrast.spec.ts` pins the tokens instead. */
    const RULES = { rules: { 'color-contrast': { enabled: false } } };
    atWidth(375);
    stubFetch({});
    const { container, unmount } = renderWithSession(page(), { me: owner({ linkedLogin: SA_LOGIN }) });
    await openViews();
    expect((await axe(container, RULES)).violations).toEqual([]);
    unmount();

    renderWithSession(page(), { me: owner() });
    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Add account' }));
    await screen.findByRole('dialog', { name: 'Add account' });
    expect((await axe(document.body, RULES)).violations).toEqual([]);
  });
});

describe('P19.2-T1 AC-8 Keluar ends both sessions (ADR-0199 §4)', () => {
  function Probe() {
    const { me, signOut } = useSession();
    return (
      <div>
        <p data-testid="who">{me?.user.email ?? 'nobody'}</p>
        <button type="button" onClick={() => void signOut()}>out</button>
      </div>
    );
  }

  it('P19.2-T1 AC-8 one POST /auth/logout with the browser’s cookies ends both; the access token goes from memory', async () => {
    setAccessToken(null);
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'tok-owner' } },
      '/auth/me': { body: owner({ linkedLogin: SA_LOGIN }) },
      '/auth/logout': { status: 204, body: undefined },
    });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('owner@kpm0417.test'));

    await userEvent.click(screen.getByRole('button', { name: 'out' }));

    await waitFor(() => expect(screen.getByTestId('who')).toHaveTextContent('nobody'));
    const out = calls.filter((c) => c.url.includes('/auth/logout'));
    // The server reads both cookies and clears both (`agencyboost_refresh`, `agencyboost_refresh_linked`): one call.
    expect(out).toHaveLength(1);
    expect(out[0].init.credentials).toBe('include');
    expect(calls.some((c) => c.url.includes('/auth/links'))).toBe(false);
    expect(getAccessToken()).toBeNull();
  });

  /*
   * **P19.11-T6 AC-1 (UX-8, UXQ5)**: the account dropdown's *Keluar*, end to end with the real session provider. Both
   * logins on this browser end (the server reads and clears both cookies, ADR-0199 §4; `account-links.int.spec.ts`), the
   * token leaves memory, `me` and the tab's view go, **the cached reads are let go** — a read still out is never handed
   * to whoever signs in next — and `/login` replaces the page, plain, with no `next`.
   */
  it('P19.11-T6 AC-1 Keluar in the dropdown ends both logins and clears the token, me, the view and the cached reads; /login replaces the page', async () => {
    setAccessToken(null);
    nav.replace.mockClear();
    nav.push.mockClear();
    window.sessionStorage.setItem(VIEW_KEY, 'self');
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'tok-owner' } },
      '/auth/me': { body: owner({ linkedLogin: SA_LOGIN }) },
      '/auth/logout': { status: 204, body: undefined },
      // Whatever else the shell reads on its way in: nothing this test is about.
      '/': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'No.', requestId: 'r' } } },
    });
    renderInIndonesian(<SessionProvider>{page()}</SessionProvider>);
    await waitFor(() => expect(titleAvatar()).not.toBeNull());
    expect(getAccessToken()).toBe('tok-owner');
    // A read the session started, still out when the reader leaves.
    const held = vi.fn(() => new Promise<string>(() => undefined));
    void joinInFlight('/probe', held);

    const menu = await openViews();
    await userEvent.click(menu.getByRole('button', { name: 'Keluar' }));

    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/login'));
    for (const [to] of nav.replace.mock.calls) expect(to).toBe('/login');
    expect(nav.push).not.toHaveBeenCalled();
    const out = calls.filter((c) => c.url.includes('/auth/logout'));
    expect(out).toHaveLength(1);
    expect(out[0].init.method).toBe('POST');
    expect(out[0].init.credentials).toBe('include');
    expect(getAccessToken()).toBeNull();
    // The shell went with the session; the tab's view with it.
    expect(document.querySelector('[data-title-avatar]')).toBeNull();
    expect(window.sessionStorage.getItem(VIEW_KEY)).toBeNull();
    // The cached reads: the next read of the same key goes out afresh rather than joining the old session's.
    const fresh = vi.fn(async () => 'fresh');
    const next = joinInFlight('/probe', fresh);
    expect(fresh).toHaveBeenCalledTimes(1);
    await expect(next).resolves.toBe('fresh');
    expect(held).toHaveBeenCalledTimes(1);
  });
});
