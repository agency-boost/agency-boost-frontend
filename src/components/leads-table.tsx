'use client';

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LeadDetailsDialog, type DetailsField } from '@/components/lead-details-dialog';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { DragHandle } from '@/components/ui/drag-handle';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Select, TextInput } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { Skeleton, SkeletonCards, SkeletonTable, SkeletonText } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  createLead, deleteLead, listEveryLead, readLead, reorderLeads, setLeadOutcome, setLeadStatus, updateLead,
  whatsAppLink, LEAD_NAME_MIN, LEAD_ROWS_FIRST_SHOWN, type Lead, type LeadOutcome, type LeadQuery, type LeadType,
} from '@/lib/leads';
import { useSession } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useDebounced } from '@/lib/use-debounced';

/**
 * The order the table can be in, as `GET /leads` names it: the three headings that sort
 * (`Overall.html:2805-2813`), and registration, which the closed cards are asked for in.
 */
type SortKey = Extract<NonNullable<LeadQuery['sort']>, 'name' | 'type' | 'status' | 'dateRegistered'>;

/**
 * A column sort, **or `null`: the owner's own order** (P18.8-T7, ADR-0161 §1), which the table opens on.
 *
 * `null` asks `GET /leads` for no sort, and the server answers in the order the owner dragged their
 * leads into, a new one on top. It was the newest registration until then, which is where the prototype
 * opens (`Overall.html:5432`) and the order migration 0031 filled every list in, so nobody's list moved.
 * **A heading's third press comes back here**, and the card layout's sort offers it by name — and a sort
 * is for the visit: it is component state, so leaving the screen and coming back shows the saved order.
 */
type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null;

/**
 * The narrowest the table is drawn, in rem: below it, each lead is a card (P13.1-T4 AC-7, ADR-0108 §6).
 *
 * The six fixed columns (`WIDTHS`, 42.5rem) and the two that share what is left, at no less than
 * 7.75rem each — the date box with its icon, and a remark of two or three words a line; 43.25rem and
 * 7.375rem on `/leads`, whose first column holds a drag handle (P18.8-T7). **Measured
 * against the table's own box, not the window**, so the sidebar counts: at 1280px with the sidebar
 * open the box is 59rem and the table stands; at 1024px it is 43rem, or 55.5rem with the sidebar
 * folded, and the leads are cards. In rem, so a reader who has turned their browser's text up gets the
 * cards sooner rather than a table crushed under larger letters.
 */
const TABLE_MIN_REM = 58;

/**
 * Eight widths and a fixed layout (`Overall.html:412`, `:426-435`). Without them a long remark
 * widens its own column and every other cell moves. *Remarks* and *Next action* take what the other
 * six leave, so the table fills its box at every width it is drawn at and never asks for more — the
 * horizontal scroll the client asked to be rid of (2026-10-07).
 */
// *Widened 2026-10-07, after the walk:* at 9rem and 7rem a name such as *Ibu Wiwik Setyaningsih* and the
// word *Recruitment* were cut off, and the *Actions* heading overflowed its 3rem by 8px — a sideways scroll
// of its own. 11rem holds a three-word name, 7.5rem *Select type* with its chevron, 4.5rem the heading —
// and, since P18.8-T7, the WhatsApp link and the ⋮ side by side, 28px each.
const WIDTHS = ['2rem', '11rem', '7.5rem', '11rem', '6.5rem', 'auto', 'auto', '4.5rem'] as const;

/**
 * **The same, with room for a drag handle beside the row's number** (P18.8-T7): `/leads`, where the reader
 * orders their own list. 0.75rem more, taken from the two columns that share what is left — at
 * `TABLE_MIN_REM` they still have 7.375rem each. Kept while a column sort hides the handles, so pressing a
 * heading does not move every column.
 */
const WIDTHS_WITH_HANDLES = ['2.75rem', ...WIDTHS.slice(1)] as const;

/** The card layout's sort: each order the headings give, said in words, since a card has no heading. */
const SORT_CHOICES: readonly { sort: Sort; label: string }[] = [
  { sort: null, label: 'Saved order' },
  { sort: { key: 'name', dir: 'asc' }, label: 'Lead name, A–Z' },
  { sort: { key: 'name', dir: 'desc' }, label: 'Lead name, Z–A' },
  { sort: { key: 'type', dir: 'asc' }, label: 'Type, ascending' },
  { sort: { key: 'type', dir: 'desc' }, label: 'Type, descending' },
  { sort: { key: 'status', dir: 'asc' }, label: 'Status, ascending' },
  { sort: { key: 'status', dir: 'desc' }, label: 'Status, descending' },
];
const sortValue = (sort: Sort) => (sort ? `${sort.key}:${sort.dir}` : 'saved');

/** The table heading's look, on the card's two labels (`Overall.html:413-418`). */
const CARD_LABEL = 'text-2xs font-semibold uppercase tracking-[0.03em] text-muted';

/**
 * The date box's own calendar button is hidden, so the one on its left is the only one (P13.1-T4
 * AC-5). WebKit and Blink draw theirs on the right; Firefox's cannot be styled and stays.
 */
const NO_NATIVE_PICKER = '[&::-webkit-calendar-picker-indicator]:hidden';

interface List {
  rows: Lead[];
  /** The server's count from the first page — right before the last page has arrived. */
  total: number;
}

/** The row `+ Add lead` puts at the top, before it is a lead (`Overall.html:5689-5692`). */
interface Draft {
  key: string;
  name: string;
  posting: boolean;
}

/**
 * Refusals by lead, then by the field each one concerns — `''` for a write that has no field of its
 * own to hold (a stage, a type, the month's promise, closing, deleting).
 */
type Refusals = Record<string, Record<string, ApiError>>;

/**
 * What the inline row says about a name too short to post. The server's own rule
 * (`name must be 2–120 characters`) in the reader's words, for the one bound a draft can miss; the
 * code is the one the server would have answered with, had it been asked.
 */
const SHORT_NAME: ApiError = {
  code: 'VALIDATION_FAILED',
  message: `A lead’s name must be at least ${LEAD_NAME_MIN} characters.`,
  requestId: 'unknown',
};

/**
 * The coaching card's own words for a name not given at all (`Overall.html:10894`), said where the
 * name is rather than in a toast: a refusal the reader has to act on stays beside what caused it
 * (`components-and-patterns.md`, *Toast*).
 */
const NO_NAME: ApiError = {
  code: 'VALIDATION_FAILED',
  message: 'Enter a name first.',
  requestId: 'unknown',
};

/** The coaching card's words for the two outcomes (`Overall.html:10867-10881`). */
const OUTCOME_WORD: Record<LeadOutcome, string> = { won: 'Won', lost: 'Lost' };
/** *Recruit*, not *Recruitment*, wherever a lead's type is named (ADR-0161 §2). The stored value stays `recruitment`. */
const TYPE_WORD: Record<LeadType, string> = { sales: 'Sales', recruitment: 'Recruit' };

/** A control on the inline row with nothing to write to yet: there, and plainly not live. */
const INERT_CONTROL = 'cursor-not-allowed opacity-40';

/** Every field a lead starts with, so the inline row renders through the same cells as a real one. */
const blankLead = (id: string, name: string): Lead => ({
  id, name, ownerMembershipId: '', type: null, contact: { phone: null, email: null },
  statusCode: null, thisMonth: false, committedMonths: [],
  lastEditedBy: null, remarks: null, nextActionDate: null, nextActionNote: null, outcome: null,
  source: null, dateRegistered: null, version: 0, flags: [], overdueDays: null,
});

const without = <T,>(record: Record<string, T>, ...keys: readonly string[]): Record<string, T> => {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
};

/**
 * `rows` in the order `ids` gives — how a refused drag is put back. A row `ids` does not hold (a lead added
 * since) stays on top, where a new lead goes.
 */
const arranged = (rows: readonly Lead[], ids: readonly string[]): Lead[] => {
  const at = new Map(ids.map((id, i) => [id, i]));
  return [...rows].sort((a, b) => (at.get(a.id) ?? -1) - (at.get(b.id) ?? -1));
};

/** Newest first — how the closed cards are asked for, and where a lead closed here is put. */
const byRegisteredDesc = (a: Lead, b: Lead) =>
  (b.dateRegistered ?? '').localeCompare(a.dateRegistered ?? '');

