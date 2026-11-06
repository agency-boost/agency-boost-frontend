'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner, Field, Select } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { Skeleton, SkeletonBar, SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import {
  listBillingKpms, readBillingPrices, tierLabel,
  type BillingKpmRow, type BillingKpmSort, type BillingKpmStatus, type BillingPrices,
} from '@/lib/billing';
import { formatShortDay } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { ChoicePill } from '@/components/ui/rows-and-sheets';
import { TierCards } from './editor';

/**
 * **Billing & subscription — one row per KPM** (P19.4-T3 AC-10; ADR-0211 §3; SA UI-015, SA R6, SA case 8).
 *
 * The page lists the KPMs — *KPM · Perusahaan · Leader · Tingkat · Paket · Perpanjangan · Status* — filterable by
 * company and sortable by a column, both on the server (`GET /admin/billing/kpms`); a row opens the KPM's *Billing*
 * tab (`/admin/tenants/[kpmId]?tab=billing`), where the calculator moved, filled with that KPM's leaders and plan.
 * **The price tiers stay as a reference strip** above the list (`GET /admin/billing/prices`), with no *"TINGKAT
 * ANDA"*: no KPM is chosen here.
 *
 * The Super Admin's alone (`billing:read_prices`): the route's own gate, inside the console's.
 *
 * **Below 1024px a row per KPM** (P19.2-T2 AC-1, AC-4; UI-126, UI-134): *code · branch* opening its *Billing* tab, the
 * company, *Leaders · Tier · Plan · Renewal* after their columns' words, the state on the right; the company filter and the
 * sort are pills — a column as its heading's first press, the same one again the other way. From 1024px the table, at
 * the content's width.
 */
export default function BillingPage() {
  const COPY = useMessages(billingMessages).prototype;
  return (
    // **The title through the shared header** (P19.2-T2 AC-9; UI-138).
    <Page title={COPY.title} permission="billing:read_prices">
      <Billing />
    </Page>
  );
}

/** The launch line under the title (`:229-232`). Copy only: no date in code reads the cut-off (ADR-0111 §6). */
function LaunchLine() {
  const COPY = useMessages(billingMessages).prototype;
  return <p className="-mt-1 mb-[18px] text-sm font-semibold text-primary-ink">{COPY.launch}</p>;
}

/** The offices list's tones for the same states (`tenantStatusTone`): ended is alert, kept active a watch. */
const STATUS_TONE: Record<BillingKpmStatus, 'success' | 'alert' | 'watch' | 'neutral'> = {
  active: 'success', ended: 'alert', ended_kept_active: 'watch', none: 'neutral',
};

