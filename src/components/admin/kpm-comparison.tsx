'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { ChoicePill } from '@/components/ui/rows-and-sheets';
import { Pager } from '@/components/ui/pager';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { insurersOf, listCompanies, type Company } from '@/lib/admin';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatNumber, formatPercent, formatRupiahCompact } from '@/lib/format';
import { readKpmComparison, type ComparisonSort, type KpmComparisonPage, type Rate } from '@/lib/platform-reads';
import { useMediaQuery } from '@/lib/use-media-query';

/*
 * *Removed 2026-11-06 (P19.2-T2 AC-1; UI-126):* `TABLE_WIDTH`, a 60rem minimum so the table scrolled inside its box on a
 * phone. A phone and a tablet draw rows now; the laptop's table takes the content's width.
 */

/**
 * ***The KPM comparison*** (P19.4-T3 AC-3; SA UI-013, SA R4, OD-260 OQ3; ADR-0207 §2, §7): under the adoption figures on
 * `/admin/analytics`, one row per KPM with **the Overview's own figures** — *Total members*, *Aktif bulan ini*, *Pengguna
 * aktif*, *Coached 7 hari · 30 hari*, *Production this year* against target and the *Recruitment pipeline* against the
 * month's target — each the same figure that KPM's `/kpm/overview` shows. Filterable by company and sortable, both on the
 * server; no benchmark, score or rank. A row opens the KPM's analytics, read-only (*Lihat sebagai KPM*).
 *
 * **Below 1024px** (P19.2-T2 AC-1, AC-4; UI-126, UI-134): a row per KPM — *code · branch* opening its analytics, the
 * company, each figure after its column's words — and no native select: the company a pill, navy once it narrows the
 * list, and the sort a second pill holding the columns. Choosing a column sorts by it as its heading's first press does;
 * choosing it again turns it round, as a second press does (the pill's ↓ says so).
 */
