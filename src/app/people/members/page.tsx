'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { TenantShell } from '@/components/tenant-shell';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import { RoleBadge } from '@/components/ui/role-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  listMembers,
  MEMBER_STATUS_LABEL,
  readRoleChangeLog,
  type HierarchyRole,
  type Member,
  type MemberStatus,
  type RoleChangeEntry,
} from '@/lib/org';

/**
 * All Members › Directory (`KPM_Owner.html:1826-1837`).
 *
 * The prototype's own note reads *"Showing 17 of 187 members"* — it renders every row it
 * has and stops. This pages, because 500 members is the stated budget.
 *
 * Two of its columns, Last activity and Last coached, are not here: the data arrives in
 * Phases 6 and 13, and a column of dashes reads as "never" rather than "not yet".
 */
const STATUS_TO_PILL: Record<MemberStatus, 'success' | 'alert' | 'neutral'> = {
  active: 'success',
  pending: 'neutral',
  removed: 'alert',
};

const TABS = [
  { key: 'directory', label: 'Directory' },
  { key: 'removed', label: 'Removed' },
  { key: 'rolelog', label: 'Role change log' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MembersPage() {
  const [tab, setTab] = useState<TabKey>('directory');
  const [log, setLog] = useState<RoleChangeEntry[] | null>(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState<HierarchyRole | ''>('');
  const [page, setPage] = useState<Member[] | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setError(null);
      if (tab === 'rolelog') {
        try {
          setLog(await readRoleChangeLog());
        } catch (err) {
          setError(toDisplayError(err));
          setLog([]);
        }
        return;
      }
      try {
        const result = await listMembers({
          ...(q ? { q } : {}),
          ...(role ? { role } : {}),
          ...(tab === 'removed' ? { status: 'removed' as const } : {}),
          ...(cursor ? { cursor } : {}),
        });
        setPage(result.members);
        setNextCursor(result.nextCursor);
      } catch (err) {
        setError(toDisplayError(err));
        setPage([]);
      }
    },
    [q, role, tab],
  );

  // A filter change starts a new run of pages — keeping the old cursors would page
  // through a list that no longer exists.
  useEffect(() => {
    setCursors([]);
    void load();
  }, [load]);

  const filtered = q !== '' || role !== '';

  return (
    <TenantShell
      title="All members"
      subtitle="The office roster. Everyone here has an agent code, issued once and never changed."
    >
      <div className="mb-4 flex gap-1 border-b border-hairline">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={
              tab === t.key
                ? 'border-b-2 border-amber px-3 py-2 text-md font-semibold text-navy'
                : 'border-b-2 border-transparent px-3 py-2 text-md text-muted hover:text-navy'
            }
          >
            {t.label}
          </button>
        ))}
        {/* Visible but not yet built, as the prototype's own nav does for Upcoming. */}
        {['Pending', 'Groups'].map((label) => (
          <span
            key={label}
            aria-disabled
            title="Arrives with its phase"
            className="cursor-default border-b-2 border-transparent px-3 py-2 text-md text-muted/50"
          >
            {label}
          </span>
        ))}
      </div>

      {tab !== 'rolelog' && (
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search" htmlFor="q" className="min-w-56 flex-1">
          <TextInput
            id="q"
            placeholder="Name, email or agent code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Field>
        <Field label="Role" htmlFor="role" className="w-44">
          <Select id="role" value={role} onChange={(e) => setRole(e.target.value as HierarchyRole | '')}>
            <option value="">Every role</option>
            <option value="ab">Agency Builder</option>
            <option value="aab">Associate Agency Builder</option>
            <option value="agent">Agent</option>
          </Select>
        </Field>
      </div>
      )}

      {error && <ErrorBanner {...error} />}

      {tab === 'rolelog' && (
        <>
          {log === null && (
            <p role="status" className="text-md text-muted">
              Loading…
            </p>
          )}
          {log?.length === 0 && !error && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState title="Nobody has changed role in this office yet." />
            </div>
          )}
          {log && log.length > 0 && (
            <DataTable
              caption="Role changes, newest first"
              columns={['When', 'Who', 'Change', 'Why', 'Changed by']}
            >
              {log.map((entry) => (
                <Row key={`${entry.membershipId}-${entry.changedAt}`}>
                  <Cell className="whitespace-nowrap text-muted">
                    <time dateTime={entry.changedAt}>
                      {new Date(entry.changedAt).toLocaleString('en-GB')}
                    </time>
                  </Cell>
                  <Cell className="font-semibold">
                    <Link href={`/people/members/${entry.membershipId}`} className="underline">
                      {entry.fullName}
                    </Link>
                    <span className="block text-sm font-normal text-muted">{entry.agentCode}</span>
                  </Cell>
                  <Cell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {entry.fromRole && <RoleBadge role={entry.fromRole} />}
                      <span aria-label="became" className="text-muted">
                        →
                      </span>
                      {entry.toRole && <RoleBadge role={entry.toRole} />}
                    </span>
                  </Cell>
                  <Cell className="text-muted">{entry.reason ?? '—'}</Cell>
                  <Cell className="text-muted">{entry.actorName ?? '—'}</Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </>
      )}

      {tab !== 'rolelog' && page === null && (
        <p role="status" className="text-md text-muted">
          Loading…
        </p>
      )}

      {tab !== 'rolelog' && page?.length === 0 && !error && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState
            variant={filtered ? 'filtered' : 'empty'}
            title={
              filtered
                ? 'Nobody matches that.'
                : tab === 'removed'
                  ? 'Nobody has been removed from this office.'
                  : 'This office has no members yet.'
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ('');
                    setRole('');
                  }}
                >
                  Clear the filters
                </Button>
              ) : undefined
            }
          />
        </div>
      )}

      {tab !== 'rolelog' && page && page.length > 0 && (
        <>
          <DataTable
            caption={tab === 'removed' ? 'Removed members' : 'Office roster'}
            columns={[
              'Name',
              'Agent code',
              'Role',
              'Reports to',
              'Unit',
              // On the Removed tab every row reads "Removed", which answers nothing.
              // When they left is the question actually asked of this list.
              tab === 'removed' ? 'Removed' : 'Status',
            ]}
          >
            {page.map((m) => (
              <Row key={m.membershipId}>
                <Cell className="font-semibold">
                  <Link href={`/people/members/${m.membershipId}`} className="underline">
                    {m.preferredName ?? m.fullName}
                  </Link>
                  <span className="block text-sm font-normal text-muted">{m.email}</span>
                </Cell>
                <Cell>
                  <code className="text-sm">{m.agentCode}</code>
                </Cell>
                <Cell>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={m.role} />
                    {m.isKpmOwner && <Tag>Owner</Tag>}
                    {m.isKpmAdmin && <Tag>Admin</Tag>}
                  </span>
                </Cell>
                <Cell className="text-muted">{m.leaderName ?? '—'}</Cell>
                <Cell className="text-muted">
                  {/* Leadership is the graph, not the role (OD-23): an AAB with no
                      reports leads nobody, and this column says so. */}
                  {m.isLeader ? `${m.directCount} direct · ${m.subtreeCount} in unit` : 'Leads nobody'}
                </Cell>
                <Cell className={tab === 'removed' ? 'whitespace-nowrap text-muted' : undefined}>
                  {tab === 'removed' ? (
                    m.removedAt ? (
                      <time dateTime={m.removedAt}>
                        {new Date(m.removedAt).toLocaleDateString('en-GB')}
                      </time>
                    ) : (
                      '—'
                    )
                  ) : (
                    <StatusPill
                      status={STATUS_TO_PILL[m.status]}
                      label={MEMBER_STATUS_LABEL[m.status]}
                    />
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>

          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={cursors.length === 0}
              onClick={() => {
                const previous = cursors.slice(0, -1);
                setCursors(previous);
                void load(previous[previous.length - 1]);
              }}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={!nextCursor}
              onClick={() => {
                if (!nextCursor) return;
                setCursors([...cursors, nextCursor]);
                void load(nextCursor);
              }}
            >
              Next
            </Button>
            <span className="text-sm text-muted">
              {page.length} shown{nextCursor ? ' · more to come' : ''}
            </span>
          </div>
        </>
      )}
    </TenantShell>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-amber/20 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-amber-dark">
      {children}
    </span>
  );
}
