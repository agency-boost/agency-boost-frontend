'use client';

import { use } from 'react';
import { CalendarScreen } from '@/components/calendar/calendar-screen';
import { Page } from '@/components/page';
import { PROTOTYPE_COPY, readableDate } from '@/lib/calendar';

type Query = { view?: string | string[]; date?: string | string[]; entry?: string | string[] };

const one = (value: string | string[] | undefined) => (typeof value === 'string' && value ? value : undefined);

/**
 * Calendar (`AgencyBoost_Calendar_Section.html`; Phase 12): the reader's week and month, the people
 * they invite, and — for a leader — the calendars of the people they coach beside their own.
 *
 * Titled as the prototype titles it, *Calendar*, with no sub-line (`:276`). Every field role has one,
 * an AB, an AAB and an Agent alike (roles §4.2); the Owner and the Admin as such have none (ADR-0094),
 * and the gate below is `calendar_entry:read`. The API answers only what the reader may read, whatever
 * this decides.
 *
 * **The address** (`route-registry.md`, `/calendar`): `view` (`week` · `month`), `date` (an office date
 * inside the period) and `entry` (an entry whose detail opens, on the week holding it) — the last two
 * are what a notice's row opens (ADR-0095). Anything unreadable is ignored for the default, never an
 * error page. A new address is a new screen, so a notice opened from the calendar itself starts afresh.
 * **Without a `view`** the page opens on Week, and on a phone on the Agenda (P18.95-T8 AC-1), so an
 * address that names one is passed on as named and one that does not, as nothing.
 */
export default function CalendarPage({ searchParams }: { searchParams?: Promise<Query> }) {
  const query = searchParams ? use(searchParams) : {};
  const asked = one(query.view);
  const view = asked === 'month' || asked === 'week' ? asked : undefined;
  const date = readableDate(one(query.date));
  const entry = one(query.entry);
  return (
    <Page title={PROTOTYPE_COPY.calendar} permission="calendar_entry:read">
      <CalendarScreen key={`${view ?? ''}|${date ?? ''}|${entry ?? ''}`} initialView={view} initialDate={date} initialEntry={entry} />
    </Page>
  );
}
