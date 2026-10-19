'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/field';
import {
  initialsOf, OWN_COPY, PEOPLE_GROUP_LABEL, PEOPLE_PAGE, personTag, PROTOTYPE_COPY, searchPeople,
  type CalendarPeopleItem, type CalendarPeoplePageInfo,
} from '@/lib/calendar';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/cn';
import { Avatar, CHIP } from './calendar-parts';

/** Somebody on the entry: their membership and their full name. */
export interface Picked {
  membershipId: string;
  name: string;
}

/**
 * The entry dialog's *Invite* field, the people picker (`Calendar_Section.html:381-386`, `:855-903`;
 * P12-T4 AC-1 to AC-3).
 *
 * **The office's active field members, searched on the server** (D-picker): the prototype filtered an
 * in-page array, and an office lists more people than a page should hold. The list opens on focus and
 * lists everybody, a name typed narrows it, and its 190px box loads the next page when it is scrolled
 * to its foot. People already chosen are left out, and a pick keeps the list open, as the prototype's
 * does (`:864-869`). **A page whose every person is chosen already is not a dead end** (m6): while the
 * server has more, the next page is asked for, and *"No matches."* is said only when it has none.
 *
 * **Groups are the server's, relative to the reader**, headed in the prototype's words, *KPM* included
 * (ADR-0096); a group with nobody in it is not drawn (L-53), so an Agent sees the last two. A tag is the
 * rung's ladder label and, for anybody the server does not mark `direct`, *" · under {full name}"* —
 * never the prototype's first name or abbreviated rung (contradiction 17), and never a direct report
 * inferred from a leader's name matching the reader's (invariant §2).
 *
 * **A combobox** (m1; WAI-ARIA's *combobox with list autocomplete*): the field is the `combobox`, the
 * list its `listbox`, and each person a button in the `option` role, out of the tab order. The focus
 * stays in the field: ↓ and ↑ move through the people (`aria-activedescendant`), ↓ past the last asks
 * for the next page, Enter picks, Escape closes the list without closing the dialog around it, and the
 * list closes when the focus leaves the field. A press inside the list keeps the focus where it is.
 * Each chip's ✕ is a button named *Remove {name}* (H-18). **Removing a chip keeps the focus in the
 * dialog** (WCAG 2.4.3): the ✕ pressed goes with its chip, so the focus moves to the next chip's ✕, the
 * previous one's when it was the last, and to the field when none is left, without opening the list.
 */
