import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, resetLanguage, stubFetch } from '@test/harness';
import type { LinkedLogin, Me } from '@/lib/session';
import ProfilePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/profile',
}));

afterEach(() => {
  vi.unstubAllGlobals();
  resetLanguage();
});

const LINKED: LinkedLogin = {
  linkId: 'link-1', userId: 'u-sa', email: 'wilson@agencyboost.test', fullName: 'Wilson Tanoto',
  views: [{ kind: 'super_admin', officeName: null }],
};

function owner(me: Partial<Me> = {}): Me {
  return makeMe({
    user: { ...makeMe().user, id: 'u-owner', email: 'owner@kpm0417.test', fullName: 'Wilson Tanoto', initials: 'WT' },
    membership: {
      membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
      isKpmOwner: true, isKpmAdmin: false, directCount: 0, office: { code: '0417', branch: 'BSD City Branch' },
    },
    permissions: ['profile:read_self', 'profile:update_self', 'account_link:create', 'account_link:manage_self'],
    linkedLogin: LINKED,
    ...me,
  });
}

const READS = {
  '/auth/me/profile': { body: { companyName: 'Prudential', agentCode: '80001', leader: null, group: null } },
  '/auth/sessions': { body: [] },
  '/notifications': { body: { items: [], unread: 0 } },
};

const linkedRow = () => document.querySelector<HTMLElement>('[data-linked-login]');

/**
 * **P19.2-T1 AC-8 — *Profil saya*'s linked login** (UI-169 item 5; ADR-0199 §5): one line in *Keamanan*, where the
 * section already lists the sessions — *Akun tertaut*, its address and *Hapus tautan*, which asks first, then removes
 * the link and reads the session again, so the login leaves the avatar menu at once.
 */
describe('P19.2-T1 AC-8 the linked login on Profil saya', () => {
  it('P19.2-T1 AC-8 Keamanan shows Akun tertaut with its address and Hapus tautan', async () => {
    atWidth(375);
    stubFetch(READS);
    renderInIndonesian(<ProfilePage />, { me: owner() });
    await screen.findByRole('heading', { level: 1, name: 'Profil saya' });
    const row = within(linkedRow()!);
    expect(row.getByText('Akun tertaut')).toBeInTheDocument();
    expect(row.getByText('wilson@agencyboost.test')).toBeInTheDocument();
    expect(row.getByRole('button', { name: 'Hapus tautan' })).toHaveClass('min-h-11');
  });

  it('P19.2-T1 AC-8 Hapus tautan asks, then DELETE /auth/links/:linkId, says so, and reads the session again', async () => {
    const { calls } = stubFetch({ ...READS, 'DELETE /auth/links/link-1': { status: 204, body: undefined } });
    const reload = vi.fn(async () => undefined);
    renderWithSession(<ProfilePage />, { me: owner(), reload });
    await screen.findByRole('heading', { level: 1, name: 'My profile' });

    await userEvent.click(within(linkedRow()!).getByRole('button', { name: 'Remove link' }));
    const ask = await screen.findByRole('dialog', { name: /Remove the link/ });
    expect(ask).toHaveTextContent('Remove the link to wilson@agencyboost.test?');
    // Backing out removes nothing.
    await userEvent.click(within(ask).getByRole('button', { name: 'Keep it' }));
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);

    await userEvent.click(within(linkedRow()!).getByRole('button', { name: 'Remove link' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: /Remove the link/ })).getByRole('button', { name: 'Remove link' }));

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const removed = calls.filter((c) => c.init.method === 'DELETE');
    expect(removed.map((c) => c.url)).toEqual([expect.stringMatching(/\/api\/v1\/auth\/links\/link-1$/)]);
    expect(await screen.findByText('Link removed')).toBeInTheDocument();
  });

  it('P19.2-T1 AC-8 a refusal is said on the row, and the link stays', async () => {
    stubFetch({
      ...READS,
      'DELETE /auth/links/link-1': { status: 404, body: { error: { code: 'NOT_FOUND', message: 'Linked login not found.', requestId: 'r' } } },
    });
    const reload = vi.fn(async () => undefined);
    renderWithSession(<ProfilePage />, { me: owner(), reload });
    await screen.findByRole('heading', { level: 1, name: 'My profile' });
    await userEvent.click(within(linkedRow()!).getByRole('button', { name: 'Remove link' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: /Remove the link/ })).getByRole('button', { name: 'Remove link' }));

    expect(await within(linkedRow()!).findByRole('alert')).toHaveTextContent('Linked login not found.');
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ['with no link', owner({ linkedLogin: null })],
    ['in a support session', owner({ isImpersonating: true, impersonatedBy: 'u-root', impersonationReadOnly: true })],
  ])('P19.2-T1 AC-8 no line %s', async (_case, me) => {
    stubFetch(READS);
    renderWithSession(<ProfilePage />, { me });
    await screen.findByRole('heading', { level: 1, name: 'My profile' });
    expect(linkedRow()).toBeNull();
  });

  it('P19.2-T1 AC-8 axe: Keamanan with the linked login', async () => {
    stubFetch(READS);
    const { container } = renderWithSession(<ProfilePage />, { me: owner() });
    await screen.findByRole('heading', { level: 1, name: 'My profile' });
    expect((await axe(container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  });
});
