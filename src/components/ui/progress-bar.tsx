import { cn } from '@/lib/cn';
import { formatPercent, percentOf } from '@/lib/format';
import type { Status } from './status-pill';

/**
 * Width is capped at 100%, but the *label* may exceed it — the prototype shows
 * attainment up to 999% (Overall.html:6303).
 *
 * A zero target renders the not-enough-data state rather than NaN%, which is what the
 * prototype does today (prototype-parity F-25). The percentage is half up in integers
 * (`percentOf`; P18.97-T3, parity F-254): 23 of 40 is 58%, where `Math.round` read 57.
 */
export function ProgressBar({
  value,
  target,
  status = 'success',
  showLabel = true,
  className,
}: {
  value: number;
  target: number;
  status?: Status;
  showLabel?: boolean;
  className?: string;
}) {
  const hasTarget = target > 0;
  const pct = hasTarget ? percentOf(value, target) : null;
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));

  const fill: Record<Status, string> = {
    success: 'bg-success',
    alert: 'bg-alert',
    neutral: 'bg-muted',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-hairline"
        role="progressbar"
        aria-valuenow={pct ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={hasTarget ? `${value} of ${target}` : 'No target set'}
      >
        <div className={cn('h-full rounded-pill transition-all', fill[status])} style={{ width: `${width}%` }} />
      </div>
      {showLabel && (
        <p className="mt-1 text-xs text-muted">
          {pct === null ? 'No target set' : formatPercent(pct)}
        </p>
      )}
    </div>
  );
}
