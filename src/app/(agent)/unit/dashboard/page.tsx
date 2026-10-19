'use client';

import { use } from 'react';
import { Page } from '@/components/page';
import { UnitDashboard } from '@/components/unit/unit-dashboard';
import { periodFrom, PROTOTYPE_COPY } from '@/lib/unit-dashboard';

type Query = { period?: string | string[] };

/**
 * The Unit Dashboard (`Overall.html:3888-3949`, `unit-dashboard.md`; P15-T2): a leader's roster — the
 * tiles, everybody in their unit with their goal, leads, activity, last 1:1 and status, and the unit's
 * totals — over one read of the server's, and where a leader lands (P15-T4).
 *
 * Gated by `unit_dashboard:read`, which every field rung holds for their own unit: somebody who leads
 * nobody is answered an empty unit and meets the empty state, not a refusal (D-reach). The period is the
 * address's, `?period=7d|month|year`, *This month* when it names none.
 */
export default function UnitDashboardPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = searchParams ? use(searchParams) : {};
  return (
    // The prototype's title, verbatim, and its empty sub-line (`Overall.html:10410`).
    <Page title={PROTOTYPE_COPY.title} permission="unit_dashboard:read">
      <UnitDashboard period={periodFrom(query.period)} />
    </Page>
  );
}
