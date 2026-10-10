'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ADMIN_COPY } from '@/lib/events-admin';
import { useCan } from '@/lib/session';
import { FeedbackSummarySection } from './feedback-summary';
import { RollCallSection } from './roll-call';

/**
 * **What *View feedback* opens on a past event's row** (`KPM_Owner.html:1655`, an `alert()` there; P18.5-T5
 * AC-7, P18.5-T6 AC-5; D-rollcall): the roll call first, then the *Feedback Summary* — one dialog, named by
 * the event.
 *
 * **The roll call comes first because the summary depends on it**: the NPS counts confirmed attendees only,
 * so saving the roll call reads the summary again, and an answer waiting on a confirmation moves into the
 * NPS as the confirmation lands.
 *
 * Each part is drawn for a reader the server would answer: **the roll call under `event_attendance:confirm`**,
 * which guards its read as well as its write (contract, *final*) — so a read-only support session as the Owner,
 * which holds no confirmation, is shown no roll call at all; the summary under `event_feedback:read` at the
 * office's reach. The server refuses either regardless.
 */
export function FeedbackDialog({ eventId, title, onClose }: { eventId: string; title: string; onClose: () => void }) {
  const [version, setVersion] = useState(0);
  const mayReadRollCall = useCan('event_attendance:confirm');
  const mayReadFeedback = useCan('event_feedback:read');
  return (
    <Modal open title={title} onClose={onClose} focusDialog className="max-w-[44rem]">
      {mayReadRollCall && <RollCallSection eventId={eventId} onSaved={() => setVersion((n) => n + 1)} />}
      {mayReadFeedback && <FeedbackSummarySection eventId={eventId} version={version} />}
      {/* A way out a finger can find: Escape and the scrim close it too, and neither is visible. */}
      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onClose}>{ADMIN_COPY.close}</Button>
      </div>
    </Modal>
  );
}
