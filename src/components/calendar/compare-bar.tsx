'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/field';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import {
  COMPARE_MAX, initialsOf, personTag, readDownline,
  type CalendarDownlinePerson,
} from '@/lib/calendar';
import { cn } from '@/lib/cn';
import { Avatar, CHIP } from './calendar-parts';

/**
 * The compare bar (`Calendar_Section.html:296-307`, `:905-965`; P12-T5 AC-1, AC-2).
 *
 * *"Viewing:"* and the reader's own *"My Calendar"*, which cannot be removed, are drawn for everybody.
 * **The rest is a leader's** (ADR-0087): a chip per compared person with a ✕ named *Remove {name}*, and
 * *"+ Compare with downline"* with its popover — **in Week, in Month and in a phone's Agenda alike**
 * (P18.95-T8 AC-2; the client's UI review, UI-020: *"Compare with downline" missing in Month view*).
 * D-month had kept it to Week; the chips chosen stay with whichever view is drawn.
 *
 * **Removing somebody puts the focus on *"+ Compare with downline"*** (F2): their ✕ goes with their
 * chip, and the focus would have gone with it to the page's foot.
 */
export function CompareBar({
  myInitials,
  canCompare,
  compared,
  lost,
  onAdd,
  onRemove,
  onLostSeen,
}: {
  myInitials: string;
  canCompare: boolean;
  compared: readonly CalendarDownlinePerson[];
  /** Somebody whose calendar the read now refuses — they left, or the edge closed. */
  lost: string | null;
  onAdd: (person: CalendarDownlinePerson) => void;
  onRemove: (membershipId: string) => void;
  onLostSeen: () => void;
}) {
  const t = useMessages(calendarMessages);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[10px] border border-hairline bg-card px-3.5 py-2.5">
      <span className="mr-0.5 text-sm font-semibold text-muted">{t.viewing}</span>
      <span className={cn(CHIP, 'py-1.5 pl-1.5 pr-2')}>
        <Avatar initials={myInitials} me />
        {t.myCalendar}
      </span>
      {compared.map((person) => (
        <span key={person.membershipId} className={cn(CHIP, 'py-1.5 pl-1.5 pr-1.5')}>
          <Avatar initials={initialsOf(person.name)} />
          {person.name}
          <button
            type="button"
            aria-label={t.remove({ name: person.name })}
            onClick={() => {
              onRemove(person.membershipId);
              toggle.current?.focus();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-navy/10 text-2xs text-navy hover:bg-alert/15 hover:text-alert"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </span>
      ))}
      {canCompare && (
        <ComparePopover toggle={toggle} compared={compared} lost={lost} onAdd={onAdd} onClosed={onLostSeen} />
      )}
      {lost && <p role="status" className="w-full text-sm text-muted">{t.lost({ name: lost })}</p>}
    </div>
  );
}

/**
 * *"+ Compare with downline"* and its list (D-reach): **everyone the reader coaches**, under *"Direct
 * unit"* and *"AAB & their teams (group)"*, an AAB's agents after their AAB — where the prototype's
 * list had the direct reports only, although its label said *their teams* (contradiction 15). Filtered
 * by name as typed; somebody compared already is disabled and reads *" · added ✓"*; at two everybody is,
 * under the prototype's line. It stays open after a pick, so two can be added at once (`:949`), and
 * closes on a press outside it and on Escape, which the prototype's did not.
 *
 * **A pick keeps the focus inside it** (F2): the row picked turns disabled, and a disabled button
 * drops the focus to the page, where Escape would no longer reach the popover. The focus moves to the
 * next row that can still be picked, or to the search when none can — at two, every row. Escape is
 * heard on the document as well, so it closes the popover from wherever the focus has gone.
 */
function ComparePopover({
  toggle,
  compared,
  lost,
  onAdd,
  onClosed,
}: {
  toggle: RefObject<HTMLButtonElement | null>;
  compared: readonly CalendarDownlinePerson[];
  lost: string | null;
  onAdd: (person: CalendarDownlinePerson) => void;
  onClosed: () => void;
}) {
  const t = useMessages(calendarMessages);
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<CalendarDownlinePerson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [text, setText] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // The row just picked, until the pick has drawn it disabled and the focus can move on from it.
  const picked = useRef<string | null>(null);
  const popover = useId();

  // Opened, the search takes the focus, as the prototype's amber-bordered field invites (`:303`).
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setFailed(false);
    readDownline()
      .then((answer) => { if (live) setPeople(answer.people); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [open, attempt]);

  const close = () => {
    picked.current = null;
    setOpen(false);
    setText('');
    onClosed();
  };

  useEffect(() => {
    if (!open) return undefined;
    const elsewhere = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    // Escape from wherever the focus is: inside, the wrapper below hears it first and stops it.
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const at = document.activeElement;
      const lostFocus = !at || at === document.body || !!wrap.current?.contains(at);
      close();
      if (lostFocus) toggle.current?.focus();
    };
    document.addEventListener('pointerdown', elsewhere);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', elsewhere);
      document.removeEventListener('keydown', escape);
    };
    // `close` reads nothing that changes while the list is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // After a pick has drawn its row disabled: the next row that can still be picked, else the search.
  useEffect(() => {
    const from = picked.current;
    if (!from || !open) return;
    picked.current = null;
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>('button[data-person]') ?? [])];
    const at = rows.findIndex((row) => row.dataset.person === from);
    const next = [...rows.slice(at + 1), ...rows.slice(0, Math.max(at, 0))].find((row) => !row.disabled);
    (next ?? search.current)?.focus();
  }, [compared, open]);

  const add = (person: CalendarDownlinePerson) => {
    picked.current = person.membershipId;
    onAdd(person);
  };

  const atCap = compared.length >= COMPARE_MAX;
  const filter = text.trim().toLowerCase();
  const shown = (people ?? []).filter((p) => !filter || p.name.toLowerCase().includes(filter));

  return (
    <div
      ref={wrap}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
          toggle.current?.focus();
        }
      }}
    >
      <button
        ref={toggle}
        type="button"
        aria-expanded={open}
        aria-controls={popover}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-1.5 rounded-pill border-[1.3px] border-dashed border-hairline px-[13px] py-[7px] text-sm font-semibold text-navy-soft hover:border-navy-soft hover:bg-navy-soft/5"
      >
        {t.compare}
      </button>
      <div
        id={popover}
        hidden={!open}
        className="absolute left-0 top-full z-30 mt-2 w-[270px] max-w-[calc(100vw-2rem)] rounded-lg border border-hairline bg-card p-2.5 shadow-modal"
      >
        {open && (
          <>
            <input
              ref={search}
              type="text"
              autoComplete="off"
              aria-label={t.searchDownline}
              placeholder={t.searchDownline}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="mb-2 w-full rounded-[7px] border-[1.3px] border-hairline px-2.5 py-2 text-base text-navy focus:border-amber"
            />
            <div ref={list} className="max-h-[320px] overflow-y-auto">
              {lost && <p className="px-2.5 py-2 text-sm text-muted">{t.lost({ name: lost })}</p>}
              {atCap && <p className="px-2.5 py-2 text-sm text-muted">{t.compareCap({ max: COMPARE_MAX })}</p>}
              {failed ? (
                <div role="alert" className="flex items-center justify-between gap-2 px-2.5 py-2 text-sm text-alert">
                  {t.listFailed}
                  <Button variant="inline" onClick={() => setAttempt((a) => a + 1)}>{t.tryAgain}</Button>
                </div>
              ) : people === null ? (
                <p role="status" className="px-2.5 py-2 text-sm text-muted">{t.searching}</p>
              ) : shown.length === 0 ? (
                <p className="p-2.5 text-sm text-muted">{t.noMatches}</p>
              ) : (
                <DownlineList people={shown} compared={compared} atCap={atCap} onAdd={add} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DownlineList({
  people,
  compared,
  atCap,
  onAdd,
}: {
  people: CalendarDownlinePerson[];
  compared: readonly CalendarDownlinePerson[];
  atCap: boolean;
  onAdd: (person: CalendarDownlinePerson) => void;
}) {
  const t = useMessages(calendarMessages);
  const language = useLanguage();
  const groups: { group: CalendarDownlinePerson['group']; members: CalendarDownlinePerson[] }[] = [];
  for (const person of people) {
    const last = groups[groups.length - 1];
    if (last?.group === person.group) last.members.push(person);
    else groups.push({ group: person.group, members: [person] });
  }
  return (
    <>
      {groups.map(({ group, members }, g) => (
        <div key={`${group}-${g}`} role="group" aria-labelledby={`downline-${group}-${g}`}>
          <p id={`downline-${group}-${g}`} className="px-2 pb-1 pt-1.5 text-2xs font-bold uppercase tracking-[0.05em] text-muted">
            {t.downlineGroups[group]}
          </p>
          <ul>
            {members.map((person) => {
              const already = compared.some((c) => c.membershipId === person.membershipId);
              return (
                <li key={person.membershipId}>
                  <button
                    type="button"
                    data-person={person.membershipId}
                    disabled={already || atCap}
                    onClick={() => onAdd(person)}
                    className="flex w-full items-center gap-[9px] rounded-md px-2 py-[7px] text-left hover:bg-base disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Avatar initials={initialsOf(person.name)} className="h-6 w-6" />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold text-navy">{person.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {personTag(person, language)}
                        {already ? t.added : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}
