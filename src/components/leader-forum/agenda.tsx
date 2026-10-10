'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useMeetingWriter } from '@/components/leader-forum/meeting-writer';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { TextInput } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  ItemWrites, runWrite, TABS_COPY, TABS_OWN_COPY, useDraft, usePending, withAgendaItem, type Outcome,
} from '@/lib/leader-meeting-tabs';
import {
  addAgendaItem, AGENDA_SECTIONS, saveAgendaItem, type AgendaItem, type AgendaItemSaved, type AgendaSection,
  type MeetingView,
} from '@/lib/leader-meetings';

/**
 * ***Agenda*** (`KPM_Owner.html:2800-2820`; `functional/leader-forum.md`, *Agenda*): *Preparation*, *During*
 * and *Post*, each a card of items — the item's text and *"PIC: {name}"*, *—* for none — and *+ Add item*.
 *
 * For whoever may edit, each text and each PIC is a labelled input (I-255) written on leaving it, only when it
 * changed; the boxes are *During*'s only, each named by its item's text, a tick written at once; *+ Add item* is
 * a button, and moves the focus to the new item's text. **Emptying an item's text removes it**: the prototype
 * draws no remove (D-forum-model); the focus, if it was in that item, goes to the next. Anybody else reads text,
 * with no control drawn.
 */
