'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { coachingSessionMessages } from '@/i18n/messages/coaching-session';
import type { ActivitySection, SubPeriodTarget } from '@/lib/activity';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useOpenedOnce } from '@/lib/use-opened-once';

/** The drill, downloaded when it is first opened and mounted from then on (`useOpenedOnce`; P18.99-T16). */
const ActivityDrill = dynamic(() => import('@/components/coaching-activity-drill').then((m) => m.ActivityDrill), { ssr: false });

/**
 * The pieces a coaching session is drawn from (P11-T8, P11-T10), shared by the three screens that draw
 * one: the session workspace (`coaching-session.tsx`), the archive and `/coaching/me`
 * (`coaching-record.tsx`). One set, so a finalized session reads the same wherever it is opened — the
 * workspace's finalized state, `Overall.html:1389-1417`, is the idiom all three follow.
 *
 * Coaching's own strings use none of ADR-0084's six words, and none names a phase, an id or a code. Its words are the
 * catalogue's (`messages/coaching-session.tsx`, P18.98-T4), its figures in `useFigureLanguage()`'s.
 *
 * **What only the record draws is in `coaching-record-parts.tsx`** (P18.99-T16, the bundle): the frozen snapshot's tags,
 * goal row, ratio lines and Activity panel, which the live workspace never shows and no longer loads.
 */

export function NumberDot({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-2xs font-bold text-white">
      {n}
    </span>
  );
}

export const EMPTY_LINE = 'text-sm italic text-muted';

/** By date, undated last (`Overall.html:11044-11049`). A stable sort, so rows with one date keep their order. */
export const byDueDate = (a: { dueDate: string | null }, b: { dueDate: string | null }) => {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;
  return a.dueDate.localeCompare(b.dueDate);
};

/** What the Activity card draws: the three targets and the section chips, live or frozen. */
export interface ActivityWeek {
  targets: readonly SubPeriodTarget[];
  sections: readonly ActivitySection[];
}

/**
 * **The session's *Aktivitas*, compact** (UI V1, UI-062): *Aktivitas* and *7 hari terakhir ›* — the drill — in its head;
 * **three small tiles**, the cascade's *Set appointment*, *Sales meeting* and *Submission polis*, each the week's count
 * over its target pro-rated to seven days (metrics §B.3, said to a screen reader and in the drill) with its bar; then
 * **one line**, *Recruitment 1 · Development 1* — the office's other sections, as typed — whose ⌄ opens their rows.
 * The live card's and the frozen one's body: `week` is `null` while it is read.
 */
export function ActivityTilesCard({
  name, week, error, className,
}: { name: string; week: ActivityWeek | null; error: ApiError | null; className?: string }) {
  const t = useMessages(coachingSessionMessages).activity;
  const [drill, setDrill] = useState(false);
  const drillOpened = useOpenedOnce(drill && week !== null);
  const [rows, setRows] = useState(false);
  const titleId = useId();
  const rowsId = useId();
  const targets = week?.targets ?? [];
  const sections = week?.sections ?? [];
  return (
    <section aria-labelledby={titleId} data-session-card="activity" className={cn('rounded-lg border border-card-edge bg-card p-3.5', className)}>
      <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
        <h2 id={titleId} className="text-lg font-bold text-navy">{t.title}</h2>
        <button
          type="button"
          disabled={!week}
          onClick={() => setDrill(true)}
          aria-haspopup="dialog"
          className={cn('inline-flex items-center gap-0.5 rounded-sm text-base font-medium text-navy-soft hover:underline disabled:cursor-default max-lg:min-h-11')}
        >
          {t.tag}
          <LineIcon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
      {error && <ErrorBanner {...error} />}
      {!week && !error && (
        <Skeleton label={t.reading}>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => <SkeletonBar key={i} className="h-[72px] rounded-row" />)}
          </div>
        </Skeleton>
      )}
      {week && (
        <>
          {targets.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {targets.map((target) => <WeekTile key={target.key} target={target} />)}
            </div>
          )}
          {sections.length > 0 && (
            <>
              <button
                type="button"
                aria-expanded={rows}
                aria-controls={rowsId}
                onClick={() => setRows((v) => !v)}
                className="mt-2 flex min-h-10 w-full items-center justify-between gap-2 text-left text-md text-ink max-lg:min-h-11"
              >
                <span className="min-w-0">
                  {sections.map((section, i) => (
                    <span key={section.code}>
                      {i > 0 && ' · '}
                      {section.label} <strong className="font-bold">{section.total}</strong>
                    </span>
                  ))}
                </span>
                <LineIcon name={rows ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 text-signal-grey" />
              </button>
              <ul id={rowsId} hidden={!rows} className="divide-y divide-divider">
                {sections.flatMap((section) => section.rows).map((row) => (
                  <li key={row.code} className="flex min-h-9 items-center justify-between gap-3 text-base">
                    <span className="min-w-0 text-ink">{row.label}</span>
                    <span className="font-semibold text-navy">{row.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {drillOpened && (
        <ActivityDrill open={drill && week !== null} name={name} targets={targets} sections={sections} onClose={() => setDrill(false)} />
      )}
    </section>
  );
}

/** One of the three tiles: its label, the count over the pro-rated target, and the bar (UI-062). */
function WeekTile({ target }: { target: SubPeriodTarget }) {
  const t = useMessages(coachingSessionMessages).activity;
  const label = t.targets[target.key];
  const pct = target.target ? Math.min(100, Math.round((target.logged / target.target) * 100)) : 0;
  return (
    <div data-week-tile={target.key} className="min-w-0 rounded-row bg-base px-3 py-2.5">
      <span className="block truncate text-xs text-muted" title={label}>{label}</span>
      <span className="block whitespace-nowrap text-[1.375rem] font-bold leading-tight text-navy">
        {target.logged}
        {target.target !== null && target.target > 0 && (
          <span className="text-xs font-normal text-muted">
            {' '}/ {target.target}
            <span className="sr-only">{t.proRated({ target: target.target })}</span>
          </span>
        )}
      </span>
      {/* No APE target to scale, or nothing more this month: said, never a bar over nothing (data honesty). */}
      {target.target === null && <span className="mt-1 block text-xs text-muted">{t.noTarget}</span>}
      {target.target === 0 && <span className="mt-1 block text-xs text-muted">{t.nothingMore}</span>}
      {target.target !== null && target.target > 0 && (
        <div
          role="progressbar"
          aria-label={t.against({ label })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={t.of({ logged: target.logged, target: target.target })}
          className="mt-2 h-1.5 overflow-hidden rounded-pill bg-hairline"
        >
          <div className="h-full rounded-pill bg-amber" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
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
  closed, until, onClick, className,
}: { closed: boolean; until: string; onClick: () => void; className?: string }) {
  const t = useMessages(coachingSessionMessages).editAgain;
  const windowNote = useId();
  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={closed || undefined}
        aria-describedby={closed ? windowNote : undefined}
        title={closed ? t.closed({ until }) : undefined}
        className={cn('gap-1.5', closed && 'cursor-not-allowed opacity-40', className)}
        onClick={() => {
          if (closed) return;
          onClick();
        }}
      >
        <LineIcon name="pencil" className="h-4 w-4" />
        {t.button}
      </Button>
      {closed && <span id={windowNote} className="sr-only">{t.closed({ until })}</span>}
    </>
  );
}
