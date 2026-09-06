'use client';

import { useCallback, useEffect, useState } from 'react';
import { AgentShell } from '@/components/agent-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { RoleBadge } from '@/components/ui/role-badge';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import {
  approveRequest,
  declineRequest,
  readInbox,
  readRoutingChoices,
  type PendingRequest,
  type RoutingChoice,
} from '@/lib/join';

/**
 * Pending Requests (`Overall.html:3625-3631`).
 *
 * Two things the prototype does not do, and both matter.
 *
 * It captures no reason for a decline, so somebody is refused with no way to know why or
 * what to do instead. Here the reason is asked for and sent to them.
 *
 * And it splices the row out of an array, which leaves the person nowhere — declined and
 * un-registered at once. Here declining leaves them in the office, free to ask somebody
 * else; it is a refusal, not a removal, and the screen says so.
 */
const SELF = '';

/**
 * The sub-units on offer for one request.
 *
 * A destination must sit under the leader the request names — `approve()` validates
 * exactly that — and the office queue holds rows naming different leaders. One unfiltered
 * list offered an Owner every choice and had every one of them refused.
 */
function unitsUnder(choices: RoutingChoice[], request: PendingRequest): RoutingChoice[] {
  return choices.filter((c) => c.forLeaderMembershipId === request.leaderMembershipId);
}

export default function PendingPage() {
  const { me } = useSession();
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  const [routing, setRouting] = useState<RoutingChoice[]>([]);
  const [destination, setDestination] = useState<Record<string, string>>({});
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [inbox, choices] = await Promise.all([readInbox(), readRoutingChoices()]);
      setRequests(inbox);
      setRouting(choices);
    } catch (err) {
      setError(toDisplayError(err));
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(request: PendingRequest, action: 'approve' | 'decline') {
    setBusy(request.requestId);
    setError(null);
    try {
      const next =
        action === 'approve'
          ? await approveRequest(request.requestId, destination[request.requestId] || undefined)
          : await declineRequest(request.requestId, reason.trim() || undefined);
      // The server returns the inbox as it now stands, so two leaders deciding at once
      // see the truth rather than their own guess about it.
      setRequests(next);
      setDeclining(null);
      setReason('');
    } catch (err) {
      setError(toDisplayError(err));
      // A conflict means somebody else got there first; reload rather than leaving a row
      // that no longer exists on screen.
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AgentShell
      subtabs
      title="Pending Requests"
      subtitle="Approve or decline agents who requested to be tagged to you."
      permission="leader_request:read_inbox"
    >
      {error && <ErrorBanner {...error} />}

      <Card>
        <h2 className="font-display text-lg font-bold text-navy">Incoming requests</h2>
        <p className="mt-1 text-md text-muted">
          These are people who found you under Find Your Leader. Approving adds them to your unit.
          Declining leaves them in the office, free to ask somebody else.
        </p>

        {requests === null && (
          <p role="status" className="mt-4 text-md text-muted">
            Loading…
          </p>
        )}

        {requests?.length === 0 && (
          <EmptyState title="No pending requests right now." />
        )}

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
                  <span className="block text-sm text-muted">
                    {request.agentCode} · {request.email}
                  </span>
                  {request.routedFromName && (
                    <span className="mt-1 block text-sm text-navy">
                      Sent to you by {request.routedFromName}.
                    </span>
                  )}
                </span>
              </div>

              {declining === request.requestId ? (
                <div className="mt-3">
                  <Field
                    label="Why?"
                    htmlFor={`reason-${request.requestId}`}
                    hint="Sent to them. Saying nothing leaves them guessing what to do instead."
                  >
                    <TextInput
                      id={`reason-${request.requestId}`}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Not in my patch — try Sari"
                    />
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => void decide(request, 'decline')}
                    >
                      {busy === request.requestId ? 'Declining…' : 'Decline'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => {
                        setDeclining(null);
                        setReason('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {/* Only for an agent, and only when there is somewhere to send them.
                      An AB or AAB who asked for you is tagged to you directly — a leader
                      is not placed in somebody else's unit.

                      Filtered to the leader *this row* names. The office queue holds
                      requests addressed to different leaders, and a destination under
                      one of them is refused for a request under another. */}
                  {request.role === 'agent' &&
                    unitsUnder(routing, request).length > 0 && (
                      <Field label="Add to" htmlFor={`to-${request.requestId}`} className="w-56">
                        <Select
                          id={`to-${request.requestId}`}
                          value={destination[request.requestId] ?? SELF}
                          onChange={(e) =>
                            setDestination({ ...destination, [request.requestId]: e.target.value })
                          }
                        >
                          {/* Names the leader rather than saying "my own", which is false
                              whenever an Owner or Admin decides somebody else's request. */}
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
                  <Button
                    disabled={busy !== null}
                    onClick={() => void decide(request, 'approve')}
                  >
                    {busy === request.requestId ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => setDeclining(request.requestId)}
                  >
                    Decline
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </AgentShell>
  );
}
