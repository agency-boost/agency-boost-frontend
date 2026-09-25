import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import LeadsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
}));

const AGENT = makeMe({
  permissions: ['lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:mark_outcome'],
});

/** Two ladders, as an office configures them. Nothing on the screen is hardcoded from them. */
const PIPELINES = [
  {
    pipeline: 'sales',
    statuses: [
      { id: 's1', pipeline: 'sales', code: 'NOT_YET_APPROACHED', label: 'Not yet approached', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 's2', pipeline: 'sales', code: 'FOLLOW_UP', label: 'Follow-up', rank: 2, isTerminal: false, isLateStage: true, version: 1, status: 'active' },
      { id: 's3', pipeline: 'sales', code: 'PAID_AND_ISSUED', label: 'Paid and issued', rank: 3, isTerminal: true, isLateStage: false, version: 1, status: 'active' },
    ],
  },
  {
    pipeline: 'recruitment',
    statuses: [
      { id: 'r1', pipeline: 'recruitment', code: 'NOT_APPROACHED', label: 'Not approached', rank: 1, isTerminal: false, isLateStage: false, version: 1, status: 'active' },
      { id: 'r2', pipeline: 'recruitment', code: 'AAJI_LICENSED', label: 'AAJI licensed', rank: 2, isTerminal: false, isLateStage: true, version: 1, status: 'active' },
    ],
  },
];

const lead = (over: Record<string, unknown> = {}) => ({
  id: 'l1',
  ownerMembershipId: 'mem-1',
  type: 'sales',
  name: 'Pak Budi',
  contact: { phone: null, email: null },
  lawfulBasis: null,
  consentAt: null,
  statusCode: 'FOLLOW_UP',
  thisMonth: false,
  remarks: 'Hobi golf',
  nextActionDate: '2026-10-02',
  nextActionNote: null,
  outcome: null,
  source: null,
  dateRegistered: '2026-09-04T03:00:00.000Z',
  version: 2,
  flags: [],
  overdueDays: null,
  committedMonths: [],
  lastEditedBy: null,
  ...over,
});

const page = (rows: unknown[], over: Record<string, unknown> = {}) => ({
  rows, total: rows.length, page: 1, pageSize: 50, ...over,
});

const base = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
};

const render = (routes: Record<string, unknown>, me = AGENT) => {
  const stub = stubFetch({ ...base, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me });
  return stub;
};

/** The query string of the last `GET /leads` the screen asked for. */
const lastList = (calls: { url: string; init: RequestInit }[]) =>
  new URL(calls.filter((c) => /\/leads(\?|$)/.test(c.url) && (c.init.method ?? 'GET') === 'GET').at(-1)!.url)
    .searchParams;

