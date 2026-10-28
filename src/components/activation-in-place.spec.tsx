import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentLayout from '@/app/(agent)/layout';
import ActivationPage from '@/app/(agent)/activation/page';
import NewHireDetailPage from '@/app/(agent)/new-hires/[membershipId]/page';
import { makeSession, renderInLayout, routeParams, stubFetch, type StubReply } from '@test/harness';
import {
  activationView, completeView, RINA_ME, rinaItems, SARI, SARI_ME, SHELL_STUBS, withWaitingCheckIn,
} from '@test/activation-fixtures';
import type { ActivationItemProgress, ActivationView } from '@/lib/activation';
import { SessionContext } from '@/lib/session';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/new-hires/mem-rina',
}));

/**
 * **P18.96-T7 — the activation pages' polish** (the client's report of 2026-10-27):
 *
 * - **AC-1 (UI-007)** the leader's detail — and the hire's own page — paint no count and no status before the one
 *   settled read: the skeleton, then the server's figures, and never a figure from a read that is not the latest asked,
 *   nor another hire's;
 * - **AC-2 (UI-008)** a tick keeps the page where it is: no row, card or table is replaced, the focus stays on the box,
 *   nothing scrolls, and the summary changes in place — and a data-backed item's form gives the focus back to its box.
 */

const row = (code: string) => document.querySelector(`[data-code="${code}"]`) as HTMLElement;
/** `items`, each one named changed. */
const changed = (items: ActivationItemProgress[][], over: Record<string, Partial<ActivationItemProgress>>) =>
  items.map((list) => list.map((it) => (over[it.code] ? { ...it, ...over[it.code] } : it)));
const leaderItems = () => rinaItems().map((list) => list.map((it) => ({ ...it, note: null, date: null })));
/** A leader's view of Rina from her items, every count and verdict worked out as the server serves them. */
const leaderViewOf = (items: ActivationItemProgress[][]): ActivationView => activationView({}, items);

const CRM_BY_SARI = { done: true, doneAt: '2026-10-03T02:00:00.000Z', source: 'leader' as const, doneBy: SARI };
const UNHEALED = { done: false, doneAt: null, source: null, doneBy: null };
/** Initial Setup as the server settles it: Sari's CRM tick, her goal and her lead — 3 of 4. */
const settled = () => leaderViewOf(changed(leaderItems(), { CRM_SETUP: CRM_BY_SARI }));
/** The same row before its links are evaluated — what the seed stored: the CRM tick alone, 1 of 4. */
const unhealed = () => leaderViewOf(changed(leaderItems(), { CRM_SETUP: CRM_BY_SARI, GOAL_SETTING: UNHEALED, ADD_PROSPECTS: UNHEALED }));

/** The *Items* cell of the aspect table's row named `aspect`, or `null` while there is no table. */
const itemsCell = (aspect: string) => {
  const header = Array.from(document.querySelectorAll('th[scope="row"]')).find((th) => th.textContent === aspect);
  return header?.parentElement?.children[1]?.textContent ?? null;
};

/** Every value the *Items* cell of `aspect` is painted with, from now on — one entry per change. */
function watchCell(aspect: string) {
  const painted: string[] = [];
  const note = () => {
    const now = itemsCell(aspect);
    if (now !== null && painted[painted.length - 1] !== now) painted.push(now);
  };
  const observer = new MutationObserver(note);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return { painted, stop: () => { note(); observer.disconnect(); } };
}

/** A `fetch` whose answer to the hire's read waits until released. */
function holdRead(path: string, routes: Record<string, StubReply | StubReply[]>) {
  const stub = stubFetch(routes);
  const answer = stub.mock.getMockImplementation()!;
  const gates: (() => void)[] = [];
  stub.mock.mockImplementation(async (url: string, init: RequestInit = {}) => {
    if (url.endsWith(path) && (init.method ?? 'GET') === 'GET') await new Promise<void>((go) => gates.push(go));
    return answer(url, init);
  });
  return { ...stub, release: (n = 0) => gates[n]?.(), held: () => gates.length };
}

/** Scrolling, watched: the window's and any element's. */
function watchScroll() {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
  const into = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: into, configurable: true, writable: true });
  return () => [...scrollTo.mock.calls, ...scrollBy.mock.calls, ...into.mock.calls];
}

