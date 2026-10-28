'use client';

import { useCallback, useEffect, useState } from 'react';
import { PitchBanner } from '@/components/recruitment/pitch-banner';
import { PitchCard, type PitchAudience } from '@/components/recruitment/pitch-card';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import {
  PITCH_OWN_COPY, readPitchMaterials, type PitchMaterialsView, type PitchSlot,
} from '@/lib/recruitment-pitch';

/**
 * The prototype's `.card-grid` (`Recruitment_Section.html:180`): two columns of at least 430px where
 * they fit, one where they do not. `min(100%, 430px)` is what keeps a 360px phone in one column with
 * nothing scrolling sideways — the prototype needs a media query for it (`:213`).
 */
const GRID = 'grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,430px),1fr))]';

/** Shaped like the banner and the six cards, so they arrive in place (L-01, a Fill). */
function PitchSkeleton() {
  return (
    <Skeleton label={PITCH_OWN_COPY.loading}>
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-hairline bg-card px-5 py-4">
        <div className="h-11 w-11 shrink-0 rounded-full bg-hairline" />
        <SkeletonText lines={2} className="flex-1" />
      </div>
      <div className={GRID}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-3.5 rounded-lg border border-hairline bg-card px-5 py-5 sm:px-6">
            <SkeletonBar className="h-4 w-1/2" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

/** A read that failed, and the way to ask again (L-01, a Fill). */
function ReadFailed({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div className="mb-4 flex flex-col items-start gap-3">
      <p className="m-0 text-md text-navy">{PITCH_OWN_COPY.readFailed}</p>
      <ErrorBanner {...error} />
      <Button variant="secondary" onClick={onRetry}>{PITCH_OWN_COPY.tryAgain}</Button>
    </div>
  );
}

/**
 * The banner and the six cards — the four the readiness counts, then the two optional ones, in the server's
 * order (ADR-0177) — read from `GET /recruitment/pitch-materials`, the one read both the
 * office's page (`/kpm/settings/recruitment-pitch`, P17-T5) and the agents' tab
 * (`/recruitment/pitch-materials`, P17-T6) are drawn from.
 *
 * **After every write the slots are read again**, so the banner is the server's count and never one
 * this screen worked out: which slot is done is the completion rule, stated once in the backend. The
 * card takes the write's own answer first, so its boxes and its file change at once.
 */
export function PitchMaterials({
  audience,
  canWrite = false,
}: {
  audience: PitchAudience;
  canWrite?: boolean;
}) {
  const [view, setView] = useState<PitchMaterialsView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    try {
      setView(await readPitchMaterials());
      setError(null);
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const retry = () => {
    setError(null);
    void load();
  };

  if (view === null) return error ? <ReadFailed error={error} onRetry={retry} /> : <PitchSkeleton />;

  const changed = (next: PitchSlot) => {
    setView((now) => (now
      ? { ...now, slots: now.slots.map((s) => (s.slot === next.slot ? next : s)) }
      : now));
    void load();
  };

  return (
    <div>
      {error && <ReadFailed error={error} onRetry={retry} />}
      <PitchBanner summary={view.summary} />
      <div className={GRID}>
        {view.slots.map((slot) => (
          <PitchCard
            key={slot.slot}
            slot={slot}
            audience={audience}
            canWrite={audience === 'office' && canWrite}
            onChanged={changed}
            onStale={() => void load()}
          />
        ))}
      </div>
    </div>
  );
}
