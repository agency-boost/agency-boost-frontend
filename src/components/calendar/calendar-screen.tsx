'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { HEADER_BUTTON, HEADER_CONTROL } from '@/components/ui/header-control';
import { LineIcon } from '@/components/ui/line-icon';
import { PickerMenu } from '@/components/ui/picker-menu';
import { shortOfRung } from '@/components/ui/role-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  COMPARE_MAX, DISPLAYS, entryDate, initialsOf, isHiddenTask, peopleOn, readCalendar, readDownline, readEntry,
  setCoachingItemDone, setLeadActionDone, viewOf,
  type CalendarDisplay, type CalendarDownlinePerson, type CalendarEntry, type CalendarNow, type CalendarRead,
  type CalendarTask, type CalendarView,
} from '@/lib/calendar';
import { readLead, type Lead } from '@/lib/leads';
import { HOUR_PX, nextHalfHour, OPEN_AT_HOUR, openingHour } from '@/lib/calendar-layout';
import { DEFAULT_END, DEFAULT_START, type Slot } from '@/lib/calendar-form';
import { formatDayRange, formatMonth } from '@/lib/format';
import { joinInFlight } from '@/lib/in-flight';
import { announceInboxChanged } from '@/lib/notifications';
import { useCan, useSession } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';
import { usePhone } from '@/lib/use-phone';
import { cn } from '@/lib/cn';
import { AgendaPane, AgendaSkeleton, type AgendaPerson } from './agenda';
import { type PaneHead } from './calendar-parts';
import {
  CalendarTasksContext, filterRead, TaskPopup, TypeChips, type CalendarTasks, type ComparedTasks, type FilterKind,
  type TaskPerson,
} from './calendar-tasks';
import { CompareBar } from './compare-bar';
import type { EditorState } from './entry-dialog';
import { MonthGrid, MonthSkeleton } from './month-grid';
import { ThreeDays } from './three-days';
import { WeekPane, WeekSkeleton, type ScrollGroup } from './week-pane';

/** The lead's details from a task's › (UI-104 point 4; D-19), loaded when a lead is opened. */
const LeadSheet = dynamic(() => import('@/components/lead-sheet').then((m) => m.LeadSheet), { ssr: false });
/**
 * An entry's detail and the new/edit form, downloaded when one is first opened (P18.11-T16, the bundle): drawn only
 * after a tap or an address that asks for one, and with the invite picker a third of the screen's own code.
 */
const DetailDialog = dynamic(() => import('./detail-dialog').then((m) => m.DetailDialog), { ssr: false });
const EntryDialog = dynamic(() => import('./entry-dialog').then((m) => m.EntryDialog), { ssr: false });

/** A pane's frame: a tile of its own, side by side with the others or stacked below 980px (`:96-101`, `:232-234`). */
const TILE = 'overflow-hidden rounded-lg border border-hairline';

/**
 * **One size for every control in the toolbar**, at every size: since P19.8-T3 AC-1 (MOB UI-171, D-38, ADR-0227 §1)
 * **the header control's 13px, 600, 44px** (`HEADER_BUTTON`, the white pill), as Activity's *Log Activity · Dashboard ·
 * Ratio* — where P19.1-T3 AC-3 (UI-156, superseded) raised them to 16px / 48px for the native view select, which is gone.
 */
const TOOL = cn(HEADER_BUTTON, 'shrink-0');
/** A phone's first row fits 360px with *Agenda* whole (MOB UI-171): its buttons 10px either side, 4px inside. */
const TIGHT = 'max-md:gap-1 max-md:px-2.5';

/**
 * **The last view chosen, on this device** (P19.1-T3 AC-9; UI-119): a convenience, so a storage that refuses — a private
 * window, a cleared site — falls back to the size's default and nothing else changes. From 768px only: the phone opens
 * on the Agenda, always (D-30).
 */
const VIEW_KEY = 'ab.calendar.view';

function storedView(): CalendarDisplay | null {
  try {
    const kept = window.localStorage.getItem(VIEW_KEY);
    return (DISPLAYS as readonly string[]).includes(kept ?? '') ? kept as CalendarDisplay : null;
  } catch {
    return null;
  }
}

function keepView(view: CalendarDisplay) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // A convenience: refused, the next visit opens on the size's default.
  }
}


