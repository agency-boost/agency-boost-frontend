'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TitleAvatar, useFieldChrome } from '@/components/field-nav';
import { Avatar } from '@/components/ui/person-row';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { forumMessages } from '@/i18n/messages/forum';
import { cn } from '@/lib/cn';
import { formatMonth, formatMonthName, formatShortDay, formatWeekday } from '@/lib/format';
import {
  cellText, changeText, footnotesIn, noneWords, rowName,
} from '@/lib/leader-meeting-tabs';
import {
  editorsInOrder, rungShort, type MeetingView, type ScorecardRow,
} from '@/lib/leader-meetings';
import { useMeetingSave, useMeetingWriter } from './meeting-writer';
import { MetricCard } from './scorecard';

/**
 * **A meeting's header on a phone, in the field shell** (UI V1, 2026-10-30; UI-110; `kpm-mobile` 4): the way back as a
 * *‹*, the meeting's title (20px, the page's `h1`) with *Sab, 31 Okt 2026 · Akan datang* under it — the date a button
 * for who may move it — and the reader's avatar on the right, as the coaching header has it; **Bagikan** and **PDF** as
 * small outlined buttons; the editors as one avatar row, *5 leader dapat mengubah notulen ini*.
 *
 * **No Simpan**: every field saves when it is left, with *Tersimpan* (`MeetingWriterProvider`); a write that failed or
 * met somebody else's says so under the buttons, as before.
 */
