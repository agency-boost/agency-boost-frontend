import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import {
  bodyOf, makeAgenda, makeMeetingView, readOnlyMeeting, renderTab, versionConflict, writeFailed, writesIn,
} from '@test/leader-meetings-fixtures';
import { Agenda } from './agenda';
import { FORUM_COPY } from '@/lib/leader-meetings';

const box = (name: string) => screen.getByRole('checkbox', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const card = (name: string) => screen.getByRole('heading', { name }).closest('section')!;

describe('P18.1-T2 AC-5 the agenda, as drawn (`:2800-2820`)', () => {
  it('*Preparation*, *During* and *Post*, each a card of its items, the middle widest, one column on a phone', () => {
    renderTab(Agenda);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Preparation', 'During', 'Post']);
    expect(card('During').parentElement).toHaveClass('grid-cols-1', 'min-[900px]:grid-cols-[1fr_1.6fr_1fr]');
    expect(within(card('Preparation')).getAllByRole('textbox', { name: /^Preparation item/ })).toHaveLength(3);
    expect(within(card('During')).getAllByRole('textbox', { name: /^During item/ })).toHaveLength(5);
    expect(within(card('Post')).getAllByRole('textbox', { name: /^Post item/ })).toHaveLength(2);
  });

  it('each text and each PIC a labelled input (I-255); P18.97-T2 AC-5 an empty PIC prompts its editor, Add a PIC', () => {
    renderTab(Agenda);
    expect(field('Preparation item 2')).toHaveValue('Prepare August performance data');
    expect(field('PIC for Preparation item 2')).toHaveValue('Wilson');
    expect(field('PIC for Post item 2')).toHaveValue('');
    expect(field('PIC for Post item 2')).toHaveAttribute('placeholder', 'Add a PIC');
    // A PIC that is typed shows itself; the prompt is a placeholder, no value.
    expect(field('PIC for Preparation item 2')).toHaveAttribute('placeholder', 'Add a PIC');
    expect(field('Post item 2')).toHaveValue('Note feedback for RBDO/BDO');
    expect(field('During item 1')).toHaveAttribute('maxLength', '500');
    expect(field('PIC for During item 1')).toHaveAttribute('maxLength', '80');
  });

  it('the boxes on *During* only (`:2817`), each named by its item’s text; a ticked item struck through', () => {
    renderTab(Agenda);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    for (const b of boxes) expect(card('During')).toContainElement(b);
    expect(box('Process update — review prior follow-ups')).toBeChecked();
    expect(box('Performance review vs. key thresholds')).not.toBeChecked();
    expect(field('During item 1')).toHaveClass('line-through', 'text-muted');
    expect(field('During item 2')).not.toHaveClass('line-through');
  });

  it('*+ Add item* is a button on each card', () => {
    renderTab(Agenda);
    for (const name of ['Preparation', 'During', 'Post']) {
      expect(within(card(name)).getByRole('button', { name: '+ Add item' })).toBeInTheDocument();
    }
  });
});

describe('P18.1-T2 AC-5 writing the agenda', () => {
  it('a tick saves at once, shown at once, with the item’s version; *Saved*', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(Agenda, makeMeetingView(), {
      'PATCH /leader-meetings/m14/agenda-items/ag-5': ({ body }) => ({
        body: { ...makeAgenda().during[1], done: (body as { done: boolean }).done, version: 2 },
      }),
    });
    await user.click(box('Performance review vs. key thresholds'));
    expect(box('Performance review vs. key thresholds')).toBeChecked();
    await screen.findByText(FORUM_COPY.saved);
    const [write] = writesIn(calls);
    expect(write.init.method).toBe('PATCH');
    expect(bodyOf(write)).toEqual({ done: true, version: 1 });
    expect(held().agenda.during[1]).toMatchObject({ done: true, version: 2 });
    expect(box('Performance review vs. key thresholds')).toBeChecked();
  });

  it('a tick that does not land goes back, and the failure line says so', async () => {
    const user = userEvent.setup();
    renderTab(Agenda, makeMeetingView(), { 'PATCH /leader-meetings/m14/agenda-items/ag-5': writeFailed });
    await user.click(box('Performance review vs. key thresholds'));
    await screen.findByText(FORUM_COPY.failed);
    expect(box('Performance review vs. key thresholds')).not.toBeChecked();
  });

  it('*+ Add item* appends *New agenda item* from the server and moves the focus to its text', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(Agenda, makeMeetingView({ writtenIn: false }), {
      'POST /leader-meetings/m14/agenda-items': { status: 201, body: { id: 'ag-11', text: 'New agenda item', pic: '', done: false, version: 1 } },
    });
    await user.click(within(card('Post')).getByRole('button', { name: '+ Add item' }));
    await waitFor(() => expect(field('Post item 3')).toHaveFocus());
    expect(field('Post item 3')).toHaveValue('New agenda item');
    expect(bodyOf(writesIn(calls)[0])).toEqual({ section: 'post' });
    expect(held().agenda.post).toHaveLength(3);
    expect(held().writtenIn).toBe(true);
  });

  it('a text written on leaving it, only when it changed, trimmed, with its version', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(Agenda, makeMeetingView(), {
      'PATCH /leader-meetings/m14/agenda-items/ag-3': ({ body }) => ({
        body: { ...makeAgenda().preparation[2], ...(body as object), version: 2 },
      }),
    });
    await user.click(field('Preparation item 3'));
    await user.tab();
    expect(writesIn(calls)).toHaveLength(0);

    await user.click(field('Preparation item 3'));
    await user.type(field('Preparation item 3'), ' today ');
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    expect(writesIn(calls).map(bodyOf)).toEqual([{ text: 'Review scorecard, draft talking points today', version: 1 }]);
    expect(held().agenda.preparation[2].text).toBe('Review scorecard, draft talking points today');
    expect(field('Preparation item 3')).toHaveValue('Review scorecard, draft talking points today');
  });

  it('a PIC written on its own, *—* never written as a name; P18.97-T2 AC-5 the prompt saves nothing', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(Agenda, makeMeetingView(), {
      'PATCH /leader-meetings/m14/agenda-items/ag-10': ({ body }) => ({
        body: { ...makeAgenda().post[1], ...(body as object), version: 2 },
      }),
    });
    // Leaving an empty PIC writes nothing (the prototype writes its dash, `:2853`).
    await user.click(field('PIC for Post item 2'));
    await user.tab();
    expect(writesIn(calls)).toHaveLength(0);
    await user.type(field('PIC for Post item 2'), 'Maya');
    await user.tab();
    await waitFor(() => expect(writesIn(calls)).toHaveLength(1));
    expect(bodyOf(writesIn(calls)[0])).toEqual({ pic: 'Maya', version: 1 });
  });

  it('emptying an item’s text removes it: the server answers that it is gone', async () => {
    const user = userEvent.setup();
    const { calls, held } = renderTab(Agenda, makeMeetingView(), {
      'PATCH /leader-meetings/m14/agenda-items/ag-7': { body: { removed: true } },
    });
    await user.clear(field('During item 4'));
    await user.tab();
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Strategic priorities (Agency)' })).toBeNull());
    expect(bodyOf(writesIn(calls)[0])).toEqual({ text: '', version: 1 });
    expect(held().agenda.during.map((i) => i.id)).toEqual(['ag-4', 'ag-5', 'ag-6', 'ag-8']);
    expect(field('During item 4')).toHaveValue('Summarize next steps & assign owners');
  });

  it('P18.1-T2 AC-7 a 409: the meeting read again, the field shows what was saved, one line says so', async () => {
    const user = userEvent.setup();
    const agenda = makeAgenda();
    const theirs = makeMeetingView({
      agenda: { ...agenda, during: agenda.during.map((i) => (i.id === 'ag-6' ? { ...i, text: 'Their words', version: 4 } : i)) },
    });
    renderTab(Agenda, makeMeetingView(), {
      'PATCH /leader-meetings/m14/agenda-items/ag-6': versionConflict,
      'GET /leader-meetings/m14': { body: theirs },
    });
    await user.type(field('During item 3'), ' (mine)');
    await user.tab();
    await screen.findByText(FORUM_COPY.conflict);
    expect(field('During item 3')).toHaveValue('Their words');
  });

  it('P18.1-T2 AC-7 any other failure keeps what was typed; leaving again sends it again', async () => {
    const user = userEvent.setup();
    const { calls } = renderTab(Agenda, makeMeetingView(), {
      'PATCH /leader-meetings/m14/agenda-items/ag-6': [writeFailed, { body: { ...makeAgenda().during[2], text: 'Strategic priorities (Corporate)!', version: 2 } }],
    });
    await user.type(field('During item 3'), '!');
    await user.tab();
    await screen.findByText(FORUM_COPY.failed);
    expect(field('During item 3')).toHaveValue('Strategic priorities (Corporate)!');
    await user.click(field('During item 3'));
    await user.tab();
    await screen.findByText(FORUM_COPY.saved);
    expect(writesIn(calls)).toHaveLength(2);
  });
});

