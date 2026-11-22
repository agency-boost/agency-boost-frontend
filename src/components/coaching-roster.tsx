'use client';

import { useId, useState } from 'react';
import { MemberContactButtons } from '@/components/contact-buttons';
import { Avatar } from '@/components/ui/avatar';
import { LineIcon } from '@/components/ui/line-icon';
import { PersonRow } from '@/components/ui/person-row';
import { RungTag, useIsLeaderRung } from '@/components/ui/rung-tag';
import { CoachingStatusTile } from '@/components/unit/coaching-status-tile';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { unitDashboardMessages } from '@/i18n/messages/unit-dashboard';
import { coachingSessionHref, firstName, type Roster, type RosterLeader, type RosterRow, type RosterSection } from '@/lib/coaching';
import { formatNumber } from '@/lib/format';
import { useCan } from '@/lib/session';

/**
 * **The coaching roster, grouped by unit** (P19.18-T5 AC-1, AC-2; ADR-0271 §9; the brief's part B, gap 2;
 * `coaching-owner-mobile` frames 1–3) — every reader's, the KPM Owner's being the whole office (OD-394: an AB's too).
 *
 * - **The card's head**: ***Semua orang · 30*** — everybody on the roster, the reader included — and on its right *1:1
 *   terakhir*, the column the tiles answer.
 * - **One orange line per unit**: the leader's photo, *Unit Anda* / *Unit AGUS PRASETYO* / *Belum punya leader*, *n orang*
 *   and a ⌄ that opens and closes it — every unit open at first. **An AB below the Owner is a unit of their own, never
 *   called AAB** (the label is their rung's own).
 * - **Team lines**: each team inside a unit — an AAB with people — gets a line built like the unit's, the same tint, the
 *   team leader's photo and *n orang*; never a folder to open.
 * - **A person**: photo (initials without one), the orange **AB / AAB label** before the NAME in capitals (the naming
 *   rule; agents none), the **coaching status tile** — red *Belum pernah coaching*, green *Coaching n hari lalu* up to 14
 *   days, yellow after (`COACHING_STATUS`, the server's) — and under it ***oleh {COACH}***; WhatsApp; ›. **The whole row
 *   opens their *Coaching Session*** where the reader coaches them (`opens`); the reader's own row (*ANDA (WILSON)*) opens
 *   *Catatan coaching saya*; a row of the whole office outside the reader's own downline opens nothing.
 * - **WhatsApp**: `MemberContactButtons`' rule — straight to WhatsApp with a number; *Isi nomor WhatsApp* for a reader who
 *   may save one (`member:update_phone`); nothing on the reader's own row, nor for a reader who may not save a missing one.
 *
 * Phone, tablet and laptop draw the same rows, the same order, in one column; the server decides who and every verdict.
 * *Changed 2026-11-20 (P19.18-T5): the rows were grouped as *Agen langsung Anda* and *Unit AAB* — the Owner's ABs under
 * *Unit AAB* — with the 1:1's line and the `GOAL_PACE_STATUS` pill per row, and columns from 1024px.*
 */
export function CoachingRoster({ roster }: { roster: Roster; tablet?: boolean }) {
  const t = useMessages(coachingMessages).roster;
  const figures = useFigureLanguage();
  const headingId = useId();
  // Every unit open at first; a tap closes one (`coaching-owner-mobile`).
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) => setClosed((now) => {
    const next = new Set(now);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <section data-roster="" aria-labelledby={headingId} className="overflow-hidden rounded-lg border border-card-edge bg-card">
      <div className="flex min-h-12 items-center justify-between gap-3 px-3.5">
        <h2 id={headingId} className="text-md font-bold text-ink">
          {t.everyone}
          <span className="ml-1 font-semibold text-muted">· {formatNumber(roster.total, {}, figures)}</span>
        </h2>
        {/* The column the tiles answer, for the eye; each tile says it in words. */}
        <span aria-hidden="true" className="text-sm text-muted">{t.columns.last}</span>
      </div>
      {roster.sections.map((section) => (
        <SectionBlock
          key={section.key}
          section={section}
          open={!closed.has(section.key)}
          onToggle={() => toggle(section.key)}
        />
      ))}
    </section>
  );
}

/** A unit line's words: *Unit Anda*, *Unit AGUS PRASETYO*, *Belum punya leader*. */
function useUnitLabel() {
  const t = useMessages(coachingMessages).roster;
  return (section: Pick<RosterSection, 'kind' | 'leader'>) => (section.kind === 'own'
    ? t.yourUnit
    : section.leader === null ? t.unled : t.unitOf({ name: section.leader.name.toUpperCase() }));
}

