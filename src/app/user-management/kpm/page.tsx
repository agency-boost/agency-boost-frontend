'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserManagementShell } from '@/components/user-management-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readJoinState, registerKpm, searchKpms, type JoinState, type KpmDirectoryEntry } from '@/lib/join';

/**
 * Register KPM (`Overall.html:3480-3509`).
 *
 * Two prototype defects are not reproduced. Selecting an office there only hides the
 * search card and never updates the summary band, so the screen keeps claiming the old
 * office; here the state is written and re-read. And *Switch KPM* there is a pure
 * show/hide with no un-register step — the real thing refuses a second registration
 * rather than appearing to move you.
 */
export default function RegisterKpmPage() {
  const [state, setState] = useState<JoinState | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<KpmDirectoryEntry[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void readJoinState().then(setState).catch((err) => setError(toDisplayError(err)));
  }, []);

  const search = useCallback(async (term: string) => {
    try {
      setResults(await searchKpms(term || undefined));
    } catch (err) {
      setError(toDisplayError(err));
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (state && state.kpmId) return; // already registered — nothing to search for
    void search(q);
  }, [q, search, state]);

  async function choose(kpmId: string) {
    setBusy(kpmId);
    setError(null);
    try {
      setState(await registerKpm(kpmId));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  const registered = Boolean(state?.kpmId);

  return (
    <UserManagementShell
      title="User management"
      subtitle="Attach yourself to an office, then find a leader."
      leaderLocked={!registered}
    >
      {error && <ErrorBanner {...error} />}

      {state === null && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {state && registered && (
        <Card className="border-l-4 border-l-amber">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Registered office</p>
          <p className="mt-1 font-display text-xl font-bold text-navy">{state.kpmLabel}</p>
          <p className="mt-1 text-md text-muted">
            {state.status === 'pending'
              ? 'You are in the office and waiting for a leader to take you on.'
              : 'You are an active member of this office.'}
          </p>
          {/* No "Switch KPM". The prototype's button only hides a card; moving between
              offices is a real operation with real consequences for your history, and it
              is not one you do to yourself from here. */}
          <p className="mt-3 text-sm text-muted">
            Moving to a different office is not something you can do yourself — ask
            whoever administers your office.
          </p>
          {state.status === 'pending' && (
            <ButtonLink href="/user-management/leader" className="mt-4">
              Find your leader
            </ButtonLink>
          )}
        </Card>
      )}

      {state && !registered && (
        <>
          <Card className="mb-4">
            <p className="text-3xl" aria-hidden>
              🏢
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-navy">No office registered yet</h2>
            <p className="mt-1 text-md text-muted">
              Find the office your branch belongs to. You will need this before you can find a
              leader.
            </p>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold text-navy">Search for your office</h2>
            <p className="mt-1 text-md text-muted">
              Select the one your branch belongs to. Registering does not make you a member yet —
              a leader still has to take you on.
            </p>

            <Field label="Search" htmlFor="kpm-search" className="mt-3">
              <TextInput
                id="kpm-search"
                placeholder="Office code or branch name"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </Field>

            <ul className="mt-4 flex flex-col gap-2">
              {results?.map((k) => (
                <li
                  key={k.kpmId}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-hairline p-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-md font-bold text-card">
                    {k.code.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-md font-semibold text-navy">
                      {k.companyName} — KPM {k.code}
                    </span>
                    <span className="block text-sm text-muted">
                      {k.branchName}
                      {k.city ? ` · ${k.city}` : ''}
                    </span>
                  </span>
                  <Button disabled={busy !== null} onClick={() => void choose(k.kpmId)}>
                    {busy === k.kpmId ? 'Registering…' : 'Select'}
                  </Button>
                </li>
              ))}
            </ul>

            {results?.length === 0 && (
              <EmptyState
                variant={q ? 'filtered' : 'empty'}
                title={q ? 'No offices match that search.' : 'No offices are available to join.'}
              />
            )}
          </Card>
        </>
      )}
    </UserManagementShell>
  );
}
