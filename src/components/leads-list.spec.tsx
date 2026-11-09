import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import LeadsPage from '@/app/(agent)/leads/page';
import { LeadSheet } from '@/components/lead-sheet';
import { atWidth, makeMe, renderInLayout, stubFetch } from '@test/harness';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import type { Lead } from '@/lib/leads';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

/**
 * **`/leads` below 1024px — UI V1, UI-105** (D-10, D-18, D-19): the compact list, the pipeline strip and the lead sheet.
 * Each *Done when* is a test named with the ticket: *cards fit at 360 with only the WhatsApp button; overdue and missing
 * next actions show in red* · *the sheet switches type and stages; Hapus asks to confirm; remark shows only in the sheet*.
 */
const AGENT = makeMe({
  membership: {
    membershipId: 'mem-1', kpmId: 'kpm-1', orgLevelCode: 'AB', hierarchyRole: 'ab',
    status: 'active', isKpmOwner: false, isKpmAdmin: false, directCount: 0,
  },
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
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
      stage('sales', 'POLICY_SUBMITTED', 'Policy submitted', 3, { isLateStage: true }),
      stage('sales', 'APPROVED_NOT_PAID', 'Approved, not paid', 4, { isLateStage: true }),
      stage('sales', 'PAID_AND_ISSUED', 'Paid and issued', 5, { isTerminal: true }),
    ],
  },
  {
    pipeline: 'recruitment',
    statuses: [
      stage('recruitment', 'NOT_APPROACHED', 'Not yet approached', 1),
      stage('recruitment', 'MEETING_SCHEDULED', 'Meeting scheduled', 2),
      stage('recruitment', 'NEW_ACTIVE_AGENT', 'New active agent', 3, { isTerminal: true }),
    ],
  },
];

const TODAY = dayInZone(OFFICE_TIME_ZONE, new Date());

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1', ownerMembershipId: 'mem-1', type: 'sales', name: 'Ibu Sekar Arum', contact: { phone: null, email: null },
  statusCode: 'FOLLOW_UP', thisMonth: false, committedMonths: [], lastEditedBy: null,
  remarks: 'Hot button: the eldest starts university in two years.', nextActionDate: '2099-11-02',
  nextActionNote: 'Meet at her shop after closing.', outcome: null, source: null,
  dateRegistered: '2026-10-20T03:00:00.000Z', version: 2, flags: [], overdueDays: null, ...over,
});

const ROWS = [
  lead(),
  lead({ id: 'l2', name: 'Ibu Eka Wulandari', statusCode: 'NOT_YET_APPROACHED', nextActionDate: '2026-10-25',
    nextActionNote: 'Call back — she asked for Monday.', flags: ['overdue'], overdueDays: 5 }),
  lead({ id: 'l3', name: 'Ibu Melati Kusumawardani', statusCode: 'POLICY_SUBMITTED', nextActionDate: TODAY,
    nextActionNote: 'Collect the signed SPAJ.' }),
  lead({ id: 'l4', name: 'Ibu Yuliana Tanjung', statusCode: 'NOT_YET_APPROACHED', nextActionDate: null,
    nextActionNote: null, flags: ['no-next-action'] }),
  lead({ id: 'l5', name: 'Mas Andi', type: 'recruitment', statusCode: 'MEETING_SCHEDULED', contact: { phone: '0812-1100-2200', email: null } }),
];

const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const BASE = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
  'outcome=won': { body: page([]) },
  'outcome=lost': { body: page([]) },
  'outcome=open': { body: page(ROWS) },
  '/leads/l1': { body: { ...ROWS[0], history: [
    { at: '2026-10-27T03:00:00.000Z', fromStatusCode: null, toStatusCode: 'FOLLOW_UP' },
  ] } },
};