/**
 * `/calendar` (`Calendar_Section.html:275-349`; Phase 12; UI V1, 2026-10-30, UI-104).
 *
 * **The office's clock, never the browser's** (invariant §9; exit criterion 1). The read serves the
 * period's dates, the dates ‹ and › ask for, the office's today and its minute; *Today*, ‹ and › ask
 * for those dates and nothing here works one out. The now-line moves on from the read's minute, and
 * when it passes midnight the page reads again rather than deciding what tomorrow is.
 *
 * The prototype's four `alert('Mockup: …')` stand-ins are built as they describe (contradiction 3):
 * *Today* returns to the office's today; ‹ and › step the period; a save is saved, and the view moves to
 * the period holding the entry and draws it. **A new entry also says *Event created ✓*** (P18.7-T1 AC-6).
 *
 * **From a notice** the address carries `?entry=&date=` (ADR-0095): the entry is read, and its week
 * opens with its detail; if it no longer reads, the week of `date` opens, with a line saying so.
 *
 * **A read-only support session draws no write** (D-write, roles §3.13): no *+ New event*, no slot, no *Edit*, no
 * *Delete*, no answer, no *Block time*, and **no task checkbox** — the server refuses every one regardless.
 *
 * **After a delete the focus lands on the reader's own calendar** (m7), or on *+ New event* in Month.
 *
 * **A compared calendar is read when what it shows changes, and at no other time** (D-audit): its period, its person,
 * or a write of the reader's that touched that person's calendar.
 *
 * **UI V1 (UI-104)**:
 *
 * - **Four views at every width — *Agenda · 3 Hari · Week · Month*** — the Agenda the phone's default, starting from
 *   today (points 5, 10); Week the default from 768px until P19.1-T3 (below).
 * - **What other features put on it**, read-only: a lead's next action and an open coaching action item as *Tugas*
 *   (no time: never on the grid), and the events joined, at their time (point 1). **A tick on the reader's own task**
 *   completes it at its source — the toast says *Selesai* with *Urungkan* — strikes it through and lowers every count
 *   at once (point 4); a lead row's › opens the lead's details (`LeadSheet`), whose foot offers the reader's own lead
 *   ***Hapus tugas*** — the next action cleared, the lead kept (the staging review of 2026-10-31).
 * - **An entry is deleted from its detail or from *Edit event*** (the same question, the same pinned delete).
 * - ***Filter*** **on a phone** slides a panel open under the controls — the button turns navy — with *Melihat* (the
 *   compare bar) and *Jenis*: one tick chip per type, which replace the coloured-dot legend at every width (point 9).
 * - ***Sembunyikan aktivitas calendar*** **is no longer here**: it lives on *Profil saya* (UI-111); a person who keeps
 *   it on is still read by a leader as *Sibuk* blocks and a count of tasks — the server's rule (ADR-0110).
 * - **Compared people** appear in the Agenda and 3 Hari among the reader's own, each with their avatar; in Week and
 *   Month as panes of their own, as before.
 *
 * **Phase 19.1 (P19.1-T3; UI-117 to UI-120, UI-144, UI-154, UI-156)**:
 *
 * - **One toolbar, in the same place in every view** (UI-117, UI-144). A phone keeps its own — *Hari ini* · ‹ › · the
 *   view picker · *Filter*, then the range and *+ Event baru* — in all four views, 3 Hari included. A tablet: *Hari ini*
 *   ‹ › the range … *Filter*, then the switcher across and *+ Event baru*. A laptop, one row: *Hari ini* ‹ › the range ·
 *   the switcher · *Filter* · *+ Event baru*. Every control 16px / 600 / 48px (UI-156).
 * - ***Melihat* and *Jenis***: a laptop's one row under the toolbar, which its *Filter* hides and shows; a tablet's and a
 *   phone's *Filter* panel, the button navy while it is open (UI-118).
 * - **The default view by size** — the Agenda on a phone, 3 Hari on a tablet, Week on a laptop — and **the last one
 *   chosen remembered** on the device from 768px (UI-119).
 * - **3 Hari and Week are one time grid** (`TimeGrid`), opened an hour before now (UI-117, UI-144).
 *
 * **Phase 19.8 (P19.8-T3; MOB UI-171 to UI-175, the brief's Calendar, the 7 November mockup)**:
 *
 * - **Every toolbar control 13px / 600 / 44px, at every size**; on a phone **the view picker is a button that opens a
 *   small menu right under it** (`PickerMenu`: *Agenda · 3 Hari · Week · Month*), never a native select (MOB UI-171).
 * - **3 Hari and Week on a phone open at the top of the page, and the page never scrolls**: the grid has its own box,
 *   opened with 07.00 at its top and running to the foot of the screen (MOB UI-172); a 46px hour column (MOB UI-174).
 * - **No person row on *Kalender saya***; compared people are a pane each, with a person row, in 3 Hari as in Week (MOB
 *   UI-175). The Agenda still draws theirs among the reader's own.
 * - **A phone's *Filter* holds *Melihat* alone** (the brief's Calendar 3); a tablet and a laptop keep *Jenis* (ADR-0226
 *   §4).
 */