/**
 * The leads table — `/leads`, and the coaching session's *Leads* card (P10.1-T4, P11-T8).
 *
 * **The prototype's table, as the client revised it on 2026-10-07** (`Overall.html:2787-2846`,
 * ADR-0108). No counts strip, no filter card and nothing under a lead's name (ADR-0062). What used to
 * be four glyphs and a *Registered* column is one ⋮ per lead, opening a menu: *Lead details*, the two
 * outcomes, and *Delete*. The details — phone, email, where they came from, when the lead was
 * registered and who last changed it (ADR-0044) — are a dialog. **WhatsApp sits beside the ⋮** since
 * 2026-10-26 (ADR-0161 §2), on any lead whose phone number WhatsApp could open.
 *
 * **The reader's own order, kept** (P18.8-T7, ADR-0161 §1). On `/leads` each of the reader's own open
 * leads has a drag handle beside its number — dragged, or moved with ↑ and ↓ — while no column sort is
 * on; a drop saves the whole order at once and the screen shows it at once, putting it back with the
 * server's reason if the save is refused. A column sort is a look, never saved. A coaching session's card
 * shows the coachee's order and has no handles: the order is its owner's.
 *
 * **A table where it fits, and a card per lead where it does not** (P13.1-T4 AC-7). The page body
 * never scrolls sideways, and nor does the table any more: below `TABLE_MIN_REM` of its own box, each
 * lead is a card holding the same controls, under the same names. One is drawn, never both, so a
 * screen reader meets each control once.
 *
 * **The first 30, then *Show more*** (AC-8). Every lead still loads, page after page, so the count is
 * the whole list; only what is drawn first stops at 30, and *Show more* draws the rest at once.
 *
 * **One table, two toolbars** (P10.1-T4 AC-12). `/leads` has the prototype's count and *+ Add lead*
 * (`:2791-2794`). The coaching card has a search box and a type filter instead of the count
 * (`:4258-4266`), which is `filters`. It is off unless asked for, and `/leads` never asks: the
 * client chose a leads screen that cannot be searched (ADR-0062), and a test pins it.
 *
 * **Every write is one field, and the server is its only judge.** Which ladder a stage belongs to,
 * whether a lead may be won here — the row shows exactly what the server said, beneath the lead, for
 * as long as it stands (F-65).
 */
