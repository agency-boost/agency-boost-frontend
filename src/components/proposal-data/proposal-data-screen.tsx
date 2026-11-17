'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable, SkeletonText } from '@/components/ui/skeleton';
import { TonePill, type PillTone } from '@/components/ui/tone-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataMessages } from '@/i18n/messages/product-data';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatDateTime } from '@/lib/format';
import {
  PRODUCT_DATA_STATUSES, readProductDataOverview, type ProductDataOverview, type ProductDataRow, type ProductDataStatus,
} from '@/lib/product-data';
import { useMediaQuery } from '@/lib/use-media-query';
import { IntakeButton } from './intake-button';

/**
 * **A product, loaded when its row is first opened** (the bundle, 2026-11-12): its four tabs bring the agent's card, the
 * PDF box and the table forms, which the list does not need — the page stays within the 200 kB first-load budget.
 */
const ProductDetail = dynamic(() => import('./product-detail').then((m) => m.ProductDetail), {
  loading: () => <SkeletonText lines={6} />,
});

/** A status's pill: soft tint and words, never a dot (UI-005). */
export const STATUS_TONE: Record<ProductDataStatus, PillTone> = { check: 'amber', manual: 'grey', ready: 'green', withdrawn: 'red' };

/**
 * **An insurer's *Proposal* tab** (P19.15-T1, T4 AC-1; ADR-0258 §8; the P1b spec's §1 to §3) — the Super Admin's at
 * *Perusahaan* › {company} › *Proposal*, and the same screen on the office console's *Data produk* (ADR-0260 §5):
 *
 * 1. ***Unggah file*** at the top (T3's, `IntakeButton`).
 * 2. **Four counters** — *Siap hitung*, *Ketik manual*, *Perlu dicek*, *Ditarik* — each a button that filters the list,
 *    and *"Terakhir diperbarui: {date} oleh {name}"*.
 * 3. **One row per product**: *Produk* (name, category, *Syariah*), *Cara hitung*, *Tabel premi* (*Berlaku …* green,
 *    *Belum ada* grey, *Berakhir …* and *Ada celah* amber, with *"Tarif baru mulai …"* under it), *Ilustrasi*, *Status* —
 *    *Perlu dicek* first. **Cards below 1024px**, the same words.
 * 4. **A product**, opened from its row: *Isian*, *Tabel premi*, *Ilustrasi*, *Uji coba* (`ProductDetail`).
 *
 * **`canManage`** is the caller's (the route's) and the server's (`overview.canManage`) together: a reader who may only
 * read sees every state and no control — the server refuses the writes too.
 */
