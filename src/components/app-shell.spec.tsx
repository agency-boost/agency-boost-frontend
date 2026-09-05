import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppShell, type NavSection } from './app-shell';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin',
}));

const SECTIONS: readonly NavSection[] = [
  {
    label: 'Personal tools',
    items: [
      { label: 'Activity management', href: '/activity', active: true },
      { label: 'Leads management', href: '/leads' },
    ],
  },
  { label: 'Reporting', items: [{ label: 'Advanced analytics', href: '#', upcoming: true }] },
];

const USER = { name: 'Rina Wijaya', role: 'Agent · KPM 0417', initials: 'RW' };

function renderShell() {
  return render(
    <AppShell sections={SECTIONS} user={USER} title="Log Activity" subtitle="Enter today's activities in 1 minute.">
      <p>content</p>
    </AppShell>,
  );
}

describe('AppShell', () => {
  it('renders the page title and subtitle from the topbar', () => {
    renderShell();
    expect(screen.getByRole('heading', { name: 'Log Activity', level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Enter today's activities in 1 minute.")).toBeInTheDocument();
  });

  it('marks the active nav item for assistive technology, not just visually', () => {
    renderShell();
    expect(screen.getByRole('link', { name: /Activity management/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Leads management/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps an upcoming item visible but not navigable, so the roadmap is not a surprise', () => {
    renderShell();
    const upcoming = screen.getByText('Advanced analytics').closest('a');
    expect(upcoming).toHaveAttribute('aria-disabled', 'true');
    expect(upcoming).not.toHaveAttribute('href');
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
  });

  it('groups nav items under their section labels', () => {
    renderShell();
    expect(screen.getByText('Personal tools')).toBeInTheDocument();
    expect(screen.getByText('Reporting')).toBeInTheDocument();
  });

  it('shows who is signed in and in what capacity', () => {
    renderShell();
    expect(screen.getByText('Rina Wijaya')).toBeInTheDocument();
    expect(screen.getByText('Agent · KPM 0417')).toBeInTheDocument();
    expect(screen.getByText('RW')).toBeInTheDocument();
  });

  it('renders its children', () => {
    renderShell();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  describe('the account menu at the foot of the sidebar', () => {
    it('is a plain label when no account is wired', () => {
      // A shell rendered outside a session has nothing to sign out of. Offering a dead
      // control would be worse than offering none.
      renderShell();
      expect(screen.queryByRole('button', { name: /Rina Wijaya/ })).not.toBeInTheDocument();
      expect(screen.getByText('Rina Wijaya')).toBeInTheDocument();
    });

    it('becomes a menu with an account link and sign out when it is', async () => {
      const onSignOut = vi.fn();
      render(
        <AppShell
          sections={SECTIONS}
          user={USER}
          account={{ href: '/profile', onSignOut }}
          title="Log Activity"
        >
          <p>content</p>
        </AppShell>,
      );

      await userEvent.click(screen.getByRole('button', { name: /Rina Wijaya/ }));
      expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');

      await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
      expect(onSignOut).toHaveBeenCalled();
    });
  });
});
