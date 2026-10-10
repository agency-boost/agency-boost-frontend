'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import {
  formatCount, officeState, PLATFORM_ANALYTICS_COPY as COPY, PLATFORM_ANALYTICS_HEADINGS, platformHeadings,
  readPlatformAnalytics,
  rungWords, signedInWords, tableRows, type Adoption, type PlatformAnalyticsView,
} from '@/lib/admin-analytics';
import { toDisplayError, type ApiError } from '@/lib/api-client';

/**
 * **Cross-platform analytics** (P18-T8), the console's last nav item (`Superadmin.html:204`), which the
 * prototype draws only as a name. OD-148 answered what is behind it: **adoption across offices, inside
 * ADR-0011's line** — one table, in *All KPMs*' idiom (`/admin/tenants`): a row per office, a total per
 * company and one for the platform. Counts only; nothing on it names a member, and the read it draws
 * from carries no name to draw.
 *
 * Not sortable, as *All KPMs* is not. The skeleton and the table read the same headings, so the
 * placeholder is the width of what it stands in for.
 *
 * The route's own gate (`platform_analytics:read`), inside the console's; the read sits below it, so a
 * reader the gate refuses asks the API for nothing.
 */
const COLUMNS: readonly Column[] = PLATFORM_ANALYTICS_HEADINGS;

/**
 * **A minimum width, so the table scrolls inside its card** on a phone rather than squashing ten
 * columns into 360px, and the page body never scrolls sideways. The card itself is `relative` as well
 * as the table, so nothing positioned inside it escapes the scroll box.
 */
const TABLE_WIDTH = 'min-w-[64rem]';

export default function PlatformAnalyticsPage() {
  return (
    <Page title={COPY.title} subtitle={COPY.subtitle} permission="platform_analytics:read">
      <PlatformAnalytics />
    </Page>
  );
}

function PlatformAnalytics() {
  const [view, setView] = useState<PlatformAnalyticsView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    setError(null);
    setView(null);
    readPlatformAnalytics()
      .then(setView)
      .catch((err) => setError(toDisplayError(err)));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div>
        <ErrorBanner {...error} />
        <Button variant="secondary" className="mt-3" onClick={load}>{COPY.tryAgain}</Button>
      </div>
    );
  }

  if (view === null) {
    return <SkeletonTable caption={COPY.caption} columns={COLUMNS} rows={5} />;
  }

  if (view.offices.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-card">
        <EmptyState title={COPY.empty} />
      </div>
    );
  }

  return (
    <DataTable caption={COPY.caption} columns={platformHeadings(view.month)} className="relative" tableClassName={TABLE_WIDTH}>
      {tableRows(view).map((row) => {
        if (row.kind === 'office') {
          const { office } = row;
          const state = officeState(office.state);
          return (
            <Row key={`office-${office.kpmId}`}>
              <Cell className="font-semibold">
                <Link href={`/admin/tenants/${office.kpmId}`} className="underline">
                  {office.code}
                </Link>
              </Cell>
              <Cell>{office.branch}</Cell>
              <Cell>{office.company.name}</Cell>
              <Cell>
                <StatusPill status={state.tone} label={state.word} />
              </Cell>
              <Figures figures={office} />
            </Row>
          );
        }
        if (row.kind === 'company') {
          const { company } = row;
          return (
            <Row key={`company-${company.id}`} className="bg-base font-semibold">
              <Cell colSpan={4}>{COPY.companyTotal(company.name, company.offices)}</Cell>
              <Figures figures={company} />
            </Row>
          );
        }
        const { platform } = row;
        return (
          <Row key="platform" className="bg-navy/5 font-bold">
            <Cell colSpan={4}>{COPY.platformTotal(platform.companies, platform.offices)}</Cell>
            <Figures figures={platform} />
          </Row>
        );
      })}
    </DataTable>
  );
}

/** The six figures every row carries, an office's or a total's, in the headings' order. */
function Figures({ figures }: { figures: Adoption }) {
  return (
    <>
      <Cell className="whitespace-nowrap">{formatCount(figures.members)}</Cell>
      <Cell>{rungWords(figures.byRung)}</Cell>
      <Cell className="whitespace-nowrap">{formatCount(figures.joinedThisMonth)}</Cell>
      <Cell className="whitespace-nowrap">{formatCount(figures.leftThisMonth)}</Cell>
      <Cell className="whitespace-nowrap">{signedInWords(figures.signedIn7d, figures.members)}</Cell>
      <Cell className="whitespace-nowrap">{signedInWords(figures.signedIn30d, figures.members)}</Cell>
    </>
  );
}
