'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Page } from '@/components/page';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';
import { Dialog } from '@/components/ui/dialog';
import { KpiTile } from '@/components/ui/kpi-tile';
import { formatDay } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Button, Card, ErrorBanner, Field, FieldRow, Select, TextInput,
} from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  createLead, deleteLead, listLeads, readLead, readLeadSummary, setLeadOutcome, setLeadStatus,
  updateLead, flagLabel, monthLabel, FLAG_LABEL, LAWFUL_BASIS_LABEL,
  type Lead, type LeadFlag, type LeadOutcome, type LeadQuery, type LeadSummary, type LeadType,
} from '@/lib/leads';
import { useTenantConfig } from '@/lib/tenant-config-cache';
import type { LeadStatusRow } from '@/lib/tenant-config';

/**
 * Leads Management (P7-T2 + P7-T3) — `Overall.html:2787-2846`.
 *
 * **The two tasks ship together because the screen's busiest cell is the status select, and
 * setting a status is a *move* — P7-T3's, by ADR-0045.** A leads table without it is a table
 * nobody can do the work in, and P7-T1's record could not be opened in a browser at all
 * (P7-T2 AC-8).
 *
 * **Search, filters and paging are a Fill.** The prototype's busiest screen has none of them: it
 * renders every row, unsearchable, and an agent with two hundred leads scrolls. Its footnote also
 * promises *"Sales leads first, then Recruitment"*, which its own code does not do — so the code
 * wins, sorting is single-key, and the footnote is not reproduced (P7-T2 AC-1, AC-2).
 *
 * **Every write is one field, and a refusal lands on its own row.** The server is the only judge
 * of what may be written — which ladder a stage belongs to, whether a lead may be won here,
 * whether these contact details may be held at all — and the row shows exactly what it said.
 */

type SortKey = NonNullable<LeadQuery['sort']>;

interface Filters {
  search: string;
  type: '' | LeadType | 'unassigned';
  statusCode: string;
  outcome: 'open' | LeadOutcome | '';
  attention: '' | NonNullable<LeadQuery['attention']>;
}

const NO_FILTERS: Filters = {
  search: '', type: '', statusCode: '', outcome: 'open', attention: '',
};

