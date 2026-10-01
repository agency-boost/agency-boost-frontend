'use client';

import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LeadContactDialog, type ContactField } from '@/components/lead-contact-dialog';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Select, TextInput } from '@/components/ui/field';
import { Skeleton, SkeletonTable, SkeletonText } from '@/components/ui/skeleton';
import { INERT_GLYPH, TippedGlyph } from '@/components/ui/tipped-glyph';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDay } from '@/lib/format';
import {
  createLead, deleteLead, listEveryLead, readLead, setLeadOutcome, setLeadStatus, updateLead,
  LEAD_NAME_MIN, type LawfulBasis, type Lead, type LeadOutcome, type LeadQuery, type LeadType,
} from '@/lib/leads';
import { useSession } from '@/lib/session';
import type { LeadStatusRow } from '@/lib/tenant-config';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import { useDebounced } from '@/lib/use-debounced';

/** The four headings the prototype sorts on (`Overall.html:2805-2813`), as `GET /leads` names them. */
type SortKey = Extract<NonNullable<LeadQuery['sort']>, 'name' | 'type' | 'status' | 'dateRegistered'>;

/** Most recently registered on top, which is where the prototype opens (`Overall.html:5432`). */
const DEFAULT_SORT = { key: 'dateRegistered' as const, dir: 'desc' as const };

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

/** A control on the inline row with nothing to write to yet: there, and plainly not live. */
const INERT_CONTROL = 'cursor-not-allowed opacity-40';

/** Every field a lead starts with, so the inline row renders through the same cells as a real one. */
const blankLead = (id: string, name: string): Lead => ({
  id, name, ownerMembershipId: '', type: null, contact: { phone: null, email: null },
  lawfulBasis: null, consentAt: null, statusCode: null, thisMonth: false, committedMonths: [],
  lastEditedBy: null, remarks: null, nextActionDate: null, nextActionNote: null, outcome: null,
  source: null, dateRegistered: null, version: 0, flags: [], overdueDays: null,
});

const without = <T,>(record: Record<string, T>, ...keys: readonly string[]): Record<string, T> => {
  const next = { ...record };
  for (const key of keys) delete next[key];
  return next;
};

/** Newest first — how the closed cards are asked for, and where a lead closed here is put. */
const byRegisteredDesc = (a: Lead, b: Lead) =>
  (b.dateRegistered ?? '').localeCompare(a.dateRegistered ?? '');

/**
 * The leads table — `/leads`, and the coaching session's *Leads* card (P10.1-T4, P11-T8).
 *
 * **The prototype's table and nothing it lacks, except two glyphs** (`Overall.html:2787-2846`,
 * ADR-0063). The client asked for the screen back as the prototype draws it (ADR-0062): no counts
 * strip, no filter card, no pager and nothing under a lead's name. What a hard requirement keeps is
 * in the Actions column — a glyph that opens the contact details and their lawful basis (PDP), and,
 * on a row somebody else changed last, a glyph naming who (ADR-0044).
 *
 * **One table, two toolbars** (AC-12). `/leads` has the prototype's count and *+ Add lead*
 * (`:2791-2794`). The coaching card has a search box and a type filter instead of the count
 * (`:4258-4266`), which is `filters`. It is off unless asked for, and `/leads` never asks: the
 * client chose a leads screen that cannot be searched (ADR-0062), and a test pins it.
 *
 * **Every write is one field, and the server is its only judge.** Which ladder a stage belongs to,
 * whether a lead may be won here, whether contact details may be held at all — the row shows exactly
 * what the server said, in a row of its own beneath the lead, for as long as it stands (F-65).
 */