export function V1MeetingHead({
  meeting, onDetails, onShare, onPrint, titled = true,
}: {
  meeting: MeetingView;
  /**
   * The page's title row (`h1`, with the reader's avatar) — `/leader-meetings/[meetingId]`. `false` under a shell that
   * draws its own title row (the shared link's page): an `h2`, and no second avatar.
   */
  titled?: boolean;
  onDetails: () => void;
  onShare: () => void;
  onPrint: () => void;
}) {
  const t = useMessages(forumMessages);
  const figures = useFigureLanguage();
  const chrome = useFieldChrome();
  const { line } = useMeetingSave();
  const date = `${formatWeekday(meeting.date, figures)}, ${formatShortDay(meeting.date, { year: true }, figures)}`;
  const movable = meeting.can.reschedule || meeting.can.delete;
  const editors = editorsInOrder(meeting.editors);
  const OUTLINED = 'flex min-h-11 items-center gap-1.5 rounded-pill border border-line bg-card px-3 text-base font-semibold text-pill-grey-ink';

  return (
    <div className="print:hidden" data-v1-meeting-head="">
      <div className="flex min-h-12 items-center gap-1.5">
        {meeting.via === 'address' && (
          <Link href="/leader-meetings" className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-pill-grey-ink">
            <LineIcon name="chevronLeft" className="h-[22px] w-[22px]" />
            <span className="sr-only">{t.v1.allMeetings}</span>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {titled
            ? <h1 className="break-words font-display text-title font-extrabold leading-tight text-navy">{meeting.title}</h1>
            : <h2 className="break-words font-display text-title font-extrabold leading-tight text-navy">{meeting.title}</h2>}
          <p className="mt-px text-xs text-muted">
            {movable ? (
              <button
                type="button"
                onClick={onDetails}
                aria-label={`${t.changeDate({ title: meeting.title })}, ${date}`}
                className="underline decoration-dashed underline-offset-2"
              >
                {date}
              </button>
            ) : date}
            {' · '}{t.state[meeting.state]}
          </p>
        </div>
        {titled && chrome?.compact && <TitleAvatar chrome={chrome} />}
      </div>
      {(meeting.can.share || meeting.can.print) && (
        <div className="mt-2 flex gap-2">
          {meeting.can.share && (
            <button type="button" onClick={onShare} className={OUTLINED}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" />
              </svg>
              {t.share}
            </button>
          )}
          {meeting.can.print && (
            <button type="button" onClick={onPrint} className={OUTLINED} aria-label={t.savePdf}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
              </svg>
              {t.v1.pdf}
            </button>
          )}
        </div>
      )}
      {line && <p className="mt-1.5 text-xs font-semibold text-alert">{line}</p>}
      {editors.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 text-sm text-muted">
          <span className="flex" aria-hidden="true">
            {editors.map((person) => (
              <Avatar
                key={person.membershipId}
                name={person.name}
                photoUrl={person.photoUrl ?? null}
                seed={person.membershipId}
                size={26}
                className="-ml-[7px] border-2 border-base first:ml-0"
              />
            ))}
          </span>
          <span className="sr-only">{editors.map((p) => `${p.name} (${rungShort(p.rung)})`).join(', ')}: </span>
          {t.v1.editors({ n: editors.length })}
        </div>
      )}
    </div>
  );
}

/**
 * **The meeting's *Overview* on a phone** (UI-110; `kpm-mobile` 4): *BSD City Branch · Okt 2026* with *per 27 Okt*; the
 * branch as one strip — *28 Manpower · 19 Agents · 9 Units · 5 AB · 4 AAB*; *YTD 2026 vs 2025* over *Jan–Okt*; **one row
 * per metric**: its name (an ⓘ where it has a definition), *Okt x · Sep y* under it, the change as a green or red pill,
 * and YTD this year big on the right with *dari {last year}* under it. *FLC* reads a grey *Menunggu data*.
 *
 * **A row opens all of its figures**, its definition and — for who edits the minutes — its *Monthly Target*, in a
 * sheet (`MetricCard`): what the table and the cards show, so nothing the forum records is out of reach on a phone.
 */
export function V1Overview({ meeting }: { meeting: MeetingView }) {
  const t = useMessages(forumMessages);
  const figures = useFigureLanguage();
  const { scorecard } = meeting;
  const { periods, chips, asOf } = scorecard;
  const [open, setOpen] = useState<ScorecardRow['key'] | null>(null);
  const opened = scorecard.rows.find((r) => r.key === open) ?? null;
  const asOfDay = asOf.kind === 'date' ? formatShortDay(asOf.date, {}, figures) : asOf.kind === 'unrecorded' ? '—' : null;
  const strip = [
    [chips.manpower, t.v1.chips.manpower], [chips.agents, t.v1.chips.agents], [chips.units, t.v1.chips.units],
    [chips.ab, t.v1.chips.ab], [chips.aab, t.v1.chips.aab],
  ] as const;

  return (
    <div data-v1-overview-meeting="">
      <div className="mx-0.5 mb-2 mt-3 flex items-baseline justify-between gap-3">
        <h2 className="text-md font-bold text-navy">{`${meeting.branch} · ${formatMonth(meeting.date.slice(0, 7), figures)}`}</h2>
        {asOfDay && <span className="shrink-0 text-sm text-muted">{t.v1.asOf({ day: asOfDay })}</span>}
      </div>
      <dl className="grid grid-cols-5 gap-1.5 rounded-lg bg-card px-2 py-2.5 text-center">
        {strip.map(([value, label]) => (
          <div key={label} className="flex min-w-0 flex-col-reverse">
            <dt className="truncate text-xs text-muted">{label}</dt>
            <dd className="text-lg font-bold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mx-0.5 mb-2 mt-3.5 flex items-baseline justify-between gap-3">
        <h2 className="text-md font-bold text-navy">
          {t.v1.ytdHead({ year: periods.ytd.from.slice(0, 4), last: periods.ytdLastYear.from.slice(0, 4) })}
        </h2>
        <span className="shrink-0 text-sm text-muted">
          {`${formatMonthName(periods.ytd.from, figures)}–${formatMonthName(periods.ytd.to, figures)}`}
        </span>
      </div>
      <ul className="overflow-hidden rounded-lg bg-card">
        {scorecard.rows.map((row) => <MetricLine key={row.key} meeting={meeting} row={row} onOpen={() => setOpen(row.key)} />)}
      </ul>
      <ResponsiveSheet open={opened !== null} title={opened ? rowName(opened.key, figures) : ''} onClose={() => setOpen(null)}>
        {opened && <MetricSheet meeting={meeting} row={opened} />}
      </ResponsiveSheet>
    </div>
  );
}

const CHANGE_TONE = (row: ScorecardRow): PillTone | null => {
  if (row.ytdChange.kind !== 'figure') return null;
  return row.ytdChange.value > 0 ? 'green' : row.ytdChange.value < 0 ? 'red' : 'grey';
};

function MetricLine({ meeting, row, onOpen }: { meeting: MeetingView; row: ScorecardRow; onOpen: () => void }) {
  const t = useMessages(forumMessages);
  const words = useLanguage();
  const figures = useFigureLanguage();
  const { periods } = meeting.scorecard;
  const name = rowName(row.key, figures);
  const defined = footnotesIn(words).some((note) => note.rows.includes(row.key));
  const ytd = row.cells.ytd;
  const tone = CHANGE_TONE(row);
  const monthly = row.cells.thisMonth.kind !== 'blocked'
    ? `${formatMonthName(periods.thisMonth.to, figures)} ${cellText(row, row.cells.thisMonth, figures, words)}`
      + ` · ${formatMonthName(periods.lastMonth.to, figures)} ${cellText(row, row.cells.lastMonth, figures, words)}`
    : null;
  return (
    <li className="border-t border-divider first:border-t-0" data-metric={row.key}>
      <button type="button" onClick={onOpen} aria-label={t.v1.metricOpen({ name })} className="flex min-h-14 w-full items-center gap-2.5 px-3 py-2 text-left lg:hover:bg-hover-row">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-md font-bold text-ink">
            {name}
            {defined && <LineIcon name="info" className="h-3.5 w-3.5 text-signal-grey" />}
          </span>
          {monthly && <span className="mt-0.5 block text-sm text-muted">{monthly}</span>}
        </span>
        {ytd.kind === 'pending' ? (
          <TonePill tone="grey">{t.v1.waiting}</TonePill>
        ) : (
          <>
            {tone && <TonePill tone={tone}>{changeText(row.ytdChange, figures, words)}</TonePill>}
            <span className="shrink-0 whitespace-nowrap text-right text-lg font-bold text-ink">
              {ytd.kind === 'figure' ? cellText(row, ytd, figures, words) : noneWords(row, ytd, words)}
              {row.cells.ytdLastYear.kind === 'figure' && (
                <small className="block text-sm font-medium text-muted">
                  {t.v1.ofLast({ value: cellText(row, row.cells.ytdLastYear, figures, words) })}
                </small>
              )}
            </span>
          </>
        )}
      </button>
    </li>
  );
}

/** A metric whole: its definition, and the card the cards layout draws — every column and the target. */
function MetricSheet({ meeting, row }: { meeting: MeetingView; row: ScorecardRow }) {
  const words = useLanguage();
  const { readOnly } = useMeetingWriter();
  const note = footnotesIn(words).find((n) => n.rows.includes(row.key));
  return (
    <div>
      {note && <p className="mb-3 text-md text-muted">{note.text}</p>}
      <ul className={cn('[&>li]:border-0 [&>li]:bg-hover-row')}>
        <MetricCard meeting={meeting} row={row} mark={undefined} readOnly={readOnly} />
      </ul>
    </div>
  );
}
