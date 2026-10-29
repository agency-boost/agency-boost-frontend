'use client';

import { useCallback, useEffect, useState } from 'react';
import { LeaderLimitNotice, LeaderLimitWaiting, isLeaderLimit } from '@/components/leader-limit-notice';
import { Page } from '@/components/page';
import { USER_MANAGEMENT_TITLE, UserManagementTabs } from '@/components/user-management-tabs';
import { CopyableValue } from '@/components/ui/copyable-value';
import { InviteQr } from '@/components/ui/invite-qr';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { userManagementMessages } from '@/i18n/messages/user-management';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { confirmationMessages } from '@/i18n/messages/confirmations';
import { useDebounced } from '@/lib/use-debounced';
import { useSession } from '@/lib/session';
import { RoleBadge, classOfRung, rungShort, useLadder } from '@/components/ui/role-badge';
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
 */

export default function AddAgentsPage() {
  const t = useMessages(userManagementMessages).add;
  const confirmed = useMessages(confirmationMessages);
  const language = useLanguage();
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
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      if (isLeaderLimit(shown)) {
        setRefused({
          membershipId: proposal.member.membershipId, action: 'promote', toRole: proposal.toRole,
          ...(roleReason.trim() ? { reason: roleReason.trim() } : {}),
        });
      }
      // Refused — reload so the select shows what is true rather than what was picked.
      await load();
      setProposal(null);
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

  return (
    <Page
      title={USER_MANAGEMENT_TITLE}
      subtitle={t.subtitle}
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

      <Card className="mb-4">
        <h2 className="font-display text-lg font-bold text-navy">{t.inviteTitle}</h2>
        {/* The client's words at every size (P18.95-T7 AC-1, grey text row 4). */}
        <p className="mt-1 text-md text-muted">{t.inviteLine}</p>
        {/* `User_Management_Section.html:444-455`: a wrapping row of co-equal artefacts,
            the link box growing and the code box holding its width — not an even grid.
            The section file supersedes `Overall.html` for this module, and its version
            shows the **full** URL rather than a truncated one. */}
        {code ? (
          <div className="mt-3 flex flex-wrap items-stretch gap-3.5">
            <div className="min-w-[260px] flex-1">
              <CopyableValue
                label={t.inviteLink}
                value={code.url}
                action={t.copyLink}
                border="dashed"
                copied={confirmed.linkCopied}
              />
            </div>
            <div className="min-w-[170px]">
              <CopyableValue label={t.leaderCode} value={code.code} mono action={t.copyCode} copied={confirmed.codeCopied} />
            </div>
            {/* The third artefact (`:454`). The prototype's is a static tile; ours draws
                the real code, which is the whole point of offering one. */}
            <InviteQr url={code.url} />
          </div>
        ) : (
          <Skeleton label={t.loadingCode} className="mt-3">
            {/* The flex row goes inside: `Skeleton` puts its children in an aria-hidden
                wrapper, so layout classes on the outer element would arrange that wrapper
                and the sr-only label rather than the bars. */}
            <div className="flex flex-wrap items-stretch gap-3.5">
              <SkeletonBar className="h-20 min-w-[260px] flex-1" />
              <SkeletonBar className="h-20 min-w-[170px]" />
              <SkeletonBar className="h-20 w-24" />
            </div>
          </Skeleton>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold text-navy">{t.findTitle}</h2>
        {/* The client's words at every size (P18.95-T7 AC-1, grey text row 5). */}
        <p className="mt-1 text-md text-muted">{t.findLine}</p>

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

        <ul className="mt-3 flex flex-col gap-2">
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
                <div className="basis-full">
                  <LeaderLimitWaiting
                    what={requestedChange(pendingFor(asks, member.membershipId)!, (code) => rungShort(code, ladder), language)}
                    cancelling={busy === 'ask'}
                    onCancel={() => void cancelAsk(pendingFor(asks, member.membershipId)!.requestId)}
                  />
                </div>
              ) : confirming === member.membershipId ? (
                // Inline, as the prototype does it — a modal for one row is heavier than
                // the decision.
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-md text-navy">{t.addThem}</span>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    {t.cancel}
                  </Button>
                  <Button disabled={busy !== null} onClick={() => void add(member.membershipId)}>
                    {busy === member.membershipId ? t.adding : t.confirm}
                  </Button>
                </span>
              ) : (
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
      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold text-navy">{t.teamTitle}</h2>
        {/* The client's *Remove* on a phone (P18.95-T7 AC-1, grey text row 6): its words stay from 768px. */}
        <p className={cn('mt-1 text-md text-muted', REMOVED_ON_PHONE)}>{t.teamLine}</p>

        {team === null && (
          <SkeletonPeople count={3} label={t.loadingUnit} className="mt-3" />
        )}

        {team?.length === 0 && <EmptyState title={t.nobodyReports} />}

        <ul className="mt-3 flex flex-col gap-2">
          {team?.map((member) => (
            <li
              key={member.membershipId}
              className="flex flex-wrap items-center gap-3 rounded-md border border-hairline p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-soft text-md font-bold text-card">
                {member.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-md font-semibold text-navy">{member.fullName}</span>
                <span className="block text-sm text-muted">
                  {member.agentCode} ·{' '}
                  {member.directCount > 0 ? t.leadsCount({ n: member.directCount }) : t.reportsToYou}
                </span>
              </span>

              {member.canChangeRole ? (
                <Field
                  label={t.role}
                  htmlFor={`role-${member.membershipId}`}
                  className="w-52"
                >
                  <Select
                    id={`role-${member.membershipId}`}
                    value={(member.orgLevelCode ?? member.role).toLowerCase()}
                    disabled={busy !== null}
                    onChange={(e) => setProposal({ member, toRole: e.target.value })}
                  >
                    {/* The company's ladder, junior first, by label (OD-50) — every rung a direct leader may
                        place somebody on: none that makes an AB, which is the office's to do. */}
                    {[...ladder]
                      .filter((l) => l.status === 'active' && classOfRung(l) !== 'ab')
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((l) => (
                        <option key={l.code} value={l.code.toLowerCase()}>{l.label}</option>
                      ))}
                  </Select>
                </Field>
              ) : (
                // An AB report never gets the control, whoever is looking. The server
                // decides that and sends the answer; this only renders it.
                <RoleBadge role={member.role} />
              )}

              {pendingFor(asks, member.membershipId) && (
                <div className="basis-full">
                  <LeaderLimitWaiting
                    what={requestedChange(pendingFor(asks, member.membershipId)!, (code) => rungShort(code, ladder), language)}
                    cancelling={busy === 'ask'}
                    onCancel={() => void cancelAsk(pendingFor(asks, member.membershipId)!.requestId)}
                  />
                </div>
              )}

              <Button
                variant="danger"
                aria-label={t.removeName({ name: member.fullName })}
                disabled={busy !== null}
                onClick={() => {
                  setProposal(null);
                  setRemoving(member);
                  setRemoveWord('');
                  setRemoveReason('');
                  setDisposition('reassign');
                }}
              >
                {t.remove}
              </Button>
            </li>
          ))}
        </ul>

        {proposal && (
          <div className="mt-4 rounded-md border border-amber bg-base p-4">
            <h3 className="font-display text-md font-bold text-navy">{t.changeRoleTitle({ name: proposal.member.fullName })}</h3>
            <p className="mt-1 text-md text-navy">
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

            <Field
              label={t.why}
              htmlFor="role-reason"
              hint={t.roleWhyHint}
              className="mt-3"
            >
              <TextInput
                id="role-reason"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder={t.roleWhyExample}
              />
            </Field>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={busy !== null} onClick={() => void applyRole()}>
                {busy === 'role' ? t.changing : t.confirmChange}
              </Button>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => {
                  setProposal(null);
                  setRoleReason('');
                }}
              >
                {t.cancel}
              </Button>
            </div>
          </div>
        )}

        {removing && (
          <div className="mt-4 rounded-md border border-alert bg-base p-4">
            <h3 className="font-display text-md font-bold text-navy">{t.removeTitle({ name: removing.fullName })}</h3>
            <p className="mt-1 text-md text-navy">{t.removeLine}</p>
            <p className="mt-1 text-sm text-muted">{t.removeNote}</p>

            {removing.directCount > 0 && (
              <fieldset className="mt-3 rounded-md border border-hairline p-3">
                <legend className="px-1 text-sm font-semibold text-navy">
                  {t.reportsToThem({ n: removing.directCount })}
                </legend>
                <p className="text-sm text-muted">{t.sayWhere}</p>
                <label className="mt-2 flex items-center gap-2 text-md text-navy">
                  <input
                    type="radio"
                    name="disposition"
                    value="reassign"
                    checked={disposition === 'reassign'}
                    onChange={() => setDisposition('reassign')}
                  />
                  {t.moveToMyUnit}
                </label>
                <label className="mt-1 flex items-center gap-2 text-md text-navy">
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

            <Field
              label={t.why}
              htmlFor="remove-reason"
              hint={t.removeWhyHint}
              className="mt-3"
            >
              <TextInput
                id="remove-reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder={t.removeWhyExample}
              />
            </Field>

            <Field
              label={t.typeToConfirm({ word: REMOVAL_CONFIRMATION })}
              htmlFor="remove-confirm"
              className="mt-3"
            >
              <TextInput
                id="remove-confirm"
                value={removeWord}
                autoComplete="off"
                placeholder={t.typeWord({ word: REMOVAL_CONFIRMATION })}
                onChange={(e) => setRemoveWord(e.target.value)}
              />
            </Field>

            <div className="mt-3 flex flex-wrap gap-2">
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
          </div>
        )}
      </Card>
      )}
    </Page>
  );
}
