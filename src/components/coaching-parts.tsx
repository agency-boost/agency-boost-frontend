'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { SectionChips, SummaryCard } from '@/components/summary-card';
import { Button, ErrorBanner, Textarea } from '@/components/ui/field';
import { TEXT_TAP } from '@/components/ui/phone';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import type { ActivitySection, SubPeriodTarget } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { reopenSession, type CoachingSession } from '@/lib/coaching';
import { formatCalendarDayLong, formatPercent, formatRupiahCompact, formatShortDay } from '@/lib/format';
import { balanceSideNames, formatBalanceBand, formatBalanceSplit } from '@/lib/ratio-balance';
import { formatBenchmark, formatRatioForStatus, type RatioDisplayUnit } from '@/lib/ratio-format';
import type { PeriodFigures } from '@/lib/summary';

/**
 * The pieces a coaching session is drawn from (P11-T8, P11-T10), shared by the three screens that draw
 * one: the session workspace (`coaching-session.tsx`), the archive and `/coaching/me`
 * (`coaching-record.tsx`). One set, so a finalized session reads the same wherever it is opened — the
 * workspace's finalized state, `Overall.html:1389-1417`, is the idiom all three follow.
 *
 * Coaching's own strings use none of ADR-0084's six words, and none names a phase, an id or a code. Its words are the
 * catalogue's (`messages/coaching-session.tsx`, P18.98-T4), its figures in `useFigureLanguage()`'s.
 */

/** The prototype's tags (`.action-date-tag`, `.action-from-tag`, `Overall.html:1332-1335`). */
export function DateTag({ day }: { day: string | null }) {
  const language = useFigureLanguage();
  // Navy where the prototype has amber-dark: small amber text clears no contrast floor (`tokens.md`).
  return <span className="whitespace-nowrap text-xs font-bold text-navy">{day ? formatShortDay(day, {}, language) : '—'}</span>;
}

export function FromLeadTag({ name }: { name: string }) {
  const t = useMessages(coachingSessionMessages).agreement;
  return (
    <span className="whitespace-nowrap rounded-pill bg-navy-soft/[0.08] px-2 py-0.5 text-2xs text-navy-soft">
      {t.fromLead({ name })}
    </span>
  );
}

export function NumberDot({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-2xs font-bold text-white">
      {n}
    </span>
  );
}

export const EMPTY_LINE = 'text-sm italic text-muted';

/** A card's small caps label (`Overall.html:11077`, `:11079`): *From leads (automatic)*, *Other action items*. */
export const GROUP_LABEL = 'mb-1 mt-3.5 text-xs font-bold uppercase tracking-[0.03em] text-muted first:mt-0';

/** By date, undated last (`Overall.html:11044-11049`). A stable sort, so rows with one date keep their order. */
export const byDueDate = (a: { dueDate: string | null }, b: { dueDate: string | null }) => {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
};

/** The finalized state's green tag (`Overall.html:4309`): *✓ Finalized {date}*, the session's own day. */
export function FinalizedBadge({ date }: { date: string | null }) {
  const figures = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).finalize;
  return (
    <span className="inline-block rounded-pill bg-success/10 px-3.5 py-1.5 text-sm font-bold text-success">
      {t.badge({ day: date ? formatCalendarDayLong(date, figures) : '' })}
    </span>
  );
}

/*
 * ── The Goal card's rows ────────────────────────────────────────────────────────────────────────
 */

/** One of the Goal card's two rows: produced over target, the percentage, the bar, what remains. */
export function GoalRow({
  figures, period, target, editor, className,
}: {
  figures: Pick<PeriodFigures, 'actualMinor' | 'attainmentPct' | 'gapMinor'>;
  period: 'month' | 'year';
  /** The target as text, or the control that edits it; `null` while the editor stands in its place. */
  target: ReactNode;
  editor?: ReactNode;
  className?: string;
}) {
  const language = useFigureLanguage();
  const t = useMessages(coachingSessionMessages).goal;
  const pct = figures.attainmentPct;
  const label = period === 'month' ? t.month : t.year;
  return (
    <div className={className}>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1.5">
        <span className="font-body text-[1.1875rem] font-bold text-navy">
          {figures.actualMinor === null
            ? <span className="text-muted">{t.notUploaded}</span>
            : formatRupiahCompact(figures.actualMinor, {}, language)}
          {target !== null && <> / {target}</>}
        </span>
        {pct !== null && <span className="text-md font-bold text-navy-soft">{formatPercent(pct, {}, language)}</span>}
      </div>
      {editor && <div className="mb-2">{editor}</div>}
      {pct !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, pct)}
          aria-valuetext={formatPercent(pct, {}, language)}
          className="h-1.5 overflow-hidden rounded bg-navy/[0.08]"
        >
          <div className="h-full rounded bg-navy-soft" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      {figures.gapMinor !== null && (
        <p className="mt-2 text-sm text-muted">
          {t.remaining({ sum: formatRupiahCompact(figures.gapMinor, {}, language), period })}
        </p>
      )}
    </div>
  );
}

