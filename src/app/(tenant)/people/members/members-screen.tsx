'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddUserButton } from '@/components/admin/add-user-button';
import { GroupDialog } from '@/components/groups/group-dialog';
import { Page } from '@/components/page';
import { MemberRowMenu } from '@/components/people/member-actions';
import { MemberSheet } from '@/components/people/member-sheet';
import { PeoplePicker, type PickerPerson } from '@/components/people/people-picker';
import { GroupChip, HIT_AREA, PersonName, RecencyPill, StewardChip } from '@/components/people/people-parts';
import { TransferRequests } from '@/components/transfer-requests';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { FilterChips, SearchPill, type FilterChip } from '@/components/ui/list-rows';
import { REMOVED_ON_PHONE } from '@/components/ui/phone';
import { rungShort, useLadder } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { TonePill } from '@/components/ui/tone-pill';
import { useToast } from '@/components/ui/toast';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { memberSheetMessages } from '@/i18n/messages/member-sheet';
import { membersMessages } from '@/i18n/messages/members';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { displayName } from '@/lib/display-name';
import { dayInZone, formatCalendarDay, OFFICE_TIME_ZONE } from '@/lib/format';
import { approveRequest, declineRequest, readInbox, type PendingRequest } from '@/lib/join';
import { daysAgoWords } from '@/lib/kpm-overview';
import { readOrgTree } from '@/lib/org';
import {
  firstNameOf, placeMember, readPeopleHistory, readRoster, type HistoryEntry, type HistoryFilter, type RosterFilter,
  type RecencyStatus, type RosterMember,
} from '@/lib/people';
import { useCan } from '@/lib/session';
import { useDebounced } from '@/lib/use-debounced';

type Tab = 'members' | 'waiting' | 'history';
const TABS: readonly Tab[] = ['members', 'waiting', 'history'];

/** The roster's first page; *Lihat semua (n)* reads the rest. */
const FIRST_PAGE = 25;
const NEXT_PAGES = 100;

/** Whole days from an instant to today, in the office's calendar. */
function daysSince(iso: string, today: string): number {
  const day = dayInZone(OFFICE_TIME_ZONE, new Date(iso));
  return Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000));
}

/**
 * **All members** (P19.20-T1; the People mockups' frames 1–12; ADR-0273 §2) — one screen behind two routes:
 * `/people/members`, and `/people/members/[membershipId]`, the same page with that member's sheet open, so every link
 * other pages made to a member still lands (ADR-0273 §1).
 *
 * - **Tabs** *Anggota (n) · Menunggu (red count) · Riwayat*, and *Undang anggota* (`/user-management/add`). `?tab=pending`,
 *   which a transfer's notice links to, opens *Menunggu*; `?member=` opens a sheet.
 * - **Anggota** (AC-2): *Cari nama atau kode agen* and *Semua · AB · AAB · Agent · ★ Core leader*, both the server's;
 *   from 768px a table with fixed column widths — *Anggota* (photo, the AB / AAB label before the NAME, ★, the code with
 *   one *Owner* / *Admin* chip), *Group* (the chip — an AB's orange and opening the Group dialog, *Tanpa group* dashed, an
 *   AAB's or an agent's grey and locked with *ikut AB …*; *Group Leader* in orange under an AB's), *Melapor ke* with the
 *   unit under it, *Aktivitas terakhir* and *Coaching terakhir* as coloured pills, and ⋯ — and below it the same as rows.
 *   Test accounts are never sent. A core leader's rows outside their downline are muted and do not open (AC-5).
 * - **Menunggu** (AC-4): the move requests (`TransferRequests`), then *Sudah daftar, belum masuk unit* — *Pilih leader*,
 *   or *Tolak* / *Setujui* for somebody who asked a leader.
 * - **Riwayat** (AC-4): role changes, removals and moves in one list, *Semua · Perubahan peran · Dikeluarkan · Pindah unit*.
 */
