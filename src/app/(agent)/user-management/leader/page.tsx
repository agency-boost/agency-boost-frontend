'use client';

import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ButtonLink, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { RoleBadge, rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { PhoneTip } from '@/components/ui/phone-tip';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { userManagementMessages } from '@/i18n/messages/user-management';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
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
 *
 * Its words are the catalogue's (`user-management.ts`; P18.98-T4) — *Changing leader goes through your office admin.*,
 * the line a reader who has a leader sees in place of the search (ADR-0170 §6), verbatim among them. A leader's name,
 * their rung's badge and the office's label are shown as stored.
 *
 * **UI V1 (2026-10-30, Phase 18.99 T9).** **No invite card for somebody already in an office** (UI-086):
 * *Gunakan undangan saja* led to `/join`, which refuses anybody with a membership, with a leader or without one
 * (`GET /join/me`'s `kpmId` is the flag; widened from *with a leader* in T16). **One card for one fact** (UI-088): *Saat ini melapor ke* in sentence case over the
 * leader's name, and *Penggantian leader…* as 12px meta inside it — behind ⓘ on a phone; no orange left border. The
 * invite card's *Ketiganya sama saja…* behind ⓘ from 768px, not drawn on a phone (Appendix A). No sub-line below
 * 1024px (UI-087).
 */
export default function FindLeaderPage() {
  const words = useMessages(userManagementMessages);
  const confirmed = useMessages(confirmationMessages);
  const t = words.leader;
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
  /** An office with no leader to find: the company's rungs by their short names (OD-50), as the badges write them. */
  const noLeaders = t.noLeaders({ ab: rungShort('AB', ladder), aab: rungShort('AAB', ladder) });
  /** Somebody who already reports to a leader is not offered the search (P18.96-T3 AC-6, ADR-0170 §6). */
  const hasLeader = Boolean(state?.leaderMembershipId);

  useEffect(() => {
    if (!registered || hasLeader) return;
    void searchLeaders(q || undefined)
      .then(setLeaders)
      .catch((err) => {
        setError(toDisplayError(err));
        setLeaders([]);
      });
  }, [q, registered, hasLeader]);

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
      show(confirmed.requestSent);
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
      subtitle={t.subtitle}
      subtitleOnPhone={false}
      subtitleOnTablet={false}
    >
      <UserManagementTabs leaderLocked={!registered} />
      {error && <ErrorBanner {...error} />}

      {state === null && (
        <SkeletonCards count={2} label={t.loading} />
      )}

      {state && !registered && (
        <Card>
          <h2 className="font-display text-xl font-bold text-navy">{words.registerFirst}</h2>
          <p className="mt-1 text-md text-muted">{t.registerFirstLine}</p>
          <ButtonLink href="/user-management/kpm" className="mt-4">
            {t.goToRegister}
          </ButtonLink>
        </Card>
      )}

      {/*
        UI-086: offered only to somebody with no office yet. `/join` refuses anybody who already has one, so for a member
        with no leader the card was a dead end too; they ask a leader through the search above (decided 2026-10-30, T16).
      */}
      {state && !registered && (
        <Card className="mb-4">
          <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-navy">
            {t.haveCode}
            {/* Appendix A (UI-086): behind ⓘ from 768px; a phone has never shown it (P18.95-T7 AC-1, grey text row 1). */}
            <TippedGlyph glyph="ⓘ" name={t.haveCodeLine} tip={t.haveCodeLine} align="fit" className={cn('font-normal', REMOVED_ON_PHONE)} />
          </h2>
          <ButtonLink href="/join" variant="secondary" className="mt-3">
            {t.useInvite}
          </ButtonLink>
        </Card>
      )}

      {state && registered && (
        <>
          {hasLeader ? (
            /*
             * **Changing leader is the office's** (P18.96-T3 AC-6, ADR-0170 §6): the search stood here for a reader who
             * already has a leader, and every request they sent was refused. **One card for the one fact** (UI-088): whom
             * they report to as its title, the client's line as 12px meta inside it — behind ⓘ on a phone.
             */
            <Card data-testid="reporting-to">
              <p className="text-sm text-muted">{t.reportingTo}</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-display text-xl font-bold text-navy">
                {state.leaderName}
                <PhoneTip text={t.changingLeader} className="font-normal" />
              </p>
              <p className={cn('mt-1 text-sm text-muted', REMOVED_ON_PHONE)}>{t.changingLeader}</p>
            </Card>
          ) : (
          <Card>
            {/*
              * The client's words at every size (P18.95-T7 AC-1, grey text rows 3 and 2): *Find a leader*, where it
              * named the office the tabs above already sit in, and the approval in four words.
              */}
            <h2 className="font-display text-lg font-bold text-navy">{t.findALeader}</h2>
            <p className="mt-1 text-md text-muted">{t.needApprove}</p>

            <Field label={t.searchByName} htmlFor="leader-search" className="mt-3">
              <TextInput
                id="leader-search"
                placeholder={t.nameExample}
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
                      {l.unitSize === 0 ? t.noUnit : t.inUnit({ n: l.unitSize })}
                    </span>
                  </span>

                  {l.isCurrentLeader ? (
                    <StatusPill status="success" label={t.yourLeader} />
                  ) : l.requestSent ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill status="neutral" label={t.requestSent} />
                      <Button
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => void withdraw()}
                      >
                        {busy === 'cancel' ? t.withdrawing : t.withdraw}
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => void ask(l.membershipId)}
                    >
                      {busy === l.membershipId ? t.sending : t.sendRequest}
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            {leaders?.length === 0 && (
              <EmptyState
                variant={q ? 'filtered' : 'empty'}
                title={q ? t.noMatch : noLeaders}
              />
            )}
          </Card>
          )}

          {state.pendingRequestTo && (
            <p className="mt-4 text-md text-muted">{t.oneAtATime}</p>
          )}
        </>
      )}
      <Toast toast={toast} />
    </Page>
  );
}
