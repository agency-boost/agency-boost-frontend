'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Modal } from '@/components/ui/modal';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { ADMIN_TARGET, ChoicePill, type ChoiceOption } from '@/components/ui/rows-and-sheets';
import { kept } from '@/i18n/kept';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminAuditMessages } from '@/i18n/messages/admin-audit';
import { adminLayoutMessages } from '@/i18n/messages/admin-layout';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import {
  insurersOf, listCompanies, listTenants, readAudit,
  type AuditFacets, type AuditGroup, type AuditQuery, type Company, type Kpm,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatDateTime, formatDayRange, OFFICE_TIME_ZONE } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { useQuery, type Query } from '@/lib/use-query';

/**
 * Rows written before the Company template rename (ADR-0023), shown under the new name — renamed here and never in the
 * database: `auditLog` is append-only evidence, and a record rewritten so a rename looks tidy has stopped being one.
 */
const RENAMED = new Map([
  ['platform_template.draft_saved', 'company_template.draft_saved'],
  ['platform_template.published', 'company_template.published'],
  ['platformTemplates', 'companyTemplates'],
]);
const renamed = (value: string) => RENAMED.get(value) ?? value;

/** A chip's *nothing chosen*. Never an id, so it cannot collide with one. */
const ANY = '';

/** How long the search waits after the last key before it asks the server. */
const SEARCH_SETTLE_MS = 300;
/** `AUDIT_LOG.SEARCH_MAX_LENGTH` in the backend's `domain/constants/audit.ts`: the input stops there; the server refuses past it. */
const SEARCH_MAX = 100;

