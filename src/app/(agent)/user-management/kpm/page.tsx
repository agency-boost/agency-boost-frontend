'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { PhoneTip } from '@/components/ui/phone-tip';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { userManagementMessages } from '@/i18n/messages/user-management';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  askForKpm,
  readJoinState,
  readMyKpmRequest,
  registerKpm,
  searchKpms,
  type JoinState,
  type KpmDirectoryEntry,
  type MyKpmRequest,
} from '@/lib/join';

/**
 * Register KPM (`Overall.html:3480-3509`).
 *
 * Two prototype defects are not reproduced. Selecting an office there only hides the
 * search card and never updates the summary band, so the screen keeps claiming the old
 * office; here the state is written and re-read. And *Switch KPM* there is a pure
 * show/hide with no un-register step — the real thing refuses a second registration
 * rather than appearing to move you.
 *
 * Its words are the catalogue's (`user-management.ts`; P18.98-T4): *office* is *KPM* in Indonesian (§B.9). An office's
 * company, code and branch are shown as stored.
 *
 * **UI V1 (2026-10-30, Phase 18.99 T9; UI-088, UI-087).** One card for the one fact: *KPM terdaftar* in sentence case,
 * the office as its title, *Pindah ke KPM lain…* as 12px meta inside it — behind ⓘ on a phone (Appendix A); no
 * uppercase eyebrow and no orange left border, here or on *Anda mengajukan KPM*. No sub-line below 1024px.
 */
export default function RegisterKpmPage() {
  const words = useMessages(userManagementMessages);
  const t = words.kpm;
  const [state, setState] = useState<JoinState | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<KpmDirectoryEntry[] | null>(null);
  const [mine, setMine] = useState<MyKpmRequest | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void readJoinState().then(setState).catch((err) => setError(toDisplayError(err)));
  }, []);

  useEffect(() => {
    void readMyKpmRequest().then(setMine).catch(() => setMine(null));
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
    <Page
      title={USER_MANAGEMENT_TITLE}
      subtitle={t.subtitle}
      subtitleOnPhone={false}
      subtitleOnTablet={false}
    >
      <UserManagementTabs leaderLocked={!registered} />
      {error && <ErrorBanner {...error} />}

      {state === null && (
        <SkeletonCards count={2} label={t.loading} />
      )}

      {state && registered && (
        <Card data-testid="registered-office">
          <p className="text-sm text-muted">{t.registered}</p>
          <p className="mt-0.5 flex items-center gap-1.5 font-display text-xl font-bold text-navy">
            {state.kpmLabel}
            <PhoneTip text={t.moving} className="font-normal" />
          </p>
          <p className="mt-1 text-md text-muted">
            {state.status === 'pending' ? t.pendingLine : t.activeLine}
          </p>
          {/* No "Switch KPM". The prototype's button only hides a card; moving between
              offices is a real operation with real consequences for your history, and it
              is not one you do to yourself from here. */}
          <p className={cn('mt-2 text-sm text-muted', REMOVED_ON_PHONE)}>{t.moving}</p>
          {state.status === 'pending' && (
            <ButtonLink href="/user-management/leader" className="mt-4">
              {words.tabs.leader}
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
            <h2 className="mt-1 font-display text-xl font-bold text-navy">{t.noneTitle}</h2>
            <p className="mt-1 text-md text-muted">{t.noneLine}</p>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold text-navy">{t.searchTitle}</h2>
            <p className="mt-1 text-md text-muted">{t.searchLine}</p>

            <Field label={t.search} htmlFor="kpm-search" className="mt-3">
              <TextInput
                id="kpm-search"
                placeholder={t.searchExample}
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
                      {t.office({ company: k.companyName, code: k.code })}
                    </span>
                    <span className="block text-sm text-muted">
                      {k.branchName}
                      {k.city ? ` · ${k.city}` : ''}
                    </span>
                  </span>
                  <Button disabled={busy !== null} onClick={() => void choose(k.kpmId)}>
                    {busy === k.kpmId ? t.registering : t.select}
                  </Button>
                </li>
              ))}
            </ul>

            {results?.length === 0 && (
              <EmptyState
                variant={q ? 'filtered' : 'empty'}
                title={q ? t.noMatch : t.noneAvailable}
              />
            )}
          </Card>

          {/* Where the search ends for somebody whose branch has never been provisioned.
              Until 2026-09-06 it ended nowhere: they searched, found nothing, and the
              product had no answer for them (ADR-0011). */}
          <AskForKpm mine={mine} companies={results} onAsked={setMine} />
        </>
      )}
    </Page>
  );
}

/**
 * Asking for an office that does not exist.
 *
 * Deliberately **below** the search and quiet about it: almost everybody who reaches this
 * screen has an office to find, and offering "ask for a new one" as an equal choice would
 * invite duplicates of offices that already exist. It is the answer when the search has
 * none, not an alternative to searching.
 *
 * One open ask at a time, which the API enforces. When there is one, this shows where it
 * stands instead of the form — being invited to ask again while an ask is pending is how
 * somebody ends up with two offices.
 */
function AskForKpm({
  mine,
  companies,
  onAsked,
}: {
  mine: MyKpmRequest | null;
  companies: KpmDirectoryEntry[] | null;
  onAsked: (r: MyKpmRequest) => void;
}) {
  const t = useMessages(userManagementMessages).kpm;
  const [open, setOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Every office belongs to a company, and the directory is the only place a newcomer can
  // learn which companies exist.
  const companyId = companies?.[0]?.companyId ?? null;

  if (mine && mine.status === 'pending') {
    return (
      <Card className="mt-4">
        <p className="text-sm text-muted">{t.askedTitle}</p>
        <p className="mt-1 font-display text-xl font-bold text-navy">{mine.branchName}</p>
        <p className="mt-1 text-md text-muted">{t.askedLine({ company: mine.companyName })}</p>
      </Card>
    );
  }

  if (mine && mine.status === 'declined') {
    return (
      <Card className="mt-4">
        <h2 className="font-display text-lg font-bold text-navy">{t.declinedTitle({ branch: mine.branchName })}</h2>
        <p className="mt-1 text-md text-navy">{mine.reason ?? t.noReason}</p>
        <p className="mt-1 text-sm text-muted">{t.declinedLine}</p>
      </Card>
    );
  }

  async function ask() {
    if (!companyId) return;
    setBusy(true);
    setError(null);
    try {
      onAsked(await askForKpm({ companyId, branchName, note: note || undefined }));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4">
      <h2 className="font-display text-lg font-bold text-navy">{t.cannotFind}</h2>
      <p className="mt-1 text-md text-muted">{t.cannotFindLine}</p>

      {!open && (
        <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          {t.ask}
        </Button>
      )}

      {open && (
        <>
          {error && <ErrorBanner {...error} />}
          <Field label={t.branch} htmlFor="branch" className="mt-3">
            <TextInput
              id="branch"
              placeholder={t.branchExample}
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
            />
          </Field>
          <Field label={t.note} htmlFor="note" className="mt-3">
            <TextInput
              id="note"
              placeholder={t.noteExample}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          <Button
            className="mt-3"
            disabled={busy || !branchName.trim() || !companyId}
            onClick={() => void ask()}
          >
            {busy ? t.sending : t.send}
          </Button>
        </>
      )}
    </Card>
  );
}