export function MembersScreen({ openMemberId }: { openMemberId?: string }) {
  const t = useMessages(membersMessages);
  const sheetWords = useMessages(memberSheetMessages);
  const router = useRouter();
  const ladder = useLadder();
  const { show } = useToast();
  const steward = useCan('member:tag_group');
  const mayDecideMoves = useCan('member:transfer_approve');
  const [tab, setTab] = useState<Tab>('members');
  const [sheet, setSheet] = useState<string | null>(openMemberId ?? null);
  const [q, setQ] = useState('');
  const query = useDebounced(q);
  const [filter, setFilter] = useState<RosterFilter>('all');
  const [rows, setRows] = useState<RosterMember[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ directory: number; pending: number } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [moving, setMoving] = useState(false);
  const [groupFor, setGroupFor] = useState<RosterMember | null>(null);
  const [moves, setMoves] = useState(0);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  /* A notice opens its tab; `?member=` opens a sheet (read once, on arrival). */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const asked = params.get('tab');
    if (asked === 'pending' || asked === 'waiting') setTab('waiting');
    else if (asked === 'history' || asked === 'removed' || asked === 'rolelog') setTab('history');
    const member = params.get('member');
    if (member) setSheet(member);
  }, []);

  const loadRoster = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      const page = await readRoster({ q: query, filter, limit: FIRST_PAGE });
      if (!live.current) return;
      setRows(page.members);
      setNextCursor(page.nextCursor);
      if (page.counts) setCounts({ directory: page.counts.directory, pending: page.counts.pending });
    } catch (err) {
      if (!live.current) return;
      setError(toDisplayError(err));
      setRows([]);
    }
  }, [query, filter]);
  useEffect(() => { void loadRoster(); }, [loadRoster]);

  /** *Lihat semua (n)*: every page after the first, appended. */
  async function seeAll() {
    if (!nextCursor || !rows) return;
    setMoving(true);
    try {
      let cursor: string | null = nextCursor;
      let all = rows;
      while (cursor) {
        const page = await readRoster({ q: query, filter, cursor, limit: NEXT_PAGES });
        all = [...all, ...page.members];
        cursor = page.nextCursor;
      }
      setRows(all);
      setNextCursor(null);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setMoving(false);
    }
  }

  const closeSheet = () => {
    setSheet(null);
    // The deep link (`/people/members/[id]`) leaves its address once the sheet is closed.
    if (openMemberId) router.replace('/people/members');
  };

  const chips: readonly FilterChip<RosterFilter>[] = [
    { key: 'all', label: t.all },
    { key: 'ab', label: rungShort('AB', ladder) },
    { key: 'aab', label: rungShort('AAB', ladder) },
    { key: 'agent', label: rungShort('AGENT', ladder) },
    // P19.29-T5 AC-2 (UI-215 (21 Nov)): *★* alone on a phone, so the five fit the width; its words stay its name.
    { key: 'core', label: `★ ${t.coreLeaders}`, short: '★' },
  ];
  const waitingCount = (counts?.pending ?? 0) + moves;
  const filtered = query.trim() !== '' || filter !== 'all';

  return (
    <Page
      title={kept('All members')}
      actions={(
        // P19.28-T2 AC-1 (UI-203 (21 Nov)): the shared *Tambah user* sheet, this KPM fixed (`AddUserButton`).
        <AddUserButton
          label={t.invite}
          icon={<LineIcon name="userPlus" className="h-4 w-4" />}
          fallbackHref="/user-management/add"
          className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-hairline bg-card px-4 text-md font-semibold text-navy hover:bg-hover-row"
        />
      )}
    >
      <div role="tablist" aria-label={kept('All members')} className="mb-3 inline-flex max-w-full gap-1 overflow-x-auto rounded-pill bg-card p-1">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill px-4 text-md font-semibold',
              tab === key ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
            )}
          >
            {t.tabs[key]}
            {key === 'members' && counts && <span>{counts.directory}</span>}
            {key === 'waiting' && waitingCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-alert px-1.5 text-2xs font-bold text-white">
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}

      {tab === 'members' && (
        <>
          <div role="search" aria-label={t.search} className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center">
            <SearchPill label={t.search} value={q} onChange={setQ} className="lg:w-80" />
            <FilterChips label={t.filters} chips={chips} active={filter} onSelect={setFilter} />
          </div>
          {rows === null && <SkeletonCards count={4} label={t.loading} />}
          {rows?.length === 0 && !error && (
            <div className="rounded-lg border border-card-edge bg-card">
              <EmptyState
                variant={filtered ? 'filtered' : 'empty'}
                title={filtered ? t.noMatch : t.noMembers}
                action={filtered ? (
                  <Button variant="secondary" onClick={() => { setQ(''); setFilter('all'); }}>{t.clearFilters}</Button>
                ) : undefined}
              />
            </div>
          )}
          {rows && rows.length > 0 && (
            <>
              <Roster
                rows={rows}
                steward={steward}
                onOpen={setSheet}
                onChanged={() => void loadRoster()}
                onChangeGroup={setGroupFor}
              />
              {nextCursor && (
                <button type="button" onClick={() => void seeAll()} disabled={moving}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-lg bg-card text-md font-semibold text-navy hover:bg-hover-row">
                  {filtered ? t.seeMore : t.seeAll({ n: counts?.directory ?? rows.length })}
                  <LineIcon name="chevronRight" className="h-4 w-4" />
                </button>
              )}
              {/* P19.29-T5 AC-3 (UI-213 (21 Nov)): the legend is not drawn on a phone; from 768px as before. */}
              <p className={cn('mt-2 text-sm text-muted', REMOVED_ON_PHONE)} data-members-legend="">{t.legend}</p>
            </>
          )}
        </>
      )}

      {tab === 'waiting' && (
        <Waiting
          mayDecideMoves={mayDecideMoves}
          onMoves={setMoves}
          onOpen={setSheet}
          onChanged={() => { void loadRoster(); show(sheetWords.saved); }}
        />
      )}
      {/* Mounted beside the tabs, so *Menunggu*'s count includes the moves before the tab is opened. */}
      {tab !== 'waiting' && mayDecideMoves && <span hidden><TransferRequests onCount={setMoves} /></span>}

      {tab === 'history' && <History onOpen={setSheet} />}

      {sheet && <MemberSheet membershipId={sheet} onClose={closeSheet} onChanged={() => void loadRoster()} />}
      {groupFor && (
        <GroupDialog
          ab={{ membershipId: groupFor.membershipId, name: displayName(groupFor), role: rungShort(groupFor.orgLevelCode ?? 'AB', ladder), people: groupFor.subtreeCount + 1 }}
          manageHref={null}
          onClose={() => setGroupFor(null)}
          onSaved={() => { setGroupFor(null); void loadRoster(); }}
        />
      )}
    </Page>
  );
}

