'use client';

import { useEffect, useState } from 'react';
import { useCoachee, useCoacheeNotFound } from '@/components/coaching-person';
import { EmptyCard } from '@/components/training/training-catalog';
import { SkillCards } from '@/components/training/training-parts';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import {
  OWN_COPY, readCoacheeTraining, readTrainingProgress, type TrainingProgressView,
} from '@/lib/training';

/**
 * **The coaching *Training* tab** (`renderPersonTrainingStatus`, `Overall.html:7663-7765`; the tab `:3991`,
 * `:4331-4335`, and the reader's own `:4400`, `:4569-4572`; P18.5-T4).
 *
 * Every category in the office's order, each under *"{Label} ({done}/{total})"* with the counts muted
 * (`:7749`), then its skill cards, numbered from 1 again, with the learner's five columns — **read-only**:
 * no link, no pointer, no hover (contradiction 13). A category with nothing offered is its heading at
 * *(0/0)* and nothing under it, which is what the prototype's renderer draws over an empty list. A module
 * done and since withdrawn stays under its skill with *Archived* after its pill, outside the counts
 * (D-history).
 *
 * **The same record the learner reads** (T4 AC-4, exit test 3): one read, `GET /training/progress` — the
 * coach's through `?for=`, the reader's own without it — and these counts are the server's, so the coach,
 * the learner and `/coaching/me/training` cannot disagree. The prototype's tab drew a 24-module constant
 * over two hand-made maps (F-12).
 */
export function PersonTraining({ view }: { view: TrainingProgressView }) {
  if (view.categories.length === 0) return <EmptyCard title={OWN_COPY.noTraining} />;
  return (
    <div className="flex flex-col">
      {view.categories.map((category) => (
        <section key={category.code} aria-labelledby={`training-${category.code}`} className="mt-[22px] first:mt-0">
          <h2 id={`training-${category.code}`} className="mb-3 font-display text-md font-bold text-navy">
            {category.label}{' '}
            <span className="text-sm font-medium text-muted">({category.done}/{category.total})</span>
          </h2>
          <SkillCards skills={category.skills} />
        </section>
      ))}
    </div>
  );
}

/** A coachee's tab, inside the person shell (T4 AC-1, AC-2): out of reach is the shell's not-found. */
export function CoacheeTraining() {
  const coachee = useCoachee();
  const gone = useCoacheeNotFound();
  const read = useTrainingRead(() => readCoacheeTraining(coachee.membershipId), coachee.membershipId, gone);
  return <ReadState read={read} label={OWN_COPY.loadingCatalog} />;
}

/** The reader's own, on `/coaching/me/training` (T4 AC-3): the read their own `/training` makes. */
export function MyTrainingRecord() {
  const read = useTrainingRead(readTrainingProgress, 'me');
  return <ReadState read={read} label={OWN_COPY.loadingCatalog} />;
}

function useTrainingRead(read: () => Promise<TrainingProgressView>, key: string, onNotFound?: () => void) {
  const [view, setView] = useState<TrainingProgressView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setView(null);
    setError(null);
    read()
      .then((next) => { if (live) setView(next); })
      .catch((err) => {
        if (!live) return;
        // The reach changed since the shell read the person: its not-found, not a refusal of the tab's own.
        if (onNotFound && err instanceof ApiRequestError && err.status === 404) onNotFound();
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
    // `read` and `onNotFound` are rebuilt every render; `key` is what is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  return { view, error, retry: () => setAttempt((n) => n + 1) };
}

function ReadState({ read, label }: { read: ReturnType<typeof useTrainingRead>; label: string }) {
  if (read.error) {
    return (
      <div>
        <ErrorBanner {...read.error} />
        <Button variant="secondary" className="mt-3" onClick={read.retry}>{OWN_COPY.tryAgain}</Button>
      </div>
    );
  }
  if (!read.view) {
    return (
      <Skeleton label={label}>
        <SkeletonBar className="h-5 w-32" />
        <div className="mt-3 rounded-lg border border-hairline bg-card p-6">
          <SkeletonBar className="h-5 w-40" />
          <SkeletonText lines={4} className="mt-4" />
        </div>
      </Skeleton>
    );
  }
  return <PersonTraining view={read.view} />;
}
