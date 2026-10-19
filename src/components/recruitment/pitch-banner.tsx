import { cn } from '@/lib/cn';
import { PITCH_COPY, PITCH_OWN_COPY, type PitchSummary } from '@/lib/recruitment-pitch';

/**
 * The completion banner (`Recruitment_Section.html:364-370`, `:797-820`), drawn the same on the
 * office's page and the agents' tab, as the prototype draws it in both views.
 *
 * **The counts are the server's** (`summary`): which slot is done is the one completion rule, stated
 * once in the backend, and this only words it. The sentences are the prototype's, verbatim.
 *
 * The ring is a picture of a fraction, so it carries a name — *"2 of 4 documents complete"* — and its
 * figure is hidden from assistive technology rather than read out as *"two slash four"*.
 */
export function PitchBanner({ summary }: { summary: PitchSummary }) {
  const complete = summary.done === summary.total;
  const parts = [
    ...(summary.missing > 0 ? [PITCH_COPY.notUploaded(summary.missing)] : []),
    ...(summary.unconfirmed > 0 ? [PITCH_COPY.notConfirmed(summary.unconfirmed)] : []),
  ];

  return (
    <div
      data-state={complete ? 'complete' : 'incomplete'}
      className={cn(
        'mb-6 flex items-center gap-4 rounded-lg border px-5 py-4',
        complete ? 'border-success/30 bg-success/5' : 'border-alert/25 bg-alert/5',
      )}
    >
      <div
        role="img"
        aria-label={PITCH_OWN_COPY.ringName(summary.done, summary.total)}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold',
          complete ? 'bg-success/[0.12] text-success' : 'bg-alert/10 text-alert',
        )}
      >
        <span aria-hidden="true">{PITCH_COPY.ring(summary.done, summary.total)}</span>
      </div>
      <div className="min-w-0">
        <p className="m-0 mb-0.5 text-md font-bold text-navy">
          {complete ? PITCH_COPY.completeTitle : PITCH_COPY.incompleteTitle}
        </p>
        <p className="m-0 text-base text-muted">
          {complete
            ? PITCH_COPY.completeLine(summary.total)
            : `${parts.join(', ')}${PITCH_COPY.notReady}`}
        </p>
      </div>
    </div>
  );
}
