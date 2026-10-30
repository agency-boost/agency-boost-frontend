'use client';

import { Suspense } from 'react';
import { Page } from '@/components/page';
import { UnitDashboard } from '@/components/unit/unit-dashboard';
import { periodFrom, tabFrom } from '@/lib/unit-dashboard';
import { useQuery } from '@/lib/use-query';

/**
 * The Unit Dashboard (`Overall.html:3888-3949`, `unit-dashboard.md`; P15-T2): a leader's roster — the
 * tiles, everybody in their unit with their goal, leads, activity, last 1:1 and status, and the unit's
 * totals — over one read of the server's, and where a leader lands (P15-T4).
 *
 * Gated by `unit_dashboard:read`, which every field rung holds for their own unit: somebody who leads
 * nobody is answered an empty unit and meets the empty state, not a refusal (D-reach). The period is the
 * address's, `?period=7d|month|year`, *This month* when it names none; the tab too, `?tab=activities` (UI V1, UI-001).
 */
export default function UnitDashboardPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const query = useQuery();
  return (
    // UI V1 (UI-004, UI-012): the screen draws its own title row — the title, and below 1024px the *Search agent* pill.
    <Page permission="unit_dashboard:read">
      <UnitDashboard period={periodFrom(query.period)} tab={tabFrom(query.tab)} />
    </Page>
  );
}
