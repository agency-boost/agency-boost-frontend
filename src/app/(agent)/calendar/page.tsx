'use client';

import { Suspense } from 'react';
import { CalendarScreen } from '@/components/calendar/calendar-screen';
import { Page } from '@/components/page';
import { useMessages } from '@/i18n/language-provider';
import { calendarMessages } from '@/i18n/messages/calendar';
import { readableDate } from '@/lib/calendar';
import { useQuery } from '@/lib/use-query';

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
 * **The address** (`route-registry.md`, `/calendar`): `view` (`agenda` · `three_days` · `week` · `month`; UI V1, UI-104 —
 * Home's *Jadwal hari ini* opens `?view=agenda`, `agendaHref`), `date` (an office date
 * inside the period) and `entry` (an entry whose detail opens, on the week holding it) — the last two
 * are what a notice's row opens (ADR-0095). Anything unreadable is ignored for the default, never an
 * error page. A new address is a new screen, so a notice opened from the calendar itself starts afresh.
 * **`with`** (P18.96-T6 AC-4) — a membership id — opens *New event* as a 1:1 with them: *1:1 coaching*, *"1:1 with
 * {full name}"* and them invited, on the office's today. `/new-hires`' *Schedule 1:1* is its caller.
 * **Without a `view`** the page opens on Week, and on a phone on the Agenda (P18.95-T8 AC-1), so an
 * address that names one is passed on as named and one that does not, as nothing.
 */
export default function CalendarPage() {
  return (
    // `useSearchParams` needs a boundary (`lib/use-query.ts`). Nothing in its place: a prerender draws the shell's gate, never this.
    <Suspense fallback={null}>
      <Calendar />
    </Suspense>
  );
}

function Calendar() {
  const query = useQuery();
  const asked = one(query.view);
  const view = asked === 'month' || asked === 'week' || asked === 'agenda' || asked === 'three_days' ? asked : undefined;
  const date = readableDate(one(query.date));
  const entry = one(query.entry);
  const withId = one(query.with);
  const t = useMessages(calendarMessages);
  return (
    <Page title={t.title} permission="calendar_entry:read">
      <CalendarScreen
        key={`${view ?? ''}|${date ?? ''}|${entry ?? ''}|${withId ?? ''}`}
        initialView={view}
        initialDate={date}
        initialEntry={entry}
        initialWith={withId}
      />
    </Page>
  );
}
