'use client';

import { useId, useState } from 'react';
import { PersonRow } from '@/components/ui/person-row';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { cn } from '@/lib/cn';
import { StatTile } from '@/components/ui/stat-tile';
import {
  coachedWords, inTeam, RANKING_SHOWN, type LeaderboardRow, type OverviewCoaching,
} from '@/lib/kpm-overview';
import { useCan, useSession } from '@/lib/session';
import { Bar, FILL_TONE, OverviewPanel, PctPill, ShowAll, TEXT_TONE, useTone } from './parts';

/**
 * *Coaching coverage* (`KPM_Owner.html:1005-1047`): the office's `COACHING_COVERAGE` over 7 and 30 days, and *AB coaching
 * frequency* — **every AB**, `LEADER_COACHING_FREQUENCY` over the last 7 days, lowest first, as the server orders them
 * (D-coverage), and one who leads nobody last, ***No team*** where the rate would be (P18.9-T3 AC-5; ADR-0176 §2,
 * UI-017).
 *
 * *Changed 2026-11-05 (P19.2-T3 AC-5; the client's UI-143):* one card becomes three pieces of the page's grid — **the 7
 * days a stat tile in the first row, the ranking a list in the second, the 30 days a small card in the last** — as
 * `kpm-owner-mobile-2026-11-03` 1 and `kpm-owner-desktop-2026-11-03` 1 draw them. **Three are shown** (UI-143: *"3 rows
 * each"*), and *Semua n ›* opens the rest of the ranking in place (D-coverage) until Phase 19.3 links it to the full list.
 */
export function Coached7Tile({ coaching }: { coaching: OverviewCoaching }) {
  const t = useMessages(kpmOverviewMessages);
  const rate = coaching.coverage7d;
  const opens = useOpensCoaching();
  return (
    <StatTile
      label={t.coached7d}
      value={rate.count}
      unit={`/ ${rate.of}`}
      href={opens ? '/coaching' : undefined}
      // *Since P19.3-T2 (UI-148, `kpm-overview-*` 2: "11% · 30 hari: 9"):* the 30 days on the tile's line, where they
      // were a small card of the last row.
      sub={(
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <PctPill pct={rate.pct} size="sm" />
          <span className="text-xs">{t.coached30dShort({ n: coaching.coverage30d.count })}</span>
        </span>
      )}
    />
  );
}

/**
 * **Whether *Coached 7 hari* opens `/coaching`** (P19.3-T2 AC-1; UI-148): the page lists the reader's own coachees, so a
 * reader the server would give an empty page — an Admin who leads nobody — sees the tile without a ›. The Owner, the
 * office's root, always has it.
 */
function useOpensCoaching(): boolean {
  const can = useCan('coaching_session:read');
  const membership = useSession().me?.membership;
  return can && !!membership && (membership.isKpmOwner || (membership.directCount ?? 0) > 0);
}

/**
 * *AB coaching frequency*, a list in the second row: three, then *Semua n ›*. *Since P19.3-T2 (AC-1, AC-6; UI-148, D-08):*
 * **hidden while no AB leads anyone** (the page leaves it out), and each row opens that AB's member page.
 */
export function CoachingList({ coaching }: { coaching: OverviewCoaching }) {
  const t = useMessages(kpmOverviewMessages);
  const rows = coaching.leaderboard;
  const [all, setAll] = useState(false);
  const listId = useId();
  const shown = all ? rows : rows.slice(0, RANKING_SHOWN);
  return (
    <OverviewPanel
      title={t.leaderboard}
      action={rows.length > RANKING_SHOWN && (
        <ShowAll open={all} total={rows.length} controls={listId} onToggle={() => setAll((was) => !was)} />
      )}
    >
      {rows.length === 0
        ? <p className="text-base text-muted">{t.noLeaders}</p>
        : <ul id={listId}>{shown.map((row) => <LeaderRow key={row.membershipId} row={row} />)}</ul>}
    </OverviewPanel>
  );
}

/**
 * `.lb-row` (`:499-505`): the name and the team's size, the bar, and *"{c}/{n} · {p}%"* — the bar the picture
 * of the figure printed after it. On a phone the bar takes its own line under the name and the figure.
 *
 * **An AB who leads nobody** (P18.9-T3 AC-5): the name, and ***No team*** in the figure's place, muted — no
 * *"· 0 in team"*, and no bar, whose empty track would read as a team nobody coached.
 */
function LeaderRow({ row }: { row: LeaderboardRow }) {
  const language = useLanguage();
  const figures = useFigureLanguage();
  const toneFor = useTone();
  const tone = toneFor(row.pct);
  // P19.3-T2 AC-1 (UI-148, Overview case 7): the row opens that AB's member page — `kpm-overview-*` 2's person row, the
  // NAME, the team under it, the figure on the right with its bar, and a ›.
  return (
    <li className="border-b border-hairline last:border-b-0">
      <PersonRow
        name={row.name}
        seed={row.membershipId}
        href={`/people/members/${encodeURIComponent(row.membershipId)}`}
        chevron
        height={56}
        className="gap-2 rounded-none bg-transparent px-0"
        meta={row.leads ? <span>{inTeam(row.teamSize, language).replace(/^·\s*/, '')}</span> : undefined}
        trailing={(
          <span className="flex w-24 flex-col items-end gap-1">
            <span className={cn('text-base', row.leads ? cn('font-bold', TEXT_TONE[tone]) : 'font-semibold text-muted')}>
              {coachedWords(row, language, figures)}
            </span>
            {row.leads && (
              <Bar pct={row.pct ?? 0} fill={row.pct === null ? 'bg-transparent' : FILL_TONE[tone]} height="thin" className="w-full" />
            )}
          </span>
        )}
      />
    </li>
  );
}
