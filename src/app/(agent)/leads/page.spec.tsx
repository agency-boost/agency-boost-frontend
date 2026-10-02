import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
  rows, total: rows.length, page: 1, pageSize: 200, ...over,
});

const error = (status: number, code: string, message: string) => ({
  status, body: { error: { code, message, requestId: 'req-1' } },
});

/*
 * The two closed cards below the table ask for their own lists. Keyed on the query rather than the
 * path — the stub matches on `url.includes`, longest key first — so `/leads` keeps answering the table
 * and these answer the cards.
 */
const BASE = {
  '/kpm/config': { body: { activity: [], ratios: [], leadPipelines: PIPELINES, version: 1 } },
  '/kpm/org-levels': { body: [] },
  'outcome=won': { body: page([]) },
  'outcome=lost': { body: page([]) },
};

const render = (routes: Record<string, unknown>, me = AGENT) => {
  const stub = stubFetch({ ...BASE, ...routes } as Parameters<typeof stubFetch>[0]);
  renderInLayout(AgentLayout, <LeadsPage />, { me });
  return stub;
};

type Call = { url: string; init: RequestInit };

/** Every `GET /leads` the table made — the open leads, not the two closed cards. */
const tableReads = (calls: Call[]) => calls
  .filter((c) => /\/leads\?/.test(c.url) && (c.init.method ?? 'GET') === 'GET')
  .map((c) => new URL(c.url).searchParams)
  .filter((q) => q.get('outcome') === 'open');

const lastRead = (calls: Call[]) => tableReads(calls).at(-1)!;

const writes = (calls: Call[], method = 'PATCH') => calls.filter((c) => c.init.method === method);
const lastBody = (calls: Call[], method = 'PATCH') => JSON.parse(String(writes(calls, method).at(-1)?.init.body));

/** The `<tr>` a control sits in. */
const rowOf = (el: HTMLElement) => el.closest('tr')!;

/**
 * A `fetch` the table's own reads can be steered through, page by page — and held, for the stale-page
 * test. Everything else goes to the ordinary stub.
 */
function stubPaged(open: (q: URLSearchParams) => unknown | Promise<unknown>, routes: Record<string, unknown> = {}) {
  const { mock } = stubFetch({ ...BASE, '/leads': { body: page([]) }, ...routes } as Parameters<typeof stubFetch>[0]);
  const reads: URLSearchParams[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const q = new URL(url).searchParams;
    if (/\/leads\?/.test(url) && q.get('outcome') === 'open') {
      reads.push(q);
      const body = await open(q);
      return { ok: true, status: 200, json: async () => body } as Response;
    }
    return mock(url, init);
  }));
  renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
  return reads;
}

/** `n` open leads, numbered from `from`, each registered a day apart. */
const many = (from: number, n: number, prefix = 'Lead') => Array.from({ length: n }, (_, i) => lead({
  id: `${prefix}-${from + i}`, name: `${prefix} ${from + i}`,
}));