/*
 * ── Ratios ──────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * What a ratio line needs: the live read's row (`GET /activity/ratios?for=`) and the snapshot's frozen
 * row both carry it. A snapshot taken before rows carried `sides` says how far a balance leans and not
 * which way (`functional/coaching.md`, *What finalize freezes*).
 */
export interface RatioLineData {
  code: string;
  label: string;
  comparison: 'gte' | 'band';
  displayUnit: RatioDisplayUnit;
  benchmark: number | null;
  value: number | null;
  /** A balance's first side's percent of both; `null` on a rate and when there is nothing on either side. */
  share?: number | null;
  status: 'success' | 'alert' | 'neutral';
  sides?: { numerator: string | null; denominator: string | null } | null;
}

const RATIO_VALUE: Record<RatioLineData['status'], string> = {
  success: 'text-success',
  alert: 'text-alert',
  neutral: 'text-muted',
};

/**
 * One ratio, its value over its benchmark.
 *
 * **A balance is each side's share of the two** (P13.1-T6), as the coachee's own *Activity Ratios* card
 * writes it — *40% Selling · 60% Recruitment* over *Benchmark: 35%–65% each side* — where it read *{n}
 * points toward {side}*. **A snapshot frozen before rows carried `sides`** never held the names, so it
 * still says how far it leaned, in points, and not which way: naming the sides from today's
 * configuration would print today's words on a past record.
 */