/** The page's structure as DOM nodes: every row, every checkbox, the table and the summary's tiles. */
function structure() {
  return [
    ...Array.from(document.querySelectorAll('[data-code]')),
    ...Array.from(document.querySelectorAll('input[type="checkbox"]')),
    ...Array.from(document.querySelectorAll('table, h2, [role="progressbar"]')),
    screen.getByText('Completed').parentElement!,
  ];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

describe('P18.96-T7 AC-1 (UI-007): no count before it is settled', () => {
  it('P18.96-T7 AC-1 the leader’s detail is the skeleton while the read is out, and its first painted count is the settled one', async () => {
    const read = holdRead('/new-hires/mem-rina', { ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: settled() } });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    const cell = watchCell('Initial Setup');

    await waitFor(() => expect(read.held()).toBe(1));
    // The wait: the skeleton, and no figure, status or table at all.
    expect(screen.getByText('Loading this activation…')).toBeInTheDocument();
    expect(document.querySelector('table')).toBeNull();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText('In progress')).not.toBeInTheDocument();

    read.release();
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    cell.stop();
    expect(cell.painted).toEqual(['3/4']);
  });

  it('P18.96-T7 AC-1 a read answered after a later one is never painted: the first read’s late answer, the stored 1/4, is dropped', async () => {
    // The page asks again while its first read is out — another hire's address, a remount — and the first answer, the
    // row as stored before its links were evaluated, lands after the later, settled one. It must not replace it.
    let reads = 0;
    const stub = stubFetch({ ...SHELL_STUBS });
    const answer = stub.mock.getMockImplementation()!;
    let releaseFirst!: () => void;
    stub.mock.mockImplementation(async (url: string, init: RequestInit = {}) => {
      if (!/\/new-hires\/mem-(rina|budi)$/.test(url)) return answer(url, init);
      reads += 1;
      if (reads === 1) {
        await new Promise<void>((go) => { releaseFirst = go; });
        return { ok: true, status: 200, json: async () => unhealed() } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ ...settled(), hire: { membershipId: 'mem-budi', name: 'Budi Hartono' } }) } as Response;
    });
    const session = makeSession({ me: SARI_ME });
    const tree = (membershipId: string) => (
      <SessionContext.Provider value={session}>
        <Suspense fallback={null}>
          <AgentLayout><NewHireDetailPage params={routeParams({ membershipId })} /></AgentLayout>
        </Suspense>
      </SessionContext.Provider>
    );
    const { rerender } = render(tree('mem-rina'));
    const cell = watchCell('Initial Setup');
    await waitFor(() => expect(reads).toBe(1));

    rerender(tree('mem-budi'));
    await screen.findByRole('heading', { level: 1, name: 'Budi Hartono' });
    releaseFirst();
    await new Promise((r) => setTimeout(r, 20));
    cell.stop();
    expect(reads).toBe(2);
    expect(cell.painted).toEqual(['3/4']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Budi Hartono');
  });

  it('P18.96-T7 AC-1 another hire’s detail opens on the skeleton, never on the figures of the hire before', async () => {
    const budi = { ...settled(), hire: { membershipId: 'mem-budi', name: 'Budi Hartono' } };
    const read = holdRead('/new-hires/mem-budi', {
      ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: unhealed() }, 'GET /new-hires/mem-budi': { body: budi },
    });
    const session = makeSession({ me: SARI_ME });
    const tree = (membershipId: string) => (
      <SessionContext.Provider value={session}>
        <Suspense fallback={null}>
          <AgentLayout><NewHireDetailPage params={routeParams({ membershipId })} /></AgentLayout>
        </Suspense>
      </SessionContext.Provider>
    );
    const { rerender } = render(tree('mem-rina'));
    await screen.findByRole('heading', { level: 1, name: 'Rina Wijaya' });
    expect(itemsCell('Initial Setup')).toBe('1/4');

    rerender(tree('mem-budi'));
    await waitFor(() => expect(read.held()).toBe(1));
    expect(document.querySelector('table')).toBeNull();
    expect(screen.queryByRole('heading', { level: 1, name: 'Rina Wijaya' })).not.toBeInTheDocument();
    read.release();
    await screen.findByRole('heading', { level: 1, name: 'Budi Hartono' });
    expect(itemsCell('Initial Setup')).toBe('3/4');
  });

  it('P18.96-T7 AC-1 the hire’s own page is the skeleton until its read, and paints the settled count first', async () => {
    const read = holdRead('/activation/me', { ...SHELL_STUBS, 'GET /activation/me': { body: activationView() } });
    renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    const cell = watchCell('Initial Setup');
    await waitFor(() => expect(read.held()).toBe(1));
    expect(document.querySelector('table')).toBeNull();
    expect(screen.queryByText(/^\d+\/\d+$/)).not.toBeInTheDocument();
    read.release();
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    cell.stop();
    expect(cell.painted).toEqual(['2/4']);
  });
});

