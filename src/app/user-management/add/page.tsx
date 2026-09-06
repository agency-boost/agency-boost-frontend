'use client';

import { useCallback, useEffect, useState } from 'react';
import { AgentShell } from '@/components/agent-shell';
import { CopyableValue } from '@/components/ui/copyable-value';
import { InviteQr } from '@/components/ui/invite-qr';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useSession } from '@/lib/session';
import { RoleBadge } from '@/components/ui/role-badge';
import {
  changeRole,
  readMyTeam,
  roleChangeExplanation,
  type HierarchyRole,
  type TeamMember,
} from '@/lib/org';
import {
  isRemovalConfirmed,
  REMOVAL_CONFIRMATION,
  removeMember,
  type SubtreeDisposition,
} from '@/lib/org';
import {
  INVITE_STATE_LABEL,
  issueInvite,
  listInvites,
  revokeInvite,
  searchUntagged,
  tagUntagged,
  type Invite,
  type UntaggedMember,
} from '@/lib/join';

/**
 * Add new agents → Invite (`Overall.html:3574-3596`).
 *
 * The prototype shows three tiles — link, leader code, QR — as if they were three
 * things. Its own copy says otherwise: *"any of the three registers your KPM and tags
 * you to them in one step"*. So there is one invite, shown two ways, and withdrawing it
 * withdraws both. The QR is the link rendered, which is a picture of a string we already
 * show; it is not drawn until somebody asks for it rather than shipped as the dead
 * button the prototype has.
 *
 * Anyone who uses one joins **with no approval**, which is why issuing offers a limit
 * and an expiry, and why the list keeps withdrawn ones.
 */
const NEVER = '';

