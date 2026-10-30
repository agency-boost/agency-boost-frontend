'use client';

import Link from 'next/link';
import { Boost } from '@/components/boost';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { homeMessages } from '@/i18n/messages/home';
import { cn } from '@/lib/cn';
import { formatNumber, formatWeekday } from '@/lib/format';
import type { HomeActivity } from '@/lib/home';
import { SectionHeading } from './home-actions';

/** The tallest bar, in px: the chart area is ~130px on a phone (~150px on a desktop) with the value above each bar. */
const TALLEST = 100;
/** A day of nothing still draws a sliver of its grey bar, so the seven columns read as a week. */
const FLOOR = 3;

/**
 * ***Aktivitas 7 hari terakhir*** (UI-100): the reader's activity count per day for **the seven office days ending
 * today** — rolling, not Monday to Sunday — as seven bars, each value above its bar, the day's short name under it
 * and *Hari ini* under the last; today's bar and word in the accent, the others grey. The total on the header. No axis,
 * no gridlines. The whole card opens `/activity/log`.
 *
 * **Nothing in all seven days**: Boost sleeping with *Belum ada aktivitas 7 hari terakhir* in the chart's place, and
 * no total (UI-102; *sleeping* draws *thinking* until its artwork is exported).
 *
 * The counts are the server's — the totals Activity Management saved — and the bars are their heights relative to the
 * week's highest. For a screen reader the card reads each day and its count, not the bars.
 */
export function HomeChart({ activity, className }: { activity: HomeActivity; className?: string }) {
  const t = useMessages(homeMessages).chart;
  const figures = useFigureLanguage();
  const highest = Math.max(...activity.days.map((d) => d.count), 0);
  const last = activity.days.length - 1;
  const dayName = (date: string, at: number) => (at === last ? t.today : formatWeekday(date, figures));

  return (
    <section data-home-chart="" aria-labelledby="home-chart" className={className}>
      <SectionHeading id="home-chart" title={t.heading}>
        {highest > 0 && <span className="text-md font-semibold text-muted">{t.total({ n: activity.total })}</span>}
      </SectionHeading>
      <Link href="/activity/log" className="block rounded-lg bg-card px-3 pb-2.5 pt-3 lg:px-3.5 lg:hover:bg-hover-row">
        {highest === 0 ? (
          <span className="flex flex-col items-center py-2 text-center">
            <Boost pose="sleeping" size={120} />
            <span className="mt-2 text-[0.9375rem] font-bold text-ink">{t.empty}</span>
          </span>
        ) : (
          <>
            <span className="sr-only">
              {t.label}: {activity.days.map((d, at) => t.day({ day: dayName(d.date, at), n: d.count })).join(', ')}
            </span>
            <span aria-hidden="true" className="mt-1.5 grid h-[8.125rem] grid-cols-7 items-end lg:h-[9.375rem]">
              {activity.days.map((day, at) => (
                <span
                  key={day.date}
                  data-today={at === last ? 'true' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-end text-xs font-semibold',
                    at === last ? 'text-amber-ink' : 'text-pill-grey-ink',
                  )}
                >
                  {formatNumber(day.count, {}, figures)}
                  <span
                    className={cn('mt-1 block w-[1.625rem] rounded-t-[6px] rounded-b-[3px] lg:w-[1.875rem]', at === last ? 'bg-amber' : 'bg-line')}
                    style={{ height: Math.max(FLOOR, Math.round((day.count / highest) * TALLEST)) }}
                  />
                </span>
              ))}
            </span>
            <span aria-hidden="true" className="mt-1.5 grid grid-cols-7 border-t border-divider pt-1.5 text-center text-xs text-muted">
              {activity.days.map((day, at) => (
                <span key={day.date} className={cn(at === last && 'font-bold text-amber-ink')}>{dayName(day.date, at)}</span>
              ))}
            </span>
          </>
        )}
      </Link>
    </section>
  );
}
