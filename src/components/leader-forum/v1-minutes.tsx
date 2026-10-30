'use client';

import { useId, useRef, useState } from 'react';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Field, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ReorderArrows } from '@/components/ui/reorder-arrows';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill } from '@/components/ui/tone-pill';
import { useDestructiveAction } from '@/components/ui/destructive-action';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { forumMinutesMessages } from '@/i18n/messages/forum-minutes';
import { cn } from '@/lib/cn';
import {
  ItemWrites, listed, moveTo, NONE, runWrite, useDraft, usePending, withActionItem, withActionItems, withAgendaItem,
  type Outcome, type TrackerColumn,
} from '@/lib/leader-meeting-tabs';
import {
  addActionItem, addAgendaItem, AGENDA_SECTIONS, editorsInOrder, removeActionItem, reorderActionItems, saveActionItem,
  saveAgendaItem, type ActionItem, type ActionStatus, type AgendaItem, type AgendaItemSaved, type AgendaSection,
  type MeetingView,
} from '@/lib/leader-meetings';
import { useMeetingWriter } from './meeting-writer';

/**
 * **The meeting's *Agenda* on a phone** (UI V1, 2026-10-30; UI-110; `kpm-mobile` 5): *Persiapan*, *Saat rapat* and
 * *Setelah rapat* as three cards, each with its done count (*1 / 3*); **every item a box to tick and a *+ PIC* chip**
 * (tap: choose one of the leaders who edit the minutes); *Tambah item* at the foot of each card. Each change saves on
 * its own with *Tersimpan* — a box at once, a text when it is left. Every section's box is the server's since UI V1.
 */
export function V1Agenda({ meeting }: { meeting: MeetingView }) {
  const t = useMessages(forumMinutesMessages);
  const v = useMessages(forumMessages).v1;
  const writer = useMeetingWriter();
  const writes = useRef(new ItemWrites());
  const ticks = usePending<boolean>();
  const [picking, setPicking] = useState<{ section: AgendaSection; item: AgendaItem } | null>(null);

  const save = (
    section: AgendaSection, item: AgendaItem, body: { text?: string; pic?: string; done?: boolean }, read: number,
  ): Promise<Outcome<AgendaItemSaved>> =>
    runWrite(writer, () => writes.current.run(
      item.id,
      read,
      (version) => saveAgendaItem(meeting.id, item.id, { ...body, version }),
      (answer) => ('removed' in answer ? undefined : answer.version),
    )).then((outcome) => {
      if (outcome.kind === 'landed') {
        const answer = outcome.answer;
        writer.update((m) => withAgendaItem(m, section, item.id, 'removed' in answer ? null : answer));
      }
      return outcome;
    });

  const tick = (section: AgendaSection, item: AgendaItem, done: boolean) => {
    ticks.begin(item.id, done);
    void save(section, item, { done }, item.version).finally(() => ticks.end(item.id));
  };

  const add = (section: AgendaSection) => {
    void writer.run(() => addAgendaItem(meeting.id, section)).then((item) => {
      if (item !== undefined) writer.update((m) => withAgendaItem(m, section, item.id, item));
    });
  };

  return (
    <div data-v1-agenda="">
      {AGENDA_SECTIONS.map((section) => {
        const items = meeting.agenda[section];
        const done = items.filter((item) => ticks.of(item.id) ?? item.done).length;
        return (
          <section key={section} aria-label={t.sections[section]}>
            <div className="mx-0.5 mb-2 mt-3.5 flex items-baseline justify-between gap-3">
              <h2 className="text-md font-bold text-navy">{t.sections[section]}</h2>
              <span className="text-sm text-muted">{`${done} / ${items.length}`}</span>
            </div>
            <ul className="overflow-hidden rounded-lg bg-card">
              {items.map((item, i) => (
                <AgendaLine
                  key={item.id}
                  meeting={meeting}
                  section={section}
                  item={item}
                  n={i + 1}
                  done={ticks.of(item.id) ?? item.done}
                  readOnly={writer.readOnly}
                  onTick={(next) => tick(section, item, next)}
                  onText={(text, read) => save(section, item, { text }, read)}
                  onPic={() => setPicking({ section, item })}
                />
              ))}
              {!writer.readOnly && (
                <li className="border-t border-divider first:border-t-0">
                  <button
                    type="button"
                    onClick={() => add(section)}
                    className="flex min-h-11 w-full items-center gap-1.5 px-3 text-base font-semibold text-amber-ink"
                  >
                    <LineIcon name="plus" className="h-4 w-4" />
                    {v.addItem}
                    <span className="sr-only"> {t.sections[section]}</span>
                  </button>
                </li>
              )}
            </ul>
          </section>
        );
      })}
      <PicSheet
        meeting={meeting}
        item={picking?.item ?? null}
        onClose={() => setPicking(null)}
        onPick={(pic) => {
          if (picking) void save(picking.section, picking.item, { pic }, picking.item.version);
          setPicking(null);
        }}
      />
    </div>
  );
}

