'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Page } from '@/components/page';
import { ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { readEntry, type CalendarEntry } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import { minuteInZone, OFFICE_TIME_ZONE } from '@/lib/format';
import { dayPartOf, firstNameOf, readHome, type HomeView } from '@/lib/home';
import { useCan, useSession } from '@/lib/session';
import { HomeActions } from './home-actions';
import { HomeButtons } from './home-buttons';
import { HomeChart } from './home-chart';
import { HomeQuoteCard } from './home-quote';
import { HomeTeam } from './home-team';
import { HomeTiles } from './home-tiles';
import { SurveyPopup } from '@/components/surveys/survey-popup';

/** The Calendar's own detail and edit dialogs, loaded when a row asks for them: most visits open neither. */
const DetailDialog = dynamic(() => import('@/components/calendar/detail-dialog').then((m) => m.DetailDialog), { ssr: false });
const EntryDialog = dynamic(() => import('@/components/calendar/entry-dialog').then((m) => m.EntryDialog), { ssr: false });

/**
 * **Home** (UI V1, 2026-10-30, Phase 18.11 T11; UI-100, UI-101; P19.8-T2, ADR-0228; `home-mobile-stopmotion`): the page
 * every field member lands on — **the reader's day, in one order at every size** (MOB UI-164, D-39):
 *
 * the title row (*Pagi, AGUS*, the bell, the avatar) → the quote → ***Buat proposal* | *Tambah user*** → **six tiles by
 * role** → ***Aksi hari ini*** → ***Laporan aktivitas tim*** → ***Aktivitas 7 hari terakhir***.
 *
 * - **A phone**: one column, the tiles two by two, 8px apart; the button row 8px above them.
 * - **A tablet** (P19.1-T5 AC-3; UI-113, `home-tablet`): the same blocks in the same order, in two columns where two fit
 *   — the quote, the button row, the tiles and *Aksi hari ini* full width, then *Laporan aktivitas tim* | *Aktivitas 7
 *   hari terakhir* side by side; the chart full width with no team report. `md:max-lg:` classes alone.
 * - **A laptop**: two columns, ~60% and ~40% — the quote, the button row, the tiles and *Aksi hari ini* on the left; the
 *   team report and the chart on the right.
 * - ***Tim saya* is gone** (MOB UI-163, ADR-0228 §2): its *Coaching minggu ini* showed *Coaching 7 hari* a second time;
 *   a leader's team tools are the tiles, which the role decides.
 * - **An entry in *Aksi hari ini* opens the Calendar's own detail over Home** (MOB UI-169, ADR-0228 §5): read fresh
 *   (`GET /calendar/entries/:id`), with what the reader may do — *Hapus*, which asks first, *Ubah*, which opens the
 *   Calendar's edit dialog over Home, *Tutup*; none of the writes in a read-only support session. **After any write Home
 *   reads itself again**, so a deleted entry leaves the list.
 * - **One read**, `GET /home`; every figure is the server's. An empty section is hidden, never a sentence (D-08).
 */
export function HomeScreen() {
  const t = useMessages(homeMessages);
  const { me } = useSession();
  const [view, setView] = useState<HomeView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reload, setReload] = useState(0);
  const [detail, setDetail] = useState<CalendarEntry | null>(null);
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [entryError, setEntryError] = useState<ApiError | null>(null);

  // The Calendar's own rights (`calendar-screen.tsx`): what the API would refuse is never offered.
  const readOnly = !!me?.isImpersonating && !!me.impersonationReadOnly;
  const may = {
    edit: useCan('calendar_entry:update') && !readOnly,
    delete: useCan('calendar_entry:delete') && !readOnly,
    answer: useCan('calendar_entry:answer') && !readOnly,
  };

  useEffect(() => {
    let live = true;
    readHome()
      .then((next) => { if (live) { setView(next); setError(null); } })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [reload]);

  const again = useCallback(() => setReload((n) => n + 1), []);
  const openEntry = useCallback((entryId: string) => {
    setEntryError(null);
    readEntry(entryId)
      .then(setDetail)
      .catch((err) => {
        // Gone since Home was read — deleted, or no longer the reader's: say so, and read Home again.
        setEntryError(toDisplayError(err));
        again();
      });
  }, [again]);

  const name = firstNameOf(me?.user.fullName ?? '').toUpperCase();
  const title = t.greeting[dayPartOf(view?.now.minute ?? minuteInZone(OFFICE_TIME_ZONE, new Date()))]({ name });
  const leader = view?.leader ?? null;

  return (
    <Page title={title} bell>
      <div data-home="" className="max-w-[1200px]">
        {error && <ErrorBanner {...error} />}
        {!view && !error && <HomeSkeleton label={t.loading} />}
        {view && (
          <div className="grid grid-cols-1 gap-3.5 md:max-lg:grid-cols-2 md:max-lg:items-start md:max-lg:gap-4 lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-5">
            {/* `grid-cols-1` on a phone: one `minmax(0, 1fr)` track, so the widest row cannot push the page sideways (T16). */}
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-2.5">
              <HomeQuoteCard quote={view.quote} className="md:max-lg:col-span-2" />
              {/* P19.8-T2 AC-3 (ADR-0228 §3): the slim row above the tiles, by role. */}
              <HomeButtons className="md:max-lg:col-span-2" />
              {/* 8px under the button row on a phone (the mockup's `.g2+.g2`), where the column's gap is 14px. */}
              <HomeTiles view={view} className="md:max-lg:col-span-2 max-md:-mt-1.5" />
              {entryError && <div className="md:max-lg:col-span-2"><ErrorBanner {...entryError} /></div>}
              <HomeActions
                actions={view.actions}
                today={view.today}
                onOpenEntry={openEntry}
                className="mt-1.5 md:max-lg:col-span-2 lg:mt-2.5"
              />
            </div>
            <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3.5">
              {/* Every leader's by role (P19.8-T2 AC-9): with nobody, its one line *Tambah agent pertama →*. */}
              {leader && <HomeTeam team={leader.team} leaderName={me?.user.fullName ?? ''} className="mt-1.5 lg:mt-0" />}
              <HomeChart activity={view.activity} className={cn('mt-1.5 lg:mt-0', !leader && 'md:max-lg:col-span-2')} />
            </div>
          </div>
        )}
      </div>

      {detail && (
        <DetailDialog
          key={detail.entryId}
          entry={detail}
          may={may}
          onClose={() => setDetail(null)}
          onEdit={(entry) => {
            setDetail(null);
            setEditing(entry);
          }}
          onDeleted={() => {
            setDetail(null);
            again();
          }}
          onAnswered={() => {
            setDetail(null);
            again();
          }}
        />
      )}
      {editing && (
        <EntryDialog
          key={editing.entryId}
          state={{ mode: 'edit', entry: editing }}
          canDelete={may.delete}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            again();
          }}
          onDeleted={() => {
            setEditing(null);
            again();
          }}
        />
      )}
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
