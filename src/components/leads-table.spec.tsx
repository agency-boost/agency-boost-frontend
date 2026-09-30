import { screen, waitFor } from '@testing-library/react';
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
  contact: { phone: null, email: null }, lawfulBasis: null, consentAt: null, statusCode: null,
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

  it('offers no delete at all — the coaching card’s rows end in the outcome, and delete is the owner’s', async () => {
    render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-1' })]) } });
    await screen.findByDisplayValue('Bu Rina');

    expect(screen.queryByRole('button', { name: 'Delete lead' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Contact details' })).toHaveLength(2);
  });

  it('adds through the same inline row', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');

    await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

    expect(screen.getByLabelText('Lead name, row 1')).toHaveFocus();
    expect(screen.getByLabelText('Lead name, row 2')).toHaveValue('Pak Budi');
  });
});
