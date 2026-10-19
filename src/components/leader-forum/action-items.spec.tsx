import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import type { StubResponse } from '@test/harness';
import {
  bodyOf, gate, gatedFetch, makeActionItems, makeMeetingView, readOnlyMeeting, renderTab, versionConflict, writeFailed,
  writesIn,
} from '@test/leader-meetings-fixtures';
import { ActionItems } from './action-items';
import { FORUM_COPY, type ActionItem } from '@/lib/leader-meetings';

const cell = (name: string) => screen.getByRole('textbox', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const table = () => screen.getByRole('table');
const initiatives = () => screen.getAllByRole('textbox', { name: /^Key initiative, row/ }).map((t) => (t as HTMLTextAreaElement).value);
const reordered = (ids: string[]) => {
  const byId = new Map(makeActionItems().map((a) => [a.id, a]));
  return ids.map((id) => byId.get(id)!);
};

describe('P18.1-T2 AC-6 the tracker, as drawn (`:2822-2843`)', () => {
  it('*Action items tracker* and *"Drag ⠿ to reorder"*; the six headers between the handle and ×', () => {
    renderTab(ActionItems);
    expect(screen.getByText('Action items tracker')).toHaveClass('uppercase');
    expect(screen.getByText('Drag ⠿ to reorder')).toBeInTheDocument();
    expect(within(table()).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(
      ['Key initiative', 'Success metric', 'Action item', 'PIC', 'Status', 'Remarks / Target'],
    );
    const head = within(table()).getAllByRole('row')[0];
    expect(head.children).toHaveLength(8);
    expect(head.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(head.lastElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('each cell a labelled input, *"{column}, row {n}"* (I-255), bounded by the served limits', () => {
    renderTab(ActionItems);
    expect(cell('Key initiative, row 1')).toHaveValue('Activity tracking tool adoption');
    expect(cell('Success metric, row 3')).toHaveValue('# of new prospects');
    expect(cell('Action item, row 4')).toHaveValue('Embed into leaders training materials');
    expect(cell('PIC, row 3')).toHaveValue('Ferry / Joy');
    expect(cell('Remarks / Target, row 1')).toHaveValue('Scheduled for 2 Sept');
    expect(cell('PIC, row 3')).toHaveAttribute('maxLength', '80');
    expect(cell('Remarks / Target, row 1')).toHaveAttribute('maxLength', '500');
  });

  it('the status a button named for what it shows and what it becomes; the pills from tokens', () => {
    renderTab(ActionItems);
    const planned = within(within(table()).getAllByRole('row')[1]).getByRole('button', { name: 'Planned. Change to Implemented' });
    expect(planned).toHaveTextContent(/^Planned$/);
    expect(planned).toHaveClass('bg-amber/15', 'text-navy', 'rounded-pill');
    const notPlanned = within(within(table()).getAllByRole('row')[3]).getByRole('button', { name: 'Not yet planned. Change to Planned' });
    expect(notPlanned).toHaveClass('bg-alert/10', 'text-alert');
  });

  it('the handle a button named for its row, and × named for its row', () => {
    renderTab(ActionItems);
    expect(button('Move row 3, Leads Generation Playbook. Use the arrow keys.')).toHaveAttribute('draggable', 'true');
    expect(button('Remove row 3')).toBeInTheDocument();
  });

  it('F-188: the access note names who may edit now', () => {
    renderTab(ActionItems);
    expect(screen.getByText('🔒 Only Wilson Tanoto, Maya Halim and tagged core leaders can edit this tracker.')).toBeInTheDocument();
  });

  it('AC-8: the table scrolls inside its card at 360px', () => {
    renderTab(ActionItems);
    expect(table().parentElement).toHaveClass('overflow-x-auto');
    expect(table()).toHaveClass('min-w-[640px]', 'relative');
  });
});

describe('P18.1-T2 AC-6 writing the tracker', () => {
  it('the status cycles one step, shown at once; *"Status updated"*; the open items follow', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(ActionItems, makeMeetingView(), {
      'PATCH /leader-meetings/m14/action-items/ai-1': ({ body }) => ({
        body: { ...makeActionItems()[0], status: (body as { status: string }).status, version: 2 },
      }),
    });
    await user.click(within(within(table()).getAllByRole('row')[1]).getByRole('button', { name: 'Planned. Change to Implemented' }));
    expect(within(within(table()).getAllByRole('row')[1]).getByRole('button', { name: 'Implemented. Change to Not yet planned' }))
      .toHaveClass('bg-success/10', 'text-success');
    await screen.findByText('Status updated');
    expect(bodyOf(writesIn(calls)[0])).toEqual({ status: 'implemented', version: 1 });
    expect(held().openItems).toBe(3);
  });

  it('*Implemented* goes back to *Not yet planned*, as drawn (`:2865`)', async () => {
    const user = userEvent.setup();
    const rows = makeActionItems();
    rows[0] = { ...rows[0], status: 'implemented' };
    const { calls } = renderTab(ActionItems, makeMeetingView({ actionItems: rows }), {
      'PATCH /leader-meetings/m14/action-items/ai-1': { body: { ...rows[0], status: 'not_planned', version: 2 } },
    });
    await user.click(button('Implemented. Change to Not yet planned'));
    await screen.findByText('Status updated');
    expect(bodyOf(writesIn(calls)[0])).toEqual({ status: 'not_planned', version: 1 });
  });

  it('× removes the row at once, *"Row removed"*, the focus on the next row’s ×', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(ActionItems, makeMeetingView(), {
      'DELETE /leader-meetings/m14/action-items/ai-2': { status: 204 },
    });
    await user.click(button('Remove row 2'));
    await screen.findByText('Row removed');
    expect(writesIn(calls)[0].url).toContain('/leader-meetings/m14/action-items/ai-2?version=1');
    expect(initiatives()).toEqual(['Activity tracking tool adoption', 'Leads Generation Playbook', 'Team Management Playbook']);
    expect(held().actionItems).toHaveLength(3);
    await waitFor(() => expect(button('Remove row 2')).toHaveFocus());
  });

  it('× on the only row leaves the focus on *+ Add action item*', async () => {
    const user = userEvent.setup();
    renderTab(ActionItems, makeMeetingView({ actionItems: makeActionItems().slice(0, 1) }), {
      'DELETE /leader-meetings/m14/action-items/ai-1': { status: 204 },
    });
    await user.click(button('Remove row 1'));
    await screen.findByText('Row removed');
    await waitFor(() => expect(button('+ Add action item')).toHaveFocus());
  });

  it('a removal that does not land keeps the row', async () => {
    const user = userEvent.setup();
    renderTab(ActionItems, makeMeetingView(), { 'DELETE /leader-meetings/m14/action-items/ai-2': writeFailed });
    await user.click(button('Remove row 2'));
    await screen.findByText(FORUM_COPY.failed);
    expect(initiatives()).toHaveLength(4);
  });

  it('*+ Add action item* appends the server’s new row and moves the focus to its first cell', async () => {
    const user = userEvent.setup();
    const added: ActionItem = {
      id: 'ai-5', initiative: 'New initiative', metric: 'Success metric', action: 'New action item', pic: 'TBD',
      status: 'not_planned', remarks: 'TBD', version: 1,
    };
    const { calls, held } = renderTab(ActionItems, makeMeetingView({ actionItems: [], openItems: 0, writtenIn: false }), {
      'POST /leader-meetings/m14/action-items': { status: 201, body: added },
    });
    await user.click(button('+ Add action item'));
    await waitFor(() => expect(cell('Key initiative, row 1')).toHaveFocus());
    expect(cell('Success metric, row 1')).toHaveValue('Success metric');
    expect(button('Not yet planned. Change to Planned')).toBeInTheDocument();
    expect(writesIn(calls)[0].init.method).toBe('POST');
    expect(held()).toMatchObject({ openItems: 1, writtenIn: true });
  });

  it('a cell written on leaving it, only when it changed, with the row’s version', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(ActionItems, makeMeetingView(), {
      'PATCH /leader-meetings/m14/action-items/ai-3': ({ body }) => ({
        body: { ...makeActionItems()[2], ...(body as object), version: 2 },
      }),
    });
    await user.click(cell('PIC, row 3'));
    await user.tab();
    expect(writesIn(calls)).toHaveLength(0);
    await user.clear(cell('PIC, row 3'));
    await user.type(cell('PIC, row 3'), 'Joy');
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    expect(writesIn(calls).map(bodyOf)).toEqual([{ pic: 'Joy', version: 1 }]);
    expect(held().actionItems[2]).toMatchObject({ pic: 'Joy', version: 2 });
  });

  it('two cells of one row written in turn: the second sends the version the first answered', async () => {
    const user = userEvent.setup();
    let version = 1;
    const { calls } = renderTab(ActionItems, makeMeetingView(), {
      'PATCH /leader-meetings/m14/action-items/ai-4': ({ body }) => ({
        body: { ...makeActionItems()[3], ...(body as object), version: ++version },
      }),
    });
    await user.type(cell('PIC, row 4'), '!');
    await user.tab();
    await user.type(cell('Remarks / Target, row 4'), '!');
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(2));
    expect(writesIn(calls).map((c) => bodyOf(c).version)).toEqual([1, 2]);
  });

  it('P18.1-T2 AC-7 a 409: the meeting read again, the cell shows what was saved, one line says so', async () => {
    const user = userEvent.setup();
    const theirs = makeMeetingView({
      actionItems: makeActionItems().map((a) => (a.id === 'ai-1' ? { ...a, remarks: 'Moved to 9 Sept', version: 3 } : a)),
    });
    renderTab(ActionItems, makeMeetingView(), {
      'PATCH /leader-meetings/m14/action-items/ai-1': versionConflict,
      'GET /leader-meetings/m14': { body: theirs },
    });
    await user.type(cell('Remarks / Target, row 1'), ' (mine)');
    await user.tab();
    await screen.findByText(FORUM_COPY.conflict);
    expect(cell('Remarks / Target, row 1')).toHaveValue('Moved to 9 Sept');
  });

  it('P18.1-T2 AC-7 any other failure keeps what was typed', async () => {
    const user = userEvent.setup();
    renderTab(ActionItems, makeMeetingView(), { 'PATCH /leader-meetings/m14/action-items/ai-1': writeFailed });
    await user.type(cell('Remarks / Target, row 1'), '!');
    await user.tab();
    await screen.findByText(FORUM_COPY.failed);
    expect(cell('Remarks / Target, row 1')).toHaveValue('Scheduled for 2 Sept!');
  });
});

describe('P18.1-T2 AC-6 moving a row, by the keyboard and by drag (I-255)', () => {
  it('an arrow key moves the row at once, the order written whole, *"Reordered"*, the handle keeping the focus', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(ActionItems, makeMeetingView(), {
      'PUT /leader-meetings/m14/action-items/order': ({ body }) => ({ body: reordered((body as { itemIds: string[] }).itemIds) }),
    });
    button('Move row 1, Activity tracking tool adoption. Use the arrow keys.').focus();
    await user.keyboard('{ArrowDown}');
    expect(cell('Action item, row 2')).toHaveValue('Socialization on Activity Tracking Tool in LWS session');
    await screen.findByText('Reordered');
    expect(bodyOf(writesIn(calls)[0])).toEqual({ itemIds: ['ai-2', 'ai-1', 'ai-3', 'ai-4'] });
    expect(held().actionItems.map((a) => a.id)).toEqual(['ai-2', 'ai-1', 'ai-3', 'ai-4']);
    expect(button('Move row 2, Activity tracking tool adoption. Use the arrow keys.')).toHaveFocus();
  });

  it('two presses in a row move it two places, written in turn', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(ActionItems, makeMeetingView(), {
      'PUT /leader-meetings/m14/action-items/order': ({ body }) => ({ body: reordered((body as { itemIds: string[] }).itemIds) }),
    });
    button(/^Move row 4,/).focus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    await waitFor(() => expect(writesIn(calls)).toHaveLength(2));
    expect(writesIn(calls).map((c) => bodyOf(c).itemIds)).toEqual([
      ['ai-1', 'ai-2', 'ai-4', 'ai-3'],
      ['ai-1', 'ai-4', 'ai-2', 'ai-3'],
    ]);
    await waitFor(() => expect(initiatives()[1]).toBe('Team Management Playbook'));
  });

  it('past either end, nothing moves and nothing is written', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(ActionItems);
    button(/^Move row 1,/).focus();
    await user.keyboard('{ArrowUp}');
    button(/^Move row 4,/).focus();
    await user.keyboard('{ArrowDown}');
    expect(writesIn(calls)).toHaveLength(0);
  });

  it('a row dragged by its handle and dropped on another takes its place, as drawn (`:2872-2908`)', async () => {
    const { calls } = renderTab(ActionItems, makeMeetingView(), {
      'PUT /leader-meetings/m14/action-items/order': ({ body }) => ({ body: reordered((body as { itemIds: string[] }).itemIds) }),
    });
    const rows = within(table()).getAllByRole('row');
    fireEvent.dragStart(button(/^Move row 4,/), { dataTransfer: { setDragImage: () => undefined, effectAllowed: '' } });
    fireEvent.dragOver(rows[2]);
    expect(rows[2].className).toContain('shadow-[inset_0_2px_0_var(--color-amber)]');
    fireEvent.drop(rows[2]);
    fireEvent.dragEnd(button(/^Move row 2,/));
    await screen.findByText('Reordered');
    expect(bodyOf(writesIn(calls)[0])).toEqual({ itemIds: ['ai-1', 'ai-4', 'ai-2', 'ai-3'] });
  });

  it('an order refused because the rows changed: the meeting read again, its order shown', async () => {
    const user = userEvent.setup();
    const theirs = makeMeetingView({ actionItems: makeActionItems().slice(1) });
    renderTab(ActionItems, makeMeetingView(), {
      'PUT /leader-meetings/m14/action-items/order': versionConflict,
      'GET /leader-meetings/m14': { body: theirs },
    });
    button(/^Move row 1,/).focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByText(FORUM_COPY.conflict);
    expect(initiatives()).toEqual(['Activity tracking tool adoption', 'Leads Generation Playbook', 'Team Management Playbook']);
  });
});