export default function LeadsPage() {
  const { config, loading: configLoading } = useTenantConfig();

  const [pageData, setPageData] = useState<{ rows: Lead[]; total: number; page: number; pageSize: number } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [counts, setCounts] = useState<LeadSummary | null>(null);

  // What is being typed, which is not yet what is being asked for: the search runs on submit
  // rather than on every keystroke, so a long name is one request and not eleven.
  const [form, setForm] = useState<Filters>(NO_FILTERS);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'dateRegistered', dir: 'desc' });
  const [page, setPage] = useState(1);

  /** In-flight text, per row and field. The row keeps showing what was typed while it saves. */
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [rowError, setRowError] = useState<Record<string, ApiError>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /**
   * The two questions this screen has to ask, each held until answered.
   *
   * They were `window.confirm`, which the prototype deliberately does not use — it built `.modal-box`
   * for exactly these (`Overall.html:539-553`) because the browser's dialog says OK and Cancel whatever
   * was asked, cannot be read in the page's voice, and arrives on a phone as a system sheet.
   */
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
  const [confirmType, setConfirmType] = useState<{ row: Lead; type: LeadType | null } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listLeads({
        search: filters.search || undefined,
        type: filters.type || undefined,
        statusCode: filters.statusCode || undefined,
        outcome: filters.outcome || undefined,
        attention: filters.attention || undefined,
        sort: sort.key,
        dir: sort.dir,
        page,
      });
      setPageData(result);
      setDrafts({});
      /*
       * **Beside the page, not after it.** The counts answer *what is waiting for me* and the page
       * answers *what am I looking at*; asking for them in sequence would make the strip arrive a
       * round trip after the table it sits above.
       */
      readLeadSummary().then(setCounts).catch(() => setCounts(null));
    } catch (err) {
      setError(toDisplayError(err));
      setPageData(null);
    }
  }, [filters, sort, page]);

  useEffect(() => { void load(); }, [load]);

  const statuses = useMemo(() => config?.leadPipelines ?? [], [config]);
  const laddersFor = useCallback(
    (type: LeadType | null): LeadStatusRow[] =>
      (type ? statuses.find((p) => p.pipeline === type)?.statuses ?? [] : []),
    [statuses],
  );

  const isTerminal = useCallback((row: Lead) => {
    if (!row.statusCode) return false;
    return laddersFor(row.type).find((s) => s.code === row.statusCode)?.isTerminal ?? false;
  }, [laddersFor]);

  function replaceRow(next: Lead) {
    setPageData((current) => (current
      ? { ...current, rows: current.rows.map((r) => (r.id === next.id ? next : r)) }
      : current));
  }

  /**
   * One write, and whatever the server says about it, on this row.
   *
   * **A refusal that means the row itself has changed re-reads it.** `LEAD_ALREADY_CLOSED` and
   * `VERSION_CONFLICT` are somebody else's act — a second tab, or a leader in a coaching session —
   * so the screen catches up rather than going on showing a lead the server no longer holds. Every
   * other refusal leaves the typing alone: re-reading a name the server rejected as too short would
   * throw away what was typed and tell the person nothing.
   */
  async function run(id: string, write: () => Promise<Lead>) {
    setBusy((b) => ({ ...b, [id]: true }));
    setRowError((e) => { const next = { ...e }; delete next[id]; return next; });
    try {
      replaceRow(await write());
      setDrafts((d) => { const next = { ...d }; delete next[id]; return next; });
    } catch (err) {
      const shown = toDisplayError(err);
      setRowError((e) => ({ ...e, [id]: shown }));
      if (shown.code === 'LEAD_ALREADY_CLOSED' || shown.code === 'VERSION_CONFLICT') {
        try {
          replaceRow(await readLead(id));
          /*
           * **And the typing goes with it.** Leaving a draft sitting on top of a reloaded row
           * would show the reader their own words over a record that says something else — and
           * the next save would succeed, because the version is now current, silently overwriting
           * the change this refusal exists to protect. The banner says what happened; the row
           * says what is stored.
           */
          setDrafts((d) => { const next = { ...d }; delete next[id]; return next; });
        } catch { /* the banner already says what happened */ }
      }
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  function draftOf(row: Lead, field: string, stored: string | null) {
    return drafts[row.id]?.[field] ?? stored ?? '';
  }

  function setDraftValue(id: string, field: string, value: string) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  }

  /** Commit a text field on blur, and only when it actually changed. */
  function commitText(row: Lead, field: string, stored: string | null, body: (value: string | null) => Record<string, unknown>) {
    const typed = drafts[row.id]?.[field];
    if (typed === undefined) return;
    const trimmed = typed.trim();
    if (trimmed === (stored ?? '')) return;
    void run(row.id, () => updateLead(row.id, body(trimmed === '' ? null : trimmed), row.version));
  }

  /**
   * Changing the ladder clears the rung and the commitment, so it asks first.
   *
   * The two pipelines share no stage and the server clears both — the prototype does the same
   * (`leads-management.md` §4) and does it silently, which is the part not reproduced.
   */
  function changeType(row: Lead, next: '' | LeadType) {
    const type = next === '' ? null : next;
    if (type === row.type) return;
    // Only worth asking when there is something to lose.
    if (row.statusCode || row.thisMonth) {
      setConfirmType({ row, type });
      return;
    }
    void run(row.id, () => updateLead(row.id, { type }, row.version));
  }

  const sortable = (label: string, key: SortKey): Column => ({
    label,
    sort: sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
    onSort: () => {
      setPage(1);
      // A new column starts ascending, as the prototype does; the same column reverses.
      setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    },
  });

  const columns: readonly Column[] = [
    { label: 'Row', visuallyHidden: true },
    sortable('Lead name', 'name'),
    'Type',
    'Status',
    'This month',
    'Remarks',
    sortable('Next action', 'nextActionDate'),
    { label: 'Actions', visuallyHidden: true },
    sortable('Registered', 'dateRegistered'),
  ];

  const rows = pageData?.rows ?? [];
  const filtered = filters.search !== '' || filters.type !== '' || filters.statusCode !== ''
    || filters.attention !== '' || filters.outcome !== 'open';
  const lastPage = pageData ? Math.max(1, Math.ceil(pageData.total / pageData.pageSize)) : 1;

  return (
    <Page
      title="Leads Management"
      subtitle="Track and follow up on your sales and recruitment leads."
      permission="lead:read"
    >
      {counts && <Counts counts={counts} />}

      {adding && (
        <AddLead
          onCancel={() => setAdding(false)}
          onAdded={() => { setAdding(false); setPage(1); void load(); }}
        />
      )}

      <Card className="mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); setFilters(form); }}
        >
          <FieldRow>
            <Field label="Search" htmlFor="lead-search" hint="Over the name and the remarks.">
              <TextInput
                id="lead-search"
                value={form.search}
                placeholder="Name or remarks"
                onChange={(e) => setForm({ ...form, search: e.target.value })}
              />
            </Field>
            <Field label="Type" htmlFor="lead-filter-type">
              <Select
                id="lead-filter-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Filters['type'] })}
              >
                <option value="">All types</option>
                <option value="sales">Sales</option>
                <option value="recruitment">Recruitment</option>
                <option value="unassigned">No type yet</option>
              </Select>
            </Field>
            <Field label="Stage" htmlFor="lead-filter-status">
              <Select
                id="lead-filter-status"
                value={form.statusCode}
                onChange={(e) => setForm({ ...form, statusCode: e.target.value })}
              >
                <option value="">Any stage</option>
                {statuses.map((pipeline) => (
                  <optgroup
                    key={pipeline.pipeline}
                    label={pipeline.pipeline === 'sales' ? 'Sales' : 'Recruitment'}
                  >
                    {pipeline.statuses.map((s) => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Show" htmlFor="lead-filter-outcome">
              <Select
                id="lead-filter-outcome"
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value as Filters['outcome'] })}
              >
                <option value="open">Open leads</option>
                <option value="won">Successful</option>
                <option value="lost">Not successful</option>
                <option value="">Everything</option>
              </Select>
            </Field>
            <Field label="Needs attention" htmlFor="lead-filter-attention">
              <Select
                id="lead-filter-attention"
                value={form.attention}
                onChange={(e) => setForm({ ...form, attention: e.target.value as Filters['attention'] })}
              >
                <option value="">Anything</option>
                <option value="overdue">Overdue</option>
                <option value="no-next-action">No next action</option>
                <option value="no-remarks">No remarks</option>
              </Select>
            </Field>
            <FieldRow.Actions>
              <Button type="submit">Search</Button>
              <Button
                variant="secondary"
                onClick={() => { setForm(NO_FILTERS); setFilters(NO_FILTERS); setPage(1); }}
              >
                Clear
              </Button>
            </FieldRow.Actions>
          </FieldRow>
        </form>
      </Card>

      {error && <ErrorBanner {...error} />}

      {(pageData === null && !error) || configLoading ? (
        <SkeletonTable caption="Your leads" columns={columns} rows={5} />
      ) : null}

      {pageData && rows.length === 0 && (
        <div className="rounded-lg border border-hairline bg-card">
          <EmptyState
            variant={filtered ? 'filtered' : 'empty'}
            title={filtered
              ? 'No leads match what you asked for.'
              : 'No leads yet — add your first one above.'}
            action={filtered
              ? (
                <Button
                  variant="secondary"
                  onClick={() => { setForm(NO_FILTERS); setFilters(NO_FILTERS); setPage(1); }}
                >
                  Clear the filters
                </Button>
              )
              : <Button onClick={() => setAdding(true)}>+ Add lead</Button>}
          />
        </div>
      )}

      {pageData && rows.length > 0 && (
        <>
          <Toolbar
            total={pageData.total}
            openOnly={filters.outcome === 'open'}
            counts={counts}
            active={filters.attention}
            onAttention={(flag) => {
              const next = { ...NO_FILTERS, attention: flag };
              setForm(next);
              setFilters(next);
              setPage(1);
            }}
            onAdd={() => setAdding((open) => !open)}
            adding={adding}
          />

          {/*
            * **Nine explicit widths and a fixed layout** (`Overall.html:412`, `:426-435`,
            * markup `:2799-2802`). Without them a long remark widens its own column and every other
            * cell in the table moves, which in an inline-editable list means the control you were
            * reaching for is no longer where it was.
            */}
          <DataTable
            caption="Your leads"
            columns={columns}
            density="compact"
            widths={['2rem', '9rem', '7rem', '12rem', '7rem', '13rem', '13rem', '5.5rem', '6.5rem']}
            tableClassName="min-w-[64rem]"
          >
            {rows.map((row, index) => {
              const ladder = laddersFor(row.type);
              const retired = row.statusCode && !ladder.some((s) => s.code === row.statusCode);
              const saving = busy[row.id] === true;
              const closed = row.outcome !== null;
              // Two strings, deliberately: the checkbox is a promise the agent makes — *Close this
              // month* — and the chip is the state that promise puts the lead in. One string for
              // both would give the chip and the control the same accessible name.
              const monthAction = row.type === 'recruitment' ? 'Recruit this month' : 'Close this month';
              const monthChip = row.type === 'recruitment' ? 'Recruiting this month' : 'Closes this month';

              return (
                <Row key={row.id}>
                  <Cell className="text-sm text-muted">
                    {(pageData.page - 1) * pageData.pageSize + index + 1}
                  </Cell>

                  <Cell className="min-w-[12rem]">
                    <TextInput
                      aria-label={`Lead name, row ${index + 1}`}
                      density="cell"
                      className="w-full"
                      value={draftOf(row, 'name', row.name)}
                      placeholder="First Last"
                      disabled={saving}
                      onChange={(e) => setDraftValue(row.id, 'name', e.target.value)}
                      onBlur={() => commitText(row, 'name', row.name, (name) => ({ name }))}
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {row.thisMonth && <StatusPill status="success" label={monthChip} />}
                      {row.flags.map((flag) => (
                        <StatusPill key={flag} status="alert" label={flagLabel(flag, row.overdueDays)} />
                      ))}
                      {/*
                        * **The exit criterion, and it is checked here** (P7-T7 AC-2). A leader may
                        * write a downline's lead; the agent has to be able to tell that work from
                        * their own. Two columns rather than a flag — `updatedBy` differing from
                        * `ownerMembershipId` is the whole signal (ADR-0044).
                        */}
                      {row.lastEditedBy && (
                        <StatusPill
                          status="neutral"
                          label={`Edited by ${row.lastEditedBy.name ?? 'someone in your office'}`}
                        />
                      )}
                      {row.outcome && (
                        <StatusPill
                          status={row.outcome === 'won' ? 'success' : 'alert'}
                          label={row.outcome === 'won' ? 'Successful' : 'Not successful'}
                        />
                      )}
                      <Button
                        variant="inline"
                        aria-expanded={expanded === row.id}
                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      >
                        {expanded === row.id ? 'Hide details' : 'Details'}
                      </Button>
                    </div>
                    {rowError[row.id] && (
                      <div className="mt-2">
                        <ErrorBanner {...rowError[row.id]} />
                      </div>
                    )}
                    {expanded === row.id && (
                      <Details
                        row={row}
                        saving={saving}
                        draftOf={draftOf}
                        setDraftValue={setDraftValue}
                        commitText={commitText}
                        onLawfulBasis={(value) => run(row.id, () => updateLead(row.id, { lawfulBasis: value }, row.version))}
                      />
                    )}
                  </Cell>

                  <Cell>
                    {/*
                      * **The ladder's colour is the ground, and the text stays navy.**
                      * `.type-badge-select` (`Overall.html:476-477`) colours the words — amber for
                      * sales, navy-soft for recruitment — and at the 12.5px this table uses that is
                      * `4.34:1` for the darkest amber in the palette, under the 4.5:1 small text
                      * needs. It read as grey on white. Same answer as the Status column beside it:
                      * tint the cell, keep the word readable (F-71).
                      */}
                    <Select
                      aria-label={`Type, row ${index + 1}`}
                      density="cell"
                      className={cn(
                        'font-semibold',
                        row.type === 'sales' && 'bg-amber/[0.13] text-navy',
                        row.type === 'recruitment' && 'bg-navy-soft/[0.09] text-navy',
                        row.type === null && 'text-muted',
                      )}
                      value={row.type ?? ''}
                      disabled={saving || closed}
                      onChange={(e) => changeType(row, e.target.value as '' | LeadType)}
                    >
                      <option value="">Select type</option>
                      <option value="sales">Sales</option>
                      <option value="recruitment">Recruitment</option>
                    </Select>
                  </Cell>

                  <Cell>
                    {/*
                      * **Tinted by where the stage sits on its own ladder** (`statusStyle()`,
                      * `Overall.html:5463-5478`): red at the first rung, green at the last, and a
                      * middle rung wearing its ladder's colour. It is how a leader reads a column of
                      * twenty leads without reading twenty stage names.
                      *
                      * **The text stays navy, unlike the prototype's.** At 12.5px amber on its own
                      * tint is 2.8:1, and the darkest amber in the palette still misses 4.5:1 — so
                      * here the tint is a background and the words carry the meaning (F-71).
                      */}
                    <Select
                      aria-label={`Status, row ${index + 1}`}
                      density="cell"
                      className={cn('font-semibold', stageTint(row, ladder))}
                      value={row.statusCode ?? ''}
                      // The prototype disables this until a ladder is chosen, and it is right to:
                      // a stage means nothing until we know which of the two it belongs to. The
                      // server refuses it as well — this is convenience, not the rule.
                      disabled={saving || closed || !row.type}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        void run(row.id, () => setLeadStatus(row.id, e.target.value, row.version));
                      }}
                    >
                      <option value="">No status yet</option>
                      {/*
                        * A stage the office has since retired. The snapshot carries **active**
                        * stages only, so there is no label to show and the code is the truthful
                        * fallback — it is what the lead holds. Archived configuration stays
                        * readable so history renders (invariant §3); it is not writable, and the
                        * server refuses a move onto one.
                        */}
                      {retired && (
                        <option value={row.statusCode!}>{row.statusCode} (retired)</option>
                      )}
                      {ladder.map((s) => (
                        <option key={s.code} value={s.code}>{s.label}</option>
                      ))}
                    </Select>
                  </Cell>

                  <Cell>
                    {/*
                      * **The promise is written out beside the box** (`.month-check-wrap`,
                      * `Overall.html:479-487`). It was `sr-only`, so a sighted reader had a bare
                      * checkbox in a column headed *This month* and no way to know whether ticking it
                      * promised a close or a recruitment — which are different promises.
                      */}
                    <label className="flex items-start gap-1.5 text-xs leading-tight text-muted">
                      <input
                        type="checkbox"
                        className="mt-px h-[13px] w-[13px] shrink-0 accent-success"
                        checked={row.thisMonth}
                        disabled={saving || closed}
                        onChange={(e) => run(row.id, () => updateLead(row.id, { thisMonth: e.target.checked }, row.version))}
                      />
                      {monthAction}
                    </label>
                  </Cell>

                  <Cell className="min-w-[12rem]">
                    <AutoGrowTextarea
                      aria-label={`Remarks, row ${index + 1}`}
                      className="w-full"
                      value={draftOf(row, 'remarks', row.remarks)}
                      placeholder="Notes, hot buttons, life events…"
                      disabled={saving}
                      onChange={(e) => setDraftValue(row.id, 'remarks', e.target.value)}
                      onBlur={() => commitText(row, 'remarks', row.remarks, (remarks) => ({ remarks }))}
                    />
                  </Cell>

                  <Cell className="min-w-[11rem]">
                    <TextInput
                      type="date"
                      aria-label={`Next action date, row ${index + 1}`}
                      density="cell"
                      className="w-full"
                      value={draftOf(row, 'nextActionDate', row.nextActionDate)}
                      disabled={saving}
                      onChange={(e) => {
                        setDraftValue(row.id, 'nextActionDate', e.target.value);
                        const value = e.target.value || null;
                        void run(row.id, () => updateLead(row.id, { nextActionDate: value }, row.version));
                      }}
                    />
                    <TextInput
                      aria-label={`Next action note, row ${index + 1}`}
                      density="cell"
                      className="mt-0.5 w-full"
                      value={draftOf(row, 'nextActionNote', row.nextActionNote)}
                      placeholder="e.g. Meet at Starbucks"
                      disabled={saving}
                      onChange={(e) => setDraftValue(row.id, 'nextActionNote', e.target.value)}
                      onBlur={() => commitText(row, 'nextActionNote', row.nextActionNote, (nextActionNote) => ({ nextActionNote }))}
                    />
                  </Cell>

                  <Cell>
                    {/*
                      * **Glyphs, not words** (`.row-actions`, `Overall.html:489-498`). Three actions
                      * spelled out are wider than any data in the row; grey at rest with the hover
                      * carrying the meaning — green where it succeeds, red where it does not. Each
                      * keeps its `sr-only` name, so nothing is lost to a reader who cannot see it.
                      */}
                    <div className="flex items-center gap-px">
                      {closed ? (
                        <Button
                          variant="inline"
                          disabled={saving}
                          onClick={() => run(row.id, () => setLeadOutcome(row.id, null, row.version))}
                        >
                          ↺ Move to active
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="icon"
                            tone="success"
                            disabled={saving || !isTerminal(row)}
                            title={isTerminal(row)
                              ? 'Mark successful'
                              : 'Available once the stage that closes this pipeline is reached'}
                            onClick={() => run(row.id, () => setLeadOutcome(row.id, 'won', row.version))}
                          >
                            <span aria-hidden="true">✓</span>
                            <span className="sr-only">Mark successful</span>
                          </Button>
                          {/* Lost is allowed at any stage (§3.7); only won is gated. */}
                          <Button
                            variant="icon"
                            tone="alert"
                            disabled={saving}
                            title="Mark not successful"
                            onClick={() => run(row.id, () => setLeadOutcome(row.id, 'lost', row.version))}
                          >
                            <span aria-hidden="true">✕</span>
                            <span className="sr-only">Mark not successful</span>
                          </Button>
                        </>
                      )}
                      <Button
                        variant="icon"
                        disabled={saving}
                        title="Delete"
                        onClick={() => setConfirmDelete(row)}
                      >
                        <span aria-hidden="true">🗑</span>
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </Cell>

                  <Cell className="whitespace-nowrap text-muted">
                    {row.dateRegistered
                      ? (
                        <time dateTime={row.dateRegistered}>{formatDay(row.dateRegistered)}</time>
                      )
                      : '—'}
                  </Cell>
                </Row>
              );
            })}
          </DataTable>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={pageData.page <= 1}
              onClick={() => setPage(pageData.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={pageData.page >= lastPage}
              onClick={() => setPage(pageData.page + 1)}
            >
              Next
            </Button>
            <span className="text-sm text-muted">
              Page {pageData.page} of {lastPage} · {pageData.pageSize} per page
            </span>
          </div>
        </>
      )}

      <Dialog
        open={confirmDelete !== null}
        message={`Delete ${confirmDelete?.name || 'this lead'}? It stops appearing here — nothing is erased, and it stays recoverable.`}
        confirmLabel="Delete lead"
        tone="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          const row = confirmDelete!;
          setConfirmDelete(null);
          setBusy((b) => ({ ...b, [row.id]: true }));
          try {
            await deleteLead(row.id);
            await load();
          } catch (err) {
            setRowError((e) => ({ ...e, [row.id]: toDisplayError(err) }));
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
          void run(row.id, () => updateLead(row.id, { type }, row.version));
        }}
      />
    </Page>
  );
}

/**
 * What is waiting for the reader, above the rows it is counted from (P7-T6).
 *
 * **Every number is a link into the rows behind it.** A strip that says *3 overdue* and leaves
 * somebody to reconstruct the filter is a strip that gets read once — and the attention counts are
 * keyed by exactly the value `?attention=` takes, so the link cannot drift from the number.
 *
 * **The two recruitment figures only appear for somebody who has recruitment leads.** They are the
 * metric registry's `RECRUITMENT_PIPELINE_NOW` and `RECRUITMENT_EXPECTED_TO_CLOSE`, whose proper
 * home is the Owner's Overview in Phase 14; here they are the recruiting half of the reader's own
 * work, and on a purely sales agent's screen two zeroes would be noise.
 */
/**
 * Where this stage sits on **its own** ladder, as a tint.
 *
 * `statusStyle()` (`Overall.html:5463-5478`): the first rung is alert — nothing has happened yet — the
 * last is success, and a rung in between wears its ladder's colour, amber for sales and navy-soft for
 * recruitment. Rank is read from the ladder the lead is actually on, because a sales rank 2 and a
 * recruitment rank 2 are not the same distance from anywhere.
 *
 * **The text stays navy and only the ground changes.** The prototype colours the words, and at the
 * 12.5px this table uses no amber in the palette reaches 4.5:1 on its own tint (F-71). The stage name
 * is in the box either way, so nothing depends on the colour.
 */
function stageTint(row: Lead, ladder: readonly { code: string }[]): string {
  if (!row.statusCode || ladder.length === 0) return 'text-muted';
  const at = ladder.findIndex((s) => s.code === row.statusCode);
  if (at === -1) return 'text-muted';
  if (at === 0) return 'bg-alert/[0.08] text-navy';
  if (at === ladder.length - 1) return 'bg-success/10 text-navy';
  return row.type === 'recruitment' ? 'bg-navy-soft/[0.09] text-navy' : 'bg-amber/[0.13] text-navy';
}

function Counts({ counts }: { counts: LeadSummary }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile label="Open" value={counts.open} />
      <KpiTile label="Promised this month" value={counts.committedThisMonth} />
      {counts.recruitmentPipelineNow > 0 && (
        <>
          <KpiTile label="Recruitment pipeline" value={counts.recruitmentPipelineNow} />
          <KpiTile label="Expected to close" value={counts.recruitmentExpectedToClose} />
        </>
      )}
    </div>
  );
}

