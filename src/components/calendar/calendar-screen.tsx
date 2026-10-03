'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  COMPARE_MAX, entryDate, initialsOf, OWN_COPY, peopleOn, PROTOTYPE_COPY, readCalendar, readEntry,
  type CalendarDownlinePerson, type CalendarEntry, type CalendarNow, type CalendarRead, type CalendarView,
} from '@/lib/calendar';
import { HOUR_PX, nextHalfHour, OPEN_AT_HOUR } from '@/lib/calendar-layout';
import { DEFAULT_END, DEFAULT_START, type Slot } from '@/lib/calendar-form';
import { formatMonth, formatWeekRange } from '@/lib/format';
import { joinInFlight } from '@/lib/in-flight';
import { announceInboxChanged } from '@/lib/notifications';
import { useCan, useSession } from '@/lib/session';
import { cn } from '@/lib/cn';
import { TypeLegend } from './calendar-parts';
import { CompareBar } from './compare-bar';
import { DetailDialog } from './detail-dialog';
import { EntryDialog, type EditorState } from './entry-dialog';
import { MonthGrid, MonthSkeleton } from './month-grid';
import { WeekPane, WeekSkeleton, type ScrollGroup } from './week-pane';

/** A pane's frame: a tile of its own, side by side with the others or stacked below 980px (`:96-101`, `:232-234`). */
const TILE = 'overflow-hidden rounded-lg border border-hairline';

/**
 * `/calendar` (`Calendar_Section.html:275-349`; Phase 12).
 *
 * **The office's clock, never the browser's** (invariant §9; exit criterion 1). The read serves the
 * period's dates, the dates ‹ and › ask for, the office's today and its minute; *Today*, ‹ and › ask
 * for those dates and nothing here works one out. The now-line moves on from the read's minute, and
 * when it passes midnight the page reads again rather than deciding what tomorrow is.
 *
 * The prototype's four `alert('Mockup: …')` stand-ins are built as they describe (contradiction 3):
 * *Today* returns to the office's today, scrolled to 7 AM; ‹ and › step a week, or a month in Month;
 * a save is saved — with **no toast**, because the grid moves to the week holding the entry and draws
 * it, which says it was saved where it matters.
 *
 * **From a notice** the address carries `?entry=&date=` (ADR-0095): the entry is read, and its week
 * opens with its detail; if it no longer reads — deleted, or the reader taken off it — the week of
 * `date` opens, with a line saying so.
 *
 * **A read-only support session draws no write** (D-write, roles §3.13): the server refuses every write
 * in one, and the session says which kind it is (`impersonationReadOnly`), so *+ New event*, a slot
 * taken on the grid, *Edit*, *Delete*, *Accept*, *Decline* and *Block time* are not drawn, and the
 * detail offers *Close* alone. Each is also held to its own permission, which the server strips from a
 * read-only session as well; the server refuses the call whatever this draws.
 *
 * **After a delete the focus lands on the reader's own week** (m7), once the read without the entry
 * arrives: the entry that opened the detail, where the focus would have gone back, is gone with it.
 * In Month, where there is no pane, it lands on *+ New event*.
 *
 * **A compared pane is read when what it shows changes, and at no other time** (D-audit): every read
 * of somebody else's calendar writes an audit entry on the server. Its week changes (‹, ›, *Today*,
 * a save that moves the grid), its person changes, or a write of the reader's touches that person's
 * calendar — a block placed on them, an entry inviting them, an edit or a delete of one. The reader's
 * own reloads — a save of their own, an answer, midnight — read the reader's calendar alone.
 */
