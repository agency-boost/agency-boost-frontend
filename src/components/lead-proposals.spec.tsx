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
 *
 * *Changed by P19.11-T3 (UX-9, UX-11):* a *›* between the type and the stage (AC-3). *Changed again by P19.14-T4
 * (PR-07; ADR-0257, which amends ADR-0241):* **the pill is back** — the latest proposal's first product and how many more
 * it holds, a draft included — with ***Buat proposal*** on every Sales card of the reader's own, left of WhatsApp; the
 * sheet's *Proposal* section lists **one row per proposal**, drafts included, *Buat proposal* below them.
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

/** A finished proposal (`p1`) and a draft; the latest with a product holds two: *"PRUWell Medical +1"*. */
const ROSA = lead({ proposals: { count: 2, latest: { id: 'p1', products: ['PRUWell Medical', 'PRUCinta'] }, done: 1, latestDone: { id: 'p1' }, client: null } });
/** Drafts only, one with a product: the pill counts it (OD-333), *"PRULady"*. */
const HENDRO = lead({ id: 'l2', name: 'Pak Hendro Gunawan', proposals: { count: 1, latest: { id: 'p3', products: ['PRULady'] }, done: 0, latestDone: null, client: null } });
const WULAN = lead({ id: 'l3', name: 'Ibu Wulan Sari' });
const EMPTY_DRAFT = lead({ id: 'l4', name: 'Ibu Maya Lestari', proposals: { count: 1, latest: { id: null, products: [] }, done: 0, latestDone: null, client: null } });
const RECRUIT = lead({ id: 'l5', name: 'Mas Andi', type: 'recruitment', statusCode: 'NOT_APPROACHED' });
/** A downline's lead, as a leader's list holds it: the server sends no `proposals` on it. */
const DOWNLINE = lead({ id: 'l6', name: 'Ibu Sinta Dewi', ownerMembershipId: 'mem-2' });

const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const ROW: ProposalRow = {
  id: 'p1', version: 3, client: { name: 'Ibu Rosa Damayanti' }, date: '2026-11-05',
  fileName: 'Proposal-Ibu-Rosa-Damayanti-2026-11-05.pdf',
  products: [{ name: 'PRUWell Medical', plan: 'Gold' }, { name: 'PRUCinta', plan: null }],
  status: 'done',
  totals: [
    { currency: 'IDR', payFrequency: 'monthly', amountMinor: 125_000_000, items: 1 },
    { currency: 'USD', payFrequency: 'annual', amountMinor: 12_500, items: 1 },
  ],
  leadId: 'l1', leadDeleted: false, updatedAt: '2026-11-05T03:00:00.000Z',
};
/** A draft of the same lead, changed since: the sheet lists it too (P19.14-T4 AC-3). */
const DRAFT_ROW: ProposalRow = {
  ...ROW, id: 'p2', status: 'draft', date: '2026-11-07', products: [{ name: 'PRUCritical Benefit 88', plan: null }], totals: [],
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
  '/leads/l2': { body: { ...HENDRO, history: [] } },
  // The sheet asks for every proposal of the lead (P19.14-T4 AC-3), newest change first.
  '/proposals?leadId=l1': { body: { rows: [DRAFT_ROW, ROW], total: 2, page: 1, pageSize: 50 } },
  '/proposals?leadId=l2': { body: { rows: [], total: 0, page: 1, pageSize: 50 } },
};

