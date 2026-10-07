import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { OfficeUnavailable } from './office-unavailable';

const ended = {
  code: 'TENANT_SUBSCRIPTION_ENDED',
  message: 'This office’s subscription ended on 2026-09-25.',
  details: { endDate: '2026-09-25', kpmCode: '0601', branch: 'Cikarang Branch' },
  requestId: 'r-1',
};

/**
 * The page for an office its member cannot use (P13.2-T3 AC-9): the words for each refusal, the office
 * named, the heading focused, Sign out, and nothing else to press.
 */
describe('OfficeUnavailable', () => {
  it('names the office, the day the subscription ended, and who to contact', async () => {
    render(<OfficeUnavailable error={ended} onSignOut={vi.fn()} />);
    const heading = screen.getByRole('heading', { level: 1, name: 'Your office’s subscription has ended' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText('KPM 0601 · Cikarang Branch')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(
      'Its subscription ended on September 25, 2026. Nobody in the office can use AgencyBoost until it is renewed. '
      + 'Contact AgencyBoost to renew it.',
    );
  });

  it('reads the date as the office’s day, never shifted by the browser’s zone', () => {
    // Built from its three numbers: parsed as an instant, a browser west of Greenwich shows the 24th.
    render(<OfficeUnavailable error={{ ...ended, details: { ...ended.details, endDate: '2026-01-01' } }} onSignOut={vi.fn()} />);
    expect(screen.getByRole('main')).toHaveTextContent('ended on January 1, 2026');
  });

  it('gives a suspended or an archived office the server’s own sentence', () => {
    const { rerender } = render(
      <OfficeUnavailable
        error={{ code: 'TENANT_SUSPENDED', message: 'This office is suspended.', details: { kpmCode: '0999' }, requestId: 'r' }}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your office is suspended' })).toBeInTheDocument();
    expect(screen.getByText('KPM 0999')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('This office is suspended.');

    rerender(
      <OfficeUnavailable
        error={{ code: 'TENANT_ARCHIVED', message: 'This office is archived.', requestId: 'r' }}
        onSignOut={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your office is archived' })).toBeInTheDocument();
  });

  it('has Sign out and no link anywhere: every address would meet the same refusal', async () => {
    const onSignOut = vi.fn(async () => undefined);
    render(<OfficeUnavailable error={ended} onSignOut={onSignOut} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  /*
   * **Inside a support session** (P13.2 exit review): the reader is a Super Admin acting as a member, so
   * the one button ends the session — signing out revoked the Super Admin's own sign-in and left the
   * session live — and the office is *this* one, not theirs.
   */
  describe('inside a support session (P13.2 exit review)', () => {
    const suspended = {
      code: 'TENANT_SUSPENDED', message: 'This office is suspended.', details: { kpmCode: '0601', branch: 'Cikarang Branch' },
      requestId: 'r',
    };

    it('offers End support session instead of Sign out, and calls it', async () => {
      const onSignOut = vi.fn();
      const onEndSupportSession = vi.fn(async () => undefined);
      render(<OfficeUnavailable error={suspended} onSignOut={onSignOut} onEndSupportSession={onEndSupportSession} />);

      expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'End support session' }));
      expect(onEndSupportSession).toHaveBeenCalledTimes(1);
      expect(onSignOut).not.toHaveBeenCalled();
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('names this office, which is not the reader’s own', () => {
      const { rerender } = render(
        <OfficeUnavailable error={suspended} onSignOut={vi.fn()} onEndSupportSession={vi.fn()} />,
      );
      expect(screen.getByRole('heading', { level: 1, name: 'This office is suspended' })).toBeInTheDocument();
      expect(screen.getByText('KPM 0601 · Cikarang Branch')).toBeInTheDocument();
      rerender(
        <OfficeUnavailable
          error={{ ...suspended, code: 'TENANT_ARCHIVED' }} onSignOut={vi.fn()} onEndSupportSession={vi.fn()}
        />,
      );
      expect(screen.getByRole('heading', { level: 1, name: 'This office is archived' })).toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      const { container } = render(
        <OfficeUnavailable error={suspended} onSignOut={vi.fn()} onEndSupportSession={vi.fn()} />,
      );
      const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
      expect(results.violations ?? []).toHaveLength(0);
    });
  });

  it('shows no code in its words', () => {
    render(<OfficeUnavailable error={ended} onSignOut={vi.fn()} />);
    expect(screen.getByRole('main')).not.toHaveTextContent(/TENANT_|SUBSCRIPTION_ENDED/);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<OfficeUnavailable error={ended} onSignOut={vi.fn()} />);
    const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations ?? []).toHaveLength(0);
  });
});
