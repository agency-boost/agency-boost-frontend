import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import LeadsPage from '@/app/(agent)/leads/page';
import { atWidth, makeMe, renderInIndonesian, renderInLayout, stubFetch } from '@test/harness';
import type { Lead } from '@/lib/leads';
import type { ProposalRow } from '@/lib/proposals';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

/**
 * **P19.7-T2 AC-12 and AC-11 — proposals on the Leads page** (ADR-0221 §6; the proposal spec's *Proposals on the Leads
 * page*, Acc. 4 and 5): the card's pill *"PRUWell Medical +1"* and its *Buat proposal*; the filter's *Sudah ada proposal*
 * / *Belum ada proposal*, asked of the server with the other filters; the lead sheet's *Proposal* section above *Riwayat*,
 * each row opening its proposal, and *+ Buat proposal*; and *Riwayat*'s *"Proposal dibuat · …"*, linked while the
 * proposal exists. **None of it on a downline's lead**: the server sends no `proposals` there, and the screen asks for
 * none (decision 4).
 */

const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: [
    'lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome',
    'proposal:read', 'proposal:create', 'proposal:update', 'proposal:delete',
  ],
});

const stage = (pipeline: string, code: string, label: string, rank: number, over = {}) => ({
  id: code, pipeline, code, label, rank, isTerminal: false, isLateStage: false, version: 1, status: 'active', ...over,
});
const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      stage('sales', 'NOT_YET_APPROACHED', 'Not yet approached', 1),
      stage('sales', 'FOLLOW_UP', 'Follow-up', 2),
      stage('sales', 'PAID_AND_ISSUED', 'Paid and issued', 3, { isTerminal: true }),
    ],
  },
  {
    pipeline: 'recruitment',
    statuses: [
      stage('recruitment', 'NOT_APPROACHED', 'Not yet approached', 1),
      stage('recruitment', 'NEW_ACTIVE_AGENT', 'New active agent', 2, { isTerminal: true }),
    ],
  },
];

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Rosa Damayanti', contact: { phone: null, email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, committedMonths: [], lastEditedBy: null, remarks: null,
  nextActionDate: '2099-11-02', nextActionNote: 'Show the plan.', outcome: null, source: null,
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null, proposals: null, ...over,
});

const ROSA = lead({ proposals: { count: 2, latest: { products: ['PRUWell Medical', 'PRUCinta'] } } });
const HENDRO = lead({ id: 'l2', name: 'Pak Hendro Gunawan', proposals: { count: 1, latest: { products: ['PRULady'] } } });
const WULAN = lead({ id: 'l3', name: 'Ibu Wulan Sari' });
const EMPTY_DRAFT = lead({ id: 'l4', name: 'Ibu Maya Lestari', proposals: { count: 1, latest: { products: [] } } });
const RECRUIT = lead({ id: 'l5', name: 'Mas Andi', type: 'recruitment', statusCode: 'NOT_APPROACHED' });
/** A downline's lead, as a leader's list holds it: the server sends no `proposals` on it. */
const DOWNLINE = lead({ id: 'l6', name: 'Ibu Sinta Dewi', ownerMembershipId: 'mem-2' });

const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const ROW: ProposalRow = {
  id: 'p1', version: 3, client: { name: 'Ibu Rosa Damayanti' }, date: '2026-11-05',
  fileName: 'Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf',
  products: [{ name: 'PRUWell Medical', plan: 'Gold' }, { name: 'PRUCinta', plan: null }],
  status: 'done', totals: [{ currency: 'IDR', amountMinor: 125_000_000 }, { currency: 'USD', amountMinor: 12_500 }],
  leadId: 'l1', leadDeleted: false, updatedAt: '2026-11-05T03:00:00.000Z',
};
const DRAFT_ROW: ProposalRow = {
  ...ROW, id: 'p2', version: 1, status: 'draft', products: [{ name: 'PRULady', plan: null }], totals: [],
};