/** The roster: a table from 768px, rows below it — the same content in the same order. */
function Roster({
  rows, steward, onOpen, onChanged, onChangeGroup,
}: {
  rows: RosterMember[];
  steward: boolean;
  onOpen: (membershipId: string) => void;
  onChanged: () => void;
  onChangeGroup: (member: RosterMember) => void;
}) {
  const t = useMessages(membersMessages);
  const c = t.columns;
  return (
    <>
      <div className="overflow-hidden rounded-lg bg-card max-md:hidden">
        <table className="relative w-full table-fixed text-left">
          <caption className="sr-only">{t.caption}</caption>
          <colgroup>
            <col />
            <col className="w-[11.5rem]" />
            <col className="w-[10.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-[8.5rem]" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b border-divider text-sm font-semibold text-muted">
              <th scope="col" className="px-4 py-2.5">{c.member}</th>
              <th scope="col" className="px-2 py-2.5">{c.group}</th>
              <th scope="col" className="px-2 py-2.5">{c.reportsTo}</th>
              <th scope="col" className="px-2 py-2.5">{c.lastActivity}</th>
              <th scope="col" className="px-2 py-2.5">{c.lastCoached}</th>
              <th scope="col" className="px-2 py-2.5"><span className="sr-only">{c.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.membershipId} data-row={m.membershipId} data-muted={m.openable === false ? '' : undefined}
                className={cn('border-b border-divider last:border-b-0', m.openable === false && 'bg-base/60')}>
                <td className="px-4 py-2.5"><NameCell member={m} onOpen={onOpen} /></td>
                <td className="px-2 py-2.5"><GroupCell member={m} steward={steward} onChangeGroup={onChangeGroup} /></td>
                <td className="px-2 py-2.5"><ReportsCell member={m} /></td>
                <td className="px-2 py-2.5">
                  <RecencyPill days={m.lastActivityDays} status={m.lastActivityStatus} label={c.lastActivity} />
                </td>
                <td className="px-2 py-2.5">
                  <RecencyPill days={m.lastCoachedDays} status={m.lastCoachedStatus} label={c.lastCoached} />
                </td>
                <td className="px-1 py-2.5 text-right">
                  <MemberRowMenu member={m} steward={steward} onChanged={onChanged} onChangeGroup={() => onChangeGroup(m)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul aria-label={t.caption} className="flex flex-col divide-y divide-divider overflow-hidden rounded-lg bg-card md:hidden">
        {rows.map((m) => (
          <li key={m.membershipId} data-row={m.membershipId} className={cn('flex flex-col gap-1.5 px-3 py-3', m.openable === false && 'bg-base/60')}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><NameCell member={m} onOpen={onOpen} /></div>
              <MemberRowMenu member={m} steward={steward} onChanged={onChanged} onChangeGroup={() => onChangeGroup(m)} />
            </div>
            <div className="pl-12"><GroupCell member={m} steward={steward} onChangeGroup={onChangeGroup} /></div>
            <RecencyLine member={m} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** The value's ink: the server's bucket in its pill's colour (`RecencyPill`'s tones — red never, yellow after 14 days). */
const RECENCY_TONE: Record<RecencyStatus, { tone: 'green' | 'amber' | 'red'; ink: string }> = {
  recent: { tone: 'green', ink: 'text-pill-green-ink' },
  lapsed: { tone: 'amber', ink: 'text-pill-amber-ink' },
  never: { tone: 'red', ink: 'text-pill-red-ink' },
};

/**
 * **A phone's row: when they were last active and last coached, on one line** (P19.29-T5 AC-1; UI-215 (21 Nov): two
 * unlabelled *Tidak pernah* pills) — *Aktivitas: Tidak pernah · Coaching: Tidak pernah*, 13/400 grey, both labelled, each
 * value in its pill's ink. It starts at the row's edge, not under the name: at 360px the row has 304px and the longest
 * line, both *Tidak pernah*, is 297px; under the name it would wrap. Each half keeps together, so a narrower screen breaks
 * it at the dot. From 768px the table's two pill columns, as before.
 */
function RecencyLine({ member }: { member: RosterMember }) {
  const t = useMessages(membersMessages);
  const language = useLanguage();
  const part = (label: string, days: number | null | undefined, status: RecencyStatus | undefined) => {
    if (days === undefined || !status) return null;
    const { tone, ink } = RECENCY_TONE[status];
    return (
      <span key={label} className="whitespace-nowrap">
        {label}: <span className={ink} data-tone={tone}>{daysAgoWords(days, language)}</span>
      </span>
    );
  };
  const parts = [
    part(t.recency.activity, member.lastActivityDays, member.lastActivityStatus),
    part(t.recency.coaching, member.lastCoachedDays, member.lastCoachedStatus),
  ].filter((p) => p !== null);
  if (parts.length === 0) return null;
  return (
    <p className="text-base text-muted" data-recency-line="">
      {parts.flatMap((p, i) => (i === 0 ? [p] : [' · ', p]))}
    </p>
  );
}

/**
 * Photo, the label and the NAME (★), and the code with the Owner / Admin chip; the name opens the sheet. Exported for
 * `long-words.browser.spec.ts`, which measures it in its fixed column at 1024px.
 */
export function NameCell({ member, onOpen }: { member: RosterMember; onOpen: (membershipId: string) => void }) {
  const t = useMessages(membersMessages);
  const name = displayName(member);
  const muted = member.openable === false;
  // `max-w-full`: the name ends in "…" inside its fixed column (DESIGN-RULES) — an inline-flex grows to its content, so
  // without it a long NAME ran into *Group* at 1024 (found 2026-11-20); the label and ★ stay whole.
  const label = (
    <PersonName name={name} role={member.role} rungCode={member.orgLevelCode} coreLeader={member.isCoreLeader} muted={muted} className="max-w-full text-md" />
  );
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} photoUrl={member.photoUrl} seed={member.membershipId} size={36} className={muted ? 'opacity-60' : undefined} />
      <div className="min-w-0">
        {muted ? <div className="min-w-0">{label}</div> : (
          <button type="button" onClick={() => onOpen(member.membershipId)} aria-label={t.open({ name })}
            className={cn('block min-w-0 max-w-full text-left hover:underline', HIT_AREA)}>
            {label}
          </button>
        )}
        <div className="flex items-center gap-1.5 text-sm text-muted">
          <span>{member.agentCode}</span>
          <StewardChip owner={member.isKpmOwner} admin={!member.isKpmOwner && member.isKpmAdmin} />
        </div>
      </div>
    </div>
  );
}

/** *Group*: the chip, *Group Leader* under an AB's, *ikut AB …* under a follower's. */
function GroupCell({ member, steward, onChangeGroup }: { member: RosterMember; steward: boolean; onChangeGroup: (m: RosterMember) => void }) {
  const t = useMessages(membersMessages);
  const sheet = useMessages(memberSheetMessages);
  const place = member.groupPlace;
  if (!place) return <span className="text-sm text-muted">—</span>;
  const isAb = member.role === 'ab';
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <GroupChip
        name={place.group?.name ?? null}
        locked={!isAb}
        onOpen={isAb && steward ? () => onChangeGroup(member) : undefined}
        label={t.changeGroupOf({ name: displayName(member) })}
      />
      {isAb && place.isGroupLeader && <span className="text-xs font-bold text-primary-ink">{sheet.groupLeader}</span>}
      {!isAb && place.ab && <span className="text-xs text-muted">{sheet.followsAb({ name: firstNameOf(place.ab.name) })}</span>}
    </div>
  );
}

/** *Melapor ke*: the leader's NAME, and the unit under it. */
function ReportsCell({ member }: { member: RosterMember }) {
  const t = useMessages(membersMessages);
  return (
    <div className="min-w-0 text-sm">
      <div className="truncate uppercase text-navy">{member.leaderName ?? '—'}</div>
      <div className="truncate text-muted">
        {member.isLeader ? t.unitCounts({ direct: member.directCount, unit: member.subtreeCount }) : t.noTeam}
      </div>
    </div>
  );
}

/** *Menunggu*: the move requests, then whoever registered and is in no unit. */
function Waiting({
  mayDecideMoves, onMoves, onOpen, onChanged,
}: {
  mayDecideMoves: boolean;
  onMoves: (n: number) => void;
  onOpen: (membershipId: string) => void;
  onChanged: () => void;
}) {
  const t = useMessages(membersMessages).waiting;
  const language = useLanguage();
  const ladder = useLadder();
  const [people, setPeople] = useState<RosterMember[] | null>(null);
  const [asks, setAsks] = useState<PendingRequest[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<RosterMember | null>(null);
  const [leaders, setLeaders] = useState<PickerPerson[]>([]);
  const today = dayInZone(OFFICE_TIME_ZONE, new Date());

  const load = useCallback(async () => {
    setError(null);
    try {
      const [waiting, inbox] = await Promise.all([
        readRoster({ status: 'pending', limit: 100 }),
        readInbox().catch(() => [] as PendingRequest[]),
      ]);
      setPeople(waiting.members);
      setAsks(inbox);
    } catch (err) {
      setError(toDisplayError(err));
      setPeople([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function openPicker(member: RosterMember) {
    setPicking(member);
    try {
      // The KPM's leaders this reader may place under: a core leader their own downline (`openable`).
      const tree = await readOrgTree(undefined, 'kpm');
      setLeaders(tree.nodes
        .filter((n) => n.role !== 'agent' && n.openable !== false)
        .map((n) => ({ membershipId: n.membershipId, fullName: n.fullName, preferredName: n.preferredName, agentCode: n.agentCode, role: n.role, photoUrl: n.photoUrl }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (err) {
      setError(toDisplayError(err));
    }
  }

  async function act(write: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await write();
      setPicking(null);
      await load();
      onChanged();
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {mayDecideMoves && <TransferRequests onCount={onMoves} />}
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      <section aria-labelledby="registered-title">
        <h2 id="registered-title" className="mb-2 font-display text-md font-bold text-navy">{t.registeredTitle}</h2>
        {people === null && <SkeletonCards count={2} label={t.loading} />}
        {people?.length === 0 && (
          <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.nothing} /></div>
        )}
        {people && people.length > 0 && (
          <ul className="flex flex-col gap-2">
            {people.map((m) => {
              const ask = asks.find((r) => r.membershipId === m.membershipId);
              const ago = m.registeredAt ? daysAgoWords(daysSince(m.registeredAt, today), language) : null;
              const name = displayName(m);
              return (
                <li key={m.membershipId} data-waiting={m.membershipId}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-card-edge bg-card px-4 py-3">
                  <Avatar name={name} photoUrl={m.photoUrl} seed={m.membershipId} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md">
                      <button type="button" onClick={() => onOpen(m.membershipId)} className={cn('font-bold uppercase text-ink hover:underline', HIT_AREA)}>{name}</button>
                      <span className="text-muted"> · {rungShort(m.orgLevelCode ?? m.role.toUpperCase(), ladder)} · {m.agentCode}</span>
                    </p>
                    <p className="text-sm text-muted">
                      {ask ? t.askedLeader({ name: ask.leaderName.toUpperCase(), ago: ago ?? '' }) : t.notChosen({ ago: ago ?? '' })}
                    </p>
                  </div>
                  {ask ? (
                    <span className="flex shrink-0 gap-2">
                      <Button variant="secondary" className="min-h-11 rounded-pill" disabled={busy}
                        onClick={() => void act(() => declineRequest(ask.requestId))}>{t.decline}</Button>
                      <Button className="min-h-11 rounded-pill" disabled={busy}
                        onClick={() => void act(() => approveRequest(ask.requestId, undefined, today))}>{t.approve}</Button>
                    </span>
                  ) : (
                    <Button className="min-h-11 shrink-0 rounded-pill" disabled={busy} onClick={() => void openPicker(m)}>{t.pickLeader}</Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {picking && (
        <PeoplePicker
          title={t.pickTitle({ name: displayName(picking).toUpperCase() })}
          people={leaders}
          actionLabel={t.pickLeader}
          note={t.pickNote}
          busy={busy}
          error={error}
          onPick={(leaderId) => void act(() => placeMember(picking.membershipId, leaderId))}
          onClose={() => setPicking(null)}
        />
      )}
    </>
  );
}

/** *Riwayat*: one list, its filter the server's. */
function History({ onOpen }: { onOpen: (membershipId: string) => void }) {
  const t = useMessages(membersMessages).history;
  const ladder = useLadder();
  const figures = useFigureLanguage();
  const [kind, setKind] = useState<HistoryFilter>('all');
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setEntries(null);
    readPeopleHistory(kind)
      .then((rows) => { if (live) setEntries(rows); })
      .catch((err) => { if (live) { setError(toDisplayError(err)); setEntries([]); } });
    return () => { live = false; };
  }, [kind]);

  const chips = useMemo(() => (['all', 'role', 'removed', 'moved'] as const).map((key) => ({ key, label: t.filters[key] })), [t]);

  const pill = (e: HistoryEntry) => {
    if (e.kind === 'role') {
      return <TonePill tone="green">{`${e.fromRole ? rungShort(e.fromRole.toUpperCase(), ladder) : '—'} → ${e.toRole ? rungShort(e.toRole.toUpperCase(), ladder) : '—'}`}</TonePill>;
    }
    if (e.kind === 'removed') return <TonePill tone="red">{t.removed}</TonePill>;
    if (e.kind === 'moved') return <TonePill tone="blue">{t.moved}</TonePill>;
    return <TonePill tone="grey">{t.rejoined}</TonePill>;
  };
  const line = (e: HistoryEntry) => {
    const parts: string[] = [];
    if (e.kind === 'moved' && e.toLeaderName) parts.push(t.movedLine({ from: e.fromLeaderName?.toUpperCase() ?? '—', to: e.toLeaderName.toUpperCase() }));
    if (e.reason) parts.push(`“${e.reason}”`);
    if (e.actorName) parts.push(t.by({ name: e.actorName.toUpperCase() }));
    return parts.join(' · ');
  };

  return (
    <>
      <FilterChips label={t.caption} chips={chips} active={kind} onSelect={setKind} className="mb-3" />
      {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
      {entries === null && <SkeletonCards count={3} label={t.loading} />}
      {entries?.length === 0 && !error && (
        <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.empty} /></div>
      )}
      {entries && entries.length > 0 && (
        <ul aria-label={t.caption} className="flex flex-col divide-y divide-divider overflow-hidden rounded-lg bg-card">
          {entries.map((e) => (
            <li key={e.id} data-history={e.kind} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={e.fullName} photoUrl={e.photoUrl} seed={e.membershipId} size={32} />
              <div className="min-w-0 flex-1">
                {e.openable ? (
                  <button type="button" onClick={() => onOpen(e.membershipId)} className={cn('block max-w-full text-left hover:underline', HIT_AREA)}>
                    <PersonName name={e.fullName} role={e.role} className="text-md" />
                  </button>
                ) : <PersonName name={e.fullName} role={e.role} className="text-md" />}
                <p className="truncate text-sm text-muted">{line(e)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 md:flex-row md:items-center md:gap-4">
                {pill(e)}
                <time dateTime={e.at} className="whitespace-nowrap text-sm text-muted">
                  {formatCalendarDay(dayInZone(OFFICE_TIME_ZONE, new Date(e.at)), figures)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
