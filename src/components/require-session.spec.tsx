import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import { Page } from './page';
import { RequireSession } from './require-session';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/admin',
}));

describe('RequireSession', () => {
  it('shows a loading state rather than flashing the login redirect', () => {
    renderWithSession(<RequireSession>secret</RequireSession>, { me: null, loading: true });
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends an anonymous visitor to sign in, rendering nothing in the meantime', () => {
    renderWithSession(<RequireSession>secret</RequireSession>, { me: null, loading: false });
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('P18.1-T3 AC-2 carries the page the visitor was on, so signing in brings them back to it', () => {
    window.history.pushState({}, '', '/leader-meetings/shared/abc?x=1');
    try {
      renderWithSession(<RequireSession>secret</RequireSession>, { me: null, loading: false });
      expect(replace).toHaveBeenCalledWith('/login?next=%2Fleader-meetings%2Fshared%2Fabc%3Fx%3D1');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  /*
   * **The product owner's report, 2026-10-11**: signing out of an Owner page woke this guard, which sent the
   * reader to `/login?next=<that page>`, and the next person to sign in was taken there. A reader who signed
   * out themselves (`signedOut`) goes to plain sign-in; any other end of the session still carries the page.
   */
  describe('when the session ends (2026-10-11)', () => {
    const COMPLIANCE = '/kpm/analytics/compliance?category=training';
    const at = (path: string, run: () => void) => {
      window.history.pushState({}, '', path);
      replace.mockClear();
      try {
        run();
      } finally {
        window.history.pushState({}, '', '/');
      }
    };

    it('a reader who signed out themselves goes to plain sign-in, carrying no page', () => {
      at(COMPLIANCE, () => {
        renderWithSession(<RequireSession permission="kpm_analytics:read">secret</RequireSession>, {
          me: null, loading: false, signedOut: true,
        });
        expect(replace.mock.calls).toEqual([['/login']]);
      });
    });

    it('an involuntary end — an expired session, a link opened signed out — still carries the page', () => {
      at(COMPLIANCE, () => {
        renderWithSession(<RequireSession permission="kpm_analytics:read">secret</RequireSession>, {
          me: null, loading: false, signedOut: false,
        });
        expect(replace.mock.calls).toEqual([['/login?next=%2Fkpm%2Fanalytics%2Fcompliance%3Fcategory%3Dtraining']]);
      });
    });
  });

  /*
   * **A shell admits only its own family** (2026-10-11): an Agent who typed an office address was shown the
   * Owner's sidebar, because the tenant shell's gate is every member's. The shells pass `family`.
   */
  describe('family, which the shells pass (2026-10-11)', () => {
    const OWNER = makeMe({
      membership: {
        membershipId: 'mem-o', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
        isKpmOwner: true, isKpmAdmin: false, directCount: 3,
      },
      permissions: ['member:read_profile'],
    });

    it('renders for a reader of the family', () => {
      replace.mockClear();
      renderWithSession(<RequireSession family="tenant" permission="member:read_profile">secret</RequireSession>, { me: OWNER });
      expect(screen.getByText('secret')).toBeInTheDocument();
      expect(replace).not.toHaveBeenCalled();
    });

    it('sends anybody else to their own landing, rendering nothing of the screen and no refusal on the way', () => {
      replace.mockClear();
      // The default reader is an Agent who leads nobody, and holds the tenant shell's own gate.
      renderWithSession(<RequireSession family="tenant" permission="member:read_profile">secret</RequireSession>, {
        me: makeMe({ permissions: ['member:read_profile'] }),
      });
      expect(replace.mock.calls).toEqual([['/activity/log']]);
      expect(screen.queryByText('secret')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Taking you to your work…');
    });

    it('asks it before the permission: a reader of another family is not refused here, but sent on', () => {
      replace.mockClear();
      renderWithSession(<RequireSession family="admin" permission="kpm:list_all">secret</RequireSession>, { me: OWNER });
      expect(replace.mock.calls).toEqual([['/kpm/overview']]);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('leaves a password that must be replaced to its own redirect', () => {
      replace.mockClear();
      renderWithSession(<RequireSession family="admin">secret</RequireSession>, {
        me: makeMe({ mustChangePassword: true }),
      });
      expect(replace.mock.calls).toEqual([['/choose-a-password']]);
    });

    it('waits for the session before deciding anything', () => {
      replace.mockClear();
      renderWithSession(<RequireSession family="admin">secret</RequireSession>, { me: null, loading: true });
      expect(replace).not.toHaveBeenCalled();
    });
  });

  it('renders for a session that holds the permission', () => {
    renderWithSession(<RequireSession permission="kpm:list_all">secret</RequireSession>, {
      me: makeMe({ permissions: ['kpm:list_all'] }),
    });
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('explains the gap instead of rendering a blank screen when the permission is missing', () => {
    renderWithSession(<RequireSession permission="kpm:list_all">secret</RequireSession>);
    expect(screen.getByRole('heading', { name: 'Not available to you' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Your account does not have access to this screen. If you believe it should, ask whoever manages accounts where you work.',
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('P11-T6 AC-12 names no permission code in its words, and keeps the gate’s code as data', () => {
    // It said *"This screen needs the `kpm:list_all` permission"*: the one place a code reached a screen.
    renderWithSession(<RequireSession permission="coaching_session:read">secret</RequireSession>);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).not.toMatch(/\b[a-z][a-z_]*:[a-z][a-z_]*\b/);
    expect(alert.querySelector('code')).toBeNull();
    expect(alert).toHaveAttribute('data-permission', 'coaching_session:read');
  });

  it('P11-T6 AC-12 ADR-0084 rule 2: the refusal a coaching screen shows uses none of the six words', () => {
    // It ended *"ask whoever administers your office"*, on /coaching as on every other gated screen.
    renderWithSession(<RequireSession permission="coaching_session:read">secret</RequireSession>);
    expect(screen.getByRole('alert').textContent).not.toMatch(
      /\boffice\b|\bKPM\b|reports to|tagged to|\buntagged\b|\bunassigned\b/i,
    );
  });

  /*
   * P11-T7's review: a coachee's tab is a `Page` with a gate of its own inside the person shell, whose
   * page is already titled *Coaching Session*. Its refusal was a second `<h1>` under that title.
   */
  it('P11-T7 review: a refusal nested inside an already-titled page is a section of it, an h2, not a second h1', () => {
    renderWithSession(
      <Page title="Coaching Session" permission="coaching_session:read">
        <Page permission="goal:read">secret</Page>
      </Page>,
      { me: makeMe({ permissions: ['coaching_session:read'] }) },
    );
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Coaching Session']);
    expect(screen.getByRole('heading', { level: 2, name: 'Not available to you' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'goal:read');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('P11-T7 review: a page’s own refusal stays its one h1, and a page with no title of its own is not a title', () => {
    renderWithSession(<Page title="Coaching Session" permission="coaching_session:read">secret</Page>);
    expect(screen.getByRole('heading', { level: 1, name: 'Not available to you' })).toBeInTheDocument();
    document.body.innerHTML = '';

    renderWithSession(<Page><Page permission="goal:read">secret</Page></Page>);
    expect(screen.getByRole('heading', { level: 1, name: 'Not available to you' })).toBeInTheDocument();
  });

  it('takes the level it is given, whatever is above it', () => {
    renderWithSession(<RequireSession permission="kpm:list_all" headingLevel={2}>secret</RequireSession>);
    expect(screen.getByRole('heading', { level: 2, name: 'Not available to you' })).toBeInTheDocument();
  });
});
