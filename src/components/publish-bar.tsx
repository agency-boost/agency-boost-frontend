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
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await readPublishState());
    } catch (err) {
      setError(toDisplayError(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

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
