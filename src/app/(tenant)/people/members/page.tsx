'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LeaderLimitNotice, LeaderLimitWaiting, isLeaderLimit } from '@/components/leader-limit-notice';
import { Page } from '@/components/page';
import { INBOX_COPY } from '@/components/request-inbox';
import { TransferRequests } from '@/components/transfer-requests';
import { DateField } from '@/components/ui/date-field';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, ErrorBanner, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { TAP_TARGET, TEXT_TAP } from '@/components/ui/phone';
import { RoleBadge, rungShort, useLadder } from '@/components/ui/role-badge';
import { CardField, CardFields, RowCard, RowCards } from '@/components/ui/row-cards';
import { SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  BELOW_DESKTOP_ROW, TAB_BELOW_DESKTOP, TAB_ROW_BELOW_DESKTOP, UNDERLINED_ROW_BELOW_DESKTOP,
} from '@/components/ui/tablet';
import { useTabRow } from '@/components/ui/use-tab-row';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { daysAgoWords } from '@/lib/kpm-overview';
import { CORE_LEADER_LABEL } from '@/lib/profile-line';
import { displayName } from '@/lib/display-name';
import { useDebounced } from '@/lib/use-debounced';
import { useCan } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import { declineRequest, readInbox, approveRequest, type PendingRequest } from '@/lib/join';
import { dayInZone, formatCalendarDay, formatDateTime, formatOfficeDay, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  askLeaderLimitApproval, cancelLeaderLimitRequest, pendingFor, readLeaderLimitRequests, requestedChange,
  type LeaderLimitRequestRow,
} from '@/lib/leader-limit-requests';
import {
  archiveGroup,
  createGroup,
  listGroups,
  listMembers,
  MEMBER_STATUS_LABEL,
  readOrgTree,
  readRoleChangeLog,
  setCoreLeader,
  updateGroup,
  type GroupSummary,
  type HierarchyRole,
  type Member,
  type MemberPage,
  type MemberStatus,
  type RoleChangeEntry,
} from '@/lib/org';

/**
 * All Members › Directory (`KPM_Owner.html:1826-1837`).
 *
 * The prototype's own note reads *"Showing 17 of 187 members"* — it renders every row it
 * has and stops. This pages, because 500 members is the stated budget.
 *
 * *Last activity* and *Last coached* (`KPM_Owner.html:1834`, `:4490-4519`; P18-T1, D-directory) are
 * the server's, counted in the office's calendar: *Today*, *"{n} days ago"*, or *Never*. This is the
 * full list the Overview's *"+ {n} more — full list on the People screen"* points at, and each row's
 * two columns are an audited read of that member's activity and coaching, written by the server.
 */
/**
 * The roster indents a name by role, so the flat list still reads as a hierarchy
 * (`KPM_Owner.html:218-219`). Presentation only — nothing sorts or scopes by it.
 */
const ROLE_INDENT: Record<HierarchyRole, string> = {
  ab: 'block',
  aab: 'block pl-4',
  agent: 'block pl-8',
};

/** The same steps on a phone's card, half the table's (`Tables as cards`): its 16px gutter and 12px a step in. */
const CARD_INDENT: Record<HierarchyRole, number> = { ab: 16, aab: 28, agent: 40 };

const STATUS_TO_PILL: Record<MemberStatus, 'success' | 'alert' | 'neutral'> = {
  active: 'success',
  pending: 'neutral',
  removed: 'alert',
};

/**
 * `Directory (187)` · `Pending (14)` · `Removed (3)` · `Role change log` · `Groups`
 * (`KPM_Owner.html:1822-1826`). Only the first three carry a count — the other two are
 * not populations, and a number on them would invite the wrong question.
 */
