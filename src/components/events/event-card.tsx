'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { TAP_HEIGHT } from '@/components/ui/phone';
import { useFigureLanguage, useLanguage, useMessages } from '@/i18n/language-provider';
import { eventsMessages } from '@/i18n/messages/events';
import type { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  audienceLine, joinName, pillOf, tagOf, whenLine, type EventPill, type GuestEvent,
} from '@/lib/events';

/**
 * The poster's tag, in the modal (inline, `:8640`). **Not on the card** since P18.95-T10 AC-1: there it said the
 * pill's state a second time (*Not Joined* over *Not joined*; UI-024), and the pill is the card's one status.
 */
export function EventTagLabel({ event }: { event: GuestEvent }) {
  const t = useMessages(eventsMessages);
  const tag = tagOf(event);
  return (
    <span
      data-tag={tag}
      className="inline-block rounded-pill bg-navy/[0.06] px-[9px] py-[3px] text-2xs font-bold uppercase tracking-wide text-navy"
    >
      {t.tags[tag]}
    </span>
  );
}

/**
 * The poster: the event type's emoji on its colour (`:8527-8528`). The colour is the office's own data —
 * the type's swatch, as the Company template draws it — so it is a style, not a class; with none, navy.
 * The modal's is the prototype's poster; the card's is the same frame at icon size (P18.95-T10 AC-1).
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
  const t = useMessages(eventsMessages);
  const { tone, dot } = PILL_TONE[pill];
  return (
    <span data-pill={pill} className={cn('inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-sm font-semibold', tone)}>
      {dot && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dot)} />}
      {label ?? t.pills[pill]}
    </span>
  );
}

/** *"{location} ↗"*, a link out when the event has an address (`:8493-8498`), plain words when it has none. */
export function EventLocation({ event }: { event: GuestEvent }) {
  const t = useMessages(eventsMessages);
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
      <span className="sr-only"> ({t.opensInNewTab})</span>
    </a>
  );
}

/**
 * One event's card (`:8500-8541`, CSS `:2061-2088`): the type's icon beside the audience line and the title,
 * *"{date} · {time}"* and the place, the blurb, and the foot — the pill, *Join* while the reader may join,
 * and *View event*.
 *
 * **One status, a small icon and *Join* on the card** (P18.95-T10 AC-1; the client's UI-024, ADR-0167): the
 * prototype's 110px poster carried a corner tag — *Not Joined* over the pill's *Not joined*, *Going* over
 * *Going* — so the card said its state twice. The poster is now the type's emoji at icon size, 32px on the
 * type's colour, and the pill is the one status, in words with its dot (never colour alone). The modal keeps
 * the poster at full size and its tag.
 *
 * ***Join*** is the modal's *Join event* — the same call, the same rules (`canJoin`), its toast and its refusal,
 * which the list says under the foot. Nothing is drawn for an event the reader has joined (*Going*), has
 * ended, or a read-only support session (`can.rsvp` false).
 *
 * **The card is not a button** (contradiction 26, an Improve for accessibility): it holds a link, and a
 * link inside a button is invalid. A click anywhere on it opens the event as drawn (`:8582-8586`), and
 * *View event* is the keyboard's way in. A past card is grey (`:2063-2065`): 45% greyscale over a veiled
 * icon, its words still in their tokens.
 *
 * Every word an office wrote — the title, the blurb, the place — is rendered as text (contradiction 25).
 */
export function EventCard({ event, companyName, canJoin, busy, error, onOpen, onJoin }: {
  event: GuestEvent;
  companyName: string;
  /** The server's `can.rsvp`, and the event still open and not joined. */
  canJoin: boolean;
  busy: boolean;
  /** A refused *Join*, said under the foot. */
  error: ApiError | null;
  onOpen: (id: string) => void;
  onJoin: (id: string) => void;
}) {
  const t = useMessages(eventsMessages);
  const language = useLanguage();
  const figures = useFigureLanguage();
  const past = event.ended;
  return (
    <div
      data-event={event.id}
      onClick={() => onOpen(event.id)}
      className={cn(
        'h-full cursor-pointer overflow-hidden rounded-lg border border-card-edge bg-card transition-shadow hover:shadow-modal',
        past && 'grayscale-[45%] hover:grayscale-[20%]',
      )}
    >
      <div className={cn('h-full px-4 pb-4 pt-3.5', past && 'bg-navy/[0.02]')}>
        <div className="mb-1 flex items-start gap-2.5">
          <EventPosterFrame event={event} past={past} className="h-8 w-8 shrink-0 overflow-hidden rounded-md text-xl" />
          <div className="min-w-0">
            <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">{audienceLine(event.audience, companyName, language)}</p>
            <h3 className="break-words text-md font-bold leading-snug text-navy">{event.title}</h3>
          </div>
        </div>
        <p className="mb-2 text-sm text-muted">
          {whenLine(event, figures)}
          <br />
          <EventLocation event={event} />
        </p>
        {event.blurb && <p className="mb-3 break-words text-base leading-snug text-muted">{event.blurb}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <EventStatePill pill={pillOf(event)} />
          <span className="flex items-center gap-2">
            {canJoin && (
              <Button
                data-join-event={event.id}
                // *Join Kickoff 2026* to a screen reader, so a list of them is told apart; the visible word leads it.
                aria-label={joinName(event.title, language)}
                aria-disabled={busy || undefined}
                // 44px tall on a phone (P18.95-T1 AC-10), 32px from 768px as the foot's other controls.
                className={cn('h-8 px-3.5 text-base', TAP_HEIGHT)}
                onClick={(e) => { e.stopPropagation(); onJoin(event.id); }}
              >
                {t.join}
              </Button>
            )}
            <Button
              variant="secondary"
              data-open-event={event.id}
              className="h-8 px-3.5 text-base"
              onClick={(e) => { e.stopPropagation(); onOpen(event.id); }}
            >
              {t.viewEvent}
            </Button>
          </span>
        </div>
        {error && (
          // A click on the refusal is not a click on the card: it is read where it is, not opened.
          <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
            <ErrorBanner {...error} />
          </div>
        )}
      </div>
    </div>
  );
}
