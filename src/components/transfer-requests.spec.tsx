import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import MembersPage from '@/app/(tenant)/people/members/page';
import { makeMe, renderInLayout, renderWithSession, stubFetch } from '@test/harness';
import { transfer } from '@test/joining-fixtures';
import { TransferRequests } from './transfer-requests';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/members',
}));

const OWNER = (permissions: string[]) => makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 0,
  },
  permissions,
});

describe('transfer requests, decided by the office (P18.96-T3 AC-3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, '', '/');
  });

  it('P18.96-T3 AC-3 lists who would move, from whom to whom, and who asked', async () => {
    stubFetch({ '/transfer-requests': { body: [transfer()] } });
    renderWithSession(<TransferRequests />);
    const table = await screen.findByRole('table', { name: 'Transfer requests, oldest first' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Raka Aditama');
    expect(row).toHaveTextContent('87014');
    expect(row).toHaveTextContent('From Satria Nugraha’s unit to Agus Prasetyo’s');
    expect(row).toHaveTextContent(/^.*Agus Prasetyo, /);
    // The name the leader typed is the account's own: nothing more is said.
    expect(row).not.toHaveTextContent('Added as');
  });

  it('P18.96-T8 M3 says the name the leader typed on the code’s line where it is not the account’s, so a wrong code is seen', async () => {
    stubFetch({
      '/transfer-requests': {
        body: [
          transfer({ requestedName: 'Rudi Hartono' }),
          // The same person, typed in another case and spacing: not a mismatch.
          transfer({ transferId: 'tr-2', requestedName: '  raka   aditama ' }),
          // A request made before the name was kept.
          transfer({ transferId: 'tr-3', requestedName: null }),
        ],
      },
    });
    renderWithSession(<TransferRequests />);
    const table = await screen.findByRole('table', { name: 'Transfer requests, oldest first' });
    const [, typedOther, sameName, older] = within(table).getAllByRole('row');
    expect(typedOther).toHaveTextContent('Raka Aditama87014 · Added as Rudi Hartono');
    expect(sameName).not.toHaveTextContent('Added as');
    expect(older).not.toHaveTextContent('Added as');
  });

  it('P18.96-T3 AC-3 Approve asks first — it moves their whole unit — then moves them and confirms', async () => {
    const { calls } = stubFetch({
      '/transfer-requests': { body: [transfer()] },
      'POST /transfer-requests/tr-1/approve': { body: [] },
    });
    renderWithSession(<TransferRequests />);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    const ask = screen.getByRole('dialog', { name: 'Move Raka Aditama to Agus Prasetyo’s unit? Everybody under them moves too.' });
    expect(calls.some((c) => c.url.includes('/approve'))).toBe(false);
    await userEvent.click(within(ask).getByRole('button', { name: 'Approve transfer' }));
    expect(await screen.findByText('Transfer approved ✓ — Raka Aditama is in Agus Prasetyo’s unit now.')).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith('/transfer-requests/tr-1/approve') && c.init.method === 'POST')).toBe(true);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-3 Decline asks why, and sends it to the leader who asked', async () => {
    const { calls } = stubFetch({
      '/transfer-requests': { body: [transfer()] },
      'POST /transfer-requests/tr-1/decline': { body: [] },
    });
    renderWithSession(<TransferRequests />);
    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await userEvent.type(screen.getByLabelText('Why?'), 'Keep him with Satria for now.');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    const post = calls.find((c) => c.url.includes('/decline'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({ reason: 'Keep him with Satria for now.' });
    expect(await screen.findByText('Transfer declined ✓')).toBeInTheDocument();
  });

  it('P18.96-T3 AC-3 a decision somebody made first is said, and the queue read again', async () => {
    const { calls } = stubFetch({
      '/transfer-requests': [{ body: [transfer()] }, { body: [] }],
      'POST /transfer-requests/tr-1/decline': {
        status: 409, body: { error: { code: 'ORG_REQUEST_ALREADY_DECIDED', message: 'That transfer request was already approved.', requestId: 'r' } },
      },
    });
    renderWithSession(<TransferRequests />);
    await userEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already approved');
    expect(calls.filter((c) => c.url.endsWith('/transfer-requests')).length).toBe(2);
  });

  it('P18.96-T3 AC-3 draws nothing while none waits', async () => {
    const { calls } = stubFetch({ '/transfer-requests': { body: [] } });
    renderWithSession(<TransferRequests />);
    await vi.waitFor(() => expect(calls.length).toBe(1));
    expect(screen.queryByRole('heading', { name: 'Transfer requests' })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-3 sits on All Members’ Pending tab for whoever decides them — opened by the notice’s ?tab=pending', async () => {
    window.history.replaceState(null, '', '/people/members?tab=pending');
    stubFetch({
      '/join/requests': { body: [] },
      '/members/leader-limit-requests': { body: [] },
      '/members': { body: { members: [], nextCursor: null, counts: { directory: 8, pending: 0, removed: 1 } } },
      '/transfer-requests': { body: [transfer()] },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER(['member:read_profile', 'member:transfer_approve']) });
    expect(await screen.findByRole('heading', { name: 'Transfer requests' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pending/ })).toHaveAttribute('aria-current', 'page');
  });

  it('P18.96-T3 AC-7 asks nothing of the transfers for somebody who does not decide them', async () => {
    window.history.replaceState(null, '', '/people/members?tab=pending');
    const { calls } = stubFetch({
      '/join/requests': { body: [] },
      '/members/leader-limit-requests': { body: [] },
      '/members': { body: { members: [], nextCursor: null, counts: { directory: 8, pending: 0, removed: 1 } } },
    });
    renderInLayout(TenantLayout, <MembersPage />, { me: OWNER(['member:read_profile']) });
    await screen.findByText('Everybody who has registered is in a unit.');
    expect(calls.some((c) => c.url.includes('/transfer-requests'))).toBe(false);
  });
});