describe('Leads Management (P7-T2, P7-T3)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders the agent’s leads, with the office’s own stage labels', async () => {
    render({ '/leads': { body: page([lead()]) } });

    expect(await screen.findByDisplayValue('Pak Budi')).toBeInTheDocument();
    const status = screen.getByLabelText('Status, row 1');
    expect(status).toHaveValue('FOLLOW_UP');
    expect(within(status).getByRole('option', { name: 'Follow-up' })).toBeInTheDocument();
    expect(screen.getByText('4 Sept 2026')).toBeInTheDocument();
  });

  describe('AC-1 — search and filters, which the prototype’s busiest screen has neither of', () => {
    it('sends the search and every filter to the server', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.type(screen.getByLabelText('Search'), 'budi');
      await userEvent.selectOptions(screen.getByLabelText('Type'), 'recruitment');
      await userEvent.selectOptions(screen.getByLabelText('Stage'), 'AAJI_LICENSED');
      await userEvent.selectOptions(screen.getByLabelText('Show'), 'won');
      await userEvent.selectOptions(screen.getByLabelText('Needs attention'), 'overdue');
      await userEvent.click(screen.getByRole('button', { name: 'Search' }));

      await waitFor(() => {
        const q = lastList(calls);
        expect(q.get('search')).toBe('budi');
        expect(q.get('type')).toBe('recruitment');
        expect(q.get('statusCode')).toBe('AAJI_LICENSED');
        expect(q.get('outcome')).toBe('won');
        expect(q.get('attention')).toBe('overdue');
      });
    });

    it('opens on the leads that are still open, because that is the work', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(lastList(calls).get('outcome')).toBe('open');
    });

    it('does not search on every keystroke', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');
      const before = calls.length;

      await userEvent.type(screen.getByLabelText('Search'), 'budi');

      expect(calls.length).toBe(before);
    });
  });

  describe('AC-2 — one sort key, and no promise of grouping', () => {
    it('sorts on the column asked for, and reverses on a second click', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));
      await waitFor(() => {
        expect(lastList(calls).get('sort')).toBe('name');
        expect(lastList(calls).get('dir')).toBe('asc');
      });

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));
      await waitFor(() => expect(lastList(calls).get('dir')).toBe('desc'));
    });

    it('marks exactly one column as sorted, for anyone who cannot see the arrow', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const sorted = screen.getAllByRole('columnheader')
        .filter((th) => ['ascending', 'descending'].includes(th.getAttribute('aria-sort') ?? ''));
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toHaveTextContent('Registered');
    });

    it('does not reproduce the footnote promising sales first, then recruitment', async () => {
      // The prototype's own code does no such grouping. The code wins and the copy goes.
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.queryByText(/Sales leads first/i)).not.toBeInTheDocument();
    });
  });

  describe('AC-3 — paging at the size the service states', () => {
    it('pages with what the server answered, never a number chosen here', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()], { total: 120, page: 1, pageSize: 50 }) },
      });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.getByText(/Page 1 of 3 · 50 per page/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(lastList(calls).get('page')).toBe('2'));
    });
  });

  describe('AC-4 — one field at a time, and the refusal on its own row', () => {
    it('sends only the field that changed', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ remarks: 'Hot button: Hubungan' }) },
      });
      const remarks = await screen.findByLabelText('Remarks, row 1');

      await userEvent.clear(remarks);
      await userEvent.type(remarks, 'Hot button: Hubungan');
      await userEvent.tab();

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PATCH').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ remarks: 'Hot button: Hubungan', version: 2 });
      });
    });

    it('writes nothing when a field is left as it was', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      const name = await screen.findByLabelText('Lead name, row 1');

      await userEvent.click(name);
      await userEvent.tab();

      expect(calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(0);
    });

    it('shows what the server refused, on the row, and keeps what was typed', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': {
          status: 422,
          body: {
            error: {
              code: 'LEAD_CONSENT_REQUIRED',
              message: 'Record why you may hold these details first.',
              requestId: 'req-9',
            },
          },
        },
      });
      const name = await screen.findByLabelText('Lead name, row 1');

      await userEvent.clear(name);
      await userEvent.type(name, 'Budi Santoso');
      await userEvent.tab();

      expect(await screen.findByText('Record why you may hold these details first.')).toBeInTheDocument();
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('Budi Santoso');
    });
  });

  describe('AC-5 — every state', () => {
    it('shows a skeleton shaped like the table while it loads', () => {
      render({ '/leads': { body: page([lead()]) } });

      expect(screen.getByRole('status')).toHaveTextContent('Loading your leads…');
    });

    it('offers to add the first one when there are none', async () => {
      render({ '/leads': { body: page([]) } });

      expect(await screen.findByText('No leads yet — add your first one above.')).toBeInTheDocument();
    });

    it('says nothing matches — not that there is nothing — when a filter is on', async () => {
      // Telling somebody with fifty leads and a bad filter "No leads yet" is actively wrong.
      render({ '/leads': { body: page([]) } });
      await screen.findByText('No leads yet — add your first one above.');

      await userEvent.selectOptions(screen.getByLabelText('Type'), 'recruitment');
      await userEvent.click(screen.getByRole('button', { name: 'Search' }));

      expect(await screen.findByText('No leads match what you asked for.')).toBeInTheDocument();
    });

    it('renders the server’s refusal rather than an empty table', async () => {
      render({
        '/leads': {
          status: 500,
          body: { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', requestId: 'req-1' } },
        },
      });

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    });

    it('refuses the screen to somebody without lead:read', async () => {
      render({ '/leads': { body: page([]) } }, makeMe({ permissions: [] }));

      expect(await screen.findByText(/needs the/)).toBeInTheDocument();
      expect(screen.getByText('lead:read')).toBeInTheDocument();
    });
  });

  describe('AC-6 — a phone', () => {
    it('scrolls the table inside its own container, not the page body', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const table = screen.getByRole('table');
      expect(table.className).toMatch(/min-w-/);
      expect(table.parentElement?.className).toContain('overflow-x-auto');
    });
  });

  describe('P7-T3 — moving, and closing', () => {
    it('offers only this lead’s own ladder', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const status = await screen.findByLabelText('Status, row 1');

      const options = within(status).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['No status yet', 'Not yet approached', 'Follow-up', 'Paid and issued']);
      expect(options).not.toContain('AAJI licensed');
    });

    it('waits for a ladder before offering a stage', async () => {
      // A stage means nothing until we know which of the two vocabularies it belongs to.
      render({ '/leads': { body: page([lead({ type: null, statusCode: null })]) } });

      expect(await screen.findByLabelText('Status, row 1')).toBeDisabled();
    });

    it('moves the lead through the route that records the move', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1/status': { body: lead({ statusCode: 'PAID_AND_ISSUED' }) },
      });
      const status = await screen.findByLabelText('Status, row 1');

      await userEvent.selectOptions(status, 'PAID_AND_ISSUED');

      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/leads/l1/status')).at(-1);
        expect(sent?.init.method).toBe('PATCH');
        expect(JSON.parse(String(sent?.init.body))).toEqual({ statusCode: 'PAID_AND_ISSUED', version: 2 });
      });
    });

    it('AC-3: gates ✓ below the stage that closes the pipeline, and never gates ✕', async () => {
      render({ '/leads': { body: page([lead({ statusCode: 'FOLLOW_UP' })]) } });

      expect(await screen.findByRole('button', { name: 'Mark successful' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Mark not successful' })).toBeEnabled();
    });

    it('AC-3: opens ✓ at that stage, and closes the lead through the outcome route', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) },
        '/leads/l1/outcome': { body: lead({ statusCode: 'PAID_AND_ISSUED', outcome: 'won' }) },
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Mark successful' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/leads/l1/outcome')).at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ outcome: 'won', version: 2 });
      });
    });

    it('AC-4: reopening is an explicit act, and it is the only one a closed row offers', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ outcome: 'lost' })]) },
        '/leads/l1/outcome': { body: lead({ outcome: null }) },
      });

      expect(await within(await screen.findByRole('table')).findByText('Not successful'))
        .toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Mark successful' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: '↺ Move to active' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/leads/l1/outcome')).at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ outcome: null, version: 2 });
      });
    });

    it('AC-2: shows the server’s pipeline refusal on the row', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1/status': {
          status: 422,
          body: {
            error: {
              code: 'LEAD_STATUS_WRONG_PIPELINE',
              message: 'AAJI_LICENSED belongs to the recruitment ladder; this is a sales lead.',
              requestId: 'req-4',
            },
          },
        },
      });
      const status = await screen.findByLabelText('Status, row 1');

      await userEvent.selectOptions(status, 'PAID_AND_ISSUED');

      expect(await screen.findByText(/belongs to the recruitment ladder/)).toBeInTheDocument();
    });

    it('catches up with the row when somebody else has already closed it', async () => {
      // A second tab, or a leader in a coaching session. The screen stops showing it as open.
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1/status': {
          status: 409,
          body: {
            error: { code: 'LEAD_ALREADY_CLOSED', message: 'This lead is closed.', requestId: 'req-5' },
          },
        },
        '/leads/l1': { body: lead({ outcome: 'won', statusCode: 'PAID_AND_ISSUED' }) },
      });

      await userEvent.selectOptions(await screen.findByLabelText('Status, row 1'), 'PAID_AND_ISSUED');

      await waitFor(() => {
        expect(within(screen.getByRole('table')).getByText('Successful')).toBeInTheDocument();
      });
      expect(calls.some((c) => c.url.includes('/leads/l1') && (c.init.method ?? 'GET') === 'GET')).toBe(true);
    });
  });

  describe('the ladder a lead is on, and the one it moves to', () => {
    it('says what changing the type will cost before it does it', async () => {
      // The server clears the stage and the commitment, because the two ladders share no
      // stage. The prototype does the same and does it silently — that part is not copied.
      const confirm = vi.fn(() => false);
      vi.stubGlobal('confirm', confirm);
      const { calls } = render({ '/leads': { body: page([lead({ thisMonth: true })]) } });

      await userEvent.selectOptions(await screen.findByLabelText('Type, row 1'), 'recruitment');

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('clears this lead’s stage'));
      expect(calls.filter((c) => c.init.method === 'PATCH')).toHaveLength(0);
    });

    it('shows a retired stage as the code the lead still holds', async () => {
      // Archived configuration stays readable so history renders (invariant §3); the
      // snapshot carries active stages only, so the code is all there is to show.
      render({ '/leads': { body: page([lead({ statusCode: 'RETIRED_STAGE' })]) } });

      expect(await screen.findByRole('option', { name: 'RETIRED_STAGE (retired)' })).toBeInTheDocument();
    });
  });

  describe('attention, and the commitment that does not hide it', () => {
    it('P7-T4 AC-2: shows both the commitment and what is overdue', async () => {
      render({
        '/leads': {
          body: page([lead({ thisMonth: true, flags: ['overdue', 'no-remarks'], overdueDays: 14 })]),
        },
      });

      const table = within(await screen.findByRole('table'));
      expect(table.getByText('Closes this month')).toBeInTheDocument();
      expect(table.getByText('Overdue 14 days')).toBeInTheDocument();
      expect(table.getByText('No remarks')).toBeInTheDocument();
    });

    it('P7-T4: says how late, and counts in the office’s days rather than the browser’s', async () => {
      // The number is the server's: it is whole calendar days in the office's timezone, and a
      // screen subtracting two dates itself would be wrong for anybody on another device zone.
      render({ '/leads': { body: page([lead({ flags: ['overdue'], overdueDays: 1 })]) } });

      expect(await screen.findByText('Overdue 1 day')).toBeInTheDocument();
    });

    it('P7-T4: falls back to the bare word when the server sends no count', async () => {
      render({ '/leads': { body: page([lead({ flags: ['overdue'], overdueDays: null })]) } });

      expect(await within(await screen.findByRole('table')).findByText('Overdue')).toBeInTheDocument();
    });

    it('words the commitment for the ladder the lead is on', async () => {
      render({ '/leads': { body: page([lead({ type: 'recruitment', statusCode: null, thisMonth: true })]) } });

      expect(await screen.findByText('Recruiting this month')).toBeInTheDocument();
    });
  });

  describe('contact details, and the ground for holding them', () => {
    it('asks on what ground before the details are stored', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ lawfulBasis: 'consent' }) },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));
      await userEvent.selectOptions(screen.getByLabelText('Why you may hold these'), 'consent');

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PATCH').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ lawfulBasis: 'consent', version: 2 });
      });
    });

    it('shows the server’s refusal when the details arrive without one', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': {
          status: 422,
          body: {
            error: {
              code: 'LEAD_CONSENT_REQUIRED',
              message: 'Record why you may hold these details first.',
              requestId: 'req-7',
            },
          },
        },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));
      await userEvent.type(screen.getByLabelText('Phone'), '0811');
      await userEvent.tab();

      expect(await screen.findByText('Record why you may hold these details first.')).toBeInTheDocument();
    });
  });

  describe('the rest of the row', () => {
    it('ticks the month’s commitment as its own one-field write', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ thisMonth: true }) },
      });

      await userEvent.click(await screen.findByLabelText('Close this month'));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PATCH').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ thisMonth: true, version: 2 });
      });
    });

    it('sends the next-action note and the source one at a time', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead() },
      });

      await userEvent.type(await screen.findByLabelText('Next action note, row 1'), 'Meet at Starbucks');
      await userEvent.tab();
      await waitFor(() => {
        expect(JSON.parse(String(calls.filter((c) => c.init.method === 'PATCH').at(-1)?.init.body)))
          .toEqual({ nextActionNote: 'Meet at Starbucks', version: 2 });
      });

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));
      await userEvent.type(screen.getByLabelText('Where they came from'), 'Referral — Desi');
      await userEvent.tab();
      await waitFor(() => {
        expect(JSON.parse(String(calls.filter((c) => c.init.method === 'PATCH').at(-1)?.init.body)))
          .toEqual({ source: 'Referral — Desi', version: 2 });
      });
    });

    it('sends an email with the phone it already holds, so one does not erase the other', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ lawfulBasis: 'consent', contact: { phone: '0812-1100-2200', email: null } })]) },
        '/leads/l1': { body: lead() },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));
      await userEvent.type(screen.getByLabelText('Email'), 'budi@example.com');
      await userEvent.tab();

      await waitFor(() => {
        expect(JSON.parse(String(calls.filter((c) => c.init.method === 'PATCH').at(-1)?.init.body)))
          .toEqual({ contact: { phone: '0812-1100-2200', email: 'budi@example.com' }, version: 2 });
      });
    });

    it('closes the details panel again', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));
      expect(screen.getByLabelText('Phone')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Hide details' }));
      expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument();
    });

    it('clears a date back to nothing rather than sending an empty string', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ nextActionDate: null }) },
      });

      await userEvent.clear(await screen.findByLabelText('Next action date, row 1'));

      await waitFor(() => {
        expect(JSON.parse(String(calls.filter((c) => c.init.method === 'PATCH').at(-1)?.init.body)))
          .toEqual({ nextActionDate: null, version: 2 });
      });
    });
  });

  describe('getting back to everything', () => {
    it('clears the filters from the nothing-matched state', async () => {
      const { calls } = render({ '/leads': { body: page([]) } });
      await screen.findByText('No leads yet — add your first one above.');

      await userEvent.selectOptions(screen.getByLabelText('Needs attention'), 'overdue');
      await userEvent.click(screen.getByRole('button', { name: 'Search' }));
      await screen.findByText('No leads match what you asked for.');

      await userEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));

      await waitFor(() => expect(lastList(calls).get('attention')).toBeNull());
      expect(await screen.findByText('No leads yet — add your first one above.')).toBeInTheDocument();
    });

    it('pages back', async () => {
      const { calls } = render({
        '/leads': [
          { body: page([lead()], { total: 120, page: 1, pageSize: 50 }) },
          { body: page([lead()], { total: 120, page: 2, pageSize: 50 }) },
        ],
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      await waitFor(() => expect(lastList(calls).get('page')).toBe('2'));

      await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
      await waitFor(() => expect(lastList(calls).get('page')).toBe('1'));
    });
  });

  describe('P7-T5 — the promise, and the month it was made for', () => {
    it('shows what was promised, which is what the tick box cannot say once the month turns', async () => {
      render({ '/leads': { body: page([lead({ committedMonths: ['2026-09', '2026-10'] })]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));

      expect(screen.getByText('Promised for Sep 2026 · Oct 2026')).toBeInTheDocument();
    });

    it('says nothing about a lead that was never promised', async () => {
      render({ '/leads': { body: page([lead({ committedMonths: [] })]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Details' }));

      expect(screen.queryByText(/Promised for/)).not.toBeInTheDocument();
    });

    it('unticks itself when the month has turned, with nothing having run', async () => {
      // September's promise, read in October: the server derives `thisMonth` from the month it
      // names, so the box is empty and the archive still says September.
      render({
        '/leads': { body: page([lead({ thisMonth: false, committedMonths: ['2026-09'] })]) },
      });

      expect(await screen.findByLabelText('Close this month')).not.toBeChecked();
      await userEvent.click(screen.getByRole('button', { name: 'Details' }));
      expect(screen.getByText('Promised for Sep 2026')).toBeInTheDocument();
    });
  });

  describe('P7-T7 — a leader\u2019s edit carries their name', () => {
    it('AC-2: names whoever changed it, when that was not the agent whose lead it is', async () => {
      // The phase's exit criterion, checked where it is claimed: the agent's own screen.
      render({
        '/leads': {
          body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]),
        },
      });

      expect(await screen.findByText('Edited by Ibu Sari')).toBeInTheDocument();
    });

    it('AC-2: says nothing when the last change was the agent\u2019s own', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: null })]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.queryByText(/Edited by/)).not.toBeInTheDocument();
    });

    it('names the office rather than a blank when the membership resolves to nobody', async () => {
      render({
        '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-gone', name: null } })]) },
      });

      expect(await screen.findByText('Edited by someone in your office')).toBeInTheDocument();
    });

    it('AC-3: pins the version every write was read at', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ version: 7 })]) },
        '/leads/l1': { body: lead({ version: 8 }) },
      });

      const remarks = await screen.findByLabelText('Remarks, row 1');
      await userEvent.clear(remarks);
      await userEvent.type(remarks, 'Changed.');
      await userEvent.tab();

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'PATCH').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ remarks: 'Changed.', version: 7 });
      });
    });

    it('AC-3: pins a move, and then pins what the move left behind', async () => {
      // The second write pins **8**, not the 7 the page loaded with: a screen that captured the
      // version once would refuse its own previous save from then on.
      const { calls } = render({
        '/leads': { body: page([lead({ version: 7, statusCode: 'FOLLOW_UP' })]) },
        '/leads/l1/status': { body: lead({ version: 8, statusCode: 'PAID_AND_ISSUED' }) },
        '/leads/l1/outcome': { body: lead({ version: 9, outcome: 'won' }) },
      });

      await userEvent.selectOptions(await screen.findByLabelText('Status, row 1'), 'PAID_AND_ISSUED');
      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/status')).at(-1);
        expect(JSON.parse(String(sent?.init.body)))
          .toEqual({ statusCode: 'PAID_AND_ISSUED', version: 7 });
      });

      await userEvent.click(await screen.findByRole('button', { name: 'Mark successful' }));
      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/outcome')).at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ outcome: 'won', version: 8 });
      });
    });

    it('AC-3: a stale write reloads the row rather than arguing with it', async () => {
      render({
        '/leads': { body: page([lead({ version: 7, remarks: 'Mine.' })]) },
        '/leads/l1': [
          {
            status: 409,
            body: {
              error: {
                code: 'VERSION_CONFLICT',
                message: 'This record changed since you loaded it. Reload and try again.',
                requestId: 'req-6',
              },
            },
          },
          { body: lead({ version: 9, remarks: 'What the leader saved.' }) },
        ],
      });

      const remarks = await screen.findByLabelText('Remarks, row 1');
      await userEvent.clear(remarks);
      await userEvent.type(remarks, 'Stale.');
      await userEvent.tab();

      expect(await screen.findByText(/changed since you loaded it/)).toBeInTheDocument();
      // The row shows what is actually stored, not what this screen last believed.
      await waitFor(() => {
        expect(screen.getByLabelText('Remarks, row 1')).toHaveValue('What the leader saved.');
      });
    });
  });

  describe('adding and deleting', () => {
    it('creates a lead with a name and no stage — the first stage is a move', async () => {
      const { calls } = render({ '/leads': [{ body: page([]) }, { body: page([lead()]) }] });
      await screen.findByText('No leads yet — add your first one above.');

      await userEvent.click(screen.getAllByRole('button', { name: '+ Add lead' })[0]);
      await userEvent.type(screen.getByLabelText('Lead name'), 'Pak Budi');
      await userEvent.selectOptions(screen.getByLabelText('Type', { selector: '#new-lead-type' }), 'sales');
      await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.init.method === 'POST').at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ name: 'Pak Budi', type: 'sales' });
      });
    });

    it('says what the server refused about a new lead, without closing the form', async () => {
      render({
        '/leads': [
          { body: page([]) },
          {
            status: 422,
            body: {
              error: {
                code: 'VALIDATION_FAILED',
                message: 'A lead needs a name of at least 2 characters.',
                requestId: 'req-2',
              },
            },
          },
        ],
      });
      await screen.findByText('No leads yet — add your first one above.');

      await userEvent.click(screen.getAllByRole('button', { name: '+ Add lead' })[0]);
      await userEvent.type(screen.getByLabelText('Lead name'), 'B');
      await userEvent.click(screen.getByRole('button', { name: 'Add lead' }));

      expect(await screen.findByText('A lead needs a name of at least 2 characters.')).toBeInTheDocument();
      expect(screen.getByLabelText('Lead name')).toHaveValue('B');
    });

    it('closes the add form without writing anything', async () => {
      const { calls } = render({ '/leads': { body: page([]) } });
      await screen.findByText('No leads yet — add your first one above.');

      await userEvent.click(screen.getAllByRole('button', { name: '+ Add lead' })[0]);
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByLabelText('Lead name')).not.toBeInTheDocument();
      expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(0);
    });

    it('does not delete when the question is answered no', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(calls.filter((c) => c.init.method === 'DELETE')).toHaveLength(0);
    });

    it('shows a refused delete on the row', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': {
          status: 404,
          body: { error: { code: 'NOT_FOUND', message: 'Lead not found.', requestId: 'req-8' } },
        },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Lead not found.')).toBeInTheDocument();
    });

    it('asks before deleting, and deletes through the route that only hides it', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: { id: 'l1', deletedAt: '2026-09-25T02:00:00.000Z' } },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(calls.some((c) => c.url.includes('/leads/l1') && c.init.method === 'DELETE')).toBe(true);
      });
    });
  });
});
