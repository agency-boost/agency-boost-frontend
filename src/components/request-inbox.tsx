'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { LeaderLimitNotice, LeaderLimitWaiting, isLeaderLimit } from '@/components/leader-limit-notice';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { RoleBadge, rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatCalendarDay, dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  approveRequest, declineRequest, readInbox, readRoutingChoices, type PendingRequest, type RoutingChoice,
} from '@/lib/join';
import {
  askLeaderLimitApproval, cancelLeaderLimitRequest, pendingFor, readLeaderLimitRequests, requestedChange,
  type LeaderLimitRequestRow,
} from '@/lib/leader-limit-requests';
import { useSession } from '@/lib/session';

const SELF = '';

/** The inbox's words: the prototype's list, and the join date approving now asks for (ADR-0170 §5). */
export const INBOX_COPY = {
  empty: 'No pending requests right now.',
  loading: 'Loading requests…',
  joinDate: 'Join date',
  joinDateHint: 'The day they joined. Today unless they joined earlier.',
  lateDate: (today: string) => `The join date cannot be after today, ${formatCalendarDay(today)}.`,
  approve: 'Approve',
  approving: 'Approving…',
  decline: 'Decline',
  declining: 'Declining…',
  cancel: 'Cancel',
} as const;

/**
 * The sub-units on offer for one request: a destination must sit under the leader the request names, which is what
 * `approve()` validates, and the office queue holds rows naming different leaders.
 */
function unitsUnder(choices: RoutingChoice[], request: PendingRequest): RoutingChoice[] {
  return choices.filter((c) => c.forLeaderMembershipId === request.leaderMembershipId);
}

/**
 * **The request inbox** (`Overall.html:3625-3631`): each request to join, approved — into the reader's unit or one of
 * their AABs' — or declined with a reason sent to them. One component for *Pending Requests*
 * (`/user-management/pending`) and *Review requests* on `/new-hires` (P18.96-T3 AC-5, ADR-0170 §5).
 *
 * **Approving asks for the join date** (ADR-0169): *Approve* opens the row's *Join date*, today by default, and the
 * second *Approve* sends it. The prototype approves in one tap; the date is the client's rule R2, the smallest
 * footprint it fits (a field in the row the prototype already has).
 *
 * Declining leaves them in the office, free to ask somebody else — a refusal, not a removal. An approval the leader
 * limit refused may be asked of AgencyBoost (ADR-0157). `onCount` hears how many are waiting, each time it changes.
 */
