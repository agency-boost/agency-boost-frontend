'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { HEADER_BUTTON, HEADER_CONTROL } from '@/components/ui/header-control';
import { PickerMenu } from '@/components/ui/picker-menu';
import { SkeletonCards, SkeletonTable } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useMessages } from '@/i18n/language-provider';
import { coreLeadersMessages } from '@/i18n/messages/core-leaders';
import { saveSubgroupTarget } from '@/lib/advanced-analytics-page';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  bulkCoreLeaders, CORE_LEADERS_PAGE_ROWS, filterFromQuery, leadersFor, readCoreLeaders, sameFilter, saveCoreLeader,
  type CoreLeader, type CoreLeaderGroup, type CoreLeadersFilter, type CoreLeadersView,
} from '@/lib/core-leaders';
import { archiveGroup, createGroup, setCoreLeader, updateGroup } from '@/lib/org';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  DeleteGroupSheet, GroupSheet, LeaderEditSheet, ManageGroupsSheet, NO_GROUP, SetGroupSheet, type LeaderEdit,
} from './core-leaders-sheets';

type Sheet =
  | { kind: 'leader'; leader: CoreLeader }
  | { kind: 'group'; group: CoreLeaderGroup | null }
  | { kind: 'delete'; group: CoreLeaderGroup }
  | { kind: 'manage' }
  | { kind: 'setGroup' }
  | null;

/** A pressed toggle's look: orange when on (UI-199: *52px Core toggle (orange = on)*). */
const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';
function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn('h-4 w-4 shrink-0', className)}
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d={STAR} />
    </svg>
  );
}

/**
 * ***Core leaders & groups*** (P19.13-T3; UI-199; ADR-0253; the approved mockups `core-leaders-groups-mobile-2026-11-09`
 * and `-desktop-`): **every leader (AB and AAB) of the office with one group or none, a ★ group leader flag and the Core
 * leader tag**, and this year's targets — one read, every write the server's.
 *
 * - **Below 1024px, the phone's page**: three tiles that filter, *Kelola group ›*, the search with *Pilih*, one chip row,
 *   rows with a one-tap ★ Core, a row's sheet, *Pilih* mode's navy bar.
 * - **From 1024px, list + detail**: the tiles in a row, a sticky 320px *Group* pane, the leader table — tick, *Nama*, the
 *   group pill, *Tunjuk* / *★ Group leader*, *★ Core*, *Target AA* and *Target rekrut* from 1400px, › — and centred
 *   popups. No outer width: the shell's frame holds it (UI-192).
 * - **12 rows, then *Lihat semua n ›***. **Read-only for a view-as session** (`canWrite` false): every write hidden.
 */