export function InviteField({
  id,
  chosen,
  fixed = [],
  refused,
  error,
  onAdd,
  onRemove,
}: {
  id: string;
  chosen: readonly Picked[];
  /** On the entry and not removable here: a block's member (ADR-0098). */
  fixed?: readonly Picked[];
  /** Ids the server would no longer accept, marked on their chips. */
  refused: ReadonlySet<string>;
  error?: string;
  onAdd: (person: Picked) => void;
  onRemove: (membershipId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const q = useDebounced(text.trim());
  const [items, setItems] = useState<CalendarPeopleItem[] | null>(null);
  const [page, setPage] = useState<CalendarPeoplePageInfo | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // The person ↓ and ↑ have reached, by position in the list drawn; -1 for nobody.
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // The focus handed back to the field by Escape: that focus does not open the list again.
  const quiet = useRef(false);
  // Each chosen chip's ✕, by membership: where the focus goes when the one beside it is removed.
  const removers = useRef(new Map<string, HTMLButtonElement>());
  const listId = `${id}-people`;
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const optionId = (membershipId: string) => `${id}-person-${membershipId}`;

  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    setItems(null);
    setFailed(false);
    setActive(-1);
    searchPeople({ q, limit: PEOPLE_PAGE })
      .then((answer) => {
        if (!live) return;
        setItems(answer.items);
        setPage(answer.page);
      })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [open, q, attempt]);

  // A press anywhere outside the field closes the list (`:898-903`).
  useEffect(() => {
    if (!open) return undefined;
    const elsewhere = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', elsewhere);
    return () => document.removeEventListener('pointerdown', elsewhere);
  }, [open]);

  const more = useCallback(async () => {
    if (!page?.hasMore || !page.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const answer = await searchPeople({ q, cursor: page.nextCursor, limit: PEOPLE_PAGE });
      setItems((now) => [...(now ?? []), ...answer.items]);
      setPage(answer.page);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }, [page, q, loadingMore]);

  const taken = new Set([...chosen, ...fixed].map((p) => p.membershipId));
  const shown = (items ?? []).filter((p) => !taken.has(p.membershipId));
  // Everybody on the pages read is chosen, and the server has more: the next page, not "No matches." (m6).
  const exhausted = items !== null && shown.length === 0 && !failed && !!page?.hasMore;

  useEffect(() => {
    if (open && exhausted) void more();
  }, [open, exhausted, more]);

  const listed = shown.length > 0 && !failed && !exhausted;
  const current = active >= 0 && shown.length > 0 ? shown[Math.min(active, shown.length - 1)] : null;
  const activeId = open && current ? optionId(current.membershipId) : undefined;

  // The person reached by ↓ or ↑ is scrolled into the list's view.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const pick = (person: CalendarPeopleItem) => {
    onAdd({ membershipId: person.membershipId, name: person.name });
    setText('');
    input.current?.focus();
  };

  // The ✕ pressed unmounts with its chip, and the focus would fall to the page, outside the dialog's
  // trap (WCAG 2.4.3). Its neighbour is still drawn while this runs, so the focus moves before it goes.
  const remove = (at: number) => {
    const neighbour = chosen[at + 1] ?? chosen[at - 1];
    onRemove(chosen[at].membershipId);
    const next = neighbour ? removers.current.get(neighbour.membershipId) : undefined;
    if (next) {
      next.focus();
      return;
    }
    // Nobody left: the field, without opening the list nobody asked for. The focus event is heard as
    // `focus()` runs; when the field had the focus already there is none, and nothing stays quiet.
    quiet.current = true;
    input.current?.focus();
    quiet.current = false;
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const at = current ? shown.indexOf(current) : -1;
      if (at >= shown.length - 1) void more();
      if (shown.length > 0) setActive(Math.min(at + 1, shown.length - 1));
      return;
    }
    if (e.key === 'ArrowUp' && open) {
      e.preventDefault();
      // From nobody, ↑ reaches the last person, as ↓ reaches the first.
      const at = current ? shown.indexOf(current) : shown.length;
      if (shown.length > 0) setActive(Math.max(at - 1, 0));
      return;
    }
    // Enter picks the person reached, rather than saving the dialog around the field.
    if (e.key === 'Enter' && open && current) {
      e.preventDefault();
      pick(current);
    }
  };

  return (
    <div
      ref={wrap}
      // The focus leaving the field closes the list; moving inside it, to a chip's ✕, does not.
      onBlur={(e) => {
        if (open && !wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      className="relative flex flex-col gap-1"
    >
      <label id={labelId} htmlFor={id} className="text-sm font-semibold text-navy">{PROTOTYPE_COPY.inviteLabel}</label>
      {(fixed.length > 0 || chosen.length > 0) && (
        <ul className="mb-1 flex flex-wrap gap-1.5">
          {fixed.map((person) => (
            <li key={person.membershipId} className={cn(CHIP, 'text-xs')}>
              <Avatar initials={initialsOf(person.name)} />
              {person.name}
            </li>
          ))}
          {chosen.map((person, at) => (
            <li
              key={person.membershipId}
              data-refused={refused.has(person.membershipId) ? '' : undefined}
              className={cn(CHIP, 'pr-1 text-xs', refused.has(person.membershipId) && 'border-alert')}
            >
              <Avatar initials={initialsOf(person.name)} />
              {person.name}
              <button
                ref={(el) => {
                  if (el) removers.current.set(person.membershipId, el);
                  else removers.current.delete(person.membershipId);
                }}
                type="button"
                aria-label={OWN_COPY.remove(person.name)}
                onClick={() => remove(at)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-2xs text-muted hover:bg-alert/15 hover:text-alert"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        autoComplete="off"
        value={text}
        placeholder={PROTOTYPE_COPY.invitePlaceholder}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        onFocus={() => {
          if (quiet.current) quiet.current = false;
          else setOpen(true);
        }}
        onChange={(e) => { setText(e.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={onKey}
        className={cn(
          'h-10 rounded-md border bg-card px-3 text-base text-navy',
          error ? 'border-alert' : 'border-hairline',
        )}
      />
      {error && <p id={errorId} role="alert" className="text-xs font-semibold text-alert">{error}</p>}
      {open && (
        <div
          id={listId}
          // A listbox while it lists somebody; while it searches, fails or finds nobody, it says so instead.
          role={listed ? 'listbox' : undefined}
          aria-labelledby={listed ? labelId : undefined}
          // A press in the list, a person or its scrollbar, leaves the focus in the field.
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setOpen(false);
              // A key heard here came from inside the list (*Try again*), never from the field.
              quiet.current = true;
              input.current?.focus();
            }
          }}
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) void more();
          }}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-[190px] overflow-y-auto rounded-[9px] border border-hairline bg-card shadow-modal"
        >
          <PeopleList
            items={items === null || exhausted ? null : shown}
            failed={failed}
            activeId={activeId}
            optionId={optionId}
            onPick={pick}
            onRetry={() => setAttempt((a) => a + 1)}
          />
        </div>
      )}
    </div>
  );
}

function PeopleList({
  items,
  failed,
  activeId,
  optionId,
  onPick,
  onRetry,
}: {
  items: CalendarPeopleItem[] | null;
  failed: boolean;
  activeId: string | undefined;
  optionId: (membershipId: string) => string;
  onPick: (person: CalendarPeopleItem) => void;
  onRetry: () => void;
}) {
  if (failed) {
    return (
      <div role="alert" className="flex items-center justify-between gap-2 px-2.5 py-2 text-sm text-alert">
        {OWN_COPY.listFailed}
        <Button variant="inline" onClick={onRetry}>{OWN_COPY.tryAgain}</Button>
      </div>
    );
  }
  if (items === null) return <p role="status" className="px-2.5 py-2 text-sm text-muted">{OWN_COPY.searching}</p>;
  if (items.length === 0) return <p className="px-2.5 py-2 text-sm text-muted">{PROTOTYPE_COPY.noMatches}</p>;

  // The server's order is the picker's: its groups in order, then tree order. A heading where it changes.
  const groups: { group: CalendarPeopleItem['group']; people: CalendarPeopleItem[] }[] = [];
  for (const person of items) {
    const last = groups[groups.length - 1];
    if (last?.group === person.group) last.people.push(person);
    else groups.push({ group: person.group, people: [person] });
  }

  return (
    <>
      {groups.map(({ group, people }, g) => (
        <div key={`${group}-${g}`} role="group" aria-labelledby={`people-group-${group}-${g}`}>
          <p id={`people-group-${group}-${g}`} className="px-2.5 pb-[3px] pt-[7px] text-2xs font-bold uppercase tracking-[0.04em] text-muted">
            {PEOPLE_GROUP_LABEL[group]}
          </p>
          {people.map((person) => {
            const id = optionId(person.membershipId);
            const on = id === activeId;
            return (
              <button
                key={person.membershipId}
                id={id}
                type="button"
                role="option"
                aria-selected={on}
                tabIndex={-1}
                onClick={() => onPick(person)}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-navy hover:bg-base',
                  on && 'bg-base ring-2 ring-inset ring-amber',
                )}
              >
                <Avatar initials={initialsOf(person.name)} />
                <span className="min-w-0 truncate">{person.name}</span>
                <span className="ml-auto whitespace-nowrap pl-2 text-2xs text-muted">{personTag(person)}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}
