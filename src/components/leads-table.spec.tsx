import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import { LeadsTable } from './leads-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/coaching',
}));

const lead = (over: Record<string, unknown> = {}) => ({
  id: 'l1', ownerMembershipId: 'mem-7', type: 'sales', name: 'Pak Budi',
  contact: { phone: null, email: null }, statusCode: null,
  thisMonth: false, remarks: null, nextActionDate: null, nextActionNote: null, outcome: null,
  source: null, dateRegistered: '2026-09-04T03:00:00.000Z', version: 1, flags: [],
  overdueDays: null, committedMonths: [], lastEditedBy: null, ...over,
});

const page = (rows: unknown[]) => ({ rows, total: rows.length, page: 1, pageSize: 200 });

const render = (routes: Record<string, unknown>) => {
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: [], version: 1 } },
    '/kpm/org-levels': { body: [] },
    'outcome=won': { body: page([]) },
    'outcome=lost': { body: page([]) },
    ...routes,
  } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsTable filters offerDelete={false} caption="Their leads" />, {
    me: makeMe({ permissions: ['lead:read', 'lead:create', 'lead:update'] }),
  });
  return stub;
};

/** Open a lead's ⋮ and hand back the names of what it offers (P13.1-T4 AC-3). */
async function menuOf(name: string, index = 0) {
  await userEvent.click(screen.getAllByRole('button', { name: `Actions for ${name}` })[index]);
  return screen.getAllByRole('menuitem').map((m) => document.getElementById(m.getAttribute('aria-labelledby')!)?.textContent);
}

const lastRead = (calls: { url: string }[]) => new URL(calls
  .filter((c) => c.url.includes('outcome=open'))
  .at(-1)!.url).searchParams;

/**
 * The coaching card's toolbar (P10.1-T4 AC-12): the same table, with the prototype card's own search
 * box, type filter and *+ Add lead* (`Overall.html:4258-4266`), and no 🗑 (`:10809-10812`). `/leads`
 * never turns either on — its own spec pins that — so this is where the mode P11-T8 mounts is
 * exercised.
 */
describe('LeadsTable, with the coaching card’s toolbar (P10.1-T4 AC-12)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows a search box and a type filter in place of the count', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    expect(screen.getByRole('searchbox', { name: 'Search leads' })).toHaveAttribute('placeholder', 'Search leads…');
    expect(screen.getByLabelText('Filter by type')).toHaveValue('');
    expect(screen.getByRole('button', { name: '+ Add lead' })).toBeInTheDocument();
    expect(screen.queryByText(/active lead/)).not.toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Their leads' })).toBeInTheDocument();
  });

  it('sends the search once the typing settles, and the type as it is chosen', async () => {
    const { calls } = render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.type(screen.getByRole('searchbox'), 'budi');
    await waitFor(() => expect(lastRead(calls).get('search')).toBe('budi'));
    // One read for the word, not one per letter.
    expect(calls.filter((c) => c.url.includes('search=')).length).toBe(1);

    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'recruitment');
    await waitFor(() => expect(lastRead(calls).get('type')).toBe('recruitment'));
    expect(lastRead(calls).get('page')).toBe('1');
  });

  it('says nothing matches — not that there is nothing — once it is narrowed', async () => {
    render({ '/leads': { body: page([]) } });
    expect(await screen.findByText('No leads yet — add your first one above.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'sales');

    expect(await screen.findByText('No leads match.')).toBeInTheDocument();
  });

  it('P13.1-T4 AC-9 offers no delete at all — the coaching card’s rows end in the outcome, and delete is the owner’s', async () => {
    render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-1' })]) } });
    await screen.findByDisplayValue('Bu Rina');

    expect(screen.getAllByRole('button', { name: /^Actions for / })).toHaveLength(2);
    expect(await menuOf('Bu Rina')).toEqual(['Lead details', 'Mark successful', 'Mark not successful']);
  });

  it('adds through the same inline row', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

    expect(screen.getByLabelText('Lead name, row 1')).toHaveFocus();
    expect(screen.getByLabelText('Lead name, row 2')).toHaveValue('Pak Budi');
  });
});