export function LeadsTable({
  filters = false,
  offerDelete = true,
  caption = 'Your leads',
}: {
  /**
   * The coaching card's search box and type filter in place of the count (`Overall.html:4258-4266`).
   * **Never on `/leads`** — P10.1-T4 AC-12, pinned by the screen's own spec.
   */
  filters?: boolean;
  /**
   * Whether 🗑 is in the Actions column at all. The coaching card has none — its rows end in Won and
   * Lost (`Overall.html:10809-10812`) — and `lead:delete` is the owner's alone, never the coach's
   * (roles-and-permissions §3.7), so P11-T8 turns it off. `/leads` keeps it.
   */
  offerDelete?: boolean;
  /** The table's accessible name. */
  caption?: string;
}) {
  const { config, loading: configLoading } = useTenantConfig();
  const { me } = useSession();
  const myMembership = me?.membership?.membershipId;
  const uid = useId();

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(DEFAULT_SORT);
  const [term, setTerm] = useState('');
  const search = useDebounced(term.trim());
  const [typeFilter, setTypeFilter] = useState<'' | LeadType>('');
  /** Bumped to load the open leads again from page 1 — after a reopen, or a write that shifts the pages. */
  const [reloads, setReloads] = useState(0);

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

  const [contactFor, setContactFor] = useState<string | null>(null);
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
        sort: sort.key,
        dir: sort.dir,
        search: filters && search ? search : undefined,
        type: filters && typeFilter ? typeFilter : undefined,
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
  }, [sort.key, sort.dir, filters, search, typeFilter, reloads]);

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
      loadClosed(outcome, set, isCurrent).catch((err) => {
        if (current) setClosedError((e) => ({ ...e, [outcome]: toDisplayError(err) }));
      });
    }
    return () => { current = false; };
  }, []);

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
   * **A row that leaves takes the reader's place with it** — ✓, ✕ and 🗑 each end with the row gone,
   * and the button that had the focus gone with it, which drops the focus to the top of the page.
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
    setContactFor((shown) => (shown === id ? null : shown));
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
      if (moves.includes(sort.key)) restartIfLoading();
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
   * The lawful basis, and then **the details it was holding up.**
   *
   * The dialog's main path is a phone number typed before the ground for it: the server refuses it
   * (`LEAD_CONSENT_REQUIRED`) and the number stays in its box. Recording the basis is the answer to
   * that refusal, so once it lands the number goes again — at the version the basis left behind — and
   * the refusal leaves only when the number is stored. Leaving it for the reader to retype would put
   * a number on screen that looked saved and was not.
   *
   * **A number still in its box always differs from what is stored**, so there is nothing to compare
   * before sending it. A box put back as stored is cleared as it is left (`commitText`). The stored
   * number changes only by that box's own save, which clears the box, or by somebody else's write —
   * and a row that comes back at a new version drops its typing, while the basis write, pinned at
   * the row's version, is refused rather than landed on details that changed underneath it.
   */
  async function recordLawfulBasis(lead: Lead, value: LawfulBasis | null) {
    // What is in the two boxes now, before the basis is written.
    const typed = { phone: drafts[lead.id]?.phone, email: drafts[lead.id]?.email };
    const saved = await run(lead.id, () => updateLead(lead.id, { lawfulBasis: value }, lead.version));
    if (!saved?.lawfulBasis || (typed.phone === undefined && typed.email === undefined)) return;
    const contact = {
      phone: typed.phone === undefined ? saved.contact.phone : typed.phone.trim() || null,
      email: typed.email === undefined ? saved.contact.email : typed.email.trim() || null,
    };
    await run(lead.id, () => updateLead(lead.id, { contact }, saved.version), { fields: ['phone', 'email'] });
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
    void run(row.id, () => updateLead(row.id, { type }, row.version), { moves: ['type', 'status'] });
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
      const created = await createLead({ name });
      setKeyFor((k) => ({ ...k, [created.id]: key }));
      setOpen((current) => current && {
        rows: [created, ...current.rows.filter((r) => r.id !== created.id)],
        total: current.total + 1,
      });
      setDraft(null);
      forget(key);
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
      await setLeadOutcome(row.id, null, row.version);
      forget(row.id);
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

  const sortable = (label: string, key: SortKey): Column => ({
    label,
    sort: sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
    // A new column starts ascending, as the prototype does (`Overall.html:5694-5707`); the same
    // column reverses.
    onSort: () => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })),
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
    sortable('Registered', 'dateRegistered'),
  ];

  const narrowed = filters && (search !== '' || typeFilter !== '');
  const rows: { lead: Lead; isDraft: boolean }[] = [
    ...(draft ? [{ lead: blankLead(draft.key, draft.name), isDraft: true }] : []),
    ...(open?.rows ?? []).map((lead) => ({ lead, isDraft: false })),
  ];
  const contactLead = open?.rows.find((r) => r.id === contactFor) ?? null;

  /** Enter finishes a remark or a note rather than starting a second line (`Overall.html:5642-5650`). */
  const finishOnEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  function renderLead({ lead: row, isDraft }: { lead: Lead; isDraft: boolean }, index: number) {
    const n = index + 1;
    const ladder = ladderFor(row.type);
    const retired = row.statusCode && !ladder.some((s) => s.code === row.statusCode);
    const saving = busy[row.id] === true;
    /*
     * **Held, never disabled, while a write is in flight** — and on the inline row, which writes
     * nothing but its name until it is a lead. A disabled control drops the focus it holds and is
     * skipped by Tab, so a field left with Tab would send the reader past the next one, or out of the
     * row, while its own save went through. `readOnly` for what is typed, `aria-disabled` and a guard
     * in the handler for the rest — as the contact dialog does. `disabled` stays for what is a state
     * of the lead rather than a moment: no type yet, not on the final stage.
     */
    const locked = saving || isDraft;
    const errors = refusalsOf(row.id);
    const monthAction = row.type === 'recruitment' ? 'Recruit this month' : 'Close this month';
    /*
     * **The reader's own change needs no name** (ADR-0044, as ADR-0063 §1 places it). The payload
     * names a change that was not the owner's; a leader reading a downline's lead they changed
     * themselves is told nothing they do not know.
     */
    const editedBy = row.lastEditedBy && row.lastEditedBy.membershipId !== myMembership
      ? `Last changed by ${row.lastEditedBy.name ?? 'someone in your office'}`
      : null;
    /*
     * **🗑 is the owner's** (`lead:delete` is `own`, roles-and-permissions §3.7): a leader asking to
     * delete a downline's lead is answered *Lead not found* beneath a lead that is plainly there.
     * On their rows it stays in its place, so the glyphs keep the column's rhythm, and says whose it
     * is. The payload carries the owner's membership, not their name — hence *the person who owns*.
     */
    const foreign = !isDraft && row.ownerMembershipId !== myMembership;

    return (
      <Fragment key={keyFor[row.id] ?? row.id}>
        <Row>
          {/* `.row-num` is grey and semibold (`Overall.html:451`) — a quiet ordinal. */}
          <Cell className="font-semibold text-muted">{n}</Cell>

          {/*
            * **The name, and nothing else** (AC-1, `Overall.html:5510-5512`). Everything that was
            * under it went — the attribution to a glyph, the details to a dialog, the flags to the
            * Summary, the refusal to a row of its own. The prototype gives the box no label; it gets
            * a name a screen reader can say and nothing a reader can see.
            */}
          <Cell>
            <TextInput
              id={isDraft ? draftInputId : nameId(row.id)}
              aria-label={`Lead name, row ${n}`}
              density="cell"
              className="w-full"
              value={isDraft ? row.name : draftOf(row, 'name', row.name)}
              placeholder="First Last"
              readOnly={isDraft ? draft?.posting : saving}
              onChange={(e) => (isDraft
                ? changeDraftName(e.target.value)
                : setDraftValue(row.id, 'name', e.target.value))}
              onBlur={() => (isDraft
                ? void submitDraft('blur')
                : commitText(row, 'name', row.name, (name) => ({ name }), ['name']))}
              onKeyDown={(e) => {
                if (isDraft && e.key === 'Enter') void submitDraft('enter');
              }}
            />
          </Cell>

          <Cell>
            {/*
              * **The word is coloured and the cell is not** (F-73). `.type-badge-select` colours the
              * words on the cell's transparent ground (`Overall.html:476-477`), and an unchosen type is
              * the grey, normal-weight placeholder (`:473`) — so Type reads as a word and Status, beside
              * it, as a box. Client, 2026-10-01: Type must not look like Status.
              *
              * Sales is **amber-ink**, not the prototype's amber-dark: at this size amber-dark is
              * 2.99:1 on white and amber-deep 4.34:1, both under the 4.5:1 small text needs.
              * Recruitment is the prototype's navy-soft exactly.
              */}
            <Select
              aria-label={`Type, row ${n}`}
              density="cell"
              className={cn(
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
              <option value="sales">Sales</option>
              <option value="recruitment">Recruitment</option>
            </Select>
          </Cell>

          <Cell>
            {/*
              * **Tinted by where the stage sits on its own ladder** (`statusStyle()`,
              * `Overall.html:5463-5478`), with navy words: not even amber-ink clears 4.5:1 on the
              * mid-rung's 13% amber tint (F-71). Until there is a ladder there is nothing to choose
              * from, and the one option says why (`Overall.html:5447-5455`); the server refuses a
              * stage without one either way.
              */}
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
                void run(row.id, () => setLeadStatus(row.id, code, row.version), { moves: ['status'] });
              }}
            >
              {row.type ? <option value="">Select status</option> : <option value="">Select type first</option>}
              {/*
                * A stage the office has since retired. The snapshot carries **active** stages only,
                * so the code is the truthful fallback — it is what the lead holds (invariant §3).
                */}
              {retired && <option value={row.statusCode!}>{row.statusCode} (retired)</option>}
              {ladder.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
            </Select>
          </Cell>

          <Cell>
            {/*
              * **Written out beside the box** (`.month-check-wrap`, `Overall.html:479-487`) — a close
              * and a recruitment are different promises. **Not until there is a type**
              * (`:5505-5506`, AC-7): a promise has to say which of the two it is.
              */}
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
          </Cell>

          <Cell>
            <AutoGrowTextarea
              aria-label={`Remarks, row ${n}`}
              className={cn('w-full', isDraft && INERT_CONTROL)}
              value={draftOf(row, 'remarks', row.remarks)}
              placeholder="Notes, hot buttons, life events…"
              readOnly={locked}
              onChange={(e) => setDraftValue(row.id, 'remarks', e.target.value)}
              onKeyDown={finishOnEnter}
              onBlur={() => commitText(row, 'remarks', row.remarks, (remarks) => ({ remarks }))}
            />
          </Cell>

          <Cell>
            <div className="flex flex-col gap-0.5">
              <TextInput
                type="date"
                aria-label={`Next action date, row ${n}`}
                density="cell"
                className={cn('w-full', isDraft && INERT_CONTROL)}
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
              <AutoGrowTextarea
                aria-label={`Next action note, row ${n}`}
                className={cn('w-full', isDraft && INERT_CONTROL)}
                value={draftOf(row, 'nextActionNote', row.nextActionNote)}
                placeholder="e.g. Meet at Starbucks"
                readOnly={locked}
                onChange={(e) => setDraftValue(row.id, 'nextActionNote', e.target.value)}
                onKeyDown={finishOnEnter}
                onBlur={() => commitText(row, 'nextActionNote', row.nextActionNote, (nextActionNote) => ({ nextActionNote }))}
              />
            </div>
          </Cell>

          <Cell>
            {/*
              * **The prototype's three glyphs, then ours** (`.row-actions`, `Overall.html:489-498`,
              * `:5540-5546`). ✓ ✕ 🗑 keep their places on every row; the contact glyph and the
              * attribution follow them, so a row that has an attribution shifts nothing a hand is
              * reaching for (ADR-0063 §1–2).
              */}
            <div className="flex items-center gap-px">
              <Button
                variant="icon"
                tone="success"
                disabled={!isTerminal(row)}
                aria-disabled={locked || undefined}
                title={isTerminal(row) ? 'Mark successful' : 'Available once status reaches the final stage'}
                onClick={() => {
                  if (locked) return;
                  setConfirmOutcome({ row, outcome: 'won' });
                }}
              >
                <span aria-hidden="true">✓</span>
                <span className="sr-only">Mark successful</span>
              </Button>
              {/* Lost is allowed at any stage (§3.7); only won is gated. */}
              <Button
                variant="icon"
                tone="alert"
                aria-disabled={locked || undefined}
                className={cn(isDraft && INERT_GLYPH)}
                title="Mark not successful"
                onClick={() => {
                  if (locked) return;
                  setConfirmOutcome({ row, outcome: 'lost' });
                }}
              >
                <span aria-hidden="true">✕</span>
                <span className="sr-only">Mark not successful</span>
              </Button>
              {offerDelete && (foreign ? (
                <TippedGlyph
                  glyph="🗑"
                  name="Delete lead"
                  tip="Only the person who owns this lead can delete it."
                  unavailable
                />
              ) : (
                <Button
                  variant="icon"
                  aria-disabled={locked || undefined}
                  className={cn(isDraft && INERT_GLYPH)}
                  title="Delete lead"
                  onClick={() => {
                    if (locked) return;
                    setConfirmDelete(row);
                  }}
                >
                  <span aria-hidden="true">🗑</span>
                  <span className="sr-only">Delete lead</span>
                </Button>
              ))}
              <Button
                variant="icon"
                aria-disabled={isDraft || undefined}
                className={cn(isDraft && INERT_GLYPH)}
                title="Contact details"
                onClick={() => {
                  if (isDraft) return;
                  setContactFor(row.id);
                }}
              >
                <span aria-hidden="true">☎</span>
                <span className="sr-only">Contact details</span>
              </Button>
              {editedBy && <TippedGlyph glyph="✎" name={editedBy} tip={editedBy} />}
            </div>
          </Cell>

          {/* Grey, as `.registered-cell` has it (`Overall.html:501`). */}
          <Cell className="whitespace-nowrap text-muted">
            {row.dateRegistered
              ? <time dateTime={row.dateRegistered}>{formatDay(row.dateRegistered)}</time>
              : '—'}
          </Cell>
        </Row>

        {/*
          * **A refusal gets a row of its own, and only while it stands** (AC-10, F-65). It was a
          * banner inside the 9rem name cell, which squeezed the words and pushed the row open; here
          * it spans the table under the lead it belongs to. Each refusal leaves when what it refused
          * does — see `run`.
          */}
        {errors.length > 0 && (
          <Row>
            <Cell colSpan={columns.length}>
              <div className="flex flex-col gap-2">
                {errors.map((error) => <ErrorBanner key={`${error.code} ${error.message}`} {...error} />)}
              </div>
            </Cell>
          </Row>
        )}
      </Fragment>
    );
  }

  if (loadError && !open) return <ErrorBanner {...loadError} />;

  if (!open || configLoading) {
    return <SkeletonTable caption={caption} columns={columns} rows={5} />;
  }

  return (
    <>
      {filters ? (
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <TextInput
            type="search"
            aria-label="Search leads"
            placeholder="Search leads…"
            className="w-56"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | LeadType)}
          >
            <option value="">All types</option>
            <option value="sales">Sales</option>
            <option value="recruitment">Recruitment</option>
          </Select>
          <Button ref={addButton} onClick={addLead}>+ Add lead</Button>
        </div>
      ) : (
        /* The prototype's toolbar: the count, and the screen's one action (`Overall.html:2791-2794`). */
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-muted">
            {open.total} active lead{open.total === 1 ? '' : 's'}
          </p>
          <Button ref={addButton} onClick={addLead}>+ Add lead</Button>
        </div>
      )}

      {loadError && <div className="mb-3"><ErrorBanner {...loadError} /></div>}

      {/*
        * **Nine explicit widths and a fixed layout** (`Overall.html:412`, `:426-435`). Without them a
        * long remark widens its own column and every other cell moves. Actions is wider than the
        * prototype's 80px: five 28px glyphs where it has three at 19px, because 19px is not a tap
        * target on a phone.
        */}
      <DataTable
        caption={caption}
        columns={columns}
        density="compact"
        widths={['2rem', '9rem', '7rem', '12rem', '7rem', '12rem', '12rem', '10rem', '6.5rem']}
        tableClassName="min-w-[64rem]"
      >
        {rows.length === 0 ? (
          <Row>
            <Cell colSpan={columns.length}>
              {/* Inside the table card, under its headings, as `.empty-state` is (`Overall.html:2818`). */}
              <EmptyState
                variant={narrowed ? 'filtered' : 'empty'}
                title={narrowed ? 'No leads match.' : 'No leads yet — add your first one above.'}
              />
            </Cell>
          </Row>
        ) : rows.map(renderLead)}
      </DataTable>

      <ClosedLeads
        won={{ list: won, error: closedError.won }}
        lost={{ list: lost, error: closedError.lost }}
        busy={busy}
        refusalsOf={refusalsOf}
        stageLabel={stageLabel}
        onReopen={(row) => void reopen(row)}
      />

      {contactLead && (
        <LeadContactDialog
          lead={contactLead}
          saving={busy[contactLead.id] === true}
          errors={refusalsOf(contactLead.id)}
          editor={{
            value: (field, stored) => draftOf(contactLead, field, stored),
            change: (field, value) => setDraftValue(contactLead.id, field, value),
            commit: (field: ContactField) => {
              const { contact } = contactLead;
              if (field === 'source') {
                commitText(contactLead, 'source', contactLead.source, (source) => ({ source }));
                return;
              }
              // The pair travels together, so saving one never erases the other.
              commitText(contactLead, field, contact[field], (value) => ({
                contact: { phone: contact.phone, email: contact.email, [field]: value },
              }));
            },
          }}
          onLawfulBasis={(value) => void recordLawfulBasis(contactLead, value)}
          onClose={() => setContactFor(null)}
        />
      )}

      {/* The prototype's own questions (`Overall.html:5666-5675`), each naming what its button does (F-72). */}
      <Dialog
        open={confirmOutcome !== null}
        message={confirmOutcome?.outcome === 'won'
          ? `Mark ${confirmOutcome.row.name || 'this lead'} as a successful lead?`
          : `Mark ${confirmOutcome?.row.name || 'this lead'} as not successful? This moves them to the closed list.`}
        confirmLabel={confirmOutcome?.outcome === 'won' ? 'Mark successful' : 'Mark not successful'}
        onCancel={() => setConfirmOutcome(null)}
        onConfirm={() => {
          const { row, outcome } = confirmOutcome!;
          setConfirmOutcome(null);
          void run(row.id, () => setLeadOutcome(row.id, outcome, row.version), { done: moveToClosed });
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
          void run(row.id, () => updateLead(row.id, { type }, row.version), { moves: ['type', 'status'] });
        }}
      />
    </>
  );
}

/** Both closed lists, page after page, into state as each lands. */
async function loadClosed(
  outcome: LeadOutcome,
  set: React.Dispatch<React.SetStateAction<List | null>>,
  isCurrent: () => boolean,
) {
  await listEveryLead(
    { outcome, sort: 'dateRegistered', dir: 'desc' },
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
  onReopen: (row: Lead) => void;
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
                            {row.type === 'recruitment' ? 'Recruitment' : 'Sales'}
                            {stageLabel(row) ? ` · ${stageLabel(row)}` : ''}
                          </span>
                        </span>
                        <button
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
                        </button>
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
