'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useMeetingWriter } from '@/components/leader-forum/meeting-writer';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Button } from '@/components/ui/field';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { forumMinutesMessages } from '@/i18n/messages/forum-minutes';
import { cn } from '@/lib/cn';
import {
  accessNoteText, ItemWrites, moveTo, nextStatus, runWrite, STATUS_TONE, useDraft,
  usePending, withActionItem, withActionItems, type Outcome, type TrackerColumn,
} from '@/lib/leader-meeting-tabs';
import {
  addActionItem, removeActionItem, reorderActionItems, saveActionItem, type ActionItem, type ActionStatus,
  type MeetingView,
} from '@/lib/leader-meetings';

/**
 * ***Action Items*** (`KPM_Owner.html:2822-2843`; `functional/leader-forum.md`, *Action Items*): *Action items
 * tracker*, the table's six named columns between the handle and ×, *+ Add action item*, and the access note.
 *
 * For whoever may edit (I-255): each cell a labelled input, written on leaving it, only when it changed; the
 * status a button named for what it shows and what it becomes, cycling as drawn (`:2865`); × removing the row
 * at once, as drawn; a row moved by drag, as drawn, **and by the keyboard** — the handle a button, the arrow
 * keys moving its row — the order written whole. Anybody else reads the six columns, with no control drawn.
 */
