import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import { axe } from 'vitest-axe';
import { makeMe, renderInLayout, stubFetch } from '@test/harness';
import { PHONE_QUERY } from '@/lib/use-phone';
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

/** A lead's ⋮ (P13.1-T4 AC-3) — the `index`th of that name, for a list where names repeat. */
const actionsOf = (name = 'Pak Budi', index = 0) => screen.getAllByRole('button', { name: `Actions for ${name}` })[index];

/** Open a lead's ⋮ and choose one of its items. */
async function choose(item: string, name = 'Pak Budi', index = 0) {
  await userEvent.click(actionsOf(name, index));
  await userEvent.click(screen.getByRole('menuitem', { name: item }));
}

/** Open a lead's ⋮ and hand back one of its items, to look at rather than choose. */
async function menuItem(item: string, name = 'Pak Budi', index = 0) {
  await userEvent.click(actionsOf(name, index));
  return screen.getByRole('menuitem', { name: item });
}

/**
 * A box of a given width, as far as the table can ask (P13.1-T4 AC-7): the `ResizeObserver` jsdom does
 * not have, answering at once as a browser's does when it starts observing. Every observer answers with
 * the same width — the table's box and each remark box alike.
 */
function boxWidth(width: number) {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, contentRect: { width } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  });
}

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
    // P13.1-T4 AC-4: the registration date is in the lead's details now, not on the row.
    expect(screen.queryByText('4 Sep 2026')).not.toBeInTheDocument();
  });

  it('P18.95-T7 AC-1 keeps the sub-line from 768px and draws it nowhere on a phone (grey text row 25)', async () => {
    render({ '/leads': { body: page([lead()]) } });
    await screen.findByDisplayValue('Pak Budi');
    expect(screen.getByText('Track and follow up on your sales and recruitment leads.')).toHaveClass('max-md:hidden');
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

    // *Amended 2026-10-26 (P18.95-T4 AC-2, ADR-0167 §4):* the client asked for a search and two filters back —
    // `Search leads`, *Type* and *Status* — so this pins what has **not** come back with them.
    it('AC-1: has none of the old filter card’s Stage, Show, Needs attention or Clear', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const label of ['Search', 'Stage', 'Show', 'Needs attention']) {
        expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
      }
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

    it('P13.1-T4 AC-4, P18.8-T7 AC-3: sorts on three headings, with no Registered column, and opens in the saved order', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const name of ['Lead name', 'Type', 'Status']) {
        expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
      }
      expect(screen.queryByRole('columnheader', { name: /Registered/ })).not.toBeInTheDocument();
      expect(screen.getAllByRole('columnheader').map((th) => th.textContent?.replace(/[▲▼⇅]/g, '').trim()))
        .toEqual(['Row', 'Lead name', 'Type', 'Status', 'This month', 'Remarks', 'Next action', 'Actions']);
      // The default order is no heading's: none of them claims it.
      const sorted = screen.getAllByRole('columnheader')
        .filter((th) => ['ascending', 'descending'].includes(th.getAttribute('aria-sort') ?? ''));
      expect(sorted).toHaveLength(0);
      // P18.8-T7 AC-3: no sort at all, which the server answers in the owner's own order.
      expect(lastRead(calls).get('sort')).toBeNull();
      expect(lastRead(calls).get('dir')).toBeNull();
    });

    it('P13.1-T4 AC-4, P18.8-T7 AC-4: comes back to the saved order on a heading’s third press', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const heading = () => screen.getByRole('button', { name: /Lead name/ });
      await userEvent.click(heading());
      await waitFor(() => expect(lastRead(calls).get('dir')).toBe('asc'));
      await userEvent.click(heading());
      await waitFor(() => expect(lastRead(calls).get('dir')).toBe('desc'));
      expect(lastRead(calls).get('sort')).toBe('name');
      await userEvent.click(heading());

      await waitFor(() => expect(lastRead(calls).get('sort')).toBeNull());
      expect(lastRead(calls).get('dir')).toBeNull();
      expect(screen.getByRole('columnheader', { name: /Lead name/ })).toHaveAttribute('aria-sort', 'none');
      // A sort is a look: nothing was saved by any of it.
      expect(writes(calls)).toHaveLength(0);
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

    it('P13.2-T6 AC-8: an office with no stages at all lists its leads, a stage-less one included, and never errors', async () => {
      // An office started Empty (ADR-0115 §1): both pipelines, each with no stage, until the Owner adds one.
      render({
        '/kpm/config': {
          body: { activity: [], ratios: [], version: 1, leadPipelines: [
            { pipeline: 'sales', statuses: [] }, { pipeline: 'recruitment', statuses: [] },
          ] },
        },
        '/leads': { body: page([lead({ statusCode: null })]) },
      });

      expect(await screen.findByDisplayValue('Pak Budi')).toBeInTheDocument();
      const status = screen.getByLabelText('Status, row 1');
      expect(within(status).getAllByRole('option').map((o) => o.textContent)).toEqual(['Select status']);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
      // P18.8-T7 AC-6: *Recruit*, wherever the type is named.
      expect(screen.getByText('Recruit · Not approached')).toBeInTheDocument();
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
      expect(screen.getByRole('columnheader', { name: /^Type/ })).toHaveAttribute('aria-sort', 'none');

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));
      await waitFor(() => expect(lastRead(calls).get('sort')).toBe('name'));
    });
  });

  describe('AC-4 — every lead loads, with no pager', () => {
    /*
     * Drawing 450 rows of controls at once is the heaviest thing jsdom does in this suite: about 11 s on a laptop under
     * coverage, and 31 s on GitHub's 2-vCPU runner on 2026-10-28, past the 30 s it had — the same before Phase 18.97 and
     * after it. A CI runner gets three times the room, as `vitest.config.mts` gives every test (`testing-strategy.md`,
     * *Timeouts on a CI runner*); a laptop keeps 30 s, so a draw that has really slowed down still fails where it is written.
     */
    const HEAVY_TEST_MS = process.env.CI ? 90_000 : 30_000;
    const HEAVY_DRAW_MS = process.env.CI ? 60_000 : 20_000;

    it('AC-4, P13.1-T4 AC-8: loads 450 open leads in three requests of 200, draws 30, and the rest on Show more', async () => {
      const all = many(1, 450);
      const reads = stubPaged((q) => {
        const n = Number(q.get('page'));
        return page(all.slice((n - 1) * 200, n * 200), { total: 450, page: n });
      });

      // Four hundred and fifty rows of controls is a heavy page for jsdom; the queries stay on the DOM.
      const names = () => document.querySelectorAll<HTMLInputElement>('tbody input[aria-label^="Lead name"]');
      await waitFor(() => expect(reads).toHaveLength(3));
      await waitFor(() => expect(names()).toHaveLength(30));
      // The count is the first page's total — the whole list — not the rows drawn.
      expect(document.body).toHaveTextContent('450 active leads');

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
      await waitFor(() => expect(names()).toHaveLength(450), { timeout: HEAVY_DRAW_MS });

      expect(reads.map((q) => q.get('page'))).toEqual(['1', '2', '3']);
      expect(reads.every((q) => q.get('pageSize') === '200')).toBe(true);
      expect(names()[449]).toHaveValue('Lead 450');
      expect(names()[449]).toHaveAttribute('aria-label', 'Lead name, row 450');
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    }, HEAVY_TEST_MS);

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
      expect(reads.filter((q) => q.get('sort') === null).map((q) => q.get('page'))).toEqual(['1', '2']);
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

      await choose('Delete', 'Lead 1');
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

      await choose('Delete', 'Lead 1');
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
      await choose('Delete', 'Lead 1');
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

      // The heading, not a refused name's *Couldn't save — retry: Lead name, row 1* (P18.95-T1 AC-5).
      await userEvent.click(screen.getByRole('button', { name: /^Lead name/ }));

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
      // Its ⋮ is there, and opens nothing until the row is a lead (P13.1-T4 AC-3).
      expect(actionsOf('B')).toHaveAttribute('aria-disabled', 'true');
      await userEvent.click(actionsOf('B'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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

      await choose('Mark not successful');

      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent('Mark Pak Budi as not successful? This moves them to the closed list.');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(0);
    });

    it('AC-6: asks before ✓, and Escape writes nothing either', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) } });
      await screen.findByDisplayValue('Pak Budi');

      await choose('Mark successful');
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

      await choose('Mark successful');
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

      // The ⋮ is named for the lead as it is stored — the refused *B* is only typing.
      await choose('Mark not successful');
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Mark not successful' }));

      const card = () => screen.getByRole('heading', { name: '✕ Not successful' }).parentElement!.parentElement!;
      expect(await within(card()).findByText('Pak Budi')).toBeInTheDocument();
      expect(within(card()).queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('name must be 2–120 characters.')).not.toBeInTheDocument();
    });

    it('AC-6, P13.1-T4 AC-3: gates ✓ below the stage that closes the pipeline, saying why, and never gates ✕', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ statusCode: 'FOLLOW_UP' })]) } });
      await screen.findByDisplayValue('Pak Budi');

      const won = await menuItem('Mark successful');
      expect(won).toHaveAttribute('aria-disabled', 'true');
      expect(won).toHaveAccessibleDescription('Available once status reaches the final stage');
      // On the screen too, beneath it — a tap has no hover to bring up a tooltip.
      expect(within(screen.getByRole('menu')).getByText('Available once status reaches the final stage')).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Mark not successful' })).not.toHaveAttribute('aria-disabled');

      await userEvent.click(won);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls)).toHaveLength(0);
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

  describe('P13.1-T4 AC-1, AC-2 — the lead’s details, in a dialog', () => {
    const openDetails = async (name = 'Pak Budi') => {
      await screen.findByDisplayValue(name);
      await choose('Lead details', name);
      return screen.findByRole('dialog', { name: `Lead details for ${name}` });
    };

    it('P13.1-T4 AC-2: opens from the ⋮ menu as Lead details, the phone first and focused', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const dialog = await openDetails();

      expect(within(dialog).getByLabelText('Phone')).toHaveFocus();
      const order = [...dialog.querySelectorAll('label')].map((l) => l.textContent);
      expect(order).toEqual(['Phone', 'Email', 'Where they came from']);
      expect(screen.queryByRole('dialog', { name: /Contact details/ })).not.toBeInTheDocument();
    });

    it('P18.96-T1 AC-2: the table behind holds still while the details are open, and scrolls again once they close', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const dialog = await openDetails();
      expect(dialog).toHaveClass('overflow-y-auto', 'overscroll-contain');
      expect(document.body.style.overflow).toBe('hidden');
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /Lead details/ })).not.toBeInTheDocument());
      expect(document.body.style.overflow).toBe('');
    });

    it('P13.1-T4 AC-1: asks no lawful basis — the field and its words are gone', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const dialog = await openDetails();

      expect(within(dialog).queryByLabelText('Why you may hold these')).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
      expect(dialog).not.toHaveTextContent(/Required before a phone number/);
    });

    it('P13.1-T4 AC-1: saves a phone number on its own, with no ground beside it', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ contact: { phone: '0811', email: null }, version: 3 }) },
      });
      const dialog = await openDetails();

      await userEvent.type(within(dialog).getByLabelText('Phone'), '0811');
      await userEvent.tab();

      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(lastBody(calls)).toEqual({ contact: { phone: '0811', email: null }, version: 2 });
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-2: says when the lead was registered, and who last changed it', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });
      const dialog = await openDetails();

      expect(within(dialog).getByText('Registered', { exact: false })).toHaveTextContent('Registered 4 Sep 2026');
      expect(within(dialog).getByText('4 Sep 2026').closest('time')).toHaveAttribute('dateTime', '2026-09-04T03:00:00.000Z');
      expect(within(dialog).getByText('Last changed by Ibu Sari')).toBeInTheDocument();
      // ADR-0044's ✎ moved here: the row carries no attribution of its own.
      expect(screen.queryByRole('button', { name: /Last changed by/ })).not.toBeInTheDocument();
    });

    it('P18.8-T7 AC-5: offers no WhatsApp in the dialog any more — it is beside the row’s ⋮', async () => {
      render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) } });
      const dialog = await openDetails();

      expect(within(dialog).queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
      expect(within(dialog).queryByText('WhatsApp')).not.toBeInTheDocument();
      expect(within(dialog).getByLabelText('Phone')).toHaveValue('0812-1100-2200');
    });

    it('P18.8-T7 AC-5: links the row to the number the dialog saves, once it is saved', async () => {
      render({
        '/leads': { body: page([lead({ contact: { phone: '123', email: null } })]) },
        '/leads/l1': { body: lead({ contact: { phone: '+62 812 1100 2200', email: null }, version: 3 }) },
      });
      const dialog = await openDetails();
      expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();

      await userEvent.clear(within(dialog).getByLabelText('Phone'));
      await userEvent.type(within(dialog).getByLabelText('Phone'), '+62 812 1100 2200');
      await userEvent.tab();

      await waitFor(() => expect(screen.getByRole('link', { name: 'Chat with Pak Budi on WhatsApp (opens in a new tab)' }))
        .toHaveAttribute('href', 'https://wa.me/6281211002200'));
    });

    it('AC-8: corrects one detail and keeps the other', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) },
        '/leads/l1': { body: lead({ contact: { phone: '0812-1100-2200', email: 'budi@example.com' }, version: 3 }) },
      });
      const dialog = await openDetails();

      expect(within(dialog).getByLabelText('Phone')).toHaveValue('0812-1100-2200');
      await userEvent.type(within(dialog).getByLabelText('Email'), 'budi@example.com');
      await userEvent.tab();

      await waitFor(() => expect(lastBody(calls))
        .toEqual({ contact: { phone: '0812-1100-2200', email: 'budi@example.com' }, version: 2 }));
    });

    it('AC-8: clears a detail the seed stored, to nothing rather than an empty string', async () => {
      const { calls } = render({
        '/leads': { body: page([lead({ contact: { phone: '0812', email: 'a@b.id' }, source: 'Referral' })]) },
        '/leads/l1': [
          { body: lead({ contact: { phone: '0812', email: null }, source: 'Referral', version: 3 }) },
          { body: lead({ contact: { phone: '0812', email: null }, source: null, version: 4 }) },
        ],
      });
      const dialog = await openDetails();

      await userEvent.clear(within(dialog).getByLabelText('Email'));
      await userEvent.tab();
      await waitFor(() => expect(lastBody(calls)).toEqual({ contact: { phone: '0812', email: null }, version: 2 }));

      await userEvent.clear(within(dialog).getByLabelText('Where they came from'));
      await userEvent.tab();
      // Pinned at the version the first write left behind.
      await waitFor(() => expect(lastBody(calls)).toEqual({ source: null, version: 3 }));
    });

    it('AC-8: shows a refused detail in the dialog, and beneath the lead once it closes', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', 'contact.email must be an email address.'),
      });
      const dialog = await openDetails();

      await userEvent.type(within(dialog).getByLabelText('Email'), 'budi');
      await userEvent.tab();

      expect(await within(dialog).findByText('contact.email must be an email address.')).toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));

      const refusal = screen.getByText('contact.email must be an email address.');
      expect(rowOf(refusal).previousElementSibling).toBe(rowOf(screen.getByDisplayValue('Pak Budi')));
    });

    it('AC-8: keeps Tab inside, and Escape takes the reader back to the ⋮', async () => {
      render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) } });
      const dialog = await openDetails();

      within(dialog).getByRole('button', { name: 'Close' }).focus();
      await userEvent.tab();
      expect(within(dialog).getByLabelText('Phone')).toHaveFocus();
      await userEvent.tab();
      // The Email box is next: the WhatsApp link left the dialog for the row (P18.8-T7 AC-5).
      expect(within(dialog).getByLabelText('Email')).toHaveFocus();
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(actionsOf()).toHaveFocus();
    });

    it('AC-8: saves the field still being typed in when Escape closes it', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ source: 'Referral — Desi' }) },
      });
      const dialog = await openDetails();

      await userEvent.type(within(dialog).getByLabelText('Where they came from'), 'Referral — Desi');
      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(lastBody(calls)).toEqual({ source: 'Referral — Desi', version: 2 }));
    });

    it('AC-8: closes from the backdrop, but not from a click inside', async () => {
      render({ '/leads': { body: page([lead()]) } });
      const dialog = await openDetails();

      await userEvent.click(within(dialog).getByRole('heading'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await userEvent.click(dialog.parentElement!);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('AC-9 — who last changed it, in the lead’s details (ADR-0044, P13.1-T4 AC-2)', () => {
    const detailsText = async () => {
      await screen.findByDisplayValue('Pak Budi');
      await choose('Lead details');
      return (await screen.findByRole('dialog')).textContent;
    };

    it('AC-9: says nothing when the last change was the owner’s own', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: null })]) } });
      expect(await detailsText()).not.toMatch(/Last changed by/);
    });

    it('AC-9: says nothing to a leader about a change they made themselves', async () => {
      // A leader's screen shows their downline's leads; their own edit is not news to them.
      render({ '/leads': { body: page([lead({ ownerMembershipId: 'mem-7', lastEditedBy: { membershipId: 'mem-1', name: 'Rina' } })]) } });
      expect(await detailsText()).not.toMatch(/Last changed by/);
    });

    it('AC-9: names the office rather than a blank when the membership resolves to nobody', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-gone', name: null } })]) } });
      expect(await detailsText()).toMatch('Last changed by someone in your office');
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
      expect(refusal.closest('td')).toHaveAttribute('colspan', '8');
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
      const refused = 'The contact details could not be saved.';
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', refused),
      });
      await screen.findByDisplayValue('Pak Budi');
      await choose('Lead details');
      const dialog = await screen.findByRole('dialog', { name: 'Lead details for Pak Budi' });

      await userEvent.type(within(dialog).getByLabelText('Phone'), '0811');
      await userEvent.tab();
      await within(dialog).findByText(refused);
      await userEvent.type(within(dialog).getByLabelText('Email'), 'budi@example.com');
      await userEvent.tab();

      await waitFor(() => expect(within(dialog).getAllByRole('alert')).toHaveLength(1));
      await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.getAllByText(refused)).toHaveLength(1);
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
      expect(type).toHaveAttribute('aria-disabled', 'true');
      expect(name).toHaveAttribute('readonly');
      expect(screen.getByLabelText('Remarks, row 1')).toHaveAttribute('readonly');

      // And held means held: what is chosen in the meantime writes nothing and asks nothing.
      await userEvent.selectOptions(type, 'recruitment');
      await userEvent.selectOptions(screen.getByLabelText('Status, row 1'), 'PAID_AND_ISSUED');
      await userEvent.click(screen.getByLabelText('Close this month'));
      fireEvent.change(screen.getByLabelText('Next action date, row 1'), { target: { value: '2026-11-01' } });
      // The menu's writes are held too; its details are not, since they write nothing by opening.
      await userEvent.click(actionsOf());
      for (const item of ['Mark not successful', 'Delete']) {
        expect(screen.getByRole('menuitem', { name: item })).toHaveAttribute('aria-disabled', 'true');
        await userEvent.click(screen.getByRole('menuitem', { name: item }));
      }
      expect(screen.getByRole('menuitem', { name: 'Lead details' })).not.toHaveAttribute('aria-disabled');
      await userEvent.keyboard('{Escape}');
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

      await choose('Delete');
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

      await choose('Delete');
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

      await choose('Mark not successful', 'Bu Rina');
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

      await choose('Delete');
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete lead' }));

      await screen.findByText('0 active leads');
      expect(screen.getByRole('button', { name: '+ Add lead' })).toHaveFocus();
    });

    it('AC-10: asks Delete {name}? — and deletes nothing when cancelled', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      await choose('Delete');
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

      await choose('Delete');
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

      await choose('Delete');
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

  describe('P13.1-T4 AC-7 — no sideways scroll: a table where it fits, a card per lead where it does not', () => {
    /** The root's font size, which jsdom leaves unset: the threshold is read in rem. */
    const ROOT_PX = 16;

    it('P13.1-T4 AC-7: draws a table that asks for no minimum width, its two text columns taking what is left', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const table = screen.getByRole('table');
      expect(table.className).not.toMatch(/min-w-/);
      // P18.8-T7: the first column holds a drag handle beside the number on `/leads` — 0.75rem more.
      // P18.95-T4 AC-3: *Actions* holds 📞 beside WhatsApp and the ⋮ — 0.75rem more.
      expect([...table.querySelectorAll('colgroup col')].map((c) => (c as HTMLElement).style.width))
        .toEqual(['2.75rem', '11rem', '7.5rem', '11rem', '6.5rem', 'auto', 'auto', '5.25rem']);
    });

    it.each([360, 768, 1024 - 252 - 80])('P13.1-T4 AC-7: draws each lead as a card in a box %ipx wide', async (width) => {
      boxWidth(width);
      render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina' })]) } });

      const list = await screen.findByRole('list', { name: 'Your leads' });
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    });

    it.each([1280 - 252 - 80, 1440 - 252 - 80])('P13.1-T4 AC-7: draws the table in a box %ipx wide — 1280 and 1440 with the sidebar open', async (width) => {
      boxWidth(width);
      render({ '/leads': { body: page([lead()]) } });

      expect(await screen.findByRole('table', { name: 'Your leads' })).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Your leads' })).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-7: turns at 58rem of its own box, so the sidebar and the reader’s text size both count', async () => {
      boxWidth(58 * ROOT_PX - 1);
      render({ '/leads': { body: page([lead()]) } });
      expect(await screen.findByRole('list', { name: 'Your leads' })).toBeInTheDocument();
    });

    it('P13.1-T4 AC-7: puts the same controls in a card, under the same names, and the ⋮ beside the name', async () => {
      boxWidth(360);
      render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) } });

      const card = within(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('listitem'));
      for (const label of ['Lead name', 'Type', 'Status', 'Remarks', 'Next action date', 'Next action note']) {
        expect(card.getByLabelText(`${label}, row 1`)).toBeInTheDocument();
      }
      expect(card.getByLabelText('Close this month')).toBeInTheDocument();
      expect(card.getByLabelText('Lead name, row 1').className).toContain('font-semibold');
      // The name sits in its save confirmation's box (P18.95-T1 AC-5), and that box in the line.
      expect(card.getByRole('button', { name: 'Actions for Pak Budi' }).parentElement)
        .toBe(card.getByLabelText('Lead name, row 1').parentElement!.parentElement!.parentElement);

      await choose('Lead details');
      expect(await screen.findByRole('dialog', { name: 'Lead details for Pak Budi' })).toBeInTheDocument();
    });

    it('P13.1-T4 AC-7: writes from a card exactly as from a row', async () => {
      boxWidth(360);
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ remarks: 'Hobi tenis', version: 3 }) },
      });
      const remarks = await screen.findByLabelText('Remarks, row 1');

      await userEvent.clear(remarks);
      await userEvent.type(remarks, 'Hobi tenis{Enter}');

      await waitFor(() => expect(lastBody(calls)).toEqual({ remarks: 'Hobi tenis', version: 2 }));
    });

    it('P13.1-T4 AC-7: says a refusal inside the card it belongs to', async () => {
      boxWidth(360);
      render({
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina' })]) },
        '/leads/l1': error(422, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
      });
      const name = await screen.findByLabelText('Lead name, row 1');
      await userEvent.clear(name);
      await userEvent.type(name, 'B');
      await userEvent.tab();

      const refusal = await screen.findByText('A lead needs a name of at least 2 characters.');
      expect(refusal.closest('li')).toBe(name.closest('li'));
    });

    it('P13.1-T4 AC-7: sorts the cards from the toolbar, since a card has no heading', async () => {
      boxWidth(360);
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByRole('list', { name: 'Your leads' });

      const order = screen.getByLabelText('Sort leads');
      // P18.8-T7 AC-4: the cards open in the saved order too, and a sort comes back to it by name.
      expect(order).toHaveDisplayValue('Saved order');
      // P18.95-T4 AC-4: in words, what each order does (UI-027).
      expect(within(order).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Saved order', 'Name A–Z', 'Name Z–A', 'Sales first', 'Recruit first',
        'Earliest stage first', 'Furthest stage first',
      ]);
      await userEvent.selectOptions(order, 'Name Z–A');

      await waitFor(() => expect(lastRead(calls).get('sort')).toBe('name'));
      expect(lastRead(calls).get('dir')).toBe('desc');
    });

    it('P13.1-T4 AC-7: offers no sort control above the table, whose headings sort', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');
      expect(screen.queryByLabelText('Sort leads')).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-7: says there are none inside the card list’s own box', async () => {
      boxWidth(360);
      render({ '/leads': { body: page([]) } });
      expect(await screen.findByText('No leads yet — add your first one above.')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-7: has no axe violations as cards, with a lead’s menu open', async () => {
      boxWidth(360);
      render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-7' })]) } });
      await screen.findByRole('list', { name: 'Your leads' });
      await userEvent.click(actionsOf('Bu Rina'));

      // Contrast needs a stylesheet jsdom does not apply; `a11y.spec.tsx` checks the tokens themselves.
      const { violations } = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
      expect(violations.map((v) => v.id)).toEqual([]);
    });

    it('P13.1-T4 AC-7: waits in card-shaped placeholders where the cards will be', () => {
      boxWidth(360);
      render({ '/leads': { body: page([lead()]) } });
      expect(screen.getByRole('status')).toHaveTextContent('Loading your leads…');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('P13.1-T4 AC-5 — the note boxes bordered, and the calendar on the left', () => {
    it('P13.1-T4 AC-5: borders Remarks and the next-action note at rest, and leaves the other cells as text', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const label of ['Remarks', 'Next action note']) {
        const box = screen.getByLabelText(`${label}, row 1`).className;
        expect(box).toContain('border-hairline');
        expect(box).not.toContain('border-transparent');
      }
      expect(screen.getByLabelText('Lead name, row 1').className).toContain('border-transparent');
    });

    it('P13.1-T4 AC-5, P18.96-T2 AC-4: the shared date field, the calendar on the date’s left, and a click opens the picker', async () => {
      const showPicker = vi.fn();
      HTMLInputElement.prototype.showPicker = showPicker;
      render({ '/leads': { body: page([lead()]) } });
      const date = await screen.findByLabelText('Next action date, row 1');

      // The field is the control; the face beside it shows the date as the app writes it, the calendar first.
      const face = date.nextElementSibling as HTMLElement;
      expect(face).toHaveAttribute('aria-hidden', 'true');
      expect(face.firstElementChild!.tagName.toLowerCase()).toBe('svg');
      expect(face).toHaveTextContent('2 Okt 2026');
      expect(face.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);

      await userEvent.click(date);
      expect(showPicker).toHaveBeenCalledTimes(1);
      delete (HTMLInputElement.prototype as { showPicker?: unknown }).showPicker;
    });

    it('P13.1-T4 AC-5: falls back to the box’s focus where there is no picker to show', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      const date = await screen.findByLabelText('Next action date, row 1');
      await userEvent.click(date);
      // jsdom has no `showPicker`: the refusal is caught, and the date can be typed.
      expect(date).toHaveFocus();
      expect(writes(calls)).toHaveLength(0);
    });
  });

  describe('P13.1-T4 AC-8 — the first 30, then Show more', () => {
    it('P13.1-T4 AC-8: draws the first 30 of 35, and Show more draws the other 5 at once and goes', async () => {
      render({ '/leads': { body: page(many(1, 35)) } });
      await screen.findByDisplayValue('Lead 30');

      expect(screen.queryByDisplayValue('Lead 31')).not.toBeInTheDocument();
      expect(screen.getByText('35 active leads')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));

      expect(screen.getByLabelText('Lead name, row 35')).toHaveValue('Lead 35');
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
      // The button has gone; the focus goes to the first lead it brought, not to the top of the page.
      expect(screen.getByLabelText('Lead name, row 31')).toHaveFocus();
      expect(screen.queryByRole('button', { name: 'Previous' })).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-8: offers no Show more when 30 is all there is', async () => {
      render({ '/leads': { body: page(many(1, 30)) } });
      await screen.findByDisplayValue('Lead 30');
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-8: shows the first 30 of a new order again after a sort', async () => {
      render({
        '/leads': { body: page(many(1, 35)) },
        'sort=name': { body: page(many(1, 35, 'Andi')) },
      });
      await screen.findByDisplayValue('Lead 30');
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
      await screen.findByDisplayValue('Lead 35');

      await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));

      await screen.findByDisplayValue('Andi 30');
      expect(screen.queryByDisplayValue('Andi 31')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    });

    it('P13.1-T4 AC-8: shows the first 30 again when a sort comes back round to the list Show more was pressed on', async () => {
      render({
        '/leads': { body: page(many(1, 35)) },
        'sort=name': { body: page(many(1, 35, 'Andi')) },
      });
      await screen.findByDisplayValue('Lead 30');
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
      await screen.findByDisplayValue('Lead 35');

      // Ascending, descending, and the third press back to newest first: the list it was pressed on.
      for (let i = 0; i < 3; i += 1) await userEvent.click(screen.getByRole('button', { name: /Lead name/ }));

      await screen.findByDisplayValue('Lead 30');
      expect(screen.queryByDisplayValue('Lead 31')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    });

    it('P13.1-T4 AC-8: keeps the inline row on top of the 30', async () => {
      render({ '/leads': { body: page(many(1, 35)) } });
      await screen.findByDisplayValue('Lead 30');

      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('');
      expect(screen.getByLabelText('Lead name, row 31')).toHaveValue('Lead 30');
      expect(screen.queryByLabelText('Lead name, row 32')).not.toBeInTheDocument();
    });

    it('P13.1-T4 AC-8: shows more in the card layout too', async () => {
      boxWidth(360);
      render({ '/leads': { body: page(many(1, 31)) } });
      const list = await screen.findByRole('list', { name: 'Your leads' });
      await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(30));

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
      expect(within(list).getAllByRole('listitem')).toHaveLength(31);
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

  /*
   * *Amended 2026-10-26 (P18.95-T4 AC-2, ADR-0167 §4):* AC-12 pinned the coaching card's toolbar off here, because
   * the client had chosen a leads screen that could not be searched. Their UI review of 2026-10-26 asked for a
   * search and two filters (UI-016), so `/leads` has its own filter bar **above** the prototype's toolbar, and
   * what stays pinned is that toolbar: the count and *+ Add lead*, never replaced by the coaching card's.
   */
  describe('AC-12 — the coaching card’s toolbar stays off here; /leads has its own filter bar above the count', () => {
    it('AC-12: keeps the count and + Add lead, which the coaching card’s toolbar replaces', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.getByText('1 active lead')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+ Add lead' })).toBeInTheDocument();
    });

    it('AC-12: sends no search and no filter until one is chosen', async () => {
      const { calls } = render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      for (const q of tableReads(calls)) {
        expect(q.get('search')).toBeNull();
        expect(q.get('type')).toBeNull();
        expect(q.get('statusCode')).toBeNull();
      }
    });
  });

  describe('leader scope — Delete is the owner’s alone', () => {
    it('P13.1-T4 AC-3: keeps Delete in a downline’s lead’s menu, saying why, and asking nothing', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ ownerMembershipId: 'mem-7' })]) } });
      await screen.findByDisplayValue('Pak Budi');

      const del = await menuItem('Delete');
      expect(del).toHaveAttribute('aria-disabled', 'true');
      expect(del).toHaveAccessibleDescription('Only the person who owns this lead can delete it.');
      // Reached by the arrows like any other item — a reason nobody can reach is not given.
      await userEvent.keyboard('{End}');
      expect(del).toHaveFocus();

      await userEvent.click(del);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(writes(calls, 'DELETE')).toHaveLength(0);
      // The menu keeps its order: details, the two outcomes, Delete.
      expect(screen.getAllByRole('menuitem').map((m) => m.getAttribute('aria-labelledby') && document.getElementById(m.getAttribute('aria-labelledby')!)?.textContent))
        .toEqual(['Lead details', 'Mark successful', 'Mark not successful', 'Delete']);
    });

    it('P13.1-T4 AC-3: offers Delete on the reader’s own lead, with no reason to give', async () => {
      render({ '/leads': { body: page([lead({ ownerMembershipId: 'mem-1' })]) } });
      await screen.findByDisplayValue('Pak Budi');

      const del = await menuItem('Delete');
      expect(del).not.toHaveAttribute('aria-disabled');
      expect(del).not.toHaveAttribute('aria-describedby');
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
      await waitFor(() => expect(writes(calls)).toHaveLength(1));
      expect(await menuItem('Mark successful')).not.toHaveAttribute('aria-disabled');
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
      await waitFor(() => expect(screen.getByLabelText('Status, row 1')).toHaveValue('PAID_AND_ISSUED'));
      await waitFor(() => expect(screen.getByLabelText('Status, row 1')).not.toHaveAttribute('aria-disabled'));
      await choose('Mark successful');
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

  });

  describe('the prototype’s own shape', () => {
    it('packs the table to the prototype’s density, with eight fixed columns', async () => {
      render({ '/leads': { body: page([lead()]) } });
      await screen.findByDisplayValue('Pak Budi');

      const table = document.querySelector('table')!;
      expect(table.className).toContain('table-fixed');
      expect(table.querySelectorAll('colgroup col')).toHaveLength(8);
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

      // The cell's own ground, transparent — and, since P18.8-T7 AC-6, a hairline at rest, not only on hover.
      for (const cls of [sales, recruitment, none]) {
        expect(cls).toContain('bg-transparent');
        expect(cls).toContain('border-hairline');
        expect(cls).not.toContain('border-transparent');
      }
    });

    it('P13.1-T4 AC-3: ends each row in one ⋮, in the Actions column, and nothing else', async () => {
      render({ '/leads': { body: page([lead({ lastEditedBy: { membershipId: 'mem-aab', name: 'Ibu Sari' } })]) } });
      await screen.findByDisplayValue('Pak Budi');

      const more = actionsOf();
      expect(more.className).toContain('h-7');
      expect(more).toHaveAttribute('aria-haspopup', 'menu');
      const cell = more.closest('td')!;
      // P18.95-T4 AC-3: beside it, WhatsApp and 📞 held with their reason — no number yet — and nothing else.
      expect(within(cell).getAllByRole('button').map((b) => b.textContent === '⋮' ? b.getAttribute('aria-label') : b.querySelector('.sr-only')?.textContent))
        .toEqual(['Chat with Pak Budi on WhatsApp', 'Call Pak Budi', 'Actions for Pak Budi']);
      for (const glyph of ['Mark successful', 'Mark not successful', 'Delete lead', 'Contact details', 'Last changed by Ibu Sari']) {
        expect(screen.queryByRole('button', { name: glyph })).not.toBeInTheDocument();
      }
      // The ⋮'s name is its own `aria-label`; the two held glyphs' `sr-only` names sit inside their own positioned
      // wrapper, so none can escape the table's box.
      for (const name of cell.querySelectorAll('.sr-only')) {
        expect(name.parentElement!.parentElement!.className).toContain('relative');
      }
    });

    it('P13.1-T4 AC-3: colours the menu’s two outcomes as the prototype’s glyphs were', async () => {
      render({ '/leads': { body: page([lead({ statusCode: 'PAID_AND_ISSUED' })]) } });
      await screen.findByDisplayValue('Pak Budi');

      const won = await menuItem('Mark successful');
      expect(won.querySelector('[aria-hidden="true"]')).toHaveTextContent('✓');
      expect(won.querySelector('[aria-hidden="true"]')!.className).toContain('text-success');
      expect(screen.getByRole('menuitem', { name: 'Mark not successful' }).querySelector('[aria-hidden="true"]')!.className)
        .toContain('text-alert');
    });
  });
  /**
   * P18.8-T7 (ADR-0161 §1–2): the reader's own order, kept; WhatsApp beside the ⋮; *Type* bordered and
   * *Recruit*; no placeholder in the two note boxes.
   */
  describe('P18.8-T7 — the client’s revisions to /leads, 2026-10-26', () => {
    const handle = (name = 'Pak Budi') =>
      screen.getByRole('button', { name: `Reorder ${name}. Press the up or down arrow to move it.` });
    const names = () => [...document.querySelectorAll<HTMLInputElement>('input[aria-label^="Lead name, row"]')].map((i) => i.value);
    const orders = (calls: Call[]) => calls.filter((c) => c.url.includes('/leads/order'));
    const two = () => page([lead(), lead({ id: 'l2', name: 'Ibu Wati' })]);

    it('P18.8-T7 AC-4 puts a drag handle beside the number of each of the reader’s own leads', async () => {
      render({ '/leads': { body: two() } });
      await screen.findByDisplayValue('Ibu Wati');

      const first = handle();
      expect(first.closest('td')).toBe(screen.getAllByRole('row')[1].querySelector('td'));
      expect(first.closest('td')).toHaveTextContent('⠿1');
      expect(first).toHaveAttribute('draggable', 'true');
      expect(first).toBeEnabled();
      expect(handle('Ibu Wati')).toBeInTheDocument();
    });

    it('P18.8-T7 AC-4 offers none on an agent’s row on a leader’s list, nor on the inline row', async () => {
      render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-7' })]) } });
      await screen.findByDisplayValue('Bu Rina');

      expect(screen.queryByRole('button', { name: /^Reorder Bu Rina/ })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(1);
    });

    it('P18.8-T7 AC-4 hides the handles while a column sort is on, and brings them back with the saved order', async () => {
      const { calls } = render({ '/leads': { body: two() } });
      await screen.findByDisplayValue('Ibu Wati');

      const heading = () => screen.getByRole('button', { name: /Lead name/ });
      await userEvent.click(heading());
      await waitFor(() => expect(lastRead(calls).get('sort')).toBe('name'));
      expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument();
      // The column keeps its room, so a sort moves no other column.
      expect((screen.getByRole('table').querySelector('colgroup col') as HTMLElement).style.width).toBe('2.75rem');

      await userEvent.click(heading());
      await userEvent.click(heading());
      await waitFor(() => expect(lastRead(calls).get('sort')).toBeNull());
      expect(await screen.findAllByRole('button', { name: /^Reorder / })).toHaveLength(2);
      expect(orders(calls)).toHaveLength(0);
    });

    it('P18.8-T7 AC-4 saves a drop as the whole order, and shows it at once', async () => {
      const { calls } = render({ '/leads': { body: two() }, 'PATCH /leads/order': { body: { ids: ['l2', 'l1'] } } });
      await screen.findByDisplayValue('Ibu Wati');

      fireEvent.dragStart(handle('Ibu Wati'), { dataTransfer: { setDragImage: vi.fn(), effectAllowed: '' } });
      const target = rowOf(screen.getByDisplayValue('Pak Budi'));
      fireEvent.dragOver(target);
      fireEvent.drop(target);

      expect(names()).toEqual(['Ibu Wati', 'Pak Budi']);
      await waitFor(() => expect(orders(calls)).toHaveLength(1));
      expect(orders(calls)[0].init.method).toBe('PATCH');
      expect(JSON.parse(String(orders(calls)[0].init.body))).toEqual({ ids: ['l2', 'l1'] });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('P18.8-T7 AC-4 moves a lead with ↓ and ↑, keeps the focus on its handle, and saves each move', async () => {
      const { calls } = render({
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Ibu Wati' }), lead({ id: 'l3', name: 'Sdri. Maya' })]) },
        'PATCH /leads/order': { body: { ids: [] } },
      });
      await screen.findByDisplayValue('Sdri. Maya');

      handle().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(names()).toEqual(['Ibu Wati', 'Pak Budi', 'Sdri. Maya']);
      expect(handle()).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      expect(names()).toEqual(['Ibu Wati', 'Sdri. Maya', 'Pak Budi']);
      expect(handle()).toHaveFocus();
      await userEvent.keyboard('{ArrowUp}');

      await waitFor(() => expect(orders(calls)).toHaveLength(3));
      expect(orders(calls).map((c) => JSON.parse(String(c.init.body)).ids)).toEqual([
        ['l2', 'l1', 'l3'], ['l2', 'l3', 'l1'], ['l2', 'l1', 'l3'],
      ]);
    });

    it('P18.8-T7 AC-4 goes nowhere above the first row, and sends nothing', async () => {
      const { calls } = render({ '/leads': { body: two() } });
      await screen.findByDisplayValue('Ibu Wati');

      handle().focus();
      await userEvent.keyboard('{ArrowUp}');
      expect(names()).toEqual(['Pak Budi', 'Ibu Wati']);
      expect(orders(calls)).toHaveLength(0);
    });

    it('P18.8-T7 AC-4 steps a leader’s lead past an agent’s row, and sends their own leads alone', async () => {
      const { calls } = render({
        '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-7' }), lead({ id: 'l3', name: 'Ibu Wati' })]) },
        'PATCH /leads/order': { body: { ids: ['l3', 'l1'] } },
      });
      await screen.findByDisplayValue('Ibu Wati');

      handle().focus();
      await userEvent.keyboard('{ArrowDown}');

      expect(names()).toEqual(['Bu Rina', 'Ibu Wati', 'Pak Budi']);
      await waitFor(() => expect(orders(calls)).toHaveLength(1));
      expect(JSON.parse(String(orders(calls)[0].init.body))).toEqual({ ids: ['l3', 'l1'] });
    });

    it('P18.8-T7 AC-4 puts the rows back when the save is refused, says why, and reads the list again', async () => {
      const { calls } = render({
        '/leads': { body: two() },
        'PATCH /leads/order': error(400, 'VALIDATION_FAILED', 'Send every one of your open leads, once each, in the order you want them.'),
      });
      await screen.findByDisplayValue('Ibu Wati');
      const before = tableReads(calls).length;

      handle().focus();
      await userEvent.keyboard('{ArrowDown}');

      expect(await screen.findByText('Send every one of your open leads, once each, in the order you want them.')).toBeInTheDocument();
      expect(names()).toEqual(['Pak Budi', 'Ibu Wati']);
      await waitFor(() => expect(tableReads(calls).length).toBeGreaterThan(before));
    });

    it('P18.8-T7 AC-4 holds the handles still until every page has arrived', async () => {
      stubPaged((q) => (q.get('page') === '1'
        ? page(many(1, 3), { total: 5, pageSize: 3 })
        : new Promise(() => {})));
      await screen.findByDisplayValue('Lead 3');

      expect(handle('Lead 1')).toBeDisabled();
    });

    it('P18.8-T7 AC-4 puts the handle in a card’s first line, and saves a drop there the same way', async () => {
      boxWidth(360);
      const { calls } = render({ '/leads': { body: two() }, 'PATCH /leads/order': { body: { ids: ['l2', 'l1'] } } });
      const list = await screen.findByRole('list', { name: 'Your leads' });

      const card = within(list).getAllByRole('listitem')[1];
      // The name sits in its save confirmation's box (P18.95-T1 AC-5), and that box in the line.
      expect(within(card).getByRole('button', { name: /^Reorder Ibu Wati/ }).parentElement)
        .toBe(within(card).getByLabelText('Lead name, row 2').parentElement!.parentElement!.parentElement);
      fireEvent.dragStart(handle('Ibu Wati'), { dataTransfer: { setDragImage: vi.fn(), effectAllowed: '' } });
      fireEvent.dragOver(within(list).getAllByRole('listitem')[0]);
      fireEvent.drop(within(list).getAllByRole('listitem')[0]);

      await waitFor(() => expect(orders(calls)).toHaveLength(1));
      expect(JSON.parse(String(orders(calls)[0].init.body))).toEqual({ ids: ['l2', 'l1'] });
    });

    it('P18.8-T7 AC-5 links to WhatsApp beside the ⋮, in a new tab, with the number as wa.me takes it', async () => {
      render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } }), lead({ id: 'l2', name: 'Ibu Wati' })]) } });
      await screen.findByDisplayValue('Ibu Wati');

      const chat = screen.getByRole('link', { name: 'Chat with Pak Budi on WhatsApp (opens in a new tab)' });
      expect(chat).toHaveAttribute('href', 'https://wa.me/6281211002200');
      expect(chat).toHaveAttribute('target', '_blank');
      expect(chat).toHaveAttribute('rel', 'noopener noreferrer');
      expect(chat).toHaveAttribute('title', 'WhatsApp');
      // P18.95-T4 AC-3: 24px beside the 28px ⋮, so 📞 fits beside it; 44px on a phone.
      expect(chat.className).toContain('h-6');
      expect(chat.className).toContain('max-md:min-h-11');
      expect(chat.closest('td')).toBe(actionsOf().closest('td'));
      // No number WhatsApp could open, no link — held with its reason since P18.95-T4 — and no column was added.
      expect(screen.getAllByRole('link', { name: /WhatsApp/ })).toHaveLength(1);
      expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    });

    it('P18.8-T7 AC-5 puts the WhatsApp link beside the ⋮ in a card too', async () => {
      boxWidth(360);
      render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) } });
      const card = within(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('listitem'));

      // P18.95-T4 AC-3: 📞 between them.
      expect(card.getByRole('link', { name: /WhatsApp/ }).nextElementSibling)
        .toBe(card.getByRole('link', { name: 'Call Pak Budi' }));
      expect(card.getByRole('link', { name: 'Call Pak Budi' }).nextElementSibling)
        .toBe(card.getByRole('button', { name: 'Actions for Pak Budi' }));
    });

    it('P18.8-T7 AC-6 borders Type at rest on a transparent ground, and offers Sales and Recruit', async () => {
      const { calls } = render({ '/leads': { body: page([lead({ type: null, statusCode: null })]) } });
      const type = await screen.findByLabelText('Type, row 1');

      expect(type.className).toContain('border-hairline');
      expect(type.className).toContain('bg-transparent');
      expect(within(type).getAllByRole('option').map((o) => o.textContent)).toEqual(['Select type', 'Sales', 'Recruit']);
      await userEvent.selectOptions(type, 'Recruit');
      // The word changed; the value the server stores did not.
      await waitFor(() => expect(lastBody(calls)).toEqual({ type: 'recruitment', version: 2 }));
    });

    it('P18.8-T7 AC-6 leaves Remarks and the next-action note without a placeholder', async () => {
      render({ '/leads': { body: page([lead({ remarks: null })]) } });
      await screen.findByDisplayValue('Pak Budi');

      expect(screen.getByLabelText('Remarks, row 1')).not.toHaveAttribute('placeholder');
      expect(screen.getByLabelText('Next action note, row 1')).not.toHaveAttribute('placeholder');
      // The name keeps its own.
      expect(screen.getByLabelText('Lead name, row 1')).toHaveAttribute('placeholder', 'First Last');
    });

    it('P18.8-T7 has no axe violations with handles, a WhatsApp link and an agent’s row', async () => {
      render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } }), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-7' })]) } });
      await screen.findByDisplayValue('Bu Rina');

      const { violations } = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
      expect(violations.map((v) => v.id)).toEqual([]);
    });
  });
  /**
   * **A field that saves itself says so** (P18.95-T1 AC-5, AC-12; ADR-0167 §5; the client's UI review of 2026-10-26,
   * UI-007: *"inline lead edits save silently"*). Beside the field, in its own box: *Saving…*, *Saved ✓*, or
   * *Couldn't save — retry*, which sends the same value again.
   */
  describe('P18.95-T1 AC-5 — each field that saves itself says so beside it', () => {
    /** The save confirmation in the field's own box: the nearest ancestor with a status for a child. */
    const besides = (el: HTMLElement) => {
      for (let box = el.parentElement; box; box = box.parentElement) {
        const own = [...box.children].find((c) => c.getAttribute('role') === 'status');
        if (own) return own as HTMLElement;
        if (box.tagName === 'TD' || box.tagName === 'LI' || box.getAttribute('role') === 'dialog') break;
      }
      return null;
    };
    const bare = lead({ statusCode: null, thisMonth: false });

    const fields: [string, Record<string, unknown>, (calls: Call[]) => Promise<HTMLElement>][] = [
      ['the name', lead({ name: 'Pak Budi S' }), async () => {
        const box = screen.getByLabelText('Lead name, row 1');
        await userEvent.type(box, ' S');
        await userEvent.tab();
        return box;
      }],
      ['the remarks', lead({ remarks: 'Hobi tenis' }), async () => {
        const box = screen.getByLabelText('Remarks, row 1');
        await userEvent.clear(box);
        await userEvent.type(box, 'Hobi tenis');
        await userEvent.tab();
        return box;
      }],
      ['the next action note', lead({ nextActionNote: 'Call' }), async () => {
        const box = screen.getByLabelText('Next action note, row 1');
        await userEvent.type(box, 'Call');
        await userEvent.tab();
        return box;
      }],
      ['the next action date', lead({ nextActionDate: '2026-10-09' }), async () => {
        const box = screen.getByLabelText('Next action date, row 1');
        fireEvent.change(box, { target: { value: '2026-10-09' } });
        return box;
      }],
      ['the stage', lead({ statusCode: 'PAID_AND_ISSUED' }), async () => {
        const box = screen.getByLabelText('Status, row 1');
        await userEvent.selectOptions(box, 'PAID_AND_ISSUED');
        return box;
      }],
      ['the type', lead({ type: 'recruitment', statusCode: null }), async () => {
        const box = screen.getByLabelText('Type, row 1');
        await userEvent.selectOptions(box, 'recruitment');
        return box;
      }],
      ['the month’s commitment', lead({ statusCode: null, thisMonth: true }), async () => {
        const box = screen.getByLabelText('Close this month');
        await userEvent.click(box);
        return box;
      }],
    ];

    for (const [what, answer, edit] of fields) {
      it(`P18.95-T1 AC-5: ${what} says Saved ✓ beside it once its write lands`, async () => {
        render({
          '/leads': { body: page([bare]) },
          '/leads/l1': { body: { ...answer, version: 3 } },
          '/leads/l1/status': { body: { ...answer, version: 3 } },
        });
        await screen.findByDisplayValue('Pak Budi');
        expect(screen.queryByText('Saved ✓')).not.toBeInTheDocument();

        const box = await edit([]);

        await waitFor(() => expect(besides(box)).toHaveTextContent('Saved ✓'));
        expect(besides(box)).toHaveClass('text-success');
        // One field's confirmation, not the row's: nothing else on the row says it.
        expect(screen.getAllByText('Saved ✓')).toHaveLength(1);
      });
    }

    it('P18.95-T1 AC-5: says Saving… while the write is out', async () => {
      const { mock } = stubFetch({ ...BASE, '/leads': { body: page([lead()]) } } as Parameters<typeof stubFetch>[0]);
      let release: () => void = () => {};
      vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
        if (init.method !== 'PATCH') return mock(url, init);
        await new Promise<void>((resolve) => { release = resolve; });
        return { ok: true, status: 200, json: async () => lead({ remarks: 'Hobi tenis', version: 3 }) } as Response;
      }));
      renderInLayout(AgentLayout, <LeadsPage />, { me: AGENT });
      const box = await screen.findByLabelText('Remarks, row 1');

      await userEvent.clear(box);
      await userEvent.type(box, 'Hobi tenis');
      await userEvent.tab();

      await waitFor(() => expect(besides(box)).toHaveTextContent('Saving…'));
      await act(async () => { release(); });
      await waitFor(() => expect(besides(box)).toHaveTextContent('Saved ✓'));
    });

    it('P18.95-T1 AC-5: a failure says Couldn’t save — retry, and the retry sends the same value at the row’s version now', async () => {
      const { calls } = render({
        '/leads': { body: page([lead()]) },
        'PATCH /leads/l1': [
          error(500, 'INTERNAL_ERROR', 'Something went wrong.'),
          { body: lead({ thisMonth: true, version: 3 }) },
          { body: lead({ thisMonth: true, remarks: 'Hobi tenis', version: 4 }) },
        ],
      });
      const box = await screen.findByLabelText('Remarks, row 1');
      await userEvent.clear(box);
      await userEvent.type(box, 'Hobi tenis');
      await userEvent.tab();

      const retry = await screen.findByRole('button', { name: "Couldn't save — retry: Remarks, row 1" });
      expect(besides(box)).toContainElement(retry);
      // The reason still stands beneath the lead, where it always has.
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
      // Another field saved meanwhile moves the row on to version 3.
      await userEvent.click(screen.getByLabelText('Close this month'));
      await waitFor(() => expect(lastBody(calls)).toEqual({ thisMonth: true, version: 2 }));

      await userEvent.click(screen.getByRole('button', { name: "Couldn't save — retry: Remarks, row 1" }));

      await waitFor(() => expect(writes(calls)).toHaveLength(3));
      expect(lastBody(calls)).toEqual({ remarks: 'Hobi tenis', version: 3 });
      await waitFor(() => expect(besides(screen.getByLabelText('Remarks, row 1'))).toHaveTextContent('Saved ✓'));
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5: a conflict that re-reads the row leaves nothing to retry, and its reason says what happened', async () => {
      render({
        '/leads': { body: page([lead()]) },
        'PATCH /leads/l1': error(409, 'VERSION_CONFLICT', 'This record changed since you loaded it. Reload and try again.'),
        'GET /leads/l1': { body: lead({ remarks: 'Changed elsewhere', version: 5 }) },
      });
      const box = await screen.findByLabelText('Remarks, row 1');
      await userEvent.clear(box);
      await userEvent.type(box, 'Hobi tenis');
      await userEvent.tab();

      expect(await screen.findByDisplayValue('Changed elsewhere')).toBeInTheDocument();
      expect(screen.getByText(/This record changed since you loaded it/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
      expect(besides(screen.getByLabelText('Remarks, row 1'))).toBeNull();
    });

    it('P18.95-T1 AC-5: back to what is stored, a failed field has nothing unsaved and its retry goes', async () => {
      render({
        '/leads': { body: page([lead()]) },
        'PATCH /leads/l1': error(500, 'INTERNAL_ERROR', 'Something went wrong.'),
      });
      const box = await screen.findByLabelText('Remarks, row 1');
      await userEvent.type(box, '!');
      await userEvent.tab();
      expect(await screen.findByRole('button', { name: "Couldn't save — retry: Remarks, row 1" })).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Remarks, row 1'), '{Backspace}');
      await userEvent.tab();

      expect(screen.queryByRole('button', { name: /^Couldn't save/ })).not.toBeInTheDocument();
    });

    it('P18.95-T1 AC-5: the inline row’s name says Saved ✓ once it is a lead, on the same row', async () => {
      render({
        '/leads': [{ body: page([]) }, { status: 201, body: lead({ id: 'l9', name: 'Pak Andi', type: null, statusCode: null }) }],
      });
      await screen.findByText('0 active leads');
      await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
      await userEvent.type(screen.getByLabelText('Lead name, row 1'), 'Pak Andi{Enter}');

      await waitFor(() => expect(besides(screen.getByLabelText('Lead name, row 1'))).toHaveTextContent('Saved ✓'));
      expect(screen.getByLabelText('Lead name, row 1')).toHaveValue('Pak Andi');
    });

    it('P18.95-T1 AC-5: each of the lead’s details says Saved ✓ under its box, inside the dialog', async () => {
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ contact: { phone: '0811', email: null }, version: 3 }) },
      });
      await screen.findByDisplayValue('Pak Budi');
      await choose('Lead details');
      const dialog = within(screen.getByRole('dialog', { name: 'Lead details for Pak Budi' }));

      await userEvent.type(dialog.getByLabelText('Phone'), '0811');
      await userEvent.tab();

      await waitFor(() => expect(besides(dialog.getByLabelText('Phone'))).toHaveTextContent('Saved ✓'));
      expect(besides(dialog.getByLabelText('Email'))).toBeNull();
    });

    it('P18.95-T1 AC-5: a card says it too, below 768px of table, beside the same field', async () => {
      boxWidth(360);
      render({
        '/leads': { body: page([lead()]) },
        '/leads/l1': { body: lead({ remarks: 'Hobi tenis', version: 3 }) },
      });
      const card = within(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('listitem'));
      const box = card.getByLabelText('Remarks, row 1');
      await userEvent.clear(box);
      await userEvent.type(box, 'Hobi tenis');
      await userEvent.tab();

      await waitFor(() => expect(besides(box)).toHaveTextContent('Saved ✓'));
    });
  });

  /*
   * **Leads on a phone, and a search at every size** (P18.95-T4, ADR-0167 §4, OD-199; the client's UI review of
   * 2026-10-26, UI-016 and UI-027). Every field of every card was editable inline on a phone, the name included,
   * at 26–28px; 71 leads made an 8,444px page with a sort and nothing to find one by.
   */
  describe('P18.95-T4 — leads on a phone, a search and two filters, and 📞', () => {
    /** A phone, as far as the screen can ask: `matchMedia`, which jsdom does not have. */
    const onPhone = () => vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      media: query,
      matches: query === PHONE_QUERY,
      addEventListener: () => {},
      removeEventListener: () => {},
    })));
    const filterBar = () => within(screen.getByRole('search', { name: 'Search and filter leads' }));
    const optionsOf = (select: HTMLElement) => within(select).getAllByRole('option').map((o) => o.textContent);

    describe('AC-2, AC-5 — a search, Type and Status above the list, at every size', () => {
      it('P18.95-T4 AC-2 AC-5 draws the search and both filters above the count, and the table still stands', async () => {
        render({ '/leads': { body: page([lead()]) } });
        await screen.findByDisplayValue('Pak Budi');

        const bar = filterBar();
        expect(bar.getByRole('searchbox', { name: 'Search leads' })).toHaveAttribute('placeholder', 'Search leads…');
        expect(optionsOf(bar.getByLabelText('Filter by type'))).toEqual(['All types', 'Sales', 'Recruit']);
        const status = bar.getByLabelText('Filter by status');
        expect(status).toHaveValue('');
        // Both ladders, each under its own name, while no type is chosen.
        expect([...status.querySelectorAll('optgroup')].map((g) => g.getAttribute('label'))).toEqual(['Sales', 'Recruit']);
        expect(optionsOf(status)).toEqual([
          'All statuses', 'Not yet approached', 'Follow-up', 'Paid and issued', 'Not approached', 'AAJI licensed',
        ]);
        // Above the prototype's toolbar, which stays, and the table under both (AC-5).
        const count = screen.getByText('1 active lead');
        expect(screen.getByRole('search').compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole('table', { name: 'Your leads' })).toBeInTheDocument();
      });

      it('P18.95-T4 AC-2 sends the search once the typing settles, and each filter as it is chosen, from page 1', async () => {
        const { calls } = render({ '/leads': { body: page([lead()]) } });
        await screen.findByDisplayValue('Pak Budi');

        await userEvent.type(filterBar().getByRole('searchbox'), 'wulan');
        await waitFor(() => expect(lastRead(calls).get('search')).toBe('wulan'));
        // One read for the word, not one per letter.
        expect(tableReads(calls).filter((q) => q.has('search'))).toHaveLength(1);

        await userEvent.selectOptions(filterBar().getByLabelText('Filter by type'), 'Sales');
        await waitFor(() => expect(lastRead(calls).get('type')).toBe('sales'));
        await userEvent.selectOptions(filterBar().getByLabelText('Filter by status'), 'Follow-up');
        await waitFor(() => expect(lastRead(calls).get('statusCode')).toBe('FOLLOW_UP'));
        expect(lastRead(calls).get('search')).toBe('wulan');
        expect(lastRead(calls).get('page')).toBe('1');
        expect(lastRead(calls).get('outcome')).toBe('open');
      });

      it('P18.95-T4 AC-2 offers the chosen type’s ladder alone, and lets go of a stage the new type does not have', async () => {
        const { calls } = render({ '/leads': { body: page([lead()]) } });
        await screen.findByDisplayValue('Pak Budi');
        const [type, status] = [filterBar().getByLabelText('Filter by type'), filterBar().getByLabelText('Filter by status')];

        await userEvent.selectOptions(status, 'Follow-up');
        await userEvent.selectOptions(type, 'Sales');
        // A sales stage stands under *Sales*…
        expect(status).toHaveValue('FOLLOW_UP');
        expect(optionsOf(status)).toEqual(['All statuses', 'Not yet approached', 'Follow-up', 'Paid and issued']);

        // …and goes under *Recruit*, whose ladder does not hold it.
        await userEvent.selectOptions(type, 'Recruit');
        expect(status).toHaveValue('');
        expect(optionsOf(status)).toEqual(['All statuses', 'Not approached', 'AAJI licensed']);
        await waitFor(() => expect(lastRead(calls).get('type')).toBe('recruitment'));
        expect(lastRead(calls).get('statusCode')).toBeNull();
      });

      it('P18.95-T4 AC-2 draws what the server answers, and counts what matched', async () => {
        render({
          '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Ibu Wati' })]) },
          'search=wati': { body: page([lead({ id: 'l2', name: 'Ibu Wati' })]) },
        });
        await screen.findByDisplayValue('Ibu Wati');
        expect(screen.getByText('2 active leads')).toBeInTheDocument();

        await userEvent.type(filterBar().getByRole('searchbox'), 'wati');

        expect(await screen.findByText('1 active lead matches')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Pak Budi')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('Ibu Wati')).toBeInTheDocument();
      });

      it('P18.95-T4 AC-2 says No leads match. when nothing does, in the table and in the cards', async () => {
        render({
          '/leads': { body: page([lead()]) },
          'search=nobody': { body: page([]) },
        });
        await screen.findByDisplayValue('Pak Budi');

        await userEvent.type(filterBar().getByRole('searchbox'), 'nobody');

        expect(await screen.findByText('No leads match.')).toBeInTheDocument();
        expect(screen.getByText('0 active leads match')).toBeInTheDocument();
        expect(screen.queryByText('No leads yet — add your first one above.')).not.toBeInTheDocument();
      });

      it('P18.95-T4 AC-2 hides the drag handles while the list is searched or filtered, and keeps the first column’s room', async () => {
        render({ '/leads': { body: page([lead(), lead({ id: 'l2', name: 'Ibu Wati' })]) } });
        await screen.findByDisplayValue('Ibu Wati');
        expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(2);

        await userEvent.selectOptions(filterBar().getByLabelText('Filter by type'), 'Sales');
        await waitFor(() => expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument());
        expect((screen.getByRole('table').querySelector('colgroup col') as HTMLElement).style.width).toBe('2.75rem');

        await userEvent.selectOptions(filterBar().getByLabelText('Filter by type'), 'All types');
        await userEvent.type(filterBar().getByRole('searchbox'), 'wati');
        await waitFor(() => expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument());

        // The whole list again, and the handles with it.
        await userEvent.clear(filterBar().getByRole('searchbox'));
        await waitFor(() => expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(2));
      });

      it('P18.95-T4 AC-2 keeps the search when its answer fails, so it can be changed', async () => {
        render({
          '/leads': { body: page([lead()]) },
          'search=boom': error(500, 'INTERNAL_ERROR', 'Something went wrong.'),
        });
        await screen.findByDisplayValue('Pak Budi');

        await userEvent.type(filterBar().getByRole('searchbox'), 'boom');

        expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
        expect(filterBar().getByRole('searchbox')).toHaveValue('boom');
      });

      it('P18.95-T4 AC-2 has no axe violations with the filter bar', async () => {
        render({ '/leads': { body: page([lead()]) } });
        await screen.findByDisplayValue('Pak Budi');
        const { violations } = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
        expect(violations.map((v) => v.id)).toEqual([]);
      });
    });

    describe('AC-3 — 📞 beside WhatsApp', () => {
      it('P18.95-T4 AC-3 rings the lead from 📞, between WhatsApp and the ⋮, with the number as WhatsApp reads it', async () => {
        render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) } });
        await screen.findByDisplayValue('Pak Budi');

        const call = screen.getByRole('link', { name: 'Call Pak Budi' });
        expect(call).toHaveAttribute('href', 'tel:+6281211002200');
        expect(call).toHaveAttribute('title', 'Call');
        expect(call).not.toHaveAttribute('target');
        expect(call.closest('td')).toBe(actionsOf().closest('td'));
        expect(screen.getByRole('link', { name: /WhatsApp/ }).nextElementSibling).toBe(call);
        expect(call.nextElementSibling).toBe(actionsOf());
        // A phone's target, and no column added for it.
        expect(call.className).toContain('max-md:min-h-11');
        expect(screen.getAllByRole('columnheader')).toHaveLength(8);
      });

      it.each([
        ['no phone at all', null, 'No phone number yet — add one in Lead details.'],
        ['a number nobody could dial', '123', 'This number can’t be dialled — check it in Lead details.'],
      ])('P18.95-T4 AC-3 holds 📞 and WhatsApp, saying why, for %s', async (_case, phone, reason) => {
        render({ '/leads': { body: page([lead({ contact: { phone, email: null } })]) } });
        await screen.findByDisplayValue('Pak Budi');

        expect(screen.queryByRole('link', { name: 'Call Pak Budi' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
        for (const name of ['Call Pak Budi', 'Chat with Pak Budi on WhatsApp']) {
          const held = screen.getByRole('button', { name });
          expect(held).toHaveAttribute('aria-disabled', 'true');
          expect(held).toHaveAccessibleDescription(reason);
        }
        // A tap says it, as a hover does — a phone has no hover.
        await userEvent.click(screen.getByRole('button', { name: 'Call Pak Budi' }));
        expect(screen.getAllByRole('tooltip', { hidden: false }).some((t) => !t.hidden && t.textContent === reason)).toBe(true);
      });

      it('P18.95-T4 AC-3 has no 📞 on the inline row, which is not a lead yet', async () => {
        render({ '/leads': { body: page([]) } });
        await screen.findByText('0 active leads');
        await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

        expect(screen.queryByRole('button', { name: /^Call / })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /^Call / })).not.toBeInTheDocument();
      });
    });

    describe('AC-4 — the sort in words', () => {
      it.each([
        ['Name A–Z', 'name', 'asc'],
        ['Sales first', 'type', 'asc'],
        ['Recruit first', 'type', 'desc'],
        ['Earliest stage first', 'status', 'asc'],
        ['Furthest stage first', 'status', 'desc'],
      ])('P18.95-T4 AC-4 sends %s as the heading always did: sort=%s, dir=%s', async (label, key, dir) => {
        boxWidth(360);
        const { calls } = render({ '/leads': { body: page([lead()]) } });
        await screen.findByRole('list', { name: 'Your leads' });

        await userEvent.selectOptions(screen.getByLabelText('Sort leads'), label);

        await waitFor(() => expect(lastRead(calls).get('sort')).toBe(key));
        expect(lastRead(calls).get('dir')).toBe(dir);
      });
    });

    describe('AC-1 — a read-only card per lead below 768px, and a sheet to edit it', () => {
      const LONG = 'Hobi golf setiap Minggu pagi di Pondok Indah, anak sulungnya masuk kuliah tahun depan '
        + 'dan dia sedang membandingkan dua polis pendidikan dari agen lain.';

      it('P18.95-T4 AC-1 draws each lead in words: name, type, stage, next action and its date, the remarks in full', async () => {
        onPhone();
        render({
          '/leads': { body: page([lead({ remarks: LONG, nextActionNote: 'Kopi jam 10' }), lead({ id: 'l2', name: 'Ibu Wati', type: null, statusCode: null, remarks: null, nextActionDate: null })]) },
        });
        const list = await screen.findByRole('list', { name: 'Your leads' });
        const [budi, wati] = within(list).getAllByRole('listitem');

        // Nothing on a card is a field: not the name, not a select, not the remarks.
        for (const role of ['textbox', 'combobox', 'checkbox']) expect(within(list).queryAllByRole(role)).toEqual([]);
        expect(within(budi).getByRole('button', { name: 'Edit Pak Budi' })).toHaveTextContent('Pak Budi');
        expect(within(budi).getByText('Sales')).toBeInTheDocument();
        expect(within(budi).getByText('Follow-up')).toBeInTheDocument();
        expect(within(budi).getByText('Next action')).toBeInTheDocument();
        expect(within(budi).getByText('2 Okt 2026 · Kopi jam 10')).toBeInTheDocument();
        // In full, its words all there and nothing set to cut them.
        const remarks = within(budi).getByText(LONG);
        expect(remarks.className).toContain('whitespace-pre-wrap');
        expect(remarks.className).not.toMatch(/truncate|line-clamp/);
        // A lead with nothing but a name says so, and draws no empty labels.
        expect(within(wati).getByText('No type yet')).toBeInTheDocument();
        expect(within(wati).queryByText('Remarks')).not.toBeInTheDocument();
        expect(within(wati).queryByText('Next action')).not.toBeInTheDocument();
        // No table on a phone.
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      });

      it('P18.95-T4 AC-1 keeps WhatsApp, 📞, ⋮ and the handle on the card, each a 44px target, and opening none of them opens the sheet', async () => {
        onPhone();
        render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } })]) } });
        const card = within(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('listitem'));

        for (const control of [
          card.getByRole('link', { name: /WhatsApp/ }), card.getByRole('link', { name: 'Call Pak Budi' }),
          card.getByRole('button', { name: 'Actions for Pak Budi' }), card.getByRole('button', { name: /^Reorder Pak Budi/ }),
        ]) {
          expect(control.className).toContain('max-md:min-h-11');
          expect(control.className).toContain('max-md:min-w-11');
        }
        await choose('Lead details');
        expect(await screen.findByRole('dialog', { name: 'Lead details for Pak Budi' })).toBeInTheDocument();
        expect(screen.queryByRole('dialog', { name: 'Edit Pak Budi' })).not.toBeInTheDocument();
      });

      it('P18.95-T4 AC-1 opens the edit sheet from the card, with today’s fields at 44px under their own labels', async () => {
        onPhone();
        render({ '/leads': { body: page([lead({ remarks: LONG })]) } });
        await screen.findByRole('list', { name: 'Your leads' });

        await userEvent.click(screen.getByRole('button', { name: 'Edit Pak Budi' }));

        const sheet = screen.getByRole('dialog', { name: 'Edit Pak Budi' });
        expect(sheet.parentElement).toHaveAttribute('data-placement', 'sheet');
        // It opens on its title, so no keyboard rises until a field is chosen.
        expect(sheet).toHaveFocus();
        const inSheet = within(sheet);
        expect(inSheet.getByLabelText('Lead name')).toHaveValue('Pak Budi');
        expect(inSheet.getByLabelText('Type')).toHaveValue('sales');
        expect(inSheet.getByLabelText('Status')).toHaveValue('FOLLOW_UP');
        expect(inSheet.getByLabelText('Close this month')).not.toBeChecked();
        expect(inSheet.getByLabelText('Next action date')).toHaveValue('2026-10-02');
        expect(inSheet.getByLabelText('Next action note')).toHaveValue('');
        // The remark grows rather than clipping: a one-line box that measures itself (`AutoGrowTextarea`).
        const remarks = inSheet.getByLabelText('Remarks');
        expect(remarks.tagName).toBe('TEXTAREA');
        expect(remarks).toHaveAttribute('rows', '1');
        expect(remarks).toHaveValue(LONG);
        for (const label of ['Lead name', 'Type', 'Status']) {
          expect(inSheet.getByLabelText(label).className).toContain('max-md:min-h-11');
        }
        // The date's 44px is its box's, which the field and its face fill (P18.96-T2's shared DateField).
        expect(inSheet.getByLabelText('Next action date').parentElement!.className).toContain('max-md:min-h-11');
        expect(remarks.className).toContain('min-h-11');
        expect(inSheet.getByRole('button', { name: 'Close' }).className).toContain('max-md:min-h-11');
      });

      it('P18.95-T4 AC-1 saves from the sheet one field at a time, saying Saving… then Saved ✓ beside it', async () => {
        onPhone();
        const { calls } = render({
          '/leads': { body: page([lead()]) },
          'PATCH /leads/l1': { body: lead({ remarks: 'Hobi tenis', version: 3 }) },
        });
        await screen.findByRole('list', { name: 'Your leads' });
        await userEvent.click(screen.getByRole('button', { name: 'Edit Pak Budi' }));
        const sheet = within(screen.getByRole('dialog', { name: 'Edit Pak Budi' }));

        const remarks = sheet.getByLabelText('Remarks');
        await userEvent.clear(remarks);
        await userEvent.type(remarks, 'Hobi tenis');
        await userEvent.tab();

        await waitFor(() => expect(lastBody(calls)).toEqual({ remarks: 'Hobi tenis', version: 2 }));
        await waitFor(() => expect(sheet.getAllByRole('status').map((s) => s.textContent)).toContain('Saved ✓'));
      });

      it('P18.95-T4 AC-1 moves a stage from the sheet, through the stage’s own route', async () => {
        onPhone();
        const { calls } = render({
          '/leads': { body: page([lead()]) },
          'PATCH /leads/l1/status': { body: lead({ statusCode: 'PAID_AND_ISSUED', version: 3 }) },
        });
        await screen.findByRole('list', { name: 'Your leads' });
        await userEvent.click(screen.getByRole('button', { name: 'Edit Pak Budi' }));

        await userEvent.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Status'), 'Paid and issued');

        await waitFor(() => expect(writes(calls).at(-1)!.url).toMatch(/\/leads\/l1\/status$/));
        expect(lastBody(calls)).toEqual({ statusCode: 'PAID_AND_ISSUED', version: 2 });
        // The card behind it reads the new stage.
        await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
        expect(await within(screen.getByRole('listitem')).findByText('Paid and issued')).toBeInTheDocument();
      });

      it('P18.95-T4 AC-1 closing the sheet saves the field being typed in, and the card says the save', async () => {
        onPhone();
        const { calls } = render({
          '/leads': { body: page([lead()]) },
          'PATCH /leads/l1': { body: lead({ nextActionNote: 'Telepon Selasa', version: 3 }) },
        });
        await screen.findByRole('list', { name: 'Your leads' });
        const opener = screen.getByRole('button', { name: 'Edit Pak Budi' });
        await userEvent.click(opener);

        await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Next action note'), 'Telepon Selasa');
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await waitFor(() => expect(lastBody(calls)).toEqual({ nextActionNote: 'Telepon Selasa', version: 2 }));
        const card = within(screen.getByRole('listitem'));
        await waitFor(() => expect(card.getByRole('status')).toHaveTextContent('Saved ✓'));
        expect(card.getByText('2 Okt 2026 · Telepon Selasa')).toBeInTheDocument();
        expect(opener).toHaveFocus();
      });

      it('P18.95-T4 AC-1 says a refusal in the sheet and on the card, and keeps what was typed', async () => {
        onPhone();
        render({
          '/leads': { body: page([lead()]) },
          'PATCH /leads/l1': error(400, 'VALIDATION_FAILED', 'A lead needs a name of at least 2 characters.'),
        });
        await screen.findByRole('list', { name: 'Your leads' });
        await userEvent.click(screen.getByRole('button', { name: 'Edit Pak Budi' }));
        const sheet = within(screen.getByRole('dialog'));

        await userEvent.clear(sheet.getByLabelText('Lead name'));
        await userEvent.type(sheet.getByLabelText('Lead name'), 'Bu');
        await userEvent.tab();

        expect(await sheet.findByText('A lead needs a name of at least 2 characters.')).toBeInTheDocument();
        expect(sheet.getByRole('button', { name: "Couldn't save — retry: Lead name" })).toBeInTheDocument();
        await userEvent.click(sheet.getByRole('button', { name: 'Close' }));

        const card = within(screen.getByRole('listitem'));
        expect(card.getByText('A lead needs a name of at least 2 characters.')).toBeInTheDocument();
        expect(card.getByRole('button', { name: 'Edit Bu' })).toBeInTheDocument();
        expect(card.getByRole('button', { name: "Couldn't save — retry: Bu" })).toBeInTheDocument();
      });

      it('P18.95-T4 AC-1 + Add lead opens the sheet on a new lead, its name box focused, and keeps it open once saved', async () => {
        onPhone();
        const { calls } = render({
          '/leads': [{ body: page([]) }, { status: 201, body: lead({ id: 'l9', name: 'Ibu Sari', type: null, statusCode: null, remarks: null, nextActionDate: null }) }],
        });
        await screen.findByText('0 active leads');

        await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));

        const sheet = screen.getByRole('dialog', { name: 'New lead' });
        const name = within(sheet).getByLabelText('Lead name');
        expect(name).toHaveFocus();
        // Held until it is a lead, as the inline row's are.
        expect(within(sheet).getByLabelText('Type')).toHaveAttribute('aria-disabled', 'true');

        await userEvent.type(name, 'Ibu Sari{Enter}');

        await waitFor(() => expect(writes(calls, 'POST')).toHaveLength(1));
        expect(JSON.parse(String(writes(calls, 'POST')[0].init.body))).toEqual({ name: 'Ibu Sari' });
        expect(await screen.findByRole('dialog', { name: 'Edit Ibu Sari' })).toBe(sheet);
        expect(within(sheet).getByLabelText('Lead name')).toBe(name);
        expect(name).toHaveFocus();
        await waitFor(() => expect(within(sheet).getAllByRole('status').map((s) => s.textContent)).toContain('Saved ✓'));
        expect(within(sheet).getByLabelText('Type')).not.toHaveAttribute('aria-disabled');
      });

      it('P18.95-T4 AC-1 takes a new lead left empty away, and the sheet with it', async () => {
        onPhone();
        const { calls } = render({ '/leads': { body: page([]) } });
        await screen.findByText('0 active leads');

        await userEvent.click(screen.getByRole('button', { name: '+ Add lead' }));
        await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Edit the new lead' })).not.toBeInTheDocument();
        expect(writes(calls, 'POST')).toHaveLength(0);
      });

      it('P18.95-T4 AC-1 has no axe violations with the cards drawn and the sheet open', async () => {
        onPhone();
        render({ '/leads': { body: page([lead({ contact: { phone: '0812-1100-2200', email: null } }), lead({ id: 'l2', name: 'Bu Rina', ownerMembershipId: 'mem-7', contact: { phone: null, email: null } })]) } });
        await screen.findByRole('list', { name: 'Your leads' });
        let { violations } = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } });
        expect(violations.map((v) => v.id)).toEqual([]);

        await userEvent.click(screen.getByRole('button', { name: 'Edit Pak Budi' }));
        ({ violations } = await axe(document.body, { rules: { 'color-contrast': { enabled: false } } }));
        expect(violations.map((v) => v.id)).toEqual([]);
      });

      it('P18.95-T4 AC-5 leaves a tablet’s cards editable where they stand', async () => {
        boxWidth(700);
        render({ '/leads': { body: page([lead()]) } });
        const card = within(within(await screen.findByRole('list', { name: 'Your leads' })).getByRole('listitem'));

        expect(card.getByLabelText('Lead name, row 1')).toHaveValue('Pak Budi');
        expect(card.queryByRole('button', { name: 'Edit Pak Budi' })).not.toBeInTheDocument();
      });
    });
  });
});