describe('P18.96-T7 AC-2 (UI-008): a tick keeps the page where it is', () => {
  let scrolled: () => unknown[];
  beforeEach(() => { scrolled = watchScroll(); });

  it('P18.96-T7 AC-2 the leader’s tick near the bottom replaces no node, keeps the focus on its box, scrolls nothing, and updates the summary in place', async () => {
    const ticked = leaderViewOf(changed(leaderItems(), { JOINT_FIELD_WORK: CRM_BY_SARI }));
    stubFetch({
      ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: leaderViewOf(leaderItems()) },
      'PUT /new-hires/mem-rina/items/JOINT_FIELD_WORK': { body: ticked },
    });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    const before = structure();
    const completed = screen.getByText('Completed').parentElement!;
    expect(completed).toHaveTextContent('Completed5/16');

    const box = within(row('JOINT_FIELD_WORK')).getByRole('checkbox', { name: 'Joint Field Work with leader' });
    await userEvent.click(box);
    // While it saves: the box ticked, *Saving…* beside it, and the summary still the last settled answer.
    expect(box).toBeChecked();
    expect(document.activeElement).toBe(box);
    await within(row('JOINT_FIELD_WORK')).findByText('Saved ✓');

    expect(structure()).toEqual(before);
    before.forEach((node) => expect(node.isConnected).toBe(true));
    expect(screen.getByText('Completed').parentElement).toBe(completed);
    expect(completed).toHaveTextContent('Completed6/16');
    expect(itemsCell('First Sale')).toBe('2/2');
    expect(document.activeElement).toBe(box);
    expect(scrolled()).toEqual([]);
  });

  it('P18.96-T7 AC-2 a data-backed tick’s form gives the focus back to its box when it is saved, without scrolling', async () => {
    const { calls } = stubFetch({
      ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: leaderViewOf(leaderItems()) },
      'PUT /new-hires/mem-rina/items/WEEKLY_CHECK_IN': { body: leaderViewOf(withWaitingCheckIn(leaderItems())) },
    });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    const before = structure();
    const checkIn = within(row('WEEKLY_CHECK_IN'));
    const box = checkIn.getByRole('checkbox');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    await userEvent.click(box);
    const form = within(checkIn.getByRole('group', { name: 'Log 1:1' }));
    await userEvent.type(form.getByLabelText('Note'), 'First presentations, together.');
    await userEvent.click(form.getByRole('button', { name: 'Save' }));
    expect(await checkIn.findByText('Ticked by you, waiting for data')).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(1);

    expect(checkIn.queryByRole('group', { name: 'Log 1:1' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(box);
    expect(focus.mock.calls).toContainEqual([{ preventScroll: true }]);
    before.forEach((node) => expect(node.isConnected).toBe(true));
    expect(scrolled()).toEqual([]);
  });

  it('P18.96-T7 AC-2 a data-backed form cancelled gives the focus back to its box, and sends nothing', async () => {
    const { calls } = stubFetch({ ...SHELL_STUBS, 'GET /new-hires/mem-rina': { body: leaderViewOf(leaderItems()) } });
    renderInLayout(AgentLayout, <NewHireDetailPage params={routeParams({ membershipId: 'mem-rina' })} />, { me: SARI_ME });
    await screen.findByRole('heading', { level: 2, name: 'Activation progress' });
    const milestone = within(row('INDEPENDENT_AGENT_MILESTONE'));
    const box = milestone.getByRole('checkbox');

    await userEvent.click(box);
    const form = within(milestone.getByRole('group', { name: 'Which case?' }));
    await userEvent.click(form.getByRole('button', { name: 'Cancel' }));
    expect(milestone.queryByRole('group', { name: 'Which case?' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(box);
    expect(box).not.toBeChecked();
    expect(calls.filter((c) => c.init.method === 'PUT')).toEqual([]);
    expect(scrolled()).toEqual([]);
  });

  it('P18.96-T7 AC-2 the hire’s own tick — and the one that completes the checklist, which reads the session again — keep the page and the focus', async () => {
    const allButCrm = () => {
      const items = completeView().aspects.map((a) => a.items.map((it) => ({ ...it })));
      items[1][1] = { ...items[1][1], ...UNHEALED };
      return activationView({}, items);
    };
    stubFetch({ ...SHELL_STUBS, 'GET /activation/me': { body: allButCrm() }, 'PUT /activation/me/items/CRM_SETUP': { body: completeView() } });
    const { session } = renderInLayout(AgentLayout, <ActivationPage />, { me: RINA_ME });
    await screen.findByRole('heading', { level: 2, name: 'Your activation progress' });
    const before = structure();
    const box = within(row('CRM_SETUP')).getByRole('checkbox', { name: 'Set up company CRM system' });

    await userEvent.click(box);
    expect(await screen.findByText('100% complete')).toBeInTheDocument();
    expect(session.reload).toHaveBeenCalledTimes(1);
    await within(row('CRM_SETUP')).findByText('Saved ✓');

    expect(structure()).toEqual(before);
    before.forEach((node) => expect(node.isConnected).toBe(true));
    expect(document.activeElement).toBe(box);
    expect(screen.getByText('Completed').parentElement).toHaveTextContent('Completed16/16');
    expect(scrolled()).toEqual([]);
  });
});