/** One unit: its orange line, a toggle, then its people and its team lines. */
function SectionBlock({ section, open, onToggle }: { section: RosterSection; open: boolean; onToggle: () => void }) {
  const t = useMessages(coachingMessages).roster;
  const label = useUnitLabel()(section);
  const bodyId = useId();
  return (
    <section data-roster-section={section.kind} aria-label={label}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-2.5 border-t border-divider bg-primary/[0.12] px-3.5 py-1.5 text-left"
        >
          {section.leader && <LeaderAvatar leader={section.leader} />}
          <span data-unit-label="" className="min-w-0 flex-1 truncate text-md font-bold text-ink">{label}</span>
          <span className="shrink-0 text-sm font-semibold text-muted">{t.people({ n: section.count })}</span>
          <LineIcon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 shrink-0 text-signal-grey" />
        </button>
      </h3>
      {open && (
        <div id={bodyId}>
          <ul role="list" className="divide-y divide-divider border-t border-divider">
            {section.rows.map((row) => <li key={row.membershipId}><RosterPerson row={row} /></li>)}
          </ul>
          {section.teams.map((team) => {
            const teamLabel = t.unitOf({ name: team.leader.name.toUpperCase() });
            return (
              <div key={team.key} data-roster-team={team.key}>
                {/* A team line, built like the unit's — never a folder to open (AC-2). */}
                <h4 className="flex min-h-12 items-center gap-2.5 border-t border-divider bg-primary/[0.12] py-1.5 pl-8 pr-3.5">
                  <LeaderAvatar leader={team.leader} />
                  <span className="min-w-0 flex-1 truncate text-base font-bold text-ink">{teamLabel}</span>
                  <span className="shrink-0 text-sm font-semibold text-muted">{t.people({ n: team.count })}</span>
                </h4>
                <ul role="list" aria-label={teamLabel} className="divide-y divide-divider border-t border-divider">
                  {team.rows.map((row) => <li key={row.membershipId}><RosterPerson row={row} /></li>)}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** The leader's photo on a unit line or a team line, initials without one. */
function LeaderAvatar({ leader }: { leader: RosterLeader }) {
  return <Avatar name={leader.name} photoUrl={leader.photoUrl} seed={leader.membershipId} size={28} />;
}

/**
 * One person: the row opens their *Coaching Session* where the reader coaches them, *Catatan coaching saya* on the
 * reader's own row, nothing otherwise. The status tile, *oleh {COACH}* under it, WhatsApp, ›.
 */
function RosterPerson({ row }: { row: RosterRow }) {
  const u = useMessages(unitDashboardMessages);
  const isLeader = useIsLeaderRung();
  const canSavePhone = useCan('member:update_phone');
  const [saved, setSaved] = useState<string | null>(null);
  const href = row.isReader ? '/coaching/me' : row.opens ? coachingSessionHref(row.membershipId) : undefined;
  const name = row.isReader ? u.you({ first: firstName(row.name) }) : row.name;
  const phone = saved ?? row.phone;
  const whatsApp = !row.isReader && (canSavePhone || phone) ? (
    // A 36px circle; its 44px target reaches 4px into the gap either side.
    <span data-roster-whatsapp="" className="-mx-1 flex">
      <MemberContactButtons
        membershipId={row.membershipId}
        name={row.name}
        phone={phone}
        channels={['whatsapp']}
        size={36}
        onSaved={setSaved}
      />
    </span>
  ) : <span aria-hidden="true" className="w-9 shrink-0" />;
  return (
    <PersonRow
      name={name}
      // The reader's row is labelled *Anda (WILSON)*; their initials are their own name's, never *A(*.
      avatarName={row.name}
      photoUrl={row.photoUrl ?? null}
      seed={row.membershipId}
      href={href}
      chevron={href !== undefined}
      height={60}
      className="rounded-none py-2"
      nameClassName="text-md md:max-lg:text-md"
      // The orange AB / AAB label before the NAME (the naming rule); an agent's row none (UX-16).
      tag={isLeader(row.rung) ? <RungTag rung={row.rung} className="mr-1.5" /> : undefined}
      meta={(
        <span data-roster-line="" className="flex min-w-0 flex-col items-start gap-1">
          <CoachingStatusTile status={row.coaching.status} days={row.coaching.days} />
          {row.coaching.coach && (
            <span className="min-w-0 truncate text-sm text-signal-grey">
              {u.coachingStatus.by({ name: row.coaching.coach.name.toUpperCase() })}
            </span>
          )}
        </span>
      )}
      trailing={whatsApp}
    />
  );
}