function AgendaLine({
  meeting, section, item, n, done, readOnly, onTick, onText, onPic,
}: {
  meeting: MeetingView;
  section: AgendaSection;
  item: AgendaItem;
  n: number;
  done: boolean;
  readOnly: boolean;
  onTick: (done: boolean) => void;
  onText: (text: string, read: number) => Promise<Outcome<unknown>>;
  onPic: () => void;
}) {
  const t = useMessages(forumMinutesMessages);
  const v = useMessages(forumMessages).v1;
  const text = useDraft(item.text, item.version);
  const leave = () => {
    const sent = text.leave();
    if (sent === null) return;
    void onText(sent.text, sent.read).then((outcome) => text.settle(outcome.kind));
  };
  return (
    <li className="flex min-h-12 items-center gap-2.5 border-t border-divider px-3 py-1.5 first:border-t-0" data-agenda-item={item.id}>
      <label className="-m-3 flex h-11 w-11 shrink-0 items-center justify-center p-3">
        <input
          type="checkbox"
          checked={done}
          disabled={readOnly}
          aria-label={v.tick({ text: item.text })}
          onChange={(e) => onTick(e.target.checked)}
          className="h-5 w-5 accent-signal-green"
        />
      </label>
      <div className="min-w-0 flex-1">
        {readOnly ? (
          <p className={cn('text-base text-ink', done && 'text-muted line-through')}>{item.text}</p>
        ) : (
          <AutoGrowTextarea
            aria-label={t.agendaText({ section: t.sections[section], n })}
            value={text.value}
            maxLength={meeting.limits.textMax}
            onFocus={text.focus}
            onChange={(e) => text.change(e.target.value)}
            onBlur={leave}
            className={cn('border-transparent bg-transparent px-0 text-base', done && 'text-muted line-through')}
          />
        )}
      </div>
      {readOnly ? (
        item.pic && <span className="shrink-0 text-sm font-semibold text-amber-ink">{item.pic}</span>
      ) : (
        <button
          type="button"
          onClick={onPic}
          aria-label={v.picOf({ text: item.text })}
          className={cn(
            'flex min-h-11 shrink-0 items-center',
          )}
        >
          <span className={cn(
            'whitespace-nowrap rounded-pill px-2 py-0.5 text-sm font-semibold',
            item.pic ? 'bg-amber/15 text-amber-ink' : 'border border-dashed border-amber text-amber-ink',
          )}>
            {item.pic || v.picChip}
          </span>
        </button>
      )}
    </li>
  );
}

