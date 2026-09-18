'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { RoleBadge, rungLabel, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  changeRole,
  isRemovalConfirmed,
  listGroups,
  listReports,
  MEMBER_STATUS_LABEL,
  readMember,
  readTags,
  removeMember,
  REMOVAL_CONFIRMATION,
  roleChangeExplanation,
  setTags,
  type GroupSummary,
  type HierarchyRole,
  type Member,
  type MemberTags,
} from '@/lib/org';

/**
 * One member — the prototype's person modal (`KPM_Owner.html`, Org Tree), as a page.
 *
 * A page rather than a modal because it has a URL worth sharing: "look at this person"
 * is a thing an Owner says to an Admin, and a modal cannot be linked to.
 */
export default function MemberPage({ params }: { params: Promise<{ membershipId: string }> }) {
  // The company's ladder, so a rung's label comes from it rather than a map (P4-T9).
  const ladder = useLadder();
  const { membershipId } = use(params);
  const [member, setMember] = useState<Member | null>(null);
  const [reports, setReports] = useState<Member[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [tags, setLocalTags] = useState<MemberTags | null>(null);
  const [draft, setDraft] = useState<{ groupIds: string[]; isCoreLeader: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // P3.5-T13. Both controls live here rather than on a roster row, which is where the
  // prototype puts them (`KPM_Owner.html:4515-4522`) — a bare `onchange` and a `Remove`
  // link, no confirmation and no reason. There is no room on a row to ask why.
  const [toRole, setToRole] = useState<HierarchyRole | ''>('');
  const [roleReason, setRoleReason] = useState('');
  const [removing, setRemoving] = useState(false);
  const [removeWord, setRemoveWord] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [disposition, setDisposition] = useState<'reassign' | 'orphan'>('orphan');
  const [error, setError] = useState<ApiError | null>(null);

  /** P3.5-T13. A role change and a removal both alter this page, so both re-read it. */
  const load = useCallback(async () => {
    try {
      const [one, theirs, mine, all] = await Promise.all([
        readMember(membershipId),
        listReports(membershipId),
        readTags(membershipId),
        listGroups(),
      ]);
      setMember(one);
      setReports(theirs);
      setLocalTags(mine);
      setGroups(all);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitRoleChange(event: React.FormEvent) {
    event.preventDefault();
    if (!member || !toRole || toRole === member.role) return;
    setBusy(true);
    setError(null);
    try {
      await changeRole(member.membershipId, toRole, roleReason.trim() || undefined);
      setToRole('');
      setRoleReason('');
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitRemoval(event: React.FormEvent) {
    event.preventDefault();
    if (!member || !isRemovalConfirmed(removeWord)) return;
    setBusy(true);
    setError(null);
    try {
      await removeMember(member.membershipId, {
        confirmation: removeWord,
        reason: removeReason.trim() || undefined,
        // Only when they actually lead people — the server refuses a disposition for
        // somebody who leads nobody, so sending one anyway would be a 400 the reader
        // could not act on.
        //
        // `reassign` moves them to **this person's own leader**, one level up. The
        // leader's version of this screen offers "my unit", which is right there because
        // the caller *is* a leader; here the caller may be an Owner who leads nobody, and
        // moving a unit under somebody who has never led it would be a reorganisation
        // dressed up as a removal. `leaderId` is never null on a removable person — the
        // office root cannot be removed at all.
        ...(member.directCount > 0
          ? {
              subtree:
                disposition === 'reassign' && member.leaderId
                  ? ({ action: 'reassign', toMembershipId: member.leaderId } as const)
                  : ({ action: 'orphan' } as const),
            }
          : {}),
      });
      setRemoving(false);
      setRemoveWord('');
      setRemoveReason('');
      // Re-read rather than trusting the response: it answers with the *caller's* team,
      // and this page is about one person who is now on the Removed list.
      await load();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Page title="Member">
        <ErrorBanner {...error} />
        <p className="mt-3 text-md text-muted">
          Someone outside what you can see reads the same as someone who does not exist —
          a distinct message would confirm they are here.
        </p>
        <Link href="/people/members" className="mt-3 inline-block text-md text-navy underline">
          Back to the roster
        </Link>
      </Page>
    );
  }

  if (!member) {
    return (
      <Page title="Member">
        <SkeletonCards count={3} label="Loading the member…" />
      </Page>
    );
  }

  return (
    <Page
      title={member.preferredName ?? member.fullName}
      subtitle={member.agentCode}
      actions={
        <StatusPill
          status={member.status === 'active' ? 'success' : member.status === 'pending' ? 'neutral' : 'alert'}
          label={MEMBER_STATUS_LABEL[member.status]}
        />
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Personal</h2>
          <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-md">
            <Detail term="Full name" detail={member.fullName} />
            <Detail term="Email" detail={member.email} />
            <Detail term="Agent code" detail={<code className="text-sm">{member.agentCode}</code>} />
            <Detail term="Role" detail={<RoleBadge role={member.role} short={false} />} />
            <Detail term="Reports to" detail={member.leaderName ?? 'Nobody — top of the tree'} />
            <Detail
              term="Joined"
              detail={member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('en-GB') : '—'}
            />
          </dl>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold text-navy">Unit</h2>
          {member.isLeader ? (
            <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-2 text-md">
              <Detail term="Direct reports" detail={String(member.directCount)} />
              <Detail term="Whole unit" detail={String(member.subtreeCount)} />
              <Detail term="Depth" detail={`${member.depth} below the root`} />
            </dl>
          ) : (
            <p className="mt-2 text-md text-muted">
              {rungLabel(member.role, ladder)}, and leads nobody. Leadership follows the tree rather
              than the role — an {rungLabel(member.role, ladder)} with no direct reports has no unit,
              and the surfaces that need one stay closed until they do.
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-navy">Tags</h2>
            <p className="mt-1 text-md text-muted">
              Groups are labels this office defines for its own organising. A tag is{' '}
              <strong>not</strong> hierarchy: it changes nothing about who reports to whom, and
              grants nobody access to anything.
            </p>
          </div>
          {draft === null && tags && (
            <Button
              onClick={() => setDraft({ groupIds: tags.groupIds, isCoreLeader: tags.isCoreLeader })}
            >
              Edit tags
            </Button>
          )}
        </div>

        {draft === null ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tags?.isCoreLeader && (
              <span className="rounded-full bg-amber px-2 py-0.5 text-sm font-semibold text-navy">
                Core Leader
              </span>
            )}
            {(tags?.groupIds ?? []).map((id) => {
              const group = groups.find((g) => g.groupId === id);
              return (
                <span
                  key={id}
                  className="rounded-full border border-hairline px-2 py-0.5 text-sm text-navy"
                >
                  {/* A tag on a retired group is kept — it is the record that the cohort
                      existed — so it renders as itself rather than disappearing. */}
                  {group ? group.name : 'A group since retired'}
                </span>
              );
            })}
            {!tags?.isCoreLeader && (tags?.groupIds.length ?? 0) === 0 && (
              <p className="text-md text-muted">No tags.</p>
            )}
          </div>
        ) : (
          <div className="mt-3">
            {groups.length === 0 ? (
              <p className="text-md text-muted">
                No groups yet — create one on{' '}
                <Link href="/people/members" className="underline">
                  All members → Groups
                </Link>{' '}
                first.
              </p>
            ) : (
              <fieldset>
                <legend className="text-sm font-semibold text-navy">Groups</legend>
                {groups.map((group) => (
                  <label
                    key={group.groupId}
                    className="mt-1 flex items-center gap-2 text-md text-navy"
                  >
                    <input
                      type="checkbox"
                      checked={draft.groupIds.includes(group.groupId)}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          groupIds: e.target.checked
                            ? [...draft.groupIds, group.groupId]
                            : draft.groupIds.filter((id) => id !== group.groupId),
                        })
                      }
                    />
                    {group.name}
                  </label>
                ))}
              </fieldset>
            )}

            <label className="mt-3 flex items-center gap-2 text-md text-navy">
              <input
                type="checkbox"
                checked={draft.isCoreLeader}
                aria-describedby="core-leader-hint"
                onChange={(e) => setDraft({ ...draft, isCoreLeader: e.target.checked })}
              />
              Core Leader
            </label>
            <p id="core-leader-hint" className="mt-1 text-sm text-muted">
              Core Leader decides who may co-edit a Strategic Leader Forum minute, and nothing
              else. It is not a role, and it grants no access.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void setTags(membershipId, draft.groupIds, draft.isCoreLeader)
                    .then((saved) => {
                      setLocalTags(saved);
                      setDraft(null);
                    })
                    .catch((err) => setError(toDisplayError(err)))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? 'Saving…' : 'Save tags'}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      {(member.canChangeRole || member.canRemove) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {member.canChangeRole && (
            <Card>
              <h2 className="font-display text-lg font-bold text-navy">Change their role</h2>
              <form onSubmit={submitRoleChange} className="mt-3 flex flex-col gap-4" noValidate>
                <Field
                  label="New role"
                  htmlFor="to-role"
                  hint={
                    member.canPromoteToAb
                      ? undefined
                      : 'Only the office can make somebody an Agency Builder, or stop them being one.'
                  }
                >
                  <Select id="to-role" value={toRole} onChange={(e) => setToRole(e.target.value as HierarchyRole | '')}>
                    <option value="">{rungLabel(member.role, ladder)} — no change</option>
                    {(['agent', 'aab', 'ab'] as const)
                      .filter((r) => r !== member.role)
                      // The two matrix rows, kept apart: Agent⇄AAB is a direct leader's
                      // call, anything involving AB is the office's.
                      .filter((r) => (r === 'ab' || member.role === 'ab' ? member.canPromoteToAb : true))
                      .map((r) => (
                        <option key={r} value={r}>
                          {rungLabel(r, ladder)}
                        </option>
                      ))}
                  </Select>
                </Field>

                {/* The prototype changes a role on a bare `onchange` and says nothing
                    about what it means. This is its own sentence, verbatim. */}
                {toRole && toRole !== member.role && (
                  <p className="rounded-md border border-hairline bg-base p-3 text-md text-navy">
                    {roleChangeExplanation(
                      member.preferredName ?? member.fullName,
                      member.role,
                      toRole,
                      // The office may be acting on somebody who reports to a third
                      // person, so "they keep reporting to you" would be untrue.
                      'the-office',
                    )}
                  </p>
                )}

                <Field
                  label="Why?"
                  htmlFor="role-reason"
                  hint="Optional, and worth writing: this is what the role change log shows months later."
                >
                  <TextInput
                    id="role-reason"
                    maxLength={300}
                    value={roleReason}
                    onChange={(e) => setRoleReason(e.target.value)}
                  />
                </Field>

                <Button type="submit" disabled={busy || !toRole || toRole === member.role}>
                  {busy ? 'Saving…' : 'Change role'}
                </Button>
              </form>
            </Card>
          )}

          {member.canRemove && (
            <Card>
              <h2 className="font-display text-lg font-bold text-navy">Remove from the office</h2>
              <p className="mt-1 text-md text-muted">
                Nothing is deleted. Their record and everything they logged stays with the office,
                on the Removed list.
              </p>

              {!removing ? (
                <Button variant="secondary" className="mt-3" onClick={() => setRemoving(true)}>
                  Remove {member.preferredName ?? member.fullName}
                </Button>
              ) : (
                <form onSubmit={submitRemoval} className="mt-3 flex flex-col gap-4" noValidate>
                  {/* AC-3. Removing a leader without saying this would leave their people
                      reporting to somebody who has left. */}
                  {member.directCount > 0 && (
                    <fieldset className="rounded-md border border-hairline p-3">
                      <legend className="px-1 text-sm font-semibold text-navy">
                        {member.directCount === 1
                          ? '1 person reports to them'
                          : `${member.directCount} people report to them`}
                      </legend>
                      <p className="text-sm text-muted">Say where they go.</p>
                      <label className="mt-2 flex items-center gap-2 text-md text-navy">
                        <input
                          type="radio"
                          name="disposition"
                          value="reassign"
                          checked={disposition === 'reassign'}
                          onChange={() => setDisposition('reassign')}
                        />
                        Move them up to {member.leaderName ?? 'their leader\u2019s leader'}
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
                  >
                    <TextInput
                      id="remove-reason"
                      maxLength={300}
                      value={removeReason}
                      onChange={(e) => setRemoveReason(e.target.value)}
                    />
                  </Field>

                  <Field
                    label={`Type ${REMOVAL_CONFIRMATION} to confirm`}
                    htmlFor="remove-word"
                    hint="The server checks this too. A confirmation only the screen enforces is not a confirmation."
                  >
                    <TextInput
                      id="remove-word"
                      value={removeWord}
                      onChange={(e) => setRemoveWord(e.target.value)}
                      invalid={removeWord.length > 0 && !isRemovalConfirmed(removeWord)}
                    />
                  </Field>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy || !isRemovalConfirmed(removeWord)}>
                      {busy ? 'Removing…' : 'Remove them'}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => setRemoving(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>
      )}

      <h2 className="mb-3 mt-6 font-display text-lg font-bold text-navy">Who reports to them</h2>
      {reports.length === 0 ? (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState title="Nobody reports to them." />
        </div>
      ) : (
        <DataTable caption="Who reports to them" columns={['Name', 'Agent code', 'Role', 'Unit']}>
          {reports.map((r) => (
            <Row key={r.membershipId}>
              <Cell className="font-semibold">
                <Link href={`/people/members/${r.membershipId}`} className="underline">
                  {r.preferredName ?? r.fullName}
                </Link>
              </Cell>
              <Cell>
                <code className="text-sm">{r.agentCode}</code>
              </Cell>
              <Cell>
                <RoleBadge role={r.role} />
              </Cell>
              <Cell className="text-muted">
                {r.isLeader ? `${r.directCount} direct` : 'Leads nobody'}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Link href="/people/members" className="mt-6 inline-block text-md text-navy underline">
        Back to the roster
      </Link>
    </Page>
  );
}

function Detail({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="break-words text-navy">{detail}</dd>
    </>
  );
}
