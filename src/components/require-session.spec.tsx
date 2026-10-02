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
