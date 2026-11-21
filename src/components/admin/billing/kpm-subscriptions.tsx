'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { NavIcon } from '@/components/ui/nav-icon';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { billingMessages } from '@/i18n/messages/billing';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  listBillingKpms, tierRange, type BillingAttention, type BillingKpmFilter, type BillingKpmList, type BillingKpmRow,
  type BillingPrices,
} from '@/lib/billing';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { CalculatorDialog } from './calculator-dialog';

/** The pill's tone: red for what is wrong now, amber for what is coming, grey for a KPM already suspended. */
const PILL: Record<BillingAttention, string> = {
  over: 'bg-alert/10 text-alert',
  ended: 'bg-alert/10 text-alert',
  ending_soon: 'bg-primary-50 text-primary-ink',
  trial: 'bg-primary-50 text-primary-ink',
  suspended: 'bg-base text-muted',
};

/**
 * ***Langganan per KPM*** (P19.23-T5 AC-4; ADR-0279 §6; frames f48–f49): the navy summary — *Pendapatan per bulan*,
 * *Leader ditagih*, *Berakhir ≤ 30 hari*, *Perlu tindakan* — *Semua / Perlu tindakan*, the ***Total*** row, and a row
 * per KPM: name and company, *Leader dipakai* against the limit (a bar, red when over), *Harga / leader* with its plan,
 * *Per bulan*, *Tagihan per periode*, *Berlaku hingga* with its one pill only when action is needed, and ***Atur*** → the
 * calculator for that KPM. Every figure is the server's (`GET /admin/billing/kpms`).
 *
 * On a phone the table is cards, each value under its column's name (§12), the filter a row of two equal halves.
 */