export function LeadsTable({
  filters = false,
  offerDelete = true,
  caption = 'Your leads',
  owner,
  readOnly = false,
  onNotice,
  onWrite,
}: {
  /**
   * The coaching card's search box and type filter in place of the count (`Overall.html:4258-4266`).
   * **Never on `/leads`** — P10.1-T4 AC-12, pinned by the screen's own spec.
   */
  filters?: boolean;
  /**
   * Whether *Delete* is in the ⋮ menu at all. The coaching card has none — its rows end in Won and
   * Lost (`Overall.html:10809-10812`) — and `lead:delete` is the owner's alone, never the coach's
   * (roles-and-permissions §3.7), so P11-T8 turns it off. `/leads` keeps it.
   */
  offerDelete?: boolean;
  /** The table's accessible name, and the card list's. */
  caption?: string;
  /**
   * **Whose leads: the coachee's**, on the coaching session's card (ADR-0076, P11-T8 AC-7). Every
   * read goes through `GET /leads?owner=` — the open list, its search and type filter, and both closed
   * lists — and *+ Add lead* creates the lead in their pipeline through `POST /leads?owner=`. Every
   * write still pins the version its row was read at, which the server requires of anybody but the
   * owner. The words are the coaching card's where it has its own: *No leads match.*, *Enter a name
   * first.*, *Mark as Won?*. Absent on `/leads`, which is the reader's own scope.
   */
  owner?: string;
  /**
   * A finalized session's lock (`Overall.html:1389-1417`): nothing on the card writes. The cells hold
   * still, *+ Add lead* goes, the ⋮ menu offers *Lead details* alone and the dialog reads, the search
   * and the filter rest, and a closed lead cannot be moved back. The closed lists still read.
   */
  readOnly?: boolean;
  /** The prototype's toast after a write lands (`Overall.html:10835-10901`): a stage, a type, an outcome, an add. */
  onNotice?: (message: string) => void;
  /** After any write lands — the session re-reads what it derives from the leads. */
  onWrite?: (lead: Lead) => void;
}) {
  const { config, loading: configLoading } = useTenantConfig();
  const { me } = useSession();
  const myMembership = me?.membership?.membershipId;
  const uid = useId();
  const [frame, cards] = useCardLayout();

  const [sort, setSort] = useState<Sort>(null);
  const [term, setTerm] = useState('');
  const search = useDebounced(term.trim());
  const [typeFilter, setTypeFilter] = useState<'' | LeadType>('');
  /** Bumped to load the open leads again from page 1 — after a reopen, or a write that shifts the pages. */
  const [reloads, setReloads] = useState(0);
  /**
   * **Which list *Show more* was pressed on.** A new order or a new filter is a new list, and shows its
   * first 30 again (AC-8) — so the press is remembered against the list it was made on, rather than
   * cleared by an effect after the new list has already drawn in full for a frame.
   */
  const listKey = [sort?.key ?? '', sort?.dir ?? '', search, typeFilter, owner ?? ''].join('\n');
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  /*
   * **And forgotten once the list changes**, so coming back to the list it was pressed on — a header
   * pressed round to the default order, a search typed and cleared — shows its first 30 again too (the
   * exit review's finding 2). Adjusted while rendering, React's own pattern for state that follows a
   * value, so no frame draws the old press against the new list.
   */
  const [seenKey, setSeenKey] = useState(listKey);
  /** Why the last drag could not be saved, said above the table until the next one is, or the list changes. */
  const [orderError, setOrderError] = useState<ApiError | null>(null);
  if (seenKey !== listKey) {
    setSeenKey(listKey);
    if (expandedFor !== null) setExpandedFor(null);
    if (orderError !== null) setOrderError(null);
  }
  const expanded = expandedFor === listKey;
  /** The first lead *Show more* drew, which takes the focus from the button that has just gone. */
  const revealed = useRef<string | null>(null);

  const [open, setOpen] = useState<List | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [won, setWon] = useState<List | null>(null);
  const [lost, setLost] = useState<List | null>(null);
  const [closedError, setClosedError] = useState<Record<LeadOutcome, ApiError | null>>({ won: null, lost: null });

  /** In-flight text, per row and field. The row keeps showing what was typed while it saves. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [rowError, setRowError] = useState<Refusals>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const drafted = useRef(0);
  const posting = useRef(false);
  /**
   * The key a lead created from the inline row keeps.
   *
   * **So the row is the same row once it is saved.** Rendered under the lead's own id, React would
   * throw the inline row away and build a new one, and the name box the reader just pressed Enter in
   * would lose its focus — leaving them to find the Type select again with the mouse.
   */
  const [keyFor, setKeyFor] = useState<Record<string, string>>({});

  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
  const [confirmType, setConfirmType] = useState<{ row: Lead; type: LeadType | null } | null>(null);
  const [confirmOutcome, setConfirmOutcome] = useState<{ row: Lead; outcome: LeadOutcome } | null>(null);

  /** Which load of the open leads is the current one. A page from any other is dropped. */
  const openLoad = useRef(0);
  /** Whether the current load still has pages to come. */
  const loadingOpen = useRef(false);
  /** Where the focus goes once the row that held it has left the table: a lead's id, or `null` for none. */
  const refocus = useRef<{ id: string | null } | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  /**
   * The version of every open lead the table has shown, as it last showed it — kept after the row
   * has gone from the list, so a lead a later page or a later list brings back is checked against
   * what the reader last saw of it.
   */
  const shownAt = useRef(new Map<string, number>());
  useEffect(() => {
    for (const row of open?.rows ?? []) shownAt.current.set(row.id, row.version);
  }, [open]);

  useEffect(() => {
    const generation = ++openLoad.current;
    const isCurrent = () => openLoad.current === generation;
    let delivered = false;
    loadingOpen.current = true;
    setLoadError(null);
    void listEveryLead(
      {
        outcome: 'open',
        // No sort is the owner's own order (P18.8-T7 AC-3).
        sort: sort?.key,
        dir: sort?.dir,
        search: filters && search ? search : undefined,
        type: filters && typeFilter ? typeFilter : undefined,
        owner,
      },
      (rows, total, first) => {
        delivered = true;
        /*
         * **A new list keeps what the reader is in the middle of** — a sort, a filter, a reopen, or
         * a restart while the pages are still arriving (`restartIfLoading`). Each changes the order
         * or the selection, not the leads, so a lead that comes back **as it was** keeps its typing
         * and whatever was refused about it: dropping them would throw away a remark being typed
         * because a row two lines up was deleted, and leave a refused name's row saying nothing.
         * Nothing else is touched either — the inline row is in no list, and nor is a closed card's.
         *
         * A lead that comes back **changed** drops both, as a `VERSION_CONFLICT` does: the reader's
         * words over a record that now says something else, saved at its new version, would
         * silently overwrite whatever changed it.
         */
        const changed = rows
          .filter((r) => (shownAt.current.get(r.id) ?? r.version) !== r.version)
          .map((r) => r.id);
        if (changed.length > 0) {
          setDrafts((d) => without(d, ...changed));
          setRowError((e) => without(e, ...changed));
        }
        if (first) {
          setOpen({ rows, total });
          return;
        }
        // A lead added here while the pages were arriving is already at the top; not twice.
        setOpen((current) => current && {
          ...current,
          rows: [...current.rows, ...rows.filter((r) => !current.rows.some((c) => c.id === r.id))],
        });
      },
      isCurrent,
    ).catch((err) => {
      if (!isCurrent()) return;
      setLoadError(toDisplayError(err));
      // Rows from a page that did arrive stay; a list that never started has nothing to show.
      if (!delivered) setOpen(null);
    }).finally(() => {
      if (isCurrent()) loadingOpen.current = false;
    });
    return () => { openLoad.current += 1; };
  }, [sort?.key, sort?.dir, filters, search, typeFilter, reloads, owner]);

  /**
   * The two closed cards, loaded the same way (AC-4), once — **each on its own.**
   *
   * **Every closed lead, and *See all n* gone.** The prototype prints both lists whole
   * (`Overall.html:5568-5592`); they were five each with a link into a filter this screen no longer
   * has. A lead closed or reopened here moves between the lists without asking again. A card that
   * fails says so in its own place, and the other stands: one list the server could not answer is
   * no reason to hide the one it did.
   */
  useEffect(() => {
    let current = true;
    const isCurrent = () => current;
    for (const [outcome, set] of [['won', setWon], ['lost', setLost]] as const) {
      loadClosed(outcome, set, isCurrent, owner).catch((err) => {
        if (current) setClosedError((e) => ({ ...e, [outcome]: toDisplayError(err) }));
      });
    }
    return () => { current = false; };
  }, [owner]);

  const pipelines = useMemo(() => config?.leadPipelines ?? [], [config]);
  const ladderFor = useCallback(
    (type: LeadType | null): LeadStatusRow[] =>
      (type ? pipelines.find((p) => p.pipeline === type)?.statuses ?? [] : []),
    [pipelines],
  );
  const stageLabel = (row: Lead) => ladderFor(row.type).find((s) => s.code === row.statusCode)?.label ?? null;
  const isTerminal = (row: Lead) =>
    !!row.statusCode && (ladderFor(row.type).find((s) => s.code === row.statusCode)?.isTerminal ?? false);

  const draftInputId = `${uid}-draft-name`;
  const nameId = (id: string) => `${uid}-name-${id}`;
  useEffect(() => {
    if (draft) document.getElementById(draftInputId)?.focus();
    // Only when a new inline row appears — not on every letter typed into it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.key]);

  /*
   * **A row that leaves takes the reader's place with it** — *Mark successful*, *Mark not successful*
   * and *Delete* each end with the row gone, and its ⋮ — where the focus went back to — gone with it,
   * which drops the focus to the top of the page.
   * It goes to the next lead's name instead, or the one before, or *+ Add lead* when none is left.
   * Only a focus the removal took: a reader who has moved on is left where they are.
   */
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const next = (target.id ? document.getElementById(nameId(target.id)) : null)
      ?? document.getElementById(draftInputId)
      ?? addButton.current;
    next?.focus();
    // `nameId` and `draftInputId` are fixed for the life of the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * **A write that moves a row, or removes one, while pages are still arriving asks again from
   * page 1.** The pages are offsets into the server's order: take one lead out of the first 200 and
   * the lead that was 201st is now 200th, so page 2 starts one past it and it is never shown. A list
   * that has finished loading has no page left to miss.
   */
  function restartIfLoading() {
    if (loadingOpen.current) setReloads((n) => n + 1);
  }

  function replaceRow(next: Lead) {
    setOpen((current) => current && {
      ...current,
      rows: current.rows.map((r) => (r.id === next.id ? next : r)),
    });
  }

  function dropOpen(id: string) {
    setOpen((current) => {
      if (!current) return current;
      const at = current.rows.findIndex((r) => r.id === id);
      const rows = current.rows.filter((r) => r.id !== id);
      if (at !== -1) refocus.current = { id: (rows[at] ?? rows[at - 1])?.id ?? null };
      return { rows, total: Math.max(0, current.total - 1) };
    });
    /*
     * What was typed on it and what was refused about it go with it. A closed card has no box for
     * either — a refused name under a card that shows no name box describes nothing there — and a
     * deleted lead has no row at all.
     */
    setDrafts((d) => without(d, id));
    forget(id);
    // Its dialog goes with it, rather than reappearing if the lead is ever reopened.
    setDetailsFor((shown) => (shown === id ? null : shown));
    restartIfLoading();
  }

  /** A lead that has closed leaves the table for its card, where the prototype puts it. */
  function moveToClosed(lead: Lead) {
    dropOpen(lead.id);
    const set = lead.outcome === 'won' ? setWon : setLost;
    set((list) => list && {
      rows: [...list.rows.filter((r) => r.id !== lead.id), lead].sort(byRegisteredDesc),
      total: list.total + (list.rows.some((r) => r.id === lead.id) ? 0 : 1),
    });
  }

  /** Record a refusal against each field it concerns — or against the row, when it concerns none. */
  function refuse(id: string, fields: readonly string[], error: ApiError) {
    const keys = fields.length > 0 ? fields : [''];
    setRowError((e) => ({ ...e, [id]: { ...e[id], ...Object.fromEntries(keys.map((k) => [k, error])) } }));
  }

  /** Take refusals away: the named ones, or every one the lead has. */
  function forget(id: string, keys?: readonly string[]) {
    setRowError((e) => {
      if (!e[id]) return e;
      if (!keys) return without(e, id);
      const left = without(e[id], ...keys);
      return Object.keys(left).length > 0 ? { ...e, [id]: left } : without(e, id);
    });
  }

  function dropDrafts(id: string, fields: readonly string[]) {
    setDrafts((d) => (d[id] ? { ...d, [id]: without(d[id], ...fields) } : d));
  }

  /** Every refusal standing on a lead, once each — a pair refused for one reason says it once. */
  const refusalsOf = (id: string): ApiError[] => {
    const seen = new Set<string>();
    return Object.values(rowError[id] ?? {}).filter((error) => {
      const key = `${error.code}\n${error.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  /**
   * One write, and whatever the server says about it, on this row. It answers with the lead as
   * saved, or `null` when it was refused.
   *
   * **A refusal stands for as long as what it refused is still on the screen** (F-65). It is kept
   * against the field it concerns, so a later write to a *different* field — ticking *This month*
   * under a refused name — cannot take it away while the refused name is still in its box. Only that
   * field's own success, or the typing going, clears it. A refusal that concerns no field (a stage, a
   * delete) has nothing left on screen to describe once anything on the row succeeds.
   *
   * **A refusal that means the row itself has changed re-reads it.** `LEAD_ALREADY_CLOSED` and
   * `VERSION_CONFLICT` are somebody else's act — a second tab, or a leader in a coaching session —
   * so the screen catches up rather than going on showing a lead the server no longer holds, and
   * drops the typing: a draft left on top of a reloaded row would show the reader their own words
   * over a record that says something else, and the next save would silently overwrite the change
   * this refusal exists to protect. Every other refusal leaves the typing alone.
   */
  async function run(
    id: string,
    write: () => Promise<Lead>,
    { fields = [], done = replaceRow, moves = [] }: {
      /** The draft fields this write carries — cleared, with their refusals, once it lands. */
      fields?: readonly string[];
      done?: (lead: Lead) => void;
      /** The sorts under which this write can move the row, and so shift the pages still to come. */
      moves?: readonly SortKey[];
    } = {},
  ): Promise<Lead | null> {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const saved = await write();
      done(saved);
      dropDrafts(id, fields);
      forget(id, ['', ...fields]);
      if (sort && moves.includes(sort.key)) restartIfLoading();
      onWrite?.(saved);
      return saved;
    } catch (err) {
      const shown = toDisplayError(err);
      refuse(id, fields, shown);
      if (shown.code === 'LEAD_ALREADY_CLOSED' || shown.code === 'VERSION_CONFLICT') {
        try {
          const fresh = await readLead(id);
          if (fresh.outcome) moveToClosed(fresh);
          else replaceRow(fresh);
          setDrafts((d) => without(d, id));
          // The typing has gone, so what refused it has nothing left to point at.
          setRowError((e) => ({ ...e, [id]: { '': shown } }));
        } catch { /* the row beneath it already says what happened */ }
      }
      return null;
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  const draftOf = (row: Lead, field: string, stored: string | null) =>
    drafts[row.id]?.[field] ?? stored ?? '';

  const setDraftValue = (id: string, field: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));

  /** Commit a text field as it is left, and only when it actually changed. */
  function commitText(
    row: Lead,
    field: string,
    stored: string | null,
    body: (value: string | null) => Record<string, unknown>,
    moves: readonly SortKey[] = [],
  ) {
    const typed = drafts[row.id]?.[field];
    if (typed === undefined) return;
    const trimmed = typed.trim();
    if (trimmed === (stored ?? '')) {
      // Back to what is stored: nothing to write, and nothing refused is on the screen any more.
      dropDrafts(row.id, [field]);
      forget(row.id, [field]);
      return;
    }
    void run(row.id, () => updateLead(row.id, body(trimmed === '' ? null : trimmed), row.version), {
      fields: [field], moves,
    });
  }

  /**
   * Changing the ladder clears the rung and the commitment, so it asks first (I-105).
   *
   * The two pipelines share no stage and the server clears both — the prototype does the same
   * (`Overall.html:5604-5609`) and does it silently, which is the part not reproduced. Only worth
   * asking when there is something to lose.
   */
  function changeType(row: Lead, next: '' | LeadType) {
    const type = next === '' ? null : next;
    if (type === row.type) return;
    if (row.statusCode || row.thisMonth) {
      setConfirmType({ row, type });
      return;
    }
    void writeType(row, type);
  }

  /** The type, and the prototype's *"{name} moved to Sales."* once it lands (`Overall.html:10837`). */
  async function writeType(row: Lead, type: LeadType | null) {
    const saved = await run(row.id, () => updateLead(row.id, { type }, row.version), { moves: ['type', 'status'] });
    if (saved?.type) onNotice?.(`${saved.name} moved to ${TYPE_WORD[saved.type]}.`);
  }

  /** The stage, and *"{name}'s status updated to "{stage}"."* once it lands (`Overall.html:10835`). */
  async function writeStatus(row: Lead, code: string) {
    const saved = await run(row.id, () => setLeadStatus(row.id, code, row.version), { moves: ['status'] });
    const label = saved && ladderFor(saved.type).find((s) => s.code === saved.statusCode)?.label;
    if (saved && label) onNotice?.(`${saved.name}'s status updated to "${label}".`);
  }

  /** `+ Add lead`: a row at the top, or back to the one already there. */
  function addLead() {
    if (draft) {
      document.getElementById(draftInputId)?.focus();
      return;
    }
    drafted.current += 1;
    setDraft({ key: `draft-${drafted.current}`, name: '', posting: false });
  }

  function changeDraftName(value: string) {
    setDraft((d) => d && { ...d, name: value });
    if (draft && value.trim().length >= LEAD_NAME_MIN) forget(draft.key, ['name']);
  }

  /**
   * The inline row becomes a lead on its first valid name (AC-5).
   *
   * **Posted once, on the first name the server would keep** — two characters, as it counts them —
   * whether the reader leaves the box or presses Enter. A row left empty is taken away and nothing is
   * written: the prototype saves a blank lead the moment the button is pressed, and the server
   * refuses one. A name of one letter stays in its row, unsaved, **and the row says why** beneath it,
   * until the name is long enough — otherwise it is a row that silently never saves.
   */
  async function submitDraft(how: 'blur' | 'enter') {
    if (!draft || posting.current) return;
    const name = draft.name.trim();
    if (name === '') {
      if (how === 'blur') {
        setDraft(null);
        forget(draft.key);
      } else if (owner) {
        // Enter on an empty name, in the session: the coaching card's own sentence.
        refuse(draft.key, ['name'], NO_NAME);
      }
      return;
    }
    if (name.length < LEAD_NAME_MIN) {
      refuse(draft.key, ['name'], SHORT_NAME);
      return;
    }
    posting.current = true;
    const { key } = draft;
    setDraft({ ...draft, posting: true });
    try {
      const created = await createLead({ name }, owner);
      setKeyFor((k) => ({ ...k, [created.id]: key }));
      setOpen((current) => current && {
        rows: [created, ...current.rows.filter((r) => r.id !== created.id)],
        total: current.total + 1,
      });
      setDraft(null);
      forget(key);
      onNotice?.(`${created.name} added.`);
      onWrite?.(created);
    } catch (err) {
      refuse(key, [''], toDisplayError(err));
      setDraft((d) => d && { ...d, posting: false });
    } finally {
      posting.current = false;
    }
  }

  /** Reopening puts the lead back where the table's order says, so the table asks again. */
  async function reopen(row: Lead) {
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      const reopened = await setLeadOutcome(row.id, null, row.version);
      forget(row.id);
      onWrite?.(reopened);
      const set = row.outcome === 'won' ? setWon : setLost;
      set((list) => list && {
        rows: list.rows.filter((r) => r.id !== row.id),
        total: Math.max(0, list.total - 1),
      });
      setReloads((n) => n + 1);
    } catch (err) {
      refuse(row.id, [''], toDisplayError(err));
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  }

  /**
   * A heading sorts ascending, then descending, then **back to the saved order** — the order the table
   * opens on, which no heading names (P18.8-T7; the newest registration until then, ADR-0108 §4). A new
   * column starts ascending, as the prototype does (`Overall.html:5694-5707`). Nothing a heading does
   * is saved.
   */
  const sortable = (label: string, key: SortKey): Column => ({
    label,
    sort: sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
    onSort: () => setSort((s) => {
      if (s?.key !== key) return { key, dir: 'asc' };
      return s.dir === 'asc' ? { key, dir: 'desc' } : null;
    }),
  });

  const columns: readonly Column[] = [
    { label: 'Row', visuallyHidden: true },
    sortable('Lead name', 'name'),
    sortable('Type', 'type'),
    sortable('Status', 'status'),
    'This month',
    'Remarks',
    'Next action',
    'Actions',
  ];

  const narrowed = filters && (search !== '' || typeFilter !== '');
  const held = open?.rows ?? [];
  const shown = expanded ? held : held.slice(0, LEAD_ROWS_FIRST_SHOWN);
  const unshown = held.length - shown.length;
  const rows: { lead: Lead; isDraft: boolean }[] = [
    ...(draft ? [{ lead: blankLead(draft.key, draft.name), isDraft: true }] : []),
    ...shown.map((lead) => ({ lead, isDraft: false })),
  ];
  const detailsLead = open?.rows.find((r) => r.id === detailsFor) ?? null;

  /** *Show more*: every other lead at once, and the focus on the first of them (AC-8). */
  function showMore() {
    revealed.current = held[shown.length]?.id ?? null;
    setExpandedFor(listKey);
  }

  /*
   * ---------------------------------------------- the reader's own order (P18.8-T7, ADR-0161 §1)
   *
   * **On `/leads` only, and while no column sort is on.** A coaching session's card (`owner`) shows the
   * coachee's order and offers no handle: the order is its owner's. Under a sort the rows are in the
   * sort's order, and a drop there would save an order the reader never saw.
   *
   * **Every page first.** The server takes the reader's open leads all at once, so a list still arriving
   * holds its handles still until the last page lands.
   */
  const ordering = !owner && !readOnly && sort === null;
  const complete = open !== null && open.rows.length >= open.total;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** Saves go one after another, so two quick drags reach the server in the order they were made. */
  const orderQueue = useRef<Promise<void>>(Promise.resolve());
  const orderSaves = useRef(0);
  /** The handle ↑ or ↓ was pressed on, which keeps the focus once its row has moved. */
  const moved = useRef<string | null>(null);
  const handleId = (id: string) => `${uid}-handle-${id}`;

  /**
   * Put the lead at `from` where the lead at `to` is, and save the reader's open leads in the new order.
   *
   * **Shown at once, saved behind it.** The table moves on the drop; the save follows, after any still on
   * its way. A refusal puts the rows back where they were, says why above the table, and reads the list
   * again — the server's order is the one that stands, and a list that has changed since it was read (a
   * lead a leader added in a session) is why a save is refused. **A leader sends their own leads only**:
   * their agents' rows on the same list keep their owners' order.
   */
  function place(from: number, to: number) {
    if (from === to) return;
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
        setOpen((current) => current && { ...current, rows: arranged(current.rows, before) });
        setReloads((n) => n + 1);
      }
    });
  }

  /** A drop on a row: the dragged lead takes its place. */
  function dropOn(targetId: string) {
    const lifted = dragging;
    setDragging(null);
    setOver(null);
    if (!lifted || lifted === targetId) return;
    const from = held.findIndex((r) => r.id === lifted);
    const to = held.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;
    place(from, to);
  }

  /**
   * ↑ or ↓ on a handle: past the next of the reader's own leads that way, among the rows drawn. An agent's
   * row on a leader's list is stepped over, since moving past it changes nothing that is saved; the last
   * row drawn before *Show more* goes no lower until the rest are shown.
   */
  function moveBy(id: string, by: -1 | 1) {
    const at = held.findIndex((r) => r.id === id);
    let to = at + by;
    while (to >= 0 && to < shown.length && held[to].ownerMembershipId !== myMembership) to += by;
    if (at < 0 || to < 0 || to >= shown.length) return;
    moved.current = id;
    place(at, to);
  }

  useEffect(() => {
    const id = moved.current;
    if (!id) return;
    moved.current = null;
    // A row moved down is taken out and put back by React, and the focus would fall to the page.
    const handle = document.getElementById(handleId(id));
    if (handle && document.activeElement !== handle) handle.focus();
    // `handleId` is fixed for the life of the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** What a row or a card takes to be a drop target, and how it looks while it is one. */
  const dropTarget = (id: string, isDraft: boolean) => (ordering && !isDraft ? {
    'data-row': id,
    onDragOver: (e: React.DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      setOver(id);
    },
    onDragLeave: () => setOver((now) => (now === id ? null : now)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      dropOn(id);
    },
  } : {});
  const dropLook = (id: string) => cn(over === id && dragging !== id && 'bg-canvas', dragging === id && 'opacity-40');

  useEffect(() => {
    const id = revealed.current;
    if (!id) return;
    revealed.current = null;
    document.getElementById(nameId(id))?.focus();
    // `nameId` is fixed for the life of the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedFor]);

  /** Enter finishes a remark or a note rather than starting a second line (`Overall.html:5642-5650`). */
  const finishOnEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  /**
   * **The reader's own change needs no name** (ADR-0044, as ADR-0063 §1 places it). The payload
   * names a change that was not the owner's; a leader reading a downline's lead they changed
   * themselves is told nothing they do not know. Said in the lead's details since P13.1-T4.
   */
  const editedByOf = (row: Lead) => (row.lastEditedBy && row.lastEditedBy.membershipId !== myMembership
    // In a session, a name the payload no longer has is said without ADR-0084's *office*.
    ? `Last changed by ${row.lastEditedBy.name ?? (owner ? 'someone else' : 'someone in your office')}`
    : null);

  /**
   * The calendar icon left of the date opens the browser's own picker (P13.1-T4 AC-5).
   *
   * **A pointer's shortcut, and nothing a keyboard needs**: the date box is the control — its label,
   * its typing, its own keys — and the icon is taken out of the tab order and hidden from assistive
   * technology, so a row is not one stop longer and nothing is announced twice. `showPicker` is refused
   * by a browser that lacks it or a box that is read-only; the focus is then the whole answer.
   */
  function openPicker(id: string, locked: boolean) {
    if (locked) return;
    const input = document.getElementById(id) as HTMLInputElement | null;
    input?.focus();
    try {
      input?.showPicker();
    } catch { /* The date can be typed; the focus is in the box. */ }
  }

  /** The row's ⋮ menu: what can be done to this lead, each disabled with its reason where it is (AC-3). */
  function menuFor(row: Lead, locked: boolean, foreign: boolean): ActionMenuItem[] {
    const details: ActionMenuItem = { label: 'Lead details', glyph: '☎', onSelect: () => setDetailsFor(row.id) };
    // A finalized session's lock: the details still read, and nothing else is offered.
    if (readOnly) return [details];
    const terminal = isTerminal(row);
    const items: ActionMenuItem[] = [
      details,
      {
        label: 'Mark successful',
        glyph: '✓',
        tone: 'success',
        disabled: locked || !terminal,
        reason: terminal ? undefined : 'Available once status reaches the final stage',
        onSelect: () => setConfirmOutcome({ row, outcome: 'won' }),
      },
      // Lost is allowed at any stage (§3.7); only won is gated.
      {
        label: 'Mark not successful',
        glyph: '✕',
        tone: 'alert',
        disabled: locked,
        onSelect: () => setConfirmOutcome({ row, outcome: 'lost' }),
      },
    ];
    /*
     * **Delete is the owner's** (`lead:delete` is `own`, roles-and-permissions §3.7): a leader asking to
     * delete a downline's lead is answered *Lead not found* beneath a lead that is plainly there. On
     * their rows it stays in the menu and says whose it is. The payload carries the owner's
     * membership, not their name — hence *the person who owns*.
     */
    if (offerDelete) {
      items.push({
        label: 'Delete',
        glyph: '🗑',
        disabled: locked || foreign,
        reason: foreign ? 'Only the person who owns this lead can delete it.' : undefined,
        onSelect: () => setConfirmDelete(row),
      });
    }
    return items;
  }

  /**
   * One lead's controls, once — **the table's cells and the card's lines draw the same ones**, under
   * the same accessible names, so a lead reads the same to a screen reader at any width and every
   * behaviour below holds in both.
   */
  function controlsFor({ lead: row, isDraft }: { lead: Lead; isDraft: boolean }, n: number) {
    const ladder = ladderFor(row.type);
    const retired = row.statusCode && !ladder.some((s) => s.code === row.statusCode);
    const saving = busy[row.id] === true;
    /*
     * **Held, never disabled, while a write is in flight** — and on the inline row, which writes
     * nothing but its name until it is a lead. A disabled control drops the focus it holds and is
     * skipped by Tab, so a field left with Tab would send the reader past the next one, or out of the
     * row, while its own save went through. `readOnly` for what is typed, `aria-disabled` and a guard
     * in the handler for the rest — as the details dialog does. `disabled` stays for what is a state
     * of the lead rather than a moment: no type yet, not on the final stage.
     */
    const locked = saving || isDraft || readOnly;
    const monthAction = row.type === 'recruitment' ? 'Recruit this month' : 'Close this month';
    const foreign = !isDraft && row.ownerMembershipId !== myMembership;
    const dateId = `${uid}-date-${keyFor[row.id] ?? row.id}`;
    const chat = isDraft ? null : whatsAppLink(row.contact.phone);

    return {
      /*
       * **The reader's own open leads, on `/leads`, while no sort is on** (P18.8-T7 AC-4) — none on the
       * inline row, which is not a lead yet, and none on an agent's row on their leader's list: the order
       * of a list is its owner's. Held still until every page has arrived (`complete`).
       */
      handle: ordering && !isDraft && !foreign ? (
        <DragHandle
          id={handleId(row.id)}
          label={row.name || 'this lead'}
          disabled={!complete}
          className="cursor-grab select-none text-sm leading-none text-muted disabled:cursor-not-allowed"
          onPick={() => setDragging(row.id)}
          onDrop={() => { setDragging(null); setOver(null); }}
          onMove={(by) => moveBy(row.id, by)}
        />
      ) : null,

      /*
       * **The name, and nothing else** (P10.1-T4 AC-1, `Overall.html:5510-5512`). The prototype gives
       * the box no label; it gets a name a screen reader can say and nothing a reader can see.
       */
      name: (heading = false) => (
        <TextInput
          id={isDraft ? draftInputId : nameId(row.id)}
          aria-label={`Lead name, row ${n}`}
          density="cell"
          className={cn('w-full', heading && 'text-md font-semibold')}
          value={isDraft ? row.name : draftOf(row, 'name', row.name)}
          placeholder="First Last"
          readOnly={isDraft ? draft?.posting : saving || readOnly}
          onChange={(e) => {
            // A finalized session's card is inert (P11-T8 AC-10): nothing typed, nothing saved.
            if (readOnly && !isDraft) return;
            if (isDraft) changeDraftName(e.target.value);
            else setDraftValue(row.id, 'name', e.target.value);
          }}
          onBlur={() => {
            if (readOnly && !isDraft) return;
            if (isDraft) void submitDraft('blur');
            else commitText(row, 'name', row.name, (name) => ({ name }), ['name']);
          }}
          onKeyDown={(e) => {
            if (isDraft && e.key === 'Enter') void submitDraft('enter');
          }}
        />
      ),

      /*
       * **The word is coloured and the cell is not** (F-73). `.type-badge-select` colours the words on
       * the cell's transparent ground (`Overall.html:476-477`), and an unchosen type is the grey,
       * normal-weight placeholder (`:473`) — so Type reads as a word and Status, beside it, as a box.
       * Client, 2026-10-01: Type must not look like Status.
       *
       * Sales is **amber-ink**, not the prototype's amber-dark: at this size amber-dark is 2.99:1 on
       * white and amber-deep 4.34:1, both under the 4.5:1 small text needs. Recruitment is the
       * prototype's navy-soft exactly.
       */
      /*
       * **Bordered at rest since 2026-10-26** (ADR-0161 §2): the client could not see it was a choice. The
       * ground stays transparent, so the word still reads as a word beside Status's tinted box, and the
       * hover and the focus ring are the cell's own.
       */
      type: (
        <Select
          aria-label={`Type, row ${n}`}
          density="cell"
          className={cn(
            'border-hairline',
            row.type === 'sales' && 'font-semibold text-amber-ink',
            row.type === 'recruitment' && 'font-semibold text-navy-soft',
            row.type === null && 'text-muted',
            isDraft && INERT_CONTROL,
          )}
          value={row.type ?? ''}
          aria-disabled={locked || undefined}
          onChange={(e) => {
            if (locked) return;
            changeType(row, e.target.value as '' | LeadType);
          }}
        >
          <option value="">Select type</option>
          <option value="sales">{TYPE_WORD.sales}</option>
          <option value="recruitment">{TYPE_WORD.recruitment}</option>
        </Select>
      ),

      /*
       * **Tinted by where the stage sits on its own ladder** (`statusStyle()`,
       * `Overall.html:5463-5478`), with navy words: not even amber-ink clears 4.5:1 on the mid-rung's
       * 13% amber tint (F-71). Until there is a ladder there is nothing to choose from, and the one
       * option says why (`Overall.html:5447-5455`); the server refuses a stage without one either way.
       */
      status: (
        <Select
          aria-label={`Status, row ${n}`}
          density="cell"
          className={cn('font-semibold', stageTint(row, ladder))}
          value={row.statusCode ?? ''}
          disabled={!row.type}
          aria-disabled={locked || undefined}
          onChange={(e) => {
            if (locked || !e.target.value) return;
            const code = e.target.value;
            void writeStatus(row, code);
          }}
        >
          {row.type ? <option value="">Select status</option> : <option value="">Select type first</option>}
          {/*
            * A stage the office has since retired. The snapshot carries **active** stages only, so the
            * code is the truthful fallback — it is what the lead holds (invariant §3).
            */}
          {retired && <option value={row.statusCode!}>{row.statusCode} (retired)</option>}
          {ladder.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </Select>
      ),

      /*
       * **Written out beside the box** (`.month-check-wrap`, `Overall.html:479-487`) — a close and a
       * recruitment are different promises. **Not until there is a type** (`:5505-5506`, P10.1-T4
       * AC-7): a promise has to say which of the two it is.
       */
      month: (
        <label
          className={cn(
            'flex items-start gap-1.5 text-xs leading-tight',
            row.type ? 'text-muted' : 'text-muted/40',
          )}
        >
          <input
            type="checkbox"
            className="mt-px h-[13px] w-[13px] shrink-0 accent-success disabled:cursor-not-allowed"
            checked={row.thisMonth}
            disabled={!row.type}
            aria-disabled={locked || undefined}
            onChange={(e) => {
              if (locked) return;
              const thisMonth = e.target.checked;
              void run(row.id, () => updateLead(row.id, { thisMonth }, row.version));
            }}
          />
          {monthAction}
        </label>
      ),

      /*
       * **Bordered at rest, not only under the pointer** (P13.1-T4 AC-5): the client could not tell
       * where a remark could be written until they hovered it (2026-10-07). The table's other cells
       * keep the prototype's transparent rest, *Type* aside; these two are the boxes a reader writes
       * sentences in. **No placeholder in either since 2026-10-26** (ADR-0161 §2): the border says where
       * to write, and the grey words read as something already written.
       */
      remarks: (
        <AutoGrowTextarea
          aria-label={`Remarks, row ${n}`}
          className={cn('w-full border-hairline', isDraft && INERT_CONTROL)}
          value={draftOf(row, 'remarks', row.remarks)}
          readOnly={locked}
          onChange={(e) => setDraftValue(row.id, 'remarks', e.target.value)}
          onKeyDown={finishOnEnter}
          onBlur={() => commitText(row, 'remarks', row.remarks, (remarks) => ({ remarks }))}
        />
      ),

      date: (
        <div className="relative">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={cn(
              'absolute inset-y-0 left-0 flex w-6 items-center justify-center text-muted hover:text-navy',
              locked && 'cursor-not-allowed hover:text-muted',
            )}
            onClick={() => openPicker(dateId, locked)}
          >
            <NavIcon name="calendar" className="h-3.5 w-3.5" />
          </button>
          <TextInput
            id={dateId}
            type="date"
            aria-label={`Next action date, row ${n}`}
            density="cell"
            className={cn('w-full pl-6', NO_NATIVE_PICKER, isDraft && INERT_CONTROL)}
            value={draftOf(row, 'nextActionDate', row.nextActionDate)}
            readOnly={locked}
            onChange={(e) => {
              if (locked) return;
              setDraftValue(row.id, 'nextActionDate', e.target.value);
              const value = e.target.value || null;
              void run(row.id, () => updateLead(row.id, { nextActionDate: value }, row.version), {
                fields: ['nextActionDate'],
              });
            }}
          />
        </div>
      ),

      note: (
        <AutoGrowTextarea
          aria-label={`Next action note, row ${n}`}
          className={cn('w-full border-hairline', isDraft && INERT_CONTROL)}
          value={draftOf(row, 'nextActionNote', row.nextActionNote)}
          readOnly={locked}
          onChange={(e) => setDraftValue(row.id, 'nextActionNote', e.target.value)}
          onKeyDown={finishOnEnter}
          onBlur={() => commitText(row, 'nextActionNote', row.nextActionNote, (nextActionNote) => ({ nextActionNote }))}
        />
      ),

      /*
       * **WhatsApp, beside the ⋮** (P18.8-T7 AC-5, ADR-0161 §2), where it was a button in *Lead details*.
       * The number as `wa.me` takes it (`whatsAppNumber`), in a new tab and with no opener; no number
       * WhatsApp could open, no link. A finalized session's card keeps it: opening a chat writes nothing.
       * 28px, the ⋮'s own size, so the two fill the Actions column's 4.5rem and widen nothing.
       */
      whatsapp: chat ? (
        <a
          href={chat}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chat with ${row.name || 'this lead'} on WhatsApp (opens in a new tab)`}
          title="WhatsApp"
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-success',
            'hover:bg-success/[0.12]',
          )}
        >
          <NavIcon name="whatsapp" className="h-4 w-4" />
        </a>
      ) : null,

      /*
       * **One ⋮ where there were four glyphs and an attribution** (P13.1-T4 AC-3, ADR-0108 §3). The
       * inline row has nothing to act on until it is a lead, so its ⋮ is there and opens nothing.
       */
      actions: (
        <ActionMenu
          label={`Actions for ${row.name || (isDraft ? 'the new lead' : 'this lead')}`}
          items={menuFor(row, locked, foreign)}
          inert={isDraft}
        />
      ),

      /*
       * **A refusal is said beneath the lead, and only while it stands** (P10.1-T4 AC-10, F-65). Each
       * leaves when what it refused does — see `run`.
       */
      errors: refusalsOf(row.id).map((error) => (
        <ErrorBanner key={`${error.code} ${error.message}`} {...error} />
      )),
    };
  }

  function renderRow(entry: { lead: Lead; isDraft: boolean }, index: number) {
    const n = index + 1;
    const c = controlsFor(entry, n);
    return (
      <Fragment key={keyFor[entry.lead.id] ?? entry.lead.id}>
        <Row {...dropTarget(entry.lead.id, entry.isDraft)} className={dropLook(entry.lead.id)}>
          {/* `.row-num` is grey and semibold (`Overall.html:451`) — a quiet ordinal, its handle before it. */}
          <Cell className="font-semibold text-muted">
            {c.handle ? <span className="flex items-center gap-0.5">{c.handle}{n}</span> : n}
          </Cell>
          <Cell>{c.name()}</Cell>
          <Cell>{c.type}</Cell>
          <Cell>{c.status}</Cell>
          <Cell>{c.month}</Cell>
          <Cell>{c.remarks}</Cell>
          <Cell>
            <div className="flex flex-col gap-0.5">
              {c.date}
              {c.note}
            </div>
          </Cell>
          <Cell>
            <div className="flex items-center justify-end">{c.whatsapp}{c.actions}</div>
          </Cell>
        </Row>

        {/*
          * **A refusal gets a row of its own** (P10.1-T4 AC-10, F-65). It was a banner inside the 9rem
          * name cell, which squeezed the words and pushed the row open; here it spans the table under
          * the lead it belongs to.
          */}
        {c.errors.length > 0 && (
          <Row>
            <Cell colSpan={columns.length}>
              <div className="flex flex-col gap-2">{c.errors}</div>
            </Cell>
          </Row>
        )}
      </Fragment>
    );
  }

  /**
   * One lead as a card, where the table does not fit (P13.1-T4 AC-7, ADR-0108 §6).
   *
   * **The table's row, stacked, in the prototype's own idiom**: the closed card's row padding and
   * hairline (`Overall.html:516-519`), the name as its title, the two pipeline words side by side, and
   * the table's own heading style over the two boxes a reader writes in. Those two labels are the
   * column headings the card has no row for; each control's accessible name already carries them, so
   * they are hidden from a screen reader rather than said twice.
   */
  function renderCard(entry: { lead: Lead; isDraft: boolean }, index: number) {
    const n = index + 1;
    const c = controlsFor(entry, n);
    return (
      <li
        key={keyFor[entry.lead.id] ?? entry.lead.id}
        {...dropTarget(entry.lead.id, entry.isDraft)}
        className={cn('flex flex-col gap-2 border-b border-hairline px-3 py-3 last:border-b-0', dropLook(entry.lead.id))}
      >
        <div className="flex items-center gap-1">
          {c.handle}
          <span className="w-5 shrink-0 text-base font-semibold text-muted">{n}</span>
          <div className="min-w-0 flex-1">{c.name(true)}</div>
          {c.whatsapp}
          {c.actions}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {c.type}
          {c.status}
        </div>
        <div className="px-1.5">{c.month}</div>
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className={cn(CARD_LABEL, 'px-1.5')}>Remarks</span>
          {c.remarks}
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className={cn(CARD_LABEL, 'px-1.5')}>Next action</span>
          {c.date}
          {c.note}
        </div>
        {c.errors.length > 0 && <div className="flex flex-col gap-2">{c.errors}</div>}
      </li>
    );
  }

  const empty = (
    /* The coaching card has one empty line whatever narrowed it (`Overall.html:10815`). */
    <EmptyState
      variant={narrowed ? 'filtered' : 'empty'}
      title={narrowed || owner ? 'No leads match.' : 'No leads yet — add your first one above.'}
    />
  );

  /** A card has no heading to sort from, so the card layout's toolbar says the order in words. */
  const sortChoice = cards && (
    <Select
      aria-label="Sort leads"
      value={sortValue(sort)}
      onChange={(e) => setSort(SORT_CHOICES.find((c) => sortValue(c.sort) === e.target.value)?.sort ?? null)}
    >
      {SORT_CHOICES.map((c) => <option key={sortValue(c.sort)} value={sortValue(c.sort)}>{c.label}</option>)}
    </Select>
  );

  let body: React.ReactNode;
  if (loadError && !open) {
    body = <ErrorBanner {...loadError} />;
  } else if (!open || configLoading) {
    body = cards
      ? <SkeletonCards count={3} label={`Loading ${caption.toLowerCase()}…`} />
      : <SkeletonTable caption={caption} columns={columns} rows={5} />;
  } else {
    body = (
      <>
        {filters ? (
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            {/* A finalized session rests them at 0.6, as the prototype's lock does (`Overall.html:1416-1417`). */}
            <TextInput
              type="search"
              aria-label="Search leads"
              placeholder="Search leads…"
              className={cn('w-56 max-w-full', readOnly && 'opacity-60')}
              value={term}
              disabled={readOnly}
              onChange={(e) => setTerm(e.target.value)}
            />
            <Select
              aria-label="Filter by type"
              value={typeFilter}
              disabled={readOnly}
              className={cn(readOnly && 'opacity-60')}
              onChange={(e) => setTypeFilter(e.target.value as '' | LeadType)}
            >
              <option value="">All types</option>
              <option value="sales">{TYPE_WORD.sales}</option>
              <option value="recruitment">{TYPE_WORD.recruitment}</option>
            </Select>
            {sortChoice}
            {!readOnly && <Button ref={addButton} onClick={addLead}>+ Add lead</Button>}
          </div>
        ) : (
          /* The prototype's toolbar: the count, and the screen's one action (`Overall.html:2791-2794`). */
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm text-muted">
              {open.total} active lead{open.total === 1 ? '' : 's'}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {sortChoice}
              <Button ref={addButton} onClick={addLead}>+ Add lead</Button>
            </div>
          </div>
        )}

        {loadError && <div className="mb-3"><ErrorBanner {...loadError} /></div>}
        {/* A drag the server refused, said once above the list it was made on (P18.8-T7). */}
        {orderError && <div className="mb-3"><ErrorBanner {...orderError} /></div>}

        {cards ? (
          rows.length === 0 ? (
            <div className="rounded-lg border border-hairline bg-card">{empty}</div>
          ) : (
            <ul role="list" aria-label={caption} className="rounded-lg border border-hairline bg-card">
              {rows.map(renderCard)}
            </ul>
          )
        ) : (
          /*
           * **Eight widths, no minimum width** (`WIDTHS`). The table fills its box and asks for no more,
           * so there is nothing to scroll sideways; below `TABLE_MIN_REM` the cards take over instead.
           */
          <DataTable caption={caption} columns={columns} density="compact" widths={owner ? WIDTHS : WIDTHS_WITH_HANDLES}>
            {rows.length === 0 ? (
              <Row>
                {/* Inside the table card, under its headings, as `.empty-state` is (`Overall.html:2818`). */}
                <Cell colSpan={columns.length}>{empty}</Cell>
              </Row>
            ) : rows.map(renderRow)}
          </DataTable>
        )}

        {/*
          * **The first 30, then the rest at once** (P13.1-T4 AC-8, ADR-0108 §7) — the client's words,
          * *Show more*, and no pager after it. It goes once there is nothing left to show.
          */}
        {unshown > 0 && (
          <div className="mt-3 flex justify-center">
            <Button variant="secondary" onClick={showMore}>Show more</Button>
          </div>
        )}

        <ClosedLeads
          won={{ list: won, error: closedError.won }}
          lost={{ list: lost, error: closedError.lost }}
          busy={busy}
          refusalsOf={refusalsOf}
          stageLabel={stageLabel}
          onReopen={readOnly ? undefined : (row) => void reopen(row)}
        />

        {detailsLead && (
          <LeadDetailsDialog
            lead={detailsLead}
            saving={busy[detailsLead.id] === true}
            errors={refusalsOf(detailsLead.id)}
            editedBy={editedByOf(detailsLead)}
            readOnly={readOnly}
            editor={{
              value: (field, stored) => draftOf(detailsLead, field, stored),
              change: (field, value) => setDraftValue(detailsLead.id, field, value),
              commit: (field: DetailsField) => {
                const { contact } = detailsLead;
                if (field === 'source') {
                  commitText(detailsLead, 'source', detailsLead.source, (source) => ({ source }));
                  return;
                }
                // The pair travels together, so saving one never erases the other.
                commitText(detailsLead, field, contact[field], (value) => ({
                  contact: { phone: contact.phone, email: contact.email, [field]: value },
                }));
              },
            }}
            onClose={() => setDetailsFor(null)}
          />
        )}

        {/* The prototype's own questions (`Overall.html:5666-5675`), each naming what its button does (F-72). */}
        {/*
          * In a session, the coaching card's own question and sentence (`Overall.html:10867-10870`):
          * *Mark as Won?*, and where the lead goes. Its button says what it does, as every `Dialog`'s does,
          * where the prototype's says *Confirm*.
          */}
        <Dialog
          open={confirmOutcome !== null}
          message={owner && confirmOutcome
            ? `Mark as ${OUTCOME_WORD[confirmOutcome.outcome]}? ${confirmOutcome.row.name || 'This lead'} will move to Closed leads as "${OUTCOME_WORD[confirmOutcome.outcome]}". You can still find them there afterward.`
            : confirmOutcome?.outcome === 'won'
              ? `Mark ${confirmOutcome.row.name || 'this lead'} as a successful lead?`
              : `Mark ${confirmOutcome?.row.name || 'this lead'} as not successful? This moves them to the closed list.`}
          confirmLabel={owner && confirmOutcome
            ? `Mark as ${OUTCOME_WORD[confirmOutcome.outcome]}`
            : confirmOutcome?.outcome === 'won' ? 'Mark successful' : 'Mark not successful'}
          onCancel={() => setConfirmOutcome(null)}
          onConfirm={async () => {
            const { row, outcome } = confirmOutcome!;
            setConfirmOutcome(null);
            const saved = await run(row.id, () => setLeadOutcome(row.id, outcome, row.version), { done: moveToClosed });
            if (saved) onNotice?.(`${saved.name} marked as ${OUTCOME_WORD[outcome]}.`);
          }}
        />

        {/*
          * *Delete {name}?* — the prototype's question without *permanently* and *can't be undone*
          * (`Overall.html:5661`), which would both be false: deleting is soft and audited (I-101).
          */}
        <Dialog
          open={confirmDelete !== null}
          message={`Delete ${confirmDelete?.name || 'this lead'}?`}
          confirmLabel="Delete lead"
          tone="danger"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            const row = confirmDelete!;
            setConfirmDelete(null);
            setBusy((b) => ({ ...b, [row.id]: true }));
            try {
              await deleteLead(row.id);
              dropOpen(row.id);
            } catch (err) {
              refuse(row.id, [''], toDisplayError(err));
            } finally {
              setBusy((b) => ({ ...b, [row.id]: false }));
            }
          }}
        />

        <Dialog
          open={confirmType !== null}
          message="Changing the type clears this lead’s stage and its commitment for this month. The two ladders share no stage. Continue?"
          confirmLabel="Change the type"
          onCancel={() => setConfirmType(null)}
          onConfirm={() => {
            const { row, type } = confirmType!;
            setConfirmType(null);
            void writeType(row, type);
          }}
        />
      </>
    );
  }

  // One box whatever is in it, so the width it is measured by is the same from the first frame.
  return <div ref={frame} className="min-w-0">{body}</div>;
}

/**
 * **Cards, when the table's box is narrower than `TABLE_MIN_REM`** (P13.1-T4 AC-7).
 *
 * Measured on the box rather than asked of the window, because the box is what the table has to fit:
 * the sidebar open or folded, and the coaching session's card around it, all change it without the
 * window changing. Decided before the first paint and again on every change of width.
 *
 * **A width of zero is no answer** — a box not laid out, which is jsdom, or a tab that is hidden — and
 * leaves the table, which is what every spec written before the cards was written against.
 */
function useCardLayout(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const frame = useRef<HTMLDivElement>(null);
  const [cards, setCards] = useState(false);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const decide = (width: number) => {
      const rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      setCards(width > 0 && width < TABLE_MIN_REM * rem);
    };
    decide(el.getBoundingClientRect().width);
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver((entries) => {
      decide(entries[entries.length - 1]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [frame, cards];
}

/** Both closed lists, page after page, into state as each lands. */
async function loadClosed(
  outcome: LeadOutcome,
  set: React.Dispatch<React.SetStateAction<List | null>>,
  isCurrent: () => boolean,
  owner?: string,
) {
  await listEveryLead(
    { outcome, sort: 'dateRegistered', dir: 'desc', owner },
    (rows, total, first) => set((list) => (first || !list
      ? { rows, total }
      : { ...list, rows: [...list.rows, ...rows.filter((r) => !list.rows.some((c) => c.id === r.id))] })),
    isCurrent,
  );
}

/** One closed card's state: what has arrived, and what stopped the rest. */
interface ClosedCard {
  list: List | null;
  error: ApiError | null;
}

/**
 * The two lists below the table: what was won, and what was not (`Overall.html:2824-2842`).
 *
 * **The record, not the work.** The table is leads still open; these are how the year has gone, and
 * somewhere to reopen from when a lead comes back. Each row is the name over *Sales · {stage}*
 * (`:5577`), with one action that says what it does — `.reopen-btn` is an outlined pill rather than a
 * glyph (`:524-529`), because it is the only action and it destroys nothing.
 *
 * **Each card stands on its own.** It waits in its own skeleton, fails in its own place, and when a
 * later page does not arrive says how much of the list it is showing — a card short of its own
 * header total with nothing said would read as the whole record.
 */
function ClosedLeads({
  won,
  lost,
  busy,
  refusalsOf,
  stageLabel,
  onReopen,
}: {
  won: ClosedCard;
  lost: ClosedCard;
  busy: Record<string, boolean>;
  refusalsOf: (id: string) => ApiError[];
  /**
   * The office's own word for the stage. A lead carries the **code** — renaming a stage must not
   * orphan the leads sitting on it (invariant §3) — so the label comes from the published snapshot.
   */
  stageLabel: (row: Lead) => string | null;
  /** Absent under a finalized session's lock: the lists still read, and nothing moves back. */
  onReopen?: (row: Lead) => void;
}) {
  const cards = [
    { outcome: 'won' as const, title: '✓ Successful', card: won, empty: 'No successful leads yet.', waiting: 'Loading successful leads…' },
    { outcome: 'lost' as const, title: '✕ Not successful', card: lost, empty: 'No lost leads yet.', waiting: 'Loading lost leads…' },
  ];

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-md font-bold text-navy">Closed leads</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map(({ outcome, title, card: { list, error }, empty, waiting }) => (
          <div key={outcome} className="overflow-hidden rounded-lg border border-hairline bg-card">
            <header
              className={cn(
                'flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 text-md font-bold',
                outcome === 'won' ? 'bg-success/[0.06] text-success' : 'bg-alert/[0.06] text-alert',
              )}
            >
              <h3>{title}</h3>
              {list && <span className="text-sm font-semibold text-muted">{list.total}</span>}
            </header>

            {list === null ? (
              error
                ? <div className="px-4 py-4"><ErrorBanner {...error} /></div>
                : <Skeleton label={waiting} className="px-4 py-4"><SkeletonText lines={2} /></Skeleton>
            ) : (
              <>
                {list.rows.length === 0 && !error
                  ? <p className="px-4 py-4 text-sm italic text-muted">{empty}</p>
                  : list.rows.map((row) => (
                    <div key={row.id} className="border-b border-hairline px-4 py-2.5 last:border-b-0">
                      <div className="flex items-center justify-between gap-2.5">
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-md font-semibold text-navy">{row.name || '(unnamed)'}</span>
                          <span className="text-xs text-muted">
                            {TYPE_WORD[row.type === 'recruitment' ? 'recruitment' : 'sales']}
                            {stageLabel(row) ? ` · ${stageLabel(row)}` : ''}
                          </span>
                        </span>
                        {onReopen && <button
                          type="button"
                          disabled={busy[row.id] === true}
                          onClick={() => onReopen(row)}
                          className={cn(
                            'shrink-0 whitespace-nowrap rounded-pill border border-hairline px-2.5 py-1',
                            'text-xs font-semibold text-navy-soft hover:bg-navy-soft/[0.08]',
                            'disabled:cursor-not-allowed disabled:opacity-40',
                          )}
                        >
                          ↺ Move to active
                        </button>}
                      </div>
                      {/* A refused reopen says so where it was asked for, as a row's refusal does. */}
                      {refusalsOf(row.id).map((refusal) => (
                        <div key={`${refusal.code} ${refusal.message}`} className="mt-2"><ErrorBanner {...refusal} /></div>
                      ))}
                    </div>
                  ))}
                {error && (
                  <div className="flex flex-col gap-2 border-t border-hairline px-4 py-3">
                    <p className="text-xs text-muted">
                      Showing {list.rows.length} of {list.total} — the rest did not load.
                    </p>
                    <ErrorBanner {...error} />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Where this stage sits on **its own** ladder, as a tint.
 *
 * `statusStyle()` (`Overall.html:5463-5478`): the first rung is alert, the last is success, and a rung
 * in between wears its ladder's colour, amber for sales and navy-soft for recruitment. The text stays
 * navy and only the ground changes (F-71); the stage name is in the box either way.
 */
function stageTint(row: Lead, ladder: readonly { code: string }[]): string {
  if (!row.statusCode || ladder.length === 0) return 'text-muted';
  const at = ladder.findIndex((s) => s.code === row.statusCode);
  if (at === -1) return 'text-muted';
  if (at === 0) return 'bg-alert/[0.08] text-navy';
  if (at === ladder.length - 1) return 'bg-success/10 text-navy';
  return row.type === 'recruitment' ? 'bg-navy-soft/[0.09] text-navy' : 'bg-amber/[0.13] text-navy';
}
