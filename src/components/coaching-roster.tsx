'use client';

import { useId, type ReactNode } from 'react';
import { PersonRow, TreeIndent, TreeNode } from '@/components/ui/person-row';
import { shortOfRung, useLadder } from '@/components/ui/role-badge';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { cn } from '@/lib/cn';
import {
  coachingSessionHref, firstName, lastOneOnOneLine, rosterStatusLabel,
  type Roster, type RosterRow, type RosterStatus,
} from '@/lib/coaching';

/**
 * **The roster: one row per person, at every size** (UI V1, UI-033, UI-034; D-09, D-23, D-27).
 *
 * - **A 60px row** (`PersonRow`): the avatar, the NAME in capitals, and **the whole row opens their *Coaching Session***
 *   with a › — no orange *Coaching →* per row (UI-034).
 * - **Below 768px** the row's line is *1 hari lalu · oleh Agus*: *Last 1:1* and the first name of who held it, 12px
 *   grey — *Belum ada 1:1* grey too, never red; **red only for *terlambat***, which the words say as well (P18.8-T15
 *   AC-7). Then the status pill and the ›. **From 768px** the same facts in columns under a 40px header — *Nama · 1:1
 *   terakhir · Terakhir di-coaching oleh · Status* — every word 12px or more.
 * - **Groups under 36px bands**: *Agen langsung Anda · 3*, then *AAB units*, each AAB's people **as a tree** at every
 *   size (`TreeIndent`, the Group Tree's and New Hires'): indented 36px, a grey line down from the AAB, an elbow into
 *   each — the subtree as the server sends it, a nested AAB's people a level further in. No *↳*.
 * - **The status pill** is `GOAL_PACE_STATUS` in UI-005's tones — green *Sesuai target*, amber *Perlu dipantau*, red
 *   *Perlu perhatian*, grey *Goal belum diatur* — a tinted pill, never a dot.
 *
 * Everyone the reader coaches, which is their whole downline (ADR-0074): the server decides who. *Last 1:1* and the
 * status are the server's, worked out in the office's day; nothing here counts days.
 */

/** `GOAL_PACE_STATUS` as UI-005's pill tones. */
const TONE = {
  on_track: 'green',
  watch_closely: 'amber',
  needs_attention: 'red',
  no_goal_set: 'grey',
} as const satisfies Record<RosterStatus, PillTone>;

/** The columns from 768px: their widths, so the header and every row line up (UI-034). */
const COL = {
  last: 'md:w-[132px] lg:w-[184px]',
  coach: 'md:w-[132px] lg:w-[184px]',
  status: 'md:w-[132px] lg:w-[150px]',
} as const;

/** A 60px row's elbow, at the middle of its avatar (`TreeNode`'s `--elbow`). */
const ELBOW_60 = '[--elbow:1.875rem]';

/** One person and the people under them, as the flat subtree the server sends (`depth`) nests. */
interface Branch {
  row: RosterRow;
  children: Branch[];
}

/**
 * **The subtree as a tree**: each row's children are the rows after it that sit deeper, up to the next row that does
 * not. The server sends a unit depth-first, so this is its order kept, nested.
 */
export function branchesOf(rows: readonly RosterRow[]): Branch[] {
  const out: Branch[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    let j = i + 1;
    while (j < rows.length && rows[j].depth > row.depth) j += 1;
    out.push({ row, children: branchesOf(rows.slice(i + 1, j)) });
    i = j;
  }
  return out;
}