/** *+ PIC*'s sheet: the leaders who edit the minutes, *Tanpa PIC* to clear it, the one chosen checked. */
function PicSheet({
  meeting, item, onClose, onPick,
}: { meeting: MeetingView; item: AgendaItem | null; onClose: () => void; onPick: (pic: string) => void }) {
  const v = useMessages(forumMessages).v1;
  const names = editorsInOrder(meeting.editors).map((p) => p.name);
  const current = item?.pic ?? '';
  const choices = [...names, ...(current && !names.includes(current) ? [current] : [])];
  return (
    <ResponsiveSheet open={item !== null} title={v.pickPic} onClose={onClose}>
      <div role="radiogroup" aria-label={v.pickPic} className="flex flex-col gap-1.5">
        {[...choices, ''].map((name) => {
          const on = name === current;
          return (
            <button
              key={name || '—'}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(name)}
              className={cn(
                'flex min-h-12 items-center rounded-row px-3 text-left text-md',
                on ? 'bg-amber/[0.12] font-semibold text-ink ring-[1.5px] ring-inset ring-amber' : 'bg-hover-row text-ink',
              )}
            >
              {name || v.noPic}
            </button>
          );
        })}
      </div>
    </ResponsiveSheet>
  );
}

const STATUSES: readonly ActionStatus[] = ['not_planned', 'planned', 'implemented'];
const STATUS_TONE = { not_planned: 'grey', planned: 'green', implemented: 'green' } as const;

/**
 * **The meeting's *Action Items* on a phone** (UI V1; UI-110; `kpm-mobile` 6): the six-column table becomes **cards
 * grouped by initiative** — the initiative and its count, its success measure once under it — and each action its
 * text, then the status pill (*Direncanakan* green, *Belum direncanakan* grey), the PIC and the target on one line.
 * **Tap an action to edit it in a sheet**: every field saving when it is left, the status at once, the order moved
 * there and only there (the drag handle's edit mode), *Hapus tindakan* last with a confirm. *Tambah tindakan* opens the
 * new one's sheet. The lock line says who may edit.
 */