/** Two ladders, so a stage has a label and a final stage gates ✓ (as an office configures them). */
const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      { id: 's1', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 's2', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 2, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
    ],
  },
  { pipeline: 'recruitment', statuses: [] },
];

const renderFor = (
  routes: Record<string, unknown>,
  props: Partial<Parameters<typeof LeadsTable>[0]> = {},
) => {
  const onNotice = vi.fn();
  const onWrite = vi.fn();
  const stub = stubFetch({
    '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
    '/kpm/org-levels': { body: [] },
    'outcome=won': { body: page([lead({ id: 'l-won', name: 'Bu Sari', outcome: 'won' })]) },
    'outcome=lost': { body: page([]) },
    ...routes,
  } as Parameters<typeof stubFetch>[0]);
  renderInLayout(
    AgentLayout,
    <LeadsTable filters offerDelete={false} caption="Her leads" owner="mem-rina" onNotice={onNotice} onWrite={onWrite} {...props} />,
    { me: makeMe({ permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:mark_outcome'] }) },
  );
  return { ...stub, onNotice, onWrite };
};

/**
 * The coaching session's Leads card (P11-T8 AC-7, ADR-0076): the same table about **a coachee's**
 * leads, read and written through `?owner=`, every write pinned, in the coaching card's own words.
 */
describe('LeadsTable, for a coachee (P11-T8 AC-7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P11-T8 AC-7 reads her leads through ?owner= — the open list, its search, and both closed lists', async () => {
    const { calls } = renderFor({ 'outcome=open': { body: page([lead({ ownerMembershipId: 'mem-rina' })]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.type(screen.getByRole('searchbox'), 'budi');
    await waitFor(() => expect(lastRead(calls).get('search')).toBe('budi'));
    const owners = calls.filter((c) => c.url.includes('/leads?')).map((c) => new URL(c.url).searchParams.get('owner'));
    expect(owners.length).toBeGreaterThanOrEqual(4);
    expect(new Set(owners)).toEqual(new Set(['mem-rina']));
  });

  it('P11-T8 AC-7 creates the lead in her pipeline through POST /leads?owner=, and says so', async () => {
    const { calls, onNotice, onWrite } = renderFor({
      'outcome=open': { body: page([]) },
      'POST /leads': { status: 201, body: lead({ id: 'l-new', name: 'Pak Joko', ownerMembershipId: 'mem-rina' }) },
    });
    await screen.findByText('No leads match.');

    await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
    await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'Pak Joko{Enter}');

    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Pak Joko added.'));
    const post = calls.find((c) => c.init.method === 'POST')!;
    expect(post.url).toBe('http://api.test/api/v1/leads?owner=mem-rina');
    expect(JSON.parse(post.init.body as string)).toEqual({ name: 'Pak Joko' });
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ id: 'l-new' }));
  });

  it('P11-T8 AC-7 says "Enter a name first." for Enter on an empty name, and posts nothing', async () => {
    const { calls } = renderFor({ 'outcome=open': { body: page([]) } });
    await screen.findByText('No leads match.');

    await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
    await userEvent.type(screen.getByLabelText('Lead name, row 1'), '{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a name first.');
    expect(calls.some((c) => c.init.method === 'POST')).toBe(false);
  });

  it('P11-T8 AC-7 asks "Mark as Won?" in the coaching card’s words, pinned, and says it was marked', async () => {
    const { calls, onNotice } = renderFor({
      'outcome=open': { body: page([lead({ statusCode: 'PAID_AND_ISSUED', version: 7 })]) },
      'PATCH /leads/l1/outcome': { body: lead({ statusCode: 'PAID_AND_ISSUED', outcome: 'won', version: 8 }) },
    });
    await screen.findByDisplayValue('Pak Budi');

    await menuOf('Pak Budi');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark successful' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Mark as Won? Pak Budi will move to Closed leads as "Won". You can still find them there afterward.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as Won' }));

    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Pak Budi marked as Won.'));
    const patch = calls.find((c) => c.init.method === 'PATCH')!;
    expect(JSON.parse(patch.init.body as string)).toEqual({ outcome: 'won', version: 7 });
  });

  it('P11-T8 AC-7 says a type move and a status move in the prototype’s words', async () => {
    const { onNotice } = renderFor({
      'outcome=open': { body: page([lead({ type: null, statusCode: null })]) },
      'PATCH /leads/l1/status': { body: lead({ statusCode: 'FOLLOW_UP', version: 3 }) },
      'PATCH /leads/l1': { body: lead({ type: 'sales', version: 2 }) },
    });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.selectOptions(screen.getByLabelText('Type, row 1'), 'sales');
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Pak Budi moved to Sales.'));
    await userEvent.selectOptions(screen.getByLabelText('Status, row 1'), 'FOLLOW_UP');
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Pak Budi\'s status updated to "Follow-up".'));
  });

  it('P11-T8 AC-7, P13.1-T4 AC-9 names somebody else’s change in the lead’s details, without ADR-0084’s office when the name is gone', async () => {
    renderFor({ 'outcome=open': { body: page([lead({ lastEditedBy: { membershipId: 'mem-x', name: null } })]) } });
    await screen.findByDisplayValue('Pak Budi');
    await menuOf('Pak Budi');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lead details' }));
    expect(within(await screen.findByRole('dialog', { name: 'Lead details for Pak Budi' })).getByText('Last changed by someone else'))
      .toBeInTheDocument();
  });

  it('P11-T8 AC-10 under a finalized session’s lock: nothing writes, and the closed list still reads', async () => {
    const { calls } = renderFor({ 'outcome=open': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) } }, { readOnly: true });
    await screen.findByDisplayValue('Pak Budi');

    for (const name of ['+ Add lead', '↺ Move to active']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole('searchbox', { name: 'Search leads' })).toBeDisabled();
    expect(screen.getByLabelText('Filter by type')).toBeDisabled();
    expect(screen.getByLabelText('Remarks, row 1')).toHaveAttribute('readonly');
    const name = screen.getByLabelText('Lead name, row 1');
    expect(name).toHaveAttribute('readonly');
    await userEvent.type(name, 'x');
    await userEvent.tab();
    expect(name).toHaveValue('Pak Budi');
    await userEvent.selectOptions(screen.getByLabelText('Status, row 1'), 'FOLLOW_UP');
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
    expect(await screen.findByText('Bu Sari')).toBeInTheDocument();
  });
});

