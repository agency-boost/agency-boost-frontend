'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Page } from '@/components/page';
import { Card, ErrorBanner } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { rungShort } from '@/components/ui/role-badge';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { adminOverviewMessages } from '@/i18n/messages/admin-overview';
import { formatNumber } from '@/lib/format';
import { readPlatformOverview, type AttentionItem, type PlatformOverview } from '@/lib/admin';

/**
 * Platform Overview (`Superadmin.html:224-333`).
 *
 * **The order is the argument.** `Needs your attention` comes first in the prototype's
 * DOM, above the tiles, and its footer says why: *"4 items need Superadmin action —
 * nothing here can be delegated to a KPM Owner or Admin"* (`:272`). The console is a work
 * queue with context, not four counters with a warning underneath. Building it the other
 * way round — which is what we had — reads as a dashboard and buries the only part that
 * asks anything of the reader.
 *
 * Two of the four tiles are cross-tenant headcounts. ADR-0011 retook ADR-0005 on exactly
 * that point once this prototype turned up: aggregate composition is in scope; an
 * office's leads, activity, coaching notes and production are not, and nothing here
 * reads them.
 */
export default function AdminOverviewPage() {
  const t = useMessages(adminOverviewMessages);
  // The badge's name for the rung (P18.95-T9 AC-1), counted in its English plural.
  const abs = t.abs({ ab: rungShort('AB') });
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void readPlatformOverview()
      .then(setOverview)
      .catch((err) => setError(toDisplayError(err)));
  }, []);

  return (
    // The nav item's word (P18.95-T9 AC-2; UI-027, menu labels = page titles): the prototype's *Platform Overview*
    // (`Superadmin.html:224`) under a nav item reading *Overview* (`:170`).
    <Page title={t.title} subtitle={t.subtitle}>
      {error && <ErrorBanner {...error} />}

      {!overview && !error && (
        <SkeletonCards count={2} label={t.loading} />
      )}

      {overview && (
        <>
          <Card className="mb-6">
            <h2 className="font-display text-lg font-bold text-navy">{t.attention}</h2>
            {overview.attention.length === 0 ? (
              // The prototype has no empty state here — it has one state, loaded, with
              // four seeded rows. An empty queue is the good outcome and should read as
              // one, not as a card that failed to fill.
              <EmptyState title={t.nothing} />
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {overview.attention.map((item) => (
                  <AttentionRow key={item.title} item={item} />
                ))}
              </ul>
            )}
            {overview.attention.length > 0 && (
              <p className="mt-3 border-t border-hairline pt-3 text-sm text-muted">
                {t.attentionFooter({ n: overview.attention.length })}
              </p>
            )}
          </Card>

          <h2 className="font-display text-lg font-bold text-navy">{t.glance}</h2>
          <p className="mb-3 mt-1 text-md text-muted">{t.glanceLine}</p>
          {/* The prototype gives the first tile more room (`1.1fr 1fr 1fr 1fr`, `:90`)
              and colours only its number amber (`:95`). */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <Tile label={t.companies} value={overview.tiles.companies} lead />
            <Tile label={t.kpms} value={overview.tiles.kpms} />
            <Tile label={t.totalMembers} value={overview.tiles.totalMembers} />
            {/* The badge's name, plural (P18.95-T9 AC-1): the prototype's *Agency Builders* was a second name for AB. */}
            <Tile label={abs} value={overview.tiles.agencyBuilders} />
          </div>

          <h2 className="mt-6 font-display text-lg font-bold text-navy">{t.companiesHeading}</h2>
          <p className="mb-3 mt-1 text-md text-muted">{t.companiesLine}</p>
          <div className="flex flex-col gap-3">
            {overview.companies.map((c) => (
              <Card key={c.companyId} className="flex flex-wrap items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy text-md font-bold text-card">
                  {c.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-md font-bold text-navy">{c.name}</span>
                  {/* The prototype's meta line: `Role ladder: Agent → AAB → AB · 9
                      products in catalog` (`Superadmin.html:311`). The ladder is real as
                      of P3.5-T7 and comes from `companyOrgLevels`; the product count
                      arrives with Phase 5, and a literal would be a number no data
                      stands behind. A company with no ladder says so — an arrow with
                      nothing on either side would read as a rendering failure. */}
                  <span className="block text-sm text-muted">
                    {c.ladder.length > 0
                      ? t.ladder({ ladder: c.ladder.join(' → ') })
                      : t.noLadder}
                  </span>
                </span>
                <span className="flex gap-6 text-right">
                  <Figure label={t.kpms} value={c.kpmCount} />
                  <Figure label={t.members} value={c.memberCount} />
                </span>
              </Card>
            ))}
            {overview.companies.length === 0 && (
              <EmptyState title={t.noCompanies} />
            )}
          </div>
        </>
      )}
    </Page>
  );
}

const SEVERITY: Record<AttentionItem['severity'], string> = {
  structural: 'bg-alert/10 text-alert',
  approval: 'bg-info/10 text-info',
  template: 'bg-amber/12 text-amber-deep',
};

function AttentionRow({ item }: { item: AttentionItem }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-hairline p-3">
      <span
        className={`shrink-0 rounded-pill px-2 py-1 text-2xs font-bold uppercase tracking-wide ${SEVERITY[item.severity]}`}
      >
        {item.tag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-md font-semibold text-navy">{item.title}</span>
        <span className="block text-sm text-muted">{item.detail}</span>
      </span>
      <Link href={item.href} className="text-md font-semibold text-amber-deep underline">
        {item.actionLabel} →
      </Link>
    </li>
  );
}

function Tile({ label, value, lead }: { label: string; value: number; lead?: boolean }) {
  const figures = useFigureLanguage();
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-3xl font-bold ${lead ? 'text-amber-deep' : 'text-navy'}`}
      >
        {formatNumber(value, {}, figures)}
      </p>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  const figures = useFigureLanguage();
  return (
    <span className="block">
      <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="block text-md font-bold text-navy">{formatNumber(value, {}, figures)}</span>
    </span>
  );
}
