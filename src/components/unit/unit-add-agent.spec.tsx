import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderWithSession, stubFetch } from '@test/harness';
import { shared } from '@test/joining-fixtures';
import { AGUS_ME, dashboard, EMPTY } from '@test/unit-dashboard-fixtures';
import { UnitDashboard } from './unit-dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/unit/dashboard',
}));

const ADDER = { ...AGUS_ME, permissions: [...AGUS_ME.permissions, 'member:invite'] };
const OWNER = makeMe({
  membership: { ...AGUS_ME.membership!, membershipId: 'mem-owner', isKpmOwner: true },
  permissions: ADDER.permissions,
});
const SARIS = dashboard({ head: { membershipId: 'mem-sari', name: 'Sari Puspita', isReader: false } });

const show = (view = dashboard(), me = ADDER, forId?: string) => {
  const stub = stubFetch({ 'GET /unit/dashboard': { body: view }, 'POST /new-hires/agents': { body: { outcome: 'invited', ...shared() } } });
  renderWithSession(<UnitDashboard period="month" forId={forId} />, { me });
  return stub;
};

describe('+ Add agent on the Unit Dashboard (P18.96-T3 AC-1)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.96-T3 AC-1 sits in the roster’s header beside Update production, and adds to the reader’s own unit', async () => {
    const { calls } = show();
    const header = (await screen.findByRole('heading', { name: 'Your team’s roster' })).closest('div')!.parentElement!;
    expect(within(header).getByRole('button', { name: 'Update production' })).toBeInTheDocument();
    await userEvent.click(within(header).getByRole('button', { name: '+ Add agent' }));
    // The form's module is fetched on its first opening (P18.99-T16).
    const dialog = await screen.findByRole('dialog', { name: 'Add agent' });
    // The office's today, as the dashboard answered it.
    expect(within(dialog).getByLabelText('Join date')).toHaveValue('2026-10-08');
    await userEvent.type(within(dialog).getByLabelText('Agent code'), '80777');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Yusuf Hidayat');
    await userEvent.type(within(dialog).getByLabelText('WhatsApp number'), '0812-8077-7001');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add & send invite' }));
    const post = calls.find((c) => c.url.includes('/new-hires/agents'))!;
    expect(JSON.parse(post.init.body as string)).not.toHaveProperty('leaderMembershipId');
    expect(await screen.findByRole('dialog', { name: 'Invite Yusuf Hidayat' })).toBeInTheDocument();
  });

  it('P18.96-T3 AC-1 the Owner on somebody’s unit adds to that unit, named', async () => {
    const { calls } = show(SARIS, OWNER, 'mem-sari');
    await userEvent.click(await screen.findByRole('button', { name: '+ Add agent' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add agent to Sari Puspita’s unit' });
    await userEvent.type(within(dialog).getByLabelText('Agent code'), '80777');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Yusuf Hidayat');
    await userEvent.type(within(dialog).getByLabelText('WhatsApp number'), '0812-8077-7001');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add & send invite' }));
    const post = calls.find((c) => c.url.includes('/new-hires/agents'))!;
    expect(JSON.parse(post.init.body as string)).toMatchObject({ leaderMembershipId: 'mem-sari' });
  });

  it('P18.96-T3 AC-7 a leader on a unit below their own is not offered it: their grant is their own unit', async () => {
    show(SARIS, ADDER, 'mem-sari');
    await screen.findByRole('heading', { name: 'Your team’s roster' });
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-7 nor a reader who does not hold member:invite', async () => {
    show(dashboard(), AGUS_ME);
    await screen.findByRole('heading', { name: 'Your team’s roster' });
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
  });

  it('P18.96-T3 AC-1 a leader who leads nobody yet adds their first agent from the empty state', async () => {
    show(EMPTY, { ...ADDER, membership: { ...ADDER.membership!, membershipId: 'mem-rina', directCount: 0 } });
    expect(await screen.findByRole('button', { name: '+ Add agent' })).toBeInTheDocument();
  });

  it('UI-009 on a tablet too, in the roster’s header row beside the chips', async () => {
    atWidth(800);
    show();
    const header = (await screen.findByRole('heading', { name: 'Your team’s roster' })).parentElement!;
    expect(within(header).getByRole('button', { name: '+ Add agent' })).toBeInTheDocument();
    expect(within(header).getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
  });

  it('UI-002 not on a phone — adding people lives in User Management (the owner, 30 Oct) — nor in the empty state there', async () => {
    atWidth(375);
    show();
    await screen.findByRole('heading', { name: 'Your team’s roster' });
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update production' })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
    atWidth(375);
    show(EMPTY, { ...ADDER, membership: { ...ADDER.membership!, membershipId: 'mem-rina', directCount: 0 } });
    expect(await screen.findAllByText('Nobody is in your unit yet.')).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: '+ Add agent' })).not.toBeInTheDocument();
  });
});