export function ProposalDataScreen({ companyId, canManage }: { companyId: string; canManage: boolean }) {
  const t = useMessages(productDataMessages);
  const figures = useFigureLanguage();
  const cards = useMediaQuery(['phone', 'tablet']);
  const [overview, setOverview] = useState<ProductDataOverview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<ProductDataStatus | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await readProductDataOverview(companyId));
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  const manage = canManage && (overview?.canManage ?? false);

  if (open && overview) {
    const row = overview.products.find((p) => p.productId === open);
    return (
      <ProductDetail
        companyId={companyId}
        productId={open}
        name={row?.name ?? ''}
        canManage={manage}
        onBack={() => { setOpen(null); void load(); }}
      />
    );
  }

  const rows = overview?.products.filter((p) => filter === null || p.status === filter) ?? [];
  const last = overview?.lastUpdated ?? null;

  return (
    <div data-proposal-data={companyId} className="flex flex-col gap-4">
      <IntakeButton companyId={companyId} canManage={manage} />
      {error && <ErrorBanner {...error} />}
      {!overview && !error && (
        <SkeletonTable caption={t.title} columns={[t.columns.product, t.columns.calc, t.columns.table, t.columns.illustration, t.columns.status]} />
      )}
      {overview && (
        <>
          <div role="group" aria-label={t.counters.label} className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PRODUCT_DATA_STATUSES.map((status) => {
              const on = filter === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={on}
                  data-counter={status}
                  onClick={() => setFilter(on ? null : status)}
                  className={cn(
                    'flex min-h-16 flex-col items-start justify-center rounded-lg border px-4 py-3 text-left',
                    on ? 'border-secondary bg-secondary text-secondary-contrast' : 'border-hairline bg-card text-navy hover:bg-hover-row',
                  )}
                >
                  <span className="text-2xl font-bold leading-none">{overview.counters[status]}</span>
                  <span className="mt-1 text-sm font-semibold">{t.counters[status]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {last ? (
              <p data-last-updated="" className="text-sm text-muted">
                {last.by?.name
                  ? t.lastUpdated({ date: formatDateTime(last.at, undefined, figures), name: last.by.name })
                  : t.lastUpdatedNoName({ date: formatDateTime(last.at, undefined, figures) })}
              </p>
            ) : <span />}
            {filter !== null && <Button variant="inline" onClick={() => setFilter(null)}>{t.counters.filterAll}</Button>}
          </div>
          {!manage && <p className="text-sm text-muted">{t.readOnly}</p>}
          {overview.products.length === 0 ? (
            <EmptyState title={t.empty} />
          ) : rows.length === 0 ? (
            <EmptyState variant="filtered" title={t.emptyFilter} />
          ) : cards ? (
            <ul className="flex flex-col gap-3" aria-label={t.caption({ company: overview.company.name })}>
              {rows.map((row) => (
                <li key={row.productId}>
                  <button
                    type="button"
                    data-product-row={row.code}
                    aria-label={t.open({ product: row.name })}
                    onClick={() => setOpen(row.productId)}
                    className="flex w-full flex-col gap-2 rounded-lg bg-card p-4 text-left hover:bg-hover-row"
                  >
                    <span className="flex items-start justify-between gap-2">
                      {productName(row)}
                      <TonePill tone={STATUS_TONE[row.status]}>{t.statuses[row.status]}</TonePill>
                    </span>
                    <span className="text-sm text-navy"><span className="text-muted">{t.columns.calc}:</span> {t.calcTypes[row.calcType]}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-navy">
                      <span className="text-muted">{t.columns.table}:</span> {tableCell(row)}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-navy">
                      <span className="text-muted">{t.columns.illustration}:</span> {illustrationCell(row)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <DataTable
              caption={t.caption({ company: overview.company.name })}
              columns={[t.columns.product, t.columns.calc, t.columns.table, t.columns.illustration, t.columns.status]}
            >
              {rows.map((row) => (
                <Row key={row.productId} data-row={row.code}>
                  <Cell>
                    <button
                      type="button"
                      data-product-row={row.code}
                      aria-label={t.open({ product: row.name })}
                      onClick={() => setOpen(row.productId)}
                      className="min-h-8 text-left hover:underline"
                    >
                      {productName(row)}
                    </button>
                  </Cell>
                  <Cell>{t.calcTypes[row.calcType]}</Cell>
                  <Cell>{tableCell(row)}</Cell>
                  <Cell>{illustrationCell(row)}</Cell>
                  <Cell><TonePill tone={STATUS_TONE[row.status]}>{t.statuses[row.status]}</TonePill></Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </>
      )}
    </div>
  );

  function productName(row: ProductDataRow) {
    return (
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-navy">{row.name}</span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {row.category}
          {row.isSyariah && <TonePill tone="green">{t.syariah}</TonePill>}
          {row.checkReasons.length > 0 && <span>· {row.checkReasons.map((r) => t.reasons[r]).join(', ')}</span>}
        </span>
      </span>
    );
  }

  function tableCell(row: ProductDataRow) {
    const { table } = row;
    const date = (day: string | null) => (day ? formatCalendarDay(day, figures) : '');
    const pill = table.state === 'none'
      ? <TonePill tone="grey">{t.tableStates.none}</TonePill>
      : table.state === 'ending'
        ? <TonePill tone="amber">{t.tableStates.ending({ date: date(table.effectiveTo) })}</TonePill>
        : table.state === 'gaps'
          ? <TonePill tone="amber">{t.tableStates.gaps}</TonePill>
          : <TonePill tone="green">{t.tableStates.active({ date: date(table.effectiveFrom) })}</TonePill>;
    return (
      <span className="inline-flex flex-col items-start gap-1">
        {pill}
        {table.scheduledFrom && <span data-scheduled="" className="text-xs text-muted">{t.scheduledFrom({ date: date(table.scheduledFrom) })}</span>}
      </span>
    );
  }

  function illustrationCell(row: ProductDataRow) {
    return row.illustration.state === 'published'
      ? <TonePill tone="green">{t.illustrationStates.published({ n: row.illustration.blocks })}</TonePill>
      : <TonePill tone="grey">{t.illustrationStates.none}</TonePill>;
  }
}
