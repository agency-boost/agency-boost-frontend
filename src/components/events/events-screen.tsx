'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { useLanguage, useMessages } from '@/i18n/language-provider';
import { eventsMessages } from '@/i18n/messages/events';
import { ApiRequestError, toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  cancelRsvp, canJoin, EVENT_FILTERS, goingToast, phoneGroups, readEvents, refusalOf, rsvpCall, rsvpEvent, sections,
  withdrawRsvp, type EventFilter, type EventsMeta, type GuestEvent, type GuestEventCan,
} from '@/lib/events';
import { OFFICE_TIME_ZONE } from '@/lib/format';
import { usePhone } from '@/lib/use-phone';
import { EventCard } from './event-card';
import { PhoneEventCard } from './event-phone';

/** What the modal beneath the list needs from it: how to close, how to say something, how to update a card. */
interface EventsHost {
  /** The list's company name, limits and `can`, once it has answered; the modal waits for them. */
  meta: EventsMeta | null;
  /** The list's read failed: the modal says so too, and its retry reads the list again. */
  metaError: ApiError | null;
  reload: () => void;
  close: () => void;
  toast: (message: string) => void;
  /** The modal's answer to a write, so the card behind it moves section without a second read. */
  replace: (event: GuestEvent) => void;
}

const Host = createContext<EventsHost | null>(null);

/** The modal's way back to the list. Outside the list (a spec, say), it goes to the list's address. */
export function useEventsHost(): EventsHost {
  const host = useContext(Host);
  const router = useRouter();
  return host ?? {
    meta: null, metaError: null, reload: () => undefined,
    close: () => router.push('/events'), toast: () => undefined, replace: () => undefined,
  };
}

/**
 * **KPM Events** (`/events`; `Overall.html:3423-3448`, logic `:8425-8771`; P18.5-T5 AC-4): the events the
 * reader is invited to, as the server resolves the audience at each event's start (ADR-0039) — *Going*,
 * *Upcoming* and *Past*, under the filter *All* · *Upcoming* · *Past*.
 *
 * **It lives in the route's layout**, so it stays mounted while an event's modal opens and closes at
 * `/events/[eventId]` (AC-5): Back closes the modal and the list is where it was, its filter with it.
 * A write in the modal answers the event as it now is, and the card moves section from that answer.
 *
 * **The filter says which is on** (`aria-pressed`; ADR-0137 §2, a selection is navy). A running event
 * sits with the upcoming ones (F-42). The cards are one column on a phone (`:2159-2160`).
 *
 * **A card's *Join*** (P18.95-T10 AC-1) is the modal's *Join event* from the list: the same call, its answer
 * moving the card to *Going*, the same toast, and a refusal said under that card in the same words — a 409
 * meaning the event moved on, so the list is read again and the card says so. The focus follows the card to
 * its new section, onto its *View event*, since the *Join* it was on is gone.
 *
 * Its own states are Fills (L-01): a skeleton shaped like the cards, an error with a retry, and the
 * prototype's three empty rows for a section with nothing in it.
 *
 * **UI V1 on a phone** (UI-108; `campaign-event-mobile` 2; Mobile only): *Semua | Akan datang | Sudah lewat* as one
 * full-width segmented control; two groups, *Akan datang* and *Sudah lewat*, each with its count and hidden when empty
 * (D-08); compact cards (`PhoneEventCard`) with **Ikut and Tidak ikut both on an upcoming card** — tap the other to change,
 * the chosen one again to undo (`rsvpCall`: `POST …/rsvp`, `…/rsvp/cancel`, `…/rsvp/withdraw`), each answer the event
 * as it now is, a toast saying what changed. From 768px the list is as before.
 */
