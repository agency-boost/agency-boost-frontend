'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { RoleBadge, ROLE_LABEL } from '@/components/ui/role-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  listGroups,
  listReports,
  MEMBER_STATUS_LABEL,
  readMember,
  readTags,
  setTags,
  type GroupSummary,
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
  const { membershipId } = use(params);
  const [member, setMember] = useState<Member | null>(null);
  const [reports, setReports] = useState<Member[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [tags, setLocalTags] = useState<MemberTags | null>(null);
  const [draft, setDraft] = useState<{ groupIds: string[]; isCoreLeader: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void (async () => {
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
    })();
  }, [membershipId]);

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
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
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
              {ROLE_LABEL[member.role]}, and leads nobody. Leadership follows the tree rather
              than the role — an {ROLE_LABEL[member.role]} with no direct reports has no unit,
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
                onChange={(e) => setDraft({ ...draft, isCoreLeader: e.target.checked })}
              />
              Core Leader
            </label>
            <p className="mt-1 text-sm text-muted">
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
