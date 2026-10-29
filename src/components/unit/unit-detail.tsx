'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChaseChips } from '@/components/campaigns/chasing-card';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { campaignChasingMessages } from '@/i18n/messages/campaign-chasing';
import type { ActivityRatio, ActivityRatios } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/format';
import { balanceSideNames, formatBalanceSplit } from '@/lib/ratio-balance';
import { formatRatioForStatus } from '@/lib/ratio-format';
import { countWords, gapWords, overdueTag, type UnitPeriod, type UnitRow } from '@/lib/unit-dashboard';

/** Reads a row's ratios — the screen's, which keeps each answer so a row opened twice is read once. */
export type ReadRatios = (row: UnitRow) => Promise<ActivityRatios>;

/**
 * The expanded detail (`Overall.html:7302-7355`, CSS `:1738-1785`): *Gap*, *Activity breakdown*, *Ratios*
 * and *Flagged follow-up (system-detected)*, four tiles on the warm base, one column on a phone.
 *
 * **The last tile** (`:7349-7352`): *Campaigns they're chasing* — 🚀 chips by title, or *"Not currently chasing
 * any campaigns."* (`:7278-7285`; P18.5-T7 AC-8, parity D-19) — with the follow-up beneath it (OD-140). Always
 * drawn, but for somebody whose chases the reader may not read (`campaigns: null`), where it holds the
 * follow-up alone, and is not drawn without one. *Team snapshot* is defined and never drawn by the
 * prototype, and not here either.
 *
 * **The ratios are read when the row opens** (D-ratios), the person's as `GET /activity/ratios?for=`
 * answers them — the office's ratios on their rung, its labels, the last 30 days — and the tile waits and
 * fails on its own, the rest of the detail drawn already from the roster's read.
 *
 * **Its words are the catalogue's** (`messages/unit-dashboard.ts`, P18.98-T4), its figures in `useFigureLanguage()`'s;
 * *Campaigns they're chasing* and its empty line are the campaigns' (`lib/campaigns.ts`).
 */
export function UnitDetail({
  row, period, readRatios, id,
}: { row: UnitRow; period: UnitPeriod; readRatios: ReadRatios; id: string }) {
  return (
    <tr>
      <td id={id} colSpan={8} className="border-b border-hairline bg-base p-0">
        <DetailTiles row={row} period={period} readRatios={readRatios} />
      </td>
    </tr>
  );
}

/**
 * **The detail's tiles, wherever they stand**: in the table's row beneath the person (`UnitDetail`), or inside the
 * person's card on a phone (P18.95-T3 AC-1). The same four, in the same order, from the same reads.
 *
 * **`stacked`, on a phone, puts each label above its value** (ADR-0167 §6; the client's UI review, UI-010: the
 * table-width panel left *"Leads contacted"* on screen and *"70/52"* off it): an activity's count under its name, a
 * ratio's value under its label, so a long one (*67% Selling · 33% Recruitment*) has the card's width to itself.
 */
export function DetailTiles({
  row, period, readRatios, stacked = false, className,
}: { row: UnitRow; period: UnitPeriod; readRatios: ReadRatios; stacked?: boolean; className?: string }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages);
  // *Campaigns they're chasing*: the campaigns' words (`campaign-chasing.ts`), in the reader's language.
  const chasing = useMessages(campaignChasingMessages);
  const gap = gapWords(row.goal, language, figures);
  return (
    <div className={className ?? 'grid grid-cols-1 gap-3.5 px-6 pb-[22px] pt-[18px] md:grid-cols-4'}>
      <Tile title={t.prototype.gap}>
        <p className="mb-1 font-body text-[1.0625rem] font-bold text-navy">{gap.value}</p>
        {gap.note && <p className="text-sm leading-normal text-muted">{gap.note}</p>}
      </Tile>
      <Tile title={t.prototype.activityBreakdown}>
        {(['leads', 'appointments', 'closings'] as const).map((key) => (
          <p key={key} className={stacked ? cn('mb-1.5 text-sm last:mb-0', STACKED) : 'mb-1.5 flex items-center justify-between text-sm last:mb-0'}>
            <span className="text-navy">{t.activity[key]}</span>
            <span className="font-bold text-navy">{countWords(row.activity[key], period, language)}</span>
          </p>
        ))}
      </Tile>
      {/* The ratios read is a subject read of the person: only somebody the reader coaches (or the
          reader) has one to give; an Owner's or an Admin's view of a unit outside their downline
          draws the rest of the detail without it. */}
      {(row.coached || row.isReader) && <RatiosTile row={row} readRatios={readRatios} stacked={stacked} />}
      {row.campaigns !== null ? (
        <Tile title={chasing.theyreChasing}>
          {row.campaigns.length > 0
            ? <ChaseChips campaigns={row.campaigns} />
            : <p className="text-sm italic text-muted">{chasing.notChasingAny}</p>}
          {row.followUp && (
            // `.detail-followup` (`:1763-1764`): beneath the chips, over a hairline.
            <div className="mt-2.5 border-t border-hairline pt-2.5">
              <h3 className="mb-1.5 text-2xs font-bold uppercase tracking-wide text-muted">{t.prototype.followUp}</h3>
              <FollowUpLine followUp={row.followUp} />
            </div>
          )}
        </Tile>
      ) : row.followUp && (
        <Tile title={t.prototype.followUp}>
          <FollowUpLine followUp={row.followUp} />
        </Tile>
      )}
    </div>
  );
}

