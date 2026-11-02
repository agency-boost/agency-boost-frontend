'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { kpmOverviewMessages } from '@/i18n/messages/kpm-overview';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { initialsOf } from '@/lib/calendar';
import {
  lastLoggedWords, moreWords, readNotLogged, rungShort, SILENT_SHOWN, trendWords,
  type NotLoggedList, type OverviewEngagement,
} from '@/lib/kpm-overview';
import { Bar, OverviewCard, PctPill, useTone } from './parts';

/**
 * *Engagement* (`KPM_Owner.html:963-1003`, CSS `:462-484`): two cards side by side, one under the other
 * below 960px.
 *
 * **The first card is OD-142's**: *Agents who logged activity this month*, over the prototype's own
 * sub-line, the figure the sub-line describes, and the trend against **last month to the same day** — a
 * whole month against part of one is the defect the prototype's *"Up from 138 last month"* draws (D-figures).
 *
 * The second is *Activity logging — this week*, `ACTIVITY_COMPLIANCE_RATE` over the last 7 days, and the
 * prototype's *View who hasn't logged →*, which here is a button that reads the list when it is first
 * opened and never before: each name on it is an audited read of that member's activity (D-audit).
 */
export function Engagement({ engagement }: { engagement: OverviewEngagement }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const tone = useTone();
  const { loggedThisMonth: month, loggedThisWeek: week } = engagement;
  const trend = trendWords(month.count, month.lastMonthToDate, language, figures);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <EngageCard title={t.loggedMonthTitle} desc={t.loggedMonthDesc}>
        <Figure big={month.count} of={`/ ${month.of}`} pct={month.pct} />
        {month.pct !== null && (
          // `.bar-fill.success` at the prototype's 76% (`:975`); its plain fill is amber (`:473`).
          <Bar pct={month.pct} fill={tone(month.pct) === 'success' ? 'bg-success' : 'bg-amber'} className="mb-2" />
        )}
        {trend && (
          <p className="text-xs text-muted">
            {trend.lead}
            {trend.change && (
              <>
                {' ('}
                <strong className={trend.direction === 'up' ? 'text-success' : 'text-alert'}>{trend.change}</strong>
                )
              </>
            )}
          </p>
        )}
      </EngageCard>

      <EngageCard title={t.weekTitle} desc={t.weekDesc}>
        <Figure big={week.logged} of={t.loggedNotLogged({ notLogged: week.notLogged })} pct={week.pct} />
        {week.pct !== null && <Bar pct={week.pct} fill="bg-amber" className="mb-2" />}
        {/* Nobody to name, nothing to reveal: the figure beside it already says *0 not logged*. */}
        {week.notLogged > 0 && <NotLoggedReveal />}
      </EngageCard>
    </div>
  );
}

/** `.engage-card` (`:463-465`): a 14px bold title, a muted sub-line, then the figure. */
function EngageCard({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <OverviewCard className="p-[18px]">
      <h3 className="mb-0.5 text-md font-bold text-navy">{title}</h3>
      <p className="mb-3.5 text-sm text-muted">{desc}</p>
      {children}
    </OverviewCard>
  );
}

/** `.engage-figure` (`:466-469`): the big number, what it is out of, and the pill at the end of the line. */
function Figure({ big, of, pct }: { big: number; of: string; pct: number | null }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-body text-3xl font-bold text-navy">{big}</span>
      <span className="text-md text-muted">{of}</span>
      <PctPill pct={pct} className="ml-auto" />
    </div>
  );
}

/**
 * *View who hasn't logged →* (`:986-1002`): the prototype's `.reveal-link`, as a **button** that says
 * whether it is open. The list is read on the first opening and kept: closing and opening it again asks
 * nothing more, so one look writes one set of audit entries.
 *
 * It names the three longest silent — the server's order, never-logged first — and then points to *All
 * members*, whose *Last activity* column is the full list (D-directory): the prototype's own line, here a
 * link.
 */
function NotLoggedReveal() {
  const t = useMessages(kpmOverviewMessages);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotLoggedList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const panelId = useId();
  /**
   * **One read per attempt.** Each read writes a §3.5 entry per member it names (D-audit), so closing the
   * reveal before the answer lands must not throw that answer away and read again on reopening: the read
   * is started once, kept whatever the reveal does, and dropped only if the page goes.
   */
  const requested = useRef<number | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!open || list || requested.current === attempt) return;
    requested.current = attempt;
    setError(null);
    readNotLogged()
      .then((next) => { if (mounted.current) setList(next); })
      .catch((err) => { if (mounted.current) setError(toDisplayError(err)); });
  }, [open, list, attempt]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((was) => !was)}
        // `.reveal-link` (`:477`) is amber-dark, which fails contrast as small text; amber-ink clears it.
        className="mt-3 inline-block text-base font-semibold text-amber-ink underline-offset-2 hover:underline"
      >
        {t.reveal}
      </button>
      <div id={panelId} hidden={!open} className="mt-2.5 border-t border-hairline pt-2.5">
        {open && error && (
          <div>
            <ErrorBanner {...error} />
            <Button variant="secondary" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
          </div>
        )}
        {open && !list && !error && (
          <Skeleton label={t.loadingList}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5">
                <SkeletonBar className="h-3.5 w-1/2" />
                <SkeletonBar className="h-3 w-1/4" />
              </div>
            ))}
          </Skeleton>
        )}
        {list && <SilentList list={list} />}
      </div>
    </>
  );
}

function SilentList({ list }: { list: NotLoggedList }) {
  const t = useMessages(kpmOverviewMessages);
  const language = useLanguage();
  const shown = list.members.slice(0, SILENT_SHOWN);
  const more = list.total - shown.length;
  if (list.total === 0 || shown.length === 0) return <p className="py-1.5 text-base text-muted">{t.everybodyLogged}</p>;
  return (
    <>
      <ul>
        {shown.map((member) => (
          <li key={member.membershipId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5 text-base text-navy">
            <span className="flex min-w-0 items-center gap-2">
              {/* `.mini-avatar` (`:482`): initials on navy-soft, a picture of the name beside it. */}
              <span
                aria-hidden="true"
                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-navy-soft text-2xs font-bold text-white"
              >
                {initialsOf(member.name)}
              </span>
              <span className="min-w-0">{member.name} — {rungShort(member.rung)}</span>
            </span>
            <span className="text-xs text-muted">{lastLoggedWords(member.daysSince, language)}</span>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <p className="pt-1 text-sm">
          <Link href="/people/members" className="text-muted underline underline-offset-2 hover:text-navy">
            {moreWords(more, language)}
          </Link>
        </p>
      )}
    </>
  );
}
