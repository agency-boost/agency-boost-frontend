import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBanner } from './field';

/**
 * **`ErrorBanner`, every screen's one way to say a failure** (P18.97-T4 AC-10, ADR-0176 §10; UI-032): a server's answer
 * with its code and request id; a failure the browser detected as its sentence alone, its code to the console.
 */
describe('P18.97-T4 AC-10 ErrorBanner', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['NETWORK', 'UNEXPECTED', 'CONFIG', 'FILE_UNREADABLE'])(
    'P18.97-T4 AC-10 draws %s as its sentence alone and logs the code once', (code) => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { rerender } = render(<ErrorBanner code={code} message="Something you can act on." requestId="unknown" />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/^Something you can act on\.$/);
      expect(alert.querySelectorAll('p')).toHaveLength(1);
      expect(warn).toHaveBeenCalledWith(`[${code}] Something you can act on.`);
      // A re-render of the same failure is not a second one.
      rerender(<ErrorBanner code={code} message="Something you can act on." requestId="unknown" />);
      expect(warn).toHaveBeenCalledTimes(1);
    },
  );

  it('P18.97-T4 AC-10 keeps a server’s code and request id under its sentence, and logs nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<ErrorBanner code="PERM_OWNER_ONLY" message="Only this office’s Owner can do that." requestId="r-1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only this office’s Owner can do that.PERM_OWNER_ONLY · r-1');
    expect(screen.getByText('PERM_OWNER_ONLY · r-1')).toHaveClass('text-2xs', 'text-muted');
    expect(warn).not.toHaveBeenCalled();
  });

  it('P18.97-T4 AC-10 keeps a server’s code where it carries no request id, as before', () => {
    render(<ErrorBanner code="INTERNAL_ERROR" message="Something went wrong. Please try again." requestId="unknown" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.INTERNAL_ERROR');
  });
});
