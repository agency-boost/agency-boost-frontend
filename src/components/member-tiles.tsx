'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LineIcon } from '@/components/ui/line-icon';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { memberMessages } from '@/i18n/messages/member';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatCalendarDay, formatNumber, formatRupiahCompact } from '@/lib/format';
import { memberDashboardHref, readMemberPerformance, type Member, type MemberPerformance } from '@/lib/org';
import { splitMoney } from '@/lib/unit-dashboard';

/**
 * **How a member is doing: four tiles, then *Lihat dashboard ›*** (OWN UI-020, OWN R4; ADR-0205 §1, §3;
 * `kpm-owner-mobile` screen 5, `kpm-owner-desktop` screen 3). Under the name on the member page, above the sections it
 * already has (*"Admin sections stay below"*):
 *
 * - ***Aktivitas 7 hari***: what they logged over the last 7 days;
 * - ***Produksi tahun ini*** with ***n% dari goal*** — the office's figure only; *Belum diunggah* while none is held, and
 *   ADR-0080's *Goal belum diatur* with no goal saved; the bar from 1024px, as the desktop mockup draws it;
 * - ***1:1 terakhir***: a date, or *Belum pernah*;
 * - ***Leads*** with ***n closing***.
 *
 * The shared `StatTile`, two to a row below 1024px and four from it, as the mockups draw them. **The figures are the
 * server's** (`GET /members/:membershipId/performance`): each the one the coaching page and the Unit Dashboard show for
 * the same person. *Lihat dashboard ›* opens what Group Tree opens for them (`memberDashboardHref`): a leader's Unit
 * Dashboard, anybody else's Personal Summary. Below 1024px it follows the tiles, the mobile mockup's 44px pill; from
 * 1024px the page puts it on the title row (`MemberDashboardLink`), as the desktop mockup does.
 *
 * Its own read and its own states, so a refusal of the tiles never hides the sections below them.
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
        <Skeleton label={t.loading} className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg bg-card px-3 py-2.5">
              <SkeletonBar className="h-3 w-24" />
              <SkeletonBar className="mt-2 h-6 w-16" />
            </div>
          ))}
        </Skeleton>
      ) : (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
          <StatTile label={t.activity} value={number(view.activity.count)} />
          <ProductionTile production={view.production} />
          <StatTile
            label={t.lastOneOnOne}
            value={view.lastOneOnOne
              ? <span className="text-lg font-semibold">{formatCalendarDay(view.lastOneOnOne.date, figures)}</span>
              : <span className="text-lg font-semibold">{t.never}</span>}
          />
          <StatTile
            label={t.leads}
            value={number(view.leads.open)}
            sub={t.closing({ n: number(view.leads.closing) })}
          />
        </div>
      )}
      <MemberDashboardLink member={member} className="mt-2 lg:hidden" />
    </section>
  );
}

/** *Produksi tahun ini*: the office's year to date, compact, its unit beside it; the share of the goal under it. */
function ProductionTile({ production }: { production: MemberPerformance['production'] }) {
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
    <StatTile
      label={t.production}
      value={money ? money.value : <span className="text-lg font-semibold text-muted">{t.notUploaded}</span>}
      unit={money?.unit ?? undefined}
      bar={production.attainmentPct}
      // The bar from 1024px, as the desktop mockup draws it; below, the line alone (the mobile mockup).
      className="max-lg:[&_[aria-hidden=true]]:hidden"
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
