'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CoachingRoster } from '@/components/coaching-roster';
import { Page } from '@/components/page';
import { NoDataLine, SamplePreview, useSampleName } from '@/components/sample-preview';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { samplePreviewMessages } from '@/i18n/messages/sample-preview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { readRoster, type Roster } from '@/lib/coaching';
import { leadsByRole } from '@/lib/field-nav';
import { sampleRoster } from '@/lib/sample-data';
import { useSession } from '@/lib/session';

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
        'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-pill border border-primary bg-card px-3.5',
        'text-base font-semibold text-primary-ink hover:bg-primary/10 lg:min-h-9',
      )}
    >
      {t.myNotes}
    </Link>
  );
}

/** An empty roster: the line, then `CoachingRoster`'s own drawing of three sample agents, and *Tambah agent pertama*. */
function EmptyRoster({ today }: { today: string }) {
  const next = useMessages(samplePreviewMessages).next;
  const { person } = useSampleName();
  return (
    <>
      <NoDataLine className="mt-0" />
      <SamplePreview
        sample={<CoachingRoster roster={sampleRoster(person, today)} />}
        action={<ButtonLink href="/new-hires">{next.addFirstAgent}</ButtonLink>}
      />
    </>
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
  const leader = leadsByRole(useSession().me?.membership);

  return (
    <div className="mx-auto max-w-[980px]">
      {error && <ErrorBanner {...error} />}
      {!roster && !error && <SkeletonCards count={4} label={t.loading} />}
      {nobody && (
        // The API answers anyone it reaches nobody for with an empty roster, never a refusal. Since ADR-0189 the nav
        // offers this screen to every leader by role, team or none: so its normal layout, *Belum ada data*, and the roster
        // as it will look, greyed and labelled *Contoh*, with the next step (P19-T4 AC-3; D-37, UI-159 item 3).
        leader ? <EmptyRoster today={roster.today} /> : (
          // Anybody else on a typed address (an Agent): the plain line, as before (L-01).
          <Card className="p-0"><EmptyState title={t.empty} /></Card>
        )
      )}
      {roster && !nobody && <CoachingRoster roster={roster} />}
    </div>
  );
}