export function RequestInbox({ today, onCount }: { today?: string; onCount?: (n: number) => void }) {
  const id = useId();
  const { me } = useSession();
  const ladder = useLadder();
  const officeToday = today ?? dayInZone(OFFICE_TIME_ZONE, new Date());
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  const [routing, setRouting] = useState<RoutingChoice[]>([]);
  const [destination, setDestination] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [joinDate, setJoinDate] = useState(officeToday);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [asks, setAsks] = useState<LeaderLimitRequestRow[] | null>(null);
  const mayAsk = me?.permissions.includes('leader_limit_request:read') ?? false;

  const show = useCallback((next: PendingRequest[]) => {
    setRequests(next);
    onCount?.(next.length);
  }, [onCount]);

  const load = useCallback(async () => {
    try {
      const [inbox, choices] = await Promise.all([readInbox(), readRoutingChoices()]);
      show(inbox);
      setRouting(choices);
      if (mayAsk) setAsks(await readLeaderLimitRequests().catch(() => []));
    } catch (err) {
      setError(toDisplayError(err));
      setRequests([]);
    }
  }, [mayAsk, show]);

  useEffect(() => {
    void load();
  }, [load]);

  /** ADR-0157 §1: letting this pending leader in, asked of AgencyBoost. */
  async function askApproval() {
    if (!refused) return;
    setBusy('ask');
    try {
      await askLeaderLimitApproval(refused, { action: 'activate' });
      setRefused(null);
      setError(null);
      setAsks(await readLeaderLimitRequests().catch(() => []));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function cancelAsk(requestId: string) {
    setBusy('ask');
    setError(null);
    try {
      setAsks(await cancelLeaderLimitRequest(requestId));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function decide(request: PendingRequest, action: 'approve' | 'decline') {
    setBusy(request.requestId);
    setError(null);
    setRefused(null);
    try {
      const next = action === 'approve'
        ? await approveRequest(request.requestId, destination[request.requestId] || undefined, joinDate)
        : await declineRequest(request.requestId, reason.trim() || undefined);
      // The server returns the inbox as it now stands, so two leaders deciding at once see the truth.
      show(next);
      setDeclining(null);
      setApproving(null);
      setReason('');
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      if (action === 'approve' && isLeaderLimit(shown)) setRefused(request.membershipId);
      // A conflict means somebody else got there first; reload rather than leaving a row that no longer exists.
      await load();
    } finally {
      setBusy(null);
    }
  }

  const lateDate = joinDate !== '' && joinDate > officeToday;

  return (
    <div>
      {/* An approval at the leader limit (P13.2 exit review): in the limit's words, never the code. */}
      {error && (isLeaderLimit(error)
        ? (
          <LeaderLimitNotice
            error={error}
            audience="office"
            action="role"
            asking={busy === 'ask'}
            onAsk={refused ? () => void askApproval() : undefined}
          />
        )
        : <ErrorBanner {...error} />)}

      {requests === null && <SkeletonCards count={2} label={INBOX_COPY.loading} className="mt-4" />}
      {requests?.length === 0 && <EmptyState title={INBOX_COPY.empty} />}

      <ul className="mt-4 flex flex-col gap-3">
        {requests?.map((request) => (
          <li key={request.requestId} className="rounded-md border border-hairline p-3">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-dark text-md font-bold text-card">
                {request.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-md font-semibold text-navy">{request.fullName}</span>
                  <RoleBadge role={request.role} />
                </span>
                <span className="block text-sm text-muted">{request.agentCode} · {request.email}</span>
                {request.routedFromName && (
                  <span className="mt-1 block text-sm text-navy">Sent to you by {request.routedFromName}.</span>
                )}
              </span>
            </div>

            {pendingFor(asks, request.membershipId) ? (
              // ADR-0157: letting them in waits for AgencyBoost; nothing about them changes meanwhile.
              <div className="mt-3">
                <LeaderLimitWaiting
                  what={requestedChange(pendingFor(asks, request.membershipId)!, (code) => rungShort(code, ladder))}
                  cancelling={busy === 'ask'}
                  onCancel={() => void cancelAsk(pendingFor(asks, request.membershipId)!.requestId)}
                />
              </div>
            ) : declining === request.requestId ? (
              <div className="mt-3">
                <Field
                  label="Why?"
                  htmlFor={`${id}-reason-${request.requestId}`}
                  hint="Sent to them. Saying nothing leaves them guessing what to do instead."
                >
                  <TextInput
                    id={`${id}-reason-${request.requestId}`}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Not in my patch — try Sari"
                  />
                </Field>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="secondary" disabled={busy !== null} onClick={() => void decide(request, 'decline')}>
                    {busy === request.requestId ? INBOX_COPY.declining : INBOX_COPY.decline}
                  </Button>
                  <Button variant="secondary" disabled={busy !== null} onClick={() => { setDeclining(null); setReason(''); }}>
                    {INBOX_COPY.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                {/* Only for an agent, and only when there is somewhere to send them: an AB or AAB who asked is tagged
                    to the leader directly. Filtered to the leader *this row* names. */}
                {request.role === 'agent' && unitsUnder(routing, request).length > 0 && (
                  <Field label="Add to" htmlFor={`${id}-to-${request.requestId}`} className="w-56">
                    <Select
                      id={`${id}-to-${request.requestId}`}
                      value={destination[request.requestId] ?? SELF}
                      onChange={(e) => setDestination({ ...destination, [request.requestId]: e.target.value })}
                    >
                      <option value={SELF}>
                        {request.leaderMembershipId === me?.membership?.membershipId
                          ? 'My own unit'
                          : `${request.leaderName}'s own unit`}
                      </option>
                      {unitsUnder(routing, request).map((choice) => (
                        <option key={choice.membershipId} value={choice.membershipId}>
                          {choice.fullName}&apos;s unit ({choice.unitSize})
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                {approving === request.requestId && (
                  <Field
                    label={INBOX_COPY.joinDate}
                    htmlFor={`${id}-join-${request.requestId}`}
                    hint={INBOX_COPY.joinDateHint}
                    error={lateDate ? INBOX_COPY.lateDate(officeToday) : undefined}
                    className="w-56"
                  >
                    <DateField
                      id={`${id}-join-${request.requestId}`}
                      value={joinDate}
                      max={officeToday}
                      invalid={lateDate}
                      onChange={setJoinDate}
                      className="w-full"
                    />
                  </Field>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy !== null || (approving === request.requestId && (lateDate || !joinDate))}
                    onClick={() => {
                      if (approving === request.requestId) void decide(request, 'approve');
                      else {
                        setApproving(request.requestId);
                        setJoinDate(officeToday);
                        setDeclining(null);
                      }
                    }}
                  >
                    {busy === request.requestId ? INBOX_COPY.approving : INBOX_COPY.approve}
                  </Button>
                  {approving === request.requestId ? (
                    <Button variant="secondary" disabled={busy !== null} onClick={() => setApproving(null)}>
                      {INBOX_COPY.cancel}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => { setDeclining(request.requestId); setApproving(null); }}
                    >
                      {INBOX_COPY.decline}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