/** A label above its value, on a phone (`stacked`): the value on its own line, wrapping inside the tile. */
const STACKED = 'flex flex-col gap-0.5';

/** The follow-up's line (`.detail-followup-item`, `:1765-1768`): its date or how overdue, and the item. */
function FollowUpLine({ followUp }: { followUp: NonNullable<UnitRow['followUp']> }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  return (
    <p className="text-base text-navy">
      {followUp.overdueDays !== null ? (
        <span className="mr-1.5 inline-block rounded-pill bg-alert/10 px-2 py-0.5 text-2xs font-bold text-alert">
          {overdueTag(followUp.overdueDays, language)}
        </span>
      ) : followUp.dueDate && (
        <span className="mr-1.5 inline-block rounded-pill bg-navy/[0.06] px-2 py-0.5 text-2xs font-bold text-muted">
          {formatShortDay(followUp.dueDate, {}, figures)}
        </span>
      )}
      {followUp.text}
    </p>
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
function RatioChip({ ratio, stacked = false }: { ratio: ActivityRatio; stacked?: boolean }) {
  const words = useLanguage();
  const figures = useFigureLanguage();
  const t = useMessages(unitDashboardMessages).prototype;
  let value: string;
  let tone = RATIO_TONE[ratio.status];
  const band = ratio.comparison === 'band';
  if (ratio.value === null) {
    value = '–';
  } else if (band && ratio.sides && ratio.share !== null) {
    // A side's name is the office's section, as typed; *Side A* and *Side B* are the catalogue's.
    const names = balanceSideNames(ratio.sides, words);
    if (ratio.denominatorCount === 0 && ratio.numeratorCount > 0 && SELLING.test(names.first)) {
      value = t.salesOnly;
      tone = RATIO_TONE.neutral;
    } else {
      const split = formatBalanceSplit(ratio.share, ratio.benchmark, ratio.status, figures);
      value = `${split.first} ${names.first} · ${split.second} ${names.second}`;
    }
  } else {
    value = formatRatioForStatus(ratio.value, band ? 'points' : ratio.displayUnit, ratio.benchmark, ratio.status, figures, words);
  }
  return (
    <li className={stacked ? cn('text-sm', STACKED) : 'flex items-center justify-between gap-2 text-sm'}>
      <span className="min-w-0 text-navy">{ratio.label}</span>
      <span className={cn(!stacked && 'whitespace-nowrap', 'font-bold', tone)}>{value}</span>
    </li>
  );
}

function RatiosTile({ row, readRatios, stacked }: { row: UnitRow; readRatios: ReadRatios; stacked: boolean }) {
  const t = useMessages(unitDashboardMessages);
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
    <Tile title={t.prototype.ratios}>
      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-2 h-auto px-3 py-1.5 text-sm" onClick={() => setAttempt((n) => n + 1)}>
            {t.own.tryAgain}
          </Button>
        </div>
      )}
      {!ratios && !error && (
        <Skeleton label={t.own.loadingRatios}>
          {[0, 1, 2, 3].map((i) => <SkeletonBar key={i} className="mb-2 h-3.5 w-full" />)}
        </Skeleton>
      )}
      {ratios && (ratios.ratios.length === 0 ? (
        <p className="text-sm text-navy">{t.own.ratiosEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ratios.ratios.map((ratio) => <RatioChip key={ratio.code} ratio={ratio} stacked={stacked} />)}
        </ul>
      ))}
    </Tile>
  );
}
