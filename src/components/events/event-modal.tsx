'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { TAP_AREA } from '@/components/ui/phone';
import { Skeleton, SkeletonBar, SkeletonText } from '@/components/ui/skeleton';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  audienceLine, cancelledToast, cancelRsvp, dayOf, goingToast, isGoing, OWN_COPY, pastBlockOf, PROTOTYPE_COPY,
  readEvent, refusalOf, rsvpEvent, timeOf, type EventsMeta, type GuestEvent,
} from '@/lib/events';
import { EventLocation, EventPosterFrame, EventStatePill, EventTagLabel } from './event-card';
import { drawsPastBlock, PastEventBlock } from './event-feedback';
import { useEventsHost } from './events-screen';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * **One event, over the list** (`/events/[eventId]`; `:8594-8652`, overlay `:4707-4709`; P18.5-T5 AC-5): the
 * poster, the tag and the audience, the title, *📅 {date} · {time}* and *📍 {place}*, the description, and
 * then what the reader can do — *Join event*, or *You're going* and *Cancel RSVP*, while the event has not
 * wrapped up; and once it has, the feedback form, the didn't-join block or the thanks (T6).
 *
 * **A dialog, where the prototype's is a `div`** (contradiction 26): named by the event, the focus moved
 * into it and held there, returned to the card's *View event* when it closes; ✕ is a button named *Close*,
 * and Escape, the scrim and Back close it too. It has an address of its own, so a link opens it.
 *
 * **What the reader may do is the server's to say** (`can`): a write answers the event as it now is, and the
 * modal and the card behind it both draw that answer. A refusal — the event ended while the modal was open
 * — is said beside the button, and the event read again. **A read-only support session draws no write
 * control** (roles §3.13): `can` is all false, so the state reads as it is with nothing to change it.
 *
 * Its own states are Fills (L-01): a skeleton, an error with a retry, and the not-found state for an event
 * the reader is not invited to, an archived one, or none at all — one answer for all three, as the server
 * gives one (404).
 */
export function EventModal({ id }: { id: string }) {
  const { meta, metaError, reload, close, toast, replace } = useEventsHost();
  const [event, setEvent] = useState<GuestEvent | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [writeError, setWriteError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    let live = true;
    setMissing(false);
    setError(null);
    readEvent(id)
      .then((next) => {
        if (!live) return;
        setEvent(next);
        // The card behind takes the same answer: after a refusal it would otherwise keep the old state.
        replace(next);
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiRequestError && err.status === 404) setMissing(true);
        else setError(toDisplayError(err));
      });
    return () => { live = false; };
  }, [id, attempt, replace]);

  // Into the dialog as it opens, and back to the event's *View event* as it closes — or wherever the focus was.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    box.current?.focus();
    return () => {
      const card = document.querySelector<HTMLElement>(`[data-open-event="${id.replace(/["\\]/g, '\\$&')}"]`);
      (card ?? before)?.focus?.();
    };
  }, [id]);

  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !box.current) return;
    const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };

  /** The event as a write answered it: drawn here and on the card behind, and said in the toast. */
  const answered = (next: GuestEvent, message: string) => {
    setEvent(next);
    replace(next);
    toast(message);
  };

  /** A refusal said beside the control; a 409 means the event moved on, so it is read again. */
  const refused = (err: unknown) => {
    setWriteError(refusalOf(err));
    if (err instanceof ApiRequestError && err.status === 409) setAttempt((n) => n + 1);
  };

  const rsvp = async (call: (id: string) => Promise<GuestEvent>, said: (title: string) => string) => {
    if (busy || !event) return;
    setBusy(true);
    setWriteError(null);
    try {
      const next = await call(event.id);
      answered(next, said(next.title));
    } catch (err) {
      refused(err);
    } finally {
      setBusy(false);
    }
  };

  const failed = error ?? (event ? metaError : null);
  const ready = event && meta;

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-40 bg-navy/35" onClick={close} data-scrim />
      <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto sm:items-center sm:p-5">
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ready ? titleId : undefined}
          aria-label={ready ? undefined : PROTOTYPE_COPY.title}
          tabIndex={-1}
          onKeyDown={keys}
          className="pointer-events-auto relative min-h-full w-full overflow-hidden bg-card shadow-modal sm:min-h-0 sm:max-w-[560px] sm:rounded-lg"
        >
          <CloseButton onClose={close} onPoster={!!ready} />

          {!ready && !missing && !failed && (
            <Skeleton label={OWN_COPY.loadingEvent}>
              <div className="h-[190px] bg-hairline" />
              <div className="px-5 pb-6 pt-5 sm:px-[26px]">
                <SkeletonBar className="w-20" />
                <SkeletonBar className="mt-3 h-5 w-2/3" />
                <SkeletonText lines={3} className="mt-4" />
              </div>
            </Skeleton>
          )}
          {failed && !missing && !ready && (
            <div className="px-5 pb-6 pt-14 sm:px-[26px]">
              <ErrorBanner {...failed} />
              <Button
                variant="secondary"
                className="mt-3"
                onClick={() => { if (error) setAttempt((n) => n + 1); else reload(); }}
              >
                {OWN_COPY.tryAgain}
              </Button>
            </div>
          )}
          {missing && (
            <div data-state="not-found" className="px-5 pb-6 pt-14 sm:px-[26px]">
              <p className="m-0 text-md font-semibold text-navy">{OWN_COPY.notFound}</p>
              <p className="m-0 mt-1 text-base text-muted">{OWN_COPY.notFoundHint}</p>
              <button type="button" onClick={close} className="mt-3 rounded-sm text-base font-semibold text-amber-ink hover:underline">
                {OWN_COPY.backToEvents}
              </button>
            </div>
          )}

          {ready && (
            <EventDetail
              event={event}
              meta={meta}
              titleId={titleId}
              busy={busy}
              writeError={writeError}
              onJoin={() => void rsvp(rsvpEvent, goingToast)}
              onCancel={() => void rsvp(cancelRsvp, cancelledToast)}
              onAnswer={answered}
              onStale={() => setAttempt((n) => n + 1)}
            />
          )}
        </div>
      </div>
    </>
  );
}

