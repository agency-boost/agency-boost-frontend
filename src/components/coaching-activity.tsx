'use client';

import { useEffect, useState } from 'react';
import { ActivityDashboardPanel } from '@/components/activity-dashboard';
import { PersonalRatioCard } from '@/components/ratio-card';
import { ErrorBanner } from '@/components/ui/field';
import { LineIcon } from '@/components/ui/line-icon';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { coachingMessages } from '@/i18n/messages/coaching';
import { uiV1Messages } from '@/i18n/messages/ui-v1';
import { readActivityDay, type ActivityDay } from '@/lib/activity';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { addDays } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import type { Coachee } from '@/lib/coaching';
import { formatCalendarDayLong } from '@/lib/format';

type View = 'log' | 'dashboard' | 'ratio';

/**
 * **A coachee's *Activity* tab: their Log, Dashboard and Ratio** (UI V1, UI-029: *every tab opens that agent's own
 * page under the same agent header*), as three views under one segmented control, the order `/activity` gives them.
 * It opens on the Dashboard, which the tab drew alone before (P13.1-T9).
 *
 * - **Log**: the coachee's day, read-only — nobody logs another person's day — from `GET /activity/log?membershipId=`
 *   (audited, roles §3.5), a day at a time back from the office's today.
 * - **Dashboard**: `ActivityDashboardPanel` for them, `GET /activity/dashboard?for=`, the Activity agent's (T12).
 * - **Ratio**: the shared ratio card for them (`PersonalRatioCard`, `GET /activity/ratios?for=`), as rows (O-3).
 */
export function CoacheeActivity({ coachee }: { coachee: Coachee }) {
  const t = useMessages(coachingMessages).pages.activity;
  const [view, setView] = useState<View>('dashboard');
  return (
    <Segmented
      label={t.views}
      tabs={[{ id: 'log', label: t.log }, { id: 'dashboard', label: t.dashboard }, { id: 'ratio', label: t.ratio }]}
      active={view}
      onSelect={(id) => setView(id as View)}
      className="mb-3"
    >
      {(active) => (
        active === 'log' ? <CoacheeDay coachee={coachee} />
          : active === 'ratio' ? <PersonalRatioCard membershipId={coachee.membershipId} />
            : (
              <ActivityDashboardPanel
                subject={{ membershipId: coachee.membershipId, name: coachee.name, pronoun: coachee.pronoun, rungCode: coachee.rung.code }}
              />
            )
      )}
    </Segmented>
  );
}

/** The coachee's logged day, read-only: *‹ Jumat, 30 Okt 2026 ›*, the day's count, each activity and its number. */
function CoacheeDay({ coachee }: { coachee: Coachee }) {
  const t = useMessages(coachingMessages).pages.activity;
  const v1 = useMessages(uiV1Messages);
  const figures = useFigureLanguage();
  const [date, setDate] = useState(coachee.today);
  const [day, setDay] = useState<ActivityDay | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setDay(null);
    setError(null);
    readActivityDay({ date, membershipId: coachee.membershipId })
      .then((next) => { if (live) setDay(next); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [date, coachee.membershipId]);

  const STEP = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-navy hover:bg-hover-row disabled:opacity-30 lg:h-9 lg:w-9';
  const logged = day?.entries.filter((entry) => entry.count > 0) ?? [];
  return (
    <section aria-label={t.log} data-coachee-day="" className="rounded-lg border border-card-edge bg-card p-3.5">
      <div className="flex items-center gap-1">
        <button type="button" aria-label={t.previous} onClick={() => setDate((d) => addDays(d, -1))} className={STEP}>
          <LineIcon name="chevronLeft" className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 text-center text-md font-bold text-navy">{formatCalendarDayLong(date, figures)}</p>
        <button
          type="button"
          aria-label={t.next}
          disabled={date >= coachee.today}
          onClick={() => setDate((d) => addDays(d, 1))}
          className={STEP}
        >
          <LineIcon name="chevronRight" className="h-5 w-5" />
        </button>
      </div>
      {error && <div className="mt-2"><ErrorBanner {...error} /></div>}
      {!day && !error && (
        <Skeleton label={t.reading}>
          {[0, 1, 2].map((i) => <SkeletonBar key={i} className="mt-3 h-4 w-full" />)}
        </Skeleton>
      )}
      {day && (
        <>
          <p className="mt-1 text-center text-base text-muted">{v1.activities({ count: day.totalCount })}</p>
          {logged.length === 0 ? (
            <p className="py-3 text-center text-base text-muted">{t.none}</p>
          ) : (
            <ul className="mt-2 divide-y divide-divider">
              {logged.map((entry) => (
                <li key={entry.activityTypeId} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
                  {/* The office's activity names, as typed (admin content). */}
                  <span className="min-w-0 text-md text-ink">{entry.label}</span>
                  <span className={cn('text-lg font-bold text-navy')}>{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
