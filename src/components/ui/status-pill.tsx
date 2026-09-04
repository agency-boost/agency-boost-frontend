import { cn } from '@/lib/cn';

/**
 * Three states, not two.
 *
 * `neutral` means "not enough data" and is never styled as failure. An agent with
 * nothing logged has not missed a benchmark, and colouring that red sends their leader
 * into the wrong conversation. The prototype gets this right (Overall.html:5275) and
 * we keep it.
 *
 * The label is always rendered — colour is never the only cue.
 */
export type Status = 'success' | 'alert' | 'neutral';

export const STATUS_LABEL: Record<Status, string> = {
  success: 'On track',
  alert: 'Below benchmark',
  neutral: 'Not enough data',
};

const STATUS_CLASS: Record<Status, string> = {
  success: 'bg-success/10 text-success',
  alert: 'bg-alert/10 text-alert',
  neutral: 'bg-muted/10 text-muted',
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: Status;
  /** Override only when a surface needs different wording for the same state. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        STATUS_CLASS[status],
        className,
      )}
    >
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}

/**
 * Map a measured value to a status. A null value — a ratio whose denominator was zero —
 * is `neutral`, never `alert`.
 */
export function statusFor(value: number | null | undefined, benchmark: number): Status {
  if (value === null || value === undefined || Number.isNaN(value)) return 'neutral';
  return value >= benchmark ? 'success' : 'alert';
}
