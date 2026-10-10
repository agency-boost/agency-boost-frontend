'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { Button, ErrorBanner, TextInput } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { ADMIN_COPY, chosenCount, leftRow, readInvitees, type EventInvitee } from '@/lib/events-admin';

/**
 * **Who is invited, one by one** (P18.5-T5 AC-10; D-picker): the *Chosen people* and *Chosen leaders*
 * audiences, live. No prototype draws a picker (`KPM_Owner.html:1649` is an `alert()`), so this is a Fill in
 * the console's idiom: a search field and a checklist of the office's active members, each with their role,
 * and how many are chosen.
 *
 * ***Chosen leaders* lists only members who lead somebody now** — the graph, not a job title (ADR-0087;
 * the server refuses anybody else, Phase 5's rule). Searching is by name, in the page: the read is every
 * active member, once.
 *
 * **A chosen person is never dropped.** Somebody saved on the event whom the list cannot offer any more —
 * who has left, or who leads nobody now — stays chosen, at the top, in a row that says why and that can be
 * cleared but not chosen again: the event's record keeps them (the server keeps stored invitees), and the
 * page sends the list only when it changed. People who left have no name on this read, so they are one
 * row, *"Somebody who has left"* or *"{n} people who have left"*.
 */
export function AudiencePicker({ leadersOnly, chosen, disabled, onChange }: {
  leadersOnly: boolean;
  chosen: readonly string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [people, setPeople] = useState<EventInvitee[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const searchId = useId();
  const countId = useId();

  useEffect(() => {
    let live = true;
    setError(null);
    readInvitees()
      .then((answer) => { if (live) setPeople(answer.people); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [attempt]);

  const offered = useMemo(
    () => (people ?? []).filter((p) => !leadersOnly || p.leads),
    [people, leadersOnly],
  );

  /** Chosen, and not offered: kept, each with the reason the list cannot offer them. */
  const kept = useMemo(() => {
    const listed = new Map((people ?? []).map((p) => [p.membershipId, p]));
    const sendable = new Set(offered.map((p) => p.membershipId));
    const notLeading = chosen.filter((id) => !sendable.has(id) && listed.has(id)).map((id) => listed.get(id)!);
    const left = chosen.filter((id) => !listed.has(id));
    return { notLeading, left };
  }, [people, offered, chosen]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? offered.filter((p) => p.name.toLowerCase().includes(q)) : offered;
  }, [offered, query]);

  const picked = new Set(chosen);
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...chosen, id] : chosen.filter((c) => c !== id));

  if (error && !people) {
    return (
      <div className="mt-3">
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{ADMIN_COPY.tryAgain}</Button>
      </div>
    );
  }
  if (!people) {
    return (
      <Skeleton label={ADMIN_COPY.loadingPeople} className="mt-3">
        {[0, 1, 2].map((i) => <SkeletonBar key={i} className="mb-2 h-4 w-2/3" />)}
      </Skeleton>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-hairline p-3" data-part="audience-picker">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={searchId} className="text-sm font-semibold text-navy">{ADMIN_COPY.searchPeople}</label>
        <span id={countId} className="text-sm text-muted">{chosenCount(chosen.length)}</span>
      </div>
      <TextInput
        id={searchId}
        type="search"
        value={query}
        disabled={disabled}
        aria-describedby={countId}
        onChange={(e) => setQuery(e.target.value)}
      />
      {(kept.notLeading.length > 0 || kept.left.length > 0) && (
        <ul className="mt-2 list-none p-0" data-part="kept">
          {kept.notLeading.map((person) => (
            <li key={person.membershipId}>
              <KeptRow label={person.name} reason={ADMIN_COPY.leadsNobodyNow} disabled={disabled} onClear={() => onChange(chosen.filter((c) => c !== person.membershipId))} />
            </li>
          ))}
          {kept.left.length > 0 && (
            <li>
              <KeptRow label={leftRow(kept.left.length)} disabled={disabled} onClear={() => onChange(chosen.filter((c) => !kept.left.includes(c)))} />
            </li>
          )}
        </ul>
      )}
      {offered.length === 0 ? (
        <p className="mt-3 text-base text-muted">{leadersOnly ? ADMIN_COPY.nobodyLeads : ADMIN_COPY.noMatches}</p>
      ) : shown.length === 0 ? (
        <p className="mt-3 text-base text-muted">{ADMIN_COPY.noMatches}</p>
      ) : (
        <ul className="mt-2 max-h-64 list-none overflow-y-auto p-0">
          {shown.map((person) => (
            <li key={person.membershipId}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1 py-1.5 text-md text-navy hover:bg-navy/[0.04]">
                <input
                  type="checkbox"
                  checked={picked.has(person.membershipId)}
                  disabled={disabled}
                  onChange={(e) => toggle(person.membershipId, e.target.checked)}
                />
                <span className="min-w-0 flex-1 break-words">{person.name}</span>
                <span className="shrink-0 text-sm text-muted">{person.rung}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A chosen person the list cannot offer: ticked, and clearable — once cleared, gone from the list. */
function KeptRow({ label, reason, disabled, onClear }: {
  label: string;
  reason?: string;
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1 py-1.5 text-md text-navy hover:bg-navy/[0.04]">
      <input type="checkbox" checked disabled={disabled} onChange={onClear} />
      <span className="min-w-0 flex-1 break-words">{label}</span>
      {reason && <span className="shrink-0 text-sm text-muted">{reason}</span>}
    </label>
  );
}