export function RatioLine({ ratio }: { ratio: RatioLineData }) {
  const figures = useFigureLanguage();
  const words = useLanguage();
  const t = useMessages(coachingSessionMessages).ratios;
  const band = ratio.comparison === 'band';
  const benchmark = ratio.benchmark ?? 0;
  const shares = band && !!ratio.sides && ratio.share !== undefined;
  let value: string;
  if (ratio.value === null) value = '–';
  else if (shares && ratio.share != null) {
    // A side's name is the office's section, as typed; *Side A* and *Side B* are the catalogue's.
    const names = balanceSideNames(ratio.sides, words);
    const split = formatBalanceSplit(ratio.share, benchmark, ratio.status, figures);
    value = `${split.first} ${names.first} · ${split.second} ${names.second}`;
  } else if (band) {
    value = formatRatioForStatus(ratio.value, 'points', benchmark, ratio.status, figures, words);
  } else {
    value = formatRatioForStatus(ratio.value, ratio.displayUnit, benchmark, ratio.status, figures, words);
  }
  const edges = formatBalanceBand(benchmark, figures);
  return (
    <li className="flex items-center justify-between gap-3 text-base">
      <span className="min-w-0 flex-1 text-navy">{ratio.label}</span>
      <span className="flex shrink-0 flex-col items-end gap-px">
        <span className={cn('font-bold', RATIO_VALUE[ratio.status])}>{value}</span>
        {ratio.benchmark !== null && (
          <span className="whitespace-nowrap text-2xs font-medium text-muted">
            {t.benchmark({
              value: shares
                ? t.eachSide({ low: edges.low, high: edges.high })
                : formatBenchmark(ratio.benchmark, band ? 'points' : ratio.displayUnit, figures, words),
            })}
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * *Ratios*, *Last 30 days* (`Overall.html:4215-4218`): the live card's and the frozen one's body.
 * `rows` is `null` while it is read.
 */
export function RatiosPanel({
  rows, error, emptyLine,
}: { rows: readonly RatioLineData[] | null; error: ApiError | null; emptyLine: string }) {
  const t = useMessages(coachingSessionMessages).ratios;
  return (
    <SummaryCard id="session-ratios" title={t.title} tag={t.tag} className="min-w-0">
      {error && <ErrorBanner {...error} />}
      {!rows && !error && (
        <Skeleton label={t.working}>
          {[0, 1, 2, 3].map((i) => <SkeletonBar key={i} className="mb-3 h-4 w-full" />)}
        </Skeleton>
      )}
      {rows && (rows.length === 0 ? (
        <p className="text-sm text-navy">{emptyLine}</p>
      ) : (
        <ul className="flex flex-col gap-[9px]">
          {rows.map((ratio) => <RatioLine key={ratio.code} ratio={ratio} />)}
        </ul>
      ))}
    </SummaryCard>
  );
}

/*
 * ── Activity ────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * One of the three targets: its label in the cascade's words (ADR-0160 §4; P18.9-T2's cleanup, 2026-10-26) — the
 * Summary's and `/goals`', kept in both languages (§A.6). The prototype reads *Leads contacted*, *Appointments* and
 * *Closings* (`Overall.html:4223-4238`).
 */
export function WeekChip({ target }: { target: SubPeriodTarget }) {
  const t = useMessages(coachingSessionMessages).activity;
  const label = t.targets[target.key];
  const pct = target.target ? Math.min(100, Math.round((target.logged / target.target) * 100)) : 0;
  return (
    <div className="rounded-[10px] border border-hairline bg-base p-3">
      <span className="mb-1.5 block text-xs text-muted">{label}</span>
      <span className="mb-2 block font-body text-lg font-bold text-navy">
        {target.logged}
        {target.target !== null && target.target > 0 && (
          <span className="text-xs font-medium text-muted">{t.proRated({ target: target.target })}</span>
        )}
      </span>
      {target.target === null ? (
        <span className="block text-xs text-muted">{t.noTarget}</span>
      ) : target.target === 0 ? (
        <span className="block text-xs text-muted">{t.nothingMore}</span>
      ) : (
        <div
          role="progressbar"
          aria-label={t.against({ label })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={t.of({ logged: target.logged, target: target.target })}
          className="h-1.5 overflow-hidden rounded bg-navy/[0.08]"
        >
          <div className="h-full rounded bg-navy-soft" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** What the Activity card draws: the three targets and the section chips, live or frozen. */
export interface ActivityWeek {
  targets: readonly SubPeriodTarget[];
  sections: readonly ActivitySection[];
}

/**
 * *Activity → view full dashboard* · *Last 7 days* (`Overall.html:4221-4254`, contradiction #6): the
 * three pro-rated targets, the section chips grouped as the Summary groups them (ADR-0064), and the
 * drill, a dialog in the page — *{name} — Activity Dashboard* · *Last 7 days · category breakdown* —
 * where the prototype opened a browser pop-up (`:10923-10953`). It opens on a finalized session too.
 * `week` is `null` while it is read.
 */
export function ActivityPanel({ name, week, error }: { name: string; week: ActivityWeek | null; error: ApiError | null }) {
  const t = useMessages(coachingSessionMessages).activity;
  const [drill, setDrill] = useState(false);
  const targets = week?.targets ?? [];
  const sections = week?.sections ?? [];

  // The heading, and the drill beside its words (`Overall.html:4221`).
  const heading = (
    <>
      {t.title}{' '}
      <button
        type="button"
        disabled={!week}
        onClick={() => setDrill(true)}
        className={cn('rounded-sm text-xs font-medium text-navy-soft hover:underline disabled:cursor-default', TEXT_TAP)}
      >
        {t.full}
      </button>
    </>
  );

  return (
    <SummaryCard
      id="session-activity"
      title={heading}
      tag={t.tag}
      className="min-w-0"
    >
      {error && <ErrorBanner {...error} />}
      {!week && !error && (
        <Skeleton label={t.reading}>
          <div className="grid gap-2.5 md:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-[72px] rounded-[10px]" />)}
          </div>
        </Skeleton>
      )}
      {week && (
        <>
          {targets.length > 0 && (
            <div className="grid gap-2.5 md:grid-cols-3">
              {targets.map((target) => <WeekChip key={target.key} target={target} />)}
            </div>
          )}
          <SectionChips sections={sections} idPrefix="session-section" heading={(label) => label} />
        </>
      )}

      <Modal
        open={drill && week !== null}
        title={t.dialog({ name })}
        description={t.dialogLine}
        onClose={() => setDrill(false)}
        focusDialog
        className="max-w-[40rem]"
      >
        <div className="overflow-x-auto rounded-lg border border-hairline">
          <table className="relative w-full border-collapse text-left text-base">
            <caption className="sr-only">{t.caption({ name })}</caption>
            <thead>
              <tr className="bg-navy/[0.04] text-2xs uppercase text-muted">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t.columns.category}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t.columns.logged}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t.columns.target}</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((row) => (
                <tr key={row.key} className="border-t border-hairline">
                  <th scope="row" className="px-4 py-2.5 font-normal text-navy">{t.targets[row.key]}</th>
                  <td className="px-4 py-2.5 font-bold text-navy">{row.logged}</td>
                  <td className="px-4 py-2.5 text-navy">{row.target ?? '–'}</td>
                </tr>
              ))}
              {sections.flatMap((section) => section.rows).map((row) => (
                <tr key={row.code} className="border-t border-hairline">
                  <th scope="row" className="px-4 py-2.5 font-normal text-navy">{row.label}</th>
                  <td className="px-4 py-2.5 font-bold text-navy">{row.count}</td>
                  <td className="px-4 py-2.5 text-muted">–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setDrill(false)}>{t.close}</Button>
        </div>
      </Modal>
    </SummaryCard>
  );
}

/*
 * ── Edit again ──────────────────────────────────────────────────────────────────────────────────
 */

/**
 * *Edit again* (`Overall.html:4311`), as the finalized state draws it: live inside ADR-0079's window,
 * and past it drawn locked in the prototype's idiom for a locked control (`:1299`, `:10810`), with a
 * title saying until when the session could be reopened.
 */
export function EditAgainButton({
  closed, until, onClick,
}: { closed: boolean; until: string; onClick: () => void }) {
  const t = useMessages(coachingSessionMessages).editAgain;
  const windowNote = useId();
  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={closed || undefined}
        aria-describedby={closed ? windowNote : undefined}
        title={closed ? t.closed({ until }) : undefined}
        className={cn(closed && 'cursor-not-allowed opacity-40')}
        onClick={() => {
          if (closed) return;
          onClick();
        }}
      >
        {t.button}
      </Button>
      {closed && <span id={windowNote} className="sr-only">{t.closed({ until })}</span>}
    </>
  );
}

/**
 * The longest reason the server keeps (`functional/coaching.md`, *Data contract*). A validation limit, not a
 * domain constant: its source is the backend's reopen DTO (`coaching-session.dto.ts`), carried as `maxLength`.
 */
const REASON_MAX = 500;

/**
 * *Edit again*'s question (ADR-0079, a Fill): why, in the reader's words, kept with the session. The
 * dialog says, before it is sent, that everybody who reads the session — the coachee included — reads
 * the reason too, so nobody writes in it what they would not say to them.
 */
export function ReopenDialog({
  open, coacheeName, session, onClose, onReopened, onConflict,
}: {
  open: boolean;
  coacheeName: string;
  session: Pick<CoachingSession, 'sessionId' | 'version'>;
  onClose: () => void;
  onReopened: (session: CoachingSession) => Promise<void>;
  onConflict: () => void;
}) {
  const t = useMessages(coachingSessionMessages).editAgain;
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const fieldId = useId();

  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await reopenSession(session.sessionId, session.version, reason.trim());
      await onReopened(next);
    } catch (err) {
      const shown = toDisplayError(err);
      if (shown.code === 'VERSION_CONFLICT') onConflict();
      else setError(shown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t.title}
      description={t.line({ name: coacheeName })}
      onClose={onClose}
      className="text-left"
    >
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <label htmlFor={fieldId} className="text-sm font-semibold text-navy">{t.reason}</label>
        <Textarea
          id={fieldId}
          value={reason}
          maxLength={REASON_MAX}
          required
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <ErrorBanner {...error} />}
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>{t.cancel}</Button>
          <Button type="submit" disabled={busy || !reason.trim()}>{t.button}</Button>
        </div>
      </form>
    </Modal>
  );
}
