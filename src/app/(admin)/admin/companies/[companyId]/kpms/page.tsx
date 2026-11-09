'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { CompanyFrame, useCompany } from '@/components/kpm-template/company-frame';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminPlatformReadsMessages } from '@/i18n/messages/admin-platform-reads';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatMonth, formatNumber, formatRupiahCompact } from '@/lib/format';
import { readCompanyKpms, type CompanyKpmRow, type CompanyKpmsView } from '@/lib/platform-reads';
import { useMediaQuery } from '@/lib/use-media-query';

/**
 * ***KPM & data*** (`/admin/companies/[companyId]/kpms`; P19.4-T3 AC-15; the setup spec's A2; ADR-0207 §2): three tiles —
 * the KPMs and their Owners signed in, the members and those never signed in, the KPMs complete for the month — and the
 * company's KPMs for the latest month: *Manpower*, *MAA*, *APE YTD*, *Rekrutmen YTD*, the data status and the peer
 * status (D4: *"Belum cukup KPM pembanding"* under three). Every figure the Overview's own function over the KPM; read
 * only, and audited by the server per read. **No *"Unggah data semua KPM"* card** (Decisions item 8): the data upload is
 * each KPM's.
 *
 * **Below 1024px a row per KPM** (P19.2-T2 AC-1; UI-126): *KPM 0417* opening it, the branch, each figure after its
 * column's words and the peer status under them, the data status on the right. From 1024px the table, at the content's
 * width (its 52rem minimum, there for a phone, is gone).
 */
export default function CompanyKpmsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = use(params);
  const t = useMessages(adminPlatformReadsMessages).kpmData;
  const figures = useFigureLanguage();
  const company = useCompany(companyId);
  const [view, setView] = useState<CompanyKpmsView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const belowLaptop = useMediaQuery(['phone', 'tablet']);

  useEffect(() => {
    let live = true;
    setError(null);
    readCompanyKpms(companyId)
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [companyId, attempt]);

  const month = view ? formatMonth(view.month, figures) : '';
  const columns = [
    t.columns.kpm, t.columns.manpower, t.columns.maa, t.columns.ape, t.columns.recruitment, t.columns.data({ month }),
    t.columns.peers,
  ];
  const n = (value: number | null) => (value === null ? '—' : formatNumber(value, {}, figures));

  return (
    <CompanyFrame companyId={companyId} company={company} permission="platform_kpm_figures:read">
      {error && (
        <div className="mb-4 flex flex-col gap-2">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="self-start" onClick={() => setAttempt((x) => x + 1)}>{t.retry}</Button>
        </div>
      )}
      {!error && view === null && <SkeletonTable caption={t.loading} columns={columns} rows={4} />}
      {view && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Tile label={t.tiles.kpms} value={n(view.tiles.kpms)} sub={t.tiles.activeOwners({ n: view.tiles.activeOwners })} />
            <Tile label={t.tiles.members} value={n(view.tiles.members)} sub={t.tiles.notSignedIn({ n: view.tiles.notSignedIn })} />
            <Tile
              label={t.tiles.complete({ month })}
              value={t.tiles.of({ n: view.tiles.complete, of: view.tiles.kpms })}
              // A KPM's peers are the *other* complete KPMs (ADR-0215 §5): enough once each complete one has three besides it.
              sub={view.tiles.complete - 1 < view.tiles.needed ? t.tiles.needsThree({ n: view.tiles.needed }) : t.tiles.enough}
            />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-navy">{t.heading({ month })}</h2>
            <p className="text-sm text-muted">{t.rowHint}</p>
          </div>
          {view.rows.length === 0 ? (
            <div className="rounded-lg border border-card-edge bg-card"><EmptyState title={t.empty} /></div>
          ) : belowLaptop ? (
            <ListCard label={t.heading({ month })}>
              {view.rows.map((row) => (
                <ListRow
                  key={row.kpmId}
                  data-row={row.kpmId}
                  href={`/admin/tenants/${row.kpmId}`}
                  title={t.rowKpm({ code: row.code })}
                  meta={row.branch}
                  note={(
                    <span className="flex flex-col text-muted">
                      <span>{`${t.columns.manpower} ${n(row.manpower)} · ${t.columns.maa} ${n(row.maa)}`}</span>
                      <span>
                        {`${t.columns.ape} ${row.apeYtdMinor === null ? '—' : formatRupiahCompact(row.apeYtdMinor, {}, figures)} · ${t.columns.recruitment} ${n(row.recruitmentYtd)}`}
                      </span>
                      <span>{t.columns.peers}: <Peers row={row} /></span>
                    </span>
                  )}
                  trailing={<StatusPill status={row.data === 'complete' ? 'success' : 'alert'} label={t.data[row.data]} />}
                />
              ))}
            </ListCard>
          ) : (
            <DataTable caption={t.heading({ month })} columns={columns}>
              {view.rows.map((row) => (
                <Row key={row.kpmId}>
                  <Cell className="font-semibold">
                    <Link href={`/admin/tenants/${row.kpmId}`} className="underline">{t.rowKpm({ code: row.code })}</Link>
                    <span className="block text-sm font-normal text-muted">{row.branch}</span>
                  </Cell>
                  <Cell className="tabular-nums">{n(row.manpower)}</Cell>
                  <Cell className="tabular-nums">{n(row.maa)}</Cell>
                  <Cell className="tabular-nums">{row.apeYtdMinor === null ? '—' : formatRupiahCompact(row.apeYtdMinor, {}, figures)}</Cell>
                  <Cell className="tabular-nums">{n(row.recruitmentYtd)}</Cell>
                  <Cell>
                    <StatusPill status={row.data === 'complete' ? 'success' : 'alert'} label={t.data[row.data]} />
                  </Cell>
                  <Cell className="text-sm"><Peers row={row} /></Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </div>
      )}
    </CompanyFrame>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums text-navy">{value}</p>
      <p className="text-sm text-muted">{sub}</p>
    </Card>
  );
}

/** The D4 peer status (ADR-0215 §5): enough peers, not enough (*n dari 3*), or not counted — the KPM's own month missing. */
function Peers({ row }: { row: CompanyKpmRow }) {
  const t = useMessages(adminPlatformReadsMessages).kpmData.peers;
  if (row.peers.status === 'not_counted') return <span className="text-muted">{t.notCounted}</span>;
  if (row.peers.status === 'not_enough') return <>{t.notEnough({ n: row.peers.count, of: row.peers.needed })}</>;
  return <>{t.enough({ n: row.peers.count })}</>;
}