export function CoachingRoster({ roster }: { roster: Roster }) {
  const t = useMessages(coachingMessages).roster;
  // The junior rung: a member on any other rung heads a unit of their own, nested or not, and carries its badge.
  const ladder = useLadder();
  const agentRung = [...ladder].sort((a, b) => a.displayOrder - b.displayOrder)[0]?.code;
  const badged = (row: RosterRow) => agentRung !== undefined && row.rung.code.toUpperCase() !== agentRung.toUpperCase();
  const { directAgents, units } = roster;
  const directId = useId();
  const unitsId = useId();

  return (
    <div data-roster="" className="overflow-hidden rounded-lg border border-card-edge bg-card">
      <h2 className="sr-only">{t.caption}</h2>
      {/* The columns' header from 768px (UI-034): drawn for the eye; each row's cells say what they are. */}
      <div
        aria-hidden="true"
        className="flex h-10 items-center gap-3 bg-hover-row px-3 text-xs font-semibold text-muted max-md:hidden"
      >
        <span className="min-w-0 flex-1 pl-12">{t.columns.name}</span>
        <span className={cn('shrink-0', COL.last)}>{t.columns.last}</span>
        <span className={cn('shrink-0', COL.coach)}>{t.columns.coachedBy}</span>
        <span className={cn('shrink-0', COL.status)}>{t.columns.status}</span>
        <span className="w-5 shrink-0" />
      </div>

      {directAgents.length > 0 && (
        <section aria-labelledby={directId}>
          <GroupBand id={directId} label={t.directAgents} count={directAgents.length} />
          <ul role="list" className="divide-y divide-divider">
            {directAgents.map((row) => (
              <li key={row.membershipId}><RosterPerson row={row} badged={badged(row)} /></li>
            ))}
          </ul>
        </section>
      )}

      {units.length > 0 && (
        <section aria-labelledby={unitsId}>
          <GroupBand id={unitsId} label={t.aabUnits} />
          <ul role="list" className="divide-y divide-divider">
            {units.map((unit) => (
              <li key={unit.head.membershipId}>
                <RosterPerson row={unit.head} badged />
                <Branches branches={branchesOf(unit.members)} label={t.unitOf({ name: unit.head.name })} badged={badged} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * A leader's people, one level in, each with their own beneath them. The line drops from the leader's avatar — 30px in
 * on a head's row (its 12px padding and half the avatar), 18px on a child's, which has no padding — and each child's
 * avatar starts 36px right of its leader's (UI-033).
 */
function Branches({
  branches, label, badged, nested = false,
}: { branches: readonly Branch[]; label: string; badged: (row: RosterRow) => boolean; nested?: boolean }) {
  const t = useMessages(coachingMessages).roster;
  if (branches.length === 0) return null;
  return (
    <TreeIndent label={label} className={cn('mt-0 gap-0 pl-[19px]', nested ? 'ml-[17px]' : 'mb-1.5 ml-[29px]')}>
      {branches.map(({ row, children }) => (
        <TreeNode key={row.membershipId} className={ELBOW_60}>
          <RosterPerson row={row} badged={badged(row)} className="pl-0" />
          <Branches branches={children} label={t.unitOf({ name: row.name })} badged={badged} nested />
        </TreeNode>
      ))}
    </TreeIndent>
  );
}

/** A group's 36px band, its heading: *Agen langsung Anda · 3*. */
function GroupBand({ id, label, count }: { id: string; label: string; count?: number }) {
  return (
    <h3 id={id} className="flex min-h-9 items-center border-t border-divider bg-hover-row px-3.5 text-base font-bold text-navy">
      {label}
      {count !== undefined && <span className="ml-1 font-semibold text-muted">· {count}</span>}
    </h3>
  );
}

/**
 * One person: the row opens their *Coaching Session* (`coachingSessionHref`). Below 768px *Last 1:1* and who held it
 * are the row's line; from 768px they are its columns.
 */
function RosterPerson({ row, badged, className }: { row: RosterRow; badged: boolean; className?: string }) {
  const language = useLanguage();
  const t = useMessages(coachingMessages).roster;
  const last = row.lastOneOnOne;
  const late = last?.overdue ?? false;
  const when = lastOneOnOneLine(last, language);
  const status: ReactNode = <TonePill tone={TONE[row.status]}>{rosterStatusLabel(row.status, language)}</TonePill>;

  return (
    <PersonRow
      name={row.name}
      photoUrl={row.photoUrl ?? null}
      seed={row.membershipId}
      href={coachingSessionHref(row.membershipId)}
      chevron
      height={60}
      className={cn('rounded-none', className)}
      nameClassName="text-md md:max-lg:text-md"
      badge={badged ? <TonePill tone="grey" className="px-1.5 py-0 leading-[18px]">{shortOfRung(row.rung)}</TonePill> : undefined}
      meta={(
        // The phone's line (UI-033): *1 hari lalu · oleh Agus*, red only when late.
        <span data-roster-line="" className={cn('truncate md:hidden', late ? 'text-signal-red' : 'text-signal-grey')}>
          {when}
          {last?.coach && <> · {t.by({ name: firstName(last.coach.name) })}</>}
        </span>
      )}
      trailing={(
        <>
          <span className={cn('shrink-0 text-base max-md:hidden', COL.last, late ? 'text-signal-red' : 'text-signal-grey')}>
            {when}
          </span>
          <span className={cn('shrink-0 truncate text-base text-ink max-md:hidden', COL.coach)}>
            <span className="sr-only">{t.columns.coachedBy}: </span>
            {last?.coach?.name ?? '—'}
          </span>
          <span className={cn('shrink-0', COL.status)}>{status}</span>
        </>
      )}
    />
  );
}