export function KpmComparison() {
  const t = useMessages(adminPlatformReadsMessages).comparison;
  const figures = useFigureLanguage();
  const companyId = useId();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState<{ companyId?: string; sort: string; page: number }>({ sort: 'kpm', page: 1 });
  const [view, setView] = useState<KpmComparisonPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const belowLaptop = useMediaQuery(['phone', 'tablet']);

  useEffect(() => {
    void listCompanies().then((rows) => setCompanies(insurersOf(rows))).catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    let live = true;
    setError(null);
    readKpmComparison({ companyId: query.companyId, sort: query.sort === 'kpm' ? undefined : query.sort, page: query.page })
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [query, attempt]);

  const sortable = (key: ComparisonSort, label: string): Column => {
    const on = query.sort.replace(/^-/, '') === key;
    return {
      label,
      sort: on ? (query.sort.startsWith('-') ? 'descending' : 'ascending') : 'none',
      onSort: () => setQuery((q) => ({ ...q, page: 1, sort: on && !q.sort.startsWith('-') ? `-${key}` : key })),
    };
  };
  const c = t.columns;
  const columns: Column[] = [
    sortable('kpm', c.kpm), sortable('company', c.company), sortable('members', c.members),
    sortable('activeThisMonth', c.activeThisMonth), sortable('activeUsers', c.activeUsers), sortable('coached7d', c.coached),
    sortable('production', c.production), sortable('recruitment', c.recruitment),
  ];
  /** The sort pill's choices: the sortable columns, the one sorted by carrying ↑ or ↓, as its heading's `aria-sort` does. */
  const SORTS: readonly [ComparisonSort, string][] = [
    ['kpm', c.kpm], ['company', c.company], ['members', c.members], ['activeThisMonth', c.activeThisMonth],
    ['activeUsers', c.activeUsers], ['coached7d', c.coached], ['production', c.production], ['recruitment', c.recruitment],
  ];
  const sortedBy = query.sort.replace(/^-/, '');
  const pct = (value: number | null) => (value === null ? '—' : formatPercent(value, {}, figures));
  const rate = (r: Rate) => `${pct(r.pct)}`;

  return (
    <section aria-labelledby={`${companyId}-title`} className="mt-8 flex flex-col gap-3">
      <h2 id={`${companyId}-title`} className="font-display text-lg font-bold text-navy">{t.title}</h2>
      {belowLaptop ? (
        <div className="flex flex-wrap gap-1.5">
          <ChoicePill
            name={t.company}
            options={[{ key: '', label: t.allCompanies }, ...companies.map((co) => ({ key: co._id, label: co.name }))]}
            value={query.companyId ?? ''}
            onChange={(key) => setQuery((q) => ({ ...q, page: 1, companyId: key || undefined }))}
            narrows={Boolean(query.companyId)}
          />
          <ChoicePill
            name={t.sort}
            options={SORTS.map(([key, label]) => ({
              key, label: key === sortedBy ? `${label} ${query.sort.startsWith('-') ? '↓' : '↑'}` : label,
            }))}
            value={sortedBy}
            onChange={(key) => setQuery((q) => ({
              ...q, page: 1, sort: key === q.sort.replace(/^-/, '') && !q.sort.startsWith('-') ? `-${key}` : key,
            }))}
            narrows={false}
            shows="value"
          />
        </div>
      ) : (
        <div className="max-w-xs">
          <Field label={t.company} htmlFor={companyId}>
            <Select
              id={companyId}
              value={query.companyId ?? ''}
              onChange={(e) => setQuery((q) => ({ ...q, page: 1, companyId: e.target.value || undefined }))}
            >
              <option value="">{t.allCompanies}</option>
              {companies.map((co) => <option key={co._id} value={co._id}>{co.name}</option>)}
            </Select>
          </Field>
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button>
        </div>
      )}
      {!error && view === null && <SkeletonTable caption={t.loading} columns={columns} rows={4} />}
      {view && view.total === 0 && (
        <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.empty} /></div>
      )}
      {view && view.rows.length > 0 && (
        <>
          {belowLaptop ? (
            <ListCard label={t.caption}>
              {view.rows.map((row) => (
                <ListRow
                  key={row.kpmId}
                  data-row={row.kpmId}
                  href={`/admin/tenants/${row.kpmId}/analytics`}
                  ariaLabel={t.open({ code: row.code })}
                  title={`${row.code} · ${row.branch}`}
                  meta={row.company.name}
                  note={(
                    <span className="flex flex-col text-muted">
                      <span>
                        {`${c.members} ${formatNumber(row.members, {}, figures)} · ${c.activeThisMonth} `}
                        {row.activeThisMonth.count === null
                          ? t.notUploaded
                          : `${formatNumber(row.activeThisMonth.count, {}, figures)} / ${formatNumber(row.activeThisMonth.of, {}, figures)} · ${pct(row.activeThisMonth.pct)}`}
                      </span>
                      <span>{`${c.activeUsers} ${pct(row.activeUsers.pct)} · ${c.coached} ${rate(row.coached.d7)} · ${rate(row.coached.d30)}`}</span>
                      <span>
                        {`${c.production} ${row.production.achievedMinor === null ? '—' : formatRupiahCompact(row.production.achievedMinor, {}, figures)} · `}
                        {row.production.targetMinor === null
                          ? t.noTarget
                          : `${pct(row.production.pct)} ${t.ofTarget({ target: formatRupiahCompact(row.production.targetMinor, {}, figures) })}`}
                      </span>
                      <span>
                        {`${c.recruitment} ${formatNumber(row.recruitment.pipeline, {}, figures)} · `}
                        {row.recruitment.target === null ? t.noTarget : t.ofTarget({ target: formatNumber(row.recruitment.target, {}, figures) })}
                      </span>
                    </span>
                  )}
                />
              ))}
            </ListCard>
          ) : (
          <DataTable caption={t.caption} columns={columns}>
            {view.rows.map((row) => (
              <Row key={row.kpmId}>
                <Cell className="font-semibold">
                  <Link href={`/admin/tenants/${row.kpmId}/analytics`} className="underline" aria-label={t.open({ code: row.code })}>
                    {row.code}
                  </Link>
                  <span className="block text-sm font-normal text-muted">{row.branch}</span>
                </Cell>
                <Cell>{row.company.name}</Cell>
                <Cell className="tabular-nums">{formatNumber(row.members, {}, figures)}</Cell>
                <Cell className="tabular-nums">
                  {row.activeThisMonth.count === null
                    ? <span className="text-muted">{t.notUploaded}</span>
                    : `${formatNumber(row.activeThisMonth.count, {}, figures)} / ${formatNumber(row.activeThisMonth.of, {}, figures)} · ${pct(row.activeThisMonth.pct)}`}
                </Cell>
                <Cell className="tabular-nums">{pct(row.activeUsers.pct)}</Cell>
                <Cell className="tabular-nums whitespace-nowrap">{`${rate(row.coached.d7)} · ${rate(row.coached.d30)}`}</Cell>
                <Cell className="tabular-nums">
                  {row.production.achievedMinor === null ? '—' : formatRupiahCompact(row.production.achievedMinor, {}, figures)}
                  <span className="block text-sm text-muted">
                    {row.production.targetMinor === null
                      ? t.noTarget
                      : `${pct(row.production.pct)} ${t.ofTarget({ target: formatRupiahCompact(row.production.targetMinor, {}, figures) })}`}
                  </span>
                </Cell>
                <Cell className="tabular-nums">
                  {formatNumber(row.recruitment.pipeline, {}, figures)}
                  <span className="block text-sm text-muted">
                    {row.recruitment.target === null ? t.noTarget : t.ofTarget({ target: formatNumber(row.recruitment.target, {}, figures) })}
                  </span>
                </Cell>
              </Row>
            ))}
          </DataTable>
          )}
          <Pager
            page={view.page}
            pages={Math.max(1, Math.ceil(view.total / view.pageSize))}
            label={t.caption}
            onPage={(page) => setQuery((q) => ({ ...q, page }))}
          />
        </>
      )}
    </section>
  );
}