export default function AddAgentsPage() {
  const { me } = useSession();
  const canManageTeam =
    me?.permissions.includes('member:change_role') ||
    me?.permissions.includes('member:remove_from_team');
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState(NEVER);
  const [expiresInDays, setExpiresInDays] = useState(NEVER);
  const [untagged, setUntagged] = useState<UntaggedMember[] | null>(null);
  const [pool, setPool] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [proposal, setProposal] = useState<{ member: TeamMember; toRole: HierarchyRole } | null>(null);
  const [roleReason, setRoleReason] = useState('');
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [removeWord, setRemoveWord] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [disposition, setDisposition] = useState<'reassign' | 'orphan'>('reassign');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [issued, mine] = await Promise.all([listInvites(), readMyTeam()]);
      setInvites(issued);
      setTeam(mine);
    } catch (err) {
      setError(toDisplayError(err));
      setInvites([]);
      setTeam([]);
    }
  }, []);

  async function applyRole() {
    if (!proposal) return;
    setBusy('role');
    setError(null);
    try {
      setTeam(await changeRole(proposal.member.membershipId, proposal.toRole, roleReason.trim() || undefined));
      setProposal(null);
      setRoleReason('');
    } catch (err) {
      setError(toDisplayError(err));
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
    void searchUntagged(pool || undefined)
      .then(setUntagged)
      .catch((err) => {
        setError(toDisplayError(err));
        setUntagged([]);
      });
  }, [pool]);

  async function add(membershipId: string) {
    setBusy(membershipId);
    setError(null);
    try {
      setUntagged(await tagUntagged(membershipId));
      setConfirming(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function issue(event: React.FormEvent) {
    event.preventDefault();
    setBusy('issue');
    setError(null);
    try {
      await issueInvite({
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(maxUses ? { maxUses: Number(maxUses) } : {}),
        ...(expiresInDays ? { expiresInDays: Number(expiresInDays) } : {}),
      });
      setLabel('');
      setMaxUses(NEVER);
      setExpiresInDays(NEVER);
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(inviteId: string) {
    setBusy(inviteId);
    setError(null);
    try {
      await revokeInvite(inviteId);
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(null);
    }
  }

  const live = invites?.filter((i) => i.state === 'active') ?? [];

  return (
    <AgentShell
      subtabs
      title="Add New Agents"
      subtitle="Invite new people or tag existing agents to your team."
    >
      {error && <ErrorBanner {...error} />}

      <Card className="mb-4">
        <h2 className="font-display text-lg font-bold text-navy">Invite someone</h2>
        <p className="mt-1 text-md text-muted">
          Anyone who uses one of your invites joins this office tagged to you, straight away.
          Nobody approves it — which is why an invite can be limited, given an end date, and
          withdrawn.
        </p>

        <form onSubmit={issue} className="mt-4 flex flex-wrap items-end gap-3">
          <Field
            label="What is it for"
            htmlFor="label"
            hint="A note for you. Whoever uses it never sees this."
            className="min-w-56 flex-1"
          >
            <TextInput
              id="label"
              placeholder="Hiring push, September"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>

          <Field label="How many people" htmlFor="maxUses" className="w-44">
            <Select id="maxUses" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}>
              <option value={NEVER}>No limit</option>
              <option value="1">Just one</option>
              <option value="5">Up to 5</option>
              <option value="25">Up to 25</option>
            </Select>
          </Field>

          <Field label="Stops working" htmlFor="expiresInDays" className="w-44">
            <Select
              id="expiresInDays"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            >
              <option value={NEVER}>Until I withdraw it</option>
              <option value="1">Tomorrow</option>
              <option value="7">In a week</option>
              <option value="30">In a month</option>
            </Select>
          </Field>

          <Button type="submit" disabled={busy !== null}>
            {busy === 'issue' ? 'Creating…' : 'Create an invite'}
          </Button>
        </form>
      </Card>

      {live.length > 0 && (
        <Card className="mb-4">
          <h2 className="font-display text-lg font-bold text-navy">Share it</h2>
          <p className="mt-1 text-md text-muted">
            Share your link, code, or QR with someone who is not registered yet. Any of the
            three pre-fills them into this office and tags them to you automatically — no
            approval needed. Withdrawing the invite stops all three, because they are one
            invite.
          </p>
          {/* `User_Management_Section.html:444-455`: a wrapping row of co-equal artefacts,
              the link box growing and the code box holding its width — not an even grid.
              The section file supersedes `Overall.html` for this module, and its version
              shows the **full** URL rather than a truncated one. */}
          <div className="mt-3 flex flex-wrap items-stretch gap-3.5">
            <div className="min-w-[260px] flex-1">
              <CopyableValue
                label="Invite link"
                value={live[0].url}
                action="Copy link"
                border="dashed"
              />
            </div>
            <div className="min-w-[170px]">
              <CopyableValue label="Leader code" value={live[0].code} mono action="Copy code" />
            </div>
            {/* The third artefact (`:454`). The prototype's is a static tile; ours draws
                the real code, which is the whole point of offering one. */}
            <InviteQr url={live[0].url} />
          </div>
        </Card>
      )}

      <h2 className="mb-3 font-display text-lg font-bold text-navy">Your invites</h2>

      {invites === null && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {invites?.length === 0 && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState title="You have not made an invite yet." />
        </div>
      )}

      {invites && invites.length > 0 && (
        <DataTable
          caption="Invites you have issued"
          columns={['Code', 'What for', 'Used', 'Ends', 'State', { label: 'Actions', visuallyHidden: true }]}
        >
          {invites.map((invite) => (
            <Row key={invite.inviteId}>
              <Cell>
                <code className="text-sm font-semibold">{invite.code}</code>
              </Cell>
              <Cell className="text-muted">{invite.label ?? '—'}</Cell>
              <Cell className="text-muted">
                {invite.useCount}
                {invite.maxUses === null ? '' : ` of ${invite.maxUses}`}
              </Cell>
              <Cell className="text-muted">
                {invite.expiresAt
                  ? new Date(invite.expiresAt).toLocaleDateString('en-GB')
                  : 'When you withdraw it'}
              </Cell>
              <Cell>
                <StatusPill
                  status={invite.state === 'active' ? 'success' : 'neutral'}
                  label={INVITE_STATE_LABEL[invite.state]}
                />
              </Cell>
              <Cell>
                {invite.state === 'active' ? (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => void withdraw(invite.inviteId)}
                  >
                    {busy === invite.inviteId ? 'Withdrawing…' : 'Withdraw'}
                  </Button>
                ) : (
                  // Kept rather than removed: what has been out there is worth seeing,
                  // not only what still works.
                  <span className="text-sm text-muted">—</span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold text-navy">Find someone already here</h2>
        <p className="mt-1 text-md text-muted">
          People registered in this office who report to nobody. Adding them puts them in your unit
          right away — they do not have to approve it, because the office has already let them in.
        </p>

        <Field label="Search by name" htmlFor="untagged-search" className="mt-3">
          <TextInput
            id="untagged-search"
            placeholder="Name"
            value={pool}
            onChange={(e) => setPool(e.target.value)}
          />
        </Field>

        {untagged === null && (
          <p role="status" className="mt-3 text-md text-muted">
            Loading…
          </p>
        )}

        {untagged?.length === 0 && (
          <EmptyState
            variant={pool ? 'filtered' : 'empty'}
            title={
              pool
                ? 'No untagged agents match that search.'
                : 'Everybody in this office already reports to somebody.'
            }
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
                  {member.agentCode} · reports to nobody
                </span>
              </span>

              {confirming === member.membershipId ? (
                // Inline, as the prototype does it — a modal for one row is heavier than
                // the decision.
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-md text-navy">Add them to your unit?</span>
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={busy !== null} onClick={() => void add(member.membershipId)}>
                    {busy === member.membershipId ? 'Adding…' : 'Confirm'}
                  </Button>
                </span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => setConfirming(member.membershipId)}
                >
                  Add to my unit
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
        <h2 className="font-display text-lg font-bold text-navy">Your team</h2>
        <p className="mt-1 text-md text-muted">
          People who report to you. Only somebody&apos;s direct leader can change their role, and
          changing it moves nobody — they keep reporting to you either way.
        </p>

        {team === null && (
          <p role="status" className="mt-3 text-md text-muted">
            Loading…
          </p>
        )}

        {team?.length === 0 && <EmptyState title="Nobody reports to you yet." />}

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
                  {member.directCount > 0
                    ? `leads ${member.directCount}`
                    : 'reports to you'}
                </span>
              </span>

              {member.canChangeRole ? (
                <Field
                  label="Role"
                  htmlFor={`role-${member.membershipId}`}
                  className="w-52"
                >
                  <Select
                    id={`role-${member.membershipId}`}
                    value={member.role}
                    disabled={busy !== null}
                    onChange={(e) =>
                      setProposal({ member, toRole: e.target.value as HierarchyRole })
                    }
                  >
                    <option value="agent">Agent</option>
                    <option value="aab">Associate Agency Builder</option>
                  </Select>
                </Field>
              ) : (
                // An AB report never gets the control, whoever is looking. The server
                // decides that and sends the answer; this only renders it.
                <RoleBadge role={member.role} />
              )}

              <Button
                variant="danger"
                aria-label={`Remove ${member.fullName}`}
                disabled={busy !== null}
                onClick={() => {
                  setProposal(null);
                  setRemoving(member);
                  setRemoveWord('');
                  setRemoveReason('');
                  setDisposition('reassign');
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>

        {proposal && (
          <div className="mt-4 rounded-md border border-amber bg-base p-4">
            <h3 className="font-display text-md font-bold text-navy">
              Change {proposal.member.fullName}&apos;s role?
            </h3>
            <p className="mt-1 text-md text-navy">
              {roleChangeExplanation(proposal.member.fullName, proposal.member.role, proposal.toRole)}
            </p>

            <Field
              label="Why?"
              htmlFor="role-reason"
              hint="Kept in the role change log, which is the only place this can be read back."
              className="mt-3"
            >
              <TextInput
                id="role-reason"
                value={roleReason}
                onChange={(e) => setRoleReason(e.target.value)}
                placeholder="Ready to bring on their own agents"
              />
            </Field>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={busy !== null} onClick={() => void applyRole()}>
                {busy === 'role' ? 'Changing…' : 'Confirm change'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => {
                  setProposal(null);
                  setRoleReason('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {removing && (
          <div className="mt-4 rounded-md border border-alert bg-base p-4">
            <h3 className="font-display text-md font-bold text-navy">
              Remove {removing.fullName}?
            </h3>
            <p className="mt-1 text-md text-navy">
              This removes them from your team immediately. They&apos;ll need to search and request
              a new leader if they want to rejoin under you or someone else.
            </p>
            <p className="mt-1 text-sm text-muted">
              Nothing is deleted. Their record and everything they logged stays with the office, on
              the Removed list.
            </p>

            {removing.directCount > 0 && (
              <fieldset className="mt-3 rounded-md border border-hairline p-3">
                <legend className="px-1 text-sm font-semibold text-navy">
                  {removing.directCount === 1
                    ? '1 person reports to them'
                    : `${removing.directCount} people report to them`}
                </legend>
                <p className="text-sm text-muted">
                  Say where they go. Removing a leader without deciding this would leave them
                  reporting to somebody who has left.
                </p>
                <label className="mt-2 flex items-center gap-2 text-md text-navy">
                  <input
                    type="radio"
                    name="disposition"
                    value="reassign"
                    checked={disposition === 'reassign'}
                    onChange={() => setDisposition('reassign')}
                  />
                  Move them to my unit
                </label>
                <label className="mt-1 flex items-center gap-2 text-md text-navy">
                  <input
                    type="radio"
                    name="disposition"
                    value="orphan"
                    checked={disposition === 'orphan'}
                    onChange={() => setDisposition('orphan')}
                  />
                  Leave them unassigned, for another leader to pick up
                </label>
              </fieldset>
            )}

            <Field
              label="Why?"
              htmlFor="remove-reason"
              hint="Kept on their record, and sent to them."
              className="mt-3"
            >
              <TextInput
                id="remove-reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder="Left the industry"
              />
            </Field>

            <Field
              label={`Type ${REMOVAL_CONFIRMATION} to confirm`}
              htmlFor="remove-confirm"
              className="mt-3"
            >
              <TextInput
                id="remove-confirm"
                value={removeWord}
                autoComplete="off"
                placeholder={`Type ${REMOVAL_CONFIRMATION}`}
                onChange={(e) => setRemoveWord(e.target.value)}
              />
            </Field>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={busy !== null || !isRemovalConfirmed(removeWord)}
                onClick={() => void applyRemoval()}
              >
                {busy === 'remove' ? 'Removing…' : 'Remove from team'}
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={closeRemoval}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
      )}
    </AgentShell>
  );
}