export function Agenda({ meeting }: { meeting: MeetingView }) {
  const writer = useMeetingWriter();
  const writes = useRef(new ItemWrites());
  const latest = useRef(meeting);
  latest.current = meeting;
  const ticks = usePending<boolean>();
  const items = useRef(new Map<string, HTMLElement>());
  const addButtons = useRef(new Map<AgendaSection, HTMLButtonElement>());
  const [focusOn, setFocusOn] = useState<{ id: string; select: boolean } | { add: AgendaSection } | null>(null);

  // Where the focus goes after a change: a new item's text, selected so typing replaces *New agenda item*; after an
  // item is removed, the next item's text, else the one before, else the card's *+ Add item*.
  useLayoutEffect(() => {
    if (!focusOn) return;
    if ('add' in focusOn) {
      addButtons.current.get(focusOn.add)?.focus();
    } else {
      const el = items.current.get(focusOn.id)?.querySelector('textarea');
      if (!el) return;
      el.focus();
      if (focusOn.select) el.select();
    }
    setFocusOn(null);
  }, [focusOn, meeting]);

  /**
   * Where the focus goes when an emptied item is removed — only when it was inside that item (its PIC, after a
   * Tab) or nowhere: a reader who clicked into another field keeps it.
   */
  const focusAfterRemoving = (section: AgendaSection, id: string) => {
    const active = document.activeElement;
    const lost = !active || active === document.body || items.current.get(id)?.contains(active);
    if (!lost) return;
    const list = latest.current.agenda[section];
    const at = list.findIndex((it) => it.id === id);
    const then = list[at + 1] ?? list[at - 1];
    setFocusOn(then ? { id: then.id, select: false } : { add: section });
  };

  const save = (
    section: AgendaSection,
    item: AgendaItem,
    body: { text?: string; pic?: string; done?: boolean },
    read: number,
  ): Promise<Outcome<AgendaItemSaved>> =>
    runWrite(writer, () => writes.current.run(
      item.id,
      read,
      (version) => saveAgendaItem(meeting.id, item.id, { ...body, version }),
      (answer) => ('removed' in answer ? undefined : answer.version),
    )).then((outcome) => {
      if (outcome.kind === 'landed') {
        const answer = outcome.answer;
        if ('removed' in answer) focusAfterRemoving(section, item.id);
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
      if (item === undefined) return;
      writer.update((m) => withAgendaItem(m, section, item.id, item));
      setFocusOn({ id: item.id, select: true });
    });
  };

  return (
    // `.agenda-cols` (`:704`, `:769-771`): three columns, the middle widest; one below 900px.
    <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-[1fr_1.6fr_1fr]">
      {AGENDA_SECTIONS.map((section) => (
        <section key={section} className="rounded-lg border border-hairline bg-card px-4 pb-3 pt-4">
          <h3 className="mb-3 text-md font-extrabold text-navy">{TABS_COPY.sections[section]}</h3>
          {meeting.agenda[section].map((item, i) => (
            <Item
              key={item.id}
              meeting={meeting}
              section={section}
              item={item}
              n={i + 1}
              done={ticks.of(item.id) ?? item.done}
              readOnly={writer.readOnly}
              onText={(text, read) => save(section, item, { text }, read)}
              onPic={(pic, read) => save(section, item, { pic }, read)}
              onTick={(done) => tick(section, item, done)}
              itemRef={(el) => {
                if (el) items.current.set(item.id, el);
                else items.current.delete(item.id);
              }}
            />
          ))}
          {!writer.readOnly && (
            <button
              ref={(el) => {
                if (el) addButtons.current.set(section, el);
                else addButtons.current.delete(section);
              }}
              type="button"
              onClick={() => add(section)}
              className="py-1 text-sm font-semibold text-navy-soft hover:underline"
            >
              {TABS_COPY.addItem}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}

function Item({
  meeting, section, item, n, done, readOnly, onText, onPic, onTick, itemRef,
}: {
  meeting: MeetingView;
  section: AgendaSection;
  item: AgendaItem;
  n: number;
  /** As shown: a tick being written shows at once. */
  done: boolean;
  readOnly: boolean;
  onText: (text: string, read: number) => Promise<Outcome<unknown>>;
  onPic: (pic: string, read: number) => Promise<Outcome<unknown>>;
  onTick: (done: boolean) => void;
  /** The item's row: its text found by it, and whether the focus was inside it when it goes. */
  itemRef: (el: HTMLElement | null) => void;
}) {
  const sectionName = TABS_COPY.sections[section];
  const boxed = section === 'during';
  const struck = boxed && done;
  const text = useDraft(item.text, item.version);
  const pic = useDraft(item.pic, item.version);

  if (readOnly) {
    return (
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1">
          <div className={cn('text-base leading-[1.4] text-navy', struck && 'text-muted line-through')}>
            {struck && <span className="sr-only">{`${TABS_OWN_COPY.done}. `}</span>}
            {item.text}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {TABS_COPY.pic}{' '}
            <span className="font-semibold text-navy-soft">{item.pic || '—'}</span>
          </div>
        </div>
      </div>
    );
  }

  const leave = (draft: ReturnType<typeof useDraft>, write: (value: string, read: number) => Promise<Outcome<unknown>>) => {
    const sent = draft.leave();
    if (sent === null) return;
    void write(sent.text, sent.read).then((outcome) => draft.settle(outcome.kind));
  };

  return (
    <div ref={itemRef} className="mb-3 flex items-start gap-2">
      {boxed && (
        <input
          type="checkbox"
          aria-label={item.text}
          checked={done}
          onChange={(e) => onTick(e.target.checked)}
          className="mt-[5px] h-[15px] w-[15px] shrink-0 accent-amber"
        />
      )}
      <div className="min-w-0 flex-1">
        <AutoGrowTextarea
          aria-label={TABS_OWN_COPY.agendaText(sectionName, n)}
          value={text.value}
          maxLength={meeting.limits.textMax}
          onFocus={text.focus}
          onChange={(e) => text.change(e.target.value)}
          onBlur={() => leave(text, onText)}
          className={cn('leading-[1.4]', struck && 'text-muted line-through')}
        />
        <div className="mt-0.5 flex items-baseline gap-1 text-xs text-muted">
          <span aria-hidden="true">{TABS_COPY.pic}</span>
          <TextInput
            density="cell"
            aria-label={TABS_OWN_COPY.agendaPic(sectionName, n)}
            placeholder="—"
            value={pic.value}
            maxLength={meeting.limits.picMax}
            onFocus={pic.focus}
            onChange={(e) => pic.change(e.target.value)}
            onBlur={() => leave(pic, onPic)}
            className="py-0 text-xs font-semibold text-navy-soft placeholder:text-navy-soft"
          />
        </div>
      </div>
    </div>
  );
}