export function V1Actions({ meeting }: { meeting: MeetingView }) {
  const t = useMessages(forumMinutesMessages);
  const v = useMessages(forumMessages).v1;
  const words = useLanguage();
  const writer = useMeetingWriter();
  const writes = useRef(new ItemWrites());
  const orders = usePending<string[]>();
  const statuses = usePending<ActionStatus>();
  const [editing, setEditing] = useState<string | null>(null);

  const order = orders.of('order');
  const rows = order ? arranged(meeting.actionItems, order) : meeting.actionItems;
  const groups = groupByInitiative(rows);
  const open = rows.find((r) => r.id === editing) ?? null;

  const save = (item: ActionItem, body: Partial<Pick<ActionItem, TrackerColumn | 'status'>>, read: number, done?: string) =>
    runWrite(writer, () => writes.current.run(
      item.id, read,
      (version) => saveActionItem(meeting.id, item.id, { ...body, version }),
      (answer) => answer.version,
    ), done ? { done } : undefined).then((outcome) => {
      if (outcome.kind === 'landed') writer.update((m) => withActionItem(m, outcome.answer));
      return outcome;
    });

  const setStatus = (item: ActionItem, next: ActionStatus) => {
    statuses.begin(item.id, next);
    void save(item, { status: next }, item.version, t.statusUpdated).finally(() => statuses.end(item.id));
  };

  const move = (from: number, by: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    const to = from + by;
    if (to < 0 || to >= ids.length) return;
    const next = moveTo(ids, from, to);
    orders.begin('order', next);
    void writer
      .run(() => writes.current.run('order', 0, () => reorderActionItems(meeting.id, next)), { done: t.reordered })
      .then((answer) => { if (answer !== undefined) writer.update((m) => withActionItems(m, answer)); })
      .finally(() => orders.end('order'));
  };

  const remove = (item: ActionItem) => {
    void runWrite(writer, async () => {
      await writes.current.run(item.id, item.version, (version) => removeActionItem(meeting.id, item.id, version));
      return true as const;
    }, { done: t.rowRemoved }).then((outcome) => {
      if (outcome.kind !== 'landed') return;
      setEditing(null);
      writer.update((m) => withActionItems(m, m.actionItems.filter((a) => a.id !== item.id)));
    });
  };

  const add = () => {
    void writer.run(() => addActionItem(meeting.id)).then((item) => {
      if (item === undefined) return;
      writer.update((m) => withActionItem(m, item));
      setEditing(item.id);
    });
  };

  const note = meeting.accessNote;
  const names = [note.ownerName, ...note.adminNames].filter((n): n is string => !!n);

  return (
    <div data-v1-actions="">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.initiative || v.untitled}>
          <div className="mx-0.5 mb-2 mt-3.5 flex items-baseline justify-between gap-3">
            <h2 className="min-w-0 break-words text-md font-bold text-navy">{group.initiative || v.untitled}</h2>
            <span className="shrink-0 text-sm text-muted">{group.items.length}</span>
          </div>
          <ul className="overflow-hidden rounded-lg bg-card">
            {group.metric && (
              <li className="flex items-center gap-1.5 bg-hover-row px-3 py-2 text-sm text-muted">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.5" /></svg>
                <span className="sr-only">{t.headers.metric}: </span>{group.metric}
              </li>
            )}
            {group.items.map((item) => {
              const status = statuses.of(item.id) ?? item.status;
              return (
                <li key={item.id} className="border-t border-divider first:border-t-0" data-action-item={item.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(item.id)}
                    aria-label={v.actionOpen({ text: item.action || v.untitled })}
                    className="block w-full px-3 py-2.5 text-left lg:hover:bg-hover-row"
                  >
                    <span className="block text-md font-semibold leading-snug text-ink">{item.action || v.untitled}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <TonePill tone={STATUS_TONE[status]}>{t.statuses[status]}</TonePill>
                      <span className="inline-flex items-center gap-1">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.5 3.5-5.5 7-5.5s6.2 2 7 5.5" /></svg>
                        <span className="sr-only">{t.headers.pic}: </span>{item.pic || NONE}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
                        <span className="sr-only">{t.headers.remarks}: </span>{item.remarks || NONE}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!writer.readOnly && (
        <div className="mt-2 overflow-hidden rounded-lg bg-card">
          <button type="button" onClick={add} className="flex min-h-11 w-full items-center gap-1.5 px-3 text-base font-semibold text-amber-ink">
            <LineIcon name="plus" className="h-4 w-4" />
            {v.addAction}
          </button>
        </div>
      )}

      <p className="mt-2.5 flex items-center gap-2 text-sm text-muted">
        <LineIcon name="lock" className="h-3.5 w-3.5 shrink-0" />
        {v.lockLine({ names, list: (items) => listed(items, words) })}
      </p>

      <ActionSheet
        item={open}
        index={open ? rows.findIndex((r) => r.id === open.id) : -1}
        count={rows.length}
        meeting={meeting}
        status={open ? statuses.of(open.id) ?? open.status : 'not_planned'}
        readOnly={writer.readOnly}
        onClose={() => setEditing(null)}
        onSave={(item, column, value, read) => save(item, { [column]: value }, read)}
        onStatus={setStatus}
        onMove={(by) => { if (open) move(rows.findIndex((r) => r.id === open.id), by); }}
        onRemove={remove}
      />
    </div>
  );
}

function arranged(items: ActionItem[], order: string[]): ActionItem[] {
  const byId = new Map(items.map((a) => [a.id, a]));
  const placed = order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  return [...placed, ...items.filter((a) => !order.includes(a.id))];
}

/** Actions grouped by their initiative, in the order each initiative first appears; the measure, its first one written. */
export function groupByInitiative(items: readonly ActionItem[]): { key: string; initiative: string; metric: string; items: ActionItem[] }[] {
  const groups: { key: string; initiative: string; metric: string; items: ActionItem[] }[] = [];
  for (const item of items) {
    const name = item.initiative.trim();
    const group = groups.find((g) => g.initiative.toLowerCase() === name.toLowerCase());
    if (group) {
      group.items.push(item);
      if (!group.metric) group.metric = item.metric.trim();
    } else {
      groups.push({ key: name || `untitled-${item.id}`, initiative: name, metric: item.metric.trim(), items: [item] });
    }
  }
  return groups;
}

const FIELDS: readonly TrackerColumn[] = ['initiative', 'metric', 'action', 'pic', 'remarks'];

function ActionSheet({
  item, index, count, meeting, status, readOnly, onClose, onSave, onStatus, onMove, onRemove,
}: {
  item: ActionItem | null;
  index: number;
  count: number;
  meeting: MeetingView;
  status: ActionStatus;
  readOnly: boolean;
  onClose: () => void;
  onSave: (item: ActionItem, column: TrackerColumn, value: string, read: number) => Promise<Outcome<ActionItem>>;
  onStatus: (item: ActionItem, status: ActionStatus) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: (item: ActionItem) => void;
}) {
  const t = useMessages(forumMinutesMessages);
  const v = useMessages(forumMessages).v1;
  const destroy = useDestructiveAction({
    label: v.removeAction,
    message: v.removeQuestion,
    confirmLabel: v.remove,
    onConfirm: () => { if (item) onRemove(item); },
    disabled: readOnly,
  });
  return (
    <ResponsiveSheet open={item !== null} title={v.actionTitle} onClose={onClose}>
      {item && (
        <div className="flex flex-col gap-3">
          {FIELDS.map((column) => (
            <SheetField key={`${item.id}-${column}`} item={item} column={column} meeting={meeting} readOnly={readOnly} onSave={onSave} />
          ))}
          <div>
            <p className="mb-1 text-sm font-semibold text-muted">{t.headers.status}</p>
            <div role="radiogroup" aria-label={t.headers.status} className="flex min-h-11 rounded-pill bg-hover-row p-[3px]">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === status}
                  disabled={readOnly}
                  onClick={() => { if (s !== status) onStatus(item, s); }}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-pill px-1.5 text-sm font-semibold',
                    s === status ? 'bg-navy text-white' : 'text-muted',
                  )}
                >
                  {t.statuses[s]}
                </button>
              ))}
            </div>
          </div>
          {!readOnly && count > 1 && (
            <div className="flex items-center justify-end">
              <ReorderArrows label={v.moveName} index={index} count={count} onMove={onMove} />
            </div>
          )}
          {!readOnly && destroy.row}
          {destroy.dialog}
        </div>
      )}
    </ResponsiveSheet>
  );
}

