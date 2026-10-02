'use client';

import { useEffect, useState } from 'react';
import { CoachingRoster, ROSTER_CAPTION, ROSTER_COLUMNS } from '@/components/coaching-roster';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonTable } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readRoster, type Roster } from '@/lib/coaching';

/**
 * Coaching Session (`Overall.html:3955-3967`, `:10596-10664`) — the roster, a leader's way into
 * coaching, and where a leader lands (P11-T6).
 *
 * Everyone the reader coaches, which is their whole downline (ADR-0074): the server decides who, and
 * this screen never asks for a scope. Each row is a verdict and a date, never a count (AC-6), and
 * every row opens that person's *Coaching Session* tab, where the prototype built one (contradiction
 * #9). *Last 1:1* and *Status* are the server's, worked out in the office's day; nothing here counts
 * days.
 */
export default function CoachingRosterPage() {
  return (
    // The prototype's title, and its empty sub-line (`Overall.html:10407`). The body is its own
    // component so that a reader the gate turns away asks the API for nothing.
    <Page title="Coaching Session" permission="coaching_session:read">
      <RosterBody />
    </Page>
  );
}

function RosterBody() {
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readRoster()
      .then((next) => { if (live) setRoster(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  const nobody = roster !== null && roster.directAgents.length === 0 && roster.units.length === 0;

  return (
    // `#view-list{max-width:860px;margin:0 auto}` (`Overall.html:1438`).
    <div className="mx-auto max-w-[860px]">
      {/* The own-coaching card (`Overall.html:3956-3959`): the reader's own sessions, read-only (ADR-0078). */}
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-md font-bold text-navy">Your own coaching</p>
        <ButtonLink href="/coaching/me" className="h-auto px-[18px] py-2.5 text-base">
          My Coaching Notes
        </ButtonLink>
      </Card>

      {error && <ErrorBanner {...error} />}
      {!roster && !error && <SkeletonTable caption={ROSTER_CAPTION} columns={ROSTER_COLUMNS} rows={4} />}
      {nobody && (
        // Ours (L-01). The nav and the landing offer this screen only to a leader, but its gate is
        // `coaching_session:read`, which every active member holds for their own sessions, and the
        // API answers anyone it reaches nobody for with an empty roster, never a refusal. So this is
        // what an Agent, or an AB or AAB who leads nobody, sees on a typed URL — and a leader whose
        // last report left between the sidebar's read and this one. The route registry says so.
        <Card className="p-0">
          <EmptyState title="No one to coach yet." />
        </Card>
      )}
      {roster && !nobody && <CoachingRoster roster={roster} />}
    </div>
  );
}
