'use client';

import { useCallback, useEffect, useState } from 'react';
import { InviteShareBlock } from '@/components/invite-share-block';
import { LeaderLimitNotice, LeaderLimitWaiting, isLeaderLimit } from '@/components/leader-limit-notice';
import { RolePill } from '@/components/org-tree/role-pill';
import { Page } from '@/components/page';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { ActionMenu } from '@/components/ui/action-menu';
import { DestructiveRow, destructiveLast } from '@/components/ui/destructive-action';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, TextInput } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Avatar, PersonRow } from '@/components/ui/person-row';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { useToast } from '@/components/ui/toast';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { userManagementMessages } from '@/i18n/messages/user-management';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';
import { useSession } from '@/lib/session';
import { classOfRung, rungShort, useLadder } from '@/components/ui/role-badge';
import {
  askLeaderLimitApproval, cancelLeaderLimitRequest, pendingFor, readLeaderLimitRequests, requestedChange,
  type LeaderLimitRequestRow,
} from '@/lib/leader-limit-requests';
import { Skeleton, SkeletonBar, SkeletonPeople } from '@/components/ui/skeleton';
import {
  changeRole,
  readMyTeam,
  roleChangeExplanation,
  type TeamMember,
} from '@/lib/org';
import {
  isRemovalConfirmed,
  REMOVAL_CONFIRMATION,
  removeMember,
  type SubtreeDisposition,
} from '@/lib/org';
import {
  myLeaderCode,
  searchUntagged,
  tagUntagged,
  type MyLeaderCode,
  type UntaggedMember,
} from '@/lib/join';

/**
 * Add new agents → Invite (`Overall.html:3574-3596`, `User_Management_Section.html:446-454`).
 *
 * The prototype shows three tiles — link, leader code, QR — as if they were three things.
 * Its own copy says otherwise: *"any of the three registers your KPM and tags you to them
 * in one step"*. One code, three renderings, and all three are **copyable**: the prototype
 * has no control that creates one and none that withdraws one, and the only `Revoke`
 * anywhere in `prototype/` is for KPM Admin access.
 *
 * We had built both, plus a use limit, an expiry and a list of spent codes — none of it
 * registered as a divergence, which by this project's own rule made it a defect. P3.6-T1
 * removed it: the code comes with the membership and lasts as long as it does.
 *
 * Anyone who uses it joins **with no approval**. That is what the sentence under the
 * panel says, and it is the whole reason the code is worth guarding.
 *
 * Its words are the catalogue's (`user-management.ts`; P18.98-T4); a role change's sentence is `lib/org.ts`'
 * (`roleChangeExplanation`) and the leader limit's `leader-limit.tsx`', each handed the reader's language. *REMOVE*, the
 * word the server checks, is the same in both languages; names, agent codes, the leader code and its link are shown
 * as stored.
 *
 * **UI V1 (2026-10-30, Phase 18.99 T9).** *Undang seseorang* is the shared invite share block (UI-084, UI-090): the code
 * and one row of pill buttons with WhatsApp on a phone, the link · the code · WhatsApp · the QR from 768px, a copy
 * toasting *Tersalin ✓*. *Cari orang yang sudah ada di sini* is 64px divided rows with a round + on a phone (UI-082),
 * as it was from 768px. *Tim Anda* is the shared person rows with a role pill below 1024px and a compact table from
 * 1024px (UI-083): the pill opens the role sheet — the rungs as choice rows, *Keluarkan* last, red, asking first — and
 * a saved change toasts *Tersimpan ✓*. No native select, no red button on a row. No sub-line below 1024px (UI-087).
 */

