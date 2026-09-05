'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { TenantShell } from '@/components/tenant-shell';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { RoleBadge, ROLE_LABEL } from '@/components/ui/role-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { listReports, MEMBER_STATUS_LABEL, readMember, type Member } from '@/lib/org';

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
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [one, theirs] = await Promise.all([
          readMember(membershipId),
          listReports(membershipId),
        ]);
        setMember(one);
        setReports(theirs);
      } catch (err) {
        setError(toDisplayError(err));
      }
    })();
  }, [membershipId]);

  if (error) {
    return (
      <TenantShell title="Member">
        <ErrorBanner {...error} />
        <p className="mt-3 text-md text-muted">
          Someone outside what you can see reads the same as someone who does not exist —
          a distinct message would confirm they are here.
        </p>
        <Link href="/people/members" className="mt-3 inline-block text-md text-navy underline">
          Back to the roster
        </Link>
      </TenantShell>
    );
  }

  if (!member) {
    return (
      <TenantShell title="Member">
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      </TenantShell>
    );
  }

  return (
    <TenantShell
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
    </TenantShell>
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
