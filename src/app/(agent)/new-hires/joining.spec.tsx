import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { renderInLayout, stubFetch, type StubReply } from '@test/harness';
import { readOnlySession, ROSTER, SARI_ME, SHELL_STUBS } from '@test/activation-fixtures';
import { invite, joinRequest, JOINING_PERMISSIONS, LINK, requestedTransfer, shared, TODAY } from '@test/joining-fixtures';
import NewHiresPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires',
}));

/** Sari, who may add agents and decides the requests addressed to her. */
const ADDER = { ...SARI_ME, permissions: [...SARI_ME.permissions, ...JOINING_PERMISSIONS] };

const show = (routes: Record<string, StubReply | StubReply[]> = {}, me = ADDER) => {
  const stub = stubFetch({
    ...SHELL_STUBS,
    '/new-hires': { body: ROSTER },
    '/new-hires/invites': { body: { today: TODAY, invites: [] } },
    '/new-hires/transfers': { body: [] },
    '/join/requests': { body: [] },
    '/join/requests/routing': { body: [] },
    ...routes,
  });
  const view = renderInLayout(AgentLayout, <NewHiresPage />, { me });
  return { ...stub, ...view };
};

describe('/new-hires: + Add agent, Review requests and Waiting to join (P18.96-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.96-T3 AC-1 carries + Add agent in the header for a reader who may add, and opens the one form', async () => {
    show();
    const button = await screen.findByRole('button', { name: '+ Add agent' });
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Add agent' });
    // The office's today, as the invites' read answered it.
    expect(within(dialog).getByLabelText('Join date')).toHaveValue(TODAY);
  });

  it('P18.96-T3 AC-1 offers neither button, and asks nothing more, to a reader who may not add or decide', async () => {
    const { calls } = show({}, SARI_ME);
    // P18.96-T6: the roster's sections, where its cards per unit were.
    await screen.findByRole('region', { name: 'In progress (day 1–90)' });
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review requests/ })).not.toBeInTheDocument();
    expect(calls.map((c) => c.url).filter((u) => /invites|transfers|join\/requests/.test(u))).toEqual([]);
  });

  it('P18.96-T3 AC-7 a read-only support session is offered no + Add agent', async () => {
    show({}, readOnlySession(ADDER));
    // P18.96-T6: the roster's sections, where its cards per unit were.
    await screen.findByRole('region', { name: 'In progress (day 1–90)' });
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-5 Review requests (n) while requests wait, opening the inbox, where approving asks for the join date', async () => {
    const { calls } = show({
      '/join/requests': { body: [joinRequest(), joinRequest({ requestId: 'req-2', fullName: 'Fajar Nugroho', initials: 'FN' })] },
      '/join/requests/req-1/approve': { body: [joinRequest({ requestId: 'req-2', fullName: 'Fajar Nugroho', initials: 'FN' })] },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Review requests (2)' }));
    const inbox = await screen.findByRole('dialog', { name: 'Review requests' });
    expect(await within(inbox).findByText('Putri Anggraini')).toBeInTheDocument();
    const putri = within(inbox).getByText('Putri Anggraini').closest('li')!;
    await userEvent.click(within(putri).getByRole('button', { name: 'Approve' }));
    expect(within(putri).getByLabelText('Join date')).toHaveValue(TODAY);
    await userEvent.click(within(putri).getByRole('button', { name: 'Approve' }));
    const post = calls.find((c) => c.url.includes('/approve'))!;
    expect(JSON.parse(post.init.body as string)).toEqual({ joinDate: TODAY });
    // The count follows the inbox the server answered.
    expect(await screen.findByRole('button', { name: 'Review requests (1)' })).toBeInTheDocument();
  });

  it('P18.96-T3 AC-5 a join request’s notice opens the inbox: ?review=requests', async () => {
    window.history.replaceState(null, '', '/new-hires?review=requests');
    try {
      show({ '/join/requests': { body: [joinRequest()] } });
      const inbox = await screen.findByRole('dialog', { name: 'Review requests' });
      expect(await within(inbox).findByText('Putri Anggraini')).toBeInTheDocument();
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('P18.96-T3 AC-5 draws no Review requests while nobody waits', async () => {
    show();
    await screen.findByRole('button', { name: '+ Add agent' });
    expect(screen.queryByRole('button', { name: /Review requests/ })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-2, AC-3 lists who is waiting to join: an invite with Resend and Cancel invite, and a transfer requested', async () => {
    show({
      '/new-hires/invites': { body: { today: TODAY, invites: [invite(), invite({ inviteId: 'inv-2', fullName: 'Rudi Hartono', status: 'expired', leader: { membershipId: 'mem-arief', name: 'Arief Hidayat' } })] } },
      '/new-hires/transfers': { body: [requestedTransfer({ to: { membershipId: 'mem-sari', name: 'Sari Puspita' } })] },
    });
    const section = within(await screen.findByRole('region', { name: 'Waiting to join' }));
    const rows = section.getAllByRole('listitem');
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Yusuf Hidayat'), expect.stringContaining('Rudi Hartono'), expect.stringContaining('Raka Aditama'),
    ]);
    expect(within(rows[0]).getByText('Invited, waiting to join')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/80777 · Join date 27 Okt 2026/)).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(within(rows[0]).getByRole('button', { name: 'Cancel invite' })).toBeInTheDocument();
    // Another leader's unit is named; the reader's own is not.
    expect(rows[0]).not.toHaveTextContent('Into');
    expect(within(rows[1]).getByText('Invite expired')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Into Arief Hidayat’s unit');
    expect(within(rows[2]).getByText('Transfer requested')).toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('87014 · The office decides');
  });

  it('P18.96-T8 M3 a transfer requested reads as the leader asked for it — the name typed, the code — and nothing of the unit they are in', async () => {
    show({
      '/new-hires/transfers': {
        body: [
          requestedTransfer({ requestedName: 'Raka A.', to: { membershipId: 'mem-sari', name: 'Sari Puspita' } }),
          // An older request, made before the name was kept, into another leader's unit: its code, and that unit.
          requestedTransfer({ transferId: 'tr-2', requestedName: null, agentCode: '87015' }),
        ],
      },
    });
    const section = within(await screen.findByRole('region', { name: 'Waiting to join' }));
    const rows = section.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Raka A.');
    expect(rows[0]).toHaveTextContent('87014 · The office decides');
    expect(rows[0]).not.toHaveTextContent('Into');
    expect(rows[1]).toHaveTextContent('87015');
    expect(rows[1]).toHaveTextContent('87015 · Into Agus Prasetyo’s unit · The office decides');
    expect(section.queryByText(/From /)).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-2 Resend shows the new link to share; Cancel invite asks first, then leaves nothing', async () => {
    const { calls } = show({
      '/new-hires/invites': { body: { today: TODAY, invites: [invite()] } },
      'POST /new-hires/invites/inv-1/resend': { body: shared() },
      'DELETE /new-hires/invites/inv-1': { body: { today: TODAY, invites: [] } },
    });
    const section = within(await screen.findByRole('region', { name: 'Waiting to join' }));
    await userEvent.click(section.getByRole('button', { name: 'Resend' }));
    const share = await screen.findByRole('dialog', { name: 'Invite Yusuf Hidayat' });
    expect(within(share).getByText(LINK)).toBeInTheDocument();
    expect(within(share).getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\/6281280777001\?text=/));
    await userEvent.click(within(share).getByRole('button', { name: 'Done' }));

    await userEvent.click(section.getByRole('button', { name: 'Cancel invite' }));
    const ask = await screen.findByRole('dialog', { name: 'Cancel the invite for Yusuf Hidayat? Its link stops working.' });
    expect(calls.some((c) => c.init.method === 'DELETE')).toBe(false);
    expect(within(ask).getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel invite' }));
    expect(await screen.findByText('Invite cancelled ✓')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Waiting to join' })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-3 a linked account is confirmed and the roster is read again', async () => {
    const { calls } = show({
      'POST /new-hires/agents': { body: { outcome: 'linked', member: { membershipId: 'mem-putri', fullName: 'Putri Anggraini' } } },
    });
    await userEvent.click(await screen.findByRole('button', { name: '+ Add agent' }));
    await userEvent.type(screen.getByLabelText('Agent code'), '80008');
    await userEvent.type(screen.getByLabelText('Name'), 'Putri');
    await userEvent.type(screen.getByLabelText('WhatsApp number'), '0812-1111-2222');
    const before = calls.filter((c) => c.url.endsWith('/api/v1/new-hires')).length;
    await userEvent.click(screen.getByRole('button', { name: 'Add agent' }));
    expect(await screen.findByText('Agent added ✓ — Putri Anggraini is in your unit now.')).toBeInTheDocument();
    await vi.waitFor(() => expect(calls.filter((c) => c.url.endsWith('/api/v1/new-hires')).length).toBeGreaterThan(before));
  });
});