export function CalendarScreen({
  initialView,
  initialDate,
  initialEntry,
  initialWith,
}: {
  /** The address's `view`, when it names one; without it, the size's default or the view last chosen (UI-119). */
  initialView?: CalendarView;
  initialDate?: string;
  initialEntry?: string;
  /** The address's `with` (P18.8-T6 AC-4): open *New event* as a 1:1 with this member, once the week is read. */
  initialWith?: string;
}) {
  const t = useMessages(calendarMessages);
  const done = useMessages(confirmationMessages);
  const language = useFigureLanguage();
  const { me } = useSession();
  const phone = usePhone();
  // A tablet: 768–1023px (UI-117's two rows; UI-119's 3 Hari). From 1024px, a laptop.
  const tablet = useMediaQuery('tablet');
  /*
   * **The first read waits one effect** (UI-104): `usePhone` answers in an effect, after the first render, and since UI
   * V1 the phone's Agenda and the wider Week are different reads — asking before it answered would read a week a
   * phone never shows. This effect runs after the media query's, in the same commit, so the first read asks once.
   */
  const [ready, setReady] = useState(false);
  // The last view chosen (UI-119), read with the sizes: never on the server, and before the first read.
  const [kept, setKept] = useState<CalendarDisplay | null>(null);
  useEffect(() => {
    setKept(storedView());
    setReady(true);
  }, []);
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

  // What the reader chose, or the address named; `null` until then, which is the size's default (UI-119): a phone's
  // Agenda, else the view last chosen on this device, else 3 Hari on a tablet and Week on a laptop. A notice's entry
  // opens on that default at its date.
  const [chosen, setChosen] = useState<CalendarDisplay | null>(initialEntry ? null : initialView ?? null);
  const display: CalendarDisplay = chosen ?? (phone ? 'agenda' : kept ?? (tablet ? 'three_days' : 'week'));
  const view = viewOf(display);
  const [date, setDate] = useState<string | undefined>(initialEntry ? undefined : initialDate);
  const [resolved, setResolved] = useState(!initialEntry);
  const [read, setRead] = useState<CalendarRead | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reload, setReload] = useState(0);
  const [gone, setGone] = useState(false);
  const [entryError, setEntryError] = useState<ApiError | null>(null);
  const [compared, setCompared] = useState<CalendarDownlinePerson[]>([]);
  const [lost, setLost] = useState<string | null>(null);
  // Per person, how many of the reader's writes have touched their calendar: a compared read is asked
  // again when its count moves.
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
  const refocus = useRef(false);
  // *Filter* (UI-104 point 9; UI-118): a phone's and a tablet's panel, closed until opened; a laptop's row under the
  // toolbar, shown until hidden. `null` is the size's own.
  const [filtersChosen, setFiltersChosen] = useState<boolean | null>(null);
  const laptop = !phone && !tablet;
  const filtersOpen = filtersChosen ?? laptop;
  const setFiltersOpen = (next: boolean | ((now: boolean) => boolean)) =>
    setFiltersChosen(typeof next === 'function' ? next(filtersOpen) : next);
  const filtersId = useId();
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<FilterKind>>(new Set());
  // The day whose *Tugas* popup is open (UI-104 point 3), and the lead a task's › opened.
  const [popupDay, setPopupDay] = useState<string | null>(null);
  const [sheetLead, setSheetLead] = useState<Lead | null>(null);

  const again = useCallback(() => setReload((n) => n + 1), []);
  const ticks = useTaskTicks({
    canTick: may.edit, canTickCoaching: may.edit && !me?.isImpersonating, show, onChanged: again, onLead: setSheetLead,
  });

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
    if (!resolved || !ready) return undefined;
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
  }, [resolved, ready, view, date, reload]);

  /** A write of the reader's: their own calendar reads again, and so does each person it touched. */
  const wrote = (ids: readonly string[]) => {
    touching.current = [...touching.current, ...ids];
    again();
  };

  // A read of another view is not drawn as this one: until it arrives, the skeleton.
  const raw = read && read.view === view ? read : null;
  const shown = raw ? filterRead(raw, hiddenKinds) : null;
  const nowMinute = useOfficeMinute(raw?.now, again);

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

  /**
   * **A view chosen** (UI-104 points 5, 10): the Agenda and 3 Hari start on the office's today — no past day on open —
   * and Week and Month open on the period holding the day shown.
   */
  const changeView = (to: CalendarDisplay, on?: string) => {
    if (to === display && on === undefined) return;
    setRead(null);
    setChosen(to);
    if (!phone) keepView(to);
    if (on !== undefined) setDate(on);
    else if (to === 'agenda' || to === 'three_days') setDate(raw?.today);
  };

  const step = (to: string) => {
    setGone(false);
    setDate(to);
  };

  const goToday = () => {
    setGone(false);
    if (raw) setDate(raw.today);
    // Back to an hour before now (UI-117) — 07.00 on a phone (MOB UI-172): today is the day in view once the read lands.
    scroll.reset(raw && !phone ? openingHour([raw.today], raw.today, nowMinute) : undefined);
  };

  /*
   * **A 1:1 asked for by the address** (P18.8-T6 AC-4; `/new-hires`' *Schedule 1:1*): once the reader's calendar is
   * read — so the office's today is known — the new-entry dialog opens as *1:1 coaching*, *"1:1 with {full name}"*, them
   * invited, the name from the reader's own downline. Once per address.
   */
  const askedFor = useRef(false);
  useEffect(() => {
    if (!initialWith || !may.create || !raw || askedFor.current) return undefined;
    askedFor.current = true;
    let live = true;
    const slot = { date: raw.today, start: DEFAULT_START, end: DEFAULT_END };
    readDownline()
      .then((answer) => answer.people.find((p) => p.membershipId === initialWith) ?? null)
      .catch(() => null)
      .then((person) => {
        if (!live) return;
        open({
          mode: 'new', slot,
          preset: person
            ? { type: 'coaching', title: t.oneOnOneWith({ name: person.name }), invitee: { membershipId: person.membershipId, name: person.name } }
            : { type: 'coaching', title: '', invitee: null },
        });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWith, may.create, raw]);

  /** *+ New event*: the office's today when it is in view, else the first day shown (P12-T2 AC-4). */
  const newEvent = () => {
    const inView = shown?.days.find((d) => d.date === shown.today && (shown.view !== 'month' || d.inPeriod));
    const first = shown?.view === 'month' ? shown.days.find((d) => d.inPeriod) : shown?.days[0];
    const day = inView?.date ?? first?.date ?? shown?.today ?? '';
    open({ mode: 'new', slot: { date: day, start: DEFAULT_START, end: DEFAULT_END } });
  };

  const saved = (entry: CalendarEntry, before: CalendarEntry | null) => {
    setEditor(null);
    setGone(false);
    // The Agenda and 3 Hari stay where they are; Week and Month move to the period holding the entry.
    if (view === 'week' || view === 'month') setDate(entryDate(entry));
    wrote(peopleOn(entry, before));
    if (before === null) show(done.eventCreated);
  };

  const forget = (membershipId: string) => {
    for (const kind of ['week', 'month', 'agenda', 'three_days'] as const) comparedReads.current.delete(`${membershipId}:${kind}`);
    setCompared((now) => now.filter((c) => c.membershipId !== membershipId));
  };

  /** A cell of the desktop's month: Week, on that day's week (D-month). */
  const toWeek = (day: string) => changeView('week', day);
  /** A phone's month cell, or a *Tugas* badge: that day in the Agenda (UI-104 point 2). */
  const toAgenda = (day: string) => changeView('agenda', day);

  // The range, the month said once where both days are in it — *2 – 4 Nov 2026* (UI-144) — and never cut.
  const label = shown
    ? (shown.view === 'month' ? formatMonth(shown.month ?? '', language) : formatDayRange(shown.from, shown.to, language))
    : '';
  const stepWords = view === 'month'
    ? { previous: t.previousMonth, next: t.nextMonth }
    : view === 'three_days'
      ? { previous: t.previousDays, next: t.nextDays }
      : { previous: t.previousWeek, next: t.nextWeek };
  /**
   * Where Week and 3 Hari open, and go back to when the panes change: from 768px an hour before now, or 07.00 (UI-117);
   * **on a phone 07.00, always** (P19.8-T3 AC-2; MOB UI-172).
   */
  const openAt = () => (shown && !phone ? openingHour(shown.days.map((d) => d.date), shown.today, nowMinute) : undefined);

  // What a compared read asks for: the period shown, by its first day (a month's own first day).
  const comparedDate = shown ? (shown.view === 'month' ? shown.days.find((d) => d.inPeriod)?.date ?? shown.from : shown.from) : '';
  const ownHead: PaneHead | null = shown ? {
    name: shown.subject.name,
    initials: me?.user.initials ?? initialsOf(shown.subject.name),
    role: `${shortOfRung(shown.subject.rung)} · ${t.you}`,
    me: true,
  } : null;

  /*
   * **The Agenda's compared people** (UI-104 point 9): read here, so their things go among the reader's own. At most two
   * (`COMPARE_MAX`), so two fixed reads; 3 Hari, Week and Month read theirs in their own panes — 3 Hari since P19.8-T3
   * AC-5 (MOB UI-175), a person row above each person's grid, as Week does.
   */
  const merged = display === 'agenda';
  const lostPerson = (person: CalendarDownlinePerson) => {
    forget(person.membershipId);
    setLost(person.name);
    if (phone) setFiltersOpen(true);
  };
  const first = useComparedRead(merged && shown ? compared[0] : undefined, view, comparedDate, touched, comparedReads.current, lostPerson);
  const second = useComparedRead(merged && shown ? compared[1] : undefined, view, comparedDate, touched, comparedReads.current, lostPerson);
  const others: AgendaPerson[] = [first, second]
    .map((slot, i) => (compared[i] ? {
      person: taskPersonOf(compared[i], slot.read),
      read: slot.read ? filterRead(slot.read, hiddenKinds) : null,
    } : null))
    .filter((o): o is AgendaPerson => o !== null);

  /**
   * ‹ and ›: a phone's one pill of two 38px halves (the mockup's `.nav`); wider, two 44px buttons (UI-117's `[‹] [›]`).
   * The header control's 44px and 600 (MOB UI-171), the glyph 16px as the mockup's chevron.
   */
  const stepButton = (direction: 'previous' | 'next', className: string) => (
    <button
      type="button"
      aria-label={stepWords[direction]}
      disabled={!shown}
      onClick={() => shown && step(shown[direction])}
      className={className}
    >
      {/* The prototype's glyph, at the mockup's 16px chevron size; the control itself is 13px / 600. */}
      <span aria-hidden="true" className="text-lg leading-none">{direction === 'previous' ? '‹' : '›'}</span>
    </button>
  );
  const halves = cn(HEADER_CONTROL, 'inline-flex w-[38px] items-center justify-center text-ink hover:bg-hover-row disabled:opacity-40');
  const nav = phone ? (
    <div data-step-pill="" className="inline-flex h-11 shrink-0 overflow-hidden rounded-pill border border-hairline bg-card">
      {stepButton('previous', halves)}
      {stepButton('next', halves)}
    </div>
  ) : (
    <>
      {stepButton('previous', cn(TOOL, 'w-11 px-0'))}
      {stepButton('next', cn(TOOL, 'w-11 px-0'))}
    </>
  );
  // Never cut (UI-144): the range keeps its one line, and on a laptop it gives way before the controls do.
  const rangeLabel = (className: string) => (
    <span aria-live="polite" className={cn('whitespace-nowrap font-display font-bold text-navy', className)}>{label}</span>
  );
  const todayButton = <button type="button" onClick={goToday} className={cn(TOOL, TIGHT)}>{t.today}</button>;
  /** *+ Event baru*: the orange pill at the header control's size (MOB UI-171), the one action on the toolbar. */
  const newEventControl = may.create && (
    <Button ref={newEventButton} onClick={newEvent} className={cn(HEADER_CONTROL, 'h-11 shrink-0 rounded-pill px-3.5')}>{t.newEvent}</Button>
  );
  /**
   * **A phone's view picker** (P19.8-T3 AC-1; MOB UI-171, the brief's Calendar 4): a button that opens a small menu right
   * under it — never the native select, which was 16px so an iPhone would not zoom, and cut *Agenda* to *Agend▾*. It
   * takes the row's free width, so *Agenda* is whole at 360px.
   */
  const viewPicker = (
    <PickerMenu
      label={t.view}
      value={display}
      options={DISPLAYS.map((v) => ({ value: v, label: t[v] }))}
      onChange={(v) => changeView(v)}
      className={cn('min-w-0 flex-1', TIGHT)}
    />
  );
  /**
   * The switcher from 768px: *Agenda · 3 Hari · Week · Month*, the chosen one navy. Across a tablet's second row. Its
   * segments at the header control's size (MOB UI-171).
   */
  const switcher = (
    <div
      role="group"
      aria-label={t.view}
      className={cn('inline-flex h-11 shrink-0 rounded-[9px] border border-hairline bg-card p-[3px]', tablet && 'min-w-0 flex-1')}
    >
      {DISPLAYS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={display === v}
          onClick={() => changeView(v)}
          className={cn(
            'whitespace-nowrap rounded-[6px] px-3 text-base font-semibold',
            tablet && 'flex-1',
            display === v ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
          )}
        >
          {t[v]}
        </button>
      ))}
    </div>
  );
  const filterButton = (
    <button
      type="button"
      aria-expanded={filtersOpen}
      aria-controls={filtersId}
      onClick={() => setFiltersOpen((now) => !now)}
      className={cn(
        TOOL,
        TIGHT,
        // Navy while its panel is open (D-30; UI-118) — a phone's and a tablet's. A laptop's row is shown as it was drawn.
        filtersOpen && !laptop && 'border-secondary bg-secondary text-secondary-contrast hover:bg-secondary',
      )}
    >
      <LineIcon name="adjust" className="h-4 w-4 shrink-0" />
      {t.filters}
    </button>
  );
  const toggleKind = (kind: FilterKind) => setHiddenKinds((now) => {
    const next = new Set(now);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    return next;
  });
  const chips = <TypeChips hidden={hiddenKinds} onToggle={toggleKind} />;

  const compareBar = (
    <CompareBar
      myInitials={me?.user.initials ?? initialsOf(me?.user.fullName ?? '')}
      canCompare={canCompare}
      compared={compared}
      lost={lost}
      inline={!phone}
      chips={phone}
      onAdd={(person) => {
        if (compared.length >= COMPARE_MAX || compared.some((c) => c.membershipId === person.membershipId)) return;
        setLost(null);
        setCompared([...compared, person]);
        scroll.reset(openAt());
      }}
      onRemove={(membershipId) => {
        forget(membershipId);
        scroll.reset(openAt());
      }}
      onLostSeen={() => setLost(null)}
    />
  );

  const comparedPanes = shown && !merged ? compared.map((person) => (
    <ComparedPane
      key={person.membershipId}
      person={person}
      display={display}
      date={comparedDate}
      today={shown.today}
      touched={touched[person.membershipId] ?? 0}
      reads={comparedReads.current}
      hidden={hiddenKinds}
      range={label}
      nowMinute={nowMinute}
      canBlock={canBlock}
      phone={phone}
      onAgenda={toAgenda}
      onWeek={toWeek}
      onOpen={setDetail}
      onTasks={setPopupDay}
      onBlock={(slot) => open({ mode: 'block', slot, member: { membershipId: person.membershipId, name: person.name } })}
      blockNow={() => ({ date: shown.today, ...nextHalfHour(nowMinute ?? shown.now.minute) })}
      onLost={() => lostPerson(person)}
      scroll={scroll}
    />
  )) : [];
  /** The reader's own calendar alone on a phone: 3 Hari's and Week's grid runs to the foot of the screen (MOB UI-172). */
  const fill = phone && compared.length === 0;
  /**
   * Full-bleed on a phone with nothing compared (the mockup's `.gw`): the screen's whole width, its top corners rounded,
   * and down over the page's foot room to the screen's foot, behind the floating tab bar. Otherwise a tile, as Week's.
   */
  const bleed = 'max-md:-mx-4 max-md:-mb-[calc(var(--tab-bar-space)+1.5rem)] max-md:overflow-hidden max-md:rounded-t-row';
  // 3 Hari from 768px is the card it was (`md:rounded-lg`); beside somebody compared, a tile as Week's panes are.
  const threeFrame = fill ? bleed : compared.length > 0 ? TILE : 'md:overflow-hidden md:rounded-lg';
  const weekFrame = fill ? bleed : TILE;

  // The popup's people: each compared person's tasks, in Week and Month from their panes' reads too.
  const popupOthers: ComparedTasks[] = merged
    ? others.filter((o) => o.read).map((o) => ({ person: o.person, tasks: o.read!.tasks }))
    : compared.flatMap((person) => {
      const held = [...comparedReads.current.values()].find((r) => r.read.subject.membershipId === person.membershipId && r.read.view === view);
      return held ? [{ person: taskPersonOf(person, held.read), tasks: filterRead(held.read, hiddenKinds).tasks }] : [];
    });

  let body: ReactNode;
  if (error) {
    body = (
      <div className="rounded-lg border border-card-edge bg-card p-4">
        <ErrorBanner code={error.code} message={t.loadFailed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={again}>{t.tryAgain}</Button>
      </div>
    );
  } else if (!shown || !ownHead) {
    body = (
      <Skeleton label={t.loading} className={cn(TILE, 'bg-card')}>
        {display === 'week' || display === 'three_days'
          ? <WeekSkeleton columns={display === 'week' ? 7 : 3} head={compared.length > 0} />
          : display === 'month' ? <MonthSkeleton phone={phone} /> : <AgendaSkeleton />}
      </Skeleton>
    );
  } else if (display === 'month') {
    const month = (
      <MonthGrid
        read={shown}
        head={compared.length > 0 ? ownHead : undefined}
        phone={phone}
        onAgenda={toAgenda}
        onOpen={setDetail}
        onWeek={toWeek}
      />
    );
    body = compared.length === 0 ? month : <div className="flex flex-col gap-2">{month}{comparedPanes}</div>;
  } else if (display === 'agenda') {
    body = (
      <div ref={panes}>
        <AgendaPane className={TILE} read={shown} others={others} regionLabel={t.region({ range: label })} onOpen={setDetail} />
      </div>
    );
  } else if (display === 'three_days') {
    body = (
      <div ref={panes} className="flex flex-col gap-2 min-[980px]:flex-row">
        <ThreeDays
          className={threeFrame}
          read={shown}
          head={compared.length > 0 ? ownHead : undefined}
          nowMinute={nowMinute}
          phone={phone}
          fill={fill}
          regionLabel={t.region({ range: label })}
          scroll={scroll}
          onStep={(direction) => step(direction < 0 ? shown.previous : shown.next)}
          onOpen={setDetail}
          onSlot={may.create ? (slot) => open({ mode: 'new', slot }) : undefined}
          onTasks={setPopupDay}
        />
        {comparedPanes}
      </div>
    );
  } else {
    body = (
      <div ref={panes} className="flex flex-col gap-2 min-[980px]:flex-row">
        <WeekPane
          className={weekFrame}
          read={shown}
          // No person row on the reader's own calendar (P19.8-T3 AC-5; MOB UI-175): only beside somebody compared.
          head={compared.length > 0 ? ownHead : undefined}
          regionLabel={t.region({ range: label })}
          nowMinute={nowMinute}
          phone={phone}
          fill={fill}
          onOpen={setDetail}
          onSlot={may.create ? (slot) => open({ mode: 'new', slot }) : undefined}
          onTasks={setPopupDay}
          scroll={scroll}
        />
        {comparedPanes}
      </div>
    );
  }

  /*
   * **The toolbar** (P19.1-T3 AC-1 to AC-3): one per size, the same in every view, so switching views never moves it.
   * A phone's first row fits 360px on one line — the picker gives way, never the buttons — and its range is never cut.
   */
  let toolbar: ReactNode;
  if (phone) {
    toolbar = (
      <div className="mb-3 flex flex-col gap-2">
        <div data-toolbar="" className="flex flex-nowrap items-center gap-1.5">
          {todayButton}
          {nav}
          {viewPicker}
          {filterButton}
        </div>
        <div className="flex min-h-11 items-center justify-between gap-2">
          {rangeLabel('text-lg')}
          {newEventControl}
        </div>
      </div>
    );
  } else if (tablet) {
    toolbar = (
      <div className="mb-3 flex flex-col gap-2">
        <div data-toolbar="" className="flex flex-nowrap items-center gap-2">
          {todayButton}
          {nav}
          {rangeLabel('min-w-0 text-lg')}
          <span className="ml-auto" />
          {filterButton}
        </div>
        <div className="flex flex-nowrap items-center gap-2">
          {switcher}
          {newEventControl}
        </div>
      </div>
    );
  } else {
    toolbar = (
      <div data-toolbar="" className="mb-3 flex flex-nowrap items-center gap-2">
        {todayButton}
        {nav}
        {rangeLabel('min-w-0 truncate text-lg')}
        <span className="ml-auto" />
        {switcher}
        {filterButton}
        {newEventControl}
      </div>
    );
  }

  return (
    <CalendarTasksContext.Provider value={ticks.value}>
      <div>
        {toolbar}

        {laptop ? (
          // *Melihat* and the type chips on one row under the toolbar (UI-118), which *Filter* hides and shows.
          <div id={filtersId} hidden={!filtersOpen} data-filter-row="" className="mb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {compareBar}
              <span aria-hidden="true" className="h-6 w-px bg-line" />
              {chips}
            </div>
          </div>
        ) : tablet ? (
          // In place, not a dialog: what it holds is the page's own, and it stays put while the reader works.
          <div id={filtersId} hidden={!filtersOpen} className="mb-3 rounded-lg bg-card p-3.5">
            {compareBar}
            <p className="mb-1.5 mt-3 text-xs font-bold text-muted">{t.type}</p>
            {chips}
          </div>
        ) : (
          // A phone's panel holds *Melihat* alone (P19.8-T3 AC-6; the brief's Calendar 3): *Kalender saya* · *Bandingkan
          // dengan downline*, no *Jenis* — a white card under the toolbar, as the mockup's `.fp`.
          <div id={filtersId} hidden={!filtersOpen} data-filter-panel="" className="mb-3 rounded-row bg-card p-3">
            {compareBar}
          </div>
        )}

        {gone && <p role="status" className="mb-3 text-md font-semibold text-navy">{t.gone}</p>}
        {entryError && <div className="mb-3"><ErrorBanner {...entryError} /></div>}
        {ticks.error && (
          <div className="mb-3"><ErrorBanner code={ticks.error.code} message={t.taskFailed} requestId={ticks.error.requestId} /></div>
        )}

        {body}

        {popupDay && shown && (
          <TaskPopup
            day={popupDay}
            tasks={shown.tasks.filter((task): task is CalendarTask => !isHiddenTask(task) && task.date === popupDay)}
            others={popupOthers}
            onClose={() => setPopupDay(null)}
          />
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
            onAnswered={(answered) => {
              setDetail(null);
              show(answered.myAnswer === 'declined' ? t.answeredDeclined : t.answeredAccepted);
              announceInboxChanged();
              again();
            }}
          />
        )}

        {editor && (
          <EntryDialog
            key={editor.key}
            state={editor.state}
            onClose={() => setEditor(null)}
            onSaved={saved}
            canDelete={may.delete}
            onDeleted={(entry) => {
              // As the detail popup's *Hapus* (`onDeleted` above): the dialog closes, and every calendar it was on reads again.
              setEditor(null);
              refocus.current = true;
              wrote(peopleOn(entry));
            }}
          />
        )}
        {sheetLead && (
          <LeadSheet
            open
            lead={sheetLead}
            offerDelete={false}
            // A read-only support session reads the lead and writes nothing: no *Simpan*, no field to type in (N1).
            readOnly={readOnly}
            // *Hapus tugas* (the staging review of 2026-10-31): the reader's own lead's next action, cleared — never in a
            // read-only support session, never on a compared person's lead (the sheet checks whose it is).
            offerClearTask={!readOnly}
            onClose={() => setSheetLead(null)}
            onSaved={() => again()}
            onClosedLead={() => { setSheetLead(null); again(); }}
          />
        )}
        <Toast toast={toast} />
      </div>
    </CalendarTasksContext.Provider>
  );
}