export function CoreLeadersScreen({ initialGroup }: { initialGroup?: string | null }) {
  const t = useMessages(coreLeadersMessages);
  const desktop = useMediaQuery('desktop');
  const { toast, show } = useToast();
  const [view, setView] = useState<CoreLeadersView | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<CoreLeadersFilter>(() => filterFromQuery(initialGroup));
  const [query, setQuery] = useState('');
  const [more, setMore] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  /** *+ Tambah leader ke group*: ticking leaders for this group (*Masukkan ke GROUP*). */
  const [addTo, setAddTo] = useState<{ groupId: string; name: string } | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const answer = await readCoreLeaders();
      if (mounted.current) setView(answer);
    } catch (err) {
      if (mounted.current) setLoadError(toDisplayError(err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  /** A write: the page's answer, or a fresh read after a route that answers something else; the toast on success. */
  const act = useCallback(async (run: () => Promise<unknown>, message?: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const answer = await run();
      const fresh = answer && typeof answer === 'object' && 'leaders' in answer ? answer as CoreLeadersView : await readCoreLeaders();
      if (!mounted.current) return true;
      setView(fresh);
      if (message) show(message);
      return true;
    } catch (err) {
      if (mounted.current) setError(toDisplayError(err));
      return false;
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [show]);

  const shown = useMemo(() => (view ? leadersFor(view, filter, query) : []), [view, filter, query]);

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorBanner {...loadError} />
        <Button variant="secondary" onClick={() => void load()}>{t.retry}</Button>
      </div>
    );
  }
  if (!view) {
    return desktop
      ? <SkeletonTable caption={t.title} columns={[t.allLeaders, t.group, t.groupLeader, t.core]} rows={6} />
      : <SkeletonCards count={4} label={t.loading} />;
  }

  const write = view.canWrite;
  const pick = (f: CoreLeadersFilter) => { setFilter(f); setMore(false); };
  const groupOf = (id: string | null) => view.groups.find((g) => g.groupId === id) ?? null;
  const chosenGroup = typeof filter === 'object' ? groupOf(filter.groupId) : null;
  const clearSelection = () => { setSelected(new Set()); setSelecting(false); setAddTo(null); };
  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /** ★ Core in one tap: the tag alone, the row and the counts from what the server stored. */
  const toggleCore = async (leader: CoreLeader) => {
    setBusy(true);
    setError(null);
    try {
      const tags = await setCoreLeader(leader.membershipId, !leader.isCoreLeader);
      if (!mounted.current) return;
      setView((v) => {
        if (!v) return v;
        const leaders = v.leaders.map((l) => (l.membershipId === leader.membershipId ? { ...l, isCoreLeader: tags.isCoreLeader } : l));
        return { ...v, leaders, counts: { ...v.counts, core: leaders.filter((l) => l.isCoreLeader).length } };
      });
      // The name as the row draws it, in capitals (the mockup's *"Core leader ✓ · ARDIAN KUSUMA"*).
      const name = leader.name.toUpperCase();
      show(tags.isCoreLeader ? t.coreOn({ name }) : t.coreOff({ name }));
    } catch (err) {
      if (mounted.current) setError(toDisplayError(err));
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const saveLeader = async (leader: CoreLeader, edit: LeaderEdit) => {
    const ok = await act(async () => {
      const answer = await saveCoreLeader(leader.membershipId, {
        groupId: edit.groupId, isGroupLeader: edit.isGroupLeader, isCoreLeader: edit.isCoreLeader,
      });
      // The targets are the analytics' own write (`PUT /kpm/advanced-analytics/targets/subgroup/:id`), made when they moved.
      const targets = leader.targets;
      if (!view.canEditTargets || !targets || (targets.aa === edit.aa && targets.rec === edit.rec)) return answer;
      await saveSubgroupTarget(leader.membershipId, edit.aa, edit.rec);
      return readCoreLeaders();
    }, t.saved);
    if (ok) setSheet(null);
  };

  const bulk = async (body: { groupId?: string | null; isCoreLeader?: boolean }) => {
    const ok = await act(() => bulkCoreLeaders({ membershipIds: [...selected], ...body }), t.saved);
    if (ok) {
      if (body.groupId !== undefined && body.groupId !== null) pick({ groupId: body.groupId });
      clearSelection();
      setSheet(null);
    }
  };

  const saveGroup = async (group: CoreLeaderGroup | null, name: string, head: string | null) => {
    const ok = await act(
      () => (group ? updateGroup(group.groupId, name, head) : createGroup(name, null)),
      group ? t.saved : t.created({ name }),
    );
    if (!ok) return;
    if (group) { setSheet(null); return; }
    // *+ Group baru*: the group just made, open on the page and in its sheet, as the mockup leaves it.
    const fresh = await readCoreLeaders().catch(() => null);
    const made = fresh?.groups.find((g) => g.name === name) ?? null;
    if (fresh && mounted.current) setView(fresh);
    if (made) pick({ groupId: made.groupId });
    setSheet(made ? { kind: 'group', group: made } : null);
  };

  /** *+ Tambah leader ke group*: a new group is made first; then *Pilih* over *Tanpa group*, the bar *Masukkan ke …*. */
  const addLeadersTo = async (group: CoreLeaderGroup | null, name: string) => {
    let target = group;
    if (!target) {
      const ok = await act(() => createGroup(name, null), t.created({ name }));
      if (!ok) return;
      const fresh = await readCoreLeaders().catch(() => null);
      if (fresh && mounted.current) setView(fresh);
      target = fresh?.groups.find((g) => g.name === name) ?? null;
      if (!target) return;
    }
    setSheet(null);
    setAddTo({ groupId: target.groupId, name: target.name });
    setSelected(new Set());
    setSelecting(true);
    pick('none');
    show(t.pickLeaders({ name: target.name }));
  };

  const deleteGroup = async (group: CoreLeaderGroup) => {
    const ok = await act(() => archiveGroup(group.groupId), t.deleted({ name: group.name }));
    if (!ok) return;
    if (typeof filter === 'object' && filter.groupId === group.groupId) pick('all');
    setSheet(null);
  };

  /** Appoint or release a desktop row's ★ (*Tunjuk*): the group's own write, its name unchanged. */
  const appoint = (leader: CoreLeader) => {
    const group = groupOf(leader.groupId);
    if (!group) return;
    void act(() => updateGroup(group.groupId, group.name, leader.isGroupLeader ? null : leader.membershipId), t.saved);
  };

  /** A desktop row's group pill: one leader moved, by the bulk write. */
  const move = (leader: CoreLeader, groupId: string | null) =>
    void act(() => bulkCoreLeaders({ membershipIds: [leader.membershipId], groupId }), t.saved);

  const tiles = (
    <div className="grid grid-cols-3 gap-2 lg:gap-4">
      {([
        ['core', t.tiles.core, view.counts.core, 'text-primary-ink'],
        ['has', t.tiles.withGroup, view.counts.withGroup, 'text-ink'],
        ['none', t.tiles.withoutGroup, view.counts.withoutGroup, 'text-primary-ink'],
      ] as const).map(([key, label, n, tone]) => (
        <button
          key={key}
          type="button"
          aria-pressed={sameFilter(filter, key)}
          onClick={() => pick(sameFilter(filter, key) ? 'all' : key)}
          className={cn(
            'min-w-0 rounded-lg border-2 bg-card px-3 py-3 text-left lg:px-4',
            sameFilter(filter, key) ? 'border-primary' : 'border-transparent',
          )}
        >
          <span className="block text-sm font-semibold leading-tight text-muted">{label}</span>
          <span className={cn('mt-1 block text-2xl font-extrabold tabular-nums', tone)}>{n}</span>
        </button>
      ))}
    </div>
  );

  const sheets = (
    <>
      {sheet?.kind === 'leader' && (
        <LeaderEditSheet
          leader={sheet.leader}
          view={view}
          busy={busy}
          error={error}
          onSave={(edit) => void saveLeader(sheet.leader, edit)}
          onNewGroup={() => setSheet({ kind: 'group', group: null })}
          onClose={() => { setSheet(null); setError(null); }}
        />
      )}
      {sheet?.kind === 'setGroup' && (
        <SetGroupSheet
          view={view}
          count={selected.size}
          busy={busy}
          error={error}
          onSave={(groupId) => void bulk({ groupId })}
          onNewGroup={() => setSheet({ kind: 'group', group: null })}
          onClose={() => { setSheet(null); setError(null); }}
        />
      )}
      {sheet?.kind === 'manage' && (
        <ManageGroupsSheet
          view={view}
          onOpen={(group) => setSheet({ kind: 'group', group })}
          onNew={() => setSheet({ kind: 'group', group: null })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'group' && (
        <GroupSheet
          key={sheet.group?.groupId ?? 'new'}
          group={sheet.group}
          view={view}
          busy={busy}
          error={error}
          onSave={(name, head) => void saveGroup(sheet.group, name, head)}
          onAddLeaders={(name) => void addLeadersTo(sheet.group, name)}
          onDelete={() => sheet.group && setSheet({ kind: 'delete', group: sheet.group })}
          onClose={() => { setSheet(null); setError(null); }}
        />
      )}
      {sheet?.kind === 'delete' && (
        <DeleteGroupSheet
          group={sheet.group}
          busy={busy}
          error={error}
          onConfirm={() => void deleteGroup(sheet.group)}
          onClose={() => { setSheet({ kind: 'group', group: sheet.group }); setError(null); }}
        />
      )}
      <Toast toast={toast} />
    </>
  );

  const pageError = error && sheet === null ? <ErrorBanner {...error} /> : null;
  const props: ViewProps = {
    view, shown, filter, query, more, selected, selecting, addTo, write, busy, chosenGroup,
    onPick: pick, onQuery: (q) => { setQuery(q); setMore(false); }, onMore: () => setMore(true), onToggle: toggle,
    onSelectAll: (ids) => setSelected((s) => (ids.every((id) => s.has(id)) ? new Set([...s].filter((id) => !ids.includes(id))) : new Set([...s, ...ids]))),
    onSelecting: () => (selecting ? clearSelection() : setSelecting(true)),
    onClear: clearSelection,
    onCore: (leader) => void toggleCore(leader),
    onEdit: (leader) => { setError(null); setSheet({ kind: 'leader', leader }); },
    onAppoint: appoint,
    onMove: move,
    onSetGroup: () => setSheet({ kind: 'setGroup' }),
    onBulkGroup: (groupId) => void bulk({ groupId }),
    onMakeCore: () => void bulk({ isCoreLeader: true }),
    onAddTo: () => addTo && void bulk({ groupId: addTo.groupId }),
    onManage: () => setSheet({ kind: 'manage' }),
    onGroup: (group) => { setError(null); setSheet({ kind: 'group', group }); },
  };

  return (
    <div data-screen="core-leaders">
      {pageError}
      {desktop ? <DesktopView {...props} tiles={tiles} /> : <PhoneView {...props} tiles={tiles} />}
      {sheets}
    </div>
  );
}

interface ViewProps {
  view: CoreLeadersView;
  shown: CoreLeader[];
  filter: CoreLeadersFilter;
  query: string;
  more: boolean;
  selected: ReadonlySet<string>;
  selecting: boolean;
  addTo: { groupId: string; name: string } | null;
  write: boolean;
  busy: boolean;
  chosenGroup: CoreLeaderGroup | null;
  onPick: (filter: CoreLeadersFilter) => void;
  onQuery: (query: string) => void;
  onMore: () => void;
  onToggle: (membershipId: string) => void;
  onSelectAll: (membershipIds: string[]) => void;
  onSelecting: () => void;
  onClear: () => void;
  onCore: (leader: CoreLeader) => void;
  onEdit: (leader: CoreLeader) => void;
  onAppoint: (leader: CoreLeader) => void;
  onMove: (leader: CoreLeader, groupId: string | null) => void;
  onSetGroup: () => void;
  onBulkGroup: (groupId: string | null) => void;
  onMakeCore: () => void;
  onAddTo: () => void;
  onManage: () => void;
  onGroup: (group: CoreLeaderGroup | null) => void;
}

function SearchField({ query, onQuery, className }: { query: string; onQuery: (q: string) => void; className?: string }) {
  const t = useMessages(coreLeadersMessages);
  return (
    <label className={cn('relative block', className)}>
      <span className="sr-only">{t.searchLabel}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
        <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
      </svg>
      <input
        type="search"
        value={query}
        placeholder={t.search}
        onChange={(e) => onQuery(e.target.value)}
        className="h-11 w-full rounded-pill border border-hairline bg-card pl-10 pr-4 text-md text-ink placeholder:text-muted"
      />
    </label>
  );
}

/** A small tag on a row: the group, *Tanpa group* (amber), *★ Group leader* (orange tint). */
function Tag({ tone = 'grey', children }: { tone?: 'grey' | 'amber' | 'orange'; children: ReactNode }) {
  return (
    <span className={cn(
      'inline-flex h-5 items-center whitespace-nowrap rounded-pill px-2 text-sm font-semibold',
      tone === 'amber' ? 'bg-pill-amber text-pill-amber-ink' : tone === 'orange' ? 'bg-primary/[0.12] text-primary-ink' : 'bg-pill-grey text-pill-grey-ink',
    )}>
      {children}
    </span>
  );
}

/** *★ Core*: one tap toggles (UI-199), pressed while the leader is one. Read-only, it shows the tag and does nothing. */
function CoreButton({ leader, write, busy, onCore, size }: {
  leader: CoreLeader; write: boolean; busy: boolean; onCore: (l: CoreLeader) => void; size: 'phone' | 'desktop';
}) {
  const t = useMessages(coreLeadersMessages);
  const on = leader.isCoreLeader;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${t.coreLeader} · ${leader.name}`}
      disabled={!write || busy}
      onClick={(e) => { e.stopPropagation(); onCore(leader); }}
      className={cn(
        'flex shrink-0 items-center justify-center font-bold disabled:cursor-default',
        size === 'phone' ? 'h-[52px] w-[52px] flex-col gap-0.5 rounded-row text-sm' : 'h-8 gap-1 rounded-pill px-2.5 text-sm',
        on ? 'bg-primary text-primary-contrast' : 'bg-hover-row text-muted',
        !write && 'opacity-80',
      )}
    >
      <StarIcon filled={on} className={size === 'phone' ? 'h-5 w-5' : undefined} />
      <span>{t.core}</span>
    </button>
  );
}

/** The bar a selection raises: *n dipilih · Atur group · ★ Jadikan core*, or *Batal · Masukkan ke GROUP*. */
function SelectionBar({ props, floating }: { props: ViewProps; floating: boolean }) {
  const t = useMessages(coreLeadersMessages);
  const { selected, addTo, busy, view } = props;
  const none = selected.size === 0;
  return (
    <div
      role="region"
      aria-label={t.selected({ n: selected.size })}
      className={cn(
        'flex items-center gap-2 bg-secondary text-secondary-contrast',
        floating
          ? 'fixed inset-x-3 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 rounded-[22px] py-2 pl-4 pr-2 shadow-modal'
          : 'rounded-t-lg px-4 py-2.5',
      )}
    >
      <span className="mr-auto text-md font-bold" aria-live="polite">{t.selected({ n: selected.size })}</span>
      {addTo ? (
        <>
          <Button variant="secondary" disabled={busy} onClick={props.onClear}>{t.cancel}</Button>
          <Button disabled={busy || none} onClick={props.onAddTo}>{t.addTo({ name: addTo.name })}</Button>
        </>
      ) : (
        <>
          {floating ? (
            <Button variant="secondary" disabled={busy || none} onClick={props.onSetGroup}>{t.setGroup}</Button>
          ) : (
            <PickerMenu
              label={t.setGroup}
              value="__"
              buttonLabel={t.setGroup}
              disabled={busy || none}
              options={[
                ...view.groups.map((g) => ({ value: g.groupId, label: g.name })),
                { value: NO_GROUP, label: t.noGroup },
              ]}
              onChange={(value) => props.onBulkGroup(value === NO_GROUP ? null : value)}
            />
          )}
          <Button disabled={busy || none} onClick={props.onMakeCore}>{t.makeCore}</Button>
          {!floating && <Button variant="secondary" disabled={busy} onClick={props.onClear}>{t.cancel}</Button>}
        </>
      )}
    </div>
  );
}

/** *Lihat semua n ›* under twelve rows. */
function SeeAll({ props }: { props: ViewProps }) {
  const t = useMessages(coreLeadersMessages);
  if (props.more || props.shown.length <= CORE_LEADERS_PAGE_ROWS) return null;
  return (
    <button type="button" onClick={props.onMore} className="block w-full py-3 text-center text-base font-bold text-navy">
      {t.seeAll({ n: props.shown.length })}
    </button>
  );
}

const rowsOf = (props: ViewProps) => (props.more ? props.shown : props.shown.slice(0, CORE_LEADERS_PAGE_ROWS));

/**
 * **The phone's page** (below 1024px; the mobile mockup): tiles, *Kelola group ›*, search + *Pilih*, one scrollable chip
 * row (D-38), rows of 60px with a 52px ★ Core, *Lihat semua n ›*, and *Pilih* mode's navy bar above the tab bar.
 */
function PhoneView({ tiles, ...props }: ViewProps & { tiles: ReactNode }) {
  const t = useMessages(coreLeadersMessages);
  const { view, filter, selecting, selected, write } = props;
  const heads = view.groups.filter((g) => g.headMembershipId !== null).length;
  const chips: [CoreLeadersFilter, string][] = [
    ['all', t.all({ n: view.counts.leaders })],
    ['core', t.coreChip({ n: view.counts.core })],
    ...view.groups.map((g) => [{ groupId: g.groupId }, t.groupChip({ name: g.name, n: g.leaders })] as [CoreLeadersFilter, string]),
    ['none', t.noGroupChip({ n: view.counts.withoutGroup })],
  ];
  return (
    <div className={cn('flex flex-col gap-3', selecting && 'pb-24')}>
      {tiles}
      {write && (
        <button type="button" onClick={props.onManage}
          className="flex min-h-[52px] items-center gap-3 rounded-lg bg-card px-4 py-2 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-md font-bold text-ink">{t.manage}</span>
            <span className="block text-sm text-muted">{t.manageLine({ groups: view.groups.length, heads })}</span>
          </span>
          <span aria-hidden="true" className="text-lg text-muted">›</span>
        </button>
      )}
      <div className="flex items-center gap-2">
        <SearchField query={props.query} onQuery={props.onQuery} className="flex-1" />
        {write && (
          <button type="button" onClick={props.onSelecting}
            className={cn(HEADER_BUTTON, selecting && 'border-secondary bg-secondary text-secondary-contrast hover:bg-secondary')}>
            {selecting ? t.cancel : t.select}
          </button>
        )}
      </div>
      <div role="group" aria-label={t.filters} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {chips.map(([key, label]) => (
          <button
            key={typeof key === 'string' ? key : key.groupId}
            type="button"
            aria-pressed={sameFilter(filter, key)}
            onClick={() => props.onPick(key)}
            className={cn(HEADER_CONTROL, 'shrink-0 whitespace-nowrap rounded-pill px-3.5',
              sameFilter(filter, key) ? 'bg-secondary text-secondary-contrast' : 'bg-card text-muted')}
          >
            {label}
          </button>
        ))}
        {write && (
          <button type="button" onClick={() => props.onGroup(null)}
            className={cn(HEADER_CONTROL, 'shrink-0 whitespace-nowrap rounded-pill bg-card px-3.5 text-primary-ink')}>
            {t.newGroup}
          </button>
        )}
      </div>
      <div className="rounded-lg bg-card px-4">
        {props.shown.length === 0 ? (
          <p className="py-5 text-center text-md text-muted">{t.noLeaders}</p>
        ) : (
          <ul className="divide-y divide-divider">
            {rowsOf(props).map((leader) => {
              const group = view.groups.find((g) => g.groupId === leader.groupId);
              const ticked = selected.has(leader.membershipId);
              const body = (
                <>
                  {selecting && (
                    <span aria-hidden="true" className={cn('flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 text-sm',
                      ticked ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-signal-grey')}>
                      {ticked ? '✓' : ''}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-md font-bold uppercase text-ink">{leader.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted">
                      {leader.agentCode && <span>{leader.agentCode}</span>}
                      {group ? <Tag>{group.name}</Tag> : <Tag tone="amber">{t.noGroup}</Tag>}
                      {leader.isGroupLeader && <Tag tone="orange">★ {t.groupLeader}</Tag>}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={leader.membershipId} className="flex min-h-[60px] items-center gap-2.5 py-2">
                  {selecting ? (
                    <button type="button" role="checkbox" aria-checked={ticked} aria-label={t.selectWho({ name: leader.name })}
                      onClick={() => props.onToggle(leader.membershipId)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      {body}
                    </button>
                  ) : write ? (
                    <button type="button" aria-label={t.editWho({ name: leader.name })} onClick={() => props.onEdit(leader)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      {body}
                    </button>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">{body}</div>
                  )}
                  {!selecting && <CoreButton leader={leader} write={write} busy={props.busy} onCore={props.onCore} size="phone" />}
                </li>
              );
            })}
          </ul>
        )}
        <SeeAll props={props} />
      </div>
      {selecting && <SelectionBar props={props} floating />}
    </div>
  );
}

/**
 * **The desktop's list + detail** (from 1024px; the desktop mockup, its sidebar UI-196's): the tiles in a row, the
 * sticky 320px *Group* pane, and the leader table in its card — names on one line, the targets from 1400px.
 */
function DesktopView({ tiles, ...props }: ViewProps & { tiles: ReactNode }) {
  const t = useMessages(coreLeadersMessages);
  const { view, filter, selected, write, chosenGroup, busy } = props;
  const rows = rowsOf(props);
  const title = chosenGroup?.name
    ?? (filter === 'core' ? `★ ${t.coreLeader}` : filter === 'none' ? t.noGroup : filter === 'has' ? t.tiles.withGroup : t.allLeaders);
  const allTicked = rows.length > 0 && rows.every((l) => selected.has(l.membershipId));
  const showTargets = view.canEditTargets || view.leaders.some((l) => l.targets !== null);
  const item = (key: CoreLeadersFilter, name: string, sub: ReactNode, count: number) => (
    <button
      key={typeof key === 'string' ? key : key.groupId}
      type="button"
      aria-pressed={sameFilter(filter, key)}
      onClick={() => props.onPick(key)}
      className={cn('flex min-h-[52px] w-full items-center gap-2.5 rounded-row px-2.5 py-1.5 text-left hover:bg-hover-row',
        sameFilter(filter, key) && 'bg-primary/[0.12] hover:bg-primary/[0.12]')}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-md font-bold text-ink">{name}</span>
        {sub && <span className="block truncate text-sm text-muted">{sub}</span>}
      </span>
      <span className="text-base font-bold tabular-nums text-muted">{count}</span>
    </button>
  );
  return (
    <div className="flex flex-col gap-4">
      {tiles}
      <div className="grid grid-cols-[320px_minmax(0,1fr)] items-start gap-4">
        <nav aria-label={t.group} className="sticky top-4 rounded-lg bg-card">
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
            <h2 className="text-md font-bold text-ink">{t.group}</h2>
            <Tag>{t.groupCount({ n: view.groups.length })}</Tag>
          </div>
          <div className="flex flex-col px-2 pb-2">
            {item('all', t.allShort, null, view.counts.leaders)}
            {item('core', `★ ${t.coreLeader}`, null, view.counts.core)}
            <hr className="mx-2.5 my-1.5 border-divider" />
            {view.groups.map((g) => item(
              { groupId: g.groupId }, g.name,
              g.headName !== null ? <span className="uppercase">{t.headLine({ name: g.headName })}</span> : <span className="text-pill-amber-ink">{t.noHead}</span>,
              g.leaders,
            ))}
            <hr className="mx-2.5 my-1.5 border-divider" />
            {item('none', t.noGroup, null, view.counts.withoutGroup)}
          </div>
          {write && (
            <div className="px-4 pb-4 pt-2">
              <Button variant="secondary" className="w-full justify-center" onClick={() => props.onGroup(null)}>{t.newGroup}</Button>
            </div>
          )}
        </nav>
        <section aria-label={title} className="min-w-0 rounded-lg bg-card">
          {selected.size > 0 && <SelectionBar props={props} floating={false} />}
          <div className="flex flex-wrap items-center gap-3 border-b border-divider px-4 py-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-ink">{title}</h2>
                <Tag>{t.leaders({ n: props.shown.length })}</Tag>
              </div>
              {chosenGroup && (
                <p className="mt-0.5 text-sm text-muted">
                  {chosenGroup.headName !== null
                    ? <>★ {t.groupLeader}: <span className="uppercase">{chosenGroup.headName}</span></>
                    : <span className="text-pill-amber-ink">{t.noHead}</span>}
                </p>
              )}
            </div>
            <SearchField query={props.query} onQuery={props.onQuery} className="ml-auto w-full max-w-[320px] min-w-[200px] flex-1" />
            {chosenGroup && write && (
              <button type="button" className={HEADER_BUTTON} onClick={() => props.onGroup(chosenGroup)}>{t.manage}</button>
            )}
          </div>
          {props.shown.length === 0 ? (
            <p className="px-4 py-7 text-center text-md text-muted">{chosenGroup ? t.noLeadersInGroup : t.noLeadersHere}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="relative w-full border-collapse text-left">
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr className="border-b border-divider text-sm font-semibold text-muted">
                    <th scope="col" className="w-11 px-2 py-2.5">
                      {write ? (
                        <input type="checkbox" aria-label={t.selectAll} checked={allTicked}
                          onChange={() => props.onSelectAll(rows.map((l) => l.membershipId))} className="h-5 w-5" />
                      ) : <span className="sr-only">{t.selectAll}</span>}
                    </th>
                    <th scope="col" className="px-2 py-2.5">{t.name}</th>
                    <th scope="col" className="px-2 py-2.5">{t.group}</th>
                    <th scope="col" className="px-2 py-2.5">{t.groupLeader}</th>
                    <th scope="col" className="px-2 py-2.5">{t.core}</th>
                    {showTargets && <th scope="col" className="hidden px-2 py-2.5 text-center min-[1400px]:table-cell">{t.aaTarget}</th>}
                    {showTargets && <th scope="col" className="hidden px-2 py-2.5 text-center min-[1400px]:table-cell">{t.recTargetShort}</th>}
                    <th scope="col" className="w-8 px-2 py-2.5"><span className="sr-only">{t.save}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((leader) => {
                    const ticked = selected.has(leader.membershipId);
                    const group = view.groups.find((g) => g.groupId === leader.groupId);
                    return (
                      <tr key={leader.membershipId} className={cn('border-b border-divider hover:bg-hover-row', ticked && 'bg-primary/[0.08]')}>
                        <td className="px-2 py-2">
                          {write && (
                            <input type="checkbox" aria-label={t.selectWho({ name: leader.name })} checked={ticked}
                              onChange={() => props.onToggle(leader.membershipId)} className="h-5 w-5" />
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <span className="block whitespace-nowrap text-md font-bold uppercase text-ink">{leader.name}</span>
                          {leader.agentCode && <span className="block text-sm text-muted">{leader.agentCode}</span>}
                        </td>
                        <td className="px-2 py-2">
                          {write ? (
                            <PickerMenu
                              label={t.moveWho({ name: leader.name })}
                              value={leader.groupId ?? NO_GROUP}
                              disabled={busy}
                              className={cn('min-h-8 whitespace-nowrap', !group && 'border-transparent bg-pill-amber text-pill-amber-ink')}
                              options={[
                                ...view.groups.map((g) => ({ value: g.groupId, label: g.name })),
                                { value: NO_GROUP, label: t.noGroup },
                              ]}
                              onChange={(value) => props.onMove(leader, value === NO_GROUP ? null : value)}
                            />
                          ) : group ? <Tag>{group.name}</Tag> : <Tag tone="amber">{t.noGroup}</Tag>}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            aria-pressed={leader.isGroupLeader}
                            aria-label={`★ ${t.groupLeader} · ${leader.name}`}
                            disabled={!write || busy || !group}
                            onClick={() => props.onAppoint(leader)}
                            className={cn('inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-pill px-2.5 text-sm font-bold disabled:cursor-default',
                              leader.isGroupLeader ? 'bg-primary/[0.12] text-primary-ink' : 'bg-hover-row text-muted', !group && 'opacity-40')}
                          >
                            <StarIcon filled={leader.isGroupLeader} />
                            {leader.isGroupLeader ? t.groupLeader : t.appoint}
                          </button>
                        </td>
                        <td className="px-2 py-2">
                          <CoreButton leader={leader} write={write} busy={busy} onCore={props.onCore} size="desktop" />
                        </td>
                        {showTargets && <td className="hidden px-2 py-2 text-center font-bold tabular-nums min-[1400px]:table-cell">{leader.targets?.aa ?? '—'}</td>}
                        {showTargets && <td className="hidden px-2 py-2 text-center font-bold tabular-nums min-[1400px]:table-cell">{leader.targets?.rec ?? '—'}</td>}
                        <td className="px-2 py-2">
                          {write && (
                            <button type="button" aria-label={t.editWho({ name: leader.name })} onClick={() => props.onEdit(leader)}
                              className="flex h-8 w-8 items-center justify-center rounded-pill text-lg text-muted hover:bg-hover-row">
                              ›
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <SeeAll props={props} />
        </section>
      </div>
    </div>
  );
}
