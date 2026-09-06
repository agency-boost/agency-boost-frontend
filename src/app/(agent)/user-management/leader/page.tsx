'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { UserManagementTabs } from '@/components/user-management-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { RoleBadge } from '@/components/ui/role-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  cancelLeaderRequest,
  readJoinState,
  requestLeader,
  searchLeaders,
  type JoinState,
  type LeaderChoice,
} from '@/lib/join';

/**
 * Find Your Leader (`Overall.html:3517-3564`).
 *
 * Locked until an office is registered, as the prototype locks it — but by state rather
 * than a hidden card, and it says why instead of simply not being there.
 *
 * The leader-code and invite-link route the prototype offers alongside this is P3-T4;
 * its tile is not drawn yet, because a tile that does nothing is worse than one that is
 * absent.
 */
export default function FindLeaderPage() {
  const [state, setState] = useState<JoinState | null>(null);
  const [q, setQ] = useState('');
  const [leaders, setLeaders] = useState<LeaderChoice[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await readJoinState();
    setState(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh().catch((err) => setError(toDisplayError(err)));
  }, [refresh]);

  const registered = Boolean(state?.kpmId);

  useEffect(() => {
    if (!registered) return;
    void searchLeaders(q || undefined)
      .then(setLeaders)
      .catch((err) => {
        setError(toDisplayError(err));
        setLeaders([]);
      });
  }, [q, registered]);

  async function ask(membershipId: string) {
    setBusy(membershipId);
    setError(null);
    try {
      setState(await requestLeader(membershipId));
      setLeaders(await searchLeaders(q || undefined));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function withdraw() {
    setBusy('cancel');
    setError(null);
    try {
      setState(await cancelLeaderRequest());
      setLeaders(await searchLeaders(q || undefined));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page
      title="Find Your Leader"
      subtitle="Search leaders in your KPM and request to be tagged."
    >
      <UserManagementTabs leaderLocked={!registered} />
      {error && <ErrorBanner {...error} />}

      {state === null && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {state && !registered && (
        <Card>
          <h2 className="font-display text-xl font-bold text-navy">Register an office first</h2>
          <p className="mt-1 text-md text-muted">
            Finding a leader means searching inside one office, so we need to know which. It is
            one step, and you can change nothing else until it is done.
          </p>
          <ButtonLink href="/user-management/kpm" className="mt-4">
            Go to Register KPM
          </ButtonLink>
        </Card>
      )}

      {state && registered && (
        <>
          <Card className="mb-4">
            <h2 className="font-display text-lg font-bold text-navy">
              Have a leader&apos;s code, link or QR?
            </h2>
            <p className="mt-1 text-md text-muted">
              Any of the three does the same thing: it joins you and tags you to them in one step,
              with no approval. Opening their link or scanning their QR takes you to the same place.
            </p>
            <ButtonLink href="/join" variant="secondary" className="mt-3">
              Use an invite instead
            </ButtonLink>
          </Card>
        </>
      )}

      {state && registered && (
        <>
          {state.leaderName && (
            <Card className="mb-4 border-l-4 border-l-amber">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted">
                Currently reporting to
              </p>
              <p className="mt-1 font-display text-xl font-bold text-navy">{state.leaderName}</p>
            </Card>
          )}

          <Card>
            <h2 className="font-display text-lg font-bold text-navy">
              Find a leader in {state.kpmLabel}
            </h2>
            <p className="mt-1 text-md text-muted">
              Sending a request notifies them — they need to approve it before you are tagged.
            </p>

            <Field label="Search by name" htmlFor="leader-search" className="mt-3">
              <TextInput
                id="leader-search"
                placeholder="Name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </Field>

            <ul className="mt-4 flex flex-col gap-2">
              {leaders?.map((l) => (
                <li
                  key={l.membershipId}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-hairline p-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-md font-bold text-card">
                    {l.fullName
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-md font-semibold text-navy">{l.fullName}</span>
                      <RoleBadge role={l.role} />
                    </span>
                    <span className="block text-sm text-muted">
                      {/* Said plainly rather than shown as "0 people in unit", which
                          reads as a number they failed to reach. */}
                      {l.unitSize === 0
                        ? 'No unit yet — they can still take you on'
                        : `${l.unitSize} in their unit`}
                    </span>
                  </span>

                  {l.isCurrentLeader ? (
                    <StatusPill status="success" label="Your leader" />
                  ) : l.requestSent ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill status="neutral" label="Request sent" />
                      <Button
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => void withdraw()}
                      >
                        {busy === 'cancel' ? 'Withdrawing…' : 'Withdraw'}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => void ask(l.membershipId)}
                    >
                      {busy === l.membershipId ? 'Sending…' : 'Send request'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {leaders?.length === 0 && (
              <EmptyState
                variant={q ? 'filtered' : 'empty'}
                title={
                  q
                    ? 'No leaders match that search.'
                    : 'This office has no Agency Builders or Associate Agency Builders yet.'
                }
              />
            )}
          </Card>

          {state.pendingRequestTo && (
            <p className="mt-4 text-md text-muted">
              One request at a time. Asking somebody else replaces it rather than adding a
              second — two open requests could both be approved.
            </p>
          )}
        </>
      )}
    </Page>
  );
}