export default function AddAgentsPage() {
  const t = useMessages(userManagementMessages).add;
  const saved = useMessages(uiV1Messages).save.saved;
  const language = useLanguage();
  const figures = useFigureLanguage();
  const { show } = useToast();
  /** Whose role sheet is open (UI-083), by membership. */
  const [roleSheet, setRoleSheet] = useState<string | null>(null);
  const { me } = useSession();
  const canManageTeam =
    me?.permissions.includes('member:change_role') ||
    me?.permissions.includes('member:remove_from_team');
  const [code, setCode] = useState<MyLeaderCode | null>(null);
  const [untagged, setUntagged] = useState<UntaggedMember[] | null>(null);
  const [pool, setPool] = useState('');
  const poolQuery = useDebounced(pool);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  // The company's ladder (OD-50): a rung it added is offered by its label, as the defaults are.
  const ladder = useLadder();
  // `toRole` is a rung's code lower-cased — `aab`, or a rung the company added.
  const [proposal, setProposal] = useState<{ member: TeamMember; toRole: string } | null>(null);
  /**
   * ADR-0157: what the leader limit just refused, so *Ask AgencyBoost to approve* asks for exactly that — a role
   * change with its reason, or letting an untagged pending leader into this unit — and the requests already open.
   */
  const [refused, setRefused] = useState<
    { membershipId: string; action: 'promote'; toRole: string; reason?: string }
    | { membershipId: string; action: 'activate' }
    | null
  >(null);
  const [asks, setAsks] = useState<LeaderLimitRequestRow[] | null>(null);
  const mayAsk = me?.permissions.includes('leader_limit_request:read') ?? false;
  const [roleReason, setRoleReason] = useState('');
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [removeWord, setRemoveWord] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [disposition, setDisposition] = useState<'reassign' | 'orphan'>('reassign');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [mineCode, mine] = await Promise.all([myLeaderCode(), readMyTeam()]);
      setCode(mineCode);
      setTeam(mine);
      // The requests this leader asked, for the rows waiting on AgencyBoost. A failed read shows none waiting.
      if (mayAsk) setAsks(await readLeaderLimitRequests().catch(() => []));
    } catch (err) {
      setError(toDisplayError(err));
      setCode(null);
      setTeam([]);
    }
  }, [mayAsk]);

  /** ADR-0157 §1: the write the limit refused, asked of AgencyBoost instead. */
  async function askApproval() {
    if (!refused) return;
    setBusy('ask');
    try {
      await askLeaderLimitApproval(refused.membershipId, refused.action === 'promote'
        ? { action: 'promote', orgLevelCode: refused.toRole, ...(refused.reason ? { reason: refused.reason } : {}) }
        : { action: 'activate' });
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

  async function applyRole() {
    if (!proposal) return;
    setBusy('role');
    setError(null);
    setRefused(null);
    try {
      setTeam(await changeRole(proposal.member.membershipId, proposal.toRole, roleReason.trim() || undefined));
      setProposal(null);
      setRoleReason('');
      setRoleSheet(null);
      // UI-083: the shared toast (UI-070), above the tab bar on a phone.
      show(saved);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      if (isLeaderLimit(shown)) {
        setRefused({
          membershipId: proposal.member.membershipId, action: 'promote', toRole: proposal.toRole,
          ...(roleReason.trim() ? { reason: roleReason.trim() } : {}),
        });
      }
      // Refused — reload so the pill shows what is true rather than what was picked, and close the sheet on the refusal.
      await load();
      setProposal(null);
      setRoleSheet(null);
    } finally {
      setBusy(null);
    }
  }

  function closeRemoval() {
    setRemoving(null);
    setRemoveWord('');
    setRemoveReason('');
    setDisposition('reassign');
  }

  async function applyRemoval() {
    if (!removing || !isRemovalConfirmed(removeWord)) return;
    setBusy('remove');
    setError(null);
    try {
      // Only sent when they actually lead people — the server refuses a disposition
      // for somebody who leads nobody, and rightly: it would be describing a move that
      // is not happening.
      const subtree: SubtreeDisposition | undefined =
        removing.directCount > 0
          ? disposition === 'orphan'
            ? { action: 'orphan' }
            : { action: 'reassign', toMembershipId: me?.membership?.membershipId ?? '' }
          : undefined;

      setTeam(
        await removeMember(removing.membershipId, {
          confirmation: removeWord,
          reason: removeReason.trim() || undefined,
          subtree,
        }),
      );
      closeRemoval();
    } catch (err) {
      setError(toDisplayError(err));
      await load();
      closeRemoval();
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // Clear first. Otherwise the previous query's results stay on screen while the new
    // ones are in flight — and since they look exactly like an answer, somebody types
    // three more letters and acts on a list that answers the search before it.
    setUntagged(null);
    void searchUntagged(poolQuery || undefined)
      .then(setUntagged)
      .catch((err) => {
        setError(toDisplayError(err));
        setUntagged([]);
      });
  }, [poolQuery]);

  async function add(membershipId: string) {
    setBusy(membershipId);
    setError(null);
    setRefused(null);
    try {
      setUntagged(await tagUntagged(membershipId));
      setConfirming(null);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      // A pending leader tagged past the limit: letting them in may be asked of AgencyBoost (ADR-0157 §1).
      if (isLeaderLimit(shown)) setRefused({ membershipId, action: 'activate' });
    } finally {
      setBusy(null);
    }
  }

  /** The role sheet's member, refreshed from the team the server last sent. */
  const sheetMember = roleSheet ? team?.find((m) => m.membershipId === roleSheet) ?? null : null;
  const rungLabel = (member: TeamMember) => rungShort(member.orgLevelCode ?? member.role.toUpperCase(), ladder);
  const meta = (member: TeamMember) =>
    `${member.agentCode} · ${member.directCount > 0 ? t.leadsCount({ n: member.directCount }) : t.reportsToYou}`;
  /** Every rung a direct leader may place somebody on, junior first, by label (OD-50): none that makes an AB. */
  const rungs = [...ladder]
    .filter((l) => l.status === 'active' && classOfRung(l) !== 'ab')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  function openRoleSheet(member: TeamMember) {
    setRoleSheet(member.membershipId);
    setProposal(null);
    setRoleReason('');
  }

  function closeRoleSheet() {
    setRoleSheet(null);
    setProposal(null);
    setRoleReason('');
  }

  function askRemoval(member: TeamMember) {
    closeRoleSheet();
    setRemoving(member);
    setRemoveWord('');
    setRemoveReason('');
    setDisposition('reassign');
  }

  /** The role pill of a row: its rung, tinted, with ⌄; it opens the role sheet (UI-083). 32px in a 44px target. */
  const rolePill = (member: TeamMember) => (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={t.changeRoleOf({ name: member.fullName, role: rungLabel(member) })}
      disabled={busy !== null}
      onClick={() => openRoleSheet(member)}
      className="flex h-11 items-center rounded-pill focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber disabled:opacity-60 lg:h-8"
    >
      <RolePill role={member.role} className="h-8 px-2.5 text-base font-semibold">
        {rungLabel(member)}
        <LineIcon name="chevronDown" className="h-4 w-4" />
      </RolePill>
    </button>
  );

  const waiting = (membershipId: string) => {
    const ask = pendingFor(asks, membershipId);
    return ask ? (
      <LeaderLimitWaiting
        what={requestedChange(ask, (code) => rungShort(code, ladder), language)}
        cancelling={busy === 'ask'}
        onCancel={() => void cancelAsk(ask.requestId)}
      />
    ) : null;
  };

  /** Inline, as the prototype does it — a modal for one row is heavier than the decision. */
  const confirmAdd = (membershipId: string) => (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-md text-navy">{t.addThem}</span>
      <Button variant="secondary" disabled={busy !== null} onClick={() => setConfirming(null)}>
        {t.cancel}
      </Button>
      <Button disabled={busy !== null} onClick={() => void add(membershipId)}>
        {busy === membershipId ? t.adding : t.confirm}
      </Button>
    </span>
  );

  return (
    <Page
      title={USER_MANAGEMENT_TITLE}
      subtitle={t.subtitle}
      // UI-087: no sub-line below 1024px; the desktop keeps it.
      subtitleOnPhone={false}
      subtitleOnTablet={false}
      // Hiding the tab is not gating the screen: the URL is typeable, and until now an
      // Agent who typed it got the whole thing, with only the API refusing the calls
      // behind it. `route-registry.md` has listed this route as AB · AAB since Phase 3.
      permission="member:search_untagged_pool"
    >
      <UserManagementTabs />
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

      {/*
        * *Undang seseorang* (UI-084, UI-090): the shared invite share block — on a phone the code and one row of pills
        * with WhatsApp, ~150px; from 768px the link, the code, WhatsApp and the QR in one row. The sentence under the
        * title is the client's at 768px and wider and gone on a phone (Appendix A).
        */}
      <Card className="mb-4 max-md:p-4">
        <h2 className="font-display text-lg font-bold text-navy max-md:text-[0.9375rem]">{t.inviteTitle}</h2>
        <p className={cn('mt-1 text-md text-muted', REMOVED_ON_PHONE)}>{t.inviteLine}</p>
        {code ? (
          <InviteShareBlock code={code.code} link={code.url} className="mt-2.5 md:mt-3" />
        ) : (
          <Skeleton label={t.loadingCode} className="mt-3">
            {/* The flex row goes inside: `Skeleton` puts its children in an aria-hidden wrapper. */}
            <div className="flex flex-wrap items-stretch gap-3.5">
              <SkeletonBar className="h-20 min-w-[260px] flex-1 max-md:h-11 max-md:min-w-0" />
              <SkeletonBar className="h-20 min-w-[170px] max-md:hidden" />
              <SkeletonBar className="h-20 w-24 max-md:hidden" />
            </div>
          </Skeleton>
        )}
      </Card>

      <Card className="mt-6 max-md:mt-4 max-md:p-4">
        <h2 className="font-display text-lg font-bold text-navy max-md:text-[0.9375rem]">{t.findTitle}</h2>
        {/* UI-082 (Appendix A): the client's words from 768px, gone on a phone. */}
        <p className={cn('mt-1 text-md text-muted', REMOVED_ON_PHONE)}>{t.findLine}</p>

        <Field label={t.searchByName} htmlFor="untagged-search" className="mt-3">
          <TextInput
            id="untagged-search"
            placeholder={t.nameExample}
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          />
        </Field>

        {untagged === null && (
          <SkeletonPeople count={3} label={t.searching} className="mt-3" />
        )}

        {untagged?.length === 0 && (
          <EmptyState
            variant={pool ? 'filtered' : 'empty'}
            title={pool ? t.noMatch : t.everybodyReports}
          />
        )}

        {/* UI-082, a phone: 64px divided rows, NAME and meta on one line each, a 44px round + on the right. */}
        <ul className="mt-2 flex flex-col md:hidden" data-testid="untagged-phone">
          {untagged?.map((member) => (
            <li key={member.membershipId} className="border-t border-divider first:border-t-0">
              <PersonRow
                name={member.fullName}
                seed={member.membershipId}
                height={64}
                avatarSize={40}
                className="px-0"
                nameClassName="text-md"
                meta={<span className="truncate">{member.agentCode} · {t.reportsToNobody}</span>}
                trailing={pendingFor(asks, member.membershipId) || confirming === member.membershipId ? undefined : (
                  <button
                    type="button"
                    aria-label={t.addToMyUnit}
                    disabled={busy !== null}
                    onClick={() => setConfirming(member.membershipId)}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber disabled:opacity-60"
                  >
                    <LineIcon name="plus" className="h-5 w-5" />
                  </button>
                )}
              />
              {pendingFor(asks, member.membershipId) ? <div className="pb-3">{waiting(member.membershipId)}</div>
                : confirming === member.membershipId ? <div className="pb-3">{confirmAdd(member.membershipId)}</div> : null}
            </li>
          ))}
        </ul>

        {/* From 768px: the rows as they were (UI-082: tablet and desktop unchanged). */}
        <ul className="mt-3 flex flex-col gap-2 max-md:hidden">
          {untagged?.map((member) => (
            <li
              key={member.membershipId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-hairline p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-md font-bold text-card">
                {member.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-md font-semibold text-navy">{member.fullName}</span>
                <span className="block text-sm text-muted">
                  {member.agentCode} · {t.reportsToNobody}
                </span>
              </span>

              {pendingFor(asks, member.membershipId) ? (
                // ADR-0157: letting this pending leader in waits for AgencyBoost.
                <div className="basis-full">{waiting(member.membershipId)}</div>
              ) : confirming === member.membershipId ? confirmAdd(member.membershipId) : (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => setConfirming(member.membershipId)}
                >
                  {t.addToMyUnit}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* Hidden from anybody who cannot act on a team. The prototype hides this card for
          an Agent alongside the Pending tab (`User_Management_Section.html:999`), and the
          reason it gives — that an Agent has no team — is not one we can rely on: OD-23
          makes leadership the graph, so an Agent may well have reports. What an Agent
          cannot do is change a role or remove somebody, and that is what this card is
          for, so the permission is the honest gate. */}
      {canManageTeam && (
      <Card className="mt-6 max-md:mt-4 max-md:p-4" data-testid="team-card">
        {/*
          * *Tim Anda* (UI-083): the count beside the title and the client's sentence behind ⓘ at every size (Appendix A);
          * no *Peran* label, no native select, no red button on a row.
          */}
        <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-navy max-md:text-[0.9375rem]">
          {t.teamTitle}
          {team && team.length > 0 && <span className="text-base font-medium text-muted">{formatNumber(team.length, {}, figures)}</span>}
          <TippedGlyph glyph="ⓘ" name={t.teamLine} tip={t.teamLine} align="fit" className="font-normal" />
        </h2>

        {team === null && (
          <SkeletonPeople count={3} label={t.loadingUnit} className="mt-3" />
        )}

        {team?.length === 0 && <EmptyState title={t.nobodyReports} />}

        {/* A phone and a tablet: 64px divided rows, the role pill at the right (UI-083). */}
        <ul className="mt-2 flex flex-col lg:hidden" data-testid="team-rows">
          {team?.map((member) => (
            <li key={member.membershipId} className="border-t border-divider first:border-t-0">
              <PersonRow
                name={member.fullName}
                seed={member.membershipId}
                height={64}
                avatarSize={40}
                className="px-0"
                nameClassName="text-md"
                meta={<span className="truncate">{meta(member)}</span>}
                trailing={rolePill(member)}
              />
              {pendingFor(asks, member.membershipId) && <div className="pb-3">{waiting(member.membershipId)}</div>}
            </li>
          ))}
        </ul>

        {/* From 1024px: a compact table — Nama · Kode · Status · Peran ⌄ · ⋮, *Keluarkan* in the ⋮ (UI-083). */}
        {team && team.length > 0 && (
          <div className="mt-2 max-w-[880px] max-lg:hidden" data-testid="team-table">
            <div aria-hidden="true" className="grid h-9 grid-cols-[minmax(0,300px)_90px_minmax(0,1fr)_120px_44px] items-center text-sm text-muted">
              <span>{t.columns.name}</span>
              <span>{t.columns.code}</span>
              <span>{t.columns.status}</span>
              <span>{t.role}</span>
              <span />
            </div>
            <ul>
              {team.map((member) => (
                <li key={member.membershipId} data-member={member.membershipId} className="border-t border-divider">
                  <div className="grid h-14 grid-cols-[minmax(0,300px)_90px_minmax(0,1fr)_120px_44px] items-center text-md">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={member.fullName} seed={member.membershipId} size={36} />
                      <span className="truncate font-bold uppercase tracking-[0.2px] text-ink">{member.fullName}</span>
                    </span>
                    <span><span className="sr-only">{t.columns.code}: </span>{member.agentCode}</span>
                    <span className="truncate text-muted">
                      {member.directCount > 0 ? t.leadsCount({ n: member.directCount }) : t.reportsToYou}
                    </span>
                    <span>{rolePill(member)}</span>
                    <span className="flex justify-end">
                      <ActionMenu
                        label={t.actionsFor({ name: member.fullName })}
                        items={destructiveLast([
                          { label: t.remove, tone: 'alert', disabled: busy !== null, onSelect: () => askRemoval(member) },
                        ])}
                      />
                    </span>
                  </div>
                  {pendingFor(asks, member.membershipId) && <div className="pb-3">{waiting(member.membershipId)}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      )}

      {/*
        * The role sheet (UI-083): the rungs as choice rows, the sentence behind ⓘ, and *Keluarkan* last, red, asking first.
        * A bottom sheet below 1024px, a centred modal from 1024px (the shared sheet). Picking another rung says what the
        * change does and asks why — the role change log is the only place it is read back — before it is saved.
        */}
      <ResponsiveSheet
        open={sheetMember !== null}
        title={sheetMember?.fullName ?? ''}
        description={sheetMember ? meta(sheetMember) : undefined}
        onClose={closeRoleSheet}
        footer={proposal && sheetMember ? (
          <Button className="w-full" disabled={busy !== null} onClick={() => void applyRole()}>
            {busy === 'role' ? t.changing : t.confirmChange}
          </Button>
        ) : undefined}
      >
        {sheetMember && (
          <div>
            {sheetMember.canChangeRole ? (
              <fieldset>
                <legend className="mb-2 flex items-center gap-1.5 text-base font-semibold text-muted">
                  {t.role}
                  <TippedGlyph glyph="ⓘ" name={t.teamLine} tip={t.teamLine} align="fit" />
                </legend>
                <div className="flex flex-col gap-2">
                  {rungs.map((rung) => {
                    const value = rung.code.toLowerCase();
                    const current = (sheetMember.orgLevelCode ?? sheetMember.role).toLowerCase();
                    const chosen = (proposal?.toRole ?? current) === value;
                    return (
                      <label
                        key={rung.code}
                        className={cn(
                          'flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-pill px-4 text-md text-ink',
                          chosen ? 'border-2 border-amber bg-amber/[0.12] font-semibold' : 'border-2 border-transparent bg-base',
                        )}
                      >
                        <input
                          type="radio"
                          name="role-choice"
                          value={value}
                          checked={chosen}
                          disabled={busy !== null}
                          onChange={() => setProposal(value === current ? null : { member: sheetMember, toRole: value })}
                          className="h-5 w-5 accent-amber"
                        />
                        {rung.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              // An AB report never gets the control, whoever is looking. The server decides that and sends the answer.
              <p className="flex items-center gap-2 text-md text-ink">
                {t.role}
                <RolePill role={sheetMember.role}>{rungLabel(sheetMember)}</RolePill>
              </p>
            )}

            {proposal && (
              <div className="mt-3">
                <p className="text-md text-navy">
                  {roleChangeExplanation(
                    proposal.member.fullName,
                    proposal.member.orgLevelCode ?? proposal.member.role,
                    proposal.toRole,
                    // A leader's own team: the prototype's wording is true here.
                    'their-leader',
                    ladder,
                    language,
                  )}
                </p>
                <Field label={t.why} htmlFor="role-reason" hint={t.roleWhyHint} className="mt-3">
                  <TextInput
                    id="role-reason"
                    value={roleReason}
                    onChange={(e) => setRoleReason(e.target.value)}
                    placeholder={t.roleWhyExample}
                  />
                </Field>
              </div>
            )}

            {pendingFor(asks, sheetMember.membershipId) && <div className="mt-3">{waiting(sheetMember.membershipId)}</div>}

            <DestructiveRow label={t.remove} disabled={busy !== null} onClick={() => askRemoval(sheetMember)} className="mt-4" />
          </div>
        )}
      </ResponsiveSheet>

      {/*
        * *Keluarkan*'s confirmation (UI-083: last, red, asked first): what removal does, where their reports go, why, and
        * the word the server checks — the same step as before, in the shared sheet.
        */}
      <ResponsiveSheet
        open={removing !== null}
        title={removing ? t.removeTitle({ name: removing.fullName }) : ''}
        onClose={closeRemoval}
        footer={removing ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              disabled={busy !== null || !isRemovalConfirmed(removeWord)}
              onClick={() => void applyRemoval()}
            >
              {busy === 'remove' ? t.removing : t.removeFromTeam}
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={closeRemoval}>
              {t.cancel}
            </Button>
          </div>
        ) : undefined}
      >
        {removing && (
          <div>
            <p className="text-md text-navy">{t.removeLine}</p>
            <p className="mt-1 text-sm text-muted">{t.removeNote}</p>

            {removing.directCount > 0 && (
              <fieldset className="mt-3 rounded-md border border-hairline p-3">
                <legend className="px-1 text-sm font-semibold text-navy">
                  {t.reportsToThem({ n: removing.directCount })}
                </legend>
                <p className="text-sm text-muted">{t.sayWhere}</p>
                <label className="mt-2 flex min-h-11 items-center gap-2 text-md text-navy">
                  <input
                    type="radio"
                    name="disposition"
                    value="reassign"
                    checked={disposition === 'reassign'}
                    onChange={() => setDisposition('reassign')}
                  />
                  {t.moveToMyUnit}
                </label>
                <label className="mt-1 flex min-h-11 items-center gap-2 text-md text-navy">
                  <input
                    type="radio"
                    name="disposition"
                    value="orphan"
                    checked={disposition === 'orphan'}
                    onChange={() => setDisposition('orphan')}
                  />
                  {t.leaveUnassigned}
                </label>
              </fieldset>
            )}

            <Field label={t.why} htmlFor="remove-reason" hint={t.removeWhyHint} className="mt-3">
              <TextInput
                id="remove-reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder={t.removeWhyExample}
              />
            </Field>

            <Field label={t.typeToConfirm({ word: REMOVAL_CONFIRMATION })} htmlFor="remove-confirm" className="mt-3">
              <TextInput
                id="remove-confirm"
                value={removeWord}
                autoComplete="off"
                placeholder={t.typeWord({ word: REMOVAL_CONFIRMATION })}
                onChange={(e) => setRemoveWord(e.target.value)}
              />
            </Field>
          </div>
        )}
      </ResponsiveSheet>
    </Page>
  );
}
