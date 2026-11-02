'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LeadCard } from '@/components/lead-card';
import { LeadSheet } from '@/components/lead-sheet';
import { ClosedLeads, loadClosed, SORT_CHOICES, type List, type Sort } from '@/components/leads-table';
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
  countByStage, countByType, listEveryLead, nameMatches, setLeadOutcome, LEAD_ROWS_FIRST_SHOWN,
  type Lead, type LeadOutcome, type LeadType, type LeadTypeChip,
} from '@/lib/leads';
import { useCan } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';

/** The orders the filter sheet offers: the card layout's, but by type — the chips already split the types. */
const ORDERS = SORT_CHOICES.filter((choice) => choice.sort?.key !== 'type');

/**
 * **`/leads` on a phone and a tablet** (UI V1, UI-105; D-10, D-18, D-19): the compact list. A desktop keeps the table
 * (`LeadsTable`) until it is reviewed.
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
 * - **The accent's floating +** adds a lead, in the same sheet, above the tab bar.
 *
 * The search, the type and the stage narrow what the screen holds, so the counts are always the whole list's; the order
 * is the server's (`GET /leads?sort=`), the reader's saved order by default. Below the list, the closed leads as the
 * table has them, with *Move to active*.
 */
export function LeadsList() {
  const t = useMessages(leadsMessages);
  const { config } = useTenantConfig();
  const canCreate = useCan('lead:create');
  const canReopen = useCan('lead:mark_outcome');

  const [sort, setSort] = useState<Sort>(null);
  const [open, setOpen] = useState<List | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [reloads, setReloads] = useState(0);
  const [chosenChip, setChosenChip] = useState<LeadTypeChip | null>(null);
  const [stage, setStage] = useState<string | null>(null);
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
      { outcome: 'open', sort: sort?.key, dir: sort?.dir },
      (rows, total, first) => {
        setOpen((current) => (first || !current
          ? { rows, total }
          : { ...current, rows: [...current.rows, ...rows.filter((r) => !current.rows.some((c) => c.id === r.id))] }));
      },
      isCurrent,
    ).catch((err) => { if (isCurrent()) setLoadError(toDisplayError(err)); });
    return () => { load.current += 1; };
  }, [sort?.key, sort?.dir, reloads]);

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
  const filterOn = stage !== null || sort !== null;
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

  return (
    <div data-leads-list="" className="pb-20">
      <div role="search" className="flex gap-2" aria-label={t.searchAndFilter}>
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-pill bg-card px-3.5 text-muted focus-within:outline focus-within:outline-2 focus-within:outline-amber">
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
          {filterOn && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber" />}
        </button>
      </div>

      <div role="group" aria-label={t.list.chips} className="my-2.5 flex gap-1.5">
        {(['all', 'sales', 'recruitment'] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={chip === type}
            aria-label={t.list.chipSaid({ label: typeName(type), n: counts[type] })}
            onClick={() => chooseChip(type)}
            className={cn(
              'flex min-h-11 items-center gap-1.5 rounded-pill px-3.5 text-base font-semibold',
              chip === type ? 'bg-navy text-white' : 'bg-card text-navy hover:bg-hover-row',
            )}
          >
            {typeName(type)}
            <span className={cn('text-xs font-semibold', chip === type ? 'text-on-navy-muted' : 'text-muted')}>
              {open ? counts[type] : ''}
            </span>
          </button>
        ))}
      </div>

      {chip !== 'all' && ladder.length > 0 && (
        <div
          role="group"
          aria-label={t.list.pipeline({ type: typeName(chip) })}
          data-pipeline-strip=""
          className="grid auto-cols-[minmax(4rem,1fr)] grid-flow-col overflow-x-auto rounded-lg bg-navy px-1.5 py-2.5 text-white"
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
                  stage === row.code ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]',
                )}
              >
                <span className="text-[1.25rem] font-bold leading-tight tabular-nums">{open ? n : '–'}</span>
                <span className="line-clamp-2 text-xs leading-tight text-on-navy-muted">{short}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <p className="mx-0.5 mb-2 mt-3 flex justify-between gap-3 text-xs text-muted">
          <span>{t.list.meta({ n: shown.length, what: chip === 'all' ? t.list.allLeads : typeName(chip) })}</span>
          <span>{orderWords}</span>
        </p>
      )}

      {loadError && <ErrorBanner {...loadError} />}
      {!open && !loadError && <SkeletonCards count={4} label={t.loadingList({ caption: t.yourLeads })} />}

      {open && (shown.length === 0 ? (
        <div className="rounded-lg bg-card">
          <EmptyState
            title={held.length === 0 ? t.noneYet : t.noneMatch}
            boost={held.length === 0 ? 'thinking' : undefined}
            variant={held.length === 0 ? 'empty' : 'filtered'}
          />
        </div>
      ) : (
        <ul role="list" aria-label={t.yourLeads} className="flex flex-col gap-1.5">
          {drawn.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              ladder={ladderFor(lead.type)}
              today={today}
              onOpen={() => setSheet({ lead })}
              onSaved={replace}
            />
          ))}
        </ul>
      ))}

      {open && shown.length > drawn.length && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 min-h-11 w-full rounded-pill bg-card text-md font-semibold text-navy hover:bg-hover-row"
        >
          {t.showMore}
        </button>
      )}

      <ClosedLeads
        won={{ list: won, error: closedError.won }}
        lost={{ list: lost, error: closedError.lost }}
        busy={busy}
        refusalsOf={(id) => (reopenError[id] ? [reopenError[id]] : [])}
        stageLabel={stageLabel}
        onReopen={canReopen ? (row) => void reopen(row) : undefined}
      />

      {canCreate && (
        <button
          type="button"
          onClick={() => setSheet({ lead: null })}
          aria-label={t.list.add}
          className={cn(
            'fixed bottom-[calc(var(--tab-bar-space)+1rem)] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full',
            'bg-amber text-navy shadow-modal hover:bg-amber-dark lg:hidden',
          )}
        >
          <LineIcon name="plus" className="h-7 w-7" />
        </button>
      )}

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        chip={chip}
        onChip={chooseChip}
        typeName={typeName}
        ladder={ladder}
        stage={stage}
        onStage={setStage}
        sort={sort}
        onSort={setSort}
      />

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

/** The filter button's sheet (UI-105): the type, the status and the order, as chips — no native select. */
function FilterSheet({
  open, onClose, chip, onChip, typeName, ladder, stage, onStage, sort, onSort,
}: {
  open: boolean;
  onClose: () => void;
  chip: LeadTypeChip;
  onChip: (chip: LeadTypeChip) => void;
  typeName: (chip: LeadTypeChip) => string;
  ladder: LeadStatusRow[];
  stage: string | null;
  onStage: (stage: string | null) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
}) {
  const t = useMessages(leadsMessages);
  const CHIP = 'flex min-h-11 items-center rounded-pill px-3.5 text-base font-semibold';
  const look = (on: boolean) => (on ? 'bg-navy text-white' : 'bg-hover-row text-navy hover:bg-divider');
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
            onClick={() => { onStage(null); onSort(null); }}
            className="min-h-12 rounded-pill border-[1.5px] border-line bg-card px-5 text-md font-bold text-navy hover:bg-hover-row"
          >
            {t.list.filters.clear}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-pill bg-navy px-5 text-md font-bold text-white hover:bg-navy-soft"
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