const BASE = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
  'outcome=won': { body: page([]) },
  'outcome=lost': { body: page([]) },
  'outcome=open': { body: page([ROSA, HENDRO, WULAN, EMPTY_DRAFT, RECRUIT, DOWNLINE]) },
  '/leads/l1': { body: { ...ROSA, history: [
    { kind: 'stage', at: '2026-10-27T03:00:00.000Z', fromStatusCode: null, toStatusCode: 'FOLLOW_UP' },
    { kind: 'proposal', at: '2026-11-01T03:00:00.000Z', proposalId: null, products: ['PRULady'] },
    { kind: 'proposal', at: '2026-11-05T03:00:00.000Z', proposalId: 'p1', products: ['PRUWell Medical', 'PRUCinta'] },
  ] } },
  '/leads/l6': { body: { ...DOWNLINE, history: [] } },
  '/proposals?leadId=l1': { body: { rows: [ROW, DRAFT_ROW], total: 2, page: 1, pageSize: 50 } },
};

const render = (routes: Record<string, unknown> = {}, width = 360) => {
  atWidth(width);
  const stub = stubFetch({ ...BASE, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};

const list = () => screen.findByRole('list', { name: 'Your leads' });
const cardOf = async (name: string) => within(await list()).getByRole('button', { name }).closest('li')!;
/** The *Semua* chip: the list opens on *Sales*, and Mas Andi is a Recruit lead. */
const showAll = async () => userEvent.click(await screen.findByRole('button', { name: /^All, / }));

describe('P19.7-T2 AC-12 proposals on the Leads page', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the card', () => {
    it('P19.7-T2 AC-12 draws a document icon and the latest proposal’s first product, plus a count: “PRUWell Medical +1”', async () => {
      render();
      const pill = (await cardOf('Ibu Rosa Damayanti')).querySelector('[data-proposal-pill]')!;
      expect(pill).toHaveTextContent('Proposal: PRUWell Medical +1');
      expect(pill.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      // One product: its name alone.
      expect((await cardOf('Pak Hendro Gunawan')).querySelector('[data-proposal-pill]')).toHaveTextContent(/PRULady$/);
    });

    it('P19.7-T2 AC-12 a lead with no proposal shows nothing extra', async () => {
      render();
      expect((await cardOf('Ibu Wulan Sari')).querySelector('[data-proposal-pill]')).toBeNull();
    });

    it('P19.7-T2 AC-12 a lead whose proposals are empty drafts shows the icon alone, named by the count', async () => {
      render();
      const pill = (await cardOf('Ibu Maya Lestari')).querySelector('[data-proposal-pill]')!;
      expect(pill).toHaveTextContent('1 proposal');
      expect(within(pill as HTMLElement).getByText('1 proposal')).toHaveClass('sr-only');
    });

    it('P19.7-T2 AC-1 Buat proposal on the reader’s own Sales lead: a named, tipped link to step 1 with the lead chosen', async () => {
      render();
      const link = within(await cardOf('Ibu Wulan Sari')).getByRole('link', { name: 'Make a proposal for Ibu Wulan Sari' });
      expect(link).toHaveAttribute('href', '/proposal/new?leadId=l3');
      expect(link).toHaveAttribute('title', 'Make a proposal');
    });

    it('P19.7-T2 AC-1 no Buat proposal on a Recruit lead', async () => {
      render();
      await showAll();
      expect(within(await cardOf('Mas Andi')).queryByRole('link', { name: /Make a proposal/ })).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-12 nothing on a downline’s lead: no pill and no Buat proposal (decision 4)', async () => {
      render();
      const card = await cardOf('Ibu Sinta Dewi');
      expect(card.querySelector('[data-proposal-pill]')).toBeNull();
      expect(within(card).queryByRole('link', { name: /Make a proposal/ })).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-1 no Buat proposal for a reader without proposal:create (a view-only session)', async () => {
      atWidth(360);
      stubFetch(BASE as Parameters<typeof stubFetch>[0]);
      const viewOnly = { ...AGENT, permissions: AGENT.permissions.filter((p) => p !== 'proposal:create') };
      renderInLayout(AgentLayout, <LeadsPage />, { me: viewOnly });
      expect(within(await cardOf('Ibu Wulan Sari')).queryByRole('link', { name: /Make a proposal/ })).not.toBeInTheDocument();
    });
  });

  describe('the filter', () => {
    it('P19.7-T2 AC-12 Has a proposal and No proposal yet ask the server (hasProposal), a second tap clears it; the filter mark shows', async () => {
      const { calls } = render();
      await list();
      await userEvent.click(screen.getByRole('button', { name: 'Filter and sort' }));
      const sheet = within(await screen.findByRole('dialog', { name: 'Filter and sort' }));
      const group = within(sheet.getByRole('group', { name: 'Proposal' }));
      await userEvent.click(group.getByRole('button', { name: 'Has a proposal' }));
      expect(group.getByRole('button', { name: 'Has a proposal' })).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => expect(calls.some((c) => /outcome=open/.test(c.url) && /hasProposal=true/.test(c.url))).toBe(true));
      await userEvent.click(group.getByRole('button', { name: 'No proposal yet' }));
      await waitFor(() => expect(calls.some((c) => /outcome=open/.test(c.url) && /hasProposal=false/.test(c.url))).toBe(true));
      expect(screen.getByRole('button', { name: 'Filter and sort, a filter is on' })).toBeInTheDocument();
      const before = calls.length;
      await userEvent.click(group.getByRole('button', { name: 'No proposal yet' }));
      await waitFor(() => expect(calls.slice(before).some((c) => /outcome=open/.test(c.url) && !/hasProposal/.test(c.url))).toBe(true));
    });

    it('P19.7-T2 AC-12 works together with Sales/Recruit and the stages, and Clear resets it', async () => {
      const { calls } = render();
      await list();
      await userEvent.click(screen.getByRole('button', { name: 'Filter and sort' }));
      const sheet = within(await screen.findByRole('dialog', { name: 'Filter and sort' }));
      await userEvent.click(within(sheet.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'Follow-up' }));
      await userEvent.click(within(sheet.getByRole('group', { name: 'Proposal' })).getByRole('button', { name: 'Has a proposal' }));
      await waitFor(() => expect(calls.some((c) => /hasProposal=true/.test(c.url))).toBe(true));
      // The type and the stage stay chosen beside it.
      expect(within(sheet.getByRole('group', { name: 'Type' })).getByRole('button', { name: 'Sales' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(sheet.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'Follow-up' })).toHaveAttribute('aria-pressed', 'true');
      await userEvent.click(sheet.getByRole('button', { name: 'Clear' }));
      expect(within(sheet.getByRole('group', { name: 'Proposal' })).getByRole('button', { name: 'Has a proposal' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('the lead sheet', () => {
    const open = async (name = 'Ibu Rosa Damayanti') => {
      await userEvent.click(within(await cardOf(name)).getByRole('button', { name }));
      return within(await screen.findByRole('dialog', { name }));
    };

    it('P19.7-T2 AC-12 a Proposal section above Riwayat: each row its date, products with their plan, premium per currency, status; a tap opens it', async () => {
      const { calls } = render();
      const sheet = await open();
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      expect(calls.some((c) => /\/proposals\?leadId=l1/.test(c.url))).toBe(true);
      const rows = within(section).getAllByRole('link').filter((a) => a.hasAttribute('data-proposal-row'));
      expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/proposal/p1?step=3', '/proposal/p2?step=3']);
      expect(rows[0]).toHaveTextContent('PRUWell Medical · Gold, PRUCinta');
      expect(rows[0]).toHaveTextContent('5 Nov');
      // Each currency on its own, never added: IDR 1.250.000 and USD 125,00 (ADR-0223 §8).
      expect(rows[0]).toHaveTextContent(/IDR 1,250,000 · USD 125\.00/);
      expect(within(rows[0]).getByText('Done')).toHaveAttribute('data-tone', 'green');
      expect(within(rows[1]).getByText('Draft')).toHaveAttribute('data-tone', 'grey');
      // Above Riwayat.
      const history = sheet.getByRole('heading', { name: 'History' }).closest('section')!;
      expect(section.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('P19.7-T2 AC-12 + Buat proposal starts one with this lead chosen', async () => {
      render();
      const sheet = await open();
      await sheet.findByRole('heading', { name: 'Proposal' });
      expect(sheet.getByRole('link', { name: 'Make a proposal' })).toHaveAttribute('href', '/proposal/new?leadId=l1');
    });

    it('P19.7-T2 AC-11 Riwayat keeps “Proposal dibuat · …”, dated, linked while the proposal exists and plain once deleted', async () => {
      render();
      const sheet = await open();
      const history = (await sheet.findByRole('heading', { name: 'History' })).closest('section')!;
      await within(history).findByText(/Status → Follow-up/);
      const linked = within(history).getByRole('link', { name: 'Proposal made · PRUWell Medical, PRUCinta' });
      expect(linked).toHaveAttribute('href', '/proposal/p1?step=3');
      expect(linked.closest('li')).toHaveTextContent('5 Nov');
      expect(within(history).getByText(/Proposal made · PRULady/)).toBeInTheDocument();
      expect(within(history).queryByRole('link', { name: /PRULady/ })).not.toBeInTheDocument();
    });

    it('P19.7-T2 AC-12 a downline’s lead has no Proposal section, and the screen asks for none (decision 4)', async () => {
      const { calls } = render();
      const sheet = await open('Ibu Sinta Dewi');
      await sheet.findByRole('heading', { name: 'History' });
      expect(sheet.queryByRole('heading', { name: 'Proposal' })).not.toBeInTheDocument();
      expect(calls.some((c) => /\/proposals/.test(c.url))).toBe(false);
    });

    it('P19.7-T2 AC-12 the pane from 1024px carries the same section', async () => {
      render({}, 1280);
      const pane = await screen.findByRole('region', { name: 'Ibu Rosa Damayanti' });
      expect(await within(pane).findByRole('heading', { name: 'Proposal' })).toBeInTheDocument();
      expect(within(pane).getByRole('link', { name: 'Make a proposal' })).toHaveAttribute('href', '/proposal/new?leadId=l1');
    });
  });

  it('P19.7-T2 AC-12 in Indonesian: Sudah ada proposal / Belum ada proposal, Buat proposal, Draf / Selesai, Proposal dibuat', async () => {
    atWidth(360);
    stubFetch(BASE as Parameters<typeof stubFetch>[0]);
    renderInIndonesian(<AgentLayout><LeadsPage /></AgentLayout>, { me: AGENT });
    const card = await screen.findByRole('button', { name: 'Ibu Rosa Damayanti' });
    expect(screen.getByRole('link', { name: 'Buat proposal untuk Ibu Wulan Sari' })).toHaveAttribute('title', 'Buat proposal');
    await userEvent.click(screen.getByRole('button', { name: 'Filter dan urutan' }));
    const filters = within(await screen.findByRole('dialog', { name: 'Filter dan urutan' }));
    expect(within(filters.getByRole('group', { name: 'Proposal' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Sudah ada proposal', 'Belum ada proposal']);
    await userEvent.click(filters.getByRole('button', { name: 'Tampilkan leads' }));
    await userEvent.click(card);
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Rosa Damayanti' }));
    await sheet.findByRole('heading', { name: 'Proposal' });
    expect(sheet.getByText('Selesai')).toBeInTheDocument();
    expect(sheet.getByText('Draf')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Buat proposal' })).toBeInTheDocument();
    expect(await sheet.findByRole('link', { name: 'Proposal dibuat · PRUWell Medical, PRUCinta' })).toBeInTheDocument();
  });
});
