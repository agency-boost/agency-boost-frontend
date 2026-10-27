'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { Button, buttonClass, Card, ErrorBanner } from '@/components/ui/field';
import { TEXT_TAP } from '@/components/ui/phone';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { TippedGlyph } from '@/components/ui/tipped-glyph';
import { readActivityRatios, type ActivityRatios } from '@/lib/activity';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';
import { usePhone } from '@/lib/use-phone';
import {
  lockedWords, OWN_COPY, productionToast, PROTOTYPE_COPY, readUnitDashboard, UNIT_PERIODS,
  type UnitDashboardView, type UnitPeriod, type UnitRow,
} from '@/lib/unit-dashboard';
import { UnitRoster } from './unit-roster';
import { UnitTiles } from './unit-tiles';
import { UpdateProductionDialog } from './update-production-dialog';

/**
 * The Unit Dashboard's body (`Overall.html:3888-3949`; P15-T2 to T4): the period switch, the tiles and
 * *Your team's roster*, over one read of the server's (`GET /unit/dashboard`).
 *
 * **The reader's own unit, or — `forId` — the unit of somebody below them who leads** (P15-T4 AC-2,
 * `/unit/dashboard/[membershipId]`): the same screen, titled *"{name}'s Unit Dashboard"*, its head's row
 * named rather than *You*. A unit the reader cannot open is the not-found state, which says nothing
 * about who exists.
 *
 * **The period is the address's** (`?period=`, D-period), so a refresh keeps it: each button re-reads
 * the dashboard for its period, and a retry after a failure keeps it too. *Status* and the ✓ are the
 * calendar month's whatever the period, as the server answers them.
 *
 * The states the prototype lacks are Fills (L-01): a skeleton shaped like the tiles and the table, an
 * error with a retry, and the empty unit of somebody who leads nobody, which says so in plain words and
 * points to their own screens.
 */
