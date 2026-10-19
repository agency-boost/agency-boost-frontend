'use client';

import { use } from 'react';
import { EventModal } from '@/components/events/event-modal';

/**
 * **One event's modal, over the list** (`/events/[eventId]`; P18.5-T5 AC-5): the address a card opens, Back
 * closes, and a link or a typed address opens again. The list is the layout's. An event the reader is not
 * invited to, an archived one, or none at all is the modal's not-found state.
 */
export default function EventModalPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params);
  return <EventModal key={eventId} id={decodeURIComponent(eventId)} />;
}
