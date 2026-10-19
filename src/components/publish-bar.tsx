'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/field';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { useCan } from '@/lib/session';
import { publishConfig, readPublishState, type PublishState } from '@/lib/tenant-config';

/**
 * What agents are working against, and whether it is what you are looking at (P4-T6).
 *
 * **The settings screens edit rows; agents read a published copy.** An Owner restructuring
 * a taxonomy does it in steps — archive three, add four, rebind two ratios — and between
 * those steps a ratio can name a type archived a minute ago that nobody can log against.
 * The gate is why agents do not watch that happen; this bar is how an Owner knows the gate
 * is there at all.
 *
 * **It says nothing when there is nothing to say.** A permanent "everything is published"
 * banner is chrome an Owner learns to stop reading, and then misses the one time it
 * matters.
 */
export function PublishBar({ refreshKey }: { refreshKey?: number }) {
  const canPublish = useCan('tenant_config:write');
  const [state, setState] = useState<PublishState | null>(null);
  /*
   * Two failures, two states. They are not the same thing: one means *I cannot tell you
   * what your agents are seeing*, the other means *your change did not go out* — and they
   * recover differently. Sharing one field is what let the first hide behind the early
   * return below.
   */
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await readPublishState());
      setLoadError(null);
    } catch (err) {
      setLoadError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  /*
   * The error is rendered **before** the early return.
   *
   * `!state?.hasUnpublishedChanges` is true both when there is nothing to publish and
   * when the read failed — `state` stays null on a failure — so the component returned
   * `null` and the error it had just set was never shown. An Owner whose publish state
   * could not be read saw a screen that looked entirely normal and had no way to learn
   * the gate existed.
   */
  if (loadError) {
    return (
      <div role="alert" className="mb-4 rounded-md border border-alert bg-card p-3">
        <p className="text-md text-navy">
          <strong>Could not check what your agents are seeing.</strong>{' '}
          <span className="text-muted">{loadError.message}</span>
        </p>
        <Button variant="secondary" className="mt-2" onClick={() => { setLoadError(null); void load(); }}>
          Try again
        </Button>
      </div>
    );
  }

  if (!state?.hasUnpublishedChanges) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber bg-amber/10 p-3"
    >
      <p className="text-md text-navy">
        <strong>Your agents are not seeing these changes yet.</strong>{' '}
        {state.publishedVersion === 0
          ? 'Nothing has been published for this office.'
          : `They are on version ${state.publishedVersion}.`}
      </p>
      {canPublish && (
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setState(await publishConfig());
            } catch (err) {
              setError(toDisplayError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Publishing…' : 'Publish to agents'}
        </Button>
      )}
      {error && <p className="text-md text-alert">{error.message}</p>}
    </div>
  );
}