export function EventsScreen({ children }: { children?: ReactNode }) {
  const t = useMessages(eventsMessages);
  const language = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const { toast, show } = useToast();
  const [events, setEvents] = useState<GuestEvent[] | null>(null);
  const [meta, setMeta] = useState<EventsMeta | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [timezone, setTimezone] = useState(OFFICE_TIME_ZONE);
  const phone = usePhone();
  /** Whether this list pushed the modal's address — so closing it can go back rather than forward. */
  const openedHere = useRef(false);
  /** The card whose *Join* is in flight, its refusal, and the card the focus follows once it has moved. */
  const [joining, setJoining] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<{ id: string; error: ApiError } | null>(null);
  const [refocus, setRefocus] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    readEvents()
      .then((answer) => {
        if (!live) return;
        setEvents(answer.events);
        setMeta({ companyName: answer.companyName, limits: answer.limits, can: answer.can });
        if (answer.timezone) setTimezone(answer.timezone);
      })
      .catch((err) => { if (live) setError(toDisplayError(err)); });
    return () => { live = false; };
  }, [attempt]);

  const open = useCallback((id: string) => {
    openedHere.current = true;
    router.push(`/events/${encodeURIComponent(id)}`, { scroll: false });
  }, [router]);

  const close = useCallback(() => {
    if (openedHere.current) {
      openedHere.current = false;
      router.back();
    } else {
      router.replace('/events', { scroll: false });
    }
  }, [router]);

  const replace = useCallback((next: GuestEvent) => {
    setEvents((list) => (list ? list.map((e) => (e.id === next.id ? next : e)) : list));
  }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const join = async (id: string) => {
    if (joining) return;
    setJoining(id);
    setJoinError(null);
    try {
      const next = await rsvpEvent(id);
      replace(next);
      show(goingToast(next.title, language));
      setRefocus(id);
    } catch (err) {
      setJoinError({ id, error: refusalOf(err, language) });
      if (err instanceof ApiRequestError && err.status === 409) reload();
    } finally {
      setJoining(null);
    }
  };

  /** A phone's *Ikut* or *Tidak ikut* (UI-108): give the answer, change it, or take it back. */
  const answer = async (event: GuestEvent, tapped: 'going' | 'notGoing') => {
    if (joining) return;
    setJoining(event.id);
    setJoinError(null);
    const call = rsvpCall(event, tapped);
    try {
      const next = await (call === 'rsvp' ? rsvpEvent : call === 'cancel' ? cancelRsvp : withdrawRsvp)(event.id);
      replace(next);
      show(call === 'rsvp' ? goingToast(next.title, language) : call === 'cancel' ? t.declined({ title: next.title }) : t.withdrawn({ title: next.title }));
    } catch (err) {
      setJoinError({ id: event.id, error: refusalOf(err, language) });
      if (err instanceof ApiRequestError && err.status === 409) reload();
    } finally {
      setJoining(null);
    }
  };

  // The joined card has moved to *Going* and its *Join* is gone: the focus goes to its *View event*.
  useEffect(() => {
    if (!refocus) return;
    document.querySelector<HTMLElement>(`[data-open-event="${refocus.replace(/["\\]/g, '\\$&')}"]`)?.focus();
    setRefocus(null);
  }, [refocus, events]);
  const host = useMemo(
    () => ({ meta, metaError: meta ? null : error, reload, close, toast: show, replace }),
    [meta, error, reload, close, show, replace],
  );
  const modalOpen = pathname !== '/events';

  return (
    <Host.Provider value={host}>
      {/* Behind the open modal the list takes no focus and no click: the dialog is modal (AC-5). */}
      <div className="min-w-0" inert={modalOpen || undefined}>
        <FilterBar filter={filter} onChange={setFilter} />
        {error && !events && (
          <div>
            <ErrorBanner {...error} />
            <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{t.tryAgain}</Button>
          </div>
        )}
        {!events && !error && <EventsSkeleton />}
        {events && meta && phone && (
          <PhoneGroups
            events={events}
            filter={filter}
            timezone={timezone}
            can={meta.can}
            busy={joining}
            error={joinError}
            onOpen={open}
            onAnswer={(event, tapped) => void answer(event, tapped)}
          />
        )}
        {events && meta && !phone && (
          <Sections
            events={events}
            companyName={meta.companyName}
            filter={filter}
            card={{ can: meta.can, joining, joinError, onOpen: open, onJoin: (id) => void join(id) }}
          />
        )}
      </div>
      {children}
      {/*
        * Above the modal (`z-50`), which is the whole screen on a phone: every toast the modal raises —
        * *"Joined ✓ — you're going to…"*, *"Pick a score from 0–10 first"* — would otherwise land behind it. A
        * positioned layer at 60 holds the toast's own fixed region in front of the dialog and its scrim.
        * Inside the agent shell the toast is the shell's (P18.95-T1 AC-6), whose region is at 60 itself, and
        * this layer stays empty; it is the screen's own only where no shell holds one.
        */}
      <div data-layer="toast" className="relative z-[60]">
        <Toast toast={toast} />
      </div>
    </Host.Provider>
  );
}

