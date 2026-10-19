'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import {
  audienceLine, OWN_COPY, pillOf, PROTOTYPE_COPY, tagOf, whenLine, type EventPill, type EventTag, type GuestEvent,
} from '@/lib/events';

/** `.event-tag` (`:2074-2080`): white at 92% on the poster, the word in its state's colour. */
const TAG_TONE: Record<EventTag, string> = {
  going: 'text-success',
  notJoined: 'text-alert',
  past: 'text-muted',
};

/** The poster's tag, on the card (corner) and in the modal (inline, `:8640`). */
export function EventTagLabel({ event, inline = false }: { event: GuestEvent; inline?: boolean }) {
  const tag = tagOf(event);
  return (
    <span
      data-tag={tag}
      className={cn(
        'rounded-pill px-[9px] py-[3px] text-2xs font-bold uppercase tracking-wide',
        inline ? 'inline-block bg-navy/[0.06] text-navy' : cn('absolute right-2.5 top-2.5 bg-card/[0.92]', TAG_TONE[tag]),
      )}
    >
      {PROTOTYPE_COPY.tags[tag]}
    </span>
  );
}

/**
 * The poster: the event type's emoji on its colour (`:8527-8528`). The colour is the office's own data —
 * the type's swatch, as the Company template draws it — so it is a style, not a class; with none, navy.
 */
export function EventPosterFrame({ event, className, past, children }: {
  event: GuestEvent;
  className: string;
  past: boolean;
  children?: ReactNode;
}) {
  const style: CSSProperties | undefined = event.type.color ? { backgroundColor: event.type.color } : undefined;
  return (
    <div
      style={style}
      className={cn(
        'relative flex items-center justify-center text-white',
        !event.type.color && 'bg-navy',
        // `.is-past-poster::before` (`:2071-2073`): a navy veil over a past event's poster.
        past && "before:absolute before:inset-0 before:bg-navy/[0.28] before:content-['']",
        className,
      )}
    >
      <span aria-hidden="true" className="relative">{event.type.emoji ?? '📅'}</span>
      {children}
    </div>
  );
}

/** `.status-pill` (`:2090-2097`): the foot's state, with a dot on the two upcoming ones (`:8514-8524`). */
const PILL_TONE: Record<EventPill, { tone: string; dot: string | null }> = {
  going: { tone: 'bg-success/10 text-success', dot: 'bg-success' },
  notJoined: { tone: 'bg-alert/10 text-alert', dot: 'bg-alert' },
  didntJoin: { tone: 'bg-navy/[0.06] text-muted', dot: null },
  feedbackSent: { tone: 'bg-success/10 text-success', dot: null },
  feedbackPending: { tone: 'bg-navy/[0.06] text-muted', dot: null },
};

export function EventStatePill({ pill, label }: { pill: EventPill; label?: string }) {
  const { tone, dot } = PILL_TONE[pill];
  return (
    <span data-pill={pill} className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-sm font-semibold', tone)}>
      {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label ?? PROTOTYPE_COPY.pills[pill]}
    </span>
  );
}

/** *"{location} ↗"*, a link out when the event has an address (`:8493-8498`), plain words when it has none. */
export function EventLocation({ event }: { event: GuestEvent }) {
  if (!event.locationUrl) return <>{event.location}</>;
  return (
    <a
      href={event.locationUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="rounded-sm font-semibold text-navy-soft underline underline-offset-2 hover:text-amber-ink"
    >
      {event.location} <span aria-hidden="true">↗</span>
      <span className="sr-only"> ({OWN_COPY.opensInNewTab})</span>
    </a>
  );
}

/**
 * One event's card (`:8500-8541`, CSS `:2061-2088`): the poster with its tag, the audience line, the title,
 * *"{date} · {time}"* and the place, the blurb, and the foot — the pill and *View event*.
 *
 * **The card is not a button** (contradiction 26, an Improve for accessibility): it holds a link, and a
 * link inside a button is invalid. A click anywhere on it opens the event as drawn (`:8582-8586`), and
 * *View event* is the keyboard's way in. A past card is grey (`:2063-2065`): 45% greyscale over a veiled
 * poster, its words still in their tokens.
 *
 * Every word an office wrote — the title, the blurb, the place — is rendered as text (contradiction 25).
 */
export function EventCard({ event, companyName, onOpen }: {
  event: GuestEvent;
  companyName: string;
  onOpen: (id: string) => void;
}) {
  const past = event.ended;
  return (
    <div
      data-event={event.id}
      onClick={() => onOpen(event.id)}
      className={cn(
        'h-full cursor-pointer overflow-hidden rounded-lg border border-hairline bg-card transition-shadow hover:shadow-modal',
        past && 'grayscale-[45%] hover:grayscale-[20%]',
      )}
    >
      <EventPosterFrame event={event} past={past} className="h-[110px] text-[36px]">
        <EventTagLabel event={event} />
      </EventPosterFrame>
      <div className={cn('px-4 pb-4 pt-3.5', past && 'bg-navy/[0.02]')}>
        <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{audienceLine(event.audience, companyName)}</p>
        <h3 className="mb-1 break-words text-md font-bold leading-snug text-navy">{event.title}</h3>
        <p className="mb-2 text-sm text-muted">
          {whenLine(event)}
          <br />
          <EventLocation event={event} />
        </p>
        {event.blurb && <p className="mb-3 break-words text-base leading-snug text-muted">{event.blurb}</p>}
        <div className="flex items-center justify-between gap-2">
          <EventStatePill pill={pillOf(event)} />
          <Button
            variant="secondary"
            data-open-event={event.id}
            className="h-8 px-3.5 text-base"
            onClick={(e) => { e.stopPropagation(); onOpen(event.id); }}
          >
            {PROTOTYPE_COPY.viewEvent}
          </Button>
        </div>
      </div>
    </div>
  );
}
