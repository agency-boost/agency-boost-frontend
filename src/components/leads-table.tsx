'use client';

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LeadDetailsDialog, type DetailsField } from '@/components/lead-details-dialog';
import { ActionMenu, type ActionMenuItem } from '@/components/ui/action-menu';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { DragHandle } from '@/components/ui/drag-handle';
import { EmptyState } from '@/components/ui/empty-state';
import { DateField } from '@/components/ui/date-field';
import { Button, ErrorBanner, Field, Select, TextInput } from '@/components/ui/field';
import {
  InlineSaveField, InlineSaveStatus, useInlineSave, type InlineSaveOutcome, type InlineSaveState,
  type InlineSaveStatusProps,
} from '@/components/ui/inline-save-status';
import { Modal } from '@/components/ui/modal';
import { NavIcon } from '@/components/ui/nav-icon';
import { TAP_HEIGHT, TAP_TARGET } from '@/components/ui/phone';
import { Skeleton, SkeletonCards, SkeletonTable, SkeletonText } from '@/components/ui/skeleton';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import type { MessagesOf } from '@/i18n/catalogue';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { leadsMessages } from '@/i18n/messages/leads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay } from '@/lib/format';
import {
  callLink, createLead, deleteLead, listEveryLead, phoneHeld, readLead, reorderLeads, setLeadOutcome, setLeadStatus,
  updateLead, whatsAppLink, LEAD_NAME_MIN, LEAD_ROWS_FIRST_SHOWN, type Lead, type LeadOutcome, type LeadQuery,
  type LeadType,
} from '@/lib/leads';
import { useSession } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useDebounced } from '@/lib/use-debounced';
import { usePhone } from '@/lib/use-phone';

/** The module's words, in the reader's language (`messages/leads.tsx`; P18.98-T4). */
type LeadsWords = MessagesOf<typeof leadsMessages.en>;

/**
 * The order the table can be in, as `GET /leads` names it: the three headings that sort
 * (`Overall.html:2805-2813`), and registration, which the closed cards are asked for in.
 */
export type SortKey = Extract<NonNullable<LeadQuery['sort']>, 'name' | 'type' | 'status' | 'dateRegistered'>;

/**
 * A column sort, **or `null`: the owner's own order** (P18.8-T7, ADR-0161 §1), which the table opens on.
 *
 * `null` asks `GET /leads` for no sort, and the server answers in the order the owner dragged their
 * leads into, a new one on top. It was the newest registration until then, which is where the prototype
 * opens (`Overall.html:5432`) and the order migration 0031 filled every list in, so nobody's list moved.
 * **A heading's third press comes back here**, and the card layout's sort offers it by name — and a sort
 * is for the visit: it is component state, so leaving the screen and coming back shows the saved order.
 */
export type Sort = { key: SortKey; dir: 'asc' | 'desc' } | null;

/**
 * The narrowest the table is drawn, in rem: below it, each lead is a card (P13.1-T4 AC-7, ADR-0108 §6).
 *
 * The six fixed columns (`WIDTHS`, 43.25rem since P18.95-T4 put 📞 in *Actions*) and the two that share
 * what is left, at no less than 7.375rem each — the date box with its icon, and a remark of two or three
 * words a line; 44rem and 7rem on `/leads`, whose first column holds a drag handle (P18.8-T7). **Measured
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
// *Widened 2026-10-26 (P18.95-T4 AC-3):* 5.25rem holds WhatsApp and 📞 at 24px each beside the 28px ⋮, in a
// cell padded 4px a side (`ACTIONS_CELL`) — 0.75rem more, so the two text columns keep 7.625rem each at 1280px
// with the sidebar open, room for the date with its icon; at 28px and the cells' own 8px they would have had 6.5rem.
const WIDTHS = ['2rem', '11rem', '7.5rem', '11rem', '6.5rem', 'auto', 'auto', '5.25rem'] as const;

/** The *Actions* cell's own padding, 4px a side where every other cell has 8px (`WIDTHS`). */
const ACTIONS_CELL = '!px-1';

/**
 * WhatsApp's and 📞's box at rest: **24px, the glyph 16px in it**, so the two sit beside the 28px ⋮ in
 * 5.25rem. **44px on a phone** (`TAP_TARGET`), each owning its own square, as the ⋮ does.
 */
const CONTACT_GLYPH = cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm', TAP_TARGET);

/**
 * **The same, with room for a drag handle beside the row's number** (P18.8-T7): `/leads`, where the reader
 * orders their own list. 0.75rem more, taken from the two columns that share what is left — at
 * `TABLE_MIN_REM` they still have 7.375rem each. Kept while a column sort hides the handles, so pressing a
 * heading does not move every column.
 */
const WIDTHS_WITH_HANDLES = ['2.75rem', ...WIDTHS.slice(1)] as const;

/**
 * The card layout's sort: each order the headings give, said in words, since a card has no heading.
 *
 * **What the order does, not which way a key runs** (P18.95-T4 AC-4, ADR-0167; UI-027: *"Type, ascending"*
 * says nothing about where the Sales leads go). The values sent are the headings' own, unchanged: `type`
 * ascending is no type, then Sales, then Recruit, and descending the reverse; `status` ascending is the
 * first stage of a ladder first, a lead with no stage before it.
 */
export const SORT_CHOICES: readonly { sort: Sort; words: Exclude<keyof LeadsWords['sort'], 'label'> }[] = [
  { sort: null, words: 'saved' },
  { sort: { key: 'name', dir: 'asc' }, words: 'nameAsc' },
  { sort: { key: 'name', dir: 'desc' }, words: 'nameDesc' },
  { sort: { key: 'type', dir: 'asc' }, words: 'typeAsc' },
  { sort: { key: 'type', dir: 'desc' }, words: 'typeDesc' },
  { sort: { key: 'status', dir: 'asc' }, words: 'statusAsc' },
  { sort: { key: 'status', dir: 'desc' }, words: 'statusDesc' },
];
const sortValue = (sort: Sort) => (sort ? `${sort.key}:${sort.dir}` : 'saved');

/** The table heading's look, on the card's two labels (`Overall.html:413-418`). */
const CARD_LABEL = 'text-2xs font-semibold uppercase tracking-[0.03em] text-muted';

