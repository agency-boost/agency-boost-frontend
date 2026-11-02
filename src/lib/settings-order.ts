/**
 * **A settings list of dated things, in the order it is read** (P18.97-T4 AC-8, ADR-0176 §8; the client's KPM Owner
 * review of 2026-10-27, UI-030: *"past events first, upcoming at the bottom"* on `/kpm/settings/events`, *"UPCOMING,
 * RUNNING, ENDED mixed"* on `/kpm/settings/campaigns`). **Upcoming, then running, then ended**, each group by date:
 * upcoming and running soonest first, ended latest first — the order the agents' own Events list reads its sections
 * in (`sections`, `lib/events.ts`). An event's *past* is a campaign's *ended*. The phase is the server's, worked out on
 * every read; this only orders what it said, and a title breaks a tie.
 */
export type DatedPhase = 'upcoming' | 'running' | 'ended' | 'past';

const RANK: Record<DatedPhase, number> = { upcoming: 0, running: 1, ended: 2, past: 2 };

export function byPhaseAndDate<T extends { phase: DatedPhase; startsAt: string; title: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => RANK[a.phase] - RANK[b.phase]
    || (RANK[a.phase] === 2 ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt))
    || a.title.localeCompare(b.title));
}