interface Filters {
  q: string;
  kpmId: string;
  companyId: string;
  action: string;
  actorUserId: string;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { q: ANY, kpmId: ANY, companyId: ANY, action: ANY, actorUserId: ANY, from: ANY, to: ANY };

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const ACTION = /^[a-z_]+\.[a-z_]+$/;

/**
 * **The filters an address names** (P19.15-T4 AC-2; ADR-0260 §6): *Perubahan oleh pengelola* links each change to its
 * line — `?kpmId=&actorUserId=&action=` — and `/admin/audit?…` redirects here keeping them. A value that is not one is
 * dropped, never sent.
 */
function filtersFrom(query: Query): Filters {
  const one = (key: string, shape: RegExp) => {
    const value = query[key];
    return typeof value === 'string' && shape.test(value) ? value : ANY;
  };
  const q = typeof query.q === 'string' ? query.q.slice(0, SEARCH_MAX) : ANY;
  return {
    ...NO_FILTERS,
    q,
    kpmId: one('kpmId', OBJECT_ID),
    companyId: one('companyId', OBJECT_ID),
    actorUserId: one('actorUserId', OBJECT_ID),
    action: one('action', ACTION),
  };
}

/**
 * **What a line says happened** (P19.23-T6 AC-1; frame f52: *"Mengubah target Active Agent Group AGUS PRASETYO 6 →
 * 8"*): the action in the reader's words, what it happened to, and the change before → after — the server's words, each
 * where it has one.
 */
function whatOf(group: AuditGroup): string {
  return [group.actionLabel ?? renamed(group.action), group.targetLabel, group.change].filter(Boolean).join(' · ');
}

/**
 * ***Platform* › *Audit log*** (P19.23-T6 AC-1; ADR-0279; frame f52; P19.2-T2 AC-6, §B.32 before it). The append-only
 * record, read-only by construction, a page at a time.
 *
 * - **What it reads.** *Semua KPM* — the platform's log and every Super Admin change inside a KPM; one KPM chosen, that
 *   KPM's whole log. The server pages, filters, searches and groups (*×28*); the screen draws what it is sent.
 * - **The filters** (f52): *Cari perubahan*, then *Semua perusahaan · Semua KPM · Semua tindakan*; *Pelaku* and
 *   *Tanggal* after them (P19.2-T2 AC-6, UI-132 — earlier requests, kept).
 * - **Each line** (f52): when · what, before → after · who · KPM · company. One list at every width; a phone stacks it.
 */
export function AuditLogSection() {
  const t = useMessages(adminAuditMessages);
  const address = useQuery();
  const [groups, setGroups] = useState<AuditGroup[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [facets, setFacets] = useState<AuditFacets | null>(null);
  const [tenants, setTenants] = useState<Kpm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState<Filters>(() => filtersFrom(address));
  const [typed, setTyped] = useState(filters.q);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  /** The read the page is on, so a slower answer to filters since changed never overwrites a newer one. */
  const reading = useRef(0);

  useEffect(() => {
    void listTenants().then(setTenants).catch(() => setTenants([]));
    void listCompanies().then((all) => setCompanies(insurersOf(all))).catch(() => setCompanies([]));
  }, []);

  // The search asks once the typing settles.
  useEffect(() => {
    const words = typed.trim();
    if (words === filters.q) return undefined;
    const timer = setTimeout(() => setFilters((f) => ({ ...f, q: words })), SEARCH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [typed, filters.q]);

  const query = useMemo<AuditQuery>(() => ({ ...filters }), [filters]);

  useEffect(() => {
    const read = ++reading.current;
    setGroups(null);
    setError(null);
    void readAudit(query)
      .then((page) => {
        if (read !== reading.current) return;
        setGroups(page.items);
        setNextCursor(page.page.nextCursor);
        if (page.facets) setFacets(page.facets);
      })
      .catch((err) => {
        if (read !== reading.current) return;
        setError(toDisplayError(err));
        setGroups([]);
        setNextCursor(null);
      });
  }, [query]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const read = reading.current;
    setLoadingMore(true);
    try {
      const page = await readAudit({ ...query, cursor: nextCursor });
      if (read !== reading.current) return;
      setGroups((before) => [...(before ?? []), ...page.items]);
      setNextCursor(page.page.nextCursor);
    } catch (err) {
      if (read === reading.current) setError(toDisplayError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, query]);

  const set = (key: keyof Filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const narrowed = Object.entries(filters).some(([key, value]) => key !== 'kpmId' && value !== ANY);

  const companyOptions: ChoiceOption[] = [
    { key: ANY, label: t.allCompanies },
    ...companies.map((c) => ({ key: c._id, label: c.name })),
  ];
  const kpmOptions: ChoiceOption[] = [
    { key: ANY, label: t.allKpms },
    ...tenants.map((k) => ({ key: k._id, label: `${kept('KPM')} ${k.code} · ${k.branchName}` })),
  ];
  const labelOf = new Map((facets?.actionLabels ?? []).map((a) => [a.action, a.label]));
  const actionOptions: ChoiceOption[] = [
    { key: ANY, label: t.allActions },
    ...(facets?.actions ?? []).map((action) => ({ key: action, label: labelOf.get(action) ?? renamed(action) })),
  ];
  const actorOptions: ChoiceOption[] = [
    { key: ANY, label: t.allActors },
    ...(facets?.actors ?? []).map((a) => ({ key: a.userId, label: a.name ?? t.unknownActor({ id: a.userId }) })),
  ];
  const pill = 'bg-card text-ink lg:min-h-11';

  return (
    <>
      <div role="group" aria-label={t.filters} className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <label className="flex min-h-11 items-center gap-2 rounded-pill border border-hairline bg-card px-3.5 md:w-72">
          <LineIcon name="search" className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">{t.search}</span>
          <input
            type="search"
            value={typed}
            maxLength={SEARCH_MAX}
            placeholder={t.search}
            onChange={(e) => setTyped(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap">
          <ChoicePill name={t.company} options={companyOptions} value={filters.companyId} onChange={set('companyId')}
            narrows={filters.companyId !== ANY} shows="value" className={pill} />
          <ChoicePill name={t.kpm} options={kpmOptions} value={filters.kpmId} onChange={set('kpmId')}
            narrows={filters.kpmId !== ANY} shows="value" className={pill} />
          <ChoicePill name={t.columns.action} options={actionOptions} value={filters.action} onChange={set('action')}
            narrows={filters.action !== ANY} shows="value" className={cn(pill, 'max-md:col-span-2')} />
          <ChoicePill name={t.columns.actor} options={actorOptions} value={filters.actorUserId} onChange={set('actorUserId')}
            narrows={filters.actorUserId !== ANY} shows="value" className={pill} />
          <DatePill from={filters.from} to={filters.to} onChange={(from, to) => setFilters((f) => ({ ...f, from, to }))} />
        </div>
      </div>

      {error && <ErrorBanner {...error} />}

      {groups === null && (
        <Skeleton label={t.caption}>
          <div className="rounded-lg bg-card">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-4 border-b border-hairline px-4 py-3 last:border-b-0">
                <SkeletonBar className="w-24" />
                <div className="flex flex-1 flex-col gap-1.5"><SkeletonBar className="w-2/3" /><SkeletonBar className="w-1/3" /></div>
              </div>
            ))}
          </div>
        </Skeleton>
      )}

      {groups?.length === 0 && !error && (
        <div className="rounded-lg border border-card-edge bg-card">
          {narrowed || filters.kpmId ? (
            <EmptyState
              title={t.emptyFiltered}
              variant="filtered"
              action={(
                <Button variant="secondary" onClick={() => { setTyped(ANY); setFilters(NO_FILTERS); }}>
                  {t.clearFilters}
                </Button>
              )}
            />
          ) : (
            <EmptyState title={t.emptyAll} />
          )}
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="rounded-lg bg-card">
          <ul aria-label={t.caption} className="[&>li+li]:border-t [&>li+li]:border-hairline">
            {groups.map((g) => <Line key={g._id} group={g} />)}
          </ul>
          {nextCursor && (
            <div className="border-t border-divider">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="flex h-12 w-full items-center justify-center text-base font-semibold text-primary-deep hover:bg-hover-row disabled:opacity-60"
              >
                {loadingMore ? t.loadingMore : t.loadMore}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-sm text-muted">{filters.kpmId ? t.officeNote : t.note}</p>
    </>
  );
}

/** **One line** (frame f52): when; what, before → after, ×n; who · KPM · company. */
function Line({ group }: { group: AuditGroup }) {
  const t = useMessages(adminAuditMessages);
  const figures = useFigureLanguage();
  const who = [
    group.actorName ?? group.actorUserId ?? '—',
    group.effectiveUserId ? t.actingAs({ name: group.effectiveName ?? group.effectiveUserId }) : null,
  ].filter(Boolean).join(' ');
  const where = [group.kpm ? group.kpm.branch || `${kept('KPM')} ${group.kpm.code}` : null, group.company?.name ?? null]
    .filter(Boolean);
  return (
    <li data-audit-row="" className="flex flex-col gap-1 px-4 py-3 md:flex-row md:items-start md:gap-4">
      <time dateTime={group.createdAt} className="shrink-0 text-sm tabular-nums text-muted md:w-36 md:pt-0.5">
        {formatDateTime(group.createdAt, OFFICE_TIME_ZONE, figures)}
      </time>
      <div className="min-w-0 flex-1">
        <p className="break-words text-md font-bold text-navy">
          {whatOf(group)}
          <CountPill group={group} />
        </p>
        <p className="mt-0.5 break-words text-sm text-muted">{[who, ...where].join(' · ')}</p>
      </div>
    </li>
  );
}

/** **The count pill** (UI-132: *×28*): the server's count, drawn only for a group of more than one. */
function CountPill({ group }: { group: AuditGroup }) {
  const t = useMessages(adminAuditMessages);
  const figures = useFigureLanguage();
  if (group.count <= 1) return null;
  return (
    <span
      data-count-pill=""
      title={t.timesSince({ n: group.count, oldest: formatDateTime(group.oldestAt, OFFICE_TIME_ZONE, figures) })}
      className="ml-1.5 inline-flex rounded-pill bg-primary/[0.14] px-1.5 align-[1px] text-sm font-bold text-primary-deep"
    >
      <span aria-hidden="true">{t.count({ n: group.count })}</span>
      <span className="sr-only">{t.countSaid({ n: group.count })}</span>
    </span>
  );
}

/**
 * **Tanggal** (UI-132): a pill that opens two office days, both inclusive — *Dari* and *Sampai* — and *Terapkan*; *Semua
 * tanggal* lifts it. The days are the office's calendar, as the server reads them.
 */
function DatePill({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const t = useMessages(adminAuditMessages);
  const layout = useMessages(adminLayoutMessages);
  const ui = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const phone = useMediaQuery('phone');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from, to });
  const narrows = from !== ANY || to !== ANY;
  const words = !narrows ? t.date
    : from && to ? formatDayRange(from, to, figures)
      : from ? `≥ ${formatCalendarDay(from, figures)}` : `≤ ${formatCalendarDay(to, figures)}`;
  const backwards = draft.from !== ANY && draft.to !== ANY && draft.to < draft.from;
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${t.date}: ${narrows ? words : t.anyDate}`}
        onClick={() => {
          setDraft({ from, to });
          setOpen(true);
        }}
        className={cn(
          'flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-3 text-base font-semibold lg:px-3.5',
          narrows ? 'bg-secondary text-secondary-contrast' : 'bg-card text-ink hover:bg-hover-row',
        )}
      >
        {words}
        <LineIcon name="chevronDown" className="h-4 w-4 shrink-0" />
      </button>
      <Modal
        open={open}
        title={layout.choose({ what: t.date })}
        onClose={() => setOpen(false)}
        placement={phone ? 'sheet' : 'center'}
        handle={phone}
        closeLabel={ui.close}
        footer={(
          <div className="flex justify-end gap-2 max-md:[&>button]:flex-1">
            <Button
              variant="secondary"
              className={ADMIN_TARGET}
              onClick={() => {
                onChange(ANY, ANY);
                setOpen(false);
              }}
            >
              {t.anyDate}
            </Button>
            <Button
              className={ADMIN_TARGET}
              disabled={backwards}
              onClick={() => {
                onChange(draft.from, draft.to);
                setOpen(false);
              }}
            >
              {t.apply}
            </Button>
          </div>
        )}
      >
        <div className="flex flex-col gap-4 pb-2">
          <Field label={t.from} htmlFor="audit-from">
            <DateField id="audit-from" value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
          </Field>
          <Field label={t.to} htmlFor="audit-to">
            <DateField id="audit-to" value={draft.to} invalid={backwards} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
