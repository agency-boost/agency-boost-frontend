'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { Cell, DataTable, Row, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, ErrorBanner } from '@/components/ui/field';
import { ListCard, ListRow } from '@/components/ui/list-rows';
import { SkeletonTable } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/ui/status-pill';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { adminAnalyticsMessages } from '@/i18n/messages/admin-analytics';
import {
  analyticsHeadings, companyTotalWords, formatCount, officeState, platformHeadings, platformTotalWords,
  readPlatformAnalytics, rungWords, signedInWords, tableRows, type Adoption, type PlatformAnalyticsView,
} from '@/lib/admin-analytics';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { useMediaQuery } from '@/lib/use-media-query';
import { KpmComparison } from '@/components/admin/kpm-comparison';

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
/*
 * *Removed 2026-11-06 (P19.2-T2 AC-1; UI-126):* `TABLE_WIDTH`, a 64rem minimum so the table scrolled inside its card on
 * a phone. A phone and a tablet draw rows now, and on a laptop the minimum was wider than the content (it scrolled at
 * 1024 and 1280), so the table takes the content's width and its cells wrap.
 */

export default function PlatformAnalyticsPage() {
  const COPY = useMessages(adminAnalyticsMessages);
  const canCompare = useCan('platform_kpm_figures:read');
  return (
    <Page title={COPY.title} permission="platform_analytics:read">
      <PlatformAnalytics />
      {/* P19.4-T3 AC-3 (SA UI-013, SA R4): the adoption figures stay above; the KPMs compared on the Overview's own
          figures follow, for a reader who holds the comparison's grant (the API refuses anybody else). */}
      {canCompare && <KpmComparison />}
    </Page>
  );
}

function PlatformAnalytics() {
  const COPY = useMessages(adminAnalyticsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const COLUMNS: readonly Column[] = analyticsHeadings(language);
  /** **Below 1024px rows** (P19.2-T2 AC-1; UI-126): an office, a company's total, the platform's, in the table's order. */
  const rows = useMediaQuery(['phone', 'tablet']);
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
      <div className="rounded-lg border border-card-edge bg-card">
        <EmptyState title={COPY.empty} />
      </div>
    );
  }

  const headings = platformHeadings(view.month, figures, language);
  if (rows) {
    return (
      <ListCard label={COPY.caption}>
        {tableRows(view).map((row) => {
          if (row.kind === 'office') {
            const { office } = row;
            const state = officeState(office.state, language);
            return (
              <ListRow
                key={`office-${office.kpmId}`}
                data-row={office.kpmId}
                href={`/admin/tenants/${office.kpmId}`}
                title={`${office.code} · ${office.branch}`}
                meta={office.company.name}
                note={<FigureLines figures={office} headings={headings} />}
                trailing={<StatusPill status={state.tone} label={state.word} />}
              />
            );
          }
          const total = row.kind === 'company' ? row.company : row.platform;
          return (
            <ListRow
              key={row.kind === 'company' ? `company-${row.company.id}` : 'platform'}
              className={row.kind === 'company' ? 'bg-base' : 'bg-secondary/5'}
              title={row.kind === 'company'
                ? companyTotalWords(row.company.name, row.company.offices, figures, language)
                : platformTotalWords(row.platform.companies, row.platform.offices, figures, language)}
              note={<FigureLines figures={total} headings={headings} />}
            />
          );
        })}
      </ListCard>
    );
  }

  return (
    <DataTable caption={COPY.caption} columns={headings} className="relative">
      {tableRows(view).map((row) => {
        if (row.kind === 'office') {
          const { office } = row;
          const state = officeState(office.state, language);
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
              <Cell colSpan={4}>{companyTotalWords(company.name, company.offices, figures, language)}</Cell>
              <Figures figures={company} />
            </Row>
          );
        }
        const { platform } = row;
        return (
          <Row key="platform" className="bg-secondary/5 font-bold">
            <Cell colSpan={4}>{platformTotalWords(platform.companies, platform.offices, figures, language)}</Cell>
            <Figures figures={platform} />
          </Row>
        );
      })}
    </DataTable>
  );
}

/**
 * **A row's six figures below 1024px**, each after its heading's words, in the headings' order: *Members 49 · AB 3 ·
 * AAB 6 · Agent 40*, *Joined in Nov 2026 2 · Left in Nov 2026 1*, *Signed in within 7 days 30 (61%) · within 30 days …*.
 */
function FigureLines({ figures: row, headings }: { figures: Adoption; headings: readonly string[] }) {
  const figures = useFigureLanguage();
  const h = headings.slice(4);
  return (
    <span className="flex flex-col text-muted">
      <span>{`${h[0]} ${formatCount(row.members, figures)} · ${rungWords(row.byRung, figures)}`}</span>
      <span>{`${h[2]} ${formatCount(row.joinedThisMonth, figures)} · ${h[3]} ${formatCount(row.leftThisMonth, figures)}`}</span>
      <span>{`${h[4]} ${signedInWords(row.signedIn7d, row.members, figures)} · ${h[5]} ${signedInWords(row.signedIn30d, row.members, figures)}`}</span>
    </span>
  );
}

/** The six figures every row carries, an office's or a total's, in the headings' order. */
function Figures({ figures: row }: { figures: Adoption }) {
  const figures = useFigureLanguage();
  return (
    <>
      <Cell className="whitespace-nowrap">{formatCount(row.members, figures)}</Cell>
      <Cell>{rungWords(row.byRung, figures)}</Cell>
      <Cell className="whitespace-nowrap">{formatCount(row.joinedThisMonth, figures)}</Cell>
      <Cell className="whitespace-nowrap">{formatCount(row.leftThisMonth, figures)}</Cell>
      <Cell className="whitespace-nowrap">{signedInWords(row.signedIn7d, row.members, figures)}</Cell>
      <Cell className="whitespace-nowrap">{signedInWords(row.signedIn30d, row.members, figures)}</Cell>
    </>
  );
}