/** A compared person as a task group names them: their name, initials, and the number their read carries. */
function taskPersonOf(person: CalendarDownlinePerson, read: CalendarRead | null): TaskPerson {
  return { membershipId: person.membershipId, name: person.name, initials: initialsOf(person.name), phone: read?.subject.phone ?? null };
}

/**
 * **Ticking a task, at its source** (UI V1, UI-104 point 4): a lead's next action (`PUT /leads/:id/next-action/done`,
 * pinned to the version the task carried) or a coaching action item (`PUT /coaching/sessions/…/done`). Ticked, the row
 * is struck through and every count drops at once; the toast says *Selesai* and offers *Urungkan*, which — or the
 * checkbox again — takes the tick back and reads the calendar again. One write per task at a time; a refusal is said
 * above the calendar and the row is left as it was.
 */
function useTaskTicks({
  canTick, canTickCoaching, show, onChanged, onLead,
}: {
  canTick: boolean;
  canTickCoaching: boolean;
  show: ReturnType<typeof useToast>['show'];
  onChanged: () => void;
  onLead: (lead: Lead) => void;
}): { value: CalendarTasks; error: ApiError | null } {
  const t = useMessages(calendarMessages);
  const [struck, setStruck] = useState<ReadonlyMap<string, number | undefined>>(new Map());
  const [error, setError] = useState<ApiError | null>(null);
  const busy = useRef(new Set<string>());

  const value = useMemo<CalendarTasks>(() => {
    const write = async (task: CalendarTask, done: boolean, version?: number): Promise<number | undefined> => {
      if (task.source === 'lead' && task.lead) {
        return (await setLeadActionDone(task.lead.leadId, done, version ?? task.lead.version)).version;
      }
      if (task.coaching) await setCoachingItemDone(task.coaching.sessionId, task.coaching.itemId, done);
      return undefined;
    };
    const undo = async (task: CalendarTask, version: number | undefined) => {
      await write(task, false, version);
      setStruck((now) => {
        const next = new Map(now);
        next.delete(task.taskId);
        return next;
      });
      onChanged();
    };
    const toggle = (task: CalendarTask) => {
      if (!canTick || (task.source === 'coaching' && !canTickCoaching) || busy.current.has(task.taskId)) return;
      busy.current.add(task.taskId);
      setError(null);
      const ticked = struck.has(task.taskId);
      const run = ticked
        ? undo(task, struck.get(task.taskId))
        : write(task, true).then((version) => {
          setStruck((now) => new Map(now).set(task.taskId, version));
          show(t.done, {
            action: {
              label: t.undo,
              onAction: () => { undo(task, version).catch((err) => setError(toDisplayError(err))); },
            },
          });
        });
      run
        .catch((err) => setError(toDisplayError(err)))
        .finally(() => { busy.current.delete(task.taskId); });
    };
    return {
      struck: new Set(struck.keys()),
      toggle,
      openLead: (task) => {
        if (!task.lead) return;
        readLead(task.lead.leadId).then(onLead).catch((err) => setError(toDisplayError(err)));
      },
      canTick,
      canTickCoaching,
      onPhoneSaved: onChanged,
    };
  }, [canTick, canTickCoaching, struck, show, onChanged, onLead, t]);

  return { value, error };
}

