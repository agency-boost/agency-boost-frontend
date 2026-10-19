'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { officeLine, OWN_COPY, PROTOTYPE_COPY, readKpmOverview, type KpmOverviewView } from '@/lib/kpm-overview';
import { CoachingCoverage } from './coaching-coverage';
import { Composition } from './composition';
import { Engagement } from './engagement';
import { Section, SplitContext } from './parts';
import { Production } from './production';
import { Recruitment } from './recruitment';

/**
 * The KPM Overview's body (`KPM_Owner.html:929-1222`; P18-T1): the title, the office's sub-line, and the
 * prototype's five sections in its order, over one read of the server's (`GET /kpm/overview`).
 *
 * **Inside the page's gate, not around it.** The page checks `kpm_overview:read` and renders this only once
 * that holds, so the request is never sent for somebody the screen is not drawn for.
 *
 * The states the prototype lacks are Fills (L-01): the five sections in outline while the read is on its
 * way, an error with a retry, and each section's own words where it has nothing to draw.
 */
export function KpmOverview() {
  const [view, setView] = useState<KpmOverviewView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** A retry: the same read, again. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    readKpmOverview()
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [attempt]);

  return (
    <div className="min-w-0">
      {/* The sub-line is the office's, so it arrives with the read (`:932-933`). */}
      <PageHeader title={PROTOTYPE_COPY.title} subtitle={view ? officeLine(view.office) : undefined} />

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <OverviewSkeleton />}
      {view && (
        <SplitContext.Provider value={view.thresholds.statusSplitPct}>
          <Section title={PROTOTYPE_COPY.composition}>
            <Composition composition={view.composition} />
          </Section>
          <Section title={PROTOTYPE_COPY.engagement} sub={PROTOTYPE_COPY.engagementSub}>
            <Engagement engagement={view.engagement} />
          </Section>
          <Section title={PROTOTYPE_COPY.coaching}>
            <CoachingCoverage coaching={view.coaching} />
          </Section>
          <Section title={PROTOTYPE_COPY.recruitment}>
            <Recruitment recruitment={view.recruitment} month={view.month} />
          </Section>
          <Section title={PROTOTYPE_COPY.production}>
            <Production production={view.production} />
          </Section>
        </SplitContext.Provider>
      )}
    </div>
  );
}

/**
 * Each of the five sections in outline — its head, then a card the shape of what is coming — under one
 * live region, so a screen reader hears one sentence for the wait rather than five.
 */
function OverviewSkeleton() {
  return (
    <Skeleton label={OWN_COPY.loading}>
      {/* Team composition: four tiles. */}
      <SkeletonBar className="mb-3.5 h-4 w-40" />
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-hairline bg-card px-[18px] py-4">
            <SkeletonBar className="h-2.5 w-1/2" />
            <SkeletonBar className="mt-3 h-6 w-1/3" />
          </div>
        ))}
      </div>
      {/* Engagement: two cards. */}
      <SkeletonBar className="mb-3.5 mt-[34px] h-4 w-32" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-hairline bg-card p-[18px]">
            <SkeletonBar className="h-3.5 w-2/3" />
            <SkeletonBar className="mt-2 w-1/2" />
            <SkeletonBar className="mt-4 h-7 w-1/3" />
            <SkeletonBar className="mt-3 h-[7px] w-full" />
          </div>
        ))}
      </div>
      {/* Coaching coverage, Recruitment pipeline, Production: one card each. */}
      {['h-40', 'h-28', 'h-48'].map((height) => (
        <div key={height}>
          <SkeletonBar className="mb-3.5 mt-[34px] h-4 w-44" />
          <div className={`rounded-lg border border-hairline bg-card p-5 ${height}`}>
            <SkeletonBar className="w-1/3" />
            <SkeletonBar className="mt-3 w-2/3" />
            <SkeletonBar className="mt-3 w-1/2" />
          </div>
        </div>
      ))}
    </Skeleton>
  );
}
