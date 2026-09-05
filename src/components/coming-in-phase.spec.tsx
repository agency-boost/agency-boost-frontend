import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ComingInPhase } from './coming-in-phase';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/unit/dashboard',
}));

describe('ComingInPhase', () => {
  it('names the phase, so the wait has a number on it', () => {
    render(<ComingInPhase phase={13} what="Your unit's activity." elsewhere={[]} />);
    expect(screen.getByText('Arrives in phase 13')).toBeInTheDocument();
  });

  it('says what will be here, in the reader terms', () => {
    render(<ComingInPhase phase={6} what="Recording what you did today." elsewhere={[]} />);
    expect(screen.getByText('Recording what you did today.')).toBeInTheDocument();
  });

  it('is explicit that nothing shown is standing in for the real thing', () => {
    // The line between a placeholder and a fake screen is exactly this: no fixtures, and
    // it says so rather than leaving a reader to wonder whether the zeroes are real.
    render(<ComingInPhase phase={9} what="Production." elsewhere={[]} />);
    expect(screen.getByText(/not an empty version of it, and not a sample/)).toBeInTheDocument();
  });

  it('links onward, so it is a signpost and not a dead end', () => {
    render(
      <ComingInPhase
        phase={13}
        what="Your unit."
        elsewhere={[{ href: '/profile', label: 'Your account', detail: 'Name and password.' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Your account' })).toHaveAttribute('href', '/profile');
    expect(screen.getByText('Name and password.')).toBeInTheDocument();
  });

  it('omits the onward panel entirely when there is nowhere to send anyone', () => {
    render(<ComingInPhase phase={13} what="Your unit." elsewhere={[]} />);
    expect(screen.queryByText('What you can do now')).not.toBeInTheDocument();
  });
});