const TABS = [
  { key: 'directory', label: 'Directory', count: 'directory' },
  { key: 'pending', label: 'Pending', count: 'pending' },
  { key: 'removed', label: 'Removed', count: 'removed' },
  { key: 'rolelog', label: 'Role change log' },
  { key: 'groups', label: 'Groups' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/** A member who leads nobody, in the *Unit* column: the glossary's *No team*, as the Overview's AB list reads it. */
const NO_TEAM = 'No team';

/**
 * Each tab's columns, declared once. The skeleton and the table read the same array, so
 * the placeholder cannot be a different width from the rows that replace it.
 */
const LOG_COLUMNS = ['When', 'Who', 'Change', 'Why', 'Changed by'] as const;
const PENDING_COLUMNS = ['Who', 'Waiting on', { label: 'Actions', visuallyHidden: true }] as const;
const GROUP_COLUMNS = ['Group', 'Owner', 'Tagged', { label: 'Actions', visuallyHidden: true }] as const;

/**
 * The roster's last column depends on the tab, so the skeleton must be told which tab it
 * is standing in for. Otherwise the placeholder is headed `Status` and the rows that land
 * are headed `Removed` — a smaller version of exactly the flip this screen used to do for
 * real, before the tab switch started clearing its data.
 */
const rosterColumns = (tab: TabKey) =>
  [
    'Name',
    'Agent code',
    'Role',
    'Reports to',
    // Beside *Reports to*, where the prototype puts them after *Recruited by* (`KPM_Owner.html:1834`).
    // The directory's only: the prototype's Removed tab has neither (`:1849`), and a leaver's last
    // activity answers nothing about who to chase.
    ...(tab === 'removed' ? [] : ['Last activity', 'Last coached'] as const),
    'Unit',
    // On the Removed tab every row reads "Removed", which answers nothing. When they left
    // is the question actually asked of this list.
    tab === 'removed' ? 'Removed' : 'Status',
  ] as const;

export default function MembersPage() {
  const [tab, setTab] = useState<TabKey>('directory');
  /*
   * **Below 768px the roster is a card per member** (P18.97-T7 AC-1, ADR-0178 §4; the client's UI-034: *All members*,
   * 839px on a 375px screen) — on *Directory* and on *Removed*, which draw the one roster. Asked here, where the screen
   * mounts and before the roster answers, so a phone never draws the table first. From 768px the table it was.
   */
  const phone = usePhone();
  const [log, setLog] = useState<RoleChangeEntry[] | null>(null);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [editing, setEditing] = useState<{ groupId: string | null; name: string; owner: string } | null>(null);
  const [retiring, setRetiring] = useState<GroupSummary | null>(null);
  /**
   * Everybody who could own a group.
   *
   * From the tree rather than the roster: the roster is paginated at 25, so picking the
   * owner from it would silently fail to offer most of the office — and the person you
   * want is as likely to be on page 8 as page 1.
   */
  const [candidates, setCandidates] = useState<{ membershipId: string; fullName: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  // The server is asked for the settled query, not the half-typed one. `q` still drives
  // the input, so typing stays instant.
  const query = useDebounced(q);
  const [role, setRole] = useState<HierarchyRole | ''>('');
  const [page, setPage] = useState<Member[] | null>(null);
  const [cursors, setCursors] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<MemberPage['counts'] | null>(null);
  const [requests, setRequests] = useState<PendingRequest[] | null>(null);
  /**
   * P18.96-T7 G1 (ADR-0169; T3's rule on every approval): *Approve* asks for the join date — the request whose row has
   * its *Join date* open, and the date, the office's today by default and never after it — as the request inbox does.
   */
  const officeToday = dayInZone(OFFICE_TIME_ZONE, new Date());
  const [approving, setApproving] = useState<string | null>(null);
  const [joinDate, setJoinDate] = useState(officeToday);
  const lateDate = joinDate !== '' && joinDate > officeToday;
  const [error, setError] = useState<ApiError | null>(null);
  /**
   * ADR-0157: an approval the leader limit refused may be asked of AgencyBoost — `refusedFor` is whose — and the
   * office's open requests say which pending rows wait for it.
   */
  const [refusedFor, setRefusedFor] = useState<string | null>(null);
  const [asks, setAsks] = useState<LeaderLimitRequestRow[] | null>(null);
  const ladder = useLadder();
  /** P18.96-T3 AC-3: the office's transfer requests sit on the Pending tab, for whoever decides them. */
  const mayDecideTransfers = useCan('member:transfer_approve');

  /*
   * **A notice opens its tab** (P18.96-T3): a transfer request's notice links to `?tab=pending`. Read once from the
   * address on arrival, so a tab chosen afterwards is the reader's.
   */
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some((t) => t.key === asked)) setTab(asked as TabKey);
  }, []);

  const load = useCallback(
    async (cursor?: string) => {
      setError(null);
      // Clear what is about to be refetched, **before** awaiting it.
      //
      // Without this the previous tab's rows stay on screen for the whole request while
      // the column headers — which read `tab` directly — have already flipped. Switching
      // Directory → Removed showed active members under a "Removed" heading, every one of
      // them displaying an em dash. The `=== null` guards below could only ever fire on a
      // first visit, so nothing indicated a wait was happening at all.
      //
      // `counts` is deliberately not cleared: the same three numbers serve every tab, so
      // nulling them would blank the tab labels and put a flicker in the one part of the
      // screen that did not need to change.
      if (tab === 'rolelog') {
        setLog(null);
        try {
          setLog(await readRoleChangeLog());
        } catch (err) {
          setError(toDisplayError(err));
          setLog([]);
        }
        return;
      }
      if (tab === 'pending') {
        setPage(null);
        setRequests(null);
        try {
          // Two reads, because they are two different populations and the tab is the
          // union: everybody who has registered and not yet joined a unit, plus the open
          // requests among them. Counting only the requests would hide anybody who
          // registered and asked nobody — and they are the ones most in need of finding.
          const [waiting, queue, open] = await Promise.all([
            listMembers({ status: 'pending' }),
            readInbox(),
            // Who waits for AgencyBoost (ADR-0157). A failed read shows nobody waiting, never a second error.
            readLeaderLimitRequests().catch(() => []),
          ]);
          setPage(waiting.members);
          setCounts(waiting.counts);
          setRequests(queue);
          setAsks(open);
        } catch (err) {
          setError(toDisplayError(err));
          setPage([]);
          setRequests([]);
        }
        return;
      }
      if (tab === 'groups') {
        setGroups(null);
        try {
          const [mine, office] = await Promise.all([listGroups(), readOrgTree()]);
          setGroups(mine);
          setCandidates(
            office.nodes
              .map((n) => ({ membershipId: n.membershipId, fullName: displayName(n) }))
              .sort((a, b) => a.fullName.localeCompare(b.fullName)),
          );
        } catch (err) {
          setError(toDisplayError(err));
          setGroups([]);
        }
        return;
      }
      setPage(null);
      try {
        const result = await listMembers({
          ...(query ? { q: query } : {}),
          ...(role ? { role } : {}),
          ...(tab === 'removed' ? { status: 'removed' as const } : {}),
          ...(cursor ? { cursor } : {}),
        });
        setPage(result.members);
        setNextCursor(result.nextCursor);
        setCounts(result.counts);
      } catch (err) {
        setError(toDisplayError(err));
        setPage([]);
      }
    },
    [query, role, tab],
  );

  /** ADR-0157 §1: letting this pending leader in, asked of AgencyBoost. */
  async function askApproval() {
    if (!refusedFor) return;
    setBusy(true);
    try {
      await askLeaderLimitApproval(refusedFor, { action: 'activate' });
      setRefusedFor(null);
      setError(null);
      setAsks(await readLeaderLimitRequests().catch(() => []));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function cancelAsk(requestId: string) {
    setBusy(true);
    setError(null);
    try {
      setAsks(await cancelLeaderLimitRequest(requestId));
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function decide(requestId: string, action: 'approve' | 'decline') {
    setBusy(true);
    setError(null);
    setRefusedFor(null);
    try {
      // The server answers with the queue as it now stands, so two admins deciding at
      // once see the truth rather than their own guess about it.
      setRequests(
        action === 'approve' ? await approveRequest(requestId, undefined, joinDate) : await declineRequest(requestId),
      );
      setApproving(null);
      // The decided person leaves this population, so the list and its count move too.
      const waiting = await listMembers({ status: 'pending' });
      setPage(waiting.members);
      setCounts(waiting.counts);
    } catch (err) {
      const shown = toDisplayError(err);
      setError(shown);
      if (action === 'approve' && isLeaderLimit(shown)) {
        setRefusedFor(requests?.find((r) => r.requestId === requestId)?.membershipId ?? null);
      }
      // Re-read the queue directly rather than through `load()`, which clears the error
      // on its first line — the refusal would vanish before it could be read. A conflict
      // usually means somebody else decided it first, so the list does need refreshing.
      await readInbox().then(setRequests).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  /**
   * **The row's Core Leader control** (ADR-0159 §1, P18.8-T5 AC-3): tag or untag a leader, their groups untouched
   * (`PUT /members/:id/core-leader`). The row is replaced by what the server answers, so the chip says what was
   * stored. Offered where the row says the viewer may (`canTagCoreLeader`); the API refuses regardless.
   */
  async function toggleCoreLeader(member: Member) {
    setBusy(true);
    setError(null);
    try {
      const tags = await setCoreLeader(member.membershipId, !member.isCoreLeader);
      setPage((rows) => rows?.map((m) => (m.membershipId === member.membershipId
        ? { ...m, isCoreLeader: tags.isCoreLeader && (tags.canBeCoreLeader ?? true) }
        : m)) ?? rows);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveGroup() {
    if (!editing || editing.name.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      setGroups(
        editing.groupId === null
          ? await createGroup(editing.name, editing.owner)
          : await updateGroup(editing.groupId, editing.name, editing.owner),
      );
      setEditing(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  async function retire() {
    if (!retiring) return;
    setBusy(true);
    setError(null);
    try {
      setGroups(await archiveGroup(retiring.groupId));
      setRetiring(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  // A filter change starts a new run of pages — keeping the old cursors would page
  // through a list that no longer exists.
  useEffect(() => {
    setCursors([]);
    setNextCursor(null);
    void load();
  }, [load]);

  const filtered = q !== '' || role !== '';

  // The count is part of the label, not a badge: the prototype writes it inside the
  // parentheses and it is a population, not an alert.
  const label = (t: (typeof TABS)[number]) =>
    'count' in t && counts ? `${t.label} (${counts[t.count]})` : t.label;

  /*
   * **Below 1024px the five tabs are one row that scrolls sideways** (P18.97-T6 AC-4, ADR-0178 §2; the client's
   * UI-038: two rows at 768px and at 375px) — the shared tab row every strip has on a phone (`useTabRow`): the side
   * that has more fades, and the current tab is brought into view on arriving and whenever it changes. The tabs, their
   * names, `aria-current` and the keyboard are this row's own; a row that fits reads as it did, and from 1024px it
   * wraps exactly as before (`tablet.ts`).
   */
  const row = useTabRow<HTMLDivElement>(tab);

  return (
    <Page
      title="All Members"
      subtitle="Directory, pending requests, removed, and role history"
    >
      {/* The prototype's metrics: 24px between tabs, the underline on the hairline, and
          inactive tabs at the same weight as active — they differ by colour and the amber
          rule, never by weight (`Overall.html:81-89`). */}
      <div
        ref={row.ref}
        data-fade={row.fade}
        {...BELOW_DESKTOP_ROW}
        className={cn('mb-6 flex flex-wrap gap-6 border-b border-hairline', TAB_ROW_BELOW_DESKTOP, UNDERLINED_ROW_BELOW_DESKTOP)}
      >
        {/* Every tab is built. A disabled branch for an unbuilt one, titled "Arrives with its
            phase", sat here unreachable — no tab set it — and went in P10.1-T2. */}
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as TabKey)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              tab === t.key
                ? '-mb-px border-b-2 border-amber px-0.5 pb-3 text-md font-semibold text-navy'
                : '-mb-px border-b-2 border-transparent px-0.5 pb-3 text-md font-semibold text-muted',
              TAB_BELOW_DESKTOP,
            )}
          >
            {label(t)}
          </button>
        ))}
      </div>

      {tab !== 'rolelog' && tab !== 'groups' && tab !== 'pending' && (
      <FieldRow className="mb-4">
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
            {/* Each role by its badge's name (P18.95-T9 AC-1, ADR-0167 §10). */}
            <option value="ab">{rungShort('AB', ladder)}</option>
            <option value="aab">{rungShort('AAB', ladder)}</option>
            <option value="agent">{rungShort('AGENT', ladder)}</option>
          </Select>
        </Field>
      </FieldRow>
      )}

      {/* An approval at the leader limit (P13.2 exit review): in the limit's words, never the code. */}
      {error && (isLeaderLimit(error)
        ? (
          <LeaderLimitNotice
            error={error}
            audience="office"
            action="role"
            asking={busy}
            onAsk={refusedFor ? () => void askApproval() : undefined}
          />
        )
        : <ErrorBanner {...error} />)}

      {tab === 'rolelog' && (
        <>
          {log === null && (
            <SkeletonTable caption="Role changes, newest first" columns={LOG_COLUMNS} />
          )}
          {log?.length === 0 && !error && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState title="Nobody has changed role in this office yet." />
            </div>
          )}
          {log && log.length > 0 && (
            <DataTable
              caption="Role changes, newest first"
              columns={LOG_COLUMNS}
            >
              {log.map((entry) => (
                <Row key={`${entry.membershipId}-${entry.changedAt}`}>
                  <Cell className="whitespace-nowrap text-muted">
                    <time dateTime={entry.changedAt}>
                      {formatDateTime(entry.changedAt)}
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

      {tab === 'pending' && (
        <>
          <p className="mb-3 text-md text-muted">
            Approve or decline requests from agents asking to join your KPM. Approving adds them
            under <strong>the leader they asked for</strong>, not under you.
          </p>

          {page === null && !error && (
            <SkeletonTable caption="Registered, not yet in a unit" columns={PENDING_COLUMNS} rows={3} />
          )}

          {page?.length === 0 && !error && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState title="Everybody who has registered is in a unit." />
            </div>
          )}

          {page && page.length > 0 && requests && (
            <DataTable
              caption="Registered, not yet in a unit"
              columns={PENDING_COLUMNS}
            >
              {page.map((m) => {
                const ask = requests.find((r) => r.membershipId === m.membershipId);
                return (
                  <Row key={m.membershipId}>
                    <Cell className="font-semibold">
                      {displayName(m)}
                      <span className="block text-sm font-normal text-muted">
                        {m.agentCode} · {m.email}
                      </span>
                    </Cell>
                    <Cell className="text-muted">
                      {ask ? (
                        <>
                          A decision
                          <span className="block text-sm">
                            Asked{' '}
                            <time dateTime={ask.requestedAt}>
                              {formatOfficeDay(ask.requestedAt)}
                            </time>
                          </span>
                        </>
                      ) : (
                        <>
                          Nobody
                          <span className="block text-sm">
                            They have asked no leader — a leader can pick them up from{' '}
                            <strong>Add new agents</strong>
                          </span>
                        </>
                      )}
                    </Cell>
                    <Cell>
                      {pendingFor(asks, m.membershipId) ? (
                        // ADR-0157: letting them in waits for AgencyBoost.
                        <LeaderLimitWaiting
                          what={requestedChange(pendingFor(asks, m.membershipId)!, (code) => rungShort(code, ladder))}
                          cancelling={busy}
                          onCancel={() => void cancelAsk(pendingFor(asks, m.membershipId)!.requestId)}
                        />
                      ) : ask && approving === ask.requestId ? (
                        // The first *Approve* opened the row's *Join date*; this one sends it (P18.96-T7 G1).
                        <span className="flex flex-wrap items-end gap-2">
                          <Field
                            label={INBOX_COPY.joinDate}
                            htmlFor={`join-${ask.requestId}`}
                            hint={INBOX_COPY.joinDateHint}
                            error={lateDate ? INBOX_COPY.lateDate(officeToday) : undefined}
                            className="w-56"
                          >
                            <DateField
                              id={`join-${ask.requestId}`}
                              value={joinDate}
                              max={officeToday}
                              invalid={lateDate}
                              onChange={setJoinDate}
                              className="w-full"
                            />
                          </Field>
                          <span className="flex flex-wrap gap-2">
                            <Button
                              disabled={busy || lateDate || !joinDate}
                              onClick={() => void decide(ask.requestId, 'approve')}
                            >
                              {INBOX_COPY.approve}
                            </Button>
                            <Button variant="secondary" disabled={busy} onClick={() => setApproving(null)}>
                              {INBOX_COPY.cancel}
                            </Button>
                          </span>
                        </span>
                      ) : ask ? (
                        <span className="flex flex-wrap gap-2">
                          <Button
                            disabled={busy}
                            onClick={() => {
                              setApproving(ask.requestId);
                              setJoinDate(officeToday);
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => void decide(ask.requestId, 'decline')}
                          >
                            Decline
                          </Button>
                        </span>
                      ) : (
                        // Nothing to approve. Offering a dead button would be worse than
                        // offering none.
                        <span className="text-sm text-muted">—</span>
                      )}
                    </Cell>
                  </Row>
                );
              })}
            </DataTable>
          )}
          {mayDecideTransfers && <TransferRequests />}
        </>
      )}

      {tab === 'groups' && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-md text-muted">
              Labels this office defines for its own organising — a mentoring circle, a task force.
              A group is <strong>not</strong> hierarchy and grants nobody access to anything.
            </p>
            <Button
              disabled={busy || editing !== null}
              onClick={() => setEditing({ groupId: null, name: '', owner: '' })}
            >
              Create group
            </Button>
          </div>

          {editing && (
            <div className="mb-4 rounded-md border border-amber bg-base p-4">
              <h2 className="font-display text-md font-bold text-navy">
                {editing.groupId === null ? 'Create group' : 'Edit group'}
              </h2>
              <FieldRow className="mt-3">
                <Field label="Group name" htmlFor="group-name" className="min-w-56 flex-1">
                  <TextInput
                    id="group-name"
                    value={editing.name}
                    placeholder="New Agent Mentoring Circle"
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </Field>
                <Field
                  label="Owner"
                  htmlFor="group-owner"
                  hint="Who runs it. Stored as their membership, so renaming them changes nothing."
                  className="min-w-56 flex-1"
                >
                  <Select
                    id="group-owner"
                    value={editing.owner}
                    onChange={(e) => setEditing({ ...editing, owner: e.target.value })}
                  >
                    <option value="">Choose somebody</option>
                    {candidates.map((m) => (
                      <option key={m.membershipId} value={m.membershipId}>
                        {m.fullName}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FieldRow>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={busy || editing.name.trim() === '' || editing.owner === ''}
                  onClick={() => void saveGroup()}
                >
                  {busy ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {retiring && (
            <div className="mb-4 rounded-md border border-alert bg-base p-4">
              <h2 className="font-display text-md font-bold text-navy">
                Retire {retiring.name}?
              </h2>
              <p className="mt-1 text-md text-navy">
                It stops being offered and stops being counted. Nothing is deleted:{' '}
                {retiring.memberCount === 1 ? 'the person' : `all ${retiring.memberCount} people`} tagged
                into it keep the tag, so who was in it stays readable.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="danger" disabled={busy} onClick={() => void retire()}>
                  {busy ? 'Retiring…' : 'Retire group'}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => setRetiring(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {groups === null && !error && (
            <SkeletonTable caption="Informal groups" columns={GROUP_COLUMNS} rows={3} />
          )}

          {groups?.length === 0 && !error && (
            <div className="rounded-lg border border-hairline bg-card">
              <EmptyState title="No groups yet — create one to start organising people." />
            </div>
          )}

          {groups && groups.length > 0 && (
            <DataTable
              caption="Informal groups"
              columns={GROUP_COLUMNS}
            >
              {groups.map((group) => (
                <Row key={group.groupId}>
                  <Cell className="font-semibold">{group.name}</Cell>
                  <Cell className="text-muted">
                    {group.ownerName}
                    {group.ownerHasLeft && (
                      <span className="block text-sm text-alert">
                        No longer in this office — hand it to somebody else
                      </span>
                    )}
                  </Cell>
                  <Cell className="text-muted">
                    {group.memberCount} {group.memberCount === 1 ? 'person' : 'people'}
                  </Cell>
                  <Cell>
                    <span className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setRetiring(null);
                          setEditing({
                            groupId: group.groupId,
                            name: group.name,
                            owner: group.ownerMembershipId,
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          setEditing(null);
                          setRetiring(group);
                        }}
                      >
                        Retire
                      </Button>
                    </span>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </>
      )}

      {tab !== 'rolelog' && tab !== 'groups' && tab !== 'pending' && page === null && (phone ? (
        <SkeletonCards count={4} label={tab === 'removed' ? 'Loading removed members…' : 'Loading the office roster…'} />
      ) : (
        <SkeletonTable
          caption={tab === 'removed' ? 'Removed members' : 'Office roster'}
          columns={rosterColumns(tab)}
        />
      ))}

      {tab !== 'rolelog' && tab !== 'groups' && tab !== 'pending' && page?.length === 0 && !error && (
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

      {tab !== 'rolelog' && tab !== 'groups' && tab !== 'pending' && page && page.length > 0 && (
        <>
          {phone ? (
            <MemberCards
              members={page}
              removed={tab === 'removed'}
              busy={busy}
              onToggleCoreLeader={(m) => void toggleCoreLeader(m)}
            />
          ) : (
          <DataTable
            caption={tab === 'removed' ? 'Removed members' : 'Office roster'}
            columns={rosterColumns(tab)}
          >
            {page.map((m) => (
              <Row key={m.membershipId}>
                <Cell className="font-semibold">
                  {/* Indented by role, as the prototype's nested directory does it:
                      AB flush, AAB 16px, Agent 32px (`KPM_Owner.html:218-219`). It makes
                      the roster read as the tree it is, without becoming one. */}
                  <span className={ROLE_INDENT[m.role]}>
                    <Link href={`/people/members/${m.membershipId}`} className="underline">
                      {displayName(m)}
                    </Link>
                    <span className="block text-sm font-normal text-muted">{m.email}</span>
                  </span>
                </Cell>
                {/* On one line: *PRU-80003* broke at its hyphen in a narrow column (P18.97-T4 AC-3; UI-024). */}
                <Cell className="whitespace-nowrap">
                  <code className="text-sm">{m.agentCode}</code>
                </Cell>
                <Cell>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={m.role} />
                    {m.isKpmOwner && <Tag>Owner</Tag>}
                    {m.isKpmAdmin && <Tag>Admin</Tag>}
                    {/* The amber chip (`KPM_Owner.html:4508`), and on a leader's row the prototype's *+ Tag* idiom
                        (`:4512`) for the one tag it sets here (ADR-0159 §1). */}
                    {m.isCoreLeader && <Tag>{CORE_LEADER_LABEL}</Tag>}
                    {tab === 'directory' && m.canTagCoreLeader && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleCoreLeader(m)}
                        aria-label={m.isCoreLeader
                          ? `Remove the Core Leader tag from ${displayName(m)}`
                          : `Tag ${displayName(m)} Core Leader`}
                        title={m.isCoreLeader ? 'Remove the Core Leader tag' : 'Tag as Core Leader'}
                        className="px-0.5 text-2xs font-semibold text-muted hover:text-amber-deep disabled:opacity-50"
                      >
                        {/* Beside the chip it removes, a cross; on an untagged leader, the prototype's words. */}
                        {m.isCoreLeader ? <span aria-hidden>×</span> : '+ Core Leader'}
                      </button>
                    )}
                  </span>
                </Cell>
                <Cell className="text-muted">{m.leaderName ?? '—'}</Cell>
                {tab !== 'removed' && (
                  <>
                    <Cell className="whitespace-nowrap text-muted">
                      {m.lastActivityDays === undefined ? '—' : m.lastActivityOn ? (
                        <time dateTime={m.lastActivityOn}>{daysAgoWords(m.lastActivityDays)}</time>
                      ) : daysAgoWords(m.lastActivityDays)}
                    </Cell>
                    <Cell className="whitespace-nowrap text-muted">
                      {m.lastCoachedDays === undefined ? '—' : daysAgoWords(m.lastCoachedDays)}
                    </Cell>
                  </>
                )}
                <Cell className="text-muted">
                  {/* Leadership is the graph, not the role (OD-23): an AAB with no reports leads nobody, and this
                      column says so — *No team*, the words the Overview's AB list uses (ADR-0176 §2; UI-024). */}
                  {m.isLeader ? `${m.directCount} direct · ${m.subtreeCount} in unit` : NO_TEAM}
                </Cell>
                <Cell className={tab === 'removed' ? 'whitespace-nowrap text-muted' : undefined}>
                  {tab === 'removed' ? (
                    <>
                      {m.removedAt ? (
                        <time dateTime={m.removedAt}>
                          {formatOfficeDay(m.removedAt)}
                        </time>
                      ) : (
                        '—'
                      )}
                      {/* The membership she left, and the day she came back on another (P18.97-T4 AC-3, ADR-0176 §5). */}
                      {m.rejoinedOn && (
                        <span className="block text-sm">
                          Rejoined <time dateTime={m.rejoinedOn}>{formatCalendarDay(m.rejoinedOn)}</time>
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusPill
                        status={STATUS_TO_PILL[m.status]}
                        label={MEMBER_STATUS_LABEL[m.status]}
                      />
                      {/* She left and came back: the live membership says so beside its status, so *Active* beside
                          a *Removed* tab holding her earlier one is not read as a contradiction (UI-024). */}
                      {m.rejoinedOn && <StatusPill status="neutral" label="Rejoined" />}
                    </span>
                  )}
                </Cell>
              </Row>
            ))}
          </DataTable>
          )}

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
    </Page>
  );
}

/**
 * **The roster as cards** (P18.97-T7 AC-1, ADR-0178 §4; UI-034). A card per member, in the table's order and words,
 * through the shared card pieces (`components/ui/row-cards.tsx`): the name — the person page's link, 44px tall — with
 * the rung's badge, *Owner*, *Admin*, *Core Leader* and its control after it on the same wrapping line, their email
 * under it; the status, with ***Rejoined*** beside it for a member who came back (P18.97-T4 AC-3); then each value
 * under its column's heading — *Agent code* on one line, *Reports to*, *Last activity*, *Last coached*, *Unit* (*No
 * team* for one who leads nobody) and, on *Removed*, the day they left and ***Rejoined {date}***. A value the table
 * writes as — is not drawn. The cards step in by rung as the table's names do, 12px a step.
 */
function MemberCards({
  members, removed, busy, onToggleCoreLeader,
}: {
  members: Member[];
  /** The *Removed* tab: the day they left in place of the status, and no activity. */
  removed: boolean;
  busy: boolean;
  onToggleCoreLeader: (member: Member) => void;
}) {
  return (
    <RowCards label={removed ? 'Removed members' : 'Office roster'}>
      {members.map((m) => (
        <RowCard key={m.membershipId} data-row={m.membershipId} style={{ paddingLeft: CARD_INDENT[m.role] }}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link
              href={`/people/members/${m.membershipId}`}
              className={cn('min-w-0 break-words text-md font-semibold text-navy underline', TEXT_TAP)}
            >
              {displayName(m)}
            </Link>
            <RoleBadge role={m.role} />
            {m.isKpmOwner && <Tag>Owner</Tag>}
            {m.isKpmAdmin && <Tag>Admin</Tag>}
            {m.isCoreLeader && <Tag>{CORE_LEADER_LABEL}</Tag>}
            {!removed && m.canTagCoreLeader && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggleCoreLeader(m)}
                aria-label={m.isCoreLeader
                  ? `Remove the Core Leader tag from ${displayName(m)}`
                  : `Tag ${displayName(m)} Core Leader`}
                title={m.isCoreLeader ? 'Remove the Core Leader tag' : 'Tag as Core Leader'}
                className={cn(
                  'inline-flex items-center justify-center px-0.5 text-2xs font-semibold text-muted hover:text-amber-deep disabled:opacity-50',
                  TAP_TARGET,
                )}
              >
                {m.isCoreLeader ? <span aria-hidden>×</span> : '+ Core Leader'}
              </button>
            )}
          </p>
          <p className="break-all text-sm text-muted">{m.email}</p>
          {!removed && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill status={STATUS_TO_PILL[m.status]} label={MEMBER_STATUS_LABEL[m.status]} />
              {m.rejoinedOn && <StatusPill status="neutral" label="Rejoined" />}
            </p>
          )}
          <CardFields>
            {/* On one line, as in the table: *PRU-80003* never breaks at its hyphen (P18.97-T4 AC-3). */}
            <CardField label="Agent code"><code className="whitespace-nowrap text-sm text-navy">{m.agentCode}</code></CardField>
            {m.leaderName && <CardField label="Reports to"><span className="text-muted">{m.leaderName}</span></CardField>}
            {!removed && m.lastActivityDays !== undefined && (
              <CardField label="Last activity">
                <span className="text-muted">
                  {m.lastActivityOn
                    ? <time dateTime={m.lastActivityOn}>{daysAgoWords(m.lastActivityDays)}</time>
                    : daysAgoWords(m.lastActivityDays)}
                </span>
              </CardField>
            )}
            {!removed && m.lastCoachedDays !== undefined && (
              <CardField label="Last coached"><span className="text-muted">{daysAgoWords(m.lastCoachedDays)}</span></CardField>
            )}
            <CardField label="Unit">
              <span className="text-muted">{m.isLeader ? `${m.directCount} direct · ${m.subtreeCount} in unit` : NO_TEAM}</span>
            </CardField>
            {removed && (m.removedAt || m.rejoinedOn) && (
              <CardField label="Removed">
                <span className="text-muted">
                  {m.removedAt && <time dateTime={m.removedAt}>{formatOfficeDay(m.removedAt)}</time>}
                  {m.rejoinedOn && (
                    <span className="block text-sm">
                      Rejoined <time dateTime={m.rejoinedOn}>{formatCalendarDay(m.rejoinedOn)}</time>
                    </span>
                  )}
                </span>
              </CardField>
            )}
          </CardFields>
        </RowCard>
      ))}
    </RowCards>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill bg-amber/20 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-amber-deep">
      {children}
    </span>
  );
}
