'use client';

import type { ReactNode } from 'react';
import { Page } from '@/components/page';
import { EventsScreen } from '@/components/events/events-screen';
import { useMessages } from '@/i18n/language-provider';
import { eventsMessages } from '@/i18n/messages/events';

/**
 * **KPM Events** (`/events`, and an event's modal at `/events/[eventId]`; `Overall.html:3423-3448`, title
 * `:10413`; P18.5-T5).
 *
 * **A layout, so the list is mounted once** for both addresses: opening an event pushes the modal's
 * address over the list and Back closes it, the list where it was. The pages beneath are nothing — the
 * list's own address — and the modal.
 *
 * Gated by `event:read_list`, which every member of the office holds: the Owner and the Admin reach it
 * through their field view (ADR-0114). The API answers only the events whose audience holds the reader as
 * at each event's start, whatever this decides (ADR-0039).
 */
export default function EventsLayout({ children }: { children: ReactNode }) {
  const t = useMessages(eventsMessages);
  return (
    // No sub-line on a phone (UI V1, UI-108: *grey intro paragraphs* gone; D-08); from 768px as before.
    <Page title={t.title} subtitle={t.sub} subtitleOnPhone={false} permission="event:read_list">
      <EventsScreen>{children}</EventsScreen>
    </Page>
  );
}
