import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { atWidth, makeMe, renderInIndonesian, renderWithSession, routeParams, stubFetch, type StubReply } from '@test/harness';
import { englishOnly, englishShown } from '@test/english-left';
import { groupTreeMessages } from '@/i18n/messages/group-tree';
import LeaderGroupTreePage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/group-tree/mem-sari',
}));

const OWNER = makeMe({
  membership: {
    membershipId: 'mem-owner', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: true, isKpmAdmin: false, directCount: 5,
  },
  permissions: ['org_tree:read', 'kpm_analytics:read'],
});

/** A Core Leader AB: Agus, above Sari. */
const AGUS = makeMe({
  membership: {
    membershipId: 'mem-agus', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab', status: 'active',
    isKpmOwner: false, isKpmAdmin: false, directCount: 3, isCoreLeader: true,
  },
  permissions: ['org_tree:read', 'kpm_analytics:read'],
});

const node = (over: Record<string, unknown>) => ({
  fullName: 'Somebody', preferredName: null, initials: 'SB', agentCode: 'KPM0417-000',
  role: 'agent', depth: 0, layer: 1, leaderId: null, directCount: 0, directCounts: { ab: 0, aab: 0, agent: 0, total: 0 },
  subtreeCount: 0, isLeader: false, isSelf: false, todayActivityCount: 0, photoUrl: null, ...over,
});

/** Sari's tree as she reads it: her, Nina's unit below her, Rina; Agus the card above (`GET /members/tree?for=`). */
const SARIS_TREE = {
  nodes: [
    node({ membershipId: 'mem-sari', fullName: 'Sari Puspita', role: 'aab', layer: 1, leaderId: 'mem-agus', isLeader: true, directCount: 2, isSelf: true }),
    node({ membershipId: 'mem-nina', fullName: 'Nina Lestari', role: 'aab', layer: 2, leaderId: 'mem-sari', isLeader: true, directCount: 1 }),
    node({ membershipId: 'mem-dodi', fullName: 'Dodi Kurniawan', layer: 3, leaderId: 'mem-nina' }),
    node({ membershipId: 'mem-rina', fullName: 'Rina Wijaya', layer: 2, leaderId: 'mem-sari' }),
  ],
  leader: { membershipId: 'mem-agus', fullName: 'Agus Prasetyo', initials: 'AP', role: 'ab' },
  rootIds: ['mem-sari'],
  selfId: 'mem-sari',
  counts: { ab: 0, aab: 1, agent: 2, total: 3 },
};

function open(reply: StubReply = { body: SARIS_TREE }, me = OWNER, width = 375) {
  atWidth(width);
  const stub = stubFetch({ 'GET /members/tree': reply });
  renderWithSession(<LeaderGroupTreePage params={routeParams({ membershipId: 'mem-sari' })} />, { me });
  return stub;
}

/**
 * **A leader's Group Tree, read-only** (P19.3-T3 AC-3, AC-16; UI-152's *Group Tree ›*, the KPM Overview flow report's
 * case 12): `/group-tree/[membershipId]` over `GET /members/tree?for=`.
 */
describe('P19.3-T3 a leader’s Group Tree, read-only, as that leader sees it', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([375, 768, 1280])('P19.3-T3 AC-3 at %ipx reads the leader’s tree with for, titled for whose it is', async (width) => {
    const { calls } = open(undefined, OWNER, width);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Group Tree · Sari Puspita');
    expect(calls.map((c) => c.url)).toEqual(['http://api.test/api/v1/members/tree?for=mem-sari']);
    expect(screen.getAllByText('3 below them · 1 AAB · 2 Agent').length).toBeGreaterThan(0);
  });

  it('P19.3-T3 AC-3 draws no row as the reader’s — no You — and names the leader above as Sari’s', async () => {
    open();
    await screen.findByTestId('group-tree-list');
    expect(screen.queryByText('You')).not.toBeInTheDocument();
    const upline = document.querySelector('[data-upline]') as HTMLElement;
    expect(upline).toHaveTextContent('Agus Prasetyo');
    expect(upline).toHaveTextContent('Sari’s leader');
    expect(upline).not.toHaveTextContent('Your leader');
  });

  it('P19.3-T3 AC-3 writes nothing: no invite, no Undang agen; only reads are sent', async () => {
    const { mock } = open();
    await screen.findByTestId('group-tree-list');
    expect(screen.queryByRole('link', { name: /Invite|Undang/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Invite|Undang|Add|Tambah/ })).not.toBeInTheDocument();
    expect(mock.mock.calls.every(([, init]) => ((init as RequestInit | undefined)?.method ?? 'GET') === 'GET')).toBe(true);
  });

  it('P19.3-T3 AC-3 a row opens what the reader may open: a leader’s Unit Dashboard; for the Owner anybody else’s member page', async () => {
    open();
    const list = await screen.findByTestId('group-tree-list');
    expect(within(list).getByRole('link', { name: 'Sari Puspita' })).toHaveAttribute('href', '/unit/dashboard/mem-sari');
    expect(within(list).getByRole('link', { name: 'Nina Lestari' })).toHaveAttribute('href', '/unit/dashboard/mem-nina');
    expect(within(list).getByRole('link', { name: 'Rina Wijaya' })).toHaveAttribute('href', '/people/members/mem-rina');
  });

  it('P19.3-T3 AC-16 a Core Leader above the leader opens a person’s Personal Summary, never the office’s member page', async () => {
    open(undefined, AGUS);
    const list = await screen.findByTestId('group-tree-list');
    expect(within(list).getByRole('link', { name: 'Rina Wijaya' })).toHaveAttribute('href', '/coaching/mem-rina/summary');
  });

  it('P19.3-T3 AC-16 outside the reader’s reach, gone or another office’s: not found, with the way back', async () => {
    open({ status: 404, body: { error: { code: 'NOT_FOUND', message: 'Member not found.', requestId: 'r' } } });
    expect(await screen.findByText('This Group Tree is not one you can open.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to KPM Analytics' })).toHaveAttribute('href', '/kpm/analytics');
  });

  it('P19.3-T3 AC-16 an Agent refused (403) reads the server’s words', async () => {
    open({ status: 403, body: { error: { code: 'PERM_DENIED', message: 'You do not have permission to do this.', requestId: 'r' } } });
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to do this.');
  });

  it('P19.3-T3 a leader nobody reports to: said plainly, no sample, no invite', async () => {
    open({ body: { ...SARIS_TREE, nodes: [SARIS_TREE.nodes[0]], counts: { ab: 0, aab: 0, agent: 0, total: 0 } } });
    expect(await screen.findByText('Nobody reports to this leader yet.')).toBeInTheDocument();
    expect(screen.queryByText('Contoh')).not.toBeInTheDocument();
  });

  it('P19.3-T3 in Indonesian: the title, the count, the leader above', async () => {
    atWidth(375);
    stubFetch({ 'GET /members/tree': { body: SARIS_TREE } });
    renderInIndonesian(<LeaderGroupTreePage params={routeParams({ membershipId: 'mem-sari' })} />, { me: OWNER });
    await screen.findByTestId('group-tree-list');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Group Tree · Sari Puspita');
    expect(screen.getAllByText('3 di bawahnya · 1 AAB · 2 Agent').length).toBeGreaterThan(0);
    expect(document.querySelector('[data-upline]')).toHaveTextContent('Leader Sari');
    expect(englishShown(document.body, englishOnly(groupTreeMessages))).toEqual([]);
  });
});
