'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { officeLine, readKpmOverview, type KpmOverviewView, type RecruitTarget } from '@/lib/kpm-overview';
import { useCan } from '@/lib/session';
import { Coached7Tile, CoachingList } from './coaching-coverage';
import { TeamTile } from './composition';
import { ActiveMonthTile, NotLoggedCard, NotLoggedSheet, onDesktop, useSilentList } from './engagement';
import { SplitContext } from './parts';
import { ProductionTile, UnitsList } from './production';
import { Recruitment } from './recruitment';
import { SettingsCard, SettingsSheet } from './settings-list';
import { SetupCard } from './setup-card';
import { TargetSheet } from './target-sheet';

/**
 * The KPM Overview's body (`KPM_Owner.html:929-1222`; P18-T1): the title, the office's sub-line, and the
 * prototype's five sections in its order, over one read of the server's (`GET /kpm/overview`).
 *
 * **Inside the page's gate, not around it.** The page checks `kpm_overview:read` and renders this only once
 * that holds, so the request is never sent for somebody the screen is not drawn for.
 *
 * The states the prototype lacks are Fills (L-01): the five sections in outline while the read is on its
 * way, an error with a retry, and each section's own words where it has nothing to draw.
 *
 * **Its words are the reader's** (P18.10-T4; `kpmOverviewMessages`): the title, the sections' and the cards' names kept
 * English, the rest the approved glossary's; its figures the figures' language (`useFigureLanguage()`).
 *
 * **Laid out as the client drew it on 3 November** (P19.2-T3 AC-5; UI-143, `kpm-owner-mobile-2026-11-03` 1,
 * `kpm-owner-desktop-2026-11-03` 1 and `kpm-overview-*-2026-11-03`, which win for this page): where the prototype stacked
 * five sections — three screens at 375, two at 1280 — **four stat tiles** (*Total members*, the month's logging, *Coached
 * 7 days*, the year's production), **two lists** (*AB coaching frequency*, *Units furthest behind target*, three rows and
 * *Semua n ›*), and **three small cards** (*Recruitment pipeline*, the week's logging, *Coached 30 days*). A phone and a
 * tablet: the tiles two by two, then the lists, then the cards two to a row, the recruitment card across both. A laptop:
 * four tiles in one row, the lists side by side, the cards three across.
 *
 * ***Changed 2026-11-05 (P19.3-T2; UI-148, UI-149, UI-150; Overview R1, R1b, R2, R3; `kpm-overview-*-2026-11-03`).***
 * **Every problem opens its fix** (R1): *Total members* opens All members; *Aktif bulan ini*'s *"7 hari: n belum ›"* opens
 * *Belum mencatat · 7 hari*; *Coached 7 hari* opens Coaching; each month still open opens Data upload on itself; an *AB
 * coaching frequency* row opens that AB's member page and a *Units furthest behind target* row their Unit Dashboard; the
 * pipeline's › opens the target's sheet; ***Pengaturan KPM ›***, on every Overview, opens the settings list (R1b). **A
 * new KPM gets *Siapkan KPM*** at the top (R2), the ranking lists hide while nobody can be ranked (D-08), and the
 * pipeline's card waits for step 7. The rows of the page:
 *
 * - the setup card, while any step is open;
 * - **four tiles** — *Total members*, *Aktif bulan ini*, *Coached 7 hari*, *Production this year* — two by two below
 *   1024px, one row from it;
 * - **the lists**: *AB coaching frequency* and *Units furthest behind target*, and from 1024px *Belum mencatat · 7
 *   hari* as the third card (a sheet below 1024px, and while the setup card stands);
 * - **the cards**: *Recruitment pipeline* (not while the setup card stands) and *Pengaturan KPM ›*.
 *
 * The 30 days' coaching is on the 7 days' tile now, and the week's logging on the first tile's pill: their two small
 * cards are gone, as the mockups draw.
 */
