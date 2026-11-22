'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Cell, DataTable, Row } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { productDataAccessMessages } from '@/i18n/messages/product-data-access';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { formatDateTime, OFFICE_TIME_ZONE } from '@/lib/format';
import { readProductDataChanges, type ProductDataChange } from '@/lib/product-data-grants';
import { useMediaQuery } from '@/lib/use-media-query';

/** The company's *Proposal* tab, where a table version a manager turned on can be turned off (the P1b spec's *Undo*). */
export const proposalTabOf = (companyId: string) => `/admin/companies/${companyId}/proposal`;

/**
 * **The change's line in the audit log**: the platform's log, where every change to a company's data is written whoever
 * made it (ADR-0260 §6, amended 2026-11-12) — never the manager's KPM's, which `kpmId` names only to say who they are —
 * narrowed to its actor and its action, so it is the newest line there. The audit page reads these from its address.
 */
export function auditLineOf(change: ProductDataChange): string {
  const query = new URLSearchParams({ actorUserId: change.actorUserId, action: change.action });
  return `/admin/audit?${query.toString()}`;
}

/**
 * ***Perubahan oleh pengelola*** (P19.15-T4 AC-2; ADR-0260 §6; the P1b spec's *Rules*: *"a list … of every change made
 * by users with this access, each linking to its intake and audit entry"*): the second tab of *KPM Owners & Admins*.
 * Every change a product data manager made to an insurer's premium tables, rules, uploads and illustrations, newest
 * first, fifty at a time with *Muat lagi* — read from the audit log by the server. Each line links to the company's
 * *Proposal* tab, where the upload and the table version are, and to its line in the audit log.
 *
 * **From 1024px a table** (when · change · product · by); **below it one line each**, the two links under it — no table
 * to scroll sideways (UI-126).
 */
export function ProductDataChanges() {
  const t = useMessages(productDataAccessMessages).changes;
  const figures = useFigureLanguage();
  const rows = useMediaQuery(['phone', 'tablet']);
  const COLUMNS = [t.columns.when, t.columns.change, t.columns.product, t.columns.by];
  const [items, setItems] = useState<ProductDataChange[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readProductDataChanges()
      .then((page) => {
        if (!live) return;
        setItems(page.items);
        setNext(page.page.nextCursor);
      })
      .catch((err) => {
        if (!live) return;
        setError(toDisplayError(err));
        setItems([]);
      });
    return () => { live = false; };
  }, []);

  const loadMore = useCallback(async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await readProductDataChanges(next);
      setItems((before) => [...(before ?? []), ...page.items]);
      setNext(page.page.nextCursor);
    } catch (err) {
      setError(toDisplayError(err));
    } finally {
      setLoadingMore(false);
    }
  }, [next]);

  const when = (change: ProductDataChange) => (
    <time dateTime={change.createdAt}>{formatDateTime(change.createdAt, OFFICE_TIME_ZONE, figures)}</time>
  );
  // A change that names no product and no company — an upload read for every insurer — says so with a dash, not a blank.
  const product = (change: ProductDataChange) => [change.productName, change.companyName].filter(Boolean).join(' · ') || '—';
  // 44px tall below 1024px (UI-142: tap targets on a phone and a tablet), a line of text from 1024px.
  const LINK = 'inline-flex min-h-11 items-center text-primary-deep underline-offset-2 hover:underline lg:min-h-0';
  const links = (change: ProductDataChange) => (
    <span className="flex flex-wrap gap-x-4 text-sm font-semibold">
      {change.companyId && (
        <Link href={proposalTabOf(change.companyId)} className={LINK}>
          {t.openProposal({ company: change.companyName ?? '' })}
        </Link>
      )}
      <Link href={auditLineOf(change)} className={LINK}>{t.inAudit}</Link>
    </span>
  );

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner {...error} />}
      {items === null && !error && <SkeletonTable caption={t.caption} columns={COLUMNS} rows={4} />}
      {items && items.length === 0 && !error && (
        <Card><EmptyState title={t.empty} /></Card>
      )}
      {items && items.length > 0 && (
        rows ? (
          <ul aria-label={t.caption} className="rounded-lg bg-card [&>li+li]:border-t [&>li+li]:border-divider">
            {items.map((change) => (
              <li key={change.auditId} data-change-row="" className="flex flex-col gap-1 px-3 py-2.5">
                <p className="break-words text-md font-bold text-ink">{change.actionLabel}</p>
                <p className="break-words text-sm text-ink">{product(change)}</p>
                <p className="break-words text-sm text-muted">
                  {change.actorName ?? change.actorUserId}
                  {change.officeLabel && <> · {change.officeLabel}</>}
                  {' · '}
                  {when(change)}
                </p>
                {links(change)}
              </li>
            ))}
          </ul>
        ) : (
          <DataTable caption={t.caption} columns={COLUMNS}>
            {items.map((change) => (
              <Row key={change.auditId}>
                <Cell className="whitespace-nowrap align-top text-muted">{when(change)}</Cell>
                <Cell className="align-top">
                  <span className="block font-semibold">{change.actionLabel}</span>
                  {links(change)}
                </Cell>
                <Cell className="align-top">{product(change)}</Cell>
                <Cell className="align-top">
                  <span className="block font-semibold text-navy">{change.actorName ?? change.actorUserId}</span>
                  {change.officeLabel && <span className="block text-sm text-muted">{change.officeLabel}</span>}
                </Cell>
              </Row>
            ))}
          </DataTable>
        )
      )}
      {next && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-card text-base font-semibold text-primary-deep hover:bg-hover-row disabled:opacity-60"
        >
          {loadingMore ? t.loadingMore : t.loadMore}
        </button>
      )}
    </div>
  );
}
