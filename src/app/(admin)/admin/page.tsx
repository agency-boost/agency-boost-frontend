'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Page } from '@/components/page';
import { Card, ErrorBanner } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCards } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
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
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    void readPlatformOverview()
      .then(setOverview)
      .catch((err) => setError(toDisplayError(err)));
  }, []);

  return (
    <Page title="Platform Overview" subtitle="Every company and KPM on AgencyBoost">
      {error && <ErrorBanner {...error} />}

      {!overview && !error && (
        <SkeletonCards count={2} label="Loading the platform overview…" />
      )}

      {overview && (
        <>
          <Card className="mb-6">
            <h2 className="font-display text-lg font-bold text-navy">Needs your attention</h2>
            {overview.attention.length === 0 ? (
              // The prototype has no empty state here — it has one state, loaded, with
              // four seeded rows. An empty queue is the good outcome and should read as
              // one, not as a card that failed to fill.
              <EmptyState title="Nothing needs the platform right now." />
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {overview.attention.map((item) => (
                  <AttentionRow key={item.title} item={item} />
                ))}
              </ul>
            )}
            {overview.attention.length > 0 && (
              <p className="mt-3 border-t border-hairline pt-3 text-sm text-muted">
                {overview.attention.length === 1
                  ? '1 item needs Superadmin action'
                  : `${overview.attention.length} items need Superadmin action`}{' '}
                — nothing here can be delegated to a KPM Owner or Admin.
              </p>
            )}
          </Card>

          <h2 className="font-display text-lg font-bold text-navy">At a glance</h2>
          <p className="mb-3 mt-1 text-md text-muted">Across every company on the platform</p>
          {/* The prototype gives the first tile more room (`1.1fr 1fr 1fr 1fr`, `:90`)
              and colours only its number amber (`:95`). */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
            <Tile label="Companies" value={overview.tiles.companies} lead />
            <Tile label="KPMs" value={overview.tiles.kpms} />
            <Tile label="Total members" value={overview.tiles.totalMembers} />
            <Tile label="Agency Builders" value={overview.tiles.agencyBuilders} />
          </div>

          <h2 className="mt-6 font-display text-lg font-bold text-navy">Companies</h2>
          <p className="mb-3 mt-1 text-md text-muted">
            Each company has its own role ladder, product catalog, and KPM template
          </p>
          <div className="flex flex-col gap-3">
            {overview.companies.map((c) => (
              <Card key={c.companyId} className="flex flex-wrap items-center gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-navy text-md font-bold text-card">
                  {c.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-md font-bold text-navy">{c.name}</span>
                  {/* The prototype's meta line also carries the role ladder and a product
                      count. Both arrive with the phases that build them — P3.5-T7 and
                      Phase 5 — and inventing either would put a number on screen that no
                      data stands behind. */}
                </span>
                <span className="flex gap-6 text-right">
                  <Figure label="KPMs" value={c.kpmCount} />
                  <Figure label="Members" value={c.memberCount} />
                </span>
              </Card>
            ))}
            {overview.companies.length === 0 && (
              <EmptyState title="No companies yet. Add one to start provisioning offices." />
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
  template: 'bg-amber/12 text-amber-dark',
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
      <Link href={item.href} className="text-md font-semibold text-amber-dark underline">
        {item.actionLabel} →
      </Link>
    </li>
  );
}

function Tile({ label, value, lead }: { label: string; value: number; lead?: boolean }) {
  return (
    <Card>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-3xl font-bold ${lead ? 'text-amber-dark' : 'text-navy'}`}
      >
        {value.toLocaleString('en-GB')}
      </p>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <span className="block">
      <span className="block text-2xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="block text-md font-bold text-navy">{value.toLocaleString('en-GB')}</span>
    </span>
  );
}