describe('P18.1-T2 AC-1 read-only: the six columns, and no control drawn', () => {
  it('no input, handle, status button, × or *+ Add action item*; the hint gone; the note stays', () => {
    renderTab(ActionItems, readOnlyMeeting());
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Drag ⠿ to reorder')).toBeNull();
    expect(within(table()).getAllByRole('row')[0].children).toHaveLength(6);
    expect(screen.getAllByText('Planned')[0]).toHaveClass('bg-amber/15', 'text-navy');
    expect(screen.getByText('Socialization on Activity Tracking Tool in LWS session')).toBeInTheDocument();
    expect(screen.getByText(/^🔒 Only Wilson Tanoto, Maya Halim and tagged core leaders/)).toBeInTheDocument();
  });
});

describe('P18.1-T2 AC-8 a cell is text, never markup (F-187)', () => {
  const markup = '<b>bold</b><script>window.hacked=1</script>';
  const rows = () => [{ ...makeActionItems()[0], initiative: markup, pic: markup }];

  it('in the inputs, and in the handle’s name', () => {
    const { container } = renderTab(ActionItems, makeMeetingView({ actionItems: rows() }));
    expect(cell('Key initiative, row 1')).toHaveValue(markup);
    expect(cell('PIC, row 1')).toHaveValue(markup);
    expect(button(`Move row 1, ${markup}. Use the arrow keys.`)).toBeInTheDocument();
    expect(container.querySelector('b, script')).toBeNull();
  });

  it('read-only', () => {
    const { container } = renderTab(ActionItems, readOnlyMeeting({ actionItems: rows() }));
    expect(screen.getAllByText(markup)).toHaveLength(2);
    expect(container.querySelector('b, script')).toBeNull();
    expect((window as { hacked?: number }).hacked).toBeUndefined();
  });
});

