'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivationSkeleton, AspectCard, AttributionMark, AutoBadge, AutoSaveDateField, ByHandBadge, ITEM_CHECKBOX, ITEM_ROW, ProgressHeading,
  ProgressSummary, RowError, useWriteQueue,
} from '@/components/activation-parts';
import { DataItemRow } from '@/components/activation-data-item';
import { PageHeader } from '@/components/app-shell';
import { Dialog } from '@/components/ui/dialog';
import { Button, Card, ErrorBanner, Select, Textarea } from '@/components/ui/field';
import { TAP_HEIGHT, TEXT_TAP } from '@/components/ui/phone';
import { SkeletonCards } from '@/components/ui/skeleton';
import { InlineSaveStatus, useInlineSave, type InlineSaveStatusProps } from '@/components/ui/inline-save-status';
import { Toast, useToast } from '@/components/ui/toast';
import { messagesIn, type MessagesOf } from '@/i18n/catalogue';
import type { Language } from '@/i18n/language';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { activationMessages } from '@/i18n/messages/activation';
import { newHiresMessages } from '@/i18n/messages/new-hires';
import {
  ACTIVATION_NOTE_MAX, attributionOf, correctionOf, correctStartDate, earliestStart, groupTitle, isDataBacked, isManual,
  isTickedByHandLink, markHireLeft, newHireHref, readHireClosings, readNewHire, readNewHires,
  saveActivationNote, saveHireItem, startDateAllowed, startDateRangeText, type Activation3MFigures, type Activation3MShare,
  type ActivationItemProgress, type ActivationRecordInput, type ActivationView, type NewHireRow, type NewHiresRoster,
  type NewHiresSections,
} from '@/lib/activation';
import { oneOnOneHref } from '@/lib/calendar';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatMonth, formatOfficeDay, formatPercent, formatShortDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { useCan, useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';

/*
 * ── The roster ───────────────────────────────────────────────────────────────────────────────────
 */

type SectionKey = keyof NewHiresSections;
/** The three sections, in order; each one's title is the catalogue's (`sections`). */
const SECTIONS: readonly SectionKey[] = ['inProgress', 'activated', 'notActivated'];

/** The roster's and the detail's words (`i18n/messages/new-hires.ts`; P18.98-T4). */
type HiresWords = MessagesOf<typeof newHiresMessages.en>;

/**
 * **New Hires** (`/new-hires`; P13-T5, rebuilt by P18.96-T6 — ADR-0173; the client's report of 2026-10-27, R4, R5,
 * UI-005): **a year of new hires by their 3M result.** At the top, the **3M activation %** of everybody listed with a
 * **Join month** filter, and beside it each unit's — *Direct Unit* and each AAB's below the reader, D-group's grouping
 * kept (parity I-471). Then the three sections, *In progress (day 1–90)* · *Activated* · *Not activated* — the ones who
 * left among them, *Left {date}* (I-472). Every figure is the server's: the filter picks a month's served share and
 * narrows the rows by their join date, and computes nothing (invariant §7).
 *
 * **A row**: the name — a link to the hire's detail, but for one who left, whose detail is no longer the reader's — and
 * under it their unit when the reader has more than one; the join date; the day of the 90 (*In progress*); the
 * checklist's bar and percentage, red and bold when overdue, *No checklist* for a new hire with none (an AB or an AAB);
 * the first sale or *—*; the result. **An overdue or not-activated row offers *Schedule 1:1* and *Mark left*** (AC-4,
 * I-473): the calendar's new-entry dialog as a 1:1 with them, and a confirmation that records their leaving. **Below
 * 768px a card per hire**, the same fields in words (P18.95-T3 AC-4, ADR-0167 §6).
 *
 * **Its words are the catalogue's** (`i18n/messages/new-hires.ts`; P18.98-T4), a unit's name in the reader's language
 * (`groupTitle`), and every date, month and percentage in the figures' (`useFigureLanguage()`).
 */
export function NewHires() {
  const t = useMessages(newHiresMessages);
  const { me } = useSession();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const mayMarkLeft = useCan('new_hire:mark_left') && !readOnly;
  const maySchedule = useCan('calendar_entry:create') && !readOnly;
  const [roster, setRoster] = useState<NewHiresRoster | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [month, setMonth] = useState<string>('all');
  const [asking, setAsking] = useState<NewHireRow | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    let live = true;
    setError(null);
    readNewHires()
      .then((next) => { if (live) { setRoster(next); setEmpty(false); } })
      .catch((err) => {
        if (!live) return;
        // Nobody the reader leads joined as a new hire in the year: the nav would not have offered the page.
        if (err instanceof ApiRequestError && err.status === 404) setEmpty(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [attempt]);

  const phone = usePhone();

  const markLeft = async (row: NewHireRow) => {
    setAsking(null);
    setRefused(null);
    try {
      await markHireLeft(row.hire.membershipId);
      show(t.markedLeft({ name: row.hire.name }));
      setAttempt((n) => n + 1);
    } catch (err) {
      setRefused(t.markLeftFailed({ why: toDisplayError(err).message }));
    }
  };

  if (empty) {
    return <Card><p className="text-center text-md text-muted">{t.empty}</p></Card>;
  }

  const inMonth = (row: NewHireRow) => month === 'all' || row.joinDate.startsWith(month);
  const manyUnits = (roster?.units.length ?? 0) > 1;
  const actions: RowActions = {
    scheduleHref: maySchedule ? oneOnOneHref : null,
    onMarkLeft: mayMarkLeft ? setAsking : null,
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!roster && !error && <SkeletonCards count={2} label={t.loading} />}
      {roster && <Activation3MCard roster={roster} month={month} onMonth={setMonth} />}
      {refused && <p role="alert" className="text-sm font-semibold text-alert">{refused}</p>}
      {roster && SECTIONS.map((key) => (
        <SectionCard
          key={key}
          section={key}
          title={t.sections[key]}
          rows={roster.sections[key].filter(inMonth)}
          days={roster.days}
          phone={phone}
          showUnit={manyUnits}
          actions={actions}
        />
      ))}
      <Dialog
        open={asking !== null}
        message={asking ? t.markLeftQuestion({ name: asking.hire.name }) : ''}
        confirmLabel={t.markLeft}
        cancelLabel={t.cancel}
        tone="danger"
        onConfirm={() => { if (asking) void markLeft(asking); }}
        onCancel={() => setAsking(null)}
      />
      <Toast toast={toast} />
    </div>
  );
}

/** A share's figure, `—` with its words for a screen reader while nobody is decided. */
function ShareFigure({ pct, className }: { pct: number | null; className?: string }) {
  const t = useMessages(newHiresMessages);
  const figures = useFigureLanguage();
  if (pct === null) {
    return (
      <span className={className}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t.noFigureName}</span>
      </span>
    );
  }
  return <span className={className}>{formatPercent(pct, {}, figures)}</span>;
}

/** A unit's or the reader's figures, for the month chosen: the served month's share, or the whole year's. */
const shareFor = (figures: Activation3MFigures, month: string): Activation3MShare =>
  (month === 'all' ? figures.all : figures.byMonth.find((m) => m.month === month) ?? { activated: 0, notActivated: 0, inProgress: 0, pct: null });

/**
 * **The 3M activation %** (AC-2, AC-3; I-471): the reader's figure, its counts, the *Join month* filter — every join
 * month the server lists, newest first, and *All* — and, where the reader has more than one unit, each unit's figure.
 */
function Activation3MCard({ roster, month, onMonth }: { roster: NewHiresRoster; month: string; onMonth: (m: string) => void }) {
  const t = useMessages(newHiresMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const share = shareFor(roster.activation3M, month);
  return (
    <section aria-labelledby="activation-3m" className="rounded-lg border border-hairline bg-card px-6 py-[22px] max-md:px-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="activation-3m" className="font-display text-md font-bold text-navy">{t.activation3M}</h2>
          <ShareFigure pct={share.pct} className="mt-1 block font-display text-2xl font-bold text-navy" />
          <p className="text-sm text-muted">
            {t.counts({ activated: share.activated, notActivated: share.notActivated, inProgress: share.inProgress })}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-navy">
          {t.joinMonth}
          <Select value={month} onChange={(e) => onMonth(e.target.value)} className="w-auto">
            <option value="all">{t.allMonths}</option>
            {roster.activation3M.byMonth.map((m) => <option key={m.month} value={m.month}>{formatMonth(m.month, figures)}</option>)}
          </Select>
        </label>
      </div>
      {roster.units.length > 1 && (
        <ul aria-label={t.byUnit} className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-hairline pt-3 text-sm text-navy">
          {roster.units.map((unit) => (
            <li key={unit.leader?.membershipId ?? 'direct'}>
              <span className="text-muted">{groupTitle(unit, language)}</span>{' '}
              <ShareFigure pct={shareFor(unit.activation3M, month).pct} className="font-semibold" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** What a row may offer: the calendar's address for a 1:1 with them, and *Mark left* — each `null` when not the reader's. */
interface RowActions {
  scheduleHref: ((membershipId: string) => string) | null;
  onMarkLeft: ((row: NewHireRow) => void) | null;
}

/** An overdue checklist, or not activated — and not gone: the rows that offer a 1:1 and *Mark left* (AC-4). */
const needsAction = (row: NewHireRow) => row.leftOn === null && (row.activation3M === 'not_activated' || row.checklist?.overdue === true);

/** `.newhire-table th` and `td` (`:1541-1545`). */
const TH = 'border-b border-hairline px-3 py-[9px] text-left text-xs font-semibold uppercase tracking-wide text-muted';
const TD = 'border-b border-hairline px-3 py-3.5 text-md font-medium text-navy';

/** The name: a link to the detail, plain once they left — and their unit under it, where the reader has several. */
function HireName({ row, showUnit, className }: { row: NewHireRow; showUnit: boolean; className?: string }) {
  const language = useLanguage();
  return (
    <>
      {row.leftOn === null
        ? <Link href={newHireHref(row.hire.membershipId)} className={cn('text-navy hover:underline', className)}>{row.hire.name}</Link>
        : <span className={className}>{row.hire.name}</span>}
      {showUnit && <span className="block text-xs font-normal text-muted">{groupTitle(row.unit, language)}</span>}
    </>
  );
}

/** The checklist's bar and percentage, red and bold when overdue — said to a screen reader too — or *No checklist*. */
function ChecklistCell({ checklist, fill = false }: { checklist: NewHireRow['checklist']; fill?: boolean }) {
  const t = useMessages(newHiresMessages);
  const figures = useFigureLanguage();
  if (!checklist) return <span className="text-sm text-muted">{t.noChecklist}</span>;
  const width = Math.min(100, Math.max(0, checklist.pct));
  return (
    <div className="flex items-center gap-[9px]" data-overdue={checklist.overdue || undefined}>
      <div aria-hidden="true" className={cn('h-1.5 shrink-0 overflow-hidden rounded-sm border border-hairline bg-base', fill ? 'min-w-0 flex-1' : 'w-[90px]')}>
        <div className="h-full rounded-sm bg-gradient-to-r from-amber to-amber-dark" style={{ width: `${width}%` }} />
      </div>
      <span className={cn('shrink-0', checklist.overdue && 'font-bold text-alert')}>
        {formatPercent(checklist.pct, {}, figures)}
        {checklist.overdue && <span className="sr-only">{t.overdue}</span>}
      </span>
    </div>
  );
}

/** The result's words: the section's, and *Left {date}* for one who left — its day in `figures`. */
function resultWords(row: NewHireRow, t: HiresWords, figures: Language): string {
  const result = t.result3M[row.activation3M];
  return row.leftOn ? `${result} · ${t.leftOn({ on: formatShortDay(row.leftOn, { year: true }, figures) })}` : result;
}

/** *Schedule 1:1* and *Mark left*, on a row that needs them and to a reader who may. */
function RowActionButtons({ row, actions }: { row: NewHireRow; actions: RowActions }) {
  const t = useMessages(newHiresMessages);
  if (!needsAction(row) || (!actions.scheduleHref && !actions.onMarkLeft)) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {actions.scheduleHref && (
        <Link
          href={actions.scheduleHref(row.hire.membershipId)}
          aria-label={t.scheduleOneOnOneName({ name: row.hire.name })}
          className={cn('text-sm font-semibold text-navy-soft underline-offset-2 hover:text-navy hover:underline', TEXT_TAP)}
        >
          {t.scheduleOneOnOne}
        </Link>
      )}
      {actions.onMarkLeft && (
        <Button
          variant="inlineDanger"
          aria-label={t.markLeftName({ name: row.hire.name })}
          onClick={() => actions.onMarkLeft!(row)}
        >
          {t.markLeft}
        </Button>
      )}
    </div>
  );
}

/** One section's card (`.newhire-group-card`, `:6775-6789`): its heading, and its table — on a phone, its cards. */
function SectionCard({
  section, title, rows, days, phone, showUnit, actions,
}: {
  section: SectionKey;
  title: string;
  rows: NewHireRow[];
  days: number;
  phone: boolean;
  showUnit: boolean;
  actions: RowActions;
}) {
  const t = useMessages(newHiresMessages);
  const figures = useFigureLanguage();
  const day = (value: string) => formatShortDay(value, { year: true }, figures);
  const inProgress = section === 'inProgress';
  const withActions = rows.some(needsAction) && (actions.scheduleHref !== null || actions.onMarkLeft !== null);
  return (
    <section aria-label={title} className={cn('rounded-lg border border-hairline bg-card', phone ? 'px-4 py-[18px]' : 'px-6 py-[22px]')}>
      <h2 className="mb-3 font-display text-md font-bold text-navy">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-muted">{t.sectionEmpty}</p>}
      {rows.length > 0 && phone && (
        <ul role="list" aria-label={title}>
          {rows.map((row) => (
            <li key={row.hire.membershipId} className="border-b border-hairline py-3 last:border-b-0">
              <HireName row={row} showUnit={showUnit} className={cn('break-words text-md font-semibold', TEXT_TAP)} />
              <div className="mt-1.5 text-md font-medium text-navy"><ChecklistCell checklist={row.checklist} fill /></div>
              <p className="mt-1.5 text-sm font-medium text-navy">
                {inProgress
                  ? t.dayOf({ day: String(row.day), of: days })
                  : resultWords(row, t, figures)}
              </p>
              <p className="text-sm text-muted">
                {t.cardDates({ join: day(row.joinDate), firstSale: row.firstSaleDate ? day(row.firstSaleDate) : '—' })}
              </p>
              <div className="mt-1"><RowActionButtons row={row} actions={actions} /></div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && !phone && (
        <div className="overflow-x-auto">
          {/* `relative`, so the *Actions* header's `sr-only` name stays in this scroll box: without it the name widened
              the page at 768px by 42px, 57px for the Owner (a production walk, 2026-10-27; `DataTable`'s own fix). */}
          <table className="relative w-full min-w-[560px] border-collapse">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <th scope="col" className={TH}>{t.columns.name}</th>
                <th scope="col" className={TH}>{t.columns.joinDate}</th>
                {inProgress && <th scope="col" className={cn(TH, 'text-center')}>{t.columns.day}</th>}
                <th scope="col" className={TH}>{t.columns.checklist}</th>
                <th scope="col" className={TH}>{t.columns.firstSale}</th>
                {!inProgress && <th scope="col" className={TH}>{t.columns.result}</th>}
                {withActions && <th scope="col" className={TH}><span className="sr-only">{t.columns.actions}</span></th>}
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>*]:border-b-0">
              {rows.map((row) => (
                <tr key={row.hire.membershipId} className="hover:bg-navy/[0.03]">
                  <th scope="row" className={cn(TD, 'text-left')}><HireName row={row} showUnit={showUnit} /></th>
                  <td className={TD}><time dateTime={row.joinDate}>{day(row.joinDate)}</time></td>
                  {inProgress && (
                    <td className={cn(TD, 'text-center')}>
                      {row.day}
                      <span className="font-normal text-muted"> /{days}</span>
                    </td>
                  )}
                  <td className={TD}><ChecklistCell checklist={row.checklist} /></td>
                  <td className={TD}>
                    {row.firstSaleDate
                      ? <time dateTime={row.firstSaleDate}>{day(row.firstSaleDate)}</time>
                      : <span className="text-muted">—</span>}
                  </td>
                  {!inProgress && <td className={TD}>{resultWords(row, t, figures)}</td>}
                  {withActions && <td className={TD}><RowActionButtons row={row} actions={actions} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/*
 * ── One hire ─────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * **One hire's activation, as a leader reads it** (`/new-hires/[membershipId]`, `Overall.html:3363-3416`,
 * logic `:6791-6892`; P13-T5, T6): the hire's name as the title, *Back to Your New Hires*, *Activation
 * progress* with the *Start date* the leader may correct (OD-118), the tiles — *Day* red when overdue
 * (`:6801`) — the bar and the table, the five aspect cards, and the *Coaching note*.
 *
 * - **Manual items are the leader's to tick and untick** (OD-121), each write toasting *"Activation
 *   status updated."* (`:6869`). **The linked items are disabled with *Auto***, as on the hire's page
 *   (contradiction 1, a Fix): nobody ticks a live link (ADR-0031). No note or date fields, as drawn —
 *   those are the hire's own, and no leader's read carries them (T2 AC-4).
 * - **Every done row says who ticked it** (OD-121), since the hire and every leader above them tick the
 *   same list.
 * - **A hire outside the reader's reach is a 404**, and the page says so without saying who exists.
 * - **An activation that is over** is read, and written no more (the server answers every write 409
 *   `ACTIVATION_CLOSED`, the note's included): its boxes, its date and its note are drawn read-only, with
 *   no *Save note*, and one line under the heading says how it ended.
 * - **A read-only support session draws no write control** (T5 AC-8).
 * - **No count before it is settled, and no jump after a tick** (P18.96-T7 AC-1, AC-2; UI-007, UI-008): the summary is
 *   the skeleton until this hire's one read answers, its links evaluated; a tick changes the box at once and the
 *   figures when its answer lands, **in place** — every row and card keeps its node, the focus stays on the box, and
 *   nothing scrolls the page.
 * - **Its words are the catalogue's** (`new-hires.ts`, and `activation.ts` for the parts the hire's page shares;
 *   P18.98-T4), every date in the figures' language — so the join date beside the shared date field reads as its
 *   face does.
 */
export function NewHireDetail({ membershipId }: { membershipId: string }) {
  const t = useMessages(newHiresMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { me } = useSession();
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const mayTick = useCan('activation:update_manual_item') && !readOnly;
  /*
   * P18.96-T4 AC-3: a data-backed item is ticked with its record — a 1:1 logged as a coaching session, or the hire's
   * closing — which only a leader who runs sessions and reads the hire's leads may write: an AB's or an AAB's. An Agent
   * who leads reads the three as Auto. The server refuses the rest whatever this draws.
   */
  const mayRecord = useCan('coaching_session:create') && mayTick;
  const mayCorrect = useCan('activation:set_start_date') && !readOnly;
  const mayNote = useCan('activation_note:write') && !readOnly;
  const reader = me?.membership?.membershipId;
  const { toast, show } = useToast();
  const queue = useWriteQueue();
  /**
   * A tick and the start date each say *Saving… → Saved ✓* beside them, or *Couldn't save — retry*
   * (P18.95-T1 AC-5, ADR-0167 §5; UI-007), and keep the prototype's toast once they land.
   */
  const { save: track, statusOf } = useInlineSave();

  const [view, setView] = useState<ActivationView | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<Readonly<Record<string, boolean>>>({});
  const [failed, setFailed] = useState<Readonly<Record<string, string>>>({});
  const asked = useRef<Record<string, number>>({});
  const [startError, setStartError] = useState<string | null>(null);
  const [startReset, setStartReset] = useState(0);

  useEffect(() => {
    let live = true;
    /*
     * P18.96-T7 AC-1 (UI-007): **the counts and statuses are only ever this hire's read, settled** — the server evaluates
     * every link, the data-backed ones included, before it answers (`ActivationProgressService.resolve`). Until that
     * answer lands, the page is its skeleton: never the previous hire's figures under this one's name, and never a
     * read that answered after a later one (`live`). A write's answer replaces them in place, with no skeleton (AC-2).
     */
    setView(null);
    setPending((p) => (Object.keys(p).length === 0 ? p : {}));
    setFailed((f) => (Object.keys(f).length === 0 ? f : {}));
    setError(null);
    setMissing(false);
    readNewHire(membershipId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [membershipId, attempt]);

  /**
   * A tick; `null` for a hire who has gone (404), where there is nothing left to retry. A data-backed item's carries its
   * record (P18.96-T4 AC-3), sent with the tick in one request; the answer says whether it landed.
   */
  const tick = useCallback((code: string, done: boolean, record?: ActivationRecordInput) => {
    return track(`${code}\ndone`, () => {
      const ask = (asked.current[code] ?? 0) + 1;
      asked.current[code] = ask;
      setPending((p) => ({ ...p, [code]: done }));
      setFailed(({ [code]: _gone, ...rest }) => rest);
      return queue(async () => {
        try {
          setView(await saveHireItem(membershipId, code, done, record));
          show(t.detail.statusUpdated);
          return true;
        } catch (err) {
          const gone = err instanceof ApiRequestError && err.status === 404;
          if (gone) setMissing(true);
          setFailed((f) => ({ ...f, [code]: toDisplayError(err).message }));
          return gone ? null : false;
        } finally {
          if (asked.current[code] === ask) setPending(({ [code]: _done, ...rest }) => rest);
        }
      });
    });
  }, [membershipId, queue, show, track, t]);
  const loadClosings = useCallback(async () => (await readHireClosings(membershipId)).closings, [membershipId]);

  const correct = useCallback((startDate: string) => {
    void track('startDate', () => {
      setStartError(null);
      return queue(async () => {
        try {
          setView(await correctStartDate(membershipId, startDate));
          show(t.detail.startSaved);
          return true;
        } catch (err) {
          setStartError(toDisplayError(err).message);
          setStartReset((n) => n + 1);
          return false;
        }
      });
    });
  }, [membershipId, queue, show, track, t]);

  if (missing) return <HireNotFound />;

  const open = view?.state === 'open';

  return (
    <div className="min-w-0">
      {/* The prototype's subtitle says the leader can update it, which is untrue once it is over: there
          the one line it already has says how it ended instead (ADR-0062 §2, form 5; parity L-89). */}
      {view && (
        <PageHeader
          title={view.hire.name}
          subtitle={view.state === 'open' ? t.detail.subtitle : closedLine(view, reader, language, figures)}
        />
      )}
      <BackToRoster />

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <ActivationSkeleton label={t.detail.loading} />}

      {view && (
        <div className="flex flex-col gap-4">
          <Card density="compact">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3.5">
              <ProgressHeading>{t.detail.heading}</ProgressHeading>
              <JoinDateField
                view={view}
                reader={reader}
                writable={mayCorrect && open}
                onCommit={correct}
                status={statusOf('startDate')}
                error={startError}
                resetKey={startReset}
              />
            </div>
            <ProgressSummary view={view} label={t.detail.heading} markOverdue />
          </Card>

          {view.aspects.map((aspect, i) => (
            <AspectCard key={aspect.code} n={i + 1} label={aspect.label}>
              {aspect.items.map((item) => (isDataBacked(item) ? (
                <DataItemRow
                  key={item.code}
                  item={pending[item.code] === undefined ? item : { ...item, done: pending[item.code] }}
                  reader={reader}
                  writable={mayRecord && open}
                  audience="leader"
                  hireId={view.hire.membershipId}
                  today={view.today}
                  startDate={view.startDate}
                  loadClosings={loadClosings}
                  onSave={(done, record) => tick(item.code, done, record)}
                  status={statusOf(`${item.code}\ndone`)}
                  error={failed[item.code]}
                />
              ) : (
                <HireItemRow
                  key={item.code}
                  item={pending[item.code] === undefined ? item : { ...item, done: pending[item.code] }}
                  reader={reader}
                  writable={mayTick && open}
                  onTick={(done) => { void tick(item.code, done); }}
                  status={statusOf(`${item.code}\ndone`)}
                  error={failed[item.code]}
                />
              )))}
            </AspectCard>
          ))}

          <NoteCard
            key={view.note?.at ?? 'none'}
            view={view}
            reader={reader}
            writable={mayNote && open}
            onSaved={(note) => {
              setView((v) => (v ? { ...v, note } : v));
              show(t.note.saved({ name: view.hire.name }));
            }}
            onMissing={() => setMissing(true)}
          />
        </div>
      )}
      <Toast toast={toast} />
    </div>
  );
}

/** *Back to New Hires* (`:3365-3368`; the prototype's *Your New Hires* until P18.95-T9 AC-2, `.training-back-btn` `:1811-1816`): the prototype's chevron and words, as a link. */
function BackToRoster() {
  const t = useMessages(newHiresMessages);
  return (
    <Link
      href="/new-hires"
      className={cn('mb-3.5 inline-flex items-center gap-1.5 py-1.5 text-base font-semibold text-navy-soft hover:text-navy', TAP_HEIGHT)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {t.detail.back}
    </Link>
  );
}

/**
 * *Join date* — the prototype's *Start date* (P18.96-T2 AC-5, ADR-0169) — which a leader may correct (OD-118): the
 * shared date field, here, written on change and audited by the server, within the contract's bounds — not after
 * the office's today and no more than a year before it. The server moves the membership's join date and the
 * activation's start together. Beside it, who last corrected it and when.
 */
function JoinDateField({
  view, reader, writable, onCommit, status, error, resetKey,
}: {
  view: ActivationView;
  reader: string | null | undefined;
  writable: boolean;
  onCommit: (startDate: string) => void;
  /** Its save confirmation (P18.95-T1 AC-5), under the field where the refusal is. */
  status: InlineSaveStatusProps;
  error: string | null;
  resetKey: number;
}) {
  const a = useMessages(activationMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const corrected = correctionOf(view, reader, language, figures);
  if (!writable) {
    return (
      <dl className="flex items-center gap-2">
        <dt className="whitespace-nowrap text-xs font-semibold text-navy">{a.joinDate}</dt>
        <dd className="flex h-[34px] items-center rounded-md border-[1.5px] border-hairline bg-base px-3 text-base text-navy">
          <time dateTime={view.startDate}>{formatShortDay(view.startDate, { year: true }, figures)}</time>
        </dd>
        {corrected && <dd><AttributionMark words={corrected} /></dd>}
      </dl>
    );
  }
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2">
        <label htmlFor="activation-start-date" className="whitespace-nowrap text-xs font-semibold text-navy">
          {a.joinDate}
        </label>
        <AutoSaveDateField
          id="activation-start-date"
          value={view.startDate}
          min={earliestStart(view.today)}
          max={view.today}
          allowed={(value) => startDateAllowed(value, view.today)}
          invalidText={startDateRangeText(view.today, language, figures)}
          resetKey={resetKey}
          onCommit={(next) => { if (next) onCommit(next); }}
        />
        <AttributionMark words={corrected} />
      </div>
      <InlineSaveStatus {...status} label={a.joinDate} className="mt-1" />
      <RowError message={error ?? undefined} />
    </div>
  );
}

/** How an activation that is over ended, in the subtitle's place (parity L-89): words in `language`, days in `figures`. */
function closedLine(view: ActivationView, reader: string | null | undefined, language: Language, figures: Language): string {
  const t = messagesIn(newHiresMessages, language).detail;
  const you = messagesIn(activationMessages, language).you;
  return view.state === 'graduated'
    ? t.closedGraduated({
      by: view.graduatedBy ? (view.graduatedBy.membershipId === reader ? you : view.graduatedBy.name) : view.hire.name,
      on: view.graduatedAt ? formatOfficeDay(view.graduatedAt, OFFICE_TIME_ZONE, figures) : '',
    })
    : t.closedExpired({ on: formatShortDay(view.endsOn, { year: true }, figures) });
}

/** A leader's row (`:6823-6840`): a box to tick for a manual item, *Auto* and inert for a live link. */
function HireItemRow({
  item, reader, writable, onTick, status, error,
}: {
  item: ActivationItemProgress;
  reader: string | null | undefined;
  writable: boolean;
  onTick: (done: boolean) => void;
  /** The tick's save confirmation, beside the box (P18.95-T1 AC-5). */
  status: InlineSaveStatusProps;
  error: string | undefined;
}) {
  const words = attributionOf(item, reader, useLanguage(), useFigureLanguage());
  const manual = isManual(item);
  return (
    <div className={ITEM_ROW} data-code={item.code}>
      <div className="flex items-center gap-2.5">
        <label className={cn('flex min-w-0 items-center gap-2.5 text-md font-medium text-navy', manual && writable && 'cursor-pointer')}>
          <input
            type="checkbox"
            checked={item.done}
            disabled={!manual || !writable}
            onChange={(e) => onTick(e.target.checked)}
            className={ITEM_CHECKBOX}
          />
          <span>{item.label}</span>
        </label>
        {!manual && item.link && <AutoBadge link={item.link} />}
        {/* D-orphan (P18.5-T3 AC-4): a link that does not complete the item now — ticked by hand, as Settings says. */}
        {isTickedByHandLink(item) && <ByHandBadge />}
        <AttributionMark words={words} />
        <InlineSaveStatus {...status} label={item.label} />
      </div>
      <RowError message={error} />
    </div>
  );
}

/**
 * *Coaching note* (`.notes-card`, `:3407-3414`; OD-117, T6 AC-1): the prototype's heading, hint,
 * example and button, verbatim. One note per hire, replaced on each save; beside the heading, who saved
 * the one there now and when, since any leader above the hire may write it (ADR-0074).
 */
function NoteCard({
  view, reader, writable, onSaved, onMissing,
}: {
  view: ActivationView;
  reader: string | null | undefined;
  writable: boolean;
  onSaved: (note: NonNullable<ActivationView['note']>) => void;
  onMissing: () => void;
}) {
  const t = useMessages(newHiresMessages);
  const a = useMessages(activationMessages);
  const figures = useFigureLanguage();
  const [draft, setDraft] = useState(view.note?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedBy = view.note
    ? t.note.savedBy({
      who: view.note.by.membershipId === reader ? a.you : view.note.by.name,
      when: formatOfficeDay(view.note.at, OFFICE_TIME_ZONE, figures),
    })
    : null;

  const save = async () => {
    const text = draft.trim();
    if (!text) {
      setError(t.note.empty);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { note } = await saveActivationNote(view.hire.membershipId, text);
      onSaved(note);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 404) onMissing();
      // Read as every other write on these pages reads a refusal (L-85): *Not saved. {why}*.
      setError(a.notSaved({ why: toDisplayError(err).message }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="coaching-note" className="rounded-lg border border-hairline bg-card p-[18px]">
      <div className="flex items-center gap-1.5">
        <h2 id="coaching-note" className="font-display text-md font-bold text-navy">{a.noteHeading}</h2>
        <AttributionMark words={savedBy} />
      </div>
      <p id="coaching-note-hint" className="mb-2.5 mt-1 text-sm text-muted">{t.note.hint}</p>
      <Textarea
        aria-labelledby="coaching-note"
        aria-describedby="coaching-note-hint"
        value={draft}
        readOnly={!writable}
        maxLength={ACTIVATION_NOTE_MAX}
        placeholder={t.note.example}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        className="w-full resize-y text-md"
      />
      {error && <p role="alert" className="mt-1.5 text-xs font-semibold text-alert">{error}</p>}
      {writable && (
        <div className="mt-3 flex justify-end">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? t.note.saving : t.note.save}
          </Button>
        </div>
      )}
    </section>
  );
}

/** Outside the reader's reach, or no activation (T5 AC-8): the same words for each, naming nobody. */
function HireNotFound() {
  const t = useMessages(newHiresMessages);
  return (
    <div>
      <BackToRoster />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{t.detail.notFoundTitle}</h2>
        <p className="mt-1 text-md text-muted">{t.detail.notFoundLine}</p>
      </Card>
    </div>
  );
}