export interface List {
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
const shortName = (t: LeadsWords): ApiError => ({
  code: 'VALIDATION_FAILED',
  message: t.shortName({ min: LEAD_NAME_MIN }),
  requestId: 'unknown',
});

/**
 * The coaching card's own words for a name not given at all (`Overall.html:10894`), said where the
 * name is rather than in a toast: a refusal the reader has to act on stays beside what caused it
 * (`components-and-patterns.md`, *Toast*).
 */
const noName = (t: LeadsWords): ApiError => ({
  code: 'VALIDATION_FAILED',
  message: t.noName,
  requestId: 'unknown',
});

/*
 * The coaching card's words for the two outcomes (`Overall.html:10867-10881`) are `t.outcomes`, and a lead's type is
 * named *Recruit*, not *Recruitment* (ADR-0161 §2), `t.types` — the stored value stays `recruitment`.
 */

/** A control on the inline row with nothing to write to yet: there, and plainly not live. */
const INERT_CONTROL = 'cursor-not-allowed opacity-40';

/** Every field a lead starts with, so the inline row renders through the same cells as a real one. */
const blankLead = (id: string, name: string): Lead => ({
  id, name, ownerMembershipId: '', type: null, contact: { phone: null, email: null },
  statusCode: null, thisMonth: false, committedMonths: [],
  lastEditedBy: null, remarks: null, nextActionDate: null, nextActionNote: null, outcome: null,
  source: null, dateRegistered: null, version: 0, flags: [], overdueDays: null,
});

/**
 * Every field of a lead that saves itself, each with its own *Saving… → Saved ✓* (P18.95-T1 AC-5): the
 * row's cells, the card's lines and the details dialog's three boxes.
 */
const SAVING_FIELDS = [
  'name', 'type', 'status', 'thisMonth', 'remarks', 'nextActionDate', 'nextActionNote', 'source', 'phone', 'email',
] as const;

/** What one write on a row carries besides itself (`run`). */
interface RunOptions {
  /** The draft fields this write carries — cleared, with their refusals, once it lands. */
  fields?: readonly string[];
  done?: (lead: Lead) => void;
  /** The sorts under which this write can move the row, and so shift the pages still to come. */
  moves?: readonly SortKey[];
  /** The refusal re-read the row and threw the typing away: there is nothing left to send again. */
  replaced?: () => void;
}

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
 * (`:2791-2794`), and **since P18.95-T4 a search, a *Type* and a *Status* filter above them** (AC-2,
 * ADR-0167 §4; the client's UI review of 2026-10-26, UI-016: 71 leads and no way to find one). The coaching
 * card has a search box and a type filter instead of the count (`:4258-4266`), which is `filters`. A list
 * narrowed by any of them offers no drag handle, as a column sort does not: the saved order is the whole
 * list's, and a drop among some of it would save an order the reader never saw.
 *
 * **On a phone, a read-only card per lead, and a sheet to edit it** (P18.95-T4 AC-1; UI-016: every field
 * of every card editable, the name included, at 26–28px). Below 768px each card is the lead in words —
 * name, type, stage, next action, the remarks in full — with WhatsApp, 📞 and ⋮ beside the name; a tap on
 * it opens the edit sheet, which holds the same controls at 44px under their own labels, each saving
 * itself as a cell does. A tablet and a desktop are as they were (ADR-0167 §12).
 *
 * **Every write is one field, and the server is its only judge.** Which ladder a stage belongs to,
 * whether a lead may be won here — the row shows exactly what the server said, beneath the lead, for
 * as long as it stands (F-65). **And each field says its save beside it** (P18.95-T1 AC-5, `saveField`):
 * *Saving…*, *Saved ✓*, or *Couldn't save — retry*.
 */
export function LeadsTable({
  filters = false,
  offerDelete = true,
  caption: captionGiven,
  owner,
  readOnly = false,
  onNotice,
  onWrite,
}: {
  /**
   * The coaching card's search box and type filter in place of the count (`Overall.html:4258-4266`).
   * `/leads` keeps its count and has its own filter bar above it since P18.95-T4 — search, *Type* and
   * *Status* (AC-2) — so this is the coaching card's toolbar, and nothing more.
   */
  filters?: boolean;
  /**
   * Whether *Delete* is in the ⋮ menu at all. The coaching card has none — its rows end in Won and
   * Lost (`Overall.html:10809-10812`) — and `lead:delete` is the owner's alone, never the coach's
   * (roles-and-permissions §3.7), so P11-T8 turns it off. `/leads` keeps it.
   */
  offerDelete?: boolean;
  /** The table's accessible name, and the card list's: *Your leads* where none is given. */
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
  const t = useMessages(leadsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const caption = captionGiven ?? t.yourLeads;
  const { config, loading: configLoading } = useTenantConfig();
  const { me } = useSession();
  const myMembership = me?.membership?.membershipId;
  const uid = useId();
  const [frame, boxCards] = useCardLayout();
  /**
   * **Below 768px, the read-only cards and their edit sheet** (P18.95-T4 AC-1). Asked of the window, not the
   * box, because it is the phone's layout the client reviewed (ADR-0167 §4, §12): a tablet whose box is under
   * `TABLE_MIN_REM` keeps the editable cards it has had since P13.1-T4.
   */
  const phone = usePhone();
  const cards = boxCards || phone;

  const [sort, setSort] = useState<Sort>(null);
  const [term, setTerm] = useState('');
  const search = useDebounced(term.trim());
  const [typeFilter, setTypeFilter] = useState<'' | LeadType>('');
  /** `/leads`' *Status* filter (P18.95-T4 AC-2): a stage code, of either ladder — one code per office across both. */
  const [statusFilter, setStatusFilter] = useState('');
  /** Bumped to load the open leads again from page 1 — after a reopen, or a write that shifts the pages. */
  const [reloads, setReloads] = useState(0);
  /**
   * **Which list *Show more* was pressed on.** A new order or a new filter is a new list, and shows its
   * first 30 again (AC-8) — so the press is remembered against the list it was made on, rather than
   * cleared by an effect after the new list has already drawn in full for a frame.
   */
  const listKey = [sort?.key ?? '', sort?.dir ?? '', search, typeFilter, statusFilter, owner ?? ''].join('\n');
  /** A list the reader has searched or filtered: some of their leads, not all of them (P18.95-T4 AC-2). */
  const narrowed = search !== '' || typeFilter !== '' || statusFilter !== '';
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
  /**
   * **Each field that saves itself says so beside it** (P18.95-T1 AC-5, ADR-0167 §5; UI-007): *Saving…*,
   * *Saved ✓* for two seconds, or *Couldn't save — retry*, which sends the same value again. Keyed by the
   * row's own key and the field, so the inline row's name keeps its *Saved ✓* once it is a lead.
   */
  const inline = useInlineSave();
  const saveKey = (row: Lead, field: string) => `${keyFor[row.id] ?? row.id}\n${field}`;
  /** The open rows as last drawn: a retry sends at the version the row holds now, not the one it failed at. */
  const openRows = useRef<readonly Lead[]>([]);
  /** `keyFor` as last drawn, so `forgetSaves` stays one function for the load below to call. */
  const keysNow = useRef(keyFor);
  useEffect(() => { keysNow.current = keyFor; }, [keyFor]);
  const { clear: clearSave } = inline;
  /**
   * Every field's *Saving…*, *Saved ✓* and *Couldn't save* on a lead, gone — with the row, or with the typing
   * a re-read threw away: a retry left standing would send words the screen no longer shows.
   */
  const forgetSaves = useCallback((id: string) => {
    const key = keysNow.current[id] ?? id;
    for (const field of SAVING_FIELDS) clearSave(`${key}\n${field}`);
  }, [clearSave]);

  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  /**
   * **The lead the phone's edit sheet is open on**, by its row's key — `keyFor`'s, or the inline row's own —
   * so a new lead's sheet stays open, on the same name box, once its name has made it a lead (P18.95-T4 AC-1).
   */
  const [sheetFor, setSheetFor] = useState<string | null>(null);
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
    openRows.current = open?.rows ?? [];
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
        // The server narrows; the screen only asks (P18.95-T4 AC-2). Nothing is sent until something is chosen.
        search: search || undefined,
        type: typeFilter || undefined,
        statusCode: statusFilter || undefined,
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
          for (const id of changed) forgetSaves(id);
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
  }, [sort?.key, sort?.dir, search, typeFilter, statusFilter, reloads, owner, forgetSaves]);

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
  /** A control in the phone's edit sheet, which holds one lead at a time (P18.95-T4 AC-1). */
  const sheetFieldId = (field: string) => `${uid}-sheet-${field}`;
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
    forgetSaves(id);
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
    { fields = [], done = replaceRow, moves = [], replaced }: RunOptions = {},
  ): Promise<Lead | null> {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const saved = await write();
      done(saved);
      dropDrafts(id, fields);
      forget(id, ['', ...fields]);
      /*
       * A write that can move the row under the sort — or, under a search or a filter, take it out of the
       * list (P18.95-T4) — shifts the pages still to come. The row itself stays until the next load: a lead
       * does not vanish from under the reader's finger because its type no longer matches the filter.
       */
      if ((sort && moves.includes(sort.key)) || (narrowed && moves.length > 0)) restartIfLoading();
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
          forgetSaves(id);
          replaced?.();
          // The typing has gone, so what refused it has nothing left to point at.
          setRowError((e) => ({ ...e, [id]: { '': shown } }));
        } catch { /* the row beneath it already says what happened */ }
      }
      return null;
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  /**
   * One field's write **with its save confirmation** (P18.95-T1 AC-5): `run`, inside *Saving… → Saved ✓*.
   *
   * **The retry sends the same value**, at the version the row holds when it is pressed — a field saved
   * meanwhile has moved it on. A row that has gone, or a refusal that re-read the row and threw the typing
   * away (`VERSION_CONFLICT`, `LEAD_ALREADY_CLOSED`), leaves nothing to retry: the status goes, and the
   * reason beneath the lead says what happened, as it always has.
   */
  function saveField(
    row: Lead,
    field: (typeof SAVING_FIELDS)[number],
    write: (version: number) => Promise<Lead>,
    options: RunOptions = {},
    after?: (lead: Lead) => void,
  ) {
    const { id } = row;
    let first = true;
    return inline.save(saveKey(row, field), async (): Promise<InlineSaveOutcome> => {
      const current = first ? row : openRows.current.find((r) => r.id === id);
      first = false;
      if (!current) return null;
      let gone = false;
      const saved = await run(id, () => write(current.version), { ...options, replaced: () => { gone = true; } });
      if (!saved) return gone ? null : false;
      after?.(saved);
      return true;
    });
  }

