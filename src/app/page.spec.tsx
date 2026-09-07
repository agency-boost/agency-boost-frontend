import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeMe, renderWithSession } from '@test/harness';
import Home from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/',
}));

/**
 * The landing hands off and nothing else. Which destination it picks is
 * `lib/landing.spec.ts`; this is about the hand-off itself.
 */
describe('landing', () => {
  afterEach(() => replace.mockClear());

  // The assertions name the sentence, not the word "loading". It is the only thing a
  // screen reader is told here, so what it actually says is the thing worth pinning.
  it('waits rather than bouncing before the session is known', () => {
    renderWithSession(<Home />, { me: null, loading: true });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Taking you to your work');
  });

  it('renders no content of its own, whoever is signed in', () => {
    // Two screens claiming to be home would mean the one you saw depended on how fast
    // the redirect ran.
    renderWithSession(<Home />, { me: makeMe() });
    expect(screen.getByRole('status')).toHaveTextContent('Taking you to your work');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in', () => {
    renderWithSession(<Home />, { me: null, loading: false });
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('sends a Super Admin to the platform console', () => {
    renderWithSession(<Home />, {
      me: makeMe({
        user: {
          id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
          pronoun: 'they', initials: 'R', platformRole: 'super_admin',
        },
        membership: null,
      }),
    });
    expect(replace).toHaveBeenCalledWith('/admin');
  });

  it('sends a KPM Owner to their office overview', () => {
    renderWithSession(<Home />, {
      me: makeMe({
        membership: {
          membershipId: 'mem-1', kpmId: 'kpm-1', hierarchyRole: 'ab', status: 'active',
          isKpmOwner: true, isKpmAdmin: false, directCount: 2,
        },
      }),
    });
    expect(replace).toHaveBeenCalledWith('/kpm/overview');
  });

  it('sends an agent to their own day, not to their profile', () => {
    // Landing on a profile with a sign-out button and nothing else is what this
    // replaced: it read as though the product had nothing for them.
    renderWithSession(<Home />, { me: makeMe() });
    expect(replace).toHaveBeenCalledWith('/activity/log');
  });
});