/**
 * The prototype's toolbar: the count on the left, the screen's own action on the right, **directly
 * above the table** (`Overall.html:391-394`, `:2791-2794`).
 *
 * What sat between the title and the first row was a filter card, a bare count paragraph and a counts
 * card — three stacked blocks, so on a laptop a reader scrolled to reach their leads. The filters are a
 * registered Fill (L-28) and stay; the count and the attention chips come here, which is where the
 * prototype puts the one thing it has.
 *
 * **The attention chips belong here rather than in the tile strip.** They are filters, not figures: each
 * narrows the table below to exactly the rows it counted, and `aria-pressed` says which one is on.
 */
function Toolbar({
  total,
  openOnly,
  counts,
  active,
  onAttention,
  onAdd,
  adding,
}: {
  total: number;
  openOnly: boolean;
  counts: LeadSummary | null;
  active: '' | LeadFlag;
  onAttention: (flag: LeadFlag) => void;
  onAdd: () => void;
  adding: boolean;
}) {
  const flags = counts
    ? (Object.keys(FLAG_LABEL) as LeadFlag[]).filter((f) => counts.attention[f] > 0)
    : [];

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm text-muted">
          {total} active lead{total === 1 ? '' : 's'}
          {openOnly ? '' : ' shown'}
        </p>
        {flags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {flags.map((flag) => (
              <Button
                key={flag}
                variant={active === flag ? 'secondary' : 'inline'}
                aria-pressed={active === flag}
                onClick={() => onAttention(flag)}
              >
                {counts!.attention[flag]} {FLAG_LABEL[flag].toLowerCase()}
              </Button>
            ))}
          </div>
        )}
      </div>
      <Button onClick={onAdd} aria-expanded={adding}>+ Add lead</Button>
    </div>
  );
}