const render = (routes: Record<string, unknown> = {}, width = 360) => {
  atWidth(width);
  const stub = stubFetch({ ...BASE, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return stub;
};

const list = () => screen.findByRole('list', { name: 'Your leads' });
/** *Sales*: the list opens on *Semua* since P19.9-T1 AC-1 (ADR-0232), so a test about the strip chooses it first. */
const chooseSales = () => userEvent.click(within(screen.getByRole('group', { name: 'Lead type' })).getByRole('button', { name: /^Sales, / }));
/** The question a destructive act asks first (`Dialog`): the newest dialog on the page. */
const question = async () => {
  const asked = () => screen.getAllByRole('dialog').find((d) => !d.querySelector('[data-modal-head]'));
  await waitFor(() => expect(asked()).toBeDefined());
  return asked()!;
};
const cardOf = async (name: string) => within(await list()).getByRole('button', { name }).closest('li')!;
const writes = (calls: { url: string; init: RequestInit }[]) => calls
  .filter((c) => c.init.method && c.init.method !== 'GET')
  .map((c) => `${c.init.method} ${new URL(c.url).pathname.replace('/api/v1', '')} ${String(c.init.body ?? '')}`);

describe('UI-105 — /leads on a phone and a tablet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-105 titles the row Leads, with a search pill and a round filter button, and no native select', async () => {
    render();
    await list();
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search lead names' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter and sort' })).toHaveClass('h-11', 'w-11', 'rounded-full');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // No *67 leads aktif* line of its own: the chips carry the counts.
    expect(screen.queryByText(/active leads?$/)).not.toBeInTheDocument();
  });

  // *Changed 2026-11-08 (P19.9-T1 AC-1, R1 and R9; ADR-0232):* it opened on *Sales* where the reader had a Sales lead.
  it('P19.9-T1 AC-1 UI-105 counts the chips — All 5 · Sales 4 · Recruit 1 — and opens on All, always; Sales draws the strip counting every Sales lead', async () => {
    render();
    await list();
    const chips = screen.getByRole('group', { name: 'Lead type' });
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['All5', 'Sales4', 'Recruit1']);
    expect(within(chips).getByRole('button', { name: 'All, 5 leads' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(chips).getByRole('button', { name: 'Sales, 4 leads' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('5 leads · all')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /pipeline/ })).not.toBeInTheDocument();
    await chooseSales();
    const strip = screen.getByRole('group', { name: 'Sales pipeline' });
    expect(strip).toHaveClass('bg-secondary');
    // The report's short words for the seeded stages, by code.
    expect(within(strip).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['2Not yet', '1Follow-up', '1SPAJ', '0Unpaid', '0Closing']);
    expect(screen.getByText('4 leads · Sales')).toBeInTheDocument();
  });

  it('UI-105 filters the list from a stage of the strip, and a second tap clears it; the strip follows the type chip', async () => {
    render();
    await list();
    await chooseSales();
    const strip = screen.getByRole('group', { name: 'Sales pipeline' });
    await userEvent.click(within(strip).getByRole('button', { name: /^Not yet/ }));
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(2);
    expect(within(strip).getByRole('button', { name: /^Not yet/ })).toHaveAttribute('aria-pressed', 'true');
    // The filter button says a filter is on.
    expect(screen.getByRole('button', { name: 'Filter and sort, a filter is on' })).toBeInTheDocument();
    await userEvent.click(within(strip).getByRole('button', { name: /^Not yet/ }));
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(4);

    await userEvent.click(screen.getByRole('button', { name: 'Recruit, 1 lead' }));
    const recruit = screen.getByRole('group', { name: 'Recruit pipeline' });
    expect(within(recruit).getAllByRole('button').map((b) => b.textContent)).toEqual(['0Not yet', '1Meeting', '0Active']);
    await userEvent.click(screen.getByRole('button', { name: 'All, 5 leads' }));
    expect(screen.queryByRole('group', { name: /pipeline/ })).not.toBeInTheDocument();
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(5);
  });

  it('UI-105 searches the names it holds, whatever their order or case', async () => {
    render();
    await list();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search lead names' }), 'arum sekar');
    expect(within(await list()).getAllByRole('listitem').map((li) => li.querySelector('button')!.textContent)).toEqual(['Ibu Sekar Arum']);
  });

  it('UI-105 Done when: cards fit at 360 with only the WhatsApp button; overdue and missing next actions show in red', async () => {
    render();
    const sekar = await cardOf('Ibu Sekar Arum');
    // Only WhatsApp: no Call, no ⋯, no remark, no row number, no handle.
    expect(within(sekar).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent))
      .toEqual(['Ibu Sekar Arum', 'Send a WhatsApp message to Ibu Sekar Arum']);
    expect(within(sekar).queryByRole('link', { name: /Call/ })).not.toBeInTheDocument();
    expect(sekar).not.toHaveTextContent('Hot button');
    // The NAME in capitals, cut rather than wrapped; the stage in the app's words, as a tinted pill.
    expect(within(sekar).getByRole('button', { name: 'Ibu Sekar Arum' })).toHaveClass('uppercase', 'truncate');
    expect(within(sekar).getByText('Follow-up').closest('[data-tone]')).toHaveAttribute('data-tone', 'blue');
    expect(sekar.querySelector('[data-next-action]')).toHaveTextContent('2 Nov 2099Meet at her shop after closing.');

    const late = (await cardOf('Ibu Eka Wulandari')).querySelector('[data-next-action]')!;
    expect(late).toHaveAttribute('data-next-action', 'overdue');
    expect(late).toHaveClass('text-signal-red');
    expect(late).toHaveTextContent('25 Oct, overdueCall back — she asked for Monday.');
    const today = (await cardOf('Ibu Melati Kusumawardani')).querySelector('[data-next-action]')!;
    expect(today).toHaveTextContent('TodayCollect the signed SPAJ.');
    expect(today).not.toHaveClass('text-signal-red');
    const missing = (await cardOf('Ibu Yuliana Tanjung')).querySelector('[data-next-action]')!;
    expect(missing).toHaveTextContent('Add an action');
    expect(missing).toHaveClass('text-signal-red');
  });

  it('UI-105 opens the lead sheet from anywhere on the card but WhatsApp, the name stretched over the card', async () => {
    render();
    const sekar = await cardOf('Ibu Sekar Arum');
    const open = within(sekar).getByRole('button', { name: 'Ibu Sekar Arum' });
    expect(open.className).toContain('after:inset-0');
    expect(sekar).toHaveClass('relative');
    expect(sekar.querySelector('[data-contact-buttons]')).toHaveClass('relative', 'z-[1]');
    await userEvent.click(open);
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    expect(dialog).toHaveAccessibleDescription('Follow-up · Sales');
  });

  it('UI-105 Done when: the sheet switches type and stages, the first preselected; the remark shows only in the sheet', async () => {
    const { calls } = render({
      'PATCH /leads/l1/status': { body: lead({ type: 'recruitment', statusCode: 'NOT_APPROACHED', version: 4 }) },
      'PATCH /leads/l1': { body: lead({ type: 'recruitment', statusCode: null, version: 3 }) },
    });
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' }));
    expect(sheet.getByLabelText('Remarks')).toHaveValue('Hot button: the eldest starts university in two years.');
    expect(sheet.getByRole('radio', { name: 'Sales' })).toHaveAttribute('aria-checked', 'true');
    expect(sheet.getAllByRole('radio').filter((r) => r.getAttribute('type') === 'radio').map((r) => r.closest('label')!.textContent))
      .toEqual(['Not yet approached', 'Follow-up', 'Policy submitted', 'Approved, not paid', 'Paid and issued']);
    expect(sheet.getByRole('radio', { name: 'Follow-up' })).toBeChecked();
    expect(sheet.getByText('Saved ✓')).toBeInTheDocument();

    await userEvent.click(sheet.getByRole('radio', { name: 'Recruit' }));
    expect(sheet.getAllByRole('radio').filter((r) => r.getAttribute('type') === 'radio').map((r) => r.closest('label')!.textContent))
      .toEqual(['Not yet approached', 'Meeting scheduled', 'New active agent']);
    expect(sheet.getByRole('radio', { name: 'Not yet approached' })).toBeChecked();
    expect(sheet.getByText('Not saved yet')).toBeInTheDocument();
    // P19.1-T2 AC-5: the Potensi switch, labelled by the type just chosen (UI-153 item 1).
    expect(sheet.getByRole('switch', { name: 'Potential recruit this month' })).toBeInTheDocument();

    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // The type first, which clears the stage; then the stage chosen, each at the version the last answered.
    expect(writes(calls)).toEqual([
      'PATCH /leads/l1 {"type":"recruitment","version":2}',
      'PATCH /leads/l1/status {"statusCode":"NOT_APPROACHED","version":3}',
    ]);
  });

  it('UI-105 Done when: Hapus asks to confirm, white with red words left of Simpan, and the lead leaves the list', async () => {
    const { calls } = render({ 'DELETE /leads/l1': { body: { id: 'l1', deletedAt: '2026-10-30T03:00:00.000Z' } } });
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    const foot = dialog.querySelector('[data-modal-foot]') as HTMLElement;
    const buttons = within(foot).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Delete', 'Save']);
    expect(buttons[0]).toHaveClass('bg-card', 'text-pill-red-ink');
    await userEvent.click(buttons[0]);
    expect(writes(calls)).toEqual([]);
    const ask = await question();
    expect(ask).toHaveTextContent('Delete Ibu Sekar Arum? It leaves your leads.');
    await userEvent.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(writes(calls)).toEqual(['DELETE /leads/l1 ']));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Your leads' })).queryByRole('button', { name: 'Ibu Sekar Arum' })).not.toBeInTheDocument());
  });

  it('UI-105 shows the lead’s history from its own read, newest first, and the day it was added', async () => {
    render();
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    const history = within(dialog).getByRole('heading', { name: 'History' }).parentElement!;
    await waitFor(() => expect(within(history).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['27 Oct · Status → Follow-up', '20 Oct · Lead added']));
  });

  it('UI-105 saves the next action and the remark in one patch, pinned', async () => {
    const { calls } = render({ 'PATCH /leads/l1': { body: lead({ remarks: 'Two kids.', version: 3 }) } });
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' }));
    expect(sheet.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(sheet.getByLabelText('Remarks'));
    await userEvent.type(sheet.getByLabelText('Remarks'), 'Two kids.');
    await userEvent.clear(sheet.getByLabelText('Next action note'));
    await userEvent.type(sheet.getByLabelText('Next action note'), 'Coffee');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual([
      'PATCH /leads/l1 {"remarks":"Two kids.","nextActionNote":"Coffee","version":2}',
    ]));
  });

  it('UI-105 asks before closing a sheet with unsaved changes', async () => {
    render();
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    await userEvent.type(within(dialog).getByLabelText('Remarks'), '!');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    const ask = await question();
    expect(ask).toHaveTextContent('You have changes that are not saved yet. Close without saving?');
    await userEvent.click(within(ask).getByRole('button', { name: 'Close without saving' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('UI-105 adds a lead from the floating + above the tab bar: a name, then Save creates it and sets its stage', async () => {
    const created = lead({ id: 'l9', name: 'Pak Joko', statusCode: null, version: 1 });
    const { calls } = render({
      'POST /leads': { body: created },
      'PATCH /leads/l9/status': { body: { ...created, statusCode: 'NOT_YET_APPROACHED', version: 2 } },
    });
    await list();
    const add = screen.getByRole('button', { name: 'Add lead' });
    expect(add).toHaveClass('fixed', 'bottom-[calc(var(--tab-bar-space)+1rem)]', 'bg-primary', 'text-primary-contrast');
    await userEvent.click(add);
    const sheet = within(await screen.findByRole('dialog', { name: 'New lead' }));
    expect(sheet.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    expect(sheet.getByText('A lead’s name must be at least 2 characters.')).toBeInTheDocument();
    await userEvent.type(sheet.getByLabelText('Name'), 'Pak Joko');
    await userEvent.click(sheet.getByRole('radio', { name: 'Sales' }));
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(writes(calls)[0]).toMatch(/^POST \/leads \{"name":"Pak Joko","type":"sales",/);
    expect(writes(calls)[1]).toBe('PATCH /leads/l9/status {"statusCode":"NOT_YET_APPROACHED","version":1}');
    expect(await within(await list()).findByRole('button', { name: 'Pak Joko' })).toBeInTheDocument();
  });

  it('UI-105 marks a lead not successful from the sheet, asking first, and it leaves the open list', async () => {
    const { calls } = render({ 'PATCH /leads/l1/outcome': { body: lead({ outcome: 'lost', version: 3 }) } });
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' }));
    // P19.1-T2 AC-9 (UI-160): both buttons always; *Mark successful* held below the final stage, saying why.
    expect(sheet.getByRole('button', { name: 'Mark successful' })).toBeDisabled();
    expect(sheet.getByRole('button', { name: 'Mark successful' })).toHaveAccessibleDescription('Active after status Paid and issued');
    await userEvent.click(sheet.getByRole('button', { name: 'Mark not successful' }));
    await userEvent.click(within(await question()).getByRole('button', { name: 'Mark not successful' }));
    await waitFor(() => expect(writes(calls)).toEqual(['PATCH /leads/l1/outcome {"outcome":"lost","version":2}']));
  });

  it('UI-105 offers no Delete on a downline’s lead: lead:delete is the owner’s', async () => {
    const theirs = lead({ ownerMembershipId: 'mem-7' });
    render({ 'outcome=open': { body: page([theirs]) }, '/leads/l1': { body: { ...theirs, history: [] } } });
    await userEvent.click(within(await cardOf('Ibu Sekar Arum')).getByRole('button', { name: 'Ibu Sekar Arum' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('UI-105 orders from the filter sheet through the server’s sort, and Clear goes back to the saved order', async () => {
    const { calls } = render();
    await list();
    await userEvent.click(screen.getByRole('button', { name: 'Filter and sort' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Filter and sort' }));
    // *Proposal* since P19.7-T2 AC-12: *Has a proposal / No proposal yet*, before the order.
    // *Whose leads* first since P19.9-T1 AC-3, for an AB; no *Status* under *All*, where the list opens (AC-1).
    expect(sheet.getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Whose leads', 'Type', 'Proposal', 'Order']);
    await userEvent.click(sheet.getByRole('button', { name: 'Name A–Z' }));
    await waitFor(() => expect(calls.some((c) => /outcome=open/.test(c.url) && /sort=name&dir=asc/.test(c.url))).toBe(true));
    expect(screen.getByText('Name A–Z', { selector: 'span' })).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Saved order', { selector: 'span' })).toBeInTheDocument();
  });

  // *Changed 2026-11-05 (P19.1-T2 AC-1, UI-116):* the desktop no longer keeps the table — the same list, beside the pane.
  it('UI-105 draws the same list on a tablet, and a desktop draws it too, beside the pane (UI-116)', async () => {
    render({}, 800);
    expect(await list()).toBeInTheDocument();
    await chooseSales();
    expect(screen.getByRole('group', { name: 'Sales pipeline' })).toBeInTheDocument();
    cleanup();
    vi.unstubAllGlobals();

    render({}, 1280);
    expect(await list()).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await chooseSales();
    expect(screen.getByRole('group', { name: 'Sales pipeline' })).toBeInTheDocument();
    // *Leads* at every size since P19.1-T1 AC-1 (UI-112: each page's title is its phone title).
    expect(screen.getByRole('heading', { level: 1, name: 'Leads' })).toBeInTheDocument();
  });
});

/**
 * **P19.9-T1 — *Leads milik: Saya · Tim*** (R9, R10; ADR-0232; OD-286 by its default): every reader opens on their own
 * leads, the open list and both closed ones; a reader whose grant reaches further is offered *Tim* in the filter sheet,
 * which counts as a filter on; a card that is not the reader's says whose it is.
 */
describe('P19.9-T1 — whose leads /leads shows', () => {
  afterEach(() => vi.unstubAllGlobals());

  const asked = (calls: { url: string }[], outcome: string) => calls
    .filter((c) => new URL(c.url).pathname.endsWith('/leads') && c.url.includes(`outcome=${outcome}`))
    .map((c) => new URL(c.url).searchParams.get('scope'));
  const filters = async () => {
    await userEvent.click(screen.getByRole('button', { name: /^Filter and sort/ }));
    return within(await screen.findByRole('dialog', { name: 'Filter and sort' }));
  };

  it('P19.9-T1 AC-2 asks for the reader’s own leads, open, won and lost — scope=own, never the team’s by default', async () => {
    const { calls } = render();
    await list();
    await waitFor(() => expect(asked(calls, 'lost')).not.toHaveLength(0));
    for (const outcome of ['open', 'won', 'lost']) expect(asked(calls, outcome)).toEqual(['own']);
  });

  it('P19.9-T1 AC-3 Whose leads: Mine pressed; Team asks again for scope=team, marks the filter on and drops the proposal filter; Clear goes back to Mine', async () => {
    const { calls } = render();
    await list();
    const sheet = await filters();
    const owners = within(sheet.getByRole('group', { name: 'Whose leads' }));
    expect(owners.getAllByRole('button').map((b) => b.textContent)).toEqual(['Mine', 'Team']);
    expect(owners.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(sheet.getByRole('button', { name: 'Has a proposal' }));
    await userEvent.click(owners.getByRole('button', { name: 'Team' }));
    expect(owners.getByRole('button', { name: 'Team' })).toHaveAttribute('aria-pressed', 'true');
    for (const outcome of ['open', 'won', 'lost']) await waitFor(() => expect(asked(calls, outcome)).toContain('team'));
    // A proposal is its owner's alone: the group goes, and the team's list is not asked for one.
    expect(sheet.queryByRole('group', { name: 'Proposal' })).not.toBeInTheDocument();
    const team = calls.filter((c) => /scope=team/.test(c.url) && /outcome=open/.test(c.url));
    expect(team.every((c) => !/hasProposal/.test(c.url))).toBe(true);
    expect(screen.getByRole('button', { name: 'Filter and sort, a filter is on' })).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Clear' }));
    expect(owners.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(asked(calls, 'open').at(-1)).toBe('own'));
    expect(screen.getByRole('button', { name: 'Filter and sort' })).toBeInTheDocument();
  });

  it('P19.9-T1 AC-3 an Agent who leads nobody is not offered Team; an Agent who leads somebody is (ADR-0234)', async () => {
    const agent = (directCount: number) => makeMe({
      membership: { ...AGENT.membership!, orgLevelCode: 'AGENT', hierarchyRole: 'agent', directCount },
      permissions: AGENT.permissions,
    });
    for (const [me, offered] of [[agent(0), false], [agent(2), true]] as const) {
      atWidth(360);
      stubFetch(BASE as Parameters<typeof stubFetch>[0]);
      renderInLayout(AgentLayout, <LeadsPage />, { me });
      await list();
      const sheet = await filters();
      expect({ offered, group: sheet.queryByRole('group', { name: 'Whose leads' }) !== null }).toEqual({ offered, group: offered });
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('P19.9-T1 AC-4 a card that is not the reader’s says whose it is, on its pill line; the reader’s own says nothing', async () => {
    const rina = lead({ id: 'l9', name: 'Pak Joko', ownerMembershipId: 'mem-rina', owner: { membershipId: 'mem-rina', name: 'Rina Wijaya' } });
    const mine = lead({ owner: { membershipId: 'mem-1', name: 'Agus Salim' } });
    render({ 'outcome=open': { body: page([mine, rina]) } });
    const joko = await cardOf('Pak Joko');
    const owner = joko.querySelector('[data-lead-owner]')!;
    expect(owner).toHaveTextContent('Rina Wijaya’s');
    expect(owner).toHaveClass('text-xs', 'text-muted', 'truncate');
    // On the line the card already has, after the pills — no new line, no pill.
    expect(owner.parentElement!.querySelector('[data-tone]')).not.toBeNull();
    expect((await cardOf('Ibu Sekar Arum')).querySelector('[data-lead-owner]')).toBeNull();
  });
});

describe('UI-105 — the lead sheet on its own, as the coaching session opens it', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('UI-105 reads only, under a finalized session’s lock: no Save, no Delete, the fields held', async () => {
    stubFetch({ ...BASE } as Parameters<typeof stubFetch>[0]);
    renderInLayout(AgentLayout, <LeadSheet open lead={ROWS[0]} onClose={() => {}} readOnly />, { me: AGENT });
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Remarks')).toBeDisabled();
  });

  it('UI-105, UI-062 opens on Tindakan berikutnya with focus="nextAction" — Isi tindakan writes the action there', async () => {
    stubFetch({ ...BASE } as Parameters<typeof stubFetch>[0]);
    const bare = lead({ nextActionDate: null, nextActionNote: null });
    renderInLayout(AgentLayout, <LeadSheet open lead={bare} onClose={() => {}} focus="nextAction" />, { me: AGENT });
    const dialog = await screen.findByRole('dialog', { name: 'Ibu Sekar Arum' });
    await waitFor(() => expect(within(dialog).getByLabelText('Next action note')).toHaveFocus());
  });
});
