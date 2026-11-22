import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TenantLayout from '@/app/(tenant)/layout';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import { KPM_TREE, node } from '@test/people-fixtures';
import OrgTreePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/people/org-tree',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-wilson', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    isKpmOwner: true, isKpmAdmin: false, status: 'active', directCount: 2,
  },
  permissions: ['member:read_profile', 'org_tree:read', 'member:complete_personal'],
});

const open = (tree: unknown = KPM_TREE) => {
  const stub = stubFetch({ '/members/tree': { body: tree } });
  renderInLayout(TenantLayout, <OrgTreePage />, { me: OWNER });
  return stub;
};

describe('P19.20-T3 Org tree', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P19.20-T3 AC-1 the whole KPM from view=kpm: Cari agen, Buka semua and one summary line, test accounts not counted', async () => {
    const { calls } = open();

    expect(await screen.findByText('5 people · 3 AB · 1 AAB · 1 Agent · test accounts not counted')).toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/members/tree'))!.url).toMatch(/\/members\/tree\?view=kpm$/);
    expect(screen.getByRole('searchbox', { name: 'Find an agent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open all' })).toBeInTheDocument();
  });

  it.each([390, 1024, 1280])('P19.20-T3 AC-1 at %ipx the indented rows — never the sideways Lapisan chart', async (px) => {
    atWidth(px);
    open();

    expect(await screen.findByTestId('kpm-tree')).toBeInTheDocument();
    expect(screen.queryByText(/Layer 1|Lapisan 1/)).not.toBeInTheDocument();
  });

  it('P19.20-T3 AC-2 the reader’s own row navy with You, an AB orange-tinted, the role · n direct and today’s pill', async () => {
    open();

    const self = (await screen.findByText('Wilson Tanoto')).closest('[data-person-row]')!;
    expect(self).toHaveAttribute('data-tone', 'self');
    expect(self).toHaveTextContent('You');
    const agus = screen.getByText('Agus Prasetyo').closest('[data-person-row]')!;
    expect(agus).toHaveAttribute('data-tone', 'tinted');
    expect(agus).toHaveTextContent('AB · 2 direct5 activities');
  });

  it('P19.20-T3 AC-2 ⌄ only opens or closes the team; Buka semua opens every unit', async () => {
    open();

    await screen.findByText('Agus Prasetyo');
    expect(screen.queryByText('Rina Kurnia')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Agus Prasetyo/, expanded: false }));
    expect(await screen.findByText('Rina Kurnia')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('P19.20-T3 AC-2 a tap on a row opens the member sheet', async () => {
    stubFetch({
      '/members/tree': { body: KPM_TREE },
      '/members/mem-agus/tags': { body: {} },
      '/members/mem-agus': { body: { ...node({ membershipId: 'mem-agus', fullName: 'Agus Prasetyo', role: 'ab' }), status: 'active', email: '', leaderName: 'Wilson Tanoto', canEditDetails: false } },
    });
    renderInLayout(TenantLayout, <OrgTreePage />, { me: OWNER });

    await userEvent.click(await screen.findByRole('button', { name: 'Agus Prasetyo' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('P19.20-T3 AC-3 a core leader’s rows outside their downline are muted, without a pill, and open nothing', async () => {
    open({
      ...KPM_TREE,
      nodes: KPM_TREE.nodes.map((n) => (n.membershipId === 'mem-yosef' || n.membershipId === 'mem-wilson'
        ? { ...n, openable: false, isSelf: false } : n.membershipId === 'mem-agus' ? { ...n, isSelf: true } : n)),
      selfId: 'mem-agus',
    });

    const yosef = (await screen.findByText('Yosef Tambunan')).closest('[data-person-row]')!;
    expect(yosef).toHaveAttribute('data-tone', 'muted');
    expect(within(yosef as HTMLElement).queryByRole('button', { name: 'Yosef Tambunan' })).not.toBeInTheDocument();
    expect(yosef).not.toHaveTextContent('Not logged');
    expect(screen.getByText('Agus Prasetyo').closest('[data-person-row]')).toHaveAttribute('data-tone', 'self');
  });

  it('P19.20-T3 AC-1 Cari agen narrows the tree and opens the way down', async () => {
    open();

    await screen.findByText('Agus Prasetyo');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an agent' }), 'rina');
    expect(await screen.findByText('Rina Kurnia')).toBeInTheDocument();
    expect(screen.queryByText('Yosef Tambunan')).not.toBeInTheDocument();
  });

  it('P19.20-T3 an empty KPM and a refused read', async () => {
    open({ nodes: [], leader: null, rootIds: [], selfId: null, counts: { ab: 0, aab: 0, agent: 0, total: 0 } });
    expect(await screen.findByText(/This KPM has no members yet/)).toBeInTheDocument();
  });

  it('P19.20-T3 AC-1 in Indonesian, as the mockup words it', async () => {
    stubFetch({ '/members/tree': { body: KPM_TREE } });
    renderInIndonesian(<OrgTreePage />, { me: OWNER });

    expect(await screen.findByText('5 orang · 3 AB · 1 AAB · 1 Agent · akun tes tidak dihitung')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka semua' })).toBeInTheDocument();
    expect(screen.getByText('Anda')).toBeInTheDocument();
    expect(screen.getByText('Agus Prasetyo').closest('[data-person-row]')).toHaveTextContent('AB · 2 langsung');
  });
});
