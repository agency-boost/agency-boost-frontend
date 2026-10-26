import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { makeMe, renderWithSession, stubFetch } from '@test/harness';
import { ApiConfigError } from '@/lib/api';
import { ApiRequestError } from '@/lib/api-client';
import type { Me } from '@/lib/session';
import LoginPage from './page';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

/** A member of the office, as `signIn` resolves to them: active, with the rung and the reports given. */
const member = (membership: Partial<NonNullable<Me['membership']>>, permissions: string[]) => makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AGENT', hierarchyRole: 'agent', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 0, ...membership,
  },
  permissions,
});

const FIELD = ['member:read_profile', 'tenant_config:read', 'profile:read_self', 'leader_meeting:read_shared_link'];
const OWNER = member(
  { orgLevelCode: 'AB', hierarchyRole: 'ab', isKpmOwner: true, directCount: 3 },
  [...FIELD, 'kpm_overview:read', 'kpm_analytics:read'],
);
const AGENT = member({}, FIELD);
const LEADER = member({ orgLevelCode: 'AB', hierarchyRole: 'ab', directCount: 4 }, [...FIELD, 'unit_dashboard:read']);

/** Signs in from `/login<search>` as `who`, and gives back where the page sent them. */
async function signInFrom(search: string, who: Me | null): Promise<unknown> {
  window.history.pushState({}, '', `/login${search}`);
  try {
    renderWithSession(<LoginPage />, { me: null, signIn: vi.fn(async () => who) });
    await userEvent.type(screen.getByLabelText('Email'), 'someone@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'a password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(push).toHaveBeenCalledTimes(1);
    return push.mock.calls[0][0];
  } finally {
    window.history.pushState({}, '', '/');
  }
}

describe('login', () => {
  it('labels both fields and marks them for the password manager', () => {
    renderWithSession(<LoginPage />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('signs in and lands the user on their own landing when no page sent them here', async () => {
    // The session's `me` is an Agent who leads nobody, and `signIn` resolves to them.
    const { session } = renderWithSession(<LoginPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'demo password rina');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(session.signIn).toHaveBeenCalledWith('rina@kpm0417.test', 'demo password rina');
    expect(push).toHaveBeenCalledWith('/activity/log');
  });

  it('P18.1-T3 AC-2 returns to the page that sent the reader to sign in, such as a shared meeting', async () => {
    expect(await signInFrom('?next=%2Fleader-meetings%2Fshared%2Fabc', AGENT)).toBe('/leader-meetings/shared/abc');
  });

  /*
   * **The product owner's report, 2026-10-11**: the Owner signed out of *Compliance, Events, and Campaigns*,
   * an Agent signed in on the same device, and was sent to the Owner's page — `next` was honoured for whoever
   * signed in. It is honoured now only for somebody who can open it; anybody else lands on their own page.
   */
  describe('only for the person who can open the page (2026-10-11)', () => {
    const COMPLIANCE = '?next=%2Fkpm%2Fanalytics%2Fcompliance%3Fcategory%3Dtraining';

    it('the Owner, who can open it, goes back to it, query kept', async () => {
      expect(await signInFrom(COMPLIANCE, OWNER)).toBe('/kpm/analytics/compliance?category=training');
    });

    it('the reported case: an Agent who signs in after them lands on their own day, not on the Owner’s page', async () => {
      expect(await signInFrom(COMPLIANCE, AGENT)).toBe('/activity/log');
    });

    it('a leader who signs in after them lands on their unit’s dashboard', async () => {
      expect(await signInFrom(COMPLIANCE, LEADER)).toBe('/unit/dashboard');
    });

    it('an address that is no page of the app lands on their own page rather than a 404', async () => {
      expect(await signInFrom('?next=%2Fkpm%2Fadvanced-analytics', OWNER)).toBe('/kpm/overview');
    });

    it('an unsafe next still lands on their own page: a host written as a path', async () => {
      expect(await signInFrom('?next=%2F%2Fevil.test%2Fx', AGENT)).toBe('/activity/log');
    });

    it('an unsafe next still lands on their own page: another origin, whatever path it ends in', async () => {
      expect(await signInFrom('?next=https%3A%2F%2Fevil.test%2Fkpm%2Foverview', OWNER)).toBe('/kpm/overview');
    });

    it('no next lands on their own page', async () => {
      expect(await signInFrom('', OWNER)).toBe('/kpm/overview');
    });
  });

  /*
   * ADR-0168 §1 (OD-208; the client's UI review, UI-006): **a session that ended says so.** A page that found the
   * reader's session gone sends them here with `reason=expired`; everybody else — a link opened signed out, a
   * deliberate sign-out — reads what the page always said.
   */
  describe('what the page says (ADR-0168 §1)', () => {
    const at = (search: string) => {
      window.history.pushState({}, '', `/login${search}`);
      onTestFinished(() => window.history.pushState({}, '', '/'));
      renderWithSession(<LoginPage />, { me: null });
    };

    it('reads "Your session ended. Sign in again." when the session ended', () => {
      at('?next=%2Fprofile&reason=expired');
      expect(screen.getByText('Your session ended. Sign in again.')).toBeInTheDocument();
      expect(screen.queryByText('Sign in to continue.')).not.toBeInTheDocument();
    });

    it.each([
      ['no reason', '?next=%2Fprofile'],
      ['no query at all', ''],
      ['another reason', '?next=%2Fprofile&reason=signed_out'],
      ['the word in another case', '?reason=EXPIRED'],
    ])('reads "Sign in to continue." for %s', (_what, search) => {
      at(search);
      expect(screen.getByText('Sign in to continue.')).toBeInTheDocument();
      expect(screen.queryByText('Your session ended. Sign in again.')).not.toBeInTheDocument();
    });

    it('still returns to next: the reason beside it changes nothing of where signing in lands', async () => {
      expect(await signInFrom('?next=%2Fleader-meetings%2Fshared%2Fabc&reason=expired', AGENT))
        .toBe('/leader-meetings/shared/abc');
    });

    it('still honours next only for somebody who can open it', async () => {
      expect(await signInFrom('?next=%2Fkpm%2Fanalytics%2Fcompliance&reason=expired', AGENT)).toBe('/activity/log');
    });
  });

  it('shows the server message and the request id, and marks both fields invalid', async () => {
    // Which of the two was wrong is deliberately not said — the API returns one error
    // for a bad address and a bad password alike, and the screen must not undo that.
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(401, {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
        requestId: 'req-9',
      });
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Email or password is incorrect.');
    expect(alert).toHaveTextContent('req-9');
    expect(alert.textContent).not.toMatch(/no account|not found|unknown user/i);
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(push).not.toHaveBeenCalled();
  });

  it('reports a network failure as a network failure, not as bad credentials', async () => {
    const signIn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.test');
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server.');
  });

  it('offers the reset path and the way to an account', () => {
    renderWithSession(<LoginPage />);
    expect(screen.getByRole('link', { name: /Forgot your password/ })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('names the missing variable instead of blaming the server', async () => {
    // The failure that prompted this: a renamed environment variable surfaced as
    // "Could not reach the server", which sends you to debug a healthy backend.
    const signIn = vi.fn(async () => {
      throw new ApiConfigError('NEXT_PUBLIC_API_ORIGIN is not set.', 'NEXT_PUBLIC_API_ORIGIN');
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.test');
    await userEvent.type(screen.getByLabelText('Password'), 'pw');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('NEXT_PUBLIC_API_ORIGIN');
    expect(alert.textContent).not.toMatch(/could not reach/i);
  });

  describe('the development accounts panel', () => {
    const ORIGINAL = process.env.NEXT_PUBLIC_APP_ENV;
    afterEach(() => {
      process.env.NEXT_PUBLIC_APP_ENV = ORIGINAL;
    });

    it('is absent unless the environment says development', () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'production';
      renderWithSession(<LoginPage />);
      expect(screen.queryByText('Development accounts')).not.toBeInTheDocument();
    });

    it('fills both fields and signs in, leaving the values on screen', async () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'development';
      const root = makeMe({
        user: { ...makeMe().user, platformRole: 'super_admin' }, membership: null, permissions: ['kpm:list_all'],
      });
      const { session } = renderWithSession(<LoginPage />, { signIn: vi.fn(async () => root) });

      await userEvent.click(screen.getByRole('button', { name: /Show all \d+ accounts/ }));
      await userEvent.click(screen.getByRole('button', { name: /Super Admin.*superadmin@/s }));

      expect(session.signIn).toHaveBeenCalledWith(
        'superadmin@agencyboost.test',
        'demo super admin',
      );
      // Visible afterwards, so a failed attempt can be read and edited rather than
      // repeated blindly.
      expect(screen.getByLabelText('Email')).toHaveValue('superadmin@agencyboost.test');
      expect(screen.getByLabelText('Password')).toHaveValue('demo super admin');
      expect(push).toHaveBeenCalledWith('/admin');
    });

    it('shows the ordinary error when a seeded account does not exist yet', async () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'development';
      const signIn = vi.fn(async () => {
        throw new ApiRequestError(401, {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
          requestId: 'req-2',
        });
      });
      renderWithSession(<LoginPage />, { signIn });

      await userEvent.click(screen.getByRole('button', { name: /Show all \d+ accounts/ }));
      await userEvent.click(screen.getByRole('button', { name: /KPM Owner.*owner@kpm0417/s }));

      expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
      expect(screen.getByLabelText('Email')).toHaveValue('owner@kpm0417.test');
    });
  });
  it('offers to send the verification email again, when that is the refusal (P4-T13)', async () => {
    /*
     * Login refuses an unverified account, and until `resend-verification` existed the
     * only advice was "check your inbox" — for an email that, before `P4-T14`, had never
     * been sent. Both halves are real now, so the screen offers the action.
     */
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(403, {
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Verify your email address before signing in. Check your inbox.',
        requestId: 'req-11',
      });
    });
    const { calls } = stubFetch({
      '/auth/resend-verification': { status: 202, body: { status: 'accepted' } },
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'a-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'Send the verification email again' }),
    );

    expect(calls.some((c) => c.url.includes('/auth/resend-verification'))).toBe(true);
    expect(await screen.findByText(/On its way, if that address has an account waiting/))
      .toBeInTheDocument();
  });

  it('offers it only for that refusal, not for a wrong password', async () => {
    const signIn = vi.fn(async () => {
      throw new ApiRequestError(401, {
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
        requestId: 'req-12',
      });
    });
    renderWithSession(<LoginPage />, { signIn });

    await userEvent.type(screen.getByLabelText('Email'), 'rina@kpm0417.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Send the verification email again' }))
      .toBeNull();
  });

});