describe('P18.1-T2 AC-1 read-only: text, and no control drawn', () => {
  it('no input, no box, no *+ Add item*; *"PIC: {name}"*, *—* for none — P18.97-T2 AC-5 never the prompt; a ticked item said to be done', () => {
    renderTab(Agenda, readOnlyMeeting());
    expect(screen.queryByText('Add a PIC')).toBeNull();
    expect(screen.queryByPlaceholderText('Add a PIC')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Prepare August performance data')).toBeInTheDocument();
    expect(within(card('Preparation')).getAllByText('Wilson')).toHaveLength(2);
    expect(within(card('Post')).getByText('—')).toBeInTheDocument();
    const done = screen.getByText('Process update — review prior follow-ups');
    expect(done).toHaveClass('line-through');
    expect(within(done).getByText('Done.')).toHaveClass('sr-only');
  });
});

describe('P18.1-T2 AC-8 an item and a PIC are text, never markup (F-187)', () => {
  const markup = '<b>bold</b><script>window.hacked=1</script>';
  const withMarkup = (m = makeMeetingView()) => ({
    ...m,
    agenda: { ...m.agenda, during: [{ id: 'x', text: markup, pic: markup, done: false, version: 1 }] },
  });

  it('in the inputs, and as the box’s name', () => {
    const { container } = renderTab(Agenda, withMarkup());
    expect(field('During item 1')).toHaveValue(markup);
    expect(field('PIC for During item 1')).toHaveValue(markup);
    expect(box(markup)).toBeInTheDocument();
    expect(container.querySelector('b, script')).toBeNull();
  });

  it('read-only', () => {
    const { container } = renderTab(Agenda, withMarkup(readOnlyMeeting()));
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
    renderTab(Agenda);
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });

  it('read-only', async () => {
    renderTab(Agenda, readOnlyMeeting());
    expect((await clean()).map((v) => v.id)).toEqual([]);
  });
});

describe('P18.1-T2 AC-5 the focus when an emptied item goes (the review’s case)', () => {
  const removed = (id: string) => ({ [`PATCH /leader-meetings/m14/agenda-items/${id}`]: { body: { removed: true } } });

  it('Tab from an emptied text: the next item’s text', async () => {
    const user = userEvent.setup();
    renderTab(Agenda, makeMeetingView(), removed('ag-7'));
    await user.clear(field('During item 4'));
    await user.tab();
    await waitFor(() => expect(field('During item 4')).toHaveValue('Summarize next steps & assign owners'));
    await waitFor(() => expect(field('During item 4')).toHaveFocus());
  });

  it('the last item: the one before it', async () => {
    const user = userEvent.setup();
    renderTab(Agenda, makeMeetingView(), removed('ag-10'));
    await user.clear(field('Post item 2'));
    await user.tab();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Post item 2' })).toBeNull());
    await waitFor(() => expect(field('Post item 1')).toHaveFocus());
  });

  it('the only item: the card’s *+ Add item*', async () => {
    const user = userEvent.setup();
    const m = makeMeetingView();
    renderTab(Agenda, { ...m, agenda: { ...m.agenda, post: m.agenda.post.slice(0, 1) } }, removed('ag-9'));
    await user.clear(field('Post item 1'));
    await user.tab();
    await waitFor(() => expect(within(card('Post')).getByRole('button', { name: '+ Add item' })).toHaveFocus());
  });

  it('a reader who clicked into another field keeps it', async () => {
    const user = userEvent.setup();
    renderTab(Agenda, makeMeetingView(), removed('ag-7'));
    await user.clear(field('During item 4'));
    await user.click(field('Preparation item 1'));
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Strategic priorities (Agency)' })).toBeNull());
    expect(field('Preparation item 1')).toHaveFocus();
  });
});
