'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CoachingRoster } from '@/components/coaching-roster';
import { useMediaQuery } from '@/lib/use-media-query';
import { Page } from '@/components/page';
import { NoDataLine, SamplePreview, useSampleName } from '@/components/sample-preview';
import { EmptyState } from '@/components/ui/empty-state';
import { ButtonLink, Card, ErrorBanner } from '@/components/ui/field';
import { SkeletonCards } from '@/components/ui/skeleton';
import { PickerMenu } from '@/components/ui/picker-menu';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { samplePreviewMessages } from '@/i18n/messages/sample-preview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { readRoster, type Roster } from '@/lib/coaching';
import { leadsByRole } from '@/lib/field-nav';
import { sampleRoster } from '@/lib/sample-data';
import { useSession } from '@/lib/session';
import { teamViewOptions, type TeamView } from '@/lib/team-views';

/**
 * Coaching Session (`Overall.html:3955-3967`, `:10596-10664`) — the roster, a leader's way into coaching.
 *
 * Everyone the reader coaches, which is their whole downline (ADR-0074): the server decides who, and this screen never
 * asks for a scope. *Last 1:1* and *Status* are the server's, worked out in the office's day; nothing here counts days.
 *
 * **UI V1 (UI-033, UI-034)**: one row per person at every size, the whole row opening their *Coaching Session*
 * (`CoachingRoster`). About 1.2 screens at 375px where it was 3.1.
 *
 * **P19.18-T5 (ADR-0271 §9; `coaching-owner-mobile`)**: **the control row under the title** — ***Semua downline ⌄***, the
 * views the server offers (*Direct Unit · Grup langsung · Grup informal · Semua downline*; hidden with one), each read
 * again with `?scope=`, and ***Catatan coaching saya*** beside it, where it was on the title row. The KPM Owner's and an
 * Admin's roster is the whole office; the server decides who.
 */
export default function CoachingRosterPage() {
  const t = useMessages(coachingMessages);
  return (
    // The prototype's title. The body is its own component so that a reader the gate turns away asks the API for nothing.
    <Page title={t.title} permission="coaching_session:read">
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
function EmptyRoster({ today, tablet }: { today: string; tablet: boolean }) {
  const next = useMessages(samplePreviewMessages).next;
  const { person } = useSampleName();
  return (
    <>
      <NoDataLine className="mt-0" />
      <SamplePreview
        sample={<CoachingRoster roster={sampleRoster(person, today)} tablet={tablet} />}
        action={<ButtonLink href="/new-hires">{next.addFirstAgent}</ButtonLink>}
      />
    </>
  );
}

function RosterBody() {
  const t = useMessages(coachingMessages).roster;
  const language = useLanguage();
  const [roster, setRoster] = useState<Roster | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** *Semua downline ⌄*'s choice (P19.18-T5 AC-1): `null` is the server's default — everybody the reader coaches. */
  const [scope, setScope] = useState<TeamView | null>(null);
  // Asked here, where the page mounts and before its read, so the roster is drawn at its size from its first frame —
  // asked inside the roster, a tablet showed one frame of the desktop's columns when the data arrived (P19.1-T5 AC-1).
  const tablet = useMediaQuery('tablet');

  useEffect(() => {
    let live = true;
    setError(null);
    readRoster(scope)
      .then((next) => { if (live) setRoster(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [scope]);

  const nobody = roster !== null && roster.sections.length === 0;
  const leader = leadsByRole(useSession().me?.membership);
  const offered = roster?.scopes.offered ?? [];

  return (
    // P19.13-T1 AC-2 (UI-192, the report's *Conflicts resolved*: *tables use the full frame*): from 1024px the frame's whole
    // width, on its left edge, where it was 980px centred inside the room. Below 1024px as it was.
    <div className="mx-auto max-w-[980px] lg:mx-0 lg:max-w-none">
      {/* P19.18-T5 AC-1: the control row — the view, then the reader's own notes — on the roster's way and after it. */}
      <div data-roster-controls="" className="mb-3 flex flex-wrap items-center gap-2">
        {roster && offered.length > 1 && (
          <PickerMenu
            label={t.viewLabel}
            value={roster.scope}
            options={teamViewOptions(offered, language)}
            onChange={setScope}
            className="shrink-0"
          />
        )}
        <MyNotesPill />
      </div>
      {error && <ErrorBanner {...error} />}
      {!roster && !error && <SkeletonCards count={4} label={t.loading} />}
      {nobody && (
        // The API answers anyone it reaches nobody for with an empty roster, never a refusal. Since ADR-0189 the nav
        // offers this screen to every leader by role, team or none: so its normal layout, *Belum ada data*, and the roster
        // as it will look, greyed and labelled *Contoh*, with the next step (P19-T4 AC-3; D-37, UI-159 item 3).
        leader ? <EmptyRoster today={roster.today} tablet={tablet} /> : (
          // Anybody else on a typed address (an Agent): the plain line, as before (L-01).
          <Card className="p-0"><EmptyState title={t.empty} /></Card>
        )
      )}
      {roster && !nobody && <CoachingRoster roster={roster} tablet={tablet} />}
    </div>
  );
}
