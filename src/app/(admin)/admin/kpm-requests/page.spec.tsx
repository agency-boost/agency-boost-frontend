import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminLayout from '@/app/(admin)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import KpmRequestsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/kpm-requests',
}));

const SUPER_ADMIN = makeMe({
  user: {
    id: 'u-root', email: 'root@agencyboost.test', fullName: 'Root', preferredName: null,
    pronoun: 'they', initials: 'R', platformRole: 'super_admin',
  },
  membership: null,
  // `AdminShell` gates the whole console on `kpm:list_all`.
  permissions: ['kpm:list_all', 'kpm_request:read', 'kpm_request:decide'],
});

const req = (over: Record<string, unknown> = {}) => ({
  requestId: 'req-1', branchName: 'Surabaya Branch', companyId: 'co-1',
  companyName: 'Prudential', requestedByName: 'Rangga Wibisono',
  requestedByEmail: 'rangga@example.test', note: 'Twelve agents already here.',
  status: 'pending', requestedAt: '2026-09-01T00:00:00.000Z',
  decidedAt: null, reason: null, createdKpmId: null, ...over,
});

describe('KPMs pending approval (P3.5-T2)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('AC-1: names the branch, the company, and who asked with their intent', async () => {
    // `Superadmin.html:329` writes the requester and the proposed Owner as one string,
    // because they are one person: asking for an office is asking to run one.
    stubFetch({ '/admin/kpm-requests': { body: [req()] } });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Surabaya Branch')).toBeInTheDocument();
    // Named twice on purpose: once in the row's meta line, once in the sentence saying
    // what approving will do to them.
    expect(screen.getAllByText(/Rangga Wibisono/).length).toBeGreaterThan(1);
    expect(screen.getByText(/proposed KPM Owner/)).toBeInTheDocument();
    expect(screen.getByText('Twelve agents already here.')).toBeInTheDocument();
  });

  it('AC-2: will not approve without a code, because the platform issues it', async () => {
    // The code must be unique within the company and a requester cannot know what is
    // free — which is why the prototype's `KPM name` column is a branch name.
    stubFetch({ '/admin/kpm-requests': { body: [req()] } });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByRole('button', { name: 'Approve' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('KPM code'), '0629');
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('AC-2: says what approving will do before it is pressed', async () => {
    stubFetch({ '/admin/kpm-requests': { body: [req()] } });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(
      await screen.findByText('Approving creates the office and makes Rangga Wibisono its Owner.'),
    ).toBeInTheDocument();
  });

  it('AC-2: sends the code the platform typed', async () => {
    const { calls } = stubFetch({
      '/admin/kpm-requests/req-1/approve': { body: [req({ status: 'approved', createdKpmId: 'kpm-9' })] },
      '/admin/kpm-requests': { body: [req()] },
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('KPM code'), '0629');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));

    const sent = calls.find((c) => c.url.includes('/approve'));
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ code: '0629' });
  });

  it('declining needs no code, and carries the reason back', async () => {
    const { calls } = stubFetch({
      '/admin/kpm-requests/req-1/decline': { body: [req({ status: 'declined', reason: 'Already KPM 0417.' })] },
      '/admin/kpm-requests': { body: [req()] },
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    await userEvent.type(await screen.findByLabelText('Why not?'), 'Already KPM 0417.');
    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

    const sent = calls.find((c) => c.url.includes('/decline'));
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ reason: 'Already KPM 0417.' });
  });

  it('lines both decision buttons up with the inputs, not the labels', async () => {
    // Approve was a bare child of the `FieldRow` while Decline was wrapped, so only Approve
    // rode up to the label row — the row is `items-start`, and a button carries no label to
    // start with. Both sit in an actions slot now, which supplies the label-shaped spacer.
    stubFetch({ '/admin/kpm-requests': { body: [req()] } });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    for (const name of ['Approve', 'Decline']) {
      const actions = (await screen.findByRole('button', { name })).closest('.flex-col');
      expect(actions?.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('separates what is decided from what is waiting', async () => {
    stubFetch({
      '/admin/kpm-requests': {
        body: [req(), req({ requestId: 'req-2', branchName: 'Medan Branch', status: 'declined', reason: 'No.' })],
      },
    });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Medan Branch')).toBeInTheDocument();
    // The pending one is a card above, not a row in the decided table.
    expect(within(table).queryByText('Surabaya Branch')).toBeNull();
  });

  it('says nothing is waiting rather than showing an empty table', async () => {
    stubFetch({ '/admin/kpm-requests': { body: [] } });
    renderInLayout(AdminLayout, <KpmRequestsPage />, { me: SUPER_ADMIN });

    expect(await screen.findByText('Nobody is waiting for an office.')).toBeInTheDocument();
  });
});
