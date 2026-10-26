'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ErrorBanner } from '@/components/ui/field';
import { Skeleton, SkeletonBar } from '@/components/ui/skeleton';
import { Toast, useToast } from '@/components/ui/toast';
import { toDisplayError, type ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  EVENT_FILTERS, OWN_COPY, PROTOTYPE_COPY, readEvents, sections, type EventFilter, type EventsMeta, type GuestEvent,
} from '@/lib/events';
import { EventCard } from './event-card';

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
 * Its own states are Fills (L-01): a skeleton shaped like the cards, an error with a retry, and the
 * prototype's three empty rows for a section with nothing in it.
 */
export function EventsScreen({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast, show } = useToast();
  const [events, setEvents] = useState<GuestEvent[] | null>(null);
  const [meta, setMeta] = useState<EventsMeta | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<EventFilter>('all');
  /** Whether this list pushed the modal's address — so closing it can go back rather than forward. */
  const openedHere = useRef(false);

  useEffect(() => {
    let live = true;
    setError(null);
    readEvents()
      .then((answer) => {
        if (!live) return;
        setEvents(answer.events);
        setMeta({ companyName: answer.companyName, limits: answer.limits, can: answer.can });
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
            <Button variant="secondary" className="mt-3" onClick={() => setAttempt((n) => n + 1)}>{OWN_COPY.tryAgain}</Button>
          </div>
        )}
        {!events && !error && <EventsSkeleton />}
        {events && meta && <Sections events={events} companyName={meta.companyName} filter={filter} onOpen={open} />}
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
  return (
    <div role="group" aria-label={OWN_COPY.filterLabel} className="mb-[22px] inline-flex rounded-[9px] border border-hairline bg-card p-[3px]">
      {EVENT_FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={filter === f}
          onClick={() => onChange(f)}
          className={cn(
            'rounded-md px-4 py-[7px] text-md font-semibold',
            filter === f ? 'bg-navy text-white' : 'text-muted hover:text-navy',
          )}
        >
          {PROTOTYPE_COPY.filters[f]}
        </button>
      ))}
    </div>
  );
}

/** *Going*, *Upcoming* and *Past* (`:8546-8571`): *Upcoming* shows the first two, *Past* the last. */
function Sections({ events, companyName, filter, onOpen }: {
  events: readonly GuestEvent[];
  companyName: string;
  filter: EventFilter;
  onOpen: (id: string) => void;
}) {
  const { going, upcoming, past } = sections(events);
  const showOpen = filter !== 'past';
  const showPast = filter !== 'upcoming';
  return (
    <>
      {showOpen && <Section id="going" label={PROTOTYPE_COPY.sections.going} events={going} companyName={companyName} empty={PROTOTYPE_COPY.emptyGoing} onOpen={onOpen} />}
      {showOpen && <Section id="upcoming" label={PROTOTYPE_COPY.sections.upcoming} events={upcoming} companyName={companyName} empty={PROTOTYPE_COPY.emptyUpcoming} onOpen={onOpen} />}
      {showPast && <Section id="past" label={PROTOTYPE_COPY.sections.past} events={past} companyName={companyName} empty={PROTOTYPE_COPY.emptyPast} onOpen={onOpen} />}
    </>
  );
}

function Section({ id, label, events, companyName, empty, onOpen }: {
  id: string;
  label: string;
  events: readonly GuestEvent[];
  companyName: string;
  empty: string;
  onOpen: (id: string) => void;
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
              <EventCard event={event} companyName={companyName} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Two sections of cards, shaped like the list that is coming. */
export function EventsSkeleton() {
  return (
    <Skeleton label={OWN_COPY.loadingList}>
      {[0, 1].map((s) => (
        <div key={s} className="mb-8">
          <SkeletonBar className="mb-3 h-3 w-20" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-hairline bg-card">
                <div className="h-[110px] bg-hairline" />
                <div className="px-4 pb-4 pt-3.5">
                  <SkeletonBar className="w-24" />
                  <SkeletonBar className="mt-2 h-4 w-2/3" />
                  <SkeletonBar className="mt-2 w-1/2" />
                  <SkeletonBar className="mt-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Skeleton>
  );
}
