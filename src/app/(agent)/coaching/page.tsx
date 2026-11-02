'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CoachingRoster } from '@/components/coaching-roster';
import { Page } from '@/components/page';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { readRoster, type Roster } from '@/lib/coaching';

/**
 * Coaching Session (`Overall.html:3955-3967`, `:10596-10664`) — the roster, a leader's way into coaching.
 *
 * Everyone the reader coaches, which is their whole downline (ADR-0074): the server decides who, and this screen never
 * asks for a scope. *Last 1:1* and *Status* are the server's, worked out in the office's day; nothing here counts days.
 *
 * **UI V1 (UI-033, UI-034)**: one row per person at every size, the whole row opening their *Coaching Session*
 * (`CoachingRoster`), and ***Catatan coaching saya*** as a small pill on the title row — the *Coaching Anda sendiri*
 * card that held it is gone. About 1.2 screens at 375px where it was 3.1.
 */
export default function CoachingRosterPage() {
  const t = useMessages(coachingMessages);
  return (
    // The prototype's title. The body is its own component so that a reader the gate turns away asks the API for nothing.
    <Page title={t.title} permission="coaching_session:read" actions={<MyNotesPill />}>
      <RosterBody />
    </Page>
  );
}

/**
 * ***Catatan coaching saya*** (UI-033, UI-034): the reader's own sessions, read-only (ADR-0078) — a secondary pill in
 * the accent's outline, 44px tall below 1024px.
 */
function MyNotesPill() {
  const t = useMessages(coachingMessages).roster;
  return (
    <Link
      href="/coaching/me"
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-pill border border-amber bg-card px-3.5',
        'text-base font-semibold text-amber-ink hover:bg-amber/10 lg:min-h-9',
      )}
    >
      {t.myNotes}
    </Link>
  );
}

function RosterBody() {
  const t = useMessages(coachingMessages).roster;
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
    <div className="mx-auto max-w-[980px]">
      {error && <ErrorBanner {...error} />}
      {!roster && !error && <SkeletonCards count={4} label={t.loading} />}
      {nobody && (
        // Ours (L-01). The nav and the landing offer this screen only to a leader, but its gate is
        // `coaching_session:read`, which every active member holds for their own sessions, and the
        // API answers anyone it reaches nobody for with an empty roster, never a refusal. So this is
        // what an Agent, or an AB or AAB who leads nobody, sees on a typed URL.
        <Card className="p-0">
          <EmptyState title={t.empty} />
        </Card>
      )}
      {roster && !nobody && <CoachingRoster roster={roster} />}
    </div>
  );
}
