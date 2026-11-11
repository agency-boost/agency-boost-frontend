'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { memberMessages } from '@/i18n/messages/member';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatNumber, formatRupiahCompact } from '@/lib/format';
import { memberDashboardHref, readMemberPerformance, type Member, type MemberPerformance } from '@/lib/org';
import { splitMoney } from '@/lib/unit-dashboard';

/**
 * **How a member is doing: one row of four, then *Lihat dashboard ›*** (OWN UI-020, OWN R4; ADR-0205 §1, §3; since
 * P19.12-T5, ADR-0248 §1 and the client's message of 11 November 2026, item 9 — *"Stat dikecilin jadi 1 baris"*). Under
 * the name on the member page:
 *
 * - ***Aktivitas 7 hari***: what they logged over the last 7 days;
 * - ***Produksi tahun ini*** with ***n% dari goal*** — the office's figure only; *Belum diunggah* while none is held, and
 *   ADR-0080's *Goal belum diatur* with no goal saved;
 * - ***1:1 terakhir***: a date, or *Belum pernah*;
 * - ***Leads*** with ***n closing***.
 *
 * **One compact row of four at every width**, in one card, each cell a small label over its figure and its line — the
 * 26px `StatTile`s two to a row, and the production bar, are gone (ADR-0248 §1, amending ADR-0205 §1's layout). **The
 * figures are the server's** (`GET /members/:membershipId/performance`): each the one the coaching page and the Unit
 * Dashboard show for the same person. *Lihat dashboard ›* opens what Group Tree opens for them (`memberDashboardHref`): a
 * leader's Unit Dashboard, anybody else's Personal Summary. Below 1024px it follows the row, the mobile mockup's 44px
 * pill; from 1024px the page puts it on the title row (`MemberDashboardLink`).
 *
 * Its own read and its own states, so a refusal of the row never hides the sections below it.
 */
export function MemberTiles({ member }: { member: Pick<Member, 'membershipId' | 'isLeader'> }) {
  const t = useMessages(memberMessages).tiles;
  const figures = useFigureLanguage();
  const [view, setView] = useState<MemberPerformance | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    setError(null);
    void readMemberPerformance(member.membershipId)
      .then((answer) => { if (live) setView(answer); })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [member.membershipId]);

  const number = (n: number) => formatNumber(n, {}, figures);

  return (
    <section aria-label={t.heading} className="mb-4" data-member-tiles="">
      {error ? (
        <p role="status" className="rounded-lg bg-card px-3 py-2.5 text-md text-muted">{t.unavailable}</p>
      ) : view === null ? (
        <Skeleton label={t.loading} className={ROW}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={CELL}>
              <SkeletonBar className="h-3 w-12" />
              <SkeletonBar className="mt-1.5 h-5 w-10" />
            </div>
          ))}
        </Skeleton>
      ) : (
        <div className={ROW}>
          <StatCell label={t.activity} value={number(view.activity.count)} />
          <ProductionCell production={view.production} />
          <StatCell
            label={t.lastOneOnOne}
            value={<span className={WORDS}>{view.lastOneOnOne ? formatCalendarDay(view.lastOneOnOne.date, figures) : t.never}</span>}
          />
          <StatCell label={t.leads} value={number(view.leads.open)} sub={t.closing({ n: number(view.leads.closing) })} />
        </div>
      )}
      <MemberDashboardLink member={member} className="mt-2 lg:hidden" />
    </section>
  );
}

/** The row: one card, four cells side by side at every width, a hairline between them. */
const ROW = 'grid grid-cols-4 divide-x divide-divider rounded-lg bg-card';
const CELL = 'min-w-0 px-2 py-2 lg:px-3 lg:py-2.5';
/** A value that is words (*Belum pernah*, *Belum diunggah*, a date) rather than a figure: smaller, and it may wrap. */
const WORDS = 'whitespace-normal text-sm font-semibold leading-snug';

/** One cell of the row: a small label, the figure (its unit small beside it), and an optional line under it. */
function StatCell({ label, value, unit, sub }: { label: ReactNode; value: ReactNode; unit?: ReactNode; sub?: ReactNode }) {
  return (
    <div data-stat-tile="" className={CELL}>
      <p data-stat-label="" className="text-xs leading-snug text-muted lg:text-sm">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 whitespace-nowrap text-lg font-semibold leading-tight tabular-nums text-ink lg:text-xl">
        {value}
        {unit && <span className="text-xs font-semibold text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-xs leading-snug text-muted">{sub}</p>}
    </div>
  );
}

/** *Produksi tahun ini*: the office's year to date, compact, its unit beside it; the share of the goal under it. */
function ProductionCell({ production }: { production: MemberPerformance['production'] }) {
  const t = useMessages(memberMessages).tiles;
  const figures = useFigureLanguage();
  const held = production.actualMinor !== null;
  const money = held ? splitMoney(formatRupiahCompact(production.actualMinor!, {}, figures)) : null;
  const sub = !production.goalSet
    ? t.noGoal
    : production.attainmentPct !== null
      ? t.ofGoal({ pct: formatNumber(production.attainmentPct, {}, figures) })
      : undefined;
  return (
    <StatCell
      label={t.production}
      value={money ? money.value : <span className={cn(WORDS, 'text-muted')}>{t.notUploaded}</span>}
      unit={money?.unit ?? undefined}
      sub={sub}
    />
  );
}

/**
 * ***Lihat dashboard ›*** (OWN R4, ADR-0205 §3): where Group Tree opens the person — a leader's Unit Dashboard, anybody
 * else's Personal Summary. A 44px pill on the page's own background below 1024px, the mobile mockup's; the primary
 * button of the title row from 1024px, the desktop mockup's. The target's own guard decides what it shows.
 */
export function MemberDashboardLink({
  member,
  className,
  variant = 'pill',
}: {
  member: Pick<Member, 'membershipId' | 'isLeader'>;
  className?: string;
  variant?: 'pill' | 'primary';
}) {
  const t = useMessages(memberMessages).tiles;
  return (
    <Link
      href={memberDashboardHref(member)}
      data-member-dashboard=""
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill px-3.5 text-md font-semibold',
        variant === 'pill' ? 'w-full bg-card text-navy' : 'bg-secondary text-secondary-contrast hover:bg-secondary-hover',
        className,
      )}
    >
      {t.seeDashboard}
      <LineIcon name="chevronRight" className="h-4 w-4" />
    </Link>
  );
}
