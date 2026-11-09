'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Page } from '@/components/page';
import { kept } from '@/i18n/kept';
import { DateField } from '@/components/ui/date-field';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { SkeletonTable } from '@/components/ui/skeleton';
import {
  insurersOf, listCompanies, listTenants, readAudit,
  type AuditFacets, type AuditGroup, type AuditQuery, type Company, type Kpm,
} from '@/lib/admin';
import { toDisplayError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminAuditMessages } from '@/i18n/messages/admin-audit';
import { adminLayoutMessages } from '@/i18n/messages/admin-layout';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import {
  dayInZone, formatCalendarDay, formatDateTime, formatDayRange, formatOfficeTime, OFFICE_TIME_ZONE,
} from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { ADMIN_TARGET, ChoicePill, type ChoiceOption } from '@/components/ui/rows-and-sheets';

/**
 * Rows written before the Company template rename (ADR-0023), shown under the new name.
 *
 * **Renamed here and not in the database.** `auditLog` is append-only evidence — the
 * schema's own first line calls it that, and PDP (UU 27/2022) is the reason. A record
 * whose contents are rewritten later so a rename looks tidy has stopped being a record.
 * So the rows keep the words they were written with, and one list reads consistently.
 */
const RENAMED = new Map([
  ['platform_template.draft_saved', 'company_template.draft_saved'],
  ['platform_template.published', 'company_template.published'],
  ['platformTemplates', 'companyTemplates'],
]);

const renamed = (value: string) => RENAMED.get(value) ?? value;

/**
 * **The action in words** (P19.4-T3 AC-11; SA UI-016): the server's label in the reader's language — *"Draf template
 * disimpan"* — and the action as recorded only where a server before it sent none.
 */
const actionWords = (group: AuditGroup) => group.actionLabel ?? renamed(group.action);

/** A chip's *nothing chosen*. Never an id, so it cannot collide with one. */
const ANY = '';

/** The filters the chips hold; `ANY` narrows nothing. */
interface Filters {
  kpmId: string;
  companyId: string;
  action: string;
  actorUserId: string;
  from: string;
  to: string;
}

const NO_FILTERS: Filters = { kpmId: ANY, companyId: ANY, action: ANY, actorUserId: ANY, from: ANY, to: ANY };

/**
 * **The audit log, a page at a time** (P19.2-T2 AC-6; UI-132, its Appendix D row; `admin-mobile` screen 5,
 * `admin-desktop` screen 3; `metrics-and-definitions.md` §B.32). The append-only record, read-only by construction.
 *
 * - **The server pages, filters and groups.** The first fifty groups, then *Muat lagi* with the cursor the read
 *   returned; a run of identical rows by one person on one target within ten minutes is one line with its count
 *   (*×28*), as the server counted it. Neither number is this page's.
 * - **The chips** *Cakupan · Perusahaan · Tindakan · Pelaku · Tanggal* (UI-134: a pill opening a sheet, never a native
 *   `<select>`), the actions and actors the first page offers.
 * - **Below 1024px no table** (UI-126): the lines grouped by office day — the time, the action, *target · actor*. From
 *   1024px the table, its header sticky as the page scrolls.
 * - **Names and words, never ids or codes** (P19.4-T3 AC-11; SA UI-016, case 9): each line's action is the server's
 *   label (*"Draf template disimpan ×28"*), its target the kind of thing and its name (*Bagian template · Prudential
 *   template · Aktivitas & rasio*, *Produk · PRUProsper*), and *Cakupan* names each office *KPM 0417 · Bandung*.
 */
