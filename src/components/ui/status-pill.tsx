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

/**
 * A fourth tone for a verdict between the two: the coaching roster's *Watch closely*, which the
 * prototype draws in amber-yellow (`Overall.html:1445`). It is a pill's paint, not a state: a measured
 * value maps to the three above (`statusFor`), and nothing maps to this one but a verdict the server
 * named, so it carries no default label and the caller always says it.
 *
 * **Navy words on the amber tint.** No amber in the palette clears 4.5:1 as small text on an amber
 * tint (parity I-116; `a11y.spec.tsx` pins it), and the roster sets this pill on a leader's row, which
 * has a tint of its own. The tint carries the colour; the words carry the meaning.
 */
export type PillTone = Status | 'watch';

export const STATUS_LABEL: Record<Status, string> = {
  success: 'On track',
  alert: 'Below benchmark',
  neutral: 'Not enough data',
};

const STATUS_CLASS: Record<PillTone, string> = {
  success: 'bg-success/10 text-success',
  alert: 'bg-alert/10 text-alert',
  neutral: 'bg-muted/10 text-muted',
  watch: 'bg-amber/15 text-navy',
};

export function StatusPill({
  status,
  label,
  className,
}: (
  | {
    status: Status;
    /** Override only when a surface needs different wording for the same state. */
    label?: string;
  }
  // `watch` has no words of its own, so it cannot be drawn without them.
  | { status: 'watch'; label: string }
) & { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-2xs font-bold uppercase tracking-wide',
        STATUS_CLASS[status],
        className,
      )}
    >
      {status === 'watch' ? label : (label ?? STATUS_LABEL[status])}
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