/**
 * The fields a table has no room for, and the one that has to be answered before two of them
 * may be stored at all.
 *
 * **The lawful basis is not a formality.** A phone number or an email belongs to somebody who
 * never signed up to this platform, and UU 27/2022 asks on what ground it is held. The server
 * refuses the details without it, and the refusal lands on this row.
 */
function Details({
  row,
  saving,
  draftOf,
  setDraftValue,
  commitText,
  onLawfulBasis,
}: {
  row: Lead;
  saving: boolean;
  draftOf: (row: Lead, field: string, stored: string | null) => string;
  setDraftValue: (id: string, field: string, value: string) => void;
  commitText: (row: Lead, field: string, stored: string | null, body: (value: string | null) => Record<string, unknown>) => void;
  onLawfulBasis: (value: string | null) => void;
}) {
  return (
    <div className="mt-3 rounded-md border border-hairline bg-base p-3">
      <FieldRow>
        <Field
          label="Why you may hold these"
          htmlFor={`basis-${row.id}`}
          hint="Required before a phone number or an email is stored."
        >
          <Select
            id={`basis-${row.id}`}
            value={row.lawfulBasis ?? ''}
            disabled={saving}
            onChange={(e) => onLawfulBasis(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">Not recorded</option>
            {(Object.keys(LAWFUL_BASIS_LABEL) as (keyof typeof LAWFUL_BASIS_LABEL)[]).map((basis) => (
              <option key={basis} value={basis}>{LAWFUL_BASIS_LABEL[basis]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Phone" htmlFor={`phone-${row.id}`}>
          <TextInput
            id={`phone-${row.id}`}
            value={draftOf(row, 'phone', row.contact.phone)}
            disabled={saving}
            onChange={(e) => setDraftValue(row.id, 'phone', e.target.value)}
            onBlur={() => commitText(row, 'phone', row.contact.phone, (phone) => ({
              contact: { phone, email: row.contact.email },
            }))}
          />
        </Field>
        <Field label="Email" htmlFor={`email-${row.id}`}>
          <TextInput
            id={`email-${row.id}`}
            type="email"
            value={draftOf(row, 'email', row.contact.email)}
            disabled={saving}
            onChange={(e) => setDraftValue(row.id, 'email', e.target.value)}
            onBlur={() => commitText(row, 'email', row.contact.email, (email) => ({
              contact: { phone: row.contact.phone, email },
            }))}
          />
        </Field>
        <Field label="Where they came from" htmlFor={`source-${row.id}`}>
          <TextInput
            id={`source-${row.id}`}
            value={draftOf(row, 'source', row.source)}
            placeholder="e.g. Referral from Desi"
            disabled={saving}
            onChange={(e) => setDraftValue(row.id, 'source', e.target.value)}
            onBlur={() => commitText(row, 'source', row.source, (source) => ({ source }))}
          />
        </Field>
      </FieldRow>

      {/*
        * What was promised, and when (P7-T5).
        *
        * **The rollover is visible here rather than anywhere else.** The tick box above shows the
        * *current* month, and it unticks itself when the month turns because nothing stores it —
        * so this line is what answers *did they do what they said* afterwards. A lead carried from
        * one month into the next shows both, which is the thing worth noticing about it.
        */}
      {row.committedMonths.length > 0 && (
        <p className="mt-3 text-sm text-muted">
          Promised for {row.committedMonths.map(monthLabel).join(' · ')}
        </p>
      )}
    </div>
  );
}

/** A new lead: a name, and the ladder it is on. Everything else is edited on the row. */
function AddLead({ onCancel, onAdded }: { onCancel: () => void; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'' | LeadType>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  return (
    <Card className="mb-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await createLead({ name: name.trim(), type: type === '' ? null : type });
            onAdded();
          } catch (err) {
            setError(toDisplayError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <FieldRow>
          <Field label="Lead name" htmlFor="new-lead-name">
            <TextInput
              id="new-lead-name"
              value={name}
              placeholder="First Last"
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field
            label="Type"
            htmlFor="new-lead-type"
            hint="Can be set later — the stage waits for it."
          >
            <Select
              id="new-lead-type"
              value={type}
              disabled={busy}
              onChange={(e) => setType(e.target.value as '' | LeadType)}
            >
              <option value="">Select type</option>
              <option value="sales">Sales</option>
              <option value="recruitment">Recruitment</option>
            </Select>
          </Field>
          <FieldRow.Actions>
            <Button type="submit" disabled={busy}>Add lead</Button>
            <Button variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>
          </FieldRow.Actions>
        </FieldRow>
        {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
      </form>
    </Card>
  );
}