  const draftOf = (row: Lead, field: string, stored: string | null) =>
    drafts[row.id]?.[field] ?? stored ?? '';

  const setDraftValue = (id: string, field: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));

  /** Commit a text field as it is left, and only when it actually changed. */
  function commitText(
    row: Lead,
    field: 'name' | 'remarks' | 'nextActionNote' | DetailsField,
    stored: string | null,
    body: (value: string | null) => Record<string, unknown>,
    moves: readonly SortKey[] = [],
  ) {
    const typed = drafts[row.id]?.[field];
    if (typed === undefined) return;
    const trimmed = typed.trim();
    if (trimmed === (stored ?? '')) {
      // Back to what is stored: nothing to write, and nothing refused or unsaved is on the screen any more.
      dropDrafts(row.id, [field]);
      forget(row.id, [field]);
      inline.clear(saveKey(row, field));
      return;
    }
    const value = trimmed === '' ? null : trimmed;
    void saveField(row, field, (version) => updateLead(row.id, body(value), version), { fields: [field], moves });
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
    await saveField(row, 'type', (version) => updateLead(row.id, { type }, version), { moves: ['type', 'status'] }, (saved) => {
      if (saved.type) onNotice?.(t.notices.movedTo({ name: saved.name, type: t.types[saved.type] }));
    });
  }

  /** The stage, and *"{name}'s status updated to "{stage}"."* once it lands (`Overall.html:10835`). */
  async function writeStatus(row: Lead, code: string) {
    await saveField(row, 'status', (version) => setLeadStatus(row.id, code, version), { moves: ['status'] }, (saved) => {
      const label = ladderFor(saved.type).find((s) => s.code === saved.statusCode)?.label;
      if (label) onNotice?.(t.notices.statusTo({ name: saved.name, stage: label }));
    });
  }

  /** `+ Add lead`: a row at the top, or back to the one already there. */
  function addLead() {
    if (draft) {
      // On a phone the inline row lives in the sheet, which opens on its name box (P18.95-T4 AC-1).
      if (phone) setSheetFor(draft.key);
      else document.getElementById(draftInputId)?.focus();
      return;
    }
    drafted.current += 1;
    const key = `draft-${drafted.current}`;
    setDraft({ key, name: '', posting: false });
    if (phone) setSheetFor(key);
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
        inline.clear(`${draft.key}\nname`);
      } else if (owner) {
        // Enter on an empty name, in the session: the coaching card's own sentence.
        refuse(draft.key, ['name'], noName(t));
      }
      return;
    }
    if (name.length < LEAD_NAME_MIN) {
      refuse(draft.key, ['name'], shortName(t));
      return;
    }
    const { key } = draft;
    // The name's own *Saving… → Saved ✓* (AC-5): the lead it becomes keeps the inline row's key, and so its status.
    await inline.save(`${key}\nname`, () => postDraft(key, name));
  }

  /** The inline row's one write: the lead, under the name typed. Sent again, as it was, by a retry. */
  async function postDraft(key: string, name: string): Promise<boolean> {
    if (posting.current) return false;
    posting.current = true;
    setDraft((d) => d && d.key === key ? { ...d, posting: true } : d);
    try {
      const created = await createLead({ name }, owner);
      setKeyFor((k) => ({ ...k, [created.id]: key }));
      setOpen((current) => current && {
        rows: [created, ...current.rows.filter((r) => r.id !== created.id)],
        total: current.total + 1,
      });
      setDraft(null);
      forget(key);
      onNotice?.(t.notices.added({ name: created.name }));
      onWrite?.(created);
      return true;
    } catch (err) {
      refuse(key, [''], toDisplayError(err));
      setDraft((d) => d && { ...d, posting: false });
      return false;
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
    { label: t.columns.row, visuallyHidden: true },
    sortable(t.columns.name, 'name'),
    sortable(t.columns.type, 'type'),
    sortable(t.columns.status, 'status'),
    t.columns.thisMonth,
    t.columns.remarks,
    t.columns.nextAction,
    t.columns.actions,
  ];

  const held = open?.rows ?? [];
  const shown = expanded ? held : held.slice(0, LEAD_ROWS_FIRST_SHOWN);
  const unshown = held.length - shown.length;
  const draftEntry = draft ? [{ lead: blankLead(draft.key, draft.name), isDraft: true }] : [];
  const rows: { lead: Lead; isDraft: boolean }[] = [
    ...draftEntry,
    ...shown.map((lead) => ({ lead, isDraft: false })),
  ];
  const detailsLead = open?.rows.find((r) => r.id === detailsFor) ?? null;

  /** A row's key: the inline row's own, kept by the lead it becomes (`keyFor`), or the lead's id. */
  const rowKey = (row: Lead) => keyFor[row.id] ?? row.id;
  /*
   * **The sheet's lead**, among every lead held — drawn or not — and the inline row. One that has gone (closed,
   * deleted, a draft left empty) takes the sheet with it, and so does a window widened past the phone's.
   */
  const sheetEntry = sheetFor === null ? null
    : [...draftEntry, ...held.map((lead) => ({ lead, isDraft: false }))].find((e) => rowKey(e.lead) === sheetFor) ?? null;
  if (sheetFor !== null && (!sheetEntry || !phone)) setSheetFor(null);

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
   * sort's order, and a drop there would save an order the reader never saw. **Nor under a search or a
   * filter** (P18.95-T4 AC-2): the rows are some of the reader's leads, and the order saved is all of them.
   *
   * **Every page first.** The server takes the reader's open leads all at once, so a list still arriving
   * holds its handles still until the last page lands.
   */
  const ordering = !owner && !readOnly && sort === null && !narrowed;
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
    ? t.editedBy({ name: row.lastEditedBy.name ?? (owner ? t.someoneElse : t.someoneInYourOffice) })
    : null);

  /** The row's ⋮ menu: what can be done to this lead, each disabled with its reason where it is (AC-3). */
  function menuFor(row: Lead, locked: boolean, foreign: boolean): ActionMenuItem[] {
    const details: ActionMenuItem = { label: t.menu.details, glyph: '☎', onSelect: () => setDetailsFor(row.id) };
    // A finalized session's lock: the details still read, and nothing else is offered.
    if (readOnly) return [details];
    const terminal = isTerminal(row);
    const items: ActionMenuItem[] = [
      details,
      {
        label: t.menu.markWon,
        glyph: '✓',
        tone: 'success',
        disabled: locked || !terminal,
        reason: terminal ? undefined : t.menu.wonHeld,
        onSelect: () => setConfirmOutcome({ row, outcome: 'won' }),
      },
      // Lost is allowed at any stage (§3.7); only won is gated.
      {
        label: t.menu.markLost,
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
        label: t.menu.delete,
        glyph: '🗑',
        disabled: locked || foreign,
        reason: foreign ? t.menu.deleteHeld : undefined,
        onSelect: () => setConfirmDelete(row),
      });
    }
    return items;
  }

  /**
   * One lead's controls, once — **the table's cells and the card's lines draw the same ones**, under
   * the same accessible names, so a lead reads the same to a screen reader at any width and every
   * behaviour below holds in both.
   *
   * **`sheet` is the phone's edit sheet** (P18.95-T4 AC-1): the same controls, each a 44px field under a
   * label of its own rather than a cell named for its row, with the same writes, the same held row and the
   * same *Saving… → Saved ✓* beside each.
   */
  function controlsFor({ lead: row, isDraft }: { lead: Lead; isDraft: boolean }, n: number, variant: 'row' | 'sheet' = 'row') {
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
    const monthAction = row.type === 'recruitment' ? t.recruitThisMonth : t.closeThisMonth;
    const foreign = !isDraft && row.ownerMembershipId !== myMembership;
    const sheet = variant === 'sheet';
    const dateId = sheet ? sheetFieldId('nextActionDate') : `${uid}-date-${keyFor[row.id] ?? row.id}`;
    const chat = isDraft ? null : whatsAppLink(row.contact.phone);
    const call = isDraft ? null : callLink(row.contact.phone);
    /** Why the two are held — nothing saved, or nothing that can be dialled (AC-3) — or `null` where they are live. */
    const dialless = isDraft ? null : phoneHeld(row.contact.phone, language);
    const who = row.name || t.thisLead;
    /** In a row a control is named for its row; in the sheet its own label above it names it. */
    const nameOf = (label: string) => (sheet ? undefined : t.inRow({ label, n }));
    const saveLabel = (label: string) => (sheet ? label : t.inRow({ label, n }));
    const density = sheet ? 'default' : 'cell';
    /** A text box in the sheet: a field's box at rest, 44px at least, its words 16px on a phone. */
    const SHEET_TEXT = 'min-h-11 rounded-md border-hairline bg-card px-3 py-2.5';

    return {
      /*
       * **The reader's own open leads, on `/leads`, while no sort is on** (P18.8-T7 AC-4) — none on the
       * inline row, which is not a lead yet, and none on an agent's row on their leader's list: the order
       * of a list is its owner's. Held still until every page has arrived (`complete`). **44px on a phone**
       * (P18.95-T4), where the card around it is otherwise read-only.
       */
      handle: ordering && !isDraft && !foreign ? (
        <DragHandle
          id={handleId(row.id)}
          label={row.name || t.thisLead}
          disabled={!complete}
          className={cn(
            'cursor-grab select-none text-sm leading-none text-muted disabled:cursor-not-allowed',
            'max-md:inline-flex max-md:items-center max-md:justify-center', TAP_TARGET,
          )}
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
        <InlineSaveField status={inline.statusOf(saveKey(row, 'name'))} label={saveLabel(t.columns.name)}>
          <TextInput
            id={isDraft ? draftInputId : sheet ? sheetFieldId('name') : nameId(row.id)}
            aria-label={nameOf(t.columns.name)}
            density={density}
            className={cn('w-full', heading && 'text-md font-semibold', sheet && TAP_HEIGHT)}
            value={isDraft ? row.name : draftOf(row, 'name', row.name)}
            placeholder={t.namePlaceholder}
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
        </InlineSaveField>
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
        <InlineSaveField status={inline.statusOf(saveKey(row, 'type'))} label={saveLabel(t.columns.type)}>
          <Select
            id={sheet ? sheetFieldId('type') : undefined}
            aria-label={nameOf(t.columns.type)}
            density={density}
            className={cn(
              'border-hairline',
              row.type === 'sales' && 'font-semibold text-amber-ink',
              row.type === 'recruitment' && 'font-semibold text-navy-soft',
              row.type === null && 'text-muted',
              isDraft && INERT_CONTROL,
              sheet && cn('w-full', TAP_HEIGHT),
            )}
            value={row.type ?? ''}
            aria-disabled={locked || undefined}
            onChange={(e) => {
              if (locked) return;
              changeType(row, e.target.value as '' | LeadType);
            }}
          >
            <option value="">{t.selectType}</option>
            <option value="sales">{t.types.sales}</option>
            <option value="recruitment">{t.types.recruitment}</option>
          </Select>
        </InlineSaveField>
      ),

      /*
       * **Tinted by where the stage sits on its own ladder** (`statusStyle()`,
       * `Overall.html:5463-5478`), with navy words: not even amber-ink clears 4.5:1 on the mid-rung's
       * 13% amber tint (F-71). Until there is a ladder there is nothing to choose from, and the one
       * option says why (`Overall.html:5447-5455`); the server refuses a stage without one either way.
       */
      status: (
        <InlineSaveField status={inline.statusOf(saveKey(row, 'status'))} label={saveLabel(t.columns.status)}>
          <Select
            id={sheet ? sheetFieldId('status') : undefined}
            aria-label={nameOf(t.columns.status)}
            density={density}
            className={cn('font-semibold', stageTint(row, ladder), sheet && cn('w-full', TAP_HEIGHT))}
            value={row.statusCode ?? ''}
            disabled={!row.type}
            aria-disabled={locked || undefined}
            onChange={(e) => {
              if (locked || !e.target.value) return;
              const code = e.target.value;
              void writeStatus(row, code);
            }}
          >
            {row.type ? <option value="">{t.selectStatus}</option> : <option value="">{t.selectTypeFirst}</option>}
            {/*
              * A stage the office has since retired. The snapshot carries **active** stages only, so the
              * code is the truthful fallback — it is what the lead holds (invariant §3).
              */}
            {retired && <option value={row.statusCode!}>{t.retired({ code: row.statusCode! })}</option>}
            {ladder.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </Select>
        </InlineSaveField>
      ),

      /*
       * **Written out beside the box** (`.month-check-wrap`, `Overall.html:479-487`) — a close and a
       * recruitment are different promises. **Not until there is a type** (`:5505-5506`, P10.1-T4
       * AC-7): a promise has to say which of the two it is. In the sheet the box is 20px and its line 44px.
       */
      month: (
        <InlineSaveField status={inline.statusOf(saveKey(row, 'thisMonth'))} label={saveLabel(monthAction)}>
          <label
            className={cn(
              'flex items-start gap-1.5 text-xs leading-tight',
              row.type ? 'text-muted' : 'text-muted/40',
              sheet && 'min-h-11 items-center gap-2.5 text-md text-navy',
            )}
          >
            <input
              type="checkbox"
              className={cn(
                'mt-px h-[13px] w-[13px] shrink-0 accent-success disabled:cursor-not-allowed',
                sheet && 'mt-0 h-5 w-5',
              )}
              checked={row.thisMonth}
              disabled={!row.type}
              aria-disabled={locked || undefined}
              onChange={(e) => {
                if (locked) return;
                const thisMonth = e.target.checked;
                void saveField(row, 'thisMonth', (version) => updateLead(row.id, { thisMonth }, version));
              }}
            />
            {monthAction}
          </label>
        </InlineSaveField>
      ),

      /*
       * **Bordered at rest, not only under the pointer** (P13.1-T4 AC-5): the client could not tell
       * where a remark could be written until they hovered it (2026-10-07). The table's other cells
       * keep the prototype's transparent rest, *Type* aside; these two are the boxes a reader writes
       * sentences in. **No placeholder in either since 2026-10-26** (ADR-0161 §2): the border says where
       * to write, and the grey words read as something already written. **In the sheet it grows with what
       * is typed** (P18.95-T4 AC-1; UI-016: the remark was clipped), from 44px.
       */
      remarks: (
        <InlineSaveField status={inline.statusOf(saveKey(row, 'remarks'))} label={saveLabel(t.columns.remarks)}>
          <AutoGrowTextarea
            id={sheet ? sheetFieldId('remarks') : undefined}
            aria-label={nameOf(t.columns.remarks)}
            className={cn('w-full border-hairline', isDraft && INERT_CONTROL, sheet && SHEET_TEXT)}
            value={draftOf(row, 'remarks', row.remarks)}
            readOnly={locked}
            onChange={(e) => setDraftValue(row.id, 'remarks', e.target.value)}
            onKeyDown={finishOnEnter}
            onBlur={() => commitText(row, 'remarks', row.remarks, (remarks) => ({ remarks }))}
          />
        </InlineSaveField>
      ),

      date: (
        <InlineSaveField status={inline.statusOf(saveKey(row, 'nextActionDate'))} label={saveLabel(t.nextActionDate)}>
          {/*
            * The shared date field (P18.96-T2 AC-4): the day as the app writes it — never the browser's *mm/dd/yyyy* —
            * with the calendar on its left (P13.1-T4 AC-5), and the device's picker opened by a click on the field.
            */}
          <DateField
            id={dateId}
            aria-label={nameOf(t.nextActionDate)}
            density={density}
            glyph="start"
            className={cn('w-full', isDraft && INERT_CONTROL, sheet && TAP_HEIGHT)}
            value={draftOf(row, 'nextActionDate', row.nextActionDate)}
            readOnly={locked}
            onChange={(next) => {
              if (locked) return;
              setDraftValue(row.id, 'nextActionDate', next);
              const value = next || null;
              void saveField(row, 'nextActionDate', (version) => updateLead(row.id, { nextActionDate: value }, version), {
                fields: ['nextActionDate'],
              });
            }}
          />
        </InlineSaveField>
      ),

      note: (
        <InlineSaveField status={inline.statusOf(saveKey(row, 'nextActionNote'))} label={saveLabel(t.nextActionNote)}>
          <AutoGrowTextarea
            id={sheet ? sheetFieldId('nextActionNote') : undefined}
            aria-label={nameOf(t.nextActionNote)}
            className={cn('w-full border-hairline', isDraft && INERT_CONTROL, sheet && SHEET_TEXT)}
            value={draftOf(row, 'nextActionNote', row.nextActionNote)}
            readOnly={locked}
            onChange={(e) => setDraftValue(row.id, 'nextActionNote', e.target.value)}
            onKeyDown={finishOnEnter}
            onBlur={() => commitText(row, 'nextActionNote', row.nextActionNote, (nextActionNote) => ({ nextActionNote }))}
          />
        </InlineSaveField>
      ),

      /*
       * **WhatsApp, beside the ⋮** (P18.8-T7 AC-5, ADR-0161 §2), where it was a button in *Lead details*.
       * The number as `wa.me` takes it (`whatsAppNumber`), in a new tab and with no opener. A finalized
       * session's card keeps it: opening a chat writes nothing. **Held, with its reason, where there is no
       * number WhatsApp could open** (P18.95-T4 AC-3) — until then there was no link at all, and a lead with
       * no phone looked the same as a lead whose WhatsApp had not loaded.
       */
      whatsapp: isDraft ? null : chat ? (
        <a
          href={chat}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.chatOpens({ who })}
          title={t.whatsapp}
          className={cn(CONTACT_GLYPH, 'text-success hover:bg-success/[0.12]')}
        >
          <NavIcon name="whatsapp" className="h-4 w-4" />
        </a>
      ) : (
        <TippedGlyph
          glyph={<NavIcon name="whatsapp" className="h-4 w-4" />}
          name={t.chat({ who })}
          tip={dialless ?? ''}
          unavailable
          align="fit"
          face={cn(CONTACT_GLYPH, 'text-success')}
        />
      ),

      /*
       * **📞, beside WhatsApp** (P18.95-T4 AC-3, ADR-0167 §4; UI-016): `tel:` with the same number, read by the
       * same rule, so the phone's own dialler rings it. Held with the same reason where WhatsApp is held.
       */
      call: isDraft ? null : call ? (
        <a
          href={call}
          aria-label={t.callWho({ who })}
          title={t.call}
          className={cn(CONTACT_GLYPH, 'text-sm leading-none hover:bg-navy/[0.08]')}
        >
          <span aria-hidden="true">📞</span>
        </a>
      ) : (
        <TippedGlyph
          glyph="📞"
          name={t.callWho({ who })}
          tip={dialless ?? ''}
          unavailable
          align="fit"
          face={cn(CONTACT_GLYPH, 'text-sm leading-none')}
        />
      ),

      /*
       * **One ⋮ where there were four glyphs and an attribution** (P13.1-T4 AC-3, ADR-0108 §3). The
       * inline row has nothing to act on until it is a lead, so its ⋮ is there and opens nothing.
       */
      actions: (
        <ActionMenu
          label={t.actionsFor({ who: row.name || (isDraft ? t.theNewLead : t.thisLead) })}
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
          <Cell className={ACTIONS_CELL}>
            <div className="flex items-center justify-end">{c.whatsapp}{c.call}{c.actions}</div>
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
          {c.call}
          {c.actions}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {c.type}
          {c.status}
        </div>
        <div className="px-1.5">{c.month}</div>
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className={cn(CARD_LABEL, 'px-1.5')}>{t.columns.remarks}</span>
          {c.remarks}
        </div>
        <div className="flex flex-col gap-1">
          <span aria-hidden="true" className={cn(CARD_LABEL, 'px-1.5')}>{t.columns.nextAction}</span>
          {c.date}
          {c.note}
        </div>
        {c.errors.length > 0 && <div className="flex flex-col gap-2">{c.errors}</div>}
      </li>
    );
  }

  /**
   * **Every field of a lead's save, said once on its phone card** (P18.95-T1 AC-5, P18.95-T4 AC-1): the sheet
   * can close while a field is still on its way, and its *Saved ✓* would then be said to nobody. A failure
   * comes first, then *Saving…*, then *Saved ✓*; the retry sends each field that failed again, as it went.
   */
  function cardSave(row: Lead): InlineSaveStatusProps {
    const states = SAVING_FIELDS.map((field) => [field, inline.stateOf(saveKey(row, field))] as const);
    const failed = states.filter(([, state]) => state === 'failed').map(([field]) => field);
    const some = (state: InlineSaveState) => states.some(([, now]) => now === state);
    const state: InlineSaveState = failed.length > 0 ? 'failed' : some('saving') ? 'saving' : some('saved') ? 'saved' : 'idle';
    return {
      state,
      onRetry: failed.length > 0 ? () => { for (const field of failed) inline.retry(saveKey(row, field)); } : undefined,
    };
  }

  /**
   * **Closing the sheet leaves the field being typed in first**, as Escape does in *Lead details*: removing a
   * focused box fires no `blur`, so the one field still being typed in would close unsaved.
   */
  function closeSheet() {
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body) active.blur?.();
    setSheetFor(null);
  }

  /**
   * One lead on a phone: **read-only, and a tap away from its edit sheet** (P18.95-T4 AC-1, ADR-0167 §4;
   * UI-016).
   *
   * The lead in words — the name, its type and stage, the next action and its date, the remarks **in full**,
   * nothing cut — under the table heading's own small capitals, label above value. **The name is the card's
   * button**, named *Edit {name}*, and its tap area is the whole card; WhatsApp, 📞, ⋮ and the drag handle sit
   * above it, each its own 44px target, so a tap meant for one never opens the sheet. What the reader typed
   * and has not yet saved shows here as it does in the sheet.
   */
  function renderPhoneCard(entry: { lead: Lead; isDraft: boolean }, index: number) {
    const n = index + 1;
    const c = controlsFor(entry, n);
    const { lead: row, isDraft } = entry;
    const key = rowKey(row);
    const name = isDraft ? row.name : draftOf(row, 'name', row.name);
    const remarks = draftOf(row, 'remarks', row.remarks).trim();
    const day = draftOf(row, 'nextActionDate', row.nextActionDate);
    const note = draftOf(row, 'nextActionNote', row.nextActionNote).trim();
    const next = [day ? formatCalendarDay(day, figures) : '', note].filter(Boolean).join(' · ');
    const stage = stageLabel(row) ?? (row.statusCode ? t.retired({ code: row.statusCode }) : null);
    return (
      <li
        key={key}
        {...dropTarget(row.id, isDraft)}
        className={cn('relative flex flex-col gap-2 border-b border-hairline px-3 py-3 last:border-b-0', dropLook(row.id))}
      >
        <div className="flex items-center gap-1">
          {c.handle && <span className="relative z-10 flex">{c.handle}</span>}
          <span className="w-5 shrink-0 text-base font-semibold text-muted">{n}</span>
          <button
            type="button"
            id={isDraft ? undefined : nameId(row.id)}
            aria-label={isDraft ? t.editNew : t.editWho({ who: name || t.thisLead })}
            aria-haspopup="dialog"
            onClick={() => setSheetFor(key)}
            className={cn(
              'min-w-0 flex-1 break-words text-left text-md font-semibold text-navy',
              // The whole card is the tap, and the focus ring is drawn round the whole card.
              "after:absolute after:inset-0 after:rounded-sm after:content-['']",
              'focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2',
              'focus-visible:after:-outline-offset-2 focus-visible:after:outline-amber',
            )}
          >
            {name || <span className="font-normal text-muted">{t.newLead}</span>}
          </button>
          <span className="relative z-10 flex shrink-0 items-center">{c.whatsapp}{c.call}{c.actions}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span
            className={cn(
              'font-semibold',
              row.type === 'sales' && 'text-amber-ink',
              row.type === 'recruitment' && 'text-navy-soft',
              row.type === null && 'font-normal text-muted',
            )}
          >
            {row.type ? t.types[row.type] : t.noType}
          </span>
          {stage && <span className={cn('rounded-sm px-1.5 py-0.5 font-semibold', stageTint(row, ladderFor(row.type)))}>{stage}</span>}
        </p>
        {(next || remarks) && (
          <dl className="flex flex-col gap-2">
            {next && (
              <div className="flex flex-col gap-0.5">
                <dt className={CARD_LABEL}>{t.columns.nextAction}</dt>
                <dd className="break-words text-sm text-navy">{next}</dd>
              </div>
            )}
            {remarks && (
              <div className="flex flex-col gap-0.5">
                <dt className={CARD_LABEL}>{t.columns.remarks}</dt>
                <dd className="whitespace-pre-wrap break-words text-sm text-navy">{remarks}</dd>
              </div>
            )}
          </dl>
        )}
        {/* The sheet says its own while it is open; this is for once it has closed. */}
        {sheetFor !== key && <InlineSaveStatus {...cardSave(row)} label={name || t.theNewLead} className="relative z-10" />}
        {c.errors.length > 0 && <div className="relative z-10 flex flex-col gap-2">{c.errors}</div>}
      </li>
    );
  }

  /**
   * **The phone's edit sheet** (P18.95-T4 AC-1): the lead's own fields, the ones its row edits, as 44px
   * controls under labels of their own, the remark growing as it is typed. `Modal`, rising from the foot of
   * the screen: the focus in it and held, Escape, the backdrop and **Close** shut it, and the focus goes back
   * to the card. Each field saves as it is left, with its *Saving… → Saved ✓* under it, exactly as a cell does,
   * and a refusal shows here while it is open. *+ Add lead* opens it on a new lead, the name box focused,
   * and it stays open on the same box once the name has made it a lead.
   */
  function renderSheet(entry: { lead: Lead; isDraft: boolean }) {
    const index = rows.findIndex((r) => rowKey(r.lead) === rowKey(entry.lead));
    const c = controlsFor(entry, index + 1, 'sheet');
    const { lead: row, isDraft } = entry;
    return (
      <Modal
        open
        placement="sheet"
        title={isDraft ? t.newLead : t.editWho({ who: row.name || t.thisLead })}
        // An existing lead opens on its title, so no keyboard rises over the sheet until a field is chosen.
        focusDialog={!isDraft}
        onClose={closeSheet}
      >
        <div className="flex flex-col gap-4">
          <Field label={t.columns.name} htmlFor={isDraft ? draftInputId : sheetFieldId('name')}>{c.name()}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t.columns.type} htmlFor={sheetFieldId('type')}>{c.type}</Field>
            <Field label={t.columns.status} htmlFor={sheetFieldId('status')}>{c.status}</Field>
          </div>
          {c.month}
          <Field label={t.columns.remarks} htmlFor={sheetFieldId('remarks')}>{c.remarks}</Field>
          <Field label={t.nextActionDate} htmlFor={sheetFieldId('nextActionDate')}>{c.date}</Field>
          <Field label={t.nextActionNote} htmlFor={sheetFieldId('nextActionNote')}>{c.note}</Field>
          {c.errors.length > 0 && <div className="flex flex-col gap-2">{c.errors}</div>}
          <div className="flex justify-end">
            <Button variant="secondary" className={TAP_HEIGHT} onClick={closeSheet}>{t.close}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  const empty = (
    /* The coaching card has one empty line whatever narrowed it (`Overall.html:10815`). */
    <EmptyState
      variant={narrowed ? 'filtered' : 'empty'}
      title={narrowed || owner ? t.noneMatch : t.noneYet}
    />
  );

  /** A card has no heading to sort from, so the card layout's toolbar says the order in words. */
  const sortChoice = cards && (
    <Select
      aria-label={t.sort.label}
      className={TAP_HEIGHT}
      value={sortValue(sort)}
      onChange={(e) => setSort(SORT_CHOICES.find((c) => sortValue(c.sort) === e.target.value)?.sort ?? null)}
    >
      {SORT_CHOICES.map((c) => <option key={sortValue(c.sort)} value={sortValue(c.sort)}>{t.sort[c.words]}</option>)}
    </Select>
  );

  /**
   * A new *Type* keeps the *Status* filter only where the stage is on its ladder: the two ladders share no
   * stage, so a sales stage under *Recruit* would match nothing, and say nothing about why.
   */
  function chooseType(next: '' | LeadType) {
    setTypeFilter(next);
    if (next && statusFilter && !ladderFor(next).some((s) => s.code === statusFilter)) setStatusFilter('');
  }

  /**
   * **`/leads`' search and its two filters, above the list at every size** (P18.95-T4 AC-2, AC-5; ADR-0167 §4).
   *
   * The coaching card's own controls and words (`Overall.html:4258-4266`) — *Search leads…*, *All types* —
   * with a *Status* filter beside them, and nothing else: the search is sent once the typing settles, each
   * filter as it is chosen, and the server answers them (`GET /leads` `search`, `type`, `statusCode`), so the
   * count and *Show more* are the narrowed list's. *Status* offers the ladder of the type chosen, or both
   * ladders under their names. Drawn whatever the list is doing, so a search whose answer failed can still
   * be changed. On a phone the search takes the row and the two filters share the next, each 44px tall.
   */
  const filterBar = !filters && (
    <div
      role="search"
      aria-label={t.searchAndFilter}
      className="mb-3 flex flex-wrap items-center gap-2.5 max-md:grid max-md:grid-cols-2"
    >
      <TextInput
        type="search"
        aria-label={t.search}
        placeholder={t.searchPlaceholder}
        className={cn('w-56 max-w-full max-md:col-span-2 max-md:w-full', TAP_HEIGHT)}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />
      <Select
        aria-label={t.byType}
        className={cn('max-md:w-full max-md:min-w-0', TAP_HEIGHT)}
        value={typeFilter}
        onChange={(e) => chooseType(e.target.value as '' | LeadType)}
      >
        <option value="">{t.allTypes}</option>
        <option value="sales">{t.types.sales}</option>
        <option value="recruitment">{t.types.recruitment}</option>
      </Select>
      <Select
        aria-label={t.byStatus}
        className={cn('max-md:w-full max-md:min-w-0', TAP_HEIGHT)}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
      >
        <option value="">{t.allStatuses}</option>
        {typeFilter
          ? ladderFor(typeFilter).map((s) => <option key={s.code} value={s.code}>{s.label}</option>)
          : pipelines.map((p) => (
            <optgroup key={p.pipeline} label={t.types[p.pipeline]}>
              {p.statuses.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </optgroup>
          ))}
      </Select>
    </div>
  );

  let body: React.ReactNode;
  if (loadError && !open) {
    body = <ErrorBanner {...loadError} />;
  } else if (!open || configLoading) {
    body = cards
      ? <SkeletonCards count={3} label={t.loadingList({ caption })} />
      : <SkeletonTable caption={caption} columns={columns} rows={5} />;
  } else {
    body = (
      <>
        {filters ? (
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            {/* A finalized session rests them at 0.6, as the prototype's lock does (`Overall.html:1416-1417`). */}
            <TextInput
              type="search"
              aria-label={t.search}
              placeholder={t.searchPlaceholder}
              className={cn('w-56 max-w-full', readOnly && 'opacity-60')}
              value={term}
              disabled={readOnly}
              onChange={(e) => setTerm(e.target.value)}
            />
            <Select
              aria-label={t.byType}
              value={typeFilter}
              disabled={readOnly}
              className={cn(readOnly && 'opacity-60')}
              onChange={(e) => setTypeFilter(e.target.value as '' | LeadType)}
            >
              <option value="">{t.allTypes}</option>
              <option value="sales">{t.types.sales}</option>
              <option value="recruitment">{t.types.recruitment}</option>
            </Select>
            {sortChoice}
            {!readOnly && <Button ref={addButton} onClick={addLead}>{t.add}</Button>}
          </div>
        ) : (
          /* The prototype's toolbar: the count, and the screen's one action (`Overall.html:2791-2794`). */
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {/* Narrowed, the count is what matched — the whole list is not on the screen (P18.95-T4 AC-2). */}
            <p className="text-sm text-muted">{t.count({ n: open.total, narrowed })}</p>
            <div className="flex flex-wrap items-center gap-2.5">
              {sortChoice}
              <Button ref={addButton} onClick={addLead}>{t.add}</Button>
            </div>
          </div>
        )}

        {loadError && <div className="mb-3"><ErrorBanner {...loadError} /></div>}
        {/* A drag the server refused, said once above the list it was made on (P18.8-T7). */}
        {orderError && <div className="mb-3"><ErrorBanner {...orderError} /></div>}

        {cards ? (
          rows.length === 0 ? (
            <div className="rounded-lg border border-card-edge bg-card">{empty}</div>
          ) : (
            <ul role="list" aria-label={caption} className="rounded-lg border border-card-edge bg-card">
              {/* A phone's cards are read and tapped; a tablet's are edited where they stand (P18.95-T4 AC-1, AC-5). */}
              {rows.map(phone ? renderPhoneCard : renderCard)}
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
            <Button variant="secondary" onClick={showMore}>{t.showMore}</Button>
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

        {/* Before the questions below, so a type change asked from the sheet is drawn over it. */}
        {sheetEntry && renderSheet(sheetEntry)}

        {detailsLead && (
          <LeadDetailsDialog
            lead={detailsLead}
            saving={busy[detailsLead.id] === true}
            errors={refusalsOf(detailsLead.id)}
            editedBy={editedByOf(detailsLead)}
            readOnly={readOnly}
            status={(field) => inline.statusOf(saveKey(detailsLead, field))}
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
            ? t.confirm.asOutcome({
              outcome: t.outcomes[confirmOutcome.outcome], who: confirmOutcome.row.name || t.confirm.thisLeadCapital,
            })
            : confirmOutcome?.outcome === 'won'
              ? t.confirm.won({ who: confirmOutcome.row.name || t.thisLead })
              : t.confirm.lost({ who: confirmOutcome?.row.name || t.thisLead })}
          confirmLabel={owner && confirmOutcome
            ? t.confirm.markAs({ outcome: t.outcomes[confirmOutcome.outcome] })
            : confirmOutcome?.outcome === 'won' ? t.menu.markWon : t.menu.markLost}
          onCancel={() => setConfirmOutcome(null)}
          onConfirm={async () => {
            const { row, outcome } = confirmOutcome!;
            setConfirmOutcome(null);
            const saved = await run(row.id, () => setLeadOutcome(row.id, outcome, row.version), { done: moveToClosed });
            if (saved) onNotice?.(t.notices.markedAs({ name: saved.name, outcome: t.outcomes[outcome] }));
          }}
        />

        {/*
          * *Delete {name}?* — the prototype's question without *permanently* and *can't be undone*
          * (`Overall.html:5661`), which would both be false: deleting is soft and audited (I-101).
          */}
        <Dialog
          open={confirmDelete !== null}
          message={t.confirm.delete({ who: confirmDelete?.name || t.thisLead })}
          confirmLabel={t.confirm.deleteLead}
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
          message={t.confirm.type}
          confirmLabel={t.confirm.changeType}
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
  return <div ref={frame} className="min-w-0">{filterBar}{body}</div>;
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

/** Both closed lists, page after page, into state as each lands. `/leads`' compact list reads them too (UI-105). */
export async function loadClosed(
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
export interface ClosedCard {
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
export function ClosedLeads({
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
  const t = useMessages(leadsMessages);
  const cards = [
    { outcome: 'won' as const, title: t.closed.won, card: won, empty: t.closed.noneWon, waiting: t.closed.loadingWon },
    { outcome: 'lost' as const, title: t.closed.lost, card: lost, empty: t.closed.noneLost, waiting: t.closed.loadingLost },
  ];

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-md font-bold text-navy">{t.closed.title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map(({ outcome, title, card: { list, error }, empty, waiting }) => (
          <div key={outcome} className="overflow-hidden rounded-lg border border-card-edge bg-card">
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
                          <span className="truncate text-md font-semibold text-navy">{row.name || t.closed.unnamed}</span>
                          <span className="text-xs text-muted">
                            {t.types[row.type === 'recruitment' ? 'recruitment' : 'sales']}
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
                          {t.closed.reopen}
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
                    <p className="text-xs text-muted">{t.closed.partial({ shown: list.rows.length, total: list.total })}</p>
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