export function KpmOverview() {
  const t = useMessages(kpmOverviewMessages);
  const [view, setView] = useState<KpmOverviewView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  /** A retry: the same read, again. */
  const [attempt, setAttempt] = useState(0);
  const silent = useSilentList();
  const [sheet, setSheet] = useState<'silent' | 'settings' | 'target' | null>(null);
  const silentHeading = useRef<HTMLHeadingElement>(null);
  const canSetTarget = useCan('kpm_overview:set_recruit_target');

  /**
   * **A target saved here ticks step 7 without a reload** (P19.3-T2 AC-5): the pipeline's figure and the card's step
   * from the write's own answer. Seven done, the card goes — the server has stored it, and the next read says `null`.
   */
  const targetSaved = useCallback((written: RecruitTarget | number) => {
    const target = typeof written === 'number' ? written : written.target;
    setView((was) => {
      if (!was) return was;
      const setup = was.setup && (() => {
        const steps = was.setup.steps.map((step) => (step.key === 'recruit-target' ? { ...step, done: true } : step));
        const done = steps.filter((step) => step.done).length;
        return done === steps.length ? null : { ...was.setup, steps, done, target };
      })();
      return { ...was, recruitment: { ...was.recruitment, target }, setup };
    });
  }, []);

  /** *"7 hari: n belum ›"*: the desktop's third card when it is there, the sheet otherwise. */
  const openSilent = useCallback(() => {
    if (onDesktop() && !view?.setup && silentHeading.current) {
      silentHeading.current.scrollIntoView?.({ block: 'nearest' });
      silentHeading.current.focus();
      return;
    }
    setSheet('silent');
  }, [view?.setup]);

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
      {/*
        * The sub-line is the office's, so it arrives with the read (`:932-933`). *Since P19.2-T3 (UI-143)* it is drawn
        * from 1024px only, as `kpm-owner-desktop` 1 and `kpm-overview-desktop` 2 draw it beside the title — it names the
        * office the figures are (`keepSubtitle`) — and not on a phone or a tablet, whose mockups have the title alone.
        */}
      <PageHeader
        title={t.title}
        subtitle={view ? officeLine(view.office) : undefined}
        keepSubtitle
        subtitleOnPhone={false}
        subtitleOnTablet={false}
      />

      {error && (
        <div>
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <OverviewSkeleton />}
      {view && (() => {
        // D-08 (AC-6): nobody to rank, no ranking — the four tiles always show.
        const coachingRanked = view.coaching.leaderboard.some((row) => row.leads);
        const unitsRanked = view.production.agencies.some((agency) => agency.targetMinor !== null);
        const silentCard = !view.setup && view.engagement.loggedThisWeek.notLogged > 0;
        const headcount = view.engagement.loggedThisWeek.logged + view.engagement.loggedThisWeek.notLogged;
        return (
          <SplitContext.Provider value={view.thresholds.statusSplitPct}>
            {view.setup && (
              <SetupCard
                setup={view.setup}
                onTarget={() => setSheet('target')}
                onAllSettings={() => setSheet('settings')}
              />
            )}
            <div data-overview="tiles" className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
              <TeamTile composition={view.composition} />
              <ActiveMonthTile engagement={view.engagement} onOpenSilent={openSilent} />
              <Coached7Tile coaching={view.coaching} />
              <ProductionTile production={view.production} />
            </div>
            {(coachingRanked || unitsRanked || silentCard) && (
              <div data-overview="lists" className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
                {coachingRanked && <CoachingList coaching={view.coaching} />}
                {unitsRanked && <UnitsList production={view.production} />}
                {silentCard && <NotLoggedCard silent={silent} of={headcount} headingRef={silentHeading} className="max-lg:hidden" />}
              </div>
            )}
            <div data-overview="cards" className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-start lg:gap-3">
              {!view.setup && (
                <Recruitment
                  recruitment={view.recruitment}
                  month={view.month}
                  onOpenTarget={() => setSheet('target')}
                  onSaved={targetSaved}
                />
              )}
              <SettingsCard settings={view.settings} onOpen={() => setSheet('settings')} />
            </div>
            <NotLoggedSheet open={sheet === 'silent'} onClose={() => setSheet(null)} silent={silent} of={headcount} />
            <SettingsSheet open={sheet === 'settings'} onClose={() => setSheet(null)} settings={view.settings} />
            {canSetTarget && (
              <TargetSheet
                open={sheet === 'target'}
                onClose={() => setSheet(null)}
                month={view.month}
                target={view.recruitment.target}
                onSaved={targetSaved}
              />
            )}
          </SplitContext.Provider>
        );
      })()}
    </div>
  );
}

/**
 * The page in outline, the shape of what is coming — four tiles, two lists, three small cards — under one live region,
 * so a screen reader hears one sentence for the wait rather than nine (P19.2-T3 AC-5).
 */
function OverviewSkeleton() {
  const t = useMessages(kpmOverviewMessages);
  const box = 'rounded-lg border border-card-edge bg-card';
  return (
    <Skeleton label={t.loading}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${box} px-3 py-2.5`}>
            <SkeletonBar className="h-2.5 w-1/2" />
            <SkeletonBar className="mt-3 h-6 w-1/3" />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`${box} h-48 p-4`}>
            <SkeletonBar className="h-3.5 w-1/2" />
            <SkeletonBar className="mt-4 w-full" />
            <SkeletonBar className="mt-3 w-full" />
            <SkeletonBar className="mt-3 w-2/3" />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3 lg:gap-3">
        {['col-span-2 lg:col-span-1', '', ''].map((span, i) => (
          <div key={i} className={`${box} h-28 p-4 ${span}`}>
            <SkeletonBar className="w-1/2" />
            <SkeletonBar className="mt-3 h-6 w-1/3" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}
