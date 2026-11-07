'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LeadCard } from '@/components/lead-card';
import { LeadPane, LeadSheet } from '@/components/lead-sheet';
import { ClosedLeads, loadClosed, SORT_CHOICES, type List, type Sort } from '@/components/leads-table';
import { Dialog } from '@/components/ui/dialog';
import { DragHandle } from '@/components/ui/drag-handle';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { dayInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import {
  countByStage, countByType, listEveryLead, nameMatches, reorderLeads, setLeadOutcome, LEAD_ROWS_FIRST_SHOWN,
  type Lead, type LeadOutcome, type LeadType, type LeadTypeChip,
} from '@/lib/leads';
import { useCan, useSession } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';

/** The orders the filter sheet offers: the card layout's, but by type — the chips already split the types. */
const ORDERS = SORT_CHOICES.filter((choice) => choice.sort?.key !== 'type');

/**
 * **The list beside the pane, from 1024px** (P19.1-T2 AC-3; UI-116; `leads-tablet-desktop` frames 1 and 1b), in px: the
 * list 360 from 1024 to 1279 beside the 64px rail and 420 from 1280, a 16px gap, and the page's 20px gutter
 * (`app/(agent)/leads/page.tsx`). So the pane is 1024 − 64 − 2×20 − 360 − 16 = **544px** at 1024 and 1280 − 252 − 2×20 −
 * 420 − 16 = **552px** at 1280: never under the report's ~540. The classes below are these numbers in rem.
 */
export const SPLIT = { listLaptop: 360, listWide: 420, gap: 16, gutter: 20, paneMin: 540 } as const;

/** The pane's lead: one of the list's, a new one, or none. */
type Selection = { id: string } | 'new' | null;
const sameSelection = (a: Selection, b: Selection) =>
  (a === null || b === null || a === 'new' || b === 'new' ? a === b : a.id === b.id);

/**
 * **`/leads` on a phone and a tablet** (UI V1, UI-105; D-10, D-18, D-19): the compact list. **From 1024px the same list
 * beside the lead's pane** (`split`; P19.1-T2, UI-116), which replaced the table there.
 *
 * - **One row: a search pill, *Cari nama lead*, and a round filter button** — a sheet with the type, the status and the
 *   order, as chips (no native select); the accent's small mark on the button while a filter or an order is on.
 * - **The type chips, *Semua 67 · Sales 58 · Recruit 9***, each with its count. It opens on *Sales* where the reader has a
 *   Sales lead (the approved mockup's), else *Recruit*, else *Semua*.
 * - **The pipeline strip** (D-18): navy, a cell per stage of the chosen type with its count, from every open lead the
 *   reader holds (`listEveryLead`); a tap filters the list to that stage, a second tap clears it. *Semua* has no strip:
 *   the two ladders share no stage.
 * - **A compact card per lead**: the avatar, the NAME, the type and stage pills, one next-action line — red when it is
 *   late, *Hari ini* for today, ***Isi tindakan*** in red when there is none (UI-062) — and **only WhatsApp**
 *   (`LeadContactButtons`, UI-081). The whole card opens the lead sheet (`LeadSheet`); WhatsApp is its own target.
 *   **Two to a row on a tablet** (P19.1-T2 AC-2; UI-113, UI-116).
 * - **The accent's floating +** adds a lead, in the same sheet, above the tab bar.
 *
 * **From 1024px, list + detail, *like WhatsApp*** (P19.1-T2 AC-3, AC-4): the top block and the cards in a column of their
 * own (`SPLIT`), the cards scrolling inside it; beside it the lead open in `LeadPane`, the sheet's editor in a pane — the
 * first card's when the page opens, the one tapped after. The open card wears the accent's 2px outline. *+ Tambah lead*
 * is the title row's (`addRequest`), and opens a new lead in the pane. **Unsaved changes are never lost silently**: another
 * card, *+ Tambah lead* or Escape asks first, in the sheet's own words. **Kept from the table** it replaced, each where the
 * list already has a place: the order (the filter sheet), the search and the filters, the closed lists with *Move to
 * active*, delete with its question (the pane's *Hapus*), the outcomes (*Hasil*), who last changed a lead (the pane), and
 * **the reader's own order** — the drag handle on their own cards while the list is in that order (I-295).
 *
 * The search, the type and the stage narrow what the screen holds, so the counts are always the whole list's; the order
 * is the server's (`GET /leads?sort=`), the reader's saved order by default. Below the list, the closed leads as the
 * table has them, with *Move to active*.
 */
export function LeadsList({ split = false, addRequest = 0 }: {
  /** From 1024px: the list beside the lead's pane (UI-116). */
  split?: boolean;
  /** Counted up by `/leads`' title row from 1024px: each press of *+ Tambah lead* opens a new lead in the pane. */
  addRequest?: number;
} = {}) {
  const t = useMessages(leadsMessages);
  const { config } = useTenantConfig();
  const { me } = useSession();
  const myMembership = me?.membership?.membershipId;
  const canCreate = useCan('lead:create');
  const canReopen = useCan('lead:mark_outcome');
  const uid = useId();

  const [sort, setSort] = useState<Sort>(null);
  const [open, setOpen] = useState<List | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloads, setReloads] = useState(0);
  const [chosenChip, setChosenChip] = useState<LeadTypeChip | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  /**
   * ***Sudah ada proposal* / *Belum ada proposal*** (P19.7-T2 AC-12; Acc. 5): `hasProposal`, asked of the server — which
   * narrows to the reader's own leads first — and read again; `null` for neither. It sits with the type and the stage.
   */
  const [hasProposal, setHasProposal] = useState<boolean | null>(null);
  const [term, setTerm] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sheet, setSheet] = useState<{ lead: Lead | null } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [won, setWon] = useState<List | null>(null);
  const [lost, setLost] = useState<List | null>(null);
  const [closedError, setClosedError] = useState<Record<LeadOutcome, ApiError | null>>({ won: null, lost: null });
  const [reopenError, setReopenError] = useState<Record<string, ApiError>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const load = useRef(0);

  useEffect(() => {
    const generation = ++load.current;
    const isCurrent = () => load.current === generation;
    setLoadError(null);
    void listEveryLead(
      { outcome: 'open', sort: sort?.key, dir: sort?.dir, ...(hasProposal === null ? {} : { hasProposal }) },
      (rows, total, first) => {
        setOpen((current) => (first || !current
          ? { rows, total }
          : { ...current, rows: [...current.rows, ...rows.filter((r) => !current.rows.some((c) => c.id === r.id))] }));
      },
      isCurrent,
    ).catch((err) => { if (isCurrent()) setLoadError(toDisplayError(err)); });
    return () => { load.current += 1; };
  }, [sort?.key, sort?.dir, hasProposal, reloads]);

  /* The closed lists, as the table's: again after a reopen or an outcome, which move a lead between them. */
  useEffect(() => {
    let current = true;
    for (const [outcome, set] of [['won', setWon], ['lost', setLost]] as const) {
      loadClosed(outcome, set, () => current).catch((err) => {
        if (current) setClosedError((e) => ({ ...e, [outcome]: toDisplayError(err) }));
      });
    }
    return () => { current = false; };
  }, [reloads]);

  const pipelines = useMemo(() => config?.leadPipelines ?? [], [config]);
  const ladderFor = useCallback(
    (type: LeadType | null): LeadStatusRow[] => (type ? pipelines.find((p) => p.pipeline === type)?.statuses ?? [] : []),
    [pipelines],
  );
  const stageLabel = (row: Lead) => ladderFor(row.type).find((s) => s.code === row.statusCode)?.label ?? null;

  const held = open?.rows ?? [];
  const counts = countByType(held);
  /** Before the reader chooses: *Sales* where they have one, as the approved mockup opens, else *Recruit*, else all. */
  const chip: LeadTypeChip = chosenChip ?? (counts.sales > 0 ? 'sales' : counts.recruitment > 0 ? 'recruitment' : 'all');
  const ladder = chip === 'all' ? [] : ladderFor(chip).filter((s) => s.status === 'active');
  const stageCounts = chip === 'all' ? new Map<string, number>() : countByStage(held, chip, ladder);
  const shown = held.filter((lead) => (chip === 'all' || lead.type === chip)
    && (stage === null || lead.statusCode === stage)
    && (term.trim() === '' || nameMatches(lead.name, term)));
  const drawn = expanded ? shown : shown.slice(0, LEAD_ROWS_FIRST_SHOWN);
  const filterOn = stage !== null || sort !== null || hasProposal !== null;
  const today = dayInZone(OFFICE_TIME_ZONE, new Date());
  const typeName = (type: LeadTypeChip) => (type === 'all' ? t.list.all : t.types[type]);
  const orderWords = t.sort[ORDERS.find((o) => sameSort(o.sort, sort))?.words ?? 'saved'];

  const chooseChip = (next: LeadTypeChip) => {
    setChosenChip(next);
    setStage(null);
    setExpanded(false);
  };

  /** The lead as the server now has it, in its place in the list — or out of it, once it is closed or deleted. */
  const replace = (lead: Lead) => setOpen((current) => {
    if (!current) return current;
    const at = current.rows.findIndex((r) => r.id === lead.id);
    if (at === -1) return { rows: [lead, ...current.rows], total: current.total + 1 };
    return { ...current, rows: current.rows.map((r) => (r.id === lead.id ? lead : r)) };
  });
  const drop = (id: string) => setOpen((current) => current && {
    rows: current.rows.filter((r) => r.id !== id),
    total: Math.max(0, current.total - 1),
  });

  async function reopen(row: Lead) {
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      await setLeadOutcome(row.id, null, row.version);
      setReopenError((e) => Object.fromEntries(Object.entries(e).filter(([id]) => id !== row.id)));
      setReloads((n) => n + 1);
    } catch (err) {
      setReopenError((e) => ({ ...e, [row.id]: toDisplayError(err) }));
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  }

  /*
   * ------------------------------------------------ the pane's lead, from 1024px (P19.1-T2 AC-3, AC-4; UI-116)
   *
   * **The first card's when the page opens** (the mockup opens on it), then the one the reader chose. **Nothing is lost
   * silently**: while the pane holds unsaved changes, another card, *+ Tambah lead* and Escape ask first, in the sheet's
   * own question; *Tutup tanpa menyimpan* goes on, the other button stays.
   */
  const [selection, setSelection] = useState<Selection>(null);
  const [asking, setAsking] = useState<{ next: Selection } | null>(null);
  const picked = useRef(false);
  const paneDirty = useRef(false);
  const onPaneDirty = useCallback((dirty: boolean) => { paneDirty.current = dirty; }, []);
  const firstId = drawn[0]?.id;
  useEffect(() => {
    if (!split || picked.current || !firstId) return;
    picked.current = true;
    setSelection({ id: firstId });
  }, [split, firstId]);

  const choose = (next: Selection) => {
    picked.current = true;
    if (sameSelection(next, selection)) return;
    if (paneDirty.current) setAsking({ next });
    else setSelection(next);
  };
  const chooseLatest = useRef(choose);
  chooseLatest.current = choose;
  const selectionLatest = useRef(selection);
  selectionLatest.current = selection;

  useEffect(() => {
    if (split && addRequest > 0) chooseLatest.current('new');
  }, [split, addRequest]);

  /*
   * **Escape closes the pane** — as it closes a chat in WhatsApp — asking first over unsaved changes. Not while a dialog
   * or a sheet has it (each closes itself), and not in the search box, whose Escape empties it.
   */
  useEffect(() => {
    if (!split) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || selectionLatest.current === null) return;
      const from = e.target instanceof Element ? e.target : null;
      if (from?.closest('[role="dialog"], [role="search"]') || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      chooseLatest.current(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [split]);

  const paneLead = selection && selection !== 'new' ? held.find((r) => r.id === selection.id) ?? null : null;
  /** A lead chosen that the list no longer holds — closed or deleted elsewhere — is no lead: the pane says to choose. */
  const paneOpen = selection === 'new' || paneLead !== null;

  /*
   * ---------------------------------------------- the reader's own order, from 1024px (I-295; ADR-0161 §1)
   *
   * **The table's, kept** (the client's request of 2026-10-26: *rows can be dragged, the order is stored, a sort is
   * not*). The handle `⠿` before the avatar of each of the reader's own cards — dragged and dropped on a card, or
   * focused and moved with ↑ and ↓ — while the list is in their saved order: no order chosen, no search, no stage. The
   * type chip stays a list's ground state, as the strip is: a lead takes the place of the one it is dropped on in the
   * whole list, so the other type's leads keep theirs. Shown at once, saved as the whole order behind it
   * (`PATCH /leads/order`), put back with the server's reason above the cards if it is refused. **A leader sends their own
   * leads only**; an agent's card on their list has no handle. Held still until every page has arrived.
   */
  const ordering = split && sort === null && term.trim() === '' && stage === null;
  const complete = open !== null && open.rows.length >= open.total;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<ApiError | null>(null);
  const orderQueue = useRef<Promise<void>>(Promise.resolve());
  const orderSaves = useRef(0);
  const moved = useRef<string | null>(null);
  const handleId = (id: string) => `${uid}-handle-${id}`;

  function place(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const before = held.map((r) => r.id);
    const next = [...held];
    next.splice(to, 0, ...next.splice(from, 1));
    setOpen((current) => current && { ...current, rows: next });
    const ids = next.filter((r) => r.ownerMembershipId === myMembership).map((r) => r.id);
    const save = ++orderSaves.current;
    orderQueue.current = orderQueue.current.then(async () => {
      try {
        await reorderLeads(ids);
        if (save === orderSaves.current) setOrderError(null);
      } catch (err) {
        if (save !== orderSaves.current) return;
        setOrderError(toDisplayError(err));
        setOpen((current) => current && { ...current, rows: before.map((id) => current.rows.find((r) => r.id === id)).filter((r): r is Lead => r !== undefined) });
        setReloads((n) => n + 1);
      }
    });
  }

  /** ↑ or ↓ on a handle: past the next of the reader's own cards drawn that way. */
  function moveBy(id: string, by: -1 | 1) {
    let at = drawn.findIndex((r) => r.id === id);
    if (at < 0) return;
    do at += by; while (at >= 0 && at < drawn.length && drawn[at].ownerMembershipId !== myMembership);
    if (at < 0 || at >= drawn.length) return;
    moved.current = id;
    place(held.findIndex((r) => r.id === id), held.findIndex((r) => r.id === drawn[at].id));
  }

  useEffect(() => {
    const id = moved.current;
    if (!id) return;
    moved.current = null;
    // A card moved is taken out and put back by React, and the focus would fall to the page.
    const handle = document.getElementById(handleId(id));
    if (handle && document.activeElement !== handle) handle.focus();
    // `handleId` is fixed for the life of the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const orderOf = (lead: Lead) => (ordering && lead.ownerMembershipId === myMembership ? {
    handle: (
      <DragHandle
        id={handleId(lead.id)}
        label={lead.name}
        disabled={!complete}
        className="relative z-[1] -mx-1.5 flex h-8 w-8 shrink-0 cursor-grab select-none items-center justify-center text-md leading-none text-muted disabled:cursor-not-allowed"
        onPick={() => setDragging(lead.id)}
        onDrop={() => { setDragging(null); setOver(null); }}
        onMove={(by) => moveBy(lead.id, by)}
      />
    ),
    over: over === lead.id && dragging !== lead.id,
    lifted: dragging === lead.id,
    target: {
      onDragOver: (e: React.DragEvent) => {
        if (!dragging) return;
        e.preventDefault();
        setOver(lead.id);
      },
      onDragLeave: () => setOver((now) => (now === lead.id ? null : now)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const lifted = dragging;
        setDragging(null);
        setOver(null);
        if (lifted && lifted !== lead.id) place(held.findIndex((r) => r.id === lifted), held.findIndex((r) => r.id === lead.id));
      },
    },
  } : undefined);

  const search = (
    <div role="search" className="flex gap-2" aria-label={t.searchAndFilter}>
      <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-pill bg-card px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-focus-ring">
        <LineIcon name="search" className="h-[18px] w-[18px] shrink-0" />
        <span className="sr-only">{t.list.search}</span>
        <input
          type="search"
          value={term}
          placeholder={t.list.search}
          onChange={(e) => { setTerm(e.target.value); setExpanded(false); }}
          className="min-w-0 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-signal-grey"
        />
      </label>
      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        aria-label={filterOn ? t.list.filterOn : t.list.filter}
        aria-haspopup="dialog"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-navy hover:bg-hover-row"
      >
        <LineIcon name="adjust" className="h-5 w-5" />
        {filterOn && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
      </button>
    </div>
  );

  const chips = (
    <div role="group" aria-label={t.list.chips} className="my-2.5 flex gap-1.5">
      {(['all', 'sales', 'recruitment'] as const).map((type) => (
        <button
          key={type}
          type="button"
          aria-pressed={chip === type}
          aria-label={t.list.chipSaid({ label: typeName(type), n: counts[type] })}
          onClick={() => chooseChip(type)}
          className={cn(
            // Already a header control — 13px / 600 / 44px (P19.8-T1 AC-1; R6, MOB UI-171: *Semua · Sales · Recruit*, ok) —
            // and written as it was, so the phone's list is drawn to the byte as before (`HEADER_CONTROL`'s three in it).
            'flex min-h-11 items-center gap-1.5 rounded-pill px-3.5 text-base font-semibold',
            chip === type ? 'bg-secondary text-secondary-contrast' : 'bg-card text-navy hover:bg-hover-row',
          )}
        >
          {typeName(type)}
          <span className={cn('text-xs font-semibold', chip === type ? 'text-secondary-muted' : 'text-muted')}>
            {open ? counts[type] : ''}
          </span>
        </button>
      ))}
    </div>
  );

  const strip = chip !== 'all' && ladder.length > 0 && (
    <div
      role="group"
      aria-label={t.list.pipeline({ type: typeName(chip) })}
      data-pipeline-strip=""
      className="grid auto-cols-[minmax(4rem,1fr)] grid-flow-col overflow-x-auto rounded-lg bg-secondary px-1.5 py-2.5 text-secondary-contrast"
    >
      {ladder.map((row) => {
        const short = t.stageShort[row.code] ?? row.label;
        const n = stageCounts.get(row.code) ?? 0;
        return (
          <button
            key={row.code}
            type="button"
            aria-pressed={stage === row.code}
            aria-label={t.list.stageSaid({ stage: short === row.label ? row.label : `${short} (${row.label})`, n })}
            title={row.label}
            onClick={() => { setStage((was) => (was === row.code ? null : row.code)); setExpanded(false); }}
            className={cn(
              'flex min-h-11 flex-col items-center justify-center rounded-[10px] px-0.5 py-0.5 text-center',
              stage === row.code ? 'bg-secondary-contrast/[0.12]' : 'hover:bg-secondary-contrast/[0.06]',
            )}
          >
            <span className="text-[1.25rem] font-bold leading-tight tabular-nums">{open ? n : '–'}</span>
            {/* The stage's words at a header control's 13px / 600 (P19.8-T1 AC-1; MOB UI-171: they were weight 400). */}
            <span data-stage-name="" className="line-clamp-2 text-base font-semibold leading-tight text-secondary-muted">{short}</span>
          </button>
        );
      })}
    </div>
  );

  const meta = open && (
    <p className="mx-0.5 mb-2 mt-3 flex justify-between gap-3 text-xs text-muted">
      <span>{t.list.meta({ n: shown.length, what: chip === 'all' ? t.list.allLeads : typeName(chip) })}</span>
      <span>{orderWords}</span>
    </p>
  );

  const cards = open && (shown.length === 0 ? (
    <div className="rounded-lg bg-card">
      <EmptyState
        title={held.length === 0 ? t.noneYet : t.noneMatch}
        boost={held.length === 0 ? 'thinking' : undefined}
        variant={held.length === 0 ? 'empty' : 'filtered'}
      />
    </div>
  ) : (
    // Two to a row on a tablet (P19.1-T2 AC-2; UI-113: *Leads: 2 cards per row*); one column on a phone and in the pane's list.
    <ul role="list" aria-label={t.yourLeads} className="flex flex-col gap-1.5 md:max-lg:grid md:max-lg:grid-cols-2 md:max-lg:gap-2">
      {drawn.map((lead) => (
        <LeadCard
          key={lead.id}
          lead={lead}
          ladder={ladderFor(lead.type)}
          today={today}
          onOpen={() => (split ? choose({ id: lead.id }) : setSheet({ lead }))}
          onSaved={replace}
          {...(split ? {
            inPane: true,
            selected: selection !== null && selection !== 'new' && selection.id === lead.id,
            order: orderOf(lead),
          } : {})}
        />
      ))}
    </ul>
  ));

  const more = open && shown.length > drawn.length && (
    <button
      type="button"
      onClick={() => setExpanded(true)}
      className="mt-3 min-h-11 w-full rounded-pill bg-card text-md font-semibold text-navy hover:bg-hover-row"
    >
      {t.showMore}
    </button>
  );

  const closed = (
    <ClosedLeads
      won={{ list: won, error: closedError.won }}
      lost={{ list: lost, error: closedError.lost }}
      busy={busy}
      refusalsOf={(id) => (reopenError[id] ? [reopenError[id]] : [])}
      stageLabel={stageLabel}
      onReopen={canReopen ? (row) => void reopen(row) : undefined}
      stacked={split}
    />
  );

  const filters = (
    <FilterSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      chip={chip}
      onChip={chooseChip}
      typeName={typeName}
      ladder={ladder}
      stage={stage}
      onStage={setStage}
      hasProposal={hasProposal}
      onHasProposal={(next) => { setHasProposal(next); setExpanded(false); }}
      sort={sort}
      onSort={setSort}
    />
  );

  if (split) {
    return (
      <div
        data-leads-list=""
        data-leads-split=""
        className={cn(
          'grid h-[calc(100dvh-7.5rem)] min-h-[28rem] gap-4 -mb-8',
          'grid-cols-[22.5rem_minmax(0,1fr)] xl:grid-cols-[26.25rem_minmax(0,1fr)]',
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col" data-leads-column="">
          {search}
          {chips}
          {strip}
          {meta}
          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4" data-leads-scroll="">
            {orderError && <div className="mb-2"><ErrorBanner {...orderError} /></div>}
            {loadError && <ErrorBanner {...loadError} />}
            {!open && !loadError && <SkeletonCards count={4} label={t.loadingList({ caption: t.yourLeads })} />}
            {cards}
            {more}
            {closed}
          </div>
        </div>
        <div className="min-h-0 min-w-0">
          {paneOpen ? (
            <LeadPane
              lead={paneLead}
              onClose={() => { paneDirty.current = false; setSelection(null); }}
              onSaved={(lead) => {
                replace(lead);
                if (selectionLatest.current === 'new') setSelection({ id: lead.id });
              }}
              onDeleted={drop}
              onClosedLead={(lead) => {
                drop(lead.id);
                setReloads((n) => n + 1);
              }}
              onDirtyChange={onPaneDirty}
            />
          ) : open && held.length > 0 ? (
            <div className="flex h-full items-center justify-center rounded-lg bg-card px-6 text-center text-md text-muted" data-lead-pane-empty="">
              {t.list.choose}
            </div>
          ) : null}
        </div>
        {filters}
        <Dialog
          open={asking !== null}
          message={t.sheet.discard}
          confirmLabel={t.sheet.discardConfirm}
          tone="danger"
          onCancel={() => setAsking(null)}
          onConfirm={() => {
            const next = asking?.next ?? null;
            setAsking(null);
            paneDirty.current = false;
            setSelection(next);
          }}
        />
      </div>
    );
  }

  return (
    <div data-leads-list="" className="pb-20">
      {search}

      {chips}

      {strip}

      {meta}

      {loadError && <ErrorBanner {...loadError} />}
      {!open && !loadError && <SkeletonCards count={4} label={t.loadingList({ caption: t.yourLeads })} />}

      {cards}

      {more}

      {closed}

      {canCreate && (
        <button
          type="button"
          onClick={() => setSheet({ lead: null })}
          aria-label={t.list.add}
          className={cn(
            'fixed bottom-[calc(var(--tab-bar-space)+1rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full',
            'bg-primary text-primary-contrast shadow-modal hover:bg-primary-hover lg:hidden',
          )}
        >
          <LineIcon name="plus" className="h-7 w-7" />
        </button>
      )}

      {filters}

      <LeadSheet
        open={sheet !== null}
        lead={sheet?.lead ?? null}
        onClose={() => setSheet(null)}
        onSaved={replace}
        onDeleted={drop}
        onClosedLead={(lead) => {
          drop(lead.id);
          setReloads((n) => n + 1);
        }}
      />
    </div>
  );
}

const sameSort = (a: Sort, b: Sort) => (a === null || b === null ? a === b : a.key === b.key && a.dir === b.dir);

/**
 * The filter button's sheet (UI-105): the type, the status and the order, as chips — no native select. **And the
 * proposal** (P19.7-T2 AC-12): *Sudah ada proposal* and *Belum ada proposal*, a second tap clearing it, after the status.
 */
function FilterSheet({
  open, onClose, chip, onChip, typeName, ladder, stage, onStage, hasProposal, onHasProposal, sort, onSort,
}: {
  open: boolean;
  onClose: () => void;
  chip: LeadTypeChip;
  onChip: (chip: LeadTypeChip) => void;
  typeName: (chip: LeadTypeChip) => string;
  ladder: LeadStatusRow[];
  stage: string | null;
  onStage: (stage: string | null) => void;
  hasProposal: boolean | null;
  onHasProposal: (hasProposal: boolean | null) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
}) {
  const t = useMessages(leadsMessages);
  const CHIP = 'flex min-h-11 items-center rounded-pill px-3.5 text-base font-semibold';
  const look = (on: boolean) => (on ? 'bg-secondary text-secondary-contrast' : 'bg-hover-row text-navy hover:bg-divider');
  const group = (label: string, children: React.ReactNode) => (
    <div role="group" aria-label={label} className="mb-4">
      <p aria-hidden="true" className="mb-1.5 text-xs font-bold text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );

  return (
    <ResponsiveSheet
      open={open}
      title={t.list.filters.title}
      onClose={onClose}
      footer={(
        <div className="flex gap-2.5 pb-1">
          <button
            type="button"
            onClick={() => { onStage(null); onSort(null); onHasProposal(null); }}
            className="min-h-12 rounded-pill border-[1.5px] border-line bg-card px-5 text-md font-bold text-navy hover:bg-hover-row"
          >
            {t.list.filters.clear}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-pill bg-secondary px-5 text-md font-bold text-secondary-contrast hover:bg-secondary-hover"
          >
            {t.list.filters.done}
          </button>
        </div>
      )}
    >
      {group(t.list.filters.type, (['all', 'sales', 'recruitment'] as const).map((type) => (
        <button key={type} type="button" aria-pressed={chip === type} onClick={() => onChip(type)} className={cn(CHIP, look(chip === type))}>
          {typeName(type)}
        </button>
      )))}
      {chip !== 'all' && ladder.length > 0 && group(t.list.filters.status, [
        <button key="" type="button" aria-pressed={stage === null} onClick={() => onStage(null)} className={cn(CHIP, look(stage === null))}>
          {t.list.filters.allStatuses}
        </button>,
        ...ladder.map((row) => (
          <button
            key={row.code}
            type="button"
            aria-pressed={stage === row.code}
            onClick={() => onStage(row.code)}
            className={cn(CHIP, look(stage === row.code))}
          >
            {row.label}
          </button>
        )),
      ])}
      {group(t.list.filters.proposal, ([[true, t.list.filters.withProposal], [false, t.list.filters.withoutProposal]] as const).map(([value, label]) => (
        <button
          key={String(value)}
          type="button"
          aria-pressed={hasProposal === value}
          onClick={() => onHasProposal(hasProposal === value ? null : value)}
          className={cn(CHIP, look(hasProposal === value))}
        >
          {label}
        </button>
      )))}
      {group(t.list.filters.sort, ORDERS.map((choice) => (
        <button
          key={choice.words}
          type="button"
          aria-pressed={sameSort(choice.sort, sort)}
          onClick={() => onSort(choice.sort)}
          className={cn(CHIP, look(sameSort(choice.sort, sort)))}
        >
          {t.sort[choice.words]}
        </button>
      )))}
    </ResponsiveSheet>
  );
}