/**
 * The lock, on what P13.1-T4 changed (AC-9): the ⋮ still opens the lead's details, and the details only
 * read. The WhatsApp link stays, beside the ⋮ since P18.8-T7 — opening a chat writes nothing.
 */
describe('LeadsTable, read-only, as P13.1-T4 left it', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker;
  });

  it('P13.1-T4 AC-9 offers the lead’s details alone in the ⋮ menu', async () => {
    renderFor({ 'outcome=open': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) } }, { readOnly: true });
    await screen.findByDisplayValue('Pak Budi');
    expect(await menuOf('Pak Budi')).toEqual(['Lead details']);
  });

  it('P13.1-T4 AC-9, P18.8-T7 AC-5 shows the details read-only, saves nothing, and still opens WhatsApp from the row', async () => {
    const { calls } = renderFor(
      { 'outcome=open': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null }, source: 'Referral' })]) } },
      { readOnly: true },
    );
    await screen.findByDisplayValue('Pak Budi');
    await menuOf('Pak Budi');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lead details' }));
    const dialog = await screen.findByRole('dialog', { name: 'Lead details for Pak Budi' });

    const phone = within(dialog).getByLabelText('Phone');
    expect(phone).toHaveAttribute('readonly');
    expect(phone).toHaveValue('0812-1100-2200');
    await userEvent.type(phone, '9');
    await userEvent.tab();
    expect(phone).toHaveValue('0812-1100-2200');
    expect(within(dialog).getByLabelText('Where they came from')).toHaveAttribute('readonly');
    expect(within(dialog).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('link', { name: 'Chat with Pak Budi on WhatsApp (opens in a new tab)' }))
      .toHaveAttribute('href', 'https://wa.me/6281211002200');
    expect(calls.some((c) => c.init.method === 'PATCH')).toBe(false);
  });

  it('P13.1-T4 AC-9 opens no date picker on a locked row', async () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    renderFor({ 'outcome=open': { body: page([lead()]) } }, { readOnly: true });
    const date = await screen.findByLabelText('Next action date, row 1');

    await userEvent.click(date.previousElementSibling as HTMLElement);
    expect(showPicker).not.toHaveBeenCalled();
  });

  it('P13.1-T4 AC-9 lays the coachee’s leads out as cards in a narrow card, with her own toolbar', async () => {
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback([{ target, contentRect: { width: 500 } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    });
    const { calls } = renderFor({ 'outcome=open': { body: page([lead()]) } });

    expect(await screen.findByRole('list', { name: 'Her leads' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search leads' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Sort leads'), 'Status, ascending');
    await waitFor(() => expect(lastRead(calls).get('sort')).toBe('status'));
    expect(lastRead(calls).get('owner')).toBe('mem-rina');
  });
});

