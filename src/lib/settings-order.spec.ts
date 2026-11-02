import { describe, expect, it } from 'vitest';
import { byPhaseAndDate, type DatedPhase } from './settings-order';

const row = (title: string, phase: DatedPhase, startsAt: string) => ({ title, phase, startsAt });

/** P18.97-T4 AC-8 (ADR-0176 §8; UI-030): upcoming, then running, then ended, each group by date. */
describe('P18.97-T4 AC-8 byPhaseAndDate', () => {
  it('P18.97-T4 AC-8 reads upcoming soonest first, then running soonest first, then ended latest first', () => {
    const rows = [
      row('Bootcamp', 'past', '2026-09-08T02:00:00.000Z'),
      row('Kick-off', 'upcoming', '2026-11-20T02:00:00.000Z'),
      row('Awards night', 'past', '2026-10-01T11:00:00.000Z'),
      row('Q4 Drive', 'running', '2026-10-01T00:00:00.000Z'),
      row('Launch', 'upcoming', '2026-11-03T02:00:00.000Z'),
      row('Star Club Drive', 'running', '2026-07-01T00:00:00.000Z'),
    ];
    expect(byPhaseAndDate(rows).map((r) => r.title)).toEqual([
      'Launch', 'Kick-off', 'Star Club Drive', 'Q4 Drive', 'Awards night', 'Bootcamp',
    ]);
  });

  it('P18.97-T4 AC-8 treats a campaign’s ended as an event’s past, breaks a tie by title, and leaves its input as it was', () => {
    const rows = [
      row('B', 'ended', '2026-01-01T00:00:00.000Z'),
      row('A', 'ended', '2026-01-01T00:00:00.000Z'),
      row('C', 'past', '2026-02-01T00:00:00.000Z'),
    ];
    expect(byPhaseAndDate(rows).map((r) => r.title)).toEqual(['C', 'A', 'B']);
    expect(rows.map((r) => r.title)).toEqual(['B', 'A', 'C']);
  });
});