export function CalendarScreen({
  initialView,
  initialDate,
  initialEntry,
}: {
  initialView: CalendarView;
  initialDate?: string;
  initialEntry?: string;
}) {
  const { me } = useSession();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const may = {
    create: useCan('calendar_entry:create') && !readOnly,
    edit: useCan('calendar_entry:update') && !readOnly,
    delete: useCan('calendar_entry:delete') && !readOnly,
    answer: useCan('calendar_entry:answer') && !readOnly,
  };
  const canBlock = useCan('calendar_entry:block') && !readOnly;
  // A leader is anybody with a direct report (ADR-0087), on a rung whose role reaches a downline: an
  // Agent coaches nobody, so compares nobody. The server decides who is listed; this decides the button.
  const membership = me?.membership;
  const canCompare = (membership?.directCount ?? 0) > 0 && membership?.hierarchyRole !== 'agent';

  const [view, setView] = useState<CalendarView>(initialEntry ? 'week' : initialView);
  const [date, setDate] = useState<string | undefined>(initialEntry ? undefined : initialDate);
  const [resolved, setResolved] = useState(!initialEntry);
  const [read, setRead] = useState<CalendarRead | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reload, setReload] = useState(0);
  const [gone, setGone] = useState(false);
  const [entryError, setEntryError] = useState<ApiError | null>(null);
  const [compared, setCompared] = useState<CalendarDownlinePerson[]>([]);
  const [lost, setLost] = useState<string | null>(null);
  // Per person, how many of the reader's writes have touched their calendar: a compared pane reads
  // again when its count moves. A write's people wait in `touching` until the reader's own read
  // answers, so a save that also moves the grid reads each pane once, for the week it lands on.
  const [touched, setTouched] = useState<Readonly<Record<string, number>>>({});
  const touching = useRef<string[]>([]);
  const comparedReads = useRef(new Map<string, ComparedRead>());
  const [detail, setDetail] = useState<CalendarEntry | null>(null);
  const { toast, show } = useToast();
  const [editor, setEditor] = useState<{ key: number; state: EditorState } | null>(null);
  const opened = useRef(0);
  const scroll = useScrollGroup();
  const panes = useRef<HTMLDivElement>(null);
  const newEventButton = useRef<HTMLButtonElement>(null);
  // Set by a delete; taken by the first read to answer after it (m7).
  const refocus = useRef(false);

  const again = useCallback(() => setReload((n) => n + 1), []);

  // A notice's address: open the entry's week with its detail, or the notice's week with a line.
  useEffect(() => {
    if (!initialEntry) return undefined;
    let live = true;
    readEntry(initialEntry)
      .then((entry) => {
        if (!live) return;
        setDate(entryDate(entry));
        setDetail(entry);
        setResolved(true);
      })
      .catch((err) => {
        if (!live) return;
        const refused = toDisplayError(err);
        if (refused.code === 'NOT_FOUND') setGone(true);
        else setEntryError(refused);
        setDate(initialDate);
        setResolved(true);
      });
    return () => { live = false; };
  }, [initialEntry, initialDate]);

  useEffect(() => {
    if (!resolved) return undefined;
    let live = true;
    setError(null);
    readCalendar({ view, date })
      .then((answer) => {
        if (!live) return;
        setRead(answer);
        const ids = touching.current;
        touching.current = [];
        if (ids.length > 0) {
          setTouched((now) => {
            const next = { ...now };
            for (const id of ids) next[id] = (next[id] ?? 0) + 1;
            return next;
          });
        }
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [resolved, view, date, reload]);

  /** A write of the reader's: their own calendar reads again, and so does each person it touched. */
  const wrote = (ids: readonly string[]) => {
    touching.current = [...touching.current, ...ids];
    again();
  };

  // A read of the other view is not drawn as this one: until it arrives, the skeleton.
  const shown = read && read.view === view ? read : null;
  const nowMinute = useOfficeMinute(shown?.now, again);

  // The read after a delete has drawn the week without the entry: the focus, which went back to that
  // entry and was lost with it, goes to the reader's own week, or to *+ New event* in Month (m7).
  useEffect(() => {
    if (!refocus.current || !shown) return;
    refocus.current = false;
    if (document.activeElement?.closest('[role="dialog"]')) return;
    const own = panes.current?.querySelector<HTMLElement>('[role="region"]');
    (own ?? newEventButton.current)?.focus();
  }, [shown]);

  const open = (state: EditorState) => {
    opened.current += 1;
    setEditor({ key: opened.current, state });
  };

  const changeView = (to: CalendarView) => {
    if (to === view) return;
    setRead(null);
    setView(to);
  };

  const step = (to: string) => {
    setGone(false);
    setDate(to);
  };

  const goToday = () => {
    setGone(false);
    if (shown) setDate(shown.today);
    scroll.reset();
  };

  /** *+ New event*: the office's today when it is in view, else the first day shown (P12-T2 AC-4). */
  const newEvent = () => {
    const inView = shown?.days.find((d) => d.date === shown.today && (shown.view === 'week' || d.inPeriod));
    const first = shown?.view === 'month' ? shown.days.find((d) => d.inPeriod) : shown?.days[0];
    const day = inView?.date ?? first?.date ?? shown?.today ?? '';
    open({ mode: 'new', slot: { date: day, start: DEFAULT_START, end: DEFAULT_END } });
  };

  const saved = (entry: CalendarEntry, before: CalendarEntry | null) => {
    setEditor(null);
    setGone(false);
    setDate(entryDate(entry));
    wrote(peopleOn(entry, before));
  };

  const forget = (membershipId: string) => {
    comparedReads.current.delete(membershipId);
    setCompared((now) => now.filter((c) => c.membershipId !== membershipId));
  };

  const week = view === 'week';
  const label = shown ? (shown.view === 'month' ? formatMonth(shown.month ?? '') : formatWeekRange(shown.from, shown.to)) : '';
  const previousLabel = week ? OWN_COPY.previousWeek : OWN_COPY.previousMonth;
  const nextLabel = week ? OWN_COPY.nextWeek : OWN_COPY.nextMonth;

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" className="h-[34px] px-3.5" onClick={goToday}>{PROTOTYPE_COPY.today}</Button>
          <div className="inline-flex overflow-hidden rounded-md border border-hairline bg-card">
            <button
              type="button"
              aria-label={previousLabel}
              disabled={!shown}
              onClick={() => shown && step(shown.previous)}
              className="h-[34px] w-8 text-md text-navy hover:bg-base"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              aria-label={nextLabel}
              disabled={!shown}
              onClick={() => shown && step(shown.next)}
              className="h-[34px] w-8 text-md text-navy hover:bg-base"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <span aria-live="polite" className="whitespace-nowrap font-display text-xl font-bold text-navy">{label}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div role="group" aria-label={OWN_COPY.view} className="inline-flex rounded-[9px] border border-hairline bg-card p-[3px]">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => changeView(v)}
                className={cn(
                  'rounded-[6px] px-4 py-[7px] text-base font-semibold',
                  view === v ? 'bg-navy text-white' : 'text-muted hover:text-navy',
                )}
              >
                {v === 'week' ? PROTOTYPE_COPY.week : PROTOTYPE_COPY.month}
              </button>
            ))}
          </div>
          {may.create && <Button ref={newEventButton} onClick={newEvent}>{PROTOTYPE_COPY.newEvent}</Button>}
        </div>
      </div>

      <CompareBar
        myInitials={me?.user.initials ?? initialsOf(me?.user.fullName ?? '')}
        week={week}
        canCompare={canCompare}
        compared={compared}
        lost={lost}
        onAdd={(person) => {
          if (compared.length >= COMPARE_MAX || compared.some((c) => c.membershipId === person.membershipId)) return;
          setLost(null);
          setCompared([...compared, person]);
          scroll.reset();
        }}
        onRemove={(membershipId) => {
          forget(membershipId);
          scroll.reset();
        }}
        onLostSeen={() => setLost(null)}
      />

      <TypeLegend />

      {gone && <p role="status" className="mb-3 text-md font-semibold text-navy">{OWN_COPY.gone}</p>}
      {entryError && <div className="mb-3"><ErrorBanner {...entryError} /></div>}

      {error ? (
        <div className="rounded-lg border border-hairline bg-card p-4">
          <ErrorBanner code={error.code} message={OWN_COPY.loadFailed} requestId={error.requestId} />
          <Button variant="secondary" className="mt-3" onClick={again}>{OWN_COPY.tryAgain}</Button>
        </div>
      ) : !shown ? (
        <Skeleton label={OWN_COPY.loading} className={cn(TILE, 'bg-card')}>
          {week ? <WeekSkeleton /> : <MonthSkeleton />}
        </Skeleton>
      ) : shown.view === 'month' ? (
        <MonthGrid
          read={shown}
          onOpen={setDetail}
          onWeek={(day) => {
            setRead(null);
            setView('week');
            setDate(day);
          }}
        />
      ) : (
        <div ref={panes} className="flex flex-col gap-2 min-[980px]:flex-row">
          <WeekPane
            className={TILE}
            read={shown}
            head={{
              name: shown.subject.name,
              initials: me?.user.initials ?? initialsOf(shown.subject.name),
              role: `${shown.subject.rung.label} · ${PROTOTYPE_COPY.you}`,
              me: true,
            }}
            regionLabel={OWN_COPY.region(label)}
            nowMinute={nowMinute}
            onOpen={setDetail}
            onSlot={may.create ? (slot) => open({ mode: 'new', slot }) : undefined}
            scroll={scroll}
          />
          {compared.map((person) => (
            <ComparedPane
              key={person.membershipId}
              person={person}
              date={shown.from}
              today={shown.today}
              touched={touched[person.membershipId] ?? 0}
              reads={comparedReads.current}
              range={label}
              nowMinute={nowMinute}
              canBlock={canBlock}
              onOpen={setDetail}
              onBlock={(slot) => open({ mode: 'block', slot, member: { membershipId: person.membershipId, name: person.name } })}
              blockNow={() => ({ date: shown.today, ...nextHalfHour(nowMinute ?? shown.now.minute) })}
              onLost={() => {
                forget(person.membershipId);
                setLost(person.name);
              }}
              scroll={scroll}
            />
          ))}
        </div>
      )}

      {detail && (
        <DetailDialog
          key={detail.entryId}
          entry={detail}
          may={may}
          onClose={() => setDetail(null)}
          onEdit={(entry) => {
            setDetail(null);
            open({ mode: 'edit', entry });
          }}
          onDeleted={(entry) => {
            setDetail(null);
            refocus.current = true;
            wrote(peopleOn(entry));
          }}
          // An answer is the reader's own: it moves nothing on a compared calendar. The detail closes and
          // the toast says what changed, since an accepted entry looks as it did before; the server read the
          // invitation's notice, so the badge reads its count again.
          onAnswered={(answered) => {
            setDetail(null);
            show(answered.myAnswer === 'declined' ? OWN_COPY.answeredDeclined : OWN_COPY.answeredAccepted);
            announceInboxChanged();
            again();
          }}
        />
      )}

      {editor && (
        <EntryDialog key={editor.key} state={editor.state} onClose={() => setEditor(null)} onSaved={saved} />
      )}
      <Toast toast={toast} />
    </div>
  );
}