/**
 * P18.8-T7 on the coaching session's card: the coachee's own order, and no handle to change it — the order
 * of a list is its owner's (ADR-0161 §1). WhatsApp beside the ⋮, and *Recruit* in the type filter.
 */
describe('LeadsTable, on a coaching session’s card (P18.8-T7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('P18.8-T7 AC-4 reads the coachee’s saved order, and offers no drag handle on any of her rows', async () => {
    const { calls } = renderFor({
      'outcome=open': { body: page([lead(), lead({ id: 'l2', name: 'Ibu Wati' })]) },
    });
    await screen.findByDisplayValue('Ibu Wati');

    expect(lastRead(calls).get('sort')).toBeNull();
    expect(lastRead(calls).get('owner')).toBe('mem-rina');
    expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')[1].querySelector('td')).toHaveTextContent(/^1$/);
    // Its first column keeps the narrow width it had: there is no handle to make room for.
    expect((screen.getByRole('table').querySelector('colgroup col') as HTMLElement).style.width).toBe('2rem');
    expect(calls.some((c) => c.url.includes('/leads/order'))).toBe(false);
  });

  it('P18.8-T7 AC-5 puts WhatsApp beside the ⋮ in the coachee’s rows', async () => {
    renderFor({
      'outcome=open': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) },
    });
    await screen.findByDisplayValue('Pak Budi');

    const chat = screen.getByRole('link', { name: 'Chat with Pak Budi on WhatsApp (opens in a new tab)' });
    expect(chat.closest('td')).toBe(screen.getByRole('button', { name: 'Actions for Pak Budi' }).closest('td'));
  });

  it('P18.8-T7 AC-6 filters by *Sales* and *Recruit*, the type’s words everywhere', async () => {
    renderFor({ 'outcome=open': { body: page([lead({ type: 'recruitment', statusCode: null })]) } });
    await screen.findByDisplayValue('Pak Budi');

    expect(within(screen.getByLabelText('Filter by type')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['All types', 'Sales', 'Recruit']);
    expect(within(screen.getByLabelText('Type, row 1')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Select type', 'Sales', 'Recruit']);
    expect(screen.getByLabelText('Type, row 1')).toHaveValue('recruitment');
  });
});
