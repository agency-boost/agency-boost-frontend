'use client';

import { useId, useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { ApiRequestError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  claimAttendance, pastBlockOf, pickScoreToast, PROTOTYPE_COPY, refusalOf, scaleHighLine, scaleLowLine, scaleOf, scoredLine,
  submitFeedback, type EventsMeta, type GuestEvent,
} from '@/lib/events';
import { useEventsHost } from './events-screen';

/**
 * **A past event's block** (`:8624-8632`; P18.5-T5 AC-6, P18.5-T6 AC-2 to AC-4): the feedback form for a reader
 * who RSVP'd or said they came, the thanks once they answered, and for anybody else the didn't-join block
 * with *I actually attended this event*.
 *
 * **The claim is the reader's word and nothing more** (OD-31, exit test 2): it opens the form, as drawn,
 * and the toast says what the prototype says — but only the Owner or an Admin makes anybody *attended*, and
 * nothing here tells the reader whether they did. **Feedback is single-submit** (`:8758-8763`).
 *
 * A refusal is said here, beside the button; a 409 means the event moved on under the open modal, and the
 * modal reads it again (`onStale`) — an answer already sent elsewhere comes back as the thanks.
 *
 * **A reader who may not answer is shown no form** (`can.feedback` false: a support session): the form is
 * nothing but controls, and a session that may not write draws none (roles §3.13). The thanks and the
 * didn't-join block are words, and they still show — the latter without its claim.
 */
export const drawsPastBlock = (event: GuestEvent, meta: EventsMeta) =>
  pastBlockOf(event) !== 'form' || meta.can.feedback;

export function PastEventBlock({ event, meta, onAnswer, onStale }: {
  event: GuestEvent;
  meta: EventsMeta;
  onAnswer: (next: GuestEvent, message: string) => void;
  onStale: () => void;
}) {
  const block = pastBlockOf(event);
  if (!drawsPastBlock(event, meta)) return null;
  if (block === 'thanks') return <Thanks event={event} meta={meta} />;
  if (block === 'didntJoin') return <DidntJoin event={event} meta={meta} onAnswer={onAnswer} onStale={onStale} />;
  return <FeedbackForm event={event} meta={meta} onAnswer={onAnswer} onStale={onStale} />;
}

/** Runs one write, keeping its refusal beside the control that made it. */
function useWrite(onStale: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const run = async (call: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await call();
    } catch (err) {
      setError(refusalOf(err));
      if (err instanceof ApiRequestError && err.status === 409) onStale();
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** `.nps-thanks` (`:2150-2156`): a tinted box with its icon, a title and a sub-line. */
function Notice({ icon, tone, title, children }: {
  icon: string;
  tone: 'success' | 'navy';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[10px] border px-[18px] py-4',
        tone === 'success' ? 'border-success/25 bg-success/[0.06]' : 'border-hairline bg-navy/[0.04]',
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-xl">{icon}</span>
      <div className="min-w-0">
        <p className={cn('mb-0.5 text-md font-bold', tone === 'success' ? 'text-success' : 'text-navy')}>{title}</p>
        {children}
      </div>
    </div>
  );
}

/** *Thanks for your feedback* (`:8690-8700`): the score kept, and the reader's *why* — as text. */
function Thanks({ event, meta }: { event: GuestEvent; meta: EventsMeta }) {
  const feedback = event.me.feedback!;
  return (
    <div data-block="thanks">
      <Notice icon="✅" tone="success" title={PROTOTYPE_COPY.thanksTitle}>
        <p className="break-words text-base text-muted">{scoredLine(feedback, meta.limits.nps)}</p>
      </Notice>
    </div>
  );
}

/**
 * *You didn't join this event* (`:8677-8688`), and the claim. A read-only support session reads the block
 * with no button (`can.claim` false).
 */
function DidntJoin({ event, meta, onAnswer, onStale }: {
  event: GuestEvent;
  meta: EventsMeta;
  onAnswer: (next: GuestEvent, message: string) => void;
  onStale: () => void;
}) {
  const { busy, error, run } = useWrite(onStale);
  return (
    <div data-block="didnt-join">
      <Notice icon="ℹ️" tone="navy" title={PROTOTYPE_COPY.didntJoinTitle}>
        <p className="text-base text-muted">{PROTOTYPE_COPY.didntJoinSub}</p>
        {meta.can.claim && (
          <Button
            variant="secondary"
            className="mt-2.5 h-8 px-3.5 text-base"
            aria-disabled={busy || undefined}
            onClick={() => void run(async () => {
              onAnswer(await claimAttendance(event.id), PROTOTYPE_COPY.claimed);
            })}
          >
            {PROTOTYPE_COPY.claim}
          </Button>
        )}
      </Notice>
      {error && <div className="mt-3"><ErrorBanner {...error} /></div>}
    </div>
  );
}

/**
 * **The form** (`:8654-8675`): the question and its hint; the scale as a radio group named by the question,
 * its two ends describing it, the chosen score navy (`:2139`; ADR-0137 §2, a selection); the two optional
 * answers, each tied to its label; *Submit feedback*. The scale's ends and the texts' bound are served
 * (`limits`), never written here (invariant §7).
 *
 * With no score, the prototype's toast (`:8755`). Drawn only for a reader who may answer (`drawsPastBlock`).
 */
function FeedbackForm({ event, meta, onAnswer, onStale }: {
  event: GuestEvent;
  meta: EventsMeta;
  onAnswer: (next: GuestEvent, message: string) => void;
  onStale: () => void;
}) {
  const { toast } = useEventsHost();
  const { busy, error, run } = useWrite(onStale);
  const [score, setScore] = useState<number | null>(null);
  const [why, setWhy] = useState('');
  const [improve, setImprove] = useState('');
  const ids = { question: useId(), ends: useId(), why: useId(), improve: useId() };
  const nps = meta.limits.nps;
  const max = meta.limits.feedbackTextMax;

  const submit = () => {
    if (score === null) {
      toast(pickScoreToast(nps));
      return;
    }
    void run(async () => {
      const next = await submitFeedback(event.id, {
        score,
        ...(why.trim() ? { why } : {}),
        ...(improve.trim() ? { improve } : {}),
      });
      onAnswer(next, PROTOTYPE_COPY.feedbackSubmitted);
    });
  };

  return (
    // `contents`: the block draws no box, so *Submit feedback* below is held against the whole modal body.
    <div data-block="form" className="contents">
      <h3 id={ids.question} className="mb-1 text-md font-bold text-navy">{PROTOTYPE_COPY.formQuestion}</h3>
      <p className="mb-3.5 text-base text-muted">{PROTOTYPE_COPY.formHint}</p>
      <div role="radiogroup" aria-labelledby={ids.question} aria-describedby={ids.ends} className="mb-1.5 flex flex-wrap gap-[5px]">
        {scaleOf(nps).map((n) => (
          <label key={n} className="relative">
            <input
              type="radio"
              name={`nps-${event.id}`}
              value={n}
              checked={score === n}
              onChange={() => setScore(n)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-[7px] border text-base font-bold',
                'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-amber',
                score === n ? 'border-navy bg-navy text-white' : 'border-hairline bg-base text-navy hover:border-amber',
              )}
            >
              {n}
            </span>
          </label>
        ))}
      </div>
      <p id={ids.ends} className="mb-[18px] flex justify-between gap-3 text-xs text-muted">
        <span>{scaleLowLine(nps)}</span>
        <span className="text-right">{scaleHighLine(nps)}</span>
      </p>
      <FeedbackField
        id={ids.why}
        label={PROTOTYPE_COPY.why}
        placeholder={PROTOTYPE_COPY.whyPlaceholder}
        value={why}
        max={max}
        onChange={setWhy}
      />
      <FeedbackField
        id={ids.improve}
        label={PROTOTYPE_COPY.improve}
        placeholder={PROTOTYPE_COPY.improvePlaceholder}
        value={improve}
        max={max}
        onChange={setImprove}
      />
      {/*
        * **Held at the foot of the modal** while the form scrolls above it (P18.96-T1 AC-1; UI-043): sticky inside the
        * modal's own scroll, across its padding, on the card's colour. Where it all fits it sits where it always did,
        * 14px under the last field, and on a phone it clears the home indicator. A refusal stays beside it.
        */}
      <div
        data-sticky-submit=""
        className={cn(
          'sticky bottom-0 z-10 -mx-5 -mb-[26px] -mt-3.5 bg-card px-5 pb-[max(26px,env(safe-area-inset-bottom))] pt-3.5',
          'sm:-mx-[26px] sm:px-[26px]',
        )}
      >
        {error && <div className="mb-3"><ErrorBanner {...error} /></div>}
        <Button aria-disabled={busy || undefined} onClick={submit}>{PROTOTYPE_COPY.submitFeedback}</Button>
      </div>
    </div>
  );
}

/** `.nps-field` (`:2141-2148`): the label tied to its box — the prototype's are not. */
function FeedbackField({ id, label, placeholder, value, max, onChange }: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3.5">
      <label htmlFor={id} className="mb-1.5 block text-base font-semibold text-navy">
        {label} <span className="font-normal italic text-muted">{PROTOTYPE_COPY.optional}</span>
      </label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-16 w-full resize-y rounded-md border border-hairline bg-card px-3 py-2.5 text-md text-navy"
      />
    </div>
  );
}
