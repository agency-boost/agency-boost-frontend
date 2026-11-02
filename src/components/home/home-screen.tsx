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

/**
 * **Home** (UI V1, 2026-10-30, Phase 18.99 T11; UI-100, UI-101; `home-mobile`, `home-desktop`): the page every field
 * member lands on — **about the reader**: the quote of the day, *Aktivitas saya* and *Jadwal hari ini*, *Aksi hari ini*,
 * the last seven days; and, for somebody who leads, *Active Agent {Bulan}*, *Coaching 7 hari* and *Laporan tim*.
 *
 * - **The title row** is the greeting — the part of the day by the office's clock and the first name in capitals,
 *   *Pagi, AGUS* — with the bell left of the avatar (UI-004: Home's alone). No *+ Log* there: it is in the tile.
 * - **No goal card, no next-event line** (the owner's v2 of 30 October): the goal lives on `/summary`.
 * - **A phone**: one column — quote, tiles two by two, *Aksi hari ini*, *Laporan tim*, the chart. **A tablet** (no
 *   mockup): the same blocks, the tiles four in a row, *Aksi hari ini* and *Laporan tim* side by side, the chart full
 *   width. **A desktop**: two columns, ~60% and ~40% — the quote, the tiles two by two and *Aksi hari ini* on the left;
 *   *Laporan tim* and the chart on the right.
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
  const hasActions = (view?.actions.length ?? 0) > 0;

  return (
    <Page title={title} bell>
      <div data-home="" className="max-w-[1200px]">
        {error && <ErrorBanner {...error} />}
        {!view && !error && <HomeSkeleton label={t.loading} />}
        {view && (
          <div className="grid grid-cols-1 gap-3.5 md:max-lg:grid-cols-2 md:max-lg:gap-4 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-5">
            {/* `grid-cols-1` on a phone: one `minmax(0, 1fr)` track, so the widest row cannot push the page sideways (T16). */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-2.5">
              <HomeQuoteCard quote={view.quote} />
              <HomeTiles view={view} className="md:max-lg:col-span-2" />
              <HomeActions
                actions={view.actions}
                today={view.today}
                className={cn('mt-1.5 lg:mt-2.5', !leader && 'md:max-lg:col-span-2')}
              />
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3.5">
              {leader && (
                <HomeTeam
                  team={leader.team}
                  leaderName={me?.user.fullName ?? ''}
                  className={cn('mt-1.5 lg:mt-0', !hasActions && 'md:max-lg:col-span-2')}
                />
              )}
              <HomeChart activity={view.activity} className="mt-1.5 md:max-lg:col-span-2 lg:mt-0" />
            </div>
          </div>
        )}
      </div>
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
