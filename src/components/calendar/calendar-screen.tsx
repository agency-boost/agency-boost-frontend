'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ErrorBanner, Select } from '@/components/ui/field';
import { shortOfRung } from '@/components/ui/role-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  COMPARE_MAX, entryDate, initialsOf, OWN_COPY, peopleOn, PROTOTYPE_COPY, readCalendar, readEntry, viewOf,
  type CalendarDisplay, type CalendarDownlinePerson, type CalendarEntry, type CalendarNow, type CalendarRead,
  type CalendarView,
} from '@/lib/calendar';
import { CONFIRMED } from '@/lib/confirmations';
import { HOUR_PX, nextHalfHour, OPEN_AT_HOUR } from '@/lib/calendar-layout';
import { DEFAULT_END, DEFAULT_START, type Slot } from '@/lib/calendar-form';
import { formatMonth, formatWeekRange } from '@/lib/format';
import { joinInFlight } from '@/lib/in-flight';
import { announceInboxChanged } from '@/lib/notifications';
import { useCan, useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import { cn } from '@/lib/cn';
import { AgendaPane, AgendaSkeleton } from './agenda';
import { TypeLegend, type PaneHead } from './calendar-parts';
import { CompareBar } from './compare-bar';
import { DetailDialog } from './detail-dialog';
import { EntryDialog, type EditorState } from './entry-dialog';
import { HideDetailsSwitch, useHideDetails } from './hide-details-switch';
import { MonthGrid, MonthSkeleton } from './month-grid';
import { WeekPane, WeekSkeleton, type ScrollGroup } from './week-pane';

/** A pane's frame: a tile of its own, side by side with the others or stacked below 980px (`:96-101`, `:232-234`). */
const TILE = 'overflow-hidden rounded-lg border border-hairline';

/** The phone's three views, in the switch's order: the agenda it opens on, then the prototype's two. */
const PHONE_VIEWS: readonly CalendarDisplay[] = ['agenda', 'week', 'month'];
const VIEW_NAME: Record<CalendarDisplay, string> = {
  agenda: OWN_COPY.agenda,
  week: PROTOTYPE_COPY.week,
  month: PROTOTYPE_COPY.month,
};

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
 * a save is saved, and the grid moves to the week holding the entry and draws it. **A new entry also says
 * *Event created ✓*** (P18.95-T1 AC-6, ADR-0167 §5; UI-008) — *+ New event*, a slot taken on the grid and
 * *Block time* alike; an edit says nothing more than the entry it redraws, as before.
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
 * ***Hide my personal activities*** (ADR-0110; P13.1-T8) is a switch in the toolbar's right-hand group,
 * before *Week* and *Month*: the reader's own setting, switched at once and put back if the save is
 * refused (`useHideDetails`). Drawn for a reader who may save it — never in a read-only support session.
 *
 * **A compared pane is read when what it shows changes, and at no other time** (D-audit): every read
 * of somebody else's calendar writes an audit entry on the server. Its period changes (‹, ›, *Today*,
 * a save that moves the grid, Week to Month), its person changes, or a write of the reader's touches
 * that person's calendar — a block placed on them, an entry inviting them, an edit or a delete of one.
 * The reader's own reloads — a save of their own, an answer, midnight — read the reader's calendar alone.
 *
 * **Compare in every view** (P18.95-T8 AC-2; the client's UI review, UI-020; ADR-0167): the bar, its
 * popover and the people chosen are the same in Week, in Month and in a phone's Agenda. In Month each
 * person's month is a pane of its own, stacked under the reader's, read once per month by `for` — the
 * read the server opened to a month for it — and audited as a week's is.
 *
 * **On a phone** (below 768px; P18.95-T8 AC-1): the page opens on the ***Agenda***, the week's read drawn
 * as a list by day, unless the address asks for `view=week` or `view=month`. **The controls sit in one
 * row** — *Today*, ‹ and ›, the view (*Agenda*, *Week*, *Month*) and ***Filters*** — with the range and
 * *+ New event* on the line under it, where the toolbar wrapped into some 470px of controls before the
 * grid. *Filters* opens, in place, what the row has no room for: the compare bar, the legend and *Hide
 * my personal activities*. In Month a tap on a day lists that day under the grid. **At 768px and wider
 * nothing of this is drawn**: the page opens on Week, with the toolbar it always had.
 */
export function CalendarScreen({
  initialView,
  initialDate,
  initialEntry,
}: {
  /** The address's `view`, when it names one; without it, Week — and on a phone, the Agenda. */
  initialView?: CalendarView;
  initialDate?: string;
  initialEntry?: string;
}) {
  const { me } = useSession();
  const phone = usePhone();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const may = {
    create: useCan('calendar_entry:create') && !readOnly,
    edit: useCan('calendar_entry:update') && !readOnly,
    delete: useCan('calendar_entry:delete') && !readOnly,
    answer: useCan('calendar_entry:answer') && !readOnly,
  };
  const canBlock = useCan('calendar_entry:block') && !readOnly;
  // The setting is saved under the edit grant (`PUT /calendar/settings`), so it is drawn where that is held.
  const hiding = useHideDetails(may.edit);
  // A leader is anybody with a direct report (ADR-0087), on a rung whose role reaches a downline: an
  // Agent coaches nobody, so compares nobody. The server decides who is listed; this decides the button.
  const membership = me?.membership;
  const canCompare = (membership?.directCount ?? 0) > 0 && membership?.hierarchyRole !== 'agent';

  // What the reader chose, or the address named; `null` until then, which is Week — or a phone's Agenda.
  // A notice's entry opens on its week, so it names no view. The Agenda is a phone's alone: wider, it is
  // drawn as the Week, whose read it shares, so turning a phone on its side asks for nothing.
  const [chosen, setChosen] = useState<CalendarDisplay | null>(initialEntry ? null : initialView ?? null);
  const display: CalendarDisplay = chosen === 'agenda' || chosen === null ? (phone ? 'agenda' : 'week') : chosen;
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
  // A phone's *Filters*, and the day a phone's month lists under its grid (`undefined`: today, or the 1st).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const [picked, setPicked] = useState<string | undefined>(undefined);

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

  const changeView = (to: CalendarDisplay) => {
    if (to === display) return;
    // The Agenda and the Week share a read: moving between them asks for nothing.
    if (viewOf(to) !== view) setRead(null);
    setChosen(to);
  };

  const step = (to: string) => {
    setGone(false);
    setDate(to);
  };

  const goToday = () => {
    setGone(false);
    setPicked(undefined);
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
    // A create has no entry before it (P18.95-T1 AC-6); a refusal never reaches here, and stays in the dialog.
    if (before === null) show(CONFIRMED.eventCreated);
  };

  const forget = (membershipId: string) => {
    for (const kind of ['week', 'month'] as const) comparedReads.current.delete(`${membershipId}:${kind}`);
    setCompared((now) => now.filter((c) => c.membershipId !== membershipId));
  };

  /** A cell of the desktop's month: Week, on that day's week (D-month). */
  const toWeek = (day: string) => {
    setRead(null);
    setChosen('week');
    setDate(day);
  };

  const week = view === 'week';
  const label = shown ? (shown.view === 'month' ? formatMonth(shown.month ?? '') : formatWeekRange(shown.from, shown.to)) : '';
  const previousLabel = week ? OWN_COPY.previousWeek : OWN_COPY.previousMonth;
  const nextLabel = week ? OWN_COPY.nextWeek : OWN_COPY.nextMonth;

  // The day a phone's month lists: the one tapped, while it is in this month's read; else today, if
  // this month holds it; else the 1st.
  const monthDay = shown?.view === 'month'
    ? (picked && shown.days.some((d) => d.date === picked) ? picked
      : shown.days.find((d) => d.date === shown.today && d.inPeriod)?.date ?? shown.days.find((d) => d.inPeriod)?.date)
    : undefined;
  // What a compared pane asks for: the week shown, or a day of the month shown.
  const comparedDate = shown ? (shown.view === 'month' ? shown.days.find((d) => d.inPeriod)?.date ?? shown.from : shown.from) : '';
  const ownHead: PaneHead | null = shown ? {
    name: shown.subject.name,
    initials: me?.user.initials ?? initialsOf(shown.subject.name),
    // The rung by its badge's name, *AB · You* (P18.95-T9 AC-1; T8 left the ladder's whole label here).
    role: `${shortOfRung(shown.subject.rung)} · ${PROTOTYPE_COPY.you}`,
    me: true,
  } : null;

  const nav = (size: string) => (
    <div className="inline-flex overflow-hidden rounded-md border border-hairline bg-card">
      <button
        type="button"
        aria-label={previousLabel}
        disabled={!shown}
        onClick={() => shown && step(shown.previous)}
        className={cn(size, 'text-md text-navy hover:bg-base')}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        disabled={!shown}
        onClick={() => shown && step(shown.next)}
        className={cn(size, 'text-md text-navy hover:bg-base')}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
  const rangeLabel = (className: string) => (
    <span aria-live="polite" className={cn('font-display font-bold text-navy', className)}>{label}</span>
  );
  const newEventControl = may.create && (
    <Button ref={newEventButton} onClick={newEvent} className={phone ? 'shrink-0' : undefined}>{PROTOTYPE_COPY.newEvent}</Button>
  );
  const hideSwitch = hiding.on !== null && <HideDetailsSwitch on={hiding.on} onChange={hiding.change} status={hiding.status} />;

  const compareBar = (
    <CompareBar
      myInitials={me?.user.initials ?? initialsOf(me?.user.fullName ?? '')}
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
  );

  const comparedPanes = shown ? compared.map((person) => (
    <ComparedPane
      key={person.membershipId}
      person={person}
      display={display}
      date={comparedDate}
      today={shown.today}
      touched={touched[person.membershipId] ?? 0}
      reads={comparedReads.current}
      range={label}
      nowMinute={nowMinute}
      canBlock={canBlock}
      phone={phone}
      monthDay={monthDay}
      onPick={setPicked}
      onWeek={toWeek}
      onOpen={setDetail}
      onBlock={(slot) => open({ mode: 'block', slot, member: { membershipId: person.membershipId, name: person.name } })}
      blockNow={() => ({ date: shown.today, ...nextHalfHour(nowMinute ?? shown.now.minute) })}
      onLost={() => {
        forget(person.membershipId);
        setLost(person.name);
        // On a phone the bar is inside *Filters*: it opens, so the line saying why is seen.
        if (phone) setFiltersOpen(true);
      }}
      scroll={scroll}
    />
  )) : [];

  let body: ReactNode;
  if (error) {
    body = (
      <div className="rounded-lg border border-hairline bg-card p-4">
        <ErrorBanner code={error.code} message={OWN_COPY.loadFailed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={again}>{OWN_COPY.tryAgain}</Button>
      </div>
    );
  } else if (!shown || !ownHead) {
    body = (
      <Skeleton label={OWN_COPY.loading} className={cn(TILE, 'bg-card')}>
        {display === 'week' ? <WeekSkeleton /> : display === 'month' ? <MonthSkeleton phone={phone} /> : <AgendaSkeleton />}
      </Skeleton>
    );
  } else if (display === 'month') {
    const month = (
      <MonthGrid
        read={shown}
        head={compared.length > 0 ? ownHead : undefined}
        phone={phone}
        selected={monthDay}
        onSelect={setPicked}
        onOpen={setDetail}
        onWeek={toWeek}
      />
    );
    body = compared.length === 0 ? month : <div className="flex flex-col gap-2">{month}{comparedPanes}</div>;
  } else if (display === 'agenda') {
    body = (
      <div ref={panes} className="flex flex-col gap-2">
        <AgendaPane
          className={TILE}
          read={shown}
          head={compared.length > 0 ? ownHead : undefined}
          regionLabel={OWN_COPY.region(label)}
          onOpen={setDetail}
        />
        {comparedPanes}
      </div>
    );
  } else {
    body = (
      <div ref={panes} className="flex flex-col gap-2 min-[980px]:flex-row">
        <WeekPane
          className={TILE}
          read={shown}
          head={ownHead}
          regionLabel={OWN_COPY.region(label)}
          nowMinute={nowMinute}
          onOpen={setDetail}
          onSlot={may.create ? (slot) => open({ mode: 'new', slot }) : undefined}
          scroll={scroll}
        />
        {comparedPanes}
      </div>
    );
  }

  return (
    <div>
      {phone ? (
        <div className="mb-3 flex flex-col gap-2">
          {/* One row at 320px, the content of a 360px phone inside the shell's 20px gutters: each control
              44px tall and as narrow as its words allow. It wraps, rather than clips, on anything narrower. */}
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="secondary" className="h-11 px-2" onClick={goToday}>{PROTOTYPE_COPY.today}</Button>
            {nav('h-11 w-11')}
            <Select
              aria-label={OWN_COPY.view}
              value={display}
              onChange={(e) => changeView(e.target.value as CalendarDisplay)}
              className="h-11 px-2 font-semibold"
            >
              {PHONE_VIEWS.map((v) => <option key={v} value={v}>{VIEW_NAME[v]}</option>)}
            </Select>
            <Button
              variant="secondary"
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              onClick={() => setFiltersOpen((now) => !now)}
              className={cn('ml-auto h-11 px-2', filtersOpen && 'border-navy')}
            >
              {OWN_COPY.filters}
            </Button>
          </div>
          <div className="flex items-center justify-between gap-2">
            {rangeLabel('min-w-0 truncate text-lg')}
            {newEventControl}
          </div>
        </div>
      ) : (
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" className="h-[34px] px-3.5" onClick={goToday}>{PROTOTYPE_COPY.today}</Button>
            {nav('h-[34px] w-8')}
            {rangeLabel('whitespace-nowrap text-xl')}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {hideSwitch}
            <div role="group" aria-label={OWN_COPY.view} className="inline-flex rounded-[9px] border border-hairline bg-card p-[3px]">
              {(['week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={display === v}
                  onClick={() => changeView(v)}
                  className={cn(
                    'rounded-[6px] px-4 py-[7px] text-base font-semibold',
                    display === v ? 'bg-navy text-white' : 'text-muted hover:text-navy',
                  )}
                >
                  {VIEW_NAME[v]}
                </button>
              ))}
            </div>
            {newEventControl}
          </div>
        </div>
      )}

      {phone ? (
        // In place, not a dialog: what it holds is the page's own, and it stays put while the reader works.
        <div id={filtersId} hidden={!filtersOpen}>
          {compareBar}
          <TypeLegend />
          {hideSwitch && <div className="mb-4">{hideSwitch}</div>}
        </div>
      ) : (
        <>
          {compareBar}
          <TypeLegend />
        </>
      )}

      {gone && <p role="status" className="mb-3 text-md font-semibold text-navy">{OWN_COPY.gone}</p>}
      {entryError && <div className="mb-3"><ErrorBanner {...entryError} /></div>}
      {hiding.error && (
        <div className="mb-3">
          <ErrorBanner code={hiding.error.code} message={OWN_COPY.hideDetailsFailed} requestId={hiding.error.requestId} />
        </div>
      )}

      {body}

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
 * A member compared beside the reader (`:967-999`; P12-T5 AC-3 to AC-6): their week — or, since
 * P18.95-T8 AC-2, their month, or a phone's agenda of their week — read through `?for=`, which the
 * server audits once per read (D-audit).
 *
 * **Read once for each period, and again only after a write that touched them** (`touched`). The
 * reader's own reloads do not reach it. Its last answer for each kind of period is kept by the page
 * (`reads`, keyed by the person and `week` or `month`), so a pane drawn again for the same period and
 * the same writes — back from Month, the Agenda and the Week on a phone, or after the reader's own grid
 * failed and was tried again — shows that answer rather than asking again; an identical read already
 * out is joined rather than sent twice, so a re-render writes no second audit entry either. Taking the
 * person out of the bar forgets the answers: compared again, they are read afresh.
 *
 * Their own entries come in full (ADR-0093); one they only attend comes as a busy block. **Today is
 * the reader's read's** (`today`): one office, one today, and the pane is not read again at midnight to
 * learn it. A slot on the pane, or the *"Drag to block"* pill as a button (D-block-key), opens *Block
 * time*; the pill heads the pane in every view. A read the server now refuses — they left, or the edge
 * closed — takes them out of the bar (D-leave).
 */
function ComparedPane({
  person,
  display,
  date,
  today,
  touched,
  reads,
  range,
  nowMinute,
  canBlock,
  phone,
  monthDay,
  onPick,
  onWeek,
  onOpen,
  onBlock,
  blockNow,
  onLost,
  scroll,
}: {
  person: CalendarDownlinePerson;
  display: CalendarDisplay;
  /** The Monday of the week shown, or a day of the month shown. */
  date: string;
  today: string;
  touched: number;
  reads: Map<string, ComparedRead>;
  range: string;
  nowMinute: number | null;
  canBlock: boolean;
  phone: boolean;
  /** The day a phone's month lists under each grid. */
  monthDay: string | undefined;
  onPick: (date: string) => void;
  onWeek: (date: string) => void;
  onOpen: (entry: CalendarEntry) => void;
  onBlock: (slot: Slot) => void;
  blockNow: () => Slot;
  onLost: () => void;
  scroll: ScrollGroup;
}) {
  const view = viewOf(display);
  const slot = `${person.membershipId}:${view}`;
  const key = `${date}:${touched}`;
  const kept = reads.get(slot);
  const [read, setRead] = useState<CalendarRead | null>(kept?.key === key ? kept.read : null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lostRef = useRef(onLost);
  lostRef.current = onLost;

  useEffect(() => {
    const held = reads.get(slot);
    if (held?.key === key) {
      setRead(held.read);
      return undefined;
    }
    let live = true;
    setError(null);
    joinInFlight(`calendar:${slot}:${key}:${attempt}`, () =>
      readCalendar({ view, date, forId: person.membershipId }))
      .then((answer) => {
        reads.set(slot, { key, read: answer });
        if (live) setRead(answer);
      })
      .catch((err) => {
        if (!live) return;
        const refused = toDisplayError(err);
        if (refused.code === 'NOT_FOUND') lostRef.current();
        else setError(refused);
      });
    return () => { live = false; };
  }, [reads, slot, view, person.membershipId, date, key, attempt]);

  if (error) {
    return (
      <div className={cn(TILE, 'min-w-0 flex-1 bg-card p-4')}>
        <ErrorBanner code={error.code} message={OWN_COPY.loadFailed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={() => setAttempt((a) => a + 1)}>{OWN_COPY.tryAgain}</Button>
      </div>
    );
  }
  // A read of the other kind of period is not drawn as this one: until this one's arrives, the skeleton.
  if (!read || read.view !== view) {
    return (
      <Skeleton label={OWN_COPY.loading} className={cn(TILE, 'min-w-0 flex-1 bg-card')}>
        {display === 'week' ? <WeekSkeleton /> : display === 'month' ? <MonthSkeleton phone={phone} /> : <AgendaSkeleton />}
      </Skeleton>
    );
  }
  const drawn = read.today === today ? read : { ...read, today };
  const head: PaneHead = { name: person.name, initials: initialsOf(person.name), role: shortOfRung(person.rung), me: false };
  // Named by the words drawn on it, then what it opens (WCAG 2.5.3 Label in Name, M2).
  const pill = canBlock ? (
    <button
      type="button"
      onClick={() => onBlock(blockNow())}
      className="ml-auto shrink-0 rounded-pill bg-success/10 px-[9px] py-[3px] text-xs font-bold text-success hover:bg-success/15"
    >
      {PROTOTYPE_COPY.dragToBlock}
      <span className="sr-only">{OWN_COPY.blockPillSuffix(person.name)}</span>
    </button>
  ) : undefined;

  if (display === 'month') {
    return (
      <MonthGrid read={drawn} head={head} pill={pill} phone={phone} selected={monthDay} onSelect={onPick} onOpen={onOpen} onWeek={onWeek} />
    );
  }
  if (display === 'agenda') {
    return (
      <AgendaPane className={TILE} read={drawn} head={head} pill={pill} regionLabel={OWN_COPY.comparedRegion(person.name, range)} onOpen={onOpen} />
    );
  }
  return (
    <WeekPane
      className={TILE}
      read={drawn}
      head={head}
      pill={pill}
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
