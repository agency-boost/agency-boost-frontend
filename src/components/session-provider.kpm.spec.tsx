import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubFetch } from '@test/harness';
import { setAccessToken, setImpersonating } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { enteredKpmId, enterKpm, leaveKpm } from '@/lib/super-admin-kpm';
import { SessionProvider } from './session-provider';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/admin/tenants',
}));

const KPM = '66f0000000000000000002a1';

function Probe() {
  const { me, signOut } = useSession();
  return (
    <>
      <p data-testid="perms">{me ? me.permissions.join(',') : 'none'}</p>
      <button type="button" onClick={() => void signOut()}>out</button>
    </>
  );
}

const me = (platformRole: 'super_admin' | 'none', permissions: string[]) => ({
  user: { id: 'u-1', email: 'x@agencyboost.test', fullName: 'X', initials: 'X', platformRole },
  membership: null, isImpersonating: false, impersonatedBy: null, permissions,
});

/**
 * **A Super Admin entering or leaving a KPM reads the session again** (P19.23-T2 AC-4, AC-5; ADR-0277 §3): `GET /auth/me`
 * answers them as the KPM's Owner while one is entered, so the menu and the gates follow the KPM the tab is in.
 */
describe('P19.23-T2 the session follows the KPM a Super Admin enters', () => {
  beforeEach(() => {
    setAccessToken(null);
    setImpersonating(false);
    leaveKpm();
  });
  afterEach(() => {
    leaveKpm();
    vi.unstubAllGlobals();
  });

  it('P19.23-T2 AC-4 entering reads /auth/me again with X-Kpm-Id, and leaving reads it again without', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'fresh' } },
      '/auth/me': [
        { body: me('super_admin', ['kpm:list_all']) },
        { body: me('super_admin', ['kpm:list_all', 'kpm_overview:read']) },
        { body: me('super_admin', ['kpm:list_all']) },
      ],
    });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('perms')).toHaveTextContent('kpm:list_all'));

    enterKpm(KPM);
    await waitFor(() => expect(screen.getByTestId('perms')).toHaveTextContent('kpm_overview:read'));
    const reads = calls.filter((c) => c.url.includes('/auth/me'));
    expect(new Headers(reads[1].init.headers).get('X-Kpm-Id')).toBe(KPM);

    leaveKpm();
    await waitFor(() => expect(calls.filter((c) => c.url.includes('/auth/me'))).toHaveLength(3));
    expect(new Headers(calls.filter((c) => c.url.includes('/auth/me'))[2].init.headers).get('X-Kpm-Id')).toBeNull();
  });

  // 2026-11-20: a Super Admin's landing inside a KPM is that KPM's page (`landingFor`), so signing out leaves the KPM —
  // whoever signs in next in this tab starts on the platform, never inside the KPM somebody else had entered.
  it('signing out leaves the KPM the tab had entered, and reads nobody’s session again for it', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'fresh' } },
      '/auth/me': [{ body: me('super_admin', ['kpm:list_all']) }, { body: me('super_admin', ['kpm:list_all', 'kpm_overview:read']) }],
      '/auth/logout': { status: 204 },
    });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('perms')).toHaveTextContent('kpm:list_all'));
    enterKpm(KPM);
    await waitFor(() => expect(screen.getByTestId('perms')).toHaveTextContent('kpm_overview:read'));

    screen.getByRole('button', { name: 'out' }).click();
    await waitFor(() => expect(screen.getByTestId('perms')).toHaveTextContent('none'));
    expect(enteredKpmId()).toBeNull();
    expect(calls.filter((c) => c.url.includes('/auth/me'))).toHaveLength(2);
  });

  it('P19.23-T2 AC-4 anybody else is not read again: the header grants them nothing', async () => {
    const { calls } = stubFetch({
      '/auth/refresh': { body: { accessToken: 'fresh' } },
      '/auth/me': { body: me('none', ['member:read_profile']) },
    });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(screen.getByTestId('perms')).toHaveTextContent('member:read_profile'));
    enterKpm(KPM);
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.filter((c) => c.url.includes('/auth/me'))).toHaveLength(1);
  });
});