/** A compared pane's last answer, kept by the page, and what it was the answer to. */
interface ComparedRead {
  key: string;
  read: CalendarRead;
}

/**
 * A member compared beside the reader (`:967-999`; P12-T5 AC-3 to AC-6): their week, read through
 * `?for=`, which the server audits once per read (D-audit).
 *
 * **Read once for each week, and again only after a write that touched them** (`touched`). The
 * reader's own reloads do not reach it. Its last answer is kept by the page (`reads`), so a pane drawn
 * again for the same week and the same writes — back from Month, or after the reader's own grid failed
 * and was tried again — shows that answer rather than asking again; an identical read already out is
 * joined rather than sent twice, so a re-render writes no second audit entry either. Taking the person
 * out of the bar forgets the answer: compared again, they are read afresh.
 *
 * Their own entries come in full (ADR-0093); one they only attend comes as a busy block. **Today is
 * the reader's read's** (`today`): one office, one today, and the pane is not read again at midnight to
 * learn it. A slot on the pane, or the *"Drag to block"* pill as a button (D-block-key), opens *Block
 * time*. A read the server now refuses — they left, or the edge closed — takes them out of the bar
 * (D-leave).
 */
function ComparedPane({
  person,
  date,
  today,
  touched,
  reads,
  range,
  nowMinute,
  canBlock,
  onOpen,
  onBlock,
  blockNow,
  onLost,
  scroll,
}: {
  person: CalendarDownlinePerson;
  date: string;
  today: string;
  touched: number;
  reads: Map<string, ComparedRead>;
  range: string;
  nowMinute: number | null;
  canBlock: boolean;
  onOpen: (entry: CalendarEntry) => void;
  onBlock: (slot: Slot) => void;
  blockNow: () => Slot;
  onLost: () => void;
  scroll: ScrollGroup;
}) {
  const key = `${date}:${touched}`;
  const kept = reads.get(person.membershipId);
  const [read, setRead] = useState<CalendarRead | null>(kept?.key === key ? kept.read : null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lostRef = useRef(onLost);
  lostRef.current = onLost;

  useEffect(() => {
    const held = reads.get(person.membershipId);
    if (held?.key === key) {
      setRead(held.read);
      return undefined;
    }
    let live = true;
    setError(null);
    joinInFlight(`calendar:${person.membershipId}:${key}:${attempt}`, () =>
      readCalendar({ view: 'week', date, forId: person.membershipId }))
      .then((answer) => {
        reads.set(person.membershipId, { key, read: answer });
        if (live) setRead(answer);
      })
      .catch((err) => {
        if (!live) return;
        const refused = toDisplayError(err);
        if (refused.code === 'NOT_FOUND') lostRef.current();
        else setError(refused);
      });
    return () => { live = false; };
  }, [reads, person.membershipId, date, key, attempt]);

  if (error) {
    return (
      <div className={cn(TILE, 'min-w-0 flex-1 bg-card p-4')}>
        <ErrorBanner code={error.code} message={OWN_COPY.loadFailed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={() => setAttempt((a) => a + 1)}>{OWN_COPY.tryAgain}</Button>
      </div>
    );
  }
  if (!read) {
    return (
      <Skeleton label={OWN_COPY.loading} className={cn(TILE, 'min-w-0 flex-1 bg-card')}>
        <WeekSkeleton />
      </Skeleton>
    );
  }
  return (
    <WeekPane
      className={TILE}
      read={read.today === today ? read : { ...read, today }}
      head={{ name: person.name, initials: initialsOf(person.name), role: person.rung.label, me: false }}
      // Named by the words drawn on it, then what it opens (WCAG 2.5.3 Label in Name, M2).
      pill={canBlock ? (
        <button
          type="button"
          onClick={() => onBlock(blockNow())}
          className="ml-auto shrink-0 rounded-pill bg-success/10 px-[9px] py-[3px] text-xs font-bold text-success hover:bg-success/15"
        >
          {PROTOTYPE_COPY.dragToBlock}
          <span className="sr-only">{OWN_COPY.blockPillSuffix(person.name)}</span>
        </button>
      ) : undefined}
      regionLabel={OWN_COPY.comparedRegion(person.name, range)}
      hoursWhenStacked
      nowMinute={read.days.some((d) => d.date === today) ? nowMinute : null}
      onOpen={onOpen}
      onSlot={canBlock ? onBlock : undefined}
      scroll={scroll}
    />
  );
}

/**
 * Every pane's scroll box, moved as one (`syncScroll`, `:1001-1005`), and all of them back to 7 AM
 * when the set of panes changes or *Today* is pressed (`resetScrollPositions`, `:1091-1093`).
 */
function useScrollGroup(): ScrollGroup & { reset: () => void } {
  const boxes = useRef(new Set<HTMLElement>());
  return useMemo(() => ({
    register: (el: HTMLElement) => {
      boxes.current.add(el);
      return () => { boxes.current.delete(el); };
    },
    sync: (source: HTMLElement) => {
      for (const el of boxes.current) {
        if (el !== source && el.scrollTop !== source.scrollTop) el.scrollTop = source.scrollTop;
      }
    },
    reset: () => {
      for (const el of boxes.current) el.scrollTop = OPEN_AT_HOUR * HOUR_PX;
    },
  }), []);
}

/**
 * The office's minute of the day, from the read, moved on each minute (P12-T2 AC-3). The browser's
 * clock is used only to count the minutes since the read answered, never to say what day or what time
 * it is; past midnight the page reads again (`onMidnight`) and the server says what today is.
 */
function useOfficeMinute(now: CalendarNow | undefined, onMidnight: () => void): number | null {
  const [elapsed, setElapsed] = useState(0);
  const at = now?.at;
  const midnight = useRef(onMidnight);
  midnight.current = onMidnight;

  useEffect(() => {
    setElapsed(0);
    if (!at) return undefined;
    const started = Date.now();
    const seconds = Number.isNaN(Date.parse(at)) ? 0 : new Date(at).getUTCSeconds() * 1000;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started + seconds) / 60_000)), 15_000);
    return () => clearInterval(timer);
  }, [at]);

  const minute = now ? now.minute + elapsed : null;
  const past = minute !== null && minute >= 24 * 60;
  useEffect(() => {
    if (past) midnight.current();
  }, [past]);
  return minute === null ? null : Math.min(minute, 24 * 60 - 1);
}
