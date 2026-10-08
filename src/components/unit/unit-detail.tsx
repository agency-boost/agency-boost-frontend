'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import type { ActivityRatio, ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import { balanceSideNames, formatBalanceSplit } from '@/lib/ratio-balance';
import { formatRatioForStatus } from '@/lib/ratio-format';
import {
  ACTIVITY_LABEL, countWords, gapWords, OWN_COPY, overdueTag, PROTOTYPE_COPY, type UnitPeriod, type UnitRow,
} from '@/lib/unit-dashboard';

/** Reads a row's ratios — the screen's, which keeps each answer so a row opened twice is read once. */
export type ReadRatios = (row: UnitRow) => Promise<ActivityRatios>;

/**
 * The expanded detail (`Overall.html:7302-7355`, CSS `:1738-1785`): *Gap*, *Activity breakdown*, *Ratios*
 * and *Flagged follow-up (system-detected)*, four tiles on the warm base, one column on a phone.
 *
 * **No campaigns part** (`:7278-7285`): campaigns come last, so its tile holds only the follow-up, and is
 * not drawn when there is none (OD-140). *Team snapshot* is defined and never drawn by the prototype, and
 * not here either.
 *
 * **The ratios are read when the row opens** (D-ratios), the person's as `GET /activity/ratios?for=`
 * answers them — the office's ratios on their rung, its labels, the last 30 days — and the tile waits and
 * fails on its own, the rest of the detail drawn already from the roster's read.
 */
export function UnitDetail({
  row, period, readRatios, id,
}: { row: UnitRow; period: UnitPeriod; readRatios: ReadRatios; id: string }) {
  const gap = gapWords(row.goal);
  return (
    <tr>
      <td id={id} colSpan={7} className="border-b border-hairline bg-base p-0">
        <div className="grid grid-cols-1 gap-3.5 px-6 pb-[22px] pt-[18px] md:grid-cols-4">
          <Tile title={PROTOTYPE_COPY.gap}>
            <p className="mb-1 font-body text-[1.0625rem] font-bold text-navy">{gap.value}</p>
            {gap.note && <p className="text-sm leading-normal text-muted">{gap.note}</p>}
          </Tile>
          <Tile title={PROTOTYPE_COPY.activityBreakdown}>
            {(['leads', 'appointments', 'closings'] as const).map((key) => (
              <p key={key} className="mb-1.5 flex items-center justify-between text-sm last:mb-0">
                <span className="text-navy">{ACTIVITY_LABEL[key]}</span>
                <span className="font-bold text-navy">{countWords(row.activity[key], period)}</span>
              </p>
            ))}
          </Tile>
          {/* The ratios read is a subject read of the person: only somebody the reader coaches (or the
              reader) has one to give; an Owner's or an Admin's view of a unit outside their downline
              draws the rest of the detail without it. */}
          {(row.coached || row.isReader) && <RatiosTile row={row} readRatios={readRatios} />}
          {row.followUp && (
            <Tile title={PROTOTYPE_COPY.followUp}>
              <p className="text-base text-navy">
                {row.followUp.overdueDays !== null ? (
                  <span className="mr-1.5 inline-block rounded-pill bg-alert/10 px-2 py-0.5 text-2xs font-bold text-alert">
                    {overdueTag(row.followUp.overdueDays)}
                  </span>
                ) : row.followUp.dueDate && (
                  <span className="mr-1.5 inline-block rounded-pill bg-navy/[0.06] px-2 py-0.5 text-2xs font-bold text-muted">
                    {formatShortDay(row.followUp.dueDate)}
                  </span>
                )}
                {row.followUp.text}
              </p>
            </Tile>
          )}
        </div>
      </td>
    </tr>
  );
}

/** `.detail-tile` (`:1742-1743`): a card on the warm base, its title in small capitals. */
function Tile({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-hairline bg-card px-3.5 py-3">
      <h3 className="mb-[9px] text-2xs font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

const RATIO_TONE: Record<ActivityRatio['status'], string> = {
  success: 'text-success',
  alert: 'text-alert',
  neutral: 'text-muted',
};

/** A balance whose activity is all on its selling side: the prototype's *Sales-only* (`:7311`). */
const SELLING = /^(sell|sales)/i;

/**
 * One ratio as the prototype's chip draws it (`.ratio-chip`, `:1750-1756`): its name, and its value in the
 * colour of its verdict, *–* without data. A balance is each side's share of the two, as the coachee's
 * own card and the coaching session write it (P13.1-T6); **all of it on the selling side is *Sales-only***,
 * the prototype's words for somebody with no recruitment.
 */
function RatioChip({ ratio }: { ratio: ActivityRatio }) {
  let value: string;
  let tone = RATIO_TONE[ratio.status];
  const band = ratio.comparison === 'band';
  if (ratio.value === null) {
    value = '–';
  } else if (band && ratio.sides && ratio.share !== null) {
    const names = balanceSideNames(ratio.sides);
    if (ratio.denominatorCount === 0 && ratio.numeratorCount > 0 && SELLING.test(names.first)) {
      value = PROTOTYPE_COPY.salesOnly;
      tone = RATIO_TONE.neutral;
    } else {
      const split = formatBalanceSplit(ratio.share, ratio.benchmark, ratio.status);
      value = `${split.first} ${names.first} · ${split.second} ${names.second}`;
    }
  } else {
    value = formatRatioForStatus(ratio.value, band ? 'points' : ratio.displayUnit, ratio.benchmark, ratio.status);
  }
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="min-w-0 text-navy">{ratio.label}</span>
      <span className={cn('whitespace-nowrap font-bold', tone)}>{value}</span>
    </li>
  );
}

function RatiosTile({ row, readRatios }: { row: UnitRow; readRatios: ReadRatios }) {
  const [ratios, setRatios] = useState<ActivityRatios | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readRatios(row)
      .then((next) => { if (live) setRatios(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [row, readRatios, attempt]);

  return (
    <Tile title={PROTOTYPE_COPY.ratios}>
      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-2 h-auto px-3 py-1.5 text-sm" onClick={() => setAttempt((n) => n + 1)}>
            {OWN_COPY.tryAgain}
          </Button>
        </div>
      )}
      {!ratios && !error && (
        <Skeleton label={OWN_COPY.loadingRatios}>
          {[0, 1, 2, 3].map((i) => <SkeletonBar key={i} className="mb-2 h-3.5 w-full" />)}
        </Skeleton>
      )}
      {ratios && (ratios.ratios.length === 0 ? (
        <p className="text-sm text-navy">{OWN_COPY.ratiosEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ratios.ratios.map((ratio) => <RatioChip key={ratio.code} ratio={ratio} />)}
        </ul>
      ))}
    </Tile>
  );
}