describe('P18.1-T2 AC-8 no axe violations', () => {
  // jsdom samples no pixels: contrast is the tokens' (`a11y.spec.tsx`), as `screens.a11y.spec.tsx` has it. A tab
  // drawn alone sits in no landmark; on its page it is inside `<main>`, where that spec checks it.
  const clean = async () =>
    (await axe(document.body, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } })).violations ?? [];

  it('for an editor', async () => {
    renderTab(ActionItems);
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });

  it('read-only', async () => {
    renderTab(ActionItems, readOnlyMeeting());
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });
});

describe('P18.1-T2 AC-7 a field’s write, among the others of its row (the review’s cases)', () => {
  const patches = (calls: { url: string; init: RequestInit }[], id: string) =>
    calls.filter((c) => c.init.method === 'PATCH' && c.url.includes(`/action-items/${id}`));

  it('a field keeps what was typed while its write waits behind the row’s other, and after it fails', async () => {
    const user = userEvent.setup();
    renderTab(ActionItems);
    const first = gate();
    const second = gate();
    const { calls } = gatedFetch(({ method }) => {
      if (method !== 'PATCH') return { status: 404 };
      return patches(calls, 'ai-1').length === 1 ? first.promise : second.promise;
    });
    await user.type(cell('Key initiative, row 1'), ' X');
    await user.tab();
    await user.type(cell('Success metric, row 1'), ' Y');
    await user.tab();
    expect(patches(calls, 'ai-1')).toHaveLength(1);

    first.open({ body: { ...makeActionItems()[0], initiative: 'Activity tracking tool adoption X', version: 2 } });
    await waitFor(() => expect(patches(calls, 'ai-1')).toHaveLength(2));
    // The row moved to version 2 with the first write; the metric's own write is still out.
    expect(cell('Success metric, row 1')).toHaveValue('Adoption 80% (currently 63%) Y');
    expect(cell('Key initiative, row 1')).toHaveValue('Activity tracking tool adoption X');

    second.open(writeFailed as StubResponse);
    await screen.findByText(FORUM_COPY.failed);
    expect(cell('Success metric, row 1')).toHaveValue('Adoption 80% (currently 63%) Y');
    expect(patches(calls, 'ai-1').map(bodyOf)).toEqual([
      { initiative: 'Activity tracking tool adoption X', version: 1 },
      { metric: 'Adoption 80% (currently 63%) Y', version: 2 },
    ]);
  });

  it('a field typed in while the meeting is read again sends the version it was read at, and shows the change it missed', async () => {
    const user = userEvent.setup();
    renderTab(ActionItems);
    const statusWrite = gate();
    const theirs = makeMeetingView({
      actionItems: makeActionItems().map((a) => (a.id === 'ai-1' ? { ...a, remarks: 'Moved to 9 Sept', version: 3 } : a)),
    });
    const { calls } = gatedFetch(({ method, url }) => {
      if (method === 'GET') return { body: theirs };
      if (url.includes('/action-items/ai-2')) return statusWrite.promise;
      return versionConflict as StubResponse;
    });
    await user.click(within(within(table()).getAllByRole('row')[2]).getByRole('button', { name: 'Planned. Change to Implemented' }));
    await user.type(cell('Remarks / Target, row 1'), ' (mine)');

    // Another write's conflict reads the meeting again under the field: row 1 is now somebody else's version 3.
    statusWrite.open(versionConflict as StubResponse);
    await screen.findByText(FORUM_COPY.conflict);
    expect(cell('Remarks / Target, row 1')).toHaveValue('Scheduled for 2 Sept (mine)');

    await user.tab();
    await waitFor(() => expect(patches(calls, 'ai-1')).toHaveLength(1));
    expect(bodyOf(patches(calls, 'ai-1')[0])).toEqual({ remarks: 'Scheduled for 2 Sept (mine)', version: 1 });
    await waitFor(() => expect(cell('Remarks / Target, row 1')).toHaveValue('Moved to 9 Sept'));
  });

  it('leaving a field again, unchanged, while its write is out writes nothing more', async () => {
    const user = userEvent.setup();
    renderTab(ActionItems);
    const out = gate();
    const { calls } = gatedFetch(() => out.promise);
    await user.type(cell('PIC, row 3'), '!');
    await user.tab();
    await user.click(cell('PIC, row 3'));
    await user.tab();
    expect(writesIn(calls)).toHaveLength(1);
    out.open({ body: { ...makeActionItems()[2], pic: 'Ferry / Joy!', version: 2 } });
    await screen.findByText(FORUM_COPY.saved);
    expect(writesIn(calls)).toHaveLength(1);
    expect(cell('PIC, row 3')).toHaveValue('Ferry / Joy!');
  });
});
