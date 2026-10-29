'use client';

import { useEffect, useState } from 'react';
import { AspectCard } from '@/components/activation-parts';
import { useCoachee } from '@/components/coaching-person';
import { SummaryCard } from '@/components/summary-card';
import { Button, Card, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { useFigureLanguage, useMessages } from '@/i18n/language-provider';
import { activationMessages } from '@/i18n/messages/activation';
import {
  FIRST_CASE_CLOSED, readMyActivation, readNewHire, type ActivationItemProgress, type ActivationView,
} from '@/lib/activation';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';

/**
 * **The coaching *Activation* tab** (`renderPersonActivationStatus`, `Overall.html:6464-6489`; P13-T9):
 * a person's whole checklist, read-only, in the form the prototype draws for Rina (`:4337-4342`) and for
 * the reader's own coaching (`:4574-4577`, D-coaching-me).
 *
 * The card *90-Day Activation* with *"{pct}% complete"* and a mini bar; then the five aspect cards,
 * numbered, each item *"✓ Done · New Active Agent"* when it is `FIRST_CASE_CLOSED` — by code, never item
 * 13 by position (`:6472`, invariant §4) — *"✓ Done"*, or *"Not done"*. No day, no table and no note, as
 * drawn (T9 AC-1).
 *
 * **The same progress the hire sees** (exit criterion 2): the tab prints the read the hire's page and the
 * leader's detail print — `GET /new-hires/:membershipId` for a coach, `GET /activation/me` for the
 * reader's own — so the four readers are served one computation, and the prototype's constants, which
 * drew every item done for both people (`:6490-6493`), are gone.
 *
 * **Its words are the activation's catalogue** (`messages/activation.ts`, its `record`; P18.98-T4), in the reader's
 * language, and its percentage in `useFigureLanguage()`'s.
 */
export function ActivationRecord({ view }: { view: ActivationView }) {
  const t = useMessages(activationMessages);
  const figures = useFigureLanguage();
  const width = Math.min(100, Math.max(0, view.pct));
  const complete = t.pctComplete({ pct: formatPercent(view.pct, {}, figures) });
  return (
    <div className="flex flex-col gap-4">
      <SummaryCard id="activation-record" title={t.record.title} tag={complete}>
        <div
          role="progressbar"
          aria-labelledby="activation-record"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={width}
          aria-valuetext={complete}
          className="h-1.5 overflow-hidden rounded-sm bg-navy/[0.08]"
        >
          <div className="h-full rounded-sm bg-navy-soft" style={{ width: `${width}%` }} />
        </div>
      </SummaryCard>
      {view.aspects.map((aspect, i) => (
        <AspectCard key={aspect.code} n={i + 1} label={aspect.label}>
          <ul className="mt-2.5">
            {aspect.items.map((item) => <RecordRow key={item.code} item={item} />)}
          </ul>
        </AspectCard>
      ))}
    </div>
  );
}

/** `.team-row` (`:1568-1570`): the item on the left, its state on the right. */
function RecordRow({ item }: { item: ActivationItemProgress }) {
  const t = useMessages(activationMessages).record;
  const words = !item.done ? t.notDone : item.code === FIRST_CASE_CLOSED ? t.doneNewActiveAgent : t.done;
  return (
    <li
      data-code={item.code}
      className="flex items-center justify-between gap-3 border-t border-hairline py-1.5 text-sm text-muted first:border-t-0 first:pt-0"
    >
      <span>{item.label}</span>
      <strong className={cn('shrink-0 text-right text-lg font-bold', item.done ? 'text-success' : 'text-muted')}>{words}</strong>
    </li>
  );
}

/** One read for the tab: the view, nobody's (a 404), a failure, or still waiting. */
function useActivationRead(read: () => Promise<ActivationView>, key: string) {
  const [view, setView] = useState<ActivationView | null>(null);
  const [none, setNone] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setView(null);
    setNone(false);
    setError(null);
    read()
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setNone(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
    // `read` is rebuilt every render; `key` is what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { view, none, error, retry: () => setAttempt((n) => n + 1) };
}

function RecordState({
  read, empty,
}: { read: ReturnType<typeof useActivationRead>; empty: string }) {
  const t = useMessages(activationMessages);
  if (read.none) {
    // A Fill (T9 AC-3): somebody with no activation opens on this, not on a disabled tab.
    return <Card><p className="text-center text-md text-muted">{empty}</p></Card>;
  }
  if (read.error) {
    return (
      <div>
        <ErrorBanner {...read.error} />
        <Button variant="secondary" className="mt-3" onClick={read.retry}>{t.tryAgain}</Button>
      </div>
    );
  }
  if (!read.view) {
    return (
      <Skeleton label={t.record.loading}>
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-hairline bg-card px-[22px] py-[18px]">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="mt-4 h-1.5 w-full" />
          </div>
          <div className="rounded-lg border border-hairline bg-card px-5 py-4">
            <SkeletonBar className="h-5 w-40" />
            <SkeletonText lines={4} className="mt-4" />
          </div>
        </div>
      </Skeleton>
    );
  }
  return <ActivationRecord view={read.view} />;
}

/** A coachee's tab, inside the person shell (T9 AC-3): the read a leader's detail makes. */
export function CoacheeActivation() {
  const coachee = useCoachee();
  const t = useMessages(activationMessages).record;
  const read = useActivationRead(() => readNewHire(coachee.membershipId), coachee.membershipId);
  return <RecordState read={read} empty={t.coacheeNone({ name: coachee.name })} />;
}

/** The reader's own, on `/coaching/me` (T9 AC-4, D-coaching-me): the read the hire's page makes. */
export function MyActivationRecord() {
  const t = useMessages(activationMessages).record;
  const read = useActivationRead(readMyActivation, 'me');
  return <RecordState read={read} empty={t.meNone} />;
}
