'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { RoleBadge, rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { CONFIRMED } from '@/lib/confirmations';
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
  const ladder = useLadder();
  const [state, setState] = useState<JoinState | null>(null);
  const [q, setQ] = useState('');
  const [leaders, setLeaders] = useState<LeaderChoice[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast, show } = useToast();

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

  /**
   * *Send request*, and *Request sent ✓* once the request is in (P18.95-T1 AC-6, ADR-0167 §5; UI-008), whether
   * or not the list read after it answers; the row's own *Request sent* pill follows with the list. A
   * refusal toasts nothing and stays in the banner.
   */
  async function ask(membershipId: string) {
    setBusy(membershipId);
    setError(null);
    try {
      setState(await requestLeader(membershipId));
      show(CONFIRMED.requestSent);
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
      title={USER_MANAGEMENT_TITLE}
      subtitle="Search leaders in your KPM and request to be tagged."
    >
      <UserManagementTabs leaderLocked={!registered} />
      {error && <ErrorBanner {...error} />}

      {state === null && (
        <SkeletonCards count={2} label="Loading your leader…" />
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
            {/* The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 1): its words stay from 768px. */}
            <p className={cn('mt-1 text-md text-muted', REMOVED_ON_PHONE)}>
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
            {/*
              * The client's words at every size (P18.95-T7 AC-1, grey text rows 3 and 2): *Find a leader*, where it
              * named the office the tabs above already sit in, and the approval in four words.
              */}
            <h2 className="font-display text-lg font-bold text-navy">Find a leader</h2>
            <p className="mt-1 text-md text-muted">They&apos;ll need to approve.</p>

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
                    : `This office has no ${rungShort('AB', ladder)}s or ${rungShort('AAB', ladder)}s yet.`
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
      <Toast toast={toast} />
    </Page>
  );
}
