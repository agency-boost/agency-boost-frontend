import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell, type NavSection } from './app-shell';

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
});