const render = (routes: Record<string, unknown> = {}, width = 360) => {
  atWidth(width);
  const stub = stubFetch({ ...BASE, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};

const list = () => screen.findByRole('list', { name: 'Your leads' });
const cardOf = async (name: string) => within(await list()).getByRole('button', { name }).closest('li')!;

describe('P19.7-T2 AC-12 proposals on the Leads page', () => {
  afterEach(() => vi.unstubAllGlobals());

  describe('the card', () => {
    it('P19.14-T4 AC-1 a Sales card wears the pill: the latest proposal’s first product and how many more it holds', async () => {
      render();
      const rosa = (await cardOf('Ibu Rosa Damayanti')).querySelector('[data-lead-proposal]')!;
      expect(rosa).toHaveTextContent('PRUWell Medical +1');
      expect(within(rosa as HTMLElement).getByText('Proposal:')).toHaveClass('sr-only');
      // A draft counts (OD-333): its one product, no count.
      expect((await cardOf('Pak Hendro Gunawan')).querySelector('[data-lead-proposal]')).toHaveTextContent(/^Proposal: PRULady$/);
      // The pill sits on the type and stage line, after the stage — a label, never a link: the card opens the sheet.
      const line = (await cardOf('Ibu Rosa Damayanti')).querySelector('[data-lead-stage]')!.parentElement!;
      expect([...line.children].map((child) => child.textContent)).toEqual(['Sales', '›Follow-up', 'Proposal: PRUWell Medical +1']);
      expect(rosa.closest('a')).toBeNull();
    });

    it('P19.14-T4 AC-1 no pill on a lead with an empty draft only, or with no proposal', async () => {
      render();
      for (const name of ['Ibu Maya Lestari', 'Ibu Wulan Sari']) {
        expect((await cardOf(name)).querySelector('[data-lead-proposal]')).toBeNull();
      }
    });

    it('P19.14-T4 AC-1 Buat proposal on every Sales card of the reader’s own, named and tipped, with this lead chosen', async () => {
      render();
      for (const [name, id] of [['Ibu Rosa Damayanti', 'l1'], ['Ibu Wulan Sari', 'l3'], ['Ibu Maya Lestari', 'l4']]) {
        const link = within(await cardOf(name)).getByRole('link', { name: `Make a proposal for ${name}` });
        expect(link).toHaveAttribute('href', `/proposal/new?leadId=${id}`);
        expect(link).toHaveAttribute('title', 'Make a proposal');
      }
      // Not on a Recruit lead.
      expect((await cardOf('Mas Andi')).querySelector('[data-make-proposal]')).toBeNull();
    });

    it('P19.14-T4 AC-1 WhatsApp keeps its right-aligned place, Buat proposal just before it', async () => {
      render();
      const card = await cardOf('Ibu Rosa Damayanti');
      expect(card.lastElementChild!.querySelector('[data-channel="whatsapp"]')).not.toBeNull();
      expect(card.querySelector('[data-make-proposal]')!.nextElementSibling).toBe(card.lastElementChild);
    });

    it('P19.14-T4 AC-1 nothing on a downline’s lead: no pill, no Buat proposal (decision 4)', async () => {
      render();
      const card = await cardOf('Ibu Sinta Dewi');
      expect(card.querySelector('[data-make-proposal]')).toBeNull();
      expect(card.querySelector('[data-lead-proposal]')).toBeNull();
    });

    it('P19.14-T4 AC-1 no pill for a reader without proposal:read, no Buat proposal without proposal:create', async () => {
      atWidth(360);
      stubFetch(BASE as Parameters<typeof stubFetch>[0]);
      const noRead = { ...AGENT, permissions: AGENT.permissions.filter((p) => p !== 'proposal:read' && p !== 'proposal:create') };
      renderInLayout(AgentLayout, <LeadsPage />, { me: noRead });
      const card = await cardOf('Ibu Rosa Damayanti');
      expect(card.querySelector('[data-lead-proposal]')).toBeNull();
      expect(card.querySelector('[data-make-proposal]')).toBeNull();
    });

    it('P19.11-T3 AC-3 a small muted › between the type and the stage, hidden from a screen reader, and wrapping with the stage', async () => {
      render();
      const card = await cardOf('Ibu Rosa Damayanti');
      const separator = card.querySelector('[data-pill-separator]')!;
      expect(separator).toHaveTextContent('›');
      expect(separator).toHaveAttribute('aria-hidden', 'true');
      expect(separator).toHaveClass('text-xs', 'text-muted');
      // One unit with the stage pill, so a wrap takes both to the next line together.
      const stage = separator.closest('[data-lead-stage]')!;
      expect(stage).toHaveClass('inline-flex');
      expect(stage).toHaveTextContent('›Follow-up');
      expect(stage.parentElement).toHaveClass('flex-wrap');
    });

    it('P19.11-T3 AC-3 no › on a card with one tag', async () => {
      render({ 'outcome=open': { body: page([lead({ id: 'l7', name: 'Pak Salim', type: null, statusCode: null })]) } });
      const card = await cardOf('Pak Salim');
      expect(card).toHaveTextContent('No type yet');
      expect(card.querySelector('[data-pill-separator]')).toBeNull();
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
      // The list opens on *Semua* (P19.9-T1 AC-1), which has no stages: *Sales* first.
      await userEvent.click(within(sheet.getByRole('group', { name: 'Type' })).getByRole('button', { name: 'Sales' }));
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

    it('P19.14-T4 AC-3 the Proposal section lists one row per proposal, drafts included: date, products with plan, total, status', async () => {
      const { calls } = render();
      const sheet = await open();
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      const asked = calls.find((c) => /\/proposals\?leadId=l1/.test(c.url))!;
      expect(new URL(asked.url).searchParams.get('status')).toBeNull();
      const rows = await within(section).findAllByRole('link').then((links) => links.filter((a) => a.hasAttribute('data-proposal-row')));
      // A draft opens at its products; a finished one at its PDF.
      expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/proposal/p2?step=2', '/proposal/p1?step=pdf']);
      expect(rows[1]).toHaveTextContent('PRUWell Medical · Gold, PRUCinta');
      expect(rows[1]).toHaveTextContent('5 Nov');
      // Each currency and Cara bayar on its own, never added (ADR-0255 §7).
      expect(rows[1]).toHaveTextContent(/IDR 1,250,000 monthly · USD 125\.00 annually/);
      expect(within(rows[1]).getByText('Done')).toHaveAttribute('data-tone', 'green');
      expect(within(rows[0]).getByText('Draft')).toHaveAttribute('data-tone', 'grey');
      // Above Riwayat.
      const history = sheet.getByRole('heading', { name: 'History' }).closest('section')!;
      expect(section.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('P19.14-T4 AC-3 + Buat proposal stays below the rows, with this lead chosen', async () => {
      render();
      const sheet = await open();
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      const row = await within(section).findByRole('link', { name: /PRUWell Medical/ });
      const button = within(section).getByRole('link', { name: 'Make a proposal' });
      expect(button).toHaveAttribute('href', '/proposal/new?leadId=l1');
      expect(row.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(button).toHaveClass('mt-2');
    });

    it('P19.14-T4 AC-3 with no proposal the section is Buat proposal alone, a label’s gap under its heading', async () => {
      render({ '/leads/l3': { body: { ...WULAN, history: [] } }, '/proposals?leadId=l3': { body: { rows: [], total: 0, page: 1, pageSize: 50 } } });
      const sheet = await open('Ibu Wulan Sari');
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      await waitFor(() => expect(within(section).queryByText('Loading the proposals…')).not.toBeInTheDocument());
      expect(section.querySelector('[data-proposal-row]')).toBeNull();
      const button = within(section).getByRole('link', { name: 'Make a proposal' });
      expect(button).toHaveAttribute('href', '/proposal/new?leadId=l3');
      expect(button).not.toHaveClass('mt-2');
    });

    it('P19.7-T2 AC-11 Riwayat keeps “Proposal dibuat · …”, dated, linked while the proposal exists and plain once deleted', async () => {
      render();
      const sheet = await open();
      const history = (await sheet.findByRole('heading', { name: 'History' })).closest('section')!;
      await within(history).findByText(/Status → Follow-up/);
      const linked = within(history).getByRole('link', { name: 'Proposal made · PRUWell Medical, PRUCinta' });
      expect(linked).toHaveAttribute('href', '/proposal/p1?step=pdf');
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

  it('P19.14-T4 AC-1 AC-3 in Indonesian: Buat proposal, Sudah ada proposal / Belum ada proposal, Draf, Selesai, Proposal dibuat', async () => {
    atWidth(360);
    stubFetch(BASE as Parameters<typeof stubFetch>[0]);
    renderInIndonesian(<AgentLayout><LeadsPage /></AgentLayout>, { me: AGENT });
    const card = await screen.findByRole('button', { name: 'Ibu Rosa Damayanti' });
    expect(screen.getByRole('link', { name: 'Buat proposal untuk Ibu Rosa Damayanti' })).toHaveAttribute('title', 'Buat proposal');
    await userEvent.click(screen.getByRole('button', { name: 'Filter dan urutan' }));
    const filters = within(await screen.findByRole('dialog', { name: 'Filter dan urutan' }));
    expect(within(filters.getByRole('group', { name: 'Proposal' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Sudah ada proposal', 'Belum ada proposal']);
    await userEvent.click(filters.getByRole('button', { name: 'Tampilkan leads' }));
    await userEvent.click(card);
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Rosa Damayanti' }));
    await sheet.findByRole('heading', { name: 'Proposal' });
    expect(await sheet.findByText('Selesai')).toBeInTheDocument();
    expect(sheet.getByText('Draf')).toBeInTheDocument();
    expect(sheet.getByText(/bulanan/)).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Buat proposal' })).toBeInTheDocument();
    expect(await sheet.findByRole('link', { name: 'Proposal dibuat · PRUWell Medical, PRUCinta' })).toBeInTheDocument();
  });
});
