'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { PhoneTip } from '@/components/ui/phone-tip';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { userManagementMessages } from '@/i18n/messages/user-management';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { listInsurers, type Insurer } from '@/lib/companies';
import {
  askForKpm,
  readJoinState,
  readMyKpmRequestState,
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
 * Its words are the catalogue's (`user-management.ts`; P18.10-T4): *office* is *KPM* in Indonesian (§B.9). An office's
 * company, code and branch are shown as stored.
 *
 * **UI V1 (2026-10-30, Phase 18.11 T9; UI-088, UI-087).** One card for the one fact: *KPM terdaftar* in sentence case,
 * the office as its title, *Pindah ke KPM lain…* as 12px meta inside it — behind ⓘ on a phone (Appendix A); no
 * uppercase eyebrow and no orange left border, here or on *Anda mengajukan KPM*. No sub-line below 1024px.
 *
 * **P19-T2 (ADR-0191 §1; UI-164, UI-165, UI-166 item 4).** The directory lists only the reader's own company's offices
 * (the API scopes it), and a request is for that company — never the first search result's, which filed a Manulife
 * applicant as Prudential and left the button dead when the search was empty. *Kirim permintaan* needs only the branch
 * name; an account with no company is asked for one in the same card. Registered with nobody asked, the card says the
 * next step, not *"menunggu leader"*.
 */
export default function RegisterKpmPage() {
  const words = useMessages(userManagementMessages);
  const t = words.kpm;
  const [state, setState] = useState<JoinState | null>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<KpmDirectoryEntry[] | null>(null);
  const [mine, setMine] = useState<MyKpmRequest | null>(null);
  /** The company the reader signed up with: a request is for it. `null` until read, or for an account with none. */
  const [ownCompany, setOwnCompany] = useState<{ companyId: string; name: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void readJoinState().then(setState).catch((err) => setError(toDisplayError(err)));
  }, []);

  useEffect(() => {
    void readMyKpmRequestState()
      .then(({ request, company }) => { setMine(request); setOwnCompany(company); })
      .catch(() => setMine(null));
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
            {/* UI-166 item 4: "waiting for a leader" only once a leader has been asked. */}
            {state.status !== 'pending' ? t.activeLine : state.pendingRequestTo ? t.pendingLine : t.registeredLine}
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-md font-bold text-secondary-contrast">
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
          <AskForKpm mine={mine} ownCompany={ownCompany} onAsked={setMine} />
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
  ownCompany,
  onAsked,
}: {
  mine: MyKpmRequest | null;
  ownCompany: { companyId: string; name: string } | null;
  onAsked: (r: MyKpmRequest) => void;
}) {
  const t = useMessages(userManagementMessages).kpm;
  const [open, setOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [note, setNote] = useState('');
  const [chosen, setChosen] = useState('');
  const [insurers, setInsurers] = useState<Insurer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /*
   * **The applicant's own company** (ADR-0191 §1, P19-T2 AC-2, AC-3): the API files the request for it, so nothing is
   * sent. It was the directory's first result — another company's, or nothing, which left the button dead (UI-164).
   * Only an account that signed up with no company chooses one, here, from the insurers registration offers.
   */
  const needsCompany = ownCompany === null;
  useEffect(() => {
    if (!open || !needsCompany || insurers) return;
    void listInsurers().then(setInsurers).catch(() => setInsurers([]));
  }, [open, needsCompany, insurers]);

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
    if (needsCompany && !chosen) return;
    setBusy(true);
    setError(null);
    try {
      onAsked(await askForKpm({
        ...(needsCompany ? { companyId: chosen } : {}), branchName: branchName.trim(), note: note.trim() || undefined,
      }));
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
          {needsCompany ? (
            // AC-2: the one thing missing, asked for in this card, saying what it is.
            <Field label={t.company} htmlFor="company" hint={t.noCompanyLine} className="mt-3">
              <Select id="company" value={chosen} onChange={(e) => setChosen(e.target.value)}>
                <option value="">{t.chooseCompany}</option>
                {insurers?.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </Field>
          ) : (
            <p className="mt-3 text-md text-navy">{t.companyFor({ company: ownCompany.name })}</p>
          )}
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
            // UI-164: enabled once the branch is named — the note is optional, and the company is the account's.
            disabled={busy || !branchName.trim() || (needsCompany && !chosen)}
            onClick={() => void ask()}
          >
            {busy ? t.sending : t.send}
          </Button>
        </>
      )}
    </Card>
  );
}