function EventDetail({ event, meta, titleId, busy, writeError, onJoin, onCancel, onAnswer, onStale }: {
  event: GuestEvent;
  meta: EventsMeta;
  titleId: string;
  busy: boolean;
  writeError: ApiError | null;
  onJoin: () => void;
  onCancel: () => void;
  onAnswer: (next: GuestEvent, message: string) => void;
  onStale: () => void;
}) {
  return (
    <>
      <EventPosterFrame event={event} past={false} className="h-[190px] text-[58px]" />
      <div className="px-5 pb-[26px] pt-[22px] sm:px-[26px]">
        <div className="mb-2"><EventTagLabel event={event} inline /></div>
        <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{audienceLine(event.audience, meta.companyName)}</p>
        <h2 id={titleId} className="mb-1.5 break-words text-2xl font-extrabold text-navy">{event.title}</h2>
        <div className="mb-3.5 flex flex-col gap-[3px] text-md text-muted">
          {/* One date and time, written as every screen writes one: *24 Okt 2026, 18.00* (ADR-0167 §1). */}
          <span><span aria-hidden="true">📅 </span><strong className="text-navy">{dayOf(event)}</strong>, {timeOf(event)}</span>
          <span><span aria-hidden="true">📍 </span><EventLocation event={event} /></span>
        </div>
        {event.description && (
          <p className="mb-5 whitespace-pre-line break-words text-md leading-relaxed text-navy">{event.description}</p>
        )}

        {!event.ended && (
          <div className="mb-5 flex flex-wrap items-center gap-2.5" data-block="rsvp">
            {isGoing(event) ? (
              <>
                <EventStatePill pill="going" label={PROTOTYPE_COPY.youreGoing} />
                {meta.can.cancelRsvp && (
                  <Button variant="secondary" className="h-8 px-3.5 text-base" aria-disabled={busy || undefined} onClick={onCancel}>
                    {PROTOTYPE_COPY.cancelRsvp}
                  </Button>
                )}
              </>
            ) : (
              meta.can.rsvp && (
                <Button aria-disabled={busy || undefined} onClick={onJoin}>{PROTOTYPE_COPY.joinEvent}</Button>
              )
            )}
          </div>
        )}
        {writeError && <div className="mb-4"><ErrorBanner {...writeError} /></div>}

        {event.ended && drawsPastBlock(event, meta) && (
          <>
            <hr className="my-5 border-0 border-t border-hairline" />
            <PastEventBlock
              key={`${event.id}-${pastBlockOf(event)}`}
              event={event}
              meta={meta}
              onAnswer={onAnswer}
              onStale={onStale}
            />
          </>
        )}
      </div>
    </>
  );
}

/** The poster's ✕ (`.event-modal-close`, `:2113-2117`), named *Close* — the prototype's has no name. */
function CloseButton({ onClose, onPoster }: { onClose: () => void; onPoster: boolean }) {
  return (
    <button
      type="button"
      aria-label={OWN_COPY.closeModal}
      onClick={onClose}
      className={cn(
        onPoster
          ? 'absolute right-3 top-3 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-navy/[0.28] text-lg text-white hover:bg-navy/[0.42]'
          : 'absolute right-3 top-3 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-hairline bg-base text-lg text-navy',
        // A 44px square on a phone, the 30px circle as drawn (ADR-0167; UI-029).
        TAP_AREA,
      )}
    >
      <span aria-hidden="true">{PROTOTYPE_COPY.close}</span>
    </button>
  );
}