export default function AuditPage() {
  const t = useMessages(adminAuditMessages);
  const layout = useMessages(adminLayoutMessages);
  const figures = useFigureLanguage();
  const rows = useMediaQuery(['phone', 'tablet']);
  const COLUMNS = [t.columns.when, t.columns.action, t.columns.target, t.columns.actor];
  const [groups, setGroups] = useState<AuditGroup[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [facets, setFacets] = useState<AuditFacets | null>(null);
  const [tenants, setTenants] = useState<Kpm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [error, setError] = useState<{ code: string; message: string; requestId: string } | null>(null);
  /** The read the page is on, so a slower answer to filters since changed never overwrites a newer one. */
  const reading = useRef(0);

  useEffect(() => {
    void listTenants().then(setTenants).catch(() => setTenants([]));
    void listCompanies().then((all) => setCompanies(insurersOf(all))).catch(() => setCompanies([]));
  }, []);

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

  // The KPM filter (SA case 9): *KPM 0417 · Bandung*, as the log names an office.
  const scopeOptions: ChoiceOption[] = [
    { key: ANY, label: t.platformLevel },
    ...tenants.map((tenant) => ({ key: tenant._id, label: `${kept('KPM')} ${tenant.code} · ${tenant.branchName}` })),
  ];
  const companyOptions: ChoiceOption[] = [
    { key: ANY, label: layout.all },
    ...companies.map((c) => ({ key: c._id, label: c.name })),
  ];
  // The chip offers each action in words (P19.4-T3 AC-11), the server's, in its order.
  const labelOf = new Map((facets?.actionLabels ?? []).map((a) => [a.action, a.label]));
  const actionOptions: ChoiceOption[] = [
    { key: ANY, label: layout.all },
    ...(facets?.actions ?? []).map((action) => ({ key: action, label: labelOf.get(action) ?? renamed(action) })),
  ];
  const actorOptions: ChoiceOption[] = [
    { key: ANY, label: layout.all },
    ...(facets?.actors ?? []).map((a) => ({ key: a.userId, label: a.name ?? t.unknownActor({ id: a.userId }) })),
  ];

  return (
    // The nav item's words (P18.7-T9 AC-2; UI-027): *Audit / role change log* (`Superadmin.html:197`). No sub-line (UI-136).
    <Page title={t.title}>
      <div role="group" aria-label={t.filters} className="mb-3 flex flex-wrap gap-1.5">
        {/* Cakupan reads as chosen at every value: the platform's own log is a scope too, not an absence of one. */}
        <ChoicePill name={t.scope} options={scopeOptions} value={filters.kpmId} onChange={set('kpmId')} narrows />
        <ChoicePill
          name={t.company}
          options={companyOptions}
          value={filters.companyId}
          onChange={set('companyId')}
          narrows={filters.companyId !== ANY}
        />
        <ChoicePill
          name={t.columns.action}
          options={actionOptions}
          value={filters.action}
          onChange={set('action')}
          narrows={filters.action !== ANY}
        />
        <ChoicePill
          name={t.columns.actor}
          options={actorOptions}
          value={filters.actorUserId}
          onChange={set('actorUserId')}
          narrows={filters.actorUserId !== ANY}
        />
        <DatePill
          from={filters.from}
          to={filters.to}
          onChange={(from, to) => setFilters((f) => ({ ...f, from, to }))}
        />
      </div>

      {error && <ErrorBanner {...error} />}

      {groups === null && (
        <SkeletonTable caption={t.caption} columns={COLUMNS} rows={8} />
      )}

      {groups?.length === 0 && !error && (
        <div className="rounded-lg border border-card-edge bg-card">
          {narrowed ? (
            <EmptyState
              title={t.emptyFiltered}
              variant="filtered"
              action={<Button variant="secondary" onClick={() => setFilters((f) => ({ ...NO_FILTERS, kpmId: f.kpmId }))}>{t.clearFilters}</Button>}
            />
          ) : (
            <EmptyState
              title={filters.kpmId ? t.emptyOffice : t.emptyPlatform}
              variant={filters.kpmId ? 'filtered' : 'empty'}
              action={filters.kpmId ? <Button variant="secondary" onClick={() => set('kpmId')(ANY)}>{t.showPlatform}</Button> : undefined}
            />
          )}
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="rounded-lg bg-card">
          {rows ? <DayRows groups={groups} /> : (
            <table className="relative w-full table-fixed border-collapse text-left text-md">
              <caption className="sr-only">{t.caption}</caption>
              <colgroup>
                <col className="w-[10.5rem]" />
                <col />
                <col />
                <col className="w-[11rem]" />
              </colgroup>
              <thead>
                <tr>
                  {COLUMNS.map((label) => (
                    <th
                      key={label}
                      scope="col"
                      /* Sticky as the page scrolls (UI-132: *header stays visible on desktop while scrolling*). */
                      className="sticky top-0 z-[1] border-b border-hairline bg-card px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-muted first:rounded-tl-lg last:rounded-tr-lg"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g._id} className="border-b border-hairline last:border-b-0">
                    <td className="px-4 py-3 align-top text-muted">
                      <time dateTime={g.createdAt}>{formatDateTime(g.createdAt, OFFICE_TIME_ZONE, figures)}</time>
                    </td>
                    <td className="break-words px-4 py-3 align-top font-semibold">
                      {actionWords(g)}
                      <CountPill group={g} />
                    </td>
                    <td className="break-words px-4 py-3 align-top"><Target group={g} /></td>
                    <td className="break-words px-4 py-3 align-top"><Actor group={g} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
    </Page>
  );
}

/** **Below 1024px, the lines by office day** (UI-126, UI-132; `admin-mobile` screen 5): *2 Nov 2026*, then each line. */
function DayRows({ groups }: { groups: AuditGroup[] }) {
  const t = useMessages(adminAuditMessages);
  const figures = useFigureLanguage();
  const days: { day: string; groups: AuditGroup[] }[] = [];
  for (const g of groups) {
    const day = dayInZone(OFFICE_TIME_ZONE, new Date(g.createdAt));
    const last = days[days.length - 1];
    if (last && last.day === day) last.groups.push(g);
    else days.push({ day, groups: [g] });
  }
  return (
    <div aria-label={t.caption} role="region">
      {days.map(({ day, groups: inDay }) => (
        <section key={day} aria-labelledby={`day-${day}`}>
          <h2 id={`day-${day}`} className="px-3 pb-1 pt-3 text-sm font-semibold text-muted">
            {formatCalendarDay(day, figures)}
          </h2>
          <ul role="list" className="[&>li+li]:border-t [&>li+li]:border-divider">
            {inDay.map((g) => (
              <li key={g._id} data-audit-row="" className="flex min-h-14 items-start gap-3 px-3 py-2.5">
                <time dateTime={g.createdAt} className="w-11 shrink-0 pt-px text-sm tabular-nums text-muted">
                  {formatOfficeTime(g.createdAt, OFFICE_TIME_ZONE, figures)}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-md font-bold text-ink">
                    {actionWords(g)}
                    <CountPill group={g} />
                  </p>
                  <p className="mt-0.5 break-words text-sm text-muted">
                    <Target group={g} plain />
                    <span aria-hidden="true"> · </span>
                    <Actor group={g} plain />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
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
 * **The name first, the id only when there is no name.** Every row used to read `memberships 68f3c1a9…`, so answering
 * *"who suspended Surabaya?"* meant three lookups in a database shell. An unresolved id is still shown rather than
 * blanked: a collection nothing names yet is *this is all we know*, not *nothing happened*.
 */
function Target({ group, plain = false }: { group: AuditGroup; plain?: boolean }) {
  return (
    <>
      {/* What kind of thing it is, in words (P19.4-T3 AC-11): *Produk*, *Bagian template*, never `products`. */}
      <span className="text-muted">{group.targetKind ?? renamed(group.targetCollection)}</span>
      {group.targetLabel
        ? <span className={cn('ml-1 font-semibold', plain ? 'text-ink' : 'text-navy')}>{group.targetLabel}</span>
        : group.targetId
          ? <code className="ml-1 break-all text-sm text-muted">{group.targetId}</code>
          : null}
    </>
  );
}

/** The actor — and, under impersonation, who they acted as: showing one alone would attribute the action wrongly. */
function Actor({ group, plain = false }: { group: AuditGroup; plain?: boolean }) {
  const t = useMessages(adminAuditMessages);
  return (
    <>
      {group.actorName
        ? <span className={cn('font-semibold', plain ? 'text-ink' : 'text-navy')}>{group.actorName}</span>
        : <code className="break-all text-sm">{group.actorUserId ?? '—'}</code>}
      {group.effectiveUserId && (
        <span className="ml-1 text-sm text-alert">
          {t.actingAs({ name: group.effectiveName ?? group.effectiveUserId })}
        </span>
      )}
    </>
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
          'flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-pill px-3 text-base font-semibold lg:min-h-9 lg:px-3.5',
          narrows ? 'bg-secondary text-secondary-contrast' : 'bg-card text-pill-grey-ink hover:bg-hover-row',
        )}
      >
        {words}
        <span aria-hidden="true">⌄</span>
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
            <DateField
              id="audit-to"
              value={draft.to}
              invalid={backwards}
              onChange={(v) => setDraft((d) => ({ ...d, to: v }))}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