/**
 * **One compared person's read** (D-audit): read once for each period, and again only after a write that touched
 * them (`touched`). The page keeps the last answer per person and kind of period (`reads`), so drawing the same
 * period again asks for nothing, and an identical read already out is joined rather than sent twice. A read the
 * server now refuses — they left, or the edge closed — takes them out of the bar (D-leave). `person` absent: nothing.
 */
function useComparedRead(
  person: CalendarDownlinePerson | undefined,
  view: CalendarView,
  date: string,
  touchedBy: Readonly<Record<string, number>>,
  reads: Map<string, ComparedRead>,
  onLost: (person: CalendarDownlinePerson) => void,
): { read: CalendarRead | null; error: ApiError | null; retry: () => void } {
  const id = person?.membershipId;
  const slot = id ? `${id}:${view}` : '';
  const key = `${date}:${id ? touchedBy[id] ?? 0 : 0}`;
  const kept = slot ? reads.get(slot) : undefined;
  const [read, setRead] = useState<CalendarRead | null>(kept?.key === key ? kept.read : null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lostRef = useRef(onLost);
  lostRef.current = onLost;
  const personRef = useRef(person);
  personRef.current = person;

  useEffect(() => {
    if (!id || !date) {
      setRead(null);
      return undefined;
    }
    const held = reads.get(slot);
    if (held?.key === key) {
      setRead(held.read);
      return undefined;
    }
    let live = true;
    setError(null);
    setRead(null);
    joinInFlight(`calendar:${slot}:${key}:${attempt}`, () => readCalendar({ view, date, forId: id }))
      .then((answer) => {
        reads.set(slot, { key, read: answer });
        if (live) setRead(answer);
      })
      .catch((err) => {
        if (!live) return;
        const refused = toDisplayError(err);
        if (refused.code === 'NOT_FOUND' && personRef.current) lostRef.current(personRef.current);
        else setError(refused);
      });
    return () => { live = false; };
  }, [reads, slot, view, id, date, key, attempt]);

  return { read: read && read.view === view ? read : null, error, retry: () => setAttempt((a) => a + 1) };
}

/** A compared pane's last answer, kept by the page, and what it was the answer to. */
interface ComparedRead {
  key: string;
  read: CalendarRead;
}

/**
 * A member compared beside the reader in **Week or Month** (`:967-999`; P12-T5 AC-3 to AC-6): their week or month,
 * read through `?for=` (`useComparedRead`), which the server audits once per read (D-audit). Their own entries come
 * in full (ADR-0093); one they only attend comes as a busy block; **their *Tugas* in the count row and the badges**
 * (UI-104 point 9), which open the popup with their rows and no checkbox — a person who hides their details shows
 * the counts alone. **Today is the reader's read's**. A slot on the pane, or the *"Drag to block"* pill as a button
 * (D-block-key), opens *Block time*. A read the server now refuses takes them out of the bar (D-leave).
 */
function ComparedPane({
  person,
  display,
  date,
  today,
  touched,
  reads,
  hidden,
  range,
  nowMinute,
  canBlock,
  phone,
  onAgenda,
  onWeek,
  onOpen,
  onTasks,
  onBlock,
  blockNow,
  onLost,
  scroll,
}: {
  person: CalendarDownlinePerson;
  display: CalendarDisplay;
  /** The first day of the period shown. */
  date: string;
  today: string;
  touched: number;
  reads: Map<string, ComparedRead>;
  /** The types the reader unticked (UI-104 point 9): hidden here too. */
  hidden: ReadonlySet<FilterKind>;
  range: string;
  nowMinute: number | null;
  canBlock: boolean;
  phone: boolean;
  onAgenda: (date: string) => void;
  onWeek: (date: string) => void;
  onOpen: (entry: CalendarEntry) => void;
  onTasks: (day: string) => void;
  onBlock: (slot: Slot) => void;
  blockNow: () => Slot;
  onLost: () => void;
  scroll: ScrollGroup;
}) {
  const t = useMessages(calendarMessages);
  const view = viewOf(display);
  const { read, error, retry } = useComparedRead(person, view, date, { [person.membershipId]: touched }, reads, onLost);

  if (error) {
    return (
      <div className={cn(TILE, 'min-w-0 flex-1 bg-card p-4')}>
        <ErrorBanner code={error.code} message={t.loadFailed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={retry}>{t.tryAgain}</Button>
      </div>
    );
  }
  if (!read) {
    return (
      <Skeleton label={t.loading} className={cn(TILE, 'min-w-0 flex-1 bg-card')}>
        {display === 'month' ? <MonthSkeleton phone={phone} /> : <WeekSkeleton columns={display === 'three_days' ? 3 : 7} />}
      </Skeleton>
    );
  }
  const drawn = filterRead(read.today === today ? read : { ...read, today }, hidden);
  const head: PaneHead = { name: person.name, initials: initialsOf(person.name), role: shortOfRung(person.rung), me: false };
  // Named by the words drawn on it, then what it opens (WCAG 2.5.3 Label in Name, M2).
  const pill = canBlock ? (
    <button
      type="button"
      onClick={() => onBlock(blockNow())}
      className="ml-auto shrink-0 rounded-pill bg-success/10 px-[9px] py-[3px] text-xs font-bold text-success hover:bg-success/15"
    >
      {t.dragToBlock}
      <span className="sr-only">{t.blockPillSuffix({ name: person.name })}</span>
    </button>
  ) : undefined;

  if (display === 'month') {
    return <MonthGrid read={drawn} head={head} pill={pill} phone={phone} onAgenda={onAgenda} onOpen={onOpen} onWeek={onWeek} />;
  }
  return (
    <WeekPane
      className={TILE}
      read={drawn}
      head={head}
      pill={pill}
      regionLabel={t.comparedRegion({ name: person.name, range })}
      hoursWhenStacked
      nowMinute={read.days.some((d) => d.date === today) ? nowMinute : null}
      onOpen={onOpen}
      onSlot={canBlock ? onBlock : undefined}
      onTasks={onTasks}
      scroll={scroll}
      // A phone's compared grid opens at 07.00 with the reader's own (MOB UI-172); never filling: the page holds them all.
      phone={phone}
    />
  );
}

/**
 * Every pane's scroll box, moved as one (`syncScroll`, `:1001-1005`), and all of them back to where the grid opens —
 * an hour before now, or 07.00 on another week (P19.1-T3 AC-4, `openingHour`) — when the set of panes changes or
 * *Today* is pressed (`resetScrollPositions`, `:1091-1093`).
 */
function useScrollGroup(): ScrollGroup & { reset: (hour?: number) => void } {
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
    reset: (hour = OPEN_AT_HOUR) => {
      for (const el of boxes.current) el.scrollTop = hour * HOUR_PX;
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
