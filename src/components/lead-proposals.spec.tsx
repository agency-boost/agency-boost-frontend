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
 * *Changed by P19.11-T3 (UX-9, UX-11; UXQ3):* the card's pill went (AC-2) and its icon now shows only on a lead with a
 * finished proposal, opening the latest one (AC-1), with a *›* between the type and the stage (AC-3); the sheet's
 * section shows the latest finished proposal alone, *Buat proposal* below it (AC-7).
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

/** A finished proposal (`p1`) and a draft: the card's icon opens `p1` (P19.11-T3 AC-1). */
const ROSA = lead({ proposals: { count: 2, latest: { products: ['PRUWell Medical', 'PRUCinta'] }, done: 1, latestDone: { id: 'p1' } } });
/** Drafts only, one with a product: no icon. */
const HENDRO = lead({ id: 'l2', name: 'Pak Hendro Gunawan', proposals: { count: 1, latest: { products: ['PRULady'] }, done: 0, latestDone: null } });
const WULAN = lead({ id: 'l3', name: 'Ibu Wulan Sari' });
const EMPTY_DRAFT = lead({ id: 'l4', name: 'Ibu Maya Lestari', proposals: { count: 1, latest: { products: [] }, done: 0, latestDone: null } });
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
  // The sheet asks for the latest finished one alone (P19.11-T3 AC-7): `status=done&pageSize=1`.
  '/proposals?leadId=l1': { body: { rows: [ROW], total: 1, page: 1, pageSize: 1 } },
  '/proposals?leadId=l2': { body: { rows: [], total: 0, page: 1, pageSize: 1 } },
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
    it('P19.11-T3 AC-1 a lead with a finished proposal wears the icon: a named, tipped link to the latest finished one at step 3', async () => {
      render();
      const card = await cardOf('Ibu Rosa Damayanti');
      const link = within(card).getByRole('link', { name: 'Open the proposal for Ibu Rosa Damayanti' });
      expect(link).toHaveAttribute('href', '/proposal/p1?step=3');
      expect(link).toHaveAttribute('title', 'Open the proposal');
      expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    });

    it('P19.11-T3 AC-1 no icon on a lead with drafts only, an empty draft, or no proposal: drafts never count', async () => {
      render();
      for (const name of ['Pak Hendro Gunawan', 'Ibu Maya Lestari', 'Ibu Wulan Sari']) {
        const card = await cardOf(name);
        expect(within(card).queryByRole('link', { name: /proposal/i })).not.toBeInTheDocument();
        expect(card.querySelector('[data-open-proposal]')).toBeNull();
      }
    });

    it('P19.11-T3 AC-1 WhatsApp keeps its right-aligned place with the icon and without it', async () => {
      render();
      const withIcon = await cardOf('Ibu Rosa Damayanti');
      const without = await cardOf('Ibu Wulan Sari');
      for (const card of [withIcon, without]) {
        // The card's last control, at its right edge, either way.
        expect(card.lastElementChild!.querySelector('[data-channel="whatsapp"]')).not.toBeNull();
      }
      // The icon stands just before it, never after.
      expect(withIcon.querySelector('[data-open-proposal]')!.nextElementSibling).toBe(withIcon.lastElementChild);
    });

    it('P19.11-T3 AC-2 no proposal or product chip on any card, and no space kept for one', async () => {
      render();
      const cards = within(await list()).getAllByRole('listitem');
      for (const card of cards) {
        expect(card.querySelector('[data-proposal-pill]')).toBeNull();
        expect(card).not.toHaveTextContent(/PRUWell Medical|PRULady|PRUCinta/);
      }
      // The line under the name holds the type, the stage and nothing else.
      const line = (await cardOf('Ibu Rosa Damayanti')).querySelector('[data-lead-stage]')!.parentElement!;
      expect([...line.children].map((child) => child.textContent)).toEqual(['Sales', '›Follow-up']);
    });

    it('P19.11-T3 AC-1 nothing on a downline’s lead: the server sends no proposals there (decision 4)', async () => {
      render();
      const card = await cardOf('Ibu Sinta Dewi');
      expect(card.querySelector('[data-open-proposal]')).toBeNull();
      expect(card.querySelector('[data-proposal-pill]')).toBeNull();
    });

    it('P19.11-T3 AC-1 no icon for a reader without proposal:read', async () => {
      atWidth(360);
      stubFetch(BASE as Parameters<typeof stubFetch>[0]);
      const noRead = { ...AGENT, permissions: AGENT.permissions.filter((p) => p !== 'proposal:read') };
      renderInLayout(AgentLayout, <LeadsPage />, { me: noRead });
      expect((await cardOf('Ibu Rosa Damayanti')).querySelector('[data-open-proposal]')).toBeNull();
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

    it('P19.11-T3 AC-7 the Proposal section asks for the latest finished proposal alone, and shows that one: date, products, premium, Selesai', async () => {
      const { calls } = render();
      const sheet = await open();
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      const asked = calls.find((c) => /\/proposals\?leadId=l1/.test(c.url))!;
      expect(new URL(asked.url).searchParams.get('status')).toBe('done');
      expect(new URL(asked.url).searchParams.get('pageSize')).toBe('1');
      const rows = await within(section).findAllByRole('link').then((links) => links.filter((a) => a.hasAttribute('data-proposal-row')));
      expect(rows.map((a) => a.getAttribute('href'))).toEqual(['/proposal/p1?step=3']);
      expect(rows[0]).toHaveTextContent('PRUWell Medical · Gold, PRUCinta');
      expect(rows[0]).toHaveTextContent('5 Nov');
      // Each currency on its own, never added: IDR 1.250.000 and USD 125,00 (ADR-0223 §8).
      expect(rows[0]).toHaveTextContent(/IDR 1,250,000 · USD 125\.00/);
      expect(within(rows[0]).getByText('Done')).toHaveAttribute('data-tone', 'green');
      // Never a draft.
      expect(within(section).queryByText('Draft')).not.toBeInTheDocument();
      // Above Riwayat.
      const history = sheet.getByRole('heading', { name: 'History' }).closest('section')!;
      expect(section.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('P19.11-T3 AC-7 + Buat proposal stays below the finished proposal, with this lead chosen', async () => {
      render();
      const sheet = await open();
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      const row = await within(section).findByRole('link', { name: /PRUWell Medical/ });
      const button = within(section).getByRole('link', { name: 'Make a proposal' });
      expect(button).toHaveAttribute('href', '/proposal/new?leadId=l1');
      expect(row.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(button).toHaveClass('mt-2');
    });

    it('P19.11-T3 AC-7 with nothing finished — drafts only — the section is Buat proposal alone, a label’s gap under its heading', async () => {
      const { calls } = render();
      const sheet = await open('Pak Hendro Gunawan');
      const section = (await sheet.findByRole('heading', { name: 'Proposal' })).closest('section')!;
      await waitFor(() => expect(within(section).queryByText('Loading the proposals…')).not.toBeInTheDocument());
      expect(calls.some((c) => /\/proposals\?leadId=l2&status=done/.test(c.url))).toBe(true);
      expect(section.querySelector('[data-proposal-row]')).toBeNull();
      const button = within(section).getByRole('link', { name: 'Make a proposal' });
      expect(button).toHaveAttribute('href', '/proposal/new?leadId=l2');
      expect(button).not.toHaveClass('mt-2');
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

  it('P19.11-T3 AC-1 AC-7 in Indonesian: Buka proposal, Sudah ada proposal / Belum ada proposal, Buat proposal, Selesai, Proposal dibuat', async () => {
    atWidth(360);
    stubFetch(BASE as Parameters<typeof stubFetch>[0]);
    renderInIndonesian(<AgentLayout><LeadsPage /></AgentLayout>, { me: AGENT });
    const card = await screen.findByRole('button', { name: 'Ibu Rosa Damayanti' });
    expect(screen.getByRole('link', { name: 'Buka proposal Ibu Rosa Damayanti' })).toHaveAttribute('title', 'Buka proposal');
    await userEvent.click(screen.getByRole('button', { name: 'Filter dan urutan' }));
    const filters = within(await screen.findByRole('dialog', { name: 'Filter dan urutan' }));
    expect(within(filters.getByRole('group', { name: 'Proposal' })).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['Sudah ada proposal', 'Belum ada proposal']);
    await userEvent.click(filters.getByRole('button', { name: 'Tampilkan leads' }));
    await userEvent.click(card);
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Rosa Damayanti' }));
    await sheet.findByRole('heading', { name: 'Proposal' });
    expect(await sheet.findByText('Selesai')).toBeInTheDocument();
    expect(sheet.queryByText('Draf')).not.toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Buat proposal' })).toBeInTheDocument();
    expect(await sheet.findByRole('link', { name: 'Proposal dibuat · PRUWell Medical, PRUCinta' })).toBeInTheDocument();
  });
});
