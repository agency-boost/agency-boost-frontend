'use client';

import { useEffect, useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { shortOfRung } from '@/components/ui/role-badge';
import { SaveStatus } from '@/components/ui/save-status';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { refusalOf } from '@/lib/events';
import { cn } from '@/lib/cn';
import {
  ADMIN_COPY, attendedWords, markLabel, readRollCall, saveRollCall, type RollCall, type RollCallRow,
} from '@/lib/events-admin';

const TH = 'border-b border-hairline px-2.5 py-2 text-left text-2xs font-bold uppercase tracking-wide text-muted';
const TD = 'border-b border-hairline px-2.5 py-2 align-middle text-base';

/**
 * **The roll call** (P18.5-T5 AC-7; OD-31, D-rollcall): who was in the event's audience as at its start —
 * their name, their role, what they said (*RSVP'd*, *Said they came*, or nothing), and the confirmation the
 * Owner or an Admin gives each of them: *Attended*, *Absent*, or neither yet.
 *
 * **Only a confirmation makes anybody attended** (exit test 2): an RSVP and a claim are words in the
 * *Response* column, never ticks. A mark is pressed to give it and pressed again to take it back, so a row
 * returns to *not confirmed*; the two marks are toggles saying which is on (`aria-pressed`; ADR-0137 §2, a
 * selection is navy). *Save attendance* writes only the rows that changed, and the server audits each.
 *
 * **Nobody confirms their own** (OD-31, ADR-0138): the caller's row has no control, and one line says why;
 * the server refuses it too (`400 EVENT_ATTENDANCE_SELF`). A reader who may not confirm — a read-only support
 * session — reads each row's state in words and finds no control at all (`can.confirm`).
 *
 * Ours to draw (a Fill in the console's idiom, form 3: inside the dialog the prototype's *View feedback*
 * already opens). Its states are Fills too: a skeleton, an error with a retry, and an audience of nobody.
 */
export function RollCallSection({ eventId, onSaved, tabbed = false }: {
  eventId: string;
  onSaved: () => void;
  /**
   * Under its own tab (P18.8-T13): the tab names it, so the heading is for assistive technology alone, and nothing
   * follows it to keep a margin for.
   */
  tabbed?: boolean;
}) {
  const [view, setView] = useState<RollCall | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<Readonly<Record<string, boolean | null>>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const headingId = useId();

  useEffect(() => {
    let live = true;
    setError(null);
    readRollCall(eventId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [eventId, attempt]);

  const valueOf = (row: RollCallRow) => (row.membershipId in draft ? draft[row.membershipId] : row.attended);

  const mark = (row: RollCallRow, to: boolean) => {
    setSaved(false);
    const next = valueOf(row) === to ? null : to;
    setDraft((d) => {
      const rest = { ...d };
      if (next === row.attended) delete rest[row.membershipId];
      else rest[row.membershipId] = next;
      return rest;
    });
  };

  const changed = Object.keys(draft).length;

  const save = async () => {
    if (busy || changed === 0) return;
    setBusy(true);
    setSaveError(null);
    try {
      const next = await saveRollCall(eventId, Object.entries(draft).map(([membershipId, attended]) => ({ membershipId, attended })));
      setView(next);
      setDraft({});
      setSaved(true);
      onSaved();
    } catch (err) {
      setSaveError(refusalOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className={tabbed ? undefined : 'mb-6'} data-part="roll-call">
      <h3 id={headingId} className={cn('mb-2.5 font-display text-md font-bold text-navy', tabbed && 'sr-only')}>{ADMIN_COPY.rollCall}</h3>
      {error && !view && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{ADMIN_COPY.tryAgain}</Button>
        </div>
      )}
      {!view && !error && (
        <Skeleton label={ADMIN_COPY.loadingRollCall}>
          {[0, 1, 2].map((i) => <SkeletonBar key={i} className="mb-2.5 h-4 w-full" />)}
        </Skeleton>
      )}
      {view && view.people.length === 0 && <p className="text-md text-muted">{ADMIN_COPY.nobodyInvited}</p>}
      {view && view.people.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="relative w-full min-w-[30rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={TH}>{ADMIN_COPY.name}</th>
                  <th scope="col" className={TH}>{ADMIN_COPY.role}</th>
                  <th scope="col" className={TH}>{ADMIN_COPY.response}</th>
                  <th scope="col" className={TH}>{ADMIN_COPY.attendance}</th>
                </tr>
              </thead>
              <tbody>
                {view.people.map((row) => (
                  <tr key={row.membershipId} data-member={row.membershipId}>
                    <th scope="row" className={cn(TD, 'text-left font-semibold text-navy')}>{row.name}</th>
                    <td className={cn(TD, 'text-muted')}>{shortOfRung({ code: row.orgLevelCode, label: row.rung })}</td>
                    <td className={cn(TD, 'text-navy')}>{row.said ? ADMIN_COPY.said[row.said] : '—'}</td>
                    <td className={TD}>
                      <AttendanceCell row={row} value={valueOf(row)} writable={view.can.confirm} onMark={(to) => mark(row, to)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.can.confirm && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button disabled={changed === 0} aria-disabled={busy || undefined} onClick={() => void save()}>
                {ADMIN_COPY.saveAttendance}
              </Button>
              {saved && changed === 0 && <SaveStatus state="saved">{ADMIN_COPY.saved}</SaveStatus>}
            </div>
          )}
          {saveError && <div className="mt-3"><ErrorBanner {...saveError} /></div>}
        </>
      )}
    </section>
  );
}

/** A row's confirmation: two marks to press, the reason on the caller's own row, or the state in words. */
function AttendanceCell({ row, value, writable, onMark }: {
  row: RollCallRow;
  value: boolean | null;
  writable: boolean;
  onMark: (to: boolean) => void;
}) {
  if (row.self) {
    return (
      <span className="block text-sm text-muted">
        <span className="font-semibold text-navy">{attendedWords(row.attended)}</span>
        <span className="block">{ADMIN_COPY.ownRow}</span>
      </span>
    );
  }
  if (!writable) return <span className="text-navy">{attendedWords(row.attended)}</span>;
  const toggle = (on: boolean) => cn(
    'rounded-[5px] px-2.5 py-1 text-sm font-semibold',
    on ? 'bg-navy text-white' : 'text-muted hover:text-navy',
  );
  return (
    <span className="inline-flex rounded-[7px] border border-hairline bg-card p-[2px]">
      <button type="button" aria-pressed={value === true} aria-label={markLabel('attended', row.name)} className={toggle(value === true)} onClick={() => onMark(true)}>
        {ADMIN_COPY.attended}
      </button>
      <button type="button" aria-pressed={value === false} aria-label={markLabel('absent', row.name)} className={toggle(value === false)} onClick={() => onMark(false)}>
        {ADMIN_COPY.absent}
      </button>
    </span>
  );
}