/** `#event-segmented` (`:3426-3430`, CSS `:2051-2056`): each button says whether it is the one on. */
function FilterBar({ filter, onChange }: { filter: EventFilter; onChange: (f: EventFilter) => void }) {
  const t = useMessages(eventsMessages);
  return (
    // On a phone (UI-108): one full-width segmented control on a white pill track, the chosen third navy, each 44px.
    <div
      role="group"
      aria-label={t.filterLabel}
      className="mb-[22px] inline-flex rounded-[9px] border border-hairline bg-card p-[3px] max-md:mb-0 max-md:mt-3 max-md:flex max-md:w-full max-md:rounded-pill max-md:border-transparent max-md:p-0"
    >
      {EVENT_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => onChange(f)}
          className={cn(
            'rounded-md px-4 py-[7px] text-md font-semibold',
            filter === f ? 'bg-navy text-white max-md:bg-transparent max-md:text-white' : 'text-muted hover:text-navy',
            'max-md:flex max-md:min-h-11 max-md:flex-1 max-md:rounded-pill max-md:p-[3px] max-md:text-base',
          )}
        >
          <span
            className={cn(
              'max-md:flex max-md:w-full max-md:items-center max-md:justify-center max-md:whitespace-nowrap max-md:rounded-pill',
              filter === f && 'max-md:bg-navy',
            )}
          >
            {t.filters[f]}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * **A phone's two groups** (UI-108): *Akan datang* — the events still open, joined or not, soonest first — and *Sudah
 * lewat*, latest first, each with its count; the filter shows one or both, and a group with nothing in it is not drawn
 * (D-08). With nothing to show at all, the prototype's empty line for what the filter asked.
 */
function PhoneGroups({ events, filter, timezone, can, busy, error, onOpen, onAnswer }: {
  events: readonly GuestEvent[];
  filter: EventFilter;
  timezone: string;
  can: GuestEventCan;
  busy: string | null;
  error: { id: string; error: ApiError } | null;
  onOpen: (id: string) => void;
  onAnswer: (event: GuestEvent, tapped: 'going' | 'notGoing') => void;
}) {
  const t = useMessages(eventsMessages);
  const { upcoming, past } = phoneGroups(events);
  const groups = [
    { id: 'upcoming', label: t.sections.upcoming, items: filter === 'past' ? [] : upcoming },
    { id: 'past', label: t.sections.past, items: filter === 'upcoming' ? [] : past },
  ].filter((g) => g.items.length > 0);
  if (groups.length === 0) {
    return <p className="px-[18px] py-10 text-center text-md text-muted">{filter === 'past' ? t.emptyPast : t.emptyUpcoming}</p>;
  }
  return (
    <>
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`events-phone-${group.id}`} data-group={group.id}>
          <h2 className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline gap-1.5 text-lg font-bold text-navy">
            <span id={`events-phone-${group.id}`}>{group.label}</span>
            <span className="text-sm font-semibold text-muted">{group.items.length}</span>
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {group.items.map((event) => (
              <li key={event.id} className="min-w-0">
                <PhoneEventCard
                  event={event}
                  timezone={timezone}
                  can={can}
                  busy={busy === event.id}
                  error={error?.id === event.id ? error.error : null}
                  onOpen={onOpen}
                  onAnswer={onAnswer}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** What every card is drawn with: what the reader may do, the *Join* in flight and its refusal. */
interface CardActions {
  can: GuestEventCan;
  joining: string | null;
  joinError: { id: string; error: ApiError } | null;
  onOpen: (id: string) => void;
  onJoin: (id: string) => void;
}

/** *Going*, *Upcoming* and *Past* (`:8546-8571`): *Upcoming* shows the first two, *Past* the last. */
function Sections({ events, companyName, filter, card }: {
  events: readonly GuestEvent[];
  companyName: string;
  filter: EventFilter;
  card: CardActions;
}) {
  const t = useMessages(eventsMessages);
  const { going, upcoming, past } = sections(events);
  const showOpen = filter !== 'past';
  const showPast = filter !== 'upcoming';
  return (
    <>
      {showOpen && <Section id="going" label={t.sections.going} events={going} companyName={companyName} empty={t.emptyGoing} card={card} />}
      {showOpen && <Section id="upcoming" label={t.sections.upcoming} events={upcoming} companyName={companyName} empty={t.emptyUpcoming} card={card} />}
      {showPast && <Section id="past" label={t.sections.past} events={past} companyName={companyName} empty={t.emptyPast} card={card} />}
    </>
  );
}

function Section({ id, label, events, companyName, empty, card }: {
  id: string;
  label: string;
  events: readonly GuestEvent[];
  companyName: string;
  empty: string;
  card: CardActions;
}) {
  const headingId = `events-${id}`;
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{label}</h2>
      {events.length === 0 ? (
        <p className="mb-8 px-[18px] py-10 text-center text-md text-muted">{empty}</p>
      ) : (
        <ul className="mb-8 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
          {events.map((event) => (
            <li key={event.id} className="min-w-0">
              <EventCard
                event={event}
                companyName={companyName}
                canJoin={canJoin(event, card.can)}
                busy={card.joining === event.id}
                error={card.joinError?.id === event.id ? card.joinError.error : null}
                onOpen={card.onOpen}
                onJoin={card.onJoin}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Two sections of cards, shaped like the list that is coming. */
export function EventsSkeleton() {
  const t = useMessages(eventsMessages);
  return (
    <Skeleton label={t.loadingList}>
      {[0, 1].map((s) => (
        <div key={s} className="mb-8">
          <SkeletonBar className="mb-3 h-3 w-20" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-card-edge bg-card px-4 pb-4 pt-3.5">
                <div className="flex items-start gap-2.5">
                  {/* The type's icon, 32px, where the card's poster was (P18.95-T10 AC-1). */}
                  <SkeletonBar className="h-8 w-8 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <SkeletonBar className="w-24" />
                    <SkeletonBar className="mt-2 h-4 w-2/3" />
                  </div>
                </div>
                <SkeletonBar className="mt-2 w-1/2" />
                <SkeletonBar className="mt-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Skeleton>
  );
}