describe('Leads Management, back to the prototype (P10.1-T4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders the agent’s leads, with the office’s own stage labels', async () => {
    render({ '/leads': { body: page([lead()]) } });

    expect(await screen.findByDisplayValue('Pak Budi')).toBeInTheDocument();
    const status = screen.getByLabelText('Status, row 1');
    expect(status).toHaveValue('FOLLOW_UP');
    expect(within(status).getByRole('option', { name: 'Follow-up' })).toBeInTheDocument();
    expect(screen.getByText('Sep 4, 2026')).toBeInTheDocument();
  });

  describe('AC-1 — what went', () => {
    it('AC-1: has no counts strip, and never asks for the counts', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const tile of ['Open', 'Promised this month', 'Recruitment pipeline', 'Expected to close']) {
        expect(screen.queryByText(tile)).not.toBeInTheDocument();
      }
      expect(calls.some((c) => c.url.includes('/leads/summary'))).toBe(false);
    });

    it('AC-1: has no search, filter or Clear above the table', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const label of ['Search', 'Stage', 'Show', 'Needs attention']) {
        expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
      }
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    });

    it('AC-1: has no pager, and no Next action sort', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
      expect(screen.queryByText(/per page/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Next action/ })).not.toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Next action' })).not.toHaveAttribute('aria-sort');
    });

    it('AC-1: puts the input in the name cell and nothing else', async () => {
      render({
        '/leads': {
          body: page([lead({
            lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' },
            flags: ['overdue'], overdueDays: 14, committedMonths: ['2026-09'],
          })]),
        },
      });

      const name = await screen.findByLabelText('Lead name, row 1');
      const cell = name.closest('td')!;
      expect(cell.children).toHaveLength(1);
      expect(cell).toContainElement(name);
      expect(screen.queryByText(/Edited by/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument();
      expect(screen.queryByText(/Promised for/)).not.toBeInTheDocument();
    });

    it('AC-1: has no add-lead card — the only way in is the inline row', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      expect(screen.queryByRole('button', { name: 'Add lead' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Lead name')).not.toBeInTheDocument();
    });
  });

  describe('AC-2 — what stays, verbatim', () => {
    it('AC-2: counts the server’s total in the toolbar, beside + Add lead, with no “shown”', async () => {
      render({ '/leads': { body: page([lead()], { total: 1 }) } });
      await screen.findByDisplayValue('Pak Budi');

      const count = screen.getByText('1 active lead');
      const add = screen.getByRole('button', { name: '+ Add lead' });
      // One toolbar row, as `Overall.html:2791-2794` has it.
      expect(count.parentElement).toContainElement(add);
      expect(screen.queryByText(/shown/)).not.toBeInTheDocument();
    });

    it('AC-2: sorts on the prototype’s four headings, Registered newest first', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const name of ['Lead name', 'Type', 'Status', 'Registered']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
      }
      const sorted = screen.getAllByRole('columnheader')
        .filter((th) => ['ascending', 'descending'].includes(th.getAttribute('aria-sort') ?? ''));
      expect(sorted).toHaveLength(1);
      expect(sorted[0]).toHaveTextContent('Registered');
      expect(sorted[0]).toHaveAttribute('aria-sort', 'descending');
      expect(lastRead(calls).get('sort')).toBe('dateRegistered');
      expect(lastRead(calls).get('dir')).toBe('desc');
    });

    it('AC-2: shows the Actions heading, as the prototype does', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const actions = screen.getByRole('columnheader', { name: 'Actions' });
      expect(actions.querySelector('.sr-only')).toBeNull();
    });

    it('AC-2: says what the Status select is waiting for', async () => {
      render({
        '/leads': {
          body: page([
            lead({ id: 'l1', type: null, statusCode: null }),
            lead({ id: 'l2', name: 'Calon', type: 'sales', statusCode: null }),
          ]),
        },
      });
      await screen.findByDisplayValue('Calon');

      const untyped = screen.getByLabelText('Status, row 1');
      expect(untyped).toBeDisabled();
      expect(within(untyped).getAllByRole('option').map((o) => o.textContent)).toEqual(['Select type first']);
      expect(within(screen.getByLabelText('Status, row 2')).getAllByRole('option')[0])
        .toHaveTextContent('Select status');
    });

    it('AC-2: offers the first one when there are none, inside the table', async () => {
      render({ '/leads': { body: page([]) } });

      const empty = await screen.findByText('No leads yet — add your first one above.');
      expect(empty.closest('table')).not.toBeNull();
      expect(screen.getByText('0 active leads')).toBeInTheDocument();
    });

    it('AC-2: lists each closed lead under its card, as {type} · {stage}', async () => {
      render({
        '/leads': { body: page([lead()]) },
        'outcome=won': { body: page([lead({ id: 'w1', name: 'Ibu Wulan Sari', outcome: 'won', statusCode: 'PAID_AND_ISSUED' })]) },
        'outcome=lost': { body: page([lead({ id: 'x1', name: 'Pak Joko', outcome: 'lost', type: 'recruitment', statusCode: 'NOT_APPROACHED' })]) },
      });

      expect(await screen.findByRole('heading', { name: 'Closed leads' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '✓ Successful' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '✕ Not successful' })).toBeInTheDocument();
      expect(screen.getByText('Sales · Paid and issued')).toBeInTheDocument();
      expect(screen.getByText('Recruitment · Not approached')).toBeInTheDocument();
    });

    it('AC-2: says so when a card holds nothing', async () => {
      render({ '/leads': { body: page([lead()]) } });

      expect(await screen.findByText('No successful leads yet.')).toBeInTheDocument();
      expect(screen.getByText('No lost leads yet.')).toBeInTheDocument();
    });
  });

  describe('AC-3 — Type and Status sort, on the server', () => {
    it('AC-3: sends Type as the sort key, ascending first and reversed on a second click', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: /^Type/ }));
      await waitFor(() => {
        expect(lastRead(calls).get('sort')).toBe('type');
        expect(lastRead(calls).get('dir')).toBe('asc');
      });

      await userEvent.click(screen.getByRole('button', { name: /^Type/ }));
      await waitFor(() => expect(lastRead(calls).get('dir')).toBe('desc'));
    });

    it('AC-3: sends Status and Lead name the same way, and marks the one it sorted', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: /^Status/ }));
      await waitFor(() => expect(lastRead(calls).get('sort')).toBe('status'));
      expect(screen.getByRole('columnheader', { name: /^Status/ })).toHaveAttribute('aria-sort', 'ascending');
      expect(screen.getByRole('columnheader', { name: /Registered/ })).toHaveAttribute('aria-sort', 'none');

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));
      await waitFor(() => expect(lastRead(calls).get('sort')).toBe('name'));
    });
  });

  describe('AC-4 — every lead, with no pager', () => {
    it('AC-4: lists 450 open leads in three requests of 200, and counts the total from the first', async () => {
      const all = many(1, 450);
      const reads = stubPaged((q) => {
        const n = Number(q.get('page'));
        return page(all.slice((n - 1) * 200, n * 200), { total: 450, page: n });
      });

      // Four hundred and fifty rows of controls is a heavy page for jsdom; the queries stay on the DOM.
      const names = () => document.querySelectorAll<HTMLInputElement>('tbody input[aria-label^="Lead name"]');
      await waitFor(() => expect(names()).toHaveLength(450), { timeout: 20_000 });

      expect(reads.map((q) => q.get('page'))).toEqual(['1', '2', '3']);
      expect(reads.every((q) => q.get('pageSize') === '200')).toBe(true);
      expect(names()[449]).toHaveValue('Lead 450');
      expect(names()[449]).toHaveAttribute('aria-label', 'Lead name, row 450');
      // The count is the first page's total, not the rows that had arrived when it was drawn.
      expect(document.body).toHaveTextContent('450 active leads');
    }, 30_000);

    it('AC-4: starts again from page one on a header sort, and drops the old order’s late page', async () => {
      let releaseStale: (body: unknown) => void = () => {};
      const reads = stubPaged((q) => {
        if (q.get('sort') === 'name') {
          return page([lead({ id: 'n1', name: 'Andi' }), lead({ id: 'n2', name: 'Budi' })], { total: 2 });
        }
        // Pages of three, as the server states them, so the table stays small enough to be quick.
        if (q.get('page') === '1') return page(many(1, 3), { total: 9, pageSize: 3 });
        // Page 2 of the first order is still on its way when the reader sorts.
        return new Promise((resolve) => { releaseStale = resolve; });
      });
      await screen.findByText('9 active leads');
      await waitFor(() => expect(reads).toHaveLength(2));

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));
      expect(await screen.findByDisplayValue('Andi')).toBeInTheDocument();

      await act(async () => { releaseStale(page(many(4, 3, 'Stale'), { total: 9, page: 2, pageSize: 3 })); });

      expect(screen.queryByDisplayValue('Stale 4')).not.toBeInTheDocument();
      expect(screen.getByText('2 active leads')).toBeInTheDocument();
      expect(document.querySelectorAll('tbody tr input[aria-label^="Lead name"]')).toHaveLength(2);
      // Nor did the dropped order go on to ask for its page 3.
      expect(reads.filter((q) => q.get('sort') === 'dateRegistered').map((q) => q.get('page'))).toEqual(['1', '2']);
      expect(reads.at(-1)!.get('page')).toBe('1');
    });

    it('AC-4: lists every closed lead the same way, with no See all', async () => {
      const wonAll = Array.from({ length: 230 }, (_, i) => lead({ id: `w${i}`, name: `Won ${i}`, outcome: 'won' }));
      stubPaged(() => page([lead()]), {
        'outcome=won&sort=dateRegistered&dir=desc&page=1&': { body: page(wonAll.slice(0, 200), { total: 230 }) },
        'outcome=won&sort=dateRegistered&dir=desc&page=2&': { body: page(wonAll.slice(200), { total: 230, page: 2 }) },
      });

      expect(await screen.findByText('Won 229')).toBeInTheDocument();
      const card = screen.getByRole('heading', { name: '✓ Successful' }).parentElement!;
      expect(card).toHaveTextContent('230');
      expect(screen.queryByRole('button', { name: /See all/ })).not.toBeInTheDocument();
    });

    it('AC-4: keeps the rows that arrived when a later page fails, and says so', async () => {
      stubPaged((q) => {
        if (q.get('page') === '1') return page(many(1, 3), { total: 5, pageSize: 3 });
        throw new TypeError('fetch failed');
      });

      expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument();
      expect(screen.getByLabelText('Lead name, row 3')).toHaveValue('Lead 3');
      expect(screen.getByText('5 active leads')).toBeInTheDocument();
    });

    it('AC-4: asks again from page one when a row leaves while pages are still arriving', async () => {
      let deleted = false;
      let releaseStale: (body: unknown) => void = () => {};
      const reads = stubPaged((q) => {
        if (!deleted) {
          if (q.get('page') === '1') return page(many(1, 3), { total: 5, pageSize: 3 });
          return new Promise((resolve) => { releaseStale = resolve; });
        }
        // With Lead 1 gone the server's order closes up, and Lead 4 is third.
        const left = many(2, 4);
        return q.get('page') === '1'
          ? page(left.slice(0, 3), { total: 4, pageSize: 3 })
          : page(left.slice(3), { total: 4, page: 2, pageSize: 3 });
      }, { '/leads/Lead-1': { body: { id: 'Lead-1', deletedAt: '2026-09-25T02:00:00.000Z' } } });
      await screen.findByText('5 active leads');
      await waitFor(() => expect(reads).toHaveLength(2));

      await userEvent.click(screen.getAllByRole('button', { name: 'Delete lead' })[0]);
      deleted = true;
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));
      // The page the old offsets asked for lands late, answered as the server now would: one past Lead 4.
      await act(async () => { releaseStale(page(many(5, 1), { total: 4, page: 2, pageSize: 3 })); });

      await waitFor(() => expect(document.querySelectorAll('tbody input[aria-label^="Lead name"]')).toHaveLength(4));
      expect(screen.getByDisplayValue('Lead 4')).toBeInTheDocument();
      expect(reads.map((q) => q.get('page'))).toEqual(['1', '2', '1', '2']);
    });

    it('AC-4: keeps what is being typed on another row when the restart’s first page lands, and it still saves', async () => {
      let deleted = false;
      let releaseRestart: (body: unknown) => void = () => {};
      const reads = stubPaged((q) => {
        if (!deleted) {
          return q.get('page') === '1' ? page(many(1, 3), { total: 5, pageSize: 3 }) : new Promise(() => {});
        }
        // With Lead 1 gone: the restart's page 1 waits until the reader is mid-word, then page 2.
        if (q.get('page') === '1') return new Promise((resolve) => { releaseRestart = resolve; });
        return page(many(5, 1), { total: 4, page: 2, pageSize: 3 });
      }, {
        '/leads/Lead-1': { body: { id: 'Lead-1', deletedAt: '2026-09-25T02:00:00.000Z' } },
        '/leads/Lead-2': { body: lead({ id: 'Lead-2', name: 'Lead 2', remarks: 'Hobi golf and tennis', version: 3 }) },
      });
      await screen.findByText('5 active leads');
      await waitFor(() => expect(reads).toHaveLength(2));

      await userEvent.click(screen.getAllByRole('button', { name: 'Delete lead' })[0]);
      deleted = true;
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));
      await waitFor(() => expect(reads).toHaveLength(3));

      const remarks = screen.getByLabelText('Remarks, row 1');
      await userEvent.type(remarks, ' and tennis');
      // Lead 2 comes back as it was, at the version the reader is typing against.
      await act(async () => { releaseRestart(page(many(2, 3), { total: 4, pageSize: 3 })); });

      await waitFor(() => expect(document.querySelectorAll('tbody input[aria-label^="Lead name"]')).toHaveLength(4));
      expect(remarks).toHaveValue('Hobi golf and tennis');
      expect(remarks).toHaveFocus();

      await userEvent.tab();
      await waitFor(() => {
        const patch = vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PATCH');
        expect(String(patch?.[0])).toContain('/leads/Lead-2');
        expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ remarks: 'Hobi golf and tennis', version: 2 });
      });
    });

    it('AC-4: drops the typing on a lead the restart moved to a later page that comes back changed there', async () => {
      /*
       * `shownAt` outlives the row: Lead 4 leaves the table when the restart's page 1 lands without
       * it, and returns on page 2 at version 7 — somebody else rewrote its remark meanwhile. Without
       * the version it was last shown at, the reader's old typing would be saved over that change.
       */
      let deleted = false;
      let releaseP1: (body: unknown) => void = () => {};
      let releaseP2: (body: unknown) => void = () => {};
      const reads = stubPaged((q) => {
        const n = q.get('page');
        if (!deleted) {
          if (n === '1') return page(many(1, 2), { total: 5, pageSize: 2 });
          if (n === '2') return page(many(3, 2), { total: 5, page: 2, pageSize: 2 });
          return new Promise(() => {});
        }
        if (n === '1') return new Promise((resolve) => { releaseP1 = resolve; });
        if (n === '2') return new Promise((resolve) => { releaseP2 = resolve; });
        return page([], { total: 4, page: 3, pageSize: 2 });
      }, {
        '/leads/Lead-1': { body: { id: 'Lead-1', deletedAt: '2026-09-25T02:00:00.000Z' } },
      });
      await waitFor(() => expect(screen.getByDisplayValue('Lead 4')).toBeInTheDocument());
      await waitFor(() => expect(reads).toHaveLength(3));
      await userEvent.click(screen.getAllByRole('button', { name: 'Delete lead' })[0]);
      deleted = true;
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));
      await waitFor(() => expect(reads).toHaveLength(4));

      await userEvent.type(screen.getByLabelText('Remarks, row 3'), ' x'); // Lead 4
      await act(async () => { releaseP1(page(many(2, 2), { total: 4, pageSize: 2 })); });
      await waitFor(() => expect(reads).toHaveLength(5));
      await act(async () => {
        releaseP2(page([
          lead({ id: 'Lead-4', name: 'Lead 4', remarks: 'Leader wrote this', version: 7 }),
          lead({ id: 'Lead-5', name: 'Lead 5' }),
        ], { total: 4, page: 2, pageSize: 2 }));
      });
      await waitFor(() => expect(screen.getByDisplayValue('Lead 4')).toBeInTheDocument());

      expect(screen.getByLabelText('Remarks, row 3')).toHaveValue('Leader wrote this');
      act(() => screen.getByLabelText('Remarks, row 3').focus());
      await userEvent.tab();
      await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
      expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'PATCH')).toHaveLength(0);
    });

    it('AC-4: keeps a refusal through a header sort on a lead that comes back as it was, and drops it on one that comes back changed', async () => {
      const refused = 'A lead needs a name of at least 2 characters.';
      render({
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina' })]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', refused),
        '/leads/l2': error(422, 'VALIDATION_FAILED', refused),
        // Somebody else renamed Bu Rina in the meantime; Pak Budi is as he was.
        'sort=name': { body: page([lead({ id: 'l2', name: 'Bu Rina Sari', version: 4 }), lead()]) },
      });
      await screen.findByDisplayValue('Bu Rina');
      for (const [row, letter] of [[1, 'B'], [2, 'R']] as const) {
        const name = screen.getByLabelText(`Lead name, row ${row}`);
        await userEvent.clear(name);
        await userEvent.type(name, letter);
        await userEvent.tab();
      }
      await waitFor(() => expect(screen.getAllByText(refused)).toHaveLength(2));

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));

      expect(await screen.findByDisplayValue('Bu Rina Sari')).toBeInTheDocument();
      // Pak Budi came back as he was: the B is still in his box, and still refused beneath it.
      expect(screen.getAllByText(refused)).toHaveLength(1);
      expect(rowOf(screen.getByText(refused)).previousElementSibling).toBe(rowOf(screen.getByDisplayValue('B')));
      // Bu Rina came back changed: the R over her new name went, and its refusal with it.
      expect(screen.queryByDisplayValue('R')).not.toBeInTheDocument();
    });

    it('AC-4: asks again when a stage change moves a row under the Status sort while pages are arriving', async () => {
      const reads = stubPaged((q) => (q.get('page') === '1'
        ? page(many(1, 3), { total: 5, pageSize: 3 })
        : new Promise(() => {})), {
        '/leads/Lead-1/status': { body: lead({ id: 'Lead-1', name: 'Lead 1', statusCode: 'PAID_AND_ISSUED', version: 3 }) },
      });
      await screen.findByText('5 active leads');
      await userEvent.click(screen.getByRole('button', { name: /^Status/ }));
      const firstPages = () => reads.filter((q) => q.get('sort') === 'status' && q.get('page') === '1');
      await waitFor(() => expect(reads.filter((q) => q.get('sort') === 'status')).toHaveLength(2));

      await userEvent.selectOptions(screen.getByLabelText('Status, row 1'), 'PAID_AND_ISSUED');

      await waitFor(() => expect(firstPages()).toHaveLength(2));
    });

    it('AC-4: shows a closed card that failed in its own place, and the other card stands', async () => {
      render({
        '/leads': { body: page([lead()]) },
        'outcome=won': error(500, 'INTERNAL_ERROR', 'Something went wrong.'),
        'outcome=lost': { body: page([lead({ id: 'x1', name: 'Pak Joko', outcome: 'lost' })]) },
      });

      const card = (title: string) => screen.getByRole('heading', { name: title }).parentElement!.parentElement!;
      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      expect(within(card('✓ Successful')).getByText('Something went wrong.')).toBeInTheDocument();
      expect(within(card('✕ Not successful')).getByText('Pak Joko')).toBeInTheDocument();
      expect(within(card('✕ Not successful')).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('AC-4: says how much of a closed card it is showing when a later page fails', async () => {
      const wonAll = Array.from({ length: 230 }, (_, i) => lead({ id: `w${i}`, name: `Won ${i}`, outcome: 'won' }));
      stubPaged(() => page([lead()]), {
        'outcome=won&sort=dateRegistered&dir=desc&page=1&': { body: page(wonAll.slice(0, 200), { total: 230 }) },
        'outcome=won&sort=dateRegistered&dir=desc&page=2&': error(500, 'INTERNAL_ERROR', 'Something went wrong.'),
      });

      expect(await screen.findByText('Showing 200 of 230 — the rest did not load.')).toBeInTheDocument();
      const card = screen.getByRole('heading', { name: '✓ Successful' }).parentElement!.parentElement!;
      expect(within(card).getByText('Something went wrong.')).toBeInTheDocument();
      expect(within(card).getByText('Won 199')).toBeInTheDocument();
    });
  });

  describe('AC-5 — the inline row', () => {
    it('AC-5: puts a row at the top, focused, and writes nothing yet', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

      const name = screen.getByLabelText('Lead name, row 1');
      expect(name).toHaveValue('');
      expect(name).toHaveFocus();
      expect(screen.getByLabelText('Lead name, row 2')).toHaveValue('Pak Budi');
      expect(writes(calls, 'POST')).toHaveLength(0);
    });

    it('AC-5: posts once, on the first valid name, however it is left — even while the first is on its way', async () => {
      const { mock } = stubFetch({ ...BASE, '/leads': { body: page([lead()]) } } as Parameters<typeof stubFetch>[0]);
      const posts: unknown[] = [];
      let release: () => void = () => {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method !== 'POST') return mock(url, init);
        posts.push(JSON.parse(String(init.body)));
        // Held open, so the Tab below lands while the Enter's create is still in flight.
        await new Promise<void>((resolve) => { release = resolve; });
        const body = lead({ id: 'l9', name: 'Pak Andi', type: null, statusCode: null, version: 1 });
        return { ok: true, status: 201, json: async () => body } as Response;
      }));
      renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'Pak Andi{Enter}');
      await userEvent.tab();
      // Tab lands on the next field of the same row, held rather than skipped while the row saves.
      expect(screen.getByLabelText('Type, row 1')).toHaveFocus();
      await act(async () => { release(); });

      await waitFor(() => expect(screen.getByLabelText('Type, row 1')).not.toHaveAttribute('aria-disabled'));
      expect(screen.getByLabelText('Type, row 1')).toHaveFocus();
      expect(posts).toEqual([{ name: 'Pak Andi' }]);
      expect(screen.getByText('2 active leads')).toBeInTheDocument();
    });

    it('AC-5: keeps the focus in the name box once it is saved', async () => {
      render({
        '/leads': [{ body: page([]) }, { body: lead({ id: 'l9', name: 'Pak Andi', type: null, statusCode: null }) }],
      });
      await screen.findByText('0 active leads');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'Pak Andi{Enter}');

      await waitFor(() => expect(screen.getByText('1 active lead')).toBeInTheDocument());
      expect(screen.getByLabelText('Lead name, row 1')).toHaveFocus();
    });

    it('AC-5: posts on leaving the box as well', async () => {
      const { calls } = render({
        '/leads': [{ body: page([]) }, { body: lead({ id: 'l9', name: 'Bu Rina', type: null, statusCode: null }) }],
      });
      await screen.findByText('0 active leads');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), '  Bu Rina ');
      await userEvent.tab();

      await waitFor(() => expect(lastBody(calls, 'POST')).toEqual({ name: 'Bu Rina' }));
    });

    it('AC-5: takes an empty row away and writes nothing', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), '   {Enter}');
      await userEvent.tab();

      await waitFor(() => expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('Pak Budi'));
      expect(writes(calls, 'POST')).toHaveLength(0);
    });

    it('AC-5: keeps a one-letter name in its row, unsaved, and says why beneath it until it is long enough', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'B');
      await userEvent.tab();

      const why = await screen.findByText('A lead’s name must be at least 2 characters.');
      // Announced, and in the refusal row beneath the draft — not left to be guessed.
      expect(why.closest('[role="alert"]')).not.toBeNull();
      expect(rowOf(why).previousElementSibling).toBe(rowOf(screen.getByLabelText('Lead name, row 1')));
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('B');
      // Nothing to write to until it is a lead.
      expect(screen.getByLabelText('Type, row 1')).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(screen.getAllByRole('button', { name: 'Contact details' })[0]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls, 'POST')).toHaveLength(0);

      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'u');
      expect(screen.queryByText('A lead’s name must be at least 2 characters.')).not.toBeInTheDocument();
    });

    it('AC-5: keeps the one-letter reason through a header sort — the inline row is in no list', async () => {
      render({
        '/leads': { body: page([lead()]) },
        'sort=name': { body: page([lead({ id: 'l2', name: 'Andi' }), lead()]) },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'B');
      // Leaving the box for the heading refuses the name; the sorted list lands after.
      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));

      expect(await screen.findByDisplayValue('Andi')).toBeInTheDocument();
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('B');
      const why = screen.getByText('A lead’s name must be at least 2 characters.');
      expect(rowOf(why).previousElementSibling).toBe(rowOf(screen.getByLabelText('Lead name, row 1')));
    });

    it('AC-5: goes back to the row already there rather than adding a second', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'B');
      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

      expect(screen.getByLabelText('Lead name, row 1')).toHaveFocus();
      expect(screen.getByLabelText('Lead name, row 2')).toHaveValue('Pak Budi');
      expect(screen.queryByLabelText('Lead name, row 3')).not.toBeInTheDocument();
    });

    it('AC-5: shows a refused create beneath the row, and keeps what was typed', async () => {
      render({
        '/leads': [
          { body: page([]) },
          error(422, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
        ],
      });
      await screen.findByText('0 active leads');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'Bu{Enter}');

      const refusal = await screen.findByText('A lead needs a name of at least 2 characters.');
      expect(rowOf(refusal)).not.toBe(rowOf(screen.getByLabelText('Lead name, row 1')));
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('Bu');
    });
  });

  describe('AC-6 — ✓ and ✕ ask first, in the prototype’s words', () => {
    it('AC-6: asks before ✕, and cancelling writes nothing', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Mark not successful' }));

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Mark Pak Budi as not successful? This moves them to the closed list.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(0);
    });

    it('AC-6: asks before ✓, and Escape writes nothing either', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Mark successful' }));
      expect(await screen.findByRole('dialog')).toHaveTextContent('Mark Pak Budi as a successful lead?');
      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(0);
    });

    it('AC-6: closes the lead once answered, and moves it to its card', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) },
        '/leads/l1/outcome': { body: lead({ statusCode: 'PAID_AND_ISSUED', outcome: 'won', version: 3 }) },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Mark successful' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark successful' }));

      await waitFor(() => expect(lastBody(calls)).toEqual({ outcome: 'won', version: 2 }));
      expect(await screen.findByText('Sales · Paid and issued')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Pak Budi')).not.toBeInTheDocument();
      expect(screen.getByText('0 active leads')).toBeInTheDocument();
    });

    it('AC-6: takes a refused name’s reason with the lead when it closes — its card has no name box', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', 'name must be 2–120 characters.'),
        '/leads/l1/outcome': { body: lead({ outcome: 'lost', version: 3 }) },
      });
      const name = await screen.findByLabelText('Lead name, row 1');
      await userEvent.clear(name);
      await userEvent.type(name, 'B');
      await userEvent.tab();
      await screen.findByText('name must be 2–120 characters.');

      await userEvent.click(screen.getByRole('button', { name: 'Mark not successful' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark not successful' }));

      const card = () => screen.getByRole('heading', { name: '✕ Not successful' }).parentElement!.parentElement!;
      expect(await within(card()).findByText('Pak Budi')).toBeInTheDocument();
      expect(within(card()).queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('name must be 2–120 characters.')).not.toBeInTheDocument();
    });

    it('AC-6: gates ✓ below the stage that closes the pipeline, and never gates ✕', async () => {
      render({ '/leads': { body: page([lead({ statusCode: 'FOLLOW_UP' })]) } });

      const won = await screen.findByRole('button', { name: 'Mark successful' });
      expect(won).toBeDisabled();
      expect(won).toHaveAttribute('title', 'Available once status reaches the final stage');
      expect(screen.getByRole('button', { name: 'Mark not successful' })).toBeEnabled();
    });
  });

  describe('AC-7 — This month waits for a type', () => {
    it('AC-7: is disabled until the lead has a type', async () => {
      render({
        '/leads': {
          body: page([
            lead({ id: 'l1', type: null, statusCode: null }),
            lead({ id: 'l2', name: 'Calon', type: 'recruitment', statusCode: null }),
          ]),
        },
      });
      await screen.findByDisplayValue('Calon');

      const rows = screen.getAllByRole('checkbox');
      expect(rows[0]).toBeDisabled();
      expect(rows[1]).toBeEnabled();
      // *Recruit*, not *Close*: they are different promises, and the box says which one it is.
      expect(screen.getByLabelText('Recruit this month')).toBe(rows[1]);
    });

    it('AC-7: ticks the month’s commitment as its own one-field write', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ thisMonth: true }) },
      });

      await userEvent.click(await screen.findByLabelText('Close this month'));

      await waitFor(() => expect(lastBody(calls)).toEqual({ thisMonth: true, version: 2 }));
    });
  });

  describe('AC-8 — contact details and the lawful basis, in a dialog', () => {
    const openContact = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Contact details' }));
      return screen.findByRole('dialog', { name: 'Contact details for Pak Budi' });
    };

    it('AC-8: opens from the Actions column, named, with the lawful basis first and focused', async () => {
      render({ '/leads': { body: page([lead()]) } });

      const glyph = await screen.findByRole('button', { name: 'Contact details' });
      expect(glyph.closest('td')).toBe(screen.getByRole('button', { name: 'Delete lead' }).closest('td'));
      const dialog = await openContact();

      const fields = within(dialog).getAllByRole('combobox').concat(within(dialog).getAllByRole('textbox'));
      expect(fields[0]).toBe(within(dialog).getByLabelText('Why you may hold these'));
      expect(within(dialog).getByLabelText('Why you may hold these')).toHaveFocus();
      const order = [...dialog.querySelectorAll('label')].map((l) => l.textContent);
      expect(order).toEqual(['Why you may hold these', 'Phone', 'Email', 'Where they came from']);
    });

    it('AC-8: records the lawful basis as one write', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ lawfulBasis: 'consent', version: 3 }) },
      });
      const dialog = await openContact();

      await userEvent.selectOptions(within(dialog).getByLabelText('Why you may hold these'), 'consent');

      await waitFor(() => expect(lastBody(calls)).toEqual({ lawfulBasis: 'consent', version: 2 }));
      expect(within(dialog).getByLabelText('Why you may hold these')).toHaveValue('consent');
    });

    it('AC-8: shows the server’s gate in the dialog, and beneath the lead once it closes', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'LEAD_CONSENT_REQUIRED', 'Record why you may hold these details first.'),
      });
      const dialog = await openContact();

      await userEvent.type(within(dialog).getByLabelText('Phone'), '0811');
      await userEvent.tab();

      expect(await within(dialog).findByText('Record why you may hold these details first.')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

      const refusal = screen.getByText('Record why you may hold these details first.');
      expect(rowOf(refusal).previousElementSibling).toBe(rowOf(screen.getByDisplayValue('Pak Budi')));
    });

    it('AC-8: sends a refused phone number again once the lawful basis is recorded', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': [
          error(422, 'LEAD_CONSENT_REQUIRED', 'Record why you may hold these details first.'),
          { body: lead({ lawfulBasis: 'consent', version: 3 }) },
          { body: lead({ lawfulBasis: 'consent', contact: { phone: '0811', email: null }, version: 4 }) },
        ],
      });
      const dialog = await openContact();
      await userEvent.type(within(dialog).getByLabelText('Phone'), '0811');
      await userEvent.tab();
      await within(dialog).findByText('Record why you may hold these details first.');

      await userEvent.selectOptions(within(dialog).getByLabelText('Why you may hold these'), 'consent');

      // The number goes again, at the version the basis left behind — not left looking saved.
      await waitFor(() => expect(writes(calls)).toHaveLength(3));
      expect(writes(calls).map((c) => JSON.parse(String(c.init.body)))).toEqual([
        { contact: { phone: '0811', email: null }, version: 2 },
        { lawfulBasis: 'consent', version: 2 },
        { contact: { phone: '0811', email: null }, version: 3 },
      ]);
      await waitFor(() => expect(screen.queryByText('Record why you may hold these details first.')).not.toBeInTheDocument());
      expect(within(dialog).getByLabelText('Phone')).toHaveValue('0811');
    });

    it('AC-8: keeps the refusal beside a phone number the basis did not unblock', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': [
          error(422, 'LEAD_CONSENT_REQUIRED', 'Record why you may hold these details first.'),
          { body: lead({ source: 'Referral', version: 3 }) },
        ],
      });
      const dialog = await openContact();
      await userEvent.type(within(dialog).getByLabelText('Phone'), '0811');
      await userEvent.tab();
      await within(dialog).findByText('Record why you may hold these details first.');

      // A different field saves; the refused number is still in its box, so its refusal stays.
      await userEvent.type(within(dialog).getByLabelText('Where they came from'), 'Referral');
      await userEvent.tab();

      await waitFor(() => expect(lastBody(calls)).toEqual({ source: 'Referral', version: 2 }));
      expect(within(dialog).getByText('Record why you may hold these details first.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Phone')).toHaveValue('0811');
    });

    it('AC-8: corrects one detail and keeps the other', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ lawfulBasis: 'consent', contact: { phone: '0812-1100-2200', email: null } })]) },
        '/leads/l1': { body: lead({ lawfulBasis: 'consent', contact: { phone: '0812-1100-2200', email: 'budi@example.com' }, version: 3 }) },
      });
      const dialog = await openContact();

      expect(within(dialog).getByLabelText('Phone')).toHaveValue('0812-1100-2200');
      await userEvent.type(within(dialog).getByLabelText('Email'), 'budi@example.com');
      await userEvent.tab();

      await waitFor(() => expect(lastBody(calls))
        .toEqual({ contact: { phone: '0812-1100-2200', email: 'budi@example.com' }, version: 2 }));
    });

    it('AC-8: clears a detail the seed stored, to nothing rather than an empty string', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ lawfulBasis: 'consent', contact: { phone: '0812', email: 'a@b.id' }, source: 'Referral' })]) },
        '/leads/l1': [
          { body: lead({ lawfulBasis: 'consent', contact: { phone: '0812', email: null }, source: 'Referral', version: 3 }) },
          { body: lead({ lawfulBasis: 'consent', contact: { phone: '0812', email: null }, source: null, version: 4 }) },
        ],
      });
      const dialog = await openContact();

      await userEvent.clear(within(dialog).getByLabelText('Email'));
      await userEvent.tab();
      await waitFor(() => expect(lastBody(calls)).toEqual({ contact: { phone: '0812', email: null }, version: 2 }));

      await userEvent.clear(within(dialog).getByLabelText('Where they came from'));
      await userEvent.tab();
      // Pinned at the version the first write left behind.
      await waitFor(() => expect(lastBody(calls)).toEqual({ source: null, version: 3 }));
    });

    it('AC-8: keeps Tab inside, and Escape takes the reader back to the glyph', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const dialog = await openContact();

      within(dialog).getByRole('button', { name: 'Close' }).focus();
      await userEvent.tab();
      expect(within(dialog).getByLabelText('Why you may hold these')).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Contact details' })).toHaveFocus();
    });

    it('AC-8: saves the field still being typed in when Escape closes it', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ lawfulBasis: 'consent' })]) },
        '/leads/l1': { body: lead({ lawfulBasis: 'consent', source: 'Referral — Desi' }) },
      });
      const dialog = await openContact();

      await userEvent.type(within(dialog).getByLabelText('Where they came from'), 'Referral — Desi');
      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(lastBody(calls)).toEqual({ source: 'Referral — Desi', version: 2 }));
    });

    it('AC-8: closes from the backdrop, but not from a click inside', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const dialog = await openContact();

      await userEvent.click(within(dialog).getByRole('heading'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await userEvent.click(dialog.parentElement!);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('AC-9 — the attribution, as a glyph', () => {
    it('AC-9: names whoever last changed a lead, when it was not the reader', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });

      const glyph = await screen.findByRole('button', { name: 'Last changed by Ibu Sari' });
      expect(glyph.closest('td')).toBe(screen.getByRole('button', { name: 'Contact details' }).closest('td'));
      // Named like the row's other glyph buttons: the glyph hidden, the words for a screen reader.
      expect(glyph.querySelector('[aria-hidden="true"]')).toHaveTextContent('✎');
    });

    it('AC-9: shows who to a keyboard, on focus, and Escape puts it away', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });
      const glyph = await screen.findByRole('button', { name: 'Last changed by Ibu Sari' });
      const tip = screen.getByText('Last changed by Ibu Sari', { selector: '[role="tooltip"]' });
      expect(tip).not.toBeVisible();

      act(() => glyph.focus());
      expect(glyph).toHaveFocus();
      expect(tip).toBeVisible();

      await userEvent.keyboard('{Escape}');
      expect(tip).not.toBeVisible();

      await userEvent.hover(glyph);
      expect(tip).toBeVisible();
      await userEvent.unhover(glyph);
      expect(tip).not.toBeVisible();
      fireEvent.click(glyph);
      await userEvent.tab();
      expect(tip).not.toBeVisible();
    });

    it('AC-9: keeps the words up while the pointer moves onto them, and Escape puts them away with the focus elsewhere', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });
      const glyph = await screen.findByRole('button', { name: 'Last changed by Ibu Sari' });
      const tip = screen.getByText('Last changed by Ibu Sari', { selector: '[role="tooltip"]' });

      // WCAG 1.4.13: a reader magnifying the screen moves onto the words to bring them into view.
      await userEvent.hover(glyph);
      await userEvent.hover(tip);
      expect(tip).toBeVisible();
      expect(tip.className).not.toContain('pointer-events-none');
      await userEvent.unhover(tip);
      expect(tip).not.toBeVisible();

      // Brought up by the pointer alone, so there is no focus on the glyph to hear the key.
      await userEvent.hover(glyph);
      expect(tip).toBeVisible();
      expect(glyph).not.toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(tip).not.toBeVisible();
    });

    it('AC-9: puts the words above the glyph, off the row’s other controls, and a press on them puts them away', async () => {
      /*
       * Drawn to the left, the bubble covered ✓, ✕, 🗑 and ☎ and took the next tap meant for them
       * (found 2026-09-30). jsdom cannot hit-test, so the placement is asserted as the classes that
       * decide it, and the escape hatch — a press on the bubble — as behaviour.
       */
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });
      const glyph = await screen.findByRole('button', { name: 'Last changed by Ibu Sari' });
      const tip = screen.getByText('Last changed by Ibu Sari', { selector: '[role="tooltip"]' });

      expect(tip.className).toContain('bottom-full');
      expect(tip.className).not.toContain('right-full');

      await userEvent.click(glyph);
      expect(tip).toBeVisible();
      fireEvent.pointerDown(tip);
      expect(tip).not.toBeVisible();
    });

    it('AC-9: shows who on a tap, where there is no hover and no focus to ask for it', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });
      const glyph = await screen.findByRole('button', { name: 'Last changed by Ibu Sari' });
      const tip = screen.getByText('Last changed by Ibu Sari', { selector: '[role="tooltip"]' });
      act(() => glyph.focus());
      await userEvent.keyboard('{Escape}');

      // Already focused, and no pointer moved onto it — so only the tap itself can bring it back.
      fireEvent.click(glyph);
      expect(tip).toBeVisible();
      // Said once to a screen reader, by the button's name — the bubble is not read a second time.
      expect(tip).toHaveAttribute('aria-hidden', 'true');
    });

    it('AC-9: says nothing when the last change was the owner’s own', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: null })]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.queryByRole('button', { name: /Last changed by/ })).not.toBeInTheDocument();
    });

    it('AC-9: says nothing to a leader about a change they made themselves', async () => {
      // A leader's screen shows their downline's leads; their own edit is not news to them.
      render({ '/leads': { body: page([lead({ ownerMembershipId: 'mem-7', lastEditedBy: { membershipId: 'mem-1', name: 'Rina' } })]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.queryByRole('button', { name: /Last changed by/ })).not.toBeInTheDocument();
    });

    it('AC-9: names the office rather than a blank when the membership resolves to nobody', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-gone', name: null } })]) } });

      expect(await screen.findByRole('button', { name: 'Last changed by someone in your office' })).toBeInTheDocument();
    });
  });

  describe('AC-10 — a refusal gets a row, delete asks, the type change asks', () => {
    it('AC-10: shows a refused write in a row beneath the lead, and keeps what was typed', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
      });
      const name = await screen.findByLabelText('Lead name, row 1');

      await userEvent.clear(name);
      await userEvent.type(name, 'B');
      await userEvent.tab();

      const refusal = await screen.findByText('A lead needs a name of at least 2 characters.');
      const below = rowOf(refusal);
      expect(below).not.toBe(rowOf(name));
      expect(below.previousElementSibling).toBe(rowOf(name));
      expect(refusal.closest('td')).toHaveAttribute('colspan', '9');
      expect(name).toHaveValue('B');
    });

    it('AC-10: takes the row away once the next write succeeds', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': [
          error(422, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
          { body: lead({ name: 'Budi Santoso', version: 3 }) },
        ],
      });
      const name = await screen.findByLabelText('Lead name, row 1');
      await userEvent.clear(name);
      await userEvent.type(name, 'B');
      await userEvent.tab();
      await screen.findByText('A lead needs a name of at least 2 characters.');

      await userEvent.type(name, 'udi Santoso');
      await userEvent.tab();

      await waitFor(() => expect(screen.queryByText(/at least 2 characters/)).not.toBeInTheDocument());
      expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    });

    it('AC-10: keeps a refused name’s row while a different field saves', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': [
          error(422, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
          { body: lead({ thisMonth: true, version: 3 }) },
        ],
      });
      const name = await screen.findByLabelText('Lead name, row 1');
      await userEvent.clear(name);
      await userEvent.type(name, 'B');
      await userEvent.tab();
      await screen.findByText('A lead needs a name of at least 2 characters.');

      await userEvent.click(screen.getByLabelText('Close this month'));

      await waitFor(() => expect(screen.getByLabelText('Close this month')).toBeChecked());
      // *B* is still in the box and still not the lead's name, so the reason stays with it.
      expect(screen.getByText('A lead needs a name of at least 2 characters.')).toBeInTheDocument();
      expect(name).toHaveValue('B');
    });

    it('AC-10: takes the row away, and writes nothing, when the refused text is put back as it was', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
      });
      const name = await screen.findByLabelText('Lead name, row 1');
      await userEvent.clear(name);
      await userEvent.type(name, 'B');
      await userEvent.tab();
      await screen.findByText('A lead needs a name of at least 2 characters.');

      await userEvent.clear(name);
      await userEvent.type(name, 'Pak Budi');
      await userEvent.tab();

      expect(screen.queryByText('A lead needs a name of at least 2 characters.')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(1);
    });

    it('AC-10: says a refusal once when both halves of the pair were refused for it', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'LEAD_CONSENT_REQUIRED', 'Record why you may hold these details first.'),
      });
      await userEvent.click(await screen.findByRole('button', { name: 'Contact details' }));
      const dialog = await screen.findByRole('dialog', { name: 'Contact details for Pak Budi' });

      await userEvent.type(within(dialog).getByLabelText('Phone'), '0811');
      await userEvent.tab();
      await within(dialog).findByText('Record why you may hold these details first.');
      await userEvent.type(within(dialog).getByLabelText('Email'), 'budi@example.com');
      await userEvent.tab();

      await waitFor(() => expect(within(dialog).getAllByRole('alert')).toHaveLength(1));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.getAllByText('Record why you may hold these details first.')).toHaveLength(1);
    });

    it('AC-10: holds the row still while a write is in flight, so Tab lands on the next field', async () => {
      const { mock } = stubFetch({ ...BASE, '/leads': { body: page([lead()]) } } as Parameters<typeof stubFetch>[0]);
      const patches: unknown[] = [];
      let release: () => void = () => {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method !== 'PATCH') return mock(url, init);
        patches.push(JSON.parse(String(init.body)));
        await new Promise<void>((resolve) => { release = resolve; });
        return { ok: true, status: 200, json: async () => lead({ name: 'Budi Santoso', version: 3 }) } as Response;
      }));
      renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
      const name = await screen.findByLabelText('Lead name, row 1');

      await userEvent.clear(name);
      await userEvent.type(name, 'Budi Santoso');
      await userEvent.tab();

      const type = screen.getByLabelText('Type, row 1');
      expect(type).toHaveFocus();
      // Held, not disabled: a disabled control drops the focus it has just been given.
      for (const label of ['Type', 'Status', 'Remarks', 'Next action date', 'Next action note']) {
        expect(screen.getByLabelText(`${label}, row 1`)).not.toBeDisabled();
      }
      for (const glyph of ['Mark not successful', 'Delete lead']) {
        expect(screen.getByRole('button', { name: glyph })).not.toBeDisabled();
        expect(screen.getByRole('button', { name: glyph })).toHaveAttribute('aria-disabled', 'true');
      }
      expect(type).toHaveAttribute('aria-disabled', 'true');
      expect(name).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Remarks, row 1')).toHaveAttribute('readonly');

      // And held means held: what is chosen in the meantime writes nothing and asks nothing.
      await userEvent.selectOptions(type, 'recruitment');
      await userEvent.selectOptions(screen.getByLabelText('Status, row 1'), 'PAID_AND_ISSUED');
      await userEvent.click(screen.getByLabelText('Close this month'));
      fireEvent.change(screen.getByLabelText('Next action date, row 1'), { target: { value: '2026-11-01' } });
      await userEvent.click(screen.getByRole('button', { name: 'Delete lead' }));
      await userEvent.click(screen.getByRole('button', { name: 'Mark not successful' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(patches).toHaveLength(1);
      expect(screen.getByLabelText('Close this month')).not.toBeChecked();

      await act(async () => { release(); });
      await waitFor(() => expect(type).not.toHaveAttribute('aria-disabled'));
      expect(type).toHaveValue('sales');
    });

    it('AC-10: puts the focus on the next lead’s name once a deleted row has left', async () => {
      render({
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina' })]) },
        '/leads/l1': { body: { id: 'l1', deletedAt: '2026-09-25T02:00:00.000Z' } },
      });
      await screen.findByDisplayValue('Bu Rina');

      await userEvent.click(screen.getAllByRole('button', { name: 'Delete lead' })[0]);
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));

      await waitFor(() => expect(screen.queryByDisplayValue('Pak Budi')).not.toBeInTheDocument());
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('Bu Rina');
      expect(screen.getByLabelText('Lead name, row 1')).toHaveFocus();
    });

    it('AC-10: leaves the focus alone when the reader has moved on before the row left', async () => {
      const { mock } = stubFetch({
        ...BASE,
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina' })]) },
      } as Parameters<typeof stubFetch>[0]);
      let release: () => void = () => {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method !== 'DELETE') return mock(url, init);
        await new Promise<void>((resolve) => { release = resolve; });
        return { ok: true, status: 200, json: async () => ({ id: 'l1', deletedAt: '2026-09-25T02:00:00.000Z' }) } as Response;
      }));
      renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
      await screen.findByDisplayValue('Bu Rina');

      await userEvent.click(screen.getAllByRole('button', { name: 'Delete lead' })[0]);
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));
      await userEvent.click(screen.getByLabelText('Remarks, row 2'));
      await act(async () => { release(); });

      await waitFor(() => expect(screen.queryByDisplayValue('Pak Budi')).not.toBeInTheDocument());
      expect(screen.getByLabelText('Remarks, row 1')).toHaveFocus();
    });

    it('AC-10: puts the focus on the lead before when the last row closes', async () => {
      render({
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina' })]) },
        '/leads/l2/outcome': { body: lead({ id: 'l2', name: 'Bu Rina', outcome: 'lost', version: 3 }) },
      });
      await screen.findByDisplayValue('Bu Rina');

      await userEvent.click(screen.getAllByRole('button', { name: 'Mark not successful' })[1]);
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark not successful' }));

      await waitFor(() => expect(screen.queryByDisplayValue('Bu Rina')).not.toBeInTheDocument());
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('Pak Budi');
      expect(screen.getByLabelText('Lead name, row 1')).toHaveFocus();
    });

    it('AC-10: puts the focus on + Add lead when the only row has left', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: { id: 'l1', deletedAt: '2026-09-25T02:00:00.000Z' } },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete lead' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));

      await screen.findByText('0 active leads');
      expect(screen.getByRole('button', { name: '+ Add lead' })).toHaveFocus();
    });

    it('AC-10: asks Delete {name}? — and deletes nothing when cancelled', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete lead' }));
      const dialog = await screen.findByRole('dialog');
      // Not *permanently*, not *can't be undone*: deleting is soft (I-101).
      expect(dialog).toHaveTextContent(/^Delete Pak Budi\?/);
      expect(dialog).not.toHaveTextContent(/permanently|undone/);
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      expect(writes(calls, 'DELETE')).toHaveLength(0);
    });

    it('AC-10: deletes through the route that only hides it, and the row leaves', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: { id: 'l1', deletedAt: '2026-09-25T02:00:00.000Z' } },
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete lead' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));

      await waitFor(() => expect(writes(calls, 'DELETE')).toHaveLength(1));
      await waitFor(() => expect(screen.queryByDisplayValue('Pak Budi')).not.toBeInTheDocument());
      expect(screen.getByText('0 active leads')).toBeInTheDocument();
    });

    it('AC-10: shows a refused delete beneath the lead', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(404, 'NOT_FOUND', 'Lead not found.'),
      });
      await screen.findByDisplayValue('Pak Budi');

      await userEvent.click(screen.getByRole('button', { name: 'Delete lead' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));

      expect(await screen.findByText('Lead not found.')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Pak Budi')).toBeInTheDocument();
    });

    it('AC-10: says what changing the type will cost before it does it (I-105)', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ thisMonth: true })]) } });

      await userEvent.selectOptions(await screen.findByLabelText('Type, row 1'), 'recruitment');

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('clears this lead’s stage');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(writes(calls)).toHaveLength(0);

      await userEvent.selectOptions(screen.getByLabelText('Type, row 1'), 'recruitment');
      await userEvent.click(await screen.findByRole('button', { name: 'Change the type' }));
      await waitFor(() => expect(lastBody(calls)).toEqual({ type: 'recruitment', version: 2 }));
    });

    it('AC-10: changes the type without asking when there is nothing to lose', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ type: null, statusCode: null })]) } });

      await userEvent.selectOptions(await screen.findByLabelText('Type, row 1'), 'sales');

      await waitFor(() => expect(lastBody(calls)).toEqual({ type: 'sales', version: 2 }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('the page body never scrolls sideways', () => {
    it('keeps every glyph’s screen-reader name inside a positioned box, so the table’s scroll box clips it', async () => {
      /*
       * `sr-only` is `position: absolute`. Placed against an ancestor outside the table's scroll box,
       * the Actions glyphs' names ran past a 1280px window and widened the page to 1379px (found
       * walking /leads, 2026-09-30). jsdom has no layout, so the rule that prevents it is asserted:
       * every such name has a positioned ancestor inside the scroll box.
       */
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByRole('button', { name: 'Contact details' });
      const scroller = screen.getByRole('table').closest('.overflow-x-auto')!;
      const names = Array.from(scroller.querySelectorAll('.sr-only'));
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        let at = name.parentElement;
        while (at && at !== scroller && !/(^|\s)(relative|absolute|fixed|sticky)(\s|$)/.test(at.className)) at = at.parentElement;
        expect(at, name.textContent ?? '').not.toBe(scroller);
      }
    });
  });

  describe('AC-11 — the attention flags leave the rows', () => {
    it('AC-11: draws no flag on a row that carries them', async () => {
      render({
        '/leads': { body: page([lead({ thisMonth: true, flags: ['overdue', 'no-remarks'], overdueDays: 14 })]) },
      });

      const table = within(await screen.findByRole('table'));
      expect(table.getByLabelText('Close this month')).toBeChecked();
      for (const flag of ['Overdue 14 days', 'Overdue', 'No remarks', 'No next action']) {
        expect(table.queryByText(flag)).not.toBeInTheDocument();
      }
    });
  });

  describe('AC-12 — the coaching card’s toolbar stays off here', () => {
    it('AC-12: renders no search box and no type filter on /leads', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Search leads')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Filter by type')).not.toBeInTheDocument();
      // The count stands where the coaching card's filters would.
      expect(screen.getByText('1 active lead')).toBeInTheDocument();
    });

    it('AC-12: never sends a search or a type filter from /leads', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const q of tableReads(calls)) {
        expect(q.get('search')).toBeNull();
        expect(q.get('type')).toBeNull();
      }
    });
  });

  describe('leader scope — 🗑 is the owner’s alone', () => {
    it('holds 🗑 in its place on a downline’s lead, focusable, saying why, and asking nothing', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ ownerMembershipId: 'mem-7' })]) } });

      const del = await screen.findByRole('button', { name: 'Delete lead' });
      expect(del).toHaveAttribute('aria-disabled', 'true');
      expect(del).toHaveAccessibleDescription('Only the person who owns this lead can delete it.');
      // Focusable — a reason nobody can reach is not given — and it shows the words when reached.
      act(() => del.focus());
      expect(del).toHaveFocus();
      expect(screen.getByRole('tooltip')).toHaveTextContent('Only the person who owns this lead can delete it.');

      await userEvent.click(del);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls, 'DELETE')).toHaveLength(0);
      // The column keeps its rhythm: ✓ ✕ 🗑 ☎ in their places.
      expect([...del.closest('td')!.querySelectorAll('button')].map((b) => b.textContent))
        .toEqual(['✓Mark successful', '✕Mark not successful', '🗑Delete lead', '☎Contact details']);
    });

    it('offers 🗑 on the reader’s own lead, with no reason to give', async () => {
      render({ '/leads': { body: page([lead({ ownerMembershipId: 'mem-1' })]) } });

      const del = await screen.findByRole('button', { name: 'Delete lead' });
      expect(del).not.toHaveAttribute('aria-disabled');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('moving, closing and reopening', () => {
    it('offers only this lead’s own ladder', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const status = await screen.findByLabelText('Status, row 1');

      const options = within(status).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual(['Select status', 'Not yet approached', 'Follow-up', 'Paid and issued']);
    });

    it('moves the lead through the route that records the move', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1/status': { body: lead({ statusCode: 'PAID_AND_ISSUED', version: 3 }) },
      });

      await userEvent.selectOptions(await screen.findByLabelText('Status, row 1'), 'PAID_AND_ISSUED');

      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/leads/l1/status')).at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ statusCode: 'PAID_AND_ISSUED', version: 2 });
      });
      // And ✓ opens once the lead stands on the stage that closes its ladder.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Mark successful' })).toBeEnabled());
    });

    it('shows the server’s pipeline refusal beneath the lead', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1/status': error(422, 'LEAD_STATUS_WRONG_PIPELINE', 'AAJI_LICENSED belongs to the recruitment ladder; this is a sales lead.'),
      });

      await userEvent.selectOptions(await screen.findByLabelText('Status, row 1'), 'PAID_AND_ISSUED');

      expect(await screen.findByText(/belongs to the recruitment ladder/)).toBeInTheDocument();
    });

    it('catches up when somebody else has already closed it, and moves it to its card', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1/status': error(409, 'LEAD_ALREADY_CLOSED', 'This lead is closed.'),
        '/leads/l1': { body: lead({ outcome: 'won', statusCode: 'PAID_AND_ISSUED', version: 5 }) },
      });

      await userEvent.selectOptions(await screen.findByLabelText('Status, row 1'), 'PAID_AND_ISSUED');

      expect(await screen.findByText('Sales · Paid and issued')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByDisplayValue('Pak Budi')).not.toBeInTheDocument());
    });

    it('reloads the row on a stale write rather than arguing with it', async () => {
      render({
        '/leads': { body: page([lead({ version: 7, remarks: 'Mine.' })]) },
        '/leads/l1': [
          error(409, 'VERSION_CONFLICT', 'This record changed since you loaded it. Reload and try again.'),
          { body: lead({ version: 9, remarks: 'What the leader saved.' }) },
        ],
      });

      const remarks = await screen.findByLabelText('Remarks, row 1');
      await userEvent.clear(remarks);
      await userEvent.type(remarks, 'Stale.');
      await userEvent.tab();

      expect(await screen.findByText(/changed since you loaded it/)).toBeInTheDocument();
      await waitFor(() => expect(screen.getByLabelText('Remarks, row 1')).toHaveValue('What the leader saved.'));
    });

    it('pins a move, and then pins what the move left behind', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ version: 7 })]) },
        '/leads/l1/status': { body: lead({ version: 8, statusCode: 'PAID_AND_ISSUED' }) },
        '/leads/l1/outcome': { body: lead({ version: 9, statusCode: 'PAID_AND_ISSUED', outcome: 'won' }) },
      });

      await userEvent.selectOptions(await screen.findByLabelText('Status, row 1'), 'PAID_AND_ISSUED');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Mark successful' })).toBeEnabled());
      await userEvent.click(screen.getByRole('button', { name: 'Mark successful' }));
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark successful' }));

      await waitFor(() => {
        const sent = calls.filter((c) => c.url.includes('/outcome')).at(-1);
        expect(JSON.parse(String(sent?.init.body))).toEqual({ outcome: 'won', version: 8 });
      });
    });

    it('reopens from the card, and asks the table again so the lead lands where the order puts it', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        'outcome=won': { body: page([lead({ id: 'w1', name: 'Ibu Wulan Sari', outcome: 'won', statusCode: 'PAID_AND_ISSUED' })]) },
        '/leads/w1/outcome': { body: lead({ id: 'w1', name: 'Ibu Wulan Sari', outcome: null }) },
      });
      await screen.findByText('Ibu Wulan Sari');
      const before = tableReads(calls).length;

      await userEvent.click(screen.getByRole('button', { name: '↺ Move to active' }));

      await waitFor(() => expect(lastBody(calls)).toMatchObject({ outcome: null }));
      await waitFor(() => expect(tableReads(calls).length).toBeGreaterThan(before));
      expect(screen.queryByText('Ibu Wulan Sari')).not.toBeInTheDocument();
      expect(await screen.findByText('No successful leads yet.')).toBeInTheDocument();
    });

    it('shows a refused reopen on the card row it was asked from', async () => {
      render({
        '/leads': { body: page([lead()]) },
        'outcome=lost': { body: page([lead({ id: 'x1', name: 'Pak Joko', outcome: 'lost' })]) },
        '/leads/x1/outcome': error(409, 'VERSION_CONFLICT', 'This record changed since you loaded it.'),
      });

      await userEvent.click(await screen.findByRole('button', { name: '↺ Move to active' }));

      expect(await screen.findByText('This record changed since you loaded it.')).toBeInTheDocument();
      expect(screen.getByText('Pak Joko')).toBeInTheDocument();
    });

    it('shows a retired stage as the code the lead still holds', async () => {
      render({ '/leads': { body: page([lead({ statusCode: 'RETIRED_STAGE' })]) } });

      expect(await screen.findByRole('option', { name: 'RETIRED_STAGE (retired)' })).toBeInTheDocument();
    });
  });

  describe('the rest of the row', () => {
    it('sends only the field that changed', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ remarks: 'Hot button: Hubungan', version: 3 }) },
      });
      const remarks = await screen.findByLabelText('Remarks, row 1');

      await userEvent.clear(remarks);
      await userEvent.type(remarks, 'Hot button: Hubungan');
      await userEvent.tab();

      await waitFor(() => expect(lastBody(calls)).toEqual({ remarks: 'Hot button: Hubungan', version: 2 }));
    });

    it('finishes a remark on Enter rather than starting a second line', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ remarks: null })]) },
        '/leads/l1': { body: lead({ remarks: 'Hobi golf' }) },
      });
      const remarks = await screen.findByLabelText('Remarks, row 1');

      await userEvent.type(remarks, 'Hobi golf{Enter}');

      await waitFor(() => expect(lastBody(calls)).toEqual({ remarks: 'Hobi golf', version: 2 }));
      expect(remarks).not.toHaveFocus();
    });

    it('writes nothing when a field is left as it was', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      const name = await screen.findByLabelText('Lead name, row 1');

      await userEvent.click(name);
      await userEvent.tab();

      expect(writes(calls)).toHaveLength(0);
    });

    it('sends the next-action note as its own write, and clears a date to nothing', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead() },
      });

      await userEvent.type(await screen.findByLabelText('Next action note, row 1'), 'Meet at Starbucks{Enter}');
      await waitFor(() => expect(lastBody(calls)).toEqual({ nextActionNote: 'Meet at Starbucks', version: 2 }));

      await userEvent.clear(screen.getByLabelText('Next action date, row 1'));
      await waitFor(() => expect(lastBody(calls)).toEqual({ nextActionDate: null, version: 2 }));
    });
  });

  describe('every state', () => {
    it('shows a skeleton shaped like the table while it loads', () => {
      render({ '/leads': { body: page([lead()]) } });

      expect(screen.getByRole('status')).toHaveTextContent('Loading your leads…');
    });

    it('renders the server’s refusal rather than an empty table', async () => {
      render({ '/leads': error(500, 'INTERNAL_ERROR', 'Something went wrong.') });

      expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('refuses the screen to somebody without lead:read', async () => {
      render({ '/leads': { body: page([]) } }, makeMe({ permissions: [] }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Not available to you');
      // The gate's code is on the refusal as data, and never in its words (P11-T6).
      expect(screen.getByRole('alert')).toHaveAttribute('data-permission', 'lead:read');
      expect(screen.queryByText('lead:read')).not.toBeInTheDocument();
    });

    it('scrolls the table inside its own container on a phone, not the page body', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const table = screen.getByRole('table');
      expect(table.className).toMatch(/min-w-/);
      expect(table.parentElement?.className).toContain('overflow-x-auto');
    });
  });

  describe('the prototype’s own shape', () => {
    it('packs the table to the prototype’s density, with nine fixed columns', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const table = document.querySelector('table')!;
      expect(table.className).toContain('table-fixed');
      expect(table.querySelectorAll('colgroup col')).toHaveLength(9);
    });

    it('reads as a list, not a form — every cell is text until you touch it', async () => {
      render({ '/leads': { body: page([lead()]) } });

      const name = await screen.findByDisplayValue('Pak Budi');
      expect(name.className).toContain('border-transparent');
      expect(name.className).toContain('hover:border-hairline');
    });

    it('tints a stage by where it sits on its own ladder, with navy words', async () => {
      render({
        '/leads': {
          body: page([
            lead({ id: 'l1', name: 'First rung', statusCode: 'NOT_YET_APPROACHED' }),
            lead({ id: 'l2', name: 'Last rung', statusCode: 'PAID_AND_ISSUED' }),
            lead({ id: 'l3', name: 'Calon', type: 'recruitment', statusCode: 'NOT_APPROACHED' }),
          ]),
        },
      });

      await screen.findByDisplayValue('First rung');
      expect(screen.getByLabelText('Status, row 1').className).toContain('bg-alert');
      expect(screen.getByLabelText('Status, row 2').className).toContain('bg-success');
      expect(screen.getByLabelText('Status, row 1').className).toContain('text-navy');
    });

    it('colours the Type word with no background, as the prototype does', async () => {
      /*
       * `.type-badge-select` (`Overall.html:476-477`) colours the word on a transparent cell, and
       * an unchosen type is the plain grey placeholder (`:473`). The client, 2026-10-01: Type had
       * been given Status's tinted box and the two read as one control twice. Sales is amber-ink —
       * the prototype's amber-dark is 2.99:1 at this size (a11y.spec.tsx).
       */
      render({
        '/leads': {
          body: page([
            lead({ id: 'l1', name: 'Pak Budi' }),
            lead({ id: 'l2', name: 'Calon', type: 'recruitment', statusCode: 'NOT_APPROACHED' }),
            lead({ id: 'l3', name: 'Belum', type: null, statusCode: null }),
          ]),
        },
      });
      await screen.findByDisplayValue('Pak Budi');

      const sales = screen.getByLabelText('Type, row 1').className;
      expect(sales).toContain('text-amber-ink');
      expect(sales).toContain('font-semibold');
      expect(sales).not.toMatch(/(^|\s)bg-amber/);

      const recruitment = screen.getByLabelText('Type, row 2').className;
      expect(recruitment).toContain('text-navy-soft');
      expect(recruitment).toContain('font-semibold');
      expect(recruitment).not.toMatch(/(^|\s)bg-navy-soft/);

      const none = screen.getByLabelText('Type, row 3').className;
      expect(none).toContain('text-muted');
      expect(none).not.toContain('font-semibold');

      // The cell's own ground — transparent, hairline on hover — is all any of them has.
      for (const cls of [sales, recruitment, none]) {
        expect(cls).toContain('bg-transparent');
        expect(cls).toContain('border-transparent');
        expect(cls).toContain('hover:border-hairline');
      }
    });

    it('gives the row its glyph buttons, each still saying what it does', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const name of ['Mark successful', 'Mark not successful', 'Delete lead', 'Contact details']) {
        const button = screen.getByRole('button', { name });
        expect(button.className).toContain('h-7');
        expect(button).toHaveAttribute('title', expect.any(String));
      }
      expect(screen.getByRole('button', { name: 'Mark successful' }).className).toContain('hover:text-success');
      expect(screen.getByRole('button', { name: 'Mark not successful' }).className).toContain('hover:text-alert');
    });
  });
});