export function KpmSubscriptions({ prices }: { prices: BillingPrices }) {
  const T = useMessages(billingMessages);
  const K = T.kpms;
  const fig = useFigureLanguage();
  const phone = useMediaQuery('phone');
  const [filter, setFilter] = useState<BillingKpmFilter>('all');
  const [list, setList] = useState<BillingKpmList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [managing, setManaging] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setList(null);
    listBillingKpms(filter).then(setList).catch((err) => setError(toDisplayError(err)));
  }, [filter]);
  useEffect(load, [load]);

  const n = (value: number) => formatNumber(value, {}, fig);
  const money = (minor: number) => formatRupiah(minor, fig);
  const columns = [K.columns.kpm, K.columns.used, K.columns.rate, K.columns.perMonth, K.columns.perPeriod, K.columns.until,
    { label: K.columns.manage, visuallyHidden: true as const }];

  const summary = list?.summary;
  const filterRow = (
    <div role="group" aria-label={K.filterLabel} className={cn('inline-flex rounded-pill border border-hairline bg-card p-[3px]', phone && 'grid w-full grid-cols-2')}>
      {(['all', 'needs_action'] as const).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={filter === key}
          onClick={() => setFilter(key)}
          className={cn(
            'inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-pill px-3.5 text-sm font-semibold',
            filter === key ? 'bg-secondary text-secondary-contrast' : 'text-muted hover:text-navy',
          )}
        >
          {key === 'all' ? K.all({ n: summary ? n(summary.kpms) : '…' }) : K.needsAction({ n: summary ? n(summary.needsAction) : '…' })}
        </button>
      ))}
    </div>
  );

  const used = (r: BillingKpmRow) => {
    const over = r.maxLeaders !== null && r.leadersUsed > r.maxLeaders;
    return (
      <div>
        <span className="text-sm">
          <b className={cn(over && 'text-alert')}>{n(r.leadersUsed)}</b>
          {' / '}{r.maxLeaders === null ? K.noLimit : n(r.maxLeaders)}
        </span>
        {r.maxLeaders !== null && (
          <span
            role="img"
            aria-label={K.usedOf({ used: n(r.leadersUsed), max: n(r.maxLeaders) })}
            className="mt-1 block h-1.5 w-24 overflow-hidden rounded-pill bg-base"
          >
            <span
              className={cn('block h-full rounded-pill', over ? 'bg-alert' : 'bg-secondary')}
              style={{ width: `${Math.min(100, (r.leadersUsed / Math.max(r.maxLeaders, 1)) * 100)}%` }}
            />
          </span>
        )}
      </div>
    );
  };
  const rate = (r: BillingKpmRow) => (
    <>
      <span className="block">{r.rateMinor === null ? '–' : money(r.rateMinor)}</span>
      <small className="block text-xs text-muted">
        {r.customPrice ? `${K.customPrice} · ` : ''}{K.plan({ range: tierRange(r.tier) })}
      </small>
    </>
  );
  const period = (r: BillingKpmRow) => (r.periodTotalMinor === null ? '–' : (
    <>
      <b className="block">{money(r.periodTotalMinor)}</b>
      <small className="block text-xs text-muted">
        {r.plan === 'annual' ? K.billedAnnual({ pct: formatPercent(prices.annualDiscountPct, {}, fig) }) : K.billedSix}
      </small>
    </>
  ));
  const until = (r: BillingKpmRow) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{r.endDate ? formatCalendarDay(r.endDate, fig) : '—'}</span>
      {r.attention && <span className={cn('rounded-pill px-2 py-0.5 text-xs font-bold', PILL[r.attention])}>{K.pills[r.attention]}</span>}
    </span>
  );
  const manage = (r: BillingKpmRow) => (
    <button
      type="button"
      onClick={() => setManaging(r.kpmId)}
      aria-label={K.manageOf({ branch: r.branch })}
      className="inline-flex min-h-10 items-center gap-0.5 rounded-md px-1.5 text-sm font-bold text-primary-ink"
    >
      {K.manage}
      <NavIcon name="ti-chevron-down" className="h-4 w-4 -rotate-90" />
    </button>
  );

  let body: ReactNode;
  if (error) {
    body = (
      <div>
        <ErrorBanner code={error.code} message={T.failed} requestId={error.requestId} />
        <Button variant="secondary" className="mt-3" onClick={load}>{T.retry}</Button>
      </div>
    );
  } else if (!list) {
    body = <SkeletonTable caption={K.caption} columns={columns} rows={5} />;
  } else if (list.rows.length === 0) {
    body = (
      <div className="rounded-2xl bg-card">
        <EmptyState title={filter === 'all' ? K.empty : K.emptyAction} variant={filter === 'all' ? 'empty' : 'filtered'} />
      </div>
    );
  } else {
    const t = list.total;
    const totalCells: [string, ReactNode][] = [
      [K.columns.used, K.leaders({ n: n(t.leadersUsed) })],
      [K.columns.rate, t.weightedRateMinor === null ? '–' : (
        <><b className="block">{money(t.weightedRateMinor)}</b><small className="block text-xs text-muted">{K.weighted}</small></>
      )],
      [K.columns.perMonth, <><b className="block">{money(t.perMonthMinor)}</b><small className="block text-xs text-muted">{K.perMonthSub}</small></>],
      [K.columns.perPeriod, <><b className="block">{money(t.periodTotalMinor)}</b><small className="block text-xs text-muted">{K.running}</small></>],
      [K.columns.until, K.totalAction({ n: n(t.needsAction) })],
    ];
    body = phone ? (
      <ul aria-label={K.caption} className="space-y-2">
        <li className="rounded-2xl bg-primary-50 p-3.5">
          <b className="block text-md text-navy">{K.total({ n: n(t.kpms) })}</b>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-navy">
            {totalCells.map(([label, value]) => (
              <div key={label}><dt className="text-xs font-bold text-muted">{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </li>
        {list.rows.map((r) => (
          <li key={r.kpmId} data-row={r.kpmId} className="rounded-2xl bg-card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <b className="block text-md text-navy">{r.branch}</b>
                <small className="block text-xs text-muted">{r.company.name}</small>
              </span>
              {manage(r)}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-navy">
              <div><dt className="text-xs font-bold text-muted">{K.columns.used}</dt><dd>{used(r)}</dd></div>
              <div><dt className="text-xs font-bold text-muted">{K.columns.rate}</dt><dd>{rate(r)}</dd></div>
              <div><dt className="text-xs font-bold text-muted">{K.columns.perMonth}</dt><dd>{r.perMonthMinor === null ? '–' : money(r.perMonthMinor)}</dd></div>
              <div><dt className="text-xs font-bold text-muted">{K.columns.perPeriod}</dt><dd>{period(r)}</dd></div>
              <div className="col-span-2"><dt className="text-xs font-bold text-muted">{K.columns.until}</dt><dd>{until(r)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    ) : (
      <DataTable caption={K.caption} columns={columns}>
        <Row className="bg-base">
          <Cell className="font-bold">{K.total({ n: n(t.kpms) })}</Cell>
          {totalCells.map(([label, value]) => <Cell key={label}>{value}</Cell>)}
          <Cell />
        </Row>
        {list.rows.map((r) => (
          <Row key={r.kpmId} data-row={r.kpmId}>
            <Cell>
              <b className="block">{r.branch}</b>
              <small className="block text-xs text-muted">{r.company.name}</small>
            </Cell>
            <Cell>{used(r)}</Cell>
            <Cell>{rate(r)}</Cell>
            <Cell className="whitespace-nowrap">{r.perMonthMinor === null ? '–' : money(r.perMonthMinor)}</Cell>
            <Cell>{period(r)}</Cell>
            <Cell>{until(r)}</Cell>
            <Cell className="text-right">{manage(r)}</Cell>
          </Row>
        ))}
      </DataTable>
    );
  }

  return (
    <div>
      <div className={cn('mb-3', !phone && 'flex justify-end')}>{filterRow}</div>
      {summary && (
        <section aria-label={K.summaryLabel} className="mb-3 rounded-[20px] bg-secondary p-3 text-secondary-contrast md:p-4">
          <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {([
              [K.revenue, money(summary.monthlyRevenueMinor), K.revenueSub({ n: n(summary.payingKpms) })],
              [K.billed, n(summary.leadersBilled), K.billedSub],
              [K.soon, n(summary.endingSoon), K.soonSub],
              [K.action, n(summary.needsAction), K.actionSub],
            ] as [string, string, string][]).map(([label, value, sub]) => (
              <div key={label} className="min-w-0 rounded-xl bg-secondary-contrast/[0.08] px-3 py-2">
                <dt className="text-sm font-semibold">{label}</dt>
                <dd>
                  <b className="block truncate text-[1.625rem] font-extrabold leading-tight text-primary">{value}</b>
                  <span className="block truncate text-xs text-secondary-contrast/75">{sub}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {body}
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>{K.ownersNote}</span>
        <span>{K.lapseNote({ days: n(prices.graceDays) })}</span>
      </div>
      {managing && (
        <CalculatorDialog
          kpmId={managing}
          onClose={() => setManaging(null)}
          onConfirmed={() => { setManaging(null); load(); }}
        />
      )}
    </div>
  );
}
