import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSession } from '@test/harness';
import { useSignOut } from './use-sign-out';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/admin',
}));

function Probe() {
  const { signOut, busy } = useSignOut();
  return (
    <button onClick={() => void signOut()} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

describe('useSignOut', () => {
  it('ends the session, then leaves for the sign-in page', async () => {
    const { session } = renderWithSession(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('redirects even when the server call failed, because signOut never rejects', async () => {
    // A logout that cannot reach the server must still end the session locally —
    // leaving someone signed in because the network dropped is the wrong failure mode.
    const signOut = vi.fn(async () => undefined);
    renderWithSession(<Probe />, { signOut });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('reports being in flight so a caller can lock its control', async () => {
    let release: () => void = () => {};
    const signOut = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    renderWithSession(<Probe />, { signOut });

    void userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Signing out…' })).toBeDisabled();

    release();
    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeEnabled();
  });
});