function Billing() {
  const { own: OWN, perKpm: T } = useMessages(billingMessages);
  const figures = useFigureLanguage();
  const [prices, setPrices] = useState<BillingPrices | null>(null);
  const [pricesError, setPricesError] = useState<ApiError | null>(null);
  const [rows, setRows] = useState<BillingKpmRow[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** The companies to filter by: every company with a KPM, from the first unfiltered read. */
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState('');
  const belowLaptop = useMediaQuery(['phone', 'tablet']);
  const [sort, setSort] = useState<{ key: BillingKpmSort; dir: 'asc' | 'desc' }>({ key: 'kpm', dir: 'asc' });

  const loadPrices = useCallback(() => {
    setPricesError(null);
    readBillingPrices().then(setPrices).catch((err) => setPricesError(toDisplayError(err)));
  }, []);
  useEffect(loadPrices, [loadPrices]);

  const loadRows = useCallback(() => {
    setError(null);
    setRows(null);
    listBillingKpms({ companyId: companyId || undefined, sort: sort.key, dir: sort.dir })
      .then((read) => {
        setRows(read);
        if (!companyId) {
          const seen = new Map(read.map((r) => [r.company.id, r.company.name]));
          setCompanies([...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
      .catch((err) => setError(toDisplayError(err)));
  }, [companyId, sort]);
  useEffect(loadRows, [loadRows]);

  /** A heading the reader sorts by: ascending first, then the other way. */
  /** The sort pill's choices below 1024px: the sortable columns, the one sorted by carrying ↑ or ↓. */
  const sortChoices = (list: readonly [BillingKpmSort, string][]) => list.map(([key, label]) => ({
    key, label: key === sort.key ? `${label} ${sort.dir === 'asc' ? '↑' : '↓'}` : label,
  }));
  const sortable = (label: string, key: BillingKpmSort): Column => ({
    label,
    sort: sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none',
    onSort: () => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })),
  });
  const c = T.columns;
  const columns: Column[] = [
    sortable(c.kpm, 'kpm'), sortable(c.company, 'company'), sortable(c.leaders, 'leaders'), sortable(c.tier, 'tier'),
    sortable(c.plan, 'plan'), sortable(c.renewal, 'renewal'), sortable(c.status, 'status'),
  ];

  return (
    <div className="max-w-[68.75rem]">
      <LaunchLine />
      {/* The reference strip (ADR-0211 §3): the five tiers, no *"Your tier"*, no *Talk to us*. */}
      {prices ? (
        <TierCards tiers={prices.tiers} label={T.tiers} />
      ) : pricesError ? (
        <div className="mb-6">
          <ErrorBanner code={pricesError.code} message={OWN.failed} requestId={pricesError.requestId} />
          <Button variant="secondary" className="mt-3" onClick={loadPrices}>{OWN.retry}</Button>
        </div>
      ) : (
        <Skeleton label={OWN.loading}>
          <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-card-edge bg-card p-4">
                <SkeletonBar className="w-2/3" />
                <SkeletonBar className="h-5 w-4/5" />
              </div>
            ))}
          </div>
        </Skeleton>
      )}

      <div className={belowLaptop ? 'mb-3 flex flex-wrap gap-1.5' : 'mb-3 max-w-[18rem]'}>
        {/* **No native select below 1024px** (P19.2-T2 AC-4; UI-134: *a pill that opens a sheet for long lists
            (company)*): the filter a pill, navy once it narrows the list, as the audit's chips are; a laptop keeps its
            select. */}
        {belowLaptop ? (
          <>
            <ChoicePill
              name={T.company}
              options={[{ key: '', label: T.allCompanies }, ...companies.map((co) => ({ key: co.id, label: co.name }))]}
              value={companyId}
              onChange={setCompanyId}
              narrows={companyId !== ''}
            />
            {/* The headings sort on a laptop; below it the sort is a pill (P19.2-T2 AC-4). */}
            <ChoicePill
              name={T.sort}
              options={sortChoices([
                ['kpm', c.kpm], ['company', c.company], ['leaders', c.leaders], ['tier', c.tier], ['plan', c.plan],
                ['renewal', c.renewal], ['status', c.status],
              ])}
              value={sort.key}
              onChange={(key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
              narrows={false}
              shows="value"
            />
          </>
        ) : (
          <Field label={T.company} htmlFor="billing-company">
            <Select id="billing-company" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">{T.allCompanies}</option>
              {companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}
            </Select>
          </Field>
        )}
      </div>

      {error ? (
        <div>
          <ErrorBanner code={error.code} message={T.failed} requestId={error.requestId} />
          <Button variant="secondary" className="mt-3" onClick={loadRows}>{OWN.retry}</Button>
        </div>
      ) : rows === null ? (
        <SkeletonTable caption={T.loading} columns={columns} rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={T.empty} /></div>
      ) : belowLaptop ? (
        <ListCard label={T.caption}>
          {rows.map((row) => (
            <ListRow
              key={row.kpmId}
              data-row={row.kpmId}
              href={`/admin/tenants/${row.kpmId}?tab=billing`}
              ariaLabel={T.openRow({ code: row.code, branch: row.branch })}
              title={`${row.code} · ${row.branch}`}
              meta={row.company.name}
              note={(
                <span className="text-muted">
                  {[
                    `${c.leaders} ${row.leadersUsed}`, `${c.tier} ${tierLabel(row.tier)}`,
                    `${c.plan} ${row.plan ? T.plan[row.plan] : '—'}`,
                    `${c.renewal} ${row.renewalDate ? formatShortDay(row.renewalDate, { year: true }, figures) : '—'}`,
                  ].join(' · ')}
                </span>
              )}
              trailing={<StatusPill status={STATUS_TONE[row.status]} label={T.status[row.status]} />}
            />
          ))}
        </ListCard>
      ) : (
        // Seven columns at the content's width (P19.2-T2 AC-1): a phone and a tablet draw rows, so the 46rem minimum that
        // kept a phone's table scrolling inside its box is gone.
        <DataTable caption={T.caption} columns={columns}>
          {rows.map((row) => (
            <Row key={row.kpmId}>
              <Cell className="font-semibold">
                <Link
                  href={`/admin/tenants/${row.kpmId}?tab=billing`}
                  className="underline"
                  aria-label={T.openRow({ code: row.code, branch: row.branch })}
                >
                  {row.code}
                </Link>
                <span className="block text-sm font-normal text-muted">{row.branch}</span>
              </Cell>
              <Cell>{row.company.name}</Cell>
              <Cell className="whitespace-nowrap">{row.leadersUsed}</Cell>
              <Cell className="whitespace-nowrap">{tierLabel(row.tier)}</Cell>
              <Cell className="whitespace-nowrap">{row.plan ? T.plan[row.plan] : '—'}</Cell>
              <Cell className="whitespace-nowrap">
                {row.renewalDate ? formatShortDay(row.renewalDate, { year: true }, figures) : '—'}
              </Cell>
              <Cell><StatusPill status={STATUS_TONE[row.status]} label={T.status[row.status]} /></Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