export function UnitDashboard({ forId, period }: { forId?: string; period: UnitPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = useSession();
  const { toast, show } = useToast();
  /** Below 768px the roster is a card per person (P18.95-T3 AC-1), asked before the read answers, so no table draws first. */
  const phone = usePhone();

  /** The period on screen: the address's, and the one just pressed until the address catches up. */
  const [shown, setShown] = useState<UnitPeriod>(period);
  useEffect(() => setShown(period), [period]);

  const key = `${forId ?? ''}|${shown}`;
  const [held, setHeld] = useState<{ key: string; view: UnitDashboardView } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [missing, setMissing] = useState(false);
  /** A retry, or the read after a save: the same period, read again. */
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let live = true;
    setError(null);
    setMissing(false);
    readUnitDashboard({ period: periodOf(key), for: forId })
      .then((view) => { if (live) setHeld({ key, view }); })
      .catch((err) => {
        if (!live) return;
        if (forId && err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [key, forId, attempt]);

  // A save's read keeps the table on screen until the new one arrives; a new period starts from the skeleton.
  const view = held?.key === key ? held.view : null;

  /**
   * Each person's ratios, read once when their row first opens (D-ratios): each read of somebody else's
   * is audited, so a row closed and opened again, or kept open across a period, asks nothing more.
   */
  const ratios = useRef(new Map<string, Promise<ActivityRatios>>());
  const readRatios = useCallback((row: UnitRow) => {
    const subject = row.isReader ? undefined : row.membershipId;
    const id = subject ?? '';
    let read = ratios.current.get(id);
    if (!read) {
      read = readActivityRatios(subject);
      read.catch(() => ratios.current.delete(id));
      ratios.current.set(id, read);
    }
    return read;
  }, []);

  const choose = (next: UnitPeriod) => {
    if (next === shown) return;
    setShown(next);
    router.replace(`${pathname}?period=${next}`, { scroll: false });
  };

  const toggle = useCallback((membershipId: string) => {
    setExpanded((open) => {
      const next = new Set(open);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }, []);

  if (missing) return <UnitNotFound />;

  const title = forId ? (view ? `${view.head.name}’s Unit Dashboard` : null) : null;
  const canUpdate = !!view && view.production.canUpdate && !me?.impersonationReadOnly;

  return (
    <div className="min-w-0">
      {title && <PageHeader title={title} />}
      {forId && !view && error && <PageHeader title={PROTOTYPE_COPY.title} />}

      {!(view?.empty) && <PeriodSwitch period={shown} onChoose={choose} />}

      {error && (
        <div className="mt-5">
          <ErrorBanner {...error} />
          <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
        </div>
      )}
      {!view && !error && <UnitSkeleton />}
      {view?.empty && <NobodyYet />}
      {view && !view.empty && (
        <>
          <UnitTiles view={view} period={shown} />
          <UnitRoster
            view={view}
            period={shown}
            expanded={expanded}
            onToggle={toggle}
            readRatios={readRatios}
            phone={phone}
            action={canUpdate && (view.production.locked ? (
              // Drawn and not usable: the month is locked, and the words say who reopens it (P15-T3). Its face is
              // the primary button's own classes, so the held button and the live one are the same amber.
              <TippedGlyph
                glyph={PROTOTYPE_COPY.updateProduction}
                name={PROTOTYPE_COPY.updateProduction}
                tip={lockedWords(view.production.month)}
                unavailable
                align="fit"
                face={buttonClass('primary', 'h-auto w-auto px-4 py-[9px] text-base')}
              />
            ) : (
              <Button className="h-auto px-4 py-[9px] text-base" onClick={() => setUpdating(true)}>
                {PROTOTYPE_COPY.updateProduction}
              </Button>
            ))}
          />
          {updating && (
            <UpdateProductionDialog
              view={view}
              onClose={() => setUpdating(false)}
              onStale={() => setAttempt((n) => n + 1)}
              onSaved={(updated) => {
                setUpdating(false);
                show(productionToast(updated));
                if (updated > 0) setAttempt((n) => n + 1);
              }}
            />
          )}
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}

const periodOf = (key: string) => key.slice(key.indexOf('|') + 1) as UnitPeriod;

/**
 * *Last 7 days · This month · This year* (`:3893-3898`, `.segmented` `:1117-1119`), at the end of the bar
 * above the tiles. **Toggle buttons**, `aria-pressed` saying which is on: they control no panel, they
 * change what the page reads.
 */
function PeriodSwitch({ period, onChoose }: { period: UnitPeriod; onChoose: (period: UnitPeriod) => void }) {
  return (
    <div className="mb-1.5 flex flex-wrap items-start justify-end gap-4">
      <div role="group" aria-label="Period" className="inline-flex flex-wrap rounded-[9px] border border-hairline bg-card p-[3px]">
        {UNIT_PERIODS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={period === id}
            onClick={() => onChoose(id)}
            className={cn(
              'whitespace-nowrap rounded-[6px] px-4 py-[7px] text-[0.84375rem] font-semibold',
              period === id ? 'bg-navy text-white' : 'text-muted hover:text-navy',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The tiles and the table, in outline, while the roster is read. */
function UnitSkeleton() {
  return (
    <Skeleton label={OWN_COPY.loading}>
      <div className="mb-3 mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="min-h-[126px] rounded-lg border border-hairline bg-card px-[18px] py-4">
            <SkeletonBar className="h-2.5 w-1/2" />
            <SkeletonBar className="mt-6 h-5 w-2/3" />
            <SkeletonBar className="mt-2 w-4/5" />
          </div>
        ))}
      </div>
      <div className="mt-[22px] rounded-lg border border-hairline bg-card">
        <div className="border-b border-hairline px-5 py-4"><SkeletonBar className="h-4 w-40" /></div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-6 border-b border-hairline px-5 py-4 last:border-b-0">
            <SkeletonBar className="h-3.5 w-1/5" />
            <SkeletonBar className="h-3.5 w-1/6" />
            <SkeletonBar className="h-3.5 w-1/6" />
            <SkeletonBar className="h-3.5 w-1/6" />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/**
 * Somebody who leads nobody (D-reach): an empty unit, never a refusal. Ours to word (L-01), in plain
 * words, pointing to the reader's own screens by the names the sidebar gives them — *Group tree* is not
 * offered to somebody who leads nobody.
 */
function NobodyYet() {
  return (
    <Card className="mt-5 p-0">
      <EmptyState
        title={OWN_COPY.emptyTitle}
        action={(
          <div className="text-md text-muted">
            <p>{OWN_COPY.emptyLine}</p>
            <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
              <Link href="/summary" className={cn('font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>Personal summary</Link>
              <Link href="/activity/log" className={cn('font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>Activity management</Link>
            </p>
          </div>
        )}
      />
    </Card>
  );
}

/**
 * A unit the reader cannot open (P15-T4 AC-2): somebody who leads nobody, somebody outside their team or
 * gone, another office's member, or the reader themselves — one answer for each, so it tells nobody who
 * exists. Ours to word (L-01).
 */
function UnitNotFound() {
  return (
    <div className="min-w-0">
      <PageHeader title={PROTOTYPE_COPY.title} />
      <Card>
        <h2 className="font-display text-lg font-bold text-navy">{OWN_COPY.notFoundTitle}</h2>
        <p className="mt-1 text-md text-muted">{OWN_COPY.notFoundLine}</p>
        <p className="mt-3">
          <Link href="/unit/dashboard" className={cn('text-md font-semibold text-navy underline-offset-2 hover:underline', TEXT_TAP)}>
            {OWN_COPY.backToYours}
          </Link>
        </p>
      </Card>
    </div>
  );
}
