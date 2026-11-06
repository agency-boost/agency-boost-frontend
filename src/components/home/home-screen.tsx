'use client';

import { useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { minuteInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import { dayPartOf, firstNameOf, readHome, type HomeView } from '@/lib/home';
import { useSession } from '@/lib/session';
import { HomeActions } from './home-actions';
import { HomeChart } from './home-chart';
import { HomeQuoteCard } from './home-quote';
import { HomeTeam } from './home-team';
import { HomeTiles } from './home-tiles';
import { HomeProposalPill } from './home-proposal';
import { HomeTimSaya } from './home-tim-saya';
import { SurveyPopup } from '@/components/surveys/survey-popup';

/**
 * **Home** (UI V1, 2026-10-30, Phase 18.11 T11; UI-100, UI-101; `home-mobile`, `home-desktop`): the page every field
 * member lands on — **about the reader**: the quote of the day, *Aktivitas saya* and *Jadwal hari ini*, *Aksi hari ini*,
 * the last seven days; and, for somebody who leads, *Active Agent {Bulan}*, *Coaching 7 hari* and *Laporan tim*.
 *
 * - **The title row** is the greeting — the part of the day by the office's clock and the first name in capitals,
 *   *Pagi, AGUS* — with the bell left of the avatar (UI-004: Home's alone). No *+ Log* there: it is in the tile.
 * - **No goal card, no next-event line** (the owner's v2 of 30 October): the goal lives on `/summary`.
 * - **A phone**: one column — quote, tiles two by two, *Aksi hari ini*, *Laporan tim*, the chart. **A desktop**: two
 *   columns, ~60% and ~40% — the quote, the tiles two by two and *Aksi hari ini* on the left; *Laporan tim* and the
 *   chart on the right.
 * - **A tablet** (P19.1-T5 AC-3; UI-113, `home-tablet`): the phone's blocks in the phone's order, in two columns where
 *   two fit — **the quote full width, the four tiles 2×2 across it** (P19.1-T1 AC-5), *Tim saya* and *Aksi hari ini*
 *   full width, **then *Laporan tim* | *Aktivitas 7 hari terakhir* side by side**; the chart full width when there is no
 *   *Laporan tim*. It was the quote in half the row beside nothing, and *Aksi hari ini* | *Laporan tim* with the chart
 *   under them. `md:max-lg:` classes alone: a phone's and a laptop's markup are what they were
 *   (`home/home-tablet.spec.tsx`).
 * - ***Tim saya*** (P19-T4 AC-2; UI-159 item 2): every leader's four tiles under the reader's own — *Anggota tim*,
 *   *Coaching minggu ini*, *Recruitment pipeline*, *New hires* — each with one call to action at zero; the server sends
 *   the leader's block to every leader by role (ADR-0189 §4). *Laporan tim* and the two team tiles wait for a team.
 * - **One read**, `GET /home`; every figure is the server's. An empty section is hidden, never a sentence (D-08).
 */
export function HomeScreen() {
  const t = useMessages(homeMessages);
  const { me } = useSession();
  const [view, setView] = useState<HomeView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    readHome()
      .then((next) => { if (live) setView(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, []);

  const name = firstNameOf(me?.user.fullName ?? '').toUpperCase();
  const title = t.greeting[dayPartOf(view?.now.minute ?? minuteInZone(OFFICE_TIME_ZONE, new Date()))]({ name });
  const leader = view?.leader ?? null;
  const withTeam = leader !== null && leader.members > 0;

  return (
    <Page title={title} bell>
      <div data-home="" className="max-w-[1200px]">
        {error && <ErrorBanner {...error} />}
        {!view && !error && <HomeSkeleton label={t.loading} />}
        {view && (
          <div className="grid grid-cols-1 gap-3.5 md:max-lg:grid-cols-2 md:max-lg:items-start md:max-lg:gap-4 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-5">
            {/* `grid-cols-1` on a phone: one `minmax(0, 1fr)` track, so the widest row cannot push the page sideways (T16). */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-2.5">
              {/* Full width on a tablet (UI-113, `home-tablet`): it was half the row, beside nothing. */}
              <HomeQuoteCard quote={view.quote} className="md:max-lg:col-span-2" />
              <HomeTiles view={view} className="md:max-lg:col-span-2" />
              {/* P19.7-T2 AC-1 (ADR-0221 §8): *Buat proposal*, one pill under the tiles, by role. */}
              <HomeProposalPill className="md:max-lg:col-span-2" />
              {/* Every leader's, team or none (P19-T4 AC-2; ADR-0189 §4): Home alone says they have team tools. */}
              {leader && <HomeTimSaya leader={leader} className="mt-1.5 md:max-lg:col-span-2 lg:mt-2.5" />}
              {/* Full width on a tablet, above the pair (P19.1-T5 AC-3): *Laporan tim* sits beside the chart now. */}
              <HomeActions actions={view.actions} today={view.today} className="mt-1.5 md:max-lg:col-span-2 lg:mt-2.5" />
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3.5">
              {/* On a tablet *Laporan tim* | *Aktivitas 7 hari terakhir*, one column each (UI-113, `home-tablet`). */}
              {withTeam && <HomeTeam team={leader.team} leaderName={me?.user.fullName ?? ''} className="mt-1.5 lg:mt-0" />}
              <HomeChart activity={view.activity} className={cn('mt-1.5 lg:mt-0', !withTeam && 'md:max-lg:col-span-2')} />
            </div>
          </div>
        )}
      </div>
      {/* P19.5-T4 (C-R3 to C-R7): the survey popup, on Home only, once Home has drawn; the server says when one is due. */}
      {view && <SurveyPopup />}
    </Page>
  );
}

/** Shaped like what is coming: the quote, the tiles two by two, a list. */
function HomeSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <div className="space-y-3 lg:max-w-[60%]">
        <div className="h-[5.3rem] rounded-lg bg-card" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-lg bg-card px-3 py-2.5">
              <SkeletonBar className="h-3 w-1/2" />
              <SkeletonBar className="mt-3 h-6 w-1/3" />
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-card p-4">
          <SkeletonBar className="h-4 w-1/3" />
          <SkeletonBar className="mt-3 w-2/3" />
        </div>
      </div>
    </Skeleton>
  );
}
