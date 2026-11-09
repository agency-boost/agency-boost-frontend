'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMessages } from '@/i18n/language-provider';
import { eventsMessages } from '@/i18n/messages/events';
import { cn } from '@/lib/cn';
import {
  tagOf, type EventPill, type GuestEvent,
} from '@/lib/events';

/**
 * The poster's tag, in the modal (inline, `:8640`). **Not on the card** since P18.7-T10 AC-1: there it said the
 * pill's state a second time (*Not Joined* over *Not joined*; UI-024), and the pill is the card's one status.
 */
export function EventTagLabel({ event }: { event: GuestEvent }) {
  const t = useMessages(eventsMessages);
  const tag = tagOf(event);
  return (
    <span
      data-tag={tag}
      className="inline-block rounded-pill bg-secondary/[0.06] px-[9px] py-[3px] text-2xs font-bold uppercase tracking-wide text-navy"
    >
      {t.tags[tag]}
    </span>
  );
}

/**
 * The poster: the event type's emoji on its colour (`:8527-8528`). The colour is the office's own data —
 * the type's swatch, as the Company template draws it — so it is a style, not a class; with none, navy.
 * The modal's is the prototype's poster; the card's is the same frame at icon size (P18.7-T10 AC-1).
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
        'relative flex items-center justify-center',
        event.type.color ? 'text-white' : 'text-secondary-contrast',
        !event.type.color && 'bg-secondary',
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
  didntJoin: { tone: 'bg-secondary/[0.06] text-muted', dot: null },
  feedbackSent: { tone: 'bg-success/10 text-success', dot: null },
  feedbackPending: { tone: 'bg-secondary/[0.06] text-muted', dot: null },
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
      className="rounded-sm font-semibold text-navy-soft underline underline-offset-2 hover:text-primary-ink"
    >
      {event.location} <span aria-hidden="true">↗</span>
      <span className="sr-only"> ({t.opensInNewTab})</span>
    </a>
  );
}