export function ActionItems({ meeting }: { meeting: MeetingView }) {
  const t = useMessages(forumMinutesMessages);
  const words = useLanguage();
  const writer = useMeetingWriter();
  const writes = useRef(new ItemWrites());
  const statuses = usePending<ActionStatus>();
  const orders = usePending<string[]>();
  const removing = useRef(new Set<string>());
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const [focusOn, setFocusOn] = useState<{ id: string; on: 'first' | 'handle' | 'remove' } | 'add' | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const order = orders.of('order');
  const rows = order ? arranged(meeting.actionItems, order) : meeting.actionItems;

  // Where the focus goes after a change: a new row's first cell, a moved row's handle, the next row's × after a
  // removal — so the keyboard is never left on something that has gone.
  useLayoutEffect(() => {
    if (!focusOn) return;
    if (focusOn === 'add') {
      addButton.current?.focus();
    } else {
      const row = rowEls.current.get(focusOn.id);
      const el = focusOn.on === 'first'
        ? row?.querySelector('textarea')
        : row?.querySelector<HTMLElement>(`[data-focus="${focusOn.on}"]`);
      if (!el) return;
      el.focus();
      if (el instanceof HTMLTextAreaElement) el.select();
    }
    setFocusOn(null);
  }, [focusOn, rows]);

  const save = (
    item: ActionItem,
    body: Partial<Pick<ActionItem, TrackerColumn | 'status'>>,
    read: number,
    done?: string,
  ): Promise<Outcome<ActionItem>> =>
    runWrite(writer, () => writes.current.run(
      item.id,
      read,
      (version) => saveActionItem(meeting.id, item.id, { ...body, version }),
      (answer) => answer.version,
    ), done ? { done } : undefined).then((outcome) => {
      if (outcome.kind === 'landed') writer.update((m) => withActionItem(m, outcome.answer));
      return outcome;
    });

  const cycle = (item: ActionItem) => {
    const next = nextStatus(statuses.of(item.id) ?? item.status);
    statuses.begin(item.id, next);
    void save(item, { status: next }, item.version, t.statusUpdated).finally(() => statuses.end(item.id));
  };

  const remove = (item: ActionItem, index: number) => {
    if (removing.current.has(item.id)) return;
    removing.current.add(item.id);
    void runWrite(writer, async () => {
      await writes.current.run(item.id, item.version, (version) => removeActionItem(meeting.id, item.id, version));
      return true as const;
    }, { done: t.rowRemoved }).then((outcome) => {
      removing.current.delete(item.id);
      if (outcome.kind !== 'landed') return;
      writer.update((m) => withActionItems(m, m.actionItems.filter((a) => a.id !== item.id)));
      const then = rows[index + 1] ?? rows[index - 1];
      setFocusOn(then ? { id: then.id, on: 'remove' } : 'add');
    });
  };

  const add = () => {
    void writer.run(() => addActionItem(meeting.id)).then((item) => {
      if (item === undefined) return;
      writer.update((m) => withActionItem(m, item));
      setFocusOn({ id: item.id, on: 'first' });
    });
  };

  /** A row moved, by drag or by an arrow key: shown at once, the order written whole (*Reordered*). */
  const move = (from: number, to: number, keyboard: boolean) => {
    const ids = rows.map((r) => r.id);
    if (to < 0 || to >= ids.length || from === to) return;
    const next = moveTo(ids, from, to);
    orders.begin('order', next);
    if (keyboard) setFocusOn({ id: ids[from], on: 'handle' });
    void writer
      .run(() => writes.current.run('order', 0, () => reorderActionItems(meeting.id, next)), { done: t.reordered })
      .then((answer) => {
        if (answer !== undefined) writer.update((m) => withActionItems(m, answer));
      })
      .finally(() => orders.end('order'));
  };

  const editing = !writer.readOnly;

  return (
    <div>
      {/* `.actions-toolbar` (`:2837`): the label, upper-cased as `.lm-section-label` sets it, and the hint. */}
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-[0.05em] text-muted">{t.tracker}</p>
        {editing && <span className="text-sm text-muted">{t.dragHint}</span>}
      </div>
      <div className="overflow-hidden rounded-lg border border-card-edge bg-card">
        {/* The table keeps its shape and scrolls inside its card on a phone; the page never does. */}
        <div className="overflow-x-auto">
          <table className="relative w-full min-w-[640px] border-collapse text-left text-base">
            <thead>
              <tr>
                {editing && <td aria-hidden="true" className={TH} />}
                <TrackerHeaders />
                {editing && <td aria-hidden="true" className={TH} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((item, i) => (
                <Row
                  key={item.id}
                  meeting={meeting}
                  item={item}
                  n={i + 1}
                  status={statuses.of(item.id) ?? item.status}
                  editing={editing}
                  dragging={dragging === item.id}
                  over={over === item.id && dragging !== item.id}
                  rowRef={(el) => {
                    if (el) rowEls.current.set(item.id, el);
                    else rowEls.current.delete(item.id);
                  }}
                  onSave={(column, value, read) => save(item, { [column]: value }, read)}
                  onCycle={() => cycle(item)}
                  onRemove={() => remove(item, i)}
                  onKeyMove={(by) => move(i, i + by, true)}
                  onDragStart={() => setDragging(item.id)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={() => {
                    if (dragging) setOver(item.id);
                  }}
                  onDrop={() => {
                    const from = rows.findIndex((r) => r.id === dragging);
                    setDragging(null);
                    setOver(null);
                    if (from >= 0) move(from, i, false);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
        {editing && (
          <button
            ref={addButton}
            type="button"
            onClick={add}
            className="block w-full border-t border-hairline px-3.5 py-3 text-left text-base font-semibold text-navy-soft hover:bg-navy/[0.02]"
          >
            {t.addAction}
          </button>
        )}
      </div>
      {/* `.access-note` (`:722`, `:2842`): who may edit now (F-188). */}
      <p className="mt-4 flex items-center gap-2 rounded-md bg-navy/[0.04] px-3.5 py-2 text-sm text-muted">
        {accessNoteText(meeting.accessNote, words)}
      </p>
    </div>
  );
}

/** The rows in the order being written, any row the order does not name after them. */
function arranged(items: ActionItem[], order: string[]): ActionItem[] {
  const byId = new Map(items.map((a) => [a.id, a]));
  const placed = order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  return [...placed, ...items.filter((a) => !order.includes(a.id))];
}

export const TH = 'whitespace-nowrap border-b border-hairline bg-navy/[0.02] px-3 py-2.5 text-xs font-bold uppercase tracking-[0.03em] text-muted';
export const TD = 'border-b border-hairline px-3 py-2.5 align-top text-navy';

/** The six named headers (`:2838`), the print's too. */
export function TrackerHeaders() {
  const h = useMessages(forumMinutesMessages).headers;
  return (
    <>
      {[h.initiative, h.metric, h.action, h.pic, h.status, h.remarks].map((name) => (
        <th key={name} scope="col" className={TH}>{name}</th>
      ))}
    </>
  );
}

/** A status as its pill (`:564-568`, `:2830`). */
export const pillClass = (status: ActionStatus) =>
  cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-2 py-1 text-sm font-semibold', STATUS_TONE[status]);


function Row({
  meeting, item, n, status, editing, dragging, over, rowRef, onSave, onCycle, onRemove, onKeyMove, onDragStart,
  onDragEnd, onDragOver, onDrop,
}: {
  meeting: MeetingView;
  item: ActionItem;
  n: number;
  /** As shown: a status being written shows at once. */
  status: ActionStatus;
  editing: boolean;
  dragging: boolean;
  over: boolean;
  rowRef: (el: HTMLTableRowElement | null) => void;
  onSave: (column: TrackerColumn, value: string, read: number) => Promise<Outcome<ActionItem>>;
  onCycle: () => void;
  onRemove: () => void;
  onKeyMove: (by: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const t = useMessages(forumMinutesMessages);
  const label = t.statuses[status];
  if (!editing) {
    return (
      <tr className="[&:last-child>td]:border-b-0">
        <td className={TD}>{item.initiative}</td>
        <td className={TD}>{item.metric}</td>
        <td className={TD}>{item.action}</td>
        <td className={TD}>{item.pic}</td>
        <td className={TD}><span className={pillClass(status)}>{label}</span></td>
        <td className={TD}>{item.remarks}</td>
      </tr>
    );
  }

  const cell = 'border-b border-hairline px-2 py-2 align-top text-navy';
  return (
    <tr
      ref={rowRef}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        'group [&:last-child>td]:border-b-0',
        dragging && 'opacity-40',
        // `tr.drag-over` (`:722`): the drop target ruled in amber along its top.
        over && 'shadow-[inset_0_2px_0_var(--color-amber)]',
      )}
    >
      <td className={cn(cell, 'w-[26px] px-1 text-center')}>
        <button
          type="button"
          draggable
          data-focus="handle"
          aria-label={t.handleName({ n, initiative: item.initiative })}
          onDragStart={(e) => {
            const tr = e.currentTarget.closest('tr');
            if (tr && e.dataTransfer?.setDragImage) e.dataTransfer.setDragImage(tr, 12, 12);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            // The page would otherwise scroll out from under the row being moved.
            e.preventDefault();
            onKeyMove(e.key === 'ArrowUp' ? -1 : 1);
          }}
          className="cursor-grab select-none rounded-sm px-1 text-md text-muted group-hover:text-navy"
        >
          <span aria-hidden="true">⠿</span>
        </button>
      </td>
      {(['initiative', 'metric', 'action', 'pic'] as const).map((column) => (
        <td key={column} className={cell}>
          <Cell meeting={meeting} item={item} column={column} n={n} onSave={onSave} />
        </td>
      ))}
      <td className={cell}>
        <button
          type="button"
          aria-label={t.statusName({ status: label, next: t.statuses[nextStatus(status)] })}
          onClick={onCycle}
          className={cn(pillClass(status), 'mt-0.5 cursor-pointer')}
        >
          {label}
        </button>
      </td>
      <td className={cell}>
        <Cell meeting={meeting} item={item} column="remarks" n={n} onSave={onSave} />
      </td>
      <td className={cn(cell, 'px-1')}>
        <Button
          variant="icon"
          tone="alert"
          data-focus="remove"
          aria-label={t.removeName({ n })}
          onClick={onRemove}
        >
          <span aria-hidden="true">×</span>
        </Button>
      </td>
    </tr>
  );
}

function Cell({
  meeting, item, column, n, onSave,
}: {
  meeting: MeetingView;
  item: ActionItem;
  column: TrackerColumn;
  n: number;
  onSave: (column: TrackerColumn, value: string, read: number) => Promise<Outcome<ActionItem>>;
}) {
  const t = useMessages(forumMinutesMessages);
  const draft = useDraft(item[column], item.version);
  return (
    <AutoGrowTextarea
      // The column a cell is named by: *"Key initiative, row 2"*.
      aria-label={t.cellName({ column: t.headers[column], n })}
      value={draft.value}
      maxLength={column === 'pic' ? meeting.limits.picMax : meeting.limits.textMax}
      onFocus={draft.focus}
      onChange={(e) => draft.change(e.target.value)}
      onBlur={() => {
        const sent = draft.leave();
        if (sent === null) return;
        void onSave(column, sent.text, sent.read).then((outcome) => draft.settle(outcome.kind));
      }}
      className="min-w-[60px]"
    />
  );
}
