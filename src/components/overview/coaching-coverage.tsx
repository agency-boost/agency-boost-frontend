'use client';

import { useId, useState } from 'react';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import {
  coachedWords, inTeam, RANKING_SHOWN, showingWords,
  type LeaderboardRow, type OverviewCoaching, type OverviewRate,
} from '@/lib/kpm-overview';
import { Bar, FILL_TONE, OverviewCard, PctPill, TEXT_TONE, useTone } from './parts';

/**
 * *Coaching coverage* (`KPM_Owner.html:1005-1047`, CSS `:487-513`): the office's `COACHING_COVERAGE` over 7
 * and 30 days beside *AB coaching frequency* — **every AB**, `LEADER_COACHING_FREQUENCY` over the last 7 days, lowest
 * first, as the server orders them (D-coverage), and one who leads nobody last, ***No team*** where the rate would be
 * (P18.97-T3 AC-5; ADR-0176 §2, UI-017). The two sit side by side, and one above the other below 760px.
 *
 * **Four are shown and *view full ranking →* expands the same card in place** (D-coverage): no other screen
 * holds the ranking, so the prototype's dead link becomes a button that says whether it is open.
 */
export function CoachingCoverage({ coaching }: { coaching: OverviewCoaching }) {
  const t = useMessages(kpmOverviewMessages);
  return (
    <OverviewCard className="flex flex-col gap-7 p-5 md:flex-row md:items-start">
      <div className="flex flex-col gap-3.5 md:w-[200px] md:flex-none">
        <CoverageFigure label={t.coached7d} rate={coaching.coverage7d} primary />
        <CoverageFigure label={t.coached30d} rate={coaching.coverage30d} />
      </div>
      <div className="min-w-0 flex-1 border-t border-hairline pt-3.5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
        <h3 className="mb-3 text-base font-bold text-navy">{t.leaderboard}</h3>
        <Leaderboard rows={coaching.leaderboard} />
      </div>
    </OverviewCard>
  );
}

/** `.coaching-figure` (`:490-496`): a label, the count over its denominator, and the pill. */
function CoverageFigure({ label, rate, primary = false }: { label: string; rate: OverviewRate; primary?: boolean }) {
  return (
    <div className="rounded-[10px] border border-hairline bg-base px-3.5 py-3">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className="flex flex-wrap items-baseline gap-x-[7px]">
        <span className={cn('font-body font-bold text-navy', primary ? 'text-2xl' : 'text-xl')}>{rate.count}</span>
        <span className="text-sm text-muted">/ {rate.of}</span>
        <PctPill pct={rate.pct} size="sm" />
      </p>
    </div>
  );
}

function Leaderboard({ rows }: { rows: LeaderboardRow[] }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const [all, setAll] = useState(false);
  const listId = useId();
  if (rows.length === 0) return <p className="text-base text-muted">{t.noLeaders}</p>;
  const shown = all ? rows : rows.slice(0, RANKING_SHOWN);

  return (
    <>
      <ul id={listId}>
        {shown.map((row) => <LeaderRow key={row.membershipId} row={row} />)}
      </ul>
      {rows.length > RANKING_SHOWN && (
        <p className="mt-2.5 text-sm text-muted">
          {showingWords(shown.length, rows.length, language)}
          <button
            type="button"
            aria-expanded={all}
            aria-controls={listId}
            onClick={() => setAll((was) => !was)}
            className="font-semibold text-amber-ink underline-offset-2 hover:underline"
          >
            {all ? t.showFewer : t.viewFullRanking}
          </button>
        </p>
      )}
    </>
  );
}

/**
 * `.lb-row` (`:499-505`): the name and the team's size, the bar, and *"{c}/{n} · {p}%"* — the bar the picture
 * of the figure printed after it. On a phone the bar takes its own line under the name and the figure.
 *
 * **An AB who leads nobody** (P18.97-T3 AC-5): the name, and ***No team*** in the figure's place, muted — no
 * *"· 0 in team"*, and no bar, whose empty track would read as a team nobody coached.
 */
function LeaderRow({ row }: { row: LeaderboardRow }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const toneFor = useTone();
  const tone = toneFor(row.pct);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-b border-hairline py-2 last:border-b-0 sm:grid-cols-[1.4fr_1fr_90px]">
      <span className="min-w-0 text-md font-semibold text-navy">
        {row.name}
        {row.leads && <> <span className="text-xs font-normal text-muted">{inTeam(row.teamSize, language)}</span></>}
      </span>
      {row.leads ? (
        <Bar
          pct={row.pct ?? 0}
          fill={row.pct === null ? 'bg-transparent' : FILL_TONE[tone]}
          height="thin"
          className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto"
        />
      ) : (
        <span aria-hidden="true" className="hidden sm:block" />
      )}
      <span
        className={cn(
          'col-start-2 row-start-1 text-right text-base sm:col-start-auto sm:row-start-auto',
          row.leads ? cn('font-bold', TEXT_TONE[tone]) : 'font-semibold text-muted',
        )}
      >
        {coachedWords(row, language, figures)}
      </span>
    </li>
  );
}