/** One of the tracker's fields, saving when it is left (`useDraft`), as the table's cells do. */
function SheetField({
  item, column, meeting, readOnly, onSave,
}: {
  item: ActionItem;
  column: TrackerColumn;
  meeting: MeetingView;
  readOnly: boolean;
  onSave: (item: ActionItem, column: TrackerColumn, value: string, read: number) => Promise<Outcome<ActionItem>>;
}) {
  const t = useMessages(forumMinutesMessages);
  const id = useId();
  const draft = useDraft(item[column], item.version);
  const leave = () => {
    const sent = draft.leave();
    if (sent === null) return;
    void onSave(item, column, sent.text, sent.read).then((outcome) => draft.settle(outcome.kind));
  };
  const max = column === 'pic' ? meeting.limits.picMax : meeting.limits.textMax;
  return (
    <Field label={t.headers[column]} htmlFor={id}>
      {column === 'pic' ? (
        <TextInput id={id} value={draft.value} maxLength={max} disabled={readOnly} onFocus={draft.focus} onChange={(e) => draft.change(e.target.value)} onBlur={leave} />
      ) : (
        <AutoGrowTextarea id={id} value={draft.value} maxLength={max} disabled={readOnly} onFocus={draft.focus} onChange={(e) => draft.change(e.target.value)} onBlur={leave} />
      )}
    </Field>
  );
}
