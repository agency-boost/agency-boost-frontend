import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
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
    expect(screen.getByRole('alert')).toHaveTextContent('kpm:list_all');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
